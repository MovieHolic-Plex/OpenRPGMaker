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
Idempotent: the sheet is cut back to its first 66 rows before the row is appended.
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
out = Image.new("RGBA", (480, (BASE_ROWS + 1) * 16), (0, 0, 0, 0))
out.paste(im, (0, 0))
out.paste(row, (0, BASE_ROWS * 16))
out.save(SHEET, optimize=True)
print({"tiles": len(tiles), "first": BASE_ROWS * 30, "size": out.size})
