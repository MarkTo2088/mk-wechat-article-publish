#!/bin/bash
# onboard.sh - 首次引导：缺凭证则打开设置页，再探测 IP/白名单
# 用法: bash scripts/onboard.sh [--force]
# 退出码: 0=就绪 2=需填设置页 3=需加 IP 白名单 其它=失败
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

resolve_node() {
  local cand major
  for cand in "$(command -v node 2>/dev/null)" \
    $(ls -d "${NVM_DIR:-$HOME/.nvm}/versions/node"/v22.*/bin/node 2>/dev/null | sort -V | tail -1) \
    $(ls -d "${NVM_DIR:-$HOME/.nvm}/versions/node"/v20.*/bin/node 2>/dev/null | sort -V | tail -1); do
    [ -n "$cand" ] && [ -x "$cand" ] || continue
    major=$("$cand" -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/')
    if [ -n "$major" ] && [ "$major" -ge 20 ]; then
      echo "$cand"
      return 0
    fi
  done
  return 1
}

NODE_BIN="$(resolve_node || true)"
if [ -z "$NODE_BIN" ]; then
  echo "需要 Node.js ≥ 20.19"
  exit 1
fi

if [ ! -d "$ROOT_DIR/node_modules/markdown-it" ]; then
  echo "依赖未安装，正在 npm install ..."
  (cd "$ROOT_DIR" && "$(dirname "$NODE_BIN")/npm" install --silent 2>/dev/null || npm install --silent)
fi

cd "$ROOT_DIR"
set +e
"$NODE_BIN" scripts/onboard.mjs "$@"
CODE=$?
set -e
exit "$CODE"
