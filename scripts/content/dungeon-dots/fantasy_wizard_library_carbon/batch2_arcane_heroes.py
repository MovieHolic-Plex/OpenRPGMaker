#!/usr/bin/env python3
"""
T2 Library Batch 2/4 — 5 Museum-Grade Arcane Hero Objects (`fantasy_wizard_library_carbon`)
Model: gemini-4-carbon (medium)

Sprites:
  1. stone_fireplace_lit.png      (32x32, standing, op 28x30)
  2. brass_orrery_stand.png       (32x32, standing, op 26x30)
  3. gilded_lectern_tome.png      (16x32, standing, op 14x29)
  4. scrying_crystal_pedestal.png (16x32, standing, op 12x29)
  5. arcane_rune_rug.png          (48x32, topdown,  op 46x30)

Hard Rules Enforced:
  - 100% locked to palette_beodeul_library.json (70 colors, 0 off-palette, 0 #000000).
  - Optional ground shadow ONLY #4c557f @ alpha 85/255; all other pixels alpha 0 or 255.
  - Strict 1px dark material outer outline on every opaque pixel touching non-opaque (4-connected).
  - Standing = front + 1/4-1/3 lit top band, ZERO side walls; Topdown = flat from above.
"""

from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
PALETTE_PATH = ROOT / "tiledata/dungeon-dots/fantasy_wizard_library/palette_beodeul_library.json"
OLD_OBJ_DIR = ROOT / "tiledata/dungeon-dots/fantasy_wizard_library/objects"
CHAR_REF_4X = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs/ref_beodeul_char_4x.png"
OUT_DIR = ROOT / "tiledata/dungeon-dots/fantasy_wizard_library_carbon/objects"
PREVIEW_PATH = ROOT / "tiledata/dungeon-dots/fantasy_wizard_library_carbon/preview_batch2.png"

SHADOW_RGBA = (0x4C, 0x55, 0x7F, 85)  # #4c557f @ alpha 85/255


def hex_to_rgba(hx: str) -> tuple[int, int, int, int]:
    hx = hx.lstrip("#")
    return (int(hx[0:2], 16), int(hx[2:4], 16), int(hx[4:6], 16), 255)


def luma(r: int, g: int, b: int) -> float:
    return 0.299 * r + 0.587 * g + 0.114 * b


# Exact 70-color Beodeul Wizard Library token table (palette_beodeul_library.json)
TOKENS: dict[str, str] = {
    # Stone (8)
    "so": "#27282f",
    "s0": "#37383f",
    "s1": "#53545a",
    "s2": "#6c6e6d",
    "s3": "#828382",
    "s4": "#a6a8a5",
    "s5": "#c4c6c3",
    "s6": "#dadcd9",
    # Slate (6)
    "lo": "#1c1c26",
    "l0": "#2b2e34",
    "l1": "#404349",
    "l2": "#5a5b62",
    "l3": "#797a82",
    "l4": "#a0a2ac",
    # Dark Oak (6)
    "do": "#1f130b",
    "d0": "#2d1c12",
    "d1": "#442c19",
    "d2": "#60402b",
    "d3": "#805338",
    "d4": "#a56846",
    # Oak (7)
    "oo": "#382315",
    "o0": "#583a24",
    "o1": "#774d2a",
    "o2": "#9a6841",
    "o3": "#bd9056",
    "o4": "#d8aa73",
    "o5": "#e9c28e",
    # Iron (5)
    "io": "#141b2c",
    "i0": "#28303c",
    "i1": "#424956",
    "i2": "#697782",
    "i3": "#aebdca",
    # Brass (6)
    "bo": "#4e3d22",
    "b0": "#72552b",
    "b1": "#a6874c",
    "b2": "#c9aa64",
    "b3": "#efc97b",
    "b4": "#fff0c0",
    # Parchment (5)
    "po": "#5f5145",
    "p0": "#8e8574",
    "p1": "#beb6a1",
    "p2": "#ded6bc",
    "p3": "#f2e6cf",
    # Crimson (5)
    "ro": "#421b1d",
    "r0": "#6b2c2b",
    "r1": "#8c3938",
    "r2": "#a44332",
    "r3": "#c65340",
    # Flame (5)
    "f0": "#b8280e",
    "f1": "#e0482a",
    "f2": "#f08a10",
    "f3": "#f2c74a",
    "f4": "#fff2a5",
    # Teal (6)
    "to": "#0c2222",
    "t0": "#1a4640",
    "t1": "#2a6f71",
    "t2": "#3fa2ae",
    "t3": "#84c8ce",
    "t4": "#cff4f8",
    # Indigo (4)
    "no": "#141231",
    "n0": "#26305a",
    "n1": "#3b4f88",
    "n2": "#7899bf",
    # Moss (5)
    "mo": "#1d2d19",
    "m0": "#355136",
    "m1": "#518153",
    "m2": "#76a86a",
    "m3": "#a8ca5c",
    # Plum (2)
    "u0": "#492545",
    "u1": "#772f49",
}

# Strict dark material outline hexes (all luma <= 63.0, zero pure black)
DARK_OUTLINE_HEXES = {
    "#27282f",  # so stone_out
    "#37383f",  # s0 stone_0
    "#1c1c26",  # lo slate_out
    "#2b2e34",  # l0 slate_0
    "#1f130b",  # do dark_oak_out
    "#2d1c12",  # d0 dark_oak_0
    "#382315",  # oo oak_out
    "#141b2c",  # io iron_out
    "#28303c",  # i0 iron_0
    "#4e3d22",  # bo brass_out
    "#421b1d",  # ro crimson_out
    "#0c2222",  # to teal_out
    "#141231",  # no indigo_out
    "#1d2d19",  # mo moss_out
}


def parse_grid(rows: list[str], w: int, h: int, name: str) -> Image.Image:
    """Parse space-separated 2-char token grid ('..' = transparent, '~~' = #4c557f@85)."""
    assert len(rows) == h, f"{name}: expected {h} rows, got {len(rows)}"
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    for y, line in enumerate(rows):
        cells = line.split()
        assert len(cells) == w, f"{name} row {y:02d}: expected {w} cells, got {len(cells)} -> {line}"
        for x, tok in enumerate(cells):
            if tok == "..":
                px[x, y] = (0, 0, 0, 0)
            elif tok == "~~":
                px[x, y] = SHADOW_RGBA
            else:
                assert tok in TOKENS, f"{name} ({x},{y}): unknown token '{tok}'"
                px[x, y] = hex_to_rgba(TOKENS[tok])
    return im


