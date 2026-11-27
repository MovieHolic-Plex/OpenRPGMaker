#!/usr/bin/env python3
"""Batch O4 (20 modern objects) in Fable 5.2 top-3/4 RPG pixel-art baseline.

Strictly locked to tiledata/jp-city/fable-city/palette.json (0 off-palette pixels, binary alpha).
Categories:
  - alley-utility (10)
  - shopfront-life (10)

Outputs 20 RGBA PNGs + manifest.json into tiledata/modern-fable/objects/batch_04/.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PARENT = os.path.dirname(HERE)
if PARENT not in sys.path:
    sys.path.insert(0, PARENT)

from fable_lib import Canvas, col, hsh, OUT_ROOT

OUT_DIR = os.path.join(OUT_ROOT, 'objects', 'batch_04')


def _shadow_line(cv, x0, x1, y, dark=True):
    """Grounded bottom contact shadow in Fable warm-violet ink."""
    c_mid = col('ink', 0 if dark else 1)
    c_edge = col('ink', 1 if dark else 2)
    for x in range(x0, x1):
        if x == x0 or x == x1 - 1:
            cv.p(x, y, c_edge)
        else:
            cv.p(x, y, c_mid)


# ---------------------------------------------------------------------------
# CATEGORY 1: alley-utility (10)
# ---------------------------------------------------------------------------

def draw_plastic_crates(cv):
    """32x16: Stacked yellow, blue, and red slatted beer/milk crates with bottle tops."""
    # Ground shadow
    _shadow_line(cv, 1, 30, 15, dark=True)
    cv.hline(2, 29, 14, col('ink', 1))

    # --- Bottom-left YELLOW crate (x=1..14, y=6..14) ---
    cv.rect(1, 6, 15, 9, col('yellow', 4))
    cv.hline(1, 15, 6, col('yellow', 0))
    cv.hline(2, 14, 7, col('yellow', 5))
    cv.rect(2, 7, 14, 9, col('ink', 1))
    # Peeking green & amber beer bottles with bright caps
    bottles_l = [(3, 'foliage', 'yellow:5'), (6, 'cha', 'white:6'), (9, 'foliage', 'red:4'), (12, 'cha', 'yellow:5')]
    for bx, bramp, cap in bottles_l:
        cv.rect(bx, 5, bx + 2, 9, col(bramp, 4))
        cv.p(bx, 5, col(bramp, 5))
        cv.p(bx, 4, cap)
        cv.p(bx + 1, 4, col('ink', 0))
    # Front wall of yellow crate
    cv.outline_box(1, 8, 15, 15, col('yellow', 3), col('yellow', 0), top_hi=col('yellow', 5), bot_sh=col('yellow', 2))
    for sx in (3, 6, 9, 12):
        cv.vline(sx, 10, 13, col('ink', 0))
        cv.vline(sx + 1, 10, 13, col('yellow', 4))
    cv.hline(6, 10, 10, col('ink', 0))  # grip handle cutout

    # --- Bottom-right BLUE crate (x=15..30, y=5..14) ---
    cv.rect(15, 5, 30, 8, col('blue', 4))
    cv.hline(15, 30, 5, col('blue', 0))
    cv.hline(16, 29, 6, col('blue', 5))
    cv.rect(16, 6, 29, 8, col('navy', 0))
    # Milk & glass bottles peeking cleanly at top
    bottles_r = [(17, 'coolwhite', 'red:4'), (20, 'white', 'red:4'), (23, 'glass', 'white:6'), (26, 'white', 'blue:5')]
    for bx, bramp, cap in bottles_r:
        cv.rect(bx, 4, bx + 2, 8, col(bramp, 5))
        cv.p(bx, 3, cap)
        cv.p(bx + 1, 4, col(bramp, 2))
    # Front wall of blue crate
    cv.outline_box(15, 7, 30, 15, col('blue', 3), col('blue', 0), top_hi=col('blue', 5), bot_sh=col('blue', 1))
    for sx in (17, 20, 23, 26):
        cv.vline(sx, 9, 13, col('navy', 0))
        cv.vline(sx + 1, 9, 13, col('blue', 4))
    cv.hline(21, 25, 9, col('ink', 0))
    cv.rect(27, 9, 29, 12, col('white', 5))  # delivery label sticker
    cv.p(28, 10, col('red', 4))

    # --- Top stacked RED crate (x=7..23, y=0..8) ---
    cv.hline(8, 23, 8, col('ink', 0))  # cast shadow onto lower crates
    # 3/4 Open top rim showing bottle caps & grid
    cv.rect(7, 1, 23, 4, col('red', 4))
    cv.hline(7, 23, 1, col('red', 0))
    cv.hline(8, 22, 2, col('red', 5))
    cv.rect(8, 2, 22, 4, col('ink', 1))
    top_caps = [(9, 'foliage', 'yellow:5'), (12, 'cha', 'white:6'), (15, 'foliage', 'yellow:5'), (18, 'glass', 'orange:5'), (20, 'cha', 'white:6')]
    for bx, bramp, cap in top_caps:
        cv.p(bx, 0, cap)
        cv.p(bx, 1, col(bramp, 4))
        cv.p(bx, 2, col(bramp, 2))
        cv.p(bx + 1, 1, col('ink', 0))
    # Front slatted wall of red crate
    cv.outline_box(7, 3, 23, 8, col('red', 3), col('red', 0), top_hi=col('red', 5), bot_sh=col('red', 1))
    for sx in (9, 12, 15, 18, 20):
        cv.p(sx, 5, col('ink', 0))
        cv.p(sx, 6, col('red', 1))
        cv.p(sx + 1, 5, col('red', 4))
    cv.hline(13, 17, 5, col('ink', 0))


def draw_recycle_bin_trio(cv):
    """32x16: Three side-by-side sorting bins (blue paper, green glass, orange plastic)."""
    _shadow_line(cv, 1, 31, 15, dark=True)
    bins = [
        (1, 'blue', 'slot_wide', 'white:5'),
        (11, 'green', 'slot_round', 'yellow:5'),
        (21, 'orange', 'slot_wide', 'white:5'),
    ]
    for bx, ramp, slot_kind, badge in bins:
        # 3/4 Angled hooded lid (y=1..6)
        cv.hline(bx + 1, bx + 9, 1, col(ramp, 0))
        cv.hline(bx + 1, bx + 9, 2, col(ramp, 5))
        cv.rect(bx, 2, bx + 10, 7, col(ramp, 3))
        cv.hline(bx + 1, bx + 9, 2, col(ramp, 5))
        cv.hline(bx + 1, bx + 9, 3, col(ramp, 4))
        cv.vline(bx, 2, 7, col(ramp, 0))
        cv.vline(bx + 9, 2, 7, col(ramp, 0))
        cv.hline(bx, bx + 10, 6, col(ramp, 1))
        # Dark recessed throw-in slot opening on lid slant
        if slot_kind == 'slot_round':
            cv.rect(bx + 3, 3, bx + 7, 6, col('ink', 0))
            cv.p(bx + 3, 3, col(ramp, 2))
            cv.p(bx + 6, 3, col(ramp, 2))
            cv.hline(bx + 4, bx + 6, 5, col('asphalt', 1))
        else:
            cv.rect(bx + 2, 4, bx + 8, 6, col('ink', 0))
            cv.hline(bx + 2, bx + 8, 3, col(ramp, 5))
        # Pale ribbed bin body (y=7..14)
        cv.outline_box(bx, 6, bx + 10, 15, col('coolwhite', 3), col('steel', 0), top_hi=col('coolwhite', 5), bot_sh=col('steel', 2))
        # Under-lid cast shadow
        cv.hline(bx + 1, bx + 9, 7, col('steel', 1))
        # Vertical side body ribs
        cv.vline(bx + 1, 8, 14, col('coolwhite', 4))
        cv.vline(bx + 8, 8, 14, col('steel', 3))
        # Color-coded front sorting stripe & label card
        cv.hline(bx + 2, bx + 8, 8, col(ramp, 4))
        cv.rect(bx + 3, 9, bx + 7, 13, badge)
        cv.p(bx + 4, 10, col(ramp, 3))
        cv.p(bx + 5, 10, col(ramp, 2))
        cv.p(bx + 4, 11, col(ramp, 2))
        cv.p(bx + 5, 11, col(ramp, 4))
        # Foot kickplate
        cv.hline(bx + 1, bx + 9, 13, col('steel', 2))
        cv.p(bx + 1, 14, col('ink', 0))
        cv.p(bx + 8, 14, col('ink', 0))


def draw_metal_dumpster(cv):
    """32x32: Weathered dark-green commercial dumpster with slanted black hinged lids & lift pockets."""
    # Ground contact shadow
    _shadow_line(cv, 2, 30, 31, dark=True)
    cv.hline(3, 29, 30, col('ink', 1))

    # --- Hinged slanted black/kuro top lids (y=4..13) ---
    # Back hinge bar
    cv.hline(4, 28, 4, col('kuro', 0))
    cv.hline(5, 27, 5, col('steel', 4))
    for hx in (7, 15, 24):
        cv.rect(hx, 4, hx + 2, 6, col('steel', 5))
    # Slanted lid surface (top-3/4 plane!)
    for y in range(6, 13):
        lx0 = 3 if y >= 8 else 4
        lx1 = 29 if y >= 8 else 28
        for x in range(lx0, lx1):
            if x == lx0 or x == lx1 - 1:
                cv.p(x, y, col('kuro', 0))
            elif x in (15, 16):
                # Center split between left & right lids
                cv.p(x, y, col('kuro', 0) if x == 15 else col('kuro', 4))
            elif (x - 4) % 4 == 0:
                # Molded lid rib highlight
                cv.p(x, y, col('kuro', 5 if y <= 9 else 4))
            elif (x - 4) % 4 == 1:
                cv.p(x, y, col('kuro', 2))
            else:
                cv.p(x, y, col('kuro', 3 if y < 10 else 2))
    # Front lip of black lids + slight peek of white trash bag under right lid
    cv.hline(3, 15, 12, col('kuro', 4))
    cv.hline(3, 15, 13, col('ink', 0))
    cv.hline(16, 29, 12, col('kuro', 5))
    cv.hline(16, 29, 13, col('kuro', 1))
    cv.rect(20, 12, 24, 14, col('coolwhite', 5))
    cv.p(21, 13, col('white', 6))
    cv.p(23, 13, col('steel', 3))

    # --- Heavy steel rim collar (y=14..16) ---
    cv.outline_box(2, 13, 30, 16, col('midori', 4), col('midori', 0), top_hi=col('midori', 5))
    cv.hline(3, 29, 15, col('midori', 1))

    # --- Weathered dark-green corrugated steel body (y=16..28) ---
    cv.rect(3, 16, 29, 29, col('midori', 2))
    cv.vline(3, 16, 29, col('midori', 0))
    cv.vline(28, 16, 29, col('midori', 0))
    cv.hline(3, 29, 28, col('midori', 0))
    # Cast shadow right below rim
    cv.hline(4, 28, 16, col('midori', 0))
    cv.hline(4, 28, 17, col('midori', 1))
    # Corrugated vertical ribs & weathered grime stippling
    for y in range(17, 28):
        for x in range(4, 28):
            r = hsh(x, y, 403)
            if x in (8, 13, 18, 23):
                cv.p(x, y, col('midori', 4 if y < 24 else 3))
            elif x in (9, 14, 19, 24):
                cv.p(x, y, col('midori', 1))
            else:
                t = 3 if (x < 12 and y < 23) else 2
                if r < 0.16:
                    t = max(1, t - 1)
                elif r > 0.86 and y < 22:
                    t = min(4, t + 1)
                cv.p(x, y, col('midori', t))
    # Horizontal reinforcing center belt
    cv.hline(4, 28, 21, col('midori', 4))
    cv.hline(4, 28, 22, col('midori', 1))
    # Grime / rust streaks near bottom corners & under rim
    for rx, ry in [(5, 17), (6, 26), (7, 27), (15, 26), (25, 25), (26, 26), (26, 27), (22, 18)]:
        cv.p(rx, ry, col('cha', 3 if (rx + ry) % 2 == 0 else 2))
    cv.p(25, 27, col('brick', 3))
    cv.p(5, 27, col('moss', 2))
    # Small yellow/black hazard caution plate on front-right
    cv.rect(19, 18, 26, 21, col('yellow', 4))
    cv.hline(19, 26, 18, col('ink', 0))
    cv.p(20, 19, col('ink', 0))
    cv.p(22, 19, col('ink', 0))
    cv.p(24, 19, col('ink', 0))
    cv.p(21, 20, col('ink', 0))
    cv.p(23, 20, col('ink', 0))

    # --- Side steel fork-lift pockets (left x=1..4, right x=28..31) ---
    cv.outline_box(1, 19, 5, 25, col('steel', 3), col('steel', 0), top_hi=col('steel', 5), bot_sh=col('steel', 1))
    cv.rect(2, 21, 4, 23, col('ink', 0))
    cv.outline_box(27, 19, 31, 25, col('steel', 2), col('steel', 0), top_hi=col('steel', 4), bot_sh=col('steel', 1))
    cv.rect(28, 21, 30, 23, col('ink', 0))

    # --- Heavy caster wheels & base skids (y=28..31) ---
    for wx in (5, 23):
        cv.rect(wx, 28, wx + 4, 31, col('asphalt', 0))
        cv.p(wx + 1, 29, col('steel', 4))
        cv.p(wx + 2, 29, col('steel', 3))
        cv.hline(wx, wx + 4, 28, col('steel', 2))


def draw_garbage_net_cage(cv):
    """32x16: Folding yellow/blue Japanese alley trash collection net cage with tied bags."""
    _shadow_line(cv, 1, 31, 15, dark=True)

    # 3/4 Recessed open top silhouette with transparent notches above upper corners (x=0..2, y=0..3 & x=29..31, y=0..3)
    # Back top folding frame rail (x=3..29, y=1..2)
    cv.hline(3, 29, 1, col('blue', 0))
    cv.hline(3, 29, 2, col('blue', 4))
    cv.p(3, 2, col('blue', 0))
    cv.p(28, 2, col('blue', 0))

    # Recessed dark interior cavity (trapezoidal top opening y=3..5, body y=6..13)
    cv.rect(3, 3, 29, 4, col('navy', 0))
    cv.rect(2, 4, 30, 14, col('navy', 0))
    # Subtle depth shading inside recessed top opening
    cv.hline(4, 28, 3, col('ink', 0))

    # Angled side top rails connecting recessed back corners to front frame posts
    cv.p(2, 3, col('blue', 0))
    cv.p(3, 3, col('blue', 4))
    cv.p(1, 4, col('blue', 0))
    cv.p(2, 4, col('blue', 5))
    cv.p(29, 3, col('blue', 0))
    cv.p(28, 3, col('blue', 3))
    cv.p(30, 4, col('blue', 0))
    cv.p(29, 4, col('blue', 4))

    # 3 plump, clean rounded translucent-white tied garbage bags packed inside
    # Knotted bag tops sit cleanly inside the recessed 3/4 top opening (y=3..5) below unbroken back rail
    bags = [
        (4, 4, 12, 13, 'white', 'orange:4', 7),
        (11, 4, 21, 13, 'coolwhite', 'green:4', 16),
        (20, 4, 28, 13, 'white', 'blue:4', 24),
    ]
    for x0, y0, x1, y1, ramp, hint, kx in bags:
        mx = (x0 + x1) // 2
        for y in range(y0, y1):
            for x in range(x0, x1):
                if y == y0 and (x == x0 or x == x1 - 1):
                    continue
                if x == x0 or x == x1 - 1 or y == y1 - 1:
                    cv.p(x, y, col('steel', 1))
                elif y == y0:
                    cv.p(x, y, col(ramp, 3))
                elif y <= y0 + 2 and x <= mx:
                    cv.p(x, y, col('white', 6) if (y == y0 + 1 and x == mx - 1) else col(ramp, 5))
                elif y >= y1 - 2 or x >= x1 - 2:
                    cv.p(x, y, col(ramp, 1))
                else:
                    cv.p(x, y, col(ramp, 4 if x <= mx else 3))
        # Crisp knotted rabbit-ear tie sitting cleanly inside recessed 3/4 opening (y=3)
        cv.p(kx - 1, y0 - 1, col('white', 6))
        cv.p(kx + 1, y0 - 1, col(ramp, 5))
        cv.p(kx, y0 - 1, col(ramp, 3))
        cv.p(kx, y0, col('steel', 1))  # tight knot pinch
        # Subtle translucent recycling tint inside bag belly
        cv.p(mx - 1, y0 + 5, hint)
        cv.p(mx, y0 + 5, hint)

    # Clean, spaced orthogonal YELLOW crow-proof mesh grid over front face (y=6..12)
    # No noisy diagonal scatter — crisp horizontal & vertical net cords let bags read cleanly!
    cv.hline(2, 30, 6, col('yellow', 5))  # crisp front top net cord (below 3-4px open top!)
    cv.hline(3, 29, 9, col('yellow', 4))  # single spaced mid horizontal mesh line
    for gx in (7, 12, 17, 22, 27):
        for gy in range(7, 12):
            cv.p(gx, gy, col('yellow', 5 if gy == 9 else 4))
    # Weighted yellow hem cord & sturdy blue folding bottom/side frame
    cv.hline(2, 30, 12, col('yellow', 4))
    cv.hline(2, 30, 13, col('blue', 3))
    cv.hline(1, 31, 14, col('blue', 0))
    cv.vline(1, 4, 15, col('blue', 0))
    cv.vline(2, 5, 14, col('blue', 4))
    cv.vline(29, 5, 14, col('blue', 3))
    cv.vline(30, 4, 15, col('blue', 0))

    # Compact blue-and-white collection day tag on left front corner
    cv.outline_box(3, 8, 7, 12, col('white', 6), col('blue', 1))
    cv.hline(4, 6, 9, col('blue', 4))
    cv.p(4, 10, col('red', 3))
    cv.p(5, 10, col('red', 3))


def draw_wall_ac_unit(cv):
    """16x16: Outdoor split-system AC condenser with Fable slate-cream casing, fan grille & tight pipe loop."""
    _shadow_line(cv, 1, 14, 15, dark=True)

    # Concrete mounting blocks at bottom
    cv.outline_box(2, 13, 6, 15, col('concrete', 4), col('concrete', 0))
    cv.outline_box(8, 13, 12, 15, col('concrete', 3), col('concrete', 0))

    # Main Fable slate-cream outdoor AC box (x=1..13, y=1..14)
    # Expanded sunlit 3/4 top lid (y=2..4: 3px plane) with clear crease line at y=4
    cv.outline_box(1, 1, 13, 5, col('white', 5), col('steel', 0), top_hi=col('white', 6))
    cv.hline(2, 12, 3, col('coolwhite', 5))
    cv.p(11, 2, col('coolwhite', 4))
    cv.p(11, 3, col('coolwhite', 3))
    for vx in (4, 6, 8):
        cv.p(vx, 3, col('concrete', 4))  # subtle top louver vents
    cv.hline(2, 12, 4, col('steel', 2))  # clear lid-to-front crease line

    # Front casing face (y=5..14) in cooler Fable slate-cream (matching kusuri/house-box-b)
    cv.outline_box(1, 4, 13, 14, col('white', 4), col('steel', 0), top_hi=col('white', 5), bot_sh=col('white', 2))
    cv.hline(2, 12, 4, col('steel', 2))  # keep crisp crease above front panel
    cv.vline(11, 5, 13, col('coolwhite', 3))  # subtle right-side bevel shade

    # Circular dark fan grille centered cleanly below top lip (cx=5, cy=8.5, y=6..11)
    for y in range(6, 12):
        for x in range(2, 9):
            d2 = (x - 5) ** 2 + (y - 8.5) ** 2
            if d2 <= 9.25:
                if d2 > 5.75:
                    cv.p(x, y, col('steel', 2))
                else:
                    cv.p(x, y, col('ink', 0))
    # Fan hub, subtle blades & clean horizontal guard bars
    cv.p(5, 8, col('steel', 4))
    cv.p(5, 9, col('steel', 3))
    cv.p(4, 8, col('steel', 2))
    cv.p(6, 9, col('steel', 2))
    for gy in (7, 10):
        cv.p(4, gy, col('steel', 4))
        cv.p(5, gy, col('steel', 4))
        cv.p(6, gy, col('steel', 4))

    # Right service panel & tiny manufacturer badge
    cv.vline(9, 5, 13, col('concrete', 3))
    cv.p(10, 6, col('blue', 4))
    cv.p(11, 6, col('red', 4))
    cv.hline(10, 12, 9, col('steel', 3))
    cv.hline(10, 12, 11, col('concrete', 3))

    # Tightened refrigerant valve & copper/insulated pipe silhouette hugging right side (x=12..14)
    cv.rect(12, 8, 14, 11, col('steel', 2))  # compact valve cover
    cv.p(13, 8, col('steel', 4))
    cv.p(13, 9, col('yellow', 5))  # tiny brass flare nut
    # Sleek insulated wall stub & tucked copper pipe loop (stays within x=13..14)
    cv.p(13, 6, col('steel', 1))
    cv.p(13, 7, col('concrete', 4))
    cv.p(14, 7, col('steel', 1))
    cv.p(14, 8, col('brick', 4))
    cv.p(14, 9, col('brick', 5))
    cv.p(14, 10, col('brick', 4))
    cv.p(14, 11, col('brick', 2))
    cv.p(13, 11, col('brick', 4))
    cv.p(13, 12, col('steel', 0))


def draw_gas_meter_pipes(cv):
    """16x32: Alley exterior wall utility cluster — muted ochre/cool-slate cylindrical risers, 3/4 meter, floor flanges."""
    # Subtle grounded cast shadow under twin floor pipe flanges (no clunky pedestal)
    cv.hline(2, 7, 31, col('ink', 1))
    cv.hline(3, 6, 31, col('ink', 0))
    cv.hline(8, 13, 31, col('ink', 1))
    cv.hline(9, 12, 31, col('ink', 0))

    # Compact upper wall conduit junction box (x=5..11, y=1..6) with clear sunlit 3/4 top
    cv.outline_box(5, 1, 11, 6, col('steel', 4), col('steel', 0))
    cv.hline(6, 10, 2, col('coolwhite', 5))  # sunlit top plane
    cv.hline(6, 10, 3, col('steel', 1))      # front top-edge crease
    cv.p(9, 4, col('steel', 2))              # right bevel
    cv.p(7, 4, col('orange', 4))             # tiny inspection sticker

    # 2 clean cylindrical riser pipes (left muted industrial ochre x=3..6, right cool-slate x=9..12)
    # Upper pipe runs (y=3..9) & lower pipe runs (y=21..29) with crisp left highlights
    for rx, rmp in [(3, 'straw'), (9, 'steel')]:
        for y0, y1 in [(3, 10), (21, 30)]:
            cv.vline(rx, y0, y1, col(rmp, 5))      # bright left cylindrical highlight
            cv.vline(rx + 1, y0, y1, col(rmp, 3))  # muted mid body
            cv.vline(rx + 2, y0, y1, col(rmp, 1))  # right cylindrical shadow
        # Horizontal wall elbow bends joining upper junction at y=3
        if rx == 3:
            cv.p(4, 3, col(rmp, 4))
            cv.p(5, 3, col(rmp, 2))
        else:
            cv.p(10, 3, col(rmp, 4))
        # Compact cool-slate wall clamp straps (y=6 and y=27)
        for cy in (6, 27):
            cv.hline(rx - 1, rx + 4, cy, col('steel', 1))
            cv.hline(rx, rx + 3, cy, col('steel', 4))
            cv.p(rx, cy, col('coolwhite', 5))

    # Slender circular floor pipe flanges anchoring both risers (y=29..30)
    for fx in (2, 8):
        cv.hline(fx, fx + 5, 29, col('steel', 1))
        cv.hline(fx + 1, fx + 4, 29, col('steel', 5))
        cv.p(fx + 1, 29, col('coolwhite', 5))
        cv.hline(fx, fx + 5, 30, col('steel', 0))
        cv.hline(fx + 1, fx + 4, 30, col('steel', 2))

    # Cast-metal gas meter with full 3px sunlit 3/4 top face (y=10..12) & right-side shadow bevel (x=12)
    cv.outline_box(2, 9, 14, 14, col('coolwhite', 5), col('steel', 0), top_hi=col('white', 6))
    cv.hline(3, 12, 10, col('white', 6))
    cv.hline(3, 12, 11, col('coolwhite', 5))
    cv.hline(3, 12, 12, col('coolwhite', 4))
    cv.vline(12, 10, 13, col('steel', 3))  # top-right shadow bevel

    # Twin top pipe collars seated cleanly on the 3/4 top face (y=8..10)
    for cx in (3, 9):
        cv.hline(cx, cx + 3, 8, col('steel', 0))
        cv.hline(cx, cx + 3, 9, col('orange', 4))
        cv.p(cx, 9, col('yellow', 5))  # brass union highlight
        cv.p(cx + 2, 9, col('orange', 2))
        cv.hline(cx, cx + 3, 10, col('steel', 2))  # collar flange resting on sunlit top face
        cv.p(cx, 10, col('steel', 5))

    # Front meter housing (y=13..21) with crisp right-side shadow bevel (x=12)
    cv.outline_box(2, 13, 14, 22, col('steel', 4), col('steel', 0), top_hi=col('coolwhite', 5), bot_sh=col('steel', 2))
    cv.hline(3, 12, 13, col('steel', 1))      # crisp front top-edge crease below 3px sunlit top
    cv.vline(3, 14, 21, col('coolwhite', 4))  # subtle left highlight
    cv.vline(12, 14, 21, col('steel', 2))     # right-side shadow bevel
    # Cast shadow underneath meter onto lower risers
    cv.hline(3, 13, 22, col('ink', 1))

    # Recessed glass meter dial window (x=4..11, y=15..19)
    cv.outline_box(4, 15, 11, 20, col('glass', 1), col('steel', 0))
    cv.hline(5, 10, 16, col('white', 6))  # counter register
    cv.p(6, 16, col('ink', 0))
    cv.p(7, 16, col('ink', 0))
    cv.p(9, 16, col('red', 4))  # decimal digit
    cv.hline(5, 10, 17, col('coolwhite', 3))
    cv.hline(5, 10, 18, col('glass', 2))
    # Tiny rivets along bottom corners
    cv.p(4, 20, col('steel', 5))
    cv.p(11, 20, col('steel', 2))

    # Compact red shutoff valve lever on left ochre gas riser (y=23..24)
    cv.rect(3, 23, 6, 25, col('steel', 2))
    cv.hline(1, 6, 23, col('red', 4))
    cv.p(1, 23, col('red', 5))
    cv.p(2, 23, col('red', 5))
    cv.p(5, 23, col('red', 2))
    cv.hline(1, 5, 24, col('red', 1))


def draw_propane_cylinders(cv):
    """16x32: Pair of tall grey/blue LPG steel cylinders chained to wall rack with brass valves."""
    _shadow_line(cv, 1, 15, 31, dark=True)
    # Concrete pad base
    cv.outline_box(1, 28, 15, 31, col('concrete', 4), col('concrete', 0), top_hi=col('concrete', 5), bot_sh=col('concrete', 2))

    # Steel wall rack posts & top manifold bar
    cv.vline(1, 3, 28, col('steel', 1))
    cv.vline(14, 3, 28, col('steel', 1))
    cv.hline(1, 15, 3, col('steel', 3))
    cv.hline(1, 15, 4, col('steel', 1))

    # Draw two tall cylindrical LPG tanks (left x=1..7, right x=8..14)
    for tx, ramp in [(1, 'tile'), (8, 'steel')]:
        # Flexible black pigtail hose curving to top manifold
        cv.p(tx + 3, 2, col('asphalt', 0))
        cv.p(tx + 4, 2, col('asphalt', 1))
        cv.p(tx + 4, 3, col('asphalt', 0))
        # Brass regulator valve & tiny pressure gauge (y=4..7)
        cv.vline(tx + 3, 4, 8, col('orange', 4))
        cv.p(tx + 3, 5, col('yellow', 5))
        cv.p(tx + 2, 5, col('yellow', 4))
        cv.p(tx + 4, 5, col('orange', 3))
        # Protective curved collar guard around valve (y=6..9)
        cv.hline(tx + 1, tx + 6, 6, col(ramp, 4))
        cv.p(tx + 1, 7, col(ramp, 5))
        cv.p(tx + 5, 7, col(ramp, 2))
        cv.hline(tx + 1, tx + 6, 8, col(ramp, 1))
        # Rounded dome shoulder (y=8..11)
        for y in range(9, 12):
            for x in range(tx, tx + 7):
                if y == 9 and x in (tx, tx + 6):
                    continue
                if x == tx or x == tx + 6:
                    cv.p(x, y, col(ramp, 0))
                elif x in (tx + 1, tx + 2):
                    cv.p(x, y, col(ramp, 6 if y == 10 else 5))
                elif x == tx + 3:
                    cv.p(x, y, col(ramp, 4))
                elif x == tx + 4:
                    cv.p(x, y, col(ramp, 3))
                else:
                    cv.p(x, y, col(ramp, 2))
        # Cylindrical body (y=12..27) with smooth cylindrical shading
        for y in range(12, 28):
            for x in range(tx, tx + 7):
                if x == tx or x == tx + 6:
                    cv.p(x, y, col(ramp, 0))
                elif x == tx + 1:
                    cv.p(x, y, col(ramp, 5))
                elif x == tx + 2:
                    cv.p(x, y, col(ramp, 6 if y < 22 else 5))
                elif x == tx + 3:
                    cv.p(x, y, col(ramp, 4))
                elif x == tx + 4:
                    cv.p(x, y, col(ramp, 3))
                else:
                    cv.p(x, y, col(ramp, 1))
        # Horizontal weld seam
        cv.hline(tx + 1, tx + 6, 13, col(ramp, 2))
        # Red LPG hazard band / stencil
        cv.hline(tx + 1, tx + 6, 15, col('red', 4))
        cv.p(tx + 2, 15, col('red', 5))
        cv.p(tx + 5, 15, col('red', 2))
        cv.p(tx + 2, 21, col('red', 3))
        cv.p(tx + 4, 21, col('red', 3))
        # Ring foot base (y=27..29)
        cv.hline(tx, tx + 7, 27, col(ramp, 1))
        cv.hline(tx + 1, tx + 6, 28, col(ramp, 3))
        cv.hline(tx + 1, tx + 6, 29, col('ink', 0))

    # Heavy retaining steel chain strapped across both tanks at y=18..19
    for x in range(1, 15):
        cv.p(x, 18, col('steel', 5 if x % 2 == 0 else 1))
        cv.p(x, 19, col('ink', 0 if x % 2 == 0 else 1))
    # Tiny central white pressure gauge on manifold
    cv.rect(6, 2, 10, 5, col('steel', 1))
    cv.rect(7, 3, 9, 4, col('white', 6))
    cv.p(8, 3, col('red', 4))


def draw_cardboard_stack(cv):
    """32x16: Cohesive stacked brown corrugated delivery boxes tucked against a cross-tied cardboard bundle."""
    _shadow_line(cv, 1, 31, 15, dark=True)

    # --- Left lower corrugated delivery box (x=1..18, y=7..15) tucked behind/into right bundle ---
    cv.outline_box(1, 7, 18, 15, col('cedar', 4), col('wood', 1), top_hi=col('cedar', 5), bot_sh=col('cedar', 2))
    # Subtle cardboard shading & visible top shoulder peeking left/right of upper box
    cv.vline(2, 8, 14, col('cedar', 5))
    cv.vline(15, 8, 14, col('cedar', 2))  # tucked shadow next to right bundle
    cv.hline(2, 16, 11, col('floorwood', 3))
    # Packing tape tab folding over front center of lower box
    cv.vline(7, 8, 11, col('straw', 5))
    cv.vline(8, 8, 11, col('cream', 6))
    # Crisp white shipping label with barcode & red fragile dot
    cv.rect(10, 10, 15, 13, col('white', 6))
    cv.hline(10, 15, 13, col('cedar', 2))
    cv.p(11, 11, col('ink', 1))
    cv.p(13, 11, col('ink', 1))
    cv.p(11, 12, col('red', 4))

    # --- Left upper delivery box (x=2..17, y=0..8) with crisp 3/4 sunlit top flaps & packing tape ---
    cv.hline(2, 17, 8, col('wood', 0))  # cast shadow onto lower box
    # Sunlit 3/4 top lid plane (y=0..4: 3px sunlit interior flaps + crisp front crease at y=4)
    cv.outline_box(2, 0, 17, 5, col('cedar', 5), col('wood', 1), top_hi=col('cedar', 6))
    # Back sunlit flap (y=1) & front sunlit flap (y=3)
    cv.hline(3, 16, 1, col('cedar', 6))
    cv.hline(3, 16, 3, col('cedar', 5))
    cv.p(15, 1, col('cedar', 5))
    cv.p(15, 3, col('cedar', 4))
    # Center flap seam (y=2) sealed with glossy packing tape + center fold tab
    cv.p(3, 2, col('wood', 2))
    cv.p(15, 2, col('wood', 2))
    cv.hline(4, 15, 2, col('cream', 5))
    cv.hline(5, 13, 2, col('cream', 6))
    # Crisp front top-edge crease (y=4) & front face (y=5..8)
    cv.outline_box(2, 4, 17, 8, col('cedar', 4), col('wood', 1), top_hi=col('cedar', 5), bot_sh=col('cedar', 2))
    cv.hline(3, 16, 4, col('wood', 2))  # clear lid-to-front crease
    # Tape flap folding down onto upper box front center
    cv.p(8, 3, col('cream', 5))
    cv.p(9, 3, col('straw', 5))
    cv.p(8, 4, col('straw', 5))
    cv.p(8, 5, col('cream', 6))
    cv.p(9, 5, col('straw', 5))
    cv.p(8, 6, col('cream', 5))
    # Tiny red fragile icon on upper box left
    cv.p(4, 6, col('red', 4))
    cv.p(5, 6, col('red', 3))

    # --- Right bundled flattened corrugated sheets tucked tightly against left stack (x=16..30, y=4..15) ---
    # 3-4px sunlit 3/4 top cardboard plane (y=5..8 inside outline y=4..9)
    cv.outline_box(16, 4, 30, 10, col('cedar', 5), col('wood', 1), top_hi=col('cedar', 6))
    cv.hline(17, 29, 5, col('cedar', 6))  # bright sunlit back top edge
    cv.hline(17, 29, 6, col('cedar', 5))
    cv.hline(17, 29, 7, col('cedar', 5))
    cv.hline(17, 29, 8, col('cedar', 6))  # front top sunlit lip
    cv.vline(28, 5, 9, col('cedar', 4))   # subtle right bevel shade
    cv.hline(17, 29, 9, col('wood', 1))   # crisp front crease between top plane & layered flutes

    # Layered corrugated sheet edges visible on front (y=10..14)
    for y in range(10, 15):
        c_row = col('cedar', 4 if y % 2 == 0 else 3)
        if y == 13:
            c_row = col('cedar', 2)
        cv.hline(16, 30, y, c_row)
        cv.p(16, y, col('wood', 1))
        cv.p(29, y, col('wood', 1))
        if y in (10, 12):
            for fx in range(18, 28, 3):
                cv.p(fx, y, col('wood', 2))
    cv.hline(16, 30, 14, col('wood', 0))

    # Cross-tied twine meeting at a crisp knot ON the sunlit top face (y=5..8)
    # Horizontal twine strand across top face (y=7) with subtle shadow under it
    cv.hline(17, 29, 7, col('cream', 5))
    cv.hline(17, 29, 8, col('cedar', 4))  # subtle shadow cast by twine on front top strip
    cv.p(16, 7, col('straw', 4))
    cv.p(29, 7, col('straw', 3))
    # Vertical twine strand across top face (x=23, y=4..9) & down front flutes (y=9..15)
    cv.vline(23, 5, 9, col('white', 6))
    cv.vline(24, 5, 9, col('cedar', 3))   # subtle cast shadow next to twine on top face
    cv.p(23, 4, col('cream', 5))
    cv.vline(23, 9, 15, col('cream', 5))
    cv.p(23, 10, col('white', 6))
    cv.p(23, 12, col('white', 5))
    cv.vline(24, 10, 14, col('wood', 1))  # shadow beside vertical front twine
    # Crisp bow knot resting squarely ON the top plane at intersection (x=23, y=7)
    cv.p(23, 7, col('white', 6))          # knot center
    cv.p(22, 6, col('white', 6))          # left bow loop on top face
    cv.p(24, 6, col('cream', 5))          # right bow loop on top face
    cv.p(22, 8, col('cedar', 3))          # knot drop shadow
    cv.p(24, 8, col('cream', 5))          # twine tail on top face


def draw_wood_pallet_sacks(cv):
    """32x16: Wooden shipping pallet stacked with plump cream/burlap rice & flour sacks tied at neck."""
    _shadow_line(cv, 1, 31, 15, dark=True)

    # --- Wooden shipping pallet base (x=1..30, y=10..15) ---
    # Top deck planks
    cv.outline_box(1, 10, 30, 12, col('cedar', 4), col('wood', 0), top_hi=col('cedar', 5))
    for px in (6, 12, 18, 24):
        cv.p(px, 11, col('wood', 1))
    # Lower pallet runners & dark fork gaps (y=12..15)
    cv.rect(1, 12, 30, 15, col('ink', 0))
    for bx in (1, 13, 26):
        cv.outline_box(bx, 11, bx + 4, 15, col('wood', 4), col('wood', 0), top_hi=col('wood', 5), bot_sh=col('wood', 2))
    cv.hline(1, 30, 14, col('wood', 1))

    # Helper for plump tied rice/flour sack
    def draw_sack(x0, y0, x1, y1, ramp, stamp_col):
        mx = (x0 + x1) // 2
        for y in range(y0 + 1, y1):
            for x in range(x0, x1):
                if (y == y0 + 1 or y == y1 - 1) and (x == x0 or x == x1 - 1):
                    continue
                if x == x0 or x == x1 - 1 or y == y1 - 1:
                    cv.p(x, y, col(ramp, 0))
                elif y == y0 + 1:
                    cv.p(x, y, col(ramp, 1))
                elif y <= y0 + 3 and x <= mx:
                    cv.p(x, y, col(ramp, 5))
                elif y >= y1 - 2 or x >= x1 - 2:
                    cv.p(x, y, col(ramp, 2))
                else:
                    cv.p(x, y, col(ramp, 4 if (x + y) % 3 != 0 else 3))
        # Tied neck & ruffled ears at top
        cv.hline(mx - 1, mx + 2, y0 + 1, col('brick', 3))  # twine tie
        cv.p(mx - 1, y0, col(ramp, 5))
        cv.p(mx, y0, col(ramp, 4))
        cv.p(mx + 1, y0, col(ramp, 3))
        # Rice/flour stencil stamp on front belly
        cv.p(mx, (y0 + y1) // 2 + 1, stamp_col)
        cv.p(mx - 1, (y0 + y1) // 2 + 1, stamp_col)

    # Back row sacks (slightly higher, darker tint)
    draw_sack(3, 1, 13, 10, 'straw', col('green', 3))
    draw_sack(11, 0, 21, 10, 'cream', col('red', 3))
    draw_sack(19, 1, 29, 10, 'kinari', col('blue', 3))
    # Front row overlapping plump sacks
    draw_sack(2, 4, 12, 11, 'cream', col('red', 4))
    draw_sack(10, 3, 21, 11, 'kinari', col('green', 3))
    draw_sack(19, 4, 29, 11, 'straw', col('red', 3))


def draw_mop_bucket_broom(cv):
    """16x16: Yellow rolling wringer bucket with blue water, leaning wooden broom and string mop."""
    _shadow_line(cv, 0, 15, 15, dark=True)

    # Leaning wooden broom handle & straw bristles on right (x=10..15, y=0..14)
    for step, (hx, hy) in enumerate([(10, 0), (10, 1), (11, 2), (11, 3), (11, 4), (12, 5), (12, 6), (12, 7), (12, 8)]):
        cv.p(hx, hy, col('cedar', 5 if step % 2 == 0 else 4))
        cv.p(hx + 1, hy, col('wood', 1))
    # Flared straw broom head resting at (10..15, 9..14)
    cv.hline(11, 14, 9, col('red', 4))
    for y in range(10, 15):
        spread = (y - 9) // 2
        for x in range(11 - spread, min(16, 14 + spread)):
            if y == 14:
                cv.p(x, y, col('straw', 1 if x % 2 == 0 else 3))
            elif x == 11 - spread or x == min(15, 13 + spread):
                cv.p(x, y, col('straw', 0))
            else:
                cv.p(x, y, col('straw', 5 if (x + y) % 2 == 0 else 3))

    # Mop handle rising diagonally from left-back of bucket (from x=4,y=6 up to x=1,y=0)
    for mx, my in [(2, 0), (2, 1), (3, 2), (3, 3), (4, 4), (4, 5)]:
        cv.p(mx, my, col('wood', 5))
        cv.p(mx - 1, my, col('wood', 1))

    # --- Yellow rolling wringer bucket (x=0..10, y=5..14) ---
    # 3/4 Open top rim showing unmistakable shimmering BLUE SOAPY WATER (y=5..9)
    cv.outline_box(0, 5, 10, 9, col('blue', 4), col('yellow', 0), top_hi=col('yellow', 5))
    cv.rect(2, 6, 9, 9, col('glass', 4))
    cv.hline(3, 8, 6, col('glass', 5))
    cv.p(5, 6, col('white', 6))  # bright soap bubble highlight
    cv.p(7, 7, col('glass', 6))
    cv.p(6, 8, col('blue', 3))
    # Compact steel wringer press cage clipped on back-left (x=0..4, y=3..7)
    cv.outline_box(0, 3, 4, 7, col('steel', 3), col('steel', 0), top_hi=col('steel', 5))
    cv.p(1, 2, col('red', 4))  # wringer handle grip
    # Shaggy white string mop head draped inside wringer mouth
    cv.p(3, 5, col('white', 6))
    cv.p(4, 6, col('coolwhite', 5))
    cv.p(3, 6, col('white', 5))
    # Bright yellow bucket front body (y=8..14)
    cv.outline_box(0, 8, 10, 14, col('yellow', 4), col('yellow', 0), top_hi=col('yellow', 5), bot_sh=col('orange', 2))
    cv.vline(1, 9, 13, col('yellow', 5))
    cv.vline(8, 9, 13, col('yellow', 2))
    # Crisp caution triangle emblem on front
    cv.p(5, 10, col('ink', 0))
    cv.p(4, 11, col('ink', 0))
    cv.p(6, 11, col('ink', 0))
    # Rolling caster wheels at bottom
    cv.rect(1, 14, 3, 15, col('asphalt', 0))
    cv.rect(7, 14, 9, 15, col('asphalt', 0))


# ---------------------------------------------------------------------------
# CATEGORY 2: shopfront-life (10)
# ---------------------------------------------------------------------------

def draw_fruit_veg_stand(cv):
    """32x32: Slanted wooden greengrocer display stand with apples, tangerines, cabbages & price cards."""
    _shadow_line(cv, 2, 30, 31, dark=True)

    # Back wooden display header rail (y=3..7) with tiny white/yellow price cards
    cv.outline_box(2, 5, 30, 8, col('wood', 4), col('wood', 0), top_hi=col('cedar', 5))
    for cx, accent in [(5, 'red:4'), (14, 'orange:4'), (23, 'green:3')]:
        cv.outline_box(cx, 2, cx + 5, 7, col('white', 6), col('wood', 1))
        cv.hline(cx + 1, cx + 4, 3, accent)
        cv.p(cx + 2, 5, col('ink', 1))
        cv.p(cx + 3, 5, col('ink', 1))

    # Main slanted wooden stand frame (x=2..30, y=7..23)
    cv.outline_box(2, 7, 30, 23, col('cedar', 4), col('wood', 0), top_hi=col('cedar', 5), bot_sh=col('wood', 2))
    # Wooden bin dividers (3 columns x 2 tiers)
    cv.hline(3, 29, 15, col('wood', 5))
    cv.hline(3, 29, 16, col('wood', 1))
    for vx in (11, 20):
        cv.vline(vx, 8, 22, col('wood', 1))
        cv.vline(vx + 1, 8, 22, col('cedar', 5))

    # Helper to fill produce bin with rounded shaded fruits/veg
    def fill_produce(x0, y0, x1, y1, ramp, hi_dot=None, leaf=False, seed=0):
        cv.rect(x0, y0, x1, y1, col(ramp, 0))
        for ry in range(y0, y1 - 1, 3):
            for rx in range(x0 + ((ry // 3) % 2), x1 - 1, 3):
                cv.rect(rx, ry, min(x1, rx + 3), min(y1, ry + 3), col(ramp, 3))
                cv.p(rx, ry, col(ramp, 5))
                if hi_dot and hsh(rx, ry, seed) > 0.35:
                    cv.p(rx, ry, hi_dot)
                cv.p(min(x1 - 1, rx + 2), min(y1 - 1, ry + 2), col(ramp, 1))
                if leaf and rx + 1 < x1:
                    cv.p(rx + 1, ry, col('foliage', 5))

    # Upper tier (y=8..15): Red apples, Orange tangerines, Yellow lemons/pears
    fill_produce(3, 8, 11, 15, 'red', hi_dot=col('white', 6), leaf=True, seed=11)
    fill_produce(12, 8, 20, 15, 'orange', hi_dot=col('yellow', 5), leaf=False, seed=23)
    fill_produce(21, 8, 29, 15, 'yellow', hi_dot=col('white', 6), leaf=True, seed=37)

    # Lower tier (y=16..22): Green cabbages, Pink/red radishes & tomatoes, Green cucumbers/daikon
    fill_produce(3, 16, 11, 22, 'foliage', hi_dot=col('foliage', 6), leaf=False, seed=41)
    # Cabbage swirl highlights
    for cx, cy in [(5, 18), (9, 19), (6, 20)]:
        cv.p(cx, cy, col('green', 5))
    fill_produce(12, 16, 20, 22, 'pink', hi_dot=col('white', 6), leaf=True, seed=53)
    fill_produce(21, 16, 29, 22, 'green', hi_dot=col('foliage', 6), leaf=False, seed=67)
    # Daikon white tips peeking in right bin
    cv.hline(23, 27, 17, col('white', 5))
    cv.hline(22, 26, 20, col('cream', 5))

    # Front lip with small yellow price tags
    cv.hline(2, 30, 22, col('cedar', 5))
    cv.hline(2, 30, 23, col('wood', 1))
    for tx in (6, 15, 24):
        cv.rect(tx, 21, tx + 3, 24, col('yellow', 5))
        cv.p(tx + 1, 22, col('red', 3))

    # Lower stand legs & under-shelf storage wooden produce crates (y=24..30)
    cv.rect(4, 24, 28, 30, col('ink', 1))
    # Sturdy front corner legs
    cv.outline_box(2, 23, 5, 31, col('wood', 4), col('wood', 0), top_hi=col('cedar', 5))
    cv.outline_box(27, 23, 30, 31, col('wood', 3), col('wood', 0), top_hi=col('cedar', 4))
    # Two wooden backup crates tucked underneath
    cv.outline_box(6, 25, 16, 30, col('cedar', 3), col('wood', 0), top_hi=col('cedar', 4))
    cv.hline(7, 15, 27, col('wood', 1))
    cv.p(9, 25, col('orange', 4))
    cv.p(12, 25, col('red', 4))
    cv.outline_box(17, 25, 26, 30, col('cedar', 3), col('wood', 0), top_hi=col('cedar', 4))
    cv.hline(18, 25, 27, col('wood', 1))
    cv.p(20, 25, col('foliage', 5))
    cv.p(23, 25, col('yellow', 5))


def draw_bakery_bread_rack(cv):
    """32x32: Tiered wood-and-glass bakery rack with baguettes, croissants, loaves & mini canopy."""
    _shadow_line(cv, 2, 30, 31, dark=True)

    # Mini striped terracotta-red & cream cloth canopy (x=2..30, y=1..8)
    cv.awning(2, 1, 30, 8, ramp_a='brick', ramp_b='cream', stripe_w=4)
    cv.hline(2, 30, 1, col('brick', 0))

    # Wooden display rack uprights & back board (x=3..29, y=8..29)
    cv.outline_box(3, 8, 29, 24, col('darkwood', 2), col('wood', 0))
    cv.vline(3, 8, 30, col('wood', 0))
    cv.vline(4, 8, 30, col('cedar', 5))
    cv.vline(27, 8, 30, col('cedar', 4))
    cv.vline(28, 8, 30, col('wood', 0))

    # Upper shelf (y=9..16): golden baguettes (left) & curved croissants (right)
    cv.hline(5, 27, 15, col('cedar', 5))
    cv.hline(5, 27, 16, col('wood', 1))
    # Woven tray liners
    cv.hline(5, 27, 14, col('straw', 4))
    # Baguettes (slanted golden loaves with pale flour score slashes)
    for bx in (6, 10, 14):
        cv.rect(bx, 10, bx + 3, 14, col('rooftile', 5))
        cv.vline(bx, 10, 14, col('orange', 4))
        cv.p(bx + 1, 10, col('yellow', 5))
        cv.p(bx + 1, 12, col('cream', 6))
        cv.p(bx + 2, 11, col('rooftile', 3))
        cv.p(bx + 2, 13, col('wood', 2))
    # Golden croissants on right half
    for cx in (18, 22):
        cv.rect(cx, 11, cx + 4, 14, col('orange', 4))
        cv.p(cx, 11, col('darkwood', 2))
        cv.p(cx + 3, 11, col('darkwood', 2))
        cv.hline(cx + 1, cx + 3, 11, col('yellow', 5))
        cv.p(cx + 2, 12, col('rooftile', 6))
        cv.hline(cx, cx + 4, 13, col('orange', 2))

    # Middle shelf (y=17..23): plump round sourdough loaves & brioche buns in baskets
    cv.hline(5, 27, 22, col('cedar', 5))
    cv.hline(5, 27, 23, col('wood', 1))
    for lx in (6, 13, 20):
        # Woven basket rim
        cv.outline_box(lx, 20, lx + 6, 23, col('straw', 4), col('wood', 1), top_hi=col('straw', 5))
        # Plump round bread loaf dome
        cv.rect(lx + 1, 17, lx + 5, 20, col('floorwood', 4))
        cv.hline(lx + 1, lx + 5, 17, col('rooftile', 5))
        cv.p(lx + 2, 17, col('cream', 6))  # flour dusted score
        cv.p(lx + 3, 18, col('yellow', 5))
        cv.vline(lx + 5, 18, 20, col('floorwood', 2))

    # Subtle glass sneeze-guard specular reflection lines
    for gx, gy in [(6, 9), (7, 10), (24, 9), (25, 10), (23, 17), (24, 18)]:
        cv.p(gx, gy, col('glass', 6))

    # Lower paneled wood base & chalkboard menu plaque (y=23..30)
    cv.outline_box(3, 23, 29, 30, col('wood', 4), col('wood', 0), top_hi=col('cedar', 5), bot_sh=col('wood', 2))
    # Wainscot panels
    cv.outline_box(5, 25, 14, 29, col('cedar', 3), col('wood', 1), top_hi=col('cedar', 4))
    # Mini chalkboard on right side of base
    cv.outline_box(16, 24, 26, 29, col('asphalt', 0), col('cedar', 4))
    cv.hline(18, 24, 25, col('cream', 5))
    cv.hline(18, 22, 27, col('yellow', 5))
    # Sturdy grounded feet
    cv.rect(4, 29, 7, 31, col('wood', 0))
    cv.rect(25, 29, 28, 31, col('wood', 0))


def draw_flower_bucket_stand(cv):
    """32x32: Stepped wooden florist stand holding galvanized buckets bursting with flowers & ferns."""
    _shadow_line(cv, 2, 30, 31, dark=True)

    # Back wooden frame posts & top step shelf (y=12..30)
    cv.vline(2, 10, 30, col('wood', 0))
    cv.vline(3, 10, 30, col('cedar', 5))
    cv.vline(28, 10, 30, col('cedar', 4))
    cv.vline(29, 10, 30, col('wood', 0))
    cv.outline_box(2, 13, 30, 17, col('cedar', 4), col('wood', 0), top_hi=col('cedar', 5), bot_sh=col('wood', 2))
    # Lower front wooden step (y=24..28)
    cv.outline_box(2, 25, 30, 29, col('wood', 4), col('wood', 0), top_hi=col('cedar', 5), bot_sh=col('wood', 2))
    cv.rect(4, 29, 7, 31, col('wood', 0))
    cv.rect(25, 29, 28, 31, col('wood', 0))
    cv.rect(7, 29, 25, 30, col('ink', 1))

    def draw_bucket(bx, by, w, h, ramp='steel', terracotta=False):
        r = 'brick' if terracotta else ramp
        cv.outline_box(bx, by, bx + w, by + h, col(r, 4), col(r, 0), top_hi=col(r, 6 if not terracotta else 5), bot_sh=col(r, 2))
        cv.vline(bx + 1, by + 1, by + h - 1, col(r, 5))
        cv.vline(bx + w - 2, by + 1, by + h - 1, col(r, 2))
        cv.hline(bx + 1, bx + w - 1, by + 2, col(r, 2))  # rim rib

    def draw_bouquet(cx, cy, rx, ry, blossoms, seed):
        # Lush leafy base
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                dx = (x - cx) / max(rx, 1)
                dy = (y - cy) / max(ry, 1)
                if dx * dx + dy * dy + hsh(x, y, seed) * 0.25 > 1.05:
                    continue
                if dy > 0.5:
                    cv.p(x, y, col('foliage', 1))
                elif dx + dy < -0.2:
                    cv.p(x, y, col('foliage', 5))
                else:
                    cv.p(x, y, col('foliage', 3 if (x + y) % 2 == 0 else 2))
        # Bright flower heads
        for fx, fy, fc, center in blossoms:
            cv.p(fx, fy, fc)
            cv.p(fx + 1, fy, fc)
            cv.p(fx, fy + 1, fc)
            if center:
                cv.p(fx, fy, center)

    # Upper tier bouquets + galvanized buckets (y=2..14)
    # 1. Sunflowers (left)
    draw_bouquet(7, 5, 4, 4, [
        (5, 3, col('yellow', 5), col('wood', 1)),
        (8, 2, col('yellow', 5), col('orange', 2)),
        (7, 5, col('yellow', 4), col('wood', 1)),
        (4, 6, col('yellow', 4), None),
    ], seed=101)
    draw_bucket(4, 8, 7, 7)

    # 2. Pink tulips & white lilies (center)
    draw_bouquet(16, 4, 4, 4, [
        (14, 2, col('pink', 5), col('white', 6)),
        (17, 2, col('pink', 4), None),
        (15, 5, col('white', 6), col('yellow', 5)),
        (18, 4, col('pink', 5), None),
    ], seed=202)
    draw_bucket(13, 8, 7, 7)

    # 3. Red roses (right)
    draw_bouquet(24, 5, 4, 4, [
        (22, 3, col('red', 4), col('red', 5)),
        (25, 2, col('red', 5), col('maple', 3)),
        (23, 5, col('red', 4), None),
        (26, 5, col('red', 3), None),
    ], seed=303)
    draw_bucket(21, 8, 7, 7)

    # Lower tier bouquets + buckets/pot (y=15..27)
    # 4. Leafy ferns + blue hydrangeas (left)
    draw_bouquet(7, 17, 4, 3, [
        (5, 16, col('blue', 5), col('coolwhite', 5)),
        (8, 15, col('blue', 4), col('blue', 5)),
        (6, 18, col('foliage', 6), None),
    ], seed=404)
    draw_bucket(4, 20, 7, 7)

    # 5. Orange marigolds in terracotta pot (center)
    draw_bouquet(16, 17, 4, 3, [
        (14, 15, col('orange', 5), col('yellow', 5)),
        (17, 16, col('orange', 4), col('yellow', 5)),
        (15, 18, col('yellow', 5), None),
    ], seed=505)
    draw_bucket(13, 20, 7, 7, terracotta=True)

    # 6. Crimson & pink cosmos + ferns (right)
    draw_bouquet(24, 17, 4, 3, [
        (22, 16, col('pink', 5), col('yellow', 5)),
        (25, 15, col('red', 5), None),
        (26, 18, col('green', 5), None),
    ], seed=606)
    draw_bucket(21, 20, 7, 7)


def draw_book_stall(cv):
    """32x32: Secondhand bookstore outdoor wooden trough table with colorful books & '100' tag."""
    _shadow_line(cv, 2, 30, 31, dark=True)

    # Lower wooden frame & shelf stacked with tied bundles of old paperbacks (y=21..30)
    cv.rect(4, 21, 28, 30, col('ink', 1))
    cv.outline_box(2, 21, 5, 31, col('wood', 4), col('wood', 0), top_hi=col('cedar', 5))
    cv.outline_box(27, 21, 30, 31, col('wood', 3), col('wood', 0), top_hi=col('cedar', 4))
    cv.outline_box(4, 27, 28, 30, col('wood', 3), col('wood', 0), top_hi=col('cedar', 4))
    # Two tied book stacks on lower shelf
    for sx, cols_b in [(6, ['cream:5', 'blue:4', 'red:4', 'cream:4']), (16, ['yellow:4', 'green:4', 'cream:5', 'orange:4'])]:
        for i, bc in enumerate(cols_b):
            cv.hline(sx, sx + 9, 23 + i, bc)
            cv.p(sx, 23 + i, col('wood', 0))
            cv.p(sx + 8, 23 + i, col('wood', 0))
        cv.vline(sx + 4, 23, 28, col('white', 6))  # twine tie

    # Upper tilted wooden book trough (x=2..30, y=9..22)
    cv.outline_box(2, 9, 30, 22, col('cedar', 4), col('wood', 0), top_hi=col('cedar', 5), bot_sh=col('wood', 2))
    # Back lip of trough
    cv.hline(3, 29, 10, col('wood', 2))

    # Row 1 (back row of upright book spines, y=10..15)
    spine_pal1 = [
        ('red', 4), ('cream', 5), ('blue', 4), ('green', 4), ('yellow', 4),
        ('navy', 3), ('orange', 4), ('pink', 4), ('teal', 4), ('brick', 4),
        ('cream', 5), ('blue', 3), ('red', 3),
    ]
    x = 3
    for i, (rmp, idx) in enumerate(spine_pal1):
        bw = 2
        if x + bw > 29:
            break
        bh = 5 if i % 3 != 0 else 6
        by = 15 - bh
        cv.rect(x, by, x + bw, 15, col(rmp, idx))
        cv.p(x, by, col('cream', 6))  # top page edge in 3/4 view!
        cv.p(x + 1, by, col(rmp, max(1, idx - 2)))
        cv.p(x, by + 2, col('white', 6) if i % 2 == 0 else col('yellow', 5))  # tiny spine title band
        x += bw

    # Row 2 (front row of upright books, y=15..20)
    cv.hline(3, 29, 15, col('wood', 1))
    spine_pal2 = [
        ('blue', 4), ('yellow', 5), ('red', 4), ('cream', 5), ('teal', 4),
        ('orange', 4), ('navy', 4), ('pink', 4), ('green', 4), ('red', 3),
        ('cream', 5), ('blue', 4), ('yellow', 4),
    ]
    x = 3
    for i, (rmp, idx) in enumerate(spine_pal2):
        bw = 2
        if x + bw > 29:
            break
        cv.rect(x, 16, x + bw, 20, col(rmp, idx))
        cv.p(x, 16, col('white', 6))  # pale page edge
        cv.p(x + 1, 16, col(rmp, max(1, idx - 2)))
        cv.p(x, 18, col(rmp, min(5, idx + 1)))
        x += bw

    # Leaning hardcover stack on top-left corner (x=3..11, y=4..10)
    stack_books = [('red', 4), ('green', 4), ('navy', 4)]
    for i, (rmp, idx) in enumerate(stack_books):
        by = 8 - i * 2
        ox = 3 + (i % 2)
        cv.outline_box(ox, by, ox + 8, by + 3, col(rmp, idx), col(rmp, 0), top_hi=col(rmp, min(5, idx + 1)))
        cv.hline(ox + 1, ox + 7, by + 1, col('cream', 6))  # pale page block edge
        cv.vline(ox + 1, by, by + 3, col(rmp, idx))  # colored book spine on left

    # Prominent '100' discount tag on wire post at top-right (x=17..30, y=1..10)
    cv.vline(23, 8, 11, col('steel', 3))
    cv.outline_box(17, 1, 30, 9, col('yellow', 5), col('red', 2), top_hi=col('white', 6))
    # Crisp pixel '100' inside (y=3..7)
    ink = col('red', 1)
    # '1' at x=19
    cv.vline(19, 3, 7, ink)
    cv.p(18, 4, ink)
    # '0' at x=21..24
    cv.outline_box(21, 3, 24, 7, col('yellow', 5), ink)
    # '0' at x=25..28
    cv.outline_box(25, 3, 28, 7, col('yellow', 5), ink)


def draw_clothing_rack(cv):
    """32x32: Rolling chrome boutique garment rack hung with red, cream, navy, and teal garments."""
    _shadow_line(cv, 3, 29, 31, dark=True)

    # Chrome tubular side frames & lower crossbar (x=3..29, y=4..29)
    # Top horizontal rail
    cv.hline(2, 30, 4, col('steel', 1))
    cv.hline(2, 30, 5, col('coolwhite', 5))
    cv.p(2, 5, col('steel', 0))
    cv.p(29, 5, col('steel', 0))
    # Vertical side uprights
    for ux in (3, 27):
        cv.vline(ux, 5, 29, col('steel', 1))
        cv.vline(ux + 1, 5, 29, col('coolwhite', 5))
    # Bottom crossbar & rolling caster wheels
    cv.hline(4, 28, 27, col('steel', 2))
    cv.hline(4, 28, 28, col('coolwhite', 4))
    for wx in (3, 26):
        cv.rect(wx, 28, wx + 3, 31, col('asphalt', 0))
        cv.p(wx + 1, 29, col('steel', 5))

    # Mini boutique SALE tag clipped to top-left rail (y=1..5)
    cv.outline_box(4, 1, 11, 5, col('cream', 5), col('red', 2), top_hi=col('white', 6))
    cv.hline(6, 9, 3, col('red', 4))

    # 4 hung garments on wooden hangers with distinct sloped shoulders, sleeves, and staggered hems
    garments = [
        (5, 11, 8, 20, 'red', 'cream:6', 'jacket'),
        (10, 16, 8, 19, 'cream', 'pink:4', 'shirt'),
        (15, 21, 8, 21, 'navy', 'blue:5', 'blazer'),
        (20, 26, 8, 26, 'teal', 'yellow:5', 'dress'),
    ]
    for x0, x1, y0, y1, rmp, trim, style in garments:
        mx = (x0 + x1) // 2
        # Hanger hook & sloped wooden hanger bar
        cv.p(mx, 5, col('steel', 5))
        cv.p(mx, 6, col('wood', 4))
        cv.hline(x0 + 1, x1 - 1, 7, col('cedar', 5))
        # Garment body with rounded sloped shoulders & tailored silhouette
        for y in range(y0, y1):
            # Flared A-line skirt for the teal dress!
            xl = x0 - (1 if (style == 'dress' and y >= y0 + 11) else 0)
            xr = x1 + (1 if (style == 'dress' and y >= y0 + 11) else 0)
            for x in range(xl, xr):
                if y == y0 and (x == xl or x == xr - 1):
                    continue
                if x == xl or x == xr - 1 or y == y1 - 1:
                    cv.p(x, y, col(rmp, 0))
                elif y == y0:
                    cv.p(x, y, col(rmp, 5))  # top shoulder highlight
                elif x == xl + 1:
                    cv.p(x, y, col(rmp, 4))
                elif x == xr - 2:
                    cv.p(x, y, col(rmp, 2))
                elif (x - xl) == 2 and y > y0 + 2:
                    cv.p(x, y, col(rmp, 2 if y % 3 != 0 else 4))
                else:
                    cv.p(x, y, col(rmp, 3 if y < y1 - 3 else 2))
        # Neck V-collar / lapel / belt micro-detail
        cv.p(mx, y0, col('ink', 1))
        cv.p(mx, y0 + 1, trim)
        if style == 'jacket':
            cv.vline(mx, y0 + 2, y1 - 2, col(rmp, 1))
            cv.p(mx + 1, y0 + 4, trim)
            cv.p(mx + 1, y0 + 7, trim)
        elif style == 'shirt':
            cv.vline(mx, y0 + 1, y1 - 2, col('kinari', 2))
            cv.p(mx - 1, y0 + 1, trim)
            cv.p(mx + 1, y0 + 1, trim)
        elif style == 'blazer':
            cv.p(mx - 1, y0 + 2, trim)
            cv.p(mx + 1, y0 + 2, trim)
            cv.hline(x0 + 1, x0 + 3, y1 - 4, col('navy', 1))
        elif style == 'dress':
            cv.hline(x0 + 1, x1 - 1, y0 + 7, trim)
            cv.hline(x0 + 1, x1 - 1, y0 + 8, col('teal', 1))
    # Small boutique shoebox resting on lower bottom shelf rail (left side)
    cv.outline_box(6, 23, 14, 27, col('kinari', 4), col('wood', 1), top_hi=col('white', 6), bot_sh=col('kinari', 2))
    cv.hline(7, 13, 25, col('pink', 4))


def draw_noren_lantern_stand(cv):
    """32x32: Free-standing izakaya wooden frame with split indigo noren & warm glowing lantern (lightAnchor)."""
    _shadow_line(cv, 2, 30, 31, dark=True)

    # Mini tiled wooden eaves cap at top (x=2..30, y=1..7)
    cv.hline(3, 29, 1, col('kawara', 0))
    cv.hline(3, 29, 2, col('kawara', 6))
    for y in range(3, 6):
        for x in range(2, 30):
            if x == 2 or x == 29:
                cv.p(x, y, col('kawara', 0))
            elif (x + y) % 3 == 0:
                cv.p(x, y, col('kawara', 4 if y == 3 else 3))
            else:
                cv.p(x, y, col('kawara', 2 if y == 5 else 3))
    cv.hline(2, 30, 6, col('wood', 0))

    # Sturdy timber side posts (x=3..6, x=26..29, y=6..30) & stone anchor blocks
    for px in (3, 26):
        cv.outline_box(px, 6, px + 3, 28, col('wood', 4), col('wood', 0), top_hi=col('cedar', 5))
        cv.vline(px + 1, 7, 27, col('cedar', 4))
        cv.outline_box(px - 1, 27, px + 4, 31, col('stone', 4), col('stone', 0), top_hi=col('stone', 6), bot_sh=col('stone', 2))

    # Top horizontal crossbeam & bamboo curtain rod (y=6..8)
    cv.hline(6, 26, 6, col('wood', 3))
    cv.hline(6, 26, 7, col('cedar', 5))
    cv.hline(6, 26, 8, col('wood', 0))

    # 3-panel split indigo/navy noren fabric curtain (x=6..26, y=8..19)
    panels = [(6, 12), (13, 19), (20, 26)]
    for idx, (x0, x1) in enumerate(panels):
        # Bamboo loops at top
        cv.p(x0 + 1, 7, col('navy', 2))
        cv.p(x1 - 2, 7, col('navy', 2))
        for y in range(8, 19):
            for x in range(x0, x1):
                if y == 18:
                    cv.p(x, y, col('navy', 0 if (x % 2 == 0) else 1))
                elif x == x0 or x == x1 - 1:
                    cv.p(x, y, col('navy', 1))
                elif y == 8:
                    cv.p(x, y, col('navy', 0))
                elif y <= 11:
                    cv.p(x, y, col('navy', 3 if x % 2 == 0 else 2))
                else:
                    cv.p(x, y, col('navy', 4 if x == x0 + 1 else 3))
        # Crisp white izakaya brush crest motif on each panel
        mx = (x0 + x1) // 2
        if idx == 1:
            # Central circular crest
            cv.outline_box(mx - 2, 11, mx + 2, 15, col('navy', 3), col('white', 6))
            cv.p(mx - 1, 13, col('white', 5))
            cv.p(mx, 12, col('white', 5))
        else:
            cv.hline(x0 + 2, x1 - 2, 12, col('white', 5))
            cv.vline(mx, 11, 16, col('white', 6))
            cv.p(mx - 1, 14, col('cream', 5))

    # Small wooden sake cask & menu board tucked beside left post (x=6..13, y=22..30)
    cv.outline_box(6, 23, 12, 30, col('straw', 4), col('wood', 0), top_hi=col('straw', 5), bot_sh=col('wood', 2))
    cv.hline(7, 11, 25, col('wood', 2))
    cv.hline(7, 11, 28, col('wood', 2))
    cv.p(8, 26, col('red', 4))
    cv.p(9, 26, col('red', 4))

    # Warm glowing red/amber chochin paper lantern hanging on right post (x=21..28, y=10..23)
    # Lantern bracket & hanging cord
    cv.hline(24, 27, 10, col('darkwood', 1))
    cv.vline(24, 10, 12, col('darkwood', 0))
    # Top & bottom wooden lantern caps
    cv.hline(23, 27, 12, col('darkwood', 0))
    cv.hline(23, 27, 21, col('darkwood', 0))
    cv.vline(25, 22, 24, col('red', 3))  # hanging tassel
    # Glowing oval chochin body (cx=24.5, cy=16.5)
    for y in range(13, 21):
        for x in range(21, 29):
            if y in (13, 20) and x in (21, 28):
                continue
            if x in (21, 28):
                cv.p(x, y, col('red', 2))
            elif y in (13, 20):
                cv.p(x, y, col('red', 4))
            elif x in (23, 24, 25, 26) and 15 <= y <= 18:
                # Hot incandescent core
                cv.p(x, y, col('yellow', 5 if (y in (16, 17) and x in (24, 25)) else 4))
            elif y % 2 == 0:
                cv.p(x, y, col('orange', 4))  # bamboo rib shade
            else:
                cv.p(x, y, col('orange', 5))
    # Tiny dark calligraphy stroke on lantern face
    cv.p(24, 16, col('red', 1))
    cv.p(25, 17, col('red', 1))
    # Warm amber bounce glow on adjacent right wooden post!
    for gy in range(14, 20):
        cv.p(27, gy, col('orange', 4 if gy % 2 == 0 else 5))


def draw_umbrella_stand(cv):
    """16x16: Compact metal shop-door umbrella holder with 3 thick rolled umbrellas, curved J-hooks & 3/4 rim."""
    _shadow_line(cv, 2, 14, 15, dark=True)

    # --- Back half of 3/4 recessed metal top rim & dark interior cavity (drawn BEHIND umbrellas) ---
    cv.hline(3, 13, 6, col('steel', 0))
    for rx in (3, 6, 9, 12):
        cv.p(rx, 6, col('steel', 3))       # metallic glint on back rim behind umbrellas
    cv.hline(3, 13, 7, col('ink', 0))
    cv.rect(3, 8, 13, 13, col('ink', 1))  # dark inner cavity so rolled fabric shafts read crisply

    # --- 3 distinct, thicker rolled umbrellas with unmistakable curved J-hook handles (y=0..4) ---
    # 1. Red rolled umbrella (left, x=2..6): wooden J-hook curving LEFT with clear inner air hole at (3,2..3)
    cv.p(2, 1, col('cedar', 5))
    cv.p(3, 1, col('cedar', 6))
    cv.p(4, 1, col('cedar', 4))
    cv.p(2, 2, col('wood', 3))
    cv.p(2, 3, col('wood', 1))      # curved J-hook tip
    cv.p(4, 2, col('cedar', 4))
    cv.p(4, 3, col('wood', 3))
    cv.p(4, 4, col('steel', 4))     # handle ferrule
    # Thick 2px folded red fabric shaft continuing cleanly down behind front wire bars (y=4..13)
    cv.vline(4, 4, 13, col('red', 5))
    cv.vline(5, 4, 13, col('red', 3))
    cv.p(4, 5, col('red', 4))
    cv.p(5, 6, col('red', 1))       # rolled tie-strap crease
    cv.p(4, 11, col('red', 4))

    # 2. Yellow rolled umbrella (center, taller, x=7..10): white J-hook curving RIGHT with clear air hole at (8,1..2)
    cv.p(7, 0, col('white', 5))
    cv.p(8, 0, col('white', 6))
    cv.p(9, 0, col('coolwhite', 5))
    cv.p(9, 1, col('coolwhite', 4))
    cv.p(9, 2, col('steel', 2))     # curved J-hook tip
    cv.p(7, 1, col('white', 5))
    cv.p(7, 2, col('steel', 4))
    cv.p(7, 3, col('steel', 3))     # handle ferrule
    # Thick 2px folded yellow fabric shaft continuing cleanly behind wire bars (y=4..13)
    cv.vline(7, 4, 13, col('yellow', 5))
    cv.vline(8, 4, 13, col('orange', 4))
    cv.p(8, 6, col('orange', 2))    # tie-strap crease
    cv.p(7, 11, col('yellow', 4))

    # 3. Blue rolled umbrella (right, x=10..14): wooden J-hook curving RIGHT with clear air hole at (12,2..3)
    cv.p(11, 1, col('cedar', 4))
    cv.p(12, 1, col('cedar', 6))
    cv.p(13, 1, col('cedar', 5))
    cv.p(13, 2, col('wood', 3))
    cv.p(13, 3, col('wood', 1))     # curved J-hook tip
    cv.p(11, 2, col('cedar', 5))
    cv.p(11, 3, col('wood', 3))
    cv.p(11, 4, col('steel', 4))    # handle ferrule
    # Thick 2px folded blue fabric shaft continuing cleanly behind wire bars (y=4..13)
    cv.vline(10, 4, 13, col('blue', 5))
    cv.vline(11, 4, 13, col('blue', 3))
    cv.p(11, 6, col('blue', 1))     # tie-strap crease
    cv.p(10, 11, col('blue', 4))

    # --- Front 3/4 metal rim (y=6..8), open wire bars (y=8..12) & shaded drip tray (y=13..15) ---
    # Side rim corners connecting back rim (y=6) to front rim (y=8)
    cv.p(2, 7, col('steel', 0))
    cv.p(3, 7, col('steel', 5))
    cv.p(12, 7, col('steel', 3))
    cv.p(13, 7, col('steel', 0))
    # Bright front top chrome rim passing IN FRONT of the 3 umbrellas (y=8)
    cv.p(2, 8, col('steel', 0))
    cv.hline(3, 13, 8, col('coolwhite', 5))
    cv.hline(4, 11, 8, col('white', 6))
    cv.p(13, 8, col('steel', 0))

    # Outer vertical frame posts & thin front divider bars in the gaps (x=6, x=9) so umbrellas stay visible
    cv.vline(2, 8, 15, col('steel', 0))
    cv.vline(3, 9, 13, col('steel', 5))
    cv.vline(12, 9, 13, col('steel', 3))
    cv.vline(13, 8, 15, col('steel', 0))
    cv.vline(6, 9, 13, col('steel', 4))
    cv.vline(9, 9, 13, col('steel', 3))
    # Thin horizontal front mid-wire bar (y=10) crossing cleanly over the 3 folded umbrellas
    cv.hline(3, 13, 10, col('steel', 4))
    cv.p(6, 10, col('coolwhite', 5))
    cv.p(9, 10, col('coolwhite', 4))

    # Shaded metal drip tray base (y=13..15)
    cv.hline(3, 13, 12, col('steel', 1))   # inner tray lip shadow
    cv.p(2, 13, col('steel', 0))
    cv.hline(3, 8, 13, col('coolwhite', 4))  # soft sunlit left drip tray lip
    cv.hline(8, 13, 13, col('steel', 4))     # muted right drip tray lip
    cv.p(12, 13, col('steel', 3))
    cv.p(13, 13, col('steel', 0))
    cv.p(2, 14, col('steel', 0))
    cv.p(3, 14, col('steel', 3))
    cv.hline(4, 10, 14, col('steel', 2))
    cv.hline(10, 13, 14, col('steel', 1))  # deeper shaded right face of drip tray
    cv.p(13, 14, col('steel', 0))
    cv.hline(2, 14, 15, col('ink', 0))     # grounded tray bottom & contact shadow


def draw_pastry_case(cv):
    """32x32: Glass-fronted boutique cafe display counter with warm-lit tiered cakes & tarts (lightAnchor)."""
    _shadow_line(cv, 2, 30, 31, dark=True)

    # Top marble/white serving slab in 3/4 view (x=2..30, y=4..8)
    cv.outline_box(2, 4, 30, 8, col('white', 5), col('steel', 0), top_hi=col('white', 6), bot_sh=col('coolwhite', 3))
    # Mini glass cloche cake dome on right & menu tent card on left + silver espresso cup in center
    cv.outline_box(22, 1, 28, 6, col('glass', 5), col('steel', 1), top_hi=col('white', 6))
    cv.rect(23, 3, 27, 5, col('orange', 4))
    cv.p(25, 2, col('red', 4))
    cv.hline(22, 28, 5, col('white', 6))
    cv.outline_box(4, 2, 9, 6, col('cream', 5), col('wood', 1))
    cv.hline(5, 8, 3, col('brick', 4))
    # Tiny ceramic cup & saucer on top center
    cv.hline(13, 17, 5, col('coolwhite', 5))
    cv.rect(14, 3, 16, 5, col('white', 6))
    cv.p(16, 4, col('steel', 3))

    # --- Warm-lit glass display vitrine (x=2..30, y=8..22) ---
    cv.outline_box(2, 8, 30, 22, col('rooftile', 3), col('steel', 0))
    # Cozy warm amber backlit interior so white plates & cake frosting POP vividly!
    cv.hline(3, 29, 9, col('yellow', 5))  # hot LED light bar
    cv.rect(3, 10, 29, 21, col('rooftile', 4))
    cv.hline(3, 29, 10, col('orange', 4))
    cv.rect(3, 15, 29, 21, col('rooftile', 3))
    cv.hline(3, 29, 16, col('orange', 4))  # second-tier under-shelf warm light

    # Upper glass shelf (y=14)
    cv.hline(3, 29, 14, col('coolwhite', 5))
    cv.hline(3, 29, 15, col('steel', 2))

    # Upper shelf cakes on crisp white plates:
    # 1. Strawberry shortcake (x=5..11)
    cv.hline(5, 11, 13, col('white', 6))
    cv.rect(6, 10, 10, 13, col('white', 6))
    cv.hline(6, 10, 11, col('red', 4))
    cv.p(7, 9, col('red', 5))
    cv.p(9, 9, col('red', 4))
    # 2. Chocolate ganache cake (x=13..19)
    cv.hline(13, 19, 13, col('white', 6))
    cv.rect(14, 10, 18, 13, col('wood', 1))
    cv.hline(14, 18, 10, col('wood', 3))
    cv.p(16, 9, col('yellow', 5))
    # 3. Lemon meringue tart (x=21..27)
    cv.hline(21, 27, 13, col('white', 6))
    cv.rect(22, 11, 26, 13, col('orange', 4))
    cv.hline(22, 26, 10, col('yellow', 5))
    cv.p(24, 10, col('white', 6))

    # Lower shelf pastries on white trays (y=16..20):
    # 4. Berry fruit tarts (x=4..12)
    cv.hline(4, 12, 19, col('white', 6))
    for tx, topc in [(5, 'pink:5'), (8, 'red:4'), (10, 'blue:4')]:
        cv.rect(tx, 17, tx + 2, 19, col('cedar', 5))
        cv.p(tx, 16, topc)
        cv.p(tx + 1, 17, col('white', 6))
    # 5. Golden croissants & cream puffs (x=14..21)
    cv.hline(14, 21, 19, col('white', 6))
    cv.rect(15, 17, 18, 19, col('yellow', 4))
    cv.p(16, 16, col('yellow', 5))
    cv.rect(19, 17, 21, 19, col('cedar', 5))
    cv.p(19, 17, col('white', 6))
    # 6. Chocolate eclairs (x=23..28)
    cv.hline(23, 28, 19, col('white', 6))
    cv.rect(24, 17, 27, 19, col('floorwood', 4))
    cv.hline(24, 27, 17, col('wood', 1))
    cv.p(25, 17, col('white', 6))

    # Tiny pastry price tags along bottom glass edge & crisp specular reflection
    for px in (7, 16, 25):
        cv.p(px, 20, col('white', 6))
    for gx, gy in [(4, 9), (3, 10), (27, 9), (26, 10), (4, 16), (3, 17)]:
        cv.p(gx, gy, col('coolwhite', 5))
    cv.vline(3, 8, 21, col('steel', 4))
    cv.vline(28, 8, 21, col('steel', 3))

    # Lower boutique wooden counter cabinet (y=21..30)
    cv.outline_box(2, 21, 30, 30, col('cedar', 4), col('wood', 0), top_hi=col('yellow', 4), bot_sh=col('wood', 2))
    for px0 in (4, 12, 20):
        cv.outline_box(px0, 23, px0 + 7, 28, col('wood', 4), col('wood', 1), top_hi=col('cedar', 5))
        cv.p(px0 + 3, 25, col('yellow', 5))
    cv.rect(3, 29, 29, 31, col('darkwood', 0))


def draw_retro_arcade_cab(cv):
    """16x32: Classic Japanese candy-cab arcade machine with glowing pixel screen & buttons (lightAnchor)."""
    _shadow_line(cv, 2, 14, 31, dark=True)

    # Top curved candy-cab fiberglass hood (x=2..14, y=1..6)
    cv.hline(3, 13, 1, col('steel', 0))
    cv.outline_box(2, 2, 14, 7, col('white', 5), col('steel', 0), top_hi=col('white', 6), bot_sh=col('coolwhite', 3))
    # Glowing pink/yellow header marquee
    cv.outline_box(3, 3, 13, 6, col('pink', 4), col('ink', 0))
    cv.hline(4, 12, 4, col('yellow', 5))
    cv.p(5, 4, col('blue', 4))
    cv.p(8, 4, col('white', 6))
    cv.p(10, 4, col('red', 4))

    # Recessed CRT monitor bezel & glowing pixel arcade screen (x=2..14, y=7..16)
    cv.outline_box(2, 7, 14, 16, col('asphalt', 0), col('steel', 0))
    cv.vline(2, 7, 16, col('coolwhite', 4))  # white side cheeks
    cv.vline(13, 7, 16, col('coolwhite', 2))
    # Glowing CRT game scene (x=3..13, y=8..15)
    cv.rect(3, 8, 13, 15, col('navy', 1))
    cv.hline(3, 13, 8, col('blue', 3))  # HUD score bar
    cv.p(4, 8, col('yellow', 5))
    cv.p(11, 8, col('green', 5))
    # Retro shmup / platformer pixel sprites on screen!
    cv.p(5, 10, col('pink', 5))  # enemy 1
    cv.p(6, 10, col('pink', 4))
    cv.p(10, 10, col('red', 5))  # enemy 2
    cv.p(8, 11, col('yellow', 5))  # laser shot
    cv.p(8, 12, col('white', 6))
    cv.hline(7, 10, 13, col('glass', 6))  # player ship wings
    cv.p(8, 12, col('coolwhite', 5))
    cv.hline(3, 13, 14, col('teal', 4))  # glowing ground/horizon

    # Protruding slanted control deck in 3/4 view (x=1..15, y=15..20)
    cv.outline_box(1, 15, 15, 19, col('white', 5), col('steel', 0), top_hi=col('white', 6), bot_sh=col('blue', 4))
    cv.hline(2, 14, 19, col('blue', 2))  # front deck lip
    cv.hline(2, 14, 20, col('ink', 1))  # deck cast shadow
    # Red ball-top joystick (left)
    cv.p(4, 17, col('steel', 5))
    cv.rect(3, 15, 5, 17, col('red', 4))
    cv.p(3, 15, col('red', 5))
    # Colorful arcade buttons (right)
    cv.p(8, 16, col('pink', 5))
    cv.p(10, 16, col('yellow', 5))
    cv.p(12, 16, col('green', 4))
    cv.p(9, 17, col('blue', 4))
    cv.p(11, 17, col('orange', 4))

    # Lower candy-cab fiberglass body (x=2..14, y=20..30)
    cv.outline_box(2, 20, 14, 30, col('white', 4), col('steel', 0), bot_sh=col('coolwhite', 2))
    # Signature pink & blue side accent stripes
    cv.vline(3, 21, 29, col('pink', 4))
    cv.vline(12, 21, 29, col('blue', 4))
    # Recessed steel coin door & glowing orange 100-yen coin slot
    cv.outline_box(5, 21, 11, 28, col('steel', 2), col('steel', 0), top_hi=col('steel', 4))
    cv.p(7, 23, col('orange', 5))  # glowing coin return
    cv.p(8, 23, col('yellow', 5))
    cv.rect(6, 25, 10, 27, col('ink', 0))  # coin drop chute
    # Black kickplate & leveling feet
    cv.hline(2, 14, 29, col('asphalt', 0))
    cv.p(3, 30, col('ink', 0))
    cv.p(12, 30, col('ink', 0))


def draw_laundry_basket_cart(cv):
    """16x16: Coin-laundry rolling wire basket trolley with open 3/4 rim, pastel laundry & crisp thin wire grid."""
    _shadow_line(cv, 2, 15, 15, dark=True)

    # Refined curved chrome push handle on the left (x=1..4, y=1..13)
    cv.p(2, 1, col('steel', 0))
    cv.p(3, 1, col('steel', 0))
    cv.p(1, 2, col('steel', 0))
    cv.p(2, 2, col('white', 6))      # smooth rounded top push-bar highlight
    cv.p(3, 2, col('coolwhite', 5))
    cv.vline(1, 3, 13, col('steel', 0))
    cv.vline(2, 3, 13, col('coolwhite', 5))
    cv.p(2, 12, col('steel', 3))

    # --- Open 3/4 rounded basket top rim (y=2..6, x=3..15) ---
    # Back curved rim & dark inner rim shadow
    cv.hline(4, 14, 2, col('steel', 1))
    cv.p(3, 3, col('steel', 0))
    cv.p(14, 3, col('steel', 0))
    cv.rect(4, 3, 14, 7, col('ink', 1))

    # Softly shaded pastel clothes brimming inside the open 3/4 top rim (y=2..6)
    # 1. Soft pink folded sweater (back-left, x=4..9, y=2..6)
    cv.hline(5, 8, 2, col('pink', 2))
    cv.hline(4, 9, 3, col('pink', 5))
    cv.p(5, 3, col('white', 6))      # soft fabric highlight
    cv.hline(4, 9, 4, col('pink', 4))
    cv.hline(4, 8, 5, col('pink', 3))

    # 2. Sky-blue folded shirt (back-right, x=9..14, y=2..6)
    cv.hline(10, 13, 2, col('blue', 1))
    cv.hline(9, 14, 3, col('blue', 5))
    cv.p(10, 3, col('coolwhite', 5))
    cv.hline(9, 14, 4, col('blue', 4))
    cv.hline(10, 14, 5, col('blue', 3))
    cv.p(13, 4, col('blue', 2))

    # 3. Warm cream folded towel (front-center mound tucking into front rim, x=6..12, y=4..6)
    cv.hline(7, 11, 4, col('cream', 6))
    cv.hline(6, 12, 5, col('cream', 5))
    cv.p(8, 5, col('cream', 6))
    cv.p(11, 5, col('cream', 3))

    # Rounded front lip of top chrome rim wrapping cleanly up the side corners (y=4..6)
    cv.p(3, 4, col('steel', 0))
    cv.p(3, 5, col('steel', 4))
    cv.p(14, 4, col('steel', 0))
    cv.p(14, 5, col('steel', 3))
    cv.p(3, 6, col('steel', 0))
    cv.hline(4, 14, 6, col('white', 6))     # bright sunlit front basket rim
    cv.p(13, 6, col('coolwhite', 4))
    cv.p(14, 6, col('steel', 0))

    # --- Darkened inner cavity (y=7..11) behind thinner chrome grid bars ---
    cv.rect(4, 7, 14, 12, col('ink', 1))
    cv.hline(4, 14, 7, col('ink', 0))       # deep shadow right under front rim
    # Shadowed pastel laundry glimpses inside dark basket cavity (low luminance so chrome bars pop!)
    cv.rect(4, 8, 7, 11, col('pink', 2))
    cv.p(4, 10, col('pink', 1))
    cv.rect(7, 8, 11, 11, col('cream', 2))
    cv.p(8, 8, col('straw', 2))
    cv.rect(11, 8, 14, 11, col('blue', 2))
    cv.p(13, 10, col('navy', 1))
    cv.hline(4, 14, 11, col('steel', 1))    # shaded basket floor

    # Thinner, crisp 1px chrome wire-mesh grid overlaid cleanly over darkened cavity (y=7..12)
    cv.vline(3, 6, 13, col('steel', 0))
    cv.vline(14, 6, 13, col('steel', 0))
    # Thin horizontal mid-wire & bottom basket rim
    cv.hline(4, 14, 9, col('coolwhite', 4))
    cv.hline(4, 14, 11, col('coolwhite', 4))
    cv.hline(3, 15, 12, col('steel', 0))
    # Thin 1px vertical chrome grid bars at x=6 and x=10 with specular cross glints
    for wx in (6, 10):
        cv.vline(wx, 7, 12, col('coolwhite', 5))
        cv.p(wx, 9, col('white', 6))
        cv.p(wx, 7, col('steel', 4))

    # Tubular steel undercarriage & swivel caster wheels (y=12..15)
    cv.hline(3, 14, 13, col('steel', 3))
    cv.p(3, 13, col('coolwhite', 4))
    for wx in (3, 11):
        cv.rect(wx, 13, wx + 2, 15, col('asphalt', 0))
        cv.p(wx, 13, col('steel', 5))


# ---------------------------------------------------------------------------
# BATCH REGISTRY & GENERATOR
# ---------------------------------------------------------------------------

SPECS = [
    # alley-utility (10)
    {
        'id': 'mf-obj-plastic_crates',
        'name': '배달 플라스틱 상자 더미',
        'en': 'stacked plastic delivery crates',
        'category': 'alley-utility',
        'w': 2, 'h': 1, 'px': [32, 16],
        'tags': ['alley', 'utility', 'crates', 'delivery'],
        'fn': draw_plastic_crates,
    },
    {
        'id': 'mf-obj-recycle_bin_trio',
        'name': '3색 분리수거함',
        'en': 'color-coded recycle bin trio',
        'category': 'alley-utility',
        'w': 2, 'h': 1, 'px': [32, 16],
        'tags': ['alley', 'utility', 'recycle', 'bins'],
        'fn': draw_recycle_bin_trio,
    },
    {
        'id': 'mf-obj-metal_dumpster',
        'name': '골목 대형 철제 쓰레기통',
        'en': 'weathered commercial metal dumpster',
        'category': 'alley-utility',
        'w': 2, 'h': 2, 'px': [32, 32],
        'tags': ['alley', 'utility', 'dumpster', 'trash'],
        'fn': draw_metal_dumpster,
    },
    {
        'id': 'mf-obj-garbage_net_cage',
        'name': '접이식 쓰레기 수거 그물망',
        'en': 'folding garbage collection net cage',
        'category': 'alley-utility',
        'w': 2, 'h': 1, 'px': [32, 16],
        'tags': ['alley', 'utility', 'trash', 'net'],
        'fn': draw_garbage_net_cage,
    },
    {
        'id': 'mf-obj-wall_ac_unit',
        'name': '에어컨 실외기',
        'en': 'outdoor split AC condenser unit',
        'category': 'alley-utility',
        'w': 1, 'h': 1, 'px': [16, 16],
        'tags': ['alley', 'utility', 'ac', 'machinery'],
        'fn': draw_wall_ac_unit,
    },
    {
        'id': 'mf-obj-gas_meter_pipes',
        'name': '가스 계량기·배관',
        'en': 'exterior gas meter and yellow riser pipes',
        'category': 'alley-utility',
        'w': 1, 'h': 2, 'px': [16, 32],
        'tags': ['alley', 'utility', 'gas', 'pipes'],
        'fn': draw_gas_meter_pipes,
    },
    {
        'id': 'mf-obj-propane_cylinders',
        'name': 'LPG 프로판 가스통 2구',
        'en': 'chained LPG propane cylinders',
        'category': 'alley-utility',
        'w': 1, 'h': 2, 'px': [16, 32],
        'tags': ['alley', 'utility', 'propane', 'gas'],
        'fn': draw_propane_cylinders,
    },
    {
        'id': 'mf-obj-cardboard_stack',
        'name': '묶은 택배 골판지 상자',
        'en': 'tied and stacked delivery cardboard boxes',
        'category': 'alley-utility',
        'w': 2, 'h': 1, 'px': [32, 16],
        'tags': ['alley', 'utility', 'cardboard', 'boxes'],
        'fn': draw_cardboard_stack,
    },
    {
        'id': 'mf-obj-wood_pallet_sacks',
        'name': '목재 팔레트 쌀·밀가루 포대',
        'en': 'wooden shipping pallet with rice and flour sacks',
        'category': 'alley-utility',
        'w': 2, 'h': 1, 'px': [32, 16],
        'tags': ['alley', 'utility', 'pallet', 'sacks'],
        'fn': draw_wood_pallet_sacks,
    },
    {
        'id': 'mf-obj-mop_bucket_broom',
        'name': '청소 양동이·빗자루·대걸레',
        'en': 'wringer mop bucket and leaning broom',
        'category': 'alley-utility',
        'w': 1, 'h': 1, 'px': [16, 16],
        'tags': ['alley', 'utility', 'cleaning', 'shopkeeping'],
        'fn': draw_mop_bucket_broom,
    },
    # shopfront-life (10)
    {
        'id': 'mf-obj-fruit_veg_stand',
        'name': '청과물 야채 가판대',
        'en': 'slanted wooden greengrocer fruit and veg stand',
        'category': 'shopfront-life',
        'w': 2, 'h': 2, 'px': [32, 32],
        'tags': ['shopfront', 'market', 'fruit', 'produce'],
        'fn': draw_fruit_veg_stand,
    },
    {
        'id': 'mf-obj-bakery_bread_rack',
        'name': '베이커리 노천 빵 진열대',
        'en': 'tiered bakery sidewalk bread display rack',
        'category': 'shopfront-life',
        'w': 2, 'h': 2, 'px': [32, 32],
        'tags': ['shopfront', 'bakery', 'bread', 'canopy'],
        'fn': draw_bakery_bread_rack,
    },
    {
        'id': 'mf-obj-flower_bucket_stand',
        'name': '꽃집 양동이 계단 진열대',
        'en': 'stepped florist flower bucket stand',
        'category': 'shopfront-life',
        'w': 2, 'h': 2, 'px': [32, 32],
        'tags': ['shopfront', 'florist', 'flowers', 'plants'],
        'fn': draw_flower_bucket_stand,
    },
    {
        'id': 'mf-obj-book_stall',
        'name': '헌책방 100원 균일가 책 가판대',
        'en': 'secondhand bookstore outdoor book trough stall',
        'category': 'shopfront-life',
        'w': 2, 'h': 2, 'px': [32, 32],
        'tags': ['shopfront', 'bookstore', 'books', 'retro'],
        'fn': draw_book_stall,
    },
    {
        'id': 'mf-obj-clothing_rack',
        'name': '부티크 이동식 의류 행거',
        'en': 'rolling chrome boutique clothing rack',
        'category': 'shopfront-life',
        'w': 2, 'h': 2, 'px': [32, 32],
        'tags': ['shopfront', 'boutique', 'clothing', 'fashion'],
        'fn': draw_clothing_rack,
    },
    {
        'id': 'mf-obj-noren_lantern_stand',
        'name': '이자카야 노렌·초롱 입구대',
        'en': 'izakaya wooden noren curtain and paper lantern stand',
        'category': 'shopfront-life',
        'w': 2, 'h': 2, 'px': [32, 32],
        'tags': ['shopfront', 'izakaya', 'noren', 'lantern', 'lit'],
        'lightAnchor': {'x': 25, 'y': 16, 'color': '#e8a448', 'radius': 3},
        'fn': draw_noren_lantern_stand,
    },
    {
        'id': 'mf-obj-umbrella_stand',
        'name': '가게 앞 우산꽂이',
        'en': 'compact shop-door umbrella holder stand',
        'category': 'shopfront-life',
        'w': 1, 'h': 1, 'px': [16, 16],
        'tags': ['shopfront', 'umbrella', 'entryway'],
        'fn': draw_umbrella_stand,
    },
    {
        'id': 'mf-obj-pastry_case',
        'name': '카페 케이크·디저트 쇼케이스',
        'en': 'warm-lit glass pastry display case',
        'category': 'shopfront-life',
        'w': 2, 'h': 2, 'px': [32, 32],
        'tags': ['shopfront', 'cafe', 'pastry', 'lit'],
        'lightAnchor': {'x': 16, 'y': 14, 'color': '#f2e8c4', 'radius': 3},
        'fn': draw_pastry_case,
    },
    {
        'id': 'mf-obj-retro_arcade_cab',
        'name': '레트로 캔디캐비닛 오락기',
        'en': 'classic Japanese candy-cab retro arcade cabinet',
        'category': 'shopfront-life',
        'w': 1, 'h': 2, 'px': [16, 32],
        'tags': ['shopfront', 'arcade', 'retro', 'lit'],
        'lightAnchor': {'x': 8, 'y': 11, 'color': '#86b8c8', 'radius': 2},
        'fn': draw_retro_arcade_cab,
    },
    {
        'id': 'mf-obj-laundry_basket_cart',
        'name': '코인세탁소 이동식 빨래 카트',
        'en': 'coin-laundry rolling wire basket trolley',
        'category': 'shopfront-life',
        'w': 1, 'h': 1, 'px': [16, 16],
        'tags': ['shopfront', 'laundry', 'cart', 'daily'],
        'fn': draw_laundry_basket_cart,
    },
]


def build_batch():
    os.makedirs(OUT_DIR, exist_ok=True)
    manifest_items = []
    for sp in SPECS:
        w_px, h_px = sp['px']
        cv = Canvas(w_px, h_px)
        sp['fn'](cv)
        out_png = os.path.join(OUT_DIR, f"{sp['id']}.png")
        cv.save(out_png)
        meta = {k: v for k, v in sp.items() if k != 'fn'}
        manifest_items.append(meta)

    manifest = {
        'batch': 'batch_04',
        'kind': 'objects',
        'palette': 'tiledata/jp-city/fable-city/palette.json',
        'count': len(manifest_items),
        'items': manifest_items,
    }
    mpath = os.path.join(OUT_DIR, 'manifest.json')
    with open(mpath, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f'batch_04: generated {len(manifest_items)} objects -> {OUT_DIR}')


if __name__ == '__main__':
    build_batch()
