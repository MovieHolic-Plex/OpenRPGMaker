#!/usr/bin/env python3
"""
Batch 1/4: 5 Museum-Grade Modern Korean PC Bang Gaming Objects
Sprites:
  1. pc_station_blue.png   (32x32, standing)
  2. pc_station_red.png    (32x32, standing)
  3. gaming_chair_red.png  (16x16, chair)
  4. gaming_chair_blue.png (16x16, chair)
  5. server_rack.png       (16x32, standing)

Enforces 100% modern_palette_v3.json (118 colors), #4c557f@85 ground shadow,
strict 0/85/255 alpha, and darkest-material 1px outer outlines.
"""

from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
REFS_DIR = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs"
PALETTE_JSON = REFS_DIR / "modern_palette_v3.json"
CHAR_REF_PNG = REFS_DIR / "ref_mod1_char.png"

OUT_DIR = ROOT / "tiledata/dungeon-dots/modern_pcbang_carbon"
OBJ_DIR = OUT_DIR / "objects"
PREVIEW_PNG = OUT_DIR / "preview_batch1.png"

SHADOW_RGBA = (76, 85, 127, 85)  # #4c557f @ 85/255
TRANSPARENT = (0, 0, 0, 0)

# Locked palette tokens (all verified from modern_palette_v3.json)
P = {
    # Cool slate / steel / specular white (8)
    "K0": "#141622",  # darkest outline / deep recess
    "K1": "#2e3040",  # dark charcoal
    "K2": "#4e5062",  # mid-dark slate / steel shadow
    "K3": "#707282",  # mid brushed steel
    "K4": "#9698a4",  # lit steel rim
    "K5": "#bec0c8",  # bright silver bevel
    "K6": "#e2e4e8",  # glossy edge highlight
    "K7": "#fafaf8",  # pure specular glint
    # Cyan / teal (7)
    "T0": "#112e2a",
    "T1": "#18504a",
    "T2": "#1c726c",
    "T3": "#1b9490",
    "T4": "#29b6b6",
    "T5": "#5bd4d8",
    "T6": "#9af4fa",
    # Sky cerulean (7)
    "S0": "#11272e",
    "S1": "#184150",
    "S2": "#1c5872",
    "S3": "#1b6c94",
    "S4": "#2982b6",
    "S5": "#5ba6d8",
    "S6": "#9ad0fa",
    # Cobalt blue (7)
    "B0": "#111c2e",
    "B1": "#182c50",
    "B2": "#1c3772",
    "B3": "#1b3e94",
    "B4": "#294db6",
    "B5": "#5b76d8",
    "B6": "#9aacfa",
    # Crimson red (7)
    "R0": "#2e1119",
    "R1": "#501825",
    "R2": "#721c28",
    "R3": "#941b23",
    "R4": "#b62b29",
    "R5": "#d8665b",
    "R6": "#faaa9a",
    # Rust orange & amber & gold
    "O2": "#72291c",
    "O3": "#94381b",
    "O4": "#b65529",
    "O5": "#d88c5b",
    "O6": "#fac79a",
    "A4": "#b68429",
    "A5": "#d8b55b",
    "A6": "#fae79a",
    "Y5": "#d8d25b",
    "Y6": "#f7fa9a",
    # Emerald & jade (LEDs / UI)
    "G3": "#29941b",
    "G4": "#35b629",
    "G5": "#61d85b",
    "G6": "#9cfa9a",
    "M5": "#5bd89e",
    "M6": "#9afad0",
    # Purple / magenta RGB accents
    "P4": "#9329b6",
    "P5": "#bd5bd8",
    "P6": "#e89afa",
}

DARK_OUTLINE_HEXES = {"#141622", "#2e1119", "#111c2e", "#11272e", "#112e2a"}


def hex_to_rgba(hx: str) -> tuple[int, int, int, int]:
    h = hx.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


class Canvas:
    def __init__(self, w: int, h: int) -> None:
        self.w = w
        self.h = h
        self.im = Image.new("RGBA", (w, h), TRANSPARENT)
        self.px = self.im.load()

    def set(self, x: int, y: int, tok: str) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            if tok == ".":
                self.px[x, y] = TRANSPARENT
            elif tok == "SH":
                self.px[x, y] = SHADOW_RGBA
            else:
                hx = P[tok] if tok in P else tok
                self.px[x, y] = hex_to_rgba(hx)

    def hline(self, x1: int, x2: int, y: int, tok: str) -> None:
        for x in range(x1, x2 + 1):
            self.set(x, y, tok)

    def vline(self, x: int, y1: int, y2: int, tok: str) -> None:
        for y in range(y1, y2 + 1):
            self.set(x, y, tok)

    def rect(self, x1: int, y1: int, x2: int, y2: int, tok: str) -> None:
        for y in range(y1, y2 + 1):
            for x in range(x1, x2 + 1):
                self.set(x, y, tok)

    def shadow_if_empty(self, x1: int, y1: int, x2: int, y2: int) -> None:
        for y in range(y1, y2 + 1):
            for x in range(x1, x2 + 1):
                if 0 <= x < self.w and 0 <= y < self.h and self.px[x, y][3] == 0:
                    self.px[x, y] = SHADOW_RGBA

    def enforce_dark_outline(self, default_outline: str = "K0") -> None:
        """Verify/repair any accidental non-dark pixel touching alpha < 255."""
        w, h = self.w, self.h
        to_fix: list[tuple[int, int]] = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = self.px[x, y]
                if a != 255:
                    continue
                hx = f"#{r:02x}{g:02x}{b:02x}"
                touches_bg = False
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if nx < 0 or nx >= w or ny < 0 or ny >= h or self.px[nx, ny][3] < 255:
                        touches_bg = True
                        break
                if touches_bg and hx not in DARK_OUTLINE_HEXES:
                    to_fix.append((x, y))
        for x, y in to_fix:
            self.set(x, y, default_outline)


