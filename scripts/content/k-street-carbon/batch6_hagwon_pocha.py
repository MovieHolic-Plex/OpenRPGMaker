#!/usr/bin/env python3
"""
K-Street Fable-Grade Korean Shops — T1 Batch 6/6
Hand-crafts two 100% original modern Korean street shopfront buildings from scratch:
  1. k-hagwon.png (64x112 RGBA, 4x7 tiles) — Modern Korean neighborhood 학원 (cram school / academy)
  2. k-pocha.png  (48x112 RGBA, 3x7 tiles) — Retro Euljiro late-night 포차 (street tavern / pojangmacha)

Strictly locked to tiledata/jp-city/fable-city/palette.json (0 off-palette, 0 #000000, binary alpha {0, 255})
and 9x9 Hangul signboard bitmaps from tiledata/k-street-carbon/hangul9.json.
"""

from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
PALETTE_PATH = ROOT / "tiledata/jp-city/fable-city/palette.json"
GLYPHS_PATH = ROOT / "tiledata/k-street-carbon/hangul9.json"
SHOPS_DIR = ROOT / "tiledata/k-street-carbon/shops"
PREVIEW_PATH = ROOT / "tiledata/k-street-carbon/preview_batch6.png"


def hex_to_rgba(h: str) -> tuple[int, int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


class Palette:
    def __init__(self, path: Path) -> None:
        data = json.loads(path.read_text(encoding="utf-8"))
        self.ramps: dict[str, list[tuple[int, int, int, int]]] = {}
        self.allowed_rgb: set[tuple[int, int, int]] = set()
        for name, hex_list in data["ramps"].items():
            cols = [hex_to_rgba(h) for h in hex_list]
            self.ramps[name] = cols
            for c in cols:
                self.allowed_rgb.add(c[:3])

    def c(self, ramp: str, idx: int) -> tuple[int, int, int, int]:
        r = self.ramps[ramp]
        idx = max(0, min(len(r) - 1, idx))
        return r[idx]


class PixelCanvas:
    def __init__(self, w: int, h: int, pal: Palette, glyphs: dict[str, list[str]]) -> None:
        self.w = w
        self.h = h
        self.pal = pal
        self.glyphs = glyphs
        self.img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.px = self.img.load()

    def set(self, x: int, y: int, col: tuple[int, int, int, int]) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = col

    def p(self, x: int, y: int, ramp: str, idx: int) -> None:
        self.set(x, y, self.pal.c(ramp, idx))

    def get(self, x: int, y: int) -> tuple[int, int, int, int]:
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[x, y]
        return (0, 0, 0, 0)

    def rect(self, x0: int, y0: int, x1: int, y1: int, ramp: str, idx: int) -> None:
        col = self.pal.c(ramp, idx)
        for y in range(max(0, y0), min(self.h, y1 + 1)):
            for x in range(max(0, x0), min(self.w, x1 + 1)):
                self.px[x, y] = col

    def hline(self, x0: int, x1: int, y: int, ramp: str, idx: int) -> None:
        self.rect(x0, y, x1, y, ramp, idx)

    def vline(self, x: int, y0: int, y1: int, ramp: str, idx: int) -> None:
        self.rect(x, y0, x, y1, ramp, idx)

    def box(
        self,
        x0: int,
        y0: int,
        x1: int,
        y1: int,
        border_ramp: str,
        border_idx: int,
        fill_ramp: str | None = None,
        fill_idx: int = 0,
    ) -> None:
        if fill_ramp is not None:
            self.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill_ramp, fill_idx)
        self.hline(x0, x1, y0, border_ramp, border_idx)
        self.hline(x0, x1, y1, border_ramp, border_idx)
        self.vline(x0, y0, y1, border_ramp, border_idx)
        self.vline(x1, y0, y1, border_ramp, border_idx)

    def draw_glyph(
        self,
        ch: str,
        x0: int,
        y0: int,
        fg: tuple[int, int, int, int],
        shadow: tuple[int, int, int, int] | None = None,
        top_hi: tuple[int, int, int, int] | None = None,
    ) -> None:
        rows = self.glyphs[ch]
        y_off = 9 - len(rows)
        if shadow is not None:
            for ry, row in enumerate(rows):
                for rx, bit in enumerate(row):
                    if bit == "#":
                        self.set(x0 + rx + 1, y0 + y_off + ry + 1, shadow)
                        self.set(x0 + rx, y0 + y_off + ry + 1, shadow)
        for ry, row in enumerate(rows):
            for rx, bit in enumerate(row):
                if bit == "#":
                    col = fg
                    if top_hi is not None and (ry == 0 or rows[ry - 1][rx] != "#"):
                        col = top_hi
                    self.set(x0 + rx, y0 + y_off + ry, col)


# ===========================================================================
# BUILDING 1: k-hagwon.png (64x112) — Modern Korean Neighborhood 학원 (Academy)
# ===========================================================================

def draw_hagwon_water_tank(cv: PixelCanvas, x0: int, y0: int) -> None:
    """
    Korean rooftop cream PE cylindrical water tank (x0..x0+13, y0..y0+25)
    on welded galvanized steel legs with manhole cap, ribs, level gauge & shadow.
    """
    # Diagonal cast shadow on green urethane roof (bottom-right)
    for sy in range(y0 + 17, y0 + 27):
        for sx in range(x0 + 2, x0 + 18):
            if 3 <= sx <= 60 and 11 <= sy <= 34:
                cv.p(sx, sy, "midori", 0 if (sx <= x0 + 14 and sy <= y0 + 25) else 1)

    # Welded steel support stand & 4 vertical legs (y0+19 .. y0+25)
    cv.hline(x0 + 1, x0 + 12, y0 + 19, "steel", 4)
    cv.hline(x0 + 1, x0 + 12, y0 + 20, "steel", 2)
    cv.hline(x0 + 2, x0 + 11, y0 + 23, "steel", 2)
    for lx in (x0 + 1, x0 + 4, x0 + 9, x0 + 12):
        for ly in range(y0 + 20, y0 + 26):
            cv.p(lx, ly, "steel", 4 if lx < x0 + 7 else 2)
            cv.p(lx + 1, ly, "steel", 1)
        # Concrete footpad on roof
        cv.hline(lx, lx + 1, y0 + 25, "concrete", 3)

    # Domed top & dark manhole hatch (y0 .. y0+4)
    cv.hline(x0 + 5, x0 + 8, y0, "cream", 3)
    cv.hline(x0 + 5, x0 + 8, y0 + 1, "steel", 2)
    cv.p(x0 + 6, y0, "cream", 5)
    cv.hline(x0 + 3, x0 + 10, y0 + 2, "cream", 6)
    cv.hline(x0 + 2, x0 + 11, y0 + 3, "cream", 5)
    cv.hline(x0 + 1, x0 + 12, y0 + 4, "cream", 4)
    cv.p(x0 + 2, y0 + 3, "cream", 6)
    cv.p(x0 + 3, y0 + 3, "white", 6)

    # Cylindrical body (x0+1 .. x0+12, y0+5 .. y0+18) with radial shading
    # Shade columns left-to-right: lit left, bright core, warm mid, core shadow, rim
    col_tones = [4, 5, 6, 6, 5, 5, 4, 3, 3, 2, 1, 2]
    for y in range(y0 + 5, y0 + 19):
        is_rib_hi = y in (y0 + 8, y0 + 13)
        is_rib_sh = y in (y0 + 9, y0 + 14)
        for dx, base_t in enumerate(col_tones):
            t = base_t
            if is_rib_hi:
                t = min(6, t + 1)
            elif is_rib_sh:
                t = max(1, t - 1)
            cv.p(x0 + 1 + dx, y, "cream", t)
        # Dark outer contour hints for crisp silhouette against sky/roof
        cv.p(x0, y, "cream", 1 if y > y0 + 7 else 2)
        cv.p(x0 + 13, y, "cream", 0)

    # Specular vertical gleam on sun-facing upper cylinder
    for y in range(y0 + 5, y0 + 12):
        cv.p(x0 + 3, y, "white", 6)

    # Rounded bottom tank skirt
    cv.hline(x0 + 1, x0 + 12, y0 + 18, "cream", 2)
    cv.hline(x0 + 2, x0 + 11, y0 + 19, "cream", 1)

    # Vertical water-level gauge tube + blue indicator & supply pipe going down
    for y in range(y0 + 6, y0 + 18):
        cv.p(x0 + 10, y, "glass", 4 if y < y0 + 10 else 2)
    cv.p(x0 + 10, y0 + 10, "red", 4)
    # Outlet pipe into roof slab
    for y in range(y0 + 19, y0 + 26):
        cv.p(x0 + 7, y, "steel", 5)
        cv.p(x0 + 8, y, "steel", 2)


