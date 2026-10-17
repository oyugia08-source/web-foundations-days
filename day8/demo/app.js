const seatMap = document.querySelector("#seat-map");
const buyerSelect = document.querySelector("#buyer-id");
const selectionSummary = document.querySelector("#selection-summary");
const subtotalOutput = document.querySelector("#subtotal");
const serviceFeeOutput = document.querySelector("#service-fee");
const totalOutput = document.querySelector("#total");
const holdButton = document.querySelector("#hold-btn");
const holdDetails = document.querySelector("#hold-details");
const countdownOutput = document.querySelector("#countdown");
const statusMessage = document.querySelector("#status-message");
const ticketList = document.querySelector("#ticket-list");
const selectedSeatIds = new Set();

let seats = [];
let activeHold = null;
let countdownTimer = null;
let holdIdempotencyKey = null;
const serviceFeePerSeat = 5;

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const error = new Error(data?.error || "The request could not be completed.");
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

function showMessage(message, kind = "") {
  statusMessage.textContent = message;
  statusMessage.dataset.kind = kind;
}

function selectedSeats() {
  return seats.filter((seat) => selectedSeatIds.has(seat.id));
}

function renderSummary() {
  const items = activeHold
    ? seats.filter((seat) => activeHold.seatIds.includes(seat.id))
    : selectedSeats();
  const subtotal = items.reduce((sum, seat) => sum + seat.price, 0);
  const serviceFee = items.length * serviceFeePerSeat;
  const total = subtotal + serviceFee;

  selectionSummary.textContent = items.length
    ? items.map((seat) => `${seat.id} ($${seat.price})`).join(", ")
    : "Choose up to 4 seats";
  subtotalOutput.textContent = `$${subtotal.toFixed(2)}`;
  serviceFeeOutput.textContent = `$${serviceFee.toFixed(2)}`;
  totalOutput.textContent = `$${total.toFixed(2)}`;
  holdButton.disabled = selectedSeatIds.size === 0 || Boolean(activeHold);
}

function renderSeats() {
  seatMap.replaceChildren();
  for (const seat of seats) {
    const button = document.createElement("button");
    const isSelected = selectedSeatIds.has(seat.id);
    button.type = "button";
    button.className = `seat${isSelected ? " is-selected" : ""}${seat.status !== "available" ? ` is-${seat.status}` : ""}`;
    button.textContent = seat.id;
    button.setAttribute("aria-label", `Section ${seat.section}, seat ${seat.number}, $${seat.price}, ${seat.status}`);
    button.setAttribute("aria-pressed", String(isSelected));
    button.title = `${seat.id} · $${seat.price} · ${seat.status}`;
    button.disabled = seat.status !== "available" || Boolean(activeHold);
    button.addEventListener("click", () => {
      if (selectedSeatIds.has(seat.id)) {
        selectedSeatIds.delete(seat.id);
      } else if (selectedSeatIds.size < 4) {
        selectedSeatIds.add(seat.id);
      } else {
        showMessage("You can select up to four seats per order.", "error");
      }
      renderSeats();
      renderSummary();
    });
    seatMap.append(button);
  }
  renderSummary();
}

