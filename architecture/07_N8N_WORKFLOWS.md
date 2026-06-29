# 07 — N8N AUTOMATION WORKFLOWS

## 1. Connection Setup

n8n connects to the same Postgres instance as the main app, via a **Postgres credential** scoped to read access on `warung.*` and `agent.*` plus write access only to its own `n8n` schema for internal state. Create this credential once in the n8n UI (`http://<nuc-ip>:5678`, reachable only on the LAN) pointing at `postgres:5432` using the `POSTGRES_USER`/`POSTGRES_PASSWORD` from `.env`.

For outbound alerts, this spec assumes a WhatsApp Business API or Telegram Bot — pick one per the owner's preference; both are supported by n8n's built-in nodes. Telegram is simpler to set up (no business verification needed) and is used in the examples below; swap the final node for the WhatsApp node if preferred.

## 2. Workflow 1 — Low Stock Alert

**Trigger:** Schedule node, every 2 hours during store operating hours (e.g. `0 8-22/2 * * *`).

**Node sequence:**
1. **Schedule Trigger** — cron as above.
2. **Postgres Query:**
   ```sql
   SELECT name, stock_qty, reorder_threshold
   FROM warung.products
   WHERE is_active = true AND stock_qty <= reorder_threshold
   ORDER BY stock_qty ASC;
   ```
3. **IF node** — branch on `{{$json.length > 0}}` (using a Function/Code node beforehand to check result count). If empty, end silently — don't send a "nothing to report" message every 2 hours.
4. **Function node** — format the list into a single readable message:
   ```js
   const lines = items.map(i => `• ${i.name}: ${i.stock_qty} left (reorder at ${i.reorder_threshold})`);
   return [{ json: { message: `⚠️ Low Stock Alert\n\n${lines.join('\n')}` } }];
   ```
5. **Telegram node** — Send Message, chat ID = owner's configured chat, text = `{{$json.message}}`.

## 3. Workflow 2 — Agent Float Low-Balance Alert

**Trigger:** Schedule node, every 30 minutes.

**Node sequence:**
1. **Schedule Trigger.**
2. **Postgres Query:**
   ```sql
   SELECT balance_after, created_at
   FROM agent.float_ledger
   ORDER BY created_at DESC
   LIMIT 1;
   ```
3. **IF node** — `{{$json.balance_after < 200000}}` (threshold configurable per store; suggest starting at roughly 2x the store's typical single largest agent transaction).
4. **Telegram node** — `⚠️ AmarthaFin float balance is low: Rp{{$json.balance_after}}. Consider topping up before the next large withdrawal request.`

This workflow exists specifically because running out of agent float mid-transaction is an operator-facing failure mode (a customer is standing at the counter waiting for a withdrawal that can't complete) — catching it 30 minutes ahead of time via a scheduled check is far better than discovering it at the point of failure.

## 4. Workflow 3 — Daily Closing Reminder + Report

**Trigger:** Schedule node, once daily at store closing time (e.g. `0 21 * * *`, adjust to actual hours).

**Node sequence:**
1. **Schedule Trigger.**
2. **Postgres Query (parallel branch A — Warung):**
   ```sql
   SELECT * FROM warung.v_daily_summary WHERE sale_date = CURRENT_DATE;
   ```
3. **Postgres Query (parallel branch B — Agent):**
   ```sql
   SELECT
     SUM(transaction_count) AS total_tx,
     SUM(commission_earned) AS total_commission
   FROM agent.v_daily_summary WHERE tx_date = CURRENT_DATE;
   ```
4. **Merge node** — combine both branches.
5. **Function node** — format as two clearly separated sections (never blended into one total, per the Ledger Separation Principle in `01_SYSTEM_ARCHITECTURE.md`):
   ```js
   const msg =
     `📊 Daily Closing — ${new Date().toLocaleDateString('id-ID')}\n\n` +
     `🏪 Warung\n` +
     `Transactions: ${warung.transaction_count}\n` +
     `Revenue: Rp${warung.gross_revenue}\n` +
     `Margin: Rp${warung.gross_margin}\n\n` +
     `💳 AmarthaFin Agent\n` +
     `Transactions: ${agent.total_tx}\n` +
     `Commission Earned: Rp${agent.total_commission}\n\n` +
     `Reminder: please complete the Agent Mode daily closing in the POS app to lock in tonight's float balance.`;
   return [{ json: { message: msg } }];
   ```
6. **Telegram node** — send to owner.

This workflow is a **reminder and summary**, not the closing action itself — the actual `agent.daily_closing` row is written by the owner confirming the count in the app (`POST /api/agent/closing`), since that requires a physical cash/float count a script can't perform.

## 5. Workflow 4 — Stuck Pending Transaction Monitor

**Trigger:** Schedule node, every 15 minutes.

**Node sequence:**
1. **Schedule Trigger.**
2. **Postgres Query:**
   ```sql
   SELECT transaction_code, service_type, amount, created_at
   FROM agent.transactions
   WHERE status = 'pending' AND created_at < now() - interval '20 minutes';
   ```
3. **IF node** — branch on result count > 0.
4. **Telegram node** — `⏳ {{$json.length}} agent transaction(s) have been pending for over 20 minutes. Please check Agent Mode > Recent Transactions for manual reconciliation.`

This catches the case where a QRIS webhook silently never arrives (network blip, provider-side issue) so the transaction doesn't sit in limbo indefinitely without anyone noticing.

## 6. Resource Note

All four workflows are lightweight scheduled queries — none of them hold the n8n process busy for more than a second or two per run. The `mem_limit: 600m` allocated to the n8n container in `05_DOCKER_DEPLOYMENT.md` comfortably covers this workload; it is not running any CPU- or memory-intensive transformation, just querying, formatting strings, and making outbound HTTP calls to the messaging API.

Proceed to `08_SECURITY_HARDENING.md`.
