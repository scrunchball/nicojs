#!/usr/bin/env python3
"""PLACEHOLDER media for every slot in content/media.json. Run once; real files replace these by name.
Images: soft abstract compositions in each film's palette, with the filename small in the corner.
Clips: 8 s of slowly drifting light, encoded exactly like the real ones will be:
  <id>.mp4        loop encode, 1280 wide (autoplay loops)
  <id>-scrub.mp4  all-intra, 960 wide, 24 fps, no audio (frame-accurate scroll scrubbing, Stage 5)
  <id>.jpg        poster = first frame
Usage: python3 scripts/make-placeholders.py [--force]
"""
import json, os, random, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAN = json.load(open(os.path.join(ROOT, "content", "media.json")))
FORCE = "--force" in sys.argv
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def image(path, size, pal, seed, label):
    w, h = size
    rnd = random.Random(seed)
    im = Image.new("RGB", (w, h))
    top, mid, low = pal
    horizon = rnd.uniform(0.45, 0.7)
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / h
        c = lerp(mid, top, t / horizon) if t < horizon else lerp(top, low, (t - horizon) / (1 - horizon))
        d.line([(0, y), (w, y)], fill=c)
    layer = Image.new("RGB", (w, h), (0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for _ in range(rnd.randint(2, 4)):  # soft lights and masses
        cx, cy = rnd.uniform(0.15, 0.85) * w, rnd.uniform(0.2, 0.8) * h
        r = rnd.uniform(0.06, 0.22) * w
        bright = rnd.random() < 0.5
        col = lerp(top, (255, 240, 210), 0.5) if bright else lerp(low, (0, 0, 0), 0.4)
        ld.ellipse([cx - r, cy - r * rnd.uniform(0.6, 1.4), cx + r, cy + r * rnd.uniform(0.6, 1.4)], fill=col)
    layer = layer.filter(ImageFilter.GaussianBlur(w * 0.04))
    mask = layer.convert("L").point(lambda v: min(255, v * 2 + 40))
    im = Image.composite(layer, im, mask.point(lambda v: int(v * 0.55)))
    d = ImageDraw.Draw(im)
    fs = max(14, w // 110)
    d.text((fs * 1.5, h - fs * 2.5), f"PLACEHOLDER · {label}", font=ImageFont.truetype(FONT, fs), fill=lerp(low, (255, 255, 255), 0.35))
    im.save(path, "JPEG", quality=84, optimize=True, progressive=True)

def clip(base, size, pal, label):
    w, h = size
    h -= h % 2
    c = ["0x%02x%02x%02x" % tuple(p) for p in pal]
    src = f"gradients=s={w}x{h}:c0={c[0]}:c1={c[1]}:c2={c[2]}:nb_colors=3:speed=0.012:duration=8:rate=24:type=radial:seed=7"
    loop = base + ".mp4"; scrub = base + "-scrub.mp4"; poster = base + ".jpg"
    run = lambda *a: subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *a], check=True)
    run("-f", "lavfi", "-i", src, "-vf", "scale=1280:-2,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "24",
        "-movflags", "+faststart", "-an", loop)
    run("-f", "lavfi", "-i", src, "-vf", "scale=960:-2,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "26",
        "-g", "1", "-keyint_min", "1", "-sc_threshold", "0", "-r", "24", "-movflags", "+faststart", "-an", scrub)
    tmp = base + "-poster.png"
    run("-i", loop, "-frames:v", "1", tmp)
    im = Image.open(tmp).convert("RGB").resize((w, h))
    fs = max(14, w // 110)
    ImageDraw.Draw(im).text((fs * 1.5, h - fs * 2.5), f"PLACEHOLDER · {label}", font=ImageFont.truetype(FONT, fs), fill=(200, 200, 200))
    im.save(poster, "JPEG", quality=84, optimize=True, progressive=True)
    os.remove(tmp)

def movie(base, pal, label, seconds, titled):
    c = ["0x%02x%02x%02x" % tuple(p) for p in pal]
    src = f"gradients=s=1280x720:c0={c[0]}:c1={c[1]}:c2={c[2]}:nb_colors=3:speed=0.015:duration={seconds}:rate=24:type=radial:seed=11"
    vf = "format=yuv420p"
    if titled:
        vf = ("drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='PLACEHOLDER FILM  %{pts\\:hms}':"
              "fontcolor=white@0.75:fontsize=26:x=(w-text_w)/2:y=h-80," + vf)
    run = lambda *a: subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *a], check=True)
    if titled:  # a quiet tone so the player's sound controls have something to control
        run("-f", "lavfi", "-i", src, "-f", "lavfi", "-i", f"sine=frequency=220:duration={seconds}", "-vf", vf,
            "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-c:a", "aac", "-b:a", "64k", "-af", "volume=0.08",
            "-shortest", "-movflags", "+faststart", base + ".mp4")
    else:
        run("-f", "lavfi", "-i", src, "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-an", "-movflags", "+faststart", base + ".mp4")
    tmp = base + "-poster.png"
    run("-i", base + ".mp4", "-frames:v", "1", tmp)
    im = Image.open(tmp).convert("RGB")
    im.save(base + ".jpg", "JPEG", quality=84, optimize=True, progressive=True)
    os.remove(tmp)

for folder, f in MAN["folders"].items():
    out = os.path.join(ROOT, "public", "media", folder)
    os.makedirs(out, exist_ok=True)
    for i, s in enumerate(f["shots"]):
        size = s.get("size", f["size"])
        base = os.path.join(out, s["id"])
        if s["kind"] == "image":
            if FORCE or not os.path.exists(base + ".jpg"):
                image(base + ".jpg", size, f["palette"], hash(s["id"]) % 9999, s["id"] + ".jpg")
        elif s["kind"] == "clip":
            if FORCE or not os.path.exists(base + ".mp4"):
                clip(base, size, f["palette"], s["id"] + ".mp4")
        else:  # loop (background loop) or film (the player's source)
            if FORCE or not os.path.exists(base + ".mp4"):
                movie(base, f["palette"], s["id"] + ".mp4", 8 if s["kind"] == "loop" else 24, s["kind"] == "film")
        print("ok", folder, s["id"])
