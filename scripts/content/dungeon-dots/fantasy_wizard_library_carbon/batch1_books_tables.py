#!/usr/bin/env python3
"""
T2 Library Batch 1/4: Museum-Grade Beodeul Fantasy Wizard Library (Bookcases & Tables)
Model: gemini-4-carbon (medium)

Sprites:
  1. bookshelf_tall_full.png   (32x32, standing, op ~28x30)
  2. bookshelf_scroll_rack.png (16x32, standing, op ~14x30)
  3. grimoire_cabinet.png      (32x32, standing, op ~28x29)
  4. reading_table_long.png    (48x16, topdown,  op ~46x14)
  5. study_table_round.png     (32x32, topdown,  op ~26x26)

Hard Rules Enforced:
  - 100% locked to palette_beodeul_library.json (70 colors, zero #000000)
  - Ground shadow strictly #4c557f @ alpha 85/255; all other pixels alpha 0 or 255
  - 1px dark material-matched outer outline on EVERY 4-connected boundary pixel
  - Strict standing (front + 1/4-1/3 lit top band, zero side walls) & topdown (>=75% flat top,
    <=3px front apron, 1-2px stub legs/pedestal peek, EMPTY surface) camera geometry
"""

from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
PALETTE_JSON = ROOT / "tiledata/dungeon-dots/fantasy_wizard_library/palette_beodeul_library.json"
CHAR_REF_4X = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs/ref_beodeul_char_4x.png"
OUT_DIR = ROOT / "tiledata/dungeon-dots/fantasy_wizard_library_carbon/objects"
PREVIEW_PNG = ROOT / "tiledata/dungeon-dots/fantasy_wizard_library_carbon/preview_batch1.png"

SHADOW_RGBA = (0x4C, 0x55, 0x7F, 85)
TRANSPARENT = (0, 0, 0, 0)

# ---------------------------------------------------------------------------
# Locked 70-color Beodeul Library Ramps
# ---------------------------------------------------------------------------
# Stone (8)
ST_O, ST0, ST1, ST2, ST3, ST4, ST5, ST6 = (
    "#27282f", "#37383f", "#53545a", "#6c6e6d", "#828382", "#a6a8a5", "#c4c6c3", "#dadcd9"
)
# Slate (6)
SL_O, SL0, SL1, SL2, SL3, SL4 = (
    "#1c1c26", "#2b2e34", "#404349", "#5a5b62", "#797a82", "#a0a2ac"
)
# Dark Oak (6)
DO_O, DO0, DO1, DO2, DO3, DO4 = (
    "#1f130b", "#2d1c12", "#442c19", "#60402b", "#805338", "#a56846"
)
# Warm Oak (7)
OK_O, OK0, OK1, OK2, OK3, OK4, OK5 = (
    "#382315", "#583a24", "#774d2a", "#9a6841", "#bd9056", "#d8aa73", "#e9c28e"
)
# Iron (5)
IR_O, IR0, IR1, IR2, IR3 = (
    "#141b2c", "#28303c", "#424956", "#697782", "#aebdca"
)
# Brass / Gold (6)
GD_O, GD0, GD1, GD2, GD3, GD4 = (
    "#4e3d22", "#72552b", "#a6874c", "#c9aa64", "#efc97b", "#fff0c0"
)
# Parchment (5)
PA_O, PA0, PA1, PA2, PA3 = (
    "#5f5145", "#8e8574", "#beb6a1", "#ded6bc", "#f2e6cf"
)
# Crimson (5)
RD_O, RD0, RD1, RD2, RD3 = (
    "#421b1d", "#6b2c2b", "#8c3938", "#a44332", "#c65340"
)
# Flame (5)
FL0, FL1, FL2, FL3, FL4 = (
    "#b8280e", "#e0482a", "#f08a10", "#f2c74a", "#fff2a5"
)
# Teal / Arcane Cyan (6)
TL_O, TL0, TL1, TL2, TL3, TL4 = (
    "#0c2222", "#1a4640", "#2a6f71", "#3fa2ae", "#84c8ce", "#cff4f8"
)
# Indigo / Sapphire (4)
BL_O, BL0, BL1, BL2 = (
    "#141231", "#26305a", "#3b4f88", "#7899bf"
)
# Moss / Emerald (5)
GR_O, GR0, GR1, GR2, GR3 = (
    "#1d2d19", "#355136", "#518153", "#76a86a", "#a8ca5c"
)
# Plum (2)
PL0, PL1 = "#492545", "#772f49"


def hex_to_rgba(h: str, alpha: int = 255) -> tuple[int, int, int, int]:
    h = h.lstrip("#").lower()
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


def rgba_to_hex(rgba: tuple[int, int, int, int]) -> str:
    return f"#{rgba[0]:02x}{rgba[1]:02x}{rgba[2]:02x}"


def load_palette() -> set[str]:
    data = json.loads(PALETTE_JSON.read_text(encoding="utf-8"))
    colors = {c.lower() for c in data["colors"]}
    assert len(colors) == 70, f"Expected 70 palette colors, got {len(colors)}"
    assert "#000000" not in colors
    return colors


def new_canvas(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), TRANSPARENT)


def put(img: Image.Image, x: int, y: int, color: str | tuple[int, int, int, int]) -> None:
    if 0 <= x < img.width and 0 <= y < img.height:
        rgba = hex_to_rgba(color) if isinstance(color, str) else color
        img.putpixel((x, y), rgba)


def put_shadow(img: Image.Image, x: int, y: int) -> None:
    if 0 <= x < img.width and 0 <= y < img.height:
        if img.getpixel((x, y))[3] == 0:
            img.putpixel((x, y), SHADOW_RGBA)


def hline(img: Image.Image, x0: int, x1: int, y: int, color: str | tuple[int, int, int, int]) -> None:
    for x in range(x0, x1 + 1):
        put(img, x, y, color)


def vline(img: Image.Image, x: int, y0: int, y1: int, color: str | tuple[int, int, int, int]) -> None:
    for y in range(y0, y1 + 1):
        put(img, x, y, color)


def rect(img: Image.Image, x0: int, y0: int, x1: int, y1: int, color: str | tuple[int, int, int, int]) -> None:
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(img, x, y, color)


