# mk-wechat-article-publish

把 Markdown 一键渲染成 **微信公众号图文草稿**（发布到草稿箱，不群发）的 Agent Skill。

Markdown 内联排版 + 微信草稿 API。三类可选增强全部通过文章 `frontmatter` / 配置声明：

| 能力 | 说明 | 是否可选 |
| --- | --- | --- |
| 品牌色 | 标题/加粗/表头/引用边框使用你的品牌主色 | 可选（frontmatter 声明 `brand_primary`） |
| 横向滑动画廊 | 多图 `<section>` 包裹 → 手机端左右滑动 | 可选（写了画廊结构即启用） |
| 小程序码 | 生成小程序码图片，长按识别引流 | 可选（额外脚本 + 小程序凭证） |

> 发布产物进入公众号**草稿箱**，由人工在后台确认后群发——Skill 不会自动群发。

**联系 / 私域**：作者微信 `MarkTo2088`。使用、定制或问题反馈可添加，进私域交流。

---

## 目录结构

```
mk-wechat-article-publish/
├── SKILL.md                  # Skill 入口（供 AI Agent 读取）
├── README.md                 # 本文件
├── package.json              # 本地依赖（markdown-it / gray-matter / form-data）
├── assets/
│   └── article_template.md   # 文章模板
├── references/
│   └── gotchas.md            # 微信 API 踩坑与对策
├── scripts/
│   ├── publish.sh            # 发布入口（推荐）
│   ├── publish.mjs           # 编排：渲染 → dry / 草稿发布
│   ├── lib/
│   │   ├── render.mjs        # Markdown → 内联 HTML
│   │   └── wechat-draft.mjs  # token / 上传图 / draft/add
│   └── gen_miniprogram_qr.sh # 可选：生成小程序码图片
└── examples/
    ├── sample.md
    └── img/
```

---

## 一、环境准备

1. **Node.js ≥ 20.19（推荐 22 LTS）**，在本目录安装依赖：
   ```bash
   cd mk-wechat-article-publish
   npm install
   ```
   （之后跑 `publish.sh` 时若缺依赖会自动安装。）
2. **公众号凭证**（发布必需）——写入 shell 配置 `~/.zshrc` / `~/.bashrc`：
   ```bash
   export WECHAT_APP_ID="你的公众号 AppID"
   export WECHAT_APP_SECRET="你的公众号 AppSecret"
   source ~/.zshrc
   ```
   凭证位置：微信公众平台 mp.weixin.qq.com → 设置与开发 → 基本配置 → 公众号开发信息。
3. **IP 白名单**：把本机当前**公网出口 IP** 加入公众号后台「IP 白名单」
   （同页面下方），否则报 `invalid ip ... not in whitelist`。家用宽带 IP 会变，变了需重加。
4. **可选——小程序凭证**（仅生成小程序码需要，与公众号是两套）：
   ```bash
   export WECHAT_MINI_APP_ID="小程序 AppID"
   export WECHAT_MINI_APP_SECRET="小程序 AppSecret"
   ```

---

## 二、安装到 AI Agent

本目录是标准 SKILL 目录结构，可被支持 SKILL 的 Agent 直接使用。

| Agent | 安装位置 | 说明 |
| --- | --- | --- |
| CodeBuddy | `~/.codebuddy/skills/mk-wechat-article-publish/` | 用户级 |
| Cursor | `~/.cursor/skills/mk-wechat-article-publish/` | 用户级 |
| Claude Code | `~/.claude/skills/mk-wechat-article-publish/` | 用户级 |
| 任意 Agent | 项目内复制本目录 | 项目级，随仓库共享 |

```bash
mkdir -p ~/.cursor/skills
cp -R mk-wechat-article-publish ~/.cursor/skills/
cd ~/.cursor/skills/mk-wechat-article-publish && npm install
```

安装后可让 Agent 直接用自然语言触发，例如：
> “把 `docs/活动文章.md` 发布到公众号草稿箱（品牌色用 #00ff88），先 dry-run 给我看”

---

## 三、写文章

照 `assets/article_template.md` 或 `examples/sample.md` 的结构写 Markdown：

```markdown
---
title: 你的标题
cover: ./images/cover.png          # 封面，相对本文件路径
brand_primary: "#00ff88"           # 可选：品牌主色
brand_secondary: "#00d4ff"         # 可选：标题渐变次色
---

![封面](images/cover.png)

正文用普通 Markdown 即可（标题、加粗、列表、表格、引用、代码块）。

## 横向滑动画廊
<section style="overflow-x:auto; white-space:nowrap; padding:8px 0;">

![图1](images/img_1.png)

![图2](images/img_2.png)

</section>

## 小程序码
![小程序码](images/miniprogram_qrcode.png)
```

**要点**：
- 图片用**相对文章所在目录**的路径，最稳
- 品牌色不声明 = 中性深色主题；声明了则用品牌色
- 想让多篇共用一套品牌色，可用 `--config config.json`

---

## 四、发布

```bash
# 1) dry-run 本地预览（不发布）
bash scripts/publish.sh 你的文章.md --dry
#    → 生成 /tmp/debug_publish.html，浏览器打开检查品牌色与画廊

# 2) 正式发布到公众号草稿箱
bash scripts/publish.sh 你的文章.md

# 带配置文件（默认品牌色等）
bash scripts/publish.sh 你的文章.md --config config.json
```

成功后在公众号后台「草稿箱」看到文章，人工预览确认后即可群发。

---

## 五、生成小程序码（可选）

```bash
bash scripts/gen_miniprogram_qr.sh                        # 默认：miniprogram_qrcode.png
bash scripts/gen_miniprogram_qr.sh -o app.png --scene promo --page pages/home/index --width 430
```

**为什么长文用小程序码而不是小程序卡片？** 正文内嵌 `<mp-miniprogram>` 卡片会触发微信
「小绿书图文」模式（正文限约 1000 字），长文必报 `45166`。小程序码图片长按识别，
不受字数限制，是 API 长文引流的可行替代。

---

## 六、排障速查

| 报错 / 现象 | 原因与对策 |
| --- | --- |
| `invalid ip ... not in whitelist` | 公网 IP 未加入公众号白名单（见上文） |
| `45166 内容超长` | 正文内嵌了小绿书模式内容/小程序卡片 → 换小程序码图片、精简正文 |
| `40066 invalid url rid` | `draft/batchdel` 批量删除偶发网关错 → 用单篇 `draft/delete` |
| 颜色不是品牌色 | frontmatter 是否写了 `brand_primary`；值是否为 `#RRGGBB` |
| 画廊图片纵向堆叠 | 确认画廊用的是 `<section style="overflow-x:auto ...">` 结构 |
| 缺少依赖 | 在 skill 目录执行 `npm install` |

完整踩坑记录见 `references/gotchas.md`。

作者微信：`MarkTo2088`

---

## License

MIT