def draw_hagwon_ac_unit(cv: PixelCanvas, x0: int, y0: int) -> None:
    """Large commercial rooftop AC condenser (15x14) with circular fan, louvers & refrigerant pipe."""
    w, h = 15, 14
    x1, y1 = x0 + w - 1, y0 + h - 1

    # Cast shadow onto green urethane roof
    for sy in range(y0 + 4, y1 + 3):
        for sx in range(x0 + 2, x1 + 4):
            if 3 <= sx <= 60 and 11 <= sy <= 34:
                cv.p(sx, sy, "midori", 0 if (sx <= x1 + 2 and sy <= y1 + 1) else 1)

    # Rubber mounting blocks
    cv.rect(x0 + 1, y1, x0 + 3, y1 + 1, "kuro", 1)
    cv.rect(x1 - 3, y1, x1 - 1, y1 + 1, "kuro", 1)

    # Top lid (3/4 top plane visible!)
    cv.hline(x0, x1, y0, "white", 6)
    cv.hline(x0, x1, y0 + 1, "coolwhite", 5)
    cv.hline(x0, x1, y0 + 2, "coolwhite", 4)
    cv.p(x0, y0, "coolwhite", 3)
    cv.p(x1, y0, "coolwhite", 3)

    # Front casing body
    cv.rect(x0, y0 + 3, x1, y1 - 1, "coolwhite", 3)
    cv.vline(x0, y0 + 2, y1 - 1, "coolwhite", 4)
    cv.vline(x1, y0 + 2, y1 - 1, "steel", 2)
    cv.hline(x0, x1, y1 - 1, "steel", 2)

    # Circular fan housing on left (9x9 at x0+1..x0+9, y0+4..y0+12)
    fan_pat = [
        "..#####..",
        ".##***##.",
        "##*+*+*##",
        "#**+++**#",
        "#*++@++*#",
        "#**+++**#",
        "##*+*+*##",
        ".##***##.",
        "..#####..",
    ]
    for ry, row in enumerate(fan_pat):
        for rx, ch in enumerate(row):
            px, py = x0 + 1 + rx, y0 + 3 + ry
            if ch == "#":
                cv.p(px, py, "steel", 2 if ry < 5 else 3)
            elif ch == "*":
                cv.p(px, py, "kuro", 1)
            elif ch == "+":
                cv.p(px, py, "steel", 3 if (rx + ry) % 2 == 0 else 1)
            elif ch == "@":
                cv.p(px, py, "steel", 5)

    # Right service panel + horizontal heat-sink louvers + blue brand badge
    cv.vline(x0 + 10, y0 + 3, y1 - 2, "steel", 2)
    cv.hline(x0 + 11, x1 - 1, y0 + 4, "blue", 3)
    for ly in range(y0 + 6, y1 - 2, 2):
        cv.hline(x0 + 11, x1 - 1, ly, "steel", 1)
        cv.hline(x0 + 11, x1 - 1, ly + 1, "coolwhite", 4)


