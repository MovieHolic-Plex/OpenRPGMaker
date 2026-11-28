#!/usr/bin/env python3
"""T2 Ruins Batch 3/4 (5 Nature & Camp Objects) — `fantasy_sky_ruins_carbon`.

Upgrades 5 Nature & Camp objects from `fantasy_sky_ruins` (neon high) to
museum-grade volumetric pixel art strictly locked to the 74-color Beodeul
Ancient Ruins palette (`palette_beodeul_ruins.json`):

1. `beodeul_oak_tree.png`     (32x48, standing, target opaque ~28x42)
2. `flowering_bush_moss.png`  (16x16, standing, target opaque ~14x12)
3. `explorer_camp_tent.png`   (32x32, standing, target opaque ~28x26)
4. `mossy_boulder.png`        (16x16, standing, target opaque ~15x11)
5. `temple_banner_pole.png`   (16x32, slender,  target opaque ~12x29)

Also renders `tiledata/dungeon-dots/fantasy_sky_ruins_carbon/preview_batch3.png`
(2x + 1x on #767670 neutral gray next to Beodeul scale character, plus side-by-side
comparison against previous `neon high` sprites) and runs strict machine checks.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Dict, List, Sequence, Tuple
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
PALETTE_PATH = ROOT / "tiledata/dungeon-dots/fantasy_sky_ruins/palette_beodeul_ruins.json"
OLD_OBJS_DIR = ROOT / "tiledata/dungeon-dots/fantasy_sky_ruins/objects"
REFS_DIR = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs"
OUT_ROOT = ROOT / "tiledata/dungeon-dots/fantasy_sky_ruins_carbon"
OUT_OBJS_DIR = OUT_ROOT / "objects"
PREVIEW_PATH = OUT_ROOT / "preview_batch3.png"

SHADOW_RGBA = (0x4C, 0x55, 0x7F, 85)
TRANSPARENT = (0, 0, 0, 0)


def hex_to_rgba(h: str, alpha: int = 255) -> Tuple[int, int, int, int]:
    c = h.lstrip("#").lower()
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), alpha)


def luma(r: int, g: int, b: int) -> float:
    return 0.299 * r + 0.587 * g + 0.114 * b


def load_locked_palette() -> SetColors:
    data = json.loads(PALETTE_PATH.read_text(encoding="utf-8"))
    colors = {hex_to_rgba(c)[:3] for c in data["colors"]}
    assert len(colors) == 74, f"Expected 74 locked colors, got {len(colors)}"
    assert (0, 0, 0) not in colors, "Forbidden #000000 found in palette"
    return colors


SetColors = set[Tuple[int, int, int]]
ALLOWED_RGB = load_locked_palette()

# Curated semantic token map — every single hex is verified in palette_beodeul_ruins.json!
TOKENS: Dict[str, Tuple[int, int, int, int]] = {
    ".": TRANSPARENT,
    "~": SHADOW_RGBA,
    # Foliage Moss (0..5) — 0,1,2 are DARK<=85
    "f0": hex_to_rgba("#1d2d19"),  # luma 37.9 [DARK]
    "f1": hex_to_rgba("#2d4619"),  # luma 57.4 [DARK]
    "f2": hex_to_rgba("#3d5e24"),  # luma 77.5 [DARK]
    "f3": hex_to_rgba("#5c7728"),  # luma 101.9
    "f4": hex_to_rgba("#8eac43"),  # luma 151.1
    "f5": hex_to_rgba("#a8ca5c"),  # luma 179.3
    # Grass Meadow (0..5) — 0 is DARK<=85
    "g0": hex_to_rgba("#363f2a"),  # luma 57.9 [DARK]
    "g1": hex_to_rgba("#4b6827"),  # luma 87.9
    "g2": hex_to_rgba("#618c3b"),  # luma 117.9
    "g3": hex_to_rgba("#6e9943"),  # luma 130.3
    "g4": hex_to_rgba("#7aa34b"),  # luma 140.7
    "g5": hex_to_rgba("#8bb14e"),  # luma 154.4
    # Wood Oak (0..7) — 0,1,2,3 are DARK<=85
    "w0": hex_to_rgba("#291c13"),  # luma 30.9 [DARK]
    "w1": hex_to_rgba("#452a17"),  # luma 47.9 [DARK]
    "w2": hex_to_rgba("#583a24"),  # luma 64.5 [DARK]
    "w3": hex_to_rgba("#6f4725"),  # luma 79.1 [DARK]
    "w4": hex_to_rgba("#8c6038"),  # luma 104.6
    "w5": hex_to_rgba("#a67d55"),  # luma 132.7
    "w6": hex_to_rgba("#bd936b"),  # luma 155.0
    "w7": hex_to_rgba("#d8aa73"),  # luma 177.5
    # Canvas Parchment (0..5) — 0 is DARK<=85
    "p0": hex_to_rgba("#59503a"),  # luma 80.2 [DARK]
    "p1": hex_to_rgba("#827869"),  # luma 121.3
    "p2": hex_to_rgba("#a69a77"),  # luma 153.6
    "p3": hex_to_rgba("#c2bca7"),  # luma 187.4
    "p4": hex_to_rgba("#d9d2be"),  # luma 209.8
    "p5": hex_to_rgba("#f0e7cc"),  # luma 230.6
    # Stone Limestone (0..8) — 0,1 are DARK<=85
    "s0": hex_to_rgba("#262729"),  # luma 38.9 [DARK]
    "s1": hex_to_rgba("#3e403d"),  # luma 63.1 [DARK]
    "s2": hex_to_rgba("#595b58"),  # luma 90.1
    "s3": hex_to_rgba("#767776"),  # luma 118.6
    "s4": hex_to_rgba("#929491"),  # luma 147.1
    "s5": hex_to_rgba("#afb1ae"),  # luma 176.1
    "s6": hex_to_rgba("#c4c6c3"),  # luma 197.1
    "s7": hex_to_rgba("#dadcd9"),  # luma 219.1
    "s8": hex_to_rgba("#e5e7e4"),  # luma 230.1
    # Stone Slate Dark (0..4) — 0,1 are DARK<=85
    "d0": hex_to_rgba("#2b3436"),  # luma 49.5 [DARK]
    "d1": hex_to_rgba("#40484a"),  # luma 69.8 [DARK]
    "d2": hex_to_rgba("#5b6667"),  # luma 98.8
    "d3": hex_to_rgba("#797a84"),  # luma 122.8
    "d4": hex_to_rgba("#a0a2ac"),  # luma 162.5
    # Iron Bronze (0..4) — 0,1 are DARK<=85
    "i0": hex_to_rgba("#1c1c26"),  # luma 29.1 [DARK]
    "i1": hex_to_rgba("#30384a"),  # luma 55.7 [DARK]
    "i2": hex_to_rgba("#4e5a6b"),  # luma 88.3
    "i3": hex_to_rgba("#72808a"),  # luma 125.0
    "i4": hex_to_rgba("#a0a2ac"),  # luma 162.5
    # Accent Crimson, Ochre, Gold & Blossom Blush — r0,r1,r2 are DARK<=85
    "r0": hex_to_rgba("#491d20"),  # luma 42.5 [DARK]
    "r1": hex_to_rgba("#76302f"),  # luma 68.8 [DARK]
    "r2": hex_to_rgba("#863736"),  # luma 78.5 [DARK]
    "r3": hex_to_rgba("#b9422c"),  # luma 99.1
    "o1": hex_to_rgba("#df722f"),  # luma 139.0
    "o2": hex_to_rgba("#f08a10"),  # luma 154.6
    "y1": hex_to_rgba("#dc9a26"),  # luma 160.5
    "y2": hex_to_rgba("#fbc10d"),  # luma 189.8
    "y3": hex_to_rgba("#fff2a5"),  # luma 237.1
    "k1": hex_to_rgba("#d97163"),  # luma 142.5 (coral-rose blossom)
    "k2": hex_to_rgba("#f4c5b2"),  # luma 208.9 (pale peach-cream petal)
}

for _k, _rgba in TOKENS.items():
    if _rgba[3] == 255:
        assert _rgba[:3] in ALLOWED_RGB, f"Token {_k} {_rgba} not in locked 74-color palette!"


def render_token_grid(w: int, h: int, rows: Sequence[str]) -> Image.Image:
    """Render space-separated 2-char token grid (with '.' or '..' for transparent, '~'/'~~' for shadow)."""
    assert len(rows) == h, f"Expected {h} rows, got {len(rows)}"
    img = Image.new("RGBA", (w, h), TRANSPARENT)
    px = img.load()
    for y, line in enumerate(rows):
        cells = line.split()
        assert len(cells) == w, f"Row {y}: expected {w} tokens, got {len(cells)} -> {line!r}"
        for x, tok in enumerate(cells):
            if tok in ("..", "."):
                px[x, y] = TRANSPARENT
            elif tok in ("~~", "~"):
                px[x, y] = SHADOW_RGBA
            else:
                if tok not in TOKENS:
                    raise KeyError(f"Unknown token {tok!r} at ({x},{y})")
                px[x, y] = TOKENS[tok]
    return img


def add_soft_ground_shadow(
    img: Image.Image,
    cx: float,
    cy: float,
    rx: float,
    ry: float,
) -> None:
    """Place optional #4c557f@85 ground shadow ONLY on currently transparent pixels."""
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            if px[x, y][3] == 0:
                dx = (x - cx) / rx
                dy = (y - cy) / ry
                if dx * dx + dy * dy <= 1.0:
                    px[x, y] = SHADOW_RGBA


