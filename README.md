# mk-wechat-article-publish

把 Markdown 一键渲染成 **微信公众号图文草稿**（发布到草稿箱，不群发）。

支持品牌色排版、横向滑动画廊、小程序码，以及本地设置页一次配置主题色与发布凭证。可作为 AI 助手的 Skill 安装使用，也可在本机直接跑脚本。

| 能力 | 说明 | 是否可选 |
| --- | --- | --- |
| 品牌色 | 标题/加粗/表头/引用边框使用品牌主色；可手动选色，也可让助手按描述生成 | 可选 |
| 横向滑动画廊 | 多图左右滑动浏览 | 可选 |
| 小程序码 | 生成小程序码图片，方便读者长按进入小程序 | 可选 |
| 本地统一设置 | 主题色与凭证写入工作空间 `.mk-wechat-publish/`（多公众号分项目） | 推荐 |

> 文章只会进入公众号**草稿箱**，需你在后台确认后再群发——本工具不会自动群发。

**联系方式**：
- 微信 `MarkTo2088`：定制与问题反馈  
- 公众号 **XLanAI**：微信搜「XLanAI」，获取更多工具与固定 IP 发布相关说明

---

## 目录结构

```
mk-wechat-article-publish/
├── SKILL.md                  # Skill 入口（供 AI Agent 读取）
├── README.md                 # 本文件
├── install.sh                # 多端一键安装（cursor/codex/qwen/doubao/…）
├── package.json
├── config.local.example.json # skill 级兜底配置示例（复制为 config.local.json）
│                             # 实际优先用各项目 .mk-wechat-publish/config.json
├── assets/
│   ├── article_template.md
│   └── settings.html         # 统一设置页 UI
├── references/
│   └── gotchas.md
├── scripts/
│   ├── settings.sh           # 打开设置页（主题色 + 密钥）
│   ├── set-brand.sh          # CLI 写入品牌色（供助手按描述生成）
│   ├── onboard.sh            # 首次引导：自动开设置 + 探测
│   ├── print-promo.sh        # 安装完成后的关注提示
│   ├── probe.sh              # 探测公网 IP / 白名单 / 凭证
│   ├── publish.sh            # 发布入口
│   ├── publish.mjs
│   ├── probe.mjs
│   ├── lib/
│   │   ├── local-config.mjs
│   │   ├── probe.mjs         # IP + token 探测
│   │   ├── render.mjs
│   │   ├── dry-preview.mjs
│   │   └── wechat-draft.mjs
│   └── gen_miniprogram_qr.sh
└── examples/
```

---

## 一、环境准备

1. **Node.js ≥ 20.19（推荐 22 LTS）**，在本目录安装依赖：
   ```bash
   cd mk-wechat-article-publish
   npm install
   ```
2. **推荐：本地统一设置**（也可安装后由 `onboard.sh` 自动打开）：
   ```bash
   bash scripts/onboard.sh        # 缺凭证会弹设置页，再探测 IP
   # 或仅打开设置：bash scripts/settings.sh
   ```
3. **或**使用环境变量（优先级低于工作空间配置，适合临时覆盖）：
   ```bash
   export WECHAT_APP_ID="你的公众号 AppID"
   export WECHAT_APP_SECRET="你的公众号 AppSecret"
   ```
4. **IP 白名单**：每个公众号各自配置；`onboard.sh` / `probe.sh` 会打印公网 IP。

**配置优先级（多公众号）**  
品牌色：文章 frontmatter → `--config` → **工作空间** `.mk-wechat-publish/config.json` → skill 级 `config.local.json` → 默认  
凭证：**工作空间** → skill 级 → 环境变量  
公众号名称写在 `wechat.name`（设置页第一项），发布与探测时会显示，方便核对是哪个号。  

请在项目 `.gitignore` 中加入：

```gitignore
.mk-wechat-publish/
```

---

## 二、安装到 AI Agent

本目录是标准 **Agent Skills** 结构（根目录含 `SKILL.md`），兼容会扫描 skills 目录或支持「上传技能包」的客户端。

### 一键安装（推荐）

```bash
git clone https://github.com/MarkTo2088/mk-wechat-article-publish.git
cd mk-wechat-article-publish
bash install.sh cursor          # 或 claude / codex / qwen / doubao / agents …
bash install.sh all             # 装到本脚本已知的全部目标
```

