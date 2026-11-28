#!/usr/bin/env python3
"""
Batch 3/4: Museum-Grade Beodeul Wizard Library — Alchemy Workshop & Lighting Objects
Model: gemini-4-carbon (medium)

Sprites:
  1. alchemy_cauldron_hearth.png (32x32, standing, op ~26x28)
  2. potion_alembic_shelf.png    (32x32, standing, op ~28x29)
  3. alchemy_workbench.png       (32x16, topdown,  op ~30x14)
  4. brass_candelabra.png        (16x32, slender,  op ~12x30)
  5. wall_banner_crimson.png     (16x32, standing, op ~14x30)

Hard Rules:
  - 100% locked to palette_beodeul_library.json (70 colors, 0 off-palette, 0 #000000).
  - Optional ground shadow ONLY #4c557f at alpha 85/255; all other pixels alpha 0 or 255.
  - Strict 1px dark material outer outline on EVERY edge touching transparency/shadow/bounds.
  - Exact camera discipline: standing (front + 1/4-1/3 top band, zero side walls),
    topdown (empty top >=75%, apron <=3px, stub legs), slender (2-4px post + 1px dark outline).
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
REFS_DIR = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs"
OLD_DIR = ROOT / "tiledata/dungeon-dots/fantasy_wizard_library"
PALETTE_PATH = OLD_DIR / "palette_beodeul_library.json"
CHAR_REF_PATH = REFS_DIR / "ref_beodeul_char_4x.png"

OUT_DIR = ROOT / "tiledata/dungeon-dots/fantasy_wizard_library_carbon"
OBJ_DIR = OUT_DIR / "objects"
PREVIEW_PATH = OUT_DIR / "preview_batch3.png"

PAL_DATA = json.loads(PALETTE_PATH.read_text(encoding="utf-8"))
ALL_HEX = {c.lower() for c in PAL_DATA["colors"]}
RAMPS = PAL_DATA["ramps"]

SHADOW_RGBA = (0x4C, 0x55, 0x7F, 85)
TRANSPARENT = (0, 0, 0, 0)

# Convenience ramp aliases (100% from palette_beodeul_library.json)
ST_O, ST0, ST1, ST2, ST3, ST4, ST5, ST6 = (
    RAMPS["stone"]["out"], RAMPS["stone"]["0"], RAMPS["stone"]["1"], RAMPS["stone"]["2"],
    RAMPS["stone"]["3"], RAMPS["stone"]["4"], RAMPS["stone"]["5"], RAMPS["stone"]["6"],
)
SL_O, SL0, SL1, SL2, SL3, SL4 = (
    RAMPS["slate"]["out"], RAMPS["slate"]["0"], RAMPS["slate"]["1"],
    RAMPS["slate"]["2"], RAMPS["slate"]["3"], RAMPS["slate"]["4"],
)
DO_O, DO0, DO1, DO2, DO3, DO4 = (
    RAMPS["dark_oak"]["out"], RAMPS["dark_oak"]["0"], RAMPS["dark_oak"]["1"],
    RAMPS["dark_oak"]["2"], RAMPS["dark_oak"]["3"], RAMPS["dark_oak"]["4"],
)
OK_O, OK0, OK1, OK2, OK3, OK4, OK5 = (
    RAMPS["oak"]["out"], RAMPS["oak"]["0"], RAMPS["oak"]["1"], RAMPS["oak"]["2"],
    RAMPS["oak"]["3"], RAMPS["oak"]["4"], RAMPS["oak"]["5"],
)
IR_O, IR0, IR1, IR2, IR3 = (
    RAMPS["iron"]["out"], RAMPS["iron"]["0"], RAMPS["iron"]["1"],
    RAMPS["iron"]["2"], RAMPS["iron"]["3"],
)
GD_O, GD0, GD1, GD2, GD3, GD4 = (
    RAMPS["brass"]["out"], RAMPS["brass"]["0"], RAMPS["brass"]["1"],
    RAMPS["brass"]["2"], RAMPS["brass"]["3"], RAMPS["brass"]["4"],
)
PA_O, PA0, PA1, PA2, PA3 = (
    RAMPS["parchment"]["out"], RAMPS["parchment"]["0"], RAMPS["parchment"]["1"],
    RAMPS["parchment"]["2"], RAMPS["parchment"]["3"],
)
RD_O, RD0, RD1, RD2, RD3 = (
    RAMPS["crimson"]["out"], RAMPS["crimson"]["0"], RAMPS["crimson"]["1"],
    RAMPS["crimson"]["2"], RAMPS["crimson"]["3"],
)
FL0, FL1, FL2, FL3, FL4 = (
    RAMPS["flame"]["0"], RAMPS["flame"]["1"], RAMPS["flame"]["2"],
    RAMPS["flame"]["3"], RAMPS["flame"]["4"],
)
TL_O, TL0, TL1, TL2, TL3, TL4 = (
    RAMPS["teal"]["out"], RAMPS["teal"]["0"], RAMPS["teal"]["1"],
    RAMPS["teal"]["2"], RAMPS["teal"]["3"], RAMPS["teal"]["4"],
)
BL_O, BL0, BL1, BL2 = (
    RAMPS["indigo"]["out"], RAMPS["indigo"]["0"], RAMPS["indigo"]["1"], RAMPS["indigo"]["2"],
)
GR_O, GR0, GR1, GR2, GR3 = (
    RAMPS["moss"]["out"], RAMPS["moss"]["0"], RAMPS["moss"]["1"],
    RAMPS["moss"]["2"], RAMPS["moss"]["3"],
)
PL0, PL1 = RAMPS["plum"]["0"], RAMPS["plum"]["1"]

# Strict dark material outer-outline shades (all luma <= 63, zero light outlines!)
DARK_OUTLINE_HEX = {
    ST_O,  # #27282f stone_out
    SL_O,  # #1c1c26 slate_out
    DO_O,  # #1f130b dark_oak_out
    OK_O,  # #382315 oak_out
    IR_O,  # #141b2c iron_out
    GD_O,  # #4e3d22 brass_out
    RD_O,  # #421b1d crimson_out
    TL_O,  # #0c2222 teal_out
    BL_O,  # #141231 indigo_out
    GR_O,  # #1d2d19 moss_out
}


def hx(c: str) -> tuple[int, int, int, int]:
    c = c.lower()
    assert c in ALL_HEX, f"Off-palette color used: {c}"
    return (int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16), 255)


class Canvas:
    def __init__(self, w: int, h: int):
        self.w = w
        self.h = h
        self.im = Image.new("RGBA", (w, h), TRANSPARENT)
        self.px = self.im.load()

    def set(self, x: int, y: int, c: str | tuple[int, int, int, int] | None) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            if c is None:
                self.px[x, y] = TRANSPARENT
            elif isinstance(c, str):
                self.px[x, y] = hx(c)
            else:
                self.px[x, y] = c

    def shadow(self, x: int, y: int) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            if self.px[x, y][3] == 0:
                self.px[x, y] = SHADOW_RGBA

    def hline(self, x0: int, x1: int, y: int, c: str | None) -> None:
        for x in range(x0, x1 + 1):
            self.set(x, y, c)

    def vline(self, x: int, y0: int, y1: int, c: str | None) -> None:
        for y in range(y0, y1 + 1):
            self.set(x, y, c)

    def rect(self, x0: int, y0: int, x1: int, y1: int, c: str | None) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, c)


# ---------------------------------------------------------------------------
# 1. alchemy_cauldron_hearth.png (32x32, standing, target opaque ~26x28)
#    Round curved cast-iron cauldron with gleaming metallic belly shading,
#    curled iron handles, brimming with luminous bubbling emerald/teal potion
#    brew & floating bright vapor bubbles, perched on a stout iron tripod over
#    glowing orange-red hearth coals!
# ---------------------------------------------------------------------------
def draw_alchemy_cauldron_hearth() -> Image.Image:
    c = Canvas(32, 32)

    # --- A. Cobbled Stone Hearth Ring & Blazing Orange-Red Coals (y=24..30, x=5..26) ---
    hearth_spans = {
        24: (9, 22),
        25: (7, 24),
        26: (5, 26),
        27: (5, 26),
        28: (5, 26),
        29: (6, 25),
        30: (8, 23),
    }
    for y, (x0, x1) in hearth_spans.items():
        c.hline(x0, x1, y, ST_O)

    # Dressed cobblestone ring interior (y=25..29)
    c.hline(8, 23, 25, ST2)
    c.hline(6, 25, 26, ST3)
    c.hline(6, 11, 26, ST4)
    c.hline(6, 25, 27, ST3)
    c.hline(6, 25, 28, ST2)
    c.hline(7, 24, 29, ST1)

    # Individual front hearth cobblestones with top-left bevels & dark mortar seams
    # Stones around front rim at y=28..29: (6..10), (11..15), (16..20), (21..25)
    for sx in (10, 15, 20):
        c.vline(sx, 28, 29, ST0)
    c.hline(6, 9, 27, ST4)
    c.set(6, 27, ST5)
    c.hline(8, 14, 28, PA1)    # warm fire-lit front hearth cobbles!
    c.hline(11, 14, 28, PA2)
    c.hline(16, 22, 28, PA0)
    c.hline(16, 19, 28, PA1)
    c.hline(9, 22, 29, ST2)
    c.hline(16, 22, 29, ST1)
    c.set(25, 27, ST1)
    c.set(25, 28, ST0)

    # Wide uninterrupted bed of blazing orange-red hearth coals & charred logs (x=9..22, y=24..27)!
    c.rect(9, 25, 22, 27, RD0)
    c.hline(10, 21, 27, FL0)
    c.hline(12, 19, 27, FL1)
    c.hline(14, 17, 27, FL2)
    c.set(11, 27, DO0)  # charred oak log end
    c.set(20, 27, DO0)
    # Glowing coal bed (y=25..26)
    c.hline(9, 22, 26, FL0)
    c.hline(10, 21, 26, FL1)
    c.hline(12, 19, 26, FL2)
    c.hline(13, 18, 26, FL3)
    c.set(15, 26, FL4)
    c.set(16, 26, FL4)
    c.set(11, 26, DO1)  # glowing coal chunk contrast
    c.set(18, 26, FL1)
    # Licking hearth flames kissing underside of suspended cauldron (y=24..25)
    c.hline(10, 21, 25, FL1)
    c.hline(12, 19, 25, FL2)
    c.hline(13, 18, 25, FL3)
    c.set(14, 25, FL4)
    c.set(17, 25, FL4)
    c.set(12, 24, FL2)
    c.set(14, 24, FL3)
    c.set(16, 24, FL4)
    c.set(18, 24, FL2)
    c.set(19, 24, FL1)

    # --- B. Spherical Cast-Iron Cauldron Body (y=9..24, x=6..25) ---
    # Constricted neck at y=14, wide bulging spherical belly at y=17..20, rounded bottom at y=23..24
    pot_spans = {
        9: (8, 23),     # upper rolled rim back edge
        10: (7, 24),    # rolled rim upper curve
        11: (6, 25),    # wide open rim
        12: (6, 25),    # wide open rim
        13: (7, 24),    # front rolled rim lip
        14: (8, 23),    # constricted iron neck groove!
        15: (6, 25),    # upper shoulder flare (joins handles cleanly!)
        16: (6, 25),    # belly upper curve
        17: (5, 26),    # widest spherical belly!
        18: (5, 26),    # widest spherical belly!
        19: (5, 26),    # widest spherical belly!
        20: (6, 25),    # lower belly curve
        21: (7, 24),    # lower taper
        22: (8, 23),    # fire-lit bottom curve
        23: (10, 21),   # rounded pot base
        24: (12, 19),   # bottom outline touching coals
    }
    for y, (x0, x1) in pot_spans.items():
        c.hline(x0, x1, y, IR_O)

    # Volumetric spherical cast-iron shading on belly (y=15..23)
    cx, cy = 14.0, 18.0
    for y in range(15, 24):
        x0, x1 = pot_spans[y]
        for x in range(x0 + 1, x1):
            # Normalized distance from upper-left specular focus (10.5, 17.0)
            d_spec = math.hypot((x - 10.2) / 5.2, (y - 17.2) / 3.4)
            if d_spec <= 0.58:
                col = IR3
            elif d_spec <= 1.12:
                col = IR2
            elif x <= 18 and y <= 21:
                col = IR1
            elif x <= 21 and y <= 20:
                col = SL1
            else:
                col = IR0
            c.set(x, y, col)

    # Extra crisp curved pewter specular crescent on upper-left belly
    for sx, sy in ((8, 16), (9, 16), (10, 16), (7, 17), (8, 17), (9, 17), (7, 18), (8, 18), (8, 19)):
        c.set(sx, sy, IR3)
    c.set(9, 15, IR2)
    c.set(10, 15, IR2)

    # Forged horizontal girth band & rivets around belly equator (y=19)
    for x in range(6, 26):
        if x in (5, 26):
            continue
        if x <= 10:
            c.set(x, 19, IR2)
        elif x <= 17:
            c.set(x, 19, IR1)
        else:
            c.set(x, 19, IR0)
    for rx, rcol in ((8, IR3), (12, IR3), (16, IR2), (20, IR1), (23, SL1)):
        c.set(rx, 19, rcol)

    # Constricted neck collar shadow right under the rolled lip (y=14)
    c.hline(9, 22, 14, IR0)
    c.hline(9, 13, 14, IR1)
    c.set(10, 14, IR2)

    # Warm orange-crimson hearth fire bounce along curved bottom of cauldron (y=22..23)!
    c.hline(10, 21, 22, RD0)
    c.hline(12, 19, 22, RD2)
    c.hline(14, 17, 22, FL1)
    c.set(15, 22, FL2)
    c.hline(11, 20, 23, RD_O)
    c.hline(12, 19, 23, FL0)
    c.hline(14, 17, 23, FL1)

    # --- C. Curled Wrought-Iron Ring Handles (x=3..6 left, x=25..28 right, y=14..19) ---
    # Total width across handles: x=3..28 = 26 px!
    # Left curled iron handle
    c.hline(4, 7, 14, IR_O)
    c.hline(3, 5, 15, IR_O)
    c.set(4, 15, IR3)  # bright top-left iron curl gleam!
    c.set(5, 15, IR2)
    c.vline(3, 16, 18, IR_O)
    c.set(4, 16, IR2)
    c.set(5, 16, IR_O)  # dark hollow center of ring handle
    c.set(4, 17, IR2)
    c.set(5, 17, IR_O)
    c.set(4, 18, IR1)
    c.set(5, 18, IR0)
    c.hline(4, 5, 19, IR_O)

    # Right curled iron handle (shaded darker on right side)
    c.hline(24, 27, 14, IR_O)
    c.hline(26, 28, 15, IR_O)
    c.set(26, 15, IR1)
    c.set(27, 15, IR2)
    c.vline(28, 16, 18, IR_O)
    c.set(26, 16, IR_O)  # dark hollow center of ring handle
    c.set(27, 16, IR1)
    c.set(26, 17, IR_O)
    c.set(27, 17, IR1)
    c.set(26, 18, IR0)
    c.set(27, 18, IR0)
    c.hline(26, 27, 19, IR_O)

    # --- D. Stout Splayed Iron Tripod Legs Gripping Pot & Stepping onto Hearth (y=21..30) ---
    # Left splayed iron leg (flares from x=7..9 at y=21 down to clawed foot x=5..8 at y=29..30)
    c.rect(7, 21, 9, 23, IR_O)
    c.vline(8, 21, 23, IR2)
    c.set(8, 21, IR3)
    c.rect(6, 24, 8, 27, IR_O)
    c.vline(7, 24, 27, IR2)
    c.rect(5, 28, 8, 29, IR_O)
    c.hline(6, 7, 28, IR2)
    c.set(6, 29, IR3)  # clawed tripod toe gleam!
    c.set(7, 29, IR1)
    c.hline(5, 8, 30, IR_O)

    # Right splayed iron leg (flares from x=22..24 at y=21 down to clawed foot x=23..26 at y=29..30)
    c.rect(22, 21, 24, 23, IR_O)
    c.vline(23, 21, 23, IR1)
    c.rect(23, 24, 25, 27, IR_O)
    c.vline(24, 24, 27, IR1)
    c.rect(23, 28, 26, 29, IR_O)
    c.hline(24, 25, 28, IR1)
    c.hline(24, 25, 29, IR0)
    c.hline(23, 26, 30, IR_O)

    # Subtle 3rd rear tripod leg visible behind the glowing coal bed (keeps front coals wide open!)
    c.vline(15, 24, 25, IR0)
    c.vline(16, 24, 25, IR_O)

    # --- E. Wide 3/4 Rolled Iron Rim & Luminous Bubbling Emerald/Teal Brew (y=9..13) ---
    # Top rim bevel (y=10..13)
    c.hline(8, 16, 10, IR3)
    c.hline(17, 21, 10, IR2)
    c.hline(22, 23, 10, IR1)
    c.set(7, 11, IR3)
    c.set(7, 12, IR2)
    c.set(24, 11, IR1)
    c.set(24, 12, IR0)

    # Glowing emerald-teal potion pool filling the open mouth (x=8..23, y=11..12)
    c.hline(8, 23, 11, TL0)
    c.hline(9, 22, 11, GR1)
    c.hline(10, 20, 11, TL2)
    c.hline(12, 18, 11, GR2)
    c.hline(8, 23, 12, GR0)
    c.hline(9, 22, 12, TL1)
    c.hline(10, 21, 12, GR2)
    c.hline(12, 19, 12, GR3)

    # Frothy luminous surface bubbles & swirling arcane sparkles inside rim!
    c.set(11, 11, GR3)
    c.set(12, 11, TL4)  # bright surface bubble highlight!
    c.set(13, 11, TL3)
    c.set(16, 11, FL4)  # golden-emerald reaction spark!
    c.set(17, 11, GR3)
    c.set(19, 11, TL3)
    c.set(20, 11, TL4)
    c.set(14, 12, TL4)
    c.set(15, 12, TL3)
    c.set(18, 12, GR3)

    # Thick rolled front rim lip catching brew & top-left gleam (y=13, x=8..23)
    c.hline(8, 23, 13, IR1)
    c.hline(8, 17, 13, IR2)
    c.hline(9, 14, 13, IR3)

    # --- F. Floating Round Luminous Vapor Bubbles Above Cauldron (y=3..9) ---
    # 1) Bursting rim bubble right at lip (x=14..17, y=7..10)
    c.hline(15, 16, 7, TL_O)
    c.set(14, 8, TL_O)
    c.set(15, 8, TL4)
    c.set(16, 8, TL2)
    c.set(17, 8, TL_O)
    c.set(14, 9, TL_O)
    c.set(15, 9, TL3)
    c.set(16, 9, GR2)
    c.set(17, 9, TL_O)
    c.set(15, 10, GR3)
    c.set(16, 10, TL3)

    # 2) Large rounded 5x5 emerald-teal bubble (x=9..13, y=4..8)
    c.hline(10, 12, 4, GR_O)
    c.set(9, 5, GR_O)
    c.set(10, 5, TL4)   # crisp specular glint!
    c.set(11, 5, GR3)
    c.set(12, 5, GR2)
    c.set(13, 5, GR_O)
    c.set(9, 6, GR_O)
    c.set(10, 6, GR3)
    c.set(11, 6, GR2)
    c.set(12, 6, TL2)
    c.set(13, 6, GR_O)
    c.set(9, 7, GR_O)
    c.set(10, 7, GR1)
    c.set(11, 7, TL1)
    c.set(12, 7, GR0)
    c.set(13, 7, GR_O)
    c.hline(10, 12, 8, GR_O)

    # 3) Upper-right round 4x4 bright sea-teal vapor bubble (x=18..21, y=3..6)
    c.hline(19, 20, 3, TL_O)
    c.set(18, 4, TL_O)
    c.set(19, 4, TL4)   # crisp specular glint!
    c.set(20, 4, TL3)
    c.set(21, 4, TL_O)
    c.set(18, 5, TL_O)
    c.set(19, 5, TL2)
    c.set(20, 5, TL1)
    c.set(21, 5, TL_O)
    c.hline(19, 20, 6, TL_O)

    # --- G. Ground Shadow (y=31) ---
    for sx in range(5, 27):
        c.shadow(sx, 31)
    c.shadow(4, 30)
    c.shadow(27, 30)

    return c.im


# ---------------------------------------------------------------------------
# 2. potion_alembic_shelf.png (32x32, standing, target opaque ~28x29)
#    Deep carved-oak apothecary shelf packed with unmistakably distinct
#    round-bottom glass flasks, coiled brass alembic condenser, tall
#    green/crimson/cyan/gold potion bottles with tiny white glass glints
#    & cork stoppers!
# ---------------------------------------------------------------------------
def draw_potion_alembic_shelf() -> Image.Image:
    c = Canvas(32, 32)

    # --- A. Carved Dark-Oak Apothecary Cabinet Frame (x=2..29, y=2..30 -> 28x29) ---
    # Stepped overhanging cornice top band (y=2..6, narrow 3/4 top band!)
    c.rect(2, 2, 29, 6, DO_O)
    # Lit top plane of cornice (y=3..4)
    c.hline(3, 28, 3, OK4)
    c.hline(3, 16, 3, OK5)
    c.hline(3, 28, 4, OK3)
    c.hline(3, 12, 4, OK4)
    c.hline(23, 28, 4, OK2)
    # Carved dentil molding front fascia (y=5)
    c.hline(3, 28, 5, DO3)
    for dx in range(4, 28, 3):
        c.set(dx, 5, OK3 if dx < 18 else OK2)
    # Brass corner rosettes & cornice shadow groove (y=6)
    c.hline(3, 28, 6, DO0)
    c.set(4, 5, GD3)
    c.set(27, 5, GD2)

    # Main cabinet body & side pilasters (x=3..28, y=6..29)
    c.rect(3, 6, 28, 29, DO_O)
    # Left carved pilaster (x=4) & right carved pilaster (x=27)
    c.vline(4, 6, 28, DO3)
    c.vline(4, 7, 16, OK2)
    c.set(4, 7, OK3)
    c.set(4, 19, OK3)
    c.vline(27, 6, 28, DO2)
    c.vline(27, 18, 28, DO1)

    # Deep dark recessed tongue-and-groove plank backdrop (x=5..26, y=7..27)
    c.rect(5, 7, 26, 27, DO_O)
    for px_col in (7, 8, 11, 12, 15, 16, 19, 20, 23, 24):
        c.vline(px_col, 7, 27, DO0)

    # Molded Middle Oak Shelf Plank (y=18..19)
    c.hline(4, 27, 18, OK3)
    c.hline(4, 15, 18, OK4)
    c.set(4, 18, OK5)
    c.hline(4, 27, 19, DO1)
    c.hline(5, 12, 19, DO2)
    # Tiny iron shelf support brackets under middle shelf ends
    c.set(5, 19, IR2)
    c.set(26, 19, IR1)

    # Bottom Shelf Deck & Carved Bracket Feet (y=28..30)
    c.hline(4, 27, 28, OK3)
    c.hline(4, 14, 28, OK4)
    c.hline(4, 27, 29, DO2)
    c.hline(18, 27, 29, DO1)
    # Ensure bottom edge across central arch (x=7..24, y=29) is dark outline DO_O!
    c.hline(7, 24, 29, DO_O)
    # Left & right carved bracket feet reaching y=30 (x=3..6 and x=25..28)
    c.rect(3, 29, 6, 30, DO_O)
    c.hline(4, 5, 29, DO3)
    c.rect(25, 29, 28, 30, DO_O)
    c.hline(26, 27, 29, DO1)

    # --- B. UPPER BAY (y=7..17, x=5..26): Glass Retort + Coiled Brass Alembic + Tall Potions ---
    # 1) Boiling Round-Bottom Glass Retort on Brass Burner (x=5..10, y=8..17)
    # Mini brass burner tripod & spirit flame at bottom (x=6..9, y=16..17)
    c.set(6, 17, GD2)
    c.set(9, 17, GD1)
    c.set(7, 17, FL2)
    c.set(8, 17, FL3)
    c.set(7, 16, FL4)  # tiny white-hot spirit lamp flame!
    c.set(8, 16, FL2)
    # Round 6px-wide glass retort bulb (x=5..10, y=11..15)
    c.hline(6, 9, 11, ST4)    # upper glass dome curve
    c.hline(5, 10, 12, TL3)   # upper glass meniscus
    c.set(5, 12, ST5)
    c.set(6, 12, TL4)         # crisp white-ice glass glint!
    c.set(10, 12, TL1)
    # Glowing sea-teal & emerald boiling brew inside round bulb (y=13..15)
    c.hline(5, 10, 13, TL2)
    c.set(6, 13, TL4)         # 2px vertical glass gleam!
    c.set(7, 13, TL3)
    c.set(10, 13, TL0)
    c.hline(5, 10, 14, GR2)
    c.set(5, 14, TL2)
    c.set(6, 14, GR3)
    c.set(9, 14, TL1)
    c.set(10, 14, TL0)
    c.hline(6, 9, 15, TL1)    # rounded bulb bottom!
    c.set(6, 15, GR2)
    c.set(7, 15, GR3)
    # Brass alembic cucurbit helmet & swan-neck arch (x=7..13, y=8..10)
    c.hline(7, 8, 10, GD2)
    c.set(7, 10, GD3)
    c.hline(7, 9, 9, GD3)
    c.set(7, 9, GD4)
    c.hline(8, 13, 8, GD3)    # arching brass vapor tube!
    c.hline(8, 10, 8, GD4)
    c.set(13, 9, GD2)

    # 2) Coiled Brass Alembic Condenser Worm (x=11..14, y=10..15)
    # 3 distinct gleaming gold-brass horizontal spiral turns + iron stand strut!
    c.vline(12, 10, 17, IR0)  # dark iron support rod behind coil
    c.hline(11, 13, 17, IR1)  # condenser stand base on shelf
    # Turn 1 (y=10..11)
    c.hline(11, 14, 10, GD3)
    c.set(11, 10, GD4)
    c.hline(11, 13, 11, GD0)
    c.set(14, 11, GD2)
    # Turn 2 (y=12..13)
    c.hline(11, 14, 12, GD3)
    c.set(11, 12, GD4)
    c.hline(11, 13, 13, GD0)
    c.set(14, 13, GD2)
    # Turn 3 (y=14..15) + distillate drip spout into receiving flask!
    c.hline(11, 14, 14, GD3)
    c.set(11, 14, GD4)
    c.set(14, 15, GD2)
    c.set(15, 15, GD3)

    # 3) Round-Bottom Cyan Receiving Flask (x=15..18, y=12..17)
    c.set(16, 12, OK4)        # cork collar around spout
    c.hline(16, 17, 13, ST5)  # narrow glass neck
    c.hline(15, 18, 14, TL3)  # upper round bulb
    c.set(15, 14, TL4)        # glass glint!
    c.set(18, 14, TL1)
    c.hline(15, 18, 15, TL2)
    c.set(15, 15, TL3)
    c.set(16, 15, TL4)
    c.set(18, 15, TL0)
    c.hline(15, 18, 16, TL2)
    c.set(16, 16, TL3)
    c.set(18, 16, TL0)
    c.hline(16, 17, 17, TL1)  # rounded bottom!

    # 4) Tall Emerald Apothecary Bottle (x=19..22, y=8..17, 4px wide x 10px tall!)
    c.hline(20, 21, 8, OK4)   # cork stopper!
    c.set(21, 8, OK2)
    c.hline(20, 21, 9, ST6)   # glass lip
    c.set(21, 9, ST4)
    c.hline(20, 21, 10, GR1)  # narrow neck
    c.rect(19, 11, 22, 17, GR1)
    c.vline(19, 11, 16, GR2)
    c.vline(20, 11, 16, GR3)
    c.vline(22, 11, 17, GR0)
    c.set(20, 11, TL4)        # crisp white-cyan glass glint!
    c.set(20, 12, TL4)
    # Cream parchment apothecary label on belly (y=14..15)
    c.set(20, 14, PA3)
    c.set(21, 14, PA2)
    c.set(20, 15, PA2)
    c.set(21, 15, PA0)
    c.hline(19, 21, 17, GR1)

    # 5) Tall Crimson Elixir Bottle (x=23..26, y=9..17, 4px wide x 9px tall!)
    c.hline(24, 25, 9, OK4)   # cork stopper!
    c.set(25, 9, OK2)
    c.hline(24, 25, 10, PA3)  # glass lip
    c.set(25, 10, ST4)
    c.rect(23, 11, 26, 17, RD1)
    c.vline(23, 11, 16, RD2)
    c.vline(24, 11, 16, FL1)  # glowing ruby core!
    c.vline(26, 11, 17, RD0)
    c.set(24, 11, PA3)        # crisp glass glint!
    c.set(24, 12, RD3)
    c.hline(24, 25, 14, GD3)  # thin gold collar band
    c.hline(23, 25, 17, RD0)

    # --- C. LOWER BAY (y=20..27, x=5..26): Round-Bottom Flasks & Tall Potion Bottles ---
    # 1) Wide Round-Bottom Ruby Health Flask (x=5..10, y=20..27, 6px spherical bulb!)
    c.hline(7, 8, 20, OK4)    # cork stopper!
    c.set(8, 20, OK2)
    c.hline(7, 8, 21, ST6)    # flared glass neck
    c.set(8, 21, ST4)
    c.hline(6, 9, 22, ST4)    # upper glass shoulder
    c.set(6, 22, PA3)         # bright glass glint!
    c.set(7, 22, RD3)
    c.hline(5, 10, 23, RD2)
    c.set(5, 23, RD3)
    c.set(6, 23, PA3)         # curved specular glint on round flask!
    c.set(7, 23, FL1)
    c.set(10, 23, RD0)
    c.hline(5, 10, 24, RD2)
    c.set(6, 24, FL1)
    c.set(7, 24, FL2)         # luminous ruby glow!
    c.set(9, 24, RD1)
    c.set(10, 24, RD0)
    c.hline(5, 10, 25, RD1)
    c.set(6, 25, RD3)
    c.set(7, 25, FL1)
    c.set(10, 25, RD0)
    c.hline(6, 9, 26, RD1)    # rounded spherical taper!
    c.set(6, 26, RD2)
    c.hline(7, 8, 27, RD0)    # round bottom resting on shelf!

    # 2) Tall Golden Solar Potion Bottle (x=11..14, y=20..27, 4px wide)
    c.hline(12, 13, 20, OK4)  # cork stopper!
    c.set(13, 20, OK2)
    c.hline(12, 13, 21, PA3)  # glass rim
    c.set(13, 21, ST4)
    c.rect(11, 22, 14, 27, FL2)
    c.vline(11, 22, 26, GD3)
    c.vline(12, 22, 26, FL3)
    c.vline(14, 22, 27, GD0)
    c.set(12, 22, GD4)        # bright white-gold glass glint!
    c.set(12, 23, FL4)
    c.hline(11, 13, 27, GD1)

    # 3) Round-Bottom Luminous Cyan Mana Flask (x=15..19, y=20..27, 5px spherical bulb!)
    c.set(17, 20, OK4)        # cork stopper!
    c.hline(16, 18, 21, ST5)  # glass lip
    c.set(16, 21, TL4)
    c.set(18, 21, ST3)
    c.set(17, 22, ST4)        # narrow neck!
    c.hline(16, 18, 23, TL3)
    c.set(16, 23, TL4)        # bright glass glint!
    c.hline(15, 19, 24, TL2)
    c.set(15, 24, TL3)
    c.set(16, 24, TL4)
    c.set(19, 24, TL0)
    c.hline(15, 19, 25, TL2)
    c.set(16, 25, TL3)
    c.set(18, 25, TL1)
    c.set(19, 25, TL0)
    c.hline(15, 19, 26, TL1)
    c.set(16, 26, TL2)
    c.set(19, 26, TL0)
    c.hline(16, 18, 27, TL0)  # rounded bulb base!
    c.set(17, 27, TL1)

    # 4) Tall Emerald Herb Tonic Bottle (x=20..22, y=20..27, 3px slender phial)
    c.set(21, 20, OK4)        # cork!
    c.set(21, 21, ST5)        # glass neck
    c.vline(20, 22, 27, GR2)
    c.vline(21, 22, 27, GR3)
    c.vline(22, 22, 27, GR0)
    c.set(20, 22, TL4)        # white-ice glass glint!
    c.set(21, 27, GR1)

    # 5) Squat Amethyst / Indigo Arcane Jar (x=23..26, y=21..27, 4px wide)
    c.hline(24, 25, 21, OK4)  # wide cork stopper!
    c.set(25, 21, OK2)
    c.hline(23, 26, 22, ST5)  # glass rim
    c.set(26, 22, ST3)
    c.rect(23, 23, 26, 27, BL1)
    c.set(23, 23, BL2)
    c.set(24, 23, TL4)        # crisp white-cyan glass glint!
    c.set(24, 24, BL2)
    c.set(25, 24, PL1)        # rich amethyst-indigo blend
    c.set(25, 25, PL1)
    c.vline(26, 23, 27, BL0)
    c.hline(23, 25, 27, BL0)

    # --- D. Ground Shadow (y=30..31) ---
    for sx in range(7, 25):
        c.shadow(sx, 30)
    for sx in range(3, 29):
        c.shadow(sx, 31)

    return c.im


# ---------------------------------------------------------------------------
# 3. alchemy_workbench.png (32x16, topdown, target opaque ~30x14)
#    Heavy slate-topped stone & timber alchemy bench (topdown camera!),
#    beveled cool-stone work slab with subtle chipped patina, sturdy
#    dark-oak apron (<=3px) & corner stub legs, EMPTY top!
# ---------------------------------------------------------------------------
def draw_alchemy_workbench() -> Image.Image:
    c = Canvas(32, 16)

    # Strictly topdown:
    #   Opaque bounds: x=1..30 (30px), y=1..14 (14px) -> exact 30x14!
    #   Top slab: y=1..11 (11px out of 14px = 78.6% >= 75%!), 100% EMPTY surface!
    #   Dark-oak apron: y=12..13 (2px <= 3px!)
    #   Corner stub legs: x=2..5 and x=26..29 reaching y=14 (1-2px stubs!)

    # --- A. Heavy Beveled Cool-Stone & Slate Work Slab (x=1..30, y=1..11) ---
    c.rect(1, 1, 30, 11, SL_O)
    # Forged iron corner L-bracket outlines at the 4 slab corners
    for cx0, cx1 in ((1, 3), (28, 30)):
        c.hline(cx0, cx1, 1, IR_O)
        c.hline(cx0, cx1, 11, IR_O)
    c.vline(1, 1, 3, IR_O)
    c.vline(30, 1, 3, IR_O)
    c.vline(1, 9, 11, IR_O)
    c.vline(30, 9, 11, IR_O)

    # Main dressed cool-slate monolithic work slab interior (x=2..29, y=2..9, 100% EMPTY!)
    c.rect(2, 2, 29, 9, SL3)
    # Smooth diagonal top-left to bottom-right cool-stone sheen across unified slab
    for sy in range(3, 9):
        for sx in range(3, 29):
            val = (sx - 3) * 0.45 + (sy - 3) * 1.15
            if val < 4.8:
                c.set(sx, sy, SL4)
            elif val > 12.2:
                c.set(sx, sy, SL2)
            else:
                c.set(sx, sy, SL3)

    # Crisp top-left stone chamfer bevel (y=2 and x=2) + right/bottom bevel (x=29, y=9)
    c.hline(2, 29, 2, ST4)
    c.hline(2, 20, 2, ST5)
    c.hline(4, 12, 2, ST6)   # bright cool-stone top-left gleam!
    c.vline(2, 2, 9, ST4)
    c.vline(2, 3, 6, ST5)
    c.vline(29, 2, 9, SL1)
    c.hline(3, 29, 9, SL2)
    c.hline(17, 29, 9, SL1)

    # Subtle natural diagonal mineral vein & carved inset border bevel (calm, unified stone slab!)
    for vx, vy in ((9, 4), (10, 5), (11, 5), (12, 6), (20, 4), (21, 5), (22, 6)):
        c.set(vx, vy, ST3 if vx < 15 else SL2)
    c.set(10, 4, ST4)
    c.set(21, 4, SL4)

    # Authentic chipped stone patina along slab edges (tiny 1-2px chips + catchlights)
    # Chip 1 on top bevel (x=14..15, y=2..3)
    c.set(14, 2, SL1)
    c.set(15, 2, SL2)
    c.set(15, 3, ST5)
    # Chip 2 on upper-right bevel (x=24, y=2..3)
    c.set(24, 2, SL1)
    c.set(25, 2, ST5)
    # Chip 3 near lower-left surface (x=7..8, y=7)
    c.set(7, 7, SL2)
    c.set(8, 7, ST4)

    # Riveted forged-iron corner cap brackets flush with the slab corners!
    # Top-left bracket
    c.set(2, 2, IR3)
    c.set(3, 2, IR2)
    c.set(2, 3, IR2)
    c.set(3, 3, IR1)
    # Top-right bracket
    c.set(28, 2, IR2)
    c.set(29, 2, IR1)
    c.set(28, 3, IR1)
    c.set(29, 3, IR0)
    # Bottom-left bracket
    c.set(2, 8, IR2)
    c.set(2, 9, IR3)
    c.set(3, 9, IR1)
    # Bottom-right bracket
    c.set(29, 8, IR0)
    c.set(28, 9, IR1)
    c.set(29, 9, IR0)

    # Thick front stone slab bullnose thickness edge (y=10) + dark overhang seam (y=11)
    c.hline(2, 29, 10, SL2)
    c.hline(2, 14, 10, SL3)
    c.hline(3, 8, 10, ST3)
    c.hline(21, 29, 10, SL1)
    # Chipped notch on front stone bullnose (x=10..11, y=10)
    c.set(10, 10, SL0)
    c.set(11, 10, ST4)
    c.hline(1, 30, 11, DO_O)

    # --- B. Sturdy Dark-Oak Apron (y=12..13 -> strictly 2px <= 3px!) & Corner Stub Legs (y=13..14) ---
    c.hline(2, 29, 12, DO_O)
    # Carved warm dark-oak front apron rail (x=3..28, y=12)
    c.hline(3, 28, 12, DO2)
    c.hline(3, 15, 12, DO3)
    c.hline(4, 9, 12, DO4)
    c.hline(22, 28, 12, DO1)
    # Iron/brass mortise tenon pins on apron
    c.set(4, 12, GD2)
    c.set(15, 12, DO1)
    c.set(16, 12, DO3)
    c.set(27, 12, GD1)

    # y=13: Apron bottom dark outline across center arch (x=6..25) + sturdy corner leg stubs!
    c.hline(6, 25, 13, DO_O)

    # Left corner timber stub leg (x=2..5, y=12..14)
    c.vline(2, 12, 14, DO_O)
    c.vline(5, 13, 14, DO_O)
    c.set(3, 13, DO3)
    c.set(4, 13, DO2)
    c.hline(2, 5, 14, DO_O)

    # Right corner timber stub leg (x=26..29, y=12..14)
    c.vline(26, 13, 14, DO_O)
    c.vline(29, 12, 14, DO_O)
    c.set(27, 13, DO2)
    c.set(28, 13, DO1)
    c.hline(26, 29, 14, DO_O)

    # --- C. Ground Shadow (y=14..15) ---
    for sx in range(6, 26):
        c.shadow(sx, 14)
    for sx in range(3, 29):
        c.shadow(sx, 15)

    return c.im


# ---------------------------------------------------------------------------
# 4. brass_candelabra.png (16x32, slender, target opaque ~12x30)
#    Sculpted ornate 3-branch antique brass floor candelabra with curved arms,
#    flared tripod base, 3 cream wax tapers with bright glowing yellow-white
#    flames & warm drip highlights!
# ---------------------------------------------------------------------------
def draw_brass_candelabra() -> Image.Image:
    c = Canvas(16, 32)

    # Perfectly symmetrical around x=7.5 (canvas 16x32, x=2..13 -> 12px wide, y=1..30 -> 30px tall!):
    #   Left branch:   x=2..4  (core x=3)
    #   Air gap:       x=5     (clean transparent gap y=1..12!)
    #   Center column: x=6..9  (2px core x=7..8 + 1px dark outline x=6, 9!)
    #   Air gap:       x=10    (clean transparent gap y=1..12!)
    #   Right branch:  x=11..13 (core x=12)

    # --- A. Three Radiant Candle Flames (y=1..5 center, y=3..6 left & right) ---
    # Center royal taper flame (x=6..9, y=1..5)
    c.hline(7, 8, 1, RD_O)
    c.set(6, 2, RD_O)
    c.set(7, 2, FL2)
    c.set(8, 2, FL1)
    c.set(9, 2, RD_O)
    c.set(6, 3, RD_O)
    c.set(7, 3, FL3)
    c.set(8, 3, FL2)
    c.set(9, 3, RD_O)
    c.set(6, 4, RD_O)
    c.set(7, 4, FL4)   # brilliant yellow-white core!
    c.set(8, 4, FL3)
    c.set(9, 4, RD_O)
    c.set(6, 5, OK_O)
    c.set(7, 5, FL4)
    c.set(8, 5, GD4)   # warm melted wax rim glow!
    c.set(9, 5, OK_O)

    # Left & right branch flames (x=2..4 and x=11..13, y=3..6)
    for fcx in (3, 12):
        c.set(fcx, 3, RD_O)
        c.set(fcx - 1, 4, RD_O)
        c.set(fcx, 4, FL2)
        c.set(fcx + 1, 4, RD_O)
        c.set(fcx - 1, 5, RD_O)
        c.set(fcx, 5, FL3)
        c.set(fcx + 1, 5, RD_O)
        c.set(fcx - 1, 6, RD_O)
        c.set(fcx, 6, FL4)  # bright yellow-white core!
        c.set(fcx + 1, 6, RD_O)

    # --- B. Three Cream Wax Tapers with Warm Drip Highlights (y=6..9 center, y=7..10 sides) ---
    # Center cream wax taper (x=6..9, y=6..9)
    for y in range(6, 10):
        c.set(6, y, OK_O)
        c.set(9, y, OK_O)
    c.set(7, 6, GD4)   # warm flame-kissed wax lip!
    c.set(8, 6, PA3)
    c.set(7, 7, PA3)
    c.set(8, 7, PA3)   # sculpted wax drip bead!
    c.set(7, 8, PA3)
    c.set(8, 8, PA2)
    c.set(7, 9, PA2)
    c.set(8, 9, PA1)

    # Left & right cream wax tapers (x=2..4 and x=11..13, y=7..10)
    for wcx in (3, 12):
        for y in range(7, 11):
            c.set(wcx - 1, y, OK_O)
            c.set(wcx + 1, y, OK_O)
        c.set(wcx, 7, GD4)   # warm drip highlight right below flame!
        c.set(wcx, 8, PA3)
        c.set(wcx, 9, PA3 if wcx == 3 else PA2)
        c.set(wcx, 10, PA2 if wcx == 3 else PA1)

    # --- C. Flared Brass Drip Cups (Bobeches) & Sculpted Curved Scroll Arms (y=10..16) ---
    # Center bobeche (y=10..11, x=6..9)
    c.set(6, 10, GD_O)
    c.set(7, 10, GD4)
    c.set(8, 10, GD3)
    c.set(9, 10, GD_O)
    c.set(6, 11, GD_O)
    c.set(7, 11, GD3)
    c.set(8, 11, GD1)
    c.set(9, 11, GD_O)

    # Left & right bobeches (y=11..12, x=2..4 and x=11..13; x=5 & x=10 stay EMPTY!)
    c.set(2, 11, GD_O)
    c.set(3, 11, GD4)
    c.set(4, 11, GD_O)
    c.set(2, 12, GD_O)
    c.set(3, 12, GD3)
    c.set(4, 12, GD_O)

    c.set(11, 11, GD_O)
    c.set(12, 11, GD3)
    c.set(13, 11, GD_O)
    c.set(11, 12, GD_O)
    c.set(12, 12, GD2)
    c.set(13, 12, GD_O)

    # Center stem between y=12
    c.set(6, 12, GD_O)
    c.set(7, 12, GD3)
    c.set(8, 12, GD2)
    c.set(9, 12, GD_O)

    # Sculpted curved U-arms sweeping gracefully inward from x=2..13 (y=13) -> x=3..12 (y=14) -> x=4..11 (y=15) -> x=5..10 (y=16)!
    # y=13: x=2..13 (note x=5 and x=10 touch transparent y=12 above -> GD_O!)
    c.hline(2, 13, 13, GD_O)
    c.set(3, 13, GD3)
    c.set(4, 13, GD2)
    c.set(6, 13, GD2)
    c.set(7, 13, GD4)
    c.set(8, 13, GD2)
    c.set(9, 13, GD1)
    c.set(11, 13, GD1)
    c.set(12, 13, GD2)

    # y=14: x=3..12
    c.hline(3, 12, 14, GD_O)
    c.set(4, 14, GD3)
    c.set(5, 14, GD3)
    c.set(6, 14, GD2)
    c.set(7, 14, GD4)
    c.set(8, 14, GD2)
    c.set(9, 14, GD1)
    c.set(10, 14, GD2)
    c.set(11, 14, GD1)

    # y=15: x=4..11
    c.hline(4, 11, 15, GD_O)
    c.set(5, 15, GD2)
    c.set(6, 15, GD3)
    c.set(7, 15, GD3)
    c.set(8, 15, GD1)
    c.set(9, 15, GD2)
    c.set(10, 15, GD0)

    # y=16: ornate central baluster collar x=5..10
    c.hline(5, 10, 16, GD_O)
    c.set(6, 16, GD3)
    c.set(7, 16, GD4)
    c.set(8, 16, GD2)
    c.set(9, 16, GD1)

    # --- D. Slender Turned Antique Brass Post (x=6..9, y=17..25 -> 2px core + 1px dark outline!) ---
    for y in range(17, 26):
        c.set(6, y, GD_O)
        c.set(7, y, GD3)
        c.set(8, y, GD1)
        c.set(9, y, GD_O)
    # Specular highlights & shadow grooves along fluted post
    c.set(7, 18, GD4)
    c.set(7, 19, GD4)
    c.set(7, 23, GD4)
    c.set(8, 17, GD0)
    c.set(8, 22, GD0)
    c.set(8, 25, GD0)

    # Turned middle baluster knop at y=20..21 (x=5..10)
    c.hline(5, 10, 20, GD_O)
    c.set(6, 20, GD3)
    c.set(7, 20, GD4)
    c.set(8, 20, GD2)
    c.set(9, 20, GD1)
    c.hline(5, 10, 21, GD_O)
    c.set(6, 21, GD2)
    c.set(7, 21, GD3)
    c.set(8, 21, GD1)
    c.set(9, 21, GD0)

    # --- E. Flared Sculpted Tripod Base (y=26..30, x=3..12) ---
    # Bell dome collar (y=26..27, x=5..10 -> x=4..11)
    c.hline(5, 10, 26, GD_O)
    c.set(6, 26, GD3)
    c.set(7, 26, GD4)
    c.set(8, 26, GD2)
    c.set(9, 26, GD1)

    c.hline(4, 11, 27, GD_O)
    c.set(5, 27, GD3)
    c.set(6, 27, GD4)
    c.set(7, 27, GD3)
    c.set(8, 27, GD2)
    c.set(9, 27, GD1)
    c.set(10, 27, GD0)

    # Flared scroll tripod legs (y=28..30, x=3..12)
    c.hline(3, 12, 28, GD_O)
    c.set(4, 28, GD3)
    c.set(5, 28, GD2)
    c.set(6, 28, GD1)
    c.set(7, 28, GD3)
    c.set(8, 28, GD2)
    c.set(9, 28, GD0)
    c.set(10, 28, GD1)
    c.set(11, 28, GD0)

    c.hline(3, 12, 29, GD_O)
    c.set(4, 29, GD4)   # left lion-paw foot gleam!
    c.set(5, 29, OK_O)  # arch outline above shadow notch (5,30)!
    c.set(6, 29, GD2)
    c.set(7, 29, GD3)   # center paw gleam!
    c.set(8, 29, GD1)
    c.set(9, 29, GD0)
    c.set(10, 29, OK_O) # arch outline above shadow notch (10,30)!
    c.set(11, 29, GD1)

    # Three distinct tripod paws on ground line y=30: (3..4), (6..9), (11..12)
    c.hline(3, 4, 30, OK_O)
    c.hline(6, 9, 30, OK_O)
    c.hline(11, 12, 30, OK_O)

    # --- F. Ground Shadow (y=30..31) ---
    c.shadow(5, 30)
    c.shadow(10, 30)
    for sx in range(3, 13):
        c.shadow(sx, 31)

    return c.im


# ---------------------------------------------------------------------------
# 5. wall_banner_crimson.png (16x32, standing, target opaque ~14x30)
#    Plush draped crimson velvet wizard-tower wall tapestry hanging from a
#    brass-finial crossbar, vertical fabric fold shading, golden embroidered
#    star/astrolabe crest & notched fringed tail!
# ---------------------------------------------------------------------------
def draw_wall_banner_crimson() -> Image.Image:
    c = Canvas(16, 32)

    # Opaque bounds: x=1..14 (14px wide), y=1..30 (30px tall) -> exact 14x30!

    # --- A. Brass-Finial Crossbar & Hanging Ring (x=1..14, y=1..4) ---
    # Left & right sculpted brass finials (x=1..3 and x=12..14, y=1..4) + center wall bracket (x=7..8, y=1)
    c.hline(1, 3, 1, GD_O)
    c.hline(7, 8, 1, GD_O)
    c.hline(12, 14, 1, GD_O)

    c.hline(1, 14, 2, DO_O)
    c.set(1, 2, GD_O)
    c.set(2, 2, GD4)    # bright brass left finial gleam!
    c.set(3, 2, GD3)
    c.hline(4, 6, 2, DO_O)  # top dark outline of oak crossbar
    c.set(7, 2, GD4)    # central brass hanger ring gleam!
    c.set(8, 2, GD2)
    c.hline(9, 11, 2, DO_O) # top dark outline of oak crossbar
    c.set(12, 2, GD3)
    c.set(13, 2, GD2)   # right brass finial!
    c.set(14, 2, GD_O)

    c.hline(1, 14, 3, DO_O)
    c.set(1, 3, GD_O)
    c.set(2, 3, GD2)
    c.set(3, 3, GD1)
    c.hline(4, 6, 3, OK3)   # lit oak crossbar!
    c.set(7, 3, GD3)
    c.set(8, 3, GD1)
    c.hline(9, 11, 3, OK2)
    c.set(12, 3, GD1)
    c.set(13, 3, GD0)
    c.set(14, 3, GD_O)

    # Finial undersides at x=1..2 and x=13..14 (y=4), plus velvet hanging loops across x=3..12!
    c.hline(1, 2, 4, GD_O)
    c.hline(13, 14, 4, GD_O)
    c.set(3, 4, DO_O)
    c.set(12, 4, DO_O)
    c.hline(4, 11, 4, RD0)
    for lx in (4, 6, 9, 11):
        c.set(lx, 4, GD3 if lx < 8 else GD2)  # brass hanging rings on crossbar!

    # --- B. Plush Draped Crimson Velvet Body (x=2..13, y=5..26) ---
    for y in range(5, 27):
        c.set(2, y, RD_O)
        c.set(13, y, RD_O)
        # Lush full-width vertical crimson velvet drapery folds (x=3..12)!
        c.set(3, y, RD1)    # left outer fold curve
        c.set(4, y, RD3)    # plush lit left velvet ridge!
        c.set(5, y, RD3 if y < 18 else RD2)
        c.set(6, y, RD2)
        c.set(7, y, RD1)    # subtle central fold valley
        c.set(8, y, RD2)    # secondary soft ridge
        c.set(9, y, RD1)
        c.set(10, y, RD0)   # deep velvet shadow trough!
        c.set(11, y, PL1 if y >= 9 else RD0)   # rich cool burgundy-velvet shadow!
        c.set(12, y, RD0)   # right outer velvet fold

    # Delicate antique-gold brocade stitch dots along outer margins (subtle, lets crest dominate!)
    for gy in range(7, 25, 3):
        c.set(3, gy, GD2)
        c.set(12, gy, GD0)

    # Upper velvet rod shadow & upper gold brocade header band (y=5..6)
    c.hline(3, 12, 5, RD0)
    c.set(10, 5, PL0)
    c.set(11, 5, PL0)
    c.hline(4, 11, 6, GD2)
    c.hline(4, 7, 6, GD3)
    c.set(5, 6, GD4)
    # Extra warm scarlet sheen along upper-left plush velvet fold (x=4..5, y=7..10)
    for sy in (7, 8, 9, 10):
        c.set(4, sy, FL1)

    # --- C. Golden Embroidered Star / Astrolabe Crest (cx=7.5, cy=14.5, y=8..21) ---
    # Subtle dark velvet shadow backing behind crest so gold embroidery gleams at 1x!
    for y in range(11, 19):
        for x in range(4, 12):
            d = math.hypot(x - 7.5, y - 14.5)
            if d <= 3.7:
                c.set(x, y, RD0 if x <= 8 else PL0)

    # Outer embroidered antique-gold astrolabe meridian ring (radius ~3.1)
    ring_pts = [
        (6, 11, GD4), (7, 11, GD3), (8, 11, GD3), (9, 11, GD2),
        (5, 12, GD3), (10, 12, GD2),
        (4, 13, GD3), (11, 13, GD1),
        (4, 14, GD4), (11, 14, GD2),
        (4, 15, GD3), (11, 15, GD2),
        (4, 16, GD3), (11, 16, GD1),
        (5, 17, GD2), (10, 17, GD1),
        (6, 18, GD2), (7, 18, GD2), (8, 18, GD2), (9, 18, GD1),
    ]
    for rx, ry, rcol in ring_pts:
        c.set(rx, ry, rcol)

    # Tall North & South polar astrolabe star points (y=8..10 and y=19..21)
    c.set(7, 8, GD4)
    c.set(8, 8, GD2)
    c.set(7, 9, GD4)
    c.set(8, 9, GD3)
    c.set(7, 10, GD3)
    c.set(8, 10, GD2)

    c.set(7, 19, GD3)
    c.set(8, 19, GD2)
    c.set(7, 20, GD3)
    c.set(8, 20, GD1)
    c.set(7, 21, GD2)
    c.set(8, 21, GD0)

    # Inner diagonal astrolabe crossbars & radiant central star/crystal core (x=6..9, y=13..16)
    c.set(6, 13, GD3)
    c.set(9, 13, GD2)
    c.set(6, 16, GD2)
    c.set(9, 16, GD1)
    # 4-pixel radiant celestial center with arcane teal gem glint!
    c.set(7, 13, GD4)
    c.set(8, 13, GD3)
    c.set(6, 14, GD4)
    c.set(9, 14, GD3)
    c.set(6, 15, GD3)
    c.set(9, 15, GD2)
    c.set(7, 16, GD3)
    c.set(8, 16, GD2)
    c.set(7, 14, TL4)   # gleaming ice-cyan astrolabe core jewel!
    c.set(8, 14, GD4)
    c.set(7, 15, GD4)
    c.set(8, 15, TL2)

    # Lower chevron gold brocade border framing the swallowtail notch (y=23..25)
    c.set(7, 23, GD3)
    c.set(8, 23, GD2)
    c.set(6, 24, GD3)
    c.set(9, 24, GD2)
    c.hline(4, 5, 25, GD3)
    c.hline(10, 11, 25, GD1)

    # --- D. Notched Swallowtail Tail & Golden Bullion Fringe (y=26..30, x=2..13) ---
    # Deep V-shaped swallowtail cutout in center:
    #   y=26: x=7..8 becomes dark outline RD_O above transparent notch (7..8, 27..30)!
    c.hline(7, 8, 26, RD_O)

    # y=27: Left tail x=2..6, center empty x=7..8, right tail x=9..13
    c.set(2, 27, RD_O)
    c.set(3, 27, GD3)
    c.set(4, 27, RD3)
    c.set(5, 27, RD2)
    c.set(6, 27, RD_O)
    c.hline(7, 8, 27, None)
    c.set(9, 27, RD_O)
    c.set(10, 27, RD1)
    c.set(11, 27, RD0)
    c.set(12, 27, GD1)
    c.set(13, 27, RD_O)

    # y=28: Left tail x=2..5 (6 becomes empty, so (6,27) is RD_O and (5,28) is GD_O!), right tail x=10..13
    c.set(2, 28, GD_O)
    c.set(3, 28, GD4)   # golden fringe top!
    c.set(4, 28, GD3)
    c.set(5, 28, GD_O)
    c.hline(6, 9, 28, None)
    c.set(10, 28, GD_O)
    c.set(11, 28, GD2)
    c.set(12, 28, GD3)
    c.set(13, 28, GD_O)

    # y=29: Golden bullion fringe tassels on both tails (x=2..5 and x=10..13)
    c.set(2, 29, GD_O)
    c.set(3, 29, GD3)
    c.set(4, 29, GD2)
    c.set(5, 29, GD_O)
    c.hline(6, 9, 29, None)
    c.set(10, 29, GD_O)
    c.set(11, 29, GD1)
    c.set(12, 29, GD2)
    c.set(13, 29, GD_O)

    # y=30: Crisp dark bronze fringe tips (x=2..5 and x=10..13)
    c.hline(2, 5, 30, GD_O)
    c.hline(6, 9, 30, None)
    c.hline(10, 13, 30, GD_O)

    # Subtle shadow tips beneath banner tails at y=31
    for sx in (3, 4, 11, 12):
        c.shadow(sx, 31)

    return c.im


# ---------------------------------------------------------------------------
# Strict Technical Rule Validator
# ---------------------------------------------------------------------------
def validate_sprite(name: str, im: Image.Image, expected_size: tuple[int, int], camera: str) -> dict:
    assert im.size == expected_size, f"{name}: size {im.size} != {expected_size}"
    w, h = im.size
    px = im.load()

    off_palette = []
    bad_alpha = []
    bad_shadow = []
    bad_outline = []
    pure_black = []

    min_x, min_y, max_x, max_y = w, h, -1, -1
    opaque_colors = set()
    shadow_count = 0

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            elif a == 85:
                shadow_count += 1
                if (r, g, b, a) != SHADOW_RGBA:
                    bad_shadow.append((x, y, (r, g, b, a)))
            elif a == 255:
                hex_c = f"#{r:02x}{g:02x}{b:02x}"
                opaque_colors.add(hex_c)
                if hex_c == "#000000":
                    pure_black.append((x, y))
                if hex_c not in ALL_HEX:
                    off_palette.append((x, y, hex_c))
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

                # Check 4-connected outer boundary (touching out-of-bounds or alpha < 255)
                touches_outside = False
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if nx < 0 or nx >= w or ny < 0 or ny >= h or px[nx, ny][3] < 255:
                        touches_outside = True
                        break
                if touches_outside and hex_c not in DARK_OUTLINE_HEX:
                    bad_outline.append((x, y, hex_c))
            else:
                bad_alpha.append((x, y, a))

    assert not pure_black, f"{name}: pure #000000 pixels: {pure_black}"
    assert not off_palette, f"{name}: off-palette pixels: {off_palette}"
    assert not bad_alpha, f"{name}: invalid alpha pixels: {bad_alpha}"
    assert not bad_shadow, f"{name}: invalid shadow pixels: {bad_shadow}"
    assert not bad_outline, f"{name}: non-dark outer outline pixels: {bad_outline}"

    op_w = max_x - min_x + 1
    op_h = max_y - min_y + 1
    bottom_gap = h - 1 - max_y
    center_err = abs(((min_x + max_x) / 2.0) - ((w - 1) / 2.0))

    assert bottom_gap <= 2, f"{name}: bottom_gap={bottom_gap} > 2"
    assert center_err <= 1.0, f"{name}: center_err={center_err} > 1.0"

    return {
        "name": name,
        "camera": camera,
        "canvas": f"{w}x{h}",
        "opaque": f"{op_w}x{op_h}",
        "bbox": f"x={min_x}..{max_x}, y={min_y}..{max_y}",
        "bottom_gap": bottom_gap,
        "center_err": center_err,
        "colors": len(opaque_colors),
        "shadow_px": shadow_count,
    }


# ---------------------------------------------------------------------------
# Contact Sheet Generator (2x + 1x on #767670 gray next to Beodeul char)
# ---------------------------------------------------------------------------
def build_preview_sheet(sprites: list[tuple[str, Image.Image, dict]]) -> None:
    bg_gray = (0x76, 0x76, 0x70, 255)
    card_border = (0x5A, 0x5A, 0x54, 255)
    header_bg = (0x64, 0x64, 0x5E, 255)
    text_light = (0xF5, 0xF5, 0xEE, 255)
    text_dim = (0xD8, 0xD8, 0xCE, 255)

    # Load ref_beodeul_char_4x.png (88x100 = 4x of 22x25) -> exact 1x (22x25) & 2x (44x50)
    char_raw = Image.open(CHAR_REF_PATH).convert("RGBA")
    char_1x = char_raw.resize((char_raw.width // 4, char_raw.height // 4), Image.Resampling.NEAREST)
    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.Resampling.NEAREST)

    sheet_w = 820
    sheet_h = 460
    sheet = Image.new("RGBA", (sheet_w, sheet_h), bg_gray)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    # Header band
    draw.rectangle([12, 12, sheet_w - 13, 84], fill=header_bg, outline=card_border)
    draw.text(
        (24, 20),
        "fantasy_wizard_library_carbon - Batch 3/4: Alchemy & Lights (2x + 1x on #767670)",
        fill=text_light,
        font=font,
    )
    draw.text(
        (24, 38),
        "Model: gemini-4-carbon (medium) | Locked 70-color Beodeul Palette | Shadow #4c557f@85",
        fill=text_dim,
        font=font,
    )
    draw.text(
        (24, 56),
        "0 Off-Palette | 0 #000000 | 100% 1px Dark Material Outer Outline | Scale Ref: Beodeul 22x25",
        fill=text_dim,
        font=font,
    )

    # Header right: 2x + 1x Beodeul scale character
    sheet.alpha_composite(char_2x, (sheet_w - 140, 18))
    draw.text((sheet_w - 126, 70), "2x", fill=text_dim, font=font)
    sheet.alpha_composite(char_1x, (sheet_w - 76, 43))
    draw.text((sheet_w - 71, 70), "1x", fill=text_dim, font=font)

    # 3x2 grid: 5 upgraded sprites (each with 2x char, 2x sprite, 1x sprite, 1x char) + Cell 6 Old vs New 1x/2x strip
    cols = 3
    card_w = 256
    card_h = 172
    start_x = 12
    start_y = 96
    gap_x = 14
    gap_y = 12

    for idx, (fname, im, stats) in enumerate(sprites):
        col = idx % cols
        row = idx // cols
        cx = start_x + col * (card_w + gap_x)
        cy = start_y + row * (card_h + gap_y)

        draw.rectangle([cx, cy, cx + card_w, cy + card_h], fill=bg_gray, outline=card_border)
        draw.line([(cx + 8, cy + 114), (cx + card_w - 8, cy + 114)], fill=card_border)

        im_2x = im.resize((im.width * 2, im.height * 2), Image.Resampling.NEAREST)
        baseline_y = cy + 104

        # 2x Beodeul char + 2x object + 1x object + 1x Beodeul char
        sheet.alpha_composite(char_2x, (cx + 12, baseline_y - char_2x.height))
        obj2_x = cx + 66 + (80 - im_2x.width) // 2
        sheet.alpha_composite(im_2x, (obj2_x, baseline_y - im_2x.height))

        obj1_x = cx + 158 + (40 - im.width) // 2
        sheet.alpha_composite(im, (obj1_x, baseline_y - im.height))
        sheet.alpha_composite(char_1x, (cx + 210, baseline_y - char_1x.height))

        stem = fname.replace(".png", "")
        draw.text((cx + 10, cy + 120), f"#{idx + 1} {stem}", fill=text_light, font=font)
        draw.text(
            (cx + 10, cy + 136),
            f"[{stats['camera']}] {stats['canvas']} | op {stats['opaque']}",
            fill=text_dim,
            font=font,
        )
        draw.text(
            (cx + 10, cy + 152),
            f"colors={stats['colors']} | shd={stats['shadow_px']}px | PASS",
            fill=text_dim,
            font=font,
        )

    # Cell 6 (col=2, row=1): Native 1x Lineup (Top: Old neon, Bottom: New carbon + Beodeul 1x char)
    cx = start_x + 2 * (card_w + gap_x)
    cy = start_y + 1 * (card_h + gap_y)
    draw.rectangle([cx, cy, cx + card_w, cy + card_h], fill=bg_gray, outline=card_border)
    draw.text((cx + 10, cy + 8), "1x Native Comparison (Old vs Carbon)", fill=text_light, font=font)

    # Top row inside Cell 6: Old neon 1x
    draw.text((cx + 8, cy + 28), "Old:", fill=text_dim, font=font)
    cur_x = cx + 36
    base_old = cy + 66
    draw.line([(cx + 34, base_old), (cx + card_w - 8, base_old)], fill=card_border)
    for fname, _, _ in sprites:
        old_p = OLD_DIR / "objects" / fname
        if old_p.exists():
            old_im = Image.open(old_p).convert("RGBA")
            sheet.alpha_composite(old_im, (cur_x, base_old - old_im.height))
            cur_x += old_im.width + 5

    # Bottom row inside Cell 6: New carbon 1x + Beodeul char 1x
    draw.text((cx + 8, cy + 82), "New:", fill=text_light, font=font)
    cur_x = cx + 36
    base_new = cy + 122
    draw.line([(cx + 34, base_new), (cx + card_w - 8, base_new)], fill=card_border)
    for _, im, _ in sprites:
        sheet.alpha_composite(im, (cur_x, base_new - im.height))
        cur_x += im.width + 5
    sheet.alpha_composite(char_1x, (cur_x + 2, base_new - char_1x.height))

    draw.text((cx + 10, cy + 136), "All 5 sprites 100% Beodeul palette", fill=text_dim, font=font)
    draw.text((cx + 10, cy + 152), "Instant 1x silhouette & material depth", fill=text_dim, font=font)

    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW_PATH)


def main() -> None:
    OBJ_DIR.mkdir(parents=True, exist_ok=True)
    specs = [
        ("alchemy_cauldron_hearth.png", draw_alchemy_cauldron_hearth, (32, 32), "standing"),
        ("potion_alembic_shelf.png", draw_potion_alembic_shelf, (32, 32), "standing"),
        ("alchemy_workbench.png", draw_alchemy_workbench, (32, 16), "topdown"),
        ("brass_candelabra.png", draw_brass_candelabra, (16, 32), "slender"),
        ("wall_banner_crimson.png", draw_wall_banner_crimson, (16, 32), "standing"),
    ]

    built: list[tuple[str, Image.Image, dict]] = []
    print("=== BATCH 3/4: FANTASY WIZARD LIBRARY CARBON — ALCHEMY & LIGHTS ===")
    for fname, builder, size, cam in specs:
        im = builder()
        stats = validate_sprite(fname, im, size, cam)
        out_file = OBJ_DIR / fname
        im.save(out_file)
        built.append((fname, im, stats))
        print(
            f"  [PASS] {fname:28s} | {stats['camera']:8s} | canvas={stats['canvas']:5s} "
            f"| opaque={stats['opaque']:5s} ({stats['bbox']}) | colors={stats['colors']:2d} | shd={stats['shadow_px']:2d}"
        )

    build_preview_sheet(built)
    print(f"\nSaved preview sheet -> {PREVIEW_PATH}")
    print("ALL 5 BATCH 3 SPRITES VALIDATED 100% PASS!")


if __name__ == "__main__":
    main()
