#!/usr/bin/env python3
"""
T2 Ruins Batch 2/4: 5 Museum-Grade Beodeul Architecture & Lighting Objects
Model: gemini-4-carbon (medium)

Sprites:
  1. stone_pillar_intact.png   (16x32, standing, op 12x29)
  2. stone_pillar_broken.png   (16x32, standing, op 13x21)
  3. mossy_stone_well.png      (32x32, standing, op 26x27)
  4. iron_brazier_lit.png      (16x32, standing, op 12x28)
  5. stone_garden_lantern.png  (16x32, slender,  op 10x29)

Hard Rules Enforced:
  - 100% locked to palette_beodeul_ruins.json (74 colors, 0 off-palette, 0 #000000)
  - Optional ground shadow ONLY #4c557f at alpha 85/255; all other pixels alpha 0 or 255
  - 1px dark material outer outline on every edge touching non-opaque pixels (luma <= 85)
  - True RPG Maker / Beodeul 3/4 top-down camera (standing / slender, zero side walls)
"""

from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
REFS_DIR = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs"
OLD_RUINS_DIR = ROOT / "tiledata/dungeon-dots/fantasy_sky_ruins"
PALETTE_JSON = OLD_RUINS_DIR / "palette_beodeul_ruins.json"
CHAR_REF_4X = REFS_DIR / "ref_beodeul_char_4x.png"

OUT_DIR = ROOT / "tiledata/dungeon-dots/fantasy_sky_ruins_carbon"
OBJ_DIR = OUT_DIR / "objects"
PREVIEW_PNG = OUT_DIR / "preview_batch2.png"

SHADOW_RGBA = (0x4C, 0x55, 0x7F, 85)  # #4c557f @ 85/255
TRANSPARENT = (0, 0, 0, 0)

# Curated semantic tokens strictly from palette_beodeul_ruins.json (74 colors)
P = {
    # Limestone ramp (9)
    "S0": "#262729",  # darkest stone outline (luma 38.9)
    "S1": "#3e403d",  # deep stone crevice / overhang shadow (luma 63.1)
    "S2": "#595b58",  # dark shaded limestone
    "S3": "#767776",  # mid-dark weathered limestone
    "S4": "#929491",  # mid limestone
    "S5": "#afb1ae",  # light-mid limestone
    "S6": "#c4c6c3",  # lit stone face
    "S7": "#dadcd9",  # bright top/left bevel
    "S8": "#e5e7e4",  # sunlit limestone specular
    # Cool Slate Dark ramp (5)
    "D0": "#2b3436",  # dark cool slate outline (luma 49.5)
    "D1": "#40484a",  # deep cool slate core shadow (luma 69.5)
    "D2": "#5b6667",  # cool slate cobble shadow
    "D3": "#797a84",  # cool blue-grey stone mid
    "D4": "#a0a2ac",  # pale steel / cool stone highlight
    # Sanctuary Moss & Meadow Greens (9)
    "M0": "#1d2d19",  # darkest moss outline (luma 37.9)
    "M1": "#2d4619",  # deep moss shadow (luma 57.6)
    "M2": "#3d5e24",  # rich dark moss
    "M3": "#5c7728",  # mid olive moss
    "M4": "#8eac43",  # sunlit green moss
    "M5": "#a8ca5c",  # bright moss tip highlight
    "G0": "#363f2a",  # earthy olive crevice (luma 58.6)
    "G1": "#4b6827",  # meadow moss mid
    "G2": "#6e9943",  # lush sanctuary moss
    # Deep Sanctuary Teal Water & Cyan Glints (11)
    "W0": "#0c2222",  # abyssal well waterline shadow (luma 27.5)
    "W1": "#1a4640",  # deep shaded well water
    "W2": "#1c4a44",  # dark teal water
    "W3": "#21584e",  # mid-deep sanctuary teal
    "W4": "#2a6f71",  # luminous teal water
    "W5": "#3fa2ae",  # bright aqua ripple
    "W6": "#7da3a6",  # soft seafoam reflection
    "C3": "#84c8ce",  # sparkling cyan ripple
    "C4": "#9ce0ee",  # water droplet glint
    "C5": "#cff4f8",  # crisp white-cyan foam glint
    "C6": "#f2ffff",  # pure water specular
    # Weathered Oak Timber (8)
    "O0": "#291c13",  # darkest oak outline (luma 30.9)
    "O1": "#452a17",  # deep oak shadow / dark rust (luma 47.7)
    "O2": "#583a24",  # dark weathered oak (luma 61.4)
    "O3": "#6f4725",  # warm oak / rust-bronze patina (luma 76.8)
    "O4": "#8c6038",  # mid seasoned oak
    "O5": "#a67d55",  # lit oak timber
    "O6": "#bd936b",  # sunlit oak bevel
    "O7": "#d8aa73",  # golden oak specular / warm firelight bounce
    # Hemp Rope & Warm Weathered Limestone Accent (6)
    "P0": "#59503a",  # dark rope shadow
    "P1": "#827869",  # warm grey-tan stone / cobble variation
    "P2": "#a69a77",  # mid braided hemp rope
    "P3": "#c2bca7",  # lit tan rope / warm limestone core
    "P4": "#d9d2be",  # bright twisted rope strand
    "P5": "#f0e7cc",  # warm cream rope/stone glint
    # Forged Iron & Bronze (5)
    "I0": "#1c1c26",  # darkest forged iron outline (luma 29.1)
    "I1": "#30384a",  # deep blue-iron shadow (luma 55.6)
    "I2": "#4e5a6b",  # mid forged iron
    "I3": "#72808a",  # lit iron rim bevel
    "I4": "#a0a2ac",  # bright metallic glint
    # Roaring Flame, Glowing Embers & Warm Bounce (11)
    "F0": "#491d20",  # darkest crimson flame/rust outline (luma 42.5)
    "F1": "#76302f",  # deep coal / dark rust (luma 68.8)
    "F2": "#863736",  # crimson ember
    "F3": "#b9422c",  # scarlet flame tip
    "F4": "#df722f",  # deep orange flame
    "F5": "#f08a10",  # blazing tangerine fire
    "F6": "#dc9a26",  # rich golden amber
    "F7": "#fbc10d",  # brilliant yellow flame
    "F8": "#fff2a5",  # incandescent cream-white fire core
    "F9": "#d97163",  # warm firelight rim bounce on iron
    "FA": "#f4c5b2",  # soft warm lantern glow spill on stone
}

DARK_OUTLINE_HEXES = {
    "#262729",  # S0 stone
    "#3e403d",  # S1 deep stone
    "#2b3436",  # D0 slate
    "#1d2d19",  # M0 moss
    "#2d4619",  # M1 deep moss
    "#291c13",  # O0 oak
    "#452a17",  # O1 deep oak/rust
    "#1c1c26",  # I0 iron
    "#30384a",  # I1 deep iron
    "#491d20",  # F0 crimson flame outline
}


def hex_to_rgba(hx: str) -> tuple[int, int, int, int]:
    h = hx.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def luma(r: int, g: int, b: int) -> float:
    return 0.299 * r + 0.587 * g + 0.114 * b