# ===========================================================================
# 1. bookshelf_tall_full.png (32x32, standing, op 28x30: x=2..29, y=1..30)
# ===========================================================================
def draw_bookshelf_tall_full() -> Image.Image:
    """
    Grand carved oak library bookcase:
      - Standing camera: overhanging sculpted crown top band (y=1..7, ~23% height), ZERO side walls.
      - Stepped architectural silhouette: overhanging cornice (x=2..29 at y=2..6), fluted pilaster
        body (x=3..28 at y=7..27), flaring carved plinth & bracket feet (x=2..29 at y=28..30).
      - 3 deeply shadowed recessed bays packed with upright, leaning, and horizontally stacked
        jewel-toned leather folios with gold spine bands & parchment fore-edges.
      - Gleaming antique brass corner brackets on cornice & plinth + center mullion brass studs.
    """
    img = new_canvas(32, 32)

    # Soft ground shadow (#4c557f @ 85) under arched plinth & baseline
    for x in range(9, 23):
        put_shadow(img, x, 30)
    for x in range(3, 29):
        put_shadow(img, x, 31)

    # --- A. Sculpted Molded Crown Top Band (y=1..7, 7px = 23.3% of 30px height) ---
    # y=1: stepped top outline (x=3..28) with subtle raised central crest (x=11..20)
    hline(img, 3, 28, 1, DO_O)

    # y=2..5: overhanging cornice (x=2..29) showing lit 3/4 oak top plane + wood grain
    for y in range(2, 6):
        put(img, 2, y, DO_O)
        put(img, 29, y, DO_O)

    # Lit top surface (x=3..28, y=2..4) with rich top-left to bottom-right oak bevel & grain
    put(img, 3, 2, OK5)
    hline(img, 4, 10, 2, OK4)
    hline(img, 11, 19, 2, OK3)
    hline(img, 20, 25, 2, DO4)
    hline(img, 26, 28, 2, DO3)

    put(img, 3, 3, OK4)
    hline(img, 4, 8, 3, OK3)
    hline(img, 9, 16, 3, DO4)
    hline(img, 17, 23, 3, OK2)
    hline(img, 24, 28, 3, DO3)
    # Subtle wood grain streaks on top plane
    hline(img, 6, 11, 3, OK4)
    hline(img, 18, 22, 3, DO4)

    put(img, 3, 4, OK3)
    hline(img, 4, 11, 4, DO4)
    hline(img, 12, 21, 4, DO3)
    hline(img, 22, 27, 4, DO2)
    put(img, 28, 4, DO1)

    # y=5: Molded front cornice bullnose + gleaming antique brass corner brackets!
    # Left brass cornice bracket (x=3..5, y=4..5)
    put(img, 3, 4, GD4)
    put(img, 4, 4, GD3)
    put(img, 3, 5, GD3)
    put(img, 4, 5, GD2)
    put(img, 5, 5, GD1)
    # Carved dentil molding across y=5 (x=6..25)
    for x in range(6, 26):
        if x % 2 == 0:
            put(img, x, 5, OK3 if x < 16 else DO4)
        else:
            put(img, x, 5, DO2 if x < 18 else DO1)
    # Center brass crest stud on cornice frieze (x=15..16, y=5)
    put(img, 15, 5, GD4)
    put(img, 16, 5, GD2)
    # Right brass cornice bracket (x=26..28, y=4..5)
    put(img, 27, 4, GD2)
    put(img, 28, 4, GD1)
    put(img, 26, 5, GD1)
    put(img, 27, 5, GD2)
    put(img, 28, 5, GD0)

    # y=6: Overhanging lower cornice lip (x=2..29)
    put(img, 2, 6, DO_O)
    hline(img, 3, 14, 6, DO1)
    hline(img, 15, 28, 6, DO0)
    put(img, 29, 6, DO_O)

    # --- B. Main Bookcase Pilaster Frame & Deep Recessed Bays (x=3..28, y=7..27) ---
    rect(img, 3, 7, 28, 27, DO_O)

    # Under-cornice shadow bar (y=7)
    hline(img, 4, 27, 7, DO0)

    # Outer fluted oak stiles: left (x=3 outline, x=4..5 carved stile? Wait: keep wide 9px bays!)
    # Let's check: x=3 is DO_O outer outline; x=4 is lit pilaster stile; x=5..14 (10px left bay!);
    # x=15..16 (2px carved center mullion); x=17..26 (10px right bay!); x=27 shaded stile; x=28 DO_O outline!
    for y in range(7, 28):
        put(img, 3, y, DO_O)
        put(img, 4, y, OK3 if y < 14 else (DO4 if y < 22 else DO3))
        put(img, 15, y, DO4 if y < 16 else DO3)
        put(img, 16, y, DO1)
        put(img, 27, y, DO2 if y < 15 else DO1)
        put(img, 28, y, DO_O)

    # Deep recessed shadow cavities for the 3 shelf tiers:
    # Tier 1: y=8..13 | Shelf 1: y=14..15
    # Tier 2: y=16..21 | Shelf 2: y=22..23
    # Tier 3: y=24..27 (4px tall heavy folio bay? Wait: make Tier 3 y=23..27 = 5px tall!)
    # Let's optimize vertical rhythm so ALL 3 bays feel generous and grand:
    #   Tier 1: y=8..13  (6px bay, top row y=8 deep recess shadow)
    #   Shelf 1: y=14..15 (y=14 bright oak shelf lip + y=15 dark underside)
    #   Tier 2: y=16..20 (5px bay) -> Shelf 2: y=21..22 -> Tier 3: y=23..27 (5px bay)!
    # Yes! 6px + 5px + 5px = balanced 3-tier library proportions!
    for y0, y1 in ((8, 13), (16, 20), (23, 27)):
        rect(img, 5, y0, 14, y1, DO_O)
        rect(img, 17, y0, 26, y1, DO_O)
        # Warm back-wall wood shadow just above books on row y0+1 where visible
        hline(img, 5, 14, y0 + 1, DO0)
        hline(img, 17, 26, y0 + 1, DO0)

    # Sculpted 2px shelves at y=14..15 and y=21..22
    for sy in (14, 21):
        put(img, 4, sy, OK4)
        hline(img, 5, 14, sy, OK3)
        put(img, 15, sy, GD3)   # gleaming brass mullion rosette
        put(img, 16, sy, GD1)
        hline(img, 17, 26, sy, DO4)
        put(img, 27, sy, DO3)

        put(img, 4, sy + 1, DO2)
        hline(img, 5, 14, sy + 1, DO1)
        put(img, 15, sy + 1, DO2)
        put(img, 16, sy + 1, DO0)
        hline(img, 17, 26, sy + 1, DO0)
        put(img, 27, sy + 1, DO0)

    # Helper for crisp shaded upright book spine
    def upright_book(
        x: int, w: int, y_top: int, y_bot: int,
        hi: str, mid: str, shd: str,
        band1: str | None = None, band2: str | None = None
    ) -> None:
        # Top cap (parchment page hint or bright crown)
        put(img, x, y_top, hi)
        if w >= 2:
            put(img, x + 1, y_top, mid)
        if w >= 3:
            put(img, x + 2, y_top, shd)
        for yy in range(y_top + 1, y_bot + 1):
            put(img, x, yy, hi)
            if w >= 2:
                put(img, x + 1, yy, mid)
            if w >= 3:
                put(img, x + 2, yy, shd)
        if band1 is not None and (y_bot - y_top) >= 3:
            put(img, x, y_top + 1, band1)
            if w >= 2:
                put(img, x + 1, y_top + 1, GD1 if band1 in (GD3, GD4) else band1)
        if band2 is not None and (y_bot - y_top) >= 4:
            put(img, x, y_bot - 1, band2)
            if w >= 2:
                put(img, x + 1, y_bot - 1, GD1 if band2 in (GD3, GD4) else band2)

    # --- TIER 1 BOOKS (y_bot = 13, cavity y=8..13) ---
    # Left Bay (x=5..14):
    # 1) Crimson leather folio (x=5..6, y=9..13) with gold bands
    upright_book(5, 2, 9, 13, RD3, RD1, RD0, GD3, GD2)
    # 2) Tall royal indigo grimoire (x=7..8, y=8..13) with bright gold star dot
    upright_book(7, 2, 8, 13, BL2, BL1, BL0, None, GD2)
    put(img, 7, 10, GD4)
    # 3) Moss-emerald herbal codex (x=9..10, y=9..13)
    upright_book(9, 2, 9, 13, GR2, GR1, GR0, GD3, None)
    # 4) Leaning/tilted ochre-vellum tome (tilting right from x=11..12 at top to x=12..14 at bottom, propped cleanly!)
    put(img, 11, 9, PA3); put(img, 12, 9, PA1)
    put(img, 11, 10, PA2); put(img, 12, 10, GD3); put(img, 13, 10, PA0)
    put(img, 11, 11, DO1); put(img, 12, 11, PA3); put(img, 13, 11, PA1)
    put(img, 11, 12, GD1); put(img, 12, 12, GD3); put(img, 13, 12, PA1); put(img, 14, 12, PA0)
    put(img, 11, 13, GD2); put(img, 12, 13, GD0); put(img, 13, 13, PA2); put(img, 14, 13, PA0)

    # Right Bay (x=17..26):
    # 1) Tall arcane teal tome (x=17..18, y=8..13)
    upright_book(17, 2, 8, 13, TL3, TL2, TL1, GD3, GD2)
    # 2) Deep plum spellbook (x=19, y=9..13) + Crimson volume (x=20..21, y=8..13)
    vline(img, 19, 9, 13, PL1)
    put(img, 19, 9, PA2)
    put(img, 19, 11, GD3)
    upright_book(20, 2, 8, 13, RD3, RD2, RD0, GD4, GD2)
    # 3) Cream parchment codex (x=22..23, y=9..13) with crimson band
    upright_book(22, 2, 9, 13, PA3, PA2, PA0, RD2, RD1)
    # 4) Leaning gilded/indigo tome tilting left against the stack (x=24..26)
    put(img, 25, 9, BL2); put(img, 26, 9, BL0)
    put(img, 25, 10, GD3); put(img, 26, 10, BL0)
    put(img, 24, 11, BL2); put(img, 25, 11, BL1)
    put(img, 24, 12, GD3); put(img, 25, 12, BL0)
    put(img, 24, 13, BL1); put(img, 25, 13, BL0)

    # --- TIER 2 BOOKS (y_bot = 20, cavity y=16..20) ---
    # Left Bay (x=5..14): Horizontal stacked tomes (x=5..9) + upright jewel volumes (x=10..14)
    # Bottom horizontal folio (x=5..9, y=19..20): indigo leather cover + cream page block!
    hline(img, 5, 9, 19, BL2)
    put(img, 5, 19, GD3)
    hline(img, 5, 8, 20, PA3)
    put(img, 9, 20, BL0)
    # Upper horizontal book (x=5..8, y=17..18): crimson spine with gold clasps
    hline(img, 5, 8, 17, RD3)
    hline(img, 5, 8, 18, RD1)
    put(img, 6, 17, GD4)
    put(img, 7, 18, GD2)
    # Upright books beside stack (x=10..14)
    upright_book(10, 2, 16, 20, GD3, GD2, GD0, RD2, None)
    upright_book(12, 1, 17, 20, TL3, TL1, TL0)
    upright_book(13, 2, 16, 20, GR2, GR1, GR0, GD3, GD2)

    # Right Bay (x=17..26): Dense varied scholar spines
    upright_book(17, 3, 16, 20, RD3, RD1, RD0, GD3, GD2)
    upright_book(20, 2, 17, 20, PA3, PA1, PA0, BL1, None)
    upright_book(22, 2, 16, 20, BL2, BL1, BL0, GD4, GD2)
    upright_book(24, 1, 17, 20, PL1, PL0, PL0)
    upright_book(25, 2, 16, 20, TL3, TL1, TL0, GD3, None)

    # --- TIER 3 HEAVY FOLIOS (y_bot = 27, cavity y=23..27) ---
    # Left Bay (x=5..14): Thick oversized encyclopedias & atlases
    upright_book(5, 3, 23, 27, BL2, BL1, BL0, GD4, GD2)
    upright_book(8, 2, 24, 27, RD3, RD1, RD0, GD3, None)
    upright_book(10, 3, 23, 27, PA3, PA2, PA0, GD2, RD2)
    upright_book(13, 2, 24, 27, GR2, GR1, GR0, GD3, None)

    # Right Bay (x=17..26): Upright heavy grimoires + horizontal vellum stack on right
    upright_book(17, 2, 23, 27, GD3, GD1, GD0, RD2, RD1)
    upright_book(19, 3, 23, 27, RD3, RD1, RD0, GD4, GD2)
    # Horizontal folio pair at x=22..26, y=24..27
    hline(img, 22, 26, 26, TL2)
    hline(img, 22, 25, 27, PA2)
    put(img, 26, 27, TL0)
    hline(img, 23, 26, 24, PL1)
    hline(img, 23, 26, 25, GD3)
    put(img, 26, 25, PL0)

    # --- C. Carved Molded Plinth & Brass Corner Plates (x=2..29, y=28..30) ---
    # y=28: Projecting plinth ledge (x=2..29)
    put(img, 2, 28, DO_O)
    hline(img, 3, 14, 28, OK3)
    hline(img, 15, 24, 28, DO4)
    hline(img, 25, 28, 28, DO3)
    put(img, 29, 28, DO_O)

    # y=29: Shaded carved plinth skirt (x=2..29)
    put(img, 2, 29, DO_O)
    hline(img, 3, 8, 29, DO2)
    hline(img, 9, 22, 29, DO_O)  # arched cutout top outline!
    hline(img, 23, 28, 29, DO1)
    put(img, 29, 29, DO_O)

    # Gleaming L-shaped Brass Corner Plates on plinth corners (left x=3..5, right x=26..28 at y=27..29)
    put(img, 4, 27, GD4); put(img, 3, 28, GD3); put(img, 4, 28, GD3); put(img, 5, 28, GD2)
    put(img, 3, 29, GD2); put(img, 4, 29, GD1)

    put(img, 27, 27, GD2); put(img, 26, 28, GD2); put(img, 27, 28, GD3); put(img, 28, 28, GD1)
    put(img, 27, 29, GD1); put(img, 28, 29, GD0)

    # y=30: Sturdy carved bracket feet (left x=2..8, right x=23..29; center x=9..22 open arch)
    hline(img, 2, 8, 30, DO_O)
    hline(img, 23, 29, 30, DO_O)

    return img


