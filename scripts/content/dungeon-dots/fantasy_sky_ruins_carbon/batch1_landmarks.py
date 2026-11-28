#!/usr/bin/env python3
"""
T2 Ruins Batch 1/4: 5 Museum-Grade Beodeul Ancient Sanctuary Landmarks
(`fantasy_sky_ruins_carbon`)

Sprites produced in `tiledata/dungeon-dots/fantasy_sky_ruins_carbon/objects/`:
  1. ruin_shrine_gate.png        (48x48, standing, op ~42x45)
  2. crystal_rune_altar.png      (32x32, standing, op ~26x29)
  3. stone_guardian_statue.png   (16x32, standing, op ~16x27)
  4. carved_rune_stele.png       (32x32, standing, op ~26x29)
  5. sanctuary_fountain_round.png (32x32, topdown, op ~28x25)

Hard Rules Enforced:
  - 100% locked to `palette_beodeul_ruins.json` (74 opaque colors, 0 off-palette, 0 #000000)
  - Optional ground shadow ONLY `#4c557f` at alpha 85/255; all other pixels alpha 0 or 255
  - 1px dark material outer outline on every opaque pixel touching non-opaque (luma <= 85)
  - Strict RM2000/Beodeul 3/4 orthographic standing (zero side walls) & topdown (>=75% top)
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
REFS_DIR = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs"
PALETTE_JSON = ROOT / "tiledata/dungeon-dots/fantasy_sky_ruins/palette_beodeul_ruins.json"
CHAR_REF_4X = REFS_DIR / "ref_beodeul_char_4x.png"
OLD_NEON_OBJ_DIR = ROOT / "tiledata/dungeon-dots/fantasy_sky_ruins/objects"

OUT_DIR = ROOT / "tiledata/dungeon-dots/fantasy_sky_ruins_carbon"
OBJ_DIR = OUT_DIR / "objects"
PREVIEW_PNG = OUT_DIR / "preview_batch1.png"

SHADOW_RGB = (0x4C, 0x55, 0x7F)
SHADOW_ALPHA = 85
SHADOW_RGBA = (0x4C, 0x55, 0x7F, 85)
TRANSPARENT = (0, 0, 0, 0)

# 74-color locked palette shorthand tokens (100% verified against palette_beodeul_ruins.json)
P: dict[str, str] = {
    # Grass meadow (6)
    "G0": "#363f2a",
    "G1": "#4b6827",
    "G2": "#618c3b",
    "G3": "#6e9943",
    "G4": "#7aa34b",
    "G5": "#8bb14e",
    # Foliage & moss (6)
    "F0": "#1d2d19",
    "F1": "#2d4619",
    "F2": "#3d5e24",
    "F3": "#5c7728",
    "F4": "#8eac43",
    "F5": "#a8ca5c",
    # Cool stone limestone (9)
    "S0": "#262729",
    "S1": "#3e403d",
    "S2": "#595b58",
    "S3": "#767776",
    "S4": "#929491",
    "S5": "#afb1ae",
    "S6": "#c4c6c3",
    "S7": "#dadcd9",
    "S8": "#e5e7e4",
    # Dark slate stone (5)
    "D0": "#2b3436",
    "D1": "#40484a",
    "D2": "#5b6667",
    "D3": "#797a84",
    "D4": "#a0a2ac",
    # Sanctuary water teal (7)
    "W0": "#0c2222",
    "W1": "#1a4640",
    "W2": "#1c4a44",
    "W3": "#21584e",
    "W4": "#2a6f71",
    "W5": "#3fa2ae",
    "W6": "#7da3a6",
    # Crystal cyan (7; shares #3fa2ae with W5)
    "C0": "#143c36",
    "C1": "#27696c",
    "C2": "#3fa2ae",
    "C3": "#84c8ce",
    "C4": "#9ce0ee",
    "C5": "#cff4f8",
    "C6": "#f2ffff",
    # Wood / antique bronze-oak tones (8)
    "O0": "#291c13",
    "O1": "#452a17",
    "O2": "#583a24",
    "O3": "#6f4725",
    "O4": "#8c6038",
    "O5": "#a67d55",
    "O6": "#bd936b",
    "O7": "#d8aa73",
    # Warm weathered limestone / parchment mortar (6)
    "P0": "#59503a",
    "P1": "#827869",
    "P2": "#a69a77",
    "P3": "#c2bca7",
    "P4": "#d9d2be",
    "P5": "#f0e7cc",
    # Cobalt-slate sanctuary roof (6)
    "B0": "#13122f",
    "B1": "#201e45",
    "B2": "#2e2b66",
    "B3": "#454096",
    "B4": "#5650b5",
    "B5": "#cbc6e5",
    # Iron / deep slate-steel (5; shares #a0a2ac with D4)
    "I0": "#1c1c26",
    "I1": "#30384a",
    "I2": "#4e5a6b",
    "I3": "#72808a",
    "I4": "#a0a2ac",
    # Ochre / gold / crimson accents (11)
    "A0": "#491d20",
    "A1": "#76302f",
    "A2": "#863736",
    "A3": "#b9422c",
    "A4": "#df722f",
    "A5": "#f08a10",
    "A6": "#dc9a26",
    "A7": "#fbc10d",
    "A8": "#fff2a5",
    "A9": "#d97163",
    "AA": "#f4c5b2",
}

# Material-specific darkest 1px outer outline hexes (all luma <= 58, well below 85!)
DARK_OUTLINE_HEXES = {
    "#262729",  # S0 stone_limestone darkest (luma 39.0)
    "#3e403d",  # S1 stone_limestone deep (luma 63.1)
    "#2b3436",  # D0 stone_slate_dark darkest (luma 49.5)
    "#13122f",  # B0 roof_cobalt darkest (luma 21.6)
    "#201e45",  # B1 roof_cobalt deep (luma 35.0)
    "#1d2d19",  # F0 foliage_moss darkest (luma 37.9)
    "#2d4619",  # F1 foliage_moss deep (luma 57.4)
    "#363f2a",  # G0 grass_meadow darkest (luma 57.9)
    "#0c2222",  # W0 water_teal darkest (luma 27.4)
    "#143c36",  # C0 crystal_cyan darkest (luma 47.4)
    "#1c1c26",  # I0 iron_bronze darkest (luma 29.1)
    "#291c13",  # O0 wood_oak darkest (luma 30.9)
}


def luma(r: int, g: int, b: int) -> float:
    return 0.299 * r + 0.587 * g + 0.114 * b


def hex_to_rgba(hx: str) -> tuple[int, int, int, int]:
    h = hx.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


class Canvas:
    def __init__(self, w: int, h: int) -> None:
        self.w = w
        self.h = h
        self.im = Image.new("RGBA", (w, h), TRANSPARENT)
        self.px = self.im.load()
        self.mat: dict[tuple[int, int], str] = {}

    def set(self, x: int, y: int, tok: str, mat: str = "stone") -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            if tok == ".":
                self.px[x, y] = TRANSPARENT
                self.mat.pop((x, y), None)
            elif tok == "SH":
                self.px[x, y] = SHADOW_RGBA
                self.mat.pop((x, y), None)
            else:
                hx = P[tok] if tok in P else tok
                self.px[x, y] = hex_to_rgba(hx)
                self.mat[(x, y)] = mat

    def get_alpha(self, x: int, y: int) -> int:
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[x, y][3]
        return 0

    def hline(self, x1: int, x2: int, y: int, tok: str, mat: str = "stone") -> None:
        for x in range(min(x1, x2), max(x1, x2) + 1):
            self.set(x, y, tok, mat)

    def vline(self, x: int, y1: int, y2: int, tok: str, mat: str = "stone") -> None:
        for y in range(min(y1, y2), max(y1, y2) + 1):
            self.set(x, y, tok, mat)

    def rect(self, x1: int, y1: int, x2: int, y2: int, tok: str, mat: str = "stone") -> None:
        for y in range(min(y1, y2), max(y1, y2) + 1):
            for x in range(min(x1, x2), max(x1, x2) + 1):
                self.set(x, y, tok, mat)

    def draw_ashlar_block(
        self,
        x1: int,
        y1: int,
        x2: int,
        y2: int,
        hi: str,
        mid: str,
        lo: str,
        seam: str = "S2",
        mat: str = "stone",
    ) -> None:
        """Render a single volumetric Beodeul ashlar block lit from top-left."""
        self.rect(x1, y1, x2, y2, mid, mat)
        self.hline(x1, x2 - 1, y1, hi, mat)
        self.vline(x1, y1, y2 - 1, hi, mat)
        if x2 - x1 >= 3 and y2 - y1 >= 2:
            self.set(x1 + 1, y1 + 1, hi, mat)
        self.hline(x1 + 1, x2, y2, seam, mat)
        self.vline(x2, y1 + 1, y2, seam, mat)
        if x2 - x1 >= 2 and y2 - y1 >= 2:
            self.hline(x1 + 1, x2 - 1, y2 - 1, lo, mat)

    def shadow_ellipse_if_empty(self, cx: float, cy: float, rx: float, ry: float) -> None:
        for y in range(self.h):
            for x in range(self.w):
                if self.px[x, y][3] == 0:
                    dx = (x - cx) / rx
                    dy = (y - cy) / ry
                    if dx * dx + dy * dy <= 1.0:
                        self.px[x, y] = SHADOW_RGBA

    def shadow_band_if_empty(self, x1: int, x2: int, y1: int, y2: int) -> None:
        for y in range(y1, y2 + 1):
            for x in range(x1, x2 + 1):
                if 0 <= x < self.w and 0 <= y < self.h and self.px[x, y][3] == 0:
                    self.px[x, y] = SHADOW_RGBA

    def enforce_dark_outline(self) -> None:
        """Ensure every opaque pixel touching non-opaque uses its material's darkest outline."""
        mat_outline = {
            "stone": "S0",
            "slate": "D0",
            "roof": "B0",
            "moss": "F0",
            "crystal": "C0",
            "water": "W0",
            "iron": "I0",
            "wood": "O0",
        }
        to_fix: list[tuple[int, int, str]] = []
        for y in range(self.h):
            for x in range(self.w):
                r, g, b, a = self.px[x, y]
                if a != 255:
                    continue
                hx = f"#{r:02x}{g:02x}{b:02x}"
                touches_bg = False
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if nx < 0 or nx >= self.w or ny < 0 or ny >= self.h or self.px[nx, ny][3] != 255:
                        touches_bg = True
                        break
                if touches_bg and hx not in DARK_OUTLINE_HEXES:
                    m = self.mat.get((x, y), "stone")
                    to_fix.append((x, y, mat_outline.get(m, "S0")))
        for x, y, tok in to_fix:
            self.set(x, y, tok, self.mat.get((x, y), "stone"))


