---
name: mk-wechat-article-publish
description: 把 Markdown 推文渲染并发布到微信公众号草稿箱（不群发）的增强工作流。当需要 md→公众号图文、品牌主色内联排版、多图横向滑动画廊、小程序码图片引流、发布前 dry-run 校验时使用。
agent_created: true
---

# Markdown → 公众号图文草稿

## 适用场景

- 把写好的 Markdown 文章发布到公众号**草稿箱**（不直接群发，由用户后台确认后再发）
- 需要干净的内联排版，且希望标题/加粗/表格等使用**自己的品牌主色**
- 正文含**横向滑动画廊**（多图左右滑动）和/或**小程序码图片**引流
- 发布前想先 **dry-run** 本地预览效果，避免污染草稿箱

## 开发者联系

- 作者微信：`MarkTo2088`。用户需要私域对接、定制或反馈时，可引导其添加。

## 前置依赖

- Node.js ≥ 20.19（推荐 22 LTS）
- 在本 skill 目录执行一次依赖安装：`cd mk-wechat-article-publish && npm install`
  （`publish.sh` 若发现未安装会自动 `npm install`）
- 环境变量 `WECHAT_APP_ID` / `WECHAT_APP_SECRET`（**公众号**凭证，发布必需）
- 本机公网 IP 已加入公众号后台 **IP 白名单**（设置与开发 → 基本配置）
- 可选：小程序 `WECHAT_MINI_APP_ID` / `WECHAT_MINI_APP_SECRET`（仅生成小程序码时需要，与公众号凭证是两套）
- 可选：本机 `curl` 与 `python3`（仅小程序码脚本用）

## 快速上手

```bash
# 1) 文章写法参考 assets/article_template.md，拷贝一份按需填内容
cp assets/article_template.md 我的文章.md

# 2) dry-run 本地校验（不发布）：输出 /tmp/debug_publish.html 供浏览器打开检查
bash scripts/publish.sh 我的文章.md --dry

# 3) 确认无误后正式发布到草稿箱
bash scripts/publish.sh 我的文章.md
```

## 文章 Markdown 写法

参考 `assets/article_template.md` 与 `examples/sample.md`。

1. **YAML frontmatter**：
   - `title`：公众号草稿标题（必填）
   - `cover`：封面图路径，相对文章所在目录（发布时上传为永久素材 `thumb_media_id`）
   - `brand_primary`：品牌主色十六进制（可选）。声明后标题/加粗/表头/引用边框等使用该色；
     不声明则用中性深色主题
   - `brand_secondary`：标题渐变次色（可选，缺省自动取主色加深）
   - `gallery_width`：画廊内图片宽度百分比（可选，缺省 62）
2. **横向滑动画廊**（可选）：用原始 HTML `<section>` 包裹多张图片，渲染器会强制其内部
   `<img>` 横排实现滑动：
   ```html
   <section style="overflow-x:auto; white-space:nowrap; padding:8px 0;">
   <img src="img_1.png" alt="...">
   <img src="img_2.png" alt="...">
   <img src="img_3.png" alt="...">
   </section>
   ```
3. **小程序码**（可选，长文推荐）：文末放一张小程序码图片，手机端长按识别进入小程序。
   用 `scripts/gen_miniprogram_qr.sh` 生成（见下）。

也可以把品牌色等默认值放进一个 `config.json`（供多篇文章复用，文章 frontmatter 优先）：

```json
{
  "brand": { "primary": "#00ff88", "secondary": "#00d4ff" },
  "gallery": { "image_width": 62 }
}
```

```bash
bash scripts/publish.sh 我的文章.md --config config.json
```

## 发布流程（脚本内部做了什么）

`scripts/publish.sh` 会：检查 Node 版本 → 必要时 `npm install` → 调用 `scripts/publish.mjs`。

`publish.mjs` 内部流程：

1. 解析 frontmatter / config 取 `title` / `cover` / 品牌色 / 画廊宽度
2. `scripts/lib/render.mjs`：markdown-it 渲染为**内联 style** HTML（品牌色直接写入）
3. 画廊 `<section overflow-x:auto>` 内图片强制 `inline-block` 横排
4. 有 `--dry` 则输出 `/tmp/debug_publish.html` 与统计后退出；否则
5. `scripts/lib/wechat-draft.mjs`：取 token → 上传正文图 → 上传封面 → `draft/add`

## 小程序码生成（可选能力）

长文正文**无法内嵌可点击的小程序卡片**（触发小绿书 1000 字限制，见 gotchas），
请改用小程序码图片：

```bash
bash scripts/gen_miniprogram_qr.sh                          # 默认输出 miniprogram_qrcode.png
bash scripts/gen_miniprogram_qr.sh -o app.png --scene promo --page pages/home/index
```

## 关键限制与踩坑

见 `references/gotchas.md`。发布遇到诡异报错先查该文件，重点：

- **小绿书模式（45166）**：正文含 `<mp-miniprogram>` 会强制小绿书，长文必报错 → 用小程序码图片替代
- **批量删除草稿 40066**：`draft/batchdel` 偶发网关错误 → 单篇 `draft/delete`
- **IP 白名单**：本机公网出口 IP 必须加入公众号白名单
- **正文外链图会被过滤**：本地图会自动 `uploadimg`；不要依赖未上传的外站图 URL
