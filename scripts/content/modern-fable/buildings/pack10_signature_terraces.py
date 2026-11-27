#!/usr/bin/env python3
"""Building Pack 10: Signature Wide-Terrace & Hero Showpiece Pack (pack10_signature_terraces, 10 buildings).

Strictly locked to tiledata/jp-city/fable-city/palette.json via fable_lib.Canvas.
Fable 5.2 top-3/4 RPG pixel-art centerpiece buildings featuring:
  - Generous walkable 2F/3F/1.5F/rooftop terrace decks (24-32px deep) with horizontal planks or flagstones,
  - Real deck-level French/sliding/timber doorways, cast north wall shadows, open balustrades with corner returns,
  - Rich handcrafted life: bistro sets, striped parasols, sunlit pergolas, hanging string lights, olive/ornamental trees,
    external painted-steel stairs, vaulted glass atrium, arched canal portico, U-shaped courtyard, night-market stalls,
  - 0 off-palette pixels, binary alpha (0/255), 55-95 harmonious colors, zero floor cloning.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PARENT = os.path.dirname(HERE)
if PARENT not in sys.path:
    sys.path.insert(0, PARENT)

from fable_lib import Canvas, C, col, hsh, shade_rgba, OUT_ROOT

BATCH = 'pack10_signature_terraces'
OUT_DIR = os.path.join(OUT_ROOT, 'buildings', BATCH)


# ---------------------------------------------------------------------------
# Crisp 3x5 / 4x5 Pixel Signage Font (no muddy rectangles)
# ---------------------------------------------------------------------------

FONT_5 = {
    'A': ['.###.', '#...#', '#####', '#...#', '#...#'],
    'B': ['####.', '#...#', '####.', '#...#', '####.'],
    'C': ['.####', '#....', '#....', '#....', '.####'],
    'D': ['####.', '#...#', '#...#', '#...#', '####.'],
    'E': ['####', '#...', '###.', '#...', '####'],
    'F': ['####', '#...', '###.', '#...', '#...'],
    'G': ['.####', '#....', '#..##', '#...#', '.####'],
    'H': ['#...#', '#...#', '#####', '#...#', '#...#'],
    'I': ['###', '.#.', '.#.', '.#.', '###'],
    'J': ['..###', '...#.', '...#.', '#..#.', '.##..'],
    'K': ['#..#', '#.#.', '##..', '#.#.', '#..#'],
    'L': ['#...', '#...', '#...', '#...', '####'],
    'M': ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
    'N': ['#...#', '##..#', '#.#.#', '#..##', '#...#'],
    'O': ['.###.', '#...#', '#...#', '#...#', '.###.'],
    'P': ['####.', '#...#', '####.', '#....', '#....'],
    'R': ['####.', '#...#', '####.', '#.#..', '#..#.'],
    'S': ['.###', '#...', '.##.', '...#', '###.'],
    'T': ['#####', '..#..', '..#..', '..#..', '..#..'],
    'U': ['#...#', '#...#', '#...#', '#...#', '.###.'],
    'V': ['#...#', '#...#', '#...#', '.#.#.', '..#..'],
    'W': ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
    'Y': ['#...#', '.#.#.', '..#..', '..#..', '..#..'],
    '2': ['###.', '...#', '.##.', '#...', '####'],
    '4': ['#..#', '#..#', '####', '...#', '...#'],
    '&': ['.##.', '#..#', '.##.', '#.#.', '.#.#'],
    ' ': ['..', '..', '..', '..', '..'],
}

FONT_3 = {
    'A': ['.#.', '#.#', '###', '#.#', '#.#'],
    'B': ['##.', '#.#', '##.', '#.#', '##.'],
    'C': ['.##', '#..', '#..', '#..', '.##'],
    'D': ['##.', '#.#', '#.#', '#.#', '##.'],
    'E': ['###', '#..', '##.', '#..', '###'],
    'F': ['###', '#..', '##.', '#..', '#..'],
    'G': ['.##', '#..', '#.#', '#.#', '.##'],
    'H': ['#.#', '#.#', '###', '#.#', '#.#'],
    'I': ['###', '.#.', '.#.', '.#.', '###'],
    'K': ['#.#', '#.#', '##.', '#.#', '#.#'],
    'L': ['#..', '#..', '#..', '#..', '###'],
    'M': ['#.#', '###', '###', '#.#', '#.#'],
    'N': ['###', '#.#', '#.#', '#.#', '#.#'],
    'O': ['###', '#.#', '#.#', '#.#', '###'],
    'P': ['###', '#.#', '###', '#..', '#..'],
    'R': ['##.', '#.#', '##.', '#.#', '#.#'],
    'S': ['.##', '#..', '.#.', '..#', '##.'],
    'T': ['###', '.#.', '.#.', '.#.', '.#.'],
    'U': ['#.#', '#.#', '#.#', '#.#', '###'],
    'Y': ['#.#', '#.#', '.#.', '.#.', '.#.'],
    '2': ['##.', '..#', '.#.', '#..', '###'],
    '4': ['#.#', '#.#', '###', '..#', '..#'],
    '&': ['.#.', '#.#', '.#.', '#.#', '.##'],
    ' ': ['..', '..', '..', '..', '..'],
}


def measure_text(text, compact=False, spacing=1):
    font = FONT_3 if compact else FONT_5
    w = 0
    for i, ch in enumerate(text.upper()):
        g = font.get(ch, font[' '])
        w += len(g[0]) + (spacing if i < len(text) - 1 else 0)
    return w


def draw_text(cv, text, x, y, color, shadow=None, compact=False, spacing=1, vertical=False):
    font = FONT_3 if compact else FONT_5
    rgba = C(color)
    sh = C(shadow) if shadow is not None else None
    cx, cy = x, y
    for ch in text.upper():
        g = font.get(ch, font[' '])
        gw = len(g[0])
        gh = len(g)
        if sh is not None:
            for ry, row in enumerate(g):
                for rx, bit in enumerate(row):
                    if bit == '#':
                        cv.p(cx + rx, cy + ry + 1, sh)
        for ry, row in enumerate(g):
            for rx, bit in enumerate(row):
                if bit == '#':
                    cv.p(cx + rx, cy + ry, rgba)
        if vertical:
            cy += gh + spacing
        else:
            cx += gw + spacing


def draw_text_centered(cv, text, x0, x1, y, color, shadow=None, compact=False, spacing=1):
    tw = measure_text(text, compact=compact, spacing=spacing)
    tx = x0 + max(0, (x1 - x0 - tw) // 2)
    draw_text(cv, text, tx, y, color, shadow=shadow, compact=compact, spacing=spacing)


# ---------------------------------------------------------------------------
# Architectural Material & Roof Primitives (Fable 5.2 Top-3/4 Standard)
# ---------------------------------------------------------------------------

def draw_ashlar_wall(cv, x0, y0, x1, y1, ramp='cream', base_i=4, course_h=5, block_w=10, seed=0):
    for y in range(max(0, y0), min(cv.h, y1)):
        ry = y - y0
        ci = ry // course_h
        yy = ry % course_h
        off = (block_w // 2) if (ci % 2 == 1) else 0
        for x in range(max(0, x0), min(cv.w, x1)):
            rx = (x - x0) + off
            bi = rx // block_w
            bx = rx % block_w
            if yy == course_h - 1 or bx == block_w - 1:
                cv.p(x, y, col(ramp, max(1, base_i - 2)))
            else:
                r = hsh(bi, ci, seed)
                t = base_i + (1 if r > 0.72 else (-1 if r < 0.24 else 0))
                if yy == 0:
                    t = min(t + 1, 6)
                cv.p(x, y, col(ramp, t))


def draw_stucco_wall(cv, x0, y0, x1, y1, ramp='cream', base_i=5, seed=0, shadow_top=2):
    cv.stipple_rect(x0, y0, x1, y1, ramp, base_i, max(1, base_i - 1), min(6, base_i + 1), seed=seed, rate=0.16)
    for dy in range(shadow_top):
        if y0 + dy < y1:
            cv.hline(x0, x1, y0 + dy, col(ramp, max(1, base_i - (2 - dy))))
    # Subtle vertical wall edge shading (top-left sunlight)
    if x1 - x0 >= 6:
        cv.vline(x0, y0, y1, col(ramp, max(1, base_i - 2)))
        cv.vline(x0 + 1, y0, y1, col(ramp, min(6, base_i + 1)))
        cv.vline(x1 - 2, y0, y1, col(ramp, max(1, base_i - 1)))
        cv.vline(x1 - 1, y0, y1, col(ramp, max(0, base_i - 3)))


def draw_cornice(cv, x0, y, x1, ramp='stone', h=3, dentils=False):
    cv.hline(x0, x1, y, col(ramp, 6))
    if h >= 2:
        cv.hline(x0, x1, y + 1, col(ramp, 4))
    if h >= 3:
        cv.hline(x0, x1, y + 2, col(ramp, 2))
        if dentils:
            for x in range(x0 + 2, x1 - 2, 3):
                cv.p(x, y + 2, col(ramp, 5))
    cv.hline(x0 + 1, x1 - 1, y + h, col('ink', 1))


def draw_quoins(cv, x0, y0, x1, y1, ramp='cream', qw=4, qh=4):
    for y in range(y0, y1):
        ci = (y - y0) // qh
        yy = (y - y0) % qh
        w_cur = qw + (2 if ci % 2 == 0 else 0)
        for x in range(x0, min(x0 + w_cur, x1)):
            if yy == qh - 1 or x == x0 + w_cur - 1:
                cv.p(x, y, col(ramp, 2))
            elif yy == 0 or x == x0 + 1:
                cv.p(x, y, col(ramp, 6))
            else:
                cv.p(x, y, col(ramp, 4))
        for x in range(max(x0, x1 - w_cur), x1):
            if yy == qh - 1 or x == x1 - w_cur:
                cv.p(x, y, col(ramp, 1))
            elif yy == 0:
                cv.p(x, y, col(ramp, 5))
            else:
                cv.p(x, y, col(ramp, 3))


def draw_ribbed_roof(cv, x0, y0, x1, y1, ramp='kawara', tile_w=4, course_h=4,
                     moss=0.06, finials=True, ridge_ramp=None, seed=0):
    """Authentic Fable 5.2 pitched ribbed roof (kawara / midori / rooftile / cha / ibushi) with ridge & eave."""
    w = x1 - x0
    h = y1 - y0
    rr = ridge_ramp or ramp
    for y in range(max(0, y0), min(cv.h, y1)):
        ry = y - y0
        for x in range(max(0, x0), min(cv.w, x1)):
            rx = x - x0
            if ry == 0:
                cv.p(x, y, col(rr, 1) if rx in (0, w - 1) else col(rr, 6))
            elif ry == 1:
                cv.p(x, y, col(rr, 5 if rx % 3 != 2 else 4))
            elif ry == 2:
                cv.p(x, y, col(rr, 2))
            elif ry == h - 1:
                cv.p(x, y, col(ramp, 0))
            elif ry == h - 2:
                cv.p(x, y, col(ramp, 2 if rx % tile_w == 1 else 1))
            else:
                ci = (ry - 3) // course_h
                yy = (ry - 3) % course_h
                bx = rx % tile_w
                bi = rx // tile_w
                r = hsh(bi, ci, seed)
                right_sh = 1 if rx >= w - 3 else 0
                if yy == course_h - 1:
                    cv.p(x, y, col(ramp, max(0, 1 - right_sh)))
                elif bx == tile_w - 1:
                    cv.p(x, y, col(ramp, max(0, 2 - right_sh)))
                elif moss > 0 and r > 1.0 - moss and ry >= h // 2:
                    cv.p(x, y, col('moss', 4 if yy <= 1 else 2))
                else:
                    base_t = 5 if ry < h // 3 else (4 if ry < (2 * h) // 3 else 3)
                    if bx == 0:
                        base_t += 1
                    if r > 0.78:
                        base_t += 1
                    elif r < 0.22:
                        base_t -= 1
                    cv.p(x, y, col(ramp, max(1, min(6, base_t - right_sh))))
    if finials and w >= 12:
        for fx in (x0 + 1, x1 - 4):
            cv.rect(fx, y0 - 1, fx + 3, y0 + 2, col(rr, 5))
            cv.hline(fx, fx + 3, y0 - 1, col(rr, 6))
            cv.p(fx + 1, y0, col(rr, 2))
    # Deep eave cast shadow below
    cv.hline(x0 + 1, x1 - 1, y1, col('ink', 0))
    cv.hline(x0 + 2, x1 - 2, y1 + 1, col('ink', 1))


def draw_chimney(cv, x, y, w=7, h=14, ramp='brick', smoke=False):
    cv.brick_wall(x, y + 2, x + w, y + h, ramp=ramp, base_i=4, course_h=3, brick_w=4, seed=x * 7)
    cv.vline(x, y + 2, y + h, col(ramp, 1))
    cv.vline(x + w - 1, y + 2, y + h, col(ramp, 0))
    # Cap rim
    cv.rect(x - 1, y, x + w + 1, y + 3, col('stone', 4))
    cv.hline(x - 1, x + w + 1, y, col('stone', 6))
    cv.hline(x - 1, x + w + 1, y + 2, col('stone', 1))
    cv.rect(x + 1, y + 1, x + w - 1, y + 2, col('ink', 0))
    if smoke:
        # Soft stylized pixel smoke puff drifting top-right
        for sx, sy, c in [
            (x + 2, y - 1, 'white:4'), (x + 3, y - 1, 'white:5'), (x + 4, y - 2, 'white:6'),
            (x + 5, y - 2, 'white:5'), (x + 6, y - 3, 'white:6'), (x + 7, y - 3, 'white:4'),
            (x + 8, y - 4, 'white:5'), (x + 9, y - 4, 'coolwhite:5'),
        ]:
            cv.p(sx, sy, c)


def draw_skylight(cv, x0, y0, x1, y1, frame='steel:1'):
    cv.outline_box(x0, y0, x1, y1, col('glass', 3), frame, top_hi=col('steel', 5))
    for y in range(y0 + 2, y1 - 1):
        for x in range(x0 + 1, x1 - 1):
            rx, ry = x - x0, y - y0
            if (rx + ry) in (3, 4, 8, 9):
                cv.p(x, y, col('glass', 6))
            elif (rx + ry) in (5, 10):
                cv.p(x, y, col('glass', 5))
            else:
                cv.p(x, y, col('glass', 2 if ry > (y1 - y0) // 2 else 3))
    mx = (x0 + x1) // 2
    cv.vline(mx, y0 + 1, y1 - 1, frame)
    cv.hline(x0 + 1, x1 - 1, y1, col('ink', 1))


# ---------------------------------------------------------------------------
# Hero Terrace Deck, Balustrade & Doorway Primitives
# ---------------------------------------------------------------------------

def draw_walkable_terrace(cv, x0, y0, x1, y1, floor_style='wood', floor_ramp='floorwood',
                          rail_style='wood', rail_ramp='wood', rail_h=7,
                          gap_x=None, north_shadow=3, left_return=True, right_return=True,
                          pier_xs=None, seed=0):
    """Spacious top-3/4 walkable terrace floor deck (planks or flagstones) with north shadow,
    corner rail returns, and open front balustrade (optional stair opening `gap_x=(gx0, gx1)`).
    """
    fy1 = y1 - rail_h
    w = x1 - x0

    # 1. Walkable Deck Surface (planks or foreshortened horizontal stone pavers)
    for y in range(y0, fy1):
        ry = y - y0
        for x in range(x0, x1):
            rx = x - x0
            if floor_style == 'flagstone':
                # Foreshortened 3px row-height horizontal stone pavers with subtle low-contrast seams
                ch = 3
                cw = 11
                ci = ry // ch
                yy = ry % ch
                off = (cw // 2) if (ci % 2 == 1) else 0
                bx = (rx + off) % cw
                bi = (rx + off) // cw
                r = hsh(bi, ci, seed)
                if yy == ch - 1:
                    # Subtle horizontal foreshortened paver seam (low-contrast -1 tone)
                    c = col(floor_ramp, 3 if r > 0.25 else 2)
                elif bx == cw - 1:
                    # Subtle staggered vertical paver joint
                    c = col(floor_ramp, 3)
                else:
                    t = 4 + (1 if r > 0.45 else 0)
                    if yy == 0 and r > 0.55:
                        t = min(6, t + 1)
                    c = col(floor_ramp, t)
            elif floor_style == 'checker':
                ti = ((rx // 4) + (ry // 4)) % 2
                c = col('cream', 5 if ti == 0 else 3) if ti == 0 else col('stone', 4)
            else:
                # Crisp horizontal cedar/oak deck planks with subtle board joints
                plank_h = 3
                pi = ry // plank_h
                yy = ry % plank_h
                joint = ((rx + (pi * 11)) % 18 == 0)
                if yy == plank_h - 1:
                    c = col(floor_ramp, 2 if hsh(rx // 4, ry, seed) > 0.3 else 1)
                elif joint:
                    c = col(floor_ramp, 2)
                else:
                    r = hsh(rx // 6, pi, seed)
                    t = 5 if (yy == 0 and r > 0.35) else (4 if r > 0.2 else 3)
                    c = col(floor_ramp, t)
            cv.p(x, y, c)

    # 2. North wall cast shadow (strong grounding of wall onto horizontal terrace!)
    if floor_style == 'flagstone':
        # Crisp 2px dark cast shadow along north back-wall base + subtle 3rd-row penumbra
        for dy in range(north_shadow):
            if y0 + dy < fy1:
                if dy == 0:
                    cv.shade_rect(x0, y0 + dy, x1, y0 + dy + 1, delta=-3)
                elif dy == 1:
                    cv.shade_rect(x0, y0 + dy, x1, y0 + dy + 1, delta=-2)
                else:
                    cv.shade_rect(x0, y0 + dy, x1, y0 + dy + 1, delta=-1)
    else:
        for dy in range(north_shadow):
            if y0 + dy < fy1:
                delta = -2 if dy == 0 else -1
                cv.shade_rect(x0, y0 + dy, x1, y0 + dy + 1, delta=delta)

    # 3. Side return balustrades (left & right corners returning back to the wall)
    if left_return:
        cv.vline(x0, y0, y1, col(rail_ramp, 0))
        cv.vline(x0 + 1, y0, y1 - 1, col(rail_ramp, 5))
        cv.vline(x0 + 2, y0, fy1, col(rail_ramp, 2))
        # Soft cast shadow from left return rail onto deck
        cv.shade_rect(x0 + 3, y0 + north_shadow, x0 + 5, fy1, delta=-1)
    if right_return:
        cv.vline(x1 - 1, y0, y1, col(rail_ramp, 0))
        cv.vline(x1 - 2, y0, y1 - 1, col(rail_ramp, 4))
        cv.vline(x1 - 3, y0, fy1, col(rail_ramp, 1))

    # 4. Open Front Balustrade (respecting optional stair opening gap_x)
    def in_gap(px):
        return gap_x is not None and (gap_x[0] <= px < gap_x[1])

    for x in range(x0, x1):
        if in_gap(x):
            # Solid horizontal deck planks/pavers & veranda fascia rim behind stair opening (ZERO alpha holes!)
            rx = x - x0
            for y in range(fy1, y1 - 2):
                ry = y - y0
                if floor_style == 'flagstone':
                    cv.p(x, y, col(floor_ramp, 3 if (ry % 3 == 2) else 5))
                else:
                    cv.p(x, y, col(floor_ramp, 2 if (ry % 3 == 2) else (5 if ry % 3 == 0 else 4)))
            cv.p(x, y1 - 2, col(rail_ramp, 4))
            cv.p(x, y1 - 1, col(rail_ramp, 1))
            continue
        rx = x - x0
        if rail_style == 'glass':
            cv.p(x, fy1, col('coolwhite', 5))
            cv.p(x, fy1 + 1, col('steel', 2))
            for y in range(fy1 + 2, y1 - 2):
                if rx in (0, 1, w - 1, w - 2) or rx % 12 == 0:
                    cv.p(x, y, col('steel', 4))
                elif rx % 12 == 1:
                    cv.p(x, y, col('steel', 1))
                else:
                    diag = (rx + (y - fy1)) % 8
                    if diag in (1, 2):
                        cv.p(x, y, col('glass', 5))
                    elif y == y1 - 3:
                        cv.p(x, y, col(floor_ramp, 3))
                    else:
                        cv.p(x, y, col('glass', 3))
            cv.p(x, y1 - 2, col('steel', 4))
            cv.p(x, y1 - 1, col('steel', 1))
        elif rail_style == 'open_balusters':
            # True open vertical wrought-iron balusters with bright top handrail, clear floor peek-through & stone curb
            cv.p(x, fy1, col('steel', 5))
            cv.p(x, fy1 + 1, col('steel', 1))
            for y in range(fy1 + 2, y1 - 2):
                if rx in (0, w - 1) or rx % 4 == 0:
                    cv.p(x, y, col('steel', 2 if y == fy1 + 2 else 1))
                else:
                    # Crisp sunlit deck floor visible between open vertical balusters
                    ry = y - y0
                    if y == fy1 + 2:
                        cv.p(x, y, col(floor_ramp, 3))  # Subtle shadow cast under handrail
                    else:
                        cv.p(x, y, col(floor_ramp, 4 if (ry % 3 == 2) else 5))
            cv.p(x, y1 - 2, col(rail_ramp, 5))
            cv.p(x, y1 - 1, col(rail_ramp, 1))
        elif rail_style == 'iron':
            cv.p(x, fy1, col('steel', 5))
            cv.p(x, fy1 + 1, col('steel', 1))
            for y in range(fy1 + 2, y1 - 2):
                if rx in (0, w - 1) or rx % 4 == 0:
                    cv.p(x, y, col('steel', 1 if y > fy1 + 2 else 2))
                elif rx % 4 == 2 and y == fy1 + 3:
                    cv.p(x, y, col('steel', 3))  # Scroll accent
                else:
                    cv.p(x, y, col(floor_ramp, 3 if y > fy1 + 2 else 2))
            cv.p(x, y1 - 2, col('stone', 5))
            cv.p(x, y1 - 1, col('stone', 1))
        elif rail_style == 'stone':
            cv.p(x, fy1, col(rail_ramp, 6))
            cv.p(x, fy1 + 1, col(rail_ramp, 3))
            for y in range(fy1 + 2, y1 - 2):
                if rx in (0, 1, w - 1, w - 2) or (rx % 5 in (0, 1)):
                    cv.p(x, y, col(rail_ramp, 5 if rx % 5 == 0 else 2))
                else:
                    cv.p(x, y, col(floor_ramp, 2 if y == fy1 + 2 else 3))
            cv.p(x, y1 - 2, col(rail_ramp, 4))
            cv.p(x, y1 - 1, col(rail_ramp, 1))
        else:
            # Open wooden balustrade with sunlit top handrail & deck planks visible between spindles
            cv.p(x, fy1, col(rail_ramp, 6))
            cv.p(x, fy1 + 1, col(rail_ramp, 2))
            for y in range(fy1 + 2, y1 - 2):
                if rx in (0, 1, w - 1, w - 2) or rx % 4 == 0:
                    cv.p(x, y, col(rail_ramp, 4 if y < y1 - 3 else 3))
                elif rx % 4 == 1:
                    cv.p(x, y, col(rail_ramp, 1))
                else:
                    cv.p(x, y, col(floor_ramp, 2 if y == fy1 + 2 else 3))
            cv.p(x, y1 - 2, col(rail_ramp, 4))
            cv.p(x, y1 - 1, col(rail_ramp, 0))

    # Optional architectural corner/interval piers along the balustrade
    if pier_xs:
        pr = 'stone' if rail_style in ('iron', 'stone', 'open_balusters') else rail_ramp
        for px in pier_xs:
            cv.rect(px - 1, fy1 - 1, px + 3, y1, col(pr, 4))
            cv.hline(px - 1, px + 3, fy1 - 1, col(pr, 6))
            cv.vline(px - 1, fy1 - 1, y1, col(pr, 2))
            cv.vline(px + 2, fy1 - 1, y1, col(pr, 1))
            cv.hline(px - 1, px + 3, y1 - 1, col(pr, 0))


def draw_french_door(cv, x0, y0, x1, y1, frame='darkwood', warm=True, arched=False, threshold=True):
    """Deck-level double French doors opening directly onto a terrace floor with warm golden interior."""
    w = x1 - x0
    h = y1 - y0
    mx = (x0 + x1) // 2
    if arched:
        arch_r = min(5, w // 2)
        cx = (x0 + x1 - 1) / 2.0
        for y in range(y0, y1):
            ry = y - y0
            for x in range(x0, x1):
                if ry < arch_r:
                    dx = (x - cx) / max(w / 2.0, 1.0)
                    dy = (arch_r - ry) / max(arch_r, 1.0)
                    if dx * dx + dy * dy > 1.05:
                        continue
                if x in (x0, x1 - 1, mx) or y == y0 or y == y1 - 1:
                    cv.p(x, y, col(frame, 1))
                else:
                    cv.p(x, y, col('orange', 4 if y < y0 + h // 2 else 5) if warm else col('glass', 3))
    else:
        cv.outline_box(x0, y0, x1, y1, col(frame, 3), col(frame, 0), top_hi=col(frame, 5))
    # Left and right multi-pane glazed leaves
    for lx0, lx1 in ((x0 + 1, mx), (mx + 1, x1 - 1)):
        if lx1 - lx0 < 2:
            continue
        gy0 = y0 + (3 if arched else 2)
        gy1 = y1 - 4
        for y in range(gy0, gy1):
            ry = y - gy0
            for x in range(lx0, lx1):
                rx = x - lx0
                if warm:
                    if ry == 0:
                        cv.p(x, y, col('orange', 2))
                    elif ry >= (gy1 - gy0) // 2:
                        cv.p(x, y, col('yellow', 5 if (rx + ry) % 3 == 0 else 4))
                    else:
                        cv.p(x, y, col('orange', 4 if (rx + ry) % 4 != 0 else 3))
                else:
                    if (rx + ry) in (1, 2, 5):
                        cv.p(x, y, col('glass', 5))
                    else:
                        cv.p(x, y, col('glass', 2 if ry < 2 else 3))
        # Horizontal muntin bar
        if gy1 - gy0 >= 7:
            cv.hline(lx0, lx1, (gy0 + gy1) // 2, col(frame, 1))
        # Lower kick panel
        cv.rect(lx0, gy1, lx1, y1 - 1, col(frame, 4))
        cv.hline(lx0, lx1, gy1, col(frame, 2))
    # Center stile & brass handles
    cv.vline(mx, y0 + 1, y1 - 1, col(frame, 1))
    hy = y1 - 6
    cv.p(mx - 1, hy, col('yellow', 5))
    cv.p(mx + 1, hy, col('yellow', 5))
    if threshold:
        cv.hline(x0 - 1, x1 + 1, y1, col('stone', 5))
        cv.hline(x0, x1, y1 + 1, col('ink', 1))


def draw_arched_bay(cv, x0, y0, x1, y1, frame='steel:1', trim='stone:5', warm=True,
                    interior_fn=None, mullions=True, sill='stone:5'):
    """Grand top-3/4 arched café/boutique bay window with rounded crown, keystone & custom interior."""
    w = x1 - x0
    h = y1 - y0
    arch_r = max(3, min(w // 3, 7))
    cx = (x0 + x1 - 1) / 2.0
    for y in range(y0, y1):
        ry = y - y0
        for x in range(x0, x1):
            in_arch = True
            on_rim = False
            if ry < arch_r:
                dx = (x - cx) / max(w / 2.0, 1.0)
                dy = (arch_r - ry) / max(arch_r, 1.0)
                d = dx * dx + dy * dy
                if d > 1.05:
                    in_arch = False
                elif d > 0.72:
                    on_rim = True
            if not in_arch:
                continue
            if on_rim or x in (x0, x1 - 1) or y == y1 - 1:
                cv.p(x, y, trim if (ry < arch_r and y <= y0 + 2) else frame)
            else:
                rx = x - (x0 + 1)
                iry = y - (y0 + 1)
                if warm:
                    if iry <= 2:
                        cv.p(x, y, col('orange', 2))
                    elif iry >= h // 2:
                        cv.p(x, y, col('yellow', 5 if (rx + iry) % 3 == 0 else 4))
                    else:
                        cv.p(x, y, col('orange', 4 if (rx + iry) % 4 != 0 else 3))
                else:
                    if (rx + iry) in (2, 3, 7):
                        cv.p(x, y, col('glass', 5))
                    else:
                        cv.p(x, y, col('glass', 2 if iry < 3 else 3))
    cv.rect(int(cx), y0, int(cx) + 2, y0 + 2, trim)
    if interior_fn is not None:
        interior_fn(cv, x0 + 2, y0 + max(3, arch_r - 1), x1 - 2, y1 - 1)
    if mullions and w >= 12:
        step = max(8, w // 3)
        for mx in range(x0 + step, x1 - 4, step):
            cv.vline(mx, y0 + 3, y1 - 1, frame)
    if mullions and h >= 14:
        cv.hline(x0 + 1, x1 - 1, y0 + arch_r + 2, frame)
    if sill:
        cv.hline(x0 - 1, x1 + 1, y1, sill)
        cv.hline(x0, x1, y1 + 1, col('ink', 1))


# ---------------------------------------------------------------------------
# Lively Terrace & Street Storytelling Props
# ---------------------------------------------------------------------------

def draw_bistro_set(cv, cx, cy, table_ramp='white', chair_ramp='wood', items='coffee', wide=False):
    """Top-3/4 round or rectangular bistro table with 2 flanking chairs, tabletop items & soft deck shadow."""
    tw = 10 if wide else 7
    tx0, tx1 = cx - tw // 2, cx + (tw + 1) // 2
    # Cast shadow on deck beneath table & chairs
    cv.shade_rect(tx0 - 4, cy + 3, tx1 + 5, cy + 7, delta=-2)
    # Left chair
    cv.rect(tx0 - 4, cy - 1, tx0 - 1, cy + 4, col(chair_ramp, 4))
    cv.hline(tx0 - 4, tx0 - 1, cy - 1, col(chair_ramp, 6))
    cv.vline(tx0 - 4, cy - 1, cy + 5, col(chair_ramp, 1))
    cv.vline(tx0 - 2, cy + 2, cy + 6, col(chair_ramp, 1))
    # Right chair
    cv.rect(tx1 + 1, cy - 1, tx1 + 4, cy + 4, col(chair_ramp, 4))
    cv.hline(tx1 + 1, tx1 + 4, cy - 1, col(chair_ramp, 6))
    cv.vline(tx1 + 3, cy - 1, cy + 5, col(chair_ramp, 1))
    cv.vline(tx1 + 1, cy + 2, cy + 6, col(chair_ramp, 1))
    # Table pedestal / legs
    cv.rect(cx - 1, cy + 3, cx + 2, cy + 6, col('steel', 1))
    # Table top (top-3/4 oval/rect)
    cv.rect(tx0, cy, tx1, cy + 4, col(table_ramp, 5))
    cv.hline(tx0 + 1, tx1 - 1, cy, col(table_ramp, 6))
    cv.hline(tx0, tx1, cy + 3, col(table_ramp, 2))
    cv.vline(tx0, cy, cy + 4, col(table_ramp, 2))
    cv.vline(tx1 - 1, cy, cy + 4, col(table_ramp, 1))
    # Tabletop storytelling accents
    if items == 'coffee':
        cv.p(cx - 2, cy + 1, col('white', 6))
        cv.p(cx + 1, cy + 1, col('red', 4))
        cv.p(cx + 2, cy + 1, col('cream', 6))
    elif items == 'tea':
        cv.rect(cx - 1, cy, cx + 1, cy + 2, col('teal', 4))
        cv.p(cx - 2, cy + 1, col('white', 6))
        cv.p(cx + 2, cy + 1, col('pink', 4))
        # Tiny steam wisp
        cv.p(cx, cy - 2, col('white', 6))
        cv.p(cx + 1, cy - 3, col('coolwhite', 5))
    elif items == 'beer':
        cv.rect(cx - 2, cy, cx, cy + 2, col('yellow', 5))
        cv.p(cx - 2, cy, col('white', 6))
        cv.rect(cx + 1, cy, cx + 3, cy + 2, col('orange', 4))
        cv.p(cx + 1, cy, col('white', 6))
    elif items == 'pastry':
        cv.p(cx - 2, cy + 1, col('orange', 4))
        cv.p(cx, cy + 1, col('yellow', 5))
        cv.p(cx + 2, cy + 1, col('red', 4))


def draw_umbrella(cv, cx, cy, rx=10, ry=5, ramp_a='green', ramp_b='cream'):
    """Top-3/4 striped cafe patio umbrella with cast shadow & pole."""
    for y in range(cy + ry - 1, cy + ry + 5):
        for x in range(cx - rx + 2, cx + rx + 2):
            if ((x - (cx + 1)) / max(rx, 1)) ** 2 + ((y - (cy + ry + 2)) / 3.5) ** 2 <= 1.0:
                cv.p(x, y, shade_rgba(cv.get(x, y), -2))
    cv.vline(cx, cy + 2, cy + ry + 7, col('steel', 1))
    cv.vline(cx + 1, cy + 2, cy + ry + 6, col('steel', 4))
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            dx = (x - cx) / max(rx, 1)
            dy = (y - cy) / max(ry, 1)
            d = dx * dx + dy * dy
            if d > 1.0:
                continue
            seg = int((dx + 1.0) * 3.0)
            rmp = ramp_a if (seg % 2 == 0) else ramp_b
            if d > 0.78:
                cv.p(x, y, col(rmp, 1))
            elif dy < -0.25:
                cv.p(x, y, col(rmp, 5 if rmp == ramp_b else 4))
            elif dy > 0.35:
                cv.p(x, y, col(rmp, 2))
            else:
                cv.p(x, y, col(rmp, 4 if rmp == ramp_b else 3))
    cv.p(cx, cy - 1, col('yellow', 5))
    cv.p(cx, cy, col('steel', 2))


def draw_string_lights(cv, x0, y0, x1, y1, sag=4, step=6, bulb_a='yellow:5', bulb_b='orange:5'):
    """Catenary festive terrace string lights with dark wire & warm glowing pixel bulbs."""
    dx = x1 - x0
    steps = max(abs(dx), 1)
    for i in range(steps + 1):
        t = i / steps
        px = int(round(x0 + dx * t))
        py = int(round(y0 + (y1 - y0) * t + sag * 4.0 * t * (1.0 - t)))
        cv.p(px, py, col('ink', 1))
        if i > 1 and i < steps - 1 and (i % step == 0):
            bc = bulb_a if ((i // step) % 2 == 0) else bulb_b
            cv.p(px, py + 1, bc)
            cv.p(px, py + 2, col('yellow', 3) if bc == bulb_a else col('orange', 3))


def draw_lantern(cv, cx, cy, color='red', glow=True):
    """Hanging warm chochin or brass courtyard lantern."""
    cv.p(cx, cy - 1, col('ink', 0))
    cv.rect(cx - 1, cy, cx + 2, cy + 4, col(color, 4))
    cv.hline(cx - 1, cx + 2, cy, col('ink', 1))
    cv.hline(cx - 1, cx + 2, cy + 4, col('ink', 1))
    if glow:
        cv.p(cx, cy + 1, col('yellow', 5))
        cv.p(cx, cy + 2, col('orange', 4))


def draw_potted_tree(cv, cx, base_y, trunk_h=7, rx=6, ry=6, leaf_ramp='foliage',
                     pot_ramp='brick', blossom=None, seed=0):
    """Sculpted terracotta/stone potted ornamental or olive tree."""
    # Shadow
    cv.shade_rect(cx - 4, base_y - 1, cx + 6, base_y + 1, delta=-2)
    # Pot
    cv.rect(cx - 3, base_y - 5, cx + 4, base_y, col(pot_ramp, 4))
    cv.hline(cx - 4, cx + 5, base_y - 5, col(pot_ramp, 5))
    cv.hline(cx - 4, cx + 5, base_y - 4, col(pot_ramp, 2))
    cv.vline(cx - 3, base_y - 5, base_y, col(pot_ramp, 1))
    cv.vline(cx + 3, base_y - 5, base_y, col(pot_ramp, 1))
    cv.hline(cx - 3, cx + 4, base_y - 1, col(pot_ramp, 1))
    # Trunk
    cv.rect(cx - 1, base_y - 5 - trunk_h, cx + 1, base_y - 4, col('wood', 3))
    cv.vline(cx, base_y - 5 - trunk_h, base_y - 4, col('wood', 5))
    # Multi-lobe lush canopy
    top_y = base_y - 5 - trunk_h - ry // 2
    cv.foliage_cluster(cx - 2, top_y + 1, max(3, rx - 1), max(3, ry - 1), ramp=leaf_ramp, seed=seed + 1, blossom=blossom)
    cv.foliage_cluster(cx + 2, top_y + 1, max(3, rx - 1), max(3, ry - 1), ramp=leaf_ramp, seed=seed + 7, blossom=blossom)
    cv.foliage_cluster(cx, top_y - 1, rx, ry, ramp=leaf_ramp, seed=seed + 13, blossom=blossom)


def draw_noren(cv, x0, y0, x1, y1, ramp='navy', panels=4, crest='white:5'):
    """Split Japanese/Asian shopfront noren curtains with bamboo rod & crisp crests."""
    cv.hline(x0 - 1, x1 + 1, y0, col('cedar', 5))
    cv.hline(x0 - 1, x1 + 1, y0 + 1, col('wood', 1))
    pw = max(4, (x1 - x0) // panels)
    for i in range(panels):
        px0 = x0 + i * pw
        px1 = min(x1, px0 + pw - 1)
        if px1 <= px0 + 1:
            continue
        cv.rect(px0, y0 + 2, px1, y1, col(ramp, 3))
        cv.hline(px0, px1, y0 + 2, col(ramp, 1))
        cv.vline(px0, y0 + 2, y1, col(ramp, 4))
        cv.vline(px1 - 1, y0 + 2, y1, col(ramp, 1))
        cv.hline(px0, px1, y1 - 1, col(ramp, 0))
        # Emblem crest dot
        mcx = (px0 + px1) // 2
        mcy = (y0 + 2 + y1) // 2
        if px1 - px0 >= 5 and y1 - y0 >= 6:
            cv.p(mcx, mcy - 1, crest)
            cv.p(mcx - 1, mcy, crest)
            cv.p(mcx + 1, mcy, crest)
            cv.p(mcx, mcy + 1, crest)


def draw_domed_umbrella(cv, cx, cy, rx=9, ry=5, ramp_a='rooftile', ramp_b='cream', pole_bottom=None):
    """Clean rounded top-3/4 domed patio umbrella canopy (radial gores, no murky tabletop drum shadow)."""
    # Slender steel pole descending cleanly to tabletop center (no muddy shadow over tabletop)
    pb = pole_bottom if pole_bottom is not None else (cy + ry + 5)
    cv.vline(cx, cy + ry - 1, pb, col('steel', 1))
    cv.vline(cx + 1, cy + ry - 1, pb - 1, col('steel', 4))
    # Rounded top-3/4 domed canopy with clean downward-fanning radial gores from crown apex
    apex_y = cy - ry * 0.85
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            dx = (x - cx) / max(rx, 1)
            dy = (y - cy) / max(ry, 1)
            d = dx * dx + dy * dy
            if d > 1.0:
                continue
            # Fan gores cleanly downward from crown apex (no horizontal mid-canopy split)
            fan = (x - cx) / max(2.2, (y - apex_y) * 1.15)
            gore = int(math.floor(fan * 2.2 + 0.5))
            rmp = ramp_a if (gore % 2 == 0) else ramp_b
            if d > 0.78:
                # Crisp dark dome outline & scalloped lower hem
                cv.p(x, y, col(rmp, 1))
            elif dy > 0.45:
                # Shaded lower canopy skirt
                cv.p(x, y, col(rmp, 2 if rmp == ramp_a else 3))
            elif dx + dy < -0.35:
                # Sunlit upper-left dome highlight
                cv.p(x, y, col(rmp, 5 if rmp == ramp_a else 6))
            elif dy < 0.15:
                cv.p(x, y, col(rmp, 4 if rmp == ramp_a else 5))
            else:
                cv.p(x, y, col(rmp, 3 if rmp == ramp_a else 4))
    # Crisp sunlit brass apex finial
    cv.p(cx, cy - ry + 1, col('yellow', 5))
    cv.p(cx, cy - ry + 2, col('steel', 2))


def draw_continuous_stair_flight(cv, x0, y0, x1, y1, stair_w=11, ramp='teal',
                                 top_rail_y0=None, bot_rail_y1=None, step_h=3):
    """Continuous painted-steel exterior staircase flight with unbroken diagonal stringers,
    crisp treads/risers, evenly-spaced balusters, and smooth continuous sloped handrails.
    """
    dy_total = max(1, y1 - y0)
    ry0 = top_rail_y0 if top_rail_y0 is not None else (y0 - 6)
    ry1 = bot_rail_y1 if bot_rail_y1 is not None else (y1 - 6)

    def x_at_t(t):
        return int(round(x0 + (x1 - x0) * t))

    def rail_y_at_t(t):
        return int(round(ry0 + (ry1 - ry0) * t))

    # 1. Soft cast shadow on wall behind stair carriage
    for y in range(y0, y1 + 3):
        t = max(0.0, min(1.0, (y - y0) / dy_total))
        sx = x_at_t(t)
        cv.shade_rect(sx + 1, y + 1, sx + stair_w + 1, y + 2, delta=-2)

    # 2. Continuous diagonal steel stringer beams on left & right sides (drawn per-pixel-row)
    for y in range(y0, y1 + 3):
        t = max(0.0, min(1.0, (y - y0) / dy_total))
        sx = x_at_t(t)
        # Left stringer (2px thick)
        cv.p(sx, y, col(ramp, 0))
        cv.p(sx + 1, y, col(ramp, 3))
        # Right stringer (2px thick)
        cv.p(sx + stair_w - 2, y, col(ramp, 3))
        cv.p(sx + stair_w - 1, y, col(ramp, 0))

    # 3. Crisp horizontal treads & risers nestled inside the continuous stringers
    steps = max(4, dy_total // step_h)
    for i in range(steps + 1):
        t = i / steps
        sx = x_at_t(t)
        sy = int(round(y0 + dy_total * t))
        cv.hline(sx + 1, sx + stair_w - 1, sy, col(ramp, 5))
        cv.hline(sx + 1, sx + stair_w - 1, sy + 1, col(ramp, 2))
        cv.hline(sx + 1, sx + stair_w - 1, sy + 2, col(ramp, 0))
        # Reinforce stringer edges cleanly at tread ends
        cv.p(sx, sy, col(ramp, 1))
        cv.p(sx + stair_w - 1, sy, col(ramp, 1))

    # 4. Vertical handrail balusters spaced cleanly from stringer up to continuous handrail
    for i in range(0, steps + 1, 2):
        t = i / steps
        sx = x_at_t(t)
        sy = int(round(y0 + dy_total * t))
        hy = rail_y_at_t(t)
        if hy < sy:
            cv.vline(sx, hy, sy + 1, col(ramp, 1))
            cv.vline(sx + stair_w - 1, hy, sy + 1, col(ramp, 1))
    # Always draw end newel posts cleanly
    cv.vline(x0, ry0, y0 + 2, col(ramp, 1))
    cv.vline(x0 + stair_w - 1, ry0, y0 + 2, col(ramp, 1))
    cv.vline(x1, ry1, y1 + 2, col(ramp, 1))
    cv.vline(x1 + stair_w - 1, ry1, y1 + 2, col(ramp, 1))

    # 5. Continuous unbroken sloped handrails on both sides (dense pixel sampling -> zero gaps/hooks!)
    samples = max(abs(x1 - x0), abs(ry1 - ry0), dy_total) * 2
    for s in range(samples + 1):
        t = s / max(1, samples)
        sx = x_at_t(t)
        hy = rail_y_at_t(t)
        # Left continuous handrail (sunlit top + dark underside)
        cv.p(sx, hy, col(ramp, 5))
        cv.p(sx, hy + 1, col(ramp, 1))
        # Right continuous handrail
        cv.p(sx + stair_w - 1, hy, col(ramp, 5))
        cv.p(sx + stair_w - 1, hy + 1, col(ramp, 1))


def draw_exterior_stair_run(cv, x0, y0, x1, y1, stair_w=10, ramp='teal', rail_h=8):
    """Crisp top-3/4 painted-steel exterior staircase flight from (x0,y0) down to (x1,y1)."""
    steps = max(4, abs(y1 - y0) // 3)
    for i in range(steps + 1):
        t = i / steps
        sx = int(round(x0 + (x1 - x0) * t))
        sy = int(round(y0 + (y1 - y0) * t))
        # Cast shadow on wall behind
        cv.shade_rect(sx + 1, sy + 2, sx + stair_w + 1, sy + 4, delta=-2)
        # Bright top tread + dark steel riser
        cv.hline(sx, sx + stair_w, sy, col(ramp, 5))
        cv.hline(sx, sx + stair_w, sy + 1, col(ramp, 2))
        cv.hline(sx, sx + stair_w, sy + 2, col(ramp, 0))
        # Side stringers
        cv.p(sx, sy, col(ramp, 1))
        cv.p(sx + stair_w - 1, sy, col(ramp, 1))
        # Outer handrail post & angled top rail
        if i % 2 == 0 or i in (0, steps):
            cv.vline(sx, sy - rail_h, sy + 1, col(ramp, 2))
            cv.vline(sx + stair_w - 1, sy - rail_h, sy + 1, col(ramp, 1))
        cv.hline(sx, sx + 2, sy - rail_h, col(ramp, 5))
        cv.hline(sx, sx + 2, sy - rail_h + 1, col(ramp, 1))
        cv.hline(sx + stair_w - 2, sx + stair_w, sy - rail_h, col(ramp, 4))


# ---------------------------------------------------------------------------
# BUILDING 1: mf-bldg-sig_wide_cafe_corner (144x128)
# Flagship 2.5F roastery cafe with massive full-width sunlit 2F cedar terrace
# ---------------------------------------------------------------------------

def build_sig_wide_cafe_corner():
    cv = Canvas(144, 128)

    # 2F Recessed Pavilion Pitched Slate Roof (y=4..30, x=18..126)
    draw_ribbed_roof(cv, 18, 4, 126, 30, ramp='kawara', moss=0.06, finials=True, seed=11)
    draw_chimney(cv, 26, 0, w=8, h=14, ramp='brick', smoke=True)
    # Central roof dormer skylight window
    draw_skylight(cv, 62, 11, 82, 24, frame='steel:1')
    cv.hline(61, 83, 10, col('kawara', 6))

    # 2F Recessed Pavilion Facade (y=30..54, x=20..124)
    draw_stucco_wall(cv, 20, 30, 124, 54, ramp='cream', base_i=5, seed=12, shadow_top=3)
    # Dark-timber architectural framing posts
    for px in (20, 21, 57, 86, 122, 123):
        cv.vline(px, 30, 54, col('darkwood', 2 if px in (20, 123) else 4))
    cv.hline(20, 124, 30, col('darkwood', 1))
    cv.hline(20, 124, 31, col('darkwood', 3))

    # TWO sets of deck-level French doors opening directly onto the 2F cedar terrace!
    draw_french_door(cv, 28, 34, 52, 54, frame='darkwood', warm=True, threshold=True)
    draw_french_door(cv, 92, 34, 116, 54, frame='darkwood', warm=True, threshold=True)

    # Center 2F arched cafe lounge window with hanging pendant lamps
    def cafe_2f_interior(c, ix0, iy0, ix1, iy1):
        # Hanging Edison bulbs
        for lx in (ix0 + 5, (ix0 + ix1) // 2, ix1 - 6):
            c.vline(lx, iy0, iy0 + 3, col('darkwood', 1))
            c.p(lx, iy0 + 3, col('yellow', 5))
            c.p(lx, iy0 + 4, col('white', 6))
        # Coffee bar shelf
        c.hline(ix0 + 1, ix1 - 1, iy1 - 4, col('wood', 2))
        for bx in range(ix0 + 2, ix1 - 2, 3):
            c.p(bx, iy1 - 5, col('red', 4) if bx % 2 == 0 else col('teal', 4))

    draw_arched_bay(cv, 60, 34, 84, 52, frame='darkwood:1', trim='stone:5', warm=True,
                    interior_fn=cafe_2f_interior, mullions=True, sill='cedar:5')
    # Brass wall sconces flanking French doors
    draw_lantern(cv, 24, 38, color='orange', glow=True)
    draw_lantern(cv, 54, 38, color='orange', glow=True)
    draw_lantern(cv, 89, 38, color='orange', glow=True)
    draw_lantern(cv, 119, 38, color='orange', glow=True)

    # MASSIVE FULL-WIDTH SUNLIT 2F CEDAR TERRACE DECK (y=54..84 -> 30px deep!)
    draw_walkable_terrace(cv, 4, 54, 140, 84, floor_style='wood', floor_ramp='floorwood',
                          rail_style='wood', rail_ramp='wood', rail_h=8, north_shadow=3,
                          left_return=True, right_return=True, pier_xs=[6, 48, 95, 137], seed=13)

    # Corner wood string-light poles on terrace wings
    for px in (7, 136):
        cv.vline(px, 38, 76, col('darkwood', 2))
        cv.vline(px + 1, 38, 76, col('wood', 4))
    draw_string_lights(cv, 8, 40, 28, 35, sag=3, step=5)
    draw_string_lights(cv, 116, 35, 136, 40, sag=3, step=5)
    draw_string_lights(cv, 52, 35, 92, 35, sag=4, step=6)

    # Grounded lush corner bushes seated visibly inside brick deck planters (zero hovering blobs!)
    cv.shade_rect(8, 60, 20, 62, delta=-2)
    cv.planter_box(8, 55, 19, 61, flower='yellow:5', pot_ramp='brick')
    cv.foliage_cluster(13, 54, 4, 3, ramp='foliage', seed=101, blossom='yellow:5')
    cv.outline_box(8, 57, 19, 61, col('brick', 4), col('brick', 1), top_hi=col('brick', 5))

    cv.shade_rect(125, 60, 137, 62, delta=-2)
    cv.planter_box(125, 55, 136, 61, flower='pink:4', pot_ramp='brick')
    cv.foliage_cluster(130, 54, 4, 3, ramp='foliage', seed=102, blossom='pink:4')
    cv.outline_box(125, 57, 136, 61, col('brick', 4), col('brick', 1), top_hi=col('brick', 5))

    cv.shade_rect(55, 74, 67, 76, delta=-2)
    cv.planter_box(55, 68, 66, 75, flower='yellow:5', pot_ramp='cedar')
    cv.shade_rect(78, 74, 90, 76, delta=-2)
    cv.planter_box(78, 68, 89, 75, flower='red:4', pot_ramp='cedar')

    # Three lively terrace bistro sets + sunlit green-striped patio umbrella; right table shifted 6px left for clear corner tree!
    draw_bistro_set(cv, 22, 66, table_ramp='white', chair_ramp='wood', items='coffee')
    draw_bistro_set(cv, 72, 61, table_ramp='cream', chair_ramp='darkwood', items='pastry', wide=True)
    draw_bistro_set(cv, 116, 66, table_ramp='white', chair_ramp='wood', items='coffee')
    draw_umbrella(cv, 21, 59, rx=9, ry=5, ramp_a='green', ramp_b='cream')
    draw_potted_tree(cv, 132, 75, trunk_h=3, rx=4, ry=4, leaf_ramp='foliage', pot_ramp='brick', blossom='yellow:5', seed=18)

    # 1F Slab Cornice + Corbel Brackets supporting the wide terrace
    draw_cornice(cv, 3, 84, 141, ramp='stone', h=3, dentils=True)
    for bx in range(10, 136, 14):
        cv.rect(bx, 87, bx + 3, 90, col('wood', 2))
        cv.vline(bx + 1, 87, 90, col('wood', 4))

    # 1F Warm Brick & Arched Dark-Steel Roastery Facade (y=87..127, x=4..140)
    cv.brick_wall(4, 87, 140, 124, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=14)
    # Ground stone plinth
    draw_ashlar_wall(cv, 4, 122, 140, 127, ramp='stone', base_i=3, course_h=3, block_w=10, seed=15)

    # Left 1F Arched Espresso Bar Bay (x=12..50, y=94..122)
    def espresso_interior(c, ix0, iy0, ix1, iy1):
        # Espresso counter & gleaming steel espresso machine
        c.rect(ix0, iy1 - 7, ix1, iy1, col('wood', 3))
        c.hline(ix0, ix1, iy1 - 7, col('cream', 5))
        c.rect(ix0 + 4, iy1 - 12, ix0 + 14, iy1 - 7, col('steel', 4))
        c.hline(ix0 + 4, ix0 + 14, iy1 - 12, col('coolwhite', 5))
        c.p(ix0 + 6, iy1 - 10, col('red', 4))
        c.p(ix0 + 9, iy1 - 10, col('yellow', 5))
        # Pastry glass dome
        c.rect(ix1 - 11, iy1 - 11, ix1 - 3, iy1 - 7, col('glass', 5))
        c.rect(ix1 - 10, iy1 - 9, ix1 - 4, iy1 - 7, col('orange', 4))
        # Warm pendant lights
        for px in (ix0 + 8, ix0 + 20, ix1 - 6):
            c.vline(px, iy0, iy0 + 3, col('steel', 1))
            c.p(px, iy0 + 3, col('yellow', 5))

    draw_arched_bay(cv, 12, 95, 50, 122, frame='steel:1', trim='stone:5', warm=True,
                    interior_fn=espresso_interior, mullions=True, sill='stone:5')
    cv.awning(10, 88, 52, 96, ramp_a='green', ramp_b='cream', stripe_w=4)

    # Right 1F Arched Roastery Drum & Window Bar Bay (x=94..132, y=94..122)
    def roaster_interior(c, ix0, iy0, ix1, iy1):
        # Coffee roaster drum silhouette & burlap sacks
        c.rect(ix0 + 3, iy1 - 12, ix0 + 14, iy1 - 2, col('steel', 2))
        c.rect(ix0 + 5, iy1 - 10, ix0 + 12, iy1 - 5, col('rooftile', 4))
        c.p(ix0 + 8, iy1 - 8, col('yellow', 5))
        # Burlap coffee bean sacks
        c.rect(ix1 - 13, iy1 - 7, ix1 - 8, iy1, col('straw', 4))
        c.rect(ix1 - 8, iy1 - 6, ix1 - 3, iy1, col('cedar', 4))
        c.hline(ix0, ix1, iy1 - 1, col('wood', 2))

    draw_arched_bay(cv, 94, 95, 132, 122, frame='steel:1', trim='stone:5', warm=True,
                    interior_fn=roaster_interior, mullions=True, sill='stone:5')
    cv.awning(92, 88, 134, 96, ramp_a='green', ramp_b='cream', stripe_w=4)

    # Center Flagship Entrance & ROASTERY Signboard (x=54..90)
    cv.outline_box(55, 88, 89, 97, col('darkwood', 2), col('darkwood', 0), top_hi=col('cedar', 5))
    draw_text_centered(cv, 'ROASTERY', 56, 88, 90, 'cream:6', shadow='ink:0', compact=True, spacing=1)
    draw_french_door(cv, 60, 99, 84, 125, frame='darkwood', warm=True, arched=False, threshold=True)
    # Stone entry steps
    cv.rect(58, 125, 86, 127, col('stone', 5))
    cv.hline(58, 86, 127 - 1, col('stone', 2))
    # Potted evergreens flanking entry
    draw_potted_tree(cv, 55, 125, trunk_h=3, rx=4, ry=4, leaf_ramp='foliage', pot_ramp='brick', seed=16)
    draw_potted_tree(cv, 89, 125, trunk_h=3, rx=4, ry=4, leaf_ramp='foliage', pot_ramp='brick', seed=17)

    cv.edge_finish(top_y=84)
    return cv


# ---------------------------------------------------------------------------
# BUILDING 2: mf-bldg-sig_pergola_garden_villa (128x112)
# Lush Mediterranean-modern 2F garden villa with sunlit cedar pergola & olive trees
# ---------------------------------------------------------------------------

def build_sig_pergola_garden_villa():
    cv = Canvas(128, 112)

    # Right Wing Pitched Clay-Tile Mediterranean Roof (x=62..124, y=6..30)
    draw_ribbed_roof(cv, 62, 6, 124, 30, ramp='rooftile', tile_w=4, course_h=4,
                     moss=0.03, finials=True, ridge_ramp='aka', seed=21)
    draw_chimney(cv, 108, 0, w=7, h=14, ramp='cream', smoke=False)

    # Right Wing 2F Warm Cream Stucco Villa Pavilion (x=64..122, y=30..51)
    draw_stucco_wall(cv, 64, 30, 122, 51, ramp='cream', base_i=5, seed=22, shadow_top=3)
    # Mediterranean shuttered window on right
    cv.window(102, 35, 114, 46, style='warm', frame='wood:1', sill='stone:5')
    # Teal wooden louvered shutters
    for sx in (98, 115):
        cv.rect(sx, 35, sx + 4, 46, col('teal', 3))
        for sy in range(36, 46, 2):
            cv.hline(sx + 1, sx + 3, sy, col('teal', 5))
        cv.vline(sx, 35, 46, col('teal', 1))
    cv.planter_box(100, 45, 116, 50, flower='pink:4', pot_ramp='brick')

    # Left Wing Clear Cream-Stucco Back Wall behind Pergola (x=8..64, y=28..51) with window + deck-level door!
    draw_stucco_wall(cv, 8, 30, 64, 51, ramp='cream', base_i=5, seed=23, shadow_top=3)
    # Terracotta coping cap along top of left back wall (seals behind pergola beams -> zero trapped sky holes)
    cv.rect(7, 25, 64, 30, col('rooftile', 3))
    cv.hline(7, 64, 25, col('rooftile', 5))
    cv.hline(7, 64, 29, col('rooftile', 1))
    # Shuttered Mediterranean window on left back wall
    cv.window(16, 35, 28, 46, style='warm', frame='wood:1', sill='stone:5')
    for sx in (12, 29):
        cv.rect(sx, 35, sx + 4, 46, col('teal', 3))
        for sy in range(36, 46, 2):
            cv.hline(sx + 1, sx + 3, sy, col('teal', 5))
        cv.vline(sx, 35, 46, col('teal', 1))

    # UNIFIED FULL-WIDTH SHALLOW HORIZONTAL TOP-3/4 TERRACE DECK (x=6..122, y=51..76 across BOTH halves!)
    # Warm 3px foreshortened horizontal cedar planks with open vertical iron balusters & stone corner returns
    draw_walkable_terrace(cv, 6, 51, 122, 76, floor_style='wood', floor_ramp='floorwood',
                          rail_style='open_balusters', rail_ramp='stone', rail_h=7, north_shadow=2,
                          left_return=True, right_return=True, pier_xs=[8, 61, 92, 120], seed=24)
    # Crisp 2px dark cast shadow along entire cream-stucco back-wall base (y=51..52)
    cv.shade_rect(8, 51, 120, 52, delta=-2)
    cv.shade_rect(8, 52, 120, 53, delta=-1)
    # Terracotta inlay border strip along inner terrace front edge
    cv.hline(10, 118, 67, col('rooftile', 4))
    # Subtle pergola sun-slat shadow stripes cast across left terrace planks
    for bx in range(15, 58, 9):
        cv.shade_rect(bx, 53, bx + 3, 67, delta=-1)

    # TWO Deck-Level Arched French Doors cleanly reaching the unified 2F terrace deck (y=51) with bright thresholds!
    draw_french_door(cv, 37, 34, 54, 51, frame='wood', warm=True, arched=True, threshold=True)
    draw_french_door(cv, 70, 33, 90, 51, frame='wood', warm=True, arched=True, threshold=True)

    # Grounded terrace furnishings (zero collision with columns or doors, crisp cast shadows!)
    # Potted olive tree cleanly grounded in back-left pergola corner
    draw_potted_tree(cv, 16, 61, trunk_h=4, rx=5, ry=4, leaf_ramp='midori', pot_ramp='brick', blossom='cream:5', seed=26)
    # Left pergola bistro table & right open-deck bistro table
    draw_bistro_set(cv, 36, 59, table_ramp='cream', chair_ramp='cedar', items='tea')
    draw_bistro_set(cv, 94, 59, table_ramp='white', chair_ramp='cedar', items='coffee')
    # Grounded front rail terracotta flowerboxes clear of columns & tables
    cv.shade_rect(12, 68, 24, 70, delta=-2)
    cv.planter_box(12, 63, 23, 69, flower='pink:4', pot_ramp='brick')
    cv.shade_rect(107, 68, 119, 70, delta=-2)
    cv.planter_box(107, 63, 118, 69, flower='red:4', pot_ramp='brick')

    # SUNLIT CEDAR PERGOLA OVER LEFT TERRACE (x=7..63, y=21..69)
    # Two outer cedar columns aligned EXACTLY to front-rail stone piers (px=8 & px=61 -> zero slicing through tables!)
    for px in (7, 60):
        cv.rect(px, 24, px + 3, 69, col('cedar', 4))
        cv.vline(px, 24, 69, col('wood', 1))
        cv.vline(px + 1, 24, 69, col('cedar', 6))
        cv.vline(px + 2, 24, 69, col('wood', 2))
        # Cast shadow beside column base
        cv.shade_rect(px + 3, 53, px + 5, 69, delta=-1)
    # Overhead cedar header beams & foreshortened slatted rafters (y=21..30)
    cv.rect(6, 23, 64, 26, col('cedar', 5))
    cv.hline(6, 64, 23, col('cedar', 6))
    cv.hline(6, 64, 25, col('wood', 1))
    cv.rect(6, 28, 64, 31, col('cedar', 4))
    cv.hline(6, 64, 28, col('cedar', 6))
    cv.hline(6, 64, 30, col('wood', 1))
    for rx in range(8, 63, 7):
        cv.rect(rx, 21, rx + 3, 31, col('cedar', 5))
        cv.vline(rx, 21, 31, col('wood', 1))
        cv.vline(rx + 1, 21, 31, col('cedar', 6))
        cv.vline(rx + 2, 21, 31, col('cedar', 3))
    # Organic woven ivy & bougainvillea vines hugging the top pergola beams (natural continuous draping, NOT 3 round boulders!)
    for vx, vy, vrx, vry, vs, bl in [
        (11, 22, 5, 3, 271, 'pink:4'),
        (19, 23, 6, 2, 272, 'pink:5'),
        (28, 22, 5, 2, 273, None),
        (37, 23, 7, 3, 274, 'pink:4'),
        (47, 22, 5, 2, 275, 'yellow:5'),
        (56, 23, 6, 3, 276, 'pink:5'),
    ]:
        cv.foliage_cluster(vx, vy, vrx, vry, ramp='foliage', seed=vs, blossom=bl)
    # Let select golden cedar rafter tips peek through along front beam for natural woven depth
    for rx in (15, 29, 43, 57):
        cv.vline(rx + 1, 27, 30, col('cedar', 6))
        cv.p(rx, 29, col('wood', 1))
    # Delicate tapered hanging ivy tendrils draping naturally from front pergola fascia
    for vx, vlen in ((13, 5), (33, 4), (52, 5)):
        for dy in range(vlen):
            cv.p(vx + (dy % 2), 31 + dy, col('foliage', 4 if dy % 2 == 0 else 2))
            if dy < 2:
                cv.p(vx - 1 + (dy % 2), 31 + dy, col('foliage', 3))
    # Warm glowing string lights draping cleanly from pergola beam across to right wing!
    draw_string_lights(cv, 10, 31, 60, 31, sag=3, step=6)
    draw_string_lights(cv, 62, 31, 96, 33, sag=4, step=6)

    # 1F Warm Cream Stone Villa Base (y=76..111, x=6..122)
    draw_cornice(cv, 5, 75, 123, ramp='cream', h=3, dentils=True)
    draw_ashlar_wall(cv, 6, 78, 122, 108, ramp='cream', base_i=4, course_h=5, block_w=10, seed=30)
    draw_ashlar_wall(cv, 6, 106, 122, 111, ramp='stone', base_i=4, course_h=3, block_w=9, seed=31)
    draw_quoins(cv, 6, 78, 122, 106, ramp='kinari', qw=3, qh=4)

    # Center Arched Timber Entrance Portal (x=50..78, y=82..111)
    # Stone arch surround
    draw_arched_bay(cv, 50, 81, 78, 110, frame='wood:1', trim='stone:6', warm=True, mullions=False, sill=None)
    # Recessed double arched timber door inside portal
    draw_french_door(cv, 53, 86, 75, 109, frame='wood', warm=True, arched=True, threshold=True)
    cv.rect(48, 109, 80, 111, col('stone', 5))
    draw_lantern(cv, 46, 88, color='orange', glow=True)
    draw_lantern(cv, 81, 88, color='orange', glow=True)

    # Left & Right 1F Arched Mediterranean Windows with teal shutters
    draw_arched_bay(cv, 20, 83, 40, 103, frame='wood:1', trim='stone:5', warm=True, mullions=True, sill='stone:5')
    draw_arched_bay(cv, 88, 83, 108, 103, frame='wood:1', trim='stone:5', warm=True, mullions=True, sill='stone:5')
    cv.planter_box(21, 101, 39, 106, flower='red:4', pot_ramp='brick')
    cv.planter_box(89, 101, 107, 106, flower='yellow:5', pot_ramp='brick')

    # Iconic Olive Trees flanking the 1F entrance (silvery midori + foliage blend!)
    draw_potted_tree(cv, 10, 110, trunk_h=9, rx=8, ry=8, leaf_ramp='midori', pot_ramp='brick', blossom='cream:5', seed=32)
    draw_potted_tree(cv, 118, 110, trunk_h=9, rx=8, ry=8, leaf_ramp='midori', pot_ramp='brick', blossom='cream:5', seed=33)

    cv.edge_finish(top_y=76)
    return cv


# ---------------------------------------------------------------------------
# BUILDING 3: mf-bldg-sig_extstair_bookstore (112x128)
# Picturesque 3F indie bookshop & tea studio with zigzagging external steel staircase
# ---------------------------------------------------------------------------

def build_sig_extstair_bookstore():
    cv = Canvas(112, 128)

    # 3F Pitched Kawara Roof & Skylight (x=22..108, y=4..24)
    draw_ribbed_roof(cv, 22, 4, 108, 24, ramp='kawara', moss=0.07, finials=True, seed=31)
    draw_chimney(cv, 92, 0, w=7, h=12, ramp='brick', smoke=True)
    draw_skylight(cv, 64, 9, 82, 19, frame='steel:1')

    # 3F Warm Tea Studio Attic (x=24..106, y=24..42)
    draw_stucco_wall(cv, 24, 24, 106, 42, ramp='cream', base_i=5, seed=32, shadow_top=2)
    for px in (24, 62, 105):
        cv.vline(px, 24, 42, col('darkwood', 2))
    # Studio bay window with warm books & hanging tea scroll
    cv.window(30, 27, 56, 39, style='warm', frame='darkwood:1', sill='wood:4')
    cv.rect(35, 34, 51, 38, col('wood', 3))  # Book table inside
    cv.p(40, 33, col('teal', 4))
    cv.p(45, 33, col('red', 4))
    # Right studio arched window with paper lantern
    draw_arched_bay(cv, 68, 26, 98, 39, frame='darkwood:1', trim='cedar:5', warm=True, mullions=True, sill='wood:4')
    draw_lantern(cv, 62, 28, color='red', glow=True)

    # 2F Recessed Tea-Book Lounge Wall behind Wide Reading Veranda (x=24..106, y=42..58)
    draw_cornice(cv, 23, 41, 107, ramp='wood', h=2)
    cv.siding_wall(24, 43, 106, 58, ramp='cedar', base_i=4, horizontal=True, step=3, seed=33)
    # Recessed dark-timber bay shadow on left side under 3F corner (x=24..32 -> grounded, ZERO alpha pocket!)
    cv.shade_rect(24, 43, 32, 58, delta=-1)
    cv.vline(24, 43, 58, col('darkwood', 1))
    cv.vline(25, 43, 58, col('wood', 4))
    cv.vline(32, 43, 58, col('darkwood', 2))
    # Deck-level wooden French doors opening straight onto the 2F reading veranda!
    draw_french_door(cv, 38, 44, 58, 58, frame='darkwood', warm=True, threshold=True)
    # Cozy backlit 2F book-bar window
    cv.window(64, 45, 98, 56, style='warm', frame='darkwood:1', sill='cedar:5')
    # Bookshelves visible inside 2F window
    for bx in range(67, 95, 3):
        bc = ['red:4', 'blue:4', 'yellow:4', 'green:4', 'teal:4'][bx % 5]
        cv.vline(bx, 49, 54, bc)
    draw_lantern(cv, 35, 46, color='orange', glow=True)
    draw_lantern(cv, 101, 46, color='orange', glow=True)

    # WIDE 2F WOODEN READING VERANDA (x=6..108, y=58..82 -> 24px deep! Opening on left for stair!)
    # Structural back parapet wall on left terrace wing + grounded corner lantern post (zero enclosed sky holes!)
    cv.rect(6, 53, 25, 58, col('wood', 3))
    cv.hline(6, 25, 53, col('cedar', 6))
    cv.hline(6, 25, 57, col('wood', 1))
    cv.vline(7, 48, 58, col('darkwood', 1))
    cv.vline(8, 48, 58, col('wood', 4))
    draw_lantern(cv, 7, 46, color='orange', glow=True)

    draw_walkable_terrace(cv, 6, 58, 108, 82, floor_style='wood', floor_ramp='floorwood',
                          rail_style='wood', rail_ramp='wood', rail_h=7,
                          gap_x=(12, 26), north_shadow=3,
                          left_return=True, right_return=True, pier_xs=[10, 27, 68, 106], seed=34)

    # Reading veranda furnishings: wooden benches, tea table with steaming teapot, potted maple/fern!
    # Wooden reading bench with stacked books & grounded shadow
    cv.shade_rect(62, 68, 83, 70, delta=-2)
    cv.rect(62, 62, 82, 69, col('cedar', 5))
    cv.hline(62, 82, 62, col('cedar', 6))
    cv.hline(62, 82, 65, col('wood', 2))
    cv.hline(62, 82, 68, col('wood', 1))
    cv.rect(65, 63, 70, 65, col('blue', 4))  # Open book on bench
    cv.rect(71, 63, 75, 65, col('red', 4))
    draw_bistro_set(cv, 46, 65, table_ramp='cedar', chair_ramp='wood', items='tea')
    draw_potted_tree(cv, 96, 73, trunk_h=4, rx=5, ry=5, leaf_ramp='foliage', pot_ramp='brick', seed=35)
    cv.shade_rect(76, 75, 89, 77, delta=-2)
    cv.planter_box(76, 71, 88, 76, flower='yellow:5', pot_ramp='brick')
    # String lights draped cleanly across the 2F facade eaves (no enclosed alpha hole over empty sky!)
    draw_string_lights(cv, 26, 44, 62, 44, sag=3, step=6)
    draw_string_lights(cv, 62, 44, 104, 44, sag=3, step=6)

    # 1F Glowing Book-Lined Storefront (x=24..106, y=82..127)
    draw_cornice(cv, 6, 82, 108, ramp='wood', h=3, dentils=True)
    # Dark brick stair backdrop on left (x=8..26) so stair silhouette pops cleanly & fill stays high
    cv.brick_wall(8, 85, 28, 127, ramp='brick', base_i=3, course_h=3, brick_w=5, seed=36)
    cv.brick_wall(28, 85, 106, 127, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=37)
    cv.rect(8, 123, 106, 127, col('stone', 3))

    # Crisp Indie Bookshop Signboard
    cv.outline_box(34, 86, 102, 95, col('teal', 2), col('teal', 0), top_hi=col('teal', 4))
    draw_text_centered(cv, 'BOOKS & TEA', 35, 101, 88, 'cream:6', shadow='ink:0', compact=True, spacing=1)

    # Left & Right 1F Book-Lined Storefront Windows
    for wx0, wx1 in ((34, 58), (78, 102)):
        cv.outline_box(wx0, 97, wx1, 122, col('orange', 4), col('darkwood', 1), top_hi=col('yellow', 5))
        # Multi-shelf rows of colorful books!
        for sy in (103, 110, 117):
            cv.hline(wx0 + 1, wx1 - 1, sy, col('wood', 2))
            for bx in range(wx0 + 2, wx1 - 2, 2):
                bc = ['red:4', 'blue:4', 'yellow:5', 'green:4', 'pink:4', 'teal:4', 'cream:5'][(bx + sy) % 7]
                bh = 3 + ((bx * 3 + sy) % 3)
                cv.vline(bx, sy - bh, sy, bc)
        # Warm window glow bars & mullions
        cv.vline((wx0 + wx1) // 2, 98, 121, col('darkwood', 1))
        cv.hline(wx0 - 1, wx1 + 1, 122, col('stone', 5))

    # 1F Wooden Bookshop Door (x=60..76)
    cv.door_wood(60, 98, 76, 125, ramp='wood', glass_top=True)
    cv.rect(58, 125, 78, 127, col('stone', 5))
    # Outdoor book crate on right
    cv.outline_box(92, 118, 104, 126, col('cedar', 4), col('wood', 1), top_hi=col('cedar', 6))
    for bx in range(94, 102, 2):
        cv.vline(bx, 116, 119, ['red:4', 'yellow:5', 'blue:4', 'teal:4'][bx % 4])

    # ICONIC EXTERNAL PAINTED-STEEL ZIGZAG STAIRCASE on front-left facade!
    # Continuous teal stringers & handrails joining smoothly into flanking 2F wooden railing posts (y=75, x=11..26)!
    # Upper flight: from 2F veranda stair threshold (x=12, y=76) down-right to mid-landing (x=21, y=98)
    draw_continuous_stair_flight(cv, 12, 76, 21, 98, stair_w=14, ramp='teal',
                                 top_rail_y0=75, bot_rail_y1=91, step_h=3)
    # Cleanly tie teal upper handrails into flanking 2F wooden newel posts at x=10..12 and x=25..28
    cv.hline(11, 13, 75, col('teal', 5))
    cv.hline(11, 13, 76, col('teal', 1))
    cv.hline(25, 27, 75, col('teal', 5))
    cv.hline(25, 27, 76, col('teal', 1))
    # Mid-landing platform (x=19..35, y=98..103) with continuous steel rail & vertical support column
    cv.outline_box(19, 98, 35, 103, col('teal', 4), col('teal', 0), top_hi=col('teal', 5))
    cv.vline(20, 91, 103, col('teal', 1))
    cv.vline(34, 91, 103, col('teal', 1))
    cv.hline(20, 35, 91, col('teal', 5))
    cv.hline(20, 35, 92, col('teal', 1))
    # Vertical steel support column anchoring mid-landing to pavement
    cv.rect(32, 103, 34, 127, col('teal', 1))
    cv.vline(32, 103, 127, col('teal', 4))
    # Lower flight: zigzagging down-left from mid-landing (x=20, y=102) to street (x=8, y=124), flush over solid brick!
    draw_continuous_stair_flight(cv, 20, 102, 8, 124, stair_w=12, ramp='teal',
                                 top_rail_y0=95, bot_rail_y1=117, step_h=3)
    # Tie lower flight top handrail smoothly up into mid-landing rail
    cv.vline(20, 91, 97, col('teal', 1))
    cv.vline(31, 91, 97, col('teal', 1))

    cv.edge_finish(top_y=84)
    return cv


# ---------------------------------------------------------------------------
# BUILDING 4: mf-bldg-sig_3tier_stepped_terrace (144x144)
# Dramatic architectural 3-tier ziggurat stepped-terrace building!
# ---------------------------------------------------------------------------

def build_sig_3tier_stepped_terrace():
    cv = Canvas(144, 144)

    # ===== TIER 3: GLASS PENTHOUSE PAVILION & SKY GARDEN TERRACE (y=1..54) =====
    # Deepened sleek recessed flat penthouse roof (x=40..104, y=1..15 -> visible sunlit deck + parapet + inner shadows!)
    cv.flat_roof(40, 1, 104, 15, deck_ramp='concrete', deck_i=5, para_ramp='steel', seed=41)
    # Reinforce crisp north & left inner parapet cast shadows on the recessed sunlit roof deck (y=4..10)
    cv.hline(42, 102, 4, col('concrete', 2))
    cv.hline(42, 102, 5, col('concrete', 3))
    cv.vline(42, 4, 11, col('concrete', 3))
    cv.vline(43, 4, 11, col('concrete', 4))
    # Compact central roof skylight leaving generous sunlit recessed roof deck on both sides
    draw_skylight(cv, 58, 5, 86, 10, frame='steel:1')

    # Glass Penthouse Pavilion Wall (x=46..98, y=15..32)
    cv.rect(46, 15, 98, 32, col('steel', 2))
    # Wrap-around backlit amber glass curtain wall
    cv.window(48, 17, 62, 30, style='warm', frame='steel:1', sill=None)
    cv.window(82, 17, 96, 30, style='warm', frame='steel:1', sill=None)
    # Cast shadow under cantilevered penthouse flat roof overhang + warm interior pendants
    cv.shade_rect(46, 15, 98, 17, delta=-1)
    for lx in (55, 72, 89):
        cv.vline(lx, 17, 19, col('steel', 1))
        cv.p(lx, 19, col('yellow', 5))
    # Diagonal bright sky reflection accents on glass penthouse
    for x in range(49, 61, 4):
        cv.p(x, 18, col('glass', 6))
        cv.p(x + 1, 19, col('glass', 5))
    for x in range(83, 95, 4):
        cv.p(x, 18, col('glass', 6))
        cv.p(x + 1, 19, col('glass', 5))

    # Low back parapet coping on left/right 3F terrace wings
    for wx0, wx1 in ((24, 46), (98, 120)):
        cv.rect(wx0, 28, wx1, 31, col('stone', 4))
        cv.hline(wx0, wx1, 28, col('stone', 6))
        cv.hline(wx0, wx1, 30, col('stone', 1))

    # 3F Sky Garden Terrace Deck (x=24..120, y=30..54 -> foreshortened 3px horizontal stone pavers + 2px penthouse cast shadow!)
    draw_walkable_terrace(cv, 24, 30, 120, 54, floor_style='flagstone', floor_ramp='cream',
                          rail_style='glass', rail_ramp='steel', rail_h=7, north_shadow=2,
                          left_return=True, right_return=True, pier_xs=[26, 56, 88, 118], seed=42)
    # Crisp 2px dark cast shadow along 3F penthouse base (y=30..31)
    cv.hline(46, 98, 30, col('cream', 1))
    cv.hline(46, 98, 31, col('cream', 2))
    # Deck-level penthouse French door seated cleanly onto 3F terrace with sunlit threshold
    draw_french_door(cv, 64, 16, 80, 31, frame='steel', warm=True, threshold=True)

    # Lush sky garden trees & trimmed hedges on both wings of Tier 3 with crisp grounded cast shadows!
    draw_potted_tree(cv, 33, 45, trunk_h=4, rx=6, ry=6, leaf_ramp='foliage', pot_ramp='stone', blossom='pink:4', seed=43)
    draw_potted_tree(cv, 111, 45, trunk_h=4, rx=6, ry=6, leaf_ramp='foliage', pot_ramp='stone', blossom='yellow:5', seed=44)
    cv.shade_rect(42, 46, 55, 48, delta=-2)
    cv.planter_box(42, 40, 54, 46, flower='yellow:5', pot_ramp='stone')
    cv.shade_rect(90, 46, 103, 48, delta=-2)
    cv.planter_box(90, 40, 102, 46, flower='pink:4', pot_ramp='stone')
    # Sky garden wooden bench facing view with legs & crisp grounded cast shadow
    cv.shade_rect(65, 44, 80, 46, delta=-2)
    cv.rect(66, 43, 68, 45, col('wood', 1))
    cv.rect(76, 43, 78, 45, col('wood', 1))
    cv.rect(65, 39, 79, 44, col('cedar', 5))
    cv.hline(65, 79, 39, col('cedar', 6))
    cv.hline(65, 79, 41, col('wood', 3))
    cv.hline(65, 79, 43, col('wood', 1))

    # ===== TIER 2: STEPPED-BACK OAK TERRACE, PARASOLS & HEDGES (y=54..98) =====
    draw_cornice(cv, 22, 54, 122, ramp='stone', h=3, dentils=True)
    # Recessed 2F Limestone Gallery Facade (x=24..120, y=57..72)
    draw_ashlar_wall(cv, 24, 57, 120, 72, ramp='cream', base_i=4, course_h=4, block_w=10, seed=45)

    # Broad Sunlit 2F Oak Terrace Deck (x=12..132, y=72..98 -> 26px deep!)
    draw_walkable_terrace(cv, 12, 72, 132, 98, floor_style='wood', floor_ramp='floorwood',
                          rail_style='glass', rail_ramp='steel', rail_h=7, north_shadow=3,
                          left_return=True, right_return=True, pier_xs=[14, 46, 98, 130], seed=46)
    # THREE clear full-height deck-level French doors reaching directly onto the 2F oak deck (y=72) with thresholds!
    draw_french_door(cv, 32, 57, 52, 72, frame='steel', warm=True, threshold=True)
    draw_french_door(cv, 60, 56, 84, 72, frame='steel', warm=True, threshold=True)
    draw_french_door(cv, 92, 57, 112, 72, frame='steel', warm=True, threshold=True)
    # Manicured green terrace hedges on both sides with grounded shadow
    cv.shade_rect(15, 88, 28, 90, delta=-2)
    cv.planter_box(15, 75, 27, 89, flower='foliage:6', pot_ramp='stone')
    cv.shade_rect(117, 88, 130, 90, delta=-2)
    cv.planter_box(117, 75, 129, 89, flower='foliage:6', pot_ramp='stone')
    # Bistro tables + TWO clean rounded domed patio parasols!
    draw_bistro_set(cv, 38, 82, table_ramp='white', chair_ramp='wood', items='coffee')
    draw_bistro_set(cv, 72, 81, table_ramp='cream', chair_ramp='wood', items='pastry', wide=True)
    draw_bistro_set(cv, 106, 82, table_ramp='white', chair_ramp='wood', items='coffee')
    draw_domed_umbrella(cv, 36, 75, rx=9, ry=5, ramp_a='rooftile', ramp_b='cream', pole_bottom=83)
    draw_domed_umbrella(cv, 108, 75, rx=9, ry=5, ramp_a='teal', ramp_b='cream', pole_bottom=83)
    draw_string_lights(cv, 26, 59, 59, 59, sag=3, step=6)
    draw_string_lights(cv, 85, 59, 118, 59, sag=3, step=6)

    # ===== TIER 1: WIDE STONE & GLASS GALLERY/CAFE BASE (y=98..143, x=4..140) =====
    draw_cornice(cv, 3, 98, 141, ramp='stone', h=4, dentils=True)
    draw_ashlar_wall(cv, 4, 102, 140, 140, ramp='stone', base_i=4, course_h=5, block_w=12, seed=47)
    draw_ashlar_wall(cv, 4, 139, 140, 143, ramp='pavement', base_i=3, course_h=3, block_w=10, seed=48)
    draw_quoins(cv, 4, 102, 140, 139, ramp='cream', qw=4, qh=5)

    # Left 1F Art Gallery Glass Bay (x=12..52, y=106..138)
    def gallery_1f_interior(c, ix0, iy0, ix1, iy1):
        c.rect(ix0 + 3, iy0 + 4, ix0 + 13, iy0 + 15, col('teal', 4))
        c.rect(ix0 + 5, iy0 + 6, ix0 + 11, iy0 + 13, col('yellow', 5))
        c.rect(ix0 + 18, iy0 + 5, ix0 + 27, iy0 + 15, col('red', 4))
        c.rect(ix0 + 20, iy0 + 7, ix0 + 25, iy0 + 13, col('cream', 6))
        # Pedestal sculpture
        c.rect(ix1 - 8, iy1 - 10, ix1 - 3, iy1, col('white', 5))
        c.rect(ix1 - 7, iy1 - 15, ix1 - 4, iy1 - 10, col('orange', 4))

    draw_arched_bay(cv, 12, 107, 52, 138, frame='steel:1', trim='cream:6', warm=True,
                    interior_fn=gallery_1f_interior, mullions=True, sill='stone:6')

    # Right 1F Modern Cafe Bay (x=92..132, y=106..138)
    def cafe_1f_interior(c, ix0, iy0, ix1, iy1):
        c.rect(ix0, iy1 - 8, ix1, iy1, col('wood', 3))
        c.hline(ix0, ix1, iy1 - 8, col('cream', 6))
        for cx in range(ix0 + 4, ix1 - 4, 8):
            c.rect(cx, iy1 - 12, cx + 4, iy1 - 8, col('steel', 4))
            c.p(cx + 1, iy1 - 10, col('yellow', 5))
        for lx in (ix0 + 7, ix0 + 18, ix0 + 29):
            c.vline(lx, iy0, iy0 + 4, col('steel', 1))
            c.p(lx, iy0 + 4, col('yellow', 5))

    draw_arched_bay(cv, 92, 107, 132, 138, frame='steel:1', trim='cream:6', warm=True,
                    interior_fn=cafe_1f_interior, mullions=True, sill='stone:6')

    # Grand Recessed Central Entrance Portico & Signboard (x=56..88)
    cv.outline_box(56, 104, 88, 113, col('steel', 1), col('ink', 0), top_hi=col('steel', 4))
    draw_text_centered(cv, 'GALLERY', 57, 87, 106, 'cream:6', shadow='ink:0', compact=True, spacing=1)
    cv.door_glass(60, 115, 84, 140, frame='steel:2', warm=True)
    # Broad entry steps + flanking potted evergreens
    cv.rect(56, 140, 88, 143, col('cream', 5))
    cv.hline(56, 88, 141, col('stone', 3))
    draw_potted_tree(cv, 55, 142, trunk_h=3, rx=4, ry=4, leaf_ramp='foliage', pot_ramp='stone', seed=49)
    draw_potted_tree(cv, 89, 142, trunk_h=3, rx=4, ry=4, leaf_ramp='foliage', pot_ramp='stone', seed=50)
    cv.planter_box(12, 137, 26, 143, flower='pink:4', pot_ramp='stone')
    cv.planter_box(118, 137, 132, 143, flower='yellow:5', pot_ramp='stone')

    cv.edge_finish(top_y=98)
    return cv


# ---------------------------------------------------------------------------
# BUILDING 5: mf-bldg-sig_canal_bridge_shop (128x112)
# Scenic waterfront 2F canal-side tea & pastry house with cantilevered timber veranda
# ---------------------------------------------------------------------------

def build_sig_canal_bridge_shop():
    cv = Canvas(128, 112)

    # Twin-Pitched Dark-Teal Tiled Roofs (x=8..64 and x=64..120, y=4..28)
    draw_ribbed_roof(cv, 8, 4, 65, 28, ramp='midori', tile_w=4, course_h=4,
                     moss=0.05, finials=True, ridge_ramp='teal', seed=51)
    draw_ribbed_roof(cv, 63, 4, 120, 28, ramp='midori', tile_w=4, course_h=4,
                     moss=0.05, finials=True, ridge_ramp='teal', seed=52)
    # Subtle shadowed valley seam between twin roofs
    cv.vline(64, 5, 28, col('midori', 0))
    cv.vline(63, 5, 28, col('midori', 1))
    draw_chimney(cv, 20, 0, w=7, h=12, ramp='brick', smoke=True)

    # 2F Waterfront Tea & Pastry Upper Wall (x=12..116, y=28..48)
    draw_stucco_wall(cv, 12, 28, 116, 48, ramp='cream', base_i=5, seed=53, shadow_top=3)
    for px in (12, 13, 46, 81, 114, 115):
        cv.vline(px, 28, 48, col('darkwood', 2))
    # TWO deck-level timber French doors opening directly onto the cantilevered veranda!
    draw_french_door(cv, 20, 31, 42, 48, frame='wood', warm=True, threshold=True)
    draw_french_door(cv, 86, 31, 108, 48, frame='wood', warm=True, threshold=True)
    # Center lattice tea-house window
    cv.window(50, 32, 78, 46, style='warm', frame='darkwood:1', sill='wood:4')
    for gx in range(54, 76, 4):
        cv.vline(gx, 33, 45, col('wood', 2))
    # Hanging red & golden lanterns under eaves
    for lx in (17, 45, 64, 83, 111):
        draw_lantern(cv, lx, 31, color='red' if lx in (17, 64, 111) else 'orange', glow=True)

    # PROJECTING CANTILEVERED TIMBER VERANDA BALCONY (x=2..126, y=48..76 -> 28px deep, overhangs 1F!)
    draw_walkable_terrace(cv, 2, 48, 126, 76, floor_style='wood', floor_ramp='floorwood',
                          rail_style='wood', rail_ramp='wood', rail_h=8, north_shadow=3,
                          left_return=True, right_return=True, pier_xs=[4, 42, 86, 124], seed=54)

    # Steaming tea & pastry tables on cantilevered veranda!
    draw_bistro_set(cv, 32, 57, table_ramp='cream', chair_ramp='darkwood', items='tea')
    draw_bistro_set(cv, 64, 56, table_ramp='white', chair_ramp='wood', items='pastry', wide=True)
    draw_bistro_set(cv, 96, 57, table_ramp='cream', chair_ramp='darkwood', items='tea')

    # Overflowing flower troughs along the cantilevered veranda front balustrade!
    cv.planter_box(8, 66, 26, 73, flower='pink:4', pot_ramp='brick')
    cv.planter_box(48, 66, 62, 73, flower='yellow:5', pot_ramp='brick')
    cv.planter_box(66, 66, 80, 73, flower='red:4', pot_ramp='brick')
    cv.planter_box(102, 66, 120, 73, flower='pink:5', pot_ramp='brick')

    # 1F ARCHED STONE WATERFRONT PORTICO (x=8..120, y=76..111)
    # Heavy cantilevered timber beam soffit & bold outer diagonal wooden braces!
    cv.rect(3, 76, 125, 79, col('darkwood', 2))
    cv.hline(3, 125, 76, col('wood', 4))
    cv.hline(3, 125, 78, col('ink', 0))
    # Stone ashlar lower portico masonry
    draw_ashlar_wall(cv, 8, 79, 120, 108, ramp='stone', base_i=4, course_h=5, block_w=10, seed=55)
    # Deep cast overhang shadow from cantilevered veranda
    cv.shade_rect(8, 79, 120, 83, delta=-2)
    # Outer cantilevered diagonal timber knee braces visibly angling inward to the stone corners!
    for i in range(6):
        cv.rect(4 + i, 79 + i, 8 + i, 81 + i, col('wood', 3))
        cv.p(4 + i, 79 + i, col('wood', 1))
        cv.rect(120 - i, 79 + i, 124 - i, 81 + i, col('wood', 2))
        cv.p(123 - i, 79 + i, col('wood', 0))
    # Interior corbel brackets bolted to stone piers
    for bx in (44, 80):
        cv.rect(bx, 78, bx + 4, 84, col('wood', 2))
        cv.vline(bx + 1, 78, 84, col('wood', 4))
        cv.rect(bx + 1, 84, bx + 3, 86, col('darkwood', 1))

    # Three graceful stone waterfront arches!
    def pastry_arch_interior(c, ix0, iy0, ix1, iy1):
        c.rect(ix0, iy1 - 7, ix1, iy1, col('wood', 3))
        c.hline(ix0, ix1, iy1 - 7, col('cream', 6))
        for px in range(ix0 + 2, ix1 - 2, 4):
            c.rect(px, iy1 - 10, px + 3, iy1 - 7, col('orange', 4) if px % 2 == 0 else col('pink', 4))
        draw_lantern(c, (ix0 + ix1) // 2, iy0 + 2, color='orange', glow=True)

    draw_arched_bay(cv, 14, 84, 44, 108, frame='stone:1', trim='cream:5', warm=True,
                    interior_fn=pastry_arch_interior, mullions=True, sill='stone:5')
    draw_arched_bay(cv, 84, 84, 114, 108, frame='stone:1', trim='cream:5', warm=True,
                    interior_fn=pastry_arch_interior, mullions=True, sill='stone:5')

    # Center Arched Waterfront Tea House Entrance & spacious crisp TEA HOUSE Signboard
    draw_arched_bay(cv, 48, 83, 80, 109, frame='darkwood:1', trim='cream:6', warm=True, mullions=False, sill=None)
    cv.outline_box(46, 80, 82, 89, col('teal', 2), col('teal', 0), top_hi=col('teal', 4))
    draw_text_centered(cv, 'TEA CAFE', 47, 81, 82, 'cream:6', shadow='ink:0', compact=True, spacing=1)
    draw_french_door(cv, 54, 90, 74, 109, frame='wood', warm=True, threshold=True)
    # Waterfront stone plinth & mooring/canal steps at base (with subtle damp moss accents)
    draw_ashlar_wall(cv, 6, 107, 122, 111, ramp='flagstone', base_i=3, course_h=3, block_w=10, seed=56)
    for mx in (12, 34, 92, 112):
        cv.rect(mx, 109, mx + 4, 111, col('moss', 3))
    draw_lantern(cv, 46, 92, color='red', glow=True)
    draw_lantern(cv, 82, 92, color='red', glow=True)

    cv.edge_finish(top_y=79)
    return cv


# ---------------------------------------------------------------------------
# BUILDING 6: mf-bldg-sig_lcorner_conv_bar (128x112)
# Asymmetric L-shaped 2F urban corner complex: 24h shop + craft-beer bistro + L rooftop beer garden
# ---------------------------------------------------------------------------

def build_sig_lcorner_conv_bar():
    cv = Canvas(128, 112)

    # ===== 2F BACK-RIGHT CORNER PAVILION (L-arm: x=74..122, y=6..46) =====
    cv.flat_roof(72, 6, 124, 18, deck_ramp='steel', deck_i=3, para_ramp='steel', seed=61)
    cv.roof_ac(106, 9)
    cv.brick_wall(74, 18, 122, 46, ramp='brick', base_i=3, course_h=3, brick_w=5, seed=62)
    # Deck-level timber bar door opening directly onto the rooftop beer garden!
    draw_french_door(cv, 78, 24, 92, 46, frame='darkwood', warm=True, threshold=True)
    # Open pass-through rooftop craft-beer counter window
    cv.outline_box(96, 24, 118, 41, col('orange', 4), col('darkwood', 1), top_hi=col('yellow', 5))
    cv.hline(95, 119, 41, col('cedar', 5))
    cv.hline(95, 119, 42, col('wood', 2))
    # Beer tap tower on pass-through bar
    cv.rect(103, 35, 111, 41, col('yellow', 4))
    cv.p(105, 34, col('steel', 5))
    cv.p(108, 34, col('steel', 5))
    # Glowing rooftop BEER sign above pavilion
    cv.outline_box(95, 17, 119, 24, col('navy', 1), col('ink', 0), top_hi=col('yellow', 4))
    draw_text_centered(cv, 'BEER', 96, 118, 18, 'yellow:5', shadow='orange:2', compact=True, spacing=1)

    # ===== SPACIOUS L-SHAPED OPEN-AIR ROOFTOP BEER GARDEN (x=6..122, y=22..68) =====
    # Back-left low stone parapet & greenery border (x=6..74, y=22..28)
    cv.rect(6, 22, 74, 28, col('stone', 4))
    cv.hline(6, 74, 22, col('stone', 6))
    cv.hline(6, 74, 27, col('stone', 1))
    cv.planter_box(10, 19, 34, 27, flower='yellow:5', pot_ramp='wood')
    cv.planter_box(42, 19, 68, 27, flower='foliage:6', pot_ramp='wood')

    # L-shaped horizontal cedar beer-garden deck: left arm (y=28..68, x=6..76) + front arm (y=46..68, x=72..122)
    draw_walkable_terrace(cv, 6, 28, 76, 68, floor_style='wood', floor_ramp='floorwood',
                          rail_style='wood', rail_ramp='darkwood', rail_h=7, north_shadow=3,
                          left_return=True, right_return=False, pier_xs=[8, 40], seed=63)
    draw_walkable_terrace(cv, 72, 46, 122, 68, floor_style='wood', floor_ramp='floorwood',
                          rail_style='wood', rail_ramp='darkwood', rail_h=7, north_shadow=3,
                          left_return=False, right_return=True, pier_xs=[74, 100, 120], seed=64)
    # Seamless deck plank blend across L-junction (x=71..77, y=46..61)
    for y in range(46, 61):
        ry = y - 28
        for x in range(71, 77):
            cv.p(x, y, col('floorwood', 2 if ry % 3 == 2 else (5 if ry % 3 == 0 else 4)))
    cv.shade_rect(74, 46, 120, 49, delta=-2)

    # Beer garden wooden keg bar / cooler along back-left wall
    cv.outline_box(12, 30, 32, 37, col('wood', 4), col('wood', 0), top_hi=col('cedar', 6))
    cv.rect(15, 31, 19, 34, col('steel', 5))
    cv.rect(22, 31, 26, 34, col('yellow', 5))

    # 4 lively beer-garden tables with amber beer mugs!
    draw_bistro_set(cv, 52, 36, table_ramp='cedar', chair_ramp='wood', items='beer', wide=True)
    draw_bistro_set(cv, 26, 49, table_ramp='cedar', chair_ramp='wood', items='beer', wide=True)
    draw_bistro_set(cv, 60, 52, table_ramp='cedar', chair_ramp='wood', items='beer')
    draw_bistro_set(cv, 98, 52, table_ramp='cedar', chair_ramp='wood', items='beer', wide=True)

    # Glowing string lights cleanly anchored to grounded posts along perimeter & across pavilion!
    for px, py0, py1 in ((9, 20, 28), (40, 20, 28), (74, 20, 28), (118, 36, 61)):
        cv.vline(px, py0, py1, col('steel', 1))
        cv.vline(px + 1, py0, py1, col('steel', 4))
    draw_string_lights(cv, 10, 21, 40, 21, sag=4, step=6)
    draw_string_lights(cv, 41, 21, 74, 21, sag=4, step=6)
    draw_string_lights(cv, 76, 26, 118, 37, sag=4, step=6)
    draw_string_lights(cv, 41, 23, 76, 36, sag=4, step=6)

    # ===== 1F DUAL-TENANT CORNER COMPLEX (y=68..111, x=6..122) =====
    draw_cornice(cv, 5, 68, 123, ramp='concrete', h=3)

    # --- LEFT HALF (x=6..64): Bright Glowing 24H Convenience Shop ---
    cv.tile_cladding(6, 71, 64, 111, ramp='coolwhite', base_i=4, cw=4, ch=4, seed=65)
    # Signature glowing 24H convenience store fascia band (green + orange + blue stripes!)
    cv.rect(7, 72, 63, 82, col('white', 6))
    cv.hline(7, 63, 72, col('green', 4))
    cv.hline(7, 63, 73, col('green', 3))
    cv.hline(7, 63, 80, col('orange', 4))
    cv.hline(7, 63, 81, col('blue', 4))
    draw_text_centered(cv, '24H MART', 8, 62, 74, 'navy:2', compact=True, spacing=1)

    # Crisp glowing convenience store showcase windows with colorful stocked shelves!
    for wx0, wx1 in ((9, 27), (45, 62)):
        cv.outline_box(wx0, 84, wx1, 107, col('cream', 5), col('steel', 2), top_hi=col('white', 6))
        for sy in (90, 96, 102):
            cv.hline(wx0 + 1, wx1 - 1, sy, col('steel', 4))
            for sx in range(wx0 + 2, wx1 - 2, 2):
                sc = ['red:4', 'blue:4', 'green:4', 'yellow:5', 'orange:4', 'pink:4'][(sx + sy) % 6]
                cv.rect(sx, sy - 3, sx + 2, sy, sc)
        # Glass diagonal glint
        cv.p(wx0 + 2, 86, col('glass', 6))
        cv.p(wx0 + 3, 87, col('glass', 6))
    # Automatic glass sliding doors (x=28..44)
    cv.door_glass(28, 84, 44, 110, frame='steel:2', warm=False)
    cv.rect(6, 108, 64, 111, col('pavement', 4))

    # --- RIGHT HALF (x=64..122): Cozy Craft-Beer Bistro ---
    cv.brick_wall(64, 71, 122, 111, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=66)
    cv.vline(64, 71, 111, col('ink', 1))
    # Emerald & cream striped bistro awning
    cv.awning(65, 73, 121, 82, ramp_a='green', ramp_b='cream', stripe_w=4)
    # Cozy warm amber bistro window revealing tap counter & stools
    def pub_interior(c, ix0, iy0, ix1, iy1):
        c.rect(ix0, iy1 - 6, ix1, iy1, col('wood', 2))
        c.hline(ix0, ix1, iy1 - 6, col('cedar', 5))
        for tx in range(ix0 + 3, ix1 - 3, 5):
            c.rect(tx, iy1 - 9, tx + 2, iy1 - 6, col('yellow', 5))
        draw_lantern(c, ix0 + 6, iy0 + 2, color='orange', glow=True)
        draw_lantern(c, ix1 - 7, iy0 + 2, color='orange', glow=True)

    draw_arched_bay(cv, 68, 84, 96, 107, frame='darkwood:1', trim='cedar:5', warm=True,
                    interior_fn=pub_interior, mullions=True, sill='stone:5')
    # Cozy timber pub entrance door (x=99..115)
    cv.door_wood(99, 85, 115, 110, ramp='darkwood', glass_top=True)
    draw_lantern(cv, 117, 87, color='red', glow=True)
    cv.rect(64, 108, 122, 111, col('stone', 3))
    # Vertical glowing PUB blade sign projecting on right edge!
    cv.outline_box(120, 72, 127, 101, col('navy', 2), col('ink', 0), top_hi=col('yellow', 4))
    draw_text(cv, 'PUB', 122, 76, 'yellow:5', shadow='ink:0', compact=True, spacing=2, vertical=True)

    cv.edge_finish(top_y=71)
    return cv


# ---------------------------------------------------------------------------
# BUILDING 7: mf-bldg-sig_glass_atrium_arcade (144x128)
# Landmark 2.5F sunlit European-Asian glass shopping arcade with soaring vaulted glass atrium
# ---------------------------------------------------------------------------

def build_sig_glass_atrium_arcade():
    cv = Canvas(144, 128)

    # ===== CENTER SOARING VAULTED GLASS ATRIUM ROOF (x=42..102, y=2..40) =====
    acx = 72
    arx = 30
    ary = 32
    # Barrel-vaulted glass-and-iron skylight dome
    for y in range(4, 40):
        for x in range(42, 102):
            dx = (x - acx) / arx
            dy = (39 - y) / ary
            d = dx * dx + dy * dy
            if y < 34 and d > 1.04:
                continue
            # Arched iron structural ribs
            if d > 0.90 or abs(dx) < 0.05 or abs(abs(dx) - 0.48) < 0.045 or (y in (16, 26, 36)):
                cv.p(x, y, col('steel', 1 if d > 0.94 else 3))
            else:
                # Sunlit bright diagonal glass reflections
                diag = (x + y) % 11
                if diag in (0, 1, 2):
                    cv.p(x, y, col('glass', 6))
                elif diag in (3, 4):
                    cv.p(x, y, col('glass', 5))
                elif y < 14:
                    cv.p(x, y, col('glass', 4))
                else:
                    cv.p(x, y, col('glass', 3))
    # Ornate iron cresting ridge seated flush on the dome crown (y=3..6)
    cv.rect(62, 5, 82, 7, col('steel', 2))
    cv.hline(63, 81, 4, col('steel', 5))
    for fx in range(64, 81, 4):
        cv.p(fx, 3, col('yellow', 5))

    # ===== TWIN WARM-BRICK & LIMESTONE CORNER WINGS (Left x=4..44, Right x=100..140) =====
    for wx0, wx1, sseed in ((4, 44, 71), (100, 140, 72)):
        # Pitched slate mansard roof on each wing (y=16..34)
        draw_ribbed_roof(cv, wx0 - 1, 16, wx1 + 1, 34, ramp='kawara', tile_w=4, course_h=4,
                         moss=0.04, finials=True, seed=sseed)
        # 2F Warm Brick Wing Facade (y=34..55)
        cv.brick_wall(wx0, 34, wx1, 55, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=sseed + 2)
        draw_quoins(cv, wx0, 34, wx1, 55, ramp='cream', qw=3, qh=4)
        # Wing 2F Open Balcony Terrace (y=55..77 -> shallow 3px foreshortened horizontal decking + open vertical balusters!)
        draw_walkable_terrace(cv, wx0 - 1, 55, wx1 + 1, 77, floor_style='flagstone', floor_ramp='cream',
                              rail_style='open_balusters', rail_ramp='stone', rail_h=7, north_shadow=2,
                              left_return=True, right_return=True, pier_xs=[wx0 + 1, wx1 - 2], seed=sseed + 4)
        # Crisp 2px dark cast shadow along brick back-wall base (y=54..55)
        cv.hline(wx0, wx1, 54, col('brick', 1))
        cv.hline(wx0, wx1, 55, col('cream', 1))
        cv.hline(wx0, wx1, 56, col('cream', 2))
        # Full-height arched double French doors reaching cleanly down to the 2F balcony deck (y=55..56) with threshold!
        draw_french_door(cv, wx0 + 10, 36, wx1 - 10, 56, frame='darkwood', warm=True, arched=True, threshold=True)
        # Compact rail-side planters & bistro set cleanly grounded on balcony deck!
        cv.shade_rect(wx0 + 2, 69, wx0 + 12, 70, delta=-2)
        cv.planter_box(wx0 + 2, 64, wx0 + 11, 70, flower='red:4', pot_ramp='stone')
        cv.shade_rect(wx1 - 11, 69, wx1 - 1, 70, delta=-2)
        cv.planter_box(wx1 - 11, 64, wx1 - 2, 70, flower='pink:4', pot_ramp='stone')
        draw_bistro_set(cv, (wx0 + wx1) // 2, 61, table_ramp='white', chair_ramp='wood', items='coffee')

    # ===== CENTER 2F SUNLIT INTERIOR GALLERY BALCONIES BEHIND CLEAR GLASS (x=44..100, y=38..77) =====
    cv.rect(44, 38, 100, 77, col('cream', 4))
    # Interior warm backlit 2F atrium galleries & arched boutique bays
    draw_arched_bay(cv, 47, 42, 68, 59, frame='steel:2', trim='cream:6', warm=True, mullions=True, sill=None)
    draw_arched_bay(cv, 76, 42, 97, 59, frame='steel:2', trim='cream:6', warm=True, mullions=True, sill=None)
    # 2F Interior Walkable Gallery Balcony with open vertical balusters (y=56..77)
    draw_walkable_terrace(cv, 45, 56, 99, 77, floor_style='checker', floor_ramp='cream',
                          rail_style='open_balusters', rail_ramp='stone', rail_h=7, north_shadow=2,
                          left_return=False, right_return=False, pier_xs=[46, 72, 98], seed=75)
    # Potted atrium palms on interior gallery
    draw_potted_tree(cv, 54, 69, trunk_h=3, rx=4, ry=4, leaf_ramp='foliage', pot_ramp='stone', seed=76)
    draw_potted_tree(cv, 90, 69, trunk_h=3, rx=4, ry=4, leaf_ramp='foliage', pot_ramp='stone', seed=77)
    # Crisp translucent diagonal glass reflection streaks CLIPPED CLEANLY ABOVE the balustrade/cornice (y=39..69)!
    for y in range(39, 70):
        for x in range(44, 100):
            if (x + y) % 19 in (0, 1):
                cv.p(x, y, col('glass', 6))
            elif (x + y) % 19 == 2 and (y % 2 == 0):
                cv.p(x, y, col('glass', 5))
    for vx in (44, 72, 99):
        cv.vline(vx, 38, 70, col('steel', 1))
    cv.hline(44, 100, 38, col('steel', 1))
    cv.hline(44, 100, 39, col('steel', 4))

    # ===== 1F GRAND LIMESTONE ARCADE & BOUTIQUE SHOPFRONTS (y=78..127, x=4..140) =====
    draw_cornice(cv, 3, 78, 141, ramp='cream', h=4, dentils=True)
    draw_ashlar_wall(cv, 4, 82, 140, 124, ramp='cream', base_i=4, course_h=5, block_w=10, seed=78)
    draw_ashlar_wall(cv, 4, 122, 140, 127, ramp='stone', base_i=4, course_h=3, block_w=10, seed=79)
    draw_quoins(cv, 4, 82, 140, 122, ramp='stone', qw=4, qh=5)

    # Left & Right 1F Boutique Showcase Windows with burgundy/cream striped awnings
    def boutique_interior(c, ix0, iy0, ix1, iy1):
        # Display mannequins / boutique shelves
        c.rect(ix0 + 3, iy1 - 12, ix0 + 8, iy1 - 2, col('pink', 4))
        c.p(ix0 + 5, iy1 - 14, col('cream', 6))
        c.rect(ix1 - 9, iy1 - 12, ix1 - 4, iy1 - 2, col('teal', 4))
        c.p(ix1 - 7, iy1 - 14, col('cream', 6))
        c.hline(ix0, ix1, iy1 - 2, col('wood', 3))

    for bx0, bx1 in ((10, 40), (104, 134)):
        draw_arched_bay(cv, bx0, 92, bx1, 122, frame='steel:1', trim='stone:5', warm=True,
                        interior_fn=boutique_interior, mullions=True, sill='stone:6')
        cv.awning(bx0 - 1, 84, bx1 + 1, 93, ramp_a='red', ramp_b='cream', stripe_w=4)

    # Grand Center Vaulted Atrium Entry Portal (x=46..98, y=82..127)
    cv.outline_box(50, 82, 94, 91, col('navy', 1), col('ink', 0), top_hi=col('yellow', 5))
    draw_text_centered(cv, 'ARCADE', 51, 93, 84, 'yellow:5', shadow='ink:0', compact=False, spacing=1)
    # Ornate arched glass portal frame
    draw_arched_bay(cv, 48, 92, 96, 125, frame='steel:1', trim='yellow:4', warm=True, mullions=False, sill=None)
    cv.door_glass(56, 98, 88, 124, frame='steel:2', warm=True)
    # Ornate golden arcade clock medallion at portal crown
    cv.rect(69, 93, 75, 99, col('yellow', 5))
    cv.rect(70, 94, 74, 98, col('white', 6))
    cv.p(72, 96, col('ink', 0))
    cv.p(72, 95, col('ink', 0))
    cv.p(73, 96, col('ink', 0))
    # Checkered grand entry steps & flanking topiary trees
    for x in range(48, 96):
        cv.p(x, 125, col('cream', 6) if (x // 4) % 2 == 0 else col('stone', 4))
        cv.p(x, 126, col('stone', 3))
    draw_potted_tree(cv, 44, 126, trunk_h=4, rx=4, ry=5, leaf_ramp='foliage', pot_ramp='stone', seed=80)
    draw_potted_tree(cv, 100, 126, trunk_h=4, rx=4, ry=5, leaf_ramp='foliage', pot_ramp='stone', seed=81)

    cv.edge_finish(top_y=82)
    return cv


# ---------------------------------------------------------------------------
# BUILDING 8: mf-bldg-sig_hillside_bakery_patio (128x112)
# Warm hillside artisan boulangerie with elevated 1.5F stone-walled garden patio & steps
# ---------------------------------------------------------------------------

def build_sig_hillside_bakery_patio():
    cv = Canvas(128, 112)

    # ===== UPPER HILLSIDE ARTISAN BAKERY HOUSE (x=12..118, y=4..60) =====
    draw_ribbed_roof(cv, 12, 4, 118, 26, ramp='cha', tile_w=4, course_h=4,
                     moss=0.06, finials=True, ridge_ramp='rooftile', seed=81)
    # Brick bread-oven chimney puffing warm smoke!
    draw_chimney(cv, 96, 0, w=8, h=14, ramp='brick', smoke=True)
    # Cozy roof dormer window
    cv.outline_box(56, 10, 72, 22, col('cream', 5), col('wood', 1), top_hi=col('rooftile', 5))
    cv.window(59, 13, 69, 21, style='warm', frame='wood:1', sill='wood:4')

    # Timber-and-Stucco Bakery House Facade (x=14..116, y=26..60)
    draw_stucco_wall(cv, 14, 26, 116, 60, ramp='cream', base_i=5, seed=82, shadow_top=3)
    for px in (14, 15, 48, 74, 114, 115):
        cv.vline(px, 26, 60, col('wood', 2 if px in (14, 115) else 4))
    cv.hline(14, 116, 26, col('wood', 1))

    # Crisp BAKERY wooden fascia signboard
    cv.outline_box(46, 28, 82, 36, col('wood', 2), col('wood', 0), top_hi=col('cedar', 5))
    draw_text_centered(cv, 'BAKERY', 47, 81, 30, 'cream:6', shadow='ink:0', compact=True, spacing=1)

    # Deck-level wooden bakery entrance door opening directly onto the 1.5F patio!
    draw_french_door(cv, 52, 38, 70, 60, frame='wood', warm=True, threshold=True)

    # Left Bakery Display Window overflowing with golden baguettes & croissants
    cv.awning(17, 30, 47, 38, ramp_a='rooftile', ramp_b='cream', stripe_w=4)
    cv.outline_box(18, 39, 46, 56, col('orange', 4), col('wood', 1), top_hi=col('yellow', 5))
    for sy in (45, 51):
        cv.hline(19, 45, sy, col('cedar', 3))
        for bx in range(21, 44, 4):
            cv.rect(bx, sy - 3, bx + 3, sy, col('yellow', 4) if bx % 2 == 0 else col('orange', 4))
            cv.p(bx + 1, sy - 3, col('cream', 6))
    cv.hline(17, 47, 56, col('stone', 5))

    # Right Pastry Display Counter Window
    cv.awning(75, 30, 113, 38, ramp_a='rooftile', ramp_b='cream', stripe_w=4)
    cv.outline_box(76, 39, 112, 56, col('orange', 4), col('wood', 1), top_hi=col('yellow', 5))
    cv.rect(77, 50, 111, 55, col('wood', 3))
    cv.hline(77, 111, 50, col('cream', 6))
    for px in range(79, 109, 5):
        cv.rect(px, 47, px + 3, 50, col('pink', 4) if px % 2 == 0 else col('yellow', 5))
    cv.hline(75, 113, 56, col('stone', 5))

    # ===== ELEVATED 1.5F STONE-WALLED GARDEN PATIO (x=4..124, y=58..92 -> 34px deep!) =====
    # Shallow 3px foreshortened horizontal stone pavers + crisp 2px dark shadow along bakery wall base (y=58..59)
    draw_walkable_terrace(cv, 4, 58, 124, 92, floor_style='flagstone', floor_ramp='cream',
                          rail_style='stone', rail_ramp='stone', rail_h=7,
                          gap_x=(50, 74), north_shadow=2,
                          left_return=True, right_return=True, pier_xs=[6, 48, 75, 122], seed=83)
    # Reinforce crisp dark shadow line along bakery wall base (y=58..59)
    cv.hline(14, 116, 58, col('cream', 1))
    cv.hline(14, 116, 59, col('cream', 2))
    # Re-seat bakery deck-level French door cleanly onto the patio pavers at y=59 with bright threshold!
    draw_french_door(cv, 52, 38, 70, 59, frame='wood', warm=True, threshold=True)

    # Grounded blooming garden flower beds framing outer patio borders (clear of tables & chairs!)
    cv.shade_rect(7, 73, 17, 75, delta=-2)
    cv.planter_box(7, 61, 16, 74, flower='pink:4', pot_ramp='stone')
    cv.shade_rect(112, 73, 122, 75, delta=-2)
    cv.planter_box(112, 61, 121, 74, flower='yellow:5', pot_ramp='stone')
    cv.shade_rect(14, 83, 37, 85, delta=-2)
    cv.planter_box(14, 79, 36, 84, flower='red:4', pot_ramp='brick')
    cv.shade_rect(92, 83, 115, 85, delta=-2)
    cv.planter_box(92, 79, 114, 84, flower='pink:5', pot_ramp='brick')

    # Crisply separated patio bistro sets with grounded shadows + clean rounded top-3/4 domed canopies!
    draw_bistro_set(cv, 31, 72, table_ramp='white', chair_ramp='cedar', items='pastry')
    draw_bistro_set(cv, 97, 72, table_ramp='white', chair_ramp='cedar', items='coffee')
    draw_domed_umbrella(cv, 31, 63, rx=9, ry=5, ramp_a='rooftile', ramp_b='cream', pole_bottom=73)
    draw_domed_umbrella(cv, 97, 63, rx=9, ry=5, ramp_a='rooftile', ramp_b='cream', pole_bottom=73)

    # ===== HILLSIDE STONE RETAINING WALL & BROAD STONE STEPS (y=92..111, x=4..124) =====
    draw_ashlar_wall(cv, 4, 92, 124, 111, ramp='stone', base_i=4, course_h=5, block_w=11, seed=84)
    cv.shade_rect(4, 92, 124, 95, delta=-2)
    # Natural cascading ivy draping directly from the stone balustrade coping at left & right piers (no floating balloons!)
    for cx_iv, sd_iv in ((14, 851), (114, 852)):
        cv.foliage_cluster(cx_iv, 91, 5, 2, ramp='foliage', seed=sd_iv, blossom='pink:4')
        cv.foliage_cluster(cx_iv + (2 if cx_iv < 60 else -2), 94, 3, 2, ramp='foliage', seed=sd_iv + 3)
    # Grounded flowering hedges & stone-edged garden flowerbeds anchored directly at retaining wall base!
    for hx0, hx1, hseed, flw in ((6, 46, 860, 'pink:4'), (80, 122, 870, 'yellow:5')):
        # Low carved stone bed curbing along ground line (y=107..111)
        cv.rect(hx0, 107, hx1, 111, col('stone', 4))
        cv.hline(hx0, hx1, 107, col('stone', 6))
        cv.hline(hx0, hx1, 110, col('stone', 1))
        for bx in range(hx0 + 6, hx1 - 2, 8):
            cv.vline(bx, 107, 111, col('stone', 2))
        # Lush continuous grounded hedge foliage rising organically from the stone curb
        for cx_h in range(hx0 + 4, hx1 - 3, 7):
            cv.foliage_cluster(cx_h, 105, 5, 3, ramp='foliage', seed=hseed + cx_h,
                               blossom=flw if (cx_h % 2 == 0) else None)
        # Re-crisp front stone curb top edge so hedge sits neatly INSIDE the grounded flowerbed
        cv.hline(hx0 + 1, hx1 - 1, 108, col('stone', 5))
        cv.hline(hx0 + 1, hx1 - 1, 109, col('stone', 3))

    # Broad Inviting Stone Steps descending from 1.5F patio (x=50..74, y=85..111)
    # Stone cheek walls flanking stairs
    for cx0 in (47, 74):
        cv.rect(cx0, 85, cx0 + 3, 111, col('stone', 4))
        cv.hline(cx0, cx0 + 3, 85, col('stone', 6))
        cv.vline(cx0, 85, 111, col('stone', 2))
        cv.vline(cx0 + 2, 85, 111, col('stone', 1))
    # 6 crisp stepped stone treads with bright top lips & dark risers
    for i in range(6):
        sy = 86 + i * 4
        cv.hline(50, 74, sy, col('cream', 6))
        cv.hline(50, 74, sy + 1, col('cream', 4))
        cv.hline(50, 74, sy + 2, col('stone', 3))
        cv.hline(50, 74, sy + 3, col('stone', 1))
    # Glowing post lanterns flanking bottom of stone steps!
    draw_lantern(cv, 48, 82, color='orange', glow=True)
    draw_lantern(cv, 75, 82, color='orange', glow=True)

    cv.edge_finish(top_y=92)
    return cv


# ---------------------------------------------------------------------------
# BUILDING 9: mf-bldg-sig_courtyard_mansion (144x128)
# Grand U-shaped courtyard mansion/guesthouse bridged by elevated 2F covered wooden gallery balcony!
# ---------------------------------------------------------------------------

def build_sig_courtyard_mansion():
    cv = Canvas(144, 128)

    # ===== TWIN PITCHED-ROOF WINGS (Left x=4..48, Right x=96..140) =====
    draw_ribbed_roof(cv, 4, 4, 49, 30, ramp='kawara', moss=0.05, finials=True, seed=91)
    draw_ribbed_roof(cv, 95, 4, 140, 30, ramp='kawara', moss=0.05, finials=True, seed=92)
    draw_chimney(cv, 14, 0, w=7, h=14, ramp='stone', smoke=True)
    draw_chimney(cv, 123, 0, w=7, h=14, ramp='stone', smoke=False)

    # ===== ELEVATED 2F COVERED WOODEN GALLERY BALCONY BRIDGE (x=46..98, y=18..68) =====
    # Connecting bridge pitched slate roof (set slightly back from wing ridges for architectural depth!)
    draw_ribbed_roof(cv, 46, 18, 98, 32, ramp='ibushi', tile_w=4, course_h=3, moss=0.04, finials=False, seed=93)
    # Recessed bridge gallery back wall (x=46..98, y=32..46 -> seals 1px slit at x=46 with solid masonry/shadow!)
    draw_stucco_wall(cv, 46, 32, 98, 46, ramp='kinari', base_i=5, seed=94, shadow_top=2)
    cv.vline(46, 30, 46, col('stone', 2))
    cv.vline(97, 30, 46, col('stone', 2))
    draw_french_door(cv, 52, 33, 68, 46, frame='wood', warm=True, threshold=True)
    draw_french_door(cv, 76, 33, 92, 46, frame='wood', warm=True, threshold=True)
    draw_lantern(cv, 49, 35, color='orange', glow=True)
    draw_lantern(cv, 72, 35, color='orange', glow=True)
    draw_lantern(cv, 94, 35, color='orange', glow=True)

    # Elevated 2F Covered Wooden Gallery Deck (x=45..99, y=45..68 -> 23px deep!)
    draw_walkable_terrace(cv, 45, 45, 99, 68, floor_style='wood', floor_ramp='floorwood',
                          rail_style='wood', rail_ramp='wood', rail_h=7, north_shadow=3,
                          left_return=True, right_return=True, pier_xs=[47, 62, 82, 97], seed=95)
    # Covered gallery timber support columns framing the central bay cleanly (unobstructed tea table!)
    for px in (47, 62, 81, 96):
        cv.vline(px, 32, 61, col('wood', 2))
        cv.vline(px + 1, 32, 61, col('cedar', 5))
    # Cozy tea table & wicker chairs centered in the open gallery bay
    draw_bistro_set(cv, 72, 52, table_ramp='cream', chair_ramp='cedar', items='tea')
    cv.planter_box(50, 58, 60, 64, flower='pink:4', pot_ramp='brick')
    cv.planter_box(84, 58, 94, 64, flower='yellow:5', pot_ramp='brick')

    # Heavy timber arch beam supporting the 2F gallery bridge over the courtyard!
    cv.rect(45, 68, 99, 73, col('wood', 2))
    cv.hline(45, 99, 68, col('cedar', 5))
    cv.hline(45, 99, 72, col('ink', 0))
    # Decorative curved wooden knee braces under bridge
    for dx in range(6):
        cv.vline(46 + dx, 73, 79 - dx, col('wood', 3))
        cv.vline(97 - dx, 73, 79 - dx, col('wood', 2))

    # ===== SUNLIT STONE COURTYARD & UNOBSTRUCTED CENTRAL ENTRANCE PATH (x=44..100, y=73..126) =====
    # Back garden wall behind the courtyard
    draw_ashlar_wall(cv, 46, 73, 98, 85, ramp='stone', base_i=4, course_h=4, block_w=9, seed=96)
    cv.shade_rect(46, 73, 98, 77, delta=-2)  # Deep shadow from 2F bridge overhead!

    # Sunlit Courtyard Shallow Foreshortened Horizontal Flagstones (x=45..99, y=84..124, 3px row height!)
    for y in range(84, 124):
        ry = y - 84
        ci = ry // 3
        yy = ry % 3
        off = 5 if ci % 2 == 1 else 0
        for x in range(45, 99):
            rx = x - 45
            bx = (rx + off) % 11
            bi = (rx + off) // 11
            r = hsh(bi, ci, 97)
            if yy == 2:
                cv.p(x, y, col('cream', 3 if r > 0.3 else 2))
            elif bx == 10:
                cv.p(x, y, col('cream', 3))
            else:
                t = 5 if (yy == 0 and r > 0.45) else 4
                cv.p(x, y, col('cream', t))

    # Unobstructed Central Stone Entry Walkway connecting central arched door (x=64..80) straight to front gate!
    for y in range(85, 124):
        ry = y - 85
        for x in range(65, 79):
            if x in (65, 78):
                cv.p(x, y, col('stone', 4))
            elif ry % 3 == 2:
                cv.p(x, y, col('stone', 4))
            else:
                cv.p(x, y, col('cream', 6 if ry % 3 == 0 else 5))

    # Crisp courtyard cast shadows from 2F bridge/north wall & flanking wings!
    cv.shade_rect(45, 84, 99, 86, delta=-2)  # Crisp 2px dark shadow along north wall base
    cv.shade_rect(45, 86, 99, 88, delta=-1)  # Soft bridge overhead penumbra
    cv.shade_rect(45, 84, 49, 122, delta=-2)  # Left wing strong cast shadow
    cv.shade_rect(49, 84, 52, 122, delta=-1)  # Left wing penumbra
    cv.shade_rect(96, 84, 99, 122, delta=-1)  # Right wing inner grounding shadow

    # 100% Unobstructed Central Arched Double Entrance Door (doorCol: 4 -> x=64..80) with sunlit stone step!
    draw_french_door(cv, 64, 74, 80, 85, frame='darkwood', warm=True, arched=True, threshold=True)
    cv.hline(63, 81, 86, col('cream', 6))
    cv.hline(64, 80, 87, col('stone', 4))
    draw_lantern(cv, 61, 77, color='orange', glow=True)
    draw_lantern(cv, 82, 77, color='orange', glow=True)

    # Symmetrical Flanking Courtyard Stone Planters & Blossoming Trees (x=54 & x=90 -> central path 100% clear!)
    for tx, tseed in ((54, 98), (90, 99)):
        # Grounded stone planter cast shadow
        cv.shade_rect(tx - 6, 106, tx + 7, 109, delta=-2)
        # Sculpted low stone courtyard planter box
        cv.outline_box(tx - 6, 101, tx + 6, 107, col('stone', 4), col('stone', 1), top_hi=col('cream', 6))
        cv.rect(tx - 4, 102, tx + 4, 104, col('soil', 3))
        # Slender ornamental trunk & compact pink-blossoming canopy staying cleanly inside flanking bays!
        cv.rect(tx - 1, 93, tx + 1, 103, col('wood', 3))
        cv.vline(tx, 93, 103, col('wood', 5))
        cv.foliage_cluster(tx - 2, 92, 4, 4, ramp='foliage', seed=tseed, blossom='pink:5')
        cv.foliage_cluster(tx + 2, 92, 4, 4, ramp='foliage', seed=tseed + 10, blossom='pink:4')
        cv.foliage_cluster(tx, 89, 5, 4, ramp='foliage', seed=tseed + 20, blossom='pink:5')

    # Front Courtyard Low Stone Wall & Open Wrought-Iron Entry Gate (x=45..99, y=116..127)
    for gx0, gx1 in ((45, 62), (82, 99)):
        draw_ashlar_wall(cv, gx0, 118, gx1, 127, ramp='stone', base_i=4, course_h=3, block_w=7, seed=101)
        cv.hline(gx0, gx1, 117, col('cream', 6))
        # Iron fence pickets atop low courtyard wall
        for fx in range(gx0 + 2, gx1 - 1, 3):
            cv.vline(fx, 112, 117, col('steel', 1))
        cv.hline(gx0, gx1, 113, col('steel', 2))
    # Grand Stone Gate Piers with Glowing Courtyard Lanterns & Swung-Open Iron Gates
    for px in (60, 80):
        cv.rect(px, 112, px + 4, 127, col('stone', 4))
        cv.hline(px - 1, px + 5, 112, col('cream', 6))
        cv.vline(px, 112, 127, col('stone', 2))
        cv.vline(px + 3, 112, 127, col('stone', 1))
        draw_lantern(cv, px + 1, 108, color='orange', glow=True)
    # Open wrought-iron gate leaves swung inward + welcoming entry flagstones
    for gy in range(114, 125):
        cv.p(64, gy, col('steel', 1 if gy % 2 == 0 else 2))
        cv.p(65, gy, col('steel', 2 if gy in (115, 120, 124) else 1))
        cv.p(79, gy, col('steel', 1 if gy % 2 == 0 else 2))
        cv.p(78, gy, col('steel', 2 if gy in (115, 120, 124) else 1))
    for y in range(122, 127):
        for x in range(64, 80):
            cv.p(x, y, col('cream', 6) if ((x // 4) + (y // 2)) % 2 == 0 else col('stone', 4))

    # ===== LEFT & RIGHT GRAND CLASSIC WINGS FACADES (2F & 1F) =====
    for wx0, wx1, sseed in ((4, 46, 102), (98, 140, 103)):
        # 2F Warm Cream Stucco & Limestone Quoins (y=30..68)
        draw_stucco_wall(cv, wx0, 30, wx1, 68, ramp='cream', base_i=5, seed=sseed, shadow_top=3)
        draw_quoins(cv, wx0, 30, wx1, 68, ramp='stone', qw=3, qh=4)
        # Tall arched 2F parlor windows with curtains & Juliet iron rail
        draw_arched_bay(cv, wx0 + 10, 36, wx1 - 10, 60, frame='wood:1', trim='stone:6', warm=True,
                        mullions=True, sill='stone:5')
        for rx in range(wx0 + 10, wx1 - 10, 3):
            cv.vline(rx, 54, 60, col('steel', 1))
        cv.hline(wx0 + 9, wx1 - 9, 54, col('steel', 4))
        # Cornice divider between 2F and 1F
        draw_cornice(cv, wx0 - 1, 68, wx1 + 1, ramp='stone', h=3, dentils=True)
        # 1F Carved Limestone Ashlar Wings (y=71..127)
        draw_ashlar_wall(cv, wx0, 71, wx1, 122, ramp='cream', base_i=4, course_h=5, block_w=9, seed=sseed + 4)
        draw_ashlar_wall(cv, wx0, 121, wx1, 127, ramp='stone', base_i=3, course_h=3, block_w=9, seed=sseed + 5)
        draw_quoins(cv, wx0, 71, wx1, 121, ramp='stone', qw=3, qh=5)
        # 1F Shuttered Guest Suite Windows + blooming flower boxes
        draw_arched_bay(cv, wx0 + 10, 82, wx1 - 10, 110, frame='darkwood:1', trim='stone:5', warm=True,
                        mullions=True, sill='stone:5')
        for sx in (wx0 + 6, wx1 - 10):
            cv.rect(sx, 86, sx + 4, 110, col('midori', 3))
            cv.vline(sx, 86, 110, col('midori', 1))
            for sy in range(88, 109, 3):
                cv.hline(sx + 1, sx + 3, sy, col('midori', 5))
        cv.planter_box(wx0 + 10, 109, wx1 - 10, 115, flower='red:4' if wx0 < 50 else 'yellow:5', pot_ramp='stone')
        # Creeping courtyard ivy climbing wing inner wall
        ivx = wx1 - 2 if wx0 < 50 else wx0 + 2
        for dy in range(0, 38, 3):
            cv.p(ivx, 76 + dy, col('foliage', 4))
            cv.p(ivx + (1 if wx0 < 50 else -1), 77 + dy, col('foliage', 2))

    cv.edge_finish(top_y=30)
    return cv


# ---------------------------------------------------------------------------
# BUILDING 10: mf-bldg-sig_neon_nightmarket_hall (144x112)
# Vibrant 2F metropolitan night-market food hall & full-width 2F open-air neon terrace!
# ---------------------------------------------------------------------------

def build_sig_neon_nightmarket_hall():
    cv = Canvas(144, 112)

    # ===== ROOFTOP BAR KIOSK, NEON MARQUEE & PERGOLA CANOPY (y=4..34) =====
    # Back-left 2F rooftop lounge bar kiosk (x=12..58, y=8..34)
    cv.siding_wall(12, 8, 58, 15, ramp='teal', base_i=3, horizontal=False, step=3, seed=111)
    cv.hline(12, 58, 8, col('teal', 5))
    cv.hline(12, 58, 14, col('teal', 0))
    cv.brick_wall(14, 15, 56, 34, ramp='brick', base_i=3, course_h=3, brick_w=5, seed=112)
    # Deck-level wooden bar door + glowing open drink bar counter!
    draw_french_door(cv, 17, 18, 31, 34, frame='darkwood', warm=True, threshold=True)
    cv.outline_box(34, 18, 53, 30, col('orange', 4), col('darkwood', 1), top_hi=col('yellow', 5))
    cv.hline(33, 54, 30, col('cedar', 5))
    for bx in range(36, 51, 3):
        cv.p(bx, 28, col('teal', 5) if bx % 2 == 0 else col('red', 4))

    # Dramatic Glowing Rooftop Horizontal Neon Marquee (x=62..132, y=4..18)
    # Steel rooftop gantry struts
    for sx in (68, 96, 126):
        cv.vline(sx, 16, 34, col('steel', 1))
        cv.vline(sx + 1, 16, 34, col('steel', 4))
    cv.outline_box(62, 4, 132, 17, col('navy', 1), col('ink', 0), top_hi=col('pink', 4), bot_sh=col('teal', 4))
    # Bright glowing neon tube border
    cv.hline(63, 131, 5, col('pink', 5))
    cv.hline(63, 131, 15, col('teal', 5))
    draw_text_centered(cv, 'NIGHT MARKET', 64, 130, 8, 'yellow:5', shadow='red:3', compact=True, spacing=1)

    # Back-right open dining canopy & glowing lanterns (x=82..134, y=20..34)
    cv.awning(82, 20, 134, 27, ramp_a='red', ramp_b='yellow', stripe_w=5)
    cv.rect(84, 27, 132, 34, col('darkwood', 2))
    draw_french_door(cv, 98, 25, 118, 34, frame='wood', warm=True, threshold=True)
    for lx in (88, 126):
        draw_lantern(cv, lx, 28, color='red', glow=True)

    # ===== FULL-WIDTH 2F OPEN-AIR NEON DINING TERRACE (x=8..136, y=32..62 -> 30px deep!) =====
    draw_walkable_terrace(cv, 8, 32, 136, 62, floor_style='wood', floor_ramp='floorwood',
                          rail_style='iron', rail_ramp='steel', rail_h=7, north_shadow=3,
                          left_return=True, right_return=True, pier_xs=[10, 50, 94, 134], seed=113)

    # 4 lively night-market rooftop dining tables with steaming food, beer & glowing lamps!
    draw_bistro_set(cv, 26, 44, table_ramp='red', chair_ramp='wood', items='beer')
    draw_bistro_set(cv, 58, 43, table_ramp='cedar', chair_ramp='darkwood', items='tea', wide=True)
    draw_bistro_set(cv, 90, 44, table_ramp='red', chair_ramp='wood', items='beer')
    draw_bistro_set(cv, 118, 44, table_ramp='cedar', chair_ramp='darkwood', items='tea')

    # Festive draped lantern garlands & string lights spanning the entire terrace!
    draw_string_lights(cv, 12, 22, 62, 24, sag=5, step=5, bulb_a='yellow:5', bulb_b='red:4')
    draw_string_lights(cv, 62, 24, 132, 24, sag=5, step=5, bulb_a='teal:5', bulb_b='yellow:5')
    cv.planter_box(38, 49, 48, 55, flower='yellow:5', pot_ramp='wood')
    cv.planter_box(100, 49, 110, 55, flower='pink:4', pot_ramp='wood')

    # Glowing Neon Accent Strip along the 2F Terrace Fascia (y=62..67)
    cv.rect(7, 62, 137, 67, col('steel', 1))
    cv.hline(8, 136, 63, col('pink', 5))
    cv.hline(8, 136, 65, col('teal', 5))
    cv.hline(7, 137, 66, col('ink', 0))

    # ===== 1F BUSTLING WIDE STREET-FOOD ARCADE STALLS (x=8..136, y=67..111) =====
    cv.brick_wall(8, 67, 136, 111, ramp='brick', base_i=3, course_h=3, brick_w=6, seed=114)
    # Tiled columns dividing the 3 bustling night-market stalls
    for px in (8, 48, 92, 132):
        cv.tile_cladding(px, 67, px + 4, 111, ramp='stone', base_i=4, cw=4, ch=4, seed=115 + px)

    # --- STALL 1 (Left, x=12..48): Ramen / Noodle Counter with Navy Noren & Steam ---
    cv.rect(12, 69, 48, 108, col('darkwood', 2))
    # Backlit warm ramen kitchen interior
    cv.rect(14, 77, 46, 98, col('orange', 4))
    cv.rect(14, 86, 46, 98, col('yellow', 4))
    # Stainless broth pot + white steam wisps
    cv.rect(18, 90, 26, 97, col('coolwhite', 5))
    cv.p(21, 87, col('white', 6))
    cv.p(23, 85, col('white', 5))
    # Wooden counter & red bar stools
    cv.rect(12, 97, 48, 103, col('cedar', 5))
    cv.hline(12, 48, 97, col('cedar', 6))
    cv.hline(12, 48, 102, col('wood', 1))
    for sx in (18, 28, 38):
        cv.rect(sx, 103, sx + 4, 109, col('red', 4))
        cv.hline(sx, sx + 4, 103, col('red', 5))
    draw_noren(cv, 13, 70, 47, 81, ramp='navy', panels=4, crest='white:6')
    draw_lantern(cv, 15, 82, color='red', glow=True)
    draw_lantern(cv, 44, 82, color='red', glow=True)

    # --- STALL 2 (Center, x=52..92): Grand Night-Market Food Hall Entry & Yakitori Grill ---
    cv.outline_box(53, 68, 91, 76, col('red', 2), col('ink', 0), top_hi=col('yellow', 5))
    draw_text_centered(cv, 'FOOD HALL', 54, 90, 70, 'yellow:5', shadow='ink:0', compact=True, spacing=1)
    # Warm glowing bustling arcade hall interior
    cv.rect(52, 77, 92, 108, col('orange', 3))
    cv.rect(55, 81, 89, 104, col('yellow', 4))
    # Crimson & orange noren framing center hall
    draw_noren(cv, 53, 77, 91, 86, ramp='red', panels=5, crest='yellow:5')
    # Sizzling skewers grill stall inside left side + glowing menu board on right + stools
    cv.rect(54, 96, 70, 105, col('steel', 2))
    cv.hline(55, 69, 97, col('orange', 5))
    cv.p(58, 94, col('white', 6))
    cv.p(63, 93, col('white', 5))
    cv.outline_box(76, 89, 87, 99, col('navy', 2), col('darkwood', 0), top_hi=col('yellow', 4))
    cv.hline(78, 85, 92, col('yellow', 5))
    cv.hline(78, 84, 94, col('cream', 6))
    cv.hline(78, 85, 96, col('pink', 4))
    for sx in (57, 64):
        cv.rect(sx, 105, sx + 3, 109, col('red', 4))
    # Warm checkered market hall walkway floor
    for y in range(104, 111):
        for x in range(52, 92):
            if 57 <= x < 67 and y >= 105:
                continue
            cv.p(x, y, col('cream', 5) if ((x // 4) + (y // 3)) % 2 == 0 else col('stone', 4))
    draw_lantern(cv, 55, 88, color='orange', glow=True)
    draw_lantern(cv, 88, 88, color='orange', glow=True)

    # --- STALL 3 (Right, x=96..132): Dumpling & Street-Sweet Stall with Bamboo Steamers ---
    cv.rect(96, 69, 132, 108, col('darkwood', 2))
    cv.rect(98, 78, 130, 98, col('orange', 4))
    cv.rect(98, 86, 130, 98, col('yellow', 4))
    cv.awning(96, 69, 132, 78, ramp_a='teal', ramp_b='cream', stripe_w=4)
    # Stacked bamboo dumpling steamers on counter!
    cv.rect(96, 97, 132, 103, col('cedar', 5))
    cv.hline(96, 132, 97, col('cedar', 6))
    for bx in (101, 111):
        cv.rect(bx, 88, bx + 7, 97, col('straw', 4))
        cv.hline(bx, bx + 7, 91, col('wood', 2))
        cv.hline(bx, bx + 7, 94, col('wood', 2))
        cv.p(bx + 3, 86, col('white', 6))
    for sx in (102, 113, 123):
        cv.rect(sx, 103, sx + 4, 109, col('teal', 4))
        cv.hline(sx, sx + 4, 103, col('teal', 5))
    draw_lantern(cv, 128, 81, color='red', glow=True)

    # Ground pavement curb
    cv.rect(8, 108, 136, 111, col('pavement', 4))
    cv.hline(8, 136, 110, col('pavement', 2))

    # Glowing Vertical Neon Blade Signs projecting on BOTH outer edges!
    # Left vivid pink/yellow neon blade sign
    cv.outline_box(0, 26, 9, 68, col('pink', 2), col('ink', 0), top_hi=col('pink', 5))
    draw_text(cv, 'BAR', 3, 31, 'yellow:5', shadow='ink:0', compact=True, spacing=4, vertical=True)
    cv.rect(8, 34, 11, 36, col('steel', 2))
    cv.rect(8, 56, 11, 58, col('steel', 2))
    # Right vivid teal/cream neon blade sign
    cv.outline_box(135, 22, 144, 66, col('teal', 2), col('ink', 0), top_hi=col('teal', 5))
    draw_text(cv, 'FOOD', 138, 26, 'cream:6', shadow='ink:0', compact=True, spacing=3, vertical=True)
    cv.rect(133, 32, 136, 34, col('steel', 2))
    cv.rect(133, 54, 136, 56, col('steel', 2))

    cv.edge_finish(top_y=67)
    return cv


# ---------------------------------------------------------------------------
# Pack Registry & Export
# ---------------------------------------------------------------------------

BUILDERS = [
    {
        'id': 'mf-bldg-sig_wide_cafe_corner',
        'name': '플래그십 2층 시더 테라스 로스터리 카페 (2.5F)',
        'w': 9, 'h': 8, 'size': [144, 128], 'doorCol': 4,
        'category': 'signature-terraces',
        'lightAnchors': [[32, 106], [72, 108], [112, 106], [40, 44], [104, 44]],
        'tags': ['signature', 'terrace', 'cafe', 'roastery', 'brick', 'wide-balcony', 'hero'],
        'fn': build_sig_wide_cafe_corner,
    },
    {
        'id': 'mf-bldg-sig_pergola_garden_villa',
        'name': '시더 페르골라 지중해 가든 빌라 (2F)',
        'w': 8, 'h': 7, 'size': [128, 112], 'doorCol': 4,
        'category': 'signature-terraces',
        'lightAnchors': [[64, 96], [30, 92], [98, 92], [80, 42], [36, 38]],
        'tags': ['signature', 'terrace', 'villa', 'pergola', 'garden', 'mediterranean', 'hero'],
        'fn': build_sig_pergola_garden_villa,
    },
    {
        'id': 'mf-bldg-sig_extstair_bookstore',
        'name': '외부 철계단 3층 독립서점·티 스튜디오 (3F)',
        'w': 7, 'h': 8, 'size': [112, 128], 'doorCol': 4,
        'category': 'signature-terraces',
        'lightAnchors': [[46, 108], [90, 108], [48, 50], [80, 50], [44, 32]],
        'tags': ['signature', 'terrace', 'bookstore', 'tea', 'exterior-stair', 'veranda', 'hero'],
        'fn': build_sig_extstair_bookstore,
    },
    {
        'id': 'mf-bldg-sig_3tier_stepped_terrace',
        'name': '3단 계단식 스카이가든·갤러리 복합빌딩 (3F)',
        'w': 9, 'h': 9, 'size': [144, 144], 'doorCol': 4,
        'category': 'signature-terraces',
        'lightAnchors': [[32, 122], [72, 126], [112, 122], [72, 65], [72, 22]],
        'tags': ['signature', 'terrace', 'stepped', 'ziggurat', 'gallery', 'sky-garden', 'hero'],
        'fn': build_sig_3tier_stepped_terrace,
    },
    {
        'id': 'mf-bldg-sig_canal_bridge_shop',
        'name': '운하변 캔틸레버 목재 발코니 티·페이스트리 하우스 (2F)',
        'w': 8, 'h': 7, 'size': [128, 112], 'doorCol': 4,
        'category': 'signature-terraces',
        'lightAnchors': [[28, 96], [64, 98], [98, 96], [32, 40], [96, 40]],
        'tags': ['signature', 'terrace', 'canal', 'waterfront', 'tea-house', 'cantilever', 'hero'],
        'fn': build_sig_canal_bridge_shop,
    },
    {
        'id': 'mf-bldg-sig_lcorner_conv_bar',
        'name': 'L자형 루프탑 비어가든·24시 편의점·펍 복합코너 (2F)',
        'w': 8, 'h': 7, 'size': [128, 112], 'doorCol': 2,
        'category': 'signature-terraces',
        'lightAnchors': [[36, 96], [82, 96], [107, 96], [106, 32], [44, 24]],
        'tags': ['signature', 'terrace', 'rooftop-bar', 'beer-garden', 'convenience', 'l-shaped', 'hero'],
        'fn': build_sig_lcorner_conv_bar,
    },
    {
        'id': 'mf-bldg-sig_glass_atrium_arcade',
        'name': '랜드마크 유리 아트리움 쇼핑 아케이드 (2.5F)',
        'w': 9, 'h': 8, 'size': [144, 128], 'doorCol': 4,
        'category': 'signature-terraces',
        'lightAnchors': [[24, 106], [72, 110], [120, 106], [58, 52], [86, 52]],
        'tags': ['signature', 'terrace', 'arcade', 'atrium', 'glass-vault', 'landmark', 'hero'],
        'fn': build_sig_glass_atrium_arcade,
    },
    {
        'id': 'mf-bldg-sig_hillside_bakery_patio',
        'name': '언덕 위 석축 1.5층 가든 파티오 블랑제리 (1.5F)',
        'w': 8, 'h': 7, 'size': [128, 112], 'doorCol': 4,
        'category': 'signature-terraces',
        'lightAnchors': [[32, 48], [61, 48], [94, 48], [48, 84], [75, 84]],
        'tags': ['signature', 'terrace', 'bakery', 'patio', 'hillside', 'stone-steps', 'hero'],
        'fn': build_sig_hillside_bakery_patio,
    },
    {
        'id': 'mf-bldg-sig_courtyard_mansion',
        'name': '2층 목재 갤러리 브릿지 중정 부티크 맨션 (2F)',
        'w': 9, 'h': 8, 'size': [144, 128], 'doorCol': 4,
        'category': 'signature-terraces',
        'lightAnchors': [[24, 96], [120, 96], [60, 40], [84, 40], [72, 110]],
        'tags': ['signature', 'terrace', 'courtyard', 'mansion', 'u-shaped', 'gallery-bridge', 'hero'],
        'fn': build_sig_courtyard_mansion,
    },
    {
        'id': 'mf-bldg-sig_neon_nightmarket_hall',
        'name': '네온 루프탑 테라스 야시장 푸드홀 (2F)',
        'w': 9, 'h': 7, 'size': [144, 112], 'doorCol': 4,
        'category': 'signature-terraces',
        'lightAnchors': [[30, 88], [72, 90], [114, 88], [96, 10], [44, 24]],
        'tags': ['signature', 'terrace', 'nightmarket', 'food-hall', 'neon', 'rooftop', 'hero'],
        'fn': build_sig_neon_nightmarket_hall,
    },
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    manifest_items = []
    for spec in BUILDERS:
        cv = spec['fn']()
        assert (cv.w, cv.h) == tuple(spec['size']), f"{spec['id']} size mismatch: {(cv.w, cv.h)} != {spec['size']}"
        fname = f"{spec['id']}.png"
        fpath = os.path.join(OUT_DIR, fname)
        cv.save(fpath)
        manifest_items.append({
            'id': spec['id'],
            'name': spec['name'],
            'pack': BATCH,
            'category': spec['category'],
            'w': spec['w'],
            'h': spec['h'],
            'size': spec['size'],
            'doorCol': spec['doorCol'],
            'lightAnchors': spec['lightAnchors'],
            'file': fname,
            'tags': spec['tags'],
        })
        print(f'wrote {fpath} ({cv.w}x{cv.h})')

    manifest = {
        'pack': BATCH,
        'batch': BATCH,
        'kind': 'buildings',
        'palette': 'tiledata/jp-city/fable-city/palette.json',
        'count': len(manifest_items),
        'items': manifest_items,
    }
    mpath = os.path.join(OUT_DIR, 'manifest.json')
    with open(mpath, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f'wrote {mpath} ({len(manifest_items)} buildings)')


if __name__ == '__main__':
    main()
