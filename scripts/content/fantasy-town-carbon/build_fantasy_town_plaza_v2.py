#!/usr/bin/env python3
"""
Fantasy Town Carbon — 10-Building Street Lineup Showcase & Harbor-Town Plaza v2 Map
===================================================================================
Deliverable 1:
  - tiledata/fantasy-town-carbon/fantasy_town_10_lineup_1x.png
  - tiledata/fantasy-town-carbon/fantasy_town_10_lineup_2x.png (2x nearest-neighbor)
  2-row wall-to-wall medieval street showcase on #1e2129 / #252934 checkerboard with
  continuous dressed-stone curb & warm cobblestone street strips + crisp pixel typography:
    Row 1 (Upper Town & Guild Row): ft-chapel, ft-clocktower, ft-guild, ft-magic, ft-apothecary
    Row 2 (Market & Harbor Row):    ft-inn, ft-smithy, ft-armory, ft-tavern, ft-warehouse

Deliverable 2:
  - tiledata/fantasy-town-carbon/map_fantasy_town_plaza_v2.png    (608x448 = 38x28 tiles)
  - tiledata/fantasy-town-carbon/map_fantasy_town_plaza_v2_2x.png (1216x896, 2x nearest-neighbor)
  - tiledata/fantasy-town-carbon/metrics_plaza_v2.json
  Non-rectangular 3-tier medieval harbor-town plaza showcasing all 10 Fable-grade buildings:
    1. Elevated North Sanctuary Terrace (stepped stone retaining wall, balustrades, 3-tile wide
       grand stone stairs, flowerbeds, cypress/oak grove) -> ft-chapel & ft-clocktower
    2. Central Octagonal Fountain Plaza & Guild/Artisan/Arcane Streets (world-coord quiet warm
       limestone cobblestones with zero 16x16 grid repetition, sparkling 3x3 azure stone fountain,
       striped-awning market stalls, wrought-iron streetlamps, benches, barrels, anvil/quench tub) ->
       ft-magic, ft-apothecary, ft-guild, ft-smithy, ft-armory, ft-inn
    3. South-East Stepped Stone Harbor Quay & Shimmering 3/4 Azure Sea (carved stepped seawall,
       mooring bollards, cargo crates, 3-tile timber pier on pilings, moored harbor skiff, and
       organic craggy NE coastal headland) -> ft-tavern & ft-warehouse
  Includes 3-4px dark ground contact shadows + alpha=85 SE cast shadows, zero #000000 pixels,
  zero overlapping building sprites, and 100% BFS walkability verification across all 10 doors
  and town landmarks with 0 trapped walkable tiles.
"""

from __future__ import annotations

import json
import math
from collections import deque
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple
import numpy as np
from PIL import Image

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
PALETTE_PATH = ROOT / "tiledata/jp-city/fable-city/palette.json"
BLDG_DIR = ROOT / "tiledata/fantasy-town-carbon/buildings"
OUT_DIR = ROOT / "tiledata/fantasy-town-carbon"

GW, GH = 38, 28
W_PX, H_PX = GW * 16, GH * 16  # 608 x 448


# ---------------------------------------------------------------------------
# Color & Deterministic World-Coordinate Noise Helpers (Zero #000000!)
# ---------------------------------------------------------------------------
def hx3(s: str) -> Tuple[int, int, int]:
    s = s.lstrip("#")
    r, g, b = int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)
    if (r, g, b) == (0, 0, 0):
        return (12, 10, 16)
    return (r, g, b)


def safe_rgb(r: int, g: int, b: int) -> Tuple[int, int, int]:
    r = max(0, min(255, r))
    g = max(0, min(255, g))
    b = max(0, min(255, b))
    if r == 0 and g == 0 and b == 0:
        return (14, 12, 20)
    return (r, g, b)


def lerp_rgb(a: Tuple[int, int, int], b: Tuple[int, int, int], t: float) -> Tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return safe_rgb(
        int(round(a[0] + (b[0] - a[0]) * t)),
        int(round(a[1] + (b[1] - a[1]) * t)),
        int(round(a[2] + (b[2] - a[2]) * t)),
    )


def mul_rgb(c: Tuple[int, int, int], f: float) -> Tuple[int, int, int]:
    return safe_rgb(int(round(c[0] * f)), int(round(c[1] * f)), int(round(c[2] * f)))


def h2(x: int, y: int, seed: int = 17) -> float:
    n = (x * 374761393 + y * 668265263 + seed * 1442695041) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    n = n ^ (n >> 16)
    return (n & 0xFFFFFF) / float(0x1000000)


def vnoise(x: float, y: float, scale: float, seed: int = 17) -> float:
    sx = x / scale
    sy = y / scale
    ix = math.floor(sx)
    iy = math.floor(sy)
    fx = sx - ix
    fy = sy - iy
    ux = fx * fx * (3.0 - 2.0 * fx)
    uy = fy * fy * (3.0 - 2.0 * fy)
    a = h2(ix, iy, seed)
    b = h2(ix + 1, iy, seed)
    c = h2(ix, iy + 1, seed)
    d = h2(ix + 1, iy + 1, seed)
    return (a * (1.0 - ux) + b * ux) * (1.0 - uy) + (c * (1.0 - ux) + d * ux) * uy


def fbm(x: float, y: float, seed: int = 31) -> float:
    return (
        0.55 * vnoise(x, y, 28.0, seed)
        + 0.30 * vnoise(x, y, 12.0, seed + 7)
        + 0.15 * vnoise(x, y, 5.5, seed + 19)
    )


def load_fable_ramps() -> Dict[str, List[Tuple[int, int, int]]]:
    raw = json.loads(PALETTE_PATH.read_text(encoding="utf-8"))["ramps"]
    return {k: [hx3(c) for c in cols] for k, cols in raw.items()}


RAMPS = load_fable_ramps()


# ---------------------------------------------------------------------------
# Harmonized Fable-5.2 Palettes (Derived from palette.json, zero #000000)
# ---------------------------------------------------------------------------
# Quiet warm-beige/grey limestone cobblestones (low internal contrast so buildings & props POP!)
COBBLE_MORTAR = hx3("#796f73")
COBBLE_MOSS_D = hx3("#52623a")
COBBLE_MOSS_L = hx3("#6c8048")
COBBLE_WARM = [
    hx3("#8f8584"),  # 0 shaded warm grey-beige
    hx3("#9b918d"),  # 1 cool-warm limestone
    hx3("#a69b93"),  # 2 main warm plaza cobble
    hx3("#b2a79d"),  # 3 sunlit warm beige stone
    hx3("#beb3a7"),  # 4 subtle top lip highlight
]

# Noble pale sanctuary & inner octagonal fountain-court ashlar slabs
SANCTUARY_MORTAR = hx3("#82787b")
SANCTUARY_SLABS = [
    hx3("#9d9393"),
    hx3("#aaa09d"),
    hx3("#b7ada6"),
    hx3("#c4bab0"),
    hx3("#d2cabd"),
]

# Coastal salt-weathered harbor quay flagstones
QUAY_MORTAR = hx3("#645e6e")
QUAY_SLABS = [
    hx3("#7d7886"),
    hx3("#898491"),
    hx3("#96919b"),
    hx3("#a39ea5"),
    hx3("#b2adae"),
]

GRASS_RAMP = [
    RAMPS["foliage"][0],  # 0 #0e2024 deep shadow
    RAMPS["foliage"][1],  # 1 #163428 canopy dark
    RAMPS["foliage"][2],  # 2 #204c2c rich shade
    RAMPS["lawn"][1],     # 3 #2f6a36 meadow dark
    RAMPS["lawn"][2],     # 4 #3d7b39 meadow main
    RAMPS["lawn"][3],     # 5 #4b8c3c sunlit lawn
    RAMPS["lawn"][4],     # 6 #5c9c3d warm clover
    RAMPS["lawn"][5],     # 7 #73b83e bright leaf highlight
]

# Dressed limestone retaining wall & seawall masonry (palette.json stone & concrete)
WALL_OUT = RAMPS["ink"][0]        # #1a1226
WALL_DARK = RAMPS["concrete"][0]  # #3a3452
WALL_SHADE = RAMPS["concrete"][1] # #544c68
WALL_MID = RAMPS["concrete"][2]   # #706a80
WALL_WARM = RAMPS["stone"][3]     # #928484
WALL_LIT = RAMPS["stone"][4]      # #aa9a94
WALL_CAP = RAMPS["stone"][5]      # #c4b8ac
WALL_GLINT = RAMPS["stone"][6]    # #dcd4c4

# Shimmering 3/4 Azure Harbor Sea (palette.json glass, blue, teal, coolwhite)
SEA_SHADOW = hx3("#13233f")       # seawall reflection shadow
SEA_ABYSS = hx3("#193156")        # deep harbor basin
SEA_DEEP = hx3("#21446e")         # mid-deep 3/4 sea
SEA_MID = hx3("#2b5c87")          # lively azure body
SEA_SHALLOW = hx3("#39789c")      # coastal turquoise-azure
SEA_WAVE = hx3("#88bfd0")         # gentle wave crest
SEA_FOAM = hx3("#cfe8ec")         # bright seafoam glint


# ---------------------------------------------------------------------------
# Crisp 5x7 Pixel Bitmap Font (1x native -> razor-sharp 2x nearest-neighbor!)
# ---------------------------------------------------------------------------
FONT_5X7: Dict[str, List[str]] = {
    "A": [" ### ", "#   #", "#####", "#   #", "#   #"],
    "B": ["#### ", "#   #", "#### ", "#   #", "#### "],
    "C": [" ####", "#    ", "#    ", "#    ", " ####"],
    "D": ["#### ", "#   #", "#   #", "#   #", "#### "],
    "E": ["#####", "#    ", "#### ", "#    ", "#####"],
    "F": ["#####", "#    ", "#### ", "#    ", "#    "],
    "G": [" ####", "#    ", "#  ##", "#   #", " ####"],
    "H": ["#   #", "#   #", "#####", "#   #", "#   #"],
    "I": [" ### ", "  #  ", "  #  ", "  #  ", " ### "],
    "J": ["  ###", "   # ", "   # ", "#  # ", " ##  "],
    "K": ["#  ##", "# #  ", "##   ", "# #  ", "#  ##"],
    "L": ["#    ", "#    ", "#    ", "#    ", "#####"],
    "M": ["#   #", "## ##", "# # #", "#   #", "#   #"],
    "N": ["#   #", "##  #", "# # #", "#  ##", "#   #"],
    "O": [" ### ", "#   #", "#   #", "#   #", " ### "],
    "P": ["#### ", "#   #", "#### ", "#    ", "#    "],
    "Q": [" ### ", "#   #", "# # #", "#  ##", " ####"],
    "R": ["#### ", "#   #", "#### ", "#  # ", "#   #"],
    "S": [" ####", "#    ", " ### ", "    #", "#### "],
    "T": ["#####", "  #  ", "  #  ", "  #  ", "  #  "],
    "U": ["#   #", "#   #", "#   #", "#   #", " ### "],
    "V": ["#   #", "#   #", "#   #", " # # ", "  #  "],
    "W": ["#   #", "#   #", "# # #", "## ##", "#   #"],
    "X": ["#   #", " # # ", "  #  ", " # # ", "#   #"],
    "Y": ["#   #", " # # ", "  #  ", "  #  ", "  #  "],
    "Z": ["#####", "   # ", "  #  ", " #   ", "#####"],
    "0": [" ### ", "#  ##", "# # #", "##  #", " ### "],
    "1": ["  #  ", " ##  ", "  #  ", "  #  ", " ### "],
    "2": [" ### ", "#   #", "  ## ", " #   ", "#####"],
    "3": ["#### ", "    #", " ### ", "    #", "#### "],
    "4": ["#  # ", "#  # ", "#####", "   # ", "   # "],
    "5": ["#####", "#    ", "#### ", "    #", "#### "],
    "6": [" ### ", "#    ", "#### ", "#   #", " ### "],
    "7": ["#####", "   # ", "  #  ", " #   ", " #   "],
    "8": [" ### ", "#   #", " ### ", "#   #", " ### "],
    "9": [" ### ", "#   #", " ####", "    #", " ### "],
    "-": ["     ", "     ", " ### ", "     ", "     "],
    ":": ["     ", "  #  ", "     ", "  #  ", "     "],
    "&": [" ##  ", "#  # ", " ## #", "#  # ", " ## #"],
    "/": ["    #", "   # ", "  #  ", " #   ", "#    "],
    "(": ["  ## ", " #   ", " #   ", " #   ", "  ## "],
    ")": [" ##  ", "   # ", "   # ", "   # ", " ##  "],
    ".": ["     ", "     ", "     ", "     ", "  #  "],
    "x": ["     ", " # # ", "  #  ", " # # ", "     "],
    " ": ["   ", "   ", "   ", "   ", "   "],
}