# ===========================================================================
# 1. beodeul_oak_tree.png (32x48, standing, target opaque ~28x42)
#    Lush Beodeul oak inspired by ref_bd6_row_3x.png:
#    - Asymmetric multi-lobed crown with crisp leaf-tip notches (never smooth ovals!)
#    - 7 sculpted overlapping leaf boughs in 3 tiers with bright olive-leaf
#      (#a8ca5c / #8eac43) top-left highlights & deep overhanging bough crevices
#    - Forked upper limbs emerging from deep canopy underside shadow
#    - Gnarled bark-textured trunk with bark hollow & 3 flared mossy roots!
# ===========================================================================
def build_beodeul_oak_tree() -> Image.Image:
    # 32 cols (x=0..31), 48 rows (y=0..47)
    # Opaque x=2..29 (28px), y=5..46 (42px) -> exact 28x42!
    # Staggered 3D leaf-cluster domes (like ref_bd6_row_3x.png) — no flat horizontal bands!
    rows = [
        # 0..4: top breathing room
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        # 5..13: Full Asymmetric Twin-Domed Oak Crown with crisp leaf-tuft notches
        ".. .. .. .. .. .. .. .. .. .. f1 f1 f1 f1 f1 f2 .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. f1 f1 f5 f5 f4 f5 f4 g4 f1 f1 f1 f1 f1 .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. f1 f5 f5 f4 f5 g5 g4 g3 g2 f2 f4 f4 g4 g3 f1 f0 .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. f1 f4 f5 f4 g5 g4 f4 g4 g3 f3 f1 f4 g4 g3 g2 g1 f2 f1 .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. f1 f5 f4 g5 g4 g3 f3 g4 g3 g2 g1 f2 g3 g3 f3 g2 g1 f2 f1 f0 .. .. .. .. .. .. ..",
        ".. .. .. .. f1 f4 f4 g4 g3 g2 f3 f2 f4 f5 f4 g3 g2 f3 g2 g1 g1 f2 f1 f2 f1 f0 .. .. .. .. .. ..",
        ".. .. .. .. f1 g4 g3 f3 g2 g1 f2 f1 f5 f5 f4 g5 g4 g3 f3 g1 f2 f1 f0 g2 g1 f1 f0 .. .. .. .. ..",
        ".. .. .. f1 f2 g3 g2 g1 f2 f1 f0 f2 f4 g5 g4 g4 g3 g2 g2 f2 f1 f4 g4 g3 g2 g1 f1 f0 .. .. .. ..",
        # 13..24: Staggered Volumetric Leaf Clusters (Left sunlit puff, Bold central heart dome, Right bough)
        ".. .. .. f1 f5 f5 f4 g4 f2 f1 f4 f5 f4 g4 g3 f3 g3 g2 g1 f1 f2 f4 g4 g3 f3 g1 f2 f1 .. .. .. ..",
        ".. .. f1 f4 f5 f4 g5 g4 g3 f2 f5 f5 g5 g4 g3 g3 f3 g2 g1 f2 f4 g4 g3 g2 f3 g1 f2 f1 f0 .. .. ..",
        ".. .. f1 f5 f4 g5 g4 g3 g2 g3 f4 g5 g4 g3 f3 g2 g2 g1 f2 f1 g3 g3 g2 f3 g1 g1 f2 f1 f0 .. .. ..",
        ".. .. f1 g4 g4 g3 f3 g2 g1 f3 g4 g4 g3 f3 g2 g1 f2 f1 f0 f1 g3 g2 g1 g1 f2 f2 f1 f2 f0 .. .. ..",
        ".. .. f1 g3 f3 g2 g2 g1 f2 f2 g3 g3 g2 g2 g1 f2 f1 f4 f4 f2 f3 g2 g1 f2 f1 f2 g2 f1 f1 f0 .. ..",
        ".. .. f0 f2 g2 g1 f2 f1 f0 f1 f3 g2 g1 f2 f1 f0 f2 f5 f5 g4 g3 g1 f2 f1 f0 f1 g1 f2 f1 f0 .. ..",
        ".. .. .. f0 f1 f2 f1 f4 f5 f4 f2 f1 f1 f0 f1 f4 f4 g5 g4 g3 g2 f2 f1 f2 g3 g2 f2 f1 f0 f0 .. ..",
        ".. .. .. f1 f4 f5 f5 f5 f4 g4 g3 f2 f1 f2 f5 f5 g5 g4 g3 f3 g2 g1 f1 f4 g4 g3 g1 f2 f0 .. .. ..",
        ".. .. .. f1 f5 f4 g5 g4 g4 g3 g2 g2 f2 f4 f4 g4 g4 g3 g2 g2 g1 f2 f2 g3 g3 g2 g1 f1 f0 .. .. ..",
        ".. .. .. f1 g4 g4 g3 f3 g3 g2 g1 g1 f1 g4 g3 g3 f3 g2 g1 f2 f1 f0 f1 g3 g2 g1 f2 f1 f1 f0 .. ..",
        ".. .. .. f0 f2 g3 g2 g2 g1 f2 f2 f1 f0 f3 g3 g2 g1 g1 f2 f1 f0 f1 f2 g2 g1 f2 f1 f1 f0 f0 .. ..",
        ".. .. .. .. f0 f2 g2 g1 f2 f1 f1 f0 f1 f2 g2 g1 f2 f2 f1 f0 f1 g3 g2 g1 f2 f1 f0 f0 .. .. .. ..",
        # 25..34: Irregular Scalloped Lower Bough Clusters + Deep Undercut Shadow + Forked Oak Limbs
        ".. .. .. .. f1 f4 g4 g3 g2 f2 f1 f0 f1 f4 g3 g2 g1 f2 f1 f0 f2 g3 g2 g1 f2 f1 f0 .. .. .. .. ..",
        ".. .. .. .. f1 g4 g3 g2 f3 g1 f2 f1 f2 g3 g2 f3 g1 f2 f1 f1 f2 g2 g1 f2 f1 f1 f0 .. .. .. .. ..",
        ".. .. .. .. f0 f2 g3 g2 g1 f2 f1 f0 f1 f3 g2 g1 f2 f1 f0 f0 f1 g1 g1 f2 f1 f0 .. .. .. .. .. ..",
        ".. .. .. .. .. f0 f2 g1 g1 f2 f1 f0 f0 f2 g1 g1 f2 f1 f0 w0 f0 f2 f2 f1 f0 f0 .. .. .. .. .. ..",
        ".. .. .. .. .. f0 f1 f2 f2 f1 f0 w0 f0 f1 f2 f2 f1 f0 w0 w1 f0 f1 f2 f1 f0 .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. f0 f1 f1 f0 w0 w2 w1 f0 f1 f1 f0 w0 w2 w1 w0 f0 f1 f0 f0 .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. f0 f0 .. w0 w3 w1 w0 f0 f0 f0 w0 w3 w1 w0 .. f0 f0 .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. w0 w3 w2 w0 w0 w0 w2 w2 w0 .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. w0 w4 w3 w1 w1 w2 w2 w1 w0 .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. w0 w5 w4 w2 w3 w2 w1 w0 .. .. .. .. .. .. .. .. .. .. .. ..",
        # 35..46: Sculpted Gnarled Oak Trunk, Bark Furrows, Knot Hollow & Flared Mossy Roots!
        ".. .. .. .. .. .. .. .. .. .. .. .. w0 w5 w4 w2 w3 w2 w1 w0 .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. w0 w6 w5 w3 w4 w2 w1 w0 .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. w0 w6 w5 w2 w1 w3 w1 w0 .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. w0 w5 w4 w0 w1 w3 w2 w0 .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. w0 w5 w6 w4 w3 w4 w2 w1 w0 .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. w0 w6 w5 w4 w2 w3 w2 w1 w1 w0 .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. w0 w5 w6 w4 w2 w4 w3 w1 w2 w1 w0 .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. w0 w5 w6 w4 w2 w0 w5 w3 w1 w3 w2 w1 w0 .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. w0 w5 w6 w4 w2 f1 f3 w5 w4 w1 w1 w3 w2 w1 w0 .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. w0 w6 w4 w2 f1 g3 g2 w4 w3 w0 f1 g1 w2 w1 w1 w0 .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. w0 w3 w2 w0 f0 f2 f1 w3 w1 w0 f0 f1 w1 w2 w1 w0 .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. w0 w0 w0 .. .. f0 w0 w0 w0 .. .. .. w0 w0 w0 w0 .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
    ]
    img = render_token_grid(32, 48, rows)
    add_soft_ground_shadow(img, cx=15.5, cy=45.0, rx=11.5, ry=2.3)
    return img


