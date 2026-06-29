# 06 — API CONTRACTS

## 1. Conventions

- All responses are JSON. Success responses return the resource directly (not wrapped in `{ data: ... }`) unless it's a list, in which case `{ items: [...], total: N }`.
- Errors always return `{ error: { code: string, message: string } }` with an appropriate HTTP status.
- All routes except `auth/login`, `health`, and `webhooks/qris` require a valid session cookie (see `08_SECURITY_HARDENING.md`).
- Monetary fields are always strings in JSON (e.g. `"15000.00"`), not JS numbers, to avoid floating-point round-tripping through `JSON.parse`. The client formats them for display.

## 2. `GET /api/health`

Docker healthcheck target. No auth.

```json
// 200
{ "status": "ok", "uptime_seconds": 1234 }
```

## 3. Auth

### `POST /api/auth/login`

```json
// Request
{ "username": "budi", "pin": "1234" }

// 200
{ "user": { "id": "uuid", "username": "budi", "full_name": "Budi Santoso", "role": "cashier" } }

// 401
{ "error": { "code": "invalid_credentials", "message": "Username or PIN is incorrect." } }
```

Sets an httpOnly session cookie on success. See `08_SECURITY_HARDENING.md` for rate limiting on this endpoint specifically.

### `POST /api/auth/logout`

```json
// 200
{ "ok": true }
```

## 4. Products (Warung)

### `GET /api/products/lookup?barcode=8991002123456`

The hot-path scanner endpoint. Must hit `uq_products_barcode` directly — no fallback fuzzy matching here, that belongs in the search endpoint below.

```json
// 200
{
  "id": "uuid",
  "barcode": "8991002123456",
  "name": "Indomie Goreng",
  "sell_price": "3500.00",
  "stock_qty": "48.00",
  "unit": "pcs"
}

// 404
{ "error": { "code": "product_not_found", "message": "No product matches this barcode." } }
```

### `GET /api/products?search=indomie&limit=20`

```json
// 200
{ "items": [ { "id": "uuid", "name": "Indomie Goreng", "sell_price": "3500.00", "stock_qty": "48.00" } ], "total": 1 }
```

### `POST /api/products` (owner role only)

```json
// Request
{
  "barcode": "8991002123456",
  "name": "Indomie Goreng",
  "category": "instant_food",
  "unit": "pcs",
  "cost_price": "2800.00",
  "sell_price": "3500.00",
  "stock_qty": "100.00",
  "reorder_threshold": "10.00"
}

// 201
{ "id": "uuid", "barcode": "8991002123456", ... }

// 409
{ "error": { "code": "barcode_exists", "message": "A product with this barcode already exists." } }
```

### `PATCH /api/products/:id`, `DELETE /api/products/:id`

Standard partial update / soft-delete (`is_active = false`, never a hard delete — sale history references this row).

## 5. Sales (Warung)

### `POST /api/sales`

Executes as a single DB transaction: insert `sales`, insert `sale_items`, insert `stock_movements`, decrement `products.stock_qty`.

```json
// Request
{
  "cashier_id": "uuid",
  "items": [
    { "product_id": "uuid", "qty": "2.00", "unit_price": "3500.00" }
  ],
  "discount": "0.00",
  "payment_method": "cash",
  "payment_received": "10000.00"
}

// 201
{
  "id": "uuid",
  "transaction_code": "WRG-20260618-0042",
  "total_amount": "7000.00",
  "change_given": "3000.00",
  "created_at": "2026-06-18T10:15:00+07:00"
}

// 400
{ "error": { "code": "insufficient_stock", "message": "Indomie Goreng: only 1 in stock, 2 requested." } }

// 400
{ "error": { "code": "insufficient_payment", "message": "Payment received is less than total amount." } }
```

### `GET /api/sales/daily-summary?date=2026-06-18`

Backed by `warung.v_daily_summary`.

```json
// 200
{ "sale_date": "2026-06-18", "transaction_count": 42, "gross_revenue": "1250000.00", "gross_margin": "310000.00" }
```

## 6. Agent (AmarthaFin)

### `GET /api/agent/float-balance`

```json
// 200
{ "balance": "2450000.00", "last_updated": "2026-06-18T10:00:00+07:00" }
```

### `POST /api/agent/transactions`

```json
// Request
{
  "operator_id": "uuid",
  "service_type": "e_wallet_topup",
  "customer_phone": "0812xxxxxxx",
  "amount": "100000.00"
}

// 201
{
  "id": "uuid",
  "transaction_code": "AGT-20260618-0017",
  "status": "pending",
  "admin_fee": "1000.00",
  "agent_commission": "1500.00",
  "created_at": "2026-06-18T10:20:00+07:00"
}

// 400
{ "error": { "code": "insufficient_float", "message": "Agent float balance too low for this transaction." } }
```

### `GET /api/agent/transactions?status=pending&limit=20`

```json
{ "items": [ { "id": "uuid", "transaction_code": "AGT-20260618-0017", "status": "pending", "amount": "100000.00" } ], "total": 1 }
```

### `PATCH /api/agent/transactions/:id`

Used for manual reconciliation (owner marks a stuck `pending` transaction as `success`/`failed`/`reversed`). Every manual status change writes a `core.audit_log` row.

```json
// Request
{ "status": "success", "provider_ref_id": "REF123456" }

// 200
{ "id": "uuid", "status": "success", "settled_at": "2026-06-18T10:25:00+07:00" }
```

### `POST /api/agent/closing`

```json
// Request
{ "closing_date": "2026-06-18", "closing_float": "2450000.00", "closed_by": "uuid" }

// 201
{
  "closing_date": "2026-06-18",
  "opening_float": "2300000.00",
  "closing_float": "2450000.00",
  "total_transactions": 17,
  "total_commission": "85000.00",
  "total_admin_fee": "62000.00",
  "status": "closed"
}
```

## 7. Webhooks

### `POST /api/webhooks/qris`

No session auth — authenticated instead via HMAC signature header. See `08_SECURITY_HARDENING.md` for the full verification implementation.

```json
// Request (shape depends on provider, illustrative)
{
  "event_id": "evt_8a3f...",
  "provider_ref_id": "REF123456",
  "status": "success",
  "amount": "100000.00",
  "timestamp": "2026-06-18T10:24:50+07:00"
}

// Headers
// X-Signature: hmac-sha256 hex digest of the raw body

// 200 — always return 200 quickly once durably recorded, even if processing
// is deferred, so the provider doesn't retry-storm a slow endpoint
{ "received": true }

// 401 — signature invalid, do NOT write to webhook_events
{ "error": { "code": "invalid_signature", "message": "Signature verification failed." } }

// 200 — duplicate event_id, already processed (idempotent no-op, still 200)
{ "received": true, "duplicate": true }
```

Proceed to `07_N8N_WORKFLOWS.md`.
