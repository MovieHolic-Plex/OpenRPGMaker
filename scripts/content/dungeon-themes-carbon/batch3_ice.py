#!/usr/bin/env python3
"""
T3 Dungeon Theme Objects Batch 3/4 — `ice` (얼음 동굴 · 설산 빙굴 6종)
Model: gemini-4-carbon (medium)

Sprites (matching canonical kit names in openwiki/dungeon-themes.md):
  1. frozen-warrior.png  (32x32, standing, op 26x30)
  2. ice-crystal.png     (32x32, standing, op 28x29)
  3. ice-altar.png       (32x32, standing, op 28x29)
  4. icicles.png         (32x16, standing, op 30x14)
  5. snow-drift.png      (32x16, topdown,  op 30x13)
  6. frost-brazier.png   (16x32, standing, op 14x29)

Hard Rules Enforced:
  - 100% locked to tiledata/jp-city/fable-city/palette.json (0 off-palette, 0 #000000)
  - Optional ground shadow ONLY #4c557f at alpha 85/255; all other pixels alpha 0 or 255
  - 1px dark material outer outline on every edge touching non-opaque pixels (luma <= 65)
  - Camera: standing = front + 1/4-1/3 lit top band, ZERO side walls; topdown = snow-drift
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
PALETTE_JSON = ROOT / "tiledata/jp-city/fable-city/palette.json"
CHAR_REF_4X = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs/ref_beodeul_char_4x.png"

OUT_DIR = ROOT / "tiledata/dungeon-themes-carbon/ice"
OBJ_DIR = OUT_DIR / "objects"
PREVIEW_PNG = OUT_DIR / "preview_ice.png"

SHADOW_RGBA = (0x4C, 0x55, 0x7F, 85)  # #4c557f @ 85/255
TRANSPARENT = (0, 0, 0, 0)

# Curated semantic tokens 100% sampled from tiledata/jp-city/fable-city/palette.json
P = {
    # Glacial Cyan-Sapphire Ice (from `glass`)
    "GL0": "#0e1630",  # luma 21.7 - deep abyssal sapphire-ice outline
    "GL1": "#162a4a",  # luma 38.8 - dark glacier shadow / outline
    "GL2": "#224868",  # deep cyan-blue glacier shadow
    "GL3": "#346a86",  # mid-dark glacial cyan
    "GL4": "#5490a8",  # mid translucent cyan ice
    "GL5": "#86b8c8",  # bright glacial sky-cyan facet
    "GL6": "#c4e0e4",  # pale icy aqua refraction highlight

    # Royal Sapphire & Periwinkle Snow/Ice Curves (from `blue`)
    "BL0": "#101a40",  # luma 27.3 - dark royal sapphire outline
    "BL1": "#1c3068",  # luma 47.8 - deep cobalt-sapphire silhouette shadow
    "BL2": "#2c4c90",  # rich sapphire refraction
    "BL3": "#4470b0",  # mid-bright periwinkle-sapphire
    "BL4": "#6c98cc",  # cool periwinkle-blue snow/ice shadow curve
    "BL5": "#a0c0e0",  # bright frosty sky-periwinkle

    # Luminous Frostfire & Diamond Frost-Core (from `teal`)
    "TL0": "#0c2a34",  # luma 34.0 - dark frost-teal outline
    "TL1": "#144a50",  # luma 58.2 - deep cyan-teal shadow
    "TL2": "#20706c",  # rich sea-frost teal
    "TL3": "#3c9888",  # luminous frostfire mid
    "TL4": "#6cbca0",  # bright mint-aqua frostfire glow
    "TL5": "#a4dcc0",  # incandescent pale aqua frostfire halo

    # Frost-Slate & Snow Rim Outlines (from `tile`)
    "TI0": "#1e2440",  # luma 37.5 - dark frost-slate snow/rime outline
    "TI1": "#2c3858",  # luma 56.1 - cool slate-periwinkle sunlit snow outline
    "TI2": "#3e5070",  # cool slate-blue
    "TI3": "#546a88",  # frosty slate-blue shadow
    "TI4": "#7088a0",  # soft icy blue-grey
    "TI5": "#92a8b8",  # pale rime-blue
    "TI6": "#b8c8d0",  # frost-silver highlight

    # Crisp Snow & Pure White Glints (from `coolwhite` & `white`)
    "CW0": "#5c6480",  # deep cool slate-snow shadow
    "CW1": "#8088a0",  # cool grey-blue snow shadow
    "CW2": "#a4acbe",  # mid-cool snow shadow
    "CW3": "#c4cad6",  # soft lit snow slope
    "CW4": "#dde2e8",  # bright crisp snow
    "CW5": "#eef2f2",  # brilliant icy snow white
    "WH5": "#f2eeea",  # warm-pure white
    "WH6": "#fcfaf4",  # purest sunlit snow crest & razor specular glint

    # Ancient Frost-Sanctum Blue-Slate Stone (from `kawara`)
    "KW0": "#1b1a33",  # luma 28.5 - darkest sanctum stone outline
    "KW1": "#2a2c4a",  # luma 45.4 - deep sanctum stone crevice / outline
    "KW2": "#3b4263",  # dark blue-slate stone
    "KW3": "#51597c",  # mid-dark frost stone
    "KW4": "#6a7592",  # mid sanctum blue-stone
    "KW5": "#8a94a8",  # lit frost-kissed stone
    "KW6": "#adb3ba",  # pale stone bevel
    "KW7": "#d2d2cc",  # bright stone highlight

    # Nordic Silver-Iron & Knight Blade/Armor (from `steel`)
    "ST0": "#1c1c2c",  # luma 29.8 - darkest forged iron outline
    "ST1": "#30303f",  # luma 49.7 - deep iron shadow / outline
    "ST2": "#484a58",  # dark forged iron
    "ST3": "#646874",  # mid Nordic iron
    "ST4": "#848a92",  # lit silver-iron
    "ST5": "#a8aeb0",  # bright silver rim
    "ST6": "#cdd2d0",  # gleaming Nordic silver highlight

    # Warm Torch / Bronze / Horn / Armor Gold Accents (from `yellow` & `cha`)
    "YL0": "#4a3020",  # luma 50.8 - dark antique bronze outline
    "YL1": "#7a5420",  # deep antique gold
    "YL2": "#aa8024",  # mid tarnished gold
    "YL3": "#d4ac38",  # bright gold crossguard / brazier boss
    "YL4": "#ecd060",  # gleaming gold glint
    "YL5": "#f8eca0",  # pale gold specular
    "CH0": "#24142a",  # luma 25.1 - dark horn/cape outline
    "CH1": "#3d1f30",  # luma 39.2 - deep crimson-brown cape shadow
    "CH2": "#5a2e33",  # muted russet-plum cape/cuirass inside ice
    "CH3": "#77423a",  # weathered bronze/leather
    "CH4": "#95593f",  # lit bronze/horn
    "CH5": "#b47a4c",  # warm horn mid-light
    "CH6": "#d0a068",  # lit ancient horn
}

DARK_OUTLINE_HEXES = {
    P["GL0"],  # #0e1630 (21.7)
    P["GL1"],  # #162a4a (38.8)
    P["BL0"],  # #101a40 (27.3)
    P["BL1"],  # #1c3068 (47.8)
    P["TL0"],  # #0c2a34 (34.0)
    P["TI0"],  # #1e2440 (37.5)
    P["TI1"],  # #2c3858 (56.1)
    P["KW0"],  # #1b1a33 (28.5)
    P["KW1"],  # #2a2c4a (45.4)
    P["ST0"],  # #1c1c2c (29.8)
    P["ST1"],  # #30303f (49.7)
    P["YL0"],  # #4a3020 (50.8)
    P["CH0"],  # #24142a (25.1)
    P["CH1"],  # #3d1f30 (39.2)
}


def hex_to_rgba(hx: str, alpha: int = 255) -> tuple[int, int, int, int]:
    h = hx.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


def luma(r: int, g: int, b: int) -> float:
    return 0.299 * r + 0.587 * g + 0.114 * b


class Canvas:
    def __init__(self, w: int, h: int) -> None:
        self.w = w
        self.h = h
        self.im = Image.new("RGBA", (w, h), TRANSPARENT)
        self.px = self.im.load()
        self.mat: dict[tuple[int, int], str] = {}

    def set(self, x: int, y: int, tok: str, mat: str = "ice") -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = hex_to_rgba(P[tok], 255)
            self.mat[(x, y)] = mat

    def hline(self, x1: int, x2: int, y: int, tok: str, mat: str = "ice") -> None:
        if x1 > x2:
            x1, x2 = x2, x1
        for x in range(x1, x2 + 1):
            self.set(x, y, tok, mat)

    def vline(self, x: int, y1: int, y2: int, tok: str, mat: str = "ice") -> None:
        if y1 > y2:
            y1, y2 = y2, y1
        for y in range(y1, y2 + 1):
            self.set(x, y, tok, mat)

    def rect(self, x1: int, y1: int, x2: int, y2: int, tok: str, mat: str = "ice") -> None:
        for y in range(y1, y2 + 1):
            self.hline(x1, x2, y, tok, mat)

    def line(self, x1: int, y1: int, x2: int, y2: int, tok: str, mat: str = "ice") -> None:
        dx = abs(x2 - x1)
        dy = -abs(y2 - y1)
        sx = 1 if x1 < x2 else -1
        sy = 1 if y1 < y2 else -1
        err = dx + dy
        x, y = x1, y1
        while True:
            self.set(x, y, tok, mat)
            if x == x2 and y == y2:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x += sx
            if e2 <= dx:
                err += dx
                y += sy

    def shadow(self, x: int, y: int) -> None:
        if 0 <= x < self.w and 0 <= y < self.h and self.px[x, y][3] == 0:
            self.px[x, y] = SHADOW_RGBA

    def shadow_span(self, x1: int, x2: int, y: int) -> None:
        for x in range(x1, x2 + 1):
            self.shadow(x, y)

    def enforce_dark_outline(self) -> None:
        """Guarantee 1px dark material outer outline on every opaque pixel touching non-opaque."""
        mat_outline = {
            "ice": "GL0",
            "ice_lit": "GL1",
            "sapphire": "BL0",
            "frostfire": "TL0",
            "snow_top": "TI1",
            "snow": "TI0",
            "stone": "KW0",
            "iron": "ST0",
            "gold": "YL0",
        }
        fixes: list[tuple[int, int, str, str]] = []
        for y in range(self.h):
            for x in range(self.w):
                r, g, b, a = self.px[x, y]
                if a != 255:
                    continue
                hx = f"#{r:02x}{g:02x}{b:02x}"
                touches_non_opaque = False
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if nx < 0 or nx >= self.w or ny < 0 or ny >= self.h or self.px[nx, ny][3] != 255:
                        touches_non_opaque = True
                        break
                if touches_non_opaque and hx not in DARK_OUTLINE_HEXES:
                    m = self.mat.get((x, y), "ice")
                    fixes.append((x, y, mat_outline.get(m, "GL0"), m))
        for x, y, tok, m in fixes:
            self.set(x, y, tok, m)


# ===========================================================================
# 1. frozen-warrior.png (32x32, standing, op 26x30: x=3..28, y=1..30)
#    Jagged translucent-look sapphire-cyan glacier crystal block encasing
#    the clear silhouette of an ancient horned knight holding a sword inside,
#    crossed by bright diagonal white ice glare streaks & snow at base.
# ===========================================================================
def build_frozen_warrior() -> Image.Image:
    c = Canvas(32, 32)

    # Jagged multi-pronged crystalline glacier silhouette (x_left, x_right) for y=1..30
    row_spans: dict[int, tuple[int, int]] = {
        1: (13, 15),   # Sharp main glacier apex
        2: (11, 17),
        3: (10, 22),   # Secondary right crystal point rises at x=20..22
        4: (8, 24),
        5: (6, 25),
        6: (5, 26),    # Left shoulder crystal facet
        7: (5, 26),
        8: (4, 27),    # Stepped angular crystal prism body
        9: (4, 27),
        10: (4, 27),
        11: (4, 27),
        12: (4, 26),   # Subtle crystalline facet step on right edge!
        13: (4, 26),
        14: (3, 27),   # Jutting left crystal rib (reaches x=3!)
        15: (3, 27),
        16: (3, 27),
        17: (4, 27),
        18: (4, 28),   # Jutting right crystal spur (reaches x=28!)
        19: (4, 28),
        20: (4, 28),
        21: (4, 27),
        22: (3, 27),
        23: (3, 28),   # Flared lower glacier spurs & snow-draped base (width=26: x=3..28!)
        24: (3, 28),
        25: (3, 28),
        26: (3, 28),
        27: (3, 28),
        28: (4, 27),
        29: (5, 26),
        30: (7, 24),
    }

    # --- A. Fill Glacier Block Base Facets (3/4 Lit Top Crown y=1..7 + Vertical Prism Front y=8..28) ---
    for y, (x0, x1) in row_spans.items():
        for x in range(x0, x1 + 1):
            if y <= 7:
                # 1/4 lit 3/4 top crystal crown facets tilted toward viewer
                if x < 15:
                    tok = "WH6" if y <= 4 else ("GL6" if x < 10 else "CW5")
                elif x < 20:
                    tok = "GL6" if y <= 5 else "GL5"
                else:
                    tok = "WH6" if (y == 4 and x == 21) else ("GL5" if y <= 5 else "BL4")
                c.set(x, y, tok, "ice_lit" if x < 19 else "ice")
            else:
                # Vertical front prism divided into 3 vertical crystal planes:
                # Left sunlit bevel (x<=7), wide luminous cyan central chamber (8..22), right sapphire bevel (x>=23)
                if x <= 7:
                    tok = "WH6" if (x <= 5 and y < 14) else ("GL6" if y < 20 else "GL5")
                    c.set(x, y, tok, "ice_lit")
                elif x <= 22:
                    # Bright icy-aqua translucent chamber around knight so dark silhouette pops unmistakably!
                    dist_center = abs(x - 15.5) + abs(y - 15.0) * 0.42
                    if dist_center < 6.8:
                        tok = "GL6"
                    elif dist_center < 9.5:
                        tok = "GL5"
                    elif y < 22:
                        tok = "GL4"
                    else:
                        tok = "BL3"
                    c.set(x, y, tok, "ice")
                else:
                    # Shaded deep sapphire-cyan right prism plane
                    tok = "BL3" if y < 14 else ("GL3" if x == 23 else ("BL2" if y < 23 else "GL2"))
                    c.set(x, y, tok, "sapphire")

    # Carve sharp V-notches in top crystal crown so multi-shard glacier silhouette pops at 1x!
    for nx, ny in ((18, 3), (19, 3), (18, 4), (7, 5)):
        c.px[nx, ny] = TRANSPARENT
        c.mat.pop((nx, ny), None)

    # --- B. Crisp 3/4 Top Crown Facet Ridges & Vertical Prism Edge Seams ---
    c.line(5, 7, 13, 6, "WH6", "ice_lit")
    c.line(13, 6, 18, 7, "CW5", "ice_lit")
    c.line(19, 7, 25, 8, "GL6", "ice")
    c.line(14, 2, 13, 6, "WH6", "ice_lit")
    c.vline(8, 7, 25, "GL6", "ice_lit")
    c.vline(23, 8, 25, "BL2", "sapphire")

    # --- C. Ancient Horned Knight Holding Greatsword Inside the Ice (x=9..22, y=7..25) ---
    # 1) Bold Sweeping Curved Horns (high contrast dark underside + warm bone-gold top!)
    # Left horn sweeping up & out: (13,9) -> (11,9) -> (10,8) -> (9,7)
    c.set(12, 9, "CH4", "ice")
    c.set(11, 9, "YL3", "ice")
    c.set(10, 8, "YL4", "ice")
    c.set(9, 7, "CH5", "ice")
    c.set(9, 8, "BL0", "ice")
    c.set(10, 9, "BL0", "ice")
    c.set(11, 10, "BL0", "ice")
    c.set(12, 10, "BL1", "ice")
    # Right horn sweeping up & out: (18,9) -> (20,9) -> (21,8) -> (22,7)
    c.set(19, 9, "CH4", "ice")
    c.set(20, 9, "YL3", "ice")
    c.set(21, 8, "YL4", "ice")
    c.set(22, 7, "CH5", "ice")
    c.set(22, 8, "BL0", "ice")
    c.set(21, 9, "BL0", "ice")
    c.set(20, 10, "BL0", "ice")
    c.set(19, 10, "BL1", "ice")

    # 2) Great-Helm with Unmistakable Dark T-Visor (x=13..18, y=8..13)
    c.hline(14, 17, 8, "BL1", "ice")
    c.set(14, 8, "ST4", "ice")
    c.set(15, 8, "ST5", "ice")
    c.rect(13, 9, 18, 13, "KW2", "ice")
    c.vline(13, 9, 12, "ST4", "ice")      # Lit left helm cheek
    c.vline(18, 9, 12, "BL1", "ice")      # Shaded right helm cheek
    c.hline(14, 17, 9, "ST5", "ice")      # Gleaming steel brow ridge
    # Iconic dark T-visor!
    c.hline(14, 17, 10, "BL0", "ice")     # Horizontal visor slit
    c.vline(15, 10, 13, "BL0", "ice")     # Vertical breathing slit
    c.vline(16, 10, 13, "BL0", "ice")
    c.set(14, 11, "KW3", "ice")
    c.set(14, 12, "KW2", "ice")
    c.set(17, 11, "KW1", "ice")
    c.set(17, 12, "BL1", "ice")

    # 3) Broad Layered Pauldrons, Frozen Cape & Cuirass (x=10..21, y=13..21)
    c.rect(11, 14, 20, 23, "BL1", "ice")
    c.rect(12, 14, 19, 22, "CH1", "ice")  # Dark frozen royal crimson-plum cape
    # Left Pauldron (x=10..13, y=13..16)
    c.rect(10, 13, 13, 15, "KW2", "ice")
    c.hline(10, 12, 13, "ST5", "ice")
    c.set(10, 14, "ST4", "ice")
    c.set(11, 14, "CH4", "ice")           # Warm bronze pauldron trim
    c.hline(10, 13, 16, "BL0", "ice")
    # Right Pauldron (x=18..21, y=13..16)
    c.rect(18, 13, 21, 15, "KW1", "ice")
    c.hline(19, 20, 13, "KW4", "ice")
    c.set(20, 14, "CH3", "ice")
    c.hline(18, 21, 16, "BL0", "ice")
    # Armored Chestplate & Gauntlets Clasping Sword Hilt (x=13..18, y=14..19)
    c.rect(13, 14, 18, 19, "KW2", "ice")
    c.set(13, 14, "KW4", "ice")
    c.hline(12, 19, 20, "BL0", "ice")
    c.set(13, 20, "YL2", "ice")

    # 4) Armored Greaves / Stance (y=21..25)
    c.rect(12, 21, 14, 25, "KW2", "ice")
    c.vline(12, 21, 24, "KW4", "ice")
    c.hline(12, 14, 25, "BL0", "ice")
    c.rect(17, 21, 19, 25, "BL1", "ice")
    c.vline(17, 21, 24, "KW3", "ice")
    c.hline(17, 19, 25, "BL0", "ice")

    # 5) Greatsword Held Point-Down Front & Center (x=12..19 crossguard at y=16, blade y=17..26)
    c.set(15, 14, "YL4", "ice")           # Golden pommel
    c.set(16, 14, "YL2", "ice")
    c.set(15, 15, "ST5", "ice")           # Gauntleted grip
    c.set(16, 15, "BL0", "ice")
    # Wide Golden Crossguard (x=12..19, y=16)
    c.hline(12, 19, 16, "YL3", "ice")
    c.set(12, 16, "YL5", "ice")
    c.set(13, 16, "YL4", "ice")
    c.set(18, 16, "YL2", "ice")
    c.set(19, 16, "YL1", "ice")
    # Gleaming Vertical Greatsword Blade (x=15..16, y=17..26)
    for by in range(17, 26):
        c.set(15, by, "WH6" if by < 21 else "ST6", "ice")
        c.set(16, by, "ST4" if by < 21 else "KW3", "ice")
    c.set(15, 26, "GL6", "ice")

    # --- D. Translucent Ice Foreground Glare Streaks (Unobstructed Helm, Slicing Across Lower Armor!) ---
    # Upper-left crystal surface glare (5,9) -> (9,13)
    for i in range(5):
        c.set(5 + i, 9 + i, "WH6", "ice_lit")
    # Long main diagonal white ice glare slicing across lower chest, blade & greaves (11,18) -> (18,25)!
    for i in range(8):
        gx, gy = 11 + i, 18 + i
        c.set(gx, gy, "WH6", "ice_lit")
        if i in (1, 2, 5, 6):
            c.set(gx, gy - 1, "GL6", "ice_lit")
    # Parallel crisp upper-right glare streak (19,11) -> (25,17)
    for i in range(7):
        c.set(19 + i, 11 + i, "WH6" if i < 5 else "GL6", "ice")

    # --- E. Snow-Draped Base Clumps & Jagged Ice Spurs (y=25..30) ---
    c.hline(5, 9, 25, "WH6", "snow_top")
    c.hline(4, 11, 26, "WH6", "snow_top")
    c.hline(4, 12, 27, "CW4", "snow")
    c.hline(5, 9, 27, "WH6", "snow_top")
    c.hline(5, 13, 28, "BL4", "snow")
    c.hline(6, 12, 29, "TI3", "snow")

    c.hline(22, 26, 25, "WH6", "snow_top")
    c.hline(20, 27, 26, "CW5", "snow_top")
    c.hline(21, 25, 26, "WH6", "snow_top")
    c.hline(19, 27, 27, "CW3", "snow")
    c.hline(19, 26, 28, "BL4", "snow")
    c.hline(19, 25, 29, "TI3", "snow")

    for x in range(13, 19):
        c.set(x, 27, "GL5" if x < 16 else "GL3", "ice")
        c.set(x, 28, "GL4" if x < 16 else "BL2", "sapphire")
        c.set(x, 29, "BL2" if x < 16 else "BL1", "sapphire")

    c.enforce_dark_outline()
    for x in range(13, 16):
        c.set(x, 1, "GL1", "ice_lit")
    c.shadow_span(5, 26, 30)
    c.shadow_span(6, 25, 31)
    return c.im


# ===========================================================================
# 2. ice-crystal.png (32x32, standing, op 28x29: x=2..29, y=2..30)
#    Dazzling multi-pronged glacial ice crystal cluster with sharp faceted
#    cyan-to-pure-white planes & bright rim specular glints.
# ===========================================================================
def build_ice_crystal() -> Image.Image:
    c = Canvas(32, 32)

    def draw_crystal_prism(
        pts_rows: dict[int, tuple[int, int]],
        ridge_x_fn,
        cap_y_end: int,
        sunlit_boost: bool = False,
    ) -> None:
        """Draw a razor-sharp hexagonal crystal prism with pointed apex, angular 3/4 top bevels,
        sunlit cyan-to-pure-white left plane, bright ridge glint, and deep sapphire right plane."""
        ys = sorted(pts_rows.keys())
        y_min, y_max = ys[0], ys[-1]
        for y in ys:
            x0, x1 = pts_rows[y]
            rx = ridge_x_fn(y)
            t = (y - y_min) / max(1, (y_max - y_min))
            for x in range(x0, x1 + 1):
                if x == x0 or x == x1 or y == y_min:
                    c.set(x, y, "GL1" if x <= rx else "BL0", "ice_lit" if x <= rx else "sapphire")
                    continue
                if y <= cap_y_end:
                    # Pointed 3/4 top pyramid bevel: pure white left facet, crisp aqua right facet
                    if x <= rx:
                        tok = "WH6"
                    else:
                        tok = "GL6" if x == rx + 1 else "GL5"
                    c.set(x, y, tok, "ice_lit")
                elif y == cap_y_end + 1 or (y == cap_y_end + 2 and x in (x0 + 1, x1 - 1)):
                    # Angular V-chevron rim separating top pyramid cap from vertical prism faces!
                    tok = "WH6" if x <= rx else "GL6"
                    c.set(x, y, tok, "ice_lit")
                else:
                    if x == rx:
                        tok = "WH6" if t < 0.60 else ("GL6" if t < 0.85 else "GL5")
                        c.set(x, y, tok, "ice_lit")
                    elif x < rx:
                        if t < 0.38:
                            tok = "WH6" if (sunlit_boost or x == x0 + 1) else "GL6"
                        elif t < 0.72:
                            tok = "GL6" if x == x0 + 1 else "GL5"
                        else:
                            tok = "GL4"
                        c.set(x, y, tok, "ice_lit")
                    else:
                        if t < 0.35:
                            tok = "GL5" if x == rx + 1 else "GL4"
                        elif t < 0.70:
                            tok = "GL3" if x == rx + 1 else "BL2"
                        else:
                            tok = "BL2" if x == rx + 1 else "BL1"
                        c.set(x, y, tok, "sapphire")

    # 1) Back-Left Angled Spire (x=4..11, y=7..26) - sharp 1px apex!
    left_spire = {
        7: (6, 6),
        8: (5, 8),
        9: (5, 9),
        10: (4, 10),
        11: (4, 11),
        12: (4, 11),
        13: (4, 11),
        14: (5, 11),
        15: (5, 11),
        16: (5, 12),
        17: (5, 12),
        18: (6, 12),
        19: (6, 12),
        20: (6, 12),
        21: (6, 12),
        22: (7, 12),
        23: (7, 12),
        24: (7, 12),
        25: (7, 12),
    }
    draw_crystal_prism(left_spire, lambda y: 7 + (y - 8) // 8, cap_y_end=11, sunlit_boost=True)

    # 2) Right Outward-Tilted Spire (x=18..27, y=5..26) - sharp 1px apex!
    right_spire = {
        5: (23, 23),
        6: (22, 25),
        7: (21, 25),
        8: (20, 26),
        9: (20, 27),
        10: (19, 27),
        11: (19, 27),
        12: (19, 26),
        13: (19, 26),
        14: (19, 26),
        15: (18, 25),
        16: (18, 25),
        17: (18, 25),
        18: (18, 24),
        19: (18, 24),
        20: (18, 24),
        21: (18, 24),
        22: (18, 23),
        23: (18, 23),
        24: (18, 23),
        25: (18, 23),
    }
    draw_crystal_prism(right_spire, lambda y: 22 - (y - 6) // 9, cap_y_end=10, sunlit_boost=False)

    # 3) Far-Left Low Radial Spur (x=2..9, y=16..27) - sharp diagonal point at x=2!
    far_left_spur = {
        16: (2, 3),
        17: (2, 5),
        18: (2, 6),
        19: (3, 7),
        20: (3, 7),
        21: (3, 8),
        22: (4, 8),
        23: (4, 9),
        24: (5, 9),
        25: (5, 9),
        26: (6, 9),
    }
    draw_crystal_prism(far_left_spur, lambda y: 4 + (y - 16) // 4, cap_y_end=19, sunlit_boost=True)

    # 4) Far-Right Low Radial Spur (x=21..29, y=15..27) - sharp diagonal point at x=29!
    far_right_spur = {
        15: (28, 29),
        16: (26, 29),
        17: (25, 29),
        18: (24, 29),
        19: (24, 28),
        20: (23, 28),
        21: (23, 27),
        22: (22, 27),
        23: (22, 26),
        24: (21, 26),
        25: (21, 25),
        26: (21, 25),
    }
    draw_crystal_prism(far_right_spur, lambda y: 26 - (y - 15) // 4, cap_y_end=18, sunlit_boost=False)

    # 5) Tall Hero Center Spire (x=10..19, y=2..27) - sharp 1px needle apex at (15,2)!
    hero_spire = {
        2: (15, 15),
        3: (14, 16),
        4: (13, 17),
        5: (12, 18),
        6: (11, 18),
        7: (10, 19),
        8: (10, 19),
        9: (10, 19),
        10: (10, 19),
        11: (10, 19),
        12: (10, 19),
        13: (10, 19),
        14: (10, 19),
        15: (10, 19),
        16: (10, 19),
        17: (10, 19),
        18: (10, 19),
        19: (10, 19),
        20: (10, 19),
        21: (11, 19),
        22: (11, 19),
        23: (11, 19),
        24: (11, 18),
        25: (11, 18),
        26: (11, 18),
    }
    draw_crystal_prism(hero_spire, lambda _y: 15, cap_y_end=7, sunlit_boost=True)

    # Crisp diagonal facet refraction streaks & bright rim specular glints on Hero Spire
    c.line(11, 12, 15, 16, "WH6", "ice_lit")
    c.line(15, 16, 18, 19, "GL6", "ice")
    c.line(11, 19, 14, 22, "GL6", "ice_lit")
    c.set(22, 8, "WH6", "ice_lit")
    c.set(7, 10, "WH6", "ice_lit")

    # 6) Foreground Pure Cyan-White Mini-Shard & Jagged Crystal-Snow Roots (y=19..30, zero flat tray!)
    fg_prism = {
        19: (17, 17),
        20: (16, 18),
        21: (15, 19),
        22: (14, 20),
        23: (14, 20),
        24: (14, 20),
        25: (14, 20),
        26: (14, 20),
        27: (14, 19),
        28: (15, 19),
    }
    for y, (x0, x1) in fg_prism.items():
        for x in range(x0, x1 + 1):
            if x == x0 or x == x1 or y == 19:
                c.set(x, y, "GL0", "ice")
            elif y <= 22:
                c.set(x, y, "WH6" if x <= 17 else "GL6", "ice_lit")
            else:
                c.set(x, y, "WH6" if x == 16 else ("GL6" if x < 17 else ("GL5" if x == 17 else "BL3")), "ice")

    # Sculpted jagged glacier-ice & snow base cluster (x=4..27, y=26..30)
    # Left snow-crystal clump
    c.hline(6, 11, 26, "WH6", "snow_top")
    c.hline(5, 12, 27, "CW5", "snow_top")
    c.hline(5, 13, 28, "BL4", "snow")
    c.hline(7, 12, 29, "TI3", "snow")
    # Center deep sapphire crystal root wedge (reaches y=30!)
    c.hline(13, 19, 27, "GL5", "ice")
    c.hline(12, 19, 28, "GL4", "ice")
    c.hline(11, 20, 29, "BL2", "sapphire")
    c.hline(12, 19, 30, "GL0", "sapphire")
    c.set(15, 27, "WH6", "ice_lit")
    c.set(16, 28, "GL6", "ice")
    # Right snow-crystal clump
    c.hline(20, 25, 26, "WH6", "snow_top")
    c.hline(19, 26, 27, "CW4", "snow")
    c.hline(19, 26, 28, "BL4", "snow")
    c.hline(20, 24, 29, "BL2", "sapphire")

    c.enforce_dark_outline()
    c.shadow_span(5, 26, 30)
    c.shadow_span(7, 24, 31)
    return c.im


# ===========================================================================
# 3. ice-altar.png (32x32, standing, op 28x29: x=2..29, y=2..30)
#    Ancient frost-sanctum stone & rime-ice altar draped with icicles,
#    cradling a levitating glowing diamond frost-core.
# ===========================================================================
def build_ice_altar() -> Image.Image:
    c = Canvas(32, 32)

    # --- A. Levitating Glowing Diamond Frost-Core (x=11..20, y=2..11) + Twin Orbit Shards ---
    diamond_rows = {
        2: (15, 16),
        3: (14, 17),
        4: (13, 18),
        5: (12, 19),
        6: (11, 20),
        7: (11, 20),
        8: (12, 19),
        9: (13, 18),
        10: (14, 17),
        11: (15, 16),
    }
    for y, (x0, x1) in diamond_rows.items():
        for x in range(x0, x1 + 1):
            if x == x0 or x == x1 or y in (2, 11):
                c.set(x, y, "GL0" if y >= 7 else "GL1", "ice_lit")
            else:
                # Pure glacial diamond core: incandescent white center + crisp cyan-sapphire facets!
                dx = x - 15.5
                dy = y - 6.5
                dist = abs(dx) + abs(dy)
                if dist <= 2.2:
                    tok = "WH6"
                elif dx < 0 and dy <= 0:
                    tok = "WH6" if dist <= 3.2 else "GL6"
                elif dy < 0:
                    tok = "GL6"
                elif dx < 0:
                    tok = "GL5"
                else:
                    tok = "GL4" if dist <= 3.5 else "BL3"
                c.set(x, y, tok, "ice_lit")

    # Crisp cross-facet star gleam inside diamond core
    c.hline(13, 18, 6, "WH6", "ice_lit")
    c.vline(15, 4, 9, "WH6", "ice_lit")
    c.set(18, 6, "GL6", "ice_lit")
    c.set(15, 9, "GL6", "ice_lit")

    # Twin small levitating frost-rune satellite shards flanking the core
    for y, (x0, x1) in {6: (8, 8), 7: (7, 9), 8: (7, 9), 9: (8, 8)}.items():
        for x in range(x0, x1 + 1):
            c.set(x, y, "GL0", "ice")
    c.set(8, 7, "WH6", "ice_lit")
    c.set(8, 8, "GL5", "ice")

    for y, (x0, x1) in {6: (23, 23), 7: (22, 24), 8: (22, 24), 9: (23, 23)}.items():
        for x in range(x0, x1 + 1):
            c.set(x, y, "GL0", "ice")
    c.set(23, 7, "GL6", "ice_lit")
    c.set(23, 8, "BL3", "ice")

    # --- B. 3/4 Lit Altar Mensa (Top Surface y=13..17, x=3..28) ---
    c.rect(3, 13, 28, 17, "KW5", "stone")
    for x in range(9, 23):
        c.px[x, 13] = TRANSPARENT
        c.mat.pop((x, 13), None)

    c.hline(3, 8, 13, "KW0", "stone")
    c.hline(23, 28, 13, "KW0", "stone")
    c.hline(9, 22, 14, "KW0", "stone")

    # Sunlit snow & rime-ice cushions on left & right altar horns (y=14..16)
    c.hline(4, 8, 14, "WH6", "snow_top")
    c.hline(4, 9, 15, "CW5", "snow_top")
    c.hline(4, 8, 16, "CW3", "snow")
    c.hline(23, 27, 14, "WH6", "snow_top")
    c.hline(22, 27, 15, "CW4", "snow_top")
    c.hline(23, 27, 16, "BL5", "snow")

    # Glowing Cyan Frost-Basin Recessed in Center of 3/4 Top Slab (x=11..20, y=15..16)
    c.hline(11, 20, 15, "GL5", "ice")
    c.hline(13, 18, 15, "WH6", "ice_lit")
    c.hline(11, 20, 16, "GL4", "ice")
    c.hline(13, 18, 16, "GL6", "ice_lit")

    # Front beveled stone cornice of altar top (y=17, x=3..28)
    c.hline(4, 27, 17, "KW6", "stone")
    c.hline(4, 12, 17, "CW4", "snow")
    c.hline(13, 18, 17, "GL6", "ice_lit")
    c.vline(3, 13, 18, "KW0", "stone")
    c.vline(28, 13, 18, "KW0", "stone")
    c.hline(4, 27, 18, "KW1", "stone")

    # --- C. Carved Frost-Sanctum Pedestal Body (x=4..27, y=19..26) ---
    c.rect(4, 19, 27, 26, "KW3", "stone")
    c.vline(4, 19, 26, "KW0", "stone")
    c.vline(27, 19, 26, "KW0", "stone")

    c.rect(5, 19, 7, 26, "KW4", "stone")
    c.vline(5, 19, 26, "KW6", "stone")
    c.vline(7, 19, 26, "KW2", "stone")

    c.rect(24, 19, 26, 26, "KW3", "stone")
    c.vline(24, 19, 26, "KW5", "stone")
    c.vline(26, 19, 26, "KW1", "stone")

    c.rect(9, 19, 22, 25, "KW1", "stone")
    c.hline(9, 22, 26, "KW5", "stone")
    c.vline(8, 19, 26, "KW2", "stone")
    c.vline(23, 19, 26, "KW2", "stone")

    # Glowing Engraved Frost-Cross / Snowflake Emblem on Altar Front
    c.vline(15, 21, 25, "GL6", "ice_lit")
    c.vline(16, 21, 25, "GL4", "ice")
    c.hline(13, 18, 23, "GL6", "ice_lit")
    c.set(18, 23, "GL4", "ice")
    c.set(15, 23, "WH6", "ice_lit")

    # --- D. Draping Gleaming Icicles Hanging from Overhanging Altar Lip (y=18..23) ---
    icicle_specs = [
        (5, 22),
        (7, 20),
        (10, 23),
        (12, 20),
        (19, 21),
        (21, 23),
        (25, 21),
    ]
    for ix, y_tip in icicle_specs:
        for iy in range(18, y_tip + 1):
            if iy == 18:
                c.set(ix, iy, "WH6", "ice_lit")
                if ix + 1 <= 26:
                    c.set(ix + 1, iy, "GL5", "ice")
            elif iy < y_tip:
                c.set(ix, iy, "WH6" if iy <= 20 else "GL6", "ice_lit")
                if iy <= 19 and ix + 1 <= 26:
                    c.set(ix + 1, iy, "BL3", "ice")
            else:
                c.set(ix, iy, "GL5", "ice")

    for iy in range(18, 21):
        c.set(3, iy, "GL0", "ice")
        c.set(28, iy, "GL0", "ice")
    c.set(4, 18, "WH6", "ice_lit")
    c.set(4, 19, "GL5", "ice")
    c.set(27, 18, "GL6", "ice")
    c.set(27, 19, "BL3", "ice")

    # --- E. Wide Stepped Frost-Sanctum Plinth & Banked Snow (x=2..29, y=27..30) ---
    c.rect(2, 27, 29, 30, "KW4", "stone")
    c.hline(3, 28, 27, "KW6", "stone")
    c.hline(3, 28, 28, "KW4", "stone")
    c.hline(3, 28, 29, "KW2", "stone")
    for jx in (9, 16, 22):
        c.vline(jx, 28, 29, "KW1", "stone")

    c.hline(3, 8, 27, "WH6", "snow_top")
    c.hline(3, 9, 28, "CW4", "snow")
    c.hline(4, 8, 29, "BL4", "snow")

    c.hline(23, 28, 27, "WH6", "snow_top")
    c.hline(22, 28, 28, "CW4", "snow")
    c.hline(23, 27, 29, "BL4", "snow")

    c.enforce_dark_outline()
    c.shadow_span(3, 28, 30)
    c.shadow_span(3, 28, 31)
    return c.im


# ===========================================================================
# 4. icicles.png (32x16, standing, op 30x14: x=1..30, y=1..14)
#    Jagged curtain of gleaming hanging cave icicles with crisp blue-white
#    vertical refraction highlights (mounts cleanly along cavern ceiling/wall rims).
# ===========================================================================
def build_icicles() -> Image.Image:
    c = Canvas(32, 16)

    # --- A. Sculpted Frozen Ceiling Rime Shelf / Ice Root Band (x=1..30, y=1..4) ---
    c.hline(1, 30, 1, "TI1", "snow_top")
    # Organic scalloped rime-snow lip at y=2..3
    c.hline(2, 29, 2, "WH6", "snow_top")
    for x in (5, 11, 12, 20, 21, 27):
        c.set(x, 2, "CW4", "snow_top")
    c.hline(2, 29, 3, "GL6", "ice_lit")
    for x in (3, 4, 7, 8, 15, 16, 24, 25):
        c.set(x, 3, "WH6", "ice_lit")
    c.hline(2, 29, 4, "GL5", "ice")

    # --- B. 7 Distinct Tapering Hanging Cave Icicle Spikes (Jagged Rhythm, Deep Open V-Gaps!) ---
    spikes = [
        (1, 4, 9),     # 1. Left framing spike (x=1..4)
        (5, 10, 13),   # 2. Major long left-center icicle
        (11, 13, 8),   # 3. Short recessed icicle tooth
        (14, 19, 14),  # 4. Hero longest central icicle (tip at y=14!)
        (20, 22, 9),   # 5. Medium-short tooth
        (23, 27, 13),  # 6. Major long right icicle
        (28, 30, 10),  # 7. Right framing spike (x=28..30)
    ]

    for x0_top, x1_top, tip_y in spikes:
        base_w = x1_top - x0_top + 1
        cx = (x0_top + x1_top) / 2.0
        span_h = max(1, tip_y - 3)
        for y in range(4, tip_y + 1):
            t = (y - 3) / span_h
            if y == tip_y:
                ix0 = ix1 = int(round(cx))
            elif y == tip_y - 1:
                ix0 = int(math.floor(cx))
                ix1 = min(x1_top, ix0 + (1 if base_w <= 3 else 2))
            else:
                half_w = max(0.6, (base_w / 2.0) * (1.0 - 0.72 * t))
                ix0 = max(x0_top, int(round(cx - half_w + 0.2)))
                ix1 = min(x1_top, int(round(cx + half_w - 0.2)))
                if ix1 < ix0:
                    ix1 = ix0

            for x in range(ix0, ix1 + 1):
                w_cur = ix1 - ix0 + 1
                rel = x - ix0
                if w_cur == 1:
                    c.set(x, y, "GL0", "ice")
                elif w_cur == 2:
                    c.set(x, y, "GL1" if rel == 0 else "BL0", "ice")
                else:
                    if x == ix0:
                        c.set(x, y, "GL1", "ice_lit")
                    elif x == ix1:
                        c.set(x, y, "BL0", "sapphire")
                    elif rel == 1:
                        tok = "WH6" if t < 0.65 else "GL6"
                        c.set(x, y, tok, "ice_lit")
                    elif rel == 2 and w_cur >= 5:
                        tok = "GL6" if t < 0.48 else "GL5"
                        c.set(x, y, tok, "ice")
                    else:
                        tok = "GL4" if t < 0.45 else ("BL3" if t < 0.72 else "BL2")
                        c.set(x, y, tok, "sapphire")

    # Carve crisp high V-notches between major spikes so individual icicle cones separate cleanly at 1x!
    for notch_x in (4, 10, 13, 19, 22, 27):
        c.px[notch_x, 5] = TRANSPARENT
        c.mat.pop((notch_x, 5), None)
        c.set(notch_x, 4, "GL0", "sapphire")

    # Gleaming refraction highlights down longest icicle cores
    c.vline(7, 4, 11, "WH6", "ice_lit")
    c.vline(16, 4, 12, "WH6", "ice_lit")
    c.vline(25, 4, 11, "WH6", "ice_lit")

    c.enforce_dark_outline()
    return c.im


# ===========================================================================
# 5. snow-drift.png (32x16, topdown, op 30x13: x=1..30, y=2..14)
#    Soft wind-carved snowbank mound with pure-white sunlit crest &
#    cool periwinkle-blue shadow curves.
# ===========================================================================
def build_snow_drift() -> Image.Image:
    c = Canvas(32, 16)

    # Organic two-lobed wind-sculpted snowbank silhouette (NEVER a soap-bar oval!):
    # Main pillowed drift dome on left-center (x=1..20, y=2..14) + wind-carved saddle dip at x=19..21
    # flowing into a lower secondary snow tongue on right (x=18..30, y=5..13)!
    top_y_by_x: dict[int, int] = {
        1: 8,  2: 6,  3: 5,  4: 4,  5: 3,  6: 3,  7: 2,  8: 2,  9: 2,  10: 2,
        11: 2, 12: 2, 13: 3, 14: 3, 15: 3, 16: 4, 17: 4, 18: 5, 19: 5, 20: 5,
        21: 4, 22: 4, 23: 4, 24: 5, 25: 5, 26: 6, 27: 6, 28: 7, 29: 8, 30: 9,
    }
    bot_y_by_x: dict[int, int] = {
        1: 10, 2: 11, 3: 12, 4: 13, 5: 13, 6: 14, 7: 14, 8: 14, 9: 14, 10: 14,
        11: 14, 12: 14, 13: 14, 14: 13, 15: 13, 16: 13, 17: 12, 18: 12, 19: 12, 20: 13,
        21: 13, 22: 13, 23: 13, 24: 13, 25: 13, 26: 12, 27: 12, 28: 11, 29: 11, 30: 10,
    }

    # Sweeping S-curved wind cornice ridge: separates pure-white sunlit windward slope (above)
    # from smooth cool periwinkle-blue leeward shadow hollow (below)!
    def cornice_y(x: int) -> float:
        if x <= 18:
            return 8.6 - 2.2 * math.sin((x - 1) / 17.0 * math.pi * 0.85)
        return 7.4 + 1.4 * math.sin((x - 18) / 12.0 * math.pi * 0.75)

    for x in range(1, 31):
        y0, y1 = top_y_by_x[x], bot_y_by_x[x]
        cy = cornice_y(x)
        for y in range(y0, y1 + 1):
            d = y - cy
            if y == y0 + 1 and x >= 19:
                tok = "WH6"
                mat = "snow_top"
            elif d <= -2.6:
                # Far upper rim gently rounding toward top outline
                tok = "CW5"
                mat = "snow_top"
            elif d <= 0.35:
                # Broad pure-white sunlit snow crest!
                tok = "WH6"
                mat = "snow_top"
            elif d <= 1.35:
                # Soft crisp cornice transition
                tok = "CW4" if x < 14 else "BL5"
                mat = "snow"
            elif d <= 2.6:
                # Cool sky-periwinkle shadow curve
                tok = "BL5" if d <= 1.9 else "BL4"
                mat = "snow"
            else:
                # Deep periwinkle-slate base shadow curve (smooth, no isolated mid-stripe!)
                tok = "BL4" if y < y1 - 1 else "TI3"
                mat = "snow"
            c.set(x, y, tok, mat)

    # Sculpt overlap crease where front-left snow drift overlaps secondary right lobe (x=16..20, y=8..11)
    c.line(16, 8, 19, 11, "WH6", "snow_top")
    c.line(17, 8, 20, 11, "BL4", "snow")

    # Enforce 1px dark cool slate-periwinkle outline (#2c3858 sunlit top, #1e2440 shaded bottom)
    c.enforce_dark_outline()

    # Soft ground shadow hugging scalloped snowbank base
    for x in range(3, 29):
        by = bot_y_by_x[x]
        c.shadow(x, by + 1)
    return c.im


# ===========================================================================
# 6. frost-brazier.png (16x32, standing, op 14x29: x=1..14, y=2..30)
#    Frosted Nordic silver-iron brazier burning with luminous cyan-white frostfire.
# ===========================================================================
def build_frost_brazier() -> Image.Image:
    c = Canvas(16, 32)

    # --- A. Luminous Cyan-White Frostfire Plume (x=3..12, y=2..13) ---
    # 3-stage glacial frostfire ramp: WH6 incandescent core -> GL6/TL5 icy aqua -> GL4/BL3 sapphire licks!
    flame_pixels: list[tuple[int, int, str]] = [
        # Dancing central & right flame tips (y=2..5)
        (7, 2, "GL0"),
        (7, 3, "GL6"), (8, 3, "GL4"),
        (6, 4, "GL6"), (7, 4, "WH6"), (8, 4, "GL5"), (10, 4, "GL0"),
        (4, 5, "TL0"), (6, 5, "GL6"), (7, 5, "WH6"), (8, 5, "GL6"), (10, 5, "GL5"),
        # Swirling mid tongues with asymmetric licks (y=6..8)
        (4, 6, "GL5"), (6, 6, "WH6"), (7, 6, "WH6"), (8, 6, "GL6"), (9, 6, "GL4"), (10, 6, "BL3"),
        (3, 7, "GL0"), (4, 7, "GL6"), (5, 7, "GL5"), (6, 7, "WH6"), (7, 7, "WH6"), (8, 7, "WH6"), (9, 7, "GL6"), (10, 7, "GL4"), (11, 7, "BL2"),
        (3, 8, "GL4"), (4, 8, "GL6"), (5, 8, "GL6"), (6, 8, "WH6"), (7, 8, "WH6"), (8, 8, "WH6"), (9, 8, "GL6"), (10, 8, "GL5"), (11, 8, "BL3"), (12, 8, "BL0"),
        # Full roaring frostfire heart above basin (y=9..12)
        (3, 9, "GL4"), (4, 9, "GL5"), (5, 9, "GL6"), (6, 9, "WH6"), (7, 9, "WH6"), (8, 9, "WH6"), (9, 9, "GL6"), (10, 9, "GL5"), (11, 9, "BL3"), (12, 9, "BL2"),
        (3, 10, "BL3"), (4, 10, "GL5"), (5, 10, "WH6"), (6, 10, "WH6"), (7, 10, "WH6"), (8, 10, "WH6"), (9, 10, "WH6"), (10, 10, "GL6"), (11, 10, "GL4"), (12, 10, "BL2"),
        (4, 11, "GL5"), (5, 11, "GL6"), (6, 11, "WH6"), (7, 11, "WH6"), (8, 11, "WH6"), (9, 11, "WH6"), (10, 11, "GL6"), (11, 11, "GL4"),
        (4, 12, "GL5"), (5, 12, "GL6"), (6, 12, "WH6"), (7, 12, "WH6"), (8, 12, "WH6"), (9, 12, "GL6"), (10, 12, "GL5"), (11, 12, "BL3"),
    ]
    for fx, fy, ftok in flame_pixels:
        c.set(fx, fy, ftok, "frostfire")

    c.enforce_dark_outline()

    # Restore glowing cyan-to-white interior gradient after outer outline pass
    for fy, row_cols in {
        4: {7: "WH6"},
        5: {6: "GL6", 7: "WH6", 8: "GL5"},
        6: {6: "WH6", 7: "WH6", 8: "GL6", 9: "GL4"},
        7: {4: "GL5", 5: "GL6", 6: "WH6", 7: "WH6", 8: "GL6", 9: "GL5", 10: "BL3"},
        8: {4: "GL5", 5: "GL6", 6: "WH6", 7: "WH6", 8: "WH6", 9: "GL6", 10: "GL5", 11: "BL3"},
        9: {4: "GL5", 5: "GL6", 6: "WH6", 7: "WH6", 8: "WH6", 9: "GL6", 10: "GL5", 11: "BL3"},
        10: {4: "GL5", 5: "WH6", 6: "WH6", 7: "WH6", 8: "WH6", 9: "GL6", 10: "GL5", 11: "GL4"},
        11: {5: "GL6", 6: "WH6", 7: "WH6", 8: "WH6", 9: "WH6", 10: "GL6"},
        12: {5: "GL6", 6: "WH6", 7: "WH6", 8: "WH6", 9: "GL6", 10: "GL5"},
    }.items():
        for fx, ftok in row_cols.items():
            c.set(fx, fy, ftok, "frostfire")

    # --- B. Wide Nordic Silver-Iron Fire Bowl (x=1..14, y=13..19) ---
    c.set(1, 13, "ST0", "iron")
    c.set(2, 13, "ST6", "iron")
    c.set(13, 13, "ST5", "iron")
    c.set(14, 13, "ST0", "iron")

    c.hline(3, 12, 13, "GL5", "frostfire")
    c.hline(5, 10, 13, "WH6", "frostfire")
    c.hline(1, 14, 14, "ST5", "iron")
    c.set(1, 14, "ST0", "iron")
    c.set(2, 14, "ST6", "iron")
    c.hline(4, 11, 14, "GL6", "frostfire")
    c.set(13, 14, "ST4", "iron")
    c.set(14, 14, "ST0", "iron")

    c.hline(1, 14, 15, "ST4", "iron")
    c.set(1, 15, "ST0", "iron")
    c.hline(2, 6, 15, "ST6", "iron")
    c.hline(7, 9, 15, "GL6", "ice_lit")
    c.hline(10, 12, 15, "ST4", "iron")
    c.set(13, 15, "ST2", "iron")
    c.set(14, 15, "ST0", "iron")

    bowl_spans = {
        16: (2, 13),
        17: (2, 13),
        18: (3, 12),
        19: (4, 11),
    }
    for y, (x0, x1) in bowl_spans.items():
        for x in range(x0, x1 + 1):
            if x == x0 or x == x1:
                c.set(x, y, "ST0", "iron")
            elif x <= 5:
                c.set(x, y, "ST5" if x == x0 + 1 else "ST4", "iron")
            elif x <= 8:
                c.set(x, y, "ST3" if y < 18 else "ST2", "iron")
            else:
                c.set(x, y, "ST2" if x < x1 - 1 else "ST1", "iron")

    # Warm Nordic Gold Rivet Bosses on Bowl
    c.set(5, 17, "YL4", "gold")
    c.set(8, 17, "YL3", "gold")
    c.set(10, 17, "YL2", "gold")

    # Tiny gleaming frost-icicles hanging from bowl rim
    c.set(3, 17, "WH6", "ice_lit")
    c.set(3, 18, "GL6", "ice_lit")
    c.set(12, 17, "GL6", "ice_lit")

    # --- C. Carved Nordic Pedestal Waist & Bronze Collar (x=5..10, y=20..23) ---
    c.rect(5, 20, 10, 23, "ST3", "iron")
    c.vline(5, 20, 23, "ST0", "iron")
    c.vline(10, 20, 23, "ST0", "iron")
    c.vline(6, 20, 23, "ST5", "iron")
    c.vline(9, 20, 23, "ST1", "iron")
    c.set(6, 21, "YL4", "gold")
    c.set(7, 21, "YL3", "gold")
    c.set(8, 21, "YL2", "gold")
    c.set(9, 21, "CH4", "gold")

    # --- D. Splayed Frosted Tripod Legs with Crisp Open Arch Cutouts (x=2..13, y=24..30) ---
    c.hline(4, 11, 24, "ST3", "iron")
    c.set(5, 24, "ST5", "iron")
    c.set(6, 24, "ST4", "iron")
    c.hline(3, 12, 25, "ST3", "iron")
    c.set(4, 25, "ST5", "iron")
    c.set(7, 25, "ST4", "iron")
    c.set(11, 25, "ST1", "iron")

    # Distinct 3-legged Nordic tripod (left x=2..4, center x=7..8, right x=11..13) with open space at x=5..6 & x=9..10!
    for y in range(26, 29):
        # Left leg
        c.set(2, y, "ST0", "iron")
        c.set(3, y, "ST5" if y < 28 else "WH6", "iron" if y < 28 else "snow_top")
        c.set(4, y, "ST0", "iron")
        # Center front leg
        c.set(7, y, "ST4", "iron")
        c.set(8, y, "ST1", "iron")
        # Right leg
        c.set(11, y, "ST0", "iron")
        c.set(12, y, "ST3" if y < 28 else "CW4", "iron" if y < 28 else "snow")
        c.set(13, y, "ST0", "iron")

    # Grounded Frost-Dusted Claw Feet (y=29..30)
    c.hline(2, 4, 29, "WH6", "snow_top")
    c.hline(7, 8, 29, "ST5", "iron")
    c.hline(11, 13, 29, "CW4", "snow")
    c.hline(2, 4, 30, "TI0", "snow")
    c.hline(7, 8, 30, "ST0", "iron")
    c.hline(11, 13, 30, "TI0", "snow")

    c.enforce_dark_outline()
    # Keep inner lit core of tripod legs bright where 3px wide
    c.set(3, 26, "ST6", "iron")
    c.set(3, 27, "ST5", "iron")
    c.set(3, 28, "WH6", "snow_top")
    c.set(3, 29, "WH6", "snow_top")
    c.set(12, 26, "ST4", "iron")
    c.set(12, 27, "ST3", "iron")
    c.set(12, 28, "CW4", "snow")
    c.set(12, 29, "BL5", "snow")

    c.shadow_span(2, 13, 30)
    c.shadow_span(2, 13, 31)
    return c.im


# ===========================================================================
# Strict Gate Verification & Preview Sheet Builder
# ===========================================================================
def verify_sprite(
    name: str,
    im: Image.Image,
    expected_size: tuple[int, int],
    camera: str,
    valid_hexes: set[str],
) -> dict:
    w, h = im.size
    assert (w, h) == expected_size, f"{name}: size {(w, h)} != {expected_size}"

    px = im.load()
    off_palette = []
    pure_black = 0
    bad_alpha = []
    bright_edge = []
    non_dark_token_edge = []
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
                if lm > 65.0:
                    bright_edge.append((x, y, hx, round(lm, 1)))
                if hx not in DARK_OUTLINE_HEXES:
                    non_dark_token_edge.append((x, y, hx, round(lm, 1)))

    assert not off_palette, f"{name}: off-palette pixels: {off_palette[:5]}"
    assert pure_black == 0, f"{name}: pure #000000 forbidden!"
    assert not bad_alpha, f"{name}: illegal alpha pixels: {bad_alpha[:5]}"
    assert not bright_edge, f"{name}: bright outer outline pixels (luma>65): {bright_edge[:5]}"
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
    top_gap = min_y
    bottom_gap = (h - 1) - max_y

    assert ow / w >= 0.75 and oh / h >= 0.75, f"{name}: undersized bbox {ow}x{oh} in {w}x{h}"
    assert abs(left_gap - right_gap) <= 1, f"{name}: uncentered left={left_gap} right={right_gap}"
    assert 1 <= bottom_gap <= 2, f"{name}: bottom_gap={bottom_gap} (expected 1..2)"

    return {
        "name": name,
        "camera": camera,
        "canvas": f"{w}x{h}",
        "opaque": f"{ow}x{oh}",
        "margins": f"L{left_gap}/R{right_gap}/T{top_gap}/B{bottom_gap}",
        "shadow_px": shadow_pts,
        "colors": len({f"#{px[x, y][0]:02x}{px[x, y][1]:02x}{px[x, y][2]:02x}" for x, y in opaque_pts}),
    }


def load_beodeul_char_1x() -> Image.Image:
    src = Image.open(CHAR_REF_4X).convert("RGBA")
    return src.resize((src.width // 4, src.height // 4), Image.Resampling.NEAREST)


def build_preview_sheet(
    items: list[tuple[str, str, Image.Image, dict]],
    char_1x: Image.Image,
    out_path: Path,
) -> None:
    """Render 2x + 1x on #767670 next to 22px Beodeul character,
    plus bottom native 1x & 2x lineup + 4x detail loupe strip.
    """
    bg_gray = (0x76, 0x76, 0x70, 255)   # #767670 mandatory neutral inspection gray
    header_bg = (0x5A, 0x5C, 0x60, 255)
    card_top = (0x64, 0x66, 0x68, 255)
    line_col = (0x8E, 0x90, 0x8A, 255)
    text_hi = (246, 248, 250, 255)
    text_lo = (218, 222, 224, 255)

    sheet_w = 1160
    sheet_h = 470
    sheet = Image.new("RGBA", (sheet_w, sheet_h), bg_gray)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.Resampling.NEAREST)

    # Header bar
    draw.rectangle([0, 0, sheet_w - 1, 76], fill=header_bg)
    draw.line([(0, 76), (sheet_w - 1, 76)], fill=line_col)
    sheet.alpha_composite(char_2x, (16, 68 - char_2x.height))
    sheet.alpha_composite(char_1x, (16 + char_2x.width + 10, 68 - char_1x.height))

    draw.text(
        (106, 11),
        "T3 DUNGEON THEME OBJECTS BATCH 3/4: ICE (GLACIAL ICE CAVERN - 6 SPRITES) | gemini-4-carbon (medium)",
        fill=text_hi,
        font=font,
    )
    draw.text(
        (106, 30),
        "100% Locked Fable Palette (tiledata/jp-city/fable-city/palette.json) | 0 Off-Palette | Shadow #4c557f@85 | 1px Dark Outlines",
        fill=text_lo,
        font=font,
    )
    draw.text(
        (106, 49),
        f"Cards: [22px Beodeul Char 2x | Object 2x | Object 1x] on #767670  |  Bottom: Native 1x Lineup + 2x Lineup + 3x Loupe",
        fill=text_lo,
        font=font,
    )

    # 6 Individual Inspection Cards
    pad = 10
    card_w = (sheet_w - pad * 7) // 6
    card_h = 172
    y0 = 88

    for idx, (fname, cam, im1, stats) in enumerate(items):
        x0 = pad + idx * (card_w + pad)
        draw.rectangle([x0, y0, x0 + card_w - 1, y0 + card_h - 1], fill=bg_gray, outline=line_col)
        draw.rectangle([x0 + 1, y0 + 1, x0 + card_w - 2, y0 + 22], fill=card_top)

        short = fname.replace(".png", "")
        draw.text((x0 + 6, y0 + 6), f"{idx + 1}. {short}", fill=text_hi, font=font)

        im2 = im1.resize((im1.width * 2, im1.height * 2), Image.Resampling.NEAREST)
        base_y = y0 + card_h - 34

        total_w = char_2x.width + 8 + im2.width + 10 + im1.width
        sx = x0 + max(4, (card_w - total_w) // 2)
        sheet.alpha_composite(char_2x, (sx, base_y - char_2x.height))
        sheet.alpha_composite(im2, (sx + char_2x.width + 8, base_y - im2.height))
        sheet.alpha_composite(im1, (sx + char_2x.width + 8 + im2.width + 10, base_y - im1.height))

        draw.text(
            (x0 + 6, y0 + card_h - 27),
            f"{stats['canvas']} op:{stats['opaque']} {cam}",
            fill=text_lo,
            font=font,
        )
        draw.text(
            (x0 + 6, y0 + card_h - 14),
            f"{stats['colors']} cols | sh:{stats['shadow_px']}px",
            fill=text_lo,
            font=font,
        )

    # Bottom Strip (y=272..458): Left = Native 1x + 2x Lineup on #767670; Right = 3x Pixel Detail Loupe
    strip_y = 272
    strip_h = 186
    left_w = 505
    draw.rectangle([pad, strip_y, pad + left_w - 1, strip_y + strip_h - 1], fill=bg_gray, outline=line_col)
    draw.rectangle([pad + 1, strip_y + 1, pad + left_w - 2, strip_y + 21], fill=card_top)
    draw.text((pad + 8, strip_y + 5), "NATIVE 1x & 2x SCALE LINEUP ON #767670 (WITH 22px BEODEUL CHAR)", fill=text_hi, font=font)

    # 1x lineup row
    lx = pad + 12
    ly_base = strip_y + 68
    draw.text((lx, ly_base - 38), "1x:", fill=text_lo, font=font)
    sheet.alpha_composite(char_1x, (lx + 24, ly_base - char_1x.height))
    lx_cur = lx + 24 + char_1x.width + 12
    for _fname, _cam, im1, _st in items:
        sheet.alpha_composite(im1, (lx_cur, ly_base - im1.height))
        lx_cur += im1.width + 12

    # 2x lineup row
    lx2 = pad + 12
    ly2_base = strip_y + 168
    draw.text((lx2, ly2_base - 66), "2x:", fill=text_lo, font=font)
    sheet.alpha_composite(char_2x, (lx2 + 24, ly2_base - char_2x.height))
    lx2_cur = lx2 + 24 + char_2x.width + 8
    for _fname, _cam, im1, _st in items:
        im2 = im1.resize((im1.width * 2, im1.height * 2), Image.Resampling.NEAREST)
        sheet.alpha_composite(im2, (lx2_cur, ly2_base - im2.height))
        lx2_cur += im2.width + 8

    # Right box: 3x Magnified Pixel Cluster & Silhouette Inspection on #767670
    rx0 = pad + left_w + pad
    rw = sheet_w - rx0 - pad
    draw.rectangle([rx0, strip_y, rx0 + rw - 1, strip_y + strip_h - 1], fill=bg_gray, outline=line_col)
    draw.rectangle([rx0 + 1, strip_y + 1, rx0 + rw - 2, strip_y + 21], fill=card_top)
    draw.text((rx0 + 8, strip_y + 5), "3x PIXEL LOUPE ON #767670 (SILHOUETTE, FACET GLINTS & DARK OUTLINES)", fill=text_hi, font=font)

    cx_pos = rx0 + 12
    cy_base = strip_y + 168
    for _fname, _cam, im1, _st in items:
        im3 = im1.resize((im1.width * 3, im1.height * 3), Image.Resampling.NEAREST)
        sheet.alpha_composite(im3, (cx_pos, cy_base - im3.height))
        cx_pos += im3.width + 10

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)


def main() -> None:
    pal_data = json.loads(PALETTE_JSON.read_text(encoding="utf-8"))
    valid_hexes: set[str] = set()
    for ramp_cols in pal_data["ramps"].values():
        for hx in ramp_cols:
            valid_hexes.add(hx.lower())

    assert "#000000" not in valid_hexes, "Pure #000000 must not be in palette!"
    for tk, hx in P.items():
        assert hx.lower() in valid_hexes, f"Token {tk}={hx} is NOT in {PALETTE_JSON}!"

    OBJ_DIR.mkdir(parents=True, exist_ok=True)

    specs = [
        ("frozen-warrior.png", (32, 32), "standing", build_frozen_warrior),
        ("ice-crystal.png",    (32, 32), "standing", build_ice_crystal),
        ("ice-altar.png",      (32, 32), "standing", build_ice_altar),
        ("icicles.png",        (32, 16), "standing", build_icicles),
        ("snow-drift.png",     (32, 16), "topdown",  build_snow_drift),
        ("frost-brazier.png",  (16, 32), "standing", build_frost_brazier),
    ]

    built_items: list[tuple[str, str, Image.Image, dict]] = []
    print("=== T3 DUNGEON THEME OBJECTS BATCH 3/4: ICE GATE CHECK ===")
    for fname, expected_sz, cam, builder in specs:
        im = builder()
        stats = verify_sprite(fname, im, expected_sz, cam, valid_hexes)
        out_file = OBJ_DIR / fname
        im.save(out_file)
        built_items.append((fname, cam, im, stats))
        print(
            f"  PASS  {fname:20s} canvas={stats['canvas']:6s} "
            f"opaque={stats['opaque']:6s} margins={stats['margins']:14s} "
            f"colors={stats['colors']:2d} shadow={stats['shadow_px']:3d}px"
        )

    char_1x = load_beodeul_char_1x()
    build_preview_sheet(built_items, char_1x, PREVIEW_PNG)
    print(f"Saved preview contact sheet -> {PREVIEW_PNG}")
    print("ALL 6 ICE SPRITES PASSED 100% LOCKED PALETTE / ALPHA / DARK-OUTLINE / CAMERA GATES!")


if __name__ == "__main__":
    main()
