#!/usr/bin/env python3
"""
Batch 4/4: Museum-Grade Beodeul Ancient Ruins Courtyard Props & Loot (`fantasy_sky_ruins_carbon`)
Sprites:
  1. treasure_chest_ancient.png (16x16, standing, op 14x13)
  2. wooden_crates_supply.png   (32x32, standing, op 28x27)
  3. wooden_bench_garden.png    (32x16, topdown,  op 30x13)
  4. stone_offering_table.png   (32x16, topdown,  op 30x13)
  5. wooden_notice_board.png    (32x32, standing, op 26x28)

Strict enforcement:
  - 100% locked to `palette_beodeul_ruins.json` (74 colors, zero #000000)
  - Ground shadow strictly #4c557f @ alpha 85; all other pixels alpha 0 or 255
  - 1px dark material-matched outer outline on every boundary pixel touching transparency/shadow
  - Camera discipline:
      * standing: front face + 1/4..1/3 lit top band, ZERO side walls
      * topdown:  flat top >= 75%, front <= 3px, stub legs, EMPTY top
"""

from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
PALETTE_JSON = ROOT / "tiledata/dungeon-dots/fantasy_sky_ruins/palette_beodeul_ruins.json"
CHAR_REF_4X = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs/ref_beodeul_char_4x.png"
OLD_OBJS_DIR = ROOT / "tiledata/dungeon-dots/fantasy_sky_ruins/objects"
OUT_DIR = ROOT / "tiledata/dungeon-dots/fantasy_sky_ruins_carbon/objects"
PREVIEW_PNG = ROOT / "tiledata/dungeon-dots/fantasy_sky_ruins_carbon/preview_batch4.png"

SHADOW_RGBA = (0x4C, 0x55, 0x7F, 85)
TRANSPARENT = (0, 0, 0, 0)

# Strictly locked Beodeul 74-color ramp aliases (every hex verified against palette_beodeul_ruins.json)
# Wood Oak (8)
O0 = "#291c13"  # darkest wood outline (luma 30.2)
O1 = "#452a17"  # deep oak crevice shadow
O2 = "#583a24"  # oak shadow
O3 = "#6f4725"  # oak mid-dark
O4 = "#8c6038"  # oak warm mid
O5 = "#a67d55"  # oak light
O6 = "#bd936b"  # oak highlight
O7 = "#d8aa73"  # sunlit oak bevel highlight

# Iron / Bronze (5)
I0 = "#1c1c26"  # darkest forged iron outline (luma 29.1)
I1 = "#30384a"  # dark wrought iron
I2 = "#4e5a6b"  # mid iron
I3 = "#72808a"  # lit steel edge
I4 = "#a0a2ac"  # crisp 1px iron specular rivet/shine

# Limestone (9) & Wet Dark Slate (5)
S0 = "#262729"  # darkest limestone outline (luma 38.9)
S1 = "#3e403d"  # deep carved stone shadow
S2 = "#595b58"  # stone shadow
S3 = "#767776"  # stone dark-mid
S4 = "#929491"  # stone mid
S5 = "#afb1ae"  # stone light-mid
S6 = "#c4c6c3"  # stone light
S7 = "#dadcd9"  # stone highlight
S8 = "#e5e7e4"  # stone bright top-left specular
D0 = "#2b3436"  # dark wet slate outline (luma 49.5)
D1 = "#40484a"  # wet slate deep
D2 = "#5b6667"  # wet slate mid

# Crystal Cyan (7) & Water Teal
C0 = "#143c36"  # dark cyan outline
C1 = "#27696c"  # deep rune/gem facet
C2 = "#3fa2ae"  # mid cyan glow
C3 = "#84c8ce"  # bright cyan rune
C4 = "#9ce0ee"  # luminous cyan
C5 = "#cff4f8"  # core cyan light
C6 = "#f2ffff"  # pure white-cyan spark
W3 = "#21584e"  # deep sanctuary teal inlay

# Canvas / Parchment / Rope (6)
P0 = "#59503a"  # dark ink / rope shadow
P1 = "#827869"  # ink line / rope mid-dark
P2 = "#a69a77"  # tan rope / aged parchment curl
P3 = "#c2bca7"  # parchment mid
P4 = "#d9d2be"  # parchment light / rope twist
P5 = "#f0e7cc"  # sunlit crisp parchment

# Accents: Crimson Wax & Antique Gold (11)
R0 = "#491d20"  # dark crimson/gold-shadow outline (luma 42.5)
R1 = "#76302f"  # wax seal deep crimson
R2 = "#863736"  # wax seal mid
R3 = "#b9422c"  # bright crimson wax seal
K1 = "#d97163"  # wax specular glint
E1 = "#df722f"  # warm burnished bronze-gold
E2 = "#f08a10"  # rich amber gold
Y1 = "#dc9a26"  # antique gold mid
Y2 = "#fbc10d"  # bright antique gold
Y3 = "#fff2a5"  # 1px gold specular shine

# Foliage / Moss (6)
F0 = "#1d2d19"  # dark moss outline (luma 39.2)
F1 = "#2d4619"  # deep moss shadow
F2 = "#3d5e24"  # moss mid-shadow
F3 = "#5c7728"  # moss mid
F4 = "#8eac43"  # sunlit moss highlight
F5 = "#a8ca5c"  # bright moss tip

ALLOWED_DARK_OUTLINES = {O0, I0, S0, D0, F0, C0, R0}


def hex_to_rgba(h: str, alpha: int = 255) -> tuple[int, int, int, int]:
    h = h.lstrip("#").lower()
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


def rgba_to_hex(rgba: tuple[int, int, int, int]) -> str:
    return f"#{rgba[0]:02x}{rgba[1]:02x}{rgba[2]:02x}"


def luma(rgba: tuple[int, int, int, int]) -> float:
    return 0.299 * rgba[0] + 0.587 * rgba[1] + 0.114 * rgba[2]


def load_palette() -> set[str]:
    data = json.loads(PALETTE_JSON.read_text(encoding="utf-8"))
    colors = {c.lower() for c in data["colors"]}
    assert len(colors) == 74, f"Expected 74 Beodeul palette colors, got {len(colors)}"
    assert "#000000" not in colors, "Forbidden #000000 in palette"
    return colors


def new_canvas(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), TRANSPARENT)


def put(img: Image.Image, x: int, y: int, color: str | tuple[int, int, int, int]) -> None:
    if 0 <= x < img.width and 0 <= y < img.height:
        rgba = hex_to_rgba(color) if isinstance(color, str) else color
        img.putpixel((x, y), rgba)


def hline(img: Image.Image, x0: int, x1: int, y: int, color: str | tuple[int, int, int, int]) -> None:
    for x in range(min(x0, x1), max(x0, x1) + 1):
        put(img, x, y, color)


def vline(img: Image.Image, x: int, y0: int, y1: int, color: str | tuple[int, int, int, int]) -> None:
    for y in range(min(y0, y1), max(y0, y1) + 1):
        put(img, x, y, color)


def rect(img: Image.Image, x0: int, y0: int, x1: int, y1: int, color: str | tuple[int, int, int, int]) -> None:
    for y in range(min(y0, y1), max(y0, y1) + 1):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            put(img, x, y, color)


