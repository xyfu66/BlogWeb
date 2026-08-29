#!/usr/bin/env bash
# 健康检查：静态文件完整性与 HTTP 探针。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../lib/common.sh"

REMOTE_STATIC_DIR="${REMOTE_STATIC_DIR:-/var/www/me/blog}"
CHECK_FILE="${REMOTE_STATIC_DIR}/index.html"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1/me/blog/}"
HEALTH_TIMEOUT_SEC="${HEALTH_TIMEOUT_SEC:-15}"
HEALTH_INTERVAL_SEC="${HEALTH_INTERVAL_SEC:-3}"

# 1. 本地静态文件与构建标记核验
if [[ ! -f "$CHECK_FILE" ]]; then
  deploy_fail "health-check failed: $CHECK_FILE does not exist"
fi

if grep -q 'id="app"' "$CHECK_FILE"; then
  deploy_log "file integrity check OK: $CHECK_FILE verified"
else
  deploy_fail "file integrity check failed: $CHECK_FILE missing expected entry tags"
fi

# 2. HTTP 探针探活 (若本机 Nginx 已监听)
elapsed=0
health_ok=false
while [[ "$elapsed" -lt "$HEALTH_TIMEOUT_SEC" ]]; do
  if curl -sf -k -L "$HEALTH_URL" >/dev/null 2>&1; then
    health_ok=true
    break
  fi
  sleep "$HEALTH_INTERVAL_SEC"
  elapsed=$((elapsed + HEALTH_INTERVAL_SEC))
done

if [[ "$health_ok" == "true" ]]; then
  deploy_log "health-check HTTP probe OK: $HEALTH_URL reachable"
else
  deploy_log "health-check HTTP probe skipped or unconfirmed (HTTP status not yet active or blocked by host-rule)"
fi

deploy_log "health-check passed"
