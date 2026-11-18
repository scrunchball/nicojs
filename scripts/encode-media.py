#!/usr/bin/env python3
"""Responsive variants + a tiny blurred preview for every image in content/media.json.

For each image public/media/<folder>/<id>.jpg (the master, 2560px wide recommended):
  <id>-960.webp, <id>-1600.webp, <id>-2560.webp   (only sizes up to the master's width)
and an inline preview (24px wide WebP, base64) shown while the picture loads.
Writes content/media-variants.json, read by content/site.ts. Run after adding or replacing frames:
  python3 scripts/encode-media.py
"""
import base64, io, json, os
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAN = json.load(open(os.path.join(ROOT, "content", "media.json")))
WIDTHS = [960, 1600, 2560]
out = {}
for folder, f in MAN["folders"].items():
    for s in f["shots"]:
        if s["kind"] != "image":
            continue
        src = os.path.join(ROOT, "public", "media", folder, s["id"] + ".jpg")
        if not os.path.exists(src):
            print("missing", src); continue
        im = Image.open(src).convert("RGB")  # graded sRGB, kept as is (no filters, no grain)
        widths = [w for w in WIDTHS if w <= im.width] or [im.width]
        if im.width > widths[-1] and widths[-1] != im.width and im.width < WIDTHS[-1]:
            widths.append(im.width)
        for w in widths:
            h = round(im.height * w / im.width)
            im.resize((w, h), Image.LANCZOS).save(src[:-4] + f"-{w}.webp", "WEBP", quality=86, method=6)
        tiny = im.resize((24, max(1, round(im.height * 24 / im.width))), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.6))
        buf = io.BytesIO(); tiny.save(buf, "WEBP", quality=40)
        out[f"{folder}/{s['id']}"] = {"w": widths, "lqip": "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()}
        print("ok", folder, s["id"], widths)
json.dump(out, open(os.path.join(ROOT, "content", "media-variants.json"), "w"), indent=1)