# ===========================================================================
# 2. flowering_bush_moss.png (16x16, standing, target opaque ~14x12)
#    Plump sculpted leafy shrub (ref_beodeul_props_best_4x.png quality!):
#    - Multi-lobed scalloped leaf puffs (14x12: x=1..14, y=3..14)
#    - Sunlit top-left olive/meadow foliage clusters & deep internal crevices
#    - 5 jewel-like crimson/coral/gold/cream blossoms tucked into leaf cups
# ===========================================================================
def build_flowering_bush_moss() -> Image.Image:
    # 16x16: opaque x=1..14 (14w), y=3..14 (12h)
    rows = [
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. f1 f1 f1 f2 .. f1 f1 f1 .. .. .. ..",
        ".. .. .. f1 f5 f5 f4 g4 f1 g4 f4 g3 f1 .. .. ..",
        ".. .. f1 f4 k2 k1 g5 g4 g3 y3 y2 g3 g2 f1 .. ..",
        ".. f1 f5 g4 y2 r3 g4 g3 f2 o1 g3 g2 f3 g1 f0 ..",
        ".. f1 g4 g3 g3 f3 g3 k2 k1 g2 f3 g2 k1 r3 f1 ..",
        ".. f1 f3 k2 k1 g2 f2 r3 r2 f2 g2 f3 r3 r1 f1 ..",
        ".. f1 g3 r3 g2 g2 g3 g2 f1 f3 g3 g2 g1 f2 f0 ..",
        ".. f0 f2 g2 g1 f3 g3 g2 f2 g2 g1 f2 f2 f1 f0 ..",
        ".. f0 f1 g2 g1 f2 g2 g1 f1 g1 g1 f2 f1 f1 f0 ..",
        ".. .. f0 f2 g1 f1 f2 f1 w1 f1 f2 f1 f1 f0 .. ..",
        ".. .. f0 f1 f2 f1 f0 w1 w2 w0 f1 f2 f1 f0 .. ..",
        ".. .. .. f0 f0 f0 f0 .. w0 .. f0 f0 f0 .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
    ]
    img = render_token_grid(16, 16, rows)
    add_soft_ground_shadow(img, cx=7.5, cy=14.1, rx=6.5, ry=1.4)
    return img