# ===========================================================================
# 1. ruin_shrine_gate.png (48x48, standing, op 42x45: x=3..44, y=2..46)
# ===========================================================================
def build_ruin_shrine_gate() -> Image.Image:
    c = Canvas(48, 48)

    # --- A. Ornate Stone Ridge Crest & Central Acroterion (y=2..5, x=7..40) ---
    c.hline(8, 39, 2, "S0", "stone")
    c.hline(8, 39, 3, "S7", "stone")
    c.hline(9, 22, 3, "S8", "stone")
    c.hline(25, 38, 3, "P4", "stone")
    c.hline(8, 39, 4, "S5", "stone")
    c.hline(8, 21, 4, "P3", "stone")
    c.vline(7, 3, 4, "S0", "stone")
    c.vline(40, 3, 4, "S0", "stone")
    # Corner ridge acroteria blocks (x=8..10, x=37..39)
    for rx in (8, 37):
        c.set(rx + 1, 3, "S8", "stone")
        c.set(rx + 1, 4, "S6", "stone")
        c.set(rx + 2, 4, "S3", "stone")
    # Raised central ridge pediment finial (x=20..27, y=2..5) with cyan sanctum jewel
    c.rect(20, 2, 27, 5, "S6", "stone")
    c.hline(20, 27, 2, "S0", "stone")
    c.vline(20, 2, 5, "S0", "stone")
    c.vline(27, 2, 5, "S0", "stone")
    c.hline(21, 25, 3, "S8", "stone")
    c.set(26, 3, "S6", "stone")
    c.set(21, 4, "S7", "stone")
    c.set(26, 4, "S3", "stone")
    c.hline(21, 26, 5, "S2", "stone")
    # Tiny glowing rune gem in ridge cap
    c.set(23, 3, "C6", "crystal")
    c.set(24, 3, "C4", "crystal")
    c.set(23, 4, "C3", "crystal")
    c.set(24, 4, "C1", "crystal")

    # --- B. Staggered Cobalt-Slate Tiled Roof Band (y=5..14, ref_bd6_row_3x style!) ---
    # 3 staggered courses of scalloped cobalt-slate shingles flaring from x=6..41 to x=3..44
    roof_bounds = {
        5: (6, 41),
        6: (6, 41),
        7: (5, 42),
        8: (5, 42),
        9: (4, 43),
        10: (4, 43),
        11: (4, 43),
        12: (3, 44),
        13: (3, 44),
        14: (3, 44),
    }
    for y in range(5, 15):
        x0, x1 = roof_bounds[y]
        course = (y - 5) // 3  # 0: y=5..7, 1: y=8..10, 2: y=11..13, 3: y=14 drip
        sub = (y - 5) % 3
        stagger = 0 if course % 2 == 0 else 2

        for x in range(x0, x1 + 1):
            if x == x0 or x == x1:
                c.set(x, y, "B0", "roof")
                continue
            if y == 5 and not (20 <= x <= 27):
                # Cast shadow right beneath top stone ridge
                c.set(x, y, "B1" if (x + stagger) % 4 != 1 else "B2", "roof")
                continue
            if y == 14:
                # Scalloped overhanging roof eave drip edge
                phase = (x + stagger) % 4
                if phase == 0:
                    c.set(x, y, "B0", "roof")
                elif phase == 1:
                    c.set(x, y, "B4" if x < 26 else "B3", "roof")
                elif phase == 2:
                    c.set(x, y, "B2", "roof")
                else:
                    c.set(x, y, "B1", "roof")
                continue

            # Staggered 4px-wide individual curved cobalt-slate tiles (ref_bd6 signature!)
            tx = (x + stagger) % 4
            lit_bias = x < 30  # stronger lavender-white specular toward top-left
            if sub == 0:
                # Upper sunlit lip of shingle row
                if tx == 0:
                    tok = "B1"
                elif tx == 1:
                    tok = "B5" if lit_bias else "B4"
                elif tx == 2:
                    tok = "B4" if lit_bias else "B3"
                else:
                    tok = "B3" if lit_bias else "B2"
            elif sub == 1:
                # Mid shingle face with crisp vertical specular streak on tx==1
                if tx == 0:
                    tok = "B1"
                elif tx == 1:
                    tok = "B5" if (x < 22 and course < 2) else "B4"
                elif tx == 2:
                    tok = "B3"
                else:
                    tok = "B2"
            else:
                # Scalloped bottom overlap shadow between shingle courses
                if tx == 0:
                    tok = "B0"
                elif tx in (1, 2):
                    tok = "B2" if lit_bias else "B1"
                else:
                    tok = "B1"
            c.set(x, y, tok, "roof")

        # Beveled hip-ridge trim along left & right roof edges
        if 6 <= y <= 13:
            c.set(x0 + 1, y, "B5" if y % 2 == 0 else "B4", "roof")
            c.set(x1 - 1, y, "B2" if y % 2 == 0 else "B1", "roof")

    # Preserve central ridge pediment overlap on y=5
    c.hline(20, 27, 5, "S2", "stone")
    c.set(20, 5, "S0", "stone")
    c.set(27, 5, "S0", "stone")

    # --- C. Carved Stone Entablature & Classical Dentil Cornice (y=15..18, x=3..44) ---
    c.hline(3, 44, 15, "S7", "stone")
    c.hline(4, 24, 15, "S8", "stone")
    c.hline(25, 43, 15, "P4", "stone")
    c.set(3, 15, "S0", "stone")
    c.set(44, 15, "S0", "stone")

    # Dentil molding frieze at y=16
    c.hline(3, 44, 16, "S5", "stone")
    for dx in range(5, 43):
        if dx % 3 == 0:
            c.set(dx, 16, "S1", "stone")  # recessed dentil shadow pocket
        elif dx % 3 == 1:
            c.set(dx, 16, "S7" if dx < 26 else "P3", "stone")
        else:
            c.set(dx, 16, "S5" if dx < 26 else "P2", "stone")
    c.set(3, 16, "S0", "stone")
    c.set(44, 16, "S0", "stone")

    # Lower cornice molding y=17 & deep cast shadow y=18
    c.hline(3, 44, 17, "S3", "stone")
    c.hline(4, 20, 17, "S4", "stone")
    c.set(3, 17, "S0", "stone")
    c.set(44, 17, "S0", "stone")

    # --- D. Volumetric Ashlar Masonry Facade & Flanking Buttress Pilasters (y=18..46) ---
    # Base mortar matrix across main wall (x=4..43, y=18..46 — ZERO side walls!)
    c.rect(4, 18, 43, 46, "S2", "stone")
    c.hline(4, 43, 18, "S1", "stone")  # deep eave shadow

    # Spandrel ashlar blocks (x=12..35, y=19..28 behind arch)
    spandrel_courses = [
        (19, 22, [(12, 16, "S7", "S5", "S3"), (17, 21, "P4", "P3", "P1"), (26, 30, "S6", "S4", "S3"), (31, 35, "P3", "P2", "P1")]),
        (23, 26, [(12, 15, "P4", "P2", "P1"), (32, 35, "S6", "S4", "D2")]),
        (27, 30, [(12, 14, "S7", "S5", "S3"), (33, 35, "D4", "D3", "D1")]),
        (31, 34, [(12, 14, "P3", "P2", "P0"), (33, 35, "S6", "S4", "S2")]),
        (35, 38, [(12, 14, "S6", "S5", "S3"), (33, 35, "P3", "P1", "P0")]),
        (39, 42, [(12, 14, "D4", "D3", "D1"), (33, 35, "S5", "S4", "S2")]),
    ]
    for y1, y2, blocks in spandrel_courses:
        for bx1, bx2, hi, mid, lo in blocks:
            c.draw_ashlar_block(bx1, y1, bx2, y2, hi, mid, lo, "S2", "stone")

    # Flanking sculpted buttress pilasters: left (x=4..11) and right (x=36..43)
    for is_left, px0, px1 in ((True, 4, 11), (False, 36, 43)):
        # Carved pilaster capital (y=19..21)
        c.draw_ashlar_block(
            px0 + 1, 19, px1 - 1, 21,
            "S8" if is_left else "S7",
            "S6" if is_left else "S5",
            "S3" if is_left else "S2",
            "S1", "stone",
        )
        # Stacked ashlar pilaster courses (y=22..41)
        pilaster_rows = [
            (22, 26, True),
            (27, 31, False),
            (32, 36, True),
            (37, 41, False),
        ]
        for py1, py2, full in pilaster_rows:
            if full:
                hi = "S8" if is_left else "S6"
                mid = "S6" if is_left else "S4"
                lo = "S4" if is_left else "D2"
                c.draw_ashlar_block(px0 + 1, py1, px1 - 1, py2, hi, mid, lo, "S2", "stone")
            else:
                mid_x = (px0 + px1) // 2
                c.draw_ashlar_block(
                    px0 + 1, py1, mid_x, py2,
                    "P4" if is_left else "S6",
                    "P3" if is_left else "P2",
                    "P1" if is_left else "S3",
                    "S2", "stone",
                )
                c.draw_ashlar_block(
                    mid_x + 1, py1, px1 - 1, py2,
                    "S7" if is_left else "D4",
                    "S5" if is_left else "D3",
                    "S3" if is_left else "D1",
                    "S2", "stone",
                )
        # Carved vertical recessed relief channel inside each pilaster (y=24..39)
        cx_l = px0 + 3
        cx_r = px0 + 4
        c.vline(cx_l, 24, 39, "D1", "slate")
        c.vline(cx_r, 24, 39, "S3" if is_left else "D2", "slate")
        c.set(cx_l, 24, "S1", "stone")
        c.set(cx_r, 39, "S7" if is_left else "S5", "stone")

        # Flared heavy stepped stone plinth at base (y=42..46, x=3..13 left / x=34..44 right)
        bx0 = 3 if is_left else 34
        bx1 = 13 if is_left else 44
        c.hline(bx0, bx1, 42, "S0", "stone")
        c.hline(bx0 + 1, bx1 - 1, 42, "S8" if is_left else "S7", "stone")
        c.draw_ashlar_block(
            bx0 + 1, 43, (bx0 + bx1) // 2, 45,
            "S7" if is_left else "S6",
            "S5" if is_left else "S4",
            "S3" if is_left else "D2",
            "S1", "stone",
        )
        c.draw_ashlar_block(
            (bx0 + bx1) // 2 + 1, 43, bx1 - 1, 45,
            "P4" if is_left else "P3",
            "P2" if is_left else "S4",
            "P1" if is_left else "S2",
            "S1", "stone",
        )
        c.vline(bx0, 42, 46, "S0", "stone")
        c.vline(bx1, 42, 46, "S0", "stone")
        c.hline(bx0, bx1, 46, "S0", "stone")

    # Outer pilaster vertical outlines (x=4 and x=43 for y=18..41)
    c.vline(4, 18, 41, "S0", "stone")
    c.vline(43, 18, 41, "S0", "stone")
    # Weathered masonry crack on right pilaster
    c.set(41, 29, "S1", "stone")
    c.set(40, 30, "S0", "stone")
    c.set(39, 31, "S1", "stone")
    c.set(40, 31, "S7", "stone")

    # --- E. Deep Shadowed 24px-Tall Arched Portal (y=22..45, x=15..32 = 18w x 24h!) ---
    # Smooth semicircular/tudor arch insets at top of doorway (y=22..28)
    arch_insets = {22: 5, 23: 3, 24: 2, 25: 1, 26: 1, 27: 0}
    for y in range(19, 46):
        if y < 22:
            # Smooth rounded radial stone voussoir arch extrados above portal apex (y=19..21)
            rx0 = 18 if y == 19 else (16 if y == 20 else 14)
            rx1 = 29 if y == 19 else (31 if y == 20 else 33)
            for x in range(rx0, rx1 + 1):
                if x in (rx0, rx1) and y <= 20:
                    c.set(x, y, "S2", "stone")
                else:
                    c.set(x, y, "S8" if x < 21 else ("S7" if x < 26 else "S5"), "stone")
            # Radial voussoir mortar joints
            for jx in (19, 28):
                if rx0 < jx < rx1:
                    c.set(jx, y, "S2", "stone")
            continue

        ins = arch_insets.get(y, 0)
        ax0 = 15 + ins
        ax1 = 32 - ins

        # 3px beveled stone arch jambs / voussoirs flanking doorway
        for k in (3, 2, 1):
            lx = ax0 - k
            rx = ax1 + k
            if lx >= 12:
                if k == 3:
                    c.set(lx, y, "S2" if y % 4 == 0 else "S7", "stone")
                elif k == 2:
                    c.set(lx, y, "S2" if y % 4 == 0 else ("S6" if y < 34 else "P3"), "stone")
                else:
                    c.set(lx, y, "S3", "stone")
            if rx <= 35:
                if k == 1:
                    c.set(rx, y, "S7" if (y < 38 and y % 4 != 0) else "S5", "stone")  # inner right jamb catches top-left light!
                elif k == 2:
                    c.set(rx, y, "S2" if y % 4 == 0 else "S5", "stone")
                else:
                    c.set(rx, y, "S2", "stone")

        # Deep receding sanctuary portal interior (y=22..42)
        if y <= 42:
            for x in range(ax0, ax1 + 1):
                if x == ax0 or y == 22 or (y <= 25 and (x == ax0 + 1)):
                    # Cast shadow inner archivolt
                    c.set(x, y, "I0", "iron")
                elif x == ax1:
                    # Subtle ambient slate rim on inner right jamb
                    c.set(x, y, "D1" if y >= 27 else "D0", "slate")
                elif x in (ax0 + 1, ax1 - 1):
                    # Receding inner stonework blocks
                    c.set(x, y, "D0" if y % 4 != 0 else "I0", "slate")
                elif y >= 40:
                    # Faintly visible receding inner stone steps fading into darkness
                    if y == 40:
                        c.set(x, y, "I0" if x in (ax0 + 2, ax1 - 2) else "B0", "iron")
                    elif y == 41:
                        c.set(x, y, "I1" if 19 <= x <= 28 else "I0", "iron")
                    else:
                        c.set(x, y, "D0" if 18 <= x <= 29 else "I0", "slate")
                else:
                    # Deepest ancient sanctuary void (never #000000 — uses B0 #13122f / I0 #1c1c26)
                    c.set(x, y, "B0" if y < 37 else "I0", "roof")

    # --- F. Sculpted Trapezoidal Keystone & Glowing Cyan Sanctuary Rune Crest (x=21..26, y=17..23) ---
    for y in range(17, 24):
        kx0 = 21 if y <= 20 else 22
        kx1 = 26 if y <= 20 else 25
        for x in range(kx0, kx1 + 1):
            if x == kx0 or y == 17:
                c.set(x, y, "S8" if y > 17 else "S2", "stone")
            elif x == kx1 or y == 23:
                c.set(x, y, "S2", "stone")
            else:
                c.set(x, y, "S6", "stone")
    c.hline(21, 26, 17, "S8", "stone")
    c.set(21, 17, "S2", "stone")
    c.set(26, 17, "S2", "stone")
    # Glowing cyan carved rune inside keystone + subtle cyan bounce light on arch lip!
    keystone_rune = [
        (23, 18, "C4"), (24, 18, "C2"),
        (22, 19, "C3"), (23, 19, "C6"), (24, 19, "C5"), (25, 19, "C2"),
        (22, 20, "C1"), (23, 20, "C5"), (24, 20, "C4"), (25, 20, "C0"),
        (23, 21, "C2"), (24, 21, "C1"),
    ]
    for rx, ry, rc in keystone_rune:
        c.set(rx, ry, rc, "crystal")
    # Cyan bounce light on adjacent arch stones
    c.set(20, 21, "C3", "crystal")
    c.set(27, 21, "C2", "crystal")

    # --- G. Stepped Worn Stone Threshold (y=43..46, x=13..34) ---
    # Upper inner threshold step (y=43..44, x=15..32)
    c.hline(15, 32, 43, "S6", "stone")
    c.hline(18, 28, 43, "S7", "stone")  # foot-worn pale center tread
    c.set(15, 43, "D2", "slate")
    c.set(32, 43, "D2", "slate")
    # Lower broad threshold step (y=44..46, x=13..34)
    c.hline(13, 34, 44, "S8", "stone")
    c.hline(26, 33, 44, "P4", "stone")
    c.hline(14, 33, 45, "S5", "stone")
    c.hline(26, 33, 45, "S4", "stone")
    for jx in (18, 24, 29):
        c.set(jx, 44, "S4", "stone")
        c.set(jx, 45, "S2", "stone")
    c.hline(13, 34, 46, "S0", "stone")

    # --- H. Lush Draping Beodeul Moss & Hanging Vines ---
    # 1. Grand cascading moss mat over left cobalt roof eave & down left pilaster (x=4..14, y=9..26)
    left_moss = [
        (6, 9, "F1"), (7, 9, "F3"), (8, 9, "F2"),
        (5, 10, "F2"), (6, 10, "F4"), (7, 10, "F5"), (8, 10, "F4"), (9, 10, "F2"), (10, 10, "F1"),
        (4, 11, "F1"), (5, 11, "F4"), (6, 11, "F5"), (7, 11, "F4"), (8, 11, "G3"), (9, 11, "F3"), (10, 11, "F2"), (11, 11, "F1"),
        (4, 12, "F2"), (5, 12, "F4"), (6, 12, "G4"), (7, 12, "F3"), (8, 12, "F4"), (9, 12, "F3"), (10, 12, "F2"), (11, 12, "F3"), (12, 12, "F1"),
        (4, 13, "F1"), (5, 13, "F3"), (6, 13, "F5"), (7, 13, "F4"), (8, 13, "F2"), (9, 13, "F4"), (10, 13, "F3"), (11, 13, "F2"), (12, 13, "F1"),
        (4, 14, "F0"), (5, 14, "F3"), (6, 14, "F4"), (7, 14, "F3"), (8, 14, "F1"), (9, 14, "F3"), (10, 14, "F4"), (11, 14, "F2"), (12, 14, "F1"),
        (5, 15, "F2"), (6, 15, "F4"), (7, 15, "F2"), (9, 15, "F2"), (10, 15, "F3"), (11, 15, "F1"),
        (5, 16, "F3"), (6, 16, "F3"), (7, 16, "F1"), (9, 16, "F3"), (10, 16, "F2"),
        # Three distinct hanging vine tendrils with sunlit leaf tips
        (5, 17, "F2"), (6, 17, "F4"), (9, 17, "F2"), (10, 17, "F1"),
        (5, 18, "F3"), (6, 18, "F2"), (9, 18, "F4"), (10, 18, "F2"),
        (5, 19, "F4"), (6, 19, "F1"), (9, 19, "F3"),
        (5, 20, "F3"), (6, 20, "F2"), (9, 20, "F2"),
        (5, 21, "F2"), (6, 21, "F4"), (9, 21, "F1"),
        (6, 22, "F3"), (6, 23, "F2"), (5, 24, "F3"), (6, 24, "F1"), (5, 25, "F2"), (5, 26, "F1"),
    ]
    for mx, my, mc in left_moss:
        c.set(mx, my, mc, "moss")

    # 2. Upper-right cornice moss & short vine (x=35..42, y=13..21)
    right_moss = [
        (36, 13, "F2"), (37, 13, "F4"), (38, 13, "F3"), (39, 13, "F1"),
        (35, 14, "F1"), (36, 14, "F4"), (37, 14, "F5"), (38, 14, "F3"), (39, 14, "F2"), (40, 14, "F1"),
        (36, 15, "F2"), (37, 15, "F3"), (38, 15, "F4"), (39, 15, "F2"), (40, 15, "F1"),
        (38, 16, "F3"), (39, 16, "F2"),
        (38, 17, "F4"), (39, 17, "F1"),
        (38, 18, "F2"), (39, 18, "F3"),
        (39, 19, "F2"), (39, 20, "F1"),
    ]
    for mx, my, mc in right_moss:
        c.set(mx, my, mc, "moss")

    # 3. Ground moss cushions hugging left & right stone plinths
    base_moss = [
        (4, 41, "F2"), (5, 41, "F4"), (6, 41, "F3"), (7, 41, "F1"),
        (4, 42, "F3"), (5, 42, "F5"), (6, 42, "F4"), (7, 42, "F2"), (8, 42, "F1"),
        (4, 43, "F2"), (5, 43, "F3"), (6, 43, "F2"),
        (39, 42, "F3"), (40, 42, "F4"), (41, 42, "F2"),
        (38, 43, "F2"), (39, 43, "F4"), (40, 43, "F3"), (41, 43, "F2"), (42, 43, "F1"),
        (39, 44, "F2"), (40, 44, "F1"),
    ]
    for mx, my, mc in base_moss:
        c.set(mx, my, mc, "moss")

    c.enforce_dark_outline()
    # Ground contact shadow (#4c557f@85) along bottom & 1px outer plinth edge
    c.shadow_band_if_empty(2, 45, 46, 47)
    c.set(2, 45, "SH")
    c.set(45, 45, "SH")
    return c.im


