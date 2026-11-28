#!/usr/bin/env python3
"""
K-Street Fable-Grade Korean Shops — T1 Batch 5/6
Generates two 100% original modern Korean street shopfront buildings from scratch:
  1. k-stationery.png (48x112 RGBA) — Nostalgic school-front 문구점 ('문구')
  2. k-bbq.png        (64x112 RGBA) — Charcoal Korean BBQ 고기집 ('고기')

Strictly uses ONLY:
  - tiledata/jp-city/fable-city/palette.json
  - tiledata/k-street-carbon/hangul9.json
Zero external image loading, sampling, or off-palette colors.
"""

from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
PALETTE_PATH = ROOT / "tiledata/jp-city/fable-city/palette.json"
GLYPHS_PATH = ROOT / "tiledata/k-street-carbon/hangul9.json"
OUT_DIR = ROOT / "tiledata/k-street-carbon/shops"
PREVIEW_PATH = ROOT / "tiledata/k-street-carbon/preview_batch5.png"


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
    with open(GLYPHS_PATH, "r", encoding="utf-8") as f:
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
            "aka", "cha", "rooftile", "kawara", "ibushi", "kuro",
            "brick", "maple", "cream", "kinari", "wood", "cedar",
            "darkwood", "floorwood", "stone", "concrete", "steel", "glass",
            "white", "coolwhite", "foliage", "green", "moss", "red", "orange",
            "yellow", "pink", "blue", "navy", "teal", "tile", "asphalt",
            "pavement", "soil", "straw", "ink",
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
        """Darken an existing opaque pixel along its own material ramp."""
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


def draw_ridge_end_cap(
    cv: PixelCanvas, x0: int, y0: int, width: int, ramp: str, accent_ramp: str
) -> None:
    """Sculpted ridge-end roof cap (막새/망와) with rounded crest, bevels, and medallion."""
    ink0 = cv.c("ink", 0)
    for dy in range(7):
        for dx in range(width):
            x, y = x0 + dx, y0 + dy
            if dy == 0 and (dx == 0 or dx == width - 1):
                continue
            is_top = (dy == 0) or (dy == 1 and (dx == 0 or dx == width - 1))
            is_side = dx == 0 or dx == width - 1
            is_bot = dy == 6
            if is_top or is_side or is_bot:
                cv.put(x, y, ink0)
            else:
                if dx <= 2 and dy <= 2:
                    col = cv.c(ramp, 7) if (dx == 1 and dy == 1) else cv.c(ramp, 6)
                elif dx <= 3 and dy <= 4:
                    col = cv.c(accent_ramp, 4) if (dx == 2 and dy == 3) else cv.c(ramp, 4)
                elif dy == 5 or dx == width - 2:
                    col = cv.c(ramp, 2)
                else:
                    col = cv.c(ramp, 3)
                cv.put(x, y, col)
    mid = x0 + width // 2
    cv.put(mid - 1, y0 + 2, cv.c(ramp, 6))
    cv.put(mid, y0 + 4, cv.c(ramp, 1))


def draw_staggered_tiled_roof(
    cv: PixelCanvas,
    w: int,
    primary_ramp: str,
    secondary_ramp: str,
    cap_w: int = 6,
    add_moss: bool = False,
    soot_zones: list[tuple[int, int]] | None = None,
    seed: int = 17,
) -> None:
    """
    Draws a rich staggered tiled roof across y=1..39:
      - Sculpted end caps at x=0..cap_w-1 and x=w-cap_w..w-1 (y=1..7)
      - Segmented horizontal ridge beam at y=2..6
      - 6 staggered convex tile courses at y=7..36
      - Ornamental round eave tiles (수막새) at y=37..39
      - Guaranteed opaque x=0 and x=w-1 for y=2..39
    """
    ink0 = cv.c("ink", 0)
    max_p = len(cv.ramps[primary_ramp]) - 1

    # 1. Segmented horizontal ridge beam (y=2..6)
    rx0, rx1 = cap_w - 1, w - cap_w
    for x in range(rx0, rx1 + 1):
        seg = (x - rx0) % 5
        is_joint = seg == 0
        cv.put(x, 2, ink0)
        cv.put(x, 3, cv.c("stone", 4) if is_joint else cv.c(primary_ramp, min(6, max_p)))
        if seg == 1:
            cv.put(x, 3, cv.c(primary_ramp, min(7, max_p)))
        cv.put(x, 4, cv.c(secondary_ramp, 3 if is_joint else 5))
        cv.put(x, 5, cv.c(primary_ramp, 1 if is_joint else 3))
        cv.put(x, 6, ink0 if is_joint else cv.c(primary_ramp, 0))

    # End caps on left & right (y=1..7) ensuring y>=2 edges are opaque
    draw_ridge_end_cap(cv, 0, 1, cap_w, primary_ramp, secondary_ramp)
    draw_ridge_end_cap(cv, w - cap_w, 1, cap_w, primary_ramp, secondary_ramp)

    # 2. Staggered Tile Courses (y=7..36, 6 courses x 5px)
    for course in range(6):
        y0 = 7 + course * 5
        stagger = (course % 2) * 2
        course_bias = 0 if course < 5 else -1
        for dy in range(5):
            y = y0 + dy
            for x in range(w):
                if x == 0 or x == w - 1:
                    cv.put(x, y, ink0 if dy == 4 else cv.c(primary_ramp, 2 if x == 0 else 0))
                    continue

                tx = (x + stagger) % 4
                tc = (x + stagger) // 4
                hv = h2(tc, course, seed)
                shift = (1 if hv > 212 else (-1 if hv < 46 else 0)) + course_bias
                use_sec = 68 <= hv <= 136

                # Soot darkening near industrial BBQ exhaust chimneys if specified
                in_soot = False
                if soot_zones:
                    for sx0, sx1 in soot_zones:
                        if sx0 <= x <= sx1 and y <= 28:
                            in_soot = True
                            shift -= 1
                            break

                def tone(level: int) -> tuple[int, int, int, int]:
                    lv = clamp(level + shift, 1, min(6, max_p))
                    if in_soot and (hv & 3) == 0:
                        return cv.c("kuro", clamp(lv - 1, 1, 5))
                    if use_sec:
                        return cv.c(secondary_ramp, clamp(lv, 1, len(cv.ramps[secondary_ramp]) - 2))
                    return cv.c(primary_ramp, lv)

                if tx == 0:
                    if dy in (3, 4):
                        col = ink0 if dy == 4 else cv.c(primary_ramp, 0)
                    else:
                        col = cv.c(primary_ramp, 1 if dy in (1, 2) else 0)
                elif dy == 0:
                    col = tone(3) if tx == 1 else (tone(2) if tx == 2 else cv.c(primary_ramp, 1))
                elif dy == 1:
                    if tx == 1:
                        col = cv.c(primary_ramp, min(7, max_p)) if (hv > 224 and not in_soot) else tone(5)
                    elif tx == 2:
                        col = tone(4)
                    else:
                        col = tone(3)
                elif dy == 2:
                    if tx == 1:
                        col = tone(5)
                    elif tx == 2:
                        col = tone(4)
                    else:
                        col = tone(2)
                elif dy == 3:
                    if tx == 1:
                        col = tone(4)
                    elif tx == 2:
                        col = tone(3)
                    else:
                        col = cv.c(primary_ramp, 1)
                else:
                    if tx == 1:
                        col = tone(3)
                    elif tx == 2:
                        col = cv.c(primary_ramp, 1)
                    else:
                        col = cv.c(primary_ramp, 0)
                cv.put(x, y, col)

    # 3. Ornamental Scalloped Eave Row (y=37..39)
    for x in range(w):
        if x == 0 or x == w - 1:
            cv.put(x, 37, cv.c(primary_ramp, 1))
            cv.put(x, 38, ink0)
            cv.put(x, 39, ink0)
            continue
        tx = x % 4
        tc = x // 4
        hv = h2(tc, 91, seed)
        if tx == 0:
            cv.put(x, 37, cv.c(primary_ramp, 0))
            cv.put(x, 38, cv.c(primary_ramp, 0))
            cv.put(x, 39, ink0)
        elif tx == 1:
            cv.put(x, 37, cv.c(primary_ramp, 5))
            cv.put(x, 38, cv.c(secondary_ramp, 6 if hv > 120 else 5))
            cv.put(x, 39, cv.c(primary_ramp, 1))
        elif tx == 2:
            cv.put(x, 37, cv.c(primary_ramp, 4))
            cv.put(x, 38, cv.c(primary_ramp, 3))
            cv.put(x, 39, ink0)
        else:
            cv.put(x, 37, cv.c(primary_ramp, 2))
            cv.put(x, 38, cv.c(primary_ramp, 1))
            cv.put(x, 39, ink0)

    # 4. Subtle weathered moss / sun-baked flecks on nostalgic terracotta roof
    if add_moss:
        moss_pts = [
            (6, 30, 2), (7, 31, 4), (8, 31, 3),
            (25, 34, 2), (26, 35, 4), (27, 35, 3), (26, 36, 1),
            (38, 29, 2), (39, 30, 3),
        ]
        for mx, my, lv in moss_pts:
            cv.put(mx, my, cv.c("moss", lv))


