#!/usr/bin/env python3
"""
T4 Fantasy Town Fable-Grade Buildings Batch 4/5
Generates:
  1. ft-chapel.png     (80x112 RGBA, 5x7 tiles) - Sanctuary Stone Chapel (성당)
  2. ft-clocktower.png (48x128 RGBA, 3x8 tiles) - Grand Town Clock Tower (마을 시계탑)
  3. preview_batch4.png (3x preview sheet on #23262e checkerboard)

100% locked to tiledata/jp-city/fable-city/palette.json
Zero off-palette pixels, zero #000000, strict binary alpha {0, 255}.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
PALETTE_PATH = ROOT / "tiledata/jp-city/fable-city/palette.json"
OUT_DIR = ROOT / "tiledata/fantasy-town-carbon/buildings"
PREVIEW_PATH = ROOT / "tiledata/fantasy-town-carbon/preview_batch4.png"


def hex_to_rgba(h: str, alpha: int = 255) -> tuple[int, int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


def load_palette() -> tuple[dict[str, list[tuple[int, int, int, int]]], set[tuple[int, int, int]]]:
    data = json.loads(PALETTE_PATH.read_text(encoding="utf-8"))
    ramps: dict[str, list[tuple[int, int, int, int]]] = {}
    allowed: set[tuple[int, int, int]] = set()
    for name, hex_list in data["ramps"].items():
        ramp = []
        for h in hex_list:
            c = hex_to_rgba(h, 255)
            ramp.append(c)
            allowed.add((c[0], c[1], c[2]))
        ramps[name] = ramp
    return ramps, allowed


def det_hash(x: int, y: int, seed: int = 0) -> int:
    n = (x * 374761393 + y * 668265263 + seed * 1442695041) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return (n ^ (n >> 16)) & 0xFFFFFFFF


class PixelCanvas:
    def __init__(self, w: int, h: int, ramps: dict[str, list[tuple[int, int, int, int]]]):
        self.w = w
        self.h = h
        self.ramps = ramps
        self.img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.px = self.img.load()

    def c(self, ramp: str, idx: int) -> tuple[int, int, int, int]:
        r = self.ramps[ramp]
        idx = max(0, min(len(r) - 1, idx))
        return r[idx]

    def set(self, x: int, y: int, color: tuple[int, int, int, int] | None) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            if color is None:
                self.px[x, y] = (0, 0, 0, 0)
            else:
                self.px[x, y] = (color[0], color[1], color[2], 255)

    def get(self, x: int, y: int) -> tuple[int, int, int, int]:
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[x, y]
        return (0, 0, 0, 0)

    def hline(self, x0: int, x1: int, y: int, color: tuple[int, int, int, int]) -> None:
        if x0 > x1:
            x0, x1 = x1, x0
        for x in range(x0, x1 + 1):
            self.set(x, y, color)

    def vline(self, x: int, y0: int, y1: int, color: tuple[int, int, int, int]) -> None:
        if y0 > y1:
            y0, y1 = y1, y0
        for y in range(y0, y1 + 1):
            self.set(x, y, color)

    def rect(self, x0: int, y0: int, x1: int, y1: int, color: tuple[int, int, int, int]) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, color)


def draw_ashlar_wall(
    cv: PixelCanvas,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    row_h: int = 5,
    block_w: int = 8,
    style: str = "limestone",
    light_cx: float = 24.0,
    seed: int = 11,
    lanterns: list[tuple[float, float, float]] | None = None,
) -> None:
    """Fills [x0..x1, y0..y1] with Fable-grade bevelled ashlar stone masonry + optional warm lantern bounce."""
    lanterns = lanterns or []
    for y in range(y0, y1 + 1):
        course = (y - y0) // row_h
        ry = (y - y0) % row_h
        stagger = (block_w // 2) if (course % 2 == 1) else 0
        for x in range(x0, x1 + 1):
            bx = (x - x0 + stagger) // block_w
            rx = (x - x0 + stagger) % block_w
            h = det_hash(bx, course, seed)
            px_h = det_hash(x, y, seed + 7)

            right_bias = 1 if x > light_cx + 8 else 0

            # Check warm bounce light from nearby sconces/street-lamps (preserving mortar joints!)
            warm_lv = 0
            for lx_c, ly_c, rad in lanterns:
                d = math.hypot(x - lx_c, y - ly_c)
                if d <= rad * 0.55:
                    warm_lv = max(warm_lv, 2)
                elif d <= rad:
                    warm_lv = max(warm_lv, 1)

            if style == "limestone":
                fam_sel = h % 5
                if fam_sel in (0, 1):
                    fam, base = "stone", 5 - right_bias
                elif fam_sel == 2:
                    fam, base = "kinari", 4 - right_bias
                elif fam_sel == 3:
                    fam, base = "white", 4 - right_bias
                else:
                    fam, base = "cream", 4 - right_bias

                if warm_lv == 2:
                    fam, base = "cream", 5
                elif warm_lv == 1 and fam in ("stone", "white"):
                    fam, base = "kinari", 4

                if ry == row_h - 1 or rx == block_w - 1:
                    # Mortar joint stays intact even in lantern glow!
                    if warm_lv >= 1:
                        col = cv.c("kinari", 2 if warm_lv == 2 else 1)
                    else:
                        m_fam = "stone" if (h % 2 == 0) else "concrete"
                        m_idx = 2 if (ry == row_h - 1 and rx == block_w - 1) else (3 - right_bias)
                        col = cv.c(m_fam, max(1, m_idx))
                elif ry == 0:
                    if warm_lv >= 1:
                        col = cv.c("cream", 6 if warm_lv == 2 else 5)
                    else:
                        col = cv.c("white", 6 if (rx == 0 and not right_bias) else (5 - right_bias))
                else:
                    delta = 1 if rx == 0 else (-1 if (rx == block_w - 2 and ry >= row_h - 2) else 0)
                    if px_h % 13 == 0:
                        delta -= 1
                    col = cv.c(fam, base + delta)

            else:
                # Rusticated darker base stone (stone, pavement, flagstone, concrete)
                fam_sel = h % 4
                if fam_sel == 0:
                    fam, base = "pavement", 4 - right_bias
                elif fam_sel == 1:
                    fam, base = "stone", 4 - right_bias
                elif fam_sel == 2:
                    fam, base = "flagstone", 4 - right_bias
                else:
                    fam, base = "concrete", 4 - right_bias

                if warm_lv == 2:
                    fam, base = "cream", 4
                elif warm_lv == 1:
                    fam, base = "kinari", 3

                if ry == row_h - 1 or rx == block_w - 1:
                    if warm_lv >= 1:
                        col = cv.c("stone", 2)
                    else:
                        col = cv.c("pavement" if (h % 2 == 0) else "stone", 1)
                elif ry == 0 or rx == 0:
                    col = cv.c(fam, base + 1)
                elif ry == row_h - 2 or rx == block_w - 2:
                    col = cv.c(fam, base - 1)
                else:
                    delta = -1 if (px_h % 11 == 0) else 0
                    col = cv.c(fam, base + delta)

            cv.set(x, y, col)


# ==============================================================================
# 1. FT-CHAPEL (80x112 RGBA, 5x7 tiles) - Sanctuary Stone Chapel
# ==============================================================================
def build_chapel(ramps: dict[str, list[tuple[int, int, int, int]]]) -> Image.Image:
    W, H = 80, 112
    cv = PixelCanvas(W, H, ramps)

    # ------------------------------------------------------------------
    # A. 3/4 ROYAL-BLUE / SLATE ROOF DECK & SIDE AISLE SLOPES (y=13..45)
    # ------------------------------------------------------------------
    for y in range(14, 45):
        t = (y - 14) / 30.0
        half_w = int(round(26 + t * 12))  # 26 -> 38 (x=1..78)
        lx = 39 - half_w
        rx = 40 + half_w

        for x in range(lx, rx + 1):
            is_right = x >= 40
            course = (y - 14) // 4
            ry = (y - 14) % 4
            stagger = 2 if (course % 2 == 1) else 0
            tx = (x + stagger) % 4
            th = det_hash(x // 4, course, 101)

            if not is_right:
                if ry == 0:
                    col = cv.c("navy", 1)
                elif ry == 3:
                    if tx in (1, 2):
                        col = cv.c("blue" if th % 3 != 0 else "tile", 5 if y < 28 else 4)
                    else:
                        col = cv.c("navy", 1)
                elif tx == 0:
                    col = cv.c("navy" if th % 2 == 0 else "blue", 1)
                else:
                    fam = "blue" if (th % 2 == 0) else "tile"
                    shade = 4 if (ry == 2 and tx == 1) else 3
                    if y < 20:
                        shade = min(5, shade + 1)
                    col = cv.c(fam, shade)
            else:
                if ry == 0:
                    col = cv.c("navy", 0)
                elif ry == 3:
                    if tx in (1, 2):
                        col = cv.c("blue" if th % 2 == 0 else "tile", 3)
                    else:
                        col = cv.c("navy", 0)
                elif tx == 3:
                    col = cv.c("navy", 0)
                else:
                    fam = "navy" if (th % 3 == 0) else ("blue" if th % 2 == 0 else "tile")
                    shade = 2 if ry == 2 else 1
                    if fam == "navy":
                        shade += 1
                    col = cv.c(fam, shade)

            cv.set(x, y, col)

        cv.set(lx, y, cv.c("navy", 0))
        cv.set(rx, y, cv.c("ink", 0))
        if lx + 1 < 40:
            cv.set(lx + 1, y, cv.c("blue", 4 if y % 4 != 0 else 2))
        if rx - 1 >= 40:
            cv.set(rx - 1, y, cv.c("tile", 2 if y % 4 != 0 else 1))

    # Ornamental roof ridge crest at y=12..15 (x=14..65)
    for x in range(14, 66):
        cv.set(x, 13, cv.c("navy", 0))
        if x % 4 == 0:
            cv.set(x, 12, cv.c("tile", 5 if x < 40 else 3))
            cv.set(x, 13, cv.c("tile", 6 if x < 40 else 4))
        cv.set(x, 14, cv.c("blue" if x < 40 else "tile", 5 if x < 40 else 4))
        cv.set(x, 15, cv.c("navy", 1))
    for fx in (14, 65):
        cv.set(fx, 11, cv.c("yellow", 4 if fx < 40 else 3))
        cv.set(fx, 12, cv.c("orange", 3))

    cv.hline(1, 39, 43, cv.c("tile", 5))
    cv.hline(40, 78, 43, cv.c("tile", 3))
    cv.hline(1, 78, 44, cv.c("navy", 1))
    cv.hline(1, 78, 45, cv.c("ink", 0))

    # ------------------------------------------------------------------
    # B. NAVE BODY & STEPPED STONE GABLE COPING (y=22..107)
    # ------------------------------------------------------------------
    sconces_glow = [(20.0, 87.0, 6.2), (59.0, 87.0, 6.2)]
    draw_ashlar_wall(cv, 11, 44, 68, 76, row_h=5, block_w=8, style="limestone", light_cx=36.0, seed=21)
    draw_ashlar_wall(cv, 11, 77, 68, 97, row_h=5, block_w=9, style="limestone", light_cx=36.0, seed=33, lanterns=sconces_glow)
    draw_ashlar_wall(cv, 11, 98, 68, 107, row_h=5, block_w=9, style="rusticated", light_cx=36.0, seed=45)

    # Steep ㅅ-gable triangular upper wall + STEPPED STONE GABLE COPING (y=22..44)
    for y in range(22, 45):
        # Quantize step every 3px vertically for authentic stepped stone gable coping!
        step_idx = (y - 22) // 3
        step_ry = (y - 22) % 3
        span_smooth = int(round((y - 22) * (29.0 / 22.0)))
        span_step = min(30, 3 + step_idx * 4)
        gx0_in = 39 - span_smooth
        gx1_in = 40 + span_smooth
        gx0_out = 39 - span_step
        gx1_out = 40 + span_step

        # Fill limestone inside gable triangle
        for x in range(gx0_in + 2, gx1_in - 1):
            course = (y - 22) // 4
            ry = (y - 22) % 4
            bx = (x + (4 if course % 2 else 0)) // 7
            rx = (x + (4 if course % 2 else 0)) % 7
            h = det_hash(bx, course, 55)
            is_r = x >= 40
            if ry == 3 or rx == 6:
                col = cv.c("stone", 3 if not is_r else 2)
            elif ry == 0:
                col = cv.c("white", 5 if not is_r else 4)
            else:
                fam = "kinari" if h % 3 == 0 else ("white" if h % 2 == 0 else "stone")
                idx = (5 if fam == "stone" else 4) - (1 if is_r else 0)
                col = cv.c(fam, idx)
            cv.set(x, y, col)

        # Deep 2px roof-overhang shadow right beneath the raking gable coping!
        for sx in (gx0_in + 2, gx0_in + 3):
            if sx <= gx1_in - 2:
                cv.set(sx, y, cv.c("stone", 2 if sx == gx0_in + 3 else 1))
        for sx in (gx1_in - 3, gx1_in - 2):
            if sx >= gx0_in + 2:
                cv.set(sx, y, cv.c("stone", 1))

        # Stepped Stone Gable Coping blocks on left & right raking slopes!
        # Left stepped block [gx0_out .. gx0_in+1]
        lo = min(gx0_out, gx0_in - 1)
        hi = gx0_in + 1
        cv.set(lo - 1, y, cv.c("ink", 0))
        for x in range(lo, hi + 1):
            if step_ry == 0:
                cv.set(x, y, cv.c("white", 6))  # crisp horizontal step cap!
            elif x == lo:
                cv.set(x, y, cv.c("white", 5))
            elif x == hi:
                cv.set(x, y, cv.c("stone", 4))
            else:
                cv.set(x, y, cv.c("cream", 5))

        # Right stepped block [gx1_in-1 .. gx1_out]
        rlo = gx1_in - 1
        rhi = max(gx1_out, gx1_in + 1)
        cv.set(rhi + 1, y, cv.c("ink", 0))
        for x in range(rlo, rhi + 1):
            if step_ry == 0:
                cv.set(x, y, cv.c("white", 5))  # sunlit top of right crow-step!
            elif x == rhi:
                cv.set(x, y, cv.c("concrete", 2))
            elif x == rlo:
                cv.set(x, y, cv.c("stone", 3))
            else:
                cv.set(x, y, cv.c("stone", 4))

    # Carved Gothic Trefoil / Golden Sunburst Medallion in upper gable (cx=39.5, cy=35.5)
    for y in range(31, 41):
        for x in range(35, 45):
            d = math.hypot(x - 39.5, y - 35.5)
            if 3.4 <= d <= 4.6:
                cv.set(x, y, cv.c("white" if (x + y) < 75 else "stone", 6 if (x + y) < 75 else 3))
            elif 2.2 < d < 3.4:
                cv.set(x, y, cv.c("navy", 1))
            elif d <= 2.2:
                cv.set(x, y, cv.c("yellow" if x <= 39 else "orange", 4 if x <= 39 else 3))

    # Moulded horizontal dentil cornice under gable base (y=43..46, x=10..69)
    cv.hline(10, 39, 43, cv.c("white", 6))
    cv.hline(40, 69, 43, cv.c("white", 4))
    for x in range(11, 69):
        is_r = x >= 40
        if x % 3 == 0:
            cv.set(x, 44, cv.c("stone", 2 if not is_r else 1))
        else:
            cv.set(x, 44, cv.c("cream" if not is_r else "stone", 4))
        cv.set(x, 45, cv.c("stone", 1))
        cv.set(x, 46, cv.c("concrete", 2 if not is_r else 1))

    # ------------------------------------------------------------------
    # C. STEPPED SIDE STONE BUTTRESSES (Left x=1..12, Right x=67..78, y=45..108)
    # ------------------------------------------------------------------
    stages = [
        (45, 64, 4, 11, 68, 75),
        (65, 85, 3, 11, 68, 76),
        (86, 108, 1, 11, 68, 78),
    ]
    for si, (sy0, sy1, lx0, lx1, rx0, rx1) in enumerate(stages):
        style = "rusticated" if si == 2 else "limestone"
        draw_ashlar_wall(cv, lx0 + 1, sy0 + 4, lx1, sy1, row_h=5, block_w=6, style=style, light_cx=36.0, seed=60 + si)
        draw_ashlar_wall(cv, rx0, sy0 + 4, rx1 - 1, sy1, row_h=5, block_w=6, style=style, light_cx=36.0, seed=70 + si)

        for dy in range(4):
            y = sy0 + dy
            inset = (3 - dy) if si > 0 else (2 - dy // 2)
            cl0 = lx0 + max(0, inset // 2)
            cv.set(cl0, y, cv.c("ink", 0))
            for x in range(cl0 + 1, lx1 + 1):
                if dy == 0:
                    cv.set(x, y, cv.c("white", 6))
                elif dy == 1:
                    cv.set(x, y, cv.c("blue", 4))  # slate drip-cap course!
                elif dy == 2:
                    cv.set(x, y, cv.c("cream", 5))
                else:
                    cv.set(x, y, cv.c("stone", 2))

            cr1 = rx1 - max(0, inset // 2)
            cv.set(cr1, y, cv.c("ink", 0))
            for x in range(rx0, cr1):
                if dy == 0:
                    cv.set(x, y, cv.c("white", 4))
                elif dy == 1:
                    cv.set(x, y, cv.c("tile", 3))
                elif dy == 2:
                    cv.set(x, y, cv.c("stone", 4))
                else:
                    cv.set(x, y, cv.c("pavement", 1))

        for y in range(sy0 + 4, sy1 + 1):
            cv.set(lx0, y, cv.c("ink", 0))
            cv.set(lx0 + 1, y, cv.c("white" if si < 2 else "stone", 5))
            cv.set(lx1, y, cv.c("stone", 2))
            cv.set(lx1 + 1, y, cv.c("stone", 2 if si < 2 else 1))
            if y > sy0 + 5:
                cv.set(lx1 + 2, y, cv.c("concrete", 2))

            cv.set(rx0, y, cv.c("white", 4 if si < 2 else 3))
            cv.set(rx1 - 1, y, cv.c("pavement", 1))
            cv.set(rx1, y, cv.c("ink", 0))

    # Pinnacle finials atop upper buttress shoulders (y=38..44, x=5..9 and x=70..74)
    for is_r, px0 in ((False, 5), (True, 70)):
        cv.set(px0 + 2, 38, cv.c("yellow", 4 if not is_r else 3))
        cv.hline(px0 + 1, px0 + 3, 39, cv.c("white", 5 if not is_r else 4))
        for py in range(40, 45):
            cv.set(px0, py, cv.c("ink", 0))
            cv.set(px0 + 1, py, cv.c("white", 5 if not is_r else 4))
            cv.set(px0 + 2, py, cv.c("stone", 5 if not is_r else 3))
            cv.set(px0 + 3, py, cv.c("concrete", 3 if not is_r else 2))
            cv.set(px0 + 4, py, cv.c("ink", 0))

    # ------------------------------------------------------------------
    # D. BELL-COT BELFRY & GOLDEN SUN-CROSS FINIAL (y=0..28, x=30..49)
    # ------------------------------------------------------------------
    cross_pts = [
        (39, 0), (40, 0),
        (39, 1), (40, 1),
        (38, 2), (39, 2), (40, 2), (41, 2),
        (36, 3), (37, 3), (38, 3), (39, 3), (40, 3), (41, 3), (42, 3), (43, 3),
        (36, 4), (37, 4), (38, 4), (39, 4), (40, 4), (41, 4), (42, 4), (43, 4),
        (38, 5), (39, 5), (40, 5), (41, 5),
        (39, 6), (40, 6),
        (39, 7), (40, 7),
        (38, 8), (39, 8), (40, 8), (41, 8),
    ]
    for cx_p, cy_p in cross_pts:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                nx, ny = cx_p + dx, cy_p + dy
                if 0 <= ny <= 9 and cv.get(nx, ny)[3] == 0:
                    cv.set(nx, ny, cv.c("ink", 0))
    for cx_p, cy_p in cross_pts:
        if (cx_p, cy_p) in ((39, 3), (39, 4), (39, 1), (37, 3)):
            cv.set(cx_p, cy_p, cv.c("yellow", 5))
        elif cx_p <= 39:
            cv.set(cx_p, cy_p, cv.c("yellow", 4))
        elif cy_p >= 6:
            cv.set(cx_p, cy_p, cv.c("orange", 3))
        else:
            cv.set(cx_p, cy_p, cv.c("yellow", 3))
    for rx_p, ry_p in ((37, 2), (42, 2), (37, 5), (42, 5)):
        cv.set(rx_p, ry_p, cv.c("orange", 4))

    for y in range(9, 16):
        hw = 2 + (y - 9)
        bx0, bx1 = 39 - hw, 40 + hw
        cv.set(bx0 - 1, y, cv.c("ink", 0))
        cv.set(bx1 + 1, y, cv.c("ink", 0))
        for x in range(bx0, bx1 + 1):
            if x <= bx0 + 1:
                cv.set(x, y, cv.c("white", 6))
            elif x >= bx1 - 1:
                cv.set(x, y, cv.c("concrete", 3))
            elif y <= 11:
                cv.set(x, y, cv.c("blue", 4 if x < 40 else 2))
            else:
                cv.set(x, y, cv.c("stone", 5 if x < 40 else 3))

    for y in range(15, 27):
        cv.set(31, y, cv.c("ink", 0))
        cv.set(48, y, cv.c("ink", 0))
        for x in range(32, 48):
            is_r = x >= 40
            if y % 3 == 0:
                cv.set(x, y, cv.c("stone", 3 if not is_r else 2))
            else:
                cv.set(x, y, cv.c("white" if not is_r else "stone", 5 if not is_r else 4))
        cv.set(32, y, cv.c("white", 6))
        cv.set(47, y, cv.c("concrete", 2))

    for y in range(15, 26):
        ax0, ax1 = (38, 41) if y == 15 else ((36, 43) if y == 16 else (35, 44))
        cv.set(ax0 - 1, y, cv.c("stone", 3))
        cv.set(ax1 + 1, y, cv.c("white", 5))
        for x in range(ax0, ax1 + 1):
            cv.set(x, y, cv.c("navy", 0 if y < 20 else 1))

    cv.hline(38, 41, 16, cv.c("steel", 3))
    cv.hline(39, 40, 17, cv.c("steel", 4))
    bell_rows = [
        (18, 38, 41),
        (19, 37, 42),
        (20, 37, 42),
        (21, 37, 42),
        (22, 36, 43),
        (23, 36, 43),
    ]
    for by, bx0, bx1 in bell_rows:
        for bx in range(bx0, bx1 + 1):
            rel = bx - bx0
            if rel == 0:
                col = cv.c("yellow", 4)
            elif rel == 1:
                col = cv.c("yellow", 5)
            elif bx == bx1:
                col = cv.c("cha", 3)
            elif bx == bx1 - 1:
                col = cv.c("orange", 2)
            else:
                col = cv.c("yellow" if by < 22 else "orange", 3)
            cv.set(bx, by, col)
    cv.hline(36, 39, 23, cv.c("yellow", 5))
    cv.set(39, 24, cv.c("yellow", 5))
    cv.set(40, 24, cv.c("orange", 3))

    cv.set(30, 26, cv.c("ink", 0))
    cv.hline(31, 39, 26, cv.c("white", 6))
    cv.hline(40, 48, 26, cv.c("white", 4))
    cv.set(49, 26, cv.c("ink", 0))
    cv.hline(31, 48, 27, cv.c("stone", 3))
    for x in range(32, 48, 3):
        cv.set(x, 28, cv.c("stone", 1))

    # ------------------------------------------------------------------
    # E. CENTRAL JEWEL-TONED STAINED-GLASS ROSE WINDOW (cx=39.5, cy=58.5)
    # ------------------------------------------------------------------
    rcx, rcy = 39.5, 58.5
    for y in range(47, 71):
        for x in range(28, 52):
            dx = x - rcx
            dy = y - rcy
            dist = math.hypot(dx, dy)
            if dist <= 11.2:
                ang = math.degrees(math.atan2(dy, dx)) % 360.0
                if dist >= 9.8:
                    if dy < 0 and dx < 2:
                        cv.set(x, y, cv.c("white", 6))
                    elif dy > 2 and dx > 0:
                        cv.set(x, y, cv.c("stone", 1))
                    else:
                        cv.set(x, y, cv.c("stone", 4 if dx < 0 else 2))
                elif dist >= 8.3:
                    cusp = int(round(ang / 45.0)) * 45.0
                    if abs(((ang - cusp + 180) % 360) - 180) < 8:
                        cv.set(x, y, cv.c("cream", 4 if dx < 0 else 2))
                    else:
                        cv.set(x, y, cv.c("ink", 1))
                elif dist <= 1.8:
                    cv.set(x, y, cv.c("yellow", 5 if dx <= 0 else 4))
                elif 1.8 < dist <= 2.7:
                    cv.set(x, y, cv.c("ink", 0))
                else:
                    sector = int(((ang + 22.5) % 360.0) // 45.0)
                    sector_center = sector * 45.0
                    ang_diff = abs(((ang - sector_center + 180) % 360) - 180)
                    if ang_diff > 17.5 or (5.3 <= dist <= 6.0):
                        cv.set(x, y, cv.c("kuro", 0))
                    else:
                        bright = 1 if (dx + dy < -1.5) else (0 if (dx + dy < 3.5) else -1)
                        if sector in (0, 4):
                            cv.set(x, y, cv.c("red" if bright <= 0 else "pink", 4 + bright))
                        elif sector in (2, 6):
                            cv.set(x, y, cv.c("blue" if bright < 1 else "glass", 4 + bright))
                        elif sector in (1, 5):
                            cv.set(x, y, cv.c("yellow" if bright >= 0 else "orange", 4 + max(0, bright)))
                        else:
                            cv.set(x, y, cv.c("teal", 4 + bright))

    # ------------------------------------------------------------------
    # F. TWO TALL GOTHIC LANCET WINDOWS (Left x=16..24, Right x=55..63, y=50..73)
    # ------------------------------------------------------------------
    for wx0 in (16, 55):
        wx1 = wx0 + 8
        wcx = wx0 + 4
        for y in range(50, 73):
            dy = y - 50
            span = 1 if dy == 0 else (2 if dy == 1 else (3 if dy == 2 else 4))
            lx, rx = wcx - span, wcx + span
            cv.set(lx - 1, y, cv.c("stone", 2))
            cv.set(rx + 1, y, cv.c("white", 5 if wx0 < 40 else 4))
            for x in range(lx, rx + 1):
                if x == lx or x == rx or dy == 0:
                    cv.set(x, y, cv.c("ink", 0))
                elif dy in (2, 3) and abs(x - wcx) == 2:
                    # Gothic cusped trefoil tracery at top of lancet!
                    cv.set(x, y, cv.c("kuro", 0))
                elif dy <= 4:
                    # Golden/ruby/sapphire trefoil head jewel!
                    cv.set(x, y, cv.c("yellow" if x == wcx else "red", 4))
                else:
                    # Jewel-like diamond stained-glass lattice!
                    gx = x - wcx
                    gy = y - 55
                    if x == wcx or (abs(gx) + gy) % 5 == 0:
                        cv.set(x, y, cv.c("kuro", 0 if x == wcx else 1))
                    else:
                        cell = (gy // 4 + (0 if x < wcx else 1)) % 4
                        shine = 1 if (x < wcx and gy % 4 == 1) else 0
                        if cell == 0:
                            cv.set(x, y, cv.c("blue", 3 + shine))
                        elif cell == 1:
                            cv.set(x, y, cv.c("teal", 3 + shine))
                        elif cell == 2:
                            cv.set(x, y, cv.c("glass", 4 + shine))
                        else:
                            cv.set(x, y, cv.c("red" if gy > 8 else "yellow", 3 + shine))

        cv.hline(wx0 - 1, wx1 + 1, 72, cv.c("white", 6 if wx0 < 40 else 4))
        cv.hline(wx0 - 1, wx1 + 1, 73, cv.c("stone", 3))
        cv.hline(wx0, wx1 + 2, 74, cv.c("stone", 1))

    # ------------------------------------------------------------------
    # G. CARVED TRIFORIUM STRINGCOURSE CORNICE (y=75..78, x=12..67)
    # ------------------------------------------------------------------
    cv.hline(12, 39, 75, cv.c("white", 6))
    cv.hline(40, 67, 75, cv.c("white", 4))
    for x in range(12, 68):
        is_r = x >= 40
        if x % 4 == 1:
            cv.set(x, 76, cv.c("yellow", 3 if not is_r else 2))
        elif x % 2 == 0:
            cv.set(x, 76, cv.c("stone", 4 if not is_r else 3))
        else:
            cv.set(x, 76, cv.c("stone", 2))
        cv.set(x, 77, cv.c("concrete", 2 if not is_r else 1))
        cv.set(x, 78, cv.c("stone", 1))

    # ------------------------------------------------------------------
    # H. DEEPLY RECESSED GOTHIC PORTAL ARCHIVOLTS & TWIN OAK DOORS (y=72..105)
    # ------------------------------------------------------------------
    # Golden Gothic portal fleuron finial crowning the outer archivolt apex (y=71..74)
    cv.hline(39, 40, 71, cv.c("yellow", 5))
    cv.hline(38, 41, 72, cv.c("yellow", 4))
    cv.hline(39, 40, 73, cv.c("orange", 3))

    for y in range(74, 106):
        for x in range(25, 55):
            dx = abs(x - 39.5)
            if y < 88:
                dy = 88 - y
                r_eff = math.hypot(dx * 1.12, dy * 0.92)
                if r_eff <= 15.2:
                    is_r = x >= 40
                    if r_eff >= 13.4:
                        v = int(y + dx) % 3
                        cv.set(x, y, cv.c("white" if (not is_r and v != 0) else "stone", 5 if v != 0 else 3))
                    elif r_eff >= 12.2:
                        cv.set(x, y, cv.c("stone", 1))
                    elif r_eff >= 10.4:
                        v = int(y + dx) % 2
                        cv.set(x, y, cv.c("cream" if not is_r else "concrete", 4 if v == 0 else 3))
                    elif r_eff >= 9.3:
                        cv.set(x, y, cv.c("ink", 1))
            else:
                if 25 <= x <= 26:
                    cv.set(x, y, cv.c("white" if x == 25 else "stone", 5 if y % 4 != 0 else 3))
                elif x == 27:
                    cv.set(x, y, cv.c("stone", 1))
                elif 28 <= x <= 29:
                    cv.set(x, y, cv.c("cream" if x == 28 else "stone", 4))
                elif x == 30:
                    cv.set(x, y, cv.c("ink", 0))
                elif x == 49:
                    cv.set(x, y, cv.c("ink", 0))
                elif 50 <= x <= 51:
                    cv.set(x, y, cv.c("concrete", 3 if x == 50 else 4))
                elif x == 52:
                    cv.set(x, y, cv.c("stone", 1))
                elif 53 <= x <= 54:
                    cv.set(x, y, cv.c("stone" if x == 53 else "white", 3 if x == 53 else 4))

    for cx_j in (25, 26, 28, 29, 50, 51, 53, 54):
        cv.set(cx_j, 87, cv.c("yellow" if cx_j < 40 else "cream", 4 if cx_j < 40 else 3))
        cv.set(cx_j, 88, cv.c("stone", 2))

    # Twin Oak Sanctuary Doors (x=31..48, y=80..105 -> 18px wide x 26px tall)
    for y in range(80, 106):
        for x in range(31, 49):
            dx = abs(x - 39.5)
            if y < 88:
                r_eff = math.hypot(dx * 1.12, (88 - y) * 0.92)
                if r_eff > 9.3:
                    continue
                if r_eff > 8.3:
                    cv.set(x, y, cv.c("ink", 0))
                    continue

            if x in (31, 48) or y == 105 or x == 39:
                cv.set(x, y, cv.c("darkwood", 0))
            elif x == 40:
                cv.set(x, y, cv.c("wood", 4 if y > 84 else 3))
            else:
                plank = (x - 31) % 3
                grain = det_hash(x, y // 3, 91) % 3
                is_r = x >= 40
                if y <= 84:
                    if abs(x - 39.5) < 3.0 and 81 <= y <= 83:
                        cv.set(x, y, cv.c("yellow", 4 if x <= 39 else 3))
                    else:
                        cv.set(x, y, cv.c("darkwood", 2 if not is_r else 1))
                elif y == 85:
                    cv.set(x, y, cv.c("cedar", 4 if not is_r else 3))
                elif plank == 0:
                    cv.set(x, y, cv.c("darkwood", 2))
                else:
                    base_w = 4 if not is_r else 3
                    col = cv.c("wood", base_w + 1) if grain == 0 else (cv.c("cedar", base_w) if grain == 1 else cv.c("wood", base_w))
                    cv.set(x, y, col)

    for hy in (89, 99):
        for hx in range(32, 38):
            cv.set(hx, hy, cv.c("steel", 3 if hx < 36 else 4))
            cv.set(hx, hy + 1, cv.c("kuro", 1))
        cv.set(37, hy - 1, cv.c("steel", 3))
        cv.set(37, hy + 1, cv.c("steel", 2))
        for hx in range(42, 48):
            cv.set(hx, hy, cv.c("steel", 3 if hx > 43 else 4))
            cv.set(hx, hy + 1, cv.c("kuro", 1))
        cv.set(42, hy - 1, cv.c("steel", 3))
        cv.set(42, hy + 1, cv.c("steel", 2))

    for kx in (37, 42):
        cv.set(kx, 94, cv.c("yellow", 5))
        cv.set(kx, 95, cv.c("orange", 4))
        cv.set(kx, 96, cv.c("yellow", 3))

    # ------------------------------------------------------------------
    # I. WARM SANCTUARY LANTERN SCONCES (x=18..22 and x=57..61, y=82..91)
    # ------------------------------------------------------------------
    for lx_c in (20, 59):
        cv.set(lx_c, 82, cv.c("kuro", 0))
        cv.hline(lx_c - 1, lx_c + 1, 83, cv.c("steel", 2))
        cv.hline(lx_c - 2, lx_c + 2, 84, cv.c("kuro", 0))
        for ly in range(85, 90):
            cv.set(lx_c - 2, ly, cv.c("kuro", 1))
            cv.set(lx_c + 2, ly, cv.c("kuro", 0))
            cv.set(lx_c - 1, ly, cv.c("yellow", 5 if ly <= 87 else 4))
            cv.set(lx_c, ly, cv.c("cream" if ly == 86 else "yellow", 6 if ly == 86 else 5))
            cv.set(lx_c + 1, ly, cv.c("orange", 4 if ly <= 87 else 3))
        cv.hline(lx_c - 1, lx_c + 1, 90, cv.c("kuro", 0))
        cv.set(lx_c, 91, cv.c("steel", 2))

    # ------------------------------------------------------------------
    # J. WIDE STONE ENTRANCE STEPS & WHITE LILY STONE PLANTERS (y=97..111)
    # ------------------------------------------------------------------
    steps_spec = [
        (105, 106, 26, 53),
        (107, 108, 23, 56),
        (109, 111, 20, 59),
    ]
    for si, (sy0, sy1, sx0, sx1) in enumerate(steps_spec):
        for x in range(sx0, sx1 + 1):
            is_r = x >= 40
            joint = (x + si * 3) % 7 == 0
            if x in (sx0, sx1):
                cv.set(x, sy0, cv.c("ink", 0))
            elif joint:
                cv.set(x, sy0, cv.c("stone", 4 if not is_r else 3))
            else:
                cv.set(x, sy0, cv.c("white" if not is_r else "cream", 6 if not is_r else 5))
        for y in range(sy0 + 1, sy1 + 1):
            for x in range(sx0, sx1 + 1):
                is_r = x >= 40
                joint = (x + si * 3) % 7 == 0
                if x in (sx0, sx1) or y == 111:
                    cv.set(x, y, cv.c("ink", 0))
                elif joint:
                    cv.set(x, y, cv.c("pavement", 2))
                else:
                    cv.set(x, y, cv.c("stone" if not is_r else "concrete", 4 if not is_r else 3))

    for is_r, px0, px1 in ((False, 10, 21), (True, 58, 69)):
        for y in range(98, 104):
            for x in range(px0 + 1, px1):
                h = det_hash(x, y, 202)
                if y == 98 and x in (px0 + 1, px1 - 1):
                    continue
                shade = (4 if y < 101 else 2) - (1 if is_r and x > (px0 + px1) // 2 else 0)
                cv.set(x, y, cv.c("foliage", max(1, shade)))

        lily_centers = [(px0 + 3, 99), (px0 + 6, 98), (px0 + 9, 100)]
        for lcx, lcy in lily_centers:
            cv.set(lcx, lcy - 1, cv.c("white", 6))
            cv.set(lcx - 1, lcy, cv.c("white", 6))
            cv.set(lcx + 1, lcy, cv.c("cream", 5))
            cv.set(lcx, lcy + 1, cv.c("kinari", 5))
            cv.set(lcx, lcy, cv.c("yellow", 5))

        cv.set(px0, 103, cv.c("ink", 0))
        cv.hline(px0 + 1, px1 - 1, 103, cv.c("white" if not is_r else "cream", 5))
        cv.set(px1, 103, cv.c("ink", 0))
        cv.hline(px0, px1, 104, cv.c("stone", 3))
        for y in range(105, 110):
            cv.set(px0, y, cv.c("ink", 0))
            cv.set(px1, y, cv.c("ink", 0))
            for x in range(px0 + 1, px1):
                if x in (px0 + 2, px1 - 2) and 106 <= y <= 108:
                    cv.set(x, y, cv.c("stone", 2))
                else:
                    cv.set(x, y, cv.c("stone" if not is_r else "concrete", 4 if x < (px0 + px1) // 2 else 3))
        cv.hline(px0, px1, 110, cv.c("ink", 0))

    for x in list(range(2, 11)) + list(range(69, 78)):
        if det_hash(x, 107, 303) % 3 == 0:
            cv.set(x, 107, cv.c("moss", 2 if x > 40 else 3))
        cv.set(x, 108, cv.c("moss" if x % 3 == 0 else "pavement", 1))
        cv.set(x, 109, cv.c("ink", 0))
    cv.set(1, 108, cv.c("ink", 0))
    cv.set(78, 108, cv.c("ink", 0))

    return cv.img


# ==============================================================================
# 2. FT-CLOCKTOWER (48x128 RGBA, 3x8 tiles) - Grand Town Clock Tower
# ==============================================================================
def build_clocktower(ramps: dict[str, list[tuple[int, int, int, int]]]) -> Image.Image:
    W, H = 48, 128
    cv = PixelCanvas(W, H, ramps)

    # ------------------------------------------------------------------
    # A. GLEAMING GOLDEN ROOSTER / STAR WEATHERVANE (y=0..10, x=17..30)
    # ------------------------------------------------------------------
    for y in range(1, 11):
        cv.set(23, y, cv.c("yellow" if y < 8 else "steel", 4 if y < 8 else 3))
        cv.set(24, y, cv.c("orange" if y < 8 else "kuro", 3 if y < 8 else 1))

    cv.hline(19, 28, 8, cv.c("yellow", 4))
    cv.set(18, 8, cv.c("yellow", 5))
    cv.set(19, 7, cv.c("yellow", 4))
    cv.set(19, 9, cv.c("orange", 3))
    cv.set(29, 8, cv.c("yellow", 5))  # star glint E

    rooster_px = [
        (22, 0, ("red", 4)), (23, 0, ("yellow", 5)),
        (20, 2, ("orange", 5)), (21, 2, ("yellow", 5)), (22, 1, ("yellow", 5)), (22, 2, ("yellow", 4)), (23, 2, ("yellow", 4)),
        (22, 3, ("yellow", 5)), (23, 3, ("yellow", 4)), (24, 3, ("orange", 4)), (25, 3, ("yellow", 4)),
        (22, 4, ("yellow", 4)), (23, 4, ("orange", 4)), (24, 4, ("orange", 3)), (25, 4, ("yellow", 3)),
        (23, 5, ("orange", 3)), (24, 5, ("cha", 4)),
        (26, 2, ("yellow", 5)), (27, 1, ("yellow", 4)), (27, 2, ("orange", 4)),
        (26, 3, ("orange", 4)), (27, 3, ("orange", 3)), (26, 4, ("cha", 4)),
    ]
    for rx, ry, _ in rooster_px:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                nx, ny = rx + dx, ry + dy
                if 0 <= ny <= 9 and cv.get(nx, ny)[3] == 0:
                    cv.set(nx, ny, cv.c("ink", 0))
    for rx, ry, (rfam, ridx) in rooster_px:
        cv.set(rx, ry, cv.c(rfam, ridx))

    cv.hline(22, 25, 9, cv.c("ink", 0))
    cv.set(22, 10, cv.c("yellow", 5))
    cv.set(23, 10, cv.c("cream", 6))
    cv.set(24, 10, cv.c("yellow", 4))
    cv.set(25, 10, cv.c("orange", 3))

    # ------------------------------------------------------------------
    # B. STEEP TAPERED PATINA-GREEN COPPER PYRAMIDAL ROOF (y=11..42)
    # ------------------------------------------------------------------
    for y in range(11, 41):
        t = (y - 11) / 29.0
        flare = (t ** 1.55) * 4.5
        hw = int(round(2.5 + t * 14.5 + flare))
        lx = 23 - hw
        rx = 24 + hw

        hip_hw = max(1, int(round(hw * 0.56)))
        hlx = 23 - hip_hw
        hrx = 24 + hip_hw

        ry = (y - 11) % 5
        cv.set(lx, y, cv.c("teal", 0))
        cv.set(rx, y, cv.c("ink", 0))

        for x in range(lx + 1, rx):
            h = det_hash(x, y, 401)
            if x < hlx:
                col = cv.c("teal", 3) if ry == 4 else cv.c("teal" if (x + y) % 3 != 0 else "midori", 5 if x <= lx + 2 else 4)
            elif x == hlx:
                col = cv.c("teal", 5 if ry != 4 else 4)
            elif x == hrx:
                col = cv.c("midori", 3 if ry != 4 else 1)
            elif x > hrx:
                col = cv.c("teal", 0) if ry == 4 else cv.c("midori" if h % 2 == 0 else "teal", 1 if x >= rx - 2 else 2)
            else:
                seam = (x - 23) % 4 == 0
                is_r = x >= 24
                if ry == 4:
                    col = cv.c("cha" if seam and h % 2 == 0 else "teal", 4 if seam else (1 if is_r else 2))
                elif ry == 0:
                    col = cv.c("teal" if not is_r else "midori", 4 if not is_r else 3)
                elif seam:
                    col = cv.c("teal", 5 if not is_r else 3)
                else:
                    fam = "teal" if (h % 3 != 0) else "midori"
                    idx = (3 if not is_r else 2) + (1 if (ry == 1 and not is_r) else 0)
                    if h % 19 == 0:
                        fam, idx = "cha", 3
                    col = cv.c(fam, idx)
            cv.set(x, y, col)

    # Mini side dormer gablets + central copper dormer louver
    for sx0, is_r in ((10, False), (35, True)):
        cv.set(sx0 + 1, 29, cv.c("yellow", 4 if not is_r else 3))
        cv.hline(sx0, sx0 + 2, 30, cv.c("teal", 5 if not is_r else 3))
        for sy in range(31, 35):
            cv.set(sx0, sy, cv.c("stone", 4 if not is_r else 2))
            cv.set(sx0 + 1, sy, cv.c("ink", 0))
            cv.set(sx0 + 2, sy, cv.c("midori", 2 if not is_r else 1))

    cv.hline(23, 24, 22, cv.c("yellow", 5))
    for dy in range(5):
        y = 23 + dy
        span = 1 + dy
        dx0, dx1 = 23 - span, 24 + span
        cv.set(dx0, y, cv.c("ink", 0))
        cv.set(dx0 + 1, y, cv.c("teal", 5))
        cv.set(dx1 - 1, y, cv.c("midori", 2))
        cv.set(dx1, y, cv.c("ink", 0))
        for x in range(dx0 + 2, dx1 - 1):
            cv.set(x, y, cv.c("stone" if y >= 25 else "teal", 4 if x < 24 else 3))

    for y in range(27, 34):
        cv.set(20, y, cv.c("white", 5))
        cv.set(27, y, cv.c("stone", 3))
        for x in range(21, 27):
            cv.set(x, y, cv.c("ink", 0) if y % 2 == 1 else cv.c("cha" if x >= 24 else "wood", 4))
    cv.hline(20, 27, 34, cv.c("white", 5))
    cv.hline(20, 27, 35, cv.c("teal", 1))

    cv.hline(2, 23, 40, cv.c("teal", 5))
    cv.hline(24, 45, 40, cv.c("teal", 3))
    cv.set(2, 40, cv.c("ink", 0))
    cv.set(45, 40, cv.c("ink", 0))
    for x in range(2, 46):
        if x in (2, 45):
            cv.set(x, 41, cv.c("ink", 0))
        elif x % 4 == 0:
            cv.set(x, 41, cv.c("yellow", 3 if x < 24 else 2))
        else:
            cv.set(x, 41, cv.c("midori", 2 if x < 24 else 1))
    cv.hline(3, 44, 42, cv.c("ink", 0))

    # ------------------------------------------------------------------
    # C. CLOCK & BELFRY TIER (y=42..86, shaft x=5..42)
    # ------------------------------------------------------------------
    draw_ashlar_wall(cv, 5, 43, 42, 86, row_h=5, block_w=7, style="limestone", light_cx=21.0, seed=505)

    for y in range(43, 87):
        q_long = ((y - 43) // 4) % 2 == 0
        w_q = 4 if q_long else 2
        cv.set(4, y, cv.c("ink", 0))
        cv.set(43, y, cv.c("ink", 0))
        for dx in range(w_q):
            cv.set(5 + dx, y, cv.c("stone", 3) if (y - 43) % 4 == 3 else cv.c("white" if dx == 0 else "cream", 6 if dx == 0 else 5))
            cv.set(42 - dx, y, cv.c("pavement", 2) if (y - 43) % 4 == 3 else cv.c("concrete" if dx > 0 else "pavement", 3 if dx > 0 else 2))

    for x in range(5, 43):
        cv.set(x, 43, cv.c("stone" if x % 3 != 0 else "ink", 1 if x % 3 != 0 else 0))
        if x % 3 == 0:
            cv.set(x, 44, cv.c("stone", 2))

    # Twin Arched Open Belfry Louvers (y=46..58)
    for bx0 in (10, 26):
        bcx = bx0 + 5.5
        for y in range(46, 59):
            dy = y - 46
            span = 2 if dy == 0 else (4 if dy == 1 else 5)
            ax0 = int(round(bcx - span + 0.1))
            ax1 = int(round(bcx + span - 0.1))
            cv.set(ax0 - 1, y, cv.c("stone", 3))
            cv.set(ax1 + 1, y, cv.c("white" if bx0 < 24 else "coolwhite", 5 if bx0 < 24 else 4))
            for x in range(ax0, ax1 + 1):
                if y <= 50:
                    cv.set(x, y, cv.c("ink" if y % 2 == 0 else "darkwood", 0 if y % 2 == 0 else 2))
                else:
                    cv.set(x, y, cv.c("ink", 0))

        bell_cx = int(bcx)
        for by, bw in ((51, 1), (52, 2), (53, 2), (54, 3), (55, 3)):
            for x in range(bell_cx - bw + 1, bell_cx + bw + 1):
                if x == bell_cx - bw + 1:
                    cv.set(x, by, cv.c("yellow", 5))
                elif x <= bell_cx:
                    cv.set(x, by, cv.c("yellow", 4))
                elif x == bell_cx + bw:
                    cv.set(x, by, cv.c("cha", 3))
                else:
                    cv.set(x, by, cv.c("orange", 3))
        cv.set(bell_cx, 56, cv.c("yellow", 5))

    cv.hline(22, 25, 48, cv.c("yellow", 4))
    for y in range(49, 59):
        cv.set(22, y, cv.c("white", 6))
        cv.set(23, y, cv.c("cream", 5))
        cv.set(24, y, cv.c("stone", 4))
        cv.set(25, y, cv.c("stone", 2))

    cv.hline(8, 23, 58, cv.c("white", 6))
    cv.hline(24, 39, 58, cv.c("coolwhite", 4))
    cv.hline(8, 39, 59, cv.c("stone", 3))
    cv.hline(9, 39, 60, cv.c("stone", 1))

    # ------------------------------------------------------------------
    # D. LUMINOUS CREAM-AND-GOLD CIRCULAR TOWN CLOCK FACE (y=61..84)
    # ------------------------------------------------------------------
    # Carved bevelled limestone clock housing panel (x=9..38, y=61..84)
    cv.hline(9, 38, 61, cv.c("stone", 2))
    cv.vline(9, 61, 84, cv.c("stone", 2))
    cv.hline(9, 38, 84, cv.c("white", 5))
    cv.vline(38, 61, 84, cv.c("coolwhite", 4))
    for y in range(62, 84):
        for x in range(10, 38):
            # Subtle carved spandrel stone masonry relief
            ch = det_hash(x // 3, y // 3, 777) % 3
            is_r = x >= 24
            if (x - 10 == y - 62) or (37 - x == y - 62):
                cv.set(x, y, cv.c("stone", 2))  # diagonal spandrel mitre groove
            else:
                cv.set(x, y, cv.c("stone" if ch != 0 else "concrete", (4 if not is_r else 3) - (1 if ch == 2 else 0)))

    # Corner gilt spandrel rosettes (4 corners of clock housing)
    for sx, sy in ((11, 63), (36, 63), (11, 82), (36, 82)):
        cv.set(sx, sy, cv.c("yellow", 5 if sx < 24 else 4))
        cv.set(sx + (1 if sx < 24 else -1), sy, cv.c("orange", 3))
        cv.set(sx, sy + (1 if sy < 72 else -1), cv.c("orange", 3))

    ccx, ccy = 23.5, 72.5
    for y in range(61, 85):
        for x in range(11, 37):
            dx = x - ccx
            dy = y - ccy
            r = math.hypot(dx, dy)
            if 10.8 < r <= 12.0 and dx > -2 and dy > -2:
                cv.set(x, y, cv.c("stone", 1))
            elif 9.2 <= r <= 10.9:
                light = -dx - dy
                if r >= 10.3:
                    cv.set(x, y, cv.c("ink" if light < -2 else "cha", 0 if light < -2 else 2))
                elif light > 5:
                    cv.set(x, y, cv.c("yellow", 5))
                elif light > 0:
                    cv.set(x, y, cv.c("yellow", 4))
                elif light > -5:
                    cv.set(x, y, cv.c("orange", 3))
                else:
                    cv.set(x, y, cv.c("cha", 3))
            elif r < 9.2:
                if r >= 8.3:
                    cv.set(x, y, cv.c("cream", 3) if dx + dy < 0 else cv.c("yellow", 5))
                elif r <= 3.5:
                    cv.set(x, y, cv.c("cream", 4 if 2.6 <= r <= 3.4 else 6))
                else:
                    cv.set(x, y, cv.c("cream" if (dx + dy) > 2 else "white", 6))

    for bx, by in ((23, 62), (24, 62), (33, 72), (33, 73), (23, 83), (24, 83), (14, 72), (14, 73)):
        cv.set(bx, by, cv.c("yellow", 5 if (bx + by) < 96 else 4))

    # 12 Crisp Dark Roman-Tick Markers
    cv.vline(23, 64, 65, cv.c("ink", 0))
    cv.vline(24, 64, 65, cv.c("kuro", 1))
    cv.vline(23, 79, 80, cv.c("kuro", 1))
    cv.vline(24, 79, 80, cv.c("ink", 0))
    cv.hline(16, 17, 72, cv.c("ink", 0))
    cv.hline(16, 17, 73, cv.c("kuro", 1))
    cv.hline(30, 31, 72, cv.c("kuro", 1))
    cv.hline(30, 31, 73, cv.c("ink", 0))

    for tx, ty in ((27, 65), (30, 68), (30, 76), (27, 79), (20, 79), (17, 76), (17, 68), (20, 65)):
        cv.set(tx, ty, cv.c("ink", 0))

    # Minute hand (12) & Hour hand (4) + golden arbor hub
    for my in range(66, 72):
        cv.set(23, my, cv.c("ink", 0))
        if my >= 68:
            cv.set(24, my, cv.c("cream", 4))
    for hx, hy in ((24, 73), (25, 73), (26, 74), (27, 74), (28, 75)):
        cv.set(hx, hy, cv.c("ink", 0))
    cv.set(23, 72, cv.c("yellow", 5))
    cv.set(24, 72, cv.c("orange", 4))
    cv.set(23, 73, cv.c("orange", 4))
    cv.set(24, 73, cv.c("ink", 0))

    # ------------------------------------------------------------------
    # E. CORBELED STONE TRIM CORNICE (y=85..88, x=3..44)
    # ------------------------------------------------------------------
    cv.set(3, 85, cv.c("ink", 0))
    cv.hline(4, 23, 85, cv.c("white", 6))
    cv.hline(24, 43, 85, cv.c("coolwhite", 4))
    cv.set(44, 85, cv.c("ink", 0))

    cv.set(3, 86, cv.c("ink", 0))
    cv.hline(4, 23, 86, cv.c("cream", 5))
    cv.hline(24, 43, 86, cv.c("stone", 4))
    cv.set(44, 86, cv.c("ink", 0))

    for x in range(4, 44):
        if x in (4, 43):
            cv.set(x, 87, cv.c("ink", 0))
        elif x % 4 in (1, 2):
            cv.set(x, 87, cv.c("stone", 4 if x < 24 else 3))
            cv.set(x, 88, cv.c("stone", 2))
        else:
            cv.set(x, 87, cv.c("pavement", 1))
            cv.set(x, 88, cv.c("ink", 0))

    # ------------------------------------------------------------------
    # F. RUSTICATED BASE TIER WITH INTACT LANTERN BOUNCE LIGHT (y=89..123)
    # ------------------------------------------------------------------
    lamp_glow = [(43.0, 97.0, 9.0)]
    draw_ashlar_wall(cv, 5, 89, 42, 115, row_h=6, block_w=8, style="rusticated", light_cx=21.0, seed=606, lanterns=lamp_glow)
    draw_ashlar_wall(cv, 4, 116, 43, 123, row_h=4, block_w=8, style="rusticated", light_cx=21.0, seed=707)

    for y in range(89, 116):
        cv.set(4, y, cv.c("ink", 0))
        cv.set(43, y, cv.c("ink", 0))
        q_long = ((y - 89) // 6) % 2 == 0
        for dx in range(4 if q_long else 2):
            cv.set(5 + dx, y, cv.c("stone" if dx > 0 else "white", 5 if (y - 89) % 6 != 5 else 2))
            # Right quoins warmed subtly near street-lamp (y=93..102), keeping mortar joints!
            near_lamp = 92 <= y <= 102
            if (y - 89) % 6 == 5:
                cv.set(42 - dx, y, cv.c("stone" if near_lamp else "pavement", 2 if near_lamp else 1))
            else:
                cv.set(42 - dx, y, cv.c("cream" if near_lamp else "pavement", 3 if near_lamp else 2))

    cv.set(3, 115, cv.c("ink", 0))
    cv.hline(4, 23, 115, cv.c("stone", 6))
    cv.hline(24, 43, 115, cv.c("concrete", 4))
    cv.set(44, 115, cv.c("ink", 0))
    for y in range(116, 124):
        cv.set(3, y, cv.c("ink", 0))
        cv.set(44, y, cv.c("ink", 0))

    # ------------------------------------------------------------------
    # G. ARCHED OAK MAINTENANCE / GUARD DOORWAY (x=8..28, y=92..121)
    # ------------------------------------------------------------------
    dcx = 18.0
    for y in range(92, 122):
        for x in range(8, 29):
            dx = abs(x - dcx)
            if y < 101:
                r = math.hypot(dx * 1.05, (101 - y) * 1.05)
                if 7.3 < r <= 9.8:
                    ang = int(math.degrees(math.atan2(101 - y, x - dcx)))
                    if (ang % 28) < 5:
                        cv.set(x, y, cv.c("pavement", 1))
                    else:
                        cv.set(x, y, cv.c("stone" if x <= 18 else "concrete", 5 if x <= 18 else 4))
                elif 6.4 < r <= 7.3:
                    cv.set(x, y, cv.c("ink", 0))
                elif r <= 6.4:
                    plank = (x - 11) % 3
                    cv.set(x, y, cv.c("darkwood" if plank == 0 else "wood", 2 if plank == 0 else 4))
            else:
                if x in (9, 10):
                    cv.set(x, y, cv.c("stone", 5 if y % 5 != 0 else 2))
                elif x in (26, 27):
                    cv.set(x, y, cv.c("concrete", 3 if y % 5 != 0 else 1))
                elif x in (11, 25):
                    cv.set(x, y, cv.c("ink", 0))
                elif 12 <= x <= 24:
                    plank = (x - 12) % 3
                    grain = det_hash(x, y // 3, 808) % 3
                    if plank == 0:
                        cv.set(x, y, cv.c("darkwood", 2))
                    else:
                        cv.set(x, y, cv.c("cedar" if grain == 1 else "wood", 4 if x < 19 else 3))

    cv.rect(16, 99, 20, 103, cv.c("ink", 0))
    cv.vline(18, 99, 103, cv.c("steel", 3))
    cv.hline(16, 20, 101, cv.c("steel", 3))
    for hy in (105, 115):
        cv.hline(12, 22, hy, cv.c("steel", 3))
        cv.hline(12, 22, hy + 1, cv.c("kuro", 1))
        for rx_s in (13, 17, 21):
            cv.set(rx_s, hy, cv.c("steel", 5))
    cv.set(22, 109, cv.c("yellow", 5))
    cv.set(22, 110, cv.c("orange", 4))
    cv.set(23, 110, cv.c("yellow", 3))

    # ------------------------------------------------------------------
    # H. BRONZE TOWN-CHARTER PLAQUE & IRON STREET-LAMP BRACKET
    # ------------------------------------------------------------------
    cv.rect(30, 103, 40, 114, cv.c("pavement", 0))
    cv.rect(30, 103, 39, 113, cv.c("cha", 2))
    cv.hline(30, 39, 103, cv.c("yellow", 4))
    cv.vline(30, 103, 113, cv.c("orange", 4))
    cv.hline(30, 39, 113, cv.c("cha", 1))
    cv.vline(39, 104, 113, cv.c("cha", 1))
    cv.rect(31, 104, 38, 112, cv.c("cha", 4))
    cv.hline(33, 36, 105, cv.c("yellow", 4))
    for ty in (107, 109, 111):
        for tx in range(32, 38):
            cv.set(tx, ty, cv.c("cha", 1 if (tx + ty) % 3 != 0 else 5))
    for rx_p, ry_p in ((31, 104), (38, 104), (31, 112), (38, 112)):
        cv.set(rx_p, ry_p, cv.c("yellow", 5))

    # Wrought-iron Street-Lamp Bracket attached cleanly to right wall (x=40..47, y=90..100)
    cv.vline(42, 90, 96, cv.c("kuro", 0))  # wall mounting plate inside tower edge
    cv.hline(42, 46, 91, cv.c("kuro", 0))
    cv.hline(42, 46, 90, cv.c("steel", 4))  # top scroll bar
    cv.set(44, 92, cv.c("steel", 3))
    cv.set(43, 93, cv.c("steel", 2))
    cv.hline(42, 47, 93, cv.c("kuro", 0))
    cv.hline(43, 46, 94, cv.c("steel", 3))
    for ly in range(95, 99):
        cv.set(42, ly, cv.c("kuro", 0))
        cv.set(43, ly, cv.c("yellow", 5))
        cv.set(44, ly, cv.c("cream" if ly == 96 else "yellow", 6 if ly == 96 else 5))
        cv.set(45, ly, cv.c("orange", 4))
        cv.set(46, ly, cv.c("red" if ly == 98 else "orange", 4 if ly == 98 else 3))
        cv.set(47, ly, cv.c("kuro", 0))
    cv.hline(43, 46, 99, cv.c("kuro", 0))
    cv.hline(44, 45, 100, cv.c("steel", 2))

    # ------------------------------------------------------------------
    # I. MOSSY COBBLESTONE CURB & DOOR THRESHOLD (x=0..47, y=121..127)
    # ------------------------------------------------------------------
    cv.hline(9, 27, 121, cv.c("white", 5))
    cv.hline(9, 27, 122, cv.c("stone", 4))
    cv.hline(8, 28, 123, cv.c("cream", 5))
    cv.hline(8, 28, 124, cv.c("stone", 3))

    for y in range(123, 128):
        for x in range(1, 47):
            if y == 123 and (x in (1, 46)):
                continue
            if y == 127 or x in (1, 46):
                cv.set(x, y, cv.c("ink", 0))
                continue
            if 9 <= x <= 27 and y <= 124:
                continue

            cob_id = (x // 4) + (y - 123) * 13
            cx_r = x % 4
            h = det_hash(cob_id, y, 909)
            if cx_r == 3 or (y == 125 and x % 2 == 0):
                cv.set(x, y, cv.c("moss", 2 if x < 28 else 1) if h % 2 == 0 else cv.c("pavement", 1))
            elif y == 123:
                cv.set(x, y, cv.c("moss", 4 if x < 26 else 3) if h % 4 == 0 else cv.c("flagstone" if h % 2 == 0 else "stone", 5 if x < 26 else 4))
            else:
                fam = "flagstone" if (h % 2 == 0) else "pavement"
                cv.set(x, y, cv.c(fam, 4 if (cx_r == 0 and x < 28) else 3))

    moss_spots = [
        (5, 121, 3), (6, 122, 4), (7, 122, 2), (8, 121, 3),
        (29, 122, 3), (30, 121, 2), (31, 122, 4),
        (39, 120, 2), (40, 121, 3), (41, 122, 2), (42, 121, 1), (42, 122, 2),
    ]
    for mx, my, midx in moss_spots:
        cv.set(mx, my, cv.c("moss", midx))

    return cv.img


# ==============================================================================
# 3. VERIFICATION & 3X PREVIEW SHEET ON #23262e CHECKERBOARD
# ==============================================================================
def verify_sprite(name: str, img: Image.Image, expected_size: tuple[int, int], allowed_rgb: set[tuple[int, int, int]]) -> dict:
    assert img.mode == "RGBA", f"{name}: mode must be RGBA, got {img.mode}"
    assert img.size == expected_size, f"{name}: size must be {expected_size}, got {img.size}"

    w, h = img.size
    px = img.load()
    off_palette = 0
    pure_black = 0
    non_binary_alpha = 0
    opaque_count = 0
    used_colors: set[tuple[int, int, int]] = set()

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a not in (0, 255):
                non_binary_alpha += 1
            if a == 255:
                opaque_count += 1
                rgb = (r, g, b)
                used_colors.add(rgb)
                if rgb == (0, 0, 0):
                    pure_black += 1
                if rgb not in allowed_rgb:
                    off_palette += 1

    status = "PASS" if (off_palette == 0 and pure_black == 0 and non_binary_alpha == 0 and 60 <= len(used_colors) <= 95) else "FAIL"
    return {
        "name": name,
        "size": f"{w}x{h}",
        "opaque_pixels": opaque_count,
        "unique_colors": len(used_colors),
        "off_palette": off_palette,
        "pure_black": pure_black,
        "non_binary_alpha": non_binary_alpha,
        "status": status,
    }


def make_preview_sheet(chapel: Image.Image, clocktower: Image.Image, out_path: Path) -> None:
    scale = 3
    pad = 24
    gap = 36
    top_pad = 32
    bot_pad = 24

    c_s = chapel.resize((chapel.width * scale, chapel.height * scale), Image.Resampling.NEAREST)
    t_s = clocktower.resize((clocktower.width * scale, clocktower.height * scale), Image.Resampling.NEAREST)

    pw = pad + c_s.width + gap + t_s.width + gap + max(chapel.width, clocktower.width) + pad
    ph = top_pad + max(c_s.height, t_s.height) + bot_pad

    bg_a = (0x23, 0x26, 0x2E, 255)
    bg_b = (0x2A, 0x2E, 0x38, 255)
    sheet = Image.new("RGBA", (pw, ph), bg_a)
    spx = sheet.load()
    cell = 12
    for y in range(ph):
        for x in range(pw):
            if ((x // cell) + (y // cell)) % 2 == 1:
                spx[x, y] = bg_b

    baseline_y = top_pad + max(c_s.height, t_s.height)
    cx = pad
    cy = baseline_y - c_s.height
    tx = cx + c_s.width + gap
    ty = baseline_y - t_s.height

    sheet.alpha_composite(c_s, (cx, cy))
    sheet.alpha_composite(t_s, (tx, ty))

    x1 = tx + t_s.width + gap
    sheet.alpha_composite(chapel, (x1, top_pad + 12))
    sheet.alpha_composite(clocktower, (x1 + 16, baseline_y - clocktower.height))

    draw = ImageDraw.Draw(sheet)
    draw.text((cx, 8), "ft-chapel.png (80x112, 3x)", fill=(230, 226, 208, 255))
    draw.text((tx, 8), "ft-clocktower.png (48x128, 3x)", fill=(230, 226, 208, 255))
    draw.text((x1, 8), "1x native", fill=(176, 170, 166, 255))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(out_path, "PNG")


def main() -> None:
    ramps, allowed_rgb = load_palette()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    chapel = build_chapel(ramps)
    clocktower = build_clocktower(ramps)

    chapel_path = OUT_DIR / "ft-chapel.png"
    clocktower_path = OUT_DIR / "ft-clocktower.png"

    chapel.save(chapel_path, "PNG")
    clocktower.save(clocktower_path, "PNG")

    make_preview_sheet(chapel, clocktower, PREVIEW_PATH)

    r1 = verify_sprite("ft-chapel.png", chapel, (80, 112), allowed_rgb)
    r2 = verify_sprite("ft-clocktower.png", clocktower, (48, 128), allowed_rgb)

    for r in (r1, r2):
        print(json.dumps(r))
        assert r["off_palette"] == 0, f"Off-palette pixels found in {r['name']}!"
        assert r["pure_black"] == 0, f"Pure #000000 found in {r['name']}!"
        assert r["non_binary_alpha"] == 0, f"Non-binary alpha found in {r['name']}!"
        assert r["status"] == "PASS", f"Verification status not PASS: {r}"


if __name__ == "__main__":
    main()