# ===========================================================================
# 2. crystal_rune_altar.png (32x32, standing, op 26x29: x=3..28, y=2..30)
# ===========================================================================
def build_crystal_rune_altar() -> Image.Image:
    c = Canvas(32, 32)

    # --- A. Tiered Ancient Stone Pedestal & Flared Stepped Base (y=15..30, x=3..28) ---
    # 1. 3/4 Lit Altar Top Slab / Mensa (y=15..19, x=4..27 — zero side walls!)
    c.hline(5, 26, 15, "S0", "stone")
    c.rect(4, 16, 27, 19, "S6", "stone")
    c.hline(5, 22, 16, "S8", "stone")
    c.hline(23, 26, 16, "P4", "stone")
    c.hline(5, 19, 17, "S7", "stone")
    c.hline(20, 26, 17, "P3", "stone")
    c.hline(5, 26, 18, "S6", "stone")
    c.hline(5, 26, 19, "S3", "stone")  # beveled front cornice lip
    c.vline(4, 16, 19, "S0", "stone")
    c.vline(27, 16, 19, "S0", "stone")
    # Carved glowing cyan mana channel engraved into top mensa around crystal socket
    for gx, gy, gc in [
        (6, 17, "C2"), (7, 17, "C4"), (8, 17, "C5"),
        (23, 17, "C4"), (24, 17, "C3"), (25, 17, "C1"),
        (7, 18, "C2"), (24, 18, "C1"),
    ]:
        c.set(gx, gy, gc, "crystal")

    # Dark slate & antique bronze socket cradling the giant crystal (x=9..22, y=15..18)
    c.rect(9, 15, 22, 18, "D0", "slate")
    c.hline(10, 21, 16, "D1", "slate")
    c.hline(10, 21, 17, "D2", "slate")
    c.hline(9, 22, 18, "I0", "iron")
    # Antique bronze prongs clasping crystal base (left x=9..10, right x=21..22)
    c.set(9, 15, "O0", "wood")
    c.set(9, 16, "A8", "wood")
    c.set(10, 16, "A6", "wood")
    c.set(9, 17, "O5", "wood")
    c.set(22, 15, "O0", "wood")
    c.set(21, 16, "O7", "wood")
    c.set(22, 16, "O4", "wood")
    c.set(22, 17, "O2", "wood")

    # 2. Sculpted Pedestal Body with Recessed Carved Rune Panels (y=20..26, x=5..26)
    c.rect(5, 20, 26, 26, "S4", "stone")
    c.hline(5, 26, 20, "S1", "stone")  # crisp cornice overhang shadow!
    c.vline(5, 20, 26, "S0", "stone")
    c.vline(26, 20, 26, "S0", "stone")
    # Left & right carved corner pilasters (x=6..8, x=23..25)
    c.draw_ashlar_block(6, 21, 8, 23, "S8", "S6", "S4", "S2", "stone")
    c.draw_ashlar_block(6, 24, 8, 26, "P4", "P3", "P1", "S2", "stone")
    c.draw_ashlar_block(23, 21, 25, 23, "S6", "S5", "D2", "S2", "stone")
    c.draw_ashlar_block(23, 24, 25, 26, "P3", "P2", "S3", "S2", "stone")

    # Deeply recessed dark-slate rune frieze panel (x=9..22, y=21..26)
    c.rect(9, 21, 22, 25, "D1", "slate")
    c.hline(9, 22, 21, "D0", "slate")
    c.vline(9, 21, 25, "D0", "slate")
    c.hline(9, 22, 26, "S6", "stone")  # sunlit lower panel sill!
    c.vline(22, 22, 25, "D3", "slate")  # inner right catch-light bevel
    # Stone divider mullions creating 3 recessed rune niches: (10..12), (14..17), (19..21)
    c.vline(13, 22, 25, "S3", "stone")
    c.vline(18, 22, 25, "S3", "stone")
    # Glowing cyan runes inside the 3 carved niches!
    panel_runes = [
        # Left niche rune
        (11, 22, "C5"), (10, 23, "C3"), (11, 23, "C4"), (11, 24, "C2"),
        # Center grand diamond rune
        (15, 22, "C6"), (16, 22, "C4"),
        (14, 23, "C4"), (15, 23, "C6"), (16, 23, "C5"), (17, 23, "C2"),
        (15, 24, "C3"), (16, 24, "C2"),
        # Right niche rune
        (20, 22, "C4"), (20, 23, "C5"), (21, 23, "C2"), (20, 24, "C2"),
    ]
    for rx, ry, rc in panel_runes:
        c.set(rx, ry, rc, "crystal")

    # 3. Flared Stepped Ashlar Base (y=27..30, x=3..28)
    # Upper base collar y=27 (x=4..27)
    c.hline(4, 27, 27, "S7", "stone")
    c.hline(19, 26, 27, "P3", "stone")
    c.set(4, 27, "S0", "stone")
    c.set(27, 27, "S0", "stone")
    # Flared bottom ashlar step y=28..30 (x=3..28)
    c.hline(3, 28, 28, "S8", "stone")
    c.hline(16, 27, 28, "S6", "stone")
    c.hline(4, 27, 29, "S4", "stone")
    c.hline(4, 11, 29, "S5", "stone")
    c.hline(21, 27, 29, "D2", "slate")
    for jx in (9, 15, 22):
        c.set(jx, 28, "S4", "stone")
        c.set(jx, 29, "S2", "stone")
    c.vline(3, 28, 30, "S0", "stone")
    c.vline(28, 28, 30, "S0", "stone")
    c.hline(3, 28, 30, "S0", "stone")

    # Moss cushions on lower-left step & right pilaster joint
    altar_moss = [
        (5, 26, "F2"), (6, 26, "F4"), (7, 26, "F3"),
        (4, 27, "F1"), (5, 27, "F5"), (6, 27, "F4"), (7, 27, "F2"), (8, 27, "F1"),
        (4, 28, "F2"), (5, 28, "F3"), (6, 28, "F2"),
        (24, 25, "F3"), (25, 25, "F4"), (24, 26, "F2"), (25, 26, "F3"), (26, 26, "F1"),
    ]
    for mx, my, mc in altar_moss:
        c.set(mx, my, mc, "moss")

    # --- B. Giant Faceted Sanctuary Crystal (y=2..17, x=10..21) + Sprouts ---
    # 3 distinct planar facets + dazzling white-cyan ridge highlight!
    # Legend: 0=C0, W=W0, 1=W1, 2=C1, 3=W4, 4=C2, 5=C3, 6=C4, 7=C5, 8=C6
    crystal_grid = [
        "....W0......",  # y=2  apex
        "...W870.....",  # y=3
        "..W88740....",  # y=4
        "..0878520...",  # y=5
        ".W87685410..",  # y=6
        ".0776844210.",  # y=7
        ".0766843210.",  # y=8
        "W87657432110",  # y=9
        "076657432210",  # y=10
        "076547332520",  # y=11 (5 on right = internal cyan bounce!)
        "065546322310",  # y=12
        "065445321210",  # y=13
        ".0544422110.",  # y=14
        ".044332110..",  # y=15
        "..0332110...",  # y=16
    ]
    cmap = {
        "W": "W0",
        "0": "C0",
        "1": "W1",
        "2": "C1",
        "3": "W4",
        "4": "C2",
        "5": "C3",
        "6": "C4",
        "7": "C5",
        "8": "C6",
    }
    for gy, row in enumerate(crystal_grid):
        for gx, ch in enumerate(row):
            if ch != ".":
                c.set(10 + gx, 2 + gy, cmap[ch], "crystal")

    # Left & right secondary crystal sprouts jutting diagonally from socket
    left_sprout = [
        (8, 12, "W0"), (9, 12, "C0"),
        (7, 13, "W0"), (8, 13, "C6"), (9, 13, "C4"), (10, 13, "C0"),
        (7, 14, "C0"), (8, 14, "C5"), (9, 14, "C2"), (10, 14, "C1"),
        (8, 15, "C0"), (9, 15, "C4"), (10, 15, "C2"),
        (9, 16, "C0"), (10, 16, "C1"),
    ]
    right_sprout = [
        (22, 12, "C0"), (23, 12, "W0"),
        (21, 13, "C0"), (22, 13, "C5"), (23, 13, "C2"), (24, 13, "W0"),
        (21, 14, "C2"), (22, 14, "C4"), (23, 14, "C1"), (24, 14, "C0"),
        (21, 15, "C2"), (22, 15, "C1"), (23, 15, "C0"),
        (21, 16, "W1"),
    ]
    for sx, sy, sc in left_sprout + right_sprout:
        c.set(sx, sy, sc, "crystal")

    # --- C. Two Floating Sanctuary Crystal Shards (left x=4..7, y=6..11; right x=24..27, y=5..10) ---
    # Every outer edge pixel is W0/C0 (dark crystal outline), dazzling C6/C5/C4 faceted interior!
    left_shard = [
        (5, 6, "W0"), (6, 6, "C0"),
        (4, 7, "W0"), (5, 7, "C6"), (6, 7, "C4"), (7, 7, "C0"),
        (4, 8, "C0"), (5, 8, "C5"), (6, 8, "C2"), (7, 8, "C0"),
        (4, 9, "C0"), (5, 9, "C4"), (6, 9, "C1"), (7, 9, "W0"),
        (5, 10, "C0"), (6, 10, "W0"),
    ]
    right_shard = [
        (25, 5, "W0"), (26, 5, "C0"),
        (24, 6, "W0"), (25, 6, "C6"), (26, 6, "C3"), (27, 6, "C0"),
        (24, 7, "C0"), (25, 7, "C5"), (26, 7, "C2"), (27, 7, "W0"),
        (24, 8, "C0"), (25, 8, "C3"), (26, 8, "C1"), (27, 8, "W0"),
        (25, 9, "C0"), (26, 9, "W0"),
    ]
    for fx, fy, fc in left_shard + right_shard:
        c.set(fx, fy, fc, "crystal")

    c.enforce_dark_outline()
    c.shadow_band_if_empty(2, 29, 30, 31)
    c.set(2, 29, "SH")
    c.set(29, 29, "SH")
    return c.im


