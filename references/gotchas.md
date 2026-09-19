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

## 3. 凭证与 IP 白名单

- **公众号**发布凭证 → `WECHAT_APP_ID` / `WECHAT_APP_SECRET`
  （mp.weixin.qq.com → 设置与开发 → 基本配置 → 公众号开发信息）
- **小程序**凭证（生成小程序码用，与公众号是**两套**）→ `WECHAT_MINI_APP_ID` /
  `WECHAT_MINI_APP_SECRET`（同站 → 开发管理 → 开发设置）
- 本机公网 IP 必须加入公众号后台 **IP 白名单**（设置与开发 → 基本配置 → IP 白名单），
  否则接口返回 `invalid ip ... not in whitelist`。家用宽带出口 IP 会变，变了要重加。

## 4. 正文图片必须走 uploadimg

微信会过滤图文 `content` 里的外部图片 URL。本工作流在发布时自动：

1. 扫描 HTML 中本地路径的 `<img src>`
2. 调用 `cgi-bin/media/uploadimg` 换取 `mmbiz.qpic.cn` URL
3. 封面走 `material/add_material?type=image` 得到 `thumb_media_id`

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
- 首次在 skill 目录执行 `npm install`；之后 `publish.sh` 会检测 `node_modules`
- 本 skill **不再依赖** `@wenyan-md/cli` / 全局 `wenyan` 命令
