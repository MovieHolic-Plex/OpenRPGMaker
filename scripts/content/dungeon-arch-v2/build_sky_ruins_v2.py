#!/usr/bin/env python3
"""
Rebuild `fantasy_sky_ruins` Map Architecture v2 — Polished Edition (480x368 = 30x23 tiles)
- Organic multi-tiered floating sky-island cliff silhouette over cerulean twilight chasm + wispy pixel clouds
- Multi-stepped octagonal/apsed northern sanctuary bastion (level world-Y ashlar courses + corner quoins, zero flat bars)
- Winding S-curve natural sanctuary stream with serene teal depth, shoreline foam, 2-tier rock-framed NE waterfall,
  lotus plunge pool, arched wood-and-rope plank bridge, mossy stepping stones, and plunging SE sky-chasm waterfall
- World-coordinate meadow turf & scalloped/frayed irregular ashlar courtyard + curving cobble trails (zero 16x16 grid!)
- All 20 Carbon Medium sprites + hand-pixelled sacred offerings ON `stone_offering_table` + Beodeul scale chars
- 100% 16px walk-grid BFS verification across all 13 sanctuary landmarks & vignettes
"""

from __future__ import annotations
import math
import os
from collections import deque
from PIL import Image

ROOT = "/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a"
OBJ_DIR = os.path.join(ROOT, "tiledata/dungeon-dots/fantasy_sky_ruins_carbon/objects")
CHAR_REF = os.path.join(ROOT, "tiledata/dungeon-pilot/_dots_kit_refs/ref_beodeul_char_4x.png")
OUT_DIR = os.path.join(ROOT, "tiledata/dungeon-arch-v2/fantasy_sky_ruins")

W, H_PX = 480, 368
GW, GH = W // 16, H_PX // 16  # 30 x 23
AXIS_X = 232  # Grand 3-tile axis (gx = 13, 14, 15 -> x = 208..256)


# ---------------------------------------------------------------------------
# Deterministic World-Coordinate Hash & Smooth Value Noise (No 16px periodicity)
# ---------------------------------------------------------------------------
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
    return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy


def fbm(x: float, y: float, seed: int = 31) -> float:
    return (
        0.55 * vnoise(x, y, 26.0, seed)
        + 0.30 * vnoise(x, y, 11.0, seed + 7)
        + 0.15 * vnoise(x, y, 5.0, seed + 19)
    )


def hex_rgb(s: str) -> tuple[int, int, int]:
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