# ============================================================================
# 1. pc_station_blue.png (32x32, standing, target opaque ~28-30 x 28-30)
# ============================================================================
def build_pc_station_blue() -> Image.Image:
    c = Canvas(32, 32)

    # --- Ground shadow (#4c557f@85) under desk legs & span ---
    c.shadow_if_empty(2, 30, 29, 31)
    c.shadow_if_empty(6, 29, 25, 29)

    # --- LOWER ZONE (y=22..30): Braced Steel Legs + Modesty Panel + Open Knee Arch ---
    # Left angled steel leg (x=2..5, y=22..30, flared foot x=1..5 at y=29..30)
    c.rect(2, 22, 5, 28, "K0")
    c.vline(3, 22, 28, "K5")  # bright brushed steel left highlight
    c.set(3, 22, "K3")        # top under-desk shadow
    c.vline(4, 22, 28, "K2")  # shaded inner steel face
    # Flared left rubber/steel foot pad (x=1..5, y=29..30)
    c.rect(1, 29, 5, 30, "K0")
    c.set(2, 29, "K6")
    c.set(3, 29, "K4")
    c.set(4, 29, "K2")

    # Right angled steel leg (x=26..29, y=22..30, flared foot x=26..30 at y=29..30)
    c.rect(26, 22, 29, 28, "K0")
    c.vline(27, 22, 28, "K4")
    c.set(27, 22, "K2")
    c.vline(28, 22, 28, "K1")
    # Flared right foot pad (x=26..30, y=29..30)
    c.rect(26, 29, 30, 30, "K0")
    c.set(27, 29, "K5")
    c.set(28, 29, "K3")
    c.set(29, 29, "K2")

    # Modest privacy panel (x=6..25, y=22..27) + corner gusset braces
    c.rect(6, 22, 25, 27, "K1")
    c.hline(6, 25, 22, "K0")   # deep overhang shadow under tabletop
    c.hline(6, 25, 27, "K0")   # bottom outline above open floor arch (y=28..30)
    # Recessed cable-management louver & cyan seat-ID badge
    c.hline(8, 23, 24, "K0")
    c.hline(8, 23, 25, "K2")
    # Angled corner steel braces
    c.set(6, 23, "K4")
    c.set(7, 23, "K2")
    c.set(6, 24, "K3")
    c.set(25, 23, "K3")
    c.set(24, 23, "K2")
    c.set(25, 24, "K2")
    # Small glowing cyan under-desk ambient cast on panel top
    c.hline(10, 15, 23, "S2")

    # --- MIDDLE ZONE (y=15..22): Beveled Dark-Slate Tabletop + Keyboard + Mousepad ---
    # Chamfered tabletop outline (x=2..29 at y=15, x=1..30 at y=16..21, lip at y=22)
    c.hline(2, 29, 15, "K0")
    c.rect(1, 16, 30, 21, "K0")
    c.hline(2, 29, 22, "K0")

    # Lit orthographic desk surface (y=16..19, 1/4 height band, zero side walls)
    c.hline(2, 29, 16, "K4")
    c.hline(2, 7, 16, "K5")
    c.set(2, 16, "K6")
    c.hline(22, 29, 16, "K3")
    for y in range(17, 20):
        c.hline(2, 11, y, "K3")
        c.hline(12, 20, y, "K2")
        c.hline(21, 29, y, "K1")
        c.set(2, y, "K4")

    # Beveled front bullnose edge (y=20..21) with brushed steel & cyan LED accent strip
    c.hline(2, 29, 20, "K4")
    c.hline(2, 8, 20, "K5")
    c.set(2, 20, "K6")
    c.hline(23, 29, 20, "K3")
    # Sleek cyan PC-Bang LED trim along front bullnose (y=21)
    c.hline(2, 29, 21, "K2")
    c.hline(4, 19, 21, "T4")
    c.hline(5, 11, 21, "T5")
    c.hline(6, 7, 21, "T6")
    c.hline(22, 27, 21, "S4")

    # Backlit Mechanical Keyboard on desk (x=3..13, y=17..19)
    c.rect(3, 17, 13, 19, "K0")
    c.hline(4, 12, 17, "S3")
    c.set(5, 17, "T5")
    c.set(8, 17, "T4")
    c.set(11, 17, "S5")
    key_row1 = ["T6", "T5", "A6", "T5", "T4", "S5", "S4", "T5", "T4"]  # x=4..12, y=18
    for i, tk in enumerate(key_row1):
        c.set(4 + i, 18, tk)
    c.hline(6, 10, 19, "S2")  # subtle backlit spacebar front glow

    # Extended Gaming Mousepad + RGB Ergonomic Mouse (x=14..20, y=17..19)
    c.rect(14, 17, 20, 19, "B1")
    c.hline(14, 20, 17, "S3")  # stitched cyan pad top edge
    c.hline(14, 20, 19, "B2")
    c.set(17, 18, "K6")        # sculpted wireless mouse
    c.set(18, 18, "T5")

    # --- UPPER LEFT-CENTER (x=2..19, y=2..15): Curved Cyan-Blue Gaming Monitor ---
    # Sculpted chamfered outer bezel (y=2: x=4..17, y=3: x=3..18, y=4..12: x=2..19, y=13: x=3..18)
    # Note: x=20 is kept transparent (y=3..14) so monitor & tower silhouettes separate crisply!
    c.hline(4, 17, 2, "K0")
    c.hline(3, 18, 3, "K0")
    c.rect(2, 4, 19, 12, "K0")
    c.hline(3, 18, 13, "K0")

    # Top lit curved brushed-silver/slate monitor rim (y=3, inner x=4..17)
    # Curved top shading: bright left-outer curve -> slightly deeper center arc -> lit right shoulder
    curved_rim = ["K7", "K6", "K5", "K4", "K3", "K3", "K3", "K3", "K4", "K4", "K5", "K4", "K3", "K2"]
    for idx, x in enumerate(range(4, 18)):
        c.set(x, 3, curved_rim[idx])
    # Left & right sleek narrow side bezels
    c.vline(3, 4, 12, "K4")
    c.set(3, 4, "K6")
    c.set(3, 5, "K5")
    c.vline(18, 4, 12, "K2")
    # Bottom chin bezel (y=12, x=4..17) with glowing cyan power LED
    c.hline(4, 17, 12, "K2")
    c.hline(4, 8, 12, "K3")
    c.set(10, 12, "T6")
    c.set(11, 12, "T4")

    # Curved Cyan-Blue Glowing Screen (x=4..17, y=4..11 -> 14x8 px)
    col_ramp = ["B2", "S2", "S3", "S4", "S4", "T3", "T4", "T4", "T3", "S4", "S3", "S2", "B2", "B1"]
    for idx, x in enumerate(range(4, 18)):
        for y in range(4, 12):
            c.set(x, y, col_ramp[idx])
    c.hline(4, 17, 4, "S2")
    c.hline(7, 14, 4, "S3")

    # Glowing PC-Bang Game HUD UI Details inside screen
    c.rect(14, 5, 16, 7, "B1")
    c.set(14, 5, "T5")
    c.set(15, 6, "G5")
    c.set(16, 7, "S5")
    c.hline(6, 13, 10, "B1")
    c.set(7, 10, "G5")
    c.set(8, 10, "G6")
    c.set(10, 10, "A6")
    c.set(11, 10, "T6")
    c.set(12, 10, "P5")
    c.hline(10, 12, 6, "T5")

    # Crisp Diagonal Glass Reflection Streak across monitor screen
    for x, y, tk in [
        (5, 4, "T6"),
        (4, 5, "T5"),
        (5, 5, "K7"),
        (6, 5, "T6"),
        (6, 6, "K7"),
        (7, 6, "T6"),
        (7, 7, "T6"),
        (8, 7, "T5"),
        (8, 8, "T6"),
        (9, 8, "T5"),
        (9, 9, "T5"),
    ]:
        c.set(x, y, tk)

    # Sculpted Monitor Stand Neck & V-Base (y=13..16) with open air gaps left/right at y=14!
    c.rect(9, 13, 12, 15, "K0")
    c.set(10, 13, "K4")
    c.set(11, 13, "K2")
    c.set(10, 14, "K5")
    c.set(11, 14, "K3")
    c.hline(7, 14, 15, "K0")
    c.hline(8, 13, 16, "K5")
    c.set(12, 16, "K3")
    c.set(13, 16, "K2")

    # --- UPPER RIGHT (x=21..29, y=3..18): Windowed RGB PC Tower (1px air gap at x=20!) ---
    c.hline(22, 28, 3, "K0")
    c.rect(21, 4, 29, 18, "K0")
    # Lit brushed-steel top cap band (y=4..5, inner x=22..28)
    c.hline(22, 28, 4, "K6")
    c.set(22, 4, "K7")
    c.set(26, 4, "K5")
    c.set(27, 4, "K4")
    c.set(28, 4, "K3")
    c.hline(22, 28, 5, "K3")
    c.set(22, 5, "K5")
    c.set(23, 5, "T6")  # glowing cyan top I/O power button
    c.set(24, 5, "K4")

    # Brushed steel vertical side bezels (x=22 left lit, x=28 right shaded)
    c.vline(22, 6, 17, "K4")
    c.vline(22, 6, 10, "K5")
    c.vline(28, 6, 17, "K2")
    c.hline(22, 28, 17, "K2")

    # Tempered Dark Glass Showcase Interior (x=23..27, y=6..16 -> 5x11 px)
    c.rect(23, 6, 27, 16, "K0")

    # Top Glowing Cyan RGB Fan Ring (x=23..26, y=7..10 -> 4x4 sculpted halo ring)
    for fx, fy, ftk in [
        (23, 7, "K7"), (24, 7, "T6"), (25, 7, "T5"), (26, 7, "S4"),
        (23, 8, "T5"), (24, 8, "T5"), (25, 8, "K1"), (26, 8, "T4"),
        (23, 9, "T4"), (24, 9, "K1"), (25, 9, "K0"), (26, 9, "S4"),
        (23, 10, "S4"), (24, 10, "T4"), (25, 10, "S4"), (26, 10, "S3"),
    ]:
        c.set(fx, fy, ftk)

    # Bottom Glowing Cyan RGB Fan Ring (x=23..26, y=12..15 -> 4x4 sculpted halo ring)
    for fx, fy, ftk in [
        (23, 12, "T5"), (24, 12, "T5"), (25, 12, "T4"), (26, 12, "S3"),
        (23, 13, "T4"), (24, 13, "K1"), (25, 13, "T5"), (26, 13, "S4"),
        (23, 14, "S4"), (24, 14, "K0"), (25, 14, "K1"), (26, 14, "S3"),
        (23, 15, "S3"), (24, 15, "S4"), (25, 15, "S3"), (26, 15, "B2"),
    ]:
        c.set(fx, fy, ftk)
    # GPU RGB light bar at y=11 between fans
    c.hline(23, 26, 11, "P5")
    c.set(23, 11, "P6")
    c.set(24, 11, "T6")

    c.enforce_dark_outline("K0")
    return c.im


