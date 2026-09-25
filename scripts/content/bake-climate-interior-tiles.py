#!/usr/bin/env python3
"""Climate interior tiles appended to the Tibo interior sheet (public/assets/tibo-interior/interior-expanded.png).

The desert, snow and volcano houses need walls the Tibo sheet does not have (sandstone, log, basalt). They are baked
from the sheet's own cells the way the climate village sheets were: each pixel keeps its luminance and takes a new
colour from a ramp, so the brick/plank pattern and the edge trims stay where the source had them.

Row 66 (tiles 1980..2009), 30 columns:
  1980 1981 1982 | 1983 1984 1985   log wall face   upper L M R | lower L M R   (drawn from the wood floor 72)
  1986 1987 1988 | 1989 1990 1991   sandstone face  upper L M R | lower L M R   (stone brick 134~136 / 164~166)
  1992 1993 1994 | 1995 1996 1997   basalt face     upper L M R | lower L M R   (purple brick 14~16 / 44~46)
  1998 basalt floor (grey cobble 42)   1999 sandstone floor (grey cobble 42)
  2000..2008 white fur rug nine-slice (straw mat 108 109 110 / 138 139 140 / 168 169 170)
  2009 unused
Row 67 (tiles 2010..2039), the barn: drawn here (straw, stall boards, hay heap) or cut from the EasyRPG animal charset.
  2010 2011 2012 straw litter on dirt 192, dense   2013 2014 2015 straw litter, sparse (stall edges, spill)
  2016 2017 2018 stall board partition north end | middle | south end post (upper layer, runs north-south)
  2019 2020 / 2021 2022 hay heap 2x2 (top row / bottom row)
  2023 2024 / 2025 2026 horse facing right 2x2   2027 2028 / 2029 2030 horse facing left 2x2
  2031 2032 / 2033 2034 cow facing right 2x2 (EasyRPG CharSet/Animal.png, standing frame, CC0)
  2035..2039 unused
Idempotent: the sheet is cut back to its first 66 rows before the rows are appended.
Usage: python3 scripts/content/bake-climate-interior-tiles.py
"""
from PIL import Image

SHEET = "public/assets/tibo-interior/interior-expanded.png"
BASE_ROWS = 66
im = Image.open(SHEET).convert("RGBA")
im = im.crop((0, 0, 480, BASE_ROWS * 16))


