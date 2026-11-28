#!/usr/bin/env python3
"""
T4 Fantasy Town Fable-Grade Buildings — Batch 3/5
Procedural hand-crafted pixel-art generator for:
  1. ft-magic.png      (64x112 RGBA, 4x7 tiles) — Arcane & Grimoire Emporium (마법·마도서 상점)
  2. ft-apothecary.png (48x112 RGBA, 3x7 tiles) — Herbalist & Potion Apothecary (포션·약초방)

Hard Rules:
  - 100% locked to tiledata/jp-city/fable-city/palette.json (0 off-palette, 0 #000000, binary alpha {0, 255})
  - Fable 5.2 pixel density (60-95 unique colors per building), staggered roofs, cast shadows, glowing storefronts
  - Top-3/4 RPG camera proportions: Roof (y=0..42), 2F facade (y=42..74), 1F shopfront (y=74..112)
  - Pictorial fantasy signboards (no text): golden crescent-moon & glowing star (ft-magic);
    round-bottom glowing emerald potion flask (ft-apothecary).
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
PALETTE_PATH = ROOT / "tiledata/jp-city/fable-city/palette.json"
OUT_DIR = ROOT / "tiledata/fantasy-town-carbon/buildings"
PREVIEW_PATH = ROOT / "tiledata/fantasy-town-carbon/preview_batch3.png"


def hex_to_rgba(hx: str) -> tuple[int, int, int, int]:
    hx = hx.lstrip("#")
    return (int(hx[0:2], 16), int(hx[2:4], 16), int(hx[4:6], 16), 255)


def load_palette() -> tuple[dict[str, list[tuple[int, int, int, int]]], set[tuple[int, int, int]]]:
    with open(PALETTE_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)["ramps"]
    ramps: dict[str, list[tuple[int, int, int, int]]] = {
        name: [hex_to_rgba(h) for h in hex_list] for name, hex_list in raw.items()
    }
    allowed_rgb: set[tuple[int, int, int]] = {
        (col[0], col[1], col[2]) for cols in ramps.values() for col in cols
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
            "navy", "tile", "midori", "stone", "concrete", "pavement", "cream",
            "kinari", "darkwood", "wood", "cedar", "floorwood", "foliage", "moss",
            "green", "teal", "glass", "blue", "red", "brick", "rooftile", "orange",
            "yellow", "straw", "pink", "white", "coolwhite", "kuro", "steel", "ink",
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


# ==============================================================================
# BUILDING 1: ft-magic.png (64x112) — Arcane & Grimoire Emporium (마법·마도서 상점)
# ==============================================================================
def build_ft_magic(ramps: dict[str, list[tuple[int, int, int, int]]]) -> Image.Image:
    cv = PixelCanvas(64, 112, ramps)
    c = cv.c

    # ------------------------------------------------------------------
    # 1. ROOF ZONE (y = 0..42)
    #    - Main 3/4 midnight-indigo scalloped slate roof (x=1..62, y=15..41)
    #    - Copper chimney with verdigris patina on left slope (x=5..12, y=4..24)
    #    - Steep whimsical central ㅅ-gable (x=9..54, apex y=9..40)
    #    - Gleaming brass celestial astrolabe finial (x=26..37, y=0..10)
    #    - Circular glowing stained-glass oculus window in gable (cx=31.5, cy=27)
    # ------------------------------------------------------------------

    # 1A. Main 3/4 Midnight-Indigo Slate Roof Wings (y=11..40, x=1..62)
    # Top ridge crest (y=11..13) aligned cleanly with the central ㅅ-gable apex!
    cv.hline(2, 61, 11, c("ink", 0))
    for x in range(2, 62):
        ridge_hi = c("tile", 5) if (x % 4 != 0) else c("tile", 6)
        cv.put(x, 12, ridge_hi)
        cv.put(x, 13, c("navy", 3) if (x % 2 == 0) else c("tile", 3))
    # Ridge end caps with brass finials (left x=1..2, right x=61..62)
    for ex in (1, 62):
        cv.vline(ex, 10, 13, c("ink", 0))
    cv.put(2, 10, c("yellow", 4))
    cv.put(2, 11, c("orange", 4))
    cv.put(61, 10, c("yellow", 4))
    cv.put(61, 11, c("orange", 3))

    # Staggered scalloped midnight-indigo slates (y=14..39)
    for y in range(14, 40):
        row = (y - 14) // 4
        dy = (y - 14) % 4
        offset = 3 if (row % 2 == 1) else 0
        base_lv = 3 if y < 22 else (2 if y < 31 else 1)
        for x in range(1, 63):
            if x in (1, 62):
                cv.put(x, y, c("ink", 0))
                continue
            tx = (x + offset) % 6
            tid = (x + offset) // 6
            hv = h2(tid, row, 17)
            use_tile = (hv % 3 == 0)
            rname = "tile" if use_tile else "navy"
            lv = base_lv + (1 if hv > 195 else (0 if hv > 60 else -1))
            if x > 46:
                lv -= 1

            if dy == 0:
                col = c("ink", 0) if (tx in (0, 5)) else c("navy", 0)
            elif dy == 1:
                if tx == 0:
                    col = c("navy", 0)
                elif tx in (1, 2):
                    col = c(rname, clamp(lv + 2, 1, 5))
                else:
                    col = c(rname, clamp(lv + 1, 1, 4))
            elif dy == 2:
                if tx == 0:
                    col = c("ink", 1)
                elif tx == 1:
                    col = c(rname, clamp(lv + 1, 1, 5))
                elif tx == 5:
                    col = c("navy", clamp(lv - 1, 0, 3))
                else:
                    col = c(rname, clamp(lv, 1, 4))
            else:
                if tx in (0, 5):
                    col = c("ink", 0)
                elif tx in (2, 3):
                    col = c("tile", clamp(lv + 2, 2, 5)) if (hv % 5 == 0) else c(rname, clamp(lv + 1, 1, 4))
                else:
                    col = c("navy", clamp(lv, 0, 3))
            cv.put(x, y, col)

    # Subtle moonlit starry glint specks on roof wings
    for gx, gy in [(4, 17), (14, 16), (7, 27), (55, 18), (59, 29)]:
        cv.put(gx, gy, c("tile", 5))

    # 1B. Hammered Copper Chimney with Verdigris Patina (x=4..11, y=2..22)
    cv.shadow_rect(12, 12, 14, 22, steps=2)
    cv.shadow_rect(6, 22, 12, 23, steps=2)
    cv.hline(5, 10, 2, c("ink", 0))
    cv.hline(4, 11, 3, c("ink", 0))
    cv.hline(5, 10, 3, c("orange", 5))
    cv.put(6, 3, c("yellow", 4))
    cv.hline(4, 11, 4, c("rooftile", 4))
    cv.put(4, 4, c("ink", 0))
    cv.put(11, 4, c("ink", 0))
    cv.hline(4, 11, 5, c("brick", 1))
    # Tiny arcane cyan/gold spark drifting above chimney
    cv.put(7, 0, c("teal", 4))
    cv.put(8, 1, c("glass", 5))
    # Copper shaft (x=5..10, y=6..21)
    for y in range(6, 22):
        for x in range(5, 11):
            if x == 5:
                col = c("ink", 0)
            elif x == 10:
                col = c("brick", 0)
            elif y == 12:
                col = c("yellow", 4) if x == 6 else (c("orange", 4) if x == 7 else c("rooftile", 3))
            elif y == 13:
                col = c("brick", 1)
            else:
                if x == 6:
                    col = c("orange", 4) if (y % 3 != 0) else c("yellow", 3)
                elif x == 7:
                    col = c("rooftile", 4) if ((x + y) % 2 == 0) else c("orange", 3)
                elif x == 8:
                    col = c("rooftile", 3)
                else:
                    col = c("brick", 2)
                if (x == 8 and y in (7, 8, 9, 15, 16)) or (x == 7 and y in (8, 16, 17)):
                    col = c("teal", 3) if y % 2 == 0 else c("midori", 4)
            cv.put(x, y, col)
    cv.hline(4, 11, 21, c("steel", 2))
    cv.put(5, 20, c("steel", 4))
    cv.put(6, 20, c("teal", 3))

    # 1C. Whimsical Steep Central ㅅ-Gable (x=9..54, apex at x=31..32, y=10)
    for x in range(8, 56):
        d = (31 - x) if x <= 31 else (x - 32)
        y_verge_top = 10 + d
        if x < 31:
            cv.shadow_pixel(x - 1, y_verge_top + 2, 2)
        else:
            cv.shadow_pixel(x + 1, y_verge_top + 2, 2)
            cv.shadow_pixel(x + 2, y_verge_top + 3, 2)

    for x in range(9, 55):
        d = (31 - x) if x <= 31 else (x - 32)
        y_top = 10 + d              # Crisp 45-degree 1:1 ㅅ-gable slope!
        y_barge = y_top + 5         # 5px thick overlapping indigo slate verge
        y_inner = y_barge + 3       # 3px carved darkwood + gold trim bargeboard

        for y in range(max(10, y_top), min(41, y_barge)):
            dy = y - y_top
            if dy == 0:
                col = c("ink", 0)
            elif dy == 1:
                col = c("tile", 5) if x <= 31 else c("tile", 4)
            elif dy == 2:
                col = c("navy", 4) if ((x + y) % 3 != 0) else c("tile", 3)
            elif dy == 3:
                col = c("navy", 2) if x <= 31 else c("navy", 1)
            else:
                col = c("ink", 0)
            cv.put(x, y, col)

        for y in range(y_barge, min(41, y_inner)):
            dy = y - y_barge
            if dy == 0:
                col = c("cedar", 4) if x <= 31 else c("wood", 4)
                if d % 4 == 2 and d > 1:
                    col = c("yellow", 4)
            elif dy == 1:
                col = c("darkwood", 3) if x <= 31 else c("darkwood", 2)
            else:
                col = c("darkwood", 0)
            cv.put(x, y, col)

        if y_inner <= 40:
            for y in range(y_inner, 41):
                dr = y - y_inner
                if dr == 0:
                    col = c("ink", 1)
                elif dr == 1:
                    col = c("pavement", 1)
                else:
                    brow = (y - 16) // 4
                    bx = (x + (3 if brow % 2 else 0)) % 7
                    if (y - 16) % 4 == 0 or bx == 0:
                        col = c("pavement", 1)
                    else:
                        hv = h2(x // 2, brow, 31)
                        col = c("stone", 3) if hv > 170 else (c("concrete", 2) if hv > 80 else c("pavement", 2))
                cv.put(x, y, col)

    # Vertical center king-post timber above & below oculus in gable
    for y in range(17, 41):
        cv.put(31, y, c("darkwood", 3))
        cv.put(32, y, c("darkwood", 1))
    # Horizontal collar tie beam at y=36..37 across gable
    cv.hline(16, 47, 36, c("darkwood", 3))
    cv.hline(15, 48, 37, c("darkwood", 1))
    for sx in (18, 24, 39, 45):
        cv.put(sx, 36, c("yellow", 4))

    # 1D. Circular Glowing Stained-Glass Oculus Window in Gable (cx=31.5, cy=28.0, r=6.8)
    cx_o, cy_o = 31.5, 28.0
    for y in range(21, 36):
        for x in range(24, 40):
            dx = x - cx_o
            dy = y - cy_o
            dist = math.hypot(dx, dy)
            if dist <= 7.1:
                if dist >= 5.9:
                    if dy < -1:
                        col = c("stone", 5) if dx < 0 else c("stone", 4)
                    elif dy > 3:
                        col = c("ink", 0)
                    else:
                        col = c("stone", 2) if dx > 0 else c("stone", 3)
                elif dist >= 4.8:
                    col = c("ink", 0) if dy < 0 else c("kuro", 2)
                elif dist <= 1.55:
                    col = c("white", 6) if dist < 0.9 else c("yellow", 5)
                else:
                    on_cross = (abs(dx) < 0.55) or (abs(dy) < 0.55)
                    if on_cross:
                        col = c("ink", 1)
                    else:
                        if dx < 0 and dy < 0:
                            col = c("glass", 6) if dist < 3.3 else c("teal", 4)
                        elif dx > 0 and dy < 0:
                            col = c("pink", 4) if dist < 3.3 else c("pink", 2)
                        elif dx < 0 and dy > 0:
                            col = c("yellow", 5) if dist < 3.2 else c("orange", 4)
                        else:
                            col = c("teal", 5) if dist < 3.3 else c("blue", 4)
                cv.put(x, y, col)

    # 1E. Gleaming Brass Celestial Astrolabe Finial (x=26..37, y=0..11)
    # Welded brass apex saddle clamping the ㅅ-gable peak (x=29..34, y=9..11)
    cv.rect(29, 9, 34, 11, c("ink", 0))
    cv.rect(30, 9, 33, 10, c("orange", 4))
    cv.put(30, 9, c("yellow", 5))
    cv.put(31, 10, c("yellow", 4))
    # Outer brass astrolabe ring (centered at 31.5, 5.0, r=4.2) with crisp dark ink outline
    for y in range(0, 10):
        for x in range(26, 38):
            dx = x - 31.5
            dy = y - 5.0
            dist = math.hypot(dx, dy)
            if 4.35 < dist <= 5.15:
                cv.put(x, y, c("ink", 0))
            elif 3.15 <= dist <= 4.35:
                col = c("yellow", 5) if (dx + dy < -1.0) else (c("yellow", 4) if dy < 1.2 else c("orange", 3))
                cv.put(x, y, col)
    # Cardinal needle tips & inner diagonal ecliptic ring + glowing astral core
    cv.put(31, 0, c("yellow", 5))
    cv.put(32, 0, c("orange", 4))
    cv.put(26, 5, c("yellow", 5))
    cv.put(37, 5, c("orange", 3))
    for step in range(-2, 3):
        cv.put(31 + step, 5 - step // 2, c("yellow", 3))
        cv.put(32 - step, 5 - step // 2, c("straw", 4))
    cv.rect(31, 4, 32, 5, c("glass", 6))
    cv.put(31, 4, c("white", 6))
    cv.put(30, 5, c("teal", 5))
    cv.put(33, 4, c("teal", 4))

    # 1F. Moulded Roof Eave Cornice (y=40..42)
    cv.hline(0, 63, 40, c("darkwood", 4))
    for x in range(1, 63, 4):
        cv.put(x, 40, c("yellow", 3))  # Subtle brass frieze nails
    cv.hline(0, 63, 41, c("darkwood", 1))
    cv.hline(1, 62, 42, c("ink", 0))

    # ------------------------------------------------------------------
    # 2. SECOND FLOOR FACADE (y = 42..74)
    #    - Carved plum-grey stone & dark-wood medieval facade
    #    - Twin pointed Gothic arched windows glowing mystic teal & warm amber
    #    - Wrought-iron bracket & hanging Golden Crescent Moon & Glowing Star sign
    # ------------------------------------------------------------------

    # 2A. Plum-Grey Carved Ashlar Stone Wall (x=1..62, y=43..70)
    for y in range(43, 71):
        brow = (y - 43) // 5
        by = (y - 43) % 5
        boff = 4 if (brow % 2 == 1) else 0
        for x in range(1, 63):
            if x in (1, 62):
                cv.put(x, y, c("ink", 0))
                continue
            bx = (x + boff) % 8
            bid = (x + boff) // 8
            hv = h2(bid, brow, 73)
            if by == 0:
                col = c("pavement", 1)
            elif bx == 0:
                col = c("pavement", 1)
            elif by == 1:
                col = c("stone", 4) if hv > 160 else c("concrete", 3)
            else:
                if hv > 190:
                    col = c("stone", 3)
                elif hv > 110:
                    col = c("concrete", 2)
                elif hv > 45:
                    col = c("pavement", 2)
                else:
                    col = c("cream", 0)  # Plum-grey #5e4f5c subtle stone block!
            cv.put(x, y, col)

    # Heavy Dark-Wood Structural Posts & Diagonal Gothic Braces
    for px0 in (2, 21, 40, 59):
        w_post = 3 if px0 in (2, 59) else 2
        for dx in range(w_post):
            col = c("darkwood", 4) if dx == 0 else (c("darkwood", 2) if dx == 1 else c("darkwood", 0))
            cv.vline(px0 + dx, 43, 70, col)
        # Carved wood corbel capital at top of post
        cv.hline(px0, px0 + w_post - 1, 43, c("darkwood", 1))
        cv.put(px0, 45, c("yellow", 3))

    # Top eave shadow across entire 2F top (y=43..45)
    cv.shadow_rect(2, 43, 61, 44, steps=2)
    cv.shadow_rect(2, 45, 61, 45, steps=1)

    # 2B. Twin Pointed Gothic Arched Windows (Bay 1: x=6..18, Bay 2: x=24..36, y=46..67)
    def draw_gothic_window(wx0: int, wy0: int, teal_dominant: bool) -> None:
        # wx0..wx0+12 (width 13, center cx = wx0+6), wy0..wy0+21 (y=46..67)
        cxw = wx0 + 6
        # Cast shadow to right & under sill
        cv.shadow_rect(wx0 + 13, wy0 + 4, wx0 + 14, wy0 + 21, steps=2)
        cv.shadow_rect(wx0 + 1, wy0 + 22, wx0 + 13, wy0 + 23, steps=2)

        for y in range(wy0, wy0 + 21):
            dy = y - wy0
            # Pointed gothic arch half-width profile
            if dy == 0:
                hw = 1
            elif dy == 1:
                hw = 2
            elif dy == 2:
                hw = 4
            elif dy in (3, 4):
                hw = 5
            else:
                hw = 6

            for x in range(cxw - hw, cxw + hw + 1):
                dx = x - cxw
                on_outer_stone = (abs(dx) == hw) or (dy == 0) or (dy == 1 and abs(dx) >= 1) or (dy == 2 and abs(dx) >= 3)
                if on_outer_stone:
                    # Carved pale-stone gothic architrave hood-mould
                    col = c("stone", 5) if dx <= 0 else c("stone", 3)
                    if dy == 0:
                        col = c("stone", 6)
                    cv.put(x, y, col)
                elif abs(dx) == hw - 1 or (dy == 2 and abs(dx) == 2) or (dy == 3 and abs(dx) == 4):
                    # Dark iron/wood window frame
                    cv.put(x, y, c("ink", 0))
                else:
                    # Glowing Gothic Glass Interior!
                    # Central Y-tracery mullion (dx == 0 for dy >= 8, branching at dy=5..7)
                    is_tracery = (
                        (dx == 0 and dy >= 8)
                        or (dy == 7 and abs(dx) == 1)
                        or (dy == 6 and abs(dx) == 2)
                        or (dy == 13)
                    )
                    if is_tracery:
                        cv.put(x, y, c("darkwood", 1))
                    else:
                        # Blend mystic teal/cyan and warm amber candlelight!
                        if teal_dominant:
                            if dy < 11:
                                col = c("glass", 6) if (abs(dx) <= 1 and dy in (4, 5)) else (
                                    c("teal", 5) if dy < 7 else c("teal", 4)
                                )
                            elif dy < 15:
                                col = c("teal", 3) if ((x + y) % 2 == 0) else c("yellow", 4)
                            else:
                                col = c("yellow", 5) if abs(dx) in (2, 3) and dy > 16 else c("orange", 4)
                        else:
                            if dy < 9:
                                col = c("teal", 5) if dy < 6 else c("glass", 5)
                            elif dy < 13:
                                col = c("yellow", 4) if ((x + y) % 2 == 0) else c("teal", 4)
                            else:
                                col = c("white", 6) if (abs(dx) == 2 and dy == 17) else (
                                    c("yellow", 5) if dy > 15 else c("orange", 4)
                                )
                        # Subtle diagonal diamond lead-light glint
                        if (dx + dy) % 5 == 0 and dy > 7 and col not in (c("white", 6),):
                            col = c("glass", 4) if dy < 13 else c("orange", 3)
                        cv.put(x, y, col)

        # Carved projecting stone sill (wy0+20 .. wy0+21)
        cv.hline(wx0 - 1, wx0 + 13, wy0 + 20, c("stone", 5))
        cv.hline(wx0 - 1, wx0 + 13, wy0 + 21, c("stone", 2))
        cv.put(wx0 - 1, wy0 + 21, c("ink", 0))
        cv.put(wx0 + 13, wy0 + 21, c("ink", 0))

    draw_gothic_window(6, 46, teal_dominant=True)
    draw_gothic_window(24, 46, teal_dominant=False)

    # 2C. Right Bay: Recessed Gothic Arch Relief + Wrought-Iron Hanging Crescent Moon & Star Sign (x=42..61, y=45..69)
    # Subtle blind stone arch in background so the golden sign pops with huge contrast
    for y in range(49, 68):
        for x in range(45, 58):
            if y == 49 and x in (45, 57):
                continue
            cv.shadow_pixel(x, y, steps=1)

    # Ornate wrought-iron horizontal scroll bracket mounted to post at x=41 (x=41..60, y=46..50)
    cv.vline(42, 44, 51, c("kuro", 0))
    cv.hline(42, 60, 47, c("kuro", 0))
    cv.hline(43, 59, 46, c("steel", 3))
    cv.put(60, 46, c("yellow", 4))  # Brass spear-tip finial on iron arm!
    cv.put(61, 47, c("orange", 4))
    # Iron volute curls above & below bracket
    for ix, iy in [(44, 45), (45, 44), (46, 45), (43, 48), (44, 49), (45, 49), (56, 45), (57, 45)]:
        cv.put(ix, iy, c("kuro", 1))
    # Two hanging iron chains at x=46 and x=56 (y=48..51)
    for cx_ch in (46, 56):
        cv.put(cx_ch, 48, c("steel", 4))
        cv.put(cx_ch, 49, c("kuro", 0))
        cv.put(cx_ch, 50, c("steel", 3))
        cv.put(cx_ch, 51, c("kuro", 0))

    # Hanging Shield/Medallion Plaque + Golden Crescent Moon & Glowing Star (x=43..59, y=51..68)
    # Drop shadow of hanging sign onto plum stone wall (offset +2, +2)
    cv.shadow_rect(45, 53, 60, 69, steps=2)

    # Dark midnight-navy enameled shield plaque with wrought-iron & brass border (x=43..59, y=51..68)
    for y in range(51, 69):
        dy = y - 51
        # Taper bottom like a heraldic tavern/magic shield
        inset = 0 if dy < 13 else (1 if dy < 15 else (2 if dy < 17 else 4))
        x0_s = 43 + inset
        x1_s = 59 - inset
        for x in range(x0_s, x1_s + 1):
            if x in (x0_s, x1_s) or y == 51 or (dy >= 13 and x in (x0_s + 1, x1_s - 1) and dy == 17):
                col = c("ink", 0)
            elif x in (x0_s + 1, x1_s - 1) or y == 52 or dy == 16:
                col = c("yellow", 3) if (x + y) % 3 == 0 else c("kuro", 2)
            else:
                col = c("navy", 0) if ((x + y) % 4 != 0) else c("navy", 1)
            cv.put(x, y, col)

    # Pictorial Emblem: Gleaming Golden Crescent Moon (center (51, 59.5), outer R=5.3 minus inner circle at (53.2, 58.3), R=4.1)
    for y in range(53, 67):
        for x in range(45, 58):
            d_out = math.hypot(x - 50.8, y - 59.5)
            d_cut = math.hypot(x - 53.0, y - 58.3)
            if d_out <= 5.2 and d_cut >= 3.85:
                # 3D beveled gold shading!
                if d_out <= 3.6 and y < 59:
                    col = c("yellow", 5)
                elif x < 49 and y < 61:
                    col = c("yellow", 5)
                elif y < 62:
                    col = c("yellow", 4)
                else:
                    col = c("orange", 4) if x < 51 else c("orange", 3)
                cv.put(x, y, col)
    # Crisp 4-point Glowing Star nestled inside the crescent's embrace around (54, 58)!
    cv.put(54, 58, c("white", 6))
    for sx, sy, scol in [
        (54, 56, c("yellow", 5)), (54, 57, c("white", 6)),
        (54, 59, c("yellow", 5)), (54, 60, c("teal", 5)),
        (52, 58, c("yellow", 5)), (53, 58, c("white", 6)),
        (55, 58, c("yellow", 5)), (56, 58, c("teal", 5)),
        (53, 57, c("teal", 4)), (55, 57, c("glass", 5)),
        (53, 59, c("glass", 4)), (55, 59, c("teal", 4)),
    ]:
        cv.put(sx, sy, scol)

    # 2D. 2F-to-1F Carved Bressummer Cornice & Frieze (y=70..74)
    cv.hline(0, 63, 70, c("ink", 0))
    cv.hline(1, 62, 71, c("darkwood", 4))
    for x in range(3, 61, 6):
        cv.put(x, 71, c("yellow", 4))
        cv.put(x + 1, 71, c("orange", 3))
    cv.hline(1, 62, 72, c("wood", 3))
    cv.hline(0, 63, 73, c("darkwood", 1))
    cv.hline(1, 62, 74, c("ink", 0))

    # ------------------------------------------------------------------
    # 3. FIRST FLOOR RICH SHOPFRONT (y = 74..112)
    #    - Plum-slate masonry piers & foundation plinth
    #    - Ornate Dark-Wood 3-Facet Bay Window (x=3..40, y=75..107):
    #        * Luminous cyan crystal ball on crimson velvet cushion
    #        * Stacked leather grimoires (red, navy, emerald, cha)
    #        * Gleaming brass telescope on tripod & rolled wax-sealed scrolls
    #    - Gothic Arched Wooden Door with Glowing Rune Window (x=43..58, y=76..109)
    #    - Hanging Faceted Brass Star-Lantern (x=57..62, y=77..87)
    # ------------------------------------------------------------------

    # 3A. 1F Background Stone Wall & Grounded Plinth (y=75..111)
    for y in range(75, 112):
        for x in range(1, 63):
            if x in (1, 62) or y == 111:
                cv.put(x, y, c("ink", 0))
            elif y >= 107:
                # Heavy carved flagstone/plum plinth
                col = c("pavement", 3) if y == 107 else (c("pavement", 2) if (x + y) % 3 != 0 else c("pavement", 1))
                if x % 9 == 0:
                    col = c("ink", 1)
                cv.put(x, y, col)
            else:
                col = c("concrete", 2) if ((x // 6 + y // 4) % 2 == 0) else c("pavement", 2)
                cv.put(x, y, col)

    # Top shadow under 2F jetty cornice
    cv.shadow_rect(2, 75, 61, 76, steps=2)

    # 3B. Ornate Dark-Wood Bay Window (x=3..40, y=75..107)
    # Projecting mini-slate & copper pent-hood over bay window (x=2..41, y=75..79)
    cv.hline(3, 40, 75, c("tile", 4))
    cv.hline(2, 41, 76, c("navy", 3))
    for x in range(3, 41, 3):
        cv.put(x, 76, c("tile", 5))
    cv.hline(2, 41, 77, c("orange", 3))  # Burnished copper drip-edge!
    for x in range(4, 40, 4):
        cv.put(x, 77, c("yellow", 4))
    cv.hline(2, 41, 78, c("ink", 0))

    # Cast shadow of projecting bay window to the right (x=41..42, y=78..107) & onto plinth (y=108)
    cv.shadow_rect(41, 78, 42, 107, steps=2)
    cv.shadow_rect(4, 108, 41, 109, steps=2)

    # Outer darkwood bay frame (x=3..40, y=79..107)
    cv.rect(3, 79, 40, 107, c("darkwood", 2))
    cv.vline(3, 79, 107, c("ink", 0))
    cv.vline(40, 79, 107, c("ink", 0))
    cv.hline(4, 39, 79, c("darkwood", 4))
    # Angled side-pane mullions at x=9..10 and x=33..34
    for mx in (9, 33):
        cv.vline(mx, 80, 101, c("darkwood", 4))
        cv.vline(mx + 1, 80, 101, c("ink", 0))

    # Warm & Arcane Glowing Interior Backdrop (x=5..8, x=11..32, x=35..38, y=80..100)
    for y in range(80, 101):
        for x in range(5, 39):
            if x in (9, 10, 33, 34):
                continue
            d_orb = math.hypot(x - 21.5, y - 92.0)
            if d_orb < 5.6:
                col = c("teal", 2) if (x + y) % 2 == 0 else c("navy", 2)
            elif d_orb < 8.2:
                col = c("teal", 1) if (x + y) % 2 == 0 else c("darkwood", 2)
            elif y < 86:
                col = c("orange", 3) if y < 83 else c("wood", 3)
            elif y < 93:
                col = c("rooftile", 2) if (x + y) % 3 == 0 else c("wood", 2)
            else:
                col = c("darkwood", 2)
            cv.put(x, y, col)

    # Upper Shelf inside Bay Window (y=86, holding mini potions & grimoires at y=81..85)
    cv.hline(5, 8, 86, c("wood", 4))
    cv.hline(11, 32, 86, c("wood", 4))
    cv.hline(35, 38, 86, c("wood", 4))
    # Upper shelf mini grimoires & glowing phials
    cv.rect(12, 82, 13, 85, c("red", 3))
    cv.vline(12, 82, 85, c("yellow", 4))
    cv.rect(14, 81, 15, 85, c("navy", 3))
    cv.rect(16, 83, 17, 85, c("green", 3))
    # Hanging mini candle/orb chandelier at top center (x=21..22, y=80..83)
    cv.vline(21, 80, 81, c("kuro", 1))
    cv.put(21, 82, c("white", 6))
    cv.put(22, 82, c("yellow", 5))
    cv.put(21, 83, c("orange", 4))
    # Upper right shelf: hourglass & arcane jar (x=27..31, y=82..85)
    cv.hline(27, 29, 82, c("yellow", 4))
    cv.put(28, 83, c("glass", 6))
    cv.put(28, 84, c("yellow", 5))
    cv.hline(27, 29, 85, c("yellow", 4))

    # Gothic arched top corner cusps inside the 3 window panes (y=80..82)
    for px0, px1 in [(5, 8), (11, 32), (35, 38)]:
        cv.put(px0, 80, c("darkwood", 1))
        cv.put(px1, 80, c("darkwood", 1))
        cv.put(px0, 81, c("darkwood", 0))
        cv.put(px1, 81, c("darkwood", 0))

    # Main Counter Surface inside Bay Window (y=99..100)
    for px0, px1 in [(5, 8), (11, 32), (35, 38)]:
        cv.hline(px0, px1, 99, c("cedar", 4))
        cv.hline(px0, px1, 100, c("wood", 2))

    # PROP 1: Stacked Leather Grimoires (left pane x=5..8 & center-left x=11..16, y=90..98)
    cv.rect(5, 95, 8, 98, c("navy", 2))
    cv.hline(5, 8, 96, c("cream", 5))
    cv.rect(6, 92, 8, 94, c("red", 3))
    cv.put(7, 93, c("yellow", 4))
    # Center-left grimoire stack (3 fat leather spellbooks with gold clasps!)
    cv.rect(11, 96, 16, 98, c("green", 2))
    cv.hline(11, 16, 96, c("green", 4))
    cv.hline(12, 15, 97, c("cream", 5))
    cv.put(13, 97, c("yellow", 5))
    cv.rect(12, 93, 16, 95, c("red", 3))
    cv.hline(12, 16, 93, c("red", 4))
    cv.hline(13, 16, 94, c("cream", 4))
    cv.put(14, 94, c("yellow", 4))
    cv.rect(11, 90, 15, 92, c("wood", 4))
    cv.hline(11, 15, 90, c("cedar", 5))
    cv.put(13, 91, c("yellow", 5))

    # PROP 2: Luminous Cyan Crystal Ball on Crimson Velvet Cushion (x=18..25, y=88..98)
    cv.rect(18, 96, 25, 98, c("red", 3))
    cv.hline(19, 24, 96, c("red", 4))
    cv.hline(18, 25, 98, c("red", 1))
    cv.put(17, 97, c("yellow", 5))
    cv.put(26, 97, c("yellow", 4))
    cv.hline(19, 24, 95, c("orange", 3))
    cv.put(19, 95, c("yellow", 5))
    cv.put(24, 95, c("yellow", 4))
    # Luminous Cyan Crystal Orb with crisp refractive rim (center 21.5, 91.5, r=3.5)
    for y in range(88, 96):
        for x in range(18, 26):
            d = math.hypot(x - 21.5, y - 91.5)
            if d <= 3.55:
                if d >= 2.85:
                    col = c("glass", 6) if (x + y) <= 112 else c("teal", 3)
                elif d <= 1.25:
                    col = c("white", 6)
                else:
                    col = c("teal", 5) if y <= 92 else c("teal", 4)
                cv.put(x, y, col)
    cv.put(20, 89, c("white", 6))
    cv.put(19, 90, c("glass", 6))
    # Tiny floating arcane sparkle motes around crystal ball
    cv.put(17, 89, c("teal", 5))
    cv.put(25, 88, c("glass", 6))

    # PROP 3: Gleaming Brass Telescope & Rolled Parchment Scrolls (x=26..38, y=88..98)
    cv.line(32, 93, 27, 88, c("orange", 3))
    cv.line(31, 93, 27, 89, c("yellow", 5))
    cv.put(29, 91, c("orange", 4))  # Segmented brass collar
    cv.put(26, 88, c("glass", 6))   # Objective lens glint!
    cv.put(27, 88, c("yellow", 5))
    cv.put(32, 93, c("yellow", 4))  # Eyepiece
    # Brass tripod legs (y=93..98)
    cv.line(29, 93, 27, 98, c("orange", 3))
    cv.vline(29, 93, 98, c("yellow", 4))
    cv.line(30, 93, 32, 98, c("orange", 2))

    # Right angled pane (x=35..38): Wooden scroll barrel + rolled scrolls with red wax seals!
    cv.rect(35, 94, 38, 98, c("darkwood", 3))
    cv.hline(35, 38, 95, c("yellow", 3))  # Brass hoop
    # Upright parchment scrolls sticking out (y=89..93)
    cv.vline(35, 90, 93, c("cream", 5))
    cv.vline(36, 89, 93, c("cream", 6))
    cv.put(36, 91, c("red", 3))  # Red wax seal!
    cv.vline(37, 90, 93, c("cream", 4))
    cv.vline(38, 91, 93, c("kinari", 4))

    # Subtle diagonal window glass reflection streaks
    for rx, ry in [(6, 84), (7, 83), (12, 84), (13, 83), (14, 82)]:
        cv.put(rx, ry, c("glass", 5))

    # Carved Dark-Wood Bay Window Dado / Wainscot Base (x=4..39, y=101..107)
    cv.hline(3, 40, 101, c("cedar", 4))
    cv.hline(3, 40, 102, c("darkwood", 1))
    for rx0, rx1 in [(5, 8), (11, 20), (23, 32), (35, 38)]:
        cv.rect(rx0, 103, rx1, 106, c("wood", 2))
        cv.hline(rx0, rx1, 103, c("darkwood", 0))
        cv.vline(rx0, 103, 106, c("darkwood", 0))
        cv.hline(rx0 + 1, rx1, 106, c("wood", 4))
    cv.hline(3, 40, 107, c("ink", 0))

    # 3C. Gothic Arched Wooden Door with Glowing Rune Window (x=43..58, y=76..110)
    cx_d = 50
    for y in range(76, 109):
        dy = y - 76
        if dy == 0:
            hw = 2
        elif dy == 1:
            hw = 4
        elif dy == 2:
            hw = 5
        elif dy in (3, 4):
            hw = 6
        else:
            hw = 7

        for x in range(cx_d - hw, cx_d + hw + 1):
            dx = x - cx_d
            # Outer carved stone gothic architrave (2px thick)
            if abs(dx) >= hw - 1 or dy <= 1 or (dy == 2 and abs(dx) >= 4):
                if abs(dx) == hw and dx > 0:
                    col = c("stone", 2)
                elif dy <= 1:
                    col = c("stone", 5)
                else:
                    col = c("stone", 4) if dx < 0 else c("stone", 3)
                cv.put(x, y, col)
            elif abs(dx) == hw - 2 or (dy == 2 and abs(dx) == 3) or (dy == 3 and abs(dx) == 4):
                # Deep recessed door jamb shadow
                cv.put(x, y, c("ink", 0))
            else:
                # Heavy vertical oak/cedar door planks (x=46..54)
                plank = (x - 46) % 3
                col = c("wood", 4) if plank == 0 else (c("wood", 3) if plank == 1 else c("darkwood", 2))
                if y > 103:
                    col = c("darkwood", 2) if plank != 2 else c("darkwood", 1)
                cv.put(x, y, col)

    # Glowing Arcane Rune Window set into the Gothic Door (x=48..52, y=82..90)
    cv.rect(48, 83, 52, 90, c("ink", 0))
    cv.hline(49, 51, 82, c("ink", 0))
    cv.rect(49, 83, 51, 89, c("navy", 1))
    # Luminous cyan-and-gold diamond rune glyph inside door window!
    for rx, ry, rcol in [
        (50, 83, c("teal", 5)),
        (49, 85, c("teal", 4)), (50, 84, c("glass", 6)), (51, 85, c("teal", 4)),
        (50, 85, c("white", 6)),
        (49, 87, c("teal", 4)), (50, 86, c("glass", 6)), (51, 87, c("teal", 4)),
        (50, 88, c("yellow", 5)),
    ]:
        cv.put(rx, ry, rcol)

    # Wrought-iron gothic strap hinges & brass ring knocker on door
    cv.hline(46, 51, 93, c("kuro", 1))
    cv.put(51, 92, c("kuro", 2))
    cv.hline(46, 51, 102, c("kuro", 1))
    cv.put(53, 96, c("yellow", 5))
    cv.put(53, 97, c("orange", 4))

    # Stepped Stone Threshold in front of Gothic Door (x=43..57, y=108..111)
    cv.hline(44, 56, 108, c("stone", 5))
    cv.hline(43, 57, 109, c("stone", 4))
    cv.hline(43, 57, 110, c("stone", 2))
    cv.hline(43, 57, 111, c("ink", 0))

    # 3D. Hanging Faceted Star-Lantern beside Door Arch (x=57..61, y=77..86)
    cv.hline(57, 60, 78, c("kuro", 0))
    cv.put(59, 79, c("kuro", 1))
    # Brass lantern cap & glowing star body (x=58..60, y=80..85)
    cv.hline(58, 60, 80, c("orange", 3))
    cv.rect(58, 81, 60, 83, c("yellow", 5))
    cv.put(59, 82, c("white", 6))
    cv.put(57, 82, c("yellow", 4))  # Star point left
    cv.put(61, 82, c("yellow", 4))  # Star point right
    cv.hline(58, 60, 84, c("orange", 4))
    cv.put(59, 85, c("kuro", 0))
    # Warm golden lantern glow cast onto right stone pier!
    for gx, gy in [(56, 81), (56, 82), (56, 83), (57, 85)]:
        cv.put(gx, gy, c("cream", 4))

    return cv.img


# ==============================================================================
# BUILDING 2: ft-apothecary.png (48x112) — Herbalist & Potion Apothecary (포션·약초방)
# ==============================================================================
def build_ft_apothecary(ramps: dict[str, list[tuple[int, int, int, int]]]) -> Image.Image:
    cv = PixelCanvas(48, 112, ramps)
    c = cv.c

    # ------------------------------------------------------------------
    # 1. ROOF ZONE (y = 0..42)
    #    - Mossy glazed forest-green `midori` staggered tile roof (y=5..40)
    #    - Cozy brick apothecary chimney pot on right ridge (x=36..42, y=1..12)
    #    - Tiny angled glass skylight on left-center roof (x=10..20, y=15..25)
    #    - Climbing lush ivy vines creeping up roof & cascading onto 2F
    # ------------------------------------------------------------------

    # 1A. Glazed Ceramic Ridge Cap (x=1..46, y=5..8)
    cv.hline(2, 45, 5, c("ink", 0))
    for x in range(2, 46):
        seg = x % 5
        cv.put(x, 6, c("midori", 6) if seg != 0 else c("midori", 4))
        cv.put(x, 7, c("midori", 4) if seg != 0 else c("midori", 2))
        cv.put(x, 8, c("midori", 1))
    # Decorative ceramic leaf/acorn ridge finials at x=2..3 and x=44..45
    for fx in (2, 45):
        cv.vline(fx, 3, 7, c("ink", 0))
    cv.put(3, 3, c("midori", 6))
    cv.put(3, 4, c("midori", 5))
    cv.put(44, 3, c("midori", 6))
    cv.put(44, 4, c("midori", 4))

    # 1B. Staggered Glazed Forest-Green `midori` Roof Tiles + Natural Moss Patches (y=9..39)
    for y in range(9, 40):
        row = (y - 9) // 4
        dy = (y - 9) % 4
        offset = 3 if (row % 2 == 1) else 0
        base_lv = 4 if y < 18 else (3 if y < 29 else 2)
        for x in range(0, 48):
            if x in (0, 47):
                if y >= 8:
                    cv.put(x, y, c("ink", 0))
                continue
            tx = (x + offset) % 6
            tid = (x + offset) // 6
            hv = h2(tid, row, 53)

            # Determine whether this tile has mossy/olive weathering
            is_mossy = (
                (hv > 212)
                or (y > 33 and hv > 150)
                or (x < 9 and y > 24 and hv > 110)
                or (x > 38 and y < 16 and hv > 130)
            )
            lv = base_lv + (1 if hv > 180 else (0 if hv > 65 else -1))
            if x > 36:
                lv -= 1

            if is_mossy:
                mlv = clamp(lv, 1, 4)
                if dy == 0:
                    col = c("moss", 0)
                elif dy == 1:
                    col = c("moss", clamp(mlv + 1, 2, 5)) if tx in (1, 2, 3) else c("moss", mlv)
                elif dy == 2:
                    col = c("moss", mlv) if tx != 0 else c("moss", 1)
                else:
                    col = c("ink", 0) if tx in (0, 5) else c("foliage", clamp(mlv, 1, 4))
            else:
                if dy == 0:
                    col = c("ink", 0) if tx in (0, 5) else c("midori", 0)
                elif dy == 1:
                    if tx == 0:
                        col = c("midori", 1)
                    elif tx == 1:
                        # Glazed ceramic specular highlight!
                        col = c("midori", clamp(lv + 2, 3, 6))
                    elif tx in (2, 3):
                        col = c("midori", clamp(lv + 1, 2, 5))
                    else:
                        col = c("midori", clamp(lv, 1, 4))
                elif dy == 2:
                    if tx == 0:
                        col = c("midori", 0)
                    elif tx in (1, 2):
                        col = c("midori", clamp(lv + 1, 2, 5))
                    elif tx == 5:
                        col = c("midori", clamp(lv - 1, 0, 3))
                    else:
                        col = c("midori", clamp(lv, 1, 4))
                else:
                    if tx in (0, 5):
                        col = c("ink", 0)
                    else:
                        col = c("midori", clamp(lv - 1, 1, 3))
            cv.put(x, y, col)

    # 1C. Warm Terracotta-Brick Apothecary Chimney Pot on Right Ridge (x=36..42, y=1..13)
    cv.shadow_rect(42, 6, 44, 14, steps=2)
    cv.shadow_rect(37, 13, 42, 14, steps=2)
    # Chimney pot rim & shaft
    cv.hline(37, 40, 1, c("ink", 0))
    cv.hline(36, 41, 2, c("rooftile", 5))
    cv.put(36, 2, c("ink", 0))
    cv.put(41, 2, c("ink", 0))
    cv.hline(36, 41, 3, c("brick", 2))
    for y in range(4, 13):
        for x in range(36, 42):
            if x in (36, 41):
                col = c("ink", 0) if x == 36 else c("brick", 0)
            elif y == 7:
                col = c("stone", 4) if x < 39 else c("stone", 2)
            else:
                col = c("brick", 5) if x == 37 else (c("brick", 4) if x == 38 else c("brick", 2))
            cv.put(x, y, col)
    cv.hline(36, 41, 12, c("moss", 2))

    # 1D. Tiny Angled Glass Skylight on Roof (x=11..21, y=15..25)
    cv.shadow_rect(22, 17, 23, 26, steps=2)
    cv.shadow_rect(12, 26, 22, 26, steps=2)
    # Cedar & copper skylight curb frame
    cv.rect(11, 15, 21, 25, c("ink", 0))
    cv.hline(12, 20, 15, c("cedar", 5))
    cv.rect(12, 16, 20, 24, c("cedar", 3))
    cv.hline(12, 20, 24, c("cedar", 1))
    # Two glazed panes (x=13..15 and x=17..19, y=17..23)
    for px0, px1 in [(13, 15), (17, 19)]:
        for y in range(17, 24):
            for x in range(px0, px1 + 1):
                if (x + y) in (31, 32, 35, 36):
                    col = c("glass", 6) if (x + y) in (31, 35) else c("glass", 5)
                elif y >= 21:
                    # Peek of warm green greenhouse herbs under skylight!
                    col = c("foliage", 4) if x == px0 + 1 else c("teal", 3)
                else:
                    col = c("glass", 2) if y < 19 else c("glass", 3)
                cv.put(x, y, col)
    # Central skylight mullion
    cv.vline(16, 16, 24, c("cedar", 4))

    # 1E. Cedar Roof Eave & Exposed Rafter Tails (y=40..42)
    cv.hline(0, 47, 40, c("cedar", 4))
    cv.hline(0, 47, 41, c("darkwood", 2))
    for rx in range(3, 46, 6):
        cv.put(rx, 41, c("cedar", 5))
        cv.put(rx + 1, 41, c("cedar", 3))
    cv.hline(1, 46, 42, c("ink", 0))

    # ------------------------------------------------------------------
    # 2. SECOND FLOOR FACADE (y = 42..74)
    #    - Warm cream plaster & cedar half-timber beams
    #    - Open wooden casement window (x=8..23, y=49..64)
    #    - Hanging colorful drying herb & lavender bundles under eave
    #    - Swinging wrought-iron sign with Glowing Emerald Potion Flask (x=31..46)
    # ------------------------------------------------------------------

    # 2A. Warm Cream Lime-Plaster Wall & Cedar Timber Framing (x=1..46, y=43..72)
    for y in range(43, 73):
        for x in range(1, 47):
            if x in (1, 46):
                cv.put(x, y, c("ink", 0))
                continue
            hv = h2(x // 2, y // 2, 91)
            col = c("cream", 5) if hv > 150 else (c("cream", 4) if hv > 45 else c("kinari", 4))
            if x > 38:
                col = c("cream", 4) if hv > 120 else c("cream", 3)
            cv.put(x, y, col)

    # Vertical Cedar Posts (left x=2..3, middle x=29..30, right x=44..45) & Sill Beam (y=66..67)
    for px0 in (2, 29, 44):
        cv.vline(px0, 43, 72, c("cedar", 3))
        cv.vline(px0 + 1, 43, 72, c("wood", 2))
    cv.hline(2, 45, 66, c("cedar", 3))
    cv.hline(2, 45, 67, c("wood", 2))
    # Diagonal half-timber knee braces at lower corners (y=67..72)
    cv.line(4, 68, 8, 72, c("cedar", 2))
    cv.line(4, 69, 7, 72, c("wood", 2))
    cv.line(28, 68, 24, 72, c("cedar", 2))
    cv.line(28, 69, 25, 72, c("wood", 2))

    # Top eave shadow across 2F plaster (y=43..45)
    cv.shadow_rect(2, 43, 45, 44, steps=2)
    cv.shadow_rect(2, 45, 45, 45, steps=1)

    # 2B. Climbing Ivy Vines Creeping from Roof Over Left Eave & Down Post (x=1..12, y=22..58)
    # Continuous woody vine stem climbing left post onto roof
    for sx, sy in [(3, 56), (3, 52), (3, 48), (3, 44), (3, 40), (4, 37), (5, 33), (6, 29)]:
        cv.vline(sx, sy, sy + 3, c("wood", 2))
    ivy_clusters = [
        (2, 38), (3, 36), (5, 34), (6, 31), (7, 27), (8, 33), (7, 37), (10, 38), (5, 39),
        (2, 32), (4, 29), (5, 25), (9, 35), (11, 39),
        (2, 41), (3, 43), (5, 44), (2, 46), (4, 48), (2, 50), (3, 52), (4, 54), (2, 56),
        (42, 35), (44, 37), (41, 38), (43, 40), (44, 42), (45, 44),
    ]
    for ix, iy in ivy_clusters:
        cv.shadow_pixel(ix + 1, iy + 1, steps=2)
    for idx_i, (ix, iy) in enumerate(ivy_clusters):
        cv.put(ix, iy, c("foliage", 4 if idx_i % 2 == 0 else 3))
        cv.put(ix + 1, iy, c("foliage", 2))
        cv.put(ix, iy - 1, c("foliage", 5) if idx_i % 3 == 0 else c("moss", 4))
        if idx_i in (2, 7, 13, 18, 24):
            cv.put(ix + 1, iy - 1, c("white", 6) if idx_i % 2 == 0 else c("pink", 4))

    # 2C. Open Wooden Casement Window (x=9..22, y=51..64, with open shutters at x=5..8 and x=23..26)
    cv.shadow_rect(6, 65, 26, 65, steps=1)
    cv.rect(9, 51, 22, 64, c("darkwood", 1))
    cv.hline(9, 22, 51, c("cedar", 4))
    # Warm cozy apothecary interior with back herb shelf & hanging brass lamp (x=10..21, y=52..63)
    for y in range(52, 64):
        for x in range(10, 22):
            d_lamp = math.hypot(x - 16.0, y - 54.5)
            if d_lamp <= 2.2:
                col = c("yellow", 5) if d_lamp < 1.2 else c("orange", 4)
            elif y == 57:
                col = c("cedar", 3)  # Inner apothecary wall shelf
            elif y < 57:
                col = c("wood", 3) if d_lamp < 4.5 else c("wood", 2)
            else:
                col = c("orange", 2) if d_lamp < 6.0 else c("darkwood", 2)
            cv.put(x, y, col)
    # Tiny glowing green & blue herb jars on inner 2F shelf (y=55..56)
    cv.rect(11, 55, 12, 56, c("green", 4))
    cv.rect(19, 55, 20, 56, c("glass", 5))
    # Ceramic mortar & pestle + amber bottle on 2F inner windowsill (y=60..63)
    cv.rect(12, 61, 14, 63, c("cream", 5))
    cv.put(14, 60, c("cedar", 5))
    cv.rect(18, 60, 19, 63, c("orange", 4))
    cv.put(18, 59, c("cream", 6))

    # Open Outward-Swung Casement Sash Shutters (left x=5..8, right x=23..26, y=51..63)
    for sx0 in (5, 23):
        cv.shadow_rect(sx0 + 1, 53, sx0 + 4, 64, steps=1)
        cv.rect(sx0, 51, sx0 + 3, 63, c("cedar", 4))
        cv.vline(sx0, 51, 63, c("cedar", 5))
        cv.vline(sx0 + 3, 51, 63, c("wood", 2))
        for py0 in (53, 58):
            cv.rect(sx0 + 1, py0, sx0 + 2, py0 + 3, c("glass", 4))
            cv.put(sx0 + 1, py0, c("glass", 6))

    # Wooden Window Sill Flower/Herb Box (x=9..22, y=64..66)
    cv.rect(9, 64, 22, 65, c("wood", 3))
    cv.hline(9, 22, 64, c("cedar", 5))
    for hx in range(10, 22):
        cv.put(hx, 63, c("foliage", 4) if hx % 2 == 0 else c("foliage", 3))
        if hx in (11, 15, 19):
            cv.put(hx, 62, c("pink", 4) if hx == 15 else c("yellow", 5))

    # 2D. Colorful Drying Herb & Lavender Bundles Hanging Under Eave (x=6..28, y=43..50)
    cv.hline(6, 27, 43, c("cedar", 4))
    herb_bundles = [
        (8,  49, [c("midori", 5), c("foliage", 4), c("midori", 6)]),
        (12, 50, [c("navy", 4), c("pink", 3), c("pink", 4)]),       # Fragrant Lavender!
        (16, 49, [c("yellow", 4), c("orange", 4), c("yellow", 5)]), # Golden Chamomile!
        (20, 50, [c("red", 3), c("red", 4), c("orange", 4)]),       # Scarlet Rosehips!
        (25, 49, [c("navy", 4), c("pink", 4), c("navy", 5)]),       # Royal Lavender!
    ]
    for bx, b_end, tip_cols in herb_bundles:
        cv.shadow_rect(bx, 45, bx + 2, b_end + 1, steps=1)
        cv.put(bx, 44, c("straw", 4))
        cv.hline(bx - 1, bx + 1, 45, c("foliage", 2))
        cv.hline(bx - 1, bx + 1, 46, c("foliage", 3))
        for yy in range(47, b_end):
            cv.put(bx - 1, yy, tip_cols[(yy) % 3])
            cv.put(bx, yy, tip_cols[(yy + 1) % 3])
            cv.put(bx + 1, yy, tip_cols[(yy + 2) % 3])
        cv.put(bx, b_end, tip_cols[2])

    # 2E. Swinging Iron Sign with Glowing Emerald Potion Flask (x=31..46, y=46..68)
    # Ornate wrought-iron bracket arm extending from middle cedar post x=30 (x=31..45, y=46..49)
    cv.hline(31, 45, 47, c("kuro", 0))
    cv.hline(32, 44, 46, c("steel", 3))
    cv.put(45, 46, c("yellow", 4))  # Brass leaf finial
    for ix, iy in [(32, 48), (33, 49), (34, 49), (33, 45), (34, 44), (42, 45)]:
        cv.put(ix, iy, c("kuro", 1))
    # Chains at x=35 and x=42 (y=48..50)
    for cx_s in (35, 42):
        cv.put(cx_s, 48, c("steel", 3))
        cv.put(cx_s, 49, c("kuro", 0))
        cv.put(cx_s, 50, c("steel", 3))

    # Drop shadow of swinging sign onto cream plaster
    cv.shadow_rect(34, 53, 45, 68, steps=2)

    # Dark-wood & iron-framed arched apothecary sign board (x=32..45, y=51..67)
    for y in range(51, 68):
        for x in range(32, 46):
            if (y in (51, 67) and x in (32, 45)):
                continue
            if x in (32, 45) or y in (51, 67):
                col = c("ink", 0)
            elif x in (33, 44) or y in (52, 66):
                col = c("wood", 4) if (x + y) % 3 != 0 else c("cedar", 4)
            else:
                col = c("darkwood", 0) if (x + y) % 2 == 0 else c("darkwood", 1)
            cv.put(x, y, col)

    # Pictorial Round-Bottom Glowing Emerald Potion Flask on Sign (center x=38.5, y=61)
    # Cork stopper (y=53..54)
    cv.hline(38, 39, 53, c("cedar", 5))
    cv.hline(38, 39, 54, c("cedar", 3))
    # Flared glass neck lip (y=55..56)
    cv.hline(37, 40, 55, c("glass", 6))
    cv.put(40, 55, c("glass", 4))
    cv.hline(38, 39, 56, c("glass", 5))
    # Round glass flask bulb (center 38.5, 61.0, r=4.3)
    for y in range(57, 66):
        for x in range(34, 44):
            d = math.hypot(x - 38.5, y - 61.0)
            if d <= 4.3:
                if d >= 3.45:
                    # Crisp pale-cyan glass rim!
                    col = c("glass", 6) if x < 39 else c("teal", 4)
                elif y <= 59:
                    # Upper empty glass headspace above liquid meniscus
                    col = c("glass", 3) if x > 37 else c("glass", 5)
                elif y == 60:
                    # Bright glowing emerald meniscus surface!
                    col = c("green", 5) if x < 40 else c("green", 4)
                else:
                    # Luminous emerald potion liquid + rising sparkle bubbles!
                    if (x, y) in [(37, 62), (39, 63)]:
                        col = c("white", 6) if x == 37 else c("green", 5)
                    elif d <= 2.1:
                        col = c("green", 4)
                    else:
                        col = c("green", 3) if x <= 39 else c("green", 2)
                cv.put(x, y, col)

    # 2F-to-1F Cedar Beam Fascia (y=72..74)
    cv.hline(0, 47, 72, c("cedar", 4))
    cv.hline(0, 47, 73, c("darkwood", 1))
    cv.hline(1, 46, 74, c("ink", 0))

    # ------------------------------------------------------------------
    # 3. FIRST FLOOR RICH SHOPFRONT (y = 74..112)
    #    - Green-and-cream striped fabric awning over window (x=1..30, y=74..84)
    #    - Glowing multi-pane apothecary window (x=3..29, y=85..101):
    #        * Ruby, emerald, gold & sapphire potion bottles + gleaming brass alembic!
    #    - Lush terracotta medicinal herb planters (x=2..29, y=101..110)
    #    - Dutch-style split wood door on right (x=31..45, y=76..110)
    # ------------------------------------------------------------------

    # 3A. Base Cream Wall & Stone Plinth Foundation (y=75..111)
    for y in range(75, 112):
        for x in range(1, 47):
            if x in (1, 46) or y == 111:
                cv.put(x, y, c("ink", 0))
            elif y >= 107:
                col = c("stone", 3) if y == 107 else (c("stone", 2) if (x + y) % 3 != 0 else c("pavement", 2))
                cv.put(x, y, col)
            else:
                col = c("cream", 4) if (x + y) % 2 == 0 else c("cream", 3)
                cv.put(x, y, col)

    # 3B. Green-and-Cream Striped Fabric Awning (x=1..30, y=74..84)
    # Cast shadow to right of awning & below valance
    cv.shadow_rect(31, 76, 32, 85, steps=2)
    for y in range(74, 83):
        dy = y - 74
        # Slight outward projection: x=1..30
        for x in range(1, 31):
            if x in (1, 30):
                cv.put(x, y, c("ink", 0))
                continue
            stripe = ((x - 2) // 4) % 2  # 4px alternating green & cream stripes!
            if stripe == 0:
                # Rich forest-emerald green stripe
                lv = 4 if dy in (2, 3) else (3 if dy < 6 else 2)
                if dy == 0:
                    lv = 2
                col = c("green", lv)
            else:
                # Warm sunlit cream stripe
                lv = 6 if dy in (2, 3) else (5 if dy < 6 else 4)
                if dy == 0:
                    lv = 3
                col = c("cream", lv)
            cv.put(x, y, col)

    # Rounded scalloped awning valance fringe (y=82..85)
    cv.hline(1, 30, 82, c("ink", 1))
    # First draw the window frame & warm candlelit cedar apothecary interior (y=84..102),
    # then stamp scalloped awning tabs over y=83..85 so true scallop cutouts show!
    cv.rect(3, 84, 29, 102, c("darkwood", 1))
    cv.vline(3, 84, 102, c("cedar", 3))
    cv.vline(29, 84, 102, c("cedar", 2))
    cv.hline(3, 29, 102, c("cedar", 4))

    # Warm Candlelit Cedar-Wood Apothecary Interior so Ruby/Gold/Emerald/Sapphire & Brass POP!
    for y in range(85, 102):
        for x in range(4, 29):
            if y <= 86:
                col = c("darkwood", 1)  # Deep under-awning shadow
            elif y < 93:
                # Warm amber-lit wooden apothecary cabinet
                d_glow = abs(x - 16)
                col = c("orange", 2) if d_glow < 6 else (c("wood", 3) if (x + y) % 2 == 0 else c("wood", 2))
            elif y == 93:
                col = c("cedar", 4)
            elif y < 100:
                col = c("rooftile", 2) if (10 <= x <= 20 and y < 98) else c("wood", 2)
            else:
                col = c("cedar", 5) if y == 100 else c("wood", 3)
            cv.put(x, y, col)

    # TOP SHELF POTIONS (y=88..92): Ruby, Sapphire, Gold, Emerald, Rose!
    def draw_mini_potion(px: int, py_bot: int, ramp_name: str, tall: bool = False) -> None:
        top_y = py_bot - (4 if tall else 3)
        cv.put(px + 1, top_y, c("cream", 5))
        cv.hline(px, px + 2, top_y + 1, c("glass", 6))
        for yy in range(top_y + 2, py_bot + 1):
            cv.put(px, yy, c(ramp_name, 5 if yy == top_y + 2 else 4))
            cv.put(px + 1, yy, c("white", 6) if yy == top_y + 2 else c(ramp_name, 4))
            cv.put(px + 2, yy, c(ramp_name, 2))

    draw_mini_potion(5, 92, "red", tall=True)       # Ruby Healing Draught
    draw_mini_potion(8, 92, "blue", tall=False)     # Sapphire Mana Phial
    draw_mini_potion(13, 92, "yellow", tall=True)   # Radiant Gold Elixir
    draw_mini_potion(17, 92, "green", tall=False)   # Emerald Antidote
    draw_mini_potion(23, 92, "blue", tall=True)     # Deep Sapphire Tonic
    draw_mini_potion(26, 92, "red", tall=False)     # Crimson Phial

    # BOTTOM COUNTER (y=94..99): Gleaming Brass Alembic Still + Sapphire Receiver + Ruby & Gold Phials!
    draw_mini_potion(5, 99, "red", tall=False)
    # Gleaming Brass Alembic Still (x=12..20, y=94..99):
    cv.hline(12, 14, 99, c("kuro", 1))
    cv.put(13, 98, c("white", 6))   # Bright spirit-lamp flame core
    cv.put(12, 98, c("orange", 5))
    cv.rect(12, 95, 14, 97, c("orange", 4))
    cv.put(12, 95, c("yellow", 5))
    cv.put(13, 95, c("yellow", 4))
    cv.put(13, 94, c("yellow", 5))  # Alembic dome cap
    cv.put(14, 94, c("yellow", 4))
    # Curved brass swan-neck condenser tube (x=15..19, y=94..97)
    cv.put(15, 94, c("yellow", 5))
    cv.put(16, 95, c("yellow", 4))
    cv.put(17, 95, c("orange", 4))
    cv.put(18, 96, c("orange", 3))
    cv.put(19, 97, c("teal", 5))    # Distilled arcane drop!
    # Sapphire receiver flask (x=18..20, y=97..99)
    cv.hline(18, 20, 98, c("blue", 4))
    cv.put(18, 98, c("glass", 6))
    cv.hline(18, 20, 99, c("blue", 3))
    # Right emerald & gold phials (x=23..28, y=96..99)
    draw_mini_potion(23, 99, "green", tall=False)
    draw_mini_potion(26, 99, "yellow", tall=False)

    # Vertical Multi-Pane Cedar Mullions drawn OVER interior props so panes read crisply!
    cv.vline(11, 85, 102, c("cedar", 3))
    cv.vline(21, 85, 102, c("cedar", 3))

    # Now stamp true scalloped awning valance tabs at y=83..85 with drop shadow!
    for x in range(1, 31):
        if x in (1, 30):
            cv.put(x, 83, c("ink", 0))
            cv.put(x, 84, c("ink", 0))
            continue
        stripe = ((x - 2) // 4) % 2
        pos = (x - 2) % 4
        col_hi = c("green", 3) if stripe == 0 else c("cream", 5)
        col_lo = c("green", 2) if stripe == 0 else c("cream", 4)
        cv.put(x, 83, col_hi if pos in (1, 2) else col_lo)
        if pos in (1, 2):
            cv.put(x, 84, col_lo)
            cv.put(x, 85, c("ink", 0))
            cv.shadow_pixel(x, 86, steps=2)
        else:
            cv.put(x, 84, c("ink", 0))
            cv.shadow_pixel(x, 85, steps=2)

    # 3D. Lush Terracotta Medicinal Herb Planters (x=2..29, y=101..110)
    for px0, px1, seed_p in [(3, 14, 1), (17, 28, 2)]:
        # Cast shadow onto plinth
        cv.shadow_rect(px0 + 1, 110, px1 + 1, 110, steps=2)
        # Terracotta molded rim (y=105..106) & tapered body (y=107..109)
        cv.hline(px0, px1, 105, c("brick", 6))
        cv.hline(px0, px1, 106, c("brick", 4))
        cv.rect(px0 + 1, 107, px1 - 1, 109, c("brick", 4))
        cv.vline(px0 + 1, 107, 109, c("brick", 5))
        cv.vline(px1 - 1, 107, 109, c("brick", 2))
        cv.hline(px0 + 1, px1 - 1, 109, c("brick", 2))

        # Lush medicinal herbs & blossoms overflowing y=100..104!
        for hx in range(px0, px1 + 1):
            hv = h2(hx, seed_p, 109)
            top_h = 101 if (px0 + 2 <= hx <= px1 - 2 and hv > 90) else 102
            for hy in range(top_h, 105):
                if seed_p == 1:
                    col = c("foliage", 5 if hy == top_h else (4 if hv > 120 else 3))
                else:
                    col = c("midori", 5 if hy == top_h else 4) if hx % 2 == 0 else c("foliage", 3)
                cv.put(hx, hy, col)
        # Colorful medicinal blooms (crimson berries & golden calendula & lavender)
        if seed_p == 1:
            for bx, by, bcol in [(5, 101, c("red", 4)), (8, 102, c("yellow", 5)), (11, 101, c("red", 5)), (13, 102, c("yellow", 4))]:
                cv.put(bx, by, bcol)
        else:
            for bx, by, bcol in [(19, 101, c("pink", 4)), (22, 101, c("yellow", 5)), (25, 102, c("pink", 3)), (26, 101, c("white", 6))]:
                cv.put(bx, by, bcol)

    # 3E. Dutch-Style Split Wood Door on Right (x=32..44, y=76..110)
    # Stone & cedar door surround (x=31..45, y=76..109)
    cv.rect(31, 76, 45, 109, c("cedar", 3))
    cv.hline(31, 45, 76, c("stone", 4))
    cv.hline(31, 45, 77, c("cedar", 4))
    cv.rect(32, 78, 44, 108, c("ink", 0))

    # Upper Half of Dutch Door (x=33..43, y=79..92): warm cedar frame with glazed herb-bullseye window!
    cv.rect(33, 79, 43, 92, c("cedar", 4))
    cv.vline(43, 79, 92, c("wood", 2))
    # Warm glowing glazed pane in upper Dutch door (x=35..41, y=81..89)
    cv.rect(35, 81, 41, 89, c("darkwood", 1))
    for y in range(82, 89):
        for x in range(36, 41):
            col = c("yellow", 4) if y < 86 else c("orange", 4)
            if (x, y) in [(38, 84), (38, 85)]:
                col = c("yellow", 5)
            cv.put(x, y, col)
    # Cross mullion in upper Dutch door pane
    cv.vline(38, 81, 89, c("cedar", 3))
    cv.hline(35, 41, 85, c("cedar", 3))

    # Characteristic Dutch-Door Horizontal Split Shelf Ledge (y=93..94) + crisp shadow at y=95!
    cv.hline(32, 44, 93, c("cedar", 5))
    cv.hline(32, 44, 94, c("ink", 0))

    # Lower Half of Dutch Door (x=33..43, y=95..108): vertical planks + Z/frame rails + iron hinges
    for y in range(95, 109):
        for x in range(33, 44):
            if y == 95:
                col = c("wood", 2)  # Shadow under Dutch split shelf!
            elif x in (33, 43) or y in (96, 107, 108):
                col = c("cedar", 4) if x < 42 and y < 107 else c("wood", 2)
            else:
                plank = (x - 34) % 3
                col = c("cedar", 3) if plank != 2 else c("wood", 3)
            cv.put(x, y, col)

    # Wrought-iron Dutch door hinges (left x=33..36) & brass latch (right x=41..42)
    for hy in (81, 90, 97, 105):
        cv.hline(33, 36, hy, c("kuro", 1))
    cv.put(42, 91, c("yellow", 5))  # Upper half brass knob
    cv.put(42, 97, c("yellow", 5))  # Lower half brass latch
    cv.put(42, 98, c("orange", 4))

    # Worn Stone Doorstep Threshold (x=31..45, y=109..111)
    cv.hline(31, 45, 109, c("stone", 5))
    cv.hline(31, 45, 110, c("stone", 3))
    cv.hline(31, 45, 111, c("ink", 0))

    return cv.img


# ==============================================================================
# STRICT VERIFICATION & 3X CHECKERBOARD PREVIEW SHEET
# ==============================================================================
def verify_building(
    name: str,
    img: Image.Image,
    expected_size: tuple[int, int],
    allowed_rgb: set[tuple[int, int, int]],
) -> dict:
    assert img.mode == "RGBA", f"{name}: mode must be RGBA, got {img.mode}"
    assert img.size == expected_size, f"{name}: size must be {expected_size}, got {img.size}"

    off_palette = 0
    bad_alpha = 0
    pure_black = 0
    used_colors: set[tuple[int, int, int]] = set()
    transparent_px = 0
    opaque_px = 0

    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a == 0:
                transparent_px += 1
                continue
            if a != 255:
                bad_alpha += 1
            opaque_px += 1
            if (r, g, b) == (0, 0, 0):
                pure_black += 1
            if (r, g, b) not in allowed_rgb:
                off_palette += 1
            used_colors.add((r, g, b))

    assert off_palette == 0, f"{name}: {off_palette} off-palette pixels!"
    assert bad_alpha == 0, f"{name}: {bad_alpha} non-binary alpha pixels!"
    assert pure_black == 0, f"{name}: {pure_black} pure #000000 pixels!"
    assert 60 <= len(used_colors) <= 95, (
        f"{name}: unique color count {len(used_colors)} outside target [60..95]!"
    )

    return {
        "name": name,
        "size": f"{img.width}x{img.height}",
        "unique_colors": len(used_colors),
        "opaque_px": opaque_px,
        "transparent_px": transparent_px,
        "off_palette": off_palette,
        "bad_alpha": bad_alpha,
        "pure_black": pure_black,
        "status": "PASS",
    }


def make_preview_sheet(magic: Image.Image, apothecary: Image.Image) -> Image.Image:
    scale = 3
    m_w3, m_h3 = magic.width * scale, magic.height * scale        # 192 x 336
    a_w3, a_h3 = apothecary.width * scale, apothecary.height * scale  # 144 x 336

    pad = 28
    gap = 36
    top_bar = 40
    # Include 3x individual cards + 2x wall-to-wall street pair + 1x native sprites
    pair_w2 = (magic.width + apothecary.width) * 2  # 224
    pair_h2 = 112 * 2                               # 224
    sheet_w = pad * 2 + m_w3 + gap + a_w3 + gap + pair_w2
    sheet_h = top_bar + m_h3 + pad

    c_dark = (0x23, 0x26, 0x2E, 255)
    c_lite = (0x2B, 0x2F, 0x39, 255)
    sheet = Image.new("RGBA", (sheet_w, sheet_h), c_dark)
    spx = sheet.load()
    cell = 12
    for y in range(sheet_h):
        for x in range(sheet_w):
            if ((x // cell) + (y // cell)) % 2 == 1:
                spx[x, y] = c_lite

    draw = ImageDraw.Draw(sheet)
    draw.rectangle([0, 0, sheet_w, top_bar - 8], fill=(0x19, 0x1C, 0x22, 255))
    draw.text((pad, 10), "ft-magic.png (64x112, 3x)", fill=(235, 238, 245, 255))
    draw.text((pad + m_w3 + gap, 10), "ft-apothecary.png (48x112, 3x)", fill=(235, 238, 245, 255))
    x_pair = pad + m_w3 + gap + a_w3 + gap
    draw.text((x_pair, 10), "Wall-to-Wall Street Row (2x & 1x)", fill=(190, 210, 230, 255))

    m3 = magic.resize((m_w3, m_h3), Image.Resampling.NEAREST)
    a3 = apothecary.resize((a_w3, a_h3), Image.Resampling.NEAREST)
    sheet.alpha_composite(m3, (pad, top_bar))
    sheet.alpha_composite(a3, (pad + m_w3 + gap, top_bar))

    # 2x Wall-to-wall street pair check (verifying y=42 & y=74 alignment)
    m2 = magic.resize((magic.width * 2, magic.height * 2), Image.Resampling.NEAREST)
    a2 = apothecary.resize((apothecary.width * 2, apothecary.height * 2), Image.Resampling.NEAREST)
    sheet.alpha_composite(m2, (x_pair, top_bar))
    sheet.alpha_composite(a2, (x_pair + magic.width * 2, top_bar))

    # 1x native resolution below the 2x pair
    y_1x = top_bar + pair_h2 + 16
    sheet.alpha_composite(magic, (x_pair, y_1x))
    sheet.alpha_composite(apothecary, (x_pair + magic.width + 8, y_1x))

    return sheet.convert("RGB")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)

    ramps, allowed_rgb = load_palette()

    magic = build_ft_magic(ramps)
    apothecary = build_ft_apothecary(ramps)

    magic_path = OUT_DIR / "ft-magic.png"
    apoth_path = OUT_DIR / "ft-apothecary.png"
    magic.save(magic_path)
    apothecary.save(apoth_path)

    stats_m = verify_building("ft-magic.png", magic, (64, 112), allowed_rgb)
    stats_a = verify_building("ft-apothecary.png", apothecary, (48, 112), allowed_rgb)

    preview = make_preview_sheet(magic, apothecary)
    preview.save(PREVIEW_PATH)

    print("=== T4 FANTASY TOWN BATCH 3 VERIFICATION ===")
    print(json.dumps([stats_m, stats_a], indent=2))


if __name__ == "__main__":
    main()
