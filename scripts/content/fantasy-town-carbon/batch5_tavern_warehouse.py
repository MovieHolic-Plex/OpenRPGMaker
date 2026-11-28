#!/usr/bin/env python3
"""
T4 Fantasy Town Fable-Grade Buildings — Batch 5/5 (gemini-4-carbon medium)
Generates two 100% original Beodeul Harbour-Town ('버들항') 64x112 RGBA buildings:
  1. ft-tavern.png    (64x112 RGBA, 4x7 tiles) — The Salty Anchor Harbor Tavern (항구 선술집)
  2. ft-warehouse.png (64x112 RGBA, 4x7 tiles) — Beodeul Maritime Trade Guild & Warehouse (항구 무역상·창고)

Hard Rules Enforced:
  - 100% locked to tiledata/jp-city/fable-city/palette.json (0 off-palette, 0 #000000)
  - Strict binary alpha {0, 255}
  - Rich Fable-5.2 pixel density (60–95 unique palette colors per building)
  - Top-3/4 RPG Camera: Roof (y=0..42), 2F facade (y=42..74), 1F harbourfront (y=74..112)
  - Pictorial Maritime Signboards:
      * ft-tavern: Swinging wooden foaming-ale-mug & anchor sign on wrought-iron bracket
      * ft-warehouse: Brass balance-scales & ship-wheel trade crest
"""

from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
PALETTE_PATH = ROOT / "tiledata/jp-city/fable-city/palette.json"
OUT_DIR = ROOT / "tiledata/fantasy-town-carbon/buildings"
PREVIEW_PATH = ROOT / "tiledata/fantasy-town-carbon/preview_batch5.png"


def hex_to_rgba(hx: str) -> tuple[int, int, int, int]:
    hx = hx.lstrip("#")
    return (int(hx[0:2], 16), int(hx[2:4], 16), int(hx[4:6], 16), 255)


def load_palette():
    with open(PALETTE_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)["ramps"]
    ramps: dict[str, list[tuple[int, int, int, int]]] = {
        k: [hex_to_rgba(c) for c in v] for k, v in raw.items()
    }
    allowed_rgb: set[tuple[int, int, int]] = {
        (c[0], c[1], c[2]) for cols in ramps.values() for c in cols
    }
    return ramps, allowed_rgb


def h2(x: int, y: int, seed: int = 0) -> int:
    """Deterministic spatial hash returning 0..255."""
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
            "cha", "cedar", "wood", "darkwood", "brick", "rooftile",
            "stone", "kawara", "kuro", "steel", "cream", "straw",
            "yellow", "orange", "red", "moss", "foliage", "teal",
            "glass", "blue", "navy", "white", "ink",
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

    def warm_glow_pixel(self, x: int, y: int, strength: int = 1) -> None:
        """Warmly brighten brick/wood/stone under nearby lantern or festoon bulb."""
        cur = self.get(x, y)
        if cur[3] == 0:
            return
        info = self.color_to_ramp.get(cur)
        if info is None:
            return
        rname, idx = info
        if rname in ("brick", "rooftile", "cha", "cedar", "wood", "darkwood", "stone"):
            self.put(x, y, self.c(rname, idx + strength))