# ---------------------------------------------------------------------------
# 1. treasure_chest_ancient.png (16x16, standing, op 14x13: x=1..14, y=2..14)
# ---------------------------------------------------------------------------
def draw_treasure_chest_ancient() -> Image.Image:
    """
    Ornate ancient sanctuary treasure chest (14x13 opaque in 16x16):
      - Standing camera: vaulted weathered-oak top lid band (y=2..6, ~38%), front body (y=7..14), ZERO side walls.
      - Domed oak lid shaded cylindrically from top-left (#d8aa73 -> #bd936b -> #a67d55 -> #6f4725).
      - Heavy forged iron + antique-gold vertical bands (x=3..4 and x=11..12) with 1px #fff2a5 & #a0a2ac specular glints.
      - Ornate gold shield clasp (x=6..9, y=5..10) cradling a glowing faceted cyan sanctuary gem (#f2ffff -> #9ce0ee -> #3fa2ae).
      - Forged iron corner brackets & sculpted feet on y=13..14.
    """
    img = new_canvas(16, 16)

    # Soft ground shadow (#4c557f @ 85) under recessed center & bottom base
    hline(img, 5, 10, 14, SHADOW_RGBA)
    hline(img, 2, 13, 15, SHADOW_RGBA)

    # --- Domed Lid Silhouette & Oak Planks (y=2..6) ---
    # y=2: Vaulted dome top outline (x=3..12) — rounded upper corners!
    hline(img, 3, 4, 2, I0)
    hline(img, 5, 10, 2, O0)
    hline(img, 11, 12, 2, I0)

    # y=3: Curved upper dome shoulder (x=2..13) — sunlit oak crown + gleaming gold/iron straps
    put(img, 2, 3, O0)
    put(img, 3, 3, Y3)   # 1px crisp gold specular shine on left strap crest!
    put(img, 4, 3, Y2)
    put(img, 5, 3, O7)   # sunlit oak crown left
    put(img, 6, 3, O7)
    put(img, 7, 3, O6)
    put(img, 8, 3, O6)
    put(img, 9, 3, O5)
    put(img, 10, 3, O5)  # oak crown right
    put(img, 11, 3, Y2)  # lit antique-gold right strap crest
    put(img, 12, 3, Y1)
    put(img, 13, 3, O0)

    # y=4: Full width upper lid curve (x=1..14)
    put(img, 1, 4, O0)
    put(img, 2, 4, O6)
    put(img, 3, 4, Y2)   # left gold/iron strap
    put(img, 4, 4, I3)   # forged steel inner edge glint
    put(img, 5, 4, O6)
    put(img, 6, 4, O6)
    put(img, 7, 4, O5)
    put(img, 8, 4, O5)
    put(img, 9, 4, O4)
    put(img, 10, 4, O4)
    put(img, 11, 4, Y1)  # right gold/iron strap
    put(img, 12, 4, I2)
    put(img, 13, 4, O4)
    put(img, 14, 4, O0)

    # y=5: Lower dome curve + top of ornate gold clasp (x=1..14)
    put(img, 1, 5, O0)
    put(img, 2, 5, O4)
    put(img, 3, 5, Y1)
    put(img, 4, 5, I2)
    put(img, 5, 5, O3)
    # Clasp upper bezel (x=6..9)
    put(img, 6, 5, Y3)   # crisp 1px specular shine on clasp top-left!
    put(img, 7, 5, Y2)
    put(img, 8, 5, Y2)
    put(img, 9, 5, Y1)
    put(img, 10, 5, O2)
    put(img, 11, 5, E1)
    put(img, 12, 5, I1)
    put(img, 13, 5, O2)
    put(img, 14, 5, O0)

    # y=6: Heavy lid overhang rim + deep shadow seam + glowing cyan gem upper facets
    put(img, 1, 6, I0)
    put(img, 2, 6, I3)   # iron corner rim glint
    put(img, 3, 6, I4)   # 1px crisp iron rivet specular on left band!
    put(img, 4, 6, I1)
    put(img, 5, 6, O0)   # deep lid overhang shadow
    put(img, 6, 6, Y2)   # gold bezel left
    put(img, 7, 6, C6)   # pure white-cyan gem spark!
    put(img, 8, 6, C4)   # bright cyan gem facet
    put(img, 9, 6, Y1)   # gold bezel right
    put(img, 10, 6, O0)  # deep lid overhang shadow
    put(img, 11, 6, I3)  # right band rivet highlight
    put(img, 12, 6, I1)
    put(img, 13, 6, I2)
    put(img, 14, 6, I0)

    # --- Front Chest Body (y=7..14) ---
    # y=7: Under-lid cast shadow on oak + radiant cyan gem core
    put(img, 1, 7, O0)
    put(img, 2, 7, O2)
    put(img, 3, 7, Y1)
    put(img, 4, 7, I1)
    put(img, 5, 7, O1)
    put(img, 6, 7, Y2)   # gold bezel left
    put(img, 7, 7, C4)   # luminous cyan gem heart
    put(img, 8, 7, C2)   # mid-deep cyan facet
    put(img, 9, 7, E1)   # shaded gold bezel right
    put(img, 10, 7, O1)
    put(img, 11, 7, E1)
    put(img, 12, 7, I1)
    put(img, 13, 7, O1)
    put(img, 14, 7, O0)

    # y=8: Upper front oak plank + lower cyan gem facet
    put(img, 1, 8, O0)
    put(img, 2, 8, O5)
    put(img, 3, 8, Y2)
    put(img, 4, 8, I2)
    put(img, 5, 8, O4)
    put(img, 6, 8, Y1)
    put(img, 7, 8, C3)   # lower cyan glow
    put(img, 8, 8, C1)   # deep teal-cyan gem base
    put(img, 9, 8, O3)
    put(img, 10, 8, O3)
    put(img, 11, 8, Y1)
    put(img, 12, 8, I1)
    put(img, 13, 8, O3)
    put(img, 14, 8, O0)

    # y=9: Mid front oak plank + ornate clasp bottom shield tip
    put(img, 1, 9, O0)
    put(img, 2, 9, O4)
    put(img, 3, 9, Y1)
    put(img, 4, 9, I2)
    put(img, 5, 9, O4)
    put(img, 6, 9, O2)
    put(img, 7, 9, Y2)   # gold clasp tip highlight
    put(img, 8, 9, E1)   # gold clasp tip shadow
    put(img, 9, 9, O2)
    put(img, 10, 9, O3)
    put(img, 11, 9, E1)
    put(img, 12, 9, I1)
    put(img, 13, 9, O2)
    put(img, 14, 9, O0)

    # y=10: Crisp horizontal oak plank seam + iron strap rivets
    put(img, 1, 10, O0)
    put(img, 2, 10, O1)
    put(img, 3, 10, I4)  # 1px bright iron rivet glint
    put(img, 4, 10, I1)
    put(img, 5, 10, O1)
    put(img, 6, 10, O1)
    put(img, 7, 10, O0)  # shadow under clasp tip
    put(img, 8, 10, O0)
    put(img, 9, 10, O1)
    put(img, 10, 10, O1)
    put(img, 11, 10, I3) # right strap rivet
    put(img, 12, 10, I1)
    put(img, 13, 10, O1)
    put(img, 14, 10, O0)

    # y=11: Lower oak plank catching secondary top-edge light
    put(img, 1, 11, O0)
    put(img, 2, 11, O5)
    put(img, 3, 11, Y1)
    put(img, 4, 11, I2)
    put(img, 5, 11, O5)
    put(img, 6, 11, O4)
    put(img, 7, 11, O4)
    put(img, 8, 11, O3)
    put(img, 9, 11, O3)
    put(img, 10, 11, O3)
    put(img, 11, 11, E1)
    put(img, 12, 11, I1)
    put(img, 13, 11, O2)
    put(img, 14, 11, O0)

    # y=12: Heavy wrought-iron base corner brackets & lower oak shadow
    put(img, 1, 12, I0)
    put(img, 2, 12, I3)  # left iron corner bracket highlight
    put(img, 3, 12, Y1)
    put(img, 4, 12, I2)
    put(img, 5, 12, O3)
    put(img, 6, 12, O2)
    put(img, 7, 12, O2)
    put(img, 8, 12, O2)
    put(img, 9, 12, O1)
    put(img, 10, 12, O2)
    put(img, 11, 12, E1)
    put(img, 12, 12, I1)
    put(img, 13, 12, I2) # right iron corner bracket
    put(img, 14, 12, I0)

    # y=13: Bottom iron-bound rail + center arch outline so bracket feet read crisply!
    put(img, 1, 13, I0)
    put(img, 2, 13, I2)
    put(img, 3, 13, I3)
    put(img, 4, 13, I1)
    hline(img, 5, 10, 13, O0)  # dark bottom outline of recessed chest belly
    put(img, 11, 13, I2)
    put(img, 12, 13, I1)
    put(img, 13, 13, I1)
    put(img, 14, 13, I0)

    # y=14: Sturdy iron-shod corner bracket feet (x=1..4 and x=11..14)
    hline(img, 1, 4, 14, I0)
    hline(img, 11, 14, 14, I0)

    return img


