"""QA overlay for atlas dungeon renders: cell grid, coordinates every 5 cells, entry (green), targets (red; blocked =
magenta X), exits (cyan), stranded floor (yellow dots). Usage:
  python3 scripts/content/atlas-dungeons/debug-overlay.py <catalog.json> <validation.json> <renderDir> <outDir> [ids…]"""
import json
import os
import sys
from PIL import Image, ImageDraw

cat, val, rdir, odir = sys.argv[1:5]
only = set(sys.argv[5:])
c = json.load(open(cat))
v = {r["id"]: r for r in json.load(open(val))}
os.makedirs(odir, exist_ok=True)
for mid, m in c["maps"].items():
    if only and mid not in only:
        continue
    im = Image.open(f"{rdir}/{mid}.png").convert("RGBA")
    s = 2
    im = im.resize((im.width * s, im.height * s), Image.NEAREST)
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    C = 16 * s
    for x in range(m["width"] + 1):
        d.line((x * C, 0, x * C, im.height), fill=(255, 255, 255, 40 if x % 5 else 110))
    for y in range(m["height"] + 1):
        d.line((0, y * C, im.width, y * C), fill=(255, 255, 255, 40 if y % 5 else 110))
    for x in range(0, m["width"], 5):
        for y in range(0, m["height"], 5):
            d.text((x * C + 2, y * C + 1), f"{x},{y}", fill=(255, 255, 0, 230))
    r = v.get(mid, {})

    def box(p, col, w=3):
        d.rectangle((p[0] * C, p[1] * C, p[0] * C + C - 1, p[1] * C + C - 1), outline=col, width=w)

    for t in r.get("targets", []):
        box(t, (255, 40, 40, 255))
    for e in r.get("exits", []):
        box(e["at"], (40, 230, 255, 255))
    box(r.get("entry", [0, 0]), (40, 255, 60, 255), 4)
    for b in r.get("blocked", []):
        d.line((b[0] * C, b[1] * C, b[0] * C + C, b[1] * C + C), fill=(255, 0, 255, 255), width=4)
        d.line((b[0] * C + C, b[1] * C, b[0] * C, b[1] * C + C), fill=(255, 0, 255, 255), width=4)
    e = r.get("emptiness", {})
    if e.get("win") and e.get("screen", 0) > 0.4:
        wx, wy = e["win"]
        d.rectangle((wx * C, wy * C, (wx + 17) * C - 1, (wy + 13) * C - 1), outline=(255, 140, 0, 255), width=3)
    if e.get("at") and e.get("maxSq", 0) > 4:
        ax, ay = e["at"]
        d.rectangle((ax * C, ay * C, (ax + e["maxSq"]) * C - 1, (ay + e["maxSq"]) * C - 1), outline=(255, 60, 200, 255), width=3)
    for sx, sy in r.get("stranded", []):
        d.ellipse((sx * C + C / 2 - 4, sy * C + C / 2 - 4, sx * C + C / 2 + 4, sy * C + C / 2 + 4), fill=(255, 230, 0, 255))
    im.alpha_composite(ov)
    im.save(f"{odir}/{mid}.png")
    print(mid, "blocked", r.get("blocked"), "stranded", len(r.get("stranded", [])), "empty", r.get("emptiness"), "warn", len(r.get("warnings", [])))