# ===========================================================================
# 3. explorer_camp_tent.png (32x32, standing, target opaque ~28x26)
#    Authentic pitched weathered-canvas adventurer A-frame tent
#    (ref_ezx_row_4x.png & ref_bd9_row_2x.png quality!):
#    - Carved oak ridge beam with lashed protruding pole ends
#    - Sunlit 3/4 brow & storm valance with crimson-gold expedition stripe
#    - Catenary-curved sloped canvas side walls with diagonal tension folds
#      and a stitched canvas field patch
#    - Thick rolled-back parted triangular entrance flaps tied with rope,
#      revealing central upright oak pole & explorer bedroll inside
#    - Taut angled guy-ropes with crisp air gap anchored to wooden stakes!
# ===========================================================================
def build_explorer_camp_tent() -> Image.Image:
    # 32x32: opaque x=2..29 (28w), y=5..30 (26h) -> exact 28x26!
    rows = [
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        # 5..7: Carved oak ridge beam + protruding pole finials + rope lashings
        ".. .. .. .. .. .. .. .. .. .. w1 w0 w0 w0 w0 w0 w0 w0 w0 w0 w0 w1 .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. w0 w7 p4 w6 w7 w6 w6 w5 w5 w4 p3 w5 w3 w0 .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. w0 w3 p0 w2 w3 w2 w2 w2 w1 w1 p0 w2 w1 w0 .. .. .. .. .. .. .. .. ..",
        # 8..15: Sunlit central 3/4 roof brow + catenary-curved sloped canvas side panels + folds
        ".. .. .. .. .. .. .. .. .. p0 p5 p4 p5 p5 p5 p5 p4 p4 p3 p2 p2 p1 p0 .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. p0 p5 p4 p3 p5 p5 p5 p4 p4 p3 p3 p2 p2 p1 p1 p0 .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. p0 p4 p5 p3 p5 p5 p4 p4 p4 p3 p2 p2 p1 p2 p1 p0 .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. p0 p5 p4 p3 p2 p5 p5 p4 p4 p3 p3 p2 p1 p1 p1 p1 p1 p0 .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. p0 p4 p5 p3 p2 p4 p4 p4 p3 p3 p3 p2 p1 p2 p1 p1 p0 p0 .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. p0 p5 p4 p3 p3 p1 p5 p5 p5 p4 p4 p3 p2 p1 p2 p1 p1 p1 p1 p0 .. .. .. .. .. ..",
        ".. .. .. .. .. .. p0 p4 p3 p2 p2 p1 r3 r3 y2 y2 r3 r3 r2 p1 p1 p2 p1 p1 p1 p0 .. .. .. .. .. ..",
        ".. .. .. .. .. .. p0 p5 p4 p3 p4 p0 p5 p5 p4 p4 p3 p3 p2 p0 p2 p1 p1 p1 p0 p0 .. .. .. .. .. ..",
        # 16..21: Overhang shadow + parted rolled entrance flaps + interior pole + guy-rope grommets
        ".. .. .. .. .. p0 p4 p3 p2 p3 p2 w1 w0 w0 w0 w0 w0 w0 w0 w1 p1 p2 p1 p1 p1 p0 .. .. .. .. .. ..",
        ".. .. .. .. .. p0 p5 p4 p2 p3 p2 p5 p4 w0 w1 w0 i0 i0 p3 p1 p1 p1 p2 p1 p1 p0 .. .. .. .. .. ..",
        ".. .. .. .. .. p0 p4 p3 p2 p0 p1 p5 p4 w1 w5 w2 i0 i0 p3 p2 p0 p1 p1 p1 p1 p0 p0 .. .. .. .. ..",
        ".. .. .. .. p0 w6 p0 p3 p3 p2 p1 p4 p3 w0 w4 w1 i0 i0 p2 p1 p1 p1 p2 p1 p0 p0 w5 p0 .. .. .. ..",
        ".. .. .. .. p0 w7 p0 p4 p3 p2 p5 p4 p2 i0 w4 w1 i0 i0 i0 p3 p2 p1 p1 p1 p0 p0 w5 p0 .. .. .. ..",
        ".. .. .. p0 w6 p0 p0 p4 p3 p2 p5 p4 p3 w1 w3 w1 i0 i0 i0 w1 p2 p1 p1 p1 p0 p0 p0 w4 p0 .. .. ..",
        # 22..30: Distinct taut guy-ropes with clean air gap + flap ties + explorer bedroll + wooden stakes!
        ".. .. .. p0 w7 p0 p4 p3 p2 w7 w5 p4 p2 i0 w3 w1 r2 r1 i0 i0 p2 p1 w6 w4 p1 p0 p0 w5 p0 .. .. ..",
        ".. .. p0 w6 p0 .. p0 p4 p3 p5 p4 p3 w1 i0 w2 w1 r3 r2 r1 w1 p2 p1 p2 p1 p1 p0 .. p0 w4 p0 .. ..",
        ".. .. p0 w7 p0 .. p0 p4 p3 p4 p3 p2 i0 i0 w2 w1 r3 r1 w5 i0 p2 p1 p1 p1 p1 p0 .. p0 w5 p0 .. ..",
        ".. .. w0 w6 w0 .. p0 p3 p2 p4 p3 w1 i0 w5 w6 r3 r2 w5 w4 i0 w1 p2 p1 p0 p1 p0 .. w0 w5 w0 .. ..",
        ".. .. w0 w7 w1 .. p0 p3 p2 p3 p2 i0 i0 w4 w3 r1 r0 w3 w2 i0 i0 p1 p1 p0 p0 p0 .. w1 w6 w0 .. ..",
        ".. .. w0 w5 w1 .. p0 p3 p2 p3 w1 i0 w1 w2 w1 w1 w1 w1 w1 i0 i0 w1 p1 p1 p0 p0 .. w1 w4 w0 .. ..",
        ".. .. w0 w3 w0 .. p0 p2 p1 p2 w1 w1 w2 w1 w1 w0 w0 w1 w1 w1 w1 w1 p1 p0 p0 p0 .. w0 w2 w0 .. ..",
        ".. .. w0 w0 .. .. p0 p0 p0 p0 w0 w0 w0 w0 w0 w0 w0 w0 w0 w0 w0 w0 p0 p0 p0 p0 .. .. w0 w0 .. ..",
        ".. .. w0 .. .. .. .. w0 w0 .. .. .. .. .. .. .. .. .. .. .. .. .. .. w0 w0 .. .. .. .. w0 .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
    ]
    img = render_token_grid(32, 32, rows)
    add_soft_ground_shadow(img, cx=15.5, cy=29.5, rx=14.0, ry=2.0)
    return img


