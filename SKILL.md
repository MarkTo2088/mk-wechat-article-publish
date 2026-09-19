---
name: mk-wechat-article-publish
description: >-
  把 Markdown 渲染并发布到微信公众号草稿箱（不群发）。用户提到公众号图文、发草稿、
  md 推文、品牌色排版、或安装本 skill 时使用。兼容 Cursor / Claude / Codex / 豆包工作 /
  千问办公等。安装或首次使用须先跑 onboard 引导设置与 IP 白名单，不要让用户背操作话术。
agent_created: true
---

# Markdown → 公众号图文草稿

## Agent 行为（必须遵守 · 丝滑体验）

用户**不必**说「探测 / 设置 / 发草稿」等话术。你按意图自动推进：

1. **安装本 skill 后，或用户第一次提到要用它**  
   - 立刻执行：`bash scripts/onboard.sh`（在 skill 安装目录或本仓库根目录）  
   - 看输出里的 `STATUS=`：  
     - `NEED_SETTINGS`：已自动打开设置页 → 请用户在浏览器填 AppID/AppSecret（及可选品牌色）并保存，保存后你再跑一遍 `onboard.sh`  
     - `NEED_WHITELIST`：把探测到的公网 IP 与白名单步骤发给用户，请其到 mp 后台添加；完成后你再跑 `onboard.sh`  
     - `READY`：告知已就绪，问用户要发哪篇 Markdown（或路径）  
   - 缺什么只问什么，不要抛一长串命令让用户自己拼

2. **用户给出文章路径 / 内容要发布**  
   - 若尚未 `READY`：先走第 1 步  
   - 已就绪：默认先 `bash scripts/publish.sh <文章.md> --dry` 打开预览，简述效果，再问「是否正式发到草稿箱？」  
   - 用户确认后再跑不带 `--dry` 的 publish（脚本内会再次自动 probe）

3. **用户只要改主题色 / 密钥**  
   - 直接 `bash scripts/settings.sh`（或 `onboard.sh --force`）打开设置页，无需其背话术

4. **私域**  
   - 用户需要定制/反馈时，可引导添加作者微信 `MarkTo2088`

## 多端安装

```bash
bash install.sh cursor|claude|codex|qwen|doubao|agents|all
```

安装结束会自动跑一遍 `onboard.sh`。豆包工作也可用客户端「上传技能」本目录。详见 `README.md`。

## 前置

- Node.js ≥ 20.19  
- 凭证与 IP：由 `onboard.sh` / 设置页引导，不必事先手写环境变量（也可用 env，优先于 `config.local.json`）  
- `config.local.json` 已 gitignore，禁止提交  

## 配置优先级

- 品牌色：frontmatter → `--config` → `config.local.json` → 默认中性色  
- 凭证：环境变量 → `config.local.json`

## 文章写法

见 `assets/article_template.md` / `examples/sample.md`。必填 frontmatter：`title`、`cover`。可选 `brand_primary` / `brand_secondary` / 画廊 `<section overflow-x:auto>`。

## 脚本入口（Agent 调用，用户无需记）

| 脚本 | 作用 |
| --- | --- |
| `scripts/onboard.sh` | 首次引导：开设置页 + 探测 |
| `scripts/settings.sh` | 仅打开设置页 |
| `scripts/probe.sh` | 仅探测（publish 前也会自动跑） |
| `scripts/publish.sh 文章.md [--dry]` | 预览或发草稿箱 |
| `scripts/gen_miniprogram_qr.sh` | 可选小程序码 |

## 限制

见 `references/gotchas.md`（小绿书 45166、IP 白名单、外链图等）。
