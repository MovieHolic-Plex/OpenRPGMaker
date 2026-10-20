#!/usr/bin/env python3
"""Astra Horizon: original centre / mart exteriors, drawn as code pixels in the overworld sheet's own style.

Both kits are 4x4 tiles (64x64 px), 3/4 top view (roof upper face + front wall, no side walls), and use only
colours that already exist in monster-overworld.png. The drawing vocabulary is taken from the neighbouring
house kits (house_a..h, 880-1007) and shop_a's awning (1200):

* roof   - 5-step ramp (hi, light, mid, dark, deepest) laid out as the houses do it: highlight rim on the
           left/top, dark rim on the right, a deep ridge shadow line under the top cap, then shingle courses
           every 4 rows (highlight line, light row, light row with mid nicks, mid/dark 2px dither) with the nick
           offset alternating each course, and a 3-row eave (hi, light, dark) closed by the outline.
* walls  - cream plaster with a 2-row eave shadow (shadow-2, shadow-1), a sun-lit row above the plinth,
           wood corner posts (light / mid / dark + outline), stone foundation with mortar ticks.
* glass  - white frame, dark top pane row, mid pane with two white glints, light bottom row, grey sill shade.

Centre ("rest hall"): teal roof with a small white roof lantern, a board on the eave carrying a pink heart between
two leaf sprigs, white plaster walls with a teal wainscot band, grey stone corner pillars with warm wood caps, teal/white canopy over a glass
double door.
Mart ("supply store"): violet roof with a standing roof sign carrying a potion flask, cream walls, wood posts,
orange/white awning, display window with goods on shelves, glass double door.
No text, no balls, no cross; roof colours are teal and violet (not red / blue).

APPEND-ONLY: the kits are NEW tile cells at the bottom of the shared overworld sheet (2224-2255).
Old cells (ids < OLD_COUNT) are never touched, so other projects keep their art.
Usage: python3 scripts/content/astra-redesign-center-mart.py [--dry out.png]
"""
import re
import sys
from PIL import Image

KIT = 'public/assets/monster-kit/monster-%s.png'
OLD_COUNT = 2224
SHEET = 'overworld'
# (source base for tile metadata, new base, kind)
KITS = [(1344, 2224, 'center'), (1360, 2240, 'mart')]
JSON_PATH = 'src/assets/monsterKit/monster-overworld.json'
INDEX_PATH = 'src/assets/monsterKit/index.json'
T = (0, 0, 0, 0)

# ---- palette: every colour below already exists in monster-overworld.png --------------------------------
OUT = (56, 60, 88)
# roof ramps (hi, light, mid, dark, deepest) - same slots as the house kits
TEAL = [(104, 198, 178), (56, 169, 160), (29, 133, 135), (18, 96, 104), (10, 63, 70)]       # house_f roof
VIOLET = [(100, 119, 182), (108, 90, 167), (88, 74, 147), (67, 55, 121), (51, 40, 98)]     # house_c roof
ORANGE = [(236, 156, 92), (214, 119, 62), (180, 85, 44), (138, 58, 32), (92, 36, 22)]      # house_g roof
LEAF = [(112, 179, 118), (77, 162, 118), (52, 132, 87), (36, 113, 68), (16, 72, 38)]       # house_a roof
# plaster
W_HI = (255, 250, 238)
W_MID = (244, 234, 208)
W_SH1 = (220, 204, 164)
W_SH2 = (184, 166, 132)
WHITE = (255, 255, 255)
# wood
WD_L = (196, 132, 74)
WD_M = (160, 98, 52)
WD_D = (126, 72, 36)
WD_DD = (90, 48, 24)
# stone / metal greys
ST_HI = (216, 216, 232)
ST_L = (210, 208, 220)
ST_M = (156, 156, 184)
ST_D = (138, 136, 156)
# glass
GL_D = (90, 142, 224)
GL_M = (136, 192, 244)
GL_L = (196, 232, 255)
# metal gold (door knobs in the sheet)
GOLD = (242, 208, 92)
GOLD_D = (191, 108, 39)
# soft pink (old centre wall tones in the sheet) - used only for the heart emblem
PINK = [(250, 199, 194), (243, 165, 166), (233, 133, 147)]