# ============================================================================
# 2. pc_station_red.png (32x32, standing, target opaque ~28-30 x 28-30)
#    Pro dual-monitor red esports rig + headset hook + under-desk twin-fan tower
# ============================================================================
def build_pc_station_red() -> Image.Image:
    c = Canvas(32, 32)

    # --- Ground shadow (#4c557f@85) ---
    c.shadow_if_empty(2, 30, 29, 31)
    c.shadow_if_empty(7, 29, 19, 29)

    # --- LOWER ZONE (y=22..30): Left Leg + Modesty Panel + Under-Desk Twin-Fan Red Tower ---
    # Left sturdy angled esports leg (x=3..6, y=22..30, flared foot x=2..6 at y=29..30)
    c.rect(3, 22, 6, 28, "K0")
    c.vline(4, 22, 28, "K4")
    c.set(4, 22, "K2")
    c.vline(5, 22, 28, "K2")
    c.vline(4, 24, 26, "R4")  # crimson esports leg stripe
    c.set(4, 24, "R5")
    c.rect(2, 29, 6, 30, "K0")
    c.set(3, 29, "K6")
    c.set(4, 29, "K4")
    c.set(5, 29, "K2")

    # Recessed charcoal modesty panel (x=7..19, y=22..26 -> open knee arch y=27..30!)
    c.rect(7, 22, 19, 26, "K1")
    c.hline(7, 19, 22, "K0")
    c.hline(7, 19, 26, "K0")
    c.hline(9, 17, 24, "K0")
    c.hline(9, 17, 25, "K2")
    c.set(7, 23, "K3")
    c.set(19, 23, "K2")

    # Aggressive Twin-Fan Red/Slate Gaming PC Tower tucked under-desk right (x=20..29, y=21..30)
    c.rect(20, 21, 29, 30, "K0")
    # Crisp brushed-steel top bezel of under-desk chassis (y=22) + side armor pillars
    c.hline(21, 28, 22, "K4")
    c.set(21, 22, "K6")
    c.set(22, 22, "K5")
    c.set(27, 22, "K3")
    c.set(28, 22, "K2")
    c.vline(21, 23, 29, "K4")
    c.set(21, 26, "R5")
    c.vline(28, 23, 29, "K2")
    c.set(28, 26, "R3")
    # Dark mesh front core (x=22..27, y=23..29) with twin glowing crimson fans!
    c.rect(22, 23, 27, 29, "R0")
    # Upper crimson RGB fan ring (x=23..26, y=23..25 -> 4x3 compact turbine)
    for fx, fy, ftk in [
        (23, 23, "R6"), (24, 23, "R5"), (25, 23, "R4"), (26, 23, "R3"),
        (23, 24, "R5"), (24, 24, "K0"), (25, 24, "O6"), (26, 24, "R4"),
        (23, 25, "R3"), (24, 25, "R4"), (25, 25, "R3"), (26, 25, "R2"),
    ]:
        c.set(fx, fy, ftk)
    # Lower crimson RGB fan ring (x=23..26, y=26..29 -> 4x4 turbine)
    for fx, fy, ftk in [
        (23, 26, "R5"), (24, 26, "R5"), (25, 26, "R4"), (26, 26, "R2"),
        (23, 27, "R4"), (24, 27, "K1"), (25, 27, "R5"), (26, 27, "R3"),
        (23, 28, "R3"), (24, 28, "K0"), (25, 28, "K1"), (26, 28, "R2"),
        (23, 29, "R2"), (24, 29, "R3"), (25, 29, "R2"), (26, 29, "R1"),
    ]:
        c.set(fx, fy, ftk)
    c.set(30, 29, "K0")
    c.set(30, 30, "K0")
    c.set(29, 29, "K3")

    # --- MIDDLE ZONE (y=15..21): Dark Charcoal Esports Desk + Red LED Trim + Headset Hook ---
    c.hline(3, 29, 15, "K0")
    c.rect(2, 16, 30, 21, "K0")

    # Lit dark-charcoal tabletop surface (y=16..19)
    c.hline(3, 29, 16, "K3")
    c.hline(3, 8, 16, "K4")
    c.set(3, 16, "K5")
    c.rect(3, 17, 29, 19, "K1")
    c.rect(3, 17, 15, 19, "K2")
    c.vline(3, 17, 19, "K4")

    # Glowing Crimson LED Edge Trim across front desk bullnose (y=20)
    c.hline(3, 29, 20, "R4")
    c.hline(5, 13, 20, "R5")
    c.hline(6, 8, 20, "R6")
    c.set(7, 20, "K7")
    c.hline(22, 29, 20, "R3")

    # Sculpted Pro Gaming Headset Hanging on Left Hook (x=1..4, y=17..23)
    c.rect(1, 17, 3, 19, "K0")
    c.set(2, 18, "K6")   # chrome hook arm jutting left
    c.set(3, 18, "K4")   # headband mount
    # Rounded crimson + charcoal earcup hanging at x=1..4, y=19..23
    c.rect(1, 19, 4, 22, "R0")
    c.hline(2, 3, 23, "R0")
    c.set(2, 19, "K5")   # metal yoke
    c.set(3, 19, "K3")
    c.set(2, 20, "R6")   # glossy crimson earcup shell
    c.set(3, 20, "K2")   # dark plush earpad
    c.set(2, 21, "R5")
    c.set(3, 21, "K1")
    c.set(2, 22, "R3")

    # Central Glowing Red/Amber TKL Mechanical Keyboard (x=8..17, y=17..19)
    c.rect(8, 17, 17, 19, "K0")
    c.hline(9, 16, 17, "R2")
    c.set(10, 17, "A6")
    c.set(13, 17, "R5")
    key_red = ["R6", "A6", "Y6", "R5", "O5", "R5", "R4", "A5"]
    for i, tk in enumerate(key_red):
        c.set(9 + i, 18, tk)
    c.hline(10, 15, 19, "R1")

    # Pro Esports Deskpad + Ultralight White Wireless Mouse (x=19..27, y=17..19)
    c.rect(19, 17, 27, 19, "R0")
    c.rect(20, 17, 26, 18, "K0")
    c.hline(19, 27, 17, "R3")
    c.set(22, 18, "K7")
    c.set(23, 18, "K5")

    # --- UPPER ZONE (y=2..15): Twin Beveled Monitors with Central V-Notch & Floating Gap ---
    c.rect(13, 13, 18, 15, "K0")
    c.set(14, 13, "K5")
    c.set(15, 13, "K4")
    c.set(16, 13, "K3")
    c.set(17, 13, "K2")
    c.set(14, 14, "K6")
    c.set(15, 14, "R5")
    c.set(16, 14, "R4")
    c.set(17, 14, "K2")
    c.hline(12, 19, 15, "K0")
    c.hline(13, 18, 15, "K4")

    c.hline(3, 14, 2, "K0")
    c.hline(17, 28, 2, "K0")
    c.rect(2, 3, 29, 12, "K0")
    c.set(2, 12, ".")
    c.set(29, 12, ".")

    # Top beveled frames (y=3)
    c.hline(3, 14, 3, "K4")
    c.set(3, 3, "K7")
    c.set(4, 3, "K6")
    c.hline(8, 10, 3, "R5")
    c.hline(17, 28, 3, "K4")
    c.set(17, 3, "K6")
    c.set(18, 3, "K5")
    c.hline(22, 24, 3, "R4")
    c.set(28, 3, "K2")

    # Outer & center monitor bezels
    c.vline(3, 4, 11, "K4")
    c.set(3, 4, "K6")
    c.vline(15, 3, 11, "K0")
    c.vline(16, 3, 11, "K2")
    c.vline(28, 4, 11, "K2")
    c.hline(4, 14, 11, "K2")
    c.set(9, 11, "R6")
    c.hline(17, 27, 11, "K2")
    c.set(22, 11, "R6")

    # LEFT SCREEN (x=4..14, y=4..10): Crisp contrast between deep crimson background,
    # razor-sharp diagonal glass glare (left), and glowing amber/gold FPS arena UI (right)!
    left_cols = ["R1", "R2", "R2", "R3", "R3", "R4", "O4", "R4", "R3", "R2", "R1"]
    for idx, x in enumerate(range(4, 15)):
        for y in range(4, 11):
            c.set(x, y, left_cols[idx])
    c.hline(4, 14, 4, "R1")
    # Glowing amber/gold arena target & HUD on right-center of left screen
    c.hline(9, 12, 6, "O5")
    c.set(10, 6, "Y6")
    c.set(11, 7, "A6")
    c.hline(5, 13, 10, "R1")
    c.set(6, 10, "G5")
    c.set(7, 10, "G6")
    c.set(11, 10, "A6")
    c.set(12, 10, "O6")
    # Razor-crisp 45-degree specular glass streak (separated by dark R1/R2 margin!)
    for x, y, tk in [
        (5, 4, "R6"),
        (5, 5, "K7"), (6, 5, "R5"),
        (6, 6, "K7"), (7, 6, "R6"),
        (7, 7, "R6"), (8, 8, "R5"),
    ]:
        c.set(x, y, tk)

    # RIGHT SCREEN (x=17..27, y=4..10): Esports Tactical Scoreboard & Mini-Radar
    for y in range(4, 11):
        for x in range(17, 28):
            c.set(x, y, "R1" if x in (17, 27) or y == 4 else "R2")
    c.hline(21, 25, 5, "R5")
    c.set(22, 5, "Y6")
    c.hline(22, 26, 9, "O5")
    c.rect(24, 6, 26, 8, "K0")
    c.set(25, 7, "G6")
    c.set(26, 6, "A6")
    for x, y, tk in [
        (18, 4, "R6"),
        (18, 5, "K7"), (19, 5, "R5"),
        (19, 6, "K7"), (20, 6, "R6"),
        (20, 7, "R6"), (21, 8, "R5"),
    ]:
        c.set(x, y, tk)

    c.enforce_dark_outline("K0")
    return c.im


