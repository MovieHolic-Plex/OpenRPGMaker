#!/usr/bin/env python3
"""bbox-room-test: draw a layout JSON as labelled boxes on a cell grid (same 16px scale as the map render, then x2).
  python3 draw_layout.py <layout.json> <out.png> <raw pieces.json>"""
import json, sys, colorsys
from PIL import Image, ImageDraw, ImageFont
L = json.load(open(sys.argv[1])); out = sys.argv[2]
T, K = 16, 2; C = T * K
W, H = L["map"]["w"], L["map"]["h"]
try: F = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 10); FB = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 12)
except Exception: F = FB = ImageFont.load_default()
im = Image.new("RGB", (W * C, H * C), (22, 22, 28)); d = ImageDraw.Draw(im, "RGBA")
def col(i, a=255):
    r, g, b = colorsys.hsv_to_rgb((i * 0.17) % 1, 0.55, 0.9); return (int(r * 255), int(g * 255), int(b * 255), a)
for i, r in enumerate(L.get("regions", [])):
    x, y, w, h = r["x"] * C, r["y"] * C, r["w"] * C, r["h"] * C
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=col(i, 55), outline=col(i), width=2)
    d.rectangle([x, y, x + w - 1, y + 2 * C - 1], fill=(0, 0, 0, 70))   # wall-face rows
    d.text((x + 4, y + h - 16), f"{r.get('id','')}: {r.get('floor')}/{r.get('wall')}", fill=col(i), font=FB)
for i, r in enumerate(L.get("grounds", [])):
    x, y, w, h = r["x"] * C, r["y"] * C, r["w"] * C, r["h"] * C
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=col(i + 3, 45), outline=col(i + 3), width=2)
    d.text((x + 4, y + h - 16), f"ground {r.get('id')}", fill=col(i + 3), font=FB)
for o in L.get("openings", []):
    d.rectangle([o["x"] * C, o["y"] * C, (o["x"] + o.get("w", 1)) * C - 1, (o["y"] + o.get("h", 1)) * C - 1], fill=(120, 220, 120, 140))
e = L.get("entrance")
if e: d.rectangle([e["x"] * C, e["y"] * C, (e["x"] + 1) * C - 1, (e["y"] + 1) * C - 1], fill=(80, 255, 80, 220)); d.text((e["x"] * C + 2, e["y"] * C + 8), "IN", fill=(0, 0, 0), font=FB)
for c in L.get("carpets", []) + L.get("daises", []):
    d.rectangle([c["x"] * C, c["y"] * C, (c["x"] + c["w"]) * C - 1, (c["y"] + c["h"]) * C - 1], fill=(200, 60, 60, 60), outline=(230, 90, 90, 200))
    d.text((c["x"] * C + 2, (c["y"] + c["h"]) * C - 12), c["id"], fill=(255, 150, 150), font=F)
spec = {o["id"]: o for o in json.load(open(sys.argv[3]))["objects"]}
import re
objs = ([dict(L["landmark"], _lm=1)] if L.get("landmark") else []) + L.get("objects", [])
for o in objs:
    n = (o.get("repeat") or {}).get("count", 1); dx = (o.get("repeat") or {}).get("dx", 0); dy = (o.get("repeat") or {}).get("dy", 0)
    s = spec.get(o["id"]); m = re.match(r"^([a-z][a-z0-9-]*) (\d+)x(\d+)$", o["id"])
    w, h = (s["w"], max(1, s["h"])) if s else ((int(m[2]), int(m[3])) if m else (1, 1))
    for k in range(max(1, n)):
        x, y = (o["x"] + k * dx) * C, (o["y"] + k * dy) * C
        lm = o.get("_lm")
        d.rectangle([x + 1, y + 1, x + w * C - 2, y + h * C - 2], fill=(255, 210, 60, 110) if lm else (90, 170, 255, 80), outline=(255, 220, 80) if lm else (140, 200, 255), width=2 if lm else 1)
        d.text((x + 3, y + 3), o["id"][:max(4, w * 6)], fill=(255, 255, 255), font=F)
for gx in range(W + 1): d.line([(gx * C, 0), (gx * C, H * C)], fill=(255, 255, 255, 25))
for gy in range(H + 1): d.line([(0, gy * C), (W * C, gy * C)], fill=(255, 255, 255, 25))
im.save(out)
