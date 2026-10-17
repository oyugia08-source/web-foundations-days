# TicketHub Presentation Guide

Adapt this walkthrough to the time limit given by the instructor. Keep the distinction clear: the design document describes the production architecture; the browser demo is a small prototype with in-memory inventory and simulated payment.

## Start the demo

From the repository root, run:

```powershell
node day8/demo/server.js
```

Open `http://localhost:4178`. The server must remain running during the presentation. Restarting it resets the sample seats and tickets.

## Suggested walkthrough

1. **State the problem and requirements.** TicketHub has 2 million registered users. Normal traffic is 50,000 daily visitors x 10 pages = 500,000 page views/day, or about 5.8 page-data requests/second on average. For the sale, 200,000 buyers may compete for 20,000 seats in 10 minutes.
2. **Explain the protection.** The seat map is only a snapshot. A hold is an atomic all-or-nothing operation against the authoritative database. PostgreSQL row locks serialize competing claims; the conditional status/expiry check rejects a held or sold seat; a unique order-item seat constraint prevents a second ticket.
3. **Show the conflict in the live prototype.** Open the demo in two tabs. In both tabs, select the same available seat before submitting. In tab 1, hold it. In tab 2, submit the already-selected seat. Show the friendly conflict message and explain that the API returns `409 Conflict`; no partial hold is created.
4. **Show the recovery and success paths.** Select a different seat, place a hold, choose “Simulate declined payment,” and show that the hold remains available for retry or release. Complete demo checkout and point out the ticket in “Your tickets.” Mention that payment is simulated and state resets when the server restarts.
5. **Close with scaling and trade-offs.** Reads are served from the CDN/cache or read replica where safe. Seat decisions go to the primary. The waiting room initially targets 600 admitted buyers/second, subject to load-test validation; if latency or lock waits exceed limits, admission slows. FIFO is predictable but creates waiting, and short holds return inventory quickly but leave less checkout time.

## Likely questions

- **Why not trust the seat map?** It may be stale; only the transactional hold decides ownership.
- **What happens if the payment provider is slow?** Do not keep database locks during payment. Keep the short hold, process a signed idempotent callback, and reconcile/refund if the hold expired before success.
- **Where is the main bottleneck?** The primary database's conflicting seat writes. The queue protects it; CDN caching and read replicas scale non-authoritative reads.
- **What is not production-ready in the demo?** Inventory is in memory, identity is represented by a demo buyer selector, and checkout is simulated. Production needs persistent PostgreSQL, authentication, a real payment provider, a durable queue, monitoring, and load tests.