# ==============================================================================
# 1. stone_fireplace_lit.png (32x32, standing, op 28x30: cols 2..29, rows 1..30)
# Sculpted dressed-stone Gothic hearth:
# - Overhanging 28px beveled stone mantle shelf (3/4 lit top band, zero side walls)
# - Carved corbel brackets & proud Gothic wedge keystone with brass escutcheon
# - Staggered beveled ashlar masonry piers + radiating voussoir arch stones
# - Warm amber/gold inner bounce glow on arch & jamb chamfers
# - Multi-tongue roaring flame (cream-white core -> gold -> amber -> vermilion -> crimson)
# - Charred split oak logs, glowing crimson ember bed & brass-tipped iron andirons
# - Protruding 28px stepped hearth flagstones bathed in warm golden firelight
# ==============================================================================
STONE_FIREPLACE_ROWS = [
    # 00      04          08          12          16          20          24          28      31
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 00
    ".. .. .. so so so so so so so so so so so so so so so so so so so so so so so so so so .. .. ..",  # 01: mantle back edge
    ".. .. so s6 s6 s5 s5 s5 s5 s4 s3 s5 s5 s4 s4 s4 s4 s4 s4 s4 s3 s2 s4 s4 s3 s3 s3 s2 s2 so .. ..",  # 02: 3/4 lit mantle top
    ".. .. so s6 s5 s5 s4 s4 s4 s4 s2 s4 s4 s4 s4 s3 s3 s3 s3 s3 s3 s1 s3 s3 s3 s2 s2 s2 s1 so .. ..",  # 03: 3/4 mantle slab mid
    ".. .. so s6 s6 s6 s5 s5 s5 s5 s3 s5 s5 s5 s5 s4 s4 s4 s4 s4 s4 s2 s4 s4 s4 s3 s3 s3 s2 so .. ..",  # 04: crisp front bevel lip
    ".. .. so s4 s3 s2 s3 s2 s1 s2 s1 s2 s2 s3 b3 b4 b3 b1 s2 s2 s1 s0 s2 s1 s2 s1 s1 s0 s0 so .. ..",  # 05: cornice + brass crest
    ".. .. .. so s2 s4 s3 s2 s1 s0 l0 l0 s0 s1 s6 s5 s4 s2 s0 l0 l0 s0 s1 s3 s2 s1 s0 so .. .. .. ..",  # 06: corbels & keystone top
    ".. .. .. .. so s5 s5 s4 s3 s1 s4 s4 s3 s0 s6 s6 s4 s2 s0 s3 s3 s1 s3 s3 s2 s2 s1 so .. .. .. ..",  # 07: ashlar + crisp keystone
    ".. .. .. .. so s5 s4 s3 s3 s1 s3 s5 s4 s0 s6 s5 s3 s1 s0 s4 s3 s1 s3 s2 s2 s1 s1 so .. .. .. ..",  # 08: voussoirs + crisp keystone
    ".. .. .. .. so s1 s1 s1 s1 s0 s4 s4 s3 s2 s5 o4 o3 s1 s2 s3 s2 s0 s1 s1 s1 s1 s0 so .. .. .. ..",  # 09: mortar + warm keystone tip
    ".. .. .. .. so s5 s5 s4 s2 s4 s5 s4 s3 o3 o4 o3 b2 o2 o2 s3 s2 s3 s2 s4 s3 s3 s2 so .. .. .. ..",  # 10: Gothic arch crown glow
    ".. .. .. .. so s5 s4 s4 s1 s4 s4 s3 o3 o2 lo d0 ro lo o2 o1 s2 s2 s1 s4 s3 s2 s1 so .. .. .. ..",  # 11: upper soot firebox
    ".. .. .. .. so s4 s3 s3 s1 s3 s3 o3 o2 lo r0 lo f2 d0 ro lo o1 s2 s1 s3 s2 s2 s1 so .. .. .. ..",  # 12: rising ember spark
    ".. .. .. .. so s1 s1 s1 s0 s3 o3 o1 lo d0 r0 f1 f2 r0 lo r1 lo o1 s1 s0 s1 s1 s0 so .. .. .. ..",  # 13: central flame tip
    ".. .. .. .. so s5 s5 s3 s4 o3 o2 lo r0 d0 r1 f1 f3 f1 r0 d0 f2 lo o1 s2 s4 s3 s2 so .. .. .. ..",  # 14: arched springers + spark
    ".. .. .. .. so s5 s4 s2 s3 o3 d0 r0 r1 f0 r1 f2 f3 f2 f0 r1 f1 d0 o1 s1 s4 s3 s1 so .. .. .. ..",  # 15: 3 dancing flame licks
    ".. .. .. .. so s4 s3 s1 s3 o3 lo r1 f1 f2 f0 f2 f4 f3 f1 f2 f0 lo o1 s1 s3 s2 s1 so .. .. .. ..",  # 16: roaring layered tongues
    ".. .. .. .. so s1 s1 s0 s2 o4 d0 f0 f2 f3 f1 f3 f4 f3 f2 f3 f1 d0 o2 s0 s1 s1 s0 so .. .. .. ..",  # 17: mortar seam + blaze
    ".. .. .. .. so s5 s5 s4 s3 o4 r1 f1 f3 f3 f2 f4 f4 f4 f2 f3 f2 r1 o2 s2 s4 s3 s2 so .. .. .. ..",  # 18: intense gold-cream heart
    ".. .. .. .. so s5 s4 s3 s2 o5 r2 f1 f3 f4 f3 f4 b4 f4 f3 f4 f2 r2 o3 s1 s3 s2 s1 so .. .. .. ..",  # 19: white-hot cream core
    ".. .. .. .. so s4 s3 s3 s1 o5 f0 f2 f3 f4 f4 b4 b4 f4 f4 f3 f2 f0 o3 s1 s3 s2 s1 so .. .. .. ..",  # 20: peak hearth radiance
    ".. .. .. .. so s1 s1 s1 s0 o4 b4 f1 f2 f3 f4 b4 f4 f4 f3 f2 f1 b3 o2 s0 s1 s1 s0 so .. .. .. ..",  # 21: brass andiron finials!
    ".. .. .. .. so s5 s5 s3 s4 o3 i2 f0 f1 f2 f3 f4 f4 f3 f2 f1 f0 i1 o2 s2 s4 s3 s2 so .. .. .. ..",  # 22: iron andirons + flame base
    ".. .. .. .. so s5 s4 s2 s3 o3 i1 d1 d2 f1 d0 d1 f3 d1 d0 f1 d2 i0 o1 s1 s3 s2 s1 so .. .. .. ..",  # 23: split charred oak logs
    ".. .. .. .. so s4 s3 s1 s2 o2 io i2 i1 d0 f2 f1 d0 f2 f1 d0 i1 io o1 s1 s3 s2 s1 so .. .. .. ..",  # 24: wrought-iron grate + logs
    ".. .. .. .. so s1 s1 s0 s2 o2 io d0 r2 f1 f3 f2 r2 f2 f1 r1 d0 io o1 s0 s1 s1 s0 so .. .. .. ..",  # 25: hot glowing embers
    ".. .. .. so so s4 s4 s3 s2 o1 io r0 r1 f0 f1 f1 f0 f1 r2 r0 r0 io o1 s2 s3 s2 s1 so so .. .. ..",  # 26: crimson coal bed + base flare
    ".. .. so s6 s5 s5 s4 s3 s4 s4 o4 o5 b3 f3 b4 b4 f3 b3 o5 o4 s4 s3 s3 s2 s4 s3 s3 s2 s2 so .. ..",  # 27: fire-lit hearth slab
    ".. .. so s5 s5 s4 s4 s2 s4 s3 o3 o4 o5 b3 f3 f3 b3 o5 o4 o3 s3 s2 s3 s3 s1 s3 s2 s2 s1 so .. ..",  # 28: hearth flagstones front
    ".. .. so s4 s3 s3 s2 s0 s3 s2 o2 o3 o3 o4 o4 o3 o3 o2 o2 s2 s2 s0 s3 s2 s1 s2 s1 s1 s0 so .. ..",  # 29: dressed stone riser
    ".. .. so so so so so so so so so so so so so so so so so so so so so so so so so so so so .. ..",  # 30: 1px dark stone outline
    ".. .. .. ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ .. .. ..",  # 31: ground shadow #4c557f@85
]


