#!/usr/bin/env python3
"""label the kit sheet: 2x, id under each kit, grid every cell. python3 sheet.py <out dir>"""
import json, sys
from PIL import Image, ImageDraw, ImageFont
o = sys.argv[1]; S = json.load(open(f"{o}/sheet.json")); K = 2; C = 16 * K
im = Image.open(f"{o}/sheet-raw.png").convert("RGB"); im = im.resize((im.width * K, im.height * K), Image.NEAREST)
d = ImageDraw.Draw(im, "RGBA"); F = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 11)
for q in S["pos"]:
    x, y, w, h = q["x"] * C, q["y"] * C, q["w"] * C, q["h"] * C
    d.rectangle([x, y, x + w - 1, y + h - 1], outline=(255, 255, 0, 200))
    for gx in range(1, q["w"]): d.line([(x + gx * C, y), (x + gx * C, y + h)], fill=(255, 255, 0, 50))
    for gy in range(1, q["h"]): d.line([(x, y + gy * C), (x + w, y + gy * C)], fill=(255, 255, 0, 50))
    t = q["id"].replace("bd-house-", "").replace("bd-pick-", "").replace("bd-prop-", "")
    lab = f"{q['id']} {q['w']}x{q['h']}"
    tw = d.textlength(lab, font=F); d.rectangle([x, y + h + 1, x + tw + 4, y + h + 15], fill=(0, 0, 0, 200)); d.text((x + 2, y + h + 2), lab, fill=(255, 255, 255), font=F)
im.save(f"{o}/sheet.png"); print(im.size)
