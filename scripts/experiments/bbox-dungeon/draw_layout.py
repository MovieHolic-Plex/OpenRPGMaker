#!/usr/bin/env python3
"""bbox-dungeon: draw a layout JSON as labelled boxes (16px cells ×2).  python3 draw_layout.py <layout.json> <palette.json> <out.png>"""
import json, sys, colorsys
from PIL import Image, ImageDraw, ImageFont
L = json.load(open(sys.argv[1])); SZ = {b["name"]: (b["w"], b["h"]) for b in json.load(open(sys.argv[2]))}; out = sys.argv[3]
C = 32; W, H = L["map"]["w"], L["map"]["h"]
F = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 10); FB = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 13)
im = Image.new("RGB", (W * C, H * C), (22, 22, 28)); d = ImageDraw.Draw(im, "RGBA")
PC = {"entrance": (90, 220, 120), "guard": (230, 160, 70), "puzzle": (90, 170, 255), "treasure": (255, 215, 60), "antechamber": (200, 110, 230), "boss": (240, 70, 70), "other": (160, 160, 160)}
box = lambda x, y, w, h, **k: d.rectangle([x * C, y * C, (x + w) * C - 1, (y + h) * C - 1], **k)
for c in L.get("corridors", []):
    w = c.get("width", 1); p = c.get("path", [])
    for a, b in zip(p, p[1:]):
        x0, y0, x1, y1 = min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1])
        box(x0, y0, x1 - x0 + w, y1 - y0 + w, fill=(120, 120, 140, 110))
for r in L.get("rooms", []):
    col = PC.get(r.get("purpose"), (160, 160, 160))
    for q in r.get("rects", [r]):
        box(q["x"], q["y"], q["w"], q["h"], fill=col + (60,), outline=col + (255,), width=2)
        box(q["x"], q["y"] - 3, q["w"], 3, fill=(0, 0, 0, 0), outline=(90, 90, 90, 120))
    q = r.get("rects", [r])[0]
    d.text((q["x"] * C + 4, (q["y"] + q["h"]) * C - 18), f"{r['id']} [{r.get('purpose')}]", fill=col, font=FB)
HC = {"water": (60, 140, 255, 150), "lava": (255, 90, 30, 170), "pit": (0, 0, 0, 220)}
for h in L.get("hazards", []): box(h["x"], h["y"], h.get("w", 1), h.get("h", 1), fill=HC.get(h["kind"], (255, 0, 255, 120)))
for b in L.get("bridges", []): box(b["x"], b["y"], b.get("w", 1), b.get("h", 1), fill=(170, 120, 70, 200))
objs = [dict(r["landmark"], _lm=1) for r in L.get("rooms", []) if r.get("landmark")] + L.get("objects", []) + [dict(t, _tr=1) for t in L.get("traps", [])]
for o in objs:
    rp = o.get("repeat") or {}; w, h = SZ.get(o.get("id"), (1, 1))
    for k in range(max(1, rp.get("count", 1))):
        x, y = o["x"] + k * rp.get("dx", 0), o["y"] + k * rp.get("dy", 0)
        col = (255, 220, 80) if o.get("_lm") else (255, 80, 200) if o.get("_tr") else (140, 200, 255)
        box(x, y, w, h, fill=col + (70,), outline=col + (255,), width=2 if o.get("_lm") else 1)
        d.text((x * C + 2, y * C + 2), str(o.get("id"))[:max(5, w * 6)], fill=(255, 255, 255), font=F)
for c in L.get("chests", []): box(c["x"], c["y"], 1, 1, fill=(200, 140, 40, 230)); d.text((c["x"] * C + 3, c["y"] * C + 8), "chest", fill=(0, 0, 0), font=F)
for dr in L.get("doors", []):
    box(dr["x"], dr["y"], 1, 1, outline=(255, 60, 60) if dr.get("locked") else (80, 255, 80), width=3)
    if dr.get("locked"): d.text((dr["x"] * C + 2, dr["y"] * C + 10), "LOCK", fill=(255, 90, 90), font=F)
for gx in range(W + 1): d.line([(gx * C, 0), (gx * C, H * C)], fill=(255, 255, 255, 22))
for gy in range(H + 1): d.line([(0, gy * C), (W * C, gy * C)], fill=(255, 255, 255, 22))
im.save(out)
