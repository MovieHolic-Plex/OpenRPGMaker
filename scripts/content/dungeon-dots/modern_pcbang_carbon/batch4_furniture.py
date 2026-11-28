#!/usr/bin/env python3
"""
Batch 4/4: Museum-Grade Modern Korean PC Bang Furniture & Utility Objects
Sprites:
  1. cafe_table_oak.png      (32x16, topdown)
  2. cafe_stool.png          (16x16, chair)
  3. vip_sofa_navy.png       (32x16, topdown)
  4. storage_locker.png      (16x32, standing)
  5. standing_floor_lamp.png (16x32, slender)

Strict enforcement:
  - 100% locked to modern_palette_v3.json (118 colors, zero #000000)
  - Ground shadow strictly #4c557f @ alpha 85; all other pixels alpha 0 or 255
  - 1px dark material-matched outer outline on every boundary pixel
"""

from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
PALETTE_JSON = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs/modern_palette_v3.json"
CHAR_REF_PNG = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs/ref_mod1_char.png"
OUT_DIR = ROOT / "tiledata/dungeon-dots/modern_pcbang_carbon/objects"
PREVIEW_PNG = ROOT / "tiledata/dungeon-dots/modern_pcbang_carbon/preview_batch4.png"

SHADOW_RGBA = (76, 85, 127, 85)
TRANSPARENT = (0, 0, 0, 0)


def hex_to_rgba(h: str, alpha: int = 255) -> tuple[int, int, int, int]:
    h = h.lstrip("#").lower()
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


def rgba_to_hex(rgba: tuple[int, int, int, int]) -> str:
    return f"#{rgba[0]:02x}{rgba[1]:02x}{rgba[2]:02x}"


def load_palette() -> set[str]:
    data = json.loads(PALETTE_JSON.read_text(encoding="utf-8"))
    colors = {c.lower() for c in data["all_colors"]}
    assert len(colors) == 118, f"Expected 118 palette colors, got {len(colors)}"
    assert "#000000" not in colors
    return colors


def new_canvas(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), TRANSPARENT)


def put(img: Image.Image, x: int, y: int, color: str | tuple[int, int, int, int]) -> None:
    if 0 <= x < img.width and 0 <= y < img.height:
        rgba = hex_to_rgba(color) if isinstance(color, str) else color
        img.putpixel((x, y), rgba)


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


# ---------------------------------------------------------------------------
# 1. cafe_table_oak.png (32x16, topdown, target opaque ~28-30 x 14-15)
# ---------------------------------------------------------------------------
def draw_cafe_table_oak() -> Image.Image:
    """
    30x14 opaque (x=1..30, y=1..14), soft shadow at y=14..15.
    Topdown camera:
      - Tabletop: y=1..11 (11px = 78.6% of 14px height, >= 75%)
      - Shaded front apron edge: y=12..13 (2px <= 3px)
      - Crisp 2px stub legs: y=13..14 at left & right
      - EMPTY tabletop with rich 5-tone polished oak grain & top-left bevel glint
    """
    img = new_canvas(32, 16)

    # Wood ramp (all exact v3 colors)
    O_DARK = "#2e1a11"   # darkest warm oak outline
    O_FOOT = "#0d0805"   # deepest espresso foot outline
    W_CREA = "#411e06"   # under-lip deep shadow
    W_SHAD = "#72461c"   # shaded oak bevel / apron right
    W_SEAM = "#94601b"   # subtle plank seam / warm deep mid
    W_WARM = "#8c543c"   # muted oak grain accent
    W_MIDD = "#b77246"   # rich honey oak main body
    W_GOLD = "#bd672a"   # golden oak mid-bright
    W_LITE = "#d99350"   # polished oak highlight
    W_BEVL = "#e6aa82"   # glowing warm bevel
    W_SPEC = "#fad6b4"   # top-left lacquer glint
    W_GLNT = "#fae79a"   # peak corner specular spark

    # Soft ground shadow (#4c557f @ 85)
    hline(img, 6, 25, 14, SHADOW_RGBA)
    hline(img, 2, 29, 15, SHADOW_RGBA)

    # Tabletop outer outline with sculpted rounded corners (x=1..30, y=1..11)
    hline(img, 2, 29, 1, O_DARK)
    for y in range(2, 11):
        put(img, 1, y, O_DARK)
        put(img, 30, y, O_DARK)
    # Rounded corner inner pixels so diagonal corners are sealed cleanly
    put(img, 2, 2, W_GLNT)
    put(img, 29, 2, W_MIDD)

    # Fill base honey-oak interior (x=2..29, y=2..10)
    rect(img, 2, 2, 29, 10, W_MIDD)

    # Glowing top-left bevel along y=2 and x=2
    put(img, 2, 2, W_GLNT)
    hline(img, 3, 6, 2, W_SPEC)
    hline(img, 7, 15, 2, W_BEVL)
    hline(img, 16, 24, 2, W_LITE)
    hline(img, 25, 28, 2, W_GOLD)
    put(img, 29, 2, W_SEAM)

    # Left inner bevel (x=2, y=3..9)
    put(img, 2, 3, W_SPEC)
    vline(img, 2, 4, 6, W_BEVL)
    vline(img, 2, 7, 9, W_LITE)

    # Right inner bevel (x=29, y=3..9) - gentle warm shade
    vline(img, 29, 3, 5, W_SEAM)
    vline(img, 29, 6, 9, W_SHAD)

    # Smooth diagonal lacquer sheen + long polished oak grain (NO speckled noise or crate joints)
    for y in range(3, 10):
        for x in range(3, 29):
            d = x + y * 2
            if d <= 12:
                put(img, x, y, W_BEVL)
            elif d <= 21:
                put(img, x, y, W_LITE)
            elif d <= 30:
                put(img, x, y, W_MIDD)
            elif d <= 37:
                put(img, x, y, W_GOLD if y <= 5 else "#a77950")
            else:
                put(img, x, y, "#a77950" if y <= 6 else W_WARM)

    # Two delicate long-grain oak plank seams (y=5 and y=8), softly parted across the specular sheen
    for x in range(3, 29):
        if x not in (7, 8, 9, 10, 11):
            put(img, x, 5, W_SEAM if x < 22 else W_SHAD)
        if x not in (11, 12, 13, 14):
            put(img, x, 8, W_SEAM if x < 20 else W_SHAD)

    # Smooth contiguous polished wood grain highlight ribbons right below plank seams
    hline(img, 4, 10, 4, W_BEVL)
    hline(img, 11, 18, 4, W_LITE)
    hline(img, 5, 12, 6, W_BEVL)
    hline(img, 13, 21, 6, W_LITE)
    hline(img, 15, 22, 9, W_MIDD)
    hline(img, 4, 10, 9, W_LITE)

    # Front bullnose lip of tabletop (y=10) catching secondary warm rim light
    put(img, 2, 10, W_LITE)
    hline(img, 3, 10, 10, W_BEVL)
    hline(img, 11, 21, 10, W_LITE)
    hline(img, 22, 27, 10, W_MIDD)
    hline(img, 28, 29, 10, W_SEAM)

    # Under-top shadow crease / bevel transition (y=11)
    put(img, 1, 11, O_DARK)
    hline(img, 2, 29, 11, W_CREA)
    put(img, 30, 11, O_DARK)

    # Shaded front apron edge (y=12..13, 2px <= 3px!) stepped in 1px (x=2..29) for crisp overhang
    put(img, 2, 12, O_DARK)
    hline(img, 3, 9, 12, W_SEAM)
    hline(img, 10, 22, 12, W_SHAD)
    hline(img, 23, 28, 12, "#502f18")
    put(img, 29, 12, O_DARK)

    # Bottom outline of apron (y=13) + 2px sturdy oak stub legs (x=2..5 and x=26..29 at y=13..14)
    hline(img, 2, 29, 13, O_DARK)
    # Left stub leg (x=2..5, y=13..14)
    put(img, 3, 13, W_SEAM)
    put(img, 4, 13, "#502f18")
    hline(img, 2, 5, 14, O_FOOT)
    # Right stub leg (x=26..29, y=13..14)
    put(img, 27, 13, W_SHAD)
    put(img, 28, 13, "#472f12")
    hline(img, 26, 29, 14, O_FOOT)

    return img


