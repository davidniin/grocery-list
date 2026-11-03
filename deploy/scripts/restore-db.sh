#!/usr/bin/env bash
# Restores a backup made by backup-db.sh, REPLACING the current list.
#
#   cd ~/homelab/grocery && bash scripts/restore-db.sh ~/backups/grocery/grocery-YYYYMMDD-HHMMSS.dump
#
# Restores into a separate database first, so a bad file changes nothing. Only
# then it stops the app, swaps the databases (keeping the previous data as
# before_restore_<date>) and starts it again.
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-$HOME/homelab/grocery}"
dump="${1:-}"
if [[ -z "$dump" || ! -f "$dump" ]]; then
  echo "Usage: bash scripts/restore-db.sh <file.dump>" >&2
  exit 1
fi
dump="$(cd "$(dirname "$dump")" && pwd)/$(basename "$dump")"
cd "$DEPLOY_DIR"

if [[ "${YES:-}" != "1" ]]; then
  read -rp "This REPLACES the current grocery list with $(basename "$dump"). Type 'restore' to continue: " answer
  [[ "$answer" == "restore" ]] || { echo "Cancelled."; exit 1; }
fi

previous="before_restore_$(date +%Y%m%d_%H%M%S)"
docker compose up -d --pull never db > /dev/null
until docker compose exec -T db sh -c 'pg_isready -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"'; do sleep 1; done

echo "==> Restoring into a separate database first"
docker compose exec -T db sh -c '
  set -e
  psql -q -U "$POSTGRES_USER" -d postgres -c "drop database if exists \"${POSTGRES_DB}_restore\" with (force)"
  psql -q -U "$POSTGRES_USER" -d postgres -c "create database \"${POSTGRES_DB}_restore\" owner \"$POSTGRES_USER\""
'
if ! docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "${POSTGRES_DB}_restore" --no-owner --no-privileges --clean --if-exists --single-transaction --exit-on-error' < "$dump"; then
  docker compose exec -T db sh -c 'psql -q -U "$POSTGRES_USER" -d postgres -c "drop database if exists \"${POSTGRES_DB}_restore\""'
  echo "FAILED to restore $(basename "$dump"). Nothing was changed." >&2
  exit 1
fi

echo "==> Swapping it in (the previous data is kept as ${previous})"
docker compose stop grocery > /dev/null
docker compose exec -T -e PREVIOUS="$previous" db sh -c '
  set -e
  psql -q -U "$POSTGRES_USER" -d postgres -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = '"'"'$POSTGRES_DB'"'"'" > /dev/null
  psql -q -U "$POSTGRES_USER" -d postgres -c "alter database \"$POSTGRES_DB\" rename to \"$PREVIOUS\""
  psql -q -U "$POSTGRES_USER" -d postgres -c "alter database \"${POSTGRES_DB}_restore\" rename to \"$POSTGRES_DB\""
'
docker compose up -d --pull never > /dev/null
echo "  Done. To free the space later: docker compose exec db sh -c 'dropdb -U \"\$POSTGRES_USER\" $previous'"