# ===========================================================================
# 4. mossy_boulder.png (16x16, standing, target opaque ~15x11)
#    Sculpted faceted limestone boulder (ref_ezx_row_4x.png rock quality!):
#    - Polyhedral chiseled limestone planes with sharp central arrête ridge
#    - Sunlit top-left plateau (#e5e7e4 / #dadcd9) vs steep cool-slate right
#      shadow face (#5b6667 / #40484a / #2b3436) & wedged right stone toe
#    - Lush velvet-green moss cap draped across upper crown & fissure!
# ===========================================================================
def build_mossy_boulder() -> Image.Image:
    # 16x16: opaque x=1..15 (15w), y=4..14 (11h) -> exact 15x11!
    rows = [
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. f1 f1 f1 f1 f2 s1 s1 .. .. .. .. ..",
        ".. .. .. f1 f5 f5 f4 g4 g3 s8 s7 s1 s1 .. .. ..",
        ".. .. f1 f4 f5 f4 g3 g2 f2 s8 s6 s5 d2 d1 .. ..",
        ".. f1 g4 g3 g2 f2 f1 g2 f1 s7 s5 d2 d2 d1 .. ..",
        ".. s1 s6 f2 f1 s7 s7 s6 s6 s5 d3 d2 d1 d0 s0 ..",
        ".. s1 s7 s7 s6 s6 s6 s5 s4 d2 d2 d1 s1 s5 s1 s0",
        ".. s1 s6 s6 s5 s5 s4 s3 d2 d1 d1 s1 s5 s3 d1 s0",
        ".. s0 s5 s4 s4 s3 s3 d2 d1 d1 d0 s1 s3 d2 d1 s0",
        ".. s0 s3 s3 s2 s2 d2 d1 d0 d0 d0 s0 d2 d1 d0 s0",
        ".. .. s0 s2 s2 d1 d1 d0 d0 s0 s0 s0 d1 d0 s0 ..",
        ".. .. .. s0 s0 s0 s0 s0 s0 .. .. s0 s0 s0 .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
    ]
    img = render_token_grid(16, 16, rows)
    add_soft_ground_shadow(img, cx=8.0, cy=14.1, rx=7.0, ry=1.4)
    return img