class Canvas:
    def __init__(self):
        self.im = Image.new('RGBA', (64, 64), T)

    def p(self, x, y, c):
        if 0 <= x < 64 and 0 <= y < 64:
            self.im.putpixel((x, y), c + (255,))

    def get(self, x, y):
        return self.im.getpixel((x, y))

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.p(x, y, c)

    def hline(self, x0, x1, y, c):
        self.rect(x0, y, x1, y, c)

    def vline(self, x, y0, y1, c):
        self.rect(x, y0, x, y1, c)

    def box(self, x0, y0, x1, y1, c):
        self.hline(x0, x1, y0, c)
        self.hline(x0, x1, y1, c)
        self.vline(x0, y0, y1, c)
        self.vline(x1, y0, y1, c)

    def rows(self, x0, y0, strings, legend):
        for dy, row in enumerate(strings):
            for dx, ch in enumerate(row):
                if ch in legend and legend[ch] is not None:
                    self.p(x0 + dx, y0 + dy, legend[ch])


# ---- building blocks copied in spirit from the house kits ----------------------------------------------

def roof(cv, x0, x1, y0, y1, R):
    """Shingle roof seen from above, outline columns x0/x1, outline rows y0/y1 (house_* layout)."""
    hi, li, mi, dk, dd = R
    cv.hline(x0 + 3, x1 - 3, y0, OUT)
    cv.p(x0 + 2, y0 + 1, OUT)
    cv.p(x1 - 2, y0 + 1, OUT)
    cv.hline(x0 + 3, x1 - 3, y0 + 1, hi)
    # cap row: light with mid nicks every 6
    cv.p(x0 + 1, y0 + 2, OUT)
    cv.p(x1 - 1, y0 + 2, OUT)
    for x in range(x0 + 2, x1 - 1):
        cv.p(x, y0 + 2, mi if (x - x0 - 4) % 6 == 0 or x == x1 - 2 else li)
    for y in range(y0 + 3, y1):
        cv.p(x0, y, OUT)
        cv.p(x1, y, OUT)
    # cap underside: mid with dark nicks, then the deep ridge shadow
    for x in range(x0 + 1, x1):
        cv.p(x, y0 + 3, dk if (x - x0 - 4) % 6 == 0 else mi)
    cv.hline(x0 + 3, x1 - 4, y0 + 4, dd)
    body_top, body_bot = y0 + 5, y1 - 4
    for y in range(body_top, body_bot + 1):
        r = y - body_top
        if r == 0:
            row = [li] * 64
            row[x1 - 4] = dk
        elif r < 3:
            row = [mi] * 64
        else:
            ph = (r - 3) % 4
            cyc = (r - 3) // 4
            off = 2 if cyc % 2 else 0
            if ph == 0:   # 2px dither between mid and dark (shingle butt shadow)
                row = [dk if (x + off) % 4 in (1, 2) else mi for x in range(64)]
            elif ph == 1:  # highlight line of the next course
                row = [hi] * 64
            elif ph == 2:
                row = [li] * 64
            else:          # light row with mid nicks
                row = [mi if (x + off) % 4 == 0 else li for x in range(64)]
        for x in range(x0 + 4, x1 - 3):
            cv.p(x, y, row[x])
    # side rims (left lit, right shaded)
    for y in range(y0 + 4, y1 - 3):
        cv.p(x0 + 1, y, hi)
        cv.p(x0 + 2, y, li)
        cv.p(x0 + 3, y, mi if y > y0 + 4 else dd)
        cv.p(x1 - 3, y, dk)
        cv.p(x1 - 2, y, mi)
        cv.p(x1 - 1, y, dk)
    # eave: hi, light, dark, outline
    cv.p(x0 + 1, y1 - 3, hi)
    cv.hline(x0 + 2, x1 - 2, y1 - 3, hi)
    cv.p(x1 - 1, y1 - 3, dk)
    cv.p(x0 + 1, y1 - 2, hi)
    cv.hline(x0 + 2, x1 - 2, y1 - 2, li)
    cv.p(x1 - 1, y1 - 2, dk)
    cv.p(x0 + 1, y1 - 1, hi)
    cv.hline(x0 + 2, x1 - 1, y1 - 1, dk)
    cv.hline(x0, x1, y1, OUT)