def measure_pixel_text(text: str) -> int:
    w = 0
    for ch in text:
        glyph = FONT_5X7.get(ch, FONT_5X7.get(ch.upper(), FONT_5X7[" "]))
        w += len(glyph[0]) + 1
    return max(0, w - 1)


def draw_pixel_text(
    px,
    w_lim: int,
    h_lim: int,
    x: int,
    y: int,
    text: str,
    fg: Tuple[int, int, int],
    shadow: Optional[Tuple[int, int, int]] = None,
    center: bool = False,
) -> None:
    if center:
        x -= measure_pixel_text(text) // 2
    cx = x
    for ch in text:
        glyph = FONT_5X7.get(ch, FONT_5X7.get(ch.upper(), FONT_5X7[" "]))
        gw = len(glyph[0])
        for gy, row in enumerate(glyph):
            for gx, bit in enumerate(row):
                if bit == "#":
                    if shadow is not None and 0 <= cx + gx + 1 < w_lim and 0 <= y + gy + 1 < h_lim:
                        px[cx + gx + 1, y + gy + 1] = (*shadow, 255)
                    if 0 <= cx + gx < w_lim and 0 <= y + gy < h_lim:
                        px[cx + gx, y + gy] = (*fg, 255)
        cx += gw + 1


# ---------------------------------------------------------------------------
# World-Coordinate Irregular Cobblestone Engine (Zero 16x16 Grid Periodicity!)
# ---------------------------------------------------------------------------
COURSE_H = [7, 9, 8, 10, 7, 9, 8, 11, 7, 9, 8, 10]  # sum = 103 (prime, coprime to 16!)
STONE_W = [11, 15, 10, 17, 13, 14, 9, 16, 12, 15, 11]  # sum = 143 (coprime to 16!)

Y_COURSE_TABLE: List[Tuple[int, int, int]] = []
_ci = 0
while len(Y_COURSE_TABLE) < 600:
    ch = COURSE_H[_ci % len(COURSE_H)]
    for _ly in range(ch):
        Y_COURSE_TABLE.append((_ci, _ly, ch))
    _ci += 1


def cobble_cell(x: int, y: int) -> Tuple[int, int, int, int, int, int]:
    ci, ly, sh = Y_COURSE_TABLE[y % len(Y_COURSE_TABLE)]
    shift = int(h2(ci, 5, 211) * 67)
    xx = x + shift
    cyc = xx // 143
    rem = xx % 143
    acc = 0
    si_loc = 0
    sw = STONE_W[0]
    for k, w in enumerate(STONE_W):
        if rem < acc + w:
            si_loc = k
            sw = w
            break
        acc += w
    lx = rem - acc
    sid = cyc * 16 + si_loc
    return ci, sid, lx, ly, sw, sh