# ==============================================================================
# 2. brass_orrery_stand.png (32x32, standing, op 26x30: cols 3..28, rows 1..30)
# Antique brass celestial armillary sphere / grand wizard's orrery:
# - Polar astrolabe finial spire + gleaming metallic outer meridian brass ring
# - Wide 26px graduated 3/4 equatorial horizon ring with engraved degree ticks
# - Interlocking diagonal ecliptic & colure brass bands with bright specular dots
# - Deep midnight-indigo celestial interior + star glints for jewel-like contrast
# - Glowing cyan-teal miniature planet (UL), radiant golden sun (center), crimson Mars (LR)
# - Open-cutout curved brass quadrant cradle arms supporting the globe
# - Carved 3-facet octagonal dark-oak & brass-trimmed pedestal with inlaid compass star
# ==============================================================================
BRASS_ORRERY_ROWS = [
    # 00      04          08          12          16          20          24          28      31
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 00
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. bo bo .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 01: polar spire tip
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. bo b4 b2 bo .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 02: gleaming brass finial
    ".. .. .. .. .. .. .. .. .. .. .. bo bo bo b4 b3 b2 b1 bo bo bo .. .. .. .. .. .. .. .. .. .. ..",  # 03: meridian crown top
    ".. .. .. .. .. .. .. .. .. bo bo b4 b4 b3 b3 b2 b2 b1 b1 b2 b0 bo bo .. .. .. .. .. .. .. .. ..",  # 04: specular brass arc (L=9, R=9)
    ".. .. .. .. .. .. .. bo bo b4 b3 b2 bo no no b3 b1 no no bo b2 b1 b0 bo bo .. .. .. .. .. .. ..",  # 05: midnight astral dome (L=7, R=7)
    ".. .. .. .. .. .. bo b4 b3 bo t0 t4 t3 n0 n2 b3 b1 no n0 b3 b4 b2 bo b2 b0 bo .. .. .. .. .. ..",  # 06: cyan planet + ecliptic (L=6, R=6)
    ".. .. .. .. .. bo b4 b2 no t1 t3 t2 t1 b2 n0 b3 b1 n0 b4 b3 b1 n0 no n2 b1 b0 bo .. .. .. .. ..",  # 07: glowing teal planet! (L=5, R=5)
    ".. .. .. .. bo b3 b2 bo n0 t0 t1 t0 n0 b3 bo f4 f3 bo b3 b1 n1 n0 n0 bo b2 b1 b0 bo .. .. .. ..",  # 08: colure + sun top (L=4, R=4)
    ".. .. .. bo b4 b3 b2 b1 b2 b3 b2 b1 b2 bo f4 b4 f4 f2 bo b2 b1 b2 b1 b2 b1 b0 b1 b0 bo .. .. ..",  # 09: back horizon + sun heart (L=3, R=3)
    ".. .. .. bo b4 b3 b4 b2 b3 b1 b3 b2 b3 f3 b4 f4 f3 f2 b3 b2 b1 b3 b1 b2 b1 b2 b0 b0 bo .. .. ..",  # 10: 26px graduated horizon! (L=3, R=3)
    ".. .. .. bo b2 b1 b2 b0 b1 b0 b2 b4 b3 bo f3 f3 f2 f1 bo b2 r3 f3 r1 b0 b1 b0 b1 b0 bo .. .. ..",  # 11: horizon rim + Mars orb (L=3, R=3)
    ".. .. .. .. bo b3 b2 b1 bo b3 b2 n0 no n0 bo b3 b1 bo no r1 r3 r1 no bo b1 b2 b1 bo .. .. .. ..",  # 12: ecliptic lower-left + Mars (L=4, R=4)
    ".. .. .. .. bo b3 b1 bo .. bo b4 b2 no n2 no b3 b1 no no n0 r0 b2 bo .. bo b2 b0 bo .. .. .. ..",  # 13: open-air quadrant cutouts! (L=4, R=4)
    ".. .. .. .. .. bo b3 b2 bo .. bo b3 b2 no no b3 b1 no no b2 b1 bo .. bo b2 b1 bo .. .. .. .. ..",  # 14: crisp hollow lower sphere! (L=5, R=5)
    ".. .. .. .. .. .. bo b3 b2 bo .. bo bo b3 b3 b4 b2 b2 b1 bo bo .. bo b2 b1 bo .. .. .. .. .. ..",  # 15: round meridian base + arms (L=6, R=6)
    ".. .. .. .. .. .. .. bo bo bo bo .. bo b3 b2 b3 b4 b2 b1 bo .. bo bo bo bo .. .. .. .. .. .. ..",  # 16: open cradle arms converge! (L=7, R=7)
    ".. .. .. .. .. .. .. .. .. .. bo bo bo b4 b3 b3 b2 b2 b1 bo bo bo .. .. .. .. .. .. .. .. .. ..",  # 17: curved brass cradle arch (L=10, R=10)
    ".. .. .. .. .. .. .. .. .. .. .. .. bo b4 b3 b2 b2 b1 b0 bo .. .. .. .. .. .. .. .. .. .. .. ..",  # 18: slender 8px turned spindle! (L=12, R=12)
    ".. .. .. .. .. .. .. .. .. .. bo bo b4 b3 b3 b2 b2 b1 b1 b0 bo bo .. .. .. .. .. .. .. .. .. ..",  # 19: brass collar flange (L=10, R=10)
    ".. .. .. .. .. .. .. .. do do o5 o4 o4 b3 b4 b3 b2 b2 o3 o2 d3 d2 do do .. .. .. .. .. .. .. ..",  # 20: 3/4 octagonal cap top
    ".. .. .. .. .. .. .. do b3 b4 b3 b2 b3 b3 b2 b2 b2 b1 b2 b1 b1 b0 b1 b0 do .. .. .. .. .. .. ..",  # 21: brass cornice rim
    ".. .. .. .. .. .. .. do do d4 d3 b2 d2 d2 b2 b2 b1 b1 d1 d1 b1 d1 d0 do do .. .. .. .. .. .. ..",  # 22: 3-facet octagonal shaft
    ".. .. .. .. .. .. .. .. do d4 d3 b3 d2 d1 d1 b3 b2 d0 d0 d0 b1 d1 d0 do .. .. .. .. .. .. .. ..",  # 23: inlaid star top
    ".. .. .. .. .. .. .. .. do d4 d2 b2 d1 b3 b4 t4 t3 b2 b1 d0 b0 d1 d0 do .. .. .. .. .. .. .. ..",  # 24: brass & teal compass gem
    ".. .. .. .. .. .. .. .. do d3 d2 b2 d1 d1 d0 b2 b1 d0 d0 d0 b0 d0 d0 do .. .. .. .. .. .. .. ..",  # 25: inlaid star bottom
    ".. .. .. .. .. .. .. .. do d3 d2 b2 d2 d1 b2 b1 b1 b0 d1 d0 b0 d1 d0 do .. .. .. .. .. .. .. ..",  # 26: lower brass panel frame
    ".. .. .. .. .. .. .. do do b3 b4 b3 b2 b2 b3 b2 b2 b1 b1 b1 b0 b1 b0 do do .. .. .. .. .. .. ..",  # 27: lower brass torus ring
    ".. .. .. .. .. .. do o4 o3 o3 d4 b3 d3 d3 d2 d2 d2 d2 d1 d1 b1 d2 d1 d0 d0 do .. .. .. .. .. ..",  # 28: 3/4 flared plinth step
    ".. .. .. .. .. .. do d4 d3 d2 b2 d2 d2 d1 d1 d1 d1 d0 d0 d0 b0 d1 d0 d0 d0 do .. .. .. .. .. ..",  # 29: octagonal plinth base
    ".. .. .. .. .. .. do do do do do do do do do do do do do do do do do do do do .. .. .. .. .. ..",  # 30: 1px dark oak outline
    ".. .. .. .. .. .. .. ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ .. .. .. .. .. .. ..",  # 31: ground shadow #4c557f@85
]