def post(cv, x, y0, y1, ramp=(WD_L, WD_M, WD_D)):
    """Corner post / pillar: outline, light, mid, dark, outline (5 px wide)."""
    cv.vline(x, y0, y1, OUT)
    cv.vline(x + 1, y0, y1, ramp[0])
    cv.vline(x + 2, y0, y1, ramp[1])
    cv.vline(x + 3, y0, y1, ramp[2])
    cv.vline(x + 4, y0, y1, OUT)


def stone_pillar(cv, x, y0, y1):
    post(cv, x, y0, y1, (ST_HI, ST_M, ST_D))
    for y in range(y0 + 4, y1, 6):           # block joints, staggered like the foundation ticks
        cv.p(x + 1, y, ST_L)
        cv.p(x + 2, y, ST_D)
        cv.p(x + 3, y, OUT)


def wall(cv, x0, x1, y0, y1, main=W_MID):
    """Plaster face between the posts: eave shadow (2 rows), body, sun row, plinth (shadow, light)."""
    cv.hline(x0, x1, y0, W_SH2)
    cv.hline(x0, x1, y0 + 1, W_SH1)
    cv.rect(x0, y0 + 2, x1, y1 - 3, main)
    cv.hline(x0, x1, y1 - 2, W_HI)
    cv.hline(x0, x1, y1 - 1, W_SH2)
    cv.hline(x0, x1, y1, W_SH1)


def foundation(cv, x0, x1, y):
    """Stone footing: light stones with mortar ticks, dark lower course, outline."""
    for x in range(x0, x1 + 1):
        cv.p(x, y, ST_D if (x - x0) % 9 == 4 else ST_L)
        cv.p(x, y + 1, ST_D)
    cv.hline(x0 - 1, x1 + 1, y + 2, OUT)
    cv.p(x0 - 1, y, OUT)
    cv.p(x0 - 1, y + 1, OUT)
    cv.p(x1 + 1, y, OUT)
    cv.p(x1 + 1, y + 1, OUT)


def window(cv, x0, y0, panes, pw, ph):
    """House window: outline, white frame, panes (dark top row, glinted mid, light bottom), sill + shade."""
    w = panes * (pw + 1) + 1
    h = ph + 2
    cv.box(x0, y0, x0 + w + 1, y0 + h + 1, OUT)
    cv.rect(x0 + 1, y0 + 1, x0 + w, y0 + h, WHITE)
    for i in range(panes):
        px = x0 + 2 + i * (pw + 1)
        for dy in range(ph):
            for dx in range(pw):
                if dy == 0:
                    c = GL_D
                elif dy == ph - 1:
                    c = GL_L
                elif dy == 1 and dx in (0, 3):
                    c = WHITE
                else:
                    c = GL_M
                cv.p(px + dx, y0 + 2 + dy, c)
        cv.vline(px + pw, y0 + 2, y0 + 1 + ph, ST_HI)   # mullion shade like the houses' 'o' column
    cv.vline(x0 + w, y0 + 2, y0 + h, ST_HI)
    cv.hline(x0 + 1, x0 + w, y0 + h, ST_HI)
    # sill: outline lip and a shade row under it
    cv.hline(x0 - 1, x0 + w + 2, y0 + h + 2, OUT)
    cv.hline(x0, x0 + w + 1, y0 + h + 3, W_SH1)


