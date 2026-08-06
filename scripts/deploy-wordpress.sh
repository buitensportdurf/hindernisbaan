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
  : "${DEPLOY_HOST:?Set DEPLOY_HOST in .env.deploy.local for SSH}"
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

  : "${DEPLOY_HOST:?Set DEPLOY_HOST in .env.deploy.local for FTP}"
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

  local parent name workdir zipfile cookies
  parent="$(dirname "$DEPLOY_PATH")"
  name="$(basename "$DEPLOY_PATH")"
  workdir="$(mktemp -d)"
  zipfile="$workdir/deploy.zip"
  cookies="$workdir/cookies.txt"
  # shellcheck disable=SC2064  -- expand now; workdir is local and gone at EXIT
  trap "rm -rf '$workdir'" EXIT

  echo "Zipping build/ ..."
  (cd build && zip -qr "$zipfile" .)

  # Uploads and other POSTs are only accepted with a session, not basic auth
  # (basic-auth POSTs 302 to the login page without doing anything). The login
  # key needs the "Allow Login" (HTM) flag for session creation to work.
  echo "Logging in to DirectAdmin ..."
  local login_status
  login_status="$(curl -sS -o /dev/null -w '%{http_code}' -c "$cookies" \
    -X POST "$DEPLOY_DA_URL/api/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$DEPLOY_USER\",\"password\":\"$DEPLOY_DA_LOGIN_KEY\"}")"
  if [[ "$login_status" != "200" ]]; then
    echo "DirectAdmin login failed (HTTP $login_status). Check DEPLOY_USER/DEPLOY_DA_LOGIN_KEY."
    exit 1
  fi

  # Note: this DirectAdmin build often answers successful file-manager POSTs
  # with a bogus HTTP 500 while the operation succeeds server-side. Statuses
  # are therefore ignored; the directory listing below is the real check.
  da_post() {
    curl -sS -o /dev/null -b "$cookies" -H "Referer: $DEPLOY_DA_URL/CMD_FILE_MANAGER" \
      -X POST "$DEPLOY_DA_URL/CMD_FILE_MANAGER" "$@" || true
  }

  da_has_file() {
    curl -sS -b "$cookies" "$DEPLOY_DA_URL/CMD_FILE_MANAGER?path=$DEPLOY_PATH&json=yes" \
      | grep -q "\"$DEPLOY_PATH/$1\""
  }

  echo "Ensuring remote directory $DEPLOY_PATH exists ..."
  da_post --data-urlencode "action=folder" \
    --data-urlencode "path=$parent" \
    --data-urlencode "name=$name"

  echo "Uploading build zip ..."
  # MAX_FILE_SIZE is required; uploads fail without it.
  da_post -F "MAX_FILE_SIZE=1048576000" \
    -F "action=upload" \
    -F "path=$DEPLOY_PATH" \
    -F "file1=@$zipfile;filename=deploy.zip"

  if ! da_has_file "deploy.zip"; then
    echo "deploy.zip did not arrive in $DEPLOY_PATH; upload failed."
    exit 1
  fi

  echo "Extracting on server ..."
  da_post --data-urlencode "action=extract" \
    --data-urlencode "page=2" \
    --data-urlencode "path=$DEPLOY_PATH/deploy.zip" \
    --data-urlencode "directory=$DEPLOY_PATH"

  if ! da_has_file "index.html"; then
    echo "index.html not found in $DEPLOY_PATH after extract; deploy failed."
    exit 1
  fi

  echo "Removing uploaded zip ..."
  da_post --data-urlencode "action=multiple" \
    --data-urlencode "button=delete" \
    --data-urlencode "path=$DEPLOY_PATH" \
    --data-urlencode "select0=$DEPLOY_PATH/deploy.zip" \
    --data-urlencode "trash=no"
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
