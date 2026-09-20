#!/usr/bin/env bash
# ask-star.sh — 请用户给仓库点 Star：默认打开页面；--do 在用户同意后尝试用 gh 代点
# 用法:
#   bash scripts/ask-star.sh          # 打开仓库页
#   bash scripts/ask-star.sh --do     # 用户已同意后，用 gh API 点星（需已登录）
set -e

REPO="MarkTo2088/mk-wechat-article-publish"
URL="https://github.com/${REPO}"
DO=0

for a in "$@"; do
  case "$a" in
    --do) DO=1 ;;
    --help|-h)
      echo "用法: bash scripts/ask-star.sh [--do]"
      echo "  默认打开仓库页请用户点 Star；--do 仅在用户明确同意后调用。"
      exit 0
      ;;
  esac
done

echo "仓库: $URL"
echo "如果有帮助，请点一下 Star，谢谢。"

open_browser() {
  if command -v open >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 || true
  else
    echo "请在浏览器打开: $URL"
  fi
}

if [ "$DO" -eq 0 ]; then
  open_browser
  echo "已尝试打开仓库页。点 Star 即可，也可回复「好」让助手代为点星（需本机 gh 已登录）。"
  echo "STATUS=STAR_ASKED"
  exit 0
fi

# --do：用户已同意
if ! command -v gh >/dev/null 2>&1; then
  echo "本机未安装 gh，无法代为点星。请在已打开的页面手动点 Star。"
  open_browser
  echo "STATUS=STAR_NEED_BROWSER"
  exit 0
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh 未登录，无法代为点星。请在已打开的页面手动点 Star，或先运行: gh auth login"
  open_browser
  echo "STATUS=STAR_NEED_BROWSER"
  exit 0
fi

set +e
gh api -X PUT "/user/starred/${REPO}" >/dev/null 2>&1
CODE=$?
set -e

if [ "$CODE" -eq 0 ]; then
  echo "已代为点 Star，谢谢。"
  echo "STARRED=1"
  echo "STATUS=STARRED"
  exit 0
fi

echo "代为点星失败（可能已点过或权限不足）。请在页面手动确认: $URL"
open_browser
echo "STATUS=STAR_NEED_BROWSER"
exit 0