# ===========================================================================
# 2. bookshelf_scroll_rack.png (16x32, standing, op 14x30: x=1..14, y=1..30)
# ===========================================================================
def draw_bookshelf_scroll_rack() -> Image.Image:
    """
    Tall narrow cubby cabinet packed with rolled cream parchment scrolls:
      - Standing camera: sculpted overhanging crown cornice (y=1..6, 20% height), ZERO side walls.
      - Stepped furniture silhouette: pediment top (x=3..12 at y=1), overhanging cornice (x=1..14 at y=2..5),
        notched neck shadow (x=2..13 at y=6), sturdy oak cubby frame (x=1..14 at y=7..29),
        and carved bracket feet (x=1..4 & x=11..14 at y=30).
      - Deep #1f130b recessed pigeonholes & full-width map trough packed with plump coiled
        parchment scrolls tied with crimson & antique gold ribbons + dangling wax seals!
    """
    img = new_canvas(16, 32)

    # Ground shadow (#4c557f @ 85)
    for x in range(5, 11):
        put_shadow(img, x, 30)
    for x in range(2, 14):
        put_shadow(img, x, 31)

    # --- A. Sculpted Cornice Crown (y=1..6) ---
    # y=1: Stepped pediment top outline (x=2..13)
    hline(img, 2, 13, 1, DO_O)

    # y=2..5: Overhanging oak cornice (x=1..14)
    for y in range(2, 6):
        put(img, 1, y, DO_O)
        put(img, 14, y, DO_O)

    # Lit 3/4 oak top plane (y=2..4)
    put(img, 2, 2, OK5)
    hline(img, 3, 6, 2, OK4)
    hline(img, 7, 10, 2, OK3)
    hline(img, 11, 13, 2, DO4)

    put(img, 2, 3, OK4)
    hline(img, 3, 7, 3, OK3)
    hline(img, 8, 11, 3, DO4)
    hline(img, 12, 13, 3, OK2)

    put(img, 2, 4, OK3)
    hline(img, 3, 8, 4, DO4)
    hline(img, 9, 12, 4, DO3)
    put(img, 13, 4, DO2)

    # y=5: Molded front cornice lip + brass corner pins
    put(img, 2, 5, GD4)
    put(img, 3, 5, GD2)
    hline(img, 4, 8, 5, OK3)
    hline(img, 9, 11, 5, DO3)
    put(img, 12, 5, GD2)
    put(img, 13, 5, GD0)

    # y=6: 1px notched neck groove under cornice (x=2..13 -> crisp silhouette step!)
    put(img, 2, 6, DO_O)
    hline(img, 3, 12, 6, DO0)
    put(img, 13, 6, DO_O)

    # --- B. Cubby Frame & Deep Shadow Recesses (x=1..14, y=7..29) ---
    # Seal top shoulders at (1, 7) and (14, 7) with DO_O
    rect(img, 1, 7, 14, 29, DO_O)

    # Outer oak stiles (x=2 lit left, x=13 shaded right)
    for y in range(8, 28):
        put(img, 2, y, OK3 if y < 15 else (DO4 if y < 22 else DO3))
        put(img, 13, y, DO2 if y < 16 else DO1)

    # Shelves at y=13..14 and y=21..22
    for sy in (13, 21):
        put(img, 2, sy, OK4)
        hline(img, 3, 12, sy, OK3)
        put(img, 11, sy, DO4)
        put(img, 12, sy, DO4)
        put(img, 13, sy, DO3)
        hline(img, 3, 12, sy + 1, DO0)

    # --- TIER 1 (y=8..12): Twin Pigeonholes (x=3..6 left, x=7..8 divider, x=9..12 right) ---
    for y in range(8, 13):
        put(img, 7, y, DO3)
        put(img, 8, y, DO1)
    # Deep recess ceilings (y=8)
    hline(img, 3, 6, 8, DO_O)
    hline(img, 9, 12, 8, DO_O)

    # Left cubby (x=3..6, y=9..12): Pyramid of 3 plump cream scrolls + dangling crimson ribbon!
    # Top scroll roll (x=4..5, y=9..10)
    put(img, 4, 9, PA3); put(img, 5, 9, PA2)
    put(img, 4, 10, PA2); put(img, 5, 10, PA_O)  # dark spiral eye
    # Bottom-left roll (x=3..4, y=11..12)
    put(img, 3, 11, PA3); put(img, 4, 11, PA2)
    put(img, 3, 12, PA1); put(img, 4, 12, PA_O)
    # Bottom-right roll (x=5..6, y=11..12) with crimson ribbon tie + seal dangling onto y=13!
    put(img, 5, 11, RD3); put(img, 6, 11, PA2)
    put(img, 5, 12, RD1); put(img, 6, 12, PA_O)
    put(img, 5, 13, RD2)  # crimson ribbon tail draping over shelf lip!

    # Right cubby (x=9..12, y=9..12): Pyramid of 3 scrolls + gleaming gold ribbon tie!
    put(img, 10, 9, PA3); put(img, 11, 9, PA1)
    put(img, 10, 10, GD4); put(img, 11, 10, PA_O)
    put(img, 9, 11, PA3); put(img, 10, 11, GD3)
    put(img, 9, 12, PA1); put(img, 10, 12, PA_O)
    put(img, 11, 11, PA2); put(img, 12, 11, PA1)
    put(img, 11, 12, PA1); put(img, 12, 12, PA_O)

    # --- TIER 2 (y=15..20): Full-Width 10px Map-Scroll Trough (x=3..12) ---
    # Two distinct cylindrical parchment scrolls separated by a crisp 1px dark shadow crease (y=18)!
    hline(img, 3, 12, 15, DO_O)  # deep shadow ceiling

    # Upper rolled scroll cylinder (x=4..11, y=16..17) tied with GOLD ribbon at x=8..9
    hline(img, 4, 10, 16, PA3)
    put(img, 11, 16, PA1)
    hline(img, 4, 10, 17, PA1)
    put(img, 11, 17, PA_O)       # spiral end-cap on right
    put(img, 8, 16, GD4); put(img, 9, 16, GD3)
    put(img, 8, 17, GD3); put(img, 9, 17, GD1)

    # Crisp 1px shadow separation groove between upper & lower scroll cylinders (y=18)
    hline(img, 3, 12, 18, DO0)
    put(img, 8, 18, GD2)         # gold ribbon tail tip!

    # Lower royal map scroll cylinder (x=3..12, y=19..20) tied with CRIMSON ribbon & wax seal at x=5..6!
    hline(img, 3, 11, 19, PA3)
    put(img, 12, 19, PA1)
    hline(img, 3, 11, 20, PA1)
    put(img, 12, 20, PA_O)       # dark spiral core on right end
    # Crimson ribbon + wax seal around waist (x=5..6)
    put(img, 5, 19, RD3); put(img, 6, 19, RD2)
    put(img, 5, 20, RD2); put(img, 6, 20, GD3)  # gold pin on crimson seal!
    put(img, 5, 21, RD2)                         # dangling ribbon tip over shelf!

    # --- TIER 3 (y=23..27): Twin Pigeonholes (x=3..6 coiled ends, x=9..12 upright scroll tubes) ---
    for y in range(23, 28):
        put(img, 7, y, DO3)
        put(img, 8, y, DO1)
    hline(img, 3, 6, 23, DO_O)
    hline(img, 9, 12, 23, DO_O)

    # Left cubby (x=3..6, y=24..27): 3 tightly rolled vellum scrolls with gold & red ties
    put(img, 4, 24, PA3); put(img, 5, 24, GD3)
    put(img, 4, 25, PA2); put(img, 5, 25, PA_O)
    put(img, 3, 26, PA3); put(img, 4, 26, PA2); put(img, 5, 26, PA3); put(img, 6, 26, PA1)
    put(img, 3, 27, RD2); put(img, 4, 27, PA_O); put(img, 5, 27, PA1); put(img, 6, 27, PA_O)

    # Right cubby (x=9..12, y=24..27): Two upright parchment scroll rolls tied with ribbons
    # Left upright scroll (x=9..10, y=24..27)
    put(img, 9, 24, PA3); put(img, 10, 24, PA_O)
    put(img, 9, 25, PA3); put(img, 10, 25, PA1)
    put(img, 9, 26, RD3); put(img, 10, 26, RD1)  # crimson ribbon around upright scroll!
    put(img, 9, 27, PA2); put(img, 10, 27, PA0)
    # Right upright scroll (x=11..12, y=25..27)
    put(img, 11, 25, PA3); put(img, 12, 25, PA_O)
    put(img, 11, 26, GD4); put(img, 12, 26, GD2) # gold ribbon around upright scroll!
    put(img, 11, 27, PA2); put(img, 12, 27, PA0)

    # --- C. Carved Plinth & Bracket Feet (x=1..14, y=28..30) ---
    put(img, 1, 28, DO_O)
    put(img, 2, 28, GD3)  # brass corner accent
    hline(img, 3, 9, 28, OK3)
    hline(img, 10, 12, 28, DO4)
    put(img, 13, 28, GD1)
    put(img, 14, 28, DO_O)

    put(img, 1, 29, DO_O)
    hline(img, 2, 4, 29, DO2)
    hline(img, 5, 10, 29, DO_O)  # arch cutout outline
    hline(img, 11, 13, 29, DO1)
    put(img, 14, 29, DO_O)

    # Bracket feet at y=30
    hline(img, 1, 4, 30, DO_O)
    hline(img, 11, 14, 30, DO_O)

    return img