# ==============================================================================
# BUILDING 1: k-stationery.png (48x112) — Nostalgic School-Front 문구점 ('문구')
# ==============================================================================
def build_k_stationery(ramps: dict, glyphs: dict) -> Image.Image:
    w, h = 48, 112
    cv = PixelCanvas(w, h, ramps)
    ink0 = cv.c("ink", 0)

    # ------------------------------------------------------------------
    # 1. ROOF (y=0..39): Weathered warm terracotta aka/cha + TV antenna
    # ------------------------------------------------------------------
    draw_staggered_tiled_roof(
        cv, w, primary_ramp="aka", secondary_ramp="cha", cap_w=6, add_moss=True, seed=31
    )

    # Extra sun-warmed terracotta highlights from `cha` ramp for cohesive glaze variation
    for rx, ry, rlv in [
        (9, 8, 7), (17, 13, 7), (23, 18, 6), (13, 23, 6), (31, 13, 7), (21, 28, 5)
    ]:
        cv.put(rx, ry, cv.c("cha", rlv))

    # Rooftop Yagi TV Antenna (x=31..39, y=0..14) with diagonal roof cast shadow
    for dx in range(1, 6):
        cv.shadow_pixel(35 + dx, 12 + dx // 2, 2)
        cv.shadow_pixel(35 + dx, 13 + dx // 2, 1)
    # Base bracket bolted to terracotta tile (x=34..36, y=12..14)
    cv.rect(34, 12, 36, 14, ink0)
    cv.put(34, 12, cv.c("steel", 5))
    cv.put(35, 12, cv.c("steel", 4))
    cv.put(35, 13, cv.c("steel", 3))
    # Vertical mast pole (x=35, y=0..12) with dark silhouette contrast
    cv.put(35, 0, ink0)
    for y in range(1, 12):
        cv.put(35, y, cv.c("steel", 5 if y < 6 else 4))
        if y >= 3:
            cv.put(36, y, ink0)
    # Horizontal Yagi dipole elements (sleek metallic bars)
    # Top director (y=1, x=33..37)
    cv.hline(33, 37, 1, cv.c("coolwhite", 5))
    cv.put(32, 1, ink0)
    cv.put(38, 1, ink0)
    cv.hline(33, 37, 2, ink0)
    cv.put(35, 2, cv.c("steel", 5))
    # Middle dipole (y=5, x=32..38)
    cv.hline(32, 38, 5, cv.c("coolwhite", 5))
    cv.hline(32, 38, 6, ink0)
    cv.put(35, 5, cv.c("white", 6))
    # Lower reflector (y=8, x=31..39)
    cv.hline(31, 39, 8, cv.c("steel", 5))
    cv.hline(32, 38, 9, cv.c("aka", 0))
    cv.put(31, 8, cv.c("coolwhite", 5))
    cv.put(39, 8, cv.c("steel", 2))

    # ------------------------------------------------------------------
    # 2. 2F FACADE & SIGNBOARD (y=40..71): Cream/Kinari Plaster + '문구'
    # ------------------------------------------------------------------
    for y in range(40, 72):
        for x in range(w):
            # Left & right structural stone/concrete pilaster edges for crisp wall-to-wall seam
            if x == 0 or x == w - 1:
                cv.put(x, y, cv.c("stone", 1 if x == w - 1 else 2))
                continue
            if x == 1 or x == w - 2:
                cv.put(x, y, cv.c("stone", 4 if x == 1 else 2))
                continue

            hv = h2(x, y, 53)
            band = h2(x // 4, y // 2, 71)
            if band > 155:
                col = cv.c("kinari", 5 if hv > 180 else 4)
            elif hv > 205:
                col = cv.c("cream", 6)
            elif hv < 38:
                col = cv.c("kinari", 3)
            elif hv < 85:
                col = cv.c("cream", 4)
            else:
                col = cv.c("cream", 5)
            cv.put(x, y, col)

    # Subtle weathered plaster stains & hairline crack on 2F wall
    for wx, wy, wcol in [
        (4, 46, cv.c("cream", 3)), (4, 47, cv.c("kinari", 2)), (5, 48, cv.c("cream", 3)),
        (40, 49, cv.c("cream", 3)), (41, 50, cv.c("kinari", 2)), (41, 51, cv.c("cream", 3)),
        (11, 56, cv.c("cream", 2)), (28, 56, cv.c("cream", 2)),
    ]:
        cv.put(wx, wy, wcol)

    # Crisp roof eave cast shadow across y=40..42
    cv.shadow_rect(0, 40, w - 1, 41, steps=2)
    cv.shadow_rect(0, 42, w - 1, 42, steps=1)

    # 2F Warm Wooden Sliding Window (x=6..38, y=43..55)
    wx0, wy0, wx1, wy1 = 6, 43, 38, 55
    # Cast shadow under window sill (y=56) and right edge (x=39)
    cv.shadow_rect(wx0 + 1, wy1 + 1, wx1 + 1, wy1 + 1, steps=2)
    cv.shadow_rect(wx1 + 1, wy0 + 1, wx1 + 1, wy1, steps=1)

    # Outer wooden frame (cedar & wood)
    cv.rect(wx0, wy0, wx1, wy1, ink0)
    cv.hline(wx0 + 1, wx1 - 1, wy0 + 1, cv.c("cedar", 5))
    cv.hline(wx0 + 1, wx1 - 1, wy1 - 1, cv.c("wood", 4))
    cv.vline(wx0 + 1, wy0 + 1, wy1 - 1, cv.c("cedar", 4))
    cv.vline(wx1 - 1, wy0 + 1, wy1 - 1, cv.c("wood", 2))
    # Protruding wooden windowsill at y=55
    cv.hline(wx0 - 1, wx1 + 1, wy1, cv.c("cedar", 5))
    cv.put(wx0 - 1, wy1, ink0)
    cv.put(wx1 + 1, wy1, ink0)
    cv.hline(wx0, wx1, wy1 - 1, cv.c("wood", 2))

    # 3 Window Panes separated by wooden mullions at x=17 and x=27
    panes = [(8, 16), (18, 26), (28, 36)]
    for px0, px1 in panes:
        for py in range(wy0 + 2, wy1 - 1):
            for px in range(px0, px1 + 1):
                # Upper cozy cream/yellow half-curtain (y=45..47)
                if py <= wy0 + 4:
                    pleat = (px - px0) % 3
                    if py == wy0 + 4 and pleat == 1:
                        col = cv.c("glass", 2)
                    else:
                        col = cv.c("yellow", 5 if pleat == 0 else 4) if py == wy0 + 2 else cv.c("cream", 5 if pleat != 2 else 3)
                else:
                    # Glass pane with diagonal sky reflection + warm study-room books/boxes inside
                    diag = (px - px0) + (py - (wy0 + 5))
                    if diag in (2, 3):
                        col = cv.c("glass", 5)
                    elif diag == 6:
                        col = cv.c("glass", 4)
                    else:
                        col = cv.c("glass", 1 if py < wy1 - 4 else 2)
                cv.put(px, py, col)

    # Cozy details inside the 3 window panes (stacked stationery stock boxes + desk lamp + plant)
    # Left pane: miniature colorful stock boxes on shelf
    cv.rect(9, 50, 12, 52, cv.c("cedar", 4))
    cv.hline(9, 12, 50, cv.c("cedar", 6))
    cv.rect(13, 51, 15, 52, cv.c("blue", 4))
    # Center pane: warm glowing globe lamp
    cv.rect(21, 50, 23, 51, cv.c("yellow", 5))
    cv.put(22, 49, cv.c("white", 6))
    cv.put(22, 52, cv.c("wood", 4))
    # Mullions & inner dark sash border
    for mx in (17, 27):
        cv.vline(mx, wy0 + 1, wy1 - 1, cv.c("cedar", 4))
        cv.vline(mx - 1, wy0 + 2, wy1 - 2, ink0)
    # Tiny potted green sprout & red geranium on the right windowsill (x=31..35, y=50..54)
    cv.rect(32, 53, 35, 54, cv.c("brick", 4))
    cv.put(32, 53, cv.c("brick", 5))
    cv.put(32, 51, cv.c("foliage", 5))
    cv.put(33, 50, cv.c("foliage", 6))
    cv.put(33, 52, cv.c("foliage", 3))
    cv.put(34, 51, cv.c("foliage", 4))
    cv.put(35, 51, cv.c("red", 4))
    cv.put(34, 52, cv.c("foliage", 2))

    # Cheerful Cobalt-Blue + Yellow Beveled Signboard reading '문구' (x=3..41, y=57..70)
    sx0, sy0, sx1, sy1 = 3, 57, 41, 70
    # Drop shadow onto plaster at y=71 and x=42
    cv.shadow_rect(sx0 + 1, sy1 + 1, sx1 + 1, sy1 + 1, steps=2)
    cv.shadow_rect(sx1 + 1, sy0 + 1, sx1 + 1, sy1, steps=2)

    # Outer dark casing
    cv.rect(sx0, sy0, sx1, sy1, cv.c("blue", 0))
    # Cheerful yellow beveled frame (y=58 top, y=69 bottom, x=4 left, x=40 right)
    cv.hline(sx0 + 1, sx1 - 1, sy0 + 1, cv.c("yellow", 5))
    cv.hline(sx0 + 1, sx1 - 1, sy1 - 1, cv.c("yellow", 3))
    cv.vline(sx0 + 1, sy0 + 1, sy1 - 1, cv.c("yellow", 4))
    cv.vline(sx1 - 1, sy0 + 1, sy1 - 1, cv.c("yellow", 2))
    # Bright red/orange corner bolts on yellow bevel
    for bx, by in [(sx0 + 1, sy0 + 1), (sx1 - 1, sy0 + 1), (sx0 + 1, sy1 - 1), (sx1 - 1, sy1 - 1)]:
        cv.put(bx, by, cv.c("red", 4))

    # Rich cobalt-blue enamel signboard face (x=5..39, y=59..68 -> 35x10 px)
    for y in range(sy0 + 2, sy1 - 1):
        for x in range(sx0 + 2, sx1 - 1):
            ry = y - (sy0 + 2)
            diag = (x + y) % 13
            if ry == 0:
                col = cv.c("blue", 4)
            elif ry <= 3:
                col = cv.c("blue", 4 if diag in (0, 1) else 3)
            elif ry <= 7:
                col = cv.c("blue", 2)
            else:
                col = cv.c("blue", 1)
            cv.put(x, y, col)

    # Cute pixel Pencil Icon on left of signboard (x=7..9, y=60..67)
    cv.rect(7, 60, 9, 61, cv.c("pink", 4))       # pink eraser
    cv.put(7, 60, cv.c("pink", 5))
    cv.hline(7, 9, 62, cv.c("steel", 5))         # silver ferrule
    cv.rect(7, 63, 9, 65, cv.c("yellow", 4))     # yellow hexagonal barrel
    cv.vline(7, 63, 65, cv.c("yellow", 5))
    cv.vline(9, 63, 65, cv.c("orange", 3))
    cv.hline(7, 9, 66, cv.c("cream", 5))         # sharpened wood cone
    cv.put(8, 67, ink0)                          # graphite lead point

    # Hangul 9x9 Glyphs '문' and '구' from hangul9.json!
    cv.draw_glyph(
        glyphs, "문", 13, 59,
        fg_top=cv.c("white", 6), fg_bot=cv.c("yellow", 5), shadow=cv.c("blue", 0)
    )
    cv.draw_glyph(
        glyphs, "구", 24, 59,
        fg_top=cv.c("white", 6), fg_bot=cv.c("yellow", 5), shadow=cv.c("blue", 0)
    )

    # Cheerful tricolor mini palette/crayon dots on right of signboard (x=35..38, y=60..67)
    cv.rect(36, 60, 37, 61, cv.c("red", 4))
    cv.put(36, 60, cv.c("red", 5))
    cv.rect(36, 63, 37, 64, cv.c("yellow", 5))
    cv.put(36, 63, cv.c("white", 6))
    cv.rect(36, 66, 37, 67, cv.c("green", 4))
    cv.put(36, 66, cv.c("green", 5))

    # ------------------------------------------------------------------
    # 3. 1F LIVING STOREFRONT (y=72..111)
    # ------------------------------------------------------------------
    # Base 1F dark interior & pilaster wall background (y=72..111)
    for y in range(72, 110):
        for x in range(w):
            if x <= 1 or x >= 43:
                cv.put(x, y, cv.c("stone", 3 if x in (1, 43) else 2))
            else:
                cv.put(x, y, cv.c("darkwood", 1))

    # Cheerful Blue-and-Yellow Striped Scalloped Awning (x=1..43, y=72..80)
    cv.hline(1, 43, 72, cv.c("steel", 2))
    for x in range(1, 44):
        if x == 1 or x == 43:
            for y in range(72, 80):
                cv.put(x, y, ink0)
            continue
        stripe = ((x - 2) // 4) % 2
        sx_in = (x - 2) % 4
        ramp = "blue" if stripe == 0 else "yellow"
        for y in range(73, 79):
            dy = y - 73
            # Sloped sunlit awning fabric: bright middle, slightly shaded seam edges
            base_lv = 5 if dy in (1, 2) else (4 if dy in (0, 3) else 3)
            if sx_in == 0:
                base_lv -= 1
            elif sx_in == 1 and dy in (1, 2):
                base_lv = min(5, base_lv + 1)
            cv.put(x, y, cv.c(ramp, clamp(base_lv, 1, 5)))
        # Horizontal crease line at y=78
        cv.put(x, 78, cv.c(ramp, 2))
        # Scalloped valance flaps at y=79..80
        if sx_in in (1, 2):
            cv.put(x, 79, cv.c(ramp, 4 if stripe == 1 else 3))
            cv.put(x, 80, ink0)
        else:
            cv.put(x, 79, cv.c(ramp, 2))
            cv.put(x, 80, ink0 if sx_in == 3 else cv.c("ink", 1))

    # Deep cast shadow directly under scalloped awning (y=81..82)
    cv.hline(2, 42, 81, ink0)

    # --- CENTER-LEFT UPPER WINDOW & PAPER DRAW BOARD behind outdoor machines (x=2..16, y=82..91) ---
    cv.rect(2, 82, 16, 91, cv.c("wood", 2))
    cv.rect(3, 83, 15, 90, cv.c("glass", 1))
    # Nostalgic Korean '추억의 종이 뽑기판' (yellow/red grid poster hanging in left window, x=4..10, y=83..88)
    cv.rect(4, 83, 10, 88, cv.c("yellow", 4))
    for gx in range(5, 10, 2):
        for gy in range(84, 88, 2):
            cv.put(gx, gy, cv.c("red", 3 if (gx + gy) % 4 == 1 else 4))
    # Hanging toy robot blister packs on right of left pane (x=12..14, y=83..88)
    cv.rect(12, 83, 14, 85, cv.c("teal", 4))
    cv.rect(12, 86, 14, 88, cv.c("orange", 4))

    # --- PACKED GLASS DISPLAY WINDOW & STATIONERY/SNACK RACK (x=17..29, y=82..109) ---
    cv.rect(17, 82, 29, 102, cv.c("steel", 3))
    cv.rect(18, 83, 28, 101, cv.c("glass", 1))
    # Warm interior ceiling glow inside display window
    cv.hline(19, 27, 83, cv.c("yellow", 5))
    cv.hline(20, 26, 84, cv.c("cream", 5))
    # Shelf 1 (y=86..90): Upright colorful notebooks, sketchbooks & comic books
    notebook_cols = [
        cv.c("red", 4), cv.c("red", 3), cv.c("yellow", 5), cv.c("blue", 4),
        cv.c("green", 4), cv.c("white", 5), cv.c("pink", 4), cv.c("teal", 4), cv.c("orange", 4),
    ]
    for i, ncol in enumerate(notebook_cols):
        nx = 19 + i
        top_y = 86 if (i % 3 != 1) else 87
        cv.vline(nx, top_y, 90, ncol)
    cv.hline(18, 28, 91, cv.c("cedar", 4))  # wooden shelf

    # Shelf 2 (y=92..97): Color pencil cups, yellow glue jars, miniature model boxes
    cv.rect(19, 93, 21, 96, cv.c("blue", 4))
    cv.put(19, 92, cv.c("red", 4))
    cv.put(20, 92, cv.c("yellow", 5))
    cv.put(21, 92, cv.c("green", 4))
    cv.rect(23, 94, 24, 96, cv.c("yellow", 4))
    cv.hline(23, 24, 93, cv.c("red", 4))
    cv.rect(26, 92, 28, 96, cv.c("orange", 4))
    cv.put(27, 93, cv.c("white", 6))
    cv.hline(18, 28, 97, cv.c("cedar", 3))
    # Crisp diagonal window glass sheen
    for d in range(4):
        cv.put(19 + d, 88 - d, cv.c("glass", 5))
        cv.put(24 + d, 96 - d, cv.c("glass", 4))

    # Outdoor Slanted Snack/Toy Display Rack below window (불량식품 매대, x=17..26, y=99..109)
    cv.rect(17, 99, 26, 109, ink0)
    cv.hline(18, 25, 99, cv.c("blue", 4))
    # Two tiers of colorful snack packets (아폴로, 쫀드기, 꾀돌이!)
    snack_row1 = [cv.c("red", 4), cv.c("yellow", 5), cv.c("orange", 4), cv.c("green", 4), cv.c("pink", 4), cv.c("teal", 4), cv.c("yellow", 4), cv.c("red", 3)]
    snack_row2 = [cv.c("orange", 5), cv.c("blue", 4), cv.c("yellow", 4), cv.c("red", 4), cv.c("green", 5), cv.c("pink", 3), cv.c("cream", 5), cv.c("orange", 3)]
    for i in range(8):
        cv.vline(18 + i, 100, 102, snack_row1[i])
        cv.vline(18 + i, 104, 106, snack_row2[i])
    cv.hline(18, 25, 103, cv.c("steel", 4))
    cv.hline(18, 25, 107, cv.c("blue", 3))
    cv.hline(18, 25, 108, cv.c("blue", 1))

    # Cylindrical Bucket of Rolled Color Poster Paper & Toy Swords (색지/장난감 칼 통, x=26..29, y=97..109)
    cv.rect(26, 102, 29, 109, ink0)
    cv.rect(27, 103, 28, 108, cv.c("red", 3))
    cv.vline(27, 103, 108, cv.c("red", 4))
    # Rolled papers & plastic toy sword hilts sticking up!
    cv.vline(26, 98, 101, cv.c("yellow", 5))
    cv.vline(27, 96, 101, cv.c("pink", 4))
    cv.vline(28, 97, 101, cv.c("teal", 5))
    cv.vline(29, 99, 101, cv.c("blue", 5))

    # --- OUTDOOR LEFT: MINI ARCADE CABINET (x=2..8, y=89..109) ---
    # Classic Korean 문방구 100원 mini sit-down arcade machine!
    cv.rect(2, 89, 8, 109, ink0)
    # Top marquee ('GAME' lit header, y=90..91)
    cv.hline(3, 7, 90, cv.c("yellow", 5))
    cv.put(4, 90, cv.c("red", 4))
    cv.put(6, 90, cv.c("blue", 4))
    # Side white/blue metal cabinet cheeks & glowing CRT screen (y=92..97)
    cv.vline(3, 91, 108, cv.c("coolwhite", 5))
    cv.vline(7, 91, 108, cv.c("blue", 3))
    cv.rect(4, 92, 6, 96, cv.c("glass", 2))
    cv.put(4, 93, cv.c("glass", 6))      # CRT phosphor glow
    cv.put(5, 94, cv.c("yellow", 5))     # tiny game sprite
    cv.put(6, 95, cv.c("red", 4))        # tiny player ship
    cv.put(4, 96, cv.c("green", 4))      # terrain bar
    # Control panel with tiny red ball-top joystick & yellow buttons (y=97..99)
    cv.hline(3, 7, 98, cv.c("coolwhite", 4))
    cv.put(4, 97, cv.c("red", 4))        # red joystick ball
    cv.put(6, 97, cv.c("yellow", 5))     # action button
    # Lower front cabinet & red 100-won coin slot (y=99..108)
    cv.rect(4, 99, 6, 108, cv.c("steel", 2))
    cv.put(5, 101, cv.c("red", 4))       # glowing coin return slot
    cv.put(5, 102, cv.c("steel", 5))
    # Tiny bright plastic child stool right in front (x=3..7, y=105..109)
    cv.hline(3, 7, 105, cv.c("orange", 5))
    cv.hline(3, 7, 106, cv.c("orange", 3))
    cv.vline(3, 107, 109, cv.c("orange", 2))
    cv.vline(7, 107, 109, cv.c("orange", 2))

    # --- OUTDOOR LEFT-CENTER: 2x2 STACKED CAPSULE GACHA STAND (뽑기 기계, x=8..16, y=87..109) ---
    cv.rect(8, 87, 16, 109, ink0)
    gacha_units = [
        (9, 88, "red"),      # top-left gacha (3px wide: x=9..11)
        (13, 88, "yellow"),  # top-right gacha (3px wide: x=13..15)
        (9, 97, "blue"),     # bottom-left gacha
        (13, 97, "green"),   # bottom-right gacha
    ]
    for gx, gy, gramp in gacha_units:
        # Top cap lid
        cv.hline(gx, gx + 2, gy - 1, cv.c(gramp, 4))
        cv.put(gx + 1, gy - 1, cv.c(gramp, 5))
        # Plump 3x3 clear capsule globe (gx..gx+2, gy..gy+2) packed with toy capsules!
        cv.rect(gx, gy, gx + 2, gy + 2, cv.c("glass", 4))
        cv.put(gx, gy, cv.c("white", 6))          # specular dome highlight
        cv.put(gx + 2, gy + 1, cv.c("pink", 4))   # pink capsule
        cv.put(gx, gy + 2, cv.c("yellow", 5))     # yellow capsule
        cv.put(gx + 1, gy + 2, cv.c("red", 4))    # red capsule
        cv.put(gx + 2, gy + 2, cv.c("teal", 4))   # teal capsule
        # Colored metal dispenser body (gy+3..gy+6)
        cv.rect(gx, gy + 3, gx + 2, gy + 6, cv.c(gramp, 3))
        cv.vline(gx, gy + 3, gy + 6, cv.c(gramp, 4))
        cv.put(gx + 1, gy + 4, cv.c("white", 6))  # silver coin turn-dial
        cv.put(gx + 2, gy + 4, cv.c("steel", 4))
        cv.put(gx + 1, gy + 6, ink0)              # prize flap chute
    # Wheeled steel stand base (y=105..109)
    cv.hline(9, 15, 105, cv.c("steel", 5))
    cv.rect(9, 106, 15, 108, cv.c("steel", 2))
    cv.put(9, 109, ink0)
    cv.put(15, 109, ink0)

    # --- RIGHT: SLIDING ENTRANCE DOOR (x=30..42, y=82..109) ---
    dx0, dy0, dx1, dy1 = 30, 82, 42, 109
    cv.rect(dx0, dy0, dx1, dy1, ink0)
    # Blue-anodized / aluminum door frame (x=31..41, y=83..108)
    cv.hline(dx0 + 1, dx1 - 1, dy0 + 1, cv.c("steel", 5))
    cv.vline(dx0 + 1, dy0 + 1, dy1 - 1, cv.c("steel", 5))
    cv.vline(dx1 - 1, dy0 + 1, dy1 - 1, cv.c("steel", 3))
    cv.hline(dx0 + 1, dx1 - 1, dy1 - 1, cv.c("steel", 2))
    # Upper door glass (x=32..40, y=84..95) with warm interior amber light
    for y in range(84, 96):
        for x in range(32, 41):
            if y <= 87 and 34 <= x <= 38:
                col = cv.c("yellow", 4) if y == 84 else cv.c("glass", 3)
            elif (x + y) % 9 == 0:
                col = cv.c("glass", 5)
            else:
                col = cv.c("glass", 2 if y < 90 else 1)
            cv.put(x, y, col)
    # Cheerful '어서오세요' / school sticker badge on door glass (x=34..38, y=89..92)
    cv.rect(34, 89, 38, 92, cv.c("yellow", 5))
    cv.hline(35, 37, 90, cv.c("red", 4))
    cv.hline(35, 37, 91, cv.c("blue", 3))
    # Horizontal push-bar & silver handle (y=96..97)
    cv.hline(31, 41, 96, cv.c("steel", 5))
    cv.hline(31, 41, 97, cv.c("steel", 2))
    cv.vline(32, 93, 99, cv.c("coolwhite", 5))
    # Lower glass / kick-panel (x=32..40, y=98..107)
    cv.rect(32, 98, 40, 104, cv.c("glass", 1))
    cv.put(33, 99, cv.c("glass", 4))
    cv.rect(32, 105, 40, 107, cv.c("blue", 2))
    cv.hline(32, 40, 105, cv.c("blue", 3))

    # --- CONTINUOUS VERTICAL RAIN GUTTER PIPE (x=44..45, y=40..109) ---
    for y in range(40, 110):
        cv.put(44, y, cv.c("steel", 5 if y > 42 else 3))
        cv.put(45, y, cv.c("steel", 2 if y > 42 else 1))
        cv.shadow_pixel(46, y, 1)
    # Collector hopper under roof eave (x=43..46, y=40..43)
    cv.rect(43, 40, 46, 42, cv.c("steel", 3))
    cv.hline(43, 46, 40, ink0)
    cv.put(44, 41, cv.c("steel", 5))
    # Mounting brackets along wall
    for by in (48, 60, 74, 88, 101):
        cv.hline(43, 46, by, cv.c("steel", 1))
        cv.put(44, by, cv.c("coolwhite", 5))
    # Bottom drain shoe kicking out at sidewalk (y=108..109)
    cv.put(43, 109, cv.c("steel", 4))
    cv.put(44, 109, cv.c("steel", 2))

    # --- SIDEWALK CURB & THRESHOLD BASE (y=110..111) ---
    for x in range(w):
        if 30 <= x <= 42:
            # Welcome mat / stone doorstep
            cv.put(x, 110, cv.c("brick", 2) if 32 <= x <= 40 else cv.c("pavement", 4))
        else:
            cv.put(x, 110, cv.c("pavement", 4 if (x % 8 != 0) else 2))
        cv.put(x, 111, ink0 if (x % 8 == 0) else cv.c("pavement", 1))

    return cv.img


# ==============================================================================
# BUILDING 2: k-bbq.png (64x112) — Charcoal Korean BBQ 고기집 ('고기')
# ==============================================================================
def draw_rooftop_bbq_chimney(cv: PixelCanvas, cx: int, base_y: int) -> None:
    """
    Draws a gleaming cylindrical stainless-steel industrial BBQ exhaust stack
    rising from flashing collar at `base_y` up to `y=0`, with conical rain hood
    and crisp diagonal roof cast shadow.
    """
    ink0 = cv.c("ink", 0)

    # 1. Cast shadow falling down-right onto dark-slate kawara tiles first
    for y in range(max(7, base_y - 12), base_y + 3):
        reach = 5 if y >= base_y - 4 else 4
        for dx in range(3, 3 + reach):
            cv.shadow_pixel(cx + dx, y + 2, 2 if dx <= 5 else 1)

    # 2. Rooftop sheet-metal flashing base plate (cx-4..cx+4, base_y-2..base_y+1)
    cv.rect(cx - 4, base_y - 2, cx + 4, base_y + 1, ink0)
    cv.rect(cx - 3, base_y - 1, cx + 3, base_y, cv.c("steel", 3))
    cv.hline(cx - 3, cx + 2, base_y - 1, cv.c("steel", 5))
    cv.put(cx - 3, base_y, cv.c("coolwhite", 4))
    cv.put(cx + 3, base_y, cv.c("steel", 1))

    # 3. Vertical cylindrical stainless shaft (cx-3..cx+3, y=5..base_y-2)
    #    7px wide: [ink0, steel5, white6/coolwhite5, steel4, steel2, steel3, ink0]
    for y in range(5, base_y - 1):
        is_seam = (y % 6 == 0)
        cv.put(cx - 3, y, ink0)
        cv.put(cx + 3, y, ink0)
        if is_seam:
            cv.put(cx - 2, y, cv.c("steel", 3))
            cv.put(cx - 1, y, cv.c("steel", 5))
            cv.put(cx, y, cv.c("steel", 2))
            cv.put(cx + 1, y, cv.c("steel", 1))
            cv.put(cx + 2, y, cv.c("steel", 0))
        else:
            cv.put(cx - 2, y, cv.c("steel", 5))
            cv.put(cx - 1, y, cv.c("white", 6) if y < 14 else cv.c("coolwhite", 5))
            cv.put(cx, y, cv.c("steel", 4))
            cv.put(cx + 1, y, cv.c("steel", 2))
            cv.put(cx + 2, y, cv.c("steel", 3))  # subtle rim bounce light!

    # 4. Dark smoky louvered vent neck (y=3..5)
    cv.rect(cx - 3, 3, cx + 3, 5, ink0)
    cv.put(cx - 2, 4, cv.c("kuro", 2))
    cv.put(cx - 1, 4, cv.c("kuro", 3))
    cv.put(cx, 4, cv.c("kuro", 1))
    cv.put(cx + 1, 4, cv.c("kuro", 0))
    # Subtle grease/soot patina right under vent neck (y=6)
    cv.put(cx + 1, 6, cv.c("ibushi", 2))
    cv.put(cx + 2, 6, cv.c("kuro", 2))

    # 5. Wide conical stainless rain-cap hood (삿갓 후드, y=0..3, cx-5..cx+5)
    # Row 0: apex
    cv.hline(cx - 2, cx + 2, 0, ink0)
    # Row 1: upper cone slope
    cv.hline(cx - 4, cx + 4, 1, ink0)
    cv.put(cx - 3, 1, cv.c("steel", 5))
    cv.put(cx - 2, 1, cv.c("white", 6))
    cv.put(cx - 1, 1, cv.c("coolwhite", 5))
    cv.put(cx, 1, cv.c("steel", 4))
    cv.put(cx + 1, 1, cv.c("steel", 3))
    cv.put(cx + 2, 1, cv.c("steel", 2))
    cv.put(cx + 3, 1, cv.c("steel", 1))
    # Row 2: wide hood brim
    cv.hline(cx - 5, cx + 5, 2, ink0)
    cv.put(cx - 4, 2, cv.c("coolwhite", 5))
    cv.put(cx - 3, 2, cv.c("white", 6))
    cv.put(cx - 2, 2, cv.c("steel", 6))
    cv.put(cx - 1, 2, cv.c("steel", 5))
    cv.put(cx, 2, cv.c("steel", 4))
    cv.put(cx + 1, 2, cv.c("steel", 3))
    cv.put(cx + 2, 2, cv.c("steel", 2))
    cv.put(cx + 3, 2, cv.c("steel", 1))
    cv.put(cx + 4, 2, cv.c("steel", 2))
    # Row 3: dark underside rim of rain hood
    cv.hline(cx - 5, cx + 5, 3, ink0)


def draw_wall_lantern(cv: PixelCanvas, cx: int, ty: int) -> None:
    """Draws a warm glowing Korean timber-framed wall lantern & radial brick glow."""
    ink0 = cv.c("ink", 0)
    # Soft warm radial light wash on surrounding brick pixels first
    for dy in range(-1, 11):
        for dx in range(-5, 6):
            dist = abs(dx) + abs(dy - 5)
            if 4 <= dist <= 6:
                px_x, px_y = cx + dx, ty + dy
                cur = cv.get(px_x, px_y)
                info = cv.color_to_ramp.get(cur)
                if info and info[0] in ("brick", "maple", "stone", "concrete"):
                    rname, idx = info
                    cv.put(px_x, px_y, cv.c(rname, idx + 1))

    # Iron wall bracket & pitched roof cap (ty..ty+2)
    cv.hline(cx - 1, cx + 1, ty, ink0)
    cv.hline(cx - 3, cx + 3, ty + 1, ink0)
    cv.hline(cx - 2, cx + 2, ty + 1, cv.c("kuro", 3))
    cv.put(cx - 1, ty + 1, cv.c("steel", 4))
    cv.hline(cx - 3, cx + 3, ty + 2, ink0)

    # Glowing amber paper/glass lantern body (cx-2..cx+2, ty+3..ty+8)
    for y in range(ty + 3, ty + 9):
        cv.put(cx - 3, y, ink0)
        cv.put(cx + 3, y, ink0)
        for x in range(cx - 2, cx + 3):
            if y == ty + 5:
                # Thin horizontal wooden lattice bar
                col = cv.c("darkwood", 3) if x != cx else cv.c("orange", 4)
            elif x == cx and y in (ty + 4, ty + 6):
                col = cv.c("white", 6)
            elif abs(x - cx) <= 1 and ty + 4 <= y <= ty + 7:
                col = cv.c("yellow", 5)
            else:
                col = cv.c("orange", 4 if y < ty + 7 else 3)
            cv.put(x, y, col)

    # Bottom wooden base & tassel drop (ty+9..ty+10)
    cv.hline(cx - 2, cx + 2, ty + 9, cv.c("darkwood", 2))
    cv.put(cx - 3, ty + 9, ink0)
    cv.put(cx + 3, ty + 9, ink0)
    cv.put(cx, ty + 10, cv.c("red", 3))
    cv.shadow_pixel(cx + 1, ty + 10, 2)


def build_k_bbq(ramps: dict, glyphs: dict) -> Image.Image:
    w, h = 64, 112
    cv = PixelCanvas(w, h, ramps)
    ink0 = cv.c("ink", 0)

    # ------------------------------------------------------------------
    # 1. ROOF (y=0..39): Dark-slate kawara + TWO Stainless BBQ Chimneys
    # ------------------------------------------------------------------
    draw_staggered_tiled_roof(
        cv,
        w,
        primary_ramp="kawara",
        secondary_ramp="ibushi",
        cap_w=7,
        add_moss=False,
        soot_zones=[(12, 23), (42, 54)],
        seed=89,
    )

    # Draw TWO prominent gleaming stainless-steel industrial BBQ exhaust stacks!
    # Left stack centered at cx=17 (emerging through tiles at y=27 up to y=0)
    # Right stack centered at cx=47 (emerging through tiles at y=24 up to y=0)
    # Keeping lower tile courses & roof eave (y=29..39) + eave cast shadow (y=40..42) 100% unbroken!
    draw_rooftop_bbq_chimney(cv, cx=17, base_y=27)
    draw_rooftop_bbq_chimney(cv, cx=47, base_y=24)
    # Diagonal steel wind-guy brace struts anchored onto roof tiles
    for cx, by in [(17, 27), (47, 24)]:
        for d in range(1, 4):
            cv.put(cx - 3 - d, by - 5 + d, cv.c("steel", 4))
            cv.put(cx + 3 + d, by - 5 + d, cv.c("steel", 2))
            cv.shadow_pixel(cx + 3 + d, by - 4 + d, 2)

    # ------------------------------------------------------------------
    # 2. 2F FACADE & SIGNBOARD (y=40..71):
    #    Dark-Red Brick & Weathered Concrete + Horizontal Silver Exhaust Ducts
    #    + Bold Crimson/Dark-Wood '고기' Signboard + Flanking Wall Lanterns
    # ------------------------------------------------------------------
    for y in range(40, 72):
        for x in range(w):
            hv = h2(x, y, 107)
            # Weathered concrete architectural frame:
            # top lintel (y=40..44), bottom belt course (y=70..71), side pilasters (x=0..3, 60..63)
            if y <= 44 or y >= 70 or x <= 3 or x >= 60:
                if x == 0 or x == w - 1:
                    col = cv.c("concrete", 1 if x == w - 1 else 2)
                elif y == 44 or y == 70:
                    col = cv.c("concrete", 2)
                elif y == 71:
                    col = ink0
                else:
                    clv = 4 if hv > 165 else (2 if hv < 45 else 3)
                    col = cv.c("concrete", clv)
                cv.put(x, y, col)
            else:
                # Running-bond dark-red brick facade (y=45..69, x=4..59)
                by = y - 45
                course = by // 3
                dy_in = by % 3
                bx = x + (course % 2) * 3
                dx_in = bx % 6
                bh = h2(bx // 6, course, 211)
                if dy_in == 2 or dx_in == 0:
                    # Weathered dark mortar joint
                    col = cv.c("stone", 2 if (hv > 150 and dy_in == 2) else 1)
                else:
                    # Rich dark-red brick variation across brick + maple
                    if bh < 65:
                        col = cv.c("maple", 3 if dy_in == 0 else 2)
                    elif bh > 195:
                        col = cv.c("brick", 4 if dy_in == 0 else 3)
                    elif bh > 140:
                        col = cv.c("maple", 4 if dy_in == 0 else 3)
                    else:
                        col = cv.c("brick", 3 if dy_in == 0 else 2)
                cv.put(x, y, col)

    # Crisp roof eave cast shadow across y=40..42
    cv.shadow_rect(0, 40, w - 1, 41, steps=2)
    cv.shadow_rect(0, 42, w - 1, 42, steps=1)

    # Horizontal Silver Exhaust Duct Pipes Running Into the 2F Wall (y=44..51)
    # Two horizontal stainless-steel exhaust branches emerge from outer side risers
    # and elbow cleanly INTO recessed dark bolted wall intake flanges at x=15..19 and x=45..49
    # (directly aligned below the two rooftop chimneys, preserving the crisp roof eave shadow y=40..42!)
    cv.shadow_rect(6, 51, 58, 51, steps=2)
    cv.shadow_rect(7, 52, 57, 52, steps=1)

    # Recessed bolted wall-penetration collars where pipes enter the brick wall!
    for fx0 in (14, 44):
        cv.rect(fx0, 44, fx0 + 6, 51, ink0)
        cv.rect(fx0 + 1, 45, fx0 + 5, 50, cv.c("kuro", 2))
        cv.hline(fx0 + 1, fx0 + 5, 45, cv.c("steel", 5))
        cv.put(fx0 + 1, 50, cv.c("steel", 4))
        cv.put(fx0 + 5, 50, cv.c("kuro", 0))

    # Horizontal cylindrical silver exhaust duct pipes running across wall into the collars:
    # Left duct run (x=5..16), Central cross-manifold (x=19..45), Right duct run (x=48..58)
    for x in range(5, 59):
        if x in (14, 20, 44, 50):
            # Raised flange ring
            cv.put(x, 45, ink0)
            cv.put(x, 46, cv.c("white", 6))
            cv.put(x, 47, cv.c("steel", 5))
            cv.put(x, 48, cv.c("steel", 3))
            cv.put(x, 49, cv.c("steel", 1))
            cv.put(x, 50, ink0)
            continue
        is_joint = (x % 7 == 0)
        cv.put(x, 45, ink0)
        cv.put(x, 46, cv.c("steel", 4) if is_joint else cv.c("white", 6))
        cv.put(x, 47, cv.c("steel", 3) if is_joint else cv.c("coolwhite", 5))
        cv.put(x, 48, cv.c("steel", 2) if is_joint else cv.c("steel", 4))
        cv.put(x, 49, cv.c("steel", 1) if is_joint else cv.c("steel", 2))
        cv.put(x, 50, ink0)
    # Left & right end elbows turning into 1F ceiling plenum (x=5..6 and x=57..58, y=46..52)
    for ex in (5, 57):
        cv.rect(ex, 46, ex + 1, 52, ink0)
        cv.put(ex, 47, cv.c("coolwhite", 5))
        cv.put(ex, 48, cv.c("steel", 4))
        cv.put(ex, 49, cv.c("steel", 3))
        cv.put(ex, 50, cv.c("steel", 2))
        cv.put(ex, 51, cv.c("steel", 1))

    # Central stainless inline blower box on the horizontal duct (x=29..34, y=44..51)
    cv.rect(29, 44, 34, 51, ink0)
    cv.rect(30, 45, 33, 50, cv.c("steel", 3))
    cv.hline(30, 33, 45, cv.c("coolwhite", 5))
    cv.put(31, 47, cv.c("kuro", 1))
    cv.put(32, 47, cv.c("steel", 5))
    cv.put(31, 48, cv.c("steel", 1))
    cv.put(32, 48, cv.c("kuro", 1))

    # Flanking Warm Wall Lanterns (left cx=8, right cx=55, y=55..65)
    draw_wall_lantern(cv, cx=8, ty=55)
    draw_wall_lantern(cv, cx=55, ty=55)

    # Bold Crimson / Dark-Wood Framed Signboard reading '고기' (x=14..49, y=54..69)
    sx0, sy0, sx1, sy1 = 14, 54, 49, 69
    # Cast shadow on brick/concrete at x=50 and y=70
    cv.shadow_rect(sx0 + 1, sy1 + 1, sx1 + 1, sy1 + 1, steps=2)
    cv.shadow_rect(sx1 + 1, sy0 + 1, sx1 + 1, sy1, steps=2)

    # Sculpted dark-wood timber frame (2px thick)
    cv.rect(sx0, sy0, sx1, sy1, ink0)
    cv.hline(sx0 + 1, sx1 - 1, sy0 + 1, cv.c("wood", 5))
    cv.hline(sx0 + 1, sx1 - 1, sy1 - 1, cv.c("darkwood", 2))
    cv.vline(sx0 + 1, sy0 + 1, sy1 - 1, cv.c("wood", 4))
    cv.vline(sx1 - 1, sy0 + 1, sy1 - 1, cv.c("darkwood", 2))
    # Brass corner studs
    for bx, by in [(sx0 + 1, sy0 + 1), (sx1 - 1, sy0 + 1), (sx0 + 1, sy1 - 1), (sx1 - 1, sy1 - 1)]:
        cv.put(bx, by, cv.c("yellow", 4))
    # Inner dark recess rim
    cv.rect(sx0 + 2, sy0 + 2, sx1 - 2, sy1 - 2, cv.c("darkwood", 0))

    # Bold crimson lacquer signboard face (x=17..46, y=57..66 -> 30x10 px)
    for y in range(57, 67):
        for x in range(17, 47):
            ry = y - 57
            grain = h2(x // 3, y, 303)
            if ry == 0:
                col = cv.c("red", 3)
            elif ry <= 3:
                col = cv.c("red", 2) if grain > 90 else cv.c("maple", 4)
            elif ry <= 7:
                col = cv.c("maple", 3) if grain > 110 else cv.c("red", 1)
            else:
                col = cv.c("maple", 2)
            cv.put(x, y, col)

    # Small sizzling charcoal flame emblem on left of crimson board (x=18..19, y=60..64)
    cv.put(19, 60, cv.c("yellow", 5))
    cv.put(18, 61, cv.c("orange", 4))
    cv.put(19, 61, cv.c("yellow", 5))
    cv.put(18, 62, cv.c("orange", 5))
    cv.put(19, 62, cv.c("orange", 3))
    cv.hline(18, 19, 63, cv.c("red", 4))

    # Hangul 9x9 Glyphs '고' and '기' from hangul9.json!
    cv.draw_glyph(
        glyphs, "고", 21, 57,
        fg_top=cv.c("cream", 6), fg_bot=cv.c("yellow", 5), shadow=cv.c("darkwood", 0)
    )
    cv.draw_glyph(
        glyphs, "기", 33, 57,
        fg_top=cv.c("cream", 6), fg_bot=cv.c("yellow", 5), shadow=cv.c("darkwood", 0)
    )

    # Traditional golden-ivory seal stamp (낙관) on right margin of signboard (x=43..45, y=62..65)
    cv.rect(43, 62, 45, 65, cv.c("yellow", 4))
    cv.put(44, 63, cv.c("red", 3))
    cv.put(44, 64, cv.c("red", 2))

    # ------------------------------------------------------------------
    # 3. 1F LIVING STOREFRONT (y=72..111):
    #    Wide Glowing Folding-Glass Storefront + Round Silver Hanging Smoke Ducts
    #    over Charcoal-Orange Grills + Timber Sliding Door + Crates & Chalkboard
    # ------------------------------------------------------------------
    # 1F Header / Corrugated Drip Canopy & Timber Fascia (y=72..75)
    for x in range(w):
        cv.put(x, 72, cv.c("steel", 4 if (x % 3 != 0) else 2))
        cv.put(x, 73, cv.c("steel", 1))
        cv.put(x, 74, cv.c("darkwood", 3 if 2 <= x <= 61 else 1))
        cv.put(x, 75, ink0)

    # Left & Right 1F Brick/Concrete Piers (x=0..2 and x=55..63, y=76..109)
    for y in range(76, 110):
        for x in range(w):
            if x <= 2 or x >= 55:
                by = (y - 76) % 3
                if x == 0 or x == w - 1:
                    col = cv.c("concrete", 1 if x == w - 1 else 2)
                elif by == 2:
                    col = cv.c("stone", 1)
                else:
                    col = cv.c("brick", 2 if (x + y) % 5 else 3)
                cv.put(x, y, col)

    # Small glowing red/ivory '영업중' plaque on right pier above chalkboard (x=56..61, y=80..85)
    cv.rect(56, 80, 61, 85, ink0)
    cv.rect(57, 81, 60, 84, cv.c("red", 3))
    cv.hline(57, 60, 82, cv.c("cream", 6))
    cv.put(58, 83, cv.c("yellow", 5))

    # --- WIDE FOLDING-GLASS STOREFRONT (폴딩도어 3칸: x=3..41, y=76..109) ---
    cv.rect(3, 76, 41, 106, cv.c("kuro", 1))
    # Low stone/brick sill curb under full-height folding glass (x=3..41, y=107..109)
    for y in range(107, 110):
        for x in range(3, 42):
            if y == 107:
                cv.put(x, y, cv.c("concrete", 4))
            else:
                cv.put(x, y, cv.c("brick", 1 if (x % 5 != 0) else 2))

    # 3 Folding-Glass Bays: (4..14), (16..27), (29..40)
    bays = [(4, 14, 9), (16, 27, 21), (29, 40, 34)]
    for bx0, bx1, cx in bays:
        # Warm smoky K-BBQ interior backdrop (y=77..105)
        for y in range(77, 106):
            for x in range(bx0, bx1 + 1):
                dist = abs(x - cx)
                if y <= 82:
                    col = cv.c("wood", 3 if (x % 3 != 0) else 2)
                elif y <= 91:
                    col = cv.c("floorwood", 2 if dist <= 3 else 1)
                elif y <= 96:
                    col = cv.c("orange", 2 if dist <= 4 else 1)
                else:
                    col = cv.c("darkwood", 2 if dist <= 3 else 1)
                cv.put(x, y, col)

        # Mini wooden Korean menu plaques on back wall (원조 삼겹살 / 갈비살, y=79..83)
        for mx in (bx0 + 1, bx1 - 2):
            cv.rect(mx, 79, mx + 1, 83, cv.c("cedar", 6))
            cv.put(mx, 80, cv.c("darkwood", 2))
            cv.put(mx, 82, cv.c("red", 3))

        # --- UNMISTAKABLY KOREAN ROUND SILVER HANGING SMOKE DUCT (자바라 후드!) ---
        # Telescoping silver accordion pipe dangling from y=77..87 at cx-1..cx+1
        for y in range(77, 88):
            rib = (y % 2 == 0)
            cv.put(cx - 1, y, cv.c("white", 6) if not rib else cv.c("steel", 5))
            cv.put(cx, y, cv.c("coolwhite", 5) if not rib else cv.c("steel", 3))
            cv.put(cx + 1, y, cv.c("steel", 2) if not rib else cv.c("steel", 1))
        # Tiny damper valve tab on side of silver duct (classic Korean 자바라 detail!)
        cv.put(cx + 2, 85, cv.c("orange", 4))
        # Flared round bell suction hood at y=88..90 (cx-2..cx+2) catching orange firelight!
        cv.hline(cx - 2, cx + 2, 88, cv.c("steel", 5))
        cv.put(cx - 2, 88, cv.c("white", 6))
        cv.put(cx + 2, 88, cv.c("steel", 2))
        cv.hline(cx - 2, cx + 2, 89, cv.c("orange", 4))
        cv.put(cx - 2, 89, cv.c("yellow", 5))
        cv.put(cx + 2, 89, cv.c("steel", 2))
        cv.hline(cx - 1, cx + 1, 90, ink0)

        # Wisps of rising BBQ smoke sucked between grill (y=93) and hood (y=90)
        cv.put(cx - 1, 91, cv.c("coolwhite", 4))
        cv.put(cx + 1, 92, cv.c("cream", 4))
        cv.put(cx, 91, cv.c("white", 5))

        # --- GLOWING CHARCOAL-ORANGE TABLETOP GRILL & DRUM TABLE (숯불 드럼통 식탁, y=93..105) ---
        cv.hline(bx0 + 1, bx1 - 1, 95, cv.c("steel", 4))
        cv.hline(bx0 + 1, bx1 - 1, 96, cv.c("steel", 3))
        cv.hline(bx0 + 2, bx1 - 2, 97, cv.c("steel", 1))
        # Central sunken blazing charcoal grill (cx-2..cx+2, y=93..96)
        cv.hline(cx - 2, cx + 2, 94, cv.c("orange", 4))
        cv.hline(cx - 2, cx + 2, 95, cv.c("red", 4))
        cv.put(cx - 1, 94, cv.c("yellow", 5))
        cv.put(cx, 94, cv.c("white", 6))
        cv.put(cx + 1, 94, cv.c("orange", 5))
        cv.put(cx, 93, cv.c("pink", 4))
        cv.put(cx - 1, 95, cv.c("orange", 5))
        cv.put(cx + 1, 95, cv.c("yellow", 4))
        # Iconic green Soju bottle & ssam lettuce bowl on table edge!
        if bx1 - cx >= 4:
            cv.vline(cx + 3, 93, 95, cv.c("green", 4))
            cv.put(cx + 3, 92, cv.c("white", 5))
        if cx - bx0 >= 4:
            cv.put(cx - 3, 94, cv.c("green", 5))
            cv.put(cx - 3, 95, cv.c("white", 5))
        # Iconic Korean cylindrical Drum-Can BBQ Table body (드럼통, cx-2..cx+2, y=98..105)
        for y in range(98, 106):
            rib = (y in (100, 103))
            cv.put(cx - 2, y, cv.c("steel", 4 if rib else 3))
            cv.put(cx - 1, y, cv.c("steel", 5 if rib else 4))
            cv.put(cx, y, cv.c("kuro", 3 if rib else 2))
            cv.put(cx + 1, y, cv.c("kuro", 2 if rib else 1))
            cv.put(cx + 2, y, ink0)
        # Flanking round cushioned drum stools (원형 의자, y=100..105)
        if cx - bx0 >= 5:
            cv.hline(cx - 5, cx - 4, 100, cv.c("red", 3))
            cv.rect(cx - 5, 101, cx - 4, 105, cv.c("kuro", 2))
        if bx1 - cx >= 5:
            cv.hline(cx + 4, cx + 5, 100, cv.c("red", 3))
            cv.rect(cx + 4, 101, cx + 5, 105, cv.c("kuro", 2))

        # Subtle upper-corner folding-glass reflection glint
        cv.put(bx0 + 1, 78, cv.c("glass", 5))
        cv.put(bx0, 79, cv.c("glass", 5))
        cv.put(bx0 + 2, 78, cv.c("glass", 4))

    # Folding-glass vertical mullions & brass/steel folding hinges at x=15 and x=28
    for mx in (15, 28):
        cv.vline(mx, 76, 106, cv.c("kuro", 1))
        cv.put(mx, 82, cv.c("steel", 5))
        cv.put(mx, 96, cv.c("steel", 5))
        cv.put(mx, 104, cv.c("steel", 4))

    # --- STACKED OUTDOOR SOJU CRATES & OAK CHARCOAL BOX (x=2..14, y=96..109) ---
    # Left stack: 2 Green Korean Soju Crates (초록 소주 박스, x=2..8, y=96..109)
    cv.rect(2, 97, 8, 109, ink0)
    # Green bottle necks & white caps peeking out of top crate (y=96..97)
    for gx in (3, 5, 7):
        cv.put(gx, 96, cv.c("white", 5))
        cv.put(gx, 97, cv.c("green", 4))
    # Top green crate (y=98..102)
    cv.rect(3, 98, 7, 102, cv.c("green", 3))
    cv.hline(3, 7, 98, cv.c("green", 5))
    cv.put(4, 100, cv.c("green", 1))
    cv.put(6, 100, cv.c("green", 1))
    cv.hline(3, 7, 103, ink0)
    # Bottom green crate (y=104..108)
    cv.rect(3, 104, 7, 108, cv.c("green", 2))
    cv.hline(3, 7, 104, cv.c("green", 4))
    cv.put(4, 106, cv.c("green", 0))
    cv.put(6, 106, cv.c("green", 0))

    # Right stack beside it: Kraft Oak-Charcoal Box ('참숯' 상자, x=9..14, y=101..109) + Blue Beer Crate
    cv.rect(9, 101, 14, 109, ink0)
    # Black lump charcoal piled in top of open box (y=100..102)
    cv.hline(10, 13, 100, cv.c("kuro", 1))
    cv.put(11, 100, cv.c("kuro", 3))
    cv.put(12, 101, cv.c("orange", 3))  # warm ember hint / label accent
    # Kraft cardboard '참숯' box body (y=102..108)
    cv.rect(10, 102, 13, 108, cv.c("straw", 4))
    cv.hline(10, 13, 102, cv.c("straw", 5))
    cv.hline(10, 13, 105, cv.c("red", 3))  # red Korean '참숯' band
    cv.vline(13, 103, 108, cv.c("straw", 2))

    # --- TIMBER SLIDING ENTRANCE DOOR (원목 격자 미닫이문, x=42..54, y=76..109) ---
    dx0, dy0, dx1, dy1 = 42, 76, 54, 109
    cv.rect(dx0, dy0, dx1, dy1, ink0)
    # Outer cedar door jamb
    cv.hline(dx0 + 1, dx1 - 1, dy0 + 1, cv.c("cedar", 5))
    cv.vline(dx0 + 1, dy0 + 1, dy1 - 1, cv.c("cedar", 4))
    cv.vline(dx1 - 1, dy0 + 1, dy1 - 1, cv.c("wood", 3))
    # Door panel (x=44..52, y=78..108)
    cv.rect(44, 78, 52, 108, cv.c("wood", 4))
    cv.vline(44, 78, 108, cv.c("cedar", 5))
    cv.vline(52, 78, 108, cv.c("wood", 2))
    # Upper warm glowing shoji/amber glass lattice window (x=45..51, y=79..92)
    for y in range(79, 93):
        for x in range(45, 52):
            if x == 48 or y in (83, 88):
                col = cv.c("darkwood", 3)
            elif y <= 82:
                col = cv.c("yellow", 5) if x in (46, 47, 49) else cv.c("orange", 4)
            elif y <= 87:
                col = cv.c("orange", 4) if x != 51 else cv.c("orange", 3)
            else:
                col = cv.c("orange", 3)
            cv.put(x, y, col)
    # Vertical wooden plank grain on lower door (y=94..108)
    for y in range(94, 109):
        for x in range(45, 52):
            if x in (47, 50):
                cv.put(x, y, cv.c("wood", 2))
            else:
                cv.put(x, y, cv.c("cedar", 4 if x < 49 else 3))
    # Brass/wood vertical door handle (x=45, y=94..99)
    cv.vline(45, 94, 99, cv.c("yellow", 5))
    cv.put(45, 99, cv.c("orange", 3))

    # --- OUTDOOR A-FRAME CHALKBOARD MENU (입간판, x=54..62, y=94..109) ---
    cv.rect(54, 95, 61, 107, ink0)
    # Wooden easel frame
    cv.hline(55, 60, 95, cv.c("cedar", 5))
    cv.vline(54, 95, 109, cv.c("cedar", 5))
    cv.vline(61, 95, 109, cv.c("wood", 3))
    cv.put(62, 103, cv.c("wood", 2))  # A-frame rear leg
    cv.vline(62, 104, 109, ink0)
    # Dark slate chalkboard face (x=55..60, y=96..105)
    cv.rect(55, 96, 60, 105, cv.c("kuro", 0))
    # Colorful chalk menu lines ('오늘의 한돈 / 삼겹살 / 소주')
    cv.hline(56, 59, 97, cv.c("yellow", 5))   # yellow title
    cv.hline(56, 58, 99, cv.c("pink", 4))     # pink meat special
    cv.put(59, 99, cv.c("white", 6))
    cv.hline(56, 59, 101, cv.c("white", 5))   # menu line 2
    cv.hline(56, 57, 103, cv.c("orange", 4))  # charcoal icon
    cv.put(59, 103, cv.c("green", 4))         # green soju chalk icon!
    cv.hline(55, 60, 106, cv.c("cedar", 4))   # bottom wooden ledge

    # --- SIDEWALK CURB & THRESHOLD BASE (y=110..111) ---
    for x in range(w):
        if 42 <= x <= 53:
            # Stone doorstep in front of sliding timber door
            cv.put(x, 110, cv.c("concrete", 4 if x < 51 else 3))
            cv.put(x, 111, cv.c("concrete", 2))
        else:
            cv.put(x, 110, cv.c("concrete", 3 if (x % 8 != 0) else 1))
            cv.put(x, 111, ink0 if (x % 8 == 0) else cv.c("kuro", 1))

    return cv.img


# ==============================================================================
# VERIFICATION & 3x CHECKERBOARD PREVIEW
# ==============================================================================
def verify_sprite(
    name: str,
    img: Image.Image,
    expected_size: tuple[int, int],
    allowed_rgb: set[tuple[int, int, int]],
) -> dict:
    assert img.mode == "RGBA", f"{name}: mode must be RGBA, got {img.mode}"
    assert img.size == expected_size, f"{name}: size must be {expected_size}, got {img.size}"

    w, h = img.size
    px = img.load()
    off_palette = 0
    bad_alpha = 0
    pure_black = 0
    opaque_colors: set[tuple[int, int, int]] = set()
    transparent_px = 0

    side_gaps = 0
    interior_holes = 0
    for y in range(3, h):
        if px[0, y][3] != 255 or px[w - 1, y][3] != 255:
            side_gaps += 1
    for y in range(7, h):
        for x in range(w):
            if px[x, y][3] != 255:
                interior_holes += 1

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a not in (0, 255):
                bad_alpha += 1
            if a == 0:
                transparent_px += 1
            else:
                rgb = (r, g, b)
                opaque_colors.add(rgb)
                if rgb == (0, 0, 0):
                    pure_black += 1
                if rgb not in allowed_rgb:
                    off_palette += 1

    assert off_palette == 0, f"{name}: found {off_palette} off-palette pixels!"
    assert bad_alpha == 0, f"{name}: found {bad_alpha} non-binary alpha pixels!"
    assert pure_black == 0, f"{name}: found {pure_black} pure #000000 pixels!"
    assert side_gaps == 0, f"{name}: found {side_gaps} wall-to-wall side gap rows!"
    assert interior_holes == 0, f"{name}: found {interior_holes} interior transparent holes below roof ridge!"
    assert 60 <= len(opaque_colors) <= 95, (
        f"{name}: unique color count {len(opaque_colors)} outside target [60..95]!"
    )

    return {
        "name": name,
        "size": f"{w}x{h}",
        "unique_colors": len(opaque_colors),
        "transparent_px": transparent_px,
        "off_palette": off_palette,
        "bad_alpha": bad_alpha,
        "pure_black": pure_black,
        "side_gaps": side_gaps,
        "status": "PASS",
    }


def make_checkerboard_preview(sprites: list[tuple[str, Image.Image]], scale: int = 3) -> Image.Image:
    """
    Renders a 3x crisp nearest-neighbor preview sheet on #23262e dark slate checkerboard:
      - Individual 3x views with spacing
      - Seamless wall-to-wall 3x street lineup check
      - 1x native sprites
    """
    bg_dark = (0x23, 0x26, 0x2E, 255)
    bg_lite = (0x2A, 0x2E, 0x38, 255)
    pad = 24
    gap = 28
    top_header = 32

    indiv_w = sum(im.width * scale for _, im in sprites) + gap * (len(sprites) - 1)
    seamless_w = sum(im.width * scale for _, im in sprites)
    native_w = sum(im.width for _, im in sprites) + 12 * (len(sprites) - 1)

    total_w = pad * 2 + indiv_w + gap + seamless_w + gap + native_w
    total_h = top_header + max(im.height * scale for _, im in sprites) + pad

    sheet = Image.new("RGBA", (total_w, total_h), bg_dark)
    spx = sheet.load()
    for y in range(top_header - 6, total_h - pad // 2):
        for x in range(pad - 6, total_w - pad + 6):
            if ((x // 12) + (y // 12)) % 2 == 1:
                spx[x, y] = bg_lite

    draw = ImageDraw.Draw(sheet)
    cx = pad
    for label, im in sprites:
        draw.text((cx, 8), f"{label} (3x)", fill=(232, 236, 244, 255))
        up = im.resize((im.width * scale, im.height * scale), Image.Resampling.NEAREST)
        sheet.alpha_composite(up, (cx, top_header))
        cx += up.width + gap

    draw.text((cx, 8), "Wall-to-Wall Seam Check (3x)", fill=(168, 224, 184, 255))
    sx = cx
    for _, im in sprites:
        up = im.resize((im.width * scale, im.height * scale), Image.Resampling.NEAREST)
        sheet.alpha_composite(up, (sx, top_header))
        sx += up.width
    cx = sx + gap

    draw.text((cx, 8), "1x native", fill=(180, 186, 198, 255))
    for _, im in sprites:
        sheet.alpha_composite(im, (cx, top_header))
        cx += im.width + 12

    return sheet.convert("RGB")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)

    ramps, allowed_rgb, glyphs = load_resources()

    stationery = build_k_stationery(ramps, glyphs)
    bbq = build_k_bbq(ramps, glyphs)

    stationery_path = OUT_DIR / "k-stationery.png"
    bbq_path = OUT_DIR / "k-bbq.png"
    stationery.save(stationery_path)
    bbq.save(bbq_path)

    stats_stationery = verify_sprite("k-stationery.png", stationery, (48, 112), allowed_rgb)
    stats_bbq = verify_sprite("k-bbq.png", bbq, (64, 112), allowed_rgb)

    preview = make_checkerboard_preview(
        [("k-stationery 48x112", stationery), ("k-bbq 64x112", bbq)],
        scale=3,
    )
    preview.save(PREVIEW_PATH)

    print("PASS: K-Street Batch 5 (k-stationery + k-bbq) generated & verified!")
    print(json.dumps({"k-stationery": stats_stationery, "k-bbq": stats_bbq}, indent=2))


if __name__ == "__main__":
    main()
