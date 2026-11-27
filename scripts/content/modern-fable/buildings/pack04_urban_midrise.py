#!/usr/bin/env python3
"""Building Pack 04: Urban Mid-Rise, Setbacks & Boutique Commercial (pack04_urban_midrise, 10 buildings).

Strictly locked to tiledata/jp-city/fable-city/palette.json via fable_lib.Canvas.
Every building follows the Fable 5.2 top-3/4 RPG pixel-art baseline:
  - Visible sunlit top planes (recessed flat roofs, setbacks, terraces, skylights, pergolas),
  - Rich material variation (warm limestone, weathered brick, coolwhite panels, slate brick, cedar, dark granite),
  - Zero floor cloning (every bay and floor tells its own interior/exterior story),
  - 35-55 harmonious Fable palette colors per building, binary alpha (0/255), grounded silhouette.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PARENT = os.path.dirname(HERE)
if PARENT not in sys.path:
    sys.path.insert(0, PARENT)

from fable_lib import Canvas, C, col, hsh, shade_rgba, OUT_ROOT

BATCH = 'pack04_urban_midrise'
OUT_DIR = os.path.join(OUT_ROOT, 'buildings', BATCH)


# ---------------------------------------------------------------------------
# Shared architectural pixel-art helpers (strictly Fable palette)
# ---------------------------------------------------------------------------

def draw_ashlar_wall(cv, x0, y0, x1, y1, ramp='cream', base_i=4, course_h=5, block_w=10, seed=0):
    """Carved limestone / sandstone ashlar masonry with warm staggered joints."""
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


def draw_panel_wall(cv, x0, y0, x1, y1, ramp='white', base_i=4, pw=12, ph=10, dimples=True, seed=0):
    """Architectural concrete panels with crisp reveal seams and optional tie-rod dimples."""
    for y in range(max(0, y0), min(cv.h, y1)):
        ry = y - y0
        ci = ry // ph
        yy = ry % ph
        for x in range(max(0, x0), min(cv.w, x1)):
            rx = x - x0
            bi = rx // pw
            bx = rx % pw
            if yy == ph - 1 or bx == pw - 1:
                cv.p(x, y, col(ramp, max(0, base_i - 2)))
            elif yy == 0:
                cv.p(x, y, col(ramp, min(base_i + 2, 6)))
            else:
                r = hsh(bi, ci, seed)
                t = base_i + (1 if r > 0.78 else (-1 if r < 0.20 else 0))
                cv.p(x, y, col(ramp, t))
                if dimples and (bx in (2, pw - 3)) and (yy in (2, ph - 3)):
                    cv.p(x, y, col(ramp, max(0, base_i - 2)))


def draw_cornice(cv, x0, y, x1, ramp='concrete', h=3, dentils=False):
    """Top-lit horizontal architectural cornice / stringcourse casting a 1px shadow below."""
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
    """Alternating limestone corner quoins on left and right edges of a facade."""
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


def draw_arched_window(cv, x0, y0, x1, y1, frame='stone:2', trim='cream:5', style='warm',
                       curtain=None, mullions=True, sill='stone:5', interior_fn=None, seed=0):
    """Top-3/4 arched window with rounded arch crown, keystone, mullions & optional custom interior."""
    w = x1 - x0
    h = y1 - y0
    arch_r = max(2, min(w // 2, 6))
    cx = (x0 + x1 - 1) / 2.0
    for y in range(y0, y1):
        ry = y - y0
        for x in range(x0, x1):
            # Arch mask at top
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
            is_border = on_rim or x in (x0, x1 - 1) or y == y1 - 1
            if is_border:
                cv.p(x, y, trim if (ry < arch_r and y <= y0 + 2) else frame)
            else:
                rx = x - (x0 + 1)
                iry = y - (y0 + 1)
                if style == 'warm':
                    if iry <= 1:
                        cv.p(x, y, col('orange', 2))
                    elif iry >= h // 2:
                        cv.p(x, y, col('yellow', 5 if (rx + iry) % 3 == 0 else 4))
                    else:
                        cv.p(x, y, col('orange', 4 if (rx + iry) % 4 != 0 else 3))
                elif style == 'amber_moody':
                    if iry <= 2:
                        cv.p(x, y, col('red', 1))
                    elif iry >= h - 7:
                        cv.p(x, y, col('orange', 4 if rx % 2 == 0 else 3))
                    else:
                        cv.p(x, y, col('orange', 3 if (rx + iry) % 3 != 0 else 2))
                elif style == 'cream_bright':
                    if iry <= 1:
                        cv.p(x, y, col('cream', 3))
                    elif (rx + iry) in (2, 3):
                        cv.p(x, y, col('white', 6))
                    else:
                        cv.p(x, y, col('cream', 5 if iry > h // 3 else 4))
                elif style == 'blinds':
                    cv.p(x, y, col('cream', 5 if iry % 2 == 0 else 3) if iry < h // 2 else col('glass', 3))
                else:
                    if iry == 0:
                        cv.p(x, y, col('glass', 0))
                    elif (rx + iry) in (2, 3, 6) and iry < h - 4:
                        cv.p(x, y, col('glass', 5))
                    elif iry >= h - 4:
                        cv.p(x, y, col('glass', 3))
                    else:
                        cv.p(x, y, col('glass', 2 if (rx + iry) % 4 != 0 else 3))
    # Keystone at arch apex
    cv.rect(int(cx), y0, int(cx) + 2, y0 + 2, trim)
    # Optional interior art/furniture callback
    if interior_fn is not None:
        interior_fn(cv, x0 + 2, y0 + max(3, arch_r - 1), x1 - 2, y1 - 1)
    # Optional curtains
    if curtain and w >= 8:
        for y in range(y0 + arch_r, y1 - 1):
            cv.p(x0 + 1, y, col(curtain, 4 if y % 2 == 0 else 2))
            cv.p(x0 + 2, y, col(curtain, 2 if y % 3 == 0 else 3))
            cv.p(x1 - 2, y, col(curtain, 3 if y % 2 == 0 else 1))
    # Mullions
    if mullions and w >= 9:
        mx = (x0 + x1) // 2
        cv.vline(mx, y0 + 2, y1 - 1, frame)
    if mullions and h >= 12:
        my = y0 + arch_r + (h - arch_r) // 2
        cv.hline(x0 + 1, x1 - 1, my, frame)
    if sill:
        cv.hline(x0 - 1, x1 + 1, y1, sill)
        cv.hline(x0, x1, y1 + 1, col('ink', 1))


def draw_closed_arched_window(cv, x0, y0, x1, y1, outline='stone:0', outer_trim=None, style='warm',
                              curtain=None, mullions=True, sill='stone:5', interior_fn=None, seed=0):
    """Water-tight top-3/4 arched window with a continuous 1px warm-violet/slate outline (zero arch gaps)."""
    w = x1 - x0
    h = y1 - y0
    arch_r = max(3, min(w // 2, 6))
    cx_rel = (w - 1) / 2.0
    rx_rad = max((w - 1) / 2.0, 1.0)
    # Build exact interior arch mask
    mask = [[False] * w for _ in range(h)]
    for ry in range(h):
        for rx in range(w):
            if ry >= arch_r:
                mask[ry][rx] = True
            else:
                dx = (rx - cx_rel) / rx_rad
                dy = (arch_r - ry) / float(arch_r)
                if dx * dx + dy * dy <= 1.04:
                    mask[ry][rx] = True

    def is_border(rx, ry):
        if not mask[ry][rx]:
            return False
        if rx == 0 or rx == w - 1 or ry == 0 or ry == h - 1:
            return True
        return not (mask[ry - 1][rx] and mask[ry + 1][rx] and mask[ry][rx - 1] and mask[ry][rx + 1])

    c_out = C(outline)
    # Optional outer architectural stone molding 1px above/outside the continuous dark arch outline
    if outer_trim is not None:
        c_trim = C(outer_trim)
        for ry in range(arch_r + 1):
            for rx in range(w):
                if not mask[ry][rx]:
                    if (ry + 1 < h and mask[ry + 1][rx]) or (rx > 0 and mask[ry][rx - 1]) or (rx + 1 < w and mask[ry][rx + 1]):
                        cv.p(x0 + rx, y0 + ry, c_trim)
        # Crown molding 1px above apex
        for rx in range(w):
            if mask[0][rx]:
                cv.p(x0 + rx, y0 - 1, c_trim)

    # Fill glass interior first
    for ry in range(h):
        y = y0 + ry
        for rx in range(w):
            if not mask[ry][rx] or is_border(rx, ry):
                continue
            x = x0 + rx
            irx = rx - 1
            iry = ry - 1
            if style == 'warm':
                if iry <= 1:
                    cv.p(x, y, col('orange', 2))
                elif iry >= h // 2:
                    cv.p(x, y, col('yellow', 5 if (irx + iry) % 3 == 0 else 4))
                else:
                    cv.p(x, y, col('orange', 4 if (irx + iry) % 4 != 0 else 3))
            elif style == 'cream_bright':
                if iry <= 1:
                    cv.p(x, y, col('cream', 3))
                elif (irx + iry) in (2, 3):
                    cv.p(x, y, col('white', 6))
                else:
                    cv.p(x, y, col('cream', 5 if iry > h // 3 else 4))
            elif style == 'blinds':
                cv.p(x, y, col('cream', 5 if iry % 2 == 0 else 3) if iry < h // 2 else col('glass', 3))
            else:
                if iry <= 1:
                    cv.p(x, y, col('glass', 0))
                elif (irx + iry) in (2, 3, 6) and iry < h - 4:
                    cv.p(x, y, col('glass', 5))
                elif iry >= h - 4:
                    cv.p(x, y, col('glass', 3))
                else:
                    cv.p(x, y, col('glass', 2 if (irx + iry) % 4 != 0 else 3))

    if interior_fn is not None:
        interior_fn(cv, x0 + 2, y0 + max(3, arch_r), x1 - 2, y1 - 1)

    if curtain and w >= 8:
        for y in range(y0 + arch_r, y1 - 1):
            cv.p(x0 + 1, y, col(curtain, 4 if y % 2 == 0 else 2))
            cv.p(x0 + 2, y, col(curtain, 2 if y % 3 == 0 else 3))
            cv.p(x1 - 2, y, col(curtain, 3 if y % 2 == 0 else 1))

    if mullions and w >= 9:
        mx = (x0 + x1) // 2
        cv.vline(mx, y0 + 1, y1 - 1, c_out)
    if mullions and h >= 12:
        my = y0 + arch_r + (h - arch_r) // 2
        cv.hline(x0 + 1, x1 - 1, my, c_out)

    # Stamp continuous 1px dark outline last so nothing can break or leave white gaps along the arch
    for ry in range(h):
        for rx in range(w):
            if is_border(rx, ry):
                cv.p(x0 + rx, y0 + ry, c_out)

    if sill:
        cv.hline(x0 - 1, x1 + 1, y1, sill)
        cv.hline(x0, x1, y1 + 1, col('ink', 1))


def draw_glass_rail(cv, x0, y0, x1, y1, post_step=12, floor_hint='floorwood:3'):
    """Modern architectural tempered-glass terrace railing with steel handrail & stanchions."""
    cv.hline(x0, x1, y0, col('coolwhite', 5))
    cv.hline(x0, x1, y0 + 1, col('steel', 2))
    for y in range(y0 + 2, y1 - 2):
        for x in range(x0, x1):
            rx = x - x0
            if rx in (0, 1, x1 - x0 - 1, x1 - x0 - 2) or (rx % post_step == 0):
                cv.p(x, y, col('steel', 4 if rx % post_step == 0 else 2))
            elif rx % post_step == 1:
                cv.p(x, y, col('steel', 1))
            else:
                diag = (rx + (y - y0)) % 9
                if diag in (1, 2):
                    cv.p(x, y, col('glass', 5))
                elif diag == 3:
                    cv.p(x, y, col('glass', 4))
                elif y == y1 - 3:
                    cv.p(x, y, floor_hint)
                else:
                    cv.p(x, y, col('glass', 3))
    cv.hline(x0, x1, y1 - 2, col('steel', 4))
    cv.hline(x0, x1, y1 - 1, col('steel', 1))


def draw_umbrella(cv, cx, cy, rx=9, ry=5, ramp_a='red', ramp_b='cream'):
    """Top-3/4 striped cafe patio umbrella with cast shadow & pole."""
    # Cast shadow on deck below
    for y in range(cy + ry - 1, cy + ry + 5):
        for x in range(cx - rx + 2, cx + rx + 2):
            if ((x - (cx + 1)) / max(rx, 1)) ** 2 + ((y - (cy + ry + 2)) / 3.5) ** 2 <= 1.0:
                cv.p(x, y, shade_rgba(cv.get(x, y), -2))
    # Pole
    cv.vline(cx, cy + 2, cy + ry + 6, col('steel', 1))
    cv.vline(cx + 1, cy + 2, cy + ry + 5, col('steel', 4))
    # Canopy dome
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
    # Finial cap
    cv.p(cx, cy - 1, col('yellow', 5))
    cv.p(cx, cy, col('steel', 2))


def draw_skylight(cv, x0, y0, x1, y1, frame='steel:2'):
    """Top-3/4 pitched glass roof skylight with steel mullions & sky reflections."""
    cv.outline_box(x0, y0, x1, y1, col('glass', 3), frame, top_hi=col('coolwhite', 5))
    for y in range(y0 + 2, y1 - 1):
        for x in range(x0 + 1, x1 - 1):
            rx = x - x0
            ry = y - y0
            if rx % 6 == 0:
                cv.p(x, y, frame)
            elif (rx + ry) % 7 in (1, 2):
                cv.p(x, y, col('glass', 6))
            elif ry <= 3:
                cv.p(x, y, col('glass', 5))
            else:
                cv.p(x, y, col('glass', 3 if (rx + ry) % 3 else 4))
    cv.hline(x0 + 1, x1 + 1, y1, col('ink', 1))


def draw_pixel_text(cv, x0, y0, text, color, vertical=False, spacing=1):
    """Crisp 3x5 pixel uppercase font for unmistakable HOTEL / CAFE / LIVE signs."""
    FONT = {
        'A': ['010', '101', '111', '101', '101'],
        'B': ['110', '101', '110', '101', '110'],
        'C': ['111', '100', '100', '100', '111'],
        'D': ['110', '101', '101', '101', '110'],
        'E': ['111', '100', '110', '100', '111'],
        'F': ['111', '100', '110', '100', '100'],
        'G': ['111', '100', '101', '101', '111'],
        'H': ['101', '101', '111', '101', '101'],
        'I': ['111', '010', '010', '010', '111'],
        'J': ['001', '001', '001', '101', '111'],
        'K': ['101', '101', '110', '101', '101'],
        'L': ['100', '100', '100', '100', '111'],
        'M': ['101', '111', '101', '101', '101'],
        'N': ['101', '111', '111', '101', '101'],
        'O': ['111', '101', '101', '101', '111'],
        'P': ['110', '101', '110', '100', '100'],
        'Q': ['111', '101', '101', '111', '001'],
        'R': ['110', '101', '110', '101', '101'],
        'S': ['111', '100', '111', '001', '111'],
        'T': ['111', '010', '010', '010', '010'],
        'U': ['101', '101', '101', '101', '111'],
        'V': ['101', '101', '101', '101', '010'],
        'W': ['101', '101', '101', '111', '101'],
        'X': ['101', '101', '010', '101', '101'],
        'Y': ['101', '101', '010', '010', '010'],
        'Z': ['111', '001', '010', '100', '111'],
        ' ': ['000', '000', '000', '000', '000'],
    }
    cx, cy = x0, y0
    for ch in text.upper():
        rows = FONT.get(ch, FONT[' '])
        for ry, row in enumerate(rows):
            for rx, bit in enumerate(row):
                if bit == '1':
                    cv.p(cx + rx, cy + ry, color)
        if vertical:
            cy += 5 + spacing
        else:
            cx += 3 + spacing


def draw_juliet_balcony(cv, x0, y0, x1, y1, iron='kuro:1', hi='steel:4'):
    """Ornate wrought-iron Juliet balcony railing."""
    cv.hline(x0, x1, y0, hi)
    cv.hline(x0, x1, y0 + 1, iron)
    for y in range(y0 + 2, y1 - 1):
        for x in range(x0, x1):
            rx = x - x0
            if rx in (0, x1 - x0 - 1) or rx % 3 == 0:
                cv.p(x, y, iron)
            elif y == y0 + 3 and rx % 3 == 1:
                cv.p(x, y, hi)
    cv.hline(x0, x1, y1 - 1, iron)
    cv.hline(x0 + 1, x1 - 1, y1, col('ink', 1))


def draw_sconce(cv, cx, cy):
    """Warm glowing brass wall sconce lantern with soft halo."""
    cv.p(cx, cy - 1, col('cha', 5))
    cv.p(cx - 1, cy, col('orange', 4))
    cv.p(cx, cy, col('yellow', 5))
    cv.p(cx + 1, cy, col('orange', 4))
    cv.p(cx, cy + 1, col('yellow', 4))
    cv.p(cx, cy + 2, col('cha', 3))


def draw_potted_topiary(cv, cx, bot_y, pot_ramp='kuro', flower=None):
    """Compact clipped topiary urn beside upscale entrances."""
    cv.outline_box(cx - 3, bot_y - 5, cx + 4, bot_y, col(pot_ramp, 3), col(pot_ramp, 0), top_hi=col(pot_ramp, 5))
    cv.foliage_cluster(cx, bot_y - 9, 3, 4, ramp='foliage', seed=cx * 17 + bot_y, blossom=flower)


def draw_bistro_table(cv, cx, bot_y):
    """Tiny top-3/4 cafe table with two chairs."""
    # Chairs left/right
    cv.rect(cx - 5, bot_y - 4, cx - 3, bot_y, col('wood', 2))
    cv.p(cx - 4, bot_y - 5, col('wood', 4))
    cv.rect(cx + 4, bot_y - 4, cx + 6, bot_y, col('wood', 2))
    cv.p(cx + 5, bot_y - 5, col('wood', 4))
    # Table top & leg
    cv.outline_box(cx - 3, bot_y - 6, cx + 4, bot_y - 3, col('white', 5), col('steel', 2), top_hi=col('white', 6))
    cv.vline(cx, bot_y - 3, bot_y, col('steel', 1))
    cv.p(cx - 1, bot_y - 5, col('brick', 4))  # coffee cup


def draw_water_tower(cv, x, y, w=20, h=24):
    """Classic downtown cedar-stave rooftop water tower with conical roof & iron trestle."""
    cx = x + w // 2
    # Conical slate roof (7px tall)
    for ry in range(7):
        half = max(1, int((ry + 1) * (w // 2) / 6.5))
        for px in range(cx - half, cx + half + 1):
            if px == cx - half or px == cx + half:
                cv.p(px, y + ry, col('kawara', 0))
            elif px < cx:
                cv.p(px, y + ry, col('kawara', 5 if (px + ry) % 2 == 0 else 4))
            else:
                cv.p(px, y + ry, col('kawara', 2 if (px + ry) % 2 == 0 else 3))
    cv.p(cx, y - 1 if y > 0 else y, col('steel', 5))  # finial
    # Cedar stave cylinder (10px tall)
    ty0, ty1 = y + 7, y + 17
    tx0, tx1 = x + 2, x + w - 2
    for py in range(ty0, ty1):
        for px in range(tx0, tx1):
            rx = px - tx0
            tw = tx1 - tx0
            if px in (tx0, tx1 - 1):
                cv.p(px, py, col('wood', 0))
            elif py in (ty0 + 2, ty0 + 6, ty1 - 1):
                cv.p(px, py, col('steel', 1 if rx > tw // 2 else 3))  # iron hoops
            else:
                shade = 5 if rx < tw // 3 else (4 if rx < (2 * tw) // 3 else 2)
                if rx % 3 == 0:
                    shade = max(1, shade - 1)
                cv.p(px, py, col('cedar', shade))
    # Braced steel trestle legs (7px tall)
    ly0, ly1 = ty1, y + h
    for lx in (tx0 + 1, cx, tx1 - 2):
        cv.vline(lx, ly0, ly1, col('steel', 1))
        cv.vline(lx + 1, ly0, ly1, col('steel', 3))
    # Cross-bracing X
    for i in range(ly1 - ly0):
        bx1 = tx0 + 2 + int(i * (tx1 - tx0 - 4) / max(1, ly1 - ly0 - 1))
        bx2 = tx1 - 3 - int(i * (tx1 - tx0 - 4) / max(1, ly1 - ly0 - 1))
        cv.p(bx1, ly0 + i, col('steel', 2))
        cv.p(bx2, ly0 + i, col('steel', 2))


def outline_silhouette(cv, ink='ink:0'):
    """Add crisp 1px outer silhouette grounding along transparent-to-opaque transitions where needed."""
    c_ink = C(ink)
    # Only darken bottom grounding line and subtle side contours already handled per building
    for x in range(cv.w):
        if cv.get(x, cv.h - 1)[3] == 255:
            cv.p(x, cv.h - 1, shade_rgba(cv.get(x, cv.h - 1), -2))


# ---------------------------------------------------------------------------
# 1. mf-bldg-mid_setback_cafe (112x128)
# ---------------------------------------------------------------------------
def build_mid_setback_cafe():
    cv = Canvas(112, 128)
    # 3F setback volume (x=12..100, y=2..45)
    # Concrete parapet roof (y=2..18)
    cv.flat_roof(12, 2, 100, 18, deck_ramp='concrete', deck_i=3, para_ramp='concrete', seed=101)
    draw_skylight(cv, 36, 5, 74, 14, frame='steel:2')
    cv.roof_ac(17, 6)
    # Small roof exhaust & skylight vent on right
    cv.outline_box(80, 6, 92, 13, col('coolwhite', 4), col('steel', 1), top_hi=col('coolwhite', 5))
    cv.hline(82, 90, 9, col('steel', 2))
    cv.hline(81, 93, 13, col('ink', 1))

    # 3F setback facade (y=18..45, x=12..100)
    draw_ashlar_wall(cv, 12, 18, 100, 45, ramp='cream', base_i=4, course_h=5, block_w=11, seed=102)
    cv.vline(12, 18, 45, col('stone', 1))
    cv.vline(99, 18, 45, col('stone', 0))
    # Cedar timber surround for 3F central terrace doors
    cv.outline_box(39, 22, 73, 45, col('cedar', 3), col('wood', 1), top_hi=col('cedar', 5))
    cv.door_glass(42, 24, 56, 45, frame='wood:1', warm=True)
    cv.door_glass(56, 24, 70, 45, frame='wood:1', warm=False)
    # 3F left window (warm studio with plants) & right window (blinds + terrace lamp)
    cv.window(17, 23, 34, 38, style='warm', frame='wood:1', sill='stone:5', curtain='teal', seed=11)
    cv.planter_box(18, 36, 33, 41, flower='orange:4', pot_ramp='brick')
    cv.window(78, 23, 95, 38, style='blinds', frame='wood:1', sill='stone:5', curtain='red', seed=12)
    draw_sconce(cv, 37, 30)
    draw_sconce(cv, 75, 30)

    # 3F WIDE SUNLIT TERRACE (x=2..110, y=43..66)
    # Side wall coping for stepped-back podium edges (x=2..12 and x=100..110)
    cv.outline_box(2, 43, 14, 59, col('concrete', 4), col('stone', 1), top_hi=col('concrete', 6))
    cv.outline_box(98, 43, 110, 59, col('concrete', 4), col('stone', 1), top_hi=col('concrete', 6))
    # Full-width warm oak deck
    cv.terrace_deck(4, 44, 108, 65, floor_ramp='floorwood', rail_ramp='wood', seed=103)
    # Lush planters on left & right setback corners
    cv.planter_box(5, 40, 17, 50, flower='red:4', pot_ramp='wood')
    cv.foliage_cluster(9, 41, 4, 4, ramp='foliage', seed=104, blossom=col('orange', 4))
    cv.planter_box(94, 40, 107, 50, flower='yellow:4', pot_ramp='wood')
    cv.foliage_cluster(102, 41, 4, 4, ramp='foliage', seed=105, blossom=col('pink', 4))
    # Cafe seating + umbrellas on the sunlit 3F terrace!
    draw_bistro_table(cv, 26, 56)
    draw_umbrella(cv, 25, 44, rx=9, ry=5, ramp_a='red', ramp_b='cream')
    draw_bistro_table(cv, 55, 56)
    draw_bistro_table(cv, 84, 56)
    draw_umbrella(cv, 84, 44, rx=9, ry=5, ramp_a='teal', ramp_b='cream')
    # Glass front balustrade rail across full 3F terrace
    draw_glass_rail(cv, 2, 57, 110, 66, post_step=13, floor_hint=col('floorwood', 3))

    # 2F WARM LIMESTONE PODIUM (x=2..110, y=66..95)
    draw_ashlar_wall(cv, 2, 66, 110, 95, ramp='cream', base_i=4, course_h=5, block_w=10, seed=106)
    draw_cornice(cv, 2, 66, 110, ramp='stone', h=3, dentils=True)
    # Tall timber & glass bay window (left-center: x=8..62, y=71..92)
    cv.outline_box(8, 71, 62, 92, col('cedar', 3), col('wood', 0), top_hi=col('cedar', 5))
    for bx, style, warm in [(10, 'warm', True), (27, 'warm', True), (44, 'glass', False)]:
        cv.window(bx, 73, bx + 16, 90, style=style, warm=warm, frame='wood:1', sill=None, seed=bx)
        # Hanging pendant lamp inside bay 1 & 2
        if warm:
            cv.vline(bx + 8, 74, 78, col('darkwood', 1))
            cv.rect(bx + 7, 78, bx + 10, 80, col('yellow', 5))
            # Coffee roaster shelves silhouette
            cv.hline(bx + 2, bx + 14, 85, col('wood', 2))
            cv.rect(bx + 3, 83, bx + 6, 85, col('brick', 4))
            cv.rect(bx + 10, 83, bx + 13, 85, col('teal', 4))
    cv.hline(7, 63, 92, col('stone', 5))
    cv.hline(8, 62, 93, col('ink', 1))
    # 2F Right bays: two distinct framed limestone windows
    cv.window(69, 72, 85, 89, style='glass', frame='wood:1', sill='stone:5', curtain='cream', seed=107)
    cv.window(90, 72, 105, 89, style='warm', frame='wood:1', sill='stone:5', curtain='brick', seed=108)
    cv.planter_box(91, 87, 104, 92, flower='yellow:4', pot_ramp='brick')

    # 1F CORNER SPECIALTY COFFEE ROASTERY (x=2..110, y=95..128)
    draw_ashlar_wall(cv, 2, 95, 110, 128, ramp='kinari', base_i=3, course_h=5, block_w=10, seed=109)
    draw_cornice(cv, 2, 94, 110, ramp='stone', h=2)
    # Stone plinth base
    cv.tile_cladding(2, 122, 110, 128, ramp='stone', base_i=3, cw=8, ch=4, seed=110)

    # Coffee roastery timber fascia sign (x=6..63, y=96..103) with tiny coffee-cup icon
    cv.outline_box(6, 96, 63, 103, col('darkwood', 2), col('darkwood', 0), top_hi=col('cedar', 4))
    cv.rect(8, 99, 12, 102, col('cream', 5))
    cv.p(12, 100, col('cream', 5))
    cv.p(9, 97, col('yellow', 5))
    cv.p(11, 97, col('yellow', 5))
    draw_pixel_text(cv, 16, 97, 'ROASTERY', col('cream', 5), spacing=2)
    # Warm striped cafe awning (x=6..63, y=103..109)
    cv.awning(6, 103, 63, 109, ramp_a='brick', ramp_b='cream', stripe_w=4)

    # Wide timber/glass roastery showcase bay (x=8..61, y=109..124)
    cv.outline_box(8, 109, 61, 125, col('wood', 2), col('darkwood', 0))
    for bx in (10, 27, 44):
        cv.rect(bx, 110, bx + 15, 123, col('orange', 3))
        cv.rect(bx, 110, bx + 15, 114, col('orange', 2))
        cv.rect(bx + 1, 115, bx + 14, 122, col('yellow', 4))
        # Diagonal sunlit glass reflection
        for d in range(5):
            cv.p(bx + 1 + d, 111 + d, col('glass', 5))
    # Interior espresso machine, pastry display & warm bulbs
    cv.rect(12, 117, 23, 123, col('wood', 2))  # counter
    cv.rect(14, 114, 20, 117, col('steel', 4))  # espresso machine
    cv.p(16, 115, col('red', 4))
    cv.rect(29, 117, 40, 123, col('cedar', 4))  # pastry case
    cv.p(31, 118, col('orange', 5))
    cv.p(34, 118, col('brick', 4))
    cv.p(37, 118, col('yellow', 5))
    cv.rect(47, 116, 56, 123, col('rooftile', 3))  # copper roaster drum
    cv.rect(49, 117, 54, 121, col('orange', 4))
    cv.p(51, 118, col('yellow', 5))

    # Cafe corner timber/glass entrance (x=66..84, y=100..127)
    cv.outline_box(66, 100, 84, 127, col('wood', 3), col('darkwood', 0), top_hi=col('cedar', 5))
    cv.door_glass(68, 104, 82, 126, frame='wood:1', warm=True)
    cv.rect(68, 101, 82, 104, col('yellow', 4))  # glowing transom
    draw_sconce(cv, 64, 107)
    draw_sconce(cv, 86, 107)
    # A-frame chalkboard menu sign on sidewalk
    cv.outline_box(59, 119, 65, 127, col('kuro', 2), col('wood', 1), top_hi=col('wood', 4))
    cv.hline(60, 64, 121, col('cream', 5))
    cv.hline(60, 63, 123, col('yellow', 4))

    # Right specialty coffee bag display window (x=87..106, y=102..123)
    cv.window(87, 102, 106, 122, style='warm', frame='wood:1', sill='stone:5', seed=112)
    cv.rect(90, 115, 95, 121, col('straw', 4))  # burlap bean sack
    cv.rect(96, 114, 102, 121, col('cedar', 4))
    cv.planter_box(88, 121, 105, 127, flower='orange:4', pot_ramp='brick')

    # Clean left/right edge finish on podium
    cv.vline(2, 66, 128, col('stone', 1))
    cv.vline(109, 66, 128, col('stone', 0))
    cv.edge_finish(top_y=2)
    return cv


# ---------------------------------------------------------------------------
# 2. mf-bldg-mid_brick_fireescape (96x144)
# ---------------------------------------------------------------------------
def build_mid_brick_fireescape():
    cv = Canvas(96, 144)
    # Flat tar-gravel roof (y=10..30, x=2..94)
    cv.flat_roof(2, 10, 94, 30, deck_ramp='asphalt', deck_i=2, para_ramp='stone', seed=201)
    # Classic wooden rooftop water tower rising above roof on left (x=10..32, y=1..25)
    draw_water_tower(cv, 10, 1, w=22, h=24)
    # Brick chimney + steel roof hatch on right
    cv.outline_box(76, 12, 86, 25, col('brick', 3), col('brick', 0), top_hi=col('stone', 5))
    cv.rect(78, 13, 84, 15, col('kuro', 1))
    cv.roof_penthouse(52, 13, w=16, h=12, ramp='stone')
    cv.roof_ac(36, 17)

    # Heavy stone cornice (y=28..33)
    draw_cornice(cv, 1, 28, 95, ramp='stone', h=4, dentils=True)

    # 2F-4F weathered red-brick masonry (y=33..108, x=2..94)
    cv.brick_wall(2, 33, 94, 108, ramp='brick', base_i=3, course_h=3, brick_w=6, seed=202)
    # Subtle weathered darker brick patches for organic texture
    for px, py in [(8, 42), (32, 66), (14, 88), (48, 39), (26, 97), (78, 60)]:
        cv.shade_rect(px, py, px + 7, py + 5, -1)
    # Stone lintel stringcourses & corner brick trim
    cv.hline(2, 94, 57, col('stone', 4))
    cv.hline(2, 94, 58, col('brick', 1))
    cv.hline(2, 94, 82, col('stone', 4))
    cv.hline(2, 94, 83, col('brick', 1))
    cv.vline(2, 33, 108, col('brick', 1))
    cv.vline(93, 33, 108, col('brick', 0))

    # Varied loft windows across 4F, 3F, 2F (ZERO cloning!)
    # 4F (y=36..53)
    cv.window(9, 37, 26, 53, style='warm', frame='darkwood:1', sill='stone:5', curtain='red', seed=210)
    cv.hline(8, 27, 36, col('stone', 5))
    cv.vline(17, 39, 43, col('darkwood', 1))
    cv.p(17, 43, col('yellow', 5))  # hanging pendant lamp
    cv.window(35, 37, 52, 53, style='blinds', frame='darkwood:1', sill='stone:5', curtain=None, seed=211)
    cv.hline(34, 53, 36, col('stone', 5))
    cv.window(62, 37, 81, 53, style='warm', frame='darkwood:1', sill='stone:5', curtain='cream', seed=212)
    cv.hline(61, 82, 36, col('stone', 5))
    cv.rect(68, 46, 75, 51, col('wood', 2))  # easel/desk silhouette

    # 3F (y=61..78)
    cv.window(9, 62, 26, 78, style='glass', frame='darkwood:1', sill='stone:5', curtain='green', seed=220)
    cv.hline(8, 27, 61, col('stone', 5))
    cv.planter_box(10, 75, 25, 79, flower='red:4', pot_ramp='brick')
    cv.window(35, 62, 52, 78, style='warm', frame='darkwood:1', sill='stone:5', curtain='teal', seed=221)
    cv.hline(34, 53, 61, col('stone', 5))
    cv.rect(38, 70, 49, 76, col('wood', 3))  # bookshelf silhouette
    cv.p(40, 71, col('red', 4))
    cv.p(43, 71, col('blue', 4))
    cv.p(46, 71, col('yellow', 5))
    cv.window(62, 62, 81, 78, style='glass', frame='darkwood:1', sill='stone:5', curtain='brick', seed=222)
    cv.hline(61, 82, 61, col('stone', 5))
    # Window AC unit on 3F right bay
    cv.outline_box(72, 71, 80, 77, col('coolwhite', 4), col('steel', 1), top_hi=col('white', 5))
    cv.hline(73, 79, 74, col('steel', 2))

    # 2F (y=86..103)
    draw_arched_window(cv, 9, 86, 26, 103, frame='darkwood:1', trim='stone:5', style='warm',
                       curtain='cream', mullions=True, sill='stone:5', seed=230)
    draw_arched_window(cv, 35, 86, 52, 103, frame='darkwood:1', trim='stone:5', style='glass',
                       curtain='pink', mullions=True, sill='stone:5', seed=231)
    draw_arched_window(cv, 62, 86, 81, 103, frame='darkwood:1', trim='stone:5', style='warm',
                       curtain='navy', mullions=True, sill='stone:5', seed=232)

    # DARK-IRON EXTERIOR ZIGZAG FIRE ESCAPE across right bays (x=55..90, y=46..118)
    def draw_landing(lx0, ly, lx1):
        # Cast shadow on brick below
        cv.shade_rect(lx0 + 1, ly + 7, lx1 + 1, ly + 10, -1)
        # Top iron rail + vertical balusters + slatted floor beam
        cv.hline(lx0, lx1, ly, col('steel', 4))
        cv.hline(lx0, lx1, ly + 1, col('kuro', 0))
        for x in range(lx0, lx1, 3):
            cv.vline(x, ly + 1, ly + 6, col('kuro', 1))
        cv.hline(lx0, lx1, ly + 3, col('kuro', 2))
        cv.hline(lx0, lx1, ly + 6, col('kuro', 0))
        cv.hline(lx0, lx1, ly + 7, col('steel', 2))
        # Diagonal underside iron brackets
        for bx in (lx0 + 4, lx1 - 5):
            cv.p(bx, ly + 8, col('kuro', 1))
            cv.p(bx, ly + 9, col('kuro', 1))

    def draw_zigzag_stairs(sx0, sy0, sx1, sy1):
        steps = max(1, sy1 - sy0)
        for i in range(steps + 1):
            t = i / steps
            px = int(round(sx0 + (sx1 - sx0) * t))
            py = sy0 + i
            # Cast shadow on brick
            cv.p(px + 2, py + 1, col('ink', 0))
            # Crisp dark-iron stringer with steel specular highlight edge so zigzag reads unmistakably
            cv.rect(px - 1, py, px + 2, py + 1, col('kuro', 0))
            cv.p(px - 1, py - 1, col('steel', 4))
            if i % 3 == 0:
                cv.hline(px - 2, px + 3, py, col('steel', 4))
            cv.p(px, py - 4, col('steel', 5))
            cv.p(px, py - 3, col('kuro', 0))
            if i % 4 == 0:
                cv.vline(px, py - 3, py, col('steel', 3))

    # Draw stairs behind landings, then landings crisp in front
    draw_zigzag_stairs(84, 55, 62, 74)   # 4F -> 3F right-to-left
    draw_zigzag_stairs(62, 80, 84, 99)   # 3F -> 2F left-to-right
    draw_landing(55, 49, 90)             # 4F landing
    draw_landing(55, 74, 90)             # 3F landing
    draw_landing(55, 99, 90)             # 2F landing
    # Retractable drop-ladder hanging from 2F right end (x=83..89, y=106..121)
    cv.vline(84, 106, 121, col('kuro', 0))
    cv.vline(88, 106, 121, col('kuro', 0))
    for ry in range(108, 121, 3):
        cv.hline(84, 89, ry, col('steel', 3))

    # 1F ARCHED-ENTRY BISTRO (x=2..94, y=108..144)
    draw_ashlar_wall(cv, 2, 108, 94, 144, ramp='stone', base_i=3, course_h=5, block_w=9, seed=240)
    draw_cornice(cv, 2, 107, 94, ramp='stone', h=3)
    # Bistro burgundy fascia sign (x=8..58, y=111..118)
    cv.outline_box(8, 111, 58, 118, col('red', 1), col('kuro', 0), top_hi=col('red', 3))
    draw_pixel_text(cv, 16, 112, 'BISTRO', col('cream', 5), spacing=2)

    # Arched bistro entry doorway (x=10..29, y=119..143)
    draw_arched_window(cv, 10, 119, 29, 143, frame='darkwood:0', trim='cream:5', style='warm',
                       mullions=False, sill=None, seed=241)
    # Double bistro door leaves inside arch
    cv.rect(12, 125, 27, 143, col('darkwood', 2))
    cv.window(13, 126, 19, 137, style='warm', frame='darkwood:0', sill=None)
    cv.window(20, 126, 26, 137, style='warm', frame='darkwood:0', sill=None)
    cv.p(18, 138, col('yellow', 5))
    cv.p(21, 138, col('yellow', 5))
    cv.hline(9, 30, 143, col('concrete', 5))
    draw_sconce(cv, 7, 124)
    draw_sconce(cv, 31, 124)

    # Tall bistro display windows (center & right) + striped awnings
    cv.awning(34, 118, 59, 123, ramp_a='red', ramp_b='cream', stripe_w=3)
    cv.awning(63, 118, 88, 123, ramp_a='red', ramp_b='cream', stripe_w=3)
    cv.window(35, 123, 58, 140, style='warm', frame='darkwood:1', sill='stone:5', seed=242)
    # Candlelit bistro table silhouette inside center display
    cv.rect(41, 134, 52, 139, col('red', 2))
    cv.p(46, 132, col('yellow', 5))  # candle
    cv.window(64, 123, 87, 140, style='warm', frame='darkwood:1', sill='stone:5', seed=243)
    # Wine bottles silhouette in right window
    for wx, wc in [(68, 'green:3'), (71, 'red:3'), (74, 'green:4'), (79, 'amber'), (82, 'red:2')]:
        cv.rect(wx, 133, wx + 2, 139, col('orange', 4) if wc == 'amber' else C(wc))
    cv.planter_box(36, 138, 57, 143, flower='red:4', pot_ramp='wood')
    cv.planter_box(65, 138, 86, 143, flower='yellow:4', pot_ramp='wood')

    cv.edge_finish(top_y=10)
    return cv


# ---------------------------------------------------------------------------
# 3. mf-bldg-mid_glass_podium_office (112x144)
# ---------------------------------------------------------------------------
def build_mid_glass_podium_office():
    cv = Canvas(112, 144)
    # Rooftop parapet deck (y=6..28, x=2..110)
    cv.flat_roof(2, 6, 110, 28, deck_ramp='concrete', deck_i=3, para_ramp='coolwhite', seed=301)
    # Recessed glass-and-steel rooftop penthouse (left: x=8..35, y=2..22)
    cv.outline_box(8, 2, 35, 9, col('coolwhite', 4), col('steel', 1), top_hi=col('coolwhite', 5))
    cv.outline_box(8, 8, 35, 22, col('steel', 3), col('steel', 1))
    cv.window(11, 11, 24, 19, style='glass', frame='steel:1', sill=None)
    cv.door_glass(26, 11, 33, 21, frame='steel:1', warm=True)
    cv.hline(9, 36, 22, col('ink', 1))

    # Helipad deck center (x=40..68, y=9..23)
    cv.outline_box(40, 9, 68, 23, col('asphalt', 3), col('steel', 2), top_hi=col('concrete', 4))
    # Yellow helipad circle corners & crisp 'H'
    cv.hline(45, 63, 11, col('yellow', 4))
    cv.hline(45, 63, 20, col('yellow', 4))
    cv.vline(43, 12, 20, col('yellow', 4))
    cv.vline(64, 12, 20, col('yellow', 4))
    cv.vline(51, 13, 19, col('yellow', 5))
    cv.vline(56, 13, 19, col('yellow', 5))
    cv.hline(51, 57, 16, col('yellow', 5))

    # Louvered steel HVAC screen enclosing chillers (right: x=73..104, y=9..23)
    cv.outline_box(73, 9, 104, 23, col('steel', 2), col('steel', 0), top_hi=col('coolwhite', 4))
    for ly in range(11, 22, 2):
        cv.hline(75, 102, ly, col('steel', 4))
    cv.vline(88, 10, 22, col('steel', 1))
    # Subtle rooftop chiller fans peeking above louver
    cv.rect(77, 7, 85, 10, col('coolwhite', 4))
    cv.rect(91, 7, 100, 10, col('coolwhite', 3))
    cv.hline(74, 105, 23, col('ink', 1))

    # 2F-4F STRUCTURALLY DIFFERENTIATED CURTAIN WALL + VARIED SPANDRELS (y=28..104, x=2..110)
    cv.rect(2, 28, 110, 104, col('coolwhite', 3))

    # Spandrel 1 (Roof/4F crown, y=28..33): crisp coolwhite architectural fascia
    draw_panel_wall(cv, 2, 28, 110, 33, ramp='coolwhite', base_i=3, pw=14, ph=5, dimples=False, seed=328)
    cv.hline(2, 110, 28, col('coolwhite', 5))
    cv.hline(2, 110, 32, col('steel', 2))
    cv.hline(3, 109, 33, col('ink', 1))

    # Spandrel 2 (3F/4F transfer band, y=53..59): VARIED dark charcoal-steel architectural reveal band with teal trim!
    draw_panel_wall(cv, 2, 53, 110, 59, ramp='steel', base_i=2, pw=18, ph=6, dimples=False, seed=353)
    cv.hline(2, 110, 53, col('coolwhite', 4))
    cv.hline(3, 109, 55, col('steel', 1))
    cv.hline(6, 106, 56, col('teal', 4))  # crisp architectural accent reveal
    cv.hline(2, 110, 58, col('steel', 0))
    cv.hline(3, 109, 59, col('ink', 1))
    for fx in (23, 57, 74, 91):
        cv.vline(fx, 53, 59, col('steel', 4))

    # Spandrel 3 (2F/3F finned band, y=78..83): coolwhite panels with vertical aluminum rib fins
    draw_panel_wall(cv, 2, 78, 110, 83, ramp='coolwhite', base_i=4, pw=12, ph=5, dimples=False, seed=378)
    cv.hline(2, 110, 78, col('white', 6))
    for rx in range(8, 106, 10):
        cv.vline(rx, 79, 82, col('steel', 2))
        cv.vline(rx + 1, 79, 82, col('coolwhite', 5))
    cv.hline(2, 110, 82, col('steel', 1))
    cv.hline(3, 109, 83, col('ink', 1))

    # Spandrel 4 (1F/2F podium cornice, y=99..104): clean cantilevered coolwhite soffit beam
    draw_panel_wall(cv, 2, 99, 110, 104, ramp='coolwhite', base_i=3, pw=14, ph=5, dimples=False, seed=399)
    cv.hline(2, 110, 99, col('coolwhite', 5))
    cv.hline(2, 110, 103, col('steel', 1))
    cv.hline(3, 109, 104, col('ink', 1))

    # Outer structural aluminum pilasters across 2F-4F
    for fy0, fy1 in [(33, 53), (59, 78), (83, 99)]:
        cv.rect(2, fy0, 6, fy1, col('coolwhite', 4))
        cv.rect(106, fy0, 110, fy1, col('coolwhite', 2))
        cv.vline(2, fy0, fy1, col('steel', 1))
        cv.vline(109, fy0, fy1, col('steel', 0))

    def fill_glass_base(x0, y0, x1, y1, mode='teal'):
        for y in range(y0, y1):
            ry = y - y0
            for x in range(x0, x1):
                sky = ((x + y * 2) % 35) in (4, 5)
                if ry == 0:
                    cv.p(x, y, col('teal', 0) if mode == 'teal' else col('steel', 1))
                elif mode == 'warm_cream':
                    if ry <= 2:
                        cv.p(x, y, col('orange', 2))
                    elif sky and ry < 10:
                        cv.p(x, y, col('glass', 5))
                    else:
                        cv.p(x, y, col('cream', 5 if ry > 7 else 4))
                elif mode == 'warm_amber':
                    if ry <= 2:
                        cv.p(x, y, col('orange', 2))
                    elif sky and ry < 11:
                        cv.p(x, y, col('glass', 5))
                    else:
                        cv.p(x, y, col('yellow', 4 if ry > 6 else 5))
                elif mode == 'deep_glass':
                    cv.p(x, y, col('glass', 5 if sky else (2 if ry > 12 else 1)))
                else:  # 'teal'
                    cv.p(x, y, col('glass', 5) if sky else (col('teal', 3) if (x + y) % 5 == 0 else col('teal', 1)))

    # --- 4F (y=33..53): MERGED DOUBLE-WIDE EXECUTIVE CONFERENCE BAY (x=23..57) + ASYMMETRIC OFFICES ---
    # Bay 4-0 (x=6..23): Executive corner office with walnut bookcase & fiddle-leaf plant
    cv.vline(6, 33, 53, col('steel', 1))
    fill_glass_base(7, 33, 23, 53, 'warm_cream')
    cv.rect(8, 36, 13, 51, col('wood', 2))  # walnut bookcase
    for sy in (39, 43, 47):
        cv.hline(9, 12, sy, col('cedar', 4))
        cv.p(9, sy - 1, col('red', 4))
        cv.p(11, sy - 1, col('blue', 4))
    cv.foliage_cluster(18, 45, 3, 4, ramp='foliage', seed=341)
    cv.rect(17, 49, 20, 52, col('white', 5))
    cv.hline(14, 21, 36, col('yellow', 5))  # ceiling spot
    cv.hline(7, 23, 38, col('steel', 2))

    # Bay 4-1 MERGED DOUBLE-WIDE EXECUTIVE CONFERENCE BAY (x=23..57, 34px wide, NO center mullion!)
    cv.outline_box(23, 33, 57, 53, col('cream', 4), col('steel', 0))
    fill_glass_base(24, 34, 56, 52, 'warm_amber')
    # Acoustic cedar slat ceiling + linear executive LED
    cv.rect(24, 34, 56, 37, col('cedar', 4))
    for sx in range(26, 55, 4):
        cv.vline(sx, 34, 37, col('wood', 2))
    cv.hline(29, 51, 36, col('yellow', 5))
    # Wide mounted presentation display with live chart bars
    cv.outline_box(32, 38, 48, 45, col('navy', 1), col('kuro', 0))
    cv.rect(34, 42, 36, 44, col('teal', 4))
    cv.rect(37, 40, 39, 44, col('yellow', 5))
    cv.rect(40, 41, 42, 44, col('orange', 4))
    cv.rect(43, 39, 46, 44, col('glass', 6))
    # Executive walnut boardroom table + 4 chair backs + laptops
    for cx in (29, 36, 43, 50):
        cv.rect(cx, 45, cx + 3, 48, col('kuro', 1))
    cv.outline_box(26, 47, 54, 52, col('wood', 3), col('darkwood', 0), top_hi=col('cedar', 5))
    cv.rect(32, 46, 35, 48, col('coolwhite', 5))
    cv.rect(45, 46, 48, 48, col('coolwhite', 5))
    # Uninterrupted panoramic glass reflection streak across merged double bay
    for d in range(14):
        cv.p(25 + d, 36 + d, col('glass', 6))
        cv.p(26 + d, 36 + d, col('glass', 5))

    # Bay 4-2 (x=57..74): Cool architectural glass with vertical blinds & standing easel
    cv.vline(57, 33, 53, col('steel', 1))
    fill_glass_base(58, 33, 74, 53, 'teal')
    for bx in range(66, 74, 2):
        cv.vline(bx, 34, 51, col('coolwhite', 5))
        cv.vline(bx + 1, 34, 51, col('coolwhite', 3))
    cv.rect(59, 41, 65, 47, col('cream', 5))  # pinned plan board
    cv.vline(62, 47, 52, col('wood', 2))
    cv.hline(58, 74, 38, col('steel', 2))

    # Bay 4-3 (x=74..91): Executive lounge with crimson sofa, ring pendant & monstera
    cv.vline(74, 33, 53, col('steel', 1))
    fill_glass_base(75, 33, 91, 53, 'warm_cream')
    cv.rect(79, 36, 86, 38, col('yellow', 5))  # hanging ring light
    cv.rect(76, 46, 85, 51, col('brick', 3))   # lounge sofa
    cv.hline(76, 85, 46, col('brick', 5))
    cv.foliage_cluster(88, 46, 3, 4, ramp='foliage', seed=344)
    cv.hline(75, 91, 38, col('steel', 2))

    # Bay 4-4 (x=91..106): Corner glass stairwell core with ascending stairs & vertical cyan LED
    cv.vline(91, 33, 53, col('steel', 1))
    cv.vline(105, 33, 53, col('steel', 1))
    fill_glass_base(92, 33, 105, 53, 'deep_glass')
    cv.vline(93, 35, 51, col('glass', 6))  # vertical architectural LED
    for st in range(10):
        cv.rect(94 + st, 49 - st, 97 + st, 51 - st, col('coolwhite', 4))
        cv.p(94 + st, 48 - st, col('steel', 2))

    # --- 3F (y=59..78): HORIZONTAL SUN-SHADE LOUVERS (x=6..74) + RECESSED CORNER BALCONY (x=74..106) ---
    # Left-center 4 bays under projecting horizontal aluminum brise-soleil louvers
    for bx0, bx1, kind in [(6, 23, 'tech'), (23, 40, 'design'), (40, 57, 'brace'), (57, 74, 'pantry')]:
        cv.vline(bx0, 59, 78, col('steel', 1))
        ix0, ix1 = bx0 + 1, bx1
        if kind == 'tech':
            fill_glass_base(ix0, 59, ix1, 78, 'deep_glass')
            # Server rack with status LEDs + dual cyan monitors
            cv.rect(ix0 + 1, 64, ix0 + 4, 77, col('kuro', 1))
            cv.p(ix0 + 2, 66, col('teal', 5))
            cv.p(ix0 + 2, 69, col('red', 4))
            cv.p(ix0 + 2, 72, col('teal', 5))
            cv.rect(ix0 + 6, 70, ix0 + 10, 74, col('glass', 6))
            cv.rect(ix0 + 11, 70, ix0 + 15, 74, col('glass', 6))
            cv.rect(ix0 + 5, 74, ix1 - 1, 77, col('steel', 2))
        elif kind == 'design':
            fill_glass_base(ix0, 59, ix1, 78, 'warm_cream')
            # Creative studio pinned moodboard + drafting desk
            cv.rect(ix0 + 2, 65, ix0 + 6, 70, col('orange', 4))
            cv.rect(ix0 + 7, 65, ix0 + 11, 69, col('blue', 4))
            cv.rect(ix0 + 12, 66, ix0 + 15, 70, col('pink', 4))
            cv.rect(ix0 + 2, 73, ix1 - 2, 77, col('cedar', 4))
            cv.p(ix0 + 4, 71, col('yellow', 5))
        elif kind == 'brace':
            fill_glass_base(ix0, 59, ix1, 78, 'teal')
            # Diagonal structural steel X-brace behind tinted glass
            for i in range(14):
                px1 = ix0 + 1 + int(i * (ix1 - ix0 - 2) / 13.0)
                px2 = ix1 - 2 - int(i * (ix1 - ix0 - 2) / 13.0)
                cv.p(px1, 63 + i, col('steel', 4))
                cv.p(px2, 63 + i, col('steel', 3))
        else:  # 'pantry'
            fill_glass_base(ix0, 59, ix1, 78, 'warm_amber')
            cv.rect(ix0 + 2, 72, ix1 - 2, 77, col('wood', 3))
            cv.rect(ix0 + 3, 69, ix0 + 7, 72, col('steel', 4))  # espresso maker
            cv.hline(ix0 + 8, ix1 - 2, 68, col('wood', 2))      # mug shelf
            cv.p(ix0 + 9, 67, col('white', 6))
            cv.p(ix0 + 12, 67, col('red', 4))
            cv.p(ix0 + 5, 65, col('yellow', 5))
            cv.p(ix0 + 12, 65, col('yellow', 5))

    # Projecting horizontal aluminum brise-soleil sun-shade louvers across 3F left-center (x=6..74)
    cv.hline(6, 74, 60, col('coolwhite', 5))
    cv.hline(6, 74, 61, col('steel', 3))
    cv.hline(6, 74, 62, col('steel', 0))
    cv.shade_rect(7, 63, 74, 65, -1)  # cast louver shadow on upper glass
    # Secondary mid-height horizontal sun-fin across center two bays (x=23..57)
    cv.hline(23, 57, 68, col('coolwhite', 5))
    cv.hline(23, 57, 69, col('steel', 1))
    cv.shade_rect(24, 70, 57, 71, -1)

    # 3F RIGHT RECESSED CORNER SKY-BALCONY (x=74..106, y=59..78)
    cv.rect(74, 59, 76, 78, col('concrete', 3))
    cv.vline(74, 59, 78, col('steel', 1))
    # Recessed sliding glass back wall (y=60..70)
    fill_glass_base(76, 60, 94, 70, 'warm_amber')
    fill_glass_base(94, 60, 106, 70, 'deep_glass')
    cv.outline_box(76, 60, 94, 70, col('orange', 4), col('steel', 1))
    cv.rect(77, 61, 93, 69, col('yellow', 4))
    cv.vline(85, 61, 69, col('steel', 1))  # sliding glass door center stile
    for d in range(6):
        cv.p(79 + d, 62 + d, col('glass', 5))
    # Walkable 5px recessed oak wood balcony deck floor (y=70..75)
    for y in range(70, 75):
        for x in range(76, 106):
            if y == 70:
                cv.p(x, y, col('floorwood', 1))  # crisp north wall shadow
            elif y == 71:
                cv.p(x, y, col('floorwood', 2))
            elif x == 76:
                cv.p(x, y, col('floorwood', 2))  # left side wall shadow
            elif y == 73:
                cv.p(x, y, col('floorwood', 3))
            else:
                cv.p(x, y, col('floorwood', 5 if (x + y) % 3 else 4))
    # Outdoor lounge chairs + corner concrete shrub planter sitting on balcony deck
    cv.rect(80, 69, 84, 73, col('teal', 3))
    cv.hline(80, 84, 69, col('teal', 5))
    cv.rect(86, 71, 89, 73, col('white', 5))  # tiny patio table
    cv.rect(91, 69, 95, 73, col('teal', 3))
    cv.hline(91, 95, 69, col('teal', 5))
    cv.planter_box(96, 66, 105, 73, flower='yellow:4', pot_ramp='concrete')
    # Front tempered-glass balcony balustrade (y=73..78)
    draw_glass_rail(cv, 74, 73, 106, 78, post_step=10, floor_hint=col('floorwood', 3))

    # --- 2F (y=83..99): SHIFTED 5-BAY MEZZANINE RIBBON (ZERO VERBATIM TILE REPETITION!) ---
    m_edges = [6, 28, 48, 68, 88, 106]
    m_modes = ['corp_logo', 'reading_lounge', 'meeting_pod', 'blinds_work', 'cafe_mezz']
    for bi in range(5):
        x0, x1 = m_edges[bi], m_edges[bi + 1]
        mode = m_modes[bi]
        cv.vline(x0, 83, 99, col('steel', 1))
        if bi == 4:
            cv.vline(x1 - 1, 83, 99, col('steel', 1))
        ix0, ix1 = x0 + 1, x1 - (1 if bi == 4 else 0)
        if mode == 'corp_logo':
            fill_glass_base(ix0, 83, ix1, 99, 'teal')
            cv.rect(ix0 + 2, 86, ix0 + 15, 93, col('teal', 4))
            cv.hline(ix0 + 4, ix0 + 13, 88, col('white', 6))
            cv.hline(ix0 + 4, ix0 + 10, 90, col('yellow', 5))
            cv.rect(ix0 + 3, 95, ix1 - 3, 98, col('cedar', 4))
        elif mode == 'reading_lounge':
            fill_glass_base(ix0, 83, ix1, 99, 'warm_cream')
            cv.rect(ix0 + 2, 92, ix0 + 11, 98, col('wood', 3))
            for bx in range(ix0 + 3, ix0 + 10, 2):
                cv.p(bx, 93, col('red', 4) if bx % 4 == 0 else col('blue', 4))
            cv.vline(ix0 + 14, 88, 98, col('cha', 4))
            cv.rect(ix0 + 13, 86, ix0 + 16, 88, col('yellow', 5))  # floor lamp
        elif mode == 'meeting_pod':
            fill_glass_base(ix0, 83, ix1, 99, 'warm_amber')
            for ax in range(ix0 + 2, ix1 - 2, 4):
                cv.vline(ax, 84, 87, col('steel', 3))  # ceiling acoustic baffles
            cv.outline_box(ix0 + 4, 93, ix1 - 4, 98, col('cedar', 4), col('wood', 1))
        elif mode == 'blinds_work':
            fill_glass_base(ix0, 83, ix1, 99, 'deep_glass')
            for by in range(84, 91):
                cv.hline(ix0, ix1, by, col('cream', 5 if by % 2 == 0 else 3))
            cv.rect(ix0 + 3, 93, ix0 + 8, 96, col('glass', 6))   # monitor
            cv.rect(ix0 + 10, 93, ix0 + 14, 97, col('red', 3))   # accent chair
        else:  # 'cafe_mezz'
            fill_glass_base(ix0, 83, ix1, 99, 'warm_cream')
            for px in (ix0 + 4, ix0 + 10):
                cv.vline(px, 84, 88, col('darkwood', 1))
                cv.p(px, 88, col('yellow', 5))
            cv.foliage_cluster(ix1 - 4, 91, 3, 4, ramp='foliage', seed=389)
            cv.rect(ix0 + 2, 94, ix0 + 11, 98, col('wood', 2))
        cv.hline(ix0, ix1, 87, col('steel', 2))

    # 1F DOUBLE-HEIGHT GRANITE & GLASS LOBBY (y=104..144, x=2..110)
    # Dark granite piers & base
    cv.tile_cladding(2, 104, 110, 144, ramp='kuro', base_i=2, cw=8, ch=6, seed=320)
    # Polished vertical granite specular lines on structural piers
    for px in (4, 34, 77, 107):
        cv.vline(px, 106, 142, col('steel', 3))
    # Left & right tall lobby glass walls (x=9..33 and x=79..103, y=106..141)
    for gx0, gx1, side in [(9, 33, 'L'), (79, 103, 'R')]:
        cv.outline_box(gx0, 106, gx1, 141, col('glass', 2), col('steel', 1))
        for y in range(107, 140):
            for x in range(gx0 + 1, gx1 - 1):
                rx, ry = x - gx0, y - 106
                if ry < 14:
                    cv.p(x, y, col('glass', 4 if (rx + ry) % 9 in (2, 3) else 2))
                else:
                    cv.p(x, y, col('cream', 4 if ry > 22 else 3))
        # Recessed ceiling lights + indoor lobby trees + reception desk
        cv.hline(gx0 + 3, gx1 - 3, 110, col('yellow', 5))
        cv.vline((gx0 + gx1) // 2, 107, 140, col('steel', 2))
        if side == 'L':
            cv.foliage_cluster(gx0 + 7, 128, 4, 5, ramp='foliage', seed=330)
            cv.rect(gx0 + 5, 134, gx0 + 10, 139, col('white', 4))
            cv.rect(gx0 + 14, 131, gx1 - 2, 139, col('cedar', 4))  # lobby bench
        else:
            cv.rect(gx0 + 2, 130, gx0 + 15, 139, col('wood', 3))   # reception desk
            cv.rect(gx0 + 5, 127, gx0 + 10, 130, col('coolwhite', 5))
            cv.foliage_cluster(gx1 - 6, 127, 4, 5, ramp='foliage', seed=331)

    # Center double-height lobby atrium glass behind canopy (x=37..75, y=106..142)
    cv.outline_box(37, 106, 75, 142, col('cream', 4), col('steel', 1))
    # Upper double-height glass transom above canopy
    cv.window(38, 107, 74, 115, style='glass', frame='steel:2', sill=None)
    # Dramatic CANTILEVERED STEEL & GLASS ENTRANCE CANOPY (x=32..80, y=114..120)
    cv.outline_box(32, 114, 80, 118, col('steel', 4), col('steel', 0), top_hi=col('coolwhite', 5))
    cv.hline(34, 78, 118, col('steel', 1))
    cv.hline(34, 78, 119, col('ink', 0))
    # Canopy recessed downlights
    for lx in (40, 50, 62, 72):
        cv.rect(lx, 118, lx + 2, 119, col('yellow', 5))
    # Revolving / sliding glass entrance drum (x=44..68, y=120..142)
    cv.outline_box(44, 120, 68, 142, col('glass', 3), col('steel', 1), top_hi=col('coolwhite', 4))
    cv.rect(46, 122, 66, 141, col('yellow', 4))
    for rx in (49, 56, 63):
        cv.vline(rx, 121, 141, col('steel', 2))
    # Diagonal revolving-door glass blades
    for d in range(14):
        cv.p(46 + d, 124 + d, col('glass', 6))
        cv.p(65 - d, 124 + d, col('glass', 5))
    # Granite entry steps + modern concrete planters + steel bollards
    cv.hline(36, 76, 141, col('concrete', 5))
    cv.hline(35, 77, 142, col('concrete', 3))
    cv.hline(35, 77, 143, col('steel', 1))
    cv.planter_box(35, 134, 43, 142, flower='teal:4', pot_ramp='concrete')
    cv.planter_box(69, 134, 77, 142, flower='teal:4', pot_ramp='concrete')

    cv.edge_finish(top_y=6)
    return cv


# ---------------------------------------------------------------------------
# 4. mf-bldg-mid_corner_boutique_hotel (112x144)
# ---------------------------------------------------------------------------
def build_mid_corner_boutique_hotel():
    cv = Canvas(112, 144)
    # Main hotel volume x=2..100, leaving x=100..111 for protruding vertical "HOTEL" blade sign!
    # Mansard/parapet roof with rooftop lounge planters (y=3..30, x=2..100)
    # Steep mansard border framing recessed lounge deck
    cv.pitched_roof(2, 3, 100, 29, ramp='kawara', ridge_hi=True, moss_rate=0.0, seed=401)
    # Recessed rooftop wood lounge deck with continuous light stone parapet coping & dark north inner drop shadow
    cv.outline_box(9, 6, 93, 25, col('cream', 5), col('stone', 0))
    # Continuous light parapet coping edge around all 4 sides
    cv.hline(10, 92, 7, col('cream', 6))
    cv.vline(10, 7, 24, col('cream', 6))
    cv.vline(91, 7, 24, col('cream', 5))
    cv.hline(10, 92, 23, col('cream', 5))
    # Inner stone coping bevel framing the recessed wood deck
    cv.outline_box(11, 8, 91, 23, col('floorwood', 4), col('stone', 2))
    # Sunlit wood deck floorboards inside parapet (x=12..90, y=9..22)
    for y in range(9, 22):
        for x in range(12, 90):
            if (y - 9) % 3 == 2:
                cv.p(x, y, col('floorwood', 3))
            else:
                r = hsh(x // 5, y // 3, 402)
                cv.p(x, y, col('floorwood', 5 if r > 0.65 else 4))
    # Dark north & left inner parapet drop shadow onto the recessed wood deck
    cv.hline(12, 90, 9, col('floorwood', 0))
    cv.hline(12, 90, 10, col('floorwood', 1))
    cv.vline(12, 9, 22, col('floorwood', 1))
    cv.vline(13, 10, 22, col('floorwood', 2))
    # Rooftop lounge planters, lanterns & bistro tables sitting cleanly inside deck
    cv.planter_box(14, 9, 28, 16, flower='pink:4', pot_ramp='stone')
    cv.planter_box(74, 9, 88, 16, flower='red:4', pot_ramp='stone')
    draw_bistro_table(cv, 38, 20)
    draw_bistro_table(cv, 64, 20)
    for lx in (31, 51, 71):
        cv.vline(lx, 11, 17, col('kuro', 1))
        cv.rect(lx - 1, 10, lx + 2, 12, col('yellow', 5))
    # Ornate cream cornice under mansard (y=27..31)
    draw_cornice(cv, 1, 27, 101, ramp='cream', h=3, dentils=True)

    # 2F-4F Refined red-brick & cream quoin facade — ARCHITECTURALLY DIFFERENTIATED PER FLOOR! (x=2..100, y=31..105)
    cv.brick_wall(2, 31, 100, 105, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=403)
    draw_quoins(cv, 2, 31, 100, 105, ramp='cream', qw=4, qh=4)
    draw_cornice(cv, 2, 50, 100, ramp='cream', h=2)
    draw_cornice(cv, 2, 76, 100, ramp='cream', h=2)

    # --- 4F (y=31..50): COMPACT ATTIC DORMER-STYLE WINDOWS WITH PEDIMENTS & 2x2 MULLIONS ---
    attic_specs = [
        (13, 25, 'warm', 'red'),
        (35, 47, 'glass', 'white'),
        (57, 69, 'blinds', 'navy'),
        (79, 91, 'warm', 'cream'),
    ]
    for wx0, wx1, st, cur in attic_specs:
        mx = (wx0 + wx1) // 2
        # Compact triangular cream attic dormer pediment hood (y=32..35)
        cv.hline(wx0 - 1, wx1 + 1, 34, col('cream', 6))
        cv.hline(wx0 + 1, wx1 - 1, 33, col('cream', 6))
        cv.hline(mx - 2, mx + 2, 32, col('cream', 5))
        cv.hline(wx0 - 1, wx1 + 1, 35, col('stone', 1))
        # Smaller 12x12 attic window with crisp cream 2x2 dormer muntin cross
        cv.window(wx0, 35, wx1, 47, style=st, warm=(st == 'warm'), frame='darkwood:1',
                  sill='cream:5', curtain=cur, seed=wx0 + 400)
        cv.vline(mx, 36, 46, col('cream', 5))
        cv.hline(wx0 + 1, wx1 - 1, 41, col('cream', 5))

    # --- 3F (y=52..76): STONE SILLS, ALTERNATE STRIPED AWNINGS & ALTERNATE FLOWER BOXES ---
    floor3_specs = [
        (12, 26, 'warm', 'teal', True, False),    # awning bay
        (34, 48, 'blinds', 'white', False, True),  # flower-box bay
        (56, 70, 'warm', 'pink', True, False),     # awning bay
        (78, 92, 'glass', 'brick', False, True),   # flower-box bay
    ]
    for wx0, wx1, st, cur, has_awning, has_box in floor3_specs:
        cv.hline(wx0 - 1, wx1 + 1, 55, col('cream', 6))
        cv.hline(wx0 - 1, wx1 + 1, 56, col('stone', 2))
        cv.window(wx0, 56, wx1, 72, style=st, warm=(st == 'warm'), frame='darkwood:1',
                  sill='cream:6', curtain=cur, seed=wx0 + 300)
        # Carved projecting stone sill + corbel brackets
        cv.hline(wx0 - 1, wx1 + 1, 72, col('cream', 6))
        cv.hline(wx0 - 1, wx1 + 1, 73, col('stone', 3))
        cv.p(wx0, 74, col('stone', 2))
        cv.p(wx1 - 1, 74, col('stone', 2))
        if has_awning:
            cv.awning(wx0 - 1, 55, wx1 + 1, 60, ramp_a='red', ramp_b='cream', stripe_w=3)
            cv.hline(wx0 - 1, wx1 + 1, 59, col('yellow', 4))
        if has_box:
            cv.planter_box(wx0, 69, wx1, 74, flower=('pink:4' if wx0 < 60 else 'yellow:4'), pot_ramp='brick')

    # --- 2F (PIANO NOBILE, y=78..105): TALLER ARCHED WINDOWS + SHARED CENTRAL BALCONY ---
    def piano_left(c, ix0, iy0, ix1, iy1):
        c.vline((ix0 + ix1) // 2, iy0, iy0 + 3, col('darkwood', 0))
        c.rect((ix0 + ix1) // 2 - 2, iy0 + 3, (ix0 + ix1) // 2 + 2, iy0 + 5, col('yellow', 5))

    def piano_center_l(c, ix0, iy0, ix1, iy1):
        c.rect((ix0 + ix1) // 2 - 2, iy0 + 2, (ix0 + ix1) // 2 + 3, iy0 + 5, col('yellow', 5))
        c.rect(ix0 + 1, iy1 - 6, ix1 - 1, iy1 - 1, col('red', 2))

    def piano_center_r(c, ix0, iy0, ix1, iy1):
        c.hline(ix0 + 1, ix1 - 1, iy0 + 5, col('cream', 6))
        c.rect(ix0 + 2, iy1 - 5, ix1 - 2, iy1 - 1, col('wood', 3))

    # 4 tall closed-outline arched windows (23px tall, y=80..103)
    draw_closed_arched_window(cv, 11, 80, 26, 102, outline='darkwood:0', outer_trim='cream:6',
                              style='warm', curtain='cream', mullions=True, sill='cream:6',
                              interior_fn=piano_left, seed=430)
    draw_closed_arched_window(cv, 33, 80, 48, 102, outline='darkwood:0', outer_trim='cream:6',
                              style='warm', curtain='red', mullions=True, sill=None,
                              interior_fn=piano_center_l, seed=431)
    draw_closed_arched_window(cv, 54, 80, 69, 102, outline='darkwood:0', outer_trim='cream:6',
                              style='cream_bright', curtain='navy', mullions=True, sill=None,
                              interior_fn=piano_center_r, seed=432)
    draw_closed_arched_window(cv, 76, 80, 91, 102, outline='darkwood:0', outer_trim='cream:6',
                              style='glass', curtain='cream', mullions=True, sill='cream:6', seed=433)
    # Stone balustrade aprons under outer 2F arched windows + flanking brass sconces
    for ox0, ox1 in [(11, 26), (76, 91)]:
        cv.hline(ox0 - 1, ox1 + 1, 102, col('cream', 6))
        cv.hline(ox0, ox1, 103, col('stone', 3))
    draw_sconce(cv, 29, 89)
    draw_sconce(cv, 73, 89)

    # SHARED CENTRAL PIANO-NOBILE BALCONY spanning both middle arched bays (x=30..72, y=94..105)
    # Recessed walkable balcony floor (3px visible behind ornate rail)
    cv.hline(31, 71, 94, col('floorwood', 1))
    cv.hline(31, 71, 95, col('floorwood', 4))
    cv.hline(31, 71, 96, col('floorwood', 5))
    # Ornate wrought-iron central balcony balustrade with gold medallions & stone corner pedestals
    cv.hline(30, 72, 97, col('steel', 4))
    cv.hline(30, 72, 98, col('kuro', 0))
    for y in range(99, 103):
        for x in range(33, 69):
            rx = x - 33
            if rx % 3 == 0:
                cv.p(x, y, col('kuro', 1))
            elif y == 100 and rx % 6 == 1:
                cv.p(x, y, col('yellow', 4))
            else:
                cv.p(x, y, col('floorwood', 3 if y == 99 else 2))
    # Corner stone balustrade pedestals
    for px in (30, 69):
        cv.outline_box(px, 96, px + 3, 103, col('cream', 5), col('stone', 1), top_hi=col('white', 6))
    # Balcony stone slab & corbels
    cv.hline(29, 73, 103, col('cream', 6))
    cv.hline(30, 72, 104, col('stone', 3))
    for cx in (33, 45, 57, 68):
        cv.p(cx, 105, col('stone', 2))
    # Floral centerpiece accent on shared central balcony
    cv.planter_box(46, 94, 56, 99, flower='pink:4', pot_ramp='stone')

    # VERTICAL "HOTEL" BLADE SIGN on right corner (x=100..111, y=42..94)
    cv.hline(98, 102, 48, col('kuro', 0))
    cv.hline(98, 102, 86, col('kuro', 0))
    cv.outline_box(101, 42, 111, 94, col('navy', 1), col('kuro', 0), top_hi=col('yellow', 4), bot_sh=col('navy', 0))
    cv.outline_box(102, 43, 110, 93, col('navy', 2), col('yellow', 4))
    draw_pixel_text(cv, 104, 48, 'HOTEL', col('cream', 6), vertical=True, spacing=4)

    # 1F GRAND BOUTIQUE HOTEL LOBBY & DARK-BRONZE CANOPY (x=2..100, y=105..144)
    draw_ashlar_wall(cv, 2, 105, 100, 144, ramp='cream', base_i=4, course_h=5, block_w=10, seed=420)
    draw_cornice(cv, 2, 104, 100, ramp='stone', h=3, dentils=True)
    # Stone columns flanking lobby windows and grand entrance
    for colx in (5, 29, 71, 93):
        cv.outline_box(colx, 107, colx + 5, 143, col('cream', 5), col('stone', 2), top_hi=col('white', 6))
        cv.vline(colx + 2, 109, 141, col('cream', 3))
        cv.rect(colx - 1, 107, colx + 6, 110, col('cream', 6))  # capital
        cv.rect(colx - 1, 140, colx + 6, 143, col('stone', 4))  # plinth

    # Left & right tall arched lobby glass windows
    draw_arched_window(cv, 12, 110, 27, 139, frame='darkwood:0', trim='cream:6', style='warm',
                       curtain='red', mullions=True, sill='stone:5', seed=421)
    draw_arched_window(cv, 77, 110, 92, 139, frame='darkwood:0', trim='cream:6', style='warm',
                       curtain='red', mullions=True, sill='stone:5', seed=422)
    # Tiny golden chandeliers inside lobby windows
    for lx in (19, 84):
        cv.rect(lx - 1, 116, lx + 2, 118, col('yellow', 5))

    # Grand center entrance (x=34..71)
    cv.rect(35, 112, 70, 143, col('darkwood', 1))
    # Dark-bronze canopy (x=31..74, y=111..119) with warm gold pinstripe & shadow
    cv.outline_box(31, 111, 74, 118, col('darkwood', 2), col('darkwood', 0), top_hi=col('cha', 5))
    cv.hline(32, 73, 115, col('yellow', 4))  # gold trim line
    cv.hline(32, 73, 118, col('ink', 0))
    cv.hline(33, 72, 119, col('ink', 1))
    # Warm brass sconces flanking the grand entrance
    draw_sconce(cv, 36, 124)
    draw_sconce(cv, 68, 124)
    # Tall brass-and-glass double hotel doors (x=42..63, y=120..142)
    cv.outline_box(42, 120, 63, 142, col('cha', 4), col('darkwood', 0), top_hi=col('yellow', 4))
    cv.door_glass(44, 122, 61, 141, frame='cha:2', warm=True)
    # Red velvet carpet runner + stone threshold steps + topiary urns
    cv.hline(36, 69, 142, col('cream', 5))
    cv.hline(35, 70, 143, col('stone', 3))
    cv.rect(47, 141, 58, 144, col('red', 3))
    cv.vline(47, 141, 144, col('yellow', 4))
    cv.vline(57, 141, 144, col('yellow', 4))
    draw_potted_topiary(cv, 37, 143, pot_ramp='darkwood', flower=col('cream', 5))
    draw_potted_topiary(cv, 68, 143, pot_ramp='darkwood', flower=col('cream', 5))

    cv.edge_finish(top_y=3)
    return cv


# ---------------------------------------------------------------------------
# 5. mf-bldg-mid_art_gallery_skylight (112x112)
# ---------------------------------------------------------------------------
def build_mid_art_gallery_skylight():
    cv = Canvas(112, 112)
    # Crisp flat parapet roof with SAWTOOTH GLASS SKYLIGHTS (y=4..27, x=2..110)
    cv.flat_roof(2, 10, 110, 27, deck_ramp='coolwhite', deck_i=2, para_ramp='white', seed=501)
    # 4 architectural sawtooth skylight bays rising cleanly above the roof parapet (y=4..22)
    for sx in range(8, 100, 24):
        sw = 22
        # Vertical/steep cyan glass north face (left side of sawtooth) + sunlit concrete slope (right)
        for ry in range(17):
            y = 4 + ry
            # Crisp angled roof ridge silhouette with clean dark outline on slope edge
            max_rx = (ry * 3 + 3) if ry < 6 else (sw - 1)
            for rx in range(min(sw, max_rx + 1)):
                x = sx + rx
                if rx == 0 or ry == 16 or (ry < 6 and rx == max_rx) or rx == sw - 1 or ry == 0:
                    cv.p(x, y, col('steel', 1))
                elif rx < 13:
                    # Bright cyan-blue glass skylight pane with mullions
                    if rx in (4, 8, 12):
                        cv.p(x, y, col('steel', 2))
                    elif (rx + ry) % 6 in (1, 2):
                        cv.p(x, y, col('glass', 6))
                    else:
                        cv.p(x, y, col('glass', 4 if ry < 8 else 3))
                else:
                    # Sunlit crisp white concrete back slope of sawtooth
                    cv.p(x, y, col('white', 6 if rx == 13 else (5 if ry < 10 else 4)))
        cv.hline(sx + 1, sx + sw, 21, col('ink', 1))

    # 2F-3F CRISP WHITE ARCHITECTURAL CONCRETE PANELS (y=27..77, x=2..110)
    draw_panel_wall(cv, 2, 27, 110, 77, ramp='white', base_i=4, pw=12, ph=10, dimples=True, seed=502)
    cv.hline(2, 110, 27, col('white', 6))
    cv.hline(2, 110, 28, col('coolwhite', 2))
    cv.vline(2, 27, 77, col('coolwhite', 1))
    cv.vline(109, 27, 77, col('coolwhite', 0))

    # DRAMATIC ASYMMETRIC DOUBLE-HEIGHT GLASS ATRIUM BAY (x=8..68, y=31..75)
    cv.outline_box(8, 31, 68, 75, col('cream', 5), col('kuro', 1))
    # Interior warm-lit museum gallery walls visible through the glass atrium
    # 3F gallery upper level (y=32..52)
    cv.rect(9, 32, 67, 52, col('cream', 5))
    cv.hline(9, 67, 32, col('steel', 2))
    cv.hline(9, 67, 33, col('yellow', 5))  # track lighting wash
    # Framed Artwork #1 (bold red/orange abstract canvas)
    cv.outline_box(13, 36, 25, 48, col('red', 4), col('kuro', 0))
    cv.rect(15, 38, 21, 44, col('orange', 5))
    cv.rect(18, 41, 23, 46, col('yellow', 5))
    # Framed Artwork #2 (cool teal/blue modernist seascape)
    cv.outline_box(29, 37, 43, 47, col('blue', 4), col('kuro', 0))
    cv.rect(31, 41, 41, 45, col('teal', 4))
    cv.p(38, 39, col('cream', 6))
    # Sculpture on white pedestal (right side of 3F atrium)
    cv.rect(52, 44, 59, 51, col('white', 5))
    cv.rect(54, 38, 57, 44, col('yellow', 4))
    cv.p(55, 37, col('orange', 4))

    # Floor slab separating 3F & 2F inside atrium (y=52..55)
    cv.rect(9, 52, 67, 55, col('coolwhite', 3))
    cv.hline(9, 67, 52, col('steel', 1))
    cv.hline(9, 67, 54, col('steel', 2))

    # 2F gallery lower level (y=55..74)
    cv.rect(9, 55, 67, 74, col('kinari', 4))
    cv.hline(9, 67, 55, col('yellow', 4))
    # Triptych framed artworks on 2F wall
    cv.outline_box(12, 58, 20, 69, col('navy', 3), col('kuro', 0))
    cv.rect(14, 60, 18, 65, col('yellow', 4))
    cv.outline_box(22, 58, 30, 69, col('red', 3), col('kuro', 0))
    cv.rect(24, 61, 28, 67, col('cream', 6))
    cv.outline_box(32, 58, 40, 69, col('teal', 3), col('kuro', 0))
    cv.rect(34, 60, 38, 66, col('orange', 4))
    # Floating architectural staircase descending inside right bay of atrium
    for st in range(12):
        cv.rect(45 + st, 58 + st, 51 + st, 60 + st, col('wood', 4))
        cv.p(45 + st, 56 + st, col('steel', 2))

    # Crisp exterior dark-steel atrium mullions + subtle diagonal glass reflection overlay
    for mx in (27, 46):
        cv.vline(mx, 31, 75, col('kuro', 1))
    for y in range(32, 74):
        for x in range(9, 67):
            if ((x + y) % 23) in (4, 5) and y % 2 == 0:
                cv.p(x, y, col('glass', 5))

    # BOLD RED & NAVY VERTICAL EXHIBITION BANNER on right concrete wall (x=76..93, y=32..73)
    cv.shade_rect(78, 34, 95, 75, -1)  # crisp drop shadow on white concrete
    cv.hline(75, 94, 32, col('steel', 1))  # top mounting bar
    cv.hline(75, 94, 73, col('steel', 1))  # bottom tension bar
    cv.outline_box(76, 33, 93, 73, col('red', 3), col('navy', 0), top_hi=col('red', 4))
    # Lower half bold navy field
    cv.rect(77, 53, 92, 72, col('navy', 2))
    # Modernist graphic exhibition motif (white circle + gold diagonal + crisp bars)
    for dy in range(-4, 5):
        for dx in range(-4, 5):
            if dx * dx + dy * dy <= 16:
                cv.p(84 + dx, 43 + dy, col('white', 6) if dx + dy < 2 else col('cream', 5))
    cv.rect(79, 57, 90, 59, col('yellow', 5))
    cv.rect(79, 62, 87, 64, col('white', 5))
    cv.rect(79, 67, 89, 69, col('red', 4))

    # Narrow architectural stairwell slit window on far right (x=99..105, y=34..71)
    cv.window(99, 34, 106, 71, style='glass', frame='kuro:1', sill='coolwhite:4', seed=509)

    # 1F GALLERY ENTRY PLAZA & GLASS LOBBY (y=77..112, x=2..110)
    draw_panel_wall(cv, 2, 77, 110, 112, ramp='white', base_i=3, pw=12, ph=10, dimples=False, seed=510)
    cv.hline(2, 110, 77, col('steel', 2))
    cv.hline(2, 110, 78, col('ink', 1))
    # Recessed full-height glass lobby (x=8..68, y=81..111)
    cv.outline_box(8, 81, 68, 111, col('cream', 4), col('kuro', 1))
    for y in range(82, 110):
        for x in range(9, 67):
            rx, ry = x - 9, y - 82
            if ry < 8:
                cv.p(x, y, col('glass', 4 if (rx + ry) % 8 in (1, 2) else 2))
            else:
                cv.p(x, y, col('cream', 5 if ry > 15 else 4))
    # Ticket counter & museum shop inside lobby
    cv.rect(11, 100, 24, 109, col('white', 5))
    cv.hline(11, 24, 100, col('wood', 4))
    cv.rect(52, 96, 64, 109, col('wood', 3))  # art-book shelf
    for sx in range(54, 63, 2):
        cv.p(sx, 98, col('red', 4))
        cv.p(sx, 102, col('blue', 4))
    # Frameless glass entrance doors (x=28..48, y=86..111)
    cv.door_glass(28, 86, 48, 111, frame='kuro:1', warm=True)
    cv.hline(7, 69, 111, col('concrete', 5))

    # Right plaza wall: museum title plaque + bold red outdoor abstract sculpture + grass trough
    cv.outline_box(72, 83, 106, 91, col('navy', 1), col('kuro', 0), top_hi=col('navy', 3))
    draw_pixel_text(cv, 76, 85, 'GALLERY', col('white', 6), spacing=1)
    # Outdoor abstract red steel sculpture on concrete plinth
    cv.outline_box(80, 104, 95, 111, col('concrete', 5), col('steel', 2), top_hi=col('white', 6))
    cv.rect(84, 95, 91, 104, col('red', 3))
    cv.rect(86, 97, 89, 101, col('white', 5))  # negative-space cutout
    cv.rect(88, 93, 93, 98, col('red', 4))
    cv.planter_box(97, 103, 108, 111, flower='yellow:4', pot_ramp='concrete')

    cv.edge_finish(top_y=4)
    return cv


# ---------------------------------------------------------------------------
# 6. mf-bldg-mid_coworking_balcony (112x128)
# ---------------------------------------------------------------------------
def build_mid_coworking_balcony():
    cv = Canvas(112, 128)
    # Flat parapet roof with CEDAR PERGOLA (left) & SOLAR ARRAY (right) (y=3..28, x=2..110)
    cv.flat_roof(2, 6, 110, 28, deck_ramp='concrete', deck_i=3, para_ramp='concrete', seed=601)

    # Left half: Rooftop cedar pergola (x=8..58, y=3..23)
    # Cast striped beam shadows onto roof deck
    for sx in range(12, 55, 6):
        cv.shade_rect(sx, 12, sx + 2, 23, -1)
    # Pergola corner posts
    for px in (9, 55):
        cv.vline(px, 6, 23, col('wood', 1))
        cv.vline(px + 1, 6, 23, col('cedar', 4))
    # Tiny rooftop lounge table under pergola
    draw_bistro_table(cv, 32, 22)
    # Slatted cedar pergola roof rafters (y=3..9)
    cv.hline(8, 58, 3, col('wood', 1))
    cv.hline(8, 58, 4, col('cedar', 5))
    cv.hline(8, 58, 8, col('wood', 1))
    cv.hline(8, 58, 7, col('cedar', 4))
    for rx in range(10, 56, 5):
        cv.rect(rx, 4, rx + 3, 8, col('cedar', 5))
        cv.vline(rx + 2, 4, 8, col('wood', 2))
    # Climbing greenery along left pergola post
    cv.foliage_cluster(11, 10, 4, 4, ramp='foliage', seed=602)

    # Right half: Tilted Solar Panel Array (2 rows x 3 panels, x=63..104, y=7..23)
    for py0 in (8, 16):
        for px0 in (63, 77, 91):
            cv.outline_box(px0, py0, px0 + 12, py0 + 6, col('navy', 2), col('steel', 1), top_hi=col('blue', 4))
            cv.vline(px0 + 4, py0 + 1, py0 + 5, col('blue', 3))
            cv.vline(px0 + 8, py0 + 1, py0 + 5, col('blue', 3))
            cv.hline(px0 + 1, px0 + 11, py0 + 3, col('navy', 1))
            cv.p(px0 + 2, py0 + 2, col('coolwhite', 5))  # crisp solar glint
            cv.hline(px0 + 1, px0 + 12, py0 + 6, col('ink', 1))

    # 3F WARM BACKLIT STUDIO WINDOWS & TIMBER SLAT CLADDING (y=28..57, x=2..110)
    cv.siding_wall(2, 28, 110, 57, ramp='cedar', base_i=4, horizontal=False, step=3, seed=603)
    draw_cornice(cv, 2, 28, 110, ramp='steel', h=2)
    # 3 distinct studio window bands across 3F
    # Left studio: warm backlit creative desks & glowing pendants
    cv.window(8, 33, 44, 52, style='warm', frame='darkwood:1', sill='wood:2', seed=610)
    for px in (15, 26, 36):
        cv.vline(px, 34, 38, col('darkwood', 1))
        cv.rect(px - 1, 38, px + 2, 40, col('yellow', 5))
    cv.rect(12, 46, 40, 50, col('wood', 2))  # long studio worktable
    # Center studio: cool glass with blinds & tall studio plant
    cv.window(49, 33, 74, 52, style='blinds', frame='darkwood:1', sill='wood:2', seed=611)
    cv.foliage_cluster(68, 46, 3, 4, ramp='foliage', seed=612)
    # Right studio: warm golden workshop glow with shelving
    cv.window(79, 33, 104, 52, style='warm', frame='darkwood:1', sill='wood:2', curtain='teal', seed=613)
    cv.hline(82, 101, 41, col('wood', 2))
    cv.hline(82, 101, 46, col('wood', 2))

    # 2F FULL-WIDTH DEEP WOODEN DECK BALCONY (y=57..93, x=2..110)
    # Concrete slab edge dividing 3F and 2F
    draw_cornice(cv, 2, 56, 110, ramp='concrete', h=3)
    # Recessed back studio wall behind the deep balcony (y=59..74, x=2..110)
    cv.rect(2, 59, 110, 74, col('concrete', 4))
    cv.vline(2, 59, 93, col('steel', 1))
    cv.vline(109, 59, 93, col('steel', 0))
    # Back studio openings: folding open door left, big glass studio center, teal-lit lounge right
    cv.door_glass(8, 60, 31, 74, frame='darkwood:1', warm=True)
    cv.window(36, 60, 72, 73, style='glass', frame='steel:1', sill=None, seed=620)
    cv.rect(43, 66, 65, 71, col('yellow', 4))  # backlit studio whiteboard/desk
    cv.window(77, 60, 103, 73, style='warm', frame='darkwood:1', sill=None, curtain='orange', seed=621)

    # Recessed walkable oak wood floor strip (y=74..85 -> 6px+ clearly visible behind rail & planters!)
    for y in range(74, 85):
        ry = y - 74
        for x in range(2, 110):
            if x in (2, 3):
                cv.p(x, y, col('steel', 1 if x == 2 else 4))
            elif x in (108, 109):
                cv.p(x, y, col('steel', 3 if x == 108 else 0))
            elif ry == 0:
                cv.p(x, y, col('floorwood', 1))  # crisp north wall drop shadow
            elif ry == 1:
                cv.p(x, y, col('floorwood', 2))
            elif x == 4:
                cv.p(x, y, col('floorwood', 2))  # left side return shadow
            elif ry % 3 == 2:
                cv.p(x, y, col('floorwood', 3))  # plank seam
            else:
                r = hsh(x // 6, ry // 3, 622)
                cv.p(x, y, col('floorwood', 5 if (ry % 3 == 0 and r > 0.35) else 4))

    # Compact wooden stools & café bench tucked neatly along inner rail (keeping y=74..80 clear walkable deck!)
    for sx in (18, 26, 84, 92):
        cv.rect(sx - 2, 81, sx + 2, 83, col('cedar', 5))
        cv.hline(sx - 2, sx + 2, 83, col('darkwood', 1))
        cv.vline(sx - 1, 83, 85, col('darkwood', 1))
        cv.vline(sx + 1, 83, 85, col('darkwood', 1))
    cv.outline_box(48, 80, 64, 84, col('cedar', 4), col('darkwood', 1), top_hi=col('cedar', 5))  # terrace bench
    # Planters seated cleanly on the front edge of the wood deck
    for hx in (7, 36, 68, 99):
        cv.planter_box(hx, 80, hx + 8, 85, flower='yellow:4', pot_ramp='wood')

    # Contrasting tempered-glass & steel balcony balustrade with warm cedar top rail (y=84..93)
    draw_glass_rail(cv, 2, 84, 110, 93, post_step=13, floor_hint=col('floorwood', 3))
    cv.hline(2, 110, 84, col('cedar', 5))
    cv.hline(2, 110, 85, col('darkwood', 1))
    # Trailing ivy vines draping naturally over the front glass rail
    for hx in (7, 36, 68, 99):
        for vx in range(hx + 1, hx + 7, 2):
            vlen = 4 + int(hsh(vx, hx, 625) * 4)
            for vy in range(85, 85 + vlen):
                cv.p(vx, vy, col('foliage', 4 if vy % 2 == 0 else 2))

    # 1F OPEN CAFE-LOBBY + CRISP DOUBLE GLASS ENTRANCE DOOR BELOW 'STUDIO' (y=93..128, x=2..110)
    draw_panel_wall(cv, 2, 93, 110, 128, ramp='concrete', base_i=4, pw=14, ph=11, dimples=False, seed=630)
    cv.hline(2, 110, 93, col('wood', 1))
    cv.hline(2, 110, 94, col('ink', 1))
    # Open folding glass cafe-lobby showcase (x=7..64, y=98..126)
    cv.outline_box(7, 98, 64, 127, col('wood', 2), col('darkwood', 0), top_hi=col('cedar', 5))
    cv.rect(9, 100, 62, 125, col('orange', 3))
    cv.rect(9, 100, 62, 106, col('wood', 2))  # wood ceiling soffit
    cv.rect(9, 106, 62, 121, col('yellow', 4))
    cv.rect(9, 121, 62, 126, col('floorwood', 4))
    for lx in (17, 30, 44, 56):
        cv.vline(lx, 101, 106, col('darkwood', 0))
        cv.rect(lx - 1, 106, lx + 2, 108, col('yellow', 5))
    # Cafe bar counter left + communal coworking table center-right
    cv.outline_box(11, 116, 31, 125, col('cedar', 4), col('wood', 1), top_hi=col('cream', 5))
    cv.rect(14, 112, 21, 116, col('steel', 4))  # coffee machine
    cv.outline_box(35, 117, 55, 124, col('wood', 4), col('wood', 1), top_hi=col('cedar', 5))
    cv.rect(38, 114, 42, 117, col('coolwhite', 5))  # laptop on table
    cv.rect(47, 114, 51, 117, col('coolwhite', 5))
    # Folded accordion glass door leaves stacked at left & right jambs
    for fx in (9, 12, 56, 59):
        cv.outline_box(fx, 100, fx + 3, 125, col('glass', 4), col('darkwood', 1))

    # Relocated commuter bike & warm sconce on pier between showcase and entrance (x=65..78)
    draw_sconce(cv, 74, 107)
    cv.rect(66, 123, 69, 126, col('kuro', 0))
    cv.rect(73, 123, 76, 126, col('kuro', 0))
    cv.hline(67, 75, 122, col('teal', 4))
    cv.vline(73, 119, 124, col('steel', 4))

    # Right entrance bay directly below 'STUDIO' sign (x=78..106)
    cv.outline_box(78, 96, 106, 103, col('teal', 1), col('darkwood', 0), top_hi=col('teal', 3))
    draw_pixel_text(cv, 81, 97, 'STUDIO', col('cream', 6), spacing=1)

    # CRISP DOUBLE GLASS ENTRANCE DOOR OPENING FLUSH ONTO STREET BASELINE (y=127), NO BOTTOM SILL BAR!
    # Outer darkwood jambs (left, right, top only)
    cv.rect(80, 104, 82, 127, col('darkwood', 1))
    cv.vline(80, 104, 127, col('darkwood', 0))
    cv.rect(102, 104, 104, 127, col('darkwood', 1))
    cv.vline(103, 104, 127, col('darkwood', 0))
    cv.hline(80, 104, 104, col('darkwood', 0))
    cv.hline(81, 103, 105, col('cedar', 5))
    # Glowing upper transom
    cv.rect(82, 106, 102, 109, col('yellow', 5))
    cv.hline(82, 102, 109, col('darkwood', 1))
    # Twin full-height glass entrance door leaves (left x=82..91, right x=93..102, y=110..126)
    for lx0, lx1 in [(82, 91), (93, 102)]:
        for y in range(110, 126):
            for x in range(lx0, lx1):
                if y >= 122:
                    cv.p(x, y, col('floorwood', 5 if y == 122 else 4))  # visible warm indoor floor
                elif y <= 112:
                    cv.p(x, y, col('orange', 3))
                elif (x - lx0 + y - 110) in (3, 4, 9):
                    cv.p(x, y, col('glass', 6))  # crisp glass reflection
                else:
                    cv.p(x, y, col('yellow', 4 if y > 116 else 5))
    # Center vertical door meeting stiles + brushed steel vertical handles
    cv.vline(91, 110, 126, col('darkwood', 1))
    cv.vline(92, 110, 126, col('steel', 3))
    cv.vline(89, 115, 120, col('coolwhite', 5))
    cv.vline(90, 115, 120, col('steel', 1))
    cv.vline(94, 115, 120, col('coolwhite', 5))
    cv.vline(95, 115, 120, col('steel', 1))
    # Flush sunlit concrete street threshold step at y=126..127 (open onto street baseline!)
    cv.hline(80, 104, 126, col('concrete', 6))
    cv.hline(80, 104, 127, col('concrete', 6))

    cv.edge_finish(top_y=3)
    return cv


# ---------------------------------------------------------------------------
# 7. mf-bldg-mid_jazz_rooftop_lounge (96x128)
# ---------------------------------------------------------------------------
def build_mid_jazz_rooftop_lounge():
    cv = Canvas(96, 128)
    # Main moody club volume x=2..85, leaving x=85..95 for neon trumpet/note blade sign!
    # OPEN-AIR 3F ROOFTOP TERRACE BAR (y=4..42, x=2..85)
    # Recessed back & side dark slate parapet walls
    cv.brick_wall(2, 10, 85, 42, ramp='kuro', base_i=2, course_h=3, brick_w=6, seed=701)
    cv.hline(2, 85, 10, col('stone', 4))
    cv.hline(2, 85, 11, col('kuro', 0))
    # Open-air lounge terrace floor inside parapet (x=6..81, y=22..36)
    cv.stipple_rect(6, 22, 81, 36, 'floorwood', 2, 1, 3, seed=702, rate=0.22)
    cv.hline(6, 81, 22, col('darkwood', 0))
    # Back-bar warm glowing liquor shelves & bar counter (left-center: x=9..48, y=12..32)
    cv.outline_box(10, 13, 46, 23, col('orange', 2), col('darkwood', 0), top_hi=col('yellow', 4))
    for sy in (16, 20):
        cv.hline(12, 44, sy, col('darkwood', 1))
        for bx in range(13, 43, 3):
            bc = [col('red', 4), col('teal', 4), col('yellow', 5), col('green', 4)][(bx + sy) % 4]
            cv.vline(bx, sy - 2, sy, bc)
    # Rooftop wooden bar counter & 4 bar stools
    cv.outline_box(10, 25, 47, 32, col('wood', 3), col('darkwood', 0), top_hi=col('cedar', 5))
    for stx in (15, 24, 33, 42):
        cv.rect(stx - 1, 31, stx + 2, 34, col('red', 3))
        cv.vline(stx, 34, 36, col('steel', 2))
    # Right side candlelit velvet rooftop lounge & palm planter
    cv.outline_box(55, 17, 77, 25, col('red', 1), col('kuro', 0), top_hi=col('red', 3))  # velvet booth
    cv.outline_box(60, 26, 72, 32, col('wood', 3), col('darkwood', 0), top_hi=col('cedar', 4))
    cv.p(66, 27, col('yellow', 5))  # glowing table candle
    cv.foliage_cluster(77, 17, 4, 5, ramp='foliage', seed=703)
    cv.foliage_cluster(9, 17, 3, 4, ramp='foliage', seed=704)

    # Dark parapet front wall of rooftop lounge (y=35..42)
    cv.hline(2, 85, 35, col('stone', 5))
    cv.hline(2, 85, 36, col('stone', 3))
    cv.brick_wall(2, 37, 85, 42, ramp='kuro', base_i=2, course_h=3, brick_w=6, seed=705)
    draw_cornice(cv, 1, 41, 86, ramp='stone', h=3, dentils=True)

    # Slender iron string-light poles & glowing festoon catenary string lights overhead (y=4..16)!
    for px in (5, 43, 81):
        cv.vline(px, 4, 24, col('kuro', 1))
        cv.p(px, 4, col('steel', 4))
    for seg_x0, seg_x1 in [(5, 43), (43, 81)]:
        span = seg_x1 - seg_x0
        for x in range(seg_x0, seg_x1 + 1):
            t = (x - seg_x0) / span
            sag = int(round(6.0 * (4.0 * t * (1.0 - t))))
            y = 5 + sag
            cv.p(x, y, col('kuro', 0))
            if (x - seg_x0) % 6 == 3:
                # Warm glowing festoon Edison bulb
                cv.p(x, y + 1, col('yellow', 5))
                cv.p(x, y + 2, col('orange', 4))
                cv.p(x - 1, y + 1, col('orange', 3))
                cv.p(x + 1, y + 1, col('orange', 3))

    # 2F MOODY SLATE-BRICK JAZZ HALL WITH TALL ARCHED WARM-AMBER WINDOWS (y=44..85, x=2..85)
    cv.brick_wall(2, 44, 85, 85, ramp='kawara', base_i=3, course_h=3, brick_w=6, seed=710)
    # Subtle slate brick variation
    for sx, sy in [(6, 50), (34, 68), (58, 52), (18, 76)]:
        cv.shade_rect(sx, sy, sx + 8, sy + 5, -1)
    cv.vline(2, 44, 85, col('kuro', 1))
    cv.vline(84, 44, 85, col('kuro', 0))

    # 3 Tall arched warm-amber jazz hall windows (unique interior mood each!)
    def jazz_stage_interior(c, ix0, iy0, ix1, iy1):
        # Spotlight cone + velvet stage drape
        for y in range(iy0, iy1):
            c.p(ix0, y, col('red', 2))
            c.p(ix0 + 1, y, col('red', 3))
        c.rect(ix0 + 5, iy1 - 7, ix0 + 8, iy1 - 1, col('darkwood', 0))  # mic/bass silhouette
        c.p(ix0 + 7, iy0 + 3, col('yellow', 5))

    def jazz_band_interior(c, ix0, iy0, ix1, iy1):
        # Hanging golden brass chandelier + upright piano silhouette
        c.vline((ix0 + ix1) // 2, iy0, iy0 + 4, col('darkwood', 0))
        c.rect((ix0 + ix1) // 2 - 2, iy0 + 4, (ix0 + ix1) // 2 + 3, iy0 + 6, col('yellow', 5))
        c.rect(ix0 + 3, iy1 - 6, ix1 - 3, iy1 - 1, col('darkwood', 1))
        c.hline(ix0 + 4, ix1 - 4, iy1 - 4, col('cream', 5))  # piano keys hint

    def jazz_lounge_interior(c, ix0, iy0, ix1, iy1):
        # Warm pendant + curved cocktail booth
        c.vline(ix0 + 4, iy0, iy0 + 5, col('darkwood', 0))
        c.p(ix0 + 4, iy0 + 5, col('yellow', 5))
        c.rect(ix0 + 2, iy1 - 5, ix1 - 2, iy1 - 1, col('red', 1))

    draw_arched_window(cv, 8, 49, 28, 79, frame='kuro:0', trim='stone:4', style='warm',
                       mullions=True, sill='stone:4', interior_fn=jazz_stage_interior, seed=711)
    draw_arched_window(cv, 34, 49, 54, 79, frame='kuro:0', trim='stone:4', style='warm',
                       mullions=True, sill='stone:4', interior_fn=jazz_band_interior, seed=712)
    draw_arched_window(cv, 60, 49, 80, 79, frame='kuro:0', trim='stone:4', style='amber_moody',
                       mullions=True, sill='stone:4', interior_fn=jazz_lounge_interior, seed=713)
    for bx0, bx1 in [(8, 28), (34, 54), (60, 80)]:
        draw_juliet_balcony(cv, bx0, 73, bx1, 79, iron='kuro:0', hi='steel:3')

    # NEON TRUMPET / MUSIC-NOTE BLADE SIGN (x=85..95, y=52..96)
    cv.hline(83, 87, 58, col('kuro', 0))
    cv.hline(83, 87, 90, col('kuro', 0))
    cv.outline_box(86, 52, 95, 96, col('navy', 0), col('kuro', 0), top_hi=col('teal', 4), bot_sh=col('pink', 3))
    # Glowing neon music eighth-note (top half: pink/teal glow)
    cv.hline(89, 94, 57, col('pink', 5))
    cv.hline(89, 94, 58, col('pink', 4))
    cv.vline(92, 58, 67, col('pink', 5))
    cv.rect(88, 65, 93, 68, col('pink', 5))
    cv.p(89, 66, col('white', 6))
    # Glowing neon brass trumpet icon (lower half: angled bell + valves in orange/yellow)
    cv.hline(88, 93, 71, col('teal', 4))
    cv.vline(90, 74, 86, col('yellow', 5))
    cv.vline(91, 76, 84, col('orange', 4))  # trumpet valves
    cv.p(92, 78, col('yellow', 5))
    cv.p(92, 81, col('yellow', 5))
    cv.rect(89, 73, 92, 75, col('orange', 5))  # mouthpiece
    cv.rect(88, 86, 93, 89, col('yellow', 5))  # flared trumpet bell
    cv.hline(87, 94, 89, col('orange', 5))
    cv.hline(88, 93, 92, col('teal', 4))

    # 1F RECESSED VELVET-RED AWNING ENTRANCE & POSTER FRAME (y=85..128, x=2..85)
    cv.brick_wall(2, 85, 85, 128, ramp='kuro', base_i=1, course_h=3, brick_w=6, seed=720)
    draw_cornice(cv, 2, 84, 85, ramp='stone', h=2)
    # Dark granite base plinth
    cv.tile_cladding(2, 122, 85, 128, ramp='asphalt', base_i=2, cw=7, ch=4, seed=721)

    # Left: Backlit gig poster frame (x=7..25, y=94..118)
    cv.outline_box(7, 94, 25, 118, col('cream', 5), col('cha', 4), top_hi=col('yellow', 5))
    cv.rect(9, 96, 23, 102, col('navy', 2))
    cv.hline(10, 22, 98, col('yellow', 5))
    cv.rect(10, 104, 22, 112, col('red', 3))
    cv.rect(13, 105, 18, 111, col('orange', 5))  # sax/horn poster art
    cv.hline(10, 22, 114, col('kuro', 1))
    draw_sconce(cv, 16, 91)

    # Center: Recessed velvet-red awning entrance (x=29..62, y=88..127)
    cv.awning(29, 88, 62, 96, ramp_a='red', ramp_b='maple', stripe_w=4)
    cv.hline(29, 62, 95, col('yellow', 4))  # gold awning trim
    # Recessed warm entryway alcove
    cv.outline_box(32, 96, 59, 127, col('orange', 2), col('kuro', 0))
    # Marquee text strip under awning
    cv.rect(34, 97, 57, 103, col('kuro', 1))
    draw_pixel_text(cv, 38, 98, 'JAZZ', col('yellow', 5), spacing=1)
    # Mahogany double club doors with brass porthole glass
    cv.outline_box(36, 104, 55, 126, col('darkwood', 3), col('darkwood', 0), top_hi=col('cha', 4))
    cv.vline(45, 105, 126, col('darkwood', 0))
    cv.rect(38, 108, 43, 114, col('yellow', 5))
    cv.rect(48, 108, 53, 114, col('yellow', 5))
    cv.p(43, 117, col('yellow', 4))
    cv.p(47, 117, col('yellow', 4))
    # Brass stanchions & velvet rope flanking club door
    for sx in (31, 60):
        cv.vline(sx, 118, 127, col('yellow', 4))
        cv.p(sx, 117, col('yellow', 5))
    cv.hline(28, 32, 121, col('red', 4))
    cv.hline(60, 64, 121, col('red', 4))
    cv.hline(31, 61, 127, col('stone', 4))

    # Right: Moody backlit club slit window + neon bar
    cv.window(67, 94, 80, 118, style='warm', frame='kuro:0', sill='stone:4', curtain='red', seed=725)
    cv.hline(69, 78, 101, col('teal', 5))  # small neon LIVE bar inside window
    draw_sconce(cv, 73, 91)

    cv.edge_finish(top_y=4)
    return cv


# ---------------------------------------------------------------------------
# 8. mf-bldg-mid_fitness_studio (96x128)
# ---------------------------------------------------------------------------
def build_mid_fitness_studio():
    cv = Canvas(96, 128)
    # Stepped-back 3F concrete roof penthouse on right (x=38..94, y=1..45)
    # Deepened roof deck (y=1..18) so skylight & AC unit rest cleanly inside parapet with zero clipping
    cv.flat_roof(38, 1, 94, 18, deck_ramp='concrete', deck_i=3, para_ramp='coolwhite', seed=801)
    draw_skylight(cv, 44, 5, 70, 12, frame='steel:2')
    cv.roof_ac(77, 5)
    # 3F penthouse facade (x=38..94, y=18..45)
    draw_panel_wall(cv, 38, 18, 94, 45, ramp='concrete', base_i=4, pw=12, ph=10, dimples=True, seed=802)
    cv.vline(38, 18, 45, col('steel', 1))
    cv.vline(93, 18, 45, col('steel', 0))
    # Clerestory sunlit yoga studio window + terrace glass door
    cv.door_glass(42, 21, 56, 43, frame='steel:1', warm=True)
    cv.window(59, 21, 89, 38, style='warm', frame='steel:1', sill='concrete:5', seed=803)
    # Warm cedar acoustic ceiling & yoga mat silhouettes visible inside 3F studio
    cv.hline(60, 88, 23, col('cedar', 4))
    cv.rect(64, 33, 72, 36, col('teal', 4))
    cv.rect(76, 33, 84, 36, col('orange', 4))

    # 3F RECESSED OUTDOOR TERRACE WITH GREEN TURF STRIP (x=2..40, y=23..45)
    # Side concrete parapet curb
    cv.outline_box(2, 23, 40, 39, col('concrete', 4), col('steel', 1), top_hi=col('coolwhite', 5))
    # Vibrant green athletic turf strip with crisp white agility lane markings!
    for y in range(25, 38):
        for x in range(4, 39):
            stripe = ((x - 4) // 6) % 2
            r = hsh(x, y, 805)
            t = (4 if stripe == 0 else 3) + (1 if r > 0.80 else (-1 if r < 0.20 else 0))
            cv.p(x, y, col('lawn', t))
    cv.hline(4, 39, 25, col('foliage', 1))  # north wall shadow
    # White athletic yard-line ticks on turf
    for tx in (10, 20, 30):
        cv.vline(tx, 27, 36, col('white', 5))
    # Yoga mats & outdoor kettlebell/stretching bench on turf
    cv.rect(6, 28, 9, 34, col('orange', 4))
    cv.rect(13, 29, 18, 33, col('teal', 4))
    cv.planter_box(30, 24, 38, 30, flower='orange:4', pot_ramp='concrete')
    # Sleek glass front balustrade across full 3F terrace edge (x=2..40, y=37..45)
    draw_glass_rail(cv, 2, 37, 40, 45, post_step=12, floor_hint=col('lawn', 2))

    # 2F EXPANSIVE FLOOR-TO-CEILING TINTED GLASS STUDIO (y=45..86, x=2..94)
    draw_cornice(cv, 2, 44, 94, ramp='coolwhite', h=3)
    cv.rect(2, 47, 94, 86, col('steel', 2))
    cv.rect(2, 47, 6, 86, col('concrete', 4))
    cv.rect(90, 47, 94, 86, col('concrete', 3))
    cv.vline(2, 47, 86, col('steel', 1))
    cv.vline(93, 47, 86, col('steel', 0))

    # 4 wide floor-to-ceiling tinted glass bays (each telling a distinct fitness/strength story!)
    bays = [(6, 27, 'blinds_sun'), (27, 48, 'squat_rack'), (48, 69, 'cardio'), (69, 90, 'orange_studio')]
    for bx0, bx1, mode in bays:
        cv.vline(bx0, 48, 84, col('steel', 1))
        for y in range(48, 84):
            ry = y - 48
            for x in range(bx0 + 1, bx1):
                rx = x - (bx0 + 1)
                glint = ((x + y * 2) % 29) in (3, 4, 5)
                if ry == 0:
                    cv.p(x, y, col('glass', 0))
                elif mode == 'blinds_sun':
                    if ry < 16:
                        cv.p(x, y, col('cream', 5 if ry % 2 == 0 else 4))
                    elif ry >= 28:
                        cv.p(x, y, col('floorwood', 4))
                    else:
                        cv.p(x, y, col('glass', 5 if glint else 3))
                elif mode == 'squat_rack':
                    if ry < 10:
                        cv.p(x, y, col('cream', 4 if ry > 2 else 3))
                    elif ry >= 29:
                        cv.p(x, y, col('floorwood', 4))
                    else:
                        cv.p(x, y, col('cream', 5))
                elif mode == 'cardio':
                    if ry >= 28:
                        cv.p(x, y, col('steel', 2))
                    else:
                        cv.p(x, y, col('glass', 5 if glint else 2))
                else:  # 'orange_studio'
                    if ry < 8:
                        cv.p(x, y, col('glass', 4 if glint else 2))
                    elif 10 <= ry <= 24:
                        cv.p(x, y, col('orange', 4 if (rx + ry) % 4 else 5))
                    elif ry >= 29:
                        cv.p(x, y, col('floorwood', 4))
                    else:
                        cv.p(x, y, col('cream', 4))
        # Studio silhouettes inside bays
        if mode == 'squat_rack':
            # Ceiling LED + full-length gym mirror wall + dark lifting platform + power squat rack with loaded barbell!
            cv.hline(bx0 + 4, bx1 - 4, 51, col('white', 6))
            # Recessed full-length gym mirror wall (bx0+3 .. bx1-2, y=58..77)
            cv.outline_box(bx0 + 3, 58, bx1 - 2, 77, col('glass', 4), col('steel', 1))
            for my in range(59, 76):
                for mx in range(bx0 + 4, bx1 - 3):
                    if (mx + my) % 9 in (2, 3):
                        cv.p(mx, my, col('glass', 6))
                    elif my > 70:
                        cv.p(mx, my, col('glass', 3))
            # Dark rubber lifting platform on floor
            cv.rect(bx0 + 3, 79, bx1 - 2, 84, col('asphalt', 2))
            cv.hline(bx0 + 3, bx1 - 2, 79, col('steel', 3))
            # Power Squat Rack uprights & top pull-up bar
            cv.rect(bx0 + 5, 60, bx0 + 7, 81, col('kuro', 1))
            cv.vline(bx0 + 6, 61, 80, col('steel', 4))
            cv.rect(bx1 - 6, 60, bx1 - 4, 81, col('kuro', 1))
            cv.vline(bx1 - 6, 61, 80, col('steel', 4))
            cv.hline(bx0 + 5, bx1 - 4, 60, col('kuro', 0))
            cv.hline(bx0 + 6, bx1 - 5, 61, col('steel', 4))
            cv.hline(bx0 + 6, bx1 - 5, 73, col('steel', 2))  # safety bar
            # Loaded Olympic barbell with bold dark/red bumper plates
            cv.hline(bx0 + 2, bx1 - 1, 66, col('coolwhite', 5))
            cv.hline(bx0 + 2, bx1 - 1, 67, col('steel', 1))
            for px0 in (bx0 + 2, bx1 - 4):
                cv.rect(px0, 63, px0 + 3, 70, col('kuro', 0))
                cv.vline(px0 + 1, 64, 69, col('red', 4))
            # Weight bench centered inside rack
            cv.rect(bx0 + 8, 76, bx1 - 7, 79, col('orange', 4))
            cv.hline(bx0 + 8, bx1 - 7, 78, col('kuro', 0))
            cv.vline(bx0 + 9, 79, 82, col('kuro', 1))
            cv.vline(bx1 - 9, 79, 82, col('kuro', 1))
        elif mode == 'cardio':
            # Treadmill silhouettes + studio plant
            for tx in (bx0 + 3, bx0 + 10):
                cv.rect(tx, 71, tx + 5, 75, col('kuro', 1))
                cv.vline(tx + 4, 65, 72, col('steel', 3))
            cv.foliage_cluster(bx1 - 4, 71, 3, 4, ramp='foliage', seed=810)
        elif mode == 'orange_studio':
            # Hanging boxing bag / TRX straps
            cv.vline(bx0 + 8, 52, 61, col('steel', 1))
            cv.rect(bx0 + 7, 61, bx0 + 10, 72, col('kuro', 1))
            cv.vline(bx0 + 15, 52, 70, col('yellow', 5))
        # Subtle mid transom
        cv.hline(bx0 + 1, bx1, 56, col('steel', 2))
    cv.vline(90, 48, 84, col('steel', 1))

    # 1F STEEL & GLASS LOBBY WITH BRIGHT ORANGE/TEAL HORIZONTAL SIGNAGE (y=86..128, x=2..94)
    cv.rect(2, 86, 94, 128, col('concrete', 4))
    cv.vline(2, 86, 128, col('steel', 1))
    cv.vline(93, 86, 128, col('steel', 0))
    # Signature bright ORANGE + TEAL horizontal athletic fascia sign (x=4..92, y=86..96)
    cv.outline_box(4, 86, 40, 96, col('orange', 4), col('kuro', 0), top_hi=col('orange', 5), bot_sh=col('orange', 2))
    cv.outline_box(40, 86, 92, 96, col('teal', 3), col('kuro', 0), top_hi=col('teal', 5), bot_sh=col('teal', 1))
    # Crisp pixel DUMBBELL icon beside 'FIT' on orange sign (replacing blank squares)
    # Shadow pass
    cv.rect(9, 90, 11, 95, col('orange', 2))
    cv.rect(18, 90, 20, 95, col('orange', 2))
    cv.hline(11, 18, 92, col('orange', 2))
    # Left & right dumbbell plates + horizontal steel grip bar
    cv.rect(8, 89, 10, 94, col('white', 6))
    cv.vline(10, 90, 93, col('yellow', 5))
    cv.hline(11, 17, 91, col('white', 6))
    cv.vline(17, 90, 93, col('yellow', 5))
    cv.rect(18, 89, 20, 94, col('white', 6))
    draw_pixel_text(cv, 23, 89, 'FIT', col('white', 6), spacing=1)
    draw_pixel_text(cv, 46, 89, 'YOGA GYM', col('white', 6), spacing=1)
    cv.hline(5, 92, 96, col('ink', 1))

    # Left showcase: bright juice bar & athletic reception
    cv.window(6, 98, 34, 124, style='warm', frame='steel:1', sill=None, seed=820)
    cv.rect(8, 116, 32, 123, col('teal', 3))
    cv.hline(8, 32, 116, col('white', 6))
    cv.rect(12, 112, 17, 116, col('orange', 4))
    cv.foliage_cluster(28, 113, 3, 4, ramp='foliage', seed=821)

    # Center automatic sliding steel-and-glass entrance doors OPEN FLUSH onto street step (x=37..59, y=98..128)
    # Left, right, and top steel jambs only (NO closed bottom bar!)
    cv.rect(37, 98, 39, 127, col('steel', 3))
    cv.vline(37, 98, 127, col('steel', 0))
    cv.rect(57, 98, 59, 127, col('steel', 3))
    cv.vline(58, 98, 127, col('steel', 0))
    cv.hline(37, 59, 98, col('steel', 0))
    cv.hline(38, 58, 99, col('coolwhite', 5))
    # Twin sliding glass leaves opening onto warm lobby floor
    for lx0, lx1 in [(39, 48), (49, 57)]:
        for y in range(100, 126):
            for x in range(lx0, lx1):
                if y <= 102:
                    cv.p(x, y, col('orange', 3))
                elif y >= 121:
                    cv.p(x, y, col('floorwood', 5 if y == 121 else 4))
                elif (x - lx0 + y - 100) in (3, 4, 11):
                    cv.p(x, y, col('glass', 6))
                else:
                    cv.p(x, y, col('yellow', 4 if y > 110 else 5))
    cv.vline(48, 100, 126, col('steel', 1))
    # Sleek horizontal automatic-door push bars
    cv.hline(41, 47, 114, col('coolwhite', 5))
    cv.hline(50, 56, 114, col('coolwhite', 5))
    # Flush light concrete street entrance step (y=126..127)
    cv.hline(37, 59, 126, col('concrete', 6))
    cv.hline(37, 59, 127, col('concrete', 6))

    # Right showcase: sunlit spin/cycle studio + outdoor bike rack
    cv.window(62, 98, 90, 124, style='glass', frame='steel:1', sill=None, seed=822)
    cv.rect(65, 114, 87, 123, col('cream', 4))
    cv.rect(68, 116, 74, 121, col('orange', 4))
    cv.rect(78, 116, 84, 121, col('teal', 4))
    # Sidewalk sleek steel bike rack & concrete planter
    cv.planter_box(6, 121, 18, 127, flower='orange:4', pot_ramp='concrete')
    for bx in (74, 80, 86):
        cv.outline_box(bx, 122, bx + 4, 127, col('steel', 4), col('steel', 1))

    cv.edge_finish(top_y=1)
    return cv


# ---------------------------------------------------------------------------
# 9. mf-bldg-mid_bookstore_garden (112x128)
# ---------------------------------------------------------------------------
def build_mid_bookstore_garden():
    cv = Canvas(112, 128)
    # 3F stepped-back reading conservatory (x=20..92, y=2..41)
    cv.flat_roof(20, 2, 92, 15, deck_ramp='ibushi', deck_i=3, para_ramp='stone', seed=901)
    draw_skylight(cv, 32, 4, 80, 12, frame='wood:1')
    # 3F conservatory warm wood-and-cream facade (y=15..41, x=20..92)
    draw_ashlar_wall(cv, 20, 15, 92, 41, ramp='kinari', base_i=4, course_h=5, block_w=10, seed=902)
    cv.vline(20, 15, 41, col('wood', 1))
    cv.vline(91, 15, 41, col('wood', 0))
    # Center arched French doors to reading garden + flanked bookshelf windows
    draw_arched_window(cv, 46, 18, 66, 41, frame='wood:1', trim='cream:6', style='warm',
                       mullions=True, sill=None, seed=903)
    cv.window(25, 20, 42, 36, style='warm', frame='wood:1', sill='stone:5', seed=904)
    cv.window(70, 20, 87, 36, style='warm', frame='wood:1', sill='stone:5', seed=905)
    # Colorful tiny book rows visible inside 3F windows
    for wx in (27, 72):
        for sy in (24, 29, 33):
            for bx in range(wx, wx + 13, 2):
                bc = [col('red', 4), col('blue', 4), col('green', 4), col('orange', 4), col('cream', 5)][(bx + sy) % 5]
                cv.vline(bx, sy - 2, sy, bc)

    # 3F STEPPED-BACK READING GARDEN TERRACE WITH TREES & WOODEN BENCHES (x=2..110, y=38..64)
    # Terrace wood-and-flagstone deck
    cv.outline_box(2, 41, 110, 64, col('stone', 4), col('stone', 1), top_hi=col('cream', 5))
    cv.terrace_deck(4, 41, 108, 63, floor_ramp='floorwood', rail_ramp='wood', seed=906)
    # Stone raised tree planters on left & right setback corners
    cv.outline_box(5, 43, 26, 55, col('stone', 4), col('stone', 1), top_hi=col('cream', 5))
    cv.rect(7, 45, 24, 52, col('soil', 3))
    cv.outline_box(86, 43, 107, 55, col('stone', 4), col('stone', 1), top_hi=col('cream', 5))
    cv.rect(88, 45, 105, 52, col('soil', 3))

    # TWO LUSH TERRACE GARDEN TREES rising cleanly into the setback sky corners!
    # Left tree (cx=15)
    cv.rect(14, 38, 17, 50, col('wood', 2))
    cv.vline(14, 39, 49, col('cedar', 4))
    cv.foliage_cluster(15, 31, 10, 8, ramp='foliage', seed=910, blossom=col('yellow', 5))
    cv.foliage_cluster(11, 34, 6, 5, ramp='foliage', seed=911)
    cv.foliage_cluster(21, 35, 6, 5, ramp='foliage', seed=912)
    # Right tree (cx=96)
    cv.rect(95, 38, 98, 50, col('wood', 2))
    cv.vline(95, 39, 49, col('cedar', 4))
    cv.foliage_cluster(96, 31, 10, 8, ramp='foliage', seed=913, blossom=col('pink', 5))
    cv.foliage_cluster(90, 35, 6, 5, ramp='foliage', seed=914)
    cv.foliage_cluster(102, 34, 5, 5, ramp='foliage', seed=915)

    # Wooden garden reading benches & garden lamp on center terrace (x=30..82)
    for bx in (31, 64):
        # Backrest + seat + legs
        cv.outline_box(bx, 46, bx + 17, 50, col('cedar', 4), col('wood', 1), top_hi=col('cedar', 5))
        cv.outline_box(bx - 1, 50, bx + 18, 53, col('cedar', 5), col('wood', 1))
        cv.vline(bx + 1, 53, 56, col('darkwood', 1))
        cv.vline(bx + 15, 53, 56, col('darkwood', 1))
    # Warm reading garden lamp post & low book table between benches
    cv.outline_box(51, 49, 61, 54, col('wood', 4), col('wood', 1), top_hi=col('cedar', 5))
    cv.rect(53, 50, 56, 52, col('cream', 6))  # open book on table
    cv.vline(56, 40, 49, col('darkwood', 1))
    cv.rect(55, 38, 58, 41, col('yellow', 5))
    # Trailing green vines hanging slightly over 3F front balustrade
    for vx in (14, 24, 48, 86, 98):
        cv.vline(vx, 60, 66, col('foliage', 4))
        cv.p(vx + 1, 62, col('foliage', 2))

    # 2F TALL READING-ROOM WINDOWS WITH WARM DESK LAMPS (y=64..95, x=2..110)
    draw_ashlar_wall(cv, 2, 64, 110, 95, ramp='cream', base_i=4, course_h=5, block_w=10, seed=920)
    draw_cornice(cv, 2, 63, 110, ramp='stone', h=3)
    # 4 tall arched reading-room windows with visible warm green-shaded desk lamps & bookshelves
    def draw_bookshelf_window(wx0, wx1, wy0, wy1, mode, seed):
        def inner(c, ix0, iy0, ix1, iy1):
            # Tall wooden bookcase across back wall
            for sy in range(iy0 + 2, iy1 - 5, 4):
                c.hline(ix0, ix1, sy + 2, col('wood', 2))
                for bx in range(ix0 + 1, ix1 - 1, 2):
                    bc = [col('red', 4), col('blue', 4), col('green', 3), col('orange', 4), col('yellow', 4), col('navy', 3)][(bx * 3 + sy + seed) % 6]
                    c.vline(bx, sy, sy + 2, bc)
            # Reading desk at bottom + classic warm desk lamp!
            c.rect(ix0, iy1 - 4, ix1, iy1, col('wood', 3))
            c.hline(ix0, ix1, iy1 - 4, col('cedar', 5))
            if mode == 'green_lamp':
                lx = (ix0 + ix1) // 2
                c.rect(lx - 2, iy1 - 8, lx + 3, iy1 - 6, col('green', 4))  # green banker shade
                c.rect(lx - 1, iy1 - 6, lx + 2, iy1 - 4, col('yellow', 5))  # warm glow
            elif mode == 'twin_lamps':
                for lx in (ix0 + 4, ix1 - 5):
                    c.rect(lx - 1, iy1 - 7, lx + 2, iy1 - 5, col('yellow', 5))
                    c.p(lx, iy1 - 8, col('orange', 4))
            elif mode == 'armchair':
                c.rect(ix0 + 2, iy1 - 7, ix0 + 8, iy1 - 1, col('red', 2))
                c.vline(ix1 - 4, iy0 + 5, iy1 - 1, col('cha', 4))
                c.rect(ix1 - 6, iy0 + 3, ix1 - 2, iy0 + 6, col('yellow', 5))

        st = 'glass' if mode == 'cool_shelves' else 'warm'
        draw_arched_window(cv, wx0, wy0, wx1, wy1, frame='wood:1', trim='cream:6', style=st,
                           curtain=('green' if mode == 'armchair' else None), mullions=True,
                           sill='stone:5', interior_fn=inner, seed=seed)

    draw_bookshelf_window(8, 29, 69, 91, 'green_lamp', 921)
    draw_bookshelf_window(33, 54, 69, 91, 'twin_lamps', 922)
    draw_bookshelf_window(58, 79, 69, 91, 'cool_shelves', 923)
    draw_bookshelf_window(83, 104, 69, 91, 'armchair', 924)

    # 1F WARM WOOD-FRAMED TRIPLE SHOWCASE BAYS PACKED WITH COLORFUL BOOKS (y=95..128, x=2..110)
    cv.rect(2, 95, 110, 128, col('wood', 3))
    cv.siding_wall(2, 95, 110, 128, ramp='wood', base_i=3, horizontal=False, step=4, seed=930)
    draw_cornice(cv, 2, 94, 110, ramp='cedar', h=2)
    # Left & right striped dark-green/cream awnings above book showcase bays
    cv.awning(6, 97, 36, 103, ramp_a='green', ramp_b='cream', stripe_w=4)
    cv.awning(76, 97, 106, 103, ramp_a='green', ramp_b='cream', stripe_w=4)
    # Dark-green & gold flagship bookstore fascia sign (x=36..76, y=95..103) drawn cleanly centered
    cv.outline_box(36, 95, 76, 103, col('green', 1), col('darkwood', 0), top_hi=col('yellow', 4))
    draw_pixel_text(cv, 44, 97, 'BOOKS', col('cream', 6), spacing=2)

    # Left & Right Book Showcase Vitrines packed with colorful pixel books!
    for sx0, sx1, sseed in [(7, 35, 931), (77, 105, 932)]:
        cv.outline_box(sx0, 103, sx1, 124, col('cream', 5), col('darkwood', 0), top_hi=col('cedar', 5))
        cv.rect(sx0 + 1, 104, sx1 - 1, 123, col('yellow', 4))
        # 3 angled tiered wooden display shelves loaded with colorful books
        for sy in (107, 113, 119):
            cv.hline(sx0 + 2, sx1 - 2, sy + 3, col('wood', 3))
            cv.hline(sx0 + 2, sx1 - 2, sy + 4, col('darkwood', 1))
            for bx in range(sx0 + 3, sx1 - 3, 3):
                c1 = [col('red', 4), col('blue', 4), col('teal', 4), col('orange', 4),
                      col('navy', 3), col('green', 4), col('pink', 4), col('brick', 4)][(bx + sy + sseed) % 8]
                cv.rect(bx, sy, bx + 2, sy + 3, c1)
                cv.p(bx, sy, col('cream', 6))  # crisp book cover highlight
        # Subtle glass glare diagonal
        for d in range(6):
            cv.p(sx0 + 2 + d, 105 + d, col('glass', 6))
        # Wood kick-panel below showcase
        cv.outline_box(sx0, 124, sx1, 128, col('wood', 2), col('darkwood', 0), top_hi=col('cedar', 4))

    # Central bookstore flagship entrance (x=39..73, y=103..128)
    cv.outline_box(39, 103, 73, 128, col('cedar', 3), col('darkwood', 0), top_hi=col('cedar', 5))
    # Narrow side book-display windows flanking double wood-and-glass entry doors
    cv.window(41, 106, 47, 123, style='warm', frame='darkwood:1', sill=None)
    cv.window(65, 106, 71, 123, style='warm', frame='darkwood:1', sill=None)
    cv.door_wood(48, 106, 56, 127, ramp='wood', glass_top=True)
    cv.door_wood(56, 106, 64, 127, ramp='wood', glass_top=True)
    draw_sconce(cv, 56, 104)  # warm lantern above central entry
    cv.hline(46, 66, 127, col('stone', 5))
    # Outdoor wooden book-cart on left side of door + planter on right
    cv.outline_box(35, 120, 44, 127, col('cedar', 4), col('wood', 1))
    for bx, bc in [(36, 'red:4'), (38, 'blue:4'), (40, 'yellow:5'), (42, 'teal:4')]:
        cv.vline(bx, 118, 121, C(bc))
    cv.planter_box(68, 121, 77, 127, flower='yellow:4', pot_ramp='brick')

    cv.edge_finish(top_y=2)
    return cv


# ---------------------------------------------------------------------------
# 10. mf-bldg-mid_fashion_flagship (96x128)
# ---------------------------------------------------------------------------
def build_mid_fashion_flagship():
    cv = Canvas(96, 128)
    # 3F RECESSED MINIMALIST GLASS PENTHOUSE (x=12..84, y=1..37)
    # Expanded 16px penthouse roof deck (y=1..17) with clear coping, north/left inner shadow & recessed deck around skylight
    cv.flat_roof(12, 1, 84, 17, deck_ramp='concrete', deck_i=4, para_ramp='white', seed=1001)
    # Strengthen clear coping and crisp north & left inner parapet drop shadows
    cv.hline(13, 83, 2, col('white', 6))
    cv.hline(14, 82, 4, col('concrete', 1))
    cv.hline(14, 82, 5, col('concrete', 2))
    cv.vline(14, 4, 13, col('concrete', 1))
    cv.vline(15, 5, 13, col('concrete', 2))
    # Subtle slab seam lines on recessed roof deck flanking skylight
    cv.vline(21, 5, 13, col('concrete', 3))
    cv.vline(75, 5, 13, col('concrete', 3))
    draw_skylight(cv, 26, 6, 70, 12, frame='kuro:1')

    # Minimalist glass penthouse curtain wall (x=13..83, y=17..37)
    cv.outline_box(13, 17, 83, 37, col('glass', 2), col('kuro', 0), top_hi=col('coolwhite', 5))
    for y in range(18, 36):
        ry = y - 18
        for x in range(14, 82):
            glint = ((x + y * 2) % 23) in (2, 3)
            if x < 50:
                if ry <= 2:
                    cv.p(x, y, col('cream', 3))
                elif glint and ry < 12:
                    cv.p(x, y, col('glass', 6))
                else:
                    cv.p(x, y, col('cream', 5 if ry > 6 else 4))
            else:
                cv.p(x, y, col('glass', 5 if glint else (3 if ry > 11 else 2)))
    # Minimalist hanging garment rail & sculptural light inside penthouse
    cv.hline(19, 43, 25, col('kuro', 1))
    for gx, gc in [(22, 'red:3'), (26, 'navy:3'), (30, 'cream:6'), (34, 'pink:4'), (38, 'kuro:2')]:
        cv.rect(gx, 26, gx + 3, 33, C(gc))
    cv.rect(56, 21, 74, 23, col('yellow', 5))  # linear designer pendant
    for mx in (36, 59):
        cv.vline(mx, 18, 36, col('kuro', 1))

    # 2F SETBACK RECESSED STONE/WOOD TERRACE FLOOR (7px deep, y=36..43) BEHIND LOW RAIL (y=43..48)
    # North parapet coping rims on setback wings (x=2..13 and x=83..94)
    cv.outline_box(2, 35, 13, 38, col('cream', 5), col('stone', 1), top_hi=col('white', 6))
    cv.outline_box(83, 35, 94, 38, col('cream', 5), col('stone', 1), top_hi=col('white', 6))
    # Side parapet walls framing recessed setback terrace
    cv.rect(2, 35, 4, 48, col('cream', 5))
    cv.vline(2, 35, 48, col('stone', 1))
    cv.rect(92, 35, 94, 48, col('cream', 4))
    cv.vline(93, 35, 48, col('stone', 0))
    # Walkable recessed warm oak/stone terrace deck floor (x=4..92, y=36..44)
    for y in range(36, 44):
        ry = y - 36
        for x in range(4, 92):
            if ry == 0:
                cv.p(x, y, col('floorwood', 1))  # crisp north penthouse wall shadow
            elif ry == 1:
                cv.p(x, y, col('floorwood', 2))
            elif x in (4, 5):
                cv.p(x, y, col('stone', 4 if x == 5 else 2))  # stone deck trim + left shadow
            elif x in (90, 91):
                cv.p(x, y, col('stone', 4))
            elif ry % 3 == 2:
                cv.p(x, y, col('floorwood', 3))
            else:
                cv.p(x, y, col('floorwood', 5 if (x + ry) % 4 else 4))
    # Two corner ornamental boxwood planters sitting cleanly INSIDE the recessed terrace deck!
    cv.planter_box(5, 34, 13, 42, flower='cream:6', pot_ramp='stone')
    cv.hline(6, 13, 42, col('floorwood', 1))  # planter cast shadow on deck
    cv.planter_box(83, 34, 91, 42, flower='cream:6', pot_ramp='stone')
    cv.hline(84, 91, 42, col('floorwood', 1))
    # Low architectural rail along front of 2F setback terrace (y=43..47) + cream cornice
    cv.hline(2, 94, 43, col('white', 6))
    cv.hline(2, 94, 44, col('kuro', 1))
    for y in range(45, 47):
        for x in range(3, 93):
            if (x - 3) % 10 == 0 or x in (3, 92):
                cv.p(x, y, col('kuro', 1))
            elif (x + y) % 7 in (1, 2):
                cv.p(x, y, col('glass', 5))
            else:
                cv.p(x, y, col('glass', 4 if y == 45 else 3))
    draw_cornice(cv, 2, 47, 94, ramp='cream', h=3, dentils=True)

    # 2F WARM CREAM FACADE WITH 3 CLOSED-OUTLINE ARCHED DISPLAY BAYS & STRIPED AWNINGS (y=50..87, x=2..94)
    draw_ashlar_wall(cv, 2, 50, 94, 87, ramp='cream', base_i=5, course_h=5, block_w=10, seed=1010)
    # Fluted Parisian corner pilasters
    for px in (2, 89):
        cv.outline_box(px, 50, px + 5, 87, col('cream', 5), col('stone', 2), top_hi=col('white', 6))
        cv.vline(px + 2, 52, 85, col('cream', 3))

    # 3 Tall arched display bays with chic NAVY & CREAM striped boutique awnings
    def salon_left(c, ix0, iy0, ix1, iy1):
        c.outline_box(ix0 + 2, iy0 + 2, ix0 + 8, iy1 - 2, col('glass', 5), col('yellow', 4))
        c.rect(ix1 - 6, iy1 - 9, ix1 - 2, iy1 - 2, col('pink', 4))
        c.p(ix1 - 4, iy1 - 11, col('cream', 6))

    def salon_center(c, ix0, iy0, ix1, iy1):
        c.rect((ix0 + ix1) // 2 - 2, iy0 + 1, (ix0 + ix1) // 2 + 3, iy0 + 4, col('yellow', 5))
        c.hline(ix0 + 2, ix1 - 2, iy1 - 5, col('wood', 3))
        c.rect(ix0 + 3, iy1 - 8, ix0 + 6, iy1 - 5, col('red', 4))
        c.rect(ix1 - 6, iy1 - 8, ix1 - 3, iy1 - 5, col('navy', 3))

    def salon_right(c, ix0, iy0, ix1, iy1):
        c.hline(ix0 + 2, ix1 - 2, iy0 + 6, col('steel', 4))
        c.rect(ix0 + 3, iy0 + 7, ix0 + 7, iy1 - 3, col('navy', 2))
        c.rect(ix0 + 9, iy0 + 7, ix0 + 13, iy1 - 3, col('cream', 6))

    # Continuous warm-violet/slate Fable outlines ('stone:0' = #2b203f) closing all 3 arches with zero white gaps!
    draw_closed_arched_window(cv, 9, 53, 31, 83, outline='stone:0', outer_trim='stone:4', style='warm',
                              curtain='cream', mullions=True, sill='stone:5', interior_fn=salon_left, seed=1011)
    draw_closed_arched_window(cv, 37, 53, 59, 83, outline='stone:0', outer_trim='stone:4', style='cream_bright',
                              curtain='pink', mullions=True, sill='stone:5', interior_fn=salon_center, seed=1012)
    draw_closed_arched_window(cv, 65, 53, 87, 83, outline='stone:0', outer_trim='stone:4', style='glass',
                              curtain=None, mullions=True, sill='stone:5', interior_fn=salon_right, seed=1013)
    # Striped navy & cream boutique awnings tucked neatly below each arched fanlight transom!
    for ax0, ax1 in [(9, 31), (37, 59), (65, 87)]:
        cv.awning(ax0, 60, ax1, 65, ramp_a='navy', ramp_b='cream', stripe_w=3)
        cv.hline(ax0, ax1, 64, col('yellow', 4))

    # 1F DARK-GRANITE BASE WITH BACKLIT MANNEQUIN SHOWCASES & GOLD-ACCENT DOORWAY (y=87..128, x=2..94)
    cv.tile_cladding(2, 87, 94, 128, ramp='kuro', base_i=1, cw=8, ch=6, seed=1020)
    # Crisp gold architectural cornice trim at top of 1F dark-granite base
    cv.hline(2, 94, 87, col('yellow', 4))
    cv.hline(2, 94, 88, col('cha', 4))
    cv.hline(2, 94, 89, col('kuro', 0))
    # Subtle boutique gold brand lettering centered above door
    draw_pixel_text(cv, 32, 90, 'ATELIER', col('yellow', 5), spacing=1)

    # Left BACKLIT MANNEQUIN SHOWCASE WINDOW (x=6..32, y=97..124)
    cv.outline_box(6, 97, 32, 124, col('cream', 6), col('yellow', 4), top_hi=col('white', 6))
    cv.rect(8, 99, 30, 122, col('cream', 5))
    cv.hline(8, 30, 99, col('yellow', 5))
    cv.outline_box(13, 117, 25, 122, col('white', 5), col('stone', 3))
    cv.rect(18, 102, 20, 104, col('cream', 3))
    cv.rect(17, 105, 21, 109, col('red', 4))
    cv.rect(15, 109, 23, 117, col('red', 3))
    cv.vline(17, 109, 117, col('red', 5))
    cv.rect(10, 116, 13, 121, col('yellow', 4))
    for d in range(8):
        cv.p(9 + d, 100 + d, col('white', 6))

    # Right BACKLIT MANNEQUIN SHOWCASE WINDOW (x=64..90, y=97..124)
    cv.outline_box(64, 97, 90, 124, col('cream', 6), col('yellow', 4), top_hi=col('white', 6))
    cv.rect(66, 99, 88, 122, col('cream', 5))
    cv.hline(66, 88, 99, col('yellow', 5))
    cv.outline_box(68, 117, 86, 122, col('white', 5), col('stone', 3))
    cv.rect(72, 103, 74, 105, col('cream', 3))
    cv.rect(70, 106, 76, 117, col('navy', 2))
    cv.vline(72, 106, 117, col('navy', 4))
    cv.p(73, 108, col('yellow', 5))
    cv.rect(81, 104, 83, 106, col('cream', 3))
    cv.rect(79, 107, 85, 117, col('pink', 4))
    cv.vline(81, 107, 117, col('pink', 5))
    for d in range(8):
        cv.p(67 + d, 100 + d, col('white', 6))

    # Center GOLD-ACCENT FLAGSHIP DOORWAY (x=37..59, y=97..127)
    cv.outline_box(37, 97, 59, 127, col('yellow', 4), col('cha', 2), top_hi=col('yellow', 5))
    cv.outline_box(39, 99, 57, 126, col('kuro', 1), col('cha', 3))
    cv.door_glass(40, 101, 56, 126, frame='kuro:0', warm=True)
    cv.vline(46, 112, 118, col('yellow', 5))
    cv.vline(49, 112, 118, col('yellow', 5))
    cv.hline(36, 60, 126, col('cream', 5))
    cv.hline(35, 61, 127, col('stone', 3))
    draw_potted_topiary(cv, 35, 127, pot_ramp='kuro', flower=col('white', 6))
    draw_potted_topiary(cv, 61, 127, pot_ramp='kuro', flower=col('white', 6))

    cv.edge_finish(top_y=1)
    return cv


# ---------------------------------------------------------------------------
# Pack registry & manifest builder
# ---------------------------------------------------------------------------

BUILDERS = [
    {
        'id': 'mf-bldg-mid_setback_cafe',
        'name': '셋백 루프 테라스 로스터리 카페 (3F)',
        'w': 7, 'h': 8, 'size': [112, 128],
        'category': 'urban-midrise',
        'tags': ['midrise', 'setback', 'cafe', 'roastery', 'terrace', 'limestone'],
        'fn': build_mid_setback_cafe,
    },
    {
        'id': 'mf-bldg-mid_brick_fireescape',
        'name': '도심 적벽돌 비상계단 로프트·비스트로 (4F)',
        'w': 6, 'h': 9, 'size': [96, 144],
        'category': 'urban-midrise',
        'tags': ['midrise', 'brick', 'loft', 'fire-escape', 'bistro', 'water-tower'],
        'fn': build_mid_brick_fireescape,
    },
    {
        'id': 'mf-bldg-mid_glass_podium_office',
        'name': '글래스 포디움 모던 오피스 (4F)',
        'w': 7, 'h': 9, 'size': [112, 144],
        'category': 'urban-midrise',
        'tags': ['midrise', 'office', 'glass', 'podium', 'helipad', 'corporate'],
        'fn': build_mid_glass_podium_office,
    },
    {
        'id': 'mf-bldg-mid_corner_boutique_hotel',
        'name': '코너 부티크 호텔 (4F)',
        'w': 7, 'h': 9, 'size': [112, 144],
        'category': 'urban-midrise',
        'tags': ['midrise', 'hotel', 'boutique', 'brick', 'juliet-balcony', 'mansard'],
        'fn': build_mid_corner_boutique_hotel,
    },
    {
        'id': 'mf-bldg-mid_art_gallery_skylight',
        'name': '톱니 천창 현대 미술관 (3F)',
        'w': 7, 'h': 7, 'size': [112, 112],
        'category': 'urban-midrise',
        'tags': ['midrise', 'gallery', 'museum', 'skylight', 'concrete', 'cultural'],
        'fn': build_mid_art_gallery_skylight,
    },
    {
        'id': 'mf-bldg-mid_coworking_balcony',
        'name': '우드 발코니 코워킹 스튜디오 (3F)',
        'w': 7, 'h': 8, 'size': [112, 128],
        'category': 'urban-midrise',
        'tags': ['midrise', 'coworking', 'balcony', 'timber', 'pergola', 'solar'],
        'fn': build_mid_coworking_balcony,
    },
    {
        'id': 'mf-bldg-mid_jazz_rooftop_lounge',
        'name': '재즈 클럽 & 루프탑 라운지 바 (3F)',
        'w': 6, 'h': 8, 'size': [96, 128],
        'category': 'urban-midrise',
        'tags': ['midrise', 'jazz', 'music-club', 'rooftop-bar', 'neon', 'slate'],
        'fn': build_mid_jazz_rooftop_lounge,
    },
    {
        'id': 'mf-bldg-mid_fitness_studio',
        'name': '도심 피트니스 & 요가 스튜디오 (3F)',
        'w': 6, 'h': 8, 'size': [96, 128],
        'category': 'urban-midrise',
        'tags': ['midrise', 'fitness', 'yoga', 'studio', 'turf-terrace', 'glass'],
        'fn': build_mid_fitness_studio,
    },
    {
        'id': 'mf-bldg-mid_bookstore_garden',
        'name': '루프 정원 플래그십 서점 (3F)',
        'w': 7, 'h': 8, 'size': [112, 128],
        'category': 'urban-midrise',
        'tags': ['midrise', 'bookstore', 'garden', 'terrace', 'cultural', 'wood'],
        'fn': build_mid_bookstore_garden,
    },
    {
        'id': 'mf-bldg-mid_fashion_flagship',
        'name': '부티크 패션 플래그십 스토어 (3F)',
        'w': 6, 'h': 8, 'size': [96, 128],
        'category': 'urban-midrise',
        'tags': ['midrise', 'fashion', 'flagship', 'boutique', 'granite', 'penthouse'],
        'fn': build_mid_fashion_flagship,
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
            'category': spec['category'],
            'w': spec['w'],
            'h': spec['h'],
            'size': spec['size'],
            'file': fname,
            'tags': spec['tags'],
        })
        print(f'wrote {fpath} ({cv.w}x{cv.h})')

    manifest = {
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
