const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const port = Number(process.env.PORT || 4178);
const holdDurationMs = 2 * 60 * 1000;
const event = {
  id: "evening-jazz",
  title: "Evening Jazz Live",
  venue: "Harbor Hall",
  date: "Friday, November 20 · 8:00 PM",
  description: "An intimate live set with the Harbor Quartet.",
};
const seats = ["A", "B"].flatMap((section) =>
  Array.from({ length: 6 }, (_, index) => ({
    id: `${section}${index + 1}`,
    section,
    row: section,
    number: index + 1,
    price: section === "A" ? 89 : 65,
    status: "available",
    holdId: null,
    holdExpiresAt: null,
  }))
);
const holds = new Map();
const completedHolds = new Map();
const holdRequests = new Map();

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(body === undefined ? "" : JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 16_384) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function expireHolds() {
  const now = Date.now();
  for (const [holdId, hold] of holds) {
    if (hold.expiresAt <= now) {
      for (const seatId of hold.seatIds) {
        const seat = seats.find((item) => item.id === seatId);
        if (seat?.holdId === holdId) {
          seat.status = "available";
          seat.holdId = null;
          seat.holdExpiresAt = null;
        }
      }
      holds.delete(holdId);
    }
  }
}

function publicSeat(seat) {
  return {
    id: seat.id,
    section: seat.section,
    row: seat.row,
    number: seat.number,
    price: seat.price,
    status: seat.status,
    holdExpiresAt: seat.holdExpiresAt,
  };
}

