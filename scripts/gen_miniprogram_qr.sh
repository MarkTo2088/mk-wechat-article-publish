#!/bin/bash
# gen_miniprogram_qr.sh - 生成「小程序码」图片（可选能力，非发布必需）
# 用法: bash scripts/gen_miniprogram_qr.sh [-o 输出.png] [--scene 参数] [--page 页面路径] [--width 430] [--env release|develop|trial]
#
# 凭证: 环境变量 WECHAT_MINI_APP_ID / WECHAT_MINI_APP_SECRET
#       （小程序凭证，与公众号发布凭证 WECHAT_APP_ID / WECHAT_APP_SECRET 是两套）
# 依赖: curl + python3（解析 JSON）
#
# 用途: 公众号正文里内嵌真·小程序卡片会触发「小绿书模式」字数限制（见 references/gotchas.md），
#       长文推广改用「小程序码图片」——用户手机端长按识别即可进入小程序，不受字数限制。

set -e

OUT="miniprogram_qrcode.png"
SCENE="home"
PAGE="pages/index/index"
WIDTH="430"
ENV="release"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--output) OUT="$2"; shift 2 ;;
    --scene) SCENE="$2"; shift 2 ;;
    --page) PAGE="$2"; shift 2 ;;
    --width) WIDTH="$2"; shift 2 ;;
    --env) ENV="$2"; shift 2 ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

if [ -z "$WECHAT_MINI_APP_ID" ] || [ -z "$WECHAT_MINI_APP_SECRET" ]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  START_DIR="${MK_WECHAT_START_DIR:-$PWD}"
  # 从工作空间优先解析 mini 凭证
  EVAL_OUT=$(cd "$ROOT_DIR" && MK_WECHAT_START_DIR="$START_DIR" node --input-type=module -e "
    import { resolveConfig } from './scripts/lib/local-config.mjs';
    const r = resolveConfig({ startDir: process.env.MK_WECHAT_START_DIR || process.cwd() });
    const m = r.config.mini || {};
    if (m.appId) console.log('WECHAT_MINI_APP_ID=' + JSON.stringify(m.appId));
    if (m.appSecret) console.log('WECHAT_MINI_APP_SECRET=' + JSON.stringify(m.appSecret));
  " 2>/dev/null || true)
  if [ -n "$EVAL_OUT" ]; then
    eval "$EVAL_OUT"
    export WECHAT_MINI_APP_ID WECHAT_MINI_APP_SECRET
  fi
fi

if [ -z "$WECHAT_MINI_APP_ID" ] || [ -z "$WECHAT_MINI_APP_SECRET" ]; then
  echo "缺少小程序凭证：请在工作空间设置页填写 mini，或设置 WECHAT_MINI_APP_ID / WECHAT_MINI_APP_SECRET。"
  exit 1
fi

echo "获取小程序 access_token..."
TOKEN=$(curl -s "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WECHAT_MINI_APP_ID}&secret=${WECHAT_MINI_APP_SECRET}" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);sys.exit(1) if 'access_token' not in d else print(d['access_token'])") || {
  echo "获取小程序 access_token 失败（检查 AppID/AppSecret / IP 白名单）"; exit 1;
}

echo "生成小程序码 → $OUT (scene=$SCENE page=$PAGE width=$WIDTH env=$ENV)"
curl -s "https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"scene\":\"${SCENE}\",\"page\":\"${PAGE}\",\"width\":${WIDTH},\"env_version\":\"${ENV}\"}" \
  -o "$OUT"

# getwxacodeunlimit 成功返回图片二进制，失败返回 JSON（含 errcode）
if head -c 1 "$OUT" | grep -q '{'; then
  echo "接口返回错误: $(cat "$OUT")"
  rm -f "$OUT"
  exit 1
fi

echo "完成: $OUT（可放进文章文末，手机端长按识别）"
