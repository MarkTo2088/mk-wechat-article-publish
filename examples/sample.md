---
title: 示例推文：验证品牌色与画廊
cover: img/cover.png
brand_primary: "#00ff88"
brand_secondary: "#00d4ff"
---

![封面](img/cover.png)

这是一篇用来验证 skill 的示例文章。封面、画廊与小程序码图片均为占位图。

## 换色验证

标题底色、**加粗关键字**、引用左边框与表格表头在 `--dry` 输出中应显示为品牌色
（此处示例为荧光绿 #00ff88）。

## 画廊验证

<section style="overflow-x:auto; white-space:nowrap; padding:8px 0;">

![图1](img/img_1.png)

![图2](img/img_2.png)

![图3](img/img_3.png)

</section>

← 左右滑动 →

| 项 | 说明 |
| --- | --- |
| 品牌色 | #00ff88 |
| 画廊 | 三图横滑 |

> 运行 `bash scripts/publish.sh examples/sample.md --dry`，然后打开
> `/tmp/debug_publish.html` 检查品牌色与画廊横排效果。
