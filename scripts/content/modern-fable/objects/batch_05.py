#!/usr/bin/env python3
"""Batch O5 (20 modern objects): plaza-park (10) + road-barriers (10).

Strictly locked to tiledata/jp-city/fable-city/palette.json (Fable 5.2 top-3/4 baseline),
binary alpha (0/255), crisp 1x silhouettes, and grounded shadows.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PARENT = os.path.dirname(HERE)
if PARENT not in sys.path:
    sys.path.insert(0, PARENT)

from fable_lib import Canvas, col, hsh, OUT_ROOT


# ---------------------------------------------------------------------------
# Drawing helpers
# ---------------------------------------------------------------------------
def _draw_line(cv, x0, y0, x1, y1, c):
    """Bresenham 1px crisp line."""
    dx = abs(x1 - x0)
    dy = -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    x, y = x0, y0
    while True:
        cv.p(x, y, c)
        if x == x1 and y == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x += sx
        if e2 <= dx:
            err += dx
            y += sy


def _ellipse_fill(cv, cx, cy, rx, ry, c):
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            if ((x - cx) / max(rx, 0.5)) ** 2 + ((y - cy) / max(ry, 0.5)) ** 2 <= 1.0:
                cv.p(x, y, c)


def _shadow_oval(cv, cx, cy, rx, ry, c='ink:1'):
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            d = ((x - cx) / max(rx, 0.5)) ** 2 + ((y - cy) / max(ry, 0.5)) ** 2
            if d <= 1.0:
                if d <= 0.72 or (x + y) % 2 == 0:
                    cv.p(x, y, c)


# ===========================================================================
# CATEGORY 1: plaza-park (10)
# ===========================================================================

def draw_playground_slide(cv):
    """48x32: Top-3/4 neighborhood park playground slide matching swing_set depth:
    sunlit wooden top platform bounded by back/front red rails, offset front/back ladder
    stringers with horizontal treads, and solid 3/4 curved red/blue-steel slide trough.
    """
    # 1. Grounded worn sand / dirt scuffs & cast shadows (matching swing_set depth)
    _ellipse_fill(cv, 17, 28.0, 12.5, 2.5, col('earth', 3))
    _ellipse_fill(cv, 37, 28.2, 8.0, 2.2, col('earth', 3))
    for y in range(26, 30):
        for x in range(5, 45):
            if cv.get(x, y)[3] == 255:
                r = hsh(x, y, 101)
                if r > 0.80:
                    cv.p(x, y, col('earth', 4))
                elif r < 0.22:
                    cv.p(x, y, col('earth', 1))
    # Soft cast shadows under platform, ladder, and slide run-out
    cv.hline(5, 24, 28, col('soil', 1))
    cv.hline(8, 23, 29, col('ink', 1))
    cv.hline(28, 44, 29, col('ink', 1))
    cv.hline(30, 43, 30, col('soil', 1))

    # 2. Rear tower legs (north side, ending higher at y=26 for true top-3/4 depth)
    for rx in (14, 22):
        cv.vline(rx, 8, 27, col('yellow', 0))
        cv.vline(rx + 1, 8, 27, col('yellow', 2))
        cv.rect(rx, 25, rx + 2, 27, col('concrete', 3))
        cv.p(rx, 25, col('concrete', 5))
    # Rear cross-brace under platform
    cv.hline(14, 24, 18, col('yellow', 1))
    cv.hline(14, 24, 17, col('yellow', 3))

    # 3. Rear (north) ladder stringer (offset +4x right, ending higher at y=26)
    def back_ladder_x(y):
        return int(round(14 - (y - 7) * 6.0 / 19.0))

    def front_ladder_x(y):
        return int(round(10 - (y - 10) * 6.5 / 19.0))

    for y in range(7, 27):
        bx = back_ladder_x(y)
        cv.p(bx, y, col('yellow', 1))
        cv.p(bx + 1, y, col('yellow', 2))
    cv.rect(7, 26, 10, 28, col('concrete', 3))

    # 4. Back (north) red safety rail standing behind sunlit platform (x=13..23, y=2..6)
    cv.hline(13, 24, 2, col('red', 0))
    cv.hline(13, 24, 3, col('red', 4))
    cv.hline(13, 24, 4, col('red', 2))
    for bx in (13, 16, 19, 22):
        cv.vline(bx, 3, 7, col('red', 2))
        cv.p(bx, 3, col('red', 4))

    # 5. Sunlit 4px top-3/4 wooden platform floor deck (x=12..24, y=6..10)
    for y in range(6, 10):
        for x in range(12, 24):
            if x in (15, 19):
                cv.p(x, y, col('wood', 2))  # crisp plank seam
            elif y == 6:
                cv.p(x, y, col('wood', 3))  # subtle shadow from back rail
            elif y == 7:
                cv.p(x, y, col('cedar', 5))  # bright sunlit plank top
            elif y == 8:
                cv.p(x, y, col('floorwood', 5 if x % 3 != 0 else 4))
            else:
                cv.p(x, y, col('cedar', 4))  # warm sunlit south deck edge
    cv.vline(12, 6, 10, col('wood', 1))

    # 6. Front (south) safety rail + yellow deck beam + front tower legs
    # Front horizontal red safety rail (y=10..11) with clean entry openings at ladder & slide
    cv.hline(11, 22, 10, col('red', 5))
    cv.p(11, 10, col('red', 0))
    cv.p(21, 10, col('red', 0))
    cv.hline(11, 22, 11, col('red', 2))
    # Short open front balusters above deck fascia (y=12)
    cv.rect(12, 12, 21, 13, col('wood', 1))
    for fx in (11, 14, 17, 20):
        cv.vline(fx, 10, 14, col('red', 4))
        cv.p(fx, 10, col('red', 5))
        cv.p(fx + 1, 12, col('red', 1))
    # Yellow steel deck fascia beam (y=13..15)
    cv.hline(11, 23, 13, col('yellow', 5))
    cv.hline(11, 23, 14, col('yellow', 3))
    cv.hline(11, 23, 15, col('orange', 1))
    # Front yellow steel tower legs down to concrete footings at y=29
    for fx in (11, 20):
        cv.vline(fx, 14, 29, col('yellow', 5))
        cv.vline(fx + 1, 14, 29, col('yellow', 3))
        cv.vline(fx + 2, 14, 29, col('orange', 1))
        cv.outline_box(fx - 1, 27, fx + 3, 30, col('concrete', 4), col('concrete', 1), top_hi=col('concrete', 6))
    # Front lower cross-brace
    cv.hline(12, 21, 21, col('yellow', 4))
    cv.hline(12, 21, 22, col('orange', 1))

    # 7. Visible horizontal ladder treads connecting back & front stringers
    for ty in (11, 15, 19, 23, 26):
        fx = front_ladder_x(ty)
        bx = back_ladder_x(ty)
        cv.hline(fx + 1, bx + 1, ty, col('cedar', 5))
        cv.hline(fx + 1, bx + 1, ty + 1, col('wood', 2))
        cv.p(fx + 1, ty, col('yellow', 5))
        cv.p(bx, ty, col('wood', 3))

    # Front (south) ladder stringer (bright sunlit yellow steel, grounded at y=29)
    for y in range(10, 29):
        fx = front_ladder_x(y)
        cv.p(fx - 1, y, col('ink', 0))
        cv.p(fx, y, col('yellow', 5))
        cv.p(fx + 1, y, col('yellow', 3))
    cv.outline_box(2, 27, 6, 30, col('concrete', 4), col('concrete', 1), top_hi=col('concrete', 6))

    # 8. Solid 3/4 curved slide trough descending from platform (x=22..45)
    def chute_y(x):
        if x <= 22:
            return 7
        if x >= 41:
            return 21  # smooth horizontal run-out bed
        u = (x - 22) / 19.0
        s = u * u * (3.0 - 2.0 * u)  # smooth S-curve
        return int(round(7 + 14.0 * s))

    # Rear & front yellow chute under-support struts
    cv.vline(40, 22, 28, col('yellow', 1))
    cv.vline(41, 22, 28, col('yellow', 2))
    cv.rect(37, 23, 39, 29, col('yellow', 4))
    cv.vline(37, 23, 29, col('yellow', 5))
    cv.vline(38, 23, 29, col('orange', 2))
    cv.outline_box(36, 27, 40, 30, col('concrete', 4), col('concrete', 1), top_hi=col('concrete', 6))

    for x in range(22, 45):
        cy = chute_y(x)
        # Far (north) red side curb with shaded inner drop wall
        cv.p(x, cy - 3, col('red', 0))
        cv.p(x, cy - 2, col('red', 4))
        cv.p(x, cy - 1, col('red', 1))
        # Recessed glossy metallic/blue sliding bed (4px wide) with top-left specular highlights
        spec_hi = (24 <= x <= 28) or (33 <= x <= 36) or (41 <= x <= 42)
        spec_mid = (25 <= x <= 29) or (34 <= x <= 37)
        cv.p(x, cy, col('glass', 3 if spec_hi else 2))
        cv.p(x, cy + 1, col('white', 6) if (spec_hi and x % 2 == 0) else col('glass', 5))
        cv.p(x, cy + 2, col('coolwhite', 5) if spec_mid else col('glass', 4))
        cv.p(x, cy + 3, col('blue', 3 if spec_mid else 2))
        # Near (south) red side curb + solid outer flank
        cv.p(x, cy + 4, col('red', 5))
        cv.p(x, cy + 5, col('red', 3))
        cv.p(x, cy + 6, col('red', 2))
        cv.p(x, cy + 7, col('red', 0))

    # Crisp top-left specular glints on near red curb & open curved exit lip at x=45
    for gx in (24, 25, 26, 33, 34, 41, 42):
        cv.p(gx, chute_y(gx) + 4, col('orange', 5))
    ey = chute_y(44)
    cv.p(45, ey - 2, col('red', 1))
    cv.p(45, ey - 1, col('red', 0))
    cv.p(45, ey, col('glass', 3))
    cv.p(45, ey + 1, col('coolwhite', 5))
    cv.p(45, ey + 2, col('glass', 4))
    cv.p(45, ey + 3, col('blue', 2))
    cv.p(45, ey + 4, col('red', 4))
    cv.p(45, ey + 5, col('red', 2))
    cv.p(45, ey + 6, col('red', 0))


def draw_swing_set(cv):
    """48x32: A-frame green/yellow painted steel park double swing set with hanging chains & 2 wood seats."""
    # 1. Ground shadow & worn dirt scuffs under swing bays
    for cx in (18, 30):
        _ellipse_fill(cv, cx, 28.5, 5.2, 2.0, col('earth', 3))
        _ellipse_fill(cv, cx, 29.0, 3.8, 1.2, col('earth', 1))
    cv.hline(6, 42, 29, col('ink', 1))
    cv.hline(8, 40, 30, col('soil', 1))

    # 2. Rear A-frame legs (angled back-inward for top-3/4 depth)
    _draw_line(cv, 10, 5, 12, 26, col('green', 1))
    _draw_line(cv, 11, 5, 13, 26, col('green', 2))
    _draw_line(cv, 37, 5, 35, 26, col('green', 1))
    _draw_line(cv, 36, 5, 34, 26, col('green', 2))
    cv.rect(11, 26, 14, 28, col('concrete', 3))
    cv.rect(34, 26, 37, 28, col('concrete', 3))

    # 3. Top horizontal yellow/green crossbar (x=7..41, y=3..7)
    cv.hline(7, 41, 3, col('ink', 0))
    cv.hline(7, 41, 4, col('yellow', 5))
    cv.hline(7, 41, 5, col('yellow', 3))
    cv.hline(7, 41, 6, col('orange', 1))
    for cx in (7, 8, 9, 38, 39, 40):
        cv.vline(cx, 3, 7, col('green', 3 if cx in (8, 39) else 1))
        cv.p(cx, 4, col('green', 5 if cx in (8, 39) else 4))

    # 4. Front A-frame legs (wider stance, bold green painted steel)
    for i in range(25):
        y = 5 + i
        x = int(round(8 - i * 4.0 / 24.0))
        cv.p(x - 1, y, col('ink', 0))
        cv.p(x, y, col('green', 5))
        cv.p(x + 1, y, col('green', 3))
        cv.p(x + 2, y, col('green', 1))
    cv.hline(7, 13, 16, col('yellow', 4))
    cv.hline(7, 13, 17, col('green', 1))
    for i in range(25):
        y = 5 + i
        x = int(round(39 + i * 4.0 / 24.0))
        cv.p(x - 1, y, col('green', 4))
        cv.p(x, y, col('green', 3))
        cv.p(x + 1, y, col('green', 1))
        cv.p(x + 2, y, col('ink', 0))
    cv.hline(35, 41, 16, col('yellow', 4))
    cv.hline(35, 41, 17, col('green', 1))

    # Concrete footing blocks on front legs
    cv.outline_box(3, 27, 8, 30, col('concrete', 4), col('concrete', 1), top_hi=col('concrete', 6))
    cv.outline_box(40, 27, 45, 30, col('concrete', 4), col('concrete', 1), top_hi=col('concrete', 6))

    # 5. Two hanging swings (taut refined steel chains + top-3/4 wood seats)
    swings = [
        (15, 21, 22, 0),   # Left swing at rest
        (27, 33, 20, -1),  # Right swing subtly lifted for lively silhouette
    ]
    for sx0, sx1, sy, shift in swings:
        for cx in (sx0, sx1):
            # Steel shackle on crossbar
            cv.rect(cx - 1, 3, cx + 2, 7, col('steel', 2))
            cv.p(cx, 4, col('steel', 6))
            cv.p(cx, 6, col('steel', 4))
            # Crisp 1px taut silver/iron chain links
            for y in range(7, sy):
                lx = cx + (shift if y > sy - 5 else 0)
                if y % 2 == 0:
                    cv.p(lx, y, col('coolwhite', 5))
                else:
                    cv.p(lx, y, col('steel', 1))
        # Wooden swing seat (top-3/4 plank: bright sunlit top + shaded front edge)
        bx0 = sx0 - 1 + shift
        bx1 = sx1 + 2 + shift
        cv.hline(bx0, bx1, sy - 1, col('wood', 0))
        cv.hline(bx0, bx1, sy, col('cedar', 5))
        cv.hline(bx0, bx1, sy + 1, col('wood', 5))
        cv.hline(bx0, bx1, sy + 2, col('wood', 2))
        cv.hline(bx0, bx1, sy + 3, col('ink', 0))
        cv.p(bx0, sy, col('steel', 5))
        cv.p(bx1 - 1, sy, col('steel', 5))
        # Cast shadow of seat on dirt below
        cv.hline(bx0 + 1, bx1, 28, col('ink', 1))


def draw_park_gazebo(cv):
    """48x48: Octagonal/hexagonal park rest pavilion with pitched dark-green shingled roof, cedar pillars, benches."""
    # 1. Grounded octagonal stone floor slab (x=5..43, y=32..46)
    for y in range(32, 47):
        t = abs(y - 39) / 7.5
        half = int(round(19 - max(0.0, t - 0.45) * 9.0))
        x0, x1 = 24 - half, 24 + half
        for x in range(x0, x1):
            if y >= 45:
                cv.p(x, y, col('ink', 1))
            elif y == 44:
                cv.p(x, y, col('stone', 1))
            elif y >= 42:
                cv.p(x, y, col('stone', 3 if (x % 4 != 0) else 2))
            else:
                r = hsh(x // 4, y // 3, 303)
                if x % 5 == 0 or y % 4 == 0:
                    cv.p(x, y, col('pavement', 2))
                else:
                    shade = 2 if y < 36 else 4
                    cv.p(x, y, col('pavement', shade + (1 if r > 0.72 else 0)))
    # Front stone entry step (x=18..30, y=42..46)
    cv.outline_box(18, 42, 30, 46, col('stone', 4), col('stone', 1), top_hi=col('stone', 6))
    cv.hline(17, 31, 46, col('ink', 0))

    # 2. Shaded back wooden lattice railing & interior benches (y=25..40)
    cv.rect(10, 26, 38, 35, col('wood', 1))
    for x in range(11, 38, 3):
        cv.vline(x, 26, 35, col('wood', 3))
    cv.hline(10, 38, 27, col('cedar', 3))
    cv.hline(10, 38, 34, col('wood', 2))

    # Two cozy interior wooden park benches (left x=10..18, right x=30..38)
    for bx0, bx1 in ((10, 18), (30, 38)):
        cv.rect(bx0, 30, bx1, 33, col('cedar', 4))
        cv.hline(bx0, bx1, 30, col('cedar', 5))
        cv.hline(bx0, bx1, 32, col('wood', 2))
        cv.rect(bx0, 33, bx1, 37, col('floorwood', 4))
        cv.hline(bx0, bx1, 33, col('floorwood', 5))
        cv.hline(bx0, bx1, 36, col('wood', 1))
        cv.vline(bx0 + 1, 36, 40, col('wood', 0))
        cv.vline(bx1 - 2, 36, 40, col('wood', 0))

    # Side waist-high cedar railings (left x=7..16, right x=32..41)
    for rx0, rx1 in ((8, 16), (32, 40)):
        cv.hline(rx0, rx1, 35, col('cedar', 5))
        cv.hline(rx0, rx1, 36, col('wood', 2))
        for x in range(rx0 + 1, rx1, 2):
            cv.vline(x, 37, 41, col('wood', 3))
        cv.hline(rx0, rx1, 40, col('wood', 1))

    # 3. Four warm cedar columns (outer left/right + front-inner left/right)
    pillars = [
        (6, 23, 41),
        (39, 23, 41),
        (15, 24, 43),
        (30, 24, 43),
    ]
    for px, py0, py1 in pillars:
        cv.outline_box(px - 1, py1 - 3, px + 4, py1 + 1, col('stone', 4), col('stone', 1), top_hi=col('stone', 6))
        cv.vline(px, py0, py1 - 2, col('cedar', 5))
        cv.vline(px + 1, py0, py1 - 2, col('cedar', 3))
        cv.vline(px + 2, py0, py1 - 2, col('wood', 1))
        cv.p(px - 1, py0 + 1, col('wood', 3))
        cv.p(px + 3, py0 + 1, col('wood', 2))

    # Cedar eave beam / frieze under roof
    cv.rect(6, 22, 42, 25, col('wood', 3))
    cv.hline(6, 42, 22, col('wood', 0))
    cv.hline(6, 42, 24, col('cedar', 4))
    cv.hline(7, 41, 25, col('ink', 0))

    # 4. Pitched hexagonal dark-green shingled roof (y=5..23)
    for y in range(5, 23):
        t = (y - 5) / 17.0
        half = int(round(3 + t * 20.0))
        x0, x1 = 24 - half, 24 + half
        l_ridge = int(round(24 - half * 0.42))
        r_ridge = int(round(24 + half * 0.42))
        for x in range(x0, x1):
            if x == x0 or x == x1 - 1:
                cv.p(x, y, col('midori', 0))
                continue
            if y == 22:
                cv.p(x, y, col('ink', 0))
                continue
            if y == 21:
                cv.p(x, y, col('midori', 1 if x % 3 != 0 else 2))
                continue
            if x < l_ridge:
                base_i = 5 if y < 14 else 4
            elif x <= r_ridge:
                base_i = 4 if y < 13 else 3
            else:
                base_i = 2 if y < 14 else 1
            if x == l_ridge:
                cv.p(x, y, col('midori', 6))
                continue
            if x == r_ridge:
                cv.p(x, y, col('midori', 4))
                continue
            ci = (y - 5) // 3
            yy = (y - 5) % 3
            bx = (x + (2 if ci % 2 else 0)) % 4
            r = hsh(x // 4, ci, 333)
            if yy == 2:
                cv.p(x, y, col('midori', max(0, base_i - 2)))
            elif bx == 3:
                cv.p(x, y, col('midori', max(0, base_i - 1)))
            elif r > 0.90 and y > 13:
                cv.p(x, y, col('moss', 3 if x < r_ridge else 2))
            else:
                cv.p(x, y, col('midori', min(6, base_i + (1 if (yy == 0 and r > 0.65) else 0))))

    # 5. Ornamental roof apex cap & dark-iron/gold finial (y=1..6)
    cv.rect(22, 4, 26, 6, col('midori', 5))
    cv.hline(22, 26, 4, col('midori', 6))
    cv.vline(23, 2, 5, col('steel', 5))
    cv.vline(24, 2, 5, col('steel', 2))
    cv.p(23, 1, col('yellow', 5))
    cv.p(24, 1, col('yellow', 3))
    cv.p(23, 3, col('yellow', 4))


def draw_stone_monument(cv):
    """32x32: Civic plaza carved granite memorial obelisk/plaque monument on stepped pedestal with bronze emblem."""
    # Ground contact shadow
    cv.rect(3, 29, 29, 31, col('ink', 1))
    cv.hline(4, 28, 30, col('ink', 0))

    # Tier 1: Wide lower granite step (x=3..29, y=24..30)
    cv.outline_box(3, 24, 29, 30, col('stone', 4), col('stone', 0), top_hi=col('stone', 6), bot_sh=col('stone', 2))
    cv.hline(4, 28, 25, col('concrete', 6))
    cv.hline(4, 28, 26, col('stone', 5))
    cv.hline(4, 28, 27, col('stone', 2))
    for sx in (10, 16, 22):
        cv.vline(sx, 25, 29, col('stone', 2))
    cv.p(4, 28, col('moss', 3))
    cv.p(5, 28, col('moss', 2))
    cv.p(26, 28, col('moss', 2))

    # Tier 2: Upper pedestal plinth (x=6..26, y=19..25)
    cv.outline_box(6, 19, 26, 25, col('stone', 4), col('stone', 0), top_hi=col('concrete', 6), bot_sh=col('stone', 2))
    cv.hline(7, 25, 21, col('stone', 5))
    cv.hline(7, 25, 22, col('stone', 3))
    for cx in (6, 23):
        cv.outline_box(cx, 18, cx + 3, 21, col('stone', 5), col('stone', 1), top_hi=col('concrete', 6))

    # Smoothly tapered 3-facet granite obelisk shaft (y=5..20)
    for y in range(5, 20):
        t = (y - 5) / 14.0
        half = int(round(4.0 + t * 2.2))
        x0, x1 = 16 - half, 16 + half
        for x in range(x0, x1):
            if x == x0 or x == x1 - 1:
                cv.p(x, y, col('stone', 0))
            elif x <= x0 + 1:
                cv.p(x, y, col('concrete', 6))  # sunlit left bevel facet
            elif x >= x1 - 2:
                cv.p(x, y, col('stone', 2))     # shaded right bevel facet
            else:
                r = hsh(x, y, 404)
                cv.p(x, y, col('stone', 5 if r > 0.70 else (3 if r < 0.18 else 4)))
    cv.hline(10, 22, 19, col('stone', 1))

    # Crisp faceted pyramidion cap aligned smoothly with shaft top (y=1..5)
    for y in range(1, 6):
        half = min(4, y)
        x0, x1 = 16 - half, 16 + half
        for x in range(x0, x1):
            if x == x0 or x == x1 - 1:
                cv.p(x, y, col('stone', 0))
            elif x < 16:
                cv.p(x, y, col('concrete', 6 if y <= 3 else 5))
            else:
                cv.p(x, y, col('stone', 3 if y <= 3 else 2))
    cv.p(15, 1, col('white', 6))
    cv.hline(12, 20, 5, col('stone', 3))
    cv.p(12, 5, col('stone', 0))
    cv.p(19, 5, col('stone', 0))
    cv.p(13, 5, col('concrete', 6))

    # Bronze civic emblem plaque on front face (x=12..20, y=9..17)
    cv.outline_box(12, 9, 20, 17, col('floorwood', 2), col('wood', 0), top_hi=col('floorwood', 4))
    cv.rect(14, 10, 18, 13, col('rooftile', 5))
    cv.p(15, 10, col('yellow', 5))
    cv.p(16, 11, col('yellow', 4))
    cv.p(15, 12, col('rooftile', 3))
    cv.hline(13, 19, 14, col('yellow', 4))
    cv.hline(14, 18, 15, col('floorwood', 5))
    for rx, ry in ((13, 10), (18, 10), (13, 15), (18, 15)):
        cv.p(rx, ry, col('yellow', 5))


def draw_plaza_clock_pillar(cv):
    """16x48: Elegant dark-iron plaza clock tower column with illuminated round cream clock face & finial."""
    # Ground shadow
    _shadow_oval(cv, 8, 45.5, 5.5, 1.8, col('ink', 1))
    cv.hline(3, 13, 46, col('ink', 0))

    # Stepped granite & cast-iron base plinth (y=37..46)
    cv.outline_box(3, 42, 13, 46, col('stone', 4), col('stone', 0), top_hi=col('concrete', 6))
    cv.outline_box(4, 37, 12, 43, col('kuro', 3), col('kuro', 0), top_hi=col('steel', 5), bot_sh=col('kuro', 1))
    cv.vline(5, 38, 42, col('steel', 4))
    cv.vline(10, 38, 42, col('kuro', 1))

    # Fluted dark-iron column shaft (x=5..11, y=20..37)
    for y in range(20, 37):
        cv.p(5, y, col('ink', 0))
        cv.p(6, y, col('steel', 5))
        cv.p(7, y, col('kuro', 4))
        cv.p(8, y, col('kuro', 2))
        cv.p(9, y, col('kuro', 3))
        cv.p(10, y, col('ink', 0))
    for ry in (20, 21, 35, 36):
        cv.hline(4, 12, ry, col('kuro', 1 if ry % 2 else 4))
    cv.hline(5, 11, 20, col('yellow', 4))
    cv.hline(5, 11, 36, col('yellow', 3))
    cv.outline_box(4, 27, 12, 31, col('kuro', 2), col('ink', 0), top_hi=col('steel', 5))
    cv.hline(6, 10, 29, col('yellow', 4))

    # Molded top-3/4 iron clock housing with stepped cornice (x=2..14, y=5..20)
    cv.hline(4, 12, 5, col('kuro', 0))
    cv.hline(3, 13, 6, col('steel', 6))
    cv.hline(2, 14, 7, col('steel', 4))
    cv.p(12, 7, col('kuro', 2))
    cv.p(13, 7, col('kuro', 0))
    cv.outline_box(2, 7, 14, 20, col('kuro', 2), col('ink', 0), top_hi=col('steel', 5), bot_sh=col('kuro', 0))
    # Ornamental finial spire (y=1..5)
    cv.vline(7, 2, 6, col('steel', 5))
    cv.vline(8, 2, 6, col('kuro', 2))
    cv.p(7, 1, col('yellow', 5))
    cv.p(8, 1, col('yellow', 3))
    cv.p(6, 4, col('steel', 4))
    cv.p(9, 4, col('kuro', 1))

    # Crisp circular illuminated cream clock face (center 7.5, 13.0)
    for y in range(8, 19):
        for x in range(3, 13):
            d = math.hypot(x - 7.5, y - 13.0)
            if 3.6 < d <= 4.6:
                cv.p(x, y, col('yellow', 5 if (x + y < 20) else 2))  # sunlit/shaded brass bezel
            elif d <= 3.6:
                if d > 2.8:
                    cv.p(x, y, col('cream', 4))
                elif y < 12 and x < 8:
                    cv.p(x, y, col('white', 6))
                else:
                    cv.p(x, y, col('cream', 6))
    # 12/3/6/9 ticks
    for tx, ty in ((7, 10), (8, 10), (10, 13), (7, 16), (5, 13)):
        cv.p(tx, ty, col('wood', 2))
    # Crisp 10:10 clock hands + center pin
    cv.p(7, 13, col('ink', 0))
    cv.p(8, 13, col('ink', 0))
    cv.p(6, 12, col('ink', 0))
    cv.p(9, 12, col('ink', 0))
    cv.p(10, 11, col('ink', 0))


def draw_notice_board(cv):
    """32x32: Neighborhood wooden roofed community bulletin board with colorful flyers & district map."""
    cv.rect(4, 29, 28, 31, col('ink', 1))
    cv.hline(5, 27, 30, col('ink', 0))

    cv.outline_box(4, 27, 9, 30, col('concrete', 4), col('concrete', 1), top_hi=col('concrete', 6))
    cv.outline_box(23, 27, 28, 30, col('concrete', 4), col('concrete', 1), top_hi=col('concrete', 6))

    for px in (5, 24):
        cv.vline(px, 9, 28, col('wood', 0))
        cv.vline(px + 1, 9, 28, col('cedar', 5))
        cv.vline(px + 2, 9, 28, col('wood', 3))
        cv.vline(px + 3, 9, 28, col('wood', 0))

    cv.hline(5, 28, 24, col('wood', 2))

    # Bulletin board wooden frame + cork backing
    cv.outline_box(6, 10, 26, 24, col('wood', 3), col('wood', 0), top_hi=col('wood', 1), bot_sh=col('cedar', 4))
    cv.stipple_rect(7, 11, 25, 23, 'earth', 3, 2, 4, seed=606, rate=0.22)
    cv.hline(7, 25, 11, col('wood', 1))

    # 1. Left white notice with red header
    cv.rect(8, 12, 13, 18, col('white', 5))
    cv.hline(8, 13, 12, col('red', 4))
    cv.hline(9, 12, 14, col('steel', 3))
    cv.hline(9, 12, 16, col('steel', 2))
    cv.p(10, 12, col('yellow', 5))

    # 2. Center yellow/orange event poster
    cv.rect(14, 12, 18, 17, col('yellow', 5))
    cv.rect(15, 13, 17, 15, col('orange', 4))
    cv.hline(14, 18, 16, col('orange', 2))
    cv.p(16, 12, col('red', 5))

    # 3. Right neighborhood district map
    cv.rect(19, 12, 24, 21, col('cream', 6))
    cv.rect(20, 13, 23, 16, col('green', 4))
    cv.rect(20, 17, 23, 20, col('glass', 4))
    cv.hline(19, 24, 16, col('white', 6))
    cv.vline(21, 13, 21, col('white', 5))
    cv.p(21, 16, col('red', 4))
    cv.p(21, 12, col('blue', 4))

    # 4. Bottom-left pink flyer
    cv.rect(8, 19, 12, 22, col('pink', 5))
    cv.hline(9, 11, 20, col('pink', 2))
    cv.p(10, 19, col('white', 6))

    # 5. Bottom-mid blue/white mini notice
    cv.rect(13, 18, 18, 22, col('coolwhite', 5))
    cv.hline(13, 18, 18, col('blue', 4))
    cv.hline(14, 17, 20, col('steel', 3))
    cv.p(15, 18, col('red', 4))

    # Pitched top-3/4 shingle shelter roof
    cv.pitched_roof(2, 2, 30, 10, ramp='kawara', ridge_hi=True, moss_rate=0.05, seed=612)
    cv.hline(3, 29, 9, col('cedar', 5))
    cv.hline(2, 30, 10, col('ink', 0))


def draw_red_mailbox(cv):
    """16x32: Iconic red metal postal pillar mailbox on pedestal with twin slots & schedule plaque."""
    cv.rect(2, 29, 14, 31, col('ink', 1))
    cv.hline(3, 13, 30, col('ink', 0))
    cv.outline_box(3, 26, 13, 30, col('concrete', 4), col('concrete', 0), top_hi=col('concrete', 6), bot_sh=col('concrete', 2))
    cv.hline(4, 12, 28, col('stone', 4))

    # Cylindrical pedestal post (x=6..10, y=20..27)
    cv.vline(6, 20, 27, col('red', 0))
    cv.vline(7, 20, 27, col('red', 4))
    cv.vline(8, 20, 27, col('red', 2))
    cv.vline(9, 20, 27, col('red', 1))
    cv.vline(10, 20, 27, col('ink', 0))
    cv.hline(5, 11, 26, col('steel', 2))
    cv.hline(5, 11, 25, col('steel', 4))

    # Rounded top-3/4 domed red cap (y=3..7)
    cv.hline(5, 11, 3, col('red', 0))
    cv.hline(4, 12, 4, col('red', 5))
    cv.p(5, 4, col('orange', 5))
    cv.p(6, 4, col('orange', 5))
    cv.hline(3, 13, 5, col('red', 4))
    cv.p(4, 5, col('red', 5))
    cv.p(11, 5, col('red', 2))
    cv.p(12, 5, col('red', 1))
    cv.hline(2, 14, 6, col('red', 5))
    cv.p(12, 6, col('red', 2))
    cv.p(13, 6, col('red', 0))
    cv.hline(3, 13, 7, col('red', 1))

    # Main red metal post box body (x=3..13, y=8..21)
    cv.outline_box(3, 8, 13, 21, col('red', 3), col('red', 0), top_hi=col('red', 4), bot_sh=col('red', 1))
    cv.vline(4, 8, 20, col('red', 5))
    cv.vline(5, 8, 20, col('red', 4))
    cv.vline(11, 8, 20, col('red', 2))
    # Twin mail slots with metallic rain hoods (y=9..11)
    for sx0, sx1 in ((4, 8), (8, 12)):
        cv.hline(sx0, sx1, 9, col('steel', 5))
        cv.hline(sx0, sx1, 10, col('ink', 0))
        cv.hline(sx0, sx1, 11, col('red', 5))
    cv.vline(8, 9, 11, col('red', 2))
    # Crisp iconic 〒 postal emblem (y=12..14)
    cv.hline(6, 10, 12, col('white', 6))
    cv.hline(6, 10, 13, col('red', 3))
    cv.hline(6, 10, 13, col('white', 5))
    cv.p(6, 13, col('red', 4))
    cv.p(9, 13, col('red', 3))
    cv.p(7, 14, col('white', 6))
    cv.p(8, 14, col('white', 5))
    # Small white pickup schedule plaque (x=5..11, y=15..19)
    cv.outline_box(5, 15, 11, 19, col('white', 5), col('steel', 2))
    cv.hline(6, 10, 16, col('blue', 4))
    cv.hline(6, 9, 17, col('steel', 3))
    cv.hline(4, 12, 20, col('red', 2))
    cv.hline(4, 12, 21, col('ink', 0))


def draw_bike_share_dock(cv):
    """48x16: Modern municipal bike-share kiosk terminal + 3 docked matching teal/green rental bicycles."""
    cv.hline(2, 46, 14, col('ink', 1))
    cv.hline(3, 45, 15, col('ink', 0))
    cv.outline_box(2, 11, 46, 15, col('concrete', 4), col('steel', 1), top_hi=col('concrete', 6))
    cv.hline(12, 45, 12, col('steel', 4))

    # Left modern municipal kiosk terminal (x=2..11, y=1..14)
    cv.outline_box(2, 1, 11, 14, col('coolwhite', 4), col('steel', 0), top_hi=col('white', 6), bot_sh=col('steel', 2))
    cv.vline(3, 2, 13, col('white', 5))
    cv.vline(9, 2, 13, col('steel', 3))
    cv.hline(3, 10, 2, col('teal', 4))
    cv.hline(3, 10, 3, col('teal', 3))
    # Glowing touchscreen
    cv.outline_box(4, 4, 9, 9, col('glass', 4), col('steel', 1))
    cv.p(5, 5, col('glass', 6))
    cv.p(6, 5, col('teal', 5))
    cv.hline(5, 8, 7, col('white', 6))
    cv.rect(4, 10, 8, 12, col('steel', 2))
    cv.p(8, 10, col('yellow', 5))
    cv.p(5, 10, col('green', 5))

    # Three docked matching teal/green rental bicycles
    for bx in (13, 24, 35):
        cv.rect(bx, 9, bx + 3, 14, col('steel', 2))
        cv.vline(bx + 1, 9, 13, col('steel', 4))
        cv.p(bx + 1, 9, col('green', 5))

        for wx, wy in ((bx + 2, 10), (bx + 3, 9), (bx + 4, 9), (bx + 5, 10),
                       (bx + 2, 11), (bx + 5, 11), (bx + 2, 12), (bx + 5, 12),
                       (bx + 3, 13), (bx + 4, 13)):
            cv.p(wx, wy, col('kuro', 0))
        cv.p(bx + 3, 11, col('steel', 5))
        cv.p(bx + 4, 11, col('steel', 4))

        for wx, wy in ((bx + 7, 10), (bx + 8, 9), (bx + 9, 9), (bx + 10, 10),
                       (bx + 7, 11), (bx + 10, 11), (bx + 7, 12), (bx + 10, 12),
                       (bx + 8, 13), (bx + 9, 13)):
            cv.p(wx, wy, col('kuro', 0))
        cv.p(bx + 8, 11, col('steel', 5))
        cv.p(bx + 9, 11, col('steel', 4))

        cv.hline(bx + 3, bx + 5, 8, col('teal', 5))
        cv.hline(bx + 8, bx + 10, 8, col('teal', 5))
        _draw_line(cv, bx + 4, 5, bx + 5, 10, col('teal', 4))
        _draw_line(cv, bx + 4, 7, bx + 7, 10, col('teal', 5))
        _draw_line(cv, bx + 7, 6, bx + 7, 11, col('green', 4))
        _draw_line(cv, bx + 7, 9, bx + 9, 11, col('teal', 3))
        cv.p(bx + 6, 10, col('coolwhite', 5))

        cv.hline(bx + 2, bx + 6, 4, col('steel', 5))
        cv.p(bx + 2, 4, col('kuro', 1))
        cv.p(bx + 5, 4, col('kuro', 1))
        cv.outline_box(bx + 1, 5, bx + 4, 8, col('steel', 3), col('steel', 1), top_hi=col('coolwhite', 5))

        cv.hline(bx + 6, bx + 9, 5, col('wood', 4))
        cv.p(bx + 7, 5, col('cedar', 5))
        cv.hline(bx + 6, bx + 9, 6, col('wood', 1))


def draw_street_trash_bin(cv):
    """16x16: Compact hooded street litter bin (single-unit recycle_bin_trio style):
    sunlit 3/4 domed top hood overhanging distinct dark slot, cool-slate body with white label & green icon.
    """
    # Grounded base shadow (y=15)
    cv.hline(2, 14, 15, col('ink', 1))
    cv.hline(3, 13, 15, col('ink', 0))

    # Lighter cool-slate bin body (x=3..13, y=5..15 — straight sides, no neck pinch)
    cv.outline_box(3, 5, 13, 15, col('coolwhite', 3), col('steel', 0), bot_sh=col('steel', 2))
    cv.vline(4, 5, 14, col('coolwhite', 5))  # sunlit left bevel
    cv.vline(11, 5, 14, col('steel', 3))     # shaded right bevel

    # Distinct dark rectangular throw-in slot under hood overhang (x=5..11, y=5..7)
    cv.rect(5, 5, 11, 7, col('ink', 0))
    cv.hline(6, 10, 6, col('kuro', 1))
    cv.hline(4, 12, 7, col('coolwhite', 5))  # crisp sunlit lower lip of slot
    cv.p(11, 7, col('steel', 4))

    # Sunlit 3/4 angled/domed overhanging top hood (x=2..14, y=1..5)
    cv.hline(4, 12, 1, col('steel', 1))
    cv.hline(3, 13, 2, col('coolwhite', 5))
    cv.p(3, 2, col('steel', 1))
    cv.p(5, 2, col('white', 6))
    cv.p(6, 2, col('white', 6))
    cv.p(7, 2, col('white', 6))
    cv.p(11, 2, col('coolwhite', 4))
    cv.p(12, 2, col('steel', 1))
    cv.hline(2, 14, 3, col('coolwhite', 4))
    cv.p(2, 3, col('steel', 0))
    cv.p(3, 3, col('coolwhite', 5))
    cv.p(4, 3, col('coolwhite', 5))
    cv.p(11, 3, col('steel', 4))
    cv.p(12, 3, col('steel', 3))
    cv.p(13, 3, col('steel', 0))
    cv.hline(2, 14, 4, col('steel', 3))
    cv.p(2, 4, col('steel', 0))
    cv.p(3, 4, col('steel', 4))
    cv.p(12, 4, col('steel', 2))
    cv.p(13, 4, col('steel', 0))

    # Subtle green sorting header band + crisp white label box with clean green icon (y=8..13)
    cv.hline(5, 11, 8, col('green', 4))
    cv.p(5, 8, col('green', 5))
    cv.p(10, 8, col('green', 3))
    cv.rect(5, 9, 11, 13, col('white', 6))
    cv.hline(5, 11, 12, col('white', 4))
    # Clean centered green recycling/leaf emblem inside white label
    cv.p(7, 10, col('green', 4))
    cv.p(8, 10, col('green', 3))
    cv.p(6, 11, col('green', 3))
    cv.p(7, 11, col('green', 5))
    cv.p(8, 11, col('green', 4))
    cv.p(9, 11, col('green', 2))

    # Foot kickplate
    cv.hline(4, 12, 13, col('steel', 2))
    cv.hline(3, 13, 14, col('ink', 0))


def draw_park_stone_lantern(cv):
    """16x32: Moss-touched carved granite Japanese/Korean park garden lantern (toro) with warm glowing fire-box."""
    cv.hline(2, 14, 30, col('ink', 1))
    cv.hline(3, 13, 31, col('ink', 0))
    cv.outline_box(3, 27, 13, 30, col('stone', 4), col('stone', 0), top_hi=col('concrete', 6), bot_sh=col('stone', 2))
    cv.outline_box(4, 25, 12, 28, col('stone', 5), col('stone', 1), top_hi=col('concrete', 6))
    cv.p(4, 28, col('moss', 3))
    cv.p(5, 29, col('moss', 2))
    cv.p(11, 28, col('moss', 4))

    # Cylindrical carved granite pillar shaft (sao)
    for y in range(19, 26):
        cv.p(5, y, col('stone', 0))
        cv.p(6, y, col('concrete', 5))
        cv.p(7, y, col('stone', 4))
        cv.p(8, y, col('stone', 3))
        cv.p(9, y, col('stone', 2))
        cv.p(10, y, col('stone', 0))
    cv.p(6, 22, col('moss', 3))

    # Flared stone mid-platform (chudai)
    cv.outline_box(3, 16, 13, 19, col('stone', 4), col('stone', 0), top_hi=col('concrete', 6), bot_sh=col('stone', 2))
    cv.hline(4, 12, 17, col('stone', 5))

    # Fire-box chamber (hibukuro, x=4..12, y=10..16) with vivid warm glowing paper window
    cv.outline_box(4, 10, 12, 16, col('stone', 2), col('stone', 0))
    cv.vline(4, 10, 16, col('stone', 0))
    cv.vline(5, 10, 16, col('stone', 4))
    cv.vline(10, 10, 16, col('stone', 1))
    cv.vline(11, 10, 16, col('stone', 0))
    # Warm lantern fire-box amber/gold paper glow (x=6..10, y=11..15)
    cv.rect(6, 11, 10, 15, col('orange', 4))
    cv.hline(6, 10, 11, col('orange', 3))
    cv.hline(6, 10, 14, col('orange', 5))
    cv.rect(6, 12, 10, 14, col('yellow', 5))
    cv.p(7, 12, col('cream', 6))
    cv.p(8, 12, col('cream', 6))
    cv.p(7, 13, col('yellow', 5))
    cv.p(8, 13, col('yellow', 4))
    # Warm glow cast onto stone sill directly below window
    cv.hline(6, 10, 16, col('cream', 4))

    # Wide curved hexagonal granite roof (kasa)
    roof_rows = [
        (4, 6, 10),
        (5, 5, 11),
        (6, 3, 13),
        (7, 2, 14),
        (8, 1, 15),
        (9, 2, 14),
    ]
    for ry, rx0, rx1 in roof_rows:
        for x in range(rx0, rx1):
            if x == rx0 or x == rx1 - 1:
                cv.p(x, ry, col('stone', 0))
            elif ry == 9:
                cv.p(x, ry, col('stone', 1))
            elif ry == 8:
                cv.p(x, ry, col('stone', 3 if x < 9 else 2))
            elif x < 8:
                cv.p(x, ry, col('concrete', 6 if ry <= 6 else 5))
            else:
                cv.p(x, ry, col('stone', 4 if ry <= 6 else 3))
    cv.p(4, 6, col('moss', 4))
    cv.p(5, 6, col('moss', 3))
    cv.p(3, 7, col('moss', 3))
    cv.p(11, 7, col('moss', 2))
    cv.p(12, 8, col('moss', 2))

    # Lotus jewel finial (hoju)
    cv.p(7, 1, col('concrete', 6))
    cv.p(8, 1, col('stone', 4))
    cv.hline(6, 10, 2, col('stone', 5))
    cv.p(6, 2, col('stone', 1))
    cv.p(9, 2, col('stone', 1))
    cv.hline(6, 10, 3, col('stone', 3))


# ===========================================================================
# CATEGORY 2: road-barriers (10)
# ===========================================================================

def draw_steel_guardrail(cv):
    """32x16: White-painted corrugated roadside pedestrian guardrail with reflector strips & twin posts."""
    # Cast shadow band on pavement below
    cv.hline(0, 32, 13, col('ink', 1))
    cv.hline(1, 31, 14, col('asphalt', 1))

    # Concrete post footing collars + twin galvanized steel posts BEHIND the W-beam
    for px in (6, 23):
        cv.outline_box(px - 1, 11, px + 4, 15, col('concrete', 4), col('concrete', 1), top_hi=col('concrete', 6))
        # Galvanized steel post cap peeking above rail & lower post descending into concrete
        cv.rect(px, 2, px + 3, 13, col('steel', 3))
        cv.vline(px, 2, 13, col('steel', 1))
        cv.vline(px + 1, 2, 13, col('steel', 5))
        cv.vline(px + 2, 2, 13, col('steel', 1))
        cv.hline(px, px + 3, 2, col('ink', 0))
        cv.p(px + 1, 3, col('coolwhite', 5))

    # Continuous full-width corrugated W-beam white steel rail IN FRONT of posts (x=0..32, y=4..10)
    cv.hline(0, 32, 4, col('steel', 2))      # top edge outline
    cv.hline(0, 32, 5, col('white', 6))      # sunlit top-3/4 upper flange
    cv.hline(0, 32, 6, col('white', 4))      # upper bevel
    cv.hline(0, 32, 7, col('coolwhite', 2))  # corrugated center groove shadow
    cv.hline(0, 32, 8, col('white', 5))      # lower bright ridge
    cv.hline(0, 32, 9, col('coolwhite', 3))  # underside curve
    cv.hline(0, 32, 10, col('steel', 1))     # bottom shadow outline

    # Subtle panel splice seam at center (x=15..16) with bolt heads
    cv.vline(16, 5, 10, col('steel', 2))
    cv.p(15, 5, col('steel', 3))
    cv.p(15, 8, col('steel', 3))

    # Sleek high-visibility orange/yellow reflector strips neatly mounted on beam face
    for rx in (6, 23):
        cv.rect(rx, 6, rx + 3, 9, col('orange', 4))
        cv.p(rx, 6, col('red', 3))
        cv.p(rx + 1, 6, col('yellow', 5))
        cv.p(rx + 2, 6, col('orange', 3))
        cv.p(rx + 1, 7, col('yellow', 5))
        cv.p(rx + 1, 8, col('orange', 3))
        cv.p(rx + 1, 5, col('steel', 2))  # mounting bolt


def draw_stone_bollard(cv):
    """16x16: Cylindrical chamfered granite sidewalk anti-car bollard with dark recessed stainless reflection ring."""
    _shadow_oval(cv, 8, 13.5, 5.2, 1.8, col('ink', 1))
    cv.hline(4, 12, 14, col('ink', 0))

    # Grounded stone base collar
    cv.hline(4, 12, 13, col('stone', 0))
    cv.hline(4, 12, 12, col('stone', 2))
    cv.p(5, 12, col('stone', 4))

    # Cylindrical granite bollard shaft (x=4..12, y=4..12)
    for y in range(4, 12):
        cv.p(4, y, col('stone', 0))
        cv.p(5, y, col('concrete', 6))
        cv.p(6, y, col('stone', 5))
        cv.p(7, y, col('stone', 4))
        cv.p(8, y, col('stone', 4 if hsh(8, y, 77) > 0.4 else 3))
        cv.p(9, y, col('stone', 3))
        cv.p(10, y, col('stone', 2))
        cv.p(11, y, col('stone', 0))
    cv.p(6, 10, col('concrete', 6))
    cv.p(8, 11, col('stone', 2))
    cv.p(7, 9, col('stone', 5))

    # Chamfered top-3/4 elliptical granite dome cap (y=1..5)
    cv.hline(6, 10, 1, col('stone', 1))
    cv.hline(5, 11, 2, col('concrete', 6))
    cv.p(6, 2, col('white', 6))
    cv.p(7, 2, col('white', 6))
    cv.p(10, 2, col('stone', 4))
    cv.hline(4, 12, 3, col('stone', 5))
    cv.p(4, 3, col('stone', 0))
    cv.p(5, 3, col('concrete', 6))
    cv.p(10, 3, col('stone', 3))
    cv.p(11, 3, col('stone', 0))
    cv.hline(5, 11, 4, col('stone', 4))
    cv.p(5, 4, col('concrete', 5))
    cv.p(10, 4, col('stone', 2))

    # Dark recessed stainless reflection ring (y=6..8)
    cv.hline(4, 12, 6, col('ink', 0))
    cv.hline(4, 12, 7, col('steel', 1))
    cv.p(5, 6, col('coolwhite', 5))
    cv.p(6, 6, col('white', 6))
    cv.p(7, 6, col('glass', 5))
    cv.p(5, 7, col('steel', 4))
    cv.p(6, 7, col('coolwhite', 5))
    cv.p(9, 7, col('steel', 2))


def draw_chainlink_fence(cv):
    """32x32: Galvanized steel pipe frame with crisp diagonal diamond-mesh wire fence & concrete curb base."""
    cv.rect(0, 25, 32, 31, col('concrete', 4))
    cv.hline(0, 32, 25, col('concrete', 1))
    cv.hline(0, 32, 26, col('concrete', 6))
    cv.hline(0, 32, 27, col('concrete', 5))
    cv.hline(0, 32, 28, col('concrete', 3))
    cv.hline(0, 32, 29, col('concrete', 2))
    cv.hline(0, 32, 30, col('concrete', 1))
    cv.hline(0, 32, 31, col('ink', 0))
    cv.vline(16, 26, 31, col('concrete', 1))
    for x in range(0, 32):
        r = hsh(x, 28, 808)
        if r > 0.84:
            cv.p(x, 28, col('concrete', 4))
        elif r < 0.14:
            cv.p(x, 29, col('moss', 3))

    for y in range(5, 25):
        for x in range(0, 32):
            d1 = (x + y) % 4 == 0
            d2 = (x - y) % 4 == 0
            if d1 and d2:
                cv.p(x, y, col('coolwhite', 5))
            elif d1:
                cv.p(x, y, col('steel', 4))
            elif d2:
                cv.p(x, y, col('steel', 2))

    cv.hline(0, 32, 15, col('steel', 3))
    for x in range(0, 32, 4):
        cv.p(x, 15, col('coolwhite', 5))

    cv.hline(0, 32, 2, col('steel', 1))
    cv.hline(0, 32, 3, col('coolwhite', 5))
    cv.hline(0, 32, 4, col('steel', 3))
    cv.hline(0, 32, 5, col('steel', 1))

    for px in (1, 15, 28):
        cv.hline(px, px + 3, 1, col('steel', 1))
        cv.p(px + 1, 1, col('white', 6))
        cv.vline(px, 2, 27, col('steel', 1))
        cv.vline(px + 1, 2, 27, col('coolwhite', 5))
        cv.vline(px + 2, 2, 27, col('steel', 2))
        for cy in (4, 15, 24):
            cv.hline(px, px + 3, cy, col('steel', 0))
            cv.p(px + 1, cy, col('steel', 5))
        cv.hline(px - 1, px + 4, 26, col('steel', 2))


def draw_brick_garden_wall(cv):
    """32x16: Low red-brick residential garden wall with pale sunlit concrete coping stones & green vine."""
    cv.hline(0, 32, 15, col('ink', 0))
    cv.hline(0, 32, 14, col('brick', 0))

    cv.brick_wall(0, 5, 32, 15, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=909)
    cv.hline(0, 32, 5, col('brick', 0))
    cv.hline(0, 32, 6, col('brick', 1))

    cv.hline(0, 32, 1, col('concrete', 1))
    cv.hline(0, 32, 2, col('concrete', 6))
    cv.hline(0, 32, 3, col('concrete', 5))
    cv.hline(0, 32, 4, col('concrete', 3))
    for jx in (0, 8, 16, 24):
        cv.vline(jx, 2, 5, col('concrete', 2))
        if jx + 1 < 32:
            cv.p(jx + 1, 2, col('white', 6))

    vine_px = [
        (21, 1, 5), (22, 1, 6), (23, 1, 4), (24, 1, 5), (25, 1, 3),
        (20, 2, 4), (21, 2, 6), (22, 2, 5), (23, 2, 4), (24, 2, 3), (25, 2, 5), (26, 2, 4), (27, 2, 2),
        (21, 3, 3), (22, 3, 5), (23, 3, 4), (24, 3, 2), (25, 3, 4), (26, 3, 5), (27, 3, 3),
        (22, 4, 2), (23, 4, 4), (24, 4, 5), (25, 4, 3), (26, 4, 2), (27, 4, 4), (28, 4, 2),
        (23, 5, 3), (24, 5, 4), (25, 5, 2), (26, 5, 3), (27, 5, 4),
        (24, 6, 2), (25, 6, 4), (26, 6, 5), (27, 6, 2),
        (25, 7, 3), (26, 7, 4), (27, 7, 1),
        (25, 8, 2), (26, 8, 3), (27, 8, 2),
        (26, 9, 4), (26, 10, 2),
    ]
    for vx, vy, vt in vine_px:
        cv.p(vx, vy, col('foliage', vt))
    cv.p(23, 2, col('pink', 5))
    cv.p(26, 6, col('yellow', 5))
    for mx in (3, 4, 13, 28, 29):
        cv.p(mx, 14, col('moss', 3 if mx % 2 else 2))


def draw_concrete_block_wall(cv):
    """32x32: Classic Japanese/Korean stacked grey cinder-block alley wall with cap course & weathering."""
    cv.hline(0, 32, 31, col('ink', 0))
    cv.hline(0, 32, 30, col('concrete', 1))
    cv.hline(0, 32, 29, col('concrete', 3))
    cv.hline(0, 32, 28, col('concrete', 5))

    course_h = 5
    block_w = 8
    for y in range(7, 28):
        ry = y - 7
        ci = ry // course_h
        yy = ry % course_h
        off = 4 if (ci % 2 == 1) else 0
        for x in range(0, 32):
            rx = x + off
            bi = rx // block_w
            bx = rx % block_w
            if yy == course_h - 1 or bx == block_w - 1:
                cv.p(x, y, col('pavement', 1))
            else:
                r = hsh(bi, ci, 1515)
                base_i = 4 if ci < 2 else 3
                if r > 0.72:
                    base_i += 1
                elif r < 0.22:
                    base_i -= 1
                if yy == 0:
                    base_i = min(5, base_i + 1)
                if hsh(x, y, 1516) < 0.14:
                    base_i = max(2, base_i - 1)
                cv.p(x, y, col('concrete', base_i))

    # Perforated ventilation cinder block (sukashi block)
    cv.outline_box(12, 12, 20, 17, col('concrete', 4), col('pavement', 1), top_hi=col('concrete', 5))
    cv.rect(13, 13, 15, 16, col('ink', 1))
    cv.rect(17, 13, 19, 16, col('ink', 1))
    cv.p(14, 15, col('pavement', 2))
    cv.p(18, 15, col('pavement', 2))

    for wx in (7, 16, 24):
        for wy in range(7, 16):
            if hsh(wx, wy, 1520) > 0.35:
                cv.p(wx, wy, col('pavement', 2))

    for mx, my, mt in ((2, 26, 2), (3, 26, 3), (3, 27, 2), (4, 27, 3), (5, 29, 2),
                       (21, 26, 2), (22, 27, 3), (23, 27, 2), (28, 25, 2), (29, 26, 3)):
        cv.p(mx, my, col('moss', mt))

    cv.hline(0, 32, 2, col('concrete', 1))
    cv.hline(0, 32, 3, col('concrete', 6))
    cv.hline(0, 32, 4, col('concrete', 5))
    cv.hline(0, 32, 5, col('concrete', 4))
    cv.hline(0, 32, 6, col('concrete', 2))
    cv.hline(0, 32, 7, col('ink', 1))
    for jx in (0, 8, 16, 24):
        cv.vline(jx, 3, 6, col('concrete', 2))
        if jx + 1 < 32:
            cv.p(jx + 1, 3, col('white', 6))


def draw_subway_stair_rail(cv):
    """48x32: Street-level underground subway stair entrance with open-air overhead metro sign on slim posts,
    waist-high concrete parapet walls with crisp sunlit 3/4 top coping receding northward, and descending stair pit.
    """
    # Ground contact shadow along base
    cv.hline(2, 46, 30, col('ink', 1))
    cv.hline(3, 45, 31, col('ink', 0))

    # 1. Descending stair pit (x=9..39, y=10..30) — progressively darker toward bottom into cool indigo/charcoal shadow
    # Flush sunlit north street-entry threshold aligning cleanly with parapet walls at y=10
    cv.hline(9, 39, 10, col('concrete', 5))
    cv.p(9, 10, col('concrete', 3))
    cv.p(38, 10, col('concrete', 3))
    # Inner stairwell side tile walls receding down into shadow
    for y in range(11, 30):
        depth = (y - 11) / 18.0
        if depth < 0.30:
            lt, rt = col('tile', 4), col('tile', 3)
        elif depth < 0.58:
            lt, rt = col('tile', 3), col('tile', 2)
        elif depth < 0.80:
            lt, rt = col('tile', 1), col('tile', 0)
        else:
            lt, rt = col('navy', 0), col('ink', 0)
        cv.p(9, y, lt)
        cv.p(38, y, rt)

    # 6 crisp tread + riser steps descending from sunlit street entry (top) into deep indigo/charcoal pit (bottom)
    steps = [
        # (y0, y1, tread_top, tread_mid, riser, yellow_lip)
        (11, 14, col('concrete', 6), col('pavement', 5), col('pavement', 3), True),
        (14, 17, col('pavement', 5), col('pavement', 4), col('pavement', 2), True),
        (17, 20, col('tile', 4),     col('pavement', 3), col('tile', 2),     False),
        (20, 23, col('tile', 3),     col('tile', 2),     col('tile', 1),     False),
        (23, 26, col('tile', 1),     col('navy', 1),     col('navy', 0),     False),
        (26, 29, col('navy', 1),     col('navy', 0),     col('ink', 1),      False),
    ]
    for sy0, sy1, c_top, c_mid, c_riser, has_yellow in steps:
        cv.hline(10, 38, sy0, c_top)
        cv.hline(10, 38, sy0 + 1, c_mid)
        if has_yellow:
            yc = col('yellow', 4) if sy0 == 11 else col('yellow', 2)
            cv.hline(11, 37, sy0 + 1, yc)
        cv.hline(10, 38, sy1 - 1, c_riser)
        # Subtle side-wall cast shadows inside pit
        cv.p(10, sy0, col('tile', 1) if sy0 < 20 else col('navy', 0))
        cv.p(37, sy0, col('tile', 1) if sy0 < 20 else col('navy', 0))
    # Deep underground shadow pool at bottom of pit (y=29..30)
    cv.hline(10, 38, 29, col('ink', 0))
    cv.hline(10, 38, 30, col('ink', 0))

    # 2. Left & right waist-high concrete parapet walls (y=10..30) with crisp 3px sunlit 3/4 top coping receding northward
    # Left parapet wall (x=2..9, y=10..30)
    cv.vline(2, 10, 30, col('concrete', 1))   # outer left outline
    cv.vline(3, 10, 26, col('white', 6))      # sunlit left coping highlight
    cv.vline(4, 10, 26, col('concrete', 6))   # sunlit top coping plane
    cv.vline(5, 10, 26, col('concrete', 5))   # top coping inner slope
    cv.vline(6, 10, 26, col('concrete', 2))   # coping inner edge
    cv.vline(7, 10, 30, col('tile', 4))       # inner parapet cheek
    cv.vline(8, 10, 30, col('tile', 2))       # inner shadow rim
    cv.hline(2, 9, 10, col('concrete', 1))    # north end outline
    cv.hline(3, 7, 11, col('white', 6))
    # Subtle expansion joints along receding top coping
    for jy in (14, 18, 22):
        cv.hline(3, 6, jy, col('concrete', 3))
    # South front end-face of left waist-high parapet (x=2..9, y=25..30)
    cv.hline(2, 9, 25, col('concrete', 6))
    cv.hline(2, 9, 26, col('concrete', 3))
    cv.tile_cladding(3, 27, 8, 30, ramp='tile', base_i=4, cw=3, ch=2, seed=1601)
    cv.hline(2, 9, 29, col('steel', 1))
    cv.hline(2, 9, 30, col('ink', 0))

    # Right parapet wall (x=39..46, y=10..30)
    cv.vline(39, 10, 30, col('tile', 2))      # inner shadow rim
    cv.vline(40, 10, 30, col('tile', 4))      # inner parapet cheek
    cv.vline(41, 10, 26, col('concrete', 2))  # coping inner edge
    cv.vline(42, 10, 26, col('white', 6))     # sunlit left coping highlight
    cv.vline(43, 10, 26, col('concrete', 6))  # sunlit top coping plane
    cv.vline(44, 10, 26, col('concrete', 4))  # coping outer bevel
    cv.vline(45, 10, 30, col('concrete', 1))  # outer right outline
    cv.hline(39, 46, 10, col('concrete', 1))  # north end outline
    cv.hline(41, 45, 11, col('white', 6))
    for jy in (14, 18, 22):
        cv.hline(42, 45, jy, col('concrete', 3))
    # South front end-face of right waist-high parapet (x=39..46, y=25..30)
    cv.hline(39, 46, 25, col('concrete', 6))
    cv.hline(39, 46, 26, col('concrete', 3))
    cv.tile_cladding(40, 27, 45, 30, ramp='tile', base_i=4, cw=3, ch=2, seed=1602)
    cv.hline(39, 46, 29, col('steel', 1))
    cv.hline(39, 46, 30, col('ink', 0))

    # 3. Thin central stainless handrail descending down the stair pit (x=23..24, y=11..28)
    for y in range(11, 29):
        if y < 18:
            c_hi, c_sh = col('white', 6), col('steel', 3)
        elif y < 24:
            c_hi, c_sh = col('coolwhite', 4), col('steel', 2)
        else:
            c_hi, c_sh = col('steel', 4), col('navy', 0)
        cv.p(23, y, c_hi)
        cv.p(24, y, c_sh)
    # Minimal central stanchion mounting lugs
    for py in (13, 19, 25):
        cv.p(23, py, col('steel', 4))
        cv.p(24, py, col('ink', 0))

    # Side stainless guard rails resting cleanly on inner parapet coping
    for rx in (6, 41):
        cv.vline(rx, 11, 25, col('coolwhite', 5))
        cv.p(rx, 25, col('steel', 2))

    # 4. Slender overhead sign posts (y=6..10) with OPEN transparent air around them (y=4..9)!
    for px in (5, 41):
        cv.vline(px, 6, 11, col('coolwhite', 5))
        cv.vline(px + 1, 6, 11, col('steel', 2))
        cv.hline(px - 1, px + 3, 10, col('steel', 1))  # base flange on parapet coping
        cv.p(px, 10, col('steel', 4))

    # 5. Illuminated overhead metro station sign (x=5..43, y=0..6) [lightAnchor]
    cv.outline_box(5, 0, 43, 6, col('navy', 1), col('ink', 0), top_hi=col('steel', 5))
    cv.hline(6, 42, 4, col('yellow', 5))  # bright metro line accent stripe
    # Metro emblem badge (left, x=7..12, y=1..5)
    cv.rect(7, 1, 12, 5, col('blue', 4))
    cv.p(8, 1, col('white', 6))
    cv.p(10, 1, col('white', 6))
    cv.p(8, 2, col('white', 6))
    cv.p(9, 2, col('yellow', 5))
    cv.p(10, 2, col('white', 6))
    cv.p(8, 3, col('white', 6))
    cv.p(10, 3, col('white', 6))
    # Crisp varied backlit station-name glyph blocks (y=1..4)
    glyphs = [
        [(0, 0), (1, 0), (2, 0), (1, 1), (0, 2), (1, 2), (2, 2)],
        [(0, 0), (2, 0), (0, 1), (1, 1), (2, 1), (0, 2), (2, 2)],
        [(0, 0), (1, 0), (0, 1), (1, 1), (2, 1), (0, 2), (1, 2)],
        [(1, 0), (0, 1), (1, 1), (2, 1), (1, 2)],
        [(0, 0), (1, 0), (2, 0), (2, 1), (1, 2), (2, 2)],
        [(0, 0), (2, 0), (1, 1), (0, 2), (1, 2), (2, 2)],
    ]
    gx_starts = (14, 18, 22, 26, 30, 35)
    for gx, pts in zip(gx_starts, glyphs):
        for dx, dy in pts:
            cv.p(gx + dx, 1 + dy, col('white', 6) if dy == 0 else col('cream', 6))


def draw_canal_railing(cv):
    """32x16: Scenic riverside/canal open dark-iron balustrade railing with sunlit handrail,
    clear transparent vertical gaps between 1px balusters, concrete curb, and chamfered stone pillar.
    """
    # 1. Concrete curb base (x=0..32, y=11..15)
    cv.hline(0, 32, 11, col('concrete', 6))  # sunlit curb top
    cv.hline(0, 32, 12, col('stone', 5))     # curb bevel
    cv.hline(0, 32, 13, col('stone', 4))     # curb front face
    cv.hline(0, 32, 14, col('stone', 2))     # shaded lower edge
    cv.hline(0, 32, 15, col('ink', 0))       # grounded shadow
    for jx in (15, 25):
        cv.vline(jx, 11, 15, col('stone', 2))
        cv.p(jx + 1, 11, col('white', 6))

    # 2. Open dark-iron railing span (x=8..32, y=3..11)
    # Sunlit top handrail (y=3..4)
    cv.hline(8, 32, 3, col('coolwhite', 5))
    cv.hline(8, 32, 4, col('kuro', 2))
    # Subtle lower anchor rail resting on curb (y=10) — leaves y=5..9 (5px) clean transparent gaps!
    cv.hline(8, 32, 10, col('kuro', 2))
    # Slender 1px vertical balusters every 4px (x=11, 15, 19, 23, 27, 31)
    for bx in range(11, 32, 4):
        cv.vline(bx, 5, 11, col('kuro', 1))
        cv.p(bx, 5, col('steel', 4))
        cv.p(bx, 10, col('steel', 3))

    # 3. Left carved granite corner pillar (x=1..8, y=1..15)
    # Sunlit 3/4 chamfered top cap (y=1..3)
    cv.hline(2, 7, 1, col('stone', 1))
    cv.hline(3, 6, 1, col('concrete', 6))
    cv.hline(1, 8, 2, col('stone', 5))
    cv.p(1, 2, col('stone', 1))
    cv.p(2, 2, col('white', 6))
    cv.p(3, 2, col('white', 6))
    cv.p(4, 2, col('concrete', 6))
    cv.p(6, 2, col('stone', 3))
    cv.p(7, 2, col('stone', 1))
    cv.hline(1, 8, 3, col('stone', 5))
    cv.p(1, 3, col('stone', 0))
    cv.p(2, 3, col('concrete', 6))
    cv.p(6, 3, col('stone', 2))
    cv.p(7, 3, col('stone', 0))

    # Pillar shaft with subtle masonry shading (y=4..14, no dark inset box)
    cv.rect(1, 4, 8, 15, col('stone', 4))
    cv.vline(1, 4, 15, col('stone', 0))
    cv.vline(7, 4, 15, col('stone', 0))
    cv.hline(2, 7, 4, col('stone', 2))       # shadow under chamfered cap
    cv.vline(2, 5, 14, col('concrete', 5))   # sunlit left masonry bevel
    cv.vline(6, 5, 14, col('stone', 3))      # shaded right bevel
    # Subtle horizontal ashlar block joints & stone grain
    cv.hline(2, 7, 8, col('stone', 3))
    cv.hline(2, 7, 12, col('stone', 3))
    cv.p(3, 6, col('stone', 5))
    cv.p(5, 10, col('stone', 3))
    cv.p(4, 9, col('stone', 5))
    cv.hline(2, 7, 14, col('stone', 2))      # plinth shadow
    cv.hline(1, 8, 15, col('ink', 0))        # grounded base shadow


def draw_parking_wheelstop(cv):
    """32x16: Concrete parking bay wheel-stop block with yellow/black hazard diagonal stripes & bolted brackets."""
    cv.rect(2, 11, 30, 15, col('ink', 1))
    cv.hline(3, 29, 14, col('ink', 0))

    for y in range(5, 13):
        inset = 1 if y in (5, 12) else 0
        x0, x1 = 3 + inset, 29 - inset
        for x in range(x0, x1):
            if y == 5 or y == 12 or x == x0 or x == x1 - 1:
                cv.p(x, y, col('ink', 0))
                continue
            if x <= 5:
                cv.p(x, y, col('concrete', 6 if y <= 8 else 4))
                continue
            if x >= 26:
                cv.p(x, y, col('concrete', 4 if y <= 8 else 2))
                continue
            band = ((x + (y - 5)) // 3) % 2
            if band == 0:
                if y == 6:
                    cv.p(x, y, col('yellow', 5))
                elif y <= 8:
                    cv.p(x, y, col('yellow', 4))
                elif y == 9:
                    cv.p(x, y, col('orange', 4))
                else:
                    cv.p(x, y, col('yellow', 2))
            else:
                if y == 6:
                    cv.p(x, y, col('asphalt', 4))
                elif y <= 8:
                    cv.p(x, y, col('asphalt', 2))
                else:
                    cv.p(x, y, col('asphalt', 0))

    # Sleek 2px bolted galvanized steel anchor brackets (x=8..10 and x=22..24)
    for bx in (8, 22):
        cv.vline(bx, 6, 12, col('steel', 5))
        cv.vline(bx + 1, 6, 12, col('steel', 2))
        cv.p(bx, 7, col('white', 6))
        cv.p(bx + 1, 8, col('ink', 0))
        cv.p(bx, 11, col('steel', 3))


def draw_speed_bump(cv):
    """32x16: Sleek raised roadway speed bump (y=5..13) with continuous diagonal yellow/black stripes,
    rounded upper crest lighting, darkened lower slope, and softened asphalt transition edges.
    """
    for y in range(5, 14):
        for x in range(0, 32):
            band = (x + y) % 8
            is_yellow = band < 4
            if y == 5:
                # Soft top asphalt-to-bump transition edge (no harsh uniform dark border)
                if is_yellow:
                    cv.p(x, y, col('straw', 2) if (x % 2 == 0) else col('yellow', 2))
                else:
                    cv.p(x, y, col('tarmac', 2) if (x % 2 == 0) else col('asphalt', 2))
            elif y == 13:
                # Softened bottom asphalt transition edge
                if is_yellow:
                    cv.p(x, y, col('asphalt', 1) if (x % 2 == 0) else col('tarmac', 1))
                else:
                    cv.p(x, y, col('asphalt', 0) if (x % 3 == 0) else col('asphalt', 1))
            elif is_yellow:
                if y == 6:
                    cv.p(x, y, col('yellow', 4))
                elif y == 7:
                    cv.p(x, y, col('cream', 5) if band in (1, 2) else col('yellow', 5))
                elif y == 8:
                    cv.p(x, y, col('yellow', 5))
                elif y == 9:
                    cv.p(x, y, col('yellow', 4))
                elif y == 10:
                    cv.p(x, y, col('yellow', 3))
                elif y == 11:
                    cv.p(x, y, col('yellow', 2))
                else:  # y == 12
                    cv.p(x, y, col('yellow', 1))
            else:
                if y == 6:
                    cv.p(x, y, col('tarmac', 3))
                elif y == 7:
                    cv.p(x, y, col('asphalt', 4) if band in (5, 6) else col('tarmac', 4))
                elif y == 8:
                    cv.p(x, y, col('tarmac', 4))
                elif y == 9:
                    cv.p(x, y, col('tarmac', 3))
                elif y == 10:
                    cv.p(x, y, col('tarmac', 2))
                elif y == 11:
                    cv.p(x, y, col('asphalt', 2))
                else:  # y == 12
                    cv.p(x, y, col('asphalt', 1))

    # Subtle recessed anchor bolts along crest slope
    for bx in (5, 13, 21, 29):
        cv.p(bx, 8, col('steel', 2))
        cv.p(bx, 9, col('steel', 4))


def draw_tactile_drain_set(cv):
    """32x16: Flush street-edge strip: muted Fable warm-ochre tactile paving blocks (y=0..8),
    crisp 2px beveled curb edge (y=9..10), and recessed low-contrast gunmetal/slate cast-iron grate (y=11..15).
    """
    # 1. Flush concrete border (y=0) + muted Fable warm-ochre tactile paving blocks (y=1..8)
    for x in range(0, 32):
        r = hsh(x, 0, 1701)
        cv.p(x, 0, col('pavement', 4 if r > 0.35 else 3))

    for y in range(1, 9):
        for x in range(0, 32):
            if y == 8:
                # Subtle mortar transition into curb
                cv.p(x, y, col('straw', 2) if (x % 3 != 0) else col('pavement', 3))
            else:
                r = hsh(x, y, 1702)
                cv.p(x, y, col('straw', 4 if r > 0.72 else 3))

    # Subtle internal tile seams (open left/right edges at x=0 and x=31 so it sits flush with pavement)
    for sx in (8, 16, 24):
        cv.vline(sx, 1, 8, col('straw', 2))

    # Subtle low-contrast tactile dome/rib relief per 8px block
    for tx in (0, 8, 16, 24):
        for by in (2, 5):
            for bx in (tx + 2, tx + 5):
                cv.p(bx, by, col('cream', 4))       # soft warm top-left relief highlight
                cv.p(bx + 1, by, col('yellow', 3))  # muted ochre dome crown
                cv.p(bx, by + 1, col('straw', 3))
                cv.p(bx + 1, by + 1, col('straw', 2))  # gentle bottom-right relief shadow

    # 2. Crisp 2px beveled concrete curb edge (y=9..10)
    cv.hline(0, 32, 9, col('concrete', 6))
    cv.hline(0, 32, 10, col('concrete', 3))
    for jx in (8, 16, 24):
        cv.p(jx, 9, col('concrete', 4))
        cv.p(jx, 10, col('concrete', 2))
        cv.p(jx + 1, 9, col('white', 6))

    # 3. Flush concrete gutter + recessed low-contrast gunmetal/slate cast-iron grate (y=11..15)
    for y in range(11, 16):
        for x in range(0, 32):
            if y == 11:
                cv.p(x, y, col('pavement', 1))
            elif y == 15:
                cv.p(x, y, col('pavement', 2 if hsh(x, y, 1705) > 0.35 else 1))
            else:
                cv.p(x, y, col('pavement', 3 if hsh(x, y, 1706) > 0.4 else 2))

    # Recessed cast-iron grate frame (x=4..28, y=11..15 — subtle gunmetal/slate, no piano keys!)
    cv.hline(4, 28, 11, col('steel', 1))
    cv.hline(4, 28, 15, col('steel', 1))
    cv.vline(4, 11, 16, col('steel', 2))
    cv.vline(27, 11, 16, col('steel', 2))
    for gx in range(5, 27):
        if (gx - 5) % 3 == 0:
            # Gunmetal cast-iron bar
            cv.p(gx, 12, col('steel', 3))
            cv.p(gx, 13, col('steel', 3))
            cv.p(gx, 14, col('steel', 2))
        else:
            # Recessed dark slate drainage slot
            cv.p(gx, 12, col('asphalt', 1))
            cv.p(gx, 13, col('asphalt', 0))
            cv.p(gx, 14, col('asphalt', 1))
    # Subtle horizontal cast-iron cross-rib across grate center
    cv.hline(5, 27, 13, col('steel', 2))
    for gx in range(5, 27, 3):
        cv.p(gx, 13, col('steel', 4))


# ===========================================================================
# Batch registry & generator
# ===========================================================================
ITEMS = [
    # Category: plaza-park (10)
    {
        'id': 'mf-obj-playground_slide',
        'name': '놀이터 미끄럼틀',
        'category': 'plaza-park',
        'size': (48, 32),
        'pc': 'solid',
        'tags': ['plaza-park', 'playground', 'park', 'slide'],
        'fn': draw_playground_slide,
    },
    {
        'id': 'mf-obj-swing_set',
        'name': '공원 2인 그네',
        'category': 'plaza-park',
        'size': (48, 32),
        'pc': 'solid',
        'tags': ['plaza-park', 'playground', 'park', 'swing'],
        'fn': draw_swing_set,
    },
    {
        'id': 'mf-obj-park_gazebo',
        'name': '공원 팔각 정자',
        'category': 'plaza-park',
        'size': (48, 48),
        'pc': 'solid',
        'tags': ['plaza-park', 'gazebo', 'pavilion', 'park'],
        'fn': draw_park_gazebo,
    },
    {
        'id': 'mf-obj-stone_monument',
        'name': '광장 화강암 기념비',
        'category': 'plaza-park',
        'size': (32, 32),
        'pc': 'solid',
        'tags': ['plaza-park', 'monument', 'plaza', 'stone'],
        'fn': draw_stone_monument,
    },
    {
        'id': 'mf-obj-plaza_clock_pillar',
        'name': '광장 시계탑 기둥',
        'category': 'plaza-park',
        'size': (16, 48),
        'pc': 'solid',
        'tags': ['plaza-park', 'clock', 'plaza', 'lightAnchor'],
        'lightAnchor': True,
        'lightPos': {'x': 8, 'y': 13, 'radius': 44, 'color': '#f6e7b8'},
        'fn': draw_plaza_clock_pillar,
    },
    {
        'id': 'mf-obj-notice_board',
        'name': '동네 지붕 게시판',
        'category': 'plaza-park',
        'size': (32, 32),
        'pc': 'solid',
        'tags': ['plaza-park', 'notice', 'board', 'community'],
        'fn': draw_notice_board,
    },
    {
        'id': 'mf-obj-red_mailbox',
        'name': '빨간 우체통',
        'category': 'plaza-park',
        'size': (16, 32),
        'pc': 'solid',
        'tags': ['plaza-park', 'mailbox', 'street', 'post'],
        'fn': draw_red_mailbox,
    },
    {
        'id': 'mf-obj-bike_share_dock',
        'name': '공공자전거 대여소',
        'category': 'plaza-park',
        'size': (48, 16),
        'pc': 'solid',
        'tags': ['plaza-park', 'bike', 'dock', 'transit'],
        'fn': draw_bike_share_dock,
    },
    {
        'id': 'mf-obj-street_trash_bin',
        'name': '거리 분리수거 쓰레기통',
        'category': 'plaza-park',
        'size': (16, 16),
        'pc': 'solid',
        'tags': ['plaza-park', 'trash', 'bin', 'street'],
        'fn': draw_street_trash_bin,
    },
    {
        'id': 'mf-obj-park_stone_lantern',
        'name': '공원 석등롱',
        'category': 'plaza-park',
        'size': (16, 32),
        'pc': 'solid',
        'tags': ['plaza-park', 'lantern', 'stone', 'park', 'lightAnchor'],
        'lightAnchor': True,
        'lightPos': {'x': 8, 'y': 13, 'radius': 40, 'color': '#f6cc7c'},
        'fn': draw_park_stone_lantern,
    },

    # Category: road-barriers (10)
    {
        'id': 'mf-obj-steel_guardrail',
        'name': '백색 도로 가드레일',
        'category': 'road-barriers',
        'size': (32, 16),
        'pc': 'solid',
        'tags': ['road-barriers', 'guardrail', 'road', 'barrier'],
        'fn': draw_steel_guardrail,
    },
    {
        'id': 'mf-obj-stone_bollard',
        'name': '화강암 볼라드',
        'category': 'road-barriers',
        'size': (16, 16),
        'pc': 'solid',
        'tags': ['road-barriers', 'bollard', 'sidewalk', 'stone'],
        'fn': draw_stone_bollard,
    },
    {
        'id': 'mf-obj-chainlink_fence',
        'name': '철망 울타리',
        'category': 'road-barriers',
        'size': (32, 32),
        'pc': 'solid',
        'tags': ['road-barriers', 'fence', 'chainlink', 'barrier'],
        'fn': draw_chainlink_fence,
    },
    {
        'id': 'mf-obj-brick_garden_wall',
        'name': '붉은 벽돌 정원 담장',
        'category': 'road-barriers',
        'size': (32, 16),
        'pc': 'solid',
        'tags': ['road-barriers', 'wall', 'brick', 'garden'],
        'fn': draw_brick_garden_wall,
    },
    {
        'id': 'mf-obj-concrete_block_wall',
        'name': '시멘트 블록 골목 담장',
        'category': 'road-barriers',
        'size': (32, 32),
        'pc': 'solid',
        'tags': ['road-barriers', 'wall', 'concrete', 'alley'],
        'fn': draw_concrete_block_wall,
    },
    {
        'id': 'mf-obj-subway_stair_rail',
        'name': '지하철역 계단 출입구',
        'category': 'road-barriers',
        'size': (48, 32),
        'pc': 'solid',
        'tags': ['road-barriers', 'subway', 'stairs', 'transit', 'lightAnchor'],
        'lightAnchor': True,
        'lightPos': {'x': 24, 'y': 4, 'radius': 52, 'color': '#a0c0e0'},
        'fn': draw_subway_stair_rail,
    },
    {
        'id': 'mf-obj-canal_railing',
        'name': '하천·운하 철제 난간',
        'category': 'road-barriers',
        'size': (32, 16),
        'pc': 'solid',
        'tags': ['road-barriers', 'railing', 'canal', 'waterfront'],
        'fn': draw_canal_railing,
    },
    {
        'id': 'mf-obj-parking_wheelstop',
        'name': '주차장 카스토퍼',
        'category': 'road-barriers',
        'size': (32, 16),
        'pc': 'solid',
        'tags': ['road-barriers', 'parking', 'wheelstop', 'road'],
        'fn': draw_parking_wheelstop,
    },
    {
        'id': 'mf-obj-speed_bump',
        'name': '도로 과속방지턱',
        'category': 'road-barriers',
        'size': (32, 16),
        'pc': 'flat',
        'tags': ['road-barriers', 'speed-bump', 'road', 'traffic'],
        'fn': draw_speed_bump,
    },
    {
        'id': 'mf-obj-tactile_drain_set',
        'name': '점자블록·측구 배수구 세트',
        'category': 'road-barriers',
        'size': (32, 16),
        'pc': 'flat',
        'tags': ['road-barriers', 'tactile', 'drain', 'curb', 'road'],
        'fn': draw_tactile_drain_set,
    },
]


def build_batch():
    out_dir = os.path.join(OUT_ROOT, 'objects', 'batch_05')
    os.makedirs(out_dir, exist_ok=True)
    meta_items = []
    for spec in ITEMS:
        w, h = spec['size']
        cv = Canvas(w, h)
        spec['fn'](cv)
        out_path = os.path.join(out_dir, f"{spec['id']}.png")
        cv.save(out_path)
        entry = {
            'id': spec['id'],
            'name': spec['name'],
            'category': spec['category'],
            'w': w // 16,
            'h': h // 16,
            'px': [w, h],
            'layer': 'object',
            'pc': spec['pc'],
            'tags': spec['tags'],
            'file': f"{spec['id']}.png",
        }
        if spec.get('lightAnchor'):
            entry['lightAnchor'] = True
            entry['lightPos'] = spec['lightPos']
        meta_items.append(entry)

    manifest = {
        'batch': 'batch_05',
        'kind': 'objects',
        'palette': 'tiledata/jp-city/fable-city/palette.json',
        'count': len(meta_items),
        'items': meta_items,
    }
    mpath = os.path.join(out_dir, 'manifest.json')
    with open(mpath, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f'batch_05: generated {len(meta_items)} objects -> {out_dir}')


if __name__ == '__main__':
    build_batch()