class Canvas:
    def __init__(self, w: int, h: int) -> None:
        self.w = w
        self.h = h
        self.im = Image.new("RGBA", (w, h), TRANSPARENT)
        self.px = self.im.load()

    def set(self, x: int, y: int, tok: str | None) -> None:
        if tok is None or not (0 <= x < self.w and 0 <= y < self.h):
            return
        if tok == ".":
            self.px[x, y] = TRANSPARENT
        elif tok == "SH":
            self.px[x, y] = SHADOW_RGBA
        else:
            self.px[x, y] = hex_to_rgba(P[tok])

    def hline(self, x0: int, x1: int, y: int, tok: str) -> None:
        for x in range(x0, x1 + 1):
            self.set(x, y, tok)

    def vline(self, x: int, y0: int, y1: int, tok: str) -> None:
        for y in range(y0, y1 + 1):
            self.set(x, y, tok)

    def rect(self, x0: int, y0: int, x1: int, y1: int, tok: str) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, tok)

    def shadow_ellipse(self, cx: float, cy: float, rx: float, ry: float) -> None:
        for y in range(self.h):
            for x in range(self.w):
                if self.px[x, y][3] == 0:
                    dx = (x - cx) / rx
                    dy = (y - cy) / ry
                    if dx * dx + dy * dy <= 1.0:
                        self.px[x, y] = SHADOW_RGBA

    def shadow_rect_if_empty(self, x0: int, y0: int, x1: int, y1: int) -> None:
        for y in range(max(0, y0), min(self.h - 1, y1) + 1):
            for x in range(max(0, x0), min(self.w - 1, x1) + 1):
                if self.px[x, y][3] == 0:
                    self.px[x, y] = SHADOW_RGBA

    def draw_rows(self, rows: list[str], tok_map: dict[str, str | None], ox: int = 0, oy: int = 0) -> None:
        for dy, row in enumerate(rows):
            for dx, ch in enumerate(row):
                if ch == " ":
                    continue
                tk = tok_map[ch]
                if tk is not None:
                    self.set(ox + dx, oy + dy, tk)


# ============================================================================
# 1. stone_pillar_intact.png (16x32, standing, target opaque 12x29)
#    Sculpted fluted Greco-Beodeul stone column:
#    - Square 3/4 top abacus slab (y=2..6, x=2..13) with recessed tray, bright
#      front bevel & carved dentil frieze
#    - Curved echinus volute cushion + deep necking cast shadow (y=7..8)
#    - Volumetric 10px cylindrical fluted shaft (x=3..12, y=9..24) where flute
#      ridges & hollows follow a macro left-to-right cylindrical light curve
#    - Organic climbing sanctuary moss vine + weathered ashlar drum seams
#    - Stepped 3/4 square plinth base with lit top shelf & block masonry (y=25..30)
# ============================================================================
def build_stone_pillar_intact() -> Image.Image:
    c = Canvas(16, 32)

    rows = [
        # 0123456789ABCDEF
        "................",  # y=0
        "................",  # y=1
        "..000000000000..",  # y=2  square abacus top outline (x=2..13)
        "..087766655440..",  # y=3  3/4 top surface back rim (lit top-left)
        "..075555444430..",  # y=4  3/4 recessed top stone tray plane
        "..088776655430..",  # y=5  crisp sunlit front abacus top lip!
        "..053625241310..",  # y=6  carved dentil / egg-and-dart abacus frieze
        "...0785645210...",  # y=7  sculpted echinus cushion / scroll bolsters (x=3..12)
        "...0421211d00...",  # y=8  astragal necking ring + deep capital overhang shadow
        "...0m44634d20...",  # y=9  tiny moss tuft under left capital + cylindrical flutes
        "...0b84735d20...",  # y=10 cylindrical shaft: x=4 limb(S6), x=5 ridge1(S8), x=6 groove1(S4), x=7 ridge2(S7), x=8 groove2(S3), x=9 ridge3(S5), x=10 core shadow(D1), x=11 reflected rim(S2)
        "...0684735d20...",  # y=11
        "...0684735120...",  # y=12
        "...0674634120...",  # y=13
        "...0352412010...",  # y=14 horizontal stone drum seam #1
        "...0784735d20...",  # y=15 bright catchlight along top of middle drum!
        "...0684735d20...",  # y=16
        "...0674635120...",  # y=17
        "...0674n34120...",  # y=18 climbing moss tendril tip reaching center flute
        "...067mn34110...",  # y=19 moss tendril + small chipped notch on right
        "...034NM22010...",  # y=20 drum seam #2 + sunlit moss leaves wrapping shaft
        "...06mNM24d20...",  # y=21 lush moss cluster catching top-left light (#a8ca5c)
        "...0mnN434d20...",  # y=22 moss vine curving down toward left base
        "...MmNM463120...",  # y=23 dark moss outline M0 at x=3 where vine hugs edge!
        "...Mnm5634120...",  # y=24 moss base root on lower shaft
        "...0nN8765320...",  # y=25 rounded Attic torus collar top around shaft foot
        "...0m654321d0...",  # y=26 torus belly & scotia undercut shadow
        "..088777665540..",  # y=27 wide 3/4 square plinth LIT TOP LEDGE (x=2..13)!
        "..MNn665254320..",  # y=28 plinth front stone blocks (mortar seam at x=8) + moss
        "..Mm4543132d10..",  # y=29 plinth lower bevel & shaded foot
        "..MM0000000000..",  # y=30 crisp dark material bottom outline (M0/S0)
        "................",  # y=31 ground shadow row
    ]

    tok_map = {
        ".": None,
        "0": "S0",
        "1": "S1",
        "2": "S2",
        "3": "S3",
        "4": "S4",
        "5": "S5",
        "6": "S6",
        "7": "S7",
        "8": "S8",
        "b": "M2",
        "d": "D1",
        "M": "M0",
        "m": "M2",
        "n": "M3",
        "N": "M4",
    }
    c.draw_rows(rows, tok_map)
    # Brightest sunlit moss leaf speculars
    c.set(6, 21, "M5")
    c.set(5, 22, "M5")
    c.set(4, 28, "M4")

    # Soft ground shadow (#4c557f@85) around base
    c.shadow_rect_if_empty(1, 30, 14, 31)
    c.shadow_rect_if_empty(2, 29, 14, 29)
    return c.im


