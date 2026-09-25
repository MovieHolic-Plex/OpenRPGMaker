"""Rig painters (masts, yards, square sails facing the viewer — the usual RPG look — flags) for vehicle_art ships."""
from __future__ import annotations

import math

from vehicle_art import Canvas, R_DEEP, R_HI, R_MID, R_DARK

SAIL = {
    # light, mid, shade, outline, seam
    "canvas": ((244, 238, 216), (226, 214, 184), (196, 178, 146), (104, 84, 62), (208, 194, 162)),
    "dark": ((88, 84, 92), (70, 66, 74), (52, 48, 56), (24, 20, 26), (60, 56, 64)),
    "royal": ((214, 64, 52), (184, 44, 38), (140, 28, 30), (70, 14, 16), (164, 36, 34)),
    "sky": ((236, 240, 244), (212, 222, 232), (170, 186, 204), (64, 76, 96), (196, 208, 222)),
    "patched": ((232, 222, 196), (214, 198, 164), (182, 162, 126), (98, 78, 56), (196, 180, 146)),
}
POLE = [R_DEEP, R_HI, R_MID, R_DARK]
ROPE = (150, 118, 80)
BONE = (236, 232, 222)


def paint_pole(c: Canvas, x: int, y_top: int, y_bot: int):
    for y in range(y_top, y_bot):
        for i, col in enumerate(POLE):
            c.set(x - 2 + i, y, col)
    for i in range(-3, 3):
        c.set(x + i, y_top - 1, R_DEEP)
        c.set(x + i, y_top, R_DARK if i in (-3, 2) else R_HI)


def paint_mast_base(c: Canvas, x: int, y: int):
    """Collar where the mast meets the deck (ellipse 12×7)."""
    for dy in range(-3, 4):
        for dx in range(-6, 6):
            e = (dx + 0.5) ** 2 / 36 + dy ** 2 / 9
            if e <= 1:
                col = R_DEEP if e > 0.55 else (R_DARK if dy >= 0 else R_MID)
                c.set(x + dx, y + dy, col)
    for i, col in enumerate(POLE):
        for yy in range(y - 6, y + 1):
            c.set(x - 2 + i, yy, col)


def paint_yard(c: Canvas, x: int, y: int, half: int):
    for dx in range(-half, half):
        c.set(x + dx, y - 1, R_DEEP)
        c.set(x + dx, y, R_HI)
        c.set(x + dx, y + 1, R_DARK)
    for dx in (-half - 1, half):
        for dy in (-1, 0, 1):
            c.set(x + dx, y + dy, R_DEEP)


def paint_skull(c: Canvas, x: int, y: int, col=BONE, shade=(170, 164, 152)):
    rows = ["..XXXXX..", ".XXXXXXX.", "XXXXXXXXX", "XX..X..XX", "XX..X..XX", "XXXXXXXXX", ".XXX.XXX.", "..X.X.X..",
            "X.......X", ".X.....X.", "..X...X..", ".X.....X.", "X.......X"]
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch == "X":
                c.set(x - 4 + dx, y - 6 + dy, col if dy < 8 else shade)


