#!/usr/bin/env python3
"""
Build `ice` Showcase Dungeon Map Architecture v2 — Glacial Sanctuary Cavern (28x22 tiles = 448x352 px)

Architecture v2 Design:
- Non-rectangular, stepped/faceted glacial cavern silhouette inside deep frozen abyss void (#111520)
- Four interconnected chambers separated by thick faceted glacial rock spurs & pinch-pillars:
  1. South Entry Ice Tunnel & Frosted Vestibule (`snow-drift`, `frost-brazier`, `icicles`)
  2. Central Specular Frozen Lake Hall & East Crystal Grotto (world-coordinate translucent teal-sapphire
     ice sheet with diagonal specular reflection streaks & subsurface cracks, crossed by a winding carved
     frost-stone flagstone causeway & bordered by `ice-crystal` clusters)
  3. West Cryo-Reliquary Alcove (`frozen-warrior` hero centerpiece on carved frost-rune plinth, framed by
     `frost-brazier`s and hanging `icicles` along the north glacial wall face)
  4. North Stepped Glacial Altar Apse (elevated stepped frost-stone dais with carved approach stairs,
     sacred cyan frost-rune inlay, `ice-altar` centerpiece, `ice-crystal`s, and `frost-brazier`s)
- Derived `room2.py` 3px icy-slate ceiling inner rim lips + 32px world-coordinate faceted blue-slate
  rock/ice north wall faces (`face == 1, 2`) with hanging `icicles`, 3px wall-foot contact shadow,
  and 6px west-wall soft cast shadow.
- Automated BFS walkability & interaction-cell reachability verification (100% connectivity, 0 trapped cells).
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
import json
import math
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple
from PIL import Image

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
ICE_DIR = ROOT / "tiledata/dungeon-themes-carbon/ice"
OBJ_DIR = ICE_DIR / "objects"

OUT_1X = ICE_DIR / "map_ice_v2.png"
OUT_2X = ICE_DIR / "map_ice_v2_2x.png"
OUT_METRICS = ICE_DIR / "metrics_v2.json"

GW, GH = 28, 22
W_PX, H_PX = GW * 16, GH * 16  # 448 x 352


# ---------------------------------------------------------------------------
# Deterministic World-Coordinate Hash, Smooth Noise & Color Helpers
# ---------------------------------------------------------------------------
def hx3(s: str) -> Tuple[int, int, int]:
    h = s.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def mul(c: Sequence[int], k: float) -> Tuple[int, int, int]:
    return (
        max(0, min(255, int(round(c[0] * k)))),
        max(0, min(255, int(round(c[1] * k)))),
        max(0, min(255, int(round(c[2] * k)))),
    )


def lerp_rgb(a: Tuple[int, int, int], b: Tuple[int, int, int], t: float) -> Tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return (
        int(round(a[0] + (b[0] - a[0]) * t)),
        int(round(a[1] + (b[1] - a[1]) * t)),
        int(round(a[2] + (b[2] - a[2]) * t)),
    )


def H(x: int, y: int, s: int = 0) -> float:
    n = (x * 374761393 + y * 668265263 + s * 1442695041) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


def vnoise(x: float, y: float, scale: float, seed: int = 17) -> float:
    sx, sy = x / scale, y / scale
    ix, iy = math.floor(sx), math.floor(sy)
    fx, fy = sx - ix, sy - iy
    ux = fx * fx * (3.0 - 2.0 * fx)
    uy = fy * fy * (3.0 - 2.0 * fy)
    a = H(ix, iy, seed)
    b = H(ix + 1, iy, seed)
    c = H(ix, iy + 1, seed)
    d = H(ix + 1, iy + 1, seed)
    return (a * (1.0 - ux) + b * ux) * (1.0 - uy) + (c * (1.0 - ux) + d * ux) * uy


def fbm(x: float, y: float, seed: int = 31) -> float:
    return (
        0.55 * vnoise(x, y, 24.0, seed)
        + 0.30 * vnoise(x, y, 11.0, seed + 7)
        + 0.15 * vnoise(x, y, 5.0, seed + 19)
    )


def dist_to_polyline(x: float, y: float, pts: Sequence[Tuple[float, float]]) -> float:
    best = 1e9
    for i in range(len(pts) - 1):
        x1, y1 = pts[i]
        x2, y2 = pts[i + 1]
        vx, vy = x2 - x1, y2 - y1
        wx, wy = x - x1, y - y1
        l2 = vx * vx + vy * vy
        t = 0.0 if l2 == 0.0 else max(0.0, min(1.0, (wx * vx + wy * vy) / l2))
        px, py = x1 + t * vx, y1 + t * vy
        best = min(best, math.hypot(x - px, y - py))
    return best


# ---------------------------------------------------------------------------
# Palettes (Quiet Cool World Floors & Derived Glacial Slate Walls)
# ---------------------------------------------------------------------------
VOID = hx3("#111520")  # Mandatory deep frozen abyss void
CEIL_CHECKER = (hx3("#171d2c"), hx3("#131826"))

# 3px carved icy-slate inner ceiling rim (`room2.py` convention)
RIM_ICE_SLATE = [
    hx3("#1b2338"),  # 0: outer/inner crisp dark line
    hx3("#31405e"),  # 1: deep slate bevel
    hx3("#495e80"),  # 2: east/north slate step
    hx3("#6680a2"),  # 3: lit slate bevel
    hx3("#8ba7c4"),  # 4: frosty blue-silver rim
    hx3("#bfdcf0"),  # 5: bright icy south inner lip
]

# Quiet world-coordinate frost-stone floor (5 low-contrast cool tones so bright sprites POP!)
FROST_STONE_FLOOR = [
    hx3("#1d2438"),  # 0: mortar joint
    hx3("#252e46"),  # 1: deep frost-slate slab
    hx3("#2d3853"),  # 2: dark cool slate body A
    hx3("#354260"),  # 3: mid cool slate body B
    hx3("#404f70"),  # 4: subtle top slab highlight
]

# Elevated Dais frost-ashlar (1 step lighter/cooler to read clearly as sacred raised stone)
DAIS_STONE_FLOOR = [
    hx3("#222b42"),  # 0: mortar joint
    hx3("#2c3752"),  # 1: shaded slab
    hx3("#364462"),  # 2: dais body A
    hx3("#405071"),  # 3: dais body B
    hx3("#4d5f84"),  # 4: lit north slab edge
]

DAIS_CURB_DARK = hx3("#182034")
DAIS_CURB_MID = hx3("#556b90")
DAIS_CURB_LIT = hx3("#88a6c6")
DAIS_SNOW_LIP = hx3("#b8d4e8")

RUNE_DIM = hx3("#2b5675")
RUNE_GLOW = hx3("#5696b5")

# Specular Frozen Lake ramp (quiet deep-to-mid translucent teal-sapphire + crisp specular streaks)
LAKE_ICE = [
    hx3("#172d47"),  # 0: deep subsurface fracture / shore shadow
    hx3("#1e3958"),  # 1: deep abyssal glacier ice
    hx3("#254669"),  # 2: main translucent sapphire-teal ice
    hx3("#2f557b"),  # 3: mid-lit cyan-blue ice
    hx3("#3e6b92"),  # 4: soft diagonal reflection band
    hx3("#578bb0"),  # 5: crisp specular ice sheen
    hx3("#7cb0cf"),  # 6: pinpoint specular glint / crack catch-light
]
SHORE_RIME = hx3("#6f90b0")

# 32px Faceted Glacial Rock & Ice North Wall ramp
GLACIAL_WALL = [
    hx3("#161d30"),  # 0: deep crevice / plinth base
    hx3("#232f4a"),  # 1: dark blue-slate shadow
    hx3("#334466"),  # 2: shaded glacial slate
    hx3("#465c82"),  # 3: mid frost-slate rock
    hx3("#5c779e"),  # 4: lit glacial rock facet
    hx3("#7da0c2"),  # 5: icy rime-kissed upper facet
    hx3("#a8cce2"),  # 6: crystalline ice vein / cornice glint
]


# ---------------------------------------------------------------------------
# Non-Rectangular Stepped Glacial Cavern Plan (28 x 22)
# ---------------------------------------------------------------------------
PLAN: List[str] = [
    "############################",  # 00: Ceiling / Frozen Abyss Void
    "#############......#########",  # 01: North Altar Niche face==1 (x=13..18)
    "###########..........#######",  # 02: Altar Step 1 face==1 (11..12, 19..20), central face==2
    "###########............#####",  # 03: Altar Step 2 East (21..22 face==1), Dais row 1 (13..18)
    "###########............#####",  # 04: Altar Dais main row (x=11..20 floor; 21..22 face==2)
    "###......##............#####",  # 05: West Cryo-Reliquary face==1 (3..8) | ## Spur | Apse floor
    "##.......##............#####",  # 06: West step (2 face==1, 3..8 face==2) | ## Spur | Dais edge
    "##.......##..........#######",  # 07: West Alcove floor (3..8) | ## Spur | Altar stairs (14..17)
    "##.....................#####",  # 08: Frozen Warrior row (2..8) | Spur face==1 (9..10, 21..22)
    "##.......................###",  # 09: Spur face==2 (9..10, 21..22) | East Grotto face==1 (23..24)
    "##........................##",  # 10: Archway open (9..10)! Frozen Lake & East Grotto (25 face==1)
    "##........................##",  # 11: Full span: West Reliquary + Archway + Lake + East Grotto
    "##........................##",  # 12: Full span: West Reliquary + Lake Causeway + East Grotto
    "###.......................##",  # 13: SW faceted wall step-in (x=3..25)
    "#####...................####",  # 14: South-West & South-East faceted cavern taper (x=5..23)
    "##############....##########",  # 15: Vaulted threshold (x=14..17) flanked by glacial buttresses
    "###########..........#######",  # 16: South Frosted Vestibule cheeks face==1 (11..13, 18..20)
    "##########............######",  # 17: Outer vestibule step face==1 (10, 21), cheeks face==2
    "##########............######",  # 18: Frosted Vestibule floor (11..20) & brazier posts
    "##########............######",  # 19: Wind-blown snow-drift vestibule floor (10..21)
    "############........########",  # 20: Stepped south ice tunnel taper (12..19)
    "##############....##########",  # 21: South Entry Ice Tunnel mouth (14..17)
]
assert len(PLAN) == GH and all(len(r) == GW for r in PLAN)


# ---------------------------------------------------------------------------
# World-Coordinate Architectural Zones: Dais, Plinth, Causeway & Frozen Lake
# ---------------------------------------------------------------------------
# Winding carved frost-stone causeway crossing the Central Specular Frozen Lake
MAIN_CAUSEWAY_PTS = [
    (248.0, 256.0),  # South threshold from Frosted Vestibule (x=15.5*16)
    (244.0, 222.0),
    (254.0, 190.0),
    (248.0, 156.0),
    (248.0, 120.0),  # Meets North Stepped Altar Dais stairs!
]
WEST_CAUSEWAY_PTS = [
    (250.0, 188.0),  # Branches west from mid-lake causeway
    (210.0, 184.0),
    (172.0, 180.0),
    (136.0, 174.0),  # Enters West Cryo-Reliquary through the glacial archway!
]


def in_altar_dais(X: int, Y: int) -> bool:
    """Elevated octagonal frost-stone sanctuary dais in North Apse (x=12..19, y=3..6)."""
    if not (48 <= Y <= 109 and 192 <= X <= 319):
        return False
    # Chamfered southern octagonal corners of the dais
    dx_l = 192 + max(0, Y - 99)
    dx_r = 319 - max(0, Y - 99)
    return dx_l <= X <= dx_r


def in_altar_stairs(X: int, Y: int) -> bool:
    """4-tile-wide carved frost-stone steps climbing onto the Altar Dais (x=14..17, y=106..121)."""
    return (224 <= X <= 287) and (106 <= Y <= 121)


def in_warrior_plinth(X: int, Y: int) -> bool:
    """Carved octagonal frost-rune reliquary plinth beneath `frozen-warrior` at (5..6, 8)."""
    if not (122 <= Y <= 150 and 74 <= X <= 117):
        return False
    cx, cy = 95.5, 136.0
    return abs(X - cx) + abs(Y - cy) * 1.15 <= 29.0


def in_lake_causeway(X: int, Y: int) -> Tuple[bool, float]:
    """
    Sculpted 26px-wide Carved Frost-Stone Causeway bridging from the South Vestibule
    across the center of the Specular Frozen Lake to the North Altar Stairs!
    Returns (is_on_causeway, edge_dist_inside).
    """
    dc_main = dist_to_polyline(X, Y, MAIN_CAUSEWAY_PTS)
    wob = 1.5 * (vnoise(X, Y, 7.5, 67) - 0.5)
    rem_main = (13.5 + wob) - dc_main
    return (rem_main > 0.0, rem_main)


def lake_field(X: int, Y: int) -> float:
    """
    Smooth, continuous, multi-lobed Central Specular Frozen Lake (ZERO triangular cuts!).
    Divided cleanly by the single N-S Frost-Stone Causeway into a grand West Basin and East Lagoon,
    bordered on the West (gx=9..11) by the frost-stone walkway to the Cryo-Reliquary!
    """
    d_west = math.hypot((X - 208.0) / 40.0, (Y - 190.0) / 42.0)
    d_cent = math.hypot((X - 266.0) / 56.0, (Y - 186.0) / 44.0)
    d_east = math.hypot((X - 324.0) / 54.0, (Y - 190.0) / 42.0)
    d = min(d_west, d_cent, d_east)
    ang = math.atan2(Y - 188.0, X - 268.0)
    wob = 0.08 * math.sin(5.0 * ang + 0.6) + 0.12 * (fbm(X, Y, 61) - 0.5)
    stair_repel = 0.45 * math.exp(-(((X - 255.0) / 44.0) ** 2 + ((Y - 120.0) / 22.0) ** 2))
    return 1.0 - d + wob - stair_repel


# Irregular world-coordinate slab grid (coprime to 16px -> zero grid seams!)
COURSE_H = [9, 11, 10, 8, 12, 9, 11, 10]
SLAB_W = [15, 19, 14, 21, 17, 13, 18, 16]  # sum = 133px (coprime to 16)

Y_COURSES: List[Tuple[int, int, int]] = []
_yc = 0
_ci = 0
while len(Y_COURSES) < H_PX + 16:
    ch = COURSE_H[_ci % len(COURSE_H)]
    for _ly in range(ch):
        Y_COURSES.append((_ci, _ly, ch))
    _yc += ch
    _ci += 1


def slab_coords(X: int, Y: int, seed: int = 31) -> Tuple[int, int, int, int, int, int]:
    ci, ly, sh = Y_COURSES[Y]
    shift = int(H(ci, 5, seed) * 53)
    xx = X + shift
    cyc = xx // 133
    rem = xx % 133
    acc = 0
    sw = SLAB_W[0]
    si = 0
    for k, w in enumerate(SLAB_W):
        if rem < acc + w:
            si = k
            sw = w
            break
        acc += w
    lx = rem - acc
    return ci, cyc * 16 + si, lx, ly, sw, sh


def paint_frost_stone(X: int, Y: int, ramp: Sequence[Tuple[int, int, int]], seed: int = 31) -> Tuple[int, int, int]:
    ci, si, lx, ly, sw, sh = slab_coords(X, Y, seed)
    if lx == sw - 1 or ly == sh - 1:
        return ramp[0]
    tone = [2, 2, 3, 3, 2, 1][int(H(ci, si, seed + 3) * 6) % 6]
    if ly == 0 and 1 <= lx <= sw - 3 and H(ci, si, seed + 7) < 0.58:
        tone = min(4, tone + 1)
    elif lx == 0 and 1 <= ly <= sh - 3 and H(ci, si, seed + 11) < 0.35:
        tone = min(4, tone + 1)
    if H(X // 3, Y // 3, seed + 19) < 0.08:
        tone = max(1, tone - 1)
    return ramp[tone]


def paint_specular_lake_ice(X: int, Y: int, lf: float) -> Tuple[int, int, int]:
    """Quiet translucent teal-sapphire lake ice with diagonal specular streaks & subsurface cracks."""
    # Frosted rime shoreline lip right at basin edge
    if lf < 0.055:
        return SHORE_RIME if (X + Y) % 3 != 0 else LAKE_ICE[0]
    if lf < 0.105:
        return LAKE_ICE[0]

    # Smooth depth variation (deeper sapphire toward basin centers, cooler cyan near shoals)
    n = fbm(X, Y, 101)
    base_idx = 1 if (lf > 0.34 and n < 0.44) else (2 if n < 0.70 else 3)

    # Subtle world-coord diagonal specular reflection streaks (top-left to bottom-right angle)
    diag = (X * 0.68 + Y * 1.0 + 9.0 * (vnoise(X, Y, 18.0, 109) - 0.5)) % 46.0
    if 4.0 <= diag <= 7.4:
        base_idx = min(5, base_idx + 2)
    elif 15.0 <= diag <= 16.8:
        base_idx = min(4, base_idx + 1)

    # Delicate subsurface glacier fracture lines (non-periodic warped ridges)
    f1 = math.sin(X * 0.075 - Y * 0.052 + 3.4 * vnoise(X, Y, 22.0, 127))
    f2 = math.sin(X * 0.041 + Y * 0.088 + 2.8 * vnoise(X, Y, 19.0, 131))
    if abs(f1) < 0.036 or (lf > 0.24 and abs(f2) < 0.028):
        return LAKE_ICE[0]
    if (0.036 <= abs(f1) < 0.062) and ((X + Y) % 2 == 0):
        return LAKE_ICE[6] if lf < 0.28 else LAKE_ICE[5]

    return LAKE_ICE[base_idx]


def floor_glacial_world(X: int, Y: int) -> Tuple[int, int, int]:
    # 1. Carved Frost-Stone Altar Stairs (x=14..17, y=106..121)
    if in_altar_stairs(X, Y):
        if X in (224, 287) or X in (225, 286):
            return DAIS_CURB_DARK if X in (224, 287) else DAIS_CURB_LIT
        rel = (Y - 106) % 4  # 4px step = 2px lit tread + 2px shaded riser (SKILL.md rule 8!)
        if rel == 0:
            return DAIS_SNOW_LIP if (X % 11 != 0) else DAIS_CURB_LIT
        elif rel == 1:
            return DAIS_STONE_FLOOR[4]
        elif rel == 2:
            return DAIS_STONE_FLOOR[1]
        else:
            return DAIS_CURB_DARK

    # 2. Elevated Stepped Glacial Altar Dais (x=12..19, y=48..109)
    if in_altar_dais(X, Y):
        # Outer retaining stone riser & lit rime-stone coping lip
        if not in_altar_dais(X, Y + 1):
            return DAIS_CURB_DARK
        if not in_altar_dais(X, Y + 2):
            return DAIS_STONE_FLOOR[1]
        if not in_altar_dais(X, Y + 3):
            return DAIS_CURB_LIT
        if not in_altar_dais(X - 1, Y) or not in_altar_dais(X + 1, Y):
            return DAIS_CURB_DARK
        if not in_altar_dais(X - 2, Y):
            return DAIS_CURB_LIT
        if not in_altar_dais(X + 2, Y):
            return DAIS_CURB_MID

        # Sacred octagonal frost-rune inlay framing `ice-altar` at (256, 74)
        rx = abs(X - 255.5)
        ry = abs(Y - 76.0) * 1.25
        oct_d = max(rx, ry, (rx + ry) * 0.72)
        if 22.0 <= oct_d <= 24.2 or 14.0 <= oct_d <= 15.3:
            pulse = 0.5 + 0.5 * math.sin(math.atan2(Y - 76.0, X - 255.5) * 8.0)
            return lerp_rgb(RUNE_DIM, RUNE_GLOW, 0.35 + 0.55 * pulse)

        return paint_frost_stone(X, Y, DAIS_STONE_FLOOR, seed=43)

    # 3. West Cryo-Reliquary Octagonal Plinth beneath `frozen-warrior`
    if in_warrior_plinth(X, Y):
        if not (
            in_warrior_plinth(X - 1, Y)
            and in_warrior_plinth(X + 1, Y)
            and in_warrior_plinth(X, Y - 1)
            and in_warrior_plinth(X, Y + 1)
        ):
            return DAIS_CURB_DARK
        if not (
            in_warrior_plinth(X - 2, Y)
            and in_warrior_plinth(X + 2, Y)
            and in_warrior_plinth(X, Y - 2)
            and in_warrior_plinth(X, Y + 2)
        ):
            return RUNE_GLOW if (X + Y) % 2 == 0 else DAIS_CURB_LIT
        return paint_frost_stone(X, Y, DAIS_STONE_FLOOR, seed=59)

    # 4. Central Specular Frozen Lake + Bridging Carved Frost-Stone Causeway
    lf = lake_field(X, Y)
    if lf > 0.0:
        on_cw, cw_depth = in_lake_causeway(X, Y)
        if on_cw:
            # Crisp 2px dressed frost-stone causeway curb over the frozen lake!
            if cw_depth < 1.3:
                return DAIS_CURB_DARK
            if cw_depth < 2.6:
                return DAIS_CURB_LIT if (X + Y) % 5 != 0 else DAIS_SNOW_LIP
            return paint_frost_stone(X, Y, DAIS_STONE_FLOOR, seed=37)
        # Subtle shadow cast by the stone causeway onto adjacent lake ice
        on_cw_n, _ = in_lake_causeway(X - 2, Y - 2)
        c_ice = paint_specular_lake_ice(X, Y, lf)
        return mul(c_ice, 0.78) if on_cw_n else c_ice

    # 5. Quiet Frost-Stone Cavern Floor & Approaches
    c = paint_frost_stone(X, Y, FROST_STONE_FLOOR, seed=31)
    # Soft cold snow dust tracked just inside South Tunnel mouth (Y >= 324)
    if Y >= 324:
        snow_n = vnoise(X, Y, 6.5, 149) + (Y - 324) * 0.018
        if snow_n > 0.76:
            return hx3("#8aa4be") if snow_n > 0.90 else hx3("#627a96")
    return c


def wall_faceted_glacial(X: int, fy: int) -> Tuple[int, int, int]:
    """
    World-coordinate 32px faceted blue-slate rock & translucent glacial ice wall (`face == 1, 2`):
    - Coprime block widths [17, 23, 15, 21, 19, 16] so long walls NEVER repeat every 16px
    - Crystalline frost-ledge string-course at fy=14..15
    - Angled vertical/diagonal ice-crystal veins embedded in the slate rock
    - Lower dado darkened (fy >= 16) + heavy dark glacial plinth skirting (fy = 29..31)
    """
    if fy >= 29:
        return GLACIAL_WALL[2] if fy == 29 else (GLACIAL_WALL[1] if fy == 30 else GLACIAL_WALL[0])
    if fy == 14:
        return GLACIAL_WALL[5] if (X % 19 != 0) else GLACIAL_WALL[6]
    if fy == 15:
        return GLACIAL_WALL[1]

    courses = [0, 5, 10, 14, 16, 22, 29]
    r = max(i for i, v in enumerate(courses[:-1]) if v <= fy)
    y0, y1 = courses[r], courses[r + 1]
    ly = fy - y0
    hgt = y1 - y0

    widths = [17, 23, 15, 21, 19, 18]
    W_blk = widths[r % 6]
    off = (r * 13 + int(H(r, 7, 73) * 17)) % W_blk
    lx = (X + off) % W_blk
    blk = (X + off) // W_blk

    # Angled crystalline ice seam cutting across rock strata every ~47px
    seam_x = (X + fy // 2 + int(vnoise(X, fy, 9.0, 81) * 5)) % 47
    is_ice_vein = seam_x in (11, 12) and 3 <= fy <= 26

    if is_ice_vein:
        c = GLACIAL_WALL[6] if seam_x == 11 else GLACIAL_WALL[4]
    elif ly == hgt - 1 or lx == W_blk - 1:
        c = GLACIAL_WALL[1] if (lx == W_blk - 1 and ly < hgt - 1) else GLACIAL_WALL[0]
    else:
        # Faceted rock bevels: sunlit top-left, cool slate body, subtle diagonal facet split
        tone = 4 if H(blk, r, 89) < 0.55 else 3
        if ly == 0 and lx < W_blk - 2:
            tone = min(5, tone + 1)
        elif lx == 0 and ly > 0:
            tone = min(5, tone + 1)
        # Diagonal chisel facet inside larger slate blocks
        if lx + ly * 2 == W_blk - 2 and H(blk, r, 97) < 0.5:
            tone = min(5, tone + 1)
        elif H(X // 3, fy // 2, 103) < 0.12:
            tone = max(2, tone - 1)
        c = GLACIAL_WALL[tone]

    if fy >= 16:
        c = mul(c, 0.84)
    return c


# ---------------------------------------------------------------------------
# Derived RM2000 Structure Engine (`room2.py` Ceiling Rim + 32px Wall + Shadows)
# ---------------------------------------------------------------------------
def analyse(plan: Sequence[str]):
    Hh = len(plan)
    W = max(len(r) for r in plan)
    g = [[plan[y][x] != "#" for x in range(W)] for y in range(Hh)]

    def inn(x: int, y: int) -> bool:
        return 0 <= x < W and 0 <= y < Hh and g[y][x]

    face = [[0] * W for _ in range(Hh)]
    for y in range(Hh):
        for x in range(W):
            if not g[y][x]:
                continue
            if not inn(x, y - 1):
                face[y][x] = 1
            elif face[y - 1][x] == 1:
                face[y][x] = 2

    top = [
        [(not g[y][x]) and any(inn(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)) for x in range(W)]
        for y in range(Hh)
    ]
    return W, Hh, g, face, top, inn


def render_structure(plan: Sequence[str]) -> Image.Image:
    W, Hh, g, face, top, inn = analyse(plan)
    im = Image.new("RGBA", (W * 16, Hh * 16), VOID + (255,))
    px = im.load()

    for cy in range(Hh):
        for cx in range(W):
            for ly in range(16):
                for lx in range(16):
                    X, Y = cx * 16 + lx, cy * 16 + ly
                    if g[cy][cx] and face[cy][cx]:
                        fy = ly + (face[cy][cx] - 1) * 16
                        c = wall_faceted_glacial(X, fy)
                        if not inn(cx - 1, cy) and lx == 0:
                            c = mul(c, 0.76)
                        elif not inn(cx + 1, cy) and lx == 15:
                            c = mul(c, 0.76)
                        if fy < 4:
                            c = mul(c, 0.62 + 0.08 * fy)
                        px[X, Y] = c + (255,)
                    elif g[cy][cx]:
                        c = floor_glacial_world(X, Y)
                        # 3px wall-foot contact shadow directly below `face == 2`
                        if (face[cy - 1][cx] if cy > 0 else 0) and ly < 3:
                            c = mul(c, 0.58 + 0.13 * ly)
                        px[X, Y] = c + (255,)
                    elif top[cy][cx]:
                        c = CEIL_CHECKER[(X + Y) % 2]
                        s_in = inn(cx, cy + 1)
                        n_in = inn(cx, cy - 1)
                        w_in = inn(cx - 1, cy)
                        e_in = inn(cx + 1, cy)

                        notch_x = (X % 12 == 0)
                        notch_y = (Y % 12 == 0)
                        # Crisp 3px carved icy-slate inner ceiling rim on all 4 room-facing edges
                        if s_in and ly >= 13:
                            if ly == 13:
                                c = RIM_ICE_SLATE[4] if notch_x else RIM_ICE_SLATE[5]
                            elif ly == 14:
                                c = RIM_ICE_SLATE[2] if notch_x else RIM_ICE_SLATE[3]
                            else:
                                c = RIM_ICE_SLATE[0]
                        if n_in and ly <= 2:
                            if ly == 0:
                                c = RIM_ICE_SLATE[0]
                            elif ly == 1:
                                c = RIM_ICE_SLATE[3] if notch_x else RIM_ICE_SLATE[4]
                            else:
                                c = RIM_ICE_SLATE[2]
                        if w_in and lx <= 2:
                            if lx == 0:
                                c = RIM_ICE_SLATE[0]
                            elif lx == 1:
                                c = RIM_ICE_SLATE[3] if notch_y else RIM_ICE_SLATE[4]
                            else:
                                c = RIM_ICE_SLATE[2]
                        if e_in and lx >= 13:
                            if lx == 15:
                                c = RIM_ICE_SLATE[0]
                            elif lx == 14:
                                c = RIM_ICE_SLATE[2] if not notch_y else RIM_ICE_SLATE[1]
                            else:
                                c = RIM_ICE_SLATE[3]

                        # Clean outer transition to #111520 void
                        if (not inn(cx, cy - 1) and not top[cy - 1][cx]) if cy > 0 else True:
                            if ly == 0 and not n_in:
                                c = VOID
                        if (not inn(cx, cy + 1) and not top[cy + 1][cx]) if cy + 1 < Hh else True:
                            if ly == 15 and not s_in:
                                c = VOID
                        if (not inn(cx - 1, cy) and not top[cy][cx - 1]) if cx > 0 else True:
                            if lx == 0 and not w_in:
                                c = VOID
                        if (not inn(cx + 1, cy) and not top[cy][cx + 1]) if cx + 1 < W else True:
                            if lx == 15 and not e_in:
                                c = VOID
                        px[X, Y] = c + (255,)
                    else:
                        px[X, Y] = VOID + (255,)

    # 6px west-wall soft cast shadow across wall face & floor (`room2.py` rule)
    for cy in range(Hh):
        for cx in range(W):
            if g[cy][cx] and not inn(cx - 1, cy):
                for ly in range(16):
                    for lx in range(6):
                        X, Y = cx * 16 + lx, cy * 16 + ly
                        r, gg, b, a = px[X, Y]
                        px[X, Y] = mul((r, gg, b), 0.62 + 0.06 * lx) + (a,)

    return im


# ---------------------------------------------------------------------------
# Carbon Sprite Catalog & Scene Placements
# ---------------------------------------------------------------------------
@dataclass
class Piece:
    id: str
    im: Image.Image
    fw: int
    fh: int
    up: int = 0
    kind: str = "floor"  # 'floor', 'hang'
    px_offset: Tuple[int, int] = (0, 0)


def load_ice_catalog() -> Dict[str, Piece]:
    return {
        "frozen-warrior": Piece(
            "frozen-warrior",
            Image.open(OBJ_DIR / "frozen-warrior.png").convert("RGBA"),
            fw=2,
            fh=1,
            up=16,
            kind="floor",
        ),
        "ice-altar": Piece(
            "ice-altar",
            Image.open(OBJ_DIR / "ice-altar.png").convert("RGBA"),
            fw=2,
            fh=1,
            up=16,
            kind="floor",
        ),
        "ice-crystal": Piece(
            "ice-crystal",
            Image.open(OBJ_DIR / "ice-crystal.png").convert("RGBA"),
            fw=2,
            fh=1,
            up=16,
            kind="floor",
        ),
        "frost-brazier": Piece(
            "frost-brazier",
            Image.open(OBJ_DIR / "frost-brazier.png").convert("RGBA"),
            fw=1,
            fh=1,
            up=16,
            kind="floor",
        ),
        # `icicles.png` (32x16, top rime bar at y=1): offset dy=-1 mounts y=1 flush at fy=0 right under ceiling rim!
        "icicles": Piece(
            "icicles",
            Image.open(OBJ_DIR / "icicles.png").convert("RGBA"),
            fw=2,
            fh=0,
            up=0,
            kind="hang",
            px_offset=(0, -1),
        ),
        "snow-drift": Piece(
            "snow-drift",
            Image.open(OBJ_DIR / "snow-drift.png").convert("RGBA"),
            fw=2,
            fh=1,
            up=0,
            kind="floor",
        ),
    }


def build_scene_spec(cat: Dict[str, Piece]) -> dict:
    items = [
        # ===================================================================
        # 1. NORTH STEPPED GLACIAL ALTAR APSE (x=11..22, y=1..7)
        # ===================================================================
        # Hanging cave icicles crowning the multi-stepped north glacial walls (`face == 1`)
        (cat["icicles"], 13, 1, "Altar Apse Crown Icicles W"),
        (cat["icicles"], 17, 1, "Altar Apse Crown Icicles E"),
        (cat["icicles"], 11, 2, "Altar Apse Step-1 Icicles W"),
        (cat["icicles"], 19, 2, "Altar Apse Step-1 Icicles E"),
        (cat["icicles"], 21, 3, "Altar Apse Outer Cheek Icicles E"),

        # Elevated Stepped Dais Hero Centerpiece: `ice-altar` + flanking `frost-brazier`s + wing `ice-crystal`s
        (cat["ice-altar"], 15, 4, "North Sanctum Ice Altar"),
        (cat["frost-brazier"], 13, 4, "Altar Dais Frost Brazier W"),
        (cat["frost-brazier"], 18, 4, "Altar Dais Frost Brazier E"),
        (cat["ice-crystal"], 11, 4, "Altar Wing Crystal Cluster W"),
        (cat["ice-crystal"], 19, 4, "Altar Wing Crystal Cluster E"),
        (cat["ice-crystal"], 21, 5, "Altar Outer Cheek Crystal E"),

        # ===================================================================
        # 2. WEST CRYO-RELIQUARY ALCOVE (x=2..8, y=5..13)
        # ===================================================================
        # Hanging icicle curtain along the 6-wide Cryo-Reliquary north glacial face (`y=5`)
        (cat["icicles"], 3, 5, "Reliquary North Vault Icicles W"),
        (cat["icicles"], 5, 5, "Reliquary North Vault Icicles C"),
        (cat["icicles"], 7, 5, "Reliquary North Vault Icicles E"),

        # Hero Centerpiece: `frozen-warrior` on frost-rune plinth framed by `frost-brazier`s!
        (cat["frost-brazier"], 3, 8, "Cryo-Reliquary Frost Brazier W"),
        (cat["frozen-warrior"], 5, 8, "Frozen Horned Knight Reliquary"),
        (cat["frost-brazier"], 8, 8, "Cryo-Reliquary Frost Brazier E"),
        (cat["ice-crystal"], 2, 10, "Cryo-Reliquary Glacial Crystal"),
        (cat["snow-drift"], 3, 12, "Cryo-Reliquary Corner Snowbank"),

        # ===================================================================
        # 3. CENTRAL SPECULAR FROZEN LAKE HALL & EAST CRYSTAL GROTTO (x=9..25, y=8..14)
        # ===================================================================
        # Hanging icicles on internal Glacial Dividing Pillar (`y=8`) & East Crystal Grotto (`y=8..9`)
        (cat["icicles"], 9, 8, "Central Glacial Arch Pillar Icicles"),
        (cat["icicles"], 21, 8, "East Grotto Spur Icicles"),
        (cat["icicles"], 23, 9, "East Grotto Vault Icicles"),

        # Crystal shoal outcrops bordering & punctuating the Specular Frozen Lake
        (cat["ice-crystal"], 18, 9, "NE Lake Shoal Ice Crystal"),
        (cat["ice-crystal"], 11, 13, "SW Lake Shoal Ice Crystal"),
        (cat["ice-crystal"], 23, 11, "East Crystal Grotto Hero Cluster"),
        (cat["snow-drift"], 22, 13, "East Grotto Rime Snowbank"),
        (cat["snow-drift"], 18, 14, "SE Lakeside Wind Snowbank"),

        # ===================================================================
        # 4. SOUTH ENTRY ICE TUNNEL & FROSTED VESTIBULE (x=10..21, y=15..21)
        # ===================================================================
        (cat["icicles"], 11, 16, "Vestibule Cheek Icicles W"),
        (cat["icicles"], 19, 16, "Vestibule Cheek Icicles E"),
        (cat["frost-brazier"], 13, 18, "South Entry Frost Brazier W"),
        (cat["frost-brazier"], 18, 18, "South Entry Frost Brazier E"),
        (cat["snow-drift"], 10, 19, "South Tunnel Wind-Blown Snow W"),
        (cat["snow-drift"], 20, 19, "South Tunnel Wind-Blown Snow E"),
    ]

    chambers = [
        ("South Entry Ice Tunnel & Frosted Vestibule", (15, 19)),
        ("Central Specular Frozen Lake Hall", (15, 11)),
        ("East Crystal Grotto", (22, 12)),
        ("West Cryo-Reliquary Alcove", (5, 10)),
        ("North Stepped Glacial Altar Apse", (15, 5)),
    ]

    return {
        "plan": PLAN,
        "items": items,
        "chambers": chambers,
        "start": [(15, 21), (16, 21)],
    }


def item_draw_rect(f: Piece, gx: int, gy: int) -> Tuple[int, int, int, int]:
    dx, dy = f.px_offset
    if f.kind == "hang":
        X0, Y0 = gx * 16 + dx, gy * 16 + dy
    else:
        X0, Y0 = gx * 16 + dx, gy * 16 - f.up + dy
    return (X0, Y0, X0 + f.im.width, Y0 + f.im.height)


def compose_scene(spec: dict) -> Image.Image:
    base = render_structure(spec["plan"])
    W_c, H_c, g, face, top, inn = analyse(spec["plan"])
    px = base.load()

    # Subtle luminous frostfire & diamond-core floor glows (never overwrites void or wall faces!)
    glows: List[Tuple[int, int, int, Tuple[int, int, int], float]] = []
    for f, gx, gy, _label in spec["items"]:
        if f.id == "frost-brazier":
            glows.append((gx * 16 + 8, gy * 16 + 8, 28, hx3("#6cbca0"), 0.24))
        elif f.id == "ice-altar":
            glows.append((gx * 16 + 16, gy * 16 + 10, 34, hx3("#86c8e0"), 0.22))
        elif f.id == "frozen-warrior":
            glows.append((gx * 16 + 16, gy * 16 + 12, 26, hx3("#6ca8d8"), 0.16))

    for cx_p, cy_p, rad, gcol, strength in glows:
        for Y in range(max(0, cy_p - rad), min(H_PX, cy_p + rad + 1)):
            for X in range(max(0, cx_p - rad), min(W_PX, cx_p + rad + 1)):
                cell_x, cell_y = X // 16, Y // 16
                if g[cell_y][cell_x] and not face[cell_y][cell_x]:
                    d = math.hypot(X - cx_p, (Y - cy_p) * 1.25)
                    if d < rad:
                        k = ((1.0 - d / rad) ** 1.75) * strength
                        r, gg, b, a = px[X, Y]
                        nc = lerp_rgb((r, gg, b), gcol, k)
                        px[X, Y] = (*nc, a)

    # Y-sorted composition (hangings on wall face first, then floor objects sorted by bottom Y)
    draw_list = []
    for f, gx, gy, _label in spec["items"]:
        X0, Y0, _, _ = item_draw_rect(f, gx, gy)
        z_key = gy * 16 if f.kind == "hang" else (gy + f.fh) * 16
        draw_list.append((z_key, X0, Y0, f.im))

    for _, X0, Y0, im in sorted(draw_list, key=lambda d: (d[0], d[1])):
        base.alpha_composite(im, (X0, Y0))

    return base


# ---------------------------------------------------------------------------
# Automated BFS Walkability & Architectural Quality Verification
# ---------------------------------------------------------------------------
def verify_and_measure(spec: dict) -> dict:
    plan = spec["plan"]
    W, Hh, g, face, top, inn = analyse(plan)
    floor = [[g[y][x] and not face[y][x] for x in range(W)] for y in range(Hh)]

    def fl(x: int, y: int) -> bool:
        return 0 <= x < W and 0 <= y < Hh and floor[y][x]

    occ: Dict[Tuple[int, int], str] = {}
    issues: List[str] = []

    # 1. Footprint validity & non-overlap
    hang_boxes = []
    tall_boxes = []
    for f, gx, gy, label in spec["items"]:
        X0, Y0, _, _ = item_draw_rect(f, gx, gy)
        bb = f.im.getbbox() or (0, 0, f.im.width, f.im.height)
        box = (X0 + bb[0], Y0 + bb[1], X0 + bb[2], Y0 + bb[3])

        if f.kind == "hang":
            for xx in range(gx, gx + f.fw):
                if not (0 <= gy < Hh and g[gy][xx] and face[gy][xx] == 1):
                    issues.append(f"Hanging {f.id} '{label}' @({gx},{gy}) col {xx} not on face==1")
            hang_boxes.append((f"{f.id}@({gx},{gy})", box))
        else:
            for yy in range(gy, gy + f.fh):
                for xx in range(gx, gx + f.fw):
                    if not fl(xx, yy):
                        issues.append(f"{f.id} '{label}' @({gx},{gy}) cell ({xx},{yy}) is not walkable floor")
                    if (xx, yy) in occ:
                        issues.append(f"{f.id} @({gx},{gy}) overlaps {occ[(xx, yy)]} at ({xx},{yy})")
                    occ[(xx, yy)] = f.id
            if f.up > 0:
                tall_boxes.append((f"{f.id}@({gx},{gy})", box))

    def overlaps(a, b) -> bool:
        return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]

    for i, (na, ba) in enumerate(hang_boxes):
        for nb, bb in hang_boxes[i + 1 :]:
            if overlaps(ba, bb):
                issues.append(f"Hangings overlap: {na} vs {nb}")
        for nb, bb in tall_boxes:
            if overlaps(ba, bb):
                issues.append(f"Hanging {na} occluded by tall object {nb}")

    # 2. Full 16px Grid BFS from South Entry Ice Tunnel
    walk = [[fl(x, y) and (x, y) not in occ for x in range(W)] for y in range(Hh)]
    starts = [tuple(s) for s in spec["start"] if walk[s[1]][s[0]]]
    if not starts:
        issues.append("Entrance start cells are blocked!")

    dist_map: Dict[Tuple[int, int], int] = {s: 0 for s in starts}
    q = deque(starts)
    while q:
        cx, cy = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < W and 0 <= ny < Hh and walk[ny][nx] and (nx, ny) not in dist_map:
                dist_map[(nx, ny)] = dist_map[(cx, cy)] + 1
                q.append((nx, ny))

    # Zero trapped floor pockets allowed!
    trapped = [(x, y) for y in range(Hh) for x in range(W) if walk[y][x] and (x, y) not in dist_map]
    if trapped:
        issues.append(f"Trapped unreachable floor cells ({len(trapped)}): {trapped[:10]}")

    # 3. Verify all named chambers
    chamber_reports = []
    unreachable_rooms = 0
    for c_name, (ax, ay) in spec["chambers"]:
        reached = (ax, ay) in dist_map
        if not reached:
            unreachable_rooms += 1
            issues.append(f"Chamber '{c_name}' anchor ({ax},{ay}) unreachable!")
        chamber_reports.append(
            {
                "name": c_name,
                "anchor": [ax, ay],
                "reachable": reached,
                "bfs_steps": dist_map.get((ax, ay), -1),
            }
        )

    # 4. Verify every standing/floor object has at least one adjacent reachable interaction cell
    station_reports = []
    unreachable_stations = 0
    for f, gx, gy, label in spec["items"]:
        if f.kind == "hang":
            continue
        fp = [(xx, yy) for yy in range(gy, gy + f.fh) for xx in range(gx, gx + f.fw)]
        adj = [
            (ax + dx, ay + dy)
            for ax, ay in fp
            for dx, dy in ((0, 1), (-1, 0), (1, 0), (0, -1))
            if (ax + dx, ay + dy) not in fp and (ax + dx, ay + dy) in dist_map
        ]
        if not adj:
            unreachable_stations += 1
            issues.append(f"Object '{label}' ({f.id}) @({gx},{gy}) has NO reachable interaction cell!")
            best_use = None
            steps = -1
        else:
            best_use = min(adj, key=lambda c: dist_map[c])
            steps = dist_map[best_use]
        station_reports.append(
            {
                "label": label,
                "sprite": f.id,
                "cell": [gx, gy],
                "footprint": [f.fw, f.fh],
                "use_cell": list(best_use) if best_use else None,
                "reachable": best_use is not None,
                "bfs_steps": steps,
            }
        )

    # 5. Verify all 6 Carbon sprites are placed
    available = sorted(p.stem for p in OBJ_DIR.glob("*.png"))
    used = sorted({f.id for f, _, _, _ in spec["items"]})
    missing = sorted(set(available) - set(used))
    if missing:
        issues.append(f"Missing Carbon sprites: {missing}")

    total_floor = sum(1 for y in range(Hh) for x in range(W) if floor[y][x])
    total_walkable = sum(1 for y in range(Hh) for x in range(W) if walk[y][x])

    return {
        "theme": "ice",
        "title": "Glacial Sanctuary Cavern v2",
        "ok": len(issues) == 0,
        "issues": issues,
        "grid_size_tiles": [W, Hh],
        "pixel_size_1x": [W_PX, H_PX],
        "pixel_size_2x": [W_PX * 2, H_PX * 2],
        "void_hex": "#111520",
        "floor_cells_total": total_floor,
        "occupied_floor_cells": len(occ),
        "walkable_cells_total": total_walkable,
        "reachable_walk_cells": len(dist_map),
        "trapped_unreachable_cells": len(trapped),
        "connectivity_ratio": round(len(dist_map) / max(1, total_walkable), 4),
        "unreachable_rooms": unreachable_rooms,
        "unreachable_stations": unreachable_stations,
        "carbon_sprites_available": available,
        "carbon_sprites_placed_unique": f"{len(used)}/{len(available)}",
        "total_object_placements": len(spec["items"]),
        "entrance_start_cells": [list(s) for s in starts],
        "chambers": chamber_reports,
        "stations": station_reports,
    }


def main() -> None:
    ICE_DIR.mkdir(parents=True, exist_ok=True)
    cat = load_ice_catalog()
    spec = build_scene_spec(cat)

    metrics = verify_and_measure(spec)
    print(json.dumps({k: v for k, v in metrics.items() if k != "stations"}, indent=2, ensure_ascii=False))
    if not metrics["ok"]:
        raise SystemExit(f"Verification FAILED: {metrics['issues']}")

    im_1x = compose_scene(spec)
    im_2x = im_1x.resize((W_PX * 2, H_PX * 2), Image.Resampling.NEAREST)

    im_1x.save(OUT_1X)
    im_2x.save(OUT_2X)
    OUT_METRICS.write_text(json.dumps(metrics, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Saved 1x: {OUT_1X} ({im_1x.size})")
    print(f"Saved 2x: {OUT_2X} ({im_2x.size})")
    print(f"Saved metrics: {OUT_METRICS}")


if __name__ == "__main__":
    main()