def build_hagwon(pal: Palette, glyphs: dict[str, list[str]]) -> PixelCanvas:
    W, H = 64, 112
    cv = PixelCanvas(W, H, pal, glyphs)

    # -----------------------------------------------------------------------
    # 1. ROOF (y = 0..39): Flat concrete parapet + green urethane waterproofing
    #    Wall-to-wall opaque starting at y = 6; water tank rises to y = 2
    # -----------------------------------------------------------------------
    # North parapet wall (y = 6..10)
    cv.hline(0, W - 1, 6, "white", 6)
    cv.hline(0, W - 1, 7, "coolwhite", 4)
    cv.hline(0, W - 1, 8, "coolwhite", 2)
    cv.hline(0, W - 1, 9, "concrete", 1)
    cv.hline(0, W - 1, 10, "concrete", 0)

    # Side parapet copings (x = 0..2 and x = 61..63, y = 6..36)
    for y in range(7, 36):
        cv.p(0, y, "coolwhite", 3)
        cv.p(1, y, "white", 5)
        cv.p(2, y, "coolwhite", 2)
        cv.p(61, y, "coolwhite", 1)
        cv.p(62, y, "white", 5)
        cv.p(63, y, "coolwhite", 2)

    # Green urethane waterproofed rooftop deck (x = 3..60, y = 11..34)
    for y in range(11, 35):
        for x in range(3, 61):
            if y == 11:
                cv.p(x, y, "midori", 1)
            elif y <= 14:
                cv.p(x, y, "green", 2)
            elif y <= 25:
                cv.p(x, y, "midori", 3 if (x + y) % 19 != 0 else 4)
            elif y <= 31:
                cv.p(x, y, "green", 3)
            else:
                cv.p(x, y, "midori", 4)

    # Subtle sunlit urethane sheen bands & expansion joints
    cv.hline(6, 56, 32, "green", 4)
    cv.hline(12, 42, 33, "midori", 5)
    for sy in (18, 27):
        cv.hline(3, 60, sy, "midori", 2)
        cv.hline(4, 59, sy + 1, "green", 3)
    for sx in (21, 40):
        cv.vline(sx, 11, 34, "midori", 2)

    # Corner roof drains (우수관 배수구)
    for dx in (4, 57):
        cv.rect(dx, 32, dx + 2, 34, "steel", 1)
        cv.p(dx + 1, 33, "kuro", 0)
        cv.p(dx, 32, "steel", 3)

    # Center low rooftop vent curb + gooseneck breather pipe (x = 26..35, y = 15..25)
    cv.rect(28, 20, 37, 26, "midori", 0)
    cv.rect(26, 17, 34, 24, "concrete", 3)
    cv.hline(26, 34, 17, "concrete", 6)
    cv.hline(26, 34, 18, "concrete", 5)
    cv.vline(26, 17, 24, "concrete", 4)
    cv.vline(34, 18, 24, "concrete", 1)
    # Louvered vent hatch face
    cv.rect(28, 20, 32, 23, "steel", 2)
    cv.hline(28, 32, 21, "steel", 4)
    cv.hline(28, 32, 23, "steel", 1)
    # Small stainless breather pipe
    for y in range(11, 18):
        cv.p(30, y, "steel", 5)
        cv.p(31, y, "steel", 2)
    cv.hline(29, 32, 10, "steel", 4)
    cv.hline(29, 32, 11, "steel", 1)

    # Left: Cream Cylindrical PE Water Tank on steel legs (x = 5..18, y = 2..27)
    draw_hagwon_water_tank(cv, 5, 2)

    # Right: Commercial AC Condenser (x = 42..56, y = 14..27)
    draw_hagwon_ac_unit(cv, 42, 14)

    # Front parapet wall & architectural cornice (y = 35..39)
    cv.hline(0, W - 1, 35, "white", 6)
    cv.hline(0, W - 1, 36, "coolwhite", 5)
    cv.hline(0, W - 1, 37, "coolwhite", 3)
    cv.hline(0, W - 1, 38, "concrete", 2)
    cv.hline(0, W - 1, 39, "concrete", 0)

    # Insulated AC refrigerant pipe wrapping over right parapet (x = 58..59, y = 24..39)
    cv.hline(57, 59, 24, "cream", 5)
    for y in range(25, 40):
        cv.p(58, y, "cream", 5 if y not in (35, 39) else 6)
        cv.p(59, y, "cream", 2)

    # -----------------------------------------------------------------------
    # 2. 2F SLEEK ACADEMY FACADE, CLASSROOM WINDOWS & `학원` SIGN (y = 40..71)
    # -----------------------------------------------------------------------
    for y in range(40, 72):
        for x in range(0, W):
            if y == 40:
                cv.p(x, y, "coolwhite", 2)
            elif x == 0:
                cv.p(x, y, "coolwhite", 3)
            elif x == 1:
                cv.p(x, y, "white", 6)
            elif x == W - 2:
                cv.p(x, y, "coolwhite", 4)
            elif x == W - 1:
                cv.p(x, y, "coolwhite", 2)
            else:
                cv.p(x, y, "coolwhite", 5 if y < 50 else 4)

    # Crisp modular alucobond facade panel seams
    for vx in (16, 32, 48):
        cv.vline(vx, 40, 43, "coolwhite", 3)
    cv.hline(2, W - 3, 42, "white", 6)

    # Right-side vertical AC conduit pipe continuing down 2F wall (x = 59..60, y = 40..60)
    for y in range(40, 61):
        cv.p(59, y, "cream", 5)
        cv.p(60, y, "cream", 2)
    for by in (44, 52, 58):
        cv.hline(58, 61, by, "steel", 3)
        cv.p(59, by, "steel", 5)

    # --- WIDE BRIGHT 2F CLASSROOM WINDOWS (x = 4..56, y = 43..57) ---
    cv.rect(4, 43, 56, 57, "steel", 2)
    cv.box(5, 44, 55, 56, "steel", 5, "glass", 1)
    # Center structural mullion dividing Classroom A (left) and Classroom B (right)
    cv.vline(30, 43, 57, "steel", 5)
    cv.vline(31, 43, 57, "steel", 2)

    # === CLASSROOM A (Left Bay: x = 6..29, y = 45..55) ===
    # Warm bright classroom ceiling & wall with fluorescent light tubes
    cv.rect(6, 45, 29, 55, "cream", 4)
    cv.hline(6, 29, 45, "cream", 2)  # upper window frame shadow
    # Bright ceiling fluorescent fixtures
    cv.hline(9, 15, 45, "white", 6)
    cv.hline(20, 26, 45, "white", 6)
    cv.hline(8, 27, 46, "cream", 6)

    # Classic Korean Green Chalkboard (칠판, x = 8..22, y = 47..52)
    cv.box(7, 47, 23, 53, "cedar", 3, "green", 1)
    cv.rect(8, 48, 22, 52, "green", 2)
    cv.hline(8, 22, 48, "midori", 2)
    # Chalk tray with white & yellow chalk bits
    cv.hline(7, 23, 53, "cedar", 4)
    cv.p(11, 53, "white", 6)
    cv.p(16, 53, "yellow", 5)
    # Tiny crisp chalk math diagram & lines on green board!
    cv.hline(9, 13, 49, "white", 6)
    cv.hline(9, 12, 51, "green", 5)
    # Small triangle/graph in yellow & white chalk
    cv.p(18, 49, "yellow", 5)
    cv.p(17, 50, "yellow", 5)
    cv.p(19, 50, "yellow", 5)
    cv.hline(17, 20, 51, "white", 5)

    # Teacher silhouette at right of chalkboard (x = 25..27, y = 48..54)
    cv.rect(25, 48, 26, 49, "kinari", 4)  # head
    cv.hline(25, 26, 48, "kuro", 1)       # hair
    cv.rect(24, 50, 27, 54, "navy", 2)    # navy blazer
    cv.p(25, 50, "white", 6)              # shirt collar
    cv.p(23, 50, "kinari", 4)             # hand pointing at board

    # Neat row of student desk tops & seated student heads along bottom (y = 53..55)
    for sx in (8, 14, 20):
        # Student dark hair & shoulders from behind/3-4
        cv.hline(sx + 1, sx + 2, 52, "kuro", 1)
        cv.hline(sx, sx + 3, 54, "cedar", 5)      # sunlit wooden desk top
        cv.hline(sx, sx + 3, 55, "floorwood", 3)  # desk front edge
        cv.p(sx + 1, 54, "white", 6)              # open textbook

    # === CLASSROOM B (Right Bay: x = 32..54, y = 45..55) ===
    cv.rect(32, 45, 54, 55, "cream", 5)
    cv.hline(32, 54, 45, "cream", 2)
    cv.hline(35, 41, 45, "white", 6)
    cv.hline(45, 51, 45, "white", 6)

    # Wall clock (x = 34..36, y = 47..49) + Blue framed academy motto banner (x = 39..47, y = 47..50)
    cv.rect(34, 47, 36, 49, "steel", 2)
    cv.p(35, 48, "white", 6)
    cv.box(39, 47, 47, 50, "blue", 2, "blue", 4)
    cv.hline(41, 45, 48, "white", 6)

    # Tall classroom bookcase on far right (x = 49..53, y = 47..55)
    cv.rect(49, 47, 53, 55, "cedar", 3)
    cv.hline(49, 53, 47, "cedar", 5)
    for rx, rc in ((50, "blue"), (51, "red"), (52, "yellow")):
        cv.vline(rx, 48, 50, rc, 4)
    for rx, rc in ((50, "green"), (51, "white"), (52, "navy")):
        cv.vline(rx, 52, 54, rc, 4 if rc != "white" else 6)

    # Neat row of 3 study desks + student silhouettes + open white workbooks
    for sx, shirt_r in ((33, "blue"), (39, "coolwhite"), (44, "navy")):
        cv.hline(sx + 1, sx + 2, 51, "kuro", 1)
        cv.hline(sx + 1, sx + 2, 52, shirt_r, 3)
        cv.hline(sx, sx + 3, 54, "cedar", 5)
        cv.hline(sx, sx + 3, 55, "floorwood", 3)
        cv.hline(sx + 1, sx + 2, 53, "white", 6)

    # Subtle diagonal exterior glass glare streaks over both classroom windows
    for gx, gy in [(7, 47), (8, 46), (19, 55), (20, 54), (33, 48), (34, 47), (35, 46), (52, 54), (53, 53)]:
        cv.p(gx, gy, "glass", 5)

    # Upper transom aluminum mullion bar (y = 46) & protruding stone window sill (y = 58..59)
    cv.hline(5, 29, 46, "steel", 4)
    cv.hline(32, 54, 46, "steel", 4)
    cv.hline(3, 57, 58, "white", 6)
    cv.hline(3, 57, 59, "coolwhite", 2)

    # --- 2F/1F CORNICE BAND & CRISP NAVY `학원` SIGNBOARD (y = 60..72) ---
    # Architectural fascia backing across full 64px width
    cv.hline(0, W - 1, 60, "white", 6)
    cv.rect(0, 61, W - 1, 71, "coolwhite", 3)
    cv.hline(0, W - 1, 71, "concrete", 2)

    # Overhead sign spotlights (x = 18, 45)
    for lx in (18, 45):
        cv.hline(lx - 1, lx + 1, 59, "steel", 2)
        cv.p(lx, 60, "yellow", 5)

    # Wide Navy-Blue Academy Signboard `학원` (x = 5..58, y = 60..71)
    cv.rect(5, 60, 58, 71, "navy", 0)
    # Brushed silver aluminum sign frame
    cv.hline(5, 58, 60, "steel", 6)
    cv.hline(5, 58, 71, "steel", 3)
    cv.vline(5, 60, 71, "steel", 5)
    cv.vline(58, 60, 71, "steel", 2)
    # Rich graded navy signboard face (x = 6..57, y = 61..70)
    for y in range(61, 71):
        if y == 61:
            cv.hline(6, 57, y, "blue", 3)
        elif y <= 64:
            cv.hline(6, 57, y, "navy", 2)
        elif y <= 68:
            cv.hline(6, 57, y, "navy", 1)
        else:
            cv.hline(6, 57, y, "navy", 0)

    # 4 Crisp Silver Corner Rivets!
    for rx, ry in ((7, 62), (55, 62), (7, 69), (55, 69)):
        cv.p(rx, ry, "white", 6)
        cv.p(rx + 1, ry, "steel", 3)

    # Left Academic Crest Emblem (Golden Star / Open Book badge, x = 10..17, y = 62..69)
    cv.box(10, 62, 17, 69, "blue", 4, "blue", 2)
    # Golden open book + star crest inside badge
    cv.hline(11, 16, 67, "yellow", 5)
    cv.hline(12, 15, 68, "orange", 4)
    cv.hline(11, 13, 66, "white", 6)
    cv.hline(14, 16, 66, "cream", 5)
    cv.p(13, 63, "yellow", 5)
    cv.p(14, 63, "yellow", 4)
    cv.p(13, 64, "white", 6)

    # Crisp 9x9 Hangul `학원` from hangul9.json — centered vertically at y = 61..69!
    fg_sign = pal.c("white", 6)
    hi_sign = pal.c("white", 6)
    sh_sign = pal.c("navy", 0)
    cv.draw_glyph("학", 22, 61, fg_sign, sh_sign, hi_sign)
    cv.draw_glyph("원", 34, 61, fg_sign, sh_sign, hi_sign)

    # Right side decorative math/grade accent pill (x = 46..53, y = 63..68)
    cv.rect(46, 63, 53, 68, "blue", 3)
    cv.hline(46, 53, 63, "blue", 5)
    cv.hline(47, 52, 65, "yellow", 5)
    cv.hline(47, 50, 67, "white", 6)

    # Drop shadow cast by signboard onto 1F lintel
    cv.hline(0, W - 1, 72, "ink", 1)
    cv.hline(5, 59, 72, "ink", 0)

    # -----------------------------------------------------------------------
    # 3. 1F LIVING STOREFRONT (y = 72..111)
    #    Bulletin notice board & trophy shelf (left), aluminum double glass
    #    lobby doors (center), class directory, potted boxwoods & stone steps!
    # -----------------------------------------------------------------------
    # Clean light-granite architectural pilasters & lintel (full width x = 0..63)
    for y in range(73, 108):
        for x in range(0, W):
            if y == 73:
                cv.p(x, y, "stone", 2)
            elif y == 74:
                cv.p(x, y, "stone", 6)
            elif x == 0:
                cv.p(x, y, "stone", 4)
            elif x == 1:
                cv.p(x, y, "stone", 6)
            elif x == W - 1:
                cv.p(x, y, "stone", 3)
            else:
                # Subtle granite courses every 6px
                t = 5 if (y - 74) % 6 != 0 else 4
                cv.p(x, y, "stone", t)

    # Baseboard stone plinth along left & right walls (y = 107..111)
    cv.hline(0, W - 1, 107, "pavement", 5)
    cv.hline(0, W - 1, 108, "pavement", 4)
    cv.hline(0, W - 1, 109, "pavement", 3)
    cv.hline(0, W - 1, 110, "pavement", 2)
    cv.hline(0, W - 1, 111, "pavement", 1)

    # --- LEFT ZONE: GLASS-ENCLOSED BULLETIN BOARD & TROPHY CASE (x = 3..23, y = 75..101) ---
    cv.rect(3, 75, 23, 101, "steel", 2)
    cv.box(4, 76, 22, 100, "steel", 5, "glass", 1)
    # Divider between Cork Notice Board (x = 5..12) and Trophy Showcase (x = 14..21)
    cv.vline(13, 76, 100, "steel", 4)

    # Sub-panel A: Glass-enclosed Bulletin Notice Board (게시판, x = 5..12, y = 77..99)
    cv.rect(5, 77, 12, 99, "cedar", 3)
    cv.hline(5, 12, 77, "red", 3)       # crimson "합격/공지" header strip
    cv.hline(6, 11, 78, "red", 4)
    # Pinned colorful notices & honor roll flyers
    cv.rect(6, 80, 8, 84, "white", 6)
    cv.p(7, 80, "red", 4)               # red pushpin
    cv.hline(6, 8, 82, "blue", 3)
    cv.rect(9, 81, 11, 85, "yellow", 5)
    cv.p(10, 81, "green", 3)            # green pushpin
    cv.rect(6, 86, 9, 91, "cream", 6)
    cv.hline(6, 9, 87, "red", 4)
    cv.hline(6, 8, 89, "steel", 3)
    cv.rect(10, 87, 11, 91, "yellow", 4)
    cv.rect(6, 93, 11, 97, "blue", 5)
    cv.hline(7, 10, 95, "white", 6)
    # Diagonal glass reflection over bulletin case
    cv.p(5, 82, "glass", 5)
    cv.p(6, 81, "glass", 5)
    cv.p(7, 80, "white", 6)

    # Sub-panel B: Lit Trophy & Award Shelf (트로피 진열장, x = 14..21, y = 77..99)
    cv.rect(14, 77, 21, 99, "glass", 0)
    # Warm top downlight
    cv.hline(16, 19, 77, "yellow", 5)
    cv.p(17, 77, "white", 6)
    cv.hline(15, 20, 78, "cream", 5)
    # Upper shelf (y = 87): Tall Gold Cup Trophy + Silver Medal Plaque
    cv.hline(14, 21, 87, "floorwood", 4)
    cv.hline(14, 21, 88, "floorwood", 2)
    # Golden Trophy #1 (x = 15..18, y = 80..86)
    cv.hline(15, 18, 80, "yellow", 5)
    cv.p(16, 80, "white", 6)            # specular glint!
    cv.rect(15, 81, 18, 83, "yellow", 4)
    cv.p(15, 81, "yellow", 5)
    cv.hline(16, 17, 84, "orange", 3)   # stem
    cv.hline(15, 18, 85, "yellow", 4)   # pedestal
    cv.hline(15, 18, 86, "wood", 3)     # dark wood base
    # Blue & gold award plaque beside trophy (x = 19..21, y = 82..86)
    cv.rect(19, 82, 20, 86, "blue", 3)
    cv.p(19, 83, "yellow", 5)
    cv.p(20, 84, "white", 6)

    # Lower shelf (y = 97): Second Gold Trophy + Stacked Textbooks
    cv.hline(14, 21, 97, "floorwood", 4)
    cv.hline(14, 21, 98, "floorwood", 2)
    # Golden Trophy #2 (x = 18..20, y = 90..96)
    cv.hline(18, 20, 90, "yellow", 5)
    cv.p(19, 91, "white", 6)
    cv.hline(18, 20, 92, "orange", 4)
    cv.p(19, 93, "yellow", 3)
    cv.hline(18, 20, 94, "yellow", 4)
    cv.hline(18, 20, 95, "wood", 2)
    cv.hline(18, 20, 96, "wood", 1)
    # Stacked colorful workbooks on left of lower shelf (x = 14..17, y = 92..96)
    cv.hline(14, 17, 92, "white", 6)
    cv.hline(14, 17, 93, "blue", 4)
    cv.hline(14, 17, 94, "white", 5)
    cv.hline(14, 17, 95, "red", 4)
    cv.hline(14, 17, 96, "green", 3)

    # --- CENTER-RIGHT: ALUMINUM-FRAMED DOUBLE GLASS LOBBY DOORS (x = 25..46, y = 74..106) ---
    cv.rect(25, 74, 46, 106, "steel", 2)
    cv.box(26, 75, 45, 106, "steel", 5, "steel", 3)
    # Automatic door sensor & black header unit
    cv.hline(32, 39, 74, "kuro", 1)
    cv.p(35, 74, "green", 4)
    cv.p(36, 74, "green", 5)

    # Upper glass transom above doors (x = 27..44, y = 76..79)
    for y in range(76, 80):
        for x in range(27, 45):
            cv.p(x, y, "glass", 1 if y < 78 else 2)
    # Warm lobby ceiling light visible inside transom
    cv.hline(31, 40, 76, "cream", 6)
    cv.hline(33, 38, 77, "yellow", 5)
    cv.hline(26, 45, 80, "steel", 5)
    cv.hline(26, 45, 81, "steel", 2)

    # Center door seam (x = 35..36)
    cv.vline(35, 81, 106, "steel", 5)
    cv.vline(36, 81, 106, "steel", 1)

    # Left & Right Glass Door Leafs (x = 27..34 and x = 37..44, y = 82..102)
    for px0, px1 in ((27, 34), (37, 44)):
        for y in range(82, 103):
            for x in range(px0, px1 + 1):
                # Subtle warm lobby reception desk hint in lower background
                if 94 <= y <= 100 and 29 <= x <= 42:
                    cv.p(x, y, "glass", 2)
                elif y < 88:
                    cv.p(x, y, "glass", 0)
                elif y < 95:
                    cv.p(x, y, "glass", 1)
                else:
                    cv.p(x, y, "glass", 2)

                # Crisp diagonal glass glare streaks!
                d = (x - px0) + (y - 82)
                if d in (6, 7, 15, 16):
                    cv.p(x, y, "glass", 5)
                elif d in (5, 8, 14):
                    cv.p(x, y, "glass", 3)

    # Horizontal blue/white safety decal stripe across glass doors (y = 92)
    cv.hline(27, 34, 92, "blue", 4)
    cv.hline(37, 44, 92, "blue", 4)
    cv.p(30, 92, "white", 6)
    cv.p(40, 92, "white", 6)

    # Tall stainless vertical door handles (x = 33, 38, y = 90..96)
    for hx in (33, 38):
        cv.vline(hx, 90, 96, "white", 6)
        cv.p(hx, 90, "steel", 3)
        cv.p(hx, 96, "steel", 3)

    # Brushed aluminum bottom kickplates (y = 103..105)
    cv.rect(27, 103, 34, 105, "steel", 4)
    cv.hline(27, 34, 103, "steel", 6)
    cv.rect(37, 103, 44, 105, "steel", 4)
    cv.hline(37, 44, 103, "steel", 6)

    # --- RIGHT WALL: FLOOR/SUBJECT DIRECTORY PLAQUE & INTERCOM (x = 48..61, y = 76..95) ---
    # Sleek navy/silver academy subject schedule plaque (국·영·수 안내판, x = 49..60, y = 77..92)
    cv.box(49, 77, 60, 92, "steel", 5, "navy", 1)
    cv.hline(50, 59, 78, "blue", 4)
    cv.hline(51, 58, 79, "yellow", 5)
    for ry, rc in ((81, "white"), (83, "coolwhite"), (85, "white"), (87, "green"), (89, "yellow")):
        cv.p(51, ry, rc, 5)
        cv.hline(53, 58, ry, "white", 5 if ry % 4 == 1 else 4)
    # Card-reader / intercom beside door (x = 47, y = 88..91)
    cv.rect(47, 88, 48, 91, "kuro", 2)
    cv.p(47, 89, "green", 4)

    # --- CLEAN STONE STEPS (x = 23..48, y = 106..111) ---
    # Upper step (x = 24..47, y = 106..108)
    cv.hline(24, 47, 106, "white", 6)
    cv.hline(24, 47, 107, "stone", 6)
    cv.hline(24, 47, 108, "stone", 3)
    # Lower wider step (x = 23..48, y = 109..111)
    cv.hline(23, 48, 109, "white", 5)
    cv.hline(23, 48, 110, "stone", 4)
    cv.hline(23, 48, 111, "stone", 1)
    # Clean blue welcome mat centered on upper landing (x = 31..40, y = 106..107)
    cv.hline(31, 40, 106, "navy", 3)
    cv.hline(32, 39, 107, "navy", 2)

    # --- NEAT POTTED BOXWOOD SHRUBS (좌우 정돈된 회양목 화분, y = 96..111) ---
    for px0, px1 in ((3, 16), (49, 61)):
        # Crisp shadow behind/under planter
        cv.hline(px0, px1 + 1, 111, "ink", 1)
        # Manicured hedge-shaped lush green boxwood foliage (y = 97..104)
        for y in range(97, 105):
            for x in range(px0 + 1, px1):
                # Rounded top corners
                if y == 97 and (x <= px0 + 2 or x >= px1 - 2):
                    continue
                if y <= 98:
                    tone = 5 if (x + y) % 2 == 0 else 6
                elif y <= 101:
                    tone = 4 if (x * 3 + y) % 4 != 0 else 5
                elif y <= 103:
                    tone = 2 if (x + y) % 3 == 0 else 3
                else:
                    tone = 1
                if x >= px1 - 2:
                    tone = max(1, tone - 2)
                cv.p(x, y, "foliage", tone)

        # Clean modern light-terracotta / warm stone rectangular planter box (y = 105..110)
        cv.hline(px0, px1, 105, "cream", 5)
        cv.hline(px0, px1, 106, "stone", 5)
        cv.rect(px0 + 1, 107, px1 - 1, 110, "stone", 4)
        cv.vline(px0 + 1, 107, 110, "stone", 5)
        cv.vline(px1 - 1, 107, 110, "stone", 2)
        cv.hline(px0 + 1, px1 - 1, 110, "stone", 2)

    return cv