# ============================================================================
# 3. gaming_chair_red.png (16x16, chair, target opaque ~12-14 x 13-14)
#    Near top-down (ref_ezt_chair_front_a.png): clear horizontal backrest top band,
#    winged crimson side bolsters, distinct wide dark-charcoal seat pan seen from
#    above, padded armrests, and crisp 2px base/caster hints!
# ============================================================================
def build_gaming_chair_red() -> Image.Image:
    c = Canvas(16, 16)

    # Ground shadow (#4c557f@85) under seat & casters
    c.shadow_if_empty(3, 14, 12, 15)
    c.shadow_if_empty(5, 13, 10, 13)

    rows = [
        # 0123456789ABCDEF
        "................",  # y=0
        "....RRRRRRRR....",  # y=1  sculpted rounded headrest top edge (x=4..11)
        "...Rw6554432R...",  # y=2  glossy top backrest rim (#fafaf8/#faaa9a -> #721c28)
        "..R65KbaaK142R..",  # y=3  winged shoulder bolsters + charcoal headrest pillow + harness holes
        "..R54KdcdK142R..",  # y=4  vibrant crimson winged bolsters + recessed quilted charcoal back
        "..R43KedeK132R..",  # y=5  mid backrest contour
        ".Kba3K554313cdK.",  # y=6  4D armrests start (x=1..14) + crimson lumbar cushion!
        ".Kac3KKKKKK2ceK.",  # y=7  deep dark crease where backrest meets horizontal seat pan!
        ".Kce5bcddcb3deK.",  # y=8  armrest pads + wide horizontal charcoal seat cushion (seen from above)
        ".KK65bcddec42KK.",  # y=9  armrest front tips + raised crimson side thigh bolsters
        "..R54abcddc32R..",  # y=10 broad plush dark-charcoal seat cushion top plane!
        "..R43aabbbc31R..",  # y=11 bright lit front waterfall knee roll across wide seat!
        "..RKKK4433KKKR..",  # y=12 crisp wide seat front lip (x=2..13) with crimson center badge
        "...Kcb.KK.dcK...",  # y=13 2px star-base leg struts + center hydraulic column hint
        "...KKK....KKK...",  # y=14 twin dual-wheel caster hints (1px bottom margin at y=15)
        "................",  # y=15 (shadow sits here)
    ]

    tok_map = {
        ".": None,
        "R": "R0",
        "1": "R1",
        "2": "R2",
        "3": "R3",
        "4": "R4",
        "5": "R5",
        "6": "R6",
        "w": "K7",
        "K": "K0",
        "e": "K1",
        "d": "K2",
        "c": "K3",
        "b": "K4",
        "a": "K5",
    }

    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            tk = tok_map[ch]
            if tk is not None:
                c.set(x, y, tk)

    c.enforce_dark_outline("K0")
    return c.im


