#!/usr/bin/env python3
"""Modern-Fable Objects — Batch O1 (20 street-infra & signage-lighting sprites).

Strictly locked to tiledata/jp-city/fable-city/palette.json via fable_lib.
Top-3/4 RPG camera angle (sunlit top planes/caps, top-left lighting, warm-violet/slate
outlines, grounded bases/shadows, rich 10-18 color shading ramps).
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from fable_lib import Canvas, col, hsh, OUT_ROOT


# ---------------------------------------------------------------------------
# Reusable Fable-style pixel-art helpers
# ---------------------------------------------------------------------------

def draw_shadow(cv, x0, x1, y, rx_taper=True):
    """Crisp grounded contact shadow (2px band, ink:0 core + ink:1 outer ends)."""
    for x in range(x0, x1):
        edge = (x == x0 or x == x1 - 1)
        if not (rx_taper and edge):
            cv.p(x, y, col('ink', 0))
        else:
            cv.p(x, y, col('ink', 1))
    if y + 1 < cv.h:
        for x in range(x0 + 1, x1 - 1):
            cv.p(x, y + 1, col('ink', 1))


def draw_pole(cv, x0, x1, y0, y1, ramp='steel', outline=None, cap=True):
    """Vertical cylindrical pole with top-left sunlit highlight and rounded 3/4 cap."""
    w = x1 - x0
    ol = outline or col(ramp, 0)
    if cap and y0 > 0:
        cv.hline(x0 + 1, x1 - 1, y0 - 1, ol)
    for y in range(y0, y1):
        for x in range(x0, x1):
            rx = x - x0
            if rx == 0 or rx == w - 1:
                cv.p(x, y, ol)
            elif w == 3:
                cv.p(x, y, col(ramp, 4 if y > y0 else 6))
            elif w == 4:
                c_i = 5 if rx == 1 else 2
                if y == y0:
                    c_i = min(6, c_i + 1)
                cv.p(x, y, col(ramp, c_i))
            elif w == 5:
                c_i = (5, 4, 2)[rx - 1]
                if y == y0:
                    c_i = min(6, c_i + 1)
                cv.p(x, y, col(ramp, c_i))
            else:
                # width >= 6
                frac = (rx - 1) / max(1, w - 3)
                if frac < 0.25:
                    c_i = 5
                elif frac < 0.55:
                    c_i = 4
                elif frac < 0.80:
                    c_i = 3
                else:
                    c_i = 2
                if y == y0:
                    c_i = min(6, c_i + 1)
                cv.p(x, y, col(ramp, c_i))


def draw_plinth(cv, x0, x1, y0, y1, ramp='concrete'):
    """Grounded top-3/4 beveled concrete/steel plinth with sunlit top rim."""
    ol = col(ramp, 0)
    cv.hline(x0 + 1, x1 - 1, y0, ol)
    if y1 - y0 >= 3:
        cv.p(x0, y0 + 1, ol)
        cv.hline(x0 + 1, x1 - 1, y0 + 1, col(ramp, 6))
        cv.p(x1 - 1, y0 + 1, ol)
    for y in range(y0 + 2, y1 - 1):
        cv.p(x0, y, ol)
        for x in range(x0 + 1, x1 - 1):
            # Left lighter, right shaded
            t = 4 if x < (x0 + x1) // 2 else (3 if x < x1 - 2 else 2)
            cv.p(x, y, col(ramp, t))
        cv.p(x1 - 1, y, ol)
    cv.hline(x0, x1, y1 - 1, ol)


def draw_box34(cv, x0, y0, x1, y1, top_h, ramp, outline=None, top_ramp=None):
    """Top-3/4 volumetric box: sunlit top plane (top_h px) + shaded front face."""
    ol = outline or col(ramp, 0)
    tr = top_ramp or ramp
    # Top plane
    cv.hline(x0 + 1, x1 - 1, y0, ol)
    for y in range(y0 + 1, y0 + top_h):
        cv.p(x0, y, ol)
        for x in range(x0 + 1, x1 - 1):
            if y == y0 + 1:
                cv.p(x, y, col(tr, 6 if x < x1 - 3 else 5))
            elif y == y0 + top_h - 1:
                cv.p(x, y, col(tr, 4 if x < x1 - 2 else 3))
            else:
                cv.p(x, y, col(tr, 5 if x < (x0 + x1) // 2 + 2 else 4))
        cv.p(x1 - 1, y, ol)
    # Front ridge highlight/separator
    ry = y0 + top_h
    if ry < y1 - 1:
        cv.p(x0, ry, ol)
        cv.hline(x0 + 1, x1 - 1, ry, col(ramp, 2))
        cv.p(x1 - 1, ry, ol)
    # Front face
    for y in range(ry + 1, y1 - 1):
        cv.p(x0, y, ol)
        for x in range(x0 + 1, x1 - 1):
            if x == x0 + 1:
                cv.p(x, y, col(ramp, 4))
            elif x >= x1 - 3:
                cv.p(x, y, col(ramp, 2))
            else:
                cv.p(x, y, col(ramp, 3))
        cv.p(x1 - 1, y, ol)
    cv.hline(x0, x1, y1 - 1, ol)


def draw_disc(cv, cx, cy, r, fn):
    """Fill pixels inside circle (x-cx)^2 + (y-cy)^2 <= r^2 using callback fn(x, y, dx, dy, dist)."""
    x0 = int(math.floor(cx - r - 1))
    x1 = int(math.ceil(cx + r + 1))
    y0 = int(math.floor(cy - r - 1))
    y1 = int(math.ceil(cy + r + 1))
    for y in range(max(0, y0), min(cv.h, y1 + 1)):
        for x in range(max(0, x0), min(cv.w, x1 + 1)):
            dx = x - cx
            dy = y - cy
            d = math.hypot(dx, dy)
            if d <= r:
                c = fn(x, y, dx, dy, d)
                if c is not None:
                    cv.p(x, y, c)


def draw_cone(cv, cx, bot_y):
    """Crisp 7x9 orange traffic cone with reflective white collar and dark weighted base."""
    # Base (7px wide at bot_y-1..bot_y)
    cv.hline(cx - 3, cx + 4, bot_y, col('ink', 0))
    cv.p(cx - 3, bot_y - 1, col('red', 0))
    cv.hline(cx - 2, cx + 3, bot_y - 1, col('red', 2))
    cv.p(cx - 2, bot_y - 1, col('orange', 3))
    cv.p(cx + 3, bot_y - 1, col('red', 0))
    # Tapered orange cone body (rows up from bot_y-2 to bot_y-8)
    rows = [
        (-2, 2, False),
        (-3, 2, False),
        (-4, 1, True),   # white reflective band
        (-5, 1, True),   # white reflective band
        (-6, 1, False),
        (-7, 0, False),
        (-8, 0, False),
    ]
    for dy, hw, is_band in rows:
        y = bot_y + dy
        cv.p(cx - hw - 1, y, col('red', 0))
        cv.p(cx + hw + 1, y, col('red', 0))
        for x in range(cx - hw, cx + hw + 1):
            if is_band:
                c = col('white', 6) if x <= cx else col('coolwhite', 3)
            else:
                if x < cx:
                    c = col('orange', 5)
                elif x == cx:
                    c = col('orange', 4)
                else:
                    c = col('orange', 2)
            cv.p(x, y, c)
    # Top outline cap
    cv.p(cx, bot_y - 9, col('red', 0))


# ---------------------------------------------------------------------------
# Category 1: street-infra (10 sprites)
# ---------------------------------------------------------------------------

def draw_utility_pole(cv):
    """1. mf-obj-utility_pole (16x64) — Concrete utility pole, transformer, crossarms, insulators, warning wrap."""
    # Ground shadow & concrete base collar
    draw_shadow(cv, 3, 14, 62)
    draw_plinth(cv, 4, 13, 57, 62, 'concrete')

    # Tapered concrete pole shaft: top (x=6..10) -> mid (x=6..11) -> bottom (x=5..11)
    # Top cap at y=1..3
    cv.hline(7, 10, 1, col('concrete', 0))
    cv.p(6, 2, col('concrete', 0))
    cv.p(7, 2, col('concrete', 6))
    cv.p(8, 2, col('concrete', 5))
    cv.p(9, 2, col('concrete', 3))
    cv.p(10, 2, col('concrete', 0))

    for y in range(3, 58):
        if y < 22:
            x0, x1 = 6, 11
        else:
            x0, x1 = 5, 12
        for x in range(x0, x1):
            rx = x - x0
            w = x1 - x0
            if rx == 0 or rx == w - 1:
                cv.p(x, y, col('concrete', 0))
            elif rx == 1:
                cv.p(x, y, col('concrete', 5 if hsh(x, y, 1) > 0.2 else 6))
            elif rx == 2:
                cv.p(x, y, col('concrete', 4 if hsh(x, y, 2) > 0.25 else 5))
            elif rx == w - 2:
                cv.p(x, y, col('concrete', 2 if hsh(x, y, 3) > 0.2 else 1))
            else:
                cv.p(x, y, col('concrete', 3 if hsh(x, y, 4) > 0.3 else 4))

    # Climbing iron pegs along shaft
    for py, side in [(13, 1), (19, 0), (35, 1), (41, 0), (44, 1)]:
        if side == 0:
            cv.hline(3, 6, py, col('steel', 4))
            cv.hline(3, 6, py + 1, col('steel', 1))
        else:
            cv.hline(11, 14, py, col('steel', 4))
            cv.hline(11, 14, py + 1, col('steel', 1))

    # Diagonal braces under crossarm 1 (y=9..12)
    for i in range(3):
        cv.p(4 + i, 9 + i, col('steel', 2))
        cv.p(12 - i, 9 + i, col('steel', 2))

    # Upper steel crossarm #1 (y=6..9, x=1..15)
    cv.hline(1, 15, 6, col('steel', 0))
    cv.hline(1, 15, 7, col('steel', 5))
    cv.hline(1, 15, 8, col('steel', 2))
    cv.hline(1, 15, 9, col('steel', 0))
    cv.vline(1, 6, 10, col('steel', 0))
    cv.vline(14, 6, 10, col('steel', 0))
    # Center steel clamp collar
    cv.rect(6, 6, 11, 10, col('steel', 2))
    cv.hline(7, 10, 7, col('steel', 5))

    # White ceramic pin insulators on crossarm #1 (x=2, x=12, and top-right pin)
    for ix in (2, 12):
        cv.p(ix, 3, col('steel', 1))
        cv.p(ix + 1, 3, col('steel', 1))
        cv.p(ix, 4, col('white', 6))
        cv.p(ix + 1, 4, col('white', 4))
        cv.p(ix, 5, col('coolwhite', 3))
        cv.p(ix + 1, 5, col('steel', 2))
    # Drooping dark wire connecting left & right insulators
    for wx, wy in [(1, 5), (4, 5), (5, 6), (11, 5), (14, 5)]:
        cv.p(wx, wy, col('kuro', 1))

    # Lower crossarm #2 (y=15..18, x=2..14) + brace
    cv.p(5, 18, col('steel', 2))
    cv.p(11, 18, col('steel', 2))
    cv.hline(2, 14, 15, col('steel', 0))
    cv.hline(2, 14, 16, col('steel', 4))
    cv.hline(2, 14, 17, col('steel', 2))
    cv.hline(2, 14, 18, col('steel', 0))
    # Ceramic insulators on lower crossarm
    for ix in (3, 11):
        cv.p(ix, 13, col('white', 6))
        cv.p(ix + 1, 13, col('white', 3))
        cv.p(ix, 14, col('steel', 3))
        cv.p(ix + 1, 14, col('steel', 1))

    # Coiled cables hanging on right side below lower crossarm (x=11..15, y=18..25)
    for y in range(18, 25):
        cv.p(12, y, col('kuro', 0))
        cv.p(14, y, col('kuro', 0))
    cv.p(13, 18, col('steel', 3))
    cv.p(13, 19, col('kuro', 1))
    cv.p(13, 21, col('steel', 3))
    cv.p(13, 22, col('kuro', 1))
    cv.p(13, 24, col('kuro', 0))
    cv.p(12, 23, col('steel', 2))

    # Pole-mounted dark transformer cylinder (left/front of pole, x=1..9, y=21..34)
    # Two ceramic bushings on top of transformer
    for bx in (3, 6):
        cv.p(bx, 19, col('white', 6))
        cv.p(bx, 20, col('coolwhite', 3))
    # 3/4 oval sunlit top lid of transformer
    cv.hline(2, 8, 21, col('steel', 0))
    cv.p(1, 22, col('steel', 0))
    cv.hline(2, 8, 22, col('steel', 5))
    cv.p(2, 22, col('steel', 6))
    cv.p(7, 22, col('steel', 3))
    cv.p(8, 22, col('steel', 0))
    # Cylinder body
    for y in range(23, 33):
        cv.p(1, y, col('kuro', 0))
        cv.p(2, y, col('steel', 4))
        cv.p(3, y, col('steel', 3))
        cv.p(4, y, col('kawara', 3))
        cv.p(5, y, col('kawara', 2))
        cv.p(6, y, col('steel', 1))
        cv.p(7, y, col('kuro', 1))
        cv.p(8, y, col('kuro', 0))
    # Transformer cooling rib bands + yellow high-voltage decal
    cv.hline(2, 8, 25, col('steel', 1))
    cv.hline(2, 8, 30, col('steel', 1))
    cv.p(3, 27, col('yellow', 5))
    cv.p(4, 27, col('yellow', 4))
    cv.p(3, 28, col('orange', 3))
    cv.p(4, 28, col('kuro', 0))
    # Bottom rim
    cv.hline(2, 8, 33, col('kuro', 0))
    # Steel mounting straps wrapping pole
    cv.hline(8, 12, 24, col('steel', 4))
    cv.hline(8, 12, 25, col('steel', 1))
    cv.hline(8, 12, 30, col('steel', 4))
    cv.hline(8, 12, 31, col('steel', 1))

    # Yellow/black diagonal hazard wrap near base (y=47..56, x=5..12)
    for y in range(47, 56):
        cv.p(5, y, col('ink', 0))
        cv.p(11, y, col('ink', 0))
        for x in range(6, 11):
            stripe = ((x + y) // 2) % 2 == 0
            if stripe:
                c = col('yellow', 5 if x <= 7 else (4 if x <= 9 else 3))
            else:
                c = col('kuro', 1 if x <= 7 else 0)
            cv.p(x, y, c)
    # Wrap border bands
    cv.hline(5, 12, 46, col('steel', 1))
    cv.hline(5, 12, 56, col('steel', 1))


def draw_streetlamp_single(cv):
    """2. mf-obj-streetlamp_single (16x48) — Modern curved streetlamp with warm glowing lantern head."""
    # Ground shadow + stepped plinth
    draw_shadow(cv, 1, 11, 46)
    draw_plinth(cv, 2, 10, 42, 46, 'concrete')
    # Dark steel base pedestal (y=36..42, x=3..9)
    draw_box34(cv, 3, 35, 9, 43, 2, 'steel', outline=col('kuro', 0))
    # Inspection plate
    cv.rect(5, 38, 7, 41, col('steel', 4))
    cv.p(6, 39, col('steel', 2))

    # Tapered dark steel pole (x=4..8, y=10..36)
    draw_pole(cv, 4, 8, 10, 36, 'steel', outline=col('kuro', 0), cap=False)
    # Decorative mid-ring collar
    cv.hline(3, 9, 23, col('steel', 5))
    cv.hline(3, 9, 24, col('steel', 1))

    # Smooth curved goose-neck arm arching from x=4..7, y=10 up to x=11, y=3
    arm_pts = [
        (4, 9), (5, 9), (6, 9),
        (4, 8), (5, 8), (6, 8),
        (4, 7), (5, 7), (6, 7),
        (5, 6), (6, 6), (7, 6),
        (5, 5), (6, 5), (7, 5), (8, 5),
        (6, 4), (7, 4), (8, 4), (9, 4), (10, 4),
        (7, 3), (8, 3), (9, 3), (10, 3), (11, 3),
    ]
    for ax, ay in arm_pts:
        cv.p(ax, ay, col('steel', 2))
    # Outline top/bottom of arm & sunlit ridge
    for ax, ay in [(4, 6), (5, 4), (6, 3), (7, 2), (8, 2), (9, 2), (10, 2), (11, 2)]:
        cv.p(ax, ay, col('kuro', 0))
    for ax, ay in [(5, 7), (5, 6), (6, 5), (7, 4), (8, 3), (9, 3), (10, 3)]:
        cv.p(ax, ay, col('steel', 5))
    for ax, ay in [(7, 7), (7, 6), (8, 5), (9, 5)]:
        cv.p(ax, ay, col('kuro', 0))

    # Glowing modern urban lantern head (x=8..15, y=4..13)
    # 3/4 sloped dark-steel hood roof
    cv.hline(9, 14, 4, col('kuro', 0))
    cv.p(8, 5, col('kuro', 0))
    cv.hline(9, 14, 5, col('steel', 5))
    cv.p(10, 5, col('steel', 6))
    cv.p(14, 5, col('kuro', 0))
    cv.p(7, 6, col('kuro', 0))
    cv.hline(8, 15, 6, col('steel', 4))
    cv.p(13, 6, col('steel', 2))
    cv.p(14, 6, col('steel', 1))
    cv.p(15, 6, col('kuro', 0))
    cv.hline(8, 15, 7, col('steel', 1))
    # Warm glowing glass diffuser lens (x=8..14, y=8..12)
    cv.p(8, 8, col('orange', 2))
    cv.p(9, 8, col('orange', 4))
    cv.hline(10, 13, 8, col('yellow', 5))
    cv.p(13, 8, col('orange', 4))
    cv.p(14, 8, col('orange', 2))

    cv.p(8, 9, col('orange', 3))
    cv.p(9, 9, col('yellow', 5))
    cv.hline(10, 13, 9, col('cream', 6))
    cv.p(13, 9, col('yellow', 5))
    cv.p(14, 9, col('orange', 3))

    cv.p(8, 10, col('orange', 2))
    cv.p(9, 10, col('yellow', 4))
    cv.hline(10, 13, 10, col('yellow', 5))
    cv.p(13, 10, col('yellow', 4))
    cv.p(14, 10, col('orange', 2))

    cv.p(9, 11, col('orange', 3))
    cv.hline(10, 13, 11, col('orange', 4))
    cv.p(13, 11, col('orange', 2))
    # Bottom lantern metal rim & finial
    cv.hline(9, 14, 12, col('steel', 1))
    cv.p(11, 13, col('steel', 2))


def draw_streetlamp_double(cv):
    """3. mf-obj-streetlamp_double (32x48) — Ornate double-armed avenue streetlamp + banner."""
    # Ground shadow & stone curb plinth
    draw_shadow(cv, 9, 23, 46)
    draw_plinth(cv, 10, 22, 42, 46, 'concrete')
    # Ornate cast-iron pedestal base (x=12..20, y=35..43)
    draw_box34(cv, 12, 35, 20, 43, 2, 'steel', outline=col('kuro', 0))
    cv.vline(14, 37, 42, col('steel', 4))
    cv.vline(17, 37, 42, col('steel', 2))
    cv.hline(13, 19, 34, col('steel', 5))
    cv.p(12, 34, col('kuro', 0))
    cv.p(19, 34, col('kuro', 0))

    # Central dark-steel column (x=14..18, y=6..35)
    draw_pole(cv, 14, 18, 6, 35, 'steel', outline=col('kuro', 0), cap=False)
    # Decorative mid-bands
    for by in (16, 29):
        cv.hline(13, 19, by, col('steel', 5))
        cv.hline(13, 19, by + 1, col('steel', 1))
    # Top finial spire + brass orb
    cv.rect(15, 3, 17, 6, col('steel', 4))
    cv.p(15, 2, col('yellow', 5))
    cv.p(16, 2, col('yellow', 4))
    cv.p(15, 1, col('kuro', 0))
    cv.p(16, 1, col('kuro', 0))

    # Symmetric ornate curved double arms spanning x=6..26, y=10..15
    for side in (-1, 1):
        # Main horizontal arch arm
        for dx in range(2, 11):
            x = 16 + side * dx if side > 0 else 15 + side * dx
            ay = 12 if dx <= 5 else (11 if dx <= 8 else 12)
            cv.p(x, ay - 1, col('kuro', 0))
            cv.p(x, ay, col('steel', 5 if side < 0 else 4))
            cv.p(x, ay + 1, col('steel', 2))
            cv.p(x, ay + 2, col('kuro', 0))
        # Scroll brace strut underneath
        for step in range(4):
            sx = (16 + side * (2 + step)) if side > 0 else (15 + side * (2 + step))
            sy = 16 - step
            cv.p(sx, sy, col('steel', 3))
            cv.p(sx, sy + 1, col('kuro', 0))

    # Dual glowing classic glass globe/box lanterns (left center x=5, right center x=26)
    for lx in (5, 26):
        # Finial tip
        cv.p(lx, 2, col('kuro', 0))
        cv.p(lx, 3, col('steel', 5))
        # 3/4 pagoda-style dark steel lantern roof
        cv.hline(lx - 2, lx + 3, 4, col('kuro', 0))
        cv.p(lx - 3, 5, col('kuro', 0))
        cv.hline(lx - 2, lx + 3, 5, col('steel', 5))
        cv.p(lx - 1, 5, col('steel', 6))
        cv.p(lx + 2, 5, col('steel', 3))
        cv.p(lx + 3, 5, col('kuro', 0))
        cv.hline(lx - 3, lx + 4, 6, col('steel', 1))
        # Glowing lantern glass cage (y=7..12)
        for y in range(7, 13):
            cv.p(lx - 3, y, col('kuro', 0))
            cv.p(lx + 3, y, col('kuro', 0))
            for x in range(lx - 2, lx + 3):
                if x == lx and y in (7, 12):
                    cv.p(x, y, col('orange', 4))
                elif abs(x - lx) <= 1 and 8 <= y <= 11:
                    cv.p(x, y, col('cream', 6) if (y in (9, 10) and x <= lx) else col('yellow', 5))
                else:
                    cv.p(x, y, col('yellow', 4) if y <= 10 else col('orange', 4))
            # Subtle vertical mullion lines on outer panes
            if y in (8, 9, 10, 11):
                cv.p(lx - 2, y, col('orange', 3))
                cv.p(lx + 2, y, col('orange', 3))
        # Bottom cradle collar
        cv.hline(lx - 2, lx + 3, 13, col('steel', 2))
        cv.hline(lx - 1, lx + 2, 14, col('steel', 1))

    # Decorative avenue cloth banner bracket on right side of pole (x=18..25, y=18..29)
    cv.hline(18, 26, 18, col('steel', 5))
    cv.hline(18, 26, 19, col('steel', 1))
    cv.hline(18, 26, 28, col('steel', 4))
    cv.hline(18, 26, 29, col('steel', 1))
    # Banner cloth
    cv.outline_box(19, 19, 25, 29, col('teal', 3), col('teal', 0), top_hi=col('teal', 4))
    cv.rect(20, 21, 24, 27, col('teal', 4))
    # Crisp emblem motif on banner (cream/yellow diamond)
    cv.p(22, 22, col('cream', 6))
    cv.hline(21, 24, 23, col('yellow', 5))
    cv.p(22, 24, col('cream', 6))
    cv.hline(21, 24, 25, col('cream', 5))


def draw_traffic_signal(cv):
    """4. mf-obj-traffic_signal (32x48) — Corner traffic light post, cantilever arm, 3-light hooded box, ped button."""
    # Ground shadow + concrete base + bolted steel flange
    draw_shadow(cv, 2, 13, 46)
    draw_plinth(cv, 3, 12, 42, 46, 'concrete')
    draw_box34(cv, 4, 39, 11, 43, 2, 'steel', outline=col('kuro', 0))

    # Main galvanized vertical steel pole (x=5..10, y=3..40)
    draw_pole(cv, 5, 10, 3, 40, 'steel', outline=col('kuro', 0), cap=True)
    # Pole reinforcement bands
    for by in (12, 22):
        cv.hline(5, 10, by, col('steel', 5))
        cv.hline(5, 10, by + 1, col('steel', 1))

    # Horizontal cantilever steel boom arm (x=9..30, y=6..10)
    cv.hline(9, 30, 6, col('kuro', 0))
    cv.hline(9, 30, 7, col('steel', 6))
    cv.hline(9, 30, 8, col('steel', 4))
    cv.hline(9, 30, 9, col('steel', 2))
    cv.hline(9, 30, 10, col('kuro', 0))
    cv.vline(30, 6, 11, col('kuro', 0))
    # Diagonal steel gusset bracket between pole and boom
    for i in range(4):
        cv.p(10 + i, 13 - i, col('steel', 3))
        cv.p(10 + i, 14 - i, col('steel', 1))

    # Hooded 3-light horizontal signal box (x=11..30, y=4..16)
    # Sunlit 3/4 top housing + white reflective trim rim
    cv.hline(12, 29, 4, col('kuro', 0))
    cv.p(11, 5, col('kuro', 0))
    cv.hline(12, 29, 5, col('steel', 5))
    cv.p(29, 5, col('kuro', 0))
    cv.p(11, 6, col('kuro', 0))
    cv.hline(12, 29, 6, col('steel', 3))
    cv.p(29, 6, col('kuro', 0))
    # Front dark housing with crisp white perimeter border
    cv.outline_box(11, 7, 30, 16, col('kuro', 1), col('kuro', 0))
    cv.hline(12, 29, 7, col('white', 5))
    cv.hline(12, 29, 15, col('coolwhite', 3))
    cv.vline(11, 7, 16, col('kuro', 0))
    cv.vline(29, 7, 16, col('kuro', 0))
    # Inner dark backing behind lenses
    cv.rect(12, 8, 29, 15, col('kuro', 0))

    # Three distinct hooded lenses: Red (x=13..17), Amber (x=19..23), Green (x=25..29)
    lenses = [
        (13, 'red', 5, 4, 3),
        (19, 'yellow', 5, 4, 2),
        (25, 'green', 5, 4, 2),
    ]
    for lx, ramp, hi, mid, lo in lenses:
        # Sunlit top hood visor over each lens
        cv.hline(lx, lx + 4, 8, col('steel', 4))
        cv.hline(lx, lx + 4, 9, col('kuro', 0))
        # Circular 4x4 lens glow
        cv.p(lx + 1, 10, col(ramp, hi))
        cv.p(lx + 2, 10, col(ramp, mid))
        cv.p(lx, 11, col(ramp, mid))
        cv.p(lx + 1, 11, col('white', 6) if ramp != 'yellow' else col('cream', 6))
        cv.p(lx + 2, 11, col(ramp, hi))
        cv.p(lx + 3, 11, col(ramp, lo))
        cv.p(lx, 12, col(ramp, lo))
        cv.p(lx + 1, 12, col(ramp, mid))
        cv.p(lx + 2, 12, col(ramp, mid))
        cv.p(lx + 3, 12, col(ramp, lo))
        cv.p(lx + 1, 13, col(ramp, lo))
        cv.p(lx + 2, 13, col(ramp, lo))

    # Small pedestrian signal / push-button box on right side of pole (x=9..14, y=25..34)
    # Mini blue instruction sign above button
    cv.outline_box(9, 25, 14, 29, col('blue', 4), col('blue', 0))
    cv.hline(10, 13, 26, col('white', 6))
    cv.p(11, 27, col('white', 5))
    # Yellow push-button box
    draw_box34(cv, 9, 29, 14, 35, 2, 'yellow', outline=col('orange', 0))
    cv.p(11, 32, col('white', 6))
    cv.p(12, 32, col('steel', 3))


def draw_ped_signal(cv):
    """5. mf-obj-ped_signal (16x48) — Slim pedestrian crossing signal pole with dual red/green walker icons."""
    # Ground shadow + concrete pad + steel base flange
    draw_shadow(cv, 3, 14, 46)
    draw_plinth(cv, 4, 13, 42, 46, 'concrete')
    draw_box34(cv, 5, 39, 12, 43, 2, 'steel', outline=col('kuro', 0))

    # Slim steel pole (x=6..11, y=2..40)
    draw_pole(cv, 6, 11, 2, 40, 'steel', outline=col('kuro', 0), cap=True)

    # Pedestrian button box on lower right side of pole (x=10..14, y=28..34)
    draw_box34(cv, 10, 28, 14, 34, 2, 'yellow', outline=col('orange', 0))
    cv.p(11, 31, col('white', 6))
    cv.p(12, 31, col('steel', 3))

    # Dual vertical signal housing mounted on front-upper pole (x=3..14, y=4..24)
    # Visible sunlit 3/4 top surface of housing
    cv.hline(4, 13, 4, col('kuro', 0))
    cv.p(3, 5, col('kuro', 0))
    cv.hline(4, 13, 5, col('steel', 5))
    cv.p(4, 5, col('steel', 6))
    cv.p(13, 5, col('kuro', 0))
    cv.p(3, 6, col('kuro', 0))
    cv.hline(4, 13, 6, col('steel', 3))
    cv.p(13, 6, col('kuro', 0))

    # Front casing body
    cv.outline_box(3, 7, 14, 24, col('kuro', 1), col('kuro', 0))
    # Subtle bevel border on housing
    cv.vline(4, 8, 23, col('steel', 3))
    cv.vline(12, 8, 23, col('steel', 1))

    # Upper lens: RED standing walker (y=8..14, x=5..12)
    cv.hline(5, 12, 8, col('steel', 4))  # hood visor top highlight
    cv.rect(5, 9, 12, 15, col('kuro', 0))
    # Standing red figure
    cv.p(8, 9, col('red', 5))
    cv.hline(7, 10, 10, col('red', 4))
    cv.p(8, 11, col('red', 5))
    cv.p(7, 11, col('red', 3))
    cv.p(9, 11, col('red', 3))
    cv.p(8, 12, col('red', 4))
    cv.p(7, 13, col('red', 4))
    cv.p(9, 13, col('red', 4))

    # Middle divider hood visor
    cv.hline(4, 13, 15, col('steel', 4))
    cv.hline(5, 12, 16, col('steel', 2))

    # Lower lens: GREEN walking figure (y=17..23, x=5..12)
    cv.rect(5, 17, 12, 23, col('kuro', 0))
    cv.p(8, 17, col('green', 5))
    cv.p(7, 18, col('teal', 4))
    cv.p(8, 18, col('green', 5))
    cv.p(9, 18, col('green', 4))
    cv.p(10, 19, col('green', 3))
    cv.p(8, 19, col('green', 5))
    cv.p(7, 20, col('green', 4))
    cv.p(9, 20, col('green', 5))
    cv.p(6, 21, col('green', 4))
    cv.p(9, 21, col('teal', 4))
    cv.p(10, 22, col('green', 3))


def draw_elec_box(cv):
    """6. mf-obj-elec_box (32x32) — Street-side electrical transformer cabinet on concrete plinth."""
    # Ground shadow + concrete plinth pad
    draw_shadow(cv, 1, 31, 30)
    draw_plinth(cv, 2, 30, 25, 30, 'concrete')
    # Concrete plinth texture ticks
    for x in (6, 13, 21, 26):
        cv.p(x, 28, col('concrete', 2))

    # Right-side steel conduit pipes entering plinth (x=27..30, y=14..26)
    cv.rect(27, 14, 30, 26, col('steel', 2))
    cv.vline(27, 14, 26, col('steel', 5))
    cv.vline(29, 14, 26, col('steel', 0))
    cv.hline(27, 30, 14, col('steel', 0))
    for cy in (17, 22):
        cv.hline(27, 30, cy, col('steel', 5))
        cv.hline(27, 30, cy + 1, col('steel', 1))

    # Cabinet main body (x=4..27, y=9..26) in sage-grey painted steel (midori ramp)
    cv.outline_box(4, 9, 27, 26, col('midori', 4), col('midori', 0))
    # Subtle left highlight & right depth shade
    cv.vline(5, 10, 25, col('midori', 5))
    cv.vline(25, 10, 25, col('midori', 2))
    cv.hline(5, 26, 10, col('midori', 2))  # under-lid cast shadow!
    cv.hline(5, 26, 24, col('midori', 2))

    # Overhanging sunlit 3/4 sloped top lid (x=3..28, y=4..10)
    cv.hline(4, 27, 4, col('midori', 0))
    cv.p(3, 5, col('midori', 0))
    cv.hline(4, 27, 5, col('midori', 7))
    cv.p(26, 5, col('midori', 5))
    cv.p(27, 5, col('midori', 0))
    for y in (6, 7):
        cv.p(3, y, col('midori', 0))
        cv.hline(4, 27, y, col('midori', 6 if y == 6 else 5))
        cv.p(25, y, col('midori', 4))
        cv.p(26, y, col('midori', 3))
        cv.p(27, y, col('midori', 0))
    cv.p(3, 8, col('midori', 0))
    cv.hline(4, 27, 8, col('midori', 4))
    cv.p(27, 8, col('midori', 0))
    cv.hline(3, 28, 9, col('midori', 1))

    # Double cabinet doors (left x=6..15, right x=16..25, y=11..24)
    cv.vline(15, 11, 25, col('midori', 1))  # center seam
    cv.vline(16, 11, 25, col('midori', 5))  # door bevel
    # Door hinges on outer edges
    for hy in (13, 21):
        cv.rect(4, hy, 6, hy + 2, col('steel', 4))
        cv.rect(25, hy, 27, hy + 2, col('steel', 2))

    # Left door: louvered ventilation slots (y=18..23) + steel latch handle
    for ly in (18, 20, 22):
        cv.hline(7, 14, ly, col('midori', 1))
        cv.hline(7, 14, ly + 1, col('midori', 6))
    # Latch handle
    cv.rect(13, 13, 15, 17, col('steel', 2))
    cv.vline(13, 13, 17, col('steel', 5))
    cv.p(14, 15, col('yellow', 4))  # small brass padlock

    # Left door upper utility ID plate
    cv.rect(7, 12, 11, 15, col('white', 5))
    cv.hline(8, 10, 13, col('steel', 2))

    # Right door: crisp equilateral yellow/black high-voltage warning triangle + lower louvers
    cv.p(20, 12, col('kuro', 0))
    cv.p(19, 13, col('kuro', 0))
    cv.p(20, 13, col('yellow', 5))
    cv.p(21, 13, col('kuro', 0))
    cv.p(18, 14, col('kuro', 0))
    cv.p(19, 14, col('yellow', 5))
    cv.p(20, 14, col('kuro', 0))  # lightning bolt center
    cv.p(21, 14, col('yellow', 4))
    cv.p(22, 14, col('kuro', 0))
    cv.p(18, 15, col('kuro', 0))
    cv.hline(19, 22, 15, col('yellow', 5))
    cv.p(20, 15, col('yellow', 4))
    cv.p(22, 15, col('kuro', 0))
    cv.hline(18, 23, 16, col('kuro', 0))
    # Right door louvers
    for ly in (19, 21):
        cv.hline(18, 24, ly, col('midori', 1))
        cv.hline(18, 24, ly + 1, col('midori', 6))


def draw_fire_hydrant(cv):
    """7. mf-obj-fire_hydrant (16x16) — Classic red cast-iron fire hydrant with bonnet nut & side caps."""
    # Grounded shadow
    draw_shadow(cv, 3, 14, 14)

    # Wide bolted cast-iron base flange (x=3..13, y=11..14)
    cv.hline(4, 12, 11, col('red', 4))
    cv.p(3, 12, col('red', 0))
    cv.hline(4, 12, 12, col('red', 3))
    cv.p(5, 12, col('red', 5))
    cv.p(10, 12, col('red', 2))
    cv.p(11, 12, col('red', 1))
    cv.p(12, 12, col('red', 0))
    cv.p(3, 13, col('red', 0))
    cv.hline(4, 12, 13, col('red', 1))
    cv.p(5, 13, col('steel', 5))  # base bolts
    cv.p(10, 13, col('steel', 4))
    cv.p(12, 13, col('red', 0))

    # Cylindrical red hydrant barrel (x=5..11, y=5..12)
    for y in range(5, 12):
        cv.p(4, y, col('red', 0))
        cv.p(5, y, col('red', 4))
        cv.p(6, y, col('red', 5))
        cv.p(7, y, col('red', 4))
        cv.p(8, y, col('red', 3))
        cv.p(9, y, col('red', 2))
        cv.p(10, y, col('red', 1))
        cv.p(11, y, col('red', 0))

    # Side hose nozzle caps (left x=2..5, right x=11..14, y=6..10)
    # Left nozzle
    cv.hline(2, 5, 6, col('red', 0))
    cv.p(2, 7, col('red', 0))
    cv.p(3, 7, col('steel', 6))
    cv.p(4, 7, col('red', 4))
    cv.p(2, 8, col('red', 0))
    cv.p(3, 8, col('steel', 4))
    cv.p(4, 8, col('red', 3))
    cv.hline(2, 5, 9, col('red', 0))
    # Right nozzle
    cv.hline(11, 14, 6, col('red', 0))
    cv.p(11, 7, col('red', 2))
    cv.p(12, 7, col('steel', 4))
    cv.p(13, 7, col('red', 0))
    cv.p(11, 8, col('red', 1))
    cv.p(12, 8, col('steel', 2))
    cv.p(13, 8, col('red', 0))
    cv.hline(11, 14, 9, col('red', 0))

    # Front center main steamer nozzle port (x=6..10, y=7..10)
    cv.hline(6, 10, 7, col('red', 5))
    cv.p(6, 8, col('red', 1))
    cv.p(7, 8, col('steel', 6))
    cv.p(8, 8, col('steel', 4))
    cv.p(9, 8, col('red', 1))
    cv.p(6, 9, col('red', 1))
    cv.p(7, 9, col('steel', 3))
    cv.p(8, 9, col('steel', 2))
    cv.p(9, 9, col('red', 0))
    cv.hline(6, 10, 10, col('red', 1))

    # Top-3/4 domed bonnet cap + lip (x=4..12, y=2..6)
    cv.hline(5, 11, 2, col('red', 0))
    cv.p(4, 3, col('red', 0))
    cv.p(5, 3, col('red', 5))
    cv.p(6, 3, col('orange', 5))  # sunlit specular gleam
    cv.p(7, 3, col('red', 5))
    cv.p(8, 3, col('red', 4))
    cv.p(9, 3, col('red', 3))
    cv.p(10, 3, col('red', 2))
    cv.p(11, 3, col('red', 0))
    # Wide bonnet brim flange (y=4..5)
    cv.p(3, 4, col('red', 0))
    cv.hline(4, 12, 4, col('red', 4))
    cv.p(5, 4, col('red', 5))
    cv.p(10, 4, col('red', 2))
    cv.p(11, 4, col('red', 1))
    cv.p(12, 4, col('red', 0))
    cv.hline(4, 12, 5, col('red', 1))

    # Top brass/silver bonnet nut (x=7..9, y=0..2)
    cv.hline(7, 9, 0, col('ink', 0))
    cv.p(6, 1, col('ink', 0))
    cv.p(7, 1, col('yellow', 5))
    cv.p(8, 1, col('yellow', 3))
    cv.p(9, 1, col('ink', 0))


def draw_convex_mirror(cv):
    """8. mf-obj-convex_mirror (16x32) — Orange-hooded convex safety mirror on striped yellow/black pole."""
    # Ground shadow + concrete base
    draw_shadow(cv, 3, 13, 30)
    draw_plinth(cv, 4, 12, 27, 30, 'concrete')

    # Yellow/black striped safety pole (x=6..10, y=14..28)
    for y in range(14, 28):
        cv.p(6, y, col('kuro', 0))
        cv.p(9, y, col('kuro', 0))
        stripe = ((y - 14) // 2) % 2 == 0
        if stripe:
            cv.p(7, y, col('yellow', 5))
            cv.p(8, y, col('yellow', 3))
        else:
            cv.p(7, y, col('kuro', 2))
            cv.p(8, y, col('kuro', 0))

    # Steel neck clamp bracket (x=5..11, y=12..15)
    cv.outline_box(5, 12, 11, 15, col('steel', 3), col('kuro', 0), top_hi=col('steel', 5))

    # Circular convex safety mirror (center 7.5, 6.8, radius 6.1)
    def mirror_px(x, y, dx, dy, d):
        if d > 5.3:
            # Outer outline
            return col('red', 0) if dy <= 1.2 else col('steel', 0)
        if d > 3.6:
            # Bold orange rain visor hood arching over top 3/4, slim white rim at bottom
            if dy < 1.0:
                if dx < -0.5 and dy < -2.2:
                    return col('orange', 5)
                elif dy < -0.5:
                    return col('orange', 4)
                return col('orange', 3)
            else:
                return col('orange', 3) if abs(dx) > 2.2 else col('white', 5)
        # Inner convex glass mirror surface (rich sky + city horizon + road reflection)
        if d > 3.05:
            return col('orange', 1) if dy < -0.4 else col('coolwhite', 4)
        # Bright specular highlight upper-left
        if -2.2 <= dx <= -0.8 and -2.0 <= dy <= -0.8:
            return col('white', 6)
        if dy < -0.2:
            # Vivid blue-cyan sky reflection
            return col('glass', 5) if dx < 0.6 else col('glass', 4)
        elif dy < 0.9:
            # City skyline silhouette band
            return col('kawara', 3) if int(x) % 2 == 0 else col('glass', 3)
        else:
            # Darker street tarmac with warm yellow lane reflection
            if abs(dx) < 0.85 and dy > 1.2:
                return col('yellow', 5)
            return col('asphalt', 4) if dx < 0 else col('asphalt', 2)

    draw_disc(cv, 7.5, 6.8, 6.1, mirror_px)


def draw_bus_shelter(cv):
    """9. mf-obj-bus_shelter (64x48) — Modern glass-and-steel bus shelter, canopy, backlit ad panel, bench, sign pole."""
    # Grounded shadow + sidewalk concrete pad (x=1..63, y=42..47)
    draw_shadow(cv, 1, 63, 46)
    draw_plinth(cv, 2, 62, 42, 46, 'concrete')
    # Subtle curb slab joints
    for gx in (14, 28, 42, 56):
        cv.vline(gx, 43, 45, col('concrete', 3))

    # Rear tempered glass wall panels (x=6..42, y=15..42)
    # 3 structural dark-steel rear columns at x=4..7, x=22..24, x=40..42
    for gx0, gx1 in [(7, 22), (24, 40)]:
        for y in range(15, 42):
            for x in range(gx0, gx1):
                rx = x - gx0
                ry = y - 15
                if ry == 0:
                    cv.p(x, y, col('glass', 1))  # roof overhang shadow on glass
                elif ry in (11, 12):
                    # Horizontal frosted white safety decal band
                    cv.p(x, y, col('coolwhite', 5) if ry == 11 else col('coolwhite', 3))
                elif (rx + ry) in (3, 4, 13, 14, 23):
                    # Crisp diagonal glass sky highlight
                    cv.p(x, y, col('glass', 5))
                elif (rx + ry) in (5, 15):
                    cv.p(x, y, col('glass', 4))
                elif ry >= 23:
                    # Darker reflection near concrete base
                    cv.p(x, y, col('glass', 2))
                else:
                    cv.p(x, y, col('glass', 3))
        # Subtle glass frame rail at top & bottom
        cv.hline(gx0, gx1, 15, col('steel', 1))
        cv.hline(gx0, gx1, 41, col('steel', 2))

    # Structural rear columns
    for cx0, cx1 in [(4, 7), (22, 24), (40, 42)]:
        draw_pole(cv, cx0, cx1, 14, 43, 'steel', outline=col('kuro', 0), cap=False)

    # Waiting wooden slatted bench in front of glass wall (x=8..39, y=31..43)
    # Steel bench legs
    for lx in (10, 23, 36):
        cv.rect(lx, 36, lx + 2, 43, col('steel', 1))
        cv.vline(lx, 36, 43, col('steel', 4))
    # Wooden backrest slat (y=29..32)
    cv.outline_box(8, 29, 39, 33, col('cedar', 4), col('wood', 0), top_hi=col('cedar', 5))
    cv.hline(9, 38, 31, col('wood', 3))
    # Sunlit 3/4 bench seat surface (y=34..38)
    cv.hline(8, 39, 34, col('wood', 0))
    cv.hline(8, 39, 35, col('cedar', 6))
    cv.hline(8, 39, 36, col('cedar', 4))
    cv.hline(8, 39, 37, col('wood', 3))
    cv.hline(8, 39, 38, col('wood', 0))
    cv.vline(8, 34, 39, col('wood', 0))
    cv.vline(38, 34, 39, col('wood', 0))
    # Armrest dividers (3 seating bays)
    for ax in (8, 18, 28, 37):
        cv.rect(ax, 32, ax + 2, 37, col('steel', 2))
        cv.p(ax, 32, col('steel', 5))
        cv.p(ax, 33, col('steel', 4))

    # Backlit Route Map & Ad Display Panel on right bay (x=42..55, y=15..43)
    cv.outline_box(42, 15, 55, 43, col('steel', 2), col('kuro', 0))
    cv.vline(43, 16, 42, col('steel', 4))
    cv.vline(53, 16, 42, col('steel', 1))
    # Glowing warm backlit poster/route screen (x=44..53, y=17..37)
    cv.rect(44, 17, 53, 37, col('cream', 5))
    cv.rect(44, 17, 53, 22, col('cream', 6))
    cv.hline(44, 53, 17, col('yellow', 5))
    # Header blue bar ("BUS MAP")
    cv.rect(45, 18, 52, 21, col('blue', 4))
    cv.hline(46, 51, 19, col('white', 6))
    # Transit route map diagram inside backlit panel!
    cv.hline(45, 52, 23, col('red', 4))
    cv.vline(47, 22, 28, col('green', 4))
    cv.hline(46, 51, 26, col('blue', 4))
    cv.p(47, 23, col('white', 6))
    cv.p(50, 23, col('yellow', 5))
    cv.p(47, 26, col('white', 6))
    # Mini timetable lines at bottom of lightbox
    for ty in (29, 31, 33, 35):
        cv.hline(45, 52, ty, col('steel', 3 if ty % 4 == 1 else 2))
        cv.p(45, ty, col('orange', 4))
    # Lower dark metal service skirt under lightbox
    cv.rect(44, 38, 53, 42, col('steel', 1))
    cv.hline(44, 53, 38, col('steel', 4))

    # Bus Route Sign Lollipop Pole cleanly separated on far right (x=58..61, y=15..43)
    draw_pole(cv, 58, 61, 16, 43, 'steel', outline=col('kuro', 0), cap=False)
    # Crisp blue bus stop emblem plaque (x=56..63, y=17..24) — zero overlap with ad panel!
    cv.outline_box(56, 17, 63, 24, col('blue', 4), col('blue', 0), top_hi=col('blue', 5))
    # Tiny crisp white bus icon inside sign
    cv.rect(58, 19, 61, 22, col('white', 6))
    cv.hline(58, 61, 20, col('glass', 3))  # windshield
    cv.p(58, 22, col('kuro', 0))  # wheels
    cv.p(60, 22, col('kuro', 0))
    # Small yellow route number tag under bus icon
    cv.outline_box(57, 25, 62, 29, col('yellow', 5), col('orange', 0))
    cv.hline(58, 61, 27, col('kuro', 0))

    # Top-3/4 Translucent Glass & Steel Canopy Roof (x=2..62, y=2..15)
    # Outer dark-steel frame
    cv.hline(3, 61, 2, col('kuro', 0))
    cv.p(2, 3, col('kuro', 0))
    cv.hline(3, 61, 3, col('steel', 5))  # sunlit north rim
    cv.p(61, 3, col('kuro', 0))
    # Sloped translucent glass roof deck (y=4..11)
    for y in range(4, 12):
        cv.p(2, y, col('kuro', 0))
        cv.p(3, y, col('steel', 4))
        for x in range(4, 60):
            # 4 structural roof ribs
            if x in (17, 18, 31, 32, 45, 46):
                cv.p(x, y, col('steel', 5 if x % 2 == 1 else 2))
            else:
                # Translucent teal-sky glass with diagonal sheen
                diag = (x + y * 2) % 13
                if diag in (0, 1):
                    cv.p(x, y, col('glass', 6))
                elif diag == 2:
                    cv.p(x, y, col('glass', 5))
                elif y <= 6:
                    cv.p(x, y, col('glass', 5))
                elif y <= 9:
                    cv.p(x, y, col('glass', 4))
                else:
                    cv.p(x, y, col('glass', 3))
        cv.p(60, y, col('steel', 2))
        cv.p(61, y, col('kuro', 0))

    # Front canopy steel fascia & overhang drip shadow (y=12..15)
    cv.p(2, 12, col('kuro', 0))
    cv.hline(3, 61, 12, col('steel', 6))  # bright sunlit front eave bevel
    cv.p(61, 12, col('kuro', 0))
    cv.p(2, 13, col('kuro', 0))
    cv.hline(3, 61, 13, col('steel', 3))
    # Subtle teal/blue metro accent stripe along front fascia
    cv.hline(8, 56, 13, col('blue', 4))
    cv.p(61, 13, col('kuro', 0))
    cv.hline(2, 62, 14, col('kuro', 0))
    cv.hline(4, 60, 15, col('ink', 1))  # cast shadow under eave


def draw_subway_pylon(cv):
    """10. mf-obj-subway_pylon (16x48) — Metro entrance illuminated totemic pylon sign."""
    # Ground shadow + stainless plinth
    draw_shadow(cv, 2, 14, 46)
    draw_plinth(cv, 2, 14, 42, 46, 'coolwhite')

    # Dark anodized lower totem body (x=3..13, y=24..43)
    cv.outline_box(3, 24, 13, 43, col('steel', 2), col('kuro', 0))
    cv.vline(4, 25, 42, col('steel', 4))  # brushed left highlight
    cv.vline(5, 25, 42, col('steel', 3))
    cv.vline(11, 25, 42, col('steel', 1))  # shaded right bevel
    # Subtle exit number plaque ("3" + arrow)
    cv.outline_box(5, 28, 11, 35, col('kuro', 1), col('kuro', 0))
    cv.rect(6, 29, 10, 32, col('yellow', 5))
    cv.p(7, 30, col('kuro', 0))
    cv.p(8, 30, col('kuro', 0))
    cv.hline(6, 10, 33, col('white', 5))
    # Vertical decorative stainless inlay strip
    cv.vline(7, 37, 41, col('coolwhite', 4))
    cv.vline(8, 37, 41, col('steel', 3))

    # Colored metro transit line band (x=2..14, y=17..25)
    cv.outline_box(2, 17, 14, 25, col('navy', 1), col('kuro', 0))
    # Left badge: Blue Line circle
    cv.rect(4, 19, 7, 23, col('blue', 4))
    cv.p(4, 19, col('blue', 5))
    cv.p(5, 20, col('white', 6))
    cv.p(5, 21, col('white', 6))
    # Right badge: Green Line circle
    cv.rect(9, 19, 12, 23, col('green', 4))
    cv.p(9, 19, col('green', 5))
    cv.p(10, 20, col('white', 6))
    cv.p(10, 21, col('white', 6))

    # Backlit luminous M sign panel shifted down by 3px (x=2..14, y=7..18)
    cv.outline_box(2, 7, 14, 18, col('white', 6), col('kuro', 0))
    cv.rect(3, 8, 13, 17, col('cream', 6))
    cv.vline(3, 8, 17, col('white', 6))
    cv.vline(12, 8, 17, col('coolwhite', 4))
    cv.hline(3, 13, 16, col('coolwhite', 4))
    # 1px cast shadow from overhanging top cap onto top of backlit M panel
    cv.hline(3, 13, 8, col('coolwhite', 3))
    cv.p(12, 8, col('coolwhite', 2))

    # Bold crisp metro "M" emblem in rich blue/navy (shifted down 2px -> y=10..15)
    for y in range(10, 16):
        cv.p(5, y, col('blue', 3))
        cv.p(10, y, col('blue', 2))
    cv.p(6, 11, col('blue', 4))
    cv.p(9, 11, col('blue', 3))
    cv.p(7, 12, col('navy', 3))
    cv.p(8, 12, col('navy', 3))
    cv.p(7, 13, col('blue', 3))
    cv.p(8, 13, col('blue', 3))

    # Overhanging sunlit cool-gray/white 3/4 top cap plane (x=1..15, y=2..8, matching elec_box)
    # Top outline (chamfered corners)
    cv.hline(2, 14, 2, col('steel', 0))
    # Row 1 of sunlit top plane (y=3): brightest top-left
    cv.p(1, 3, col('steel', 0))
    cv.hline(2, 9, 3, col('white', 6))
    cv.hline(9, 13, 3, col('coolwhite', 5))
    cv.p(13, 3, col('coolwhite', 4))
    cv.p(14, 3, col('steel', 0))
    # Row 2 of sunlit top plane (y=4): cool-gray/white gradient
    cv.p(1, 4, col('steel', 0))
    cv.hline(2, 7, 4, col('coolwhite', 5))
    cv.hline(7, 12, 4, col('coolwhite', 4))
    cv.hline(12, 14, 4, col('coolwhite', 3))
    cv.p(14, 4, col('steel', 0))
    # Row 3 of top cap plane (y=5): front lip ridge
    cv.p(1, 5, col('steel', 0))
    cv.hline(2, 11, 5, col('coolwhite', 3))
    cv.hline(11, 14, 5, col('steel', 4))
    cv.p(14, 5, col('steel', 0))
    # 1px front bevel shadow under top cap (y=6)
    cv.p(1, 6, col('kuro', 0))
    cv.hline(2, 14, 6, col('steel', 1))
    cv.p(14, 6, col('kuro', 0))
    # Crisp cast shadow line directly beneath overhang (y=7)
    cv.hline(2, 14, 7, col('kuro', 0))


# ---------------------------------------------------------------------------
# Category 2: signage-lighting (10 sprites)
# ---------------------------------------------------------------------------

def draw_aframe_chalkboard(cv):
    """11. mf-obj-aframe_chalkboard (16x16) — Wooden A-frame sidewalk cafe chalkboard with coffee doodle."""
    # Ground shadow under front & rear A-frame feet
    draw_shadow(cv, 2, 14, 14)
    cv.p(0, 13, col('ink', 1))
    cv.p(1, 13, col('ink', 1))
    cv.p(14, 13, col('ink', 1))
    cv.p(15, 13, col('ink', 1))

    # 1-2px angled dark rear A-frame support legs clearly peeking out behind left & right sides (x=0..1, x=14..15)
    # Left rear angled leg (receding up-inward toward hinge, grounded 2px higher than front feet for 3/4 depth)
    cv.p(1, 5, col('wood', 0))
    cv.p(1, 6, col('wood', 1))
    cv.p(1, 7, col('wood', 1))
    cv.p(0, 8, col('wood', 0))
    cv.p(1, 8, col('wood', 2))
    cv.p(0, 9, col('wood', 1))
    cv.p(1, 9, col('wood', 0))
    cv.p(0, 10, col('wood', 1))
    cv.p(1, 10, col('steel', 2))  # hinge chain/stay hint
    cv.p(0, 11, col('wood', 1))
    cv.p(1, 11, col('wood', 0))
    cv.p(0, 12, col('wood', 0))
    cv.p(1, 12, col('wood', 0))

    # Right rear angled leg (mirror on right side)
    cv.p(14, 5, col('wood', 0))
    cv.p(14, 6, col('wood', 1))
    cv.p(14, 7, col('wood', 1))
    cv.p(14, 8, col('wood', 2))
    cv.p(15, 8, col('wood', 0))
    cv.p(14, 9, col('wood', 0))
    cv.p(15, 9, col('wood', 1))
    cv.p(14, 10, col('steel', 2))  # hinge chain/stay hint
    cv.p(15, 10, col('wood', 1))
    cv.p(14, 11, col('wood', 0))
    cv.p(15, 11, col('wood', 1))
    cv.p(14, 12, col('wood', 0))
    cv.p(15, 12, col('wood', 0))

    # Front wooden frame + 1px sunlit top wood hinge edge (x=2..14, y=1..15)
    cv.hline(3, 13, 1, col('wood', 0))
    cv.p(2, 2, col('wood', 0))
    cv.hline(3, 12, 2, col('cedar', 6))  # crisp 1px sunlit top wood hinge edge
    cv.p(12, 2, col('cedar', 5))
    cv.p(13, 2, col('wood', 0))
    # Main wooden frame around slate
    cv.outline_box(2, 3, 14, 13, col('wood', 4), col('wood', 0), top_hi=col('wood', 3), bot_sh=col('wood', 2))
    cv.vline(3, 3, 12, col('cedar', 5))  # sunlit left wood stile
    cv.vline(12, 3, 12, col('wood', 3))  # shaded right wood stile
    # Front standing feet extending down to y=15 (lower than rear feet at y=12)
    cv.rect(2, 12, 5, 15, col('wood', 3))
    cv.vline(2, 12, 15, col('wood', 0))
    cv.vline(3, 12, 15, col('cedar', 5))
    cv.vline(4, 12, 15, col('wood', 0))
    cv.rect(11, 12, 14, 15, col('wood', 2))
    cv.vline(11, 12, 15, col('wood', 0))
    cv.vline(12, 12, 15, col('wood', 4))
    cv.vline(13, 12, 15, col('wood', 0))
    cv.hline(2, 5, 15, col('wood', 0))
    cv.hline(11, 14, 15, col('wood', 0))

    # Dark slate chalkboard face (x=4..12, y=4..11)
    cv.rect(4, 4, 12, 11, col('kuro', 1))
    cv.hline(4, 12, 4, col('kuro', 0))  # inner top recess shadow

    # Crisp readable chalk layout: tiny coffee cup icon at top + 2 clean horizontal chalk text lines
    # Tiny steaming cup icon centered at top (y=5..6)
    cv.hline(6, 9, 5, col('white', 6))
    cv.p(9, 5, col('yellow', 5))  # tiny cup handle
    cv.hline(6, 9, 6, col('cream', 5))
    # Clean horizontal chalk text line #1 (y=8, with word break)
    cv.hline(5, 8, 8, col('yellow', 5))
    cv.hline(9, 11, 8, col('yellow', 5))
    # Clean horizontal chalk text line #2 (y=10, separated by clean dark slate gap at y=9)
    cv.hline(5, 10, 10, col('white', 6))
    cv.p(10, 10, col('cream', 5))


def draw_neon_blade_cafe(cv):
    """12. mf-obj-neon_blade_cafe (16x32) — Vertical glowing cafe/bar neon blade sign on steel bracket."""
    # Ground shadow + bolted base foot on left stanchion
    draw_shadow(cv, 1, 9, 30)
    draw_plinth(cv, 1, 8, 28, 30, 'steel')

    # Vertical dark-steel mounting rail/stanchion on left (x=2..5, y=2..29)
    draw_pole(cv, 2, 5, 2, 29, 'steel', outline=col('kuro', 0), cap=True)
    # Twin horizontal mounting steel brackets connecting rail to neon sign box
    for by in (6, 19):
        cv.hline(4, 7, by, col('steel', 5))
        cv.hline(4, 7, by + 1, col('steel', 1))

    # Glowing vertical neon blade sign housing (x=6..15, y=2..24)
    # 3/4 sunlit dark-steel top cap
    cv.hline(7, 14, 2, col('kuro', 0))
    cv.p(6, 3, col('kuro', 0))
    cv.hline(7, 14, 3, col('steel', 5))
    cv.p(14, 3, col('kuro', 0))
    cv.hline(6, 15, 4, col('navy', 0))

    # Deep dark-navy illuminated sign box body
    cv.outline_box(6, 4, 15, 24, col('navy', 0), col('kuro', 0))
    cv.rect(7, 5, 14, 23, col('navy', 1))

    # Glowing hot-pink/magenta neon tube perimeter border inside sign
    cv.hline(7, 14, 5, col('pink', 5))
    cv.hline(7, 14, 22, col('pink', 4))
    cv.vline(7, 5, 23, col('pink', 5))
    cv.vline(13, 5, 23, col('pink', 4))
    # Corner bright neon hotspots
    for nx, ny in [(7, 5), (13, 5), (7, 22), (13, 22)]:
        cv.p(nx, ny, col('white', 6))

    # Interior glowing neon cafe emblem (top warm yellow coffee/star + teal & cream vertical bars)
    # Warm glowing coffee/cup neon icon (y=7..12)
    cv.p(10, 7, col('yellow', 5))
    cv.hline(9, 12, 8, col('cream', 6))
    cv.hline(9, 12, 9, col('yellow', 5))
    cv.p(12, 8, col('yellow', 4))
    cv.hline(8, 13, 10, col('orange', 4))

    # Glowing teal neon bar strokes ("CAFE / BAR")
    cv.hline(9, 12, 13, col('teal', 5))
    cv.p(10, 14, col('teal', 4))
    cv.hline(9, 12, 15, col('teal', 5))
    cv.hline(9, 12, 17, col('yellow', 5))
    cv.p(9, 18, col('yellow', 4))
    cv.p(11, 18, col('yellow', 4))
    cv.hline(9, 12, 19, col('cream', 6))
    # Soft pink bounce light on steel stanchion next to sign
    for gy in (8, 12, 16, 20):
        cv.p(5, gy, col('pink', 3))


def draw_conv_pylon_sign(cv):
    """13. mf-obj-conv_pylon_sign (16x48) — Tall 24h convenience store illuminated pylon sign."""
    # Ground shadow + concrete plinth
    draw_shadow(cv, 2, 14, 46)
    draw_plinth(cv, 2, 14, 42, 46, 'concrete')

    # White-enameled lower steel pylon column (x=5..11, y=21..43)
    draw_pole(cv, 5, 11, 21, 43, 'coolwhite', outline=col('steel', 0), cap=False)
    # Signature subtle vertical green/orange accent stripe on column
    cv.vline(7, 24, 41, col('green', 4))
    cv.vline(8, 24, 41, col('orange', 4))

    # Upper illuminated lightbox sign cabinet (x=2..14, y=2..22)
    # 3/4 sunlit steel cap
    cv.hline(3, 13, 2, col('steel', 0))
    cv.p(2, 3, col('steel', 0))
    cv.hline(3, 13, 3, col('steel', 6))
    cv.p(12, 3, col('steel', 4))
    cv.p(13, 3, col('steel', 0))
    cv.p(2, 4, col('steel', 0))
    cv.hline(3, 13, 4, col('steel', 3))
    cv.p(13, 4, col('steel', 0))

    # Bright white backlit face (x=2..14, y=5..22)
    cv.outline_box(2, 5, 14, 22, col('white', 6), col('steel', 0))
    cv.rect(3, 6, 13, 21, col('white', 6))
    cv.vline(12, 6, 21, col('coolwhite', 4))  # subtle right bevel

    # Iconic tri-color convenience store horizontal bands!
    # Orange top band (y=6..8)
    cv.hline(3, 13, 6, col('orange', 5))
    cv.hline(3, 13, 7, col('orange', 4))
    # Green mid-upper band (y=8..10)
    cv.hline(3, 13, 8, col('green', 5))
    cv.hline(3, 13, 9, col('green', 4))
    # White center logo zone (y=10..16) with crisp red/green "24" mark (1px margin inside frame!)
    cv.rect(3, 10, 13, 16, col('cream', 6))
    # "2" on left (x=4..7, y=11..15)
    cv.hline(4, 7, 11, col('red', 4))
    cv.p(6, 12, col('red', 4))
    cv.hline(4, 7, 13, col('red', 4))
    cv.p(4, 14, col('red', 3))
    cv.hline(4, 7, 15, col('red', 3))
    # "4" on right (x=8..11, y=11..15 — leaves x=12 crisp white margin!)
    cv.p(8, 11, col('green', 3))
    cv.p(10, 11, col('green', 3))
    cv.p(8, 12, col('green', 3))
    cv.p(10, 12, col('green', 3))
    cv.hline(8, 11, 13, col('green', 4))
    cv.p(10, 14, col('green', 3))
    cv.p(10, 15, col('green', 3))
    # Red lower band (y=16..18)
    cv.hline(3, 13, 16, col('red', 4))
    cv.hline(3, 13, 17, col('red', 3))
    # Warm glowing bottom "OPEN" strip (y=18..21)
    cv.rect(3, 18, 13, 21, col('yellow', 5))
    cv.hline(4, 12, 19, col('orange', 3))


def draw_lantern_stand(cv):
    """14. mf-obj-lantern_stand (16x32) — Wooden post with hanging glowing red/cream chochin lantern & rooflet."""
    # Ground shadow + carved stone base block
    draw_shadow(cv, 2, 13, 30)
    draw_plinth(cv, 2, 11, 27, 30, 'stone')

    # Sturdy vertical wooden post (x=3..7, y=6..28)
    draw_pole(cv, 3, 7, 6, 28, 'wood', outline=col('wood', 0), cap=False)
    # Warm cedar left highlight on post
    cv.vline(4, 7, 27, col('cedar', 4))
    # Wooden mortise arm extending right (x=6..14, y=7..10) + diagonal brace
    cv.hline(6, 14, 7, col('wood', 0))
    cv.hline(6, 14, 8, col('cedar', 5))
    cv.hline(6, 14, 9, col('wood', 3))
    cv.hline(6, 14, 10, col('wood', 0))
    cv.p(7, 10, col('wood', 4))
    cv.p(8, 10, col('wood', 2))
    cv.p(7, 11, col('wood', 3))
    # Hanging iron hook
    cv.p(10, 10, col('steel', 4))

    # Small pitched 3/4 tiled kawara rooflet cap (x=1..15, y=1..7)
    cv.hline(4, 12, 1, col('kawara', 0))
    cv.hline(3, 13, 2, col('kawara', 6))  # sunlit top ridge
    cv.p(2, 2, col('kawara', 0))
    cv.p(13, 2, col('kawara', 0))
    for y, x0, x1 in [(3, 2, 14), (4, 1, 15), (5, 1, 15)]:
        cv.p(x0, y, col('kawara', 0))
        for x in range(x0 + 1, x1 - 1):
            t = 5 if (y == 3 and x % 2 == 0) else (4 if x % 2 == 0 else 3)
            if x >= x1 - 3:
                t = max(1, t - 1)
            cv.p(x, y, col('kawara', t))
        cv.p(x1 - 1, y, col('kawara', 0))
    cv.hline(1, 15, 6, col('kawara', 0))
    cv.hline(2, 14, 6, col('wood', 1))

    # Hanging glowing red/cream chochin paper lantern (center x=10, y=11..23)
    # Top wooden collar cap
    cv.hline(8, 13, 11, col('kuro', 0))
    cv.hline(9, 12, 12, col('wood', 2))
    # Glowing oval lantern body (x=7..14, y=12..22)
    for y in range(13, 21):
        # Taper top & bottom rows
        hw = 2 if y in (13, 20) else 3
        lx0, lx1 = 10 - hw, 10 + hw + 1
        cv.p(lx0 - 1, y, col('red', 0))
        cv.p(lx1, y, col('red', 0))
        is_rib = (y in (15, 18))
        for x in range(lx0, lx1):
            if y in (13, 14, 20):
                # Red painted top & bottom bands
                c = col('red', 5 if x <= 9 else (4 if x <= 11 else 3))
            elif is_rib:
                # Subtle bamboo rib lines
                c = col('orange', 4 if abs(x - 10) <= 1 else 3)
            else:
                # Warm glowing cream-yellow paper center
                if abs(x - 10) <= 1:
                    c = col('cream', 6) if y in (16, 17) else col('yellow', 5)
                elif x < 10:
                    c = col('yellow', 5)
                else:
                    c = col('orange', 4)
            cv.p(x, y, c)
    # Tiny dark brush stroke glyph on lantern center
    cv.p(10, 16, col('ink', 1))
    cv.p(10, 17, col('ink', 0))
    cv.p(10, 19, col('ink', 1))
    # Bottom collar cap + red tassel
    cv.hline(8, 13, 21, col('kuro', 0))
    cv.p(10, 22, col('red', 4))
    cv.p(10, 23, col('red', 3))
    cv.p(10, 24, col('yellow', 4))


def draw_menu_board(cv):
    """15. mf-obj-menu_board (16x32) — Standing illuminated restaurant glass menu display case."""
    # Ground shadow
    draw_shadow(cv, 2, 14, 30)

    # Twin metal legs (x=3..5 and x=11..13, y=22..30) + bottom crossbar & flanged feet
    for lx in (3, 11):
        cv.vline(lx, 22, 30, col('kuro', 0))
        cv.vline(lx + 1, 22, 30, col('steel', 4))
        cv.vline(lx + 2, 22, 30, col('kuro', 0))
        cv.hline(lx - 1, lx + 4, 29, col('steel', 3))
        cv.hline(lx - 1, lx + 4, 30, col('kuro', 0))
    # Horizontal stabilizer bar between legs
    cv.hline(5, 11, 26, col('steel', 4))
    cv.hline(5, 11, 27, col('steel', 1))

    # Top 3/4 sloped bronze/wood canopy hood over display case (x=1..15, y=2..6)
    cv.hline(2, 14, 2, col('wood', 0))
    cv.p(1, 3, col('wood', 0))
    cv.hline(2, 14, 3, col('cedar', 6))
    cv.p(13, 3, col('cedar', 4))
    cv.p(14, 3, col('wood', 0))
    cv.p(1, 4, col('wood', 0))
    cv.hline(2, 14, 4, col('wood', 4))
    cv.p(14, 4, col('wood', 0))
    cv.hline(1, 15, 5, col('wood', 1))

    # Illuminated restaurant display case body (x=2..14, y=6..23)
    cv.outline_box(2, 6, 14, 23, col('wood', 3), col('wood', 0))
    # Inner warm backlit glass menu panel (x=3..13, y=7..21)
    cv.rect(3, 7, 13, 21, col('cream', 5))
    # Top interior warm fluorescent tube glow
    cv.hline(3, 13, 7, col('yellow', 5))
    cv.hline(3, 13, 8, col('cream', 6))
    # Red header banner strip ("MENU")
    cv.rect(4, 9, 12, 11, col('red', 4))
    cv.hline(5, 11, 10, col('cream', 6))
    # Mini food photo grid & text lines
    # Dish 1 (warm ramen/curry bowl icon)
    cv.rect(4, 12, 7, 15, col('orange', 4))
    cv.p(5, 13, col('yellow', 5))
    cv.hline(8, 12, 12, col('wood', 2))
    cv.hline(8, 11, 14, col('steel', 3))
    # Dish 2 (salad/set icon)
    cv.rect(4, 16, 7, 19, col('green', 4))
    cv.p(5, 17, col('red', 4))
    cv.hline(8, 12, 16, col('wood', 2))
    cv.hline(8, 11, 18, col('steel', 3))
    # Crisp diagonal glass reflection gleam across upper right
    cv.p(11, 8, col('white', 6))
    cv.p(10, 9, col('white', 6))
    cv.p(12, 12, col('white', 6))
    cv.p(11, 13, col('white', 6))
    # Bottom frame ledge
    cv.hline(3, 13, 21, col('wood', 2))


def draw_pharmacy_cross(cv):
    """16. mf-obj-pharmacy_cross (16x32) — Illuminated green pharmacy cross blade sign on bracket."""
    # Ground shadow + bolted foot on mounting stanchion
    draw_shadow(cv, 1, 9, 30)
    draw_plinth(cv, 1, 8, 28, 30, 'coolwhite')

    # Slim brushed-steel vertical bracket post on left (x=2..5, y=4..29)
    draw_pole(cv, 2, 5, 4, 29, 'steel', outline=col('kuro', 0), cap=True)
    # Twin horizontal mounting brackets
    for by in (7, 16):
        cv.hline(4, 6, by, col('steel', 5))
        cv.hline(4, 6, by + 1, col('steel', 1))

    # Illuminated square pharmacy blade lightbox (x=4..15, y=3..19)
    # Visible 3/4 sunlit white/steel top edge
    cv.hline(5, 14, 3, col('steel', 0))
    cv.p(4, 4, col('steel', 0))
    cv.hline(5, 14, 4, col('white', 6))
    cv.p(13, 4, col('coolwhite', 4))
    cv.p(14, 4, col('steel', 0))

    # Front deep-emerald LED box (x=4..15, y=5..19) — high contrast around glowing cross!
    cv.outline_box(4, 5, 15, 19, col('green', 0), col('steel', 0))
    cv.rect(5, 6, 14, 18, col('green', 0))
    # Subtle inner emerald bevel at corners only
    cv.p(5, 6, col('green', 1))
    cv.p(13, 6, col('green', 1))
    cv.p(5, 17, col('green', 1))
    cv.p(13, 17, col('green', 1))

    # Perfectly symmetrical 7x7 glowing GREEN + WHITE LED pharmacy cross (x=6..13, y=8..15)
    # Leaves full 1px dark emerald margin on all 4 sides so the cross pops unmistakably!
    cv.rect(8, 8, 11, 15, col('green', 4))
    cv.rect(6, 10, 13, 13, col('green', 4))
    # Bright neon green inner arms
    cv.vline(9, 8, 15, col('green', 5))
    cv.hline(6, 13, 11, col('green', 5))
    # Pure glowing white core cross inside
    cv.vline(9, 9, 14, col('white', 6))
    cv.hline(7, 12, 11, col('white', 6))
    # Soft green glow spill onto left mounting bracket
    cv.p(4, 11, col('green', 4))
    cv.p(3, 11, col('green', 3))

    # Compact secondary lower white/green mini tab under cross (x=5..14, y=19..22)
    cv.outline_box(5, 19, 14, 22, col('white', 5), col('steel', 0))
    cv.hline(6, 13, 20, col('green', 4))


def draw_barber_pole(cv):
    """17. mf-obj-barber_pole (16x32) — Classic rotating red-white-blue striped barber pole with chrome caps."""
    # Ground shadow + chrome pedestal base
    draw_shadow(cv, 3, 13, 30)
    draw_plinth(cv, 4, 12, 27, 30, 'steel')

    # Wall-mount chrome side bracket tabs on left (x=1..4)
    for by in (6, 22):
        cv.rect(1, by, 5, by + 3, col('steel', 2))
        cv.hline(1, 5, by, col('steel', 0))
        cv.hline(2, 5, by + 1, col('steel', 5))
        cv.hline(1, 5, by + 2, col('steel', 0))

    # Top glowing frosted glass orb finial (x=6..10, y=0..3)
    cv.hline(7, 9, 0, col('steel', 1))
    cv.p(6, 1, col('steel', 1))
    cv.p(7, 1, col('white', 6))
    cv.p(8, 1, col('cream', 6))
    cv.p(9, 1, col('steel', 1))
    cv.p(6, 2, col('steel', 1))
    cv.p(7, 2, col('cream', 5))
    cv.p(8, 2, col('yellow', 5))
    cv.p(9, 2, col('steel', 1))

    # Top chrome domed cap (x=4..12, y=3..7)
    cv.hline(5, 11, 3, col('steel', 0))
    cv.p(4, 4, col('steel', 0))
    cv.p(5, 4, col('coolwhite', 5))
    cv.p(6, 4, col('white', 6))
    cv.p(7, 4, col('coolwhite', 5))
    cv.p(8, 4, col('steel', 4))
    cv.p(9, 4, col('steel', 3))
    cv.p(10, 4, col('steel', 2))
    cv.p(11, 4, col('steel', 0))
    # Flared chrome flange collar
    cv.p(3, 5, col('steel', 0))
    cv.hline(4, 12, 5, col('coolwhite', 4))
    cv.p(5, 5, col('white', 6))
    cv.p(10, 5, col('steel', 2))
    cv.p(11, 5, col('steel', 1))
    cv.p(12, 5, col('steel', 0))
    cv.hline(4, 12, 6, col('steel', 1))

    # Rotating glass cylinder with red-white-blue diagonal stripes (x=4..12, y=7..23)
    for y in range(7, 23):
        cv.p(4, y, col('steel', 0))
        cv.p(11, y, col('steel', 0))
        for x in range(5, 11):
            phase = (x + y) % 8
            # Cylindrical lighting shift: left-center bright, right edge darker
            shade_shift = 1 if x == 6 else (0 if x in (5, 7, 8) else -1)
            if phase in (0, 1):
                # Red stripe
                cv.p(x, y, col('red', max(2, min(5, 4 + shade_shift))))
            elif phase in (2, 3, 6, 7):
                # White stripe
                cv.p(x, y, col('white', max(3, min(6, 5 + shade_shift))))
            else:
                # Blue stripe
                cv.p(x, y, col('blue', max(2, min(5, 4 + shade_shift))))
        # Glass specular glint along left-center x=6 (every other row so stripes still read)
        if y % 3 == 1:
            cv.p(6, y, col('white', 6))

    # Bottom chrome bell cap (x=3..13, y=23..27)
    cv.hline(4, 12, 23, col('steel', 1))
    cv.p(3, 24, col('steel', 0))
    cv.hline(4, 12, 24, col('coolwhite', 4))
    cv.p(5, 24, col('white', 6))
    cv.p(10, 24, col('steel', 2))
    cv.p(12, 24, col('steel', 0))
    cv.p(4, 25, col('steel', 0))
    cv.hline(5, 11, 25, col('steel', 3))
    cv.p(6, 25, col('coolwhite', 5))
    cv.p(11, 25, col('steel', 0))
    cv.hline(5, 11, 26, col('steel', 0))


def draw_street_name_sign(cv):
    """18. mf-obj-street_name_sign (32x48) — Tall blue-and-white directional street name signpost."""
    # Ground shadow + concrete pad + steel base collar
    draw_shadow(cv, 10, 22, 46)
    draw_plinth(cv, 11, 21, 42, 46, 'concrete')
    draw_box34(cv, 12, 39, 20, 43, 2, 'steel', outline=col('kuro', 0))

    # Tall steel signpost (x=14..18, y=3..40)
    draw_pole(cv, 14, 18, 3, 40, 'steel', outline=col('kuro', 0), cap=True)
    # Small decorative silver finial ball at top
    cv.hline(15, 17, 1, col('steel', 0))
    cv.p(15, 2, col('coolwhite', 5))
    cv.p(16, 2, col('steel', 3))

    # Mid-pole small address/district info plaque (x=12..20, y=26..32)
    cv.outline_box(12, 26, 20, 32, col('white', 5), col('steel', 0))
    cv.rect(13, 27, 19, 29, col('blue', 4))
    cv.hline(14, 18, 30, col('steel', 2))

    # Upper directional road plate pointing RIGHT (x=11..30, y=6..13)
    # 3/4 sunlit top edge
    cv.hline(11, 27, 5, col('blue', 0))
    cv.hline(11, 27, 6, col('blue', 5))
    cv.p(11, 6, col('steel', 5))
    # Main deep-blue enamel arrow plate with crisp white lettering & chevron
    for y in range(7, 13):
        tip = 30 if y in (9, 10) else (29 if y in (8, 11) else 27)
        cv.p(10, y, col('blue', 0))
        for x in range(11, tip):
            if y == 7:
                cv.p(x, y, col('blue', 4))
            elif y == 12:
                cv.p(x, y, col('blue', 2))
            else:
                cv.p(x, y, col('blue', 3))
        cv.p(tip, y, col('blue', 0))
    cv.hline(11, 27, 13, col('blue', 0))
    # Crisp white faux street-name glyph strokes with generous blue breathing space
    for gx in (13, 16, 19, 22):
        cv.vline(gx, 9, 11, col('white', 6))
        cv.p(gx + 1, 9 if gx % 2 == 1 else 10, col('coolwhite', 5))
    # Clean white right-pointing directional arrow at tip
    cv.hline(25, 29, 9, col('white', 6))
    cv.p(27, 8, col('white', 6))
    cv.p(27, 10, col('white', 5))

    # Lower directional road plate pointing LEFT (x=2..21, y=15..22)
    cv.hline(5, 21, 14, col('blue', 0))
    cv.hline(5, 21, 15, col('blue', 5))
    for y in range(16, 22):
        tip = 1 if y in (18, 19) else (2 if y in (17, 20) else 4)
        cv.p(tip, y, col('blue', 0))
        for x in range(tip + 1, 21):
            if y == 16:
                cv.p(x, y, col('blue', 4))
            elif y == 21:
                cv.p(x, y, col('blue', 2))
            else:
                cv.p(x, y, col('blue', 3))
        cv.p(21, y, col('blue', 0))
    cv.hline(5, 21, 22, col('blue', 0))
    # Crisp white left-pointing arrow + well-spaced road name glyphs
    cv.hline(3, 7, 18, col('white', 6))
    cv.p(4, 17, col('white', 6))
    cv.p(4, 19, col('white', 5))
    for gx in (8, 11, 14):
        cv.vline(gx, 18, 20, col('white', 6))
        cv.p(gx + 1, 18 if gx % 2 == 0 else 19, col('coolwhite', 5))
    # Small green/teal district code tab on right end of lower sign
    cv.rect(17, 17, 20, 21, col('teal', 4))
    cv.p(18, 18, col('white', 6))
    cv.p(18, 19, col('white', 5))


def draw_kr_shade_umbrella(cv):
    """19. mf-obj-kr_shade_umbrella (32x32) — Korean crosswalk giant foldable sun-shade parasol."""
    # Ground shadow + heavy square concrete base block
    draw_shadow(cv, 7, 25, 30)
    draw_plinth(cv, 8, 24, 25, 30, 'concrete')
    # Central steel socket collar on top of concrete slab
    cv.rect(13, 24, 19, 27, col('steel', 3))
    cv.hline(14, 18, 24, col('steel', 5))
    cv.hline(13, 19, 26, col('steel', 1))

    # Sturdy central dark-steel umbrella post (x=14..18, y=16..25)
    draw_pole(cv, 14, 18, 16, 25, 'steel', outline=col('kuro', 0), cap=False)
    # Foldable hand-crank mechanism on right side of post
    cv.hline(18, 21, 20, col('steel', 4))
    cv.p(20, 21, col('steel', 5))
    cv.p(20, 22, col('steel', 2))

    # Shaded dark canopy underside glimpsed beneath the front skirt (y=15..18)
    for x in range(4, 28):
        cv.p(x, 16, col('green', 0))
        if 7 <= x <= 24:
            cv.p(x, 17, col('ink', 0))
    # Subtle steel umbrella rib spokes visible underneath
    for sx in (9, 13, 18, 22):
        cv.p(sx, 16, col('steel', 3))

    # Giant octagonal foldable parasol canopy seen from top-3/4 angle!
    # Elliptical dome centered at (15.5, 8.8), rx=13.8, ry=7.4
    cx, cy = 15.5, 8.8
    rx, ry = 13.8, 7.4
    for y in range(1, 18):
        for x in range(1, 31):
            nx = (x - cx) / rx
            ny = (y - cy) / ry
            ang = math.atan2(ny, nx)
            sector = int(math.floor((ang + math.pi) / (math.pi / 4.0))) % 8
            local_a = ((ang + math.pi) % (math.pi / 4.0)) - (math.pi / 8.0)
            oct_scale = 1.0 / max(0.90, math.cos(local_a * 0.65))
            d = math.hypot(nx, ny) * (0.95 / oct_scale)
            if d > 1.01:
                continue
            if d > 0.90:
                cv.p(x, y, col('green', 0) if sector % 2 == 0 else col('wood', 1))
                continue
            # Clean rib seams only past center finial radius (d > 0.28) to avoid apex speckle
            if abs(local_a) > (math.pi / 8.0 - 0.055) and d > 0.28:
                cv.p(x, y, col('green', 1) if ny > 0 else col('midori', 2))
                continue
            # Alternating rich Korean emerald green & warm cream canopy panels
            is_green = (sector % 2 == 0)
            light = -0.50 * nx - 0.65 * ny + (0.25 if d < 0.45 else 0.0)
            is_skirt = (ny > 0.58 and d > 0.72)
            if is_green:
                if is_skirt:
                    t = 2 if nx < 0.2 else 1
                elif light > 0.42:
                    t = 5
                elif light > 0.08:
                    t = 4
                elif light > -0.25:
                    t = 3
                else:
                    t = 2
                cv.p(x, y, col('green', t))
            else:
                if is_skirt:
                    t = 4 if nx < 0.2 else 3
                elif light > 0.42:
                    t = 6
                elif light > 0.08:
                    t = 5
                elif light > -0.25:
                    t = 4
                else:
                    t = 3
                cv.p(x, y, col('cream', t))

    # Central sunlit top finial hub cap at apex (x=14..18, y=5..8)
    cv.hline(14, 18, 5, col('steel', 0))
    cv.p(13, 6, col('steel', 0))
    cv.p(14, 6, col('steel', 5))
    cv.p(15, 6, col('white', 6))
    cv.p(16, 6, col('coolwhite', 5))
    cv.p(17, 6, col('steel', 3))
    cv.p(18, 6, col('steel', 0))
    cv.hline(14, 18, 7, col('steel', 1))


def draw_construction_barrier(cv):
    """20. mf-obj-construction_barrier (32x16) — Yellow/black barricade, twin orange cones, flashing amber beacon."""
    # Grounded shadow across barricade feet & cones
    draw_shadow(cv, 1, 31, 15, rx_taper=False)

    # Barricade steel A-frame legs (x=7..10 and x=22..25, y=10..15)
    for lx in (8, 22):
        cv.vline(lx, 10, 15, col('steel', 0))
        cv.vline(lx + 1, 10, 15, col('steel', 4))
        cv.vline(lx + 2, 10, 15, col('steel', 0))
        cv.hline(lx - 1, lx + 4, 14, col('steel', 2))
    # Lower horizontal steel brace bar
    cv.hline(9, 23, 12, col('steel', 4))
    cv.hline(9, 23, 13, col('steel', 1))

    # Main diagonal-striped barricade plank (x=6..26, y=4..11)
    # Visible 3/4 sunlit top rail
    cv.hline(7, 25, 4, col('kuro', 0))
    cv.p(6, 5, col('kuro', 0))
    cv.hline(7, 25, 5, col('yellow', 5))
    cv.p(24, 5, col('yellow', 3))
    cv.p(25, 5, col('kuro', 0))

    # Diagonal yellow/black hazard stripes on front board (y=6..10)
    for y in range(6, 10):
        cv.p(6, y, col('kuro', 0))
        cv.p(25, y, col('kuro', 0))
        for x in range(7, 25):
            stripe = ((x + y) // 3) % 2 == 0
            if stripe:
                c = col('yellow', 5 if y == 6 else (4 if y < 9 else 3))
            else:
                c = col('kuro', 2 if y == 6 else (1 if y < 9 else 0))
            cv.p(x, y, c)
    cv.hline(6, 26, 10, col('kuro', 0))

    # Flashing amber warning beacon centered on top bar (x=13..19, y=0..5)
    # Outer soft glow pixel sparkles
    cv.p(13, 1, col('yellow', 5))
    cv.p(18, 1, col('yellow', 4))
    # Amber dome
    cv.hline(15, 17, 0, col('orange', 4))
    cv.p(14, 1, col('orange', 4))
    cv.p(15, 1, col('cream', 6))
    cv.p(16, 1, col('yellow', 5))
    cv.p(17, 1, col('orange', 4))
    cv.p(14, 2, col('orange', 3))
    cv.p(15, 2, col('yellow', 5))
    cv.p(16, 2, col('yellow', 4))
    cv.p(17, 2, col('orange', 3))
    # Dark steel beacon base collar
    cv.hline(14, 18, 3, col('steel', 4))
    cv.hline(14, 18, 4, col('steel', 1))

    # Twin orange traffic cones flanking left & right (x=0..7 and x=25..32)
    draw_cone(cv, 3, 14)
    draw_cone(cv, 28, 14)


# ---------------------------------------------------------------------------
# Batch definition & builder
# ---------------------------------------------------------------------------

SPECS = [
    # Category: street-infra (10)
    {
        'id': 'mf-obj-utility_pole',
        'name': '전봇대 (변압기·애자)',
        'category': 'street-infra',
        'w': 1, 'h': 4, 'passableTopRows': 3,
        'tags': ['street-infra', 'pole', 'power', 'urban'],
        'fn': draw_utility_pole,
    },
    {
        'id': 'mf-obj-streetlamp_single',
        'name': '단등 가로등',
        'category': 'street-infra',
        'w': 1, 'h': 3, 'passableTopRows': 2,
        'tags': ['street-infra', 'lamp', 'lighting', 'urban'],
        'lightAnchor': [11, 9],
        'fn': draw_streetlamp_single,
    },
    {
        'id': 'mf-obj-streetlamp_double',
        'name': '대로 쌍등 가로등',
        'category': 'street-infra',
        'w': 2, 'h': 3, 'passableTopRows': 2,
        'tags': ['street-infra', 'lamp', 'lighting', 'avenue'],
        'lightAnchor': [16, 9],
        'fn': draw_streetlamp_double,
    },
    {
        'id': 'mf-obj-traffic_signal',
        'name': '교차로 3색 신호등',
        'category': 'street-infra',
        'w': 2, 'h': 3, 'passableTopRows': 2,
        'tags': ['street-infra', 'traffic', 'signal', 'crosswalk'],
        'fn': draw_traffic_signal,
    },
    {
        'id': 'mf-obj-ped_signal',
        'name': '보행자 신호등',
        'category': 'street-infra',
        'w': 1, 'h': 3, 'passableTopRows': 2,
        'tags': ['street-infra', 'traffic', 'pedestrian', 'crosswalk'],
        'fn': draw_ped_signal,
    },
    {
        'id': 'mf-obj-elec_box',
        'name': '거리 배전함',
        'category': 'street-infra',
        'w': 2, 'h': 2, 'passableTopRows': 1,
        'tags': ['street-infra', 'utility', 'transformer', 'sidewalk'],
        'fn': draw_elec_box,
    },
    {
        'id': 'mf-obj-fire_hydrant',
        'name': '붉은 소화전',
        'category': 'street-infra',
        'w': 1, 'h': 1, 'passableTopRows': 0,
        'tags': ['street-infra', 'hydrant', 'safety', 'sidewalk'],
        'fn': draw_fire_hydrant,
    },
    {
        'id': 'mf-obj-convex_mirror',
        'name': '도로 반사경',
        'category': 'street-infra',
        'w': 1, 'h': 2, 'passableTopRows': 1,
        'tags': ['street-infra', 'mirror', 'safety', 'corner'],
        'fn': draw_convex_mirror,
    },
    {
        'id': 'mf-obj-bus_shelter',
        'name': '유리 버스 정류장 쉘터',
        'category': 'street-infra',
        'w': 4, 'h': 3, 'passableTopRows': 2,
        'tags': ['street-infra', 'bus', 'transit', 'shelter', 'bench'],
        'lightAnchor': [48, 24],
        'fn': draw_bus_shelter,
    },
    {
        'id': 'mf-obj-subway_pylon',
        'name': '지하철 출구 안내 기둥',
        'category': 'street-infra',
        'w': 1, 'h': 3, 'passableTopRows': 2,
        'tags': ['street-infra', 'subway', 'metro', 'transit', 'pylon'],
        'lightAnchor': [8, 10],
        'fn': draw_subway_pylon,
    },
    # Category: signage-lighting (10)
    {
        'id': 'mf-obj-aframe_chalkboard',
        'name': '카페 A형 칠판 입간판',
        'category': 'signage-lighting',
        'w': 1, 'h': 1, 'passableTopRows': 0,
        'tags': ['signage-lighting', 'cafe', 'chalkboard', 'sidewalk'],
        'fn': draw_aframe_chalkboard,
    },
    {
        'id': 'mf-obj-neon_blade_cafe',
        'name': '카페·바 세로 네온 간판',
        'category': 'signage-lighting',
        'w': 1, 'h': 2, 'passableTopRows': 1,
        'tags': ['signage-lighting', 'neon', 'cafe', 'sign'],
        'lightAnchor': [10, 13],
        'fn': draw_neon_blade_cafe,
    },
    {
        'id': 'mf-obj-conv_pylon_sign',
        'name': '24시 편의점 지주 간판',
        'category': 'signage-lighting',
        'w': 1, 'h': 3, 'passableTopRows': 2,
        'tags': ['signage-lighting', 'convenience', 'pylon', 'sign'],
        'lightAnchor': [8, 13],
        'fn': draw_conv_pylon_sign,
    },
    {
        'id': 'mf-obj-lantern_stand',
        'name': '목제 초롱 등불 스탠드',
        'category': 'signage-lighting',
        'w': 1, 'h': 2, 'passableTopRows': 1,
        'tags': ['signage-lighting', 'lantern', 'traditional', 'lighting'],
        'lightAnchor': [10, 17],
        'fn': draw_lantern_stand,
    },
    {
        'id': 'mf-obj-menu_board',
        'name': '조명 식당 메뉴 진열대',
        'category': 'signage-lighting',
        'w': 1, 'h': 2, 'passableTopRows': 1,
        'tags': ['signage-lighting', 'menu', 'restaurant', 'display'],
        'lightAnchor': [8, 14],
        'fn': draw_menu_board,
    },
    {
        'id': 'mf-obj-pharmacy_cross',
        'name': '약국 LED 녹색 십자 간판',
        'category': 'signage-lighting',
        'w': 1, 'h': 2, 'passableTopRows': 1,
        'tags': ['signage-lighting', 'pharmacy', 'led', 'sign'],
        'lightAnchor': [10, 12],
        'fn': draw_pharmacy_cross,
    },
    {
        'id': 'mf-obj-barber_pole',
        'name': '이발소 회전 싸인볼',
        'category': 'signage-lighting',
        'w': 1, 'h': 2, 'passableTopRows': 1,
        'tags': ['signage-lighting', 'barber', 'retro', 'sign'],
        'lightAnchor': [8, 14],
        'fn': draw_barber_pole,
    },
    {
        'id': 'mf-obj-street_name_sign',
        'name': '도로명 이정표 기둥',
        'category': 'signage-lighting',
        'w': 2, 'h': 3, 'passableTopRows': 2,
        'tags': ['signage-lighting', 'road-sign', 'directional', 'street'],
        'fn': draw_street_name_sign,
    },
    {
        'id': 'mf-obj-kr_shade_umbrella',
        'name': '횡단보도 접이식 그늘막',
        'category': 'signage-lighting',
        'w': 2, 'h': 2, 'passableTopRows': 1,
        'tags': ['signage-lighting', 'parasol', 'crosswalk', 'korea'],
        'fn': draw_kr_shade_umbrella,
    },
    {
        'id': 'mf-obj-construction_barrier',
        'name': '공사 안전 바리케이드·라바콘',
        'category': 'signage-lighting',
        'w': 2, 'h': 1, 'passableTopRows': 0,
        'tags': ['signage-lighting', 'construction', 'barrier', 'cone'],
        'lightAnchor': [16, 2],
        'fn': draw_construction_barrier,
    },
]


def build_batch():
    out_dir = os.path.join(OUT_ROOT, 'objects', 'batch_01')
    os.makedirs(out_dir, exist_ok=True)
    items = []
    for spec in SPECS:
        pw, ph = spec['w'] * 16, spec['h'] * 16
        cv = Canvas(pw, ph)
        spec['fn'](cv)
        out_path = os.path.join(out_dir, f"{spec['id']}.png")
        cv.save(out_path)
        entry = {
            'id': spec['id'],
            'name': spec['name'],
            'category': spec['category'],
            'w': spec['w'],
            'h': spec['h'],
            'passableTopRows': spec['passableTopRows'],
            'tags': spec['tags'],
        }
        if 'lightAnchor' in spec:
            entry['lightAnchor'] = spec['lightAnchor']
        items.append(entry)

    manifest_path = os.path.join(out_dir, 'manifest.json')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump({'batch': 'batch_01', 'items': items}, f, ensure_ascii=False, indent=2)
    print(f'batch_01: generated {len(items)} sprites -> {out_dir}')
    return items


if __name__ == '__main__':
    build_batch()