# ===========================================================================
# 3. stone_guardian_statue.png (16x32, standing, op 16x27: x=0..15, y=4..30)
# ===========================================================================
def build_stone_guardian_statue() -> Image.Image:
    """Sculpted weathered stone horned-knight guardian holding an upright broadsword
    on viewer's left (x=0..5) and a beveled kite shield with cyan gem on viewer's right
    (x=7..15), standing atop a mossy square 3/4 stone plinth (y=24..30).
    """
    c = Canvas(16, 32)

    # Craft all 27 rows with unmistakable silhouette separation:
    # Outward-sweeping knight horns (x=1..3 & x=12..14) flanking a peaked domed great-helm (x=5..10),
    # razor-straight upright stone broadsword on left (x=0..5), tapered kite shield on right (x=9..15),
    # twin armored greaves, and mossy 3/4 square stone plinth (y=24..30)!
    rows = [
        ".00...0000...00.",  # y=4  sharp outward horn tips + peaked great-helm crown!
        ".080.088760.06d.",  # y=5  sweeping curved horns separated from domed helm!
        ".0760877654054d.",  # y=6  horns joining helm temples + chiseled crest ridge
        "..06578766543d..",  # y=7  sunlit brow ridge above visor
        ".d0001176113dd..",  # y=8  sword tip (x=1..2) + deep T-visor eye slits & nasal bar
        ".d8307611542d...",  # y=9  upright blade + sunlit cheekguards & T-visor breathing slit
        ".d840651143dd...",  # y=10 upright blade + armored chin/gorget
        ".d84078654fdd0..",  # y=11 upright blade + pauldron + shield top rim
        ".d84ny765d8876d.",  # y=12 upright blade + mossy pauldron + kite shield top bevel
        ".d74uv654d8fgg5d",  # y=13 upright blade + breastplate + broad kite shield (x=9..15)
        "008715654d7fwk4d",  # y=14 sword crossguard top + chest + cyan shield boss (w,k)
        "088764143d7fcc4d",  # y=15 broad crossguard (x=0..5) + waist + shield boss (c,c)
        "003652564d6fgg3d",  # y=16 gauntleted fist on hilt + armored belt + kite shield
        "..0741653d6ff3d.",  # y=17 sword grip + pleated tabard + tapering shield
        "..0630752d5fe2d.",  # y=18 pommel (x=2..3) + left greave + shield taper
        "...0007511543d..",  # y=19 armored greaves/knees + shield lower point
        "....076416520...",  # y=20 twin stone greaves separated by dark seam (x=8)
        "....075316420...",  # y=21 twin stone sabatons/boots
        "...07764165320..",  # y=22 planted stone feet on plinth
        "..000000000000..",  # y=23 dark contact crease atop plinth
        ".0888777666r540.",  # y=24 3/4 lit square plinth top front bevel
        ".077666q5554430.",  # y=25 3/4 lit plinth top surface
        ".0663eeeff34320.",  # y=26 carved plinth dado front (recessed slate center)
        ".06vz2eeff44320.",  # y=27 plinth front with bright moss tuft (v,z)
        "007vyu5544332100",  # y=28 flared stepped plinth base + cascading moss
        "076nv4q443322110",  # y=29 weathered lower plinth step (ashlar warm/cool)
        "000mm00000000000",  # y=30 1px dark stone & moss bottom outline!
    ]

    tok_map = {
        "0": ("S0", "stone"),
        "1": ("S1", "stone"),
        "2": ("S2", "stone"),
        "3": ("S3", "stone"),
        "4": ("S4", "stone"),
        "5": ("S5", "stone"),
        "6": ("S6", "stone"),
        "7": ("S7", "stone"),
        "8": ("S8", "stone"),
        "d": ("D0", "slate"),
        "e": ("D1", "slate"),
        "f": ("D2", "slate"),
        "g": ("D3", "slate"),
        "h": ("D4", "slate"),
        "p": ("P2", "stone"),
        "q": ("P3", "stone"),
        "r": ("P4", "stone"),
        "c": ("C2", "crystal"),
        "k": ("C4", "crystal"),
        "w": ("C6", "crystal"),
        "m": ("F0", "moss"),
        "n": ("F1", "moss"),
        "u": ("F2", "moss"),
        "v": ("F3", "moss"),
        "y": ("F4", "moss"),
        "z": ("F5", "moss"),
    }

    for ry, row in enumerate(rows):
        assert len(row) == 16, f"Row {ry} length {len(row)} != 16"
        for rx, ch in enumerate(row):
            if ch != ".":
                tok, mat = tok_map[ch]
                c.set(rx, 4 + ry, tok, mat)

    c.enforce_dark_outline()
    c.shadow_band_if_empty(0, 15, 30, 31)
    return c.im


