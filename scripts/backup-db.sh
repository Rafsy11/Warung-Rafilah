#!/bin/bash
# ==============================================================================
# Automated Database Backup Script for Warung-Rafilah POS
# Features:
# - Exports full database dump using pg_dump
# - Compresses with gzip to minimize disk space
# - Keeps rolling 7-day retention (automatically purges backups older than 7 days)
# ==============================================================================

set -e

BACKUP_DIR="/home/rafi/Warung-Rafilah/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/pos_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=7

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting POS database backup..."

docker exec pos_postgres pg_dump -U "${POSTGRES_USER:-pos_admin}" -d "${POSTGRES_DB:-pos_production}" | gzip > "${BACKUP_FILE}"

FILESIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date)] Backup completed successfully: ${BACKUP_FILE} (Size: ${FILESIZE})"

echo "[$(date)] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "pos_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -exec rm -f {} \;

echo "[$(date)] All backup maintenance tasks finished."
