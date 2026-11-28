#!/usr/bin/env python3
"""
Build `mine_volcano` Showcase Dungeon Map Architecture v2 — Magma Vein Dwarven Mine (28x22 tiles = 448x352 px)

Architecture v2 Design:
- Non-rectangular, branching subterranean mine & volcanic caldera chasm inside dark basalt void (#141114)
- Four interconnected vignettes & architectural zones:
  1. South-West Timber-Shored Mine Shaft & Tool Station (`tiles5.py` `f_mine`-inspired timber-post shored
     hewn rock north walls, `pickaxe-rack` flush against `face == 2`, `ore-crystal-vein` motherlode outcrops)
  2. Continuous Winding Minecart Rail Haulage Line (sliced & transformed 16x16 `rails-kit.png` E-W, N-S,
     and 90-deg turn segments connecting the NW ore face across the central cavern to the SE magma-bank
     tipple spur, with two gem-heaped `minecart`s locked directly onto the steel rails)
  3. Diagonal Winding Molten Magma River / Fissure (gushing from a north rock-wall lava cleft down-southeast
     into a bubbling caldera pool with dark cooling basalt crust islands, spanned by a sturdy 4x2 riveted
     iron & dressed basalt stone bridge with warm rim-glow on nearby stones)
  4. North-East Volcanic Obsidian Sanctum (stepped dark basalt octagon/apse across the bridge housing
     `obsidian-altar` on a magma-inlaid dais flanked by `lava-brazier`s and `ore-crystal-vein`s)
- Derived `room2.py` 3px basalt/timber ceiling inner rim lips + 32px world-coordinate rough-hewn rock &
  timber-post north wall faces (`face == 1, 2`) + obsidian sanctum walls behind chasm partition.
- Automated BFS walkability & station reachability verification (100% connectivity, 0 trapped cells).
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
MV_DIR = ROOT / "tiledata/dungeon-themes-carbon/mine_volcano"
OBJ_DIR = MV_DIR / "objects"

OUT_1X = MV_DIR / "map_mine_volcano_v2.png"
OUT_2X = MV_DIR / "map_mine_volcano_v2_2x.png"
OUT_METRICS = MV_DIR / "metrics_v2.json"

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
        0.55 * vnoise(x, y, 22.0, seed)
        + 0.30 * vnoise(x, y, 10.0, seed + 7)
        + 0.15 * vnoise(x, y, 4.5, seed + 19)
    )


# ---------------------------------------------------------------------------
# Palettes (Harmonized with `batch4_mine_volcano.py` & `tiles5.py`)
# ---------------------------------------------------------------------------
VOID = hx3("#141114")  # Mandatory dark basalt void
CEIL_CHECKER = (hx3("#1c171d"), hx3("#161217"))

# 3px Timber/Basalt ceiling inner rim (Mine Zone vs Volcanic Obsidian Sanctum Zone)
RIM_MINE = [
    hx3("#21181c"),  # 0: dark outline
    hx3("#382828"),  # 1: deep timber-stone bevel
    hx3("#523b36"),  # 2: side step
    hx3("#6e5044"),  # 3: warm hewn stone/timber bevel
    hx3("#8c6954"),  # 4: lit timber-stone lip
    hx3("#ab8568"),  # 5: crisp south inner lip
]

RIM_OBSIDIAN = [
    hx3("#181624"),  # 0: dark obsidian line
    hx3("#2b293d"),  # 1: deep basalt bevel
    hx3("#403e56"),  # 2: basalt step
    hx3("#57566e"),  # 3: inner bevel
    hx3("#73748a"),  # 4: lit basalt rim
    hx3("#9498aa"),  # 5: glassy obsidian south lip
]

# Quiet world-coordinate compacted mine earth & crushed basalt floor (5 low-contrast tones!)
MINE_FLOOR = [
    hx3("#1e1a20"),  # 0: dark crevice speck
    hx3("#272229"),  # 1: deep compacted earth
    hx3("#312a32"),  # 2: main mine floor A
    hx3("#3a323b"),  # 3: main mine floor B
    hx3("#453b45"),  # 4: subtle stone grit highlight
]

# Dressed dark basalt slabs for Central Bridgehead & NE Volcanic Obsidian Sanctum
BASALT_SLABS = [
    hx3("#171521"),  # 0: mortar joint
    hx3("#222030"),  # 1: soot-dark basalt
    hx3("#2d2b3e"),  # 2: dark basalt body A
    hx3("#37364b"),  # 3: mid basalt body B
    hx3("#45445c"),  # 4: subtle top basalt bevel
]

# Stepped Obsidian Sanctum Dais
SANCTUM_DAIS = [
    hx3("#14121f"),  # 0: joint
    hx3("#232134"),  # 1: deep obsidian slab
    hx3("#302e44"),  # 2: obsidian body A
    hx3("#3d3b54"),  # 3: obsidian body B
    hx3("#4e4d68"),  # 4: lit glassy edge
]

# `f_mine` Timber & Rough-Hewn Rock Wall Ramps
MINE_ROCK = [
    hx3("#1a1722"),  # 0: deep rock fissure / skirting
    hx3("#272331"),  # 1: dark rock shadow
    hx3("#363142"),  # 2: rough rock mid-dark
    hx3("#474154"),  # 3: rough rock mid
    hx3("#5a5266"),  # 4: lit rock stratum
    hx3("#70677c"),  # 5: mineral rock ridge
]

MINE_TIMBER = [
    hx3("#140c14"),  # 0: tarred wood base
    hx3("#1e1420"),  # 1: dark oak outline
    hx3("#33202a"),  # 2: deep oak shadow
    hx3("#4a2e2c"),  # 3: dark oak
    hx3("#633f2e"),  # 4: mid oak
    hx3("#7e5536"),  # 5: lit oak beam
    hx3("#9b6f44"),  # 6: warm oak post highlight
    hx3("#b88c5c"),  # 7: bright oak top/left bevel
]

OBSIDIAN_WALL = [
    hx3("#14121f"),  # 0: darkest obsidian
    hx3("#201e30"),  # 1: deep obsidian shadow
    hx3("#2f2e42"),  # 2: dark basalt block
    hx3("#414257"),  # 3: mid basalt-obsidian
    hx3("#575a6c"),  # 4: lit obsidian block
    hx3("#727685"),  # 5: glassy bevel
]

STEEL_DECK = [
    hx3("#181924"),  # 0: dark plate seam
    hx3("#282a38"),  # 1: shaded iron girder
    hx3("#3a3d4e"),  # 2: dark steel plate
    hx3("#4d5164"),  # 3: mid steel tread
    hx3("#666b7e"),  # 4: lit steel plate edge
    hx3("#8b91a2"),  # 5: bright steel rivet / lip
    hx3("#b6bcc8"),  # 6: specular rivet glint
]

# Incandescent Molten Magma Ramp
MAGMA_CRUST = hx3("#1b1626")
MAGMA_DARK = hx3("#3a1030")
MAGMA_CRIMSON = hx3("#641a30")
MAGMA_RED = hx3("#942c30")
MAGMA_ORANGE = hx3("#cc6a28")
MAGMA_GOLD = hx3("#eaa644")
MAGMA_YELLOW = hx3("#f8e48c")
MAGMA_WHITE = hx3("#fcfaf4")


# ---------------------------------------------------------------------------
# Non-Rectangular Branching Mine & Volcanic Caldera Plan (28 x 22)
# ---------------------------------------------------------------------------
# Notice:
# - NW Motherlode Ore Gallery (x=2..11, y=4..12) + SW Timber-Shored Shaft & Tool Station (x=2..10, y=14..21)
#   are separated on the West by a thick rock spur at x=2..6, y=13..14 so the SW Tool Station gets its OWN
#   timber-shored north wall (`face==1,2` at y=14..15) right behind `pickaxe-rack`!
# - Northern Volcanic Chasm Partition (`#` at x=12..18, y=1..2 and x=15..16, y=3..4) cleanly separates
#   the West Mine walls (`timber_mine`) from the NE Stepped Obsidian Sanctum walls (`obsidian_sanctum`)!
# - East of the diagonal Magma River (y=13..19), the SE Caldera Lava Basin sits inside dramatic basalt
#   cavern walls with ZERO unreachable walkable pockets!
PLAN: List[str] = [
    "############################",  # 00: Subterranean Basalt Void / Ceiling
    "###################......###",  # 01: NE Obsidian Sanctum Apse niche face==1 (x=19..24)
    "#################.........##",  # 02: Sanctum Step 1 face==1 (17..18, 25), central face==2
    "############..##...........#",  # 03: Lava-fall fissure mouth face==1 (12..13) | ## | Sanctum (16..26)
    "####......##...............#",  # 04: NW Motherlode face==1 (4..9) | Chasm cheek face==1 (14..15) | Sanctum
    "##.........................#",  # 05: NW step face==1 (2..3, 10..11) | Chasm face==2 (14..15) | Sanctum Dais
    "##.........................#",  # 06: NW Ore floor + Uninterrupted Magma River + Sanctum Dais!
    "##.........................#",  # 07: Full NW Ore Face + Magma Chasm + Sanctum Dais Stairs
    "##........................##",  # 08: Rail Loading Face + Magma River + Sanctum Plaza
    "##........................##",  # 09: Rail Terminus A (4..8, y=9) + Bridgehead Braziers
    "###......................###",  # 10: Riveted Iron & Basalt Bridge row 1 (x=14..17) across Magma!
    "###......................###",  # 11: Riveted Iron & Basalt Bridge row 2 (x=14..17) across Magma!
    "######...................###",  # 12: Thick West Rock Partition (`#` x=0..5) + East Bridgehead Plaza
    "######.................#####",  # 13: Central Minecart Haulage (x=8..13) + Curved SE Caldera Rim
    "###.....................####",  # 14: SW Tool Station north wall face==1 (x=3..5) + SE Caldera
    "##......................####",  # 15: SW step face==1 (2), Tool Station face==2 (3..5), SE Caldera
    "##......................####",  # 16: `pickaxe-rack` row (3..5) + SE Rail Spur (13..17) + Caldera
    "##......................####",  # 17: SW Tool Station floor + Ore Sorting Spur + Bubbling Caldera
    "##.....................#####",  # 18: SW Mine Shaft Gallery + SE Ore Vein Nook + Caldera Pool
    "###..................#######",  # 19: Tapered SW Mine Shaft & Southern Caldera Rim
    "####......##################",  # 20: Stepped SW Timber-Shored Shaft Approach (x=4..9)
    "#####....###################",  # 21: South-West Mine Shaft Entrance Mouth (x=5..8)
]
assert len(PLAN) == GH and all(len(r) == GW for r in PLAN)


# ---------------------------------------------------------------------------
# Diagonal Winding Molten Magma River, Bridge & Stepped Obsidian Dais Math
# ---------------------------------------------------------------------------
def magma_center_and_halfwidth(Y: float) -> Tuple[float, float]:
    """
    Diagonal winding molten magma fissure flowing uninterrupted from the North Lava-Fall Cleft
    (X=208, Y=80) down-southeast into the bubbling SE Volcanic Caldera Pool (X=340, Y=292).
    """
    if Y < 76:
        return (208.0, 0.0)
    if Y < 148:
        t = (Y - 76.0) / 72.0
        cx = 208.0 + 44.0 * (t ** 1.05) + 5.0 * math.sin((Y - 80.0) * 0.075)
        hw = 15.0 + 4.5 * math.sin(t * math.pi * 0.75)
        return (cx, hw)
    if Y <= 204:
        # Bridge crossing gorge & East Bridgehead Plaza (Y=148..204)
        t = (Y - 148.0) / 56.0
        cx = 252.0 + 15.0 * t + 2.5 * math.sin(Y * 0.06)
        hw = 17.0 + 2.0 * t
        return (cx, hw)
    # South-East Volcanic Caldera expansion (Y=205..312): curves smoothly SE (no horizontal line!)
    t = min(1.0, (Y - 204.0) / 96.0)
    cx = 267.0 + 76.0 * (t ** 0.85) + 5.0 * math.sin(Y * 0.055)
    hw = 19.0 + 42.0 * (t ** 0.78)
    return (cx, hw)


# Cooling dark basalt crust islands floating inside the wider magma bends
CRUST_ISLANDS = [
    (228.0, 122.0, 6.5, 4.2),
    (318.0, 236.0, 9.5, 5.8),
    (348.0, 272.0, 11.0, 6.5),
    (312.0, 286.0, 7.5, 4.8),
]


def in_magma_river(X: int, Y: int) -> bool:
    if Y < 78 or Y > 312:
        return False
    cx, hw = magma_center_and_halfwidth(Y)
    if hw <= 0.0:
        return False
    wob = (vnoise(X, Y, 6.5, 211) - 0.5) * 6.5
    # West bank stays cleanly >= 294 at Y >= 248 so Rail Spur (gx=13..17 -> X=208..287) has sturdy dry bank!
    west_limit = cx - hw + wob
    if 244 <= Y <= 284:
        west_limit = max(west_limit, 293.0 + (vnoise(293, Y, 5.0, 223) - 0.5) * 3.0)
    east_limit = cx + hw + wob
    if Y >= 205:
        # Smoothly curve northern caldera shoreline down-eastward from X=286 (Y=205) to X=410 (Y=228)!
        ramp_t = min(1.0, (Y - 205.0) / 22.0)
        curved_east = 286.0 + 126.0 * (ramp_t ** 0.72) + (vnoise(X, Y, 6.0, 229) - 0.5) * 8.0
        east_limit = max(east_limit, curved_east)
    return west_limit <= X <= east_limit


def in_iron_bridge(X: int, Y: int) -> bool:
    """Sturdy 4-tile-wide riveted iron & dressed basalt bridge spanning gx=14..17, gy=10..11."""
    return (222 <= X <= 289) and (156 <= Y <= 195)


def in_iron_bridge_walk(X: int, Y: int) -> bool:
    return (222 <= X <= 289) and (160 <= Y <= 191)


def in_obsidian_dais(X: int, Y: int) -> bool:
    """Stepped octagonal dark basalt ritual dais in NE Volcanic Sanctum (x=18..25, y=3..6)."""
    if not (48 <= Y <= 110 and 288 <= X <= 415):
        return False
    cut_sw = max(0, (Y - 96)) + max(0, (302 - X))
    cut_se = max(0, (Y - 96)) + max(0, (X - 401))
    if Y > 96 and (X < 288 + (Y - 96) or X > 415 - (Y - 96)):
        return False
    _ = cut_sw, cut_se
    return True


def in_obsidian_stairs(X: int, Y: int) -> bool:
    """4-wide carved dark basalt steps leading from Bridgehead Plaza up onto the Obsidian Dais."""
    return (320 <= X <= 383) and (107 <= Y <= 123)


def is_sanctum_zone(cx: int, cy: int) -> bool:
    """True on the North-East Volcanic Obsidian Sanctum side of the chasm partition."""
    if cy <= 5 and cx >= 16:
        return True
    if 6 <= cy <= 13 and cx >= 17:
        return True
    return False


# ---------------------------------------------------------------------------
# World-Coordinate Floor, Wall, Magma & Riveted Bridge Painters
# ---------------------------------------------------------------------------
COURSE_H = [9, 11, 8, 12, 10, 9, 11, 10]
SLAB_W = [16, 21, 14, 19, 15, 20, 13, 17]  # sum = 135px (coprime to 16)

Y_COURSES: List[Tuple[int, int, int]] = []
_ci = 0
while len(Y_COURSES) < H_PX + 16:
    ch = COURSE_H[_ci % len(COURSE_H)]
    for _ly in range(ch):
        Y_COURSES.append((_ci, _ly, ch))
    _ci += 1


def paint_basalt_ashlar(X: int, Y: int, ramp: Sequence[Tuple[int, int, int]], seed: int = 71) -> Tuple[int, int, int]:
    ci, ly, sh = Y_COURSES[Y]
    shift = int(H(ci, 3, seed) * 59)
    xx = X + shift
    cyc = xx // 135
    rem = xx % 135
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
    if lx == sw - 1 or ly == sh - 1:
        return ramp[0]
    tone = [2, 2, 3, 3, 2, 1][int(H(ci, cyc * 16 + si, seed + 5) * 6) % 6]
    if ly == 0 and 1 <= lx <= sw - 3 and H(ci, si, seed + 11) < 0.55:
        tone = min(4, tone + 1)
    if H(X // 3, Y // 3, seed + 17) < 0.09:
        tone = max(1, tone - 1)
    return ramp[tone]


def paint_mine_earth(X: int, Y: int) -> Tuple[int, int, int]:
    """Quiet compacted subterranean earth & crushed slate-basalt floor (`tiles5.py` `cave` spirit)."""
    v = fbm(X, Y, 49) * 0.68 + H(X // 2, Y // 2, 53) * 0.32
    idx = 1 if v < 0.28 else (2 if v < 0.56 else (3 if v < 0.82 else 4))
    r = H(X, Y, 57)
    if r < 0.018:
        idx = min(4, idx + 1)
    elif r > 0.975:
        idx = max(0, idx - 1)
    return MINE_FLOOR[idx]


def paint_riveted_bridge(X: int, Y: int) -> Tuple[int, int, int]:
    """Sturdy riveted dark-iron & dressed basalt bridge spanning the molten magma chasm."""
    # Stone bridgehead abutments at X=222..231 and X=280..289
    if X < 231 or X > 280:
        if Y in (156, 195):
            return OBSIDIAN_WALL[0]
        if Y in (157, 158, 192, 193):
            return OBSIDIAN_WALL[5] if Y in (157, 192) else OBSIDIAN_WALL[3]
        return paint_basalt_ashlar(X, Y, BASALT_SLABS, seed=83)

    # Heavy riveted forged-iron side girders / low parapets (Y=156..159 and Y=192..195)
    if Y <= 159:
        fy = Y - 156
        if fy == 0:
            return STEEL_DECK[0]
        if fy == 1:
            return STEEL_DECK[6] if (X % 10 == 4) else STEEL_DECK[5]
        if fy == 2:
            return STEEL_DECK[3]
        return STEEL_DECK[0]
    if Y >= 192:
        fy = Y - 192
        if fy == 0:
            return STEEL_DECK[5] if (X % 10 == 4) else STEEL_DECK[4]
        if fy == 1:
            return STEEL_DECK[2]
        if fy == 2:
            # Warm under-girder magma reflection!
            return lerp_rgb(STEEL_DECK[1], MAGMA_ORANGE, 0.38)
        return STEEL_DECK[0]

    # Walkable heavy steel deck plates (12px wide transverse plates with diamond tread & corner rivets)
    lx = (X - 231) % 12
    ly = (Y - 160) % 16
    if lx == 11 or ly == 15:
        return STEEL_DECK[0]
    if lx == 0 or ly == 0:
        return STEEL_DECK[4]
    if lx in (2, 9) and ly in (2, 13):
        return STEEL_DECK[6]  # Gleaming steel deck bolt!
    tread = ((X + Y) % 4 == 0) and (3 <= ly <= 12)
    return STEEL_DECK[3] if tread else STEEL_DECK[2]


def paint_molten_magma(X: int, Y: int) -> Tuple[int, int, int]:
    """Carved irregular basalt drop-banks, cooling crust islands, and incandescent magma flow."""
    # 3px dark craggy basalt drop-bank along northern/western inner rim of the fissure
    if not in_magma_river(X, Y - 1) or not in_magma_river(X - 1, Y):
        return OBSIDIAN_WALL[0]
    if not in_magma_river(X, Y - 2) or not in_magma_river(X - 2, Y):
        return OBSIDIAN_WALL[2]
    if not in_magma_river(X, Y - 3):
        return MAGMA_DARK

    # Dark cooling basalt crust islands with glowing orange-red perimeter cracks
    for icx, icy, irx, iry in CRUST_ISLANDS:
        d = ((X - icx) / irx) ** 2 + ((Y - icy) / iry) ** 2 + (vnoise(X, Y, 3.5, 301) - 0.5) * 0.28
        if d <= 0.78:
            return MAGMA_CRUST if H(X // 2, Y // 2, 307) < 0.6 else OBSIDIAN_WALL[2]
        if d <= 1.05:
            return MAGMA_GOLD if d > 0.92 else MAGMA_RED

    # Bridge shadow cast onto magma immediately south of bridge (Y=196..201, X=230..282)
    bridge_shade = 0.68 if (196 <= Y <= 201 and 230 <= X <= 282) else 1.0

    # Distance from shoreline -> hotter toward river center & SE caldera eddies
    cx, hw = magma_center_and_halfwidth(Y)
    center_bias = max(0.0, 1.0 - abs(X - cx) / max(8.0, hw * 0.95))
    flow = (
        0.55 * vnoise(X - Y * 0.42, Y * 0.65, 11.0, 313)
        + 0.30 * vnoise(X * 0.9, Y * 0.9, 5.2, 317)
        + 0.15 * math.sin((X - cx) * 0.24 + Y * 0.11)
    )
    heat = center_bias * 0.58 + flow * 0.56

    if heat < 0.30:
        c = MAGMA_CRIMSON
    elif heat < 0.46:
        c = MAGMA_RED
    elif heat < 0.64:
        c = MAGMA_ORANGE
    elif heat < 0.80:
        c = MAGMA_GOLD
    elif heat < 0.92:
        c = MAGMA_YELLOW
    else:
        c = MAGMA_WHITE
    return mul(c, bridge_shade)


def floor_mine_volcano_world(X: int, Y: int) -> Tuple[int, int, int]:
    # 1. Sturdy Riveted Iron & Basalt Stone Bridge (overrides magma river underneath!)
    if in_iron_bridge(X, Y):
        return paint_riveted_bridge(X, Y)

    # 2. Molten Magma River & SE Volcanic Caldera
    if in_magma_river(X, Y):
        return paint_molten_magma(X, Y)

    # 3. NE Obsidian Sanctum Stairs (X=320..383, Y=107..123)
    if in_obsidian_stairs(X, Y):
        if X in (320, 383):
            return OBSIDIAN_WALL[0]
        if X in (321, 382):
            return OBSIDIAN_WALL[5]
        rel = (Y - 107) % 4
        if rel == 0:
            return OBSIDIAN_WALL[5]
        if rel == 1:
            return SANCTUM_DAIS[4]
        if rel == 2:
            return SANCTUM_DAIS[1]
        return OBSIDIAN_WALL[0]

    # 4. Elevated Octagonal Obsidian Sanctum Dais (x=18..25, y=3..6)
    if in_obsidian_dais(X, Y):
        if not in_obsidian_dais(X, Y + 1) or not in_obsidian_dais(X - 1, Y) or not in_obsidian_dais(X + 1, Y):
            return OBSIDIAN_WALL[0]
        if not in_obsidian_dais(X, Y + 2):
            return SANCTUM_DAIS[1]
        if not in_obsidian_dais(X, Y + 3) or not in_obsidian_dais(X - 2, Y):
            return OBSIDIAN_WALL[5]

        # Glowing molten magma rune channels inlaid into the dark obsidian dais around `obsidian-altar` (352, 74)
        rx = abs(X - 351.5)
        ry = abs(Y - 76.0) * 1.25
        oct_d = max(rx, ry, (rx + ry) * 0.72)
        if 21.5 <= oct_d <= 23.6 or (abs(X - 351.5) <= 1.2 and 86 <= Y <= 104):
            flick = 0.5 + 0.5 * vnoise(X, Y, 4.0, 349)
            return lerp_rgb(MAGMA_RED, MAGMA_GOLD, flick)
        return paint_basalt_ashlar(X, Y, SANCTUM_DAIS, seed=91)

    # 5. NE Sanctum & Scalloped West Bridgehead Apron vs West Mine Earth
    cx, cy = X // 16, Y // 16
    west_apron_d = math.hypot((X - 228.0) / 30.0, (Y - 175.0) / 28.0) + 0.18 * (fbm(X, Y, 377) - 0.5)
    if is_sanctum_zone(cx, cy) or west_apron_d < 1.0:
        c = paint_basalt_ashlar(X, Y, BASALT_SLABS, seed=77)
    else:
        c = paint_mine_earth(X, Y)

    # Subtle warm orange-crimson rim-glow on stones bordering the molten magma fissure!
    for dist_px, boost in ((3, 0.34), (7, 0.18), (12, 0.08)):
        if (
            in_magma_river(X + dist_px, Y)
            or in_magma_river(X - dist_px, Y)
            or in_magma_river(X, Y + dist_px)
            or in_magma_river(X, Y - dist_px)
        ):
            c = lerp_rgb(c, MAGMA_ORANGE, boost)
            break

    return c


def wall_timber_mine(X: int, fy: int) -> Tuple[int, int, int]:
    """
    `tiles5.py` `f_mine`-inspired 32px timber-shored rough-hewn rock north wall:
    - Heavy horizontal oak shoring beam at fy=0..3
    - Sturdy 4px vertical oak timber posts every 44px (non-16px!) with iron gusset bolts
    - Lumpy stratified mine rock between posts + molten lava-fall cascade at X=196..219 (gx=12..13)!
    """
    # Special feature: Glowing molten lava-fall gushing down the north fissure wall at gx=12..13 (X=197..218)!
    if 197 <= X <= 218 and Y_IS_LAVA_WALL[0]:
        dx = abs(X - 207.5)
        wob = (vnoise(X, fy, 3.8, 401) - 0.5) * 2.5
        if dx + wob <= 7.2:
            streak = vnoise(X * 1.4, fy * 0.45, 3.2, 409)
            if dx <= 2.4 and streak > 0.42:
                return MAGMA_WHITE if fy % 5 == 0 else MAGMA_YELLOW
            if dx <= 4.8:
                return MAGMA_GOLD if streak > 0.45 else MAGMA_ORANGE
            return MAGMA_RED
        if dx + wob <= 9.5:
            return OBSIDIAN_WALL[0]

    lx = (X + 10) % 44
    # Vertical 4px oak shoring post
    if lx < 4:
        if fy >= 30:
            return MINE_TIMBER[0]
        if 3 <= fy <= 5 and lx in (1, 2):
            return STEEL_DECK[5] if (fy == 4 and lx == 1) else STEEL_DECK[2]  # Iron gusset collar!
        c = [MINE_TIMBER[1], MINE_TIMBER[7], MINE_TIMBER[5], MINE_TIMBER[1]][lx]
        return mul(c, 0.86) if fy >= 16 else c

    # Top horizontal oak cross-beam (`fy = 0..3`)
    if fy < 4:
        return [MINE_TIMBER[1], MINE_TIMBER[6], MINE_TIMBER[4], MINE_TIMBER[1]][fy]

    # Lumpy rough-hewn mine rock strata (`tiles5.py` `f_rock`)
    if fy >= 29:
        return MINE_ROCK[0] if fy == 31 else MINE_ROCK[1]
    v = (
        H(X // 4, fy // 3, 89) * 0.48
        + H(X // 7, fy // 5, 90) * 0.37
        + 0.15 * math.sin(X * 0.27 + fy * 0.22)
    )
    t = 1 if v < 0.26 else (2 if v < 0.52 else (3 if v < 0.80 else 4))
    if H(X, fy, 91) < 0.035:
        t = 5
    c = MINE_ROCK[t]
    return mul(c, 0.85) if fy >= 16 else c


# Mutable flag set per-cell during structure pass so only the northern lava mouth (cy in 3,4) renders the lava-fall!
Y_IS_LAVA_WALL = [False]


def wall_obsidian_sanctum(X: int, fy: int) -> Tuple[int, int, int]:
    """32px dressed volcanic basalt & glassy obsidian wall with glowing ember frieze."""
    if fy >= 29:
        return OBSIDIAN_WALL[2] if fy == 29 else (OBSIDIAN_WALL[1] if fy == 30 else OBSIDIAN_WALL[0])
    if 12 <= fy <= 15:
        if fy in (12, 15):
            return OBSIDIAN_WALL[0]
        # Carved dwarven/volcanic ember rune frieze
        k = (X + 4) % 12
        if k in (3, 4, 5) and ((X // 12 + fy) % 2 == 0):
            return MAGMA_GOLD if k == 4 else MAGMA_RED
        return OBSIDIAN_WALL[2]

    courses = [0, 6, 12, 16, 22, 29]
    r = max(i for i, v in enumerate(courses[:-1]) if v <= fy)
    y0, y1 = courses[r], courses[r + 1]
    ly = fy - y0
    hgt = y1 - y0
    W_blk = [19, 15, 21, 17, 23][r % 5]
    off = (r * 11 + int(H(r, 4, 151) * 13)) % W_blk
    lx = (X + off) % W_blk
    blk = (X + off) // W_blk

    if ly == hgt - 1 or lx == W_blk - 1:
        # Occasional faint ember glow in lower mortar chinks
        if fy >= 20 and H(X, fy, 157) < 0.12:
            return MAGMA_CRIMSON
        c = OBSIDIAN_WALL[0]
    else:
        tone = 3 if H(blk, r, 163) < 0.58 else 2
        if ly == 0 and lx < W_blk - 2:
            tone = min(4, tone + 1)
        elif lx == 0 and ly > 0:
            tone = min(4, tone + 1)
        c = OBSIDIAN_WALL[tone]
    return mul(c, 0.85) if fy >= 16 else c


# ---------------------------------------------------------------------------
# Derived RM2000 Structure Renderer (`room2.py` method)
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
            sanctum = is_sanctum_zone(cx, cy)
            rim = RIM_OBSIDIAN if sanctum else RIM_MINE
            Y_IS_LAVA_WALL[0] = cy in (3, 4) and cx in (12, 13)

            for ly in range(16):
                for lx in range(16):
                    X, Y = cx * 16 + lx, cy * 16 + ly
                    if g[cy][cx] and face[cy][cx]:
                        fy = ly + (face[cy][cx] - 1) * 16
                        c = wall_obsidian_sanctum(X, fy) if sanctum else wall_timber_mine(X, fy)
                        if not inn(cx - 1, cy) and lx == 0:
                            c = mul(c, 0.76)
                        elif not inn(cx + 1, cy) and lx == 15:
                            c = mul(c, 0.76)
                        if fy < 4 and not (Y_IS_LAVA_WALL[0] and 199 <= X <= 216):
                            c = mul(c, 0.64 + 0.08 * fy)
                        px[X, Y] = c + (255,)
                    elif g[cy][cx]:
                        c = floor_mine_volcano_world(X, Y)
                        if (face[cy - 1][cx] if cy > 0 else 0) and ly < 3 and not in_magma_river(X, Y):
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
                        if s_in and ly >= 13:
                            if ly == 13:
                                c = rim[4] if notch_x else rim[5]
                            elif ly == 14:
                                c = rim[2] if notch_x else rim[3]
                            else:
                                c = rim[0]
                        if n_in and ly <= 2:
                            if ly == 0:
                                c = rim[0]
                            elif ly == 1:
                                c = rim[3] if notch_x else rim[4]
                            else:
                                c = rim[2]
                        if w_in and lx <= 2:
                            if lx == 0:
                                c = rim[0]
                            elif lx == 1:
                                c = rim[3] if notch_y else rim[4]
                            else:
                                c = rim[2]
                        if e_in and lx >= 13:
                            if lx == 15:
                                c = rim[0]
                            elif lx == 14:
                                c = rim[2] if not notch_y else rim[1]
                            else:
                                c = rim[3]

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

    # 6px west-wall soft cast shadow (skips glowing magma pixels so lava stays incandescent!)
    for cy in range(Hh):
        for cx in range(W):
            if g[cy][cx] and not inn(cx - 1, cy):
                for ly in range(16):
                    for lx in range(6):
                        X, Y = cx * 16 + lx, cy * 16 + ly
                        if g[cy][cx] and not face[cy][cx] and in_magma_river(X, Y) and not in_iron_bridge(X, Y):
                            continue
                        r, gg, b, a = px[X, Y]
                        px[X, Y] = mul((r, gg, b), 0.62 + 0.06 * lx) + (a,)

    return im


# ---------------------------------------------------------------------------
# Slice `rails-kit.png` (48x16) & Assemble Seamless Winding Haulage Track
# ---------------------------------------------------------------------------
@dataclass
class Piece:
    id: str
    im: Image.Image
    fw: int
    fh: int
    up: int = 0
    kind: str = "floor"  # 'floor', 'wall', 'flat'
    px_offset: Tuple[int, int] = (0, 0)


# 18-tile continuous winding minecart rail line from NW Motherlode Face -> Central Cavern -> SE Magma Bank!
RAIL_PATH: List[Tuple[int, int, str]] = [
    (4, 9, "EW_BUFL"),   # West Motherlode loading terminus with iron/oak buffer bumper
    (5, 9, "EW"),        # Minecart #1 sits on (5..6, 9)
    (6, 9, "EW"),
    (7, 9, "EW"),
    (8, 9, "TURN_S_W"),  # Connects West (7,9) -> South (8,10)
    (8, 10, "NS"),
    (8, 11, "NS"),
    (8, 12, "NS"),
    (8, 13, "TURN_N_E"), # Connects North (8,12) -> East (9,13)
    (9, 13, "EW"),
    (10, 13, "EW"),      # Minecart #2 sits on (10..11, 13)
    (11, 13, "EW"),
    (12, 13, "EW"),
    (13, 13, "TURN_S_W"),# Connects West (12,13) -> South (13,14)
    (13, 14, "NS"),
    (13, 15, "NS"),
    (13, 16, "TURN_N_E"),# Connects North (13,15) -> East (14,16)
    (14, 16, "EW"),
    (15, 16, "EW"),
    (16, 16, "EW"),
    (17, 16, "EW_BUFR"), # SE Magma-bank smelting tipple terminus with buffer bumper
]


def add_buffer_bumper(tile: Image.Image, side: str) -> Image.Image:
    """Add a crisp forged-iron & oak end-of-track buffer bumper on left ('L') or right ('R') of an EW rail tile."""
    out = tile.copy()
    px = out.load()
    bx = 1 if side == "L" else 12
    # Heavy vertical oak cross-beam + steel rail buffer blocks at ry=3..5 and ry=10..12
    for y in range(1, 15):
        px[bx, y] = hx3("#1e1420") + (255,)
        px[bx + 1, y] = hx3("#b88c5c" if y < 8 else "#9b6f44") + (255,)
        px[bx + 2, y] = hx3("#633f2e") + (255,)
        px[bx + 3 if bx + 3 < 16 else bx, y] = hx3("#1e1420") + (255,)
    for ry in (3, 10):
        cap_x = bx + 2 if side == "L" else bx - 1
        px[cap_x, ry] = hx3("#1c1c2c") + (255,)
        px[cap_x, ry + 1] = hx3("#cdd2d0") + (255,)
        px[cap_x, ry + 2] = hx3("#1c1c2c") + (255,)
    return out


def slice_rails_kit(kit: Image.Image) -> Dict[str, Piece]:
    assert kit.size == (48, 16), f"Unexpected rails-kit size: {kit.size}"
    ew = kit.crop((0, 0, 16, 16))
    ns = kit.crop((16, 0, 32, 16))
    turn_se = kit.crop((32, 0, 48, 16))  # Connects South + East
    turn_sw = turn_se.transpose(Image.Transpose.FLIP_LEFT_RIGHT)   # Connects South + West
    turn_ne = turn_se.transpose(Image.Transpose.FLIP_TOP_BOTTOM)   # Connects North + East
    turn_nw = turn_se.transpose(Image.Transpose.ROTATE_180)        # Connects North + West

    segs = {
        "EW": ew,
        "NS": ns,
        "TURN_S_E": turn_se,
        "TURN_S_W": turn_sw,
        "TURN_N_E": turn_ne,
        "TURN_N_W": turn_nw,
        "EW_BUFL": add_buffer_bumper(ew, "L"),
        "EW_BUFR": add_buffer_bumper(ew, "R"),
    }
    return {f"rails-{k}": Piece("rails-kit", im, fw=1, fh=1, up=0, kind="flat") for k, im in segs.items()}


def load_mine_catalog() -> Dict[str, Piece]:
    cat: Dict[str, Piece] = {
        # `minecart.png` (32x32): dy=-1 with up=16 -> Y0 = gy*16 - 17, locking flanged wheels onto EW rail ry=10..12!
        "minecart": Piece(
            "minecart",
            Image.open(OBJ_DIR / "minecart.png").convert("RGBA"),
            fw=2,
            fh=1,
            up=16,
            kind="floor",
            px_offset=(0, -1),
        ),
        "obsidian-altar": Piece(
            "obsidian-altar",
            Image.open(OBJ_DIR / "obsidian-altar.png").convert("RGBA"),
            fw=2,
            fh=1,
            up=16,
            kind="floor",
        ),
        "ore-crystal-vein": Piece(
            "ore-crystal-vein",
            Image.open(OBJ_DIR / "ore-crystal-vein.png").convert("RGBA"),
            fw=2,
            fh=1,
            up=16,
            kind="floor",
        ),
        "lava-brazier": Piece(
            "lava-brazier",
            Image.open(OBJ_DIR / "lava-brazier.png").convert("RGBA"),
            fw=1,
            fh=1,
            up=16,
            kind="floor",
        ),
        "pickaxe-rack": Piece(
            "pickaxe-rack",
            Image.open(OBJ_DIR / "pickaxe-rack.png").convert("RGBA"),
            fw=2,
            fh=1,
            up=16,
            kind="wall",
        ),
    }
    cat.update(slice_rails_kit(Image.open(OBJ_DIR / "rails-kit.png").convert("RGBA")))
    return cat


def build_scene_spec(cat: Dict[str, Piece]) -> dict:
    items = []

    # 0. Continuous 21-segment Winding Minecart Rail Haulage Line (flat walkable track!)
    for gx, gy, seg_kind in RAIL_PATH:
        items.append((cat[f"rails-{seg_kind}"], gx, gy, f"Haulage Rail {seg_kind} @({gx},{gy})"))

    items.extend(
        [
            # ===============================================================
            # 1. SW TIMBER-SHORED MINE SHAFT & TOOL STATION (x=2..9, y=14..21)
            # ===============================================================
            # `pickaxe-rack` flush against `face == 2` north timber-shored rock wall (`y=15` -> floor `y=16`)!
            (cat["pickaxe-rack"], 3, 16, "SW Shaft Tool Station Pickaxe Rack"),
            (cat["lava-brazier"], 4, 20, "Mine Shaft Entrance Brazier W"),
            (cat["lava-brazier"], 9, 20, "Mine Shaft Entrance Brazier E"),
            (cat["ore-crystal-vein"], 2, 18, "SW Shaft Exposed Ore Seam"),

            # ===============================================================
            # 2. NW MOTHERLODE ORE FACE & WINDING RAIL HAULAGE (x=2..17, y=4..18)
            # ===============================================================
            # `pickaxe-rack` flush against `face == 2` in NW Motherlode Gallery (`y=5` -> floor `y=6`)!
            (cat["pickaxe-rack"], 6, 6, "NW Motherlode Tool Rack"),
            (cat["ore-crystal-vein"], 2, 7, "NW Motherlode Gold-Ruby Outcrop W"),
            (cat["ore-crystal-vein"], 9, 7, "NW Motherlode Gold-Amber Outcrop E"),

            # Two gem-heaped `minecart`s staged directly on E-W straight stretches of the haulage line!
            (cat["minecart"], 5, 9, "Motherlode Loading Minecart"),
            (cat["minecart"], 10, 13, "Central Cavern Haulage Minecart"),

            # SE Magma-Bank Smelting Spur outcrop & West Bridgehead `lava-brazier`s
            (cat["ore-crystal-vein"], 15, 18, "SE Caldera Rim Motherlode Vein"),
            (cat["lava-brazier"], 13, 9, "West Bridgehead Lava Brazier N"),
            (cat["lava-brazier"], 13, 12, "West Bridgehead Lava Brazier S"),

            # ===============================================================
            # 3. NE STEPPED VOLCANIC OBSIDIAN SANCTUM (x=16..26, y=1..12)
            # ===============================================================
            (cat["obsidian-altar"], 21, 4, "Volcanic Obsidian Sanctum Altar"),
            (cat["lava-brazier"], 19, 4, "Obsidian Dais Lava Brazier W"),
            (cat["lava-brazier"], 24, 4, "Obsidian Dais Lava Brazier E"),
            (cat["ore-crystal-vein"], 17, 4, "Sanctum Volcanic Crystal Vein W"),
            (cat["ore-crystal-vein"], 25, 6, "Sanctum Volcanic Crystal Vein E"),
            (cat["lava-brazier"], 18, 9, "East Bridgehead Lava Brazier N"),
            (cat["lava-brazier"], 18, 12, "East Bridgehead Lava Brazier S"),
        ]
    )

    chambers = [
        ("SW Timber-Shored Mine Shaft & Tool Station", (6, 18)),
        ("NW Motherlode Ore Gallery", (6, 8)),
        ("Central Rail Haulage Cavern", (11, 12)),
        ("Riveted Iron & Basalt Magma Bridge", (15, 10)),
        ("SE Magma-Bank Smelting Spur", (15, 15)),
        ("NE Volcanic Obsidian Sanctum", (21, 6)),
    ]

    return {
        "plan": PLAN,
        "items": items,
        "chambers": chambers,
        "start": [(6, 21), (7, 21)],
    }


def item_draw_rect(f: Piece, gx: int, gy: int) -> Tuple[int, int, int, int]:
    dx, dy = f.px_offset
    if f.kind == "flat":
        X0, Y0 = gx * 16 + dx, gy * 16 + dy
    else:
        X0, Y0 = gx * 16 + dx, gy * 16 - f.up + dy
    return (X0, Y0, X0 + f.im.width, Y0 + f.im.height)


def compose_scene(spec: dict) -> Image.Image:
    base = render_structure(spec["plan"])
    W_c, H_c, g, face, top, inn = analyse(spec["plan"])

    # 1. Composite flat rails first, bridging 1px dark tile-border ticks between connected rail cells!
    rail_cells = {(gx, gy): kind for gx, gy, kind in RAIL_PATH}
    for f, gx, gy, _label in spec["items"]:
        if f.kind == "flat":
            X0, Y0, _, _ = item_draw_rect(f, gx, gy)
            base.alpha_composite(f.im, (X0, Y0))

    px = base.load()
    # Bridge connected E-W and N-S steel rail joints so continuous steel rails gleam without 16px dark ticks
    for (gx, gy), _kind in rail_cells.items():
        if (gx + 1, gy) in rail_cells:
            # East neighbor connected if current has E terminal and right has W terminal
            cur_has_e = _kind in ("EW", "EW_BUFL", "TURN_S_E", "TURN_N_E")
            nxt_has_w = rail_cells[(gx + 1, gy)] in ("EW", "EW_BUFR", "TURN_S_W", "TURN_N_W")
            if cur_has_e and nxt_has_w:
                jx = gx * 16 + 15
                for ry in (3, 10):
                    px[jx, gy * 16 + ry + 1] = hx3("#a8aeb0") + (255,)
                    px[jx + 1, gy * 16 + ry + 1] = hx3("#cdd2d0") + (255,)
        if (gx, gy + 1) in rail_cells:
            cur_has_s = _kind in ("NS", "TURN_S_E", "TURN_S_W")
            nxt_has_n = rail_cells[(gx, gy + 1)] in ("NS", "TURN_N_E", "TURN_N_W")
            if cur_has_s and nxt_has_n:
                jy = gy * 16 + 15
                for rx in (3, 10):
                    px[gx * 16 + rx + 1, jy] = hx3("#a8aeb0") + (255,)
                    px[gx * 16 + rx + 1, jy + 1] = hx3("#cdd2d0") + (255,)

    # 2. Warm molten floor glows beneath `lava-brazier`, `obsidian-altar`, and `pickaxe-rack` lantern
    glows: List[Tuple[int, int, int, Tuple[int, int, int], float]] = []
    for f, gx, gy, _label in spec["items"]:
        if f.id == "lava-brazier":
            glows.append((gx * 16 + 8, gy * 16 + 8, 28, MAGMA_ORANGE, 0.25))
        elif f.id == "obsidian-altar":
            glows.append((gx * 16 + 16, gy * 16 + 10, 34, MAGMA_RED, 0.24))
        elif f.id == "pickaxe-rack":
            glows.append((gx * 16 + 5, gy * 16 + 6, 20, MAGMA_GOLD, 0.16))

    for cx_p, cy_p, rad, gcol, strength in glows:
        for Y in range(max(0, cy_p - rad), min(H_PX, cy_p + rad + 1)):
            for X in range(max(0, cx_p - rad), min(W_PX, cx_p + rad + 1)):
                cell_x, cell_y = X // 16, Y // 16
                if g[cell_y][cell_x] and not face[cell_y][cell_x] and not in_magma_river(X, Y):
                    d = math.hypot(X - cx_p, (Y - cy_p) * 1.25)
                    if d < rad:
                        k = ((1.0 - d / rad) ** 1.75) * strength
                        r, gg, b, a = px[X, Y]
                        nc = lerp_rgb((r, gg, b), gcol, k)
                        px[X, Y] = (*nc, a)

    # 3. Y-sorted standing & wall objects
    draw_main = []
    for f, gx, gy, _label in spec["items"]:
        if f.kind == "flat":
            continue
        X0, Y0, _, _ = item_draw_rect(f, gx, gy)
        z_key = (gy + f.fh) * 16
        draw_main.append((z_key, X0, Y0, f.im))

    for _, X0, Y0, im in sorted(draw_main, key=lambda d: (d[0], d[1])):
        base.alpha_composite(im, (X0, Y0))

    return base


# ---------------------------------------------------------------------------
# Automated BFS Walkability, Rail Continuity & Architectural Verification
# ---------------------------------------------------------------------------
def cell_walkable_terrain(gx: int, gy: int, floor: List[List[bool]]) -> Tuple[bool, str]:
    if not (0 <= gx < GW and 0 <= gy < GH) or not floor[gy][gx]:
        return False, "wall_or_void"
    cx, cy = gx * 16 + 8, gy * 16 + 8
    # Bridge walkable deck overrides magma river!
    if in_iron_bridge_walk(cx, cy):
        return True, "bridge"
    # Sample 5 points inside cell so no walkable cell clips into molten magma!
    pts = [(cx, cy), (cx - 5, cy - 5), (cx + 5, cy - 5), (cx - 5, cy + 5), (cx + 5, cy + 5)]
    if any(in_magma_river(px_, py_) and not in_iron_bridge_walk(px_, py_) for px_, py_ in pts):
        return False, "magma"
    return True, "floor"


def verify_rail_continuity() -> List[str]:
    """Verify every rail tile's open ports connect reciprocally to an adjacent rail tile (unless buffer end)."""
    ports_map = {
        "EW": {"E", "W"},
        "EW_BUFL": {"E"},
        "EW_BUFR": {"W"},
        "NS": {"N", "S"},
        "TURN_S_E": {"S", "E"},
        "TURN_S_W": {"S", "W"},
        "TURN_N_E": {"N", "E"},
        "TURN_N_W": {"N", "W"},
    }
    delta = {"N": (0, -1, "S"), "S": (0, 1, "N"), "E": (1, 0, "W"), "W": (-1, 0, "E")}
    grid = {(gx, gy): kind for gx, gy, kind in RAIL_PATH}
    errs: List[str] = []
    for (gx, gy), kind in grid.items():
        for p in ports_map[kind]:
            dx, dy, opp = delta[p]
            nb = (gx + dx, gy + dy)
            if nb not in grid:
                errs.append(f"Broken rail at ({gx},{gy}) [{kind}]: port {p} leads to empty cell {nb}")
            elif opp not in ports_map[grid[nb]]:
                errs.append(f"Mismatched rail join ({gx},{gy})[{kind}] -> {nb}[{grid[nb]}]")
    return errs


