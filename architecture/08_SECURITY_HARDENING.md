# 08 — SECURITY HARDENING

## 1. PIN-Based Authentication

Cashiers and the owner authenticate with a username + short numeric PIN (fast to enter at a counter, no keyboard typing of long passwords mid-shift). The PIN is never stored in plaintext.

```ts
// lib/auth.ts
import bcrypt from 'bcryptjs';

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 12);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}
```

**Login rate limiting** — apply an in-memory sliding window per username + IP combination (sufficient at single-till scale; no need for a distributed rate limiter here):

```ts
// app/api/auth/login/route.ts (excerpt)
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + 5 * 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 5; // 5 attempts per 5-minute window
}
```

After a successful login, issue an httpOnly, `SameSite=Strict`, `Secure` (in production) session cookie containing a signed JWT (`JWT_SECRET` from `.env`) with the user's `id` and `role`. Role-gated routes (e.g. `POST /api/products`, `/pos/reports`) check this server-side on every request — never trust a client-side role check alone.

## 2. Webhook Signature Verification (QRIS Inbound)

This is the only endpoint in the system reachable from the public internet (via the Cloudflare Tunnel), so it gets the most scrutiny.

```ts
// lib/webhook-verify.ts
import crypto from 'crypto';

export function verifyQrisSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac('sha256', process.env.QRIS_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');

  // Constant-time comparison — prevents timing attacks revealing the
  // correct signature byte-by-byte.
  const expectedBuf = Buffer.from(expected);
  const givenBuf = Buffer.from(signatureHeader);

  if (expectedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, givenBuf);
}
```

```ts
// app/api/webhooks/qris/route.ts (excerpt)
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-signature');

  if (!verifyQrisSignature(rawBody, signature)) {
    return Response.json(
      { error: { code: 'invalid_signature', message: 'Signature verification failed.' } },
      { status: 401 }
    );
  }

  const payload = JSON.parse(rawBody);

  // Idempotency: unique constraint on event_id does the heavy lifting —
  // a duplicate insert attempt is caught and treated as a no-op, not an error.
  const inserted = await insertWebhookEventIfNew(payload);
  if (!inserted) {
    return Response.json({ received: true, duplicate: true });
  }

  await processQrisEvent(payload); // updates agent.transactions + agent.float_ledger

  return Response.json({ received: true });
}
```

Three layers of defense on this single public endpoint: (1) the Cloudflare Tunnel ingress rule restricts the public hostname to only this path, per `05_DOCKER_DEPLOYMENT.md` § 5 Option B, (2) the HMAC signature check above rejects anything not signed with the shared secret, (3) the `event_id` unique constraint in `agent.webhook_events` makes processing idempotent even if a valid, correctly-signed event is replayed or retried by the provider.

## 3. Secrets Management

| Secret | Where it lives | Never |
|---|---|---|
| `POSTGRES_PASSWORD` | `.env`, injected into both `postgres` and `nextjs` containers | Committed to git, logged, shown in error messages |
| `JWT_SECRET` | `.env` → `nextjs` container | Hardcoded in source, reused across environments |
| `QRIS_WEBHOOK_SECRET` | `.env` → `nextjs` container, shared with the AmarthaFin/payment provider's webhook config | Logged in plaintext (log only the `event_id`, never the raw signature or secret) |
| `CLOUDFLARE_TUNNEL_TOKEN` | `.env` → `cloudflared` container | Committed to git |
| `N8N_BASIC_AUTH_PASSWORD` | `.env` → `n8n` container | Reused as any other system's password |

`.env` is listed in `.gitignore` from the very first commit. `.env.example` (committed, no real values) documents every required key — see `03_NEXTJS_STANDARDS.md` § 6 and `05_DOCKER_DEPLOYMENT.md` § 6 for the two example files.

## 4. CORS

The Next.js app is the only consumer of its own API routes (no third-party frontend calls it), so CORS should be **restrictive by default** — no `Access-Control-Allow-Origin: *` anywhere. If a route needs to be called from a separate kiosk-mode browser on the LAN, restrict to that specific origin explicitly rather than wildcarding:

```ts
// Only set CORS headers on routes that genuinely need cross-origin access
// (in this architecture, that should be none — the UI and API are same-origin).
```

## 5. Network-Level Hardening (Host OS)

Beyond the application layer, the NUC itself should have:

- SSH access restricted to key-based auth only (`PasswordAuthentication no` in `/etc/ssh/sshd_config`), and ideally bound to the LAN interface or behind a VPN/Cloudflare Access, not exposed to the internet.
- `ufw` enabled with default-deny inbound, allowing only LAN-range SSH and nothing else — Docker's published ports are already bound to `127.0.0.1` per `05_DOCKER_DEPLOYMENT.md`, so the only real inbound surface is SSH and whatever `cloudflared` tunnels out (which is an outbound-initiated connection, not an open inbound port).
- Automatic security updates (`unattended-upgrades`) enabled, since this machine runs unattended 24/7 with no IT staff checking in regularly.

## 6. Audit Logging

Every state-changing action that isn't a routine sale (role changes, manual transaction status overrides, product price edits, daily closing) writes a row to `core.audit_log` with the acting `user_id`, the action name, and a JSONB snapshot of what changed. This is what lets the owner answer "who marked this stuck transaction as failed, and when" months later without guessing.

Proceed to `09_AGENT_EXECUTION_PLAN.md`.
