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

DEPLOY_METHOD="${DEPLOY_METHOD:-da-api}"
DEPLOY_PORT="${DEPLOY_PORT:-}"
DEPLOY_BUILD_CMD="${DEPLOY_BUILD_CMD:-npm run build:wp}"
DEPLOY_RSYNC_FLAGS="${DEPLOY_RSYNC_FLAGS:---delete}"
DEPLOY_FTP_SSL="${DEPLOY_FTP_SSL:-true}"

echo "Building app ..."
eval "$DEPLOY_BUILD_CMD"

if [[ ! -d "build" ]]; then
  echo "Expected build/ to exist after build."
  exit 1
fi

deploy_ssh() {
  local port="${DEPLOY_PORT:-22}"
  local target="${DEPLOY_TARGET:-$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH}"

  echo "Ensuring remote directory exists ..."
  ssh -p "$port" "${DEPLOY_USER}@${DEPLOY_HOST}" "mkdir -p '$DEPLOY_PATH'"

  echo "Syncing build/ to ${target} via rsync/SSH ..."
  # shellcheck disable=SC2086
  rsync -avz $DEPLOY_RSYNC_FLAGS -e "ssh -p $port" build/ "$target/"
}

deploy_ftp() {
  if ! command -v lftp >/dev/null 2>&1; then
    echo "lftp is required for FTP deploys. Install with: brew install lftp"
    exit 1
  fi

  : "${DEPLOY_PASSWORD:?Set DEPLOY_PASSWORD in .env.deploy.local for FTP}"

  local port="${DEPLOY_PORT:-21}"
  local ssl_cmds=""

  if [[ "$DEPLOY_FTP_SSL" == "true" ]]; then
    ssl_cmds='set ftp:ssl-force true; set ftp:ssl-protect-data true; set ssl:verify-certificate no;'
  fi

  echo "Syncing build/ to ftp://${DEPLOY_HOST}:${port}${DEPLOY_PATH} via lftp ..."
  # shellcheck disable=SC2086
  lftp -u "$DEPLOY_USER","$DEPLOY_PASSWORD" -p "$port" "$DEPLOY_HOST" -e "
    $ssl_cmds
    set ftp:passive-mode true;
    mkdir -p $DEPLOY_PATH;
    cd $DEPLOY_PATH;
    mirror -R --delete --verbose build/ .;
    bye
  "
}

deploy_da_api() {
  : "${DEPLOY_DA_URL:?Set DEPLOY_DA_URL (e.g. https://s172.webhostingserver.nl:2222) in .env.deploy.local}"
  : "${DEPLOY_DA_LOGIN_KEY:?Set DEPLOY_DA_LOGIN_KEY (DirectAdmin login key) in .env.deploy.local}"

  if ! command -v zip >/dev/null 2>&1; then
    echo "zip is required for DirectAdmin API deploys."
    exit 1
  fi

  local parent name zipfile response
  parent="$(dirname "$DEPLOY_PATH")"
  name="$(basename "$DEPLOY_PATH")"
  zipfile="$(mktemp -d)/deploy.zip"

  echo "Zipping build/ ..."
  (cd build && zip -qr "$zipfile" .)

  da() {
    curl -sS --fail-with-body -u "$DEPLOY_USER:$DEPLOY_DA_LOGIN_KEY" "$@"
  }

  # DA returns HTTP 200 with an HTML error page on failure; detect via error markers.
  da_check() {
    if printf '%s' "$response" | grep -qiE 'error=1|"error":1|<title>[^<]*Error'; then
      printf '%s\n' "$response" | head -40
      echo "DirectAdmin API reported an error (see output above)."
      exit 1
    fi
  }

  echo "Ensuring remote directory $DEPLOY_PATH exists ..."
  response="$(da -X POST "$DEPLOY_DA_URL/CMD_FILE_MANAGER" \
    --data-urlencode "action=folder" \
    --data-urlencode "path=$parent" \
    --data-urlencode "name=$name" || true)"
  # An "already exists" error is fine here; anything else surfaces on upload.

  echo "Uploading build zip via DirectAdmin API ..."
  response="$(da -X POST "$DEPLOY_DA_URL/CMD_FILE_MANAGER" \
    -F "action=upload" \
    -F "path=$DEPLOY_PATH" \
    -F "file1=@$zipfile;filename=deploy.zip")"
  da_check

  echo "Extracting on server ..."
  response="$(da -X POST "$DEPLOY_DA_URL/CMD_FILE_MANAGER" \
    --data-urlencode "action=extract" \
    --data-urlencode "page=2" \
    --data-urlencode "path=$DEPLOY_PATH/deploy.zip" \
    --data-urlencode "directory=$DEPLOY_PATH")"
  da_check

  echo "Removing uploaded zip ..."
  response="$(da -X POST "$DEPLOY_DA_URL/CMD_FILE_MANAGER" \
    --data-urlencode "action=multiple" \
    --data-urlencode "button=delete" \
    --data-urlencode "path=$DEPLOY_PATH" \
    --data-urlencode "select0=$DEPLOY_PATH/deploy.zip" \
    --data-urlencode "trash=no")"
  da_check

  rm -f "$zipfile"
}

case "$DEPLOY_METHOD" in
  ssh)
    deploy_ssh
    ;;
  ftp)
    deploy_ftp
    ;;
  da-api)
    deploy_da_api
    ;;
  *)
    echo "Unknown DEPLOY_METHOD='$DEPLOY_METHOD' (use da-api, ssh, or ftp)"
    exit 1
    ;;
esac

echo "Deploy complete."