# ==============================================================================
# 3. gilded_lectern_tome.png (16x32, standing, op 14x29: cols 1..14, rows 2..30)
# Carved oak wizard's reading lectern:
# - Arched gull-wing open cream parchment grimoire over crimson-gold leather cover
# - Illuminated cyan-gold drop-cap rune + tiny arcane circle & ink text lines
# - Gleaming gilded brass book-rest ledge with corner scroll finials
# - Vivid crimson ribbon bookmark with golden tassel draping over the brass lip
# - Lathe-turned oak baluster shaft with antique brass collars & clawed tripod feet
# ==============================================================================
GILDED_LECTERN_ROWS = [
    # 00  01  02  03  04  05  06  07  08  09  10  11  12  13  14  15
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 00
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 01
    ".. bo bo ro ro ro ro do do ro ro ro ro bo bo ..",  # 02: brass finials + arched book top
    ".. bo b4 r2 p3 p3 p2 p0 p1 p2 p3 p2 r1 b2 bo ..",  # 03: gull-wing parchment pages top
    ".. do r2 p3 t2 b3 p3 p0 p2 p2 r2 po p2 r0 do ..",  # 04: illuminated teal-gold initial!
    ".. do r2 p3 t3 t2 p2 p0 p1 p2 po r2 p1 r0 do ..",  # 05: arcane rune & crimson circle
    ".. do r1 p2 p0 po p2 p0 p1 p2 p0 po p1 r0 do ..",  # 06: crisp ink script lines
    ".. do r1 p3 p2 p2 p2 p0 p1 p2 p2 p1 p1 r0 do ..",  # 07: cream parchment spread
    ".. do r1 p2 po p0 p1 r3 p0 p1 po p0 p1 r0 do ..",  # 08: lower script + ribbon start
    ".. do b3 p1 p2 p2 p1 r3 r2 p1 p1 p1 p0 b1 do ..",  # 09: brass corner bosses + pages
    ".. bo b4 p1 p1 p0 p0 r3 r2 p0 p0 p0 p1 b2 bo ..",  # 10: thick stacked page fore-edge
    ".. bo b4 b3 b3 b2 b2 r3 r2 b2 b2 b1 b1 b2 bo ..",  # 11: gilded brass book-rest ledge!
    ".. .. do d3 d2 b3 d2 r3 r1 d2 b1 d1 d0 do .. ..",  # 12: carved oak apron + ribbon
    ".. .. .. do d4 d3 d2 r2 r1 d1 d1 d0 do .. .. ..",  # 13: bracket neck + crimson ribbon
    ".. .. .. .. do o3 d2 r3 b3 d1 d0 do .. .. .. ..",  # 14: ribbon gold fringe tassel!
    ".. .. .. .. .. do o3 d3 b2 d1 do .. .. .. .. ..",  # 15: turned upper neck + tassel tip
    ".. .. .. .. .. do o3 d3 d2 d1 do .. .. .. .. ..",  # 16: slender turned shaft
    ".. .. .. .. bo b4 b3 b2 b2 b1 b0 bo .. .. .. ..",  # 17: upper brass ring collar
    ".. .. .. .. do o4 o3 d3 d2 d1 d0 do .. .. .. ..",  # 18: turned oak baluster knop
    ".. .. .. .. do o3 d3 d2 d1 d1 d0 do .. .. .. ..",  # 19: baluster lower curve
    ".. .. .. .. .. do o3 d3 d2 d1 do .. .. .. .. ..",  # 20: fluted oak post
    ".. .. .. .. .. do o3 d2 d2 d0 do .. .. .. .. ..",  # 21: fluted oak post
    ".. .. .. .. .. do o2 d2 d1 d0 do .. .. .. .. ..",  # 22: fluted oak post
    ".. .. .. .. .. do d3 d2 d1 d0 do .. .. .. .. ..",  # 23: lower shaft taper
    ".. .. .. .. bo b4 b3 b2 b2 b1 b0 bo .. .. .. ..",  # 24: lower antique brass collar
    ".. .. .. .. do o4 o3 d3 d2 d1 d0 do .. .. .. ..",  # 25: flaring bell base
    ".. .. .. do o4 o3 d3 d2 d2 d1 d1 d0 do .. .. ..",  # 26: stepped carved oak base
    ".. .. do o3 d3 d2 d2 b3 b2 d2 d1 d1 d0 do .. ..",  # 27: splayed tripod base
    ".. bo b4 b3 d3 d2 bo b4 b2 bo d2 d1 b2 b1 bo ..",  # 28: three sculpted brass claws!
    ".. bo b3 b2 d1 do bo b3 b1 bo do d0 b2 b0 bo ..",  # 29: clawed feet + arched under-cut
    ".. bo bo bo do .. bo bo bo bo .. do bo bo bo ..",  # 30: crisp dark claw outlines
    ".. .. ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ .. ..",  # 31: ground shadow #4c557f@85
]


