#!/usr/bin/env python3
"""bbox-walls: draw a walls-first layout as labelled boxes (rooms tinted, wall lines by id, face rows dark, doors green, items boxed).
  python3 draw_layout.py <layout.json> <stats.json (RUN.json or check)> <out.png>"""
import json, sys, re, colorsys
from PIL import Image, ImageDraw, ImageFont
L = json.load(open(sys.argv[1])); st = json.load(open(sys.argv[2])); st = st.get("stats") or st; out = sys.argv[3]
C = 32; W, H = st["w"], st["h"]; plan, wg, rg = st["plan"], st["wallGrid"], st["roomGrid"]
CH = "0123456789abcdefghijklmnopqrstuvwxyz"
try: F = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 10); FB = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 12)
except Exception: F = FB = ImageFont.load_default()
def col(i, s=0.55, v=0.9, a=255):
    r, g, b = colorsys.hsv_to_rgb((i * 0.161 + 0.05) % 1, s, v); return (int(r * 255), int(g * 255), int(b * 255), a)
im = Image.new("RGB", (W * C, H * C), (14, 14, 18)); d = ImageDraw.Draw(im, "RGBA")
for y in range(H):
    for x in range(W):
        bx = [x * C, y * C, x * C + C - 1, y * C + C - 1]
        if wg[y][x] != ".":
            k = CH.index(wg[y][x]); d.rectangle(bx, fill=(70, 70, 80) if k == 0 else col(k, 0.6, 0.55))
            if plan[y][x] == ".": d.rectangle(bx, fill=(90, 230, 110, 200))   # door carved
        elif rg[y][x] != ".":
            k = CH.index(rg[y][x]); d.rectangle(bx, fill=col(k + 3, 0.35, 0.45))
            face = (y >= 1 and plan[y - 1][x] == "#") or (y >= 2 and plan[y - 2][x] == "#" and plan[y - 1][x] == ".")
            if face and plan[y][x] == ".": d.rectangle(bx, fill=(0, 0, 0, 110))
# wall labels at path midpoints
for i, w in enumerate([dict(L.get("outer_wall", {}), id="outer")] + L.get("walls", [])):
    p = w.get("path") or []
    if len(p) >= 2:
        a, b = p[0], p[1]; mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        d.text((mx * C + 2, my * C + 2), w["id"], fill=(255, 255, 255), font=F)
for r in L.get("rooms", []):
    x, y = r["at"]; d.text((x * C + 2, y * C + 8), f"{r['id']} ({r.get('floor')})", fill=(255, 240, 160), font=FB)
e = L.get("entrance")
if e: d.rectangle([e["x"] * C, e["y"] * C, e["x"] * C + C - 1, e["y"] * C + C - 1], fill=(80, 255, 80)); d.text((e["x"] * C + 6, e["y"] * C + 8), "IN", fill=(0, 0, 0), font=FB)
for c in L.get("carpets", []):
    d.rectangle([c["x"] * C, c["y"] * C, (c["x"] + c["w"]) * C - 1, (c["y"] + c["h"]) * C - 1], outline=(230, 90, 90), width=2)
for r in L.get("rails", []):
    p = r.get("path") or []
    for a, b in zip(p, p[1:]): d.line([(a[0] * C + C // 2, a[1] * C + C // 2), (b[0] * C + C // 2, b[1] * C + C // 2)], fill=(200, 200, 230), width=5)
spec = json.load(open("src/assets/handInteriorSpec.json"))["objects"]
items = [dict(o, _w=1) for o in L.get("wall_items", [])] + L.get("objects", []) + [dict(id=dd["piece"], x=dd["x"], y=dd["y"]) for dd in L.get("doors", []) if dd.get("piece")]
for o in items:
    rp = o.get("repeat") or {}; n = rp.get("count", 1)
    s = spec.get(o["id"]); m = re.match(r"^([a-z]+) (\d+)x(\d+)$", o["id"])
    w, h = (s["w"], max(1, s["h"])) if s else ((int(m[2]), int(m[3])) if m else (1, 1))
    for k in range(max(1, n)):
        x, y = (o["x"] + k * rp.get("dx", 0)) * C, (o["y"] + k * rp.get("dy", 0)) * C
        wall = o.get("_w")
        d.rectangle([x + 1, y + 1, x + w * C - 2, y + h * C - 2], fill=(255, 190, 60, 120) if wall else (90, 170, 255, 90), outline=(255, 210, 90) if wall else (140, 200, 255), width=2 if wall else 1)
        d.text((x + 3, y + 3), o["id"][:max(5, w * 6)], fill=(255, 255, 255), font=F)
for gx in range(W + 1): d.line([(gx * C, 0), (gx * C, H * C)], fill=(255, 255, 255, 22))
for gy in range(H + 1): d.line([(0, gy * C), (W * C, gy * C)], fill=(255, 255, 255, 22))
im.save(out)
