#!/usr/bin/env bash
# install.sh - 将本 skill 安装到各 AI Agent 的 skills 目录
# 用法:
#   bash install.sh                 # 默认: cursor
#   bash install.sh codex
#   bash install.sh all             # 装到本脚本已知的全部目标
#   bash install.sh cursor claude codex qwen doubao agents
#
# 目标一览见下方 resolve_dest / README「安装到 AI Agent」
set -euo pipefail

SKILL_NAME="mk-wechat-article-publish"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

resolve_dest() {
  case "$1" in
    cursor)    echo "${HOME}/.cursor/skills/${SKILL_NAME}" ;;
    claude)    echo "${HOME}/.claude/skills/${SKILL_NAME}" ;;
    # Codex：官方扫 ~/.agents/skills 与仓库 .agents/skills；兼容旧路径 ~/.codex/skills
    codex)     echo "${CODEX_HOME:-${HOME}/.codex}/skills/${SKILL_NAME}" ;;
    agents)    echo "${HOME}/.agents/skills/${SKILL_NAME}" ;;
    codebuddy) echo "${HOME}/.codebuddy/skills/${SKILL_NAME}" ;;
    trae)      echo "${HOME}/.trae/skills/${SKILL_NAME}" ;;
    trae-cn)   echo "${HOME}/.trae-cn/skills/${SKILL_NAME}" ;;
    workbuddy) echo "${HOME}/.workbuddy/skills/${SKILL_NAME}" ;;
    # 千问办公（QwenWork）
    qwen|qwenwork|qwenworkcn)
               echo "${HOME}/.qwenworkcn/skills/${SKILL_NAME}" ;;
    # 豆包工作：用户自定义技能常见落点（亦可用客户端「上传技能」）
    doubao|doubaowork)
               echo "${HOME}/.user_skills/${SKILL_NAME}" ;;
    *)
      echo "未知目标: $1" >&2
      echo "可用: cursor claude codex agents codebuddy trae trae-cn workbuddy qwen doubao all" >&2
      return 1
      ;;
  esac
}

install_one() {
  local target="$1"
  local dest
  dest="$(resolve_dest "$target")"
  mkdir -p "$(dirname "$dest")"
  rm -rf "$dest"
  # 用 rsync 排除 node_modules / .git / 本地密钥
  if command -v rsync >/dev/null 2>&1; then
    mkdir -p "$dest"
    rsync -a --delete \
      --exclude node_modules \
      --exclude .git \
      --exclude config.local.json \
      --exclude '.env' \
      --exclude '.env.*' \
      "$SRC_DIR"/ "$dest"/
  else
    mkdir -p "$dest"
    tar -C "$SRC_DIR" \
      --exclude=node_modules --exclude=.git --exclude=config.local.json \
      --exclude='.env' --exclude='.env.*' \
      -cf - . | tar -C "$dest" -xf -
  fi
  echo "已安装 → $dest ($target)"
  # Codex 额外同步到 ~/.agents/skills（官方用户级路径）
  if [ "$target" = "codex" ]; then
    local agents_dest="${HOME}/.agents/skills/${SKILL_NAME}"
    mkdir -p "$(dirname "$agents_dest")"
    rm -rf "$agents_dest"
    if command -v rsync >/dev/null 2>&1; then
      mkdir -p "$agents_dest"
      rsync -a --delete \
        --exclude node_modules --exclude .git --exclude config.local.json \
        --exclude '.env' --exclude '.env.*' \
        "$SRC_DIR"/ "$agents_dest"/
    else
      mkdir -p "$agents_dest"
      tar -C "$SRC_DIR" \
        --exclude=node_modules --exclude=.git --exclude=config.local.json \
        --exclude='.env' --exclude='.env.*' \
        -cf - . | tar -C "$agents_dest" -xf -
    fi
    echo "已同步 → $agents_dest (codex/agents 用户级)"
  fi
  if [ -f "$dest/package.json" ]; then
    (cd "$dest" && npm install --silent) || echo "提示: 请稍后在 $dest 执行 npm install"
  fi
}

TARGETS=("$@")
if [ ${#TARGETS[@]} -eq 0 ]; then
  TARGETS=(cursor)
fi
if [ "${TARGETS[0]}" = "all" ]; then
  TARGETS=(cursor claude codex agents codebuddy trae trae-cn workbuddy qwen doubao)
fi

for t in "${TARGETS[@]}"; do
  install_one "$t"
done

echo ""
echo "安装完成。开始首次引导（设置页 / IP 探测）…"
# 用源码目录引导（各端拷贝后同一套脚本）；失败不阻断安装
set +e
bash "$SRC_DIR/scripts/onboard.sh"
ONBOARD_CODE=$?
set -e
echo ""
case "$ONBOARD_CODE" in
  0) echo "引导结果: READY（可发布）" ;;
  2) echo "引导结果: 请在已打开的设置页保存凭证后，让 Agent 再跑 onboard" ;;
  3) echo "引导结果: 请按输出将公网 IP 加入公众号白名单后，让 Agent 再跑 onboard" ;;
  *) echo "引导结果: 未完成（exit $ONBOARD_CODE），可稍后 bash scripts/onboard.sh" ;;
esac
echo "豆包工作若未自动发现技能：客户端「技能·连接器·伙伴」→ 上传本目录"
echo "关注公众号 XLanAI：更多 Skill / 固定 IP 发布专线 · 作者微信 MarkTo2088"
echo "仓库: https://github.com/MarkTo2088/mk-wechat-article-publish"