# ---------------------------------------------------------------------------
# 2. wooden_crates_supply.png (32x32, standing, op 28x27: x=2..29, y=3..29)
# ---------------------------------------------------------------------------
def _draw_crate(
    img: Image.Image,
    x0: int,
    y0: int,
    w: int,
    h: int,
    brace_mode: str,
    shaded_top_from_above: bool = False,
) -> None:
    """
    Draw one volumetric Beodeul oak supply crate (`ref_beodeul_props_best_4x.png` quality):
      - Standing 3/4 view: 4px lit top plank band (y0..y0+3), front framed face (y0+4..y1), ZERO side walls!
      - Raised 2px outer timber frame casting 1px recess shadow onto horizontal inner planks.
      - Crisp diagonal cross-brace ('x', 'backslash', or 'slash'), dark plank seams, and forged iron corner nails.
    """
    x1 = x0 + w - 1
    y1 = y0 + h - 1

    # 1. Outer silhouette dark wood outline
    rect(img, x0, y0, x1, y1, O0)

    # 2. Lit 3/4 Top Lid Band (y0+1 .. y0+3, 3 inner rows + top/seam outlines = ~28% height)
    # Row y0+1: sunlit back-top bevel
    for x in range(x0 + 1, x1):
        t = (x - x0) / max(1, w - 1)
        put(img, x, y0 + 1, O7 if t < 0.55 else O6)
    # Row y0+2: horizontal top plank seam & grain
    for x in range(x0 + 1, x1):
        if (x - x0) in (4, w - 5):
            put(img, x, y0 + 2, O3)  # subtle plank joint tick
        else:
            put(img, x, y0 + 2, O4 if (x - x0) % 2 == 0 else O5)
    # Row y0+3: bright front-top bullnose plank catching overhead sun
    for x in range(x0 + 1, x1):
        t = (x - x0) / max(1, w - 1)
        put(img, x, y0 + 3, O7 if t < 0.4 else (O6 if t < 0.8 else O5))

    if shaded_top_from_above:
        # Subtle ambient occlusion across inner half of bottom crates' top band
        for x in range(x0 + 1, x1):
            pass  # Top crate will overlap and cast an explicit contact shadow!

    # Row y0+4: crisp dark overhang crease separating top lid band from front frame
    hline(img, x0 + 1, x1 - 1, y0 + 4, O1)
    put(img, x0 + 1, y0 + 4, O2)

    # 3. Recessed Horizontal Oak Planks inside Front Face (x0+3 .. x1-3, y0+6 .. y1-2)
    fx0, fx1 = x0 + 3, x1 - 3
    fy0, fy1 = y0 + 6, y1 - 2
    for y in range(fy0, fy1 + 1):
        rel_y = y - fy0
        is_seam = rel_y in (2, 5)
        for x in range(fx0, fx1 + 1):
            t = (x - fx0) / max(1, fx1 - fx0)
            if is_seam:
                put(img, x, y, O1 if t > 0.3 else O2)
            elif rel_y in (3, 6):
                # Upper edge of plank below seam catches subtle top light
                put(img, x, y, O5 if t < 0.45 else O4)
            else:
                put(img, x, y, O4 if t < 0.5 else O3)
        # 1px inner frame cast shadow along top & left of recessed panel!
        if y == fy0:
            hline(img, fx0, fx1, y, O1)
    vline(img, fx0, fy0, fy1, O1)

    # 4. Diagonal Wooden Cross-Braces across Recessed Panel
    pw = fx1 - fx0 + 1
    ph = fy1 - fy0 + 1
    steps = max(pw, ph)
    if brace_mode in ("backslash", "x"):
        for i in range(steps):
            bx = fx0 + round(i * (pw - 1) / max(1, steps - 1))
            by = fy0 + round(i * (ph - 1) / max(1, steps - 1))
            put(img, bx, by, O6 if i < steps * 0.6 else O5)
            if bx + 1 <= fx1:
                put(img, bx + 1, by, O7 if i < steps * 0.45 else O5)
            if bx - 1 >= fx0 and by + 1 <= fy1:
                put(img, bx - 1, by + 1, O2)  # crisp lower-left shadow edge
    if brace_mode in ("slash", "x"):
        for i in range(steps):
            bx = fx1 - round(i * (pw - 1) / max(1, steps - 1))
            by = fy0 + round(i * (ph - 1) / max(1, steps - 1))
            put(img, bx, by, O6 if i < steps * 0.65 else O5)
            if bx - 1 >= fx0:
                put(img, bx - 1, by, O7 if i < steps * 0.4 else O5)
            if bx + 1 <= fx1 and by + 1 <= fy1:
                put(img, bx + 1, by + 1, O2)
    if brace_mode == "x":
        # Iron center pin where the X-braces cross!
        cx, cy = (fx0 + fx1) // 2, (fy0 + fy1) // 2
        put(img, cx, cy, I3)
        put(img, cx + 1, cy, I1)

    # 5. Raised Outer Timber Frame Rails & Stiles (2px look: x0+1..x0+2, x1-2..x1-1, y0+5, y1-1)
    # Top front frame rail (y0+5)
    for x in range(x0 + 1, x1):
        put(img, x, y0 + 5, O6 if (x - x0) < w * 0.6 else O5)
    # Bottom front frame rail (y1-1)
    for x in range(x0 + 1, x1):
        put(img, x, y1 - 1, O3 if (x - x0) < w * 0.5 else O2)
    # Left frame stile (x0+1..x0+2, y0+5..y1-1) — sunlit left edge!
    vline(img, x0 + 1, y0 + 5, y1 - 2, O6)
    vline(img, x0 + 2, y0 + 5, y1 - 2, O5)
    put(img, x0 + 1, y0 + 5, O7)
    # Right frame stile (x1-2..x1-1, y0+5..y1-1) — shaded right edge!
    vline(img, x1 - 2, y0 + 5, y1 - 2, O4)
    vline(img, x1 - 1, y0 + 5, y1 - 1, O2)

    # 6. Forged Iron Corner Brackets & Specular Nail Studs at all 4 front corners
    corners = [
        (x0 + 1, y0 + 5, True),
        (x1 - 2, y0 + 5, False),
        (x0 + 1, y1 - 1, True),
        (x1 - 2, y1 - 1, False),
    ]
    for nx, ny, is_left in corners:
        put(img, nx, ny, I4 if is_left else I3)
        put(img, nx + 1, ny, I2 if is_left else I1)
    # Top-band corner iron brackets at front-top edge (y0+3)
    put(img, x0 + 1, y0 + 3, I3)
    put(img, x1 - 1, y0 + 3, I2)


