#!/usr/bin/env python3
"""
K-Street Fable-Grade Korean Shops — T1 Batch 2/6
Generates two 100% original Korean street shopfront buildings from scratch:
  1. k-bunsik.png  (48x112 RGBA) — Beloved Korean neighborhood 분식집 ('분식')
  2. k-chicken.png (64x112 RGBA) — Lively Korean 치킨호프 ('치킨호프')

Strictly locked to:
  - tiledata/jp-city/fable-city/palette.json (0 off-palette, 0 #000000, binary alpha {0, 255})
  - tiledata/k-street-carbon/hangul9.json (9x9 crisp Korean Hangul signboard bitmaps)
"""

from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
PALETTE_PATH = ROOT / "tiledata/jp-city/fable-city/palette.json"
GLYPHS_PATH = ROOT / "tiledata/k-street-carbon/hangul9.json"
SHOPS_DIR = ROOT / "tiledata/k-street-carbon/shops"
PREVIEW_PATH = ROOT / "tiledata/k-street-carbon/preview_batch2.png"


def hex_to_rgba(hx: str) -> tuple[int, int, int, int]:
    hx = hx.lstrip("#")
    return (int(hx[0:2], 16), int(hx[2:4], 16), int(hx[4:6], 16), 255)


def clamp(v: int, lo: int, hi: int) -> int:
    return lo if v < lo else (hi if v > hi else v)


def h2(x: int, y: int, seed: int = 0) -> int:
    """Deterministic spatial hash in 0..255."""
    n = (x * 374761393 + y * 668265263 + seed * 1442695041) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) >> 8) & 0xFF


def load_resources():
    with open(PALETTE_PATH, "r", encoding="utf-8") as f:
        pal_raw = json.load(f)["ramps"]
    ramps: dict[str, list[tuple[int, int, int, int]]] = {
        k: [hex_to_rgba(c) for c in v] for k, v in pal_raw.items()
    }
    allowed_rgb: set[tuple[int, int, int]] = {
        (c[0], c[1], c[2]) for cols in ramps.values() for c in cols
    }
    with open(GLYPHS_PATH, "r", encoding="utf-8") as f:
        glyphs: dict[str, list[str]] = json.load(f)["glyphs"]
    return ramps, allowed_rgb, glyphs


class PixelCanvas:
    def __init__(self, w: int, h: int, ramps: dict[str, list[tuple[int, int, int, int]]]):
        self.w = w
        self.h = h
        self.ramps = ramps
        self.img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.px = self.img.load()
        self.color_to_ramp: dict[tuple[int, int, int, int], tuple[str, int]] = {}
        priority = [
            "cha", "aka", "rooftile", "brick", "cream", "kinari", "wood", "cedar",
            "darkwood", "floorwood", "stone", "concrete", "steel", "glass", "white",
            "coolwhite", "foliage", "green", "midori", "moss", "red", "maple",
            "orange", "yellow", "pink", "blue", "navy", "teal", "tile", "kawara",
            "ibushi", "kuro", "asphalt", "pavement", "soil", "straw", "ink",
        ]
        for rname in reversed(list(ramps.keys())):
            for idx, col in enumerate(ramps[rname]):
                self.color_to_ramp[col] = (rname, idx)
        for rname in reversed(priority):
            if rname in ramps:
                for idx, col in enumerate(ramps[rname]):
                    self.color_to_ramp[col] = (rname, idx)

    def c(self, ramp: str, idx: int) -> tuple[int, int, int, int]:
        arr = self.ramps[ramp]
        return arr[clamp(idx, 0, len(arr) - 1)]

    def put(self, x: int, y: int, col: tuple[int, int, int, int]) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = col

    def p(self, x: int, y: int, ramp: str, idx: int) -> None:
        self.put(x, y, self.c(ramp, idx))

    def get(self, x: int, y: int) -> tuple[int, int, int, int]:
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[x, y]
        return (0, 0, 0, 0)

    def rect(self, x0: int, y0: int, x1: int, y1: int, col: tuple[int, int, int, int]) -> None:
        for y in range(max(0, y0), min(self.h, y1 + 1)):
            for x in range(max(0, x0), min(self.w, x1 + 1)):
                self.px[x, y] = col

    def prect(self, x0: int, y0: int, x1: int, y1: int, ramp: str, idx: int) -> None:
        self.rect(x0, y0, x1, y1, self.c(ramp, idx))

    def hline(self, x0: int, x1: int, y: int, col: tuple[int, int, int, int]) -> None:
        self.rect(x0, y, x1, y, col)

    def phline(self, x0: int, x1: int, y: int, ramp: str, idx: int) -> None:
        self.rect(x0, y, x1, y, self.c(ramp, idx))

    def vline(self, x: int, y0: int, y1: int, col: tuple[int, int, int, int]) -> None:
        self.rect(x, y0, x, y1, col)

    def pvline(self, x: int, y0: int, y1: int, ramp: str, idx: int) -> None:
        self.rect(x, y0, x, y1, self.c(ramp, idx))

    def box(
        self,
        x0: int,
        y0: int,
        x1: int,
        y1: int,
        border_col: tuple[int, int, int, int],
        fill_col: tuple[int, int, int, int] | None = None,
    ) -> None:
        if fill_col is not None and x1 > x0 + 1 and y1 > y0 + 1:
            self.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill_col)
        self.hline(x0, x1, y0, border_col)
        self.hline(x0, x1, y1, border_col)
        self.vline(x0, y0, y1, border_col)
        self.vline(x1, y0, y1, border_col)

    def shadow_pixel(self, x: int, y: int, steps: int = 2) -> None:
        cur = self.get(x, y)
        if cur[3] == 0:
            return
        info = self.color_to_ramp.get(cur)
        if info is None:
            self.put(x, y, self.c("ink", 0))
            return
        rname, idx = info
        if idx - steps < 0:
            self.put(x, y, self.c("ink", 0) if steps >= 2 else self.c(rname, 0))
        else:
            self.put(x, y, self.c(rname, idx - steps))

    def shadow_rect(self, x0: int, y0: int, x1: int, y1: int, steps: int = 2) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.shadow_pixel(x, y, steps)

    def draw_glyph(
        self,
        glyphs: dict[str, list[str]],
        ch: str,
        x0: int,
        y0: int,
        fg_top: tuple[int, int, int, int],
        fg_bot: tuple[int, int, int, int],
        shadow: tuple[int, int, int, int] | None = None,
    ) -> None:
        rows = glyphs[ch]
        if shadow is not None:
            for ry, row in enumerate(rows):
                for rx, cell in enumerate(row):
                    if cell == "#":
                        self.put(x0 + rx + 1, y0 + ry + 1, shadow)
                        self.put(x0 + rx, y0 + ry + 1, shadow)
        for ry, row in enumerate(rows):
            col = fg_top if ry < 5 else fg_bot
            for rx, cell in enumerate(row):
                if cell == "#":
                    self.put(x0 + rx, y0 + ry, col)


