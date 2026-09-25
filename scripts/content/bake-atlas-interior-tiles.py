#!/usr/bin/env python3
"""Atlas interior tiles appended to the Tibo interior sheet (public/assets/tibo-interior/interior-expanded.png).

Rows 0..68 stay pixel-identical (checked against a hash of that band before writing). Everything here is drawn in the
sheet's three-quarter view, mostly by re-arranging the sheet's own pixels so the palette and the painterly noise match.

Row 69 (tiles 2070..2099):
  2070 2071 2072 2073 / 2074 2075 2076 2077  church pew seen from BEHIND, 4x2 — the people sitting on it face north
      (the altar). The back rail is the top edge, the rear panel of the backrest with a hymn-book ledge fills the body,
      the legs stand under it. The sheet's own pew 1814~1847 is the FRONT view (faces south, towards the viewer).
  2078 2079 2080 / 2081 2082 2083  the same back-view pew, 3x2
  2084 2085 2086  iron bars left end | middle | right end (upper layer, blocking) — a cell front or a teller grille
  2087            iron bar door with a lock plate (same row as the bars)
  2088 2089 / 2090 2091  round steel vault door 2x2, hung on the two wall-face rows
  2092 2093 2094 / 2095 2096 2097  blackboard 3x2 with chalk writing and a chalk ledge, hung on the two wall-face rows
  2098 2099  unused
Row 70 (tiles 2100..2129):
  2100 2101 2102 / 2103 2104 2105  jeweller's glass counter 3x2 (red velvet with rings and gems under glass, wooden front)
  2106 2107 / 2108 2109  roulette table 2x2
  2110 2111 2112 2113 / 2114 2115 2116 2117 / 2118 2119 2120 2121  stone bath 4x3 with hot water and steam
  2122 2123 / 2124 2125  butcher's meat rack 2x2 (hams and a side of meat on hooks)
  2126 2127 / 2128 2129  tanner's hide frame 2x2 (a stretched hide on a wooden frame)
Row 71 (tiles 2130..2159):
  2130 2131 2132  stage front face left end | middle | right end (lower layer, solid — the stage floor above it is planks 102)
  2133            stage steps (lower layer, walkable) — one cell in the stage front
  2134 2135 2136 / 2137 2138 2139  bank teller counter 3x2 (a counter under an iron grille with a window)
  2140..2159 unused
Idempotent: the sheet is cut back to its first 69 rows before the rows are appended.
Usage: python3 scripts/content/bake-atlas-interior-tiles.py [--preview out.png]
"""
import hashlib
import math
import random
import sys

from PIL import Image

SHEET = "public/assets/tibo-interior/interior-expanded.png"
BASE_ROWS = 69
# sha256 of rows 0..68 (480x1104 RGBA bytes) as shipped before this script existed.
BASE_SHA = "6e4ece802781df9286cc7a6f799ffd3c39bd398e41cb71aef49f564fdc3c21b8"
im = Image.open(SHEET).convert("RGBA")
base = im.crop((0, 0, 480, BASE_ROWS * 16))


