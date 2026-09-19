#!/bin/bash
# publish.sh - 公众号图文增强发布入口（自建渲染 + 草稿 API，无 wenyan）
# 用法: bash scripts/publish.sh <文章.md> [--dry] [--config <config.json>]
#
# 文章路径会先转为绝对路径，因此可从任意目录调用。
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MD="$1"
if [ -z "$MD" ] || [[ "$MD" == --* ]]; then
  echo "用法: bash scripts/publish.sh <文章.md> [--dry] [--config <config.json>]"
  exit 1
fi

# 优先使用满足版本要求的 Node（当前 PATH → nvm 下的 22/20）
resolve_node() {
  local cand major
  # shellcheck disable=SC2046
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
  echo "需要 Node.js ≥ 20.19（推荐 22 LTS），当前: $(command -v node >/dev/null && node -v || echo '未安装')"
  echo "安装: nvm install 22 && nvm use 22  或参考 https://nodejs.org"
  exit 1
fi
echo "使用 Node: $($NODE_BIN -v) ($NODE_BIN)"

# 转绝对路径（相对路径基于调用者当前目录）
if [[ "$MD" != /* ]]; then
  MD="$(pwd)/$MD"
fi
if [ ! -f "$MD" ]; then
  echo "找不到文章文件: $MD"
  exit 1
fi

# 确保依赖已安装
if [ ! -d "$ROOT_DIR/node_modules/markdown-it" ]; then
  echo "依赖未安装，正在 npm install ..."
  NPM_BIN="$(dirname "$NODE_BIN")/npm"
  if [ -x "$NPM_BIN" ]; then
    (cd "$ROOT_DIR" && "$NPM_BIN" install --silent)
  else
    (cd "$ROOT_DIR" && npm install --silent)
  fi
fi

shift || true
# --config 若为相对路径，基于调用者 cwd 转绝对，便于 publish.mjs 解析
ARGS=()
while [ $# -gt 0 ]; do
  if [ "$1" = "--config" ] && [ -n "${2:-}" ]; then
    CFG="$2"
    if [[ "$CFG" != /* ]]; then
      CFG="$(pwd)/$CFG"
    fi
    ARGS+=("--config" "$CFG")
    shift 2
  else
    ARGS+=("$1")
    shift
  fi
done

cd "$ROOT_DIR"
exec "$NODE_BIN" scripts/publish.mjs "$MD" "${ARGS[@]}"