def draw_wooden_crates_supply() -> Image.Image:
    """
    Pyramid stack of 3 explorer wooden supply crates (28x27 opaque in 32x32: x=2..29, y=3..29):
      - Bottom-left crate (x=2..15, y=15..29, 14x15) with backslash brace & shipping stencil mark.
      - Bottom-right crate (x=16..29, y=15..29, 14x15) with slash brace & 2px braided tan rope tie!
      - Top centered hero crate (x=9..22, y=3..17, 14x15) with X-cross brace resting IN the 3/4 top band
        of the two bottom crates (y=15..18), casting a rich contact shadow across y=18!
    """
    img = new_canvas(32, 32)

    # Soft ground shadow (#4c557f @ 85) along bottom row y=30..31
    hline(img, 3, 28, 30, SHADOW_RGBA)
    hline(img, 5, 26, 31, SHADOW_RGBA)

    # 1. Draw the two bottom crates side-by-side (x=2..15 and x=16..29, y=15..29)
    _draw_crate(img, 2, 15, 14, 15, brace_mode="backslash")
    _draw_crate(img, 16, 15, 14, 15, brace_mode="slash")

    # Subtle faded crimson explorer stencil mark on bottom-left crate upper-right corner
    put(img, 11, 22, R2)
    put(img, 12, 22, R1)
    put(img, 12, 23, R2)

    # 2. Subtle 2px braided tan rope tie (`LESSONS.md` #16) cleanly binding right side of bottom-right crate
    # Placed at x=25..26 so the crate's diagonal '/' cross-brace (x=19..24) stays 100% crisp and unobstructed!
    put(img, 25, 15, O0)
    put(img, 26, 15, O0)
    for ry in (16, 17, 18):
        put(img, 25, ry, P5 if ry % 2 == 0 else P3)
        put(img, 26, ry, P3 if ry % 2 == 0 else P2)
    for ry in range(19, 29):
        twist = ry % 2 == 0
        put(img, 25, ry, P4 if twist else P2)
        put(img, 26, ry, P2 if twist else P1)
        put(img, 24, ry, O1)  # crisp 1px rope shadow on recessed planks
    # Neat lashing knot at y=21..22
    put(img, 25, 21, P5)
    put(img, 26, 21, P4)
    put(img, 25, 22, P3)
    put(img, 26, 22, P2)

    # 3. Cast shadow from top crate onto the bottom crates' top surfaces & upper rails (x=8..23, y=18..19)
    hline(img, 8, 23, 18, O1)
    put(img, 8, 17, O2)
    put(img, 23, 17, O1)
    hline(img, 9, 22, 19, O2)  # soft ambient shadow on front rail right below top crate!
    # Restore iron corner studs at x=13..14 and x=17..18 if covered? No, center gap is under top crate, which looks super grounded!

    # 4. Draw top centered hero crate (x=9..22, y=3..17, 14x15) with crisp X-cross brace!
    _draw_crate(img, 9, 3, 14, 15, brace_mode="x")

    # Small trailing rope coil resting on top crate's right-bottom corner -> bottom-right lid (x=21..23, y=16..18)
    # Wait: keep top crate's crisp iron corner at (20,16) completely clean so X-crate silhouette is razor sharp!

    return img


# ---------------------------------------------------------------------------
# 3. wooden_bench_garden.png (32x16, topdown, op 30x13: x=1..30, y=2..14)
# ---------------------------------------------------------------------------
def draw_wooden_bench_garden() -> Image.Image:
    """
    Weathered oak courtyard park bench seen near top-down (30x13 opaque in 32x16: x=1..30, y=2..14):
      - Topdown camera: flat top (curved backrest band y=2..4 + slatted oak seat & iron armrests y=5..11)
        = 10px out of 13px (76.9% >= 75%!), front apron y=12..13 (2px <= 3px), stub legs y=13..14 (2px), EMPTY top!
      - Gently curved oak backrest crest along top edge with wrought-iron end finials.
      - Three sunlit weathered-oak seat slats separated by dark slat gaps + center wrought-iron support spine.
      - Sculpted dark wrought-iron side armrests (x=1..3 & x=28..30) with specular scroll knobs.
    """
    img = new_canvas(32, 16)

    # Soft ground shadow (#4c557f @ 85)
    hline(img, 6, 25, 14, SHADOW_RGBA)
    hline(img, 2, 29, 15, SHADOW_RGBA)

    # --- 1. Curved Backrest Plank Band along Top (y=2..4) ---
    # y=2: Gently arched center backrest outline (x=3..28; ends step down 1px for graceful park-bench curve!)
    hline(img, 3, 28, 2, O0)
    put(img, 3, 2, I0)
    put(img, 28, 2, I0)

    # y=3: Sunlit curved oak crest rail + wrought-iron side post finials (x=1..30)
    put(img, 1, 3, I0)
    put(img, 2, 3, I0)   # outer top outline above curved armrest!
    put(img, 3, 3, I4)   # crisp 1px specular glint on left iron post cap!
    hline(img, 4, 11, 3, O7)   # bright sunlit oak crest left
    hline(img, 12, 20, 3, O6)  # warm honey oak crest center
    hline(img, 21, 27, 3, O5)  # oak crest right
    put(img, 28, 3, I3)        # right iron post cap
    put(img, 29, 3, I0)        # outer top outline above curved armrest!
    put(img, 30, 3, I0)

    # y=4: Lower bevel of curved oak backrest plank + dark recess shadow at y=5
    put(img, 1, 4, I0)
    put(img, 2, 4, I4)   # bright iron armrest shoulder highlight
    put(img, 3, 4, I2)
    hline(img, 4, 12, 4, O5)
    hline(img, 13, 21, 4, O4)
    hline(img, 22, 27, 4, O3)
    put(img, 28, 4, I1)
    put(img, 29, 4, I2)
    put(img, 30, 4, I0)

    # --- 2. Slatted Weathered-Oak Seat & Wrought-Iron Side Armrests (y=5..11) ---
    # y=5: Narrow backrest-to-seat shadow gap with subtle vertical backrest struts (x=7, 15, 16, 24)
    hline(img, 4, 27, 5, O1)
    for sx in (7, 24):
        put(img, sx, 5, O3)
    put(img, 15, 5, I1)
    put(img, 16, 5, I1)

    # Slat 1 (y=6): Back oak seat plank (unbroken horizontal long-grain!)
    for x in range(4, 28):
        t = (x - 4) / 23.0
        put(img, x, 6, O6 if t < 0.42 else (O5 if t < 0.78 else O4))
    put(img, 5, 6, I2)   # left iron strap bolt
    put(img, 26, 6, I1)  # right iron strap bolt

    # Slat Gap 1 (y=7): Dark gap between Slat 1 and Slat 2 + iron under-straps peeking through
    hline(img, 4, 27, 7, O1)
    for bx in (5, 15, 16, 26):
        put(img, bx, 7, I1)

    # Slat 2 (y=8..9): Broad sunlit middle oak seat plank (clean uninterrupted horizontal grain!)
    for x in range(4, 28):
        t = (x - 4) / 23.0
        put(img, x, 8, O7 if t < 0.42 else (O6 if t < 0.8 else O5))
        put(img, x, 9, O5 if t < 0.45 else (O4 if t < 0.82 else O3))
    put(img, 5, 8, I3)
    put(img, 26, 8, I2)

    # Slat Gap 2 (y=10): Dark gap between Slat 2 and Front Bullnose Slat
    hline(img, 4, 27, 10, O1)
    for bx in (5, 15, 16, 26):
        put(img, bx, 10, I1)

    # Slat 3 (y=11): Sunlit curved bullnose front seat plank!
    for x in range(4, 28):
        t = (x - 4) / 23.0
        put(img, x, 11, O7 if t < 0.38 else (O6 if t < 0.75 else O5))
    put(img, 5, 11, I3)
    put(img, 26, 11, I2)

    # Sculpted Wrought-Iron Side Armrests (x=1..3 left, x=28..30 right, y=5..11)
    for y in range(5, 12):
        # Outer dark iron outlines
        put(img, 1, y, I0)
        put(img, 30, y, I0)
        # Inner shadow separating raised iron armrest from recessed wooden slats
        put(img, 3, y, I1 if y not in (10, 11) else I2)
        put(img, 28, y, I0 if y < 10 else I1)
    # Left iron armrest top bar shading + front curved scroll knob at y=10..11
    put(img, 2, 5, I4)   # bright specular glint near front-left curve
    put(img, 2, 6, I3)
    put(img, 2, 7, I3)
    put(img, 2, 8, I2)
    put(img, 2, 9, I3)
    put(img, 2, 10, I4)  # front scroll knuckle highlight!
    put(img, 3, 10, I3)
    put(img, 2, 11, I2)
    put(img, 3, 11, I1)

    # Right iron armrest top bar shading + front curved scroll knob at y=10..11
    put(img, 29, 5, I3)
    put(img, 29, 6, I2)
    put(img, 29, 7, I2)
    put(img, 29, 8, I2)
    put(img, 29, 9, I2)
    put(img, 29, 10, I3) # front scroll knuckle highlight!
    put(img, 28, 10, I2)
    put(img, 29, 11, I1)
    put(img, 28, 11, I1)

    # --- 3. Narrow Front Seat Apron (y=12..13, 2px <= 3px!) & Iron Stub Legs (y=13..14) ---
    # y=12: Shaded oak front seat edge + iron leg brackets at ends (stepped in 1px at x=2..29 for clean overhang!)
    put(img, 1, 11, I0)
    put(img, 30, 11, I0)
    put(img, 2, 12, I0)
    put(img, 3, 12, I2)
    put(img, 4, 12, I1)
    hline(img, 5, 14, 12, O3)
    put(img, 15, 12, I2)
    put(img, 16, 12, I1)
    hline(img, 17, 26, 12, O2)
    put(img, 27, 12, I1)
    put(img, 28, 12, I2)
    put(img, 29, 12, I0)

    # y=13: Bottom outline of seat apron across center (x=6..25) + upper row of wrought-iron stub legs
    hline(img, 6, 25, 13, O0)
    # Left wrought-iron stub leg (x=2..5, y=13..14)
    put(img, 2, 13, I0)
    put(img, 3, 13, I3)
    put(img, 4, 13, I1)
    put(img, 5, 13, I0)
    hline(img, 2, 5, 14, I0)

    # Right wrought-iron stub leg (x=26..29, y=13..14)
    put(img, 26, 13, I0)
    put(img, 27, 13, I2)
    put(img, 28, 13, I1)
    put(img, 29, 13, I0)
    hline(img, 26, 29, 14, I0)

    return img