def lerp_rgb(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return (
        int(round(a[0] + (b[0] - a[0]) * t)),
        int(round(a[1] + (b[1] - a[1]) * t)),
        int(round(a[2] + (b[2] - a[2]) * t)),
    )


def mul_rgb(c: tuple[int, int, int], f: float) -> tuple[int, int, int]:
    return (
        max(0, min(255, int(round(c[0] * f)))),
        max(0, min(255, int(round(c[1] * f)))),
        max(0, min(255, int(round(c[2] * f)))),
    )


# ---------------------------------------------------------------------------
# Palettes Harmonized with Carbon Medium Sprites & Beodeul Trees
# ---------------------------------------------------------------------------
SKY_TOP = hex_rgb("#162947")
SKY_MID = hex_rgb("#284d75")
SKY_BOT = hex_rgb("#598eb8")
SKY_MIST = hex_rgb("#8dbad9")

CLOUD_RAMP = [
    hex_rgb("#5c88b0"),
    hex_rgb("#82add0"),
    hex_rgb("#b2d5ef"),
    hex_rgb("#e2f3ff"),
]

# Meadow turf (quiet, natural, matches beodeul_oak_tree greens)
GRASS_RAMP = [
    hex_rgb("#34501e"),  # 0 deep canopy shadow
    hex_rgb("#426227"),  # 1 cool moss shade
    hex_rgb("#507431"),  # 2 mid-dark meadow
    hex_rgb("#5d843a"),  # 3 main meadow turf
    hex_rgb("#6a9243"),  # 4 sunlit turf
    hex_rgb("#7aa24e"),  # 5 warm clover highlight
]

# Quiet weathered ruin floor slabs (kept below #dadcd9/#e5e7e4 sprite rims for crisp contrast!)
FLOOR_MORTAR = hex_rgb("#4b514a")
FLOOR_MOSS_J = hex_rgb("#456030")
FLOOR_MOSS_L = hex_rgb("#59783b")
FLOOR_SLABS = [
    hex_rgb("#707770"),
    hex_rgb("#7b827a"),
    hex_rgb("#868d84"),
    hex_rgb("#90978e"),
    hex_rgb("#9ca399"),  # soft inner lip
]

# Upper Sanctum sacred moon-ashlar floor (slightly cooler/paler)
SANCTUM_SLABS = [
    hex_rgb("#7c8481"),
    hex_rgb("#88908d"),
    hex_rgb("#939c98"),
    hex_rgb("#9ea7a3"),
    hex_rgb("#acb5b0"),
]
RUNE_INLAY_DARK = hex_rgb("#336a77")
RUNE_INLAY_LIT = hex_rgb("#6ec7d6")

# Retaining wall & cliff limestone ramp (matches ruin_shrine_gate & pillars)
STONE_OUT = hex_rgb("#232528")
STONE_D2 = hex_rgb("#3d4143")
STONE_D1 = hex_rgb("#575b58")
STONE_MID = hex_rgb("#757975")
STONE_L1 = hex_rgb("#959994")
STONE_L2 = hex_rgb("#b4b8b2")
STONE_RIM = hex_rgb("#d8dcd6")
STONE_GLINT = hex_rgb("#e6eae4")

CLIFF_DARK = hex_rgb("#1c2229")
CLIFF_SHADE = hex_rgb("#2c353e")
CLIFF_MID = hex_rgb("#475057")
CLIFF_LIT = hex_rgb("#6a7276")
CLIFF_HIGH = hex_rgb("#8d9492")

# Water ramp (matches sanctuary_fountain_round #1a4640 / #2a6f71 / #9ce0ee)
WATER_ABYSS = hex_rgb("#153c43")
WATER_DEEP = hex_rgb("#1c4d55")
WATER_MID = hex_rgb("#246269")
WATER_SHALLOW = hex_rgb("#2f7b7e")
WATER_FOAM1 = hex_rgb("#7ad2e1")
WATER_FOAM2 = hex_rgb("#bceff7")
WATER_WHITE = hex_rgb("#eefcff")

# Wood bridge ramp
WOOD_RAMP = [
    hex_rgb("#24170f"),
    hex_rgb("#3f2616"),
    hex_rgb("#5e3a20"),
    hex_rgb("#7d4f2d"),
    hex_rgb("#9e683d"),
    hex_rgb("#bf8452"),
    hex_rgb("#d9a16c"),
]


# ---------------------------------------------------------------------------
# Stepped Octagonal Bastion & Floating Island Silhouette (Zero Boxiness!)
# ---------------------------------------------------------------------------
def rear_crown_step_top(x: int) -> int | None:
    """
    Multi-stepped octagonal northern crown wall (like tower.png setbacks!).
    Each setback is a crisp stone bastion step — ZERO long horizontal bar!
    """
    dx = x - AXIS_X
    adx = abs(dx)
    if dx < -134 or dx > 152:
        return None
    if adx <= 32:
        return 6   # Central Shrine Apse housing ruin_shrine_gate
    elif adx <= 58:
        return 13  # Setback 1 (Guardian Statue bays)
    elif adx <= 86:
        return 21  # Setback 2 (Banner bays)
    elif adx <= 114:
        return 29  # Setback 3 (Outer octagonal bastion wings)
    else:
        return 37  # Setback 4 (Crumbling mossy wing tips / spring basin)


def bastion_front_lip(x: int) -> int | None:
    """
    Multi-stepped octagonal southern retaining wall of the Upper Sanctuary Terrace.
    Juts forward at the central Grand Stairs and steps back in 4 architectural tiers per side!
    """
    dx = x - AXIS_X
    adx = abs(dx)
    if dx < -130 or dx > 156:
        return None
    if adx <= 32:
        return 106  # Central Grand Stair Bastion projection
    elif adx <= 54:
        return 99   # Octagonal Step 1
    elif adx <= 78:
        return 91   # Octagonal Step 2
    elif adx <= 104:
        return 83   # Octagonal Step 3
    else:
        return 75   # Outer Wing Step 4 (East side cradles Waterfall #1 spring!)


def bastion_wall_height(x: int) -> int:
    adx = abs(x - AXIS_X)
    if adx <= 54:
        return 30
    elif adx <= 104:
        return 28
    return 25


def island_bounds(x: int, y: int) -> tuple[float, float, float, float]:
    """Return (y_north, y_south, x_west, x_east) for the floating island top surface."""
    rc = rear_crown_step_top(x)
    if rc is not None:
        yn = float(rc)
    else:
        adx = abs(x - AXIS_X)
        extra = max(0.0, adx - 134.0)
        yn = 38.0 + (extra ** 1.24) * 0.30 + 3.0 * math.sin(x * 0.085 + 0.5)
        yn += (vnoise(x, 16, 6.5, 91) - 0.5) * 4.5

    # South cliff lip undulates organically across craggy limestone headlands
    ys = (
        311.0
        + 8.5 * math.sin((x - 58) * 0.022)
        + 5.0 * math.cos(x * 0.051)
        - 0.00052 * ((x - AXIS_X) ** 2)
    )
    if x < 80:
        ys -= ((80 - x) ** 1.34) * 0.22
    if x > 406:
        ys -= ((x - 406) ** 1.34) * 0.24
    ys += (vnoise(x, 310, 6.0, 97) - 0.5) * 5.0

    # West & East irregular sculpted cliff rims
    xw = (
        19.0
        + 6.5 * math.sin(y * 0.032 + 0.5)
        + 4.0 * math.cos(y * 0.075)
        + (vnoise(20, y, 6.0, 103) - 0.5) * 5.0
    )
    if y < 94:
        xw += ((94 - y) ** 1.25) * 0.27
    if y > 266:
        xw += ((y - 266) ** 1.30) * 0.30

    xe = (
        459.0
        - 6.0 * math.sin(y * 0.029 + 1.4)
        - 4.0 * math.cos(y * 0.071)
        + (vnoise(455, y, 6.0, 109) - 0.5) * 5.0
    )
    if y < 88:
        xe -= ((88 - y) ** 1.25) * 0.26
    if y > 270:
        xe -= ((y - 270) ** 1.30) * 0.32

    return yn, ys, xw, xe


def in_causeway(x: int, y: int) -> bool:
    """Ancient stone sky-bridge causeway extending from south cliff lip to y=367."""
    if y < 300:
        return False
    half_w = 29.5 - 1.5 * math.sin((y - 308) * 0.06)
    return abs(x - AXIS_X) <= half_w


def in_island_top(x: int, y: int) -> bool:
    if in_causeway(x, y):
        return True
    yn, ys, xw, xe = island_bounds(x, y)
    return (y >= yn) and (y <= ys) and (x >= xw) and (x <= xe)


def in_grand_stairs(x: int, y: int) -> bool:
    """3-tile-wide (48px) central stone stairway climbing from y=137 up to y=101."""
    return (208 <= x < 256) and (100 <= y <= 138)


# ---------------------------------------------------------------------------
# Winding Natural Sanctuary Stream & Dual Waterfalls (Zero 90-degree canals!)
# ---------------------------------------------------------------------------
def stream_center_and_width(y: float) -> tuple[float, float]:
    if y < 102:
        cx = 368.0 + 2.5 * math.sin(y * 0.08)
        hw = 10.5 if y > 72 else (14.5 - 0.12 * abs(y - 58.0))
        return cx, max(7.5, hw)
    elif y < 162:
        t = (y - 102.0) / 60.0
        cx = 368.0 - 16.0 * (t ** 1.4)
        bulge = math.sin(math.pi * max(0.0, min(1.0, (y - 105.0) / 53.0)))
        hw = 12.0 + 13.5 * bulge
        return cx, hw
    else:
        u = (y - 162.0) / 150.0
        cx = (
            352.0
            - 17.0 * math.sin(u * math.pi * 0.92)
            + 40.0 * (u ** 1.65)
            + 4.2 * math.sin(y * 0.062)
        )
        hw = 12.2 + 2.8 * math.sin((y - 175.0) * 0.048)
        hw += 3.5 * math.exp(-(((y - 274.0) / 16.0) ** 2))
        return cx, hw


def in_plank_bridge(x: int, y: int) -> bool:
    cx, hw = stream_center_and_width(213.0)
    return (int(cx - hw - 9) <= x <= int(cx + hw + 9)) and (203 <= y <= 223)


STEPPING_STONES = [
    (360, 274, 5.8, 4.2),
    (372, 277, 5.5, 4.0),
    (384, 275, 5.8, 4.2),
]


# ---------------------------------------------------------------------------
# Scalloped Ruined Courtyard & Winding Cobble Trails (Per-Slab Frayed Edges!)
# ---------------------------------------------------------------------------
def dist_to_polyline(x: float, y: float, pts: list[tuple[float, float]]) -> float:
    best = 1e9
    for i in range(len(pts) - 1):
        x1, y1 = pts[i]
        x2, y2 = pts[i + 1]
        vx, vy = x2 - x1, y2 - y1
        wx, wy = x - x1, y - y1
        l2 = vx * vx + vy * vy
        t = 0.0 if l2 == 0 else max(0.0, min(1.0, (wx * vx + wy * vy) / l2))
        px, py = x1 + t * vx, y1 + t * vy
        best = min(best, math.hypot(x - px, y - py))
    return best


# Curving S-bend trails (not horizontal straight lines!)
WEST_TRAIL_PTS = [(164, 198), (138, 214), (114, 206), (96, 188), (88, 170)]
EAST_TRAIL_PTS = [(296, 198), (316, 212), (358, 213), (386, 202), (406, 216)]
SOUTH_TRAIL_PTS = [(232, 240), (229, 272), (234, 304), (232, 367)]


def pave_strength(x: float, y: float) -> float:
    """
    Organic scalar field [0..1+] for stone paving.
    Generous scalloped octagonal/elliptical Fountain Plaza cradling colonnade, stele,
    offering table & bench + winding trails!
    """
    # 1. Central Scalloped Sanctuary Courtyard around (232, 194)
    dx = (x - 232.0) / 92.0
    dy = (y - 194.0) / 60.0
    ang = math.atan2(dy, dx)
    scallop = 1.0 + 0.09 * math.cos(6.0 * ang + 0.35) + 0.11 * (fbm(x, y, 55) - 0.5)
    r_plaza = math.hypot(dx, dy) / scallop
    s_plaza = max(0.0, 1.30 - r_plaza)

    # 2. North approach funnel to Grand Stairs
    d_north = dist_to_polyline(x, y, [(232, 134), (232, 168)])
    s_north = max(0.0, 1.08 - d_north / 34.0)

    # 3. South Ancient Causeway path
    if in_causeway(int(x), int(y)) and abs(x - AXIS_X) <= 23:
        s_south = 1.0
    else:
        d_south = dist_to_polyline(x, y, SOUTH_TRAIL_PTS)
        s_south = max(0.0, 1.04 - d_south / 26.0)

    # 4. Winding West Mossy Oak-Grove Trail + Hidden Chest Ruin Alcove at (88, 166)
    d_west = dist_to_polyline(x, y, WEST_TRAIL_PTS)
    s_west = max(0.0, 0.96 - d_west / 21.0)
    r_nook = math.hypot((x - 90.0) / 28.0, (y - 166.0) / 22.0)
    s_nook = max(0.0, 1.12 - r_nook)

    # 5. Winding East Bridge Approach & Creekside Camp Flagstones
    d_east = dist_to_polyline(x, y, EAST_TRAIL_PTS)
    s_east = max(0.0, 0.94 - d_east / 19.5)

    return max(s_plaza, s_north, s_south, s_west, s_nook, s_east)


COURSE_HEIGHTS = [9, 11, 8, 12, 10, 9, 12, 8, 11, 10, 9, 11]
SLAB_WIDTHS = [14, 19, 13, 21, 16, 18, 12, 20, 15, 17]  # sum = 165px (coprime to 16!)

Y_TO_COURSE: list[tuple[int, int, int]] = []
_cy = 0
_ci = 0
while _cy < H_PX + 32:
    ch = COURSE_HEIGHTS[_ci % len(COURSE_HEIGHTS)]
    for ly in range(ch):
        if len(Y_TO_COURSE) < H_PX:
            Y_TO_COURSE.append((_ci, ly, ch))
    _cy += ch
    _ci += 1


def slab_cell_at(x: int, y: int) -> tuple[int, int, int, int, int, int, float, float]:
    ci, ly, sh = Y_TO_COURSE[y]
    shift = int(h2(ci, 3, 211) * 59)
    xx = x + shift
    cycle_w = 165
    cyc = xx // cycle_w
    rem = xx % cycle_w
    acc = 0
    si_local = 0
    sw = SLAB_WIDTHS[0]
    for k, w in enumerate(SLAB_WIDTHS):
        if rem < acc + w:
            si_local = k
            sw = w
            break
        acc += w
    lx = rem - acc
    slab_id = cyc * 16 + si_local
    cx = x - lx + sw * 0.5
    cy = y - ly + sh * 0.5
    return ci, slab_id, lx, ly, sw, sh, cx, cy


# ---------------------------------------------------------------------------
# World-Coordinate Surface & Architectural Masonry Painters
# ---------------------------------------------------------------------------
def paint_wispy_cloud(px, cx: int, cy: int, scale: float, flip: bool = False) -> None:
    """Classic 16-bit sanctuary drifting cloud with puffy sunlit tops & flat misty base."""
    puffs = [
        (-18, 2, 13, 5),
        (-7, -2, 15, 7),
        (8, -1, 14, 6),
        (19, 3, 12, 4),
        (-26, 4, 9, 3),
        (27, 4, 10, 3),
    ]
    base_y = cy + int(5 * scale)
    for y in range(max(0, cy - int(12 * scale)), min(H_PX, base_y + 3)):
        for x in range(max(0, cx - int(40 * scale)), min(W, cx + int(40 * scale))):
            best = 9.9
            best_top = cy
            for ox, oy, rx, ry in puffs:
                if flip:
                    ox = -ox
                px_c = cx + ox * scale
                py_c = cy + oy * scale
                rrx = rx * scale
                rry = ry * scale
                d = ((x - px_c) / rrx) ** 2 + ((y - py_c) / rry) ** 2
                if d < best:
                    best = d
                    best_top = py_c - rry
            if best <= 1.0 and y <= base_y:
                rel_y = (y - best_top) / max(1.0, (base_y - best_top))
                if rel_y < 0.34 and best < 0.84:
                    c = CLOUD_RAMP[3]
                elif rel_y < 0.64:
                    c = CLOUD_RAMP[2]
                elif rel_y < 0.86:
                    c = CLOUD_RAMP[1]
                else:
                    c = CLOUD_RAMP[0]
                px[x, y] = (*c, 255)


def paint_sky_chasm(img: Image.Image) -> None:
    px = img.load()
    for y in range(H_PX):
        t = y / float(H_PX - 1)
        if t < 0.52:
            base = lerp_rgb(SKY_TOP, SKY_MID, t / 0.52)
        else:
            base = lerp_rgb(SKY_MID, SKY_BOT, (t - 0.52) / 0.48)
        if y > 286:
            mist_t = ((y - 286) / 82.0) ** 1.45 * 0.44
            base = lerp_rgb(base, SKY_MIST, mist_t)
        for x in range(W):
            n = (vnoise(x, y, 34.0, 13) - 0.5) * 0.07
            c = mul_rgb(base, 1.0 + n)
            px[x, y] = (*c, 255)

    # Sculpted multi-puff drifting clouds far below in the sky chasm
    paint_wispy_cloud(px, 44, 20, 0.95, flip=False)
    paint_wispy_cloud(px, 434, 18, 0.92, flip=True)
    paint_wispy_cloud(px, 56, 350, 1.05, flip=False)
    paint_wispy_cloud(px, 152, 357, 0.72, flip=True)
    paint_wispy_cloud(px, 314, 354, 0.82, flip=False)
    paint_wispy_cloud(px, 446, 350, 0.88, flip=True)

    # Craggy asymmetric floating ruin rock islets with trailing vines (not triangles!)
    islets = [(18, 44, 16, 11, 1), (460, 42, 14, 10, 2)]
    for ix, iy, iw, ih, sd in islets:
        for dy in range(-2, ih + 4):
            for dx in range(-iw // 2 - 2, iw // 2 + 3):
                xx, yy = ix + dx, iy + dy
                if not (0 <= xx < W and 0 <= yy < H_PX):
                    continue
                # Asymmetric lumpy boulder silhouette
                rx_l = (iw * 0.52) * (1.0 - 0.55 * max(0.0, dy / float(ih)) ** 1.5)
                wob = (vnoise(xx, yy, 3.2, 70 + sd) - 0.5) * 3.0
                if dy >= 0 and abs(dx - (1.2 if dy > 4 else 0.0)) <= rx_l + wob:
                    if dy <= 2:
                        c = GRASS_RAMP[4 if dx < 0 else 2]
                    elif dy <= 5:
                        c = CLIFF_HIGH if dx < 1 else CLIFF_MID
                    else:
                        c = CLIFF_MID if dx < 0 else CLIFF_SHADE
                    px[xx, yy] = (*c, 255)
                # Tiny ruin masonry block perched on NW islet
                if sd == 1 and -2 <= dy <= 0 and -3 <= dx <= 2:
                    px[xx, yy] = (*(STONE_RIM if dy == -2 else STONE_MID), 255)
                # Hanging vine tendril underneath
                if dx in (-2, 2) and ih - 1 <= dy <= ih + (2 if dx == -2 else 0):
                    px[xx, yy] = (*GRASS_RAMP[1], 255)


def grass_color_world(x: int, y: int) -> tuple[int, int, int]:
    f = fbm(x, y, 41)
    micro = h2(x // 2, y // 2, 43)
    v = f * 0.78 + micro * 0.22
    if v < 0.29:
        idx = 1
    elif v < 0.46:
        idx = 2
    elif v < 0.68:
        idx = 3
    elif v < 0.84:
        idx = 4
    else:
        idx = 5

    tuft = h2(x, y, 47)
    if tuft < 0.022 and idx < 5:
        idx += 1
    elif tuft > 0.980 and idx > 1:
        idx -= 1
    return GRASS_RAMP[idx]


def ashlar_floor_color(x: int, y: int, upper_sanctum: bool = False) -> tuple[int, int, int] | None:
    ci, si, lx, ly, sw, sh, cx, cy = slab_cell_at(x, y)
    ramp = SANCTUM_SLABS if upper_sanctum else FLOOR_SLABS

    if not upper_sanctum:
        s = pave_strength(cx, cy)
        slab_rnd = h2(ci, si, 307)
        if s < 0.34:
            return None
        if s < 0.66:
            keep_prob = (s - 0.34) / 0.32
            if slab_rnd > keep_prob * 0.94:
                return None
        moss_affinity = max(0.0, 0.74 - s) * 1.55 + (0.24 if fbm(x, y, 311) > 0.63 else 0.0)
    else:
        moss_affinity = 0.16 if fbm(x, y, 313) > 0.68 else 0.04

    is_corner = (lx in (0, sw - 1)) and (ly in (0, sh - 1))
    is_joint = (lx == sw - 1) or (ly == sh - 1) or (is_corner and h2(ci, si, 317) < 0.65)

    if is_joint:
        if h2(x // 2, y // 2, 331) < moss_affinity:
            return FLOOR_MOSS_L if h2(x, y, 337) < 0.35 else FLOOR_MOSS_J
        return FLOOR_MORTAR

    if (lx == 0 or ly == 0 or lx == sw - 2 or ly == sh - 2) and h2(x, y, 347) < moss_affinity * 0.30:
        return FLOOR_MOSS_L

    tone_idx = [0, 1, 1, 2, 2, 3][int(h2(ci, si, 353) * 6) % 6]

    if ly == 0 and 1 <= lx <= sw - 4 and h2(ci, si, 359) < 0.62:
        tone_idx = min(4, tone_idx + 1)
    elif lx == 0 and 1 <= ly <= sh - 4 and h2(ci, si, 367) < 0.42:
        tone_idx = min(4, tone_idx + 1)

    if h2(ci, si, 373) < 0.16:
        crack_x = int(sw * 0.45) + (ly // 3)
        if lx == crack_x and 2 <= ly <= sh - 3:
            return ramp[0]

    if upper_sanctum:
        dist_altar = math.hypot(x - AXIS_X, (y - 78.0) * 1.18)
        if 20.5 <= dist_altar <= 23.0 or 12.0 <= dist_altar <= 13.5:
            glow = 0.5 + 0.5 * math.sin(math.atan2(y - 78.0, x - AXIS_X) * 8.0)
            return lerp_rgb(RUNE_INLAY_DARK, RUNE_INLAY_LIT, 0.45 + 0.45 * glow)
    else:
        dist_fnt = math.hypot(x - AXIS_X, (y - 192.0) * 1.12)
        if 23.0 <= dist_fnt <= 25.5:
            return FLOOR_SLABS[4] if (x + y) % 3 else FLOOR_SLABS[3]
        elif 25.5 < dist_fnt <= 27.0:
            return FLOOR_MORTAR

    return ramp[tone_idx]


# World-Y horizontal stone courses for walls so stepped bastions have TRUE level masonry!
WALL_Y_COURSES: list[tuple[int, int, int]] = []
_wy = 0
_wi = 0
for _ in range(80):
    wh = [6, 7, 6, 8, 7, 6][_wi % 6]
    for _ly in range(wh):
        WALL_Y_COURSES.append((_wi, _ly, wh))
    _wy += wh
    _wi += 1


def stepped_wall_color(
    x: int,
    y: int,
    top_y: int,
    bot_y: int,
    is_step_corner: bool = False,
    seed: int = 501,
) -> tuple[int, int, int]:
    """
    Renders stepped octagonal bastion walls with LEVEL world-Y stone courses,
    3px crenellated lit parapet coping, vertical corner quoins at every setback,
    lower-half darkening, and hanging ivy/moss curtains!
    """
    fy = y - top_y
    total_h = max(6, bot_y - top_y)

    crenel_period = 14
    in_notch = ((x + 4) % crenel_period in (0, 1, 2)) and (abs(x - AXIS_X) > 34) and not is_step_corner
    if fy == 0:
        return STONE_OUT
    if fy == 1:
        return STONE_L1 if in_notch else STONE_GLINT
    if fy == 2:
        return STONE_MID if in_notch else STONE_RIM
    if fy == 3:
        return STONE_D1

    if fy >= total_h - 2:
        return STONE_OUT if fy == total_h - 1 else STONE_D2

    # Vertical corner quoin stone column at every octagonal bastion step!
    if is_step_corner:
        wr, wly, wh = WALL_Y_COURSES[y]
        if wly == wh - 1:
            c = STONE_D2
        else:
            c = STONE_RIM if wly == 0 else STONE_L2
        if fy >= total_h // 2:
            c = mul_rgb(c, 0.88)
        return c

    # Hanging ivy / moss curtains draped from the parapet
    ivy_patch = vnoise(x, top_y, 9.0, seed + 11)
    ivy_len = int(max(0.0, ivy_patch - 0.50) * 42.0 + 2.5 * math.sin(x * 0.65))
    if 3 <= fy <= 3 + ivy_len and abs(x - AXIS_X) > 28:
        if fy == 3 + ivy_len:
            return GRASS_RAMP[0]
        v_ivy = h2(x, y, seed + 23)
        return GRASS_RAMP[4 if v_ivy < 0.26 else (2 if v_ivy < 0.68 else 1)]

    # Level world-Y ashlar courses
    wr, wly, wh = WALL_Y_COURSES[y]
    block_w = [18, 22, 16, 24, 19][wr % 5]
    off = int(h2(wr, 9, seed) * 31)
    lx = (x + off) % block_w
    bid = (x + off) // block_w

    if wly == wh - 1 or lx == block_w - 1:
        c = STONE_D2
    else:
        base_pick = h2(bid, wr, seed + 31)
        c = STONE_MID if base_pick < 0.28 else (STONE_L1 if base_pick < 0.74 else STONE_L2)
        if wly == 0 and lx < block_w - 2:
            c = lerp_rgb(c, STONE_RIM, 0.42)
        elif lx == 0 and wly < wh - 2:
            c = lerp_rgb(c, STONE_RIM, 0.25)

    if fy >= total_h - 6 and h2(x // 2, y // 2, seed + 41) < 0.26:
        c = GRASS_RAMP[1 if fy >= total_h - 4 else 2]

    if fy >= total_h // 2:
        darken = 0.88 - 0.10 * ((fy - total_h // 2) / float(max(1, total_h // 2)))
        c = mul_rgb(c, darken)
    return c


# ---------------------------------------------------------------------------
# Build Complete Terrain, Cliffs, Stepped Bastions, Waterfalls, Stream & Bridge
# ---------------------------------------------------------------------------
def paint_island_and_architecture(img: Image.Image) -> None:
    px = img.load()
    top_mask = [[in_island_top(x, y) for y in range(H_PX)] for x in range(W)]

    # 1. Sculpted Jagged Sky-Island Cliffs + Arched Causeway Stone Piers
    for x in range(W):
        if in_causeway(x, 330):
            # Sculpt stone arch side-faces flanking the sky-causeway!
            continue
        ys_col = [y for y in range(H_PX) if top_mask[x][y]]
        if not ys_col:
            continue
        y_bot = ys_col[-1]
        y_top_first = ys_col[0]
        span = y_bot - y_top_first
        if span < 6:
            continue

        taper = min(1.0, span / 48.0)
        cliff_depth = int(
            taper
            * (
                37.0
                + 9.0 * math.sin(x * 0.052 + 0.4)
                + 6.0 * math.cos(x * 0.14)
                + (vnoise(x, y_bot, 4.5, 601) - 0.5) * 11.0
            )
        )
        for dy in range(1, cliff_depth + 1):
            yy = y_bot + dy
            if yy >= H_PX or top_mask[x][yy]:
                continue
            vine_len = 2 + int(max(0.0, vnoise(x, y_bot, 5.5, 607) - 0.42) * 16.0)
            if dy <= vine_len:
                c = GRASS_RAMP[0 if dy == vine_len else (3 if dy <= 2 else 1)]
                px[x, yy] = (*c, 255)
                continue

            strata = vnoise(x * 0.6, yy * 1.4, 6.0, 613)
            fissure = abs(math.sin(x * 0.29 + vnoise(x, yy, 9.0, 617) * 2.8)) < 0.11
            depth_t = dy / float(max(1, cliff_depth))

            if dy == cliff_depth:
                c = CLIFF_DARK
            elif fissure:
                c = CLIFF_DARK if depth_t > 0.4 else CLIFF_SHADE
            elif strata > 0.64 and depth_t < 0.65:
                c = CLIFF_HIGH if x % 24 < 14 else CLIFF_LIT
            elif strata > 0.42:
                c = CLIFF_LIT if depth_t < 0.45 else CLIFF_MID
            else:
                c = CLIFF_MID if depth_t < 0.55 else CLIFF_SHADE

            if depth_t > 0.72:
                mist_amt = ((depth_t - 0.72) / 0.28) * 0.45
                c = lerp_rgb(c, SKY_MIST, mist_amt)
            px[x, yy] = (*c, 255)

    # Sculpt Causeway Bridge Side Buttresses & Shadowed Under-Arches (x=196..204 and x=260..268, y=318..367)
    for y in range(316, H_PX):
        for side_sign in (-1, 1):
            for w_off in range(29, 36):
                xx = AXIS_X + side_sign * w_off
                if 0 <= xx < W and not top_mask[xx][y]:
                    arch_cut = ((y - 324) % 24)
                    if w_off >= 33 and 6 <= arch_cut <= 18:
                        continue  # Arched vault opening showing chasm sky!
                    c = CLIFF_DARK if w_off == 35 else (CLIFF_SHADE if side_sign > 0 else CLIFF_MID)
                    if arch_cut in (5, 19) and w_off >= 32:
                        c = STONE_D1
                    px[xx, y] = (*c, 255)

    # 2. Island Top Surface (Meadow Turf + Stepped Octagonal Bastions + Frayed Courtyard)
    for x in range(W):
        bf_lip = bastion_front_lip(x)
        bf_prev = bastion_front_lip(x - 1)
        bf_next = bastion_front_lip(x + 1)
        is_front_step_edge = (
            (bf_lip is not None)
            and ((bf_prev != bf_lip) or (bf_next != bf_lip))
        )
        bw_h = bastion_wall_height(x)

        rc_top = rear_crown_step_top(x)
        rc_prev = rear_crown_step_top(x - 1)
        rc_next = rear_crown_step_top(x + 1)
        is_rear_step_edge = (rc_top is not None) and ((rc_prev != rc_top) or (rc_next != rc_top))
        rear_bot = (rc_top + 16) if rc_top is not None else None

        for y in range(H_PX):
            if not top_mask[x][y]:
                continue

            # Causeway Parapet Walls (crenellated stone bridge rails with mossy chinks)
            if y >= 310 and in_causeway(x, y) and abs(x - AXIS_X) > 24:
                dist_c = abs(x - AXIS_X)
                notch = (y % 14 in (0, 1, 2))
                if dist_c >= 28.0:
                    c = STONE_OUT
                elif dist_c >= 26.2:
                    c = STONE_MID if notch else STONE_RIM
                else:
                    c = FLOOR_MOSS_J if h2(x, y, 641) < 0.18 else (STONE_D1 if y % 7 == 0 else STONE_L1)
                px[x, y] = (*c, 255)
                continue

            # North Stepped Octagonal Crown Parapet Wall
            if rc_top is not None and rear_bot is not None and y <= rear_bot:
                if y == rear_bot and is_rear_step_edge:
                    c = STONE_OUT
                else:
                    c = stepped_wall_color(x, y, rc_top, rear_bot + 1, is_step_corner=is_rear_step_edge, seed=521)
                px[x, y] = (*c, 255)
                continue

            # Stepped Octagonal Bastion Retaining Wall vs Grand Stairs vs Upper Terrace
            if bf_lip is not None:
                if in_grand_stairs(x, y):
                    if x < 213 or x >= 251:
                        is_edge = x in (208, 255)
                        is_inner = x in (212, 251)
                        if is_edge or is_inner:
                            c = STONE_OUT if is_edge else STONE_D1
                        else:
                            step_cap = (y - 100) // 10
                            c = STONE_GLINT if (y - 100) % 10 in (0, 1) else (STONE_RIM if x in (209, 252) else STONE_L2)
                            if step_cap > 3:
                                c = STONE_L1
                        px[x, y] = (*c, 255)
                    else:
                        sy = (y - 100) % 4
                        joint_x = ((x + ((y - 100) // 4) * 9) % 16 == 0)
                        moss_edge = (x < 216 or x > 248) and h2(x, y, 701) < 0.30
                        if moss_edge:
                            c = FLOOR_MOSS_L if sy < 2 else FLOOR_MOSS_J
                        elif sy == 0:
                            c = STONE_RIM if not joint_x else STONE_MID
                        elif sy == 1:
                            c = STONE_L2 if not joint_x else STONE_D1
                        elif sy == 2:
                            c = STONE_MID
                        else:
                            c = STONE_D2
                        px[x, y] = (*c, 255)
                    continue

                if y < bf_lip:
                    adx = abs(x - AXIS_X)
                    if adx <= 94 or (adx <= 122 and h2(x // 6, y // 6, 709) < (122 - adx) / 28.0):
                        sc = ashlar_floor_color(x, y, upper_sanctum=True)
                        c = sc if sc is not None else grass_color_world(x, y)
                    else:
                        c = grass_color_world(x, y)
                    if rear_bot is not None and y < rear_bot + 5:
                        c = mul_rgb(c, 0.68 + 0.065 * (y - rear_bot))
                    # East-side setback shadow on upper terrace next to jutting center apse
                    if bf_prev is not None and bf_prev > bf_lip and y >= bf_lip - 6:
                        c = mul_rgb(c, 0.84)
                    px[x, y] = (*c, 255)
                    continue

                if bf_lip <= y < bf_lip + bw_h:
                    c = stepped_wall_color(
                        x, y, bf_lip, bf_lip + bw_h, is_step_corner=is_front_step_edge, seed=501
                    )
                    # Subtle cast shadow just to the east of each forward-jutting bastion step!
                    for look_w in range(1, 6):
                        lp = bastion_front_lip(x - look_w)
                        if lp is not None and lp > bf_lip and y < lp + bw_h:
                            c = mul_rgb(c, 0.76 + 0.04 * look_w)
                            break
                    px[x, y] = (*c, 255)
                    continue

            # Lower Island Surface: Meadow Turf + Explorer Camp Earth + Frayed Ashlar Courtyard
            c = grass_color_world(x, y)

            # Soft worn camp clearing earth under Creekside Explorer Camp
            d_camp = math.hypot((x - 394.0) / 34.0, (y - 196.0) / 26.0)
            if d_camp < 1.05:
                earth_n = fbm(x, y, 719)
                if d_camp < 0.72 + 0.22 * earth_n:
                    earth_tones = [hex_rgb("#6e5c42"), hex_rgb("#7d694c"), hex_rgb("#8b7657")]
                    c = earth_tones[min(2, int(earth_n * 3))]

            # Frayed World-Coord Ashlar Courtyard & Winding Ruin Trails
            sc = ashlar_floor_color(x, y, upper_sanctum=False)
            if sc is not None:
                c = sc

            # Sparse wildflower clusters in sunlit meadow
            if sc is None and d_camp >= 1.0:
                fl_r = h2(x, y, 727)
                if fl_r < 0.0024 and fbm(x, y, 41) > 0.54:
                    c = [hex_rgb("#f4b8c8"), hex_rgb("#fae482"), hex_rgb("#d9f2ff")][int(h2(x, y, 733) * 3) % 3]

            # 6px Cast Cliff Shadow under Stepped Octagonal Bastion Wall!
            if bf_lip is not None and (bf_lip + bw_h) <= y < (bf_lip + bw_h + 6):
                dy_s = y - (bf_lip + bw_h)
                c = mul_rgb(c, 0.58 + 0.07 * dy_s)

            # Rim bevel along outer sky-cliff edges
            if not top_mask[max(0, x - 1)][y] or not top_mask[x][max(0, y - 1)]:
                c = lerp_rgb(c, GRASS_RAMP[5], 0.32)
            elif not top_mask[min(W - 1, x + 1)][y] or (y + 1 < H_PX and not top_mask[x][y + 1]):
                c = mul_rgb(c, 0.82)

            px[x, y] = (*c, 255)

    # 3. Clean Stepped Ancient Ruin Nook Wall in West Oak Woods
    paint_western_ruin_alcove(img)

    # 4. Winding Sanctuary Stream, Serene Water Shimmer, Dual Waterfalls & Plank Bridge
    paint_stream_and_waterfalls(img)
    paint_plank_bridge(img)


def paint_western_ruin_alcove(img: Image.Image) -> None:
    """
    Crisp stepped L-shaped crumbling sanctuary ruin alcove around (84, 160):
    - Stepped north masonry wall (x=70..108, y=140..154) with a stepped notch & moss
    - Short west wing return wall (x=70..76, y=146..172) with lit top coping
    """
    px = img.load()
    # North stepped ruin wall: center bay higher (top=139), right bay broken lower (top=143)
    for x in range(70, 108):
        if x < 92:
            top_y = 139
        elif x < 101:
            top_y = 142
        else:
            top_y = 145
        bot_y = 154
        is_corner = x in (70, 92, 101, 107)
        for y in range(top_y, bot_y + 1):
            c = stepped_wall_color(x, y, top_y, bot_y + 1, is_step_corner=is_corner, seed=811)
            px[x, y] = (*c, 255)
        for sy in range(1, 5):
            orig = px[x, bot_y + sy][:3]
            px[x, bot_y + sy] = (*mul_rgb(orig, 0.64 + 0.08 * sy), 255)

    # West short return parapet stub (x=70..75, y=150..172) + 4px east cast shadow
    for y in range(150, 173):
        for x in range(70, 76):
            if x in (70, 75) or y in (150, 172):
                c = STONE_OUT if (x == 70 or y == 172) else STONE_D1
            elif y <= 152:
                c = STONE_GLINT if x == 71 else STONE_RIM
            else:
                c = FLOOR_MOSS_L if (y > 164 and h2(x, y, 821) < 0.35) else (STONE_L2 if x <= 72 else STONE_MID)
            px[x, y] = (*c, 255)
        for sx in range(76, 80):
            orig = px[sx, y][:3]
            px[sx, y] = (*mul_rgb(orig, 0.72 + 0.07 * (sx - 76)), 255)


def paint_stream_and_waterfalls(img: Image.Image) -> None:
    px = img.load()

    # A. Serene Winding Sanctuary Stream + Plunge Pool (NO diagonal zebra stripes!)
    for y in range(46, 316):
        if 75 <= y < 106:
            continue
        cx, hw = stream_center_and_width(y)
        for x in range(max(20, int(cx - hw - 8)), min(W - 12, int(cx + hw + 9))):
            if not in_island_top(x, y):
                continue
            eff_hw = hw
            if y < 56:
                eff_hw *= max(0.0, (y - 46.0) / 10.0) ** 0.7
            if eff_hw < 2.0:
                continue

            wobble = (vnoise(x, y, 7.0, 901) - 0.5) * 4.0 + 1.3 * math.sin(y * 0.17 + x * 0.09)
            d = abs(x - cx) + wobble

            if d <= eff_hw:
                depth = eff_hw - d
                if depth < 2.2:
                    c = WATER_SHALLOW
                    # Broken cyan shoreline foam crescents only right at rocky bank edge
                    if vnoise(x, y, 4.5, 907) > 0.66:
                        c = WATER_FOAM1
                elif depth < 6.2:
                    c = WATER_MID
                elif depth < 11.2:
                    c = WATER_DEEP
                else:
                    c = WATER_ABYSS

                # Sparse horizontal 3..5px water glints (like sanctuary_fountain_round!)
                glint_seed = h2(x // 4, y // 3, 913)
                if (y % 3 == 0) and glint_seed < 0.085 and depth > 2.5:
                    lx_g = x % 4
                    if lx_g in (1, 2, 3):
                        c = WATER_FOAM2 if glint_seed < 0.03 else WATER_FOAM1

                # Rounded concentric plunge-pool foam rings around (364, 118)
                dp = math.hypot(x - 365.0, (y - 117.0) * 1.22)
                if dp < 23.0:
                    if dp < 9.5 + 2.0 * math.sin(x * 0.5):
                        c = WATER_WHITE if h2(x, y, 919) < 0.72 else WATER_FOAM2
                    elif 13.0 <= dp <= 15.0 and math.cos((x - 365) * 0.25) > -0.3:
                        c = WATER_FOAM2
                    elif 18.5 <= dp <= 20.2 and h2(x // 2, y, 923) < 0.65:
                        c = WATER_FOAM1

                px[x, y] = (*c, 255)

            elif d <= eff_hw + 4.2:
                bn = h2(x // 2, y // 2, 929)
                if d <= eff_hw + 1.6:
                    c = STONE_D2 if bn < 0.45 else hex_rgb("#2f4733")
                else:
                    c = GRASS_RAMP[1] if bn < 0.38 else ((STONE_MID if h2(x, y, 937) < 0.5 else FLOOR_MOSS_L) if bn < 0.68 else GRASS_RAMP[2])
                px[x, y] = (*c, 255)

    # Lotus lily pads in calm eddies
    lily_pads = [(346, 136, 4), (378, 142, 4), (341, 148, 3), (353, 260, 4), (386, 264, 3)]
    for lx, ly, lr in lily_pads:
        for dy in range(-lr, lr + 1):
            for dx in range(-lr - 1, lr + 2):
                if dx * dx + (dy * 1.3) ** 2 <= lr * lr + 1:
                    if dx > 0 and dy == 0:
                        continue
                    c = hex_rgb("#396626") if (dx + dy > 1) else hex_rgb("#639c42")
                    px[lx + dx, ly + dy] = (*c, 255)
        if lr >= 4:
            px[lx, ly - 1] = (*hex_rgb("#f7b2c4"), 255)
            px[lx - 1, ly] = (*hex_rgb("#e07996"), 255)

    # Mossy Stepping Stones at y ~ 275
    for sx, sy, rx, ry in STEPPING_STONES:
        for y in range(int(sy - ry - 2), int(sy + ry + 3)):
            for x in range(int(sx - rx - 2), int(sx + rx + 3)):
                d = ((x - sx) / rx) ** 2 + ((y - sy) / ry) ** 2
                if d <= 1.0:
                    if d > 0.74:
                        c = STONE_D2 if y > sy else STONE_L2
                    else:
                        c = STONE_RIM if (y < sy and x < sx + 2) else STONE_L1
                        if h2(x, y, 941) < 0.16:
                            c = FLOOR_MOSS_L
                    px[x, y] = (*c, 255)
                elif d <= 1.30 and y >= sy and h2(x, y, 947) < 0.40:
                    px[x, y] = (*WATER_FOAM1, 255)

    # B. Waterfall #1: Organic Rock-Framed 2-Tier NE Sanctuary Cliff Cascade (y=72..118)
    for y in range(72, 119):
        is_ledge = 89 <= y <= 93
        # Organic curved chute width (wider at splash bottom, slightly curved along cliff)
        t_wf = (y - 72) / 46.0
        cx = 367.5 - 1.8 * (t_wf ** 1.5) + 0.8 * math.sin(y * 0.22)
        hw = 8.8 + 3.2 * (t_wf ** 1.2) + 1.0 * math.sin(y * 0.35)

        for x in range(int(cx - hw - 6), int(cx + hw + 7)):
            dx = abs(x - cx)
            # Curved semicircular splash apron at bottom y=111..118!
            bot_curve = 113.5 + 4.2 * math.cos(min(1.0, dx / max(1.0, hw)) * math.pi * 0.5)
            if y > bot_curve:
                continue

            if dx <= hw:
                if is_ledge:
                    # Sculpted mossy boulder divider splitting chute into twin white-water streams!
                    if abs(x - cx) < 2.8:
                        c = FLOOR_MOSS_L if y <= 90 else (STONE_L1 if y == 91 else STONE_D2)
                    else:
                        c = WATER_WHITE if y in (89, 93) else WATER_FOAM2
                else:
                    streak = math.sin((x - cx) * 0.92 + h2(x, y // 4, 953) * 1.8)
                    top_lip = 73.5 + 1.8 * math.cos(min(1.0, dx / max(1.0, hw)) * math.pi * 0.5)
                    if y < top_lip:
                        continue
                    if y <= top_lip + 2.0 or y >= bot_curve - 3.0 or y in (94, 95):
                        c = WATER_WHITE
                    elif streak > 0.30:
                        c = WATER_WHITE if (y + x) % 4 != 0 else WATER_FOAM2
                    elif streak > -0.25:
                        c = WATER_FOAM1
                    else:
                        c = WATER_SHALLOW
                px[x, y] = (*c, 255)
            elif dx <= hw + 4.2 and y < 111:
                # Jagged wet mossy boulder cheeks framing the waterfall!
                rock_wob = vnoise(x, y, 3.5, 961)
                if dx <= hw + 1.8 + 2.4 * rock_wob:
                    if rock_wob > 0.62:
                        c = GRASS_RAMP[2 if y % 3 else 1]
                    elif dx < hw + 2.2:
                        c = STONE_OUT
                    else:
                        c = STONE_MID if x < cx else CLIFF_SHADE
                    px[x, y] = (*c, 255)

    # C. Waterfall #2: SE Sky-Chasm Plunge with Curved Lip & Billowing Mist! (y=302..367)
    for y in range(302, H_PX):
        t = (y - 302) / float(H_PX - 302)
        cx = 390.5 + 2.2 * math.sin((y - 302) * 0.07)
        hw = 10.5 - 1.6 * math.sin(t * math.pi * 0.65) + 4.2 * (t ** 2)
        for x in range(int(cx - hw - 8), int(cx + hw + 9)):
            if not (0 <= x < W):
                continue
            dx = abs(x - cx)
            top_lip = 303.0 + 2.5 * (dx / max(1.0, hw)) ** 2
            if y < top_lip:
                continue
            if dx <= hw:
                streak = math.sin((x - cx) * 0.85 + h2(x, y // 4, 971) * 2.2)
                if y <= top_lip + 2.5:
                    c = WATER_WHITE
                elif streak > 0.30:
                    c = WATER_WHITE
                elif streak > -0.25:
                    c = WATER_FOAM2 if t < 0.65 else WATER_FOAM1
                else:
                    c = WATER_FOAM1 if t < 0.38 else WATER_SHALLOW

                if t > 0.66:
                    mist_f = ((t - 0.66) / 0.34) ** 1.2 * 0.80
                    if dx > hw * (1.06 - 0.42 * mist_f) and h2(x, y, 977) > 0.58:
                        continue
                    c = lerp_rgb(c, CLOUD_RAMP[3], mist_f * 0.70)
                px[x, y] = (*c, 255)
            elif y < 316 and dx <= hw + 3.2:
                # Wet mossy rock lip framing top of SE waterfall
                px[x, y] = (*(STONE_D2 if dx < hw + 1.6 else GRASS_RAMP[1]), 255)
            elif t > 0.70 and dx <= hw + 9.0:
                if vnoise(x, y, 3.5, 983) > 0.46 + 0.45 * ((dx - hw) / 9.0):
                    px[x, y] = (*CLOUD_RAMP[3 if y > 356 else 2], 255)


def paint_plank_bridge(img: Image.Image) -> None:
    px = img.load()
    cx, hw = stream_center_and_width(213.0)
    x0 = int(round(cx - hw - 9))
    x1 = int(round(cx + hw + 9))

    for y in range(224, 229):
        for x in range(x0 + 3, x1 - 2):
            orig = px[x, y][:3]
            px[x, y] = (*mul_rgb(orig, 0.66 + 0.06 * (y - 224)), 255)

    for bx0, bx1 in [(x0 - 3, x0 + 2), (x1 - 2, x1 + 3)]:
        for y in range(202, 225):
            for x in range(bx0, bx1 + 1):
                c = STONE_OUT if (x in (bx0, bx1) or y in (202, 224)) else (STONE_RIM if y <= 204 else STONE_L1)
                px[x, y] = (*c, 255)

    for x in range(x0, x1 + 1):
        arch_lift = int(round(2.2 * math.sin(math.pi * (x - x0) / float(max(1, x1 - x0)))))
        top_y = 204 - arch_lift
        bot_y = 222 - arch_lift
        plank_i = (x - x0) // 4
        lx = (x - x0) % 4

        for y in range(top_y, bot_y + 1):
            if y == top_y:
                c = WOOD_RAMP[6] if (x + y) % 2 == 0 else WOOD_RAMP[4]
            elif y == top_y + 1:
                c = WOOD_RAMP[1]
            elif y == bot_y - 2:
                c = WOOD_RAMP[6] if (x + y) % 2 == 0 else WOOD_RAMP[5]
            elif y == bot_y - 1:
                c = WOOD_RAMP[3] if lx != 3 else WOOD_RAMP[1]
            elif y == bot_y:
                c = WOOD_RAMP[0]
            else:
                if lx == 3:
                    c = WOOD_RAMP[1]
                else:
                    tone = 4 if h2(plank_i, 1, 1009) < 0.55 else 3
                    if lx == 0:
                        tone += 1
                    if y in (top_y + 2, bot_y - 3) and lx == 1:
                        c = STONE_D2
                    else:
                        c = WOOD_RAMP[tone]
            px[x, y] = (*c, 255)

    for px0 in [x0 + 1, x1 - 4]:
        for py0 in [199, 216]:
            for dy in range(8):
                for dx in range(4):
                    xx, yy = px0 + dx, py0 + dy
                    if dx in (0, 3) or dy in (0, 7):
                        c = WOOD_RAMP[0]
                    elif dy == 1:
                        c = WOOD_RAMP[6]
                    else:
                        c = WOOD_RAMP[4 if dx == 1 else 2]
                    px[xx, yy] = (*c, 255)


# ---------------------------------------------------------------------------
# Hand-Pixelled Sacred Offerings Composited ON TOP OF `stone_offering_table`
# ---------------------------------------------------------------------------
def build_offering_table_with_goods(base_table: Image.Image) -> Image.Image:
    out = base_table.copy().convert("RGBA")
    canvas = Image.new("RGBA", (32, 20), (0, 0, 0, 0))
    canvas.paste(out, (0, 4))
    px = canvas.load()

    def dot(x: int, y: int, hexc: str) -> None:
        if 0 <= x < 32 and 0 <= y < 20:
            px[x, y] = (*hex_rgb(hexc), 255)

    for gy in range(8, 14):
        for gx in range(16, 24):
            r, g, b, a = px[gx, gy]
            if a > 200:
                d = math.hypot(gx - 19.5, gy - 10.5)
                if d < 4.2:
                    t = (1.0 - d / 4.2) * 0.35
                    nc = lerp_rgb((r, g, b), hex_rgb("#8cf0ff"), t)
                    px[gx, gy] = (*nc, a)

    # 1. Wildflower Wreath (left)
    for dx, dy, col in [
        (5, 10, "#2d4619"), (6, 9, "#4b6827"), (7, 9, "#6e9943"), (8, 10, "#3d5e24"),
        (4, 11, "#3d5e24"), (5, 12, "#4b6827"), (6, 12, "#6e9943"), (7, 12, "#2d4619"), (8, 11, "#618c3b"),
        (5, 11, "#f59cb8"), (7, 10, "#ffe478"), (6, 11, "#ffffff"),
    ]:
        dot(dx, dy, col)

    # 2. Golden Chalice with ruby gem (center-left)
    for dx, dy, col in [
        (11, 4, "#452a17"), (12, 4, "#ffe97d"), (13, 4, "#f5bd33"), (14, 4, "#452a17"),
        (10, 5, "#452a17"), (11, 5, "#fff5b8"), (12, 5, "#e09f24"), (13, 5, "#b87914"), (14, 5, "#452a17"),
        (10, 6, "#452a17"), (11, 6, "#f5bd33"), (12, 6, "#d93848"), (13, 6, "#9e6310"), (14, 6, "#452a17"),
        (11, 7, "#452a17"), (12, 7, "#e09f24"), (13, 7, "#452a17"),
        (11, 8, "#452a17"), (12, 8, "#ffe97d"), (13, 8, "#452a17"),
        (10, 9, "#452a17"), (11, 9, "#ffe97d"), (12, 9, "#e09f24"), (13, 9, "#9e6310"), (14, 9, "#452a17"),
        (10, 10, "#262729"), (11, 10, "#452a17"), (12, 10, "#452a17"), (13, 10, "#452a17"), (14, 10, "#262729"),
    ]:
        dot(dx, dy + 1, col)

    # 3. Glowing Cyan Crystal Cluster (center-right)
    for dx, dy, col in [
        (19, 3, "#1a4640"), (20, 3, "#1a4640"),
        (18, 4, "#1a4640"), (19, 4, "#ebfcff"), (20, 4, "#7ce8f7"), (21, 4, "#1a4640"),
        (17, 5, "#1a4640"), (18, 5, "#ebfcff"), (19, 5, "#9cf0fc"), (20, 5, "#3bb4c9"), (21, 5, "#1a4640"),
        (16, 6, "#1a4640"), (17, 6, "#9cf0fc"), (18, 6, "#5cd4e6"), (19, 6, "#3bb4c9"), (20, 6, "#257d8f"), (21, 6, "#7ce8f7"), (22, 6, "#1a4640"),
        (16, 7, "#1a4640"), (17, 7, "#5cd4e6"), (18, 7, "#3bb4c9"), (19, 7, "#257d8f"), (20, 7, "#ebfcff"), (21, 7, "#3bb4c9"), (22, 7, "#1a4640"),
        (17, 8, "#1a4640"), (18, 8, "#257d8f"), (19, 8, "#1a4640"), (20, 8, "#257d8f"), (21, 8, "#1a4640"),
    ]:
        dot(dx, dy + 2, col)

    # 4. Ancient Tied Rune Scroll (right)
    for dx, dy, col in [
        (24, 9, "#452a17"), (25, 9, "#452a17"), (26, 9, "#452a17"), (27, 9, "#452a17"), (28, 9, "#452a17"),
        (23, 10, "#452a17"), (24, 10, "#f2e2be"), (25, 10, "#e6cfa1"), (26, 10, "#c83238"), (27, 10, "#e6cfa1"), (28, 10, "#caa974"), (29, 10, "#452a17"),
        (23, 11, "#452a17"), (24, 11, "#d8bc8a"), (25, 11, "#caa974"), (26, 11, "#961e24"), (27, 11, "#b5915b"), (28, 11, "#8c693a"), (29, 11, "#452a17"),
        (24, 12, "#262729"), (25, 12, "#262729"), (26, 12, "#c83238"), (27, 12, "#262729"), (28, 12, "#262729"),
    ]:
        dot(dx, dy, col)

    return canvas


def make_explorer_variant(char_1x: Image.Image) -> Image.Image:
    out = char_1x.copy().convert("RGBA")
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            if b > r + 14 and b > g:
                nr = min(255, int(r * 0.95 + 26))
                ng = min(255, int(b * 0.92 + 12))
                nb = min(255, int(g * 0.72))
                px[x, y] = (nr, ng, nb, a)
    return out


# ---------------------------------------------------------------------------
# Dappled Canopy Shadows, Warm Brazier Glows & Y-Sorted Vignette Assembly
# ---------------------------------------------------------------------------
def apply_canopy_shadow(img: Image.Image, cx: int, cy: int, rx: int, ry: int, factor: float = 0.77) -> None:
    px = img.load()
    for y in range(max(0, cy - ry), min(H_PX, cy + ry + 1)):
        for x in range(max(0, cx - rx), min(W, cx + rx + 1)):
            if not in_island_top(x, y):
                continue
            d = ((x - cx) / float(rx)) ** 2 + ((y - cy) / float(ry)) ** 2
            dapple = (vnoise(x, y, 4.0, 1103) - 0.5) * 0.30
            if d + dapple < 0.96:
                r, g, b, a = px[x, y]
                f = factor + 0.14 * max(0.0, d)
                px[x, y] = (int(r * f * 0.95), int(g * f * 1.01), int(b * f * 0.94), a)


def apply_warm_glow(img: Image.Image, cx: int, cy: int, radius: int, color_hex: str, strength: float = 0.28) -> None:
    px = img.load()
    gc = hex_rgb(color_hex)
    for y in range(max(0, cy - radius), min(H_PX, cy + radius + 1)):
        for x in range(max(0, cx - radius), min(W, cx + radius + 1)):
            if not in_island_top(x, y):
                continue
            d = math.hypot(x - cx, (y - cy) * 1.22)
            if d < radius:
                falloff = ((1.0 - d / radius) ** 1.8) * strength
                r, g, b, a = px[x, y]
                nc = lerp_rgb((r, g, b), gc, falloff)
                px[x, y] = (*nc, a)


def load_sprites() -> dict[str, Image.Image]:
    names = [
        "beodeul_oak_tree",
        "carved_rune_stele",
        "crystal_rune_altar",
        "explorer_camp_tent",
        "flowering_bush_moss",
        "iron_brazier_lit",
        "mossy_boulder",
        "mossy_stone_well",
        "ruin_shrine_gate",
        "sanctuary_fountain_round",
        "stone_garden_lantern",
        "stone_guardian_statue",
        "stone_offering_table",
        "stone_pillar_broken",
        "stone_pillar_intact",
        "temple_banner_pole",
        "treasure_chest_ancient",
        "wooden_bench_garden",
        "wooden_crates_supply",
        "wooden_notice_board",
    ]
    sprites = {n: Image.open(os.path.join(OBJ_DIR, f"{n}.png")).convert("RGBA") for n in names}
    assert len(sprites) == 20
    sprites["stone_offering_table_dressed"] = build_offering_table_with_goods(sprites["stone_offering_table"])
    char_4x = Image.open(CHAR_REF).convert("RGBA")
    char_1x = char_4x.resize((22, 25), Image.Resampling.NEAREST)
    sprites["char_knight"] = char_1x
    sprites["char_ranger"] = make_explorer_variant(char_1x)
    return sprites


def get_placements() -> list[tuple[str, int, int, list[tuple[int, int]]]]:
    return [
        # --- VIGNETTE 1: Upper Sanctum Apse (North Stepped Octagonal Bastion) ---
        ("ruin_shrine_gate", 208, 6, [(13, 2), (14, 2), (15, 2), (13, 3), (15, 3)]),
        ("stone_guardian_statue", 180, 22, [(11, 3)]),
        ("stone_guardian_statue", 268, 22, [(17, 3)]),
        ("temple_banner_pole", 150, 34, [(9, 4)]),
        ("temple_banner_pole", 298, 34, [(18, 4)]),
        ("crystal_rune_altar", 216, 60, [(13, 5), (14, 5)]),
        ("iron_brazier_lit", 184, 64, [(11, 5)]),
        ("iron_brazier_lit", 264, 64, [(16, 5)]),
        ("stone_garden_lantern", 192, 114, [(12, 8)]),
        ("stone_garden_lantern", 256, 114, [(16, 8)]),

        # --- VIGNETTE 2: Central Scalloped Fountain Courtyard (Curved Ruined Colonnade) ---
        ("sanctuary_fountain_round", 216, 176, [(13, 11), (14, 11), (13, 12), (14, 12)]),
        ("stone_pillar_intact", 168, 142, [(10, 10)]),
        ("stone_pillar_broken", 148, 168, [(9, 12)]),
        ("stone_pillar_intact", 282, 142, [(17, 10)]),
        ("stone_pillar_broken", 300, 168, [(18, 12)]),
        ("stone_pillar_broken", 164, 220, [(10, 15)]),
        ("carved_rune_stele", 168, 176, [(10, 12), (11, 12)]),
        ("stone_offering_table_dressed", 256, 186, [(16, 12), (17, 12)]),
        ("wooden_bench_garden", 252, 226, [(16, 14), (17, 14)]),
        ("stone_garden_lantern", 290, 210, [(18, 14)]),
        ("flowering_bush_moss", 286, 232, [(18, 15)]),
        ("flowering_bush_moss", 240, 240, [(15, 15)]),
        ("flowering_bush_moss", 148, 198, [(9, 13)]),
        ("mossy_boulder", 180, 238, [(11, 15)]),

        # --- VIGNETTE 3: Dense Overlapping West Ancient Oak Canopy & Hidden Ruin Nook ---
        # Tightly overlapping NW forest canopy cluster (8 staggered oaks!)
        ("beodeul_oak_tree", 68, 34, [(4, 4), (5, 4)]),
        ("beodeul_oak_tree", 42, 42, [(2, 5), (3, 5)]),
        ("beodeul_oak_tree", 86, 52, [(5, 5), (6, 5)]),
        ("beodeul_oak_tree", 56, 64, [(3, 6), (4, 6)]),
        ("beodeul_oak_tree", 28, 68, [(1, 6), (2, 6)]),
        ("beodeul_oak_tree", 44, 88, [(2, 8), (3, 8)]),
        ("beodeul_oak_tree", 20, 98, [(1, 8), (2, 8)]),
        ("beodeul_oak_tree", 36, 118, [(2, 9), (3, 9)]),
        # Hidden Stepped Ruin Nook with Ancient Treasure Chest!
        ("stone_pillar_broken", 108, 130, [(6, 9), (7, 9)]),
        ("treasure_chest_ancient", 82, 158, [(5, 10)]),
        ("flowering_bush_moss", 100, 156, [(6, 10)]),
        ("mossy_boulder", 64, 174, [(4, 11)]),
        # Overlapping SW woodland grove framing the winding mossy cobble trail (7 oaks!)
        ("beodeul_oak_tree", 24, 168, [(1, 13), (2, 13)]),
        ("beodeul_oak_tree", 46, 188, [(2, 14), (3, 14)]),
        ("beodeul_oak_tree", 24, 206, [(1, 15), (2, 15)]),
        ("beodeul_oak_tree", 50, 222, [(3, 16), (4, 16)]),
        ("beodeul_oak_tree", 30, 240, [(2, 17), (3, 17)]),
        ("beodeul_oak_tree", 68, 248, [(4, 18), (5, 18)]),
        ("beodeul_oak_tree", 102, 260, [(6, 18), (7, 18)]),
        ("beodeul_oak_tree", 138, 268, [(8, 19), (9, 19)]),
        ("flowering_bush_moss", 122, 232, [(7, 15)]),
        ("mossy_boulder", 116, 250, [(7, 16)]),

        # --- VIGNETTE 4: Creekside Explorer Camp & Waterfall Banks (East) ---
        ("beodeul_oak_tree", 406, 40, [(25, 5), (26, 5)]),
        ("beodeul_oak_tree", 428, 66, [(26, 6), (27, 6)]),
        ("beodeul_oak_tree", 418, 94, [(26, 8), (27, 8)]),
        ("mossy_boulder", 334, 116, [(20, 8)]),
        ("flowering_bush_moss", 390, 116, [(24, 8)]),
        ("mossy_boulder", 392, 134, [(24, 9)]),
        # Explorer Camp Clearing
        ("explorer_camp_tent", 384, 156, [(24, 10), (25, 10), (24, 11), (25, 11)]),
        ("iron_brazier_lit", 366, 166, [(23, 11)]),
        ("wooden_crates_supply", 418, 176, [(26, 11), (27, 11), (26, 12), (27, 12)]),
        ("wooden_notice_board", 356, 224, [(22, 15), (23, 15)]),
        ("mossy_stone_well", 404, 224, [(25, 15), (26, 15)]),
        ("flowering_bush_moss", 436, 214, [(27, 14)]),
        ("beodeul_oak_tree", 420, 252, [(26, 18), (27, 18)]),
        ("mossy_boulder", 336, 282, [(21, 18)]),
        ("flowering_bush_moss", 316, 274, [(19, 17)]),

        # --- South Causeway Entrance Braziers ---
        ("iron_brazier_lit", 190, 282, [(12, 19)]),
        ("iron_brazier_lit", 258, 282, [(16, 19)]),

        # --- Lively Beodeul Scale Characters (1x = 22x25, non-blocking!) ---
        ("char_knight", 221, 144, []),
        ("char_ranger", 392, 194, []),
    ]


def render_vignettes(img: Image.Image, sprites: dict[str, Image.Image], placements: list) -> None:
    for key, x, y, _ in placements:
        if key == "beodeul_oak_tree":
            apply_canopy_shadow(img, x + 17, y + 41, rx=19, ry=11, factor=0.76)
        elif key in ("ruin_shrine_gate", "explorer_camp_tent", "sanctuary_fountain_round"):
            sw, sh = sprites[key].size
            apply_canopy_shadow(img, x + sw // 2 + 2, y + sh - 2, rx=sw // 2 + 3, ry=5, factor=0.82)

    for key, x, y, _ in placements:
        if key == "iron_brazier_lit":
            apply_warm_glow(img, x + 8, y + 24, radius=28, color_hex="#ffae42", strength=0.30)
        elif key == "stone_garden_lantern":
            apply_warm_glow(img, x + 8, y + 22, radius=18, color_hex="#ffd27d", strength=0.20)
        elif key == "crystal_rune_altar":
            apply_warm_glow(img, x + 16, y + 24, radius=26, color_hex="#6cf0ff", strength=0.24)

    sorted_items = sorted(placements, key=lambda it: (it[2] + sprites[it[0]].size[1], it[1]))
    for key, x, y, _ in sorted_items:
        img.alpha_composite(sprites[key], (x, y))


# ---------------------------------------------------------------------------
# 16px Walk-Grid Construction & BFS Verification
# ---------------------------------------------------------------------------
def build_walk_grid_and_verify(placements: list) -> dict:
    walk = [[True for _ in range(GW)] for _ in range(GH)]
    reasons = [["" for _ in range(GW)] for _ in range(GH)]

    for gy in range(GH):
        for gx in range(GW):
            cx = gx * 16 + 8
            cy = gy * 16 + 8

            pts = [(cx, cy), (cx - 4, cy - 4), (cx + 4, cy - 4), (cx - 4, cy + 4), (cx + 4, cy + 4)]
            if not all(in_island_top(px_, py_) for px_, py_ in pts):
                walk[gy][gx] = False
                reasons[gy][gx] = "void"
                continue

            if cy >= 310 and abs(cx - AXIS_X) > 24:
                walk[gy][gx] = False
                reasons[gy][gx] = "parapet"
                continue

            rc = rear_crown_step_top(cx)
            if rc is not None and cy <= rc + 18:
                walk[gy][gx] = False
                reasons[gy][gx] = "rear_wall"
                continue

            bf = bastion_front_lip(cx)
            bw = bastion_wall_height(cx)
            if bf is not None and (bf - 2 <= cy <= bf + bw + 1):
                if not (13 <= gx <= 15 and 100 <= cy <= 140):
                    walk[gy][gx] = False
                    reasons[gy][gx] = "bastion_wall"
                    continue

            if (138 <= cy <= 155 and 70 <= cx <= 108) or (150 <= cy <= 173 and 70 <= cx <= 76):
                walk[gy][gx] = False
                reasons[gy][gx] = "alcove_wall"
                continue

            if 48 <= cy <= 316:
                scx, shw = stream_center_and_width(cy)
                if abs(cx - scx) <= shw + 1.5:
                    on_bridge = in_plank_bridge(cx, cy)
                    on_stone = (gy == 17 and 22 <= gx <= 24)
                    if not (on_bridge or on_stone):
                        walk[gy][gx] = False
                        reasons[gy][gx] = "water"
                        continue

    for key, _, _, cells in placements:
        for gx, gy in cells:
            if 0 <= gx < GW and 0 <= gy < GH:
                walk[gy][gx] = False
                reasons[gy][gx] = f"obj:{key}"

    start = (14, 22)
    assert walk[start[1]][start[0]], f"Start cell {start} blocked by {reasons[start[1]][start[0]]}!"

    visited = {start: None}
    q = deque([start])
    while q:
        ux, uy = q.popleft()
        for dx, dy in [(0, -1), (0, 1), (-1, 0), (1, 0)]:
            nx, ny = ux + dx, uy + dy
            if 0 <= nx < GW and 0 <= ny < GH and walk[ny][nx] and (nx, ny) not in visited:
                visited[(nx, ny)] = (ux, uy)
                q.append((nx, ny))

    targets = {
        "south_causeway_entry": (14, 22),
        "fountain_plaza_south": (14, 14),
        "carved_rune_stele_front": (11, 13),
        "offering_table_front": (16, 13),
        "garden_bench_spot": (16, 13),
        "west_oak_chest_nook": (5, 11),
        "stream_plank_bridge": (21, 13),
        "explorer_camp_clearing": (24, 12),
        "camp_notice_board": (23, 14),
        "camp_mossy_well": (25, 14),
        "grand_stairs_mid": (14, 7),
        "crystal_altar_front": (14, 6),
        "shrine_gate_threshold": (14, 3),
    }

    results = {}
    for name, cell in targets.items():
        ok = cell in visited
        dist = 0
        cur = cell
        while ok and cur is not None and cur != start:
            cur = visited[cur]
            dist += 1
        results[name] = {
            "cell": cell,
            "reachable": ok,
            "steps": dist if ok else -1,
            "reason_if_blocked": reasons[cell[1]][cell[0]],
        }

    total_walkable = sum(1 for gy in range(GH) for gx in range(GW) if walk[gy][gx])
    return {
        "all_pass": all(v["reachable"] for v in results.values()),
        "reachable_cells": len(visited),
        "total_walkable_cells": total_walkable,
        "targets": results,
    }


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    img = Image.new("RGBA", (W, H_PX), (0, 0, 0, 255))

    paint_sky_chasm(img)
    paint_island_and_architecture(img)

    sprites = load_sprites()
    placements = get_placements()
    render_vignettes(img, sprites, placements)

    bfs = build_walk_grid_and_verify(placements)

    out_1x = os.path.join(OUT_DIR, "map_sky_ruins_v2.png")
    out_2x = os.path.join(OUT_DIR, "map_sky_ruins_v2_2x.png")
    img.save(out_1x)
    img.resize((W * 2, H_PX * 2), Image.Resampling.NEAREST).save(out_2x)

    used_unique = {k.replace("_dressed", "") for k, _, _, _ in placements if not k.startswith("char_")}
    print(f"Saved 1x: {out_1x} ({img.size})")
    print(f"Saved 2x: {out_2x} ({W*2}x{H_PX*2})")
    print(f"Unique Carbon Medium sprites placed: {len(used_unique)}/20")
    print(f"Total placements (incl. characters): {len(placements)}")
    print(f"BFS Reachable Walk Cells: {bfs['reachable_cells']}/{bfs['total_walkable_cells']} | ALL PASS = {bfs['all_pass']}")
    for tname, info in bfs["targets"].items():
        status = "PASS" if info["reachable"] else f"FAIL ({info['reason_if_blocked']})"
        print(f"  - {tname:24s} cell={info['cell']} steps={info['steps']:2d} -> {status}")

    if not bfs["all_pass"] or len(used_unique) != 20:
        raise SystemExit("Verification failed!")


if __name__ == "__main__":
    main()