# ============================================================================
# 2. stone_pillar_broken.png (16x32, standing, target opaque 13x21)
#    Ruined jagged-snapped fluted Greco-Beodeul column (matched pair to #1):
#    - Jagged diagonal fracture (y=10..16) exposing rough 3/4 tilted pale
#      limestone interior core (#e5e7e4 / #dadcd9 / #d9d2be) with dark cracks
#    - Clinging sanctuary moss cascading out of the fractured V-notch
#    - Matching cylindrical fluted shaft & stepped 3/4 square plinth
#    - Sculpted fallen fluted stone rubble chunk resting at right base (x=10..14)
# ============================================================================
def build_stone_pillar_broken() -> Image.Image:
    c = Canvas(16, 32)

    rows = [
        # 0123456789ABCDEF
        "................",  # y=0
        "................",  # y=1
        "................",  # y=2
        "................",  # y=3
        "................",  # y=4
        "................",  # y=5
        "................",  # y=6
        "................",  # y=7
        "................",  # y=8
        "................",  # y=9
        "...000..........",  # y=10 tall jagged left stone spire peak (x=3..5)
        "...08700........",  # y=11 sunlit fractured limestone tip
        "...08p50.00.....",  # y=12 V-notch fracture gap (x=8) + secondary jagged tooth (x=9..10)
        "...07pN00750....",  # y=13 exposed warm rough limestone core (p=P4) + moss in notch
        "...068JN6p400...",  # y=14 tilted 3/4 broken cross-section plane across shaft!
        "...067nJ4p320...",  # y=15 jagged front break edge transitioning to flutes + right shear
        "...0684m535d0...",  # y=16 clinging moss cascading down middle flute + hairline crack
        "...06846254d0...",  # y=17 internal fracture crack at x=8 (S2)
        "...0674732410...",  # y=18 crack stepping to x=9
        "...0674634120...",  # y=19 cylindrical fluted shaft
        "...0352412010...",  # y=20 horizontal ashlar drum seam
        "...0784735d20...",  # y=21 catchlight below drum seam
        "...0674635d20...",  # y=22
        "...Mm74634120...",  # y=23 basal moss creeping up left shaft
        "...MNn5634120...",  # y=24
        "...0mN8765320...",  # y=25 Attic torus collar around column foot
        "...0m654320000..",  # y=26 torus + top outline of fallen rubble chunk at x=10..13!
        "..0887776508700.",  # y=27 3/4 plinth lit top + bright broken facet on rubble (x=11..14)!
        "..MNn6652407530.",  # y=28 plinth blocks + sculpted fallen drum wedge at x=10..14
        "..Mm45431205310.",  # y=29 mossy left plinth + shaded rubble underside
        "..MM00000000000.",  # y=30 crisp dark bottom outline across x=2..14 (13px wide!)
        "................",  # y=31 ground shadow row
    ]

    tok_map = {
        ".": None,
        "0": "S0",
        "1": "S1",
        "2": "S2",
        "3": "S3",
        "4": "S4",
        "5": "S5",
        "6": "S6",
        "7": "S7",
        "8": "S8",
        "d": "D1",
        "p": "P4",
        "M": "M0",
        "m": "M2",
        "n": "M3",
        "N": "M4",
        "J": "M5",
    }
    c.draw_rows(rows, tok_map)

    # Ground shadow (#4c557f@85) under plinth & fallen rubble
    c.shadow_rect_if_empty(1, 30, 15, 31)
    c.shadow_rect_if_empty(2, 29, 15, 29)
    return c.im


