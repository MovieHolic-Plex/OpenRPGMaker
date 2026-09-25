"""Pixel painters for tiledata/atlas-scenes vehicles (ships, airship, carts) in the EasyRPG ship-sheet style.

Every vehicle is painted at pixel level on its own canvas (so hull curves, rails and sails are not tied to the
half-tile offsets of the EasyRPG ship sheet), then sliced into 16px tiles by build_vehicles.py, which de-duplicates
tiles and writes public/assets/atlas-scenes/vehicles.png. Textures and colours are sampled from the EasyRPG ship sheet
(CC0): deck planks are sheet tiles 14 (red-brown) / 13 (light), the rail and hull palettes are the ones the sheet's
own hull pieces use (measured on the approved 「푸른물결호」 deck).

Coordinates: canvas pixels, 16px per tile. A ship is laid out bow-left; build_vehicles mirrors it for bow-right.
"""
from __future__ import annotations

import math
from PIL import Image

SHIP_SHEET = "public/assets/easyrpg-chipset-ship-transparent.png"
KEY = (255, 103, 139)

# Rail / hull palette (EasyRPG ship sheet).
R_DARK = (99, 49, 11)
R_HI = (213, 145, 71)
R_MID = (154, 84, 53)
R_DEEP = (65, 30, 5)
BLACK = (0, 0, 0)
R_WARM = (109, 59, 21)
DECK_SHADE = (122, 83, 69)

_sheet = None


def sheet() -> Image.Image:
    global _sheet
    if _sheet is None:
        im = Image.open(SHIP_SHEET).convert("RGBA")
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                if px[x, y][:3] == KEY:
                    px[x, y] = (0, 0, 0, 0)
        _sheet = im
    return _sheet


def sheet_tile(n: int) -> Image.Image:
    s = sheet()
    x, y = (n % 30) * 16, (n // 30) * 16
    return s.crop((x, y, x + 16, y + 16))


class Canvas:
    """RGBA canvas with helpers. (0,0,0,0) = transparent (water shows through)."""

    def __init__(self, w: int, h: int):
        self.w, self.h = w, h
        self.im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.px = self.im.load()

    def set(self, x, y, c, a=255):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = (c[0], c[1], c[2], a)

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[x, y]
        return (0, 0, 0, 0)

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1):
            for x in range(x0, x1):
                self.set(x, y, c)

    def paste(self, img: Image.Image, x, y):
        self.im.alpha_composite(img, (x, y))
        self.px = self.im.load()


def texture_tile(n: int):
    t = sheet_tile(n)
    return [[t.getpixel((x, y)) for x in range(16)] for y in range(16)]


# Hull side planks (16 px period, horizontal planks with a butt joint), top → bottom. Measured on the approved deck.
SIDE_ROWS = [R_DEEP, R_DEEP, R_MID, R_WARM, R_WARM, R_DARK, R_DEEP, R_WARM, R_WARM, R_DARK, R_DARK, R_DEEP,
             R_WARM, R_DARK, R_DARK, R_DARK, R_DEEP, R_DARK, R_DARK, R_DEEP, R_DARK, R_DEEP]
SIDE_FOOT = [R_DEEP, BLACK, R_DEEP, BLACK, BLACK]


def side_color(x: int, dy: int, joints=()) -> tuple:
    """Hull side face pixel dy rows below the rail foot (long horizontal planks, no brick joints)."""
    if dy < len(SIDE_ROWS):
        return SIDE_ROWS[dy]
    return None


# Rail cross-section, north → south (light from the north): outer rim, 2px lit top, body, dark, 2px shadow.
RAIL = [R_DARK, R_HI, R_HI, R_MID, R_DEEP, BLACK, BLACK]
# Inside face of the far (north) bulwark, seen over the rail, down to the deck.
BULWARK_IN = [R_DEEP, R_DEEP, R_DARK, R_DARK, R_MID, R_WARM]
# Near (south) rail: from the deck side down to the outer edge.
RAIL_SOUTH = [R_DARK, R_HI, R_HI, R_MID, R_DEEP, BLACK, BLACK, R_DEEP, R_DEEP]
# Bow/stern rails whose outline faces west/east.
RAIL_SIDE = [R_DARK, R_HI, R_HI, R_MID, R_DEEP, BLACK]