# ---------------------------------------------------------------------------
# 2. cafe_stool.png (16x16, chair, target opaque ~12-14 x 13-14)
# ---------------------------------------------------------------------------
def draw_cafe_stool() -> Image.Image:
    """
    14x14 opaque (x=1..14, y=1..14), soft shadow at y=14..15.
    Chair camera (ref_ezt_chair_front_a.png):
      - Curved ergonomic honey-oak top-edge backrest (y=1..4, wraps to x=1..14 at ears)
      - Wooden side frame rails (x=2..3 and x=12..13)
      - Plush cobalt-blue/navy padded seat cushion (x=4..11, y=5..11) with soft rounded dome highlight
      - Wooden front seat rail (y=12) + crisp 2px stub legs (y=13..14)
    """
    img = new_canvas(16, 16)

    O_WOOD = "#2e1a11"
    O_FOOT = "#0d0805"
    W_SHAD = "#72461c"
    W_SEAM = "#94601b"
    W_MIDD = "#b77246"
    W_GOLD = "#bd672a"
    W_LITE = "#d99350"
    W_BEVL = "#e6aa82"
    W_SPEC = "#fad6b4"

    # Cobalt/navy plush fabric ramp
    B_DEEP = "#111c2e"
    B_DARK = "#182c50"
    B_SHAD = "#1c3772"
    B_MIDD = "#1b3e94"
    B_BRGT = "#294db6"
    B_LITE = "#5b76d8"
    B_SPEC = "#9aacfa"

    # Ground shadow (#4c557f @ 85)
    hline(img, 5, 10, 14, SHADOW_RGBA)
    hline(img, 2, 13, 15, SHADOW_RGBA)

    # 1. Curved oak backrest along TOP edge (y=1..4)
    hline(img, 3, 12, 1, O_WOOD)

    put(img, 2, 2, O_WOOD)
    put(img, 3, 2, W_SPEC)
    hline(img, 4, 7, 2, W_BEVL)
    hline(img, 8, 10, 2, W_LITE)
    hline(img, 11, 12, 2, W_MIDD)
    put(img, 13, 2, O_WOOD)

    # Curved bentwood backrest ears at y=3..4 (x=1..14 -> 14px width!)
    put(img, 1, 3, O_WOOD)
    put(img, 2, 3, W_BEVL)
    put(img, 3, 3, W_LITE)
    hline(img, 4, 8, 3, W_MIDD)
    hline(img, 9, 11, 3, W_SEAM)
    put(img, 12, 3, W_MIDD)
    put(img, 13, 3, W_SHAD)
    put(img, 14, 3, O_WOOD)

    put(img, 1, 4, O_WOOD)
    put(img, 2, 4, O_WOOD)
    put(img, 3, 4, W_LITE)
    hline(img, 4, 7, 4, W_SHAD)       # warm shaded lower rim of curved oak backrest
    hline(img, 8, 11, 4, "#502f18")
    put(img, 12, 4, W_SEAM)
    put(img, 13, 4, O_WOOD)
    put(img, 14, 4, O_WOOD)

    # 2. Wooden side rails + Plush cobalt-navy seat cushion (y=5..11, x=2..13)
    for y in range(5, 12):
        put(img, 2, y, O_WOOD)
        put(img, 13, y, O_WOOD)
        # Left oak side rail (x=3)
        put(img, 3, y, W_BEVL if y <= 6 else (W_LITE if y <= 9 else W_MIDD))
        # Right oak side rail (x=12)
        put(img, 12, y, W_GOLD if y <= 6 else (W_SEAM if y <= 9 else W_SHAD))

    # Plush rounded cobalt-navy seat cushion (x=4..11, y=5..11)
    # Row y=5: tucked behind oak backrest
    put(img, 4, 5, B_DARK)
    hline(img, 5, 9, 5, B_SHAD)
    put(img, 10, 5, B_DARK)
    put(img, 11, 5, B_DEEP)

    # Row y=6: soft rounded upper-left specular dome
    put(img, 4, 6, B_MIDD)
    put(img, 5, 6, B_SPEC)
    put(img, 6, 6, B_SPEC)
    put(img, 7, 6, B_LITE)
    put(img, 8, 6, B_LITE)
    put(img, 9, 6, B_BRGT)
    put(img, 10, 6, B_MIDD)
    put(img, 11, 6, B_SHAD)

    # Row y=7: plump center-left highlight
    put(img, 4, 7, B_BRGT)
    put(img, 5, 7, B_SPEC)
    put(img, 6, 7, B_LITE)
    put(img, 7, 7, B_LITE)
    put(img, 8, 7, B_BRGT)
    put(img, 9, 7, B_BRGT)
    put(img, 10, 7, B_MIDD)
    put(img, 11, 7, B_SHAD)

    # Row y=8..9: rich cobalt pillow body
    put(img, 4, 8, B_BRGT)
    hline(img, 5, 6, 8, B_LITE)
    hline(img, 7, 9, 8, B_BRGT)
    put(img, 10, 8, B_MIDD)
    put(img, 11, 8, B_SHAD)

    put(img, 4, 9, B_MIDD)
    hline(img, 5, 8, 9, B_BRGT)
    put(img, 9, 9, B_MIDD)
    put(img, 10, 9, B_SHAD)
    put(img, 11, 9, B_DARK)

    # Row y=10: plump front waterfall cushion lip
    put(img, 4, 10, B_SHAD)
    hline(img, 5, 7, 10, B_BRGT)
    hline(img, 8, 9, 10, B_MIDD)
    put(img, 10, 10, B_SHAD)
    put(img, 11, 10, B_DARK)

    # Row y=11: deep cushion tuck seam above front wood apron
    put(img, 4, 11, B_DEEP)
    hline(img, 5, 10, 11, B_DARK)
    put(img, 11, 11, B_DEEP)

    # 3. Front oak seat rail (y=12) + bottom outline & stub legs (y=13..14)
    put(img, 2, 12, O_WOOD)
    hline(img, 3, 6, 12, W_LITE)
    hline(img, 7, 10, 12, W_MIDD)
    hline(img, 11, 12, 12, W_SHAD)
    put(img, 13, 12, O_WOOD)

    # y=13: apron bottom outline + inner wood of left/right stub legs
    hline(img, 2, 13, 13, O_WOOD)
    put(img, 3, 13, W_SEAM)
    put(img, 12, 13, W_SHAD)

    # y=14: stub leg tips (x=2..4 and x=11..13) wrapped in dark outline
    hline(img, 2, 4, 14, O_FOOT)
    hline(img, 11, 13, 14, O_FOOT)

    return img


