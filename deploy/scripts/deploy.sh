#!/usr/bin/env bash
# Deploys the grocery list on the homelab. The GitHub Actions runner calls it
# from the repo checkout; by hand: IMAGE_TAG=<commit sha> bash deploy/scripts/deploy.sh
#
# Copies deploy/ into DEPLOY_DIR (where the .env lives), pulls the image,
# starts everything and waits until it is healthy. On success it records the
# deployed IMAGE_TAG in the .env, so a plain `docker compose up -d` and the
# backup/restore scripts keep using the image already on the machine (the
# registry is private; only this deploy, logged in by GitHub Actions, can pull).
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="${DEPLOY_DIR:-$HOME/homelab/grocery}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-180}"
if [[ -z "${IMAGE_TAG:-}" ]]; then
  echo "Set IMAGE_TAG to the commit sha to deploy (the Deploy workflow does this)." >&2
  exit 1
fi
export IMAGE_TAG

log() { printf '\n==> %s\n' "$*"; }

if [[ ! -f "$DEPLOY_DIR/.env" ]]; then
  echo "Missing $DEPLOY_DIR/.env - create it from deploy/.env.example (see deploy/README.md)." >&2
  exit 1
fi

# The app refuses to start without access control: check it here, before touching the running version
env_value() { sed -n "s/^$1=//p" "$DEPLOY_DIR/.env" | tail -1 | tr -d '"'"'"' '; }
if [[ -z "$(env_value GROCERY_TOKEN)" && ( -z "$(env_value CF_ACCESS_TEAM_DOMAIN)" || -z "$(env_value CF_ACCESS_AUD)" ) ]]; then
  echo "No access control in $DEPLOY_DIR/.env: set CF_ACCESS_TEAM_DOMAIN + CF_ACCESS_AUD and/or GROCERY_TOKEN (see deploy/.env.example)." >&2
  exit 1
fi
token="$(env_value GROCERY_TOKEN)"
if [[ -n "$token" && ${#token} -lt 24 ]]; then
  echo "GROCERY_TOKEN in $DEPLOY_DIR/.env is too short (24+ characters: openssl rand -hex 24)." >&2
  exit 1
fi

log "Copying deployment files to $DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR/scripts"
cp "$SRC_DIR/compose.yml" "$SRC_DIR/.env.example" "$DEPLOY_DIR/"
cp "$SRC_DIR"/scripts/*.sh "$DEPLOY_DIR/scripts/"
chmod +x "$DEPLOY_DIR"/scripts/*.sh
cd "$DEPLOY_DIR"

# Each app has its own tunnel network, shared only with cloudflared, so a
# compromised app can't reach the others. cloudflared must already be on it:
# if it weren't, this deploy would take the site offline (see deploy/README.md).
TUNNEL_NETWORK=tunnel-grocery
if ! docker network inspect "$TUNNEL_NETWORK" -f '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null | grep -q cloudflared; then
  echo "cloudflared is not on the Docker network '$TUNNEL_NETWORK'. Set it up first: 'Tunnel network' in deploy/README.md." >&2
  exit 1
fi

log "Pulling images (tag: $IMAGE_TAG)"
docker compose pull --quiet

log "Starting services"
docker compose up -d --remove-orphans

log "Waiting for the app to be healthy (max ${TIMEOUT_SECONDS}s)"
deadline=$((SECONDS + TIMEOUT_SECONDS))
until [[ "$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q grocery)")" == "healthy" ]]; do
  if (( SECONDS >= deadline )); then
    echo "Timed out waiting for the app." >&2
    docker compose ps -a >&2
    docker compose logs --no-color --tail 60 >&2
    exit 1
  fi
  sleep 3
done
docker compose exec -T grocery wget -qO- http://127.0.0.1:8790/v1/health
echo

log "Recording IMAGE_TAG=$IMAGE_TAG in .env"
sed -i '/^IMAGE_TAG=/d' .env
echo "IMAGE_TAG=$IMAGE_TAG" >> .env

docker image prune -f > /dev/null
log "Deployed: $IMAGE_TAG"
