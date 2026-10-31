#!/usr/bin/env python3
"""bbox-village: draw a layout JSON as labelled boxes over the terrain levels. python3 draw_layout.py <layout.json> <terrain.json> <catalog.json> <out.png>"""
import json, sys
from PIL import Image, ImageDraw, ImageFont
L = json.load(open(sys.argv[1])); T = json.load(open(sys.argv[2])); K = json.load(open(sys.argv[3]))["kits"]; out = sys.argv[4]
W, H, C = T["W"], T["H"], 14
F = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 9); FB = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 12)
im = Image.new("RGB", (W * C, H * C)); d = ImageDraw.Draw(im, "RGBA")
for y in range(H):
    for x in range(W):
        i = y * W + x; w = T["water"][i]; v = T["levels"][i]
        col = (40, 70, 120) if w else (45 + v * 12, 60 + v * 14, 45 + v * 6)
        d.rectangle([x * C, y * C, x * C + C - 1, y * C + C - 1], fill=col)
        if not w and x + 1 < W and not T["water"][i + 1] and T["levels"][i + 1] != v: d.line([(x * C + C, y * C), (x * C + C, y * C + C)], fill=(0, 0, 0), width=2)
        if not w and y + 1 < H and not T["water"][i + W] and T["levels"][i + W] != v: d.line([(x * C, y * C + C), (x * C + C, y * C + C)], fill=(0, 0, 0), width=2)
R = lambda r, **kw: d.rectangle([r["x"] * C, r["y"] * C, (r["x"] + r["w"]) * C - 1, (r["y"] + r["h"]) * C - 1], **kw)
for f in L.get("forests", []): R(f, fill=(20, 90, 30, 200))
for f in L.get("fields", []): R(f, fill=(220, 190, 60, 170)); d.text((f["x"] * C + 2, f["y"] * C + 2), f.get("crop", ""), fill=(0, 0, 0), font=F)
for rd in L.get("roads", []):
    col = {"main": (200, 200, 200, 230), "lane": (170, 170, 170, 220), "track": (200, 160, 100, 220), "pier": (140, 90, 40, 230)}.get(rd.get("kind"), (255, 0, 255, 200))
    for r in rd.get("rects", []): R(r, fill=col)
for p in L.get("plazas", []): R(p, fill=(230, 220, 200, 230), outline=(120, 100, 80))
for s in L.get("stairs", []): R(s, fill=(255, 140, 0, 240)); d.text((s["x"] * C + 1, s["y"] * C + 1), "S" + ("^" if s.get("dir") == "north" else "v"), fill=(0, 0, 0), font=FB)
for f in L.get("fences", []):
    R(f, outline=(110, 60, 20), width=3); g = f.get("gate")
    if isinstance(g, list): d.rectangle([g[0] * C, g[1] * C, g[0] * C + C - 1, g[1] * C + C - 1], fill=(255, 255, 255, 200))
for grp, col in (("trees", (60, 200, 80)), ("props", (120, 200, 255)), ("buildings", (255, 90, 90))):
    for o in L.get(grp, []):
        k = K.get(o.get("id")); w, h = (k["w"], k["h"]) if k else (1, 1)
        r = {"x": o["x"], "y": o["y"], "w": w, "h": h}
        R(r, fill=col + ((150,) if grp == "buildings" else (90,)), outline=col, width=2 if grp == "buildings" else 1)
        if grp == "buildings":
            if k and k.get("door"): fx, fy = o["x"] + k["door"]["dx"], o["y"] + k["door"]["dy"] + 1; d.rectangle([fx * C + 3, fy * C + 3, fx * C + C - 4, fy * C + C - 4], fill=(255, 255, 0))
            nm = o["id"].replace("bd-house-", "").replace("mk-", "")
            d.text((o["x"] * C + 2, o["y"] * C + 2), nm[: max(4, w * 2)], fill=(255, 255, 255), font=F)
            if o.get("purpose"): d.text((o["x"] * C + 2, o["y"] * C + 12), str(o["purpose"])[: max(4, w * 2)], fill=(255, 230, 200), font=F)
for z in L.get("zones", []):
    R(z, outline=(255, 255, 255, 220), width=2); d.text((z["x"] * C + 3, (z["y"] + z["h"]) * C - 15), z.get("name", ""), fill=(255, 255, 255), font=FB)
for g in range(0, W + 1, 5): d.line([(g * C, 0), (g * C, H * C)], fill=(255, 255, 255, 40))
for g in range(0, H + 1, 5): d.line([(0, g * C), (W * C, g * C)], fill=(255, 255, 255, 40))
im.save(out)