# ==============================================================================
# 4. scrying_crystal_pedestal.png (16x32, standing, op 12x29: cols 2..13, rows 2..30)
# Fluted cool-stone wizard pedestal + luminous sea-teal crystal orb:
# - 10x10 faceted translucent sea-teal/cyan crystal sphere (strictly dark-teal outlined)
# - Bright top-left ice-cyan specular gleam + inner astral swirl + lower-right caustic glow
# - Three gleaming antique-brass dragon-claw prongs cradling the orb
# - Cool limestone 3/4 capital slab catching cyan ambient reflection
# - Deep classical fluted stone shaft with brass-and-stone astragal ring & Attic plinth
# ==============================================================================
SCRYING_CRYSTAL_ROWS = [
    # 00  01  02  03  04  05  06  07  08  09  10  11  12  13  14  15
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 00
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 01
    ".. .. .. .. .. to to to to to to .. .. .. .. ..",  # 02: crystal crown outline
    ".. .. .. .. to t3 t4 t4 t3 t2 t1 to .. .. .. ..",  # 03: upper facet + bright gleam
    ".. .. .. to t3 t4 t4 t3 t3 t2 t1 t0 to .. .. ..",  # 04: 2x2 ice-cyan specular star!
    ".. .. .. to t3 t4 t3 t2 t3 t2 n1 t0 to .. .. ..",  # 05: faceted sea-teal body
    ".. .. .. to t2 t3 t3 t4 t3 n2 n1 t0 to .. .. ..",  # 06: glowing inner mystical core!
    ".. .. .. to t2 t2 t3 t3 t2 t2 n1 t0 to .. .. ..",  # 07: translucent astral depth
    ".. .. .. to t1 t2 t2 t1 t2 t3 t1 t0 to .. .. ..",  # 08: lower-right internal caustic!
    ".. .. bo b4 to t1 t1 t2 t3 t3 t0 to b2 bo .. ..",  # 09: brass prong tips grip crystal!
    ".. .. bo b3 b2 t0 t1 t2 t3 t1 t0 b2 b0 bo .. ..",  # 10: curved brass side claws
    ".. .. .. bo b3 b2 to b4 b2 to b2 b1 bo .. .. ..",  # 11: center front brass talon!
    ".. .. .. .. bo b4 b3 b3 b2 b2 b1 bo .. .. .. ..",  # 12: gleaming brass cradle bowl
    ".. .. .. .. .. bo b3 b2 b2 b0 bo .. .. .. .. ..",  # 13: turned brass stem collar
    ".. .. .. bo bo b4 b3 b2 b2 b1 b0 bo bo .. .. ..",  # 14: brass mounting flange
    ".. .. so s6 s6 s5 t3 t4 t3 s4 s4 s3 s2 so .. ..",  # 15: 3/4 lit stone top + cyan glow!
    ".. .. so s5 s5 s4 s4 s3 s3 s3 s2 s2 s1 so .. ..",  # 16: moulded stone capital fascia
    ".. .. .. so s2 s1 l1 s1 l1 s1 s0 l0 so .. .. ..",  # 17: recessed shadow under capital
    ".. .. .. .. so s6 s2 s4 l1 s3 s0 so .. .. .. ..",  # 18: fluted stone column top
    ".. .. .. .. so s5 s2 s4 l1 s3 s0 so .. .. .. ..",  # 19: crisp classical stone flutes
    ".. .. .. .. so s5 s2 s4 l1 s3 s0 so .. .. .. ..",  # 20: fluted stone column
    ".. .. .. .. so s5 s2 s4 l1 s3 s0 so .. .. .. ..",  # 21: fluted stone column
    ".. .. .. so s6 b3 s4 b2 s3 b1 s2 s0 so .. .. ..",  # 22: carved stone & brass ring!
    ".. .. .. .. so s5 s2 s4 l1 s3 s0 so .. .. .. ..",  # 23: lower fluted shaft
    ".. .. .. .. so s5 s2 s4 l1 s3 s0 so .. .. .. ..",  # 24: lower fluted shaft
    ".. .. .. .. so s5 s1 s3 l1 s2 s0 so .. .. .. ..",  # 25: lower fluted shaft
    ".. .. .. .. so s4 s1 s3 l0 s2 s0 so .. .. .. ..",  # 26: column base taper
    ".. .. .. so s6 s5 s5 s4 s4 s3 s2 s1 so .. .. ..",  # 27: upper Attic torus step
    ".. .. so s6 s6 s5 s5 s4 s4 s3 s3 s2 s1 so .. ..",  # 28: 3/4 lit stone plinth ledge
    ".. .. so s4 s4 s3 s2 s3 s2 s2 s1 s1 s0 so .. ..",  # 29: dressed stone plinth block
    ".. .. so so so so so so so so so so so so .. ..",  # 30: 1px dark stone outline
    ".. .. .. ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ .. .. ..",  # 31: ground shadow #4c557f@85
]