# ===========================================================================
# 3. grimoire_cabinet.png (32x32, standing, op 28x29: x=2..29, y=2..30)
# ===========================================================================
def draw_grimoire_cabinet() -> Image.Image:
    """
    Ornate dark-oak glass-front grimoire display cabinet:
      - Standing camera: stepped crest + lit 3/4 dark-oak top band (y=2..8, 24.1% height), ZERO side walls.
      - Breakfront silhouette: stepped center pediment (x=9..22 at y=2), overhanging cornice (x=2..29 at y=3..7),
        glazed upper vitrine (x=3..28 at y=8..21), projecting beveled lower drawer chest (x=2..29 at y=22..29),
        and sculpted bracket feet (x=2..7 & x=24..29 at y=30).
      - Diagonal leaded-glass reflections across midnight-indigo vitrine panes, radiant blue/cyan
        and solar-gold arcane grimoires inside, gleaming brass lockplate/keyhole & drawer bail pulls!
    """
    img = new_canvas(32, 32)

    # Ground shadow (#4c557f @ 85)
    for x in range(8, 24):
        put_shadow(img, x, 30)
    for x in range(3, 29):
        put_shadow(img, x, 31)

    # --- A. Ornate Pediment Crest & Lit Top Band (y=2..8, 7px = 24.1% of 29px height) ---
    # y=2: Raised center pediment crest (x=9..22)
    hline(img, 9, 22, 2, DO_O)

    # y=3..6: Overhanging cornice (x=2..29)
    for y in range(3, 8):
        put(img, 2, y, DO_O)
        put(img, 29, y, DO_O)

    # y=3: Outer cornice top outline (x=3..8, 23..28) + raised lit pediment & brass crest (x=9..22)!
    hline(img, 3, 8, 3, DO_O)
    put(img, 9, 3, DO4)
    hline(img, 10, 13, 3, OK3)
    put(img, 14, 3, GD3); put(img, 15, 3, GD4); put(img, 16, 3, GD3); put(img, 17, 3, GD1)
    hline(img, 18, 21, 3, DO4)
    put(img, 22, 3, DO3)
    hline(img, 23, 28, 3, DO_O)

    # y=4..5: Polished 3/4 dark-oak top plane
    put(img, 3, 4, OK4)
    hline(img, 4, 9, 4, DO4)
    hline(img, 10, 14, 4, DO3)
    put(img, 15, 4, GD3); put(img, 16, 4, GD2)  # lower tip of brass pediment emblem
    hline(img, 17, 24, 4, DO2)
    hline(img, 25, 28, 4, DO1)

    put(img, 3, 5, DO3)
    hline(img, 4, 14, 5, DO2)
    hline(img, 15, 25, 5, DO1)
    hline(img, 26, 28, 5, DO0)

    # y=6: Molded front cornice rail with brass corner finials & carved fluting
    put(img, 3, 6, GD4); put(img, 4, 6, GD2)
    hline(img, 5, 14, 6, DO3)
    put(img, 15, 6, GD3); put(img, 16, 6, GD1)
    hline(img, 17, 26, 6, DO2)
    put(img, 27, 6, GD2); put(img, 28, 6, GD0)

    # y=7: Cornice overhang shadow lip (x=2..29)
    hline(img, 3, 28, 7, DO0)

    # --- B. Upper Glazed Vitrine Body (x=3..28, y=8..21) ---
    rect(img, 3, 8, 28, 21, DO_O)

    # Outer cabinet stiles (x=4 lit left, x=27 shaded right) & center meeting stiles (x=15..16)
    for y in range(8, 22):
        put(img, 4, y, DO3 if y < 16 else DO2)
        put(img, 27, y, DO1)
        put(img, 15, y, DO2)
        put(img, 16, y, DO0)

    # Door wood frames: Left door (x=5..14, y=9..21), Right door (x=17..26, y=9..21)
    for dx0, dx1 in ((5, 14), (17, 26)):
        hline(img, dx0, dx1, 9, DO3 if dx0 == 5 else DO2)
        hline(img, dx0, dx1, 21, DO1)
        vline(img, dx0, 9, 21, DO3 if dx0 == 5 else DO2)
        vline(img, dx1, 9, 21, DO1)

    # Deep midnight-indigo glass interior: Left pane (x=6..13, y=10..20), Right pane (x=18..25, y=10..20)
    for gx0, gx1 in ((6, 13), (18, 25)):
        rect(img, gx0, 10, gx1, 20, BL_O)
        # Subtle leaded-glass corner muntin ticks (slate/iron)
        put(img, gx0, 10, IR1); put(img, gx1, 10, IR0)
        put(img, gx0, 20, IR0); put(img, gx1, 20, IR0)
        # Inner dark-oak display shelf at y=15
        hline(img, gx0, gx1, 15, DO2)

    # --- Glowing Arcane Tomes Inside Left Glass Pane (x=6..13) ---
    # Upper shelf (y=11..14): Display-angled Radiant Azure/Cyan Grimoire (x=8..12, y=11..14)
    rect(img, 8, 11, 12, 14, BL1)
    vline(img, 8, 11, 14, BL2)
    vline(img, 12, 11, 14, BL0)
    # Glowing cyan rune sigil on front cover!
    put(img, 10, 12, TL4)  # bright #cff4f8 arcane core
    put(img, 9, 12, TL3); put(img, 11, 12, TL2)
    put(img, 10, 13, TL3); put(img, 10, 11, TL2)
    put(img, 8, 11, GD3); put(img, 12, 14, GD2)  # gold corner mounts

    # Lower shelf (y=16..20): Jewel-toned tomes + rolled scroll
    # Crimson & gold grimoire (x=7..8, y=16..19)
    rect(img, 7, 16, 8, 19, RD2)
    vline(img, 7, 16, 19, RD3)
    put(img, 7, 17, GD4); put(img, 8, 17, GD2)
    # Teal codex (x=9..10, y=17..19)
    rect(img, 9, 17, 10, 19, TL1)
    vline(img, 9, 17, 19, TL3)
    # Parchment scroll leaning at x=11..12, y=17..19
    put(img, 11, 17, PA3); put(img, 12, 18, PA2); put(img, 12, 19, PA1); put(img, 11, 18, RD2)
    # Shelf edge glint at y=20
    hline(img, 6, 13, 20, BL0)

    # --- Glowing Arcane Tomes Inside Right Glass Pane (x=18..25) ---
    # Upper shelf (y=11..14): Display-angled Gilded Solar/Crimson Grimoire (x=20..24, y=11..14)
    rect(img, 20, 11, 24, 14, RD1)
    vline(img, 20, 11, 14, RD3)
    vline(img, 24, 11, 14, RD0)
    # Glowing golden arcane sun sigil!
    put(img, 22, 12, GD4)  # bright #fff0c0 core
    put(img, 21, 12, GD3); put(img, 23, 12, FL3)
    put(img, 22, 11, GD3); put(img, 22, 13, GD2)
    put(img, 20, 11, GD3); put(img, 24, 14, GD1)

    # Lower shelf (y=16..20): Chained sapphire tome + upright emerald & plum volumes
    hline(img, 19, 22, 18, BL2)
    hline(img, 19, 22, 19, PA2)
    put(img, 20, 18, TL4)  # glowing clasp gem!
    put(img, 21, 18, GD3)
    rect(img, 23, 16, 24, 19, GR1)
    vline(img, 23, 16, 19, GR2)
    put(img, 23, 17, GD3)
    hline(img, 18, 25, 20, BL0)

    # --- Crisp 45-Degree Diagonal Leaded-Glass Reflections (drawn OVER glass interior!) ---
    # Left pane top-left double reflection streak
    put(img, 6, 12, TL4); put(img, 7, 11, TL4); put(img, 8, 10, TL3)
    put(img, 6, 14, BL2); put(img, 7, 13, TL3); put(img, 9, 10, BL2)
    # Left pane lower-right subtle reflection
    put(img, 11, 19, BL2); put(img, 12, 18, TL3)

    # Right pane top-left reflection streak
    put(img, 18, 12, TL4); put(img, 19, 11, TL3); put(img, 20, 10, BL2)
    put(img, 18, 14, BL2)
    # Right pane lower-right reflection streak
    put(img, 23, 19, BL2); put(img, 24, 18, TL3); put(img, 25, 17, BL2)

    # --- Gleaming Brass Hinges & Central Escutcheon Keyhole ---
    for hy in (11, 19):
        put(img, 4, hy, GD3); put(img, 5, hy, GD2)
        put(img, 26, hy, GD2); put(img, 27, hy, GD1)

    # Ornate brass lockplate & dark keyhole at center door stile (x=14..17, y=13..17)
    put(img, 15, 13, GD4); put(img, 16, 13, GD2)
    put(img, 14, 14, GD3); put(img, 15, 14, GD3); put(img, 16, 14, GD2); put(img, 17, 14, GD1)
    put(img, 14, 15, GD2); put(img, 15, 15, DO_O); put(img, 16, 15, GD1); put(img, 17, 15, GD0)  # keyhole!
    put(img, 15, 16, DO_O); put(img, 16, 16, GD2)                                                # keyhole slot!
    put(img, 15, 17, GD2); put(img, 16, 17, GD0)

    # --- C. Projecting Beveled Lower Drawer Chest & Bracket Feet (x=2..29, y=22..30) ---
    rect(img, 2, 22, 29, 29, DO_O)

    # y=22: Projecting waist ledge bevel (x=2..29)
    put(img, 2, 22, DO_O)
    put(img, 3, 22, OK4)
    hline(img, 4, 14, 22, OK3)
    hline(img, 15, 23, 22, DO4)
    hline(img, 24, 28, 22, DO3)
    put(img, 29, 22, DO_O)

    # y=23: Under-waist shadow rail
    hline(img, 3, 28, 23, DO1)
    put(img, 3, 23, DO3)

    # Twin 3D raised-bevel drawers: Left (x=4..14, y=24..27), Right (x=17..27, y=24..27)
    # Center divider between drawers (x=15..16)
    for y in range(23, 29):
        put(img, 3, y, DO3 if y < 27 else DO2)
        put(img, 15, y, DO2)
        put(img, 16, y, DO0)
        put(img, 28, y, DO1)

    for dx0, dx1, is_left in ((4, 14, True), (17, 27, False)):
        # Recessed shadow surround on bottom & right, bright bevel on top & left
        rect(img, dx0, 24, dx1, 27, DO2 if is_left else DO1)
        hline(img, dx0, dx1 - 1, 24, DO4 if is_left else DO3)
        vline(img, dx0, 24, 26, DO4 if is_left else DO3)
        if not is_left:
            rect(img, dx0 + 1, 25, dx1 - 1, 26, DO2)
        hline(img, dx0 + 1, dx1, 27, DO0)
        vline(img, dx1, 24, 27, DO0)
        # Gleaming brass bail pull handle centered in drawer!
        mx = (dx0 + dx1) // 2
        put(img, mx - 1, 25, GD4)
        put(img, mx, 25, GD3)
        put(img, mx + 1, 25, GD2)
        put(img, mx - 1, 26, DO_O)
        put(img, mx, 26, GD3)
        put(img, mx + 1, 26, DO_O)

    # y=28..30: Molded plinth base & carved bracket feet
    hline(img, 3, 14, 28, DO3)
    hline(img, 15, 28, 28, DO2)

    hline(img, 3, 7, 29, DO2)
    hline(img, 8, 23, 29, DO_O)   # arch apron cutout outline
    hline(img, 24, 28, 29, DO1)

    # Brass corner caps on feet (x=3..4 and x=27..28 at y=29)
    put(img, 3, 29, GD3); put(img, 4, 29, GD1)
    put(img, 27, 29, GD2); put(img, 28, 29, GD0)

    # y=30: Bracket feet
    hline(img, 2, 7, 30, DO_O)
    hline(img, 24, 29, 30, DO_O)

    return img