# ---------------------------------------------------------------------------
# 4. stone_offering_table.png (32x16, topdown, op 30x13: x=1..30, y=2..14)
# ---------------------------------------------------------------------------
def draw_stone_offering_table() -> Image.Image:
    """
    Carved ancient limestone sanctuary altar table (30x13 opaque in 32x16: x=1..30, y=2..14):
      - Topdown camera: flat beveled limestone slab top y=2..11 (10px = 76.9% >= 75%!),
        carved front frieze y=12..13 (2px <= 3px), heavy stone block stub legs y=13..14 (2px), 100% EMPTY top!
      - Flush inlaid glowing cyan sanctuary rune circuit (#f2ffff -> #9ce0ee -> #84c8ce -> #3fa2ae -> #27696c).
      - Subtle creeping green moss tucked into the upper-left corner & right base.
    """
    img = new_canvas(32, 16)

    # Soft ground shadow (#4c557f @ 85)
    hline(img, 9, 22, 14, SHADOW_RGBA)
    put(img, 2, 14, SHADOW_RGBA)
    put(img, 29, 14, SHADOW_RGBA)
    hline(img, 3, 28, 15, SHADOW_RGBA)

    # --- 1. Beveled Ancient Limestone Slab Top (y=2..11, 10px flat top!) ---
    # y=2: Chamfered monolithic top outline (x=2..29; x=2..5 uses dark moss outline F0 where moss wraps!)
    hline(img, 2, 6, 2, F0)
    hline(img, 7, 29, 2, S0)

    # Outer left & right outlines for slab (x=1, x=30, y=3..11)
    vline(img, 1, 3, 5, F0)
    vline(img, 1, 6, 11, S0)
    vline(img, 30, 3, 11, S0)

    # Base directional limestone gradient across top surface (x=2..29, y=3..10)
    for y in range(3, 11):
        for x in range(2, 30):
            d = (x - 2) + (y - 3) * 2.2
            if d < 8:
                col = S8
            elif d < 16:
                col = S7
            elif d < 25:
                col = S6
            elif d < 34:
                col = S5
            else:
                col = S4
            put(img, x, y, col)

    # Top & left outer slab bevel highlights (y=3, x=2) + right shaded bevel (x=29)
    hline(img, 6, 16, 3, S8)
    hline(img, 17, 25, 3, S7)
    hline(img, 26, 28, 3, S6)
    put(img, 29, 3, S4)
    vline(img, 2, 6, 10, S7)
    vline(img, 29, 4, 10, S3)
    # Tiny weathered edge chip on right limestone bevel (x=28..29, y=7..8)
    put(img, 29, 7, D1)
    put(img, 28, 7, S3)
    put(img, 29, 8, S2)

    # Subtle ancient ashlar slab hairline joints across flat stone top (flush, crisp)
    vline(img, 10, 3, 4, S4)
    vline(img, 11, 3, 4, S7)
    vline(img, 21, 9, 10, S3)
    vline(img, 22, 9, 10, S6)

    # Chiseled Recessed Sanctuary Border Groove (x=4..27, y=4..9)
    # Upper & left groove walls lie in shadow (S2/S3); lower & right walls catch sunlight (S7/S8)!
    hline(img, 4, 27, 4, S3)
    hline(img, 18, 27, 4, S2)
    vline(img, 4, 4, 9, S3)
    hline(img, 5, 17, 9, S8)
    hline(img, 18, 27, 9, S7)
    vline(img, 27, 5, 9, S6)

    # Smooth recessed inner stone sanctuary field (x=5..26, y=5..8)
    for y in range(5, 9):
        for x in range(5, 27):
            t = (x - 5) / 21.0 + (y - 5) * 0.08
            put(img, x, y, S7 if t < 0.35 else (S6 if t < 0.72 else S5))

    # --- 2. Flush Inlaid Glowing Cyan Sanctuary Rune Line (1px chiseled circuit inside limestone!) ---
    # Keeping plenty of smooth limestone around a razor-crisp 1px glowing cyan line so it reads 100% as solid stone!
    hline(img, 8, 13, 6, C4)     # left 1px glowing cyan rune line
    hline(img, 18, 23, 6, C4)    # right 1px glowing cyan rune line
    hline(img, 8, 13, 7, S4)     # subtle stone bevel below rune line
    hline(img, 18, 23, 7, S4)

    # Left & right chiseled rune key-sigils (x=7..8 and x=23..24)
    put(img, 7, 5, C2)
    put(img, 7, 6, C5)
    put(img, 7, 7, C2)
    put(img, 24, 5, C2)
    put(img, 24, 6, C5)
    put(img, 24, 7, C2)

    # Central Sanctuary Diamond Rune Seal (x=14..17, y=5..8 — flush inlaid centerpiece)
    put(img, 15, 5, C3)
    put(img, 16, 5, C2)
    put(img, 14, 6, C3)
    put(img, 15, 6, C6)  # 1px white-cyan rune heart spark!
    put(img, 16, 6, C5)
    put(img, 17, 6, C3)
    put(img, 14, 7, C1)
    put(img, 15, 7, C4)
    put(img, 16, 7, C3)
    put(img, 17, 7, C1)
    put(img, 15, 8, C1)
    put(img, 16, 8, C1)

    # --- 3. Subtle Creeping Moss Corner on Upper-Left Limestone Slab (x=2..6, y=3..5) ---
    put(img, 2, 3, F4)
    put(img, 3, 3, F5)  # bright sunlit moss tip
    put(img, 4, 3, F4)
    put(img, 5, 3, F3)
    put(img, 6, 3, F2)
    put(img, 2, 4, F3)
    put(img, 3, 4, F4)
    put(img, 4, 4, F2)
    put(img, 5, 4, F1)
    put(img, 2, 5, F2)
    put(img, 3, 5, F1)

    # y=11: Sunlit chamfered front bullnose rim of top slab!
    hline(img, 2, 11, 11, S8)
    hline(img, 12, 21, 11, S7)
    hline(img, 22, 27, 11, S6)
    hline(img, 28, 29, 11, S4)

    # --- 4. Carved Front Frieze Lip (y=12..13, 2px <= 3px!) & Heavy Stone Block Legs (y=13..14) ---
    # y=12: Overhung carved stone front lip (stepped in 1px at x=2..29)
    put(img, 2, 12, S0)
    for x in range(3, 29):
        if x in (6, 10, 14, 17, 21, 25):
            put(img, x, 12, S1)  # carved dentil shadow notch
        elif x < 14:
            put(img, x, 12, S3)
        else:
            put(img, x, 12, S2)
    # Tiny moss tuft on right frieze above right pedestal!
    put(img, 25, 12, F2)
    put(img, 26, 12, F3)
    put(img, 29, 12, S0)

    # y=13: Dark stone underside outline across center span (x=9..22) + Heavy Stone Block Legs!
    hline(img, 9, 22, 13, S0)

    # Left Heavy Stone Block Leg (x=3..8, y=13..14 — 6px wide monolithic block!)
    put(img, 3, 13, S0)
    put(img, 4, 13, S5)  # sunlit left chamfer of stone leg
    put(img, 5, 13, S4)
    put(img, 6, 13, S3)
    put(img, 7, 13, S2)  # shaded inner face of leg
    put(img, 8, 13, S0)
    hline(img, 3, 8, 14, S0)

    # Right Heavy Stone Block Leg (x=23..28, y=13..14 — 6px wide monolithic block with subtle moss!)
    put(img, 23, 13, S0)
    put(img, 24, 13, S4)
    put(img, 25, 13, F1)  # tiny moss shadow at leg corner
    put(img, 26, 13, S3)
    put(img, 27, 13, S1)
    put(img, 28, 13, S0)
    hline(img, 23, 28, 14, S0)

    return img


