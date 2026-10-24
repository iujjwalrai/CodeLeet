#!/usr/bin/env bash
#
# deploy/deploy.sh <tag>
#
# Runs on the server, from the app folder (where .env lives). Called over SSH
# by .github/workflows/deploy.yml after it has copied the compose files and
# this folder from the commit being deployed. <tag> is the 7-character commit
# SHA the images were published under (see publish.yml).
#
# Which compose files to use comes from COMPOSE_FILE in .env, so a server can
# add its own override without changing this script.

set -euo pipefail

TAG="${1:?usage: deploy.sh <7-char image tag>}"
[[ "$TAG" =~ ^[0-9a-f]{7}$ ]] || { echo "Not an image tag: $TAG" >&2; exit 1; }

cd "$(dirname "$0")/.."
[[ -f .env ]] || { echo "No .env in $PWD; create it from .env.prod.example" >&2; exit 1; }

# Pin the tag in .env, so later manual `docker compose` commands keep using
# the deployed version
if grep -q '^TAG=' .env; then
  # -i.bak works with both GNU and BSD sed
  sed -i.bak "s/^TAG=.*/TAG=${TAG}/" .env && rm -f .env.bak
else
  echo "TAG=${TAG}" >> .env
fi

echo "==> Pulling images for ${TAG}"
docker compose pull --quiet
# Sandboxes are only started by the workers, so pull them explicitly
docker compose --profile sandbox pull --quiet

echo "==> Starting containers"
docker compose up -d --remove-orphans

echo "==> Waiting for the API to be ready"
for _ in $(seq 1 40); do
  if docker compose exec -T api wget -qO- http://127.0.0.1:5000/api/ready >/dev/null 2>&1; then
    echo "API is ready"
    break
  fi
  sleep 3
done
if ! docker compose exec -T api wget -qO- http://127.0.0.1:5000/api/ready >/dev/null 2>&1; then
  echo "API did not become ready" >&2
  docker compose ps >&2
  docker compose logs --tail 50 api >&2
  exit 1
fi

# Free the disk: remove other tags of our images. Not `docker image prune -a`,
# which would also delete the sandbox images (no container uses them between jobs).
registry="$(grep '^REGISTRY=' .env | cut -d= -f2-)"
registry="${registry:-ghcr.io/iujjwalrai}"
old="$(docker images --format '{{.Repository}}:{{.Tag}}' \
  | grep "^${registry}/codeleet-" | grep -v -e ":${TAG}\$" -e ':latest$' || true)"
if [[ -n "$old" ]]; then
  echo "==> Removing old images"
  echo "$old" | xargs docker rmi >/dev/null 2>&1 || true
fi
docker image prune -f >/dev/null

docker compose ps
echo "==> Deployed ${TAG}"
