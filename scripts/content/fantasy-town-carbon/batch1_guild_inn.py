#!/usr/bin/env python3
"""
T4 Fantasy Town Fable-Grade Buildings — Batch 1/5
Generates 2 original Fable-5.2-grade medieval fantasy town landmark buildings:
  1. ft-guild.png (80x112 RGBA, 5x7 tiles) — Adventurers' Guild Hall (모험가 길드)
  2. ft-inn.png   (64x112 RGBA, 4x7 tiles) — Traveler's Cozy Inn (여행자 여관)

100% locked to tiledata/jp-city/fable-city/palette.json:
  - 0 off-palette pixels
  - 0 pure #000000 pixels
  - strict binary alpha {0, 255}
  - 60-95 color richness per building
  - pictorial medieval fantasy signboards (zero modern text)
"""

from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
PALETTE_PATH = ROOT / "tiledata/jp-city/fable-city/palette.json"
OUT_DIR = ROOT / "tiledata/fantasy-town-carbon/buildings"
PREVIEW_PATH = ROOT / "tiledata/fantasy-town-carbon/preview_batch1.png"


def hex_to_rgba(hx: str) -> tuple[int, int, int, int]:
    hx = hx.lstrip("#")
    return (int(hx[0:2], 16), int(hx[2:4], 16), int(hx[4:6], 16), 255)


def load_palette() -> tuple[dict[str, list[tuple[int, int, int, int]]], set[tuple[int, int, int]]]:
    with open(PALETTE_PATH, "r", encoding="utf-8") as f:
        pal_raw = json.load(f)["ramps"]
    ramps: dict[str, list[tuple[int, int, int, int]]] = {
        k: [hex_to_rgba(c) for c in v] for k, v in pal_raw.items()
    }
    allowed_rgb: set[tuple[int, int, int]] = {
        (c[0], c[1], c[2]) for cols in ramps.values() for c in cols
    }
    return ramps, allowed_rgb


def h2(x: int, y: int, seed: int = 0) -> int:
    """Deterministic spatial integer hash (0..255)."""
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
            "tile", "kawara", "rooftile", "cha", "aka", "brick", "cream", "kinari",
            "wood", "cedar", "darkwood", "floorwood", "stone", "concrete", "pavement",
            "flagstone", "steel", "glass", "white", "coolwhite", "foliage", "green",
            "moss", "red", "maple", "orange", "yellow", "pink", "blue", "navy",
            "teal", "ibushi", "kuro", "asphalt", "soil", "straw", "ink",
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

    def put(self, x: int, y: int, col: tuple[int, int, int, int] | None) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = (0, 0, 0, 0) if col is None else col

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

    def line(self, x0: int, y0: int, x1: int, y1: int, col: tuple[int, int, int, int]) -> None:
        dx = abs(x1 - x0)
        sx = 1 if x0 < x1 else -1
        dy = -abs(y1 - y0)
        sy = 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            self.put(x0, y0, col)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

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

    def warm_pixel(self, x: int, y: int, steps: int = 1) -> None:
        """Brighten an opaque stone/wood pixel slightly along its ramp for lantern light."""
        cur = self.get(x, y)
        if cur[3] == 0:
            return
        info = self.color_to_ramp.get(cur)
        if info is None:
            return
        rname, idx = info
        self.put(x, y, self.c(rname, idx + steps))


