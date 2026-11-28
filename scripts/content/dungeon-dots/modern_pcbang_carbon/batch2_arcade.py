#!/usr/bin/env python3
"""
Batch 2/4 — 5 Museum-Grade Modern Korean PC Bang Arcade & Vending Objects
Sprites:
  1. arcade_cabinet_blue.png    (16x32, standing)
  2. arcade_cabinet_red.png     (16x32, standing)
  3. claw_crane_machine.png     (32x32, standing)
  4. coin_changer.png           (16x32, standing)
  5. vending_machine_drinks.png (32x32, standing)

100% locked to modern_palette_v3.json (118 colors) + ground shadow #4c557f @ alpha 85.
"""

from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
PALETTE_PATH = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs/modern_palette_v3.json"
CHAR_REF_PATH = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs/ref_mod1_char.png"
OUT_DIR = ROOT / "tiledata/dungeon-dots/modern_pcbang_carbon/objects"
PREVIEW_PATH = ROOT / "tiledata/dungeon-dots/modern_pcbang_carbon/preview_batch2.png"

SHADOW_RGBA = (76, 85, 127, 85)  # #4c557f @ alpha 85


def hex_to_rgba(h: str) -> tuple[int, int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


# Exact named tokens mapped strictly to modern_palette_v3.json (118 colors)
TOKENS: dict[str, str] = {
    # Cool slate / brushed steel / glossy white (8)
    "k0": "#141622",
    "k1": "#2e3040",
    "k2": "#4e5062",
    "k3": "#707282",
    "k4": "#9698a4",
    "k5": "#bec0c8",
    "k6": "#e2e4e8",
    "k7": "#fafaf8",
    # Cobalt blue (7)
    "b0": "#111c2e",
    "b1": "#182c50",
    "b2": "#1c3772",
    "b3": "#1b3e94",
    "b4": "#294db6",
    "b5": "#5b76d8",
    "b6": "#9aacfa",
    # Sky cerulean (7)
    "s0": "#11272e",
    "s1": "#184150",
    "s2": "#1c5872",
    "s3": "#1b6c94",
    "s4": "#2982b6",
    "s5": "#5ba6d8",
    "s6": "#9ad0fa",
    # Cyan teal (7)
    "c0": "#112e2a",
    "c1": "#18504a",
    "c2": "#1c726c",
    "c3": "#1b9490",
    "c4": "#29b6b6",
    "c5": "#5bd4d8",
    "c6": "#9af4fa",
    # Indigo violet (7)
    "i0": "#14112e",
    "i1": "#211850",
    "i2": "#2c1c72",
    "i3": "#361b94",
    "i4": "#4d29b6",
    "i5": "#7f5bd8",
    "i6": "#b99afa",
    # Purple magenta (7)
    "v0": "#23112e",
    "v1": "#3c1850",
    "v2": "#571c72",
    "v3": "#721b94",
    "v4": "#9329b6",
    "v5": "#bd5bd8",
    "v6": "#e89afa",
    # Rose pink (7)
    "p0": "#2e1128",
    "p1": "#501840",
    "p2": "#721c53",
    "p3": "#941b60",
    "p4": "#b6296e",
    "p5": "#d85b8f",
    "p6": "#fa9aba",
    # Crimson red (7)
    "r0": "#2e1119",
    "r1": "#501825",
    "r2": "#721c28",
    "r3": "#941b23",
    "r4": "#b62b29",
    "r5": "#d8665b",
    "r6": "#faaa9a",
    # Rust orange (7)
    "o0": "#2e1111",
    "o1": "#501d18",
    "o2": "#72291c",
    "o3": "#94381b",
    "o4": "#b65529",
    "o5": "#d88c5b",
    "o6": "#fac79a",
    # Amber ochre (7)
    "a0": "#2e1a11",
    "a1": "#502f18",
    "a2": "#72461c",
    "a3": "#94601b",
    "a4": "#b68429",
    "a5": "#d8b55b",
    "a6": "#fae79a",
    # Gold yellow (7)
    "y0": "#2e2111",
    "y1": "#503c18",
    "y2": "#725a1c",
    "y3": "#947c1b",
    "y4": "#b6a529",
    "y5": "#d8d25b",
    "y6": "#f7fa9a",
    # Emerald green (7)
    "g0": "#172e11",
    "g1": "#225018",
    "g2": "#29721c",
    "g3": "#29941b",
    "g4": "#35b629",
    "g5": "#61d85b",
    "g6": "#9cfa9a",
    # Jade mint (7)
    "m0": "#112e1b",
    "m1": "#18502f",
    "m2": "#1c7241",
    "m3": "#1b9454",
    "m4": "#29b670",
    "m5": "#5bd89e",
    "m6": "#9afad0",
}

DARK_OUTLINE_HEXES = {
    "#141622",  # k0 cool_slate_gray darkest
    "#111c2e",  # b0 cobalt_blue darkest
    "#11272e",  # s0 sky_cerulean darkest
    "#112e2a",  # c0 cyan_teal darkest
    "#14112e",  # i0 indigo_violet darkest
    "#23112e",  # v0 purple_magenta darkest
    "#2e1128",  # p0 rose_pink darkest
    "#2e1119",  # r0 crimson_red darkest
    "#2e1111",  # o0 rust_orange darkest
    "#2e1a11",  # a0 amber_ochre darkest
    "#2e2111",  # y0 gold_yellow darkest
    "#172e11",  # g0 emerald_green darkest
    "#112e1b",  # m0 jade_mint darkest
    "#0d0805",  # dark_wood_earth darkest
}


def parse_grid(rows: list[str], w: int, h: int, name: str) -> Image.Image:
    """Each row has `w` space-separated 2-char tokens (or '..' for transparent, '~~' for shadow)."""
    assert len(rows) == h, f"{name}: expected {h} rows, got {len(rows)}"
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    for y, line in enumerate(rows):
        cells = line.split()
        assert len(cells) == w, f"{name} row {y}: expected {w} cells, got {len(cells)} -> {line}"
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
# 1. arcade_cabinet_blue.png (16x32)
# Sculpted Korean candy-cab cobalt-blue & glossy white arcade machine:
# - Arched rounded white/cobalt top crown (3/4 top band)
# - Glowing backlit cyan & gold marquee header
# - Recessed speaker brow + curved glossy CRT with space-shooter scene & diagonal glare
# - Wide 14px protruding slanted control deck with red ball-top stick & red/yellow/cyan buttons
# - Sculpted cobalt/white lower body with recessed brushed-steel coin door & 14px steel kickplate
# ==============================================================================
ARCADE_BLUE_ROWS = [
    # 00      01  02  03  04  05  06  07  08  09  10  11  12  13  14  15
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 00: 1px clean top margin
    ".. .. .. .. b0 b0 b0 b0 b0 b0 b0 b0 .. .. .. ..",  # 01: rounded arched crown outline
    ".. .. b0 b0 k7 k7 k6 k6 k6 k5 b5 b4 b0 b0 .. ..",  # 02: glossy rounded white/cobalt 3/4 top dome
    ".. .. b0 b6 b6 b5 b5 b5 b4 b4 b3 b3 b2 b0 .. ..",  # 03: lit 3/4 cobalt upper rim
    ".. b0 b5 c6 k7 c6 y6 y5 y6 a4 c5 c4 b4 b3 b0 ..",  # 04: overhanging backlit cyan/gold marquee top
    ".. b0 b4 c5 c5 y6 r5 y6 o5 c5 c4 c3 b3 b2 b0 ..",  # 05: glowing marquee emblem + smooth cyan glow
    ".. b0 b0 b2 b1 b1 b1 b1 b1 b1 b1 b1 b2 b0 b0 ..",  # 06: marquee bottom overhang bevel
    ".. .. b0 k5 k1 k0 k6 k6 k5 k4 k0 k1 k3 b0 .. ..",  # 07: recessed stereo speaker strip (12px symmetric!)
    ".. .. b0 b5 k7 k7 k6 k6 k6 k5 k5 k4 b3 b0 .. ..",  # 08: glossy white upper CRT bezel (12px symmetric!)
    ".. .. b0 b5 k6 k0 k7 c6 i1 y6 i1 k0 b3 b0 .. ..",  # 09: curved CRT top + diagonal glass glare + star
    ".. .. b0 b5 k6 c6 s5 i2 r5 r4 i2 i1 b3 b0 .. ..",  # 10: diagonal glare + red alien boss sprite
    ".. .. b0 b4 k6 s5 i2 y6 i2 c5 i1 i1 b2 b0 .. ..",  # 11: golden laser shot + deep indigo space
    ".. .. b0 b4 k5 i2 k7 c5 s4 i2 y5 i1 b2 b0 .. ..",  # 12: player starfighter + spark
    ".. .. b0 b4 k5 c3 g5 g4 c4 g4 g3 c1 b2 b0 .. ..",  # 13: retro neon terrain horizon
    ".. .. b0 b4 k6 k7 k6 k6 k5 k5 k4 k4 b2 b0 .. ..",  # 14: curved CRT lower white bezel catchlight
    ".. b0 b5 k7 r6 r4 k7 k6 k6 k5 k5 k4 b4 b3 b0 ..",  # 15: wide 14px control deck + red joystick ball!
    ".. b0 k7 k6 k2 k1 k6 r5 y6 c5 k5 g5 k4 b3 b0 ..",  # 16: slanted white deck + shaft + R/Y/C buttons
    ".. b0 b6 b5 b5 b5 b4 b4 b4 b4 b3 b3 b2 b2 b0 ..",  # 17: sculpted cobalt front control lip
    ".. b0 b0 b1 b1 k1 k1 k1 k1 k1 k1 b1 b1 b0 b0 ..",  # 18: deep overhang shadow under control deck
    ".. .. b0 b5 k7 k6 k6 k5 k5 k5 k4 k4 b3 b0 .. ..",  # 19: glossy white & cobalt lower front apron
    ".. .. b0 b5 k6 k1 k1 k1 k1 k1 k1 k4 b2 b0 .. ..",  # 20: recessed steel coin door top shadow
    ".. .. b0 b5 k6 k1 r5 k3 y5 k2 k3 k4 b2 b0 .. ..",  # 21: glowing red reject button + brass coin slot
    ".. .. b0 b4 k5 k1 k4 k3 k3 k2 k2 k3 b2 b0 .. ..",  # 22: brushed steel coin door panel
    ".. .. b0 b4 k5 k1 k3 k0 k0 k2 k2 k3 b2 b0 .. ..",  # 23: deep recessed dark coin return pocket
    ".. .. b0 b4 k5 k1 k3 k5 k4 k2 k3 k3 b1 b0 .. ..",  # 24: metallic catchlight on coin return lip
    ".. .. b0 b4 k5 k4 k4 k4 k3 k3 k3 k3 b1 b0 .. ..",  # 25: coin door bottom bevel catchlight
    ".. .. b0 b5 b4 b4 b4 b3 b3 b3 b2 b2 b1 b0 .. ..",  # 26: sculpted cobalt lower skirt
    ".. k0 k5 k4 k4 k4 k3 k3 k3 k3 k2 k2 k1 k1 k0 ..",  # 27: wide 14px brushed-steel kickplate plinth!
    ".. k0 k3 k2 k2 k2 k1 k1 k1 k1 k1 k1 k1 k1 k0 ..",  # 28: heavy steel kickplate lower bevel
    ".. k0 k0 k0 k0 k0 k0 k0 k0 k0 k0 k0 k0 k0 k0 ..",  # 29: crisp dark steel base outline
    ".. ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ..",  # 30: ground shadow (#4c557f @ alpha 85)
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 31: 1px clean bottom margin
]

# ==============================================================================
# 2. arcade_cabinet_red.png (16x32)
# Bold crimson & dark-slate heavy VS fighter arcade cabinet (distinct top-heavy horned hood!):
# - Wide 14px angular crimson & gunmetal top hood (3/4 top band)
# - Blazing warm amber/gold fighter marquee header
# - Vented dual stereo speaker grille strip
# - Recessed action CRT with 2P health bars, fiery clash spark & diagonal glass glare
# - Protruding 14px twin-joystick & 2P button VS control deck
# - Dark gunmetal & crimson armored lower body with glowing warm amber coin return & flared corner pods
# ==============================================================================
ARCADE_RED_ROWS = [
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 00: 1px clean top margin
    ".. .. r0 r0 k0 k0 k0 k0 k0 k0 k0 k0 r0 r0 .. ..",  # 01: angular fighter hood top outline
    ".. r0 r6 r5 k6 k5 k5 k4 k4 k4 k3 k2 r4 r3 r0 ..",  # 02: bright lit 3/4 crimson wings + gunmetal roof
    ".. r0 r5 a6 y6 y6 a6 o5 r4 o5 a5 y6 a4 r3 r0 ..",  # 03: glowing warm amber/gold VS marquee top
    ".. r0 r4 a5 y5 o5 r5 y6 y6 r4 o4 a4 a3 r2 r0 ..",  # 04: fiery fighter logo glow inside marquee
    ".. r0 r0 r2 k1 k1 k1 k1 k1 k1 k1 k1 r1 r0 r0 ..",  # 05: wide marquee overhang bottom outline
    ".. .. k0 k4 k0 k0 k3 k4 k3 k0 k0 k2 k1 k0 .. ..",  # 06: vented stereo speaker strip (twin slots)
    ".. .. r0 r5 k4 k3 k3 k3 k2 k2 k2 k2 r3 r0 .. ..",  # 07: speaker lower metallic rim + crimson cheeks
    ".. .. r0 r5 k2 k0 g5 y6 k7 y5 r5 k0 r3 r0 .. ..",  # 08: recessed CRT + 1P/2P VS health bars & timer!
    ".. .. r0 r5 k2 k7 a6 i1 i2 i1 r4 k1 r3 r0 .. ..",  # 09: diagonal glass glare + dark arena sky
    ".. .. r0 r4 k2 a6 i2 c6 y6 o5 i2 k1 r2 r0 .. ..",  # 10: glare + cyan/gold/orange hit-spark clash!
    ".. .. r0 r4 k1 i2 k7 s4 o6 r5 i1 k1 r2 r0 .. ..",  # 11: 1P white/blue fighter vs 2P red fighter!
    ".. .. r0 r4 k1 a4 a3 o4 a4 o3 a2 k1 r2 r0 .. ..",  # 12: lit arena stage floor strip
    ".. .. r0 r3 k1 k0 k0 k0 k0 k0 k0 k1 r2 r0 .. ..",  # 13: deep recessed CRT bottom bezel
    ".. .. r0 r4 k4 k4 k3 k3 k3 k2 k2 k2 r2 r0 .. ..",  # 14: gunmetal monitor shelf catchlight
    ".. r0 r5 k4 c6 k3 k3 k3 y6 k3 k2 k2 r4 r3 r0 ..",  # 15: 14px twin-stick deck: 1P cyan & 2P gold balls!
    ".. r0 k4 k3 k1 r5 y6 k3 k1 g5 s5 k2 k1 r3 r0 ..",  # 16: dark-slate VS deck + twin button clusters
    ".. r0 r6 r5 r5 r4 r4 r4 r4 r3 r3 r3 r2 r2 r0 ..",  # 17: bold crimson T-molding front lip
    ".. r0 r0 r1 k0 k0 k0 k0 k0 k0 k0 k0 r1 r0 r0 ..",  # 18: crisp dark under-deck recess shadow
    ".. .. r0 r5 k3 k3 k3 k2 k2 k2 k1 k1 r3 r0 .. ..",  # 19: crimson side armor + gunmetal front panel
    ".. .. r0 r5 k3 k0 k0 k0 k0 k0 k0 k1 r3 r0 .. ..",  # 20: recessed coin door top edge
    ".. .. r0 r4 k3 k0 r5 k2 o5 k2 k1 k1 r2 r0 .. ..",  # 21: glowing red & amber coin insert slots
    ".. .. r0 r4 k2 k0 k3 k2 k2 k1 k1 k1 r2 r0 .. ..",  # 22: heavy gunmetal coin door
    ".. .. r0 r4 k2 k0 k2 o6 a5 k1 k1 k1 r2 r0 .. ..",  # 23: glowing warm amber coin return window!
    ".. .. r0 r4 k2 k0 k2 a5 o4 k1 k1 k1 r2 r0 .. ..",  # 24: warm amber glow inside coin cup
    ".. .. r0 r3 k2 k3 k3 k3 k2 k2 k2 k1 r1 r0 .. ..",  # 25: coin door lower metallic rim
    ".. .. r0 r4 r3 k1 k0 k1 k0 k1 k0 k1 r2 r0 .. ..",  # 26: lower vented steel kickplate slots
    ".. r0 r5 r4 k3 k3 k2 k2 k2 k2 k1 k1 r3 r2 r0 ..",  # 27: flared 14px crimson/steel stabilizer base!
    ".. k0 k3 k2 k1 k0 k0 k0 k0 k0 k0 k1 k2 k1 k0 ..",  # 28: twin corner stabilizer pods + dark center arch
    ".. k0 k0 k0 k0 .. .. .. .. .. .. k0 k0 k0 k0 ..",  # 29: wide twin stabilizer feet outline!
    ".. ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ..",  # 30: ground shadow (#4c557f @ alpha 85)
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 31: 1px bottom margin
]


# ==============================================================================
# 3. claw_crane_machine.png (32x32)
# Iconic Korean pink/magenta & bright white UFO claw crane machine (30x29 opaque):
# - Rounded illuminated hot-pink & white UFO top canopy with cute specular rim & marquee
# - Large panoramic showcase window with crisp diagonal white/sky glass glare streaks
# - Gleaming metallic gantry rail + pink/silver carriage + 3-prong chrome claw
# - Plump colorful plushies (golden duck, pink bunny with ears, mint frog, sky kitty)
# - Protruding glossy control ledge with cyan joystick & red button + recessed prize chute
# ==============================================================================
CLAW_CRANE_ROWS = [
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 00
    ".. .. .. .. .. p0 p0 p0 p0 p0 p0 p0 p0 p0 p0 p0 p0 p0 p0 p0 p0 p0 p0 p0 p0 p0 p0 .. .. .. .. ..",  # 01: rounded dome crown
    ".. .. .. p0 p0 p6 k7 k7 k7 p6 p6 p5 p5 p5 p5 p5 p5 p5 p5 p5 p4 p4 p4 p4 p4 p3 p3 p0 p0 .. .. ..",  # 02: glossy 3/4 pink/white dome rim
    ".. p0 p0 p6 p5 p5 k7 k7 k7 k6 k6 k6 k6 k6 k6 k6 k6 k6 k6 k5 k5 k5 k5 k5 k5 k4 p4 p3 p2 p0 p0 ..",  # 03: overhanging canopy + marquee top frame
    ".. p0 p6 p5 k7 c6 c5 k7 k7 p6 p5 k7 k7 y6 y6 a5 y6 k7 k7 p5 p4 k7 k6 c5 c4 k5 p4 p3 p3 p2 p0 ..",  # 04: sleek backlit UFO marquee + golden star crown
    ".. p0 p5 p4 k6 c5 c4 k7 p5 p4 p4 k7 y6 o5 y6 y5 o5 k6 p4 p3 p4 k6 k5 c4 c3 k4 p3 p3 p2 p1 p0 ..",  # 05: smooth glowing marquee emblem
    ".. p0 p0 p3 p3 p2 k5 k5 k5 k5 k5 k5 k5 k4 k4 k4 k4 k4 k4 k4 k4 k4 k3 k3 p2 p2 p2 p1 p1 p0 p0 ..",  # 06: sculpted canopy overhang lower rim
    ".. .. p0 k7 k6 s0 s1 s1 k6 k6 k6 k6 k5 p5 p5 p4 p4 k5 k5 k5 k5 k4 k4 k4 s1 s1 s0 k5 p3 p0 .. ..",  # 07: showcase top + metallic gantry rail!
    ".. .. p0 p5 k7 s1 k7 s6 s2 s1 s1 s1 p6 k7 k6 k5 p4 p3 s1 s1 s1 s1 s6 s5 s1 s1 s0 k5 p3 p0 .. ..",  # 08: glass glare + pink/silver UFO carriage
    ".. .. p0 p5 k6 s1 s6 k7 s5 s2 s1 s1 p5 p4 k3 k2 p3 p2 s1 s1 s1 s6 s5 s2 s1 s1 s0 k5 p3 p0 .. ..",  # 09: diagonal white glare + carriage base
    ".. .. p0 p5 k6 s1 s2 s6 k7 s5 s1 s1 s1 s1 k7 k4 s1 s1 s1 s1 s1 s2 s1 s1 s1 s1 s0 k4 p2 p0 .. ..",  # 10: chrome cable descending + crisp dark claw bg
    ".. .. p0 p5 k6 s1 s1 s2 s6 s5 s1 s1 k7 k6 k7 k5 k5 k4 s1 s1 s1 s1 s1 s1 s1 s1 s0 k4 p2 p0 .. ..",  # 11: gleaming 3-prong silver claw upper arms!
    ".. .. p0 p4 k6 s1 s1 s1 s2 s1 s1 k7 k5 s1 k6 k4 s1 k6 k3 s1 s1 s1 s1 s1 s1 s1 s0 k4 p2 p0 .. ..",  # 12: 3 razor-sharp open silver prongs over dark glass!
    ".. .. p0 p4 k5 s1 s1 s1 s1 s1 s1 k6 s1 p6 s2 k5 s1 k5 s1 s1 s1 i6 i5 s1 s1 s1 s0 k4 p2 p0 .. ..",  # 13: claw tips + pink bunny ear + lavender plush!
    ".. .. p0 p4 k5 s1 y6 y5 s2 s1 s2 p6 p5 p6 p5 s2 m6 m5 s2 m6 m4 i5 s6 s5 s2 s6 s0 k3 p2 p0 .. ..",  # 14: plushie tops (duck, bunny, frog eyes, kitty ears)
    ".. .. p0 p4 k5 y6 k7 y5 y4 s2 p6 k7 p5 p5 p4 m6 k7 m0 m5 k7 m0 s6 k7 s5 s5 s4 s0 k3 p2 p0 .. ..",  # 15: plump plushie heads with specular glints!
    ".. .. p0 p4 k5 y5 a0 o5 a0 y4 p5 p1 p6 k7 p1 m5 m5 m4 m5 m4 m3 s5 s0 k7 s0 s4 s0 k3 p1 p0 .. ..",  # 16: cute eyes, duck orange beak, bunny & kitty muzzles!
    ".. .. p0 p3 k5 y5 y4 o5 y4 a4 p5 p5 p5 p4 p3 m5 m6 m5 m4 m4 m2 s5 s5 s4 s4 s3 s0 k3 p1 p0 .. ..",  # 17: plump rounded plushie bellies piled together
    ".. .. p0 p3 k4 a5 a4 a4 a3 p4 p4 p4 p3 p3 m4 m4 m4 m3 m3 s4 s4 s4 s3 s3 s3 s2 s0 k3 p1 p0 .. ..",  # 18: plushie base shadow resting on showcase floor
    ".. .. p0 p4 k6 k7 k7 k6 k6 k6 k6 k6 k6 k5 k5 c6 k7 c5 k5 k5 k5 k5 k4 k4 k4 k4 k4 k3 p2 p0 .. ..",  # 19: bright white showcase sill + cyan center LED
    ".. p0 p6 p5 k7 k7 k6 k6 k6 k6 k6 k6 k6 c6 s4 k6 k6 r6 r4 k6 k5 k5 y6 a4 k5 k4 k4 p4 p3 p2 p0 ..",  # 20: 30px protruding control deck: stick, red btn, coin!
    ".. p0 p5 p4 p6 p5 p5 p5 p5 p5 p4 p4 p4 k2 k1 p4 p4 r4 r3 p4 p3 p3 a4 a3 p3 p3 p3 p3 p2 p1 p0 ..",  # 21: sculpted hot-pink control panel front bevel
    ".. p0 p0 p2 p2 k4 k4 k4 k4 k4 k4 k4 k4 k3 k3 k3 k3 k3 k3 k3 k3 k3 k3 k2 k2 k2 p2 p1 p1 p0 p0 ..",  # 22: crisp overhang shadow under control ledge
    ".. .. p0 p6 p5 k7 k0 k0 k0 k0 k0 k0 k0 k0 k6 k6 p5 p5 p5 p4 p4 p4 k1 k1 k1 k4 p4 p3 p2 p0 .. ..",  # 23: glossy white front + deep prize chute + badge + coin
    ".. .. p0 p5 p4 k7 k0 k1 k5 k5 k4 k4 k3 k0 k6 p5 p6 k7 y6 p5 p4 p3 k1 k4 k2 k4 p4 p3 p2 p0 .. ..",  # 24: silver flap inside chute + gold star emblem!
    ".. .. p0 p5 p4 k6 k0 k1 k4 k3 k3 k2 k2 k0 k6 p5 p5 y6 y5 y4 p4 p3 k1 k0 k0 k4 p3 p3 p1 p0 .. ..",  # 25: deep dark prize cavity + star badge + coin cup
    ".. .. p0 p4 p4 k6 k0 k1 k1 k1 k1 k1 k1 k0 k5 p4 p5 p4 y5 p4 p3 p2 k3 k4 k3 k3 p3 p2 p1 p0 .. ..",  # 26: dark interior depth of prize drop chute
    ".. .. p0 p4 p3 k6 k7 k7 k6 k6 k6 k5 k5 k5 k5 k5 p4 p3 p3 p3 p2 p2 k5 k4 k4 k3 p3 p2 p1 p0 .. ..",  # 27: bright bottom catchlight on prize chute sill!
    ".. .. k0 p3 p2 k4 k3 k0 k0 k0 k0 k3 k3 k2 k2 k0 k0 k2 k2 k2 k1 k0 k0 k0 k0 k2 p2 p1 p1 k0 .. ..",  # 28: sturdy plum & steel base + dark under-chassis outline
    ".. .. k0 k0 k0 k0 k0 .. .. .. .. k0 k0 k0 k0 .. .. k0 k0 k0 k0 .. .. .. .. k0 k0 k0 k0 k0 .. ..",  # 29: 4 sturdy caster feet with crisp dark outline
    ".. .. ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ .. ..",  # 30: ground shadow (#4c557f @ alpha 85)
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 31: 1px clean bottom margin
]


# ==============================================================================
# 4. coin_changer.png (16x32)
# Gleaming brushed-steel & warm gold/amber Korean coin changer (inspired by img_68_.png!):
# - Rounded glowing warm amber/gold top indicator dome
# - Sculpted rounded brushed-steel crown + warm gold/amber header plaque
# - Continuous left specular steel highlight column + right cylindrical shadow
# - Digital LED window + crisp dark recessed bill slot with green & amber indicator LEDs
# - Deep recessed metallic coin dispenser cup with gleaming gold coins inside
# - Sturdy 14px protruding dark-steel plinth with warm brass rivet glint
# ==============================================================================
COIN_CHANGER_ROWS = [
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 00: 1px clean top margin
    ".. .. .. .. .. a0 a0 a0 a0 a0 a0 .. .. .. .. ..",  # 01: rounded top dome crown outline
    ".. .. .. .. a0 k7 y6 a6 a5 a4 a3 a0 .. .. .. ..",  # 02: glowing warm amber top beacon dome
    ".. .. .. k0 k0 a0 a4 a3 a3 a2 a0 k0 k0 .. .. ..",  # 03: dome collar + rounded steel shoulder outline
    ".. .. k0 k7 k7 k6 k6 k6 k5 k5 k4 k4 k3 k0 .. ..",  # 04: gleaming 3/4 brushed-steel rounded top cap!
    ".. .. k0 k7 a6 a6 a5 a5 a5 a4 a4 a3 k2 k0 .. ..",  # 05: warm gold/amber upper header band
    ".. .. k0 k7 a5 y6 a4 y6 a5 a4 y5 a2 k2 k0 .. ..",  # 06: embossed golden coin/100W header motif
    ".. .. k0 k6 k5 k5 k4 k4 k4 k3 k3 k3 k2 k0 .. ..",  # 07: brushed steel divider bevel
    ".. .. k0 k7 k5 k0 k0 k0 k0 k0 k0 k3 k2 k0 .. ..",  # 08: recessed digital LED bezel top
    ".. .. k0 k7 k5 k0 g5 k1 o6 y6 k0 k3 k2 k0 .. ..",  # 09: glowing green status + amber '100' LED readout!
    ".. .. k0 k6 k5 k4 k5 k5 k4 k4 k4 k3 k2 k0 .. ..",  # 10: crisp metallic catchlight under LED window
    ".. .. k0 k6 a6 a6 a5 a5 a5 a4 a4 a3 k2 k0 .. ..",  # 11: gold bill faceplate recessed inside steel frame!
    ".. .. k0 k6 a5 g6 k1 k1 k1 k1 y6 a3 k2 k0 .. ..",  # 12: bright green ready LED + warm amber LED!
    ".. .. k0 k6 a5 k0 k0 k0 k0 k0 k0 a3 k2 k0 .. ..",  # 13: crisp dark recessed 1000W bill slot!
    ".. .. k0 k6 a6 k7 k7 k6 k6 k5 k5 a3 k2 k0 .. ..",  # 14: gleaming beveled silver bill-guide lip!
    ".. .. k0 k6 a5 a4 a4 a4 a3 a3 a2 a2 k2 k0 .. ..",  # 15: lower bevel of warm gold faceplate inside steel
    ".. .. k0 k7 k5 k4 k4 k4 k3 k3 k3 k3 k2 k0 .. ..",  # 16: brushed steel middle body + left specular glint
    ".. .. k0 k7 k5 k0 k4 k4 o6 r4 k3 k3 k2 k0 .. ..",  # 17: vertical 500W coin slit + orange/red return btn
    ".. .. k0 k6 k5 k0 k4 k3 k2 k1 k3 k2 k2 k0 .. ..",  # 18: coin slit bottom + button shadow
    ".. .. k0 k6 k5 k4 k4 k4 k3 k3 k3 k2 k1 k0 .. ..",  # 19: smooth cylindrical steel transition
    ".. .. k0 k6 k2 k1 k1 k1 k1 k1 k1 k2 k1 k0 .. ..",  # 20: deep recessed coin dispenser cup top shadow
    ".. .. k0 k6 k2 k0 k0 k1 k1 k0 k0 k2 k1 k0 .. ..",  # 21: dark recessed coin scoop upper cavity
    ".. .. k0 k5 k2 k0 y6 a6 y5 a4 k0 k2 k1 k0 .. ..",  # 22: gleaming gold coins glinting inside cup!
    ".. .. k0 k5 k2 k1 a5 y6 a4 a3 k1 k2 k1 k0 .. ..",  # 23: stacked brass/gold 100W coins glint
    ".. .. k0 k5 k6 k7 k6 k6 k5 k5 k4 k3 k1 k0 .. ..",  # 24: bright specular steel catchlight on cup lip!
    ".. .. k0 k5 k4 k4 k3 k3 k3 k2 k2 k2 k1 k0 .. ..",  # 25: lower steel body above plinth
    ".. k0 k5 k4 k4 k4 k3 k3 k3 k2 k2 k2 k1 k1 k0 ..",  # 26: sturdy 14px protruding steel plinth top bevel!
    ".. k0 k3 o5 k2 k2 k2 k1 k1 k1 k1 k1 a4 k1 k0 ..",  # 27: dark steel plinth face + warm brass rivets!
    ".. k0 k2 k1 k1 k1 k1 k1 k1 k1 k1 k1 k1 k1 k0 ..",  # 28: deep steel plinth base
    ".. k0 k0 k0 k0 k0 k0 k0 k0 k0 k0 k0 k0 k0 k0 ..",  # 29: crisp dark steel base outline
    ".. ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ..",  # 30: ground shadow (#4c557f @ alpha 85)
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 31: 1px clean bottom margin
]


# ==============================================================================
# 5. vending_machine_drinks.png (32x32)
# Iconic vivid cobalt-blue & glossy white Korean beverage vending machine (30x29 opaque):
# - Glossy rounded cobalt-blue & white 3/4 top rim + overhanging backlit cyan/white sign
# - Brightly lit display showcase window (left 70%) with crisp diagonal white/sky glass glare
# - 3 crisp rows of 5 miniature colorful drink cans & bottles (15 cans!) with 1px glints
# - Glowing row selection buttons + right-side white/silver payment column (LED, bill slot, coin)
# - Sculpted 5-tone cobalt lower body with wide deep recessed bottom pickup chute & vents
# ==============================================================================
VENDING_DRINKS_ROWS = [
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 00
    ".. .. .. b0 b0 b0 b0 b0 b0 b0 b0 b0 b0 b0 b0 b0 b0 b0 b0 b0 b0 b0 b0 b0 b0 b0 b0 b0 b0 .. .. ..",  # 01: rounded top crown outline
    ".. .. b0 k7 k7 b6 b6 b6 b5 b5 b5 b5 b5 b5 b5 b5 b5 b5 b4 b4 b4 b4 b4 b4 b4 b4 b3 b3 b2 b0 .. ..",  # 02: glossy 3/4 cobalt/white rounded roof
    ".. b0 b6 b5 k7 k7 k7 c6 c6 c6 c5 c5 c5 s5 s5 s5 c5 c4 k6 k6 b5 b4 b4 b4 b4 b3 b3 b3 b2 b2 b0 ..",  # 03: overhanging canopy + smooth backlit cyan sign
    ".. b0 b5 b4 k6 c6 c5 k7 k7 c5 s5 k7 k7 s5 c5 s4 c4 c3 k5 k5 b4 b4 b4 b3 b3 b3 b2 b2 b2 b1 b0 ..",  # 04: sleek brand sign + sculpted cobalt shoulder
    ".. b0 b0 b2 b1 b1 b1 b1 b1 b1 b1 b1 b1 b1 b1 b1 b1 b1 b1 b1 b1 b2 b2 b2 b2 b1 b1 b1 b1 b0 b0 ..",  # 05: crisp overhang recess under top canopy
    ".. .. b0 b6 k7 k7 k7 k6 k6 k6 k6 k6 k6 k6 k6 k6 k5 k5 k5 k5 k4 b4 k6 k6 k5 k5 k4 b3 b2 b0 .. ..",  # 06: glossy white showcase frame + right payment top
    ".. .. b0 b5 k7 s1 r6 r4 k7 g6 g4 s1 c6 s4 s1 o6 o4 s1 y6 y4 k4 b4 k6 k0 c6 r5 k0 k4 b2 b0 .. ..",  # 07: Row 1 tops (cola, cider, ion, orange, lemon) + LED!
    ".. .. b0 b5 k7 k7 r5 r3 s6 g5 g3 s1 s5 s3 s1 o5 o3 s1 y5 a4 k4 b4 k6 k0 c5 o5 k0 k3 b2 b0 .. ..",  # 08: Row 1 cans + diagonal white/sky glass glare!
    ".. .. b0 b5 k6 s6 r4 r2 k7 g4 g2 s6 s4 s2 s1 o4 o2 s1 y4 a3 k4 b4 k5 s5 k4 r5 k4 k3 b2 b0 .. ..",  # 09: Row 1 bases + diagonal glare + COLD/HOT LEDs!
    ".. .. b0 b5 k6 k6 k6 c5 k6 k6 g5 k6 k6 c5 k6 k6 g5 k6 k6 c5 k4 b3 k5 k4 k4 k4 k3 k3 b2 b0 .. ..",  # 10: Shelf 1 white rail + glowing cyan/green buttons!
    ".. .. b0 b5 k6 s1 c6 c4 s1 p6 p4 k7 a6 o4 s1 m6 m4 s1 b6 b4 k4 b3 k5 k1 g5 k1 k1 k3 b2 b0 .. ..",  # 11: Row 2 tops (cyan, peach, coffee, melon, energy) + LED
    ".. .. b0 b4 k6 s1 c5 c3 s1 p5 p3 s6 o5 a3 k7 m5 m3 s1 b5 b3 k3 b3 k5 k0 k0 k0 k0 k3 b2 b0 .. ..",  # 12: Row 2 cans + diagonal glass glare + bill slot!
    ".. .. b0 b4 k6 s1 c4 c2 s1 p4 p2 s1 a4 a2 s6 m4 m2 s1 b4 b2 k3 b3 k5 k6 k6 k5 k4 k3 b2 b0 .. ..",  # 13: Row 2 bases + glare + gleaming bill-guide lip
    ".. .. b0 b4 k5 k6 k6 g5 k6 k6 c5 k6 k6 g5 k6 k6 c5 k6 k6 g5 k3 b3 k4 k4 k3 k3 k3 k2 b1 b0 .. ..",  # 14: Shelf 2 white rail + glowing selection buttons!
    ".. .. b0 b4 k5 s1 y6 a5 s1 r6 r4 s1 k7 s5 s1 g6 m4 k7 v6 v4 k3 b3 k4 k0 k6 o5 k3 k2 b1 b0 .. ..",  # 15: Row 3 tops (banana, berry, milk, tea, grape) + coin!
    ".. .. b0 b4 k5 s1 y5 a4 s1 r5 r3 s1 k6 s4 s1 m5 m3 s1 v5 v3 k3 b2 k4 k0 k4 r4 k3 k2 b1 b0 .. ..",  # 16: Row 3 cans + coin slit & red return lever
    ".. .. b0 b3 k5 s1 a5 a3 s1 r4 r2 s1 s5 s3 s1 m4 m2 s1 v4 v2 k3 b2 k4 k3 k3 k2 k2 k2 b1 b0 .. ..",  # 17: Row 3 bases
    ".. .. b0 b3 k5 k6 k6 c5 k6 k6 g5 k6 k6 c5 k6 k6 g5 k6 k6 c5 k3 b2 k4 k0 k0 k0 k2 k2 b1 b0 .. ..",  # 18: Shelf 3 rail + buttons + dark coin return cup!
    ".. .. b0 b4 k5 k6 k6 k6 k5 k5 k5 k5 k5 k5 k5 k4 k4 k4 k4 k4 k3 b2 k4 k5 k5 k4 k3 k2 b1 b0 .. ..",  # 19: showcase white bottom sill + coin cup catchlight
    ".. b0 b6 b5 b5 b5 b5 b5 b4 b4 b4 b4 b4 b4 b4 b4 b3 b3 b3 b3 b3 b3 b3 b3 b3 b2 b2 b2 b2 b1 b0 ..",  # 20: 30px protruding sculpted cobalt waist bumper!
    ".. b0 b0 b3 b3 b3 b3 b2 b2 b2 b2 b2 b2 b2 b2 b2 b2 b2 b2 b2 b2 b2 b2 b2 b1 b1 b1 b1 b1 b0 b0 ..",  # 21: crisp waist bumper lower bevel
    ".. .. b0 b6 b5 k0 k0 k0 k0 k0 k0 k0 k0 k0 k0 k0 k0 k0 k0 k0 k0 b3 b4 b4 b3 b3 b3 b2 b1 b0 .. ..",  # 22: deep recessed bottom pickup chute top shadow
    ".. .. b0 b5 b4 k0 k1 k1 k1 k1 k1 k1 k1 k1 k1 k1 k1 k1 k1 k1 k0 b3 b1 b1 b1 b1 b1 b2 b1 b0 .. ..",  # 23: dark chute cavity + right side louver slit 1
    ".. .. b0 b5 b4 k0 k1 k5 k5 k5 k4 k4 k4 k4 k4 k3 k3 k3 k3 k1 k0 b3 b4 b4 b4 b3 b3 b2 b1 b0 .. ..",  # 24: brushed silver push-flap door inside chute!
    ".. .. b0 b4 b4 k0 k1 k4 k3 k3 k3 k3 k2 k2 k2 k2 k2 k2 k2 k1 k0 b3 b1 b1 b1 b1 b1 b2 b1 b0 .. ..",  # 25: push-flap lower bevel + louver slit 2
    ".. .. b0 b4 b3 k5 k6 k6 k6 k6 k5 k5 k5 k5 k5 k4 k4 k4 k4 k4 k3 b2 b4 b4 b3 b3 b3 b2 b1 b0 .. ..",  # 26: bright specular catchlight on pickup chute sill!
    ".. k0 b5 b4 b4 b4 b4 b4 b3 b3 b3 b3 b3 b3 b3 b3 b2 b2 b2 b2 b2 b2 b2 b2 b2 b2 b1 b1 b1 b1 k0 ..",  # 27: 30px lower cobalt plinth rim
    ".. k0 k4 k3 k3 k2 k1 k0 k0 k0 k0 k2 k2 k1 k1 k0 k0 k2 k2 k1 k1 k0 k0 k0 k0 k1 k1 k1 k1 k1 k0 ..",  # 28: sturdy 30px dark-steel base plinth + dark recesses
    ".. k0 k0 k0 k0 k0 k0 .. .. .. .. k0 k0 k0 k0 .. .. k0 k0 k0 k0 .. .. .. .. k0 k0 k0 k0 k0 k0 ..",  # 29: 4 symmetric dark-steel leveling feet!
    ".. ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ..",  # 30: ground shadow (#4c557f @ alpha 85)
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 31: 1px clean bottom margin
]


def verify_sprite(im: Image.Image, name: str, allowed_hexes: set[str], target_w_range: tuple[int, int], target_h_range: tuple[int, int]) -> dict:
    w, h = im.size
    px = im.load()

    off_palette = []
    bad_alpha = []
    bad_outline = []
    opaque_xs = []
    opaque_ys = []
    opaque_colors = set()
    shadow_count = 0

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            elif a == 85:
                if (r, g, b, a) != SHADOW_RGBA:
                    bad_alpha.append((x, y, (r, g, b, a)))
                shadow_count += 1
            elif a == 255:
                hx = f"#{r:02x}{g:02x}{b:02x}"
                if hx == "#000000" or hx not in allowed_hexes:
                    off_palette.append((x, y, hx))
                opaque_xs.append(x)
                opaque_ys.append(y)
                opaque_colors.add(hx)

                # Check if on outer boundary (touching canvas edge or non-255 pixel in 4-neighborhood)
                touches_outside = False
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if nx < 0 or nx >= w or ny < 0 or ny >= h or px[nx, ny][3] != 255:
                        touches_outside = True
                        break
                if touches_outside and hx not in DARK_OUTLINE_HEXES:
                    bad_outline.append((x, y, hx))
            else:
                bad_alpha.append((x, y, (r, g, b, a)))

    min_x, max_x = min(opaque_xs), max(opaque_xs)
    min_y, max_y = min(opaque_ys), max(opaque_ys)
    op_w = max_x - min_x + 1
    op_h = max_y - min_y + 1
    left_margin = min_x
    right_margin = w - 1 - max_x
    bottom_margin_opaque = h - 1 - max_y

    assert not off_palette, f"{name}: OFF-PALETTE PIXELS: {off_palette}"
    assert not bad_alpha, f"{name}: BAD ALPHA PIXELS: {bad_alpha}"
    assert not bad_outline, f"{name}: NON-DARK OUTER OUTLINE PIXELS: {bad_outline[:10]}"
    assert target_w_range[0] <= op_w <= target_w_range[1], f"{name}: opaque width {op_w} outside {target_w_range}"
    assert target_h_range[0] <= op_h <= target_h_range[1], f"{name}: opaque height {op_h} outside {target_h_range}"
    assert abs(left_margin - right_margin) <= 1, f"{name}: not horizontally centered ({left_margin} vs {right_margin})"
    assert 1 <= bottom_margin_opaque <= 2, f"{name}: bottom opaque margin {bottom_margin_opaque} not in 1..2"

    return {
        "name": name,
        "canvas": f"{w}x{h}",
        "opaque_bbox": (min_x, min_y, max_x + 1, max_y + 1),
        "opaque_size": f"{op_w}x{op_h}",
        "margins_lr_tb": (left_margin, right_margin, min_y, bottom_margin_opaque),
        "unique_colors": len(opaque_colors),
        "shadow_px": shadow_count,
    }


def extract_char_1x(path: Path) -> Image.Image:
    """ref_mod1_char.png is 72x96 (3x scale of 24x32). Recover clean 1x 24x32."""
    raw = Image.open(path).convert("RGBA")
    if raw.size == (72, 96):
        out = Image.new("RGBA", (24, 32), (0, 0, 0, 0))
        src = raw.load()
        dst = out.load()
        for y in range(32):
            for x in range(24):
                dst[x, y] = src[x * 3 + 1, y * 3 + 1]
        return out
    return raw


def build_preview_sheet(sprites: list[tuple[str, Image.Image, dict]]) -> None:
    bg_gray = (118, 118, 112, 255)  # #767670 neutral 50% gray
    card_border = (92, 92, 86, 255)
    header_bg = (98, 98, 92, 255)

    sheet_w = 840
    sheet_h = 360
    sheet = Image.new("RGBA", (sheet_w, sheet_h), bg_gray)
    draw = ImageDraw.Draw(sheet)

    try:
        font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 13)
        font_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
    except Exception:
        font_title = ImageFont.load_default()
        font_sub = ImageFont.load_default()

    # Header bar
    draw.rectangle([12, 10, sheet_w - 12, 82], fill=header_bg, outline=card_border, width=1)
    draw.text((22, 18), "modern_pcbang_carbon — Batch 2/4 Arcade & Vending (2x + 1x on #767670)", fill=(250, 250, 248, 255), font=font_title)
    draw.text((22, 38), "Palette Locked (118 colors, modern_palette_v3.json) | Shadow #4c557f @ a=85 | Strict Dark Outer Outlines", fill=(226, 228, 232, 255), font=font_sub)
    draw.text((22, 56), "Scale Ref: ref_mod1_char (22px tall @ 1x) shown at 2x & 1x in header AND beside sprites", fill=(190, 192, 200, 255), font=font_sub)

    char_1x = extract_char_1x(CHAR_REF_PATH)
    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.NEAREST)
    sheet.alpha_composite(char_2x, (sheet_w - 130, 12))
    sheet.alpha_composite(char_1x, (sheet_w - 64, 44))

    card_w = 158
    card_h = 252
    gap = 6
    start_x = 13
    start_y = 94

    for idx, (fname, im, stats) in enumerate(sprites):
        cx = start_x + idx * (card_w + gap)
        cy = start_y
        draw.rectangle([cx, cy, cx + card_w, cy + card_h], fill=bg_gray, outline=card_border, width=1)

        # Baseline floor line for 2x + char_2x comparison
        floor_2x_y = cy + 128
        draw.line([(cx + 10, floor_2x_y + 1), (cx + card_w - 10, floor_2x_y + 1)], fill=(102, 102, 96, 255), width=1)

        im_2x = im.resize((im.width * 2, im.height * 2), Image.NEAREST)
        # Place char_2x slightly faded/beside or crisp right next to 2x sprite, plus 1x pair below!
        pair_2x_w = im_2x.width + 8 + char_2x.width
        px_2x = cx + (card_w - pair_2x_w) // 2
        sheet.alpha_composite(im_2x, (px_2x, floor_2x_y - im_2x.height))
        sheet.alpha_composite(char_2x, (px_2x + im_2x.width + 8, floor_2x_y - char_2x.height))

        # 1x native pair row
        floor_1x_y = cy + 182
        draw.line([(cx + 10, floor_1x_y + 1), (cx + card_w - 10, floor_1x_y + 1)], fill=(102, 102, 96, 255), width=1)
        pair_1x_w = im.width + 12 + char_1x.width
        px_1x = cx + (card_w - pair_1x_w) // 2
        sheet.alpha_composite(im, (px_1x, floor_1x_y - im.height))
        sheet.alpha_composite(char_1x, (px_1x + im.width + 12, floor_1x_y - char_1x.height))

        label = fname.replace(".png", "")
        draw.text((cx + 6, cy + 194), f"0{idx+1}. {label}", fill=(250, 250, 248, 255), font=font_sub)
        draw.text((cx + 6, cy + 211), f"canvas {stats['canvas']} | opq {stats['opaque_size']}", fill=(210, 212, 218, 255), font=font_sub)
        draw.text((cx + 6, cy + 227), f"{stats['unique_colors']} cols | PASS", fill=(156, 250, 154, 255), font=font_sub)

    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW_PATH)


