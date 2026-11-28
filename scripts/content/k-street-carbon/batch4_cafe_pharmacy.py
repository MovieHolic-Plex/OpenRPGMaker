#!/usr/bin/env python3
"""
K-Street Fable-Grade Korean Shops — T1 Batch 4/6
Hand-crafts two original Fable-5.2-grade modern Korean street shopfront buildings:
  1. k-cafe.png     (64x112 RGBA, 4x7 tiles) — Seongsu/Yeonnam specialty bakery cafe (카페)
  2. k-pharmacy.png (48x112 RGBA, 3x7 tiles) — Crisp Korean neighborhood pharmacy (+약국)

Strictly locked to tiledata/jp-city/fable-city/palette.json (0 off-palette, 0 #000000,
binary alpha {0, 255}) and 9x9 Hangul glyphs from tiledata/k-street-carbon/hangul9.json.
"""

from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
PALETTE_PATH = ROOT / "tiledata/jp-city/fable-city/palette.json"
GLYPHS_PATH = ROOT / "tiledata/k-street-carbon/hangul9.json"
SHOPS_DIR = ROOT / "tiledata/k-street-carbon/shops"
PREVIEW_PATH = ROOT / "tiledata/k-street-carbon/preview_batch4.png"


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
                    self.set(x0 + rx, y0 + y_off + ry, fg)


# ---------------------------------------------------------------------------
# Shared Architectural & Rooftop Prop Helpers
# ---------------------------------------------------------------------------

def draw_ac_unit(
    cv: PixelCanvas,
    x0: int,
    y0: int,
    w: int = 13,
    h: int = 13,
    shadow_ramp: str = "concrete",
    shadow_idx: int = 1,
) -> None:
    """3/4 top-view outdoor AC condenser unit with dark fan grille, louvers & cast shadow."""
    x1 = x0 + w - 1
    y1 = y0 + h - 1

    # Diagonal bottom-right cast shadow on roof deck
    for dy in range(2, h + 2):
        cv.hline(x1 + 1, x1 + 3, min(32, y0 + dy), shadow_ramp, shadow_idx)
    cv.hline(x0 + 2, x1 + 3, min(32, y1 + 1), shadow_ramp, shadow_idx)

    # Top metal lid (visible 3/4 top plane, y0..y0+2)
    cv.rect(x0, y0, x1, y0 + 2, "coolwhite", 4)
    cv.hline(x0, x1, y0, "white", 6)
    cv.hline(x0 + 1, x1 - 1, y0 + 2, "coolwhite", 3)

    # Front body (y0+3..y1-1)
    cv.rect(x0, y0 + 3, x1, y1 - 1, "coolwhite", 3)
    cv.vline(x0, y0 + 1, y1 - 1, "white", 5)
    cv.vline(x1, y0 + 1, y1 - 1, "steel", 3)
    cv.hline(x0, x1, y1 - 1, "steel", 2)

    # Circular fan cutout on left side of front face
    fx0, fy0 = x0 + 2, y0 + 4
    fan_r = min(7, h - 6)
    cv.rect(fx0, fy0, fx0 + 6, fy0 + fan_r - 1, "kuro", 1)
    # Corner rounding for circular shroud
    cv.p(fx0, fy0, "coolwhite", 2)
    cv.p(fx0 + 6, fy0, "coolwhite", 2)
    cv.p(fx0, fy0 + fan_r - 1, "coolwhite", 2)
    cv.p(fx0 + 6, fy0 + fan_r - 1, "coolwhite", 2)
    # Fan hub & blades
    cx, cy = fx0 + 3, fy0 + fan_r // 2
    cv.p(cx, cy, "steel", 4)
    cv.p(cx - 1, cy - 1, "steel", 2)
    cv.p(cx + 1, cy - 1, "kuro", 2)
    cv.p(cx - 1, cy + 1, "kuro", 2)
    cv.p(cx + 1, cy + 1, "steel", 2)
    # Horizontal wire guard bars across fan
    for gy in range(fy0 + 1, fy0 + fan_r - 1, 2):
        for gx in range(fx0 + 1, fx0 + 6):
            if (gx + gy) % 2 == 0:
                cv.p(gx, gy, "steel", 3)

    # Right service panel louvers & manufacturer badge
    if w >= 12:
        cv.vline(x0 + 9, y0 + 3, y1 - 2, "steel", 3)
        cv.p(x0 + 10, y0 + 4, "blue", 3)
        cv.p(x0 + 11, y0 + 4, "red", 3)
        for ly in range(y0 + 6, y1 - 2, 2):
            cv.hline(x0 + 10, x1 - 1, ly, "steel", 2)
        # Brass refrigerant valve + insulated pipe stub on right
        cv.p(x1 + 1, y1 - 3, "yellow", 4)
        cv.vline(x1 + 1, y1 - 2, y1, "cream", 4)

    # Rubber mounting feet
    cv.hline(x0 + 1, x0 + 2, y1, "kuro", 1)
    cv.hline(x1 - 2, x1 - 1, y1, "kuro", 1)