# ---------------------------------------------------------------------------
# 3. vip_sofa_navy.png (32x16, topdown, target opaque ~28-30 x 14-15)
# ---------------------------------------------------------------------------
def draw_vip_sofa_navy() -> Image.Image:
    """
    30x14 opaque (x=1..30, y=1..14), soft shadow at y=14..15.
    Topdown camera:
      - Top surface (backrest bolster + armrests + 2 tufted cushions): y=1..11 (11px = 78.6% >= 75%)
      - Front leather valence: y=12..13 (2px <= 3px)
      - Tiny walnut stub feet: y=13..14
      - Glossy cobalt-navy leather with Chesterfield button dimples & curved bolsters
    """
    img = new_canvas(32, 16)

    O_NAVY = "#111c2e"  # darkest cobalt_blue outline
    B_DARK = "#182c50"  # deep navy crease/shadow
    B_SHAD = "#1c3772"  # rich navy shadow
    B_MIDD = "#1b3e94"  # royal cobalt-navy body
    B_BRGT = "#294db6"  # lit cobalt leather
    B_LITE = "#5b76d8"  # soft leather puff highlight
    B_SPEC = "#9aacfa"  # glossy leather specular glint

    O_FOOT = "#0d0805"
    W_FOOT = "#69311a"

    # Ground shadow (#4c557f @ 85)
    hline(img, 6, 25, 14, SHADOW_RGBA)
    hline(img, 2, 29, 15, SHADOW_RGBA)

    # 1. Continuous Overstuffed Chesterfield Backrest Bolster (y=1..4)
    hline(img, 3, 28, 1, O_NAVY)

    # y=2: curved shoulders + glossy leather top-left sheen along backrest
    put(img, 2, 2, O_NAVY)
    hline(img, 3, 8, 2, B_SPEC)
    hline(img, 9, 17, 2, B_LITE)
    hline(img, 18, 25, 2, B_BRGT)
    hline(img, 26, 28, 2, B_MIDD)
    put(img, 29, 2, O_NAVY)
    for px in (8, 13, 18, 23):
        put(img, px, 2, B_BRGT if px < 18 else B_MIDD)

    # y=3: plump backrest body widening to x=1..30 with 4 tufted pleat tucks
    put(img, 1, 3, O_NAVY)
    put(img, 2, 3, B_SPEC)
    hline(img, 3, 11, 3, B_LITE)
    hline(img, 12, 21, 3, B_BRGT)
    hline(img, 22, 27, 3, B_MIDD)
    hline(img, 28, 29, 3, B_SHAD)
    put(img, 30, 3, O_NAVY)
    for px in (8, 13, 18, 23):
        put(img, px, 3, B_SHAD)

    # y=4: deep tuck crease under continuous backrest bolster, curving smoothly into armrests
    put(img, 1, 4, O_NAVY)
    put(img, 2, 4, B_LITE)
    put(img, 3, 4, B_BRGT)
    put(img, 4, 4, B_MIDD)
    hline(img, 5, 26, 4, B_DARK)
    put(img, 27, 4, B_BRGT)
    put(img, 28, 4, B_MIDD)
    put(img, 29, 4, B_SHAD)
    put(img, 30, 4, O_NAVY)

    # 2. Plump Rounded Left & Right Leather Armrests (y=5..11, x=1..5 and x=26..30)
    for y in range(5, 12):
        # Left armrest (x=1..5)
        put(img, 1, y, O_NAVY)
        if y == 5:
            put(img, 2, y, B_SPEC)
            put(img, 3, y, B_SPEC)
            put(img, 4, y, B_LITE)
        elif y <= 7:
            put(img, 2, y, B_LITE)
            put(img, 3, y, B_LITE)
            put(img, 4, y, B_BRGT)
        elif y <= 9:
            put(img, 2, y, B_BRGT)
            put(img, 3, y, B_BRGT)
            put(img, 4, y, B_MIDD)
        else:
            put(img, 2, y, B_MIDD)
            put(img, 3, y, B_MIDD)
            put(img, 4, y, B_SHAD)
        put(img, 5, y, B_DARK if y < 11 else O_NAVY)

        # Right armrest (x=26..30)
        put(img, 26, y, B_DARK if y < 11 else O_NAVY)
        if y == 5:
            put(img, 27, y, B_LITE)
            put(img, 28, y, B_BRGT)
            put(img, 29, y, B_MIDD)
        elif y <= 8:
            put(img, 27, y, B_BRGT)
            put(img, 28, y, B_MIDD)
            put(img, 29, y, B_SHAD)
        else:
            put(img, 27, y, B_MIDD)
            put(img, 28, y, B_SHAD)
            put(img, 29, y, B_DARK)
        put(img, 30, y, O_NAVY)

    # 3. Two Glossy Tufted Cobalt-Navy Seat Cushions
    # Left cushion: x=6..15 (10px wide), Right cushion: x=16..25 (10px wide), y=5..11 (7px deep)
    def paint_tufted_cushion(x0: int, is_left: bool) -> None:
        rect(img, x0, 5, x0 + 9, 11, B_MIDD)

        # Top edge tucked under backrest, left edge catching soft rim light
        hline(img, x0, x0 + 9, 5, B_SHAD)
        put(img, x0, 5, B_DARK)
        put(img, x0 + 9, 5, B_DARK)

        # Smooth pillowy dome across y=6..9
        hline(img, x0 + 1, x0 + 7, 6, B_LITE if is_left else B_BRGT)
        hline(img, x0 + 1, x0 + 5, 6, B_LITE)
        put(img, x0 + 1, 6, B_SPEC)
        if is_left:
            put(img, x0 + 2, 6, B_SPEC)

        hline(img, x0 + 1, x0 + 7, 7, B_BRGT)
        hline(img, x0 + 1, x0 + 3, 7, B_LITE)
        hline(img, x0 + 1, x0 + 7, 8, B_BRGT)
        hline(img, x0 + 1, x0 + 6, 9, B_BRGT if is_left else B_MIDD)

        # Right & bottom cushion curvature
        vline(img, x0 + 9, 6, 10, B_DARK)
        vline(img, x0 + 8, 6, 10, B_SHAD)
        hline(img, x0 + 1, x0 + 7, 10, B_MIDD)
        hline(img, x0, x0 + 9, 11, B_DARK)

        # Two clean Chesterfield button dimples at (x0+3, 8) and (x0+6, 8)
        for bx in (x0 + 3, x0 + 6):
            put(img, bx, 8, O_NAVY)          # deep tufted button pit
            put(img, bx, 7, B_SHAD)          # soft upper fold into dimple
            put(img, bx - 1, 7, B_LITE)      # upper-left puffed leather mound

        # Plump diamond puff between the two dimples
        put(img, x0 + 4, 7, B_SPEC if is_left else B_LITE)
        put(img, x0 + 5, 7, B_LITE)
        put(img, x0 + 4, 8, B_LITE)
        put(img, x0 + 5, 9, B_BRGT)

    paint_tufted_cushion(6, is_left=True)
    paint_tufted_cushion(16, is_left=False)

    # Crisp center division between the two plush cushions (x=15..16)
    vline(img, 15, 5, 11, O_NAVY)
    vline(img, 16, 6, 9, B_BRGT)  # left rim of right cushion catching light!

    # 4. Front Leather Valence / Base Band (y=12..13, 2px <= 3px!) with rounded bottom corners
    put(img, 1, 12, O_NAVY)
    hline(img, 2, 14, 12, B_SHAD)
    put(img, 15, 12, B_DARK)
    hline(img, 16, 29, 12, B_DARK)
    put(img, 30, 12, O_NAVY)

    # Bottom leather outline (y=13, x=2..29 rounded corners!) + stub walnut feet (y=13..14)
    hline(img, 2, 29, 13, O_NAVY)
    put(img, 4, 13, W_FOOT)
    hline(img, 3, 5, 14, O_FOOT)
    put(img, 27, 13, "#472f12")
    hline(img, 26, 28, 14, O_FOOT)

    return img