def cell(n):
    return im.crop(((n % 30) * 16, (n // 30) * 16, (n % 30) * 16 + 16, (n // 30) * 16 + 16))


def lum(p):
    return (0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]) / 255


def ramp(stops, v):
    v = max(0.0, min(1.0, v))
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        if v <= b:
            t = 0 if b == a else (v - a) / (b - a)
            return tuple(round(ca[i] + (cb[i] - ca[i]) * t) for i in range(3))
    return stops[-1][1]


def recolour(tile, stops, lo=None, hi=None):
    px = [tile.getpixel((x, y)) for y in range(16) for x in range(16)]
    ls = [lum(p) for p in px if p[3]]
    a, b = (lo if lo is not None else min(ls)), (hi if hi is not None else max(ls))
    out = Image.new("RGBA", (16, 16))
    out.putdata([(*ramp(stops, (lum(p) - a) / max(1e-6, b - a)), p[3]) for p in px])
    return out


SAND = [(0.0, (92, 54, 30)), (0.35, (168, 112, 62)), (0.7, (214, 165, 98)), (1.0, (242, 206, 142))]
BASALT = [(0.0, (14, 12, 14)), (0.3, (38, 34, 36)), (0.65, (70, 64, 64)), (1.0, (104, 96, 92))]
FUR = [(0.0, (120, 112, 104)), (0.4, (186, 180, 170)), (0.75, (226, 222, 214)), (1.0, (248, 246, 240))]
FLOOR_SAND = [(0.0, (120, 82, 44)), (0.5, (190, 146, 88)), (1.0, (230, 196, 136))]
FLOOR_BASALT = [(0.0, (22, 20, 22)), (0.5, (52, 48, 50)), (1.0, (86, 80, 80))]


def log_face(side, lower):
    """Horizontal logs, two per tile, shaded round; L/R pieces get the dark corner post like the cream face trim."""
    src = cell(72)
    out = Image.new("RGBA", (16, 16))
    for y in range(16):
        k = y % 8  # 0 = top of a log, 7 = the dark gap under it
        base = [0.55, 0.78, 0.9, 0.86, 0.74, 0.6, 0.42, 0.12][k]
        for x in range(16):
            grain = (lum(src.getpixel((x, (y * 3) % 16))) - 0.45) * 0.35
            v = base + grain - (0.08 if lower else 0.0)
            c = ramp([(0.0, (46, 24, 12)), (0.4, (110, 66, 34)), (0.75, (158, 102, 54)), (1.0, (196, 140, 82))], v)
            if (side == "L" and x <= 1) or (side == "R" and x >= 14):
                c = tuple(round(ch * 0.55) for ch in ramp([(0, (60, 34, 18)), (1, (120, 76, 40))], 0.5 + (0.2 if x in (1, 14) else 0)))
            out.putpixel((x, y), (*c, 255))
    return out


row = Image.new("RGBA", (480, 16), (0, 0, 0, 0))
tiles = []
for lower in (False, True):
    for side in "LMR":
        tiles.append(log_face(side, lower))
def span(srcs):
    ls = [lum(cell(n).getpixel((x, y))) for n in srcs for y in range(16) for x in range(16) if cell(n).getpixel((x, y))[3]]
    return min(ls), max(ls)


# One luminance span per set, so the L/M/R pieces and the rug slices keep the same tone as each other.
for srcs, stops in (((134, 135, 136, 164, 165, 166), SAND), ((14, 15, 16, 44, 45, 46), BASALT)):
    lo, hi = span(srcs)
    tiles += [recolour(cell(n), stops, lo, hi) for n in srcs]
tiles.append(recolour(cell(42), FLOOR_BASALT))
tiles.append(recolour(cell(42), FLOOR_SAND))
MAT = (108, 109, 110, 138, 139, 140, 168, 169, 170)
lo, hi = span(MAT)
tiles += [recolour(cell(n), FUR, lo, hi) for n in MAT]
for i, t in enumerate(tiles):
    row.paste(t, (i * 16, 0))

# ── row 67: the barn ──
import random

DIRT = cell(192)
STRAW = [(150, 108, 40), (196, 150, 62), (226, 186, 92), (246, 216, 132)]
WOOD = [(46, 24, 12), (110, 66, 34), (158, 102, 54), (196, 140, 82)]


def strands(tile, n, seed, box=(0, 0, 16, 16), lengths=(3, 5)):
    """Short straw strands, mostly lying east-west: a lit run with a shaded pixel under it."""
    r = random.Random(seed)
    for _ in range(n):
        x, y = r.randrange(box[0], box[2]), r.randrange(box[1], box[3] - 1)
        dy = r.choice([0, 0, 0, 1, -1])
        ln, col = r.randint(*lengths), r.choice(STRAW[2:])
        for k in range(ln):
            px, py = x + k, y + (dy if k >= ln // 2 else 0)
            if box[0] <= px < box[2] and box[1] <= py < box[3] - 1:
                tile.putpixel((px, py), (*col, 255))
                if tile.getpixel((px, py + 1))[3] and tile.getpixel((px, py + 1))[:3] not in STRAW[2:]:
                    tile.putpixel((px, py + 1), (*STRAW[0], 255))


def litter(dense, seed):
    """Dense: a straw bed (mottled straw over most of the cell, dirt showing in specks). Sparse: a few loose strands."""
    r = random.Random(seed * 31)
    t = DIRT.copy()
    if dense:
        for y in range(16):
            for x in range(16):
                v = r.random()
                if v < 0.9:
                    t.putpixel((x, y), (*(STRAW[1] if v < 0.45 else STRAW[2] if v < 0.8 else STRAW[0]), 255))
        strands(t, 16, seed)
    else:
        strands(t, 6, seed, lengths=(3, 4))
    return t


def board(kind):
    """A stall partition: a 6 px plank board standing north-south in the middle of the cell, seen from the south-east.
    Top edge lit, west edge dark, a soft floor shadow on the east; the south end shows the post's face."""
    t = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    top_end = 16 if kind != "S" else 5
    for y in range(16):
        for x in range(5, 11):
            if y < top_end:
                c = WOOD[1] if x == 5 else WOOD[0] if x == 10 else WOOD[3] if x == 6 else WOOD[2]
                if kind == "M" and y in (7, 8) and 6 <= x <= 9: c = WOOD[1]      # plank joint
                if kind == "N" and y < 2: c = WOOD[0]                              # tucked under the wall trim
            else:
                c = WOOD[0] if x in (5, 10) or y == 15 else WOOD[1] if y in (5, 6) else WOOD[2] if x in (6, 7) else WOOD[1]
                if x in (8,) and 7 <= y <= 13: c = WOOD[0]                         # the post's plank seam
            t.putpixel((x, y), (*c, 255))
        if y < 15:
            for x in (11, 12):
                t.putpixel((x, y), (20, 12, 6, 90 if x == 11 else 45))
    return t


def hay_heap():
    t = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    cx, cy, rx, ry = 16, 18, 14.5, 11.5
    for y in range(32):
        for x in range(32):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d <= 1:
                v = 0.85 - (y - (cy - ry)) / (2 * ry) * 0.6 + (0.1 if d < 0.5 else 0)
                c = STRAW[3] if v > 0.8 else STRAW[2] if v > 0.55 else STRAW[1] if v > 0.35 else STRAW[0]
                if d > 0.86: c = (112, 78, 28)
                t.putpixel((x, y), (*c, 255))
            elif ((x - cx) / (rx + 1)) ** 2 + ((y - cy - 3) / (ry - 3)) ** 2 <= 1 and y > cy:
                t.putpixel((x, y), (20, 12, 6, 80))                                   # floor shadow
    strands(t, 40, 7, (4, 9, 28, 28))
    return t


def animal(char, direction):
    """EasyRPG CharSet/Animal.png: 4x2 characters, 3 frames x 4 directions of 24x32; standing frame, colour key off."""
    src = Image.open("public/assets/easyrpg/charset/Animal.png").convert("RGBA")
    x0, y0 = (char % 4) * 72 + 24, (char // 4) * 128 + direction * 32
    fr = src.crop((x0, y0, x0 + 24, y0 + 32))
    key = src.getpixel((0, 0))
    fr.putdata([(0, 0, 0, 0) if p[:3] == key[:3] else p for p in fr.getdata()])
    t = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    t.paste(fr, (4, 0), fr)
    return t


def quarters(img):
    return [img.crop((x, y, x + 16, y + 16)) for y in (0, 16) for x in (0, 16)]


barn = [litter(True, s) for s in (1, 2, 3)] + [litter(False, s) for s in (4, 5, 6)] + [board(k) for k in "NMS"]
barn += quarters(hay_heap()) + quarters(animal(5, 1)) + quarters(animal(5, 3)) + quarters(animal(4, 1))
row2 = Image.new("RGBA", (480, 16), (0, 0, 0, 0))
for i, t in enumerate(barn):
    row2.paste(t, (i * 16, 0))
out = Image.new("RGBA", (480, (BASE_ROWS + 2) * 16), (0, 0, 0, 0))
out.paste(im, (0, 0))
out.paste(row, (0, BASE_ROWS * 16))
out.paste(row2, (0, (BASE_ROWS + 1) * 16))
out.save(SHEET, optimize=True)
print({"tiles": len(tiles), "barn": len(barn), "first": BASE_ROWS * 30, "size": out.size})
