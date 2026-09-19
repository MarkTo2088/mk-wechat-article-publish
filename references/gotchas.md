# 公众号图文发布：关键限制与踩坑

微信草稿 API 与排版过程中遇到过的真实限制与对策。发布前遇到诡异报错先查这里。

## 1. 小绿书模式（errcode 45166）—— 长文不能内嵌真·小程序卡片

**现象**：正文含 `<mp-miniprogram>` 小程序卡片标签时，微信 `draft/add` 会强制走
「小绿书图文」模式，该模式正文限约 **1000 字**。长推广文必触发：

```
45166: 内容超长。小绿书模式有内容长度限制，请精简正文后重试。
```

**结论**：长文经 API **无法内嵌可点击跳转的小程序卡片**。替代方案是**小程序码图片**
（用户长按识别进入小程序，不受字数限制），本工作流已采用 `gen_miniprogram_qr.sh`。
若用户坚持要可点击卡片，只能让其在公众号后台草稿编辑器里手动插入。

## 2. 批量删除草稿偶发 40066 —— 改用单篇删除

**现象**：`cgi-bin/draft/batchdel` 偶发返回
```
40066: invalid url rid: xxxxxxxx-xxxx-xxxx-xxxxxxxx
```
同一 access_token 下 `draft/batchget` 正常，说明 token 有效，是批量接口偶发网关错误。

**对策**：改用单篇删除 `cgi-bin/draft/delete`，body `{"media_id":"xxx"}`，逐篇删除。

```bash
for id in <media_id列表>; do
  curl -s -X POST "https://api.weixin.qq.com/cgi-bin/draft/delete?access_token=$TOKEN" \
    -H "Content-Type: application/json" -d "{\"media_id\":\"$id\"}"
done
```

## 3. 凭证与 IP 白名单（分步）

发布脚本在**本机**直连 `api.weixin.qq.com`，微信校验的是你的**公网出口 IP**，不是 127.0.0.1。

### 3.1 探测（推荐先跑）

```bash
bash scripts/probe.sh
```

会输出：本机公网 IP、凭证是否配置、能否拿到 `access_token`。  
若白名单未配好，会打印完整设置步骤，并以非 0 退出。  
设置页里也可点「探测 IP / 白名单」（需 `bash scripts/settings.sh` 开着）。

正式 `publish.sh`（非 `--dry`）发布前会自动跑同一套探测，失败则中止。

### 3.2 在微信开发者平台加入 API IP 白名单

> **入口已迁移（2025-12-01 起）**：原「微信公众平台 → 设置与开发 → 开发接口管理 / 基本配置」中的 AppSecret、IP 白名单等，已迁至 **微信开发者平台**。官方说明：[「开发接口管理」模块升级说明](https://developers.weixin.qq.com/doc/subscription/guide/dev/migration.html)。

1. 浏览器打开 [https://developers.weixin.qq.com/platform/](https://developers.weixin.qq.com/platform/)，用**管理员或开发者**微信扫码登录（仅「运营者」无权限）  
2. **我的业务** → **公众号** / **服务号** → 选中要发布的账号  
3. **基础信息**：核对 AppID 与本 skill 配置一致  
4. **基础信息** → **开发密钥**：管理 AppSecret，并打开 **API IP 白名单**  
5. 填入 `probe.sh` 给出的公网 IP（若报错里有「微信看到的 IP」，以该 IP 为准）并保存  
6. 等待约数分钟后再次 `bash scripts/probe.sh`，直到显示 OK  

AppID 仍可在公众平台「设置与开发 → 账号设置 → 账号详情」查看，但不在那里改密钥与白名单。

### 3.3 其它说明

- **公众号**凭证 → 工作空间 `.mk-wechat-publish/config.json` 的 `wechat`（`name` 公众号名称、AppID、AppSecret）/ skill 级 `config.local.json` / `WECHAT_ACCOUNT_NAME`、`WECHAT_APP_*`  
- **小程序**凭证（生成小程序码，另一套）→ 同文件 `mini` 或 `WECHAT_MINI_APP_*`  
- 家用宽带出口 IP 会变；突然出现 `invalid ip ... not in whitelist` 时重新探测并更新白名单  

## 3.4 对标链接

`bash scripts/extract-layout.sh <公众号文章链接>` 只提炼排版（配色、标题块、引用、画廊），写入工作空间 `.mk-wechat-publish/layout-ref.json`，**不保存正文**。微信若返回拦截页，把网页另存为 HTML 后加 `--file`。

## 3.5 配图水印

正式发布前 `publish.sh` 会检查 `.mk-wechat-publish/asset-checks/`。本地封面和正文图必须先 `bash scripts/verify-assets.sh <文章.md>`，助手打开图片确认没有角标、logo、「AI生成」后，再 `--ok`。文件一换就要重核。边角小标可用 `python3 scripts/crop-badge.py`，裁完仍要重看、重标。不要用这个步骤抹掉他人作品的版权水印。

## 4. 正文图片必须走 uploadimg

微信会过滤图文 `content` 里的外部图片 URL。本工作流在发布时自动：

1. 扫描 HTML 中本地路径的 `<img src>`
2. 调用 `cgi-bin/media/uploadimg` 换取 `mmbiz.qpic.cn` URL
3. 封面走 `material/add_material?type=image` 得到 `thumb_media_id`

上传必须把文件读成 Buffer 再交给 Node `fetch`，并带上 `Content-Length`。用 `createReadStream` 直接当 body 时，Node 22 的 undici 会把 media 传空，微信返回 `41005 media data missing`。

**注意**：已是 `http(s)://` 的外链图不会自动转存；若草稿里缺图，请改成本地相对路径。

## 5. 画廊横排写法

用 `<section style="overflow-x:auto; white-space:nowrap; ...">` 包裹多图。
渲染器会把区块内 `<img>` 设为 `display:inline-block;width:62%`（宽度可用
`gallery_width` 配置）。`<section>` 与图片之间不要夹无关块级内容。

## 6. 图片路径建议

封面 `cover` 与正文图片建议用**相对文章所在目录**的路径（如 `./images/x.png`）。
`publish.sh` 会把文章转绝对路径；相对路径最不易出错。

## 7. Node / 依赖

- 需要 **Node ≥ 20.19**（推荐 22 LTS）
- 首次在 skill 目录执行 `npm install`；之后 `publish.sh` / `settings.sh` 会检测 `node_modules`

## 8. 本地配置（多公众号 / 跟工作空间）

- **工作空间（优先）**：`<项目根>/.mk-wechat-publish/config.json`  
  由设置页 / onboard 默认写入；不同项目可对接不同公众号。  
- **skill 级（兜底）**：skill 目录下 `config.local.json`（跨项目默认）。  
- **环境变量（最低）**：`WECHAT_APP_ID` / `WECHAT_APP_SECRET` 等。  
- 发布时以**文章所在目录**向上解析工作空间。  
- 请将 `.mk-wechat-publish/` 加入项目 `.gitignore`，勿提交密钥。  
- 若需强制写入 skill 级：`MK_WECHAT_CONFIG_SCOPE=skill bash scripts/settings.sh`