# ===========================================================================
# 4. carved_rune_stele.png (32x32, standing, op 26x29: x=3..28, y=2..30)
# ===========================================================================
def build_carved_rune_stele() -> Image.Image:
    """Monumental rounded-top ancient stone rune tablet (`ref_ezx_row_4x.png` finish!)
    with thick 3/4 lit top stone arch & stepped side buttress shoulders, deeply recessed
    dark-slate tablet bearing glowing cyan glyph rows, diagonal fracture crack & moss!
    """
    c = Canvas(32, 32)

    # --- A. Flanking Curved/Stepped Buttress Shoulders (x=5..26, y=8..26) ---
    shoulder_bounds = {8: (7, 24), 9: (6, 25)}
    for y in range(8, 27):
        sx0, sx1 = shoulder_bounds.get(y, (5, 26))
        for x in range(sx0, sx1 + 1):
            if x == sx0 or x == sx1 or y == 8:
                c.set(x, y, "S0", "stone")
            elif y <= 11:
                # 3/4 lit top bevel of flanking stone shoulders (ref_ezx signature!)
                c.set(x, y, "S8" if x < 12 else ("S6" if x < 20 else "D4"), "stone")
            else:
                # Stacked weathered ashlar shoulder blocks
                is_left = x < 16
                course = (y - 12) // 4
                if (y - 12) % 4 == 3:
                    c.set(x, y, "S2", "stone")
                elif is_left:
                    c.set(x, y, "S7" if x == sx0 + 1 else ("P3" if course % 2 == 1 else "S5"), "stone")
                else:
                    c.set(x, y, "S3" if x == sx1 - 1 else ("P2" if course % 2 == 0 else "D3"), "stone")

    # --- B. Monumental Rounded-Top Central Stele Monolith (x=8..23, y=2..26) ---
    arch_x = {2: (12, 19), 3: (10, 21), 4: (9, 22), 5: (8, 23)}
    for y in range(2, 27):
        x0, x1 = arch_x.get(y, (8, 23))
        for x in range(x0, x1 + 1):
            # Outer monolith rim / vertical shadow crease against flanking shoulders
            if y == 2 or (y <= 7 and (x == x0 or x == x1)):
                c.set(x, y, "S0", "stone")
            elif x == 8:
                c.set(x, y, "S2", "stone")  # crisp vertical seam between left shoulder & monolith
            elif x == 23:
                c.set(x, y, "S1", "stone")  # shadow seam between monolith & right shoulder
            elif y <= 6:
                # 3/4 lit rounded arch thickness band (3-4px thick, ref_ezx finish!)
                if x < 15:
                    c.set(x, y, "S8" if y <= 4 else "S7", "stone")
                elif x < 19:
                    c.set(x, y, "P4" if y <= 4 else "S6", "stone")
                else:
                    c.set(x, y, "S6" if y <= 4 else "D4", "stone")
            else:
                # Front stone frame surrounding recessed rune tablet
                if x == 9:
                    c.set(x, y, "S7" if y < 20 else "P4", "stone")
                elif x == 22:
                    c.set(x, y, "S4" if y < 18 else "D2", "stone")
                else:
                    c.set(x, y, "S5", "stone")
    # Smooth arch outline pixels on y=3..5 transitions
    for ox, oy in [(10, 3), (11, 3), (20, 3), (21, 3), (9, 4), (22, 4), (8, 5), (23, 5)]:
        c.set(ox, oy, "S0", "stone")

    # --- C. Deeply Recessed Dark-Slate Rune Tablet (x=10..21, y=7..24) ---
    for y in range(7, 25):
        tx0 = 12 if y == 7 else (11 if y == 8 else 10)
        tx1 = 19 if y == 7 else (20 if y == 8 else 21)
        for x in range(tx0, tx1 + 1):
            if y == 7 or (y == 8 and x in (11, 20)) or x == tx0:
                # Deep recessed top-left inner shadow bevel
                c.set(x, y, "D0" if y < 20 else "S1", "slate")
            elif y == 24 or x == tx1:
                # Sunlit bottom-right inner catch-light bevel!
                c.set(x, y, "S6" if y == 24 else "D3", "stone")
            else:
                # Subtle mottled dark-slate tablet face
                c.set(x, y, "D1" if (x + y) % 5 != 0 else "D2", "slate")

    # --- D. Carved Glowing Cyan Sanctuary Emblem & 4 Ancient Glyph Rows ---
    # 1. Arch Crown Sanctuary Medallion (y=8..11, x=13..18)
    crown_glyph = [
        (15, 8, "C3"), (16, 8, "C2"),
        (14, 9, "C4"), (15, 9, "C6"), (16, 9, "C5"), (17, 9, "C2"),
        (13, 10, "C2"), (14, 10, "C3"), (15, 10, "C5"), (16, 10, "C4"), (17, 10, "C1"), (18, 10, "C2"),
        (15, 11, "C2"), (16, 11, "C1"),
    ]
    for gx, gy, gc in crown_glyph:
        c.set(gx, gy, gc, "crystal")

    # 2. Four rows of deeply incised glowing cyan Beodeul runes (2px tall glyph strokes!)
    # Row 1 (y=13..14): bright luminous cyan
    row1 = [
        (11, 13, "C0"), (12, 13, "C5"), (13, 13, "C4"), (12, 14, "C3"),
        (15, 13, "C6"), (16, 13, "C4"), (15, 14, "C4"), (16, 14, "C2"),
        (18, 13, "C5"), (19, 13, "C3"), (19, 14, "C4"), (20, 14, "C1"),
    ]
    # Row 2 (y=16..17): crisp cyan-teal runes
    row2 = [
        (12, 16, "C5"), (13, 16, "C3"), (12, 17, "C3"), (13, 17, "C4"),
        (15, 16, "C4"), (16, 16, "C5"), (15, 17, "C2"),
        (18, 16, "C4"), (19, 16, "C2"), (18, 17, "C3"), (19, 17, "C4"),
    ]
    # Row 3 (y=19..20): slightly weathered cyan-teal runes
    row3 = [
        (11, 19, "C4"), (12, 19, "C3"), (12, 20, "C2"),
        (14, 19, "C5"), (15, 19, "C3"), (14, 20, "C3"), (15, 20, "C2"),
        (17, 19, "C3"), (18, 19, "C4"), (18, 20, "C2"), (19, 20, "C1"),
    ]
    # Row 4 (y=22..23): ancient lower inscription fading toward right crack/moss
    row4 = [
        (12, 22, "C4"), (13, 22, "C2"), (12, 23, "C2"),
        (15, 22, "C3"), (16, 22, "C4"), (16, 23, "C2"),
        (18, 22, "C2"), (19, 22, "W4"), (18, 23, "C1"),
    ]
    for gx, gy, gc in row1 + row2 + row3 + row4:
        c.set(gx, gy, gc, "crystal")

    # --- E. Weathered Diagonal Fracture Cracks ---
    # Upper-right arch crack cutting into tablet edge + 1px catch-light chip
    crack_px = [
        (20, 4, "S1"), (20, 5, "S0"), (19, 6, "S1"), (20, 6, "S8"),
        (19, 7, "D0"), (18, 8, "C0"),
        # Lower-left shoulder fracture
        (8, 21, "S0"), (9, 22, "S1"), (9, 23, "S7"),
    ]
    for kx, ky, kc in crack_px:
        c.set(kx, ky, kc, "stone")

    # --- F. Stepped Contoured Pedestal Base (`ref_ezx_row_4x` projecting center step, y=25..30, x=3..28) ---
    # Upper plinth collar (y=25..26, x=4..27)
    c.hline(4, 27, 25, "S0", "stone")
    c.hline(5, 22, 25, "S7", "stone")
    c.hline(23, 26, 25, "S5", "stone")
    c.hline(4, 27, 26, "S5", "stone")
    c.hline(5, 11, 26, "P3", "stone")
    c.set(4, 26, "S0", "stone")
    c.set(27, 26, "S0", "stone")

    # Broad stepped base (y=27..29, x=3..28) + projecting center step (x=9..22, y=27..30)
    c.rect(3, 27, 28, 29, "S4", "stone")
    c.hline(4, 27, 27, "S7", "stone")
    c.hline(10, 21, 27, "S8", "stone")  # bright projecting center step tread!
    c.hline(4, 9, 28, "S5", "stone")
    c.hline(10, 21, 28, "S7", "stone")
    c.hline(22, 27, 28, "D2", "slate")
    c.hline(3, 28, 29, "S0", "stone")
    # Projecting center step extends 1px lower to y=30 (x=8..23) — classic ref_ezx contoured base!
    c.hline(9, 22, 29, "S4", "stone")
    c.hline(10, 17, 29, "S5", "stone")
    c.hline(8, 23, 30, "S0", "stone")
    c.vline(8, 28, 30, "S2", "stone")
    c.vline(23, 28, 30, "S2", "stone")
    c.set(8, 30, "S0", "stone")
    c.set(23, 30, "S0", "stone")
    c.vline(3, 27, 29, "S0", "stone")
    c.vline(28, 27, 29, "S0", "stone")
    # Block joints on base
    for jx in (7, 13, 18, 24):
        c.set(jx, 28, "S2", "stone")

    # --- G. Clinging Beodeul Moss Tufts (upper-left shoulder & lower-right plinth) ---
    stele_moss = [
        # Upper-left shoulder moss + hanging tendril
        (6, 9, "F2"), (7, 9, "F4"), (8, 9, "F3"),
        (5, 10, "F1"), (6, 10, "F5"), (7, 10, "F4"), (8, 10, "F2"), (9, 10, "F1"),
        (5, 11, "F2"), (6, 11, "F4"), (7, 11, "F3"), (8, 11, "F1"),
        (6, 12, "F3"), (7, 12, "F2"),
        (6, 13, "F4"), (6, 14, "F2"), (6, 15, "F1"),
        # Lower-right plinth moss cushion
        (22, 24, "F2"), (23, 24, "F4"), (24, 24, "F3"),
        (21, 25, "F2"), (22, 25, "F5"), (23, 25, "F4"), (24, 25, "F3"), (25, 25, "F2"),
        (22, 26, "F3"), (23, 26, "F4"), (24, 26, "F2"), (25, 26, "F3"), (26, 26, "F1"),
        (23, 27, "F3"), (24, 27, "F2"), (25, 27, "F1"),
    ]
    for mx, my, mc in stele_moss:
        c.set(mx, my, mc, "moss")

    c.enforce_dark_outline()
    # Ground shadow tucking neatly beneath side wings (y=29..30) and front step (y=30..31)
    c.shadow_band_if_empty(3, 28, 30, 30)
    c.shadow_band_if_empty(7, 24, 31, 31)
    return c.im