# ============================================================================
# 3. mossy_stone_well.png (32x32, standing, target opaque 26x27)
#    Authentic Beodeul mossy stone wishing well (well_bucket_crank caliber!):
#    - Sculpted 3/4 oval cobblestone ring wall (x=3..28, y=14..30) with curved
#      bottom silhouette, individually shaded interlocking fieldstones, visible
#      wet back inner masonry wall, and lush sanctuary moss cushions
#    - Deep sanctuary teal water (#0c2222 -> #2a6f71) with bright cyan/foam
#      ripples (#3fa2ae / #84c8ce / #cff4f8)
#    - Stout weathered oak A-frame posts + angled knee/foot braces, central
#      hemp-wrapped windlass spool, wrought-iron S-crank & iron-hooped bucket!
# ============================================================================
def build_mossy_stone_well() -> Image.Image:
    c = Canvas(32, 32)
    cx = 15.5

    # --- 1. Curved 3/4 Circular Cobblestone Well Base & Ring (x=3..28, y=14..30) ---
    # Outer wall horizontal span per row y=14..30 (true curved cylinder bottom & oval top!)
    row_spans = {
        14: (9, 22),
        15: (6, 25),
        16: (5, 26),
        17: (4, 27),
        18: (3, 28),
        19: (3, 28),
        20: (3, 28),
        21: (3, 28),
        22: (3, 28),
        23: (3, 28),
        24: (3, 28),
        25: (3, 28),
        26: (4, 27),
        27: (4, 27),
        28: (5, 26),
        29: (7, 24),
        30: (10, 21),
    }

    # Fill base stone body & outer stone outline
    for y, (x0, x1) in row_spans.items():
        for x in range(x0, x1 + 1):
            # Macro cylindrical left-to-right + bottom curvature shading
            t = (x - 3) / 25.0
            if y <= 16:
                tok = "S7" if t < 0.45 else ("S6" if t < 0.75 else "S5")
            elif y <= 22:
                tok = "S7" if t < 0.35 else ("S6" if t < 0.65 else ("S5" if t < 0.85 else "S4"))
            else:
                if t < 0.22:
                    tok = "S6"
                elif t < 0.48:
                    tok = "S5"
                elif t < 0.72:
                    tok = "S4"
                elif t < 0.88:
                    tok = "D2"
                else:
                    tok = "D1"
                if y >= 28:
                    tok = "S3" if t < 0.45 else ("D2" if t < 0.75 else "D1")
            c.set(x, y, tok)

    # Carve inner elliptical well opening (y=16..21, x=7..24)
    opening_spans = {
        16: (10, 21),  # wet inner back masonry wall right under back rim!
        17: (8, 23),   # lower wet back masonry + shadow waterline
        18: (7, 24),   # deep sanctuary teal water
        19: (7, 24),   # mid sanctuary teal water
        20: (8, 23),   # front sanctuary teal water
        21: (10, 21),  # front water tucked behind bright front coping stones
    }
    for x in range(10, 22):
        c.set(x, 16, "S3" if x < 15 else ("S2" if x < 19 else "D1"))
    for x in range(8, 24):
        if x in (8, 9, 22, 23):
            c.set(x, 17, "S2" if x < 12 else "D1")
        else:
            c.set(x, 17, "W0")  # deep overhang shadow on back water

    # Deep layered sanctuary teal water (y=18..21)
    for y in (18, 19, 20, 21):
        wx0, wx1 = opening_spans[y]
        for x in range(wx0, wx1 + 1):
            dist_edge = min(x - wx0, wx1 - x)
            if y == 18:
                wt = "W0" if dist_edge == 0 else ("W1" if dist_edge <= 2 else "W2")
            elif y == 19:
                wt = "W1" if dist_edge <= 1 else ("W3" if 11 <= x <= 20 else "W2")
            elif y == 20:
                wt = "W2" if dist_edge <= 1 else ("W4" if 11 <= x <= 19 else "W3")
            else:
                wt = "W3" if 12 <= x <= 18 else "W2"
            c.set(x, y, wt)

    # Crisp inner coping rim highlight around water opening (3/4 top stone ring!)
    for x in range(10, 22):
        c.set(x, 15, "S8" if x <= 16 else "S7")
    for x in range(10, 22):
        c.set(x, 22, "S8" if x <= 15 else ("S7" if x <= 19 else "S6"))
    c.set(8, 21, "S8")
    c.set(9, 21, "S8")
    c.set(22, 21, "S6")
    c.set(23, 21, "S5")
    for x, y, tk in [
        (5, 18, "S8"), (5, 19, "S8"), (5, 20, "S7"),
        (6, 17, "S8"), (6, 20, "S8"), (7, 21, "S7"),
        (25, 17, "S6"), (26, 18, "S6"), (26, 19, "S5"), (25, 20, "S5"),
    ]:
        c.set(x, y, tk)

    # Radial mortar joints on top stone coping ring
    for jx, jy in [(12, 15), (19, 15), (5, 19), (26, 19), (11, 22), (16, 22), (21, 22)]:
        c.set(jx, jy, "S3")

    # --- 2. Individually Sculpted Rounded Cobblestones on Front Wall (y=22..29) ---
    # Dark mortar joints defining interlocking rounded fieldstones (like well_bucket_crank!)
    mortar_pts = [
        # Upper mortar line below coping rim (y=23)
        (4, 22, "S2"), (5, 23, "S2"), (6, 23, "S2"), (7, 23, "S3"),
        (8, 22, "S2"), (9, 23, "S2"), (10, 23, "S2"), (11, 23, "S3"),
        (12, 23, "S2"), (13, 24, "S2"), (14, 24, "S2"), (15, 23, "S2"),
        (16, 23, "S2"), (17, 24, "S2"), (18, 24, "S2"), (19, 23, "S2"),
        (20, 23, "S1"), (21, 23, "S1"), (22, 23, "S1"), (23, 22, "S1"),
        (24, 22, "D1"), (25, 22, "D1"), (26, 21, "D1"), (27, 21, "D1"),
        # Mid staggered cobble joints (y=24..26)
        (6, 24, "S2"), (6, 25, "S2"),
        (11, 24, "S2"), (11, 25, "S2"),
        (16, 25, "S1"), (16, 26, "S1"),
        (21, 24, "S1"), (21, 25, "D1"),
        (25, 23, "D1"), (25, 24, "D1"),
        # Lower curved mortar course (y=26..27)
        (5, 26, "S2"), (7, 26, "S2"), (8, 26, "S2"),
        (9, 27, "S2"), (10, 27, "S2"), (12, 26, "S2"), (13, 27, "S1"),
        (14, 27, "S1"), (15, 27, "S1"), (17, 27, "S1"), (18, 27, "D1"),
        (19, 26, "D1"), (20, 26, "D1"), (22, 26, "D1"), (23, 26, "D1"), (24, 25, "D1"),
        # Bottom course vertical joints (y=28..29)
        (9, 28, "S1"), (14, 28, "S1"), (14, 29, "S1"), (19, 28, "D1"),
    ]
    for mx, my, mtk in mortar_pts:
        c.set(mx, my, mtk)

    # Individual sunlit cobble top-left bevel highlights & warm/cool stone variation!
    cobble_highlights = [
        # Course 1 cobbles (y=24..25)
        (4, 23, "S7"), (4, 24, "S6"), (5, 24, "S7"),
        (7, 24, "S8"), (8, 24, "S7"), (9, 24, "P3"), (10, 24, "S6"),
        (12, 24, "S7"), (12, 25, "S6"), (13, 25, "S7"), (14, 25, "S6"), (15, 24, "S6"),
        (17, 25, "S6"), (18, 25, "P1"), (19, 24, "S5"), (20, 24, "S4"),
        (22, 24, "D3"), (23, 23, "S5"), (24, 23, "D3"), (26, 22, "D3"),
        # Course 2 cobbles (y=27..28)
        (6, 27, "S7"), (7, 27, "S6"), (8, 27, "P1"),
        (10, 28, "S6"), (11, 27, "S7"), (12, 27, "S6"), (13, 28, "S5"),
        (15, 28, "S6"), (16, 28, "S5"), (17, 28, "D3"),
        (19, 27, "D3"), (20, 27, "D2"), (21, 27, "S3"),
        # Bottom stones (y=29)
        (11, 29, "S5"), (12, 29, "S4"), (16, 29, "S4"), (17, 29, "S3"),
    ]
    for hx, hy, htk in cobble_highlights:
        c.set(hx, hy, htk)

    # Enforce crisp 1px dark stone outer boundary around the entire well masonry ring
    for y, (x0, x1) in row_spans.items():
        for x in range(x0, x1 + 1):
            is_outer = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if ny not in row_spans or not (row_spans[ny][0] <= nx <= row_spans[ny][1]):
                    is_outer = True
                    break
            if is_outer:
                c.set(x, y, "S0" if x < 22 else "D0")

    # Lush Sanctuary Moss Patches cushioned on rim & between cobbles!
    moss_pixels = [
        # Left rim pillow moss (x=4..7, y=19..22)
        (3, 20, "M0"), (3, 21, "M0"),
        (4, 19, "M3"), (5, 19, "M4"),
        (4, 20, "M4"), (5, 20, "M5"), (6, 20, "M3"),
        (4, 21, "M2"), (5, 21, "M4"), (6, 21, "M3"), (7, 21, "M2"),
        (5, 22, "M1"), (6, 22, "M2"),
        # Front-left lower moss cluster (x=5..9, y=25..28)
        (4, 26, "M0"), (4, 27, "M0"), (5, 28, "M0"), (6, 28, "M0"),
        (5, 25, "M3"), (6, 25, "M4"),
        (5, 26, "M4"), (6, 26, "M5"), (7, 26, "M3"),
        (5, 27, "M2"), (6, 27, "M3"), (7, 27, "M2"), (8, 27, "M1"),
        # Small moss tuft on right-front mortar crevice (x=20..23, y=25..27)
        (21, 25, "M3"), (22, 25, "M4"),
        (21, 26, "M2"), (22, 26, "M3"), (23, 26, "M1"),
    ]
    for mx, my, mtk in moss_pixels:
        c.set(mx, my, mtk)

    # --- 3. Stout Weathered Oak A-Frame Posts, Braces & Crossbeam (y=4..18) ---
    # Left stout post (x=7..9, y=5..18) + angled outer A-frame strut (x=5..6, y=13..18)
    for y in range(6, 18):
        c.set(7, y, "O0")
        c.set(8, y, "O6" if y < 13 else "O5")  # sunlit left oak face
        c.set(9, y, "O4" if y < 13 else "O3")  # shaded oak grain
        c.set(10, y, "O0")
    # Left outer A-frame diagonal timber brace + iron anchor shoe on stone rim!
    aframe_left = [
        (6, 12, "O0"), (6, 13, "O0"), (7, 13, "O5"),
        (5, 14, "O0"), (6, 14, "O6"), (7, 14, "O3"),
        (5, 15, "O0"), (6, 15, "O5"), (7, 15, "O2"),
        (4, 16, "I0"), (5, 16, "I3"), (6, 16, "O4"), (7, 16, "O2"),
        (4, 17, "I0"), (5, 17, "I4"), (6, 17, "I2"), (7, 17, "I1"), (8, 17, "I3"), (9, 17, "I2"), (10, 17, "I0"),
        (6, 18, "I0"), (7, 18, "I0"), (8, 18, "I0"), (9, 18, "I0"),
    ]
    for ax, ay, atk in aframe_left:
        c.set(ax, ay, atk)

    # Right stout post (x=21..24, y=6..18) + angled outer A-frame strut (x=25..27, y=13..18)
    for y in range(6, 18):
        c.set(21, y, "O0")
        c.set(22, y, "O5" if y < 13 else "O4")
        c.set(23, y, "O3" if y < 13 else "O2")
        c.set(24, y, "O0")
    aframe_right = [
        (25, 12, "O0"), (24, 13, "O3"), (25, 13, "O0"),
        (24, 14, "O4"), (25, 14, "O2"), (26, 14, "O0"),
        (24, 15, "O3"), (25, 15, "O2"), (26, 15, "O0"),
        (24, 16, "O2"), (25, 16, "O1"), (26, 16, "I2"), (27, 16, "I0"),
        (21, 17, "I0"), (22, 17, "I3"), (23, 17, "I2"), (24, 17, "I1"), (25, 17, "I2"), (26, 17, "I1"), (27, 17, "I0"),
        (22, 18, "I0"), (23, 18, "I0"), (24, 18, "I0"), (25, 18, "I0"),
    ]
    for ax, ay, atk in aframe_right:
        c.set(ax, ay, atk)

    # Heavy horizontal oak crossbeam / axle beam (x=6..25, y=5..7) + iron bearing straps
    c.hline(6, 25, 5, "O0")
    for x in range(7, 25):
        c.set(x, 6, "O7" if x < 14 else ("O6" if x < 21 else "O5"))
        c.set(x, 7, "O4" if x < 16 else "O3")
    c.hline(6, 25, 8, "O0")
    c.vline(6, 5, 8, "O0")
    c.vline(25, 5, 8, "O0")
    # Iron end-cap straps on beam above posts
    for ix in (8, 23):
        c.set(ix, 5, "I0")
        c.set(ix, 6, "I4")
        c.set(ix, 7, "I2")

    # Upper inner diagonal knee-braces under crossbeam (x=10..11 & x=20..21, y=8..10)
    for bx, by, btk in [
        (10, 8, "O5"), (11, 8, "O4"), (12, 8, "O0"),
        (10, 9, "O4"), (11, 9, "O0"),
        (10, 10, "O0"),
        (19, 8, "O0"), (20, 8, "O4"), (21, 8, "O3"),
        (20, 9, "O0"), (21, 9, "O2"),
        (21, 10, "O0"),
    ]:
        c.set(bx, by, btk)

    # Central Hemp-Coiled Windlass Spool Drum (x=13..18, y=4..8)
    c.hline(13, 18, 4, "O0")
    c.vline(13, 4, 8, "O0")
    c.vline(18, 4, 8, "O0")
    c.hline(13, 18, 8, "O0")
    # Tightly wound braided hemp rope coils on drum (LESSONS.md #16!)
    spool_coils = [
        (14, 5, "P5"), (15, 5, "P3"), (16, 5, "P4"), (17, 5, "P2"),
        (14, 6, "P4"), (15, 6, "P5"), (16, 6, "P3"), (17, 6, "P4"),
        (14, 7, "P2"), (15, 7, "P3"), (16, 7, "P2"), (17, 7, "P0"),
    ]
    for sx, sy, stk in spool_coils:
        c.set(sx, sy, stk)

    # Wrought-iron S-curved crank arm & wooden grip on right post (x=25..28, y=6..11)
    crank_pts = [
        (25, 6, "I3"), (26, 6, "I0"), (27, 6, "I0"),
        (25, 7, "I2"), (26, 7, "I4"), (27, 7, "I3"), (28, 7, "I0"),
        (26, 8, "I0"), (27, 8, "I2"), (28, 8, "I0"),
        (26, 9, "I0"), (27, 9, "I3"), (28, 9, "I0"),
        (26, 10, "O0"), (27, 10, "O6"), (28, 10, "O0"),
        (27, 11, "O0"),
    ]
    for kx, ky, ktk in crank_pts:
        c.set(kx, ky, ktk)

    # Taut 2px braided tan rope (LESSONS.md #16!) centered at x=15..16 with dark O0 outline x=14,17
    for ry in range(9, 13):
        c.set(14, ry, "O0")
        c.set(15, ry, "P4" if ry % 2 == 1 else "P2")
        c.set(16, ry, "P2" if ry % 2 == 1 else "P4")
        c.set(17, ry, "O0")

    # Hanging Round-Bellied Oak Stave Bucket with Iron Bail & Hoops (x=13..18, y=13..20)
    bucket_pts = [
        # Iron bail handle arch (y=13..14)
        (13, 13, "I0"), (14, 13, "I0"), (15, 13, "I4"), (16, 13, "I3"), (17, 13, "I0"), (18, 13, "I0"),
        (13, 14, "I0"), (14, 14, "I4"), (15, 14, "O6"), (16, 14, "O5"), (17, 14, "I2"), (18, 14, "I0"),
        # Elliptical bucket mouth filled with shimmering sanctuary water (y=15)
        (13, 15, "O0"), (14, 15, "O7"), (15, 15, "W4"), (16, 15, "C4"), (17, 15, "O4"), (18, 15, "O0"),
        # Upper oak staves (y=16)
        (13, 16, "O0"), (14, 16, "O6"), (15, 16, "O7"), (16, 16, "O4"), (17, 16, "O2"), (18, 16, "O0"),
        # Forged iron barrel hoop with 1px specular glint (LESSONS.md #9, y=17)
        (13, 17, "I0"), (14, 17, "I4"), (15, 17, "I3"), (16, 17, "I2"), (17, 17, "I1"), (18, 17, "I0"),
        # Lower tapered oak staves (y=18..19)
        (13, 18, "O0"), (14, 18, "O5"), (15, 18, "O6"), (16, 18, "O3"), (17, 18, "O2"), (18, 18, "O0"),
        (14, 19, "O0"), (15, 19, "I3"), (16, 19, "I2"), (17, 19, "O0"),
        (15, 20, "O0"), (16, 20, "O0"),
    ]
    for bx, by, btk in bucket_pts:
        c.set(bx, by, btk)

    # Sparkling foam & cyan water ripples around bucket & across dark water (LESSONS.md #19)
    water_glints = [
        (12, 19, "W5"), (13, 19, "C4"), (18, 19, "C3"), (19, 19, "W5"),
        (13, 20, "W5"), (14, 20, "C5"), (17, 20, "C4"), (18, 20, "W5"),
        (10, 19, "W5"), (11, 18, "W4"), (20, 18, "W4"), (21, 19, "W5"),
        (15, 21, "C3"), (16, 21, "W5"),
    ]
    for wx, wy, wtk in water_glints:
        c.set(wx, wy, wtk)

    # Soft oval ground shadow (#4c557f@85) beneath curved cobble well base
    c.shadow_ellipse(15.5, 28.8, 12.2, 2.8)
    return c.im


