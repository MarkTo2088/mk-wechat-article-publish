---
# ===== 必填 =====
title: 推文标题（用于公众号草稿标题）
cover: ./images/cover.png          # 封面图，相对本文件所在目录即可

# ===== 可选：品牌色 =====
# 设置后，加粗/表头/引用边框等使用品牌色（去掉则用中性深色主题）
# 品牌色 ≠ 标题大色块；标题样式见 heading_style
brand_primary: "#00ff88"           # 品牌主色（十六进制）
brand_secondary: "#00d4ff"         # 可选：次色
# heading_style: accent            # accent=品牌色字+底线（默认）| plain=纯加粗 | block=实心色块

# ===== 可选：画廊图片宽度 =====
# gallery_width: 62                # 百分比数字，缺省 62
---

![封面占位](images/cover.png)

> 这是一段开头引导，可放一句让人继续读下去的话。

## 一个小标题

普通段落用 **加粗** 强调重点，列表、引用、表格都会渲染成带内联样式的公众号排版。

## 横向滑动画廊（可选）

用下面的原始 HTML 包裹多张图片即可实现横滑。渲染器会强制这些
`<img>` 变成 `display:inline-block`，实现同屏约 2.5 张、左右滑动：

<section style="overflow-x:auto; white-space:nowrap; padding:8px 0;">

![图一描述](images/img_1.png)

![图二描述](images/img_2.png)

![图三描述](images/img_3.png)

</section>

← 左右滑动查看 →

## 列表与表格

- 特性一：一句话
- 特性二：一句话

| 选项 | 说明 |
| --- | --- |
| A | 一句话 |
| B | 一句话 |

## 小程序码（可选，长文推荐）

长文请用小程序码图片（勿嵌 `<mp-miniprogram>` 卡片，见 gotchas）：

![小程序码](images/miniprogram_qrcode.png)