# ===========================================================================
# 5. temple_banner_pole.png (16x32, slender, target opaque ~12x29)
#    Tall carved dark-wood & iron sanctuary banner pole:
#    - Gilded spear finial at crest (#fff2a5 / #fbc10d / #dc9a26)
#    - Carved dark-oak crossbar with gilded bronze end-knobs & iron collar
#    - Volumetric crimson-and-gold temple pennant with vertical cloth drape
#      folds, open winged golden sun-sanctuary crest & swallowtail tassels
#    - Carved beveled ancient limestone pole socket with a touch of moss!
# ===========================================================================
def build_temple_banner_pole() -> Image.Image:
    # 16x32: opaque x=2..13 (12w), y=2..30 (29h) -> exact 12x29!
    rows = [
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        # 2..6: Gilded spearhead finial + iron mounting collar
        ".. .. .. .. .. .. .. w1 w0 .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. w1 y3 y2 w0 .. .. .. .. .. ..",
        ".. .. .. .. .. .. w1 y3 y1 w1 .. .. .. .. .. ..",
        ".. .. .. .. .. .. w0 y2 o1 w0 .. .. .. .. .. ..",
        ".. .. .. .. .. .. i0 i4 i2 i0 .. .. .. .. .. ..",
        # 7..9: Carved dark-oak crossbar (x=2..13) with gilded finials & crimson loops
        ".. .. w1 w0 r1 w0 w0 i1 i0 w0 w0 r1 w0 w0 .. ..",
        ".. .. w1 y3 r3 w6 w5 i4 i2 w4 w3 r2 y2 w1 .. ..",
        ".. .. w0 w2 r0 w2 w1 i1 i0 w1 w1 r0 w1 w0 .. ..",
        # 10..24: Hanging crimson-and-gold temple pennant with open winged sun-crest & swallowtail hem
        ".. .. .. .. r1 r2 r0 r1 r0 r0 r0 r0 .. .. .. ..",
        ".. .. .. .. r1 y3 y2 y1 y2 y1 o1 r0 .. .. .. ..",
        ".. .. .. .. r1 r3 k1 r2 r3 r2 r1 r0 .. .. .. ..",
        ".. .. .. .. r1 y3 r3 y3 y2 r2 y2 r0 .. .. .. ..",
        ".. .. .. .. r1 y2 r2 y3 y2 r1 y1 r0 .. .. .. ..",
        ".. .. .. .. r1 y2 y2 y3 y2 y1 o1 r0 .. .. .. ..",
        ".. .. .. .. r1 r3 y2 y1 y1 o1 r1 r0 .. .. .. ..",
        ".. .. .. .. r1 r3 r3 r2 r3 r2 r1 r0 .. .. .. ..",
        ".. .. .. .. r1 r3 r2 r1 r3 r2 r1 r0 .. .. .. ..",
        ".. .. .. .. r1 r3 r2 r1 r2 r1 r1 r0 .. .. .. ..",
        ".. .. .. .. r1 y3 y2 y1 y2 y1 o1 r0 .. .. .. ..",
        ".. .. .. .. r1 r3 y2 r0 r0 y1 r1 r0 .. .. .. ..",
        ".. .. .. .. r1 y3 r2 w5 w2 r2 y2 r0 .. .. .. ..",
        ".. .. .. .. r0 y1 r0 w5 w2 r0 o1 r0 .. .. .. ..",
        ".. .. .. .. .. r0 w0 w5 w2 w0 r0 .. .. .. .. ..",
        # 25..30: Iron shaft ring + carved stepped limestone pole socket with moss accent
        ".. .. .. .. .. .. i0 i4 i2 i0 .. .. .. .. .. ..",
        ".. .. .. .. .. s1 s7 s6 s5 s3 s0 .. .. .. .. ..",
        ".. .. .. .. .. s1 s6 s4 s3 s2 s0 .. .. .. .. ..",
        ".. .. .. .. s1 s7 s6 s5 s4 s3 d1 s0 .. .. .. ..",
        ".. .. .. .. s0 g2 f2 s4 s3 d2 d1 s0 .. .. .. ..",
        ".. .. .. .. s0 f1 s0 s0 s0 s0 s0 s0 .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
    ]
    img = render_token_grid(16, 32, rows)
    add_soft_ground_shadow(img, cx=7.5, cy=30.2, rx=5.2, ry=1.3)
    return img