# ==============================================================================
# 5. arcane_rune_rug.png (48x32, topdown, op 46x30: cols 1..46, rows 1..30)
# Royal woven crimson-and-gold wizard tapestry rug (strictly flat topdown):
# - Scalloped golden fringe tassels on left (cols 1..2) & right (cols 45..46), 100% dark-outlined
# - Intricate triple-line antique-gold Greek-key/diamond border + 4 cyan-jeweled corner rosettes
# - Rich calm woven crimson damask wool field with flanking golden crescent moons & stars
# - Central 20x20 concentric glowing cyan-teal & gold 8-point celestial compass / rune mandala!
# ==============================================================================
ARCANE_RUNE_RUG_ROWS = [
    # 00..02  |03 | 04..06  | 07..13               | 14..23                        | 24..33                        | 34..40               | 41..43  |44 | 45..47
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 00
    ".. .. ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro .. ..",  # 01
    ".. bo b3 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r2 r1 b2 bo ..",  # 02
    ".. .. ro r2 b4 b3 b3 b3 b3 b2 b3 b3 b2 b3 b3 b2 b3 b3 b2 b3 b3 b2 b3 b3 b3 b3 b2 b3 b3 b2 b3 b3 b2 b3 b3 b2 b3 b3 b2 b3 b3 b3 b3 b2 r0 ro .. ..",  # 03
    ".. bo b3 r2 b3 ro t4 b3 ro b3 ro b2 ro b3 ro b2 ro b3 ro b2 ro b3 b3 ro ro b3 b2 ro b2 ro b1 ro b2 ro b1 ro b2 ro b1 ro b2 t3 ro b2 r0 b2 bo ..",  # 04
    ".. .. ro r2 b3 t4 t3 b2 b2 b2 b1 b2 b2 b1 b2 b2 b1 b2 b2 b3 b3 b4 b4 b4 b3 b3 b3 b2 b2 b1 b2 b2 b1 b2 b1 b1 b2 b1 b1 b2 b2 t3 t2 b1 r0 ro .. ..",  # 05
    ".. bo b3 r2 b3 b2 b2 r2 r1 r2 r1 r2 r1 r2 r1 r1 r0 ro ro ro ro b3 b4 b3 b3 b3 b2 ro ro ro ro r0 r1 r1 r2 r1 r2 r1 r2 r1 r2 b2 b2 b1 r0 b2 bo ..",  # 06
    ".. .. ro r2 b3 ro b2 r1 r2 r1 u1 r1 r2 r1 r1 r0 ro b3 b4 b3 b2 r0 r0 b4 t4 b3 r0 r0 b2 b3 b2 b2 ro r0 r1 r1 r2 r1 u1 r1 r2 b2 ro b1 r0 ro .. ..",  # 07
    ".. bo b3 r2 b3 b2 b2 r2 r1 b3 b4 b2 r1 r2 r1 r0 b3 b3 no no r0 t2 t3 b3 t4 b2 t3 t2 r0 no no b2 b2 r0 r1 r2 r1 b2 b3 b2 r1 b2 b1 b1 r0 b2 bo ..",  # 08
    ".. .. ro r2 b3 ro b2 r1 r2 r1 b3 r1 r2 r1 r1 ro b3 no n0 t2 t1 no n0 b3 t3 b2 n0 no t1 t2 n0 no b2 ro r1 r1 r2 r1 b2 r1 r2 b2 ro b1 r0 ro .. ..",  # 09
    ".. bo b3 r2 b3 b2 b2 r2 r1 b3 b3 r0 r1 r2 r1 ro b3 no t2 n0 b4 b3 b2 no n0 no b2 b3 b3 n0 t2 no b2 ro r1 r2 r1 r0 b3 b2 r1 b2 b1 b1 r0 b2 bo ..",  # 10
    ".. .. ro r2 b3 ro b2 r1 b3 b4 r0 r1 r2 r1 r2 ro b3 n0 t1 no b3 r0 r1 b3 b2 b2 r1 r0 b2 no t1 n0 b2 ro r2 r1 r2 r1 r0 b3 b2 b2 ro b1 r0 ro .. ..",  # 11
    ".. bo b3 r2 b3 b2 b2 r1 b3 r0 t3 b3 r1 r2 r1 ro b3 t2 no b3 r0 no n0 b3 b3 b2 n0 no r0 b2 no t2 b2 ro r1 r2 r1 b2 t3 r0 b2 b2 b1 b1 r0 b2 bo ..",  # 12
    ".. .. ro r2 b3 ro b2 r1 b3 r0 t4 t3 r0 r1 ro b4 t2 no b2 no n1 t2 b4 t3 t4 t3 b3 t2 n1 no b2 no t2 b3 ro r1 r0 t3 t3 r0 b2 b2 ro b1 r0 ro .. ..",  # 13
    ".. bo b3 r2 b3 b2 b2 r2 b3 t3 t4 b3 r0 r1 ro b4 t3 b3 b3 n1 t2 t3 t4 b4 f4 b4 t4 t3 t2 n1 b2 b2 t3 b3 ro r1 r0 b2 t3 t2 b2 b2 b1 b1 r0 b2 bo ..",  # 14
    ".. .. ro r2 b3 ro b2 r1 b3 r0 t3 t2 r0 r1 ro b4 t4 t4 b3 t3 t3 b4 t4 f4 b4 f4 t4 b3 t3 t3 b3 t4 t3 b3 ro r1 r0 t2 t3 r0 b2 b2 ro b1 r0 ro .. ..",  # 15
    ".. bo b3 r2 b3 b2 b2 r1 b2 r0 t2 t3 r0 r1 ro b3 t4 t3 b2 t3 t2 b3 t4 b4 f4 b4 t3 b2 t2 t3 b2 t3 t4 b2 ro r1 r0 t3 t2 r0 b1 b2 b1 b1 r0 b2 bo ..",  # 16
    ".. .. ro r2 b3 ro b2 r2 b2 t2 t3 b2 r0 r1 ro b3 t3 b2 b2 n1 t2 t3 t3 b4 f4 b4 t4 t3 t2 n1 b1 b2 t3 b2 ro r1 r0 b2 t3 t2 b1 b2 ro b1 r0 ro .. ..",  # 17
    ".. bo b3 r2 b3 b2 b2 r1 b2 r0 t3 t2 r0 r1 ro b3 t2 no b2 no n1 t2 b3 t3 t4 t3 b2 t2 n1 no b1 no t2 b2 ro r1 r0 t2 t3 r0 b2 b2 b1 b1 r0 b2 bo ..",  # 18
    ".. .. ro r2 b3 ro b2 r1 b2 r0 t2 b2 r1 r2 r1 ro b2 t2 no b2 r0 no n0 b2 b3 b2 n0 no r0 b2 no t1 b1 ro r1 r2 r1 b2 t2 r0 b2 b2 ro b1 r0 ro .. ..",  # 19
    ".. bo b3 r2 b3 b2 b2 r1 b2 b3 r0 r1 r2 r1 r2 ro b2 n0 t1 no b2 r0 r1 b2 b2 b2 r1 r0 b2 no t1 n0 b1 ro r2 r1 r2 r1 r0 b3 b1 b2 b1 b1 r0 b2 bo ..",  # 20
    ".. .. ro r2 b3 ro b2 r2 r1 b2 b2 r0 r1 r2 r1 ro b2 no t2 n0 b3 b2 b2 no n0 no b1 b2 b3 n0 t2 no b1 ro r1 r2 r1 r0 b2 b2 r1 b2 ro b1 r0 ro .. ..",  # 21
    ".. bo b3 r2 b3 b2 b2 r1 r2 r1 b2 r1 r2 r1 r1 ro b2 no n0 t2 t1 no n0 b2 t3 b2 n0 no t1 t2 n0 no b1 ro r1 r1 r2 r1 b2 r1 r2 b2 b1 b1 r0 b2 bo ..",  # 22
    ".. .. ro r2 b3 ro b2 r2 r1 b2 b3 b1 r1 r2 r1 r0 b2 b2 no no r0 t2 t3 b2 t4 b2 t3 t2 r0 no no b1 b1 r0 r1 r2 r1 b2 b3 b1 r1 b2 ro b1 r0 ro .. ..",  # 23
    ".. bo b3 r2 b3 b2 b2 r1 r2 r1 u1 r1 r2 r1 r1 r0 ro b2 b3 b2 b2 r0 r0 b3 t4 b2 r0 r0 b2 b2 b2 b1 ro r0 r1 r1 r2 r1 u1 r1 r2 b2 b1 b1 r0 b2 bo ..",  # 24
    ".. .. ro r2 b3 b2 b2 r2 r1 r2 r1 r2 r1 r2 r1 r1 r0 ro ro ro ro b2 b2 b3 b3 b2 b1 ro ro ro ro r0 r1 r1 r2 r1 r2 r1 r2 r1 r2 b2 b1 b1 r0 ro .. ..",  # 25
    ".. bo b3 r1 b3 t3 t2 b2 b2 b1 b1 b2 b1 b1 b2 b1 b1 b2 b2 b2 b2 b3 b3 b3 b2 b2 b2 b1 b1 b1 b2 b1 b0 b1 b1 b0 b1 b1 b0 b2 b1 t2 t2 b1 r0 b2 bo ..",  # 26
    ".. .. ro r1 b2 ro t3 b2 ro b2 ro b1 ro b2 ro b1 ro b2 ro b1 ro b2 b2 ro ro b2 b1 ro b1 ro b0 ro b1 ro b0 ro b1 ro b0 ro b1 t2 ro b1 r0 ro .. ..",  # 27
    ".. bo b2 r1 b3 b2 b2 b2 b2 b1 b2 b2 b1 b2 b2 b1 b2 b2 b1 b2 b2 b1 b2 b2 b2 b2 b2 b1 b2 b2 b1 b2 b1 b0 b2 b1 b0 b2 b1 b0 b2 b2 b1 b0 r0 b1 bo ..",  # 28
    ".. .. ro r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 ro .. ..",  # 29
    ".. .. ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro ro .. ..",  # 30
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 31
]


