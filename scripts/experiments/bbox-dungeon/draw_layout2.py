#!/usr/bin/env python3
"""bbox-dungeon round 2: draw the rasterised mask (mask.json + stamped.json) — rooms by purpose, corridors, hazards, ledges, stairs, pieces.
  python3 draw_layout2.py <run dir> <out.png>"""
import json, sys
from PIL import Image, ImageDraw
G, out = sys.argv[1], sys.argv[2]
M = json.load(open(f"{G}/mask.json")); st = json.load(open(f"{G}/stamped.json"))
W, H = M["W"], M["H"]; C = 12
PC = {"entrance": (90, 220, 120), "guard": (230, 160, 70), "puzzle": (90, 170, 255), "treasure": (255, 215, 60), "antechamber": (200, 110, 230), "boss": (240, 70, 70), "other": (160, 160, 160)}
HC = {1: (60, 140, 255), 2: (255, 90, 30), 3: (10, 10, 10)}
im = Image.new("RGB", (W * C, H * C), (30, 30, 36)); d = ImageDraw.Draw(im, "RGBA")
for i, o in enumerate(M["owner"]):
    if o < 0: continue
    x, y = i % W, i // W; r = M["regions"][o]
    col = PC.get(r.get("purpose"), (150, 150, 160)) if r["kind"] == "room" else (120, 120, 135)
    if M["liq"][i] and not M["bridge"][i]: col = HC[M["liq"][i]]
    if M["bridge"][i]: col = (170, 120, 70)
    if M["levels"][i]: col = tuple(min(255, int(c * 1.25 + 30)) for c in col)
    d.rectangle([x * C, y * C, x * C + C - 1, y * C + C - 1], fill=col)
    if M["ramps"][i]: d.rectangle([x * C + 2, y * C + 2, x * C + C - 3, y * C + C - 3], fill=(255, 255, 255))
for p in st:
    col = (255, 255, 255) if p["cls"] == "wall" else (20, 20, 20)
    d.rectangle([p["x"] * C, p["y"] * C, (p["x"] + p["w"]) * C - 1, (p["y"] + p["h"]) * C - 1], outline=col)
im.save(out)