SPRITE_SPECS = [
    ("beodeul_oak_tree.png", "R12 Beodeul Oak Tree", (32, 48), "standing", (28, 42), build_beodeul_oak_tree),
    ("flowering_bush_moss.png", "R13 Flowering Moss Bush", (16, 16), "standing", (14, 12), build_flowering_bush_moss),
    ("explorer_camp_tent.png", "R14 Explorer Camp Tent", (32, 32), "standing", (28, 26), build_explorer_camp_tent),
    ("mossy_boulder.png", "R19 Mossy Limestone Boulder", (16, 16), "standing", (15, 11), build_mossy_boulder),
    ("temple_banner_pole.png", "R11 Temple Banner Pole", (16, 32), "slender", (12, 29), build_temple_banner_pole),
]


def validate_sprite(
    filename: str,
    img: Image.Image,
    expected_canvas: Tuple[int, int],
) -> Tuple[List[str], Dict[str, object]]:
    errors: List[str] = []
    w, h = img.size
    if (w, h) != expected_canvas:
        errors.append(f"{filename}: canvas {w}x{h} != expected {expected_canvas}")

    px = img.load()
    opaque_xs: List[int] = []
    opaque_ys: List[int] = []
    off_palette = 0
    pure_black = 0
    bad_alpha = 0
    edge_total = 0
    edge_bright = 0
    used_colors = set()

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            elif a == 255:
                opaque_xs.append(x)
                opaque_ys.append(y)
                used_colors.add((r, g, b))
                if (r, g, b) == (0, 0, 0):
                    pure_black += 1
                if (r, g, b) not in ALLOWED_RGB:
                    off_palette += 1
                touches_non_opaque = False
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if not (0 <= nx < w and 0 <= ny < h) or px[nx, ny][3] != 255:
                        touches_non_opaque = True
                        break
                if touches_non_opaque:
                    edge_total += 1
                    if luma(r, g, b) > 85.0:
                        edge_bright += 1
                        errors.append(
                            f"{filename}: bright outer-edge pixel at ({x},{y}) "
                            f"#{r:02x}{g:02x}{b:02x} luma={luma(r,g,b):.1f} > 85"
                        )
            else:
                if (r, g, b, a) != SHADOW_RGBA:
                    bad_alpha += 1

    if off_palette:
        errors.append(f"{filename}: {off_palette} off-palette pixels")
    if pure_black:
        errors.append(f"{filename}: {pure_black} pure #000000 pixels")
    if bad_alpha:
        errors.append(f"{filename}: {bad_alpha} illegal semi-transparent pixels")
    if not opaque_xs:
        errors.append(f"{filename}: empty image")
        return errors, {}

    ow = max(opaque_xs) - min(opaque_xs) + 1
    oh = max(opaque_ys) - min(opaque_ys) + 1
    left_gap = min(opaque_xs)
    right_gap = (w - 1) - max(opaque_xs)
    bottom_gap = (h - 1) - max(opaque_ys)

    if abs(left_gap - right_gap) > 2:
        errors.append(f"{filename}: not horizontally centered (left={left_gap}, right={right_gap})")
    if bottom_gap > 2:
        errors.append(f"{filename}: not bottom-aligned (bottom_gap={bottom_gap})")
    if ow / w < 0.45 or oh / h < 0.65:
        errors.append(f"{filename}: undersized bbox {ow}x{oh} in {w}x{h}")

    metrics = {
        "canvas": (w, h),
        "opaque": (ow, oh),
        "colors": len(used_colors),
        "edge_bright": edge_bright,
        "edge_total": edge_total,
        "left_gap": left_gap,
        "right_gap": right_gap,
        "bottom_gap": bottom_gap,
    }
    return errors, metrics