# ---------------------------------------------------------------------------
# 4. storage_locker.png (16x32, standing, target opaque ~14 x 28-30)
# ---------------------------------------------------------------------------
def draw_storage_locker() -> Image.Image:
    """
    14x29 opaque (x=1..14, y=2..30), soft shadow at y=30..31.
    Standing camera:
      - Narrow lit brushed-steel top roof plane (y=2..8, 7px ~1/4 height, ZERO side walls)
      - 2-tier beveled stainless-steel coin locker doors (y=9..17 and y=19..27)
      - 4-tone diagonal/vertical brushed metal sheen
      - Centered recessed dark air-vent louvers at top of each door (with 1px bright catchlights)
      - Number badge on mid-left + bright chrome pull handle & warm gold key lock on mid-right
      - Dark charcoal steel kickplate plinth & corner feet (y=28..30)
    """
    img = new_canvas(16, 32)

    O_STEL = "#141622"  # darkest cool_slate_gray outline
    S_CHAR = "#2e3040"  # charcoal steel recess / louvers / kickplate
    S_DARK = "#4e5062"  # dark steel bevel
    S_MIDD = "#707282"  # medium steel
    S_BRGT = "#9698a4"  # light brushed steel
    S_SHEN = "#bec0c8"  # bright silver sheen
    S_GLOW = "#e2e4e8"  # gleaming chrome bevel
    S_SPEC = "#fafaf8"  # peak specular glint

    # Gold key lock & cyan tag accents
    G_GLNT = "#f7fa9a"
    G_GOLD = "#d8b55b"
    G_DARK = "#94601b"
    C_TAG = "#5ba6d8"

    # Ground shadow (#4c557f @ 85)
    hline(img, 5, 10, 30, SHADOW_RGBA)
    hline(img, 2, 13, 31, SHADOW_RGBA)

    # Outer cabinet silhouette (x=1..14, y=2..29, rounded top corners at y=2)
    hline(img, 2, 13, 2, O_STEL)
    for y in range(3, 30):
        put(img, 1, y, O_STEL)
        put(img, 14, y, O_STEL)

    # 1. Lit Brushed-Steel Top Band (y=3..7, ~1/4 height, ZERO side walls)
    hline(img, 2, 5, 3, S_SPEC)
    hline(img, 6, 10, 3, S_GLOW)
    hline(img, 11, 13, 3, S_SHEN)
    for y in (4, 5, 6):
        hline(img, 2, 4, y, S_GLOW)
        hline(img, 5, 8, y, S_SHEN)
        hline(img, 9, 11, y, S_BRGT)
        hline(img, 12, 13, y, S_MIDD)
    # y=7: gleaming front cornice overhang lip
    hline(img, 2, 6, 7, S_SPEC)
    hline(img, 7, 11, 7, S_GLOW)
    hline(img, 12, 13, 7, S_SHEN)
    # y=8: recessed shadow under roof lip
    hline(img, 2, 13, 8, S_CHAR)

    # Cabinet left & right vertical stiles (x=2 and x=13, y=9..27)
    for y in range(9, 28):
        put(img, 2, y, S_SHEN if y < 19 else S_BRGT)
        put(img, 13, y, S_DARK)

    # Helper to draw a beveled brushed-steel locker door (x=3..12, 9px tall y0..y0+8)
    def draw_locker_door(y0: int, is_upper: bool) -> None:
        for dy in range(9):
            y = y0 + dy
            for x in range(3, 13):
                band = (x - 3) + (dy // 2) + (0 if is_upper else 1)
                if band <= 2:
                    c = S_GLOW
                elif band <= 4:
                    c = S_SHEN
                elif band <= 6:
                    c = S_BRGT
                elif band <= 8:
                    c = S_MIDD
                else:
                    c = S_DARK
                put(img, x, y, c)

        # Crisp 1px 3D door bevels
        put(img, 3, y0, S_SPEC)
        hline(img, 4, 9, y0, S_GLOW if is_upper else S_SHEN)
        hline(img, 10, 11, y0, S_SHEN if is_upper else S_BRGT)
        put(img, 12, y0, S_MIDD)

        vline(img, 3, y0 + 1, y0 + 7, S_GLOW if is_upper else S_SHEN)
        vline(img, 12, y0 + 1, y0 + 8, S_DARK)
        hline(img, 3, 12, y0 + 8, S_DARK)
        put(img, 3, y0 + 8, S_MIDD)

        # Two symmetric centered recessed air-vent louvers at top of door (x=5..10, y0+1 & y0+3)
        hline(img, 5, 10, y0 + 1, S_CHAR)
        hline(img, 5, 10, y0 + 2, S_GLOW if is_upper else S_SHEN)
        hline(img, 5, 10, y0 + 3, S_CHAR)
        hline(img, 5, 10, y0 + 4, S_SHEN if is_upper else S_BRGT)

        # Crisp locker number tag on mid-left (x=4..5, y0+5)
        put(img, 4, y0 + 5, C_TAG)
        put(img, 5, y0 + 5, S_SPEC)

        # Bright chrome pull handle (x=8, y0+5..y0+7) + warm gold key lock (x=10..11, y0+5..y0+6)
        put(img, 8, y0 + 5, S_SPEC)
        put(img, 8, y0 + 6, S_GLOW)
        put(img, 8, y0 + 7, S_SHEN)
        put(img, 9, y0 + 6, S_DARK)   # handle recess shadow
        put(img, 10, y0 + 5, G_GLNT)
        put(img, 11, y0 + 5, G_GOLD)
        put(img, 10, y0 + 6, G_GOLD)
        put(img, 11, y0 + 6, G_DARK)  # keyhole shadow

    draw_locker_door(9, is_upper=True)
    # Center divider rail between upper and lower lockers (y=18)
    hline(img, 3, 12, 18, S_CHAR)

    draw_locker_door(19, is_upper=False)

    # 3. Dark Steel Kickplate Plinth & Corner Feet (y=28..30)
    hline(img, 2, 13, 28, S_CHAR)
    put(img, 2, 28, S_MIDD)
    hline(img, 3, 5, 28, S_DARK)

    hline(img, 1, 14, 29, O_STEL)
    put(img, 2, 29, S_DARK)
    put(img, 3, 29, S_CHAR)
    put(img, 12, 29, S_CHAR)
    put(img, 13, 29, S_CHAR)

    hline(img, 1, 4, 30, O_STEL)
    hline(img, 11, 14, 30, O_STEL)

    return img


# ---------------------------------------------------------------------------
# 5. standing_floor_lamp.png (16x32, slender, target opaque ~10-12 x 28-30)
# ---------------------------------------------------------------------------
def draw_standing_floor_lamp() -> Image.Image:
    """
    12x29 opaque (x=2..13, y=2..30), soft shadow at y=30..31.
    Slender camera:
      - Architectural tapered empire cream-amber lampshade (8px -> 10px -> 12px smooth flare)
        with luminous radial bulb glow gradient + top elliptical opening & rim highlight
      - Warm brass neck collar (y=11..12)
      - Slender gleaming chrome/slate pole (x=6..9: 1px dark outline + 2px chrome/slate core + 1px dark outline)
      - Rounded weighted circular steel base (y=26..30, x=3..12 elliptical disc) + #4c557f@85 shadow
    """
    img = new_canvas(16, 32)

    O_SHAD = "#2e1a11"  # darkest warm amber-brown outline for lampshade
    A_DARK = "#502f18"
    A_DEEP = "#94601b"
    A_WARM = "#b68429"
    A_PECH = "#e6aa82"
    A_GOLD = "#d8b55b"
    A_CREM = "#fae79a"
    A_GLOW = "#f7fa9a"
    A_CORE = "#fafaf8"  # hottest incandescent center glint

    O_STEL = "#141622"  # darkest cool_slate_gray outline for pole & base
    S_CHAR = "#2e3040"
    S_DARK = "#4e5062"
    S_MIDD = "#707282"
    S_BRGT = "#9698a4"
    S_SHEN = "#bec0c8"
    S_GLOW = "#e2e4e8"
    S_SPEC = "#fafaf8"

    # Elliptical ground shadow under circular steel base (#4c557f @ 85)
    put(img, 3, 30, SHADOW_RGBA)
    put(img, 12, 30, SHADOW_RGBA)
    hline(img, 4, 11, 31, SHADOW_RGBA)

    # 1. Clean Tapered Cream-Amber Drum/Empire Lampshade (y=2..10: 8px -> 10px -> 12px flare)
    # y=2: curved top back rim (x=4..11, 8px)
    hline(img, 4, 11, 2, O_SHAD)

    # y=3: luminous elliptical top opening + brass spider finial (x=3..12, 10px)
    put(img, 3, 3, O_SHAD)
    put(img, 4, 3, A_CREM)
    put(img, 5, 3, A_GLOW)
    put(img, 6, 3, A_CORE)
    put(img, 7, 3, A_GOLD)
    put(img, 8, 3, A_DEEP)
    put(img, 9, 3, A_GLOW)
    put(img, 10, 3, A_CREM)
    put(img, 11, 3, A_GOLD)
    put(img, 12, 3, O_SHAD)

    # y=4: bright front rim highlight of top ellipse (x=3..12, 10px)
    put(img, 3, 4, O_SHAD)
    hline(img, 4, 6, 4, A_CORE)
    hline(img, 7, 9, 4, A_GLOW)
    hline(img, 10, 11, 4, A_CREM)
    put(img, 12, 4, O_SHAD)

    # y=5: upper tapered shade body (x=3..12, 10px)
    put(img, 3, 5, O_SHAD)
    put(img, 4, 5, A_CREM)
    put(img, 5, 5, A_GLOW)
    put(img, 6, 5, A_CORE)
    put(img, 7, 5, A_CORE)
    put(img, 8, 5, A_GLOW)
    put(img, 9, 5, A_CREM)
    put(img, 10, 5, A_GOLD)
    put(img, 11, 5, A_WARM)
    put(img, 12, 5, O_SHAD)

    # y=6..9: smoothly flared lower shade body (x=2..13, 12px wide for 4 clean rows)
    put(img, 2, 6, O_SHAD)
    put(img, 3, 6, A_CREM)
    put(img, 4, 6, A_GLOW)
    put(img, 5, 6, A_CORE)
    put(img, 6, 6, A_CORE)
    put(img, 7, 6, A_GLOW)
    put(img, 8, 6, A_GLOW)
    put(img, 9, 6, A_CREM)
    put(img, 10, 6, A_GOLD)
    put(img, 11, 6, A_WARM)
    put(img, 12, 6, A_DEEP)
    put(img, 13, 6, O_SHAD)

    put(img, 2, 7, O_SHAD)
    put(img, 3, 7, A_PECH)
    put(img, 4, 7, A_CREM)
    put(img, 5, 7, A_GLOW)
    put(img, 6, 7, A_GLOW)
    put(img, 7, 7, A_CREM)
    put(img, 8, 7, A_CREM)
    put(img, 9, 7, A_GOLD)
    put(img, 10, 7, A_GOLD)
    put(img, 11, 7, A_WARM)
    put(img, 12, 7, A_DEEP)
    put(img, 13, 7, O_SHAD)

    put(img, 2, 8, O_SHAD)
    put(img, 3, 8, A_GOLD)
    put(img, 4, 8, A_CREM)
    put(img, 5, 8, A_CREM)
    put(img, 6, 8, A_GLOW)
    put(img, 7, 8, A_CREM)
    put(img, 8, 8, A_GOLD)
    put(img, 9, 8, A_GOLD)
    put(img, 10, 8, A_WARM)
    put(img, 11, 8, A_WARM)
    put(img, 12, 8, A_DEEP)
    put(img, 13, 8, O_SHAD)

    # y=9: warm bottom trim rim curving into y=10
    put(img, 2, 9, O_SHAD)
    put(img, 3, 9, A_GOLD)
    hline(img, 4, 7, 9, A_CREM)
    hline(img, 8, 9, 9, A_GOLD)
    put(img, 10, 9, A_WARM)
    put(img, 11, 9, A_DEEP)
    put(img, 12, 9, A_DARK)
    put(img, 13, 9, O_SHAD)

    # y=10: curved lower rim outline (x=3..12) + warm under-shade glow around socket
    hline(img, 3, 12, 10, O_SHAD)
    put(img, 6, 10, A_GLOW)
    put(img, 7, 10, A_CREM)
    put(img, 8, 10, A_GOLD)
    put(img, 9, 10, A_WARM)

    # 2. Brass/Chrome Neck Collar (y=11..12) + Slender Gleaming Chrome Pole (y=13..25, x=6..9)
    put(img, 5, 11, O_SHAD)
    put(img, 6, 11, A_CREM)
    put(img, 7, 11, A_GOLD)
    put(img, 8, 11, A_WARM)
    put(img, 9, 11, A_DARK)
    put(img, 10, 11, O_SHAD)

    put(img, 6, 12, O_STEL)
    put(img, 7, 12, A_CREM)
    put(img, 8, 12, A_WARM)
    put(img, 9, 12, O_STEL)

    for y in range(13, 26):
        put(img, 6, y, O_STEL)
        if y <= 16:
            put(img, 7, y, S_SPEC)
            put(img, 8, y, S_BRGT)
        elif y <= 21:
            put(img, 7, y, S_GLOW)
            put(img, 8, y, S_MIDD)
        else:
            put(img, 7, y, S_SHEN)
            put(img, 8, y, S_DARK)
        put(img, 9, y, O_STEL)

    # 3. Rounded Weighted Circular Brushed-Steel Base (y=26..30, x=3..12 elliptical disc)
    hline(img, 4, 11, 26, O_STEL)
    put(img, 6, 26, S_SPEC)
    put(img, 7, 26, S_SHEN)
    put(img, 8, 26, S_MIDD)
    put(img, 9, 26, S_DARK)

    put(img, 3, 27, O_STEL)
    put(img, 4, 27, S_SPEC)
    put(img, 5, 27, S_GLOW)
    put(img, 6, 27, S_GLOW)
    put(img, 7, 27, S_SHEN)
    put(img, 8, 27, S_MIDD)
    put(img, 9, 27, S_BRGT)
    put(img, 10, 27, S_MIDD)
    put(img, 11, 27, S_DARK)
    put(img, 12, 27, O_STEL)

    put(img, 3, 28, O_STEL)
    put(img, 4, 28, S_GLOW)
    put(img, 5, 28, S_SPEC)
    put(img, 6, 28, S_GLOW)
    put(img, 7, 28, S_SHEN)
    put(img, 8, 28, S_BRGT)
    put(img, 9, 28, S_MIDD)
    put(img, 10, 28, S_DARK)
    put(img, 11, 28, S_CHAR)
    put(img, 12, 28, O_STEL)

    put(img, 3, 29, O_STEL)
    put(img, 4, 29, S_MIDD)
    put(img, 5, 29, S_DARK)
    hline(img, 6, 10, 29, S_CHAR)
    put(img, 11, 29, O_STEL)
    put(img, 12, 29, O_STEL)

    hline(img, 4, 11, 30, O_STEL)

    return img


# ---------------------------------------------------------------------------
# Strict Validation & Preview Sheet Builder
# ---------------------------------------------------------------------------
ALLOWED_OUTLINES = {"#0d0805", "#411e06", "#2e1a11", "#111c2e", "#141622"}


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

            # Check 4-neighborhood for outer edge touching transparency or semi-transparent shadow
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
    """Render 2x + 1x side-by-side on #767670 gray next to 1x/2x ref_mod1_char.png."""
    BG = (118, 118, 112, 255)      # #767670
    CARD_BORDER = (92, 92, 86, 255)
    HEADER_BG = (104, 104, 98, 255)
    TEXT_MAIN = (242, 242, 238, 255)
    TEXT_SUB = (206, 206, 198, 255)

    raw_char = Image.open(CHAR_REF_PNG).convert("RGBA")
    scale_div = max(1, raw_char.width // 24)
    char_1x = raw_char.resize(
        (raw_char.width // scale_div, raw_char.height // scale_div),
        Image.Resampling.NEAREST,
    )
    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.Resampling.NEAREST)

    sheet_w = 740
    sheet_h = 370
    sheet = Image.new("RGBA", (sheet_w, sheet_h), BG)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    # Header bar
    draw.rectangle([12, 12, sheet_w - 13, 86], fill=HEADER_BG, outline=CARD_BORDER)
    draw.text(
        (24, 22),
        "modern_pcbang_carbon - Batch 4/4 Furniture & Utility (2x + 1x on #767670)",
        fill=TEXT_MAIN,
        font=font,
    )
    draw.text(
        (24, 40),
        "Palette: modern_palette_v3 (118 locked) | Shadow: #4c557f@85 | 1px Dark Material Outlines: PASS",
        fill=TEXT_SUB,
        font=font,
    )
    draw.text(
        (24, 58),
        "Scale Ref: ref_mod1_char (22px player @ 1x) shown in header & beside sprites",
        fill=TEXT_SUB,
        font=font,
    )

    # Header scale reference
    sheet.alpha_composite(char_2x, (sheet_w - 130, 14))
    draw.text((sheet_w - 114, 74), "2x", fill=TEXT_SUB, font=font)
    sheet.alpha_composite(char_1x, (sheet_w - 58, 44))
    draw.text((sheet_w - 52, 74), "1x", fill=TEXT_SUB, font=font)

    # 5 cards (3 on row 1, 2 on row 2 + scale lineup card)
    card_w, card_h = 230, 126
    positions = [
        (12, 98),
        (255, 98),
        (498, 98),
        (12, 234),
        (255, 234),
    ]

    for idx, ((name, cam, sp), st) in enumerate(zip(sprites, stats)):
        cx, cy = positions[idx]
        draw.rectangle([cx, cy, cx + card_w, cy + card_h], fill=BG, outline=CARD_BORDER)
        baseline_y = cy + 84
        draw.line([(cx + 10, baseline_y + 2), (cx + card_w - 10, baseline_y + 2)], fill=CARD_BORDER)

        sp_2x = sp.resize((sp.width * 2, sp.height * 2), Image.Resampling.NEAREST)
        # Paste 2x char ref faintly/cleanly or right in card? Keep card crisp: 2x sprite left, 1x sprite center, 1x char ref right!
        x2 = cx + 52 - sp_2x.width // 2
        y2 = baseline_y - sp_2x.height
        sheet.alpha_composite(sp_2x, (x2, y2))

        x1 = cx + 142 - sp.width // 2
        y1 = baseline_y - sp.height
        sheet.alpha_composite(sp, (x1, y1))

        # 1x scale character right next to 1x sprite
        sheet.alpha_composite(char_1x, (cx + 184, baseline_y - char_1x.height + 1))

        draw.text((cx + 10, cy + 90), f"{idx + 1}. {name}", fill=TEXT_MAIN, font=font)
        draw.text(
            (cx + 10, cy + 106),
            f"[{cam}] {st['canvas']} (op {st['opaque_bbox']}, {st['unique_colors']}c)",
            fill=TEXT_SUB,
            font=font,
        )

    # 6th slot: 1x True-Scale Room Lineup next to ref_mod1_char
    lx, ly = (498, 234)
    draw.rectangle([lx, ly, lx + card_w, ly + card_h], fill=BG, outline=CARD_BORDER)
    base_1x = ly + 80
    draw.line([(lx + 10, base_1x + 2), (lx + card_w - 10, base_1x + 2)], fill=CARD_BORDER)
    cur_x = lx + 14
    sheet.alpha_composite(char_1x, (cur_x, base_1x - char_1x.height + 1))
    cur_x += char_1x.width + 6
    for _, _, sp in sprites:
        sheet.alpha_composite(sp, (cur_x, base_1x - sp.height))
        cur_x += sp.width + 8
    draw.text((lx + 10, ly + 90), "True 1x Lineup vs 22px Player", fill=TEXT_MAIN, font=font)
    draw.text((lx + 10, ly + 106), "Instant silhouette & scale check", fill=TEXT_SUB, font=font)

    PREVIEW_PNG.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW_PNG)


def main() -> None:
    palette = load_palette()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    specs = [
        ("cafe_table_oak.png", "topdown", draw_cafe_table_oak(), (32, 16), (28, 30), (14, 15)),
        ("cafe_stool.png", "chair", draw_cafe_stool(), (16, 16), (12, 14), (13, 14)),
        ("vip_sofa_navy.png", "topdown", draw_vip_sofa_navy(), (32, 16), (28, 30), (14, 15)),
        ("storage_locker.png", "standing", draw_storage_locker(), (16, 32), (14, 14), (28, 30)),
        ("standing_floor_lamp.png", "slender", draw_standing_floor_lamp(), (16, 32), (10, 12), (28, 30)),
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
            f"PASS {fname:24s} | canvas={st['canvas']:5s} | opaque={st['opaque_bbox']:5s} "
            f"| margins={st['margins_ltrb']} | colors={st['unique_colors']:2d} | shadow_px={st['shadow_px']}"
        )

    build_contact_sheet(rendered, stats)
    print(f"Wrote contact sheet -> {PREVIEW_PNG}")


if __name__ == "__main__":
    main()
