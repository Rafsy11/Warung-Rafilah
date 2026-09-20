#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/docker-context.sh"
umask 077
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/pos_backup_$(date +%Y%m%d_%H%M%S)_$$.dump"
trap 'rm -f -- "${FILE}.partial"' EXIT
docker exec pos_postgres sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "${FILE}.partial"
test -s "${FILE}.partial"
docker exec -i pos_postgres pg_restore --list < "${FILE}.partial" >/dev/null
mv -- "${FILE}.partial" "$FILE"
sha256sum "$FILE" > "${FILE}.sha256"
if [[ -n "${BACKUP_MIRROR_DIR:-}" ]]; then
  test -d "$BACKUP_MIRROR_DIR" || { echo 'Mirror backup tidak tersedia.' >&2; exit 1; }
  cp -- "$FILE" "$BACKUP_MIRROR_DIR/$(basename "$FILE").partial"
  cmp -- "$FILE" "$BACKUP_MIRROR_DIR/$(basename "$FILE").partial"
  mv -- "$BACKUP_MIRROR_DIR/$(basename "$FILE").partial" "$BACKUP_MIRROR_DIR/$(basename "$FILE")"
else
  echo 'PERINGATAN: backup masih hanya di PC ini; belum ada salinan terpisah.' >&2
fi
# Retention must never delete the last known-restorable backup automatically.
echo "$FILE"