# ===========================================================================
# BUILDING 2: k-pocha.png (48x112) — Retro Euljiro Late-Night 포차 (Tavern)
# ===========================================================================

def draw_red_plastic_stool(cv: PixelCanvas, x0: int, y0: int) -> None:
    """
    Iconic Korean red round stackable plastic pocha stool (6x8 at x0..x0+5, y0..y0+7).
    """
    # Ground shadow
    cv.hline(x0, x0 + 6, y0 + 7, "ink", 0)
    # 4 splayed red plastic legs with open gap under cross-brace (y0+3 .. y0+6)
    for ly in range(y0 + 3, y0 + 7):
        cv.p(x0, ly, "red", 4 if ly < y0 + 5 else 3)
        cv.p(x0 + 1, ly, "red", 1 if ly <= y0 + 4 else 2)
        cv.p(x0 + 4, ly, "red", 2)
        cv.p(x0 + 5, ly, "aka", 1)
    # Dark daylight gap between front legs at bottom (y0+5 .. y0+6)
    cv.hline(x0 + 2, x0 + 3, y0 + 5, "asphalt", 0)
    cv.hline(x0 + 2, x0 + 3, y0 + 6, "ink", 0)
    # Molded cross-brace ring under seat (y0+4)
    cv.hline(x0 + 1, x0 + 4, y0 + 3, "aka", 1)
    cv.hline(x0 + 1, x0 + 4, y0 + 4, "red", 2)
    # Molded round red seat top (y0 .. y0+2)
    cv.hline(x0 + 1, x0 + 4, y0, "red", 5)
    cv.hline(x0, x0 + 5, y0 + 1, "red", 4)
    cv.p(x0, y0 + 1, "red", 5)          # sunlit rim crescent
    cv.p(x0 + 2, y0 + 1, "aka", 0)      # iconic center finger-hole!
    cv.p(x0 + 3, y0 + 1, "red", 3)
    cv.hline(x0, x0 + 5, y0 + 2, "red", 3)
    cv.p(x0 + 5, y0 + 2, "red", 1)