def main() -> None:
    pal_data = json.loads(PALETTE_PATH.read_text())
    allowed_hexes = {c.lower() for c in pal_data["all_colors"]}
    assert len(allowed_hexes) == 118, f"Expected 118 colors, got {len(allowed_hexes)}"

    # Verify every token in TOKENS belongs to modern_palette_v3.json
    for k, hx in TOKENS.items():
        assert hx.lower() in allowed_hexes, f"Token {k}={hx} is NOT in modern_palette_v3.json!"

    specs = [
        ("arcade_cabinet_blue.png", 16, 32, ARCADE_BLUE_ROWS, (13, 15), (28, 30)),
        ("arcade_cabinet_red.png", 16, 32, ARCADE_RED_ROWS, (13, 15), (28, 30)),
        ("claw_crane_machine.png", 32, 32, CLAW_CRANE_ROWS, (28, 30), (28, 30)),
        ("coin_changer.png", 16, 32, COIN_CHANGER_ROWS, (13, 15), (28, 30)),
        ("vending_machine_drinks.png", 32, 32, VENDING_DRINKS_ROWS, (28, 30), (28, 30)),
    ]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    built: list[tuple[str, Image.Image, dict]] = []

    for fname, w, h, rows, w_rng, h_rng in specs:
        im = parse_grid(rows, w, h, fname)
        stats = verify_sprite(im, fname, allowed_hexes, w_rng, h_rng)
        out_file = OUT_DIR / fname
        im.save(out_file)
        built.append((fname, im, stats))
        print(f"[PASS] {fname:28s} | canvas={stats['canvas']} | opaque={stats['opaque_size']} | colors={stats['unique_colors']} | margins={stats['margins_lr_tb']}")

    build_preview_sheet(built)
    print(f"[PREVIEW] Saved {PREVIEW_PATH}")


if __name__ == "__main__":
    main()
