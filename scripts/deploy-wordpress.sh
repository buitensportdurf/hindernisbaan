#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f ".env.deploy.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.deploy.local"
  set +a
fi

: "${DEPLOY_HOST:?Set DEPLOY_HOST in your shell or .env.deploy.local}"
: "${DEPLOY_USER:?Set DEPLOY_USER in your shell or .env.deploy.local}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH in your shell or .env.deploy.local}"

DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_BUILD_CMD="${DEPLOY_BUILD_CMD:-npm run build:wp}"
DEPLOY_RSYNC_FLAGS="${DEPLOY_RSYNC_FLAGS:---delete}"

echo "Building app ..."
eval "$DEPLOY_BUILD_CMD"

if [[ ! -d "build" ]]; then
  echo "Expected build/ to exist after build."
  exit 1
fi

# DEPLOY_PATH uses DirectAdmin's convention (/domains/... = relative to the
# account home); strip the leading slash so SSH resolves it from ~.
REMOTE_PATH="${DEPLOY_PATH#/}"
TARGET="${DEPLOY_TARGET:-$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_PATH}"

echo "Ensuring remote directory exists ..."
ssh -p "$DEPLOY_PORT" "${DEPLOY_USER}@${DEPLOY_HOST}" "mkdir -p '$REMOTE_PATH'"

echo "Syncing build/ to ${TARGET} via rsync/SSH ..."
# shellcheck disable=SC2086
rsync -avz $DEPLOY_RSYNC_FLAGS -e "ssh -p $DEPLOY_PORT" build/ "$TARGET/"

echo "Deploy complete."
