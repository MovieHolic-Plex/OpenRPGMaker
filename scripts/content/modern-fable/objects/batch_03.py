#!/usr/bin/env python3
"""Batch O3 (20 modern objects): foliage-planters (10) & transit-vehicles (10).

Strictly locked to tiledata/jp-city/fable-city/palette.json (Fable 5.2 top-3/4 RPG baseline).
Outputs 20 RGBA PNGs + manifest.json into tiledata/modern-fable/objects/batch_03/.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.abspath(os.path.join(HERE, '..')))

from fable_lib import Canvas, col, hsh, OUT_ROOT

BATCH_ID = 'batch_03'
OUT_DIR = os.path.join(OUT_ROOT, 'objects', BATCH_ID)


# ---------------------------------------------------------------------------
# Shared top-3/4 Fable drawing helpers
# ---------------------------------------------------------------------------

def draw_ellipse(cv, cx, cy, rx, ry, c, fill=True):
    """Integer-centered ellipse (supports half-pixel centers)."""
    x0 = int(math.floor(cx - rx))
    x1 = int(math.ceil(cx + rx))
    y0 = int(math.floor(cy - ry))
    y1 = int(math.ceil(cy + ry))
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            dx = (x - cx) / max(rx, 0.5)
            dy = (y - cy) / max(ry, 0.5)
            d2 = dx * dx + dy * dy
            if fill:
                if d2 <= 1.0:
                    cv.p(x, y, c)
            else:
                if 0.72 <= d2 <= 1.05:
                    cv.p(x, y, c)


def draw_shadow_oval(cv, cx, cy, rx, ry):
    """Crisp Fable cast shadow on ground (warm-violet ink core + dithered rim)."""
    x0 = int(math.floor(cx - rx))
    x1 = int(math.ceil(cx + rx))
    y0 = int(math.floor(cy - ry))
    y1 = int(math.ceil(cy + ry))
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            dx = (x - cx) / max(rx, 0.5)
            dy = (y - cy) / max(ry, 0.5)
            d2 = dx * dx + dy * dy
            if d2 <= 0.72:
                cv.p(x, y, col('ink', 0))
            elif d2 <= 1.0:
                if (x + y) % 2 == 0 or d2 <= 0.85:
                    cv.p(x, y, col('ink', 1))


def draw_shadow_bar(cv, x0, y0, x1, y1):
    """Grounded rectangular cast shadow with soft tapered corners."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            corner = (x in (x0, x1 - 1)) and (y in (y0, y1 - 1))
            if corner:
                continue
            cv.p(x, y, col('ink', 0) if y < y1 - 1 else col('ink', 1))


def draw_line(cv, x0, y0, x1, y1, c):
    """Bresenham crisp pixel line."""
    dx = abs(x1 - x0)
    dy = abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx - dy
    x, y = x0, y0
    while True:
        cv.p(x, y, c)
        if x == x1 and y == y1:
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x += sx
        if e2 < dx:
            err += dx
            y += sy