def draw_beer_crate(cv: PixelCanvas, x0: int, y0: int, color_ramp: str) -> None:
    """
    Plastic Korean beer/soju crate (9x6 at x0..x0+8, y0..y0+5) with bottle caps peeking.
    """
    # Top rim + bottle caps inside
    cv.hline(x0, x0 + 8, y0, color_ramp, 5)
    for bx in (x0 + 2, x0 + 4, x0 + 6):
        cv.p(bx, y0, "white", 6 if color_ramp == "green" else 5)
    # Front gridded plastic crate body
    cv.rect(x0, y0 + 1, x0 + 8, y0 + 5, color_ramp, 3)
    cv.vline(x0, y0 + 1, y0 + 5, color_ramp, 4)
    cv.vline(x0 + 8, y0 + 1, y0 + 5, color_ramp, 1)
    cv.hline(x0, x0 + 8, y0 + 5, color_ramp, 1)
    # Handle slot + vertical plastic ribs
    cv.hline(x0 + 3, x0 + 5, y0 + 2, color_ramp, 0)
    for rx in (x0 + 2, x0 + 6):
        cv.vline(rx, y0 + 2, y0 + 4, color_ramp, 4)
    cv.p(x0 + 4, y0 + 4, "white", 5)    # tiny brand print dot