def hull_mask(W: int, H: int, top, bot, x0: int, x1: int):
    """Inside mask of the deck footprint: rows top(x)..bot(x) for x in [x0, x1)."""
    inside = [[False] * W for _ in range(H)]
    for x in range(max(0, x0), min(W, x1)):
        t, b = top(x), bot(x)
        if t is None or b is None:
            continue
        for y in range(max(0, int(math.ceil(t))), min(H, int(math.floor(b)) + 1)):
            inside[y][x] = True
    return inside


def paint_hull(c: Canvas, inside, deck_tex, side_h: int = 22, deck_shadow=True, joints=()):
    """Paint side face, rails, bulwark and deck from a footprint mask."""
    W, H = c.w, c.h
    # side face: every pixel below a footprint pixel, within side_h rows, not itself inside.
    for x in range(W):
        for y in range(H):
            if inside[y][x]:
                continue
            # distance down from the nearest footprint pixel above in this column
            d = None
            for k in range(1, side_h + len(SIDE_FOOT) + 1):
                if y - k >= 0 and inside[y - k][x]:
                    d = k
                    break
            if d is None:
                continue
            dy = d - 1
            col = side_color(x, dy, joints) if dy < side_h else None
            if col is None:
                fi = dy - side_h
                if 0 <= fi < len(SIDE_FOOT):
                    col = SIDE_FOOT[fi]
            if col is not None:
                c.set(x, y, col)
    # distances inside the footprint to the outline in four directions
    def run(x, y, dx, dy):
        n = 0
        while True:
            x += dx; y += dy
            if not (0 <= x < W and 0 <= y < H) or not inside[y][x]:
                return n
            n += 1
    for y in range(H):
        for x in range(W):
            if not inside[y][x]:
                continue
            up, down, left, right = run(x, y, 0, -1), run(x, y, 0, 1), run(x, y, -1, 0), run(x, y, 1, 0)
            col = None
            horiz = min(left, right)
            if up < len(RAIL) + len(BULWARK_IN) and up <= down:
                if horiz < len(RAIL_SIDE) and horiz < up:
                    col = RAIL_SIDE[horiz]
                else:
                    seq = RAIL + BULWARK_IN
                    col = seq[up]
            elif down < len(RAIL_SOUTH):
                if horiz < len(RAIL_SIDE) and horiz < down:
                    col = RAIL_SIDE[horiz]
                else:
                    col = RAIL_SOUTH[len(RAIL_SOUTH) - 1 - down]
            elif horiz < len(RAIL_SIDE):
                col = RAIL_SIDE[horiz]
            elif horiz < len(RAIL_SIDE) + 3 and deck_shadow:
                col = DECK_SHADE
            if col is None:
                p = deck_tex[y % 16][x % 16]
                c.set(x, y, p[:3])
            else:
                c.set(x, y, col)


def ship_outline(length_px: int, beam_px: int, bow_px: int, stern_px: int, ox: int, oy: int, stern="round", bow_power=1.7):
    """top(x)/bot(x) of a bow-left hull: an ogive bow of bow_px, straight waist, rounded or square stern."""
    mid = oy + beam_px / 2
    half = beam_px / 2

    def half_at(x):
        u = x - ox
        if u < 0 or u > length_px:
            return None
        if u < bow_px:
            t = u / bow_px
            return max(0.0, half * (1 - (1 - t) ** bow_power))
        v = length_px - u
        if v < stern_px:
            if stern == "square":
                return half * (0.86 + 0.14 * math.sqrt(max(0.0, v / stern_px)))
            t = v / stern_px
            return half * math.sqrt(max(0.0, 1 - (1 - t) ** 2)) ** 0.5
        return half

    def top(x):
        h = half_at(x)
        return None if h is None else mid - h

    def bot(x):
        h = half_at(x)
        return None if h is None else mid + h - 1

    return top, bot


def mirror(img: Image.Image) -> Image.Image:
    return img.transpose(Image.FLIP_LEFT_RIGHT)
