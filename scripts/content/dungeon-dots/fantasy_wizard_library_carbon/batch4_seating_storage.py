#!/usr/bin/env python3
"""
T2 Library Batch 4/4 — 5 Seating & Storage Objects (Museum-Grade Volumetric Upgrade)
Target: tiledata/dungeon-dots/fantasy_wizard_library_carbon/objects/
Preview: tiledata/dungeon-dots/fantasy_wizard_library_carbon/preview_batch4.png

Hard Rules Enforced:
  1. 100% locked to 70-color palette_beodeul_library.json (0 off-palette, 0 #000000).
  2. Ground shadow strictly #4c557f @ alpha 85/255; all other pixels alpha 0 or 255.
  3. 1px dark material outer outline on EVERY 4-connected edge touching transparency/shadow.
  4. Camera contracts:
       - chair    : oak_study_chair (16x16), wooden_stool (16x16) — near top-down (ref_ezt_chair_front_a.png)
       - standing : treasure_chest_bound (16x16), wooden_crates_stack (32x32), oak_barrel_hooped (16x16)
                    front face + 1/4..1/3 lit top band, ZERO side walls.
"""

from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

WORKTREE = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
PALETTE_JSON = WORKTREE / "tiledata/dungeon-dots/fantasy_wizard_library/palette_beodeul_library.json"
OLD_OBJ_DIR = WORKTREE / "tiledata/dungeon-dots/fantasy_wizard_library/objects"
CHAR_REF_PNG = WORKTREE / "tiledata/dungeon-pilot/_dots_kit_refs/ref_beodeul_char_4x.png"

OUT_ROOT = WORKTREE / "tiledata/dungeon-dots/fantasy_wizard_library_carbon"
OUT_DIR = OUT_ROOT / "objects"
PREVIEW_PNG = OUT_ROOT / "preview_batch4.png"

SHADOW_RGBA = (0x4C, 0x55, 0x7F, 85)

# ---------------------------------------------------------------------------
# Locked Beodeul Wizard Library Ramps (verified against palette_beodeul_library.json)
# ---------------------------------------------------------------------------
DO_O = "#1f130b"  # dark_oak_out
DO0  = "#2d1c12"
DO1  = "#442c19"
DO2  = "#60402b"
DO3  = "#805338"
DO4  = "#a56846"

OK_O = "#382315"  # oak_out
OK0  = "#583a24"
OK1  = "#774d2a"
OK2  = "#9a6841"
OK3  = "#bd9056"
OK4  = "#d8aa73"
OK5  = "#e9c28e"

IR_O = "#141b2c"  # iron_out
IR0  = "#28303c"
IR1  = "#424956"
IR2  = "#697782"
IR3  = "#aebdca"

GD_O = "#4e3d22"  # brass_out
GD0  = "#72552b"
GD1  = "#a6874c"
GD2  = "#c9aa64"
GD3  = "#efc97b"
GD4  = "#fff0c0"

PA_O = "#5f5145"  # parchment_out
PA0  = "#8e8574"
PA1  = "#beb6a1"
PA2  = "#ded6bc"
PA3  = "#f2e6cf"

RD_O = "#421b1d"  # crimson_out
RD0  = "#6b2c2b"
RD1  = "#8c3938"
RD2  = "#a44332"
RD3  = "#c65340"

PL0  = "#492545"  # plum_0 (deep velvet wine shadow)
PL1  = "#772f49"

ALLOWED_DARK_OUTLINES = {
    DO_O, DO0, OK_O, IR_O, IR0, RD_O, GD_O, "#1c1c26", "#27282f"
}


def hex_to_rgba(hx: str, alpha: int = 255) -> tuple[int, int, int, int]:
    h = hx.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


def rgba_to_hex(rgba: tuple[int, int, int, int]) -> str:
    return f"#{rgba[0]:02x}{rgba[1]:02x}{rgba[2]:02x}"


def luma(r: int, g: int, b: int) -> float:
    return 0.299 * r + 0.587 * g + 0.114 * b


def load_palette() -> set[str]:
    data = json.loads(PALETTE_JSON.read_text(encoding="utf-8"))
    colors = {c.lower() for c in data["colors"]}
    assert len(colors) == 70, f"Expected 70 palette colors, got {len(colors)}"
    assert "#000000" not in colors, "Pure black #000000 forbidden!"
    return colors


