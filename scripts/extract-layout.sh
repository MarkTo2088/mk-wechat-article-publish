#!/bin/bash
# extract-layout.sh — 从对标公众号链接提炼排版参考（不保存正文）
# 用法: bash scripts/extract-layout.sh <文章链接>
#       bash scripts/extract-layout.sh --file page.html
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
export MK_WECHAT_START_DIR="${MK_WECHAT_START_DIR:-$PWD}"

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

cd "$ROOT_DIR"
exec "$NODE_BIN" scripts/extract-layout.mjs "$@"