# ==============================================================================
# SHARED ARCHITECTURAL & MARITIME TEXTURE HELPERS
# ==============================================================================
def fill_harbor_brick(
    cv: PixelCanvas, x0: int, y0: int, x1: int, y1: int, seed: int = 11, weathered: bool = True
) -> None:
    """Fable-grade running-bond harbour brick masonry with salt-air mortar & tonal variation."""
    c = cv.c
    for y in range(y0, y1 + 1):
        ry = y - y0
        course = ry // 3
        in_row = ry % 3
        offset = 3 if (course % 2 == 1) else 0
        for x in range(x0, x1 + 1):
            rx = x - x0 + offset
            in_col = rx % 6
            hv = h2(rx // 6, course, seed)
            px_h = h2(x, y, seed + 7)
            if in_row == 2:
                col = c("stone", 2 if (px_h % 3 == 0) else 1)
                if weathered and px_h > 228:
                    col = c("stone", 3)
            elif in_col == 5:
                col = c("stone", 1 if (px_h % 2 == 0) else 2)
            else:
                if hv < 145:
                    ramp = "brick"
                    base = 4 if in_row == 0 else 3
                elif hv < 215:
                    ramp = "brick"
                    base = 3 if in_row == 0 else 2
                else:
                    ramp = "rooftile"
                    base = 3 if in_row == 0 else 2

                if in_col == 0 and in_row == 0:
                    base += 1  # top-left sun catch
                elif in_col == 4 and in_row == 1:
                    base -= 1  # bottom-right micro shade
                if weathered and hv > 245:
                    col = c("stone", 4 if in_row == 0 else 3)  # salt-bleached brick
                else:
                    col = c(ramp, clamp(base, 1, 5))
            cv.put(x, y, col)


def draw_timber_post(
    cv: PixelCanvas, x0: int, y0: int, x1: int, y1: int, ramp: str = "darkwood", bolts: bool = True
) -> None:
    """Vertical structural timber post with wood grain & iron bolt studs."""
    c = cv.c
    w = x1 - x0 + 1
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            dx = x - x0
            g = h2(x, y // 3, 41)
            if dx == 0:
                idx = 1 if ramp == "darkwood" else 2
            elif dx == 1 and w >= 3:
                idx = 4 if (g % 4 != 0) else 3
            elif dx == w - 1:
                idx = 0 if ramp == "darkwood" else 1
            else:
                idx = 3 if (g % 3 != 0) else 2
            cv.put(x, y, c(ramp, idx))
    if bolts and (y1 - y0) >= 12:
        mid_x = x0 + w // 2
        for by in (y0 + 3, (y0 + y1) // 2, y1 - 3):
            cv.put(mid_x, by, c("steel", 4))
            if by + 1 <= y1:
                cv.put(mid_x, by + 1, c("kuro", 0))


def draw_timber_beam(
    cv: PixelCanvas, x0: int, y0: int, x1: int, y1: int, ramp: str = "wood"
) -> None:
    """Horizontal structural timber beam with sunlit top bevel, wood grain, and dark underside."""
    c = cv.c
    h = y1 - y0 + 1
    for y in range(y0, y1 + 1):
        dy = y - y0
        for x in range(x0, x1 + 1):
            g = h2(x // 4, y, 59)
            if dy == 0:
                col = c(ramp, 5 if (g % 3 != 0) else 4)
            elif dy == h - 1:
                col = c("darkwood", 0)
            elif dy == 1 and h >= 4:
                col = c(ramp, 4 if (g % 2 == 0) else 3)
            else:
                col = c(ramp, 2 if (g % 4 == 0) else 3)
            cv.put(x, y, col)


def draw_stone_quay_base(cv: PixelCanvas, y0: int = 106, y1: int = 111, seed: int = 99) -> None:
    """Heavy Beodeul granite harbour quay foundation with coastal sea-moss."""
    c = cv.c
    for y in range(y0, y1 + 1):
        ry = y - y0
        course = ry // 3
        in_row = ry % 3
        offset = 4 if course % 2 == 1 else 0
        for x in range(cv.w):
            rx = x + offset
            in_col = rx % 9
            hv = h2(rx // 9, course, seed)
            mh = h2(x, y, seed + 31)
            if y == y1:
                col = c("moss", 1) if (mh % 3 == 0) else c("ink", 0)
            elif in_row == 0 and ry == 0:
                col = c("stone", 5 if (in_col < 6) else 4)
            elif in_row == 2 or in_col == 8:
                col = c("stone", 0) if (mh % 2 == 0) else c("stone", 1)
            else:
                idx = 4 if (in_row == 0 and hv % 2 == 0) else (3 if in_col < 5 else 2)
                col = c("stone", idx)
                if y >= y1 - 2 and mh > 205:
                    col = c("moss", 2 if y == y1 - 1 else 3)
                elif y == y1 - 1 and 180 < mh <= 205:
                    col = c("teal", 1)
            cv.put(x, y, col)


def draw_crate_34(
    cv: PixelCanvas, x0: int, y0: int, w: int, h: int, top_h: int = 4, stencil: bool = False
) -> None:
    """Authentic Beodeul 3/4 wooden shipping crate (top sunlit lid + framed diagonal-brace front)."""
    c = cv.c
    x1 = x0 + w - 1
    y1 = y0 + h - 1
    ym = y0 + top_h

    # Top plane (3/4 foreshortened lid)
    for y in range(y0, ym):
        dy = y - y0
        inset = (ym - 1 - y) // 2
        lx0 = x0 + inset
        lx1 = x1 - (inset // 2)
        for x in range(lx0, lx1 + 1):
            if y == y0 or x == lx0 or x == lx1:
                col = c("wood", 2) if y == y0 else c("cedar", 3)
            elif dy == 1:
                col = c("cream", 5) if (x + y) % 3 != 0 else c("cedar", 5)
            else:
                col = c("cedar", 5) if (x % 4 != 0) else c("cream", 4)
            cv.put(x, y, col)

    # Front face
    for y in range(ym, y1 + 1):
        for x in range(x0, x1 + 1):
            on_outer = (x == x0 or x == x1 or y == ym or y == y1)
            on_frame = (
                x == x0 + 1 or x == x1 - 1 or y == ym + 1 or y == y1 - 1
            )
            if on_outer:
                if y == ym:
                    col = c("cream", 4)
                elif y == y1 or x == x1:
                    col = c("darkwood", 0)
                else:
                    col = c("wood", 2)
            elif on_frame:
                col = c("cedar", 4) if (x == x0 + 1 or y == ym + 1) else c("wood", 3)
            else:
                plank_row = (y - ym) % 3
                diag_d = abs((x - (x0 + 2)) - ((y - (ym + 2)) * max(1, w - 4)) // max(1, (y1 - ym - 3)))
                if diag_d == 0:
                    col = c("cedar", 5)
                elif diag_d == 1:
                    col = c("wood", 3)
                else:
                    col = c("cedar", 3 if plank_row != 2 else 2)
            cv.put(x, y, col)

    for nx, ny in ((x0 + 1, ym + 1), (x1 - 1, ym + 1), (x0 + 1, y1 - 1), (x1 - 1, y1 - 1)):
        cv.put(nx, ny, c("steel", 2))
    if stencil and w >= 9 and (y1 - ym) >= 6:
        cv.put(x0 + 3, y1 - 2, c("glass", 3))
        cv.put(x0 + 4, y1 - 2, c("teal", 3))


# ==============================================================================
# BUILDING 1: ft-tavern.png (64x112) — The Salty Anchor Harbor Tavern (항구 선술집)
# ==============================================================================
def build_ft_tavern(ramps) -> Image.Image:
    cv = PixelCanvas(64, 112, ramps)
    c = cv.c

    # ------------------------------------------------------------------
    # 1. ROOF (y=0..42): Staggered 4x5 dark-cedar & cha shingles, dormer, chimney, seagull & moss
    # ------------------------------------------------------------------
    # Ridge timber crest (y=3..6, x=2..61)
    for x in range(2, 62):
        cv.put(x, 3, c("ink", 0))
        cv.put(x, 4, c("cedar", 5 if x % 6 != 0 else 3))
        cv.put(x, 5, c("cha", 4 if x % 6 != 0 else 2))
        cv.put(x, 6, c("darkwood", 1))
        if x in (19, 31, 43, 54):
            cv.put(x, 3, c("kuro", 1))
            cv.put(x, 4, c("steel", 4))
            cv.put(x, 5, c("steel", 2))

    # Sculpted gable-end ridge finials (x=1..5 and x=58..62, y=1..6)
    for fx0 in (1, 58):
        for dy in range(6):
            for dx in range(5):
                x, y = fx0 + dx, 1 + dy
                if dy == 0 and dx in (0, 4):
                    continue
                if dy == 0 or dx == 0:
                    col = c("ink", 0)
                elif dx == 4:
                    col = c("darkwood", 0)
                elif dy == 1:
                    col = c("cedar", 5)
                elif dx == 2 and dy == 3:
                    col = c("yellow", 4)
                else:
                    col = c("cha", 3 if dy < 4 else 2)
                cv.put(x, y, col)

    # Crisp 4px-wide x 5px-tall Staggered Cedar & Cha Shingle Courses (y=7..39, x=0..63)
    course_h = 5
    shingle_w = 4
    for y in range(7, 40):
        ry = y - 7
        course = ry // course_h
        in_c = ry % course_h
        stag = 2 if (course % 2 == 1) else 0
        for x in range(64):
            if x == 0 or x == 63:
                cv.put(x, y, c("darkwood", 0 if x == 63 else 1))
                continue
            sx = (x + stag) // shingle_w
            in_s = (x + stag) % shingle_w
            sv = h2(sx, course, 101)
            pv = h2(x, y, 103)

            if sv < 115:
                ramp = "cha"
                sh_base = 3
            elif sv < 195:
                ramp = "cedar"
                sh_base = 2
            elif sv < 245:
                ramp = "wood"
                sh_base = 3
            else:
                ramp = "stone"  # salt-bleached driftwood shingle
                sh_base = 3

            if in_c == course_h - 1:
                # Scalloped bottom overlap shadow
                col = c("ink", 0) if in_s in (0, 3) else c("darkwood", 0 if sv % 2 == 0 else 1)
            elif in_s == 0:
                # Vertical seam between shingles
                col = c("darkwood", 1 if in_c < 2 else 0)
            else:
                idx = sh_base
                if in_c == 0:
                    idx += 0  # tucked under upper shingle butt
                elif in_c == 1 and in_s == 1:
                    idx += 2 if ramp in ("cha", "cedar") else 1  # sunlit upper-left bevel!
                elif in_c == 1 and in_s == 2:
                    idx += 1
                elif in_c == 3:
                    idx -= 1
                if pv > 215 and in_s == 2:
                    idx -= 1
                if y < 15 and in_c == 1:
                    idx += 1
                elif y > 33 and in_c >= 2:
                    idx -= 1
                col = c(ramp, clamp(idx, 1, 5))
            cv.put(x, y, col)

    # Coastal sea-moss & lichen clusters nestled in damp shingle crevices
    moss_patches = [
        (3, 33), (4, 33), (5, 34), (4, 34), (6, 35),
        (18, 22), (19, 22), (19, 23), (20, 23),
        (26, 35), (27, 35), (28, 36), (27, 36), (29, 36), (25, 36),
        (57, 34), (58, 34), (59, 35), (58, 35), (60, 36), (56, 35),
        (31, 28), (32, 28), (32, 29),
    ]
    for idx_m, (mx, my) in enumerate(moss_patches):
        mramp = "moss" if idx_m % 2 == 0 else "foliage"
        midx = 4 if (mx + my) % 3 == 0 else (3 if (mx % 2 == 0) else 2)
        cv.put(mx, my, c(mramp, midx))
        if my + 1 < 39 and idx_m % 2 == 0:
            cv.put(mx, my + 1, c("moss", 1))

    # Brick Chimney on upper-left roof (x=8..17, y=0..18) + cast shadow
    cv.shadow_rect(18, 6, 20, 19, steps=2)
    cv.shadow_rect(9, 19, 19, 20, steps=2)
    fill_harbor_brick(cv, 9, 4, 16, 17, seed=211, weathered=True)
    cv.vline(8, 4, 17, c("ink", 0))
    cv.vline(17, 4, 17, c("darkwood", 0))
    cv.hline(8, 17, 18, c("ink", 0))
    cv.put(11, 6, c("kuro", 1))
    cv.put(14, 5, c("kuro", 2))
    cv.put(15, 16, c("moss", 2))
    # Stone chimney crown & dark flue opening (x=7..18, y=0..4)
    cv.rect(7, 1, 18, 3, c("stone", 4))
    cv.hline(8, 17, 0, c("ink", 0))
    cv.hline(8, 17, 1, c("stone", 6))
    cv.hline(7, 18, 3, c("stone", 2))
    cv.hline(8, 17, 4, c("ink", 0))
    cv.put(7, 1, c("ink", 0))
    cv.put(7, 2, c("ink", 0))
    cv.put(18, 1, c("ink", 0))
    cv.put(18, 2, c("ink", 0))
    cv.hline(10, 15, 1, c("kuro", 0))
    cv.hline(11, 14, 0, c("rooftile", 4))
    cv.put(12, 0, c("ink", 0))
    cv.put(13, 0, c("kuro", 0))

    # Perched Harbor Seagull on the ridge (x=22..29, y=0..6)!
    cv.put(24, 0, c("white", 6))
    cv.put(25, 0, c("white", 5))
    cv.put(22, 1, c("orange", 4))   # beak tip
    cv.put(23, 1, c("yellow", 4))   # beak base
    cv.put(24, 1, c("ink", 0))      # eye
    cv.put(25, 1, c("white", 6))    # head
    cv.put(24, 2, c("white", 6))    # breast
    cv.put(25, 2, c("white", 5))
    cv.put(26, 2, c("kawara", 6))   # folded slate-grey wing
    cv.put(27, 2, c("kawara", 5))
    cv.put(24, 3, c("white", 4))
    cv.put(25, 3, c("kawara", 5))
    cv.put(26, 3, c("kawara", 4))
    cv.put(27, 3, c("steel", 3))
    cv.put(28, 3, c("kuro", 1))     # dark primary wingtips
    cv.put(29, 3, c("ink", 0))      # tail tip
    cv.put(25, 4, c("orange", 3))   # webbed leg 1
    cv.put(26, 4, c("orange", 4))   # webbed leg 2
    cv.put(27, 4, c("ink", 0))

    # Pitched Attic Dormer on right-center roof (x=34..56, y=8..36)
    for y in range(18, 37):
        max_sx = min(61, 55 + (y - 16) // 3)
        cv.shadow_rect(54, y, max_sx, y, steps=2)

    # Oxidized copper dormer finial spike (x=45, y=8..10)
    cv.put(45, 8, c("teal", 4))
    cv.put(45, 9, c("teal", 3))
    cv.put(44, 10, c("teal", 2))
    cv.put(45, 10, c("teal", 5))
    cv.put(46, 10, c("teal", 1))

    # Dormer pitched ㅅ-gable roof & bargeboards
    for x in range(34, 57):
        d = abs(x - 45)
        y_top = 11 + d
        y_in = 15 + d
        cv.put(x, y_top - 1, c("ink", 0))
        cv.put(x, y_top, c("cedar", 5 if x <= 45 else 3))
        cv.put(x, y_top + 1, c("cha", 4 if x <= 45 else 2))
        cv.put(x, y_top + 2, c("wood", 3 if x <= 45 else 1))
        cv.put(x, y_top + 3, c("darkwood", 0))
        if 37 <= x <= 53:
            y_start = max(y_in, 16)
            for y in range(y_start, 36):
                if x in (37, 38, 52, 53):
                    col = c("darkwood", 2 if x in (37, 52) else 1)
                else:
                    col = c("brick", 3 if (x + y) % 3 != 0 else 2)
                cv.put(x, y, col)
            if y_start <= 34:
                cv.shadow_pixel(x, y_start, steps=2)

    # Dormer warm amber attic window (x=40..50, y=20..32)
    cv.rect(40, 20, 50, 32, c("darkwood", 0))
    cv.rect(41, 21, 49, 31, c("wood", 2))
    for y in range(22, 31):
        for x in range(42, 49):
            if x == 45 or y == 26:
                col = c("darkwood", 1)
            else:
                dist = abs(x - 44) + abs(y - 25)
                if dist <= 2:
                    col = c("yellow", 5)
                elif dist <= 4:
                    col = c("yellow", 4)
                elif dist <= 6:
                    col = c("orange", 4)
                else:
                    col = c("orange", 3)
            cv.put(x, y, col)
    cv.hline(38, 52, 33, c("cedar", 5))
    cv.hline(38, 52, 34, c("wood", 3))
    cv.hline(37, 53, 35, c("darkwood", 0))
    cv.shadow_rect(38, 36, 54, 36, steps=2)

    # Roof Eave Fascia, Scalloped Drip Edge & Rafter Corbels (y=39..42)
    for x in range(64):
        cv.put(x, 39, c("cedar", 4) if (x % 3 != 0) else c("darkwood", 0))
        cv.put(x, 40, c("wood", 4 if (x % 6 < 4) else 2))
        cv.put(x, 41, c("darkwood", 2 if (x % 4 == 1) else 1))
        cv.put(x, 42, c("ink", 0))

    # ------------------------------------------------------------------
    # 2. 2F FACADE (y=42..74): Brick & dark-wood, amber bottle-glass windows,
    #    festoon bulbs, wrought-iron bracket + foaming golden tankard & anchor sign!
    # ------------------------------------------------------------------
    fill_harbor_brick(cv, 0, 43, 63, 70, seed=307, weathered=True)

    draw_timber_post(cv, 0, 43, 3, 70, ramp="darkwood", bolts=True)
    draw_timber_post(cv, 19, 43, 21, 70, ramp="darkwood", bolts=True)
    draw_timber_post(cv, 38, 43, 40, 70, ramp="darkwood", bolts=True)
    draw_timber_post(cv, 60, 43, 63, 70, ramp="darkwood", bolts=True)

    for i in range(6):
        cv.put(4 + i, 49 - i, c("wood", 3))
        cv.put(4 + i, 50 - i, c("darkwood", 1))
        cv.put(59 - i, 49 - i, c("wood", 3))
        cv.put(59 - i, 50 - i, c("darkwood", 1))

    cv.shadow_rect(0, 43, 63, 44, steps=2)
    cv.shadow_rect(0, 45, 63, 45, steps=1)

    # Two 2F Warm Amber Bottle-Glass Windows (x=5..17, y=49..65) & (x=23..35, y=49..65)
    for wx0 in (5, 23):
        wx1 = wx0 + 12
        cv.hline(wx0 - 1, wx1 + 1, 48, c("stone", 4))
        cv.hline(wx0 - 1, wx1 + 1, 49, c("stone", 2))
        cv.rect(wx0, 50, wx1, 64, c("darkwood", 0))
        cv.rect(wx0 + 1, 51, wx1 - 1, 63, c("wood", 2))
        for py0 in (52, 58):
            for px0 in (wx0 + 2, wx0 + 7):
                cx_p = px0 + 1.5
                cy_p = py0 + 2.0
                for py in range(py0, py0 + 5):
                    for px in range(px0, px0 + 4):
                        d2 = (px - cx_p) ** 2 + (py - cy_p) ** 2
                        if d2 <= 1.3:
                            col = c("yellow", 5)
                        elif d2 <= 3.2:
                            col = c("yellow", 4)
                        elif d2 <= 5.5:
                            col = c("orange", 4)
                        else:
                            col = c("orange", 2 if py == py0 else 3)
                        cv.put(px, py, col)
        cv.vline(wx0 + 6, 51, 63, c("darkwood", 0))
        cv.hline(wx0 + 1, wx1 - 1, 57, c("darkwood", 0))
        cv.hline(wx0 - 1, wx1 + 1, 65, c("cedar", 5))
        cv.hline(wx0 - 1, wx1 + 1, 66, c("wood", 3))
        cv.hline(wx0 - 1, wx1 + 1, 67, c("darkwood", 0))
        cv.shadow_rect(wx0, 68, wx1 + 1, 68, steps=2)
        for fx in range(wx0, wx1 + 1):
            fh = h2(fx, wx0, 77)
            cv.put(fx, 64, c("foliage", 4 if fh % 2 == 0 else 3))
            if fh % 3 == 0:
                cv.put(fx, 63, c("moss", 4))
            if fx in (wx0 + 2, wx0 + 6, wx0 + 10):
                cv.put(fx, 64, c("yellow", 4) if fx == wx0 + 6 else c("red", 4))
            if fx in (wx0 + 1, wx0 + 9):
                cv.put(fx, 65, c("foliage", 2))

    # String of Glowing Warm Festoon Bulbs under the eave (y=43..48)
    bulb_xs = [8, 15, 23, 35, 44, 53]
    for x in range(3, 61):
        seg_x = (x - 3) / 28.0 if x <= 31 else (x - 31) / 29.0
        sag = int(round(2.2 * (1.0 - (2.0 * seg_x - 1.0) ** 2)))
        cv.put(x, 43 + sag, c("kuro", 0))
    for bx in bulb_xs:
        seg_x = (bx - 3) / 28.0 if bx <= 31 else (bx - 31) / 29.0
        wy = 43 + int(round(2.2 * (1.0 - (2.0 * seg_x - 1.0) ** 2)))
        for gy in range(wy, wy + 4):
            for gx in range(bx - 2, bx + 3):
                if abs(gx - bx) + abs(gy - (wy + 1)) <= 3:
                    cv.warm_glow_pixel(gx, gy, strength=1)
        cv.put(bx, wy, c("steel", 3))
        cv.put(bx, wy + 1, c("yellow", 5))
        cv.put(bx, wy + 2, c("yellow", 4))
        cv.put(bx - 1, wy + 1, c("orange", 4))
        cv.put(bx + 1, wy + 1, c("orange", 4))

    # Wrought-Iron Scroll Bracket & Swinging Foaming-Tankard + Anchor Sign (x=40..60, y=47..69)
    cv.shadow_rect(43, 52, 60, 70, steps=2)
    cv.hline(40, 60, 48, c("kuro", 1))
    cv.hline(40, 59, 49, c("ink", 0))
    cv.put(60, 47, c("steel", 4))
    cv.put(59, 47, c("kuro", 2))
    cv.put(41, 47, c("steel", 3))
    cv.put(42, 46, c("steel", 4))
    cv.put(43, 47, c("kuro", 2))
    cv.put(41, 50, c("kuro", 1))
    cv.put(42, 51, c("kuro", 2))
    for rx in (45, 56):
        cv.put(rx, 49, c("steel", 5))
        cv.put(rx, 50, c("steel", 3))

    # Carved Oak & Brass-Studded Tavern Signboard (x=42..59, y=51..69 -> 18x19 px!)
    cv.rect(42, 51, 59, 69, c("ink", 0))
    cv.rect(43, 52, 58, 68, c("wood", 4))
    cv.hline(43, 58, 52, c("cedar", 5))
    cv.vline(43, 52, 68, c("cedar", 4))
    cv.hline(43, 58, 68, c("darkwood", 1))
    cv.vline(58, 52, 68, c("darkwood", 1))
    for y in range(53, 68):
        for x in range(44, 58):
            cv.put(x, y, c("navy", 0 if (y == 53 or x == 44) else (1 if y < 63 else 2)))
    for rx, ry in ((43, 52), (58, 52), (43, 68), (58, 68)):
        cv.put(rx, ry, c("yellow", 4))

    # PICTORIAL ICON 1 (x=45..52, y=54..66): FOAMING GOLDEN TANKARD!
    foam_pts = [
        (46, 54, "white", 6), (47, 54, "white", 6), (48, 54, "white", 5),
        (45, 55, "white", 6), (46, 55, "white", 6), (47, 55, "cream", 6), (48, 55, "white", 6), (49, 55, "white", 5),
        (45, 56, "white", 5), (46, 56, "white", 6), (47, 56, "white", 5), (48, 56, "cream", 5), (49, 56, "white", 5), (50, 56, "cream", 4),
        (46, 57, "white", 6), (47, 57, "cream", 5), (49, 57, "cream", 4),
        (46, 58, "white", 5),
    ]
    for fx, fy, fr, fi in foam_pts:
        cv.put(fx, fy, c(fr, fi))

    for y in range(57, 67):
        for x in range(45, 51):
            if (x, y) in ((46, 57), (47, 57), (49, 57), (46, 58)):
                continue
            if y in (58, 65):
                col = c("yellow", 5 if x in (46, 47) else (4 if x < 50 else 2))
            elif y == 66:
                col = c("orange", 2 if x > 47 else 3)
            else:
                if x == 45:
                    col = c("yellow", 4)
                elif x == 46:
                    col = c("yellow", 5)
                elif x in (47, 48):
                    col = c("orange", 4 if x == 47 else 3)
                elif x == 49:
                    col = c("yellow", 3)
                else:
                    col = c("orange", 2)
            cv.put(x, y, col)
    cv.put(51, 59, c("yellow", 4))
    cv.put(52, 60, c("yellow", 4))
    cv.put(52, 61, c("yellow", 3))
    cv.put(52, 62, c("orange", 3))
    cv.put(52, 63, c("orange", 3))
    cv.put(51, 64, c("orange", 3))

    # PICTORIAL ICON 2 (x=53..57, y=55..66): SILVER-IRON HARBOR ANCHOR!
    cv.put(55, 55, c("white", 5))
    cv.put(54, 56, c("steel", 5))
    cv.put(56, 56, c("steel", 4))
    cv.put(55, 57, c("steel", 6))
    cv.hline(53, 57, 58, c("steel", 5))
    cv.put(55, 58, c("white", 5))
    cv.vline(55, 59, 65, c("steel", 5))
    cv.put(53, 63, c("white", 5))
    cv.put(53, 64, c("steel", 5))
    cv.put(54, 65, c("steel", 5))
    cv.put(57, 63, c("steel", 4))
    cv.put(57, 64, c("steel", 4))
    cv.put(56, 65, c("steel", 4))
    cv.put(55, 66, c("white", 5))

    # 2F-to-1F Carved Jetty Cornice Beam (y=71..74)
    draw_timber_beam(cv, 0, 71, 63, 74, ramp="wood")
    for x in range(1, 63, 2):
        cv.put(x, 72, c("cedar", 5))
        cv.put(x + 1, 72, c("wood", 2))
    for bx in (2, 20, 39, 61):
        cv.put(bx, 72, c("steel", 5))

    # ------------------------------------------------------------------
    # 3. 1F HARBOURFRONT (y=74..112): Glowing pub windows w/ patron & barrel silhouettes,
    #    batwing tavern doors, stacked hooped ale kegs, coiled rope & menu chalkboard!
    # ------------------------------------------------------------------
    fill_harbor_brick(cv, 0, 75, 63, 106, seed=419, weathered=True)
    draw_stone_quay_base(cv, y0=106, y1=111, seed=503)

    draw_timber_post(cv, 0, 75, 3, 106, ramp="darkwood", bolts=True)
    draw_timber_post(cv, 33, 75, 35, 106, ramp="darkwood", bolts=True)
    draw_timber_post(cv, 49, 75, 51, 106, ramp="darkwood", bolts=True)
    draw_timber_post(cv, 60, 75, 63, 106, ramp="darkwood", bolts=True)

    cv.shadow_rect(0, 75, 63, 76, steps=2)

    # Copper-and-Cedar Window Hood over 1F Pub Bay (x=3..33, y=75..78)
    for y in range(75, 79):
        dy = y - 75
        for x in range(3, 34):
            if dy == 0:
                col = c("ink", 0)
            elif dy == 1:
                col = c("teal", 4 if (x % 4 != 0) else 2)
            elif dy == 2:
                col = c("teal", 2 if (x % 4 != 0) else 1)
            else:
                col = c("darkwood", 0)
            cv.put(x, y, col)

    # Lively 3-Pane Glowing Harbor Pub Bay Window (x=4..32, y=79..97)
    cv.rect(4, 79, 32, 97, c("darkwood", 0))
    cv.rect(5, 80, 31, 96, c("wood", 2))
    for y in range(81, 96):
        for x in range(6, 31):
            if y == 81:
                col = c("rooftile", 3)  # warm interior ceiling timber shadow
            elif y < 84:
                col = c("orange", 4 if (9 <= x <= 27) else 3)
            elif y < 90:
                col = c("yellow", 5 if (8 <= x <= 28 and y < 88) else 4)
            else:
                col = c("orange", 4 if y < 93 else 3)
            cv.put(x, y, col)

    # Pane 1 (x=6..12): Stacked tap-barrels behind bar + glowing brass lamp!
    cv.rect(6, 89, 10, 92, c("wood", 3))
    cv.hline(6, 10, 89, c("cedar", 4))
    cv.vline(8, 89, 92, c("darkwood", 1))
    cv.rect(7, 85, 10, 88, c("wood", 2))
    cv.hline(7, 10, 85, c("cedar", 4))
    cv.put(11, 81, c("darkwood", 1))
    cv.put(11, 82, c("steel", 3))
    cv.put(11, 83, c("white", 6))
    cv.put(11, 84, c("yellow", 5))
    cv.hline(6, 12, 93, c("cedar", 4))
    cv.rect(6, 94, 12, 95, c("wood", 2))

    # Pane 2 (x=14..22): Hanging brass candelabrum + 2 lively sailor silhouettes clinking mugs!
    cv.put(18, 81, c("darkwood", 1))
    cv.hline(17, 19, 82, c("yellow", 4))
    cv.put(17, 81, c("white", 6))
    cv.put(19, 81, c("white", 6))
    # Left sailor with peaked sea-cap (x=14..17, y=86..95)
    cv.hline(15, 16, 86, c("navy", 1))
    cv.hline(15, 17, 87, c("ink", 0))
    cv.rect(15, 88, 16, 89, c("darkwood", 1))
    cv.rect(14, 90, 17, 95, c("darkwood", 0))
    cv.put(17, 89, c("darkwood", 1))  # raised arm toasting!
    # Clinking foaming golden tankards in center (x=18..19, y=87..89)
    cv.put(18, 87, c("white", 6))
    cv.put(18, 88, c("yellow", 5))
    cv.put(18, 89, c("orange", 4))
    cv.put(19, 88, c("white", 6))
    cv.put(19, 89, c("yellow", 4))
    # Right patron silhouette (x=20..22, y=87..95)
    cv.hline(20, 21, 87, c("darkwood", 2))
    cv.rect(20, 88, 21, 89, c("darkwood", 1))
    cv.rect(19, 90, 22, 95, c("darkwood", 0))

    # Pane 3 (x=24..30): Rum/wine bottle shelf + glowing table candle!
    cv.hline(24, 30, 86, c("wood", 2))
    cv.vline(25, 83, 85, c("teal", 4))
    cv.put(25, 82, c("white", 5))
    cv.vline(27, 83, 85, c("foliage", 4))
    cv.vline(29, 84, 85, c("red", 3))
    cv.put(27, 89, c("white", 6))
    cv.put(27, 90, c("yellow", 5))
    cv.vline(27, 91, 93, c("white", 5))
    cv.hline(24, 30, 94, c("cedar", 4))
    cv.hline(24, 30, 95, c("wood", 2))

    cv.vline(13, 80, 96, c("darkwood", 0))
    cv.vline(23, 80, 96, c("darkwood", 0))
    cv.hline(3, 32, 97, c("cedar", 5))
    cv.hline(3, 32, 98, c("darkwood", 1))

    # Timber & Batwing Harbor Tavern Doors (x=35..49, y=77..109)
    draw_timber_beam(cv, 34, 77, 50, 79, ramp="cedar")
    cv.put(33, 79, c("kuro", 1))
    cv.put(33, 80, c("steel", 4))
    cv.rect(32, 81, 34, 83, c("orange", 4))
    cv.put(33, 82, c("yellow", 5))
    cv.put(33, 84, c("steel", 2))

    for y in range(80, 85):
        for x in range(36, 49):
            if y == 80:
                col = c("rooftile", 2)
            elif y == 81 and x in (41, 42, 43):
                col = c("yellow", 5)
            elif y <= 83:
                col = c("orange", 4 if (40 <= x <= 44) else 3)
            else:
                col = c("rooftile", 3)
            cv.put(x, y, col)
    for y in range(102, 108):
        for x in range(36, 49):
            if y in (105, 106) and 39 <= x <= 45:
                col = c("cedar", 3 if y == 105 else 2)
            else:
                col = c("darkwood", 0 if y < 105 else 1)
            cv.put(x, y, col)

    for x in range(36, 49):
        if x == 42:
            for y in range(84, 102):
                cv.put(x, y, c("orange", 3) if y < 90 else c("ink", 0))
            continue
        is_left = x < 42
        dx_edge = (x - 36) if is_left else (48 - x)
        crest_map = [85, 84, 83, 83, 84, 85]
        bot_map = [101, 102, 102, 102, 101, 100]
        y_top_w = crest_map[dx_edge]
        y_bot_w = bot_map[dx_edge]
        for y in range(y_top_w, y_bot_w + 1):
            if y == y_top_w:
                col = c("cedar", 5)
            elif y == y_bot_w:
                col = c("darkwood", 0)
            elif dx_edge in (0, 5):
                col = c("wood", 4 if (is_left and dx_edge == 0) else 2)
            else:
                if 87 <= y <= 97:
                    col = c("cedar", 4) if (y % 2 == 0) else c("darkwood", 1)
                else:
                    col = c("wood", 3)
            cv.put(x, y, col)
    for hy in (87, 99):
        cv.put(36, hy, c("yellow", 4))
        cv.put(48, hy, c("yellow", 3))
    cv.put(41, 93, c("yellow", 5))
    cv.put(43, 93, c("yellow", 4))

    cv.rect(34, 108, 50, 110, c("stone", 4))
    cv.hline(34, 50, 108, c("stone", 6))
    cv.hline(34, 50, 110, c("stone", 2))
    cv.hline(34, 50, 111, c("ink", 0))

    # PROP 1 (Left harbourfront, x=2..23, y=95..111): STACKED HOOPED ALE KEGS!
    def draw_ale_keg(kx0: int, ky0: int) -> None:
        cv.shadow_rect(kx0 + 1, ky0 + 7, kx0 + 9, min(111, ky0 + 8), steps=2)
        for dy in range(8):
            y = ky0 + dy
            x_trim = 1 if dy in (0, 7) else 0
            for dx in range(x_trim, 10 - x_trim):
                x = kx0 + dx
                if dy == 0 or dy == 7:
                    col = c("darkwood", 0) if dy == 7 else c("cedar", 5)
                elif dx >= 7:
                    if dx in (7, 9) or dy in (1, 6):
                        col = c("wood", 2)
                    else:
                        col = c("cedar", 4 if dy < 4 else 3)
                elif dx in (2, 5):
                    col = c("steel", 5 if dy == 2 else (4 if dy < 4 else (2 if dy < 6 else 1)))
                else:
                    if dy == 1:
                        col = c("cedar", 5)
                    elif dy in (2, 3):
                        col = c("cedar", 4 if dy == 2 else 3)
                    elif dy in (4, 5):
                        col = c("wood", 3 if dy == 4 else 2)
                    else:
                        col = c("darkwood", 1)
                cv.put(x, y, col)
        cv.put(kx0 + 8, ky0 + 4, c("yellow", 4))
        cv.put(kx0 + 9, ky0 + 4, c("yellow", 5))
        cv.put(kx0 + 4, ky0 + 1, c("red", 3))

    cv.rect(3, 110, 22, 110, c("darkwood", 0))
    draw_ale_keg(2, 103)
    draw_ale_keg(13, 103)
    draw_ale_keg(7, 96)

    # PROP 2 (Center-left, x=24..33, y=104..111): COILED HEMP MOORING ROPE!
    cv.shadow_rect(25, 109, 32, 111, steps=2)
    for y in range(104, 111):
        for x in range(24, 33):
            dx = x - 28.0
            dy = (y - 107.2) * 1.35
            dist = (dx * dx + dy * dy) ** 0.5
            if dist <= 4.3:
                ring = int(dist * 1.7)
                if y >= 110:
                    col = c("darkwood", 0)
                elif dist < 1.2:
                    col = c("darkwood", 1)
                elif ring % 2 == 0:
                    col = c("straw", 5 if y < 107 else (4 if y < 109 else 2))
                else:
                    col = c("cream", 4) if y == 105 else c("straw", 3 if y < 108 else 1)
                cv.put(x, y, col)
    cv.put(32, 109, c("straw", 4))
    cv.put(33, 110, c("straw", 3))

    # PROP 3 (Right, x=51..62, y=95..111): A-FRAME WOODEN MENU CHALKBOARD + RUM DEMIJOHN!
    cv.shadow_rect(52, 109, 61, 111, steps=2)
    cv.vline(59, 98, 110, c("darkwood", 1))
    cv.put(60, 109, c("darkwood", 0))
    cv.put(60, 110, c("darkwood", 0))
    cv.rect(51, 95, 58, 108, c("cedar", 4))
    cv.vline(51, 95, 110, c("cedar", 5))
    cv.vline(58, 95, 110, c("wood", 2))
    cv.hline(51, 58, 95, c("cream", 4))
    cv.rect(52, 96, 57, 106, c("kuro", 0))
    cv.rect(52, 96, 56, 105, c("kuro", 1))
    cv.hline(53, 55, 97, c("white", 6))
    cv.rect(53, 98, 55, 100, c("yellow", 4))
    cv.put(56, 99, c("yellow", 3))
    cv.hline(53, 56, 102, c("cream", 5))
    cv.hline(53, 55, 104, c("white", 4))
    cv.put(56, 104, c("orange", 4))
    # Green glass rum demijohn in wicker basket
    cv.put(61, 103, c("straw", 4))
    cv.put(61, 104, c("teal", 4))
    cv.rect(60, 105, 62, 107, c("teal", 3))
    cv.put(60, 105, c("teal", 5))
    cv.rect(60, 108, 62, 110, c("straw", 3))
    cv.hline(60, 62, 110, c("straw", 1))

    return cv.img


# ==============================================================================
# BUILDING 2: ft-warehouse.png (64x112) — Beodeul Maritime Trade Guild & Warehouse
# ==============================================================================
def build_ft_warehouse(ramps) -> Image.Image:
    cv = PixelCanvas(64, 112, ramps)
    c = cv.c

    # ------------------------------------------------------------------
    # 1. ROOF (y=0..42): Steep ㅅ-gable weathered slate kawara roof + wooden cargo hoist
    #    beam & iron pulley hook jutting from the gable peak!
    # ------------------------------------------------------------------
    # Fill brick-and-timber gable tympanum inside the ㅅ rafters (y=11..38)
    fill_harbor_brick(cv, 0, 11, 63, 39, seed=601, weathered=True)

    # Render steep ㅅ-gable weathered slate kawara roof wings + horizontal rear mansard ridge
    for x in range(64):
        d = (31 - x) if x <= 31 else (x - 32)
        y_out = 2 + d
        y_in = 12 + d
        # Subtle horizontal rear slate roof plane visible behind lower gable slopes (y=24..y_out)
        y_rear = 24 if (2 <= x <= 61 and y_out > 24) else y_out
        if x in (0, 1, 62, 63) and y_out > 26:
            y_rear = 26
        is_left = x <= 31

        for y in range(0, min(y_out, y_rear)):
            cv.put(x, y, None)

        if y_rear < y_out:
            for y in range(y_rear, y_out):
                ry_s = y - y_rear
                if ry_s == 0:
                    col = c("ink", 0)
                elif ry_s == 1:
                    col = c("kawara", 5 if is_left else 4)
                elif ry_s % 3 == 0:
                    col = c("kawara", 1 if is_left else 0)
                else:
                    sh_v = h2(x // 3, y // 3, 619)
                    if sh_v > 230:
                        col = c("moss", 2)
                    else:
                        col = c("kawara", (4 if sh_v > 90 else 3) if is_left else (3 if sh_v > 120 else 2))
                cv.put(x, y, col)
            # Shadow just above diagonal gable verge onto rear slate roof
            if y_out - 1 > y_rear:
                cv.put(x, y_out - 1, c("ink", 0))

        y_band_end = min(38, y_in)
        for y in range(y_out, y_band_end + 1):
            dr = y - y_out
            th = h2(x // 3, y // 2, 613)
            if dr == 0:
                col = c("ink", 0)
            elif dr == 1:
                col = c("kawara", 6 if is_left else 4)
            elif dr == y_band_end - y_out and y_in <= 38:
                col = c("darkwood", 0)
            elif dr == y_band_end - y_out - 1 and y_in <= 38:
                col = c("wood", 4 if is_left else 2)
            elif dr == y_band_end - y_out - 2 and y_in <= 38:
                col = c("cedar", 4 if is_left else 2)
            else:
                course_line = ((x + y) % 4 == 0)
                if course_line:
                    col = c("kawara", 1 if is_left else 0)
                elif th > 235:
                    col = c("moss", 3 if is_left else 2)
                elif th < 65:
                    col = c("kawara", 6 if is_left else 4)
                else:
                    col = c("kawara", (5 if dr < 5 else 4) if is_left else (3 if dr < 5 else 2))
            cv.put(x, y, col)

        if y_in + 1 <= 38:
            cv.shadow_pixel(x, y_in + 1, steps=2)
        if y_in + 2 <= 38:
            cv.shadow_pixel(x, y_in + 2, steps=1)

    for x in list(range(0, 8)) + list(range(56, 64)):
        cv.put(x, 38, c("kawara", 2))

    # Gable Peak Stone/Slate Finial Cap (x=29..34, y=0..3)
    cv.hline(30, 33, 0, c("ink", 0))
    cv.hline(30, 33, 1, c("kawara", 7))
    cv.hline(29, 34, 2, c("kawara", 5))
    cv.put(29, 1, c("ink", 0))
    cv.put(34, 1, c("ink", 0))
    cv.hline(30, 33, 3, c("kawara", 3))

    # Heavy Timber Framing inside Gable Tympanum
    draw_timber_beam(cv, 15, 25, 48, 27, ramp="darkwood")
    draw_timber_post(cv, 30, 12, 33, 38, ramp="darkwood", bolts=False)
    for i in range(8):
        cv.put(21 + i, 37 - i, c("darkwood", 2))
        cv.put(22 + i, 37 - i, c("darkwood", 1))
        cv.put(42 - i, 37 - i, c("darkwood", 2))
        cv.put(41 - i, 37 - i, c("darkwood", 1))

    # Two arched louver vents flanking the king-post in the gable
    for vx0 in (21, 37):
        cv.rect(vx0, 29, vx0 + 5, 36, c("stone", 3))
        cv.rect(vx0 + 1, 30, vx0 + 4, 35, c("kuro", 0))
        for vy in (31, 33, 35):
            cv.hline(vx0 + 1, vx0 + 4, vy, c("wood", 3))

    # Horizontal Stone-and-Timber Gable Cornice / Eave Stringcourse (y=39..42)
    for x in range(64):
        cv.put(x, 39, c("stone", 6 if (x % 8 != 7) else 3))
        cv.put(x, 40, c("stone", 4 if (x % 8 != 7) else 2))
        cv.put(x, 41, c("wood", 3 if (x % 4 != 0) else 2))
        cv.put(x, 42, c("ink", 0))

    # ------------------------------------------------------------------
    # 2. 2F FACADE (y=42..74): Warm weathered brick & heavy timber-beam facade,
    #    double 2F cargo loading-loft doors w/ iron hinges, hoist rope + hook,
    #    and painted golden balance-scales & ship-wheel trade guild sign!
    # ------------------------------------------------------------------
    fill_harbor_brick(cv, 0, 43, 63, 70, seed=709, weathered=True)

    # Dressed stone corner quoins on left & right piers (x=0..3 and x=60..63)
    for y in range(43, 71):
        q_block = ((y - 43) // 4) % 2
        w_q = 4 if q_block == 0 else 3
        for x in range(w_q):
            is_edge = (y - 43) % 4 == 3 or x == w_q - 1
            cv.put(x, y, c("stone", 2 if is_edge else (5 if (y - 43) % 4 == 0 else 4)))
        for x in range(64 - w_q, 64):
            is_edge = (y - 43) % 4 == 3 or x == 64 - w_q
            cv.put(x, y, c("stone", 1 if is_edge else (4 if (y - 43) % 4 == 0 else 3)))

    draw_timber_post(cv, 20, 43, 22, 70, ramp="darkwood", bolts=True)
    draw_timber_post(cv, 41, 43, 43, 70, ramp="darkwood", bolts=True)

    cv.shadow_rect(0, 43, 63, 44, steps=2)
    cv.shadow_rect(0, 45, 63, 45, steps=1)

    # DOUBLE WOODEN 2F CARGO LOADING-LOFT DOORS (x=23..40, y=45..70)
    for x in range(22, 42):
        cv.put(x, 44, c("stone", 5 if x % 3 != 0 else 3))
        cv.put(x, 45, c("ink", 0))

    cv.rect(29, 46, 34, 70, c("ink", 0))
    cv.rect(30, 47, 33, 69, c("darkwood", 0))
    # Shaded burlap grain sack & wooden crate deep inside 2F loft threshold
    cv.rect(29, 64, 31, 69, c("straw", 2))
    cv.vline(30, 64, 68, c("straw", 3))
    cv.put(30, 63, c("straw", 4))
    cv.put(30, 64, c("red", 3))
    cv.rect(32, 65, 34, 69, c("wood", 2))
    cv.hline(32, 34, 65, c("cedar", 4))
    cv.put(33, 67, c("cedar", 3))

    for lx0, is_left in ((23, True), (35, False)):
        for y in range(46, 70):
            for dx in range(6):
                x = lx0 + dx
                if y == 46:
                    col = c("cedar", 5 if is_left else 4)
                elif y == 69:
                    col = c("darkwood", 0)
                elif (is_left and dx == 5) or (not is_left and dx == 0):
                    col = c("cedar", 5) if is_left else c("wood", 2)
                elif dx in (0, 5):
                    col = c("wood", 2)
                else:
                    col = c("cedar", 4 if dx % 2 == 1 else 3) if is_left else c("wood", 4 if dx % 2 == 1 else 3)
                cv.put(x, y, col)

        for hy in (50, 64):
            h_xs = range(lx0, lx0 + 5) if is_left else range(lx0 + 1, lx0 + 6)
            for hx in h_xs:
                cv.put(hx, hy, c("kuro", 1))
                cv.put(hx, hy + 1, c("ink", 0))
            for rx in (lx0 + 1, lx0 + 3) if is_left else (lx0 + 2, lx0 + 4):
                cv.put(rx, hy, c("steel", 5))
            knuckle_x = lx0 if is_left else lx0 + 5
            cv.vline(knuckle_x, hy - 1, hy + 1, c("steel", 3))

    draw_timber_beam(cv, 0, 71, 63, 74, ramp="darkwood")
    draw_timber_beam(cv, 19, 70, 44, 73, ramp="cedar")
    for sx in (20, 26, 37, 43):
        cv.vline(sx, 70, 73, c("steel", 3))

    # STURDY WOODEN CARGO HOIST BEAM, IRON PULLEY WHEEL & ROPE + HOOK (y=9..58)!
    cv.shadow_rect(34, 13, 37, 22, steps=2)
    for ry_s in range(24, 45):
        cv.shadow_pixel(34, ry_s, steps=2)

    cv.line(28, 9, 30, 13, c("steel", 4))
    cv.line(35, 9, 33, 13, c("steel", 3))

    cv.rect(29, 11, 34, 13, c("cedar", 5))
    cv.hline(30, 33, 11, c("cream", 4))
    cv.rect(29, 14, 34, 18, c("ink", 0))
    cv.rect(30, 14, 33, 17, c("wood", 4))
    cv.put(31, 15, c("cedar", 5))
    cv.put(32, 16, c("wood", 2))
    cv.hline(29, 34, 14, c("steel", 4))
    cv.vline(29, 14, 17, c("steel", 3))
    cv.vline(34, 14, 17, c("kuro", 2))

    # Forged Iron Pulley Block & Sheave Wheel
    cv.put(32, 18, c("steel", 5))
    cv.rect(30, 19, 34, 24, c("kuro", 1))
    cv.hline(31, 33, 19, c("steel", 5))
    cv.vline(30, 20, 23, c("steel", 4))
    cv.vline(34, 20, 23, c("kuro", 2))
    cv.rect(31, 20, 33, 23, c("steel", 3))
    cv.put(32, 21, c("yellow", 4))
    cv.put(32, 22, c("kuro", 0))

    # Hemp Hoist Rope dropping down to 2F cargo loft doors
    for y in range(24, 53):
        cv.put(31, y, c("straw", 5 if y % 2 == 0 else 4))
        cv.put(32, y, c("straw", 3 if y % 2 == 0 else 2))

    # Gleaming Forged Iron Cargo Hook in front of dark 2F loft opening (x=30..34, y=52..58)
    cv.put(31, 52, c("yellow", 4))
    cv.put(32, 52, c("orange", 3))
    cv.put(31, 53, c("white", 6))
    cv.put(32, 53, c("steel", 4))
    cv.put(31, 54, c("steel", 6))
    cv.put(30, 55, c("steel", 6))
    cv.put(30, 56, c("steel", 5))
    cv.put(31, 57, c("steel", 5))
    cv.put(32, 57, c("steel", 6))
    cv.put(33, 57, c("steel", 4))
    cv.put(34, 56, c("white", 6))
    cv.put(34, 55, c("steel", 5))

    # MARITIME TRADE GUILD SIGN (Left 2F bay, x=4..18, y=46..68):
    # Brass Balance-Scales & Ship-Wheel Trade Crest!
    cv.shadow_rect(5, 48, 19, 69, steps=2)
    cv.rect(4, 46, 18, 68, c("ink", 0))
    cv.rect(5, 47, 17, 67, c("wood", 4))
    cv.hline(5, 17, 47, c("cedar", 5))
    cv.vline(5, 47, 67, c("cedar", 4))
    cv.hline(5, 17, 67, c("darkwood", 1))
    cv.vline(17, 47, 67, c("darkwood", 1))
    for y in range(48, 67):
        for x in range(6, 17):
            cv.put(x, y, c("navy", 1 if y < 58 else 0) if (x + y) % 5 != 0 else c("teal", 0))
    for rx, ry in ((5, 47), (17, 47), (5, 67), (17, 67)):
        cv.put(rx, ry, c("yellow", 4))

    # Upper Crest (x=7..15, y=49..56): 8-SPOKE SHIP'S HELM WHEEL!
    wheel_ring = [
        (10, 50), (11, 50), (12, 50),
        (9, 51), (13, 51),
        (8, 52), (8, 53), (8, 54),
        (14, 52), (14, 53), (14, 54),
        (9, 55), (13, 55),
        (10, 56), (11, 56), (12, 56),
    ]
    for wx, wy in wheel_ring:
        cv.put(wx, wy, c("cedar", 5 if wy <= 53 else 4))
    for hx, hy in ((11, 49), (7, 53), (15, 53), (8, 50), (14, 50), (8, 56), (14, 56)):
        cv.put(hx, hy, c("yellow", 4))
    for sx, sy in ((11, 51), (11, 52), (9, 53), (10, 53), (12, 53), (13, 53)):
        cv.put(sx, sy, c("cedar", 4))
    cv.put(11, 53, c("white", 6))  # bright brass wheel hub glint!

    # Forefront Crest (x=6..16, y=55..65): GOLDEN BRASS BALANCE-SCALES!
    cv.vline(11, 55, 65, c("yellow", 4))
    cv.put(11, 57, c("white", 6))          # balance beam pivot jewel/brass glint
    cv.hline(9, 13, 65, c("yellow", 4))
    cv.put(11, 65, c("yellow", 5))
    cv.hline(6, 16, 58, c("yellow", 5))
    cv.put(6, 57, c("yellow", 4))
    cv.put(16, 57, c("yellow", 4))
    # Left & Right suspension chains + golden weighing pans
    cv.put(6, 60, c("orange", 3))
    cv.put(8, 60, c("orange", 3))
    cv.put(7, 59, c("yellow", 3))
    cv.hline(6, 8, 62, c("yellow", 5))
    cv.hline(6, 8, 63, c("orange", 4))
    cv.put(14, 60, c("orange", 3))
    cv.put(16, 60, c("orange", 3))
    cv.put(15, 59, c("yellow", 3))
    cv.hline(14, 16, 62, c("yellow", 5))
    cv.hline(14, 16, 63, c("orange", 4))

    # RIGHT 2F GUILD LEDGER WINDOW (x=46..57, y=48..65)
    cv.hline(45, 58, 47, c("stone", 5))
    cv.hline(45, 58, 48, c("stone", 3))
    cv.rect(46, 49, 57, 64, c("darkwood", 0))
    cv.rect(47, 50, 56, 63, c("wood", 3))
    for y in range(51, 63):
        for x in range(48, 56):
            if y < 56:
                col = c("glass", 4 if (x + y) == 101 else (3 if y < 54 else 2))
            else:
                col = c("yellow", 4 if y < 60 else 3) if x < 52 else c("orange", 3)
            cv.put(x, y, col)
    cv.rect(52, 60, 55, 62, c("cream", 5))
    cv.put(53, 59, c("white", 6))
    cv.vline(51, 50, 63, c("darkwood", 0))
    cv.hline(47, 56, 56, c("darkwood", 0))
    cv.hline(45, 58, 65, c("stone", 5))
    cv.hline(45, 58, 66, c("stone", 2))
    cv.shadow_rect(46, 67, 58, 67, steps=2)

    # ------------------------------------------------------------------
    # 3. 1F HARBOURFRONT (y=74..112): Wide arched stone-and-timber cargo bay w/ Beodeul
    #    shipping crates, burlap grain sacks, tarred barrels; leaning iron ship's anchor;
    #    and clerk's counting window!
    # ------------------------------------------------------------------
    fill_harbor_brick(cv, 0, 75, 63, 106, seed=811, weathered=True)
    draw_stone_quay_base(cv, y0=106, y1=111, seed=823)

    for px0, px1 in ((0, 4), (41, 45), (59, 63)):
        for y in range(75, 107):
            ry = (y - 75) % 4
            for x in range(px0, px1 + 1):
                if ry == 3:
                    col = c("stone", 1)
                elif x == px0:
                    col = c("stone", 5 if ry == 0 else 4)
                elif x == px1:
                    col = c("stone", 2)
                else:
                    col = c("stone", 4 if ry == 0 else 3)
                cv.put(x, y, col)

    cv.shadow_rect(0, 75, 63, 76, steps=2)

    # WIDE ARCHED STONE-AND-TIMBER CARGO BAY (x=4..41, y=76..109)
    for y in range(79, 110):
        for x in range(6, 40):
            dx = (x - 22.5) / 17.5
            arch_top = 80 + int(round(4.5 * dx * dx))
            if y >= arch_top:
                if y >= 106:
                    col = c("stone", 1 if (x + y) % 3 != 0 else 0)
                elif y < 86 and 18 <= x <= 27:
                    col = c("darkwood", 2)
                else:
                    col = c("ink", 0) if y < 90 else c("darkwood", 0 if (x % 6 != 0) else 1)
                cv.put(x, y, col)

    for x in range(4, 42):
        dx = (x - 22.5) / 18.5
        y_arch_in = 80 + int(round(5.0 * dx * dx))
        y_arch_out = y_arch_in - 4
        for y in range(max(75, y_arch_out), y_arch_in + 1):
            if y == y_arch_in:
                col = c("wood", 3)
            elif 21 <= x <= 24:
                col = c("stone", 6 if y <= y_arch_out + 1 else 4)
            else:
                voussoir = (x // 3) % 2
                if x % 3 == 0:
                    col = c("stone", 2)
                else:
                    col = c("stone", 5 if voussoir == 0 else 4)
            cv.put(x, y, col)
    draw_timber_post(cv, 5, 85, 6, 108, ramp="wood", bolts=False)
    draw_timber_post(cv, 39, 85, 40, 108, ramp="darkwood", bolts=False)

    # Hanging Brass Cargo Bay Lantern
    cv.put(23, 80, c("kuro", 2))
    cv.put(23, 81, c("steel", 4))
    cv.rect(22, 82, 24, 84, c("orange", 4))
    cv.put(23, 83, c("yellow", 5))
    cv.put(23, 82, c("white", 6))
    cv.put(23, 85, c("steel", 3))

    # CARGO 1 (x=7..23, y=88..109): STACKED BEODEUL WOODEN SHIPPING CRATES!
    draw_crate_34(cv, 15, 98, 9, 11, top_h=3, stencil=True)
    draw_crate_34(cv, 7, 98, 10, 12, top_h=3, stencil=True)
    draw_crate_34(cv, 9, 88, 11, 11, top_h=3, stencil=True)
    cv.shadow_rect(8, 109, 23, 110, steps=2)

    # CARGO 2 (x=30..39, y=91..109): TARRED HARBOUR BARRELS!
    def draw_tarred_barrel(bx0: int, by0: int, bw: int, bh: int) -> None:
        for dy in range(bh):
            y = by0 + dy
            trim = 1 if dy in (0, bh - 1) else 0
            for dx in range(trim, bw - trim):
                x = bx0 + dx
                if dy == 0:
                    col = c("wood", 3 if 1 < dx < bw - 2 else 2)
                elif dy == 1:
                    col = c("darkwood", 4 if dx < bw // 2 else 2)
                elif dy in (3, bh - 3):
                    col = c("steel", 5 if dx == 1 else (4 if dx < bw // 2 + 1 else 2))
                elif dy == bh - 1:
                    col = c("ink", 0)
                else:
                    if dx == 1:
                        col = c("darkwood", 4)
                    elif dx < bw // 2:
                        col = c("darkwood", 3)
                    elif dx < bw - 2:
                        col = c("darkwood", 2)
                    else:
                        col = c("kuro", 0)
                cv.put(x, y, col)

    draw_tarred_barrel(30, 91, 7, 12)
    draw_tarred_barrel(32, 97, 8, 12)

    # CARGO 3 (x=21..33, y=95..110): PLUMP TIED BURLAP GRAIN SACKS!
    def draw_grain_sack(sx0: int, sy0: int, sw: int, sh: int) -> None:
        mid = sx0 + sw // 2
        cv.put(mid - 1, sy0, c("straw", 5))
        cv.put(mid + 1, sy0, c("straw", 4))
        cv.put(mid, sy0 + 1, c("straw", 4))
        cv.hline(mid - 1, mid + 1, sy0 + 2, c("red", 3))
        for dy in range(3, sh):
            y = sy0 + dy
            w_row = sw - (2 if dy in (3, sh - 1) else 0)
            rx0 = sx0 + (1 if dy in (3, sh - 1) else 0)
            for dx in range(w_row):
                x = rx0 + dx
                if dy == sh - 1:
                    col = c("darkwood", 0)
                elif dx == 0:
                    col = c("straw", 4 if dy < sh - 3 else 3)
                elif dx == 1 and dy < sh - 3:
                    col = c("cream", 4 if dy < 6 else 3)
                elif dx == w_row - 1:
                    col = c("straw", 1)
                else:
                    col = c("straw", 3 if (x + y) % 3 != 0 else 2)
                cv.put(x, y, col)
        if sw >= 7 and sh >= 9:
            cv.rect(sx0 + 2, sy0 + 6, sx0 + 3, sy0 + 7, c("cedar", 4))

    draw_grain_sack(25, 95, 7, 13)
    draw_grain_sack(21, 98, 7, 12)
    draw_grain_sack(27, 99, 7, 11)

    # CLERK'S COUNTING WINDOW (Right pier bay, x=46..59, y=78..98)
    cv.hline(46, 59, 78, c("stone", 5))
    cv.hline(46, 59, 79, c("stone", 3))
    cv.rect(47, 80, 58, 95, c("darkwood", 0))
    cv.rect(48, 81, 57, 94, c("wood", 2))
    for y in range(82, 94):
        for x in range(49, 57):
            if y < 86:
                col = c("orange", 3 if y == 82 else 4)
            else:
                col = c("yellow", 5 if (51 <= x <= 54 and y < 90) else 4)
            cv.put(x, y, col)
    cv.rect(52, 87, 53, 89, c("darkwood", 1))
    cv.rect(51, 90, 54, 93, c("darkwood", 0))
    cv.vline(51, 81, 94, c("kuro", 1))
    cv.vline(54, 81, 94, c("kuro", 1))
    cv.hline(48, 57, 86, c("kuro", 1))

    # Projecting Clerk's Counting Counter Shelf + Open Manifest Ledger & Blue Quill!
    cv.hline(45, 60, 96, c("cedar", 5))
    cv.hline(45, 60, 97, c("wood", 3))
    cv.hline(45, 60, 98, c("darkwood", 0))
    cv.shadow_rect(46, 99, 60, 99, steps=2)
    cv.rect(52, 94, 56, 95, c("white", 6))
    cv.vline(54, 94, 95, c("cream", 3))
    cv.put(58, 95, c("kuro", 2))
    cv.put(58, 94, c("blue", 4))
    cv.put(59, 93, c("blue", 5))
    cv.put(59, 92, c("blue", 5))

    # FORGED IRON SHIP'S ANCHOR LEANING AGAINST THE BRICK PIER (x=40..51, y=93..111)!
    cv.shadow_rect(43, 96, 51, 110, steps=2)
    cv.hline(45, 46, 93, c("white", 5))
    cv.put(44, 94, c("steel", 5))
    cv.put(47, 94, c("steel", 3))
    cv.put(44, 95, c("steel", 4))
    cv.put(47, 95, c("kuro", 2))
    cv.hline(45, 46, 96, c("steel", 5))
    cv.hline(41, 50, 97, c("cedar", 5))
    cv.hline(41, 50, 98, c("wood", 3))
    for sx in (42, 45, 46, 49):
        cv.put(sx, 97, c("steel", 5))
        cv.put(sx, 98, c("steel", 3))
    for y in range(96, 110):
        cv.put(45, y, c("steel", 5 if y < 104 else 4))
        cv.put(46, y, c("steel", 3 if y < 105 else 2))
        cv.put(47, y, c("ink", 0))
    cv.put(45, 100, c("white", 5))
    cv.put(45, 101, c("steel", 6))

    fluke_pixels = [
        (40, 105, "white", 5), (41, 105, "steel", 5),
        (40, 106, "steel", 6), (41, 106, "steel", 5), (42, 106, "steel", 3),
        (41, 107, "steel", 5), (42, 107, "steel", 4),
        (42, 108, "steel", 5), (43, 108, "steel", 4),
        (43, 109, "steel", 5), (44, 109, "steel", 4),
        (44, 110, "steel", 4), (45, 110, "steel", 5), (46, 110, "steel", 4), (47, 110, "steel", 3),
        (45, 111, "kuro", 1), (46, 111, "kuro", 0),
        (51, 105, "steel", 5), (50, 105, "steel", 4),
        (51, 106, "steel", 4), (50, 106, "steel", 5), (49, 106, "kuro", 2),
        (50, 107, "steel", 4), (49, 107, "steel", 3),
        (49, 108, "steel", 4), (48, 108, "steel", 3),
        (48, 109, "steel", 4), (47, 109, "steel", 3),
    ]
    for fx, fy, fr, fi in fluke_pixels:
        cv.put(fx, fy, c(fr, fi))

    # Coiled hemp anchor hawser & wooden bollard post on far right quay
    cv.rect(55, 102, 58, 110, c("darkwood", 2))
    cv.hline(55, 58, 102, c("cedar", 4))
    cv.vline(55, 102, 110, c("wood", 3))
    cv.vline(58, 102, 110, c("darkwood", 0))
    for ry in (105, 107):
        cv.hline(54, 59, ry, c("straw", 5 if ry == 105 else 4))
    cv.line(48, 95, 54, 105, c("straw", 4))
    cv.line(48, 96, 54, 106, c("straw", 2))

    return cv.img


# ==============================================================================
# STRICT VERIFICATION & 3X CHECKERBOARD PREVIEW SHEET
# ==============================================================================
def verify_building(
    name: str, img: Image.Image, expected_size: tuple[int, int], allowed_rgb: set[tuple[int, int, int]]
) -> dict:
    assert img.mode == "RGBA", f"{name}: mode must be RGBA, got {img.mode}"
    assert img.size == expected_size, f"{name}: size must be {expected_size}, got {img.size}"

    w, h = img.size
    px = img.load()
    off_palette = 0
    bad_alpha = 0
    pure_black = 0
    transparent_px = 0
    opaque_px = 0
    unique_colors: set[tuple[int, int, int]] = set()

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a not in (0, 255):
                bad_alpha += 1
            if a == 0:
                transparent_px += 1
            else:
                opaque_px += 1
                rgb = (r, g, b)
                unique_colors.add(rgb)
                if rgb == (0, 0, 0):
                    pure_black += 1
                if rgb not in allowed_rgb:
                    off_palette += 1

    assert off_palette == 0, f"{name}: {off_palette} off-palette pixels!"
    assert bad_alpha == 0, f"{name}: {bad_alpha} non-binary alpha pixels!"
    assert pure_black == 0, f"{name}: {pure_black} pure #000000 pixels!"
    assert 60 <= len(unique_colors) <= 95, (
        f"{name}: unique color count {len(unique_colors)} outside target Fable range 60..95!"
    )

    return {
        "name": name,
        "size": f"{w}x{h}",
        "unique_colors": len(unique_colors),
        "opaque_px": opaque_px,
        "transparent_px": transparent_px,
        "off_palette": off_palette,
        "bad_alpha": bad_alpha,
        "pure_black": pure_black,
        "status": "PASS",
    }


def make_preview_sheet(tavern: Image.Image, warehouse: Image.Image) -> Image.Image:
    """Renders 3x crisp nearest-neighbor preview + 1x native street pair on #23262e checkerboard."""
    scale = 3
    w3, h3 = 64 * scale, 112 * scale  # 192 x 336
    pad = 24
    gap = 28
    top_bar = 34

    pair_1x_w = 64 * 2 + 12
    sheet_w = pad * 2 + w3 * 2 + gap * 2 + pair_1x_w
    sheet_h = top_bar + h3 + pad

    bg_dark = (0x23, 0x26, 0x2E, 255)
    bg_lite = (0x2B, 0x2F, 0x39, 255)
    sheet = Image.new("RGBA", (sheet_w, sheet_h), bg_dark)
    spx = sheet.load()
    cell = 12
    for y in range(top_bar - 6, sheet_h):
        for x in range(sheet_w):
            if ((x // cell) + (y // cell)) % 2 == 1:
                spx[x, y] = bg_lite

    draw = ImageDraw.Draw(sheet)
    draw.rectangle([0, 0, sheet_w, top_bar - 6], fill=(0x1B, 0x1E, 0x25, 255))
    draw.text((pad, 9), "ft-tavern 64x112 (3x)", fill=(235, 238, 245, 255))
    draw.text((pad + w3 + gap, 9), "ft-warehouse 64x112 (3x)", fill=(235, 238, 245, 255))

    x_native = pad + w3 * 2 + gap * 2
    draw.text((x_native, 9), "1x Harbour Row", fill=(190, 198, 214, 255))

    t3 = tavern.resize((w3, h3), Image.Resampling.NEAREST)
    wh3 = warehouse.resize((w3, h3), Image.Resampling.NEAREST)
    sheet.alpha_composite(t3, (pad, top_bar))
    sheet.alpha_composite(wh3, (pad + w3 + gap, top_bar))

    sheet.alpha_composite(tavern, (x_native, top_bar + 8))
    sheet.alpha_composite(warehouse, (x_native + 64, top_bar + 8))

    draw.text((x_native, top_bar + 136), "2x Signs & Hoist", fill=(190, 198, 214, 255))
    sign_t = tavern.crop((36, 44, 62, 72)).resize((52, 56), Image.Resampling.NEAREST)
    sign_w = warehouse.crop((2, 44, 42, 72)).resize((80, 56), Image.Resampling.NEAREST)
    sheet.alpha_composite(sign_t, (x_native, top_bar + 154))
    sheet.alpha_composite(sign_w, (x_native + 56, top_bar + 154))

    draw.text((x_native, top_bar + 224), "2x 1F Props", fill=(190, 198, 214, 255))
    prop_t = tavern.crop((0, 92, 34, 112)).resize((68, 40), Image.Resampling.NEAREST)
    prop_w = warehouse.crop((39, 90, 64, 112)).resize((50, 44), Image.Resampling.NEAREST)
    sheet.alpha_composite(prop_t, (x_native, top_bar + 242))
    sheet.alpha_composite(prop_w, (x_native + 74, top_bar + 242))

    return sheet.convert("RGB")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)

    ramps, allowed_rgb = load_palette()

    tavern = build_ft_tavern(ramps)
    warehouse = build_ft_warehouse(ramps)

    tavern_path = OUT_DIR / "ft-tavern.png"
    warehouse_path = OUT_DIR / "ft-warehouse.png"
    tavern.save(tavern_path)
    warehouse.save(warehouse_path)

    stats_tavern = verify_building("ft-tavern.png", tavern, (64, 112), allowed_rgb)
    stats_warehouse = verify_building("ft-warehouse.png", warehouse, (64, 112), allowed_rgb)

    preview = make_preview_sheet(tavern, warehouse)
    preview.save(PREVIEW_PATH)

    print("PASS: T4 Fantasy Town Batch 5/5 generated & verified!")
    print(json.dumps({"ft-tavern": stats_tavern, "ft-warehouse": stats_warehouse}, indent=2))


if __name__ == "__main__":
    main()
