# 09 — AGENT EXECUTION PLAN

This is the build sequence. Follow it in order — each phase depends on the previous one being functionally complete, not just started.

## Phase 1 — Scaffold

1. Initialize the Next.js project (TypeScript, App Router, Tailwind) inside `app/`.
2. Apply `next.config.js` exactly as specified in `03_NEXTJS_STANDARDS.md` § 1.
3. Apply `tailwind.config.ts` and `app/globals.css` exactly as specified in `04_UI_DESIGN_SYSTEM.md` § 2–3.
4. Create the folder structure from `03_NEXTJS_STANDARDS.md` § 2 as empty stubs (pages that just render a placeholder, route handlers that return `501 Not Implemented`) so the structure exists before logic is filled in.
5. Install the dependency set from `03_NEXTJS_STANDARDS.md` § 8 — `pg`, `bcryptjs`, `lucide-react`, `zod`. Do not add a full ORM unless a deliberate decision is made to use Drizzle.

**Checkpoint:** `npm run build` succeeds with `output: 'standalone'` and produces `.next/standalone/server.js`.

## Phase 2 — Database

1. Write `db/init/001_schema.sql` with the exact DDL from `02_DATABASE_SCHEMA.md` § 2.
2. Write `db/postgresql.conf` exactly as specified in `05_DOCKER_DEPLOYMENT.md` § 4.
3. Bring up just the `postgres` service in isolation (`docker compose up -d postgres`) and verify all three schemas (`core`, `warung`, `agent`) plus `n8n` exist, all tables are created, and `uq_products_barcode` exists as a unique index.
4. Insert one seed owner user via `psql` with a properly bcrypt-hashed PIN (use `lib/auth.ts`'s `hashPin` in a one-off script, don't hand-write a hash) so Phase 4's login flow has something to authenticate against.

**Checkpoint:** `\dt warung.*`, `\dt agent.*`, `\dt core.*` inside `psql` show all tables from `02_DATABASE_SCHEMA.md`.

## Phase 3 — Data Layer

1. Implement `lib/db.ts` exactly as specified in `02_DATABASE_SCHEMA.md` § 3.
2. Implement `lib/auth.ts` and `lib/webhook-verify.ts` per `08_SECURITY_HARDENING.md` § 1–2.
3. Implement every route handler listed in `06_API_CONTRACTS.md`, matching request/response shapes exactly, including error codes.
4. The `POST /api/sales` handler must wrap its inserts in a single `BEGIN`/`COMMIT` transaction via the `pg` client — verify by forcing a failure mid-transaction (e.g. insufficient stock on the second item) and confirming no partial rows were written.

**Checkpoint:** Every endpoint in `06_API_CONTRACTS.md` is reachable and returns the documented shape, tested via `curl` or a REST client — UI does not need to exist yet.

## Phase 4 — UI

1. Build `components/pos/AppShell.tsx`, `ModeSwitcher.tsx`, and `lib/keyboard/useGlobalHotkeys.ts` first — the keyboard-first navigation is the backbone everything else hangs off of.
2. Build Warung Mode: `BarcodeInput` → `ProductGrid`/`Cart` → `CheckoutPanel`, wired to the Phase 3 endpoints.
3. Build Agent Mode: `ServiceSelector` → `TransactionForm` → `FloatBalanceWidget`, wired to the Phase 3 endpoints.
4. Build the login screen and role-gated Reports page.
5. Apply the warm dark mode palette and accent-color mode separation from `04_UI_DESIGN_SYSTEM.md` § 7 throughout.

**Checkpoint:** A full Warung sale (scan → cart → Enter → cash → change shown) and a full Agent transaction (select service → enter amount → submit) can be completed end-to-end using only the keyboard, per the Definition of Done in `00_MASTER_BRIEF.md`.

## Phase 5 — Containerization

1. Write `app/Dockerfile` exactly as specified in `05_DOCKER_DEPLOYMENT.md` § 3.
2. Write the root `docker-compose.yml` exactly as specified in `05_DOCKER_DEPLOYMENT.md` § 2, including all four `mem_limit` values.
3. Populate `.env` from `.env.example` with real generated secrets (use `openssl rand -hex 32` for `JWT_SECRET` and `QRIS_WEBHOOK_SECRET`, not weak placeholder strings).
4. `docker compose up -d --build` and confirm all four containers reach a healthy/running state.

**Checkpoint:** `docker stats` shows `pos_nextjs` RSS under 200MB during idle and under its 300MB cap under load; `docker compose ps` shows all services healthy.

## Phase 6 — Cloudflare Tunnel

1. Create the tunnel per `05_DOCKER_DEPLOYMENT.md` § 5 Option A (token-based) for the simplest path, or Option B if path-restricted ingress is desired.
2. Configure the public hostname's webhook route in the AmarthaFin/payment provider's dashboard to point at `https://<your-tunnel-hostname>/api/webhooks/qris`.
3. Send a test webhook (provider's sandbox/test mode if available, or a manually crafted signed `curl` request using the real `QRIS_WEBHOOK_SECRET`) and confirm it lands in `agent.webhook_events` and updates the corresponding `agent.transactions` row.

**Checkpoint:** An externally-originated POST to the public tunnel URL is verified, recorded, and reflected in the Agent Mode UI without any router port-forwarding configured.

## Phase 7 — n8n Workflows

1. Build all four workflows from `07_N8N_WORKFLOWS.md` in the n8n editor (`http://<nuc-ip>:5678`).
2. Configure the Telegram (or WhatsApp) credential and target chat ID.
3. Manually trigger each workflow once to confirm the message format and that the SQL queries return expected results against real data from Phases 2–6.
4. Activate the schedule triggers.

**Checkpoint:** Lowering a test product's `stock_qty` below its `reorder_threshold` triggers a Telegram message within the next scheduled run.

## Phase 8 — Final Verification Against Definition of Done

Re-read `00_MASTER_BRIEF.md` § 5 and verify every line item explicitly, on the actual NUC hardware (not a dev laptop) under realistic conditions:

- Fresh `docker compose up -d` on a clean Ubuntu 24 install, only `.env` pre-filled.
- Barcode-to-cart latency timed manually with a real scanner.
- A full day's simulated transaction mix (10+ Warung sales, 5+ Agent transactions, one intentional webhook delay) confirms ledger separation holds — query both `warung.*` and `agent.*` tables directly and confirm no cross-contamination.
- `docker stats` logged over a multi-hour idle period to confirm steady-state RAM stays well under the budget in `01_SYSTEM_ARCHITECTURE.md` § 3.
- A keyboard-only run-through of both modes by someone who has never used the app, to validate the hotkey map is actually discoverable/usable, not just technically implemented.

Once every item in the Definition of Done is independently verified, the build is complete.