# ============================================================================
# 4. iron_brazier_lit.png (16x32, standing, target opaque 12x28)
#    Heavy rusted-iron temple fire brazier on fluted tripod pedestal:
#    - Asymmetric roaring layered flames (cream core #fff2a5 -> gold #fbc10d
#      -> orange #f08a10/#df722f -> scarlet #b9422c -> dark crimson outline)
#    - Heaped red-hot ember bed inside curved 3/4 metallic bowl rim + warm
#      firelight rim bounce (#d8aa73 / #d97163)
#    - Ribbed forged-iron cauldron with weathered rust-bronze patina & side ears
#    - Collared central shaft flaring into 3 distinct clawed tripod feet!
# ============================================================================
def build_iron_brazier_lit() -> Image.Image:
    c = Canvas(16, 32)

    rows = [
        # 0123456789ABCDEF
        "................",  # y=0
        "................",  # y=1
        "................",  # y=2
        ".......FF.......",  # y=3  tall central flame peak (x=7..8)
        "......F53F......",  # y=4  scarlet/orange upper lick
        ".....F475FF.....",  # y=5  golden inner tongue
        ".....F586F3F....",  # y=6  dancing right flame tongue separated by crisp notch!
        "....FF48874F....",  # y=7  sculpted flame body (narrower than 12px bowl!)
        "....F478875F....",  # y=8  incandescent cream-white heart (#fff2a5)
        "...FF5788874F...",  # y=9  flickering left & right flame curls
        "...F47888875F...",  # y=10 roaring lower fire
        "....F578887F....",  # y=11 flame base tucking cleanly into wide cauldron mouth!
        "..II13688751II..",  # y=12 WIDE 12px flanged bowl ears flaring 2px past flames!
        "..Iab357864r2I..",  # y=13 gleaming iron handles + heaped red-hot ember bed!
        "..Iba9g9abp21I..",  # y=14 crisp 3/4 FRONT METALLIC BOWL RIM (fire-warmed center!)
        "..II2abRbcq1II..",  # y=15 flanged bowl lip overhang + ribbed iron belly
        "...Ibaubcq21I...",  # y=16 curved metallic ribs (I4/I3) + warm rust-bronze (O4/O2)
        "....I2bR2q1I....",  # y=17 tapered lower cauldron
        ".....I2R11I.....",  # y=18 bowl calyx underside
        "......IvRI......",  # y=19 slender 4px bronze-rusted neck collar!
        "......Ia2I......",  # y=20 slender forged-iron pedestal waist!
        "......Ib1I......",  # y=21
        ".....Ipuq1I.....",  # y=22 decorative rusted-bronze mid-nodal ring
        "......Ib1I......",  # y=23 lower slender stem
        "....IIb221II....",  # y=24 tripod hub arching outward
        "...Ia2Ib1I21I...",  # y=25 3 tripod legs arching outward
        "...Ibu2a2R21I...",  # y=26 wrought-iron stretcher ring binding the 3 legs
        "..Ib2IIb1II21I..",  # y=27 3 clawed legs separating cleanly
        "..IaI.Ib1I.I2I..",  # y=28 unmistakable 3-leg negative space at x=5 & x=10!
        "..IpI.Ia2I.I2I..",  # y=29 3 forged paw feet (warm bronze glint on left foot)
        "..III.IIII.III..",  # y=30 crisp dark iron bottom outline (x=2..13, 12px wide!)
        "................",  # y=31 ground shadow row
    ]

    tok_map = {
        ".": None,
        "F": "F0",
        "1": "I1",
        "2": "I2",
        "c": "I2",
        "b": "I3",
        "a": "I4",
        "I": "I0",
        "3": "F3",
        "4": "F4",
        "5": "F5",
        "6": "F6",
        "7": "F7",
        "8": "F8",
        "9": "F9",
        "r": "F1",
        "o": "O1",
        "q": "O2",
        "R": "O3",
        "u": "O4",
        "p": "O5",
        "v": "O6",
        "g": "O7",
    }
    c.draw_rows(rows, tok_map)

    # Soft ground shadow (#4c557f@85) beneath and between the 3 tripod legs
    c.shadow_rect_if_empty(2, 29, 13, 31)
    c.shadow_rect_if_empty(1, 30, 14, 30)
    return c.im


