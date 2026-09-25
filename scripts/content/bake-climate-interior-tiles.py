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
Row 68 (tiles 2040..2069), drawn here in the tub's three-quarter view (rim top face, front face, dark outline):
  2040 2041 / 2042 2043 stone well 2x2 with a wooden frame, rope and bucket (monastery garden)
  2044 2045 2046 / 2047 2048 2049 stone fountain 3x2, round basin with a tiered centre bowl (palace hall, holy-water font)
  2050 rat hole at the foot of a wall face (transparent around the hole, sits on any lower wall-face tile)
  2051 2052 2053 / 2054 2055 2056 / 2057 2058 2059 pipe organ 3x3 (gold pipes in a dark case over the two wall-face
    rows, the keyboard console on the floor row)
  2060 / 2061 tall lancet stained-glass window 1x2 (144's own rows: arch head, red and blue panels, sill)
  2062..2069 unused
Idempotent: the sheet is cut back to its first 66 rows before the rows are appended.
Usage: python3 scripts/content/bake-climate-interior-tiles.py
"""
import math

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
# ── row 68: well, stone fountain, rat hole ──
# Palette from the sheet: pillar greys, the water tub (1824..1856) water, the barn wood, a near-black outline.
OUT = (29, 28, 34)
STONE = [(53, 58, 66), (86, 94, 104), (117, 128, 136), (150, 162, 166), (186, 196, 196), (216, 222, 218)]
tub = Image.new("RGBA", (48, 32))
for i, n in enumerate([1824, 1825, 1826, 1854, 1855, 1856]):
    tub.paste(cell(n), ((i % 3) * 16, (i // 3) * 16))
WATER = [tub.getpixel((x, 12)) [:3] for x in (10, 18, 24)]
WATER = sorted(set(WATER), key=sum)


def ell(x, y, cx, cy, rx, ry):
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2


def stone_ring(img, cx, top, rx, ry, depth, inner, water, rng):
    """A round stone ring seen from the south-east-ish top-down: top face (rim ellipse minus the opening), front face
    below it (depth px) with brick courses, dark outline, water/dark inside the opening."""
    W, H = img.size
    irx, iry = inner
    cy = top + ry
    for y in range(H):
        for x in range(W):
            # front face: under the rim ellipse's lower half, down by depth
            d_top = ell(x + 0.5, y + 0.5, cx, cy, rx, ry)
            d_bot = ell(x + 0.5, y + 0.5 - depth, cx, cy, rx, ry)
            inside_x = abs(x + 0.5 - cx) <= rx
            front = inside_x and y + 0.5 >= cy and d_bot <= 1.0 and d_top > 1.0
            front = front or (inside_x and cy <= y + 0.5 <= cy + depth and d_top > 1.0 and abs(x + 0.5 - cx) <= rx)
            if d_top <= 1.0:
                di = ell(x + 0.5, y + 0.5, cx, cy + 0.5, irx, iry)
                if di <= 1.0:
                    # opening: water, darker at the back (north) edge where the rim shadows it
                    t = (y + 0.5 - (cy - iry)) / (2 * iry)
                    c = water[0] if t < 0.3 else water[1] if t < 0.75 else water[-1]
                    if di > 0.72 and y + 0.5 < cy + 0.5: c = OUT
                    img.putpixel((x, y), (*c, 255))
                else:
                    # rim top: lit, stones separated by radial joints
                    ang = math.atan2((y + 0.5 - cy) / ry, (x + 0.5 - cx) / rx)
                    seg = int((ang + math.pi) / (2 * math.pi) * 14)
                    joint = abs(((ang + math.pi) / (2 * math.pi) * 14) - round((ang + math.pi) / (2 * math.pi) * 14)) < 0.09
                    c = STONE[4] if (y + 0.5) < cy else STONE[3]
                    if seg % 2: c = STONE[5] if c == STONE[4] else STONE[4]
                    if joint: c = STONE[2]
                    if d_top > 0.8: c = STONE[2] if (y + 0.5) < cy else STONE[3]
                    img.putpixel((x, y), (*c, 255))
            elif front:
                rel = y + 0.5 - cy - math.sqrt(max(0, 1 - ((x + 0.5 - cx) / rx) ** 2)) * ry
                course = int(rel // 4)
                off = 3 if course % 2 else 0
                mortar = (int(rel) % 4 == 3) or ((int(x + off) % 7) == 0)
                shade = (x + 0.5 - (cx - rx)) / (2 * rx)
                c = STONE[3] if shade < 0.35 else STONE[2] if shade < 0.75 else STONE[1]
                if mortar: c = STONE[0] if shade > 0.5 else STONE[1]
                img.putpixel((x, y), (*c, 255))
    # outline: any opaque pixel with a transparent 4-neighbour becomes the outline colour
    px = img.load()
    edge = []
    for y in range(H):
        for x in range(W):
            if px[x, y][3] and any(not (0 <= x + dx < W and 0 <= y + dy < H) or not px[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                edge.append((x, y))
    for x, y in edge:
        px[x, y] = (*OUT, 255)


def shadow(img, cx, cy, rx, ry):
    W, H = img.size
    for y in range(H):
        for x in range(W):
            if not img.getpixel((x, y))[3] and ell(x + 0.5, y + 0.5, cx, cy, rx, ry) <= 1:
                img.putpixel((x, y), (20, 12, 6, 80))


def well():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    rng = random.Random(3)
    stone_ring(img, 16, 12, 13.5, 6.5, 9, (9.5, 3.8), [(10, 20, 34), (24, 48, 76), (40, 78, 112)], rng)
    shadow(img, 18.5, 28.5, 13, 3.2)
    # wooden frame: two posts standing on the rim sides, a crossbar with a roller, rope and bucket
    px = img.load()
    for x0 in (3, 26):
        for y in range(1, 20):
            for x in range(x0, x0 + 3):
                c = WOOD[0] if x in (x0, x0 + 2) else WOOD[2]
                if x == x0 + 1 and y < 3: c = WOOD[3]
                px[x, y] = (*c, 255)
    for x in range(3, 29):
        for y in range(2, 6):
            c = WOOD[0] if y in (2, 5) else WOOD[3] if y == 3 else WOOD[2]
            if x in (3, 28): c = WOOD[0]
            px[x, y] = (*c, 255)
    # rope coil on the roller
    for x in range(13, 20):
        for y in (3, 4):
            px[x, y] = (*((214, 186, 128) if (x + y) % 2 else (150, 118, 70)), 255)
    for y in range(6, 11):
        px[16, y] = (*((214, 186, 128) if y % 2 else (150, 118, 70)), 255)
    # bucket hanging over the opening
    for y in range(10, 15):
        for x in range(13, 20):
            c = WOOD[0] if x in (13, 19) or y == 14 else WOOD[2] if y > 11 else WOOD[3]
            if y == 10: c = (70, 70, 74) if 13 < x < 19 else WOOD[0]
            px[x, y] = (*c, 255)
    return img


def fountain():
    img = Image.new("RGBA", (48, 32), (0, 0, 0, 0))
    rng = random.Random(5)
    stone_ring(img, 24, 7, 22.5, 8.5, 10, (18.5, 5.8), WATER, rng)
    shadow(img, 26.5, 29.5, 21, 2.8)
    px = img.load()
    # centre pedestal: a column (lit west, shaded east) under a small upper bowl, water falling from the bowl's lip
    for y in range(6, 17):
        for x in range(22, 27):
            c = OUT if x in (22, 26) else STONE[4] if x == 23 else STONE[3] if x == 24 else STONE[2]
            if y == 16: c = OUT
            px[x, y] = (*c, 255)
    for y in range(2, 8):
        for x in range(17, 32):
            d = ell(x + 0.5, y + 0.5, 24.5, 4.5, 7.5, 3.2)
            if d <= 1:
                c = STONE[5] if y <= 3 else STONE[3] if y <= 5 else STONE[2]
                if d > 0.7: c = OUT
                if ell(x + 0.5, y + 0.5, 24.5, 4.0, 5.0, 1.6) <= 1: c = WATER[-1] if y <= 3 else WATER[1]
                px[x, y] = (*c, 255)
    for (x, y) in [(17, 7), (32, 7), (16, 9), (33, 9), (16, 11), (33, 11), (15, 13), (34, 13)]:
        px[x, y] = (230, 246, 255, 255)
    for (x, y) in [(17, 8), (32, 8), (16, 10), (33, 10)]:
        px[x, y] = (150, 205, 240, 255)
    for (x, y) in [(14, 15), (15, 15), (34, 15), (35, 15), (23, 19), (24, 19), (25, 19)]:
        px[x, y] = (200, 232, 250, 255)
    return img


def rat_hole():
    """A gnawed hole at the foot of a wall face: dark arch, a crumbled lip, two crumbs on the floor edge.
    Transparent elsewhere so it sits on any wall face (cream, stone brick, log)."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    for y in range(16):
        for x in range(16):
            d = ((x + 0.5 - 8) / 4.5) ** 2 + ((y + 0.5 - 16) / 7.0) ** 2
            if d <= 1:
                c = (8, 6, 8) if d < 0.55 else (26, 18, 16) if d < 0.8 else (58, 44, 36)
                px[x, y] = (*c, 255)
            elif d <= 1.25 and y > 8:
                px[x, y] = (96, 80, 66, 255) if (x + y) % 3 else (70, 58, 48, 255)
    for (x, y) in [(2, 15), (13, 14), (14, 15), (3, 14)]:
        px[x, y] = (110, 96, 80, 255)
    # two tiny eyes in the dark
    px[7, 12] = (220, 200, 90, 255)
    px[9, 12] = (220, 200, 90, 255)
    return img


GOLD = [(96, 62, 22), (164, 116, 44), (224, 178, 78), (250, 226, 150)]
DARKWOOD = [(34, 18, 10), (78, 44, 22), (120, 72, 36), (164, 108, 58)]


def pipe_organ():
    """3x3 pipe organ against the back wall: a dark wooden case with gold pipes (tall in the middle) over the two
    wall-face rows, and on the floor row the wooden console with its keyboard seen from above."""
    img = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    px = img.load()
    # case back panel
    for y in range(4, 34):
        for x in range(3, 45):
            c = DARKWOOD[1] if (x + y) % 7 else DARKWOOD[0]
            if x in (3, 44) or y == 4: c = OUT
            elif x in (4, 43) or y == 5: c = DARKWOOD[2]
            px[x, y] = (*c, 255)
    # crest on top of the middle tower
    for y in range(0, 5):
        for x in range(17, 31):
            if abs(x - 23.5) <= 6.5 - y * 0.9 or y >= 3:
                c = DARKWOOD[2] if y < 4 else DARKWOOD[1]
                if abs(x - 23.5) > 5.8 - y * 0.9 and y < 3: c = OUT
                px[x, y] = (*c, 255)
    # pipes: 4 px wide, lit west, a dark mouth two thirds down; heights rise to the middle
    tops = [14, 11, 9, 7, 5, 3, 3, 5, 7, 9, 11, 14]
    for i, top in enumerate(tops):
        x0 = 5 + i * 3 + (1 if i >= 6 else 0) + (i // 3)
        for y in range(top + 2, 31):
            for dx in range(3):
                x = x0 + dx
                c = GOLD[3] if dx == 0 else GOLD[2] if dx == 1 else GOLD[1]
                if y == top + 2: c = GOLD[1] if dx else GOLD[2]
                px[x, y] = (*c, 255)
            if x0 + 3 < 45: px[x0 + 3, y] = (*DARKWOOD[0], 255)
        mouth = top + 2 + int((31 - top - 2) * 0.62)
        px[x0, mouth] = (*GOLD[0], 255); px[x0 + 1, mouth] = (*OUT, 255); px[x0 + 2, mouth] = (*GOLD[0], 255)
        px[x0 + 1, mouth + 1] = (*GOLD[1], 255)
    # case base rail under the pipes
    for y in range(30, 34):
        for x in range(3, 45):
            c = DARKWOOD[3] if y == 30 else DARKWOOD[2] if y == 31 else DARKWOOD[1]
            if x in (3, 44) or y == 33: c = OUT
            px[x, y] = (*c, 255)
    # console on the floor row: wooden desk top with keys (white/black) then the front panel
    for y in range(33, 46):
        for x in range(9, 39):
            if y < 38:
                c = DARKWOOD[3] if y == 33 else DARKWOOD[2]
                if 34 <= y <= 36 and 11 <= x <= 36:
                    c = (236, 232, 220) if y > 34 else (200, 196, 186)
                    if x % 3 == 0: c = (60, 56, 60)
                if x in (9, 38): c = OUT
            else:
                c = DARKWOOD[1] if y < 44 else DARKWOOD[0]
                if y == 38: c = DARKWOOD[2]
                if x in (9, 38) or y == 45: c = OUT
                if x in (14, 33) and 39 <= y <= 43: c = DARKWOOD[0]
            px[x, y] = (*c, 255)
    for y in range(46, 48):
        for x in range(11, 40):
            px[x, y] = (20, 12, 6, 80)
    return img


def tall_stained_glass():
    """1x2 lancet window from 144's own rows: the arch head, then red/purple and blue panels in turn, the sill."""
    src = cell(144)
    seq = list(range(0, 9)) + list(range(9, 14)) + list(range(5, 9)) + list(range(9, 14)) + list(range(5, 9)) + [14]
    img = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    for y, sy in enumerate(seq):
        for x in range(16):
            img.putpixel((x, y + 1), src.getpixel((x, sy)))
    return img


row3 = Image.new("RGBA", (480, 16), (0, 0, 0, 0))
extra = quarters(well()) + [fountain().crop((x, y, x + 16, y + 16)) for y in (0, 16) for x in (0, 16, 32)] + [rat_hole()]
extra += [pipe_organ().crop((x, y, x + 16, y + 16)) for y in (0, 16, 32) for x in (0, 16, 32)]
extra += [tall_stained_glass().crop((0, y, 16, y + 16)) for y in (0, 16)]
for i, t in enumerate(extra):
    row3.paste(t, (i * 16, 0))
out = Image.new("RGBA", (480, (BASE_ROWS + 3) * 16), (0, 0, 0, 0))
out.paste(im, (0, 0))
out.paste(row, (0, BASE_ROWS * 16))
out.paste(row2, (0, (BASE_ROWS + 1) * 16))
out.paste(row3, (0, (BASE_ROWS + 2) * 16))
out.save(SHEET, optimize=True)
print({"tiles": len(tiles), "barn": len(barn), "row68": len(extra), "first": BASE_ROWS * 30, "size": out.size})