# ============================================================================
# 4. gaming_chair_blue.png (16x16, chair, target opaque ~12-14 x 13-14)
#    Distinct "Cyber-Pro" model: wider squared top backrest with handle vent,
#    bright ice-white neck pillow, cyan V-chevron racing trim, white-silver
#    armrest caps, wide slate seat pan, and 3-prong swivel spider base!
# ============================================================================
def build_gaming_chair_blue() -> Image.Image:
    c = Canvas(16, 16)

    # Ground shadow (#4c557f@85)
    c.shadow_if_empty(3, 14, 12, 15)
    c.shadow_if_empty(5, 13, 10, 13)

    rows = [
        # 0123456789ABCDEF
        "................",  # y=0
        "...BBBBBBBBBB...",  # y=1  wider squared cyber-pro top backrest (x=3..12)
        "..B665KKK4432B..",  # y=2  electric cyan top rim + integrated black top handle vent
        "..B54KwwWK442B..",  # y=3  bright white/ice-cyan ergonomic neck pillow highlight!
        "..B655edd4432B..",  # y=4  electric cyan winged bolsters + V-chevron racing trim
        ".KWa4Kd54dK3bWK.",  # y=5  higher silver-white capped armrests (y=5..9) + chevron point
        ".Kac3KdcceK3bdK.",  # y=6  contoured dark-slate backrest
        ".Kcd3KKKKKK2ceK.",  # y=7  crisp horizontal seat-to-backrest crease!
        ".KK65bcddde42KK.",  # y=8  armrest front tips + wide dark-slate seat pan seen from above
        "..B54bcddde42B..",  # y=9  plush dark-slate seat with electric cyan side bolsters
        "..B43abcddc31B..",  # y=10 contoured bucket seat surface
        "..B43WabbbW31B..",  # y=11 crisp white-piped front waterfall seat roll across x=2..13!
        "..BKKK5543KKKB..",  # y=12 wide front seat lip with cyan team trim
        "....KbaKKcbK....",  # y=13 central chrome swivel spider hub flaring to 3 casters!
        "...KK..KK..KK...",  # y=14 3-point caster wheel stance (left, center, right)
        "................",  # y=15 (shadow sits here)
    ]

    tok_map = {
        ".": None,
        "B": "B0",
        "1": "S2",
        "2": "S3",
        "3": "S4",
        "4": "T4",
        "5": "T5",
        "6": "T6",
        "W": "K6",
        "w": "K7",
        "K": "K0",
        "e": "K1",
        "d": "K2",
        "c": "K3",
        "b": "K4",
        "a": "K5",
    }

    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            tk = tok_map[ch]
            if tk is not None:
                c.set(x, y, tk)

    c.enforce_dark_outline("K0")
    return c.im


