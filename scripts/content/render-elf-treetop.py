#!/usr/bin/env python3
"""Render the elf treetop village from the reloaded canonical export → tiledata/elf-treetop/images/elf-treetop-village.png.

Composes the forest_harmony sheet the way the app does (bundled image + tileGrafts, pink key where a graft says so) and
draws lower then upper, putting each lower tile's layerBacking under it (tileMeta.layerBacking, a tile number).
Usage: python3 scripts/content/render-elf-treetop.py output/evidence/elf-treetop/reloaded.json
"""
import json, os, re, sys
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
S, TPR = 16, 30
project = json.load(open(sys.argv[1]))
tex = {m.group(1): os.path.join(ROOT, "public", m.group(2)) for m in
       re.finditer(r'textureKey:\s*"([^"]+)",\s*path:\s*"([^"]+)"', open(os.path.join(ROOT, "src/assets/bundled.ts"), encoding="utf8").read())}

def keyed(path, colour):
    im = Image.open(path).convert("RGBA")
    if colour:
        rgb = tuple(int(colour[i:i + 2], 16) for i in (1, 3, 5)); px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                if px[x, y][:3] == rgb: px[x, y] = (0, 0, 0, 0)
    return im

def sheet_of(ts):
    base = keyed(tex[ts["image"]["id"]], ts.get("transparentColor"))
    rows = (ts["count"] + TPR - 1) // TPR
    sheet = Image.new("RGBA", (TPR * S, rows * S)); sheet.paste(base, (0, 0))
    cache = {}
    for g in ts.get("tileGrafts", []):
        k = (g["sourceChipset"], g.get("transparentColor"))
        if k not in cache: cache[k] = keyed(tex[k[0]], k[1])
        src = cache[k]; cols = src.width // S; t = g["sourceTile"]; tt = g["targetTile"]
        sheet.paste(src.crop(((t % cols) * S, (t // cols) * S, (t % cols + 1) * S, (t // cols + 1) * S)), ((tt % TPR) * S, (tt // TPR) * S))
    return sheet

for mid, m in project["maps"].items():
    ts = project["tilesets"][m["tilesetId"]]
    sheet = sheet_of(ts)
    tile = lambda t: sheet.crop(((t % TPR) * S, (t // TPR) * S, (t % TPR + 1) * S, (t // TPR + 1) * S))
    meta = ts.get("tileMeta", [])
    W, H = m["width"], m["height"]
    img = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 255))
    for layer, lower in ((m["lowerTiles"], True), (m["upperTiles"], False)):
        for i, t in enumerate(layer):
            if t < 0: continue
            x, y = (i % W) * S, (i // W) * S
            if lower:
                back = (meta[t] or {}).get("layerBacking") if t < len(meta) else None
                if isinstance(back, int) and back >= 0: img.alpha_composite(tile(back), (x, y))
            img.alpha_composite(tile(t), (x, y))
    os.makedirs(os.path.join(ROOT, "tiledata/elf-treetop/images"), exist_ok=True)
    out = os.path.join(ROOT, f"tiledata/elf-treetop/images/{mid}.png")
    img.convert("RGB").save(out)
    print(out, img.size)