# ============================================================================
# 5. stone_garden_lantern.png (16x32, slender, target opaque 10x29)
#    Traditional mossy stone sanctuary lantern (ref_beodeul_props_best_4x style):
#    - Carved lotus bud finial (y=2..4)
#    - Curved pagoda umbrella cap with upturned eaves, hip ridge & roof moss (y=5..9)
#    - Luminous 4px-wide warm golden fire-box window (#fff2a5 -> #fbc10d -> #f08a10)
#      casting soft warm bounce (#f4c5b2 / #d8aa73) onto stone lotus sill
#    - Carved lotus tray chudai + slender 4px stone post (2px stone + 1px dark
#      outlines) with central carved ring + mossy square pedestal base!
# ============================================================================
def build_stone_garden_lantern() -> Image.Image:
    c = Canvas(16, 32)

    rows = [
        # 0123456789ABCDEF
        "................",  # y=0
        "................",  # y=1
        ".......00.......",  # y=2  lotus jewel finial peak (x=7..8)
        "......0860......",  # y=3  sunlit lotus bud
        "......0520......",  # y=4  finial neck collar
        ".....078640.....",  # y=5  upper pagoda roof slope
        "....0N876530....",  # y=6  pagoda roof + sunlit green moss patch on left slope
        "...MJn7865420...",  # y=7  flared pagoda eaves (x=3..12, 10px wide!) + roof ridge
        "...0876654320...",  # y=8  upturned stone eave tips + crisp sunlit left rim
        "....021111d0....",  # y=9  deep cornice shadow under pagoda eaves
        ".....0gYFv0.....",  # y=10 firebox upper stone arch + warm golden window top
        ".....0YWWF0.....",  # y=11 luminous 4px golden firebox window (#fff2a5 cream core!)
        ".....0FWWo0.....",  # y=12 blazing sanctuary lantern heart
        ".....0aYFo0.....",  # y=13 warm rose-amber glow spill at window base
        "....08agv530....",  # y=14 carved lotus tray (chudai) top lip lit by warm flame!
        "....06544320....",  # y=15 carved lotus-petal molding
        ".....0211d0.....",  # y=16 undercut collar shadow
        "......0740......",  # y=17 slender 4px cylindrical stone post (2px inner stone!)
        "......0740......",  # y=18
        "......0630......",  # y=19
        "......0740......",  # y=20
        ".....087530.....",  # y=21 traditional carved stone nodal ring mid-shaft!
        "......0520......",  # y=22 ring cast shadow
        "......0740......",  # y=23 lower slender stone post
        "......0740......",  # y=24
        "......0630......",  # y=25
        ".....077640.....",  # y=26 stepped lotus foot collar
        "....08765430....",  # y=27 3/4 square pedestal lit top shelf
        "...MNJ6654320...",  # y=28 mossy square stone base (x=3..12)
        "...Mmn4543210...",  # y=29 carved stone foot + lush sanctuary moss cushion
        "...MM00000000...",  # y=30 crisp dark material bottom outline
        "................",  # y=31 ground shadow row
    ]

    tok_map = {
        ".": None,
        "0": "S0",
        "1": "S1",
        "2": "S2",
        "3": "S3",
        "4": "S4",
        "5": "S5",
        "6": "S6",
        "7": "S7",
        "8": "S8",
        "d": "D1",
        "M": "M0",
        "m": "M2",
        "n": "M3",
        "N": "M4",
        "J": "M5",
        "W": "F8",  # #fff2a5 cream core
        "Y": "F7",  # #fbc10d bright gold
        "F": "F5",  # #f08a10 warm orange
        "o": "F4",  # #df722f amber-orange
        "a": "FA",  # #f4c5b2 warm lantern glow bounce
        "e": "O6",  # #bd936b warm lit stone mullion
        "g": "O7",  # #d8aa73 warm golden sill bounce
        "v": "O5",  # #a67d55 warm sill mid
    }
    c.draw_rows(rows, tok_map)

    # Soft ground shadow (#4c557f@85) under pedestal
    c.shadow_rect_if_empty(2, 30, 13, 31)
    c.shadow_rect_if_empty(3, 29, 13, 29)
    return c.im


