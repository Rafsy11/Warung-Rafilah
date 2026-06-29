# 01 — SYSTEM ARCHITECTURE

## 1. Container Topology

```
                              ┌─────────────────────────────┐
                              │   ASUS NUC (Ubuntu 24 LTS)   │
                              │   8GB RAM / 256GB NVMe        │
                              │                               │
   Internet ──(outbound)──►   │  ┌─────────────┐              │
   QRIS Webhook                  │ cloudflared │──┐           │
                              │  └─────────────┘  │           │
                              │                    ▼           │
                              │            ┌───────────────┐   │
   Cashier Terminal ───────────────────────►│   nextjs      │   │
   (browser, kiosk mode)      │            │  (standalone)  │   │
                              │            └───────┬───────┘   │
                              │                    │           │
                              │            ┌───────▼───────┐   │
                              │            │   postgres     │◄──┼── n8n (reads/writes
                              │            │   (schemas:    │   │      for automation
                              │            │  core/warung/  │   │      + its own state)
                              │            │  agent/n8n)    │   │
                              │            └───────▲───────┘   │
                              │                    │           │
                              │            ┌───────┴───────┐   │
                              │            │     n8n        │   │
                              │            │  (automation)  │   │
                              │            └───────────────┘   │
                              └─────────────────────────────┘
```

All inter-container traffic stays on the internal Docker bridge network (`pos_internal`). Only `cloudflared` has an outbound connection to the internet; nothing in this stack ever has an open inbound port on the router. The Next.js port is bound to `127.0.0.1:3000` on the host so it's reachable from a kiosk browser on the same LAN/machine but not exposed externally except through the tunnel.

## 2. Container Responsibilities

| Container | Responsibility | Talks to |
|---|---|---|
| `nextjs` | UI rendering, API routes, business logic, auth | postgres |
| `postgres` | System of record for both ledgers, n8n's own state | nextjs, n8n |
| `n8n` | Scheduled jobs (stock alerts, daily closing reminders, float alerts), webhook retry monitoring | postgres, external messaging APIs |
| `cloudflared` | Reverse tunnel exposing only `/api/webhooks/*` to the internet for inbound QRIS payment confirmations | nextjs |

## 3. RAM Budget (8GB Total)

| Allocation | Amount |
|---|---|
| Ubuntu 24 OS + kernel + disk cache headroom | ~1.5GB reserved (untouched by containers) |
| `postgres` hard limit | 1.5GB (reservation 512MB) |
| `nextjs` hard limit | 300MB (reservation 150MB) |
| `n8n` hard limit | 600MB (reservation 250MB) |
| `cloudflared` hard limit | 96MB (reservation 32MB) |
| **Sum of hard limits** | **~2.5GB** |
| **Free headroom even at full saturation** | **~4GB** |

This deliberately leaves a large safety margin. The hard limits in `05_DOCKER_DEPLOYMENT.md` are ceilings, not targets — normal operation should sit well below them. The margin exists so a Postgres `VACUUM`, an n8n workflow burst, or Linux page cache growth never triggers an OOM kill on a machine nobody is actively watching.

## 4. Data Flow: Warung Sale (Physical Cash Register Path)

1. Cashier presses **F1** → UI switches to Warung Mode, hidden barcode-input field auto-focuses.
2. Hardware scanner fires a fast sequence of keystrokes + Enter into that field (scanners emulate a keyboard).
3. Client calls `GET /api/products/lookup?barcode=...` → indexed lookup on `warung.products.barcode` (unique btree index, see `02_DATABASE_SCHEMA.md`).
4. Product appended to in-memory cart (client-side React state — no DB write yet, this keeps scanning fast and avoids a write per scan).
5. Cashier presses **Enter** to open checkout, selects payment method, enters cash tendered.
6. Client calls `POST /api/sales` with the full cart. Server runs a **single transaction**: insert `warung.sales` row, insert all `warung.sale_items` rows, insert `warung.stock_movements` rows, decrement `warung.products.stock_qty`. All or nothing.
7. Server returns change due; UI displays it large and clears the cart.

Nothing in this path ever touches the `agent` schema.

## 5. Data Flow: AmarthaFin Agent Transaction (Virtual Float Path)

1. Operator presses **F2** → UI switches to Agent Mode.
2. Operator selects service type (e-wallet top-up, bill payment, QRIS deposit, cash withdrawal, transfer), enters customer phone + amount.
3. Client calls `POST /api/agent/transactions` → server inserts an `agent.transactions` row with `status = 'pending'`, and an `agent.float_ledger` row reflecting the float movement.
4. For QRIS deposits specifically, the actual settlement confirmation arrives **asynchronously** via webhook (see flow below) — the transaction stays `pending` until then.
5. n8n polls for transactions stuck in `pending` past a timeout and surfaces them to the operator for manual reconciliation.

Nothing in this path ever touches the `warung` schema.

## 6. Data Flow: Inbound QRIS Webhook

1. AmarthaFin's payment processor sends a signed POST to the public Cloudflare Tunnel hostname, e.g. `https://pos-yourwarung.yourdomain.com/api/webhooks/qris`.
2. `cloudflared` forwards it over the internal network to `nextjs:3000/api/webhooks/qris` — the tunnel is the *only* way this URL is reachable from outside.
3. The API route verifies the HMAC signature (see `08_SECURITY_HARDENING.md`) before touching the database.
4. The raw payload is inserted into `agent.webhook_events` first (idempotency: unique on `event_id`), **then** processed — so a duplicate or replayed webhook never double-credits a transaction.
5. If valid and not a duplicate, the matching `agent.transactions` row is updated to `status = 'success'`, `settled_at = now()`, and a `commission_earned` row is appended to `agent.float_ledger`.
6. The Agent Mode UI polls (or uses a lightweight SSE/poll-based refresh) to reflect the settled status without a manual page reload.

## 7. Ledger Separation Principle (Critical)

This is the single most important business rule in the entire system:

- **Warung revenue** = money the store earned by selling its own goods. Lives entirely in the `warung` schema. Reported in Warung Mode dashboards only.
- **Agent float** = third-party AmarthaFin money temporarily passing through the store's hands, on which the store earns a fixed commission per transaction. Lives entirely in the `agent` schema. Reported in Agent Mode dashboards only.
- These are never summed together into one "total revenue" number anywhere in the UI, the API, or any report. The only number that legitimately combines both is the owner's personal take-home, which is `warung gross margin + agent commission earned` — and even that combined figure must be presented as two clearly labeled line items, never a single blended total, so the owner never mistakes float volume for actual income.
- A code reviewer (human or agent) should treat any SQL `JOIN` or application-level merge between `warung.*` and `agent.*` tables as a request for clarification, not something to silently implement.

## 8. Why Not [Common Alternative]?

A few decisions worth stating explicitly so they aren't "fixed" later:

- **No ORM with heavy runtime (e.g. full Prisma client)** — use the native `pg` driver with a small typed query layer. Prisma's query engine binary and client overhead works against the <200MB Next.js budget. If the agent strongly prefers an ORM, **Drizzle ORM** is acceptable (it's a thin SQL builder, not a separate engine process) — but raw `pg` with hand-written, indexed queries is the default per `03_NEXTJS_STANDARDS.md`.
- **No Redis** — at this scale (single till, single store), Postgres + in-process caching is sufficient and one less container to budget RAM for.
- **No microservices** — one Next.js app serves both UI and API routes via Route Handlers. Splitting this into separate frontend/backend services would cost RAM for no benefit on a single-NUC deployment.

Proceed to `02_DATABASE_SCHEMA.md`.