# ===========================================================================
# 5. sanctuary_fountain_round.png (32x32, topdown, op 28x25: x=2..29, y=5..29)
# ===========================================================================
def build_sanctuary_fountain_round() -> Image.Image:
    """Lush circular stone courtyard fountain (`ref_s4_best_row.png` style!)
    with radial-jointed beveled ashlar rim, short 3px curved front stone skirt
    (topdown >= 85% top + water!), deep sea-teal sanctuary water with concentric
    cyan-white ripples, central sculpted spout & sparkling water plume + foam ring!
    """
    c = Canvas(32, 32)
    cx, cy = 15.5, 15.5  # oval top rim spans x=2..29 (rx=13.9), y=5..26 (ry=10.6)
    rx_out, ry_out = 13.9, 10.6
    rx_in, ry_in = 10.6, 7.6

    # --- A. Short 3px Curved Front Ashlar Wall Skirt along South Arc (y=17..29) ---
    # Shifts ellipse center down by +3.0px so y_max = 15.5 + 3.0 + 10.6 = 29.1 -> row 29!
    for y in range(16, 30):
        for x in range(2, 30):
            dx = (x - cx) / rx_out
            dy = (y - (cy + 3.0)) / ry_out
            d = dx * dx + dy * dy
            if d <= 1.0:
                if d >= 0.86 or y == 29:
                    c.set(x, y, "S0", "stone")
                else:
                    # Shaded curved stone skirt (lit SW -> shadowed SE) with ashlar block joints
                    angle_rel = (x - 2) / 27.0
                    if int(round(x)) in (7, 13, 19, 24):
                        tok = "S2"
                    elif angle_rel < 0.30:
                        tok = "S6" if y < 27 else "S5"
                    elif angle_rel < 0.62:
                        tok = "P3" if y < 27 else "S4"
                    else:
                        tok = "D3" if y < 27 else "D2"
                    c.set(x, y, tok, "stone")

    # --- B. Beveled Radial Ashlar Coping Rim & Deep Sea-Teal Water Basin (y=5..26) ---
    # Radial mortar joint angles (10 wedge coping stones around the 360° ring, ref_s4 style!)
    joint_angles = [-2.75, -2.10, -1.48, -0.82, -0.22, 0.38, 1.02, 1.65, 2.28, 2.88]

    for y in range(5, 27):
        for x in range(2, 30):
            dx_o = (x - cx) / rx_out
            dy_o = (y - cy) / ry_out
            d_out = dx_o * dx_o + dy_o * dy_o
            if d_out > 1.0:
                continue

            dx_i = (x - cx) / rx_in
            dy_i = (y - cy) / ry_in
            d_in = dx_i * dx_i + dy_i * dy_i

            if d_in >= 1.0:
                # --- Stone Coping Rim ---
                # Check if outer edge of top oval:
                is_outer_rim = False
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    ndx = (nx - cx) / rx_out
                    ndy = (ny - cy) / ry_out
                    if ndx * ndx + ndy * ndy > 1.0:
                        is_outer_rim = True
                        break

                if is_outer_rim:
                    # Top/side outer outline is S0; along south edge (y>=24) it's the crisp overhang lip above the front skirt!
                    if y >= 24 and 5 <= x <= 26:
                        c.set(x, y, "S2" if x > 17 else "S3", "stone")
                    else:
                        c.set(x, y, "S0", "stone")
                    continue

                # Inner rim bevel check (1px lip touching water basin)
                is_inner_lip = d_in < 1.24
                ang = math.atan2(y - cy, x - cx)
                near_joint = min(abs(((ang - ja + math.pi) % (2 * math.pi)) - math.pi) for ja in joint_angles) < 0.085

                if near_joint:
                    c.set(x, y, "S2" if (x + y) < 32 else "D1", "stone")
                elif is_inner_lip:
                    # Inner rim bevel: NW inner rim faces away from top-left light (S3/D2); SE inner rim catches bright light (S8/S7)!
                    if (x - cx) + (y - cy) > 2.0:
                        c.set(x, y, "S8" if x < 22 else "S7", "stone")
                    else:
                        c.set(x, y, "S3" if y < 14 else "S4", "stone")
                else:
                    # Flat top face of radial stone coping blocks (top-left lit!)
                    light_score = -(x - cx) * 0.7 - (y - cy) * 0.9
                    if light_score > 6.5:
                        c.set(x, y, "S8", "stone")
                    elif light_score > 1.5:
                        c.set(x, y, "S7" if (x + y) % 3 != 0 else "P4", "stone")
                    elif light_score > -4.5:
                        c.set(x, y, "S6" if x < 18 else "P3", "stone")
                    else:
                        c.set(x, y, "S5" if y < 22 else "D4", "stone")
            else:
                # --- Inner Basin Wall Lip (north shadow) + Deep Sea-Teal Sanctuary Water ---
                # 1-2px submerged/shadowed stone wall visible along north inner arc!
                dy_wall = ((y - 1.7) - cy) / ry_in
                d_wall = dx_i * dx_i + dy_wall * dy_wall
                if y < 14 and d_wall >= 0.96:
                    c.set(x, y, "D0" if d_in > 0.84 else "W0", "slate")
                    continue

                # Deep sea-teal depth gradient (darkest NW under rim shadow -> luminous cyan-teal SE!)
                if d_in > 0.86:
                    c.set(x, y, "W0" if y < 16 else "W1", "water")
                else:
                    depth_bias = (x - cx) * 0.05 + (y - cy) * 0.09 - d_in * 0.35
                    if depth_bias < -0.35:
                        c.set(x, y, "W1", "water")
                    elif depth_bias < -0.05:
                        c.set(x, y, "W2", "water")
                    elif depth_bias < 0.22:
                        c.set(x, y, "W3", "water")
                    else:
                        c.set(x, y, "W4", "water")

    # --- C. Crisp Concentric Cyan-White Water Ripples & Outer Reflection Arcs ---
    outer_ripples = [
        # Upper-left & upper-right delicate concentric ripple arcs
        (8, 13, "W5"), (9, 12, "C3"), (10, 11, "C4"), (11, 11, "W5"),
        (20, 11, "W5"), (21, 11, "C3"), (22, 12, "W5"), (23, 13, "W5"),
        # Lower-left & lower-right sunlit cyan-white ripple arcs
        (7, 17, "W5"), (8, 19, "C3"), (9, 20, "C4"), (10, 21, "C5"), (11, 21, "C3"),
        (19, 22, "W5"), (20, 21, "C4"), (21, 21, "C5"), (22, 20, "C3"), (23, 19, "W5"),
        (14, 22, "W5"), (15, 22, "C3"), (16, 22, "W5"),
    ]
    for rx, ry, rc in outer_ripples:
        c.set(rx, ry, rc, "water")

    # --- D. Frothy Central Foam Ring + Carved Stone Spout & Sparkling Water Plume ---
    # 1. Sparkling cyan-white foam ring on water around central spout (x=11..20, y=14..19)
    foam_ring = [
        (12, 14, "W5"), (13, 14, "C3"), (18, 14, "C3"), (19, 14, "W5"),
        (11, 15, "C3"), (12, 15, "C4"), (19, 15, "C4"), (20, 15, "C3"),
        (11, 16, "C4"), (20, 16, "C5"),
        (11, 17, "C3"), (12, 17, "C5"), (19, 17, "C4"), (20, 17, "W5"),
        (12, 18, "W5"), (13, 18, "C4"), (14, 18, "C5"), (15, 19, "C4"),
        (16, 19, "C5"), (17, 18, "C5"), (18, 18, "C3"), (19, 18, "W5"),
    ]
    for fx, fy, fc in foam_ring:
        c.set(fx, fy, fc, "water")

    # 2. Carved round central stone spout nozzle (x=13..18, y=12..17 — ref_s4_best_row style!)
    spout_stone = [
        (14, 13, "S8"), (15, 13, "S7"), (16, 13, "S6"), (17, 13, "S4"),
        (13, 14, "S0"), (14, 14, "S7"), (15, 14, "W0"), (16, 14, "W0"), (17, 14, "S5"), (18, 14, "S0"),
        (13, 15, "S0"), (14, 15, "S8"), (15, 15, "S6"), (16, 15, "S4"), (17, 15, "D1"), (18, 15, "S0"),
        (13, 16, "W0"), (14, 16, "S6"), (15, 16, "S5"), (16, 16, "S3"), (17, 16, "D1"), (18, 16, "W0"),
        (14, 17, "W1"), (15, 17, "D1"), (16, 17, "D0"), (17, 17, "W1"),
    ]
    for sx, sy, sc in spout_stone:
        c.set(sx, sy, sc, "stone")

    # 3. Sparkling arcing central water spout & separated droplet arcs (dark water visible under arcs!)
    plume_px = [
        # Bubbling central water crest emerging from nozzle orifice
        (15, 11, "C6"), (16, 11, "C5"),
        (14, 12, "C5"), (15, 12, "C6"), (16, 12, "C6"), (17, 12, "C4"),
        (15, 13, "C6"), (16, 13, "C5"),
        # Left & right graceful separated water droplet arcs landing in foam ring
        (13, 12, "C4"), (12, 13, "C5"), (11, 14, "C4"),
        (18, 12, "C4"), (19, 13, "C5"), (20, 14, "C3"),
        # Sparkling splash droplets on lower nozzle lip
        (15, 14, "C5"), (16, 14, "C3"),
    ]
    for px_x, px_y, pc in plume_px:
        c.set(px_x, px_y, pc, "crystal")

    # --- E. Lush Moss Tufts on Stone Rim (NW coping joint & SE skirt) ---
    fountain_moss = [
        (4, 9, "F2"), (5, 9, "F4"), (6, 9, "F3"),
        (4, 10, "F3"), (5, 10, "F5"), (6, 10, "F2"),
        (24, 24, "F3"), (25, 24, "F4"), (26, 24, "F2"),
        (23, 25, "F2"), (24, 25, "F5"), (25, 25, "F3"), (26, 25, "F1"),
        (24, 26, "F2"), (25, 26, "F1"),
    ]
    for mx, my, mc in fountain_moss:
        c.set(mx, my, mc, "moss")

    c.enforce_dark_outline()
    # Soft elliptical ground shadow (#4c557f@85) around base of round fountain (y=27..31)
    c.shadow_ellipse_if_empty(15.5, 21.0, 14.4, 9.8)
    return c.im


