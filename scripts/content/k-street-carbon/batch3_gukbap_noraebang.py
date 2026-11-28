#!/usr/bin/env python3
"""
K-Street Fable-Grade Korean Shops — T1 Batch 3/6
Generates two 100% original procedural pixel-art Korean street shopfronts:
  1. k-gukbap.png    (48x112 RGBA) — Traditional old-school Korean 국밥집 (steaming soup house)
  2. k-noraebang.png (64x112 RGBA) — Vibrant Korean 코인 노래방 (coin karaoke box)

Strictly locked to:
  - tiledata/jp-city/fable-city/palette.json (0 off-palette, 0 #000000, binary alpha {0, 255})
  - tiledata/k-street-carbon/hangul9.json    (9x9 Korean Hangul signboard bitmaps)
"""

from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
PALETTE_PATH = ROOT / "tiledata/jp-city/fable-city/palette.json"
HANGUL_PATH = ROOT / "tiledata/k-street-carbon/hangul9.json"
SHOPS_DIR = ROOT / "tiledata/k-street-carbon/shops"
PREVIEW_PATH = ROOT / "tiledata/k-street-carbon/preview_batch3.png"


def hex_to_rgba(hx: str) -> tuple[int, int, int, int]:
    hx = hx.lstrip("#")
    return (int(hx[0:2], 16), int(hx[2:4], 16), int(hx[4:6], 16), 255)


def load_resources():
    with open(PALETTE_PATH, "r", encoding="utf-8") as f:
        pal_raw = json.load(f)["ramps"]
    ramps: dict[str, list[tuple[int, int, int, int]]] = {
        k: [hex_to_rgba(c) for c in v] for k, v in pal_raw.items()
    }
    allowed_rgb: set[tuple[int, int, int]] = {
        (c[0], c[1], c[2]) for cols in ramps.values() for c in cols
    }
    with open(HANGUL_PATH, "r", encoding="utf-8") as f:
        glyphs: dict[str, list[str]] = json.load(f)["glyphs"]
    return ramps, allowed_rgb, glyphs


def h2(x: int, y: int, seed: int = 0) -> int:
    """Deterministic integer spatial hash (0..255)."""
    n = (x * 374761393 + y * 668265263 + seed * 1442695041) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) >> 8) & 0xFF


def clamp(v: int, lo: int, hi: int) -> int:
    return lo if v < lo else (hi if v > hi else v)


