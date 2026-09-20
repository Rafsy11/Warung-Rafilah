#!/usr/bin/env bash
# Run AFTER git pull --ff-only. Never deletes/recreates production database volumes.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source "$ROOT/scripts/docker-context.sh"
[[ -n "${BACKUP_MIRROR_DIR:-}" && -d "$BACKUP_MIRROR_DIR" ]] || {
  echo 'Set BACKUP_MIRROR_DIR ke folder USB/disk/perangkat terpisah yang sudah terpasang.' >&2; exit 1;
}
[[ "$(findmnt -n -o SOURCE -T "$BACKUP_MIRROR_DIR")" != "$(findmnt -n -o SOURCE -T "$ROOT")" ]] || {
  echo 'Backup mirror harus berada pada filesystem terpisah dari proyek.' >&2; exit 1;
}
COMPOSE=(docker compose -f docker-compose.yml)
if [[ -e "${CASH_DRAWER_DEVICE:-/dev/usb/lp0}" ]]; then COMPOSE+=(-f docker-compose.linux.yml); fi
docker inspect pos_postgres >/dev/null
OPEN_SHIFTS="$(docker exec -i pos_postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1' <<'SQL'
SELECT count(*) FROM warung.cashier_sessions WHERE status='open';
SQL
)"
[[ "$OPEN_SHIFTS" == 0 ]] || { echo 'Tutup semua shift sebelum upgrade agar pembayaran lama tidak salah diatribusikan.' >&2; exit 1; }
OLD_IMAGE="$(docker inspect -f '{{.Image}}' pos_nextjs)"
ROLLBACK_TAG="warung-pos-rollback:$(date +%Y%m%d%H%M%S)"
docker tag "$OLD_IMAGE" "$ROLLBACK_TAG"
echo "Image sebelum update: $ROLLBACK_TAG"
bash scripts/ensure-local-tls.sh
"${COMPOSE[@]}" build pos_nextjs
TEST_DB="pos_restore_check_$(date +%s)_$$"
STOPPED=false
cleanup() {
  local status=$?
  docker exec pos_postgres sh -c 'dropdb --if-exists -U "$POSTGRES_USER" "$1"' sh "$TEST_DB" || true
  if [[ "$status" != 0 && "$STOPPED" == true ]]; then
    echo 'Update dihentikan. Database produksi tidak di-restore otomatis. Backup dan image lama dipertahankan.' >&2
    echo "Image rollback: $ROLLBACK_TAG; backup: ${BACKUP_FILE:-belum dibuat}" >&2
    echo 'POS tetap dihentikan agar tidak menerima transaksi pada keadaan yang belum terverifikasi.' >&2
  fi
}
trap cleanup EXIT
# Stop all configured application writers for a consistent backup and migration window.
"${COMPOSE[@]}" stop pos_nextjs n8n
STOPPED=true
BACKUP_FILE="$(bash scripts/backup-db-verified.sh)"
echo "Backup: $BACKUP_FILE"
docker exec pos_postgres sh -c 'createdb -U "$POSTGRES_USER" "$1"' sh "$TEST_DB"
docker exec -i pos_postgres sh -c 'pg_restore --exit-on-error --no-owner --no-privileges -U "$POSTGRES_USER" -d "$1"' sh "$TEST_DB" < "$BACKUP_FILE"
echo 'Restore backup berhasil. Memeriksa upgrade pada database salinan...'
"${COMPOSE[@]}" run --rm --no-deps -e POSTGRES_DB="$TEST_DB" pos_nextjs node scripts/verify-upgrade.mjs
echo 'Upgrade salinan lolos. Menerapkan migrasi ke database asli...'
"${COMPOSE[@]}" run --rm --no-deps pos_nextjs node scripts/migrate.mjs
"${COMPOSE[@]}" up -d --no-deps --force-recreate pos_nextjs
ready=false
for ((i=0; i<60; i++)); do
  if curl -fsS --max-time 3 http://127.0.0.1:3000/api/health >/dev/null; then ready=true; break; fi
  sleep 2
done
[[ "$ready" == true ]] || { "${COMPOSE[@]}" stop pos_nextjs; echo 'Readiness gagal; lihat logs pos_nextjs.' >&2; exit 1; }
"${COMPOSE[@]}" up -d --no-deps n8n
"${COMPOSE[@]}" up -d --no-deps --force-recreate pos_nginx_ssl
STOPPED=false
echo 'Update selesai. Login ulang, periksa transaksi/bon/stok, dan cetak struk uji.'
echo "Simpan backup $BACKUP_FILE serta image $ROLLBACK_TAG sampai verifikasi operasional selesai."
