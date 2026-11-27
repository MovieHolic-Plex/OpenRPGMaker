#!/usr/bin/env python3
"""Modern-Fable Buildings — Pack 05: Non-Cloned High-Rises & Civic Landmarks (10 buildings).

Strictly locked to tiledata/jp-city/fable-city/palette.json via fable_lib.
Top-3/4 RPG camera angle (Fable 5.2 baseline): visible sunlit rooftop decks / pitched roofs,
top-left directional sunlight, warm-violet/slate outlines, lived-in interior window storytelling,
zero cloned floors (passes G4 anti-clone with huge visual margin), rich 35-60 color shading.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from fable_lib import Canvas, col, C, hsh, shade_rgba, OUT_ROOT

BATCH = 'pack05_highrise_civic'
OUT_DIR = os.path.join(OUT_ROOT, 'buildings', BATCH)


# ---------------------------------------------------------------------------
# Shared Architectural Pixel-Art Helpers (strictly palette-locked)
# ---------------------------------------------------------------------------

def draw_ashlar_wall(cv, x0, y0, x1, y1, ramp='cream', base_i=4, bw=10, bh=5, seed=0):
    """Dignified limestone / granite ashlar block masonry with subtle bevels."""
    for y in range(max(0, y0), min(cv.h, y1)):
        ry = y - y0
        ci = ry // bh
        yy = ry % bh
        off = (bw // 2) if (ci % 2 == 1) else 0
        for x in range(max(0, x0), min(cv.w, x1)):
            rx = (x - x0) + off
            bi = rx // bw
            bx = rx % bw
            r = hsh(bi, ci, seed)
            if yy == bh - 1 or bx == bw - 1:
                cv.p(x, y, col(ramp, max(0, base_i - 2)))
            elif yy == 0:
                t = min(6, base_i + (1 if r > 0.35 else 0))
                cv.p(x, y, col(ramp, t))
            else:
                t = base_i + (1 if r > 0.78 else (-1 if r < 0.22 else 0))
                cv.p(x, y, col(ramp, max(1, t)))


def draw_clean_signboard(cv, x0, y0, x1, y1, ramp='blue', accent='yellow:5', vertical=False, seed=0):
    """Crisp readable pixel signboard with varied non-repetitive glyph silhouettes."""
    cv.outline_box(x0, y0, x1, y1, col(ramp, 3), col(ramp, 0), top_hi=col(ramp, 5), bot_sh=col(ramp, 1))
    ac = C(accent)
    if vertical:
        w = x1 - x0
        cx = (x0 + x1) // 2
        idx = 0
        for gy in range(y0 + 3, y1 - 4, 6):
            kind = int(hsh(idx, y0, seed) * 6) % 6
            idx += 1
            if kind == 0:  # Box/square glyph
                cv.hline(x0 + 2, x1 - 2, gy, ac)
                cv.hline(x0 + 2, x1 - 2, gy + 3, ac)
                cv.vline(x0 + 2, gy, gy + 4, ac)
                cv.vline(x1 - 3, gy, gy + 4, ac)
            elif kind == 1:  # Cross/kanji-like
                cv.hline(x0 + 2, x1 - 2, gy + 1, ac)
                cv.vline(cx, gy, gy + 4, ac)
                cv.p(x0 + 2, gy + 3, ac)
                cv.p(x1 - 3, gy + 3, ac)
            elif kind == 2:  # Two bars + vertical
                cv.hline(x0 + 2, x1 - 2, gy, ac)
                cv.hline(x0 + 3, x1 - 3, gy + 2, ac)
                cv.vline(cx, gy, gy + 4, ac)
            elif kind == 3:  # Arch/gate glyph
                cv.hline(x0 + 2, x1 - 2, gy, ac)
                cv.vline(x0 + 2, gy, gy + 4, ac)
                cv.vline(x1 - 3, gy, gy + 4, ac)
                cv.p(cx, gy + 2, ac)
            elif kind == 4:  # Diagonal/katakana feel
                cv.hline(x0 + 2, x1 - 2, gy, ac)
                cv.vline(x1 - 3, gy, gy + 3, ac)
                cv.hline(x0 + 3, x1 - 2, gy + 3, ac)
            else:  # Compact diamond/bar
                cv.hline(x0 + 3, x1 - 3, gy, ac)
                cv.hline(x0 + 2, x1 - 2, gy + 2, ac)
                cv.p(cx, gy + 3, ac)
    else:
        h = y1 - y0
        cy = (y0 + y1) // 2
        gx = x0 + 3
        idx = 0
        while gx < x1 - 4:
            kind = int(hsh(idx, x0, seed) * 7) % 7
            idx += 1
            if kind == 0:  # Wide square glyph
                cv.hline(gx, gx + 4, y0 + 2, ac)
                cv.hline(gx, gx + 4, y1 - 3, ac)
                cv.vline(gx, y0 + 2, y1 - 2, ac)
                cv.vline(gx + 3, y0 + 2, y1 - 2, ac)
                gx += 6
            elif kind == 1:  # T / cross
                cv.hline(gx, gx + 3, y0 + 2, ac)
                cv.vline(gx + 1, y0 + 2, y1 - 2, ac)
                gx += 5
            elif kind == 2:  # H / parallel bars
                cv.vline(gx, y0 + 2, y1 - 2, ac)
                cv.vline(gx + 3, y0 + 2, y1 - 2, ac)
                cv.hline(gx, gx + 4, cy, ac)
                gx += 6
            elif kind == 3:  # Narrow bar/kana stroke
                cv.vline(gx, y0 + 2, y1 - 2, ac)
                cv.p(gx + 1, y0 + 2, ac)
                cv.p(gx + 1, y1 - 3, ac)
                gx += 4
            elif kind == 4:  # L / corner
                cv.vline(gx, y0 + 2, y1 - 2, ac)
                cv.hline(gx, gx + 3, y1 - 3, ac)
                gx += 5
            elif kind == 5:  # Double horizontal dash
                cv.hline(gx, gx + 3, y0 + 2, ac)
                cv.hline(gx, gx + 3, cy, ac)
                cv.hline(gx, gx + 3, y1 - 3, ac)
                gx += 5
            else:  # Small dot / spacer separator
                cv.p(gx, cy, ac)
                gx += 3
    cv.hline(x0 + 1, x1 + 1, y1, col('ink', 1))


# Crisp 5px-tall pixel uppercase fonts (4-5px wide proportional + 3x5 compact)
FONT_4X5 = {
    'A': ['0110', '1001', '1111', '1001', '1001'],
    'B': ['1110', '1001', '1110', '1001', '1110'],
    'C': ['0111', '1000', '1000', '1000', '0111'],
    'D': ['1110', '1001', '1001', '1001', '1110'],
    'E': ['1111', '1000', '1110', '1000', '1111'],
    'F': ['1111', '1000', '1110', '1000', '1000'],
    'G': ['0111', '1000', '1011', '1001', '0111'],
    'H': ['1001', '1001', '1111', '1001', '1001'],
    'I': ['111',  '010',  '010',  '010',  '111'],
    'K': ['1001', '1010', '1100', '1010', '1001'],
    'L': ['1000', '1000', '1000', '1000', '1111'],
    'M': ['10001', '11011', '10101', '10001', '10001'],
    'N': ['1001', '1101', '1011', '1001', '1001'],
    'O': ['0110', '1001', '1001', '1001', '0110'],
    'P': ['1110', '1001', '1110', '1000', '1000'],
    'R': ['1110', '1001', '1110', '1010', '1001'],
    'S': ['0111', '1000', '0110', '0001', '1110'],
    'T': ['11111', '00100', '00100', '00100', '00100'],
    'U': ['1001', '1001', '1001', '1001', '0110'],
    ' ': ['00', '00', '00', '00', '00'],
}

FONT_3X5 = {
    'A': ['010', '101', '111', '101', '101'],
    'C': ['111', '100', '100', '100', '111'],
    'D': ['110', '101', '101', '101', '110'],
    'E': ['111', '100', '110', '100', '111'],
    'H': ['101', '101', '111', '101', '101'],
    'I': ['111', '010', '010', '010', '111'],
    'L': ['100', '100', '100', '100', '111'],
    'M': ['101', '111', '101', '101', '101'],
    'N': ['111', '101', '101', '101', '101'],
    'O': ['111', '101', '101', '101', '111'],
    'P': ['110', '101', '110', '100', '100'],
    'R': ['110', '101', '110', '101', '101'],
    'S': ['111', '100', '111', '001', '111'],
    'T': ['111', '010', '010', '010', '010'],
    ' ': ['00', '00', '00', '00', '00'],
}


def measure_pixel_text(text, font=FONT_4X5, spacing=2):
    """Return total pixel width of horizontal 5px-tall pixel lettering."""
    if not text:
        return 0
    total = 0
    for i, ch in enumerate(text.upper()):
        rows = font.get(ch, font[' '])
        total += len(rows[0])
        if i + 1 < len(text):
            total += spacing
    return total


def draw_pixel_text(cv, x0, y0, text, color, font=FONT_4X5, spacing=2, shadow=None):
    """Draw razor-crisp 5px-tall uppercase pixel lettering horizontally."""
    cx = x0
    c_main = C(color)
    c_sh = C(shadow) if shadow is not None else None
    for ch in text.upper():
        rows = font.get(ch, font[' '])
        gw = len(rows[0])
        if c_sh is not None:
            for ry, row in enumerate(rows):
                for rx, bit in enumerate(row):
                    if bit == '1':
                        cv.p(cx + rx + 1, y0 + ry, c_sh)
        for ry, row in enumerate(rows):
            for rx, bit in enumerate(row):
                if bit == '1':
                    cv.p(cx + rx, y0 + ry, c_main)
        cx += gw + spacing


def draw_vertical_text_banner(cv, x0, y0, x1, y1, text, ramp='blue', back_ramp=None,
                              text_color='yellow:5', font=FONT_4X5):
    """Crisp vertical facade blade signboard with stacked 5px-tall legible uppercase letters."""
    br = back_ramp or ramp
    cv.outline_box(x0, y0, x1, y1, col(br, 1), col(br, 0), top_hi=col(ramp, 5), bot_sh=col(br, 0))
    # Subtle vertical frame trim left/right while keeping dark high-contrast interior backing
    cv.vline(x0 + 1, y0 + 1, y1 - 1, col(ramp, 4))
    cv.vline(x1 - 2, y0 + 1, y1 - 1, col(ramp, 2))
    cv.rect(x0 + 2, y0 + 2, x1 - 2, y1 - 2, col(br, 1))
    chars = list(text.upper())
    n = len(chars)
    if n > 0:
        inner_y0 = y0 + 3
        inner_y1 = y1 - 3
        avail_h = inner_y1 - inner_y0
        # Evenly distribute 5px-tall glyphs with clean breathing gaps
        gap = max(2, (avail_h - n * 5) // (n + 1))
        total_h = n * 5 + (n - 1) * gap
        sy = inner_y0 + (avail_h - total_h) // 2
        inner_x0 = x0 + 2
        inner_w = (x1 - 2) - inner_x0
        c_txt = C(text_color)
        c_sh = col(br, 0)
        for ch in chars:
            rows = font.get(ch, font[' '])
            gw = len(rows[0])
            gx = inner_x0 + (inner_w - gw) // 2
            # Subtle 1px drop shadow directly underneath for pop
            for ry, row in enumerate(rows):
                for rx, bit in enumerate(row):
                    if bit == '1':
                        cv.p(gx + rx, sy + ry + 1, c_sh)
            for ry, row in enumerate(rows):
                for rx, bit in enumerate(row):
                    if bit == '1':
                        cv.p(gx + rx, sy + ry, c_txt)
            sy += 5 + gap
    cv.hline(x0 + 1, x1 + 1, y1, col('ink', 1))


def draw_envelope_icon(cv, x0, y0, w=11, h=7, bg='white:6', line='red:1', border='red:0'):
    """Crisp unmistakable white postal envelope icon with clean dark V-flap."""
    cv.outline_box(x0, y0, x0 + w, y0 + h, bg, border)
    cx = x0 + w // 2
    # Crisp V-shaped envelope flap from top-left & top-right inner corners to center
    for step in range(min(4, w // 2 - 1)):
        lx = x0 + 1 + step
        rx = x0 + w - 2 - step
        py = y0 + 1 + step
        if py < y0 + h - 1:
            cv.p(lx, py, line)
            cv.p(rx, py, line)
    cv.p(cx, min(y0 + h - 2, y0 + 1 + min(3, w // 2 - 2)), line)


def draw_police_star_crest(cv, cx, cy):
    """Crisp 5-point golden/white police star badge inside a dark navy heraldic plaque (never a cross)."""
    # Dark navy heraldic plaque with crisp gold/blue top trim (x=cx-8..cx+8, y=cy-8..cy+9)
    cv.outline_box(cx - 8, cy - 8, cx + 8, cy + 9, col('navy', 0), col('navy', 0))
    cv.hline(cx - 7, cx + 7, cy - 7, col('blue', 4))
    cv.vline(cx - 7, cy - 7, cy + 8, col('navy', 1))
    cv.vline(cx + 6, cy - 7, cy + 8, col('navy', 1))
    cv.hline(cx - 7, cx + 7, cy + 7, col('navy', 1))
    # Crisp 11x10 5-point police star bitmap (unmistakable 5 points, zero cross silhouette!)
    star_rows = [
        '.....Y.....',
        '....YWY....',
        '....YWY....',
        'YYYYWWYYYYO',
        '.YYWWWWWYO.',
        '..YWWWYOO..',
        '..YWWYOOO..',
        '.YYO...OYY.',
        '.YO.....OO.',
        'Y.........O',
    ]
    sy0 = cy - 5
    sx0 = cx - 5
    for ry, row in enumerate(star_rows):
        for rx, ch in enumerate(row):
            if ch == 'W':
                cv.p(sx0 + rx, sy0 + ry, col('white', 6))
            elif ch == 'Y':
                cv.p(sx0 + rx, sy0 + ry, col('yellow', 5 if ry <= 4 else 4))
            elif ch == 'O':
                cv.p(sx0 + rx, sy0 + ry, col('orange', 4 if ry <= 5 else 3))


def draw_curtain_glass_panel(cv, x0, y0, x1, y1, mode='sky', frame='steel:1', seed=0,
                             diag_shift=0, lit_color='yellow', split_mullion=True):
    """Modern curtain-wall glazing bay with diagonal sky reflection, mullions & refined office life."""
    cv.outline_box(x0, y0, x1, y1, col('glass', 1), frame)
    ix0, iy0, ix1, iy1 = x0 + 1, y0 + 1, x1 - 1, y1 - 1
    w = max(1, ix1 - ix0)
    h = max(1, iy1 - iy0)
    for y in range(iy0, iy1):
        ry = y - iy0
        for x in range(ix0, ix1):
            rx = x - ix0
            d = (rx + ry + diag_shift) % 16
            if mode == 'warm_office':
                # Refined glass curtain wall with warm backlit office interior + cool glass top sheen
                if ry == 0:
                    cv.p(x, y, col('glass', 1))
                elif ry == 1:
                    cv.p(x, y, col('white', 6) if rx % 5 in (1, 2) else col('orange', 2))
                elif ry == 2:
                    cv.p(x, y, col('orange', 3 if d not in (2, 3) else 4))
                elif ry >= h - 3:
                    if (rx % 6 in (1, 2)) and ry == h - 3:
                        cv.p(x, y, col('coolwhite', 5))
                    elif ry == h - 1:
                        cv.p(x, y, col('wood', 2))
                    else:
                        cv.p(x, y, col('orange', 3 if rx % 3 == 0 else 4))
                else:
                    if d in (2, 3):
                        cv.p(x, y, col('cream', 5))  # Diagonal glass reflection over warm room
                    else:
                        cv.p(x, y, col(lit_color, 4 if (rx + ry) % 3 != 0 else 3))
            elif mode == 'blinds_top':
                if ry < h // 2 + 1:
                    cv.p(x, y, col('cream', 5 if ry % 2 == 0 else 3))
                else:
                    cv.p(x, y, col('glass', 4 if d in (2, 3) else 2))
            elif mode == 'blinds_low':
                if ry < h - 3:
                    cv.p(x, y, col('coolwhite', 4 if ry % 2 == 0 else 2))
                else:
                    cv.p(x, y, col('orange', 4 if rx % 3 != 0 else 3))
            elif mode == 'cool_lit':
                if ry == 0:
                    cv.p(x, y, col('glass', 1))
                elif ry == 1 and rx % 5 in (1, 2):
                    cv.p(x, y, col('white', 6))
                elif ry >= h - 2:
                    cv.p(x, y, col('tile', 2 if rx % 3 == 0 else 3))
                else:
                    cv.p(x, y, col('glass', 5 if d in (1, 2, 3) else 4))
            else:
                # Deep sky curtain wall with crisp sweeping diagonal specular sheen
                if ry == 0:
                    cv.p(x, y, col('glass', 0))
                elif d in (1, 2):
                    cv.p(x, y, col('glass', 6 if ry < h // 2 else 5))
                elif d == 3:
                    cv.p(x, y, col('glass', 4))
                elif d == 9 and ry < h - 2:
                    cv.p(x, y, col('glass', 4))
                elif ry >= h - 2:
                    cv.p(x, y, col('tile', 2 if (rx % 3 == 0) else 3))
                else:
                    cv.p(x, y, col('glass', 2 if (rx + ry) % 4 != 0 else 3))
    # Crisp slender architectural mullion splitting wide curtain bays into double panes
    if split_mullion and w >= 14:
        mx = (x0 + x1) // 2
        cv.vline(mx, iy0, iy1, frame)
    if h >= 14:
        my = y0 + (h * 2) // 3
        cv.hline(ix0, ix1, my, col('steel', 2))


def draw_rich_window(cv, x0, y0, x1, y1, variant='sky', frame='steel:1', sill='concrete:5', seed=0):
    """Storytelling Fable window with curtains, blinds, plants, warm lamps, or office desks."""
    w = x1 - x0
    h = y1 - y0
    if variant == 'warm_lamp':
        cv.window(x0, y0, x1, y1, style='warm', frame=frame, sill=sill, seed=seed)
        if w >= 8 and h >= 8:
            # Cozy hanging pendant lamp / warm table silhouette
            cx = (x0 + x1) // 2
            cv.p(cx, y0 + 2, col('wood', 2))
            cv.hline(cx - 1, cx + 2, y0 + 3, col('white', 6))
            cv.hline(x0 + 2, x1 - 2, y1 - 2, col('wood', 2))
    elif variant == 'warm_curtain_red':
        cv.window(x0, y0, x1, y1, style='warm', frame=frame, sill=sill, curtain='red', seed=seed)
    elif variant == 'warm_curtain_orange':
        cv.window(x0, y0, x1, y1, style='warm', frame=frame, sill=sill, curtain='orange', seed=seed)
    elif variant == 'sky_curtain_blue':
        cv.window(x0, y0, x1, y1, style='glass', frame=frame, sill=sill, curtain='blue', seed=seed)
    elif variant == 'sky_curtain_teal':
        cv.window(x0, y0, x1, y1, style='glass', frame=frame, sill=sill, curtain='teal', seed=seed)
    elif variant == 'sky_curtain_cream':
        cv.window(x0, y0, x1, y1, style='glass', frame=frame, sill=sill, curtain='cream', seed=seed)
    elif variant == 'blinds_half':
        cv.window(x0, y0, x1, y1, style='blinds', frame=frame, sill=sill, seed=seed)
    elif variant == 'blinds_warm':
        cv.window(x0, y0, x1, y1, style='warm', frame=frame, sill=sill, seed=seed)
        for y in range(y0 + 1, y0 + max(3, h // 2)):
            cv.hline(x0 + 1, x1 - 1, y, col('cream', 5 if (y - y0) % 2 == 0 else 3))
    elif variant == 'plant_sill':
        cv.window(x0, y0, x1, y1, style='glass', frame=frame, sill=sill, curtain='cream', seed=seed)
        if w >= 7:
            cv.planter_box(x0 + 1, y1 - 4, x1 - 1, y1, flower='red:4' if seed % 2 == 0 else 'yellow:4', pot_ramp='brick')
    elif variant == 'bookshelf':
        cv.window(x0, y0, x1, y1, style='warm', frame=frame, sill=sill, seed=seed)
        if w >= 7 and h >= 7:
            for bx in range(x0 + 2, x1 - 2):
                c_rmp = ('red', 'blue', 'green', 'yellow', 'wood')[(bx + seed) % 5]
                cv.p(bx, y1 - 3, col(c_rmp, 3))
                cv.p(bx, y1 - 2, col(c_rmp, 2))
    elif variant == 'patient':
        cv.window(x0, y0, x1, y1, style='glass', frame=frame, sill=sill, seed=seed)
        # Subtle pale curtain or warm reading lamp inside hospital room
        if seed % 3 == 0:
            for y in range(y0 + 1, y1 - 1):
                cv.p(x0 + 1, y, col('coolwhite', 5 if y % 2 == 0 else 3))
                cv.p(x0 + 2, y, col('teal', 4 if y % 2 == 0 else 3))
        elif seed % 3 == 1:
            for y in range(y0 + 1, y0 + h // 2):
                cv.hline(x0 + 1, x1 - 1, y, col('white', 5 if y % 2 == 0 else 3))
            cv.rect(x0 + 2, y1 - 3, x1 - 2, y1 - 1, col('yellow', 4))
        else:
            cv.rect(x0 + 2, y1 - 3, x0 + 5, y1 - 1, col('orange', 4))
            cv.p(x0 + 3, y1 - 4, col('white', 6))
    else:
        cv.window(x0, y0, x1, y1, style='glass', frame=frame, sill=sill, seed=seed)


def draw_arched_window(cv, x0, y0, x1, y1, variant='sky', frame='stone:1', trim='cream:6',
                       sill='stone:5', seed=0):
    """Tall classical arched window with stone voussoir arch surround."""
    w = x1 - x0
    h = y1 - y0
    # Draw base rectangular window starting 2px lower, then sculpt arch top
    draw_rich_window(cv, x0, y0, x1, y1, variant=variant, frame=frame, sill=sill, seed=seed)
    # Round top corners with stone arch spandrels
    cv.p(x0, y0, trim)
    cv.p(x1 - 1, y0, trim)
    cv.p(x0 + 1, y0, frame)
    cv.p(x1 - 2, y0, frame)
    cv.p(x0, y0 + 1, frame)
    cv.p(x1 - 1, y0 + 1, frame)
    # Stone arch hood above
    if y0 > 0:
        cv.hline(x0 + 1, x1 - 1, y0 - 1, trim)
        cv.p(x0, y0 - 1, col('stone', 3))
        cv.p(x1 - 1, y0 - 1, col('stone', 3))
    # Keystone at apex
    cv.p((x0 + x1) // 2, y0 - 1, col('white', 6))


def draw_column(cv, x, y0, y1, w=6, ramp='cream'):
    """Fluted classical stone column with capital, shaft fluting, and plinth base."""
    # Capital (top 4px)
    cv.outline_box(x - 1, y0, x + w + 1, y0 + 3, col(ramp, 5), col(ramp, 1), top_hi=col(ramp, 6))
    cv.hline(x, x + w, y0 + 3, col(ramp, 2))
    # Fluted shaft
    for y in range(y0 + 4, y1 - 3):
        for dx in range(w):
            px = x + dx
            if dx == 0:
                cv.p(px, y, col(ramp, 1))
            elif dx == w - 1:
                cv.p(px, y, col(ramp, 0))
            elif dx == 1:
                cv.p(px, y, col(ramp, 6))
            elif dx % 2 == 0:
                cv.p(px, y, col(ramp, 3))
            else:
                cv.p(px, y, col(ramp, 5))
    # Plinth base (bottom 3px)
    cv.outline_box(x - 1, y1 - 3, x + w + 1, y1, col(ramp, 4), col(ramp, 1), top_hi=col(ramp, 6))


def draw_steps(cv, x0, y0, x1, y1, n_steps=4, ramp='stone'):
    """Top-3/4 sunlit cascading stone staircase with bright treads & crisp shaded risers."""
    h = y1 - y0
    sh = max(2, h // n_steps)
    for i in range(n_steps):
        sy0 = y0 + i * sh
        sy1 = y1 if i == n_steps - 1 else min(y1, sy0 + sh)
        if sy0 >= y1:
            break
        # Bright top tread
        cv.hline(x0, x1, sy0, col(ramp, 6))
        if sy1 - sy0 >= 3:
            cv.hline(x0, x1, sy0 + 1, col(ramp, 5))
        # Shaded vertical riser
        for ry in range(sy0 + (2 if sy1 - sy0 >= 3 else 1), sy1 - 1):
            cv.hline(x0, x1, ry, col(ramp, 3))
        cv.hline(x0, x1, sy1 - 1, col(ramp, 1))
        # Subtle masonry stone joints on each step
        for sx in range(x0 + 6 + (i % 2) * 3, x1 - 2, 10):
            cv.p(sx, sy0, col(ramp, 4))
            cv.p(sx, sy1 - 1, col(ramp, 0))


def draw_hanging_banner(cv, x0, y0, x1, y1, ramp='red', accent='yellow:5', seed=0):
    """Vertical museum/depato exhibition banner with metal bracket, fold shade & bespoke art motif."""
    w = x1 - x0
    h = y1 - y0
    # Top bronze hanging bar
    cv.hline(x0 - 1, x1 + 1, y0, col('steel', 1))
    cv.hline(x0, x1, y0 + 1, col('yellow', 4))
    # Fabric body
    for y in range(y0 + 2, y1):
        ry = y - (y0 + 2)
        for x in range(x0, x1):
            rx = x - x0
            if y >= y1 - 2 and abs(rx - (w - 1) / 2.0) < 1.2:
                continue
            if rx == 0 or rx == w - 1:
                cv.p(x, y, col(ramp, 0))
            elif rx == 1:
                cv.p(x, y, col(ramp, 5 if ry % 5 != 0 else 4))
            elif rx == w - 2:
                cv.p(x, y, col(ramp, 2))
            else:
                cv.p(x, y, col(ramp, 4 if ry % 6 != 0 else 3))
    # Bespoke exhibition art motif per seed
    cx = (x0 + x1) // 2
    cy = y0 + h // 2
    if w >= 6 and h >= 14:
        motif = seed % 4
        cv.hline(x0 + 2, x1 - 2, y0 + 5, accent)
        cv.hline(x0 + 2, x1 - 2, y1 - 6, accent)
        if motif == 0:  # Glowing sun/circle art
            cv.rect(cx - 2, cy - 3, cx + 3, cy + 2, accent)
            cv.p(cx - 2, cy - 3, col(ramp, 4))
            cv.p(cx + 2, cy - 3, col(ramp, 4))
            cv.p(cx - 2, cy + 1, col(ramp, 4))
            cv.p(cx + 2, cy + 1, col(ramp, 4))
            cv.p(cx, cy - 1, col('white', 6))
        elif motif == 1:  # Classical arch silhouette
            cv.rect(cx - 2, cy - 4, cx + 3, cy + 4, accent)
            cv.rect(cx - 1, cy - 2, cx + 2, cy + 4, col(ramp, 2))
            cv.p(cx - 2, cy - 4, col(ramp, 4))
            cv.p(cx + 2, cy - 4, col(ramp, 4))
        elif motif == 2:  # Abstract geometric diamond
            for dy in range(-3, 4):
                span = 3 - abs(dy)
                cv.hline(cx - span, cx + span + 1, cy + dy, accent)
            cv.p(cx, cy, col(ramp, 1))
        else:  # Modern diagonal wave / sculpture ribbon
            for dy in range(-4, 5):
                ox = (dy // 2)
                cv.hline(cx - 1 + ox, cx + 2 + ox, cy + dy, accent)
    # Cast shadow on wall right
    cv.vline(x1, y0 + 2, y1 - 1, col('ink', 1))


def draw_clock_face(cv, cx, cy, r=9):
    """Glowing round cream civic clock face with bronze bezel, ticks, and 10:10 hands."""
    for y in range(cy - r - 1, cy + r + 2):
        for x in range(cx - r - 1, cx + r + 2):
            d = math.hypot(x - cx, y - cy)
            if d <= r + 1.1 and d > r - 0.8:
                # Ornate bronze/gold rim (lit top-left, shaded bottom-right)
                if (x - cx) + (y - cy) < 0:
                    cv.p(x, y, col('yellow', 4 if d < r + 0.3 else 2))
                else:
                    cv.p(x, y, col('wood', 1 if d > r else 3))
            elif d <= r - 0.8:
                # Warm illuminated cream dial
                if d > r - 2.0 and (y - cy) < 0:
                    cv.p(x, y, col('cream', 4))  # Inner bezel shadow
                elif d < r - 3.5:
                    cv.p(x, y, col('white', 6))
                else:
                    cv.p(x, y, col('cream', 5))
    # 12, 3, 6, 9 hour markers
    cv.vline(cx, cy - r + 2, cy - r + 4, col('ink', 0))
    cv.vline(cx, cy + r - 3, cy + r - 1, col('ink', 0))
    cv.hline(cx - r + 2, cx - r + 4, cy, col('ink', 0))
    cv.hline(cx + r - 3, cx + r - 1, cy, col('ink', 0))
    # Diagonal minor dots
    o = int(r * 0.58)
    for sx in (-o, o):
        for sy in (-o, o):
            cv.p(cx + sx, cy + sy, col('stone', 2))
    # Clock hands (10:10): short hour hand up-left, long minute hand up-right
    for k in range(1, max(3, r // 2)):
        cv.p(cx - k, cy - (k * 2) // 3, col('ink', 0))
    for k in range(1, max(4, r - 2)):
        cv.p(cx + k, cy - (k * 2) // 3, col('ink', 0))
    cv.p(cx, cy, col('red', 3))


def draw_hipped_roof(cv, x0, y0, x1, y1, ramp='teal', ridge_inset=10, seed=0):
    """Top-3/4 hipped shingled/copper-slate roof with sunlit ridge & corner hips."""
    w = x1 - x0
    h = y1 - y0
    for y in range(y0, y1):
        ry = y - y0
        frac = ry / max(1, h - 1)
        inset = int(round(ridge_inset * (1.0 - frac)))
        lx = x0 + inset
        rx_end = x1 - inset
        for x in range(lx, rx_end):
            rx = x - lx
            rw = rx_end - lx
            if ry == 0:
                cv.p(x, y, col(ramp, 1) if rx in (0, rw - 1) else col(ramp, 5))
            elif ry == 1:
                cv.p(x, y, col(ramp, 5 if rx % 3 != 2 else 4))
            elif ry == h - 1:
                cv.p(x, y, col(ramp, 0))
            elif ry == h - 2:
                cv.p(x, y, col(ramp, 1 if rx % 4 != 1 else 2))
            elif rx == 0 or rx == rw - 1:
                cv.p(x, y, col(ramp, 0))
            elif rx == 1:
                cv.p(x, y, col(ramp, 4))  # Lit left hip rib
            elif rx == rw - 2:
                cv.p(x, y, col(ramp, 1))  # Shaded right hip slope
            else:
                ci = (ry - 2) // 4
                yy = (ry - 2) % 4
                bx = (x + (2 if ci % 2 else 0)) % 4
                bi = (x + (2 if ci % 2 else 0)) // 4
                r = hsh(bi, ci, seed)
                right_sh = 1 if rx > rw - 6 else 0
                if yy == 3 or bx == 3:
                    cv.p(x, y, col(ramp, max(0, 1 - right_sh)))
                else:
                    t = 4 if ry < h // 2 else 3
                    if r > 0.75:
                        t += 1
                    elif r < 0.22:
                        t -= 1
                    if yy == 0 and bx == 0:
                        t += 1
                    cv.p(x, y, col(ramp, max(1, min(5, t - right_sh))))


def draw_balcony_unit(cv, x0, y0, x1, y1, win_var='sky', rail='glass',
                      plant=False, laundry=False, ac=False, seed=0):
    """Recessed 3/4 sunlit apartment balcony with deck, sliding door, balustrade & life."""
    w = x1 - x0
    h = y1 - y0
    rail_h = 7
    ry0 = y1 - rail_h
    # Deep recessed ceiling/back wall inside balcony
    cv.rect(x0, y0, x1, ry0, col('concrete', 2))
    cv.hline(x0, x1, y0, col('concrete', 0))
    cv.hline(x0, x1, y0 + 1, col('concrete', 1))
    # Sliding patio window/door inside recess
    draw_rich_window(cv, x0 + 2, y0 + 2, x1 - 2, ry0 + 1, variant=win_var,
                     frame='steel:1', sill=None, seed=seed)
    # Balcony floor lip visible just behind rail
    cv.hline(x0 + 1, x1 - 1, ry0 - 1, col('floorwood', 4))
    # Optional props tucked on balcony
    if plant and w >= 14:
        px0 = x0 + 2 if seed % 2 == 0 else x1 - 8
        cv.planter_box(px0, ry0 - 5, px0 + 6, ry0, flower='red:4' if seed % 3 else 'yellow:4', pot_ramp='brick')
    if laundry and w >= 16:
        # Crisp little clothesline + colorful folded towel/shirt draped over rail!
        lx = x0 + 4 if seed % 2 == 0 else x1 - 11
        c1 = ('white', 'blue', 'pink', 'yellow')[seed % 4]
        c2 = ('cream', 'teal', 'orange', 'red')[(seed + 2) % 4]
        cv.rect(lx, ry0 - 2, lx + 4, ry0 + 3, col(c1, 5))
        cv.vline(lx, ry0 - 2, ry0 + 3, col(c1, 2))
        cv.rect(lx + 5, ry0 - 2, lx + 8, ry0 + 2, col(c2, 4))
        cv.vline(lx + 5, ry0 - 2, ry0 + 2, col(c2, 1))
    if ac and w >= 14:
        ax = x1 - 8 if seed % 2 == 0 else x0 + 2
        cv.outline_box(ax, ry0 - 5, ax + 6, ry0, col('white', 4), col('steel', 1), top_hi=col('white', 6))
        cv.rect(ax + 1, ry0 - 3, ax + 4, ry0 - 1, col('steel', 2))

    # Front balcony balustrade (glass or steel bars or warm concrete parapet)
    if rail == 'glass':
        cv.hline(x0, x1, ry0, col('steel', 5))
        cv.hline(x0, x1, ry0 + 1, col('steel', 1))
        for y in range(ry0 + 2, y1 - 2):
            for x in range(x0, x1):
                rx = x - x0
                if rx in (0, w - 1) or rx % 7 == 0:
                    cv.p(x, y, col('steel', 2))
                elif (rx + y) % 5 == 0:
                    cv.p(x, y, col('glass', 5))
                else:
                    cv.p(x, y, col('glass', 3 if y == ry0 + 2 else 2))
        cv.hline(x0, x1, y1 - 2, col('concrete', 5))
        cv.hline(x0, x1, y1 - 1, col('concrete', 1))
    elif rail == 'bars':
        cv.hline(x0, x1, ry0, col('steel', 5))
        cv.hline(x0, x1, ry0 + 1, col('steel', 1))
        for y in range(ry0 + 2, y1 - 2):
            for x in range(x0, x1):
                rx = x - x0
                if rx in (0, w - 1) or rx % 3 == 0:
                    cv.p(x, y, col('steel', 2))
                else:
                    cv.p(x, y, col('concrete', 2 if y == ry0 + 2 else 3))
        cv.hline(x0, x1, y1 - 2, col('concrete', 6))
        cv.hline(x0, x1, y1 - 1, col('concrete', 1))
    else:
        # Solid warm stone/concrete balcony half-wall
        cv.outline_box(x0, ry0, x1, y1, col('cream', 4), col('concrete', 1), top_hi=col('cream', 6), bot_sh=col('concrete', 2))
        cv.hline(x0 + 1, x1 - 1, ry0 + 2, col('cream', 3))
    # Balcony cast drop shadow underneath
    cv.hline(x0 + 1, x1, y1, col('ink', 1))


def draw_flagpole(cv, x, y0, y1, flag_ramp='blue', stripe_ramp='white', flag_right=True):
    """Crisp metallic flagpole with sunlit finial ball and fluttering pixel banner."""
    cv.vline(x, y0 + 1, y1, col('steel', 4))
    cv.vline(x + 1, y0 + 2, y1, col('steel', 1))
    cv.p(x, y0, col('yellow', 5))
    # Fluttering flag (10x6)
    d = 1 if flag_right else -1
    for fy in range(6):
        for fx in range(1, 10):
            wave = 1 if (fx >= 5 and fx <= 7) else 0
            px = x + d * fx
            py = y0 + 1 + fy + wave
            if fy in (0, 5) or fx == 9:
                cv.p(px, py, col(flag_ramp, 1))
            elif fy in (2, 3):
                cv.p(px, py, col(stripe_ramp, 5 if fx < 6 else 4))
            else:
                cv.p(px, py, col(flag_ramp, 4 if fx < 6 else 3))


def draw_ferris_wheel(cv, cx, cy, r=11):
    """Charming rooftop depato mini Ferris wheel with colorful gondolas."""
    # A-frame steel legs grounded on deck
    for k in range(r + 4):
        ly = cy + k
        dx = int(k * 0.55)
        cv.p(cx - dx, ly, col('steel', 1))
        cv.p(cx - dx + 1, ly, col('steel', 4))
        cv.p(cx + dx, ly, col('steel', 1))
        cv.p(cx + dx - 1, ly, col('steel', 3))
    # Spokes (8 directions)
    for ang_deg in range(0, 360, 45):
        rad = math.radians(ang_deg)
        for t in range(1, r):
            sx = cx + int(round(math.cos(rad) * t))
            sy = cy + int(round(math.sin(rad) * t))
            cv.p(sx, sy, col('coolwhite', 4 if t % 2 == 0 else 2))
    # Rim (subtle dark outer halo + bright sunlit inner ring so wheel pops against sky!)
    for ang_deg in range(0, 360, 5):
        rad = math.radians(ang_deg)
        ox = cx + int(round(math.cos(rad) * (r + 1)))
        oy = cy + int(round(math.sin(rad) * (r + 1)))
        cv.p(ox, oy, col('steel', 1))
    for ang_deg in range(0, 360, 5):
        rad = math.radians(ang_deg)
        rx = cx + int(round(math.cos(rad) * r))
        ry = cy + int(round(math.sin(rad) * r))
        cv.p(rx, ry, col('white', 6 if ry < cy else 4))
    # Center hub
    cv.rect(cx - 1, cy - 1, cx + 2, cy + 2, col('red', 4))
    cv.p(cx, cy, col('yellow', 5))
    # 8 colorful gondolas hanging at wheel rim
    g_ramps = ['red', 'yellow', 'blue', 'green', 'orange', 'pink', 'teal', 'yellow']
    for i, ang_deg in enumerate(range(0, 360, 45)):
        rad = math.radians(ang_deg)
        gx = cx + int(round(math.cos(rad) * (r + 1)))
        gy = cy + int(round(math.sin(rad) * (r + 1)))
        rmp = g_ramps[i]
        cv.outline_box(gx - 2, gy - 1, gx + 2, gy + 3, col(rmp, 4), col(rmp, 0), top_hi=col(rmp, 5))


def draw_helipad(cv, cx, cy, r=10):
    """Crisp circular hospital rooftop helipad with yellow ring and bold 'H'."""
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            d = math.hypot(x - cx, y - cy)
            if d > r:
                continue
            if d > r - 1.2:
                cv.p(x, y, col('asphalt', 1))
            elif d > r - 2.6:
                cv.p(x, y, col('yellow', 4 if (x + y) % 2 == 0 else 5))
            else:
                cv.p(x, y, col('asphalt', 3 if hsh(x, y, 17) > 0.3 else 2))
    # Bold white/yellow H in center (scaled cleanly to radius)
    if r <= 9:
        cv.rect(cx - 3, cy - 4, cx - 1, cy + 5, col('white', 6))
        cv.rect(cx + 2, cy - 4, cx + 4, cy + 5, col('white', 6))
        cv.rect(cx - 1, cy - 1, cx + 2, cy + 1, col('white', 6))
    else:
        cv.rect(cx - 4, cy - 4, cx - 2, cy + 5, col('white', 6))
        cv.rect(cx + 3, cy - 4, cx + 5, cy + 5, col('white', 6))
        cv.rect(cx - 2, cy - 1, cx + 3, cy + 1, col('white', 6))
    # Corner perimeter safety lights
    for dx, dy in ((-r, -r + 2), (r, -r + 2), (-r, r - 2), (r, r - 2)):
        cv.p(cx + dx, cy + dy, col('yellow', 5))


def draw_glass_dome_lantern(cv, x0, y0, x1, y1):
    """Glowing top-3/4 pitched glass skylight dome/lantern crown for the public museum."""
    w = x1 - x0
    h = y1 - y0
    mid = (x0 + x1) // 2
    for y in range(y0, y1):
        ry = y - y0
        frac = ry / max(1, h - 1)
        # Taper top like a sculpted glass lantern hipped roof
        inset = int(round(12 * ((1.0 - frac) ** 1.25)))
        lx = x0 + inset
        rx_e = x1 - inset
        for x in range(lx, rx_e):
            rx = x - lx
            rw = max(1, rx_e - lx)
            # Structural bronze ribs
            is_rib = (rx in (0, rw - 1) or abs(x - mid) == 0
                      or (abs(x - mid) % 8 == 0 and ry >= 2))
            if ry == 0:
                cv.p(x, y, col('yellow', 4) if abs(x - mid) < 4 else col('steel', 2))
            elif ry == 1:
                cv.p(x, y, col('steel', 1) if rx in (0, rw - 1) else col('glass', 6))
            elif ry == h - 1:
                cv.p(x, y, col('darkwood', 1))
            elif ry == h - 2:
                cv.p(x, y, col('wood', 4))
            elif is_rib:
                cv.p(x, y, col('darkwood', 2 if x >= mid else 3))
            elif ry % 5 == 0:
                cv.p(x, y, col('steel', 2))
            else:
                # Upper panes reflect crisp bright sky; lower panes glow warm gold from atrium!
                diag = (x + y) % 10
                if ry >= h - 7:
                    cv.p(x, y, col('yellow', 5 if diag in (1, 2, 3) else 4))
                elif ry >= h - 10:
                    cv.p(x, y, col('cream', 5 if diag in (1, 2) else 4))
                else:
                    if diag in (1, 2):
                        cv.p(x, y, col('white', 6))
                    elif diag in (3, 4):
                        cv.p(x, y, col('glass', 6))
                    else:
                        cv.p(x, y, col('glass', 5 if x < mid else 4))


def draw_ground_plinth(cv, x0, x1, y0, y1, ramp='stone'):
    """Grounded architectural sidewalk plinth/base with subtle shadow line."""
    cv.rect(x0, y0, x1, y1, col(ramp, 3))
    cv.hline(x0, x1, y0, col(ramp, 5))
    cv.hline(x0, x1, y1 - 1, col('ink', 0))
    if y1 - y0 >= 3:
        cv.hline(x0, x1, y1 - 2, col(ramp, 1))
    for x in range(x0 + 8, x1 - 4, 12):
        cv.vline(x, y0 + 1, y1 - 1, col(ramp, 1))


# ---------------------------------------------------------------------------
# 1. mf-bldg-hi_apt_tower_varied (112x176)
# ---------------------------------------------------------------------------

def build_hi_apt_tower_varied():
    cv = Canvas(112, 176)
    # Recessed penthouse roof crown (y=0..34)
    # Main tower footprint: x=4..108; recessed penthouse crown x=12..100 at top
    cv.flat_roof(10, 8, 102, 34, deck_ramp='moss', deck_i=3, para_ramp='concrete', seed=101)
    # Penthouse glass railing along front edge of roof garden
    for x in range(14, 98):
        if x % 6 == 0:
            cv.vline(x, 26, 30, col('steel', 2))
        else:
            cv.p(x, 27, col('glass', 5))
            cv.p(x, 28, col('glass', 4))
    cv.hline(13, 99, 26, col('steel', 5))
    # Twin rooftop water tanks firmly grounded on left roof deck
    cv.roof_tank(15, 11)
    cv.roof_tank(27, 12)
    # Recessed penthouse stairwell & warm terrace pavilion in center
    cv.roof_penthouse(42, 6, w=18, h=16, ramp='cream')
    cv.window(44, 10, 50, 16, style='warm', frame='steel:1', sill=None)
    # Rooftop garden pergola & lush greenery on right
    cv.terrace_deck(64, 12, 97, 29, floor_ramp='floorwood', rail_ramp='wood', seed=102)
    cv.foliage_cluster(73, 14, 6, 4, ramp='foliage', seed=103, blossom='yellow:5')
    cv.foliage_cluster(88, 15, 7, 5, ramp='foliage', seed=104, blossom='pink:4')
    # Pergola beams overhead
    cv.hline(66, 95, 7, col('wood', 5))
    cv.hline(66, 95, 8, col('wood', 2))
    for px in (67, 75, 83, 93):
        cv.vline(px, 8, 15, col('wood', 3))
    # Setback parapet shoulder caps joining recessed penthouse to wider 6F facade
    cv.outline_box(4, 30, 12, 35, col('concrete', 4), col('concrete', 1), top_hi=col('concrete', 6))
    cv.outline_box(100, 30, 108, 35, col('concrete', 4), col('concrete', 1), top_hi=col('concrete', 6))

    # Main 6F..2F tower body (x=4..108, y=34..140)
    cv.tile_cladding(4, 34, 108, 140, ramp='kinari', base_i=4, cw=6, ch=5, seed=105)
    # Corner architectural vertical piers (warm stone)
    cv.rect(4, 34, 10, 140, col('concrete', 5))
    cv.vline(4, 34, 140, col('concrete', 1))
    cv.vline(5, 34, 140, col('concrete', 6))
    cv.vline(9, 34, 140, col('concrete', 3))
    cv.rect(102, 34, 108, 140, col('concrete', 4))
    cv.vline(102, 34, 140, col('concrete', 2))
    cv.vline(107, 34, 140, col('concrete', 0))
    # Subtle roof overhang drop shadow onto 6F
    cv.hline(4, 108, 34, col('concrete', 1))
    cv.hline(5, 107, 35, col('concrete', 2))

    # --- 6F (y=36..55): wide central glass balcony + flanking arched/warm rooms ---
    draw_rich_window(cv, 13, 38, 29, 51, variant='warm_curtain_orange', frame='steel:1', sill='concrete:5', seed=11)
    draw_balcony_unit(cv, 33, 36, 79, 54, win_var='warm_lamp', rail='glass', plant=True, laundry=False, ac=True, seed=12)
    draw_rich_window(cv, 83, 38, 99, 51, variant='sky_curtain_teal', frame='steel:1', sill='concrete:5', seed=13)
    # Floor slab trim
    cv.hline(4, 108, 55, col('concrete', 6))
    cv.hline(4, 108, 56, col('concrete', 2))

    # --- 5F (y=57..76): LEFT & RIGHT twin sunlit balconies + center bay window ---
    draw_balcony_unit(cv, 12, 57, 46, 75, win_var='sky_curtain_blue', rail='bars', plant=True, laundry=True, ac=False, seed=21)
    draw_rich_window(cv, 50, 59, 62, 72, variant='bookshelf', frame='wood:2', sill='cream:6', seed=22)
    draw_balcony_unit(cv, 66, 57, 100, 75, win_var='warm_curtain_red', rail='solid', plant=True, laundry=False, ac=True, seed=23)
    cv.hline(4, 108, 76, col('concrete', 6))
    cv.hline(4, 108, 77, col('concrete', 2))

    # --- 4F (y=78..100): Mid-tower horizontal mechanical belt + continuous planter terrace + varied rooms ---
    # Mechanical louvered belt band (y=78..85)
    cv.rect(4, 78, 108, 86, col('steel', 3))
    cv.hline(4, 108, 78, col('concrete', 6))
    cv.hline(4, 108, 85, col('steel', 1))
    for lx in range(10, 102, 8):
        cv.outline_box(lx, 79, lx + 6, 84, col('steel', 1), col('steel', 0))
        cv.hline(lx + 1, lx + 5, 80, col('steel', 4))
        cv.hline(lx + 1, lx + 5, 82, col('steel', 4))
    # 4F residential rooms below mechanical belt (y=86..101)
    draw_rich_window(cv, 13, 87, 31, 98, variant='blinds_half', frame='steel:1', sill='stone:5', seed=31)
    draw_rich_window(cv, 36, 87, 54, 98, variant='warm_lamp', frame='steel:1', sill='stone:5', seed=32)
    draw_rich_window(cv, 58, 87, 76, 98, variant='plant_sill', frame='steel:1', sill='stone:5', seed=33)
    draw_rich_window(cv, 81, 87, 99, 98, variant='blinds_warm', frame='steel:1', sill='stone:5', seed=34)
    # Cascading planter ledge at 4F base
    cv.planter_box(12, 97, 34, 102, flower='yellow:5', pot_ramp='stone')
    cv.planter_box(78, 97, 100, 102, flower='pink:4', pot_ramp='stone')
    cv.hline(4, 108, 101, col('concrete', 6))
    cv.hline(4, 108, 102, col('concrete', 2))

    # --- 3F (y=103..121): Asymmetric right-shifted balcony + warm wide living window left ---
    draw_rich_window(cv, 12, 105, 36, 118, variant='warm_curtain_red', frame='steel:1', sill='concrete:5', seed=41)
    draw_balcony_unit(cv, 40, 103, 72, 120, win_var='blinds_half', rail='glass', plant=False, laundry=True, ac=True, seed=42)
    draw_balcony_unit(cv, 75, 103, 100, 120, win_var='warm_lamp', rail='bars', plant=True, laundry=False, ac=False, seed=43)
    cv.hline(4, 108, 121, col('concrete', 6))
    cv.hline(4, 108, 122, col('concrete', 2))

    # --- 2F (y=123..140): Recessed warm wood-framed balconies left + bright reading lounge right ---
    draw_balcony_unit(cv, 12, 123, 44, 139, win_var='warm_curtain_orange', rail='solid', plant=True, laundry=False, ac=False, seed=51)
    draw_rich_window(cv, 48, 125, 68, 137, variant='sky_curtain_cream', frame='steel:1', sill='concrete:5', seed=52)
    draw_balcony_unit(cv, 72, 123, 100, 139, win_var='bookshelf', rail='glass', plant=True, laundry=False, ac=True, seed=53)

    # --- 1F Double-Height Stone Lobby & Planted Porch (y=140..176) ---
    draw_ashlar_wall(cv, 4, 140, 108, 174, ramp='stone', base_i=4, bw=10, bh=5, seed=108)
    # Bold cornice ledge separating residential floors from grand stone lobby
    cv.outline_box(2, 139, 110, 144, col('stone', 5), col('stone', 1), top_hi=col('cream', 6), bot_sh=col('stone', 2))
    # Stone columns flanking lobby glass
    draw_column(cv, 26, 144, 174, w=6, ramp='stone')
    draw_column(cv, 80, 144, 174, w=6, ramp='stone')
    # Cantilevered steel & glass entrance canopy over center
    cv.outline_box(32, 146, 80, 152, col('steel', 4), col('steel', 0), top_hi=col('coolwhite', 5), bot_sh=col('steel', 1))
    cv.hline(34, 78, 152, col('yellow', 5))  # Warm recessed downlights
    # Double-height glowing glass lobby doors
    cv.door_glass(36, 153, 76, 173, frame='wood:2', warm=True)
    # Warm brass lantern sconces on columns
    for lx in (28, 82):
        cv.rect(lx, 154, lx + 3, 158, col('yellow', 5))
        cv.p(lx + 1, 155, col('white', 6))
    # Left 1F: mailroom intercom wall & tall lobby window
    cv.outline_box(8, 148, 22, 162, col('steel', 4), col('steel', 1), top_hi=col('steel', 5))
    for my in range(150, 160, 3):
        for mx in range(10, 20, 3):
            cv.p(mx, my, col('steel', 1))
            cv.p(mx + 1, my, col('coolwhite', 5))
    # Right 1F: tall glowing concierge window
    draw_rich_window(cv, 89, 148, 104, 163, variant='warm_lamp', frame='wood:1', sill='stone:5', seed=61)
    # Planted stone porch beds flanking entrance
    cv.planter_box(6, 164, 24, 174, flower='red:4', pot_ramp='stone')
    cv.planter_box(88, 164, 106, 174, flower='yellow:5', pot_ramp='stone')
    cv.foliage_cluster(15, 164, 6, 4, ramp='foliage', seed=109, blossom='pink:4')
    cv.foliage_cluster(97, 164, 6, 4, ramp='foliage', seed=110, blossom='yellow:5')
    # Grounding stone porch steps & base
    draw_steps(cv, 33, 170, 79, 176, n_steps=2, ramp='stone')
    draw_ground_plinth(cv, 4, 33, 173, 176, ramp='stone')
    draw_ground_plinth(cv, 79, 108, 173, 176, ramp='stone')
    cv.edge_finish(top_y=34)
    return cv


# ---------------------------------------------------------------------------
# 2. mf-bldg-hi_glass_corp_tower (112x192)
# ---------------------------------------------------------------------------

def build_hi_glass_corp_tower():
    cv = Canvas(112, 192)
    # --- Expanded Top Flat Roof Deck (y=14..34, 20px tall) on Stepped-Back Upper Tower (x=6..94) ---
    # Aviation beacon spire rising cleanly from rear mechanical housing
    cv.vline(49, 1, 10, col('steel', 4))
    cv.vline(50, 2, 10, col('steel', 1))
    cv.rect(48, 0, 51, 3, col('red', 4))
    cv.p(49, 1, col('yellow', 5))

    # Full 20px-tall recessed sunlit gravel roof deck (x=6..94, y=14..34)
    cv.flat_roof(6, 14, 94, 34, deck_ramp='concrete', deck_i=4, para_ramp='steel', seed=201)
    # Enhanced north & left parapet cast shadows across the sunlit gravel slab
    cv.hline(8, 92, 17, col('concrete', 1))
    cv.hline(8, 92, 18, col('concrete', 2))
    cv.vline(8, 17, 30, col('concrete', 2))
    cv.vline(9, 18, 30, col('concrete', 3))
    # Sunlit gravel maintenance walkway & subtle drainage joints inside deck
    cv.stipple_rect(12, 23, 88, 29, 'concrete', 5, 4, 6, seed=202, rate=0.22)
    for jx in (28, 50, 72):
        cv.vline(jx, 18, 30, col('concrete', 3))

    # Compact inset mechanical penthouse tucked tightly against rear parapet (well inside front coping!)
    cv.outline_box(36, 9, 64, 21, col('tile', 4), col('steel', 0), top_hi=col('coolwhite', 5), bot_sh=col('tile', 1))
    for lx in (39, 47, 55):
        cv.outline_box(lx, 13, lx + 6, 19, col('steel', 1), col('steel', 0))
        cv.hline(lx + 1, lx + 5, 14, col('steel', 4))
        cv.hline(lx + 1, lx + 5, 16, col('steel', 4))
    # Cast shadow of mechanical housing onto sunlit gravel deck
    cv.hline(37, 65, 21, col('concrete', 1))
    cv.hline(38, 65, 22, col('concrete', 2))
    # Two smaller inset chiller/AC units well inside the front coping (y=19..25, leaving y=25..30 clear!)
    for ax in (13, 74):
        cv.outline_box(ax, 19, ax + 8, 25, col('white', 4), col('steel', 1), top_hi=col('white', 6))
        cv.rect(ax + 2, 21, ax + 5, 24, col('steel', 1))
        cv.p(ax + 3, 22, col('steel', 4))
        cv.hline(ax + 1, ax + 9, 25, col('concrete', 2))
    # Small roof access hatch tucked neatly on left-center gravel
    cv.outline_box(24, 21, 31, 26, col('steel', 3), col('steel', 0), top_hi=col('coolwhite', 5))
    cv.hline(25, 32, 26, col('concrete', 2))

    # Left parapet shoulder cap linking stepped roof to 6F facade
    cv.outline_box(4, 30, 8, 35, col('steel', 4), col('steel', 0), top_hi=col('coolwhite', 5))

    # --- 6F & 5F Stepped-Back Upper Tower (x=4..94, y=34..76) with Vertical Architectural Fins ---
    cv.rect(4, 34, 94, 76, col('steel', 1))
    # Sleek left & stepped-right aluminum structural corner piers
    cv.rect(4, 34, 9, 76, col('steel', 4))
    cv.vline(4, 34, 76, col('steel', 0))
    cv.vline(5, 34, 76, col('coolwhite', 5))
    cv.rect(90, 34, 94, 76, col('steel', 3))
    cv.vline(93, 34, 76, col('steel', 0))

    # --- 6F Executive Corner Suite (y=35..54): 3 asymmetric bays + bold protruding vertical fins ---
    # Bay 6A (x=9..33): Warm executive office with bookcase + desk + pendant lamp
    draw_curtain_glass_panel(cv, 9, 35, 33, 52, mode='warm_office', frame='steel:1', seed=210, diag_shift=1, split_mullion=False)
    for by in range(38, 49, 3):
        cv.hline(11, 16, by, col('wood', 1))
        cv.hline(11, 15, by + 1, col('red' if by % 2 == 0 else 'blue', 3))
    cv.rect(20, 46, 30, 50, col('darkwood', 1))  # Executive desk
    cv.rect(23, 43, 27, 46, col('steel', 1))     # High-back chair silhouette
    cv.hline(22, 28, 37, col('white', 6))        # Pendant light bar
    # Protruding vertical architectural fin #1 (x=33..37)
    cv.rect(33, 34, 37, 75, col('steel', 4))
    cv.vline(33, 34, 75, col('coolwhite', 5))
    cv.vline(36, 34, 75, col('steel', 0))
    # Bay 6B (x=37..65): Sky-reflective studio with indoor corner tree + sleek angled ceiling louver
    draw_curtain_glass_panel(cv, 37, 35, 65, 52, mode='sky', frame='steel:1', seed=211, diag_shift=5, split_mullion=False)
    cv.vline(51, 36, 51, col('steel', 2))
    cv.rect(41, 47, 45, 50, col('stone', 3))      # Planter pot
    cv.foliage_cluster(43, 44, 3, 3, ramp='foliage', seed=212)
    cv.hline(54, 62, 38, col('coolwhite', 5))     # Linear studio light
    cv.rect(55, 45, 62, 50, col('tile', 1))       # Studio drafting table
    # Protruding vertical architectural fin #2 (x=65..69)
    cv.rect(65, 34, 69, 75, col('steel', 4))
    cv.vline(65, 34, 75, col('coolwhite', 5))
    cv.vline(68, 34, 75, col('steel', 0))
    # Bay 6C (x=69..90): Corner lounge with half-blinds + warm floor lamp & sofa
    draw_curtain_glass_panel(cv, 69, 35, 90, 52, mode='blinds_top', frame='steel:1', seed=213, diag_shift=9, split_mullion=False)
    cv.rect(72, 46, 82, 50, col('wood', 2))       # Lounge sofa silhouette
    cv.vline(85, 43, 50, col('steel', 1))         # Standing floor lamp
    cv.rect(84, 41, 87, 44, col('yellow', 5))
    # Aluminum spandrel band between 6F and 5F
    cv.hline(9, 90, 52, col('coolwhite', 5))
    cv.hline(9, 90, 53, col('tile', 3))
    cv.hline(9, 90, 54, col('steel', 0))

    # --- 5F Tech Studio Floor (y=55..75): distinct bay interiors + right setback corner terrace! ---
    # Bay 5A (x=9..33): Cool sky glass + angled interior glass partition & potted fern
    draw_curtain_glass_panel(cv, 9, 55, 33, 73, mode='cool_lit', frame='steel:1', seed=220, diag_shift=3, split_mullion=False)
    cv.rect(12, 65, 19, 71, col('steel', 1))      # Server/cabinet silhouette
    cv.p(14, 67, col('green', 4))
    cv.p(16, 67, col('yellow', 5))
    cv.rect(23, 66, 30, 71, col('wood', 2))       # Side workstation
    cv.rect(25, 62, 29, 66, col('white', 6))      # Glowing monitor
    # Bay 5B (x=37..65): Wide open-plan tech bullpen with dual glowing monitors & warm task lamps
    draw_curtain_glass_panel(cv, 37, 55, 65, 73, mode='warm_office', frame='steel:1', seed=221, diag_shift=7, lit_color='orange', split_mullion=False)
    cv.rect(40, 67, 62, 71, col('darkwood', 1))   # Long studio bench desk
    for mx in (42, 50, 57):
        cv.rect(mx, 63, mx + 4, 67, col('coolwhite', 5))  # 3 glowing monitors
        cv.rect(mx + 1, 64, mx + 3, 66, col('glass', 5))
    cv.hline(43, 59, 57, col('white', 6))         # Overhead track fixture
    # Bay 5C (x=69..90): Shaded blinds-low + architectural wall art & reading nook
    draw_curtain_glass_panel(cv, 69, 55, 90, 73, mode='blinds_low', frame='steel:1', seed=222, diag_shift=11, split_mullion=False)
    cv.rect(72, 64, 80, 69, col('blue', 4))       # Framed chart/display
    cv.rect(82, 67, 88, 71, col('wood', 2))
    # Re-assert vertical fins crisply across 6F-5F spandrel
    for fx in (33, 65):
        cv.rect(fx, 34, fx + 4, 74, col('steel', 4))
        cv.vline(fx, 34, 74, col('coolwhite', 5))
        cv.vline(fx + 3, 34, 74, col('steel', 0))
    # Right 5F Corner Step-Back Terrace (x=94..108, y=67..76) with sunlit deck, glass rail & corner shrub!
    cv.rect(94, 69, 107, 74, col('floorwood', 4))
    cv.hline(94, 107, 69, col('floorwood', 2))
    cv.foliage_cluster(101, 66, 4, 4, ramp='foliage', seed=225, blossom='yellow:5')
    cv.hline(94, 108, 70, col('coolwhite', 5))
    for rx in range(94, 108):
        for ry in range(71, 74):
            cv.p(rx, ry, col('steel', 2) if rx in (94, 100, 107) else col('glass', 4))
    cv.hline(94, 108, 74, col('steel', 3))
    cv.hline(4, 108, 73, col('coolwhite', 5))
    cv.hline(4, 108, 74, col('tile', 2))
    cv.hline(4, 108, 75, col('steel', 0))

    # --- Full-Width Lower Tower Body (x=4..108, y=76..152) ---
    cv.rect(4, 76, 108, 152, col('steel', 1))
    cv.rect(4, 76, 8, 152, col('steel', 4))
    cv.vline(4, 76, 152, col('steel', 0))
    cv.vline(5, 76, 152, col('coolwhite', 5))
    cv.rect(104, 76, 108, 152, col('steel', 3))
    cv.vline(107, 76, 152, col('steel', 0))

    # --- 4F MID-HEIGHT SKY-GARDEN TERRACE NOTCH (y=76..106) ---
    # Deep shadowed architectural setback carved across the tower!
    cv.rect(8, 76, 104, 105, col('steel', 0))
    # Structural corner steel columns & center pier framing the open sky-garden notch
    cv.rect(8, 76, 14, 105, col('steel', 4))
    cv.vline(9, 76, 105, col('coolwhite', 5))
    cv.rect(98, 76, 104, 105, col('steel', 3))
    cv.rect(53, 76, 59, 105, col('steel', 3))
    cv.vline(54, 76, 105, col('steel', 5))
    # Recessed ceiling soffit shadow
    cv.hline(14, 98, 76, col('steel', 0))
    cv.hline(14, 98, 77, col('steel', 1))
    # Warm-lit sky-lounge glass wall recessed in back of terrace (y=78..93)
    draw_curtain_glass_panel(cv, 15, 78, 52, 93, mode='warm_office', frame='wood:1', seed=230, diag_shift=1)
    cv.hline(20, 32, 81, col('white', 6))   # Cafe pendant glow inside lounge
    cv.rect(36, 86, 48, 91, col('wood', 2)) # Lounge counter
    draw_curtain_glass_panel(cv, 60, 78, 97, 93, mode='cool_lit', frame='wood:1', seed=231, diag_shift=4)
    for k in range(10):
        cv.p(65 + k, 91 - k, col('steel', 2))  # Interior diagonal mezzanine stair rail
    # 6px Walkable Recessed Sunlit Wood Deck Floor (y=93..99) clearly visible behind glass rail!
    for y in range(93, 99):
        for x in range(14, 98):
            if y == 93:
                cv.p(x, y, col('floorwood', 1))  # Back-wall shadow on deck
            elif y == 94:
                cv.p(x, y, col('floorwood', 2))
            elif y == 96:
                cv.p(x, y, col('floorwood', 3 if (x % 7 == 0) else 4))
            else:
                cv.p(x, y, col('floorwood', 5 if (x % 9 != 0) else 4))
    # Crisp cast plant shadows directly onto walkable deck floor BEFORE bushes!
    for px, rx in ((24, 7), (43, 5), (72, 8), (89, 6)):
        cv.hline(px - rx + 1, px + rx + 1, 96, col('floorwood', 1))
        cv.hline(px - rx + 2, px + rx, 97, col('floorwood', 2))
        cv.outline_box(px - rx + 2, 93, px + rx - 1, 97, col('stone', 4), col('stone', 1), top_hi=col('stone', 5))
    # Lush sky-garden bushes grounded INSIDE the walkable terrace behind the rail!
    cv.foliage_cluster(24, 89, 7, 5, ramp='foliage', seed=232, blossom='yellow:5')
    cv.foliage_cluster(43, 90, 5, 4, ramp='foliage', seed=233)
    cv.foliage_cluster(72, 89, 8, 5, ramp='foliage', seed=234, blossom='pink:4')
    cv.foliage_cluster(89, 90, 6, 4, ramp='foliage', seed=235)
    # Crisp glass sky-garden balustrade across front of terrace (y=99..104)
    cv.hline(14, 98, 99, col('coolwhite', 5))
    for y in range(100, 104):
        for x in range(14, 98):
            if x % 8 == 0:
                cv.p(x, y, col('steel', 2))
            else:
                cv.p(x, y, col('glass', 5 if (x + y) % 5 == 0 else 4))
    # Heavy bronze/steel fascia below sky-garden
    cv.hline(4, 108, 104, col('cedar', 5))
    cv.hline(4, 108, 105, col('wood', 3))
    cv.hline(4, 108, 106, col('steel', 0))

    # --- 3F Executive Conference Floor (y=107..129): Double-Wide Panoramic Conference Bay Center! ---
    # Left narrow office bay (x=8..26) with half-blinds & bookshelf
    draw_curtain_glass_panel(cv, 8, 107, 26, 127, mode='blinds_top', frame='steel:1', seed=240, diag_shift=2, split_mullion=False)
    cv.rect(11, 120, 17, 125, col('wood', 2))
    cv.rect(19, 118, 24, 125, col('steel', 2))
    # Structural mullions framing the grand double-wide conference bay
    cv.rect(26, 107, 29, 127, col('steel', 4))
    cv.vline(26, 107, 127, col('coolwhite', 5))
    cv.vline(28, 107, 127, col('steel', 0))
    # Double-wide executive conference glass bay (x=29..83, 54px panoramic span!)
    draw_curtain_glass_panel(cv, 29, 107, 83, 127, mode='warm_office', frame='steel:1', seed=241, diag_shift=6, split_mullion=False)
    # Slender glass-only hairlines (no heavy column splitting the panoramic bay)
    cv.vline(47, 108, 126, col('steel', 2))
    cv.vline(65, 108, 126, col('steel', 2))
    # Executive conference interior storytelling: backlit wall screen + long boardroom table + chairs!
    cv.outline_box(48, 111, 64, 119, col('coolwhite', 5), col('steel', 1))
    cv.hline(50, 62, 113, col('blue', 4))       # Chart bar on presentation screen
    cv.hline(50, 58, 115, col('teal', 4))
    cv.hline(50, 60, 117, col('orange', 4))
    cv.hline(36, 76, 109, col('white', 6))      # Long linear overhead conference light
    cv.rect(35, 122, 77, 126, col('darkwood', 1))  # Long walnut conference table
    cv.hline(36, 76, 122, col('cedar', 5))         # Sunlit polished tabletop sheen
    for chx in (38, 46, 54, 62, 70):
        cv.rect(chx, 119, chx + 3, 122, col('steel', 1))  # Conference chair backs
    cv.rect(83, 107, 86, 127, col('steel', 4))
    cv.vline(83, 107, 127, col('coolwhite', 5))
    cv.vline(85, 107, 127, col('steel', 0))
    # Right narrow office bay (x=86..104) with sky reflection & corner ficus plant
    draw_curtain_glass_panel(cv, 86, 107, 104, 127, mode='sky', frame='steel:1', seed=242, diag_shift=10, split_mullion=False)
    cv.rect(90, 122, 94, 125, col('stone', 4))
    cv.foliage_cluster(92, 119, 3, 3, ramp='foliage', seed=243)
    cv.rect(97, 121, 102, 125, col('wood', 2))
    # Spandrel band between 3F and 2F
    cv.hline(8, 104, 127, col('coolwhite', 5))
    cv.hline(8, 104, 128, col('tile', 3))
    cv.hline(8, 104, 129, col('steel', 0))

    # --- 2F Mezzanine Gallery Floor (y=130..151): 5 Narrow Rhythmic Bays with Unique Silhouettes! ---
    b2_specs = [
        (8, 27, 'warm_office', 1),
        (27, 46, 'sky', 5),
        (46, 66, 'cool_lit', 9),
        (66, 85, 'blinds_low', 13),
        (85, 104, 'sky', 3),
    ]
    for i, (bx0, bx1, md, dsh) in enumerate(b2_specs):
        draw_curtain_glass_panel(cv, bx0, 130, bx1, 150, mode=md, frame='steel:1',
                                 seed=250 + i, diag_shift=dsh, split_mullion=False)
    # Distinct interior silhouettes per 2F bay
    # Bay 2A: hanging warm gallery lamps & sofa
    cv.hline(13, 21, 133, col('white', 6))
    cv.rect(11, 144, 24, 148, col('wood', 2))
    # Bay 2B: diagonal escalator truss visible through tall glass
    for k in range(13):
        cv.p(29 + k, 148 - k, col('steel', 4))
        cv.p(30 + k, 148 - k, col('steel', 1))
    # Bay 2C (center atrium void): glowing twin sculptural chandelier rings
    cv.rect(51, 134, 61, 136, col('yellow', 5))
    cv.rect(53, 138, 59, 140, col('white', 6))
    cv.vline(56, 131, 138, col('steel', 2))
    # Bay 2D: lower blinds + bright monitor desk
    cv.rect(70, 143, 81, 148, col('darkwood', 1))
    cv.rect(73, 140, 78, 143, col('white', 6))
    # Bay 2E: framed warm art canvas on interior gallery wall
    cv.outline_box(90, 136, 99, 144, col('orange', 4), col('wood', 1), top_hi=col('yellow', 5))

    # Bronze cornice separating tower from grand bronze-framed 1F lobby
    cv.outline_box(2, 150, 110, 155, col('wood', 4), col('darkwood', 1), top_hi=col('cedar', 6), bot_sh=col('darkwood', 2))

    # --- 1F Grand Bronze-Framed Glass Lobby & Cantilevered Marquee (y=155..192) ---
    draw_ashlar_wall(cv, 4, 155, 108, 190, ramp='flagstone', base_i=3, bw=10, bh=5, seed=260)
    # Tall bronze-framed curtain glass on left & right wings
    draw_curtain_glass_panel(cv, 8, 157, 30, 188, mode='warm_office', frame='wood:1', seed=261, diag_shift=2)
    draw_curtain_glass_panel(cv, 82, 157, 104, 188, mode='warm_office', frame='wood:1', seed=262, diag_shift=6)
    # Bronze pilasters
    for px in (30, 78):
        cv.rect(px, 155, px + 4, 190, col('cedar', 4))
        cv.vline(px, 155, 190, col('darkwood', 1))
        cv.vline(px + 1, 155, 190, col('cedar', 6))
        cv.vline(px + 3, 155, 190, col('wood', 1))
    # Cantilevered projecting bronze-and-glass marquee over main entrance
    cv.outline_box(24, 158, 88, 165, col('wood', 4), col('darkwood', 0), top_hi=col('yellow', 5), bot_sh=col('darkwood', 2))
    # Glowing marquee soffit lights
    for lx in range(32, 82, 8):
        cv.hline(lx, lx + 4, 165, col('white', 6))
        cv.hline(lx + 1, lx + 3, 166, col('yellow', 5))
    # Grand revolving/automatic bronze glass doors in center
    cv.door_glass(36, 167, 76, 189, frame='cedar:3', warm=True)
    # Sleek modern granite planters flanking lobby
    cv.planter_box(6, 179, 24, 190, flower='white:6', pot_ramp='flagstone')
    cv.planter_box(88, 179, 106, 190, flower='yellow:5', pot_ramp='flagstone')
    draw_ground_plinth(cv, 4, 108, 189, 192, ramp='pavement')
    cv.edge_finish(top_y=34)
    return cv


# ---------------------------------------------------------------------------
# 3. mf-bldg-hi_setback_depato (144x160)
# ---------------------------------------------------------------------------

def build_hi_setback_depato():
    cv = Canvas(144, 160)
    # --- 5F Stepped-Back Rooftop Amusement / Garden Terrace (y=0..42) ---
    cv.flat_roof(10, 14, 134, 42, deck_ramp='moss', deck_i=3, para_ramp='cream', seed=301)
    # Sunlit central paved promenade on rooftop
    cv.stipple_rect(44, 22, 104, 37, 'cream', 4, 3, 5, seed=302, rate=0.16)
    # Mini Ferris wheel on left terrace!
    draw_ferris_wheel(cv, 32, 16, r=12)
    # Rooftop red billboard at top-center with crisp 5px pixel lettering: DEPATO
    cv.outline_box(49, 4, 101, 15, col('red', 3), col('red', 0), top_hi=col('red', 5), bot_sh=col('red', 2))
    cv.rect(51, 6, 99, 13, col('red', 1))
    tw_dep = measure_pixel_text('DEPATO', FONT_4X5, spacing=2)
    draw_pixel_text(cv, 51 + (48 - tw_dep) // 2, 7, 'DEPATO', 'yellow:5', font=FONT_4X5, spacing=2)
    cv.hline(50, 102, 15, col('ink', 1))
    cv.vline(56, 15, 22, col('steel', 2))
    cv.vline(92, 15, 22, col('steel', 2))
    # Wooden pergola & colorful striped cafe parasols in center-right
    cv.rect(62, 20, 88, 22, col('wood', 5))
    for px in (64, 74, 85):
        cv.vline(px, 22, 34, col('wood', 3))
    # Striped parasols
    cv.awning(50, 26, 63, 32, ramp_a='red', ramp_b='white', stripe_w=2)
    cv.vline(56, 32, 36, col('wood', 2))
    cv.awning(69, 27, 82, 33, ramp_a='blue', ramp_b='white', stripe_w=2)
    cv.vline(75, 33, 36, col('wood', 2))
    # Rooftop souvenir/snack kiosk with green awning on right
    cv.outline_box(98, 16, 126, 35, col('cream', 5), col('wood', 1), top_hi=col('white', 6))
    cv.awning(96, 20, 128, 26, ramp_a='green', ramp_b='white', stripe_w=3)
    cv.window(103, 27, 114, 34, style='warm', frame='wood:2', sill=None)
    cv.door_wood(116, 26, 124, 35, ramp='wood', glass_top=True)
    # Rooftop lush corner trees
    cv.foliage_cluster(18, 30, 5, 4, ramp='foliage', seed=304, blossom='pink:4')
    cv.foliage_cluster(91, 29, 5, 4, ramp='foliage', seed=305, blossom='yellow:5')
    # Setback parapet shoulder caps joining 5F terrace to wider 4F facade
    cv.outline_box(4, 37, 12, 42, col('cream', 4), col('stone', 1), top_hi=col('white', 6))
    cv.outline_box(132, 37, 140, 42, col('cream', 4), col('stone', 1), top_hi=col('white', 6))

    # --- 4F–3F Warm Terracotta / Stone Upper Facade (x=4..140, y=42..98) ---
    cv.brick_wall(4, 42, 140, 98, ramp='rooftile', base_i=4, course_h=4, brick_w=8, seed=306)
    # Ornate cream limestone vertical pilasters framing bays
    for px in (4, 36, 68, 100, 134):
        pw = 6
        cv.rect(px, 42, px + pw, 98, col('cream', 4))
        cv.vline(px, 42, 98, col('cream', 1))
        cv.vline(px + 1, 42, 98, col('cream', 6))
        cv.vline(px + pw - 1, 42, 98, col('cream', 2))
    # Heavy stone cornice under rooftop terrace
    cv.outline_box(2, 40, 142, 45, col('cream', 5), col('stone', 1), top_hi=col('white', 6), bot_sh=col('stone', 2))

    # 4F Display/Department Windows (y=48..66) — rich varied warm retail scenes
    w4_vars = ['warm_curtain_orange', 'bookshelf', 'warm_lamp', 'blinds_warm']
    for i, bx in enumerate((13, 45, 77, 109)):
        draw_rich_window(cv, bx, 48, bx + 20, 65, variant=w4_vars[i], frame='wood:1', sill='cream:6', seed=310 + i)
        # Cute interior retail display pops (colored mannequins/merchandise silhouettes)
        mc = ('red', 'blue', 'yellow', 'pink')[i]
        cv.rect(bx + 4, 57, bx + 8, 63, col(mc, 4))
        cv.p(bx + 6, 55, col('cream', 5))

    # Horizontal belt molding between 4F & 3F
    cv.outline_box(4, 68, 140, 72, col('cream', 5), col('stone', 1), top_hi=col('white', 6))

    # 3F Windows with festive striped mini-awnings (y=74..94)
    w3_vars = ['warm_lamp', 'sky_curtain_teal', 'warm_curtain_red', 'plant_sill']
    for i, bx in enumerate((13, 45, 77, 109)):
        draw_rich_window(cv, bx, 77, bx + 20, 93, variant=w3_vars[i], frame='wood:1', sill='cream:6', seed=320 + i)
        cv.awning(bx - 1, 74, bx + 21, 79,
                  ramp_a=('red', 'teal', 'orange', 'blue')[i], ramp_b='white', stripe_w=3)

    # Huge vertical colorful depato signboards mounted on left & right facade edges: SALE / MART
    draw_vertical_text_banner(cv, 0, 44, 12, 96, 'SALE', ramp='blue', back_ramp='navy', text_color='yellow:5')
    draw_vertical_text_banner(cv, 132, 44, 144, 96, 'MART', ramp='red', back_ramp='red', text_color='white:6')

    # --- 2F–1F Ornate Cream Stone & Glass Ground Arcade (y=98..160) ---
    draw_ashlar_wall(cv, 4, 98, 140, 158, ramp='cream', base_i=5, bw=10, bh=5, seed=340)
    cv.outline_box(2, 96, 142, 101, col('cream', 6), col('stone', 1), top_hi=col('white', 6), bot_sh=col('stone', 2))

    # 2F Arched Mezzanine Windows + Festive Vertical Hanging Cloth Banners!
    draw_arched_window(cv, 14, 104, 34, 122, variant='warm_lamp', frame='wood:2', trim='cream:6', sill='stone:5', seed=341)
    draw_arched_window(cv, 52, 104, 70, 122, variant='warm_curtain_orange', frame='wood:2', trim='cream:6', sill='stone:5', seed=342)
    draw_arched_window(cv, 74, 104, 92, 122, variant='sky_curtain_cream', frame='wood:2', trim='cream:6', sill='stone:5', seed=343)
    draw_arched_window(cv, 110, 104, 130, 122, variant='bookshelf', frame='wood:2', trim='cream:6', sill='stone:5', seed=344)
    # Colorful hanging sale/season cloth banners on piers
    draw_hanging_banner(cv, 38, 102, 47, 124, ramp='red', accent='yellow:5', seed=345)
    draw_hanging_banner(cv, 97, 102, 106, 124, ramp='teal', accent='cream:6', seed=346)

    # 1F Grand Central Marquee Entrance + Flanking Colorful Display Windows (y=126..158)
    # Central projecting ornate marquee canopy with crisp 5px pixel lettering: SHOP
    cv.outline_box(46, 124, 98, 135, col('red', 3), col('red', 0), top_hi=col('yellow', 5), bot_sh=col('red', 2))
    cv.rect(48, 126, 96, 133, col('red', 1))
    tw_shop = measure_pixel_text('SHOP', FONT_4X5, spacing=3)
    draw_pixel_text(cv, 48 + (48 - tw_shop) // 2, 127, 'SHOP', 'yellow:5', font=FONT_4X5, spacing=3)
    # Crisp gilded accent pips flanking SHOP
    cv.p(52, 129, col('yellow', 4))
    cv.p(91, 129, col('yellow', 4))
    # Warm marquee soffit light bulbs
    for lx in range(50, 94, 4):
        cv.p(lx, 135, col('white', 6))
        cv.p(lx + 1, 135, col('yellow', 5))
    # Grand double brass-and-glass main entrance doors
    cv.door_glass(52, 136, 92, 157, frame='yellow:3', warm=True)
    # Left & right wide shopfront display windows with colorful merchandise!
    for side, (wx0, wx1) in enumerate([(8, 42), (102, 136)]):
        cv.outline_box(wx0, 131, wx1, 155, col('glass', 1), col('wood', 1))
        cv.rect(wx0 + 1, 132, wx1 - 1, 154, col('orange', 4))
        cv.hline(wx0 + 1, wx1 - 1, 132, col('yellow', 5))
        cv.rect(wx0 + 1, 148, wx1 - 1, 154, col('wood', 3))
        # Display mannequins / gift stacks inside windows
        if side == 0:
            cv.rect(wx0 + 5, 138, wx0 + 11, 148, col('red', 4))
            cv.rect(wx0 + 7, 135, wx0 + 9, 138, col('cream', 6))
            cv.rect(wx0 + 16, 139, wx0 + 23, 148, col('blue', 4))
            cv.rect(wx0 + 18, 136, wx0 + 21, 139, col('cream', 6))
            cv.rect(wx0 + 26, 142, wx0 + 31, 148, col('yellow', 5))
        else:
            cv.rect(wx0 + 4, 140, wx0 + 11, 148, col('pink', 4))
            cv.rect(wx0 + 14, 137, wx0 + 20, 148, col('teal', 4))
            cv.rect(wx0 + 23, 141, wx0 + 30, 148, col('orange', 5))
        # Diagonal glass glare streak over display
        for k in range(14):
            cv.p(wx0 + 3 + k, 133 + k, col('white', 6))
            cv.p(wx0 + 4 + k, 133 + k, col('glass', 6))
        # Striped shopfront awning over display window
        cv.awning(wx0 - 1, 126, wx1 + 1, 132, ramp_a='red' if side == 0 else 'blue', ramp_b='white', stripe_w=3)

    # Decorative stone plinth & planters
    cv.planter_box(43, 149, 50, 158, flower='red:4', pot_ramp='stone')
    cv.planter_box(94, 149, 101, 158, flower='yellow:5', pot_ramp='stone')
    draw_ground_plinth(cv, 4, 140, 157, 160, ramp='stone')
    cv.edge_finish(top_y=42)
    return cv


# ---------------------------------------------------------------------------
# 4. mf-bldg-civic_city_hall_clock (144x144)
# ---------------------------------------------------------------------------

def build_civic_city_hall_clock():
    cv = Canvas(144, 144)
    # Fluttering civic flagpole rising from central clock gable peak
    draw_flagpole(cv, 71, 0, 16, flag_ramp='blue', stripe_ramp='yellow', flag_right=True)

    # Main flanking hipped slate/teal roofs (y=28..56)
    draw_hipped_roof(cv, 4, 28, 140, 56, ramp='teal', ridge_inset=12, seed=401)
    # Dormer accent vents on left & right roof slopes
    for dx in (24, 110):
        cv.outline_box(dx, 35, dx + 10, 46, col('cream', 5), col('stone', 1), top_hi=col('white', 6))
        cv.window(dx + 2, 38, dx + 8, 44, style='warm', frame='wood:1', sill=None)
        cv.hline(dx - 1, dx + 11, 35, col('teal', 1))

    # Central projecting gabled clock tower rising proud above the roof (x=48..96, y=12..60)
    # Triangular pitched pediment roof cap
    for dy in range(18):
        y = 12 + dy
        span = 3 + int(dy * 1.35)
        lx = max(46, 72 - span)
        rx = min(98, 72 + span)
        cv.hline(lx, rx, y, col('teal', 3 if dy % 3 != 0 else 4))
        cv.p(lx, y, col('teal', 0))
        cv.p(lx + 1, y, col('cream', 6))  # Limestone gable bargeboard
        cv.p(rx - 1, y, col('teal', 0))
        cv.p(rx - 2, y, col('cream', 4))
    # Clock tower limestone face
    draw_ashlar_wall(cv, 50, 30, 94, 58, ramp='cream', base_i=5, bw=8, bh=5, seed=402)
    cv.vline(50, 30, 58, col('stone', 1))
    cv.vline(51, 30, 58, col('white', 6))
    cv.vline(93, 30, 58, col('stone', 0))
    # Heavy classical cornice under eaves (drawn BEFORE clock tower lower trim so clock sits cleanly above!)
    cv.outline_box(2, 55, 142, 61, col('cream', 5), col('stone', 1), top_hi=col('white', 6), bot_sh=col('stone', 2))
    # Glowing round cream clock face centered cleanly unobstructed inside the clock tower!
    draw_clock_face(cv, 72, 43, r=9)
    # Sculpted stone clock sill resting neatly on the cornice
    cv.outline_box(54, 54, 90, 58, col('cream', 6), col('stone', 1), top_hi=col('white', 6))

    # --- Main Limestone Facade (x=4..140, y=61..136) ---
    draw_ashlar_wall(cv, 4, 61, 140, 136, ramp='cream', base_i=4, bw=10, bh=5, seed=403)
    # Corner stone quoins
    for y in range(62, 134, 8):
        cv.outline_box(4, y, 10, y + 4, col('stone', 5), col('stone', 2), top_hi=col('cream', 6))
        cv.outline_box(134, y, 140, y + 4, col('stone', 4), col('stone', 1))

    # 2F Tall Arched Civic Windows (y=66..88) — varied warm/sky/curtains
    win2 = [
        (14, 28, 'warm_curtain_red'),
        (32, 46, 'sky_curtain_blue'),
        (54, 68, 'warm_lamp'),
        (76, 90, 'warm_lamp'),
        (98, 112, 'blinds_half'),
        (116, 130, 'sky_curtain_cream'),
    ]
    for i, (wx0, wx1, var) in enumerate(win2):
        draw_arched_window(cv, wx0, 66, wx1, 88, variant=var, frame='wood:1', trim='cream:6', sill='stone:5', seed=410 + i)
    # Mid-floor classical belt cornice
    cv.outline_box(4, 92, 140, 96, col('stone', 5), col('stone', 1), top_hi=col('white', 6))

    # 1F Wings + Grand Central Colonnade Portico (y=96..138)
    # Left & right wing windows
    draw_rich_window(cv, 14, 101, 28, 118, variant='blinds_warm', frame='wood:1', sill='stone:5', seed=420)
    draw_rich_window(cv, 32, 101, 45, 118, variant='sky_curtain_teal', frame='wood:1', sill='stone:5', seed=421)
    draw_rich_window(cv, 99, 101, 112, 118, variant='warm_lamp', frame='wood:1', sill='stone:5', seed=422)
    draw_rich_window(cv, 116, 101, 130, 118, variant='blinds_half', frame='wood:1', sill='stone:5', seed=423)

    # Central projecting colonnade portico (x=48..96, y=94..132)
    cv.outline_box(47, 94, 97, 100, col('cream', 5), col('stone', 1), top_hi=col('white', 6), bot_sh=col('stone', 2))
    # Deep recessed portico shadow behind columns
    cv.rect(50, 100, 94, 131, col('stone', 2))
    # Grand bronze-and-glass double civic doors glowing warmly
    cv.door_glass(61, 105, 83, 130, frame='wood:1', warm=True)
    # 4 Classical fluted limestone columns
    for cx in (49, 57, 81, 89):
        draw_column(cv, cx, 100, 131, w=5, ramp='cream')

    # Broad Grand Stone Front Steps cascading down to sidewalk (y=130..144)
    draw_steps(cv, 48, 130, 96, 144, n_steps=4, ramp='stone')
    # Flanking stone cheek walls with classic glowing globe lamps
    for lx in (42, 96):
        cv.outline_box(lx, 129, lx + 6, 143, col('stone', 5), col('stone', 1), top_hi=col('cream', 6))
        cv.rect(lx + 1, 124, lx + 5, 129, col('yellow', 5))
        cv.p(lx + 2, 125, col('white', 6))
        cv.hline(lx + 1, lx + 5, 129, col('steel', 1))

    # Flanking manicured shrubs along 1F stone base
    cv.planter_box(8, 126, 39, 138, flower='yellow:5', pot_ramp='stone')
    cv.planter_box(105, 126, 136, 138, flower='red:4', pot_ramp='stone')
    draw_ground_plinth(cv, 4, 43, 138, 144, ramp='stone')
    draw_ground_plinth(cv, 101, 140, 138, 144, ramp='stone')
    cv.edge_finish(top_y=55)
    return cv


# ---------------------------------------------------------------------------
# 5. mf-bldg-civic_general_hospital (144x144)
# ---------------------------------------------------------------------------

def build_civic_general_hospital():
    cv = Canvas(144, 144)
    # --- Roof with Helipad "H" & Elevator Penthouse (y=4..34) ---
    cv.flat_roof(4, 4, 140, 34, deck_ramp='concrete', deck_i=4, para_ramp='coolwhite', seed=501)
    # Circular Helipad shifted north on left-center roof deck — 100% clear of parapet & railing!
    draw_helipad(cv, 36, 17, r=9)
    # Rooftop helipad windsock mast + clean glass skylight vent between helipad & penthouse
    cv.vline(55, 7, 21, col('steel', 4))
    cv.rect(56, 8, 62, 11, col('orange', 4))
    cv.vline(58, 8, 11, col('white', 6))
    cv.vline(60, 8, 11, col('red', 4))
    cv.outline_box(66, 13, 83, 23, col('glass', 4), col('steel', 1), top_hi=col('glass', 6))
    cv.vline(74, 14, 22, col('steel', 2))
    # Elevator penthouse on right-center + AC row
    cv.roof_penthouse(88, 2, w=22, h=20, ramp='coolwhite')
    cv.rect(91, 6, 107, 10, col('teal', 4))  # Clean hospital penthouse trim stripe
    cv.roof_ac(114, 13)
    cv.roof_ac(125, 13)
    # Rooftop safety fence railing terminated cleanly to the right of the helipad circle (ZERO overlap!)
    for x in range(51, 86, 5):
        cv.vline(x, 26, 30, col('steel', 3))
    cv.hline(51, 86, 27, col('coolwhite', 5))

    # --- 4F–2F Bright Coolwhite/Cream Ceramic Tile Facade (x=4..140, y=34..108) ---
    cv.tile_cladding(4, 34, 140, 108, ramp='coolwhite', base_i=4, cw=6, ch=5, seed=502)
    # Crisp teal/aqua horizontal clinical accent stripes per floor
    cv.hline(4, 140, 34, col('steel', 1))
    cv.hline(4, 140, 35, col('teal', 4))
    cv.hline(4, 140, 58, col('teal', 3))
    cv.hline(4, 140, 59, col('coolwhite', 5))
    cv.hline(4, 140, 83, col('teal', 3))
    cv.hline(4, 140, 84, col('coolwhite', 5))

    # Right vertical stairwell glass tower strip (x=122..136, y=38..105)
    draw_curtain_glass_panel(cv, 122, 38, 136, 56, mode='cool_lit', frame='steel:1', seed=503, diag_shift=1)
    draw_curtain_glass_panel(cv, 122, 61, 136, 81, mode='sky', frame='steel:1', seed=504, diag_shift=4)
    draw_curtain_glass_panel(cv, 122, 86, 136, 105, mode='warm_office', frame='steel:1', seed=505, diag_shift=7)

    # Bold Red Medical Cross Emblem Plaque mounted proudly on upper center-left facade (x=54..72, y=39..57)
    cv.outline_box(54, 38, 74, 56, col('white', 6), col('steel', 2), top_hi=col('white', 6), bot_sh=col('coolwhite', 3))
    cv.rect(61, 40, 67, 54, col('red', 3))
    cv.rect(57, 44, 71, 50, col('red', 3))
    cv.rect(62, 41, 66, 53, col('red', 4))
    cv.rect(58, 45, 70, 49, col('red', 4))

    # 4F Patient Room Windows (y=40..54) — zero cloning!
    f4_w = [(10, 26, 'patient', 1), (31, 47, 'blinds_half', 2), (79, 95, 'patient', 3), (100, 116, 'warm_lamp', 4)]
    for x0, x1, v, sd in f4_w:
        draw_rich_window(cv, x0, 40, x1, 54, variant=v, frame='steel:2', sill='coolwhite:5', seed=510 + sd)

    # 3F Patient Room Windows (y=63..79) — different layout, flower boxes & varied curtains
    f3_w = [
        (10, 26, 'blinds_warm', 5),
        (31, 47, 'patient', 6),
        (53, 75, 'sky_curtain_teal', 7),  # Wide nursing station window in center
        (80, 96, 'plant_sill', 8),
        (101, 117, 'patient', 9),
    ]
    for x0, x1, v, sd in f3_w:
        draw_rich_window(cv, x0, 63, x1, 79, variant=v, frame='steel:2', sill='coolwhite:5', seed=520 + sd)

    # 2F Outpatient & Clinic Windows (y=88..104) — warm examination & waiting rooms
    f2_w = [
        (10, 30, 'warm_lamp', 10),
        (35, 51, 'patient', 11),
        (56, 74, 'blinds_half', 12),
        (79, 97, 'warm_curtain_orange', 13),
        (102, 117, 'sky_curtain_blue', 14),
    ]
    for x0, x1, v, sd in f2_w:
        draw_rich_window(cv, x0, 88, x1, 104, variant=v, frame='steel:2', sill='coolwhite:5', seed=530 + sd)

    # --- 1F Ambulance/Emergency Bay (left) + Main Glass Canopy (center) + Clinic Wing (right) (y=108..144) ---
    draw_ashlar_wall(cv, 4, 108, 140, 142, ramp='white', base_i=4, bw=10, bh=5, seed=540)
    cv.hline(4, 140, 108, col('steel', 1))

    # Left: Sheltered Ambulance / Emergency Awning Bay (x=5..53, y=107..142) with crisp 5px 'ER'
    cv.outline_box(5, 107, 53, 118, col('red', 3), col('red', 0), top_hi=col('red', 5), bot_sh=col('red', 2))
    cv.rect(11, 109, 47, 116, col('red', 1))
    tw_er = measure_pixel_text('ER', FONT_4X5, spacing=3)
    draw_pixel_text(cv, 11 + (36 - tw_er) // 2, 110, 'ER', 'white:6', font=FONT_4X5, spacing=3)
    # Recessed shaded emergency garage bay + yellow/dark safety jamb pillars
    cv.rect(8, 118, 50, 141, col('asphalt', 1))
    cv.rect(10, 119, 48, 139, col('asphalt', 2))
    for hy in range(119, 140, 4):
        cv.rect(8, hy, 10, hy + 2, col('yellow', 5))
        cv.rect(48, hy, 50, hy + 2, col('yellow', 5))
    # Peeking parked ambulance front inside sheltered bay!
    cv.outline_box(16, 121, 42, 138, col('white', 5), col('steel', 1), top_hi=col('white', 6))
    cv.rect(18, 123, 40, 129, col('glass', 3))  # Windshield
    cv.hline(19, 39, 124, col('glass', 5))
    cv.hline(17, 41, 131, col('red', 4))  # Red ambulance stripe
    cv.rect(28, 129, 30, 133, col('red', 3))  # Mini front cross badge
    cv.rect(24, 119, 34, 122, col('red', 4))  # Roof red lightbar
    cv.p(26, 120, col('white', 6))
    cv.p(32, 120, col('white', 6))
    # Headlights & grille
    cv.rect(18, 133, 22, 136, col('yellow', 5))
    cv.rect(36, 133, 40, 136, col('yellow', 5))
    cv.rect(23, 133, 35, 136, col('steel', 2))
    # Dark tires
    cv.rect(17, 138, 22, 141, col('ink', 0))
    cv.rect(36, 138, 41, 141, col('ink', 0))

    # Center: Main Glass Lobby Canopy & Welcoming Automatic Doors (x=54..106, y=107..142) with crisp 'HOSPITAL'
    cv.outline_box(54, 107, 106, 118, col('teal', 4), col('teal', 0), top_hi=col('teal', 5), bot_sh=col('teal', 2))
    cv.rect(56, 109, 104, 116, col('teal', 0))
    tw_hosp = measure_pixel_text('HOSPITAL', FONT_3X5, spacing=2)
    draw_pixel_text(cv, 56 + (48 - tw_hosp) // 2, 110, 'HOSPITAL', 'white:6', font=FONT_3X5, spacing=2)
    cv.hline(55, 106, 118, col('ink', 1))
    cv.door_glass(62, 119, 98, 141, frame='steel:2', warm=True)
    # Green pharmacy/clinic cross sign beside main lobby
    cv.outline_box(55, 120, 61, 128, col('white', 6), col('steel', 2))
    cv.vline(58, 121, 127, col('green', 3))
    cv.hline(56, 60, 124, col('green', 3))

    # Right: Clinic Wing Window, Bench & Hedge Planter (x=108..138)
    draw_rich_window(cv, 108, 115, 136, 130, variant='warm_lamp', frame='steel:2', sill='coolwhite:5', seed=543)
    cv.planter_box(108, 132, 136, 141, flower='white:6', pot_ramp='concrete')
    draw_ground_plinth(cv, 4, 140, 141, 144, ramp='pavement')
    cv.edge_finish(top_y=34)
    return cv


# ---------------------------------------------------------------------------
# 6. mf-bldg-civic_central_bank (128x112)
# ---------------------------------------------------------------------------

def build_civic_central_bank():
    cv = Canvas(128, 112)
    # --- Recessed Flat Oxidized-Copper/Slate Parapet Roof (y=4..24) ---
    cv.flat_roof(6, 4, 122, 24, deck_ramp='teal', deck_i=3, para_ramp='stone', seed=601)
    # Small neoclassical glass skylight lantern on flat roof
    cv.outline_box(46, 8, 82, 18, col('glass', 4), col('steel', 1), top_hi=col('glass', 6))
    for rx in range(52, 80, 6):
        cv.vline(rx, 9, 17, col('steel', 2))
    cv.roof_ac(14, 11)
    cv.roof_ac(104, 11)

    # --- Sculpted Classical Stone Pediment & Heavy Dentil Cornice (y=22..38) ---
    cv.outline_box(2, 24, 126, 30, col('stone', 5), col('stone', 1), top_hi=col('cream', 6), bot_sh=col('stone', 2))
    # Dentil blocks along underside of cornice
    for dx in range(6, 122, 4):
        cv.rect(dx, 30, dx + 2, 32, col('cream', 5))
        cv.p(dx + 2, 30, col('stone', 1))
    # Shallow sculpted classical pediment centered above the 4 columns (x=30..98, y=14..28)
    for dy in range(11):
        y = 14 + dy
        span = 4 + int(dy * 3.1)
        lx = max(30, 64 - span)
        rx = min(98, 64 + span)
        cv.hline(lx, rx, y, col('stone', 5 if dy > 2 else 6))
        cv.p(lx, y, col('stone', 1))
        cv.p(lx + 1, y, col('cream', 6))
        cv.p(rx - 1, y, col('stone', 0))
    # Gold sculpted bank crest medallion inside pediment
    cv.outline_box(59, 18, 69, 25, col('yellow', 4), col('wood', 1), top_hi=col('yellow', 5))
    cv.p(64, 21, col('white', 6))
    # Entablature frieze with carved inscription line
    cv.outline_box(4, 31, 124, 39, col('stone', 4), col('stone', 1), top_hi=col('stone', 5), bot_sh=col('stone', 2))
    for gx in range(38, 90, 4):
        cv.vline(gx, 33, 37, col('yellow', 4 if gx % 8 == 2 else 3))

    # --- Main Classical-Modern Neo-Stone Facade (x=4..124, y=39..106) ---
    draw_ashlar_wall(cv, 4, 39, 124, 80, ramp='stone', base_i=4, bw=10, bh=6, seed=602)
    # Heavy Rusticated Granite Base (y=80..108) — darker chamfered blocks
    draw_ashlar_wall(cv, 4, 80, 124, 108, ramp='pavement', base_i=3, bw=12, bh=6, seed=603)
    cv.hline(4, 124, 80, col('stone', 6))
    cv.hline(4, 124, 81, col('pavement', 1))

    # Flanking Tall Recessed Blue-Glass Arched Windows (left & right wings)
    # Left wing tall windows (spanning 2F-1F classical height!)
    draw_arched_window(cv, 10, 44, 27, 76, variant='sky_curtain_blue', frame='steel:0', trim='stone:6', sill='stone:6', seed=610)
    # Warm brass banker lamp glowing in lower pane
    cv.rect(14, 68, 23, 74, col('yellow', 4))
    cv.p(18, 69, col('white', 6))
    # Right wing tall window
    draw_arched_window(cv, 101, 44, 118, 76, variant='sky_curtain_cream', frame='steel:0', trim='stone:6', sill='stone:6', seed=611)
    cv.rect(105, 68, 114, 74, col('orange', 4))
    cv.p(109, 69, col('white', 6))

    # Lower rusticated wing details: left barred vault/basement grille, right recessed ATM alcove!
    cv.outline_box(11, 86, 26, 102, col('glass', 1), col('pavement', 0))
    for bx in range(13, 25, 3):
        cv.vline(bx, 87, 101, col('steel', 4))
    # Right inset ATM kiosk alcove
    cv.outline_box(101, 84, 118, 105, col('steel', 2), col('pavement', 0), top_hi=col('steel', 5))
    cv.rect(104, 87, 115, 95, col('glass', 5))  # Glowing ATM screen
    cv.hline(105, 114, 89, col('white', 6))
    cv.rect(104, 96, 115, 102, col('steel', 4))

    # --- Central Monumental 4-Column Portico & Bronze-and-Glass Main Doors (x=32..96, y=39..104) ---
    # Deep shadowed recessed portico bay
    cv.rect(34, 39, 94, 100, col('stone', 1))
    # Upper bronze-framed classical mullioned transom window above doors
    draw_curtain_glass_panel(cv, 48, 44, 80, 62, mode='sky', frame='wood:1', seed=620, diag_shift=3, split_mullion=False)
    for mx in (56, 64, 72):
        cv.vline(mx, 45, 61, col('wood', 2))
    cv.hline(49, 79, 53, col('yellow', 4))
    # Warm golden bank chandelier glow glimpsed behind lower transom panes
    cv.rect(58, 55, 70, 60, col('yellow', 4))
    cv.hline(61, 67, 56, col('white', 6))
    # Monumental Bronze-and-Glass Main Entrance Doors
    cv.outline_box(46, 63, 82, 100, col('wood', 3), col('darkwood', 0), top_hi=col('yellow', 4))
    cv.door_glass(49, 66, 79, 99, frame='wood:2', warm=True)
    # 4 Tall Fluted Classical Stone Columns framing the portico!
    for cx in (32, 42, 80, 90):
        draw_column(cv, cx, 39, 100, w=6, ramp='cream')
    # Classic glowing bronze wall lanterns flanking doors
    for lx in (49, 77):
        cv.rect(lx, 74, lx + 3, 79, col('yellow', 5))
        cv.p(lx + 1, 75, col('white', 6))

    # Broad Granite Front Steps & Grounding Plinth (y=100..112)
    draw_steps(cv, 32, 100, 96, 112, n_steps=4, ramp='stone')
    draw_ground_plinth(cv, 4, 32, 108, 112, ramp='pavement')
    draw_ground_plinth(cv, 96, 124, 108, 112, ramp='pavement')
    cv.edge_finish(top_y=24)
    return cv


# ---------------------------------------------------------------------------
# 7. mf-bldg-civic_police_station (112x112)
# ---------------------------------------------------------------------------

def build_civic_police_station():
    cv = Canvas(112, 112)
    # --- Roof with Radio Antenna Mast & AC Units (y=0..30) ---
    cv.flat_roof(6, 12, 106, 30, deck_ramp='concrete', deck_i=3, para_ramp='coolwhite', seed=701)
    # Tall Radio Communications Antenna Mast rising cleanly to top (x=28, y=0..24)
    cv.vline(28, 2, 25, col('steel', 4))
    cv.vline(29, 2, 25, col('steel', 1))
    # Antenna crossbars & red tip beacon
    cv.hline(23, 35, 6, col('steel', 5))
    cv.hline(25, 33, 10, col('steel', 4))
    cv.hline(22, 36, 14, col('steel', 3))
    cv.rect(27, 0, 30, 3, col('red', 4))
    cv.p(28, 1, col('yellow', 5))
    # Rooftop stair hatch & twin AC units
    cv.roof_penthouse(44, 10, w=16, h=14, ramp='coolwhite')
    cv.roof_ac(70, 17)
    cv.roof_ac(84, 17)

    # --- 3F–2F Pale Concrete & Tile Facade (x=6..106, y=30..76) ---
    cv.tile_cladding(6, 30, 106, 76, ramp='coolwhite', base_i=4, cw=5, ch=5, seed=702)
    cv.hline(6, 106, 30, col('steel', 1))
    cv.hline(6, 106, 52, col('blue', 3))  # Crisp police-blue mid-facade stripe
    cv.hline(6, 106, 53, col('coolwhite', 5))

    # 3F Windows (y=34..49) + Central Golden Yellow Police Badge Emblem!
    draw_rich_window(cv, 12, 35, 29, 48, variant='blinds_half', frame='steel:1', sill='concrete:5', seed=710)
    draw_rich_window(cv, 33, 35, 45, 48, variant='warm_lamp', frame='steel:1', sill='concrete:5', seed=711)
    draw_rich_window(cv, 67, 35, 79, 48, variant='sky_curtain_blue', frame='steel:1', sill='concrete:5', seed=712)
    draw_rich_window(cv, 83, 35, 100, 48, variant='blinds_warm', frame='steel:1', sill='concrete:5', seed=713)

    # Iconic Police 5-Point Golden Star Badge Crest mounted in upper center (x=48..64, y=33..50)
    draw_police_star_crest(cv, 56, 41)

    # 2F Varied Office & Dispatch Windows (y=56..72)
    draw_rich_window(cv, 12, 57, 32, 71, variant='warm_curtain_orange', frame='steel:1', sill='concrete:5', seed=720)
    draw_rich_window(cv, 38, 57, 54, 71, variant='sky_curtain_cream', frame='steel:1', sill='concrete:5', seed=721)
    draw_rich_window(cv, 58, 57, 74, 71, variant='bookshelf', frame='steel:1', sill='concrete:5', seed=722)
    draw_rich_window(cv, 80, 57, 100, 71, variant='blinds_half', frame='steel:1', sill='concrete:5', seed=723)

    # --- 1F Bright Blue Fascia Stripe, Recessed Entrance & Glowing Red Patrol Globe Lamp (y=74..112) ---
    draw_ashlar_wall(cv, 6, 84, 106, 109, ramp='concrete', base_i=5, bw=8, bh=5, seed=730)
    # Bold Bright Blue Fascia Canopy Stripe spanning full 1F with crisp 5px 'POLICE' lettering!
    cv.outline_box(4, 74, 108, 85, col('blue', 3), col('navy', 0), top_hi=col('blue', 5), bot_sh=col('navy', 1))
    cv.outline_box(27, 75, 85, 84, col('navy', 0), col('navy', 0))
    cv.hline(28, 84, 76, col('navy', 1))
    cv.hline(28, 84, 82, col('navy', 1))
    tw_pol = measure_pixel_text('POLICE', FONT_4X5, spacing=2)
    draw_pixel_text(cv, 28 + (56 - tw_pol) // 2, 77, 'POLICE', 'white:6', font=FONT_4X5, spacing=2)
    cv.hline(5, 108, 85, col('ink', 1))

    # Recessed Glazed Entrance in Center with Warm Reception Glow
    cv.rect(40, 85, 72, 109, col('steel', 1))
    cv.door_glass(43, 86, 69, 109, frame='steel:3', warm=True)
    # Iconic Glowing Red Patrol Globe Lamp mounted beside entrance (x=33..39, y=86..93)!
    cv.rect(35, 92, 37, 95, col('steel', 2))  # Bracket
    cv.rect(34, 86, 38, 92, col('red', 4))
    cv.rect(33, 87, 39, 91, col('red', 4))
    cv.rect(34, 87, 37, 90, col('orange', 5))
    cv.p(35, 87, col('white', 6))  # Bright glowing specular core!

    # Left 1F: Community Notice Bulletin Board + Parked Patrol Bicycle!
    cv.outline_box(10, 86, 28, 99, col('wood', 4), col('wood', 0), top_hi=col('cedar', 5))
    cv.rect(12, 88, 26, 97, col('cream', 5))
    cv.rect(13, 89, 18, 93, col('white', 6))
    cv.rect(20, 89, 25, 94, col('yellow', 5))
    cv.rect(14, 94, 19, 96, col('blue', 5))
    # Tiny crisp white/steel koban patrol bicycle parked below notice board
    for wx in (14, 24):
        cv.outline_box(wx - 2, 104, wx + 3, 109, col('concrete', 3), col('steel', 0))
    cv.hline(14, 24, 104, col('white', 6))
    cv.vline(19, 101, 106, col('steel', 2))
    cv.hline(17, 20, 101, col('ink', 0))  # Seat
    cv.vline(24, 100, 106, col('steel', 3))
    cv.hline(23, 27, 100, col('steel', 1))  # Handlebars + basket
    cv.rect(25, 101, 28, 104, col('coolwhite', 5))
    # Right 1F: Warm Reception Window + Planter
    draw_rich_window(cv, 76, 87, 100, 102, variant='warm_lamp', frame='steel:1', sill='concrete:5', seed=732)
    cv.planter_box(78, 103, 99, 109, flower='yellow:5', pot_ramp='concrete')
    draw_ground_plinth(cv, 6, 106, 109, 112, ramp='pavement')
    cv.edge_finish(top_y=30)
    return cv


# ---------------------------------------------------------------------------
# 8. mf-bldg-civic_fire_station (128x112)
# ---------------------------------------------------------------------------

def build_civic_fire_station():
    cv = Canvas(128, 112)
    # --- Right Vertical Red-Brick Hose-Drying Watchtower (x=92..126, y=2..112) ---
    # Pitched dark-slate cap roof on watchtower (y=2..20)
    cv.vline(109, 0, 5, col('steel', 4))  # Lightning finial
    cv.p(109, 0, col('yellow', 5))
    draw_hipped_roof(cv, 90, 4, 128, 20, ramp='kawara', ridge_inset=9, seed=801)
    # Watchtower brick body (y=20..109)
    cv.brick_wall(92, 20, 126, 109, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=802)
    # Stone corner quoins on watchtower
    for qy in range(22, 106, 8):
        cv.rect(92, qy, 96, qy + 4, col('cream', 4))
        cv.rect(122, qy, 126, qy + 4, col('cream', 3))
    # Watchtower tall narrow observation/drying windows
    draw_rich_window(cv, 103, 25, 115, 39, variant='warm_lamp', frame='wood:1', sill='cream:6', seed=803)
    draw_rich_window(cv, 104, 46, 114, 62, variant='blinds_half', frame='steel:1', sill='cream:6', seed=804)
    # Red fire department shield plaque on tower
    cv.outline_box(103, 68, 115, 78, col('red', 3), col('red', 0), top_hi=col('yellow', 5))
    cv.rect(107, 71, 111, 75, col('yellow', 5))
    # 1F side glazed office door at base of watchtower
    cv.door_glass(100, 84, 118, 109, frame='red:1', warm=True)
    cv.awning(98, 80, 120, 85, ramp_a='red', ramp_b='white', stripe_w=3)

    # --- Main 2F Firehouse Hall (x=4..92, y=24..112) ---
    # Flat parapet roof on main hall (y=24..40) with siren horn & AC
    cv.flat_roof(4, 24, 93, 40, deck_ramp='concrete', deck_i=3, para_ramp='cream', seed=805)
    cv.roof_ac(14, 29)
    # Classic rooftop red siren horn on steel tripod
    cv.vline(46, 20, 34, col('steel', 3))
    cv.rect(42, 20, 51, 25, col('red', 4))
    cv.hline(42, 51, 20, col('red', 1))
    cv.p(44, 22, col('yellow', 5))
    cv.roof_penthouse(64, 24, w=16, h=12, ramp='concrete')

    # 2F Brick & White Living Quarters Facade (y=40..72)
    cv.brick_wall(4, 40, 92, 72, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=806)
    cv.outline_box(2, 39, 93, 43, col('cream', 5), col('stone', 1), top_hi=col('white', 6))
    # Crisp white/cream horizontal sill & belt band
    cv.outline_box(4, 68, 93, 73, col('white', 5), col('steel', 1), top_hi=col('white', 6))
    # 3 Varied 2F Living Quarters Windows
    draw_rich_window(cv, 12, 47, 30, 63, variant='warm_curtain_orange', frame='white:5', sill='cream:6', seed=810)
    draw_rich_window(cv, 39, 47, 57, 63, variant='blinds_half', frame='white:5', sill='cream:6', seed=811)
    draw_rich_window(cv, 66, 47, 84, 63, variant='plant_sill', frame='white:5', sill='cream:6', seed=812)

    # 1F Two Wide Red-Framed Apparatus Garage Bays (x=4..92, y=73..109)
    draw_ashlar_wall(cv, 4, 73, 92, 109, ramp='white', base_i=4, bw=8, bh=5, seed=820)
    # Red apparatus lintel fascia + heraldic gold emblem center
    cv.outline_box(4, 72, 92, 77, col('red', 3), col('red', 0), top_hi=col('red', 5))
    cv.rect(44, 73, 52, 76, col('yellow', 5))
    cv.p(47, 74, col('red', 3))
    cv.p(48, 74, col('red', 3))
    # Crisp vertical shadow separating projecting right watchtower from main hall
    cv.vline(91, 40, 109, col('ink', 1))
    cv.vline(92, 20, 109, col('brick', 0))

    # LEFT BAY (OPEN — showing bold red fire-engine nose & glowing headlights inside!)
    cv.outline_box(8, 77, 46, 109, col('asphalt', 1), col('red', 1))
    cv.outline_box(9, 78, 45, 109, col('asphalt', 0), col('red', 4))
    # Fire engine nose parked inside bay!
    cv.outline_box(13, 83, 41, 105, col('red', 4), col('red', 0), top_hi=col('red', 5))
    # Flashing red/blue cab lightbar
    cv.rect(17, 80, 25, 83, col('red', 4))
    cv.p(20, 81, col('white', 6))
    cv.rect(29, 80, 37, 83, col('blue', 4))
    cv.p(33, 81, col('white', 6))
    # Windshield
    cv.rect(16, 85, 38, 93, col('glass', 3))
    cv.hline(17, 37, 86, col('glass', 5))
    cv.vline(27, 85, 93, col('red', 2))
    # Gleaming chrome radiator grille & bumper
    cv.outline_box(21, 95, 33, 102, col('coolwhite', 5), col('steel', 1), top_hi=col('white', 6))
    for gy in (97, 99, 101):
        cv.hline(22, 32, gy, col('steel', 2))
    # Bright glowing yellow headlights!
    cv.rect(15, 96, 20, 100, col('yellow', 5))
    cv.p(17, 97, col('white', 6))
    cv.rect(34, 96, 39, 100, col('yellow', 5))
    cv.p(36, 97, col('white', 6))
    # Chrome bumper & big black tires
    cv.hline(13, 41, 103, col('white', 6))
    cv.hline(13, 41, 104, col('steel', 3))
    cv.rect(14, 105, 20, 109, col('ink', 0))
    cv.rect(34, 105, 40, 109, col('ink', 0))

    # RIGHT BAY (CLOSED — ribbed rolled steel shutter door!)
    cv.outline_box(50, 77, 88, 109, col('steel', 3), col('red', 1))
    cv.outline_box(51, 78, 87, 109, col('steel', 4), col('red', 4))
    for sy in range(80, 107, 3):
        cv.hline(53, 85, sy, col('steel', 5))
        cv.hline(53, 85, sy + 1, col('steel', 3))
        cv.hline(53, 85, sy + 2, col('steel', 1))
    # Small glazed vision strip near top of shutter + bottom handle
    cv.rect(57, 85, 67, 89, col('glass', 2))
    cv.rect(71, 85, 81, 89, col('glass', 2))
    cv.rect(66, 103, 72, 105, col('steel', 1))

    # Cute red fire hydrant detail on far right sidewalk edge
    cv.rect(121, 101, 125, 109, col('red', 4))
    cv.hline(120, 126, 103, col('red', 3))
    cv.p(123, 100, col('yellow', 5))

    draw_ground_plinth(cv, 4, 126, 109, 112, ramp='pavement')
    cv.edge_finish(top_y=20)
    return cv


# ---------------------------------------------------------------------------
# 9. mf-bldg-civic_post_office (112x96)
# ---------------------------------------------------------------------------

def build_civic_post_office():
    cv = Canvas(112, 96)
    # --- Pitched Dark-Slate Top-3/4 Roof (y=4..34) with Crisp Sunlit Ridge Cap ---
    cv.pitched_roof(2, 6, 110, 34, ramp='kawara', ridge_hi=True, moss_rate=0.05, seed=901)
    # Crisp 2px sunlit ridge cap running cleanly along the roof peak (y=5..8)
    cv.hline(2, 110, 5, col('kawara', 0))
    for rx in range(3, 109):
        if (rx - 3) % 5 == 4:
            cv.p(rx, 6, col('kawara', 4))
            cv.p(rx, 7, col('kawara', 3))
        else:
            cv.p(rx, 6, col('white', 6) if (rx - 3) % 5 in (0, 1) else col('coolwhite', 5))
            cv.p(rx, 7, col('kawara', 5))
    cv.p(2, 6, col('kawara', 1))
    cv.p(109, 6, col('kawara', 0))
    cv.hline(2, 110, 8, col('kawara', 1))
    # Little brick chimney / vent on left roof slope
    cv.outline_box(18, 2, 26, 16, col('brick', 4), col('brick', 0), top_hi=col('cream', 5))
    cv.hline(17, 27, 4, col('stone', 5))
    # Rooftop small flagpole on right roof
    draw_flagpole(cv, 88, 0, 13, flag_ramp='red', stripe_ramp='white', flag_right=True)

    # --- 2F Warm Brick & Cream-Stone Quoins Facade (x=4..108, y=34..58) ---
    cv.brick_wall(4, 34, 108, 58, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=902)
    # Roof eave shadow
    cv.hline(4, 108, 34, col('brick', 0))
    cv.hline(4, 108, 35, col('brick', 1))
    # Cream stone corner quoins
    for qy in range(36, 56, 6):
        cv.rect(4, qy, 9, qy + 4, col('cream', 5))
        cv.rect(103, qy, 108, qy + 4, col('cream', 4))

    # 4 Varied 2F Administrative Windows
    draw_rich_window(cv, 13, 38, 29, 52, variant='blinds_half', frame='white:5', sill='cream:6', seed=910)
    draw_rich_window(cv, 35, 38, 51, 52, variant='warm_lamp', frame='white:5', sill='cream:6', seed=911)
    draw_rich_window(cv, 61, 38, 77, 52, variant='plant_sill', frame='white:5', sill='cream:6', seed=912)
    draw_rich_window(cv, 83, 38, 99, 52, variant='sky_curtain_cream', frame='white:5', sill='cream:6', seed=913)

    # --- Bold Crimson-Red Horizontal Fascia Sign with Crisp White Envelope + 'POST' (y=55..66) ---
    cv.outline_box(2, 55, 110, 66, col('red', 3), col('red', 0), top_hi=col('red', 5), bot_sh=col('red', 2))
    # Clean dark crimson central sign backing panel (x=22..90, y=57..64 = 7px tall for 5px glyphs + 1px margin)
    cv.rect(22, 57, 90, 64, col('red', 1))
    cv.vline(21, 57, 64, col('red', 0))
    cv.vline(90, 57, 64, col('red', 0))
    # Crisp white envelope icon on the left + unmistakable 5px-tall 'POST' lettering!
    draw_envelope_icon(cv, 31, 57, w=11, h=7, bg='white:6', line='red:1', border='red:0')
    draw_pixel_text(cv, 49, 58, 'POST', 'white:6', font=FONT_4X5, spacing=3)
    cv.hline(3, 110, 66, col('ink', 1))

    # --- 1F Cream-Stone & Brick Arcade, Flush Glass Entrance & Sidewalk Mail Drop Alcove (y=66..96) ---
    draw_ashlar_wall(cv, 4, 66, 108, 93, ramp='cream', base_i=4, bw=8, bh=5, seed=930)
    # Left: Warm showcase window with stamp/parcel notice & shrub planter
    draw_rich_window(cv, 9, 70, 32, 85, variant='warm_curtain_orange', frame='wood:1', sill='stone:5', seed=931)
    cv.planter_box(9, 86, 31, 93, flower='yellow:5', pot_ramp='brick')

    # Center: Wide Inviting Red-Framed Double Glass Doors dropping cleanly to a flush street threshold step!
    cv.rect(38, 69, 70, 92, col('red', 1))
    # Left & right full-height warm glazed door leaves extending down to y=91 (NO raised solid red bar!)
    for dx0, dx1 in ((39, 53), (55, 69)):
        for y in range(70, 91):
            ry = y - 70
            for x in range(dx0, dx1):
                rx = x - dx0
                if y == 75:
                    cv.p(x, y, col('red', 2))  # Crisp transom bar
                elif y == 70:
                    cv.p(x, y, col('orange', 2))
                elif y >= 87:
                    # Warm tiled lobby floor glimpsed through lower door glass
                    cv.p(x, y, col('orange', 3 if (rx + ry) % 3 == 0 else 4))
                elif (rx + ry) in (2, 3, 14):
                    cv.p(x, y, col('cream', 5))  # Diagonal glass reflection
                elif y >= 78:
                    cv.p(x, y, col('yellow', 5 if (rx + ry) % 3 == 0 else 4))
                else:
                    cv.p(x, y, col('orange', 4 if rx % 3 != 2 else 3))
    # Slim outer jambs, center meeting stile, and crisp brass pull handles
    cv.vline(38, 69, 92, col('red', 0))
    cv.vline(69, 69, 92, col('red', 0))
    cv.hline(38, 70, 69, col('red', 0))
    cv.vline(53, 70, 92, col('red', 2))
    cv.vline(54, 70, 92, col('red', 0))
    cv.hline(39, 69, 91, col('red', 1))  # Slim 1px bottom door rail flush with threshold
    cv.vline(51, 80, 85, col('yellow', 5))
    cv.vline(56, 80, 85, col('yellow', 5))
    # Flush street-level stone threshold step directly under doors (y=92..96)
    cv.hline(37, 71, 92, col('stone', 6))
    cv.hline(37, 71, 93, col('stone', 5))
    cv.hline(37, 71, 94, col('stone', 3))
    cv.hline(37, 71, 95, col('ink', 0))
    # Small warm brass lamp beside door
    cv.rect(34, 73, 37, 77, col('yellow', 5))
    cv.p(35, 74, col('white', 6))

    # Right: Recessed Sidewalk Mail Drop Alcove with Iconic Red Postbox!
    cv.outline_box(76, 69, 103, 93, col('stone', 2), col('stone', 0))
    # Wall mail drop chute & notice board inside alcove
    cv.outline_box(79, 72, 90, 81, col('white', 5), col('steel', 1))
    cv.hline(81, 88, 75, col('red', 3))  # Mail slot
    cv.hline(81, 88, 77, col('steel', 1))
    # Iconic standing bright crimson red street mailbox in alcove!
    cv.outline_box(92, 74, 101, 88, col('red', 4), col('red', 0), top_hi=col('red', 5))
    cv.hline(94, 99, 77, col('ink', 0))  # Letter slot
    cv.hline(94, 99, 79, col('white', 6))  # Emblem stripe
    cv.rect(95, 88, 98, 93, col('steel', 2))  # Pedestal leg
    # Parcel pickup bench/step on left of alcove
    cv.outline_box(79, 85, 90, 92, col('wood', 4), col('wood', 0), top_hi=col('cedar', 5))

    draw_ground_plinth(cv, 4, 37, 93, 96, ramp='stone')
    draw_ground_plinth(cv, 71, 108, 93, 96, ramp='stone')
    cv.edge_finish(top_y=34)
    return cv


# ---------------------------------------------------------------------------
# 10. mf-bldg-civic_public_museum (144x128)
# ---------------------------------------------------------------------------

def build_civic_public_museum():
    cv = Canvas(144, 128)
    # --- Flanking Sculptural Limestone Flat Parapet Wing Roofs (y=22..38) ---
    cv.flat_roof(4, 22, 46, 38, deck_ramp='concrete', deck_i=4, para_ramp='cream', seed=1001)
    cv.flat_roof(98, 22, 140, 38, deck_ramp='concrete', deck_i=4, para_ramp='cream', seed=1002)
    # Subtle linear glass skylights on wing roofs
    cv.outline_box(12, 27, 36, 33, col('glass', 5), col('steel', 1), top_hi=col('white', 6))
    cv.outline_box(108, 27, 132, 33, col('glass', 5), col('steel', 1), top_hi=col('white', 6))

    # --- Glowing Top-3/4 Pitched Glass Skylight Dome / Lantern Roof over Central Atrium (x=42..102, y=2..38) ---
    draw_glass_dome_lantern(cv, 42, 2, 102, 38)

    # --- Flanking Sculptural Limestone Wings (x=4..44 and x=100..140, y=38..116) ---
    for sx0, sx1, sd in ((4, 46, 1010), (98, 140, 1011)):
        draw_ashlar_wall(cv, sx0, 38, sx1, 114, ramp='cream', base_i=5, bw=12, bh=6, seed=sd)
        # Heavy sculptural cornice top & plinth band
        cv.outline_box(sx0 - 1, 36, sx1 + 1, 41, col('white', 5), col('stone', 1), top_hi=col('white', 6), bot_sh=col('stone', 2))
        cv.hline(sx0, sx1, 42, col('stone', 2))
        # High clerestory narrow gallery slit windows (y=45..54)
        for wx in range(sx0 + 5, sx1 - 10, 12):
            draw_curtain_glass_panel(cv, wx, 45, wx + 8, 54, mode='warm_office', frame='darkwood:1', seed=sd + wx, diag_shift=wx)
        # Sculptural recessed vertical stone niches on lower wing
        cv.outline_box(sx0 + 4, 58, sx1 - 4, 106, col('kinari', 4), col('stone', 2), top_hi=col('stone', 3))
        # Lower stone dado/base
        draw_ashlar_wall(cv, sx0, 106, sx1, 122, ramp='stone', base_i=4, bw=10, bh=5, seed=sd + 5)

    # Colorful Hanging Exhibition Banners on Left & Right Sculptural Wings!
    draw_hanging_banner(cv, 10, 56, 22, 100, ramp='red', accent='yellow:5', seed=1020)
    draw_hanging_banner(cv, 28, 56, 40, 100, ramp='blue', accent='cream:6', seed=1021)
    draw_hanging_banner(cv, 104, 56, 116, 100, ramp='teal', accent='orange:5', seed=1022)
    draw_hanging_banner(cv, 122, 56, 134, 100, ramp='pink', accent='white:6', seed=1023)

    # --- Tall Dark-Bronze Glazed Central Atrium (x=44..100, y=38..112) ---
    cv.outline_box(43, 37, 101, 112, col('darkwood', 1), col('darkwood', 0))
    # Upper Atrium Curtain Wall (3 tall dramatic bronze-framed glass bays, y=40..78)
    atrium_bays = [(46, 63, 'sky'), (64, 80, 'sky'), (81, 98, 'cool_lit')]
    for i, (bx0, bx1, md) in enumerate(atrium_bays):
        draw_curtain_glass_panel(cv, bx0, 40, bx1, 78, mode=md, frame='wood:1', seed=1030 + i, diag_shift=i * 4, split_mullion=False)
    # Glowing interior mezzanine gallery archway & classical sculpture silhouette visible through central glass!
    for y in range(56, 77):
        for x in range(66, 78):
            if y == 56 and x in (66, 77):
                continue
            cv.p(x, y, col('orange', 3 if y < 62 else 4))
    cv.rect(68, 60, 76, 76, col('yellow', 4))
    # Pedestal & sculpture silhouette bathed in golden museum spotlight
    cv.rect(70, 70, 74, 76, col('stone', 4))
    cv.rect(71, 64, 73, 70, col('cream', 6))
    cv.p(72, 62, col('white', 6))
    # Crisp bronze horizontal mullion bars across entire atrium
    for my in (52, 65):
        cv.hline(46, 98, my, col('darkwood', 2))
    # Bronze sculptural horizontal beam & subtle museum sign bar
    cv.outline_box(44, 78, 100, 84, col('wood', 3), col('darkwood', 0), top_hi=col('yellow', 4), bot_sh=col('darkwood', 1))
    for gx in range(54, 90, 4):
        cv.vline(gx, 80, 83, col('yellow', 5))

    # Lower Atrium Grand Entrance Bays (y=84..111) — glowing golden gallery interior!
    draw_curtain_glass_panel(cv, 46, 85, 59, 110, mode='warm_office', frame='wood:1', seed=1035, diag_shift=2)
    cv.door_glass(60, 85, 84, 111, frame='wood:2', warm=True)
    draw_curtain_glass_panel(cv, 85, 85, 98, 110, mode='warm_office', frame='wood:1', seed=1036, diag_shift=5)

    # Broad Grand Stone Front Staircase cascading across central plaza (x=38..106, y=111..128)
    draw_steps(cv, 40, 111, 104, 128, n_steps=5, ramp='stone')
    # Monumental stone cheek-walls flanking staircase with glowing museum pedestal lamps
    for lx in (34, 104):
        cv.outline_box(lx, 110, lx + 6, 127, col('cream', 5), col('stone', 1), top_hi=col('white', 6))
        cv.rect(lx + 1, 104, lx + 5, 110, col('yellow', 5))
        cv.p(lx + 2, 105, col('white', 6))
        cv.hline(lx + 1, lx + 5, 104, col('wood', 2))

    # Sculptural Olive/Boxwood Planters in front of wings
    cv.planter_box(8, 114, 30, 124, flower='white:6', pot_ramp='stone')
    cv.planter_box(114, 114, 136, 124, flower='yellow:5', pot_ramp='stone')
    cv.foliage_cluster(19, 113, 6, 4, ramp='foliage', seed=1040)
    cv.foliage_cluster(125, 113, 6, 4, ramp='foliage', seed=1041)

    draw_ground_plinth(cv, 4, 34, 123, 128, ramp='stone')
    draw_ground_plinth(cv, 110, 140, 123, 128, ramp='stone')
    cv.edge_finish(top_y=38)
    return cv


# ---------------------------------------------------------------------------
# Pack Registry & Manifest Writer
# ---------------------------------------------------------------------------

SPECS = [
    {
        'id': 'mf-bldg-hi_apt_tower_varied',
        'name': '6층 변화형 주상복합 아파트 타워',
        'category': 'highrise',
        'w': 7, 'h': 11,
        'pxW': 112, 'pxH': 176,
        'passableTopRows': 2,
        'tags': ['highrise', 'apartment', 'tower', 'residential', 'penthouse', 'balcony', 'non-cloned'],
        'fn': build_hi_apt_tower_varied,
    },
    {
        'id': 'mf-bldg-hi_glass_corp_tower',
        'name': '6층 계단식 유리 오피스 타워',
        'category': 'highrise',
        'w': 7, 'h': 12,
        'pxW': 112, 'pxH': 192,
        'passableTopRows': 2,
        'tags': ['highrise', 'office', 'glass', 'corporate', 'sky-garden', 'tower', 'non-cloned'],
        'fn': build_hi_glass_corp_tower,
    },
    {
        'id': 'mf-bldg-hi_setback_depato',
        'name': '5층 대형 백화점 (옥상 유원지)',
        'category': 'highrise',
        'w': 9, 'h': 10,
        'pxW': 144, 'pxH': 160,
        'passableTopRows': 2,
        'tags': ['highrise', 'department-store', 'depato', 'commercial', 'ferris-wheel', 'rooftop', 'landmark'],
        'fn': build_hi_setback_depato,
    },
    {
        'id': 'mf-bldg-civic_city_hall_clock',
        'name': '시청사 시계탑 랜드마크',
        'category': 'civic',
        'w': 9, 'h': 9,
        'pxW': 144, 'pxH': 144,
        'passableTopRows': 2,
        'tags': ['civic', 'city-hall', 'clock-tower', 'landmark', 'government', 'colonnade'],
        'fn': build_civic_city_hall_clock,
    },
    {
        'id': 'mf-bldg-civic_general_hospital',
        'name': '4층 종합병원 (옥상 헬기장·응급실)',
        'category': 'civic',
        'w': 9, 'h': 9,
        'pxW': 144, 'pxH': 144,
        'passableTopRows': 2,
        'tags': ['civic', 'hospital', 'medical', 'ambulance', 'helipad', 'non-cloned'],
        'fn': build_civic_general_hospital,
    },
    {
        'id': 'mf-bldg-civic_central_bank',
        'name': '신고전주의 중앙은행',
        'category': 'civic',
        'w': 8, 'h': 7,
        'pxW': 128, 'pxH': 112,
        'passableTopRows': 2,
        'tags': ['civic', 'bank', 'neoclassical', 'columns', 'finance', 'landmark'],
        'fn': build_civic_central_bank,
    },
    {
        'id': 'mf-bldg-civic_police_station',
        'name': '3층 지구대·경찰서',
        'category': 'civic',
        'w': 7, 'h': 7,
        'pxW': 112, 'pxH': 112,
        'passableTopRows': 2,
        'tags': ['civic', 'police', 'koban', 'station', 'safety', 'antenna'],
        'fn': build_civic_police_station,
    },
    {
        'id': 'mf-bldg-civic_fire_station',
        'name': '2.5층 소방서·망루',
        'category': 'civic',
        'w': 8, 'h': 7,
        'pxW': 128, 'pxH': 112,
        'passableTopRows': 2,
        'tags': ['civic', 'fire-station', 'fire-engine', 'watchtower', 'garage', 'safety'],
        'fn': build_civic_fire_station,
    },
    {
        'id': 'mf-bldg-civic_post_office',
        'name': '2층 벽돌 우체국',
        'category': 'civic',
        'w': 7, 'h': 6,
        'pxW': 112, 'pxH': 96,
        'passableTopRows': 2,
        'tags': ['civic', 'post-office', 'mail', 'brick', 'pitched-roof'],
        'fn': build_civic_post_office,
    },
    {
        'id': 'mf-bldg-civic_public_museum',
        'name': '시립 미술관·박물관 (유리 아트리움)',
        'category': 'civic',
        'w': 9, 'h': 8,
        'pxW': 144, 'pxH': 128,
        'passableTopRows': 2,
        'tags': ['civic', 'museum', 'gallery', 'skylight', 'banners', 'landmark'],
        'fn': build_civic_public_museum,
    },
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    manifest_items = []
    for sp in SPECS:
        cv = sp['fn']()
        assert cv.w == sp['pxW'] and cv.h == sp['pxH'], f"{sp['id']} size mismatch {cv.w}x{cv.h}"
        out_png = os.path.join(OUT_DIR, f"{sp['id']}.png")
        cv.save(out_png)
        item = {k: v for k, v in sp.items() if k != 'fn'}
        manifest_items.append(item)
        print(f"  wrote {sp['id']} ({cv.w}x{cv.h}) -> {out_png}")

    mpath = os.path.join(OUT_DIR, 'manifest.json')
    with open(mpath, 'w', encoding='utf-8') as f:
        json.dump({'batch': BATCH, 'kind': 'buildings', 'items': manifest_items}, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(manifest_items)} buildings + manifest -> {OUT_DIR}")


if __name__ == '__main__':
    main()