# ==============================================================================
# BUILDING 1: K-BUNSIK (48 x 112) — Beloved Korean Neighborhood 분식집 ('분식')
# ==============================================================================
def build_k_bunsik(ramps: dict, glyphs: dict) -> Image.Image:
    W, H = 48, 112
    cv = PixelCanvas(W, H, ramps)
    ink0 = cv.c("ink", 0)
    ink1 = cv.c("ink", 1)

    # ------------------------------------------------------------------
    # 1. ROOF (y=0..39): Concrete Parapet + Korean Green Urethane Slab
    #    + Silver Kitchen Exhaust Chimney Duct + Crate + AC Condenser
    # ------------------------------------------------------------------
    # Parapet structural shell (y=9..39, full width x=0..47)
    cv.prect(0, 9, W - 1, 39, "concrete", 1)
    cv.phline(0, W - 1, 9, "ink", 0)
    cv.phline(1, W - 2, 10, "concrete", 6)
    cv.phline(2, W - 3, 11, "concrete", 4)
    cv.phline(3, W - 4, 12, "concrete", 1)
    cv.phline(3, W - 4, 13, "ink", 1)

    # Side parapet coping walls (x=0..2 and x=45..47)
    for y in range(10, 34):
        cv.p(0, y, "ink", 0)
        cv.p(1, y, "concrete", 5 if y % 7 != 0 else 3)
        cv.p(2, y, "concrete", 3)

        cv.p(W - 3, y, "concrete", 4)
        cv.p(W - 2, y, "concrete", 5 if y % 7 != 0 else 3)
        cv.p(W - 1, y, "ink", 0)

    # Korean 옥상 green urethane waterproofed slab (x=3..44, y=14..32)
    for y in range(14, 33):
        for x in range(3, 45):
            hv = h2(x, y, 17)
            if y == 14:
                cv.p(x, y, "green", 1)
            elif y == 15:
                cv.p(x, y, "midori", 2 if hv < 140 else 3)
            elif y <= 20:
                cv.p(x, y, "midori", 3 if hv < 170 else 4)
            elif y <= 27:
                if 70 <= hv <= 115:
                    cv.p(x, y, "green", 3)
                else:
                    cv.p(x, y, "midori", 4 if hv > 90 else 3)
            elif y <= 30:
                cv.p(x, y, "midori", 4 if hv < 160 else 5)
            else:
                cv.p(x, y, "midori", 5 if hv > 100 else 4)

    # Expansion seams & drainage grate on green slab
    cv.phline(3, 44, 23, "midori", 2)
    cv.phline(4, 43, 24, "midori", 5)
    cv.pvline(23, 14, 32, "midori", 2)
    cv.pvline(24, 15, 31, "midori", 4)
    # Corner scupper drain (bottom-left x=4..6, y=30..32)
    cv.prect(4, 30, 6, 32, "steel", 1)
    cv.p(5, 30, "steel", 3)
    cv.p(5, 31, "ink", 0)

    # South parapet coping & cornice molding (y=33..39)
    cv.phline(0, W - 1, 33, "concrete", 3)
    cv.phline(1, W - 2, 34, "white", 6)
    cv.phline(1, W - 2, 35, "concrete", 5)
    for jx in (12, 24, 36):
        cv.pvline(jx, 33, 35, "concrete", 3)
        cv.p(jx, 10, "concrete", 4)
    cv.phline(0, W - 1, 36, "concrete", 3)
    cv.phline(0, W - 1, 37, "concrete", 2)
    cv.phline(0, W - 1, 38, "concrete", 0)
    cv.phline(0, W - 1, 39, "ink", 0)
    cv.pvline(0, 33, 39, "ink", 0)
    cv.pvline(W - 1, 33, 39, "ink", 0)

    # --- Rooftop Prop A: Silver Kitchen Exhaust Chimney Duct (left-center x=5..15, y=1..28) ---
    # Cast shadow onto green roof slab & north parapet
    cv.shadow_rect(14, 10, 17, 29, steps=2)
    cv.shadow_rect(7, 28, 17, 29, steps=2)

    # Conical rain-cap hood above parapet (x=5..15, y=1..5)
    cv.phline(8, 12, 1, "ink", 0)
    cv.phline(6, 14, 2, "ink", 0)
    cv.phline(7, 11, 2, "steel", 6)
    cv.phline(12, 13, 2, "steel", 4)
    cv.phline(5, 15, 3, "ink", 0)
    cv.phline(6, 9, 3, "white", 6)
    cv.phline(10, 12, 3, "steel", 5)
    cv.phline(13, 14, 3, "steel", 3)
    cv.phline(5, 15, 4, "ink", 0)
    cv.phline(6, 14, 4, "steel", 2)
    # Dark exhaust vent gap & struts (y=5..6)
    for x in (7, 10, 13):
        cv.p(x, 5, "steel", 4 if x == 7 else 2)
        cv.p(x, 6, "steel", 3 if x == 7 else 1)
    for x in (8, 9, 11, 12):
        cv.p(x, 5, "ink", 0)
        cv.p(x, 6, "kuro", 1)
    cv.pvline(6, 5, 6, "ink", 0)
    cv.pvline(14, 5, 6, "ink", 0)

    # Vertical cylindrical galvanized steel riser (x=7..13, y=7..23)
    for y in range(7, 24):
        is_collar = y in (10, 16, 21)
        cv.p(7, y, "ink", 0)
        cv.p(8, y, "steel", 4 if is_collar else 5)
        cv.p(9, y, "white" if not is_collar else "steel", 6 if not is_collar else 5)
        cv.p(10, y, "steel", 5 if not is_collar else 3)
        cv.p(11, y, "steel", 3 if not is_collar else 2)
        cv.p(12, y, "steel", 2 if not is_collar else 1)
        cv.p(13, y, "ink", 0)
        if is_collar:
            cv.p(6, y, "ink", 0)
            cv.p(14, y, "ink", 0)

    # Rooftop blower base box & roof penetration collar (x=6..14, y=23..27)
    cv.box(6, 23, 14, 27, ink0, cv.c("steel", 3))
    cv.phline(7, 13, 24, "steel", 5)
    cv.pvline(7, 24, 26, "steel", 4)
    cv.phline(8, 12, 26, "steel", 2)
    cv.p(8, 25, "orange", 4)  # tiny caution sticker on blower housing

    # --- Rooftop Prop B: Stacked Red/Yellow Beverage Crates & Onggi Jar (x=19..28, y=20..30) ---
    cv.shadow_rect(21, 23, 30, 31, steps=2)
    # Bottom yellow crate (x=19..26, y=25..29)
    cv.box(19, 25, 26, 29, ink0, cv.c("yellow", 3))
    cv.phline(20, 25, 26, "yellow", 5)
    for sx in (21, 23, 25):
        cv.p(sx, 27, "yellow", 1)
        cv.p(sx, 28, "yellow", 2)
    # Top red bun-sik sauce/soda crate (x=19..26, y=20..25)
    cv.box(19, 20, 26, 25, ink0, cv.c("red", 3))
    cv.phline(20, 25, 21, "red", 5)
    # Bottle caps peeking inside top crate
    for bx, col_r in ((20, "green"), (22, "white"), (24, "orange")):
        cv.p(bx, 22, col_r, 5)
    cv.phline(20, 25, 23, "red", 4)
    cv.phline(20, 25, 24, "red", 2)
    # Small glazed brown gochujang onggi pot beside crate (x=26..29, y=24..30)
    cv.box(26, 25, 29, 30, ink0, cv.c("cha", 3))
    cv.phline(26, 29, 24, "ink", 0)
    cv.phline(27, 28, 25, "cha", 6)
    cv.p(27, 26, "cha", 5)
    cv.p(28, 27, "cha", 2)

    # --- Rooftop Prop C: 3/4 AC Condenser Unit (x=31..43, y=16..29) ---
    cv.shadow_rect(33, 19, 44, 30, steps=2)
    # Insulated copper/cream refrigerant pipe going to north parapet
    cv.pvline(33, 13, 16, "cream", 5)
    cv.pvline(34, 13, 16, "ink", 0)
    # Rubber feet
    cv.prect(32, 28, 34, 29, "ink", 0)
    cv.prect(40, 28, 42, 29, "ink", 0)
    # Condenser cabinet (x=31..43, y=16..28)
    cv.box(31, 16, 43, 28, ink0, cv.c("coolwhite", 4))
    cv.phline(32, 42, 17, "white", 6)
    cv.phline(32, 42, 18, "coolwhite", 5)
    cv.pvline(32, 18, 27, "white", 5)
    cv.pvline(42, 18, 27, "coolwhite", 2)
    cv.phline(32, 42, 27, "coolwhite", 2)
    # Dark circular fan grille (x=33..38, y=19..25)
    for dy in range(7):
        for dx in range(6):
            gx, gy = 33 + dx, 19 + dy
            if dy in (0, 6) and dx in (0, 5):
                continue
            dist = abs(dx - 2.5) + abs(dy - 3.0)
            if dist < 1.5:
                cv.p(gx, gy, "steel", 4)
            elif (dx + dy) % 2 == 0:
                cv.p(gx, gy, "kuro", 1)
            else:
                cv.p(gx, gy, "steel", 1)
    cv.p(35, 22, "steel", 5)
    # Side vent louvers & blue badge on right of AC (x=40..41)
    cv.phline(40, 41, 19, "blue", 3)
    for ly in (21, 23, 25):
        cv.phline(40, 41, ly, "steel", 2)

    # ------------------------------------------------------------------
    # 2. 2F FACADE & KOREAN SIGNBOARD (y=40..71)
    #    Warm cream/kinari tiled wall + cozy curtained window + '분식' sign
    # ------------------------------------------------------------------
    for y in range(40, 72):
        ty = (y - 40) % 4
        tc = (y - 40) // 4
        stagger = (tc % 2) * 4
        for x in range(W):
            if x == 0 or x == W - 1:
                cv.p(x, y, "ink", 0 if ty == 3 else 1)
                continue
            tx = (x + stagger) % 8
            ti = (x + stagger) // 8
            hv = h2(ti, tc, 53)
            if ty == 3:
                cv.p(x, y, "kinari", 2 if hv > 80 else 1)
            elif tx == 0:
                cv.p(x, y, "kinari", 3 if hv > 90 else 2)
            else:
                if hv < 60:
                    cv.p(x, y, "kinari", 4)
                elif hv < 150:
                    cv.p(x, y, "cream", 5)
                elif hv < 215:
                    cv.p(x, y, "kinari", 5)
                else:
                    cv.p(x, y, "cream", 6 if ty == 0 else 5)

    # Crisp 3px roof cornice cast shadow at top of 2F (y=40..42)
    cv.phline(0, W - 1, 40, "ink", 0)
    cv.shadow_rect(1, 41, W - 2, 41, steps=2)
    cv.shadow_rect(1, 42, W - 2, 42, steps=1)

    # Vertical utility drain/gas pipe on far left (x=2..3, y=40..57)
    for y in range(41, 58):
        cv.p(2, y, "steel", 5 if y % 6 != 0 else 2)
        cv.p(3, y, "steel", 2 if y % 6 != 0 else 1)
        if y in (44, 52):
            cv.p(1, y, "steel", 1)
            cv.p(4, y, "kinari", 2)

    # Cozy 2F Double Sliding Window with Warm Curtains & Flower Sill (x=8..41, y=43..55)
    cv.shadow_rect(9, 56, 43, 57, steps=2)
    cv.shadow_rect(42, 44, 43, 56, steps=2)
    cv.box(8, 43, 41, 55, ink0, cv.c("steel", 4))
    cv.phline(9, 40, 44, "white", 5)
    cv.pvline(24, 44, 54, "steel", 5)
    cv.pvline(25, 44, 54, "ink", 0)

    # Left pane (x=10..23, y=45..53): cozy warm pleated apricot/cream curtain + indoor glow
    for y in range(45, 54):
        for x in range(10, 24):
            dx = x - 10
            if dx < 8:
                # Pleated cozy curtain
                fold = dx % 3
                if y == 45:
                    cv.p(x, y, "wood", 4)  # curtain rod
                elif fold == 0:
                    cv.p(x, y, "cream", 6 if y < 51 else 5)
                elif fold == 1:
                    cv.p(x, y, "orange", 5 if y < 50 else 4)
                else:
                    cv.p(x, y, "cream", 3)
            else:
                # Warm golden room glow beside drawn curtain
                if y <= 47:
                    cv.p(x, y, "orange", 3)
                elif (x + y) % 5 == 0:
                    cv.p(x, y, "yellow", 5)
                else:
                    cv.p(x, y, "yellow", 4)

    # Right pane (x=26..39, y=45..53): reflective evening glass + half curtain + mini plant silhouette
    for y in range(45, 54):
        for x in range(26, 40):
            dx = x - 26
            if dx >= 8:
                fold = (dx - 8) % 3
                if y == 45:
                    cv.p(x, y, "wood", 4)
                elif fold == 0:
                    cv.p(x, y, "cream", 6 if y < 51 else 5)
                elif fold == 1:
                    cv.p(x, y, "orange", 5 if y < 50 else 4)
                else:
                    cv.p(x, y, "cream", 3)
            else:
                d = dx + (y - 45)
                if d in (4, 5):
                    cv.p(x, y, "glass", 4)
                elif d == 6:
                    cv.p(x, y, "glass", 3)
                elif y <= 47:
                    cv.p(x, y, "glass", 1)
                else:
                    cv.p(x, y, "glass", 2)

    # Window sill (x=7..42, y=55..56) + cute potted red geranium on sill
    cv.phline(7, 42, 55, "white", 6)
    cv.phline(7, 42, 56, "kinari", 2)
    cv.p(7, 55, "ink", 0)
    cv.p(42, 55, "ink", 0)
    # Mini flower pot at x=28..32, y=51..54
    cv.phline(29, 31, 54, "brick", 4)
    cv.phline(28, 32, 53, "foliage", 3)
    cv.phline(29, 31, 52, "foliage", 5)
    cv.p(29, 51, "red", 4)
    cv.p(31, 52, "red", 5)

    # --- Bright Red-Orange Beveled Korean Signboard '분식' (x=3..44, y=57..70) ---
    # Drop shadow onto 2F wall & awning header
    cv.shadow_rect(45, 59, 46, 71, steps=2)
    cv.box(3, 57, 44, 70, ink0)
    # Outer metallic/cream-beveled frame (x=4..43, y=58..69)
    cv.phline(4, 43, 58, "orange", 5)
    cv.phline(4, 43, 69, "red", 1)
    cv.pvline(4, 58, 69, "orange", 4)
    cv.pvline(43, 58, 69, "red", 1)

    # Vibrant red-orange inner signboard face (x=5..42, y=59..68)
    for y in range(59, 69):
        for x in range(5, 43):
            if y == 59:
                cv.p(x, y, "red", 4 if (x % 5 != 0) else 5)
            elif y <= 62:
                cv.p(x, y, "red", 3)
            elif y <= 65:
                cv.p(x, y, "red", 2)
            else:
                cv.p(x, y, "maple", 3 if y < 68 else 2)

    # Inner crisp cream pin-stripe accent corners
    for cx, cy in ((5, 59), (42, 59), (5, 68), (42, 68)):
        cv.p(cx, cy, "yellow", 5)

    # Left Signboard Emblem: Crisp Outlined Bowl of Crimson Tteokbokki + Skewer (x=6..15, y=59..68)
    # Rising golden steam wisps
    cv.p(9, 59, "yellow", 5)
    cv.p(12, 59, "cream", 6)
    cv.p(10, 60, "white", 6)
    # Bamboo skewer sticking out top-right
    cv.p(14, 60, "white", 6)
    cv.p(13, 61, "yellow", 5)
    # Outlined white/gold ceramic bowl brimming with bright red-orange tteokbokki
    cv.phline(8, 13, 62, "orange", 5)
    cv.p(9, 62, "white", 6)
    cv.p(11, 62, "red", 5)
    cv.phline(6, 15, 63, "ink", 0)
    cv.phline(7, 14, 63, "white", 6)
    cv.p(6, 64, "ink", 0)
    cv.phline(7, 14, 64, "yellow", 5)
    cv.p(15, 64, "ink", 0)
    cv.p(7, 65, "ink", 0)
    cv.phline(8, 13, 65, "orange", 4)
    cv.p(14, 65, "ink", 0)
    cv.phline(8, 13, 66, "ink", 0)
    cv.phline(9, 12, 66, "yellow", 3)
    cv.phline(9, 12, 67, "ink", 0)

    # Hangul '분식' glyphs (9x9 each at y=59..67)
    cv.draw_glyph(
        glyphs, "분", 18, 59,
        fg_top=cv.c("white", 6),
        fg_bot=cv.c("cream", 6),
        shadow=cv.c("ink", 0),
    )
    cv.draw_glyph(
        glyphs, "식", 30, 59,
        fg_top=cv.c("white", 6),
        fg_bot=cv.c("cream", 6),
        shadow=cv.c("ink", 0),
    )
    # Tiny warm accent dot on right (x=40..41, y=63..64)
    cv.prect(40, 63, 41, 64, "yellow", 5)

    # ------------------------------------------------------------------
    # 3. 1F LIVING STOREFRONT (y=72..111)
    #    Red & cream scalloped awning + crimson tteokbokki pan + golden odeng
    #    skewer pot w/ steam wisps behind glass sneeze-guard + menu strips
    #    + sliding glass door + sidewalk red stool
    # ------------------------------------------------------------------
    # Steel awning mounting bar (y=71)
    cv.phline(0, W - 1, 71, "ink", 0)

    # Storefront warm interior & side pillars background first (y=78..109)
    cv.prect(0, 78, W - 1, 109, "darkwood", 0)
    # Left & Right tiled shopfront piers (x=0..2, x=45..47) + middle divider pier (x=29..30)
    for y in range(78, 109):
        for px in (0, 47):
            cv.p(px, y, "ink", 0)
        cv.p(1, y, "cream", 5 if (y % 4 != 0) else 3)
        cv.p(2, y, "kinari", 3)
        cv.p(29, y, "steel", 4 if (y % 5 != 0) else 2)
        cv.p(30, y, "ink", 0)
        cv.p(45, y, "kinari", 4)
        cv.p(46, y, "cream", 3 if (y % 4 != 0) else 2)

    # Cheerful Red-and-Cream Scalloped Fabric Awning (x=0..47, y=72..79)
    for x in range(W):
        if x == 0 or x == W - 1:
            cv.pvline(x, 72, 78, "ink", 0)
            continue
        stripe = (x // 4) % 2  # 0 = crimson red, 1 = warm cream
        sx = x % 4
        is_scallop_notch = sx in (0, 3)
        for y in range(72, 80):
            if y == 79 and is_scallop_notch:
                # Cast shadow under scallop notch
                cv.shadow_pixel(x, y, steps=2)
                continue
            if y == 79 or (y == 78 and is_scallop_notch):
                cv.p(x, y, "ink", 0)
                continue
            if stripe == 0:
                if y == 72:
                    cv.p(x, y, "orange", 4 if sx in (1, 2) else 3)
                elif y <= 74:
                    cv.p(x, y, "red", 4 if sx in (1, 2) else 3)
                elif y <= 76:
                    cv.p(x, y, "red", 3 if sx in (1, 2) else 2)
                else:
                    cv.p(x, y, "red", 2 if sx in (1, 2) else 1)
            else:
                if y == 72:
                    cv.p(x, y, "white", 6)
                elif y <= 74:
                    cv.p(x, y, "cream", 6 if sx in (1, 2) else 5)
                elif y <= 76:
                    cv.p(x, y, "cream", 5 if sx in (1, 2) else 4)
                else:
                    cv.p(x, y, "cream", 3)

    # Awning cast shadow across top of 1F counter & door (y=80..81)
    for x in range(1, W - 1):
        if cv.get(x, 79) != ink0:
            cv.p(x, 79, "ink", 0)
        cv.shadow_pixel(x, 80, steps=2)

    # --- Open Kitchen Interior Behind Snack Bar (x=3..28, y=80..94) ---
    for y in range(80, 95):
        for x in range(3, 29):
            if y <= 81:
                cv.p(x, y, "darkwood", 0 if y == 80 else 1)
            elif y == 82:
                # Stainless exhaust hood lip + warm fluorescent strip light
                cv.p(x, y, "white" if 13 <= x <= 25 else "steel", 6 if 13 <= x <= 25 else 3)
            elif y == 83:
                cv.p(x, y, "yellow" if 13 <= x <= 25 else "darkwood", 4 if 13 <= x <= 25 else 2)
            elif y <= 87:
                cv.p(x, y, "darkwood", 2)
            else:
                cv.p(x, y, "darkwood", 1)

    # Crisp Hanging Korean Menu Strips ('떡볶이 / 순대 / 오뎅') on upper-left header (x=4..11, y=81..86)
    menu_specs = [
        (4, "yellow", 5, "red", 3),
        (7, "white", 6, "ink", 0),
        (10, "orange", 5, "ink", 0),
    ]
    for mx, bg_r, bg_i, tx_r, tx_i in menu_specs:
        cv.prect(mx, 81, mx + 1, 86, bg_r, bg_i)
        cv.p(mx, 82, tx_r, tx_i)
        cv.p(mx + 1, 84, tx_r, tx_i)
        cv.p(mx, 85, tx_r, tx_i)

    # --- Left Pan: Bright Crimson Tteokbokki Griddle Pan (x=3..15, y=90..95) ---
    cv.prect(3, 90, 15, 95, "steel", 3)
    cv.phline(3, 15, 90, "steel", 5)
    cv.pvline(3, 90, 94, "steel", 5)
    cv.pvline(15, 90, 94, "steel", 2)
    cv.phline(3, 15, 95, "ink", 0)
    # Rich bubbling crimson gochujang sauce + plump cylinder rice cakes
    for y in range(91, 95):
        for x in range(4, 15):
            cv.p(x, y, "red", 3 if (x + y) % 2 == 0 else 2)
    tteok_pixels = [
        (5, 91, "white", 6), (6, 91, "cream", 5),
        (9, 91, "orange", 5), (10, 91, "cream", 6),
        (12, 92, "white", 6), (13, 92, "orange", 5),
        (6, 93, "orange", 5), (7, 93, "cream", 6),
        (10, 93, "yellow", 4), (11, 93, "orange", 4),
        (5, 94, "red", 4), (9, 94, "red", 4), (13, 94, "orange", 4),
        (8, 92, "green", 5), (14, 93, "green", 4),  # scallion garnish
    ]
    for tx, ty, tr, ti in tteok_pixels:
        cv.p(tx, ty, tr, ti)

    # --- Right Pot: Steaming Golden Odeng Skewer Broth Pot (x=16..28, y=90..95) ---
    cv.prect(16, 90, 28, 95, "steel", 4)
    cv.phline(16, 28, 90, "steel", 6)
    cv.pvline(22, 90, 95, "steel", 5)  # compartment divider
    cv.phline(16, 28, 95, "ink", 0)
    for y in range(91, 95):
        for x in range(17, 28):
            if x == 22:
                continue
            cv.p(x, y, "yellow", 4 if (x + y) % 2 == 0 else 3)
    # Bamboo skewers & folded golden fishcakes rising cleanly at y=88..93
    for sx in (18, 20, 24, 26):
        cv.p(sx, 88, "cream", 6)
        cv.p(sx, 89, "straw", 4)
        cv.p(sx, 90, "orange", 5)
        cv.p(sx, 91, "yellow", 5)
        cv.p(sx, 92, "orange", 4)
    # Paper cup stack on right corner of counter (x=27..28, y=88..90)
    cv.pvline(28, 88, 90, "white", 6)
    cv.pvline(27, 89, 90, "coolwhite", 4)

    # --- Glass Sneeze-Guard ('유리 가림막') + Pale Steam Wisps (x=3..28, y=84..90) ---
    cv.phline(3, 28, 87, "glass", 4)
    cv.pvline(3, 87, 90, "steel", 4)
    cv.pvline(16, 87, 90, "glass", 3)
    cv.p(5, 88, "glass", 5)
    cv.p(6, 89, "glass", 4)

    # Pale rising steam wisps visible cleanly against calm dark kitchen backdrop!
    steam_pts = [
        (8, 89, "coolwhite", 4), (9, 88, "white", 6), (8, 86, "coolwhite", 5), (9, 85, "coolwhite", 3),
        (13, 89, "white", 5), (14, 88, "coolwhite", 4), (13, 86, "coolwhite", 4),
        (19, 87, "white", 6), (20, 86, "coolwhite", 5), (19, 85, "white", 5), (20, 84, "coolwhite", 3),
        (25, 87, "coolwhite", 5), (24, 86, "white", 6), (25, 85, "coolwhite", 4),
    ]
    for sx, sy, sr, si in steam_pts:
        cv.p(sx, sy, sr, si)

    # --- Stainless Steel & Warm Red-Tiled Snack Counter Front (x=3..28, y=96..108) ---
    # Projecting stainless eating ledge (y=96..97)
    cv.phline(2, 29, 96, "white", 6)
    cv.phline(2, 29, 97, "steel", 4)
    cv.phline(3, 28, 98, "ink", 0)
    # Cheerful warm red-orange & cream tiled counter apron (y=99..107)
    for y in range(99, 108):
        for x in range(3, 29):
            if y in (99, 100):
                cv.p(x, y, "orange", 4 if (x % 4 != 0) else 3)
            elif y == 101:
                cv.p(x, y, "cream", 5)
            else:
                # Neat red tiles below
                if (x % 4 == 0) or y == 105:
                    cv.p(x, y, "red", 1)
                else:
                    cv.p(x, y, "red", 3 if y < 105 else 2)
    cv.phline(3, 28, 108, "ink", 0)

    # --- Right Warm Glass Sliding Door ('미닫이 출입문', x=31..44, y=80..108) ---
    cv.box(31, 80, 44, 108, ink0, cv.c("steel", 4))
    cv.box(32, 81, 43, 107, cv.c("steel", 5))
    # Upper warm glowing glass pane (x=33..42, y=82..96)
    for y in range(82, 97):
        for x in range(33, 43):
            d = (x - 33) + (y - 82)
            if y <= 84:
                cv.p(x, y, "orange", 3)
            elif d in (6, 7):
                cv.p(x, y, "yellow", 5)
            elif y <= 91:
                cv.p(x, y, "yellow", 4 if x < 39 else 3)
            else:
                cv.p(x, y, "orange", 4 if x < 38 else 3)
    # Cute hanging red/white '영업중' (OPEN) plaque inside glass door (x=35..40, y=87..90)
    cv.box(35, 87, 40, 90, ink0, cv.c("red", 4))
    cv.phline(36, 39, 88, "white", 6)
    # Horizontal stainless push bar & lock (y=97..98)
    cv.phline(32, 43, 97, "white", 6)
    cv.phline(32, 43, 98, "steel", 2)
    cv.pvline(33, 95, 99, "steel", 5)
    # Lower warm glass + brushed steel kickplate (x=33..42, y=99..106)
    for y in range(99, 107):
        for x in range(33, 43):
            if y == 102:
                cv.p(x, y, "steel", 5)
            elif y >= 103:
                cv.p(x, y, "steel", 3 if y < 105 else 2)
            else:
                cv.p(x, y, "orange", 3 if x < 39 else 2)

    # --- Sidewalk Curb Base (y=109..111, full width x=0..47) ---
    cv.phline(0, W - 1, 109, "pavement", 5)
    cv.phline(0, W - 1, 110, "pavement", 3)
    cv.phline(0, W - 1, 111, "ink", 0)
    for jx in (11, 23, 35):
        cv.p(jx, 109, "pavement", 3)
        cv.p(jx, 110, "pavement", 2)
    # Warm inviting doormat step at door threshold (x=31..44, y=109..110)
    cv.phline(31, 44, 109, "stone", 5)
    cv.phline(31, 44, 110, "stone", 3)

    # --- Tiny Sidewalk Plastic/Steel Stool in Front of Snack Bar (x=11..18, y=101..110) ---
    # Cast shadow onto counter base & sidewalk
    cv.shadow_rect(14, 103, 20, 110, steps=2)
    # Round red cushioned/plastic top (x=11..17, y=101..103)
    cv.phline(12, 16, 101, "ink", 0)
    cv.phline(11, 17, 102, "red", 5)
    cv.p(11, 102, "ink", 0)
    cv.p(17, 102, "ink", 0)
    cv.p(13, 102, "white", 6)  # glossy plastic highlight
    cv.phline(11, 17, 103, "red", 3)
    cv.p(11, 103, "ink", 0)
    cv.p(17, 103, "ink", 0)
    cv.phline(12, 16, 104, "ink", 0)
    # Steel stool legs & footrest ring (y=105..110)
    for ly in range(105, 111):
        cv.p(12, ly, "steel", 5 if ly < 109 else 2)
        cv.p(14, ly, "steel", 3)
        cv.p(16, ly, "steel", 4 if ly < 109 else 1)
    cv.phline(12, 16, 107, "steel", 4)

    return cv.img


# ==============================================================================
# BUILDING 2: K-CHICKEN (64 x 112) — Lively Korean 치킨호프 ('치킨호프')
# ==============================================================================
def draw_cha_roof(cv: PixelCanvas, w: int) -> None:
    """Weathered staggered dark-brown 'cha' tiled roof with ridge cap & finials (y=0..39)."""
    ink0 = cv.c("ink", 0)
    oni_w = 7

    # 1. Segmented horizontal ridge cap (y=2..6, x=6..57)
    for x in range(oni_w - 1, w - oni_w + 1):
        seg = (x - (oni_w - 1)) % 6
        is_joint = seg == 0
        cv.put(x, 2, ink0)
        cv.p(x, 3, "cha", 3 if is_joint else (7 if seg == 1 else 6))
        cv.p(x, 4, "cha", 2 if is_joint else 5)
        cv.p(x, 5, "cha", 1 if is_joint else 3)
        cv.put(x, 6, ink0 if is_joint else cv.c("cha", 0))

    # 2. Staggered convex tile courses (y=7..36, 6 courses x 5px)
    for course in range(6):
        y0 = 7 + course * 5
        stagger = (course % 2) * 2
        course_bias = 0 if course < 5 else -1
        for dy in range(5):
            y = y0 + dy
            for x in range(w):
                if x == 0 or x == w - 1:
                    cv.put(x, y, ink0 if dy == 4 else cv.c("cha", 1 if x == 0 else 0))
                    continue
                tx = (x + stagger) % 4
                tc = (x + stagger) // 4
                hv = h2(tc, course, 37)
                shift = (1 if hv > 212 else (-1 if hv < 46 else 0)) + course_bias
                use_warm = 68 <= hv <= 104
                use_weathered = 140 <= hv <= 156

                def tone(lv_raw: int) -> tuple[int, int, int, int]:
                    lv = clamp(lv_raw + shift, 1, 6)
                    if use_warm and lv in (3, 4, 5):
                        return cv.c("rooftile", lv - 1)
                    if use_weathered and lv in (2, 3):
                        return cv.c("soil", lv)
                    return cv.c("cha", lv)

                if tx == 0:
                    if dy in (3, 4):
                        col = ink0 if dy == 4 else cv.c("cha", 0)
                    else:
                        col = cv.c("cha", 1 if dy in (1, 2) else 0)
                elif dy == 0:
                    col = tone(3) if tx == 1 else (tone(2) if tx == 2 else cv.c("cha", 1))
                elif dy == 1:
                    col = (cv.c("cha", 6) if hv > 205 else tone(5)) if tx == 1 else (tone(4) if tx == 2 else tone(3))
                elif dy == 2:
                    col = tone(5) if tx == 1 else (tone(4) if tx == 2 else tone(2))
                elif dy == 3:
                    col = tone(4) if tx == 1 else (tone(3) if tx == 2 else cv.c("cha", 1))
                else:
                    col = tone(3) if tx == 1 else (cv.c("cha", 1) if tx == 2 else cv.c("cha", 0))
                cv.put(x, y, col)

    # 3. Ornamental eave row (y=37..39)
    for x in range(w):
        if x == 0 or x == w - 1:
            cv.p(x, 37, "cha", 0)
            cv.put(x, 38, ink0)
            cv.put(x, 39, ink0)
            continue
        tx = x % 4
        hv = h2(x // 4, 91, 37)
        if tx == 0:
            cv.p(x, 37, "cha", 0)
            cv.p(x, 38, "cha", 0)
            cv.put(x, 39, ink0)
        elif tx == 1:
            cv.p(x, 37, "cha", 5)
            cv.p(x, 38, "cha", 6 if hv > 110 else 5)
            cv.p(x, 39, "cha", 1)
        elif tx == 2:
            cv.p(x, 37, "cha", 4)
            cv.p(x, 38, "cha", 3)
            cv.put(x, 39, ink0)
        else:
            cv.p(x, 37, "cha", 2)
            cv.p(x, 38, "cha", 1)
            cv.put(x, 39, ink0)

    # Subtle weathered moss flecks near lower eaves
    for mx, my, mi in ((13, 30, 3), (14, 31, 4), (15, 31, 2), (35, 34, 3), (36, 35, 4)):
        cv.p(mx, my, "moss", mi)

    # 4. Left & Right sculpted ridge-end caps + cast shadows
    cv.shadow_rect(oni_w, 4, oni_w + 1, 9, steps=2)
    cv.shadow_rect(1, 8, oni_w, 8, steps=2)
    cv.shadow_rect(w - oni_w, 8, w - 2, 8, steps=2)
    for rx0 in (0, w - oni_w):
        for dy in range(8):
            for dx in range(oni_w):
                x, y = rx0 + dx, dy
                if dy == 0 and (dx < 2 or dx >= oni_w - 2):
                    continue
                if dy == 1 and (dx == 0 or dx == oni_w - 1):
                    continue
                is_edge = (
                    dy == 0
                    or (dy == 1 and dx in (1, oni_w - 2))
                    or (dy == 2 and dx in (0, oni_w - 1))
                    or dx in (0, oni_w - 1)
                    or dy == 7
                )
                if is_edge:
                    cv.put(x, y, ink0)
                elif dx <= 2 and dy <= 3:
                    cv.p(x, y, "cha", 6 if (dx == 1 and dy <= 2) else 5)
                elif dx == 3 and dy == 4:
                    cv.p(x, y, "rooftile", 4)
                elif dy == 6 or dx == oni_w - 2:
                    cv.p(x, y, "cha", 2)
                else:
                    cv.p(x, y, "cha", 4)


def build_k_chicken(ramps: dict, glyphs: dict) -> Image.Image:
    W, H = 64, 112
    cv = PixelCanvas(W, H, ramps)
    ink0 = cv.c("ink", 0)
    ink1 = cv.c("ink", 1)

    # ------------------------------------------------------------------
    # 1. ROOF (y=0..39): Weathered 'cha' tiled roof + Brick/Metal Exhaust Vent
    # ------------------------------------------------------------------
    draw_cha_roof(cv, W)

    # Brick & Galvanized Metal Fryer Exhaust Vent on right slope (x=42..53, y=0..18)
    cv.shadow_rect(54, 4, 56, 20, steps=3)
    cv.shadow_rect(44, 19, 56, 20, steps=3)

    # Galvanized steel exhaust hood crown (x=42..53, y=0..6)
    cv.phline(44, 51, 0, "ink", 0)
    cv.phline(43, 52, 1, "ink", 0)
    cv.phline(44, 48, 1, "white", 6)
    cv.phline(49, 51, 1, "steel", 4)
    cv.phline(42, 53, 2, "ink", 0)
    cv.phline(43, 47, 2, "steel", 5)
    cv.phline(48, 52, 2, "steel", 3)
    # Dark grease-louvre vent slot (y=3..5)
    cv.box(43, 3, 52, 6, ink0, cv.c("steel", 2))
    for lx in (45, 47, 49, 51):
        cv.p(lx, 4, "ink", 0)
        cv.p(lx - 1, 4, "steel", 5 if lx <= 47 else 3)
        cv.p(lx, 5, "kuro", 0)

    # Brick chimney collar base (x=43..52, y=7..18)
    cv.box(43, 7, 52, 18, ink0, cv.c("brick", 3))
    cv.phline(44, 51, 7, "concrete", 5)
    for row_i, y_top in enumerate((8, 11, 14)):
        jx = 47 if row_i % 2 == 0 else 49
        for dy in range(2):
            y = y_top + dy
            for x in range(44, 52):
                if x == jx:
                    cv.p(x, y, "brick", 0)
                elif x < jx:
                    cv.p(x, y, "brick", 5 if (dy == 0 and x <= 45) else 4)
                else:
                    cv.p(x, y, "brick", 3 if dy == 0 else 2)
        if y_top + 2 < 18:
            cv.phline(44, 51, y_top + 2, "brick", 0)

    # ------------------------------------------------------------------
    # 2. 2F FACADE & KOREAN SIGNBOARD (y=40..71)
    #    Running-bond red-brown brick + glowing amber pub windows w/ hanging
    #    warm bulbs + bold dark-wood/crimson neon signboard '치킨호프'
    # ------------------------------------------------------------------
    for y in range(40, H):
        by = (y - 40) % 3
        bc = (y - 40) // 3
        stagger = (bc % 2) * 3
        for x in range(W):
            if x == 0 or x == W - 1:
                cv.put(x, y, ink0 if by == 2 else cv.c("brick", 0))
                continue
            bx = (x + stagger) % 6
            bi = (x + stagger) // 6
            hv = h2(bi, bc, 83)
            if by == 2:
                cv.put(x, y, cv.c("brick", 0) if hv > 55 else ink1)
            elif bx == 0:
                cv.p(x, y, "brick", 1 if hv > 85 else 0)
            else:
                if hv < 45:
                    rmp, idx = "brick", 2
                elif hv < 135:
                    rmp, idx = "brick", 3
                elif hv < 195:
                    rmp, idx = "brick", 4
                elif hv < 230:
                    rmp, idx = "aka", 3
                else:
                    rmp, idx = "brick", 5
                if by == 0 and bx in (1, 2, 3) and idx < 5:
                    cv.p(x, y, rmp, idx + 1 if hv > 160 else idx)
                elif by == 1 and bx == 5:
                    cv.p(x, y, rmp, max(1, idx - 1))
                else:
                    cv.p(x, y, rmp, idx)

    # Crisp 3px roof-eave cast shadow across top of 2F (y=40..42)
    cv.phline(0, W - 1, 40, "ink", 0)
    cv.shadow_rect(1, 41, W - 2, 41, steps=2)
    cv.shadow_rect(1, 42, W - 2, 42, steps=1)

    # --- 2F Twin Wide Pub Windows with Hanging Warm Edison Bulbs (y=43..55) ---
    def draw_pub_2f_window(wx0: int, wx1: int) -> None:
        cv.shadow_rect(wx1 + 1, 45, wx1 + 2, 56, steps=2)
        cv.shadow_rect(wx0 + 1, 56, wx1 + 2, 56, steps=2)
        # Brick lintel header at y=43
        for x in range(wx0, wx1 + 1):
            cv.p(x, 43, "brick", 5 if x % 2 == 0 else 2)
        # Heavy dark-timber pub window frame (y=44..55)
        cv.box(wx0, 44, wx1, 55, ink0, cv.c("darkwood", 3))
        cv.phline(wx0 + 1, wx1 - 1, 44, "darkwood", 4)
        mid = (wx0 + wx1) // 2

        # Glowing amber pub interior panes
        for px0, px1 in ((wx0 + 2, mid - 1), (mid + 1, wx1 - 2)):
            for y in range(46, 54):
                for x in range(px0, px1 + 1):
                    dy = y - 46
                    if dy == 0:
                        cv.p(x, y, "darkwood", 2)
                    elif dy <= 2:
                        cv.p(x, y, "orange", 3)
                    elif dy <= 4:
                        cv.p(x, y, "orange", 4)
                    elif dy == 5:
                        cv.p(x, y, "yellow", 4)
                    else:
                        # Cozy pub booth backs & clinking golden beer glass on 2F table
                        rx = x - px0
                        if rx in (0, 1, 7, 8):
                            cv.p(x, y, "darkwood", 2 if dy == 6 else 1)
                        elif rx in (3, 4) and dy == 6:
                            cv.p(x, y, "white" if rx == 3 else "yellow", 6 if rx == 3 else 5)
                        elif dy == 7:
                            cv.p(x, y, "wood", 3)
                        else:
                            cv.p(x, y, "orange", 3)

            # Two distinct hanging warm Edison string bulbs per pane!
            for bx, by in ((px0 + 2, 48), (px0 + 6, 47)):
                if bx <= px1:
                    cv.pvline(bx, 46, by - 1, "ink", 0)  # dark cord
                    cv.p(bx, by, "white", 6)             # bright bulb filament
                    cv.p(bx, by + 1, "yellow", 5)        # warm golden glow
                    if bx - 1 >= px0:
                        cv.p(bx - 1, by, "yellow", 4)
                    if bx + 1 <= px1:
                        cv.p(bx + 1, by, "orange", 5)

        # Center timber mullion & stone sill
        cv.pvline(mid, 45, 54, "darkwood", 2)
        cv.phline(wx0 - 1, wx1 + 1, 55, "stone", 4)
        cv.p(wx0 - 1, 55, "ink", 0)
        cv.p(wx1 + 1, 55, "ink", 0)

    draw_pub_2f_window(4, 26)
    draw_pub_2f_window(37, 59)

    # Warm Brass & Amber Wall Sconce Between 2F Windows (x=30..33, y=45..52)
    cv.shadow_rect(33, 47, 35, 53, steps=2)
    cv.phline(30, 33, 45, "ink", 0)
    cv.phline(31, 32, 46, "yellow", 3)
    cv.box(30, 47, 33, 51, ink0, cv.c("yellow", 5))
    cv.p(31, 48, "white", 6)
    cv.p(32, 49, "orange", 4)
    cv.phline(31, 32, 52, "darkwood", 1)

    # --- Bold Dark-Wood & Crimson Neon Signboard '치킨호프' (x=3..60, y=57..71) ---
    cv.shadow_rect(61, 59, 62, 72, steps=2)
    cv.box(3, 57, 60, 71, ink0)
    # Heavy dark-wood outer timber frame with brass corner rivets (x=4..59, y=58..70)
    cv.phline(4, 59, 58, "wood", 4)
    cv.phline(4, 59, 70, "darkwood", 1)
    cv.pvline(4, 58, 70, "wood", 3)
    cv.pvline(59, 58, 70, "darkwood", 1)
    for rx, ry in ((4, 58), (59, 58), (4, 70), (59, 70)):
        cv.p(rx, ry, "yellow", 4)

    # Glowing crimson neon inner border & deep burgundy-maple backing (x=5..58, y=59..69)
    for y in range(59, 70):
        for x in range(5, 59):
            is_neon_tube = y in (59, 69) or x in (5, 58)
            if is_neon_tube:
                if (x in (5, 58) and y in (59, 69)):
                    cv.p(x, y, "pink", 4)
                elif y == 59 or x == 5:
                    cv.p(x, y, "red", 5 if (x + y) % 4 != 0 else 4)
                else:
                    cv.p(x, y, "red", 4)
            else:
                if y <= 62:
                    cv.p(x, y, "maple", 2)
                elif y <= 66:
                    cv.p(x, y, "maple", 1)
                else:
                    cv.p(x, y, "darkwood", 1)

    # Tiny neon drumstick/sparkle accents flanking the 4 Hangul chars (x=7..9 and x=54..56)
    cv.p(7, 63, "orange", 5)
    cv.p(8, 63, "yellow", 5)
    cv.p(8, 64, "orange", 4)
    cv.p(7, 65, "white", 6)

    cv.p(55, 62, "white", 6)
    cv.p(55, 63, "yellow", 5)
    cv.p(56, 63, "yellow", 4)
    cv.p(55, 64, "orange", 4)

    # 4 Compactly Centered Hangul Glyphs: '치킨호프' (x=11, 22, 33, 44; y=60..68)
    for gx, ch in ((11, "치"), (22, "킨"), (33, "호"), (44, "프")):
        cv.draw_glyph(
            glyphs, ch, gx, 60,
            fg_top=cv.c("white", 6),
            fg_bot=cv.c("yellow", 5),
            shadow=cv.c("ink", 0),
        )

    # ------------------------------------------------------------------
    # 3. 1F LIVING STOREFRONT (y=72..111)
    #    Dark timber pub entrance + warm glowing windows showing golden beer
    #    mugs & tables inside + striped burgundy/cream awning + glowing
    #    hanging beer-mug/drumstick sign icon + outdoor A-frame + evergreen
    # ------------------------------------------------------------------
    # Dark timber pub facade carpentry base (x=1..48, y=79..109) while right pier (x=49..63) keeps brick + wainscoting
    cv.prect(1, 79, 48, 108, "darkwood", 2)
    for x in (0, 31, 48, 63):
        cv.pvline(x, 79, 108, "ink", 0)
    cv.pvline(1, 79, 108, "darkwood", 4)
    cv.pvline(2, 79, 108, "darkwood", 3)
    cv.pvline(30, 79, 108, "darkwood", 3)
    cv.pvline(32, 79, 108, "darkwood", 4)
    cv.pvline(47, 79, 108, "darkwood", 1)

    # Lower carved dark-timber dado wainscoting under pub window (x=3..29, y=101..108)
    cv.box(3, 101, 29, 108, ink0, cv.c("darkwood", 2))
    for px0, px1 in ((5, 11), (13, 19), (21, 27)):
        cv.box(px0, 102, px1, 107, cv.c("darkwood", 1), cv.c("wood", 2))
        cv.phline(px0 + 1, px1 - 1, 103, "wood", 3)

    # --- Striped Burgundy/Cream Pub Awning (x=0..48, y=72..79) ---
    cv.phline(0, 48, 72, "ink", 0)
    for x in range(0, 49):
        if x in (0, 48):
            cv.pvline(x, 72, 78, "ink", 0)
            continue
        stripe = (x // 4) % 2  # 0 = deep burgundy/maple, 1 = warm cream
        sx = x % 4
        notch = sx in (0, 3)
        for y in range(73, 80):
            if y == 79 and notch:
                cv.shadow_pixel(x, y, steps=2)
                continue
            if y == 79 or (y == 78 and notch):
                cv.p(x, y, "ink", 0)
                continue
            if stripe == 0:
                if y == 73:
                    cv.p(x, y, "red", 3 if sx in (1, 2) else 2)
                elif y <= 75:
                    cv.p(x, y, "maple", 4 if sx in (1, 2) else 3)
                else:
                    cv.p(x, y, "maple", 2 if sx in (1, 2) else 1)
            else:
                if y == 73:
                    cv.p(x, y, "white", 6)
                elif y <= 75:
                    cv.p(x, y, "cream", 6 if sx in (1, 2) else 5)
                else:
                    cv.p(x, y, "cream", 4 if sx in (1, 2) else 3)

    # Awning cast shadow across pub storefront lintel (x=1..48, y=80..81)
    cv.shadow_rect(1, 80, 48, 81, steps=2)

    # --- Left Wide Glowing Pub Window Showing Golden Beer Mugs & Tables (x=3..29, y=81..100) ---
    cv.box(3, 81, 29, 100, ink0, cv.c("darkwood", 3))
    cv.phline(4, 28, 82, "wood", 4)
    cv.pvline(16, 82, 99, "darkwood", 2)  # center window mullion

    # Smooth warm amber interior backdrop in both panes (x=4..15 and x=17..28, y=83..98)
    for px0, px1 in ((4, 15), (17, 28)):
        for y in range(83, 99):
            for x in range(px0, px1 + 1):
                if y <= 85:
                    cv.p(x, y, "darkwood", 2 if y == 83 else 3)
                elif y <= 88:
                    cv.p(x, y, "orange", 3)
                elif y <= 91:
                    cv.p(x, y, "orange", 4 if 6 <= (x - px0) <= 9 else 3)
                elif y <= 94:
                    cv.p(x, y, "floorwood", 3 if (x - px0) % 4 != 0 else 2)
                else:
                    cv.p(x, y, "darkwood", 2)

        # Cozy Brass Pendant Lamp hanging in each pane
        lx = (px0 + px1) // 2
        cv.pvline(lx, 83, 85, "ink", 0)
        cv.phline(lx - 2, lx + 2, 86, "red", 3)
        cv.phline(lx - 1, lx + 1, 87, "white", 6)
        cv.phline(lx - 2, lx + 2, 88, "yellow", 5)

        # Wooden Pub Table at y=95..98
        cv.phline(px0 + 1, px1 - 1, 95, "wood", 5)
        cv.phline(px0 + 1, px1 - 1, 96, "wood", 3)
        cv.pvline(lx, 97, 98, "darkwood", 1)

    # Left Table (x=5..14): Two Frothy Golden Draft Beer Mugs ('생맥주') + Fried Chicken Basket!
    # Mug 1 (x=5..7, y=91..94)
    cv.phline(5, 7, 91, "white", 6)       # fluffy white beer foam head
    cv.prect(5, 92, 7, 94, "yellow", 5)   # golden lager body
    cv.pvline(7, 92, 94, "orange", 4)     # amber shading
    cv.pvline(8, 92, 93, "cream", 5)      # mug glass handle
    # Crispy Fried Chicken Mound on Plate (x=9..13, y=92..94)
    cv.phline(9, 13, 94, "white", 5)      # ceramic plate
    cv.phline(10, 12, 92, "orange", 5)    # crispy golden drumsticks
    cv.phline(9, 13, 93, "orange", 4)
    cv.p(11, 93, "red", 4)                # yangnyeom glaze highlight

    # Right Table (x=18..27): Clinking Beer Mugs + Green Soju Bottle!
    # Mug 2 (x=19..21, y=91..94)
    cv.phline(19, 21, 91, "white", 6)
    cv.prect(19, 92, 21, 94, "yellow", 5)
    cv.pvline(18, 92, 93, "cream", 5)     # left handle
    # Mug 3 (x=23..25, y=91..94)
    cv.phline(23, 25, 91, "white", 6)
    cv.prect(23, 92, 25, 94, "yellow", 5)
    cv.pvline(25, 92, 94, "orange", 4)
    # Green bottle on right (x=27, y=91..94)
    cv.p(27, 91, "green", 5)
    cv.pvline(27, 92, 94, "green", 3)

    # Subtle diagonal window glass reflection highlights + wooden sill (y=100)
    for gx, gy in ((5, 85), (6, 84), (18, 85), (19, 84)):
        cv.p(gx, gy, "yellow", 5)
    cv.phline(2, 30, 100, "wood", 5)
    cv.p(2, 100, "ink", 0)
    cv.p(30, 100, "ink", 0)

    # --- Center-Right Dark Timber Pub Entrance Door (x=33..46, y=81..108) ---
    cv.box(33, 81, 46, 108, ink0, cv.c("darkwood", 3))
    cv.box(34, 82, 45, 107, cv.c("wood", 3), cv.c("darkwood", 2))
    # Arched-corner glowing amber pub door window (x=36..43, y=84..94)
    cv.box(36, 84, 43, 94, ink0, cv.c("yellow", 4))
    cv.p(36, 84, "darkwood", 2)
    cv.p(43, 84, "darkwood", 2)
    for y in range(85, 94):
        for x in range(37, 43):
            if y <= 87:
                cv.p(x, y, "yellow", 5 if (x + y) % 2 == 0 else 4)
            elif y <= 91:
                cv.p(x, y, "orange", 4)
            else:
                cv.p(x, y, "orange", 3)
    # Wooden cross-mullion in door glass
    cv.pvline(39, 85, 93, "darkwood", 3)
    cv.phline(37, 42, 89, "darkwood", 3)
    # Brass push plate & vertical handle (x=43..44, y=95..99)
    cv.pvline(44, 95, 99, "yellow", 5)
    cv.p(43, 97, "orange", 3)
    # Recessed lower timber door panels + brass kickplate (y=96..107)
    cv.box(36, 96, 42, 104, cv.c("darkwood", 1), cv.c("wood", 2))
    cv.phline(37, 41, 97, "wood", 3)
    cv.phline(35, 44, 106, "straw", 4)
    cv.phline(35, 44, 107, "straw", 2)

    # --- Glowing Hanging Beer-Mug / Drumstick Projecting Sign Icon (x=50..62, y=73..88) ---
    # Warm glow cast onto surrounding brick pier
    for gx, gy in ((49, 78), (49, 81), (53, 89), (56, 89)):
        cv.p(gx, gy, "brick", 5)
    cv.shadow_rect(52, 88, 62, 89, steps=2)
    # Wrought-iron top & bottom wall brackets anchored to right edge (x=60..62)
    cv.phline(51, 62, 73, "kuro", 1)
    cv.phline(52, 61, 74, "steel", 3)
    cv.phline(60, 62, 85, "kuro", 1)
    # Backlit dark-crimson & iron sign box (x=49..60, y=75..87)
    cv.box(49, 75, 60, 87, ink0, cv.c("maple", 1))
    cv.box(50, 76, 59, 86, cv.c("red", 4), cv.c("maple", 1))
    # Inside icon: Crisp Frothy Golden Beer Mug (x=51..55, y=77..84) + Separated Crispy Drumstick (x=57..58)
    cv.phline(51, 54, 77, "white", 6)       # overflowing white foam crown
    cv.p(51, 78, "white", 6)                # foam drip on left rim
    cv.phline(52, 54, 78, "cream", 6)
    cv.prect(51, 79, 54, 84, "yellow", 5)   # bright golden lager body
    cv.pvline(52, 80, 83, "white", 6)       # specular highlight
    cv.pvline(54, 79, 84, "orange", 4)      # amber right-side shade
    cv.p(55, 80, "cream", 6)                # glass mug handle top
    cv.pvline(55, 81, 82, "cream", 5)       # glass mug handle outer
    cv.p(55, 83, "cream", 4)                # glass mug handle bottom
    cv.phline(51, 54, 85, "cream", 4)       # heavy mug base
    # Separated crispy golden drumstick on right (x=57..58, y=78..84, with x=56 dark gap!)
    cv.p(58, 78, "white", 6)                # white bone tip
    cv.p(57, 79, "cream", 6)                # bone shaft
    cv.prect(57, 80, 58, 83, "orange", 5)   # crispy fried drumstick meat
    cv.p(58, 83, "orange", 3)
    cv.p(57, 83, "yellow", 5)

    # --- Sidewalk Curb Base (y=109..111, full width x=0..63) ---
    cv.phline(0, W - 1, 109, "pavement", 5)
    cv.phline(0, W - 1, 110, "pavement", 3)
    cv.phline(0, W - 1, 111, "ink", 0)
    for jx in (12, 26, 49):
        cv.p(jx, 109, "pavement", 3)
        cv.p(jx, 110, "pavement", 2)
    # Stone welcome step in front of pub entrance (x=32..47, y=108..110)
    cv.phline(32, 47, 108, "stone", 6)
    cv.phline(32, 47, 109, "stone", 4)
    cv.phline(32, 47, 110, "stone", 2)

    # --- Stainless Steel Draft Beer Keg ('생맥주 케그') on Left Sidewalk Corner (x=3..8, y=101..109) ---
    cv.shadow_rect(8, 103, 10, 109, steps=2)
    cv.box(3, 101, 8, 109, ink0, cv.c("steel", 4))
    cv.phline(4, 7, 101, "steel", 6)
    cv.pvline(4, 102, 108, "white", 6)
    cv.pvline(7, 102, 108, "steel", 2)
    cv.phline(4, 7, 104, "steel", 2)  # keg chime ring
    cv.phline(4, 7, 106, "blue", 3)   # draft brand band

    # --- Outdoor Wooden A-Frame Menu Board ('치킨/생맥 입간판', x=48..55, y=95..109) ---
    cv.shadow_rect(54, 98, 56, 110, steps=2)
    cv.phline(49, 54, 95, "ink", 0)
    cv.box(48, 96, 54, 107, ink0, cv.c("wood", 4))
    cv.pvline(55, 98, 109, "darkwood", 1)   # rear A-frame leg
    cv.pvline(48, 107, 109, "wood", 4)      # front left leg
    cv.pvline(54, 107, 109, "wood", 3)      # front right leg
    # Dark slate chalkboard face (x=49..53, y=97..106)
    cv.prect(49, 97, 53, 106, "asphalt", 0)
    # Tiny chalk menu art: red headline + golden beer mug & chicken mark!
    cv.phline(50, 52, 98, "red", 4)
    cv.prect(50, 100, 51, 102, "yellow", 5)
    cv.phline(50, 51, 100, "white", 6)
    cv.p(52, 101, "orange", 5)
    cv.phline(50, 52, 104, "cream", 5)
    cv.phline(50, 51, 105, "yellow", 4)

    # --- Small Potted Evergreen Shrub on Right Corner (x=56..62, y=91..109) ---
    # Sculpted conical evergreen foliage (y=91..103)
    evergreen_rows = [
        (91, 59, 59),
        (92, 58, 60),
        (93, 58, 60),
        (94, 57, 61),
        (95, 57, 61),
        (96, 57, 61),
        (97, 56, 62),
        (98, 56, 62),
        (99, 56, 62),
        (100, 56, 62),
        (101, 56, 62),
        (102, 57, 61),
        (103, 57, 61),
    ]
    for ey, ex0, ex1 in evergreen_rows:
        for ex in range(ex0, ex1 + 1):
            if ex in (ex0, ex1) or ey == 91:
                cv.p(ex, ey, "ink", 0 if ex == ex1 else 1)
            else:
                hv = h2(ex, ey, 61)
                if ex <= 58:
                    cv.p(ex, ey, "foliage", 5 if (ey % 3 == 0 or hv > 150) else 4)
                elif ex == 59:
                    cv.p(ex, ey, "foliage", 4 if hv > 100 else 3)
                else:
                    cv.p(ex, ey, "foliage", 2 if hv > 90 else 1)
    # Terracotta / wooden barrel planter pot (x=57..61, y=104..109)
    cv.box(56, 104, 62, 105, ink0, cv.c("brick", 5))
    cv.box(57, 105, 61, 109, ink0, cv.c("brick", 3))
    cv.pvline(58, 105, 108, "brick", 4)
    cv.pvline(60, 105, 108, "brick", 2)

    return cv.img


# ==============================================================================
# VERIFICATION & 3x CHECKERBOARD PREVIEW SHEET
# ==============================================================================
def verify_sprite(name: str, img: Image.Image, expected_size: tuple[int, int], allowed_rgb: set) -> dict:
    assert img.size == expected_size, f"{name}: size {img.size} != {expected_size}"
    assert img.mode == "RGBA", f"{name}: mode {img.mode} != RGBA"

    px = img.load()
    w, h = img.size
    unique_rgb = set()
    off_palette = []
    pure_black = 0
    bad_alpha = 0
    wall_gaps = 0

    # Find first full-width opaque row (below rooftop silhouette)
    first_full_row = None
    for y in range(h):
        if all(px[x, y][3] == 255 for x in range(w)):
            first_full_row = y
            break

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a not in (0, 255):
                bad_alpha += 1
            if a == 255:
                unique_rgb.add((r, g, b))
                if (r, g, b) == (0, 0, 0):
                    pure_black += 1
                if (r, g, b) not in allowed_rgb:
                    off_palette.append((x, y, f"#{r:02x}{g:02x}{b:02x}"))
            elif first_full_row is not None and y >= first_full_row:
                wall_gaps += 1

    status = (
        len(off_palette) == 0
        and pure_black == 0
        and bad_alpha == 0
        and wall_gaps == 0
        and 60 <= len(unique_rgb) <= 95
    )
    return {
        "name": name,
        "size": f"{w}x{h}",
        "colors": len(unique_rgb),
        "off_palette": len(off_palette),
        "pure_black": pure_black,
        "bad_alpha": bad_alpha,
        "first_full_row": first_full_row,
        "wall_gaps": wall_gaps,
        "pass": status,
    }


def make_preview_sheet(bunsik: Image.Image, chicken: Image.Image) -> Image.Image:
    scale = 3
    pad = 24
    header_h = 34
    # Show individual 3x sprites + seamless wall-to-wall street pair 3x!
    b_s = bunsik.resize((bunsik.width * scale, bunsik.height * scale), Image.Resampling.NEAREST)
    c_s = chicken.resize((chicken.width * scale, chicken.height * scale), Image.Resampling.NEAREST)

    pair_w = (bunsik.width + chicken.width) * scale
    total_w = pad + b_s.width + pad + c_s.width + pad + pair_w + pad
    total_h = header_h + b_s.height + pad

    bg1 = (0x23, 0x26, 0x2E, 255)
    bg2 = (0x2B, 0x2F, 0x3A, 255)
    sheet = Image.new("RGBA", (total_w, total_h), bg1)
    spx = sheet.load()
    cell = 6
    for y in range(header_h, total_h):
        for x in range(total_w):
            if ((x // cell) + (y // cell)) % 2 == 1:
                spx[x, y] = bg2

    x_b = pad
    x_c = x_b + b_s.width + pad
    x_p = x_c + c_s.width + pad

    sheet.alpha_composite(b_s, (x_b, header_h))
    sheet.alpha_composite(c_s, (x_c, header_h))
    sheet.alpha_composite(b_s, (x_p, header_h))
    sheet.alpha_composite(c_s, (x_p + b_s.width, header_h))

    draw = ImageDraw.Draw(sheet)
    draw.text((x_b, 10), "k-bunsik (48x112, 3x)", fill=(235, 238, 245, 255))
    draw.text((x_c, 10), "k-chicken (64x112, 3x)", fill=(235, 238, 245, 255))
    draw.text((x_p, 10), "Wall-to-Wall Seam Check (3x)", fill=(168, 224, 176, 255))
    return sheet


def main() -> None:
    SHOPS_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)

    ramps, allowed_rgb, glyphs = load_resources()

    bunsik_img = build_k_bunsik(ramps, glyphs)
    chicken_img = build_k_chicken(ramps, glyphs)

    bunsik_path = SHOPS_DIR / "k-bunsik.png"
    chicken_path = SHOPS_DIR / "k-chicken.png"
    bunsik_img.save(bunsik_path)
    chicken_img.save(chicken_path)

    preview = make_preview_sheet(bunsik_img, chicken_img)
    preview.save(PREVIEW_PATH)

    r1 = verify_sprite("k-bunsik.png", bunsik_img, (48, 112), allowed_rgb)
    r2 = verify_sprite("k-chicken.png", chicken_img, (64, 112), allowed_rgb)
    for r in (r1, r2):
        print(json.dumps(r, ensure_ascii=False))
        if not r["pass"]:
            raise SystemExit(f"Verification failed: {r}")


if __name__ == "__main__":
    main()