async function handleApi(request, response, url) {
  expireHolds();

  if (request.method === "GET" && url.pathname === "/api/events") {
    return sendJson(response, 200, { events: [event] });
  }

  if (request.method === "GET" && url.pathname === `/api/events/${event.id}/seats`) {
    return sendJson(response, 200, { eventId: event.id, seats: seats.map(publicSeat) });
  }

  if (request.method === "GET" && url.pathname === "/api/me/tickets") {
    const buyerId = url.searchParams.get("buyerId");
    if (!buyerId) {
      return sendJson(response, 400, { error: "buyerId is required for this demo." });
    }
    const tickets = [...completedHolds.values()]
      .filter((order) => order.buyerId === buyerId)
      .flatMap((order) => order.tickets);
    return sendJson(response, 200, { tickets });
  }

  if (request.method === "POST" && url.pathname === `/api/events/${event.id}/holds`) {
    let body;
    try {
      body = await readJson(request);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }

    const seatIds = Array.isArray(body.seatIds) ? [...new Set(body.seatIds)] : [];
    const buyerId = typeof body.buyerId === "string" ? body.buyerId.trim() : "";
    const idempotencyKey = request.headers["idempotency-key"];
    if (!buyerId || buyerId.length > 40 || seatIds.length < 1 || seatIds.length > 4) {
      return sendJson(response, 400, {
        error: "Provide a buyer ID and select between one and four seats.",
      });
    }
    if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
      return sendJson(response, 400, { error: "A valid Idempotency-Key header is required." });
    }

    const requestKey = `${buyerId}:${idempotencyKey}`;
    const previousResult = holdRequests.get(requestKey);
    if (previousResult) {
      return sendJson(response, previousResult.status, previousResult.body);
    }

    const requestedSeats = seatIds.map((seatId) => seats.find((seat) => seat.id === seatId));
    if (requestedSeats.some((seat) => !seat)) {
      return sendJson(response, 400, { error: "One or more seat IDs are invalid." });
    }

    const unavailableSeats = requestedSeats
      .filter((seat) => seat.status !== "available")
      .map((seat) => seat.id);
    if (unavailableSeats.length > 0) {
      const body = {
        error: "Those seats are no longer available. Refresh the seat map and choose again.",
        unavailableSeatIds: unavailableSeats,
      };
      holdRequests.set(requestKey, { status: 409, body });
      return sendJson(response, 409, body);
    }

    const holdId = randomUUID();
    const expiresAt = Date.now() + holdDurationMs;
    const hold = { id: holdId, buyerId, seatIds, expiresAt };
    holds.set(holdId, hold);
    for (const seat of requestedSeats) {
      seat.status = "held";
      seat.holdId = holdId;
      seat.holdExpiresAt = new Date(expiresAt).toISOString();
    }
    const responseBody = {
      orderId: holdId,
      buyerId,
      seatIds,
      status: "held",
      holdExpiresAt: new Date(expiresAt).toISOString(),
    };
    holdRequests.set(requestKey, { status: 201, body: responseBody });
    return sendJson(response, 201, responseBody);
  }

  const holdMatch = url.pathname.match(/^\/api\/orders\/([\w-]+)\/hold$/);
  if (request.method === "DELETE" && holdMatch) {
    const holdId = holdMatch[1];
    const hold = holds.get(holdId);
    if (!hold) {
      return sendJson(response, 404, { error: "This hold is missing or has expired." });
    }
    if (url.searchParams.get("buyerId") !== hold.buyerId) {
      return sendJson(response, 403, { error: "This hold belongs to another buyer." });
    }
    for (const seatId of hold.seatIds) {
      const seat = seats.find((item) => item.id === seatId);
      if (seat?.holdId === holdId) {
        seat.status = "available";
        seat.holdId = null;
        seat.holdExpiresAt = null;
      }
    }
    holds.delete(holdId);
    return sendJson(response, 204);
  }

  const checkoutMatch = url.pathname.match(/^\/api\/orders\/([\w-]+)\/payment$/);
  if (request.method === "POST" && checkoutMatch) {
    let body;
    try {
      body = await readJson(request);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }

    const holdId = checkoutMatch[1];
    const completed = completedHolds.get(holdId);
    if (completed) {
      if (completed.buyerId !== body.buyerId) {
        return sendJson(response, 403, { error: "This order belongs to another buyer." });
      }
      return sendJson(response, 200, completed);
    }

    const hold = holds.get(holdId);
    if (!hold || hold.expiresAt <= Date.now()) {
      expireHolds();
      return sendJson(response, 409, { error: "Your hold expired. Select available seats again." });
    }
    if (body.buyerId !== hold.buyerId) {
      return sendJson(response, 403, { error: "This hold belongs to another buyer." });
    }
    if (body.simulateDecline === true) {
      return sendJson(response, 402, {
        error: "Payment was declined. Your seats remain held while you retry or release them.",
      });
    }

    const orderId = randomUUID();
    const tickets = hold.seatIds.map((seatId) => {
      const seat = seats.find((item) => item.id === seatId);
      seat.status = "sold";
      seat.holdId = null;
      seat.holdExpiresAt = null;
      return {
        ticketId: randomUUID(),
        eventTitle: event.title,
        venue: event.venue,
        date: event.date,
        seatId,
        price: seat.price,
      };
    });
    const subtotal = tickets.reduce((sum, ticket) => sum + ticket.price, 0);
    const serviceFee = tickets.length * 5;
    const order = {
      orderId,
      buyerId: hold.buyerId,
      status: "paid",
      subtotal,
      serviceFee,
      totalAmount: subtotal + serviceFee,
      currency: "USD",
      tickets,
    };
    holds.delete(holdId);
    completedHolds.set(holdId, order);
    return sendJson(response, 201, order);
  }

  return sendJson(response, 404, { error: "API endpoint not found." });
}

const staticFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
]);

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    return handleApi(request, response, url);
  }

  const file = staticFiles.get(url.pathname);
  if (request.method !== "GET" || !file) {
    return sendJson(response, 404, { error: "Page not found." });
  }

  const filePath = path.join(__dirname, file[0]);
  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      return response.end("Unable to load the demo page.");
    }
    response.writeHead(200, {
      "content-type": file[1],
      "cache-control": "no-store",
    });
    response.end(contents);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`TicketHub demo running at http://localhost:${port}`);
});