### 各端安装位置

| Agent | 安装位置 / 方式 | 说明 |
| --- | --- | --- |
| Cursor | `~/.cursor/skills/mk-wechat-article-publish/` | `bash install.sh cursor` |
| Claude Code | `~/.claude/skills/…` | `bash install.sh claude` |
| Codex | `~/.codex/skills/…` + 同步 `~/.agents/skills/…` | `bash install.sh codex`；项目内也可放 `.agents/skills/` |
| 千问办公 (QwenWork) | `~/.qwenworkcn/skills/…` | `bash install.sh qwen`；或对话里让其安装 GitHub 仓库 |
| 豆包工作 | `~/.user_skills/…` 或客户端上传 | `bash install.sh doubao`；或「技能·连接器·伙伴」→ 上传本目录 |
| CodeBuddy | `~/.codebuddy/skills/…` | `bash install.sh codebuddy` |
| Trae / Trae 国内 | `~/.trae/skills/` · `~/.trae-cn/skills/` | `bash install.sh trae` / `trae-cn` |
| WorkBuddy | `~/.workbuddy/skills/…` | `bash install.sh workbuddy` |
| 项目级通用 | `<仓库>/.agents/skills/mk-wechat-article-publish/` | 多端从仓库扫描时用；`cp -R` 或 `install.sh agents` 仅装用户级 |
| 其它助手 | 将本仓库放入工作区，并发送下方安装说明 | 能执行终端命令并阅读 `SKILL.md` 即可 |

**说明**：发布在本机执行脚本完成，不绑定某一款 IDE。也可不经助手，直接按本文命令使用。

### 给助手发送的安装说明

复制下面一句发给 AI 助手即可。装好后它会引导你完成设置与 IP 白名单，一般不用再记其它命令。

```text
按 https://github.com/MarkTo2088/mk-wechat-article-publish 安装 mk-wechat-article-publish，装完按说明引导我完成配置。
```

之后直接说「发这篇 xxx.md」或把文章路径发给助手即可。

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
- 品牌色：frontmatter > `--config` > 工作空间配置 > skill 级 > 默认
- 多篇共用：在本工作空间跑一次设置页即可；换项目即换公众号配置
- **品牌色两种维护方式**：
  1. **手动**：`bash scripts/settings.sh`，或 dry-run 顶栏选色后保存  
  2. **助手生成**：描述风格（如「赛博绿」）后，助手选定色值并执行  
     `bash scripts/set-brand.sh --primary "#00ff88" --secondary "#00d4ff"`

---

## 四、发布

```bash
# 首次 / 装完：自动引导
bash scripts/onboard.sh

# dry-run 预览 → 确认后正式发草稿
bash scripts/publish.sh 你的文章.md --dry
bash scripts/publish.sh 你的文章.md
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
不受字数限制，适合在长文中引导读者打开小程序。

---

## 六、排障速查

| 报错 / 现象 | 原因与对策 |
| --- | --- |
| `invalid ip ... not in whitelist` | 运行 `bash scripts/probe.sh`，按输出把公网 IP 加入后台白名单 |
| 探测失败但网页能登录公众号 | 与网页无关；API 必须白名单。确认填的是 probe 给出的出口 IP |
| `45166 内容超长` | 正文内嵌了小绿书模式内容/小程序卡片 → 换小程序码图片、精简正文 |
| `40066 invalid url rid` | `draft/batchdel` 批量删除偶发网关错 → 用单篇 `draft/delete` |
| 颜色不是品牌色 | 查 frontmatter / 工作空间配置 / 设置页；dry-run 顶栏可微调 |
| dry 保存默认色失败 | 先 `bash scripts/settings.sh` 保持设置服务运行 |
| 缺少依赖 | 在 skill 目录执行 `npm install` |
| 缺少凭证 | 在对应工作空间运行 `bash scripts/settings.sh` / `onboard.sh` |
| 配错公众号 | 确认当前目录所属工作空间；配置在 `.mk-wechat-publish/config.json` |

完整踩坑记录见 `references/gotchas.md`。

作者微信：`MarkTo2088`  
公众号：**XLanAI**（微信搜「XLanAI」）

---

## License

MIT
