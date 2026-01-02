#!/usr/bin/env bash
set -euo pipefail

DATE_TAG=$(date +"%Y%m%d-%H%M%S")
OUTPUT_DIR=${OUTPUT_DIR:-"./backups"}
DB_URL=${DATABASE_URL:-"postgres://postgres:postgres@localhost:5432/ringplaza"}

mkdir -p "$OUTPUT_DIR"
pg_dump --clean --if-exists --no-owner "$DB_URL" > "$OUTPUT_DIR/ringplaza-$DATE_TAG.sql"
echo "Backup written to $OUTPUT_DIR/ringplaza-$DATE_TAG.sql"