# ---------------------------------------------------------------------------
# 5. wooden_notice_board.png (32x32, standing, op 26x28: x=3..28, y=2..29)
# ---------------------------------------------------------------------------
def draw_wooden_notice_board() -> Image.Image:
    """
    Roofed Beodeul timber notice board (`ref_bd9_row_2x.png` quality, 26x28 opaque in 32x32: x=3..28, y=2..29):
      - Standing camera: pitched shingled mini-roof cap (y=2..9, ~28.5% height), ZERO side walls.
      - Layered weathered-oak roof shingles with sunlit ridge beam, iron ridge finials, scalloped eaves,
        and a tiny touch of ancient sanctuary moss.
      - Stout oak signboard frame (x=5..26, y=9..22) around a deep recessed dark-oak plank backboard (x=7..24, y=10..20).
      - 3 crisp sunlit parchment notices of varied lengths, each with dark ink lines & plump red wax seals!
      - Stout twin timber posts (x=6..9 and x=22..25) with diagonal knee-braces & iron-bound stone/oak foot plinths (y=27..29).
    """
    img = new_canvas(32, 32)

    # Soft ground shadow (#4c557f @ 85) under twin posts & center span
    hline(img, 5, 11, 30, SHADOW_RGBA)
    hline(img, 20, 26, 30, SHADOW_RGBA)
    hline(img, 6, 25, 31, SHADOW_RGBA)

    # --- 1. Pitched Shingled Mini-Roof Cap (x=3..28, y=2..8) ---
    # y=2: Timber ridge beam top outline (x=5..26)
    hline(img, 5, 26, 2, O0)
    put(img, 5, 2, I0)
    put(img, 26, 2, I0)

    # y=3: Sunlit oak ridge beam + forged iron end-caps (x=4..27)
    put(img, 4, 3, I0)
    put(img, 5, 3, I4)   # left iron ridge cap 1px specular!
    put(img, 6, 3, I2)
    hline(img, 7, 15, 3, O7)
    hline(img, 16, 23, 3, O6)
    hline(img, 24, 25, 3, O5)
    put(img, 26, 3, I3)  # right iron ridge cap
    put(img, 27, 3, I0)

    # y=4..5: Upper Course of Staggered Oak Shingles (x=4..27 at y=4, flaring to x=3..28 at y=5)
    put(img, 4, 4, O0)
    for x in range(5, 27):
        t = (x - 5) / 21.0
        if (x - 5) % 4 == 0 and x > 5:
            put(img, x, 4, O2)  # crisp vertical shingle joint
        else:
            put(img, x, 4, O7 if t < 0.35 else (O6 if t < 0.72 else O5))
    put(img, 27, 4, O0)

    put(img, 3, 5, O0)
    for x in range(4, 28):
        t = (x - 4) / 23.0
        if (x - 5) % 4 == 0:
            put(img, x, 5, O1)  # shingle joint shadow
        else:
            put(img, x, 5, O5 if t < 0.4 else (O4 if t < 0.78 else O3))
    put(img, 28, 5, O0)

    # y=6: Horizontal overlap shadow under Course 1 + top of staggered Course 2 shingles (x=3..28)
    put(img, 3, 6, O0)
    for x in range(4, 28):
        t = (x - 4) / 23.0
        if (x - 3) % 4 == 0:
            put(img, x, 6, O1)  # staggered vertical joint (offset by 2px from Course 1!)
        elif (x - 3) % 4 == 1:
            put(img, x, 6, O6 if t < 0.5 else O5)
        else:
            put(img, x, 6, O2)  # scalloped overlap shadow from upper shingle course
    put(img, 28, 6, O0)

    # y=7: Lower Course of Oak Shingles (x=3..28)
    put(img, 3, 7, O0)
    for x in range(4, 28):
        t = (x - 4) / 23.0
        if (x - 3) % 4 == 0:
            put(img, x, 7, O1)
        else:
            put(img, x, 7, O6 if t < 0.35 else (O5 if t < 0.7 else O4))
    put(img, 28, 7, O0)

    # Subtle patch of sunlit Beodeul moss nestled on left roof shingles (x=6..9, y=4..6)
    put(img, 7, 4, F4)
    put(img, 8, 4, F5)
    put(img, 6, 5, F3)
    put(img, 7, 5, F4)
    put(img, 8, 5, F2)
    put(img, 9, 5, F1)
    put(img, 7, 6, F2)

    # y=8: Scalloped eave tips & dark overhang outline (x=3..28)
    hline(img, 3, 28, 8, O0)
    for x in range(4, 28):
        if (x - 3) % 4 in (1, 2) and 5 <= x <= 26:
            # Keep outer boundary pixels at x=3,4,27,28 dark O0 where y=9 steps in to x=5..26!
            put(img, x, 8, O3 if x < 16 else O2)
    # Ensure x=3..4 and x=27..28 at y=8 are strictly dark outline O0 since y=9 is x=5..26!
    put(img, 3, 8, O0)
    put(img, 4, 8, O0)
    put(img, 27, 8, O0)
    put(img, 28, 8, O0)

    # --- 2. Stout Timber Signboard Frame & Recessed Dark Backboard (x=5..26, y=9..22) ---
    rect(img, 5, 9, 26, 22, O0)

    # Deep eave cast shadow across top frame rail (y=9)
    hline(img, 6, 25, 9, O1)
    put(img, 6, 9, O2)
    put(img, 25, 9, O1)

    # Left & right thick oak frame stiles (x=6 and x=25, y=10..21)
    vline(img, 6, 10, 20, O6)   # sunlit left frame stile
    vline(img, 25, 10, 20, O3)  # shaded right frame stile
    # Forged iron L-corner brackets on signboard frame corners
    put(img, 6, 10, I3)
    put(img, 25, 10, I2)
    put(img, 6, 21, I4)         # crisp 1px iron rivet glint at lower-left corner!
    put(img, 7, 21, I2)
    put(img, 24, 21, I2)
    put(img, 25, 21, I1)

    # Sunlit bottom frame sill ledge (y=21, x=8..23) catching overhead sky light!
    hline(img, 8, 16, 21, O6)
    hline(img, 17, 23, 21, O5)

    # Deeply Recessed Dark-Oak Plank Backboard (x=7..24, y=10..20)
    rect(img, 7, 10, 24, 20, O2)
    hline(img, 7, 24, 10, O0)   # deep inner top shadow under roof/frame
    vline(img, 7, 10, 20, O1)   # inner left recess shadow
    # Horizontal dark plank seams across backboard
    for py in (13, 16, 19):
        hline(img, 7, 24, py, O1)
    hline(img, 7, 24, 20, O1)

    # --- 3. Three Crisp Parchment Notices & Plump Red Wax Seals! ---
    # Notice 1 (Left, x=8..12, y=11..17 — 5x7 Quest Notice)
    rect(img, 8, 11, 12, 17, P4)
    hline(img, 8, 11, 11, P5)   # sunlit top edge
    vline(img, 8, 11, 16, P5)   # sunlit left edge
    hline(img, 8, 12, 17, P2)   # curled bottom edge
    put(img, 12, 17, P3)
    hline(img, 9, 13, 18, O0)   # 1px crisp drop shadow on dark backboard!
    vline(img, 13, 12, 18, O0)
    # Ink text lines
    hline(img, 9, 11, 13, P0)
    hline(img, 9, 10, 15, P1)
    # Red wax seal at bottom-right of Notice 1 (x=11, y=15..16) + iron pin at top (10, 11)
    put(img, 10, 11, I2)
    put(img, 11, 15, R3)        # bright crimson wax seal
    put(img, 11, 16, R1)        # wax ribbon tail

    # Notice 2 (Center, x=14..18, y=11..19 — 5x9 Grand Sanctuary Scroll)
    rect(img, 14, 11, 18, 19, P4)
    hline(img, 14, 17, 11, P5)
    vline(img, 14, 11, 18, P5)
    vline(img, 18, 12, 18, P3)
    hline(img, 14, 18, 19, P2)
    hline(img, 15, 19, 20, O0)  # 1px drop shadow
    vline(img, 19, 12, 20, O0)
    # Cyan sanctuary crest header + crisp dark ink lines
    put(img, 15, 13, C1)
    put(img, 16, 13, C2)
    hline(img, 15, 17, 15, P0)
    hline(img, 15, 16, 17, P1)
    # Plump Red Wax Seal + Specular Glint on Notice 2!
    put(img, 16, 11, R3)        # crimson wax top tack
    put(img, 17, 17, K1)        # wax highlight glint
    put(img, 17, 18, R3)        # rich crimson wax stamp
    put(img, 16, 18, R1)        # wax rim shadow

    # Notice 3 (Right, x=20..23, y=12..17 — 4x6 Explorer Bounty Note)
    rect(img, 20, 12, 23, 17, P4)
    hline(img, 20, 22, 12, P5)
    vline(img, 20, 12, 16, P5)
    vline(img, 23, 13, 17, P2)
    hline(img, 20, 23, 17, P2)
    hline(img, 21, 24, 18, O0)  # 1px drop shadow
    vline(img, 24, 13, 18, O0)
    # Ink lines + plump Red Wax Seal at top & bottom!
    hline(img, 21, 22, 14, P0)
    put(img, 21, 16, P1)
    put(img, 22, 12, R3)        # red wax top seal
    put(img, 22, 16, R3)        # red wax bottom stamp
    put(img, 23, 16, R1)

    # --- 4. Stout Twin Timber Posts, Knee-Braces & Iron-Bound Stone Foot Plinths (y=23..29) ---
    # Diagonal wooden knee-braces tucked right under the signboard (y=23..24)
    # Left knee-brace (x=10..11 at y=23, x=10 at y=24)
    put(img, 10, 23, O4)
    put(img, 11, 23, O0)
    put(img, 10, 24, O0)
    # Right knee-brace (x=20..21 at y=23, x=21 at y=24)
    put(img, 20, 23, O0)
    put(img, 21, 23, O3)
    put(img, 21, 24, O0)

    # Left Stout Post (x=6..9, y=23..26) + Stepped Stone/Iron Plinth Foot (x=5..10, y=27..29)
    for y in range(23, 27):
        put(img, 6, y, O0)
        put(img, 7, y, O6 if y > 23 else O2)  # y=23 has slight board overhang shadow
        put(img, 8, y, O4 if y > 23 else O1)
        put(img, 9, y, O0)
    # Left plinth foot (x=5..10, y=27..29) — carved limestone socket with iron collar!
    put(img, 5, 27, S0)
    put(img, 6, 27, I3)  # iron collar highlight
    put(img, 7, 27, I4)
    put(img, 8, 27, I2)
    put(img, 9, 27, I1)
    put(img, 10, 27, S0)

    put(img, 5, 28, S0)
    put(img, 6, 28, S6)  # sunlit limestone foot block
    put(img, 7, 28, S5)
    put(img, 8, 28, S4)
    put(img, 9, 28, S2)
    put(img, 10, 28, S0)
    hline(img, 5, 10, 29, S0)

    # Right Stout Post (x=22..25, y=23..26) + Stepped Stone/Iron Plinth Foot (x=21..26, y=27..29)
    for y in range(23, 27):
        put(img, 22, y, O0)
        put(img, 23, y, O5 if y > 23 else O2)
        put(img, 24, y, O3 if y > 23 else O1)
        put(img, 25, y, O0)
    # Right plinth foot (x=21..26, y=27..29)
    put(img, 21, 27, S0)
    put(img, 22, 27, I3)
    put(img, 23, 27, I2)
    put(img, 24, 27, I2)
    put(img, 25, 27, I1)
    put(img, 26, 27, S0)

    put(img, 21, 28, S0)
    put(img, 22, 28, S5)
    put(img, 23, 28, S4)
    put(img, 24, 28, S3)
    put(img, 25, 28, S1)
    put(img, 26, 28, S0)
    hline(img, 21, 26, 29, S0)

    return img