# ===========================================================================
# 4. reading_table_long.png (48x16, topdown, op 46x14: x=1..46, y=1..14)
# ===========================================================================
def draw_reading_table_long() -> Image.Image:
    """
    Long weathered oak library reading table (ref_base_tables_row_4x.png camera!):
      - Topdown camera:
          * Flat tabletop = y=1..11 (11px / 14px = 78.6% >= 75%)
          * Shaded carved front apron = y=12..13 (2px <= 3px)
          * Sturdy corner stub legs = y=13..14 (1-2px protrusion)
          * 100% EMPTY tabletop surface!
      - Rich 5-6 tone weathered & polished oak plank grain, breadboard end-clamps,
        top-left specular bevel highlight, and overhanging lip shadow.
    """
    img = new_canvas(48, 16)

    # Soft ground shadow (#4c557f @ 85) between legs & along floor baseline
    for x in range(7, 41):
        put_shadow(img, x, 14)
    for x in range(2, 46):
        put_shadow(img, x, 15)

    # --- A. Sculpted Rounded-Corner Tabletop Outline (x=1..46, y=1..11) ---
    hline(img, 2, 45, 1, OK_O)
    for y in range(2, 11):
        put(img, 1, y, OK_O if y < 8 else DO_O)
        put(img, 46, y, DO_O)

    # Base oak fill (x=2..45, y=2..10)
    rect(img, 2, 2, 45, 10, OK3)

    # Smooth diagonal top-left lacquer & weathered oak sheen across inner field (x=5..42, y=3..9)
    for y in range(3, 10):
        for x in range(5, 43):
            d = x + y * 3
            if d <= 20:
                put(img, x, y, OK4)
            elif d <= 36:
                put(img, x, y, OK3)
            elif d <= 48:
                put(img, x, y, DO4 if y >= 7 else OK3)
            else:
                put(img, x, y, OK2 if y <= 6 else DO3)

    # Breadboard end-clamps on left (x=2..4) and right (x=43..45) — smooth flush refectory joinery!
    # Left breadboard end (bright top-left light)
    put(img, 2, 2, OK5)
    vline(img, 2, 3, 6, OK5)
    vline(img, 2, 7, 9, OK4)
    vline(img, 3, 3, 6, OK4)
    vline(img, 3, 7, 9, OK3)
    vline(img, 4, 3, 9, OK2)  # flush mortise seam between breadboard & long planks

    # Right breadboard end (warm shaded side)
    vline(img, 43, 3, 9, OK1)  # flush mortise seam
    vline(img, 44, 3, 6, OK3)
    vline(img, 44, 7, 9, OK2)
    vline(img, 45, 3, 5, OK2)
    vline(img, 45, 6, 9, OK1)

    # Glowing top perimeter bevel along y=2 (x=2..45)
    put(img, 2, 2, OK5)
    hline(img, 3, 14, 2, OK5)
    hline(img, 15, 29, 2, OK4)
    hline(img, 30, 41, 2, OK3)
    hline(img, 42, 44, 2, OK2)
    put(img, 45, 2, OK1)

    # Two calm long-grain oak plank seams (y=5 and y=8) across x=5..42
    for x in range(5, 43):
        if x not in (9, 10, 11, 12):
            put(img, x, 5, OK2 if x < 28 else OK1)
        if x not in (16, 17, 18, 19):
            put(img, x, 8, OK2 if x < 24 else OK1)

    # Polished wood-grain highlight ribbons hugging plank edges (smooth, calm, zero noise!)
    hline(img, 6, 16, 4, OK5)
    hline(img, 17, 26, 4, OK4)
    hline(img, 8, 19, 6, OK4)
    hline(img, 20, 31, 6, OK3)
    hline(img, 6, 15, 9, OK4)
    hline(img, 25, 35, 7, OK3)

    # Front bullnose lip of tabletop (y=10) catching secondary warm rim light
    put(img, 2, 10, OK4)
    hline(img, 3, 14, 10, OK4)
    hline(img, 15, 30, 10, OK3)
    hline(img, 31, 41, 10, OK2)
    hline(img, 42, 45, 10, OK1)

    # y=11: Deep under-lip overhang shadow line (x=1..46)
    put(img, 1, 11, DO_O)
    hline(img, 2, 20, 11, DO1)
    hline(img, 21, 45, 11, DO0)
    put(img, 46, 11, DO_O)

    # --- B. Carved Front Apron (y=12..13, 2px <= 3px!) stepped in 1px (x=2..45) ---
    put(img, 2, 12, DO_O)
    hline(img, 3, 15, 12, OK1)
    hline(img, 16, 32, 12, OK0)
    hline(img, 33, 44, 12, DO1)
    # Subtle carved apron relief highlights & brass corner brackets
    put(img, 4, 12, GD2); put(img, 5, 12, OK2)
    hline(img, 9, 14, 12, OK2)
    hline(img, 21, 26, 12, OK1)
    put(img, 43, 12, GD1)
    put(img, 45, 12, DO_O)

    # Bottom outline of apron (y=13)
    hline(img, 2, 45, 13, DO_O)

    # --- C. Crisp Corner Stub Legs (y=13..14, left x=3..6, right x=41..44) ---
    # Left stub leg
    put(img, 3, 13, DO_O)
    put(img, 4, 13, OK2)
    put(img, 5, 13, OK0)
    put(img, 6, 13, DO_O)
    hline(img, 3, 6, 14, DO_O)

    # Right stub leg
    put(img, 41, 13, DO_O)
    put(img, 42, 13, OK1)
    put(img, 43, 13, DO1)
    put(img, 44, 13, DO_O)
    hline(img, 41, 44, 14, DO_O)

    return img


