#!/usr/bin/env python3
"""Batch O2 (20 modern objects) in Fable 5.2 top-3/4 RPG pixel-art baseline.

Categories:
  - vending-kiosks (10): drink/snack vending machines, gacha row, ticket kiosk,
    parcel locker, phone booth, ATM kiosk, pojangmacha cart, coffee cart, newsstand kiosk.
  - seating-terrace (10): cafe bistro set, parasol patio set, wood park bench,
    stone plaza bench, rooftop pergola, water tank, AC stack, solar panel,
    rooftop laundry, rooftop garden bed.

Strictly locked to tiledata/jp-city/fable-city/palette.json (0 off-palette pixels, binary alpha).
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.abspath(os.path.join(HERE, '..')))

from fable_lib import Canvas, col, hsh, OUT_ROOT

OUT_DIR = os.path.join(OUT_ROOT, 'objects', 'batch_02')


# ---------------------------------------------------------------------------
# Shared pixel-art drawing helpers (100% Fable palette locked)
# ---------------------------------------------------------------------------

def draw_ellipse(cv, cx, cy, rx, ry, fill, border=None, hi=None):
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            dx = (x - cx) / max(rx, 0.5)
            dy = (y - cy) / max(ry, 0.5)
            d = dx * dx + dy * dy
            if d <= 1.0:
                if border is not None and d > 0.76:
                    cv.p(x, y, border)
                elif hi is not None and dy < -0.25 and dx < 0.35:
                    cv.p(x, y, hi)
                else:
                    cv.p(x, y, fill)


def draw_shadow_bar(cv, x0, x1, y, strong=True):
    """Crisp Fable-style grounded contact shadow strip (binary alpha)."""
    cv.hline(x0, x1, y, col('ink', 0 if strong else 1))
    if y + 1 < cv.h:
        for x in range(x0 + 1, x1 - 1):
            if (x % 2 == 0) or strong:
                cv.p(x, y + 1, col('ink', 1))


def draw_wheel(cv, cx, cy, r=4, spoke_c='steel:4', tire_c='asphalt:0', rim_c='steel:2'):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            d2 = (x - cx) ** 2 + (y - cy) ** 2
            if d2 <= r * r + 1:
                if d2 >= (r - 1) ** 2:
                    cv.p(x, y, tire_c)
                elif d2 <= 1:
                    cv.p(x, y, 'coolwhite:5')
                elif x == cx or y == cy or abs(x - cx) == abs(y - cy):
                    cv.p(x, y, spoke_c)
                else:
                    cv.p(x, y, rim_c)


# ===========================================================================
# CATEGORY 1: vending-kiosks (10 items)
# ===========================================================================

def draw_vending_drink_lit(cv):
    """1. mf-obj-vending_drink_lit (16x32) — Iconic glowing white/blue beverage vending machine."""
    # Ground shadow
    draw_shadow_bar(cv, 2, 14, 30, strong=True)

    # Outer silhouette shell with 1px chamfered top corners
    cv.outline_box(2, 1, 14, 30, col('coolwhite', 4), col('ink', 0))
    cv.clear(2, 1, 3, 2)
    cv.clear(13, 1, 14, 2)
    cv.p(3, 1, col('ink', 0))
    cv.p(12, 1, col('ink', 0))
    cv.p(2, 2, col('ink', 0))
    cv.p(13, 2, col('ink', 0))

    # Top 3/4 sunlit roof plane (y=1..5)
    cv.rect(3, 2, 13, 5, col('white', 6))
    cv.hline(4, 12, 2, col('white', 6))
    cv.hline(3, 13, 3, col('coolwhite', 5))
    cv.hline(3, 13, 4, col('coolwhite', 3))
    cv.hline(2, 14, 5, col('blue', 2))  # front top fascia lip
    cv.hline(3, 12, 5, col('blue', 4))
    cv.p(12, 5, col('blue', 3))
    cv.p(13, 5, col('blue', 1))

    # Right-side 3/4 shading strip along cabinet
    cv.vline(12, 6, 29, col('coolwhite', 2))
    cv.vline(13, 6, 29, col('steel', 1))

    # Upper backlit drink display showcase (x=3..12, y=6..18)
    cv.outline_box(3, 6, 12, 19, col('white', 6), col('steel', 1))
    # Bright glowing fluorescent tube along top inside window
    cv.hline(4, 11, 7, col('white', 6))

    # 3 neat rows of colorful drink cans + shelves + hot/cold button lights
    can_rows = [
        (8,  ['red:4', 'red:4', 'orange:4', 'yellow:4', 'green:4', 'blue:4', 'teal:4']),
        (12, ['blue:4', 'teal:4', 'green:4', 'yellow:4', 'orange:4', 'pink:4', 'red:4']),
        (15, ['green:4', 'green:4', 'cream:5', 'orange:4', 'blue:4', 'blue:4', 'red:4']),
    ]
    for ry, cans in can_rows:
        for i, cspec in enumerate(cans):
            cx = 4 + i
            cv.p(cx, ry, cspec)
            cv.p(cx, ry + 1, cspec)
            # specular dot on top of alternating cans
            if i % 2 == 0:
                cv.p(cx, ry, col('white', 6))
        # Shelf rail + tiny lit selection buttons
        cv.hline(4, 11, ry + 2, col('steel', 2))
        for bx in (4, 6, 8, 10):
            cv.p(bx, ry + 2, col('blue', 4) if ry < 15 else col('red', 4))

    # Middle control fascia strip (y=19..22)
    cv.rect(3, 19, 12, 23, col('blue', 3))
    cv.hline(3, 12, 19, col('blue', 5))
    cv.hline(3, 12, 22, col('blue', 1))
    # Glowing price LED & coin/bill slots
    cv.rect(4, 20, 7, 22, col('glass', 1))
    cv.p(5, 20, col('yellow', 5))
    cv.p(6, 21, col('green', 4))
    # Coin slot & return button
    cv.p(8, 20, col('steel', 0))
    cv.p(8, 21, col('steel', 4))
    cv.rect(10, 20, 12, 22, col('steel', 1))
    cv.p(10, 20, col('coolwhite', 5))

    # Lower cabinet & pickup chute (y=23..29)
    cv.rect(3, 23, 12, 29, col('blue', 2))
    cv.vline(3, 23, 29, col('blue', 4))
    cv.hline(3, 12, 23, col('coolwhite', 4))
    # Recessed dark pickup chute
    cv.outline_box(4, 24, 11, 28, col('steel', 0), col('steel', 1))
    cv.hline(5, 10, 25, col('steel', 3))  # push flap highlight
    cv.hline(5, 10, 26, col('glass', 1))

    # Two sturdy feet
    cv.clear(2, 29, 14, 30)
    cv.rect(3, 29, 6, 31, col('steel', 1))
    cv.p(3, 29, col('steel', 3))
    cv.rect(10, 29, 13, 31, col('steel', 0))
    cv.p(10, 29, col('steel', 2))


def draw_vending_snack(cv):
    """2. mf-obj-vending_snack (16x32) — Red-and-cream snack/coffee vending machine."""
    draw_shadow_bar(cv, 2, 14, 30, strong=True)

    # Outer cabinet silhouette with 1px chamfered top corners
    cv.outline_box(2, 1, 14, 30, col('red', 3), col('ink', 0))
    cv.clear(2, 1, 3, 2)
    cv.clear(13, 1, 14, 2)
    cv.p(3, 1, col('ink', 0))
    cv.p(12, 1, col('ink', 0))
    cv.p(2, 2, col('ink', 0))
    cv.p(13, 2, col('ink', 0))

    # Top 3/4 sunlit red hood + cream lip (y=1..5)
    cv.rect(3, 2, 13, 5, col('red', 4))
    cv.hline(4, 12, 2, col('red', 5))
    cv.hline(3, 13, 4, col('red', 2))
    cv.hline(3, 13, 5, col('cream', 5))  # cream header trim
    cv.p(12, 5, col('cream', 3))
    cv.p(13, 5, col('red', 1))

    # Left glass display window with spiral snack rows (x=3..10, y=6..21)
    cv.outline_box(3, 6, 11, 22, col('glass', 1), col('steel', 1))
    # Subtle glass top reflection
    cv.hline(4, 10, 7, col('glass', 3))
    cv.p(4, 8, col('glass', 5))
    cv.p(5, 7, col('glass', 5))

    # 4 spiral snack shelves
    snack_rows = [
        (8,  [('yellow', 4), ('orange', 4), ('red', 4)]),
        (11, [('green', 4), ('cream', 5), ('pink', 4)]),
        (14, [('orange', 4), ('blue', 4), ('yellow', 5)]),
        (17, [('red', 4), ('teal', 4), ('cream', 4)]),
    ]
    for ry, packs in snack_rows:
        for i, (rmp, idx) in enumerate(packs):
            px = 4 + i * 2
            cv.rect(px, ry, px + 2, ry + 2, col(rmp, idx))
            cv.p(px, ry, col(rmp, min(idx + 1, 5)))
        # Wire spiral rail
        cv.hline(4, 10, ry + 2, col('steel', 2))
        cv.p(5, ry + 2, col('steel', 4))
        cv.p(8, ry + 2, col('steel', 4))
    # Bottom glass glint
    cv.p(8, 20, col('glass', 4))
    cv.p(9, 19, col('glass', 4))

    # Right cream control panel column (x=11..13, y=6..21)
    cv.rect(11, 6, 13, 22, col('cream', 4))
    cv.vline(11, 6, 22, col('cream', 5))
    cv.vline(13, 6, 29, col('red', 1))
    # Coffee cup mini icon at top
    cv.rect(11, 7, 13, 10, col('wood', 3))
    cv.p(12, 8, col('cream', 6))
    # Illuminated keypad (amber/cyan glow)
    cv.rect(11, 11, 13, 16, col('steel', 1))
    cv.p(11, 12, col('yellow', 5))
    cv.p(12, 12, col('orange', 5))
    cv.p(11, 14, col('glass', 5))
    cv.p(12, 14, col('yellow', 5))
    cv.p(11, 15, col('cream', 6))
    # Coin slot & pickup coin tray
    cv.p(12, 17, col('steel', 0))
    cv.rect(11, 19, 13, 21, col('steel', 1))
    cv.p(11, 19, col('steel', 4))

    # Lower red body + drop-chute bin (y=22..29)
    cv.rect(3, 22, 13, 29, col('red', 3))
    cv.hline(3, 13, 22, col('cream', 4))
    cv.vline(3, 23, 29, col('red', 4))
    cv.outline_box(4, 24, 12, 28, col('steel', 0), col('red', 1))
    cv.hline(5, 11, 25, col('cream', 5))  # push bar
    cv.hline(5, 11, 26, col('steel', 2))

    # Feet
    cv.clear(2, 29, 14, 30)
    cv.rect(3, 29, 6, 31, col('steel', 1))
    cv.rect(10, 29, 13, 31, col('steel', 0))


def draw_gacha_row(cv):
    """3. mf-obj-gacha_row (32x32) — Row of 4 stacked colorful capsule toy dispensers."""
    draw_shadow_bar(cv, 2, 30, 30, strong=True)

    # Heavy steel plinth base
    cv.outline_box(2, 28, 30, 30, col('steel', 2), col('ink', 0))
    cv.hline(3, 29, 28, col('steel', 4))

    # Individually tinted top lids: orange, yellow, cyan (glass), pink
    lid_specs = [
        ('orange', ('orange', 5), ('orange', 4), ('orange', 3), ('orange', 1)),
        ('yellow', ('yellow', 5), ('yellow', 4), ('yellow', 3), ('yellow', 1)),
        ('glass',  ('glass', 6),  ('glass', 5),  ('glass', 4),  ('glass', 2)),
        ('pink',   ('pink', 5),   ('pink', 4),   ('pink', 3),   ('pink', 1)),
    ]
    cap_ramps = ['orange', 'yellow', 'teal', 'pink']
    capsule_palette = [
        ['red:4', 'yellow:5', 'blue:4', 'white:6', 'pink:4'],
        ['yellow:4', 'green:4', 'orange:4', 'white:6', 'red:4'],
        ['blue:4', 'teal:4', 'yellow:5', 'white:6', 'pink:4'],
        ['pink:4', 'orange:4', 'teal:4', 'white:6', 'yellow:5'],
    ]

    for i in range(4):
        x0 = 2 + i * 7
        x1 = x0 + 7
        if i == 3:
            x1 = 30
        rmp = cap_ramps[i]
        _, c_hi, c_mid, c_lo, c_bev = lid_specs[i]
        caps = capsule_palette[i]

        # --- UPPER MACHINE (y=1..15) ---
        # Top outline (chamfered outer corners on leftmost/rightmost machines)
        cv.hline(x0 + (1 if i == 0 else 0), x1 - (1 if i == 3 else 0), 1, col('steel', 0))
        # 3px tall sunlit top-3/4 lid surface (y=2..4) with top-left highlight
        for ly in (2, 3, 4):
            cv.p(x0, ly, col('steel', 0) if i == 0 else col(*c_bev))
            for x in range(x0 + 1, x1 - 1):
                rx = x - (x0 + 1)
                if ly == 2:
                    c = col(*c_hi) if rx <= 2 else col(*c_mid)
                elif ly == 3:
                    c = col(*c_hi) if rx == 0 else (col(*c_mid) if rx <= 3 else col(*c_lo))
                else:
                    c = col(*c_mid) if rx <= 2 else col(*c_lo)
                cv.p(x, ly, c)
            cv.p(x1 - 1, ly, col('steel', 0) if i == 3 else col(*c_bev))
        # 1px bevel line separating sunlit top lid plane from front face (y=5)
        cv.hline(x0, x1, 5, col(*c_bev))
        if i == 0:
            cv.p(x0, 5, col('steel', 0))
        if i == 3:
            cv.p(x1 - 1, 5, col('steel', 0))

        # Clear dome box filled with distinct spherical capsules (y=6..12)
        cv.outline_box(x0, 6, x1, 12, col('coolwhite', 5), col('steel', 1))
        cv.hline(x0 + 1, x1 - 1, 7, col('glass', 5))  # upper glass reflection
        for k, (dx, dy) in enumerate([(1, 7), (3, 7), (2, 9), (4, 9)]):
            gx, gy = x0 + dx, dy
            if gx < x1 - 1:
                cc = caps[(k + i) % len(caps)]
                cv.p(gx, gy, cc)
                if gx + 1 < x1 - 1:
                    cv.p(gx + 1, gy, col('white', 6))
                if gy + 1 < 11:
                    cv.p(gx, gy + 1, cc)
                    if gx + 1 < x1 - 1:
                        cv.p(gx + 1, gy + 1, cc)
        cv.vline(x0 + 1, 7, 11, col('white', 6))  # crisp dome glass highlight

        # Upper mechanism panel with rotary crank & coin slot (y=12..16)
        cv.outline_box(x0, 12, x1, 16, col('white', 5), col('steel', 1))
        cv.hline(x0 + 1, x1 - 1, 12, col(rmp, 3))
        mx = (x0 + x1) // 2
        cv.rect(mx - 1, 13, mx + 2, 15, col('steel', 4))
        cv.p(mx, 13, col('white', 6))
        cv.p(mx, 14, col('steel', 0))
        cv.p(x1 - 2, 13, col('steel', 0))  # coin slot

        # --- LOWER MACHINE (y=16..28) ---
        rmp2 = cap_ramps[(i + 2) % 4]
        caps2 = capsule_palette[(i + 1) % 4]
        cv.hline(x0, x1, 16, col('ink', 0))
        cv.outline_box(x0, 17, x1, 23, col('coolwhite', 4), col('steel', 1))
        for k, (dx, dy) in enumerate([(1, 18), (3, 18), (2, 20), (4, 20)]):
            gx, gy = x0 + dx, dy
            if gx < x1 - 1:
                cc = caps2[(k + i) % len(caps2)]
                cv.p(gx, gy, cc)
                if gx + 1 < x1 - 1:
                    cv.p(gx + 1, gy, col('white', 6))
                if gy + 1 < 22:
                    cv.p(gx, gy + 1, cc)
                    if gx + 1 < x1 - 1:
                        cv.p(gx + 1, gy + 1, cc)
        cv.vline(x0 + 1, 18, 22, col('white', 6))

        # Lower crank & pickup flap (y=23..28)
        cv.outline_box(x0, 23, x1, 28, col('cream', 5), col('steel', 1))
        cv.hline(x0 + 1, x1 - 1, 23, col(rmp2, 4))
        cv.rect(mx - 1, 24, mx + 2, 26, col('steel', 4))
        cv.p(mx, 24, col('white', 6))
        cv.p(mx, 25, col('steel', 0))
        cv.rect(x0 + 1, 26, x0 + 3, 27, col('steel', 0))  # capsule drop chute

    # Outer side framing
    cv.vline(2, 2, 29, col('steel', 0))
    cv.vline(29, 2, 29, col('steel', 0))


def draw_ticket_kiosk(cv):
    """4. mf-obj-ticket_kiosk (32x32) — Station/parking automated ticket kiosk."""
    draw_shadow_bar(cv, 3, 29, 30, strong=True)

    # Top 3/4 overhanging canopy roof (y=1..8, x=2..30)
    cv.outline_box(2, 1, 30, 8, col('navy', 3), col('ink', 0))
    # Sunlit upper slope
    cv.rect(3, 2, 29, 5, col('tile', 5))
    cv.hline(3, 29, 2, col('coolwhite', 5))
    cv.hline(3, 29, 4, col('tile', 3))
    # Front backlit header fascia ("TICKET")
    cv.rect(3, 5, 29, 8, col('blue', 2))
    cv.hline(3, 29, 5, col('blue', 4))
    # Crisp faux-glyph white/yellow header letters
    for gx in range(6, 26, 3):
        cv.vline(gx, 6, 8, col('white', 6) if gx < 20 else col('yellow', 5))
        if gx % 2 == 0:
            cv.p(gx + 1, 6, col('white', 6))
    # Deep shade under canopy overhang
    cv.hline(3, 29, 8, col('ink', 0))

    # Brushed steel side shelter wings
    cv.outline_box(3, 8, 6, 29, col('steel', 4), col('steel', 0), top_hi=col('coolwhite', 5))
    cv.vline(4, 9, 28, col('coolwhite', 5))
    cv.outline_box(26, 8, 29, 29, col('steel', 2), col('steel', 0))
    cv.vline(27, 9, 28, col('steel', 3))

    # Main brushed steel kiosk body (x=6..26, y=8..29)
    cv.rect(6, 9, 26, 29, col('coolwhite', 4))
    for y in range(9, 29):
        if y % 3 == 0:
            cv.hline(6, 26, y, col('coolwhite', 3))
    cv.hline(6, 26, 9, col('steel', 2))  # shadow directly below canopy

    # Glowing cyan touchscreen (x=7..19, y=10..18)
    cv.outline_box(7, 10, 20, 19, col('glass', 5), col('steel', 0))
    cv.rect(8, 11, 19, 18, col('teal', 4))
    cv.hline(8, 19, 11, col('glass', 6))  # bright top header bar
    # UI buttons on screen
    cv.rect(9, 13, 13, 15, col('yellow', 5))
    cv.rect(14, 13, 18, 15, col('white', 6))
    cv.rect(9, 16, 13, 17, col('blue', 3))
    cv.rect(14, 16, 18, 17, col('glass', 6))

    # Right-side slot strip: IC card reader + bill + coin slots (x=21..25, y=10..20)
    cv.outline_box(21, 10, 25, 14, col('blue', 4), col('steel', 1))
    cv.p(22, 11, col('glass', 6))
    cv.p(23, 12, col('white', 6))
    # Bill acceptor with green LED
    cv.rect(21, 15, 25, 17, col('steel', 1))
    cv.p(22, 15, col('green', 4))
    cv.hline(22, 24, 16, col('ink', 0))
    # Coin slot
    cv.rect(21, 18, 25, 20, col('steel', 3))
    cv.p(23, 18, col('steel', 0))
    cv.p(23, 19, col('steel', 0))

    # Protruding stainless ledge & ticket/receipt chute (y=20..24)
    cv.hline(6, 26, 20, col('white', 6))
    cv.hline(6, 26, 21, col('steel', 3))
    cv.outline_box(8, 22, 24, 25, col('steel', 0), col('steel', 2))
    # Printed white ticket stub peeking out
    cv.rect(11, 23, 14, 25, col('white', 6))
    cv.p(12, 23, col('blue', 4))
    cv.rect(18, 23, 22, 24, col('steel', 3))  # coin cup

    # Lower navy kickplate + grounded feet (y=25..30)
    cv.rect(6, 25, 26, 29, col('navy', 2))
    cv.hline(6, 26, 25, col('steel', 1))
    cv.hline(6, 26, 28, col('navy', 0))
    cv.hline(3, 29, 29, col('ink', 0))


def draw_parcel_locker(cv):
    """5. mf-obj-parcel_locker (32x32) — Modern smart parcel delivery locker bank."""
    draw_shadow_bar(cv, 2, 30, 30, strong=True)

    # Outer silhouette
    cv.outline_box(2, 2, 30, 30, col('coolwhite', 4), col('ink', 0))

    # Top 3/4 sunlit roof plane (y=2..6)
    cv.rect(3, 3, 29, 6, col('white', 6))
    cv.hline(3, 29, 4, col('coolwhite', 5))
    cv.hline(3, 29, 5, col('coolwhite', 3))
    # Brand orange top fascia bar
    cv.hline(3, 29, 6, col('orange', 4))
    cv.hline(3, 29, 7, col('orange', 2))

    # Left column lockers (x=3..11) — 4 doors
    left_doors = [
        (8, 12, 'coolwhite', 4),
        (12, 16, 'orange', 4),
        (16, 22, 'coolwhite', 4),
        (22, 28, 'orange', 3),
    ]
    for y0, y1, rmp, idx in left_doors:
        cv.outline_box(3, y0, 12, y1, col(rmp, idx), col('steel', 1), top_hi=col(rmp, min(idx + 1, 5)))
        cv.p(10, (y0 + y1) // 2, col('steel', 0))  # recessed lock/handle

    # Center smart terminal column (x=12..20)
    cv.rect(12, 8, 20, 28, col('orange', 3))
    cv.vline(12, 8, 28, col('orange', 4))
    cv.vline(19, 8, 28, col('orange', 2))
    # Header parcel icon
    cv.rect(14, 9, 18, 11, col('yellow', 5))
    cv.hline(14, 18, 10, col('orange', 2))
    # Glowing cyan touchscreen (x=13..19, y=12..17)
    cv.outline_box(13, 12, 19, 18, col('glass', 5), col('steel', 0))
    cv.rect(14, 13, 18, 17, col('teal', 4))
    cv.hline(14, 18, 13, col('glass', 6))
    cv.p(15, 15, col('yellow', 5))
    cv.p(17, 15, col('white', 6))
    # Scanner recess with red laser dot + keypad
    cv.rect(13, 19, 19, 21, col('steel', 1))
    cv.p(15, 20, col('red', 4))
    cv.p(17, 19, col('coolwhite', 5))
    # Center bottom compartment
    cv.outline_box(12, 22, 20, 28, col('coolwhite', 4), col('steel', 1), top_hi=col('white', 6))
    cv.p(18, 25, col('steel', 0))

    # Right column lockers (x=20..29) — 4 doors (slightly cooler/shaded on right edge)
    right_doors = [
        (8, 14, 'orange', 4),
        (14, 18, 'coolwhite', 4),
        (18, 22, 'coolwhite', 3),
        (22, 28, 'orange', 3),
    ]
    for y0, y1, rmp, idx in right_doors:
        cv.outline_box(20, y0, 29, y1, col(rmp, idx), col('steel', 1), top_hi=col(rmp, min(idx + 1, 5)))
        cv.p(21, (y0 + y1) // 2, col('steel', 0))
        cv.vline(28, y0 + 1, y1 - 1, col(rmp, max(1, idx - 1)))

    # Dark steel plinth base
    cv.rect(3, 28, 29, 30, col('steel', 1))
    cv.hline(3, 29, 28, col('steel', 3))


def draw_phone_booth(cv):
    """6. mf-obj-phone_booth (16x32) — Retro-modern green/glass street telephone booth."""
    draw_shadow_bar(cv, 2, 14, 30, strong=True)

    # Pitched/stepped top 3/4 cap roof (y=1..6)
    cv.rect(4, 1, 12, 3, col('green', 5))
    cv.hline(4, 12, 1, col('green', 1))
    cv.p(3, 2, col('green', 1))
    cv.p(12, 2, col('green', 0))
    cv.rect(3, 3, 13, 5, col('green', 4))
    cv.hline(3, 12, 3, col('green', 5))
    cv.vline(2, 3, 6, col('green', 0))
    cv.vline(13, 3, 6, col('green', 0))
    # Front roof sign strip ("TEL")
    cv.rect(2, 5, 14, 7, col('green', 2))
    cv.hline(3, 13, 5, col('green', 4))
    for tx in (5, 7, 9, 10):
        cv.p(tx, 6, col('white', 6))

    # Main glass enclosure (x=3..13, y=7..24)
    cv.outline_box(3, 7, 13, 25, col('glass', 3), col('green', 1))
    # Warm overhead interior lamp glow
    cv.rect(5, 8, 11, 10, col('yellow', 5))
    cv.hline(6, 10, 8, col('white', 6))
    cv.hline(4, 12, 10, col('cream', 5))
    # Interior warm-tinted glass backdrop
    cv.rect(4, 11, 12, 24, col('glass', 4))
    cv.rect(5, 11, 11, 19, col('cream', 4))
    # Diagonal specular glass reflections
    cv.p(4, 12, col('glass', 6))
    cv.p(5, 11, col('glass', 6))
    cv.p(4, 18, col('glass', 5))
    cv.p(5, 17, col('glass', 5))
    cv.p(11, 21, col('glass', 5))

    # Interior retro payphone silhouette (curved handset on top + keypad + coin box + wood shelf)
    cv.hline(6, 10, 11, col('ink', 0))  # curved telephone handset across top
    cv.p(5, 12, col('ink', 0))
    cv.p(10, 12, col('ink', 0))
    cv.rect(6, 12, 10, 18, col('steel', 2))
    cv.vline(6, 12, 18, col('steel', 3))
    cv.vline(9, 12, 18, col('steel', 0))
    cv.rect(7, 13, 9, 15, col('coolwhite', 5))  # dial/keypad plate
    cv.p(8, 16, col('steel', 0))  # coin return box
    cv.hline(5, 11, 18, col('wood', 4))  # phone book shelf
    cv.hline(5, 11, 19, col('wood', 2))

    # Vertical door glass mullions & silver pull handle
    cv.vline(3, 7, 29, col('green', 2))
    cv.vline(12, 7, 29, col('green', 1))
    cv.vline(13, 7, 29, col('green', 0))
    cv.vline(4, 7, 24, col('green', 4))  # sunlit left frame post
    cv.vline(10, 15, 18, col('coolwhite', 5))  # chrome door handle

    # Lower solid green door kickplate (y=24..29)
    cv.outline_box(3, 24, 13, 29, col('green', 3), col('green', 0), top_hi=col('green', 4))
    cv.rect(5, 25, 11, 28, col('green', 2))
    cv.hline(5, 11, 25, col('green', 4))

    # Concrete threshold plinth
    cv.hline(2, 14, 29, col('concrete', 5))
    cv.hline(2, 14, 30, col('concrete', 2))


def draw_atm_kiosk(cv):
    """7. mf-obj-atm_kiosk (32x32) — Compact bank ATM alcove kiosk."""
    draw_shadow_bar(cv, 2, 30, 30, strong=True)

    # Distinct 4px tall sunlit top roof/canopy plane (x=1..31, y=1..7) overhanging ATM fascia
    cv.hline(2, 30, 1, col('steel', 0))
    for y in range(2, 6):
        cv.p(1, y, col('steel', 0))
        for x in range(2, 30):
            # Subtle roof panel seams at x=11, 20
            seam = (x in (11, 20)) and y < 5
            if y == 2:
                c = col('white', 6) if x < 15 else (col('coolwhite', 5) if x < 24 else col('coolwhite', 4))
            elif y == 3:
                c = col('coolwhite', 5) if x < 12 else (col('coolwhite', 4) if x < 23 else col('tile', 5))
            elif y == 4:
                c = col('coolwhite', 4) if x < 11 else (col('tile', 5) if x < 22 else col('steel', 4))
            else:
                # Front roof eave lip (y=5)
                c = col('coolwhite', 4) if x < 17 else col('steel', 4)
            if seam:
                c = col('coolwhite', 3) if y <= 3 else col('steel', 3)
            cv.p(x, y, c)
        cv.p(30, y, col('steel', 0))
    # Canopy front fascia thickness (y=6)
    cv.p(1, 6, col('ink', 0))
    cv.hline(2, 30, 6, col('steel', 1))
    cv.p(30, 6, col('ink', 0))

    # Blue backlit header fascia ("ATM") recessed 1px under overhanging canopy (x=2..30, y=7..13)
    cv.outline_box(2, 7, 30, 14, col('blue', 3), col('navy', 0), bot_sh=col('blue', 1))
    # 1px cast shadow directly underneath overhanging canopy across top of ATM fascia (y=7..8)
    cv.hline(2, 30, 7, col('ink', 0))
    cv.hline(3, 29, 8, col('navy', 1))
    # Crisp pixel "ATM" letters centered at x=10..22, y=9..12
    # A
    cv.rect(10, 9, 13, 12, col('white', 6))
    cv.p(11, 10, col('blue', 3))
    cv.p(11, 11, col('blue', 3))
    # T
    cv.hline(14, 17, 9, col('white', 6))
    cv.vline(15, 9, 12, col('white', 6))
    # M
    cv.vline(18, 9, 12, col('white', 6))
    cv.vline(21, 9, 12, col('white', 6))
    cv.p(19, 10, col('white', 6))
    cv.p(20, 10, col('white', 6))
    # Accent yellow bank mark on left
    cv.rect(5, 9, 8, 11, col('yellow', 5))
    cv.p(6, 10, col('orange', 4))
    # Glowing light strip under fascia
    cv.hline(7, 25, 13, col('glass', 6))

    # Side privacy wing panels (x=2..7 and x=25..30, y=13..29) — compressed bay
    cv.outline_box(2, 13, 7, 29, col('blue', 2), col('navy', 0), top_hi=col('blue', 4))
    cv.rect(4, 15, 6, 23, col('glass', 4))  # frosted privacy glass insert
    cv.vline(4, 15, 23, col('glass', 6))
    cv.outline_box(25, 13, 30, 29, col('blue', 1), col('navy', 0))
    cv.rect(26, 15, 28, 23, col('glass', 3))
    cv.vline(26, 15, 23, col('glass', 5))

    # Recessed ATM interior body compressed by 4px (x=7..25, y=14..29)
    cv.rect(7, 14, 25, 29, col('coolwhite', 3))
    cv.hline(7, 25, 14, col('steel', 2))  # inner top shadow
    cv.vline(7, 14, 29, col('steel', 2))

    # Recessed glowing ATM screen (x=9..20, y=15..20)
    cv.outline_box(9, 15, 20, 20, col('glass', 5), col('steel', 0))
    cv.rect(10, 16, 19, 19, col('blue', 4))
    cv.hline(10, 19, 16, col('glass', 6))
    cv.rect(11, 17, 14, 18, col('white', 6))
    cv.rect(15, 17, 18, 18, col('yellow', 5))
    # Side bezel buttons
    for by in (16, 18):
        cv.p(8, by, col('steel', 4))

    # Card slot & receipt slot (x=21..24, y=15..20)
    cv.rect(21, 15, 24, 17, col('steel', 1))
    cv.p(22, 15, col('green', 4))  # green card reader LED
    cv.rect(21, 18, 24, 19, col('steel', 2))
    cv.p(22, 18, col('white', 6))  # receipt lip

    # Protruding 3/4 keypad desk shelf (x=7..25, y=20..23)
    cv.rect(7, 20, 25, 23, col('coolwhite', 5))
    cv.hline(7, 25, 20, col('white', 6))
    cv.hline(7, 25, 22, col('steel', 1))
    # Stainless PIN keypad
    cv.rect(11, 20, 17, 22, col('steel', 4))
    for kx in (12, 14, 16):
        cv.p(kx, 20, col('white', 6))
        cv.p(kx, 21, col('steel', 2))
    cv.p(19, 21, col('yellow', 5))
    cv.p(21, 21, col('green', 4))

    # Lower cabinet & cash dispenser shutter (y=23..29)
    cv.rect(7, 23, 25, 29, col('steel', 3))
    cv.outline_box(10, 24, 22, 27, col('steel', 0), col('steel', 1))
    cv.hline(11, 21, 25, col('steel', 4))
    cv.hline(2, 30, 29, col('ink', 0))


def draw_pojangmacha_cart(cv):
    """8. mf-obj-pojangmacha_cart (48x32) — Korean orange-tarpaulin street food cart."""
    draw_shadow_bar(cv, 3, 45, 30, strong=True)

    # Peaked 3/4 orange vinyl/tarpaulin roof (y=1..11, x=2..46)
    # Top ridge slope
    for y in range(2, 10):
        inset = max(0, 4 - y)
        x0, x1 = 2 + inset, 46 - inset
        for x in range(x0, x1):
            # Subtle tarp vertical creases every 7px
            seam = ((x - 4) % 7 == 0)
            if y == 2:
                cv.p(x, y, col('orange', 5))
            elif y == 3:
                cv.p(x, y, col('yellow', 5) if not seam else col('orange', 4))
            elif y <= 6:
                cv.p(x, y, col('orange', 3 if seam else 4))
            else:
                cv.p(x, y, col('orange', 2 if seam else 3))
        cv.p(x0, y, col('orange', 0))
        cv.p(x1 - 1, y, col('orange', 0))
    cv.hline(4, 44, 1, col('orange', 0))
    # Front scalloped orange tarp valance + red accent band
    cv.hline(2, 46, 9, col('red', 3))
    for x in range(2, 46):
        cv.p(x, 10, col('orange', 2 if (x % 4 != 0) else 0))
        if x % 4 in (1, 2):
            cv.p(x, 11, col('orange', 1))

    # Open warm backlit cart interior (x=5..43, y=11..19)
    cv.rect(5, 11, 43, 19, col('orange', 2))
    # Translucent backlit warm orange/cream vinyl back curtain panels
    cv.rect(7, 12, 41, 18, col('orange', 3))
    for cx in (12, 24, 36):
        cv.rect(cx - 3, 12, cx + 4, 17, col('orange', 4))
    # Warm hanging tungsten bulb at center (x=24, y=12..14)
    cv.vline(24, 11, 13, col('ink', 0))
    cv.rect(23, 13, 26, 15, col('yellow', 5))
    cv.p(24, 13, col('white', 6))
    cv.p(22, 13, col('yellow', 4))
    cv.p(26, 13, col('yellow', 4))
    cv.p(24, 15, col('yellow', 4))

    # Side tarp tie-back curtains & metal corner poles
    cv.rect(4, 11, 7, 21, col('orange', 3))
    cv.vline(4, 11, 28, col('orange', 0))
    cv.vline(5, 11, 20, col('orange', 4))
    cv.rect(41, 11, 44, 21, col('orange', 2))
    cv.vline(43, 11, 28, col('orange', 0))
    cv.vline(42, 11, 20, col('orange', 1))

    # Wooden counter top (y=17..20, x=4..44)
    cv.outline_box(4, 17, 44, 21, col('cedar', 4), col('wood', 0), top_hi=col('cedar', 6))

    # Steaming food displays on counter!
    # Left: glossy red tteokbokki pan (x=8..18, y=15..18)
    cv.outline_box(8, 15, 19, 19, col('red', 4), col('steel', 2), top_hi=col('steel', 5))
    for tx in range(9, 18, 2):
        cv.p(tx, 16, col('red', 5))
        cv.p(tx + 1, 17, col('orange', 4))
    # Center-left: odeng fish-cake skewer broth pot (x=20..29, y=15..18)
    cv.outline_box(20, 15, 30, 19, col('steel', 4), col('steel', 1))
    cv.rect(21, 16, 29, 18, col('yellow', 3))
    for sx in (22, 24, 26, 28):
        cv.vline(sx, 14, 17, col('cream', 5))
        cv.p(sx, 16, col('cedar', 5))
    # Rising white steam wisps above hot pans
    for sx, sy in ((11, 13), (15, 12), (22, 13), (27, 12)):
        cv.p(sx, sy, col('white', 6))
        cv.p(sx + 1, sy - 1, col('coolwhite', 5))
    # Right: green soju bottles & stacked white paper cups
    for bx in (32, 34, 36):
        cv.vline(bx, 14, 18, col('green', 4))
        cv.p(bx, 14, col('green', 5))
        cv.p(bx, 16, col('white', 6))
    cv.rect(38, 15, 41, 18, col('white', 6))
    cv.hline(38, 41, 16, col('coolwhite', 3))

    # Lower cart chassis & galvanized/wooden front apron (y=21..27)
    cv.outline_box(6, 20, 42, 27, col('steel', 3), col('steel', 0), top_hi=col('steel', 4))
    # Orange draped front menu cloth banner in center
    cv.outline_box(15, 21, 33, 26, col('orange', 4), col('orange', 1), top_hi=col('orange', 5))
    for gx in range(17, 31, 3):
        cv.hline(gx, gx + 2, 23, col('cream', 6))
        cv.p(gx, 24, col('yellow', 5))

    # Two sturdy cart wheels
    draw_wheel(cv, 10, 26, r=4)
    draw_wheel(cv, 37, 26, r=4)
    # Corner stabilizer legs
    cv.vline(6, 26, 30, col('steel', 1))
    cv.vline(41, 26, 30, col('steel', 1))

    # 3 iconic Korean plastic stools lined up in front (y=24..30)
    for sx, rmp in ((16, 'red'), (23, 'blue'), (30, 'red')):
        cv.outline_box(sx, 24, sx + 5, 27, col(rmp, 4), col(rmp, 0), top_hi=col(rmp, 5))
        cv.vline(sx, 27, 30, col(rmp, 2))
        cv.vline(sx + 4, 27, 30, col(rmp, 1))
        cv.hline(sx + 1, sx + 4, 28, col(rmp, 1))


def draw_coffee_cart(cv):
    """9. mf-obj-coffee_cart (48x32) — Boutique mobile espresso/waffle cart."""
    draw_shadow_bar(cv, 3, 45, 30, strong=True)

    # Top 3/4 striped green/cream boutique awning (y=2..10, x=4..44)
    cv.awning(4, 2, 44, 10, ramp_a='green', ramp_b='cream', stripe_w=4)
    cv.hline(4, 44, 2, col('green', 1))
    # Sunlit top bevel along awning pitch
    for x in range(5, 43):
        use_g = (((x - 4) // 4) % 2 == 0)
        cv.p(x, 3, col('green', 5) if use_g else col('cream', 6))
    # Warm Edison fairy lights strung under awning
    for lx in (9, 15, 21, 27, 33, 39):
        cv.p(lx, 10, col('yellow', 5))
        cv.p(lx, 11, col('orange', 4))

    # Slender dark iron awning support posts
    cv.vline(6, 10, 19, col('steel', 1))
    cv.vline(7, 10, 19, col('steel', 3))
    cv.vline(40, 10, 19, col('steel', 3))
    cv.vline(41, 10, 19, col('steel', 0))

    # Countertop appliances & cafe goods (y=11..18)
    # 1) Gleaming chrome espresso machine (x=9..19, y=11..18)
    cv.outline_box(9, 11, 20, 18, col('coolwhite', 4), col('steel', 0), top_hi=col('white', 6))
    cv.rect(10, 12, 19, 14, col('steel', 5))
    cv.p(12, 13, col('yellow', 5))  # pressure gauge
    cv.p(16, 13, col('red', 4))     # power light
    cv.rect(11, 14, 18, 17, col('steel', 1))  # brew bay
    cv.p(13, 15, col('steel', 4))   # grouphead
    cv.p(13, 16, col('white', 6))   # espresso demitasse
    cv.p(16, 16, col('white', 6))

    # 2) Glass pastry/waffle display dome (x=21..29, y=12..18)
    cv.outline_box(21, 12, 29, 18, col('glass', 4), col('steel', 1), top_hi=col('glass', 6))
    cv.rect(22, 14, 28, 17, col('orange', 4))  # golden waffles/croissants
    cv.p(23, 14, col('yellow', 5))
    cv.p(26, 15, col('yellow', 5))
    cv.p(24, 16, col('cedar', 3))
    cv.vline(22, 13, 17, col('white', 6))  # curved glass reflection

    # 3) Stacked takeaway coffee cups (x=30..34, y=13..18)
    for cx in (30, 32):
        cv.rect(cx, 13, cx + 2, 18, col('cream', 5))
        cv.p(cx, 13, col('white', 6))
        cv.p(cx, 15, col('wood', 4))  # kraft sleeve
        cv.p(cx + 1, 15, col('wood', 3))
        cv.p(cx, 17, col('wood', 4))

    # 4) Mini A-frame chalkboard menu on counter right (x=35..40, y=12..18)
    cv.outline_box(35, 12, 40, 18, col('kuro', 1), col('wood', 2), top_hi=col('cedar', 5))
    cv.hline(36, 39, 14, col('cream', 6))
    cv.hline(36, 38, 16, col('yellow', 5))

    # Warm cedar-plank cart body (x=6..42, y=18..27)
    cv.outline_box(6, 18, 42, 20, col('cedar', 5), col('wood', 0), top_hi=col('cedar', 6))  # counter slab
    cv.siding_wall(7, 20, 41, 27, ramp='cedar', base_i=4, horizontal=False, step=3, seed=52)
    cv.outline_box(6, 20, 42, 27, col('cedar', 4), col('wood', 0))
    # Re-apply vertical plank texture inside frame
    cv.siding_wall(7, 21, 41, 26, ramp='cedar', base_i=4, horizontal=False, step=3, seed=52)
    # Center cream & green coffee cart emblem plaque
    cv.outline_box(17, 21, 31, 26, col('cream', 5), col('green', 1), top_hi=col('cream', 6))
    cv.hline(19, 29, 23, col('green', 3))
    cv.p(23, 22, col('wood', 3))
    cv.p(24, 22, col('wood', 3))
    cv.p(24, 24, col('green', 4))

    # Push handlebar on right
    cv.hline(42, 46, 19, col('steel', 4))
    cv.vline(45, 19, 23, col('steel', 2))
    cv.p(45, 18, col('wood', 4))

    # Large bicycle-style spoked wheels (left & right)
    draw_wheel(cv, 9, 26, r=4, spoke_c='coolwhite:5', tire_c='asphalt:0', rim_c='steel:2')
    draw_wheel(cv, 38, 26, r=4, spoke_c='coolwhite:5', tire_c='asphalt:0', rim_c='steel:2')
    # Front stabilizer stand
    cv.vline(23, 27, 30, col('steel', 1))
    cv.hline(21, 26, 29, col('steel', 2))


def draw_newsstand_kiosk(cv):
    """10. mf-obj-newsstand_kiosk (48x32) — Corner magazine & snack kiosk booth."""
    draw_shadow_bar(cv, 2, 46, 30, strong=True)

    # Top 3/4 dark slate corrugated awning roof (y=1..9, x=1..47)
    cv.outline_box(1, 1, 47, 9, col('kawara', 3), col('kawara', 0))
    for y in range(2, 8):
        for x in range(2, 46):
            rib = (x % 3 == 0)
            if y == 2:
                cv.p(x, y, col('kawara', 6 if not rib else 4))
            elif y <= 4:
                cv.p(x, y, col('kawara', 4 if not rib else 2))
            else:
                cv.p(x, y, col('kawara', 3 if not rib else 1))
    # Front fascia banner with red/yellow "NEWS" sign strip
    cv.rect(2, 7, 46, 10, col('navy', 2))
    cv.hline(2, 46, 7, col('kawara', 5))
    cv.rect(8, 7, 30, 10, col('red', 3))
    cv.hline(8, 30, 7, col('red', 5))
    for gx in range(10, 28, 3):
        cv.vline(gx, 8, 10, col('yellow', 5))
        cv.p(gx + 1, 8, col('white', 6))
    cv.hline(2, 46, 10, col('ink', 0))  # under-eave shadow

    # Main kiosk structural body (x=3..45, y=10..29)
    cv.outline_box(3, 10, 45, 29, col('concrete', 3), col('ink', 0))

    # Left & center warm open service window (x=4..32, y=11..19)
    cv.outline_box(4, 11, 32, 20, col('orange', 3), col('steel', 1))
    # Warm backlit interior ceiling glow
    cv.hline(5, 31, 12, col('yellow', 5))
    cv.rect(5, 13, 31, 18, col('orange', 4))
    # Hanging colorful snack packs along upper window
    for sx, cspec in ((6, 'red:4'), (9, 'yellow:5'), (12, 'green:4'), (25, 'pink:4'), (28, 'blue:4')):
        cv.rect(sx, 12, sx + 2, 15, cspec)
        cv.p(sx, 12, col('white', 6))
    # Interior warm lamp & service counter items
    cv.rect(16, 12, 22, 14, col('white', 6))
    cv.p(18, 16, col('steel', 2))  # cash register
    cv.rect(17, 15, 21, 18, col('steel', 1))
    cv.p(18, 15, col('green', 4))
    # Candy jars on counter
    cv.rect(6, 16, 9, 18, col('glass', 5))
    cv.p(7, 17, col('red', 4))
    cv.rect(10, 16, 13, 18, col('glass', 5))
    cv.p(11, 17, col('yellow', 5))
    # Wooden service counter ledge
    cv.hline(4, 32, 18, col('cedar', 6))
    cv.hline(4, 32, 19, col('cedar', 4))
    cv.hline(4, 32, 20, col('wood', 1))

    # Colorful stacked magazine & newspaper racks below window (x=4..32, y=20..29)
    cv.rect(4, 21, 32, 29, col('wood', 2))
    mag_colors_top = ['red:4', 'blue:4', 'yellow:5', 'white:6', 'teal:4', 'pink:4', 'orange:4', 'green:4', 'red:4']
    mag_colors_bot = ['white:6', 'orange:4', 'blue:4', 'yellow:4', 'red:4', 'cream:5', 'pink:4', 'blue:4', 'white:6']
    # Upper magazine rack row (y=21..24)
    for i, mc in enumerate(mag_colors_top):
        mx = 5 + i * 3
        cv.rect(mx, 21, mx + 2, 24, mc)
        cv.p(mx, 21, col('white', 6))
    cv.hline(4, 32, 24, col('steel', 3))
    # Lower magazine/newspaper rack row (y=25..28)
    for i, mc in enumerate(mag_colors_bot):
        mx = 5 + i * 3
        cv.rect(mx, 25, mx + 2, 28, mc)
        cv.p(mx + 1, 25, col('cream', 6))
    cv.hline(4, 32, 28, col('steel', 2))

    # Right-side tall glass drink cooler (x=33..44, y=11..29)
    cv.outline_box(33, 11, 44, 29, col('coolwhite', 4), col('steel', 1))
    cv.outline_box(34, 12, 43, 25, col('glass', 3), col('steel', 0))
    cv.hline(35, 42, 13, col('white', 6))  # cooler interior LED
    # 3 rows of colorful bottled drinks
    for ry, cols_row in [
        (14, ['green:4', 'green:4', 'blue:4', 'blue:4', 'red:4', 'red:4', 'orange:4']),
        (18, ['orange:4', 'yellow:5', 'teal:4', 'teal:4', 'pink:4', 'red:4', 'green:4']),
        (22, ['blue:4', 'white:6', 'yellow:4', 'orange:4', 'green:4', 'blue:4', 'red:4']),
    ]:
        for j, dc in enumerate(cols_row):
            cv.p(35 + j, ry, dc)
            cv.p(35 + j, ry + 1, dc)
        cv.hline(35, 42, ry + 2, col('steel', 2))
    # Cooler diagonal glass highlight & handle
    cv.p(35, 14, col('glass', 6))
    cv.p(36, 13, col('glass', 6))
    cv.vline(34, 16, 21, col('coolwhite', 5))  # vertical door handle
    # Cooler lower vent grille
    cv.rect(34, 26, 43, 28, col('steel', 2))
    for vx in range(35, 42, 2):
        cv.p(vx, 27, col('steel', 0))

    # Ground plinth
    cv.hline(3, 45, 29, col('concrete', 1))


# ===========================================================================
# CATEGORY 2: seating-terrace (10 items)
# ===========================================================================

def draw_cafe_bistro_set(cv):
    """11. mf-obj-cafe_bistro_set (32x32) — Top-3/4 round bistro table with coffee cups & 2 chairs."""
    # Lighter, separated ground shadows under left chair, central pedestal, and right chair (no dark bottom loop!)
    cv.hline(3, 9, 28, col('ink', 2))
    cv.p(4, 29, col('ink', 2))
    cv.p(7, 29, col('ink', 2))

    cv.hline(23, 29, 28, col('ink', 2))
    cv.p(24, 29, col('ink', 2))
    cv.p(27, 29, col('ink', 2))

    # Light shadow directly under central pedestal base (clearly separated from chair shadows)
    cv.hline(12, 20, 29, col('ink', 2))
    cv.hline(14, 18, 30, col('ink', 2))

    # Helper to draw a curved cafe bistro chair facing inward with cleanly separated legs
    def draw_chair(x0, flip=False):
        # Backrest (curved top-3/4 bentwood/iron loop)
        bx = x0 + (0 if not flip else 5)
        cv.outline_box(bx, 11, bx + 3, 21, col('wood', 4), col('wood', 0), top_hi=col('cedar', 5))
        cv.vline(bx + 1, 13, 19, col('cedar', 5))
        # Seat cushion (top-3/4 wood seat)
        sx = x0 + (1 if not flip else 0)
        cv.outline_box(sx, 18, sx + 7, 23, col('cedar', 5), col('wood', 0), top_hi=col('cedar', 6))
        cv.hline(sx + 1, sx + 6, 21, col('wood', 3))  # front seat thickness
        # Cleanly separated slender cast-iron legs (open air gap between legs!)
        if not flip:
            cv.vline(sx + 0, 22, 27, col('steel', 2))  # rear-left leg (higher for 3/4 depth)
            cv.vline(sx + 1, 23, 29, col('steel', 3))  # front-left leg
            cv.p(sx + 1, 28, col('steel', 1))
            cv.vline(sx + 5, 23, 29, col('steel', 1))  # front-right leg
            cv.p(sx + 5, 23, col('steel', 3))
        else:
            cv.vline(sx + 6, 22, 27, col('steel', 1))  # rear-right leg (higher for 3/4 depth)
            cv.vline(sx + 5, 23, 29, col('steel', 1))  # front-right leg
            cv.vline(sx + 1, 23, 29, col('steel', 3))  # front-left leg
            cv.p(sx + 1, 28, col('steel', 1))
        # Light stretcher bar connecting legs above open lower space
        cv.hline(sx + 2, sx + 5, 25, col('steel', 2))

    draw_chair(2, flip=False)
    draw_chair(22, flip=True)

    # Distinct central cast-iron pedestal stem & flared circular weighted base
    cv.vline(15, 19, 27, col('steel', 4))
    cv.vline(16, 19, 27, col('steel', 2))
    cv.p(15, 20, col('steel', 5))
    # Flared 3/4 pedestal base disc (clearly reads as sculpted metal base, not shadow!)
    cv.hline(14, 18, 26, col('steel', 4))
    cv.p(14, 26, col('steel', 5))
    cv.hline(12, 20, 27, col('steel', 3))
    cv.hline(13, 16, 27, col('steel', 5))
    cv.p(12, 27, col('steel', 1))
    cv.p(19, 27, col('steel', 1))
    cv.hline(13, 19, 28, col('steel', 1))
    cv.hline(14, 17, 28, col('steel', 2))

    # Top-3/4 round warm travertine/marble bistro tabletop (cx=16, cy=14.2, rx=7.5, ry=5.0)
    # Wooden/brass rim thickness slightly below top ellipse
    draw_ellipse(cv, 16, 15.5, 7.6, 5.2, col('wood', 2), border=col('wood', 0))
    draw_ellipse(cv, 16, 14.2, 7.5, 5.0, col('kinari', 3), border=col('cedar', 3), hi=col('kinari', 4))
    # Subtle marble veining
    cv.p(15, 11, col('kinari', 2))
    cv.p(13, 16, col('kinari', 2))

    # Simplified tabletop: 2 diagonally staggered crisp white cup/saucer silhouettes
    # Upper-left white porcelain cup & saucer (x=10..15, y=11..15)
    cv.hline(11, 14, 14, col('stone', 2))      # crisp saucer contact shadow
    cv.hline(10, 15, 13, col('coolwhite', 3))  # saucer rim
    cv.hline(11, 14, 13, col('white', 6))
    cv.rect(11, 11, 14, 13, col('white', 6))   # white cup silhouette
    cv.p(13, 12, col('coolwhite', 4))          # right cup shading
    cv.p(14, 12, col('white', 6))              # tiny cup handle
    cv.hline(11, 13, 11, col('wood', 3))       # warm coffee rim
    cv.p(11, 11, col('white', 6))

    # Lower-right white porcelain cup & saucer (x=17..22, y=13..17)
    cv.hline(18, 21, 16, col('stone', 2))      # crisp saucer contact shadow
    cv.hline(17, 22, 15, col('coolwhite', 3))  # saucer rim
    cv.hline(18, 21, 15, col('white', 6))
    cv.rect(18, 13, 21, 15, col('white', 6))   # white cup silhouette
    cv.p(20, 14, col('coolwhite', 4))          # right cup shading
    cv.p(17, 14, col('white', 6))              # tiny cup handle
    cv.hline(19, 21, 13, col('wood', 3))       # warm coffee rim
    cv.p(20, 13, col('white', 6))


def draw_parasol_patio_set(cv):
    """12. mf-obj-parasol_patio_set (48x48) — Wide octagonal cream/terracotta parasol patio set."""
    # Grounded shadow under table & umbrella (compact, natural patio shadow)
    draw_ellipse(cv, 24, 43, 16, 3.2, col('ink', 1))
    draw_ellipse(cv, 24, 43, 9, 2.0, col('ink', 0))

    # --- LOWER LAYER: Table & 2 flanking chairs peeking beneath the parasol ---
    # Left & right terrace chairs (x=8..16, x=32..40, y=31..44)
    for cx, flip in ((8, False), (33, True)):
        bx = cx if not flip else cx + 5
        cv.outline_box(bx, 30, bx + 3, 38, col('cedar', 4), col('wood', 0), top_hi=col('cedar', 5))
        cv.outline_box(cx + (1 if not flip else 0), 34, cx + (7 if not flip else 6), 39, col('cream', 5), col('wood', 0), top_hi=col('white', 6))
        cv.vline(cx + 1, 39, 44, col('wood', 2))
        cv.vline(cx + 5, 39, 44, col('wood', 1))

    # Teak patio table rim + legs underneath
    draw_ellipse(cv, 24, 34, 11, 4.5, col('cedar', 4), border=col('wood', 0), hi=col('cedar', 5))
    # Table pedestal & heavy stone umbrella stand base
    cv.rect(22, 34, 26, 42, col('wood', 3))
    cv.vline(22, 34, 42, col('cedar', 5))
    cv.vline(25, 34, 42, col('wood', 0))
    draw_ellipse(cv, 24, 42, 5, 2.2, col('stone', 2), border=col('ink', 0), hi=col('stone', 4))

    # Dark underside cavity peeking beneath front parasol rim
    draw_ellipse(cv, 24, 27, 19, 8.5, col('brick', 1), border=col('ink', 0))
    # Underside radial ribs
    for dx in (-12, -5, 0, 5, 12):
        cv.vline(24 + dx, 27, 31, col('wood', 2))

    # --- UPPER LAYER: Top-3/4 Octagonal Cream & Terracotta Parasol Canopy ---
    cx, cy = 24.0, 19.5
    apex_x, apex_y = 24.0, 14.5  # shifted upward for authentic top-3/4 perspective!
    rx, ry = 21.5, 13.5

    for y in range(4, 35):
        for x in range(2, 46):
            # Octagonal-softened ellipse radius check
            nx = (x - cx) / rx
            ny = (y - cy) / ry
            ang = math.atan2(ny, nx)
            # Subtle 8-sided octagonal scalloped contour
            oct_mod = 0.94 + 0.06 * abs(math.cos(4.0 * ang))
            rad = math.hypot(nx, ny) / oct_mod
            if rad > 1.0:
                continue

            # Outer outline & front valance fringe
            if rad > 0.93:
                cv.p(x, y, col('brick', 0) if y > 20 else col('wood', 1))
                continue

            # Determine which of 8 alternating radial gores from apex
            gore_ang = math.atan2((y - apex_y) * 1.45, (x - apex_x))
            sector = int(math.floor((gore_ang + math.pi) / (math.pi / 4.0))) % 8
            is_terra = (sector % 2 == 0)
            rmp = 'brick' if is_terra else 'cream'

            # Rib seam between sectors
            local_frac = ((gore_ang + math.pi) % (math.pi / 4.0)) / (math.pi / 4.0)
            on_rib = (local_frac < 0.055 or local_frac > 0.945) and rad > 0.14

            # Top-left directional lighting on canopy dome
            light = -(nx * 0.6 + ny * 0.8)  # positive = upper-left sunlit
            if on_rib:
                idx = 2 if is_terra else 2
            elif rad > 0.84 and ny > 0.2:
                # Hanging front valance trim
                idx = 3 if is_terra else 3
            else:
                if is_terra:
                    idx = 5 if light > 0.45 else (4 if light > -0.1 else (3 if light > -0.55 else 2))
                else:
                    idx = 6 if light > 0.35 else (5 if light > -0.15 else (4 if light > -0.55 else 3))

            # Subtle woven fabric dither on midtones
            if not on_rib and hsh(x, y, 12) > 0.86 and idx > 2:
                idx -= 1
            cv.p(x, y, col(rmp, idx))

    # Scalloped bottom valance drop along front arc (clean, no stray outer specks)
    for x in range(8, 40):
        nx = (x - cx) / rx
        if abs(nx) < 0.80:
            y_edge = int(cy + ry * math.sqrt(max(0.0, 1.0 - nx * nx)) * 0.94)
            scallop = 1 if (x % 4 in (1, 2)) else 0
            cv.p(x, y_edge + scallop, col('brick', 1))
            if scallop:
                cv.p(x, y_edge, col('cream', 4) if ((x // 5) % 2 == 0) else col('brick', 3))

    # Central wooden finial cap at apex (24, 14)
    cv.rect(23, 13, 26, 16, col('cedar', 5))
    cv.p(24, 13, col('cedar', 6))
    cv.p(24, 15, col('wood', 1))
    cv.p(23, 15, col('wood', 2))


def draw_park_bench_wood(cv):
    """13. mf-obj-park_bench_wood (32x16) — Warm cedar-slat park bench with cast-iron armrests."""
    # Ground shadow strip
    cv.hline(3, 29, 14, col('ink', 0))
    cv.hline(4, 28, 15, col('ink', 1))

    # Angled backrest cedar slats (y=2..7, x=3..29)
    # Upper slat (y=2..4)
    cv.outline_box(3, 2, 29, 5, col('cedar', 4), col('wood', 0), top_hi=col('cedar', 6))
    # Lower backrest slat (y=5..7)
    cv.outline_box(3, 5, 29, 8, col('cedar', 4), col('wood', 0), top_hi=col('cedar', 5))
    # Subtle woodgrain variation across slats
    for x in range(4, 28):
        if hsh(x, 3, 13) > 0.72:
            cv.p(x, 3, col('cedar', 5))
        if hsh(x, 6, 13) < 0.25:
            cv.p(x, 6, col('cedar', 3))

    # Dark recess line between backrest and seat
    cv.hline(3, 29, 7, col('wood', 0))

    # Top-3/4 horizontal seat planks (y=8..12, x=2..30)
    cv.rect(3, 8, 29, 11, col('cedar', 5))
    cv.hline(3, 29, 8, col('cedar', 6))  # bright sunlit seat front/back plank
    cv.hline(3, 29, 9, col('cedar', 4))
    cv.hline(3, 29, 10, col('cedar', 5))
    cv.hline(3, 29, 11, col('wood', 2))  # front rounded edge lip
    cv.hline(3, 29, 12, col('wood', 0))

    # Cast-iron side & center scroll brackets, armrests & legs
    for ax in (2, 28):
        cv.rect(ax, 6, ax + 2, 15, col('steel', 1))
        cv.p(ax, 6, col('steel', 4))  # curved armrest highlight
        cv.p(ax + 1, 6, col('steel', 3))
        cv.vline(ax, 7, 14, col('steel', 3))
        cv.vline(ax + 1, 7, 15, col('steel', 0))
        # Rear foot slightly tucked
        cv.p(ax + (2 if ax == 2 else -1), 13, col('steel', 1))
    # Center cast-iron support brace
    cv.vline(15, 2, 14, col('steel', 1))
    cv.p(15, 8, col('steel', 3))
    cv.p(16, 12, col('steel', 0))
    cv.p(16, 13, col('steel', 1))


def draw_plaza_bench_stone(cv):
    """14. mf-obj-plaza_bench_stone (32x16) — Modern architectural granite slab plaza bench."""
    # Ground contact shadows anchored beneath the two recessed stone legs + subtle mid shadow
    cv.hline(4, 11, 14, col('ink', 0))
    cv.hline(5, 10, 15, col('ink', 1))
    cv.hline(21, 28, 14, col('ink', 0))
    cv.hline(22, 27, 15, col('ink', 1))

    # Deep recessed cast shadow directly beneath the overhanging stone slab (y=11..12)
    cv.hline(4, 28, 11, col('ink', 0))
    cv.hline(10, 22, 12, col('ink', 1))
    # Subtle soft floor shadow between the two recessed legs (leaves open gap at y=13..14 for clear 3D legs)
    cv.hline(11, 21, 13, col('ink', 2))

    # Two distinct recessed sculpted stone legs (x=5..10 and x=22..27, y=11..15)
    for lx in (5, 22):
        cv.outline_box(lx, 11, lx + 5, 15, col('stone', 3), col('stone', 0))
        cv.hline(lx + 1, lx + 4, 11, col('ink', 0))  # under-slab cast shadow on top of leg
        cv.vline(lx + 1, 12, 14, col('stone', 4))    # sunlit left face of stone leg
        cv.vline(lx + 2, 12, 14, col('stone', 3))
        cv.vline(lx + 3, 12, 14, col('stone', 2))    # shaded right face of stone leg

    # Top-3/4 bright sunlit horizontal stone slab top plane (6px tall: y=2..7, x=2..30)
    cv.hline(3, 29, 1, col('stone', 1))  # soft dark-slate back top edge
    for y in range(2, 8):
        cv.p(2, y, col('stone', 1))
        for x in range(3, 29):
            if y == 2:
                # Top-left bright sunlit bevel rim
                c = col('white', 6) if x < 18 else col('concrete', 6)
            elif y == 7:
                # Front chamfer catchlight separating bright top plane from darker vertical lip
                c = col('white', 6) if x < 16 else col('concrete', 6)
            else:
                # Sunlit granite top surface with gentle top-left to lower-right shading
                r = hsh(x, y, 14)
                if x < 14 and y <= 4:
                    c = col('white', 6) if r > 0.72 else (col('concrete', 6) if r > 0.2 else col('stone', 5))
                elif x > 22 and y >= 5:
                    c = col('stone', 5) if r > 0.28 else col('stone', 4)
                else:
                    c = col('concrete', 6) if r > 0.55 else (col('stone', 6) if r > 0.2 else col('stone', 5))
            cv.p(x, y, c)
        cv.p(28, y, col('stone', 4))  # right top-slab bevel
        cv.p(29, y, col('stone', 1))
    # Crisp top-left vertical highlight & subtle 3-block seams on top plane
    cv.vline(3, 2, 8, col('white', 6))
    for jx in (11, 20):
        cv.vline(jx, 2, 8, col('stone', 4))
        cv.vline(jx + 1, 2, 7, col('white', 6))

    # Crisp 3px darker vertical front lip/edge (y=8..10) for unmistakable 3/4 depth!
    for y in (8, 9):
        cv.p(2, y, col('stone', 0))
        for x in range(3, 29):
            r = hsh(x, y, 114)
            if y == 8:
                c = col('stone', 3) if r > 0.25 else col('stone', 2)
            else:
                c = col('stone', 2) if r > 0.25 else col('stone', 1)
            cv.p(x, y, c)
        cv.p(3, y, col('stone', 4 if y == 8 else 3))
        cv.p(28, y, col('stone', 1))
        cv.p(29, y, col('stone', 0))
    # Block seams continuing down front vertical lip
    for jx in (11, 20):
        cv.vline(jx, 8, 10, col('stone', 1))
    # Crisp bottom overhang edge of stone slab (y=10)
    cv.hline(2, 30, 10, col('stone', 0))


def draw_rooftop_pergola(cv):
    """15. mf-obj-rooftop_pergola (48x32) — Spacious cedar-beam rooftop pergola with climbing ivy."""
    # Ground shadows under front posts (y=30..31) & recessed rear posts (y=25..26)
    draw_shadow_bar(cv, 3, 10, 30, strong=True)
    draw_shadow_bar(cv, 38, 45, 30, strong=True)
    cv.hline(10, 15, 25, col('ink', 1))
    cv.hline(11, 14, 26, col('ink', 2))
    cv.hline(33, 38, 25, col('ink', 1))
    cv.hline(34, 37, 26, col('ink', 2))

    # Darker recessed rear posts clearly visible inside & behind front posts (x=11..14 and x=34..37, y=11..26)
    for px in (11, 34):
        cv.outline_box(px, 11, px + 3, 26, col('wood', 2), col('wood', 0))
        cv.vline(px + 1, 12, 25, col('wood', 3))
        cv.rect(px, 24, px + 3, 26, col('steel', 1))  # recessed steel base shoe
    # Subtle shaded rear upper tie-beam behind front crossbeam (depth cue)
    cv.hline(13, 35, 14, col('wood', 1))
    cv.hline(13, 35, 15, col('wood', 2))
    # Rear knee braces
    for d in range(3):
        cv.p(14 + d, 17 - d, col('wood', 2))
        cv.p(33 - d, 17 - d, col('wood', 2))

    # Front sturdy cedar corner posts (x=4..8 and x=40..44, y=13..30)
    for px in (4, 40):
        cv.outline_box(px, 13, px + 4, 30, col('cedar', 4), col('wood', 0))
        cv.vline(px + 1, 14, 29, col('cedar', 5))
        cv.vline(px + 2, 14, 29, col('cedar', 3))
        cv.hline(px + 1, px + 3, 14, col('wood', 1))  # shadow cast by front crossbeam
        # Steel anchor shoe at base
        cv.rect(px, 28, px + 4, 30, col('steel', 2))
        cv.p(px + 1, 28, col('steel', 4))

    # Diagonal cedar knee braces under front crossbeam
    for d in range(4):
        cv.p(8 + d, 18 - d, col('cedar', 4))
        cv.p(8 + d, 19 - d, col('wood', 1))
        cv.p(39 - d, 18 - d, col('cedar', 3))
        cv.p(39 - d, 19 - d, col('wood', 1))

    # Top-3/4 receding pergola roof plane (8px deep: y=2..10, trapezoid narrowing from x=2..46 to x=6..42)
    def roof_bounds(y):
        t = (y - 2) / 8.0
        lx = int(round(6 - 4 * t))
        rx = int(round(42 + 4 * t))
        return lx, rx

    # Perspective-converging diagonal cross-rafters receding from front (y=10) to rear (y=2)
    num_rafters = 9
    for idx in range(num_rafters):
        frac = idx / (num_rafters - 1)
        x_rear = 7.0 + frac * 34.0
        x_front = 3.0 + frac * 42.0
        for y in range(2, 11):
            t = (y - 2) / 8.0
            rx = int(round(x_rear + (x_front - x_rear) * t))
            # 2px wide perspective rafter with sunlit left edge & shaded right thickness
            cv.p(rx, y, col('cedar', 6 if y <= 6 else 5))
            cv.p(rx + 1, y, col('cedar', 3 if y <= 7 else 2))
            if idx < num_rafters - 1:
                cv.p(rx + 2, y, col('wood', 1))

    # Perspective side outer rim beams along left & right trapezoid edges (y=2..10)
    for y in range(2, 11):
        lx, rx = roof_bounds(y)
        cv.p(lx - 1, y, col('wood', 0))
        cv.p(lx, y, col('cedar', 6))
        cv.p(lx + 1, y, col('cedar', 4))
        cv.p(rx - 2, y, col('cedar', 4))
        cv.p(rx - 1, y, col('cedar', 3))
        cv.p(rx, y, col('wood', 0))

    # Sunlit horizontal purlin slats across the receding roof plane (y=2..3, y=5..6, y=8..9)
    # Cast 1px underside shadows onto rafters below while leaving airy transparent gaps between slats!
    for sy in (2, 5, 8):
        lx, rx = roof_bounds(sy)
        if sy == 2:
            cv.hline(lx, rx, 1, col('wood', 0))  # rear back outline
        cv.hline(lx, rx, sy, col('cedar', 6))     # bright sunlit top edge of slat
        cv.hline(lx + 1, rx - 1, sy + 1, col('cedar', 4))
        cv.p(lx, sy + 1, col('wood', 0))
        cv.p(rx - 1, sy + 1, col('wood', 0))
        # Cast shadow on rafters directly behind/under each slat
        if sy < 8:
            for idx in range(num_rafters):
                frac = idx / (num_rafters - 1)
                t = (sy + 2 - 2) / 8.0
                sx_r = int(round((7.0 + frac * 34.0) + ((3.0 + frac * 42.0) - (7.0 + frac * 34.0)) * t))
                cv.p(sx_r, sy + 2, col('wood', 2))
                cv.p(sx_r + 1, sy + 2, col('wood', 1))

    # Heavy front header crossbeam (y=10..14, x=2..46) receiving cast shadow from sunlit roof slats!
    cv.outline_box(2, 10, 46, 14, col('cedar', 4), col('wood', 0), top_hi=col('cedar', 5), bot_sh=col('wood', 2))
    # Continuous cast shadow from overhanging slats along upper front crossbeam (y=11)
    cv.hline(3, 45, 11, col('wood', 2))
    cv.hline(3, 45, 12, col('cedar', 3))
    # Protruding sunlit rafter tails & their crisp diagonal cast shadows on the front crossbeam
    for idx in range(num_rafters):
        frac = idx / (num_rafters - 1)
        fx = int(round(3.0 + frac * 42.0))
        cv.p(fx, 10, col('cedar', 6))
        cv.p(fx + 1, 10, col('cedar', 5))
        cv.p(fx, 11, col('cedar', 5))      # protruding tail face
        cv.p(fx + 1, 11, col('wood', 1))   # cast shadow next to tail
        cv.p(fx + 2, 12, col('wood', 1))   # angled shadow onto crossbeam face

    # Lush climbing ivy vines framing outer front posts & corners (keeping rear posts & perspective slats clear!)
    ivy_blobs = [
        (5, 8, 3, 2, 101, 'pink:4'),
        (10, 3, 4, 2, 102, 'yellow:5'),
        (5, 16, 2, 3, 103, None),
        (5, 22, 2, 2, 104, 'yellow:5'),
        (38, 4, 4, 2, 105, 'pink:4'),
        (43, 10, 3, 3, 106, None),
        (43, 17, 2, 3, 107, 'yellow:5'),
    ]
    for ix, iy, rx, ry, sd, flw in ivy_blobs:
        cv.foliage_cluster(ix, iy, rx, ry, ramp='foliage', seed=sd, blossom=flw)


def draw_rooftop_water_tank(cv):
    """16. mf-obj-rooftop_water_tank (32x32) — Stainless/blue water tank on steel lattice frame."""
    draw_shadow_bar(cv, 5, 28, 30, strong=True)

    # --- STEEL LATTICE SUPPORT STAND (y=20..30) ---
    # 4 vertical steel angle legs
    for lx in (8, 12, 19, 23):
        cv.vline(lx, 20, 30, col('steel', 1))
        cv.vline(lx + 1, 20, 30, col('steel', 3 if lx < 16 else 2))
    # Horizontal top & mid cross-girders
    cv.hline(7, 25, 21, col('steel', 4))
    cv.hline(7, 25, 22, col('steel', 1))
    cv.hline(8, 24, 28, col('steel', 2))
    # X-bracing struts
    for i in range(8):
        cv.p(9 + i * 2, 22 + i, col('steel', 3))
        cv.p(23 - i * 2, 22 + i, col('steel', 2))
    # Concrete foot pads
    cv.rect(7, 29, 11, 31, col('concrete', 4))
    cv.rect(21, 29, 25, 31, col('concrete', 3))

    # --- CYLINDRICAL STAINLESS/BLUE TANK DRUM (x=7..25, y=3..21) ---
    # Rounded 3/4 dome top (y=3..8)
    draw_ellipse(cv, 16, 6, 9, 3.2, col('coolwhite', 5), border=col('steel', 1), hi=col('white', 6))
    # Top inspection hatch lid
    draw_ellipse(cv, 15, 5, 3.2, 1.5, col('steel', 4), border=col('steel', 1), hi=col('white', 6))

    # Cylindrical tank body with smooth left-to-right metallic shading (y=7..21)
    col_profile = [
        ('steel', 1), ('coolwhite', 4), ('white', 6), ('white', 6), ('coolwhite', 5),
        ('coolwhite', 5), ('coolwhite', 4), ('coolwhite', 4), ('coolwhite', 4),
        ('coolwhite', 3), ('coolwhite', 3), ('coolwhite', 3), ('coolwhite', 2),
        ('coolwhite', 2), ('steel', 3), ('steel', 2), ('steel', 1), ('steel', 0),
    ]
    for y in range(7, 21):
        for i, (rmp, idx) in enumerate(col_profile):
            x = 7 + i
            # Blue identification band across middle (y=11..15)
            if 11 <= y <= 14 and 0 < i < len(col_profile) - 1:
                b_idx = 5 if i in (2, 3) else (4 if i < 9 else (3 if i < 14 else 2))
                cv.p(x, y, col('blue', b_idx))
            else:
                cv.p(x, y, col(rmp, idx))
    # Horizontal reinforcing steel ribs + bottom seam
    for ry in (10, 15, 20):
        cv.hline(7, 25, ry, col('steel', 1))
        cv.hline(8, 22, ry - 1, col('steel', 4))
    cv.hline(8, 24, 21, col('ink', 0))

    # Left-side inlet/outlet vertical pipe + red shutoff valve
    cv.vline(4, 6, 29, col('steel', 4))
    cv.vline(5, 6, 29, col('steel', 1))
    cv.hline(4, 8, 6, col('steel', 4))
    cv.hline(4, 8, 7, col('steel', 1))
    cv.hline(4, 8, 18, col('steel', 3))
    # Red valve wheel
    cv.rect(3, 15, 6, 18, col('red', 4))
    cv.p(4, 15, col('red', 5))
    cv.p(4, 16, col('steel', 5))

    # Right-side steel access ladder (x=25..28, y=5..29)
    cv.vline(25, 5, 30, col('steel', 3))
    cv.vline(28, 5, 30, col('steel', 1))
    for ly in range(7, 29, 3):
        cv.hline(25, 29, ly, col('coolwhite', 5))
        cv.hline(25, 29, ly + 1, col('steel', 1))


def draw_rooftop_ac_stack(cv):
    """17. mf-obj-rooftop_ac_stack (32x32) — Double-stacked commercial rooftop HVAC condenser units."""
    draw_shadow_bar(cv, 3, 29, 30, strong=True)

    # Heavy steel mounting rails & rack uprights (soft Fable dark-slate tones)
    cv.outline_box(3, 27, 29, 30, col('steel', 3), col('steel', 1), top_hi=col('steel', 5))
    cv.vline(4, 12, 29, col('steel', 2))
    cv.vline(24, 12, 29, col('steel', 1))

    def draw_ac_front(y_face, face_h):
        """Compact front grille face (height face_h) with soft Fable dark-slate borders."""
        y_end = y_face + face_h
        # Soft dark-slate borders (steel:2 left, steel:1 right/bottom) + cool shaded front face
        cv.rect(5, y_face, 24, y_end, col('coolwhite', 2))
        cv.vline(4, y_face, y_end + 1, col('steel', 2))
        cv.vline(5, y_face, y_end, col('coolwhite', 3))
        cv.vline(23, y_face, y_end, col('coolwhite', 1))
        cv.vline(24, y_face, y_end + 1, col('steel', 1))
        cv.hline(4, 25, y_end, col('steel', 1))

        # Compact circular dark fan grille on front-left (radius 2.8 x 2.3)
        cy = y_face + face_h // 2
        draw_ellipse(cv, 11, cy, 3.1, 2.5, col('steel', 0), border=col('steel', 2))
        cv.p(11, cy, col('coolwhite', 5))
        cv.p(10, cy - 1, col('steel', 4))
        cv.p(12, cy + 1, col('steel', 4))
        cv.p(12, cy - 1, col('steel', 3))
        cv.p(10, cy + 1, col('steel', 3))
        cv.hline(9, 14, cy, col('steel', 2))
        cv.p(11, cy, col('coolwhite', 5))

        # Right-side louvered service panel + brand stripe & status LEDs
        cv.hline(17, 23, y_face + 1, col('blue', 3))
        cv.p(22, y_face + 1, col('green', 4))
        cv.p(20, y_face + 1, col('red', 4))
        for ly in range(y_face + 3, y_end - 1):
            cv.hline(17, 23, ly, col('steel', 2 if (ly - y_face) % 2 == 1 else 4))

    # --- LOWER AC UNIT (y=15..26) with narrow 2px shadowed top ledge visible under bracket gap ---
    # 2px shadowed top ledge (y=15..16)
    cv.p(4, 15, col('steel', 2))
    cv.hline(5, 24, 15, col('steel', 3))         # shadowed back of lower top ledge
    cv.hline(6, 22, 15, col('steel', 2))         # deeper cast shadow directly under upper unit
    cv.p(24, 15, col('steel', 1))
    cv.p(4, 16, col('steel', 2))
    cv.hline(5, 24, 16, col('coolwhite', 2))     # front half of shadowed top ledge
    cv.hline(5, 13, 16, col('coolwhite', 3))     # slight ambient catchlight on left
    cv.p(24, 16, col('steel', 1))
    # 1px front bevel crease (y=17)
    cv.p(4, 17, col('steel', 2))
    cv.hline(5, 24, 17, col('steel', 2))
    cv.p(24, 17, col('steel', 1))
    # Shortened lower front grille face (y=18..25, 7px tall)
    draw_ac_front(18, 7)

    # Open steel support brackets holding upper unit above bracket gap (y=14, leaving center x=8..21 open!)
    cv.rect(3, 13, 8, 15, col('steel', 2))
    cv.hline(4, 7, 13, col('steel', 4))
    cv.rect(21, 13, 26, 15, col('steel', 1))
    cv.hline(22, 25, 13, col('steel', 3))

    # --- UPPER AC UNIT (y=1..13) with clear 4px sunlit cool-gray top plane ---
    # Soft chamfered Fable dark-slate back top border (y=1)
    cv.hline(5, 24, 1, col('steel', 2))
    cv.hline(17, 24, 1, col('steel', 1))
    # 4px sunlit cool-gray top plane (y=2..5, brightest top-left)
    for y in range(2, 6):
        cv.p(4, y, col('steel', 2))
        for x in range(5, 24):
            if y == 2:
                c = col('white', 6) if x < 15 else col('coolwhite', 5)
            elif y == 3:
                c = col('coolwhite', 5) if x < 14 else col('coolwhite', 4)
            elif y == 4:
                c = col('coolwhite', 4) if x < 18 else col('coolwhite', 3)
            else:
                # Front sunlit top bevel edge (y=5)
                c = col('white', 6) if x < 14 else (col('coolwhite', 5) if x < 21 else col('coolwhite', 3))
            cv.p(x, y, c)
        cv.p(24, y, col('steel', 1))
    # Subtle top vent grille slots recessed on the sunlit top plane (y=3..4)
    for vx in (7, 11, 15, 19):
        cv.hline(vx, vx + 2, 3, col('coolwhite', 3))
        cv.hline(vx, vx + 2, 4, col('steel', 4))
    # 1px front bevel crease separating sunlit top plane from front face (y=6)
    cv.p(4, 6, col('steel', 2))
    cv.hline(5, 24, 6, col('coolwhite', 1))
    cv.p(24, 6, col('steel', 1))
    # Shortened upper front grille face (y=7..13, 6px tall)
    draw_ac_front(7, 6)

    # Insulated copper refrigerant piping & black conduit bundle on right (x=25..29, y=9..28)
    cv.hline(24, 28, 9, col('brick', 4))
    cv.hline(24, 28, 10, col('orange', 4))
    cv.hline(24, 28, 21, col('brick', 4))
    cv.hline(24, 28, 22, col('orange', 4))
    # Vertical copper & insulated black pipes
    cv.vline(26, 9, 28, col('brick', 4))
    cv.vline(27, 9, 28, col('orange', 4))
    cv.vline(28, 10, 28, col('asphalt', 1))
    # Steel mounting clamps along pipe
    for cy in (13, 19, 25):
        cv.hline(25, 29, cy, col('steel', 4))
        cv.p(28, cy, col('steel', 1))


def draw_rooftop_solar_panel(cv):
    """18. mf-obj-rooftop_solar_panel (32x16) — Angled photovoltaic solar panel array on tilt legs."""
    # Cast shadow beneath angled panel array
    cv.hline(3, 29, 14, col('ink', 0))
    cv.hline(4, 28, 15, col('ink', 1))
    cv.rect(5, 13, 27, 14, col('ink', 1))

    # Rear & front steel A-frame tilt legs + concrete ballast pads
    for lx in (6, 23):
        cv.rect(lx, 11, lx + 3, 15, col('steel', 2))
        cv.vline(lx, 11, 15, col('steel', 4))
        cv.vline(lx + 2, 11, 15, col('steel', 0))
        cv.rect(lx - 1, 13, lx + 4, 15, col('concrete', 4))
        cv.hline(lx - 1, lx + 4, 13, col('concrete', 6))
        cv.hline(lx - 1, lx + 4, 14, col('concrete', 1))

    # Angled photovoltaic panel frame (x=2..30, y=2..12) with 3/4 tilt perspective (1px narrower at back top)
    cv.outline_box(2, 2, 30, 12, col('navy', 1), col('steel', 0))
    cv.clear(2, 2, 3, 4)
    cv.clear(29, 2, 30, 4)
    cv.p(3, 2, col('steel', 0))
    cv.p(28, 2, col('steel', 0))
    cv.p(2, 4, col('steel', 0))
    cv.p(29, 4, col('steel', 0))
    # Brushed silver aluminum outer bevel frame + front tilted lip thickness
    cv.hline(4, 28, 2, col('white', 6))
    cv.vline(3, 3, 11, col('coolwhite', 5))
    cv.hline(2, 30, 10, col('coolwhite', 5))
    cv.hline(2, 30, 11, col('steel', 1))
    cv.vline(28, 3, 11, col('steel', 2))

    # Photovoltaic silicon cells (x=4..28, y=3..10)
    for y in range(3, 10):
        for x in range(4, 28):
            # 4 modules wide x 2 rows tall grid with crisp silver busbars
            if x in (10, 16, 22) or y == 6:
                cv.p(x, y, col('coolwhite', 4) if y < 6 else col('steel', 4))
            else:
                cell_t = 2 if ((x + y) % 3 == 0) else 1
                cv.p(x, y, col('navy', cell_t) if y > 5 else col('blue', cell_t))

    # Crisp diagonal sky specular reflection sweeping across upper-left panels!
    for y in range(3, 10):
        sx = 12 - y
        for dx, cspec in ((0, 'glass:5'), (1, 'glass:6'), (2, 'white:6'), (3, 'glass:5')):
            px = sx + dx
            if 4 <= px < 28 and px not in (10, 16, 22) and y != 6:
                cv.p(px, y, cspec)
        sx2 = 25 - y
        if 4 <= sx2 < 28 and sx2 not in (10, 16, 22) and y != 6:
            cv.p(sx2, y, col('glass', 4))
            if sx2 + 1 < 28 and (sx2 + 1) not in (10, 16, 22):
                cv.p(sx2 + 1, y, col('glass', 5))


def draw_rooftop_laundry(cv):
    """19. mf-obj-rooftop_laundry (32x32) — Rooftop steel drying pole stand with fluttering clothes."""
    # Ground shadow anchored under the twin weighted bases + light cloth shadow
    draw_shadow_bar(cv, 2, 8, 30, strong=True)
    draw_shadow_bar(cv, 24, 30, 30, strong=True)
    cv.hline(10, 22, 30, col('ink', 1))

    # Twin steel drying pole stands (left x=4, right x=27)
    for px in (4, 27):
        # Weighted base block (concrete/blue stand base)
        cv.outline_box(px - 2, 26, px + 3, 30, col('concrete', 4), col('steel', 0), top_hi=col('white', 6))
        cv.hline(px - 1, px + 2, 28, col('blue', 3))
        # Vertical chrome pole
        cv.vline(px, 4, 27, col('coolwhite', 5))
        cv.vline(px + 1, 4, 27, col('steel', 2))
        # Top Y-bar bracket
        cv.hline(px - 1, px + 3, 4, col('steel', 4))
        cv.p(px - 1, 5, col('steel', 1))
        cv.p(px + 2, 5, col('steel', 1))

    # Rear lower rod (depth hint) & main front drying rod
    cv.hline(4, 29, 7, col('steel', 3))
    cv.hline(3, 30, 5, col('white', 6))
    cv.hline(3, 30, 6, col('steel', 2))

    # 1) Fluttering sky-blue shirt (x=6..12, y=7..19)
    cv.outline_box(7, 7, 11, 19, col('blue', 4), col('navy', 1), top_hi=col('blue', 5))
    # Sleeves
    cv.rect(6, 8, 8, 12, col('blue', 5))
    cv.vline(6, 8, 12, col('navy', 1))
    cv.rect(10, 8, 12, 12, col('blue', 3))
    cv.p(11, 12, col('navy', 1))
    # Fold shadow & breezy hem
    cv.vline(9, 10, 18, col('blue', 3))
    cv.p(7, 19, col('blue', 5))
    cv.p(9, 19, col('blue', 4))

    # 2) Billowing cream/white bedsheet (x=12..18, y=6..24) — 1px clean air gap
    cv.outline_box(12, 6, 18, 24, col('cream', 5), col('concrete', 1), top_hi=col('white', 6))
    cv.vline(13, 7, 23, col('white', 6))
    cv.vline(15, 8, 23, col('cream', 4))
    cv.vline(16, 7, 22, col('white', 6))
    # Breezy wavy bottom edge
    cv.p(13, 24, col('cream', 5))
    cv.p(14, 24, col('white', 6))
    cv.p(16, 24, col('cream', 4))

    # 3) Soft pink t-shirt with crisp sleeves (x=18..23, y=7..18)
    cv.outline_box(19, 7, 23, 18, col('pink', 4), col('pink', 1), top_hi=col('pink', 5))
    cv.rect(18, 8, 20, 12, col('pink', 5))
    cv.vline(18, 8, 12, col('pink', 1))
    cv.rect(22, 8, 24, 12, col('pink', 3))
    cv.vline(20, 8, 17, col('pink', 5))
    cv.vline(21, 9, 17, col('pink', 3))

    # 4) Cheerful red striped bath towel (x=24..27, y=6..21)
    cv.outline_box(24, 6, 28, 21, col('red', 4), col('red', 0), top_hi=col('red', 5))
    cv.hline(25, 27, 9, col('white', 6))
    cv.hline(25, 27, 13, col('white', 6))
    cv.hline(25, 27, 17, col('cream', 5))
    cv.vline(26, 7, 20, col('red', 3))

    # Tiny colorful clothespins clipped along top rod (y=4..6)
    for cx, cc in ((8, 'yellow:5'), (10, 'yellow:5'), (13, 'red:4'), (16, 'blue:4'), (20, 'yellow:5'), (25, 'green:4')):
        cv.p(cx, 4, cc)
        cv.p(cx, 5, cc)


def draw_rooftop_garden_bed(cv):
    """20. mf-obj-rooftop_garden_bed (32x16) — Raised cedar urban vegetable planter + watering can."""
    # Ground shadow along planter & watering can
    cv.hline(2, 30, 14, col('ink', 0))
    cv.hline(3, 29, 15, col('ink', 1))

    # Raised cedar-plank planter box (x=2..24, y=5..14)
    cv.outline_box(2, 5, 24, 15, col('cedar', 4), col('wood', 0))
    # Sunlit top rim planks (y=5..8) enclosing dark topsoil
    cv.hline(3, 23, 5, col('cedar', 6))
    cv.rect(3, 6, 23, 8, col('soil', 1))
    for sx in range(4, 22, 3):
        cv.p(sx, 7, col('soil', 3))
        cv.p(sx + 1, 6, col('soil', 2))
    # Front horizontal cedar planks (y=8..14)
    cv.hline(3, 23, 8, col('cedar', 6))
    cv.hline(3, 23, 9, col('cedar', 4))
    cv.hline(3, 23, 10, col('wood', 2))
    cv.hline(3, 23, 11, col('cedar', 5))
    cv.hline(3, 23, 12, col('cedar', 3))
    cv.hline(3, 23, 13, col('wood', 2))
    # Corner timber posts & dark steel corner brackets
    for cx in (2, 22):
        cv.rect(cx, 5, cx + 2, 14, col('wood', 3))
        cv.vline(cx, 5, 14, col('cedar', 5))
        cv.p(cx + 1, 9, col('steel', 2))
        cv.p(cx + 1, 12, col('steel', 2))

    # Wooden mini tomato trellis stake
    cv.vline(9, 1, 7, col('cedar', 5))
    cv.vline(10, 2, 7, col('wood', 2))
    cv.hline(7, 13, 3, col('cedar', 4))

    # Overflowing lush leafy greens, herbs & ripe red tomatoes!
    cv.foliage_cluster(6, 5, 3, 2, ramp='foliage', seed=201, blossom='yellow:5')
    cv.foliage_cluster(11, 4, 4, 3, ramp='foliage', seed=202)
    cv.foliage_cluster(16, 5, 3, 2, ramp='foliage', seed=203, blossom='yellow:5')
    cv.foliage_cluster(20, 5, 3, 2, ramp='foliage', seed=204)

    # Bright ripe red cherry tomatoes nestled in foliage + cascading front vine leaves
    for tx, ty in ((8, 3), (11, 5), (13, 4), (17, 6)):
        cv.p(tx, ty, col('red', 4))
        cv.p(tx + 1, ty, col('red', 3))
        cv.p(tx, ty - 1, col('red', 5))
    for lx, ly in ((5, 8), (6, 9), (14, 8), (15, 9), (20, 8)):
        cv.p(lx, ly, col('foliage', 5 if ly == 8 else 4))

    # Cute small teal watering can sitting on the right (x=25..31, y=8..14)
    cv.outline_box(26, 9, 31, 14, col('teal', 4), col('teal', 0), top_hi=col('teal', 5))
    cv.vline(27, 10, 13, col('teal', 5))
    cv.vline(29, 10, 13, col('teal', 2))
    # Handle loop on right
    cv.p(31, 10, col('teal', 2))
    cv.p(31, 11, col('teal', 2))
    cv.p(31, 12, col('teal', 1))
    # Angled spout pointing left toward garden bed + rose head
    cv.p(25, 11, col('teal', 4))
    cv.p(24, 10, col('teal', 5))
    cv.p(23, 9, col('coolwhite', 5))


# ===========================================================================
# Batch Registry & Builder
# ===========================================================================

SPECS = [
    # Category: vending-kiosks (10)
    {
        'id': 'mf-obj-vending_drink_lit',
        'name': '음료 자판기 (점등)',
        'category': 'vending-kiosks',
        'size': [16, 32],
        'tags': ['vending', 'kiosk', 'street', 'lit', 'drink'],
        'lightAnchor': {'x': 8, 'y': 12, 'color': '#eef2f2', 'radius': 2.5},
        'fn': draw_vending_drink_lit,
    },
    {
        'id': 'mf-obj-vending_snack',
        'name': '스낵·커피 자판기',
        'category': 'vending-kiosks',
        'size': [16, 32],
        'tags': ['vending', 'kiosk', 'street', 'lit', 'snack'],
        'lightAnchor': {'x': 11, 'y': 13, 'color': '#f6cc7c', 'radius': 2.0},
        'fn': draw_vending_snack,
    },
    {
        'id': 'mf-obj-gacha_row',
        'name': '캡슐토이 가챠 4열',
        'category': 'vending-kiosks',
        'size': [32, 32],
        'tags': ['gacha', 'vending', 'shopfront', 'street'],
        'fn': draw_gacha_row,
    },
    {
        'id': 'mf-obj-ticket_kiosk',
        'name': '무인 발권 키오스크',
        'category': 'vending-kiosks',
        'size': [32, 32],
        'tags': ['kiosk', 'station', 'parking', 'lit'],
        'lightAnchor': {'x': 14, 'y': 14, 'color': '#86b8c8', 'radius': 2.5},
        'fn': draw_ticket_kiosk,
    },
    {
        'id': 'mf-obj-parcel_locker',
        'name': '무인 택배 보관함',
        'category': 'vending-kiosks',
        'size': [32, 32],
        'tags': ['locker', 'kiosk', 'parcel', 'lit'],
        'lightAnchor': {'x': 16, 'y': 14, 'color': '#86b8c8', 'radius': 2.2},
        'fn': draw_parcel_locker,
    },
    {
        'id': 'mf-obj-phone_booth',
        'name': '공중전화 부스',
        'category': 'vending-kiosks',
        'size': [16, 32],
        'tags': ['phone', 'booth', 'retro', 'street', 'lit'],
        'lightAnchor': {'x': 8, 'y': 9, 'color': '#f8eca0', 'radius': 2.5},
        'fn': draw_phone_booth,
    },
    {
        'id': 'mf-obj-atm_kiosk',
        'name': '은행 ATM 부스',
        'category': 'vending-kiosks',
        'size': [32, 32],
        'tags': ['atm', 'bank', 'kiosk', 'lit'],
        'lightAnchor': {'x': 16, 'y': 9, 'color': '#6c98cc', 'radius': 3.0},
        'fn': draw_atm_kiosk,
    },
    {
        'id': 'mf-obj-pojangmacha_cart',
        'name': '포장마차 노점 수레',
        'category': 'vending-kiosks',
        'size': [48, 32],
        'tags': ['pojangmacha', 'food-cart', 'korean', 'street', 'lit'],
        'lightAnchor': {'x': 24, 'y': 13, 'color': '#f6cc7c', 'radius': 3.5},
        'fn': draw_pojangmacha_cart,
    },
    {
        'id': 'mf-obj-coffee_cart',
        'name': '모바일 에스프레소 커피 카트',
        'category': 'vending-kiosks',
        'size': [48, 32],
        'tags': ['coffee', 'cart', 'cafe', 'street', 'lit'],
        'lightAnchor': {'x': 24, 'y': 10, 'color': '#f8eca0', 'radius': 3.0},
        'fn': draw_coffee_cart,
    },
    {
        'id': 'mf-obj-newsstand_kiosk',
        'name': '가판대 잡지·음료 키오스크',
        'category': 'vending-kiosks',
        'size': [48, 32],
        'tags': ['newsstand', 'kiosk', 'magazine', 'street', 'lit'],
        'lightAnchor': {'x': 18, 'y': 13, 'color': '#f6cc7c', 'radius': 3.2},
        'fn': draw_newsstand_kiosk,
    },

    # Category: seating-terrace (10)
    {
        'id': 'mf-obj-cafe_bistro_set',
        'name': '카페 비스트로 테이블 세트',
        'category': 'seating-terrace',
        'size': [32, 32],
        'tags': ['cafe', 'bistro', 'table', 'seating', 'terrace'],
        'fn': draw_cafe_bistro_set,
    },
    {
        'id': 'mf-obj-parasol_patio_set',
        'name': '테라스 팔각 파라솔 테이블',
        'category': 'seating-terrace',
        'size': [48, 48],
        'tags': ['parasol', 'patio', 'cafe', 'seating', 'terrace'],
        'fn': draw_parasol_patio_set,
    },
    {
        'id': 'mf-obj-park_bench_wood',
        'name': '공원 삼나무 벤치',
        'category': 'seating-terrace',
        'size': [32, 16],
        'tags': ['bench', 'park', 'wood', 'seating'],
        'fn': draw_park_bench_wood,
    },
    {
        'id': 'mf-obj-plaza_bench_stone',
        'name': '광장 화강암 벤치',
        'category': 'seating-terrace',
        'size': [32, 16],
        'tags': ['bench', 'plaza', 'stone', 'seating'],
        'fn': draw_plaza_bench_stone,
    },
    {
        'id': 'mf-obj-rooftop_pergola',
        'name': '옥상 담쟁이 퍼걸러',
        'category': 'seating-terrace',
        'size': [48, 32],
        'tags': ['pergola', 'rooftop', 'terrace', 'ivy'],
        'fn': draw_rooftop_pergola,
    },
    {
        'id': 'mf-obj-rooftop_water_tank',
        'name': '옥상 철골 물탱크',
        'category': 'seating-terrace',
        'size': [32, 32],
        'tags': ['water-tank', 'rooftop', 'utility'],
        'fn': draw_rooftop_water_tank,
    },
    {
        'id': 'mf-obj-rooftop_ac_stack',
        'name': '옥상 2단 실외기 스택',
        'category': 'seating-terrace',
        'size': [32, 32],
        'tags': ['hvac', 'ac', 'rooftop', 'utility'],
        'fn': draw_rooftop_ac_stack,
    },
    {
        'id': 'mf-obj-rooftop_solar_panel',
        'name': '옥상 태양광 패널 어레이',
        'category': 'seating-terrace',
        'size': [32, 16],
        'tags': ['solar', 'rooftop', 'utility', 'eco'],
        'fn': draw_rooftop_solar_panel,
    },
    {
        'id': 'mf-obj-rooftop_laundry',
        'name': '옥상 빨래 건조대',
        'category': 'seating-terrace',
        'size': [32, 32],
        'tags': ['laundry', 'rooftop', 'daily-life'],
        'fn': draw_rooftop_laundry,
    },
    {
        'id': 'mf-obj-rooftop_garden_bed',
        'name': '옥상 텃밭 화분 상자',
        'category': 'seating-terrace',
        'size': [32, 16],
        'tags': ['garden', 'planter', 'rooftop', 'urban-farm'],
        'fn': draw_rooftop_garden_bed,
    },
]


def build_batch():
    os.makedirs(OUT_DIR, exist_ok=True)
    items = []
    for spec in SPECS:
        w, h = spec['size']
        cv = Canvas(w, h)
        spec['fn'](cv)
        out_path = os.path.join(OUT_DIR, f"{spec['id']}.png")
        cv.save(out_path)
        entry = {
            'id': spec['id'],
            'name': spec['name'],
            'category': spec['category'],
            'w': w // 16,
            'h': h // 16,
            'size': [w, h],
            'file': f"{spec['id']}.png",
            'tags': spec['tags'],
        }
        if 'lightAnchor' in spec:
            entry['lightAnchor'] = spec['lightAnchor']
        items.append(entry)

    manifest = {
        'batch': 'batch_02',
        'kind': 'objects',
        'palette': 'tiledata/jp-city/fable-city/palette.json',
        'count': len(items),
        'items': items,
    }
    mpath = os.path.join(OUT_DIR, 'manifest.json')
    with open(mpath, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f'batch_02: generated {len(items)} objects -> {OUT_DIR}')


if __name__ == '__main__':
    build_batch()