# ---------------------------------------------------------------------------
# Strict Validator & Preview Sheet Renderer
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
    bright_outline = []
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

            # Every opaque pixel touching alpha < 255 or canvas edge must be a dark material outline!
            is_boundary = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if nx < 0 or nx >= img.width or ny < 0 or ny >= img.height:
                    is_boundary = True
                    break
                if img.getpixel((nx, ny))[3] < 255:
                    is_boundary = True
                    break
            if is_boundary:
                if hx not in ALLOWED_DARK_OUTLINES:
                    bad_outline.append((x, y, hx))
                if luma(rgba) > 78.0:
                    bright_outline.append((x, y, hx, round(luma(rgba), 1)))

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
    assert not bright_outline, f"{name}: bright outer outline pixels: {bright_outline[:10]}"
    assert target_w[0] <= op_w <= target_w[1], f"{name}: opaque width {op_w} outside {target_w}"
    assert target_h[0] <= op_h <= target_h[1], f"{name}: opaque height {op_h} outside {target_h}"
    assert 1 <= bottom_margin <= 2, f"{name}: bottom margin {bottom_margin} not in 1..2"
    assert abs(left_margin - right_margin) <= 1, (
        f"{name}: not horizontally centered (left={left_margin}, right={right_margin})"
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
    """Render 2x + 1x side-by-side on #767670 gray next to Beodeul char, plus Old vs New lineup."""
    BG = (0x76, 0x76, 0x70, 255)
    CARD_BORDER = (0x5C, 0x5C, 0x56, 255)
    HEADER_BG = (0x64, 0x64, 0x5E, 255)
    TEXT_MAIN = (242, 242, 238, 255)
    TEXT_SUB = (208, 208, 200, 255)

    raw_char = Image.open(CHAR_REF_4X).convert("RGBA")
    char_1x = raw_char.resize((raw_char.width // 4, raw_char.height // 4), Image.Resampling.NEAREST)
    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.Resampling.NEAREST)

    sheet_w = 780
    sheet_h = 410
    sheet = Image.new("RGBA", (sheet_w, sheet_h), BG)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    # Header bar
    draw.rectangle([12, 12, sheet_w - 13, 86], fill=HEADER_BG, outline=CARD_BORDER)
    draw.text(
        (24, 20),
        "fantasy_sky_ruins_carbon - Batch 4/4 Courtyard Props & Loot (2x + 1x on #767670)",
        fill=TEXT_MAIN,
        font=font,
    )
    draw.text(
        (24, 38),
        "Palette: palette_beodeul_ruins.json (74 locked, 0 off-palette, 0 #000000) | Shadow: #4c557f@85",
        fill=TEXT_SUB,
        font=font,
    )
    draw.text(
        (24, 56),
        f"Scale Ref: Beodeul Character 2x ({char_2x.width}x{char_2x.height}) & 1x ({char_1x.width}x{char_1x.height}) beside every sprite",
        fill=TEXT_SUB,
        font=font,
    )

    sheet.alpha_composite(char_2x, (sheet_w - 136, 18))
    draw.text((sheet_w - 120, 70), "2x", fill=TEXT_SUB, font=font)
    sheet.alpha_composite(char_1x, (sheet_w - 64, 43))
    draw.text((sheet_w - 58, 70), "1x", fill=TEXT_SUB, font=font)

    card_w, card_h = 244, 144
    positions = [
        (12, 98),
        (268, 98),
        (524, 98),
        (12, 254),
        (268, 254),
    ]

    for idx, ((name, cam, sp), st) in enumerate(zip(sprites, stats)):
        cx, cy = positions[idx]
        draw.rectangle([cx, cy, cx + card_w, cy + card_h], fill=BG, outline=CARD_BORDER)
        baseline_y = cy + 98
        draw.line([(cx + 10, baseline_y + 2), (cx + card_w - 10, baseline_y + 2)], fill=CARD_BORDER)

        sp_2x = sp.resize((sp.width * 2, sp.height * 2), Image.Resampling.NEAREST)
        x2 = cx + 56 - sp_2x.width // 2
        y2 = baseline_y - sp_2x.height
        sheet.alpha_composite(sp_2x, (x2, y2))

        x1 = cx + 150 - sp.width // 2
        y1 = baseline_y - sp.height
        sheet.alpha_composite(sp, (x1, y1))

        # 1x Beodeul character right next to 1x sprite for true in-game scale verification
        sheet.alpha_composite(char_1x, (cx + 196, baseline_y - char_1x.height + 1))

        draw.text((cx + 10, cy + 106), f"{idx + 1}. {name}", fill=TEXT_MAIN, font=font)
        draw.text(
            (cx + 10, cy + 123),
            f"[{cam}] {st['canvas']} (op {st['opaque_bbox']}, {st['unique_colors']}c)",
            fill=TEXT_SUB,
            font=font,
        )

    # 6th card: True 1x Lineup (top row Old Neon High vs bottom row New Carbon!)
    lx, ly = (524, 254)
    draw.rectangle([lx, ly, lx + card_w, ly + card_h], fill=BG, outline=CARD_BORDER)
    draw.text((lx + 8, ly + 6), "1x Upgrade: Old (top) vs Carbon (bot)", fill=TEXT_MAIN, font=font)

    old_base = ly + 52
    new_base = ly + 98
    draw.line([(lx + 8, old_base + 2), (lx + card_w - 8, old_base + 2)], fill=CARD_BORDER)
    draw.line([(lx + 8, new_base + 2), (lx + card_w - 8, new_base + 2)], fill=CARD_BORDER)

    cur_x = lx + 10
    sheet.alpha_composite(char_1x, (cur_x, new_base - char_1x.height + 1))
    cur_x += char_1x.width + 6
    for name, _, sp in sprites:
        old_p = OLD_OBJS_DIR / f"{name}.png"
        if old_p.exists():
            old_img = Image.open(old_p).convert("RGBA")
            sheet.alpha_composite(old_img, (cur_x, old_base - old_img.height))
        sheet.alpha_composite(sp, (cur_x, new_base - sp.height))
        cur_x += sp.width + 6

    draw.text((lx + 8, ly + 106), "True 1x Scale vs 22px Beodeul Hero", fill=TEXT_MAIN, font=font)
    draw.text((lx + 8, ly + 123), "All 5 sprites: 100% PASS", fill=TEXT_SUB, font=font)

    PREVIEW_PNG.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW_PNG)


def main() -> None:
    palette = load_palette()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    specs = [
        ("treasure_chest_ancient.png", "standing", draw_treasure_chest_ancient(), (16, 16), (13, 15), (12, 14)),
        ("wooden_crates_supply.png", "standing", draw_wooden_crates_supply(), (32, 32), (27, 29), (26, 28)),
        ("wooden_bench_garden.png", "topdown", draw_wooden_bench_garden(), (32, 16), (29, 31), (12, 14)),
        ("stone_offering_table.png", "topdown", draw_stone_offering_table(), (32, 16), (29, 31), (12, 14)),
        ("wooden_notice_board.png", "standing", draw_wooden_notice_board(), (32, 32), (25, 27), (27, 29)),
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
            f"PASS {fname:28s} | canvas={st['canvas']:5s} | opaque={st['opaque_bbox']:5s} "
            f"| margins={st['margins_ltrb']} | colors={st['unique_colors']:2d} | shadow_px={st['shadow_px']}"
        )

    build_contact_sheet(rendered, stats)
    print(f"Wrote preview contact sheet -> {PREVIEW_PNG}")


if __name__ == "__main__":
    main()