# ===========================================================================
# 5. study_table_round.png (32x32, topdown, op 26x26: x=3..28, y=4..29)
# ===========================================================================
def draw_study_table_round() -> Image.Image:
    """
    Sculpted circular oak study table (ref_ez_row_4x.png round pedestal table camera!):
      - Topdown camera:
          * Opaque bbox = 26x26 (x=3..28, y=4..29, bottom_margin=2, centered!)
          * Flat circular tabletop = y=4..23 (20px / 26px = 76.9% >= 75%!)
          * Curved shaded front rim = y=24..25 (2px <= 3px!)
          * Turned central oak pedestal & splayed claw-foot peek below = y=26..29
          * 100% EMPTY surface!
      - Hand-crafted pixel-clean elliptical spans (zero jaggies!), beveled rim highlight,
        inlaid router groove, and rich 5-tone oak plank grain.
    """
    img = new_canvas(32, 32)

    # Soft elliptical ground shadow (#4c557f @ 85) around pedestal base (y=28..30)
    for y, (sx0, sx1) in ((28, (8, 23)), (29, (7, 24)), (30, (9, 22))):
        for x in range(sx0, sx1 + 1):
            put_shadow(img, x, y)

    # --- A. Turned Pedestal Column & Curved Splayed Feet Peek (y=25..29) ---
    # Drawn first so overhanging circular tabletop + 2px front rim cleanly sit over top!
    # Central turned column (x=13..18, y=25..28)
    rect(img, 13, 25, 18, 28, DO_O)
    for y in range(25, 29):
        put(img, 14, y, OK2 if y == 26 else OK1)
        put(img, 15, y, OK3 if y == 26 else OK1)
        put(img, 16, y, OK0)
        put(img, 17, y, DO1)
    # Turned brass/oak collar ring at y=26
    put(img, 14, 26, GD3); put(img, 15, 26, OK3); put(img, 16, 26, GD1)

    # Splayed tripod feet peeking left (x=10..13), center-front, and right (x=18..21) at y=27..29
    hline(img, 11, 20, 27, DO_O)
    put(img, 13, 27, OK2)
    put(img, 14, 27, OK2); put(img, 15, 27, OK1); put(img, 16, 27, OK0); put(img, 17, 27, DO1)
    put(img, 18, 27, DO1)

    hline(img, 10, 21, 28, DO_O)
    put(img, 11, 28, OK3); put(img, 12, 28, OK2)  # lit left splayed foot!
    put(img, 15, 28, OK2); put(img, 16, 28, OK0)  # center front toe!
    put(img, 19, 28, OK1); put(img, 20, 28, DO2)  # shaded right splayed foot!

    # Bottom foot outlines at y=29 (left toe x=10..13, center toe x=15..16, right toe x=18..21)
    hline(img, 10, 13, 29, DO_O)
    hline(img, 15, 16, 29, DO_O)
    hline(img, 18, 21, 29, DO_O)

    # --- B. Hand-Sculpted Pixel-Clean Elliptical Tabletop (y=4..23, 26x20) + 2px Front Rim (y=24..25) ---
    # Exact symmetric horizontal spans [x0, x1] for smooth anti-jaggy pixel curve (width 26: x=3..28):
    top_spans: dict[int, tuple[int, int]] = {
        4:  (11, 20),  # 10px
        5:  (8, 23),   # 16px
        6:  (6, 25),   # 20px
        7:  (5, 26),   # 22px
        8:  (4, 27),   # 24px
        9:  (4, 27),   # 24px
        10: (3, 28),   # 26px
        11: (3, 28),
        12: (3, 28),
        13: (3, 28),
        14: (3, 28),
        15: (3, 28),
        16: (3, 28),
        17: (3, 28),
        18: (4, 27),   # 24px
        19: (4, 27),   # 24px
        20: (5, 26),   # 22px
        21: (6, 25),   # 20px
        22: (8, 23),   # 16px
        23: (11, 20),  # 10px
    }

    # First draw the 2px curved front apron/underside rim shifted +1..+2px down on the lower half!
    for y_src in range(13, 24):
        x0, x1 = top_spans[y_src]
        for dy, shade_l, shade_r in ((1, OK1, DO2), (2, DO1, DO_O)):
            yy = y_src + dy
            for x in range(x0, x1 + 1):
                if x == x0 or x == x1 or dy == 2:
                    put(img, x, yy, DO_O)
                else:
                    put(img, x, yy, shade_l if x < 16 else shade_r)
    # Extra crisp warm rim shade inside y=24 along bottom arc (x=9..22)
    for x in range(9, 23):
        if x in (9, 10, 21, 22):
            put(img, x, 24, DO0)
        else:
            put(img, x, 24, OK1 if x < 15 else (OK0 if x < 19 else DO1))

    # Now paint the flat circular tabletop (y=4..23)
    cx, cy = 15.5, 13.5
    for y, (x0, x1) in top_spans.items():
        for x in range(x0, x1 + 1):
            # Check if this pixel is on the 1px outer perimeter of the tabletop ellipse
            is_top_or_bot = (y == 4 or y == 23)
            above_span = top_spans.get(y - 1)
            below_span = top_spans.get(y + 1)
            is_outer = (
                is_top_or_bot
                or x == x0
                or x == x1
                or (above_span is not None and (x < above_span[0] or x > above_span[1]))
                or (below_span is not None and (x < below_span[0] or x > below_span[1]))
            )
            if is_outer:
                # Top-left outer outline uses warm dark oak OK_O; bottom-right uses deep DO_O
                # (On lower edge y>=18 where front apron continues below, y=23 acts as crisp dark under-lip!)
                out_c = OK_O if (x + y < 29 and y < 19) else DO_O
                put(img, x, y, out_c)
                continue

            # Normalized radial distance inside tabletop for molded rim bevel + inlaid router ring
            nx = (x - cx) / 11.8
            ny = (y - cy) / 9.0
            r2 = nx * nx + ny * ny
            diag = (x - 4) + (y - 4) * 1.4

            if r2 >= 0.74:
                # Outer sculpted bullnose rim highlight!
                if diag < 11:
                    put(img, x, y, OK5)
                elif diag < 19:
                    put(img, x, y, OK4)
                elif diag < 27:
                    put(img, x, y, OK3)
                else:
                    put(img, x, y, OK2)
            elif 0.60 <= r2 < 0.74:
                # Subtle circular inlaid router groove separating rim from planked center!
                put(img, x, y, OK2 if diag < 21 else OK1)
            else:
                # Smooth 5-tone polished oak center panel (EMPTY surface!)
                if diag < 12:
                    put(img, x, y, OK4)
                elif diag < 21:
                    put(img, x, y, OK3)
                elif diag < 27:
                    put(img, x, y, DO4)
                else:
                    put(img, x, y, OK2)

    # Delicate horizontal oak plank seams + adjacent grain highlights inside center panel (r2 < 0.58)
    for py in (9, 13, 17):
        for x in range(6, 26):
            nx = (x - cx) / 11.8
            ny = (py - cy) / 9.0
            if nx * nx + ny * ny < 0.56:
                put(img, x, py, OK3 if (10 <= x <= 12 and py == 13) else (OK2 if x < 18 else OK1))
                # Subtle bright grain ribbon 1px below seam on lit left side
                if x < 16 and (nx * nx + ((py + 1 - cy) / 9.0) ** 2) < 0.54:
                    put(img, x, py + 1, OK5 if (py == 9 and x < 13) else OK4)

    return img