def verify_sprite(
    im: Image.Image,
    name: str,
    allowed_hexes: set[str],
    target_w_range: tuple[int, int],
    target_h_range: tuple[int, int],
) -> dict:
    """Strict machine validator: palette, alpha, #000000, 1px dark outer outline, bbox, centering."""
    w, h = im.size
    px = im.load()

    off_palette: list[tuple[int, int, str]] = []
    bad_alpha: list[tuple[int, int, tuple[int, int, int, int]]] = []
    pure_black: list[tuple[int, int]] = []
    bad_outline: list[tuple[int, int, str, float]] = []

    opaque_colors: set[str] = set()
    shadow_count = 0
    xs: list[int] = []
    ys: list[int] = []

    for y in range(h):
        for x in range(w):
            rgba = px[x, y]
            r, g, b, a = rgba
            if a == 0:
                continue
            if rgba == SHADOW_RGBA:
                shadow_count += 1
                continue
            if a != 255:
                bad_alpha.append((x, y, rgba))
                continue
            if (r, g, b) == (0, 0, 0):
                pure_black.append((x, y))
            hx = f"#{r:02x}{g:02x}{b:02x}"
            if hx not in allowed_hexes:
                off_palette.append((x, y, hx))
            opaque_colors.add(hx)
            xs.append(x)
            ys.append(y)

            # Check 4-connected neighbors for non-opaque edge
            touches_empty = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if not (0 <= nx < w and 0 <= ny < h) or px[nx, ny][3] != 255:
                    touches_empty = True
                    break
            if touches_empty and hx not in DARK_OUTLINE_HEXES:
                bad_outline.append((x, y, hx, round(luma(r, g, b), 1)))

    assert not pure_black, f"{name}: PURE BLACK #000000 PIXELS: {pure_black}"
    assert not off_palette, f"{name}: OFF-PALETTE PIXELS: {off_palette}"
    assert not bad_alpha, f"{name}: BAD ALPHA PIXELS: {bad_alpha}"
    assert not bad_outline, f"{name}: NON-DARK OUTER OUTLINE PIXELS: {bad_outline[:12]}"
    assert xs, f"{name}: empty sprite!"

    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    op_w = max_x - min_x + 1
    op_h = max_y - min_y + 1
    left_m = min_x
    right_m = w - 1 - max_x
    bot_m = h - 1 - max_y

    assert target_w_range[0] <= op_w <= target_w_range[1], f"{name}: op_w={op_w} not in {target_w_range}"
    assert target_h_range[0] <= op_h <= target_h_range[1], f"{name}: op_h={op_h} not in {target_h_range}"
    assert abs(left_m - right_m) <= 1, f"{name}: horizontal margin asymmetry ({left_m} vs {right_m})"
    assert 1 <= bot_m <= 2, f"{name}: bottom margin {bot_m} not in 1..2"

    return {
        "name": name,
        "canvas": f"{w}x{h}",
        "opaque_size": f"{op_w}x{op_h}",
        "margins_lrtb": (left_m, right_m, min_y, bot_m),
        "unique_colors": len(opaque_colors),
        "shadow_px": shadow_count,
    }