def glass_doors(cv, x0, y0, x1, y1, frame=(ST_HI, ST_L, ST_M)):
    """Glass double door in a light frame; bottom is a dark wood threshold like the house doors."""
    fl, fm, fd = frame
    cv.box(x0, y0, x1, y1, OUT)
    cv.hline(x0 + 1, x1 - 1, y0 + 1, fl)
    cv.vline(x0 + 1, y0 + 1, y1 - 1, fl)
    cv.vline(x1 - 1, y0 + 2, y1 - 1, fd)
    cv.hline(x0 + 2, x1 - 2, y0 + 2, OUT)
    mid = (x0 + x1) // 2
    for y in range(y0 + 3, y1):
        for x in range(x0 + 2, x1 - 1):
            if x in (x0 + 2, x1 - 2, mid, mid + 1):
                c = OUT if x in (mid, mid + 1) else fm
            else:
                r = y - (y0 + 3)
                c = GL_D if r < 2 else (GL_L if r > (y1 - y0) - 8 else GL_M)
                # diagonal glints, two per leaf
                lx = (x - (x0 + 3)) if x < mid else (x - (mid + 2))
                if 2 <= r <= 9 and (lx - (r - 2)) in (1, 2) and lx < 5:
                    c = GL_L
            cv.p(x, y, c)
    # push bars
    cv.hline(x0 + 4, mid - 2, y0 + 12, fm)
    cv.hline(mid + 3, x1 - 4, y0 + 12, fm)
    cv.hline(x0 + 1, x1 - 1, y1, WD_DD)


def board(cv, x0, y0, x1, y1, face=WHITE, face_sh=W_MID):
    """Wooden framed sign board, lit top-left, dark bottom-right."""
    cv.box(x0, y0, x1, y1, OUT)
    cv.hline(x0 + 1, x1 - 1, y0 + 1, WD_L)
    cv.vline(x0 + 1, y0 + 1, y1 - 1, WD_L)
    cv.hline(x0 + 1, x1 - 1, y1 - 1, WD_D)
    cv.vline(x1 - 1, y0 + 2, y1 - 1, WD_D)
    cv.box(x0 + 2, y0 + 2, x1 - 2, y1 - 2, WD_M)
    cv.rect(x0 + 3, y0 + 3, x1 - 3, y1 - 3, face)
    cv.hline(x0 + 3, x1 - 3, y1 - 3, face_sh)
    cv.vline(x1 - 3, y0 + 3, y1 - 3, face_sh)