# ===========================================================================
# Strict Validation & Preview Sheet Builder
# ===========================================================================
ALLOWED_OUTLINES = {DO_O, DO0, OK_O, IR_O, SL_O, GD_O}


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
    opaque_xs = []
    opaque_ys = []
    used_colors = set()
    shadow_px = 0

    for y in range(img.height):
        for x in range(img.width):
            rgba = img.getpixel((x, y))
            r, g, b, a = rgba
            if a == 0:
                continue
            if a == 85:
                if rgba != SHADOW_RGBA:
                    bad_alpha.append((x, y, rgba))
                shadow_px += 1
                continue
            if a != 255:
                bad_alpha.append((x, y, rgba))
                continue

            hx = rgba_to_hex(rgba)
            used_colors.add(hx)
            opaque_xs.append(x)
            opaque_ys.append(y)

            if hx not in palette or hx == "#000000":
                off_palette.append((x, y, hx))

            # Every opaque pixel touching transparency or shadow (4-connected) must be a dark material outline!
            is_boundary = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if nx < 0 or nx >= img.width or ny < 0 or ny >= img.height:
                    is_boundary = True
                    break
                if img.getpixel((nx, ny))[3] < 255:
                    is_boundary = True
                    break
            if is_boundary and hx not in ALLOWED_OUTLINES:
                bad_outline.append((x, y, hx))

    min_x, max_x = min(opaque_xs), max(opaque_xs)
    min_y, max_y = min(opaque_ys), max(opaque_ys)
    op_w = max_x - min_x + 1
    op_h = max_y - min_y + 1
    bottom_margin = img.height - 1 - max_y
    left_margin = min_x
    right_margin = img.width - 1 - max_x

    assert not off_palette, f"{name}: off-palette pixels: {off_palette[:5]}"
    assert not bad_alpha, f"{name}: invalid alpha/shadow pixels: {bad_alpha[:5]}"
    assert not bad_outline, f"{name}: non-dark outer outline pixels: {bad_outline[:10]}"
    assert target_w[0] <= op_w <= target_w[1], f"{name}: opaque width {op_w} outside {target_w}"
    assert target_h[0] <= op_h <= target_h[1], f"{name}: opaque height {op_h} outside {target_h}"
    assert 1 <= bottom_margin <= 2, f"{name}: bottom margin {bottom_margin} not in 1..2"
    assert abs(left_margin - right_margin) <= 1, (
        f"{name}: not centered (left={left_margin}, right={right_margin})"
    )

    return {
        "name": name,
        "canvas": f"{img.width}x{img.height}",
        "opaque_bbox": f"{op_w}x{op_h}",
        "margins_ltrb": (left_margin, min_y, right_margin, bottom_margin),
        "unique_colors": len(used_colors),
        "shadow_px": shadow_px,
    }


