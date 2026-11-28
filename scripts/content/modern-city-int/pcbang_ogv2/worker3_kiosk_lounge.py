#!/usr/bin/env python3
"""Worker 3 (object-gen-v2 Carbon Medium pure 1-pass):
Korean PC Bang Kiosk, Tray Return, Ashtray & Lounge Furniture sprites.

Outputs 6 1x PNGs + 6 4x NEAREST preview PNGs into:
  tiledata/modern-city/pcbang-ogv2/pieces/
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from PIL import Image

OGV2_ROOT = Path("/home/main/object-gen-v2")
sys.path.insert(0, str(OGV2_ROOT))

from objectgen_v2.palette import load_palette, verify_sprite  # noqa: E402

PALETTE_PATH = OGV2_ROOT / "palettes" / "fable-city.json"
REPO_ROOT = Path(
    "/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a"
)
OUT_DIR = REPO_ROOT / "tiledata" / "modern-city" / "pcbang-ogv2" / "pieces"


def load_ramps(path: Path) -> dict[str, list[tuple[int, int, int, int]]]:
    raw = json.loads(path.read_text(encoding="utf-8"))["ramps"]
    ramps: dict[str, list[tuple[int, int, int, int]]] = {}
    for name, hex_list in raw.items():
        ramps[name] = [
            (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)
            for h in hex_list
        ]
    return ramps


R = load_ramps(PALETTE_PATH)


def px(im: Image.Image, x: int, y: int, c: tuple[int, int, int, int]) -> None:
    if 0 <= x < im.width and 0 <= y < im.height:
        im.putpixel((x, y), c)


def hline(
    im: Image.Image, x1: int, x2: int, y: int, c: tuple[int, int, int, int]
) -> None:
    for x in range(x1, x2 + 1):
        px(im, x, y, c)


def vline(
    im: Image.Image, x: int, y1: int, y2: int, c: tuple[int, int, int, int]
) -> None:
    for y in range(y1, y2 + 1):
        px(im, x, y, c)


def rect(
    im: Image.Image,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    c: tuple[int, int, int, int],
) -> None:
    for y in range(y1, y2 + 1):
        for x in range(x1, x2 + 1):
            px(im, x, y, c)


# ---------------------------------------------------------------------------
# 1. pcb3-kiosk-1.png (16x32) & pcb3-kiosk-pair.png (32x32)
# ---------------------------------------------------------------------------
def draw_single_kiosk(im: Image.Image, ox: int, mode: str = "seat_map") -> None:
    kw = R["kawara"]
    st = R["steel"]
    kr = R["kuro"]
    nv = R["navy"]
    gl = R["glass"]
    tl = R["teal"]
    bl = R["blue"]
    og = R["orange"]
    yl = R["yellow"]
    cw = R["coolwhite"]
    fl = R["foliage"]
    ink = R["ink"]

    # y=1..5: Angled 3/4 top hood (stepped rounded silhouette x=3..12 -> x=2..13)
    px(im, ox + 3, 1, kw[1])
    hline(im, ox + 4, ox + 7, 1, kw[4])
    hline(im, ox + 8, ox + 11, 1, kw[3])
    px(im, ox + 12, 1, kw[1])

    px(im, ox + 2, 2, kw[1])
    hline(im, ox + 3, ox + 6, 2, kw[5])
    hline(im, ox + 7, ox + 10, 2, kw[4])
    hline(im, ox + 11, ox + 12, 2, kw[3])
    px(im, ox + 13, 2, kw[0])

    px(im, ox + 2, 3, kw[0])
    hline(im, ox + 3, ox + 6, 3, kw[3])
    hline(im, ox + 7, ox + 11, 3, kw[2])
    px(im, ox + 12, 3, kw[1])
    px(im, ox + 13, 3, kr[0])

    # Glowing cyan "선불" / status LED light bar inside hood (y=4..5)
    px(im, ox + 2, 4, kr[0])
    px(im, ox + 3, 4, gl[2])
    px(im, ox + 4, 4, gl[5])
    px(im, ox + 5, 4, gl[6])  # '선' glyph highlight
    px(im, ox + 6, 4, gl[4])
    px(im, ox + 7, 4, gl[6])  # '불' glyph highlight
    px(im, ox + 8, 4, gl[5])
    px(im, ox + 9, 4, gl[3])
    px(im, ox + 10, 4, tl[5] if mode == "seat_map" else gl[6])
    px(im, ox + 11, 4, gl[4])
    px(im, ox + 12, 4, gl[1])
    px(im, ox + 13, 4, kr[0])

    px(im, ox + 2, 5, kr[0])
    px(im, ox + 3, 5, nv[0])
    hline(im, ox + 4, ox + 11, 5, gl[2])
    px(im, ox + 5, 5, gl[4])
    px(im, ox + 7, 5, gl[4])
    px(im, ox + 12, 5, nv[0])
    px(im, ox + 13, 5, kr[0])

    # y=6..18: Portrait touchscreen with slim metallic side cheeks (x=2..13)
    for y in range(6, 19):
        left_cheek = kw[3] if y < 12 else kw[2]
        if y in (10, 11, 12):
            left_cheek = gl[3]  # subtle vertical LED trim on slim side cheek
        px(im, ox + 2, y, left_cheek)
        px(im, ox + 3, y, nv[0])
        px(im, ox + 12, y, nv[0])
        px(im, ox + 13, y, kr[0])

    hline(im, ox + 4, ox + 11, 6, nv[0])
    hline(im, ox + 4, ox + 11, 18, nv[0])
    rect(im, ox + 4, 7, ox + 11, 17, nv[1])

    if mode == "seat_map":
        # Top UI header
        hline(im, ox + 4, ox + 8, 7, bl[3])
        hline(im, ox + 9, ox + 11, 7, gl[4])
        hline(im, ox + 4, ox + 11, 8, nv[1])

        # Seat grid row 1 (y=9..10)
        rect(im, ox + 4, 9, ox + 5, 10, tl[4])
        rect(im, ox + 7, 9, ox + 8, 10, tl[4])
        rect(im, ox + 10, 9, ox + 11, 10, bl[3])
        px(im, ox + 4, 9, tl[5])
        px(im, ox + 7, 9, tl[5])

        # Seat grid row 2 (y=12..13): selected seat in orange!
        rect(im, ox + 4, 12, ox + 5, 13, tl[3])
        rect(im, ox + 7, 12, ox + 8, 13, og[4])
        px(im, ox + 7, 12, yl[4])
        rect(im, ox + 10, 12, ox + 11, 13, tl[4])

        # Bottom fare & confirm button (y=15..16)
        rect(im, ox + 4, 15, ox + 6, 16, nv[2])
        px(im, ox + 5, 15, cw[3])
        rect(im, ox + 7, 15, ox + 11, 16, cw[5])
        hline(im, ox + 8, ox + 11, 16, cw[4])
        px(im, ox + 10, 15, og[4])
        px(im, ox + 11, 15, og[3])

        # Diagonal glass[6] reflection streak
        px(im, ox + 6, 8, gl[6])
        px(im, ox + 5, 9, gl[6])
        px(im, ox + 4, 10, gl[5])
        px(im, ox + 5, 11, gl[4])
    else:
        # Dynamic right-kiosk screen: Time-plan selection buttons ("1시간 / 3시간 / 5시간")
        hline(im, ox + 4, ox + 7, 7, tl[3])
        hline(im, ox + 8, ox + 11, 7, bl[4])

        # 2x2 fare plan cards
        rect(im, ox + 4, 9, ox + 7, 10, bl[3])
        px(im, ox + 5, 9, cw[4])
        rect(im, ox + 8, 9, ox + 11, 10, og[4])  # active selected plan
        px(im, ox + 9, 9, cw[5])
        px(im, ox + 10, 9, yl[4])

        rect(im, ox + 4, 12, ox + 7, 13, tl[3])
        px(im, ox + 5, 12, cw[4])
        rect(im, ox + 8, 12, ox + 11, 13, nv[3])
        px(im, ox + 9, 12, cw[3])

        # Wide bottom pay button (y=15..16)
        rect(im, ox + 4, 15, ox + 11, 16, cw[5])
        hline(im, ox + 4, ox + 7, 15, gl[5])
        hline(im, ox + 5, ox + 10, 16, cw[4])

        # Diagonal glass[6] reflection
        px(im, ox + 6, 8, gl[6])
        px(im, ox + 5, 9, gl[6])
        px(im, ox + 4, 10, gl[5])

    hline(im, ox + 4, ox + 11, 17, nv[0])

    # y=19..21: Overhanging slanted payment console ledge (x=2..13)
    px(im, ox + 2, 19, st[1])
    hline(im, ox + 3, ox + 8, 19, st[5])
    hline(im, ox + 9, ox + 12, 19, st[4])
    px(im, ox + 13, 19, st[0])

    px(im, ox + 2, 20, st[1])
    hline(im, ox + 3, ox + 12, 20, st[3])
    # Green-lit bill insertion slot on left
    px(im, ox + 4, 20, fl[5])
    px(im, ox + 5, 20, fl[6])
    px(im, ox + 6, 20, fl[4])
    # Blue/Yellow IC card reader on right
    px(im, ox + 9, 20, bl[4])
    px(im, ox + 10, 20, yl[4])
    px(im, ox + 11, 20, og[4])
    px(im, ox + 13, 20, kr[0])

    px(im, ox + 2, 21, st[0])
    hline(im, ox + 3, ox + 12, 21, st[2])
    # Receipt slot mouth + IC card slot mouth
    hline(im, ox + 5, ox + 7, 21, kr[0])
    px(im, ox + 9, 21, bl[3])
    px(im, ox + 10, 21, kr[0])
    px(im, ox + 11, 21, yl[3])
    px(im, ox + 13, 21, kr[0])

    # y=22..26: Sculpted recessed lower cabinet neck (x=3..12 -> non-boxy curve!)
    px(im, ox + 2, 22, st[1])  # angled side cheek bracket under ledge
    px(im, ox + 13, 22, kr[0])
    for y in range(22, 27):
        px(im, ox + 3, y, kr[1])
        px(im, ox + 4, y, kw[2] if y < 25 else kw[1])
        hline(im, ox + 5, ox + 10, y, kr[2] if y < 25 else kr[1])
        px(im, ox + 11, y, kr[1])
        px(im, ox + 12, y, kr[0])

    # White thermal receipt paper tongue hanging from slot (y=22..24)
    px(im, ox + 5, 22, cw[5])
    px(im, ox + 6, 22, cw[4])
    px(im, ox + 5, 23, cw[5])
    px(im, ox + 6, 23, cw[3])
    px(im, ox + 5, 24, kr[0])  # cast shadow under paper tongue
    px(im, ox + 6, 24, kr[0])
    # Service door lock dot
    px(im, ox + 10, 24, st[4])

    # y=27..30: Flared weighted steel base plate (x=1..14)
    px(im, ox + 2, 27, st[1])
    hline(im, ox + 3, ox + 7, 27, st[3])
    hline(im, ox + 8, ox + 11, 27, st[2])
    hline(im, ox + 12, ox + 13, 27, kr[1])

    px(im, ox + 1, 28, st[0])
    hline(im, ox + 2, ox + 6, 28, st[2])
    hline(im, ox + 7, ox + 11, 28, kr[2])
    hline(im, ox + 12, ox + 13, 28, kr[1])
    px(im, ox + 14, 28, kr[0])

    px(im, ox + 1, 29, kr[0])
    hline(im, ox + 2, ox + 6, 29, kr[2])
    hline(im, ox + 7, ox + 13, 29, kr[1])
    px(im, ox + 14, 29, ink[0])

    hline(im, ox + 2, ox + 14, 30, ink[0])


def make_kiosk_1() -> Image.Image:
    im = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    draw_single_kiosk(im, 0, mode="seat_map")
    return im


def make_kiosk_pair() -> Image.Image:
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    draw_single_kiosk(im, 0, mode="seat_map")
    draw_single_kiosk(im, 16, mode="time_plan")
    return im


# ---------------------------------------------------------------------------
# 2. pcb3-tray-bin.png (32x32)
# ---------------------------------------------------------------------------
def make_tray_bin() -> Image.Image:
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    st = R["steel"]
    kw = R["kawara"]
    kr = R["kuro"]
    rd = R["red"]
    gl = R["glass"]
    og = R["orange"]
    cw = R["coolwhite"]
    cr = R["cream"]
    ch = R["cha"]
    ink = R["ink"]

    # y=3..12: Recessed 3/4 top tray-return deck (stepped rounded rear rails)
    px(im, 4, 3, st[1])
    hline(im, 5, 16, 3, st[5])
    hline(im, 17, 26, 3, st[4])
    px(im, 27, 3, st[1])

    px(im, 3, 4, st[1])
    hline(im, 4, 15, 4, st[4])
    hline(im, 16, 27, 4, st[3])
    px(im, 28, 4, st[0])

    # Side stainless guard rails + recessed dark slate deck (y=5..11)
    for y in range(5, 12):
        px(im, 2, y, st[1] if y < 9 else st[0])
        px(im, 3, y, st[5] if y < 9 else st[4])
        deck_c = kw[1] if y == 5 else (kw[2] if y < 10 else kw[3])
        hline(im, 4, 27, y, deck_c)
        px(im, 28, y, st[3] if y < 9 else st[2])
        px(im, 29, y, st[0])

    # Subtle deck drainage/slide ribs
    hline(im, 16, 26, 8, kw[1])
    hline(im, 16, 26, 10, kw[2])

    # Left prop: Stack of 3 returned dark serving trays (x=5..15, y=5..10)
    # Bottom tray lip (y=10) + middle contrast tray rim (y=9)
    hline(im, 5, 15, 10, kr[0])
    hline(im, 5, 14, 9, ch[2])
    px(im, 15, 9, kr[0])
    # Top dark tray in 3/4 view (x=5..14, y=5..8)
    hline(im, 5, 13, 5, kr[4])
    px(im, 14, 5, kr[2])
    for y in range(6, 9):
        px(im, 5, y, kr[3])
        hline(im, 6, 13, y, kr[1] if y == 6 else kr[2])
        px(im, 14, y, kr[0])
    hline(im, 5, 14, 8, kr[3])
    # Crumpled napkin & chopstick wrapper inside top tray
    px(im, 7, 6, cw[5])
    px(im, 8, 6, cw[3])
    hline(im, 10, 12, 7, cr[4])

    # Right prop: Empty Korean red cup-ramen cup + stainless spoon (x=19..26, y=5..10)
    # Cup top elliptical opening (y=5..6, x=19..23)
    hline(im, 20, 22, 5, cw[5])
    px(im, 19, 6, cw[5])
    px(im, 20, 6, og[3])  # leftover spicy broth ring
    px(im, 21, 6, rd[3])
    px(im, 22, 6, cw[3])
    px(im, 23, 6, cw[4])
    # Red cup body (y=7..9)
    px(im, 19, 7, rd[4])
    px(im, 20, 7, rd[4])
    px(im, 21, 7, rd[3])
    px(im, 22, 7, rd[2])
    px(im, 23, 7, rd[1])

    px(im, 19, 8, rd[3])
    px(im, 20, 8, cw[4])  # label stripe
    px(im, 21, 8, rd[3])
    px(im, 22, 8, rd[2])
    px(im, 23, 8, rd[0])

    px(im, 20, 9, cw[4])
    px(im, 21, 9, cw[3])
    px(im, 22, 9, cw[2])
    hline(im, 20, 23, 10, kr[0])  # cup shadow on deck

    # Stainless spoon resting beside cup (x=24..26, y=8..10)
    px(im, 26, 8, st[5])
    px(im, 25, 9, st[6])
    px(im, 24, 9, st[4])
    px(im, 25, 10, kr[0])

    # y=12: Protruding stainless front bullnose rim (x=1..30 for crisp counter overhang!)
    px(im, 1, 12, st[1])
    hline(im, 2, 15, 12, st[5])
    hline(im, 16, 28, 12, st[4])
    px(im, 29, 12, st[2])
    px(im, 30, 12, st[0])

    # y=13..19: Slanted sorting fascia with 3 distinct labeled disposal openings
    px(im, 1, 13, kr[0])
    hline(im, 2, 29, 13, kw[1])
    px(im, 30, 13, kr[0])

    for y in range(14, 19):
        px(im, 2, y, kr[1] if y < 17 else kr[0])
        hline(im, 3, 28, y, kw[2] if y < 16 else kw[1])
        px(im, 29, y, kr[0])
        # Divider ribs between the 3 sorting bays
        px(im, 10, y, kr[0])
        px(im, 11, y, kw[3] if y < 17 else kw[2])
        px(im, 19, y, kr[0])
        px(im, 20, y, kw[3] if y < 17 else kw[2])

    # Left slot (x=4..9): Red-labeled Cans chute
    hline(im, 4, 9, 14, rd[4])
    px(im, 6, 14, cw[5])
    px(im, 9, 14, rd[3])
    rect(im, 5, 15, 8, 18, rd[2])
    hline(im, 5, 8, 15, rd[3])
    rect(im, 6, 16, 7, 17, ink[0])  # round can opening
    hline(im, 5, 8, 18, st[2])

    # Middle slot (x=12..18): Cyan-labeled Plastic/PET flap
    hline(im, 12, 18, 14, gl[5])
    px(im, 15, 14, cw[5])
    px(im, 18, 14, gl[4])
    rect(im, 13, 15, 17, 18, gl[2])
    hline(im, 13, 17, 15, gl[4])
    rect(im, 13, 16, 17, 17, ink[0])  # wide PET flap opening
    hline(im, 13, 17, 18, st[3])

    # Right slot (x=21..27): Stainless broth-drain funnel with orange rim
    hline(im, 21, 27, 14, og[4])
    px(im, 24, 14, cw[5])
    px(im, 27, 14, og[3])
    # Conical stainless funnel
    px(im, 21, 15, st[3])
    px(im, 22, 15, st[6])
    px(im, 23, 15, st[5])
    px(im, 24, 15, kr[1])
    px(im, 25, 15, st[4])
    px(im, 26, 15, st[3])
    px(im, 27, 15, st[1])

    px(im, 22, 16, st[5])
    px(im, 23, 16, st[4])
    px(im, 24, 16, ink[0])  # central drain hole
    px(im, 25, 16, st[2])
    px(im, 26, 16, st[1])

    px(im, 22, 17, st[3])
    px(im, 23, 17, st[4])
    px(im, 24, 17, ink[0])
    px(im, 25, 17, st[2])
    px(im, 26, 17, st[1])
    hline(im, 22, 26, 18, st[2])

    # Fascia-to-cabinet horizontal seam (y=19)
    hline(im, 2, 29, 19, kr[0])

    # y=20..28: 3-compartment dark-charcoal lower bin doors
    doors = [(3, 9), (11, 18), (20, 28)]
    for y in range(20, 28):
        px(im, 2, y, kr[1])
        px(im, 10, y, kr[0])
        px(im, 19, y, kr[0])
        px(im, 29, y, kr[0])

    for dx1, dx2 in doors:
        # Door top/left bevel highlight + charcoal face
        hline(im, dx1, dx2, 20, kw[2])
        for y in range(21, 28):
            px(im, dx1, y, kw[2] if y < 24 else kr[2])
            hline(im, dx1 + 1, dx2 - 1, y, kr[2] if y < 25 else kr[1])
            px(im, dx2, y, kr[1] if y < 24 else kr[0])
        # Recessed stainless pull handle
        mid = (dx1 + dx2) // 2
        hline(im, mid - 1, mid + 1, 21, st[5])
        px(im, mid + 1, 21, st[4])
        hline(im, mid - 1, mid + 1, 22, kr[0])
        # Subtle lower vent slit
        hline(im, mid - 1, mid + 1, 25, kr[0])

    # Heavy steel kick-base + 4 industrial casters (y=28..30)
    px(im, 2, 28, kr[0])
    hline(im, 3, 15, 28, st[2])
    hline(im, 16, 28, 28, kr[2])
    px(im, 29, 28, kr[0])

    # Recessed under-frame shadow + 4 casters at y=29
    hline(im, 4, 27, 29, ink[0])
    for wx in (4, 11, 19, 26):
        px(im, wx, 29, st[3])
        px(im, wx + 1, 29, kr[0])

    hline(im, 3, 29, 30, ink[0])
    return im


# ---------------------------------------------------------------------------
# 3. pcb3-wait-sofa-dark.png (48x32)
# ---------------------------------------------------------------------------
def make_wait_sofa_dark() -> Image.Image:
    im = Image.new("RGBA", (48, 32), (0, 0, 0, 0))
    kr = R["kuro"]
    kw = R["kawara"]
    nv = R["navy"]
    gl = R["glass"]
    tl = R["teal"]
    st = R["steel"]
    asp = R["asphalt"]
    ink = R["ink"]

    # 3 domed backrest cushions spanning x=4..43 (cushions: 4..16, 17..30, 31..43)
    cushions = [(4, 16), (17, 30), (31, 43)]
    for idx, (cx1, cx2) in enumerate(cushions):
        for x in range(cx1, cx2 + 1):
            # Gently arched top profile per cushion
            dist_edge = min(x - cx1, cx2 - x)
            if dist_edge == 0:
                y_top = 7 if idx in (0, 2) and (x in (4, 43)) else 6
            else:
                y_top = 5

            # Outer top contour + cyan accent piping just inside top seam
            px(im, x, y_top, kr[0])
            pipe_c = gl[5] if x < (cx1 + cx2) // 2 else gl[4]
            if dist_edge == 0:
                pipe_c = gl[3]
            px(im, x, y_top + 1, pipe_c)

            # Rich 5-shade charcoal/navy leather backrest (y_top+2 .. 16)
            for y in range(y_top + 2, 17):
                if y == y_top + 2:
                    c = kw[4] if x < cx2 - 2 else kw[3]
                elif y < 11:
                    c = kw[3] if x < cx1 + 6 else kr[3]
                elif y < 14:
                    c = kr[3] if x < cx1 + 5 else kr[2]
                else:
                    c = kr[2] if y == 14 else kr[1]
                px(im, x, y, c)

        # Vertical cushion seam valley
        if idx > 0:
            vline(im, cx1, 6, 16, kr[0])
            vline(im, cx1 + 1, 7, 15, kw[3])

        # Chesterfield diamond button-tufting on backrest
        mid = (cx1 + cx2) // 2
        tuft_pts = [(mid - 3, 10), (mid + 3, 10), (mid, 13)]
        for tx, ty in tuft_pts:
            px(im, tx, ty, kr[0])  # deep button dimple
            px(im, tx - 1, ty - 1, kw[5])  # top-left plump leather specular gleam
            px(im, tx, ty - 1, kw[4])
            px(im, tx - 1, ty, kw[4])
            px(im, tx + 1, ty + 1, kr[1])  # bottom-right crease shadow
            px(im, tx + 1, ty - 1, kr[2])
            px(im, tx - 1, ty + 1, kr[2])

    # Outer backrest side contours (y=7..12)
    vline(im, 4, 7, 12, kr[0])
    vline(im, 43, 7, 12, kr[0])

    # y=12..25: Rolled/bolstered side armrests (left x=2..6, right x=41..45)
    # Left bolstered armrest (sunlit top-left!)
    hline(im, 3, 5, 11, kr[0])
    px(im, 2, 12, kr[0])
    hline(im, 3, 5, 12, kw[5])
    px(im, 6, 12, kw[3])
    for y in range(13, 25):
        px(im, 2, y, kr[1] if y < 20 else kr[0])
        if y < 16:
            px(im, 3, y, kw[5] if y == 13 else kw[4])
            px(im, 4, y, kw[4] if y < 15 else kw[3])
            px(im, 5, y, kr[3])
            px(im, 6, y, kr[1])
        elif y < 22:
            px(im, 3, y, kw[3] if y < 19 else kr[3])
            px(im, 4, y, kr[3] if y < 20 else kr[2])
            px(im, 5, y, kr[2])
            px(im, 6, y, kr[0])
        else:
            px(im, 3, y, kr[2])
            px(im, 4, y, gl[4] if y == 23 else kr[2])  # front bolster cyan trim dot
            px(im, 5, y, kr[1])
            px(im, 6, y, kr[0])

    # Right bolstered armrest (x=41..45)
    hline(im, 42, 44, 11, kr[0])
    px(im, 41, 12, kw[3])
    hline(im, 42, 44, 12, kw[4])
    px(im, 45, 12, kr[0])
    for y in range(13, 25):
        px(im, 41, y, kr[1] if y < 16 else kr[0])
        if y < 16:
            px(im, 42, y, kw[4] if y == 13 else kw[3])
            px(im, 43, y, kw[3])
            px(im, 44, y, kr[2])
        elif y < 22:
            px(im, 42, y, kr[3])
            px(im, 43, y, kr[2])
            px(im, 44, y, kr[1])
        else:
            px(im, 42, y, kr[2])
            px(im, 43, y, gl[3] if y == 23 else kr[1])
            px(im, 44, y, kr[1])
        px(im, 45, y, kr[0])

    # y=17..24: Deep 3/4 plump seat cushions (x=7..40: 7..17, 18..29, 30..40)
    seat_spans = [(7, 17), (18, 29), (30, 40)]
    for s_idx, (sx1, sx2) in enumerate(seat_spans):
        for y in range(17, 24):
            for x in range(sx1, sx2 + 1):
                if y == 17:
                    c = kr[1]  # tucked rear crease
                elif y == 18:
                    c = kw[4] if x < sx2 - 2 else kw[3]
                elif y in (19, 20):
                    c = kw[4] if (sx1 + 1 <= x <= sx1 + 5 and y == 19) else kw[3]
                    if x >= sx2 - 1:
                        c = kr[3]
                elif y == 21:
                    c = kr[3] if x < sx2 - 1 else kr[2]
                elif y == 22:
                    c = kw[3] if (sx1 + 1 <= x <= sx1 + 6) else kr[2]  # rounded bullnose gleam
                else:
                    c = kr[1]
                px(im, x, y, c)
            # Crown highlight on middle of each seat cushion
            px(im, sx1 + 2, 19, kw[5])
            px(im, sx1 + 3, 19, kw[5])

        if s_idx > 0:
            vline(im, sx1, 17, 23, kr[0])

    # Cyan-piped front welt (y=24, smooth continuous piping with subtle shading)
    for x in range(7, 41):
        if x in (18, 30):
            px(im, x, 24, gl[2])
        elif x < 24:
            px(im, x, 24, gl[4])
        else:
            px(im, x, 24, gl[3])

    # Plush angled teal throw pillow on left seat (x=8..15, y=12..19)
    pillow_rows = [
        (12, 10, 13, [tl[0], tl[4], tl[3], tl[0]]),
        (13, 9, 14, [tl[0], tl[5], tl[5], tl[4], tl[3], tl[0]]),
        (14, 8, 15, [tl[0], tl[5], tl[4], tl[4], tl[3], tl[2], tl[1], tl[0]]),
        (15, 8, 15, [tl[0], tl[4], tl[4], tl[3], tl[3], tl[2], tl[1], tl[0]]),
        (16, 8, 15, [tl[0], tl[4], tl[3], tl[3], tl[2], tl[2], tl[1], tl[0]]),
        (17, 9, 15, [tl[0], tl[3], tl[2], tl[2], tl[1], tl[0], kr[0]]),
        (18, 10, 15, [tl[0], tl[2], tl[1], tl[0], kr[0], kr[1]]),
        (19, 11, 14, [kr[0], kr[0], kr[1], kr[1]]),
    ]
    for py, px1, px2, cols in pillow_rows:
        for i, c in enumerate(cols):
            if px1 + i <= px2:
                px(im, px1 + i, py, c)

    # y=25..26: Dark upholstered base apron (x=3..44)
    px(im, 3, 25, kr[0])
    hline(im, 4, 22, 25, nv[1])
    hline(im, 23, 43, 25, nv[0])
    px(im, 44, 25, kr[0])

    hline(im, 3, 44, 26, kr[0])
    hline(im, 6, 20, 26, kr[1])

    # y=27..30: 4 angled brushed-steel legs + solid ink[0]/asphalt[0] floor shadow
    # Floor shadow span at y=29..30 (leaving y=27..28 open air under sofa!)
    hline(im, 6, 41, 29, asp[0])
    hline(im, 4, 43, 30, ink[0])

    # Outer-left angled brushed-steel leg (flaring slightly outward)
    px(im, 5, 27, st[0])
    px(im, 6, 27, st[5])
    px(im, 7, 27, st[2])
    px(im, 4, 28, st[0])
    px(im, 5, 28, st[5])
    px(im, 6, 28, st[3])
    px(im, 4, 29, st[4])
    px(im, 5, 29, st[2])

    # Inner-left leg
    for y in (27, 28, 29):
        px(im, 15, y, st[4] if y < 29 else st[3])
        px(im, 16, y, st[1])

    # Inner-right leg
    for y in (27, 28, 29):
        px(im, 31, y, st[4] if y < 29 else st[3])
        px(im, 32, y, st[1])

    # Outer-right angled brushed-steel leg
    px(im, 40, 27, st[2])
    px(im, 41, 27, st[4])
    px(im, 42, 27, st[0])
    px(im, 41, 28, st[3])
    px(im, 42, 28, st[4])
    px(im, 43, 28, st[0])
    px(im, 42, 29, st[3])
    px(im, 43, 29, st[1])

    return im


# ---------------------------------------------------------------------------
# 4. pcb3-side-table-dark.png (32x32)
# ---------------------------------------------------------------------------
def make_side_table_dark() -> Image.Image:
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    kw = R["kawara"]
    kr = R["kuro"]
    st = R["steel"]
    gl = R["glass"]
    pk = R["pink"]
    rd = R["red"]
    og = R["orange"]
    tl = R["teal"]
    bl = R["blue"]
    cw = R["coolwhite"]
    asp = R["asphalt"]
    ink = R["ink"]

    # y=8..18: Rounded-corner 3/4 dark-slate tabletop (x=3..28)
    hline(im, 5, 26, 8, kw[0])
    px(im, 4, 9, kw[0])
    hline(im, 5, 16, 9, kw[4])
    hline(im, 17, 26, 9, kw[3])
    px(im, 27, 9, kw[0])

    for y in range(10, 16):
        px(im, 3, y, kw[1] if y < 13 else kr[0])
        for x in range(4, 28):
            if y < 12 and x < 15:
                c = kw[3]
            elif y < 14 and x < 21:
                c = kw[2]
            else:
                c = kw[1]
            px(im, x, y, c)
        px(im, 28, y, kr[0])

    # Chamfered brushed-steel front edge + cyan accent corners (y=16..18)
    px(im, 3, 16, st[1])
    hline(im, 4, 6, 16, gl[4])  # cyan LED corner accent left
    px(im, 5, 16, gl[5])
    hline(im, 7, 17, 16, st[5])
    hline(im, 18, 24, 16, st[4])
    hline(im, 25, 27, 16, gl[4])  # cyan LED corner accent right
    px(im, 28, 16, st[0])

    px(im, 3, 17, kr[0])
    hline(im, 4, 16, 17, kr[2])
    hline(im, 17, 27, 17, kr[1])
    px(im, 28, 17, kr[0])

    hline(im, 4, 27, 18, kr[0])

    # Prop 1 (Left, x=7..11, y=6..14): Tall iced grapefruit-ade glass with straw
    # Bent drinking straw peeking crisply above rim
    px(im, 11, 6, cw[5])
    px(im, 10, 6, cw[5])
    px(im, 10, 7, pk[4])
    # Sparkling glass rim & ice cubes (y=8..9)
    hline(im, 7, 11, 8, gl[6])
    px(im, 11, 8, cw[4])
    px(im, 7, 9, gl[5])
    px(im, 8, 9, gl[6])  # vertical specular highlight
    px(im, 9, 9, pk[5])
    px(im, 10, 9, pk[4])
    px(im, 11, 9, gl[4])
    # Grapefruit slice + pink-ruby ade gradient (y=10..13)
    px(im, 7, 10, gl[4])
    px(im, 8, 10, gl[6])
    px(im, 9, 10, og[4])  # grapefruit slice
    px(im, 10, 10, pk[4])
    px(im, 11, 10, gl[3])

    px(im, 7, 11, gl[4])
    px(im, 8, 11, pk[5])
    px(im, 9, 11, pk[3])
    px(im, 10, 11, pk[3])
    px(im, 11, 11, pk[2])

    px(im, 7, 12, pk[3])
    px(im, 8, 12, pk[4])
    px(im, 9, 12, rd[3])
    px(im, 10, 12, pk[2])
    px(im, 11, 12, pk[1])

    # Clear glass base + slate coaster shadow (y=13..14)
    px(im, 7, 13, gl[4])
    px(im, 8, 13, gl[6])
    px(im, 9, 13, gl[5])
    px(im, 10, 13, gl[3])
    px(im, 11, 13, kr[0])
    hline(im, 8, 11, 14, kr[0])

    # Prop 2 (Right, x=16..25, y=9..14): Coiled PC-bang gaming headset
    # Padded headband arch
    hline(im, 18, 23, 9, kr[0])
    px(im, 17, 10, kr[0])
    hline(im, 18, 21, 10, kr[4])
    hline(im, 22, 23, 10, kr[3])
    px(im, 24, 10, kr[0])
    # Left earcup (x=16..19, y=11..13) + Right earcup (x=22..25, y=11..13) with teal[4] RGB rings
    rect(im, 16, 11, 19, 13, kr[2])
    px(im, 16, 11, kr[3])
    px(im, 17, 12, tl[5])
    px(im, 18, 12, tl[4])
    px(im, 17, 13, tl[4])
    hline(im, 16, 19, 14, kr[0])

    rect(im, 22, 11, 25, 13, kr[2])
    px(im, 23, 12, tl[4])
    px(im, 24, 12, tl[3])
    px(im, 24, 13, tl[4])
    px(im, 25, 12, kr[0])
    px(im, 25, 13, kr[0])
    hline(im, 22, 25, 14, kr[0])
    # Short boom mic + coiled cord
    px(im, 15, 13, st[4])
    px(im, 20, 14, kr[0])
    px(im, 21, 14, kr[0])

    # y=19..29: Open-frame tubular steel legs + lower perforated magazine rack shelf
    for y in range(19, 30):
        # Left tubular leg (x=4..6)
        px(im, 4, y, st[0])
        px(im, 5, y, st[4] if y < 25 else st[3])
        px(im, 6, y, st[1])
        # Right tubular leg (x=25..27)
        px(im, 25, y, st[1])
        px(im, 26, y, st[3] if y < 25 else st[2])
        px(im, 27, y, st[0])

    # Lower perforated steel magazine shelf (x=6..25, y=23..26)
    hline(im, 7, 24, 23, st[2])
    for y in (24, 25):
        for x in range(7, 25):
            px(im, x, y, kr[1] if (x + y) % 2 == 0 else st[2])
    hline(im, 6, 25, 26, st[3])
    hline(im, 7, 24, 27, kr[0])

    # Colorful PC-bang game guide & magazine resting on shelf (x=10..21, y=22..25)
    # Bottom blue magazine (x=14..21, y=23..25)
    rect(im, 14, 23, 21, 24, bl[4])
    hline(im, 15, 21, 24, bl[3])
    px(im, 19, 23, cw[4])
    hline(im, 14, 21, 25, cw[4])  # white page edge thickness
    # Top orange game guide overlapped at slight angle (x=10..17, y=22..24)
    hline(im, 11, 16, 22, og[5])
    rect(im, 10, 23, 17, 23, og[4])
    px(im, 12, 23, cw[5])
    px(im, 13, 23, cw[4])
    hline(im, 10, 16, 24, cw[5])  # crisp page edge

    # Floor contact shadow (y=29..30)
    hline(im, 7, 24, 29, asp[0])
    hline(im, 4, 28, 30, ink[0])
    return im


# ---------------------------------------------------------------------------
# 5. pcb3-ashtray.png (16x32)
# ---------------------------------------------------------------------------
def make_ashtray() -> Image.Image:
    im = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    st = R["steel"]
    kr = R["kuro"]
    cw = R["coolwhite"]
    og = R["orange"]
    rd = R["red"]
    ink = R["ink"]

    # y=2..5: Delicate rising pixel smoke wisp (3 crisp 1px binary-alpha dots!)
    px(im, 8, 2, cw[2])
    px(im, 7, 4, cw[3])
    px(im, 8, 5, cw[4])

    # y=6..11: 3/4 elliptical stainless top basin (x=4..11)
    px(im, 5, 6, st[2])
    px(im, 6, 6, st[6])
    px(im, 7, 6, st[6])
    px(im, 8, 6, st[5])
    px(im, 9, 6, st[4])
    px(im, 10, 6, st[1])

    px(im, 4, 7, st[1])
    px(im, 5, 7, st[5])
    hline(im, 6, 9, 7, kr[1])  # dark ash pit
    px(im, 7, 7, kr[0])
    px(im, 10, 7, st[3])
    px(im, 11, 7, st[0])

    # Ash bed + glowing cigarette butt (y=8)
    px(im, 4, 8, st[1])
    px(im, 5, 8, st[4])
    px(im, 6, 8, kr[1])
    px(im, 7, 8, cw[5])  # white cigarette paper
    px(im, 8, 8, og[4])  # glowing orange ember
    px(im, 9, 8, rd[4])  # hot red tip
    px(im, 10, 8, st[2])
    px(im, 11, 8, st[0])

    # Front specular rim & rounded bowl underside (y=9..11)
    px(im, 4, 9, st[0])
    px(im, 5, 9, st[4])
    px(im, 6, 9, st[6])
    px(im, 7, 9, st[5])
    px(im, 8, 9, st[4])
    px(im, 9, 9, st[3])
    px(im, 10, 9, st[2])
    px(im, 11, 9, st[0])

    px(im, 4, 10, st[0])
    px(im, 5, 10, st[3])
    px(im, 6, 10, st[5])
    px(im, 7, 10, st[4])
    px(im, 8, 10, st[2])
    px(im, 9, 10, st[1])
    px(im, 10, 10, st[1])
    px(im, 11, 10, kr[0])

    # Tapered neck shadow under bowl (y=11)
    px(im, 5, 11, st[0])
    px(im, 6, 11, st[3])
    px(im, 7, 11, st[2])
    px(im, 8, 11, st[1])
    px(im, 9, 11, kr[1])
    px(im, 10, 11, kr[0])

    # y=12..26: Cylindrical shaded brushed-steel pillar (x=5..10)
    for y in range(12, 27):
        px(im, 5, y, st[0])
        px(im, 6, y, st[6] if y in (12, 13, 19, 20) else st[5])
        px(im, 7, y, st[5] if y < 21 else st[4])
        px(im, 8, y, st[3] if y < 22 else st[2])
        px(im, 9, y, st[1])
        px(im, 10, y, st[0])

    # Brushed chrome accent ring at y=22
    px(im, 6, 22, st[4])
    px(im, 7, 22, st[3])
    px(im, 8, 22, st[2])
    px(im, 9, 22, kr[1])

    # Dark oval stub-disposal opening (y=15..17) with chrome catch-lip
    px(im, 7, 14, st[6])
    px(im, 8, 14, st[4])
    for y in (15, 16, 17):
        px(im, 6, y, st[4] if y == 16 else st[5])
        px(im, 7, y, ink[0])
        px(im, 8, y, kr[0] if y == 15 else ink[0])
        px(im, 9, y, st[2])
    px(im, 7, 18, st[5])
    px(im, 8, 18, st[4])

    # y=27..30: Tiered circular weighted base (x=3..12)
    px(im, 4, 27, st[1])
    px(im, 5, 27, st[4])
    px(im, 6, 27, st[5])
    px(im, 7, 27, st[4])
    px(im, 8, 27, st[3])
    px(im, 9, 27, st[2])
    px(im, 10, 27, st[1])
    px(im, 11, 27, st[0])

    px(im, 3, 28, st[0])
    px(im, 4, 28, st[3])
    px(im, 5, 28, st[5])
    px(im, 6, 28, st[5])
    px(im, 7, 28, st[4])
    px(im, 8, 28, st[3])
    px(im, 9, 28, st[2])
    px(im, 10, 28, st[1])
    px(im, 11, 28, kr[1])
    px(im, 12, 28, kr[0])

    px(im, 3, 29, kr[0])
    hline(im, 4, 6, 29, st[2])
    hline(im, 7, 9, 29, kr[2])
    hline(im, 10, 11, 29, kr[1])
    px(im, 12, 29, kr[0])

    hline(im, 4, 12, 30, ink[0])
    return im


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    allowed_rgb = load_palette(PALETTE_PATH)

    targets = [
        ("pcb3-kiosk-1", make_kiosk_1()),
        ("pcb3-kiosk-pair", make_kiosk_pair()),
        ("pcb3-tray-bin", make_tray_bin()),
        ("pcb3-wait-sofa-dark", make_wait_sofa_dark()),
        ("pcb3-side-table-dark", make_side_table_dark()),
        ("pcb3-ashtray", make_ashtray()),
    ]

    all_ok = True
    for stem, im in targets:
        p1 = OUT_DIR / f"{stem}.png"
        p4 = OUT_DIR / f"{stem}-x4.png"
        im.save(p1)
        im4 = im.resize((im.width * 4, im.height * 4), Image.Resampling.NEAREST)
        im4.save(p4)

        rep = verify_sprite(p1, allowed_rgb, forbid_pure_black=True)
        status = "PASS" if rep.ok else f"FAIL({rep.errors})"
        print(
            f"{p1.name:24s} {rep.width:2d}x{rep.height:<2d} "
            f"opaque={rep.opaque_pixels:4d} colors={rep.unique_colors:2d} "
            f"pv={rep.palette_violations} av={rep.alpha_violations} "
            f"pure_black={rep.pure_black_pixels} sha256={rep.pixel_sha256[:12]} {status}"
        )
        if not rep.ok:
            all_ok = False

    if not all_ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