class PixelCanvas:
    def __init__(self, w: int, h: int, ramps: dict[str, list[tuple[int, int, int, int]]]):
        self.w = w
        self.h = h
        self.ramps = ramps
        self.img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.px = self.img.load()
        self.color_to_ramp: dict[tuple[int, int, int, int], tuple[str, int]] = {}
        priority = [
            "kawara", "ibushi", "kuro", "cream", "kinari", "cedar", "wood",
            "darkwood", "floorwood", "cha", "steel", "concrete", "pavement",
            "stone", "glass", "white", "coolwhite", "navy", "blue", "teal",
            "pink", "red", "maple", "orange", "yellow", "moss", "green",
            "foliage", "brick", "rooftile", "ink",
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
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(x, y, col)

    def hline(self, x0: int, x1: int, y: int, col: tuple[int, int, int, int]) -> None:
        for x in range(x0, x1 + 1):
            self.put(x, y, col)

    def vline(self, x: int, y0: int, y1: int, col: tuple[int, int, int, int]) -> None:
        for y in range(y0, y1 + 1):
            self.put(x, y, col)

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
        for ry, row in enumerate(rows):
            col = fg_top if ry < 5 else fg_bot
            for rx, cell in enumerate(row):
                if cell == "#":
                    self.put(x0 + rx, y0 + ry, col)


# ==============================================================================
# BUILDING 1: k-gukbap.png (48 x 112) — Traditional Korean 국밥집 (Soup House)
# ==============================================================================
def draw_mangwa_cap(cv: PixelCanvas, x0: int, y0: int, width: int = 6) -> None:
    """Sculpted Korean ridge-end tile cap (망와/취두) in smoked kawara/ibushi slate."""
    ink0 = cv.c("ink", 0)
    for dy in range(8):
        for dx in range(width):
            x, y = x0 + dx, y0 + dy
            if dy == 0 and (dx < 1 or dx >= width - 1):
                continue
            if dy == 1 and (dx == 0 or dx == width - 1):
                if dx == 0:
                    cv.put(x, y, ink0)
                else:
                    cv.put(x, y, ink0)
                continue
            is_top = (dy == 0) or (dy == 1 and dx in (1, width - 2))
            is_side = (dx == 0 or dx == width - 1)
            is_bot = (dy == 7)
            if is_top or is_side or is_bot:
                cv.put(x, y, ink0)
            else:
                if dx <= 2 and dy <= 3:
                    col = cv.c("ibushi", 6 if (dx == 1 and dy == 2) else 5)
                elif dx == 2 and dy == 4:
                    col = cv.c("kawara", 5)
                elif dy == 6 or dx == width - 2:
                    col = cv.c("kawara", 1)
                else:
                    col = cv.c("kawara", 3)
                cv.put(x, y, col)
    # Central lotus-medallion boss highlight
    cv.p(x0 + 2, y0 + 3, "ibushi", 6)
    cv.p(x0 + 3, y0 + 5, "kawara", 1)


def draw_korean_giwa_roof(cv: PixelCanvas, w: int, seed: int = 41) -> None:
    """
    Weathered dark-slate Korean giwa tiled roof (y=0..39) blending 'kawara' & 'ibushi'
    with stacked yongmaru ridge cap, moss flecks, and round sumaksae eave medallions.
    """
    ink0 = cv.c("ink", 0)
    cap_w = 6

    # 1. Yongmaru (용마루) stacked wafer-tile ridge beam (x=5..42, y=2..6)
    rx0, rx1 = cap_w - 1, w - cap_w
    for x in range(rx0, rx1 + 1):
        seg = (x - rx0) % 6
        is_joint = (seg == 0)
        cv.put(x, 2, ink0)
        # Sunlit top lime/slate crest
        if is_joint:
            cv.p(x, 3, "ibushi", 3)
        elif seg in (1, 2):
            cv.p(x, 3, "ibushi", 6)
        else:
            cv.p(x, 3, "kawara", 5)
        # Stacked jeoksae wafer courses
        cv.p(x, 4, "ibushi" if seg % 2 == 0 else "kawara", 2 if is_joint else 4)
        cv.p(x, 5, "ibushi", 1 if is_joint else 2)
        cv.put(x, 6, ink0 if is_joint else cv.c("kawara", 0))

    # 2. Staggered Korean 암키와 (pan) & 수키와 (roll) courses (y=7..36, 6 courses x 5px)
    for course in range(6):
        y0 = 7 + course * 5
        stagger = (course % 2) * 2
        course_bias = 0 if course < 4 else (-1 if course == 5 else 0)
        for dy in range(5):
            y = y0 + dy
            for x in range(w):
                if x == 0 or x == w - 1:
                    cv.put(x, y, ink0 if dy == 4 else cv.c("kawara", 1 if x == 0 else 0))
                    continue
                tx = (x + stagger) % 4
                tc = (x + stagger) // 4
                hv = h2(tc, course, seed)
                shift = (1 if hv > 212 else (-1 if hv < 46 else 0)) + course_bias
                # Blend weathered smoked 'ibushi' tiles organically among slate-blue 'kawara'
                rmp = "ibushi" if (64 <= hv <= 136) else "kawara"

                def tone(lv: int) -> tuple[int, int, int, int]:
                    return cv.c(rmp, clamp(lv + shift, 0, 6))

                if tx == 0:
                    # Deep groove beside convex 수키와 roll tile
                    if dy == 4:
                        col = ink0
                    elif dy == 3:
                        col = cv.c("kuro", 0)
                    else:
                        col = cv.c("kawara", 1 if dy in (1, 2) else 0)
                elif tx == 1:
                    # Convex 수키와 sunlit roll rib
                    if dy == 0:
                        col = tone(3)
                    elif dy == 1:
                        col = cv.c("ibushi", 6) if hv > 224 else tone(5)
                    elif dy == 2:
                        col = tone(5)
                    elif dy == 3:
                        col = tone(4)
                    else:
                        col = tone(2)
                elif tx == 2:
                    # Concave 암키와 pan left-mid
                    if dy == 0:
                        col = tone(2)
                    elif dy in (1, 2):
                        col = tone(3)
                    elif dy == 3:
                        col = tone(2)
                    else:
                        col = cv.c("kawara", 1)
                else:
                    # Concave 암키와 pan shaded right + overlap lip
                    if dy == 0:
                        col = cv.c("kawara", 1)
                    elif dy in (1, 2):
                        col = tone(2)
                    elif dy == 3:
                        col = cv.c("ibushi", 1)
                    else:
                        col = cv.c("kuro", 0)
                cv.put(x, y, col)

    # 3. Ornamental Eave Row (수막새 round lotus medallions & 암막새 drip edge, y=37..39)
    for x in range(w):
        if x == 0 or x == w - 1:
            cv.p(x, 37, "kawara", 0)
            cv.put(x, 38, ink0)
            cv.put(x, 39, ink0)
            continue
        tx = x % 4
        tc = x // 4
        hv = h2(tc, 77, seed)
        if tx == 0:
            cv.p(x, 37, "kuro", 0)
            cv.p(x, 38, "kawara", 0)
            cv.put(x, 39, ink0)
        elif tx == 1:
            cv.p(x, 37, "kawara", 5)
            cv.p(x, 38, "ibushi" if hv > 120 else "kawara", 6 if hv > 150 else 5)
            cv.p(x, 39, "kawara", 1)
        elif tx == 2:
            cv.p(x, 37, "ibushi", 4)
            cv.p(x, 38, "kawara", 3)
            cv.put(x, 39, ink0)
        else:
            cv.p(x, 37, "kawara", 2)
            cv.p(x, 38, "kuro", 1)
            cv.put(x, 39, ink0)

    # 4. Tiny weathered moss flecks nestled in lower slate tile crevices
    moss_flecks = [
        (9, 26, 2), (10, 26, 3),
        (14, 30, 2), (15, 31, 4), (16, 31, 3), (15, 32, 1),
        (26, 33, 2), (27, 34, 4), (28, 34, 3),
        (6, 35, 2), (7, 36, 3),
        (40, 34, 2), (41, 35, 3),
    ]
    for mx, my, mi in moss_flecks:
        cv.p(mx, my, "moss", mi)

    # 5. Small rooftop kitchen exhaust flue cap on right slope (x=35..39, y=0..6)
    cv.shadow_rect(40, 2, 41, 7, steps=2)
    cv.hline(35, 39, 0, cv.c("steel", 5))
    cv.p(36, 0, "white", 6)
    cv.hline(34, 40, 1, cv.c("steel", 3))
    cv.put(34, 1, ink0)
    cv.put(40, 1, ink0)
    for y in range(2, 6):
        cv.put(35, y, ink0)
        cv.p(36, y, "steel", 5)
        cv.p(37, y, "steel", 4)
        cv.p(38, y, "steel", 2)
        cv.put(39, y, ink0)
    cv.hline(35, 39, 6, ink0)

    # 6. Sculpted Left & Right Mangwa ridge-end caps + cast shadows
    cv.shadow_rect(cap_w, 4, cap_w + 1, 9, steps=2)
    cv.shadow_rect(1, 8, cap_w, 8, steps=2)
    cv.shadow_rect(w - cap_w, 8, w - 2, 8, steps=2)
    draw_mangwa_cap(cv, 0, 0, width=cap_w)
    draw_mangwa_cap(cv, w - cap_w, 0, width=cap_w)


def build_gukbap(ramps, glyphs) -> Image.Image:
    W, H = 48, 112
    cv = PixelCanvas(W, H, ramps)
    ink0 = cv.c("ink", 0)
    ink1 = cv.c("ink", 1)

    # ------------------------------------------------------------------
    # 1. ROOF (y=0..39): Weathered dark-slate kawara/ibushi Korean giwa roof
    # ------------------------------------------------------------------
    draw_korean_giwa_roof(cv, W, seed=41)

    # ------------------------------------------------------------------
    # 2. 2F WARM CREAM PLASTER + DARK TIMBER LINTELS + WINDOW + EXHAUST DUCT
    # ------------------------------------------------------------------
    for y in range(40, 72):
        for x in range(W):
            if x == 0 or x == W - 1:
                cv.put(x, y, ink0 if x == W - 1 else ink1)
                continue
            if x == 1 or x == W - 2:
                # Vertical dark timber corner posts (기둥)
                cv.p(x, y, "darkwood", 3 if x == 1 else 2)
                continue
            if y in (43, 44):
                # Upper dark timber lintel beam (상인방)
                cv.p(x, y, "darkwood" if y == 43 else "wood", 2 if y == 43 else 3)
            elif y in (58, 59, 60):
                # Mid-wall dark timber tie-beam (중방)
                if y == 58:
                    cv.put(x, y, ink0)
                elif y == 59:
                    cv.p(x, y, "wood", 3 if x % 9 != 0 else 2)
                else:
                    cv.p(x, y, "darkwood", 1)
            else:
                # Calm warm Korean cream/kinari lime plaster
                if y == 45 or y == 61:
                    col = cv.c("cream", 6)
                elif y <= 50:
                    col = cv.c("cream", 5)
                elif y <= 57:
                    col = cv.c("cream", 4)
                elif y <= 66:
                    col = cv.c("kinari", 5)
                else:
                    col = cv.c("cream", 4)
                cv.put(x, y, col)

    # Subtle plaster aging & trowel texture dashes (calm, clean planes)
    for px, py, rmp, idx in [
        (3, 49, "cream", 3), (4, 49, "cream", 3),
        (31, 49, "cream", 3), (32, 49, "kinari", 4),
    ]:
        cv.p(px, py, rmp, idx)

    # Crisp 3px Eave Overhang Cast Shadow (y=40..42)
    cv.hline(0, W - 1, 40, ink0)
    cv.hline(1, W - 2, 41, cv.c("cream", 0))
    cv.hline(2, W - 3, 42, cv.c("cream", 2))

    # 2F Korean Wooden Lattice Sliding Window (한식 격자 미닫이창, x=5..28, y=45..56)
    cv.shadow_rect(29, 46, 30, 57, steps=2)
    cv.shadow_rect(6, 57, 30, 57, steps=2)

    cv.rect(5, 45, 28, 56, ink0)
    cv.hline(6, 27, 45, cv.c("wood", 4))
    cv.vline(6, 46, 55, cv.c("wood", 3))
    cv.vline(27, 46, 55, cv.c("darkwood", 2))

    # Two glowing panes (x=7..16 and x=18..26, y=46..55)
    for px0, pw in [(7, 9), (18, 9)]:
        cx_mid = (pw - 1) / 2.0
        for dy, y in enumerate(range(46, 56)):
            for dx in range(pw):
                x = px0 + dx
                dist = abs(dx - cx_mid) + max(0, 6 - dy) * 0.8
                if dy >= 5 and dist <= 3.8:
                    # Warm golden hanji/amber interior glow
                    if dist <= 1.5:
                        col = cv.c("yellow", 5)
                    elif dist <= 2.7:
                        col = cv.c("yellow", 4)
                    else:
                        col = cv.c("orange", 4)
                elif dy == 4:
                    col = cv.c("cream", 5) if dx not in (1, 2) else cv.c("glass", 5)
                elif dy >= 5:
                    col = cv.c("orange", 3) if dy >= 7 else cv.c("cream", 4)
                else:
                    # Dusk blue upper glass + crisp diagonal sky glint
                    if (dx + dy) in (3, 4):
                        col = cv.c("glass", 6 if (dx + dy) == 3 else 5)
                    elif dy == 0:
                        col = cv.c("glass", 1)
                    else:
                        col = cv.c("glass", 3 if dx <= 3 else 2)
                cv.put(x, y, col)

        # Delicate Korean lattice muntins (살대) inside each pane
        cv.vline(px0 + 4, 46, 55, cv.c("wood", 2))
        cv.hline(px0, px0 + pw - 1, 50, cv.c("wood", 2))

    # Central sliding meeting stile + protruding cedar sill
    cv.vline(16, 46, 55, cv.c("wood", 4))
    cv.vline(17, 46, 55, cv.c("darkwood", 1))
    cv.hline(4, 29, 56, cv.c("cedar", 5))
    cv.p(4, 56, "cedar", 6)
    cv.p(29, 56, "wood", 2)

    # 2F Right: Gleaming Vertical Stainless Kitchen Exhaust Duct Pipe (x=33..44, y=41..71)
    # Cast shadows onto 2F cream wall & timber
    cv.shadow_rect(42, 43, 44, 52, steps=2)
    cv.shadow_rect(44, 53, 45, 62, steps=2)
    cv.shadow_rect(44, 63, 45, 71, steps=2)

    # Conical stainless rain hood (x=34..42, y=41..43)
    cv.hline(36, 40, 41, cv.c("steel", 5))
    cv.p(37, 41, "white", 6)
    cv.hline(34, 42, 42, cv.c("steel", 4))
    cv.put(34, 42, ink0)
    cv.p(36, 42, "white", 6)
    cv.p(37, 42, "steel", 6)
    cv.put(42, 42, ink0)
    cv.hline(34, 42, 43, ink0)

    # Upper cylindrical stainless riser (x=35..41, y=44..52)
    pipe_cols = [
        ink0,
        cv.c("steel", 3),
        cv.c("steel", 5),
        cv.c("steel", 6),
        cv.c("steel", 4),
        cv.c("steel", 2),
        ink0,
    ]
    for y in range(44, 53):
        for dx, col in enumerate(pipe_cols):
            cv.put(35 + dx, y, col)
        if y == 46:
            cv.p(38, y, "white", 6)
        if y in (47, 50):
            # Pipe clamp collar
            cv.put(34, y, ink0)
            cv.put(42, y, ink0)
            cv.p(36, y, "steel", 2)
            cv.p(37, y, "steel", 5)
            cv.p(38, y, "steel", 6)
            cv.p(39, y, "steel", 3)
            cv.p(40, y, "steel", 1)

    # Stainless Exhaust Blower Box w/ louvers (x=33..43, y=53..61)
    cv.rect(33, 53, 43, 61, ink0)
    cv.hline(34, 42, 53, cv.c("steel", 5))
    cv.hline(34, 41, 54, cv.c("steel", 6))
    cv.p(35, 54, "white", 6)
    cv.p(42, 54, "steel", 3)
    for y in range(55, 61):
        for x in range(34, 43):
            if x == 34:
                col = cv.c("steel", 5)
            elif x >= 41:
                col = cv.c("steel", 2 if x == 41 else 1)
            elif y == 60:
                col = cv.c("steel", 2)
            else:
                col = cv.c("steel", 4 if x <= 38 else 3)
            cv.put(x, y, col)
    for ly in (56, 58):
        cv.hline(36, 40, ly, ink0)
        cv.hline(36, 40, ly + 1, cv.c("steel", 5))

    # Lower stainless riser connecting 1F kitchen cauldron hood up into blower box (x=39..43, y=62..71)
    for y in range(62, 72):
        cv.put(39, y, ink0)
        cv.p(40, y, "steel", 5)
        cv.p(41, y, "steel", 6 if y % 4 != 0 else 4)
        cv.p(42, y, "steel", 3)
        cv.put(43, y, ink0)
        if y in (65, 69):
            cv.p(40, y, "steel", 3)
            cv.p(41, y, "steel", 5)
            cv.p(42, y, "steel", 1)

    # ------------------------------------------------------------------
    # 3. 1F DARK CEDAR FACADE + CARVED '국밥' SIGNBOARD + LIVING STOREFRONT
    # ------------------------------------------------------------------
    # Dark cedar wood plank facade (y=72..111)
    for y in range(72, H):
        wy = (y - 72) % 3
        for x in range(W):
            if x == 0 or x == W - 1:
                cv.put(x, y, ink0)
            elif wy == 2:
                cv.p(x, y, "darkwood", 1)
            else:
                hv = h2(x // 4, y // 3, 73)
                if hv > 175 and wy == 0:
                    cv.p(x, y, "cedar", 3)
                elif hv > 70:
                    cv.p(x, y, "wood", 3 if wy == 0 else 2)
                else:
                    cv.p(x, y, "darkwood", 3 if wy == 0 else 2)

    # Structural fascia lintel & eave trim at y=71..73
    cv.hline(0, W - 1, 71, ink0)
    cv.hline(1, W - 2, 72, cv.c("cedar", 4))
    cv.hline(1, W - 2, 73, cv.c("darkwood", 1))

    # BOLD CARVED WOOD-FRAMED SIGNBOARD ('국밥', x=3..38, y=61..75)
    # Cast shadow beneath & right of carved plaque onto 2F/1F cedar facade
    cv.shadow_rect(39, 63, 39, 76, steps=2)
    cv.shadow_rect(4, 76, 39, 77, steps=2)

    # Outer carved cedar timber frame (x=3..38, y=61..75)
    cv.rect(3, 61, 38, 75, ink0)
    cv.hline(4, 37, 62, cv.c("cedar", 6))
    cv.hline(5, 36, 63, cv.c("cedar", 4))
    cv.hline(4, 37, 74, cv.c("wood", 2))
    cv.vline(4, 62, 74, cv.c("cedar", 5))
    cv.vline(37, 62, 74, cv.c("wood", 2))
    # Brass / carved wood corner studs
    for cx, cy in [(4, 62), (37, 62), (4, 74), (37, 74)]:
        cv.p(cx, cy, "yellow", 5 if cy == 62 else 3)

    # Deep charred/lacquered darkwood inner board (x=5..36, y=63..73) with subtle grain
    for y in range(63, 74):
        for x in range(5, 37):
            if y == 63 or x == 5:
                cv.p(x, y, "darkwood", 0)
            elif (x + y * 3) % 11 == 0:
                cv.p(x, y, "darkwood", 2)
            else:
                cv.p(x, y, "darkwood", 1)

    # Red Korean master-seal stamp (낙관, x=7..8, y=67..70) on left of plaque
    cv.rect(7, 67, 8, 70, cv.c("red", 3))
    cv.p(7, 67, "red", 4)
    cv.p(8, 69, "cream", 5)

    # Crisp 9x9 Hangul '국' (x=11..19, y=64..72) & '밥' (x=23..31, y=64..72) from hangul9.json!
    cv.draw_glyph(
        glyphs, "국", 11, 64,
        fg_top=cv.c("cream", 6),
        fg_bot=cv.c("cedar", 6),
        shadow=ink0,
    )
    cv.draw_glyph(
        glyphs, "밥", 23, 64,
        fg_top=cv.c("cream", 6),
        fg_bot=cv.c("cedar", 6),
        shadow=ink0,
    )

    # Tiny steaming soup-bowl crest on right of plaque (x=33..35, y=67..70)
    cv.p(34, 66, "white", 5)
    cv.hline(33, 35, 68, cv.c("cream", 5))
    cv.hline(33, 35, 69, cv.c("cedar", 5))
    cv.p(34, 70, "cedar", 4)

    # ------------------------------------------------------------------
    # 4. 1F LEFT BAY (x=2..21, y=78..111): STEAMING GIANT CAULDRON (가마솥) WINDOW
    # ------------------------------------------------------------------
    # Kitchen window frame (x=2..21, y=78..102)
    cv.rect(2, 78, 21, 102, ink0)
    cv.hline(3, 20, 78, cv.c("cedar", 4))
    cv.vline(3, 79, 101, cv.c("wood", 3))
    cv.vline(20, 79, 101, cv.c("darkwood", 1))

    # Tiled/warm dark kitchen interior backdrop (x=4..19, y=79..100)
    for y in range(79, 101):
        for x in range(4, 20):
            if y <= 83:
                col = cv.c("darkwood", 1 if (x + y) % 4 != 0 else 2)
            elif y <= 90:
                # Subtle tiled kitchen backwall bathed in warm light
                is_grout = (x % 4 == 0) or (y % 4 == 0)
                col = cv.c("stone", 1 if is_grout else 2)
            else:
                col = cv.c("darkwood", 0)
            cv.put(x, y, col)

    # Warm incandescent kitchen bulb + brass shade at top-center (x=10..13, y=79..81)
    cv.hline(10, 13, 79, cv.c("steel", 4))
    cv.hline(11, 12, 80, cv.c("white", 6))
    cv.p(10, 80, "yellow", 5)
    cv.p(13, 80, "yellow", 5)
    cv.hline(10, 13, 81, cv.c("yellow", 4))

    # Hanging stainless ladle & wooden menu tags on kitchen backwall (x=17..19, y=81..88)
    cv.vline(18, 81, 86, cv.c("steel", 5))
    cv.hline(17, 19, 87, cv.c("steel", 6))

    # ICONIC GIANT CAST-IRON / STEEL BROTH CAULDRON (가마솥, x=4..19, y=90..100)
    # Traditional stone/brick stove hearth (아궁이 화덕, x=4..19, y=98..100) + glowing firebox
    cv.rect(4, 98, 19, 100, cv.c("stone", 2))
    cv.hline(4, 19, 98, cv.c("stone", 3))
    cv.rect(8, 99, 15, 100, ink0)
    for fx, fy, fcol in [
        (9, 100, cv.c("red", 3)), (10, 100, cv.c("orange", 4)), (11, 100, cv.c("yellow", 5)),
        (12, 100, cv.c("yellow", 5)), (13, 100, cv.c("orange", 4)), (14, 100, cv.c("red", 4)),
        (10, 99, cv.c("red", 4)), (11, 99, cv.c("orange", 5)), (12, 99, cv.c("orange", 4)), (13, 99, cv.c("red", 3)),
    ]:
        cv.put(fx, fy, fcol)

    # Cauldron heavy rounded iron belly (x=5..18, y=93..98)
    for y in range(93, 99):
        x0 = 6 if y == 98 else 5
        x1 = 17 if y == 98 else 18
        for x in range(x0, x1 + 1):
            if x == x0:
                col = cv.c("kuro", 3)
            elif x in (x0 + 1, x0 + 2):
                col = cv.c("steel", 4 if y in (94, 95) else 3)
            elif x <= 11:
                col = cv.c("kuro", 3 if y <= 96 else 2)
            elif x <= 15:
                col = cv.c("kuro", 2 if y <= 95 else 1)
            else:
                col = cv.c("kuro", 0)
            cv.put(x, y, col)

    # Wide winged Korean 가마솥 flange rim ('전', x=4..19, y=92..93)
    cv.hline(4, 19, 92, cv.c("steel", 5))
    cv.hline(5, 10, 92, cv.c("steel", 6))
    cv.hline(4, 19, 93, cv.c("kuro", 1))
    cv.p(4, 92, "steel", 4)
    cv.p(19, 92, "steel", 2)

    # Milky-white bubbling bone broth (사골/돼지국밥 육수, x=6..17, y=90..91)
    cv.hline(7, 16, 90, cv.c("cream", 5))
    cv.hline(6, 17, 91, cv.c("cream", 6))
    # Rolling broth bubbles & green onion flecks
    for bx in (8, 11, 14):
        cv.p(bx, 90, "white", 6)
        cv.p(bx + 1, 91, "yellow", 5)
    cv.p(10, 91, "green", 4)
    cv.p(15, 91, "orange", 4)

    # Gleaming stainless ladle handle resting diagonally out of the cauldron (x=14..17, y=87..90)
    cv.p(14, 90, "steel", 6)
    cv.p(15, 89, "white", 6)
    cv.p(16, 88, "steel", 5)
    cv.p(17, 87, "steel", 4)

    # BILLOWING WHITE STEAM PLUMES rising visibly inside the left window (y=81..89)
    steam_pixels = [
        # Left plume
        (8, 89, "white", 6), (7, 88, "white", 6), (8, 88, "coolwhite", 5),
        (7, 87, "coolwhite", 5), (6, 86, "coolwhite", 4), (7, 85, "glass", 5),
        (8, 84, "coolwhite", 4), (7, 83, "glass", 4),
        # Center thick plume
        (11, 89, "white", 6), (12, 89, "white", 6),
        (11, 88, "white", 6), (12, 88, "coolwhite", 5),
        (10, 87, "coolwhite", 5), (11, 87, "white", 6),
        (11, 86, "coolwhite", 5), (12, 86, "coolwhite", 4),
        (10, 85, "coolwhite", 4), (11, 85, "glass", 6),
        (11, 84, "glass", 5), (10, 83, "glass", 4),
        # Right plume
        (14, 89, "white", 6), (15, 88, "coolwhite", 5),
        (14, 87, "white", 6), (15, 86, "coolwhite", 4),
        (14, 85, "glass", 5), (15, 84, "glass", 4),
    ]
    for sx, sy, srmp, sidx in steam_pixels:
        cv.p(sx, sy, srmp, sidx)

    # Subtle glass corner reflection + thick cedar counter sill (y=101..102)
    cv.p(4, 79, "glass", 5)
    cv.p(5, 79, "glass", 4)
    cv.p(4, 80, "glass", 4)
    cv.hline(2, 21, 101, cv.c("cedar", 5))
    cv.hline(2, 21, 102, ink0)

    # 1F Left Cedar Wainscot Dado + Curb Stone + Stainless Water Dispenser Cup Box (y=103..111)
    for y in range(103, 112):
        for x in range(2, 22):
            if y == 103:
                cv.p(x, y, "cedar", 3)
            elif y >= 110:
                cv.p(x, y, "stone", 3 if y == 110 else 1)
            elif x % 3 == 0:
                cv.p(x, y, "darkwood", 1)
            else:
                cv.p(x, y, "wood", 2 if y < 107 else 1)

    # Curbside small wooden bench / stool in front of kitchen dado (x=4..13, y=106..111)
    cv.shadow_rect(14, 107, 15, 111, steps=2)
    cv.hline(4, 13, 106, cv.c("cedar", 5))
    cv.p(4, 106, "cedar", 6)
    cv.hline(4, 13, 107, cv.c("wood", 3))
    cv.vline(5, 108, 111, cv.c("cedar", 4))
    cv.vline(6, 108, 111, cv.c("darkwood", 2))
    cv.vline(11, 108, 111, cv.c("cedar", 4))
    cv.vline(12, 108, 111, cv.c("darkwood", 2))

    # ------------------------------------------------------------------
    # 5. 1F CENTER-RIGHT (x=23..36, y=78..111): WOODEN SLATTED SLIDING DOOR
    # ------------------------------------------------------------------
    cv.vline(22, 74, 111, ink0)
    cv.vline(37, 74, 111, ink0)

    # Doorway frame (x=23..36, y=78..110)
    cv.rect(23, 78, 36, 110, ink0)
    cv.hline(23, 36, 78, cv.c("cedar", 4))
    cv.vline(24, 79, 109, cv.c("cedar", 4))
    cv.vline(35, 79, 109, cv.c("wood", 2))

    # Sliding door leaf interior (x=25..34, y=79..109)
    for y in range(79, 110):
        for x in range(25, 35):
            if y in (79, 90, 99, 109):
                # Horizontal cedar door rails
                cv.p(x, y, "cedar" if y <= 90 else "wood", 4 if y == 79 else 3)
            elif y < 99:
                # Upper & mid slatted hanji/glass panels glowing warmly from dining hall
                if x in (27, 30, 32):
                    # Vertical wooden slats (살문)
                    cv.p(x, y, "wood", 3 if x <= 30 else 2)
                else:
                    # Warm golden-amber restaurant interior light
                    if y <= 84:
                        col = cv.c("yellow", 5 if x in (28, 29, 31) else 4)
                    elif y <= 89:
                        col = cv.c("orange", 4 if x <= 31 else 3)
                    elif y <= 94:
                        col = cv.c("yellow", 4 if x <= 29 else 3)
                    else:
                        col = cv.c("orange", 3)
                    cv.put(x, y, col)
            else:
                # Lower solid cedar kick-panel w/ vertical plank grooves
                if x in (28, 31):
                    cv.p(x, y, "darkwood", 2)
                else:
                    cv.p(x, y, "wood", 3 if x < 31 else 2)

    # Recessed brass/darkwood sliding door handle (손잡이, x=33, y=93..96)
    cv.vline(33, 93, 96, ink0)
    cv.p(33, 94, "yellow", 5)
    cv.p(33, 95, "orange", 4)

    # Worn granite doorstep threshold (x=23..36, y=110..111)
    cv.hline(23, 36, 110, cv.c("stone", 5))
    cv.hline(23, 36, 111, cv.c("stone", 3))

    # ------------------------------------------------------------------
    # 6. 1F RIGHT PILLAR & CURB (x=38..46): WARM LANTERN + KIMCHI ONGGI JAR
    # ------------------------------------------------------------------
    # Glowing Warm Hanging Korean Lantern (청사초롱 / 한지등, x=39..45, y=76..90)
    cv.shadow_rect(44, 79, 46, 91, steps=2)
    cv.put(42, 76, ink0)
    cv.hline(40, 44, 77, ink0)
    cv.hline(40, 44, 78, cv.c("darkwood", 2))
    cv.p(41, 78, "cedar", 4)

    for y in range(79, 89):
        rib = (y % 2 == 1)
        x0, x1 = (40, 44) if y in (79, 88) else (39, 45)
        for x in range(x0, x1 + 1):
            dx = abs(x - 42.0)
            dy = abs(y - 83.5) / 2.2
            dist = dx + dy * 0.7
            if x == x0 or x == x1:
                col = cv.c("red", 2 if x == x0 else 1)
            elif dist <= 1.2:
                col = cv.c("white", 6) if (x == 42 and y in (83, 84)) else cv.c("yellow", 5)
            elif dist <= 2.2:
                col = cv.c("yellow", 4) if not rib else cv.c("orange", 4)
            else:
                col = cv.c("orange", 3) if not rib else cv.c("red", 3)
            cv.put(x, y, col)

    cv.hline(40, 44, 89, cv.c("darkwood", 1))
    cv.put(42, 90, cv.c("red", 3))
    cv.put(42, 91, cv.c("yellow", 4))

    # Earthen Glazed Korean Kimchi / Water Onggi Jar (옹기 장독, x=38..46, y=97..111)
    # Stone curb base under right bay
    cv.hline(38, 46, 110, cv.c("stone", 3))
    cv.hline(38, 46, 111, cv.c("stone", 1))

    # Onggi lid knob & overhanging glazed ceramic lid (y=97..99)
    cv.hline(41, 43, 97, cv.c("cha", 5))
    cv.p(41, 97, "cream", 5)
    cv.hline(39, 45, 98, cv.c("cha", 5))
    cv.p(40, 98, "cha", 6)
    cv.p(45, 98, "cha", 2)
    cv.hline(39, 45, 99, ink0)

    # Plump curved Onggi belly (x=38..46, y=100..110) with glossy dark-brown glaze & wavy orchid band
    onggi_spans = {
        100: (39, 45),
        101: (38, 46),
        102: (38, 46),
        103: (38, 46),
        104: (38, 46),
        105: (38, 46),
        106: (38, 46),
        107: (38, 46),
        108: (39, 45),
        109: (39, 45),
        110: (40, 44),
    }
    for y, (ox0, ox1) in onggi_spans.items():
        for x in range(ox0, ox1 + 1):
            if x == ox0:
                col = cv.c("cha", 2)
            elif x == ox1:
                col = ink0 if y >= 104 else cv.c("cha", 0)
            elif y == 110:
                col = cv.c("cha", 1)
            elif x == ox0 + 1 and 101 <= y <= 104:
                # Glossy ceramic specular glaze highlight!
                col = cv.c("cream", 5) if y == 102 else cv.c("cha", 6)
            elif y == 103 and x in (40, 42, 44):
                # Traditional golden-ochre wavy glaze brushstroke band around belly
                col = cv.c("cha", 6)
            elif y == 104 and x in (41, 43):
                col = cv.c("cha", 5)
            elif x <= 41:
                col = cv.c("cha", 4 if y <= 106 else 3)
            elif x <= 43:
                col = cv.c("cha", 3 if y <= 106 else 2)
            else:
                col = cv.c("cha", 1)
            cv.put(x, y, col)

    # Woven straw/hemp collar & ceramic rim highlight on Onggi neck (keeps x=37 door frame razor-clean)
    cv.hline(40, 44, 100, cv.c("straw", 4))
    cv.p(40, 100, "straw", 5)
    cv.p(44, 100, "straw", 2)

    return cv.img


# ==============================================================================
# BUILDING 2: k-noraebang.png (64 x 112) — Vibrant Korean 코인 노래방 (Karaoke)
# ==============================================================================
def draw_noraebang_green_roof(cv: PixelCanvas, x0: int, y0: int, x1: int, y1: int) -> None:
    """Korean commercial rooftop green urethane waterproofing slab with tar seams & drain."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if y == y0 or x == x0:
                cv.p(x, y, "moss", 1)
            elif y <= y0 + 2:
                cv.p(x, y, "green", 2)
            elif y >= y1 - 2:
                cv.p(x, y, "moss", 3)
            else:
                cv.p(x, y, "moss" if (x + y) % 7 == 0 else "green", 2 if y < (y0 + y1) // 2 else 3)

    # Calm sunlit waterproofing sheen bands
    cv.hline(x0 + 3, x1 - 5, y1 - 1, cv.c("moss", 4))
    cv.hline(x0 + 5, x0 + 26, y1 - 2, cv.c("green", 4))

    # Expansion-joint seams
    for sy in (20, 27):
        cv.hline(x0, x1, sy, cv.c("green", 1))
        cv.hline(x0 + 2, x1 - 2, sy + 1, cv.c("moss", 3))
    for sx in (21, 41):
        cv.vline(sx, y0, y1, cv.c("green", 1))

    # Corner scupper drain grate
    cv.rect(x1 - 4, y1 - 2, x1 - 2, y1 - 1, cv.c("steel", 1))
    cv.p(x1 - 3, y1 - 2, "steel", 4)


def draw_rooftop_truss(cv: PixelCanvas, x0: int, y0: int) -> None:
    """
    Tall Korean rooftop galvanized steel sign-frame truss (x=6..33, y=0..26)
    with diagonal X-bracing, concrete anchor pads, beacon lights & diagonal cast shadow.
    """
    ink0 = cv.c("ink", 0)

    # Crisp 45-degree diagonal cast shadows across green waterproofing slab
    for step in range(12):
        for lx in (x0 + 2, x0 + 12, x0 + 22):
            sx = lx + 2 + step
            sy = 16 + step
            if sx <= 59 and sy <= 31:
                cv.p(sx, sy, "green", 0)
                if sx + 1 <= 59:
                    cv.p(sx + 1, sy, "moss", 1)
    cv.hline(x0 + 5, x0 + 30, 26, cv.c("green", 0))
    cv.hline(x0 + 8, x0 + 32, 27, cv.c("green", 0))

    # 3 Concrete anchor footings (y=24..26)
    for px in (x0 + 1, x0 + 11, x0 + 21):
        cv.rect(px, 24, px + 3, 26, cv.c("concrete", 4))
        cv.hline(px, px + 3, 24, cv.c("concrete", 6))
        cv.hline(px, px + 3, 26, cv.c("concrete", 1))

    # Diagonal X-bracing struts inside the 2 truss bays (y=3..23)
    for bay_x in (x0 + 3, x0 + 13):
        for i in range(8):
            # Top-left to bottom-right strut
            cv.p(bay_x + i, 3 + i, "steel", 4 if i < 4 else 3)
            cv.p(bay_x + 7 - i, 3 + i, "steel", 2)
            # Lower bay X-brace
            cv.p(bay_x + i, 13 + i, "steel", 4 if i < 4 else 3)
            cv.p(bay_x + 7 - i, 13 + i, "steel", 2)

    # 3 Tall vertical steel columns (x0+2..3, x0+12..13, x0+22..23, y=1..24)
    for vx in (x0 + 2, x0 + 12, x0 + 22):
        for y in range(1, 25):
            cv.p(vx, y, "steel", 5 if y < 14 else 4)
            cv.p(vx + 1, y, "steel", 1 if y > 8 else 2)

    # Horizontal steel cross-girders (y=2, 11, 20)
    for gy in (2, 11, 20):
        cv.hline(x0 + 1, x0 + 24, gy, cv.c("steel", 5 if gy == 2 else 4))
        cv.hline(x0 + 1, x0 + 24, gy + 1, cv.c("steel", 1))
        cv.p(x0 + 1, gy, "white", 6)

    # Diagonal rear A-frame support struts bracing backward to roof (x0+24..28, y=12..25)
    for s in range(6):
        cv.p(x0 + 24 + (s // 2), 13 + s * 2, "steel", 3)
        cv.p(x0 + 24 + (s // 2), 14 + s * 2, "steel", 1)

    # Neon beacon / starlight accents atop truss posts (y=0..1)
    cv.p(x0 + 2, 0, "pink", 5)
    cv.p(x0 + 3, 0, "pink", 3)
    cv.p(x0 + 12, 0, "teal", 5)
    cv.p(x0 + 13, 0, "glass", 6)
    cv.p(x0 + 22, 0, "pink", 5)
    cv.p(x0 + 23, 0, "pink", 3)
    cv.put(x0 + 2, 1, ink0)
    cv.put(x0 + 12, 1, ink0)
    cv.put(x0 + 22, 1, ink0)


def draw_rooftop_ac_and_duct(cv: PixelCanvas, x0: int, y0: int) -> None:
    """Heavy commercial karaoke HVAC condenser unit (x=38..51, y=13..27) + roof duct hood."""
    x1, y1 = x0 + 13, y0 + 14

    # Diagonal bottom-right cast shadow onto green roof
    for sy in range(y0 + 4, y1 + 3):
        for sx in range(x0 + 3, x1 + 4):
            if sx <= 60 and sy <= 31:
                cv.p(sx, sy, "green", 0 if sy <= y1 + 1 else 1)

    # Rubber mounting feet
    cv.rect(x0 + 1, y1, x0 + 2, y1, cv.c("kuro", 0))
    cv.rect(x1 - 2, y1, x1 - 1, y1, cv.c("kuro", 0))

    # Cabinet outline + sunlit 3/4 top lid
    cv.rect(x0, y0, x1, y1 - 1, cv.c("steel", 1))
    cv.hline(x0 + 1, x1 - 1, y0 + 1, cv.c("white", 6))
    cv.hline(x0 + 1, x1 - 1, y0 + 2, cv.c("coolwhite", 5))
    cv.p(x1 - 1, y0 + 1, "coolwhite", 4)

    # Front body panel gradient
    for y in range(y0 + 3, y1 - 1):
        tone = 4 if y < y0 + 7 else (3 if y < y0 + 11 else 2)
        cv.hline(x0 + 1, x1 - 1, y, cv.c("coolwhite", tone))
    cv.vline(x0 + 1, y0 + 2, y1 - 2, cv.c("coolwhite", 5))
    cv.vline(x1 - 1, y0 + 2, y1 - 2, cv.c("steel", 2))

    # Circular 7x7 turbine fan grille
    fx, fy = x0 + 2, y0 + 4
    fan_map = [
        ".22222.",
        "2131312",
        "2312132",
        "2124212",
        "2312132",
        "2131312",
        ".22222.",
    ]
    for ry, row in enumerate(fan_map):
        for rx, ch in enumerate(row):
            if ch != ".":
                cv.p(fx + rx, fy + ry, "steel", int(ch))

    # Side vents + blue brand badge
    cv.hline(x1 - 3, x1 - 2, y0 + 4, cv.c("blue", 4))
    for ly in range(y0 + 6, y1 - 2, 2):
        cv.hline(x1 - 3, x1 - 2, ly, cv.c("steel", 1))
        cv.hline(x1 - 3, x1 - 2, ly + 1, cv.c("coolwhite", 4))

    # Insulated refrigerant pipes + small exhaust gooseneck on right (x=52..58, y=17..27)
    cv.hline(x1 + 1, x1 + 4, y1 - 3, cv.c("cream", 5))
    cv.hline(x1 + 1, x1 + 4, y1 - 2, cv.c("steel", 2))
    cv.rect(x1 + 4, y0 + 5, x1 + 7, y1 - 1, cv.c("steel", 2))
    cv.hline(x1 + 4, x1 + 7, y0 + 5, cv.c("steel", 5))
    cv.vline(x1 + 5, y0 + 6, y1 - 1, cv.c("steel", 4))


def build_noraebang(ramps, glyphs) -> Image.Image:
    W, H = 64, 112
    cv = PixelCanvas(W, H, ramps)
    ink0 = cv.c("ink", 0)

    # ------------------------------------------------------------------
    # 1. FLAT CONCRETE ROOFTOP + TRUSS + AC + GREEN WATERPROOFING (y=0..39)
    # ------------------------------------------------------------------
    cv.rect(0, 8, W - 1, 39, cv.c("concrete", 2))
    cv.hline(0, W - 1, 8, cv.c("concrete", 4))
    cv.hline(1, W - 2, 9, cv.c("concrete", 6))
    cv.hline(3, W - 4, 10, cv.c("concrete", 3))
    cv.hline(3, W - 4, 11, cv.c("concrete", 0))

    for y in range(9, 33):
        cv.p(0, y, "concrete", 3)
        cv.p(1, y, "concrete", 6)
        cv.p(2, y, "concrete", 4)
        cv.p(W - 3, y, "concrete", 4)
        cv.p(W - 2, y, "concrete", 5)
        cv.p(W - 1, y, "concrete", 1)
    cv.hline(0, 2, 20, cv.c("concrete", 3))
    cv.hline(W - 3, W - 1, 20, cv.c("concrete", 3))

    # Green urethane waterproofed slab (x=3..60, y=12..32)
    draw_noraebang_green_roof(cv, 3, 12, 60, 32)

    # South parapet coping & sleek dark metallic cornice (y=33..39)
    cv.hline(0, W - 1, 33, cv.c("concrete", 5))
    cv.hline(1, W - 2, 34, cv.c("concrete", 6))
    cv.hline(0, W - 1, 35, cv.c("concrete", 4))
    for jx in (16, 32, 48):
        cv.vline(jx, 33, 35, cv.c("concrete", 2))
        cv.vline(jx, 8, 9, cv.c("concrete", 3))
    cv.hline(0, W - 1, 36, cv.c("steel", 3))
    cv.hline(0, W - 1, 37, cv.c("kuro", 2))
    cv.hline(0, W - 1, 38, cv.c("kuro", 1))
    cv.hline(0, W - 1, 39, ink0)

    # Tall Steel Sign-Frame Truss on left-center roof + AC Condenser on right roof
    draw_rooftop_truss(cv, 6, 0)
    draw_rooftop_ac_and_duct(cv, 38, 13)

    # ------------------------------------------------------------------
    # 2. 2F SLEEK DARK-SLATE/NAVY METALLIC WALL + NEON NOTE WINDOWS + '노래방' SIGN
    # ------------------------------------------------------------------
    for y in range(40, 75):
        for x in range(W):
            if y == 40:
                col = ink0
            elif y == 41:
                col = cv.c("navy", 0)
            elif x == 0 or x == W - 1:
                col = ink0 if x == W - 1 else cv.c("kuro", 1)
            elif x == 1:
                col = cv.c("tile", 3)
            elif x == W - 2:
                col = cv.c("kuro", 1)
            elif x in (21, 42):
                # Crisp architectural metallic curtain-wall panel seams
                col = cv.c("kuro", 0)
            elif x in (22, 43):
                col = cv.c("tile", 2)
            elif y == 57:
                col = cv.c("kuro", 1)
            elif y <= 46:
                col = cv.c("tile", 1 if x % 21 < 8 else 0)
            elif y <= 51:
                col = cv.c("kawara", 2 if x % 21 < 10 else 1)
            else:
                col = cv.c("kawara", 1)
            cv.put(x, y, col)

    # Horizontal metallic panel joint line
    cv.hline(2, W - 3, 42, cv.c("kawara", 4))

    # 3 Upstairs Booth Windows w/ Glowing Pink & Cyan Neon Music Notes (y=44..55)
    booth_windows = [
        (4, 19, "pink"),    # Left booth: hot-pink beamed note ♫
        (24, 39, "cyan"),   # Center booth: cyan eighth note ♪ + screen glow
        (44, 59, "duo"),    # Right booth: pink + cyan duet notes
    ]
    for wx0, wx1, mode in booth_windows:
        cv.rect(wx0, 44, wx1, 55, ink0)
        cv.hline(wx0, wx1, 44, cv.c("steel", 4))
        cv.vline(wx0, 44, 55, cv.c("steel", 3))
        cv.vline(wx1, 44, 55, cv.c("steel", 1))
        # Dark tinted booth interior
        for y in range(45, 55):
            for x in range(wx0 + 1, wx1):
                if y <= 47:
                    col = cv.c("navy", 0)
                elif y <= 51:
                    col = cv.c("navy", 1)
                else:
                    col = cv.c("pink" if mode == "pink" else "blue", 0 if mode == "pink" else 1)
                # Subtle diagonal glass sheen
                if (x - wx0) + (y - 45) == 3:
                    col = cv.c("glass", 3)
                cv.put(x, y, col)

        # Sill + cast shadow
        cv.hline(wx0 - 1, wx1 + 1, 55, cv.c("steel", 5))
        cv.hline(wx0, wx1 + 1, 56, ink0)

    # Left Window (x=5..18, y=45..54): Crisp Glowing Hot-Pink Beamed Music Note '♫'
    # Top beam (x=9..15, y=46..47), stems at x=10 & x=15, note heads at (8..10, 51..52) & (13..15, 50..51)
    for nx, ny in [(8, 46), (16, 46), (7, 51), (12, 50)]:
        cv.p(nx, ny, "pink", 2)  # subtle neon halo
    cv.hline(10, 15, 46, cv.c("pink", 5))
    cv.hline(10, 15, 47, cv.c("pink", 4))
    cv.p(11, 46, "white", 6)
    cv.vline(10, 46, 52, cv.c("pink", 5))
    cv.vline(15, 46, 51, cv.c("pink", 5))
    cv.rect(8, 51, 10, 52, cv.c("pink", 5))
    cv.p(9, 51, "white", 6)
    cv.rect(13, 50, 15, 51, cv.c("pink", 5))
    cv.p(14, 50, "white", 6)

    # Center Window (x=25..38, y=45..54): Karaoke Screen Glow + Cyan Neon Note '♪'
    # Mini glowing lyric monitor on left of booth (x=26..30, y=49..53)
    cv.rect(26, 49, 30, 53, cv.c("blue", 3))
    cv.hline(27, 29, 50, cv.c("glass", 6))
    cv.hline(27, 29, 52, cv.c("pink", 4))
    # Disco ball sparkle at ceiling (x=31, y=45..46)
    cv.p(31, 45, "steel", 4)
    cv.p(31, 46, "yellow", 5)
    # Glowing Cyan Eighth Note '♪' (x=33..37, y=46..52)
    cv.vline(35, 46, 52, cv.c("glass", 6))
    cv.p(36, 46, "teal", 5)
    cv.p(37, 47, "teal", 5)
    cv.p(37, 48, "teal", 4)
    cv.rect(33, 51, 35, 52, cv.c("teal", 5))
    cv.p(34, 51, "white", 6)

    # Right Window (x=45..58, y=45..54): Duet Cyan + Pink Neon Notes + Tambourine Ring
    # Cyan note on left (x=47..50, y=46..52)
    cv.vline(49, 46, 51, cv.c("teal", 5))
    cv.p(50, 47, "glass", 6)
    cv.rect(47, 50, 49, 51, cv.c("glass", 6))
    cv.p(47, 51, "teal", 4)
    # Hot-pink note on right (x=53..56, y=47..53)
    cv.vline(55, 47, 52, cv.c("pink", 5))
    cv.p(56, 48, "pink", 4)
    cv.rect(53, 51, 55, 52, cv.c("pink", 5))
    cv.p(54, 51, "white", 6)

    # ------------------------------------------------------------------
    # 3. BOLD INDIGO/MAGENTA BACKLIT NEON SIGNBOARD '노래방' (x=3..60, y=58..74)
    # ------------------------------------------------------------------
    # Outer brushed steel sign housing + top hood
    cv.hline(3, 60, 58, cv.c("steel", 5))
    cv.hline(6, 26, 58, cv.c("steel", 6))
    cv.rect(3, 59, 60, 74, ink0)
    cv.vline(3, 59, 73, cv.c("steel", 4))
    cv.vline(60, 59, 73, cv.c("steel", 1))
    cv.hline(3, 60, 74, cv.c("steel", 1))

    # Rich backlit Indigo-to-Magenta neon acrylic field (x=5..58, y=60..72)
    for y in range(60, 73):
        for x in range(5, 59):
            in_core = (13 <= x <= 49)
            if y in (60, 72) or x in (5, 58):
                # Dark LED channel trough
                cv.p(x, y, "navy", 0)
            elif y == 61:
                cv.p(x, y, "navy", 3 if in_core else 2)
            elif y <= 63:
                cv.p(x, y, "navy", 2 if in_core else 1)
            elif y <= 66:
                cv.p(x, y, "blue", 2 if in_core else 1)
            elif y <= 68:
                cv.p(x, y, "pink", 1 if in_core else 0)
            elif y <= 70:
                cv.p(x, y, "red" if in_core else "maple", 1 if in_core else 0)
            else:
                cv.p(x, y, "maple", 2 if in_core else 0)

    # Bright Marquee LED Border Dots around perimeter (y=60, y=72, x=5, x=58)
    led_cycle = [cv.c("pink", 5), cv.c("glass", 6), cv.c("yellow", 5)]
    led_idx = 0
    for x in range(5, 59, 2):
        cv.put(x, 60, led_cycle[led_idx % 3])
        cv.put(x, 72, led_cycle[(led_idx + 1) % 3])
        led_idx += 1
    for y in (62, 64, 66, 68, 70):
        cv.put(5, y, led_cycle[led_idx % 3])
        cv.put(58, y, led_cycle[(led_idx + 2) % 3])
        led_idx += 1

    # Left marquee accent: Glowing Cyan Neon Note '♪' (x=8..12, y=63..69)
    cv.vline(10, 63, 68, cv.c("glass", 6))
    cv.p(11, 63, "teal", 5)
    cv.p(12, 64, "teal", 4)
    cv.rect(8, 68, 10, 69, cv.c("teal", 5))
    cv.p(9, 68, "white", 6)

    # Right marquee accent: Glowing Golden Coin Emblem (x=51..55, y=64..68)
    coin_rows = [
        ".###.",
        "#***#",
        "#*+*#",
        "#***#",
        ".###.",
    ]
    for ry, row in enumerate(coin_rows):
        for rx, ch in enumerate(row):
            if ch == "#":
                cv.p(51 + rx, 64 + ry, "yellow", 5 if ry < 3 else 4)
            elif ch == "*":
                cv.p(51 + rx, 64 + ry, "orange", 4)
            elif ch == "+":
                cv.p(51 + rx, 64 + ry, "white", 6)

    # CRISP 9x9 HANGUL '노래방' FROM hangul9.json (x=15, 27, 39, y=62..70)
    # Using blazing white-hot top + neon pastel-pink bottom over deep ink0 shadow for razor 1x legibility!
    for gx, gch in [(15, "노"), (27, "래"), (39, "방")]:
        cv.draw_glyph(
            glyphs, gch, gx, 62,
            fg_top=cv.c("white", 6),
            fg_bot=cv.c("pink", 5),
            shadow=ink0,
        )

    # ------------------------------------------------------------------
    # 4. 1F STOREFRONT: BRUSHED STEEL PORTAL + MIC NEON + STARRY DOORS + CHART
    # ------------------------------------------------------------------
    # Brushed steel & dark granite structural frame (y=75..111)
    cv.hline(0, W - 1, 75, ink0)
    cv.hline(0, W - 1, 76, cv.c("steel", 5))
    cv.hline(0, W - 1, 77, ink0)
    cv.hline(1, W - 2, 77, cv.c("steel", 4))
    for sx in range(4, W - 4, 8):
        cv.p(sx, 76, "white", 6)

    for y in range(78, 112):
        for x in range(W):
            if x == 0 or x == W - 1:
                cv.put(x, y, ink0)
            elif x in (1, 16, 46, 62):
                cv.p(x, y, "steel", 5 if x in (1, 46) else 4)
            elif x in (17, 47):
                cv.p(x, y, "steel", 2)
            elif y >= 109:
                cv.p(x, y, "pavement", 2 if y == 109 else 1)
            else:
                cv.p(x, y, "kuro", 2)

    # --- LEFT PANEL (x=2..15, y=78..108): GLOWING PINK/CYAN STANDING MIC NEON ---
    cv.rect(2, 78, 15, 107, cv.c("steel", 3))
    cv.vline(2, 78, 107, cv.c("steel", 5))
    cv.vline(15, 78, 107, cv.c("steel", 1))
    cv.hline(2, 15, 107, cv.c("steel", 1))
    cv.hline(2, 15, 108, ink0)

    # Deep midnight neon display backing (x=3..14, y=79..106)
    for y in range(79, 107):
        for x in range(3, 15):
            cv.p(x, y, "navy" if 81 <= y <= 104 else "ink", 0)

    # Radiating Hot-Pink Neon Soundwave Arcs '(' and ')' around mic head (y=82..88)
    for wy in (83, 84, 85, 86, 87):
        lx = 4 if wy in (84, 85, 86) else 5
        rx = 13 if wy in (84, 85, 86) else 12
        cv.p(lx, wy, "pink", 5 if wy == 85 else 4)
        cv.p(rx, wy, "pink", 5 if wy == 85 else 4)

    # Glowing Cyan Mesh Studio Microphone Capsule (x=7..10, y=81..88)
    cv.hline(8, 9, 81, cv.c("white", 6))
    for y in range(82, 86):
        cv.p(7, y, "glass", 6)
        cv.p(8, y, "white" if y == 83 else "teal", 6 if y == 83 else 5)
        cv.p(9, y, "teal", 5 if (y % 2 == 0) else 4)
        cv.p(10, y, "teal", 4)
    # Hot-pink neon mic ring band (y=86)
    cv.hline(7, 10, 86, cv.c("pink", 5))
    cv.p(8, 86, "white", 6)
    # Lower mic body taper (y=87..88)
    cv.hline(7, 10, 87, cv.c("teal", 4))
    cv.hline(8, 9, 88, cv.c("teal", 3))

    # U-Shaped Pink Neon Mic Yoke Cradle (x=6..11, y=88..90)
    cv.vline(6, 87, 89, cv.c("pink", 4))
    cv.vline(11, 87, 89, cv.c("pink", 4))
    cv.hline(7, 10, 90, cv.c("pink", 5))

    # Gleaming Vertical Cyan/Chrome Stand Pole (x=8..9, y=91..102)
    for y in range(91, 103):
        cv.p(8, y, "glass" if y % 3 != 0 else "white", 6)
        cv.p(9, y, "teal", 3)
    # Height-adjust clutch collar at y=96
    cv.hline(7, 10, 96, cv.c("pink", 4))

    # Glowing Stepped Neon Pedestal Base (x=5..12, y=103..105)
    cv.hline(6, 11, 103, cv.c("teal", 5))
    cv.p(8, 103, "white", 6)
    cv.hline(5, 12, 104, cv.c("pink", 5))
    cv.hline(5, 12, 105, cv.c("pink", 3))

    # --- CENTER WIDE GLOSSY ENTRANCE (x=18..45, y=78..111) ---
    # Automatic door header + glowing sensor eye (y=78..79)
    cv.rect(18, 78, 45, 79, cv.c("steel", 2))
    cv.rect(26, 78, 37, 79, cv.c("kuro", 0))
    cv.p(31, 78, "teal", 5)
    cv.p(32, 78, "pink", 5)

    # Outer & meeting brushed-steel door stiles
    cv.vline(18, 80, 109, cv.c("steel", 5))
    cv.vline(45, 80, 109, cv.c("steel", 3))
    cv.vline(31, 80, 109, cv.c("steel", 5))
    cv.vline(32, 80, 109, cv.c("steel", 2))

    # ILLUMINATED GLASS DOORS SHOWING STARRY HALLWAY & BOOTH LIGHT INSIDE
    # Left pane: x=19..30, y=80..105 | Right pane: x=33..44, y=80..105
    for px0, px1, side in [(19, 30, "L"), (33, 44, "R")]:
        for y in range(80, 106):
            for x in range(px0, px1 + 1):
                if y <= 86:
                    # Starry deep velvet-navy ceiling receding down corridor
                    col = cv.c("navy", 0 if y <= 83 else 1)
                elif y <= 99:
                    # Corridor walls & glowing karaoke booths
                    if side == "L":
                        if x <= 24:
                            # Left booth neon door & glowing window
                            if x == 20 or x == 24 or y == 87:
                                col = cv.c("pink", 4 if y <= 94 else 3)
                            elif 89 <= y <= 94 and 21 <= x <= 23:
                                col = cv.c("yellow", 5 if (x == 22 and y <= 91) else 4)
                            else:
                                col = cv.c("navy", 2)
                        elif x == 25:
                            col = cv.c("kuro", 1)
                        else:
                            # Deep center hallway booth #2 glow
                            if y == 88 and x in (27, 28, 29):
                                col = cv.c("teal", 4)
                            elif 90 <= y <= 95 and x in (27, 28):
                                col = cv.c("blue", 4 if y <= 92 else 3)
                            else:
                                col = cv.c("navy", 1)
                    else:
                        if x >= 39:
                            # Right booth cyan neon door & lyric screen glow
                            if x == 39 or x == 43 or y == 87:
                                col = cv.c("teal", 5 if y <= 94 else 4)
                            elif 89 <= y <= 94 and 40 <= x <= 42:
                                col = cv.c("pink", 5 if (x == 41 and y == 90) else 4) if y <= 91 else cv.c("glass", 5)
                            else:
                                col = cv.c("navy", 2)
                        elif x == 38:
                            col = cv.c("kuro", 1)
                        else:
                            # Deep center hallway booth #3 glow
                            if y == 88 and x in (34, 35, 36):
                                col = cv.c("pink", 4)
                            elif 90 <= y <= 95 and x in (35, 36):
                                col = cv.c("yellow", 4)
                            else:
                                col = cv.c("navy", 1)
                else:
                    # Glossy checkered corridor floor reflecting pink/cyan neon (y=100..105)
                    checker = ((x // 2) + (y - 100)) % 2
                    if checker == 0:
                        col = cv.c("navy", 2 if y <= 102 else 3)
                    else:
                        col = cv.c("pink" if side == "L" else "teal", 2 if y <= 102 else 3)
                cv.put(x, y, col)

    # Twinkling fiber-optic ceiling stars & perspective ceiling neon coves (y=80..86)
    stars = [
        (20, 81, "white", 6), (23, 82, "pink", 5), (26, 81, "glass", 6),
        (28, 83, "yellow", 5), (22, 85, "teal", 5), (29, 85, "white", 6),
        (34, 82, "white", 6), (37, 81, "yellow", 5), (40, 83, "glass", 6),
        (43, 81, "pink", 5), (35, 85, "pink", 5), (41, 85, "white", 6),
    ]
    for sx, sy, srmp, sidx in stars:
        cv.p(sx, sy, srmp, sidx)
    # Perspective neon ceiling strips converging inward (cleanly clear of corner glass glints)
    for i in range(5):
        cv.p(24 + i, 82 + (i // 2), "pink", 4)
        cv.p(39 - i, 82 + (i // 2), "teal", 5)

    # Crisp diagonal exterior specular glass reflections across both doors!
    for d in range(4):
        cv.p(19 + d, 83 - d, "glass", 6 if d in (1, 2) else 5)
        cv.p(20 + d, 83 - d, "glass", 4)
        cv.p(40 + d, 102 - d, "glass", 6 if d in (1, 2) else 5)
        if 41 + d <= 44:
            cv.p(41 + d, 102 - d, "glass", 4)

    # Sleek vertical brushed-chrome pull handles (x=30 & x=33, y=92..98)
    cv.vline(30, 92, 98, cv.c("steel", 6))
    cv.vline(33, 92, 98, cv.c("steel", 6))
    cv.p(30, 93, "white", 6)
    cv.p(33, 93, "white", 6)
    cv.p(30, 92, "steel", 3)
    cv.p(30, 98, "steel", 3)
    cv.p(33, 92, "steel", 3)
    cv.p(33, 98, "steel", 3)

    # Brushed stainless steel door kickplates & LED threshold step (y=106..111)
    for px0, px1 in [(19, 30), (33, 44)]:
        cv.hline(px0, px1, 106, cv.c("steel", 6))
        cv.hline(px0, px1, 107, cv.c("steel", 4))
        cv.hline(px0, px1, 108, cv.c("steel", 3))
    cv.hline(18, 45, 109, cv.c("steel", 5))
    # Glowing cyan/magenta welcome under-step LED strip!
    for x in range(19, 45):
        cv.p(x, 110, "teal" if x < 32 else "pink", 4 if x % 2 == 0 else 3)
    cv.hline(18, 45, 111, cv.c("pavement", 1))

    # --- RIGHT BAY (x=48..61, y=78..108): PRICE & POPULAR SONG-CHART BOARD ---
    cv.rect(48, 78, 61, 104, cv.c("steel", 3))
    cv.hline(48, 61, 78, cv.c("steel", 5))
    cv.vline(48, 78, 104, cv.c("steel", 5))
    cv.vline(61, 78, 104, cv.c("steel", 1))
    cv.hline(48, 61, 105, ink0)

    # Top Coin Rate Header (x=49..60, y=79..84): '500원 2곡 / 1000원 4곡' visual rate badge
    cv.rect(49, 79, 60, 84, cv.c("pink", 2))
    cv.hline(49, 60, 79, cv.c("pink", 4))
    # Mini gold coin icon (x=50..51, y=81..82)
    cv.rect(50, 81, 51, 82, cv.c("yellow", 5))
    cv.p(51, 82, "orange", 4)
    # Crisp rate text bars
    cv.hline(53, 59, 81, cv.c("white", 6))
    cv.hline(53, 58, 83, cv.c("yellow", 5))

    # Illuminated Popular Song-Chart Screen (인기차트, x=49..60, y=85..103)
    cv.rect(49, 85, 60, 103, cv.c("coolwhite", 5))
    cv.hline(49, 60, 85, cv.c("navy", 2))
    cv.hline(50, 56, 85, cv.c("glass", 6))

    chart_rows = [
        (87, "yellow", 5, 59, True),   # #1 Gold hit + pink HOT pip
        (90, "teal",   4, 58, False),  # #2 Cyan hit
        (93, "pink",   4, 59, False),  # #3 Pink hit
        (96, "blue",   4, 57, False),  # #4 Blue hit
        (99, "blue",   3, 58, False),  # #5 Blue hit
    ]
    for ry, bramp, bidx, end_x, is_hot in chart_rows:
        # Rank badge (2x2)
        cv.rect(50, ry, 51, ry + 1, cv.c(bramp, bidx))
        # Song title pixel bar + subtle divider
        cv.hline(53, end_x, ry, cv.c("navy", 2))
        cv.hline(53, end_x - 2, ry + 1, cv.c("coolwhite", 3))
        if is_hot:
            cv.p(59, ry + 1, "red", 4)
        cv.hline(49, 60, ry + 2, cv.c("white", 6))

    # Lower brushed-steel dado & glowing neon trim below chart board (x=48..61, y=106..108)
    cv.rect(48, 106, 61, 108, cv.c("kuro", 1))
    cv.hline(49, 60, 107, cv.c("teal", 4))
    cv.hline(55, 60, 107, cv.c("pink", 4))

    return cv.img


# ==============================================================================
# VERIFICATION & 3x PREVIEW SHEET
# ==============================================================================
def verify_sprite(
    name: str,
    img: Image.Image,
    expected_size: tuple[int, int],
    allowed_rgb: set[tuple[int, int, int]],
    full_wall_y: int,
) -> int:
    assert img.mode == "RGBA", f"{name}: mode must be RGBA, got {img.mode}"
    assert img.size == expected_size, f"{name}: expected {expected_size}, got {img.size}"

    w, h = img.size
    px = img.load()
    off_palette = 0
    pure_black = 0
    bad_alpha = 0
    transparent_wall = 0
    used_colors: set[tuple[int, int, int]] = set()

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a not in (0, 255):
                bad_alpha += 1
            if a == 255:
                if (r, g, b) == (0, 0, 0):
                    pure_black += 1
                if (r, g, b) not in allowed_rgb:
                    off_palette += 1
                used_colors.add((r, g, b))
            elif y >= full_wall_y:
                transparent_wall += 1

    assert bad_alpha == 0, f"{name}: {bad_alpha} non-binary alpha pixels!"
    assert pure_black == 0, f"{name}: {pure_black} pure #000000 pixels!"
    assert off_palette == 0, f"{name}: {off_palette} off-palette pixels!"
    assert transparent_wall == 0, (
        f"{name}: {transparent_wall} transparent pixels at y >= {full_wall_y} (breaks wall-to-wall!)"
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


def save_preview_sheet(gukbap: Image.Image, noraebang: Image.Image, out_path: Path) -> None:
    scale = 3
    g3 = gukbap.resize((gukbap.width * scale, gukbap.height * scale), Image.NEAREST)
    n3 = noraebang.resize((noraebang.width * scale, noraebang.height * scale), Image.NEAREST)

    # Also build a 2x wall-to-wall joined strip to inspect seamless shopfront alignment
    row_1x = Image.new("RGBA", (gukbap.width + noraebang.width, 112), (0, 0, 0, 0))
    row_1x.alpha_composite(gukbap, (0, 0))
    row_1x.alpha_composite(noraebang, (gukbap.width, 0))
    row_2x = row_1x.resize((row_1x.width * 2, row_1x.height * 2), Image.NEAREST)

    pad = 24
    sheet_w = pad + g3.width + pad + n3.width + pad + row_2x.width + pad
    sheet_h = pad + 20 + g3.height + pad

    sheet = make_checkerboard(sheet_w, sheet_h, cell=12)
    draw = ImageDraw.Draw(sheet)

    x_g3 = pad
    x_n3 = x_g3 + g3.width + pad
    x_right = x_n3 + n3.width + pad
    y_top = pad + 20

    draw.text((x_g3, 10), "k-gukbap (3x, 48x112)", fill=(230, 234, 242, 255))
    draw.text((x_n3, 10), "k-noraebang (3x, 64x112)", fill=(230, 234, 242, 255))
    draw.text((x_right, 10), "Wall-to-Wall (2x) + 1x Native", fill=(185, 195, 210, 255))

    sheet.alpha_composite(g3, (x_g3, y_top))
    sheet.alpha_composite(n3, (x_n3, y_top))
    sheet.alpha_composite(row_2x, (x_right, y_top))
    # 1x native underneath the 2x joined row
    y_1x = y_top + row_2x.height + 12
    sheet.alpha_composite(gukbap, (x_right, y_1x - 12 if y_1x + 112 > sheet_h else y_1x))

    # Make sure 1x native fits cleanly with breathing room
    if y_top + row_2x.height + 16 + 112 + pad > sheet_h:
        sheet_h = y_top + row_2x.height + 16 + 112 + pad
        sheet = make_checkerboard(sheet_w, sheet_h, cell=12)
        draw = ImageDraw.Draw(sheet)
        draw.text((x_g3, 10), "k-gukbap (3x, 48x112)", fill=(230, 234, 242, 255))
        draw.text((x_n3, 10), "k-noraebang (3x, 64x112)", fill=(230, 234, 242, 255))
        draw.text((x_right, 10), "Wall-to-Wall Row (2x) & 1x Native", fill=(185, 195, 210, 255))
        sheet.alpha_composite(g3, (x_g3, y_top))
        sheet.alpha_composite(n3, (x_n3, y_top))
        sheet.alpha_composite(row_2x, (x_right, y_top))
        y_native = y_top + row_2x.height + 14
        sheet.alpha_composite(gukbap, (x_right, y_native))
        sheet.alpha_composite(noraebang, (x_right + gukbap.width + 12, y_native))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(out_path)


def main() -> None:
    ramps, allowed_rgb, glyphs = load_resources()
    SHOPS_DIR.mkdir(parents=True, exist_ok=True)

    gukbap_img = build_gukbap(ramps, glyphs)
    noraebang_img = build_noraebang(ramps, glyphs)

    gukbap_cols = verify_sprite("k-gukbap.png", gukbap_img, (48, 112), allowed_rgb, full_wall_y=7)
    noraebang_cols = verify_sprite("k-noraebang.png", noraebang_img, (64, 112), allowed_rgb, full_wall_y=8)

    gukbap_out = SHOPS_DIR / "k-gukbap.png"
    noraebang_out = SHOPS_DIR / "k-noraebang.png"
    gukbap_img.save(gukbap_out)
    noraebang_img.save(noraebang_out)

    save_preview_sheet(gukbap_img, noraebang_img, PREVIEW_PATH)

    print(f"PASS k-gukbap.png:    48x112 RGBA | {gukbap_cols} colors | 0 off-palette | 0 #000000 | binary alpha")
    print(f"PASS k-noraebang.png: 64x112 RGBA | {noraebang_cols} colors | 0 off-palette | 0 #000000 | binary alpha")
    print(f"PASS preview_batch3:  {PREVIEW_PATH}")


if __name__ == "__main__":
    main()