def striped_awning(cv, x0, x1, y0, stripe, white=WHITE, w=4):
    """shop_a awning: lit top row, 3 main rows, shaded row, scallop, outline scallop + wall shadow."""
    hi, li, mi, dk, _ = stripe
    cv.vline(x0, y0, y0 + 5, OUT)
    cv.vline(x1, y0, y0 + 5, OUT)
    cv.hline(x0, x1, y0 - 1, OUT)
    for x in range(x0 + 1, x1):
        s = ((x - x0 - 1) // w) % 2 == 0
        cv.p(x, y0, hi if s else white)
        for y in range(y0 + 1, y0 + 4):
            cv.p(x, y, li if s else white)
        cv.p(x, y0 + 4, mi if s else ST_M)
        if (x - x0 - 1) % w in (1, 2):      # scallop tongue hangs one row lower
            cv.p(x, y0 + 5, mi if s else ST_M)
            cv.p(x, y0 + 6, OUT)
        else:
            cv.p(x, y0 + 5, OUT)


# ---- the two kits ------------------------------------------------------------------------------------------

def sprig(cv, x0, y0, flip=False):
    """Tiny two-leaf sprig (leaf ramp) used as a laurel under the star."""
    shape = ["..12", ".123", "1234", "..4."]
    for dy, row in enumerate(shape):
        for dx, ch in enumerate(row):
            if ch != '.':
                cv.p(x0 + (3 - dx if flip else dx), y0 + dy, LEAF[int(ch) - 1])


HEART_MASK = [  # 11x9 heart, shaded by facet in heart()
    ".###...###.",
    "#####.#####",
    "###########",
    "###########",
    ".#########.",
    "..#######..",
    "...#####...",
    "....###....",
    ".....#.....",
]


def heart(cv, x0, y0):
    """Soft pink heart (care / healing): outline, light facets up-left, deeper pink down-right, glints."""
    m = HEART_MASK
    h, w = len(m), len(m[0])

    def on(x, y):
        return 0 <= y < h and 0 <= x < w and m[y][x] == '#'
    for y in range(h):
        for x in range(w):
            if not on(x, y):
                continue
            if not all(on(x + a, y + b) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                c = OUT
            elif x + y < 7:
                c = PINK[0]
            elif x + y < 11:
                c = PINK[1]
            else:
                c = PINK[2]
            cv.p(x0 + x, y0 + y, c)
    cv.p(x0 + 2, y0 + 2, WHITE)
    cv.p(x0 + 2, y0 + 3, W_HI)


def draw_center():
    cv = Canvas()
    # rows match the house kits: roof 0..32 (outline 32), wall 33..59, footing 60..61, ground outline 62
    roof(cv, 1, 62, 0, 32, TEAL)
    # roof lantern standing on the roof: top face (teal), front face with a small vent window, outline
    lx0, lx1 = 25, 38
    cv.hline(lx0 + 1, lx1 - 1, 2, OUT)
    cv.p(lx0, 3, OUT)
    cv.p(lx1, 3, OUT)
    cv.hline(lx0 + 1, lx1 - 1, 3, TEAL[0])
    cv.vline(lx0, 4, 5, OUT)
    cv.vline(lx1, 4, 5, OUT)
    for x in range(lx0 + 1, lx1):
        cv.p(x, 4, TEAL[1] if (x - lx0) % 4 else TEAL[2])
        cv.p(x, 5, TEAL[2] if (x - lx0) % 4 not in (1, 2) else TEAL[3])
    cv.p(lx0 + 1, 4, TEAL[0])
    cv.p(lx0 + 1, 5, TEAL[0])
    cv.hline(lx0, lx1, 6, OUT)
    cv.vline(lx0, 7, 12, OUT)
    cv.vline(lx1, 7, 12, OUT)
    cv.hline(lx0 + 1, lx1 - 1, 7, W_SH2)
    cv.rect(lx0 + 1, 8, lx1 - 1, 11, W_MID)
    cv.vline(lx0 + 1, 8, 11, W_HI)
    cv.vline(lx1 - 1, 8, 11, W_SH1)
    cv.rows(lx0 + 4, 8, ["aGGGLa", "aGMMLa", ".aaaa."], {'a': OUT, 'G': GL_D, 'M': GL_M, 'L': GL_L})
    cv.hline(lx0, lx1, 12, OUT)
    for x in range(lx0 + 1, lx1 + 2):   # lantern shadow on the shingles (falls south-east)
        cv.p(x, 13, TEAL[4] if x <= lx1 else TEAL[3])
    cv.vline(lx1 + 1, 7, 12, TEAL[3])

    # walls between stone pillars (warm wood cap and dark wood foot tie them to the houses' posts)
    stone_pillar(cv, 3, 33, 59)
    stone_pillar(cv, 56, 33, 59)
    for px in (3, 56):
        cv.p(px + 1, 33, WD_L)
        cv.p(px + 2, 33, WD_M)
        cv.p(px + 3, 33, WD_D)
        cv.p(px + 1, 34, WD_M)
        cv.p(px + 2, 34, WD_D)
        cv.p(px + 3, 34, WD_D)
        cv.hline(px + 1, px + 3, 59, WD_DD)
    wall(cv, 8, 55, 33, 59, W_HI)
    # teal wainscot band (rows 51..59)
    cv.hline(8, 55, 51, OUT)
    cv.hline(8, 55, 52, TEAL[0])
    cv.rect(8, 53, 55, 57, TEAL[1])
    for x in range(8, 56):      # panel insets: lit left edge, shaded right edge, 8 px apart
        k = (x - 8) % 8
        if k == 1:
            cv.vline(x, 54, 56, TEAL[0])
        elif k == 6:
            cv.vline(x, 54, 56, TEAL[2])
        elif 1 < k < 6:
            cv.p(x, 56, TEAL[2])
    cv.hline(8, 55, 58, TEAL[3])
    cv.hline(8, 55, 59, TEAL[4])
    foundation(cv, 4, 59, 60)

    # left narrow window, right double window
    window(cv, 9, 38, 1, 3, 7)
    window(cv, 35, 37, 2, 7, 7)
    # glass double door (tile 13 = x16..31) and its canopy
    glass_doors(cv, 16, 42, 30, 59)
    striped_awning(cv, 15, 31, 38, TEAL)

    # sign board on the eave: pink heart between two leaf sprigs (care / herbs - no cross, no red)
    board(cv, 20, 17, 43, 33)
    heart(cv, 26, 20)
    sprig(cv, 23, 25)
    sprig(cv, 37, 25, flip=True)
    cv.hline(21, 44, 34, W_SH2)    # board shadow on the wall below the eave
    cv.p(44, 33, TEAL[4])
    return cv.im


POTION = [  # stoppered flask: cork, glass neck, round body with orange liquid, glint
    "..acca..",
    "..adda..",
    "..aGLa..",
    ".aGGLLa.",
    "aGGGGLLa",
    "aOOOOOOa",
    "aORROOOa",
    "aOROOODa",
    "aOOODDDa",
    ".aaaaaa.",
]


def draw_mart():
    cv = Canvas()
    roof(cv, 1, 62, 0, 32, VIOLET)
    # standing roof sign: board on two legs, flask emblem + gold sparkle dots
    board(cv, 17, 4, 46, 21, W_HI, W_MID)
    for lx in (22, 40):
        cv.vline(lx, 22, 26, OUT)
        cv.vline(lx + 1, 22, 26, WD_M)
        cv.vline(lx + 2, 22, 26, OUT)
        cv.hline(lx - 1, lx + 3, 27, VIOLET[4])   # leg shadow on the shingles
    cv.hline(18, 47, 22, VIOLET[4])                # board shadow on the roof
    cv.vline(47, 5, 22, VIOLET[3])
    cv.rows(28, 7, POTION, {'a': OUT, 'c': WD_L, 'd': WD_D, 'G': GL_M, 'L': GL_L,
                            'O': ORANGE[1], 'R': ORANGE[0], 'D': ORANGE[3]})
    cv.rows(21, 8, ["..1..", ".121.", "..1.."], {'1': GOLD, '2': WHITE})
    cv.rows(38, 13, ["..1..", ".121.", "..1.."], {'1': GOLD, '2': WHITE})
    cv.p(23, 15, GOLD_D)
    cv.p(41, 8, GOLD_D)

    # walls
    post(cv, 3, 33, 59)
    post(cv, 56, 33, 59)
    wall(cv, 8, 55, 33, 59)
    foundation(cv, 4, 59, 60)
    for x in (4, 5, 6, 57, 58, 59):
        cv.p(x, 59, WD_DD)
    # long awning across the front (orange/white, like shop_a)
    striped_awning(cv, 7, 56, 35, ORANGE)
    # under the awning: wall shadow rows
    cv.hline(8, 55, 42, W_SH2)
    cv.hline(8, 55, 43, W_SH1)
    # left narrow window
    window(cv, 9, 46, 1, 4, 5)
    # display window with shelves of goods (right)
    dx0, dy0, dx1, dy1 = 34, 46, 54, 56
    cv.box(dx0, dy0, dx1, dy1, OUT)
    cv.rect(dx0 + 1, dy0 + 1, dx1 - 1, dy1 - 1, WHITE)
    cv.rect(dx0 + 2, dy0 + 2, dx1 - 2, dy1 - 2, GL_M)
    cv.hline(dx0 + 2, dx1 - 2, dy0 + 2, GL_D)
    goods = [ORANGE[1], LEAF[1], GOLD, ST_HI, VIOLET[1], ORANGE[0], LEAF[0], GOLD]
    for si, sy in enumerate((dy0 + 5, dy0 + 8)):
        cv.hline(dx0 + 2, dx1 - 2, sy, WD_M)
        cv.hline(dx0 + 2, dx1 - 2, sy + 1, WD_D)
        for gi, gx in enumerate(range(dx0 + 3, dx1 - 2, 3)):
            c = goods[(gi + si * 3) % len(goods)]
            cv.p(gx, sy - 1, c)
            cv.p(gx + 1, sy - 1, c)
            cv.p(gx, sy - 2, c if gi % 2 else WHITE)
    for g in ((dx0 + 3, dy0 + 3), (dx0 + 4, dy0 + 3), (dx1 - 6, dy0 + 3)):
        cv.p(g[0], g[1], GL_L)
    cv.vline(dx1 - 1, dy0 + 2, dy1 - 1, ST_HI)
    cv.hline(dx0 - 1, dx1 + 1, dy1 + 1, OUT)
    # glass double door
    glass_doors(cv, 16, 44, 30, 59, (WD_L, WD_M, WD_D))
    return cv.im


def draw_kit(kind):
    return draw_center() if kind == 'center' else draw_mart()


def store_kit(im, cols, k, base):
    for i in range(16):
        t = base + i
        c, r = t % cols, t // cols
        im.paste(k.crop(((i % 4) * 16, (i // 4) * 16, (i % 4) * 16 + 16, (i // 4) * 16 + 16)), (c * 16, r * 16))


def main():
    import json
    dry = sys.argv[2] if len(sys.argv) > 2 and sys.argv[1] == '--dry' else None
    path = KIT % SHEET
    im = Image.open(path).convert('RGBA')
    cols = im.width // 16
    old = im.crop((0, 0, im.width, OLD_COUNT // cols * 16))  # pristine old cells
    new_count = OLD_COUNT + 16 * len(KITS)
    out = Image.new('RGBA', (im.width, new_count // cols * 16), T)
    out.paste(old, (0, 0))
    kits_out = []
    for src, dst, kind in KITS:
        k = draw_kit(kind)
        store_kit(out, cols, k, dst)
        kits_out.append(k)
    if dry:
        sheet = Image.new('RGBA', (len(kits_out) * 68, 68), (88, 128, 80, 255))
        for i, k in enumerate(kits_out):
            sheet.alpha_composite(k, (i * 68 + 2, 2))
        sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(dry)
        return
    out.save(path)
    print('wrote', path, out.size)
    d = json.load(open(JSON_PATH))
    for key in ('passability', 'priority', 'terrain', 'tileMeta'):
        del d[key][OLD_COUNT:]
        for src, dst, kind in KITS:
            for i in range(16):
                v = d[key][src + i]
                d[key].append(json.loads(json.dumps(v)))
    d['count'] = new_count
    json.dump(d, open(JSON_PATH, 'w'), ensure_ascii=False, separators=(',', ':'))
    txt = open(INDEX_PATH).read()
    txt = re.sub(r'("id": "monster_overworld".*?"count": )\d+', lambda m: m.group(1) + str(new_count), txt, count=1, flags=re.S)
    open(INDEX_PATH, 'w').write(txt)
    print('json count ->', new_count)


if __name__ == '__main__':
    main()
