#!/usr/bin/env python3
"""Preview a map PNG under its defaultLighting (ambient darkness + colour, light sources as warm glows) and write a
thumbnail. usage: night-preview.py <full.png> <thumb.png> <lighting-json or ''>"""
import json, sys
from PIL import Image, ImageDraw, ImageFilter

full, thumb, light = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(full).convert("RGBA")
if light:
    L = json.loads(light)
    c = tuple(int(L.get("color", "#000000").lstrip("#")[k:k + 2], 16) for k in (0, 2, 4))
    dark = int(255 * (1 - L["ambient"]))
    mask = Image.new("L", im.size, dark)
    d = ImageDraw.Draw(mask)
    for s in L.get("sources", []):
        x, y = s["at"]["x"] * 16 + 8, s["at"]["y"] * 16 + 8
        r = s["radius"] * 16
        for k in range(8, 0, -1):
            rr = r * k / 8
            d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=int(dark * (k / 8) ** 1.5))
    mask = mask.filter(ImageFilter.GaussianBlur(6))
    ov = Image.new("RGBA", im.size, c + (0,))
    ov.putalpha(mask)
    night = Image.alpha_composite(im, ov)
    glow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    for s in L.get("sources", []):
        x, y = s["at"]["x"] * 16 + 8, s["at"]["y"] * 16 + 8
        r = s["radius"] * 8
        col = tuple(int(s.get("color", "#ffd080").lstrip("#")[k:k + 2], 16) for k in (0, 2, 4))
        g.ellipse((x - r, y - r, x + r, y + r), fill=col + (40,))
    night = Image.alpha_composite(night, glow.filter(ImageFilter.GaussianBlur(8)))
    night.save(full.replace(".png", "-night.png"))
    im = night
k = min(1, 640 / max(im.size))
im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS if k < 1 else Image.NEAREST).convert("RGB").save(thumb, optimize=True)