def cell(n):
    return base.crop(((n % 30) * 16, (n // 30) * 16, (n % 30) * 16 + 16, (n // 30) * 16 + 16))


def sprite(rows):
    """Paste sheet cells into one image: rows = [[n, n], [n, n]]."""
    img = Image.new("RGBA", (len(rows[0]) * 16, len(rows) * 16), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, n in enumerate(r):
            if n >= 0:
                img.paste(cell(n), (x * 16, y * 16))
    return img


def split(img):
    W, H = img.size
    return [img.crop((x, y, x + 16, y + 16)) for y in range(0, H, 16) for x in range(0, W, 16)]


def lum(p):
    return (0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]) / 255


OUT = (9, 6, 3)          # the pew's own outline
IRON = [(24, 24, 30), (52, 54, 62), (88, 92, 102), (128, 134, 144), (176, 182, 188)]
WOOD = [(46, 24, 12), (110, 66, 34), (158, 102, 54), (196, 140, 82)]
GOLD = [(96, 62, 22), (164, 116, 44), (224, 178, 78), (250, 226, 150)]
STONE = [(53, 58, 66), (86, 94, 104), (117, 128, 136), (150, 162, 166), (186, 196, 196), (216, 222, 218)]


def outline(img, colour=OUT):
    px = img.load()
    W, H = img.size
    edge = []
    for y in range(H):
        for x in range(W):
            if px[x, y][3] > 200 and any(not (0 <= x + dx < W and 0 <= y + dy < H) or px[x + dx, y + dy][3] < 100 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                edge.append((x, y))
    for x, y in edge:
        px[x, y] = (*colour, 255)


# ── back-view pew ──
def pew_back():
    """Re-arranged from the front pew 1814..1847 (64x32). Front view rows: 7..10 post caps and top rail, 11..16 the
    backrest face, 17 its shadow, 18..24 the seat (lit), 25..31 apron and legs. Seen from behind the backrest is in
    front: top rail, then the rear panel all the way down (taller), a hymn-book ledge across it, then the legs."""
    f = sprite([[1814, 1815, 1816, 1817], [1844, 1845, 1846, 1847]])
    b = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    fp, bp = f.load(), b.load()
    for y in range(7, 11):           # post caps and top rail, as drawn
        for x in range(64):
            bp[x, y] = fp[x, y]
    body = list(range(11, 17)) + list(range(12, 17))   # rows 11..21: the rear panel, the front's panel texture twice
    for i, sy in enumerate(body):
        y = 11 + i
        for x in range(64):
            bp[x, y] = fp[x, sy]
    # rows 22..24: the seat's back apron under the panel — dark, the end posts keep going
    for y in range(22, 25):
        for x in range(64):
            src = fp[x, 17]
            if not src[3]:
                continue
            post = x <= 12 or x >= 50
            if post:
                bp[x, y] = fp[x, 14]
            else:
                c = (54, 30, 18) if y == 22 else (34, 18, 10) if y == 23 else OUT
                bp[x, y] = (*c, 255)
    for y in range(25, 32):          # legs, as drawn, but only under the backrest (the seat's flared front edge is hidden)
        for x in range(9, 55):
            bp[x, y] = fp[x, y]
    for y in range(22, 32):
        for x in list(range(0, 9)) + list(range(55, 64)):
            bp[x, y] = (0, 0, 0, 0)
    # two framed panels on the rear face (thin dark inset lines), lit on their lower edge
    for (x0, x1) in ((15, 30), (33, 48)):
        for x in range(x0, x1 + 1):
            for y, c in ((12, (96, 56, 34)), (20, (196, 128, 86))):
                bp[x, y] = (*c, 255)
        for y in range(12, 21):
            for x, c in ((x0, (96, 56, 34)), (x1, (196, 128, 86))):
                bp[x, y] = (*c, 255)
    # hymn-book ledge across the panel: a lit top, a dark front lip, and books standing on it
    for x in range(14, 50):
        bp[x, 16] = (214, 150, 100, 255)
        bp[x, 17] = (120, 70, 42, 255)
        bp[x, 18] = (54, 30, 18, 255)
    books = [(17, (150, 36, 36)), (19, (40, 58, 120)), (21, (150, 36, 36)), (36, (46, 96, 58)), (38, (150, 36, 36)), (44, (40, 58, 120))]
    for x0, col in books:
        hi = tuple(min(255, int(c * 1.45) + 20) for c in col)
        for y in range(12, 16):
            bp[x0, y] = (*hi, 255) if y == 12 else (*col, 255)
            bp[x0 + 1, y] = (*col, 255) if y > 12 else (*hi, 255)
    return b


def pew_back3(four):
    """3-wide: drop 16 columns out of the middle (x 24..39) of the 4-wide back view."""
    b = Image.new("RGBA", (48, 32), (0, 0, 0, 0))
    b.paste(four.crop((0, 0, 24, 32)), (0, 0))
    b.paste(four.crop((40, 0, 64, 32)), (24, 0))
    return b


def floor_shadow(img, x0, x1, y, alpha=80):
    for x in range(x0, x1):
        if not img.getpixel((x, y))[3]:
            img.putpixel((x, y), (20, 12, 6, alpha))


# ── iron bars: a fence standing on the cell (cell front, teller grille) ──
def bars(kind):
    t = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = t.load()
    posts = {"L": [(0, 3)], "R": [(13, 16)], "M": [], "D": []}[kind]
    for x in (2, 6, 10, 14):                     # 2 px round bars, full height: lit west, dark east, a dark gap east
        for y in range(0, 15):
            px[x - 1, y] = (*IRON[3], 255)
            px[x, y] = (*IRON[1], 255)
        px[x - 1, 0] = (*IRON[4], 255)
    for y, c in ((1, IRON[4]), (2, IRON[0]), (12, IRON[3]), (13, IRON[0])):   # thin top and foot rails
        for x in range(16):
            px[x, y] = (*c, 255)
    for x0, x1 in posts:                          # square end post
        for y in range(0, 15):
            for x in range(x0, x1):
                c = IRON[4] if x == x0 else IRON[0] if x == x1 - 1 else IRON[2]
                if y == 0:
                    c = IRON[4]
                px[x, y] = (*c, 255)
    if kind == "D":                               # lock plate with a keyhole, hinge straps on the west side
        for y in range(5, 10):
            for x in range(9, 14):
                c = IRON[0] if x in (9, 13) or y in (5, 9) else IRON[3]
                px[x, y] = (*c, 255)
        px[11, 7] = (*OUT, 255)
        px[11, 8] = (*OUT, 255)
        px[10, 6] = (*GOLD[2], 255)
        for y in (5, 8):
            for x in range(0, 4):
                px[x, y] = (*IRON[0], 255)
    for x in range(16):                           # floor shadow under the bottom rail
        if not px[x, 15][3]:
            px[x, 15] = (20, 12, 6, 70)
    return t


# ── round steel vault door on the wall face (2x2) ──
def vault_door():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = img.load()
    cx, cy = 16, 16
    for y in range(32):
        for x in range(32):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d <= 15:
                lit = ((x + 0.5 - cx) + (y + 0.5 - cy)) / 30.0     # upper-left lit
                if d > 13:
                    c = IRON[2] if lit < 0 else IRON[1]
                elif d > 11.5:
                    c = IRON[0]
                else:
                    c = IRON[4] if lit < -0.35 else IRON[3] if lit < 0.15 else IRON[2]
                px[x, y] = (*c, 255)
    for k in range(12):                            # bolts round the rim
        a = k * math.pi / 6
        px[int(cx + 12.2 * math.cos(a)), int(cy + 12.2 * math.sin(a))] = (*GOLD[2], 255)
    for k in range(4):                             # handle wheel: four spokes with knobs
        a = k * math.pi / 2 + math.pi / 4
        for r in range(2, 8):
            x, y = int(round(cx + r * math.cos(a) - 0.5)), int(round(cy + r * math.sin(a) - 0.5))
            px[x, y] = (*IRON[0], 255)
        x, y = int(round(cx + 8 * math.cos(a) - 0.5)), int(round(cy + 8 * math.sin(a) - 0.5))
        for dx in (0, 1):
            for dy in (0, 1):
                px[x + dx, y + dy] = (*(GOLD[3] if dx == 0 and dy == 0 else GOLD[1]), 255)
    for y in range(13, 19):                        # hub
        for x in range(13, 19):
            if math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= 3:
                px[x, y] = (*(GOLD[3] if x + y < 30 else GOLD[1]), 255)
    outline(img, OUT)
    return img


# ── blackboard 3x2 on the wall face ──
def blackboard():
    img = Image.new("RGBA", (48, 32), (0, 0, 0, 0))
    px = img.load()
    BOARD = [(22, 44, 34), (32, 62, 46), (40, 74, 56)]
    for y in range(2, 28):
        for x in range(1, 47):
            if x in (1, 2, 45, 46) or y in (2, 3):
                c = WOOD[3] if (y == 2 or x == 1) else WOOD[0] if x == 46 else WOOD[2]
            else:
                c = BOARD[1] if (x * 7 + y * 3) % 11 else BOARD[2]
                if y == 4:
                    c = BOARD[0]
            px[x, y] = (*c, 255)
    rng = random.Random(11)
    CHALK = (222, 226, 214, 255)
    for row, (x0, x1) in zip((8, 13, 18), ((5, 30), (5, 24), (5, 34))):   # three lines of chalk writing
        x = x0
        while x < x1:
            w = rng.randint(2, 5)
            for k in range(w):
                px[x + k, row + (1 if (x + k) % 3 == 0 else 0)] = CHALK
                if rng.random() < 0.35:
                    px[x + k, row - 1] = CHALK
            x += w + 2
    for x in range(34, 42):                        # a sum under a circled figure
        px[x, 21] = CHALK
    for a in range(0, 360, 20):
        px[int(38 + 4 * math.cos(math.radians(a))), int(12 + 3 * math.sin(math.radians(a)))] = CHALK
    for y in range(26, 31):                        # chalk ledge with chalk sticks and a felt eraser
        for x in range(0, 48):
            c = WOOD[3] if y == 26 else WOOD[2] if y == 27 else WOOD[1] if y < 30 else OUT
            px[x, y] = (*c, 255)
    for x in (8, 9, 10, 20, 21):
        px[x, 25] = CHALK
    for x in range(30, 36):
        px[x, 24] = (60, 60, 64, 255)
        px[x, 25] = (150, 110, 70, 255)
    outline(img, OUT)
    return img


def counter_three(rows):
    """A 3-wide counter from a 4-wide one: drop 16 columns out of the middle."""
    four = sprite(rows)
    b = Image.new("RGBA", (48, 32), (0, 0, 0, 0))
    b.paste(four.crop((0, 0, 24, 32)), (0, 0))
    b.paste(four.crop((40, 0, 64, 32)), (24, 0))
    return b


BAR = [[1713, 1714, 1715, 1716], [1743, 1744, 1745, 1746]]


def jewel_counter():
    """Bar counter 1713..1746 cut to 3 wide; its top becomes a glass case over red velvet with rings and gems."""
    b = counter_three(BAR)
    px = b.load()
    VEL = [(88, 14, 26), (128, 26, 38), (160, 42, 52)]
    for y in range(13, 21):
        for x in range(9, 39):
            c = VEL[1] if (x + y) % 5 else VEL[2]
            if y == 13 or x == 9:
                c = VEL[0]
            px[x, y] = (*c, 255)
    gems = [(12, 15, (220, 40, 50)), (16, 17, (60, 110, 220)), (20, 15, (60, 190, 110)), (27, 18, (240, 200, 70)),
            (30, 15, (200, 90, 220)), (33, 17, (220, 40, 50)), (36, 15, (240, 240, 250))]
    for x, y, col in gems:
        px[x, y] = (*col, 255)
        px[x + 1, y] = (*tuple(min(255, c + 60) for c in col), 255)
        px[x, y + 1] = (*tuple(c // 2 for c in col), 255)
        px[x + 1, y + 1] = (*col, 255)
    for x in range(13, 19):                       # a gold chain
        px[x, 19 + (x % 2)] = (*GOLD[2], 255)
    for x, y in [(23, 14), (24, 14), (22, 15), (25, 15), (23, 16), (24, 16)]:   # a ring
        px[x, y] = (*GOLD[3 if y == 14 else 2], 255)
    for x in range(9, 39, 3):                      # the glass lid's lit front edge and two glints
        px[x, 12] = (230, 240, 245, 255)
    for x, y in [(30, 13), (31, 14), (32, 15), (12, 18), (13, 19)]:
        px[x, y] = (236, 246, 250, 255)
    return b


def roulette():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = img.load()
    FELT = [(16, 70, 40), (26, 96, 54), (36, 118, 66)]
    for y in range(5, 21):
        for x in range(1, 31):
            rim = x in (1, 2, 29, 30) or y in (5, 6, 19, 20)
            if rim:
                c = WOOD[3] if y == 5 or x == 1 else WOOD[1] if y == 20 or x == 30 else WOOD[2]
            else:
                c = FELT[1] if (x + y) % 6 else FELT[2]
            px[x, y] = (*c, 255)
    cx, cy = 10.5, 12.5                            # the wheel
    for y in range(6, 20):
        for x in range(3, 19):
            d = math.hypot((x + 0.5 - cx) / 6.5, (y + 0.5 - cy) / 5.5)
            if d <= 1:
                if d > 0.86:
                    c = WOOD[0]
                elif d > 0.5:
                    a = math.atan2(y + 0.5 - cy, x + 0.5 - cx)
                    c = (190, 30, 36) if int((a + math.pi) / (2 * math.pi) * 12) % 2 else (24, 22, 26)
                elif d > 0.3:
                    c = WOOD[3]
                else:
                    c = GOLD[2]
                px[x, y] = (*c, 255)
    px[13, 9] = (250, 250, 250, 255)                # the ball
    for y in range(8, 18, 3):                       # betting grid
        for x in range(19, 28):
            px[x, y] = (210, 220, 200, 255)
    for x in range(19, 29, 3):
        for y in range(8, 18):
            px[x, y] = (210, 220, 200, 255)
    for x, y in [(21, 10), (24, 13), (27, 16)]:
        px[x, y] = (200, 40, 40, 255)
    for y in range(21, 25):                         # apron and legs
        for x in range(2, 30):
            px[x, y] = (*(WOOD[2] if y == 21 else WOOD[1] if y < 24 else OUT), 255)
    for y in range(25, 31):
        for x in (3, 4, 27, 28):
            px[x, y] = (*(WOOD[2] if x in (3, 27) else WOOD[0]), 255)
    outline(img, OUT)
    floor_shadow(img, 3, 30, 31)
    return img


def bath():
    """4x3 stone bath: a lit rim of stone slabs round steaming water, the front face in stone courses."""
    img = Image.new("RGBA", (64, 48), (0, 0, 0, 0))
    px = img.load()
    tub = sprite([[1824, 1825, 1826], [1854, 1855, 1856]])
    WATER = sorted({tub.getpixel((x, 12))[:3] for x in (18, 20, 24, 28)}, key=sum)
    top, bottom, face = 3, 34, 10              # rim box y 3..34, front face under it
    for y in range(top, bottom + face + 1):
        for x in range(1, 63):
            if y <= bottom:
                if x < 6 or x > 56 or y < top + 5 or y > bottom - 4:
                    slab = ((x // 8) + (y // 5)) % 2
                    c = STONE[4] if slab else STONE[5]
                    if (x % 8 == 0 and (y < top + 5 or y > bottom - 4)) or (y % 5 == 0 and (x < 6 or x > 56)):
                        c = STONE[2]
                else:
                    t = (y - top - 5) / (bottom - top - 9)
                    c = WATER[0] if t < 0.18 else WATER[1] if t < 0.7 else WATER[-1]
                    if y == top + 5:
                        c = STONE[0]
                    if x == 6:
                        c = STONE[1]
            else:
                rel = y - bottom - 1
                off = 4 if (rel // 4) % 2 else 0
                c = STONE[3] if x < 22 else STONE[2] if x < 46 else STONE[1]
                if rel % 4 == 3 or (x + off) % 10 == 0:
                    c = STONE[0]
            px[x, y] = (*c, 255)
    rng = random.Random(4)
    for _ in range(26):                            # steam wisps over the water
        x, y = rng.randint(9, 50), rng.randint(9, 28)
        for k in range(rng.randint(2, 5)):
            px[x + k, y - (k % 2)] = (236, 242, 246, 255)
    for x, y in [(14, 20), (15, 20), (40, 24), (41, 24), (30, 16)]:
        px[x, y] = (200, 232, 250, 255)
    outline(img, (29, 28, 34))
    floor_shadow(img, 3, 63, 46)
    floor_shadow(img, 4, 62, 47, 45)
    return img


def meat_rack():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = img.load()
    for x0 in (2, 27):                             # two posts
        for y in range(2, 31):
            for x in range(x0, x0 + 3):
                c = WOOD[0] if x == x0 + 2 else WOOD[3] if x == x0 else WOOD[2]
                px[x, y] = (*c, 255)
    for y in range(2, 6):                          # crossbar
        for x in range(2, 30):
            px[x, y] = (*(WOOD[3] if y == 2 else WOOD[2] if y < 5 else WOOD[0]), 255)
    MEAT = [(92, 20, 18), (150, 40, 34), (196, 72, 58), (236, 212, 196)]

    def ham(cx, top, w, h):
        for y in range(6, top):                     # hook and string
            px[int(cx), y] = (*IRON[1], 255)
        for y in range(top, top + h):
            t = (y - top) / h
            half = w / 2 * (0.45 + 0.55 * math.sin(min(1.0, t * 1.4) * math.pi / 2))
            for x in range(int(cx - half), int(cx + half) + 1):
                c = MEAT[2] if x < cx - half / 3 else MEAT[1] if x < cx + half / 2 else MEAT[0]
                if t < 0.15:
                    c = MEAT[3]                     # the bone end / fat cap
                px[x, y] = (*c, 255)
    ham(9, 9, 7, 13)
    ham(15, 8, 5, 10)
    for y in range(6, 8):
        px[22, y] = (*IRON[1], 255)
    for y in range(8, 25):                          # a side of meat: red with white fat stripes
        for x in range(19, 26):
            c = MEAT[1] if (y + x // 3) % 5 else MEAT[3]
            if x == 25 or y == 24:
                c = MEAT[0]
            if x == 19:
                c = MEAT[2]
            px[x, y] = (*c, 255)
    outline(img, OUT)
    floor_shadow(img, 2, 31, 31)
    return img


def hide_frame():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = img.load()
    HIDE = [(110, 72, 40), (156, 108, 64), (196, 150, 98), (224, 188, 134)]
    for y in range(1, 31):                         # frame: two posts and two rails
        for x in range(1, 31):
            post = x in (1, 2, 3, 28, 29, 30)
            rail = y in (2, 3, 4, 23, 24, 25)
            if post or rail:
                c = WOOD[3] if (x in (1, 28) or y in (2, 23)) else WOOD[0] if (x in (3, 30) or y in (4, 25)) else WOOD[2]
                if not post and (x < 1 or x > 30):
                    continue
                px[x, y] = (*c, 255)
    for y in range(26, 31):                        # only the posts reach the floor
        for x in range(4, 28):
            px[x, y] = (0, 0, 0, 0)
    cx, cy = 16, 14                                # the stretched hide, an irregular oval laced to the frame
    for y in range(6, 23):
        for x in range(5, 27):
            d = ((x + 0.5 - cx) / 10.5) ** 2 + ((y + 0.5 - cy) / 8.2) ** 2 + 0.08 * math.sin(x * 1.3 + y)
            if d <= 1:
                v = 1 - d
                c = HIDE[3] if v > 0.75 else HIDE[2] if v > 0.35 else HIDE[1]
                if (x * 5 + y * 3) % 13 == 0:
                    c = HIDE[0]
                px[x, y] = (*c, 255)
    for (x0, y0, x1, y1) in [(4, 8, 7, 9), (4, 18, 7, 17), (27, 8, 24, 9), (27, 18, 24, 17), (12, 5, 12, 7), (20, 5, 20, 7), (12, 22, 12, 20), (20, 22, 20, 20)]:
        n = max(abs(x1 - x0), abs(y1 - y0)) + 1
        for k in range(n):
            x = x0 + round((x1 - x0) * k / max(1, n - 1))
            y = y0 + round((y1 - y0) * k / max(1, n - 1))
            px[x, y] = (214, 190, 140, 255)
    outline(img, OUT)
    floor_shadow(img, 1, 31, 31)
    return img


def stage_front(kind):
    """Lower layer, opaque: the stage's front face under its plank floor (102). Top: the lit plank edge; below: dark
    vertical boards; the end pieces get a corner post."""
    planks = cell(102)
    t = Image.new("RGBA", (16, 16), (0, 0, 0, 255))
    px = t.load()
    for y in range(16):
        for x in range(16):
            if y < 3:
                c = planks.getpixel((x, y + 10))[:3] if y < 2 else WOOD[3]
            else:
                c = WOOD[1] if x % 5 else WOOD[0]
                if x % 5 == 1:
                    c = WOOD[2]
                if y == 15:
                    c = (26, 14, 8)
                if y == 3:
                    c = WOOD[0]
            if (kind == "L" and x < 2) or (kind == "R" and x > 13):
                c = WOOD[3] if y < 3 else WOOD[2] if x in (0, 14) else WOOD[0]
            px[x, y] = (*c, 255)
    return t


def stage_steps():
    planks = cell(102)
    t = Image.new("RGBA", (16, 16), (0, 0, 0, 255))
    px = t.load()
    for y in range(16):
        for x in range(16):
            r = y % 5                              # three treads: lit top, dark riser
            c = WOOD[3] if r == 0 else WOOD[2] if r < 3 else WOOD[1] if r == 3 else WOOD[0]
            if x in (0, 15):
                c = WOOD[0]
            if y < 1:
                c = planks.getpixel((x, 11))[:3]
            px[x, y] = (*c, 255)
    return t


def teller_counter():
    b = counter_three(BAR)
    px = b.load()
    # clear the bar's mugs: re-tile the counter top from its clean west end
    for y in range(12, 21):
        for x in range(15, 40):
            px[x, y] = px[9 + (x - 15) % 6, y]
    # a grille rising from the counter's back edge up to the top, a round-topped window in the middle
    for y in range(0, 13):
        for x in range(8, 40):
            if x % 4 == 0:
                if 20 <= x <= 27 and y > (3 if 22 <= x <= 25 else 4):
                    continue
                px[x, y] = (*(IRON[3] if x % 4 == 0 else IRON[1]), 255)
    for x in range(8, 40):
        px[x, 0] = (*IRON[4], 255)
        px[x, 1] = (*IRON[2], 255)
    for x in range(20, 28):
        px[x, 3 if 22 <= x <= 25 else 4] = (*IRON[2], 255)
    for y in range(0, 13):
        for x in (8, 39):
            px[x, y] = (*IRON[0], 255)
    for x in range(20, 28):                        # a coin tray and a brass bell under the window
        px[x, 16] = (*GOLD[2], 255)
    px[23, 15] = (*GOLD[3], 255)
    px[24, 15] = (*GOLD[3], 255)
    return b


tiles69, tiles70, tiles71 = [], [], []
pb = pew_back()
tiles69 += split(pb)                     # 2070..2077 (top row 4, bottom row 4)
tiles69 += split(pew_back3(pb))          # 2078..2083
tiles69 += [bars("L"), bars("M"), bars("R"), bars("D")]   # 2084..2087
tiles69 += split(vault_door())           # 2088..2091
tiles69 += split(blackboard())           # 2092..2097
tiles70 += split(jewel_counter())        # 2100..2105
tiles70 += split(roulette())             # 2106..2109
tiles70 += split(bath())                 # 2110..2121
tiles70 += split(meat_rack())            # 2122..2125
tiles70 += split(hide_frame())           # 2126..2129
tiles71 += [stage_front("L"), stage_front("M"), stage_front("R"), stage_steps()]   # 2130..2133
tiles71 += split(teller_counter())       # 2134..2139
assert len(tiles69) == 28 and len(tiles70) == 30 and len(tiles71) == 10, (len(tiles69), len(tiles70), len(tiles71))

if "--preview" in sys.argv:
    out = sys.argv[sys.argv.index("--preview") + 1]
    items = [sprite([[1814, 1815, 1816, 1817], [1844, 1845, 1846, 1847]]), pb, pew_back3(pb), vault_door(), blackboard(), jewel_counter(),
             roulette(), bath(), meat_rack(), hide_frame(), teller_counter()]
    W = sum(i.width for i in items) + 8 * len(items)
    prev = Image.new("RGBA", (W, 72), (106, 110, 118, 255))
    x = 0
    for i in items:
        prev.alpha_composite(i, (x, 0))
        x += i.width + 8
    for k, t in enumerate([bars("L"), bars("M"), bars("M"), bars("D"), bars("R"), stage_front("L"), stage_front("M"), stage_steps(), stage_front("M"), stage_front("R")]):
        prev.alpha_composite(t, (k * 16, 52))
    prev.resize((prev.width * 3, prev.height * 3), Image.NEAREST).save(out)
    sys.exit(0)

assert hashlib.sha256(base.tobytes()).hexdigest() == BASE_SHA, "rows 0..68 of the Tibo sheet changed"
out = Image.new("RGBA", (480, (BASE_ROWS + 3) * 16), (0, 0, 0, 0))
out.paste(base, (0, 0))
for r, ts in enumerate((tiles69, tiles70, tiles71)):
    for i, t in enumerate(ts):
        out.paste(t, (i * 16, (BASE_ROWS + r) * 16))
out.save(SHEET, optimize=True)
check = Image.open(SHEET).convert("RGBA").crop((0, 0, 480, BASE_ROWS * 16))
assert hashlib.sha256(check.tobytes()).hexdigest() == BASE_SHA
print({"first": BASE_ROWS * 30, "rows": 3, "tiles": len(tiles69) + len(tiles70) + len(tiles71), "size": out.size, "base_rows_identical": True})