# ===========================================================================
# Verification & Preview Sheet Builder
# ===========================================================================
def verify_sprite(
    name: str,
    im: Image.Image,
    expected_canvas: tuple[int, int],
    camera: str,
    valid_hexes: set[str],
) -> dict:
    assert im.size == expected_canvas, f"{name}: size {im.size} != {expected_canvas}"
    w, h = im.size
    px = im.load()

    opaque_pts: list[tuple[int, int]] = []
    shadow_cnt = 0
    off_palette: list[tuple[int, int, str]] = []
    bad_alpha: list[tuple[int, int, int]] = []
    pure_black = 0
    bright_edge: list[tuple[int, int, str, float]] = []

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if a == SHADOW_ALPHA:
                if (r, g, b) != SHADOW_RGB:
                    bad_alpha.append((x, y, a))
                else:
                    shadow_cnt += 1
                continue
            if a != 255:
                bad_alpha.append((x, y, a))
                continue

            opaque_pts.append((x, y))
            hx = f"#{r:02x}{g:02x}{b:02x}"
            if (r, g, b) == (0, 0, 0):
                pure_black += 1
            if hx not in valid_hexes:
                off_palette.append((x, y, hx))

            touches_non_opaque = False
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if nx < 0 or nx >= w or ny < 0 or ny >= h or px[nx, ny][3] != 255:
                    touches_non_opaque = True
                    break
            if touches_non_opaque:
                lm = luma(r, g, b)
                if lm > 85.0 or hx not in DARK_OUTLINE_HEXES:
                    bright_edge.append((x, y, hx, round(lm, 1)))

    assert not off_palette, f"{name}: off-palette pixels: {off_palette[:5]}"
    assert pure_black == 0, f"{name}: pure #000000 pixels found!"
    assert not bad_alpha, f"{name}: illegal semi-transparent pixels: {bad_alpha[:5]}"
    assert not bright_edge, f"{name}: non-dark outer outline pixels: {bright_edge[:5]}"
    assert opaque_pts, f"{name}: empty sprite!"

    xs = [p[0] for p in opaque_pts]
    ys = [p[1] for p in opaque_pts]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    ow = x1 - x0 + 1
    oh = y1 - y0 + 1
    left_gap = x0
    right_gap = (w - 1) - x1
    bottom_gap = (h - 1) - y1

    assert abs(left_gap - right_gap) <= 1, f"{name}: off-center left={left_gap}, right={right_gap}"
    assert 1 <= bottom_gap <= 2, f"{name}: bottom_gap={bottom_gap} outside 1..2"

    used_colors = len({f"#{px[x, y][0]:02x}{px[x, y][1]:02x}{px[x, y][2]:02x}" for x, y in opaque_pts})
    return {
        "name": name,
        "camera": camera,
        "canvas": f"{w}x{h}",
        "opaque": f"{ow}x{oh}",
        "bbox": (x0, y0, x1, y1),
        "bottom_gap": bottom_gap,
        "shadow_px": shadow_cnt,
        "colors": used_colors,
    }