async function refreshSeats() {
  try {
    const result = await requestJson("/api/events/evening-jazz/seats");
    seats = result.seats;
    renderSeats();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function refreshTickets() {
  try {
    const buyerId = encodeURIComponent(buyerSelect.value);
    const result = await requestJson(`/api/me/tickets?buyerId=${buyerId}`);
    ticketList.replaceChildren();
    if (result.tickets.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Complete checkout to see tickets here.";
      ticketList.append(empty);
      return;
    }

    for (const ticket of result.tickets) {
      const card = document.createElement("article");
      card.className = "ticket-card";
      const details = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = ticket.eventTitle;
      const date = document.createElement("p");
      date.textContent = `${ticket.venue} · ${ticket.date}`;
      const seat = document.createElement("strong");
      seat.className = "ticket-seat";
      seat.textContent = ticket.seatId;
      details.append(title, date);
      card.append(details, seat);
      ticketList.append(card);
    }
  } catch (error) {
    showMessage(error.message, "error");
  }
}

function stopCountdown() {
  if (countdownTimer) {
    window.clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function startCountdown() {
  stopCountdown();
  const update = () => {
    const secondsLeft = Math.max(0, Math.ceil((Date.parse(activeHold.holdExpiresAt) - Date.now()) / 1000));
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = String(secondsLeft % 60).padStart(2, "0");
    countdownOutput.textContent = `${minutes}:${seconds}`;
    if (secondsLeft === 0) {
      stopCountdown();
      activeHold = null;
      buyerSelect.disabled = false;
      holdDetails.hidden = true;
      holdButton.hidden = false;
      selectedSeatIds.clear();
      renderSeats();
      showMessage("Your hold expired. Choose from the seats still available.", "error");
    }
  };
  update();
  countdownTimer = window.setInterval(update, 1000);
}

holdButton.addEventListener("click", async () => {
  holdButton.disabled = true;
  showMessage("Checking availability and placing your hold...");
  holdIdempotencyKey ||= crypto.randomUUID();
  try {
    activeHold = await requestJson("/api/events/evening-jazz/holds", {
      method: "POST",
      headers: { "Idempotency-Key": holdIdempotencyKey },
      body: JSON.stringify({ buyerId: buyerSelect.value, seatIds: [...selectedSeatIds] }),
    });
    holdIdempotencyKey = null;
    buyerSelect.disabled = true;
    selectedSeatIds.clear();
    holdButton.hidden = true;
    holdDetails.hidden = false;
    renderSummary();
    startCountdown();
    showMessage("Seats held for you. Checkout before the timer expires.", "success");
    await refreshSeats();
  } catch (error) {
    if (error.status === 409) {
      holdIdempotencyKey = null;
      selectedSeatIds.clear();
      await refreshSeats();
      showMessage(error.message, "error");
    } else {
      showMessage(error.message, "error");
    }
    renderSummary();
  }
});

document.querySelector("#pay-btn").addEventListener("click", () => checkout(false));
document.querySelector("#decline-btn").addEventListener("click", () => checkout(true));

async function checkout(simulateDecline) {
  if (!activeHold) return;
  try {
    const order = await requestJson(`/api/orders/${activeHold.orderId}/payment`, {
      method: "POST",
      body: JSON.stringify({ buyerId: buyerSelect.value, simulateDecline }),
    });
    stopCountdown();
    activeHold = null;
    buyerSelect.disabled = false;
    holdDetails.hidden = true;
    holdButton.hidden = false;
    selectedSeatIds.clear();
    renderSummary();
    await Promise.all([refreshSeats(), refreshTickets()]);
    showMessage(`Order complete: $${order.totalAmount.toFixed(2)} ${order.currency}. ${order.tickets.length} ticket${order.tickets.length === 1 ? "" : "s"} added to Your tickets.`, "success");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

document.querySelector("#release-btn").addEventListener("click", async () => {
  if (!activeHold) return;
  try {
    await requestJson(`/api/orders/${activeHold.orderId}/hold?buyerId=${encodeURIComponent(buyerSelect.value)}`, {
      method: "DELETE",
    });
    stopCountdown();
    activeHold = null;
    buyerSelect.disabled = false;
    holdDetails.hidden = true;
    holdButton.hidden = false;
    selectedSeatIds.clear();
    renderSummary();
    await refreshSeats();
    showMessage("Your seats are available again.", "success");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

buyerSelect.addEventListener("change", async () => {
  selectedSeatIds.clear();
  renderSeats();
  await refreshTickets();
  showMessage("");
});
document.querySelector("#refresh-tickets").addEventListener("click", refreshTickets);

async function initialize() {
  try {
    const result = await requestJson("/api/events");
    if (result.events.length === 0) {
      showMessage("No events are available right now.", "error");
      return;
    }
    await Promise.all([refreshSeats(), refreshTickets()]);
    window.setInterval(() => {
      if (!document.hidden) refreshSeats();
    }, 4000);
  } catch (error) {
    showMessage(`TicketHub could not connect to its demo server: ${error.message}`, "error");
  }
}

initialize();