# ============================================================================
# 5. server_rack.png (16x32, standing, target opaque ~14 x 28-30)
#    Sculpted fuel-pump-caliber cabinet: rounded/beveled brushed-steel top cap,
#    gleaming left pillar, dark glass door with razor-clean diagonal glare streak,
#    4 disciplined rack blades + cyan/emerald/amber LEDs, lower grille, heavy feet!
# ============================================================================
def build_server_rack() -> Image.Image:
    c = Canvas(16, 32)

    # Ground shadow (#4c557f@85) under feet & center skirt
    c.shadow_if_empty(2, 30, 13, 31)

    # --- 1. Sculpted Silhouette & Outer Outline (x=1..14 [14px], y=1..30 [30px]) ---
    c.hline(3, 12, 1, "K0")
    c.hline(2, 13, 2, "K0")
    c.rect(1, 3, 14, 26, "K0")
    c.hline(2, 13, 27, "K0")
    c.rect(1, 28, 14, 29, "K0")
    c.hline(1, 4, 30, "K0")
    c.hline(11, 14, 30, "K0")

    # --- 2. Rounded/Beveled Brushed-Steel Top Cap (y=2..6, orthographic 3/4 top band) ---
    for x, tk in [
        (3, "K7"), (4, "K7"), (5, "K6"), (6, "K6"), (7, "K5"),
        (8, "K5"), (9, "K4"), (10, "K4"), (11, "K3"), (12, "K2"),
    ]:
        c.set(x, 2, tk)
    for x, tk in [
        (2, "K7"), (3, "K6"), (4, "K5"), (5, "K1"), (6, "K0"),
        (7, "K1"), (8, "K0"), (9, "K1"), (10, "K0"), (11, "K4"), (12, "K3"), (13, "K2"),
    ]:
        c.set(x, 3, tk)
    for x, tk in [
        (2, "K6"), (3, "K5"), (4, "K5"), (5, "K4"), (6, "K4"),
        (7, "K4"), (8, "K3"), (9, "K3"), (10, "K3"), (11, "K2"), (12, "K2"), (13, "K1"),
    ]:
        c.set(x, 4, tk)
    for x, tk in [
        (2, "K6"), (3, "K4"), (4, "K3"), (5, "K1"), (6, "T6"),
        (7, "T5"), (8, "T4"), (9, "S4"), (10, "K1"), (11, "K3"), (12, "K2"), (13, "K1"),
    ]:
        c.set(x, 5, tk)
    c.hline(2, 13, 6, "K1")
    c.set(2, 6, "K4")
    c.hline(4, 12, 6, "K0")

    # --- 3. Brushed-Steel Side Pillars (x=2 gleaming left bevel, x=13 shaded right bevel) ---
    for y in range(7, 27):
        if y <= 11:
            c.set(2, y, "K6")
        elif y <= 18:
            c.set(2, y, "K5")
        elif y <= 23:
            c.set(2, y, "K4")
        else:
            c.set(2, y, "K3")
        c.set(13, y, "K3" if y <= 12 else ("K2" if y <= 21 else "K1"))

    # --- 4. Smoked Dark Glass Door & 4 Disciplined Server Rack Blades (x=3..12, y=7..20) ---
    c.rect(3, 7, 12, 20, "K0")
    c.vline(12, 8, 20, "K1")
    c.set(12, 13, "K6")  # chrome swing-handle latch
    c.set(12, 14, "K5")
    c.set(12, 15, "K3")

    # Blade 1 (y=8..9): Core Switch Blade (cyan status LEDs aligned left)
    c.hline(4, 11, 8, "K2")
    c.hline(4, 11, 9, "K1")
    c.set(4, 8, "T6")
    c.set(5, 8, "T4")

    # Blade 2 (y=11..12): Game Server Blade A (emerald status LEDs aligned left)
    c.hline(4, 11, 11, "K2")
    c.hline(4, 11, 12, "K1")
    c.set(4, 11, "G6")
    c.set(5, 11, "G4")

    # Blade 3 (y=14..15): Game Server Blade B (amber status LEDs aligned left)
    c.hline(4, 11, 14, "K2")
    c.hline(4, 11, 15, "K1")
    c.set(4, 14, "A6")
    c.set(5, 14, "O5")

    # Blade 4 (y=17..19): 3U RAID Storage Array (cyan + emerald status LEDs + dark drive bays)
    c.rect(4, 17, 11, 19, "K1")
    c.hline(4, 11, 17, "K2")
    c.set(4, 17, "T6")
    c.set(5, 17, "G5")
    for dx in (6, 8, 10):
        c.set(dx, 18, "K2")
        c.set(dx + 1, 18, "K0")
    c.set(10, 19, "T4")

    # Razor-clean Continuous 45-degree Smoked-Glass Reflection Streak (x=6..11, y=8..16)!
    glass_streak = [
        (6, 9, "S4"),
        (6, 10, "S5"),   # bridges dark gap y=10
        (7, 10, "S3"),
        (7, 11, "K7"),   # crisp white specular glint on Blade 2
        (8, 11, "S6"),
        (8, 12, "K6"),
        (9, 12, "S4"),
        (9, 13, "S5"),   # bridges dark gap y=13
        (10, 14, "K6"),  # glint on Blade 3
        (10, 15, "S5"),
        (11, 15, "K5"),
        (11, 16, "S3"),  # bridges dark gap y=16
        # Subtle secondary parallel top-right glass sheen
        (9, 8, "K6"),
        (10, 9, "K5"),
    ]
    for gx, gy, gtk in glass_streak:
        c.set(gx, gy, gtk)

    # --- 5. Vented Lower Intake Grille (y=21..26) ---
    c.hline(3, 12, 21, "K3")
    c.set(3, 21, "K5")
    c.set(12, 21, "K2")
    c.rect(3, 22, 12, 25, "K0")
    for ly in (23, 25):
        for lx, ltk in [
            (4, "K4"), (5, "K4"), (6, "K3"), (7, "K3"),
            (8, "K2"), (9, "K2"), (10, "K2"), (11, "K1"),
        ]:
            c.set(lx, ly, ltk)
    c.hline(2, 13, 26, "K2")
    c.hline(2, 6, 26, "K3")

    # --- 6. Recessed Neck Collar & Flared Heavy Steel Base + Feet (y=27..30) ---
    c.hline(3, 12, 27, "K1")
    c.set(3, 27, "K3")
    for x, tk in [
        (2, "K6"), (3, "K6"), (4, "K5"), (5, "K5"), (6, "K4"),
        (7, "K4"), (8, "K3"), (9, "K3"), (10, "K3"), (11, "K2"), (12, "K2"), (13, "K1"),
    ]:
        c.set(x, 28, tk)
    c.set(2, 29, "K4")
    c.set(3, 29, "K2")
    c.set(4, 29, "K0")
    c.hline(5, 10, 29, "K0")
    c.set(11, 29, "K0")
    c.set(12, 29, "K3")
    c.set(13, 29, "K1")

    c.enforce_dark_outline("K0")
    return c.im