def new_canvas(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def put(img: Image.Image, x: int, y: int, col: str | tuple[int, int, int, int] | None) -> None:
    if not (0 <= x < img.width and 0 <= y < img.height):
        return
    if col is None:
        img.putpixel((x, y), (0, 0, 0, 0))
    elif isinstance(col, tuple):
        img.putpixel((x, y), col)
    else:
        img.putpixel((x, y), hex_to_rgba(col))


def hline(img: Image.Image, x0: int, x1: int, y: int, col: str | tuple[int, int, int, int]) -> None:
    for x in range(x0, x1 + 1):
        put(img, x, y, col)


def vline(img: Image.Image, x: int, y0: int, y1: int, col: str | tuple[int, int, int, int]) -> None:
    for y in range(y0, y1 + 1):
        put(img, x, y, col)


def rect(img: Image.Image, x0: int, y0: int, x1: int, y1: int, col: str | tuple[int, int, int, int]) -> None:
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(img, x, y, col)


def shadow_px(img: Image.Image, x: int, y: int) -> None:
    if 0 <= x < img.width and 0 <= y < img.height and img.getpixel((x, y))[3] == 0:
        img.putpixel((x, y), SHADOW_RGBA)


def shadow_bar(img: Image.Image, x0: int, x1: int, y: int) -> None:
    for x in range(x0, x1 + 1):
        shadow_px(img, x, y)


# ---------------------------------------------------------------------------
# 1. oak_study_chair.png (16x16, chair, opaque 12x14: x=2..13, y=1..14)
# ---------------------------------------------------------------------------
def draw_oak_study_chair() -> Image.Image:
    """
    Carved oak study chair (ref_ezt_chair_front_a.png near top-down camera):
      - Ornate top-edge carved backrest rail with flared scroll ears (y=1..3)
      - Indented slatted backrest waist with two sculpted oak balusters over dark recess (y=4..5)
      - Flared sculpted oak armrests (x=2..3 and x=12..13, y=6..10) with bright scroll knuckles
      - Plush tufted crimson velvet seat seen from above (x=4..11, y=6..10) + brass corner tacks
      - Carved front oak seat rail (y=11..12) + stout front leg stubs with open floor arch (y=13..14)
    """
    img = new_canvas(16, 16)

    # y=1: top outline of carved backrest crest & corner finials (x=3..12)
    hline(img, 3, 12, 1, DO_O)

    # y=2: ornate carved backrest top rail with flared scroll ears (x=2..13)
    row2 = [
        (2, DO_O),
        (3, OK5),  # bright left finial highlight
        (4, OK4),
        (5, OK3),
        (6, GD3),  # gilded/carved center crest scroll
        (7, OK5),  # crest crown highlight
        (8, OK4),
        (9, GD2),  # carved crest right accent
        (10, OK2),
        (11, OK3), # right finial highlight
        (12, OK2),
        (13, DO_O),
    ]
    for x, c in row2:
        put(img, x, 2, c)

    # y=3: lower beveled molding of carved top rail + ear underside outline (x=2..13)
    row3 = [
        (2, DO_O),
        (3, OK4),
        (4, OK1),
        (5, DO2),
        (6, OK2),
        (7, OK3),  # center medallion relief
        (8, OK2),
        (9, DO2),
        (10, OK0),
        (11, OK1),
        (12, OK2),
        (13, DO_O),
    ]
    for x, c in row3:
        put(img, x, 3, c)

    # y=4..5: indented waist (x=3..12) so top scroll ears & lower armrests read unmistakably!
    # Vertical oak stiles at x=4,11 + two carved vertical balusters at x=6,9 over deep DO0 gaps
    for y, st_l, sl_l, sl_r, st_r in (
        (4, OK4, OK3, OK2, OK2),
        (5, OK3, OK2, OK1, OK1),
    ):
        put(img, 3, y, DO_O)
        put(img, 4, y, st_l)
        put(img, 5, y, DO0)
        put(img, 6, y, sl_l)
        put(img, 7, y, DO0)
        put(img, 8, y, DO0)
        put(img, 9, y, sl_r)
        put(img, 10, y, DO0)
        put(img, 11, y, st_r)
        put(img, 12, y, DO_O)

    # y=6..10: flared sculpted oak armrests (x=2..3 & x=12..13) + plush crimson velvet cushion (x=4..11)
    # Outer dark oak outline along armrests
    vline(img, 2, 6, 12, DO_O)
    vline(img, 13, 6, 12, DO_O)

    # Left lit oak armrest (x=3) & right shaded oak armrest (x=12)
    arm_l = {6: OK5, 7: OK4, 8: OK4, 9: OK3, 10: OK5}  # y=10 bright scroll knuckle!
    arm_r = {6: OK3, 7: OK2, 8: OK2, 9: OK1, 10: OK3}
    for y in range(6, 11):
        put(img, 3, y, arm_l[y])
        put(img, 12, y, arm_r[y])

    # Plush crimson cushioned seat seen from above (x=4..11, y=6..10) — smooth pillowy velvet highlight!
    cushion_rows = {
        6:  [RD0, RD2, RD2, RD2, RD1, RD1, RD0, RD_O],  # tucked under backrest shadow
        7:  [RD1, RD3, RD3, RD3, RD2, RD2, RD1, RD0],   # soft plush upper-left velvet highlight
        8:  [RD1, RD3, RD3, RD2, RD2, RD1, RD1, PL0],   # smooth pillowy crown (no eye-like twin dots)
        9:  [RD0, RD2, RD2, RD2, RD1, RD1, RD0, PL0],   # rounded front cushion slope
        10: [GD2, RD1, RD1, RD0, RD0, RD0, RD_O, GD1],  # front welt + antique-brass corner tacks!
    }
    for y, cols in cushion_rows.items():
        for idx, c in enumerate(cols):
            put(img, 4 + idx, y, c)

    # y=11: carved oak front seat apron catching top-left light
    row11 = [
        (2, DO_O), (3, OK2), (4, OK4), (5, OK4), (6, OK3), (7, OK3),
        (8, OK2), (9, OK2), (10, OK1), (11, OK1), (12, OK0), (13, DO_O),
    ]
    for x, c in row11:
        put(img, x, 11, c)

    # y=12: underside of front rail (x=5..10 is DO_O dark arch outline above open leg gap!)
    row12 = [
        (2, DO_O), (3, OK1), (4, DO1),
        (5, DO_O), (6, DO_O), (7, DO_O), (8, DO_O), (9, DO_O), (10, DO_O),
        (11, DO0), (12, OK0), (13, DO_O),
    ]
    for x, c in row12:
        put(img, x, 12, c)

    # y=13..14: stout carved front oak stub legs (left x=2..4, right x=11..13)
    put(img, 2, 13, DO_O); put(img, 3, 13, OK3); put(img, 4, 13, DO_O)
    hline(img, 2, 4, 14, DO_O)

    put(img, 11, 13, DO_O); put(img, 12, 13, OK2); put(img, 13, 13, DO_O)
    hline(img, 11, 13, 14, DO_O)

    # Ground shadow (#4c557f @ 85) under arch & legs
    shadow_bar(img, 5, 10, 14)
    shadow_bar(img, 3, 12, 15)
    return img


# ---------------------------------------------------------------------------
# 2. wooden_stool.png (16x16, chair, opaque 12x12: x=2..13, y=3..14)
# ---------------------------------------------------------------------------
def draw_wooden_stool() -> Image.Image:
    """
    Rounded lathe-turned oak tavern/study stool (12x12 opaque):
      - Smooth circular/oval top seen near top-down (y=3..9)
      - Curved top plank joinery seam + wooden dowel pegs + top-left bevel sheen
      - Thick bullnose lathe-turned oak edge & dark molded underside apron
      - Stout angled legs tucked underneath + turned horizontal stretcher rung (y=10..14)
    """
    img = new_canvas(16, 16)

    # y=3: top back arc outline (x=4..11, 8px -> textbook 8-10-12-10 oval!)
    hline(img, 4, 11, 3, OK_O)
    hline(img, 9, 11, 3, DO_O)

    # y=4: upper beveled curve (x=3..12, 10px)
    row4 = [
        (3, OK_O),
        (4, OK5), (5, OK5), (6, OK5), (7, OK4), (8, OK4), (9, OK3), (10, OK3), (11, OK2),
        (12, DO_O),
    ]
    for x, c in row4:
        put(img, x, 4, c)

    # y=5: widening to full 12px oval top (x=2..13)
    row5 = [
        (2, OK_O),
        (3, OK5), (4, OK5), (5, OK4), (6, OK4), (7, OK4),
        (8, OK3), (9, OK3), (10, OK3), (11, OK2), (12, OK1),
        (13, DO_O),
    ]
    for x, c in row5:
        put(img, x, 5, c)

    # y=6: subtle curved plank joinery seam across seat + twin dowel peg accents at x=5,10
    row6 = [
        (2, OK_O),
        (3, OK4), (4, OK2), (5, OK1), (6, OK2), (7, OK2),
        (8, OK1), (9, OK1), (10, OK0), (11, OK1), (12, OK0),
        (13, DO_O),
    ]
    for x, c in row6:
        put(img, x, 6, c)

    # y=7: lower plank catch-light & warm oak grain (x=2..13)
    row7 = [
        (2, OK_O),
        (3, OK4), (4, OK5), (5, OK4), (6, OK4), (7, OK3),
        (8, OK3), (9, OK2), (10, OK2), (11, OK1), (12, OK0),
        (13, DO_O),
    ]
    for x, c in row7:
        put(img, x, 7, c)

    # y=8: lathe-turned bullnose front bevel lip (x=2..13; x=2,13 step in at y=9)
    row8 = [
        (2, OK_O),
        (3, OK2), (4, OK3), (5, OK3), (6, OK3), (7, OK2),
        (8, OK2), (9, OK1), (10, OK0), (11, DO2), (12, DO1),
        (13, DO_O),
    ]
    for x, c in row8:
        put(img, x, 8, c)

    # y=9: dark-shaded molded underside rim of thick round slab (x=3..12)
    row9 = [
        (3, DO_O),
        (4, OK1), (5, OK0), (6, DO2), (7, DO2),
        (8, DO1), (9, DO1), (10, DO0), (11, DO0),
        (12, DO_O),
    ]
    for x, c in row9:
        put(img, x, 9, c)

    # y=10: stout legs emerging from deep underside shadow (x=3..12)
    row10 = [
        (3, DO_O), (4, OK2), (5, DO1),
        (6, DO0), (7, DO0), (8, DO0), (9, DO0),
        (10, DO1), (11, OK1), (12, DO_O),
    ]
    for x, c in row10:
        put(img, x, 10, c)

    # y=11: lathe-turned leg knops + horizontal wooden stretcher rung (x=3..12)
    row11 = [
        (3, DO_O), (4, OK3), (5, DO2),
        (6, OK2), (7, OK1), (8, DO2), (9, DO1),
        (10, DO1), (11, OK2), (12, DO_O),
    ]
    for x, c in row11:
        put(img, x, 11, c)

    # y=12: stretcher rung bottom outline (x=6..9 is DO_O above open floor gap!)
    row12 = [
        (3, DO_O), (4, OK2), (5, DO1),
        (6, DO_O), (7, DO_O), (8, DO_O), (9, DO_O),
        (10, DO0), (11, OK1), (12, DO_O),
    ]
    for x, c in row12:
        put(img, x, 12, c)

    # y=13..14: stout tapered lower leg stubs (left x=3..5, right x=10..12)
    put(img, 3, 13, DO_O); put(img, 4, 13, OK1); put(img, 5, 13, DO_O)
    hline(img, 3, 5, 14, DO_O)

    put(img, 10, 13, DO_O); put(img, 11, 13, DO2); put(img, 12, 13, DO_O)
    hline(img, 10, 12, 14, DO_O)

    # Soft elliptical shadow (#4c557f @ 85)
    shadow_bar(img, 6, 9, 14)
    shadow_bar(img, 4, 11, 15)
    return img


# ---------------------------------------------------------------------------
# 3. treasure_chest_bound.png (16x16, standing, opaque 14x13: x=1..14, y=2..14)
# ---------------------------------------------------------------------------
def draw_treasure_chest_bound() -> Image.Image:
    """
    Iconic curved-lid RPG treasure chest (14x13 opaque, standing camera, ZERO side walls):
      - Barrel-vaulted oak top lid band (~1/3 height, y=2..6) with curved cylindrical crown sheen
      - Gleaming twin vertical dark-iron straps (x=3..4, x=11..12) with 1px #aebdca specular highlights
      - Bright antique-brass shield lockplate (x=6..9, y=6..9) with crisp dark keyhole
      - Warm oak front planks with dark horizontal plank seam & brass corner rivets
    """
    img = new_canvas(16, 16)

    # y=2: curved barrel-lid top outline (x=2..13, rounded upper corners at x=1,14)
    row2 = [
        (2, DO_O), (3, IR_O), (4, IR_O),
        (5, DO_O), (6, DO_O), (7, DO_O), (8, DO_O), (9, DO_O), (10, DO_O),
        (11, IR_O), (12, IR_O), (13, DO_O),
    ]
    for x, c in row2:
        put(img, x, 2, c)

    # y=3: upper slope of domed oak lid (x=1..14)
    row3 = [
        (1, DO_O), (2, OK3),
        (3, IR2), (4, IR1),
        (5, OK4), (6, OK4), (7, OK4), (8, OK3), (9, OK3), (10, OK2),
        (11, IR1), (12, IR0),
        (13, OK1), (14, DO_O),
    ]
    for x, c in row3:
        put(img, x, 3, c)

    # y=4: brightest curved crown of barrel lid + 1px #aebdca iron specular highlights!
    row4 = [
        (1, DO_O), (2, OK4),
        (3, IR3), (4, IR2),  # 1px gleaming specular shine on left iron strap!
        (5, OK5), (6, OK5), (7, OK5), (8, OK4), (9, OK4), (10, OK3),
        (11, IR3), (12, IR1), # 1px gleaming specular shine on right iron strap!
        (13, OK2), (14, DO_O),
    ]
    for x, c in row4:
        put(img, x, 4, c)

    # y=5: frontward slope of curved oak lid
    row5 = [
        (1, DO_O), (2, OK3),
        (3, IR2), (4, IR0),
        (5, OK3), (6, OK3), (7, OK2), (8, OK2), (9, OK2), (10, OK1),
        (11, IR1), (12, IR0),
        (13, OK1), (14, DO_O),
    ]
    for x, c in row5:
        put(img, x, 5, c)

    # y=6: lid rim band + lid corner rivets + top clasp of antique-brass lockplate
    row6 = [
        (1, IR_O), (2, GD2),  # left brass corner rivet
        (3, IR1), (4, IR0),
        (5, OK1),
        (6, GD4), (7, GD3), (8, GD3), (9, GD2),  # gleaming brass clasp top
        (10, OK0),
        (11, IR1), (12, IR0),
        (13, GD1), (14, IR_O), # right brass corner rivet
    ]
    for x, c in row6:
        put(img, x, 6, c)

    # y=7: deep lid split shadow seam + bright brass lockplate body
    row7 = [
        (1, DO_O), (2, DO_O),
        (3, IR0), (4, DO_O), (5, DO_O),
        (6, GD3), (7, GD4), (8, GD3), (9, GD1),
        (10, DO_O), (11, IR0), (12, DO_O),
        (13, DO_O), (14, DO_O),
    ]
    for x, c in row7:
        put(img, x, 7, c)

    # y=8: upper front oak plank + brass keyhole + upper chest corner rivets
    row8 = [
        (1, IR_O), (2, GD3),  # bright upper-left corner rivet
        (3, IR2), (4, IR0),
        (5, OK3),
        (6, GD2), (7, DO_O), (8, GD2), (9, GD0),  # crisp dark keyhole at (7,8)!
        (10, OK2),
        (11, IR1), (12, IR0),
        (13, GD2), (14, IR_O), # upper-right corner rivet
    ]
    for x, c in row8:
        put(img, x, 8, c)

    # y=9: front iron strap 1px specular shine + lower shield point of brass lockplate
    row9 = [
        (1, DO_O), (2, OK3),
        (3, IR3), (4, IR1),  # 1px front specular glint on iron strap!
        (5, OK3),
        (6, GD_O), (7, GD3), (8, GD1), (9, GD_O),
        (10, OK2),
        (11, IR2), (12, IR0),
        (13, OK1), (14, DO_O),
    ]
    for x, c in row9:
        put(img, x, 9, c)

    # y=10: crisp dark horizontal oak plank gap seam across chest body
    row10 = [
        (1, DO_O), (2, DO1),
        (3, IR2), (4, IR0),
        (5, DO1), (6, DO1), (7, DO_O), (8, DO_O), (9, DO1), (10, DO0),
        (11, IR1), (12, IR0),
        (13, DO0), (14, DO_O),
    ]
    for x, c in row10:
        put(img, x, 10, c)

    # y=11: lower oak plank catching warm top-left bevel light below seam
    row11 = [
        (1, DO_O), (2, OK3),
        (3, IR2), (4, IR0),
        (5, OK3), (6, OK3), (7, OK2), (8, OK2), (9, OK1), (10, OK1),
        (11, IR1), (12, IR0),
        (13, OK1), (14, DO_O),
    ]
    for x, c in row11:
        put(img, x, 11, c)

    # y=12: lower oak plank shading
    row12 = [
        (1, DO_O), (2, OK2),
        (3, IR1), (4, IR0),
        (5, OK2), (6, OK1), (7, OK1), (8, DO2), (9, DO2), (10, DO1),
        (11, IR1), (12, IR0),
        (13, DO1), (14, DO_O),
    ]
    for x, c in row12:
        put(img, x, 12, c)

    # y=13: heavy iron-reinforced base trim + bottom brass corner rivets
    row13 = [
        (1, IR_O), (2, GD2),
        (3, IR2), (4, IR0),
        (5, DO1), (6, DO1), (7, DO1), (8, DO0), (9, DO0), (10, DO0),
        (11, IR1), (12, IR0),
        (13, GD1), (14, IR_O),
    ]
    for x, c in row13:
        put(img, x, 13, c)

    # y=14: 1px dark material bottom outline
    hline(img, 1, 4, 14, IR_O)
    hline(img, 5, 10, 14, DO_O)
    hline(img, 11, 14, 14, IR_O)

    # Ground shadow (#4c557f @ 85)
    shadow_bar(img, 2, 13, 15)
    return img


# ---------------------------------------------------------------------------
# 4. wooden_crates_stack.png (32x32, standing, opaque 28x27: x=2..29, y=4..30)
# ---------------------------------------------------------------------------
def draw_wooden_crates_stack() -> Image.Image:
    """
    Pyramid stack of 3 weathered Beodeul wooden supply crates (28x27 opaque, standing camera):
      - Inspired by ref_beodeul_props_best_4x.png & ref_bd6_city_harb_wooden_crates_stack.png
      - ZERO side walls: each crate shows its framed front face + narrow 3-4px lit top plank band
      - Bottom-left crate (x=2..15, y=16..30, 14x15): warm golden oak, '\\' diagonal brace
      - Bottom-right crate (x=16..29, y=17..30, 14x14): deeper weathered oak, '/' diagonal brace
      - Top crate (x=8..23, y=4..18, 16x15): resting atop lower crates' top lids + casting crisp AO shadow!
      - Recessed horizontal planks with dark gap seams, 2px beveled stiles/rails, iron corner nail dots
    """
    img = new_canvas(32, 32)

    def build_single_crate(
        x0: int,
        y0: int,
        w: int,
        h: int,
        aged: bool,
        slash_dir: str,
    ) -> None:
        x1 = x0 + w - 1
        y1 = y0 + h - 1

        # Material tone selection (sun-warmed oak vs slightly deeper weathered harbor oak)
        if not aged:
            top_hi, top_mid, top_lo = OK5, OK4, OK3
            frm_hi, frm_mid, frm_lo, frm_sh = OK4, OK3, OK2, OK1
            pnl_base, pnl_lo, seam_col = OK1, DO2, DO0
            brc_hi, brc_lo = OK4, OK2
        else:
            top_hi, top_mid, top_lo = OK4, OK3, OK2
            frm_hi, frm_mid, frm_lo, frm_sh = OK3, OK2, OK1, OK0
            pnl_base, pnl_lo, seam_col = DO3, DO2, DO0
            brc_hi, brc_lo = OK3, OK1

        # 1. Outer 1px dark oak outline
        rect(img, x0, y0, x1, y1, DO_O)

        # 2. Lit 3/4 Top Plank Lid Band (y0+1 .. y0+3 = 3px interior, ~1/4 height, NO side walls!)
        # y0+1: bright back-top bevel
        hline(img, x0 + 1, x1 - 1, y0 + 1, top_mid)
        hline(img, x0 + 1, (x0 + x1) // 2, y0 + 1, top_hi)
        put(img, x0 + 4, y0 + 1, top_lo)  # subtle plank joint grain
        # y0+2: mid top lid plank seam
        hline(img, x0 + 1, x1 - 1, y0 + 2, top_lo)
        hline(img, x0 + 2, (x0 + x1) // 2 - 1, y0 + 2, top_mid)
        # y0+3: crisp front lid lip catching top-left light!
        hline(img, x0 + 1, x1 - 1, y0 + 3, top_mid)
        hline(img, x0 + 1, (x0 + x1) // 2 + 1, y0 + 3, top_hi)
        put(img, x1 - 1, y0 + 3, top_lo)

        # y0+4: dark lid overhang crease separating top lid from front frame
        hline(img, x0 + 1, x1 - 1, y0 + 4, DO1)
        hline(img, (x0 + x1) // 2 + 1, x1 - 1, y0 + 4, DO0)

        # 3. Sturdy Front Perimeter Frame (y0+5 .. y1-1)
        rect(img, x0 + 1, y0 + 5, x1 - 1, y1 - 1, frm_mid)
        # Top-left lit outer frame bevels (top rail y0+5 & left stile x0+1)
        hline(img, x0 + 1, x1 - 2, y0 + 5, frm_hi)
        vline(img, x0 + 1, y0 + 5, y1 - 2, frm_hi)
        # Right & bottom shaded frame bevels
        vline(img, x1 - 1, y0 + 5, y1 - 1, frm_sh)
        vline(img, x1 - 2, y0 + 6, y1 - 2, frm_lo)
        hline(img, x0 + 1, x1 - 1, y1 - 1, frm_sh)
        hline(img, x0 + 2, x1 - 2, y1 - 2, frm_lo)
        hline(img, x0 + 2, (x0 + x1) // 2, y1 - 2, frm_mid)

        # 4. Deeply Recessed Horizontal Plank Panel (x0+3 .. x1-3, y0+7 .. y1-3)
        px0, px1 = x0 + 3, x1 - 3
        py0, py1 = y0 + 7, y1 - 3
        rect(img, px0, py0, px1, py1, pnl_base)
        # Right-side falloff on recessed planks
        rect(img, (px0 + px1) // 2 + 1, py0, px1, py1, pnl_lo)
        # Deep upper & left inner frame cast shadow (recess cue!)
        hline(img, px0, px1, py0, seam_col)
        vline(img, px0, py0, py1, DO1)
        # Crisp dark horizontal plank gap seams inside recessed panel
        for sy in range(py0 + 2, py1, 2):
            hline(img, px0, px1, sy, seam_col)

        # 5. Sculpted 2px Diagonal Timber Cross-Brace across recessed panel
        span_x = px1 - px0
        span_y = py1 - py0
        for dx in range(span_x + 1):
            t = dx / max(1, span_x)
            if slash_dir == "\\":
                bx = px0 + dx
                by = py0 + int(round(t * span_y))
                put(img, bx, by, brc_hi)
                if by + 1 <= py1:
                    put(img, bx, by + 1, brc_lo)
                if by + 2 <= py1:
                    put(img, bx, by + 2, seam_col)
            else:
                bx = px0 + dx
                by = py1 - int(round(t * span_y))
                put(img, bx, by, brc_hi)
                if by + 1 <= py1:
                    put(img, bx, by + 1, brc_lo)
                if by + 2 <= py1:
                    put(img, bx, by + 2, seam_col)

        # 6. Crisp Iron Corner Nail Dots on all 4 corners of the front frame!
        nail_coords = [
            (x0 + 2, y0 + 6),
            (x1 - 2, y0 + 6),
            (x0 + 2, y1 - 2),
            (x1 - 2, y1 - 2),
        ]
        for nx, ny in nail_coords:
            put(img, nx, ny, IR0)
        # Subtle 1px iron nail specular glints on upper-left & upper-right frame corners
        put(img, x0 + 2, y0 + 5, IR2)
        put(img, x1 - 2, y0 + 5, IR1)

    # Draw Bottom-Left Crate (14x15: x=2..15, y=16..30)
    build_single_crate(2, 16, 14, 15, aged=False, slash_dir="\\")

    # Draw Bottom-Right Crate (14x14: x=16..29, y=17..30 — 1px stepped height like Beodeul harbor ref!)
    build_single_crate(16, 17, 14, 14, aged=True, slash_dir="/")

    # Cast shadow from Top Crate (x=8..23, y=4..18) onto the top lids/upper rails of both lower crates!
    # Shadow to the right of top crate across bottom-right crate's top lid (x=24..25, y=18..19)
    put(img, 24, 18, OK0); put(img, 25, 18, OK1)
    put(img, 24, 19, OK0); put(img, 25, 19, OK1)
    # Contact AO shadow directly underneath top crate's base at y=19 (x=8..14 on left crate, x=17..23 on right crate)
    hline(img, 8, 14, 19, DO0)
    hline(img, 17, 23, 19, DO0)
    hline(img, 9, 14, 20, DO1)

    # Draw Top Centered Crate (16x15: x=8..23, y=4..18 — sits solidly on lower crates' top lids!)
    build_single_crate(8, 4, 16, 15, aged=False, slash_dir="/")

    # Ground shadow (#4c557f @ 85) across y=31
    shadow_bar(img, 3, 28, 31)
    return img


# ---------------------------------------------------------------------------
# 5. oak_barrel_hooped.png (16x16, standing, opaque 12x14: x=2..13, y=1..14)
# ---------------------------------------------------------------------------
def draw_oak_barrel_hooped() -> Image.Image:
    """
    Plump curved oak wine/reagent barrel (12x14 opaque, standing camera, ZERO flat box edges):
      - Symmetrical bulging bilge silhouette: widths 8 -> 10 -> 10 -> 12 (x7) -> 10 (x3) -> 8
      - Sunken circular oak top lid inside raised bright wooden chime rim (y=1..4)
      - Twin CURVED dark-iron hoops (dipping 1px across center to follow 3/4 cylinder!)
        each with a crisp 1px #aebdca specular shine
      - Cylindrical left-to-right + vertical belly stave shading, dark stave seams, and cork bung dot!
    """
    img = new_canvas(16, 16)

    # y=1: curved back chime outline (x=4..11, 8px)
    hline(img, 4, 11, 1, OK_O)
    hline(img, 9, 11, 1, DO_O)

    # y=2: elliptical top lid upper half — raised bright left chime + dark sunken inner shadow (x=3..12, 10px)
    row2 = [
        (3, OK_O),
        (4, OK5),  # bright raised wooden chime rim
        (5, OK1), (6, OK1), (7, OK1), (8, OK0), (9, OK0), (10, DO1),  # sunken lid recess shadow!
        (11, OK3), # right chime rim
        (12, DO_O),
    ]
    for x, c in row2:
        put(img, x, 2, c)

    # y=3: elliptical sunken lid planks + small top vent plug (x=3..12, 10px)
    row3 = [
        (3, OK_O),
        (4, OK4),  # left raised chime
        (5, OK4), (6, OK3), (7, OK1), (8, OK3), (9, DO2), (10, OK2),  # sunken head boards + seam
        (11, OK2), # right raised chime
        (12, DO_O),
    ]
    for x, c in row3:
        put(img, x, 3, c)

    # y=4: bright curved front wooden chime lip & shoulder flare (x=2..13, 12px)
    row4 = [
        (2, OK_O),
        (3, OK3), (4, OK5), (5, OK5), (6, OK4), (7, OK4),
        (8, OK3), (9, OK3), (10, OK2), (11, OK1), (12, OK0),
        (13, DO_O),
    ]
    for x, c in row4:
        put(img, x, 4, c)

    # y=5: upper iron hoop outer flanks (x=3..4 & x=11..12) + wood staves above dipped center!
    row5 = [
        (2, IR_O),
        (3, IR2), (4, IR3),  # left hoop flank curving down
        (5, OK3), (6, OK1), (7, OK3), (8, OK2), (9, OK0), (10, OK1),
        (11, IR1), (12, IR0), # right hoop flank curving down
        (13, IR_O),
    ]
    for x, c in row5:
        put(img, x, 5, c)

    # y=6: curved center span of upper iron hoop (x=4..11) + 1px #aebdca specular shine!
    row6 = [
        (2, OK_O),
        (3, OK3),
        (4, IR2), (5, IR3), (6, IR2), (7, IR1), (8, IR1), (9, IR0), (10, IR0), (11, IR0),
        (12, DO1),
        (13, DO_O),
    ]
    for x, c in row6:
        put(img, x, 6, c)

    # y=7: plump upper-mid belly staves (stave seams at x=6, 9; cylindrical highlight at x=4..5)
    row7 = [
        (2, OK_O),
        (3, OK3), (4, OK5), (5, OK4), (6, OK1),
        (7, OK3), (8, OK3), (9, OK0),
        (10, OK2), (11, OK1), (12, DO1),
        (13, DO_O),
    ]
    for x, c in row7:
        put(img, x, 7, c)

    # y=8: widest belly crown + protruding cork/brass bung dot at (7,8) with dark socket rim (8,8)!
    row8 = [
        (2, OK_O),
        (3, OK3), (4, OK5), (5, OK4), (6, OK1),
        (7, GD2), (8, DO_O),  # warm cork/brass bung dot + crisp dark socket rim!
        (9, OK0), (10, OK1), (11, OK0), (12, DO1),
        (13, DO_O),
    ]
    for x, c in row8:
        put(img, x, 8, c)

    # y=9: lower-mid belly staves rolling into shadow
    row9 = [
        (2, OK_O),
        (3, OK2), (4, OK4), (5, OK3), (6, OK0),
        (7, DO1), (8, OK2),  # subtle bung drop shadow at (7,9)
        (9, DO1), (10, OK1), (11, OK0), (12, DO0),
        (13, DO_O),
    ]
    for x, c in row9:
        put(img, x, 9, c)

    # y=10: lower iron hoop outer flanks (x=3..4 & x=11..12; x=2,13 step in at y=11!)
    row10 = [
        (2, IR_O),
        (3, IR2), (4, IR2),
        (5, OK3), (6, OK0), (7, OK2), (8, OK1), (9, DO1), (10, OK0),
        (11, IR1), (12, IR0),
        (13, IR_O),
    ]
    for x, c in row10:
        put(img, x, 10, c)

    # y=11: tapered lower hoop center dip (x=3..12, 10px) + 1px #aebdca specular shine at (5,11)!
    row11 = [
        (3, IR_O),
        (4, IR2), (5, IR3), (6, IR2), (7, IR1), (8, IR1), (9, IR0), (10, IR0), (11, IR0),
        (12, IR_O),
    ]
    for x, c in row11:
        put(img, x, 11, c)

    # y=12: tapered lower oak staves (x=3..12, 10px)
    row12 = [
        (3, OK_O),
        (4, OK3), (5, OK2), (6, OK0),
        (7, OK2), (8, OK1), (9, DO1),
        (10, OK0), (11, DO1),
        (12, DO_O),
    ]
    for x, c in row12:
        put(img, x, 12, c)

    # y=13: shaded bottom stave ends curving into bottom chime (x=3..12; x=3,12 step in at y=14!)
    row13 = [
        (3, DO_O),
        (4, OK1), (5, OK1), (6, DO1),
        (7, OK0), (8, DO2), (9, DO0),
        (10, DO1), (11, DO0),
        (12, DO_O),
    ]
    for x, c in row13:
        put(img, x, 13, c)

    # y=14: curved bottom oak chime outline (x=4..11, 8px)
    hline(img, 4, 11, 14, DO_O)

    # Curved ground shadow (#4c557f @ 85)
    shadow_px(img, 3, 14)
    shadow_px(img, 12, 14)
    shadow_bar(img, 4, 11, 15)
    return img


# ---------------------------------------------------------------------------
# Strict Machine Validation (Palette + Alpha + 1px Dark Material Outline + Bounds)
# ---------------------------------------------------------------------------
def validate_sprite(
    name: str,
    img: Image.Image,
    expected_canvas: tuple[int, int],
    target_w: tuple[int, int],
    target_h: tuple[int, int],
    palette: set[str],
) -> dict:
    assert (img.width, img.height) == expected_canvas, (
        f"{name}: canvas {(img.width, img.height)} != {expected_canvas}"
    )

    off_palette = []
    bad_alpha = []
    bad_outline = []
    pure_black = 0
    opaque_xs = []
    opaque_ys = []
    used_colors = set()
    shadow_count = 0

    for y in range(img.height):
        for x in range(img.width):
            rgba = img.getpixel((x, y))
            r, g, b, a = rgba
            if a == 0:
                continue
            if a == 85:
                if rgba != SHADOW_RGBA:
                    bad_alpha.append((x, y, rgba))
                shadow_count += 1
                continue
            if a != 255:
                bad_alpha.append((x, y, rgba))
                continue

            hx = rgba_to_hex(rgba)
            if (r, g, b) == (0, 0, 0):
                pure_black += 1
            used_colors.add(hx)
            opaque_xs.append(x)
            opaque_ys.append(y)

            if hx not in palette:
                off_palette.append((x, y, hx))

            # Check 4-connected outer edge touching transparency or semi-transparent shadow
            touches_empty = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if nx < 0 or nx >= img.width or ny < 0 or ny >= img.height:
                    touches_empty = True
                    break
                if img.getpixel((nx, ny))[3] < 255:
                    touches_empty = True
                    break
            if touches_empty:
                if hx not in ALLOWED_DARK_OUTLINES or luma(r, g, b) > 68:
                    bad_outline.append((x, y, hx, round(luma(r, g, b), 1)))

    assert pure_black == 0, f"{name}: found {pure_black} pure #000000 pixels!"
    assert not off_palette, f"{name}: off-palette pixels: {off_palette[:5]}"
    assert not bad_alpha, f"{name}: invalid alpha/shadow pixels: {bad_alpha[:5]}"
    assert not bad_outline, f"{name}: non-dark outer outline pixels: {bad_outline[:10]}"

    min_x, max_x = min(opaque_xs), max(opaque_xs)
    min_y, max_y = min(opaque_ys), max(opaque_ys)
    op_w = max_x - min_x + 1
    op_h = max_y - min_y + 1
    bottom_margin = img.height - 1 - max_y
    left_margin = min_x
    right_margin = img.width - 1 - max_x
    center_err = abs(((min_x + max_x) / 2.0) - ((img.width - 1) / 2.0))

    assert target_w[0] <= op_w <= target_w[1], f"{name}: opaque width {op_w} outside {target_w}"
    assert target_h[0] <= op_h <= target_h[1], f"{name}: opaque height {op_h} outside {target_h}"
    assert 1 <= bottom_margin <= 2, f"{name}: bottom margin {bottom_margin} not in 1..2"
    assert center_err <= 1.0, f"{name}: center_err {center_err} > 1.0"

    return {
        "name": name,
        "canvas": f"{img.width}x{img.height}",
        "opaque_bbox": f"{op_w}x{op_h}",
        "margins_ltrb": (left_margin, min_y, right_margin, bottom_margin),
        "center_err": round(center_err, 2),
        "unique_colors": len(used_colors),
        "shadow_px": shadow_count,
    }


# ---------------------------------------------------------------------------
# Contact Sheet Builder (preview_batch4.png on #767670 next to Beodeul char)
# ---------------------------------------------------------------------------
def build_preview_sheet(sprites: list[tuple[str, str, Image.Image]], stats: list[dict]) -> None:
    BG = (0x76, 0x76, 0x70, 255)  # #767670 mandatory neutral review gray
    CARD_BORDER = (0x5E, 0x5E, 0x58, 255)
    HEADER_BG = (0x66, 0x66, 0x60, 255)
    DIVIDER = (0x64, 0x64, 0x5E, 255)
    TEXT_MAIN = (244, 244, 238, 255)
    TEXT_SUB = (212, 214, 204, 255)
    TEXT_DIM = (186, 188, 178, 255)

    # Native 1x Beodeul character (ref_beodeul_char_4x.png is 88x100 -> 22x25 @ 1x)
    raw_char = Image.open(CHAR_REF_PNG).convert("RGBA")
    char_1x = raw_char.resize((raw_char.width // 4, raw_char.height // 4), Image.Resampling.NEAREST)
    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.Resampling.NEAREST)

    sheet_w = 820
    sheet_h = 410
    sheet = Image.new("RGBA", (sheet_w, sheet_h), BG)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    # Header bar
    draw.rectangle([12, 12, sheet_w - 13, 88], fill=HEADER_BG, outline=CARD_BORDER)
    sheet.alpha_composite(char_2x, (26, 20))
    sheet.alpha_composite(char_1x, (26 + char_2x.width + 10, 20 + char_2x.height - char_1x.height))
    tx = 26 + char_2x.width + char_1x.width + 26
    draw.text(
        (tx, 20),
        "fantasy_wizard_library_carbon - Batch 4/4: 5 Seating & Storage (2x + 1x on #767670)",
        fill=TEXT_MAIN,
        font=font,
    )
    draw.text(
        (tx, 38),
        "Palette: 100% Locked Beodeul Library (70c, 0 off-pal, 0 #000) | Shadow: #4c557f@85 | 1px Dark Outlines: PASS",
        fill=TEXT_SUB,
        font=font,
    )
    draw.text(
        (tx, 56),
        "Each cell: [Old 2x] vs [New Carbon 2x + 1x + 22x25 Beodeul Scale Char] | Bottom-right: True 1x Lineup",
        fill=TEXT_DIM,
        font=font,
    )

    card_w, card_h = 258, 146
    positions = [
        (12, 100),
        (281, 100),
        (550, 100),
        (12, 256),
        (281, 256),
    ]

    for idx, ((name, cam, sp), st) in enumerate(zip(sprites, stats)):
        cx, cy = positions[idx]
        draw.rectangle([cx, cy, cx + card_w, cy + card_h], fill=BG, outline=CARD_BORDER)
        baseline_y = cy + 100
        draw.line([(cx + 8, baseline_y + 1), (cx + card_w - 8, baseline_y + 1)], fill=DIVIDER)

        # Load old neon-high sprite for direct visual comparison on left side of card
        old_path = OLD_OBJ_DIR / f"{name}.png"
        if old_path.exists():
            old_sp = Image.open(old_path).convert("RGBA")
            old_2x = old_sp.resize((old_sp.width * 2, old_sp.height * 2), Image.Resampling.NEAREST)
            ox = cx + 38 - old_2x.width // 2
            oy = baseline_y - old_2x.height
            sheet.alpha_composite(old_2x, (ox, oy))
            draw.text((cx + 18, cy + 8), "old 2x", fill=TEXT_DIM, font=font)
            draw.line([(cx + 76, cy + 10), (cx + 76, baseline_y)], fill=DIVIDER)

        # New upgraded Carbon 2x + 1x + native 1x Beodeul scale char
        sp_2x = sp.resize((sp.width * 2, sp.height * 2), Image.Resampling.NEAREST)
        nx2 = cx + 122 - sp_2x.width // 2
        ny2 = baseline_y - sp_2x.height
        sheet.alpha_composite(sp_2x, (nx2, ny2))
        draw.text((cx + 98, cy + 8), "NEW 2x", fill=TEXT_MAIN, font=font)

        nx1 = cx + 188 - sp.width // 2
        ny1 = baseline_y - sp.height
        sheet.alpha_composite(sp, (nx1, ny1))
        draw.text((cx + 178, cy + 8), "1x", fill=TEXT_SUB, font=font)

        # 1x Beodeul char right next to 1x sprite
        sheet.alpha_composite(char_1x, (cx + 218, baseline_y - char_1x.height + 1))

        draw.text((cx + 10, cy + 108), f"{idx + 1}. {name}", fill=TEXT_MAIN, font=font)
        draw.text(
            (cx + 10, cy + 124),
            f"[{cam}] {st['canvas']} | op {st['opaque_bbox']} | {st['unique_colors']} colors",
            fill=TEXT_SUB,
            font=font,
        )

    # 6th slot: True 1x Scale Room Lineup next to Beodeul char (uncluttered native 1x check!)
    lx, ly = (550, 256)
    draw.rectangle([lx, ly, lx + card_w, ly + card_h], fill=BG, outline=CARD_BORDER)
    base_1x = ly + 92
    draw.line([(lx + 10, base_1x + 1), (lx + card_w - 10, base_1x + 1)], fill=DIVIDER)
    cur_x = lx + 18
    sheet.alpha_composite(char_1x, (cur_x, base_1x - char_1x.height + 1))
    cur_x += char_1x.width + 12
    for _, _, sp in sprites:
        sheet.alpha_composite(sp, (cur_x, base_1x - sp.height))
        cur_x += sp.width + 12
    draw.text((lx + 10, ly + 10), "NATIVE 1x SCALE LINEUP", fill=TEXT_MAIN, font=font)
    draw.text((lx + 10, ly + 108), "Beodeul 22x25 Char + All 5 Sprites @ 1x", fill=TEXT_MAIN, font=font)
    draw.text((lx + 10, ly + 124), "100% Palette/Alpha/Outline Gate: PASS", fill=TEXT_SUB, font=font)

    PREVIEW_PNG.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW_PNG)


def main() -> None:
    palette = load_palette()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    specs = [
        ("oak_study_chair.png",      "chair",    draw_oak_study_chair(),      (16, 16), (11, 13), (13, 15)),
        ("wooden_stool.png",         "chair",    draw_wooden_stool(),         (16, 16), (11, 13), (11, 13)),
        ("treasure_chest_bound.png", "standing", draw_treasure_chest_bound(), (16, 16), (13, 15), (12, 14)),
        ("wooden_crates_stack.png",  "standing", draw_wooden_crates_stack(),  (32, 32), (26, 29), (26, 28)),
        ("oak_barrel_hooped.png",    "standing", draw_oak_barrel_hooped(),    (16, 16), (11, 13), (13, 15)),
    ]

    stats: list[dict] = []
    rendered: list[tuple[str, str, Image.Image]] = []
    print("=== BATCH 4/4 SEATING & STORAGE MACHINE CHECK ===")
    for fname, cam, img, canvas_wh, tw, th in specs:
        st = validate_sprite(fname, img, canvas_wh, tw, th, palette)
        out_path = OUT_DIR / fname
        img.save(out_path)
        stats.append(st)
        rendered.append((fname.replace(".png", ""), cam, img))
        print(
            f"  PASS {fname:26s} | canvas={st['canvas']:5s} | op={st['opaque_bbox']:5s} "
            f"| ltrb={st['margins_ltrb']} | ctr_err={st['center_err']} | colors={st['unique_colors']:2d} | shd={st['shadow_px']}"
        )

    build_preview_sheet(rendered, stats)
    print(f"Wrote preview sheet -> {PREVIEW_PNG}")
    print("ALL 5 SPRITES 100% PASS!")


if __name__ == "__main__":
    main()