def paint_sail(c: Canvas, x: int, y: int, half: int, h: int, scheme="canvas", emblem=None, torn=False, belly=5):
    """Square sail hanging below a yard at (x, y): half-width `half`, height h, billowing `belly` px at the foot."""
    light, mid, shade, outline, seam = SAIL[scheme]
    for dx in range(-half, half):
        u = (dx + half) / (2 * half)
        foot = h + int(round(belly * math.sin(math.pi * u)))
        for dy in range(1, foot + 1):
            if torn and dy > foot - 7 and ((dx * 7 + dy * 3) % 13 == 0 or ((dx + 40) // 4) % 4 == 1 and dy > foot - 3):
                continue
            edge = dx in (-half, half - 1) or dy == foot
            if edge:
                col = outline
            else:
                v = dy / foot
                shading = u * 0.9 + v * 0.45 - 0.4 * math.sin(math.pi * u)
                col = light if shading < 0.3 else (mid if shading < 0.72 else shade)
                if (dx + half) % 9 == 0 and dy < foot - 1:
                    col = seam if col != shade else outline
                if dy in (h // 3, (2 * h) // 3) and dx % 2 == 0:
                    col = seam
            c.set(x + dx, y + dy, col)
    if emblem == "skull":
        paint_skull(c, x, y + h // 2 + 1)
    elif emblem == "cross":
        red, deep = (196, 40, 36), (150, 24, 24)
        for dy in range(3, h):
            for dx in (-2, -1, 0, 1):
                c.set(x + dx, y + dy, red if dx > -2 else deep)
        for dx in range(-half + 4, half - 4):
            for dy in (h // 2 - 1, h // 2, h // 2 + 1):
                c.set(x + dx, y + dy, red if dy < h // 2 + 1 else deep)
    elif emblem == "stripes":
        blue, blue2 = (70, 110, 184), (52, 86, 150)
        for dx in range(-half + 1, half - 1):
            if ((dx + half) // 6) % 2 == 1:
                for dy in range(2, h + 6):
                    px = c.get(x + dx, y + dy)
                    if px[3] and px[:3] != outline:
                        c.set(x + dx, y + dy, blue if px[:3] in (light, mid, seam) else blue2)
    elif emblem == "sun":
        gold, deep = (238, 196, 72), (200, 140, 36)
        cy = y + h // 2 + 1
        for dy in range(-7, 8):
            for dx in range(-7, 8):
                r = math.hypot(dx, dy)
                ang = (math.atan2(dy, dx) * 8 / math.pi) % 2
                if r <= 3.6 or (r <= 6.8 and ang < 0.7):
                    c.set(x + dx, cy + dy, gold if r < 3 else deep)


def paint_furled(c: Canvas, x: int, y: int, half: int, scheme="canvas"):
    """Sail rolled up on its yard: a lumpy roll with rope ties."""
    light, mid, shade, outline, seam = SAIL[scheme]
    for dx in range(-half + 1, half - 1):
        lump = 1 if (dx // 5) % 2 == 0 else 0
        for dy in range(1, 6 + lump):
            col = outline if dy == 5 + lump else (light if dy <= 2 else (mid if dy <= 4 else shade))
            c.set(x + dx, y + dy, col)
        if (dx + half) % 10 == 5:
            for dy in range(1, 6 + lump):
                c.set(x + dx, y + dy, ROPE if dy < 5 + lump else outline)


FLAG = {"red": ((214, 52, 44), (160, 28, 30)), "black": ((44, 40, 48), (18, 14, 20)), "blue": ((60, 110, 196), (34, 70, 140)),
        "gold": ((240, 200, 80), (190, 140, 40)), "green": ((72, 160, 80), (40, 110, 52))}


def paint_flag(c: Canvas, x: int, y: int, scheme="red"):
    a, b = FLAG[scheme]
    for dy in range(0, 7):
        length = 12 - abs(dy - 3)
        for dx in range(0, length):
            wave = 1 if (dx // 3) % 2 == 0 else 0
            c.set(x + 1 + dx, y + dy + wave, a if dy < 4 else b)
    if scheme == "black":
        for (dx, dy) in ((4, 2), (5, 2), (6, 2), (4, 3), (6, 3), (5, 4)):
            c.set(x + 1 + dx, y + dy + 1, BONE)


def paint_mast(c: Canvas, x: int, deck_y: int, height: int, sails, scheme="canvas", furled=False, emblem=None, torn=False,
               flag="red", nest=False):
    """A mast standing at (x, deck_y) rising `height` px, square sails [(yard offset from the top, half width, height)]."""
    top = deck_y - height
    paint_pole(c, x, top, deck_y)
    for k, (off, half, h) in enumerate(sails):
        yy = top + off
        if furled:
            paint_furled(c, x, yy, half, scheme)
        else:
            paint_sail(c, x, yy, half, h, scheme, emblem if k == len(sails) - 1 else None, torn)
        paint_yard(c, x, yy, half)
    if furled or not sails:
        # the bare pole shows between the rolled sails
        for y in range(top, deck_y - 6):
            if c.get(x, y)[:3] not in (SAIL[scheme][0], SAIL[scheme][1], SAIL[scheme][2], SAIL[scheme][3], ROPE):
                for i, col in enumerate(POLE):
                    if c.get(x - 2 + i, y)[3] == 0 or c.get(x - 2 + i, y)[:3] in POLE:
                        c.set(x - 2 + i, y, col)
    if nest:
        ny = top + 6
        for dx in range(-6, 6):
            c.set(x + dx, ny, R_DEEP)
            c.set(x + dx, ny + 1, R_HI if -5 < dx < 5 else R_DARK)
            c.set(x + dx, ny + 2, R_MID)
            c.set(x + dx, ny + 3, R_DARK)
            c.set(x + dx, ny + 4, R_DEEP)
    paint_mast_base(c, x, deck_y)
    if flag:
        for yy in range(top - 9, top):
            c.set(x, yy, R_DEEP)
            c.set(x + 1, yy, R_MID)
        paint_flag(c, x + 1, top - 9, flag)