def build_pocha(pal: Palette, glyphs: dict[str, list[str]]) -> PixelCanvas:
    W, H = 48, 112
    cv = PixelCanvas(W, H, pal, glyphs)

    # -----------------------------------------------------------------------
    # 1. ROOF (y = 0..39): Dark weathered kawara tiles (upper) + corrugated
    #    steel/ibushi sheet roof (lower) + crooked exhaust vent pipe & shadow!
    #    Full 48px wall-to-wall opaque starting at y = 8; vent pipe at y = 1..7
    # -----------------------------------------------------------------------
    # Small retro rooftop wire aerial on left (x = 7..13, y = 3..8)
    cv.vline(10, 3, 9, "steel", 4)
    cv.hline(7, 13, 5, "steel", 3)
    cv.hline(8, 12, 7, "steel", 2)
    cv.p(7, 5, "steel", 5)

    # Dark tiled ridge cap (y = 8..10, full width x = 0..47)
    cv.hline(0, W - 1, 8, "kawara", 5)
    cv.hline(0, W - 1, 9, "kawara", 3)
    cv.hline(0, W - 1, 10, "kuro", 1)
    for x in range(1, W - 1, 4):
        cv.p(x, 8, "kawara", 6)
        cv.p(x + 2, 9, "kawara", 1)

    # Upper pitched roof: Weathered dark kawara clay tiles (y = 11..24)
    for y in range(11, 25):
        course = (y - 11) % 4
        for x in range(0, W):
            col_mod = x % 4
            if col_mod == 0:
                # Tile rib highlight
                t = 4 if y < 18 else 3
                cv.p(x, y, "kawara", t)
            elif col_mod == 3:
                # Deep channel between tiles
                cv.p(x, y, "kuro", 1 if course != 3 else 0)
            else:
                base = 2 if course < 3 else 1
                if y >= 21:
                    base = min(3, base + 1)
                cv.p(x, y, "kawara", base)

    # Subtle moss & weathered patina patches on old tiles
    for mx, my in [(5, 16), (6, 16), (6, 17), (21, 20), (22, 20), (14, 22)]:
        cv.p(mx, my, "moss", 2 if my % 2 == 0 else 3)

    # Overlapping seam onto lower corrugated steel/ibushi roof apron (y = 25..38)
    cv.hline(0, W - 1, 25, "kuro", 0)
    for y in range(26, 38):
        for x in range(0, W):
            rib = x % 3
            # Left half slightly warmer ibushi, right sheet cooler steel
            ramp = "ibushi" if x < 26 else "steel"
            if y == 26:
                cv.p(x, y, ramp, 1)
            elif rib == 0:
                cv.p(x, y, ramp, 5 if y >= 31 else 4)
            elif rib == 1:
                cv.p(x, y, ramp, 3)
            else:
                cv.p(x, y, ramp, 1 if y < 35 else 2)

    # Vertical sheet overlap seam at x = 26 + rust streaks along rivets!
    cv.vline(26, 26, 37, "kuro", 1)
    for rx in range(2, W - 1, 6):
        cv.p(rx, 28, "cha", 3)
        cv.p(rx, 36, "cha", 2)
    # Weathered warm rust patches on corrugated tin
    for rx, ry, ri in [
        (8, 33, 3), (9, 34, 4), (8, 35, 3), (9, 35, 2),
        (25, 31, 3), (25, 32, 4), (27, 35, 3), (41, 34, 3), (42, 35, 4),
    ]:
        cv.p(rx, ry, "cha", ri)

    # Jagged/scalloped bottom corrugated drip edge & deep eaves shadow (y = 38..39)
    for x in range(0, W):
        cv.p(x, 38, "ibushi" if x % 3 == 0 else "kuro", 3 if x % 3 == 0 else 1)
        cv.p(x, 39, "ink", 0)

    # --- CROOKED GALVANIZED EXHAUST VENT PIPE & CAST SHADOW (x = 29..44, y = 1..32) ---
    # Grounded 3/4 diagonal cast shadow anchored directly at flashing base (33, 24) -> (43, 33)
    for sy in range(21, 34):
        sx0 = 33 + (sy - 21) // 2
        sx1 = min(W - 1, sx0 + (5 if sy < 29 else 4))
        for sx in range(sx0, sx1 + 1):
            if sy < 25:
                cv.p(sx, sy, "kuro", 0)
            else:
                cv.p(sx, sy, "ibushi", 0 if sx < sx1 else 1)

    # Square sheet-metal roof flashing collar at base (x = 29..35, y = 23..28)
    cv.rect(29, 24, 35, 28, "steel", 2)
    cv.hline(29, 35, 24, "steel", 4)
    cv.hline(29, 35, 28, "kuro", 1)

    # Lower vertical pipe segment (x = 30..33, y = 15..25)
    for y in range(15, 26):
        cv.p(30, y, "steel", 3)
        cv.p(31, y, "steel", 5)
        cv.p(32, y, "steel", 3)
        cv.p(33, y, "steel", 1)

    # Crooked 45-degree jogged elbow shifting right (y = 10..15)
    for dy, dx in enumerate((0, 1, 2, 3, 4)):
        py = 14 - dy
        px = 31 + dx
        cv.p(px - 1, py, "steel", 2)
        cv.p(px, py, "steel", 5)
        cv.p(px + 1, py, "steel", 4)
        cv.p(px + 2, py, "steel", 1)
    # Crimped elbow seam ring
    cv.hline(31, 35, 13, "kuro", 2)

    # Upper vertical flue rising above roof silhouette (x = 34..37, y = 3..10)
    for y in range(3, 11):
        cv.p(34, y, "steel", 3)
        cv.p(35, y, "steel", 6 if y < 7 else 5)
        cv.p(36, y, "steel", 3)
        cv.p(37, y, "kuro", 2)
    # Soot staining just under rain cap
    cv.hline(34, 37, 3, "kuro", 1)
    # Conical sheet-metal rain cap (x = 32..39, y = 1..2)
    cv.hline(34, 37, 1, "steel", 5)
    cv.p(35, 1, "white", 6)
    cv.hline(32, 39, 2, "steel", 3)
    cv.p(33, 2, "steel", 5)
    cv.p(39, 2, "kuro", 1)
    # Guy-wire brace anchoring crooked pipe to roof
    for i in range(6):
        cv.p(34 - i, 9 + i, "steel", 2)

    # -----------------------------------------------------------------------
    # 2. 2F GRITTY RETRO CONCRETE WALL, BARRED WINDOW, BARE BULB & `포차` SIGN
    #    (y = 40..71)
    # -----------------------------------------------------------------------
    for y in range(40, 72):
        for x in range(0, W):
            if y == 40:
                cv.p(x, y, "pavement", 1)
            elif y == 41:
                cv.p(x, y, "concrete", 2)
            elif x == 0:
                cv.p(x, y, "pavement", 2)
            elif x == W - 1:
                cv.p(x, y, "pavement", 1)
            else:
                t = 4 if y < 50 else 3
                cv.p(x, y, "concrete", t)

    # Weathered plaster streaks, hairline crack & exposed old red-brick patch!
    cv.vline(6, 41, 46, "concrete", 2)
    cv.vline(29, 41, 45, "concrete", 2)
    cv.p(30, 45, "concrete", 2)
    # Chipped plaster revealing warm aged brick on right (x = 40..45, y = 48..53)
    cv.rect(40, 48, 45, 53, "concrete", 2)
    cv.rect(41, 49, 44, 52, "brick", 3)
    cv.hline(41, 43, 50, "brick", 4)
    cv.p(42, 51, "brick", 2)
    cv.p(44, 50, "concrete", 5)

    # Retro electric meter box & black utility conduit on far left (x = 2..5, y = 42..56)
    cv.vline(3, 40, 57, "kuro", 1)
    cv.rect(2, 47, 5, 52, "steel", 3)
    cv.hline(2, 5, 47, "steel", 5)
    cv.rect(3, 48, 4, 49, "glass", 2)
    cv.p(3, 51, "red", 3)

    # --- 2F BARRED RETRO WINDOW (방범창 창문, x = 8..27, y = 43..53) ---
    cv.rect(8, 43, 27, 53, "darkwood", 1)
    cv.box(9, 44, 26, 52, "wood", 3, "glass", 0)
    # Warm half-drawn vintage amber curtain + dark interior room
    for y in range(45, 52):
        for x in range(10, 26):
            if x <= 14 or x >= 22:
                cv.p(x, y, "straw", 3 if (x + y) % 2 == 0 else 2)
            elif y >= 49:
                cv.p(x, y, "orange", 1)
            else:
                cv.p(x, y, "glass", 1)
    # Center wooden window sash bar
    cv.vline(17, 44, 52, "wood", 3)
    cv.vline(18, 44, 52, "darkwood", 1)
    # Exterior vertical iron security bars (방범창) with horizontal crossbar!
    cv.hline(8, 27, 46, "steel", 3)
    cv.hline(8, 27, 51, "steel", 2)
    for bx in range(10, 27, 3):
        for by in range(43, 54):
            cv.p(bx, by, "steel", 5 if by < 48 else 4)
    # Weathered concrete sill + rust drip below bars
    cv.hline(7, 28, 54, "concrete", 5)
    cv.hline(7, 28, 55, "pavement", 2)
    cv.p(10, 55, "cha", 3)
    cv.p(22, 55, "cha", 3)

    # --- WARM HANGING BARE BULB ON 2F WALL (x = 32..40, y = 41..51) ---
    # Radial warm incandescent glow cast onto weathered concrete wall
    for gy in range(43, 51):
        for gx in range(32, 41):
            dist = abs(gx - 36) + abs(gy - 47)
            if dist <= 2:
                cv.p(gx, gy, "yellow", 4)
            elif dist <= 4:
                cv.p(gx, gy, "cream", 4)
            elif dist == 5:
                cv.p(gx, gy, "kinari", 3)
    # Gooseneck iron bracket & cord (x = 35..37, y = 41..45)
    cv.hline(35, 37, 41, "kuro", 1)
    cv.vline(36, 41, 44, "kuro", 1)
    cv.p(36, 45, "yellow", 2)           # brass socket
    # Glowing bare glass bulb!
    cv.hline(35, 37, 46, "yellow", 5)
    cv.hline(35, 37, 47, "yellow", 5)
    cv.p(36, 46, "white", 6)
    cv.p(36, 47, "white", 6)
    cv.p(36, 48, "orange", 4)

    # --- BOLD GLOWING CRIMSON/AMBER SIGNBOARD `포차` (x = 2..45, y = 57..70) ---
    cv.rect(2, 57, 45, 70, "aka", 0)
    # Outer rusted dark steel cabinet rim
    cv.box(2, 57, 45, 70, "steel", 2, "red", 1)
    cv.hline(2, 45, 57, "steel", 4)
    # Glowing warm amber/gold inner neon border tube (x = 4..43, y = 58..69)
    cv.box(4, 58, 43, 69, "orange", 4, "red", 2)
    cv.hline(5, 42, 58, "yellow", 5)
    cv.hline(5, 42, 69, "orange", 3)
    # Rich glowing crimson acrylic interior gradient
    cv.hline(5, 42, 59, "red", 4)
    cv.hline(5, 42, 60, "red", 3)
    for y in range(61, 67):
        cv.hline(5, 42, y, "red", 2 if y < 65 else 1)
    cv.hline(5, 42, 67, "maple", 2)
    cv.hline(5, 42, 68, "maple", 1)

    # Retro marquee bulb studs on left & right of crimson sign!
    for by in (60, 63, 66):
        cv.p(7, by, "yellow", 5)
        cv.p(8, by, "orange", 4)
        cv.p(40, by, "yellow", 5)
        cv.p(39, by, "orange", 4)

    # Small warm soju-cup / flame icon on left of text (x = 10..12, y = 62..66)
    cv.p(11, 61, "yellow", 5)
    cv.hline(10, 12, 63, "white", 6)
    cv.hline(10, 12, 64, "orange", 5)
    cv.p(11, 65, "yellow", 4)

    # Crisp 9x9 Hangul `포차` from hangul9.json!
    # Glowing cream-gold strokes with pure white top-edge glint & deep crimson shadow
    fg_pocha = pal.c("yellow", 5)
    hi_pocha = pal.c("white", 6)
    sh_pocha = pal.c("aka", 0)
    cv.draw_glyph("포", 15, 59, fg_pocha, sh_pocha, hi_pocha)
    cv.draw_glyph("차", 27, 59, fg_pocha, sh_pocha, hi_pocha)

    # Deep overhang shadow below signboard
    cv.hline(0, W - 1, 71, "ink", 0)

    # -----------------------------------------------------------------------
    # 3. 1F LIVING POJANGMACHA STOREFRONT (y = 72..111)
    #    Orange-red striped vinyl tarpaulin awning, glowing red lantern,
    #    warm amber counter through folded vinyl curtains, stacked beer/soju
    #    plastic crates & red round plastic stools!
    # -----------------------------------------------------------------------
    # Background dark weathered concrete/tile side piers & wet night alley base
    cv.rect(0, 72, W - 1, 111, "pavement", 1)
    for y in range(84, 108):
        cv.p(0, y, "pavement", 2)
        cv.p(1, y, "pavement", 1)
        cv.p(46, y, "pavement", 2)
        cv.p(47, y, "pavement", 1)

    # Wet dark asphalt/flagstone threshold & sidewalk apron (y = 106..111)
    cv.hline(0, W - 1, 106, "asphalt", 3)
    cv.hline(0, W - 1, 107, "asphalt", 2)
    cv.hline(0, W - 1, 108, "pavement", 1)
    cv.hline(0, W - 1, 109, "asphalt", 1)
    cv.hline(0, W - 1, 110, "asphalt", 1)
    cv.hline(0, W - 1, 111, "asphalt", 0)
    # Warm amber ground reflection puddle under open pocha counter!
    cv.hline(14, 30, 108, "orange", 1)
    cv.hline(17, 27, 109, "yellow", 1)

    # --- ORANGE-RED STRIPED POCHA VINYL TARPAULIN AWNING (x = 0..47, y = 72..83) ---
    # 4px alternating stripes: Orange-Red vinyl vs Translucent Warm Cream/Amber vinyl!
    for y in range(72, 81):
        for x in range(0, W):
            is_red_stripe = ((x // 4) % 2 == 0)
            seam = (x % 4 == 0)
            if is_red_stripe:
                if y == 72:
                    r, i = "red", 2
                elif y <= 74:
                    r, i = "red", 4
                elif y <= 77:
                    r, i = "orange", 3 if not seam else 2
                else:
                    # Backlit warm translucent glow near lower slope!
                    r, i = "orange", 4
            else:
                if y == 72:
                    r, i = "cream", 3
                elif y <= 74:
                    r, i = "cream", 6
                elif y <= 77:
                    r, i = "cream", 5 if not seam else 4
                else:
                    # Warm interior bulb glow shining through translucent vinyl!
                    r, i = "yellow", 5 if 12 <= x <= 34 else 4
            # Specular vinyl sheen line across upper-mid slope (y = 74)
            if y == 74 and not seam:
                if is_red_stripe:
                    r, i = "red", 5
                else:
                    r, i = "white", 6
            cv.p(x, y, r, i)

    # Steel awning pipe bar along y = 80
    cv.hline(0, W - 1, 80, "aka", 1)
    # Hanging vinyl valance flap (y = 81..83) with notched pocha tabs
    for x in range(0, W):
        is_red_stripe = ((x // 4) % 2 == 0)
        for y in range(81, 83):
            if is_red_stripe:
                cv.p(x, y, "red", 3 if y == 81 else 2)
            else:
                cv.p(x, y, "cream", 5 if y == 81 else 3)
        # Scalloped bottom hem at y = 83
        if x % 4 in (1, 2):
            cv.p(x, 83, "red" if is_red_stripe else "cream", 2)
        else:
            cv.p(x, 83, "ink", 0)

    # Deep cast shadow directly underneath vinyl awning (y = 84..85)
    cv.hline(0, W - 1, 84, "ink", 0)
    cv.hline(1, W - 2, 85, "darkwood", 0)

    # --- WARM AMBER INTERIOR COUNTER VISIBLE THROUGH FOLDED VINYL CURTAINS (x = 9..36, y = 85..106) ---
    # Deep warm interior background (x = 10..35, y = 85..105)
    cv.rect(10, 85, 35, 105, "darkwood", 1)
    cv.rect(12, 86, 33, 96, "wood", 2)

    # Interior warm hanging Edison bulb & golden halo (x = 22..24, y = 86..90)
    cv.vline(23, 85, 87, "kuro", 1)
    cv.rect(21, 87, 25, 91, "orange", 3)
    cv.rect(22, 88, 24, 90, "yellow", 5)
    cv.p(23, 88, "white", 6)

    # Classic Korean Pocha Wall Menu Strips (손글씨 안주 메뉴판, y = 87..92)
    for mx, mr, mi in [(14, "cream", 5), (16, "yellow", 4), (18, "red", 4), (27, "cream", 5), (29, "orange", 4), (31, "yellow", 5)]:
        cv.vline(mx, 87, 91, mr, mi)
        cv.p(mx, 87, "red" if mr != "red" else "white", 4 if mr != "red" else 6)

    # Warm Stainless & Cedar Pocha Bar Counter (x = 12..33, y = 96..106)
    cv.hline(12, 33, 96, "steel", 5)       # gleaming stainless counter top!
    cv.hline(12, 33, 97, "orange", 4)      # warm amber lip reflection
    for y in range(98, 106):
        for x in range(12, 34):
            # Vertical wood/corrugated counter front panels
            if x % 3 == 0:
                cv.p(x, y, "floorwood", 2)
            elif y <= 100:
                cv.p(x, y, "floorwood", 4)
            else:
                cv.p(x, y, "floorwood", 3 if y < 104 else 1)

    # Steaming Stainless Oden / Tteokbokki Pot on counter! (x = 16..23, y = 93..96)
    cv.rect(16, 94, 23, 95, "steel", 4)
    cv.hline(16, 23, 93, "orange", 4)      # spicy red-orange tteokbokki/oden broth!
    cv.p(18, 93, "red", 4)
    cv.p(21, 93, "yellow", 5)              # skewered fishcake stick!
    cv.p(22, 92, "cream", 6)
    # Delicate white steam wisps rising from hot broth
    cv.p(18, 91, "white", 5)
    cv.p(19, 90, "coolwhite", 4)
    cv.p(20, 92, "white", 6)

    # Iconic Green Glass Soju Bottles + Cups on right of counter! (x = 26..31, y = 92..95)
    for sx in (26, 29):
        cv.p(sx, 92, "green", 5)           # bottle cap/neck
        cv.vline(sx, 93, 95, "green", 3)   # green glass body
        cv.p(sx, 94, "white", 6)           # white label
    cv.p(28, 95, "glass", 5)               # tiny clear soju shot glass!

    # Folded Clear-Vinyl Tarpaulin Curtains framing left (x = 9..14) & right (x = 31..36)!
    # Organic hour-glass draped silhouette tied at waist (y = 96) with orange vinyl hem tape
    for side in ("left", "right"):
        for y in range(85, 106):
            # Wider drape at top & bottom, cinched tight at y = 95..97
            dist_waist = abs(y - 96)
            width = 3 if dist_waist <= 2 else (4 if dist_waist <= 6 else 5)
            if side == "left":
                lx, rx = 9, 9 + width - 1
                hem_x = rx
                pleat_hi_x = lx + 1
            else:
                rx = 36
                lx = 36 - width + 1
                hem_x = lx
                pleat_hi_x = rx - 1

            for x in range(lx, rx + 1):
                if x == hem_x:
                    # Bright orange pocha tarpaulin hem tape following curved edge
                    cv.p(x, y, "orange", 4 if y < 99 else 3)
                elif x == pleat_hi_x and y not in (95, 96, 97):
                    # Smooth vertical vinyl pleat specular reflection
                    cv.p(x, y, "glass", 5 if y < 95 else 4)
                elif x == pleat_hi_x + (1 if side == "left" else -1) and y < 93:
                    cv.p(x, y, "glass", 3)
                else:
                    cv.p(x, y, "glass", 2 if y < 96 else 1)

        # Yellow tie-back cord wrapped around waist at y = 96
        if side == "left":
            cv.hline(9, 12, 96, "yellow", 5)
            cv.p(11, 97, "orange", 4)
        else:
            cv.hline(33, 36, 96, "yellow", 5)
            cv.p(34, 97, "orange", 4)

    # --- GLOWING RED POCHA LANTERN (홍등, x = 2..8, y = 85..96) ---
    cv.vline(5, 84, 85, "kuro", 1)
    cv.hline(4, 6, 86, "kuro", 1)          # top black rim
    lantern_rows = [
        ".#####.",
        "#######",
        "#######",
        "#######",
        "#######",
        "#######",
        ".#####.",
    ]
    for ry, row in enumerate(lantern_rows):
        for rx, ch in enumerate(row):
            if ch == "#":
                px, py = 2 + rx, 87 + ry
                dist = abs(rx - 3) + abs(ry - 3)
                if dist == 0:
                    cv.p(px, py, "white", 6)
                elif dist == 1:
                    cv.p(px, py, "yellow", 5)
                elif dist == 2:
                    cv.p(px, py, "orange", 4 if ry % 2 == 0 else 5)
                elif rx <= 1 or rx >= 5:
                    cv.p(px, py, "red", 2)
                else:
                    cv.p(px, py, "red", 4 if ry % 2 == 0 else 3)
    cv.hline(4, 6, 94, "kuro", 1)          # bottom black cap
    cv.p(5, 95, "yellow", 5)               # golden hanging tassel
    cv.p(5, 96, "orange", 4)

    # --- ICONIC STACK OF GREEN & YELLOW PLASTIC BEER/SOJU CRATES (x = 37..46, y = 92..111) ---
    # Cast shadow on ground left/bottom of crate stack
    cv.hline(36, 46, 111, "ink", 0)
    # 3 stacked crates: Bottom Green (y=105..110), Middle Yellow (y=99..104), Top Green (y=93..98)
    draw_beer_crate(cv, 37, 105, "green")
    draw_beer_crate(cv, 37, 99, "yellow")
    draw_beer_crate(cv, 38, 93, "green")

    # --- TINY RED ROUND PLASTIC STOOLS OUTSIDE (빨간 플라스틱 의자, y = 103..111) ---
    # Stool 1 on left sidewalk below lantern (x = 2..7, y = 103..110)
    draw_red_plastic_stool(cv, 2, 103)
    # Stool 2 beside right curtain / crate stack (x = 29..34, y = 104..111)
    draw_red_plastic_stool(cv, 29, 104)

    return cv


# ===========================================================================
# Strict Verification & 3x Preview Sheet on #23262e Checkerboard
# ===========================================================================

def verify_sprite(
    name: str,
    img: Image.Image,
    expected_size: tuple[int, int],
    pal: Palette,
    full_wall_y: int,
) -> int:
    assert img.mode == "RGBA", f"{name}: mode must be RGBA"
    assert img.size == expected_size, f"{name}: expected {expected_size}, got {img.size}"

    w, h = img.size
    px = img.load()
    off_palette = 0
    bad_alpha = 0
    pure_black = 0
    used_colors: set[tuple[int, int, int]] = set()

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a not in (0, 255):
                bad_alpha += 1
            if a == 255:
                if (r, g, b) == (0, 0, 0):
                    pure_black += 1
                if (r, g, b) not in pal.allowed_rgb:
                    off_palette += 1
                used_colors.add((r, g, b))
            elif y >= full_wall_y:
                raise AssertionError(
                    f"{name}: unexpected transparent pixel below roof parapet at ({x}, {y})"
                )

    assert bad_alpha == 0, f"{name}: {bad_alpha} non-binary alpha pixels!"
    assert pure_black == 0, f"{name}: {pure_black} pure #000000 pixels!"
    assert off_palette == 0, f"{name}: {off_palette} off-palette pixels!"
    assert 60 <= len(used_colors) <= 95, (
        f"{name}: expected 60..95 unique palette colors, got {len(used_colors)}"
    )
    return len(used_colors)


def make_checkerboard(w: int, h: int, cell: int = 12) -> Image.Image:
    """Dark slate checkerboard rooted at #23262e."""
    c0 = (0x23, 0x26, 0x2E, 255)
    c1 = (0x2B, 0x2F, 0x3A, 255)
    bg = Image.new("RGBA", (w, h), c0)
    draw = ImageDraw.Draw(bg)
    for y in range(0, h, cell):
        for x in range(0, w, cell):
            if ((x // cell) + (y // cell)) % 2 == 1:
                draw.rectangle([x, y, x + cell - 1, y + cell - 1], fill=c1)
    return bg


def save_preview_sheet(hagwon: Image.Image, pocha: Image.Image, out_path: Path) -> None:
    scale = 3
    h3 = hagwon.resize((hagwon.width * scale, hagwon.height * scale), Image.NEAREST)
    p3 = pocha.resize((pocha.width * scale, pocha.height * scale), Image.NEAREST)

    # Also show wall-to-wall 2x joined pair + 1x native so seam alignment is unmistakable
    join_w = hagwon.width + pocha.width
    joined_1x = Image.new("RGBA", (join_w, 112), (0, 0, 0, 0))
    joined_1x.alpha_composite(hagwon, (0, 0))
    joined_1x.alpha_composite(pocha, (hagwon.width, 0))
    j2 = joined_1x.resize((join_w * 2, 112 * 2), Image.NEAREST)

    pad = 24
    sheet_w = pad + h3.width + pad + p3.width + pad + j2.width + pad
    sheet_h = pad + h3.height + pad + 20

    sheet = make_checkerboard(sheet_w, sheet_h, cell=12)
    draw = ImageDraw.Draw(sheet)

    x_h3 = pad
    x_p3 = x_h3 + h3.width + pad
    x_right = x_p3 + p3.width + pad
    y_top = pad + 16

    draw.text((x_h3, 8), "k-hagwon (3x, 64x112)", fill=(225, 230, 240, 255))
    draw.text((x_p3, 8), "k-pocha (3x, 48x112)", fill=(225, 230, 240, 255))
    draw.text((x_right, 8), "Wall-to-Wall (2x) + 1x Native", fill=(185, 195, 210, 255))

    sheet.alpha_composite(h3, (x_h3, y_top))
    sheet.alpha_composite(p3, (x_p3, y_top))
    sheet.alpha_composite(j2, (x_right, y_top))
    sheet.alpha_composite(joined_1x, (x_right, y_top + h3.height - 112))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(out_path)


def main() -> None:
    pal = Palette(PALETTE_PATH)
    glyphs = json.loads(GLYPHS_PATH.read_text(encoding="utf-8"))["glyphs"]

    SHOPS_DIR.mkdir(parents=True, exist_ok=True)

    hagwon_cv = build_hagwon(pal, glyphs)
    pocha_cv = build_pocha(pal, glyphs)

    hagwon_colors = verify_sprite("k-hagwon.png", hagwon_cv.img, (64, 112), pal, full_wall_y=6)
    pocha_colors = verify_sprite("k-pocha.png", pocha_cv.img, (48, 112), pal, full_wall_y=8)

    hagwon_out = SHOPS_DIR / "k-hagwon.png"
    pocha_out = SHOPS_DIR / "k-pocha.png"
    hagwon_cv.img.save(hagwon_out)
    pocha_cv.img.save(pocha_out)

    save_preview_sheet(hagwon_cv.img, pocha_cv.img, PREVIEW_PATH)

    print(
        f"PASS k-hagwon.png: 64x112 RGBA, {hagwon_colors} unique colors, "
        f"0 off-palette, 0 #000000, binary alpha"
    )
    print(
        f"PASS k-pocha.png:  48x112 RGBA, {pocha_colors} unique colors, "
        f"0 off-palette, 0 #000000, binary alpha"
    )
    print(f"PASS preview_batch6.png: {PREVIEW_PATH}")


if __name__ == "__main__":
    main()
