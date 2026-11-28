#!/usr/bin/env python3
"""Worker 4 (object-gen-v2 Carbon Medium pure 1-pass):
Korean PC-Bang Wall-Mounted Props & Floor/Wall Tile Sheets.

Generates 8 palette-locked 1x PNGs + 4x NEAREST previews into
tiledata/modern-city/pcbang-ogv2/pieces/ and validates via objectgen_v2.palette.verify_sprite.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, "/home/main/object-gen-v2")
from objectgen_v2.palette import load_palette, verify_sprite  # noqa: E402

PALETTE_PATH = Path("/home/main/object-gen-v2/palettes/fable-city.json")
WORKTREE = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
OUT_DIR = WORKTREE / "tiledata/modern-city/pcbang-ogv2/pieces"


def load_ramps(path: Path) -> dict[str, list[tuple[int, int, int, int]]]:
    raw = json.loads(path.read_text(encoding="utf-8"))["ramps"]
    ramps: dict[str, list[tuple[int, int, int, int]]] = {}
    for name, hexes in raw.items():
        ramps[name] = [
            (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)
            for h in hexes
        ]
    return ramps


R = load_ramps(PALETTE_PATH)
TRANSPARENT = (0, 0, 0, 0)


def new_canvas(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), TRANSPARENT)


def px(im: Image.Image, x: int, y: int, c: tuple[int, int, int, int]) -> None:
    if 0 <= x < im.width and 0 <= y < im.height:
        im.putpixel((x, y), c)


def hline(im: Image.Image, x0: int, x1: int, y: int, c: tuple[int, int, int, int]) -> None:
    for x in range(x0, x1 + 1):
        px(im, x, y, c)


def vline(im: Image.Image, x: int, y0: int, y1: int, c: tuple[int, int, int, int]) -> None:
    for y in range(y0, y1 + 1):
        px(im, x, y, c)


def rect(im: Image.Image, x0: int, y0: int, x1: int, y1: int, c: tuple[int, int, int, int]) -> None:
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px(im, x, y, c)


# ---------------------------------------------------------------------------
# 1. pcb3-digital-menu.png (32x32, 2x2 hang)
#    Tilted Dual-Screen PC-Bang Digital Menu Board
# ---------------------------------------------------------------------------
def build_digital_menu() -> Image.Image:
    im = new_canvas(32, 32)
    kuro = R["kuro"]
    ink = R["ink"]
    steel = R["steel"]
    kawara = R["kawara"]
    navy = R["navy"]
    glass = R["glass"]
    orange = R["orange"]
    yellow = R["yellow"]
    red = R["red"]
    pink = R["pink"]
    teal = R["teal"]
    foliage = R["foliage"]
    cw = R["coolwhite"]
    cream = R["cream"]
    blue = R["blue"]

    # y=1..5: Dual ceiling suspension rods (x=7..8, x=23..24)
    for rx in (7, 23):
        hline(im, rx - 1, rx + 2, 1, steel[2])
        px(im, rx - 1, 1, kuro[0])
        px(im, rx + 2, 1, kuro[0])
        px(im, rx, 1, steel[4])
        px(im, rx + 1, 1, steel[2])
        for ry in (2, 3):
            px(im, rx, ry, steel[4])
            px(im, rx + 1, ry, steel[1])

    # y=3..5: 3/4 top housing bevel (x=1..30, rounded outer corners)
    # y=3: tapered back-top edge x=3..28
    hline(im, 3, 28, 3, kuro[0])
    hline(im, 4, 27, 3, kawara[2])
    # Rod collar integration on y=3
    for rx in (7, 23):
        px(im, rx - 1, 3, kuro[1])
        px(im, rx, 3, steel[4])
        px(im, rx + 1, 3, steel[2])
        px(im, rx + 2, 3, kuro[1])

    # y=4: 3/4 angled top deck x=2..29
    px(im, 2, 4, kuro[0])
    px(im, 29, 4, kuro[0])
    hline(im, 3, 18, 4, kawara[4])
    hline(im, 19, 28, 4, kawara[3])
    for seam_x in (9, 15, 16, 22):
        px(im, seam_x, 4, kawara[2])
    px(im, 7, 4, steel[3])
    px(im, 8, 4, steel[2])
    px(im, 23, 4, steel[3])
    px(im, 24, 4, steel[2])

    # y=5: forward-tilted top bezel nose ridge x=1..30
    px(im, 1, 5, kuro[0])
    px(im, 30, 5, kuro[0])
    px(im, 2, 5, kawara[3])
    hline(im, 3, 14, 5, kawara[4])
    hline(im, 4, 11, 5, steel[5])
    px(im, 15, 5, kuro[1])
    px(im, 16, 5, kawara[2])
    hline(im, 17, 27, 5, kawara[4])
    hline(im, 18, 22, 5, steel[4])
    px(im, 28, 5, kawara[3])
    px(im, 29, 5, kawara[2])

    # y=6..26: Outer housing frame + center mullion + dual recessed screens
    for y in range(6, 26):
        px(im, 1, y, kuro[0])
        px(im, 2, y, kawara[3] if y < 14 else kawara[2])
        px(im, 15, y, kuro[0])
        px(im, 16, y, kuro[2] if y < 18 else kuro[1])
        px(im, 29, y, kuro[1])
        px(im, 30, y, kuro[0])

    # Top overhang shadow inside both screen wells (y=6)
    hline(im, 3, 14, 6, kuro[0])
    hline(im, 17, 28, 6, kuro[0])

    # Left screen background (x=3..14, y=7..25)
    rect(im, 3, 7, 14, 25, navy[0])
    # Subtle glass sheen upper-left of left screen
    for gx, gy in ((3, 10), (4, 10), (3, 11)):
        px(im, gx, gy, glass[0])

    # Left Screen Warm Header Bar (y=7..8, x=3..14)
    hline(im, 3, 10, 7, orange[5])
    hline(im, 11, 14, 7, orange[4])
    hline(im, 3, 14, 8, orange[3])
    for tx in (4, 5, 7, 8, 10):
        px(im, tx, 8, yellow[5])
    px(im, 12, 8, red[3])
    px(im, 13, 8, red[4])
    hline(im, 3, 14, 9, kuro[0])

    # Left Screen: Miniature Steaming Ramen Bowl (x=3..9, y=10..16)
    px(im, 5, 10, cw[4])
    px(im, 7, 10, cw[5])
    px(im, 4, 11, cw[5])
    px(im, 6, 11, cw[3])
    px(im, 8, 11, glass[5])
    # Noodles, soft-boiled egg & green onion (y=12..13)
    px(im, 4, 12, yellow[4])
    px(im, 5, 12, yellow[5])
    px(im, 6, 12, cw[5])      # egg white
    px(im, 7, 12, orange[4])  # egg yolk
    px(im, 8, 12, foliage[5]) # scallion
    px(im, 3, 13, red[3])
    px(im, 4, 13, yellow[5])
    px(im, 5, 13, yellow[4])
    px(im, 6, 13, orange[3])
    px(im, 7, 13, yellow[4])
    px(im, 8, 13, foliage[4])
    px(im, 9, 13, red[2])
    # Red ramen bowl (y=14..16)
    px(im, 3, 14, red[5])
    hline(im, 4, 7, 14, red[4])
    px(im, 5, 14, yellow[4])
    px(im, 7, 14, yellow[4])
    px(im, 8, 14, red[3])
    px(im, 9, 14, red[2])
    px(im, 4, 15, red[4])
    hline(im, 5, 7, 15, red[3])
    px(im, 8, 15, red[2])
    px(im, 5, 16, cw[4])
    px(im, 6, 16, cw[5])
    px(im, 7, 16, cw[2])

    # Ramen label & price dots (x=10..13, y=11..15)
    px(im, 10, 11, cw[4])
    px(im, 11, 11, cw[4])
    px(im, 13, 11, cw[3])
    px(im, 10, 12, yellow[5])
    px(im, 12, 12, yellow[4])
    px(im, 13, 12, yellow[4])
    px(im, 10, 14, orange[4])
    px(im, 11, 14, orange[4])
    px(im, 10, 15, cw[4])
    px(im, 12, 15, yellow[4])
    px(im, 13, 15, yellow[4])

    # Left Screen: Golden Hotdog / Corndog + Price (y=18..20)
    px(im, 4, 18, yellow[4])
    px(im, 5, 18, orange[4])
    px(im, 6, 18, yellow[5])  # mustard zig
    px(im, 7, 18, orange[4])
    px(im, 3, 19, red[4])     # sausage tip
    px(im, 4, 19, orange[4])
    px(im, 5, 19, red[4])     # ketchup zig
    px(im, 6, 19, orange[4])
    px(im, 7, 19, orange[3])
    px(im, 8, 19, cream[4])   # wooden stick
    px(im, 9, 19, cream[3])
    # Hotdog title + price
    px(im, 10, 18, cw[4])
    px(im, 11, 18, cw[3])
    px(im, 13, 18, cw[4])
    px(im, 11, 19, yellow[5])
    px(im, 12, 19, yellow[4])
    px(im, 13, 19, yellow[4])

    # Left Screen: Crisp lower menu text rows (y=21, y=23..24)
    for ry, tag_c, w_len in ((21, orange[4], 4), (23, red[4], 3)):
        px(im, 4, ry, tag_c)
        for mx in range(6, 6 + w_len):
            px(im, mx, ry, cw[4] if mx % 2 == 0 else cw[3])
        px(im, 11, ry, yellow[4])
        px(im, 12, ry, yellow[5])
        px(im, 13, ry, yellow[4])

    # Right screen background (x=17..28, y=7..25)
    rect(im, 17, 7, 28, 25, glass[0])
    for gy in range(20, 26):
        hline(im, 17, 28, gy, navy[0])

    # Right Screen Cool Cyan Header Bar (y=7..8, x=17..28)
    hline(im, 17, 24, 7, glass[5])
    hline(im, 25, 28, 7, glass[4])
    hline(im, 17, 28, 8, glass[4])
    for tx in (18, 19, 21, 22, 24):
        px(im, tx, 8, cw[5])
    px(im, 26, 8, teal[5])
    px(im, 27, 8, glass[6])
    hline(im, 17, 28, 9, kuro[0])

    # Cup 1: Pink Grapefruit Iced Ade (x=18..21, y=10..17)
    px(im, 20, 10, cw[5])  # bent white straw
    px(im, 21, 10, cw[4])
    px(im, 20, 11, cw[5])
    # Clear dome lid (y=12)
    px(im, 18, 12, glass[4])
    px(im, 19, 12, cw[5])
    px(im, 20, 12, glass[5])
    px(im, 21, 12, glass[3])
    # Pink grapefruit body (y=13..17)
    px(im, 18, 13, pink[4])
    px(im, 19, 13, cw[5])     # ice cube
    px(im, 20, 13, pink[5])
    px(im, 21, 13, pink[3])
    px(im, 18, 14, pink[4])
    px(im, 19, 14, pink[5])
    px(im, 20, 14, orange[4]) # grapefruit slice
    px(im, 21, 14, pink[3])
    for cy in (15, 16):
        px(im, 18, cy, pink[3])
        px(im, 19, cy, pink[4])
        px(im, 20, cy, pink[3])
        px(im, 21, cy, pink[2])
    px(im, 18, 17, glass[2])
    px(im, 19, 17, pink[3])
    px(im, 20, 17, pink[2])
    px(im, 21, 17, glass[1])

    # Cup 2: Blue Lemon Iced Ade (x=24..27, y=10..17)
    px(im, 25, 10, cw[5])  # bent white straw
    px(im, 26, 10, cw[4])
    px(im, 25, 11, cw[5])
    # Clear dome lid (y=12)
    px(im, 24, 12, glass[4])
    px(im, 25, 12, cw[5])
    px(im, 26, 12, glass[5])
    px(im, 27, 12, glass[3])
    # Blue lemon body (y=13..17)
    px(im, 24, 13, glass[5])
    px(im, 25, 13, cw[5])     # ice cube
    px(im, 26, 13, glass[6])
    px(im, 27, 13, glass[4])
    px(im, 24, 14, glass[5])
    px(im, 25, 14, yellow[5]) # lemon slice
    px(im, 26, 14, glass[5])
    px(im, 27, 14, glass[4])
    px(im, 24, 15, glass[4])
    px(im, 25, 15, glass[5])
    px(im, 26, 15, blue[4])
    px(im, 27, 15, blue[3])
    px(im, 24, 16, blue[4])
    px(im, 25, 16, glass[4])
    px(im, 26, 16, blue[3])
    px(im, 27, 16, blue[2])
    px(im, 24, 17, glass[2])
    px(im, 25, 17, blue[3])
    px(im, 26, 17, blue[2])
    px(im, 27, 17, glass[1])

    # Cup price dots (y=19) + crisp drink menu rows (y=21, y=23)
    px(im, 19, 19, yellow[5])
    px(im, 20, 19, yellow[4])
    px(im, 25, 19, yellow[5])
    px(im, 26, 19, yellow[4])

    for ry, dot_c, w_len in ((21, pink[4], 4), (23, glass[5], 3)):
        px(im, 18, ry, dot_c)
        for mx in range(20, 20 + w_len):
            px(im, mx, ry, cw[4] if mx % 2 == 0 else cw[3])
        px(im, 25, ry, glass[5])
        px(im, 26, ry, cw[4])
        px(im, 27, ry, glass[5])

    # y=26: Lower bezel (rounded outer corners x=2..29)
    px(im, 2, 26, kuro[0])
    hline(im, 3, 14, 26, kawara[2])
    px(im, 13, 26, foliage[5])  # green power LED (left display)
    px(im, 15, 26, kuro[0])
    px(im, 16, 26, kuro[1])
    hline(im, 17, 28, 26, kawara[2])
    px(im, 27, 26, glass[5])    # cyan power LED (right display)
    px(im, 29, 26, kuro[0])

    # y=27: Under-bezel shadow & green/cyan power LED glow
    hline(im, 3, 28, 27, kuro[0])
    hline(im, 5, 26, 27, ink[0])
    px(im, 13, 27, foliage[4])
    px(im, 14, 27, teal[2])
    px(im, 26, 27, glass[3])
    px(im, 27, 27, glass[5])

    return im


# ---------------------------------------------------------------------------
# 2. pcb3-esports-poster.png (32x32, 2x2 hang)
#    3D Backlit Framed eSports Championship Poster
# ---------------------------------------------------------------------------
def build_esports_poster() -> Image.Image:
    im = new_canvas(32, 32)
    kuro = R["kuro"]
    ink = R["ink"]
    steel = R["steel"]
    navy = R["navy"]
    blue = R["blue"]
    glass = R["glass"]
    maple = R["maple"]
    red = R["red"]
    yellow = R["yellow"]
    orange = R["orange"]
    cw = R["coolwhite"]

    # Subtle neon wall-wash rim (x=3 cyan left, x=28 crimson right)
    for y in range(4, 28):
        if y in (4, 27):
            px(im, 3, y, glass[1])
            px(im, 28, y, maple[1])
        elif y in (5, 6, 25, 26):
            px(im, 3, y, glass[2])
            px(im, 28, y, maple[2])
        else:
            px(im, 3, y, glass[3])
            px(im, 28, y, maple[3])

    # Sculpted 3/4 dark-metallic shadowbox frame (x=4..27, y=2..29, rounded corners)
    # y=2: x=5..26 (corners (4,2) & (27,2) transparent)
    px(im, 5, 2, kuro[0])
    px(im, 26, 2, kuro[0])
    hline(im, 6, 18, 2, steel[4])
    hline(im, 8, 15, 2, steel[5])
    hline(im, 19, 25, 2, steel[3])

    # y=3: front-top metallic bevel x=4..27
    px(im, 4, 3, kuro[0])
    px(im, 27, 3, kuro[0])
    hline(im, 5, 15, 3, steel[4])
    hline(im, 16, 24, 3, steel[3])
    hline(im, 25, 26, 3, steel[2])

    # y=4: recessed shadowbox top inner overhang
    px(im, 4, 4, kuro[0])
    px(im, 5, 4, steel[2])
    hline(im, 6, 25, 4, kuro[0])
    px(im, 26, 4, kuro[1])
    px(im, 27, 4, kuro[0])

    # Side frame rails (y=5..26)
    for y in range(5, 27):
        px(im, 4, y, kuro[0])
        px(im, 5, y, steel[2] if y < 15 else kuro[2])
        px(im, 26, y, kuro[1])
        px(im, 27, y, kuro[0])

    # Inside canvas (x=6..25, y=5..26): Diagonal clash background
    for y in range(5, 27):
        split_x = 18.2 - (y - 5) * 0.28
        for x in range(6, 26):
            d = x - split_x
            if d < -4.5:
                c = navy[0]
            elif d < -1.8:
                c = navy[1]
            elif d < 0.0:
                c = navy[2]
            elif d < 1.8:
                c = maple[2]
            elif d < 4.5:
                c = maple[1]
            else:
                c = maple[0]
            px(im, x, y, c)

    # Subtle diagonal speed rays in background
    for y in range(5, 19):
        lx = 13 - (y - 5) // 2
        if 6 <= lx <= 13:
            px(im, lx, y, glass[2])
        rx = 23 - (y - 5) // 2
        if 17 <= rx <= 25:
            px(im, rx, y, red[1])

    # Cyan & Crimson Energy Wings flanking the championship cup (y=9..16)
    left_wing = [
        (7, 9, glass[6]), (8, 9, glass[5]),
        (7, 10, glass[5]), (8, 10, glass[5]), (9, 10, glass[4]),
        (8, 11, glass[4]), (9, 11, glass[5]), (10, 11, glass[4]),
        (8, 12, glass[5]), (9, 12, blue[4]), (10, 12, glass[4]),
        (9, 13, glass[4]), (10, 13, glass[5]), (11, 13, blue[4]),
        (10, 14, blue[3]), (11, 14, glass[4]), (12, 14, blue[3]),
        (9, 15, glass[4]), (10, 15, glass[3]), (11, 15, blue[3]),
        (11, 16, blue[2]), (12, 16, glass[3]),
    ]
    for wx, wy, wc in left_wing:
        px(im, wx, wy, wc)

    right_wing = [
        (24, 9, red[5]), (23, 9, red[4]),
        (24, 10, red[4]), (23, 10, red[4]), (22, 10, maple[4]),
        (23, 11, maple[4]), (22, 11, red[4]), (21, 11, maple[4]),
        (23, 12, red[4]), (22, 12, maple[3]), (21, 12, red[4]),
        (22, 13, maple[4]), (21, 13, red[4]), (20, 13, maple[3]),
        (21, 14, maple[3]), (20, 14, red[3]), (19, 14, maple[3]),
        (22, 15, red[4]), (21, 15, maple[4]), (20, 15, maple[3]),
        (20, 16, maple[2]), (19, 16, red[2]),
    ]
    for wx, wy, wc in right_wing:
        px(im, wx, wy, wc)

    # Gleaming Sculpted Golden Championship Cup (x=11..20, y=7..20)
    # y=7: Crown rim with specular spark
    px(im, 13, 7, yellow[4])
    px(im, 14, 7, cw[5])
    px(im, 15, 7, yellow[5])
    px(im, 16, 7, yellow[5])
    px(im, 17, 7, yellow[4])
    px(im, 18, 7, yellow[3])
    # y=8: Cup lip & hollow mouth
    px(im, 13, 8, yellow[5])
    px(im, 14, 8, orange[4])
    px(im, 15, 8, orange[3])
    px(im, 16, 8, yellow[2])
    px(im, 17, 8, yellow[2])
    px(im, 18, 8, yellow[4])
    # Handles (y=9..12)
    px(im, 12, 9, yellow[4])
    px(im, 11, 10, yellow[5])
    px(im, 11, 11, yellow[4])
    px(im, 12, 12, yellow[3])
    px(im, 19, 9, yellow[3])
    px(im, 20, 10, orange[4])
    px(im, 20, 11, orange[3])
    px(im, 19, 12, yellow[2])
    # Cup bowl (y=9..14)
    bowl_cols = [yellow[4], yellow[5], yellow[4], yellow[3], orange[3], yellow[1]]
    for y in range(9, 13):
        for i, c in enumerate(bowl_cols):
            px(im, 13 + i, y, c)
    px(im, 14, 9, cw[5])   # bright specular gleam
    px(im, 14, 10, cw[5])
    px(im, 15, 11, cw[5])  # center star facet
    # Tapered lower bowl (y=13..14)
    px(im, 14, 13, yellow[5])
    px(im, 15, 13, yellow[4])
    px(im, 16, 13, orange[3])
    px(im, 17, 13, yellow[2])
    px(im, 14, 14, yellow[4])
    px(im, 15, 14, yellow[4])
    px(im, 16, 14, orange[3])
    px(im, 17, 14, yellow[1])
    # Stem & collar (y=15..17)
    for y in (15, 16):
        px(im, 15, y, yellow[5])
        px(im, 16, y, orange[3])
    px(im, 14, 17, yellow[4])
    px(im, 15, 17, yellow[5])
    px(im, 16, 17, yellow[3])
    px(im, 17, 17, yellow[2])
    # Plinth base (y=18..20)
    px(im, 13, 18, yellow[4])
    px(im, 14, 18, yellow[5])
    px(im, 15, 18, yellow[4])
    px(im, 16, 18, orange[3])
    px(im, 17, 18, yellow[2])
    px(im, 18, 18, yellow[1])
    hline(im, 12, 19, 19, kuro[1])
    hline(im, 14, 17, 19, yellow[4])  # championship gold plaque
    hline(im, 12, 19, 20, kuro[0])

    # Bold Pixel Championship Banner Bar at Bottom (y=22..25, x=7..24)
    hline(im, 7, 12, 22, glass[5])
    hline(im, 13, 18, 22, yellow[4])
    hline(im, 19, 24, 22, red[4])
    rect(im, 7, 23, 24, 24, kuro[0])
    # Crisp pixel banner lettering
    for lx in (8, 9, 11, 13, 14, 16, 17, 19, 21, 22):
        px(im, lx, 23, cw[5] if lx < 16 else yellow[5])
        px(im, lx, 24, glass[5] if lx < 13 else (yellow[4] if lx < 19 else red[4]))
    # Sub-banner accent bar (y=25)
    hline(im, 8, 14, 25, glass[4])
    hline(im, 15, 16, 25, yellow[4])
    hline(im, 17, 23, 25, red[4])

    # Bottom shadowbox frame (y=27..29, rounded corners (4,29) & (27,29) transparent)
    px(im, 4, 27, kuro[0])
    px(im, 5, 27, steel[2])
    hline(im, 6, 15, 27, steel[3])
    hline(im, 16, 25, 27, steel[2])
    px(im, 26, 27, kuro[2])
    px(im, 27, 27, kuro[0])

    px(im, 4, 28, kuro[0])
    hline(im, 5, 26, 28, kuro[1])
    hline(im, 14, 17, 28, steel[4])
    px(im, 27, 28, kuro[0])

    hline(im, 5, 26, 29, kuro[0])
    hline(im, 8, 23, 29, ink[0])

    return im


# ---------------------------------------------------------------------------
# 3. pcb3-ac-dark.png (32x32, 2x2 hang)
#    Curved Commercial Dark-Charcoal Wind-Free Wall AC Unit
# ---------------------------------------------------------------------------
def build_ac_dark() -> Image.Image:
    im = new_canvas(32, 32)
    kuro = R["kuro"]
    ink = R["ink"]
    steel = R["steel"]
    kawara = R["kawara"]
    glass = R["glass"]
    teal = R["teal"]

    # Sculpted rounded-corner 3/4 silhouette (x=2..29, y=5..19, tapered curved ends)
    # y=5..9: Sunlit 3/4 curved top intake louver plane
    # y=5: x=5..26
    px(im, 5, 5, kuro[0])
    px(im, 26, 5, kuro[0])
    hline(im, 6, 19, 5, kawara[3])
    hline(im, 20, 25, 5, kawara[2])

    # y=6: x=3..28 curved upper shoulder + intake louver slot
    px(im, 3, 6, kuro[0])
    px(im, 28, 6, kuro[0])
    px(im, 4, 6, kawara[4])
    hline(im, 5, 19, 6, kawara[5])
    hline(im, 20, 26, 6, kawara[4])
    px(im, 27, 6, kawara[3])
    for lx in range(7, 25):
        if lx not in (15, 16):
            px(im, lx, 6, steel[3])

    # y=7: x=2..29 full-width curved top plane + second louver slot
    px(im, 2, 7, kawara[0])
    px(im, 29, 7, kuro[0])
    px(im, 3, 7, kawara[4])
    hline(im, 4, 21, 7, kawara[4])
    hline(im, 22, 27, 7, kawara[3])
    px(im, 28, 7, kawara[2])
    for lx in range(6, 26):
        if lx not in (15, 16):
            px(im, lx, 7, kawara[3] if lx < 16 else steel[2])

    # y=8: gleaming curved front-top crown highlight
    px(im, 2, 8, kawara[0])
    px(im, 29, 8, kuro[0])
    px(im, 3, 8, kawara[4])
    hline(im, 4, 19, 8, kawara[5])
    hline(im, 6, 15, 8, steel[4])
    hline(im, 20, 26, 8, kawara[4])
    px(im, 27, 8, kawara[3])
    px(im, 28, 8, kawara[2])

    # y=9: upper fascia transition bevel
    px(im, 2, 9, kuro[0])
    px(im, 29, 9, kuro[0])
    px(im, 3, 9, kawara[3])
    px(im, 4, 9, steel[3])
    hline(im, 5, 26, 9, kawara[2])
    px(im, 27, 9, kawara[2])
    px(im, 28, 9, kuro[1])

    # y=10..14: Matte dark micro-mesh front fascia + "18°" LED readout & eco icon
    for y in range(10, 15):
        px(im, 2, y, kuro[0])
        px(im, 29, y, kuro[0])
        # Curved left & right appliance cheeks
        px(im, 3, y, kawara[2] if y <= 12 else kuro[2])
        px(im, 4, y, kuro[3] if y <= 11 else kuro[2])
        px(im, 28, y, kuro[1])
        # Wind-Free micro-mesh field (x=5..19)
        for x in range(5, 20):
            if (x + y) % 2 == 0:
                c = kuro[3] if y <= 11 else kawara[1]
            else:
                c = kuro[2] if y <= 12 else kuro[1]
            px(im, x, y, c)
        # Glossy dark LED display window on right (x=20..27)
        hline(im, 20, 27, y, glass[0])

    # Subtle centered silver brand mark on fascia (x=13..15, y=12)
    px(im, 13, 12, steel[3])
    px(im, 14, 12, steel[4])
    px(im, 15, 12, steel[3])

    # Crisp glowing "18°" LED readout + teal[4] eco leaf (x=21..27, y=10..14)
    # Digit "1" at x=21, y=10..14
    for dy in range(10, 15):
        px(im, 21, dy, glass[6] if dy <= 12 else glass[5])
    # Digit "8" at x=23..25, y=10..14 (true 3x5 7-segment with hollow centers)
    hline(im, 23, 25, 10, glass[6])
    px(im, 23, 11, glass[5])
    px(im, 25, 11, glass[5])
    hline(im, 23, 25, 12, glass[6])
    px(im, 23, 13, glass[5])
    px(im, 25, 13, glass[5])
    hline(im, 23, 25, 14, glass[5])
    # Degree symbol "°" at (26, 10)
    px(im, 26, 10, glass[6])
    # Eco leaf icon in teal[4] at (26..27, 12..14)
    px(im, 27, 12, teal[5])
    px(im, 26, 13, teal[4])
    px(im, 27, 13, teal[4])
    px(im, 26, 14, teal[3])

    # y=15..18: Open angled motorized dual air-vane blades (tapered lower curve)
    # y=15: upper vent throat gap (x=2..29)
    px(im, 2, 15, kuro[0])
    px(im, 3, 15, kuro[2])
    hline(im, 4, 27, 15, ink[0])
    for sx in (9, 15, 21):
        px(im, sx, 15, kuro[1])
    px(im, 28, 15, kuro[1])
    px(im, 29, 15, kuro[0])

    # y=16: Primary motorized air-vane blade (x=2..29)
    px(im, 2, 16, kuro[0])
    px(im, 3, 16, kuro[2])
    px(im, 4, 16, steel[2])
    hline(im, 5, 19, 16, steel[4])
    hline(im, 20, 26, 16, steel[3])
    px(im, 27, 16, steel[2])
    px(im, 28, 16, kuro[1])
    px(im, 29, 16, kuro[0])

    # y=17: Tapered lower vent gap (x=3..28)
    px(im, 3, 17, kuro[0])
    px(im, 4, 17, steel[1])
    hline(im, 5, 26, 17, ink[0])
    for sx in (9, 15, 21):
        px(im, sx, 17, steel[1])
    px(im, 27, 17, steel[1])
    px(im, 28, 17, kuro[0])

    # y=18: Secondary lower air-vane blade & curved bottom lip (x=4..27)
    px(im, 4, 18, kuro[0])
    px(im, 5, 18, steel[2])
    hline(im, 6, 18, 18, steel[3])
    hline(im, 19, 25, 18, steel[2])
    px(im, 26, 18, steel[1])
    px(im, 27, 18, kuro[0])

    # y=19: Curved underside wall-mount shadow contour (x=6..25)
    hline(im, 6, 25, 19, kuro[0])
    hline(im, 8, 23, 19, ink[0])

    return im


# ---------------------------------------------------------------------------
# 4. pcb3-vent.png (32x32, 2x2 hang)
#    Smoking Booth Stainless & Dark-Slate Exhaust Canopy Hood (제연 환풍 후드)
# ---------------------------------------------------------------------------
def build_vent_hood() -> Image.Image:
    im = new_canvas(32, 32)
    kuro = R["kuro"]
    ink = R["ink"]
    steel = R["steel"]
    kawara = R["kawara"]
    foliage = R["foliage"]
    glass = R["glass"]
    teal = R["teal"]

    # y=0..7: Cylindrical/octagonal sheet-metal exhaust duct (x=10..21)
    duct_shade = [
        steel[1],  # x=10 left contour
        steel[3],  # x=11 left bevel
        steel[5],  # x=12 bright highlight
        steel[5],  # x=13 highlight
        steel[4],  # x=14 mid-lit
        steel[4],  # x=15 mid-lit
        steel[3],  # x=16 mid
        steel[3],  # x=17 mid
        steel[2],  # x=18 shaded
        steel[2],  # x=19 shaded
        steel[1],  # x=20 deep right shade
        steel[0],  # x=21 right contour
    ]
    for y in range(0, 8):
        for i, c in enumerate(duct_shade):
            px(im, 10 + i, y, c)

    # Ceiling collar flange at y=0 (x=9..22)
    px(im, 9, 0, steel[1])
    px(im, 22, 0, steel[0])
    px(im, 12, 1, steel[6])
    px(im, 12, 2, steel[6])

    # Horizontal duct seam ring at y=4
    hline(im, 11, 20, 4, steel[2])
    px(im, 12, 4, steel[4])
    px(im, 13, 4, steel[4])
    px(im, 19, 4, steel[1])
    px(im, 12, 5, steel[6])

    # Duct-to-canopy bolted collar at y=7 (x=9..22)
    px(im, 9, 7, kuro[0])
    px(im, 10, 7, steel[2])
    hline(im, 11, 15, 7, steel[4])
    hline(im, 16, 20, 7, steel[2])
    px(im, 21, 7, steel[1])
    px(im, 22, 7, kuro[0])

    # y=8..20: Flared 3/4 trapezoidal canopy hood
    # Smoothly widening from x=7..24 at y=8 out to x=2..29 at y=15..20
    slope_bounds = {
        8: (7, 24),
        9: (6, 25),
        10: (5, 26),
        11: (4, 27),
        12: (4, 27),
        13: (3, 28),
        14: (3, 28),
    }
    for y, (x0, x1) in slope_bounds.items():
        px(im, x0, y, kuro[0])
        px(im, x1, y, kuro[0])
        if y == 8:
            # Top flat collar shelf
            hline(im, x0 + 1, 16, y, steel[5])
            hline(im, 17, x1 - 1, y, steel[3])
        else:
            # 3/4 sloped stainless & dark-slate trapezoidal hood plane
            span = x1 - x0 - 1
            for x in range(x0 + 1, x1):
                rel = (x - (x0 + 1)) / max(1, span - 1)
                if x == x0 + 1:
                    c = steel[5] if y <= 11 else steel[4]
                elif x == x0 + 2:
                    c = steel[4] if y <= 12 else kawara[4]
                elif rel < 0.42:
                    c = kawara[4] if y <= 11 else kawara[3]
                elif rel < 0.76:
                    c = kawara[3] if y <= 11 else kawara[2]
                else:
                    c = steel[2] if x == x1 - 1 else kawara[2]
                px(im, x, y, c)

    # Diagonal welded facet rib lines along the sloped canopy
    for y, lx, rx in ((9, 9, 22), (10, 8, 23), (11, 7, 24), (12, 6, 25), (13, 5, 26), (14, 5, 26)):
        px(im, lx, y, steel[4])
        px(im, rx, y, kawara[1])

    # y=15: Full-width (x=2..29) gleaming brushed-stainless front canopy lip
    px(im, 2, 15, kuro[0])
    px(im, 3, 15, steel[4])
    hline(im, 4, 18, 15, steel[5])
    hline(im, 6, 13, 15, steel[6])
    hline(im, 19, 26, 15, steel[4])
    hline(im, 27, 28, 15, steel[3])
    px(im, 29, 15, kuro[0])

    # y=16..19: Full-width (x=2..29) dark-slate skirt with two recessed smoke baffle grilles
    for y in range(16, 20):
        px(im, 2, y, kuro[0])
        px(im, 3, y, kawara[3] if y == 16 else kawara[2])
        hline(im, 4, 27, y, kawara[2] if y <= 17 else kuro[2])
        px(im, 28, y, kuro[1])
        px(im, 29, y, kuro[0])

    # Left & Right recessed grease/smoke baffle grilles (x=4..13 and x=18..27, y=16..18)
    for gx0, gx1 in ((4, 13), (18, 27)):
        rect(im, gx0, 16, gx1, 18, kuro[0])
        # Vertical stainless baffle slats inside each recessed hood intake
        for bx in range(gx0 + 1, gx1, 2):
            px(im, bx, 16, kuro[2])
            px(im, bx, 17, steel[3] if bx < 16 else steel[2])
            px(im, bx, 18, kuro[1])

    # Center mullion badge between grilles (x=15..16, y=17)
    px(im, 15, 17, steel[4])
    px(im, 16, 17, steel[3])

    # y=19: Active-suction status bar & glowing foliage[5]/glass[5] LEDs
    hline(im, 5, 11, 19, kuro[0])
    px(im, 5, 19, glass[6])
    hline(im, 6, 9, 19, glass[5])
    px(im, 10, 19, glass[4])
    px(im, 11, 19, teal[3])

    # Right status indicator cluster (green + cyan active-suction LEDs)
    hline(im, 22, 27, 19, kuro[0])
    px(im, 23, 19, foliage[5])  # active green suction LED
    px(im, 24, 19, foliage[3])
    px(im, 26, 19, glass[5])    # active cyan ionizer LED
    px(im, 27, 19, glass[3])

    # y=20: Bottom hood rim (x=2..29 with beveled outer pixels)
    px(im, 2, 20, kuro[0])
    hline(im, 3, 28, 20, kuro[0])
    hline(im, 5, 26, 20, ink[0])
    px(im, 29, 20, kuro[0])

    return im


# ---------------------------------------------------------------------------
# 5. pcb-floor-dark.png (64x64, 16 tiles in 4x4 grid)
#    idx = ((ty*2 + tx)*4) + sh
# ---------------------------------------------------------------------------
def build_floor_dark() -> Image.Image:
    sheet = new_canvas(64, 64)
    kuro = R["kuro"]
    asphalt = R["asphalt"]
    kawara = R["kawara"]
    ink = R["ink"]
    glass = R["glass"]

    # Ordered dark-to-light carpet ramp for clean 1-step shadow darkening
    carpet_order = [
        kuro[0],     # 0 darkest (#14121f)
        ink[0],      # 1 (#1a1226)
        asphalt[0],  # 2 (#1c1a2c)
        kawara[0],   # 3 (#1b1a33)
        kuro[1],     # 4 (#201e30)
        asphalt[1],  # 5 (#2a2838)
        kawara[1],   # 6 (#2a2c4a)
        kuro[2],     # 7 (#2f2e42)
    ]
    step_down: dict[tuple[int, int, int, int], tuple[int, int, int, int]] = {
        kuro[0]: kuro[0],
        ink[0]: kuro[0],
        asphalt[0]: ink[0],
        kawara[0]: ink[0],
        kuro[1]: asphalt[0],
        asphalt[1]: kuro[1],
        kawara[1]: kawara[0],
        kuro[2]: asphalt[1],
        glass[1]: kawara[0],
    }

    flecks = {
        (0, 0): {(5, 6), (11, 12)},
        (1, 0): {(4, 10), (12, 4)},
        (0, 1): {(6, 4), (10, 11)},
        (1, 1): {(3, 7), (11, 9)},
    }

    for ty in range(2):
        for tx in range(2):
            base = new_canvas(16, 16)
            quarter_turn = (tx + ty) % 2
            tile_flecks = flecks[(tx, ty)]

            for y in range(16):
                for x in range(16):
                    if x == 15 and y == 15:
                        c = ink[0]
                    elif x == 15 or y == 15:
                        c = asphalt[0] if (x + y) % 2 == 0 else kuro[1]
                    elif (x, y) in tile_flecks:
                        c = glass[1]
                    else:
                        if quarter_turn == 0:
                            v = (x + y * 2) % 6
                            if v == 0 and (x + ty) % 2 == 0:
                                c = kuro[2] if (x + y) % 4 == 0 else asphalt[1]
                            elif v in (1, 4):
                                c = kuro[1]
                            elif v == 3:
                                c = asphalt[0]
                            elif v == 2 and (y % 3 == 1):
                                c = kawara[1]
                            else:
                                c = asphalt[1] if (x + y) % 2 == 0 else kuro[1]
                        else:
                            v = (x * 2 + y) % 6
                            if v == 0 and (y + tx) % 2 == 0:
                                c = kawara[1] if (x + y) % 4 == 0 else asphalt[1]
                            elif v in (1, 4):
                                c = kuro[1]
                            elif v == 3:
                                c = asphalt[0]
                            elif v == 5 and (x % 3 == 1):
                                c = kuro[2]
                            else:
                                c = asphalt[1] if (x + y) % 2 == 1 else kuro[1]
                        # Subtle top-left modular edge highlight
                        if (x == 0 or y == 0) and c == asphalt[0]:
                            c = kuro[1]
                    px(base, x, y, c)

            # Generate 4 wall-shadow variants: sh in 0..3
            for sh in range(4):
                tile = base.copy()
                if sh in (1, 3):  # North wall shadow: top 3 rows (y=0..2)
                    for y in range(3):
                        for x in range(16):
                            c = tile.getpixel((x, y))
                            c = step_down.get(c, carpet_order[0])
                            if y == 0:
                                c = step_down.get(c, carpet_order[0])
                            px(tile, x, y, c)
                if sh in (2, 3):  # West wall shadow: left 4 cols (x=0..3)
                    for y in range(16):
                        for x in range(4):
                            c = tile.getpixel((x, y))
                            c = step_down.get(c, carpet_order[0])
                            if x == 0:
                                c = step_down.get(c, carpet_order[0])
                            px(tile, x, y, c)

                idx = ((ty * 2 + tx) * 4) + sh
                sheet.paste(tile, ((idx % 4) * 16, (idx // 4) * 16))

    return sheet


# ---------------------------------------------------------------------------
# 6. pcb-floor-smoke.png (64x64, 16 tiles in 4x4 grid)
#    Smoking booth dark non-slip diagonal-ribbed metallic floor tile
# ---------------------------------------------------------------------------
def build_floor_smoke() -> Image.Image:
    sheet = new_canvas(64, 64)
    kuro = R["kuro"]
    steel = R["steel"]
    kawara = R["kawara"]
    ink = R["ink"]

    step_down: dict[tuple[int, int, int, int], tuple[int, int, int, int]] = {
        ink[0]: kuro[0],
        kuro[0]: kuro[0],
        steel[0]: ink[0],
        kuro[1]: steel[0],
        kawara[1]: kuro[1],
        steel[1]: kuro[1],
        kuro[2]: steel[1],
        kuro[3]: kuro[2],
        steel[2]: kuro[2],
    }

    for ty in range(2):
        for tx in range(2):
            base = new_canvas(16, 16)
            phase = (tx + ty) % 2

            for y in range(16):
                for x in range(16):
                    if x == 15 and y == 15:
                        c = ink[0]
                    elif x == 15 or y == 15:
                        c = steel[0]
                    elif x == 0 or y == 0:
                        c = kuro[2] if (x < 14 and y < 14) else steel[1]
                    else:
                        d = (x + y) % 4
                        seg = (x - y + phase * 2) % 4
                        if d == 1 and seg != 0:
                            # Raised non-slip metallic diagonal rib
                            c = steel[2] if seg == 2 else kuro[3]
                        elif d == 2 and seg != 0:
                            # Embossed shadow trough right below rib
                            c = ink[0] if seg == 2 else steel[0]
                        else:
                            c = steel[1] if (x + y + tx) % 3 == 0 else (kawara[1] if (x + ty) % 5 == 0 else kuro[1])
                    px(base, x, y, c)

            # Corner floor-plate rivets
            for rx, ry in ((2, 2), (13, 2), (2, 13), (13, 13)):
                px(base, rx, ry, steel[2])
                px(base, rx, ry + 1 if ry < 13 else ry - 1, steel[0])

            for sh in range(4):
                tile = base.copy()
                if sh in (1, 3):  # North shadow: top 3 rows
                    for y in range(3):
                        for x in range(16):
                            c = tile.getpixel((x, y))
                            c = step_down.get(c, kuro[0])
                            if y == 0:
                                c = step_down.get(c, kuro[0])
                            px(tile, x, y, c)
                if sh in (2, 3):  # West shadow: left 4 cols
                    for y in range(16):
                        for x in range(4):
                            c = tile.getpixel((x, y))
                            c = step_down.get(c, kuro[0])
                            if x == 0:
                                c = step_down.get(c, kuro[0])
                            px(tile, x, y, c)

                idx = ((ty * 2 + tx) * 4) + sh
                sheet.paste(tile, ((idx % 4) * 16, (idx // 4) * 16))

    return sheet


# ---------------------------------------------------------------------------
# 7. pcb-wall-dark.png (64x32, 8 tiles in 4x2 grid)
#    idx = (row*2 + tx)*2 + west
# ---------------------------------------------------------------------------
def build_wall_dark() -> Image.Image:
    sheet = new_canvas(64, 32)
    kuro = R["kuro"]
    ink = R["ink"]
    steel = R["steel"]
    kawara = R["kawara"]
    glass = R["glass"]
    asphalt = R["asphalt"]

    # Build continuous 32x32 wall section (x=0..31, y=0..31)
    wall = new_canvas(32, 32)

    # y=0..1: Top crown molding
    hline(wall, 0, 31, 0, kuro[0])
    for x in range(32):
        c = steel[1] if x % 16 == 0 else (steel[3] if 2 <= (x % 8) <= 5 else steel[2])
        px(wall, x, 1, c)

    # y=2..3: Recessed glowing cyan LED cove strip
    for x in range(32):
        hotspot = (x % 8) in (3, 4)
        px(wall, x, 2, glass[6] if hotspot else glass[5])
        px(wall, x, 3, glass[4] if hotspot else glass[3])

    # y=4: Cove lip grazing glow onto upper acoustic slate
    for x in range(32):
        px(wall, x, 4, kuro[0] if x % 8 == 0 else (glass[2] if (x % 8) in (3, 4) else kawara[2]))

    # y=5..18: Vertical dark-slate acoustic wall panels (8px wide modules)
    for y in range(5, 19):
        for x in range(32):
            m = x % 8
            if m == 0:
                c = kuro[0]
            elif m == 1:
                c = kawara[2] if y <= 12 else kuro[2]
            elif m == 7:
                c = kuro[1] if y <= 13 else asphalt[0]
            else:
                if y <= 9:
                    c = kawara[2] if (y == 5 and m in (2, 3, 4)) else kawara[1]
                elif y <= 14:
                    c = kuro[2] if (x + y) % 3 != 0 else kawara[1]
                else:
                    c = kuro[1]
                # Subtle acoustic micro-perforation ticks
                if m == 4 and y in (7, 11, 15):
                    c = kuro[2] if y == 15 else kawara[2]
            px(wall, x, y, c)

    # y=19..20: Brushed-steel waist trim + underside shadow
    for x in range(32):
        if x % 8 == 0:
            c = steel[2]
        elif (x % 16) in (2, 3, 4, 5, 10, 11):
            c = steel[3]
        else:
            c = steel[2]
        px(wall, x, 19, c)
    hline(wall, 0, 31, 20, kuro[0])

    # y=21..29: Dark lower wainscot panels
    for y in range(21, 30):
        for x in range(32):
            m16 = x % 16
            if m16 == 0 or m16 == 15:
                c = kuro[0]
            elif y == 21:
                c = kuro[2] if m16 < 14 else kuro[1]
            elif m16 in (1, 14) or y == 29:
                c = kuro[1] if m16 == 1 else kuro[0]
            else:
                # Subtle diagonal scuff-resistant wainscot rib
                if (x + y) % 4 == 0:
                    c = kuro[1]
                elif (x + y) % 4 == 1:
                    c = kuro[0]
                else:
                    c = asphalt[0] if y <= 26 else kuro[0]
            px(wall, x, y, c)

    # y=30..31: Baseboard
    for x in range(32):
        px(wall, x, 30, kuro[1] if x % 16 != 0 else kuro[0])
        px(wall, x, 31, ink[0] if (x % 2 == 0) else kuro[0])

    step_down: dict[tuple[int, int, int, int], tuple[int, int, int, int]] = {
        kuro[0]: kuro[0],
        ink[0]: kuro[0],
        asphalt[0]: ink[0],
        kuro[1]: asphalt[0],
        kuro[2]: kuro[1],
        kawara[1]: kawara[0],
        kawara[2]: kawara[1],
        steel[1]: kuro[1],
        steel[2]: steel[1],
        steel[3]: steel[2],
        glass[2]: glass[1],
        glass[3]: glass[2],
        glass[4]: glass[3],
        glass[5]: glass[4],
        glass[6]: glass[5],
        kawara[0]: kuro[0],
        glass[1]: glass[0],
        glass[0]: glass[0],
    }

    for row in range(2):
        for tx in range(2):
            sub = wall.crop((tx * 16, row * 16, tx * 16 + 16, row * 16 + 16))
            for west in range(2):
                tile = sub.copy()
                if west == 1:
                    for y in range(16):
                        for x in range(4):
                            c = tile.getpixel((x, y))
                            c = step_down.get(c, kuro[0])
                            if x <= 1:
                                c = step_down.get(c, kuro[0])
                            px(tile, x, y, c)
                idx = (row * 2 + tx) * 2 + west
                sheet.paste(tile, ((idx % 4) * 16, (idx // 4) * 16))

    return sheet


# ---------------------------------------------------------------------------
# 8. pcb-wall-glass.png (64x32, 8 tiles in 4x2 grid)
#    Tempered smoke-glass partition booth wall
# ---------------------------------------------------------------------------
def build_wall_glass() -> Image.Image:
    sheet = new_canvas(64, 32)
    kuro = R["kuro"]
    ink = R["ink"]
    steel = R["steel"]
    kawara = R["kawara"]
    glass = R["glass"]
    cw = R["coolwhite"]

    wall = new_canvas(32, 32)

    # y=0..2: Dark-anodized aluminium top header rail
    hline(wall, 0, 31, 0, kuro[0])
    for x in range(32):
        m16 = x % 16
        if m16 in (0, 15):
            px(wall, x, 1, steel[1] if m16 == 15 else steel[2])
        else:
            px(wall, x, 1, steel[3] if m16 <= 10 else steel[2])
        px(wall, x, 2, kuro[1] if m16 not in (0, 15) else kuro[0])

    # Vertical aluminium mullions (x % 16 in (0, 1, 14, 15)) + tall smoke-glass panes (y=3..20)
    for tx in range(2):
        ox = tx * 16
        for y in range(3, 21):
            # Mullion & rubber glazing gasket
            px(wall, ox + 0, y, steel[2] if y <= 14 else steel[1])
            px(wall, ox + 1, y, kuro[1] if y <= 12 else kuro[0])
            px(wall, ox + 14, y, kuro[0])
            px(wall, ox + 15, y, kuro[0])

            # Base vertical smoke-tinted glass gradient (lx = 2..13)
            for lx in range(2, 14):
                if y == 3:
                    c = glass[0]
                elif y <= 6:
                    c = glass[3] if (y == 5 and 3 <= lx <= 11) else glass[2]
                elif y <= 12:
                    c = glass[2] if y <= 8 else glass[1]
                elif y <= 19:
                    c = glass[0] if y >= 16 else glass[1]
                else:
                    c = glass[2]  # upward reflection above steel waist rail

                # Crisp 45-degree specular reflection streaks (inspired by bus-shelter glass)
                s = lx + y
                if tx == 0:
                    if s == 18 and 5 <= y <= 16:
                        c = cw[3] if y <= 10 else glass[5]
                    elif s == 19 and 5 <= y <= 17:
                        c = glass[5] if y <= 9 else glass[4]
                    elif s == 22 and 9 <= y <= 19:
                        c = glass[4] if y <= 14 else glass[3]
                    elif s == 9 and 4 <= y <= 7:
                        c = glass[4]
                else:
                    if s == 20 and 6 <= y <= 17:
                        c = cw[3] if y <= 11 else glass[5]
                    elif s == 21 and 6 <= y <= 18:
                        c = glass[5] if y <= 10 else glass[4]
                    elif s == 16 and 4 <= y <= 13:
                        c = glass[4] if y <= 9 else glass[3]
                    elif s == 26 and 13 <= y <= 19:
                        c = glass[3]

                px(wall, ox + lx, y, c)

    # y=21: Brushed-steel waist rail
    for x in range(32):
        m16 = x % 16
        if m16 == 15:
            c = steel[1]
        elif m16 == 0:
            c = steel[2]
        elif 2 <= m16 <= 10:
            c = steel[4] if 3 <= m16 <= 7 else steel[3]
        else:
            c = steel[2]
        px(wall, x, 21, c)

    # y=22..31: Dark lower anodized kick-panel
    hline(wall, 0, 31, 22, kuro[0])
    for y in range(23, 30):
        for x in range(32):
            m16 = x % 16
            if m16 == 0:
                c = steel[1]
            elif m16 == 15:
                c = kuro[0]
            elif m16 in (1, 14):
                c = kuro[0]
            elif y == 23:
                c = kuro[2]
            elif y in (25, 28):
                c = kuro[0]
            else:
                c = kawara[1] if (y == 24 and m16 <= 11) else kuro[1]
            px(wall, x, y, c)

    for x in range(32):
        m16 = x % 16
        px(wall, x, 30, steel[1] if m16 not in (0, 15) else kuro[0])
        px(wall, x, 31, ink[0] if x % 2 == 0 else kuro[0])

    step_down: dict[tuple[int, int, int, int], tuple[int, int, int, int]] = {
        kuro[0]: kuro[0],
        ink[0]: kuro[0],
        kuro[1]: kuro[0],
        kuro[2]: kuro[1],
        kawara[1]: kawara[0],
        kawara[0]: kuro[0],
        steel[1]: kuro[1],
        steel[2]: steel[1],
        steel[3]: steel[2],
        steel[4]: steel[3],
        glass[0]: glass[0],
        glass[1]: glass[0],
        glass[2]: glass[1],
        glass[3]: glass[2],
        glass[4]: glass[3],
        glass[5]: glass[4],
        cw[3]: glass[4],
    }

    for row in range(2):
        for tx in range(2):
            sub = wall.crop((tx * 16, row * 16, tx * 16 + 16, row * 16 + 16))
            for west in range(2):
                tile = sub.copy()
                if west == 1:
                    for y in range(16):
                        for x in range(4):
                            c = tile.getpixel((x, y))
                            c = step_down.get(c, kuro[0])
                            if x <= 1:
                                c = step_down.get(c, kuro[0])
                            px(tile, x, y, c)
                idx = (row * 2 + tx) * 2 + west
                sheet.paste(tile, ((idx % 4) * 16, (idx // 4) * 16))

    return sheet


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    allowed_rgb = load_palette(PALETTE_PATH)

    targets: list[tuple[str, Image.Image]] = [
        ("pcb3-digital-menu", build_digital_menu()),
        ("pcb3-esports-poster", build_esports_poster()),
        ("pcb3-ac-dark", build_ac_dark()),
        ("pcb3-vent", build_vent_hood()),
        ("pcb-floor-dark", build_floor_dark()),
        ("pcb-floor-smoke", build_floor_smoke()),
        ("pcb-wall-dark", build_wall_dark()),
        ("pcb-wall-glass", build_wall_glass()),
    ]

    failed = 0
    for stem, im in targets:
        p1 = OUT_DIR / f"{stem}.png"
        p4 = OUT_DIR / f"{stem}-x4.png"
        im.save(p1)
        im.resize((im.width * 4, im.height * 4), Image.Resampling.NEAREST).save(p4)

        rep = verify_sprite(p1, allowed_rgb, forbid_pure_black=True)
        status = "PASS" if rep.ok else "FAIL"
        if not rep.ok:
            failed += 1
        err_s = f" | {'; '.join(rep.errors)}" if rep.errors else ""
        print(
            f"[{status}] {p1.name:26s} {rep.width:2d}x{rep.height:<2d} "
            f"opaque={rep.opaque_pixels:4d} colors={rep.unique_colors:2d} "
            f"pv={rep.palette_violations} av={rep.alpha_violations} "
            f"pure_black={rep.pure_black_pixels} sha={rep.pixel_sha256[:12]}{err_s}"
        )

    print(f"Summary: {len(targets) - failed}/{len(targets)} PASS")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