def fill_brick_zone(cv: PixelCanvas, x0: int, y0: int, x1: int, y1: int) -> None:
    """Rich Seongsu-dong vintage red-brown exposed brick with staggered mortar joints."""
    brick_tones = [
        ("brick", 2),
        ("brick", 3),
        ("brick", 4),
        ("aka", 3),
        ("aka", 4),
        ("brick", 3),
        ("rooftile", 2),
        ("brick", 5),
    ]
    for y in range(y0, y1 + 1):
        course = (y - y0) // 3
        is_h_mortar = ((y - y0) % 3 == 2)
        offset = 2 if (course % 2 == 1) else 0
        for x in range(x0, x1 + 1):
            if is_h_mortar:
                # Warm aged mortar line
                cv.p(x, y, "stone", 2 if (x + course) % 4 != 0 else 3)
            elif ((x - x0 + offset) % 5 == 4):
                # Vertical head joint
                cv.p(x, y, "stone", 2)
            else:
                brick_id = ((x - x0 + offset) // 5) + course * 7
                ramp, idx = brick_tones[brick_id % len(brick_tones)]
                # Top row of each brick gets subtle sunlight catch
                if (y - y0) % 3 == 0 and idx < 5 and (brick_id % 3 == 0):
                    idx += 1
                cv.p(x, y, ramp, idx)


# ---------------------------------------------------------------------------
# Building 1: k-cafe.png (64 x 112) — Trendy Seongsu/Yeonnam Bakery Cafe (카페)
# ---------------------------------------------------------------------------

def build_k_cafe(pal: Palette, glyphs: dict[str, list[str]]) -> PixelCanvas:
    W, H = 64, 112
    cv = PixelCanvas(W, H, pal, glyphs)

    # =========================================================================
    # TIER 1: ROOFTOP GARDEN TERRACE (y = 0 .. 39, parapet wall-to-wall y = 8..39)
    # =========================================================================
    # Outer concrete & warm stone parapet frame (x = 0..63, y = 8..39)
    cv.rect(0, 8, W - 1, 39, "concrete", 2)
    # North parapet coping (y = 8..11)
    cv.hline(0, W - 1, 8, "concrete", 4)
    cv.hline(1, W - 2, 9, "cream", 5)
    cv.hline(3, W - 4, 10, "concrete", 2)
    cv.hline(3, W - 4, 11, "concrete", 0)  # crisp inner north parapet shadow

    # West & East side parapet walls (x = 0..2, x = 61..63, y = 9..33)
    for y in range(9, 34):
        cv.p(0, y, "concrete", 3)
        cv.p(1, y, "cream", 5 if y % 6 != 0 else 4)
        cv.p(2, y, "concrete", 2)

        cv.p(W - 3, y, "concrete", 3)
        cv.p(W - 2, y, "concrete", 4 if y % 6 != 0 else 3)
        cv.p(W - 1, y, "concrete", 1)

    # Rooftop floor (x = 3..60, y = 12..32):
    # Left/Center (x = 3..39): Warm timber cafe terrace deck planks!
    for y in range(12, 33):
        is_plank_seam = ((y - 12) % 3 == 2)
        for x in range(3, 40):
            if y == 12:
                cv.p(x, y, "darkwood", 1)  # shadow below north parapet
            elif is_plank_seam:
                cv.p(x, y, "wood", 2)
            else:
                plank_row = (y - 12) // 3
                butt_joint = ((x + plank_row * 5) % 11 == 0)
                if butt_joint:
                    cv.p(x, y, "wood", 2)
                else:
                    tone = 4 if ((x // 4 + plank_row) % 2 == 0) else 3
                    cv.p(x, y, "cedar", tone)

    # Wood deck edge trim at x = 40
    cv.vline(40, 12, 32, "wood", 2)
    cv.vline(41, 12, 32, "pavement", 1)

    # Right Zone (x = 42..60, y = 12..32): Smooth architectural concrete terrace slab
    for y in range(12, 33):
        for x in range(42, 61):
            if y == 12:
                cv.p(x, y, "pavement", 1)
            elif y == 22 or x == 51:
                cv.p(x, y, "concrete", 2)  # expansion joint
            else:
                cv.p(x, y, "concrete", 3 if y < 24 else 4)
    # Small roof drainage grate (x = 57..59, y = 29..31)
    cv.rect(57, 29, 59, 31, "steel", 1)
    cv.p(58, 30, "kuro", 0)

    # --- Rooftop Prop A: North-West Tall Cedar Trellis Planter Box w/ Lush Foliage & Flowers ---
    # Planter wooden trough sits snugly against north parapet (x = 4..17, y = 13..18) + cast shadow
    cv.hline(5, 18, 19, "wood", 1)
    cv.rect(4, 14, 17, 18, "wood", 3)
    cv.hline(4, 17, 14, "cedar", 5)
    cv.hline(4, 17, 16, "wood", 2)
    cv.vline(4, 14, 18, "cedar", 4)
    cv.vline(17, 14, 18, "wood", 2)

    # Continuous lush bush & garden tree foliage rising seamlessly from trough (y=13) up above parapet (y=4..13)!
    bush_blobs = [
        (7, 10, 4), (11, 8, 4), (14, 10, 3), (8, 7, 3), (13, 7, 3),
    ]
    for bx, by, br in bush_blobs:
        for dy in range(-br, br + 1):
            for dx in range(-br, br + 1):
                if dx * dx + dy * dy <= br * br + 1:
                    px, py = bx + dx, by + dy
                    if 4 <= px <= 17 and 4 <= py <= 14:
                        if py <= 7 or (dx < 0 and dy < 0):
                            cv.p(px, py, "foliage", 5 if (px + py) % 2 == 0 else 6)
                        elif py <= 11:
                            cv.p(px, py, "foliage", 3 if (px + py) % 2 == 0 else 4)
                        else:
                            cv.p(px, py, "foliage", 2 if py == 12 else 1)
    # Bright rooftop garden flower blossoms (pink, yellow, orange)
    for fx, fy, fr, fi in [
        (6, 7, "pink", 4), (7, 8, "pink", 5),
        (10, 5, "yellow", 5), (11, 6, "orange", 4),
        (14, 7, "pink", 4), (15, 8, "cream", 6),
        (8, 10, "yellow", 4), (12, 10, "orange", 5),
        (6, 12, "pink", 4), (14, 12, "yellow", 5),
    ]:
        cv.p(fx, fy, fr, fi)

    # --- Rooftop Prop B: South-West Planter Trough along Parapet (x = 4..15, y = 24..32) ---
    cv.rect(4, 28, 15, 32, "wood", 3)
    cv.hline(4, 15, 28, "cedar", 5)
    cv.hline(4, 15, 30, "wood", 2)
    cv.hline(16, 17, 30, "wood", 1)
    cv.hline(16, 17, 31, "wood", 1)
    for y in range(24, 29):
        for x in range(4, 16):
            if (x in (4, 15) and y == 24):
                continue
            shade = 5 if y == 24 else (4 if y <= 26 else 2)
            if (x + y) % 3 == 0 and shade < 6:
                shade += 1
            cv.p(x, y, "foliage", shade)
    cv.p(6, 25, "yellow", 5)
    cv.p(10, 25, "pink", 4)
    cv.p(13, 26, "orange", 4)

    # --- Rooftop Prop C: Cream & Sage-Green Cafe Parasol + Bistro Table Set (x = 19..37, y = 2..29) ---
    # Cast shadow on wooden terrace deck under parasol & table
    for y in range(22, 29):
        for x in range(22, 36):
            if (x - 29) * (x - 29) + (y - 25) * (y - 25) * 2 <= 38:
                cv.p(x, y, "wood", 1 if y < 27 else 2)

    # Two small wooden bistro stools (left x=20..22, right x=33..35, y=22..26)
    for sx in (20, 33):
        cv.hline(sx, sx + 2, 22, "cedar", 5)
        cv.hline(sx, sx + 2, 23, "cedar", 3)
        cv.vline(sx, 24, 26, "darkwood", 2)
        cv.vline(sx + 2, 24, 26, "darkwood", 1)

    # Round wooden bistro table (x = 24..31, y = 19..26)
    cv.hline(25, 30, 19, "cedar", 6)
    cv.rect(24, 20, 31, 21, "cedar", 5)
    cv.hline(25, 30, 22, "wood", 3)
    cv.vline(27, 23, 26, "darkwood", 2)
    cv.vline(28, 23, 26, "darkwood", 1)
    cv.hline(26, 29, 26, "darkwood", 2)
    # Two tiny cafe latte cups on table!
    cv.p(25, 19, "white", 6)
    cv.p(26, 19, "orange", 3)
    cv.p(29, 20, "white", 6)

    # Parasol center wooden pole (x = 27..28, y = 13..19)
    cv.vline(27, 13, 19, "wood", 4)
    cv.vline(28, 13, 19, "darkwood", 2)

    # Octagonal Cream & Forest-Sage Striped Cafe Parasol Canopy (x = 19..36, y = 2..13, rises above y=8!)
    canopy_rows = [
        (2, 26, 29),
        (3, 24, 31),
        (4, 22, 33),
        (5, 21, 34),
        (6, 20, 35),
        (7, 19, 36),
        (8, 19, 36),
        (9, 19, 36),
        (10, 19, 36),
        (11, 20, 35),
        (12, 19, 36),  # valance fringe!
    ]
    for cy, cx0, cx1 in canopy_rows:
        for cx in range(cx0, cx1 + 1):
            if cy == 2:
                cv.p(cx, cy, "wood", 4)  # wooden finial cap
                continue
            # Alternating cream & sage-green ribs radiating from x=27.5
            sector = (cx - 19) // 3
            is_green_rib = (sector % 2 == 1)
            if cy == 12:
                # Scalloped valance fringe
                if (cx % 2 == 0):
                    cv.p(cx, cy, "green" if is_green_rib else "cream", 2 if is_green_rib else 3)
                continue
            if is_green_rib:
                tone = 4 if (cy <= 5 and cx < 29) else (3 if cy <= 8 else 2)
                cv.p(cx, cy, "green", tone)
            else:
                tone = 6 if (cy <= 5 and cx < 29) else (5 if cy <= 9 else 3)
                cv.p(cx, cy, "cream", tone)
    # Crisp dark shadow directly under valance (y = 12..13)
    for cx in range(21, 35):
        if cv.px[cx, 12][3] == 0:
            cv.p(cx, 12, "concrete", 0)

    # --- Rooftop Prop D: Compact AC Outdoor Unit on Concrete Slab (x = 44..56, y = 14..26) + Herb Pot ---
    draw_ac_unit(cv, 44, 14, w=13, h=13, shadow_ramp="pavement", shadow_idx=1)
    # Terracotta herb pot beside deck transition (x = 37..40, y = 26..31)
    cv.rect(37, 29, 40, 31, "rooftile", 4)
    cv.vline(40, 29, 31, "rooftile", 2)
    cv.rect(37, 26, 40, 28, "foliage", 4)
    cv.p(38, 25, "foliage", 5)
    cv.p(39, 26, "foliage", 6)

    # South parapet coping & stepped cornice molding (y = 33..39)
    cv.hline(0, W - 1, 33, "concrete", 4)
    cv.hline(0, W - 1, 34, "cream", 6)
    cv.hline(0, W - 1, 35, "cream", 4)
    for jx in (11, 32, 52):
        cv.vline(jx, 33, 35, "concrete", 3)
    # Brick dentil/soldier course cornice band (y = 36..37)
    for x in range(W):
        cv.p(x, 36, "brick", 4 if (x % 2 == 0) else 2)
        cv.p(x, 37, "brick", 2 if (x % 2 == 0) else 1)
    cv.hline(0, W - 1, 38, "stone", 1)
    cv.hline(0, W - 1, 39, "ink", 1)

    # =========================================================================
    # TIER 2: 2F WARM CREAM-PLASTER & EXPOSED BRICK WALL + CAFE SIGNBOARD (y = 40 .. 71)
    # =========================================================================
    # Exposed vintage Seongsu brick pilasters on Left (x = 0..10) and Right (x = 53..63)
    fill_brick_zone(cv, 0, 40, 10, 110)
    fill_brick_zone(cv, 53, 40, 63, 110)
    # Crisp outer building edge bevels so neighboring shops read cleanly
    cv.vline(0, 40, 110, "brick", 4)
    cv.vline(W - 1, 40, 110, "brick", 1)

    # Center recessed Warm Cream-Plaster Facade (x = 11..52, y = 40..71)
    for y in range(40, 72):
        for x in range(11, 53):
            if y == 40:
                cv.p(x, y, "cream", 1)  # deep cornice cast shadow
            elif y == 41:
                cv.p(x, y, "cream", 3)
            elif x == 11:
                cv.p(x, y, "cream", 2)  # brick pilaster reveal shadow
            elif x == 52:
                cv.p(x, y, "cream", 3)
            else:
                # Subtle warm stucco variation
                base = 5 if y < 56 else 4
                if (x * 7 + y * 13) % 19 == 0:
                    cv.p(x, y, "kinari", 4)
                elif (x * 11 + y * 5) % 23 == 0:
                    cv.p(x, y, "cream", base + 1 if base < 6 else 6)
                else:
                    cv.p(x, y, "cream", base)

    # --- Two Large Warm-Lit Mullioned 2F Cafe Loft Windows (x=13..29 & x=34..50, y=43..55) ---
    for wx0, wx1 in ((13, 29), (34, 50)):
        # Recessed plaster reveal + dark forest-bronze steel frame
        cv.hline(wx0, wx1, 42, "cream", 2)
        cv.box(wx0, 43, wx1, 55, "kuro", 1, "wood", 2)
        # Warm golden cafe upstairs ceiling & wall glow
        for wy in range(44, 55):
            for wx in range(wx0 + 1, wx1):
                if wy <= 46:
                    cv.p(wx, wy, "yellow", 4 if wy == 45 else 3)
                elif wy <= 50:
                    cv.p(wx, wy, "orange", 4 if (wx + wy) % 3 == 0 else 3)
                else:
                    cv.p(wx, wy, "wood", 3 if wy < 53 else 2)

        # Hanging warm Edison pendant bulbs inside 2F window
        for px in (wx0 + 4, wx1 - 4):
            cv.vline(px, 44, 45, "kuro", 1)
            cv.p(px, 46, "cream", 6)
            cv.p(px, 47, "yellow", 5)
            cv.p(px - 1, 46, "yellow", 4)
            cv.p(px + 1, 46, "yellow", 4)

        # Interior silhouette details: potted monstera plant on one side & cafe table/books
        cv.rect(wx0 + 2, 50, wx0 + 4, 53, "foliage", 3)
        cv.p(wx0 + 3, 49, "foliage", 5)
        cv.hline(wx1 - 6, wx1 - 2, 52, "cedar", 4)
        cv.p(wx1 - 4, 51, "white", 6)

        # Crisp steel window mullions (3 vertical panes + upper transom bar)
        cv.hline(wx0 + 1, wx1 - 1, 48, "kuro", 1)
        cv.vline(wx0 + 6, 44, 54, "kuro", 1)
        cv.vline(wx0 + 11, 44, 54, "kuro", 1)

        # Subtle glass sky reflection streak on top-left pane
        cv.p(wx0 + 2, 45, "cream", 6)
        cv.p(wx0 + 3, 46, "yellow", 5)

        # Wooden window-box planter & cascading trailing ivy (y = 55..59)
        cv.rect(wx0, 56, wx1, 57, "wood", 3)
        cv.hline(wx0, wx1, 56, "cedar", 4)
        for ix in range(wx0, wx1 + 1):
            cv.p(ix, 55, "foliage", 4 if ix % 2 == 0 else 5)
            if ix % 3 == 0:
                cv.p(ix, 54, "foliage", 6)
        # Tiny flowers in window box
        cv.p(wx0 + 3, 55, "pink", 4)
        cv.p(wx0 + 9, 55, "yellow", 5)
        cv.p(wx1 - 3, 55, "orange", 4)

    # Trailing ivy vines cascading down plaster & brick edges (x=11..13 and x=50..52, y=56..66)
    for vx, vy_end in ((12, 65), (13, 62), (50, 63), (51, 66)):
        for vy in range(56, vy_end + 1):
            if (vx + vy) % 2 == 0:
                cv.p(vx, vy, "foliage", 3 if vy > 60 else 4)
            elif vy < vy_end:
                cv.p(vx, vy, "green", 2)

    # Center pier vintage brass sconce lamp between 2F windows (x = 31..32, y = 46..51)
    cv.rect(31, 46, 32, 47, "kuro", 1)
    cv.rect(31, 48, 32, 50, "yellow", 5)
    cv.p(31, 48, "white", 6)
    cv.hline(31, 32, 51, "orange", 3)

    # --- Sleek Minimalist Dark-Green & Walnut Wood Signboard `카페` (x = 14..49, y = 59..71) ---
    # Overhead gooseneck brass sign lamps (x = 22, x = 41, y = 58)
    for lx in (22, 41):
        cv.p(lx, 58, "kuro", 1)
        cv.hline(lx - 1, lx + 1, 59, "yellow", 5)

    # Cast shadow beneath signboard (x = 15..50, y = 71)
    cv.hline(15, 50, 71, "stone", 0)
    # Outer walnut/cedar wood frame (x = 14..49, y = 59..70)
    cv.rect(14, 59, 49, 70, "wood", 3)
    cv.hline(14, 49, 59, "cedar", 5)
    cv.hline(14, 49, 70, "darkwood", 1)
    cv.vline(14, 59, 70, "cedar", 4)
    cv.vline(49, 59, 70, "darkwood", 2)
    # Brass corner rivets
    for rx, ry in ((15, 60), (48, 60), (15, 69), (48, 69)):
        cv.p(rx, ry, "yellow", 4)

    # Deep matte forest-green signboard face (x = 15..48, y = 60..69)
    for sy in range(60, 70):
        for sx in range(15, 49):
            if sy == 60:
                # Subtle warm spotlight wash under lamps
                in_cone = abs(sx - 22) <= 3 or abs(sx - 41) <= 3
                cv.p(sx, sy, "green", 2 if in_cone else 0)
            elif sy <= 63:
                cv.p(sx, sy, "green", 1)
            else:
                cv.p(sx, sy, "foliage", 0 if sy >= 68 else 1)

    # Left Signboard Emblem: Pixel-art steaming coffee cup (x = 17..22, y = 61..68)
    cv.p(18, 61, "cream", 4)  # steam wisps
    cv.p(20, 61, "cream", 5)
    cv.p(19, 62, "cream", 4)
    cv.rect(17, 64, 20, 67, "cream", 6)  # cup body
    cv.vline(20, 64, 67, "cream", 4)
    cv.p(21, 65, "cream", 5)  # cup handle
    cv.p(21, 66, "cream", 4)
    cv.hline(16, 21, 68, "cedar", 5)  # wooden saucer

    # Crisp 9x9 Korean Hangul `카` (x=25, y=60) and `페` (x=36, y=60) from hangul9.json!
    # 2px breathing gap between syllables so both read effortlessly at 1x!
    fg_cafe = pal.c("cream", 6)
    sh_cafe = pal.c("ink", 0)
    cv.draw_glyph("카", 25, 60, fg_cafe, sh_cafe)
    cv.draw_glyph("페", 36, 60, fg_cafe, sh_cafe)

    # Right Signboard Accent: Roasted coffee bean & gold dot (x = 46..47, y = 63..66)
    cv.rect(46, 63, 47, 65, "cedar", 5)
    cv.p(46, 63, "yellow", 5)
    cv.p(47, 65, "wood", 3)

    # =========================================================================
    # TIER 3: 1F LIVING CAFE STOREFRONT (y = 72 .. 111)
    # =========================================================================
    # Base 1F warm cream-plaster & timber backing across x = 11..52, y = 72..109 (no gaps!)
    for y in range(72, 110):
        for x in range(11, 53):
            cv.p(x, y, "cream", 3 if (x == 41 and y < 98) else 4)
    cv.vline(41, 74, 109, "wood", 2)  # crisp timber mullion pier between window & door

    # Storefront timber lintel beam across x = 3..60, y = 72..73
    cv.hline(3, 60, 72, "darkwood", 2)
    cv.hline(3, 60, 73, "wood", 3)

    # --- LEFT/CENTER BAY (x = 2..41): Striped Awning + Wide Glowing Pastry/Espresso Window ---
    # Stylish Cream & Forest-Green Striped Sloped Awning (x = 2..41, y = 73..81)
    for ay in range(73, 81):
        dy = ay - 73
        for ax in range(2, 42):
            # Slight perspective taper at outer ends on upper slope
            stripe = ((ax - 2) // 4) % 2
            is_green = (stripe == 0)
            if ay <= 78:
                # Sloped top fabric plane
                if is_green:
                    tone = 4 if dy == 0 else (3 if dy <= 2 else 2)
                    if (ax - 2) % 4 == 0 and tone < 4:
                        tone += 1
                    cv.p(ax, ay, "green", tone)
                else:
                    tone = 6 if dy <= 1 else (5 if dy <= 3 else 4)
                    if (ax - 2) % 4 == 3:
                        tone -= 1
                    cv.p(ax, ay, "cream", tone)
            elif ay == 79:
                # Crisp front fold highlight/crease
                cv.p(ax, ay, "green" if is_green else "cream", 1 if is_green else 3)
            else:
                # Scalloped valance fringe at y = 80
                in_scallop = ((ax - 2) % 4 in (0, 1, 2))
                if in_scallop:
                    cv.p(ax, ay, "green" if is_green else "cream", 2 if is_green else 5)
                else:
                    cv.p(ax, ay, "darkwood", 0)

    # Deep crisp cast shadow beneath awning valance (x = 3..41, y = 81..82)
    cv.hline(3, 41, 81, "darkwood", 0)
    cv.hline(3, 41, 82, "darkwood", 1)

    # Wide Wood-Framed Bakery & Espresso Display Window (x = 4..40, y = 82..102)
    cv.rect(4, 82, 40, 102, "wood", 3)
    cv.hline(4, 40, 82, "wood", 2)
    cv.hline(4, 40, 102, "cedar", 5)  # sunlit wooden window sill!
    cv.vline(4, 82, 102, "cedar", 4)
    cv.vline(40, 82, 102, "wood", 2)

    # Cozy warm cafe interior backdrop (x = 5..39, y = 83..100)
    for wy in range(83, 101):
        for wx in range(5, 40):
            if wy <= 85:
                cv.p(wx, wy, "wood", 2)
            elif wy <= 92:
                cv.p(wx, wy, "wood", 3 if (wx + wy) % 5 != 0 else 4)
            else:
                cv.p(wx, wy, "darkwood", 2)

    # Back-wall menu chalkboard inside cafe (x = 16..27, y = 84..88)
    cv.rect(16, 84, 27, 88, "kuro", 1)
    cv.hline(17, 21, 85, "cream", 5)
    cv.hline(17, 25, 87, "yellow", 4)

    # 3 Warm Hanging Brass Cone Pendant Lamps inside 1F window (x = 10, 23, 33)
    for px in (10, 23, 33):
        cv.vline(px, 83, 84, "kuro", 1)
        cv.p(px, 85, "yellow", 4)
        cv.hline(px - 1, px + 1, 86, "orange", 4)
        cv.p(px, 86, "yellow", 5)
        cv.p(px, 87, "white", 6)  # glowing warm bulb tip peeking beneath cone shade!

    # --- Inside Left (x = 6..16, y = 89..99): Gleaming Italian Espresso Machine & Grinder ---
    # Wooden barista counter (x = 5..39, y = 98..100)
    cv.hline(5, 39, 98, "cedar", 5)
    cv.rect(5, 99, 39, 100, "wood", 3)

    # Chromed 2-Group Espresso Machine (x = 6..13, y = 90..97)
    cv.hline(7, 12, 89, "white", 6)  # stacked white ceramic espresso cups on cup-warmer!
    cv.p(9, 89, "steel", 4)
    cv.rect(6, 90, 13, 97, "steel", 4)
    cv.hline(6, 13, 90, "coolwhite", 5)
    cv.vline(6, 90, 97, "white", 5)
    cv.vline(13, 90, 97, "steel", 2)
    # Recessed brew area + portafilters + pressure gauge
    cv.rect(7, 93, 12, 96, "kuro", 1)
    cv.p(8, 91, "red", 3)      # pressure gauge dial
    cv.p(11, 91, "green", 3)   # power indicator
    cv.p(8, 94, "steel", 5)    # group head 1
    cv.p(9, 94, "darkwood", 1) # portafilter handle 1
    cv.p(11, 94, "steel", 5)   # group head 2
    cv.p(12, 94, "darkwood", 1)
    cv.p(8, 96, "white", 6)    # tiny demitasse cup pulling shot!
    cv.p(11, 96, "white", 6)
    cv.hline(7, 12, 97, "steel", 3)  # drip tray

    # Black Burr Coffee Grinder beside machine (x = 14..16, y = 90..97)
    cv.rect(14, 90, 16, 92, "glass", 4)  # clear bean hopper
    cv.hline(14, 16, 91, "wood", 2)      # roasted coffee beans inside hopper!
    cv.rect(14, 93, 16, 97, "kuro", 2)
    cv.p(15, 95, "orange", 4)

    # --- Inside Center/Right (x = 18..38, y = 89..98): Illuminated Glass Bakery Pastry Case ---
    cv.box(18, 89, 38, 98, "steel", 4, "yellow", 2)
    cv.hline(18, 38, 89, "white", 6)     # top glass edge LED strip
    cv.hline(19, 37, 93, "coolwhite", 5) # middle glass shelf

    # Top pastry shelf (y = 90..92): Golden Croissants & Berry Tarts!
    # Croissant 1 (x=20..22)
    cv.hline(20, 22, 91, "orange", 4)
    cv.p(21, 90, "yellow", 5)
    cv.p(20, 92, "cedar", 5)
    cv.p(22, 92, "cedar", 5)
    # Croissant 2 (x=24..26)
    cv.hline(24, 26, 91, "orange", 4)
    cv.p(25, 90, "yellow", 5)
    cv.p(24, 92, "orange", 3)
    cv.p(26, 92, "orange", 3)
    # Berry tarts (x=28..31)
    cv.hline(28, 31, 92, "cedar", 5)
    cv.p(28, 91, "red", 3)
    cv.p(29, 91, "cream", 6)
    cv.p(30, 91, "red", 4)
    cv.p(31, 91, "pink", 4)
    # Brioche / canele loaves (x=33..36)
    cv.rect(33, 90, 34, 92, "orange", 3)
    cv.p(33, 90, "yellow", 4)
    cv.rect(35, 91, 36, 92, "wood", 4)
    cv.p(36, 90, "orange", 4)

    # Bottom pastry shelf (y = 94..97): Strawberry Shortcakes & Basque Cheesecake!
    # Whole strawberry cream cake (x=20..24, y=95..97)
    cv.rect(20, 95, 24, 97, "cream", 6)
    cv.hline(20, 24, 96, "pink", 4)
    cv.p(21, 94, "red", 3)
    cv.p(23, 94, "red", 4)
    # Chocolate ganache cake (x=26..29, y=95..97)
    cv.rect(26, 95, 29, 97, "wood", 2)
    cv.hline(26, 29, 95, "cedar", 4)
    cv.p(27, 94, "orange", 4)
    # Basque cheesecake & matcha roll (x=31..36, y=95..97)
    cv.rect(31, 95, 33, 97, "yellow", 4)
    cv.hline(31, 33, 95, "orange", 3)
    cv.rect(35, 95, 37, 97, "green", 4)
    cv.p(36, 96, "cream", 6)

    # Window mullion divider at x = 22 + crisp diagonal glass reflections
    cv.vline(17, 83, 101, "wood", 3)
    for d in range(4):
        cv.p(6 + d, 84 + d, "cream", 6 if d < 2 else 5)
        cv.p(35 + d, 84 + d, "glass", 5 if d < 2 else 4)

    # Lower Cafe Timber Wainscoting Dado Wall (x = 4..40, y = 103..109)
    cv.rect(4, 103, 40, 109, "wood", 2)
    for bx in (6, 15, 24, 33):
        cv.box(bx, 104, bx + 6, 108, "wood", 3, "cedar", 3)
        cv.hline(bx + 1, bx + 5, 104, "cedar", 4)

    # --- RIGHT BAY (x = 42..57): Warm Wood-Framed Glass Cafe Entrance Door ---
    # Recessed doorway surround (x = 42..57, y = 74..110)
    cv.rect(42, 74, 57, 110, "darkwood", 1)
    cv.box(43, 75, 56, 110, "wood", 4, "wood", 3)
    cv.hline(43, 56, 75, "cedar", 5)

    # Overhead warm-lit transom window (x = 45..54, y = 76..79)
    cv.rect(45, 76, 54, 79, "kuro", 1)
    cv.rect(46, 77, 53, 78, "yellow", 4)
    cv.hline(48, 51, 77, "cream", 6)

    # Handcrafted walnut/cedar door leaf (x = 45..54, y = 81..108)
    cv.rect(45, 81, 54, 108, "wood", 3)
    cv.vline(45, 81, 108, "cedar", 4)
    cv.hline(45, 54, 81, "cedar", 4)

    # Door upper glass window (x = 47..52, y = 83..95)
    cv.box(46, 82, 53, 96, "darkwood", 2, "wood", 2)
    for dy in range(83, 96):
        for dx in range(47, 53):
            cv.p(dx, dy, "orange" if dy < 90 else "wood", 3 if dy < 90 else 3)
    # Hanging wooden `OPEN` sign inside door glass!
    cv.p(49, 85, "red", 3)
    cv.p(50, 85, "red", 3)
    cv.rect(48, 86, 51, 88, "cream", 6)
    cv.hline(48, 51, 87, "green", 2)
    # Diagonal glass highlight on door pane
    cv.p(47, 84, "cream", 6)
    cv.p(48, 85, "yellow", 5)

    # Brass vertical door pull handle (x = 46, y = 94..99) + lower carved panel
    cv.vline(46, 94, 99, "yellow", 5)
    cv.p(46, 99, "orange", 4)
    cv.box(47, 99, 52, 106, "darkwood", 2, "cedar", 3)

    # Warm brass lantern sconce on right brick pilaster (x = 59..61, y = 78..83)
    cv.hline(58, 60, 78, "kuro", 1)
    cv.rect(59, 79, 61, 82, "yellow", 5)
    cv.p(60, 80, "white", 6)
    cv.hline(59, 61, 83, "kuro", 2)

    # --- CURBSIDE PROPS & SIDEWALK PLINTH (y = 95 .. 111) ---
    # Grounded stone/pavement sidewalk base across entire 64px width (y = 110..111)
    cv.hline(0, W - 1, 110, "stone", 2)
    cv.hline(0, W - 1, 111, "pavement", 1)
    # Terracotta tiled cafe entrance step & coir mat (x = 42..57, y = 109..111)
    cv.hline(42, 57, 109, "rooftile", 4)
    cv.hline(42, 57, 110, "rooftile", 3)
    cv.hline(46, 53, 109, "straw", 3)  # warm woven welcome mat
    cv.hline(42, 57, 111, "pavement", 2)

    # Curbside Prop 1 (Left, x = 2..9, y = 95..111): Terracotta Pot w/ Lush Olive Tree!
    # Cast shadow
    cv.hline(8, 11, 110, "pavement", 0)
    # Terracotta pot (x = 3..8, y = 105..110)
    cv.hline(2, 9, 105, "rooftile", 5)
    cv.rect(3, 106, 8, 110, "rooftile", 4)
    cv.vline(3, 106, 110, "rooftile", 5)
    cv.vline(8, 106, 110, "brick", 2)
    cv.hline(4, 7, 105, "soil", 1)
    # Slender olive trunk (x = 5..6, y = 101..104)
    cv.vline(5, 101, 104, "wood", 4)
    cv.vline(6, 102, 104, "wood", 2)
    # Silvery-sage Mediterranean olive foliage crown (x = 2..9, y = 94..101)
    for oy in range(94, 102):
        for ox in range(2, 10):
            dx = ox - 5.5
            dy = oy - 97.5
            if dx * dx + dy * dy <= 13:
                if dy < -1 or (dx < 0 and dy <= 0):
                    cv.p(ox, oy, "midori", 6 if (ox + oy) % 2 == 0 else 5)
                elif dy <= 1:
                    cv.p(ox, oy, "midori", 4 if (ox + oy) % 2 == 0 else 3)
                else:
                    cv.p(ox, oy, "foliage", 2)
    # Tiny green/gold olives
    cv.p(4, 97, "moss", 5)
    cv.p(7, 98, "moss", 4)

    # Curbside Prop 2 (Center-Right, x = 34..41, y = 98..111): Wooden A-Frame Chalkboard Menu!
    cv.hline(35, 42, 110, "pavement", 0)  # shadow
    # Back support leg
    cv.vline(41, 101, 110, "wood", 2)
    # Cedar A-frame board (x = 34..40, y = 98..110)
    cv.rect(34, 98, 40, 108, "cedar", 4)
    cv.hline(34, 40, 98, "cedar", 6)
    cv.vline(34, 98, 110, "cedar", 5)
    cv.vline(40, 98, 110, "wood", 3)
    cv.p(34, 109, "cedar", 4)
    cv.p(34, 110, "wood", 3)
    cv.p(40, 109, "wood", 3)
    cv.p(40, 110, "darkwood", 2)
    # Dark slate chalkboard insert (x = 35..39, y = 100..107)
    cv.rect(35, 100, 39, 107, "kuro", 1)
    # Tiny chalk coffee cup illustration & menu lines!
    cv.hline(36, 38, 101, "cream", 6)
    cv.hline(36, 37, 102, "orange", 4)
    cv.p(38, 102, "cream", 5)
    cv.hline(36, 38, 104, "yellow", 4)
    cv.hline(36, 38, 106, "cream", 4)

    return cv


# ---------------------------------------------------------------------------
# Building 2: k-pharmacy.png (48 x 112) — Crisp Korean Neighborhood Pharmacy (+약국)
# ---------------------------------------------------------------------------

def build_k_pharmacy(pal: Palette, glyphs: dict[str, list[str]]) -> PixelCanvas:
    W, H = 48, 112
    cv = PixelCanvas(W, H, pal, glyphs)

    # =========================================================================
    # TIER 1: FLAT COOL-WHITE PARAPET ROOF W/ GREEN WATERPROOFING (y = 0 .. 39)
    # =========================================================================
    # Full-width cool-white parapet shell (x = 0..47, y = 8..39)
    cv.rect(0, 8, W - 1, 39, "coolwhite", 2)
    # North parapet coping (y = 8..11)
    cv.hline(0, W - 1, 8, "coolwhite", 4)
    cv.hline(1, W - 2, 9, "white", 6)
    cv.hline(3, W - 4, 10, "coolwhite", 2)
    cv.hline(3, W - 4, 11, "coolwhite", 0)  # north parapet inner shadow

    # West & East parapet walls (x = 0..2, x = 45..47, y = 9..33)
    for y in range(9, 34):
        cv.p(0, y, "coolwhite", 3)
        cv.p(1, y, "white", 6 if y % 8 != 0 else 5)
        cv.p(2, y, "coolwhite", 3)

        cv.p(W - 3, y, "coolwhite", 3)
        cv.p(W - 2, y, "white", 5 if y % 8 != 0 else 4)
        cv.p(W - 1, y, "coolwhite", 1)

    # Korean Green Urethane Waterproofed Roof Slab (x = 3..44, y = 12..32)
    for y in range(12, 33):
        for x in range(3, 45):
            if y == 12:
                cv.p(x, y, "green", 0)  # sharp parapet cast shadow
            elif y == 13:
                cv.p(x, y, "green", 1)
            elif y == 22 or x in (17, 31):
                # Urethane expansion joint seams
                cv.p(x, y, "teal", 1 if y < 22 else 2)
            else:
                # Subtle sunlit urethane sheen gradient
                if y >= 29 and 6 <= x <= 38:
                    cv.p(x, y, "green", 3 if (x + y) % 5 != 0 else 4)
                elif y >= 20:
                    cv.p(x, y, "green", 2 if (x + y) % 7 != 0 else 3)
                else:
                    cv.p(x, y, "teal", 2 if (x + y) % 4 == 0 else 1)
                    if (x + y) % 3 != 0:
                        cv.p(x, y, "green", 2)

    # Subtle moss/weathered urethane edge shading along parapet perimeter
    cv.hline(4, 26, 31, "moss", 3)
    cv.hline(4, 18, 32, "moss", 2)
    cv.hline(30, 43, 31, "moss", 4)

    # Diagonal parapet shadow cast from North-West corner (top-left light feel / depth)
    for d in range(6):
        cv.hline(3, 8 - d, 13 + d, "green", 1)

    # Roof drain strainer in SW corner (x = 5..7, y = 29..31)
    cv.rect(5, 29, 7, 31, "steel", 2)
    cv.p(6, 30, "kuro", 1)

    # --- Rooftop Prop A: Stainless Vent Pipe Rising Above North Parapet (x = 9..15, y = 2..24) ---
    # Crisp diagonal cast shadow of pipe across green roof slab!
    for s in range(8):
        cv.hline(12 + s, 14 + s, 23 + (s // 2), "green", 0 if s < 5 else 1)

    # Base flange on roof deck (x = 10..14, y = 22..24)
    cv.rect(10, 22, 14, 24, "steel", 3)
    cv.hline(10, 14, 22, "steel", 5)
    cv.hline(10, 14, 24, "steel", 1)
    # Vertical brushed-silver vent pipe (x = 11..13, y = 4..21)
    for y in range(4, 22):
        cv.p(11, y, "white", 6 if y < 12 else 5)
        cv.p(12, y, "steel", 5)
        cv.p(13, y, "steel", 2)
    # Weatherproof H-cowl / turbine cap at top (x = 9..15, y = 2..5)
    cv.hline(10, 14, 2, "white", 6)
    cv.hline(9, 15, 3, "steel", 5)
    cv.hline(9, 15, 4, "steel", 2)
    cv.p(9, 2, "steel", 4)
    cv.p(15, 2, "steel", 3)

    # Small rooftop electrical conduit box (x = 19..22, y = 16..20)
    cv.rect(19, 16, 22, 20, "coolwhite", 4)
    cv.hline(19, 22, 16, "white", 6)
    cv.vline(22, 16, 20, "steel", 2)
    cv.hline(20, 23, 21, "green", 0)  # shadow
    cv.hline(23, 27, 19, "steel", 3)  # conduit to AC unit

    # --- Rooftop Prop B: Silver AC Outdoor Unit w/ Diagonal Shadow (x = 28..40, y = 15..27) ---
    draw_ac_unit(cv, 28, 15, w=13, h=13, shadow_ramp="green", shadow_idx=0)

    # South parapet coping & clean modern clinic cornice (y = 33..39)
    cv.hline(0, W - 1, 33, "coolwhite", 4)
    cv.hline(0, W - 1, 34, "white", 6)
    cv.hline(0, W - 1, 35, "coolwhite", 5)
    for jx in (12, 24, 36):
        cv.vline(jx, 33, 35, "coolwhite", 3)
        cv.vline(jx, 8, 9, "coolwhite", 3)
    # Emerald accent trim line in cornice!
    cv.hline(0, W - 1, 36, "green", 3)
    cv.hline(0, W - 1, 37, "coolwhite", 3)
    cv.hline(0, W - 1, 38, "coolwhite", 1)
    cv.hline(0, W - 1, 39, "concrete", 0)

    # =========================================================================
    # TIER 2: 2F PORCELAIN-TILED CLINIC WALL + `+약국` SIGNBOARD (y = 40 .. 72)
    # =========================================================================
    # Crisp cool-white porcelain tile grid (x = 0..47, y = 40..71)
    for y in range(40, 72):
        is_h_grout = ((y - 40) % 4 == 3)
        for x in range(W):
            is_v_grout = (x % 6 == 5)
            if y == 40:
                cv.p(x, y, "coolwhite", 1)  # cornice overhang shadow
            elif x == 0:
                cv.p(x, y, "white", 6)      # crisp sunlit left edge
            elif x == W - 1:
                cv.p(x, y, "coolwhite", 2)  # crisp right edge
            elif is_h_grout or is_v_grout:
                cv.p(x, y, "coolwhite", 3)
            else:
                tile_col = (x // 6 + (y - 40) // 4) % 3
                if tile_col == 0:
                    cv.p(x, y, "white", 6)
                elif tile_col == 1:
                    cv.p(x, y, "coolwhite", 5)
                else:
                    cv.p(x, y, "white", 5)

    # Clean silver rainwater downpipe on right edge (x = 44..45, y = 40..57)
    for y in range(40, 58):
        cv.p(44, y, "white", 5)
        cv.p(45, y, "coolwhite", 2)
    for by in (43, 50, 56):
        cv.hline(43, 46, by, "steel", 3)

    # --- 2F Blue-Tinted Aluminum Sliding Clinic Window (x = 5..40, y = 43..55) ---
    # Aluminum outer frame + projecting sill
    cv.box(5, 43, 40, 55, "steel", 4, "glass", 1)
    cv.hline(5, 40, 43, "coolwhite", 5)
    cv.hline(4, 41, 55, "white", 6)
    cv.hline(4, 41, 56, "coolwhite", 2)  # sill cast shadow

    # 3 Sliding Panes: Left (x=6..16), Center (x=18..27), Right (x=29..39)
    for px0, px1 in ((6, 16), (18, 27), (29, 39)):
        for wy in range(44, 55):
            for wx in range(px0, px1 + 1):
                if wy <= 46:
                    cv.p(wx, wy, "glass", 3)
                elif wy <= 50:
                    cv.p(wx, wy, "glass", 2)
                else:
                    cv.p(wx, wy, "blue", 1 if wy >= 53 else 2)

    # Crisp clean vertical clinic blinds in upper half of left & right panes
    for px0, px1 in ((6, 16), (29, 39)):
        for wy in range(44, 49):
            for wx in range(px0, px1 + 1):
                cv.p(wx, wy, "coolwhite" if wx % 2 == 0 else "glass", 5 if wx % 2 == 0 else 4)
        cv.hline(px0, px1, 49, "white", 6)  # blind bottom rail

    # Neat white pharmaceutical supply cartons visible in center pane (x=19..26, y=50..54)
    cv.rect(19, 51, 22, 54, "white", 5)
    cv.hline(19, 22, 52, "green", 3)
    cv.rect(23, 50, 26, 54, "coolwhite", 4)
    cv.hline(23, 26, 51, "blue", 3)

    # Small green safety cross decal in left pane + diagonal sky reflections
    cv.p(11, 51, "green", 4)
    cv.hline(10, 12, 52, "green", 4)
    cv.p(11, 53, "green", 4)
    for d in range(4):
        cv.p(7 + d, 50 + d, "glass", 6 if d < 2 else 5)
        cv.p(19 + d, 45 + d, "glass", 6 if d < 2 else 5)
        cv.p(34 + d, 50 + d, "glass", 5)

    # Aluminum vertical sliding mullions (x = 17, x = 28)
    cv.vline(17, 44, 54, "steel", 5)
    cv.vline(28, 44, 54, "steel", 5)

    # --- Bold Bright Emerald-Green & White Signboard `+약국` (x = 1..46, y = 58..71) ---
    # Crisp pearl-white outer signboard frame (x = 1..46, y = 58..70)
    cv.rect(1, 58, 46, 70, "white", 6)
    cv.hline(1, 46, 70, "coolwhite", 3)
    cv.vline(46, 58, 70, "coolwhite", 4)
    # Deep cast shadow under signboard onto 1F lintel (y = 71..72)
    cv.hline(0, W - 1, 71, "tile", 0)
    cv.hline(0, W - 1, 72, "coolwhite", 1)

    # Vibrant emerald-green backlit fascia face (x = 2..45, y = 59..69)
    for sy in range(59, 70):
        for sx in range(2, 46):
            if sy == 59:
                cv.p(sx, sy, "green", 4)  # bright LED top edge glow
            elif sy <= 63:
                cv.p(sx, sy, "green", 3)
            elif sy <= 67:
                cv.p(sx, sy, "green", 2)
            else:
                cv.p(sx, sy, "teal", 1)

    # Left Medical Cross Badge (x = 3..13, y = 60..68): Crisp white plaque + orthogonal Greek `+`!
    cv.rect(3, 60, 13, 68, "white", 6)
    cv.hline(3, 13, 68, "coolwhite", 4)
    # Draw `+` from hangul9.json centered at (4, 60), widened orthogonally (3px arms, NO diamond corners!)
    cv.draw_glyph("+", 4, 60, pal.c("green", 3), None)
    cv.rect(7, 61, 9, 67, "green", 3)   # vertical 3x7 arm
    cv.rect(5, 63, 11, 65, "green", 3)  # horizontal 7x3 arm
    cv.hline(7, 9, 61, "green", 4)      # crisp sunlit top bevel on cross
    cv.hline(5, 6, 63, "green", 4)
    cv.hline(10, 11, 63, "green", 4)
    cv.p(8, 64, "white", 6)             # bright medical center pip

    # Bold White `약` (x = 16, y = 60) and `국` (x = 27, y = 60) from hangul9.json!
    fg_pharm = pal.c("white", 6)
    sh_pharm = pal.c("green", 0)
    cv.draw_glyph("약", 16, 60, fg_pharm, sh_pharm)
    cv.draw_glyph("국", 27, 60, fg_pharm, sh_pharm)

    # Right Rounded Capsule Pill Emblem on signboard (x = 40..42, y = 61..67): red/white capsule!
    cv.p(41, 61, "red", 4)              # rounded top cap
    cv.rect(40, 62, 42, 63, "red", 4)   # upper red capsule half
    cv.p(40, 62, "pink", 5)             # glossy specular highlight
    cv.rect(40, 64, 42, 66, "white", 6) # lower white capsule half
    cv.vline(42, 64, 66, "coolwhite", 4)
    cv.p(41, 67, "coolwhite", 5)        # rounded bottom cap

    # =========================================================================
    # TIER 3: 1F BRIGHT AUTOMATIC DOOR & MEDICINE DISPLAY STOREFRONT (y = 73 .. 111)
    # =========================================================================
    # Clean porcelain & silver aluminum 1F storefront framing (x = 0..47, y = 73..110)
    cv.rect(0, 73, W - 1, 110, "coolwhite", 4)
    cv.vline(0, 73, 110, "white", 6)
    cv.vline(W - 1, 73, 110, "coolwhite", 2)
    # Crisp emerald-and-silver architectural header band (y = 73..76)
    cv.hline(1, W - 2, 73, "white", 6)
    cv.hline(1, W - 2, 74, "green", 3)
    cv.hline(1, W - 2, 75, "coolwhite", 5)
    cv.hline(1, W - 2, 76, "steel", 3)

    # --- LEFT BAY (x = 3..18, y = 77..109): Clean Automatic Glass Entrance Door ---
    # Overhead black automatic sensor housing (x = 5..16, y = 77..78)
    cv.rect(5, 77, 16, 78, "kuro", 1)
    cv.p(10, 77, "green", 4)  # active motion sensor LED
    cv.p(11, 77, "teal", 4)

    # Anodized silver aluminum door frame (x = 3..18, y = 79..108)
    cv.box(3, 79, 18, 108, "steel", 4, "glass", 2)
    cv.vline(3, 79, 108, "white", 5)
    cv.vline(18, 79, 108, "steel", 2)
    cv.box(4, 80, 17, 107, "coolwhite", 5, "glass", 1)

    # Bright interior clinic floor & light glimpsed through glass door (x = 5..16, y = 81..105)
    for dy in range(81, 106):
        for dx in range(5, 17):
            if dy <= 83:
                cv.p(dx, dy, "glass", 5 if dy == 81 else 4)  # bright ceiling glow
            elif dy <= 96:
                cv.p(dx, dy, "glass", 2 if (dx + dy) % 6 != 0 else 3)
            else:
                cv.p(dx, dy, "teal", 2 if dy < 102 else 3)

    # Crisp diagonal glass door reflection streaks!
    for d in range(6):
        cv.p(6 + d, 83 + d, "white", 6 if d < 3 else 5)
        cv.p(7 + d, 83 + d, "glass", 6)
    for d in range(4):
        cv.p(8 + d, 98 + d, "glass", 5)

    # Automatic door horizontal safety decal band (y = 93..94) + emerald dot
    cv.hline(5, 16, 93, "white", 6)
    cv.hline(5, 16, 94, "green", 3)
    # Stainless vertical pull handle (x = 15, y = 90..96) & kickplate (y = 105..107)
    cv.vline(15, 90, 96, "white", 6)
    cv.rect(5, 105, 16, 107, "steel", 4)

    # Clean tiled entrance step in front of door (x = 2..19, y = 108..111)
    cv.hline(2, 19, 108, "white", 6)
    cv.hline(2, 19, 109, "coolwhite", 4)
    cv.hline(2, 19, 110, "coolwhite", 3)
    for sx in (6, 10, 14):
        cv.vline(sx, 108, 110, "coolwhite", 2)

    # Small illuminated `처방` / Green Cross plaque on center pier (x = 19..20, y = 82..86)
    cv.rect(19, 82, 20, 86, "green", 3)
    cv.p(19, 84, "white", 6)
    cv.p(20, 84, "white", 6)

    # --- RIGHT BAY (x = 21..45, y = 77..102): Wide Bright Medicine Display & Pharmacist Window ---
    cv.box(21, 77, 45, 102, "steel", 4, "white", 5)
    cv.hline(21, 45, 77, "white", 6)
    cv.hline(21, 45, 102, "white", 6)  # clean window sill

    # Bright interior pharmacy backdrop w/ crisp depth so white shelves & colorful boxes POP! (x=22..44, y=78..101)
    for wy in range(78, 102):
        for wx in range(22, 45):
            if wy <= 79:
                cv.p(wx, wy, "white", 6)      # bright LED ceiling strip!
            elif wy == 80:
                cv.p(wx, wy, "glass", 5)      # cool ceiling light wash
            elif wx <= 35:
                cv.p(wx, wy, "coolwhite", 2)  # deeper recessed medicine cabinet wall for high contrast!
            else:
                cv.p(wx, wy, "cream", 4 if wy > 85 else 5)  # warm-lit pharmacist bay

    # --- Neat White Rows of Colorful Medicine & Vitamin Boxes (x = 23..35, y = 81..96) ---
    med_shelves = [
        (82, 84, [
            ("red", 4), ("red", 3), ("white", 6), ("yellow", 4), ("yellow", 5),
            ("blue", 3), ("blue", 4), ("green", 3), ("green", 4), ("orange", 4),
            ("pink", 3), ("teal", 3), ("blue", 3),
        ]),
        (87, 89, [
            ("green", 3), ("green", 4), ("white", 6), ("blue", 4), ("teal", 4),
            ("orange", 4), ("yellow", 4), ("red", 3), ("pink", 4), ("white", 6),
            ("blue", 3), ("green", 3), ("yellow", 5),
        ]),
        (92, 94, [
            ("yellow", 4), ("orange", 4), ("orange", 5), ("white", 6), ("red", 4),
            ("blue", 3), ("green", 4), ("teal", 3), ("pink", 3), ("yellow", 4),
            ("green", 3), ("blue", 4), ("red", 3),
        ]),
    ]
    for sy0, sy1, boxes in med_shelves:
        for i, (bramp, bidx) in enumerate(boxes):
            bx = 23 + i
            cv.vline(bx, sy0, sy1, bramp, bidx)
            # Crisp white box top label band on every 2nd box
            if (i + sy0) % 2 == 0:
                cv.p(bx, sy0, "white", 6)
        # Crisp white shelf plank + subtle shadow line underneath
        cv.hline(23, 35, sy1 + 1, "white", 6)
        if sy1 + 2 <= 96:
            cv.hline(23, 35, sy1 + 2, "coolwhite", 3)

    # --- Pharmacist Dispensing Counter & Warm Glow (x = 36..44, y = 82..101) ---
    # Hanging green `조제` / prescription header inside window (x = 37..43, y = 82..84)
    cv.rect(37, 82, 43, 84, "green", 3)
    cv.hline(38, 42, 83, "white", 6)

    # Pharmacist silhouette in crisp white lab coat behind counter (x = 39..42, y = 87..92)
    cv.rect(40, 87, 41, 88, "kinari", 4)  # head
    cv.hline(40, 41, 86, "kuro", 1)       # hair
    cv.rect(39, 89, 42, 92, "white", 6)   # white pharmacist coat
    cv.vline(40, 89, 92, "teal", 3)       # scrubs / tie accent

    # Glowing POS computer monitor on counter (x = 36..38, y = 90..92)
    cv.rect(36, 90, 38, 92, "glass", 5)
    cv.p(37, 91, "white", 6)

    # Front Pharmacy Counter w/ Warm Oak Consultation Top + Tonic Warmer (x = 22..44, y = 93..101)
    cv.hline(22, 35, 96, "white", 6)       # clean white dispensing counter top
    cv.hline(36, 44, 96, "cedar", 5)       # warm oak consultation counter top!
    cv.hline(36, 44, 97, "cedar", 3)
    cv.hline(22, 35, 97, "green", 3)       # emerald pharmacy counter trim
    cv.rect(22, 98, 35, 101, "coolwhite", 5)
    cv.rect(36, 98, 44, 101, "floorwood", 4)
    cv.vline(36, 98, 101, "wood", 3)
    # Amber tonic bottle warmer cabinet on counter (x = 24..28, y = 93..96) -> Bacchus/tonic bottles!
    cv.box(24, 93, 28, 96, "steel", 4, "yellow", 4)
    cv.p(25, 94, "orange", 3)
    cv.p(26, 94, "wood", 2)
    cv.p(27, 94, "orange", 5)
    # Navy & burgundy herbal tonic gift boxes beside warmer (x = 30..34, y = 94..95)
    cv.rect(30, 94, 31, 95, "navy", 2)
    cv.p(30, 94, "navy", 4)
    cv.rect(33, 94, 34, 95, "maple", 3)
    cv.p(33, 94, "yellow", 5)

    # Crisp diagonal glass reflection across display window top-right
    for d in range(4):
        cv.p(23 + d, 79 + d, "glass", 6)
        cv.p(40 + d, 79 + d, "glass", 6 if d < 2 else 5)

    # Lower Porcelain Tile Wainscoting + Emerald Kick-Band (x = 20..46, y = 103..110)
    for wy in range(103, 109):
        for wx in range(20, 47):
            if wy == 103:
                cv.p(wx, wy, "coolwhite", 2)  # sill shadow
            elif wx % 5 == 0 or wy == 106:
                cv.p(wx, wy, "coolwhite", 3)
            else:
                cv.p(wx, wy, "white", 5 if (wx // 5) % 2 == 0 else 6)
    cv.hline(20, 46, 109, "green", 2)
    cv.hline(20, 46, 110, "concrete", 2)
    cv.hline(0, W - 1, 111, "pavement", 1)
    cv.hline(2, 19, 111, "pavement", 2)

    # --- Curbside Prop (Right, x = 40..46, y = 96..111): Clean White Ceramic Pot & Plant ---
    cv.hline(39, 46, 110, "pavement", 0)  # shadow
    # White cylindrical planter pot (x = 41..45, y = 105..110)
    cv.hline(40, 46, 105, "white", 6)
    cv.hline(41, 45, 104, "soil", 1)
    cv.p(43, 104, "soil", 2)
    cv.rect(41, 106, 45, 110, "white", 5)
    cv.vline(41, 106, 110, "white", 6)
    cv.vline(45, 106, 110, "coolwhite", 3)
    cv.hline(41, 45, 107, "green", 3)     # neat green stripe on pharmacy planter!
    # Upright lush green snake-plant / ficus leaves (x = 40..46, y = 96..104)
    leaf_blades = [
        (41, 99, 104, "foliage", 3),
        (42, 97, 104, "green", 4),
        (43, 96, 104, "foliage", 5),
        (44, 98, 104, "green", 3),
        (45, 100, 104, "foliage", 2),
    ]
    for lx, ly0, ly1, lr, li in leaf_blades:
        cv.vline(lx, ly0, ly1, lr, li)
    cv.p(43, 96, "foliage", 6)
    cv.p(42, 97, "green", 5)

    return cv


# ---------------------------------------------------------------------------
# Strict Palette & Alpha Verification + 3x Preview Sheet
# ---------------------------------------------------------------------------

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
                    f"{name}: unexpected transparent pixel below parapet at ({x}, {y})"
                )

    assert bad_alpha == 0, f"{name}: {bad_alpha} non-binary alpha pixels!"
    assert pure_black == 0, f"{name}: {pure_black} pure #000000 pixels!"
    assert off_palette == 0, f"{name}: {off_palette} off-palette pixels!"
    assert 60 <= len(used_colors) <= 95, (
        f"{name}: color count {len(used_colors)} outside target 60..95!"
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


def save_preview_sheet(cafe: Image.Image, pharmacy: Image.Image, out_path: Path) -> None:
    scale = 3
    c3 = cafe.resize((cafe.width * scale, cafe.height * scale), Image.NEAREST)
    p3 = pharmacy.resize((pharmacy.width * scale, pharmacy.height * scale), Image.NEAREST)

    # Also show wall-to-wall street pairing at 2x so seam alignment is obvious!
    c2 = cafe.resize((cafe.width * 2, cafe.height * 2), Image.NEAREST)
    p2 = pharmacy.resize((pharmacy.width * 2, pharmacy.height * 2), Image.NEAREST)

    pad = 24
    sheet_w = pad + c3.width + pad + p3.width + pad + (c2.width + p2.width) + pad
    sheet_h = pad + max(c3.height, p3.height) + pad + 20

    sheet = make_checkerboard(sheet_w, sheet_h, cell=12)
    draw = ImageDraw.Draw(sheet)

    x_c3 = pad
    x_p3 = x_c3 + c3.width + pad
    x_pair = x_p3 + p3.width + pad
    y_top = pad + 16

    draw.text((x_c3, 8), "k-cafe.png (3x, 64x112)", fill=(230, 234, 242, 255))
    draw.text((x_p3, 8), "k-pharmacy.png (3x, 48x112)", fill=(230, 234, 242, 255))
    draw.text((x_pair, 8), "Wall-to-Wall 2x + 1x", fill=(185, 195, 210, 255))

    sheet.alpha_composite(c3, (x_c3, y_top))
    sheet.alpha_composite(p3, (x_p3, y_top))

    # 2x wall-to-wall pair at bottom of right column, 1x native pair above it
    sheet.alpha_composite(cafe, (x_pair, y_top))
    sheet.alpha_composite(pharmacy, (x_pair + cafe.width, y_top))
    y_pair2 = y_top + c3.height - c2.height
    sheet.alpha_composite(c2, (x_pair, y_pair2))
    sheet.alpha_composite(p2, (x_pair + c2.width, y_pair2))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(out_path)


def main() -> None:
    pal = Palette(PALETTE_PATH)
    glyphs = json.loads(GLYPHS_PATH.read_text(encoding="utf-8"))["glyphs"]

    SHOPS_DIR.mkdir(parents=True, exist_ok=True)

    cafe_cv = build_k_cafe(pal, glyphs)
    pharm_cv = build_k_pharmacy(pal, glyphs)

    cafe_colors = verify_sprite("k-cafe.png", cafe_cv.img, (64, 112), pal, full_wall_y=8)
    pharm_colors = verify_sprite("k-pharmacy.png", pharm_cv.img, (48, 112), pal, full_wall_y=8)

    cafe_out = SHOPS_DIR / "k-cafe.png"
    pharm_out = SHOPS_DIR / "k-pharmacy.png"
    cafe_cv.img.save(cafe_out)
    pharm_cv.img.save(pharm_out)

    save_preview_sheet(cafe_cv.img, pharm_cv.img, PREVIEW_PATH)

    print(f"PASS k-cafe.png:     64x112 RGBA, {cafe_colors} unique palette colors, 0 off-palette, 0 #000000, binary alpha")
    print(f"PASS k-pharmacy.png: 48x112 RGBA, {pharm_colors} unique palette colors, 0 off-palette, 0 #000000, binary alpha")
    print(f"PASS preview_batch4: {PREVIEW_PATH}")


if __name__ == "__main__":
    main()
