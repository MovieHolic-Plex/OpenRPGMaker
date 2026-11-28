#!/usr/bin/env python3
"""Build all 20 Beodeul Fantasy Wizard Library objects (code pixel art, Pillow).

Strict compliance with dots-prompt-kit.html Beodeul Spec:
- Exact 16px-multiple canvases, transparent background, bottom-aligned & horizontally centered
- Strict category camera rules:
  * standing : front face + narrow lit top band (1/4-1/3 height), ZERO side walls
  * topdown  : flat top surface >= 75% height, front edge <= 3px, stub legs 1-2px, EMPTY table surfaces
  * chair    : near top-down, backrest band at TOP edge, facing DOWN
  * slender  : thin upright post (2-4px wide with 1px dark outline) + top head + small base
- 1px dark material outline on outer edges (never pure #000000)
- Locked Beodeul palette + optional ground shadow #4c557f @ alpha 85/255
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Callable

from palette import (
    OUT_DIR,
    PixelCanvas,
    ST_O, ST0, ST1, ST2, ST3, ST4, ST5, ST6,
    SL_O, SL0, SL1, SL2, SL3, SL4,
    DO_O, DO0, DO1, DO2, DO3, DO4,
    OK_O, OK0, OK1, OK2, OK3, OK4, OK5,
    IR_O, IR0, IR1, IR2, IR3,
    GD_O, GD0, GD1, GD2, GD3, GD4,
    PA_O, PA0, PA1, PA2, PA3,
    RD_O, RD0, RD1, RD2, RD3,
    FL0, FL1, FL2, FL3, FL4,
    TL_O, TL0, TL1, TL2, TL3, TL4,
    BL_O, BL0, BL1, BL2,
    GR_O, GR0, GR1, GR2, GR3,
    PL0, PL1,
)

OBJECTS_DIR = OUT_DIR / "objects"


# ---------------------------------------------------------------------------
# 1. bookshelf_tall_full (32x32, standing)
# ---------------------------------------------------------------------------
def obj_bookshelf_tall_full() -> PixelCanvas:
    c = PixelCanvas(32, 32)
    # Outer dark oak silhouette x=2..29, y=1..30
    c.rect(2, 1, 29, 30, DO_O)
    # Narrow lit top cornice band (y=2..6, 5px = ~1/5 of height)
    c.rect(3, 2, 28, 5, DO3)
    c.hline(3, 28, 2, DO4)  # top-left highlight bevel
    c.vline(3, 2, 5, DO4)
    c.hline(3, 28, 5, DO2)
    c.hline(3, 28, 6, DO1)  # front cornice lip
    c.hline(3, 28, 7, DO0)  # under-lip shadow
    # Outer frame stiles & center divider
    c.rect(3, 7, 4, 29, DO2)
    c.vline(3, 7, 29, DO3)
    c.rect(27, 7, 28, 29, DO1)
    c.vline(28, 7, 29, DO0)
    c.rect(15, 7, 16, 28, DO2)
    c.vline(16, 7, 28, DO1)
    # Recessed dark shelf cavities
    bays = [(8, 13), (16, 21), (24, 28)]
    for y0, y1 in bays:
        c.rect(5, y0, 14, y1, DO0)
        c.rect(17, y0, 26, y1, DO0)
    # Shelf planks
    for sy in (14, 22):
        c.hline(4, 27, sy, DO3)
        c.hline(4, 27, sy + 1, DO1)
    # Molded plinth base
    c.hline(3, 28, 29, DO2)
    c.hline(3, 28, 28, DO3)
    c.hline(2, 29, 30, DO_O)

    # Packed, high-contrast colorful Beodeul book spines (each 2px wide + 1px dark gap or contrast step)
    def draw_books(x_start: int, y_bot: int, specs: list[tuple[int, int, str, str, str | None]]) -> None:
        x = x_start
        for w, h, body, hi, band in specs:
            if w == 0:
                x += 1
                continue
            y_top = y_bot - h + 1
            c.rect(x, y_top, x + w - 1, y_bot, body)
            c.hline(x, x + w - 1, y_top, hi)
            if w >= 2:
                c.vline(x, y_top, y_bot, hi)
            if band and h >= 5:
                c.hline(x, x + w - 1, y_top + 2, band)
            x += w

    # Top-left bay (x=5..14, y_bot=13)
    draw_books(5, 13, [
        (2, 5, RD1, RD3, GD2),
        (2, 6, BL0, BL2, None),
        (0, 0, "", "", None),
        (2, 5, GR0, GR2, GD2),
        (3, 6, GD1, GD3, RD2),
    ])
    # Top-right bay (x=17..26, y_bot=13)
    draw_books(17, 13, [
        (2, 6, TL1, TL3, GD2),
        (2, 5, PL0, PL1, None),
        (2, 6, RD1, RD2, GD2),
        (0, 0, "", "", None),
        (2, 5, PA1, PA3, None),
    ])
    # Mid-left bay (x=5..14, y_bot=21)
    draw_books(5, 21, [
        (2, 6, GD1, GD3, None),
        (2, 5, TL0, TL2, GD2),
        (2, 6, RD0, RD2, None),
        (2, 5, BL0, BL1, GD2),
        (2, 4, PA1, PA2, None),
    ])
    # Mid-right bay (x=17..26, y_bot=21)
    draw_books(17, 21, [
        (3, 5, BL0, BL2, GD3),
        (0, 0, "", "", None),
        (2, 6, GR0, GR2, None),
        (2, 5, RD1, RD3, GD2),
        (2, 6, TL1, TL2, None),
    ])
    # Bottom-left bay (x=5..14, y_bot=27) — large heavy folios
    draw_books(5, 27, [
        (3, 4, RD0, RD2, GD2),
        (2, 4, PA1, PA3, None),
        (0, 0, "", "", None),
        (2, 4, BL0, BL2, GD2),
        (2, 4, GR0, GR1, None),
    ])
    # Bottom-right bay (x=17..26, y_bot=27) — stacked horizontal tomes + upright books
    c.rect(17, 26, 22, 27, BL0); c.hline(17, 22, 26, BL2); c.set(19, 26, GD3)
    c.rect(18, 24, 22, 25, RD1); c.hline(18, 22, 24, RD3); c.set(20, 24, GD2)
    draw_books(23, 27, [
        (2, 4, TL1, TL3, None),
        (2, 4, GD1, GD3, None),
    ])

    c.add_shadow_bar(3, 28, 31)
    return c


# ---------------------------------------------------------------------------
# 2. bookshelf_scroll_rack (16x32, standing)
# ---------------------------------------------------------------------------
def obj_bookshelf_scroll_rack() -> PixelCanvas:
    c = PixelCanvas(16, 32)
    # Outer silhouette x=1..14, y=1..30
    c.rect(1, 1, 14, 30, DO_O)
    # Narrow lit oak top cornice band (y=2..6)
    c.rect(2, 2, 13, 5, OK3)
    c.hline(2, 13, 2, OK4)
    c.vline(2, 2, 5, OK4)
    c.hline(2, 13, 5, OK2)
    c.hline(2, 13, 6, DO1)
    # Frame sides & center vertical divider
    c.vline(2, 7, 29, DO3)
    c.vline(13, 7, 29, DO1)
    c.rect(3, 7, 12, 28, DO0)
    c.vline(7, 7, 28, DO2)
    c.vline(8, 7, 28, DO1)
    # Horizontal cubby shelves
    for sy in (14, 21, 28):
        c.hline(2, 13, sy, DO3)
        if sy < 28:
            c.hline(2, 13, sy + 1, DO1)
    c.hline(2, 13, 29, DO2)

    # Rolled parchment scrolls inside the 6 pigeonhole cubbies!
    def draw_scroll_cluster(x0: int, y0: int, ribbon: bool) -> None:
        # 2x2 or 3-roll bundle of pale cream scroll ends with dark spiral dots
        # Top roll
        c.rect(x0 + 1, y0 + 1, x0 + 2, y0 + 2, PA3)
        c.set(x0 + 2, y0 + 2, PA0)
        # Bottom-left roll
        c.rect(x0, y0 + 3, x0 + 1, y0 + 4, PA2)
        c.set(x0, y0 + 3, PA3)
        c.set(x0 + 1, y0 + 4, PA0)
        # Bottom-right roll
        c.rect(x0 + 2, y0 + 3, x0 + 3, y0 + 4, PA2)
        c.set(x0 + 2, y0 + 3, PA3)
        c.set(x0 + 3, y0 + 4, PA1)
        if ribbon:
            c.set(x0 + 1, y0 + 2, RD2)
            c.set(x0 + 2, y0 + 3, RD2)

    # 3 tiers x 2 cubbies (left x=3..6, right x=9..12)
    draw_scroll_cluster(3, 8, True)
    draw_scroll_cluster(9, 8, False)
    draw_scroll_cluster(3, 15, False)
    draw_scroll_cluster(9, 15, True)
    draw_scroll_cluster(3, 22, True)
    # Bottom-right cubby: taller upright scroll tube + wax seal
    c.rect(9, 23, 10, 27, PA2); c.vline(9, 23, 27, PA3); c.set(10, 25, RD2)
    c.rect(11, 24, 12, 27, PA1); c.vline(11, 24, 27, PA2); c.set(11, 26, TL2)

    c.add_shadow_bar(2, 13, 31)
    return c


# ---------------------------------------------------------------------------
# 3. grimoire_cabinet (32x32, standing)
# ---------------------------------------------------------------------------
def obj_grimoire_cabinet() -> PixelCanvas:
    c = PixelCanvas(32, 32)
    # Outer silhouette x=2..29, y=2..30 (with carved feet at bottom)
    c.rect(2, 2, 29, 29, DO_O)
    # Stepped stub feet at y=30
    c.rect(3, 29, 6, 30, DO_O); c.rect(4, 29, 5, 29, DO2)
    c.rect(25, 29, 28, 30, DO_O); c.rect(26, 29, 27, 29, DO1)
    # Lit top band (y=3..7)
    c.rect(3, 3, 28, 6, DO3)
    c.hline(3, 28, 3, DO4)
    c.vline(3, 3, 6, DO4)
    c.hline(3, 28, 6, DO2)
    c.hline(3, 28, 7, DO1)
    # Cabinet body frame
    c.rect(3, 8, 28, 28, DO1)
    c.vline(3, 8, 28, DO3)
    c.vline(4, 8, 28, DO2)
    c.vline(27, 8, 28, DO1)
    c.vline(28, 8, 28, DO0)
    # Upper glazed double doors (y=9..21)
    for dx0, dx1 in ((5, 14), (17, 26)):
        c.rect(dx0, 9, dx1, 21, DO2)
        c.rect(dx0 + 1, 10, dx1 - 1, 20, BL0)  # dark glass interior
        # Glowing rare grimoires visible behind glass
        c.rect(dx0 + 2, 11, dx0 + 3, 14, RD2); c.set(dx0 + 2, 11, RD3)
        c.rect(dx0 + 5, 11, dx0 + 6, 14, GD2); c.set(dx0 + 5, 11, GD3)
        c.rect(dx0 + 2, 16, dx0 + 4, 19, TL1); c.set(dx0 + 3, 17, TL3)
        c.rect(dx0 + 6, 16, dx0 + 7, 19, PL1); c.set(dx0 + 6, 16, PA2)
        # Inner shelf divider behind glass
        c.hline(dx0 + 1, dx1 - 1, 15, DO1)
        # Diagonal leaded glass reflection
        c.set(dx0 + 2, 11, TL3)
        c.set(dx0 + 3, 12, TL4)
        c.set(dx0 + 4, 13, TL3)
        c.set(dx0 + 7, 18, TL3)
    # Center door stile + gleaming brass lockplate
    c.rect(15, 8, 16, 21, DO0)
    c.rect(14, 14, 17, 17, GD1)
    c.rect(15, 14, 16, 16, GD3)
    c.set(15, 15, DO_O)  # keyhole
    # Brass door hinges
    for hy in (10, 19):
        c.hline(4, 5, hy, GD2); c.set(4, hy, GD3)
        c.hline(26, 27, hy, GD2); c.set(26, hy, GD3)
    # Mid divider rail
    c.hline(3, 28, 22, DO3)
    c.hline(3, 28, 23, DO0)
    # Two lower drawers (y=24..27) with brass handles
    for dx0, dx1 in ((5, 14), (17, 26)):
        c.rect(dx0, 24, dx1, 27, DO2)
        c.hline(dx0, dx1, 24, DO3)
        c.hline(dx0, dx1, 27, DO0)
        mx = (dx0 + dx1) // 2
        c.hline(mx - 1, mx + 1, 25, GD2)
        c.set(mx, 25, GD3)
    c.hline(3, 28, 28, DO0)
    c.add_shadow_bar(4, 27, 31)
    return c


# ---------------------------------------------------------------------------
# 4. reading_table_long (48x16, topdown)
# ---------------------------------------------------------------------------
def obj_reading_table_long() -> PixelCanvas:
    c = PixelCanvas(48, 16)
    # Strictly top-down (flat tabletop >= 75% of height, front edge <= 3px, stub legs 1-2px, EMPTY surface)
    # Outer tabletop bounds: x=1..46, y=1..12
    c.rect(1, 1, 46, 12, OK_O)
    # Flat polished oak top surface y=2..10 (9px inside + 1px top border = 10-11px of 14px!)
    c.rect(2, 2, 45, 10, OK3)
    # Top-left bright bevel frame (like ref_ezt_table_long_h.png & ref_base_tables_row_4x.png)
    c.hline(2, 45, 2, OK5)
    c.vline(2, 2, 10, OK4)
    c.hline(3, 44, 3, OK4)
    c.hline(2, 45, 10, OK2)
    c.vline(45, 2, 10, OK2)
    # Subtle calm horizontal wood plank seams (clean, EMPTY surface!)
    c.hline(3, 44, 5, OK2)
    c.hline(3, 44, 8, OK2)
    c.hline(5, 18, 4, OK4)
    c.hline(24, 38, 7, OK4)
    # Front apron edge (2px: y=11..12)
    c.hline(2, 45, 11, OK1)
    c.hline(2, 45, 12, OK_O)
    # Short 2px corner stub legs (y=13..14)
    for lx0, lx1 in ((3, 6), (41, 44)):
        c.rect(lx0, 12, lx1, 14, OK_O)
        c.rect(lx0 + 1, 12, lx1 - 1, 13, OK1)
        c.set(lx0 + 1, 12, OK2)
    # Subtle shadow bar between legs
    c.add_shadow_bar(4, 43, 15)
    return c


# ---------------------------------------------------------------------------
# 5. study_table_round (32x32, topdown)
# ---------------------------------------------------------------------------
def obj_study_table_round() -> PixelCanvas:
    c = PixelCanvas(32, 32)
    # Strictly top-down round oak table (like ref_ezt_table_round.png), EMPTY surface!
    # Center pedestal stub peeking at bottom (y=24..29)
    c.rect(12, 24, 19, 29, DO_O)
    c.rect(13, 24, 18, 28, OK0)
    c.vline(13, 24, 28, OK2)
    c.vline(14, 24, 28, OK1)
    c.hline(12, 19, 29, DO_O)
    # Short splayed feet hints
    c.rect(10, 27, 12, 29, DO_O); c.set(11, 28, OK1)
    c.rect(19, 27, 21, 29, DO_O); c.set(20, 28, OK0)

    # Outer underside rim (2-3px front edge below round tabletop)
    cx, cy = 15.5, 13.5
    c.ellipse(cx, cy + 2.2, 13.4, 10.6, OK_O)
    c.ellipse(cx, cy + 1.5, 12.6, 10.0, OK0)
    c.ellipse(cx, cy + 0.8, 12.4, 9.8, OK1)
    # Main circular tabletop (fills y=3..23 = 21px of 27px = 78%!)
    c.ellipse(cx, cy, 13.2, 10.4, OK_O)
    c.ellipse(cx, cy, 12.2, 9.4, OK2)
    c.ellipse(cx - 0.3, cy - 0.3, 11.4, 8.6, OK3)
    # Top-left bright bevel arc
    for y in range(4, 16):
        for x in range(4, 25):
            dx = (x - cx) / 11.4
            dy = (y - cy) / 8.6
            d = dx * dx + dy * dy
            if 0.72 <= d <= 0.98 and (x < 18 or y < 10):
                c.set(x, y, OK4)
            if 0.78 <= d <= 0.96 and x < 15 and y < 9:
                c.set(x, y, OK5)
    # Clean horizontal oak plank seams across tabletop (EMPTY surface)
    for py in (10, 14, 18):
        for x in range(5, 27):
            dx = (x - cx) / 11.0
            dy = (py - cy) / 8.2
            if dx * dx + dy * dy <= 0.90:
                c.set(x, py, OK2)
    c.add_shadow_ellipse(15.5, 29.5, 8.5, 2.0)
    return c


# ---------------------------------------------------------------------------
# 6. alchemy_workbench (32x16, topdown)
# ---------------------------------------------------------------------------
def obj_alchemy_workbench() -> PixelCanvas:
    c = PixelCanvas(32, 16)
    # Strictly top-down stone-slab alchemy workbench (EMPTY surface, >=75% flat top)
    c.rect(1, 1, 30, 12, DO_O)
    # Heavy dark oak outer top rim
    c.rect(2, 2, 29, 10, DO2)
    c.hline(2, 29, 2, DO4)
    c.vline(2, 2, 10, DO3)
    # Inset cool slate-stone slab tabletop (x=4..27, y=3..9)
    c.rect(4, 3, 27, 9, ST3)
    c.hline(4, 27, 3, ST5)
    c.vline(4, 3, 9, ST4)
    c.hline(4, 27, 9, ST2)
    c.vline(27, 3, 9, ST2)
    # Subtle center stone slab joint
    c.vline(15, 3, 9, ST2)
    c.vline(16, 4, 8, ST4)
    # Iron corner cap brackets on the oak rim
    for bx, by in ((2, 2), (28, 2), (2, 9), (28, 9)):
        c.rect(bx, by, bx + 1, by + 1, IR1)
        c.set(bx, by, IR3)
    # 2px front oak apron (y=11..12)
    c.hline(2, 29, 11, DO1)
    c.hline(2, 29, 12, DO_O)
    # 2px stub legs (y=13..14)
    for lx0, lx1 in ((2, 4), (27, 29)):
        c.rect(lx0, 12, lx1, 14, DO_O)
        c.rect(lx0 + 1, 12, lx1 - 1, 13, DO2)
    c.add_shadow_bar(3, 28, 15)
    return c


# ---------------------------------------------------------------------------
# 7. oak_study_chair (16x16, chair)
# ---------------------------------------------------------------------------
def obj_oak_study_chair() -> PixelCanvas:
    c = PixelCanvas(16, 16)
    # Strictly chair (near top-down facing DOWN like ref_ezt_chair_front_a.png)
    # Backrest band at TOP edge (y=1..5)
    c.rect(2, 1, 13, 12, DO_O)
    # Carved top rail with small corner posts
    c.hline(3, 12, 2, OK4)
    c.set(3, 2, OK5); c.set(12, 2, OK3)
    # Backrest vertical slats over dark shadow
    c.rect(3, 3, 12, 5, DO0)
    for sx in (3, 6, 9, 12):
        c.vline(sx, 3, 5, OK3 if sx <= 6 else OK2)
    # Flat seat seen from above (y=6..11)
    c.rect(3, 6, 12, 11, OK2)
    c.hline(3, 12, 6, OK4)
    c.vline(3, 6, 11, OK3)
    # Inset deep crimson library seat cushion (x=5..10, y=7..10)
    c.rect(5, 7, 10, 10, RD1)
    c.hline(5, 10, 7, RD3)
    c.rect(6, 8, 9, 9, RD2)
    # Front seat rim (y=11..12)
    c.hline(3, 12, 11, OK1)
    c.hline(2, 13, 12, DO_O)
    # Front chair legs (y=13..14)
    c.rect(2, 12, 4, 14, DO_O); c.vline(3, 12, 13, OK2)
    c.rect(11, 12, 13, 14, DO_O); c.vline(12, 12, 13, OK1)
    c.add_shadow_bar(3, 12, 15)
    return c


# ---------------------------------------------------------------------------
# 8. wooden_stool (16x16, chair)
# ---------------------------------------------------------------------------
def obj_wooden_stool() -> PixelCanvas:
    c = PixelCanvas(16, 16)
    # Near top-down round wooden stool (like ref_ez_row_4x.png), 12x12 confident silhouette
    # Splayed wooden legs underneath (y=10..14)
    c.rect(3, 10, 5, 14, DO_O); c.vline(4, 11, 13, OK2)
    c.rect(10, 10, 12, 14, DO_O); c.vline(11, 11, 13, OK1)
    c.rect(6, 11, 9, 13, DO_O); c.hline(6, 9, 12, OK0)  # wooden stretcher crossbar
    # Round oak seat underside rim
    c.ellipse(7.5, 7.8, 6.0, 4.0, OK_O)
    c.ellipse(7.5, 7.2, 5.1, 3.3, OK1)
    # Round oak seat top seen from above (y=3..10)
    c.ellipse(7.5, 6.5, 6.0, 4.0, OK_O)
    c.ellipse(7.5, 6.5, 5.0, 3.1, OK3)
    c.ellipse(6.8, 5.9, 3.8, 2.2, OK4)
    c.set(5, 5, OK5); c.set(6, 5, OK5)
    c.add_shadow_bar(3, 12, 15)
    return c


# ---------------------------------------------------------------------------
# 9. stone_fireplace_lit (32x32, standing)
# ---------------------------------------------------------------------------
def obj_stone_fireplace_lit() -> PixelCanvas:
    c = PixelCanvas(32, 32)
    # Outer cool grey stone fireplace x=2..29, y=1..30 (bottom-aligned)
    c.rect(2, 1, 29, 30, ST_O)
    # Top stone mantle shelf band (y=2..6, narrow 3/4 top band!)
    c.rect(3, 2, 28, 5, ST4)
    c.hline(3, 28, 2, ST5)
    c.hline(3, 16, 2, ST6)  # subtle top-left sheen instead of bright full-width white strip
    c.vline(3, 2, 5, ST5)
    c.hline(3, 28, 5, ST3)
    c.hline(3, 28, 6, ST1)
    # Mantle overhang shadow
    c.hline(3, 28, 7, ST0)
    # Dressed grey stone chimney surround (y=8..26)
    c.rect(3, 8, 28, 26, ST3)
    # Ashlar masonry courses on left (x=3..8) & right (x=23..28) piers
    for py in (8, 13, 18, 23):
        c.hline(3, 28, py, ST4)
        c.hline(3, 28, py + 4, ST1)
    for lx in (3, 4):
        c.vline(lx, 8, 26, ST5 if lx == 3 else ST4)
    c.vline(28, 8, 26, ST1)
    c.vline(27, 8, 26, ST2)
    # Masonry block vertical joints
    c.vline(6, 8, 12, ST1); c.vline(5, 13, 17, ST1); c.vline(7, 18, 22, ST1)
    c.vline(25, 8, 12, ST1); c.vline(26, 13, 17, ST1); c.vline(24, 18, 22, ST1)

    # Semicircular arched firebox opening (x=9..22, y=11..26)
    arch = {11: (13, 18), 12: (11, 20), 13: (10, 21)}
    for y in range(11, 27):
        x0, x1 = arch.get(y, (9, 22))
        c.hline(x0 - 1, x1 + 1, y, ST5 if y <= 13 else ST1)
        c.hline(x0, x1, y, SL_O)
    # Keystone at arch top (y=9..11, x=15..16)
    c.rect(14, 9, 17, 11, ST5)
    c.vline(14, 9, 11, ST6)
    c.vline(17, 9, 11, ST2)

    # Inside firebox: dark charcoal/brick back + iron grate + logs + roaring hearth fire!
    c.rect(10, 24, 21, 26, DO0)  # charred logs
    c.hline(11, 20, 25, DO2)
    c.hline(10, 21, 26, IR0)  # iron grate bar
    for gx in (12, 15, 18, 20):
        c.vline(gx, 24, 26, IR1)
    # Layered hearth flames (FL0 -> FL1 -> FL2 -> FL3 -> FL4 core)
    flame_rows = [
        (24, 11, 20, FL0),
        (23, 11, 20, FL1),
        (22, 12, 19, FL1),
        (21, 12, 19, FL2),
        (20, 13, 18, FL2),
        (19, 13, 18, FL2),
        (18, 14, 17, FL1),
        (17, 14, 17, FL2),
        (16, 15, 16, FL1),
        (15, 15, 15, FL2),
    ]
    for fy, fx0, fx1, col in flame_rows:
        c.hline(fx0, fx1, fy, col)
    # Bright yellow & white-hot flame tongues
    c.rect(13, 20, 18, 23, FL3)
    c.rect(14, 18, 17, 22, FL3)
    c.rect(15, 20, 16, 23, FL4)
    c.set(16, 17, FL3); c.set(13, 18, FL1); c.set(19, 19, FL1)

    # Solid beveled stone hearth apron across bottom (y=27..30)
    c.rect(2, 27, 29, 30, ST_O)
    c.rect(3, 27, 28, 29, ST3)
    c.hline(3, 28, 27, ST5)
    c.hline(3, 28, 29, ST1)
    # Subtle warm ember reflection on hearth floor stone directly in front of fire
    c.hline(12, 19, 28, FL1)
    c.hline(14, 17, 28, FL2)
    c.add_shadow_bar(3, 28, 31)
    return c


# ---------------------------------------------------------------------------
# 10. brass_orrery_stand (32x32, standing)
# ---------------------------------------------------------------------------
def obj_brass_orrery_stand() -> PixelCanvas:
    c = PixelCanvas(32, 32)
    # Grand wizard-tower centerpiece: wider 24x30 silhouette with dark bronze outline on ALL edges!
    # Stepped carved stone plinth base (x=5..26, y=27..30 -> 22px wide)
    c.rect(5, 27, 26, 30, ST_O)
    c.rect(6, 28, 25, 29, ST3)
    c.hline(6, 25, 28, ST5)
    c.hline(6, 25, 29, ST1)
    # Paneled dark oak pedestal shaft (x=8..23, y=21..27)
    c.rect(8, 21, 23, 27, DO_O)
    c.rect(9, 22, 22, 26, DO2)
    c.vline(9, 22, 26, DO3)
    c.vline(22, 22, 26, DO1)
    c.rect(11, 23, 20, 25, DO1)  # recessed front panel
    c.hline(11, 20, 23, GD2)     # brass trim bar
    c.set(15, 24, GD3); c.set(16, 24, GD2)  # center brass emblem
    # Narrow lit pedestal top table ledge (x=6..25, y=18..21)
    c.rect(6, 18, 25, 21, DO_O)
    c.rect(7, 19, 24, 20, ST4)
    c.hline(7, 24, 19, ST5)
    c.hline(7, 24, 20, GD2)
    # Brass cradle stem & flared horizon supports connecting pedestal to armillary sphere
    c.rect(14, 16, 17, 19, GD_O)
    c.rect(15, 16, 16, 18, GD2)
    c.set(15, 17, GD3)

    # Gleaming wide brass armillary / orrery sphere (cx=15.5, cy=9.5, outer rx=10.8, ry=8.5)
    # Filled with deep celestial indigo star-backdrop inside the rings so inner ring edges stay dark & crisp!
    cx, cy = 15.5, 9.5
    c.ellipse(cx, cy, 11.4, 8.8, GD_O)   # crisp outer dark bronze rim (24px wide x=4..27!)
    c.ellipse(cx, cy, 10.2, 7.6, GD2)    # gleaming outer meridian brass ring
    # Top-left bright specular arc on outer brass meridian ring
    for y in range(2, 16):
        for x in range(5, 24):
            d = math.hypot((x - cx) / 10.2, (y - cy) / 7.6)
            if 0.78 <= d <= 1.0 and (x < 17 or y < 8):
                c.set(x, y, GD3)
            if 0.80 <= d <= 0.96 and x < 13 and y < 7:
                c.set(x, y, GD4)
    # Inner dark bronze ring bezel + deep celestial midnight interior (gives tremendous 1x contrast!)
    c.ellipse(cx, cy, 8.6, 6.2, GD_O)
    c.ellipse(cx, cy, 7.6, 5.3, BL_O)
    c.ellipse(cx, cy, 6.8, 4.6, BL0)
    # Tiny subtle star glints in midnight dome
    c.set(10, 7, BL2); c.set(21, 7, BL2); c.set(11, 12, BL2); c.set(20, 12, BL2)

    # Horizontal brass horizon band extending cleanly across sphere equator (x=4..27, y=9..10)
    c.rect(4, 8, 27, 11, GD_O)
    c.hline(5, 26, 9, GD3)
    c.hline(5, 26, 10, GD1)

    # Sweeping diagonal ecliptic brass arc crossing the celestial sphere
    for t in range(-8, 9):
        rx = int(round(cx + t * 0.98))
        ry = int(round(cy - t * 0.50))
        c.set(rx, ry - 1, GD_O)
        c.set(rx, ry + 1, GD_O)
        c.set(rx, ry, GD3 if t <= 0 else GD2)

    # Vertical meridian axis rod + top spire finial (y=1..17)
    c.vline(15, 2, 16, GD2)
    c.vline(16, 2, 16, GD0)
    c.rect(14, 0, 17, 2, GD_O)
    c.set(15, 1, GD3); c.set(16, 1, GD2)

    # Central radiant golden sun orb (x=14..17, y=8..11)
    c.rect(13, 7, 18, 12, GD_O)
    c.rect(14, 8, 17, 11, FL2)
    c.rect(14, 8, 16, 10, FL3)
    c.set(14, 8, GD4); c.set(15, 8, GD4)

    # Two distinct orbital planets (cyan moon UL, crimson-gold planet LR)
    c.rect(8, 5, 11, 8, TL_O); c.rect(9, 6, 10, 7, TL2); c.set(9, 6, TL4)
    c.rect(20, 10, 23, 13, RD_O); c.rect(21, 11, 22, 12, RD2); c.set(21, 11, GD3)

    c.add_shadow_bar(6, 25, 31)
    return c


# ---------------------------------------------------------------------------
# 11. alchemy_cauldron_hearth (32x32, standing)
# ---------------------------------------------------------------------------
def obj_alchemy_cauldron_hearth() -> PixelCanvas:
    c = PixelCanvas(32, 32)
    # Stone hearth ring & glowing orange coals underneath (y=23..30)
    c.ellipse(15.5, 27.0, 11.5, 3.2, ST_O)
    c.ellipse(15.5, 26.8, 10.4, 2.4, ST2)
    c.ellipse(15.5, 26.2, 9.2, 1.8, ST4)
    # Glowing ember bed inside hearth ring
    c.ellipse(15.5, 26.0, 6.8, 1.8, FL0)
    c.ellipse(15.5, 25.8, 5.2, 1.3, FL1)
    c.hline(12, 19, 25, FL2)
    c.hline(14, 17, 25, FL3)
    c.set(15, 24, FL3); c.set(13, 24, FL2); c.set(18, 24, FL2)

    # Sturdy iron tripod legs standing over hearth
    c.rect(7, 22, 9, 29, IR_O); c.vline(8, 22, 28, IR1)
    c.rect(22, 22, 24, 29, IR_O); c.vline(23, 22, 28, IR0)
    c.rect(14, 24, 17, 29, IR_O); c.vline(15, 24, 28, IR1)

    # Solidly outlined iron side handles (no bright inner edges exposed to transparency)
    c.rect(3, 13, 6, 17, IR_O); c.vline(4, 14, 16, IR1); c.set(4, 14, IR2)
    c.rect(25, 13, 28, 17, IR_O); c.vline(27, 14, 16, IR0)

    # Round bulging cast-iron cauldron body (curved left-to-right shading!)
    cx, cy = 15.5, 18.0
    c.ellipse(cx, cy, 11.2, 7.6, IR_O)
    c.ellipse(cx, cy, 10.1, 6.6, IR0)
    # Curved shading bands across belly
    for y in range(12, 25):
        for x in range(6, 25):
            dx = (x - cx) / 10.0
            dy = (y - cy) / 6.5
            if dx * dx + dy * dy <= 0.96:
                if dx < -0.25:
                    c.set(x, y, IR2)
                elif dx < 0.25:
                    c.set(x, y, IR1)
                else:
                    c.set(x, y, IR0)
    # Crisp curved specular metal highlight on upper-left belly
    for hx, hy in ((8, 16), (8, 17), (8, 18), (9, 15), (9, 16), (9, 17), (10, 16)):
        c.set(hx, hy, IR3)
    # Subtle warm fire bounce on underside of cauldron
    c.hline(12, 19, 23, FL0)

    # Wide 3/4 elliptical open cauldron rim (top band!)
    c.ellipse(cx, 11.5, 10.4, 3.6, IR_O)
    c.ellipse(cx, 11.5, 9.4, 2.8, IR2)
    c.ellipse(cx, 11.2, 9.0, 2.5, IR3)
    # Bubbling glowing emerald-teal alchemy brew inside rim!
    c.ellipse(cx, 11.4, 8.0, 2.2, GR0)
    c.ellipse(cx - 0.5, 11.2, 6.8, 1.7, GR1)
    c.ellipse(cx - 1.0, 11.0, 5.0, 1.2, GR2)
    # Bright brew bubbles & rising magical vapor beads (outlined in dark teal/moss!)
    c.rect(11, 10, 13, 11, GR3); c.set(12, 10, TL4)
    c.rect(17, 10, 19, 11, TL3); c.set(18, 10, TL4)
    # Floating alchemy bubble 1 (upper left)
    c.rect(11, 5, 14, 8, GR_O)
    c.rect(12, 6, 13, 7, GR2)
    c.set(12, 6, GR3)
    # Floating alchemy bubble 2 (upper right)
    c.rect(18, 3, 21, 6, TL_O)
    c.rect(19, 4, 20, 5, TL2)
    c.set(19, 4, TL4)

    c.enforce_dark_outline()
    c.add_shadow_bar(6, 25, 31)
    return c


# ---------------------------------------------------------------------------
# 12. potion_alembic_shelf (32x32, standing)
# ---------------------------------------------------------------------------
def obj_potion_alembic_shelf() -> PixelCanvas:
    c = PixelCanvas(32, 32)
    # Outer dark oak alchemist rack x=2..29, y=2..30
    c.rect(2, 2, 29, 30, DO_O)
    # Narrow lit oak top cornice band (y=3..6)
    c.rect(3, 3, 28, 5, OK3)
    c.hline(3, 28, 3, OK4)
    c.vline(3, 3, 5, OK4)
    c.hline(3, 28, 6, DO1)
    # Side stiles & deep dark recessed bays (high contrast for glowing potions!)
    c.rect(3, 7, 4, 29, DO2); c.vline(3, 7, 29, DO3)
    c.rect(27, 7, 28, 29, DO1); c.vline(28, 7, 29, DO0)
    c.rect(5, 7, 26, 27, DO0)
    # Center shelf plank (y=17..18) & bottom deck (y=28..29)
    c.hline(4, 27, 17, OK3)
    c.hline(4, 27, 18, DO1)
    c.hline(4, 27, 28, OK2)
    c.hline(4, 27, 29, DO1)

    # --- UPPER BAY (y=8..16): Brass-and-teal glass alembic still + emerald & indigo bottles ---
    # 1) Alembic still (x=6..15, y=9..16): round glowing teal retort + curved brass tube + receiving flask
    c.rect(6, 11, 11, 16, TL_O)
    c.rect(7, 12, 10, 15, TL2)
    c.rect(7, 12, 8, 14, TL3)
    c.set(7, 12, TL4)  # bright glass glint
    # Brass dome & arching condenser tube
    c.rect(8, 9, 10, 11, GD2); c.set(8, 9, GD3)
    c.hline(10, 13, 9, GD3)
    c.vline(13, 10, 12, GD2)
    # Small receiving vial (x=12..15, y=13..16)
    c.rect(12, 13, 15, 16, TL_O)
    c.rect(13, 14, 14, 15, TL3)
    c.set(13, 14, TL4)
    # 2) Tall emerald herb bottle (x=17..20, y=9..16)
    c.rect(17, 11, 20, 16, GR_O)
    c.rect(18, 12, 19, 15, GR2)
    c.set(18, 12, GR3)
    c.rect(18, 9, 19, 11, PA2); c.set(18, 9, OK3)  # neck & cork
    # 3) Royal arcane blue flask (x=22..25, y=10..16)
    c.rect(22, 12, 25, 16, BL_O)
    c.rect(23, 13, 24, 15, BL1)
    c.set(23, 13, TL4)
    c.rect(23, 10, 24, 11, PA1); c.set(23, 10, OK3)

    # --- LOWER BAY (y=19..27): Ruby health flask, amber jar, teal vials, stone mortar ---
    # 1) Round ruby red potion bottle (x=6..10, y=21..27)
    c.rect(6, 22, 10, 27, RD_O)
    c.rect(7, 23, 9, 26, RD2)
    c.set(7, 23, RD3); c.set(7, 24, PA3)
    c.rect(7, 20, 9, 21, OK3)
    # 2) Glowing amber elixir bottle (x=12..15, y=21..27)
    c.rect(12, 22, 15, 27, GD_O)
    c.rect(13, 23, 14, 26, FL2)
    c.set(13, 23, FL4)
    c.rect(13, 20, 14, 21, OK2)
    # 3) Pair of slender teal phials (x=17..20, y=22..27)
    c.rect(17, 23, 18, 27, TL2); c.set(17, 23, TL4); c.set(17, 22, OK3)
    c.rect(19, 23, 20, 27, GR2); c.set(19, 23, GR3); c.set(19, 22, OK3)
    # 4) Stone alchemist mortar & pestle (x=22..26, y=22..27)
    c.rect(22, 24, 26, 27, ST_O)
    c.rect(23, 25, 25, 26, ST4)
    c.set(23, 25, ST5)
    c.set(25, 22, ST5); c.set(24, 23, ST4)  # pestle

    c.add_shadow_bar(3, 28, 31)
    return c


# ---------------------------------------------------------------------------
# 13. gilded_lectern_tome (16x32, standing)
# ---------------------------------------------------------------------------
def obj_gilded_lectern_tome() -> PixelCanvas:
    c = PixelCanvas(16, 32)
    # Stepped carved dark-oak & brass pedestal base (y=26..30)
    c.rect(2, 27, 13, 30, DO_O)
    c.rect(3, 28, 12, 29, DO2)
    c.hline(3, 12, 28, DO4)
    c.rect(4, 25, 11, 27, DO_O)
    c.rect(5, 26, 10, 26, GD2)
    # Sturdy vertical oak pillar post (x=5..10, y=13..25)
    c.rect(5, 13, 10, 25, DO_O)
    c.rect(6, 14, 9, 24, DO2)
    c.vline(6, 14, 24, DO3)
    c.vline(9, 14, 24, DO1)
    # Decorative antique brass collars
    c.hline(6, 9, 16, GD3)
    c.hline(6, 9, 22, GD2)

    # Slanted gilded lectern top desk (x=1..14, y=2..13 — 3/4 top band + front lip)
    c.rect(1, 2, 14, 13, DO_O)
    c.rect(2, 3, 13, 11, DO2)
    c.hline(2, 13, 3, GD2)   # antique gold top trim
    c.hline(2, 13, 11, GD3)  # brass book-stop ledge
    c.hline(2, 13, 12, DO1)

    # Large OPEN parchment grimoire resting on the desk (x=2..13, y=3..10)!
    # Book leather cover edges
    c.rect(2, 4, 13, 10, RD0)
    # Left & right bright cream parchment pages
    c.rect(3, 4, 7, 9, PA2)
    c.hline(3, 7, 4, PA3)
    c.rect(8, 4, 12, 9, PA2)
    c.hline(8, 12, 4, PA3)
    # Dark central spine crease
    c.vline(7, 4, 9, PA0)
    c.set(8, 4, PA1)
    # Crisp dark rune text lines on both pages
    for ly in (6, 8):
        c.hline(4, 6, ly, PA0)
        c.hline(9, 11, ly, PA0)
    c.set(5, 5, TL2)  # tiny arcane blue illuminated initial
    # Crimson ribbon bookmark draping over front lip!
    c.vline(9, 10, 14, RD2)
    c.set(9, 11, RD3)
    c.set(9, 15, RD_O)

    c.add_shadow_bar(3, 12, 31)
    return c


# ---------------------------------------------------------------------------
# 14. scrying_crystal_pedestal (16x32, standing)
# ---------------------------------------------------------------------------
def obj_scrying_crystal_pedestal() -> PixelCanvas:
    c = PixelCanvas(16, 32)
    # Stepped cool grey stone pedestal base (y=26..30)
    c.rect(2, 27, 13, 30, ST_O)
    c.rect(3, 28, 12, 29, ST3)
    c.hline(3, 12, 28, ST5)
    c.hline(3, 12, 29, ST1)
    # Fluted stone pedestal shaft (x=4..11, y=17..27)
    c.rect(4, 17, 11, 27, ST_O)
    c.rect(5, 18, 10, 26, ST3)
    c.vline(5, 18, 26, ST5)
    c.vline(7, 18, 26, ST2)
    c.vline(8, 18, 26, ST4)
    c.vline(10, 18, 26, ST1)
    # Pedestal beveled stone capital (x=2..13, y=14..17 — narrow lit top ledge!)
    c.rect(2, 14, 13, 17, ST_O)
    c.rect(3, 15, 12, 16, ST4)
    c.hline(3, 12, 15, ST6)
    c.hline(3, 12, 16, ST2)
    # Antique brass 3-prong claw cradle (y=11..15)
    c.rect(4, 12, 11, 14, GD_O)
    c.hline(5, 10, 13, GD2)
    c.set(5, 12, GD3); c.set(7, 13, GD3); c.set(10, 12, GD2)

    # Large glowing arcane cyan-teal crystal orb (cx=7.5, cy=7.0, r=5.2)
    c.ellipse(7.5, 7.0, 5.4, 5.4, TL_O)
    c.ellipse(7.5, 7.0, 4.4, 4.4, TL0)
    c.ellipse(7.2, 6.7, 3.8, 3.8, TL1)
    c.ellipse(6.7, 6.2, 3.0, 3.0, TL2)
    c.ellipse(6.2, 5.7, 2.0, 2.0, TL3)
    # Crisp 2x2 white-cyan specular sparkle on top-left
    c.rect(5, 4, 6, 5, TL4)
    c.set(9, 9, TL3)  # subtle inner rim refraction

    c.add_shadow_bar(3, 12, 31)
    return c


# ---------------------------------------------------------------------------
# 15. treasure_chest_bound (16x16, standing)
# ---------------------------------------------------------------------------
def obj_treasure_chest_bound() -> PixelCanvas:
    c = PixelCanvas(16, 16)
    # Outer silhouette x=1..14, y=2..14 (standing: domed lid top band + iron-bound front)
    c.rect(1, 2, 14, 14, DO_O)
    # Rounded upper corners
    c.set(1, 2, None); c.set(14, 2, None)
    # Domed oak top lid band (y=3..6)
    c.rect(2, 3, 13, 6, OK3)
    c.hline(3, 12, 3, OK5)
    c.hline(2, 13, 4, OK4)
    c.hline(2, 13, 6, OK1)
    # Dark lid seam
    c.hline(2, 13, 7, DO_O)
    # Front oak chest body (y=8..13)
    c.rect(2, 8, 13, 13, OK2)
    c.vline(2, 8, 13, OK3)
    c.hline(2, 13, 10, OK1)  # plank seam
    c.hline(2, 13, 13, OK0)
    # Two vertical dark iron binding straps with 1px bright pewter highlights!
    for sx in (3, 11):
        c.rect(sx, 3, sx + 1, 13, IR0)
        c.vline(sx, 3, 13, IR1)
        c.set(sx, 4, IR3)
        c.set(sx, 9, IR3)
        c.set(sx, 12, IR2)
    # Centered antique brass lockplate (x=7..8, y=7..10)
    c.rect(6, 7, 9, 10, GD_O)
    c.rect(7, 7, 8, 9, GD3)
    c.set(8, 9, GD1)
    c.set(7, 8, DO_O)  # keyhole

    c.add_shadow_bar(2, 13, 15)
    return c


# ---------------------------------------------------------------------------
# 16. wooden_crates_stack (32x32, standing)
# ---------------------------------------------------------------------------
def obj_wooden_crates_stack() -> PixelCanvas:
    c = PixelCanvas(32, 32)

    def draw_crate(x0: int, y0: int, w: int, h: int, warm_shift: bool = False, diag: bool = True) -> None:
        x1 = x0 + w - 1
        y1 = y0 + h - 1
        c.rect(x0, y0, x1, y1, OK_O)
        top_hi = OK5 if not warm_shift else OK4
        top_mid = OK4 if not warm_shift else OK3
        frame_hi = OK3 if not warm_shift else OK2
        frame_lo = OK1 if not warm_shift else OK0
        panel_mid = OK2 if not warm_shift else OK1
        panel_hi = OK3 if not warm_shift else OK2
        # Narrow lit top band (3px = ~1/4 of crate height, NO side walls!)
        c.rect(x0 + 1, y0 + 1, x1 - 1, y0 + 3, top_mid)
        c.hline(x0 + 1, x1 - 1, y0 + 1, top_hi)
        c.hline(x0 + 1, x1 - 1, y0 + 3, frame_lo)
        # Front face (y0+4..y1-1)
        c.rect(x0 + 1, y0 + 4, x1 - 1, y1 - 1, frame_hi)
        c.hline(x0 + 1, x1 - 1, y0 + 4, top_mid)
        c.hline(x0 + 1, x1 - 1, y1 - 1, frame_lo)
        c.vline(x1 - 1, y0 + 4, y1 - 1, frame_lo)
        # Recessed inner plank panel
        c.rect(x0 + 3, y0 + 6, x1 - 3, y1 - 3, panel_mid)
        c.hline(x0 + 3, x1 - 3, y0 + 6, OK0)
        c.hline(x0 + 3, x1 - 3, (y0 + y1) // 2 + 1, OK0)  # horizontal plank seam
        if diag:
            # Diagonal timber brace across front panel
            span = min(x1 - x0 - 6, y1 - y0 - 8)
            for i in range(span + 1):
                px = x0 + 3 + i
                py = y0 + 6 + int(round(i * (y1 - y0 - 9) / max(1, span)))
                c.set(px, py, panel_hi)
                if py + 1 <= y1 - 3:
                    c.set(px, py + 1, frame_lo)
        else:
            # Horizontal cross-batten
            my = (y0 + y1) // 2 + 1
            c.hline(x0 + 2, x1 - 2, my - 1, panel_hi)
            c.hline(x0 + 2, x1 - 2, my, frame_lo)
        # Tiny iron corner nails
        for nx, ny in ((x0 + 2, y0 + 5), (x1 - 2, y0 + 5), (x0 + 2, y1 - 2), (x1 - 2, y1 - 2)):
            c.set(nx, ny, IR1)

    # Bottom-left crate (14x15)
    draw_crate(2, 16, 14, 15, warm_shift=False, diag=True)
    # Bottom-right crate (14x15, slightly darker weathered tone + horizontal slat)
    draw_crate(16, 16, 14, 15, warm_shift=True, diag=False)
    # Top centered crate (14x14, sitting firmly atop both lower crates)
    draw_crate(9, 4, 14, 14, warm_shift=False, diag=True)

    c.add_shadow_bar(3, 28, 31)
    return c


# ---------------------------------------------------------------------------
# 17. oak_barrel_hooped (16x16, standing)
# ---------------------------------------------------------------------------
def obj_oak_barrel_hooped() -> PixelCanvas:
    c = PixelCanvas(16, 16)
    # Curved stave oak barrel (never boxy!), elliptical top lid + 2 iron hoops with 1px highlights
    row_spans = {
        1: (4, 11),
        2: (3, 12),
        3: (3, 12),
        4: (2, 13),
        5: (2, 13),
        6: (2, 13),
        7: (2, 13),
        8: (2, 13),
        9: (2, 13),
        10: (2, 13),
        11: (2, 13),
        12: (3, 12),
        13: (3, 12),
        14: (4, 11),
    }
    for y, (x0, x1) in row_spans.items():
        c.hline(x0, x1, y, OK_O)

    # Elliptical lit wooden top rim & recessed barrel head (y=2..4 = ~1/4 height)
    c.hline(4, 11, 2, OK4)
    c.hline(4, 7, 2, OK5)
    c.hline(4, 11, 3, OK2)
    c.hline(5, 10, 3, OK3)
    c.set(7, 3, OK0)  # stave line on top lid
    c.hline(3, 12, 4, OK1)

    # Curved oak stave body (y=5..13) with curved left-to-right shading
    for y in range(5, 14):
        x0, x1 = row_spans[y]
        for x in range(x0 + 1, x1):
            if x <= x0 + 2:
                col = OK4
            elif x <= 6:
                col = OK3
            elif x <= 9:
                col = OK2
            else:
                col = OK1
            c.set(x, y, col)
        # Vertical dark stave seams
        for seam_x in (5, 8, 10):
            if x0 < seam_x < x1:
                c.set(seam_x, y, OK0)

    # Two dark iron hoops at y=6 and y=11, each with a crisp 1px pewter highlight!
    for hy in (6, 11):
        x0, x1 = row_spans[hy]
        c.hline(x0, x1, hy, IR_O)
        c.hline(x0 + 1, x1 - 1, hy, IR0)
        c.hline(x0 + 1, 7, hy, IR1)
        c.set(4, hy, IR3)  # 1px curved metal specular glint!
        c.set(5, hy, IR2)

    c.add_shadow_bar(4, 11, 15)
    return c


# ---------------------------------------------------------------------------
# 18. brass_candelabra (16x32, slender)
# ---------------------------------------------------------------------------
def obj_brass_candelabra() -> PixelCanvas:
    c = PixelCanvas(16, 32)
    # Strictly slender: 3-4px upright brass post + 3-branch candle top + flared tripod base
    # Flared tripod base (x=3..12, y=27..30)
    c.rect(3, 28, 12, 30, GD_O)
    c.hline(4, 11, 29, GD2)
    c.hline(4, 7, 29, GD3)
    c.rect(5, 26, 10, 28, GD_O)
    c.hline(6, 9, 27, GD2); c.set(6, 27, GD3)

    # Slender fluted antique brass central stem (x=6..9, y=11..26 -> 4px incl 1px dark outline)
    c.rect(6, 11, 9, 26, GD_O)
    c.vline(7, 11, 26, GD3)
    c.vline(8, 11, 26, GD1)
    # Decorative turned brass knops along stem
    for ky in (16, 22):
        c.rect(5, ky, 10, ky + 1, GD_O)
        c.hline(6, 9, ky, GD3)
        c.hline(6, 9, ky + 1, GD1)

    # Symmetrical curved branching arms (y=11..14)
    c.rect(2, 11, 13, 13, GD_O)
    c.hline(3, 12, 12, GD2)
    c.hline(3, 7, 12, GD3)
    # Cut interior air gap between outer arms and center stem so arms read unmistakably!
    c.set(5, 11, None); c.set(10, 11, None)
    c.set(4, 13, None); c.set(5, 13, None); c.set(10, 13, None); c.set(11, 13, None)
    c.set(2, 13, None); c.set(13, 13, None)

    # 3 Brass drip cups (left x=2..4, center x=6..9, right x=11..13)
    c.rect(2, 10, 4, 11, GD_O); c.set(3, 10, GD3)
    c.rect(6, 9, 9, 10, GD_O); c.hline(7, 8, 9, GD3)
    c.rect(11, 10, 13, 11, GD_O); c.set(12, 10, GD2)

    # 3 Cream wax tapers + glowing candle flames (with warm dark outer outline for crisp 1x contrast!)
    def draw_candle(cx_pos: int, y_base: int, wax_h: int) -> None:
        # Wax body (2px wide + 1px dark parchment outline)
        y_top = y_base - wax_h + 1
        c.rect(cx_pos - 1, y_top, cx_pos + 1, y_base, PA_O)
        c.vline(cx_pos, y_top, y_base, PA3)
        # Flame right above wax (4px tall, warm dark crimson-amber outline -> FL1 -> FL3 -> FL4 core)
        fy = y_top - 1
        c.rect(cx_pos - 1, fy - 3, cx_pos + 1, fy, RD_O)
        c.set(cx_pos - 1, fy - 3, None); c.set(cx_pos + 1, fy - 3, None)
        c.set(cx_pos, fy - 3, RD_O)
        c.set(cx_pos, fy - 2, FL2)
        c.set(cx_pos, fy - 1, FL3)
        c.set(cx_pos, fy, FL4)

    draw_candle(3, 9, 3)   # left candle
    draw_candle(7, 8, 4)   # center taller candle
    draw_candle(12, 9, 3)  # right candle

    c.add_shadow_bar(4, 11, 31)
    return c


# ---------------------------------------------------------------------------
# 19. wall_banner_crimson (16x32, standing)
# ---------------------------------------------------------------------------
def obj_wall_banner_crimson() -> PixelCanvas:
    c = PixelCanvas(16, 32)
    # Horizontal top mounting rod with brass finials (x=1..14, y=1..4)
    c.rect(1, 1, 14, 4, DO_O)
    c.hline(3, 12, 2, DO3)
    c.hline(3, 12, 3, DO1)
    c.rect(1, 1, 2, 4, GD_O); c.set(2, 2, GD3); c.set(2, 3, GD1)
    c.rect(13, 1, 14, 4, GD_O); c.set(13, 2, GD3); c.set(13, 3, GD1)

    # Draped crimson tapestry body (x=2..13, y=4..29)
    c.rect(2, 4, 13, 28, RD_O)
    c.rect(3, 5, 12, 27, RD1)
    # Vertical soft drapery folds (top-left lit)
    c.vline(3, 5, 27, GD2)  # antique gold left border trim
    c.vline(12, 5, 27, GD1) # antique gold right border trim
    c.vline(4, 5, 26, RD3)
    c.vline(5, 5, 26, RD2)
    c.vline(10, 5, 26, RD0)
    c.vline(11, 5, 26, RD0)
    # Top shadow under rod
    c.hline(3, 12, 5, RD0)
    c.hline(4, 11, 6, GD2)

    # Bold centered antique-gold arcane wizard star & crescent emblem (y=11..19)
    # Vertical & horizontal cross rays
    c.vline(7, 11, 19, GD3); c.vline(8, 11, 19, GD2)
    c.hline(5, 10, 15, GD3)
    # Diagonal star sparks
    for dx, dy in ((-2, -2), (2, -2), (-2, 2), (2, 2)):
        c.set(7 + dx if dx < 0 else 8 + dx, 15 + dy, GD2)
    # Bright core gem
    c.rect(7, 14, 8, 16, GD4)
    c.set(7, 15, TL3)  # tiny arcane teal crystal heart

    # Decorative bottom border & notched swallowtail hem with gold fringe (y=25..30)
    c.hline(3, 12, 25, GD2)
    c.hline(3, 12, 26, GD1)
    # Cut central swallowtail V-notch (x=7..8, y=28..30)
    c.rect(2, 28, 6, 30, GD_O)
    c.rect(9, 28, 13, 30, GD_O)
    c.hline(3, 5, 28, GD2); c.set(3, 29, GD3); c.set(5, 29, GD2)
    c.hline(10, 12, 28, GD2); c.set(10, 29, GD2); c.set(12, 29, GD1)
    c.rect(7, 28, 8, 30, None)
    c.hline(7, 8, 27, RD_O)

    return c


# ---------------------------------------------------------------------------
# 20. arcane_rune_rug (48x32, topdown)
# ---------------------------------------------------------------------------
def obj_arcane_rune_rug() -> PixelCanvas:
    c = PixelCanvas(48, 32)
    # Strictly top-down ornate crimson & gold arcane library carpet (46x30 opaque, flat!)
    # Outer dark maroon border (x=2..45, y=1..30)
    c.rect(2, 1, 45, 30, RD_O)
    # Woven fringe tassels along left (x=1) & right (x=46) edges
    for ty in range(2, 30, 2):
        c.set(1, ty, GD_O)
        c.set(46, ty, GD_O)
        c.set(2, ty, GD2)
        c.set(45, ty, GD1)
    # Rich crimson woven interior
    c.rect(3, 2, 44, 29, RD1)
    c.hline(3, 44, 2, RD2)
    c.vline(3, 2, 29, RD2)
    # Outer antique gold geometric border (x=4..43, y=3..28)
    c.box_outline(4, 3, 43, 28, GD2)
    c.hline(4, 43, 3, GD3)
    c.vline(4, 3, 28, GD3)
    c.box_outline(5, 4, 42, 27, RD0)
    c.box_outline(6, 5, 41, 26, GD1)
    # Ornate gold corner squares
    for cx0, cy0 in ((4, 3), (40, 3), (4, 25), (40, 25)):
        c.rect(cx0, cy0, cx0 + 3, cy0 + 3, GD2)
        c.rect(cx0 + 1, cy0 + 1, cx0 + 2, cy0 + 2, RD0)
        c.set(cx0 + 1, cy0 + 1, GD3)
    # Subtle side diamond weave accents along left & right flanks (x=9 & x=38)
    for dx in (10, 37):
        for dy in (10, 15, 20):
            c.set(dx, dy - 1, GD2)
            c.set(dx - 1, dy, GD2)
            c.set(dx + 1, dy, GD2)
            c.set(dx, dy + 1, GD2)
            c.set(dx, dy, GD3)

    # Centerpiece inlaid ARCANE RUNE CIRCLE (cx=23.5, cy=15.5)
    cx, cy = 23.5, 15.5
    # Dark crimson recessed circle field so gold & teal runes pop sharply!
    c.ellipse(cx, cy, 11.5, 9.2, RD0)
    # Outer gold magic ring
    for y in range(6, 26):
        for x in range(12, 36):
            d = math.hypot((x - cx) / 11.2, (y - cy) / 8.8)
            if 0.87 <= d <= 1.02:
                c.set(x, y, GD3 if y < 16 else GD2)
            elif 0.56 <= d <= 0.67:
                c.set(x, y, GD2)
    # Inlaid 8-point arcane diamond star
    for i in range(9):
        # Diamond connecting N/E/S/W of inner ring
        c.set(int(round(cx + i * 0.85)), int(round(cy - 6.8 + i * 0.85)), GD3)
        c.set(int(round(cx - i * 0.85)), int(round(cy - 6.8 + i * 0.85)), GD3)
        c.set(int(round(cx + i * 0.85)), int(round(cy + 6.8 - i * 0.85)), GD2)
        c.set(int(round(cx - i * 0.85)), int(round(cy + 6.8 - i * 0.85)), GD2)
    # Luminous sea-teal arcane center crystal sigil & 4 cardinal rune gems!
    c.ellipse(cx, cy, 3.2, 2.6, TL0)
    c.ellipse(cx, cy, 2.2, 1.8, TL2)
    c.rect(23, 15, 24, 16, TL4)
    for gx, gy in ((23, 7), (24, 7), (23, 24), (24, 24), (13, 15), (13, 16), (34, 15), (34, 16)):
        c.set(gx, gy, TL3)

    return c


# ---------------------------------------------------------------------------
# Registry & metadata for manifest.json and notes.txt
# ---------------------------------------------------------------------------
OBJECT_SPECS: list[dict] = [
    {
        "id": "bookshelf_tall_full",
        "fn": obj_bookshelf_tall_full,
        "name_en": "Grand Library Bookshelf",
        "name_ko": "대서고 대형 책장",
        "camera": "standing",
        "tiles": "2x2",
        "description": "Double-wide dark oak Beodeul library bookcase with a lit cornice top band and three recessed shelves packed with crimson, indigo, teal, moss, and gilded tomes.",
        "tags": ["bookshelf", "library", "oak", "books", "standing", "beodeul", "wizard"],
        "note": "Double-bay dark oak frame with lit cornice top band and high-contrast multi-hue book spines.",
        "score": 9,
    },
    {
        "id": "bookshelf_scroll_rack",
        "fn": obj_bookshelf_scroll_rack,
        "name_en": "Pigeonhole Scroll Rack",
        "name_ko": "두루마리 보관함",
        "camera": "standing",
        "tiles": "1x2",
        "description": "Tall narrow oak cubby cabinet with a lit top cornice and six recessed compartments stacked with rolled cream parchment scrolls tied in crimson ribbon.",
        "tags": ["scrolls", "rack", "cabinet", "parchment", "standing", "library"],
        "note": "Six distinct cubbies filled with round rolled parchment scroll ends and crimson ribbon ties.",
        "score": 9,
    },
    {
        "id": "grimoire_cabinet",
        "fn": obj_grimoire_cabinet,
        "name_en": "Locked Grimoire Cabinet",
        "name_ko": "마도서 유리 장식장",
        "camera": "standing",
        "tiles": "2x2",
        "description": "Locked dark oak display cabinet featuring glazed upper doors with brass hinges and lockplate over rare glowing tomes, plus two brass-handled lower drawers.",
        "tags": ["cabinet", "grimoire", "glass", "brass", "standing", "library"],
        "note": "Glazed upper doors with diagonal glass reflection, centered brass lockplate, and twin drawers.",
        "score": 9,
    },
    {
        "id": "reading_table_long",
        "fn": obj_reading_table_long,
        "name_en": "Long Oak Reading Table",
        "name_ko": "긴 참나무 독서 탁자",
        "camera": "topdown",
        "tiles": "3x1",
        "description": "Three-tile wide weathered oak reading table viewed top-down with an empty beveled plank surface, thin dark front apron, and short corner leg stubs.",
        "tags": ["table", "reading", "oak", "topdown", "furniture", "empty"],
        "note": "Clean top-down empty oak slab (>=75% height), crisp top-left bevel highlight, 2px apron and stub legs.",
        "score": 9,
    },
    {
        "id": "study_table_round",
        "fn": obj_study_table_round,
        "name_en": "Round Oak Study Table",
        "name_ko": "둥근 참나무 서재 탁자",
        "camera": "topdown",
        "tiles": "2x2",
        "description": "Circular weathered oak study table seen from almost directly above with a beveled plank top, empty surface, curved shaded rim, and central pedestal foot.",
        "tags": ["table", "round", "oak", "topdown", "study", "empty"],
        "note": "Large circular top-down oak tabletop with curved bevel highlight and short center pedestal.",
        "score": 9,
    },
    {
        "id": "alchemy_workbench",
        "fn": obj_alchemy_workbench,
        "name_en": "Stone-Top Alchemy Workbench",
        "name_ko": "연금술 석판 작업대",
        "camera": "topdown",
        "tiles": "2x1",
        "description": "Heavy dark oak workbench inset with an empty cool grey slate stone slab and riveted iron corner caps, viewed top-down with short front apron and legs.",
        "tags": ["workbench", "alchemy", "stone", "topdown", "iron", "empty"],
        "note": "Cool slate stone slab inset inside iron-bracketed dark oak rim; distinct from reading tables.",
        "score": 9,
    },
    {
        "id": "oak_study_chair",
        "fn": obj_oak_study_chair,
        "name_en": "Carved Oak Study Chair",
        "name_ko": "조각 참나무 서재 의자",
        "camera": "chair",
        "tiles": "1x1",
        "description": "Near top-down oak study chair facing down with a slatted top backrest rail, crimson cushioned seat seen from above, and sturdy front leg stubs.",
        "tags": ["chair", "oak", "crimson", "seat", "furniture", "library"],
        "note": "Slatted oak backrest along top edge, flat crimson-cushioned seat from above, front stub legs.",
        "score": 9,
    },
    {
        "id": "wooden_stool",
        "fn": obj_wooden_stool,
        "name_en": "Wooden Library Stool",
        "name_ko": "둥근 나무 스툴",
        "camera": "chair",
        "tiles": "1x1",
        "description": "Compact round wooden stool viewed near top-down with a beveled circular oak seat, thin shaded rim, and braced dark oak legs.",
        "tags": ["stool", "wooden", "chair", "oak", "furniture", "alchemy"],
        "note": "Distinct round beveled oak seat top and braced splayed legs without backrest.",
        "score": 9,
    },
    {
        "id": "stone_fireplace_lit",
        "fn": obj_stone_fireplace_lit,
        "name_en": "Lit Stone Hearth Fireplace",
        "name_ko": "불 피운 석재 벽난로",
        "camera": "standing",
        "tiles": "2x2",
        "description": "Cool dressed grey ashlar stone fireplace with a lit top mantle band, keystone arch firebox, glowing layered orange-yellow flames over iron grate, and warm hearth apron.",
        "tags": ["fireplace", "hearth", "stone", "fire", "standing", "warm"],
        "note": "Crisp cool-grey stone masonry contrasting blazing layered hearth flames and glowing stone apron.",
        "score": 9,
    },
    {
        "id": "brass_orrery_stand",
        "fn": obj_brass_orrery_stand,
        "name_en": "Brass Celestial Orrery",
        "name_ko": "황동 천체 혼천의",
        "camera": "standing",
        "tiles": "2x2",
        "description": "Gleaming antique brass armillary sphere with interlocking meridian and ecliptic rings, radiant golden sun core, and cyan/crimson planets mounted on a stone-and-oak pedestal.",
        "tags": ["orrery", "brass", "astronomy", "wizard", "standing", "centerpiece"],
        "note": "Interlocking brass meridian/ecliptic rings, sun core, and orbital planets atop carved pedestal.",
        "score": 9,
    },
    {
        "id": "alchemy_cauldron_hearth",
        "fn": obj_alchemy_cauldron_hearth,
        "name_en": "Bubbling Alchemy Cauldron",
        "name_ko": "끓는 연금술 가마솥",
        "camera": "standing",
        "tiles": "2x2",
        "description": "Curved cast-iron cauldron with side handles and elliptical open rim brimming with luminous bubbling emerald-teal potion, perched on an iron tripod over glowing stone-ringed coals.",
        "tags": ["cauldron", "alchemy", "potion", "iron", "standing", "fire"],
        "note": "Curved cast-iron pot with specular belly highlight, bubbling green-teal brew, and ember hearth.",
        "score": 9,
    },
    {
        "id": "potion_alembic_shelf",
        "fn": obj_potion_alembic_shelf,
        "name_en": "Potion & Alembic Rack",
        "name_ko": "물약·증류기 선반",
        "camera": "standing",
        "tiles": "2x2",
        "description": "Two-tier dark oak apothecary rack stocked with a glowing teal-and-brass glass alembic retort, emerald, indigo, ruby, and amber potion flasks, and a stone mortar.",
        "tags": ["potions", "alembic", "shelf", "alchemy", "standing", "glass"],
        "note": "High-contrast glowing alembic still and multi-color corked glass bottles in dark oak shelves.",
        "score": 9,
    },
    {
        "id": "gilded_lectern_tome",
        "fn": obj_gilded_lectern_tome,
        "name_en": "Gilded Reading Lectern",
        "name_ko": "금장 독서대와 마도서",
        "camera": "standing",
        "tiles": "1x2",
        "description": "Carved dark oak wizard lectern trimmed in antique brass, displaying a large open parchment grimoire with dark rune script and a draped crimson bookmark.",
        "tags": ["lectern", "tome", "grimoire", "brass", "standing", "library"],
        "note": "Crisp open cream parchment pages with rune lines and hanging crimson ribbon atop gilded pillar.",
        "score": 9,
    },
    {
        "id": "scrying_crystal_pedestal",
        "fn": obj_scrying_crystal_pedestal,
        "name_en": "Scrying Crystal Pedestal",
        "name_ko": "수정구 석재 받침대",
        "camera": "standing",
        "tiles": "1x2",
        "description": "Luminous cyan-teal scrying orb with bright top-left specular gleam held in a three-prong antique brass claw mount atop a fluted grey stone pedestal.",
        "tags": ["crystal", "scrying", "pedestal", "stone", "standing", "arcane"],
        "note": "Glowing cyan crystal orb in brass claws mounted on fluted cool-grey stone column.",
        "score": 9,
    },
    {
        "id": "treasure_chest_bound",
        "fn": obj_treasure_chest_bound,
        "name_en": "Iron-Bound Oak Chest",
        "name_ko": "철띠 참나무 보물상자",
        "camera": "standing",
        "tiles": "1x1",
        "description": "Compact Beodeul oak dungeon chest with a lit domed top lid, two pewter-highlighted dark iron binding straps, and a centered antique brass lockplate.",
        "tags": ["chest", "treasure", "oak", "iron", "standing", "dungeon"],
        "note": "Lit domed lid band, vertical highlighted iron straps, and gleaming central brass lockplate.",
        "score": 9,
    },
    {
        "id": "wooden_crates_stack",
        "fn": obj_wooden_crates_stack,
        "name_en": "Stacked Supply Crates",
        "name_ko": "나무 상자 더미",
        "camera": "standing",
        "tiles": "2x2",
        "description": "Pyramid stack of three weathered pine and oak storage crates showing crisp braced front panels, iron corner nails, and narrow lit top lids without side walls.",
        "tags": ["crates", "stack", "wooden", "storage", "standing", "beodeul"],
        "note": "Three-crate pyramid with varied wood tones, diagonal/horizontal braces, and zero side walls.",
        "score": 9,
    },
    {
        "id": "oak_barrel_hooped",
        "fn": obj_oak_barrel_hooped,
        "name_en": "Iron-Hooped Oak Barrel",
        "name_ko": "철테 참나무 통",
        "camera": "standing",
        "tiles": "1x1",
        "description": "Bulging curved-stave weathered oak barrel with an elliptical top lid and two dark iron hoops carrying crisp pewter specular highlights.",
        "tags": ["barrel", "oak", "iron", "storage", "standing", "beodeul"],
        "note": "Curved left-to-right stave shading, elliptical top rim, and twin highlighted iron hoops.",
        "score": 9,
    },
    {
        "id": "brass_candelabra",
        "fn": obj_brass_candelabra,
        "name_en": "Tall Brass Candelabra",
        "name_ko": "황동 3구 촛대",
        "camera": "slender",
        "tiles": "1x2",
        "description": "Slender antique brass floor candelabra with a fluted upright post, flared tripod base, and three curved branches holding lit cream wax tapers.",
        "tags": ["candelabra", "brass", "candles", "light", "slender", "library"],
        "note": "Slender 4px brass shaft, clear branching three-arm head with glowing flames, and tripod base.",
        "score": 9,
    },
    {
        "id": "wall_banner_crimson",
        "fn": obj_wall_banner_crimson,
        "name_en": "Crimson Arcane Banner",
        "name_ko": "진홍빛 마법탑 깃발",
        "camera": "standing",
        "tiles": "1x2",
        "description": "Hanging deep crimson tapestry banner suspended from a brass-tipped oak rod, woven with vertical drapery folds, a central gold arcane star, and notched fringed hem.",
        "tags": ["banner", "tapestry", "crimson", "gold", "standing", "wall"],
        "note": "Brass-tipped rod, shaded crimson cloth folds, bold gold arcane star, and swallowtail fringe.",
        "score": 9,
    },
    {
        "id": "arcane_rune_rug",
        "fn": obj_arcane_rune_rug,
        "name_en": "Inlaid Arcane Rune Rug",
        "name_ko": "마법진 양탄자",
        "camera": "topdown",
        "tiles": "3x2",
        "description": "Ornate three-by-two crimson woven library rug viewed flat from above, trimmed with antique gold corner borders, fringe tassels, and a central gold-and-teal magic rune circle.",
        "tags": ["rug", "carpet", "rune", "arcane", "topdown", "crimson"],
        "note": "Flat top-down woven crimson rug with ornate gold border and glowing inlaid teal-gold rune circle.",
        "score": 9,
    },
]


def build_all_objects() -> list[dict]:
    OBJECTS_DIR.mkdir(parents=True, exist_ok=True)
    results: list[dict] = []
    for spec in OBJECT_SPECS:
        fn: Callable[[], PixelCanvas] = spec["fn"]
        canvas = fn()
        out_path = OBJECTS_DIR / f"{spec['id']}.png"
        canvas.save(out_path)
        bbox = canvas.opaque_bbox()
        bw = (bbox[2] - bbox[0] + 1) if bbox else 0
        bh = (bbox[3] - bbox[1] + 1) if bbox else 0
        results.append(
            {
                "file": f"objects/{spec['id']}.png",
                "id": spec["id"],
                "name_en": spec["name_en"],
                "name_ko": spec["name_ko"],
                "camera": spec["camera"],
                "tiles": spec["tiles"],
                "canvas": f"{canvas.w}x{canvas.h}",
                "opaque_size": f"{bw}x{bh}",
                "facing": "down",
                "description": spec["description"],
                "tags": spec["tags"],
                "note": spec["note"],
                "score": spec["score"],
            }
        )
    return results


if __name__ == "__main__":
    res = build_all_objects()
    print(f"Built {len(res)} objects in {OBJECTS_DIR}")