def draw_leaf_canopy(cv, lobes, palette_map, seed=11, outline_col=None,
                     highlight_specks=None, shadow_specks=None):
    """Multi-lobe Fable organic tree canopy with crisp clustered leaf puffs.

    lobes: list of (cx, cy, rx, ry, light_bias)
    palette_map: dict with keys 'out', 'sh', 'mid0', 'mid1', 'hi0', 'hi1' (RGBA colors)
    """
    min_x = max(0, min(int(c[0] - c[2] - 2) for c in lobes))
    max_x = min(cv.w - 1, max(int(c[0] + c[2] + 2) for c in lobes))
    min_y = max(0, min(int(c[1] - c[3] - 2) for c in lobes))
    max_y = min(cv.h - 1, max(int(c[1] + c[3] + 2) for c in lobes))

    grid = {}
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            best = None
            for idx, (cx, cy, rx, ry, bias) in enumerate(lobes):
                dx = (x - cx) / max(rx, 1.0)
                dy = (y - cy) / max(ry, 1.0)
                d2 = dx * dx + dy * dy
                n = (hsh(x // 2, y // 2, seed + idx * 13) * 0.24
                     + hsh(x, y, seed + idx * 29) * 0.14)
                eff = d2 + n
                if eff <= 1.08:
                    light = -0.58 * dx - 0.72 * dy + bias
                    if eff > 0.86 and dy > 0.22:
                        light -= 0.48
                    best = (eff, light, idx)
            if best is not None:
                grid[(x, y)] = best

    out_c = outline_col or palette_map['out']
    for (x, y), (eff, light, idx) in grid.items():
        is_edge = False
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if (nx, ny) not in grid:
                is_edge = True
                break
        if is_edge:
            if light > 0.35 and (x, y - 1) not in grid:
                cv.p(x, y, palette_map['mid0'])
            else:
                cv.p(x, y, out_c)
            continue

        r = hsh(x, y, seed + 97)
        if light > 0.48:
            c = palette_map['hi1'] if r > 0.38 else palette_map['hi0']
        elif light > 0.12:
            c = palette_map['hi0'] if r > 0.56 else palette_map['mid1']
        elif light > -0.22:
            c = palette_map['mid1'] if r > 0.45 else palette_map['mid0']
        elif light > -0.55:
            c = palette_map['mid0'] if r > 0.55 else palette_map['sh']
        else:
            c = palette_map['sh']
        cv.p(x, y, c)
        if highlight_specks and light > -0.10 and r > 0.85:
            cv.p(x, y, highlight_specks[int(hsh(x, y, seed + 301) * len(highlight_specks)) % len(highlight_specks)])
        elif shadow_specks and light < -0.35 and r < 0.28:
            cv.p(x, y, shadow_specks[int(hsh(x, y, seed + 409) * len(shadow_specks)) % len(shadow_specks)])


def draw_tree_trunk(cv, cx, y_top, y_bot, w_top=4, w_bot=7, bark_ramp='wood', seed=17):
    """Textured Fable bark trunk with flared roots and canopy cast shadow."""
    for y in range(y_top, y_bot + 1):
        t = (y - y_top) / max(1, y_bot - y_top)
        flare = 2.0 * (t ** 3)
        half_w = (w_top + (w_bot - w_top) * t) / 2.0 + flare
        x0 = int(round(cx - half_w))
        x1 = int(round(cx + half_w))
        for x in range(x0, x1 + 1):
            if x == x0 or x == x1:
                cv.p(x, y, col(bark_ramp, 0))
            else:
                u = (x - x0) / max(1, x1 - x0)
                if y < y_top + 3:
                    cv.p(x, y, col(bark_ramp, 1 if u < 0.55 else 0))
                else:
                    groove = hsh(x, y // 2, seed)
                    if u < 0.30:
                        idx = 5 if groove > 0.45 else 4
                    elif u < 0.62:
                        idx = 4 if groove > 0.60 else 3
                    elif u < 0.84:
                        idx = 2 if groove > 0.40 else 1
                    else:
                        idx = 1
                    cv.p(x, y, col(bark_ramp, idx))


def draw_wheel(cv, cx, cy, r=3, rim_c=None, hub_c=None):
    """Crisp 3/4 vehicle rubber wheel with metallic rim and ground contact."""
    rim_c = rim_c or col('steel', 4)
    hub_c = hub_c or col('steel', 6)
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            d2 = (x - cx) ** 2 + (y - cy) ** 2
            if d2 <= r * r + 0.4:
                if d2 >= (r - 1.0) ** 2:
                    cv.p(x, y, col('asphalt', 0) if y >= cy else col('asphalt', 1))
                elif d2 <= 1.2:
                    cv.p(x, y, hub_c)
                else:
                    cv.p(x, y, rim_c if (x + y) % 2 == 0 else col('steel', 2))


def draw_car_window_glass(cv, x0, y0, x1, y1, tint='glass', bright_glare=True):
    """Angled glossy vehicle side-glass with crisp Fable cyan-white diagonal specular streaks."""
    h = max(1, y1 - y0)
    for y in range(y0, y1):
        ry = y - y0
        for x in range(x0, x1):
            rx = x - x0
            diag = rx + ry
            if ry == 0:
                cv.p(x, y, col(tint, 0))
            elif bright_glare and diag == 2:
                cv.p(x, y, col('white', 6) if ry == 1 else col(tint, 6))
            elif bright_glare and (diag == 3 or (diag == 6 and ry <= 2)):
                cv.p(x, y, col(tint, 6) if ry <= 1 else col(tint, 5))
            elif ry == h - 1:
                cv.p(x, y, col(tint, 3))
            else:
                cv.p(x, y, col(tint, 2 if (rx + ry) % 3 != 0 else 1))


def draw_sloped_windshield(cv, x_top, y_top, y_bot, width=5, border_col=None, slope=0.65):
    """Foreshortened 3/4 angled front windshield sloping smoothly from roof corner to hood."""
    border_col = border_col or col('ink', 0)
    h = max(1, y_bot - y_top)
    for i, y in enumerate(range(y_top, y_bot + 1)):
        lx = int(round(x_top - i * slope))
        cv.p(lx - 1, y, border_col)
        for dx in range(width):
            x = lx + dx
            if i == 0:
                cv.p(x, y, col('glass', 0))
            elif (dx + i) == 2 or (dx == 1 and i == 1):
                cv.p(x, y, col('white', 6) if i <= 2 else col('glass', 6))
            elif (dx + i) == 3 or (dx == 2 and i == 4):
                cv.p(x, y, col('glass', 6) if i <= 2 else col('glass', 5))
            elif dx == 0:
                cv.p(x, y, col('glass', 3))
            elif dx == width - 1:
                cv.p(x, y, col('glass', 1))
            else:
                cv.p(x, y, col('glass', 3 if i < h // 2 else 2))
        cv.p(lx + width, y, border_col)


def draw_hollow_bike_wheel(cv, cx, cy, radius=3, tire_c=None, hub_c=None, spoke_c=None):
    """Crisp Fable jitensha-style 1px hollow circular bicycle wheel with airy transparent interior."""
    tire_c = tire_c or col('asphalt', 0)
    hub_c = hub_c or col('steel', 6)
    spoke_c = spoke_c or col('steel', 4)
    if radius == 2:
        # Crisp 5x5 Fable house-eave hollow wheel ring
        ring = (
            (-1, -2), (0, -2), (1, -2),
            (-2, -1), (2, -1),
            (-2, 0), (2, 0),
            (-2, 1), (2, 1),
            (-1, 2), (0, 2), (1, 2),
        )
        for dx, dy in ring:
            cv.p(cx + dx, cy + dy, col('asphalt', 1) if dy == -2 else tire_c)
        cv.p(cx, cy, hub_c)
    else:
        # Crisp 7x7 Fable jitensha hollow wheel ring with sparse airy spoke glints
        ring = (
            (-1, -3), (0, -3), (1, -3),
            (-2, -2), (2, -2),
            (-3, -1), (3, -1),
            (-3, 0), (3, 0),
            (-3, 1), (3, 1),
            (-2, 2), (2, 2),
            (-1, 3), (0, 3), (1, 3),
        )
        for dx, dy in ring:
            cv.p(cx + dx, cy + dy, col('asphalt', 1) if dy <= -2 else tire_c)
        cv.p(cx, cy, hub_c)
        for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
            cv.p(cx + sx, cy + sy, spoke_c)


def draw_scooter_wheel(cv, cx, cy):
    """Clean 5x5 round scooter tire with crisp dark rubber ring & bright silver hub dot."""
    ring = (
        (-1, -2), (0, -2), (1, -2),
        (-2, -1), (2, -1),
        (-2, 0), (2, 0),
        (-2, 1), (2, 1),
        (-1, 2), (0, 2), (1, 2),
    )
    for dx, dy in ring:
        cv.p(cx + dx, cy + dy, col('asphalt', 1) if dy < 0 else col('asphalt', 0))
    for dx, dy in ((-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)):
        cv.p(cx + dx, cy + dy, col('steel', 3) if dy <= 0 else col('steel', 2))
    cv.p(cx, cy, col('white', 6))


def draw_iron_tree_grate(cv, y_top=35):
    """Top-3/4 square cast-iron sidewalk tree grate framed by beveled concrete curb."""
    draw_shadow_bar(cv, 4, y_top + 9, 29, y_top + 13)
    # Outer concrete curb frame (top sunlit bevel + front edge)
    cv.outline_box(5, y_top, 27, y_top + 11, col('concrete', 4), col('concrete', 1),
                   top_hi=col('concrete', 6), bot_sh=col('concrete', 2))
    cv.hline(5, 27, y_top + 11, col('ink', 0))
    # Corner miter joints on concrete curb
    cv.p(6, y_top + 1, col('concrete', 3))
    cv.p(25, y_top + 1, col('concrete', 3))
    # Inner cast-iron grate plate
    cv.outline_box(7, y_top + 2, 25, y_top + 9, col('steel', 1), col('steel', 0), top_hi=col('steel', 3))
    # Radial + slotted cast-iron bars over dark soil
    for y in range(y_top + 3, y_top + 8):
        for x in range(8, 24):
            is_bar = (y == y_top + 5) or (x in (11, 15, 16, 20)) or (abs(x - 16) == abs(y - (y_top + 5)) * 2)
            if is_bar:
                cv.p(x, y, col('steel', 3 if y <= y_top + 4 else 2))
            else:
                cv.p(x, y, col('soil', 1) if (x + y) % 2 == 0 else col('steel', 0))


# ---------------------------------------------------------------------------
# CATEGORY 1: foliage-planters (10)
# ---------------------------------------------------------------------------

def make_tree_grate_spring(cv):
    """1. mf-obj-tree_grate_spring (32x48) — Lush spring urban street tree + iron tree grate."""
    draw_iron_tree_grate(cv, y_top=35)
    # Tiny moss/grass shoots in grate corners
    cv.p(9, 42, col('foliage', 4))
    cv.p(22, 39, col('moss', 4))
    cv.p(23, 42, col('foliage', 3))

    # Textured bark trunk with subtle branch fork
    draw_tree_trunk(cv, 16, 24, 41, w_top=5, w_bot=7, bark_ramp='wood', seed=101)
    draw_line(cv, 14, 27, 10, 22, col('wood', 1))
    draw_line(cv, 18, 27, 22, 22, col('wood', 1))

    # Rich layered spring foliage canopy (10 overlapping lobes including front lower puffs)
    lobes = [
        (16, 21, 13, 8, -0.35),   # deep lower rear crown
        (8, 19, 8, 7, -0.10),     # lower left puff
        (24, 20, 8, 7, -0.32),    # lower right shaded puff
        (16, 15, 12, 9, 0.05),    # mid main body
        (10, 12, 8, 7, 0.38),     # sunlit upper-left puff
        (21, 13, 8, 7, -0.02),    # mid-right puff
        (15, 7, 9, 6, 0.55),      # sunlit top crown
        (11, 20, 6, 4, 0.12),     # front-left foreground puff (breaks flat bottom!)
        (20, 21, 6, 4, -0.10),    # front-right foreground puff
        (15, 16, 6, 5, 0.28),     # sunlit front center puff
    ]
    pmap = {
        'out': col('foliage', 0),
        'sh': col('foliage', 1),
        'mid0': col('foliage', 2),
        'mid1': col('foliage', 3),
        'hi0': col('foliage', 4),
        'hi1': col('foliage', 5),
    }
    draw_leaf_canopy(cv, lobes, pmap, seed=31, outline_col=col('foliage', 0),
                     highlight_specks=[col('foliage', 6), col('foliage', 5)])
    for px, py in ((10, 7), (12, 5), (14, 4), (8, 11), (11, 10), (15, 9), (10, 18)):
        cv.p(px, py, col('foliage', 6))


def make_tree_grate_ginkgo(cv):
    """2. mf-obj-tree_grate_ginkgo (32x48) — Golden-yellow autumn ginkgo street tree + fallen leaves."""
    draw_iron_tree_grate(cv, y_top=35)

    draw_tree_trunk(cv, 16, 25, 41, w_top=4, w_bot=6, bark_ramp='cedar', seed=202)
    draw_line(cv, 15, 27, 11, 22, col('cedar', 1))
    draw_line(cv, 17, 27, 21, 23, col('cedar', 0))

    # Tall slightly pyramidal ginkgo autumn canopy with distinct warm foreground puffs
    lobes = [
        (16, 21, 12, 7, -0.35),
        (9, 19, 7, 6, -0.08),
        (23, 20, 7, 6, -0.35),
        (16, 15, 11, 8, 0.08),
        (10, 12, 7, 6, 0.40),
        (21, 13, 7, 6, -0.05),
        (16, 6, 8, 6, 0.58),
        (11, 20, 5, 4, 0.14),
        (20, 21, 5, 4, -0.14),
        (15, 15, 6, 5, 0.30),
    ]
    pmap = {
        'out': col('maple', 1),
        'sh': col('orange', 1),
        'mid0': col('orange', 2),
        'mid1': col('orange', 3),
        'hi0': col('yellow', 3),
        'hi1': col('yellow', 4),
    }
    draw_leaf_canopy(cv, lobes, pmap, seed=57, outline_col=col('orange', 0),
                     highlight_specks=[col('yellow', 5), col('yellow', 4), col('orange', 4)],
                     shadow_specks=[col('maple', 3), col('maple', 2)])
    for px, py in ((13, 4), (15, 3), (11, 8), (9, 11), (14, 9), (12, 14), (10, 18)):
        cv.p(px, py, col('yellow', 5))

    # Fallen golden ginkgo leaves scattered on the grate & sidewalk rim
    for lx, ly, lc in (
        (6, 44, col('yellow', 4)), (7, 45, col('orange', 4)),
        (10, 41, col('yellow', 5)), (11, 41, col('yellow', 3)),
        (21, 42, col('yellow', 4)), (24, 45, col('orange', 4)),
        (25, 44, col('yellow', 5)), (4, 46, col('yellow', 4)),
        (27, 46, col('orange', 3)), (13, 45, col('yellow', 4)),
        (19, 39, col('yellow', 4)), (8, 36, col('orange', 4)),
    ):
        cv.p(lx, ly, lc)


def make_tree_cherry_blossom(cv):
    """3. mf-obj-tree_cherry_blossom (32x48) — Full-bloom pink sakura tree + stone tree ring."""
    draw_shadow_oval(cv, 16, 43, 12, 4)
    # Circular top-3/4 stone tree ring
    draw_ellipse(cv, 16, 41.5, 11, 4.5, col('stone', 1))
    draw_ellipse(cv, 16, 40.5, 11, 4.2, col('stone', 4))
    draw_ellipse(cv, 16, 40.0, 10.5, 3.6, col('stone', 5))
    for sx in (8, 12, 16, 20, 24):
        cv.p(sx, 43, col('stone', 2))
        cv.p(sx, 44, col('stone', 1))
    draw_ellipse(cv, 16, 40.0, 8.2, 2.5, col('soil', 2))
    draw_ellipse(cv, 16, 40.2, 7.2, 1.9, col('soil', 1))

    # Dark cherry bark trunk & graceful visible branch forks
    draw_tree_trunk(cv, 16, 24, 40, w_top=5, w_bot=7, bark_ramp='darkwood', seed=303)
    draw_line(cv, 14, 26, 9, 20, col('darkwood', 2))
    draw_line(cv, 15, 26, 10, 20, col('darkwood', 0))
    draw_line(cv, 18, 26, 23, 21, col('darkwood', 1))

    # Billowing full-bloom pink/white sakura canopy with soft foreground puffs
    lobes = [
        (16, 20, 14, 8, -0.28),
        (8, 18, 8, 7, -0.02),
        (24, 19, 8, 7, -0.24),
        (16, 14, 13, 8, 0.14),
        (10, 11, 8, 6, 0.44),
        (22, 12, 8, 6, 0.08),
        (15, 6, 9, 5, 0.58),
        (11, 20, 6, 4, 0.16),
        (21, 21, 6, 4, -0.08),
        (15, 15, 7, 5, 0.30),
    ]
    pmap = {
        'out': col('pink', 0),
        'sh': col('pink', 1),
        'mid0': col('pink', 2),
        'mid1': col('pink', 3),
        'hi0': col('pink', 4),
        'hi1': col('pink', 5),
    }
    draw_leaf_canopy(cv, lobes, pmap, seed=83, outline_col=col('pink', 0),
                     highlight_specks=[col('white', 6), col('cream', 6), col('pink', 5)])
    for bx, by in ((12, 23), (13, 22), (19, 23), (20, 22), (15, 24)):
        cv.p(bx, by, col('darkwood', 1))
    for px, py in ((10, 7), (12, 5), (15, 4), (8, 11), (13, 9), (18, 8), (11, 17)):
        cv.p(px, py, col('white', 6))
    # Fallen sakura petals on soil & drifting near base
    for px, py, pc in (
        (10, 40, col('pink', 5)), (13, 41, col('white', 6)), (19, 40, col('pink', 4)),
        (22, 41, col('pink', 5)), (6, 44, col('pink', 4)), (26, 43, col('white', 6)),
        (9, 45, col('pink', 5)), (21, 45, col('pink', 4)), (4, 42, col('pink', 5)),
        (27, 45, col('pink', 5)), (7, 29, col('pink', 5)), (25, 31, col('white', 6)),
    ):
        cv.p(px, py, pc)


def make_sidewalk_planter(cv):
    """4. mf-obj-sidewalk_planter (32x16) — Concrete street planter with shrubs & red/yellow flowers."""
    draw_shadow_bar(cv, 1, 13, 31, 16)
    cv.outline_box(2, 6, 30, 14, col('concrete', 4), col('concrete', 0),
                   top_hi=col('concrete', 6), bot_sh=col('concrete', 2))
    cv.hline(3, 29, 7, col('concrete', 6))
    cv.hline(3, 29, 8, col('concrete', 1))  # crisp rim under-shadow
    cv.stipple_rect(3, 9, 29, 13, 'concrete', 4, 3, 5, seed=41, rate=0.22)
    cv.vline(11, 9, 13, col('concrete', 2))
    cv.vline(21, 9, 13, col('concrete', 2))
    cv.hline(3, 29, 13, col('concrete', 2))

    lobes = [
        (7, 5, 5, 4, 0.18),
        (13, 4, 5, 4, 0.34),
        (19, 5, 5, 4, 0.14),
        (25, 5, 5, 4, -0.04),
        (16, 6, 9, 3, 0.22),
    ]
    pmap = {
        'out': col('foliage', 0),
        'sh': col('foliage', 1),
        'mid0': col('foliage', 2),
        'mid1': col('foliage', 3),
        'hi0': col('foliage', 4),
        'hi1': col('foliage', 5),
    }
    draw_leaf_canopy(cv, lobes, pmap, seed=114, outline_col=col('foliage', 0),
                     highlight_specks=[col('foliage', 6)])
    # Vibrant clustered red & yellow flowers
    for fx, fy, is_red in ((5, 4, True), (10, 3, False), (15, 3, True),
                           (20, 3, False), (25, 4, True), (13, 6, False), (22, 6, True)):
        if is_red:
            cv.p(fx, fy, col('red', 3))
            cv.p(fx + 1, fy, col('red', 5))
            cv.p(fx, fy + 1, col('red', 4))
            cv.p(fx + 1, fy + 1, col('red', 2))
        else:
            cv.p(fx, fy, col('yellow', 5))
            cv.p(fx + 1, fy, col('yellow', 4))
            cv.p(fx, fy + 1, col('orange', 4))


def make_terracotta_trough(cv):
    """5. mf-obj-terracotta_trough (32x16) — Warm terracotta & wood-trimmed cafe flower trough with ivy."""
    draw_shadow_bar(cv, 1, 13, 31, 16)
    cv.outline_box(2, 6, 30, 14, col('brick', 4), col('brick', 0),
                   top_hi=col('brick', 5), bot_sh=col('brick', 2))
    # Wooden European cafe top trim & crisp corner posts
    cv.hline(1, 31, 6, col('wood', 1))
    cv.hline(2, 30, 7, col('cedar', 5))
    cv.hline(2, 30, 8, col('wood', 2))
    for vx in (2, 3, 15, 16, 28, 29):
        cv.vline(vx, 8, 14, col('wood', 4 if vx in (2, 15, 28) else 2))
    cv.stipple_rect(4, 9, 15, 13, 'brick', 4, 3, 5, seed=51, rate=0.25)
    cv.stipple_rect(17, 9, 28, 13, 'brick', 4, 3, 5, seed=52, rate=0.25)

    lobes = [
        (7, 4, 5, 3, 0.25),
        (14, 3, 6, 3, 0.35),
        (21, 4, 6, 3, 0.15),
        (26, 5, 4, 3, -0.05),
    ]
    pmap = {
        'out': col('foliage', 0),
        'sh': col('foliage', 1),
        'mid0': col('foliage', 2),
        'mid1': col('foliage', 3),
        'hi0': col('foliage', 4),
        'hi1': col('foliage', 5),
    }
    draw_leaf_canopy(cv, lobes, pmap, seed=155, outline_col=col('foliage', 0))

    # Overflowing lavender, pink, and yellow blooms
    for fx, fy, c1, c2 in (
        (5, 3, col('pink', 4), col('pink', 5)),
        (9, 2, col('navy', 5), col('blue', 5)),
        (13, 2, col('yellow', 5), col('yellow', 4)),
        (17, 3, col('pink', 4), col('white', 6)),
        (21, 2, col('navy', 5), col('blue', 5)),
        (25, 3, col('yellow', 5), col('orange', 4)),
        (11, 5, col('pink', 5), col('pink', 3)),
        (19, 5, col('yellow', 5), col('yellow', 4)),
    ):
        cv.p(fx, fy, c1)
        cv.p(fx + 1, fy, c2)
        cv.p(fx, fy + 1, c2)

    # Trailing green ivy draping over front rim
    for ix, iy in (
        (6, 7), (6, 8), (7, 9), (7, 10), (6, 11),
        (13, 7), (13, 8), (12, 9), (13, 10),
        (22, 7), (22, 8), (23, 9), (23, 10), (22, 11), (22, 12),
        (27, 7), (27, 8), (26, 9),
    ):
        cv.p(ix, iy, col('foliage', 4 if iy <= 8 else (3 if iy <= 10 else 2)))
        if iy == 9:
            cv.p(ix + 1, iy, col('foliage', 5))


def make_boxwood_hedge(cv):
    """6. mf-obj-boxwood_hedge (32x16) — Trimmed top-3/4 boxwood hedge + low stone border curb."""
    draw_shadow_bar(cv, 0, 14, 32, 16)
    cv.outline_box(1, 11, 31, 15, col('stone', 4), col('stone', 1),
                   top_hi=col('stone', 6), bot_sh=col('stone', 2))
    for sx in (7, 15, 23):
        cv.vline(sx, 12, 15, col('stone', 2))

    for y in range(1, 12):
        for x in range(1, 31):
            if y == 1 and x in (1, 2, 11, 22, 29, 30):
                continue
            if y == 2 and x in (1, 30):
                continue
            r = hsh(x, y, 61)
            r2 = hsh(x // 2, y // 2, 67)
            if y == 1 or (y == 2 and x in (2, 11, 22, 29)):
                cv.p(x, y, col('foliage', 1) if x > 20 else col('foliage', 2))
            elif x in (1, 30):
                cv.p(x, y, col('foliage', 0))
            elif y <= 6:
                if y == 6:
                    t = 6 if r > 0.35 else 5
                elif y == 2:
                    t = 5 if r > 0.3 else 4
                else:
                    t = 5 if (r2 > 0.45 and r > 0.3) else (6 if r > 0.85 else 4)
                if x >= 27:
                    t = max(2, t - 2)
                cv.p(x, y, col('foliage', t))
            else:
                if y == 7:
                    t = 3 if r > 0.35 else 4
                elif y == 11:
                    t = 0 if r < 0.45 else 1
                else:
                    t = 2 if r2 > 0.42 else (3 if r > 0.72 else 1)
                if x >= 27:
                    t = max(0, t - 1)
                cv.p(x, y, col('foliage', t))


def make_bamboo_planter(cv):
    """7. mf-obj-bamboo_planter (16x32) — Sleek dark-slate planter + sunlit beveled rim & segmented bamboo."""
    draw_shadow_bar(cv, 1, 29, 15, 32)
    # Dark slate planter body (y=25..30)
    cv.outline_box(2, 24, 14, 30, col('kuro', 3), col('kuro', 0),
                   top_hi=col('kuro', 4), bot_sh=col('kuro', 1))
    cv.vline(3, 25, 29, col('kuro', 4))
    cv.vline(12, 25, 29, col('kuro', 2))
    cv.hline(3, 13, 27, col('kuro', 2))
    cv.hline(3, 13, 28, col('kuro', 4))

    # Top-3/4 planter collar: far/back sunlit rim bevel + dark recessed soil cavity
    cv.hline(2, 14, 20, col('kuro', 0))
    cv.rect(1, 21, 15, 25, col('kuro', 0))
    # Back sunlit top rim bevel (y=21) & side rim bevels (x=2 sunlit, x=13 shaded)
    cv.hline(2, 8, 21, col('kuro', 6))
    cv.hline(8, 14, 21, col('kuro', 5))
    cv.vline(2, 21, 25, col('kuro', 6))
    cv.vline(13, 21, 25, col('kuro', 4))
    # Dark recessed soil opening (x=3..13, y=22..24) so bamboo visibly emerges from inside!
    cv.rect(3, 22, 13, 24, col('soil', 0))
    cv.hline(3, 13, 23, col('soil', 1))
    for px, pc in ((4, col('stone', 4)), (6, col('stone', 5)), (9, col('stone', 4)), (11, col('stone', 3))):
        cv.p(px, 23, pc)

    # 3 slender segmented bamboo stalks emerging directly from inside the dark soil opening
    stalks = [
        (4, 23, 8, 'foliage', 4),
        (7, 23, 4, 'green', 4),
        (10, 23, 10, 'foliage', 3),
    ]
    for sx, y_bot, y_top, ramp, tone in stalks:
        for y in range(y_top, y_bot + 1):
            x = sx + (1 if (sx == 7 and y < 11) else 0)
            if y == y_bot:
                # Subtle soil-contact darkening right inside the cavity
                cv.p(x, y, col(ramp, max(1, tone - 2)))
                cv.p(x + 1, y, col(ramp, 0))
            elif (y_bot - y) % 4 == 0:
                cv.p(x, y, col('moss', 5))
                cv.p(x + 1, y, col('foliage', 1))
            else:
                cv.p(x, y, col(ramp, tone))
                cv.p(x + 1, y, col(ramp, max(1, tone - 2)))

    # Front sunlit top rim bevel (2px tall lip overlapping in front of soil & stalk bases!)
    cv.hline(2, 9, 24, col('kuro', 6))
    cv.hline(9, 14, 24, col('kuro', 5))
    cv.hline(2, 10, 25, col('kuro', 4))
    cv.hline(10, 14, 25, col('kuro', 3))
    cv.p(1, 24, col('kuro', 0))
    cv.p(14, 24, col('kuro', 0))
    cv.p(1, 25, col('kuro', 0))
    cv.p(14, 25, col('kuro', 0))
    # Crisp 1px shadow cast directly under the overhanging rim onto planter wall
    cv.hline(3, 13, 26, col('kuro', 1))

    # Delicate feathery bamboo leaf fronds (sharp pointed diagonal tufts, NOT round blobs!)
    def _frond(ox, oy, dx, dy, tone_hi=5, tone_lo=2):
        draw_line(cv, ox, oy, ox + dx, oy + dy, col('foliage', tone_lo))
        draw_line(cv, ox, oy - 1, ox + dx, oy + dy - 1, col('foliage', tone_hi))
        cv.p(ox + dx, oy + dy, col('foliage', max(1, tone_hi - 1)))

    # Upper crown fronds
    _frond(7, 5, -4, -2, 6, 3)
    _frond(8, 4, 4, -2, 5, 2)
    _frond(8, 6, -5, 1, 5, 2)
    _frond(9, 6, 5, 1, 4, 1)
    _frond(7, 3, -2, -2, 6, 4)
    _frond(9, 3, 3, -1, 5, 3)
    # Mid left & right stalk fronds
    _frond(4, 9, -3, -1, 6, 3)
    _frond(5, 10, -4, 2, 5, 2)
    _frond(5, 8, 3, -1, 5, 2)
    _frond(11, 11, 4, -1, 5, 2)
    _frond(11, 12, 4, 2, 4, 1)
    _frond(10, 10, -3, 1, 4, 2)
    # Lower airy spray
    _frond(4, 16, -3, 1, 5, 2)
    _frond(8, 15, 4, 1, 4, 1)
    _frond(11, 17, 3, 1, 3, 1)
    # Accent dark-green core anchor pixels behind fronds
    for ax, ay in ((7, 5), (8, 5), (5, 9), (10, 11), (8, 14)):
        cv.p(ax, ay, col('foliage', 1))


def make_potted_olive(cv):
    """8. mf-obj-potted_olive (16x32) — Tall glazed ceramic pot + sculptural small olive cafe tree."""
    draw_shadow_oval(cv, 8, 29.5, 5.5, 2.0)
    # Ceramic saucer base
    cv.hline(4, 12, 29, col('teal', 1))
    cv.hline(5, 11, 30, col('ink', 0))
    # Tall tapered glazed teal-ceramic cafe pot (y = 19..29)
    for y in range(20, 30):
        t = (y - 20) / 9.0
        half_w = 4.6 - 1.3 * t
        x0 = int(round(8 - half_w))
        x1 = int(round(8 + half_w))
        for x in range(x0, x1 + 1):
            if x == x0 or x == x1 or y == 29:
                cv.p(x, y, col('teal', 0))
            elif y == 20:
                cv.p(x, y, col('teal', 5) if x < 9 else col('teal', 3))
            elif y == 21:
                cv.p(x, y, col('teal', 1))
            else:
                u = (x - x0) / max(1, x1 - x0)
                if u < 0.28:
                    cv.p(x, y, col('teal', 5) if y < 26 else col('teal', 4))
                elif u < 0.62:
                    cv.p(x, y, col('teal', 3))
                else:
                    cv.p(x, y, col('teal', 2) if u < 0.82 else col('teal', 1))
    cv.hline(3, 13, 19, col('teal', 0))
    cv.hline(4, 12, 20, col('soil', 1))
    cv.p(5, 20, col('soil', 3))
    cv.p(10, 20, col('soil', 2))

    # Sculptural pale gnarled olive trunk with clear Y-fork into crown
    draw_line(cv, 8, 20, 7, 15, col('stone', 4))
    draw_line(cv, 9, 20, 8, 15, col('stone', 2))
    draw_line(cv, 7, 15, 5, 12, col('stone', 3))
    draw_line(cv, 8, 15, 10, 12, col('wood', 2))

    # Fuller sculpted silvery-green olive/ficus crown
    lobes = [
        (8, 10, 6.0, 4.6, 0.05),
        (5, 8, 4.2, 3.4, 0.42),
        (11, 9, 4.2, 3.4, -0.12),
        (8, 5, 4.8, 3.4, 0.54),
        (7, 11, 3.8, 2.8, 0.18),
    ]
    pmap = {
        'out': col('midori', 0),
        'sh': col('midori', 1),
        'mid0': col('midori', 2),
        'mid1': col('midori', 3),
        'hi0': col('midori', 5),
        'hi1': col('midori', 6),
    }
    draw_leaf_canopy(cv, lobes, pmap, seed=88, outline_col=col('midori', 0),
                     highlight_specks=[col('midori', 7), col('moss', 5)])
    for px, py in ((6, 4), (8, 3), (4, 7), (10, 8)):
        cv.p(px, py, col('midori', 7))


def make_park_fountain(cv):
    """9. mf-obj-park_fountain (48x48) — Circular tiered stone plaza water fountain in top-3/4."""
    cx, cy = 23.5, 31.5

    draw_shadow_oval(cv, cx + 1, 36.8, 22.2, 10.6)

    # Outer stone basin vertical wall (front cylinder skirt seen from top-3/4)
    for dy in range(6, -1, -1):
        y_off = cy + dy
        for y in range(int(y_off - 12), int(y_off + 13)):
            for x in range(1, 47):
                dx = (x - cx) / 21.5
                dd = (y - y_off) / 11.2
                d2 = dx * dx + dd * dd
                if d2 <= 1.0:
                    if dy == 6 or d2 >= 0.92:
                        cv.p(x, y, col('stone', 1))
                    else:
                        if dx < -0.35:
                            t = 4
                        elif dx < 0.25:
                            t = 3
                        else:
                            t = 2
                        if abs(x - int(cx)) % 7 == 0 and dy in (1, 2, 3, 4):
                            t = max(1, t - 1)
                        cv.p(x, y, col('stone', t))

    # Outer stone rim top lip (smooth beveled sunlit stone coping)
    draw_ellipse(cv, cx, cy, 21.8, 11.4, col('stone', 1))
    draw_ellipse(cv, cx, cy - 0.5, 21.0, 10.6, col('stone', 5))
    draw_ellipse(cv, cx, cy - 0.8, 20.0, 9.8, col('concrete', 6))
    for ang_deg in range(0, 360, 30):
        ang = math.radians(ang_deg)
        x0 = int(round(cx + math.cos(ang) * 17.6))
        y0 = int(round(cy - 0.5 + math.sin(ang) * 8.2))
        x1 = int(round(cx + math.cos(ang) * 20.4))
        y1 = int(round(cy - 0.5 + math.sin(ang) * 9.9))
        jc = col('stone', 4) if math.cos(ang) < 0 else col('stone', 3)
        draw_line(cv, x0, y0, x1, y1, jc)

    # Shimmering turquoise water pool + concentric ripples
    draw_ellipse(cv, cx, cy, 17.6, 8.4, col('stone', 2))
    draw_ellipse(cv, cx, cy + 0.6, 17.0, 7.8, col('glass', 2))
    for y in range(int(cy - 8), int(cy + 10)):
        for x in range(int(cx - 17), int(cx + 18)):
            dx = (x - cx) / 16.8
            dy = (y - (cy + 0.6)) / 7.6
            d2 = dx * dx + dy * dy
            if d2 <= 1.0:
                if dy < -0.62:
                    cv.p(x, y, col('glass', 1))
                else:
                    dist = math.sqrt(d2)
                    ripple = abs((dist * 4.5) - round(dist * 4.5)) < 0.14
                    r = hsh(x, y, 91)
                    if ripple and dy > -0.4:
                        cv.p(x, y, col('glass', 5) if r > 0.35 else col('teal', 4))
                    elif dx + dy < -0.2:
                        cv.p(x, y, col('teal', 4) if r > 0.45 else col('glass', 4))
                    else:
                        cv.p(x, y, col('teal', 3) if r > 0.35 else col('glass', 3))

    # Lower pedestal base in water
    draw_ellipse(cv, cx, cy + 1.0, 6.2, 3.0, col('white', 5))
    draw_ellipse(cv, cx, cy + 0.5, 4.8, 2.2, col('stone', 3))
    cv.outline_box(20, 19, 28, 31, col('stone', 4), col('stone', 1), top_hi=col('stone', 5))
    cv.vline(21, 20, 30, col('stone', 5))
    cv.vline(26, 20, 30, col('stone', 2))

    # Mid carved stone bowl
    draw_ellipse(cv, cx, 22.0, 9.8, 4.6, col('stone', 1))
    draw_ellipse(cv, cx, 21.0, 9.5, 4.2, col('stone', 4))
    draw_ellipse(cv, cx, 20.2, 9.2, 3.8, col('concrete', 6))
    draw_ellipse(cv, cx, 20.2, 7.6, 2.8, col('teal', 4))
    draw_ellipse(cv, cx, 20.4, 6.5, 2.2, col('glass', 5))

    # Upper finial pedestal & top cup
    cv.outline_box(21, 11, 27, 20, col('stone', 4), col('stone', 1), top_hi=col('stone', 6))
    cv.vline(22, 12, 19, col('concrete', 6))
    draw_ellipse(cv, cx, 12.2, 4.8, 2.2, col('stone', 1))
    draw_ellipse(cv, cx, 11.6, 4.5, 1.9, col('concrete', 6))
    draw_ellipse(cv, cx, 11.6, 3.2, 1.2, col('glass', 5))

    # Luminous white/cyan foaming water plume & arcs
    for y in range(4, 12):
        cv.p(23, y, col('white', 6) if y % 2 == 0 else col('glass', 6))
        cv.p(24, y, col('glass', 6) if y % 2 == 0 else col('white', 5))
    cv.p(22, 6, col('white', 6))
    cv.p(25, 6, col('glass', 5))
    cv.p(23, 3, col('white', 6))

    for side in (-1, 1):
        for step in range(9):
            t = step / 8.0
            ax = int(round(cx + side * (1.2 + t * 6.5)))
            ay = int(round(6.0 + 14.0 * (t * t) - 2.0 * t))
            cv.p(ax, ay + 1, col('glass', 4))
            cv.p(ax, ay, col('white', 6) if step % 2 == 0 else col('glass', 6))
            if step in (7, 8):
                cv.p(ax, ay + 1, col('white', 5))

    for side in (-1, 1):
        for offset_x in (4, 8):
            for step in range(11):
                t = step / 10.0
                ax = int(round(cx + side * (offset_x + t * 5.2)))
                ay = int(round(21.5 + t * 10.5 + (t * t) * 2.5))
                if ay < 37:
                    cv.p(ax, ay, col('white', 6) if (step + offset_x) % 2 == 0 else col('glass', 5))
            sx = int(round(cx + side * (offset_x + 5.2)))
            sy = 33 if offset_x == 8 else 35
            for ox in (-1, 0, 1):
                cv.p(sx + ox, sy, col('white', 6))
            cv.p(sx, sy - 1, col('glass', 6))

    for y in range(23, 34):
        cv.p(23, y, col('white', 6) if y % 2 == 0 else col('glass', 5))
        cv.p(24, y, col('glass', 6) if y % 2 == 1 else col('white', 5))
    cv.hline(21, 27, 34, col('white', 6))


def make_drinking_fountain(cv):
    """10. mf-obj-drinking_fountain (16x16) — Top-3/4 elliptical stone/steel park drinking fountain + water arc."""
    # Ground shadow oval
    draw_shadow_oval(cv, 8.0, 14.2, 5.2, 1.5)

    # Rounded stone/concrete base plinth (y=12..14)
    draw_ellipse(cv, 7.5, 13.4, 4.0, 1.3, col('stone', 0))
    draw_ellipse(cv, 7.5, 12.9, 3.6, 1.0, col('concrete', 4))
    cv.hline(5, 9, 12, col('concrete', 5))

    # Clean shaded cylindrical pedestal (x=5..10, y=7..13)
    for y in range(7, 14):
        cv.p(5, y, col('concrete', 0))
        cv.p(6, y, col('concrete', 6) if y >= 9 else col('concrete', 3))
        cv.p(7, y, col('concrete', 5) if y >= 9 else col('concrete', 2))
        cv.p(8, y, col('concrete', 4) if y >= 9 else col('concrete', 2))
        cv.p(9, y, col('concrete', 2) if y >= 9 else col('concrete', 1))
        cv.p(10, y, col('concrete', 0))
    # Subtle bowl cast shadow band across top of cylinder + chrome push button
    cv.hline(6, 10, 7, col('concrete', 1))
    cv.p(7, 10, col('steel', 5))
    cv.p(8, 10, col('steel', 2))

    # Clear elliptical top-3/4 metallic/stone basin (10x5px bowl, x=3..12, y=3..7)
    # Dark outer outline & curved lower bowl underside
    draw_ellipse(cv, 7.5, 5.8, 5.1, 2.5, col('concrete', 0))
    draw_ellipse(cv, 7.5, 5.5, 4.7, 2.2, col('concrete', 3))
    cv.hline(5, 10, 7, col('concrete', 2))
    # Bright sunlit elliptical rim (10x5px footprint: x=3..12, y=3..7)
    draw_ellipse(cv, 7.5, 5.0, 5.0, 2.4, col('concrete', 0))
    draw_ellipse(cv, 7.5, 4.9, 4.6, 2.1, col('concrete', 6))
    cv.hline(5, 10, 3, col('white', 6))
    cv.p(11, 5, col('concrete', 4))
    cv.p(11, 6, col('concrete', 3))

    # Shaded concave stainless-steel basin interior (x=4..10, y=4..5)
    cv.hline(5, 11, 4, col('steel', 1))      # back concave wall shadow
    cv.hline(4, 11, 5, col('steel', 3))      # mid concave bowl
    cv.p(4, 5, col('steel', 2))
    cv.p(9, 5, col('steel', 5))              # concave catchlight opposite light source
    cv.p(10, 5, col('steel', 4))
    cv.p(7, 5, col('steel', 0))              # dark central drain hole
    cv.p(6, 5, col('glass', 5))              # subtle wet sheen in bowl

    # Crisp silver faucet bubbler nozzle on right rim (x=10..12, y=2..4)
    cv.p(11, 4, col('steel', 1))
    cv.p(12, 3, col('steel', 1))
    cv.p(11, 3, col('steel', 5))
    cv.p(10, 3, col('steel', 6))
    cv.p(10, 2, col('white', 6))

    # Tiny 3px bright cyan/white water arc springing from nozzle into dark concave bowl
    cv.p(9, 1, col('white', 6))
    cv.p(8, 2, col('glass', 6))
    cv.p(7, 3, col('glass', 5))
    cv.p(7, 4, col('glass', 6))              # bright cyan splash glint inside dark concave bowl


# ---------------------------------------------------------------------------
# CATEGORY 2: transit-vehicles (10) — TRUE TOP-3/4 VIEW!
# ---------------------------------------------------------------------------

def make_car_compact_side(cv):
    """11. mf-obj-car_compact_side (48x32) — Cozy modern teal/cream compact hatchback in true RPG top-3/4."""
    draw_shadow_bar(cv, 3, 25, 45, 31)

    # Lower side body & front-left 3/4 nose wrap (y=17..26)
    cv.outline_box(4, 17, 44, 26, col('teal', 3), col('teal', 0),
                   top_hi=col('teal', 4), bot_sh=col('teal', 1))
    # Subtle front-left nose corner wrap (rounded fender corner)
    cv.clear(4, 17, 5, 18)
    cv.p(5, 17, col('teal', 0))
    cv.p(4, 18, col('teal', 0))

    # 3px sunlit teal HOOD top plane (y=14..16) + far hood border (y=13) + subtle front-left corner wrap
    cv.hline(7, 15, 13, col('teal', 0))
    cv.p(6, 14, col('teal', 0))
    cv.p(5, 15, col('teal', 0))
    cv.p(5, 16, col('teal', 0))
    cv.hline(7, 15, 14, col('teal', 5))
    cv.hline(6, 15, 15, col('teal', 5))
    cv.p(7, 15, col('teal', 4))
    cv.hline(6, 15, 16, col('teal', 4))
    cv.p(6, 16, col('teal', 5))  # subtle front-left wrap glint

    # 5px receding CREAM roof plane (y=5..9) with darker front/near roof edge!
    cv.hline(19, 38, 4, col('teal', 0))
    cv.p(18, 5, col('teal', 0))
    cv.p(38, 5, col('teal', 0))
    cv.p(17, 6, col('teal', 0))
    cv.p(39, 6, col('teal', 0))
    cv.vline(16, 7, 10, col('teal', 0))
    cv.vline(40, 7, 10, col('teal', 0))
    # Receding roof interior (5px tall: y=5..9)
    cv.hline(19, 38, 5, col('cream', 6))
    cv.hline(18, 39, 6, col('cream', 6))
    cv.hline(17, 40, 7, col('cream', 5))
    cv.hline(17, 40, 8, col('cream', 4))
    # Subtle front-left bevel & darker front/near roof edge separating roof from side glass
    cv.vline(17, 6, 9, col('cream', 3))
    cv.hline(17, 40, 9, col('cream', 2))
    cv.hline(17, 41, 10, col('teal', 0))
    # Tiny stub antenna seated on rear roof plane
    cv.p(35, 3, col('asphalt', 1))
    cv.p(36, 4, col('asphalt', 0))

    # Angled 3/4 front windshield (foreshortened front-left corner wrap, y=7..15)
    draw_sloped_windshield(cv, 16, 7, 15, width=5, border_col=col('teal', 0), slope=0.62)

    # Side greenhouse windows (y=11..15) with crisp cyan-white diagonal specular streaks
    cv.rect(19, 10, 42, 17, col('teal', 0))
    draw_car_window_glass(cv, 20, 11, 28, 16, tint='glass')
    draw_car_window_glass(cv, 29, 11, 37, 16, tint='glass')
    draw_car_window_glass(cv, 38, 11, 41, 16, tint='glass', bright_glare=False)
    cv.p(39, 12, col('glass', 6))
    cv.p(38, 13, col('glass', 5))
    cv.vline(28, 10, 17, col('teal', 1))
    cv.vline(37, 10, 17, col('teal', 2))
    cv.vline(41, 10, 17, col('teal', 2))
    cv.vline(42, 11, 17, col('teal', 0))

    # Compact cream side mirror
    cv.rect(16, 14, 19, 16, col('cream', 5))
    cv.p(16, 14, col('teal', 0))
    cv.p(18, 15, col('cream', 3))

    # Beltline crease, door seams, silver handles, wrapped headlight & taillight
    cv.hline(6, 43, 17, col('teal', 5))
    cv.hline(6, 43, 18, col('teal', 4))
    cv.hline(6, 43, 23, col('teal', 2))
    cv.vline(27, 17, 25, col('teal', 1))
    cv.vline(37, 17, 24, col('teal', 1))
    cv.hline(24, 27, 19, col('steel', 5))
    cv.hline(34, 37, 19, col('steel', 5))
    # Front-left wrapped headlight + bumper corner
    cv.rect(4, 18, 7, 21, col('yellow', 5))
    cv.p(5, 19, col('white', 6))
    cv.p(4, 20, col('orange', 4))
    cv.rect(4, 22, 8, 25, col('asphalt', 2))
    cv.hline(4, 8, 22, col('steel', 4))
    # Rear taillight & bumper
    cv.rect(41, 18, 44, 21, col('red', 4))
    cv.p(42, 18, col('red', 5))
    cv.rect(40, 22, 44, 25, col('asphalt', 1))

    draw_ellipse(cv, 12, 25, 4.5, 4.2, col('ink', 0))
    draw_ellipse(cv, 35, 25, 4.5, 4.2, col('ink', 0))
    draw_wheel(cv, 12, 26, r=3, rim_c=col('steel', 4), hub_c=col('steel', 6))
    draw_wheel(cv, 35, 26, r=3, rim_c=col('steel', 4), hub_c=col('steel', 6))


def make_kei_truck_side(cv):
    """12. mf-obj-kei_truck_side (48x32) — White mini kei truck in true top-3/4 with dark-wood bed & sunlit crates."""
    draw_shadow_bar(cv, 3, 25, 45, 31)

    # Under-chassis frame, toolbox & rear mudflap
    cv.rect(19, 22, 43, 26, col('asphalt', 1))
    cv.hline(20, 42, 22, col('asphalt', 0))
    cv.rect(24, 23, 29, 25, col('steel', 2))
    cv.rect(40, 24, 42, 27, col('asphalt', 0))

    # --- FLATBED INTERIOR (visible dark-wood bed rim behind near drop-gate!) ---
    # Far bed side-gate top rail (y=13..14)
    cv.hline(20, 44, 13, col('steel', 1))
    cv.hline(20, 44, 14, col('white', 5))
    cv.vline(43, 13, 18, col('steel', 1))
    # Dark-wood interior bed planks & inner rim (y=15..17) clearly visible around cargo!
    cv.rect(20, 15, 43, 18, col('darkwood', 2))
    cv.hline(20, 43, 15, col('darkwood', 1))
    cv.hline(20, 43, 16, col('wood', 2))
    cv.hline(20, 43, 17, col('darkwood', 3))

    # --- CARGO BOXES IN BED (every box has a clear sunlit top plane + darker vertical front!) ---
    # Box 1: tall cardboard shipping crate (x=21..29, top plane y=9..11, front face y=12..17)
    cv.outline_box(21, 8, 29, 17, col('cedar', 3), col('wood', 0))
    cv.rect(22, 9, 28, 12, col('cedar', 6))       # sunlit 3px top plane!
    cv.hline(22, 28, 11, col('cedar', 5))
    cv.hline(23, 27, 10, col('cream', 5))         # packing tape across sunlit lid
    cv.hline(22, 28, 12, col('wood', 2))          # crisp top-to-front crease
    cv.rect(22, 13, 28, 17, col('cedar', 3))      # shaded front face
    cv.vline(27, 13, 17, col('cedar', 2))

    # Box 2: open-top green produce crate (x=30..37, sunlit top y=11..13, front face y=14..17)
    cv.outline_box(30, 10, 37, 17, col('green', 2), col('green', 0))
    cv.rect(31, 11, 36, 14, col('green', 5))      # sunlit top opening rim
    cv.p(32, 11, col('orange', 5))
    cv.p(33, 12, col('yellow', 5))
    cv.p(34, 11, col('orange', 4))
    cv.p(35, 12, col('orange', 5))
    cv.hline(31, 36, 13, col('green', 4))
    cv.hline(31, 36, 14, col('green', 1))         # top-to-front lip
    cv.rect(31, 15, 36, 17, col('green', 3))      # shaded slatted front
    cv.hline(31, 36, 16, col('green', 2))

    # Box 3: blue delivery tote (x=38..43, sunlit top plane y=12..13, front face y=14..17)
    cv.outline_box(38, 11, 43, 17, col('blue', 2), col('blue', 0))
    cv.rect(39, 12, 42, 14, col('blue', 5))       # sunlit 2px lid top plane
    cv.hline(39, 42, 12, col('glass', 6))         # crisp lid edge glint
    cv.hline(39, 42, 14, col('blue', 1))          # lid lip seam
    cv.rect(39, 15, 42, 17, col('blue', 3))       # shaded front face

    # Leave visible dark-wood bed strip directly behind the near drop-gate lip at y=17!
    cv.hline(20, 43, 17, col('darkwood', 2))
    cv.p(29, 16, col('wood', 1))
    cv.p(37, 16, col('wood', 1))

    # Near white steel drop-gate (y=18..23) with crisp sunlit top lip separating from dark-wood bed
    cv.outline_box(19, 18, 44, 23, col('white', 4), col('steel', 1),
                   top_hi=col('white', 6), bot_sh=col('coolwhite', 2))
    cv.hline(20, 43, 18, col('white', 6))         # bright sunlit top lip of near side-gate
    cv.hline(20, 43, 19, col('steel', 3))         # inner hinge bevel
    for px in (20, 28, 36, 43):
        cv.vline(px, 18, 22, col('steel', 3))
    cv.vline(31, 19, 22, col('steel', 2))
    cv.rect(42, 20, 44, 22, col('red', 4))

    # --- WHITE CAB WITH 4PX SUNLIT ROOF PLANE (y=4..7) & FRONT NOSE WRAP ---
    # Rear steel headache/guard rack behind cab
    cv.vline(19, 5, 18, col('steel', 3))
    cv.vline(20, 6, 17, col('steel', 1))
    cv.hline(19, 21, 6, col('steel', 5))

    # 4px sunlit white cab roof plane (y=4..7 + far border y=3 + drip rail y=8)
    cv.hline(8, 19, 3, col('steel', 1))
    cv.p(7, 4, col('steel', 1))
    cv.vline(6, 5, 8, col('steel', 1))
    cv.vline(19, 4, 9, col('steel', 1))
    cv.hline(8, 19, 4, col('white', 6))
    cv.hline(7, 19, 5, col('white', 6))
    cv.hline(7, 19, 6, col('white', 5))
    cv.hline(7, 19, 7, col('coolwhite', 4))
    cv.hline(6, 20, 8, col('steel', 2))           # roof drip-rail crease

    # Cab lower body & front-left 3/4 nose wrap (x=4..20, y=9..25)
    cv.outline_box(4, 9, 20, 25, col('white', 4), col('steel', 1),
                   top_hi=col('white', 5), bot_sh=col('coolwhite', 2))
    cv.clear(4, 9, 6, 11)
    cv.p(5, 9, col('steel', 1))
    cv.p(4, 10, col('steel', 1))
    # Foreshortened 3/4 front windshield (x=5..9, y=9..15)
    for idx, y in enumerate(range(9, 16)):
        lx = 6 - (1 if idx >= 2 else 0)
        cv.p(lx - 1, y, col('steel', 1))
        for x in range(lx, 10):
            if idx == 0:
                cv.p(x, y, col('glass', 0))
            elif (x - lx + idx) == 2:
                cv.p(x, y, col('white', 6) if idx <= 2 else col('glass', 6))
            elif (x - lx + idx) == 3:
                cv.p(x, y, col('glass', 5))
            else:
                cv.p(x, y, col('glass', 2 if idx >= 4 else 3))
    # Cab side window (x=11..18, y=10..15)
    cv.rect(10, 9, 19, 16, col('steel', 1))
    draw_car_window_glass(cv, 11, 10, 18, 15, tint='glass')
    # Side mirror
    cv.rect(8, 13, 10, 16, col('asphalt', 1))
    cv.p(8, 14, col('steel', 4))

    # Slight front cab nose/grille/headlight wrap (x=4..9, y=16..24)
    cv.hline(5, 19, 16, col('white', 6))          # sunlit brow below windshield
    cv.vline(9, 16, 24, col('coolwhite', 3))      # front-left corner bevel crease!
    cv.vline(10, 16, 24, col('steel', 3))         # door shut line
    cv.hline(15, 18, 18, col('steel', 2))         # door handle
    cv.rect(4, 17, 7, 20, col('yellow', 5))       # wrapped front-left headlight
    cv.p(5, 18, col('white', 6))
    cv.p(4, 19, col('orange', 4))
    cv.hline(4, 7, 21, col('steel', 2))           # front nose grille slit
    cv.rect(4, 22, 9, 25, col('asphalt', 2))      # wrapped front bumper
    cv.hline(4, 9, 22, col('steel', 4))

    draw_ellipse(cv, 11, 25, 4.2, 4.0, col('ink', 0))
    draw_ellipse(cv, 36, 25, 4.2, 4.0, col('ink', 0))
    draw_wheel(cv, 11, 26, r=3, rim_c=col('steel', 4), hub_c=col('white', 5))
    draw_wheel(cv, 36, 26, r=3, rim_c=col('steel', 4), hub_c=col('white', 5))


def make_city_taxi_side(cv):
    """13. mf-obj-city_taxi_side (48x32) — Bright yellow city taxi in true top-3/4 + centered roof TAXI lantern."""
    draw_shadow_bar(cv, 3, 25, 45, 31)

    # Lower side body (y=17..26)
    cv.outline_box(4, 17, 44, 26, col('orange', 4), col('orange', 0),
                   top_hi=col('yellow', 4), bot_sh=col('orange', 2))
    cv.clear(4, 17, 5, 18)
    cv.p(5, 17, col('orange', 0))

    # Visible 3px sunlit yellow HOOD top plane (y=14..16) + 2px TRUNK top plane (y=15..16)
    cv.hline(7, 15, 13, col('orange', 0))
    cv.p(6, 14, col('orange', 0))
    cv.p(5, 15, col('orange', 0))
    cv.p(5, 16, col('orange', 0))
    cv.hline(7, 15, 14, col('yellow', 5))
    cv.hline(6, 15, 15, col('yellow', 5))
    cv.hline(6, 15, 16, col('yellow', 4))
    # 2px sunlit yellow TRUNK top plane (y=15..16)
    cv.hline(36, 42, 14, col('orange', 0))
    cv.p(43, 15, col('orange', 0))
    cv.hline(36, 43, 15, col('yellow', 5))
    cv.hline(36, 43, 16, col('yellow', 4))

    # 5px sunlit yellow ROOF plane (y=4..8) with far border y=3 & near crease y=9..10
    cv.hline(18, 36, 3, col('orange', 0))
    cv.p(17, 4, col('orange', 0))
    cv.p(36, 4, col('orange', 0))
    cv.vline(16, 5, 10, col('orange', 0))
    cv.vline(37, 5, 10, col('orange', 0))
    cv.hline(18, 36, 4, col('yellow', 5))         # sunlit yellow roof visible BEHIND lantern!
    cv.hline(17, 37, 5, col('yellow', 5))
    cv.hline(17, 37, 6, col('yellow', 5))
    cv.hline(17, 37, 7, col('yellow', 4))
    cv.hline(17, 37, 8, col('yellow', 4))
    cv.hline(17, 37, 9, col('orange', 4))
    cv.hline(16, 38, 10, col('orange', 0))

    # TAXI roof lantern seated CENTRALLY ON the roof surface (roof visible behind & in front + 1px shadow!)
    cv.hline(24, 31, 8, col('orange', 2))         # 1px cast shadow below lantern on roof!
    cv.vline(30, 6, 9, col('orange', 2))          # 1px cast shadow right of lantern!
    cv.hline(23, 29, 5, col('white', 6))          # bright sunlit top cap of lantern
    cv.p(22, 5, col('orange', 1))
    cv.p(29, 5, col('orange', 1))
    cv.p(22, 6, col('orange', 1))
    cv.p(29, 6, col('orange', 1))
    cv.hline(23, 29, 6, col('yellow', 5))         # glowing TAXI lantern face
    cv.p(24, 6, col('ink', 0))
    cv.p(26, 6, col('ink', 0))
    cv.p(28, 6, col('ink', 0))
    cv.hline(22, 30, 7, col('orange', 1))         # lantern base outline sitting on roof

    # Angled 3/4 front windshield & rear glass with crisp cyan specular glints
    draw_sloped_windshield(cv, 16, 7, 15, width=5, border_col=col('orange', 0), slope=0.62)
    for row_i, y in enumerate(range(9, 16)):
        rx = 36 + (row_i // 2)
        cv.p(rx, y, col('glass', 5) if row_i in (1, 2) else col('glass', 2))
        cv.p(rx + 1, y, col('orange', 0))

    # Side greenhouse windows (y=11..15) with crisp cyan-white glints
    cv.rect(18, 10, 36, 17, col('orange', 0))
    draw_car_window_glass(cv, 19, 11, 26, 16, tint='glass')
    draw_car_window_glass(cv, 27, 11, 35, 16, tint='glass')
    cv.vline(26, 10, 17, col('asphalt', 0))
    cv.rect(16, 14, 19, 16, col('orange', 3))
    cv.p(16, 14, col('orange', 0))

    # Classic black-and-white checkered taxi stripe & body trim
    cv.hline(6, 43, 17, col('yellow', 4))
    for x in range(13, 39):
        if x % 2 == 0:
            cv.p(x, 20, col('asphalt', 0))
            cv.p(x, 21, col('white', 6))
        else:
            cv.p(x, 20, col('white', 6))
            cv.p(x, 21, col('asphalt', 0))
    cv.vline(26, 17, 25, col('orange', 2))
    cv.hline(23, 25, 18, col('steel', 5))
    cv.hline(32, 34, 18, col('steel', 5))

    # Wrapped front headlight, bumper & rear taillight
    cv.rect(4, 18, 7, 21, col('yellow', 5))
    cv.p(5, 19, col('white', 6))
    cv.rect(4, 22, 8, 25, col('asphalt', 1))
    cv.hline(4, 8, 22, col('steel', 3))
    cv.rect(41, 18, 44, 21, col('red', 4))
    cv.p(42, 18, col('red', 5))
    cv.rect(40, 22, 44, 25, col('asphalt', 1))

    draw_ellipse(cv, 12, 25, 4.5, 4.2, col('ink', 0))
    draw_ellipse(cv, 35, 25, 4.5, 4.2, col('ink', 0))
    draw_wheel(cv, 12, 26, r=3, rim_c=col('steel', 4), hub_c=col('steel', 6))
    draw_wheel(cv, 35, 26, r=3, rim_c=col('steel', 4), hub_c=col('steel', 6))


def make_delivery_scooter(cv):
    """14. mf-obj-delivery_scooter (32x16) — Crisp urban delivery scooter with 3px sunlit box lid & clean round wheels."""
    # Lighter, detached ground shadow so dark tires stay crisp & separated!
    draw_ellipse(cv, 16.0, 14.4, 10.5, 1.2, col('pavement', 1))
    cv.hline(10, 22, 14, col('ink', 2))
    cv.hline(12, 20, 15, col('ink', 2))

    # Clean separated round front & rear wheels (bright silver hub + crisp dark tire!)
    draw_scooter_wheel(cv, 9, 12)
    draw_scooter_wheel(cv, 23, 12)

    # Rear mudguard, exhaust & sturdy steel carrier rack
    cv.hline(21, 26, 9, col('red', 4))
    cv.hline(20, 26, 10, col('steel', 3))
    cv.p(27, 9, col('red', 5))                    # crisp rear taillight
    cv.p(27, 10, col('red', 1))
    cv.hline(18, 21, 12, col('steel', 4))         # compact silver muffler

    # White delivery box with DISTINCT 3px sunlit top lid plane (y=2..4) + seam (y=5) + body (y=6..9)
    cv.hline(19, 28, 1, col('steel', 1))          # far top outline
    cv.vline(18, 2, 10, col('steel', 1))
    cv.vline(28, 2, 10, col('steel', 1))
    cv.hline(19, 28, 9, col('steel', 1))
    # Distinct 3px sunlit top lid plane (y=2, 3, 4)
    cv.hline(19, 28, 2, col('white', 6))
    cv.hline(19, 28, 3, col('white', 6))
    cv.hline(19, 28, 4, col('white', 5))
    cv.p(27, 4, col('coolwhite', 4))
    # Crisp overhang lid seam separating top plane from vertical box face
    cv.hline(19, 28, 5, col('steel', 2))
    # Vertical box side with bright red delivery stripe
    cv.rect(19, 6, 28, 9, col('white', 4))
    cv.hline(19, 28, 7, col('red', 4))
    cv.hline(19, 28, 8, col('red', 3))
    cv.p(22, 7, col('white', 6))
    cv.p(24, 7, col('white', 6))

    # Step-through floorboard & rear red fairing (leaving clean open step-through space x=11..13!)
    cv.hline(11, 18, 11, col('asphalt', 1))
    cv.hline(11, 20, 12, col('red', 2))
    cv.rect(15, 9, 21, 12, col('red', 3))
    cv.hline(16, 20, 9, col('red', 4))
    cv.hline(16, 20, 11, col('red', 1))
    # Padded black saddle
    cv.hline(14, 19, 7, col('asphalt', 3))
    cv.hline(14, 19, 8, col('asphalt', 1))
    cv.p(13, 8, col('asphalt', 0))
    cv.p(19, 8, col('asphalt', 0))

    # Readable red front leg shield + front fender over wheel
    cv.hline(7, 11, 9, col('red', 5))             # curved front fender over tire
    cv.p(6, 10, col('red', 1))
    cv.rect(8, 5, 12, 11, col('red', 3))
    cv.vline(8, 5, 10, col('red', 0))
    cv.vline(9, 5, 10, col('red', 5))             # sunlit front curve of red leg shield
    cv.vline(10, 5, 11, col('red', 4))
    cv.vline(11, 7, 11, col('cream', 5))          # clean inner leg-shield trim
    cv.hline(9, 12, 11, col('red', 1))

    # Clear glowing headlight + crisp 3/4 handlebar pair
    cv.p(6, 5, col('white', 6))
    cv.p(7, 5, col('yellow', 5))
    cv.p(7, 6, col('orange', 4))
    cv.p(8, 5, col('steel', 2))
    # Handlebar stem + far-left & near-right grips
    cv.p(10, 4, col('steel', 5))
    cv.p(10, 5, col('steel', 4))
    cv.p(8, 3, col('asphalt', 0))                 # far handlebar grip
    cv.p(9, 3, col('steel', 5))                   # chrome bar
    cv.p(10, 3, col('steel', 6))
    cv.p(11, 4, col('steel', 5))
    cv.p(12, 4, col('asphalt', 0))                # near handlebar grip
    cv.p(13, 4, col('asphalt', 1))
    cv.p(11, 2, col('steel', 5))                  # crisp little mirror stalk


def _draw_fable_rack_bike(cv, ox, frame_ramp, basket=True):
    """Delicate, airy Fable bicycle (matching jitensha / house-eave) for bike_rack_4."""
    # Two distinct, separated 5x5 hollow round wheels with bright hub pixel (3/4 staggered 1px)
    fx, fy = ox + 2, 11
    rx, ry = ox + 8, 10
    draw_hollow_bike_wheel(cv, fx, fy, radius=2)
    draw_hollow_bike_wheel(cv, rx, ry, radius=2)

    # Strictly 1px airy diamond frame (NO muddy doubled lines!)
    f_hi = col(frame_ramp, 4)
    f_lo = col(frame_ramp, 3)
    # Front fork & head tube
    cv.p(fx, fy - 1, col('steel', 5))
    cv.p(fx + 1, fy - 2, col('steel', 5))
    cv.p(fx + 1, fy - 3, f_hi)
    cv.p(fx + 1, fy - 4, f_hi)
    cv.p(fx + 1, fy - 5, f_hi)
    # 1px top tube & diagonal down tube to crank
    cv.hline(fx + 1, ox + 7, 6, f_hi)
    draw_line(cv, fx + 2, 7, ox + 5, 10, f_lo)
    # 1px seat tube, chainstay & seatstay
    draw_line(cv, ox + 5, 10, ox + 7, 5, f_hi)
    cv.hline(ox + 5, rx, 10, f_lo)
    cv.p(ox + 7, 8, f_lo)
    cv.p(ox + 8, 9, f_lo)
    # Silver crank dot
    cv.p(ox + 5, 10, col('steel', 5))

    # Thin handlebar & stem
    cv.p(fx + 1, 5, col('steel', 5))
    cv.p(fx + 1, 4, col('steel', 6))
    cv.p(fx, 4, col('asphalt', 0))
    cv.p(fx + 2, 4, col('asphalt', 0))

    # Thin brown saddle (3x1px)
    cv.p(ox + 7, 5, col('steel', 4))
    cv.hline(ox + 6, ox + 9, 4, col('wood', 4))
    cv.p(ox + 7, 4, col('cedar', 5))

    # Compact airy cedar basket
    if basket:
        cv.rect(ox - 1, 6, ox + 2, 9, col('cedar', 4))
        cv.hline(ox - 1, ox + 2, 6, col('cedar', 6))
        cv.p(ox, 7, col('wood', 2))
        cv.hline(ox - 1, ox + 2, 8, col('wood', 2))


def make_bike_rack_4(cv):
    """15. mf-obj-bike_rack_4 (48x16) — Shaded concrete pad, 3/4 angled steel U-hoops & 3 crisp Fable bikes."""
    # Ground shadow below concrete pad
    draw_shadow_bar(cv, 1, 14, 47, 16)
    # Shaded top-3/4 concrete pad (y=10..14)
    cv.outline_box(2, 10, 46, 15, col('concrete', 4), col('concrete', 1),
                   top_hi=col('concrete', 5), bot_sh=col('concrete', 2))
    cv.hline(3, 45, 14, col('concrete', 1))
    # Subtle concrete expansion joints & soft bike/hoop shadows on pad
    for jx in (13, 25, 36):
        cv.vline(jx, 11, 14, col('concrete', 3))
    for sx0, sx1 in ((3, 12), (15, 24), (27, 36)):
        cv.hline(sx0, sx1, 13, col('concrete', 2))
        cv.hline(sx0 + 1, sx1, 12, col('concrete', 3))

    # 4 clean steel U-hoops angled slightly in 3/4 depth (rear leg y=4..11, front leg y=5..13)
    def _draw_u_hoop(hx):
        # Soft cast shadow on concrete pad
        cv.hline(hx + 1, hx + 8, 12, col('concrete', 2))
        # Rear leg (rooted further back at y=11)
        cv.vline(hx, 4, 12, col('steel', 2))
        cv.vline(hx + 1, 4, 11, col('steel', 5))
        # Angled 3/4 top arch bar (peeking cleanly above bike saddles/bars!)
        cv.hline(hx + 1, hx + 6, 3, col('steel', 6))
        cv.hline(hx + 2, hx + 7, 4, col('steel', 3))
        # Front leg (rooted further forward at y=13)
        cv.vline(hx + 6, 4, 13, col('steel', 5))
        cv.vline(hx + 7, 5, 13, col('steel', 2))
        cv.p(hx + 6, 13, col('steel', 1))

    for hx in (4, 16, 28, 38):
        _draw_u_hoop(hx)

    # 3 crisp, airy Fable bicycles in bays 1..3 (bay 4 left empty to show steel U-hoop clearly!)
    _draw_fable_rack_bike(cv, 3, 'teal', basket=True)
    _draw_fable_rack_bike(cv, 15, 'red', basket=True)
    _draw_fable_rack_bike(cv, 27, 'blue', basket=False)

    # Re-glint the front steel U-hoop leg on bay 4 so the empty hoop shines crisply
    cv.hline(39, 44, 3, col('white', 5))
    cv.vline(44, 4, 13, col('steel', 6))
    cv.vline(45, 5, 13, col('steel', 2))


def make_parked_bicycle(cv):
    """16. mf-obj-parked_bicycle (32x16) — Crisp, airy jitensha-style Fable city bike + basket & detached shadow."""
    # Soft detached elliptical ground shadow (lighter & narrower so dark wheels pop cleanly!)
    draw_ellipse(cv, 16.0, 14.5, 9.8, 1.1, col('pavement', 1))
    cv.hline(10, 22, 14, col('ink', 2))
    cv.hline(12, 20, 15, col('ink', 2))

    # Clean 1px dark-slate 7x7 circular wheels with hollow interior + light spokes/hubs (jitensha style!)
    draw_hollow_bike_wheel(cv, 9, 11, radius=3, tire_c=col('asphalt', 0),
                           hub_c=col('steel', 6), spoke_c=col('steel', 4))
    draw_hollow_bike_wheel(cv, 23, 11, radius=3, tire_c=col('asphalt', 0),
                           hub_c=col('steel', 6), spoke_c=col('steel', 4))

    # Crisp thin 1px diagonal frame tubes (teal commuter frame, airy open triangle!)
    # Front fork (silver lower blade -> teal upper head tube)
    draw_line(cv, 9, 11, 10, 8, col('steel', 5))
    cv.p(10, 7, col('teal', 4))
    cv.p(11, 6, col('teal', 5))
    cv.p(11, 5, col('teal', 4))
    # Horizontal top bar + crisp 1px diagonal down tube
    cv.hline(11, 19, 6, col('teal', 5))
    draw_line(cv, 11, 7, 16, 11, col('teal', 4))
    # 1px seat tube, chainstay & rear seatstay
    draw_line(cv, 16, 11, 18, 5, col('teal', 4))
    cv.hline(16, 23, 11, col('teal', 3))
    draw_line(cv, 18, 6, 23, 11, col('teal', 3))
    # Crank hub, tiny pedal & sleek kickstand
    cv.p(16, 11, col('steel', 5))
    cv.p(16, 12, col('asphalt', 1))
    cv.p(19, 12, col('steel', 3))
    cv.p(18, 13, col('steel', 2))

    # Minimalist rear steel carrier rail & tiny red reflector
    cv.hline(20, 26, 7, col('steel', 4))
    cv.p(25, 8, col('red', 4))

    # Uncluttered brown leather saddle (like jitensha: thin 4x2 profile)
    cv.p(18, 4, col('steel', 5))
    cv.hline(16, 21, 3, col('cedar', 4))
    cv.hline(17, 20, 3, col('cedar', 5))
    cv.hline(17, 20, 4, col('wood', 2))

    # Clean swept handlebars + silver bell
    cv.p(11, 4, col('steel', 5))
    cv.hline(10, 14, 3, col('steel', 5))
    cv.p(10, 3, col('asphalt', 0))
    cv.p(13, 3, col('asphalt', 0))
    cv.p(11, 2, col('white', 5))

    # Uncluttered sunlit cedar/wicker front basket (5x4px, jitensha construction!)
    cv.rect(6, 4, 11, 8, col('cedar', 4))
    cv.hline(6, 11, 4, col('cedar', 6))           # sunlit top rim
    cv.hline(7, 10, 5, col('wood', 2))            # hollow dark interior opening
    cv.hline(6, 11, 7, col('wood', 3))
    cv.p(10, 6, col('wood', 1))                   # subtle right side shade


def make_city_bus_side(cv):
    """17. mf-obj-city_bus_side (80x32) — Low-floor city bus in true top-3/4 with 6px sunlit roof, inset AC & 3/4 nose wrap."""
    draw_shadow_bar(cv, 2, 26, 78, 31)

    # --- 6PX SUNLIT WHITE/SILVER 3/4 ROOF PLANE (y=2..9, interior y=3..8!) ---
    cv.hline(9, 76, 2, col('steel', 1))           # far/north roof edge
    cv.p(8, 3, col('steel', 1))
    cv.p(7, 4, col('steel', 1))
    cv.vline(6, 5, 9, col('steel', 1))
    cv.vline(76, 3, 9, col('steel', 1))
    # Sunlit white/silver top roof deck running full bus length (y=3..8 = 6px!)
    cv.hline(9, 76, 3, col('white', 6))
    cv.hline(8, 76, 4, col('white', 6))
    cv.hline(7, 76, 5, col('white', 5))
    cv.hline(7, 76, 6, col('coolwhite', 5))
    cv.hline(7, 76, 7, col('coolwhite', 4))
    cv.hline(7, 76, 8, col('coolwhite', 3))
    # Subtle roof panel ribs across deck
    for rx in (19, 34, 54, 68):
        cv.vline(rx, 3, 9, col('coolwhite', 3))
    # Crisp roof gutter/drip-rail separating roof plane from vertical bus wall
    cv.hline(6, 77, 9, col('steel', 2))

    # Rooftop AC box SEATED INSIDE the roof plane (y=3 white roof behind, y=4..6 AC box, y=7 shadow, y=8 roof in front!)
    cv.hline(26, 51, 7, col('steel', 3))          # 1px cast shadow onto sunlit roof!
    cv.vline(50, 5, 8, col('steel', 3))           # right-edge 1px cast shadow!
    cv.hline(25, 50, 4, col('steel', 2))          # AC far border (leaves y=3 roof strip visible behind!)
    cv.vline(25, 4, 7, col('steel', 2))
    cv.vline(49, 4, 7, col('steel', 1))
    cv.hline(26, 49, 4, col('white', 6))          # AC own sunlit top surface!
    cv.hline(26, 49, 5, col('coolwhite', 5))
    # Twin recessed rooftop AC fan vents on top surface
    for fx0 in (29, 40):
        cv.rect(fx0, 4, fx0 + 6, 6, col('coolwhite', 3))
        cv.p(fx0 + 1, 4, col('steel', 2))
        cv.p(fx0 + 3, 4, col('steel', 2))
        cv.p(fx0 + 4, 5, col('steel', 2))
    # AC vertical front face (y=6)
    cv.hline(26, 49, 6, col('coolwhite', 3))
    for vx in range(28, 48, 4):
        cv.p(vx, 6, col('steel', 1))

    # Rear roof hatch seated inside roof plane (x=58..67, y=4..6 + 1px shadow y=7)
    cv.hline(59, 68, 7, col('steel', 3))
    cv.p(67, 5, col('steel', 3))
    cv.p(67, 6, col('steel', 3))
    cv.rect(58, 4, 67, 6, col('white', 6))
    cv.hline(58, 67, 4, col('steel', 2))
    cv.hline(58, 67, 6, col('coolwhite', 3))

    # --- MAIN BUS VERTICAL BODY (x=3..77, y=9..27; window band lowered 3px to y=13..19!) ---
    cv.outline_box(3, 9, 77, 27, col('blue', 3), col('navy', 0),
                   top_hi=col('blue', 4), bot_sh=col('blue', 1))
    # Aerodynamic 3/4 front brow bevel on top-left corner
    cv.clear(3, 9, 6, 11)
    cv.p(5, 9, col('navy', 0))
    cv.p(4, 10, col('navy', 0))
    cv.p(3, 11, col('navy', 0))

    # Upper white fascia (y=10..19) + lower blue transit skirt (y=20..26)
    cv.rect(5, 10, 76, 20, col('white', 4))
    cv.hline(6, 76, 10, col('coolwhite', 3))      # crisp 1px eave shadow under roof lip
    cv.hline(6, 76, 11, col('white', 6))
    cv.rect(4, 20, 76, 26, col('blue', 3))
    cv.hline(4, 76, 20, col('blue', 5))
    cv.hline(4, 76, 22, col('white', 5))          # clean white livery pinstripe
    cv.hline(4, 76, 25, col('blue', 1))

    # --- FORESHORTENED 3/4 FRONT WINDSHIELD WRAP ON LEFT NOSE (x=4..10, y=10..19) ---
    for i, y in enumerate(range(10, 20)):
        lx = 5 if i <= 1 else 4
        cv.p(lx - 1, y, col('navy', 0))
        for x in range(lx, 11):
            if i <= 2:
                # Upper dark destination LED header wrapping front-left brow
                cv.p(x, y, col('asphalt', 0))
            elif x == lx:
                # Slight vertical center-front nose wrap edge
                cv.p(x, y, col('glass', 3))
            elif (x - lx + i) == 5:
                cv.p(x, y, col('white', 6) if i <= 5 else col('glass', 6))
            elif (x - lx + i) == 6:
                cv.p(x, y, col('glass', 5))
            else:
                cv.p(x, y, col('glass', 2 if i >= 7 else 3))
    # Amber front destination LED strip
    for lx, lc in ((5, col('orange', 5)), (6, col('yellow', 5)), (7, col('orange', 5)),
                   (8, col('yellow', 5)), (9, col('orange', 5))):
        cv.p(lx, 11, lc)
    # Extended front side mirror on dark stalk
    cv.hline(2, 5, 14, col('steel', 1))
    cv.rect(2, 14, 4, 18, col('asphalt', 1))
    cv.p(2, 15, col('steel', 4))

    # --- FOLDING DOORS & LOWERED PANORAMIC SIDE WINDOWS (y=13..19) ---
    cv.outline_box(12, 12, 20, 26, col('steel', 1), col('navy', 0))
    draw_car_window_glass(cv, 13, 13, 16, 22, tint='glass')
    draw_car_window_glass(cv, 17, 13, 19, 22, tint='glass', bright_glare=False)
    cv.vline(16, 13, 25, col('steel', 2))

    cv.outline_box(42, 12, 51, 26, col('steel', 1), col('navy', 0))
    draw_car_window_glass(cv, 43, 13, 46, 22, tint='glass')
    draw_car_window_glass(cv, 47, 13, 50, 22, tint='glass', bright_glare=False)
    cv.vline(46, 13, 25, col('steel', 2))

    for wx0, wx1 in ((21, 31), (32, 41), (52, 63), (64, 75)):
        cv.outline_box(wx0, 12, wx1, 20, col('glass', 1), col('asphalt', 0))
        draw_car_window_glass(cv, wx0 + 1, 13, wx1 - 1, 19, tint='glass')
        for sx in range(wx0 + 2, wx1 - 2, 3):
            cv.p(sx, 18, col('navy', 1))

    # Side route LED strip tucked neatly in upper white fascia
    cv.rect(22, 10, 29, 12, col('asphalt', 0))
    cv.p(23, 11, col('orange', 5))
    cv.p(25, 11, col('yellow', 5))
    cv.p(27, 11, col('orange', 5))

    # Front nose wrapped headlight, bumper & rear taillight
    cv.rect(3, 21, 6, 23, col('yellow', 5))
    cv.p(4, 21, col('white', 6))
    cv.rect(3, 24, 9, 26, col('asphalt', 1))
    cv.rect(74, 21, 77, 24, col('red', 4))
    cv.p(75, 21, col('red', 5))

    for wx in (21, 60):
        draw_ellipse(cv, wx, 26, 4.8, 4.4, col('ink', 0))
        draw_wheel(cv, wx, 27, r=3, rim_c=col('steel', 4), hub_c=col('steel', 6))


def make_police_car_side(cv):
    """18. mf-obj-police_car_side (48x32) — Patrol cruiser in true top-3/4 + inset lightbar & cool-lit navy hood."""
    draw_shadow_bar(cv, 3, 25, 45, 31)

    # Lower dark-navy/black patrol body (y=17..26)
    cv.outline_box(4, 17, 44, 26, col('navy', 0), col('ink', 0),
                   top_hi=col('navy', 2), bot_sh=col('asphalt', 0))
    cv.clear(4, 17, 5, 18)
    cv.p(5, 17, col('ink', 0))

    # 3px dark-navy/black HOOD top plane (y=14..16) with cool highlight + 2px TRUNK top plane (y=15..16)
    cv.hline(7, 15, 13, col('ink', 0))
    cv.p(6, 14, col('ink', 0))
    cv.p(5, 15, col('ink', 0))
    cv.p(5, 16, col('ink', 0))
    cv.hline(7, 15, 14, col('navy', 2))           # cool sunlit navy highlight on top hood edge
    cv.hline(8, 13, 14, col('steel', 3))          # cool specular sheen on hood
    cv.hline(6, 15, 15, col('navy', 1))
    cv.p(7, 15, col('navy', 2))
    cv.hline(6, 15, 16, col('asphalt', 1))
    # 2px dark-navy/black TRUNK top plane (y=15..16)
    cv.hline(36, 42, 14, col('ink', 0))
    cv.p(43, 15, col('ink', 0))
    cv.hline(36, 43, 15, col('navy', 2))
    cv.hline(38, 41, 15, col('steel', 3))
    cv.hline(36, 43, 16, col('navy', 1))

    # White patrol doors + blue stripe + gold patrol badge + micro POLICE marks
    cv.rect(16, 17, 36, 25, col('white', 4))
    cv.hline(16, 36, 17, col('white', 6))
    cv.hline(16, 36, 24, col('coolwhite', 2))
    cv.vline(26, 17, 25, col('steel', 3))
    cv.hline(16, 36, 21, col('blue', 3))
    cv.hline(16, 36, 22, col('blue', 2))
    cv.rect(20, 18, 24, 21, col('yellow', 4))
    cv.p(21, 19, col('yellow', 5))
    cv.p(22, 19, col('blue', 3))
    for wx in (28, 30, 32, 34):
        cv.p(wx, 19, col('navy', 1))

    # 5px sunlit white ROOF plane (y=4..8) with far border y=3 & near crease y=9..10
    cv.hline(18, 36, 3, col('steel', 1))
    cv.p(17, 4, col('steel', 1))
    cv.p(36, 4, col('steel', 1))
    cv.vline(16, 5, 10, col('steel', 1))
    cv.vline(37, 5, 10, col('steel', 1))
    cv.hline(18, 36, 4, col('white', 6))          # sunlit white roof visible BEHIND lightbar!
    cv.hline(17, 37, 5, col('white', 6))
    cv.hline(17, 37, 6, col('white', 6))
    cv.hline(17, 37, 7, col('white', 5))
    cv.hline(17, 37, 8, col('white', 5))
    cv.hline(17, 37, 9, col('coolwhite', 4))
    cv.hline(16, 38, 10, col('ink', 0))

    # Red/blue lightbar seated ACROSS the roof plane (roof visible behind & in front + 1px shadow!)
    cv.hline(23, 32, 8, col('coolwhite', 2))      # 1px cast shadow below lightbar onto white roof!
    cv.vline(31, 6, 9, col('coolwhite', 2))       # 1px cast shadow to right!
    cv.p(22, 5, col('ink', 0))
    cv.p(22, 6, col('ink', 0))
    cv.p(30, 5, col('ink', 0))
    cv.p(30, 6, col('ink', 0))
    cv.hline(22, 31, 7, col('ink', 0))            # lightbar base frame seated on roof
    # Red left pod + white center pod + blue right pod
    cv.rect(23, 5, 26, 7, col('red', 3))
    cv.hline(23, 26, 5, col('red', 5))
    cv.p(23, 5, col('white', 6))
    cv.rect(26, 5, 27, 7, col('white', 6))
    cv.p(26, 6, col('steel', 4))
    cv.rect(27, 5, 30, 7, col('blue', 3))
    cv.hline(27, 30, 5, col('blue', 5))
    cv.p(29, 5, col('white', 6))

    # Angled 3/4 front windshield & rear glass with crisp diagonal speculars
    draw_sloped_windshield(cv, 16, 7, 15, width=5, border_col=col('ink', 0), slope=0.62)
    for row_i, y in enumerate(range(9, 16)):
        rx = 36 + (row_i // 2)
        cv.p(rx, y, col('glass', 5) if row_i in (1, 2) else col('glass', 2))
        cv.p(rx + 1, y, col('ink', 0))

    # Side greenhouse windows (y=11..15) with crisp diagonal glass speculars
    cv.rect(18, 10, 36, 17, col('ink', 0))
    draw_car_window_glass(cv, 19, 11, 26, 16, tint='glass')
    draw_car_window_glass(cv, 27, 11, 35, 16, tint='glass')
    cv.vline(26, 10, 17, col('asphalt', 0))
    cv.rect(16, 14, 19, 16, col('asphalt', 1))

    # Front push-bumper, wrapped headlight & rear taillight
    cv.vline(3, 18, 25, col('steel', 3))
    cv.p(3, 18, col('steel', 5))
    cv.rect(4, 18, 7, 21, col('yellow', 5))
    cv.p(5, 19, col('white', 6))
    cv.rect(41, 18, 44, 21, col('red', 4))
    cv.p(42, 18, col('red', 5))

    draw_ellipse(cv, 12, 25, 4.5, 4.2, col('ink', 0))
    draw_ellipse(cv, 35, 25, 4.5, 4.2, col('ink', 0))
    draw_wheel(cv, 12, 26, r=3, rim_c=col('steel', 4), hub_c=col('steel', 6))
    draw_wheel(cv, 35, 26, r=3, rim_c=col('steel', 4), hub_c=col('steel', 6))


def make_ambulance_side(cv):
    """19. mf-obj-ambulance_side (64x32) — High-roof ambulance in true RPG top-3/4 with 6px roof, inset lightbar & 4px hood."""
    draw_shadow_bar(cv, 3, 25, 61, 31)

    # --- 6PX SUNLIT WHITE ROOF PLANE (y=2..9, interior y=3..8!) ---
    cv.hline(17, 59, 2, col('steel', 1))          # far/north roof outline
    cv.p(16, 3, col('steel', 1))
    cv.p(59, 3, col('steel', 1))
    cv.vline(15, 4, 9, col('steel', 1))
    cv.vline(60, 4, 9, col('steel', 1))
    # Sunlit white top roof deck (y=3..8 = 6px tall!)
    cv.hline(17, 59, 3, col('white', 6))
    cv.hline(16, 60, 4, col('white', 6))
    cv.hline(16, 60, 5, col('white', 6))
    cv.hline(16, 60, 6, col('white', 5))
    cv.hline(16, 60, 7, col('white', 5))
    cv.hline(16, 60, 8, col('coolwhite', 4))
    # Subtle seam between cab roof and medical module roof
    cv.vline(23, 3, 9, col('coolwhite', 3))
    # Crisp roof drip-rail crease separating roof plane from vertical side walls
    cv.hline(15, 61, 9, col('steel', 2))

    # Front lightbar MOUNTED ON the roof surface (x=18..27, y=4..6 + 1px cast shadow y=7!)
    cv.hline(19, 28, 7, col('coolwhite', 2))      # 1px cast shadow onto sunlit roof!
    cv.vline(27, 5, 8, col('coolwhite', 2))       # right-side 1px cast shadow!
    cv.hline(19, 26, 3, col('steel', 1))
    cv.p(18, 4, col('steel', 1))
    cv.p(18, 5, col('steel', 1))
    cv.p(26, 4, col('steel', 1))
    cv.p(26, 5, col('steel', 1))
    cv.hline(19, 26, 6, col('steel', 1))
    cv.rect(19, 4, 22, 6, col('red', 3))
    cv.hline(19, 22, 4, col('red', 5))
    cv.p(19, 4, col('white', 6))
    cv.rect(22, 4, 24, 6, col('white', 6))
    cv.rect(24, 4, 26, 6, col('red', 3))
    cv.hline(24, 26, 4, col('red', 5))

    # Low-profile roof AC vent seated inside roof plane (x=34..47, y=4..6 + 1px shadow y=7)
    cv.hline(35, 48, 7, col('coolwhite', 2))
    cv.vline(47, 5, 8, col('coolwhite', 2))
    cv.outline_box(34, 4, 47, 7, col('coolwhite', 4), col('steel', 2), top_hi=col('white', 6))
    cv.hline(36, 45, 5, col('white', 6))

    # Rear beacon MOUNTED ON rear roof surface (x=53..57, y=4..6 + 1px cast shadow y=7!)
    cv.hline(54, 58, 7, col('coolwhite', 2))
    cv.p(57, 5, col('coolwhite', 2))
    cv.p(57, 6, col('coolwhite', 2))
    cv.outline_box(53, 4, 57, 7, col('red', 3), col('steel', 1))
    cv.hline(54, 56, 4, col('red', 5))
    cv.p(54, 4, col('white', 6))

    # --- BOXY REAR MEDICAL MODULE & VAN CAB SIDE (y=9..26) ---
    cv.outline_box(22, 9, 60, 26, col('white', 4), col('steel', 1),
                   top_hi=col('coolwhite', 3), bot_sh=col('coolwhite', 2))
    cv.hline(23, 59, 10, col('white', 5))

    # Front cab lower body (x=4..23, y=17..26)
    cv.outline_box(4, 17, 23, 26, col('white', 4), col('steel', 1),
                   top_hi=col('white', 5), bot_sh=col('coolwhite', 2))
    cv.clear(4, 17, 5, 18)
    cv.p(5, 17, col('steel', 1))

    # 3-4px visible sunlit white HOOD top plane (y=14..17) sloping into foreshortened windshield!
    cv.hline(7, 14, 13, col('steel', 1))
    cv.p(6, 14, col('steel', 1))
    cv.p(5, 15, col('steel', 1))
    cv.p(5, 16, col('steel', 1))
    cv.hline(7, 14, 14, col('white', 6))
    cv.hline(6, 14, 15, col('white', 6))
    cv.hline(6, 14, 16, col('white', 5))
    cv.hline(6, 14, 17, col('coolwhite', 3))      # crisp hood-to-fender roll crease separating top plane
    cv.hline(4, 7, 21, col('steel', 2))           # front nose grille slit

    # Foreshortened 3/4 cab front windshield & side cab window (subtle diagonal glass highlights)
    draw_sloped_windshield(cv, 16, 8, 15, width=5, border_col=col('steel', 1), slope=0.62)
    cv.p(15, 9, col('white', 5))                  # clean roof-to-A-pillar corner transition
    cv.rect(15, 10, 23, 17, col('steel', 1))
    draw_car_window_glass(cv, 16, 11, 22, 16, tint='glass')
    cv.rect(13, 14, 15, 17, col('asphalt', 1))

    # Bold crimson-red emergency stripe wrapping cab & rear cabin
    cv.rect(5, 19, 59, 22, col('red', 3))
    cv.hline(5, 59, 19, col('red', 4))
    cv.hline(5, 59, 21, col('red', 2))

    # Tinted medical cabin side window + rich crimson red cross emblem
    cv.outline_box(26, 11, 39, 18, col('glass', 1), col('steel', 1))
    draw_car_window_glass(cv, 27, 12, 38, 17, tint='glass')
    cv.rect(45, 11, 48, 18, col('red', 3))
    cv.rect(43, 13, 50, 16, col('red', 3))
    cv.p(46, 12, col('red', 4))
    cv.p(44, 14, col('red', 4))
    cv.hline(45, 48, 17, col('red', 2))
    cv.hline(43, 50, 15, col('red', 2))

    # Rear double door seam, handles, warning lights & front headlight
    cv.vline(22, 10, 25, col('steel', 3))
    cv.vline(55, 10, 25, col('steel', 3))
    cv.hline(56, 58, 17, col('steel', 2))
    cv.hline(18, 20, 18, col('steel', 2))
    cv.rect(57, 11, 60, 14, col('red', 3))
    cv.p(58, 12, col('red', 5))
    cv.rect(57, 22, 60, 25, col('asphalt', 2))
    cv.rect(4, 18, 7, 21, col('yellow', 5))
    cv.p(5, 19, col('white', 6))
    cv.rect(4, 22, 9, 25, col('asphalt', 2))

    draw_ellipse(cv, 14, 25, 4.5, 4.2, col('ink', 0))
    draw_ellipse(cv, 47, 25, 4.5, 4.2, col('ink', 0))
    draw_wheel(cv, 14, 26, r=3, rim_c=col('steel', 4), hub_c=col('steel', 6))
    draw_wheel(cv, 47, 26, r=3, rim_c=col('steel', 4), hub_c=col('steel', 6))


def make_shopping_cart_corral(cv):
    """20. mf-obj-shopping_cart_corral (48x32) — Metal cart shelter canopy + nested metallic shopping carts."""
    draw_shadow_bar(cv, 2, 26, 46, 31)

    # Concrete pad
    cv.outline_box(3, 24, 45, 29, col('concrete', 4), col('concrete', 1),
                   top_hi=col('concrete', 5), bot_sh=col('concrete', 2))
    cv.rect(5, 25, 43, 28, col('pavement', 2))

    # Rear steel posts + translucent glass back wall
    for px in (4, 23, 42):
        cv.rect(px, 11, px + 2, 27, col('steel', 2))
        cv.vline(px, 11, 27, col('steel', 4))
    for y in range(12, 24):
        for x in range(6, 42):
            if (x + y) % 6 == 0:
                cv.p(x, y, col('glass', 4))

    # Two clearly readable nested rows of metallic shopping carts with red plastic handles
    for row_y, start_x, count in ((14, 8, 4), (19, 7, 4)):
        # Under-cart shadow strip
        cv.hline(start_x + 1, start_x + count * 6 + 9, row_y + 8, col('ink', 0))
        # Lead cart wire basket nose (clearly tapered metallic wire basket!)
        cv.outline_box(start_x, row_y, start_x + 11, row_y + 6, col('steel', 3), col('steel', 0),
                       top_hi=col('coolwhite', 5))
        for mx in range(start_x + 2, start_x + 10, 2):
            cv.vline(mx, row_y + 1, row_y + 5, col('steel', 5))
        cv.hline(start_x + 1, start_x + 10, row_y + 3, col('steel', 2))
        # Nested trailing cart handles & rear frames stepped neatly to the right
        for i in range(count):
            hx = start_x + 8 + i * 6
            # Metal rear upright & child-seat flap
            cv.outline_box(hx, row_y, hx + 6, row_y + 6, col('steel', 4), col('steel', 1),
                           top_hi=col('coolwhite', 5))
            cv.vline(hx + 2, row_y + 1, row_y + 5, col('steel', 2))
            # Signature bright RED plastic push handle bar
            cv.hline(hx + 2, hx + 6, row_y, col('red', 4))
            cv.hline(hx + 2, hx + 6, row_y + 1, col('red', 5))
            cv.p(hx + 3, row_y + 2, col('red', 3))
            # Metal base bar + little caster wheel
            cv.hline(hx - 4, hx + 5, row_y + 7, col('steel', 4))
            cv.p(hx + 3, row_y + 8, col('asphalt', 0))
        cv.p(start_x + 2, row_y + 8, col('asphalt', 0))

    # Front steel guard rail & yellow/black corner safety bollards
    cv.hline(4, 44, 25, col('steel', 5))
    cv.hline(4, 44, 26, col('steel', 1))
    for bx in (3, 42):
        cv.outline_box(bx, 18, bx + 3, 29, col('yellow', 4), col('orange', 1), top_hi=col('yellow', 5))
        cv.hline(bx, bx + 3, 21, col('asphalt', 0))
        cv.hline(bx, bx + 3, 25, col('asphalt', 0))

    # Top-3/4 arched translucent blue-glass & steel canopy roof
    cv.outline_box(2, 2, 46, 12, col('glass', 4), col('steel', 0),
                   top_hi=col('glass', 6), bot_sh=col('steel', 2))
    for y in range(3, 11):
        for x in range(3, 45):
            if y == 3:
                cv.p(x, y, col('coolwhite', 5))
            elif y == 10:
                cv.p(x, y, col('steel', 3))
            elif x in (13, 24, 35):
                cv.p(x, y, col('steel', 2))
            elif x in (14, 25, 36):
                cv.p(x, y, col('steel', 5))
            elif (x + y) % 7 in (0, 1):
                cv.p(x, y, col('glass', 6))
            elif y <= 5:
                cv.p(x, y, col('glass', 5))
            else:
                cv.p(x, y, col('glass', 3))
    cv.rect(17, 9, 31, 12, col('blue', 3))
    cv.hline(17, 31, 9, col('blue', 5))
    cv.hline(19, 29, 10, col('white', 6))
    cv.p(21, 10, col('blue', 3))
    cv.p(24, 10, col('blue', 3))
    cv.p(27, 10, col('blue', 3))


# ---------------------------------------------------------------------------
# Batch registry & generator
# ---------------------------------------------------------------------------

SPECS = [
    # foliage-planters (10)
    ('mf-obj-tree_grate_spring', '봄 가로수(주철 보호판)', 'foliage-planters', 32, 48, make_tree_grate_spring, ['tree', 'foliage', 'street']),
    ('mf-obj-tree_grate_ginkgo', '가을 은행나무 가로수', 'foliage-planters', 32, 48, make_tree_grate_ginkgo, ['tree', 'foliage', 'autumn']),
    ('mf-obj-tree_cherry_blossom', '만개 벚나무(석재 화단링)', 'foliage-planters', 32, 48, make_tree_cherry_blossom, ['tree', 'foliage', 'spring']),
    ('mf-obj-sidewalk_planter', '콘크리트 가로 화분대', 'foliage-planters', 32, 16, make_sidewalk_planter, ['planter', 'flowers', 'street']),
    ('mf-obj-terracotta_trough', '테라코타 카페 화분', 'foliage-planters', 32, 16, make_terracotta_trough, ['planter', 'flowers', 'cafe']),
    ('mf-obj-boxwood_hedge', '회양목 생울타리', 'foliage-planters', 32, 16, make_boxwood_hedge, ['hedge', 'foliage', 'park']),
    ('mf-obj-bamboo_planter', '슬레이트 대나무 화분', 'foliage-planters', 16, 32, make_bamboo_planter, ['planter', 'bamboo', 'modern']),
    ('mf-obj-potted_olive', '유약 도기 올리브 화분', 'foliage-planters', 16, 32, make_potted_olive, ['planter', 'tree', 'cafe']),
    ('mf-obj-park_fountain', '광장 2단 석재 분수대', 'foliage-planters', 48, 48, make_park_fountain, ['fountain', 'water', 'plaza']),
    ('mf-obj-drinking_fountain', '공원 음수대', 'foliage-planters', 16, 16, make_drinking_fountain, ['fountain', 'park', 'water']),
    # transit-vehicles (10)
    ('mf-obj-car_compact_side', '소형 해치백 승용차', 'transit-vehicles', 48, 32, make_car_compact_side, ['vehicle', 'car', 'road']),
    ('mf-obj-kei_truck_side', '경트럭 배달 화물차', 'transit-vehicles', 48, 32, make_kei_truck_side, ['vehicle', 'truck', 'road']),
    ('mf-obj-city_taxi_side', '도심 택시', 'transit-vehicles', 48, 32, make_city_taxi_side, ['vehicle', 'taxi', 'road', 'lightAnchor']),
    ('mf-obj-delivery_scooter', '배달 스쿠터', 'transit-vehicles', 32, 16, make_delivery_scooter, ['vehicle', 'scooter', 'street']),
    ('mf-obj-bike_rack_4', '4구 자전거 거치대', 'transit-vehicles', 48, 16, make_bike_rack_4, ['vehicle', 'bicycle', 'street']),
    ('mf-obj-parked_bicycle', '생활 자전거(바구니)', 'transit-vehicles', 32, 16, make_parked_bicycle, ['vehicle', 'bicycle', 'street']),
    ('mf-obj-city_bus_side', '저상 시내버스', 'transit-vehicles', 80, 32, make_city_bus_side, ['vehicle', 'bus', 'road', 'lightAnchor']),
    ('mf-obj-police_car_side', '도심 순찰차', 'transit-vehicles', 48, 32, make_police_car_side, ['vehicle', 'police', 'road', 'lightAnchor']),
    ('mf-obj-ambulance_side', '119 구급차', 'transit-vehicles', 64, 32, make_ambulance_side, ['vehicle', 'ambulance', 'road', 'lightAnchor']),
    ('mf-obj-shopping_cart_corral', '마트 쇼핑카트 보관소', 'transit-vehicles', 48, 32, make_shopping_cart_corral, ['vehicle', 'cart', 'commercial']),
]


def build_batch():
    os.makedirs(OUT_DIR, exist_ok=True)
    items = []
    for iid, name, category, w, h, fn, tags in SPECS:
        cv = Canvas(w, h)
        fn(cv)
        out_path = os.path.join(OUT_DIR, f'{iid}.png')
        cv.save(out_path)
        entry = {
            'id': iid,
            'name': name,
            'category': category,
            'w': w // 16,
            'h': h // 16,
            'px': [w, h],
            'layer': 'object',
            'pc': 'solid',
            'tags': tags,
            'file': f'{iid}.png',
        }
        if 'lightAnchor' in tags:
            entry['lightAnchor'] = True
        items.append(entry)

    manifest = {
        'batch': BATCH_ID,
        'kind': 'objects',
        'count': len(items),
        'items': items,
    }
    mpath = os.path.join(OUT_DIR, 'manifest.json')
    with open(mpath, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f'batch_03: generated {len(items)} objects -> {OUT_DIR}')


if __name__ == '__main__':
    build_batch()