def render_preview_batch3(sprites: Dict[str, Image.Image], metrics: Dict[str, Dict[str, object]]) -> None:
    """Render 2x + 1x on #767670 neutral gray right next to Beodeul scale char,
    plus Old Neon 2x vs New Carbon 2x + 1x comparison row!
    """
    GRAY_BG = (0x76, 0x76, 0x70, 255)
    HEADER_BG = (0x5A, 0x5A, 0x54, 255)
    CARD_HDR = (0x66, 0x66, 0x60, 255)
    LINE_COL = (0x8C, 0x8C, 0x84, 255)
    TEXT_COL = (244, 244, 238, 255)
    MUTED_COL = (212, 212, 204, 255)
    ACCENT_COL = (188, 230, 130, 255)

    char_4x = Image.open(REFS_DIR / "ref_beodeul_char_4x.png").convert("RGBA")
    char_1x = char_4x.resize((char_4x.width // 4, char_4x.height // 4), Image.Resampling.NEAREST)
    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.Resampling.NEAREST)

    cols = 5
    cell_w = 216
    cell_h = 168
    comp_h = 142
    pad = 12
    header_h = 78

    sheet_w = pad + cols * (cell_w + pad)
    sheet_h = header_h + pad + cell_h + pad + comp_h + pad
    sheet = Image.new("RGBA", (sheet_w, sheet_h), GRAY_BG)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    # Header
    draw.rectangle([0, 0, sheet_w - 1, header_h - 1], fill=HEADER_BG)
    draw.line([(0, header_h - 1), (sheet_w - 1, header_h - 1)], fill=LINE_COL)
    sheet.alpha_composite(char_2x, (16, header_h - 10 - char_2x.height))
    sheet.alpha_composite(char_1x, (16 + char_2x.width + 10, header_h - 10 - char_1x.height))

    draw.text(
        (108, 12),
        "FANTASY SKY RUINS CARBON -- BATCH 3/4 (5 NATURE & CAMP OBJECTS)",
        fill=TEXT_COL,
        font=font,
    )
    draw.text(
        (108, 32),
        f"Locked 74-Color Beodeul Palette | 0 Off-Palette | 0 #000000 | Shadow #4c557f@85 | Scale Ref: Beodeul Char 2x ({char_2x.width}x{char_2x.height}) & 1x ({char_1x.width}x{char_1x.height})",
        fill=MUTED_COL,
        font=font,
    )
    draw.text(
        (108, 50),
        "Top Row: [Beodeul Char 2x + Carbon 2x + Carbon 1x] on #767670   |   Bottom Row: [Old Neon High 2x] vs [New Carbon 2x]",
        fill=ACCENT_COL,
        font=font,
    )

    for idx, (fname, title, canvas, cam, _target_op, _fn) in enumerate(SPRITE_SPECS):
        x0 = pad + idx * (cell_w + pad)
        y0 = header_h + pad

        # Top cell: Carbon 2x + 1x next to Beodeul char 2x on #767670
        draw.rectangle([x0, y0, x0 + cell_w - 1, y0 + cell_h - 1], fill=GRAY_BG, outline=LINE_COL)
        draw.rectangle([x0 + 1, y0 + 1, x0 + cell_w - 2, y0 + 22], fill=CARD_HDR)
        draw.text((x0 + 6, y0 + 6), title, fill=TEXT_COL, font=font)

        img1 = sprites[fname]
        img2 = img1.resize((img1.width * 2, img1.height * 2), Image.Resampling.NEAREST)
        m = metrics[fname]
        op_w, op_h = m["opaque"]  # type: ignore[misc]

        baseline = y0 + cell_h - 24
        group_w = char_2x.width + 12 + img2.width + 12 + img1.width
        sx = x0 + max(8, (cell_w - group_w) // 2)

        sheet.alpha_composite(char_2x, (sx, baseline - char_2x.height))
        sheet.alpha_composite(img2, (sx + char_2x.width + 12, baseline - img2.height))
        sheet.alpha_composite(img1, (sx + char_2x.width + 12 + img2.width + 12, baseline - img1.height))

        draw.text(
            (x0 + 6, y0 + cell_h - 16),
            f"{canvas[0]}x{canvas[1]} op={op_w}x{op_h} {cam} ({m['colors']}c)",
            fill=MUTED_COL,
            font=font,
        )

        # Bottom cell: Old Neon 2x vs New Carbon 2x
        cy0 = y0 + cell_h + pad
        draw.rectangle([x0, cy0, x0 + cell_w - 1, cy0 + comp_h - 1], fill=GRAY_BG, outline=LINE_COL)
        draw.rectangle([x0 + 1, cy0 + 1, x0 + cell_w - 2, cy0 + 20], fill=CARD_HDR)
        draw.text((x0 + 6, cy0 + 5), "OLD Neon 2x   ->   NEW Carbon 2x", fill=MUTED_COL, font=font)

        c_base = cy0 + comp_h - 12
        old_path = OLD_OBJS_DIR / fname
        if old_path.exists():
            old1 = Image.open(old_path).convert("RGBA")
            old2 = old1.resize((old1.width * 2, old1.height * 2), Image.Resampling.NEAREST)
            pair_w = old2.width + 26 + img2.width
            px0 = x0 + max(8, (cell_w - pair_w) // 2)
            sheet.alpha_composite(old2, (px0, c_base - old2.height))
            draw.text((px0 + old2.width + 7, c_base - 34), "->", fill=ACCENT_COL, font=font)
            sheet.alpha_composite(img2, (px0 + old2.width + 26, c_base - img2.height))

    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW_PATH)


def main() -> int:
    OUT_OBJS_DIR.mkdir(parents=True, exist_ok=True)
    all_errors: List[str] = []
    sprites: Dict[str, Image.Image] = {}
    metrics_map: Dict[str, Dict[str, object]] = {}

    print("=== FANTASY SKY RUINS CARBON — BATCH 3 (NATURE & CAMP) ===")
    for fname, _title, canvas, cam, target_op, builder in SPRITE_SPECS:
        img = builder()
        out_path = OUT_OBJS_DIR / fname
        img.save(out_path)
        errs, m = validate_sprite(fname, img, canvas)
        all_errors.extend(errs)
        sprites[fname] = img
        metrics_map[fname] = m
        op = m.get("opaque", (0, 0))
        print(
            f"  {fname:26s} canvas={canvas[0]:2d}x{canvas[1]:2d}  "
            f"opaque={op[0]:2d}x{op[1]:2d} (target ~{target_op[0]}x{target_op[1]})  "
            f"cam={cam:8s}  colors={m.get('colors', 0):2d}  "
            f"bright_edge={m.get('edge_bright', 0)}/{m.get('edge_total', 0)}"
        )

    render_preview_batch3(sprites, metrics_map)
    print(f"Preview written to: {PREVIEW_PATH}")

    if all_errors:
        print(f"\nFAIL ({len(all_errors)} errors):")
        for e in all_errors:
            print(f"  - {e}")
        return 1

    print("\nPASS: 100% palette-locked (74 colors), 0 #000000, strict alpha, 0 bright outer edges!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
