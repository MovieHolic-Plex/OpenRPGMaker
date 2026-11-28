#!/usr/bin/env python3
"""Modern-Fable Buildings — Pack 02: Korean Residential, Piloti Villas & Apartments (10 buildings).

Strictly locked to tiledata/jp-city/fable-city/palette.json via fable_lib.
Fable 5.2 top-3/4 RPG pixel-art baseline:
  - Visible sunlit top planes (green urethane / concrete / pebble / pitched shingle roofs),
  - Crisp warm-violet/slate ink outlines, top-left lighting, grounded cast shadows,
  - Rich lived-in Korean architectural details (piloti parking with cars & bikes, intercoms,
    stairwell glass strips, individualized floor verandas, hanging laundry, AC condensers,
    rooftop vegetable gardens & pergolas, stone retaining walls, unit numbers 101 / 102),
  - Zero floor cloning (G4 anti-clone strictly honored on every multi-story building).
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from fable_lib import Canvas, col, hsh, shade_rgba, OUT_ROOT


# ---------------------------------------------------------------------------
# Reusable Korean Residential & Fable 5.2 Pixel-Art Primitives
# ---------------------------------------------------------------------------

DIGITS_3x5 = {
    '0': ['111', '101', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'],
    '7': ['111', '001', '010', '010', '010'],
    '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'],
}


def draw_digits(cv, x, y, text, fg, shadow=None, scale=1, gap=1):
    """Crisp pixel digits for apartment unit numbers (101, 102)."""
    cx = x
    for ch in text:
        pat = DIGITS_3x5.get(ch)
        if not pat:
            cx += 3 * scale + gap
            continue
        for ry, row in enumerate(pat):
            for rx, bit in enumerate(row):
                if bit == '1':
                    if shadow is not None:
                        cv.rect(cx + rx * scale + 1, y + ry * scale + 1,
                                cx + (rx + 1) * scale + 1, y + (ry + 1) * scale + 1, shadow)
                    cv.rect(cx + rx * scale, y + ry * scale,
                            cx + (rx + 1) * scale, y + (ry + 1) * scale, fg)
        cx += 3 * scale + gap


FONT_3x5 = {
    **DIGITS_3x5,
    'A': ['010', '101', '111', '101', '101'],
    'C': ['111', '100', '100', '100', '111'],
    'D': ['110', '101', '101', '101', '110'],
    'E': ['111', '100', '110', '100', '111'],
    'G': ['111', '100', '101', '101', '111'],
    'H': ['101', '101', '111', '101', '101'],
    'I': ['111', '010', '010', '010', '111'],
    'K': ['101', '101', '110', '101', '101'],
    'L': ['100', '100', '100', '100', '111'],
    'N': ['111', '101', '101', '101', '101'],
    'O': ['111', '101', '101', '101', '111'],
    'P': ['111', '101', '111', '100', '100'],
    'R': ['110', '101', '110', '101', '101'],
    'S': ['111', '100', '111', '001', '111'],
    'T': ['111', '010', '010', '010', '010'],
    'V': ['101', '101', '101', '101', '010'],
    '-': ['000', '000', '111', '000', '000'],
}


def draw_pixel_text(cv, x, y, text, fg, shadow=None, gap=1):
    """Crisp 3x5 pixel typography for apartment signage (PARK, 101, etc.)."""
    cx = x
    for ch in text.upper():
        if ch == ' ':
            cx += 2
            continue
        pat = FONT_3x5.get(ch)
        if not pat:
            cx += 3 + gap
            continue
        for ry, row in enumerate(pat):
            for rx, bit in enumerate(row):
                if bit == '1':
                    if shadow is not None:
                        cv.p(cx + rx + 1, y + ry + 1, shadow)
                    cv.p(cx + rx, y + ry, fg)
        cx += 3 + gap


def draw_apt_crest(cv, cx, y):
    """Crisp 7x5 geometric diamond-arch apartment complex crest."""
    cv.p(cx, y, col('yellow', 5))
    cv.p(cx - 1, y + 1, col('yellow', 5))
    cv.p(cx, y + 1, col('white', 6))
    cv.p(cx + 1, y + 1, col('yellow', 5))
    cv.p(cx - 2, y + 2, col('yellow', 4))
    cv.p(cx - 1, y + 2, col('yellow', 5))
    cv.p(cx + 1, y + 2, col('yellow', 5))
    cv.p(cx + 2, y + 2, col('yellow', 4))
    cv.p(cx - 3, y + 3, col('orange', 4))
    cv.p(cx - 2, y + 3, col('yellow', 4))
    cv.p(cx + 2, y + 3, col('yellow', 4))
    cv.p(cx + 3, y + 3, col('orange', 4))
    cv.hline(cx - 2, cx + 3, y + 4, col('orange', 4))
    cv.hline(cx - 1, cx + 2, y + 4, col('yellow', 4))


def draw_open_baluster_rail(cv, x0, x1, y0, y1, rail_ramp='wood', post_i=3, top_hi=5, step=3):
    """True open vertical-baluster front rail letting the shaded deck floor peek between bars."""
    # Sunlit top handrail + underside shadow
    cv.hline(x0, x1, y0, col(rail_ramp, top_hi))
    cv.hline(x0, x1, y0 + 1, col(rail_ramp, 1))
    # Subtle rail cast shadow on top of open gaps
    for x in range(x0 + 1, x1 - 1):
        cv.p(x, y0 + 2, shade_rgba(cv.get(x, y0 + 2), -1))
    # Crisp 1px open vertical balusters (leaving gaps untouched so deck shows cleanly through)
    for y in range(y0 + 2, y1 - 2):
        for x in range(x0, x1):
            rx = x - x0
            if rx == 0 or rx == (x1 - x0 - 1):
                cv.p(x, y, col(rail_ramp, 1))
            elif rx == 1 or rx == (x1 - x0 - 2):
                cv.p(x, y, col(rail_ramp, post_i))
            elif rx % step == 0:
                cv.p(x, y, col(rail_ramp, post_i if y < y1 - 3 else max(1, post_i - 1)))
    # Bottom rail & crisp grounding line
    cv.hline(x0, x1, y1 - 2, col(rail_ramp, max(1, post_i - 1)))
    cv.hline(x0, x1, y1 - 1, col(rail_ramp, 0))


def draw_fable_deep_gable(cv, x0, y0, x1, y1, ramp='kuro', trim_ramp='white', wall_ramp='white', wall_i=5,
                          beam_ramp='wood', seed=0):
    """Fable-style top-3/4 overhanging front-gable roof with thick tiled bargeboards,
    recessed shadowed pediment, exposed collar beam, and projecting tiled lower eave skirt."""
    w = x1 - x0
    h = y1 - y0
    eave_h = 5
    gh = max(10, h - eave_h)
    cx = (x0 + x1) // 2

    for y in range(max(0, y0), min(cv.h, y0 + gh)):
        ry = y - y0
        half_w = int(round((ry / max(1, gh - 1)) * (w // 2))) + 2
        lx = max(x0, cx - half_w)
        rx_end = min(x1, cx + half_w)
        # Thick 7px dark-outlined overhanging tiled gable slopes on left & right
        slope_t = 7
        ilx = lx + slope_t
        irx = rx_end - slope_t
        for x in range(lx, rx_end):
            if ry == 0:
                cv.p(x, y, col(ramp, 0))
            elif ry == 1:
                cv.p(x, y, col(ramp, 6 if lx < x < rx_end - 1 else 0))
            elif ry == 2 and (cx - 3 <= x <= cx + 3):
                cv.p(x, y, col(ramp, 5 if (cx - 2 <= x <= cx + 2) else 1))
            elif x == lx or x == rx_end - 1:
                cv.p(x, y, col(ramp, 0))
            elif x == lx + 1:
                cv.p(x, y, col(ramp, 6))  # Sunlit top-left overhanging roof rim
            elif x == rx_end - 2:
                cv.p(x, y, col(ramp, 2))  # Shaded right overhanging roof rim
            elif ry >= 6 and ilx <= x < irx:
                # Recessed gable pediment wall with deep underside eave cast shadow!
                dist_eave = min(x - ilx, (irx - 1) - x)
                if dist_eave == 0 or ry == 6:
                    cv.p(x, y, col(ramp, 0))  # Deep dark bargeboard soffit edge
                elif dist_eave == 1 or ry == 7:
                    cv.p(x, y, col('ink', 1))  # Deep underside cast shadow
                elif dist_eave == 2 or ry == 8:
                    cv.p(x, y, col(wall_ramp, max(1, wall_i - 2)))  # Soft secondary eave shadow
                else:
                    r = hsh(x, y, seed)
                    t = wall_i + (-1 if r < 0.14 else (1 if r > 0.90 and wall_i < 6 else 0))
                    cv.p(x, y, col(wall_ramp, t))
            else:
                # Thick overhanging shingled/tiled gable slope courses
                ci = ry // 3
                bx = (x + ci * 2) % 3
                r = hsh(x // 3, ci, seed)
                right_sh = 1 if x > cx else 0
                if x == ilx - 1 or x == irx:
                    cv.p(x, y, col(ramp, 0))
                elif ry % 3 == 2 or bx == 2:
                    cv.p(x, y, col(ramp, max(0, 1 - right_sh)))
                else:
                    cv.p(x, y, col(ramp, max(1, (5 if r > 0.65 else 4 if r > 0.25 else 3) - right_sh)))

    # Horizontal structural timber collar beam inside recessed pediment (like machiya-gable / house-gable-a)
    beam_y = y0 + gh - 7
    b_half = int(round(((gh - 7) / max(1, gh - 1)) * (w // 2))) + 2 - 7
    bx0 = max(x0 + 7, cx - b_half + 1)
    bx1 = min(x1 - 7, cx + b_half - 1)
    if bx1 - bx0 >= 10:
        cv.hline(bx0, bx1, beam_y, col(beam_ramp, 1))
        cv.hline(bx0, bx1, beam_y + 1, col(beam_ramp, 4))
        cv.hline(bx0, bx1, beam_y + 2, col(beam_ramp, 1))
        cv.hline(bx0 + 1, bx1 - 1, beam_y + 3, col(wall_ramp, max(1, wall_i - 2)))

    # Projecting full-width horizontal tiled lower eave skirt at base of gable (y1-5..y1)
    ey0 = y0 + gh
    cv.hline(x0, x1, ey0, col(ramp, 0))
    for y in range(ey0 + 1, y1):
        ry = y - ey0
        for x in range(x0, x1):
            rx = x - x0
            if x == x0 or x == x1 - 1 or y == y1 - 1:
                cv.p(x, y, col(ramp, 0))
            elif ry == 1:
                cv.p(x, y, col(ramp, 5 if rx % 4 != 3 else 3))
            elif ry == 2:
                cv.p(x, y, col(ramp, 4 if rx % 4 != 3 else 1))
            else:
                cv.p(x, y, col(ramp, 2 if rx % 4 != 3 else 1))


def draw_slab_band(cv, x0, x1, y, ramp='concrete', accent=None, h=3, cast_shadow=True):
    """Horizontal concrete floor slab ledge with sunlit top coping and underside shadow."""
    cv.hline(x0, x1, y, col(ramp, 6))
    if h >= 3:
        cv.hline(x0, x1, y + 1, accent if accent is not None else col(ramp, 4))
        cv.hline(x0, x1, y + 2, col(ramp, 1))
        for ry in range(3, h):
            cv.hline(x0, x1, y + ry, col(ramp, 2))
    else:
        cv.hline(x0, x1, y + 1, col(ramp, 2))
    if cast_shadow:
        cv.hline(x0 + 1, x1 - 1, y + h, col('ink', 1))


def draw_iron_rail(cv, x0, x1, y0, y1, ramp='steel', step=3, top_hi=5):
    """Crisp dark wrought-iron or steel safety railing."""
    cv.hline(x0, x1, y0, col(ramp, top_hi))
    cv.hline(x0, x1, y0 + 1, col(ramp, 1))
    for y in range(y0 + 2, y1 - 1):
        for x in range(x0, x1):
            rx = x - x0
            if rx == 0 or rx == (x1 - x0 - 1) or rx % step == 0:
                cv.p(x, y, col(ramp, 1 if rx % (step * 2) == 0 else 2))
    cv.hline(x0, x1, y1 - 1, col(ramp, 0))


def draw_glass_rail(cv, x0, x1, y0, y1, post_ramp='steel', tint_i=4, frame_i=1, step=8):
    """Modern tempered-glass Juliet/balcony railing with specular sheen & metallic rail."""
    cv.hline(x0, x1, y0, col(post_ramp, 5))
    cv.hline(x0, x1, y0 + 1, col(post_ramp, frame_i))
    for y in range(y0 + 2, y1 - 1):
        ry = y - (y0 + 2)
        for x in range(x0, x1):
            rx = x - x0
            if rx == 0 or rx == (x1 - x0 - 1) or rx % step == 0:
                cv.p(x, y, col(post_ramp, 2 if rx % step == 0 else frame_i))
            elif (rx + ry) % 7 == 1:
                cv.p(x, y, col('glass', 6))
            elif (rx + ry) % 7 == 2:
                cv.p(x, y, col('glass', 5))
            else:
                cv.p(x, y, col('glass', tint_i if ry < (y1 - y0) // 2 else max(2, tint_i - 1)))
    cv.hline(x0, x1, y1 - 1, col(post_ramp, frame_i))


def draw_ac_wall(cv, x, y, pipe_down=5):
    """Compact 8x6 wall-mounted or balcony AC outdoor condenser with fan & copper pipe."""
    cv.outline_box(x, y, x + 8, y + 6, col('coolwhite', 4), col('steel', 1), top_hi=col('white', 6))
    cv.rect(x + 1, y + 2, x + 5, y + 5, col('steel', 1))
    cv.p(x + 2, y + 3, col('steel', 4))
    cv.p(x + 3, y + 3, col('steel', 3))
    cv.p(x + 6, y + 2, col('steel', 3))
    cv.p(x + 6, y + 4, col('steel', 2))
    cv.hline(x + 1, x + 8, y + 6, col('ink', 1))
    if pipe_down > 0:
        cv.vline(x + 8, y + 3, y + 3 + pipe_down, col('steel', 2))


def draw_laundry_line(cv, x0, x1, y, garments, post_h=7, shadow_y=None, shadow_c=None):
    """Rooftop or balcony clothesline strung between steel poles with colorful garments."""
    # Poles
    cv.vline(x0, y - 1, y + post_h, col('steel', 1))
    cv.p(x0, y - 1, col('steel', 5))
    cv.vline(x1 - 1, y - 1, y + post_h, col('steel', 1))
    cv.p(x1 - 1, y - 1, col('steel', 5))
    # Wire
    cv.hline(x0 + 1, x1 - 1, y, col('steel', 4))
    # Garments: list of (offset_x, width, height, ramp, hi_i, mid_i)
    for ox, gw, gh, rmp, hi_i, mid_i in garments:
        gx = x0 + 2 + ox
        if gx + gw >= x1 - 1:
            continue
        cv.rect(gx, y + 1, gx + gw, y + 1 + gh, col(rmp, mid_i))
        cv.hline(gx, gx + gw, y + 1, col(rmp, hi_i))
        cv.vline(gx + gw - 1, y + 1, y + 1 + gh, col(rmp, max(0, mid_i - 2)))
        cv.hline(gx, gx + gw, y + 1 + gh, col(rmp, max(0, mid_i - 2)))
        if shadow_y is not None and shadow_c is not None:
            cv.hline(gx + 1, gx + gw + 1, shadow_y, shadow_c)


def draw_potted_tree(cv, cx, base_y, rx=4, ry=4, pot_ramp='brick', blossom=None, seed=0):
    """Potted ornamental shrub or tree with terracotta/stone pot & shaded canopy."""
    # Pot
    cv.outline_box(cx - 3, base_y - 4, cx + 4, base_y, col(pot_ramp, 4), col(pot_ramp, 1), top_hi=col(pot_ramp, 6))
    cv.hline(cx - 2, cx + 3, base_y, col('ink', 1))
    # Trunk
    cv.vline(cx, base_y - 6, base_y - 3, col('wood', 2))
    # Canopy
    cv.foliage_cluster(cx, base_y - 6 - ry // 2, rx, ry, ramp='foliage', seed=seed, blossom=blossom)


def draw_solar_panel(cv, x, y, w=13, h=8):
    """Angled rooftop photovoltaic solar panel on steel rack."""
    # Steel rack shadow & legs
    cv.hline(x + 1, x + w + 1, y + h + 1, col('ink', 1))
    cv.vline(x + 2, y + h - 1, y + h + 1, col('steel', 1))
    cv.vline(x + w - 3, y + h - 1, y + h + 1, col('steel', 1))
    # Panel frame
    cv.outline_box(x, y, x + w, y + h, col('navy', 2), col('steel', 5), top_hi=col('coolwhite', 5))
    for py in range(y + 1, y + h - 1):
        for px in range(x + 1, x + w - 1):
            rx, ry = px - (x + 1), py - (y + 1)
            if rx % 3 == 2 or ry % 3 == 2:
                cv.p(px, py, col('steel', 4))
            elif rx + ry in (1, 2):
                cv.p(px, py, col('glass', 5))
            elif ry == 0:
                cv.p(px, py, col('blue', 4))
            else:
                cv.p(px, py, col('navy', 2 if (rx + ry) % 2 == 0 else 3))


def draw_car_rear(cv, x, y, body_ramp='coolwhite'):
    """Crisp top-3/4 rear view of a parked Korean hatchback/sedan inside a piloti bay (24x18)."""
    # Ground shadow under car
    cv.rect(x + 1, y + 14, x + 23, y + 18, col('ink', 0))
    # Tires
    cv.rect(x + 2, y + 13, x + 6, y + 17, col('kuro', 0))
    cv.vline(x + 3, y + 14, y + 16, col('steel', 2))
    cv.rect(x + 18, y + 13, x + 22, y + 17, col('kuro', 0))
    cv.vline(x + 19, y + 14, y + 16, col('steel', 2))
    # Upper cabin / roof (top-3/4 visible sunlit top)
    cv.outline_box(x + 4, y, x + 20, y + 5, col(body_ramp, 4), col('ink', 1), top_hi=col(body_ramp, 5))
    # Side mirrors
    cv.rect(x + 2, y + 4, x + 4, y + 6, col(body_ramp, 3))
    cv.rect(x + 20, y + 4, x + 22, y + 6, col(body_ramp, 2))
    # Rear windshield
    cv.outline_box(x + 4, y + 4, x + 20, y + 9, col('glass', 1), col('ink', 1))
    cv.hline(x + 6, x + 12, y + 5, col('glass', 4))
    cv.p(x + 6, y + 6, col('glass', 3))
    # Rear trunk & bumper
    cv.outline_box(x + 2, y + 8, x + 22, y + 15, col(body_ramp, 3), col('ink', 1), top_hi=col(body_ramp, 5), bot_sh=col('steel', 2))
    # Taillights (glowing red)
    cv.rect(x + 3, y + 9, x + 7, y + 11, col('red', 4))
    cv.p(x + 4, y + 9, col('red', 5))
    cv.rect(x + 17, y + 9, x + 21, y + 11, col('red', 4))
    cv.p(x + 18, y + 9, col('red', 5))
    # Korean white license plate
    cv.rect(x + 9, y + 10, x + 15, y + 13, col('white', 6))
    cv.hline(x + 10, x + 14, y + 11, col('ink', 2))
    # Rear bumper trim
    cv.hline(x + 3, x + 21, y + 13, col('steel', 2))


def draw_bike(cv, x, y, frame_ramp='blue'):
    """Crisp 12x9 parked bicycle silhouette with bright rim highlights for piloti clarity."""
    # Ground shadow
    cv.hline(x + 1, x + 11, y + 8, col('ink', 0))
    # Wheels with crisp tire & metallic hub highlights
    for wx in (x + 1, x + 8):
        cv.rect(wx, y + 4, wx + 3, y + 8, col('kuro', 0))
        cv.p(wx + 1, y + 5, col('coolwhite', 5))
        cv.p(wx + 1, y + 6, col('steel', 4))
    # Bright painted diamond frame
    cv.hline(x + 3, x + 9, y + 4, col(frame_ramp, 5))
    cv.hline(x + 4, x + 8, y + 5, col(frame_ramp, 3))
    cv.vline(x + 4, y + 2, y + 6, col(frame_ramp, 4))
    cv.vline(x + 8, y + 2, y + 6, col(frame_ramp, 5))
    # Seat & shiny chrome handlebars
    cv.hline(x + 3, x + 6, y + 1, col('darkwood', 3))
    cv.hline(x + 7, x + 10, y + 1, col('white', 6))
    # Front basket
    cv.rect(x + 9, y + 2, x + 11, y + 4, col('coolwhite', 4))


def draw_address_plaque(cv, x, y):
    """Iconic Korean blue road-name address plaque (5x4)."""
    cv.rect(x, y, x + 5, y + 4, col('blue', 2))
    cv.hline(x + 1, x + 4, y, col('blue', 4))
    cv.p(x + 1, y + 2, col('white', 6))
    cv.p(x + 3, y + 2, col('white', 6))


def draw_mailbox_bank(cv, x0, y0, x1, y1):
    """Stainless apartment/villa mailbox bank with dark mail slots."""
    cv.outline_box(x0, y0, x1, y1, col('coolwhite', 3), col('steel', 1), top_hi=col('coolwhite', 5))
    for y in range(y0 + 2, y1 - 2, 3):
        for x in range(x0 + 2, x1 - 2, 4):
            cv.hline(x, min(x + 3, x1 - 1), y, col('steel', 1))
            cv.p(x, y + 1, col('coolwhite', 5))


def draw_stone_blocks(cv, x0, y0, x1, y1, ramp='stone', base_i=3, ch=5, bw=9, moss=0.0, seed=0):
    """Rustic cut-stone ashlar plinth or hillside retaining wall with optional mossy joints."""
    for y in range(max(0, y0), min(cv.h, y1)):
        ry = y - y0
        ci = ry // ch
        yy = ry % ch
        off = (bw // 2) if (ci % 2 == 1) else 0
        for x in range(max(0, x0), min(cv.w, x1)):
            rx = (x - x0) + off
            bi = rx // bw
            bx = rx % bw
            r = hsh(bi, ci, seed)
            if yy == ch - 1 or bx == bw - 1:
                if moss > 0 and hsh(x, y, seed + 41) < moss:
                    cv.p(x, y, col('moss', 3 if yy == ch - 1 else 2))
                else:
                    cv.p(x, y, col(ramp, max(0, base_i - 2)))
            else:
                t = base_i + (1 if r > 0.72 else (-1 if r < 0.24 else 0))
                if yy == 0:
                    t = min(t + 1, 6)
                elif yy == ch - 2:
                    t = max(1, t - 1)
                if moss > 0 and yy == 0 and hsh(bi, ci, seed + 77) < moss * 0.7:
                    cv.p(x, y, col('moss', 4))
                else:
                    cv.p(x, y, col(ramp, t))


def draw_exposed_concrete(cv, x0, y0, x1, y1, ramp='concrete', base_i=4, pw=14, ph=12, seed=0):
    """Minimalist architectural exposed concrete (노출콘크리트) with formwork joints & cone holes."""
    cv.stipple_rect(x0, y0, x1, y1, ramp, base_i, max(1, base_i - 1), min(6, base_i + 1), seed=seed, rate=0.12)
    for y in range(y0, y1):
        ry = y - y0
        if ry > 0 and ry % ph == 0:
            cv.hline(x0, x1, y, col(ramp, max(1, base_i - 2)))
            if y + 1 < y1:
                cv.hline(x0, x1, y + 1, col(ramp, min(6, base_i + 1)))
    for x in range(x0, x1):
        rx = x - x0
        if rx > 0 and rx % pw == 0:
            cv.vline(x, y0, y1, col(ramp, max(1, base_i - 2)))
    # Cone tie-rod dots (refined architectural tone)
    for cy in range(y0 + ph // 2, y1 - 2, ph):
        for cx in range(x0 + 3, x1 - 3, pw // 2):
            cv.p(cx, cy, col(ramp, max(1, base_i - 2)))


def draw_hipped_roof(cv, x0, y0, x1, y1, ramp='rooftile', ridge_pad=12, moss_rate=0.05, seed=0):
    """Top-3/4 hipped pitched shingle roof with angled hip ridges, sunlit crest, and deep eave."""
    w = x1 - x0
    h = y1 - y0
    rpad = min(ridge_pad, w // 3)
    for y in range(max(0, y0), min(cv.h, y1)):
        ry = y - y0
        # Horizontal inset tapers inward toward top ridge
        t = 1.0 - (ry / max(1, h - 2))
        inset = int(round(t * rpad))
        lx = x0 + inset
        rx_end = x1 - inset
        for x in range(lx, rx_end):
            rx = x - x0
            if ry == 0:
                cv.p(x, y, col(ramp, 6 if lx < x < rx_end - 1 else 1))
            elif ry == 1:
                cv.p(x, y, col(ramp, 5 if rx % 3 != 0 else 4))
            elif ry == h - 1:
                cv.p(x, y, col(ramp, 0))
            elif ry == h - 2:
                cv.p(x, y, col(ramp, 1 if rx % 4 != 1 else 2))
            elif x == lx or x == rx_end - 1:
                cv.p(x, y, col(ramp, 1 if x == lx else 0))
            elif x == lx + 1:
                cv.p(x, y, col(ramp, 5))  # Left hip ridge highlight
            elif x == rx_end - 2:
                cv.p(x, y, col(ramp, 2))  # Right hip ridge shadow
            else:
                ci = (ry - 2) // 4
                yy = (ry - 2) % 4
                tw = 4
                bx = (rx + (2 if ci % 2 else 0)) % tw
                bi = (rx + (2 if ci % 2 else 0)) // tw
                r = hsh(bi, ci, seed)
                right_sh = 1 if (rx_end - x) <= 5 else 0
                if yy == 3 or bx == tw - 1:
                    cv.p(x, y, col(ramp, max(0, 1 - right_sh)))
                elif moss_rate > 0 and r > 1.0 - moss_rate and ry >= h // 2:
                    cv.p(x, y, col('moss', 3 if yy <= 1 else 2))
                else:
                    base_t = 4 if ry < h // 2 else 3
                    if r > 0.78:
                        base_t += 1
                    elif r < 0.22:
                        base_t -= 1
                    if yy == 0 and bx == 0:
                        base_t += 1
                    cv.p(x, y, col(ramp, max(1, min(6, base_t - right_sh))))


def draw_gable_roof(cv, x0, y0, x1, y1, ramp='kuro', trim_ramp='white', wall_ramp='white', wall_i=5, seed=0):
    """Top-3/4 front-gable roof with angled shingle eaves & warm cream/white pediment infill."""
    w = x1 - x0
    h = y1 - y0
    cx = (x0 + x1) // 2
    for y in range(max(0, y0), min(cv.h, y1)):
        ry = y - y0
        half_w = int(round((ry / max(1, h - 2)) * (w // 2))) + 2
        lx = max(x0, cx - half_w)
        rx_end = min(x1, cx + half_w)
        # Inner gable triangle starts 4px below peak
        in_half = max(0, half_w - 5)
        ilx = cx - in_half
        irx = cx + in_half
        for x in range(lx, rx_end):
            if ry <= 1:
                cv.p(x, y, col(ramp, 5 if ry == 1 else 1))
            elif x <= lx + 1 or x >= rx_end - 2:
                cv.p(x, y, col(ramp, 0 if x == rx_end - 1 else 1))
            elif ry >= 5 and ilx <= x < irx:
                # Pediment wall inside gable
                if x == ilx or x == irx - 1:
                    cv.p(x, y, col(trim_ramp, 2))
                elif ry == 5 or (x == ilx + 1 or x == irx - 2):
                    cv.p(x, y, col(trim_ramp, 5))
                else:
                    r = hsh(x, y, seed)
                    cv.p(x, y, col(wall_ramp, wall_i + (-1 if r < 0.12 else 0)))
            else:
                # Shingled bargeboard / roof slope flanking gable
                ci = ry // 3
                bx = (x + ci * 2) % 4
                r = hsh(x // 3, ci, seed)
                right_sh = 1 if x > cx else 0
                if ry % 3 == 2 or bx == 3:
                    cv.p(x, y, col(ramp, max(0, 1 - right_sh)))
                else:
                    cv.p(x, y, col(ramp, max(1, (4 if r > 0.5 else 3) - right_sh)))
    # Crisp bottom eave line
    cv.hline(x0, x1, y1 - 1, col(ramp, 0))


def draw_exterior_stairs(cv, x0, y0, x1, y1, descend_right=True, step_h=4, ramp='concrete', rail_ramp='steel'):
    """Stepped exterior concrete staircase with iron handrail and risers."""
    steps = max(3, (y1 - y0) // step_h)
    w = x1 - x0
    for i in range(steps):
        sy0 = y0 + i * step_h
        sy1 = min(y1, sy0 + step_h)
        frac0 = i / steps
        frac1 = min(1.0, (i + 1.35) / steps)
        if descend_right:
            sx0 = x0 + int(frac0 * (w - 6))
            sx1 = min(x1, x0 + int(frac1 * w))
        else:
            sx1 = x1 - int(frac0 * (w - 6))
            sx0 = max(x0, x1 - int(frac1 * w))
        # Step tread & riser
        cv.rect(sx0, sy0, sx1, sy1, col(ramp, 4))
        cv.hline(sx0, sx1, sy0, col(ramp, 6))
        cv.hline(sx0, sx1, sy1 - 1, col(ramp, 1))
        cv.vline(sx0, sy0, sy1, col(ramp, 1))
        cv.vline(sx1 - 1, sy0, sy1, col(ramp, 0))
        # Under-stair concrete stringer fill
        cv.rect(sx0, sy1, sx1, min(y1, sy1 + 3), col(ramp, 2))
        # Iron handrail posts along outer edge
        rx_post = sx1 - 1 if descend_right else sx0
        cv.vline(rx_post, max(y0 - 4, sy0 - 5), sy0 + 1, col(rail_ramp, 1))
        cv.p(rx_post, max(y0 - 4, sy0 - 5), col(rail_ramp, 5))


def draw_pergola(cv, x0, y0, x1, y1, ramp='cedar'):
    """Sunlit top-3/4 cedar rooftop pergola casting shadow stripes on deck below."""
    # Cast shadow stripes underneath
    for sx in range(x0 + 2, x1 - 1, 4):
        cv.vline(sx, y0 + 2, y1 + 1, col('ink', 1))
    # Corner posts
    for px in (x0, x1 - 2):
        cv.rect(px, y0 + 2, px + 2, y1, col(ramp, 2))
        cv.vline(px, y0 + 2, y1, col(ramp, 4))
    # Main longitudinal beams
    cv.hline(x0, x1, y0, col(ramp, 1))
    cv.hline(x0, x1, y0 + 1, col(ramp, 5))
    cv.hline(x0, x1, y0 + 2, col(ramp, 3))
    cv.hline(x0, x1, y0 + 3, col(ramp, 1))
    # Cross slats
    for sx in range(x0 + 2, x1 - 2, 4):
        cv.vline(sx, y0, y0 + 4, col(ramp, 6))
        cv.vline(sx + 1, y0 + 1, y0 + 4, col(ramp, 2))


def draw_bistro_set(cv, x, y):
    """Charming terrace bistro table with coffee cup & side chairs (16x11)."""
    # Left chair
    cv.rect(x, y + 3, x + 4, y + 9, col('wood', 3))
    cv.hline(x, x + 4, y + 3, col('cedar', 5))
    cv.vline(x, y + 3, y + 10, col('wood', 1))
    cv.vline(x + 3, y + 6, y + 10, col('wood', 1))
    # Center round bistro table
    cv.outline_box(x + 5, y + 2, x + 12, y + 6, col('white', 5), col('steel', 2), top_hi=col('white', 6))
    cv.p(x + 7, y + 3, col('orange', 4))  # Warm coffee mug
    cv.p(x + 9, y + 3, col('red', 4))     # Small vase/cup
    cv.vline(x + 8, y + 6, y + 10, col('steel', 1))
    cv.hline(x + 6, x + 11, y + 10, col('steel', 1))
    # Right chair
    cv.rect(x + 13, y + 3, x + 17, y + 9, col('wood', 3))
    cv.hline(x + 13, x + 17, y + 3, col('cedar', 5))
    cv.vline(x + 16, y + 3, y + 10, col('wood', 1))
    cv.vline(x + 13, y + 6, y + 10, col('wood', 1))


def draw_veranda_enclosure(cv, x0, y0, x1, y1, cfg, seed=0):
    """Richly individualized Korean apartment sunlit veranda / balcony bay.

    cfg keys:
      wall_ramp, wall_i, warm (bool), style ('glass'|'warm'|'blinds'),
      curtain (ramp|None), rail ('solid'|'glass'|'iron'),
      parapet_ramp, parapet_i,
      laundry (list of garment tuples or None),
      futon (ramp|None), plants (int 0..3), ac (bool),
      shelf (bool), open_sash (bool), flower_color (str)
    """
    w = x1 - x0
    h = y1 - y0
    # Dark interior recess framing
    cv.outline_box(x0, y0, x1, y1, col('concrete', 1), col('steel', 1))
    # Ceiling shadow band
    cv.hline(x0 + 1, x1 - 1, y0 + 1, col('ink', 1))

    # Upper glazed sliding veranda windows
    rail_h = 8 if h >= 18 else 6
    wy0 = y0 + 2
    wy1 = y1 - rail_h
    warm = cfg.get('warm', False)
    style = cfg.get('style', 'warm' if warm else 'glass')
    curtain = cfg.get('curtain')

    # Draw 2 or 3 sliding glass panes
    panes = 3 if w >= 30 else 2
    pw = (w - 2) // panes
    for pi in range(panes):
        px0 = x0 + 1 + pi * pw
        px1 = (x1 - 1) if pi == panes - 1 else (px0 + pw + 1)
        p_warm = warm and (pi != 2 or cfg.get('all_warm', False))
        p_style = style if not p_warm else 'warm'
        if cfg.get('open_sash') and pi == 1:
            # Open dark interior with visible room furniture/bookshelf
            cv.outline_box(px0, wy0, px1, wy1, col('wood', 1 if not warm else 3), col('steel', 1))
            if warm:
                cv.rect(px0 + 1, wy0 + 2, px1 - 1, wy1 - 1, col('orange', 3))
                cv.rect(px0 + 2, wy0 + 3, px1 - 2, wy1 - 2, col('yellow', 4))
            else:
                cv.rect(px0 + 1, wy0 + 2, px1 - 1, wy1 - 1, col('ink', 2))
        else:
            cv.window(px0, wy0, px1, wy1, style=p_style, frame='steel:1', sill=None,
                      curtain=curtain if pi in (0, panes - 1) else None, warm=p_warm, seed=seed + pi * 17)
        # Optional bookshelf / lamp silhouette inside warm room
        if p_warm and cfg.get('shelf') and pi == 0 and (px1 - px0) >= 8:
            cv.rect(px0 + 2, wy0 + 2, px0 + 6, wy1 - 1, col('wood', 2))
            cv.p(px0 + 3, wy0 + 3, col('red', 4))
            cv.p(px0 + 4, wy0 + 3, col('blue', 4))
            cv.p(px0 + 3, wy0 + 5, col('yellow', 5))
        if p_warm and cfg.get('lamp') and pi == 1 and (px1 - px0) >= 7:
            mx = (px0 + px1) // 2
            cv.vline(mx, wy0 + 1, wy0 + 3, col('steel', 1))
            cv.hline(mx - 1, mx + 2, wy0 + 3, col('white', 6))
            cv.p(mx, wy0 + 4, col('yellow', 5))

    # Lower railing / solid parapet / glass balustrade
    ry0 = wy1
    rail_kind = cfg.get('rail', 'solid')
    if rail_kind == 'glass':
        draw_glass_rail(cv, x0, x1, ry0, y1, post_ramp='steel', tint_i=4, step=8)
    elif rail_kind == 'iron':
        cv.rect(x0 + 1, ry0, x1 - 1, y1 - 1, col('concrete', 3))
        draw_iron_rail(cv, x0, x1, ry0, y1, ramp='steel', step=3)
    else:
        pr = cfg.get('parapet_ramp', 'coolwhite')
        pi_i = cfg.get('parapet_i', 4)
        cv.outline_box(x0, ry0, x1, y1, col(pr, pi_i), col('concrete', 1), top_hi=col(pr, min(5, pi_i + 1)), bot_sh=col(pr, max(1, pi_i - 2)))
        # Subtle panel joints on concrete veranda parapet
        for gx in range(x0 + 10, x1 - 4, 12):
            cv.vline(gx, ry0 + 1, y1 - 1, col(pr, max(1, pi_i - 1)))

    # Optional airing futon/quilt draped over balcony rail
    futon = cfg.get('futon')
    if futon:
        fx0 = x0 + cfg.get('futon_x', 6)
        fx1 = min(x1 - 3, fx0 + 11)
        cv.outline_box(fx0, ry0 - 1, fx1, y1 - 1, col(futon, 4), col(futon, 1), top_hi=col(futon, 5))
        for fy in range(ry0 + 1, y1 - 2, 2):
            for fx in range(fx0 + 2, fx1 - 2, 3):
                cv.p(fx, fy, col('white', 6))

    # Optional hanging laundry on veranda drying bar
    laundry = cfg.get('laundry')
    if laundry:
        lx0 = x0 + 3
        lx1 = x1 - 3
        cv.hline(lx0, lx1, wy0 + 2, col('steel', 4))
        for ox, gw, gh, rmp, hi_i, mid_i in laundry:
            gx = lx0 + ox
            if gx + gw < lx1:
                cv.rect(gx, wy0 + 3, gx + gw, min(ry0 + 2, wy0 + 3 + gh), col(rmp, mid_i))
                cv.hline(gx, gx + gw, wy0 + 3, col(rmp, hi_i))
                cv.vline(gx + gw - 1, wy0 + 3, min(ry0 + 2, wy0 + 3 + gh), col(rmp, max(0, mid_i - 2)))

    # Optional potted plants sitting along veranda rail/sill
    n_plants = cfg.get('plants', 0)
    flw = cfg.get('flower_color', 'red:4')
    if n_plants > 0:
        px_start = x0 + cfg.get('plant_x', 4)
        for i in range(n_plants):
            px = px_start + i * 7
            if px + 5 < x1 - 2:
                cv.planter_box(px, ry0 - 4, px + 6, ry0 + 1, flower=flw, pot_ramp='brick')

    # Optional outdoor AC condenser tucked in balcony corner
    if cfg.get('ac'):
        ax = (x1 - 10) if cfg.get('ac_right', True) else (x0 + 2)
        draw_ac_wall(cv, ax, ry0 - 4, pipe_down=0)


def frame_building_edges(cv, x0, x1, y0, y1):
    """Crisp Fable-style architectural edge grounding along building outer walls."""
    for y in range(max(0, y0), min(cv.h, y1)):
        if 0 <= x0 < cv.w and cv.get(x0, y)[3] == 255:
            cv.p(x0, y, shade_rgba(cv.get(x0, y), -2))
        if 0 <= x1 - 1 < cv.w and cv.get(x1 - 1, y)[3] == 255:
            cv.p(x1 - 1, y, shade_rgba(cv.get(x1 - 1, y), -2))
    for x in range(max(0, x0), min(cv.w, x1)):
        if 0 <= y1 - 1 < cv.h and cv.get(x, y1 - 1)[3] == 255:
            cv.p(x, y1 - 1, col('ink', 0))


# ===========================================================================
# 1. mf-bldg-kr_piloti_brick_villa (96x128) — Iconic Korean 4F red-brick piloti villa
# ===========================================================================

def draw_kr_piloti_brick_villa(cv):
    x0, x1 = 4, 92
    # --- Roof (y=2..24): Green urethane flat roof + stairwell penthouse + laundry line ---
    cv.flat_roof(x0, 2, x1, 24, para_ramp='concrete', seed=101, urethane_green=True)
    # Stairwell penthouse on center-right
    cv.roof_penthouse(56, 4, w=16, h=14, ramp='concrete')
    cv.hline(57, 71, 4, col('brick', 3))  # Brick trim cap matching villa
    # Rooftop water tank on far right
    cv.roof_tank(76, 5)
    # Laundry drying line on left green urethane deck
    draw_laundry_line(
        cv, 10, 50, 10,
        garments=[
            (2, 6, 5, 'white', 6, 5),
            (10, 5, 6, 'blue', 5, 3),
            (17, 6, 4, 'pink', 5, 4),
            (25, 5, 5, 'yellow', 5, 4),
            (31, 5, 5, 'teal', 5, 3),
        ],
        post_h=8, shadow_y=18, shadow_c=col('midori', 2)
    )
    # Small rooftop potted pepper plant near parapet
    cv.planter_box(12, 16, 20, 20, flower='red:4', pot_ramp='brick')

    # --- 2F–4F Warm Red-Brick Facade (y=24..92) ---
    cv.brick_wall(x0, 24, x1, 92, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=202)
    # Concrete corner quoins / side pilasters
    for y in range(24, 92, 6):
        cv.rect(x0, y, x0 + 3, y + 3, col('concrete', 5))
        cv.rect(x1 - 3, y, x1, y + 3, col('concrete', 4))
    # Horizontal floor slab bands separating 4F, 3F, 2F, 1F piloti
    draw_slab_band(cv, x0 - 1, x1 + 1, 24, ramp='concrete', h=3)
    draw_slab_band(cv, x0 - 1, x1 + 1, 46, ramp='concrete', h=3)
    draw_slab_band(cv, x0 - 1, x1 + 1, 68, ramp='concrete', h=3)
    draw_slab_band(cv, x0 - 1, x1 + 1, 90, ramp='stone', h=4)

    # Center-right vertical stairwell frosted glass strip (iconic Korean villa staircase!)
    sx0, sx1 = 56, 65
    cv.rect(sx0 - 1, 27, sx1 + 1, 90, col('concrete', 3))
    cv.vline(sx0 - 1, 27, 90, col('concrete', 1))
    cv.vline(sx1, 27, 90, col('concrete', 1))
    for fy, lit in ((29, False), (51, True), (73, False)):
        cv.window(sx0, fy, sx1, fy + 14, style='warm' if lit else 'glass', frame='steel:1', sill='concrete:5', warm=lit)
        cv.hline(sx0 + 1, sx1 - 1, fy + 7, col('concrete', 4))  # Landing slab shadow

    # --- 4F (y=27..46): Left wide balcony window w/ blinds, plants & AC; Right warm pink-curtained room ---
    cv.window(10, 30, 34, 43, style='blinds', frame='steel:1', sill='concrete:5', curtain='blue', seed=41)
    draw_iron_rail(cv, 9, 35, 38, 44, ramp='steel', step=3)
    cv.planter_box(11, 35, 19, 39, flower='yellow:5', pot_ramp='brick')
    draw_ac_wall(cv, 38, 35, pipe_down=10)
    cv.window(70, 30, 86, 43, style='warm', frame='steel:1', sill='concrete:5', curtain='pink', warm=True, seed=42)
    cv.planter_box(73, 41, 83, 45, flower='red:4', pot_ramp='cedar')

    # --- 3F (y=49..68): Left cool sky-glass w/ hanging laundry rack; Right warm teal drapes + AC ---
    cv.window(10, 52, 34, 65, style='glass', frame='steel:1', sill='concrete:5', curtain='cream', seed=31)
    draw_iron_rail(cv, 9, 35, 59, 66, ramp='steel', step=3)
    # Hanging colorful towels/clothes on 3F balcony rail
    cv.rect(13, 59, 19, 65, col('blue', 4))
    cv.hline(13, 19, 59, col('blue', 5))
    cv.rect(22, 59, 27, 64, col('white', 6))
    cv.rect(29, 60, 33, 65, col('orange', 4))
    # Small potted herb on 3F sill
    cv.planter_box(39, 60, 48, 65, flower='pink:4', pot_ramp='brick')
    cv.window(70, 52, 86, 65, style='warm', frame='steel:1', sill='concrete:5', curtain='teal', warm=True, seed=32)
    draw_ac_wall(cv, 43, 52, pipe_down=12)

    # --- 2F (y=71..90): Left cozy warm backlit bay w/ open window & flowers; Right closed navy drapes ---
    cv.window(10, 74, 34, 87, style='warm', frame='steel:1', sill='concrete:5', curtain='orange', warm=True, seed=21)
    # Silhouetted interior lamp
    cv.vline(22, 75, 78, col('steel', 1))
    cv.hline(20, 25, 78, col('white', 6))
    draw_iron_rail(cv, 9, 35, 81, 88, ramp='steel', step=3)
    cv.planter_box(12, 79, 22, 83, flower='red:4', pot_ramp='brick')
    cv.planter_box(25, 79, 33, 83, flower='yellow:5', pot_ramp='brick')
    # Right 2F shaded bedroom with navy curtains & utility gas pipe
    cv.window(70, 74, 86, 87, style='glass', frame='steel:1', sill='concrete:5', curtain='navy', seed=22)
    cv.vline(88, 27, 90, col('steel', 2))  # Exterior gas/rain pipe
    cv.vline(89, 27, 90, col('steel', 4))

    # --- 1F Shadowed Piloti Parking Bay + Stone Columns + Parked Car + Glass Lobby (y=94..128) ---
    # Deep shadowed piloti parking interior (left & center)
    cv.rect(x0 + 1, 94, 62, 127, col('asphalt', 1))
    cv.hline(x0 + 1, 62, 94, col('ink', 0))
    cv.hline(x0 + 1, 62, 95, col('ink', 0))
    cv.hline(x0 + 1, 62, 96, col('asphalt', 0))
    # Back piloti wall concrete dado, parking pipe & red fire extinguisher box
    cv.rect(x0 + 6, 97, 56, 114, col('asphalt', 2))
    cv.hline(x0 + 6, 56, 100, col('steel', 2))
    cv.hline(x0 + 6, 56, 108, col('yellow', 3))  # Parking bumper warning stripe
    cv.rect(13, 102, 16, 107, col('red', 4))     # Piloti fire extinguisher/hydrant box
    cv.p(14, 103, col('red', 5))
    # Piloti concrete floor slab & white parking lines + wheel-stop block
    cv.stipple_rect(x0 + 1, 114, 62, 127, 'pavement', 3, 2, 4, seed=19, rate=0.16)
    cv.vline(14, 115, 127, col('white', 5))
    cv.vline(46, 115, 127, col('white', 5))
    cv.hline(20, 42, 124, col('yellow', 4))      # Parking curb wheel-stop
    # Recessed piloti ceiling LED glow
    cv.hline(24, 34, 96, col('yellow', 5))

    # Parked Korean car rear inside shadowed piloti bay!
    draw_car_rear(cv, 19, 106, body_ramp='coolwhite')

    # Stone piloti columns (left, center divider)
    for cx in (x0, 52):
        draw_stone_blocks(cv, cx, 94, cx + 8, 127, ramp='stone', base_i=4, ch=5, bw=8, seed=cx)
        cv.vline(cx, 94, 127, col('stone', 1))
        cv.vline(cx + 7, 94, 127, col('stone', 0))
        cv.rect(cx - 1, 123, cx + 9, 127, col('stone', 2))
        cv.hline(cx - 1, cx + 9, 123, col('stone', 5))

    # Right side (x=60..92): Stone-clad glass security lobby door, intercom & mailboxes
    draw_stone_blocks(cv, 60, 94, x1, 127, ramp='stone', base_i=4, ch=5, bw=8, seed=60)
    # Recessed glass security lobby door (공동현관)
    cv.door_glass(64, 100, 80, 125, frame='steel:1', warm=True)
    # Concrete canopy overhang above lobby door
    cv.rect(62, 97, 82, 100, col('steel', 2))
    cv.hline(62, 82, 97, col('steel', 5))
    cv.hline(63, 81, 100, col('ink', 0))
    # Intercom / keypad panel & address plaque
    cv.outline_box(82, 108, 86, 114, col('steel', 4), col('steel', 0))
    cv.p(83, 109, col('glass', 5))  # Screen
    cv.p(84, 111, col('green', 4))  # Green call LED
    draw_address_plaque(cv, 82, 101)
    # Stainless mailboxes + small potted bush beside entrance
    draw_mailbox_bank(cv, 81, 116, 90, 124)
    cv.planter_box(51, 120, 61, 126, flower='red:4', pot_ramp='brick')
    # Grounding curb shadow
    cv.hline(x0 - 1, x1 + 1, 127, col('ink', 0))
    frame_building_edges(cv, x0, x1, 24, 128)


# ===========================================================================
# 2. mf-bldg-kr_piloti_stone_villa (96x128) — Modern pale-granite & warm-limestone 4F piloti villa
# ===========================================================================

def draw_kr_piloti_stone_villa(cv):
    x0, x1 = 4, 92
    # --- Clean Concrete Parapet Roof (y=2..24) with Solar Panel & Chimney Vent ---
    cv.flat_roof(x0, 2, x1, 24, deck_ramp='concrete', deck_i=3, para_ramp='stone', seed=202, urethane_green=False)
    # Stairwell penthouse on left
    cv.roof_penthouse(10, 4, w=15, h=14, ramp='stone')
    # Angled Solar Panel array on center-right roof deck with connecting steel rail
    cv.hline(34, 63, 15, col('steel', 2))
    draw_solar_panel(cv, 32, 7, w=15, h=9)
    draw_solar_panel(cv, 50, 7, w=15, h=9)
    # Stainless chimney exhaust vent & rooftop AC on right
    cv.outline_box(70, 5, 76, 16, col('coolwhite', 4), col('steel', 1), top_hi=col('white', 6))
    cv.rect(69, 4, 77, 6, col('steel', 2))
    cv.hline(69, 77, 4, col('coolwhite', 5))
    cv.roof_ac(78, 9)
    # Small architectural rooftop cedar planter
    cv.planter_box(27, 15, 38, 19, flower='yellow:5', pot_ramp='cedar')

    # --- 2F–4F Pale-Granite & Warm-Limestone Cladding (y=24..92) ---
    # Left & right main limestone panel facade + dark granite accent center stair pier
    cv.tile_cladding(x0, 24, 48, 92, ramp='kinari', base_i=4, cw=8, ch=6, seed=311)
    cv.tile_cladding(48, 24, 62, 92, ramp='stone', base_i=3, cw=7, ch=6, seed=312)
    cv.tile_cladding(62, 24, x1, 92, ramp='concrete', base_i=5, cw=8, ch=6, seed=313)

    # Crisp dark-bronze & limestone floor bands
    draw_slab_band(cv, x0 - 1, x1 + 1, 24, ramp='stone', accent=col('darkwood', 3), h=3)
    draw_slab_band(cv, x0 - 1, x1 + 1, 46, ramp='concrete', accent=col('stone', 4), h=3)
    draw_slab_band(cv, x0 - 1, x1 + 1, 68, ramp='concrete', accent=col('stone', 4), h=3)
    draw_slab_band(cv, x0 - 1, x1 + 1, 90, ramp='stone', accent=col('darkwood', 2), h=4)

    # Vertical granite stair-pier narrow slit windows (varied lighting per landing)
    for fy, lit in ((29, True), (51, False), (73, True)):
        cv.window(52, fy, 58, fy + 14, style='warm' if lit else 'glass', frame='darkwood:1', sill='stone:5', warm=lit)

    # --- 4F (y=27..46): Left warm-lit Juliet balcony w/ glass rail; Right cream blinds + olive pot ---
    cv.window(10, 29, 43, 44, style='warm', frame='darkwood:1', sill='stone:5', curtain='cream', warm=True, seed=401)
    # Interior hanging pendant light + plant silhouette
    cv.vline(26, 30, 33, col('darkwood', 1))
    cv.hline(25, 28, 33, col('yellow', 5))
    draw_glass_rail(cv, 9, 44, 37, 45, post_ramp='darkwood', tint_i=4, frame_i=1, step=11)
    # Right 4F bedroom with crisp blinds & bronze frame
    cv.window(66, 30, 86, 43, style='blinds', frame='darkwood:1', sill='stone:5', seed=402)
    cv.planter_box(68, 41, 76, 45, flower='yellow:5', pot_ramp='stone')

    # --- 3F (y=49..68): Left cool glass + teal curtain + wall AC; Right warm Juliet balcony w/ glass rail ---
    cv.window(10, 52, 33, 65, style='glass', frame='darkwood:1', sill='stone:5', curtain='teal', seed=301)
    draw_ac_wall(cv, 36, 56, pipe_down=8)
    # Right 3F recessed Juliet balcony with warm amber glow & glass rail
    cv.window(65, 51, 87, 66, style='warm', frame='darkwood:1', sill='stone:5', curtain='orange', warm=True, seed=302)
    draw_glass_rail(cv, 64, 88, 59, 67, post_ramp='darkwood', tint_i=4, frame_i=1, step=8)
    cv.planter_box(79, 57, 86, 61, flower='red:4', pot_ramp='cedar')

    # --- 2F (y=71..90): Left Juliet glass balcony w/ cool sky glass & flower box; Right warm studio + louver ---
    cv.window(10, 73, 43, 88, style='glass', frame='darkwood:1', sill='stone:5', curtain='pink', seed=201)
    draw_glass_rail(cv, 9, 44, 81, 89, post_ramp='darkwood', tint_i=5, frame_i=1, step=11)
    cv.planter_box(13, 79, 25, 83, flower='pink:4', pot_ramp='stone')
    # Right 2F warm studio with dark bronze louver screen
    cv.window(66, 74, 86, 87, style='warm', frame='darkwood:1', sill='stone:5', warm=True, seed=202)
    for ly in range(75, 86, 2):
        cv.hline(81, 85, ly, col('darkwood', 2))

    # --- 1F Deep Piloti Columns, Bike Corner & Lit Glazed Entry Foyer (y=94..128) ---
    # Deep shadowed piloti bay (left half)
    cv.rect(x0 + 1, 94, 52, 127, col('asphalt', 1))
    cv.hline(x0 + 1, 52, 94, col('ink', 0))
    cv.hline(x0 + 1, 52, 95, col('ink', 0))
    # Warm recessed LED ceiling spots
    for lx in (18, 30, 42):
        cv.hline(lx, lx + 3, 96, col('yellow', 5))
    # Back piloti stone dado wall
    cv.tile_cladding(x0 + 6, 97, 48, 114, ramp='stone', base_i=2, cw=8, ch=6, seed=199)
    # Smart parcel locker against back piloti wall
    cv.outline_box(35, 102, 46, 115, col('steel', 3), col('steel', 0), top_hi=col('coolwhite', 4))
    cv.rect(37, 105, 40, 108, col('glass', 4))
    # Piloti concrete floor
    cv.stipple_rect(x0 + 1, 114, 52, 127, 'pavement', 4, 3, 5, seed=91, rate=0.14)
    # Bike corner: horizontal steel bike rack + two crisp bicycles + bollards!
    cv.hline(12, 39, 116, col('steel', 4))
    cv.hline(12, 39, 117, col('steel', 1))
    draw_bike(cv, 13, 114, frame_ramp='red')
    draw_bike(cv, 26, 116, frame_ramp='teal')
    for bx in (44, 48):
        cv.rect(bx, 119, bx + 2, 126, col('steel', 2))
        cv.p(bx, 119, col('yellow', 5))

    # Granite piloti columns (left & center)
    for cx in (x0, 48):
        cv.tile_cladding(cx, 94, cx + 8, 127, ramp='stone', base_i=4, cw=4, ch=6, seed=cx + 9)
        cv.hline(cx, cx + 8, 106, col('darkwood', 2))
        cv.hline(cx, cx + 8, 118, col('darkwood', 2))
        cv.vline(cx, 94, 127, col('stone', 1))
        cv.vline(cx + 7, 94, 127, col('stone', 0))

    # Right half (x=56..92): Sleek lit glazed entry foyer!
    cv.tile_cladding(56, 94, x1, 127, ramp='stone', base_i=5, cw=7, ch=6, seed=555)
    # Bronze vestibule frame + tall glowing glass lobby doors
    cv.outline_box(59, 97, 83, 125, col('darkwood', 2), col('darkwood', 0), top_hi=col('cedar', 5))
    cv.door_glass(61, 100, 81, 124, frame='darkwood:1', warm=True)
    # Warm wood interior wall hint & glowing ceiling strip inside foyer
    cv.hline(63, 79, 102, col('yellow', 5))
    # Stone entry steps
    cv.rect(58, 124, 84, 127, col('concrete', 5))
    cv.hline(58, 84, 124, col('white', 6))
    cv.hline(58, 84, 126, col('concrete', 2))
    # Address plaque, intercom & minimalist boxwood planter on far right
    draw_address_plaque(cv, 85, 100)
    cv.outline_box(85, 107, 89, 114, col('steel', 4), col('steel', 0))
    cv.p(86, 108, col('glass', 5))
    cv.planter_box(82, 119, 91, 126, flower='yellow:5', pot_ramp='stone')
    cv.hline(x0 - 1, x1 + 1, 127, col('ink', 0))
    frame_building_edges(cv, x0, x1, 24, 128)


# ===========================================================================
# 3. mf-bldg-kr_corner_terrace_villa (112x112) — Cozy 3F brick-and-cream corner villa
# ===========================================================================

def draw_kr_corner_terrace_villa(cv):
    # Silhouette:
    #   3F recessed dormer studio & pitched terracotta/brick-brown hipped roof: x=6..86, y=2..44
    #   2F left cream living room (x=6..54, y=42..76) + WIDE walkable corner veranda terrace (x=52..106, y=42..76)
    #   1F warm red-brick ground floor & stone plinth: x=6..106, y=76..112

    # --- 3F Pitched Terracotta/Brick-Brown Hipped Top-3/4 Roof (y=2..42, x=6..88) ---
    draw_hipped_roof(cv, 6, 2, 88, 36, ramp='rooftile', ridge_pad=14, moss_rate=0.05, seed=303)
    # Brick chimney on left slope
    cv.outline_box(16, 4, 24, 16, col('brick', 4), col('brick', 0), top_hi=col('brick', 6))
    cv.hline(15, 25, 4, col('stone', 5))
    cv.hline(16, 24, 5, col('ink', 1))

    # Recessed 3F Cream Stucco Dormer Studio nestled in roof slope (x=34..68, y=14..42)
    cv.outline_box(34, 22, 68, 42, col('cream', 5), col('concrete', 1))
    cv.stipple_rect(35, 23, 67, 41, 'cream', 5, 4, 6, seed=33, rate=0.14)
    # Mini pitched gable roof over dormer studio + crisp eave cast shadow
    draw_gable_roof(cv, 32, 12, 70, 24, ramp='cha', trim_ramp='cream', wall_ramp='cream', wall_i=5, seed=34)
    cv.hline(34, 68, 24, col('ink', 1))
    # Dormer warm studio window + flower box
    cv.window(40, 26, 62, 38, style='warm', frame='wood:1', sill='cedar:5', curtain='red', warm=True, seed=35)
    cv.planter_box(42, 36, 60, 41, flower='yellow:5', pot_ramp='brick')

    # Full-width 3F attic wall & eave shadow below hipped roof (cleanly flush with roof eave)
    cv.stipple_rect(6, 36, 34, 44, 'cream', 4, 3, 5, seed=36, rate=0.12)
    cv.stipple_rect(68, 36, 88, 44, 'cream', 4, 3, 5, seed=37, rate=0.12)
    cv.hline(6, 88, 36, col('ink', 1))
    cv.hline(6, 88, 37, col('cream', 2))
    cv.vline(6, 36, 44, col('concrete', 1))
    cv.vline(87, 36, 44, col('concrete', 1))

    # --- 2F Left Cream Living Room (x=6..54, y=44..76) ---
    cv.stipple_rect(6, 44, 54, 76, 'cream', 5, 4, 6, seed=38, rate=0.15)
    # Brick quoins on left corner
    for y in range(44, 76, 6):
        cv.rect(6, y, 10, y + 3, col('brick', 4))
        cv.vline(6, y, y + 3, col('brick', 1))
    draw_slab_band(cv, 5, 55, 44, ramp='cream', accent=col('cedar', 4), h=3)
    # Cozy 2F arched/wood-framed living bay window with red drapes
    cv.window(13, 50, 35, 67, style='warm', frame='wood:1', sill='cedar:5', curtain='red', warm=True, seed=39)
    cv.planter_box(15, 66, 33, 71, flower='pink:4', pot_ramp='brick')
    # Tall French parlor window on right of 2F left living room (with Juliet iron guard rail)
    cv.window(39, 50, 50, 67, style='warm', frame='wood:1', sill='cedar:5', warm=True, seed=391)
    draw_iron_rail(cv, 38, 51, 61, 67, ramp='steel', step=3)
    cv.hline(38, 51, 49, col('wood', 5))  # Small wooden window hood

    # --- 2F WIDE WALKABLE CORNER VERANDA TERRACE (x=54..106, y=42..77) ---
    # 1. Upper Cream-Stucco Back Wall (x=54..106, y=44..61) clearly distinct from wood floor below!
    cv.stipple_rect(54, 44, 106, 61, 'cream', 5, 4, 6, seed=401, rate=0.14)
    # Crisp right-side brick corner quoins on terrace back wall matching left 2F wall
    for y in range(46, 61, 6):
        cv.rect(102, y, 106, y + 3, col('brick', 4))
        cv.vline(105, y, y + 3, col('brick', 1))
    # Top brick/tile wall coping along exposed right roof edge (x=88..106, y=42..45) & 3F overhang shadow
    cv.rect(88, 42, 107, 45, col('rooftile', 3))
    cv.hline(88, 107, 42, col('rooftile', 5))
    cv.hline(88, 107, 44, col('rooftile', 1))
    cv.hline(54, 106, 45, col('ink', 1))
    cv.hline(54, 106, 46, col('cream', 3))
    # Subtle left-wall shadow cast by protruding 2F living room onto recessed terrace back wall
    cv.vline(54, 45, 61, col('concrete', 1))
    cv.vline(55, 45, 61, col('cream', 3))
    # Deck-level glazed sliding glass terrace door set directly into the cream back wall! (x=61..77, y=47..61)
    cv.hline(60, 78, 46, col('wood', 5))  # Crisp wooden door lintel
    cv.door_glass(61, 47, 77, 61, frame='wood:1', warm=True)
    # Warm terrace wall sconce & cozy upper terrace wall window with ivy trellis on right back wall
    cv.p(79, 51, col('yellow', 5))
    cv.p(79, 52, col('orange', 4))
    cv.window(83, 48, 98, 57, style='glass', frame='wood:1', sill='cedar:5', curtain='cream', seed=402)
    # Climbing cedar trellis accent strip on far right of back wall
    for ty in range(47, 60, 3):
        cv.hline(99, 102, ty, col('cedar', 3))
    cv.p(100, 49, col('foliage', 4))
    cv.p(101, 52, col('foliage', 5))
    cv.p(100, 55, col('foliage', 4))

    # 2. Distinct Shaded Walkable Horizontal Wood Floor Deck (x=54..106, y=61..75)
    # Crisp horizontal wall-to-deck shadow line clearly separating upright cream wall from horizontal wood floor!
    for y in range(61, 75):
        ry = y - 61
        for x in range(54, 106):
            rx = x - 54
            if ry == 0:
                cv.p(x, y, col('floorwood', 0))  # Crisp dark wall-floor crease shadow
            elif ry == 1:
                cv.p(x, y, col('floorwood', 1))  # North wall cast shadow on wood deck
            elif rx == 0:
                cv.p(x, y, col('wood', 1))       # Left wall return edge
            elif rx in (1, 2):
                cv.p(x, y, col('floorwood', 1 if ry < 8 else 2))  # Left wing cast shadow on deck
            elif ry % 3 == 2:
                cv.p(x, y, col('floorwood', 2))  # Horizontal wood deck plank seam
            else:
                r = hsh(rx // 6, ry // 3, 40)
                t = 4 if (ry % 3 == 0 and r > 0.35) else 3
                cv.p(x, y, col('floorwood', t))
    # Doorstep welcome threshold mat in front of deck-level glass terrace door
    cv.rect(64, 62, 74, 64, col('stone', 4))
    cv.hline(64, 74, 62, col('stone', 6))

    # 3. Grounded Terrace Props Sitting on Horizontal Wood Deck with Crisp Cast Shadows!
    # Left potted flowering shrub grounded at y=68
    cv.hline(56, 63, 68, col('floorwood', 0))  # Cast shadow on deck
    draw_potted_tree(cv, 59, 68, rx=4, ry=4, pot_ramp='brick', blossom='pink:4', seed=41)
    # Bistro table & two chairs grounded at y=68 (feet clearly visible on deck above y=69 rail!)
    cv.hline(71, 88, 68, col('floorwood', 0))
    draw_bistro_set(cv, 71, 58)
    # Low terracotta flower planter box sitting grounded at y=68 between bistro & right tree
    cv.hline(88, 96, 68, col('floorwood', 0))
    cv.planter_box(88, 63, 96, 68, flower='red:4', pot_ramp='cedar')
    # Right potted tree grounded at y=68
    cv.hline(96, 104, 68, col('floorwood', 0))
    draw_potted_tree(cv, 100, 68, rx=4, ry=4, pot_ramp='brick', blossom='yellow:5', seed=42)

    # 4. Open Vertical-Baluster Front Rail (x=53..106, y=69..76) — shaded deck peeks crisply between balusters!
    cv.shade_rect(54, 70, 105, 75, -1)
    draw_open_baluster_rail(cv, 53, 106, 69, 76, rail_ramp='cedar', post_i=5, top_hi=6, step=4)

    # --- 1F Warm Red-Brick Ground Floor & Stone Plinth (x=6..106, y=77..112) ---
    cv.brick_wall(6, 77, 106, 106, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=43)
    draw_slab_band(cv, 5, 107, 76, ramp='concrete', accent=col('stone', 4), h=3)
    # Cut stone plinth along bottom
    draw_stone_blocks(cv, 6, 105, 106, 111, ramp='stone', base_i=3, ch=3, bw=8, seed=44)
    cv.hline(5, 107, 105, col('stone', 5))

    # Left: Warm wooden entrance door + brass porch lamp + stone steps
    cv.door_wood(13, 84, 27, 108, ramp='wood', glass_top=True)
    cv.p(29, 88, col('yellow', 5))  # Porch sconce glow
    cv.p(29, 89, col('orange', 4))
    draw_address_plaque(cv, 29, 92)
    cv.rect(11, 108, 29, 111, col('stone', 5))
    cv.hline(11, 29, 108, col('white', 5))

    # Center: Sunlit 1F parlor window with wooden shutters & cream curtains
    cv.window(37, 84, 61, 100, style='glass', frame='wood:1', sill='stone:5', curtain='cream', seed=45)
    # Decorative shutters flanking window
    for sx in (33, 62):
        cv.outline_box(sx, 84, sx + 4, 100, col('midori', 3), col('midori', 0), top_hi=col('midori', 4))
        for sy in range(86, 99, 3):
            cv.hline(sx + 1, sx + 3, sy, col('midori', 1))
    cv.planter_box(39, 99, 59, 104, flower='yellow:5', pot_ramp='brick')

    # Right (supporting 2F terrace): Cozy brick alcove with bicycle, stone bench & lush hedge!
    cv.outline_box(70, 82, 102, 107, col('brick', 2), col('brick', 0))
    cv.hline(71, 101, 83, col('ink', 0))
    cv.brick_wall(72, 84, 100, 105, ramp='brick', base_i=3, course_h=3, brick_w=6, seed=46)
    cv.window(76, 86, 95, 97, style='warm', frame='wood:1', sill='stone:5', warm=True, seed=47)
    draw_bike(cv, 74, 99, frame_ramp='teal')
    cv.planter_box(88, 100, 101, 107, flower='pink:4', pot_ramp='stone')
    # Lush garden shrub on far left edge
    cv.foliage_cluster(9, 105, 4, 4, ramp='foliage', seed=48, blossom='red:4')

    cv.hline(5, 107, 111, col('ink', 0))
    frame_building_edges(cv, 6, 106, 44, 112)


# ===========================================================================
# 4. mf-bldg-kr_rooftop_garden_house (96x96) — Classic 2F Korean dandok-jutaek + rooftop garden
# ===========================================================================

def draw_kr_rooftop_garden_house(cv):
    x0, x1 = 4, 92
    # --- Lush Rooftop Garden (y=2..30) ---
    cv.flat_roof(x0, 2, x1, 30, deck_ramp='concrete', deck_i=3, para_ramp='concrete', seed=404, urethane_green=False)
    # Left: Raised wooden vegetable garden beds (텃밭) with lettuce, peppers & tomatoes!
    cv.outline_box(9, 7, 36, 16, col('soil', 2), col('wood', 1), top_hi=col('cedar', 5))
    for rx in range(11, 35, 4):
        cv.p(rx, 9, col('foliage', 5))
        cv.p(rx + 1, 9, col('foliage', 4))
        cv.p(rx, 10, col('foliage', 3))
        cv.p(rx + 1, 13, col('foliage', 5))
        cv.p(rx + 2, 13, col('foliage', 3))
        if rx % 8 == 3:
            cv.p(rx + 1, 12, col('red', 4))  # Ripe cherry tomato / chili
    cv.outline_box(9, 18, 28, 25, col('soil', 2), col('wood', 1), top_hi=col('cedar', 5))
    for rx in range(11, 26, 3):
        cv.p(rx, 20, col('foliage', 6 if rx % 2 else 4))
        cv.p(rx + 1, 21, col('foliage', 3))
        cv.p(rx, 23, col('green', 4))

    # Center: Warm cedar pergola + laundry line (kept cleanly clear of right potted tree!)
    draw_pergola(cv, 38, 6, 64, 19, ramp='cedar')
    draw_laundry_line(
        cv, 34, 59, 17,
        garments=[
            (2, 5, 5, 'white', 6, 5),
            (9, 6, 5, 'pink', 5, 4),
            (17, 5, 5, 'blue', 5, 3),
        ],
        post_h=7, shadow_y=24, shadow_c=col('concrete', 2)
    )

    # Right: Classic rooftop water tank on concrete pad + open stair entry pad on far right (x=80..89)!
    cv.rect(68, 17, 79, 20, col('concrete', 5))
    cv.hline(68, 79, 17, col('concrete', 6))
    cv.roof_tank(68, 6)
    draw_potted_tree(cv, 63, 25, rx=3, ry=3, pot_ramp='brick', blossom='yellow:5', seed=409)
    # Concrete walkway pad on rooftop leading from open stair-access gate (x=80..89, y=18..29)
    cv.stipple_rect(80, 18, 89, 27, 'concrete', 4, 3, 5, seed=408, rate=0.14)

    # --- 2F Ochre Brick Living Level (y=30..62) ---
    # Distinct warm ochre-terracotta Korean brick CONTINUOUS across full width behind exterior stairs!
    cv.brick_wall(x0, 30, x1, 62, ramp='rooftile', base_i=4, course_h=3, brick_w=6, seed=410)
    draw_slab_band(cv, x0 - 1, 80, 30, ramp='concrete', h=3)
    draw_slab_band(cv, 89, x1 + 1, 30, ramp='concrete', h=3)
    draw_slab_band(cv, x0 - 1, 58, 60, ramp='stone', h=3)

    # Cut clean OPEN rooftop-access notch/gate through front parapet rim (x=81..89, y=26..33)!
    cv.stipple_rect(81, 25, 89, 31, 'concrete', 4, 3, 5, seed=418, rate=0.14)
    cv.hline(81, 89, 27, col('concrete', 2))  # Inner deck entry crease
    cv.hline(81, 89, 28, col('concrete', 6))  # Top rooftop threshold step edge
    cv.hline(81, 89, 29, col('concrete', 4))
    cv.hline(81, 89, 30, col('concrete', 1))
    # Crisp concrete parapet cut-ends + steel gateposts flanking the rooftop opening
    for px in (80, 89):
        cv.vline(px, 26, 33, col('concrete', 1))
        cv.p(px, 26, col('white', 6))
        cv.vline(px, 22, 26, col('steel', 1))
        cv.p(px, 22, col('steel', 5))

    # Wide Korean aluminum-framed veranda window (left) + bedroom window (center)
    cv.window(8, 36, 33, 55, style='warm', frame='coolwhite:3', sill='concrete:6', curtain='pink', warm=True, seed=411)
    draw_iron_rail(cv, 7, 34, 49, 56, ramp='steel', step=3)
    cv.planter_box(10, 47, 20, 51, flower='red:4', pot_ramp='brick')
    cv.window(37, 37, 53, 53, style='glass', frame='coolwhite:3', sill='concrete:6', curtain='blue', seed=412)
    draw_ac_wall(cv, 38, 53, pipe_down=6)

    # Real 2F Entry Doorway at stair base (x=57..67, y=39..59) + open concrete 2F landing!
    cv.rect(56, 37, 68, 39, col('concrete', 5))  # Small concrete door rain hood
    cv.hline(56, 68, 37, col('white', 6))
    cv.hline(57, 67, 39, col('ink', 1))
    cv.door_wood(57, 40, 67, 59, ramp='wood', glass_top=True)
    cv.p(55, 43, col('yellow', 5))  # Warm 2F porch sconce
    # Open 2F concrete landing deck connecting 2F doorway directly to stair base (x=56..77, y=58..63)
    cv.outline_box(56, 58, 77, 63, col('concrete', 4), col('concrete', 1), top_hi=col('concrete', 6), bot_sh=col('concrete', 2))
    cv.hline(57, 76, 63, col('ink', 0))
    # Crisp corner steel safety post at left edge of 2F landing (keeps doorway 100% open & unobstructed!)
    cv.vline(56, 53, 59, col('steel', 1))
    cv.p(56, 53, col('steel', 5))

    # Diagonal cast shadow under exterior stairs directly onto textured brick wall (NO flat rectangle!)
    for i in range(7):
        sy0 = 31 + i * 4
        sx1 = 90 - int((i / 7.0) * 16)
        sx0 = max(69, sx1 - 9)
        cv.shade_rect(sx0 + 1, sy0 + 2, min(x1 - 1, sx1 + 1), min(61, sy0 + 6), -1)

    # Exterior concrete stairs climbing cleanly from 2F landing (x=69, y=58) up into rooftop parapet notch (x=81..89, y=29)!
    draw_exterior_stairs(cv, 69, 29, 89, 59, descend_right=False, step_h=4, ramp='concrete', rail_ramp='steel')

    # --- 1F Stone Plinth + Front Yard Entry Stair & Classic Korean Iron Gate (y=62..96) ---
    # Left & right heavy granite stone plinth & front yard wall
    draw_stone_blocks(cv, x0, 62, x1, 95, ramp='stone', base_i=3, ch=5, bw=9, moss=0.08, seed=415)
    # Upper ochre-brick parapet strip along top of yard wall
    cv.brick_wall(x0, 62, 32, 72, ramp='rooftile', base_i=4, course_h=3, brick_w=6, seed=416)
    cv.hline(x0, 32, 72, col('stone', 5))
    # 1F / semi-basement warm window with classic Korean security bars on left
    cv.window(9, 76, 26, 88, style='warm', frame='steel:1', sill='stone:5', warm=True, seed=417)
    for gx in range(12, 25, 3):
        cv.vline(gx, 77, 87, col('steel', 1))

    # Wide front yard entry stair + iconic Korean iron double gate (철대문) in center-right (x=33..68)
    # Two ochre-brick gateposts with glowing globe lamps on top!
    for gx in (32, 62):
        cv.brick_wall(gx, 65, gx + 6, 95, ramp='rooftile', base_i=4, course_h=3, brick_w=4, seed=gx)
        cv.rect(gx - 1, 64, gx + 7, 66, col('stone', 5))
        # Glowing globe lamp atop gatepost
        cv.rect(gx + 1, 61, gx + 5, 64, col('yellow', 5))
        cv.p(gx + 2, 61, col('white', 6))
        cv.p(gx + 1, 63, col('orange', 4))
    draw_address_plaque(cv, 33, 72)

    # Recessed front yard entry stair behind/leading to iron double gate
    cv.outline_box(38, 68, 62, 92, col('steel', 1), col('ink', 0))
    # Left & right decorative iron gate leaves (철대문)
    for leaf_x0, leaf_x1 in ((39, 50), (50, 61)):
        cv.outline_box(leaf_x0, 69, leaf_x1, 90, col('steel', 2), col('ink', 0), top_hi=col('steel', 4))
        # Vertical iron picket bars in upper third
        for px in range(leaf_x0 + 2, leaf_x1 - 1, 2):
            cv.vline(px, 70, 77, col('ink', 0))
        # Lower solid ribbed steel panel + brass handle
        cv.rect(leaf_x0 + 2, 78, leaf_x1 - 2, 88, col('steel', 3))
        cv.hline(leaf_x0 + 2, leaf_x1 - 2, 83, col('steel', 1))
    cv.p(48, 81, col('yellow', 5))
    cv.p(51, 81, col('yellow', 5))
    # Front concrete entry stairs at bottom of gate
    for sy, w_off in ((90, 0), (92, 1), (94, 2)):
        cv.hline(37 - w_off, 63 + w_off, sy, col('concrete', 6))
        cv.hline(37 - w_off, 63 + w_off, sy + 1, col('concrete', 3))

    # Right yard corner: lush garden shrubs & flowers
    cv.foliage_cluster(79, 77, 8, 7, ramp='foliage', seed=420, blossom='pink:4')
    cv.foliage_cluster(86, 84, 5, 5, ramp='foliage', seed=421, blossom='yellow:5')
    cv.planter_box(71, 88, 89, 94, flower='red:4', pot_ramp='brick')
    cv.planter_box(7, 89, 27, 94, flower='yellow:5', pot_ramp='stone')

    cv.hline(x0 - 1, x1 + 1, 95, col('ink', 0))
    frame_building_edges(cv, x0, x1, 30, 96)


# ===========================================================================
# 5. mf-bldg-kr_duplex_townhouse (112x96) — Twin contemporary duplex townhouses
# ===========================================================================

def draw_kr_duplex_townhouse(cv):
    # Left unit:  x=4..56  — Warm cedar & white stucco, deep overhanging dark charcoal gable roof
    # Right unit: x=56..108 — Charcoal slate & warm red brick, deep overhanging kawara slate gable roof
    # Shared stone/cobblestone entry apron along y=91..96

    # --- Dual Deep Top-3/4 Overhanging Pitched Gable Roofs (y=2..33, matching machiya-gable / house-gable-a) ---
    # Left unit deep gable (x=2..56, y=2..33 — 2px roof overhang beyond x=4 wall!)
    draw_fable_deep_gable(cv, 2, 2, 56, 33, ramp='kuro', trim_ramp='white', wall_ramp='white', wall_i=5,
                          beam_ramp='wood', seed=501)
    # Brick chimney seated FIRMLY INTO the left pitched roof slope (x=17..23, base penetrates slope cleanly!)
    for cx_p in range(17, 23):
        # Sloped roof-contact line matching left roof angle (completely inside roof mass!)
        base_y = 16 - (cx_p - 17) // 2
        for cy_p in range(5, base_y + 1):
            if cx_p == 17 or cx_p == 22 or cy_p == 5:
                cv.p(cx_p, cy_p, col('brick', 0))
            elif cy_p == base_y:
                cv.p(cx_p, cy_p, col('steel', 1))  # Dark metal roof-flashing saddle
            elif cy_p == base_y - 1:
                cv.p(cx_p, cy_p, col('steel', 4))  # Sunlit flashing collar
            else:
                # Crisp brick masonry courses on chimney shaft
                b_tone = 5 if (cy_p % 2 == 0 and cx_p < 20) else (4 if cx_p < 21 else 3)
                cv.p(cx_p, cy_p, col('brick', b_tone))
        # Cast shadow on shingles immediately below/right of chimney flashing
        cv.p(cx_p + 1, base_y, col('kuro', 0))
        if base_y + 1 < 28:
            cv.p(cx_p, base_y + 1, col('kuro', 0))
    # Chimney stone cap + dark flue opening
    cv.hline(16, 24, 4, col('stone', 6))
    cv.hline(16, 24, 5, col('stone', 2))
    cv.hline(18, 22, 4, col('ink', 0))
    # Deeply recessed attic dormer window in left gable with shadow lintel
    cv.outline_box(25, 14, 34, 22, col('wood', 2), col('ink', 0), top_hi=col('cedar', 5))
    cv.hline(26, 33, 15, col('ink', 0))
    cv.rect(27, 16, 32, 20, col('yellow', 4))
    cv.p(28, 17, col('white', 6))
    cv.hline(24, 35, 22, col('cedar', 5))
    cv.hline(25, 34, 23, col('white', 3))

    # Right unit deep gable (x=56..110, y=4..33 — slightly lower offset ridge + kawara tiles + cedar collar beam)
    draw_fable_deep_gable(cv, 56, 4, 110, 33, ramp='kawara', trim_ramp='cedar', wall_ramp='kuro', wall_i=3,
                          beam_ramp='cedar', seed=502)
    # Recessed modern attic dormer window in right gable
    cv.hline(78, 88, 15, col('kawara', 0))
    cv.window(79, 16, 87, 24, style='glass', frame='cedar:4', sill='cedar:5', seed=503)

    # --- LEFT UNIT (x=4..56, y=33..92): Warm Cedar & White Stucco ---
    # 2F white stucco wall (y=33..58) + deep gable overhang cast shadow at y=33..34
    cv.stipple_rect(4, 33, 56, 58, 'white', 5, 4, 6, seed=504, rate=0.14)
    cv.hline(4, 56, 33, col('ink', 1))
    cv.hline(4, 56, 34, col('white', 3))
    # Cantilevered warm-cedar box bay on right half of 2F
    cv.siding_wall(30, 35, 54, 57, ramp='cedar', base_i=4, horizontal=False, step=3, seed=505)
    cv.hline(30, 54, 35, col('cedar', 6))
    cv.hline(30, 54, 57, col('ink', 1))
    # Asymmetric 2F flower balcony on left side of Left Unit
    cv.window(9, 37, 27, 55, style='warm', frame='wood:1', sill=None, curtain='orange', warm=True, seed=506)
    draw_iron_rail(cv, 7, 29, 48, 56, ramp='steel', step=3)
    cv.planter_box(9, 45, 27, 50, flower='red:4', pot_ramp='cedar')
    # Tall cedar-framed window on right of Left Unit 2F
    cv.window(35, 39, 49, 54, style='glass', frame='wood:1', sill='cedar:6', seed=507)

    # Pitched Lower Tiled Eave Canopy over 1F Left Unit (y=58..66, matching Fable machiya-gable / house-gable-a!)
    cv.pitched_roof(2, 58, 56, 66, ramp='kuro', ridge_hi=True, moss_rate=0.0, seed=522)
    cv.hline(3, 56, 58, col('steel', 5))  # Crisp top roof-to-wall flashing

    # 1F Left Unit: Warm white stucco & cedar porch recess with arched wood front door (y=66..92)
    cv.stipple_rect(4, 66, 56, 92, 'white', 5, 4, 6, seed=508, rate=0.12)
    cv.hline(4, 56, 66, col('ink', 0))  # Deep underside cast shadow under lower tiled eave canopy!
    cv.hline(4, 56, 67, col('white', 3))
    # Recessed warm cedar arched doorway
    cv.siding_wall(9, 69, 25, 91, ramp='cedar', base_i=4, horizontal=True, step=3, seed=509)
    cv.outline_box(11, 71, 23, 91, col('wood', 4), col('wood', 0), top_hi=col('cedar', 5))
    # Arch top accent
    cv.p(11, 71, col('cedar', 3))
    cv.p(22, 71, col('cedar', 3))
    cv.window(14, 74, 20, 81, style='warm', frame='wood:1', sill=None, warm=True)
    cv.p(20, 84, col('yellow', 5))  # Brass handle
    cv.p(26, 74, col('yellow', 5))  # Warm porch sconce
    # Wide 1F living window with cream blinds
    cv.window(30, 70, 51, 86, style='blinds', frame='wood:1', sill='concrete:6', seed=510)
    cv.planter_box(31, 86, 51, 91, flower='pink:4', pot_ramp='brick')

    # --- RIGHT UNIT (x=56..108, y=33..92): Charcoal Slate & Warm Red Brick ---
    # 2F Charcoal slate vertical cladding (y=33..58) + deep gable overhang cast shadow
    cv.siding_wall(56, 33, 108, 58, ramp='kuro', base_i=3, horizontal=False, step=4, seed=511)
    cv.hline(56, 108, 33, col('ink', 0))
    cv.hline(56, 108, 34, col('kuro', 1))
    # Left window on 2F Right Unit: warm backlit studio
    cv.window(62, 38, 77, 54, style='warm', frame='cedar:4', sill='stone:5', curtain='cream', warm=True, seed=512)
    # Asymmetric right-side 2F recessed wood-slat flower balcony!
    cv.window(82, 36, 102, 55, style='glass', frame='steel:2', sill=None, curtain='teal', seed=513)
    cv.terrace_deck(80, 47, 105, 57, floor_ramp='floorwood', rail_ramp='cedar', seed=514)
    cv.planter_box(82, 46, 94, 51, flower='yellow:5', pot_ramp='brick')
    draw_potted_tree(cv, 100, 54, rx=3, ry=3, pot_ramp='stone', blossom='orange:4', seed=515)

    # Pitched Lower Tiled Eave Canopy over 1F Right Unit (y=58..66, kawara tiles!)
    cv.pitched_roof(56, 58, 110, 66, ramp='kawara', ridge_hi=True, moss_rate=0.0, seed=523)
    cv.hline(56, 109, 58, col('cedar', 5))  # Crisp cedar/metal top flashing

    # 1F Right Unit: Warm red-brick facade + contemporary cedar slat front door (y=66..92)
    cv.brick_wall(56, 66, 108, 92, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=516)
    cv.hline(56, 108, 66, col('ink', 0))  # Deep underside cast shadow under lower tiled eave canopy!
    cv.hline(56, 108, 67, col('brick', 1))
    # Wide dark-framed picture window with warm glow on left
    cv.window(61, 70, 81, 86, style='warm', frame='kuro:1', sill='stone:5', warm=True, seed=517)
    draw_bike(cv, 62, 83, frame_ramp='yellow')
    # Contemporary solid cedar front door + vertical glazed sidelight on right
    cv.outline_box(86, 69, 102, 91, col('kuro', 1), col('ink', 0))
    cv.siding_wall(88, 71, 96, 90, ramp='cedar', base_i=4, horizontal=True, step=3, seed=518)
    cv.p(94, 82, col('steel', 6))  # Vertical modern pull bar
    cv.window(96, 71, 101, 90, style='warm', frame='kuro:1', sill=None, warm=True)
    draw_address_plaque(cv, 81, 72)

    # Center party-wall seam & rainwater downspout between the two duplex units
    cv.vline(55, 33, 92, col('steel', 1))
    cv.vline(56, 33, 92, col('steel', 3))

    # Shared cobblestone / granite entry apron & front flower beds (y=90..96)
    draw_stone_blocks(cv, 4, 91, 108, 95, ramp='pavement', base_i=4, ch=2, bw=7, seed=519)
    cv.hline(4, 108, 91, col('concrete', 6))
    cv.foliage_cluster(7, 90, 3, 3, ramp='foliage', seed=520, blossom='red:4')
    cv.foliage_cluster(104, 90, 3, 3, ramp='foliage', seed=521, blossom='yellow:5')
    cv.hline(3, 109, 95, col('ink', 0))
    frame_building_edges(cv, 4, 108, 33, 96)


# ===========================================================================
# 6. mf-bldg-kr_apt_block_a (128x160) — 5F Classic Korean Apartment Block ("101")
# ===========================================================================

def draw_kr_apt_block_a(cv):
    x0, x1 = 4, 124
    # Layout:
    #   Roof: y=2..24 (twin elevator machine rooms + twin tanks + moss/green waterproof deck)
    #   5F: y=24..49 (25px)
    #   4F: y=49..74 (25px)
    #   3F: y=74..99 (25px)
    #   2F: y=99..124 (25px)
    #   1F: y=124..160 (36px — recessed lobby entrance, 1F verandas, lush low shrub border)
    #   Right side architectural panel (x=102..124): teal/blue accent stripe + crisp "101" unit number!

    # --- Flat Roof with Twin Elevator Machine Rooms & Twin Water Tanks (y=2..24) ---
    cv.flat_roof(x0, 2, x1, 24, deck_ramp='moss', deck_i=3, para_ramp='coolwhite', seed=601)
    # Twin elevator machine rooms (left & right-center) with teal trim stripe
    for px in (12, 74):
        cv.roof_penthouse(px, 3, w=18, h=15, ramp='coolwhite')
        cv.hline(px + 1, px + 17, 6, col('teal', 3))
        cv.hline(px + 1, px + 17, 7, col('blue', 3))
    # Twin cylindrical rooftop water tanks
    cv.roof_tank(38, 5)
    cv.roof_tank(52, 5)
    # Rooftop AC & antenna mast
    cv.roof_ac(98, 9)
    cv.vline(114, 2, 16, col('steel', 2))
    cv.hline(110, 119, 4, col('steel', 5))
    cv.hline(111, 118, 7, col('steel', 4))

    # --- Main Concrete Facade Body (y=24..158) ---
    cv.stipple_rect(x0, 24, 102, 158, 'coolwhite', 4, 3, 5, seed=602, rate=0.14)
    # Right end-wall / stair-tower panel (x=102..124) in soft cream/coolwhite concrete
    cv.stipple_rect(102, 24, x1, 158, 'cream', 5, 4, 6, seed=603, rate=0.12)
    cv.vline(102, 24, 158, col('concrete', 1))
    # Iconic Korean apartment teal & blue vertical accent graphic stripe!
    cv.rect(105, 24, 109, 156, col('teal', 3))
    cv.vline(105, 24, 156, col('teal', 4))
    cv.rect(109, 24, 112, 156, col('blue', 3))
    cv.vline(111, 24, 156, col('blue', 2))

    # Crisp big unit number "101" on side wall! (x=103..123, y=30..45)
    cv.outline_box(104, 29, 122, 46, col('white', 6), col('teal', 2), top_hi=col('white', 6))
    cv.hline(105, 121, 30, col('teal', 4))
    draw_digits(cv, 107, 34, '101', fg=col('navy', 1), shadow=col('coolwhite', 3), scale=1, gap=2)
    cv.hline(106, 120, 42, col('blue', 3))

    # Vertical stair-landing windows below "101" on right tower (each floor distinct!)
    for fy, lit in ((54, False), (79, True), (104, False), (130, True)):
        cv.window(114, fy, 121, fy + 14, style='warm' if lit else 'glass', frame='steel:1', sill='concrete:5', warm=lit)

    # Top cornice fascia with subtle teal/blue accent stripe across the whole block
    draw_slab_band(cv, x0 - 1, x1 + 1, 24, ramp='coolwhite', accent=col('teal', 3), h=3)

    # --- 4 Upper Floors (5F, 4F, 3F, 2F) — EVERY floor richly individualized (ZERO cloning!) ---
    floor_cfgs = [
        # 5F (y=27..49)
        (27, 49,
         dict(warm=False, style='glass', curtain='blue', rail='solid', parapet_ramp='coolwhite', parapet_i=4,
              laundry=[(1, 5, 5, 'white', 6, 5), (8, 5, 6, 'blue', 5, 3), (15, 5, 5, 'pink', 5, 4)],
              ac=True, ac_right=True, plants=1, plant_x=2, flower_color='yellow:5'),
         dict(warm=True, style='blinds', curtain='cream', rail='solid', parapet_ramp='coolwhite', parapet_i=4,
              plants=3, plant_x=4, flower_color='red:4', lamp=True)),
        # 4F (y=52..74)
        (52, 74,
         dict(warm=True, style='warm', curtain='pink', rail='glass', shelf=True,
              plants=2, plant_x=20, flower_color='pink:4', all_warm=True),
         dict(warm=False, style='glass', curtain='navy', rail='solid', parapet_ramp='cream', parapet_i=5,
              futon='orange', futon_x=6, ac=True, ac_right=True)),
        # 3F (y=77..99)
        (77, 99,
         dict(warm=False, style='glass', open_sash=True, curtain='teal', rail='iron',
              plants=3, plant_x=3, flower_color='yellow:5',
              laundry=[(22, 5, 5, 'white', 6, 5), (29, 5, 5, 'yellow', 5, 4)]),
         dict(warm=True, style='warm', curtain='orange', rail='glass', shelf=True, lamp=True,
              futon='teal', futon_x=22)),
        # 2F (y=102..124)
        (102, 124,
         dict(warm=False, style='blinds', curtain='red', rail='solid', parapet_ramp='coolwhite', parapet_i=4,
              futon='pink', futon_x=5, plants=2, plant_x=20, flower_color='red:4'),
         dict(warm=True, style='warm', open_sash=True, curtain='cream', rail='solid', parapet_ramp='coolwhite', parapet_i=4,
              laundry=[(2, 5, 5, 'blue', 5, 3), (9, 5, 5, 'white', 6, 5)],
              ac=True, ac_right=True, plants=1, plant_x=18, flower_color='pink:4')),
    ]

    for idx, (fy0, fy1, left_cfg, right_cfg) in enumerate(floor_cfgs):
        # Left unit wide sunlit veranda (x=8..50)
        draw_veranda_enclosure(cv, 8, fy0 + 1, 50, fy1 - 1, left_cfg, seed=610 + idx * 10)
        # Center dividing concrete pier with vertical drainpipe & small teal accent dot
        cv.rect(50, fy0, 56, fy1, col('coolwhite', 4))
        cv.vline(52, fy0, fy1, col('steel', 3))
        cv.vline(53, fy0, fy1, col('steel', 1))
        # Right unit wide sunlit veranda (x=56..98)
        draw_veranda_enclosure(cv, 56, fy0 + 1, 98, fy1 - 1, right_cfg, seed=620 + idx * 10)
        # Horizontal floor slab divider underneath each floor
        accent = col('teal', 4) if idx == 1 else col('coolwhite', 3)
        draw_slab_band(cv, x0 - 1, 102, fy1, ramp='coolwhite', accent=accent, h=3)

    # --- 1F Ground Floor: Recessed Lobby Entrance + 1F Verandas + Low Shrub Border (y=124..160) ---
    draw_slab_band(cv, x0 - 1, x1 + 1, 124, ramp='stone', accent=col('teal', 3), h=3)
    # Stone plinth facing along 1F
    draw_stone_blocks(cv, x0, 127, 102, 158, ramp='stone', base_i=4, ch=5, bw=9, seed=630)
    draw_stone_blocks(cv, 102, 127, x1, 158, ramp='stone', base_i=3, ch=5, bw=8, seed=631)

    # Left 1F Unit veranda (x=8..38) with security bars & warm interior
    cv.window(10, 131, 36, 147, style='warm', frame='steel:1', sill='concrete:5', curtain='cream', warm=True, seed=632)
    for gx in range(13, 35, 4):
        cv.vline(gx, 132, 146, col('steel', 2))

    # Center Recessed Apartment Lobby Entrance (x=42..68, y=126..158)
    cv.rect(40, 126, 70, 134, col('teal', 2))
    cv.hline(40, 70, 126, col('coolwhite', 6))
    cv.hline(40, 70, 133, col('teal', 1))
    cv.hline(41, 69, 134, col('ink', 0))
    # Crisp padded mini "101" over lobby canopy
    draw_digits(cv, 49, 127, '101', fg=col('white', 6), scale=1, gap=2)
    # Recessed dark lobby surround + twin glass automatic doors
    cv.outline_box(42, 134, 68, 157, col('concrete', 1), col('ink', 0))
    cv.door_glass(46, 136, 64, 156, frame='steel:2', warm=True)
    # Lobby steps
    cv.rect(42, 156, 68, 159, col('concrete', 5))
    cv.hline(42, 68, 156, col('white', 6))
    # Bulletin board & intercom flanking lobby
    cv.outline_box(70, 135, 77, 145, col('cream', 5), col('steel', 1))
    cv.hline(71, 76, 137, col('blue', 3))
    cv.hline(71, 75, 140, col('red', 4))
    cv.hline(71, 76, 142, col('steel', 2))
    draw_address_plaque(cv, 36, 133)

    # Right 1F Unit veranda (x=80..98) with cool glass & blinds
    cv.window(80, 131, 98, 147, style='blinds', frame='steel:1', sill='concrete:5', seed=633)

    # Lush low shrub border & stone edging flanking lobby along base (y=149..159)
    for sx in range(8, 39, 7):
        cv.foliage_cluster(sx + 3, 153, 5, 4, ramp='foliage', seed=sx, blossom='pink:4' if sx % 14 == 8 else 'yellow:5')
    cv.rect(6, 156, 40, 159, col('stone', 4))
    cv.hline(6, 40, 156, col('stone', 6))
    for sx in range(73, 120, 7):
        cv.foliage_cluster(sx + 3, 153, 5, 4, ramp='foliage', seed=sx + 50, blossom='yellow:5' if sx % 14 == 3 else 'red:4')
    cv.rect(70, 156, 122, 159, col('stone', 4))
    cv.hline(70, 122, 156, col('stone', 6))

    cv.hline(x0 - 1, x1 + 1, 159, col('ink', 0))
    frame_building_edges(cv, x0, x1, 24, 160)


# ===========================================================================
# 7. mf-bldg-kr_apt_block_b (128x160) — 5F Warm-Terracotta & Cream Modern Apt ("102")
# ===========================================================================

def draw_kr_apt_block_b(cv):
    x0, x1 = 4, 124
    # Layout:
    #   Green roof deck + twin cedar rooftop pergolas + elevator bulkhead: y=2..26
    #   5F: y=26..50 (24px) — staggered protruding wood-screened bay balconies
    #   4F: y=50..74 (24px) — staggered center protruding glass balconies
    #   3F: y=74..98 (24px) — staggered left + center-right protruding bays
    #   2F: y=98..122 (24px) — panoramic center bay + flanking garden balconies
    #   1F: y=122..160 (38px) — grand modern terracotta/stone lobby + garden terraces

    # --- Green Roof Deck with Rooftop Pergolas (y=2..26) ---
    cv.flat_roof(x0, 2, x1, 26, deck_ramp='lawn', deck_i=3, para_ramp='cream', seed=701)
    # Stone rooftop walking path strip across center of green roof
    cv.stipple_rect(10, 16, 118, 22, 'pavement', 4, 3, 5, seed=702, rate=0.14)
    # Left terracotta elevator bulkhead with "102" accent cap
    cv.roof_penthouse(8, 3, w=18, h=15, ramp='brick')
    cv.hline(9, 25, 3, col('cream', 6))
    # Two warm cedar rooftop pergolas (center-left & right)
    draw_pergola(cv, 32, 6, 62, 18, ramp='cedar')
    draw_pergola(cv, 78, 6, 112, 18, ramp='cedar')
    # Ornamental shrubs & blossoms on green roof lawn
    draw_potted_tree(cv, 70, 15, rx=4, ry=4, pot_ramp='stone', blossom='yellow:5', seed=703)
    cv.foliage_cluster(29, 14, 3, 3, ramp='foliage', seed=704, blossom='pink:4')
    cv.foliage_cluster(117, 14, 3, 3, ramp='foliage', seed=705, blossom='red:4')

    # --- Base Terracotta & Cream Architectural Facade (y=26..158) ---
    # Left vertical terracotta signature tower (x=4..24) with crisp "102" sign!
    cv.brick_wall(x0, 26, 24, 158, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=706)
    cv.vline(24, 26, 158, col('brick', 1))
    # Main warm cream & kinari stucco residential facade (x=24..124)
    cv.stipple_rect(24, 26, x1, 158, 'cream', 5, 4, 6, seed=707, rate=0.15)
    # Right warm terracotta pilaster pier (x=116..124)
    cv.brick_wall(116, 26, x1, 158, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=708)

    # Crisp "102" unit number plaque on left terracotta tower (generous 2px margins!)
    cv.outline_box(5, 31, 23, 46, col('cream', 6), col('brick', 1), top_hi=col('white', 6))
    draw_digits(cv, 8, 35, '102', fg=col('brick', 1), shadow=col('cream', 3), scale=1, gap=1)
    cv.hline(7, 21, 43, col('cedar', 4))
    # Vertical architectural narrow windows down the left terracotta tower (varied lights)
    for fy, lit in ((55, True), (79, False), (103, True), (130, False)):
        cv.window(10, fy, 18, fy + 14, style='warm' if lit else 'glass', frame='darkwood:1', sill='cream:6', warm=lit)

    draw_slab_band(cv, x0 - 1, x1 + 1, 26, ramp='cream', accent=col('brick', 3), h=3)

    # Helper to draw a protruding bay balcony with wood slat screen or glass rail
    def bay_balcony(bx0, bx1, by0, by1, warm_room=True, wood_screen=False, curtain=None, plants=0, flw='red:4', shade_bedroom=False, s=0):
        # Protruding top-3/4 concrete/cream hood & side returns
        cv.outline_box(bx0 - 1, by0, bx1 + 1, by1, col('cream', 4), col('concrete', 1), top_hi=col('white', 6))
        cv.hline(bx0, bx1, by1, col('ink', 1))  # Cast shadow below protruding bay!
        # Room glazing inside bay
        st = 'warm' if warm_room else ('blinds' if shade_bedroom else 'glass')
        cv.window(bx0 + 1, by0 + 2, bx1 - 1, by1 - 6, style=st, frame='darkwood:1', sill=None, curtain=curtain, warm=warm_room, seed=s)
        # Optional wood louver privacy screen on one side
        if wood_screen:
            sx0 = bx1 - 8 if s % 2 == 0 else bx0 + 1
            for sy in range(by0 + 2, by1 - 2, 2):
                cv.hline(sx0, sx0 + 7, sy, col('cedar', 4 if sy % 4 == 0 else 2))
        # Glass balcony rail
        draw_glass_rail(cv, bx0, bx1, by1 - 7, by1, post_ramp='darkwood', tint_i=4, frame_i=1, step=8)
        # Optional balcony planters
        for i in range(plants):
            px = bx0 + 3 + i * 8
            if px + 6 < bx1 - 2:
                cv.planter_box(px, by1 - 10, px + 6, by1 - 6, flower=flw, pot_ramp='brick')

    # --- 5F (y=29..50): Protruding LEFT & RIGHT bays, recessed shaded center bedroom ---
    bay_balcony(27, 57, 30, 49, warm_room=True, wood_screen=True, curtain='orange', plants=2, flw='yellow:5', s=710)
    # Recessed shaded center bedroom
    cv.window(61, 33, 81, 46, style='glass', frame='darkwood:1', sill='cream:6', curtain='navy', seed=711)
    bay_balcony(85, 114, 30, 49, warm_room=False, wood_screen=True, curtain='cream', plants=1, flw='red:4', s=712)
    draw_slab_band(cv, 24, 116, 50, ramp='cream', h=2)

    # --- 4F (y=52..74): Staggered protruding CENTER-LEFT & RIGHT-CENTER bays, terracotta accent ---
    cv.window(27, 56, 43, 69, style='blinds', frame='darkwood:1', sill='cream:6', seed=720)
    bay_balcony(47, 81, 53, 73, warm_room=True, wood_screen=False, curtain='pink', plants=2, flw='pink:4', s=721)
    # Warm cedar living silhouette in center bay
    cv.vline(63, 55, 58, col('darkwood', 1))
    cv.hline(61, 66, 58, col('white', 6))
    bay_balcony(86, 113, 53, 73, warm_room=True, wood_screen=True, curtain='teal', plants=1, flw='yellow:5', s=722)
    draw_slab_band(cv, 24, 116, 74, ramp='cream', h=2)

    # --- 3F (y=76..98): Staggered protruding LEFT cedar bay + CENTER-RIGHT shaded glass bay ---
    bay_balcony(27, 60, 77, 97, warm_room=False, wood_screen=True, curtain='blue', plants=2, flw='red:4', s=730)
    # Warm sunlit mid window with terracotta trim
    cv.brick_wall(63, 76, 77, 98, ramp='brick', base_i=4, course_h=3, brick_w=5, seed=731)
    cv.window(65, 80, 75, 93, style='warm', frame='darkwood:1', sill='cream:6', warm=True, seed=732)
    bay_balcony(80, 114, 77, 97, warm_room=True, wood_screen=False, curtain='orange', plants=2, flw='pink:4', s=733)
    draw_slab_band(cv, 24, 116, 98, ramp='cream', h=2)

    # --- 2F (y=100..122): Panoramic protruding warm CENTER living bay + flanking garden terraces ---
    cv.window(27, 103, 47, 117, style='glass', frame='darkwood:1', sill='cream:6', curtain='teal', seed=740)
    cv.planter_box(28, 115, 46, 120, flower='yellow:5', pot_ramp='cedar')
    bay_balcony(51, 91, 101, 121, warm_room=True, wood_screen=True, curtain='red', plants=3, flw='red:4', s=741)
    cv.window(95, 103, 113, 117, style='blinds', frame='darkwood:1', sill='cream:6', seed=742)
    cv.planter_box(96, 115, 112, 120, flower='pink:4', pot_ramp='cedar')

    # --- 1F Grand Modern Terracotta/Stone Lobby & Landscaped Plinth (y=122..160) ---
    draw_slab_band(cv, x0 - 1, x1 + 1, 122, ramp='stone', accent=col('darkwood', 2), h=4)
    draw_stone_blocks(cv, 24, 126, 116, 158, ramp='stone', base_i=4, ch=5, bw=9, seed=750)
    # Grand cantilevered bronze-and-cedar lobby canopy (x=46..94)
    cv.rect(46, 128, 94, 133, col('darkwood', 2))
    cv.hline(46, 94, 128, col('cedar', 5))
    cv.hline(47, 93, 132, col('yellow', 5))  # Warm recessed canopy light strip!
    cv.hline(47, 93, 133, col('ink', 0))
    # Tall glowing glazed lobby foyer
    cv.outline_box(50, 133, 90, 156, col('darkwood', 1), col('ink', 0))
    cv.door_glass(53, 135, 73, 155, frame='darkwood:1', warm=True)
    cv.window(74, 135, 88, 153, style='warm', frame='darkwood:1', sill=None, warm=True, seed=751)
    # Stone grand steps
    cv.rect(48, 155, 92, 159, col('concrete', 5))
    cv.hline(48, 92, 155, col('white', 6))

    # Flanking 1F terrace windows & lush manicured planters
    cv.window(28, 131, 44, 146, style='warm', frame='darkwood:1', sill='stone:5', warm=True, seed=752)
    cv.window(96, 131, 113, 146, style='glass', frame='darkwood:1', sill='stone:5', seed=753)
    draw_address_plaque(cv, 92, 136)
    # Manicured garden planters flanking entry
    cv.planter_box(26, 149, 45, 158, flower='yellow:5', pot_ramp='brick')
    cv.planter_box(94, 149, 115, 158, flower='pink:4', pot_ramp='brick')
    draw_potted_tree(cv, 14, 157, rx=5, ry=5, pot_ramp='stone', blossom='red:4', seed=754)

    cv.hline(x0 - 1, x1 + 1, 159, col('ink', 0))
    frame_building_edges(cv, x0, x1, 26, 160)


# ===========================================================================
# 8. mf-bldg-kr_apt_gatehouse (128x80) — Apartment Complex Security Gatehouse & Arch Pavilion
# ===========================================================================

def draw_kr_apt_gatehouse(cv):
    # Layout (128x80):
    #   Recessed top-3/4 flat roof deck (14px deep, y=1..15) with crisp 4-sided light parapet rim
    #     and north/left interior cast shadows (matching Fable koban / konbini)
    #   Gatehouse fascia beam + crisp centered "PARK 101" signboard + warm cedar soffit (y=15..26)
    #   Left Wing (x=4..44, y=26..78): Glass security guard booth with glowing desk lamp + planter
    #   Central Vehicle/Pedestrian Portal Arch (x=44..88, y=26..78): monumental chamfered arch + red/white barrier arm
    #   Right Wing (x=88..124, y=26..78): Sculptural stone complex monolith ("PARK 101" + crest) + manicured boxwood

    # --- Recessed Top-3/4 Flat Roof Deck (y=1..15, 14px deep, matching Fable koban/konbini) ---
    cv.flat_roof(2, 1, 126, 15, deck_ramp='moss', deck_i=3, para_ramp='concrete', seed=800)
    # Crisp reinforced north & left interior parapet cast shadows inside recessed roof deck (y=4..11)
    cv.hline(4, 124, 4, col('moss', 0))
    cv.hline(4, 124, 5, col('moss', 1))
    cv.vline(4, 4, 11, col('moss', 0))
    cv.vline(5, 4, 11, col('moss', 1))
    # Subtle rooftop concrete service walkway & neat rooftop fixtures inside the recessed deck
    cv.stipple_rect(44, 6, 84, 10, 'pavement', 4, 3, 5, seed=805, rate=0.14)
    cv.hline(44, 84, 10, col('moss', 1))
    # Left roof deck: compact rooftop AC condenser + security CCTV antenna pole
    cv.outline_box(9, 4, 18, 10, col('coolwhite', 4), col('steel', 1), top_hi=col('white', 6))
    cv.rect(11, 6, 15, 9, col('steel', 1))
    cv.p(12, 7, col('steel', 4))
    cv.hline(10, 19, 10, col('moss', 1))
    cv.vline(28, 2, 10, col('steel', 2))
    cv.hline(26, 31, 3, col('steel', 5))
    cv.p(28, 2, col('red', 4))  # Security beacon tip
    # Right roof deck: compact rooftop exhaust vent & low parapet planter strip
    cv.outline_box(96, 5, 103, 10, col('coolwhite', 4), col('steel', 1), top_hi=col('white', 6))
    cv.hline(97, 104, 10, col('moss', 1))
    cv.planter_box(108, 5, 121, 10, flower='yellow:5', pot_ramp='stone')

    # --- Gatehouse Fascia Beam + Crisp Centered "PARK 101" Signboard + Warm Cedar Soffit (y=15..26) ---
    cv.outline_box(2, 15, 126, 23, col('kuro', 2), col('ink', 0), top_hi=col('steel', 4), bot_sh=col('kuro', 1))
    # Subtle architectural vertical steel fascia ribs flanking the signboard
    for rx in (10, 20, 30, 98, 108, 118):
        cv.vline(rx, 16, 22, col('kuro', 3))
        cv.vline(rx + 1, 16, 22, col('kuro', 1))
    # Centered crisp signboard plaque (x=36..92, y=15..23) with geometric crest + "PARK 101"!
    cv.outline_box(36, 15, 92, 23, col('kuro', 1), col('steel', 5), top_hi=col('kuro', 2), bot_sh=col('ink', 0))
    cv.hline(37, 91, 15, col('cedar', 5))
    draw_apt_crest(cv, 43, 17)
    draw_pixel_text(cv, 50, 17, 'PARK 101', fg=col('yellow', 5), shadow=col('ink', 0), gap=1)
    # Matching right balance emblem bar
    cv.hline(83, 88, 19, col('cedar', 5))
    cv.p(85, 18, col('yellow', 5))
    cv.p(85, 20, col('orange', 4))
    # Warm glowing cedar soffit underside beam (y=23..26)
    cv.rect(4, 23, 124, 26, col('cedar', 4))
    cv.hline(4, 124, 23, col('cedar', 2))
    # Glowing recessed warm LED soffit spotlights across portal!
    for lx in (18, 32, 50, 64, 78, 98, 112):
        cv.hline(lx, lx + 4, 24, col('yellow', 5))
    cv.hline(4, 124, 25, col('ink', 0))

    # --- LEFT WING: Glass Security Guard Booth (x=4..44, y=26..78) ---
    # Granite corner pier & booth base
    draw_stone_blocks(cv, 4, 26, 44, 78, ramp='stone', base_i=4, ch=5, bw=8, seed=801)
    # Dark steel booth fascia
    cv.rect(6, 27, 42, 31, col('kuro', 2))
    cv.hline(7, 41, 28, col('teal', 4))  # Subtle teal security accent bar
    # Wrap-around glass guard booth windows (x=8..38, y=31..56)
    cv.outline_box(8, 31, 39, 57, col('glass', 1), col('steel', 1))
    # Inside the guard booth: warm sunlit wood desk, glowing desk lamp, monitor!
    cv.window(9, 32, 24, 55, style='warm', frame='steel:1', sill=None, warm=True, seed=802)
    cv.window(24, 32, 38, 55, style='glass', frame='steel:1', sill=None, seed=803)
    # Desk surface inside booth
    cv.rect(10, 48, 37, 54, col('wood', 3))
    cv.hline(10, 37, 48, col('cedar', 5))
    # Glowing desk lamp on left side of desk + guard chair silhouette!
    cv.vline(15, 42, 48, col('steel', 2))
    cv.rect(13, 39, 18, 42, col('yellow', 5))
    cv.p(15, 40, col('white', 6))
    cv.rect(12, 43, 19, 47, col('orange', 4))  # Warm pool of light on desk
    cv.rect(20, 41, 24, 48, col('navy', 2))    # Guard office chair back / cap silhouette
    cv.hline(20, 24, 41, col('navy', 4))
    # Guard monitor silhouette on right side of desk
    cv.outline_box(27, 42, 34, 48, col('glass', 5), col('steel', 0))
    cv.p(30, 44, col('white', 6))
    # Guard booth stone sill & sliding pass-through tray
    cv.hline(7, 40, 56, col('stone', 6))
    cv.hline(8, 39, 57, col('ink', 1))
    # Small blue "P / Security" sign on inner pier
    cv.outline_box(39, 36, 44, 43, col('blue', 3), col('steel', 0), top_hi=col('blue', 5))
    cv.p(41, 39, col('white', 6))
    # Manicured boxwood planter in front of guard booth!
    cv.rect(6, 65, 38, 77, col('stone', 5))
    cv.outline_box(6, 67, 38, 77, col('stone', 4), col('stone', 1), top_hi=col('stone', 6))
    for hx in range(8, 36, 3):
        cv.rect(hx, 61, hx + 3, 68, col('foliage', 4 if hx % 6 == 2 else 3))
        cv.p(hx + 1, 61, col('foliage', 5))
        if hx % 9 == 2:
            cv.p(hx + 1, 63, col('white', 6))  # Tiny manicured hedge blooms
    cv.hline(7, 37, 67, col('foliage', 1))

    # --- CENTRAL PORTAL ARCH (x=44..88, y=26..78) ---
    # Chamfered dark-steel & stone inner arch frame shoulders
    cv.rect(44, 26, 48, 77, col('kuro', 2))
    cv.vline(44, 26, 77, col('steel', 4))
    cv.vline(47, 26, 77, col('ink', 0))
    cv.rect(84, 26, 88, 77, col('kuro', 2))
    cv.vline(84, 26, 77, col('ink', 0))
    cv.vline(87, 26, 77, col('steel', 4))
    # Upper chamfered arch haunches (giving true portal arch silhouette!)
    for i in range(6):
        cv.hline(48, 54 - i, 26 + i, col('kuro', 2 if i < 5 else 1))
        cv.hline(78 + i, 84, 26 + i, col('kuro', 2 if i < 5 else 1))
    # Subtle shaded roadway / curb base inside portal + iconic red/white striped barrier arm!
    # Keep upper air of arch (y=32..57, x=48..84) cleanly transparent so road/sky shows through,
    # while grounding the barrier box, yellow-black bollards, and shaded entrance threshold strip!
    cv.outline_box(46, 56, 53, 76, col('yellow', 4), col('ink', 0), top_hi=col('yellow', 5))
    cv.rect(47, 62, 52, 66, col('kuro', 1))
    cv.p(49, 59, col('red', 4))  # Barrier status light
    # Red & white striped vehicle boom barrier arm (slightly angled/horizontal across portal)
    for bx in range(53, 82, 4):
        c_arm = col('red', 4) if ((bx - 53) // 4) % 2 == 0 else col('white', 6)
        cv.hline(bx, min(bx + 4, 82), 60, c_arm)
        cv.hline(bx, min(bx + 4, 82), 61, shade_rgba(c_arm, -2))
    # Right side pedestrian bollard
    cv.outline_box(80, 65, 84, 76, col('steel', 3), col('ink', 0), top_hi=col('yellow', 5))
    # Grounded stone/pavement threshold line across portal floor (y=72..78)
    cv.stipple_rect(48, 72, 84, 77, 'pavement', 3, 2, 4, seed=809, rate=0.18)
    for sx in range(52, 80, 6):
        cv.hline(sx, sx + 3, 74, col('yellow', 4))  # Speed bump markings
    cv.hline(48, 84, 77, col('ink', 1))

    # --- RIGHT WING: Sculptural Stone Complex Name Wall & Manicured Planters (x=88..124, y=26..78) ---
    draw_stone_blocks(cv, 88, 26, 124, 78, ramp='stone', base_i=5, ch=5, bw=9, seed=810)
    # Architectural warm cedar vertical louver strip on left edge of stone wall
    cv.siding_wall(89, 28, 96, 62, ramp='cedar', base_i=4, horizontal=False, step=2, seed=811)
    # Recessed dark granite complex monolith plaque with crisp geometric crest + "PARK" + "101"!
    cv.outline_box(97, 32, 122, 57, col('kuro', 1), col('stone', 1), top_hi=col('stone', 6))
    # Subtle brushed bronze inner border frame
    cv.hline(99, 120, 34, col('cedar', 3))
    # Crisp 7x5 geometric apartment crest emblem at top center
    draw_apt_crest(cv, 109, 36)
    cv.hline(101, 118, 42, col('cedar', 4))
    # Crisp readable "PARK" (15px wide) + "101" (11px wide) replacing dot blobs!
    draw_pixel_text(cv, 102, 44, 'PARK', fg=col('yellow', 5), shadow=col('ink', 0), gap=1)
    draw_pixel_text(cv, 104, 50, '101', fg=col('white', 6), shadow=col('ink', 0), gap=1)
    # Warm subtle architectural uplight bar at plaque base
    cv.hline(100, 119, 55, col('cedar', 5))

    # Manicured boxwood planter trough in front of stone name wall!
    cv.outline_box(90, 67, 122, 77, col('stone', 4), col('stone', 1), top_hi=col('stone', 6))
    for hx in range(92, 120, 3):
        cv.rect(hx, 60, hx + 3, 68, col('foliage', 5 if hx % 6 == 2 else 3))
        cv.p(hx + 1, 60, col('foliage', 6))
        if hx % 9 == 5:
            cv.p(hx + 1, 63, col('pink', 4))
    cv.hline(91, 121, 67, col('foliage', 1))

    # Grounding shadow along full bottom
    cv.hline(4, 44, 78, col('ink', 0))
    cv.hline(88, 124, 78, col('ink', 0))
    frame_building_edges(cv, 4, 44, 26, 79)
    frame_building_edges(cv, 88, 124, 26, 79)


# ===========================================================================
# 9. mf-bldg-kr_hillside_stepped (96x128) — Picturesque Seoul-Hillside Stepped Terrace House
# ===========================================================================

def draw_kr_hillside_stepped(cv):
    # Picturesque 3-tier stepped silhouette:
    #   3F Cozy Blue-Roofed Attic Pavilion: x=14..78, y=2..48
    #   2F Stepped-Back Cream Stucco Level + Wide Sunlit Patio & Iron Railing: x=6..90, y=46..88
    #   1F Heavy Stone Retaining Wall + Arched Garage/Shop Door + Exterior Stairs: x=4..92, y=86..128

    # --- 3F Cozy Blue-Roofed Attic Pavilion (x=14..78, y=2..48) ---
    # Classic Seoul-hillside pitched blue shingle/corrugated roof!
    cv.pitched_roof(12, 2, 80, 24, ramp='blue', ridge_hi=True, moss_rate=0.04, seed=901)
    # Small roof skylight / dormer vent on right slope
    cv.outline_box(58, 9, 67, 16, col('glass', 4), col('blue', 0), top_hi=col('coolwhite', 5))
    cv.p(60, 11, col('glass', 6))
    # Brick chimney on left edge
    cv.outline_box(17, 4, 23, 14, col('brick', 4), col('brick', 0), top_hi=col('brick', 6))
    # 3F warm cream-and-wood attic walls (y=24..48)
    cv.stipple_rect(14, 24, 76, 48, 'cream', 5, 4, 6, seed=902, rate=0.14)
    cv.hline(14, 76, 24, col('ink', 1))
    cv.hline(14, 76, 25, col('cream', 2))
    # Attic wooden siding accent trim on left
    cv.siding_wall(14, 25, 22, 48, ramp='cedar', base_i=4, horizontal=True, step=3, seed=903)
    # Cozy glowing attic window + colorful curtains + flower pot
    cv.window(25, 29, 45, 43, style='warm', frame='wood:1', sill='cedar:5', curtain='pink', warm=True, seed=904)
    cv.planter_box(27, 41, 43, 46, flower='yellow:5', pot_ramp='brick')
    # Wooden 3F attic terrace door opening onto the 2F rooftop walk ledge (NO floating dead-end stair stub!)
    cv.door_wood(49, 29, 61, 47, ramp='wood', glass_top=True)
    cv.p(62, 33, col('yellow', 5))  # Warm 3F wall sconce
    # Small shuttered attic side window on right of 3F pavilion (clean architecture, crisp right edge)
    cv.window(65, 31, 73, 41, style='glass', frame='wood:1', sill='cedar:5', seed=9041)
    cv.vline(75, 24, 48, col('concrete', 1))
    # Compact AC condenser relocated cleanly onto far-left 2F roof ledge (completely clear of stairs & rails!)
    draw_ac_wall(cv, 6, 41, pipe_down=0)
    # Clean right 2F roof ledge with potted shrub & low steel roof-edge guard rail
    draw_potted_tree(cv, 84, 46, rx=3, ry=3, pot_ramp='brick', blossom='pink:4', seed=9042)
    draw_iron_rail(cv, 76, 90, 42, 47, ramp='steel', step=3)

    # --- 2F Stepped-Back Cream Stucco Level + Distinct Shaded Walkable Wood Terrace Deck (y=47..88) ---
    # Upper 2F cream/kinari stucco house body (x=6..90, y=48..69)
    cv.stipple_rect(6, 48, 90, 69, 'kinari', 4, 3, 5, seed=905, rate=0.16)
    draw_slab_band(cv, 5, 91, 47, ramp='concrete', h=3)
    # Left 2F warm sunlit living window with orange curtains
    cv.window(10, 52, 31, 65, style='warm', frame='wood:1', sill='concrete:6', curtain='orange', warm=True, seed=906)
    # Center 2F cool glass window with teal blinds
    cv.window(35, 52, 52, 65, style='blinds', frame='wood:1', sill='concrete:6', curtain='teal', seed=907)
    # Real 2F Entry Doorway at the top of the exterior stair landing! (x=57..69, y=51..69)
    cv.rect(55, 49, 71, 51, col('steel', 2))  # Crisp entry rain canopy over 2F door
    cv.hline(55, 71, 49, col('coolwhite', 5))
    cv.hline(56, 70, 51, col('ink', 1))
    cv.door_wood(57, 51, 69, 69, ramp='wood', glass_top=True)
    cv.p(71, 55, col('yellow', 5))  # Warm 2F entry porch sconce
    cv.p(71, 56, col('orange', 4))
    draw_address_plaque(cv, 71, 60)

    # Solid stone masonry cheek supporting the right-side hillside steps (x=76..90, y=69..88)
    draw_stone_blocks(cv, 76, 69, 90, 88, ramp='stone', base_i=3, ch=5, bw=9, moss=0.06, seed=914)
    cv.hline(76, 90, 69, col('concrete', 5))

    # Distinct Shaded Walkable 2F Horizontal Wood Terrace Deck (x=6..70, y=69..84) + Concrete Stair Landing (x=70..78)
    # Rich dark/warm oak planks clearly distinct in tone & texture from the light cream plaster wall above!
    for y in range(69, 85):
        ry = y - 69
        for x in range(6, 70):
            rx = x - 6
            if ry == 0:
                cv.p(x, y, col('floorwood', 0))  # Crisp wall-to-deck crease shadow
            elif ry == 1:
                cv.p(x, y, col('floorwood', 1))  # North wall cast shadow on wood deck
            elif ry % 3 == 2:
                cv.p(x, y, col('floorwood', 2))  # Horizontal wood deck plank seam
            else:
                r = hsh(rx // 6, ry // 3, 908)
                cv.p(x, y, col('floorwood', 4 if (ry % 3 == 0 and r > 0.35) else 3))
    # Concrete stair landing pad seamlessly bridging top of exterior stairs to the 2F wood deck & doorway!
    cv.stipple_rect(70, 69, 78, 85, 'pavement', 4, 3, 5, seed=915, rate=0.14)
    cv.hline(70, 78, 69, col('concrete', 1))  # Wall crease shadow
    cv.hline(70, 78, 70, col('concrete', 6))  # Sunlit landing coping edge
    cv.vline(70, 69, 85, col('floorwood', 1))  # Material joint between wood deck & stone landing

    # Grounded props sitting ON the shaded horizontal wood deck (keeping x=56..78 walkway to 2F door clear!)
    cv.hline(9, 17, 77, col('floorwood', 0))
    draw_potted_tree(cv, 13, 77, rx=4, ry=4, pot_ramp='brick', blossom='red:4', seed=909)
    cv.hline(23, 39, 78, col('floorwood', 0))
    cv.outline_box(23, 72, 39, 78, col('cedar', 4), col('wood', 1), top_hi=col('cedar', 6))
    cv.hline(43, 55, 78, col('floorwood', 0))
    cv.planter_box(43, 73, 55, 78, flower='pink:4', pot_ramp='brick')
    # Stone welcome threshold step mat in front of 2F entry doorway on the wood deck
    cv.rect(58, 70, 68, 73, col('stone', 4))
    cv.hline(58, 68, 70, col('stone', 6))
    cv.hline(58, 68, 73, col('floorwood', 0))

    # Crisp open white-painted vertical-baluster front rail (y=77..85) ending cleanly at stair landing (x=71)!
    draw_open_baluster_rail(cv, 6, 72, 77, 85, rail_ramp='coolwhite', post_i=5, top_hi=5, step=3)
    # Dark iron top cap / contrast line so white rail pops cleanly over dark wood deck
    cv.hline(6, 72, 77, col('white', 6))
    cv.hline(6, 72, 78, col('steel', 1))
    draw_slab_band(cv, 5, 77, 85, ramp='concrete', h=3)

    # --- 1F Heavy Stone Retaining Wall & Arched Garage/Shop Door + Exterior Stairs (y=86..128) ---
    draw_stone_blocks(cv, 4, 88, 92, 127, ramp='stone', base_i=3, ch=5, bw=9, moss=0.14, seed=910)
    # Trailing lush green ivy vines cascading over top of the stone retaining wall!
    for ix in (8, 12, 18, 62, 68):
        iv_len = 5 + (ix % 6)
        for dy in range(iv_len):
            cv.p(ix + (dy % 2), 88 + dy, col('foliage', 4 if dy < 3 else 3))
            if dy % 3 == 0:
                cv.p(ix + 1, 88 + dy, col('foliage', 5))

    # Recessed Arched Garage / Neighborhood Workshop Door in stone wall (x=14..56, y=94..127)
    # Stone arch voussoir surround
    cv.rect(14, 96, 56, 127, col('stone', 1))
    cv.rect(17, 93, 53, 97, col('stone', 5))
    cv.hline(19, 51, 92, col('stone', 6))
    for vx in range(18, 52, 5):
        cv.vline(vx, 93, 97, col('stone', 1))
    # Deep recessed arched wooden/roll-up workshop door with warm lantern glow!
    cv.outline_box(17, 96, 53, 126, col('darkwood', 2), col('ink', 0))
    # Arched warm glazed transom at top of door
    cv.rect(20, 98, 50, 104, col('orange', 4))
    cv.rect(22, 99, 48, 103, col('yellow', 5))
    for mx in range(25, 48, 5):
        cv.vline(mx, 98, 104, col('darkwood', 1))
    # Double wooden workshop/garage doors below transom
    cv.siding_wall(19, 105, 35, 125, ramp='wood', base_i=4, horizontal=True, step=3, seed=911)
    cv.siding_wall(36, 105, 51, 125, ramp='wood', base_i=4, horizontal=True, step=3, seed=912)
    cv.vline(35, 105, 125, col('ink', 0))
    cv.p(33, 115, col('yellow', 5))
    cv.p(37, 115, col('yellow', 5))
    # Vintage wall lantern beside arch + blue address plaque
    cv.rect(8, 102, 12, 107, col('yellow', 5))
    cv.hline(8, 12, 101, col('steel', 1))
    cv.p(10, 104, col('white', 6))
    draw_address_plaque(cv, 58, 100)
    # Vintage red postbox + potted flowers at street base
    cv.outline_box(59, 113, 65, 124, col('red', 4), col('red', 0), top_hi=col('red', 5))
    cv.hline(60, 64, 116, col('ink', 0))
    cv.planter_box(6, 120, 15, 126, flower='yellow:5', pot_ramp='brick')

    # Exterior hillside concrete stairs climbing right side from street level to 2F patio (x=72..91, y=70..127)
    draw_exterior_stairs(cv, 72, 70, 91, 127, descend_right=True, step_h=4, ramp='concrete', rail_ramp='steel')

    cv.hline(3, 93, 127, col('ink', 0))
    frame_building_edges(cv, 4, 92, 48, 128)


# ===========================================================================
# 10. mf-bldg-kr_modern_cube_house (80x96) — Minimalist Exposed-Concrete & Warm-Cedar Cube Residence
# ===========================================================================

def draw_kr_modern_cube_house(cv):
    x0, x1 = 6, 74
    # --- Rooftop Pebble & Planter Deck (y=2..24) ---
    cv.flat_roof(x0, 2, x1, 24, deck_ramp='pavement', deck_i=4, para_ramp='concrete', seed=1001)
    # Crisp architectural river-pebble texture + flat stepping stones on roof deck
    cv.stipple_rect(x0 + 2, 6, x1 - 2, 20, 'pavement', 4, 2, 6, seed=1002, rate=0.35)
    for sx in (26, 36, 46):
        cv.outline_box(sx, 12, sx + 7, 17, col('concrete', 5), col('concrete', 2), top_hi=col('white', 6))
    # Minimalist rooftop skylight prism on left
    cv.outline_box(11, 7, 23, 15, col('glass', 4), col('steel', 1), top_hi=col('glass', 6))
    cv.hline(13, 20, 9, col('glass', 6))
    # Lush built-in cedar rooftop planter boxes along north & east edge
    cv.planter_box(27, 5, 50, 10, flower='yellow:5', pot_ramp='cedar')
    draw_potted_tree(cv, 62, 16, rx=5, ry=4, pot_ramp='cedar', blossom='pink:4', seed=1003)
    # Discreet rooftop AC tucked behind dark louver screen
    cv.outline_box(11, 15, 20, 20, col('kuro', 2), col('kuro', 0), top_hi=col('steel', 4))

    # --- 2F Cantilevered Architectural Cube & Glass Bay Window (y=24..60) ---
    # Exposed architectural concrete (노출콘크리트) cube slightly wider (cantilevered x=4..76!)
    draw_exposed_concrete(cv, 4, 24, 76, 59, ramp='concrete', base_i=4, pw=14, ph=12, seed=1004)
    cv.hline(4, 76, 24, col('white', 6))
    cv.hline(4, 76, 58, col('concrete', 1))
    # Deep horizontal cantilevered shadow line cast onto 1F below!
    cv.hline(6, 74, 59, col('ink', 0))
    cv.hline(6, 74, 60, col('ink', 0))
    cv.hline(6, 74, 61, col('concrete', 1))

    # Cantilevered 2F dark-steel & panoramic floor-to-ceiling glass bay window (x=13..63, y=29..55)
    cv.outline_box(12, 28, 64, 56, col('kuro', 1), col('ink', 0), top_hi=col('steel', 5))
    # Left panoramic glass pane: warm architectural golden interior (pendant lamp + wood bookshelf)
    cv.window(14, 30, 39, 54, style='warm', frame='kuro:1', sill=None, warm=True, seed=1005)
    cv.rect(17, 36, 24, 52, col('wood', 2))  # Modern bookshelf
    cv.hline(18, 23, 39, col('orange', 4))
    cv.hline(18, 23, 44, col('cream', 5))
    cv.vline(31, 31, 36, col('kuro', 0))     # Minimalist pendant lamp
    cv.hline(29, 34, 36, col('white', 6))
    cv.p(31, 37, col('yellow', 5))
    # Right panoramic glass pane: crisp sky-reflected glass + sheer white curtain
    cv.window(39, 30, 62, 54, style='glass', frame='kuro:1', sill=None, curtain='white', seed=1006)
    # Warm vertical cedar louver screen accent framing the right edge of 2F cube!
    cv.siding_wall(64, 28, 73, 56, ramp='cedar', base_i=4, horizontal=False, step=2, seed=1007)
    cv.vline(64, 28, 56, col('wood', 1))
    cv.vline(73, 28, 56, col('wood', 1))

    # --- 1F Exposed Concrete + Warm Wooden Recessed Porch Entrance (y=60..96) ---
    draw_exposed_concrete(cv, x0, 60, x1, 95, ramp='concrete', base_i=4, pw=14, ph=12, seed=1008)
    # Re-apply deep horizontal overhang shadow from cantilevered 2F cube
    cv.hline(x0, x1, 60, col('ink', 0))
    cv.hline(x0, x1, 61, col('ink', 1))
    cv.hline(x0, x1, 62, col('concrete', 2))

    # Left-center: Warm Cedar Recessed Porch Entrance (x=12..42, y=64..94)
    cv.outline_box(12, 64, 42, 94, col('wood', 2), col('ink', 0))
    # Deep cedar wood soffit & side walls inside porch
    cv.siding_wall(13, 65, 41, 93, ramp='cedar', base_i=4, horizontal=True, step=3, seed=1009)
    cv.hline(13, 41, 65, col('wood', 1))
    cv.hline(13, 41, 66, col('wood', 2))
    # Minimalist tall wooden pivot front door + glowing vertical sidelight
    cv.outline_box(18, 69, 32, 92, col('wood', 4), col('darkwood', 0), top_hi=col('cedar', 5))
    cv.vline(29, 77, 85, col('steel', 5))  # Sleek stainless pull handle
    cv.window(32, 69, 38, 92, style='warm', frame='darkwood:1', sill=None, warm=True)
    # Architectural glowing wall sconce inside cedar porch
    cv.rect(14, 74, 17, 78, col('yellow', 5))
    cv.p(15, 75, col('white', 6))
    # Floating concrete entry steps
    cv.rect(11, 91, 43, 95, col('concrete', 5))
    cv.hline(11, 43, 91, col('white', 6))
    cv.hline(11, 43, 94, col('concrete', 2))

    # Right 1F: Horizontal clerestory slit window (warm amber glow) + intercom + bamboo planter
    cv.window(47, 68, 69, 76, style='warm', frame='kuro:1', sill='concrete:6', warm=True, seed=1010)
    draw_address_plaque(cv, 44, 79)
    cv.outline_box(44, 85, 48, 91, col('steel', 4), col('steel', 0))
    cv.p(45, 86, col('glass', 5))
    # Lush architectural bamboo/grass planter along right base
    cv.outline_box(50, 88, 72, 94, col('stone', 3), col('stone', 0), top_hi=col('stone', 5))
    for bx in range(52, 70, 3):
        bh = 7 + (bx % 4)
        cv.vline(bx, 88 - bh, 89, col('foliage', 4 if bx % 6 == 0 else 3))
        cv.p(bx + 1, 88 - bh + 1, col('foliage', 5))
        cv.p(bx - 1, 88 - bh + 3, col('foliage', 6 if bx % 2 else 4))
    # Minimalist small shrub on far left base
    cv.planter_box(6, 89, 12, 94, flower='yellow:5', pot_ramp='stone')

    cv.hline(x0 - 1, x1 + 1, 95, col('ink', 0))
    frame_building_edges(cv, 4, 76, 24, 59)
    frame_building_edges(cv, x0, x1, 60, 96)


# ===========================================================================
# Pack 02 Manifest & Runner
# ===========================================================================

SPECS = [
    {
        'id': 'mf-bldg-kr_piloti_brick_villa',
        'name': '적벽돌 4층 필로티 빌라',
        'category': 'kr-residential',
        'w': 6, 'h': 8, 'passableTopRows': 2,
        'tags': ['building', 'kr-residential', 'villa', 'piloti', 'brick', 'korea'],
        'fn': draw_kr_piloti_brick_villa,
    },
    {
        'id': 'mf-bldg-kr_piloti_stone_villa',
        'name': '화강석·라임스톤 4층 필로티 빌라',
        'category': 'kr-residential',
        'w': 6, 'h': 8, 'passableTopRows': 2,
        'tags': ['building', 'kr-residential', 'villa', 'piloti', 'stone', 'korea'],
        'fn': draw_kr_piloti_stone_villa,
    },
    {
        'id': 'mf-bldg-kr_corner_terrace_villa',
        'name': '2층 코너 테라스 벽돌 빌라',
        'category': 'kr-residential',
        'w': 7, 'h': 7, 'passableTopRows': 2,
        'tags': ['building', 'kr-residential', 'villa', 'terrace', 'veranda', 'korea'],
        'fn': draw_kr_corner_terrace_villa,
    },
    {
        'id': 'mf-bldg-kr_rooftop_garden_house',
        'name': '옥상 텃밭 2층 단독주택',
        'category': 'kr-residential',
        'w': 6, 'h': 6, 'passableTopRows': 2,
        'tags': ['building', 'kr-residential', 'house', 'dandok', 'rooftop-garden', 'korea'],
        'fn': draw_kr_rooftop_garden_house,
    },
    {
        'id': 'mf-bldg-kr_duplex_townhouse',
        'name': '듀플렉스 쌍둥이 타운하우스',
        'category': 'kr-residential',
        'w': 7, 'h': 6, 'passableTopRows': 2,
        'tags': ['building', 'kr-residential', 'townhouse', 'duplex', 'modern'],
        'fn': draw_kr_duplex_townhouse,
    },
    {
        'id': 'mf-bldg-kr_apt_block_a',
        'name': '5층 복도식 아파트 101동',
        'category': 'kr-residential',
        'w': 8, 'h': 10, 'passableTopRows': 2,
        'tags': ['building', 'kr-residential', 'apartment', '101', 'korea'],
        'fn': draw_kr_apt_block_a,
    },
    {
        'id': 'mf-bldg-kr_apt_block_b',
        'name': '5층 테라코타 모던 아파트 102동',
        'category': 'kr-residential',
        'w': 8, 'h': 10, 'passableTopRows': 2,
        'tags': ['building', 'kr-residential', 'apartment', '102', 'terracotta', 'korea'],
        'fn': draw_kr_apt_block_b,
    },
    {
        'id': 'mf-bldg-kr_apt_gatehouse',
        'name': '아파트 단지 정문 문주·경비실',
        'category': 'kr-residential',
        'w': 8, 'h': 5, 'passableTopRows': 2,
        'tags': ['building', 'kr-residential', 'gatehouse', 'apartment', 'landmark', 'korea'],
        'fn': draw_kr_apt_gatehouse,
    },
    {
        'id': 'mf-bldg-kr_hillside_stepped',
        'name': '언덕 계단식 테라스 주택',
        'category': 'kr-residential',
        'w': 6, 'h': 8, 'passableTopRows': 2,
        'tags': ['building', 'kr-residential', 'hillside', 'terrace', 'seoul', 'korea'],
        'fn': draw_kr_hillside_stepped,
    },
    {
        'id': 'mf-bldg-kr_modern_cube_house',
        'name': '노출콘크리트 모던 큐브 하우스',
        'category': 'kr-residential',
        'w': 5, 'h': 6, 'passableTopRows': 2,
        'tags': ['building', 'kr-residential', 'modern', 'cube', 'concrete', 'cedar'],
        'fn': draw_kr_modern_cube_house,
    },
]


def build_pack():
    out_dir = os.path.join(OUT_ROOT, 'buildings', 'pack02_kr_residential')
    os.makedirs(out_dir, exist_ok=True)
    items = []
    for spec in SPECS:
        pw, ph = spec['w'] * 16, spec['h'] * 16
        cv = Canvas(pw, ph)
        spec['fn'](cv)
        out_path = os.path.join(out_dir, f"{spec['id']}.png")
        cv.save(out_path)
        items.append({
            'id': spec['id'],
            'name': spec['name'],
            'category': spec['category'],
            'w': spec['w'],
            'h': spec['h'],
            'passableTopRows': spec['passableTopRows'],
            'tags': spec['tags'],
        })

    manifest_path = os.path.join(out_dir, 'manifest.json')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump({'batch': 'pack02_kr_residential', 'items': items}, f, ensure_ascii=False, indent=2)
    print(f'pack02_kr_residential: generated {len(items)} buildings -> {out_dir}')
    return items


if __name__ == '__main__':
    build_pack()