# ============================================================================
# Strict Verification & Contact Sheet Builder
# ============================================================================
def verify_sprite(name: str, im: Image.Image, expected_size: tuple[int, int], valid_hexes: set[str]) -> dict:
    w, h = im.size
    assert (w, h) == expected_size, f"{name}: size {(w, h)} != {expected_size}"
    px = im.load()

    off_palette = []
    bad_alpha = []
    bad_outline = []
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
            if hx == "#000000":
                pure_black += 1
            if hx not in valid_hexes:
                off_palette.append((x, y, hx))

            touches_bg = False
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if nx < 0 or nx >= w or ny < 0 or ny >= h or px[nx, ny][3] < 255:
                    touches_bg = True
                    break
            if touches_bg and hx not in DARK_OUTLINE_HEXES:
                bad_outline.append((x, y, hx))

    xs = [p[0] for p in opaque_pts]
    ys = [p[1] for p in opaque_pts]
    bbox = (min(xs), min(ys), max(xs), max(ys))
    bw = bbox[2] - bbox[0] + 1
    bh = bbox[3] - bbox[1] + 1
    bottom_margin = h - 1 - bbox[3]

    assert not off_palette, f"{name}: off-palette pixels: {off_palette[:5]}"
    assert pure_black == 0, f"{name}: found #000000!"
    assert not bad_alpha, f"{name}: invalid alpha pixels: {bad_alpha[:5]}"
    assert not bad_outline, f"{name}: non-dark outer outline pixels: {bad_outline[:5]}"
    assert 1 <= bottom_margin <= 2, f"{name}: bottom_margin={bottom_margin} (expected 1..2)"

    return {
        "name": name,
        "canvas": f"{w}x{h}",
        "opaque_bbox": bbox,
        "opaque_size": f"{bw}x{bh}",
        "bottom_margin": bottom_margin,
        "shadow_px": shadow_pts,
        "unique_colors": len({f"#{px[x,y][0]:02x}{px[x,y][1]:02x}{px[x,y][2]:02x}" for x, y in opaque_pts}),
    }


