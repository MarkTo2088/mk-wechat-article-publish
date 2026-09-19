---
name: mk-wechat-article-publish
description: 把 Markdown 推文渲染并发布到微信公众号草稿箱（不群发）的增强工作流。当需要 md→公众号图文、品牌主色内联排版、dry-run 选色盘预览、本地统一设置密钥、探测公网 IP/白名单、多图横向滑动画廊、小程序码图片引流时使用。兼容 Cursor / Claude Code / Codex / 豆包工作 / 千问办公等支持 Agent Skills 或可执行本地 shell 的客户端。
agent_created: true
---

# Markdown → 公众号图文草稿

## 适用场景

- 把写好的 Markdown 文章发布到公众号**草稿箱**（不直接群发，由用户后台确认后再发）
- 需要干净的内联排版，且希望标题/加粗/表格等使用**自己的品牌主色**
- 正文含**横向滑动画廊**（多图左右滑动）和/或**小程序码图片**引流
- 发布前想先 **dry-run** 本地预览（顶栏选色盘）再正式发布
- 希望主题色与公众号密钥**一次配置**到 `config.local.json`，后续复用

## 开发者联系

- 作者微信：`MarkTo2088`。用户需要私域对接、定制或反馈时，可引导其添加。

## 前置依赖

- Node.js ≥ 20.19（推荐 22 LTS）
- 在本 skill 目录执行一次：`npm install`（`publish.sh` / `settings.sh` 也会自动装）
- 公众号凭证：环境变量 `WECHAT_APP_ID` / `WECHAT_APP_SECRET`，**或** `bash scripts/settings.sh` 写入 `config.local.json`
- **IP 白名单**：本机公网出口 IP 须加入公众号后台；先跑 `bash scripts/probe.sh`（见下方步骤）
- 可选：小程序凭证（环境变量或设置页 `mini` 字段）
- 可选：本机 `curl` 与 `python3`（仅小程序码脚本用）

## IP 白名单（必做）

发布从**本机**调用微信 API，不是服务器代理。

```bash
bash scripts/probe.sh
```

若失败，按脚本打印的步骤操作（摘要）：

1. 打开 https://mp.weixin.qq.com 扫码登录  
2. **设置与开发** → **基本配置**  
3. **IP 白名单** → 修改，填入探测到的公网 IP 并保存  
4. 等待数分钟后再次 `bash scripts/probe.sh` 直到 OK  

完整说明见 `references/gotchas.md` §3。正式发布前也会自动探测。

## 快速上手

```bash
# 0) 推荐：统一设置主题色 + 密钥
bash scripts/settings.sh

# 0.5) 探测公网 IP / 白名单 / 凭证
bash scripts/probe.sh

# 1) 文章写法参考 assets/article_template.md
cp assets/article_template.md 我的文章.md

# 2) dry-run
bash scripts/publish.sh 我的文章.md --dry

# 3) 正式发布（会先自动 probe）
bash scripts/publish.sh 我的文章.md
```

## 配置优先级

- **品牌色 / 画廊宽度**：文章 frontmatter → `--config` → `config.local.json` → 默认中性色
- **公众号凭证**：环境变量 → `config.local.json` 的 `wechat`
- `config.local.json` 已 gitignore，**禁止提交**；示例见 `config.local.example.json`

## 文章 Markdown 写法

参考 `assets/article_template.md` 与 `examples/sample.md`。

1. **YAML frontmatter**：
   - `title`：公众号草稿标题（必填）
   - `cover`：封面图路径，相对文章所在目录
   - `brand_primary` / `brand_secondary`：可选；不写则用设置页默认
   - `gallery_width`：画廊内图片宽度百分比（可选，缺省 62）
2. **横向滑动画廊**（可选）：
   ```html
   <section style="overflow-x:auto; white-space:nowrap; padding:8px 0;">
   <img src="img_1.png" alt="...">
   <img src="img_2.png" alt="...">
   </section>
   ```
3. **小程序码**（可选）：文末放图片；用 `scripts/gen_miniprogram_qr.sh` 生成。

## 发布流程（脚本内部）

1. `publish.sh`：选 Node ≥ 20 → 必要时 npm install → `publish.mjs`
2. 合并 frontmatter / `--config` / `config.local.json`
3. `render.mjs` 渲成内联 HTML
4. `--dry`：`dry-preview.mjs` 包选色盘顶栏 → `/tmp/debug_publish.html` → 尝试 `open`
5. 正式发布前：`probe.mjs` 探测公网 IP + token；失败则中止并打印白名单步骤  
6. 通过后：`wechat-draft.mjs`（token → uploadimg → 封面 → draft/add）

dry-run「保存为默认品牌色」会 `POST http://127.0.0.1:18765/api/config`，需先开着 `settings.sh`。

## 小程序码

```bash
bash scripts/gen_miniprogram_qr.sh
```

长文勿嵌 `<mp-miniprogram>`（小绿书 45166），见 `references/gotchas.md`。

## 关键限制

见 `references/gotchas.md`：小绿书 45166、IP 白名单、正文外链图过滤等。