def sample_cobble_color(
    x: int,
    y: int,
    ramp: Sequence[Tuple[int, int, int]],
    mortar: Tuple[int, int, int],
    moss_prob: float = 0.0,
    seed: int = 307,
) -> Tuple[int, int, int]:
    ci, sid, lx, ly, sw, sh = cobble_cell(x, y)
    is_corner = (lx in (0, sw - 1)) and (ly in (0, sh - 1)) and (h2(ci, sid, seed + 3) < 0.60)
    is_joint = (lx == sw - 1) or (ly == sh - 1) or is_corner
    if is_joint:
        if moss_prob > 0.0 and h2(x // 2, y // 2, seed + 11) < moss_prob:
            return COBBLE_MOSS_L if h2(x, y, seed + 13) < 0.4 else COBBLE_MOSS_D
        return mortar

    pick = int(h2(ci, sid, seed + 19) * 8) % 8
    idx = [0, 1, 1, 2, 2, 2, 3, 3][pick]
    if ly == 0 and 1 <= lx <= sw - 3 and h2(ci, sid, seed + 23) < 0.50:
        idx = min(4, idx + 1)
    elif lx == 0 and 1 <= ly <= sh - 3 and h2(ci, sid, seed + 29) < 0.30:
        idx = min(4, idx + 1)
    return ramp[idx]


# ---------------------------------------------------------------------------
# Ground Contact Shadow + Soft Alpha=85 East/South-East Cast Shadow Helper
# ---------------------------------------------------------------------------
def stamp_building_grounding_shadow(
    canvas: Image.Image,
    sprite: Image.Image,
    bx: int,
    by: int,
    cast_dx: int = 6,
    cast_dy: int = 5,
    cast_alpha: int = 85,
) -> None:
    cw, ch = canvas.size
    sw, sh = sprite.size
    spx = sprite.load()
    shadow_layer = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    sh_px = shadow_layer.load()
    shadow_rgb = RAMPS["ink"][0]  # #1a1226 (rich Fable deep plum-ink, never #000000!)

    bot_xs = [x for x in range(sw) if any(spx[x, sh - 1 - dy][3] > 0 for dy in range(6))]
    x_min = min(bot_xs) if bot_xs else 1
    x_max = max(bot_xs) if bot_xs else sw - 2

    wall_top = by + int(sh * 0.36)
    wall_bot = by + sh
    for y in range(max(0, wall_top + 4), min(ch, wall_bot + cast_dy + 1)):
        for dx in range(1, cast_dx + 1):
            xx = bx + x_max + dx
            if 0 <= xx < cw:
                fade = 1.0 - (dx - 1) / float(cast_dx + 2)
                a = int(round(cast_alpha * fade))
                if a > sh_px[xx, y][3]:
                    sh_px[xx, y] = (*shadow_rgb, a)

    for dy in range(-1, cast_dy + 1):
        yy = wall_bot + dy
        if not (0 <= yy < ch):
            continue
        shift_x = max(1, dy + 1)
        fade_y = 1.0 - max(0, dy) / float(cast_dy + 2)
        for x in range(bx + x_min + shift_x, bx + x_max + cast_dx + 1):
            if 0 <= x < cw:
                a = int(round(cast_alpha * fade_y))
                if a > sh_px[x, yy][3]:
                    sh_px[x, yy] = (*shadow_rgb, a)

    # Crisp 3px-4px dark ground contact shadow directly along footprint base
    for dy, alpha_c in [(-1, 145), (0, 165), (1, 130), (2, 85), (3, 45)]:
        yy = wall_bot + dy
        if not (0 <= yy < ch):
            continue
        for x in range(bx + x_min, bx + x_max + 2):
            if 0 <= x < cw:
                edge_d = min(x - (bx + x_min), (bx + x_max + 1) - x)
                eff_a = alpha_c if edge_d >= 2 else int(alpha_c * 0.65)
                if eff_a > sh_px[x, yy][3]:
                    sh_px[x, yy][:] if False else None
                    sh_px[x, yy] = (*shadow_rgb, eff_a)

    canvas.alpha_composite(shadow_layer)


# ---------------------------------------------------------------------------
# DELIVERABLE 1: 2-Row Wall-to-Wall Street Showcase Sheet (1x & 2x)
# ---------------------------------------------------------------------------
def build_lineup_showcase(sprites: Dict[str, Image.Image]) -> Tuple[Path, Path]:
    row1 = [
        ("ft-chapel", "CHAPEL", "5x7"),
        ("ft-clocktower", "CLOCKTOWER", "3x8"),
        ("ft-guild", "GUILD", "5x7"),
        ("ft-magic", "MAGIC", "4x7"),
        ("ft-apothecary", "APOTHECARY", "3x7"),
    ]
    row2 = [
        ("ft-inn", "INN", "4x7"),
        ("ft-smithy", "SMITHY", "4x7"),
        ("ft-armory", "ARMORY", "4x7"),
        ("ft-tavern", "TAVERN", "4x7"),
        ("ft-warehouse", "WAREHOUSE", "4x7"),
    ]

    alley_gap = 8  # 8px breathing alley -> both rows equal 320 + 32 = 352px!
    pad_x = 24
    row_span = sum(sprites[k].width for k, _, _ in row1) + alley_gap * (len(row1) - 1)
    assert row_span == sum(sprites[k].width for k, _, _ in row2) + alley_gap * (len(row2) - 1)

    W = row_span + pad_x * 2  # 400 px
    H = 408                   # 408 px (2x = 800 x 816)

    bg_dark = hx3("#1e2129")
    bg_lite = hx3("#252934")
    sheet = Image.new("RGBA", (W, H), (*bg_dark, 255))
    px = sheet.load()

    for y in range(H):
        for x in range(W):
            if ((x // 12) + (y // 12)) % 2 == 1:
                px[x, y] = (*bg_lite, 255)

    for x in range(16, W - 16):
        px[x, 20] = (*hx3("#363c4a"), 255)
    draw_pixel_text(
        px, W, H, W // 2, 10,
        "FANTASY TOWN CARBON - 10 BUILDING STREET LINEUP",
        fg=hx3("#f2e8c4"), shadow=hx3("#14161d"), center=True,
    )

    def paint_street_strip(y_base: int, row_title: str, y_header: int, items: List[Tuple[str, str, str]]) -> None:
        draw_pixel_text(
            px, W, H, pad_x, y_header,
            row_title,
            fg=hx3("#d2cabd"), shadow=hx3("#14161d"), center=False,
        )

        sx0 = pad_x - 10
        sx1 = W - pad_x + 10
        for y in range(y_base - 4, y_base + 23):
            for x in range(sx0, sx1):
                is_end = x in (sx0, sx1 - 1)
                if y == y_base - 4:
                    c = WALL_OUT
                elif y == y_base - 3:
                    c = WALL_CAP if not is_end else WALL_OUT
                elif y <= y_base + 2:
                    joint = ((x + 5) % 18 == 0)
                    c = SANCTUARY_MORTAR if joint else (SANCTUARY_SLABS[3] if y == y_base - 2 else SANCTUARY_SLABS[2])
                elif y == y_base + 3:
                    c = WALL_GLINT if (x % 16 != 0) else WALL_MID
                elif y in (y_base + 4, y_base + 5):
                    c = WALL_SHADE if (y == y_base + 4 and x % 16 != 0) else WALL_DARK
                elif y == y_base + 6:
                    c = hx3("#49424e")
                elif y < y_base + 21:
                    c = sample_cobble_color(x, y, COBBLE_WARM, COBBLE_MORTAR, moss_prob=0.06, seed=401 + y_base)
                elif y == y_base + 21:
                    c = WALL_DARK
                else:
                    c = WALL_OUT
                if is_end and y > y_base - 4:
                    c = WALL_OUT
                px[x, y] = (*c, 255)

        cx = pad_x
        placements_row = []
        for key, label, dims in items:
            im = sprites[key]
            bx = cx
            by = y_base - im.height
            placements_row.append((key, label, dims, im, bx, by))
            cx += im.width + alley_gap

        for _, _, _, im, bx, by in placements_row:
            stamp_building_grounding_shadow(sheet, im, bx, by, cast_dx=4, cast_dy=4, cast_alpha=85)

        for _, label, dims, im, bx, by in placements_row:
            sheet.alpha_composite(im, (bx, by))
            mid_x = bx + im.width // 2
            draw_pixel_text(
                px, W, H, mid_x, y_base + 26,
                label,
                fg=hx3("#eef2f2"), shadow=hx3("#14161d"), center=True,
            )
            draw_pixel_text(
                px, W, H, mid_x, y_base + 34,
                dims,
                fg=hx3("#9c9a82"), shadow=hx3("#14161d"), center=True,
            )

    paint_street_strip(
        y_base=168,
        row_title="ROW 1 : UPPER TOWN & GUILD ROW",
        y_header=28,
        items=row1,
    )
    paint_street_strip(
        y_base=354,
        row_title="ROW 2 : MARKET & HARBOR ROW",
        y_header=222,
        items=row2,
    )

    out_1x = OUT_DIR / "fantasy_town_10_lineup_1x.png"
    out_2x = OUT_DIR / "fantasy_town_10_lineup_2x.png"
    rgb_1x = sheet.convert("RGB")
    rgb_1x.save(out_1x)
    rgb_1x.resize((W * 2, H * 2), Image.Resampling.NEAREST).save(out_2x)
    return out_1x, out_2x


# ---------------------------------------------------------------------------
# DELIVERABLE 2: Non-Rectangular Medieval Harbor-Town Plaza v2 Map (38x28)
# ---------------------------------------------------------------------------
BUILDINGS_SPEC = [
    # (id, gx, gy, gw, gh, doorstep_cell, extra_open_front_cells, zone_name)
    ("ft-chapel",     8,  1, 5, 7, (10, 8), [(9, 8), (11, 8)],   "North Sanctuary Terrace"),
    ("ft-clocktower", 14, 0, 3, 8, (15, 8), [(14, 8), (16, 8)],  "North Sanctuary Terrace"),
    ("ft-magic",      23, 1, 4, 7, (26, 8), [(25, 8)],           "North-East Arcane Corner"),
    ("ft-apothecary", 28, 2, 3, 7, (30, 9), [(29, 9)],           "North-East Arcane Corner"),
    ("ft-guild",      1,  7, 5, 7, (3, 14), [(2, 14), (4, 14)],  "West Civic & Forge Row"),
    ("ft-smithy",     2, 17, 4, 7, (4, 24), [(3, 24), (5, 24)],  "West Civic & Forge Row"),
    ("ft-armory",     7, 18, 4, 7, (9, 25), [(8, 25), (10, 25)], "West Civic & Forge Row"),
    ("ft-inn",        13, 19, 4, 7, (15, 26), [(14, 26), (16, 26)], "Central-South Traveler's Corner"),
    ("ft-tavern",     21, 12, 4, 7, (23, 19), [(22, 19), (24, 19)], "South-East Harbor Promenade"),
    ("ft-warehouse",  26, 11, 4, 7, (27, 18), [(28, 18)],        "South-East Harbor Promenade"),
]


def in_timber_pier(x: int, y: int) -> bool:
    """3-tile wide (48px: x=416..463, gx=26..28) heavy timber harbor pier jutting into azure sea."""
    return (416 <= x < 464) and (336 <= y < 416)


def ne_headland_cliff_lip(x: int) -> int:
    """Organic curving craggy coastal cliff lip on the NE headland (x >= 544)."""
    t = (x - 544.0) / 64.0
    return int(round(176.0 + 26.0 * (t ** 1.15) + 4.5 * math.sin(x * 0.09) + (vnoise(x, 180, 7.0, 631) - 0.5) * 5.0))


def harbor_seawall_south_lip(x: int) -> Optional[int]:
    """
    Stepped non-rectangular harbor seawall lip along the South-East waterfront,
    transitioning into an organic craggy coastal headland cliff for x >= 544!
    """
    if x < 304:  # gx < 19: land headland continues to south border
        return None
    if x < 368:  # gx = 19..22: SW Harbor Promenade step
        return 368  # gy = 23
    if x < 496:  # gx = 23..30: Central Pier Quay step
        return 336  # gy = 21
    if x < 544:  # gx = 31..33: East Quay Bastion step
        return 320  # gy = 20
    return ne_headland_cliff_lip(x)


def is_harbor_water_px(x: int, y: int) -> bool:
    lip = harbor_seawall_south_lip(x)
    if lip is None:
        return False
    if x >= 544:
        return y >= lip + 22
    return y >= lip + 20


def sanctuary_north_crown(x: int) -> Optional[int]:
    """Stepped northern stone parapet crowning the Elevated Sanctuary Terrace (x=96..319)."""
    if x < 96 or x >= 320:
        return None
    if x < 120 or x >= 296:
        return 26
    return 14


def sanctuary_south_lip(x: int) -> Optional[int]:
    """Stepped octagonal southern stone retaining wall lip of the Elevated Sanctuary Terrace."""
    if x < 96 or x >= 320:
        return None
    if x < 128 or x >= 288:
        return 144  # Outer bastion step (gy = 9)
    return 160      # Central terrace projection (gy = 10)


def in_sanctuary_grand_stairs(x: int, y: int) -> bool:
    """3-tile wide (48px: gx=11..13 -> x=176..223) Grand Stone Staircase climbing y=191 -> y=154."""
    return (176 <= x < 224) and (154 <= y <= 192)


def dist_to_polyline(x: float, y: float, pts: Sequence[Tuple[float, float]]) -> float:
    best = 1e9
    for i in range(len(pts) - 1):
        x1, y1 = pts[i]
        x2, y2 = pts[i + 1]
        vx, vy = x2 - x1, y2 - y1
        wx, wy = x - x1, y - y1
        l2 = vx * vx + vy * vy
        t = 0.0 if l2 == 0 else max(0.0, min(1.0, (wx * vx + wy * vy) / l2))
        px_, py_ = x1 + t * vx, y1 + t * vy
        best = min(best, math.hypot(x - px_, y - py_))
    return best


def town_pave_zone(x: int, y: int) -> Tuple[str, float]:
    """
    Returns ('none' | 'sanctuary' | 'plaza' | 'quay', strength) for organic frayed stone paving.
    """
    # 1. Elevated North Sanctuary Terrace paving
    s_lip = sanctuary_south_lip(x)
    s_top = sanctuary_north_crown(x)
    if s_lip is not None and s_top is not None and y < s_lip:
        if 104 <= x <= 311 and y >= s_top + 6:
            edge_fade = min((x - 100) / 10.0, (315 - x) / 10.0, (y - s_top) / 10.0, 1.2)
            return ("sanctuary", edge_fade)
        return ("none", 0.0)

    # 2. Central Scalloped Octagonal Fountain Plaza centered at (264, 248)
    dx = (x - 264.0) / 86.0
    dy = (y - 246.0) / 62.0
    ang = math.atan2(dy, dx)
    oct_mod = 1.0 + 0.08 * math.cos(8.0 * ang) + 0.08 * (fbm(x, y, 71) - 0.5)
    r_oct = math.hypot(dx, dy) / oct_mod
    s_plaza = max(0.0, 1.34 - r_oct)

    # Inner octagonal pale-ashlar court cradling the 3x3 Azure Fountain (zero thin line artifacts!)
    f_dx = abs(x - 264.0)
    f_dy = abs(y - 248.0) * 1.12
    f_oct = max(f_dx, f_dy, (f_dx + f_dy) * 0.73)
    if f_oct <= 39.0:
        return ("sanctuary", 1.25)

    # 3. West Gate Avenue & Guild Stone Forecourt
    d_west = dist_to_polyline(x, y, [(0, 246), (64, 246), (128, 248), (196, 248)])
    s_west = max(0.0, 1.15 - d_west / 28.0)
    if 18 <= x <= 98 and 220 <= y <= 268:
        s_west = max(s_west, 1.12)

    # 4. South-West Artisan Loop (in front of ft-smithy & ft-armory)
    d_artisan = dist_to_polyline(x, y, [(46, 256), (34, 320), (38, 398), (92, 408), (160, 412), (196, 412)])
    s_artisan = max(0.0, 1.05 - d_artisan / 22.0)

    # 5. South Town Road Entrance & Inn Forecourt
    d_south = dist_to_polyline(x, y, [(200, 272), (194, 344), (196, 416), (196, 448)])
    s_south = max(0.0, 1.16 - d_south / 25.0)
    d_inn = dist_to_polyline(x, y, [(196, 418), (244, 422), (286, 410), (316, 360)])
    s_inn = max(0.0, 1.08 - d_inn / 22.0)

    # 6. North Approach to Grand Stairs
    d_stairs = dist_to_polyline(x, y, [(200, 188), (200, 224)])
    s_stairs = max(0.0, 1.18 - d_stairs / 30.0)

    # 7. North-East Arcane Lane & Herb Courtyard (in front of ft-magic & ft-apothecary)
    d_arcane = dist_to_polyline(x, y, [(316, 210), (348, 166), (408, 146), (488, 156), (516, 188), (508, 288)])
    s_arcane = max(0.0, 1.10 - d_arcane / 24.0)
    d_alley = dist_to_polyline(x, y, [(408, 152), (408, 312)])
    s_alley = max(0.0, 1.04 - d_alley / 14.0)

    # 8. South-East Waterfront Harbor Quay Promenade
    hw_lip = harbor_seawall_south_lip(x)
    if hw_lip is not None and x < 544 and 282 <= y < hw_lip:
        d_quay_top = (y - 282) / 18.0
        s_quay = min(1.25, 0.72 + d_quay_top * 0.55)
        if s_quay > max(s_plaza, s_inn, s_arcane):
            return ("quay", s_quay)
    if 396 <= x < 538 and 276 <= y < 320:
        return ("quay", 1.12)

    best_warm = max(s_plaza, s_west, s_artisan, s_south, s_inn, s_stairs, s_arcane, s_alley)
    if best_warm > 0.36:
        return ("plaza", best_warm)
    return ("none", 0.0)


# ---------------------------------------------------------------------------
# Terrain, Retaining Walls, Stepped Seawall, Azure Sea & Timber Pier Painter
# ---------------------------------------------------------------------------
WALL_COURSES: List[Tuple[int, int, int]] = []
for _wi in range(90):
    _wh = [6, 7, 6, 8, 7][_wi % 5]
    for _wly in range(_wh):
        WALL_COURSES.append((_wi, _wly, _wh))


def paint_dressed_wall_px(x: int, y: int, top_y: int, bot_y: int, is_corner: bool = False, seed: int = 601) -> Tuple[int, int, int]:
    fy = y - top_y
    h_tot = max(6, bot_y - top_y)
    if fy == 0:
        return WALL_OUT
    if fy == 1:
        return WALL_GLINT if (x % 16 != 0) else WALL_LIT
    if fy == 2:
        return WALL_CAP if (x % 16 != 0) else WALL_WARM
    if fy == 3:
        return WALL_SHADE
    if fy >= h_tot - 1:
        return WALL_OUT
    if fy == h_tot - 2:
        return WALL_DARK

    wr, wly, wh = WALL_COURSES[y % len(WALL_COURSES)]
    if is_corner:
        c = WALL_DARK if wly == wh - 1 else (WALL_GLINT if wly == 0 else WALL_CAP)
        return mul_rgb(c, 0.88) if fy > h_tot // 2 else c

    bw = [17, 21, 15, 23, 19][wr % 5]
    off = int(h2(wr, 7, seed) * 29)
    lx = (x + off) % bw
    bid = (x + off) // bw

    if wly == wh - 1 or lx == bw - 1:
        c = WALL_DARK
    else:
        pick = h2(bid, wr, seed + 17)
        c = WALL_MID if pick < 0.28 else (WALL_WARM if pick < 0.68 else WALL_LIT)
        if wly == 0 and lx < bw - 2:
            c = lerp_rgb(c, WALL_CAP, 0.40)

    if seed == 601:
        ivy = max(0.0, vnoise(x, top_y, 10.0, 619) - 0.54) * 34.0
        if 4 <= fy <= 4 + int(ivy) and not (172 <= x <= 228):
            return GRASS_RAMP[2 if fy > 3 + int(ivy) - 2 else (5 if h2(x, y, 623) < 0.35 else 3)]

    if fy > h_tot // 2:
        c = mul_rgb(c, 0.86)
    return c


def grass_world_px(x: int, y: int) -> Tuple[int, int, int]:
    f = fbm(x, y, 41)
    m = h2(x // 2, y // 2, 43)
    v = f * 0.78 + m * 0.22
    if v < 0.26:
        idx = 3
    elif v < 0.48:
        idx = 4
    elif v < 0.70:
        idx = 5
    elif v < 0.86:
        idx = 6
    else:
        idx = 7

    tuft = h2(x, y, 47)
    if tuft < 0.020 and idx < 7:
        idx += 1
    elif tuft > 0.982 and idx > 3:
        idx -= 1

    if h2(x, y, 53) < 0.0022 and f > 0.52:
        return [hx3("#faf3dc"), hx3("#f6cc7c"), hx3("#f4c8cc")][int(h2(x, y, 59) * 3) % 3]
    return GRASS_RAMP[idx]


def paint_base_world(img: Image.Image) -> None:
    px = img.load()

    # 1. Paint Meadow Turf + Frayed World-Coord Cobblestones
    for y in range(H_PX):
        for x in range(W_PX):
            c = grass_world_px(x, y)
            kind, strength = town_pave_zone(x, y)
            if kind != "none":
                ci, sid, _, _, _, _ = cobble_cell(x, y)
                keep = True
                if strength < 0.68:
                    prob = max(0.0, (strength - 0.36) / 0.32)
                    if h2(ci, sid, 301) > prob * 0.95:
                        keep = False
                if keep:
                    moss_p = max(0.0, 0.74 - strength) * 1.35
                    if kind == "sanctuary":
                        # Border joint around inner octagonal fountain court
                        f_dx = abs(x - 264.0)
                        f_dy = abs(y - 248.0) * 1.12
                        f_oct = max(f_dx, f_dy, (f_dx + f_dy) * 0.73)
                        if y > 180 and 37.5 <= f_oct <= 39.0:
                            c = SANCTUARY_MORTAR
                        else:
                            c = sample_cobble_color(x, y, SANCTUARY_SLABS, SANCTUARY_MORTAR, moss_prob=0.04, seed=311)
                    elif kind == "quay":
                        c = sample_cobble_color(x, y, QUAY_SLABS, QUAY_MORTAR, moss_prob=0.04, seed=331)
                    else:
                        c = sample_cobble_color(x, y, COBBLE_WARM, COBBLE_MORTAR, moss_prob=moss_p, seed=307)
            px[x, y] = (*c, 255)

    # 2. Sculpt Elevated North Sanctuary Terrace: Stepped North Parapet + Side Cheek Walls + Corner Piers
    for x in range(96, 320):
        ntop = sanctuary_north_crown(x)
        if ntop is not None:
            is_n_step = (sanctuary_north_crown(x - 1) != ntop) or (sanctuary_north_crown(x + 1) != ntop)
            for y in range(ntop, ntop + 10):
                c = paint_dressed_wall_px(x, y, ntop, ntop + 10, is_corner=is_n_step, seed=607)
                px[x, y] = (*c, 255)

    for y in range(26, 146):
        # West retaining cheek (x=96..103)
        for x in range(96, 104):
            if x in (96, 103) or y == 26:
                c = WALL_OUT if x == 96 else WALL_DARK
            elif x in (97, 98):
                c = WALL_GLINT if y < 32 else WALL_CAP
            else:
                c = WALL_WARM if y % 7 != 0 else WALL_SHADE
            px[x, y] = (*c, 255)
        # East retaining cheek (x=312..319) + cast shadow
        for x in range(312, 320):
            if x in (312, 319) or y == 26:
                c = WALL_OUT if x == 319 else WALL_DARK
            elif x in (313, 314):
                c = WALL_GLINT if y < 32 else WALL_CAP
            else:
                c = WALL_MID if y % 7 != 0 else WALL_DARK
            px[x, y] = (*c, 255)
        for sx in range(320, 325):
            r, g, b, _ = px[sx, y]
            px[sx, y] = (*mul_rgb((r, g, b), 0.72 + 0.05 * (sx - 320)), 255)

    # South Stepped Sanctuary Retaining Wall + Carved Balustrade + Grand Stairs
    for x in range(96, 320):
        lip = sanctuary_south_lip(x)
        if lip is None:
            continue
        prev_lip = sanctuary_south_lip(x - 1)
        next_lip = sanctuary_south_lip(x + 1)
        is_step = (prev_lip != lip) or (next_lip != lip)
        wall_h = 32

        if in_sanctuary_grand_stairs(x, 170):
            for y in range(154, 193):
                if x < 182 or x >= 218:
                    is_out = x in (176, 223)
                    is_in = x in (181, 218)
                    if is_out or is_in or y in (154, 192):
                        c = WALL_OUT if (is_out or y == 192) else WALL_DARK
                    else:
                        c = WALL_GLINT if (y - 154) % 9 in (0, 1) else WALL_CAP
                    px[x, y] = (*c, 255)
                else:
                    sy = (y - 156) % 5
                    joint_x = ((x + ((y - 156) // 5) * 11) % 17 == 0)
                    if y < 156:
                        c = WALL_GLINT
                    elif sy == 0:
                        c = WALL_GLINT if not joint_x else WALL_WARM
                    elif sy in (1, 2):
                        c = SANCTUARY_SLABS[3] if not joint_x else SANCTUARY_MORTAR
                    elif sy == 3:
                        c = WALL_MID
                    else:
                        c = WALL_DARK
                    if x in (182, 217):
                        c = mul_rgb(c, 0.84)
                    px[x, y] = (*c, 255)
            continue

        for y in range(lip - 7, lip):
            fy_b = y - (lip - 7)
            baluster = (x % 6 in (1, 2, 3)) or (x % 24 in (0, 1, 2, 3))
            if fy_b == 0:
                c = WALL_OUT
            elif fy_b == 1:
                c = WALL_GLINT
            elif fy_b == 2:
                c = WALL_SHADE
            elif fy_b in (3, 4):
                if baluster:
                    c = WALL_CAP if (x % 6 == 1) else WALL_WARM
                else:
                    continue
            elif fy_b == 5:
                c = WALL_CAP
            else:
                c = WALL_DARK
            px[x, y] = (*c, 255)

        for y in range(lip, lip + wall_h):
            c = paint_dressed_wall_px(x, y, lip, lip + wall_h, is_corner=is_step, seed=601)
            px[x, y] = (*c, 255)

        for dy_s in range(5):
            yy = lip + wall_h + dy_s
            if yy < H_PX:
                r, g, b, _ = px[x, yy]
                px[x, yy] = (*mul_rgb((r, g, b), 0.58 + 0.08 * dy_s), 255)

    # 3. Paint Shimmering 3/4 Azure Harbor Sea + Stepped Stone Seawall + Organic NE Coastal Cliff
    for y in range(H_PX):
        for x in range(W_PX):
            lip = harbor_seawall_south_lip(x)
            if lip is None:
                continue

            # Organic Craggy NE Coastal Cliff Face (x >= 544, y = lip .. lip + 22)
            if x >= 544 and lip <= y < lip + 22:
                dy_c = y - lip
                vine_l = 2 + int(max(0.0, vnoise(x, lip, 6.0, 643) - 0.40) * 9.0)
                if dy_c <= vine_l:
                    c = GRASS_RAMP[1 if dy_c == vine_l else (4 if dy_c <= 2 else 2)]
                elif dy_c >= 19:
                    c = SEA_FOAM if h2(x, y, 647) < 0.45 else WALL_DARK
                else:
                    strata = vnoise(x * 0.7, y * 1.3, 5.5, 651)
                    fiss = abs(math.sin(x * 0.27 + strata * 2.4)) < 0.14
                    if fiss:
                        c = WALL_OUT if dy_c > 10 else WALL_DARK
                    elif strata > 0.58 and dy_c < 13:
                        c = WALL_CAP
                    elif strata > 0.38:
                        c = WALL_WARM if dy_c < 12 else WALL_MID
                    else:
                        c = WALL_SHADE if dy_c < 15 else WALL_DARK
                px[x, y] = (*c, 255)
                continue

            # East Quay vertical seawall parapet along x = 536..544 (y = 176..320)
            if 536 <= x < 545 and 176 <= y < 320:
                if x in (536, 544) or y == 176:
                    c = WALL_OUT
                elif x in (537, 538):
                    c = WALL_GLINT if (y % 14 != 0) else WALL_WARM
                elif x in (539, 540):
                    c = WALL_CAP
                else:
                    c = WALL_SHADE if (y % 8 != 0) else WALL_DARK
                px[x, y] = (*c, 255)
                continue

            # South-facing Stepped Stone Harbor Seawall (x < 544, y = lip .. lip + 20)
            if x < 544 and lip <= y < lip + 20:
                prev_l = harbor_seawall_south_lip(x - 1)
                next_l = harbor_seawall_south_lip(x + 1)
                is_corner = (prev_l != lip) or (next_l != lip)
                c = paint_dressed_wall_px(x, y, lip, lip + 20, is_corner=is_corner, seed=653)
                if y >= lip + 15:
                    if y == lip + 19:
                        c = SEA_FOAM if h2(x, y, 661) < 0.45 else SEA_WAVE
                    else:
                        c = GRASS_RAMP[2] if h2(x // 2, y, 667) < 0.45 else mul_rgb(c, 0.72)
                px[x, y] = (*c, 255)
                continue

            # Shimmering 3/4 Azure Harbor Sea Water (organic staggered wavelets, zero rigid bars!)
            if is_harbor_water_px(x, y):
                dist_south_wall = (y - (lip + 20)) if x < 544 else (y - (lip + 22))
                dist_east_wall = (x - 545) if (x >= 545 and y < 340) else 999
                shore_d = min(dist_south_wall, dist_east_wall)

                if dist_south_wall < 6 and x < 544:
                    c = SEA_SHADOW if dist_south_wall < 3 else SEA_ABYSS
                elif dist_south_wall < 5 and x >= 544:
                    c = SEA_SHADOW if dist_south_wall < 2 else SEA_DEEP
                elif dist_east_wall < 5:
                    c = SEA_SHADOW if dist_east_wall < 2 else SEA_ABYSS
                elif shore_d < 11:
                    c = SEA_SHALLOW if shore_d < 8 else SEA_MID
                else:
                    n_sea = fbm(x * 0.72, y * 1.4, 701)
                    if shore_d > 48 and n_sea < 0.44:
                        c = SEA_ABYSS
                    elif n_sea < 0.48:
                        c = SEA_DEEP
                    elif n_sea < 0.76:
                        c = SEA_MID
                    else:
                        c = SEA_SHALLOW

                # Gentle staggered 4..9px 3/4 wave glints (sparse & organic!)
                cell_wy = y // 5
                row_phase = int(h2(cell_wy, 3, 711) * 23)
                ly_w = y % 5
                if ly_w == 0 and shore_d >= 5:
                    seg = (x + row_phase) // 13
                    lx_seg = (x + row_phase) % 13
                    wv = h2(seg, cell_wy, 719)
                    if wv < 0.14 and 2 <= lx_seg <= 7 + int(wv * 25):
                        c = SEA_FOAM if (wv < 0.045 and 4 <= lx_seg <= 6) else SEA_WAVE
                elif shore_d in (0, 1) and h2(x // 2, y, 727) < 0.45:
                    c = SEA_FOAM

                px[x, y] = (*c, 255)

    # SW Headland vertical seawall cheek along x = 300..305, y = 368..447
    for y in range(368, H_PX):
        for x in range(300, 306):
            if x in (300, 305):
                c = WALL_OUT
            elif x in (301, 302):
                c = WALL_CAP
            else:
                c = WALL_SHADE if y % 7 else WALL_DARK
            px[x, y] = (*c, 255)

    # 4. Paint Heavy Timber Harbor Pier
    paint_timber_pier(img)


def paint_timber_pier(img: Image.Image) -> None:
    px = img.load()
    wood = RAMPS["wood"]
    cedar = RAMPS["cedar"]
    dwood = RAMPS["darkwood"]

    x0, x1 = 416, 463
    y0, y1 = 334, 415

    for y in range(356, min(H_PX, y1 + 14)):
        for x in range(x0 + 3, x1 + 9):
            if is_harbor_water_px(x, y):
                r, g, b, _ = px[x, y]
                px[x, y] = (*mul_rgb((r, g, b), 0.70), 255)

    for py_top in (366, 392, 413):
        for px_p in (x0 + 2, x0 + 21, x1 - 5):
            for dy in range(11):
                yy = py_top + dy
                if yy >= H_PX:
                    break
                for dx in range(5):
                    xx = px_p + dx
                    if dx in (0, 4):
                        c = dwood[0]
                    elif dy >= 9:
                        c = SEA_FOAM if (dx + dy) % 2 == 0 else SEA_WAVE
                    else:
                        c = wood[4] if dx == 1 else dwood[2]
                    px[xx, yy] = (*c, 255)

    for y in range(y0, y1 + 1):
        ly = (y - y0) % 5
        plank_id = (y - y0) // 5
        for x in range(x0, x1 + 1):
            if x < x0 + 4 or x > x1 - 4:
                lx_b = (x - x0) if x < x0 + 4 else (x - (x1 - 3))
                if lx_b in (0, 3) or y in (y0, y1):
                    c = dwood[0]
                elif lx_b == 1:
                    c = cedar[5] if y % 12 != 0 else dwood[2]
                else:
                    c = wood[4]
                px[x, y] = (*c, 255)
                continue

            if y == y1:
                c = dwood[0]
            elif y == y1 - 1:
                c = dwood[2]
            elif ly == 4:
                c = dwood[1]
            else:
                joint_x = ((x + plank_id * 13) % 19 == 0)
                if joint_x:
                    c = dwood[2]
                else:
                    tone = 4 if h2(plank_id, x // 19, 809) < 0.55 else 3
                    if ly == 0:
                        tone += 1
                    if x in (x0 + 5, x1 - 5) and ly == 2:
                        c = RAMPS["steel"][1]
                    else:
                        c = cedar[min(6, tone)]
            px[x, y] = (*c, 255)


# ---------------------------------------------------------------------------
# Hand-Crafted Fable-Palette Town Props
# ---------------------------------------------------------------------------
def make_oak_tree(variant: int = 0) -> Image.Image:
    w, h = 32, 42
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    fol = RAMPS["foliage"]
    wood = RAMPS["wood"]
    dwood = RAMPS["darkwood"]

    for y in range(26, 41):
        for x in range(11, 21):
            half = 3.2 + (max(0, y - 35) * 0.55)
            dx = x - 15.5
            if abs(dx) <= half:
                if abs(dx) >= half - 1.0 or y == 40:
                    c = dwood[0]
                elif dx < -0.5:
                    c = wood[5] if y % 3 else wood[4]
                elif dx < 1.2:
                    c = wood[3]
                else:
                    c = dwood[2]
                px[x, y] = (*c, 255)

    puffs = [
        (15.5, 16.5, 13.5, 11.5),
        (9.5, 18.5, 8.5, 7.5),
        (21.5, 19.0, 8.5, 7.5),
        (14.5, 10.0, 10.0, 8.0),
        (19.0, 12.5, 8.5, 7.0),
    ]
    for y in range(1, 32):
        for x in range(1, 31):
            d_min = 9.9
            for cx, cy, rx, ry in puffs:
                d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
                if d < d_min:
                    d_min = d
            wob = (h2(x // 2, y // 2, 901 + variant) - 0.5) * 0.22
            if d_min + wob <= 1.0:
                if d_min + wob > 0.84:
                    c = fol[0]
                else:
                    lit = (19.0 - y) * 0.052 + (17.0 - x) * 0.025 + (h2(x // 2, y // 2, 911 + variant) - 0.5) * 0.36
                    if y >= 25:
                        idx = 1 if lit < -0.1 else 2
                    elif lit > 0.52:
                        idx = 6 if (x + y + variant) % 3 == 0 else 5
                    elif lit > 0.24:
                        idx = 5 if h2(x, y, 919) < 0.55 else 4
                    elif lit > -0.05:
                        idx = 4 if h2(x, y, 923) < 0.6 else 3
                    elif lit > -0.32:
                        idx = 2
                    else:
                        idx = 1
                    c = fol[idx]
                px[x, y] = (*c, 255)
    return im


def make_cypress_tree() -> Image.Image:
    w, h = 20, 44
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    fol = RAMPS["foliage"]
    wood = RAMPS["wood"]
    dwood = RAMPS["darkwood"]

    for y in range(34, 43):
        for x in range(7, 13):
            if x in (7, 12) or y == 42:
                c = dwood[0]
            else:
                c = wood[4] if x <= 9 else dwood[2]
            px[x, y] = (*c, 255)

    for y in range(2, 36):
        t = (y - 2) / 33.0
        hw = 1.4 + 6.4 * math.sin(min(1.0, t * 1.12) * math.pi * 0.78)
        wob = 0.7 * math.sin(y * 0.7)
        for x in range(1, 19):
            dx = x - 9.5
            if abs(dx) <= hw + wob * 0.4:
                if abs(dx) >= hw - 0.85 or y in (2, 35):
                    c = fol[0]
                elif dx < -1.0 and y < 28:
                    c = fol[5] if (y % 4 in (0, 1) and dx > -hw + 2) else fol[4]
                elif dx < 1.5:
                    c = fol[3] if (x + y) % 3 else fol[4]
                else:
                    c = fol[2] if y < 26 else fol[1]
                px[x, y] = (*c, 255)
    return im


def make_central_fountain_3x3() -> Image.Image:
    w, h = 48, 48
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    cx, cy = 23.5, 26.5

    for y in range(6, 47):
        for x in range(2, 46):
            dx = abs(x - cx)
            dy = abs(y - cy) * 1.16
            oct_d = max(dx, dy, (dx + dy) * 0.73)
            if oct_d <= 21.0:
                if oct_d > 19.6:
                    c = WALL_OUT
                elif oct_d > 17.8:
                    c = WALL_GLINT if (y < cy and x < cx + 6) else WALL_CAP
                elif oct_d > 15.8:
                    c = WALL_DARK if y < cy else WALL_LIT
                else:
                    r_rip = oct_d
                    if 10.5 <= r_rip <= 11.8 and (x + y) % 3 != 0:
                        c = SEA_FOAM
                    elif 6.5 <= r_rip <= 7.8:
                        c = SEA_WAVE
                    elif y < cy - 2:
                        c = RAMPS["glass"][3]
                    else:
                        c = RAMPS["glass"][4] if (x + y) % 5 != 0 else SEA_WAVE
                px[x, y] = (*c, 255)

    for y in range(41, 47):
        for x in range(8, 40):
            if px[x, y - 4][3] > 0 and y >= 43:
                if y == 46 or x in (8, 39):
                    px[x, y] = (*WALL_OUT, 255)
                else:
                    px[x, y] = (*(WALL_WARM if x % 6 != 0 else WALL_DARK), 255)

    for y in range(8, 31):
        for x in range(16, 32):
            dx = abs(x - 23.5)
            if 15 <= y <= 19 and dx <= 6.5:
                if dx >= 5.5 or y == 19:
                    c = WALL_OUT
                elif y == 15:
                    c = SEA_FOAM if dx < 4.5 else WALL_GLINT
                else:
                    c = WALL_CAP if x < 24 else WALL_MID
                px[x, y] = (*c, 255)
            elif 8 <= y <= 14 and dx <= 2.5:
                if y <= 10:
                    c = SEA_FOAM if dx <= 1.5 else SEA_WAVE
                else:
                    c = WALL_GLINT if x <= 23 else WALL_MID
                px[x, y] = (*c, 255)
            elif 20 <= y <= 29 and dx <= 3.5:
                c = WALL_OUT if dx >= 2.6 else (WALL_CAP if x <= 23 else WALL_SHADE)
                px[x, y] = (*c, 255)

    for sx_sign in (-1, 1):
        for step in range(9):
            wx = int(round(23.5 + sx_sign * (4.5 + step * 0.55)))
            wy = 16 + step
            px[wx, wy] = (*(SEA_FOAM if step % 2 == 0 else SEA_WAVE), 255)
            if step >= 7:
                px[wx + sx_sign, wy] = (*SEA_FOAM, 255)
    return im


def make_market_stall(awning_ramp: str = "red") -> Image.Image:
    w, h = 32, 30
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    aw = RAMPS[awning_ramp]
    cr = RAMPS["cream"]
    wd = RAMPS["wood"]
    dw = RAMPS["darkwood"]

    for y in range(10, 29):
        for px0 in (2, 28):
            px[px0, y] = (*dw[0], 255)
            px[px0 + 1, y] = (*wd[4], 255)

    for y in range(2, 14):
        for x in range(1, 31):
            stripe = ((x - 1) // 4) % 2 == 0
            if x in (1, 30) or y == 2:
                c = dw[0]
            elif y >= 12:
                if ((x - 1) // 2) % 2 == 1 and y == 13:
                    continue
                c = aw[1] if stripe else cr[2]
            else:
                shade = 4 if y < 8 else (3 if y < 10 else 2)
                c = aw[min(len(aw) - 1, shade)] if stripe else cr[min(len(cr) - 1, shade + 1)]
            px[x, y] = (*c, 255)

    for y in range(18, 30):
        for x in range(2, 30):
            if x in (2, 29) or y in (18, 22, 29):
                c = dw[0]
            elif y < 22:
                c = RAMPS["cedar"][5 if y == 19 else 4]
            else:
                c = wd[3] if (x % 5 != 0) else dw[2]
            px[x, y] = (*c, 255)

    goods_cols = (
        [RAMPS["red"][4], RAMPS["yellow"][4], RAMPS["green"][4]]
        if awning_ramp == "red"
        else [RAMPS["blue"][4], RAMPS["orange"][4], RAMPS["teal"][4]]
    )
    for i, gx0 in enumerate((6, 14, 22)):
        gc = goods_cols[i]
        for dy in range(4):
            for dx in range(5):
                if dy == 0 and dx in (0, 4):
                    continue
                c = dw[1] if dy == 3 else (gc if dy < 2 else mul_rgb(gc, 0.78))
                px[gx0 + dx, 16 + dy] = (*c, 255)
    return im


def make_street_lantern() -> Image.Image:
    w, h = 16, 28
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    st = RAMPS["steel"]
    yl = RAMPS["yellow"]
    cr = RAMPS["cream"]

    for y in range(11, 28):
        half = 2 if y >= 24 else 1
        for x in range(8 - half, 8 + half):
            if y == 27 or x == 8 - half:
                c = st[0]
            else:
                c = st[3] if x == 7 else st[1]
            px[x, y] = (*c, 255)

    for x in range(5, 11):
        px[x, 3] = (*st[0], 255)
        px[x, 4] = (*st[4], 255)
        px[x, 10] = (*st[1], 255)
    px[7, 1] = (*st[0], 255)
    px[7, 2] = (*st[4], 255)
    px[8, 2] = (*st[1], 255)

    for y in range(5, 10):
        for x in range(5, 11):
            if x in (5, 10):
                c = st[0]
            elif x in (7, 8) and y in (6, 7):
                c = cr[6]
            else:
                c = yl[4] if y <= 7 else yl[3]
            px[x, y] = (*c, 255)
    return im


def make_wooden_bench() -> Image.Image:
    w, h = 24, 14
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    wd = RAMPS["wood"]
    cd = RAMPS["cedar"]
    dw = RAMPS["darkwood"]
    for y in range(2, 13):
        for x in range(2, 22):
            if y in (2, 5, 7, 10) and 2 <= x <= 21:
                px[x, y] = (*(dw[0] if y in (2, 10) else dw[2]), 255)
            elif y in (3, 4):
                px[x, y] = (*(dw[0] if x in (2, 21) else cd[4]), 255)
            elif y in (8, 9):
                px[x, y] = (*(dw[0] if x in (2, 21) else cd[5 if y == 8 else 3]), 255)
            elif y in (6, 11, 12) and x in (4, 5, 18, 19):
                px[x, y] = (*(dw[0] if y == 12 else wd[2]), 255)
    return im


def make_cargo_crates() -> Image.Image:
    w, h = 24, 20
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    cd = RAMPS["cedar"]
    wd = RAMPS["wood"]
    dw = RAMPS["darkwood"]
    st = RAMPS["steel"]

    def box(x0: int, y0: int, bw: int, bh: int) -> None:
        for y in range(y0, y0 + bh):
            for x in range(x0, x0 + bw):
                if x in (x0, x0 + bw - 1) or y in (y0, y0 + 3, y0 + bh - 1):
                    c = dw[0]
                elif y < y0 + 3:
                    c = cd[5]
                elif x in (x0 + 1, x0 + bw - 2) or (x - x0) == (y - y0 - 3):
                    c = cd[4]
                else:
                    c = wd[4] if (y % 2 == 0) else wd[3]
                px[x, y] = (*c, 255)

    box(1, 7, 12, 12)
    box(5, 1, 10, 9)
    for y in range(8, 19):
        for x in range(13, 22):
            if y in (8, 18) and x in (13, 21):
                continue
            if x in (13, 21) or y in (8, 18):
                c = dw[0]
            elif y in (11, 15):
                c = st[3] if x < 18 else st[1]
            elif y == 9:
                c = cd[4]
            else:
                c = wd[5] if x in (15, 16) else (wd[4] if x < 19 else wd[2])
            px[x, y] = (*c, 255)
    return im


def make_flowerbed() -> Image.Image:
    w, h = 32, 16
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    fol = RAMPS["foliage"]
    fl_cols = [RAMPS["pink"][4], RAMPS["yellow"][4], RAMPS["cream"][6], RAMPS["red"][4]]

    for y in range(8, 16):
        for x in range(1, 31):
            if x in (1, 30) or y in (8, 15):
                c = WALL_OUT
            elif y == 9:
                c = WALL_GLINT
            else:
                c = WALL_CAP if (x % 8 != 0 and y < 13) else WALL_MID
            px[x, y] = (*c, 255)

    for y in range(2, 11):
        for x in range(3, 29):
            if y == 2 and (x % 5 in (0, 4)):
                continue
            if x in (3, 28) or y == 2:
                c = fol[1]
            else:
                r = h2(x, y, 971)
                if r < 0.18 and 3 <= y <= 8:
                    c = fl_cols[(x + y) % len(fl_cols)]
                else:
                    c = fol[5] if y <= 5 else (fol[4] if r < 0.6 else fol[2])
            px[x, y] = (*c, 255)
    return im


def make_potted_herbs() -> Image.Image:
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = im.load()
    br = RAMPS["brick"]
    fol = RAMPS["foliage"]
    tl = RAMPS["teal"]
    for y in range(9, 15):
        hw = 5 if y <= 10 else 4
        for x in range(8 - hw, 8 + hw):
            if x in (8 - hw, 8 + hw - 1) or y == 14:
                c = WALL_OUT
            elif y == 9:
                c = br[5]
            else:
                c = br[4] if x < 8 else br[2]
            px[x, y] = (*c, 255)
    for y in range(3, 10):
        for x in range(3, 13):
            if (x - 7.5) ** 2 + (y - 6.5) ** 2 <= 18.0:
                if (x + y) % 5 == 0 and y <= 6:
                    c = tl[5]
                else:
                    c = fol[5] if y <= 5 else fol[3]
                px[x, y] = (*c, 255)
    return im


def make_harbor_bollard() -> Image.Image:
    im = Image.new("RGBA", (12, 14), (0, 0, 0, 0))
    px = im.load()
    st = RAMPS["steel"]
    st_rope = RAMPS["straw"]
    dw = RAMPS["darkwood"]
    for y in range(9, 13):
        for x in range(2, 10):
            c = dw[1] if (x in (2, 9) or y == 12) else st_rope[4 if y == 9 else 3]
            px[x, y] = (*c, 255)
    for y in range(2, 11):
        for x in range(3 if y in (3, 4) else 4, 9 if y in (3, 4) else 8):
            if y == 2 or x in (3, 8):
                c = st[0]
            elif y == 3:
                c = st[5]
            else:
                c = st[3] if x <= 5 else st[1]
            px[x, y] = (*c, 255)
    return im


def make_smithy_quench_tub() -> Image.Image:
    """16x16 blacksmith outdoor quench water tub + iron tongs outside ft-smithy forge."""
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = im.load()
    wd = RAMPS["wood"]
    dw = RAMPS["darkwood"]
    st = RAMPS["steel"]
    for y in range(5, 15):
        for x in range(2, 14):
            if y in (5, 14) and x in (2, 13):
                continue
            if x in (2, 13) or y in (5, 14):
                c = dw[0]
            elif y in (6, 7):
                c = SEA_WAVE if x < 9 else RAMPS["glass"][4]
            elif y in (9, 12):
                c = st[3] if x < 9 else st[1]
            else:
                c = wd[4] if x < 9 else wd[2]
            px[x, y] = (*c, 255)
    return im


def make_harbor_skiff() -> Image.Image:
    w, h = 34, 18
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    wd = RAMPS["wood"]
    cd = RAMPS["cedar"]
    dw = RAMPS["darkwood"]

    for y in range(4, 15):
        for x in range(2, 32):
            rx = 14.5 - max(0, y - 9) * 0.9
            d = ((x - 16.5) / rx) ** 2 + ((y - 8.5) / 5.2) ** 2
            if d <= 1.0:
                if d > 0.78 or y == 14:
                    c = dw[0]
                elif y <= 6:
                    c = cd[5]
                elif y <= 9:
                    c = cd[4] if x in (11, 12, 20, 21) else dw[2]
                else:
                    c = wd[4] if y == 10 else wd[2]
                px[x, y] = (*c, 255)
    for x in range(6, 28, 2):
        px[x, 15] = (*SEA_FOAM, 255)
    return im


def apply_ground_glow(img: Image.Image, cx: int, cy: int, radius: int, col_hex: str, strength: float = 0.24) -> None:
    px = img.load()
    gc = hx3(col_hex)
    for y in range(max(0, cy - radius), min(H_PX, cy + radius + 1)):
        for x in range(max(0, cx - radius), min(W_PX, cx + radius + 1)):
            if is_harbor_water_px(x, y) and not in_timber_pier(x, y):
                continue
            d = math.hypot(x - cx, (y - cy) * 1.2)
            if d < radius:
                k = ((1.0 - d / radius) ** 1.7) * strength
                r, g, b, a = px[x, y]
                px[x, y] = (*lerp_rgb((r, g, b), gc, k), a)


def apply_tree_shadow(img: Image.Image, cx: int, cy: int, rx: int, ry: int) -> None:
    px = img.load()
    for y in range(max(0, cy - ry), min(H_PX, cy + ry + 1)):
        for x in range(max(0, cx - rx), min(W_PX, cx + rx + 1)):
            if is_harbor_water_px(x, y):
                continue
            d = ((x - cx) / float(rx)) ** 2 + ((y - cy) / float(ry)) ** 2
            if d < 0.95:
                r, g, b, a = px[x, y]
                px[x, y] = (*mul_rgb((r, g, b), 0.78 + 0.14 * d), a)


# ---------------------------------------------------------------------------
# Prop Catalog & Placements + Automated BFS Walkability Verification
# ---------------------------------------------------------------------------
def build_props_and_placements() -> Tuple[Dict[str, Image.Image], List[Tuple[str, int, int, List[Tuple[int, int]]]]]:
    props = {
        "oak_a": make_oak_tree(0),
        "oak_b": make_oak_tree(3),
        "cypress": make_cypress_tree(),
        "fountain_3x3": make_central_fountain_3x3(),
        "stall_red": make_market_stall("red"),
        "stall_blue": make_market_stall("blue"),
        "lantern": make_street_lantern(),
        "bench": make_wooden_bench(),
        "crates": make_cargo_crates(),
        "flowerbed": make_flowerbed(),
        "herbs": make_potted_herbs(),
        "bollard": make_harbor_bollard(),
        "quench_tub": make_smithy_quench_tub(),
        "skiff": make_harbor_skiff(),
    }

    placements: List[Tuple[str, int, int, List[Tuple[int, int]]]] = [
        # --- Central 3x3 Stone Fountain (gx=15..17, gy=14..16 -> x=240, y=224) ---
        ("fountain_3x3", 15 * 16, 14 * 16, [(15, 14), (16, 14), (17, 14), (15, 15), (16, 15), (17, 15), (15, 16), (16, 16), (17, 16)]),

        # --- Striped-Awning Market Stalls framing the Plaza ---
        ("stall_red",  18 * 16, 12 * 16 + 2, [(18, 12), (19, 12), (18, 13), (19, 13)]),
        ("stall_blue", 11 * 16, 16 * 16 + 2, [(11, 16), (12, 16), (11, 17), (12, 17)]),

        # --- North Sanctuary Terrace: Cypresses, Flowerbeds & Symmetrical Flanking Lamps ---
        # Notice lamps sit at (7, 8) & (17, 8) so Chapel & Clocktower front doors are 100% clear!
        ("cypress", 6 * 16 + 12, 3 * 16 + 4, [(7, 5)]),
        ("cypress", 17 * 16 + 12, 3 * 16 + 4, [(18, 5)]),
        ("lantern", 7 * 16, 8 * 16 - 12, [(7, 8)]),
        ("lantern", 18 * 16, 8 * 16 - 12, [(18, 8)]),
        ("flowerbed", 8 * 16, 9 * 16, [(8, 9), (9, 9)]),
        ("flowerbed", 15 * 16, 9 * 16, [(15, 9), (16, 9)]),

        # --- Lush Non-Rectangular Perimeter Oak & Cypress Groves ---
        # NW Woodland Headland (gx=0..5, gy=0..6)
        ("oak_a", 0 * 16 + 2, 0 * 16 + 2, [(0, 2), (1, 2)]),
        ("oak_b", 2 * 16 + 6, 0 * 16 + 6, [(2, 2), (3, 2)]),
        ("oak_a", 4 * 16 + 2, 1 * 16 + 4, [(4, 3), (5, 3)]),
        ("oak_b", 0 * 16 + 6, 3 * 16 + 2, [(0, 5), (1, 5)]),
        ("oak_a", 2 * 16 + 10, 3 * 16 + 6, [(3, 5), (4, 5)]),

        # NE Arcane & Coastal Grove (gx=20..22 & gx=31..37)
        ("cypress", 20 * 16 + 10, 1 * 16 + 6, [(21, 3)]),
        ("oak_a", 20 * 16 + 6, 3 * 16 + 6, [(21, 5), (22, 5)]),
        ("oak_b", 31 * 16 + 8, 0 * 16 + 4, [(32, 2), (33, 2)]),
        ("oak_a", 34 * 16 + 4, 0 * 16 + 10, [(34, 3), (35, 3)]),
        ("cypress", 36 * 16, 1 * 16 + 8, [(36, 4)]),
        ("cypress", 31 * 16 + 6, 3 * 16 + 8, [(31, 5)]),
        ("oak_b", 33 * 16 + 6, 4 * 16 + 2, [(34, 6), (35, 6)]),
        ("oak_a", 35 * 16 + 4, 6 * 16 + 4, [(35, 8), (36, 8)]),
        ("oak_b", 34 * 16 + 8, 8 * 16 + 2, [(35, 10), (36, 10)]),

        # Arcane Potted Herbs & Star Lanterns
        ("herbs", 22 * 16, 7 * 16, [(22, 7)]),
        ("herbs", 27 * 16, 7 * 16, [(27, 7)]),
        ("herbs", 31 * 16, 8 * 16, [(31, 8)]),
        ("lantern", 24 * 16, 8 * 16 - 10, [(24, 8)]),

        # West Civic Forecourt & SW Artisan Woods
        ("lantern", 6 * 16, 13 * 16 - 10, [(6, 13)]),
        ("bench", 1 * 16 + 4, 15 * 16 + 2, [(1, 15), (2, 15)]),
        ("oak_a", 0 * 16, 16 * 16 + 8, [(0, 19), (1, 19)]),
        ("oak_b", 0 * 16, 20 * 16 + 8, [(0, 23), (1, 23)]),
        ("oak_a", 0 * 16 + 4, 24 * 16 + 4, [(0, 26), (1, 26)]),
        ("quench_tub", 2 * 16, 24 * 16, [(2, 24)]),
        ("crates", 6 * 16 - 4, 23 * 16 - 2, [(6, 23)]),
        # SW Avenue Lamp placed at (11, 24) so ft-armory front row (8..10, 25) is 100% unobstructed!
        ("lantern", 11 * 16, 24 * 16 - 10, [(11, 24)]),

        # Central Plaza & South Traveler's Inn Vignette
        ("bench", 15 * 16 + 4, 13 * 16 - 12, [(15, 13), (16, 13)]),
        ("lantern", 14 * 16, 16 * 16 - 10, [(14, 16)]),
        ("lantern", 18 * 16, 16 * 16 - 10, [(18, 16)]),
        ("bench", 17 * 16 + 2, 24 * 16 + 2, [(17, 24), (18, 24)]),
        ("crates", 17 * 16, 22 * 16 + 10, [(17, 23)]),
        ("lantern", 12 * 16, 26 * 16 - 10, [(12, 26)]),
        ("oak_b", 17 * 16 + 4, 25 * 16 + 2, [(17, 27), (18, 27)]),

        # South-East Waterfront Quay, Bollards, Cargo Crates, Timber Pier & Skiff!
        ("crates", 30 * 16 + 2, 16 * 16 + 10, [(30, 17), (31, 17)]),
        ("crates", 20 * 16, 20 * 16 + 10, [(20, 21)]),
        ("lantern", 25 * 16, 18 * 16 - 10, [(25, 18)]),
        ("lantern", 31 * 16, 19 * 16 - 10, [(31, 19)]),
        ("bollard", 20 * 16 + 2, 22 * 16 + 4, [(20, 22)]),
        ("bollard", 24 * 16 + 2, 20 * 16 + 4, [(24, 20)]),
        ("bollard", 29 * 16 + 2, 20 * 16 + 4, [(29, 20)]),
        ("bollard", 32 * 16 + 2, 19 * 16 + 4, [(32, 19)]),
        ("crates", 26 * 16 - 2, 24 * 16 + 8, [(26, 25)]),
        ("bollard", 28 * 16 + 2, 24 * 16 + 14, [(28, 25)]),
        ("skiff", 29 * 16 + 6, 23 * 16 + 6, []),
    ]
    return props, placements


def build_collision_and_verify_bfs(
    placements: List[Tuple[str, int, int, List[Tuple[int, int]]]]
) -> Dict:
    walk = [[True for _ in range(GW)] for _ in range(GH)]
    reason = [["walkable" for _ in range(GW)] for _ in range(GH)]

    for gy in range(GH):
        for gx in range(GW):
            cx, cy = gx * 16 + 8, gy * 16 + 8

            # Walkable Timber Pier
            if in_timber_pier(cx, cy):
                walk[gy][gx] = True
                reason[gy][gx] = "timber_pier"
                continue

            # Dense Perimeter Forest Groves & Back-Cliff Headlands (prevents out-of-bounds pockets)
            if gy == 0:
                walk[gy][gx] = False
                reason[gy][gx] = "north_cliff_border"
                continue
            if gx <= 5 and gy <= 6:
                walk[gy][gx] = False
                reason[gy][gx] = "nw_forest_headland"
                continue
            if gx <= 1 and gy >= 16:
                walk[gy][gx] = False
                reason[gy][gx] = "sw_forest_border"
                continue
            if gy == 27 and gx <= 9:
                walk[gy][gx] = False
                reason[gy][gx] = "south_meadow_verge"
                continue
            if 20 <= gx <= 22 and gy <= 6:
                walk[gy][gx] = False
                reason[gy][gx] = "ne_upper_grove"
                continue
            if gx == 27 and gy <= 6:
                walk[gy][gx] = False
                reason[gy][gx] = "arcane_back_alley"
                continue
            if 28 <= gx <= 30 and gy == 1:
                walk[gy][gx] = False
                reason[gy][gx] = "apothecary_rear_verge"
                continue
            if gx >= 31 and gy <= 7:
                walk[gy][gx] = False
                reason[gy][gx] = "ne_forest_headland"
                continue
            if gx >= 34 and gy <= 11:
                walk[gy][gx] = False
                reason[gy][gx] = "ne_coastal_headland"
                continue

            # Sanctuary Terrace side walls & rear parapet behind Chapel/Clocktower
            if gx in (6, 19) and gy <= 10:
                walk[gy][gx] = False
                reason[gy][gx] = "sanctuary_side_wall"
                continue
            if 7 <= gx <= 18 and gy <= 6:
                walk[gy][gx] = False
                reason[gy][gx] = "sanctuary_rear_bastion"
                continue
            if gx in (7, 18) and gy == 7:
                walk[gy][gx] = False
                reason[gy][gx] = "sanctuary_wing_hedge"
                continue
            if gx == 13 and gy <= 7:
                walk[gy][gx] = False
                reason[gy][gx] = "chapel_clocktower_close"
                continue

            # Harbor seawall & sea water
            lip_hw = harbor_seawall_south_lip(cx)
            if lip_hw is not None:
                if cx >= 536 and cy >= 176:
                    walk[gy][gx] = False
                    reason[gy][gx] = "east_cove_seawall_or_sea"
                    continue
                if cy >= lip_hw:
                    walk[gy][gx] = False
                    reason[gy][gx] = "harbor_seawall_or_sea"
                    continue

            # Sanctuary South Stepped Retaining Wall (except 3-tile wide Grand Stairs gx=11..13!)
            s_lip = sanctuary_south_lip(cx)
            if s_lip is not None:
                if in_sanctuary_grand_stairs(cx, 170) and gy in (10, 11):
                    walk[gy][gx] = True
                    reason[gy][gx] = "grand_stairs"
                    continue
                if s_lip - 4 <= cy <= s_lip + 31:
                    walk[gy][gx] = False
                    reason[gy][gx] = "sanctuary_retaining_wall"
                    continue

    # 2. Mark all 10 building footprints & verify ZERO overlaps
    bldg_occ: Dict[Tuple[int, int], str] = {}
    overlap_errors: List[str] = []
    for bid, bx, by, bw, bh, _, _, _ in BUILDINGS_SPEC:
        for yy in range(by, by + bh):
            for xx in range(bx, bx + bw):
                if not (0 <= xx < GW and 0 <= yy < GH):
                    overlap_errors.append(f"{bid} out of bounds at ({xx},{yy})")
                    continue
                if (xx, yy) in bldg_occ:
                    overlap_errors.append(f"{bid} overlaps {bldg_occ[(xx, yy)]} at ({xx},{yy})")
                bldg_occ[(xx, yy)] = bid
                walk[yy][xx] = False
                reason[yy][xx] = f"building:{bid}"

    assert not overlap_errors, f"Building overlap errors: {overlap_errors}"

    # 3. Mark solid town props
    for pkey, _, _, cells in placements:
        for xx, yy in cells:
            if 0 <= xx < GW and 0 <= yy < GH:
                walk[yy][xx] = False
                reason[yy][xx] = f"prop:{pkey}"

    # 4. Run BFS from South Town Road Entrance (12, 27)
    start = (12, 27)
    assert walk[start[1]][start[0]], f"Start {start} blocked by {reason[start[1]][start[0]]}!"

    visited: Dict[Tuple[int, int], Optional[Tuple[int, int]]] = {start: None}
    q = deque([start])
    while q:
        ux, uy = q.popleft()
        for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
            nx, ny = ux + dx, uy + dy
            if 0 <= nx < GW and 0 <= ny < GH and walk[ny][nx] and (nx, ny) not in visited:
                visited[(nx, ny)] = (ux, uy)
                q.append((nx, ny))

    def path_steps(cell: Tuple[int, int]) -> int:
        if cell not in visited:
            return -1
        d = 0
        cur: Optional[Tuple[int, int]] = cell
        while cur is not None and cur != start:
            cur = visited[cur]
            d += 1
        return d

    door_results = {}
    blocked_doors = 0
    for bid, _, _, _, _, door_cell, extra_cells, zname in BUILDINGS_SPEC:
        ok = door_cell in visited
        if not ok:
            blocked_doors += 1
        door_results[bid] = {
            "doorstep_tile": list(door_cell),
            "zone": zname,
            "reachable": ok,
            "bfs_steps_from_entrance": path_steps(door_cell),
            "front_clearance_ok": all(c in visited for c in extra_cells),
            "reason_if_blocked": None if ok else reason[door_cell[1]][door_cell[0]],
        }

    landmarks = {
        "south_town_road_entrance": start,
        "west_gate_road_entrance": (0, 15),
        "central_fountain_plaza_south": (16, 17),
        "central_fountain_plaza_north": (16, 12),
        "grand_sanctuary_stairs": (12, 10),
        "north_sanctuary_terrace": (12, 8),
        "northeast_arcane_corner": (27, 9),
        "west_guild_forecourt": (3, 15),
        "southwest_artisan_forge_row": (6, 25),
        "waterfront_harbor_promenade": (25, 20),
        "harbor_timber_pier_tip": (27, 25),
    }
    landmark_results = {
        k: {
            "tile": list(cell),
            "reachable": (cell in visited),
            "bfs_steps_from_entrance": path_steps(cell),
            "reason_if_blocked": None if (cell in visited) else reason[cell[1]][cell[0]],
        }
        for k, cell in landmarks.items()
    }

    total_walkable = sum(1 for yy in range(GH) for xx in range(GW) if walk[yy][xx])
    trapped = [
        [xx, yy]
        for yy in range(GH)
        for xx in range(GW)
        if walk[yy][xx] and (xx, yy) not in visited
    ]

    all_landmarks_ok = all(v["reachable"] for v in landmark_results.values())
    all_doors_ok = (blocked_doors == 0) and all(v["front_clearance_ok"] for v in door_results.values())

    return {
        "map_dimensions_tiles": [GW, GH],
        "map_dimensions_px_1x": [W_PX, H_PX],
        "map_dimensions_px_2x": [W_PX * 2, H_PX * 2],
        "buildings_total": len(BUILDINGS_SPEC),
        "building_sprite_overlaps": len(overlap_errors),
        "blocked_doors": blocked_doors,
        "all_doors_and_landmarks_reachable": bool(all_doors_ok and all_landmarks_ok and len(trapped) == 0),
        "reachable_walkable_tiles": len(visited),
        "total_walkable_tiles": total_walkable,
        "trapped_unreachable_tiles_count": len(trapped),
        "trapped_unreachable_sample": trapped[:10],
        "building_doors": door_results,
        "landmarks": landmark_results,
    }


def count_pure_black_and_unique(im: Image.Image) -> Tuple[int, int]:
    arr = np.asarray(im.convert("RGB"), dtype=np.uint8)
    blk = int(np.sum((arr[:, :, 0] == 0) & (arr[:, :, 1] == 0) & (arr[:, :, 2] == 0)))
    packed = (
        (arr[:, :, 0].astype(np.uint32) << 16)
        | (arr[:, :, 1].astype(np.uint32) << 8)
        | arr[:, :, 2].astype(np.uint32)
    )
    uniq = int(np.unique(packed).size)
    return blk, uniq


def build_harbor_town_plaza_v2(sprites: Dict[str, Image.Image]) -> Tuple[Path, Path, Path, Dict]:
    canvas = Image.new("RGBA", (W_PX, H_PX), (*GRASS_RAMP[4], 255))
    paint_base_world(canvas)

    props, prop_placements = build_props_and_placements()

    # 1. Soft dappled tree canopy shadows + building ground contact & SE drop shadows (alpha=85)
    for pkey, px_x, px_y, _ in prop_placements:
        if pkey.startswith("oak_"):
            apply_tree_shadow(canvas, px_x + 17, px_y + 37, rx=16, ry=9)
        elif pkey == "cypress":
            apply_tree_shadow(canvas, px_x + 11, px_y + 39, rx=10, ry=6)
        elif pkey in ("fountain_3x3", "stall_red", "stall_blue"):
            im_p = props[pkey]
            stamp_building_grounding_shadow(canvas, im_p, px_x, px_y, cast_dx=4, cast_dy=3, cast_alpha=75)

    for bid, gx, gy, _, _, _, _, _ in BUILDINGS_SPEC:
        stamp_building_grounding_shadow(
            canvas, sprites[bid], gx * 16, gy * 16, cast_dx=6, cast_dy=5, cast_alpha=85
        )

    # 2. Warm golden streetlamp, smithy forge, and tavern window ground glows
    for pkey, px_x, px_y, _ in prop_placements:
        if pkey == "lantern":
            apply_ground_glow(canvas, px_x + 8, px_y + 24, radius=24, col_hex="#f6cc7c", strength=0.22)
    apply_ground_glow(canvas, 3 * 16 + 4, 24 * 16 + 4, radius=28, col_hex="#e8a448", strength=0.26)
    apply_ground_glow(canvas, 22 * 16 + 8, 19 * 16 + 4, radius=24, col_hex="#f6cc7c", strength=0.18)

    # 3. Y-sorted compositing of all 10 buildings & town props by bottom baseline Y!
    render_queue: List[Tuple[int, int, Image.Image, int, int]] = []
    for bid, gx, gy, _, _, _, _, _ in BUILDINGS_SPEC:
        im_b = sprites[bid]
        bx, by = gx * 16, gy * 16
        render_queue.append((by + im_b.height, bx, im_b, bx, by))

    for pkey, px_x, px_y, _ in prop_placements:
        im_p = props[pkey]
        render_queue.append((px_y + im_p.height, px_x, im_p, px_x, px_y))

    render_queue.sort(key=lambda item: (item[0], item[1]))
    for _, _, im_item, rx, ry in render_queue:
        canvas.alpha_composite(im_item, (rx, ry))

    rgb_map = canvas.convert("RGB")
    pure_black_count, uniq_colors = count_pure_black_and_unique(rgb_map)

    bfs_metrics = build_collision_and_verify_bfs(prop_placements)
    bfs_metrics["pure_black_pixels"] = pure_black_count
    bfs_metrics["unique_rgb_colors"] = uniq_colors

    out_1x = OUT_DIR / "map_fantasy_town_plaza_v2.png"
    out_2x = OUT_DIR / "map_fantasy_town_plaza_v2_2x.png"
    out_metrics = OUT_DIR / "metrics_plaza_v2.json"

    rgb_map.save(out_1x)
    rgb_map.resize((W_PX * 2, H_PX * 2), Image.Resampling.NEAREST).save(out_2x)
    out_metrics.write_text(json.dumps(bfs_metrics, indent=2) + "\n", encoding="utf-8")

    return out_1x, out_2x, out_metrics, bfs_metrics


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bldg_ids = [b[0] for b in BUILDINGS_SPEC]
    sprites = {bid: Image.open(BLDG_DIR / f"{bid}.png").convert("RGBA") for bid in bldg_ids}
    assert len(sprites) == 10, f"Expected 10 buildings, loaded {len(sprites)}"

    lineup_1x, lineup_2x = build_lineup_showcase(sprites)
    map_1x, map_2x, metrics_path, metrics = build_harbor_town_plaza_v2(sprites)

    for p in (lineup_1x, lineup_2x, map_1x, map_2x):
        blk, _ = count_pure_black_and_unique(Image.open(p))
        assert blk == 0, f"{p.name} contains {blk} pure #000000 pixels!"

    print(f"Saved Lineup 1x : {lineup_1x} {Image.open(lineup_1x).size}")
    print(f"Saved Lineup 2x : {lineup_2x} {Image.open(lineup_2x).size}")
    print(f"Saved Plaza  1x : {map_1x} {Image.open(map_1x).size}")
    print(f"Saved Plaza  2x : {map_2x} {Image.open(map_2x).size}")
    print(f"Saved Metrics   : {metrics_path}")
    print(
        f"BFS Verification: doors_blocked={metrics['blocked_doors']} | "
        f"all_pass={metrics['all_doors_and_landmarks_reachable']} | "
        f"reachable={metrics['reachable_walkable_tiles']}/{metrics['total_walkable_tiles']} | "
        f"trapped={metrics['trapped_unreachable_tiles_count']} | "
        f"pure_black={metrics['pure_black_pixels']}"
    )

    if not metrics["all_doors_and_landmarks_reachable"] or metrics["blocked_doors"] != 0:
        raise SystemExit(f"BFS walkability check failed: {json.dumps(metrics, indent=2)}")


if __name__ == "__main__":
    main()