def verify_and_measure(spec: dict) -> dict:
    plan = spec["plan"]
    W, Hh, g, face, top, inn = analyse(plan)
    floor = [[g[y][x] and not face[y][x] for x in range(W)] for y in range(Hh)]

    issues: List[str] = []
    issues.extend(verify_rail_continuity())

    occ: Dict[Tuple[int, int], str] = {}
    rail_set = {(gx, gy) for gx, gy, _ in RAIL_PATH}

    # 1. Footprint validity, wall backing (`face == 2`), minecart-on-rail check, and non-overlap
    for f, gx, gy, label in spec["items"]:
        if f.kind == "flat":
            ok_t, reason = cell_walkable_terrain(gx, gy, floor)
            if not ok_t:
                issues.append(f"Rail {label} @({gx},{gy}) on non-walkable terrain ({reason})")
            continue

        for yy in range(gy, gy + f.fh):
            for xx in range(gx, gx + f.fw):
                ok_t, reason = cell_walkable_terrain(xx, yy, floor)
                if not ok_t:
                    issues.append(f"{f.id} '{label}' @({gx},{gy}) cell ({xx},{yy}) invalid ({reason})")
                if (xx, yy) in occ:
                    issues.append(f"{f.id} @({gx},{gy}) overlaps {occ[(xx, yy)]} at ({xx},{yy})")
                occ[(xx, yy)] = f.id

        if f.kind == "wall":
            for xx in range(gx, gx + f.fw):
                if not (gy > 0 and face[gy - 1][xx] == 2):
                    issues.append(f"Wall object {f.id} '{label}' @({gx},{gy}) col {xx} not flush against face==2")

        if f.id == "minecart":
            for xx in range(gx, gx + f.fw):
                if (xx, gy) not in rail_set:
                    issues.append(f"Minecart '{label}' @({gx},{gy}) col {xx} is not seated on rails!")

    # 2. Full 16px Grid BFS from SW Mine Shaft Entrance
    walk = [[False] * W for _ in range(Hh)]
    for y in range(Hh):
        for x in range(W):
            ok_t, _ = cell_walkable_terrain(x, y, floor)
            walk[y][x] = ok_t and ((x, y) not in occ)

    starts = [tuple(s) for s in spec["start"] if walk[s[1]][s[0]]]
    if not starts:
        issues.append("Mine shaft start cells are blocked!")

    dist_map: Dict[Tuple[int, int], int] = {s: 0 for s in starts}
    q = deque(starts)
    while q:
        cx, cy = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < W and 0 <= ny < Hh and walk[ny][nx] and (nx, ny) not in dist_map:
                dist_map[(nx, ny)] = dist_map[(cx, cy)] + 1
                q.append((nx, ny))

    trapped = [(x, y) for y in range(Hh) for x in range(W) if walk[y][x] and (x, y) not in dist_map]
    if trapped:
        issues.append(f"Trapped unreachable floor cells ({len(trapped)}): {trapped[:10]}")

    # 3. Verify all named chambers & bridge
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

    # 4. Verify every interactive/standing object has a reachable adjacent use-cell
    station_reports = []
    unreachable_stations = 0
    for f, gx, gy, label in spec["items"]:
        if f.kind == "flat":
            continue
        fp = [(xx, yy) for yy in range(gy, gy + f.fh) for xx in range(gx, gx + f.fw)]
        south = [(xx, gy + f.fh) for xx in range(gx, gx + f.fw)]
        around = [
            (ax + dx, ay + dy)
            for ax, ay in fp
            for dx, dy in ((0, 1), (-1, 0), (1, 0), (0, -1))
            if (ax + dx, ay + dy) not in fp
        ]
        candidates = south if f.kind == "wall" else around
        adj = [c for c in candidates if c in dist_map]
        if not adj:
            unreachable_stations += 1
            issues.append(f"Station '{label}' ({f.id}) @({gx},{gy}) has NO reachable interaction cell!")
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

    # 5. Verify all 6 Carbon sprites are used
    available = sorted(p.stem for p in OBJ_DIR.glob("*.png"))
    used = sorted({f.id for f, _, _, _ in spec["items"]})
    missing = sorted(set(available) - set(used))
    if missing:
        issues.append(f"Missing Carbon sprites: {missing}")

    total_floor = sum(1 for y in range(Hh) for x in range(W) if floor[y][x])
    total_walkable = sum(1 for y in range(Hh) for x in range(W) if walk[y][x])

    return {
        "theme": "mine_volcano",
        "title": "Magma Vein Dwarven Mine v2",
        "ok": len(issues) == 0,
        "issues": issues,
        "grid_size_tiles": [W, Hh],
        "pixel_size_1x": [W_PX, H_PX],
        "pixel_size_2x": [W_PX * 2, H_PX * 2],
        "void_hex": "#141114",
        "floor_cells_total": total_floor,
        "occupied_floor_cells": len(occ),
        "walkable_cells_total": total_walkable,
        "reachable_walk_cells": len(dist_map),
        "trapped_unreachable_cells": len(trapped),
        "connectivity_ratio": round(len(dist_map) / max(1, total_walkable), 4),
        "unreachable_rooms": unreachable_rooms,
        "unreachable_stations": unreachable_stations,
        "rail_segments_placed": len(RAIL_PATH),
        "rail_broken_joins": len(verify_rail_continuity()),
        "carbon_sprites_available": available,
        "carbon_sprites_placed_unique": f"{len(used)}/{len(available)}",
        "total_object_placements": len(spec["items"]),
        "entrance_start_cells": [list(s) for s in starts],
        "chambers": chamber_reports,
        "stations": station_reports,
    }


def main() -> None:
    MV_DIR.mkdir(parents=True, exist_ok=True)
    cat = load_mine_catalog()
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
