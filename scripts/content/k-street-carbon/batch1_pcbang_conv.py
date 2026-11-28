#!/usr/bin/env python3
"""
K-Street Fable-Grade Korean Shops — T1 Batch 1/6
Hand-crafts two original 64x112 modern Korean street shopfront buildings from scratch:
  1. k-pcbang.png (64x112 RGBA, 4x7 tiles) — Modern Korean PC방 exterior
  2. k-conv.png   (64x112 RGBA, 4x7 tiles) — Iconic Korean 24시 편의점 exterior

Strictly uses ONLY opaque colors from tiledata/jp-city/fable-city/palette.json
and 9x9 Hangul/alphanumeric bitmaps from tiledata/k-street-carbon/hangul9.json.
Strict binary alpha {0, 255}, 0 pure #000000, seamless 64px wall-to-wall facades.
"""

from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
PALETTE_PATH = ROOT / "tiledata/jp-city/fable-city/palette.json"
HANGUL_PATH = ROOT / "tiledata/k-street-carbon/hangul9.json"
SHOPS_DIR = ROOT / "tiledata/k-street-carbon/shops"
PREVIEW_PATH = ROOT / "tiledata/k-street-carbon/preview_batch1.png"


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

    def glyph_bounds(self, ch: str) -> tuple[int, int, list[str]]:
        """Return (min_col, max_col, rows) of '#' bits in a 9x9 glyph."""
        rows = self.glyphs[ch]
        min_x, max_x = 9, -1
        for row in rows:
            for rx, bit in enumerate(row):
                if bit == "#":
                    min_x = min(min_x, rx)
                    max_x = max(max_x, rx)
        if max_x < min_x:
            return 0, 0, rows
        return min_x, max_x, rows

    def draw_glyph_trimmed(
        self,
        ch: str,
        x0: int,
        y0: int,
        fg: tuple[int, int, int, int] | list[tuple[int, int, int, int]],
        shadow: tuple[int, int, int, int] | None = None,
    ) -> int:
        """Draw trimmed 9-row glyph starting at x0, y0 and return its active pixel width."""
        min_x, max_x, rows = self.glyph_bounds(ch)
        w = max_x - min_x + 1
        if shadow is not None:
            for ry, row in enumerate(rows):
                for rx in range(min_x, max_x + 1):
                    if row[rx] == "#":
                        gx = x0 + (rx - min_x)
                        gy = y0 + ry
                        self.set(gx + 1, gy + 1, shadow)
                        self.set(gx, gy + 1, shadow)
        for ry, row in enumerate(rows):
            row_col = fg[ry] if isinstance(fg, list) else fg
            for rx in range(min_x, max_x + 1):
                if row[rx] == "#":
                    self.set(x0 + (rx - min_x), y0 + ry, row_col)
        return w


# ---------------------------------------------------------------------------
# Shared Rooftop Primitives (Green Urethane Waterproofing & HVAC Equipment)
# ---------------------------------------------------------------------------