# ============================================================================
# Strict Gate Validator & Contact Sheet Builder
# ============================================================================
def verify_sprite(
    name: str,
    im: Image.Image,
    expected_size: tuple[int, int],
    camera: str,
    valid_hexes: set[str],
) -> dict:
    w, h = im.size
    assert (w, h) == expected_size, f"{name}: canvas {(w, h)} != {expected_size}"
    px = im.load()

    off_palette = []
    bad_alpha = []
    bright_edge = []
    non_dark_token_edge = []
    pure_black = 0
    opaque_pts = []
    shadow_pts = 0

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if a == 85:
                if (r, g, b, a) != SHADOW_RGBA:
                    bad_alpha.append((x, y, (r, g, b, a)))
                shadow_pts += 1
                continue
            if a != 255:
                bad_alpha.append((x, y, (r, g, b, a)))
                continue

            opaque_pts.append((x, y))
            hx = f"#{r:02x}{g:02x}{b:02x}"
            if (r, g, b) == (0, 0, 0):
                pure_black += 1
            if hx not in valid_hexes:
                off_palette.append((x, y, hx))

            # Check 4-connected outer boundary touching transparency / shadow / canvas edge
            touches_non_opaque = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if not (0 <= nx < w and 0 <= ny < h) or px[nx, ny][3] != 255:
                    touches_non_opaque = True
                    break
            if touches_non_opaque:
                lm = luma(r, g, b)
                if lm > 85.0:
                    bright_edge.append((x, y, hx, round(lm, 1)))
                if hx not in DARK_OUTLINE_HEXES:
                    non_dark_token_edge.append((x, y, hx, round(lm, 1)))

    assert not off_palette, f"{name}: off-palette pixels: {off_palette[:5]}"
    assert pure_black == 0, f"{name}: pure #000000 forbidden!"
    assert not bad_alpha, f"{name}: illegal alpha pixels: {bad_alpha[:5]}"
    assert not bright_edge, f"{name}: bright outer outline pixels (luma>85): {bright_edge[:5]}"
    assert not non_dark_token_edge, f"{name}: non-dark outer outline pixels: {non_dark_token_edge[:5]}"
    assert opaque_pts, f"{name}: empty sprite!"

    xs = [p[0] for p in opaque_pts]
    ys = [p[1] for p in opaque_pts]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    ow = max_x - min_x + 1
    oh = max_y - min_y + 1
    left_gap = min_x
    right_gap = (w - 1) - max_x
    bottom_gap = (h - 1) - max_y

    assert ow / w >= 0.45 and oh / h >= 0.65, f"{name}: undersized bbox {ow}x{oh} in {w}x{h}"
    assert abs(left_gap - right_gap) <= 2, f"{name}: uncentered left={left_gap} right={right_gap}"
    assert 1 <= bottom_gap <= 2, f"{name}: bottom_gap={bottom_gap} (expected 1..2)"

    return {
        "name": name,
        "camera": camera,
        "canvas": f"{w}x{h}",
        "opaque": f"{ow}x{oh}",
        "margins": f"L{left_gap}/R{right_gap}/B{bottom_gap}",
        "shadow_px": shadow_pts,
        "colors": len({f"#{px[x,y][0]:02x}{px[x,y][1]:02x}{px[x,y][2]:02x}" for x, y in opaque_pts}),
    }


