#!/bin/bash
# Database backup script for OFAI production
# Usage: ./scripts/backup-db.sh
# Requires: pg_dump, DATABASE_URL env var or .env file
#
# Outputs: backups/ofai_YYYY-MM-DD_HHMMSS.sql.gz

set -euo pipefail

# Load .env if exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set. Set it in .env or as environment variable."
  exit 1
fi

BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
FILENAME="${BACKUP_DIR}/ofai_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "Starting backup..."
pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip > "$FILENAME"

SIZE=$(du -h "$FILENAME" | cut -f1)
echo "Backup complete: $FILENAME ($SIZE)"

# Keep only last 10 backups
ls -t "$BACKUP_DIR"/ofai_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm
echo "Old backups cleaned (keeping last 10)"