def draw_green_roof_slab(
    cv: PixelCanvas,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    v_seams: list[int],
    h_seams: list[int],
    drain_left: bool = True,
) -> None:
    """Korean flat-roof green urethane waterproofing slab with crisp shadow & tar seams."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if y == y0:
                idx = 1  # sharp north parapet shadow
            elif y <= y0 + 2:
                idx = 2
            elif y >= y1 - 1:
                idx = 3
            else:
                idx = 2 if y < (y0 + y1) // 2 else 3
            cv.p(x, y, "moss", idx)

    # Calm horizontal urethane sheen bands & subtle weathered patches
    cv.hline(x0 + 3, x1 - 4, y1 - 1, "moss", 4)
    cv.hline(x0 + 5, (x0 + x1) // 2 + 4, y1 - 2, "moss", 4)
    cv.hline(x0 + 4, x0 + 12, y0 + 4, "moss", 3)
    cv.hline(x1 - 14, x1 - 5, y0 + 7, "moss", 2)
    cv.hline(x0 + 18, x0 + 28, y1 - 4, "midori", 4)

    # Expansion-joint seams
    for sy in h_seams:
        cv.hline(x0, x1, sy, "moss", 1)
        if sy + 1 <= y1:
            cv.hline(x0 + 2, x1 - 2, sy + 1, "moss", 3)
    for sx in v_seams:
        cv.vline(sx, y0, y1, "moss", 1)

    # Corner roof scupper drain grate
    dx = x0 + 1 if drain_left else x1 - 3
    cv.rect(dx, y1 - 2, dx + 2, y1 - 1, "steel", 1)
    cv.p(dx + 1, y1 - 2, "steel", 3)
    cv.p(dx, y1 - 1, "pavement", 0)


def draw_ac_condenser(
    cv: PixelCanvas,
    x0: int,
    y0: int,
    w: int = 13,
    h: int = 14,
) -> None:
    """3/4 industrial outdoor AC unit with circular fan grille, louvers & diagonal shadow."""
    x1 = x0 + w - 1
    y1 = y0 + h - 1

    # Crisp diagonal bottom-right cast shadow on green roof
    for sy in range(y0 + 3, y1 + 3):
        for sx in range(x0 + 2, x1 + 4):
            if sx <= 60 and sy <= 32 and cv.get(sx, sy)[3] == 255:
                d = (sx - x1) + (sy - y1)
                cv.p(sx, sy, "moss", 0 if d <= 2 else 1)

    # Rubber vibration pads
    cv.rect(x0 + 1, y1, x0 + 2, y1, "kuro", 0)
    cv.rect(x1 - 2, y1, x1 - 1, y1, "kuro", 0)

    # Outer metal cabinet
    cv.rect(x0, y0, x1, y1 - 1, "steel", 2)
    # 3/4 top lid surface
    cv.hline(x0 + 1, x1 - 1, y0 + 1, "white", 6)
    cv.hline(x0 + 1, x1 - 1, y0 + 2, "coolwhite", 5)
    cv.p(x1 - 1, y0 + 1, "coolwhite", 4)

    # Front panel gradient
    for y in range(y0 + 3, y1 - 1):
        tone = 4 if y < y0 + 7 else (3 if y < y0 + 11 else 2)
        cv.hline(x0 + 1, x1 - 1, y, "coolwhite", tone)
    cv.vline(x0 + 1, y0 + 2, y1 - 2, "coolwhite", 5)
    cv.vline(x1 - 1, y0 + 2, y1 - 2, "steel", 2)
    cv.hline(x0 + 1, x1 - 1, y1 - 1, "steel", 1)

    # Circular 7x7 fan shroud + turbine blades
    fx, fy = x0 + 2, y0 + 4
    fan_map = [
        ".22222.",
        "2130312",
        "2302032",
        "2024202",
        "2302032",
        "2130312",
        ".22222.",
    ]
    for ry, row in enumerate(fan_map):
        for rx, ch in enumerate(row):
            if ch != ".":
                cv.p(fx + rx, fy + ry, "steel", int(ch))

    # Right-side louver vents & brand badge
    lx = x1 - 3
    if lx > fx + 6:
        cv.p(lx, y0 + 4, "blue", 3)
        cv.p(lx + 1, y0 + 4, "red", 3)
        for ly in range(y0 + 6, y1 - 2, 2):
            cv.hline(lx, x1 - 2, ly, "steel", 1)
            cv.hline(lx, x1 - 2, ly + 1, "coolwhite", 4)


# ---------------------------------------------------------------------------
# Building 1: k-pcbang.png (64 x 112) — Modern Korean PC방 Exterior
# ---------------------------------------------------------------------------

def build_pcbang(pal: Palette, glyphs: dict[str, list[str]]) -> PixelCanvas:
    W, H = 64, 112
    cv = PixelCanvas(W, H, pal, glyphs)

    # =========================================================================
    # 1. ROOF (y = 0 .. 39): Flat concrete parapet + green waterproofing +
    #    twin industrial AC units + galvanized ventilation pipe & diagonal shadows
    # =========================================================================
    cv.rect(0, 8, W - 1, 39, "concrete", 1)
    cv.hline(0, W - 1, 8, "concrete", 3)
    cv.hline(1, W - 2, 9, "concrete", 5)
    cv.hline(3, W - 4, 10, "concrete", 3)
    cv.hline(3, W - 4, 11, "pavement", 0)

    # Side parapet walls (3px wide, 3/4 top coping)
    for y in range(9, 33):
        cv.p(0, y, "concrete", 2)
        cv.p(1, y, "concrete", 5)
        cv.p(2, y, "concrete", 3)

        cv.p(W - 3, y, "concrete", 3)
        cv.p(W - 2, y, "concrete", 4)
        cv.p(W - 1, y, "concrete", 1)
    for jy in (17, 25):
        cv.hline(0, 2, jy, "concrete", 2)
        cv.hline(W - 3, W - 1, jy, "concrete", 2)

    # Green urethane waterproofed slab (x = 3..60, y = 12..32)
    draw_green_roof_slab(cv, 3, 12, 60, 32, v_seams=[21, 41], h_seams=[20, 27], drain_left=True)

    # South parapet coping & dark-steel modern cornice (y = 33..39)
    cv.hline(0, W - 1, 33, "concrete", 4)
    cv.hline(1, W - 2, 34, "concrete", 6)
    cv.hline(1, W - 2, 35, "concrete", 5)
    for jx in (16, 32, 48):
        cv.vline(jx, 33, 35, "concrete", 3)
        cv.vline(jx, 8, 9, "concrete", 2)
    cv.hline(0, W - 1, 36, "ibushi", 3)
    cv.hline(0, W - 1, 37, "kuro", 3)
    cv.hline(0, W - 1, 38, "kuro", 1)
    cv.hline(0, W - 1, 39, "kuro", 0)

    # Insulated copper/cream refrigerant pipe header along north parapet -> Twin AC units
    cv.hline(8, 37, 13, "cream", 4)
    cv.hline(8, 37, 14, "steel", 2)
    cv.vline(9, 13, 16, "cream", 5)
    cv.vline(24, 13, 16, "cream", 5)
    cv.p(19, 13, "orange", 3)  # brass valve
    cv.p(35, 13, "orange", 3)
    cv.rect(36, 12, 39, 15, "steel", 3)
    cv.hline(36, 39, 12, "steel", 5)

    # Twin Industrial AC Outdoor Units (x = 5..17 and x = 20..32, y = 15..28)
    draw_ac_condenser(cv, 5, 15, w=13, h=14)
    draw_ac_condenser(cv, 20, 15, w=13, h=14)

    # Small dark-steel rooftop fiber junction box (x = 35..39, y = 24..29)
    for sy in range(26, 31):
        for sx in range(37, 41):
            cv.p(sx, sy, "moss", 0)
    cv.rect(35, 24, 39, 29, "kuro", 2)
    cv.hline(35, 39, 24, "steel", 4)
    cv.p(36, 26, "teal", 5)
    cv.p(38, 26, "orange", 4)

    # Heavy Galvanized Ventilation Pipe & Conical Exhaust Stack (x = 42..56, y = 1..29)
    # Crisp diagonal cast shadow from horizontal duct + tall cylindrical stack onto green roof
    for step in range(10):
        sx0 = 46 + step // 2
        sy = 22 + step
        if sy <= 32:
            cv.hline(sx0, min(60, sx0 + 9), sy, "moss", 0 if step < 6 else 1)
    cv.hline(42, 47, 28, "moss", 0)

    # Concrete roof penetration curb + horizontal galvanized elbow (x = 41..48, y = 21..27)
    cv.rect(41, 25, 46, 27, "concrete", 2)
    cv.hline(41, 46, 25, "concrete", 4)
    cv.rect(42, 21, 48, 25, "steel", 3)
    cv.hline(42, 48, 21, "steel", 5)
    cv.hline(42, 48, 22, "white", 5)
    cv.hline(42, 48, 25, "steel", 1)
    cv.vline(44, 21, 25, "steel", 2)

    # Vertical cylindrical spiral ventilation riser (x = 47..52, y = 5..26)
    for y in range(5, 27):
        cv.p(47, y, "steel", 2)
        cv.p(48, y, "steel", 5)
        cv.p(49, y, "steel", 6)
        cv.p(50, y, "steel", 4)
        cv.p(51, y, "steel", 2)
        cv.p(52, y, "steel", 1)
    # Mitre joint where horizontal elbow meets vertical stack
    for d in range(4):
        cv.p(47 + d, 22 + d, "steel", 2)
    # Flanged pipe collar rings
    for fy in (9, 15, 21):
        cv.hline(46, 53, fy, "steel", 4)
        cv.p(48, fy, "white", 6)
        cv.hline(46, 53, fy + 1, "steel", 1)

    # Conical rain-cap exhaust hood at top (x = 45..54, y = 1..5)
    cv.hline(48, 51, 1, "steel", 5)
    cv.hline(46, 53, 2, "white", 6)
    cv.hline(45, 54, 3, "steel", 4)
    cv.p(46, 3, "white", 6)
    cv.hline(46, 53, 4, "kuro", 0)  # dark exhaust gap under cap
    cv.p(47, 4, "steel", 3)  # left cap strut
    cv.p(52, 4, "steel", 2)  # right cap strut
    cv.hline(47, 52, 5, "steel", 1)  # shadow collar under cap

    # =========================================================================
    # 2. 2F FACADE & KOREAN SIGNBOARD (y = 40 .. 72):
    #    Sleek dark-steel & cool-concrete modern facade, wide tinted windows
    #    with glowing cyan/blue gaming monitors, backlit navy/cyan `PC방` sign,
    #    LED strip trim & vertical cable conduit
    # =========================================================================
    for y in range(40, 73):
        for x in range(0, W):
            if y == 40:
                cv.p(x, y, "kuro", 1)
            elif y == 41:
                cv.p(x, y, "kuro", 3)
            elif x in (0, W - 1):
                cv.p(x, y, "kuro", 2)
            elif x in (1, 2, W - 2):
                cv.p(x, y, "ibushi", 2)
            else:
                cv.p(x, y, "kuro", 3 if y < 50 else 2)

    # Cool-concrete architectural spandrel bands & modular vertical seams
    cv.hline(2, 57, 42, "ibushi", 4)
    cv.hline(2, 57, 56, "steel", 4)  # crisp brushed aluminum window sill
    cv.hline(2, 57, 57, "concrete", 2)
    cv.hline(2, 57, 58, "kuro", 0)
    for vx in (20, 39):
        cv.vline(vx, 40, 58, "kuro", 1)

    # Wide 3-Bay Tinted 2F Gaming Windows (x = 3..56, y = 43..55)
    cv.rect(3, 43, 56, 55, "kuro", 0)
    cv.box(4, 44, 55, 55, "steel", 2)
    bays = [(5, 19), (21, 38), (40, 54)]
    cv.vline(20, 43, 55, "steel", 3)
    cv.vline(39, 43, 55, "steel", 3)

    for bi, (bx0, bx1) in enumerate(bays):
        for y in range(45, 55):
            for x in range(bx0, bx1 + 1):
                cv.p(x, y, "glass", 0 if y < 49 else 1)
        # Ceiling cyan/blue LED tube reflection in 2F gaming hall
        cv.hline(bx0 + 2, bx1 - 2, 45, "teal" if bi != 1 else "blue", 4)

        # Dark gaming desk surface + RGB keyboard glow accents (y = 53..54)
        cv.hline(bx0, bx1, 53, "kuro", 2)
        cv.hline(bx0, bx1, 54, "kuro", 0)

        if bi == 0:
            monitors = [(6, 10, "teal"), (12, 16, "blue")]
            pc_x = 18
        elif bi == 1:
            monitors = [(22, 26, "blue"), (28, 32, "teal"), (34, 37, "blue")]
            pc_x = 27
        else:
            monitors = [(41, 45, "teal"), (47, 51, "blue")]
            pc_x = 53

        for mx0, mx1, mramp in monitors:
            # Dark thin monitor top bezel + luminous widescreen display (y = 48..51)
            cv.hline(mx0, mx1, 47, "kuro", 0)
            cv.rect(mx0, 48, mx1, 51, mramp, 4)
            cv.hline(mx0, mx1, 48, mramp, 5)
            cv.hline(mx0 + 1, mx1 - 1, 49, "glass", 6)
            cv.p(mx0 + 1, 50, "white", 6)
            mid = (mx0 + mx1) // 2
            cv.p(mid, 52, "steel", 3)  # monitor stand neck
            cv.hline(mx0 + 1, mx1 - 1, 53, "teal" if mramp == "blue" else "pink", 4)  # RGB keyboard strip!

        # RGB tempered-glass PC tower on desk
        cv.vline(pc_x, 49, 52, "kuro", 1)
        cv.p(pc_x, 50, "pink" if bi != 2 else "green", 4)
        cv.p(pc_x, 51, "teal", 5)

        # Crisp diagonal tinted-glass reflection streak
        for d in range(5):
            gx = bx1 - 5 + d
            gy = 45 + d
            if bx0 <= gx <= bx1 and 45 <= gy <= 54:
                cv.p(gx, gy, "glass", 3)

    # Bold Backlit Navy/Cyan Signboard reading `PC방` + LED Strip Trim (x = 1..57, y = 59..72)
    cv.rect(1, 59, 57, 72, "kuro", 0)
    # Top & bottom glowing cyan/blue LED strip trim!
    cv.hline(2, 56, 59, "teal", 5)
    cv.hline(6, 52, 59, "glass", 6)
    cv.hline(2, 56, 72, "blue", 4)
    cv.hline(6, 52, 72, "teal", 4)
    cv.vline(1, 60, 71, "teal", 4)
    cv.vline(57, 60, 71, "blue", 4)

    # Backlit deep navy/cyan cabinet gradient (x = 2..56, y = 60..71)
    for y in range(60, 72):
        for x in range(2, 57):
            if y == 60:
                cv.p(x, y, "blue", 3)
            elif y <= 63:
                cv.p(x, y, "navy", 2)
            elif y <= 68:
                cv.p(x, y, "navy", 1)
            else:
                cv.p(x, y, "navy", 0)
    # Subtle horizontal backlit cyan horizon line behind text
    cv.hline(3, 55, 61, "blue", 2)

    # Left cyber monitor/gamepad icon on signboard (x = 5..12, y = 62..69)
    cv.box(5, 62, 12, 68, "teal", 4, "navy", 2)
    cv.hline(6, 11, 63, "teal", 5)
    cv.p(7, 65, "white", 6)
    cv.p(10, 65, "yellow", 5)
    cv.p(10, 66, "pink", 4)
    cv.hline(7, 10, 69, "teal", 3)

    # Right neon cyber speed-chevrons on signboard (x = 46..54, y = 62..69)
    for step in range(4):
        cv.p(47 + step, 62 + step, "teal", 5)
        cv.p(48 + step, 62 + step, "glass", 6)
        cv.p(47 + step, 69 - step, "teal", 4)
        cv.p(48 + step, 69 - step, "blue", 5)
        cv.p(51 + step // 2, 63 + step, "pink", 4)
        cv.p(51 + step // 2, 68 - step, "pink", 3)

    # Razor-sharp `PC방` using hangul9.json (centered at x = 16..42, y = 61..69)
    # Subtle vertical luminous white -> pale-cyan gradient on channel letters + deep navy shadow!
    pc_grad = [
        pal.c("white", 6),
        pal.c("white", 6),
        pal.c("white", 6),
        pal.c("white", 6),
        pal.c("glass", 6),
        pal.c("white", 6),
        pal.c("white", 6),
        pal.c("glass", 6),
        pal.c("teal", 5),
    ]
    sh_sign = pal.c("navy", 0)
    cx = 16
    for ch in ("P", "C", "방"):
        w = cv.draw_glyph_trimmed(ch, cx, 61, pc_grad, shadow=sh_sign)
        cx += w + 3

    # Vertical Galvanized Cable Conduit along right facade (x = 59..61, y = 40..72)
    cv.hline(58, 62, 40, "steel", 2)
    for y in range(41, 73):
        cv.p(59, y, "steel", 2)
        cv.p(60, y, "steel", 5)
        cv.p(61, y, "steel", 1)
    for cy in (46, 54, 63, 70):
        cv.hline(58, 62, cy, "steel", 1)
        cv.p(60, cy, "steel", 4)
    cv.rect(58, 48, 62, 51, "steel", 3)
    cv.hline(58, 62, 48, "steel", 5)
    cv.p(60, 49, "orange", 4)

    # =========================================================================
    # 3. 1F LIVING STOREFRONT (y = 73 .. 111):
    #    Automatic glass sliding entrance w/ neon frame & diagonal glare,
    #    flanking glowing game poster lightboxes, red/blue promo standing banner,
    #    tiny potted shrub & metallic sidewalk curb!
    # =========================================================================
    for y in range(73, 109):
        for x in range(0, W):
            if y == 73:
                cv.p(x, y, "kuro", 0)
            elif y == 74:
                cv.p(x, y, "kuro", 1)
            elif x in (0, W - 1):
                cv.p(x, y, "kuro", 1)
            else:
                cv.p(x, y, "ibushi", 2 if y < 92 else 1)

    # Under-canopy recessed LED spotlights casting cyan/blue pools at y = 73..74
    for lx in (14, 31, 49):
        cv.hline(lx - 1, lx + 1, 73, "glass", 6)
        cv.hline(lx - 2, lx + 2, 74, "teal" if lx == 31 else "blue", 3)

    # Right cable conduit continuing neatly into 1F utility plinth (x = 59..61, y = 73..107)
    for y in range(73, 108):
        cv.p(59, y, "steel", 1)
        cv.p(60, y, "steel", 4)
        cv.p(61, y, "kuro", 1)
    for cy in (80, 90):
        cv.hline(59, 61, cy, "steel", 2)

    # --- CENTER AUTOMATIC GLASS SLIDING DOORS w/ BRIGHT NEON FRAME (x = 21..42, y = 75..108) ---
    cv.rect(21, 75, 42, 108, "blue", 4)
    cv.hline(21, 42, 75, "teal", 5)
    cv.hline(23, 40, 75, "glass", 6)
    cv.vline(21, 75, 107, "teal", 5)
    cv.vline(42, 75, 107, "teal", 4)
    cv.rect(22, 76, 41, 108, "kuro", 1)

    # Automatic motion-sensor header bar (x = 23..40, y = 76..78)
    cv.rect(23, 76, 40, 78, "steel", 2)
    cv.hline(28, 35, 77, "kuro", 0)
    cv.p(31, 77, "green", 5)
    cv.p(32, 77, "teal", 5)

    # Double sliding door aluminum frames (left leaf x = 23..31, right leaf x = 32..40)
    cv.box(23, 79, 31, 107, "steel", 4, "glass", 0)
    cv.box(32, 79, 40, 107, "steel", 3, "glass", 0)
    cv.vline(31, 79, 107, "steel", 5)
    cv.vline(32, 79, 107, "kuro", 0)

    # Interior lobby glow & gaming counter visible through automatic glass doors
    for px0, px1 in ((24, 30), (33, 39)):
        for y in range(80, 105):
            for x in range(px0, px1 + 1):
                tone = 0 if y < 86 else (1 if y < 96 else 2)
                cv.p(x, y, "glass", tone)
        cv.hline(px0 + 1, px1 - 1, 81, "teal", 4)
        cv.hline(px0 + 1, px1 - 1, 82, "blue", 3)

    # Interior reception desk + glowing snack/seat kiosk inside lobby
    cv.rect(25, 91, 29, 94, "navy", 3)
    cv.hline(25, 29, 91, "teal", 5)
    cv.rect(34, 89, 37, 93, "blue", 4)
    cv.p(35, 90, "white", 6)

    # Crisp diagonal glass glare streaks across both sliding doors!
    for d in range(8):
        if 24 + d <= 30:
            cv.p(24 + d, 83 + d, "glass", 6 if d < 3 else 4)
            if 25 + d <= 30:
                cv.p(25 + d, 83 + d, "glass", 3)
        if 33 + d <= 39:
            cv.p(33 + d, 86 + d, "glass", 6 if d < 3 else 4)
            if 34 + d <= 39:
                cv.p(34 + d, 86 + d, "glass", 3)

    # Auto-door push decal strip (y = 95) + brushed stainless kickplates
    cv.hline(24, 30, 95, "teal", 4)
    cv.hline(33, 39, 95, "teal", 4)
    cv.p(29, 95, "white", 6)
    cv.p(34, 95, "white", 6)
    cv.rect(24, 105, 30, 107, "steel", 4)
    cv.rect(33, 105, 39, 107, "steel", 4)
    cv.hline(24, 30, 105, "steel", 6)
    cv.hline(33, 39, 105, "steel", 6)

    # --- LEFT GLOWING GAME POSTER LIGHTBOX (x = 9..19, y = 76..98) ---
    # Sleek dark-steel backlit frame w/ glowing Fantasy Action RPG artwork
    cv.rect(9, 76, 19, 98, "kuro", 0)
    cv.box(10, 77, 18, 97, "steel", 4, "navy", 2)
    cv.hline(11, 17, 78, "glass", 5)  # top lightbox LED glow
    cv.rect(11, 79, 17, 85, "blue", 3)
    # Diagonal glowing cyan sword & golden burst behind dark hero silhouette
    cv.p(16, 80, "white", 6)
    cv.p(15, 81, "glass", 6)
    cv.p(14, 82, "teal", 5)
    cv.rect(12, 83, 16, 88, "orange", 4)
    cv.rect(13, 84, 15, 87, "yellow", 5)
    cv.hline(11, 17, 88, "red", 4)
    # Hero silhouette + glowing title logo bar
    cv.rect(13, 86, 15, 92, "kuro", 1)
    cv.p(14, 87, "teal", 5)
    cv.rect(11, 93, 17, 96, "navy", 1)
    cv.hline(12, 16, 94, "yellow", 5)
    cv.hline(12, 15, 95, "white", 6)

    # --- RIGHT GLOWING GAME POSTER LIGHTBOX (x = 44..54, y = 76..96) ---
    # Sleek dark-steel backlit frame w/ Cyber Shooter / Esports Trophy artwork
    cv.rect(44, 76, 54, 96, "kuro", 0)
    cv.box(45, 77, 53, 95, "steel", 4, "navy", 1)
    cv.hline(46, 52, 78, "teal", 5)
    cv.rect(46, 79, 52, 85, "blue", 2)
    # Cyber mech visor + neon magenta energy core
    cv.hline(47, 51, 81, "glass", 6)
    cv.hline(48, 51, 82, "teal", 5)
    cv.rect(47, 84, 51, 89, "kuro", 2)
    cv.hline(48, 50, 86, "pink", 4)
    cv.p(49, 86, "white", 6)
    cv.hline(46, 52, 90, "pink", 4)
    cv.rect(46, 91, 52, 94, "navy", 2)
    cv.hline(47, 51, 92, "white", 6)
    cv.hline(47, 50, 93, "teal", 5)

    # Wall-mounted RTX / Spec LED mini-plaque below right poster (x = 45..52, y = 98..104)
    cv.rect(45, 98, 52, 104, "kuro", 0)
    cv.box(46, 99, 51, 103, "steel", 3, "kuro", 1)
    cv.hline(47, 50, 100, "green", 5)
    cv.hline(47, 49, 102, "yellow", 5)

    # --- FOREGROUND LEFT: RED/BLUE PROMO STANDING BANNER (입간판, x = 2..10, y = 84..109) ---
    cv.vline(11, 86, 108, "kuro", 0)  # banner cast shadow
    cv.hline(2, 10, 84, "steel", 5)  # top tension rod
    cv.hline(2, 10, 104, "steel", 4)  # bottom tension rod
    cv.vline(6, 104, 106, "steel", 4)  # center support pole
    for y in range(85, 104):
        for x in range(3, 10):
            if (y - 85) + (x - 3) < 11:
                cv.p(x, y, "red", 4 if x <= 5 else 3)
            elif (y - 85) + (x - 3) == 11:
                cv.p(x, y, "white", 6)
            else:
                cv.p(x, y, "blue", 4 if x <= 5 else 3)
    cv.hline(4, 8, 87, "yellow", 5)
    cv.hline(4, 7, 89, "white", 6)
    cv.hline(4, 8, 98, "white", 6)
    cv.hline(5, 8, 100, "yellow", 5)
    cv.hline(4, 8, 102, "teal", 5)

    # --- FOREGROUND RIGHT: LAYERED POTTED SHRUB (x = 53..60, y = 94..109) ---
    shrub_rows = [
        "...65...",
        ".56654..",
        "4655643.",
        "45454432",
        ".3543321",
        ".343221.",
        "..2321..",
    ]
    for ry, row in enumerate(shrub_rows):
        for rx, ch in enumerate(row):
            if ch != ".":
                cv.p(53 + rx, 94 + ry, "foliage", int(ch))
    # Terracotta planter pot w/ dark soil rim (x = 53..60, y = 101..109)
    cv.hline(54, 59, 101, "soil", 1)
    cv.hline(53, 60, 102, "brick", 5)
    cv.hline(53, 60, 103, "brick", 3)
    for y in range(104, 109):
        cv.p(54, y, "brick", 5)
        cv.hline(55, 58, y, "brick", 4 if y < 107 else 3)
        cv.p(59, y, "brick", 2)
    cv.vline(61, 102, 108, "kuro", 0)

    # --- METALLIC SIDEWALK CURB & STAINLESS RAMP (y = 108 .. 111) ---
    for x in range(0, W):
        if x < 2 or x > 10:
            if not (54 <= x <= 59):
                cv.p(x, 108, "steel", 5 if 21 <= x <= 42 else 3)
        cv.p(x, 109, "steel" if 21 <= x <= 42 else "pavement", 4)
        cv.p(x, 110, "pavement", 3)
        cv.p(x, 111, "pavement", 1)
    for tx in range(23, 41, 3):
        cv.p(tx, 108, "white", 6)
        cv.p(tx + 1, 109, "steel", 5)
    for jx in (14, 21, 42, 51):
        cv.vline(jx, 109, 111, "pavement", 1)

    # Heavy water-tank banner base & pot base seated cleanly on sidewalk
    cv.rect(2, 106, 10, 108, "concrete", 3)
    cv.hline(3, 9, 106, "concrete", 5)
    cv.hline(2, 10, 109, "pavement", 0)
    cv.hline(54, 59, 109, "pavement", 0)

    return cv


# ---------------------------------------------------------------------------
# Building 2: k-conv.png (64 x 112) — Iconic Korean 24시 편의점 Exterior
# ---------------------------------------------------------------------------

def build_conv(pal: Palette, glyphs: dict[str, list[str]]) -> PixelCanvas:
    W, H = 64, 112
    cv = PixelCanvas(W, H, pal, glyphs)

    # =========================================================================
    # 1. ROOF (y = 0 .. 39): Flat white/concrete parapet roof + green
    #    waterproofing + silver exhaust vent hood + AC condenser & cast shadows
    # =========================================================================
    cv.rect(0, 9, W - 1, 39, "coolwhite", 1)
    cv.hline(0, W - 1, 9, "coolwhite", 3)
    cv.hline(1, W - 2, 10, "white", 6)
    cv.hline(3, W - 4, 11, "coolwhite", 2)
    cv.hline(3, W - 4, 12, "concrete", 1)

    for y in range(10, 33):
        cv.p(0, y, "coolwhite", 2)
        cv.p(1, y, "white", 6)
        cv.p(2, y, "coolwhite", 3)

        cv.p(W - 3, y, "coolwhite", 3)
        cv.p(W - 2, y, "white", 5)
        cv.p(W - 1, y, "coolwhite", 1)
    for jy in (18, 26):
        cv.hline(0, 2, jy, "coolwhite", 3)
        cv.hline(W - 3, W - 1, jy, "coolwhite", 3)

    # Green waterproofing slab (x = 3..60, y = 13..32)
    draw_green_roof_slab(cv, 3, 13, 60, 32, v_seams=[24, 43], h_seams=[21, 28], drain_left=False)

    # South white/concrete parapet coping & cornice bevel (y = 33..39)
    cv.hline(0, W - 1, 33, "coolwhite", 4)
    cv.hline(1, W - 2, 34, "white", 6)
    cv.hline(1, W - 2, 35, "coolwhite", 5)
    for jx in (16, 32, 48):
        cv.vline(jx, 33, 35, "coolwhite", 3)
        cv.vline(jx, 9, 10, "coolwhite", 2)
    cv.hline(0, W - 1, 36, "concrete", 4)
    cv.hline(0, W - 1, 37, "coolwhite", 2)
    cv.hline(0, W - 1, 38, "concrete", 1)
    cv.hline(0, W - 1, 39, "concrete", 0)

    # Left: Gleaming Silver Gooseneck Commercial Exhaust Vent Hood (x = 9..21, y = 4..26)
    # Crisp diagonal cast shadow on green roof slab
    for sy in range(19, 29):
        for sx in range(14, 26):
            if sy <= 32 and cv.get(sx, sy)[3] == 255:
                cv.p(sx, sy, "moss", 0 if (sx <= 23 and sy <= 27) else 1)

    # Concrete rooftop curb + continuous vertical riser trunk (x = 13..21, y = 14..26)
    cv.rect(13, 24, 21, 26, "concrete", 2)
    cv.hline(13, 21, 24, "concrete", 5)
    for y in range(14, 24):
        cv.p(14, y, "steel", 2)
        cv.p(15, y, "steel", 5)
        cv.p(16, y, "white", 6)
        cv.p(17, y, "steel", 5)
        cv.p(18, y, "steel", 4)
        cv.p(19, y, "steel", 2)
        cv.p(20, y, "steel", 1)
    cv.hline(14, 20, 18, "steel", 2)  # sheet-metal flange seam
    cv.hline(14, 20, 19, "steel", 5)

    # Seamless 180-degree Inverted-U Silver Gooseneck Hood (x = 9..20, y = 4..14)
    hood_rows = [
        "...2566542..",
        "..256666542.",
        ".25665554431",
        "256543345531",
        "265421245641",
        "25431.245641",
        "24321.245541",
        "10001.245541",
        ".121..245541",
        "......235531",
        "......245541",
    ]
    for ry, row in enumerate(hood_rows):
        for rx, ch in enumerate(row):
            px, py = 9 + rx, 4 + ry
            if ch == "6":
                cv.p(px, py, "white", 6)
            elif ch.isdigit():
                cv.p(px, py, "steel", int(ch))

    # Center: Slim Rooftop Breather / POS Telecom Mast (x = 28..31, y = 6..23)
    cv.hline(29, 33, 23, "moss", 0)
    cv.rect(28, 21, 30, 23, "steel", 2)
    for y in range(8, 21):
        cv.p(29, y, "steel", 5 if y % 2 == 0 else 4)
    cv.hline(28, 30, 7, "steel", 5)
    cv.p(29, 6, "orange", 4)

    # Right: Commercial AC Condenser Unit (x = 36..49, y = 14..28) + coolant pipe
    cv.hline(49, 55, 24, "cream", 5)
    cv.hline(49, 55, 25, "steel", 2)
    cv.rect(54, 22, 57, 26, "coolwhite", 4)
    cv.hline(54, 57, 22, "white", 6)
    draw_ac_condenser(cv, 36, 14, w=14, h=15)

    # =========================================================================
    # 2. 2F FACADE, STRIPE BAND & KOREAN SIGNBOARD (y = 40 .. 72):
    #    Crisp cool-white tiled upper wall w/ apartment & storage windows,
    #    iconic bright green-white-orange horizontal fascia stripe band,
    #    and sharp `24편의점` signboard (compact 1px spacing!)
    # =========================================================================
    for y in range(40, 54):
        for x in range(0, W):
            if y == 40:
                cv.p(x, y, "coolwhite", 2)
            elif x == 0:
                cv.p(x, y, "coolwhite", 3)
            elif x == W - 1:
                cv.p(x, y, "coolwhite", 2)
            elif y % 4 == 1:
                cv.p(x, y, "coolwhite", 4)
            elif x % 8 == 0:
                cv.p(x, y, "coolwhite", 4)
            else:
                cv.p(x, y, "white", 5 if y > 41 else 6)

    # Left 2F Storage Window w/ venetian blinds & ramyeon stock cartons (x = 5..27, y = 42..51)
    cv.rect(5, 42, 27, 51, "steel", 2)
    cv.box(6, 43, 26, 50, "coolwhite", 5)
    cv.vline(16, 43, 50, "coolwhite", 5)
    cv.vline(17, 43, 50, "steel", 2)
    for y in range(44, 50):
        cv.hline(7, 15, y, "white" if y % 2 == 0 else "coolwhite", 6 if y % 2 == 0 else 3)
    for y in range(44, 50):
        for x in range(18, 26):
            cv.p(x, y, "glass", 3 if (x - 18) + (y - 44) in (4, 5) else 1)
    cv.rect(19, 47, 24, 49, "cedar", 4)
    cv.hline(19, 24, 47, "cedar", 5)
    cv.hline(20, 22, 48, "red", 4)
    cv.hline(4, 28, 52, "white", 6)
    cv.hline(4, 28, 53, "coolwhite", 3)

    # Right 2F Apartment / Office Window w/ warm curtain & potted plant (x = 35..57, y = 42..51)
    cv.rect(35, 42, 57, 51, "steel", 2)
    cv.box(36, 43, 56, 50, "coolwhite", 5)
    cv.vline(46, 43, 50, "coolwhite", 5)
    cv.vline(47, 43, 50, "steel", 2)
    for y in range(44, 50):
        for x in range(37, 46):
            cv.p(x, y, "glass", 3 if (x - 37) + (y - 44) in (4, 5) else 1)
    cv.hline(38, 40, 49, "brick", 4)
    cv.hline(38, 40, 48, "foliage", 5)
    cv.p(39, 47, "foliage", 6)
    cv.rect(42, 47, 45, 49, "blue", 4)
    cv.hline(42, 45, 47, "white", 6)
    for y in range(44, 50):
        for x in range(48, 56):
            if x >= 52:
                cv.p(x, y, "cream", 6 if x % 2 == 0 else 4)
            else:
                cv.p(x, y, "glass", 1 if y > 45 else 0)
                if x == 50 and y == 46:
                    cv.p(x, y, "yellow", 5)
    cv.hline(34, 58, 52, "white", 6)
    cv.hline(34, 58, 53, "coolwhite", 3)

    # Far-right 2F electric meter & vertical pipe (x = 60..62, y = 40..53)
    cv.vline(61, 40, 53, "steel", 3)
    cv.rect(59, 45, 62, 49, "coolwhite", 3)
    cv.rect(60, 46, 61, 47, "glass", 2)

    # --- ICONIC BRIGHT GREEN-WHITE-ORANGE HORIZONTAL FASCIA STRIPE BAND (y = 54 .. 59) ---
    cv.hline(0, W - 1, 54, "green", 4)
    cv.hline(1, W - 2, 54, "green", 5)
    cv.hline(0, W - 1, 55, "green", 3)
    cv.hline(0, W - 1, 56, "white", 6)
    cv.hline(0, W - 1, 57, "coolwhite", 5)
    cv.hline(0, W - 1, 58, "orange", 4)
    cv.hline(1, W - 2, 58, "orange", 5)
    cv.hline(0, W - 1, 59, "orange", 3)
    for sy, sr, si in ((54, "green", 3), (55, "green", 2), (56, "coolwhite", 4), (58, "orange", 3), (59, "orange", 2)):
        cv.p(0, sy, sr, si)
        cv.p(W - 1, sy, sr, si)
    for jx in (16, 32, 48):
        cv.p(jx, 55, "green", 2)
        cv.p(jx, 57, "coolwhite", 4)
        cv.p(jx, 59, "orange", 2)

    # --- SHARP `24편의점` SIGNBOARD (y = 60 .. 72) ---
    cv.rect(0, 60, W - 1, 72, "coolwhite", 4)
    cv.hline(0, W - 1, 60, "white", 6)
    cv.hline(0, W - 1, 72, "concrete", 1)
    # Tri-stripe wing pills on left & right fascia edges
    cv.rect(1, 62, 3, 65, "green", 4)
    cv.rect(1, 66, 3, 67, "white", 6)
    cv.rect(1, 68, 3, 70, "orange", 4)
    cv.rect(60, 62, 62, 65, "green", 4)
    cv.rect(60, 66, 62, 67, "white", 6)
    cv.rect(60, 68, 62, 70, "orange", 4)

    # Center High-Contrast Backlit Sign Cabinet (x = 5..58, y = 60..72)
    cv.rect(5, 60, 58, 72, "steel", 3)
    cv.hline(5, 58, 60, "white", 6)
    cv.rect(6, 61, 57, 71, "navy", 1)
    cv.hline(6, 57, 61, "navy", 2)
    cv.hline(6, 57, 62, "blue", 2)
    cv.hline(6, 57, 71, "navy", 0)

    # Render `24편의점` using hangul9.json with compact 1px spacing!
    chars = ["2", "4", "편", "의", "점"]
    gaps = [1, 2, 1, 1, 0]
    total_w = sum(cv.glyph_bounds(c)[1] - cv.glyph_bounds(c)[0] + 1 for c in chars) + sum(gaps)
    cx = (W - total_w) // 2
    sh_navy = pal.c("navy", 0)
    grad_24 = [
        pal.c("yellow", 5),
        pal.c("yellow", 5),
        pal.c("yellow", 5),
        pal.c("yellow", 4),
        pal.c("yellow", 4),
        pal.c("orange", 5),
        pal.c("orange", 4),
        pal.c("orange", 4),
        pal.c("orange", 4),
    ]
    fg_kor = pal.c("white", 6)
    for ch, gap in zip(chars, gaps):
        fg = grad_24 if ch in ("2", "4") else fg_kor
        w = cv.draw_glyph_trimmed(ch, cx, 62, fg, shadow=sh_navy)
        cx += w + gap

    # =========================================================================
    # 3. 1F LUMINOUS GLASS STOREFRONT & STREET PROPS (y = 73 .. 111):
    #    Full-width glass storefront packed w/ colorful snack shelves &
    #    illuminated drink coolers, glass sliding door w/ diagonal reflection,
    #    curbside red/blue ice-cream freezer chest & iconic plastic outdoor table + stools!
    # =========================================================================
    cv.hline(0, W - 1, 73, "white", 6)
    cv.hline(0, W - 1, 74, "cream", 6)
    cv.p(0, 73, "coolwhite", 4)
    cv.p(W - 1, 73, "coolwhite", 4)

    cv.rect(0, 75, W - 1, 107, "coolwhite", 5)
    cv.vline(0, 74, 107, "coolwhite", 3)
    cv.vline(W - 1, 74, 107, "coolwhite", 3)

    # --- LEFT FULL-HEIGHT LUMINOUS GLASS WINDOW (x = 2..24, y = 75..106) ---
    cv.rect(2, 75, 24, 106, "steel", 3)
    cv.rect(3, 76, 23, 105, "cream", 5)
    cv.hline(3, 23, 76, "white", 6)
    cv.hline(3, 23, 77, "cream", 6)
    cv.rect(3, 101, 23, 105, "cream", 4)  # interior tiled floor depth

    # Back-wall Illuminated Drink Coolers (x = 4..13, y = 78..95)
    cv.rect(4, 78, 13, 95, "steel", 3)
    cv.rect(5, 79, 12, 94, "glass", 6)
    cv.vline(8, 78, 95, "steel", 4)
    cooler_rows = [
        (80, [("green", 3), ("green", 4), ("blue", 4), ("red", 3), ("red", 4), ("orange", 4)]),
        (84, [("blue", 3), ("blue", 4), ("teal", 4), ("yellow", 4), ("yellow", 5), ("pink", 4)]),
        (88, [("green", 4), ("teal", 4), ("white", 6), ("red", 4), ("orange", 4), ("blue", 4)]),
        (92, [("yellow", 4), ("yellow", 5), ("green", 3), ("blue", 3), ("pink", 3), ("red", 3)]),
    ]
    for ry, drinks in cooler_rows:
        for dx, (dr, di) in zip((5, 6, 7, 9, 10, 11), drinks):
            cv.vline(dx, ry, ry + 1, dr, di)
        cv.hline(5, 7, ry + 2, "steel", 4)
        cv.hline(9, 11, ry + 2, "steel", 4)

    # Colorful Snack & Cup-Ramyeon Gondola Shelves (x = 14..23, y = 79..93)
    snack_tiers = [
        (80, [("red", 4), ("yellow", 5), ("orange", 4), ("green", 4), ("pink", 4), ("blue", 4), ("red", 3), ("yellow", 4)]),
        (85, [("orange", 4), ("red", 4), ("teal", 4), ("yellow", 5), ("blue", 4), ("pink", 3), ("green", 4), ("orange", 5)]),
        (90, [("yellow", 4), ("green", 4), ("red", 4), ("blue", 3), ("orange", 4), ("yellow", 5), ("pink", 4), ("teal", 4)]),
    ]
    for sy, snacks in snack_tiers:
        for i, (sr, si) in enumerate(snacks):
            sx = 15 + i
            cv.vline(sx, sy, sy + 2, sr, si)
            if i % 2 == 0:
                cv.p(sx, sy, "white", 6)
        cv.hline(14, 23, sy + 3, "coolwhite", 3)

    # Iconic Korean Convenience-Store Window Ramyeon Bar & High Stools (x = 17..23, y = 95..105)
    cv.hline(17, 23, 96, "floorwood", 5)
    cv.hline(17, 23, 97, "floorwood", 3)
    cv.p(19, 95, "red", 4)  # cup ramyeon on window bar
    cv.p(21, 95, "green", 3)  # triangle kimbap / drink
    for hsx in (19, 22):
        cv.hline(hsx - 1, hsx, 99, "kuro", 2)  # barstool seat
        cv.vline(hsx, 100, 105, "steel", 2)

    # "1+1" red promo sticker at top-right of left window
    cv.rect(19, 77, 22, 79, "red", 4)
    cv.p(20, 78, "white", 6)
    cv.p(21, 78, "yellow", 5)

    # --- CENTER GLASS SLIDING ENTRANCE DOOR (x = 25..38, y = 75..108) ---
    cv.rect(25, 75, 38, 108, "steel", 3)
    cv.hline(25, 38, 75, "steel", 5)
    cv.rect(26, 76, 37, 77, "kuro", 2)
    cv.hline(30, 33, 76, "green", 4)
    cv.vline(31, 78, 107, "steel", 5)
    cv.vline(32, 78, 107, "steel", 2)
    for px0, px1 in ((26, 30), (33, 37)):
        for y in range(78, 105):
            for x in range(px0, px1 + 1):
                if y < 84:
                    cv.p(x, y, "glass", 5 if y == 79 else 4)
                elif y < 95:
                    cv.p(x, y, "glass", 3)
                else:
                    cv.p(x, y, "glass", 2)
    # Green-white-orange safety stripe across glass door waist (y = 91..93)
    cv.hline(26, 30, 91, "green", 4)
    cv.hline(33, 37, 91, "green", 4)
    cv.hline(26, 30, 92, "white", 6)
    cv.hline(33, 37, 92, "white", 6)
    cv.hline(26, 30, 93, "orange", 4)
    cv.hline(33, 37, 93, "orange", 4)

    # Crisp diagonal glass reflection streaks on sliding door!
    for d in range(6):
        if 26 + d <= 30:
            cv.p(26 + d, 81 + d, "white", 6)
            if 27 + d <= 30:
                cv.p(27 + d, 81 + d, "glass", 6)
        if 33 + d <= 37:
            cv.p(33 + d, 83 + d, "white", 6)
            if 34 + d <= 37:
                cv.p(34 + d, 83 + d, "glass", 6)

    cv.rect(26, 105, 30, 107, "steel", 4)
    cv.rect(33, 105, 37, 107, "steel", 4)
    cv.hline(26, 37, 108, "kuro", 2)

    # --- RIGHT FULL-HEIGHT LUMINOUS GLASS WINDOW (x = 39..61, y = 75..106) ---
    cv.rect(39, 75, 61, 106, "steel", 3)
    cv.rect(40, 76, 60, 105, "cream", 5)
    cv.hline(40, 60, 76, "white", 6)
    cv.hline(40, 60, 77, "cream", 6)
    cv.rect(40, 100, 60, 105, "cream", 4)

    # Checkout POS Counter, Hot-Snack Case & Front Candy Rack (x = 40..50, y = 78..99)
    cv.rect(41, 78, 45, 80, "orange", 4)
    cv.p(42, 79, "white", 6)
    cv.p(44, 79, "yellow", 5)
    cv.rect(41, 83, 45, 87, "kuro", 2)
    cv.rect(42, 84, 44, 85, "teal", 5)
    cv.rect(46, 82, 50, 87, "orange", 3)
    cv.rect(47, 83, 49, 86, "yellow", 5)
    cv.hline(40, 50, 88, "white", 6)
    cv.rect(40, 89, 50, 99, "coolwhite", 4)
    cv.hline(40, 50, 89, "green", 4)
    cv.hline(40, 50, 90, "orange", 4)
    for cx_s, cr in ((41, "pink"), (43, "yellow"), (45, "green"), (47, "red"), (49, "blue")):
        cv.vline(cx_s, 92, 95, cr, 4)
    cv.hline(40, 50, 96, "coolwhite", 3)

    # Right-side Illuminated Beverage & Dairy Cooler (x = 51..59, y = 78..96)
    cv.rect(51, 78, 59, 96, "steel", 3)
    cv.rect(52, 79, 58, 95, "glass", 6)
    cv.vline(55, 78, 96, "steel", 4)
    for ry, drinks in (
        (80, [("white", 6), ("pink", 4), ("yellow", 5), ("green", 4), ("blue", 4), ("orange", 4)]),
        (84, [("blue", 4), ("teal", 4), ("red", 4), ("yellow", 4), ("pink", 3), ("green", 3)]),
        (88, [("orange", 4), ("red", 3), ("white", 6), ("blue", 3), ("teal", 4), ("yellow", 5)]),
        (92, [("green", 4), ("yellow", 5), ("pink", 4), ("red", 4), ("white", 6), ("blue", 4)]),
    ):
        for dx, (dr, di) in zip((52, 53, 54, 56, 57, 58), drinks):
            cv.vline(dx, ry, ry + 1, dr, di)
        cv.hline(52, 54, ry + 2, "steel", 4)
        cv.hline(56, 58, ry + 2, "steel", 4)

    # --- SIDEWALK CURB PLINTH (y = 108 .. 111) ---
    cv.hline(0, W - 1, 108, "white", 5)
    cv.hline(0, W - 1, 109, "pavement", 4)
    cv.hline(0, W - 1, 110, "pavement", 3)
    cv.hline(0, W - 1, 111, "pavement", 1)
    cv.hline(25, 38, 108, "steel", 4)
    for jx in (18, 25, 38, 50):
        cv.vline(jx, 109, 111, "pavement", 1)

    # --- FOREGROUND LEFT: CURBSIDE RED/BLUE ICE-CREAM FREEZER CHEST (x = 2..17, y = 94..109) ---
    cv.hline(3, 18, 109, "pavement", 0)
    cv.vline(18, 96, 108, "coolwhite", 2)

    cv.rect(2, 94, 17, 98, "blue", 4)
    cv.hline(2, 17, 94, "blue", 5)
    cv.rect(3, 95, 9, 97, "glass", 5)
    cv.rect(10, 95, 16, 97, "glass", 5)
    cv.vline(9, 94, 98, "steel", 4)
    for ix, ir, ii in ((4, "pink", 4), (5, "yellow", 5), (7, "teal", 4), (8, "green", 4), (11, "orange", 4), (12, "pink", 4), (14, "yellow", 5)):
        cv.p(ix, 96, ir, ii)
    cv.p(6, 95, "white", 6)
    cv.p(13, 95, "white", 6)

    cv.rect(2, 99, 17, 108, "white", 6)
    cv.vline(17, 99, 108, "coolwhite", 3)
    cv.hline(2, 17, 108, "coolwhite", 3)
    cv.rect(3, 101, 9, 106, "red", 4)
    cv.hline(3, 9, 101, "red", 5)
    cv.rect(10, 101, 16, 106, "blue", 3)
    cv.hline(10, 16, 101, "blue", 4)
    # Popsicle / ice-cream cone pixel graphic + "50%" badge
    cv.hline(5, 7, 102, "pink", 5)
    cv.p(6, 103, "white", 6)
    cv.vline(6, 104, 105, "yellow", 4)
    cv.hline(11, 15, 103, "yellow", 5)
    cv.hline(12, 14, 105, "white", 6)
    cv.p(4, 109, "kuro", 0)
    cv.p(15, 109, "kuro", 0)

    # --- FOREGROUND RIGHT: ICONIC KOREAN CONVENIENCE-STORE PLASTIC OUTDOOR TABLE + STOOLS ---
    cv.hline(41, 61, 109, "pavement", 0)
    cv.hline(46, 56, 108, "pavement", 2)

    # Left & Right Molded Royal-Blue Plastic Stools (x = 40..44 & x = 58..62, y = 102..109)
    for sx0 in (40, 58):
        cv.hline(sx0, sx0 + 4, 102, "blue", 5)
        cv.p(sx0 + 1, 102, "white", 6)
        cv.p(sx0 + 2, 102, "navy", 1)  # iconic center finger-hole!
        cv.hline(sx0, sx0 + 4, 103, "blue", 4)
        cv.hline(sx0, sx0 + 4, 104, "blue", 2)
        cv.vline(sx0, 105, 109, "blue", 3)
        cv.vline(sx0 + 4, 105, 109, "blue", 2)
        cv.vline(sx0 + 1, 105, 108, "navy", 1)
        cv.vline(sx0 + 3, 105, 108, "navy", 1)
        cv.hline(sx0 + 1, sx0 + 3, 106, "blue", 3)

    # Center Molded Plastic Table (x = 45..57, y = 95..109)
    cv.vline(47, 101, 109, "blue", 3)
    cv.vline(55, 101, 109, "blue", 2)
    cv.vline(50, 101, 108, "navy", 1)
    cv.vline(52, 101, 108, "navy", 1)
    cv.hline(48, 54, 104, "blue", 2)

    # 3/4 Oval Molded Blue Plastic Tabletop (x = 45..57, y = 97..100)
    cv.hline(47, 55, 97, "blue", 5)
    cv.hline(48, 53, 97, "white", 6)
    cv.hline(45, 57, 98, "blue", 4)
    cv.hline(46, 56, 98, "blue", 5)
    cv.hline(45, 57, 99, "blue", 3)
    cv.hline(46, 56, 100, "navy", 2)
    cv.p(51, 98, "navy", 2)  # center parasol hole cap

    # Cup-ramyeon, chopsticks & cold drink cans on outdoor table!
    cv.hline(48, 49, 95, "white", 6)
    cv.rect(48, 96, 49, 97, "red", 4)
    cv.p(47, 95, "cedar", 5)  # wooden chopsticks tip
    cv.vline(53, 96, 97, "yellow", 5)
    cv.p(53, 95, "white", 6)
    cv.vline(55, 96, 97, "green", 4)

    return cv


# ---------------------------------------------------------------------------
# Strict Palette, Binary Alpha & Wall-to-Wall Verification + 3x Preview Sheet
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
                raise AssertionError(f"{name}: unexpected transparent pixel below parapet at ({x}, {y})")

    assert bad_alpha == 0, f"{name}: {bad_alpha} non-binary alpha pixels!"
    assert pure_black == 0, f"{name}: {pure_black} pure #000000 pixels!"
    assert off_palette == 0, f"{name}: {off_palette} off-palette pixels!"
    assert 60 <= len(used_colors) <= 95, f"{name}: color count {len(used_colors)} outside 60..95 target!"
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


def save_preview_sheet(pcbang: Image.Image, conv: Image.Image, out_path: Path) -> None:
    p3 = pcbang.resize((pcbang.width * 3, pcbang.height * 3), Image.NEAREST)
    c3 = conv.resize((conv.width * 3, conv.height * 3), Image.NEAREST)

    # Seamless 2x wall-to-wall pair to verify parapet, signboard & curb continuity
    pair_1x = Image.new("RGBA", (pcbang.width + conv.width, pcbang.height), (0, 0, 0, 0))
    pair_1x.alpha_composite(pcbang, (0, 0))
    pair_1x.alpha_composite(conv, (pcbang.width, 0))
    pair_2x = pair_1x.resize((pair_1x.width * 2, pair_1x.height * 2), Image.NEAREST)

    pad = 24
    sheet_w = pad + p3.width + pad + c3.width + pad + pair_2x.width + pad
    sheet_h = pad + p3.height + pad + 20

    sheet = make_checkerboard(sheet_w, sheet_h, cell=12)
    draw = ImageDraw.Draw(sheet)

    x_p3 = pad
    x_c3 = x_p3 + p3.width + pad
    x_r = x_c3 + c3.width + pad
    y_top = pad + 16

    draw.text((x_p3, 8), "k-pcbang.png (3x, 64x112)", fill=(225, 230, 240, 255))
    draw.text((x_c3, 8), "k-conv.png (3x, 64x112)", fill=(225, 230, 240, 255))
    draw.text((x_r, 8), "Wall-to-Wall 2x + 1x Native", fill=(185, 200, 220, 255))

    sheet.alpha_composite(p3, (x_p3, y_top))
    sheet.alpha_composite(c3, (x_c3, y_top))
    sheet.alpha_composite(pair_2x, (x_r, y_top))
    sheet.alpha_composite(pair_1x, (x_r, y_top + p3.height - pair_1x.height))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(out_path)


def main() -> None:
    pal = Palette(PALETTE_PATH)
    glyphs = json.loads(HANGUL_PATH.read_text(encoding="utf-8"))["glyphs"]

    SHOPS_DIR.mkdir(parents=True, exist_ok=True)

    pcbang_cv = build_pcbang(pal, glyphs)
    conv_cv = build_conv(pal, glyphs)

    pcbang_colors = verify_sprite("k-pcbang.png", pcbang_cv.img, (64, 112), pal, full_wall_y=8)
    conv_colors = verify_sprite("k-conv.png", conv_cv.img, (64, 112), pal, full_wall_y=9)

    pcbang_out = SHOPS_DIR / "k-pcbang.png"
    conv_out = SHOPS_DIR / "k-conv.png"
    pcbang_cv.img.save(pcbang_out)
    conv_cv.img.save(conv_out)

    save_preview_sheet(pcbang_cv.img, conv_cv.img, PREVIEW_PATH)

    print(f"PASS k-pcbang.png: 64x112 RGBA, {pcbang_colors} unique palette colors, 0 off-palette, 0 #000000, binary alpha")
    print(f"PASS k-conv.png:   64x112 RGBA, {conv_colors} unique palette colors, 0 off-palette, 0 #000000, binary alpha")
    print(f"PASS preview:      {PREVIEW_PATH}")


if __name__ == "__main__":
    main()