def load_beodeul_char_1x() -> Image.Image:
    src = Image.open(CHAR_REF_4X).convert("RGBA")
    return src.resize((src.width // 4, src.height // 4), Image.Resampling.NEAREST)


def build_preview_sheet(
    items: list[tuple[str, str, Image.Image, dict]],
    char_1x: Image.Image,
    out_path: Path,
) -> None:
    """Render 2x + 1x on neutral #767670 next to Beodeul scale character,
    plus bottom 1x & 2x lineup strip directly alongside old neon-high for instant verification.
    """
    bg_gray = (0x76, 0x76, 0x70, 255)   # #767670 mandatory neutral gray
    header_bg = (0x5E, 0x5E, 0x58, 255)
    card_top = (0x68, 0x68, 0x62, 255)
    line_col = (0x8C, 0x8C, 0x84, 255)
    text_hi = (244, 244, 238, 255)
    text_lo = (214, 214, 206, 255)

    sheet_w = 960
    sheet_h = 430
    sheet = Image.new("RGBA", (sheet_w, sheet_h), bg_gray)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.Resampling.NEAREST)

    # Header bar
    draw.rectangle([0, 0, sheet_w - 1, 78], fill=header_bg)
    draw.line([(0, 78), (sheet_w - 1, 78)], fill=line_col)
    sheet.alpha_composite(char_2x, (16, 70 - char_2x.height))
    sheet.alpha_composite(char_1x, (16 + char_2x.width + 10, 70 - char_1x.height))

    draw.text(
        (106, 12),
        "FANTASY SKY RUINS (CARBON UPGRADE) - BATCH 2/4: ARCHITECTURE & LIGHTS",
        fill=text_hi,
        font=font,
    )
    draw.text(
        (106, 31),
        f"74-color Beodeul Ruins Palette Locked | Shadow #4c557f@85 | 1px Dark Material Outlines | Scale Ref: Beodeul {char_1x.width}x{char_1x.height} (1x) & {char_2x.width}x{char_2x.height} (2x)",
        fill=text_lo,
        font=font,
    )
    draw.text(
        (106, 50),
        "Top Cards: [Beodeul 2x | Carbon 2x | Carbon 1x] on #767670   |   Bottom Strip: Native 1x Lineup + 2x Carbon vs Old Neon-High",
        fill=text_lo,
        font=font,
    )

    # 5 Individual Inspection Cards (2x + 1x next to Beodeul char on #767670)
    pad = 12
    card_w = (sheet_w - pad * 6) // 5  # 161px
    card_h = 166
    y0 = 92

    for idx, (fname, cam, im1, stats) in enumerate(items):
        x0 = pad + idx * (card_w + pad)
        draw.rectangle([x0, y0, x0 + card_w - 1, y0 + card_h - 1], fill=bg_gray, outline=line_col)
        draw.rectangle([x0 + 1, y0 + 1, x0 + card_w - 2, y0 + 22], fill=card_top)

        short = fname.replace(".png", "")
        draw.text((x0 + 5, y0 + 6), short[:24], fill=text_hi, font=font)

        im2 = im1.resize((im1.width * 2, im1.height * 2), Image.Resampling.NEAREST)
        base_y = y0 + card_h - 32

        # Layout inside card: [Char 2x]  [Sprite 2x]  [Sprite 1x]
        total_w = char_2x.width + 8 + im2.width + 10 + im1.width
        sx = x0 + max(4, (card_w - total_w) // 2)
        sheet.alpha_composite(char_2x, (sx, base_y - char_2x.height))
        sheet.alpha_composite(im2, (sx + char_2x.width + 8, base_y - im2.height))
        sheet.alpha_composite(im1, (sx + char_2x.width + 8 + im2.width + 10, base_y - im1.height))

        draw.text(
            (x0 + 5, y0 + card_h - 26),
            f"{stats['canvas']} op:{stats['opaque']} {cam}",
            fill=text_lo,
            font=font,
        )
        draw.text(
            (x0 + 5, y0 + card_h - 13),
            f"{stats['colors']} cols | sh:{stats['shadow_px']}px",
            fill=text_lo,
            font=font,
        )

    # Bottom Side-by-Side Strip (y=272..418): Left = Clean Native 1x + 2x Lineup on #767670; Right = Carbon 2x vs Old Neon 2x
    strip_y = 272
    strip_h = 146
    left_w = 420
    draw.rectangle([pad, strip_y, pad + left_w - 1, strip_y + strip_h - 1], fill=bg_gray, outline=line_col)
    draw.rectangle([pad + 1, strip_y + 1, pad + left_w - 2, strip_y + 21], fill=card_top)
    draw.text((pad + 8, strip_y + 5), "NATIVE 1x & 2x SCALE LINEUP ON #767670 (WITH BEODEUL HERO)", fill=text_hi, font=font)

    # 1x lineup
    lx = pad + 14
    ly_base = strip_y + 72
    sheet.alpha_composite(char_1x, (lx, ly_base - char_1x.height))
    lx += char_1x.width + 10
    for _fname, _cam, im1, _st in items:
        sheet.alpha_composite(im1, (lx, ly_base - im1.height))
        lx += im1.width + 10

    # 2x lineup right beside 1x
    lx2 = pad + 185
    ly2_base = strip_y + 136
    sheet.alpha_composite(char_2x, (lx2, ly2_base - char_2x.height))
    lx2 += char_2x.width + 8
    for _fname, _cam, im1, _st in items:
        im2 = im1.resize((im1.width * 2, im1.height * 2), Image.Resampling.NEAREST)
        sheet.alpha_composite(im2, (lx2, ly2_base - im2.height))
        lx2 += im2.width + 6

    # Right box: Old Neon-High 2x vs New Carbon 2x direct visual upgrade proof
    rx0 = pad + left_w + pad
    rw = sheet_w - rx0 - pad
    draw.rectangle([rx0, strip_y, rx0 + rw - 1, strip_y + strip_h - 1], fill=bg_gray, outline=line_col)
    draw.rectangle([rx0 + 1, strip_y + 1, rx0 + rw - 2, strip_y + 21], fill=card_top)
    draw.text((rx0 + 8, strip_y + 5), "UPGRADE COMPARISON (LEFT: OLD NEON-HIGH 2x -> RIGHT: NEW CARBON 2x)", fill=text_hi, font=font)

    cx_pos = rx0 + 14
    cy_base = strip_y + 134
    for fname, _cam, im1, _st in items:
        old_p = OLD_RUINS_DIR / "objects" / fname
        if old_p.exists():
            old_im = Image.open(old_p).convert("RGBA")
            old_2x = old_im.resize((old_im.width * 2, old_im.height * 2), Image.Resampling.NEAREST)
            sheet.alpha_composite(old_2x, (cx_pos, cy_base - old_2x.height))
            cx_pos += old_2x.width + 2
        im2 = im1.resize((im1.width * 2, im1.height * 2), Image.Resampling.NEAREST)
        sheet.alpha_composite(im2, (cx_pos, cy_base - im2.height))
        cx_pos += im2.width + 12

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)


def main() -> None:
    pal_data = json.loads(PALETTE_JSON.read_text(encoding="utf-8"))
    valid_hexes = {h.lower() for h in pal_data["colors"]}
    assert len(valid_hexes) == 74, f"Expected 74 locked colors, got {len(valid_hexes)}"
    assert "#000000" not in valid_hexes

    # Verify every token in P belongs to palette_beodeul_ruins.json
    for tk, hx in P.items():
        assert hx.lower() in valid_hexes, f"Token {tk}={hx} is NOT in palette_beodeul_ruins.json!"

    OBJ_DIR.mkdir(parents=True, exist_ok=True)

    specs = [
        ("stone_pillar_intact.png", (16, 32), "standing", build_stone_pillar_intact),
        ("stone_pillar_broken.png", (16, 32), "standing", build_stone_pillar_broken),
        ("mossy_stone_well.png",    (32, 32), "standing", build_mossy_stone_well),
        ("iron_brazier_lit.png",    (16, 32), "standing", build_iron_brazier_lit),
        ("stone_garden_lantern.png",(16, 32), "slender",  build_stone_garden_lantern),
    ]

    built_items: list[tuple[str, str, Image.Image, dict]] = []
    print("=== T2 RUINS BATCH 2/4 (ARCHITECTURE & LIGHTS) GATE CHECK ===")
    for fname, expected_sz, cam, builder in specs:
        im = builder()
        stats = verify_sprite(fname, im, expected_sz, cam, valid_hexes)
        out_file = OBJ_DIR / fname
        im.save(out_file)
        built_items.append((fname, cam, im, stats))
        print(
            f"  PASS  {fname:26s} canvas={stats['canvas']:6s} "
            f"opaque={stats['opaque']:6s} margins={stats['margins']:10s} "
            f"colors={stats['colors']:2d} shadow={stats['shadow_px']:3d}px"
        )

    char_1x = load_beodeul_char_1x()
    build_preview_sheet(built_items, char_1x, PREVIEW_PNG)
    print(f"Saved preview contact sheet -> {PREVIEW_PNG}")
    print("ALL 5 SPRITES PASSED 100% PALETTE / ALPHA / DARK-OUTLINE / CAMERA GATES!")


if __name__ == "__main__":
    main()
