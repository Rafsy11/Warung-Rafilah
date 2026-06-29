# 03 — NEXT.JS STANDARDS

## 1. `next.config.js` (Exact Content — Do Not Modify Without Reason)

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // CRITICAL: standalone output is what keeps the Docker image and runtime
  // memory footprint small. This bundles only the production dependency
  // tree the server actually needs into .next/standalone.
  output: 'standalone',

  // Disable source maps in production to save build-time memory and disk —
  // not needed on a deployment target with no public debugging.
  productionBrowserSourceMaps: false,

  // Keep the image optimizer lightweight; this app has no remote images.
  images: {
    unoptimized: true,
  },

  reactStrictMode: true,

  experimental: {
    // Reduces memory used by the dev/build server's module graph cache.
    optimizePackageImports: ['lucide-react'],
  },

  // Strip the X-Powered-By header — minor hardening, zero cost.
  poweredByHeader: false,
};

module.exports = nextConfig;
```

## 2. Folder Structure

```
app/
  layout.tsx                      # Root layout — warm dark mode shell, global keydown listener mount
  page.tsx                        # Redirects to /pos (last-used mode) or /login
  globals.css                     # Tailwind directives + CSS variables (see 04_UI_DESIGN_SYSTEM.md)

  login/
    page.tsx                      # PIN-pad login screen

  pos/
    layout.tsx                    # AppShell: header, mode indicator, ModeSwitcher (F1/F2 listener)
    warung/
      page.tsx                    # Warung Mode: ProductGrid + BarcodeInput + Cart + CheckoutPanel
    agent/
      page.tsx                    # Agent Mode: ServiceSelector + TransactionForm + FloatBalanceWidget
    reports/
      page.tsx                    # Owner-only: separate Warung vs Agent daily summaries

  api/
    health/route.ts               # GET — Docker healthcheck target
    auth/
      login/route.ts              # POST — PIN verification, issues session cookie
      logout/route.ts             # POST
    products/
      route.ts                    # GET (list/search), POST (create)
      lookup/route.ts             # GET ?barcode= — hot path, must be fast
      [id]/route.ts                # PATCH, DELETE
    sales/
      route.ts                    # POST — create sale (transactional)
      daily-summary/route.ts      # GET — warung.v_daily_summary
    agent/
      transactions/route.ts        # GET (list), POST (create)
      transactions/[id]/route.ts   # GET, PATCH (status updates)
      float-balance/route.ts       # GET — latest agent.float_ledger.balance_after
      closing/route.ts             # POST — agent.daily_closing
    webhooks/
      qris/route.ts                 # POST — inbound payment confirmation (see 08_SECURITY_HARDENING.md)

components/
  pos/
    AppShell.tsx
    ModeSwitcher.tsx
    BarcodeInput.tsx               # Hidden/auto-focus input, scanner target
    ProductGrid.tsx
    Cart.tsx
    CheckoutPanel.tsx
    ServiceSelector.tsx
    TransactionForm.tsx
    FloatBalanceWidget.tsx
  ui/
    Button.tsx
    NumPad.tsx
    Modal.tsx
    Toast.tsx

lib/
  db.ts                            # pg Pool singleton (see 02_DATABASE_SCHEMA.md § 3)
  auth.ts                          # Session/cookie helpers, PIN hashing (bcrypt)
  webhook-verify.ts                # HMAC signature verification
  keyboard/
    useGlobalHotkeys.ts            # F1/F2/Enter/Esc handling, input-focus-aware

types/
  index.ts                         # Shared TS types: Product, Sale, AgentTransaction, etc.
```

## 3. Server vs. Client Components

- **Default to Server Components.** Pages that render lists (product grid, reports, transaction history) fetch directly from `lib/db.ts` in the Server Component — no client-side data fetching library needed.
- **Client Components are reserved for:** the barcode input listener, the cart (needs local interactive state), the keyboard hotkey hook, and any form with live validation (checkout, transaction entry).
- Route Handlers (`app/api/**/route.ts`) are the only place SQL is executed from request context — never call `lib/db.ts` directly from a Client Component.

## 4. Route Segment Config

POS pages that must always reflect live stock/float state should opt out of static rendering:

```ts
// app/pos/warung/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;
```

Reports pages can use a short revalidate window instead, since they're not safety-critical to be millisecond-fresh:

```ts
// app/pos/reports/page.tsx
export const revalidate = 30; // seconds
```

## 5. Memory-Conscious Runtime Settings

The Node process itself is capped via `NODE_OPTIONS` in the Dockerfile/compose (see `05_DOCKER_DEPLOYMENT.md`), but enforce these conventions in code too:

- Never load the entire `warung.sales` or `agent.transactions` history into memory for a report — always aggregate in SQL (the views in `02_DATABASE_SCHEMA.md`) and paginate any raw transaction list with `LIMIT`/`OFFSET` or keyset pagination.
- The product catalog for a small warung (hundreds to low thousands of SKUs) is small enough to fetch in full for the ProductGrid, but the barcode lookup must always go through the indexed `GET /api/products/lookup` endpoint, never a full-table client-side filter.

## 6. Environment Variables (`.env.example`)

```bash
# --- Database ---
DATABASE_URL=postgres://pos_admin:change_this_strong_password@postgres:5432/pos_production

# --- Auth ---
JWT_SECRET=change_this_jwt_secret
SESSION_COOKIE_NAME=pos_session

# --- Webhooks ---
QRIS_WEBHOOK_SECRET=change_this_hmac_secret

# --- App ---
NODE_ENV=production
PORT=3000
TZ=Asia/Jakarta
```

## 7. `package.json` Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "NODE_OPTIONS='--max-old-space-size=180' node .next/standalone/server.js",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  }
}
```

Note: when run via Docker (the production path), the container's `CMD` invokes `server.js` directly with `NODE_OPTIONS` set as an environment variable in `docker-compose.yml` rather than through this npm script — see `05_DOCKER_DEPLOYMENT.md`. The script above is for local parity testing on a dev machine.

## 8. Dependency Policy

Keep `node_modules` lean — every dependency added is RAM and disk cost on a 256GB/8GB box.

| Allowed | Avoid |
|---|---|
| `pg` (raw driver) or `drizzle-orm` (thin SQL builder) | Full Prisma client with query engine binary |
| `bcryptjs` | `argon2` (native bindings add build complexity for marginal gain at this scale) |
| `lucide-react` (icons, tree-shakeable) | Large icon font libraries |
| `zod` (request validation) | Heavy form libraries (React Hook Form is fine if actually needed, but prefer plain controlled inputs for the simple POS forms) |
| Native `fetch`/`Response` in Route Handlers | Axios or other HTTP client wrappers (unnecessary in Next.js Route Handlers) |

Proceed to `04_UI_DESIGN_SYSTEM.md`.
