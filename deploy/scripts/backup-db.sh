#!/usr/bin/env bash
# Grocery list database backup, meant for cron (e.g. every night at 03:45):
#
#   45 3 * * * $HOME/homelab/grocery/scripts/backup-db.sh >> $HOME/backups/grocery/backup.log 2>&1
#
# Restore: bash scripts/restore-db.sh <file.dump>
#
# Off-site copy (optional): set BACKUP_RCLONE_REMOTE in the .env (an rclone remote, ideally of type
# "crypt" so the files are encrypted before they leave the server). Then every backup is also copied
# there, and copies older than KEEP_DAYS are removed from it too.
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-$HOME/homelab/grocery}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/grocery}"
KEEP_DAYS="${KEEP_DAYS:-30}"

mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/grocery-$(date +%Y%m%d-%H%M%S).dump"

cd "$DEPLOY_DIR"
umask 077
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$file.tmp"
mv "$file.tmp" "$file"

find "$BACKUP_DIR" -name 'grocery-*.dump' -mtime +"$KEEP_DAYS" -delete

remote="${BACKUP_RCLONE_REMOTE:-$(sed -n 's/^BACKUP_RCLONE_REMOTE=//p' .env | tail -1)}"
if [[ -n "$remote" ]]; then
  rclone copy "$file" "$remote"
  rclone delete --min-age "${KEEP_DAYS}d" --include 'grocery-*.dump' "$remote"
  echo "$(date -Is) off-site copy OK: $remote"
fi

echo "$(date -Is) backup OK: $file ($(du -h "$file" | cut -f1))"
