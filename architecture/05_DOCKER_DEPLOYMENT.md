# 05 — DOCKER DEPLOYMENT

## 1. Repository Layout for Deployment

```
/
├── docker-compose.yml
├── .env                          # NOT committed — see .env.example below
├── app/                          # Next.js project root
│   ├── Dockerfile
│   └── ... (per 03_NEXTJS_STANDARDS.md)
├── db/
│   ├── init/
│   │   └── 001_schema.sql        # exact content from 02_DATABASE_SCHEMA.md § 2
│   └── postgresql.conf
└── cloudflared/
    └── config.yml                # only needed if using credentials-file mode (see § 5)
```

## 2. `docker-compose.yml` (Complete)

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    container_name: pos_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d:ro
      - ./db/postgresql.conf:/etc/postgresql/postgresql.conf:ro
    command: ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]
    mem_limit: 1500m
    mem_reservation: 512m
    cpus: 1.5
    networks:
      - pos_internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  nextjs:
    build:
      context: ./app
      dockerfile: Dockerfile
    container_name: pos_nextjs
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      NODE_OPTIONS: "--max-old-space-size=180"
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      JWT_SECRET: ${JWT_SECRET}
      QRIS_WEBHOOK_SECRET: ${QRIS_WEBHOOK_SECRET}
      PORT: 3000
      TZ: Asia/Jakarta
    mem_limit: 300m
    mem_reservation: 150m
    cpus: 1.0
    ports:
      - "127.0.0.1:3000:3000"
    networks:
      - pos_internal
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/health"]
      interval: 15s
      timeout: 5s
      retries: 3

  n8n:
    image: n8nio/n8n:latest
    container_name: pos_n8n
    restart: unless-stopped
    environment:
      N8N_HOST: localhost
      N8N_PORT: 5678
      N8N_PROTOCOL: http
      GENERIC_TIMEZONE: Asia/Jakarta
      N8N_BASIC_AUTH_ACTIVE: "true"
      N8N_BASIC_AUTH_USER: ${N8N_USER}
      N8N_BASIC_AUTH_PASSWORD: ${N8N_PASSWORD}
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: postgres
      DB_POSTGRESDB_DATABASE: ${POSTGRES_DB}
      DB_POSTGRESDB_USER: ${POSTGRES_USER}
      DB_POSTGRESDB_PASSWORD: ${POSTGRES_PASSWORD}
      DB_POSTGRESDB_SCHEMA: n8n
    volumes:
      - n8n_data:/home/node/.n8n
    mem_limit: 600m
    mem_reservation: 250m
    cpus: 1.0
    ports:
      - "127.0.0.1:5678:5678"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - pos_internal

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: pos_cloudflared
    restart: unless-stopped
    command: tunnel run
    environment:
      TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN}
    mem_limit: 96m
    mem_reservation: 32m
    cpus: 0.3
    depends_on:
      - nextjs
    networks:
      - pos_internal

networks:
  pos_internal:
    driver: bridge

volumes:
  pgdata:
  n8n_data:
```

**RAM math check:** `1500 + 300 + 600 + 96 = 2496MB` of hard ceilings, on an 8GB host. Even if every container simultaneously hit its cap (which it won't in normal operation — these are safety ceilings, not targets), there is roughly 5.5GB left for the OS, disk cache, and burst headroom. This is intentional over-provisioning of headroom, not a tight fit.

## 3. `app/Dockerfile` (Next.js Standalone Multi-Stage Build)

```dockerfile
# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
```

This relies on `output: 'standalone'` from `03_NEXTJS_STANDARDS.md` — the standalone build traces only the dependencies actually imported at runtime into `.next/standalone`, which is what keeps the final image (and therefore the running process's working set) small. Without `output: 'standalone'`, the runner stage would need the full `node_modules`, defeating the RAM budget entirely.

## 4. `db/postgresql.conf` (Tuned for 1.5GB Container Limit, NVMe Storage)

```ini
listen_addresses = '*'
max_connections = 40

# Memory — sized for the 1.5GB mem_limit on this container, leaving
# room for OS/Postgres overhead outside shared_buffers.
shared_buffers = 384MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# WAL
wal_buffers = 16MB
checkpoint_completion_target = 0.9
min_wal_size = 80MB
max_wal_size = 1GB

# NVMe SSD — random I/O is nearly as cheap as sequential, tell the
# planner so it favors index scans appropriately.
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging — keep light for a 256GB disk running 24/7
log_min_duration_statement = 500
logging_collector = off
```

## 5. Cloudflare Tunnel — Two Setup Options

**Option A — Token-based (recommended, used by the compose file above):** create the tunnel and its public hostname route once via the Cloudflare Zero Trust dashboard or `cloudflared login` + `cloudflared tunnel create`, then copy the generated tunnel token into `CLOUDFLARE_TUNNEL_TOKEN` in `.env`. No config file needed — the token carries the routing config.

**Option B — Config-file based (if you need multiple ingress rules managed as code):**

```yaml
# cloudflared/config.yml
tunnel: <TUNNEL_ID>
credentials-file: /etc/cloudflared/creds.json

ingress:
  - hostname: pos-yourwarung.yourdomain.com
    path: /api/webhooks/*
    service: http://nextjs:3000
  - hostname: pos-yourwarung.yourdomain.com
    service: http_status:404   # everything else on this hostname is rejected —
                                 # only the webhook path is intentionally public
  - service: http_status:404
```

If using Option B, mount it into the `cloudflared` service and change `command` to `tunnel --config /etc/cloudflared/config.yml run`. **Option A is the default** for this project because it requires zero extra volume mounts and keeps the deployment footprint minimal — but Option B is the better choice if you want the public surface restricted to exactly the `/api/webhooks/*` path at the tunnel level (defense in depth alongside the application-level HMAC check in `08_SECURITY_HARDENING.md`).

## 6. `.env.example` (Compose-Level Secrets)

```bash
# --- Postgres ---
POSTGRES_USER=pos_admin
POSTGRES_PASSWORD=change_this_strong_password
POSTGRES_DB=pos_production

# --- n8n ---
N8N_USER=admin
N8N_PASSWORD=change_this_strong_password

# --- Cloudflare ---
CLOUDFLARE_TUNNEL_TOKEN=your_tunnel_token_here

# --- App secrets (mirrored into the nextjs container) ---
JWT_SECRET=change_this_jwt_secret
QRIS_WEBHOOK_SECRET=change_this_hmac_secret
```

Note in `db/init`: since n8n is configured with `DB_POSTGRESDB_SCHEMA: n8n`, add `CREATE SCHEMA IF NOT EXISTS n8n;` to the init SQL (already present in `02_DATABASE_SCHEMA.md` § 2) so n8n's first boot doesn't fail trying to create it without privileges.

## 7. Operational Commands

```bash
# Bring the full stack up
docker compose up -d

# Watch live resource usage against the mem_limits above
docker stats

# Tail Next.js logs
docker compose logs -f nextjs

# Apply a schema change after editing db/init (only affects fresh volumes —
# for an existing volume, run the new SQL manually via psql)
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB

# Full restart after a code change to the Next.js app
docker compose up -d --build nextjs
```

Proceed to `06_API_CONTRACTS.md`.