def load_char_native_1x() -> Image.Image:
    raw = Image.open(CHAR_REF_PNG).convert("RGBA")
    # ref_mod1_char.png is 72x96 = 3x nearest upscale of 24x32 (22px tall character)
    if raw.size == (72, 96):
        return raw.resize((24, 32), Image.Resampling.NEAREST)
    return raw


def build_contact_sheet(sprites: list[tuple[str, str, Image.Image, dict]]) -> None:
    bg_gray = (118, 118, 112, 255)  # #767670 neutral inspection gray
    card_bg = (112, 112, 106, 255)
    border = (92, 92, 86, 255)
    text_hi = (242, 242, 236, 255)
    text_lo = (206, 206, 198, 255)

    sheet_w, sheet_h = 780, 420
    sheet = Image.new("RGBA", (sheet_w, sheet_h), bg_gray)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    # Header bar
    draw.rectangle([12, 10, sheet_w - 12, 78], fill=(98, 98, 93, 255), outline=border)
    draw.text(
        (22, 18),
        "modern_pcbang_carbon - Batch 1/4 Gaming Objects (4x Loupe + 2x + 1x) | 118-Color Locked",
        fill=text_hi,
        font=font,
    )
    draw.text(
        (22, 36),
        "Scale Ref: ref_mod1_char (22px @ 1x) | Zero off-palette | #4c557f@85 shadow | 1px dark outlines",
        fill=text_lo,
        font=font,
    )
    draw.text(
        (22, 54),
        "Camera: Orthographic RM2000 3/4 standing (zero side walls) + near-top-down chair",
        fill=text_lo,
        font=font,
    )

    char_1x = load_char_native_1x()
    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.Resampling.NEAREST)
    sheet.alpha_composite(char_2x, (sheet_w - 135, 8))
    sheet.alpha_composite(char_1x, (sheet_w - 65, 40))
    draw.text((sheet_w - 120, 66), "2x", fill=text_lo, font=font)
    draw.text((sheet_w - 58, 66), "1x", fill=text_lo, font=font)

    # 5 object cards across 1 row with separated 4x loupe box + 2x/1x/char scale floor
    card_w = 144
    gap = 9
    start_x = 12
    top_y = 90
    card_h = 316

    for idx, (fname, kind, im, stats) in enumerate(sprites):
        cx = start_x + idx * (card_w + gap)
        draw.rectangle([cx, top_y, cx + card_w, top_y + card_h], fill=card_bg, outline=border)

        # Upper 4x loupe compartment (height 140px)
        im_4x = im.resize((im.width * 4, im.height * 4), Image.Resampling.NEAREST)
        lx = cx + (card_w - im_4x.width) // 2
        ly = top_y + 8 + (128 - im_4x.height) // 2
        sheet.alpha_composite(im_4x, (lx, ly))
        draw.line([cx + 8, top_y + 144, cx + card_w - 8, top_y + 144], fill=border)

        # Lower 2x + 1x + 1x char scale floor (zero overlap!)
        floor_2x_y = top_y + 244
        draw.line([cx + 8, floor_2x_y, cx + card_w - 8, floor_2x_y], fill=border)

        im_2x = im.resize((im.width * 2, im.height * 2), Image.Resampling.NEAREST)
        p2x = cx + 10
        p2y = floor_2x_y - im_2x.height
        sheet.alpha_composite(im_2x, (p2x, p2y))

        p1x = cx + 82
        p1y = floor_2x_y - im.height
        sheet.alpha_composite(im, (p1x, p1y))

        c1x = cx + 114
        c1y = floor_2x_y - char_1x.height + 3
        sheet.alpha_composite(char_1x, (c1x, c1y))

        label = fname.replace(".png", "")
        draw.text((cx + 6, top_y + 252), f"0{idx+1}. {label}", fill=text_hi, font=font)
        draw.text((cx + 6, top_y + 270), f"[{kind}] {stats['canvas']}", fill=text_lo, font=font)
        draw.text((cx + 6, top_y + 288), f"opaque {stats['opaque_size']} ({stats['unique_colors']}c)", fill=text_lo, font=font)

    sheet.save(PREVIEW_PNG)


def main() -> None:
    OBJ_DIR.mkdir(parents=True, exist_ok=True)
    pal_data = json.loads(PALETTE_JSON.read_text())
    valid_hexes = {c.lower() for c in pal_data["all_colors"]}
    assert len(valid_hexes) == 118

    specs = [
        ("pc_station_blue.png", "standing", (32, 32), build_pc_station_blue()),
        ("pc_station_red.png", "standing", (32, 32), build_pc_station_red()),
        ("gaming_chair_red.png", "chair", (16, 16), build_gaming_chair_red()),
        ("gaming_chair_blue.png", "chair", (16, 16), build_gaming_chair_blue()),
        ("server_rack.png", "standing", (16, 32), build_server_rack()),
    ]

    rendered = []
    for fname, kind, expected_sz, im in specs:
        out_path = OBJ_DIR / fname
        im.save(out_path)
        stats = verify_sprite(fname, im, expected_sz, valid_hexes)
        rendered.append((fname, kind, im, stats))
        print(
            f"PASS {fname:22s} | canvas={stats['canvas']:5s} | "
            f"opaque={stats['opaque_size']:5s} bbox={stats['opaque_bbox']} | "
            f"bot_margin={stats['bottom_margin']}px | shadow={stats['shadow_px']:2d}px | "
            f"colors={stats['unique_colors']:2d}"
        )

    build_contact_sheet(rendered)
    print(f"Wrote contact sheet -> {PREVIEW_PNG}")


if __name__ == "__main__":
    main()
