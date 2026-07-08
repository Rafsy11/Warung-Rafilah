#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")"

COMPOSE_FILES=(-f docker-compose.yml)
if [[ -f docker-compose.linux.yml ]]; then
  COMPOSE_FILES+=(-f docker-compose.linux.yml)
fi
COMPOSE=(docker compose "${COMPOSE_FILES[@]}")

BACKUP_DIR="${BACKUP_DIR:-$HOME/warung-rafilah-backups}"
BACKUP_FILE="${BACKUP_DIR}/pos_backup_$(date +%Y%m%d_%H%M%S).sql"

echo "==> Checking tools and running containers"
command -v docker >/dev/null
command -v git >/dev/null
docker inspect pos_postgres >/dev/null

mkdir -p "$BACKUP_DIR"

echo "==> Backing up live database to ${BACKUP_FILE}"
docker exec pos_postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges' \
  > "$BACKUP_FILE"
test -s "$BACKUP_FILE"

echo "==> Checking git working tree before pull"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: Working tree has local changes. Commit/stash them before deploying."
  git status --short
  exit 1
fi

echo "==> Pulling latest code from main"
git pull origin main

echo "==> Checking required .env values"
if [[ ! -f .env ]]; then
  echo "ERROR: .env is missing in production."
  exit 1
fi

required_env_vars=(
  POSTGRES_USER
  POSTGRES_PASSWORD
  POSTGRES_DB
  JWT_SECRET
)

for name in "${required_env_vars[@]}"; do
  if ! grep -Eq "^[[:space:]]*${name}=.+" .env; then
    echo "ERROR: ${name} is missing or empty in .env"
    exit 1
  fi
done

echo "==> Updating live admin PIN hash"
docker exec -i pos_postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' <<'SQL'
UPDATE core.users
SET pin_hash = crypt('1914110127', gen_salt('bf', 12)),
    updated_at = now()
WHERE username = 'admin';

SELECT username, role, is_active
FROM core.users
WHERE username = 'admin';
SQL

echo "==> Rebuilding and recreating Next.js service without deleting database volumes"
"${COMPOSE[@]}" build pos_nextjs
"${COMPOSE[@]}" up -d --no-deps --force-recreate pos_nextjs

PORT_BINDING="$(docker port pos_nextjs 3000/tcp || true)"
if [[ "$PORT_BINDING" != "127.0.0.1:3000" ]]; then
  echo "ERROR: unexpected pos_nextjs port binding: ${PORT_BINDING:-none}"
  exit 1
fi

echo "==> Waiting for app healthcheck"
sleep 8
curl -fsS http://127.0.0.1:3000/api/health
echo

echo "==> Deployment update complete"
echo "Backup file: ${BACKUP_FILE}"
