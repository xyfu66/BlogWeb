#!/usr/bin/env bash
# 静态站点原子 swap：staging 校验通过后替换 prod
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../lib/common.sh"

REMOTE_STATIC_DIR="${REMOTE_STATIC_DIR:?}"
STAGING_DIR="${REMOTE_STATIC_DIR}.staging"
BACKUP_DIR="${REMOTE_STATIC_DIR}.bak"

if [[ ! -f "${STAGING_DIR}/index.html" ]]; then
  deploy_fail "staging missing index.html: ${STAGING_DIR}/index.html"
fi

deploy_log "atomic swap: ${STAGING_DIR} -> ${REMOTE_STATIC_DIR}"

rm -rf "$BACKUP_DIR"
if [[ -d "$REMOTE_STATIC_DIR" ]]; then
  mv "$REMOTE_STATIC_DIR" "$BACKUP_DIR"
fi
mv "$STAGING_DIR" "$REMOTE_STATIC_DIR"
mkdir -p "$STAGING_DIR"
chmod -R u=rwX,go=rX "$REMOTE_STATIC_DIR"

deploy_log "static atomic swap done"
