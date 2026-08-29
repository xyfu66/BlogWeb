#!/usr/bin/env bash
# 远程公共函数：fail-fast、统一日志输出。
set -euo pipefail

deploy_log() {
  echo "[deploy] $*"
}

deploy_fail() {
  echo "[deploy] ERROR: $*" >&2
  exit "${DEPLOY_EXIT_CODE:-30}"
}