def build_contact_sheet(sprites: list[tuple[str, str, Image.Image]], stats: list[dict]) -> None:
    """Render 2x + 1x side-by-side on #767670 gray next to 1x/2x Beodeul character."""
    BG = (0x76, 0x76, 0x70, 255)
    CARD_BORDER = (92, 92, 86, 255)
    HEADER_BG = (104, 104, 98, 255)
    TEXT_MAIN = (242, 242, 238, 255)
    TEXT_SUB = (208, 208, 198, 255)

    raw_char = Image.open(CHAR_REF_4X).convert("RGBA")
    char_1x = raw_char.resize((raw_char.width // 4, raw_char.height // 4), Image.Resampling.NEAREST)
    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.Resampling.NEAREST)

    sheet_w = 820
    sheet_h = 390
    sheet = Image.new("RGBA", (sheet_w, sheet_h), BG)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    # Header bar
    draw.rectangle([12, 12, sheet_w - 13, 88], fill=HEADER_BG, outline=CARD_BORDER)
    draw.text(
        (24, 22),
        "fantasy_wizard_library_carbon - Batch 1/4 Bookcases & Tables (2x + 1x on #767670)",
        fill=TEXT_MAIN,
        font=font,
    )
    draw.text(
        (24, 40),
        "Palette: palette_beodeul_library.json (70 locked, 0 off-palette, 0 #000000) | Shadow: #4c557f@85",
        fill=TEXT_SUB,
        font=font,
    )
    draw.text(
        (24, 58),
        "Scale Ref: Beodeul 22x25 char (170cm) shown in header & beside every sprite | 1px Dark Outlines: PASS",
        fill=TEXT_SUB,
        font=font,
    )

    sheet.alpha_composite(char_2x, (sheet_w - 134, 18))
    draw.text((sheet_w - 118, 72), "2x", fill=TEXT_SUB, font=font)
    sheet.alpha_composite(char_1x, (sheet_w - 64, 43))
    draw.text((sheet_w - 58, 72), "1x", fill=TEXT_SUB, font=font)

    card_w, card_h = 258, 134
    positions = [
        (12, 102),
        (281, 102),
        (550, 102),
        (12, 246),
        (281, 246),
    ]

    for idx, ((name, cam, sp), st) in enumerate(zip(sprites, stats)):
        cx, cy = positions[idx]
        draw.rectangle([cx, cy, cx + card_w, cy + card_h], fill=BG, outline=CARD_BORDER)
        baseline_y = cy + 88
        draw.line([(cx + 10, baseline_y + 1), (cx + card_w - 10, baseline_y + 1)], fill=CARD_BORDER)

        sp_2x = sp.resize((sp.width * 2, sp.height * 2), Image.Resampling.NEAREST)
        x2 = cx + 62 - sp_2x.width // 2
        y2 = baseline_y - sp_2x.height
        sheet.alpha_composite(sp_2x, (x2, y2))

        x1 = cx + 166 - sp.width // 2
        y1 = baseline_y - sp.height
        sheet.alpha_composite(sp, (x1, y1))

        # 1x Beodeul char right next to 1x sprite
        sheet.alpha_composite(char_1x, (cx + 216, baseline_y - char_1x.height + 1))

        draw.text((cx + 10, cy + 96), f"{idx + 1}. {name}", fill=TEXT_MAIN, font=font)
        draw.text(
            (cx + 10, cy + 112),
            f"[{cam}] {st['canvas']} (op {st['opaque_bbox']}, {st['unique_colors']}c, shd {st['shadow_px']})",
            fill=TEXT_SUB,
            font=font,
        )

    # 6th slot: True 1x Library Lineup vs 22x25 Beodeul Character
    lx, ly = (550, 246)
    draw.rectangle([lx, ly, lx + card_w, ly + card_h], fill=BG, outline=CARD_BORDER)
    base_1x = ly + 88
    draw.line([(lx + 8, base_1x + 1), (lx + card_w - 8, base_1x + 1)], fill=CARD_BORDER)
    cur_x = lx + 10
    sheet.alpha_composite(char_1x, (cur_x, base_1x - char_1x.height + 1))
    cur_x += char_1x.width + 6
    for _, _, sp in sprites:
        sheet.alpha_composite(sp, (cur_x, base_1x - sp.height))
        cur_x += sp.width + 6
    draw.text((lx + 10, ly + 96), "True 1x Lineup vs Beodeul Char", fill=TEXT_MAIN, font=font)
    draw.text((lx + 10, ly + 112), "Instant silhouette, palette & scale check", fill=TEXT_SUB, font=font)

    PREVIEW_PNG.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW_PNG)


def main() -> None:
    palette = load_palette()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    specs = [
        ("bookshelf_tall_full.png",   "standing", draw_bookshelf_tall_full(),   (32, 32), (27, 29), (29, 30)),
        ("bookshelf_scroll_rack.png", "standing", draw_bookshelf_scroll_rack(), (16, 32), (13, 15), (29, 30)),
        ("grimoire_cabinet.png",      "standing", draw_grimoire_cabinet(),      (32, 32), (27, 29), (28, 30)),
        ("reading_table_long.png",    "topdown",  draw_reading_table_long(),    (48, 16), (45, 47), (13, 15)),
        ("study_table_round.png",     "topdown",  draw_study_table_round(),     (32, 32), (25, 27), (25, 27)),
    ]

    stats = []
    rendered = []
    for fname, cam, img, canvas_wh, tw, th in specs:
        st = validate_sprite(fname, img, canvas_wh, tw, th, palette)
        out_path = OUT_DIR / fname
        img.save(out_path)
        stats.append(st)
        rendered.append((fname.replace(".png", ""), cam, img))
        print(
            f"PASS {fname:26s} | canvas={st['canvas']:5s} | opaque={st['opaque_bbox']:5s} "
            f"| margins={st['margins_ltrb']} | colors={st['unique_colors']:2d} | shadow_px={st['shadow_px']}"
        )

    build_contact_sheet(rendered, stats)
    print(f"Wrote contact sheet -> {PREVIEW_PNG}")


if __name__ == "__main__":
    main()