# ==============================================================================
# SHARED MEDIEVAL ARCHITECTURAL PRIMITIVES
# ==============================================================================
def draw_ashlar_wall(
    cv: PixelCanvas,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    base_ramp: str = "stone",
    alt_ramp: str = "concrete",
    seed: int = 17,
) -> None:
    """Dressed medieval ashlar masonry with beveled sunlit top-left edges & mortar."""
    c = cv.c
    course_h = 5
    for y in range(y0, y1 + 1):
        cy = (y - y0) // course_h
        ry = (y - y0) % course_h
        stagger = (cy % 2) * 5
        for x in range(x0, x1 + 1):
            bx = (x - x0 + stagger) // 9
            rx = (x - x0 + stagger) % 9
            hv = h2(bx, cy, seed)
            rname = alt_ramp if (hv % 4 == 0) else base_ramp
            shift = 1 if hv > 200 else (-1 if hv < 50 else 0)

            if ry == course_h - 1 or rx == 0:
                # Mortar joint
                col = c(base_ramp, 1) if (ry == course_h - 1 and rx == 0) else c(rname, 2)
            elif ry == 0 and rx >= 1:
                # Top sunlit stone edge
                col = c(rname, clamp(5 + shift, 3, 6))
            elif rx == 1:
                # Left sunlit stone bevel
                col = c(rname, clamp(5 + shift, 3, 6))
            elif ry == course_h - 2 or rx == 8:
                # Bottom/right stone bevel
                col = c(rname, clamp(3 + shift, 2, 5))
            else:
                # Stone face with subtle grain
                grain = 1 if h2(x, y, seed + 3) > 225 else (-1 if h2(x, y, seed + 7) < 28 else 0)
                col = c(rname, clamp(4 + shift + grain, 2, 6))
            cv.put(x, y, col)

    # Outer vertical stone quoin framing on left & right edges
    for y in range(y0, y1 + 1):
        q_idx = ((y - y0) // 4) % 2
        q_w = 4 if q_idx == 0 else 3
        for dx in range(q_w):
            # Left quoin
            lx = x0 + dx
            if dx == 0:
                cv.put(lx, y, c("ink", 0))
            elif (y - y0) % 4 == 3 or dx == q_w - 1:
                cv.put(lx, y, c("stone", 2))
            elif (y - y0) % 4 == 0 or dx == 1:
                cv.put(lx, y, c("stone", 6))
            else:
                cv.put(lx, y, c("stone", 4))
            # Right quoin
            rx_pos = x1 - dx
            if dx == 0:
                cv.put(rx_pos, y, c("ink", 0))
            elif (y - y0) % 4 == 3 or dx == q_w - 1:
                cv.put(rx_pos, y, c("stone", 1))
            elif (y - y0) % 4 == 0:
                cv.put(rx_pos, y, c("stone", 5))
            else:
                cv.put(rx_pos, y, c("stone", 3))


def draw_plaster_panel(
    cv: PixelCanvas,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    ramp: str = "cream",
    seed: int = 31,
) -> None:
    """Warm medieval lime-plaster infill with subtle hand-troweled variation & recessed edge shadow."""
    c = cv.c
    max_i = len(cv.ramps[ramp]) - 1
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            hv = h2(x, y, seed)
            if y == y0 or x == x0:
                # Recessed shadow right under/beside dark timber frame
                col = c(ramp, max(2, max_i - 3))
            elif y == y0 + 1 and x > x0:
                col = c(ramp, max(3, max_i - 2))
            elif y == y1 or x == x1:
                # Subtle plaster lip catchlight before lower/right timber
                col = c(ramp, max_i)
            else:
                if hv > 225:
                    col = c(ramp, max_i)
                elif hv < 26:
                    col = c(ramp, max_i - 2)
                else:
                    col = c(ramp, max_i - 1)
            cv.put(x, y, col)


def draw_timber_beam_h(cv: PixelCanvas, x0: int, x1: int, y0: int, h: int = 3, pegs: bool = True) -> None:
    """Horizontal dark-oak structural beam with woodgrain & peg studs."""
    c = cv.c
    for y in range(y0, y0 + h):
        dy = y - y0
        for x in range(x0, x1 + 1):
            hv = h2(x, y, 91)
            if dy == 0:
                col = c("wood", 4) if hv > 140 else c("darkwood", 4)
            elif dy == h - 1:
                col = c("darkwood", 0)
            else:
                col = c("darkwood", 3 if hv > 160 else 2)
            cv.put(x, y, col)
    if pegs and h >= 3:
        for px_x in range(x0 + 4, x1 - 2, 8):
            cv.put(px_x, y0 + 1, c("cedar", 4))


def draw_timber_post_v(cv: PixelCanvas, x0: int, y0: int, y1: int, w: int = 3) -> None:
    """Vertical dark-oak timber post with sunlit left bevel & dark right groove."""
    c = cv.c
    for y in range(y0, y1 + 1):
        for dx in range(w):
            hv = h2(x0 + dx, y, 73)
            if dx == 0:
                col = c("wood", 3) if hv > 120 else c("darkwood", 4)
            elif dx == w - 1:
                col = c("darkwood", 0)
            else:
                col = c("darkwood", 3 if hv > 150 else 2)
            cv.put(x0 + dx, y, col)


def draw_x_brace(cv: PixelCanvas, x0: int, y0: int, x1: int, y1: int, plaster_ramp: str = "cream") -> None:
    """Crisp St. Andrew's X half-timber cross inside a plaster panel."""
    c = cv.c
    draw_plaster_panel(cv, x0, y0, x1, y1, plaster_ramp)
    w = x1 - x0
    h = y1 - y0
    steps = max(w, h)
    if steps <= 0:
        return
    # Draw shadow first
    for i in range(steps + 1):
        xa = x0 + round(i * w / steps)
        xb = x1 - round(i * w / steps)
        ya = y0 + round(i * h / steps)
        cv.shadow_pixel(xa, min(y1, ya + 1), 1)
        cv.shadow_pixel(xb, min(y1, ya + 1), 1)
    # Draw 2px crisp crossed oak struts
    for i in range(steps + 1):
        xa = x0 + round(i * w / steps)
        xb = x1 - round(i * w / steps)
        ya = y0 + round(i * h / steps)
        cv.put(xa, ya, c("darkwood", 3))
        if xa + 1 <= x1:
            cv.put(xa + 1, ya, c("darkwood", 1))
        cv.put(xb, ya, c("darkwood", 3))
        if xb - 1 >= x0:
            cv.put(xb - 1, ya, c("darkwood", 1))
    # Central wooden peg boss at intersection
    mx = (x0 + x1) // 2
    my = (y0 + y1) // 2
    cv.put(mx, my, c("cedar", 4))


def draw_diag_brace(
    cv: PixelCanvas, x0: int, y0: int, x1: int, y1: int, slope_down_right: bool, plaster_ramp: str = "cream"
) -> None:
    """Single diagonal oak wind-brace inside a narrow plaster panel."""
    c = cv.c
    draw_plaster_panel(cv, x0, y0, x1, y1, plaster_ramp)
    w = x1 - x0
    h = y1 - y0
    steps = max(w, h)
    for i in range(steps + 1):
        x = (x0 + round(i * w / steps)) if slope_down_right else (x1 - round(i * w / steps))
        y = y0 + round(i * h / steps)
        cv.shadow_pixel(x, min(y1, y + 1), 1)
    for i in range(steps + 1):
        x = (x0 + round(i * w / steps)) if slope_down_right else (x1 - round(i * w / steps))
        y = y0 + round(i * h / steps)
        cv.put(x, y, c("darkwood", 3))
        if x + 1 <= x1:
            cv.put(x + 1, y, c("darkwood", 1))


def draw_flowerbox(
    cv: PixelCanvas,
    x0: int,
    y0: int,
    x1: int,
    flower_cols: list[tuple[int, int, int, int]],
    seed: int = 55,
) -> None:
    """Lush cascading medieval window flowerbox (5px tall + shadow)."""
    c = cv.c
    # Wooden planter trough (y0+2 .. y0+4)
    for x in range(x0, x1 + 1):
        if x == x0 or x == x1:
            cv.put(x, y0 + 2, c("darkwood", 1))
            cv.put(x, y0 + 3, c("darkwood", 0))
            cv.put(x, y0 + 4, c("ink", 0))
        else:
            cv.put(x, y0 + 2, c("cedar", 4))
            cv.put(x, y0 + 3, c("wood", 3))
            cv.put(x, y0 + 4, c("darkwood", 1))
    # Iron brackets & cast shadow below box
    cv.shadow_rect(x0 + 1, y0 + 5, x1, y0 + 5, 2)
    cv.put(x0 + 2, y0 + 5, c("steel", 1))
    cv.put(x1 - 2, y0 + 5, c("steel", 1))

    # Cascading foliage mound (y0 .. y0+2, spilling onto y0+3)
    for x in range(x0, x1 + 1):
        hv = h2(x, y0, seed)
        top_y = y0 if (x0 + 1 <= x <= x1 - 1 and hv > 65) else y0 + 1
        for y in range(top_y, y0 + 3):
            lh = h2(x, y, seed + 11)
            if y == top_y:
                col = c("foliage", 5 if lh > 120 else 4)
            elif y == y0 + 2 and lh < 90:
                col = c("foliage", 1)
            else:
                col = c("foliage", 3 if lh > 100 else 2)
            cv.put(x, y, col)
        # Trailing leaf tips over box front
        if hv > 175 and x0 + 1 < x < x1 - 1:
            cv.put(x, y0 + 3, c("foliage", 2))

    # Vivid blossoms clustered every 3px
    for i, bx in enumerate(range(x0 + 2, x1 - 1, 3)):
        fcol = flower_cols[i % len(flower_cols)]
        by = y0 + (i % 2)
        cv.put(bx, by, fcol)
        if bx + 1 < x1:
            cv.put(bx + 1, by + 1, c("foliage", 5) if i % 2 == 1 else fcol)


def draw_iron_lantern(cv: PixelCanvas, cx: int, ty: int, cast_on_wall: bool = True) -> None:
    """Glowing medieval wrought-iron lantern with radial golden wall wash."""
    c = cv.c
    if cast_on_wall:
        for dy in range(-2, 11):
            for dx in range(-5, 6):
                dist = abs(dx) + abs(dy - 4)
                if dist <= 4:
                    cv.warm_pixel(cx + dx, ty + dy, 2)
                elif dist <= 7:
                    cv.warm_pixel(cx + dx, ty + dy, 1)

    # Iron wall bracket & chain
    cv.hline(cx - 2, cx + 1, ty, c("steel", 1))
    cv.put(cx, ty + 1, c("steel", 2))
    # Hexagonal cap
    cv.hline(cx - 1, cx + 1, ty + 2, c("steel", 3))
    cv.hline(cx - 2, cx + 2, ty + 3, c("kuro", 1))
    # Blazing glass cage (ty+4 .. ty+7)
    for y in range(ty + 4, ty + 8):
        cv.put(cx - 2, y, c("kuro", 1))
        cv.put(cx + 2, y, c("kuro", 0))
        cv.put(cx - 1, y, c("yellow", 5 if y <= ty + 5 else 4))
        cv.put(cx, y, c("white", 6) if y == ty + 5 else c("yellow", 5))
        cv.put(cx + 1, y, c("orange", 4 if y >= ty + 6 else 5))
    # Bottom finial
    cv.hline(cx - 2, cx + 2, ty + 8, c("kuro", 1))
    cv.put(cx, ty + 9, c("steel", 1))


# ==============================================================================
# BUILDING 1: ft-guild.png (80x112) — Adventurers' Guild Hall (모험가 길드)
# ==============================================================================
def build_ft_guild(ramps: dict[str, list[tuple[int, int, int, int]]]) -> Image.Image:
    cv = PixelCanvas(80, 112, ramps)
    c = cv.c
    ink0 = c("ink", 0)

    # ------------------------------------------------------------------
    # 1. GRAND COBALT-SLATE STAGGERED ROOF (y=0..42, x=0..79)
    # ------------------------------------------------------------------
    # Ridge crest beam (y=4..8) spanning x=4..75
    for x in range(4, 76):
        seg = (x - 4) % 6
        is_joint = (seg == 0)
        cv.put(x, 4, ink0)
        cv.put(x, 5, c("kawara", 3) if is_joint else c("tile", 6))
        if seg == 2:
            cv.put(x, 5, c("yellow", 4))  # subtle brass ridge rivet
        cv.put(x, 6, c("tile", 2) if is_joint else c("tile", 4))
        cv.put(x, 7, c("navy", 2) if is_joint else c("tile", 2))
        cv.put(x, 8, ink0 if is_joint else c("tile", 0))

    # Sculpted stone & slate gable ridge finials at left (x=0..5) and right (x=74..79)
    for ox in (0, 74):
        for dy in range(2, 10):
            for dx in range(6):
                x = ox + dx
                if dy == 2 and dx in (0, 5):
                    continue
                if dy == 2 or dy == 9 or dx in (0, 5):
                    cv.put(x, dy, ink0)
                elif dy == 3:
                    cv.put(x, dy, c("stone", 6 if dx <= 2 else 4))
                elif dy in (4, 5) and dx in (2, 3):
                    cv.put(x, dy, c("yellow", 4 if dy == 4 else 2))  # brass boss
                else:
                    cv.put(x, dy, c("stone", 4 if dx <= 2 else 2))

    # Staggered Cobalt-Slate Shingle Courses (y=9..38, 6 courses x 5px)
    for course in range(6):
        y0 = 9 + course * 5
        stagger = (course % 2) * 3
        course_bias = 0 if course < 4 else (-1 if course == 5 else 0)
        for dy in range(5):
            y = y0 + dy
            for x in range(80):
                if x == 0 or x == 79:
                    # Sculpted verge border
                    cv.put(x, y, ink0)
                    continue
                if x == 1 or x == 78:
                    cv.put(x, y, c("stone", 5 if x == 1 else 3) if dy < 4 else c("stone", 2))
                    continue

                tx = (x + stagger) % 5
                tc = (x + stagger) // 5
                hv = h2(tc, course, 204)
                shift = (1 if hv > 210 else (-1 if hv < 45 else 0)) + course_bias
                # Mix cobalt `tile` and weathered `kawara` slates + deep `navy` crevices
                if 60 <= hv <= 108:
                    sramp = "kawara"
                else:
                    sramp = "tile"

                def slate_tone(lv: int) -> tuple[int, int, int, int]:
                    max_l = len(cv.ramps[sramp]) - 1
                    idx = clamp(lv + shift, 1, max_l)
                    return c(sramp, idx)

                if tx == 0:
                    # Vertical joint between slate shingles
                    col = ink0 if dy == 4 else (c("navy", 0) if dy == 3 else c("tile", 1))
                elif dy == 0:
                    # Soft overlap shadow under upper shingle
                    col = slate_tone(2 if tx in (1, 2) else 1)
                elif dy == 1:
                    # Sunlit upper-left bevel of cobalt slate
                    if tx == 1:
                        col = c("tile", 6) if hv > 195 else slate_tone(5)
                    elif tx in (2, 3):
                        col = slate_tone(4)
                    else:
                        col = slate_tone(3)
                elif dy == 2:
                    # Main slate face (subtle royal blue sheen on select slates)
                    if tx == 2 and 110 <= hv <= 135:
                        col = c("blue", 2)
                    else:
                        col = slate_tone(5 if tx == 1 else (4 if tx == 2 else (3 if tx == 3 else 2)))
                elif dy == 3:
                    # Lower bevel
                    col = slate_tone(4 if tx == 1 else (3 if tx in (2, 3) else 1))
                else:
                    # Chiseled bottom slate lip & overlap shadow
                    col = c("tile", 2) if tx == 1 else (c("navy", 0) if tx in (2, 3) else ink0)
                cv.put(x, y, col)

    # Ornamental Cobalt Eave Drip Course (y=39..41)
    for x in range(80):
        if x in (0, 79):
            cv.vline(x, 39, 41, ink0)
            continue
        tx = x % 4
        cv.put(x, 39, c("tile", 5 if tx == 1 else (3 if tx == 2 else 1)))
        cv.put(x, 40, c("tile", 6 if tx == 1 else (4 if tx == 2 else 0)))
        cv.put(x, 41, ink0)

    # Subtle moss clusters nestled near slate eaves
    for mx, my, mi in [(6, 36, 3), (7, 37, 4), (8, 37, 2), (68, 35, 2), (69, 36, 4), (70, 36, 3)]:
        cv.put(mx, my, c("moss", mi))

    # ------------------------------------------------------------------
    # 1B. DRESSED STONE CHIMNEY ON LEFT ROOF (x=9..17, y=1..22)
    # ------------------------------------------------------------------
    # Cast diagonal shadow from chimney onto cobalt-slate roof first
    for sy in range(8, 25):
        span = min(6, max(1, (sy - 6) // 2))
        cv.shadow_rect(18, sy, 17 + span, sy, 2)

    # Chimney shaft (x=10..16, y=5..21)
    draw_ashlar_wall(cv, 10, 5, 16, 21, "stone", "concrete", seed=88)
    cv.vline(10, 5, 21, ink0)
    cv.vline(16, 5, 21, ink0)
    # Stepped lead flashing where chimney meets roof (y=21..22)
    cv.hline(9, 17, 21, c("kawara", 2))
    cv.hline(10, 16, 22, ink0)
    # Corbeled stone chimney cap (x=9..17, y=2..5)
    cv.hline(9, 17, 2, ink0)
    cv.hline(9, 17, 3, c("stone", 6))
    cv.put(9, 3, ink0)
    cv.put(17, 3, ink0)
    cv.hline(9, 17, 4, c("stone", 3))
    cv.put(9, 4, ink0)
    cv.put(17, 4, ink0)
    cv.hline(10, 16, 5, ink0)
    # Twin clay chimney pots (y=0..2)
    for px_x in (11, 14):
        cv.put(px_x, 0, c("brick", 4))
        cv.put(px_x + 1, 0, c("ink", 1))
        cv.put(px_x, 1, c("brick", 3))
        cv.put(px_x + 1, 1, c("brick", 1))

    # ------------------------------------------------------------------
    # 1C. CENTRAL PEAKED ㅅ-GABLE DORMER + BRASS FINIAL (x=24..55, y=0..41)
    # ------------------------------------------------------------------
    # Cast diagonal shadow to the right of the dormer onto main slate roof
    for y in range(14, 40):
        d = min(15, y - 6)
        rx_edge = 40 + d
        for sx in range(rx_edge + 1, min(77, rx_edge + 6)):
            cv.shadow_pixel(sx, y, 2)

    # Dormer plaster & timber gable face inside triangle (apex at x=39..40, y=7)
    for y in range(8, 42):
        half = min(13, y - 7)
        lx = 39 - half
        rx = 40 + half
        for x in range(lx, rx + 1):
            hv = h2(x, y, 121)
            cv.put(x, y, c("cream", 6 if hv > 200 else (4 if hv < 35 else 5)))

    # Dormer side cheek posts (x=26..27 and x=52..53, y=21..41)
    draw_timber_post_v(cv, 26, 21, 41, 2)
    draw_timber_post_v(cv, 52, 21, 41, 2)
    # Dormer horizontal collar tie-beam (y=35..36) & sill apron
    draw_timber_beam_h(cv, 26, 53, 35, 2, pegs=False)
    draw_x_brace(cv, 28, 37, 38, 41, "cream")
    draw_x_brace(cv, 41, 37, 51, 41, "cream")
    draw_timber_post_v(cv, 39, 9, 41, 2)

    # Warm-lit arched dormer guild window (x=34..45, y=20..34)
    cv.rect(34, 21, 45, 34, c("darkwood", 0))
    cv.hline(35, 44, 20, c("darkwood", 0))
    cv.hline(34, 45, 34, c("stone", 5))  # stone sill
    for y in range(21, 34):
        for x in range(35, 45):
            if (x == 35 or x == 44) and y == 21:
                cv.put(x, y, c("darkwood", 1))
                continue
            if x in (39, 40) or y == 27:
                cv.put(x, y, c("darkwood", 2))
            elif (x + y) % 4 == 0:
                cv.put(x, y, c("steel", 2))  # diamond lead came
            else:
                dist = abs(x - 39.5) + abs(y - 30) * 0.8
                if dist < 2.6:
                    cv.put(x, y, c("white", 6))
                elif dist < 4.5:
                    cv.put(x, y, c("yellow", 5))
                elif dist < 6.5:
                    cv.put(x, y, c("yellow", 4))
                else:
                    cv.put(x, y, c("orange", 4 if y > 25 else 3))

    # Sweeping ㅅ-gable bargeboards & cobalt verge slates (from x=39..40,y=5 out to x=24/55,y=20)
    for d in range(16):
        lx = 39 - d
        rx = 40 + d
        yb = 5 + d
        # Outer dark ink silhouette
        cv.put(lx, yb, ink0)
        cv.put(rx, yb, ink0)
        # Gleaming slate verge highlight rim
        cv.put(lx, yb + 1, c("tile", 6))
        cv.put(rx, yb + 1, c("tile", 5))
        # Cobalt verge body
        cv.put(lx, yb + 2, c("tile", 3))
        cv.put(rx, yb + 2, c("tile", 2))
        # Carved dark-oak raking bargeboard
        cv.put(lx, yb + 3, c("wood", 4))
        cv.put(rx, yb + 3, c("darkwood", 3))
        cv.put(lx, yb + 4, c("darkwood", 0))
        cv.put(rx, yb + 4, c("darkwood", 0))
        # Crisp cast shadow under raking cornice onto cream gable
        if yb + 5 <= 40:
            cv.shadow_pixel(lx, yb + 5, 2)
            cv.shadow_pixel(rx, yb + 5, 2)

    # Brass bargeboard end-finials at (24..25, 20..24) and (54..55, 20..24)
    for bx in (24, 54):
        cv.put(bx, 22, c("yellow", 4))
        cv.put(bx + 1, 22, c("orange", 3))
        cv.put(bx, 23, ink0)

    # Crowned Brass Finial Spire at Peak (x=38..41, y=0..7)
    cv.put(39, 0, c("yellow", 5))
    cv.put(40, 0, c("orange", 3))
    cv.put(39, 1, c("yellow", 5))
    cv.put(40, 1, c("yellow", 3))
    # Golden orb (y=2..3)
    cv.put(38, 2, ink0)
    cv.put(39, 2, c("white", 6))
    cv.put(40, 2, c("yellow", 4))
    cv.put(41, 2, ink0)
    cv.put(38, 3, ink0)
    cv.put(39, 3, c("yellow", 4))
    cv.put(40, 3, c("orange", 2))
    cv.put(41, 3, ink0)
    # Flared brass pedestal (y=4..6)
    cv.hline(38, 41, 4, c("yellow", 3))
    cv.put(39, 4, c("yellow", 5))
    cv.hline(37, 42, 5, ink0)
    cv.hline(38, 41, 5, c("orange", 3))
    cv.put(39, 6, c("yellow", 4))
    cv.put(40, 6, c("yellow", 2))

    # ------------------------------------------------------------------
    # 2. 2F NOBLE HALF-TIMBER FACADE, DIAMOND WINDOWS & HERALDIC CREST (y=42..74)
    # ------------------------------------------------------------------
    # Carved dark-oak eave cornice beam (y=42..43, x=1..78)
    cv.vline(1, 42, 74, ink0)
    cv.vline(78, 42, 74, ink0)
    draw_timber_beam_h(cv, 2, 77, 42, 2, pegs=True)

    # Fill 2F structural posts & plaster bays (x=2..77, y=44..71)
    draw_timber_post_v(cv, 2, 44, 71, 3)    # Left corner post (2..4)
    draw_timber_post_v(cv, 27, 44, 71, 3)   # Left-center post (27..29)
    draw_timber_post_v(cv, 50, 44, 71, 3)   # Right-center post (50..52)
    draw_timber_post_v(cv, 75, 44, 71, 3)   # Right corner post (75..77)

    # --- LEFT & RIGHT 2F BAYS (x=5..26 and x=53..74) ---
    for bay_x0, is_right in [(5, False), (53, True)]:
        # Side narrow panels with vertical & diagonal oak braces + horizontal rail
        ls0, ls1 = bay_x0, bay_x0 + 3
        rs0, rs1 = bay_x0 + 18, bay_x0 + 21
        draw_diag_brace(cv, ls0, 44, ls1, 57, slope_down_right=False, plaster_ramp="cream")
        draw_diag_brace(cv, rs0, 44, rs1, 57, slope_down_right=True, plaster_ramp="cream")
        draw_timber_beam_h(cv, bay_x0, bay_x0 + 21, 58, 2, pegs=False)
        draw_diag_brace(cv, ls0, 60, ls1, 71, slope_down_right=True, plaster_ramp="cream")
        draw_diag_brace(cv, rs0, 60, rs1, 71, slope_down_right=False, plaster_ramp="cream")

        # Vertical posts framing the window (wx0-1, wx1+1)
        wx0, wx1 = bay_x0 + 5, bay_x0 + 16  # 12px wide window
        draw_timber_post_v(cv, wx0 - 1, 44, 71, 1)
        draw_timber_post_v(cv, wx1 + 1, 44, 71, 1)

        # Under-window St. Andrew's X-brace apron (y=65..71)
        draw_x_brace(cv, wx0, 65, wx0 + 5, 71, "cream")
        draw_timber_post_v(cv, wx0 + 6, 65, 71, 1)
        draw_x_brace(cv, wx0 + 7, 65, wx1, 71, "cream")

        # Upper spandrel plaster above window (y=44..45)
        draw_plaster_panel(cv, wx0, 44, wx1, 45, "cream")

        # Warm-lit Leaded Diamond-Pane Casement Window (wx0..wx1, y=46..60)
        cv.rect(wx0, 46, wx1, 60, c("darkwood", 0))
        cv.hline(wx0, wx1, 46, c("wood", 3))
        mid_x = (wx0 + wx1) // 2
        for y in range(47, 60):
            for x in range(wx0 + 1, wx1):
                if x in (mid_x, mid_x + 1):
                    cv.put(x, y, c("darkwood", 2 if x == mid_x else 0))
                    continue
                if y == 53:
                    cv.put(x, y, c("darkwood", 2))
                    continue
                # Crisp diagonal leaded diamond lattice
                if ((x - wx0) + (y - 47)) % 4 == 0 or ((x - wx0) - (y - 47)) % 4 == 0:
                    cv.put(x, y, c("steel", 2) if y < 54 else c("darkwood", 2))
                else:
                    # Warm golden interior candlelight gradient (brighter lower-center)
                    gc = abs(x - (wx0 + 3 if x <= mid_x else wx1 - 3)) + abs(y - 56) * 0.6
                    if gc < 2.2:
                        cv.put(x, y, c("white", 6))
                    elif gc < 3.8:
                        cv.put(x, y, c("yellow", 5))
                    elif gc < 5.5:
                        cv.put(x, y, c("yellow", 4))
                    elif gc < 7.2:
                        cv.put(x, y, c("orange", 4))
                    else:
                        cv.put(x, y, c("orange", 2))

        # Lush flowerbox right beneath leaded window (y=60..64)
        fcols = (
            [c("red", 4), c("yellow", 5), c("pink", 4), c("orange", 4)]
            if not is_right
            else [c("pink", 4), c("red", 4), c("yellow", 5), c("red", 5)]
        )
        draw_flowerbox(cv, wx0 - 1, 60, wx1 + 1, fcols, seed=41 if not is_right else 83)

    # --- CENTER 2F HERALDIC BAY (x=30..49, y=44..71) ---
    draw_plaster_panel(cv, 30, 44, 49, 63, "cream", seed=66)
    draw_timber_beam_h(cv, 30, 49, 64, 2, pegs=False)
    draw_x_brace(cv, 30, 66, 38, 71, "cream")
    draw_timber_post_v(cv, 39, 66, 71, 2)
    draw_x_brace(cv, 41, 66, 49, 71, "cream")

    # Cast eave shadow under main roof across top of 2F BEFORE foreground banners & crest!
    cv.shadow_rect(2, 44, 77, 45, 2)
    cv.shadow_rect(2, 46, 77, 46, 1)
    # Corbel brackets under roof eaves
    for cx_b in (3, 27, 51, 75):
        cv.rect(cx_b, 43, cx_b + 1, 46, c("darkwood", 1))
        cv.put(cx_b, 44, c("wood", 3))

    # Flanking Royal Crimson Swallowtail Banners (x=30..33 and x=46..49, y=46..64)
    for bx0 in (30, 46):
        cv.shadow_rect(bx0 + 1, 47, min(49, bx0 + 4), 64, 1)
        # Brass rod & finials
        cv.hline(bx0, bx0 + 3, 46, c("yellow", 4))
        cv.put(bx0, 46, c("yellow", 5))
        for y in range(47, 64):
            for dx in range(4):
                x = bx0 + dx
                if y == 63 and dx in (1, 2):
                    continue
                if y == 62 and dx == 2:
                    continue
                if dx == 0:
                    col = c("red", 4 if y < 56 else 3)
                elif dx == 3:
                    col = c("maple", 1)
                elif dx in (1, 2) and y in (50, 51, 58):
                    col = c("yellow", 4 if dx == 1 else 3)
                elif dx == 1 and 52 <= y <= 57:
                    col = c("red", 4)
                else:
                    col = c("red", 2 if y > 57 else 3)
                cv.put(x, y, col)

    # Central Carved Stone & Gold Crossed-Swords Heraldic Shield Crest (x=34..45, y=46..63)
    # 1. Carved dark stone relief outline & drop-shadow so gold bezel pops crisp against cream plaster!
    for y in range(48, 64):
        if y <= 56:
            sh_half = 5  # x=34..45 carved stone backing rim
        elif y <= 58:
            sh_half = 4
        elif y <= 60:
            sh_half = 3
        elif y == 61:
            sh_half = 2
        elif y == 62:
            sh_half = 1
        else:
            sh_half = 0
        cv.hline(39 - sh_half, 40 + sh_half, y, c("stone", 1 if y > 54 else 2))

    # 2. Sword pommels & crossguards protruding top-left (34..36, 46..49) & top-right (43..45, 46..49)
    for hx, sx_dir in [(34, 1), (45, -1)]:
        # Dark outline behind hilt
        cv.rect(min(hx, hx + 2 * sx_dir), 46, max(hx, hx + 2 * sx_dir), 48, c("stone", 1))
        cv.put(hx, 46, c("red", 4))  # crimson ruby pommel jewel!
        cv.put(hx + sx_dir, 46, c("yellow", 5))
        cv.put(hx + sx_dir, 47, c("darkwood", 2))
        cv.put(hx, 48, c("yellow", 5))
        cv.put(hx + 2 * sx_dir, 46, c("yellow", 5))
        cv.put(hx + 2 * sx_dir, 48, c("yellow", 4))
    # Protruding steel sword tips at bottom-left (34..35, 61..62) & bottom-right (44..45, 61..62)
    cv.put(34, 61, c("stone", 1))
    cv.put(35, 62, c("stone", 1))
    cv.put(35, 61, c("steel", 5))
    cv.put(34, 62, c("coolwhite", 5))
    cv.put(45, 61, c("stone", 1))
    cv.put(44, 62, c("stone", 1))
    cv.put(44, 61, c("steel", 4))
    cv.put(45, 62, c("steel", 6))

    # 3. Heater Shield Body (x=35..44, y=48..62) — burnished gold rim + deep royal navy field
    for y in range(48, 63):
        if y <= 56:
            half = 4  # x = 35..44 (10px wide)
        elif y <= 58:
            half = 3  # x = 36..43 (8px wide)
        elif y <= 60:
            half = 2  # x = 37..42 (6px wide)
        elif y == 61:
            half = 1  # x = 38..41 (4px wide)
        else:
            half = 0  # x = 39..40 (2px point)
        lx = 39 - half
        rx = 40 + half
        for x in range(lx, rx + 1):
            is_outer = (x == lx or x == rx or y == 48 or y == 62 or (y in (58, 60, 61) and (x == lx or x == rx)))
            if is_outer:
                if x <= 39 and y <= 55:
                    col = c("yellow", 5) if (x == lx and y == 48) else c("yellow", 4)
                elif x >= 40 and y >= 57:
                    col = c("orange", 2)
                else:
                    col = c("yellow", 3)
            else:
                q_tl = (x <= 39 and y <= 54)
                q_br = (x >= 40 and y >= 55)
                if q_tl or q_br:
                    col = c("navy", 2 if y < 53 else 1)
                else:
                    col = c("blue", 1)
            cv.put(x, y, col)

    # 4. Crisp Crossed Silver-Steel Blades (`\` and `/`) embossed right across the shield!
    for i in range(9):
        bx1 = 36 + i
        bx2 = 43 - i
        by = 50 + i
        if 36 <= bx1 <= 43 and by <= 59:
            cv.put(bx1, by, c("coolwhite", 5) if i < 5 else c("steel", 5))
        if 36 <= bx2 <= 43 and by <= 59:
            cv.put(bx2, by, c("white", 6) if i == 4 else c("steel", 6 if i < 5 else 4))
    # Golden star rivet at sword crossing center (39..40, 54)
    cv.put(39, 54, c("white", 6))
    cv.put(40, 54, c("yellow", 5))

    # Heavy 2F Jetty Bressummer Beam & Carved Corbels (y=72..74, x=1..78)
    draw_timber_beam_h(cv, 2, 77, 72, 3, pegs=True)
    cv.put(1, 72, ink0)
    cv.put(78, 72, ink0)

    # ------------------------------------------------------------------
    # 3. 1F DRESSED ASHLAR STONE HALL, ARCHWAY, QUEST BOARD & WEAPON RACK (y=75..111)
    # ------------------------------------------------------------------
    draw_ashlar_wall(cv, 2, 75, 77, 110, "stone", "concrete", seed=303)

    # Rusticated heavy stone plinth base at y=108..111 spanning x=1..78 (grounded y=111!)
    for y in range(108, 112):
        for x in range(1, 79):
            if x in (1, 78) or y == 111:
                cv.put(x, y, ink0 if y == 111 and x in (1, 78) else c("concrete", 0 if y == 111 else 1))
            elif y == 108:
                cv.put(x, y, c("stone", 5 if (x % 10) != 0 else 2))
            else:
                cv.put(x, y, c("concrete", 2 if (x % 10) != 0 else 0))
    # Subtle moss tufts along plinth mortar
    for mx in (3, 4, 25, 54, 75, 76):
        cv.put(mx, 109, c("moss", 3))
        cv.put(mx, 110, c("moss", 1))

    # Jetty overhang shadow across top of 1F stone wall (y=75..77)
    cv.shadow_rect(3, 75, 76, 76, 2)
    cv.shadow_rect(3, 77, 76, 77, 1)
    for cx_b in (3, 27, 51, 75):
        cv.rect(cx_b, 75, cx_b + 1, 77, c("stone", 2))
        cv.put(cx_b, 75, c("stone", 4))

    # --- CENTRAL DRESSED STONE ARCHWAY & OPEN/WARM-LIT DOUBLE OAK DOORS (x=26..53, y=76..111) ---
    # Radiating stone arch surround (x=26..53, y=76..108)
    acx, acy = 39.5, 88.0
    for y in range(76, 109):
        for x in range(26, 54):
            if y < 88:
                dx = (x - acx)
                dy = (y - acy)
                r2 = dx * dx + (dy * 1.12) ** 2
                if 13.8 ** 2 >= r2 >= 9.6 ** 2:
                    # Stone voussoir ring!
                    angle_seg = int((dx + 15) // 3)
                    is_joint = ((int(dx + 20) + (y // 2)) % 4 == 0)
                    if r2 >= 12.8 ** 2:
                        cv.put(x, y, ink0 if y <= 78 else c("stone", 2))
                    elif r2 <= 10.4 ** 2:
                        cv.put(x, y, ink0)
                    elif 38 <= x <= 41 and y <= 80:
                        # Carved guild keystone with golden trim!
                        cv.put(x, y, c("yellow", 4) if y == 78 and x in (39, 40) else c("stone", 6))
                    else:
                        cv.put(x, y, c("stone", 2 if is_joint else (5 if x < 40 else 4)))
            else:
                # Vertical stone jamb piers (x=27..29 and x=50..52)
                if 27 <= x <= 29:
                    yb = (y - 88) % 5
                    cv.put(x, y, ink0 if x == 29 else c("stone", 2 if yb == 4 else (5 if x == 27 else 4)))
                elif 50 <= x <= 52:
                    yb = (y - 88) % 5
                    cv.put(x, y, ink0 if x == 50 else c("stone", 2 if yb == 4 else (4 if x == 51 else 3)))

    # Warm-lit Guild Hall Interior & Double Oak Doors (x=30..49, y=79..108, ~29px tall!)
    for y in range(79, 109):
        for x in range(30, 50):
            if y < 88:
                dx = x - acx
                dy = (y - acy) * 1.12
                if dx * dx + dy * dy > 9.6 ** 2:
                    continue
            # Arched fanlight transom above y=84 with wrought-iron sunburst
            if y < 84:
                dist = abs(x - acx) + (84 - y) * 0.7
                if y == 83:
                    cv.put(x, y, c("darkwood", 1))
                elif int(abs(x - acx)) in (0, 4, 8):
                    cv.put(x, y, c("kuro", 1))
                else:
                    cv.put(x, y, c("yellow", 5 if dist < 4 else 4))
                continue

            # Left swung oak door leaf (x=30..35) & Right swung oak door leaf (x=44..49)
            if 30 <= x <= 35 or 44 <= x <= 49:
                is_left = (x <= 35)
                lx = (x - 30) if is_left else (x - 44)
                if (is_left and lx == 5) or (not is_left and lx == 0):
                    # Inner door edge catching warm interior hall light!
                    cv.put(x, y, c("orange", 4) if 87 <= y <= 104 else c("cedar", 4))
                elif y in (87, 96, 104) and 1 <= lx <= 4:
                    # Heavy wrought-iron strap hinges with brass rivets
                    cv.put(x, y, c("yellow", 4) if lx == 2 else c("steel", 2))
                elif y == 95 and ((is_left and lx == 4) or (not is_left and lx == 1)):
                    # Gleaming brass ring handle
                    cv.put(x, y, c("yellow", 5))
                else:
                    col = c("wood", 4 if lx in (1, 3) else 3) if is_left else c("wood", 3 if lx in (2, 4) else 2)
                    if y in (84, 108):
                        col = c("darkwood", 1)
                    cv.put(x, y, col)
            else:
                # Open warm-lit Guild Hall interior (x=36..43, y=84..108)!
                if y < 97:
                    # Warm chandelier glow + distant reception counter silhouette at y=94..96
                    if y in (94, 95) and 37 <= x <= 42:
                        cv.put(x, y, c("wood", 3 if y == 94 else 2))
                    elif y <= 88 and 38 <= x <= 41:
                        cv.put(x, y, c("white", 6) if y in (86, 87) and x in (39, 40) else c("yellow", 5))
                    else:
                        cv.put(x, y, c("yellow", 4) if 38 <= x <= 41 else c("orange", 4))
                else:
                    # Polished warm wood floor + royal crimson guild runner rug (x=38..41)
                    if 38 <= x <= 41:
                        if x in (38, 41):
                            cv.put(x, y, c("yellow", 3))  # gold rug trim
                        else:
                            cv.put(x, y, c("red", 3 if (y % 2 == 0) else 4))
                    else:
                        cv.put(x, y, c("floorwood", 4 if y < 103 else 3))

    # Two wide dressed flagstone Guild steps (x=25..54, y=108..111)
    cv.hline(26, 53, 108, c("stone", 6))
    cv.hline(26, 53, 109, c("stone", 3))
    cv.hline(25, 54, 110, c("stone", 5))
    cv.hline(25, 54, 111, c("concrete", 0))
    cv.put(25, 110, ink0)
    cv.put(54, 110, ink0)

    # --- LEFT 1F: QUEST NOTICE BOARD WITH PARCHMENT BOUNTIES (x=4..24, y=79..111) ---
    # Wall shadow behind quest board
    cv.shadow_rect(5, 81, 25, 109, 2)
    # Sturdy oak side legs grounded to y=111
    draw_timber_post_v(cv, 5, 82, 111, 2)
    draw_timber_post_v(cv, 22, 82, 111, 2)
    cv.put(5, 111, ink0)
    cv.put(23, 111, ink0)
    # Mini pitched wooden shingle canopy hood (x=3..25, y=79..82)
    cv.hline(4, 24, 79, ink0)
    cv.hline(3, 25, 80, c("cedar", 4))
    cv.put(3, 80, ink0)
    cv.put(25, 80, ink0)
    for x in range(3, 26):
        cv.put(x, 81, c("wood", 2 if (x % 3 == 0) else 4))
        cv.put(x, 82, ink0)
    # Recessed dark cork/oak bulletin board field (x=7..21, y=83..101)
    cv.rect(7, 83, 21, 101, c("darkwood", 1))
    for y in range(84, 101):
        for x in range(7, 22):
            if h2(x, y, 512) > 190:
                cv.put(x, y, c("wood", 2))
    draw_timber_beam_h(cv, 5, 23, 101, 2, pegs=False)

    # Pinned Parchment Bounty Notices!
    # 1) Featured S-Rank Bounty (x=8..13, y=84..92) with red wax seal & monster icon
    cv.rect(8, 84, 13, 92, c("cream", 5))
    cv.hline(8, 13, 84, c("cream", 6))
    cv.put(10, 84, c("red", 4))  # iron/red pin
    # Tiny horned monster silhouette at y=86..87
    cv.put(9, 86, c("ink", 2))
    cv.hline(10, 11, 87, c("ink", 1))
    cv.put(12, 86, c("ink", 2))
    # Scribbled bounty lines + red wax seal at bottom-right
    cv.hline(9, 12, 89, c("cream", 2))
    cv.hline(9, 11, 91, c("cream", 2))
    cv.put(12, 91, c("red", 3))
    cv.put(12, 92, c("red", 1))  # wax ribbon

    # 2) Golden Urgent Guild Notice (x=15..20, y=85..91)
    cv.rect(15, 85, 20, 91, c("yellow", 5))
    cv.vline(20, 86, 91, c("yellow", 3))
    cv.put(17, 85, c("blue", 3))  # sapphire tack
    cv.hline(16, 19, 87, c("orange", 2))
    cv.hline(16, 18, 89, c("orange", 2))
    cv.put(19, 90, c("red", 4))

    # 3) Lower-left Kinari Parchment Slip (x=8..12, y=94..99)
    cv.rect(8, 94, 12, 99, c("kinari", 5))
    cv.put(10, 94, c("steel", 4))
    cv.hline(9, 11, 96, c("kinari", 2))
    cv.hline(9, 11, 98, c("kinari", 2))

    # 4) Lower-right White/Cream Slip (x=14..19, y=93..99) with folded corner
    cv.rect(14, 93, 19, 99, c("cream", 6))
    cv.put(19, 99, c("darkwood", 1))  # dog-ear corner
    cv.put(18, 98, c("cream", 3))
    cv.put(16, 93, c("red", 4))
    cv.hline(15, 18, 95, c("cream", 2))
    cv.hline(15, 17, 97, c("cream", 2))

    # Small rolled map scroll barrel beside quest board at x=2..4, y=104..111
    cv.rect(2, 105, 4, 110, c("wood", 3))
    cv.vline(2, 105, 110, c("wood", 5))
    cv.hline(2, 4, 107, c("steel", 2))
    cv.hline(2, 4, 111, ink0)
    cv.put(3, 103, c("cream", 6))  # rolled parchment map sticking out!
    cv.put(3, 104, c("cream", 4))
    cv.put(4, 104, c("yellow", 5))

    # --- RIGHT 1F: GLOWING IRON LANTERN & WEAPON / HALBERD RACK (x=54..77, y=79..111) ---
    draw_iron_lantern(cv, 57, 79, cast_on_wall=True)

    # Weapon Rack Shadow on Stone Wall
    cv.shadow_rect(61, 93, 76, 110, 2)

    # Oak Weapon Rack Frame (x=60..75, y=94..111)
    draw_timber_post_v(cv, 60, 93, 111, 2)
    draw_timber_post_v(cv, 74, 93, 111, 2)
    draw_timber_beam_h(cv, 60, 75, 95, 2, pegs=False)   # notched upper rail
    draw_timber_beam_h(cv, 60, 75, 108, 3, pegs=False)  # heavy base tray
    cv.hline(60, 75, 111, ink0)

    # Weapon 1: Tall Steel Halberd (x=60..65, y=79..108) with crisp dark outline/shadow against light stone!
    cv.shadow_rect(61, 80, 65, 88, 2)
    cv.vline(63, 80, 107, c("cedar", 4))
    cv.vline(64, 83, 107, c("darkwood", 1))
    # Spear spike tip (y=79..82)
    cv.put(63, 78, c("kuro", 1))
    cv.put(63, 79, c("white", 6))
    cv.put(64, 79, c("kuro", 1))
    cv.put(63, 80, c("steel", 6))
    cv.put(64, 80, c("kuro", 1))
    cv.put(63, 81, c("steel", 5))
    cv.put(64, 81, c("steel", 2))
    # Crescent halberd axe blade (x=60..65, y=82..87) framed with dark forged bevel!
    cv.vline(60, 82, 87, c("kuro", 1))
    cv.vline(61, 82, 87, c("white", 6))
    cv.put(61, 82, c("steel", 5))
    cv.put(61, 87, c("kuro", 1))
    cv.vline(62, 83, 86, c("steel", 4))
    cv.put(62, 82, c("kuro", 1))
    cv.put(62, 87, c("kuro", 1))
    cv.put(65, 84, c("steel", 4))  # back beak fluke
    cv.put(65, 85, c("kuro", 1))
    cv.put(63, 88, c("yellow", 4))  # brass collar

    # Weapon 2: Broad Steel Greatsword (x=66..70, y=83..107)
    cv.shadow_rect(67, 84, 70, 92, 2)
    cv.put(68, 83, c("yellow", 5))
    cv.put(68, 84, c("darkwood", 3))
    cv.vline(68, 85, 87, c("red", 2))  # crimson leather grip
    cv.hline(66, 70, 88, c("yellow", 4))  # golden crossguard
    cv.put(66, 88, c("yellow", 5))
    cv.hline(66, 70, 89, c("kuro", 1))
    for y in range(89, 107):
        cv.put(66, y, c("kuro", 1))
        cv.put(67, y, c("white", 6) if y < 97 else c("steel", 5))
        cv.put(68, y, c("steel", 3))
        cv.put(69, y, c("kuro", 1))

    # Weapon 3: Knight's Partisan Spear with Crimson Tassel (x=71..73, y=81..107)
    cv.put(71, 80, c("kuro", 1))
    cv.put(71, 81, c("white", 6))
    cv.put(72, 81, c("kuro", 1))
    cv.hline(71, 72, 82, c("steel", 6))
    cv.put(73, 82, c("kuro", 1))
    cv.hline(70, 72, 83, c("steel", 5))
    cv.put(73, 83, c("kuro", 1))
    cv.hline(71, 72, 84, c("steel", 4))
    cv.put(71, 85, c("yellow", 4))
    cv.put(72, 86, c("red", 4))  # crimson tassel!
    cv.put(72, 87, c("red", 3))
    cv.vline(71, 86, 107, c("cedar", 3))
    cv.vline(72, 88, 107, c("darkwood", 1))

    # Round Steel-Rimmed Heraldic Buckler Shield leaning at right end (x=71..77, y=101..111)
    scx, scy = 74.0, 106.0
    for y in range(101, 112):
        for x in range(70, 78):
            d2 = (x - scx) ** 2 + (y - scy) ** 2
            if d2 <= 21:
                if y == 111:
                    cv.put(x, y, ink0)
                elif d2 >= 13.5:
                    cv.put(x, y, c("steel", 5 if (x < scx and y < scy) else 2))
                elif d2 <= 2.2:
                    cv.put(x, y, c("yellow", 5 if x <= scx else 3))  # central brass boss
                else:
                    cv.put(x, y, c("blue", 3 if (x < scx and y < scy) else 1))

    return cv.img


# ==============================================================================
# BUILDING 2: ft-inn.png (64x112) — Traveler's Cozy Inn (여행자 여관)
# ==============================================================================
def build_ft_inn(ramps: dict[str, list[tuple[int, int, int, int]]]) -> Image.Image:
    cv = PixelCanvas(64, 112, ramps)
    c = cv.c
    ink0 = c("ink", 0)

    # Layout:
    #   Main cozy inn roof: x=0..51, y=4..42 (with smoking stone chimney rising to y=0..22 at x=39..47!)
    #   2F kinari half-timber facade: x=1..50, y=42..74
    #   Ornate wrought-iron bracket + swinging Crescent-Moon & Feather-Bed wooden sign: x=50..63, y=44..67!
    #   1F warm stone & cedar facade: x=1..50, y=75..111 + stacked ale barrels & potted shrub extending x=47..63, y=91..111!

    # ------------------------------------------------------------------
    # 1. WARM TERRACOTTA-BROWN STAGGERED ROOF (x=0..51, y=4..42)
    # ------------------------------------------------------------------
    # Ridge beam (y=4..8, x=4..47)
    for x in range(4, 48):
        seg = (x - 4) % 5
        is_joint = (seg == 0)
        cv.put(x, 4, ink0)
        cv.put(x, 5, c("rooftile", 6) if seg == 1 else c("rooftile", 5 if not is_joint else 3))
        cv.put(x, 6, c("cha", 5 if not is_joint else 3))
        cv.put(x, 7, c("rooftile", 2 if not is_joint else 1))
        cv.put(x, 8, ink0 if is_joint else c("cha", 1))

    # Carved wooden/terracotta ridge end-caps (x=0..4 and x=47..51)
    for ox in (0, 47):
        for dy in range(3, 10):
            for dx in range(5):
                x = ox + dx
                if dy == 3 and dx in (0, 4):
                    continue
                if dy in (3, 9) or dx in (0, 4):
                    cv.put(x, dy, ink0)
                elif dy == 4:
                    cv.put(x, dy, c("rooftile", 5))
                elif dy == 6 and dx == 2:
                    cv.put(x, dy, c("yellow", 4))
                else:
                    cv.put(x, dy, c("cha", 4 if dx <= 2 else 2))

    # Staggered Terracotta-Brown (`rooftile` + `cha` + `aka`) Shingle Courses (y=9..38, 6 courses x 5px)
    for course in range(6):
        y0 = 9 + course * 5
        stagger = (course % 2) * 2
        course_bias = 0 if course < 5 else -1
        for dy in range(5):
            y = y0 + dy
            for x in range(52):
                if x in (0, 51):
                    cv.put(x, y, ink0)
                    continue
                if x in (1, 50):
                    cv.put(x, y, c("cedar", 4 if x == 1 else 2) if dy < 4 else c("darkwood", 1))
                    continue

                tx = (x + stagger) % 4
                tc = (x + stagger) // 4
                hv = h2(tc, course, 409)
                shift = (1 if hv > 205 else (-1 if hv < 45 else 0)) + course_bias
                if 50 <= hv <= 115:
                    sramp = "cha"
                elif 116 <= hv <= 150:
                    sramp = "aka"
                else:
                    sramp = "rooftile"

                def shingle_tone(lv: int) -> tuple[int, int, int, int]:
                    max_l = len(cv.ramps[sramp]) - 1
                    idx = clamp(lv + shift, 1, max_l - (1 if sramp == "rooftile" else 0))
                    return c(sramp, idx)

                if tx == 0:
                    col = ink0 if dy == 4 else (c("cha", 0) if dy == 3 else c("cha", 1))
                elif dy == 0:
                    col = shingle_tone(3 if tx == 1 else 2)
                elif dy == 1:
                    col = c("rooftile", 5) if (tx == 1 and hv > 180) else shingle_tone(5 if tx == 1 else (4 if tx == 2 else 3))
                elif dy == 2:
                    col = shingle_tone(5 if tx == 1 else (4 if tx == 2 else 3))
                elif dy == 3:
                    col = shingle_tone(4 if tx == 1 else (3 if tx == 2 else 2))
                else:
                    col = c("cha", 2) if tx == 1 else (c("cha", 1) if tx == 2 else ink0)
                cv.put(x, y, col)

    # Cozy scalloped terracotta eave lip (y=39..41, x=0..51)
    for x in range(52):
        if x in (0, 51):
            cv.vline(x, 39, 41, ink0)
            continue
        tx = x % 4
        cv.put(x, 39, c("rooftile", 5 if tx == 1 else (4 if tx == 2 else 1)))
        cv.put(x, 40, c("cha", 6 if tx == 1 else (4 if tx == 2 else 1)))
        cv.put(x, 41, ink0)

    # Warm roof moss patches
    for mx, my, mi in [(5, 35, 3), (6, 36, 4), (7, 36, 2), (33, 36, 2), (34, 37, 4)]:
        cv.put(mx, my, c("moss", mi))

    # ------------------------------------------------------------------
    # 1B. COZY ATTIC WINDOW ON LEFT-CENTER SLOPE (x=12..25, y=13..32)
    # ------------------------------------------------------------------
    # Cast shadow right of attic dormer
    for sy in range(18, 33):
        cv.shadow_rect(26, sy, min(30, 26 + (sy - 16) // 3), sy, 2)

    # Peaked wooden dormer hood & warm kinari cheeks
    for y in range(15, 32):
        half = min(6, y - 14)
        for x in range(18 - half, 19 + half + 1):
            cv.put(x, y, c("kinari", 5 if x <= 18 else 4))
    draw_timber_post_v(cv, 13, 21, 31, 1)
    draw_timber_post_v(cv, 24, 21, 31, 1)
    cv.hline(13, 24, 31, c("cedar", 4))
    cv.hline(13, 24, 32, ink0)

    # Warm glowing attic window (x=15..22, y=21..30)
    cv.rect(15, 21, 22, 30, c("darkwood", 0))
    for y in range(22, 30):
        for x in range(16, 22):
            if x in (18, 19) and y == 25:
                cv.put(x, y, c("darkwood", 2))
            elif x == 18 or y == 25:
                cv.put(x, y, c("darkwood", 2))
            else:
                cv.put(x, y, c("yellow", 5 if y >= 26 else 4))

    # Dormer pitched shingle cap (apex at x=18..19, y=13)
    for d in range(8):
        lx, rx, yb = 18 - d, 19 + d, 13 + d
        cv.put(lx, yb, ink0)
        cv.put(rx, yb, ink0)
        cv.put(lx, yb + 1, c("rooftile", 5))
        cv.put(rx, yb + 1, c("cha", 5))
        cv.put(lx, yb + 2, c("cedar", 3))
        cv.put(rx, yb + 2, c("darkwood", 2))
        cv.put(lx, yb + 3, ink0)
        cv.put(rx, yb + 3, ink0)

    # ------------------------------------------------------------------
    # 1C. SMOKING STONE HEARTH CHIMNEY (x=37..51, y=0..25)
    # ------------------------------------------------------------------
    for sy in range(11, 27):
        cv.shadow_rect(47, sy, min(50, 46 + (sy - 9) // 3), sy, 2)

    draw_ashlar_wall(cv, 38, 9, 45, 24, "stone", "stone", seed=71)
    cv.vline(38, 9, 24, ink0)
    cv.vline(45, 9, 24, ink0)
    cv.hline(38, 45, 25, ink0)
    # Corbeled stone hearth cap (x=37..46, y=7..9)
    cv.hline(37, 46, 7, ink0)
    cv.hline(37, 46, 8, c("stone", 6))
    cv.put(37, 8, ink0)
    cv.put(46, 8, ink0)
    cv.hline(37, 46, 9, c("stone", 3))
    cv.put(37, 9, ink0)
    cv.put(46, 9, ink0)
    # Warm terracotta flue pot (x=40..43, y=5..6)
    cv.rect(40, 5, 43, 6, c("brick", 4))
    cv.vline(43, 5, 6, c("brick", 1))
    # Three plump rising hearth smoke puffs (y=0..4, x=41..51 — 100% binary alpha=255!)
    smoke_puffs = [
        # Puff 1 emerging from flue (x=41..44, y=3..4)
        (41, 4, c("white", 3)), (42, 4, c("white", 5)), (43, 4, c("white", 3)),
        (41, 3, c("white", 5)), (42, 3, c("white", 6)), (43, 3, c("white", 5)), (44, 3, c("white", 3)),
        # Puff 2 curling up-right (x=43..47, y=1..3)
        (44, 2, c("white", 5)), (45, 2, c("white", 6)), (46, 2, c("white", 4)), (47, 2, c("white", 2)),
        (44, 1, c("white", 6)), (45, 1, c("white", 6)), (46, 1, c("white", 5)),
        # Puff 3 drifting high (x=47..51, y=0..1)
        (48, 1, c("white", 4)), (49, 1, c("white", 5)), (50, 1, c("white", 3)),
        (48, 0, c("white", 6)), (49, 0, c("white", 6)), (50, 0, c("white", 5)),
    ]
    for sx, sy, scol in smoke_puffs:
        cv.put(sx, sy, scol)

    # ------------------------------------------------------------------
    # 2. 2F COZY KINARI HALF-TIMBER FACADE & CURTAINED WINDOWS (x=1..50, y=42..74)
    # ------------------------------------------------------------------
    cv.vline(1, 42, 74, ink0)
    cv.vline(50, 42, 74, ink0)
    draw_timber_beam_h(cv, 2, 49, 42, 2, pegs=True)

    # Structural posts: left (2..3), center (25..26), right (48..49)
    draw_timber_post_v(cv, 2, 44, 71, 2)
    draw_timber_post_v(cv, 25, 44, 71, 2)
    draw_timber_post_v(cv, 48, 44, 71, 2)

    # Two warm guestroom bays: Bay L (x=4..24) & Bay R (x=27..47)
    for bx0, seed_b in [(4, 101), (27, 202)]:
        # Side diagonal braces
        draw_diag_brace(cv, bx0, 44, bx0 + 3, 62, slope_down_right=False, plaster_ramp="kinari")
        draw_diag_brace(cv, bx0 + 17, 44, bx0 + 20, 62, slope_down_right=True, plaster_ramp="kinari")
        draw_timber_post_v(cv, bx0 + 4, 44, 71, 1)
        draw_timber_post_v(cv, bx0 + 16, 44, 71, 1)

        # Lower X-brace wainscot across bay (y=65..71)
        draw_timber_beam_h(cv, bx0, bx0 + 20, 63, 2, pegs=False)
        draw_x_brace(cv, bx0, 65, bx0 + 9, 71, "kinari")
        draw_timber_post_v(cv, bx0 + 10, 65, 71, 1)
        draw_x_brace(cv, bx0 + 11, 65, bx0 + 20, 71, "kinari")

        # Glowing Amber Curtained Guestroom Window (wx0..wx1 = bx0+5 .. bx0+15, 11px wide, y=46..59)
        wx0, wx1 = bx0 + 5, bx0 + 15
        draw_plaster_panel(cv, wx0, 44, wx1, 45, "kinari", seed=seed_b)
        cv.rect(wx0, 46, wx1, 59, c("darkwood", 0))
        cv.hline(wx0, wx1, 46, c("cedar", 3))
        wmid = (wx0 + wx1) // 2
        for y in range(47, 59):
            ry = y - 47  # 0..11
            for x in range(wx0 + 1, wx1):
                rx = x - (wx0 + 1)  # 0..8
                if x == wmid or y == 53:
                    cv.put(x, y, c("darkwood", 2))
                    continue
                # Draped golden-cream / warm amber tied-back curtains on left & right sides!
                curt_w = 3 if ry < 4 else (2 if ry < 8 else 1)
                if rx < curt_w or rx >= 9 - curt_w:
                    if ry == 7:
                        cv.put(x, y, c("red", 3))  # crimson curtain tie-back ribbon!
                    else:
                        cv.put(x, y, c("cream", 6) if (rx in (0, 8) and ry < 5) else c("yellow", 4))
                else:
                    # Warm cozy guestroom lamp glow inside
                    if 54 <= y <= 57 and abs(x - wmid) <= 2:
                        cv.put(x, y, c("white", 6) if y == 55 else c("yellow", 5))
                    else:
                        cv.put(x, y, c("orange", 4 if y >= 52 else 3))

        # Lush Red & Pink Flowerboxes (y=59..63)
        fcols = [c("red", 4), c("pink", 4), c("pink", 5), c("red", 5), c("yellow", 5)]
        draw_flowerbox(cv, wx0 - 1, 59, wx1 + 1, fcols, seed=seed_b + 7)

    # Eave cast shadow across top of 2F (y=44..46)
    cv.shadow_rect(2, 44, 49, 45, 2)
    cv.shadow_rect(2, 46, 49, 46, 1)

    # 2F Jetty Beam (y=72..74, x=1..50)
    draw_timber_beam_h(cv, 2, 49, 72, 3, pegs=True)

    # ------------------------------------------------------------------
    # 2B. ORNATE WROUGHT-IRON SIDE BRACKET & SWINGING CRESCENT-MOON + FEATHER-BED SIGN (x=50..63, y=43..67)
    # ------------------------------------------------------------------
    # Iron mounting plate on right corner post (x=50, y=43..54)
    cv.vline(50, 43, 54, c("steel", 2))
    cv.put(50, 44, c("steel", 5))
    cv.put(50, 53, c("steel", 5))

    # Projecting horizontal wrought-iron arm (x=51..63, y=47..48)
    cv.hline(51, 62, 47, c("steel", 4))
    cv.hline(51, 62, 48, ink0)
    cv.put(63, 46, c("steel", 5))  # curled iron tip finial
    cv.put(63, 47, c("steel", 3))
    cv.put(62, 45, c("steel", 4))

    # Continuous forged-iron S-scroll volute above arm (y=43..46, x=52..59)
    for sx, sy, sc in [
        (51, 46, c("steel", 3)), (52, 45, c("steel", 4)), (53, 44, c("steel", 5)),
        (54, 44, c("steel", 5)), (55, 45, c("steel", 4)), (56, 46, c("steel", 3)),
        (57, 45, c("steel", 4)), (58, 44, c("steel", 5)), (59, 44, c("steel", 4)),
        (59, 45, c("steel", 3)),
    ]:
        cv.put(sx, sy, sc)

    # Lower diagonal forged-iron brace (x=51..55, y=49..53)
    for i in range(5):
        cv.put(51 + i, 53 - i, c("steel", 4))
        cv.put(51 + i, 54 - i, ink0)

    # Two brass suspension chains at x=53 and x=60 (y=49..50)
    for cx_ch in (53, 60):
        cv.put(cx_ch, 49, c("yellow", 4))
        cv.put(cx_ch, 50, c("steel", 4))

    # Swinging Carved Wooden Signboard (x=51..63, y=51..66 -> 13px wide x 16px tall!)
    for y in range(51, 67):
        for x in range(51, 64):
            if (x in (51, 63)) and (y in (51, 66)):
                continue
            is_outer = (
                x in (51, 63) or y in (51, 66)
                or (x in (52, 62) and y in (51, 66))
                or (x in (51, 63) and y in (52, 65))
            )
            if is_outer:
                cv.put(x, y, ink0)
            elif x in (52, 62) or y in (52, 65):
                cv.put(x, y, c("cedar", 5 if (x == 52 or y == 52) else 2))
            else:
                cv.put(x, y, c("navy", 1 if y < 59 else 0))

    # Pictorial Emblem Part 1: Golden Crescent Moon + Star (x=54..60, y=53..57)
    moon_px = [
        (55, 53, c("yellow", 5)), (56, 53, c("yellow", 4)),
        (54, 54, c("white", 6)),  (55, 54, c("yellow", 5)),
        (54, 55, c("yellow", 5)),
        (54, 56, c("yellow", 5)), (55, 56, c("yellow", 4)),
        (55, 57, c("yellow", 5)), (56, 57, c("yellow", 4)), (57, 57, c("orange", 4)),
    ]
    for mx, my, mc in moon_px:
        cv.put(mx, my, mc)
    # Twinkling golden star beside moon
    cv.put(59, 54, c("white", 6))
    cv.put(60, 55, c("yellow", 4))

    # Pictorial Emblem Part 2: Cozy Feather Bed (x=53..61, y=59..64)
    # Oak headboard post (x=53, y=59..64) & footboard post (x=61, y=60..64)
    cv.vline(53, 59, 64, c("cedar", 5))
    cv.vline(61, 60, 64, c("cedar", 4))
    # Plump white feather pillow (x=54..56, y=59..60)
    cv.hline(54, 55, 59, c("white", 6))
    cv.hline(54, 56, 60, c("white", 5))
    # Lush red/rose feather quilt blanket (x=56..60, y=60..62)
    cv.hline(57, 59, 60, c("pink", 4))
    cv.hline(56, 60, 61, c("red", 4))
    cv.hline(54, 60, 62, c("red", 3))
    cv.put(55, 61, c("white", 6))  # crisp folded sheet turnback!
    # Wooden bed rail (x=53..61, y=63)
    cv.hline(53, 61, 63, c("cedar", 4))

    # ------------------------------------------------------------------
    # 3. 1F WARM STONE & CEDAR FACADE, PARLOR WINDOW, OAK DOOR & BARRELS (y=75..111)
    # ------------------------------------------------------------------
    # Upper 1F warm horizontal cedar clapboard/wainscot (x=1..50, y=75..98)
    for y in range(75, 99):
        plank = (y - 75) // 3
        ry = (y - 75) % 3
        for x in range(1, 51):
            if x in (1, 50):
                cv.put(x, y, ink0)
                continue
            hv = h2(x // 6, plank, 615)
            if ry == 2:
                col = c("wood", 1)
            elif ry == 0:
                col = c("cedar", 4 if hv > 100 else 3)
            else:
                col = c("cedar", 3 if hv > 90 else 2)
            cv.put(x, y, col)

    # Lower 1F warm dressed stone base (x=1..50, y=99..111)
    draw_ashlar_wall(cv, 1, 99, 50, 110, "stone", "stone", seed=909)
    cv.hline(1, 50, 99, c("stone", 5))
    cv.hline(1, 62, 111, c("stone", 1))
    cv.put(1, 111, ink0)
    cv.put(62, 111, ink0)

    # Overhang shadow under 2F jetty beam (y=75..77)
    cv.shadow_rect(2, 75, 49, 76, 2)
    cv.shadow_rect(2, 77, 49, 77, 1)

    # --- LEFT 1F: WIDE GLOWING TAVERN-PARLOR WINDOW (x=4..25, y=79..97) ---
    # Carved dark-oak window frame & warm sill
    cv.rect(4, 79, 25, 97, c("darkwood", 0))
    cv.hline(4, 25, 79, c("cedar", 4))
    cv.hline(3, 26, 97, c("cedar", 5))
    cv.hline(3, 26, 98, c("darkwood", 1))
    cv.shadow_rect(4, 99, 26, 99, 2)

    # Interior tavern parlor scene across 3 panes:
    #   Pane 1 (x=5..10): Brick hearth fireplace with roaring golden fire!
    #   Pane 2 (x=12..17) & Pane 3 (x=19..24): Warm parlor glow + 2 frothy ale mugs on oak counter!
    for y in range(80, 97):
        for x in range(5, 25):
            if x in (11, 18) or y == 86:
                cv.put(x, y, c("darkwood", 2 if x == 11 else 1))
                continue
            if y < 86:
                if y <= 81:
                    cv.put(x, y, c("red", 3 if (x % 2 == 0) else 2))
                else:
                    cv.put(x, y, c("yellow", 5 if (x in (8, 15, 21) and y == 84) else 4) if x in (8, 15, 21) else c("orange", 3))
            elif y >= 94:
                cv.put(x, y, c("floorwood", 3 if y == 94 else 1))
            else:
                if x <= 10:
                    # Brick hearth arch + dark firebox + flickering fire & red embers!
                    if x in (5, 10) or y in (87, 88):
                        cv.put(x, y, c("brick", 3 if (x + y) % 2 == 0 else 2))
                    elif y == 93 and x in (6, 9):
                        cv.put(x, y, c("red", 4))
                    elif y >= 91 and x in (7, 8):
                        cv.put(x, y, c("white", 6) if y == 92 else c("yellow", 5))
                    elif y == 90 and x in (7, 8):
                        cv.put(x, y, c("orange", 5))
                    else:
                        cv.put(x, y, c("brick", 0))
                else:
                    cv.put(x, y, c("orange", 4 if y >= 91 else 3))

    # Draw 2 unmistakable frothy golden Ale Mugs on the tavern table (Pane 2 & Pane 3, y=89..93)!
    for mx in (13, 20):
        # Fluffy white beer foam cap (y=89..90)
        cv.hline(mx, mx + 2, 89, c("white", 6))
        cv.put(mx, 90, c("white", 6))
        cv.put(mx + 1, 90, c("white", 5))
        cv.put(mx + 2, 90, c("cream", 5))
        # Golden amber mug body (y=91..93)
        for my in range(91, 94):
            cv.put(mx, my, c("yellow", 5))
            cv.put(mx + 1, my, c("yellow", 4))
            cv.put(mx + 2, my, c("orange", 3))
        # Mug handle at mx+3
        cv.put(mx + 3, 91, c("yellow", 3))
        cv.put(mx + 3, 92, c("yellow", 3))

    # Cozy stacked split-firewood rack under parlor window (x=5..16, y=104..111)
    cv.vline(5, 104, 111, c("darkwood", 1))
    cv.vline(16, 104, 111, c("darkwood", 1))
    for ly in (106, 108, 110):
        for lx in range(6, 16, 3):
            cv.put(lx, ly, c("cedar", 5))
            cv.put(lx + 1, ly, c("cedar", 4))
            cv.put(lx, ly + 1, c("wood", 3))
            cv.put(lx + 1, ly + 1, c("darkwood", 1))
    cv.hline(5, 16, 111, ink0)

    # --- HANGING WARM LANTERN BETWEEN WINDOW & DOOR (cx=28, ty=80) ---
    draw_iron_lantern(cv, 28, 80, cast_on_wall=True)

    # --- RIGHT-CENTER 1F: ARCHED OAK ENTRANCE DOOR WITH BRASS RING (x=32..46, y=78..111) ---
    dcx, dcy = 39.0, 86.0
    # Dressed stone arch surround (x=31..47, y=78..108)
    for y in range(78, 109):
        for x in range(31, 48):
            if y < 86:
                r2 = (x - dcx) ** 2 + ((y - dcy) * 1.1) ** 2
                if 8.4 ** 2 >= r2 >= 5.6 ** 2:
                    is_j = ((x + y) % 4 == 0)
                    if r2 >= 7.6 ** 2 or r2 <= 6.2 ** 2:
                        cv.put(x, y, ink0 if r2 <= 6.2 ** 2 else c("stone", 2))
                    else:
                        cv.put(x, y, c("stone", 6 if (38 <= x <= 40 and y <= 80) else (2 if is_j else 4)))
            else:
                if x in (32, 33, 45, 46):
                    cv.put(x, y, ink0 if x in (33, 45) else c("stone", 4 if (y % 4 != 0) else 2))

    # Arched Oak Door Planks + Warm Fanlight + Brass Ring Knocker (x=34..44, y=81..108)
    for y in range(81, 109):
        for x in range(34, 45):
            if y < 86:
                r2 = (x - dcx) ** 2 + ((y - dcy) * 1.1) ** 2
                if r2 > 5.6 ** 2:
                    continue
                # Warm amber arched glass fanlight!
                if y == 85:
                    cv.put(x, y, c("darkwood", 1))
                elif x == 39:
                    cv.put(x, y, c("darkwood", 2))
                else:
                    cv.put(x, y, c("yellow", 5 if abs(x - 39) <= 2 else 4))
            else:
                # Vertical oak planks with iron strap hinges
                px_rel = x - 34
                if y in (89, 103) and px_rel <= 5:
                    cv.put(x, y, c("yellow", 4) if px_rel == 2 else c("kuro", 1))
                elif px_rel in (0, 3, 7, 10):
                    cv.put(x, y, c("darkwood", 2 if px_rel in (3, 7) else 1))
                else:
                    cv.put(x, y, c("wood", 4 if px_rel < 6 else 3))

    # Gleaming Brass Ring Handle/Knocker at (41..43, 95..97)
    cv.put(42, 95, c("yellow", 5))
    cv.put(41, 96, c("yellow", 5))
    cv.put(43, 96, c("orange", 4))
    cv.put(42, 97, c("yellow", 4))

    # Welcoming Flagstone Door Steps (x=31..47, y=108..111)
    cv.hline(32, 46, 108, c("stone", 5))
    cv.hline(32, 46, 109, c("stone", 3))
    cv.hline(31, 47, 110, c("stone", 5))
    cv.hline(31, 47, 111, c("stone", 1))
    cv.put(31, 110, ink0)
    cv.put(47, 110, ink0)

    # --- RIGHT EXTERIOR CLUSTER: STACKED OAK ALE BARRELS & POTTED SHRUB (x=46..63, y=91..111) ---
    def draw_oak_barrel(bx0: int, by0: int, bw: int, bh: int) -> None:
        for dy in range(bh):
            y = by0 + dy
            bulge = 0 if dy in (0, bh - 1) else 1
            lx = bx0 - bulge
            rx = bx0 + bw - 1 + bulge
            is_hoop = dy in (2, bh - 3)
            for x in range(lx, rx + 1):
                if x in (lx, rx) or dy in (0, bh - 1):
                    if dy == 0 and lx < x < rx:
                        cv.put(x, y, c("cedar", 4))  # sunlit barrel lid
                    else:
                        cv.put(x, y, ink0)
                elif is_hoop:
                    rel = x - lx
                    cv.put(x, y, c("steel", 4 if rel <= 2 else (3 if rel <= 4 else 1)))
                else:
                    rel = x - lx
                    if rel in (1, 2):
                        cv.put(x, y, c("cedar", 4 if rel == 1 else 3))
                    elif rel == 3:
                        cv.put(x, y, c("wood", 4))
                    elif rel == 4:
                        cv.put(x, y, c("wood", 3))
                    else:
                        cv.put(x, y, c("wood", 2))

    # Cast shadow on lower right wall behind barrels
    cv.shadow_rect(46, 92, 50, 110, 2)
    # Bottom-left barrel (x=46..51, y=100..111) & Bottom-right barrel (x=52..57, y=100..111)
    draw_oak_barrel(46, 100, 6, 12)
    draw_oak_barrel(52, 100, 6, 12)
    # Top stacked ale barrel (x=48..54, y=91..100) with brass tap spigot!
    draw_oak_barrel(48, 91, 6, 10)
    cv.put(51, 96, c("yellow", 5))  # brass tap spigot!
    cv.put(51, 97, c("orange", 3))

    # Lush Potted Shrub at far right base (x=57..63, y=98..111)
    # Terracotta pot (x=58..62, y=105..111)
    cv.hline(57, 63, 105, ink0)
    cv.hline(58, 62, 106, c("brick", 5))
    cv.put(57, 106, ink0)
    cv.put(63, 106, ink0)
    for y in range(107, 111):
        cv.put(58, y, ink0)
        cv.put(59, y, c("brick", 4))
        cv.put(60, y, c("brick", 3))
        cv.put(61, y, c("brick", 2))
        cv.put(62, y, ink0)
    cv.hline(58, 62, 111, ink0)

    # Round layered green bush crown (x=56..63, y=98..105)
    bcx, bcy = 60.0, 101.5
    for y in range(98, 106):
        for x in range(56, 64):
            d2 = (x - bcx) ** 2 + ((y - bcy) * 1.1) ** 2
            if d2 <= 12.5:
                if d2 >= 9.2 and y >= 103:
                    cv.put(x, y, c("foliage", 0))
                elif x < bcx and y < bcy:
                    cv.put(x, y, c("foliage", 6 if d2 < 4 else 5))
                elif x < bcx + 1 and y < bcy + 1:
                    cv.put(x, y, c("foliage", 4))
                else:
                    cv.put(x, y, c("foliage", 2 if y < 104 else 1))
    # Tiny warm red berries on shrub
    cv.put(59, 100, c("red", 4))
    cv.put(61, 102, c("red", 5))
    cv.put(58, 103, c("yellow", 5))

    return cv.img


# ==============================================================================
# VERIFICATION & 3x PREVIEW SHEET
# ==============================================================================
def verify_sprite(
    name: str,
    img: Image.Image,
    expected_size: tuple[int, int],
    allowed_rgb: set[tuple[int, int, int]],
) -> dict:
    assert img.mode == "RGBA", f"{name}: must be RGBA"
    assert img.size == expected_size, f"{name}: size {img.size} != {expected_size}"
    w, h = img.size
    px = img.load()

    off_palette = 0
    bad_alpha = 0
    pure_black = 0
    opaque_colors: set[tuple[int, int, int]] = set()
    transparent_px = 0
    grounded_bottom = sum(1 for x in range(w) if px[x, h - 1][3] == 255)

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

    assert off_palette == 0, f"{name}: {off_palette} off-palette pixels!"
    assert bad_alpha == 0, f"{name}: {bad_alpha} non-binary alpha pixels!"
    assert pure_black == 0, f"{name}: {pure_black} pure #000000 pixels!"
    assert 60 <= len(opaque_colors) <= 95, f"{name}: unique_colors {len(opaque_colors)} outside 60..95!"
    assert grounded_bottom >= w // 2, f"{name}: bottom row y={h - 1} not grounded!"

    return {
        "name": name,
        "size": f"{w}x{h}",
        "unique_colors": len(opaque_colors),
        "transparent_px": transparent_px,
        "grounded_bottom_px": grounded_bottom,
        "off_palette": off_palette,
        "pure_black": pure_black,
        "binary_alpha_pass": (bad_alpha == 0),
    }


def make_checkerboard_preview(sprites: list[tuple[str, Image.Image]], scale: int = 3) -> Image.Image:
    """Renders 3x nearest-neighbor + 1x native preview sheet on #23262e checkerboard."""
    bg_dark = (0x23, 0x26, 0x2E, 255)
    bg_lite = (0x2B, 0x2F, 0x3A, 255)
    pad = 24
    gap = 28
    top_header = 32

    scaled_w = sum(im.width * scale for _, im in sprites) + gap * (len(sprites) - 1)
    actual_w = sum(im.width for _, im in sprites) + 16 * (len(sprites) - 1)
    total_w = pad * 2 + scaled_w + gap + actual_w
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
        draw.text((cx, 9), f"{label} (3x)", fill=(232, 236, 244, 255))
        up = im.resize((im.width * scale, im.height * scale), Image.Resampling.NEAREST)
        sheet.alpha_composite(up, (cx, top_header))
        cx += up.width + gap

    draw.text((cx, 9), "1x native", fill=(184, 190, 204, 255))
    for _, im in sprites:
        sheet.alpha_composite(im, (cx, top_header))
        cx += im.width + 16

    return sheet.convert("RGB")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)

    ramps, allowed_rgb = load_palette()

    guild_img = build_ft_guild(ramps)
    inn_img = build_ft_inn(ramps)

    guild_path = OUT_DIR / "ft-guild.png"
    inn_path = OUT_DIR / "ft-inn.png"
    guild_img.save(guild_path)
    inn_img.save(inn_path)

    stats_guild = verify_sprite("ft-guild.png", guild_img, (80, 112), allowed_rgb)
    stats_inn = verify_sprite("ft-inn.png", inn_img, (64, 112), allowed_rgb)

    preview = make_checkerboard_preview(
        [("ft-guild 80x112", guild_img), ("ft-inn 64x112", inn_img)],
        scale=3,
    )
    preview.save(PREVIEW_PATH)

    print("PASS: Fantasy Town Batch 1 generated & verified!")
    print(json.dumps({"ft-guild": stats_guild, "ft-inn": stats_inn}, indent=2))


if __name__ == "__main__":
    main()