def load_beodeul_char_1x() -> Image.Image:
    """Downscale ref_beodeul_char_4x.png (88x100) by exact 4x nearest -> native 22x25 Beodeul char."""
    src = Image.open(CHAR_REF_4X).convert("RGBA")
    w, h = src.size
    return src.resize((w // 4, h // 4), Image.Resampling.NEAREST)


def build_preview_sheet(sprites: list[tuple[str, str, Image.Image, dict]]) -> None:
    """Render preview_batch2.png on #767670 with 2x + 1x next to Beodeul char (+ old 1x ref)."""
    bg_gray = (0x76, 0x76, 0x70, 255)
    card_border = (0x5C, 0x5C, 0x56, 255)
    header_bg = (0x62, 0x62, 0x5C, 255)

    card_widths = [196, 196, 174, 184, 228]
    gap = 8
    pad = 12
    sheet_w = pad * 2 + sum(card_widths) + gap * (len(card_widths) - 1)
    sheet_h = 396

    sheet = Image.new("RGBA", (sheet_w, sheet_h), bg_gray)
    draw = ImageDraw.Draw(sheet)

    try:
        font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 13)
        font_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
        font_tiny = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 10)
    except Exception:
        font_title = ImageFont.load_default()
        font_sub = ImageFont.load_default()
        font_tiny = ImageFont.load_default()

    # Header bar
    draw.rectangle([pad, 10, sheet_w - pad, 82], fill=header_bg, outline=card_border, width=1)
    draw.text(
        (24, 17),
        "fantasy_wizard_library_carbon — Batch 2/4: 5 Arcane Hero Pieces (2x + 1x on #767670)",
        fill=(250, 250, 246, 255),
        font=font_title,
    )
    draw.text(
        (24, 38),
        "Locked 70-color Beodeul Library Palette (0 off-palette, 0 #000000) | Shadow #4c557f@85 | 1px Dark Material Outlines",
        fill=(228, 228, 222, 255),
        font=font_sub,
    )
    draw.text(
        (24, 56),
        "Scale Ref: Beodeul 22x25 char shown at 2x & 1x beside EVERY object (bottom-right inset: old neon-high 1x)",
        fill=(202, 204, 196, 255),
        font=font_sub,
    )

    char_1x = load_beodeul_char_1x()
    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.Resampling.NEAREST)
    sheet.alpha_composite(char_2x, (sheet_w - 116, 18))
    sheet.alpha_composite(char_1x, (sheet_w - 58, 43))

    cx = pad
    cy = 94
    card_h = 288

    for idx, ((fname, cam, im, stats), cw) in enumerate(zip(sprites, card_widths)):
        draw.rectangle([cx, cy, cx + cw, cy + card_h], fill=bg_gray, outline=card_border, width=1)

        # 1) 2x enlarged pair (sprite 2x + Beodeul char 2x)
        floor_2x_y = cy + 122
        draw.line([(cx + 10, floor_2x_y + 1), (cx + cw - 10, floor_2x_y + 1)], fill=(102, 102, 96, 255), width=1)
        im_2x = im.resize((im.width * 2, im.height * 2), Image.Resampling.NEAREST)
        pair_2x_w = im_2x.width + 8 + char_2x.width
        px_2x = cx + (cw - pair_2x_w) // 2
        sheet.alpha_composite(im_2x, (px_2x, floor_2x_y - im_2x.height))
        sheet.alpha_composite(char_2x, (px_2x + im_2x.width + 8, floor_2x_y - char_2x.height))

        # 2) 1x native pair (sprite 1x + Beodeul char 1x) + old 1x comparison on far right
        floor_1x_y = cy + 188
        draw.line([(cx + 10, floor_1x_y + 1), (cx + cw - 10, floor_1x_y + 1)], fill=(102, 102, 96, 255), width=1)
        old_path = OLD_OBJ_DIR / fname
        if old_path.exists():
            old_1x = Image.open(old_path).convert("RGBA")
            row_w = im.width + 8 + char_1x.width + 16 + old_1x.width
            px_1x = cx + (cw - row_w) // 2
            sheet.alpha_composite(im, (px_1x, floor_1x_y - im.height))
            sheet.alpha_composite(char_1x, (px_1x + im.width + 8, floor_1x_y - char_1x.height))
            old_x = px_1x + im.width + 8 + char_1x.width + 16
            sheet.alpha_composite(old_1x, (old_x, floor_1x_y - old_1x.height))
            draw.text((old_x, floor_1x_y + 3), "old", fill=(182, 182, 174, 255), font=font_tiny)
        else:
            pair_1x_w = im.width + 10 + char_1x.width
            px_1x = cx + (cw - pair_1x_w) // 2
            sheet.alpha_composite(im, (px_1x, floor_1x_y - im.height))
            sheet.alpha_composite(char_1x, (px_1x + im.width + 10, floor_1x_y - char_1x.height))

        label = fname.replace(".png", "")
        draw.text((cx + 8, cy + 208), f"0{idx + 1}. {label}", fill=(250, 250, 246, 255), font=font_sub)
        draw.text(
            (cx + 8, cy + 226),
            f"[{cam}] {stats['canvas']} | opq {stats['opaque_size']}",
            fill=(218, 220, 214, 255),
            font=font_sub,
        )
        draw.text(
            (cx + 8, cy + 244),
            f"margins L/R/T/B: {stats['margins_lrtb']}",
            fill=(196, 198, 192, 255),
            font=font_tiny,
        )
        draw.text(
            (cx + 8, cy + 262),
            f"{stats['unique_colors']} cols | shd {stats['shadow_px']}px | PASS",
            fill=(162, 250, 160, 255),
            font=font_sub,
        )
        cx += cw + gap

    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW_PATH)


def main() -> None:
    pal_data = json.loads(PALETTE_PATH.read_text(encoding="utf-8"))
    allowed_hexes = {c.lower() for c in pal_data["colors"]}
    assert len(allowed_hexes) == 70, f"Expected 70 palette colors, got {len(allowed_hexes)}"

    for tok, hx in TOKENS.items():
        assert hx.lower() in allowed_hexes, f"Token {tok}={hx} is NOT in palette_beodeul_library.json!"

    specs = [
        ("stone_fireplace_lit.png", "standing", 32, 32, STONE_FIREPLACE_ROWS, (27, 29), (29, 30)),
        ("brass_orrery_stand.png", "standing", 32, 32, BRASS_ORRERY_ROWS, (25, 27), (29, 30)),
        ("gilded_lectern_tome.png", "standing", 16, 32, GILDED_LECTERN_ROWS, (13, 15), (28, 30)),
        ("scrying_crystal_pedestal.png", "standing", 16, 32, SCRYING_CRYSTAL_ROWS, (11, 13), (28, 30)),
        ("arcane_rune_rug.png", "topdown", 48, 32, ARCANE_RUNE_RUG_ROWS, (45, 47), (29, 30)),
    ]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    built: list[tuple[str, str, Image.Image, dict]] = []

    for fname, cam, w, h, rows, w_rng, h_rng in specs:
        im = parse_grid(rows, w, h, fname)
        stats = verify_sprite(im, fname, allowed_hexes, w_rng, h_rng)
        im.save(OUT_DIR / fname)
        built.append((fname, cam, im, stats))
        print(
            f"[PASS] {fname:30s} | {cam:8s} | canvas={stats['canvas']:5s} | "
            f"opaque={stats['opaque_size']:5s} | colors={stats['unique_colors']:2d} | "
            f"margins={stats['margins_lrtb']} | shadow={stats['shadow_px']}px"
        )

    build_preview_sheet(built)
    print(f"[PREVIEW] Saved {PREVIEW_PATH}")


if __name__ == "__main__":
    main()