def load_beodeul_char_1x() -> Image.Image:
    src = Image.open(CHAR_REF_4X).convert("RGBA")
    return src.resize((src.width // 4, src.height // 4), Image.Resampling.NEAREST)


def build_preview_sheet(rendered: list[tuple[str, str, Image.Image, dict]]) -> None:
    """Render `preview_batch1.png` on neutral #767670 showing 3x loupe + 2x + 1x next to
    1x Beodeul character AND tiny old `neon high` 1x reference strip for instant visual QA!
    """
    bg_gray = (0x76, 0x76, 0x70, 255)  # #767670 required neutral gray
    header_bg = (0x5E, 0x5E, 0x58, 255)
    card_bg = (0x6E, 0x6E, 0x68, 255)
    border = (0x8C, 0x8C, 0x84, 255)
    text_hi = (244, 244, 238, 255)
    text_lo = (212, 212, 204, 255)

    char_1x = load_beodeul_char_1x()
    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.Resampling.NEAREST)

    sheet_w, sheet_h = 1040, 508
    sheet = Image.new("RGBA", (sheet_w, sheet_h), bg_gray)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    # Header bar
    draw.rectangle([0, 0, sheet_w - 1, 82], fill=header_bg)
    draw.line([(0, 82), (sheet_w - 1, 82)], fill=border)
    sheet.alpha_composite(char_2x, (18, 82 - 10 - char_2x.height))
    sheet.alpha_composite(char_1x, (18 + char_2x.width + 10, 82 - 10 - char_1x.height))

    draw.text(
        (110, 14),
        "FANTASY_SKY_RUINS_CARBON - T2 Ruins Batch 1/4 (5 Sanctuary Landmarks) | 74-Color Beodeul Locked",
        fill=text_hi,
        font=font,
    )
    draw.text(
        (110, 34),
        f"Scale Ref: Beodeul Hero 2x ({char_2x.width}x{char_2x.height}) & 1x ({char_1x.width}x{char_1x.height}) | 0 off-palette | #4c557f@85 shadow | 1px dark outlines",
        fill=text_lo,
        font=font,
    )
    draw.text(
        (110, 54),
        "Each card shows: Upper [3x Loupe]  |  Middle [2x + 1x + Beodeul 1x on #767670]  |  Bottom [vs Old Neon 1x]",
        fill=text_lo,
        font=font,
    )

    card_w = 194
    gap = 11
    start_x = 13
    top_y = 96
    card_h = 398

    for idx, (fname, camera, im, stats) in enumerate(rendered):
        cx = start_x + idx * (card_w + gap)
        # Main card on exact #767670 background so 2x + 1x + char sit directly on #767670!
        draw.rectangle([cx, top_y, cx + card_w, top_y + card_h], fill=bg_gray, outline=border)
        draw.rectangle([cx + 1, top_y + 1, cx + card_w - 1, top_y + 22], fill=card_bg)
        short = fname.replace(".png", "")
        draw.text((cx + 6, top_y + 6), f"0{idx + 1} {short}", fill=text_hi, font=font)

        # Compartment 1: 3x Loupe (fits 48*3 = 144x144 cleanly inside 182px!)
        im_3x = im.resize((im.width * 3, im.height * 3), Image.Resampling.NEAREST)
        lx = cx + (card_w - im_3x.width) // 2
        ly = top_y + 28 + (146 - im_3x.height) // 2
        sheet.alpha_composite(im_3x, (lx, ly))
        draw.line([(cx + 8, top_y + 180), (cx + card_w - 8, top_y + 180)], fill=border)

        # Compartment 2: 2x + 1x + Beodeul 1x side-by-side on #767670!
        floor_y = top_y + 288
        draw.line([(cx + 8, floor_y + 2), (cx + card_w - 8, floor_y + 2)], fill=card_bg)
        im_2x = im.resize((im.width * 2, im.height * 2), Image.Resampling.NEAREST)
        total_row_w = im_2x.width + 8 + im.width + 6 + char_1x.width
        rx0 = cx + max(4, (card_w - total_row_w) // 2)
        sheet.alpha_composite(im_2x, (rx0, floor_y - im_2x.height))
        sheet.alpha_composite(im, (rx0 + im_2x.width + 8, floor_y - im.height))
        sheet.alpha_composite(char_1x, (rx0 + im_2x.width + 8 + im.width + 6, floor_y - char_1x.height))

        # Stats & Old Neon 1x comparison strip at bottom
        draw.line([(cx + 8, top_y + 298), (cx + card_w - 8, top_y + 298)], fill=border)
        draw.text(
            (cx + 6, top_y + 304),
            f"{stats['canvas']} {camera} | op {stats['opaque']}",
            fill=text_hi,
            font=font,
        )
        draw.text(
            (cx + 6, top_y + 320),
            f"{stats['colors']} colors | sh {stats['shadow_px']}px",
            fill=text_lo,
            font=font,
        )
        old_p = OLD_NEON_OBJ_DIR / fname
        if old_p.exists():
            old_im = Image.open(old_p).convert("RGBA")
            draw.text((cx + 6, top_y + 346), "Old neon 1x ->", fill=text_lo, font=font)
            sheet.alpha_composite(old_im, (cx + 105, top_y + 384 - old_im.height))

    PREVIEW_PNG.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW_PNG)


def main() -> None:
    OBJ_DIR.mkdir(parents=True, exist_ok=True)
    pal_data = json.loads(PALETTE_JSON.read_text(encoding="utf-8"))
    valid_hexes = {h.lower() for h in pal_data["colors"]}
    assert len(valid_hexes) == 74, f"Expected 74 palette colors, found {len(valid_hexes)}"

    # Verify all shorthand tokens map into valid_hexes
    for k, hx in P.items():
        assert hx.lower() in valid_hexes, f"Token {k}={hx} not in palette_beodeul_ruins.json!"

    specs = [
        ("ruin_shrine_gate.png", "standing", (48, 48), build_ruin_shrine_gate()),
        ("crystal_rune_altar.png", "standing", (32, 32), build_crystal_rune_altar()),
        ("stone_guardian_statue.png", "standing", (16, 32), build_stone_guardian_statue()),
        ("carved_rune_stele.png", "standing", (32, 32), build_carved_rune_stele()),
        ("sanctuary_fountain_round.png", "topdown", (32, 32), build_sanctuary_fountain_round()),
    ]

    print("=== T2 RUINS BATCH 1/4 (CARBON) MACHINE VERIFICATION ===")
    rendered = []
    for fname, camera, expected_sz, im in specs:
        out_path = OBJ_DIR / fname
        im.save(out_path)
        stats = verify_sprite(fname, im, expected_sz, camera, valid_hexes)
        rendered.append((fname, camera, im, stats))
        print(
            f"PASS  {fname:30s} | canvas={stats['canvas']:5s} | opaque={stats['opaque']:5s} "
            f"| camera={camera:8s} | colors={stats['colors']:2d} | shadow={stats['shadow_px']:3d}px"
        )

    build_preview_sheet(rendered)
    print(f"\nSaved preview sheet -> {PREVIEW_PNG}")


if __name__ == "__main__":
    main()
