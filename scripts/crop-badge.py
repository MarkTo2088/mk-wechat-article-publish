#!/usr/bin/env python3
"""裁掉自己生图的边角水印小标。只在核验确认是边角标记、且不伤主体时使用。"""
import argparse
import sys

CORNERS = {
    "br": "右下",
    "bl": "左下",
    "tr": "右上",
    "tl": "左上",
}


def crop(im, corner, ratio):
    w, h = im.size
    dw = max(1, int(w * ratio))
    dh = max(1, int(h * ratio))
    if dw >= w or dh >= h:
        raise SystemExit("裁切比例过大")
    boxes = {
        "br": (0, 0, w - dw, h - dh),
        "bl": (dw, 0, w, h - dh),
        "tr": (0, dh, w - dw, h),
        "tl": (dw, dh, w, h),
    }
    return im.crop(boxes[corner])


def crop_with_sips(path, corner, ratio, dest):
    import subprocess

    info = subprocess.check_output(
        ["sips", "-g", "pixelWidth", "-g", "pixelHeight", path], text=True
    )
    w = h = 0
    for line in info.splitlines():
        if "pixelWidth" in line:
            w = int(line.split()[-1])
        if "pixelHeight" in line:
            h = int(line.split()[-1])
    if w < 2 or h < 2:
        raise SystemExit(f"无法读取图片尺寸: {path}")
    dw = max(1, int(w * ratio))
    dh = max(1, int(h * ratio))
    nw, nh = w - dw, h - dh
    offsets = {
        "br": (0, 0),
        "bl": (0, dw),
        "tr": (dh, 0),
        "tl": (dh, dw),
    }
    oy, ox = offsets[corner]
    cmd = [
        "sips",
        "--cropOffset",
        str(oy),
        str(ox),
        "--cropToHeightWidth",
        str(nh),
        str(nw),
        path,
        "--out",
        dest,
    ]
    subprocess.check_call(cmd)


def main():
    p = argparse.ArgumentParser(description="裁掉图片某一角的小块区域")
    p.add_argument("image")
    p.add_argument("--corner", choices=sorted(CORNERS), default="br")
    p.add_argument("--ratio", type=float, default=0.08, help="该角裁掉的宽高比例，默认 0.08")
    p.add_argument("-o", "--output", default="", help="默认覆盖原图")
    args = p.parse_args()
    if not 0.02 <= args.ratio <= 0.25:
        raise SystemExit("--ratio 需在 0.02 到 0.25 之间")
    try:
        from PIL import Image
    except ImportError:
        Image = None
    if Image is not None:
        im = Image.open(args.image)
        out = crop(im, args.corner, args.ratio)
        dest = args.output or args.image
        out.save(dest)
    else:
        dest = args.output or args.image
        try:
            crop_with_sips(args.image, args.corner, args.ratio, dest)
        except FileNotFoundError:
            raise SystemExit("需要 Pillow（python3 -m pip install pillow）或 macOS 自带的 sips")
    print(f"已裁 {CORNERS[args.corner]} {args.ratio:.0%} → {dest}")
    print("请重新打开图片确认水印已消失、主体完整，再跑 verify-assets.sh --ok")


if __name__ == "__main__":
    main()
