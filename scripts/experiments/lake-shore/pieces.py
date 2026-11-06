#!/usr/bin/env python3
"""Natural lake shore: a 47-tile blob autotile (8-neighbour, corners only when both sides are water) for beodeul_city water
meeting grass or sand. Every pixel comes from the chipset itself: the land is the plain grass (737, every new beodeul map's ground) / floor-sand (26756) tile's own
pixel at that spot, the open water is the canal water body tile's (23152) own pixel, and the shore bands use colours sampled
from those tiles and the wet-sand tile (26759). No new colour, no generated image.

The shape: the 3x3 neighbourhood is drawn at 1 px per pixel (48x48, a neighbour corner counts as water only when both of its
sides do), box-blurred twice (radius 5) and the centre 16x16 thresholded into bands. All bands sit inside the water cell (the field is
0.5 on the cell border), because the land cell next to it is plain land the autotile never redraws. The blur rounds both the bays (dry
corners) and the points (wet corners), so a rectangle of water reads as a rounded pond.

  python3 pieces.py <chipset.png> <out dir>  -> tiles.json {mask: rgba}, variantMap.json (all 256 masks), sheet.png, lake.png
"""
import json, os, sys
from PIL import Image

N, E, S, Wd, NE, SE, SW, NW = 1, 2, 4, 8, 16, 32, 64, 128
PER = None

