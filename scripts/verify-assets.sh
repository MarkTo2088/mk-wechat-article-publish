#!/bin/bash
# verify-assets.sh — 核验文章配图无水印
# 用法: bash scripts/verify-assets.sh <文章.md> [--ok 图片路径]
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

MD="$1"
if [ -z "$MD" ] || [[ "$MD" == --* ]]; then
  echo "用法: bash scripts/verify-assets.sh <文章.md> [--ok 图片路径]"
  exit 1
fi
if [[ "$MD" != /* ]]; then
  MD="$(pwd)/$MD"
fi
shift || true

cd "$ROOT_DIR"
set +e
"$NODE_BIN" scripts/verify-assets.mjs "$MD" "$@"
CODE=$?
set -e
exit "$CODE"