def tile(sheet, i):
    x, y = (i % PER) * 16, (i // PER) * 16
    return sheet.crop((x, y, x + 16, y + 16)).convert("RGB")

def normalize(m):
    for c, a, b in ((NE, N, E), (SE, S, E), (SW, S, Wd), (NW, N, Wd)):
        if not (m & a and m & b): m &= ~c
    return m

def field(m):
    cells = {(0, 0): 1, (0, -1): m & N, (1, 0): m & E, (0, 1): m & S, (-1, 0): m & Wd,
             (1, -1): m & NE, (1, 1): m & SE, (-1, 1): m & SW, (-1, -1): m & NW}
    g = [[1.0 if cells[((x // 16) - 1, (y // 16) - 1)] else 0.0 for x in range(48)] for y in range(48)]
    for _ in range(2):
        r = 5
        h = [[sum(g[y][max(0, x - r):x + r + 1]) / len(g[y][max(0, x - r):x + r + 1]) for x in range(48)] for y in range(48)]
        g = [[sum(h[yy][x] for yy in range(max(0, y - r), min(48, y + r + 1))) / (min(48, y + r + 1) - max(0, y - r)) for x in range(48)] for y in range(48)]
    return [[g[16 + y][16 + x] for x in range(16)] for y in range(16)]

def hsh(x, y, k):
    v = (x * 374761393 + y * 668265263 + k * 2147483647) & 0xFFFFFFFF
    v = ((v ^ (v >> 13)) * 1274126177) & 0xFFFFFFFF
    return (v ^ (v >> 16)) & 255

def draw(m, land, body, wet, rim, edge, shallow):
    f = field(m)
    im = Image.new("RGB", (16, 16)); px = im.load(); lp = land.load(); bp = body.load()
    for y in range(16):
        for x in range(16):
            v = f[y][x]
            j = (hsh(x, y, 9) / 255 - 0.5) * 0.04
            if v < 0.56 + j: c = lp[x, y]
            elif v < 0.62 + j: c = wet[hsh(x, y, 3) % len(wet)] if hsh(x, y, 11) < 200 else lp[x, y]   # damp grass / wet sand, broken
            elif v < 0.66: c = rim
            elif v < 0.74: c = shallow if hsh(x, y, 7) < 150 else edge[0]
            elif v < 0.84: c = edge[0] if hsh(x, y, 7) < 140 else bp[x, y]
            else: c = bp[x, y]
            px[x, y] = c
    return im

def main(chipset, out):
    global PER
    sheet = Image.open(chipset).convert("RGBA"); PER = sheet.width // 16
    os.makedirs(out, exist_ok=True)
    bodies = [tile(sheet, 23152 + f) for f in range(8)]   # the water body animates 8 frames; each shore tile follows it
    body = bodies[0]
    grass, sand, wetsand = tile(sheet, 737), tile(sheet, 26756), tile(sheet, 26759)   # 737 = the map's plain grass (defaultMaps.ts)
    pal = lambda im: [c for c, _ in sorted(((c, n) for c, n in __import__("collections").Counter(im.get_flattened_data()).items()), key=lambda t: -t[1])]
    bodyc = pal(body)
    edge = [bodyc[1]]   # the water body's own second (darker) tone: a soft wet edge, no bright teal line
    shallow = sorted((c for c in bodyc if c[2] > 90), key=lambda c: sum(c))[0]   # the body's dimmest teal: one soft shallow band
    gdark = min(pal(grass), key=lambda c: sum(c))                     # the plain grass's own darkest tone: damp grass at the waterline
    sets = {"grass": (grass, [gdark, pal(grass)[0]], gdark), "sand": (sand, pal(wetsand)[:2], pal(wetsand)[0])}
    masks = sorted({normalize(m) for m in range(256)})
    assert len(masks) == 47, len(masks)
    allowed = set().union(*(set(pal(b)) for b in bodies)) | set(pal(grass)) | set(pal(sand)) | set(pal(wetsand))
    data, sheets = {}, {}
    for name, (land, wet, rim) in sets.items():
        tiles = {m: draw(m, land, body, wet, rim, edge, shallow) for m in masks}
        bad = set().union(*(set(t.get_flattened_data()) for t in tiles.values())) - allowed
        if bad: raise SystemExit(f"colour outside the chipset: {sorted(bad)[:5]}")
        data[name] = {str(m): [v for p in t.get_flattened_data() for v in (*p, 255)] for m, t in tiles.items()}
        frames = {str(m): [[v for p in draw(m, land, b, wet, rim, edge, shallow).get_flattened_data() for v in (*p, 255)] for b in bodies] for m in masks}
        data[name + "@frames"] = frames
        sh = Image.new("RGB", (12 * 18, 4 * 18), (24, 24, 30))
        for k, m in enumerate(masks): sh.paste(tiles[m], ((k % 12) * 18 + 1, (k // 12) * 18 + 1))
        sheets[name] = sh.resize((sh.width * 5, sh.height * 5), Image.NEAREST)
        sheets[name].save(f"{out}/sheet-{name}.png")
        # a pond on its own land: rounded rectangle plus a bay and a spit, to show corners in place
        Wm, Hm = 14, 10
        wetmap = [[False] * Wm for _ in range(Hm)]
        for yy in range(2, 8):
            for xx in range(2, 12): wetmap[yy][xx] = True
        wetmap[2][2] = wetmap[2][11] = wetmap[7][2] = False; wetmap[5][11] = wetmap[6][11] = False; wetmap[8][5] = wetmap[8][6] = True; wetmap[1][8] = True
        lake = Image.new("RGB", (Wm * 16, Hm * 16))
        at = lambda xx, yy: 0 <= xx < Wm and 0 <= yy < Hm and wetmap[yy][xx]
        for yy in range(Hm):
            for xx in range(Wm):
                if not wetmap[yy][xx]: lake.paste(land, (xx * 16, yy * 16)); continue
                m = (N * at(xx, yy - 1)) | (E * at(xx + 1, yy)) | (S * at(xx, yy + 1)) | (Wd * at(xx - 1, yy)) | (NE * at(xx + 1, yy - 1)) | (SE * at(xx + 1, yy + 1)) | (SW * at(xx - 1, yy + 1)) | (NW * at(xx - 1, yy - 1))
                lake.paste(tiles[normalize(m)], (xx * 16, yy * 16))
        lake.resize((lake.width * 4, lake.height * 4), Image.NEAREST).save(f"{out}/lake-{name}.png")
    json.dump(data, open(f"{out}/tiles.json", "w"))
    json.dump({str(m): normalize(m) for m in range(256)}, open(f"{out}/variantMap.json", "w"))
    print("47 masks x", len(sets), "->", out)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
