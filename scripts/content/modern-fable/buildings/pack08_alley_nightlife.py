#!/usr/bin/env python3
"""Modern-Fable Buildings — Pack 08: Alley Life, Retro & Nightlife (10 buildings).

Strictly locked to tiledata/jp-city/fable-city/palette.json via fable_lib.
Matches the Fable 5.2 top-3/4 RPG pixel-art baseline (bldg-f-shop-1 / bldg-f-house-1):
  - Sunlit top-3/4 pitched kawara/cha/corrugated/flat roofs with architectural landmarks,
  - Rich alley-life & nightlife storytelling: coin laundry machines, sento chimney & twin noren,
    retro arcade cabinets & neon marquee, 4F karaoke neon tower with zero floor cloning,
    steaming pojangmacha tent & red stools, Euljiro vinyl LP bar with exterior iron stairs,
    mid-century bowling alley with giant rooftop pin, mint-tiled barbershop with barber pole,
    lived-in repair workshop bay with tools & oil drums, mossy antique corner with curios,
  - 0 off-palette pixels, binary alpha (0/255), ~50-80 colors per building, zero floor cloning.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from fable_lib import Canvas, col, C, hsh, shade_rgba, OUT_ROOT, GLYPHS_PATH


_GLYPHS_CACHE = None

# Crisp 5px-tall pixel font + compact 7px Hangul for ultra-readable alley/nightlife signage
EXTRA_GLYPHS = {
    '0': ['.###.', '#..##', '#.#.#', '##..#', '.###.'],
    '2': ['####.', '...#.', '.##..', '#....', '#####'],
    '4': ['#..#.', '#..#.', '#####', '...#.', '...#.'],
    'A': ['.##.', '#..#', '####', '#..#', '#..#'],
    'B': ['###.', '#..#', '###.', '#..#', '###.'],
    'C': ['.###', '#...', '#...', '#...', '.###'],
    'D': ['###.', '#..#', '#..#', '#..#', '###.'],
    'E': ['####', '#...', '###.', '#...', '####'],
    'F': ['####', '#...', '###.', '#...', '#...'],
    'G': ['.###', '#...', '#.##', '#..#', '.###'],
    'H': ['#..#', '#..#', '####', '#..#', '#..#'],
    'I': ['###', '.#.', '.#.', '.#.', '###'],
    'K': ['#..#', '#.#.', '##..', '#.#.', '#..#'],
    'L': ['#...', '#...', '#...', '#...', '####'],
    'M': ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
    'N': ['#..#', '##.#', '#.##', '#..#', '#..#'],
    'O': ['.##.', '#..#', '#..#', '#..#', '.##.'],
    'P': ['###.', '#..#', '###.', '#...', '#...'],
    'Q': ['.##.', '#..#', '#..#', '#.##', '.###'],
    'R': ['###.', '#..#', '###.', '#.#.', '#..#'],
    'S': ['.###', '#...', '.##.', '...#', '###.'],
    'T': ['#####', '..#..', '..#..', '..#..', '..#..'],
    'U': ['#..#', '#..#', '#..#', '#..#', '.##.'],
    'V': ['#...#', '#...#', '#...#', '.#.#.', '..#..'],
    'W': ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
    'X': ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
    'Y': ['#...#', '.#.#.', '..#..', '..#..', '..#..'],
    ' ': ['..', '..', '..', '..', '..'],
    # Crisp 7x7 Hangul for Korean nightlife signs
    '노': [
        '.#.....',
        '.#.....',
        '.#####.',
        '...#...',
        '...#...',
        '#######',
        '.......',
    ],
    '래': [
        '###.#.#',
        '..#.#.#',
        '###.###',
        '#...#.#',
        '###.#.#',
        '....#.#',
        '....#.#',
    ],
    '방': [
        '#.#..#.',
        '###..#.',
        '#.#..##',
        '###..#.',
        '..###..',
        '.#...#.',
        '..###..',
    ],
    '포': [
        '.#####.',
        '..#.#..',
        '.#####.',
        '...#...',
        '#######',
    ],
    '차': [
        '..#..#.',
        '####.#.',
        '..#..##',
        '.#.#.#.',
        '#..#.#.',
    ],
    '♪': [
        '..###',
        '..#.#',
        '..#..',
        '.##..',
        '###..',
        '.#...',
    ],
    '★': [
        '..#..',
        '#####',
        '.###.',
        '#.#.#',
    ],
}


def load_glyphs():
    global _GLYPHS_CACHE
    if _GLYPHS_CACHE is None:
        raw = json.load(open(GLYPHS_PATH, encoding='utf-8'))['glyphs']
        _GLYPHS_CACHE = dict(raw)
        _GLYPHS_CACHE.update(EXTRA_GLYPHS)
    return _GLYPHS_CACHE


def text_size(text, vertical=False, spacing=1):
    glyphs = load_glyphs()
    if vertical:
        w = max((max(len(r) for r in glyphs[ch]) for ch in text if ch in glyphs), default=0)
        h = sum((len(glyphs[ch]) + spacing for ch in text if ch in glyphs)) - (spacing if text else 0)
        return w, max(0, h)
    w = sum((max(len(r) for r in glyphs[ch]) + spacing for ch in text if ch in glyphs)) - (spacing if text else 0)
    h = max((len(glyphs[ch]) for ch in text if ch in glyphs), default=0)
    return max(0, w), h


def draw_text(cv, text, x, y, color, vertical=False, spacing=1, shadow=None):
    glyphs = load_glyphs()
    rgba = C(color)
    sh = C(shadow) if shadow is not None else None
    cx, cy = x, y
    for ch in text:
        g = glyphs.get(ch)
        if not g:
            if vertical:
                cy += 4
            else:
                cx += 3
            continue
        gh = len(g)
        gw = max(len(r) for r in g)
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


def draw_text_centered(cv, text, x0, y0, x1, y1, color, vertical=False, spacing=1, shadow=None):
    tw, th = text_size(text, vertical=vertical, spacing=spacing)
    tx = x0 + (x1 - x0 - tw) // 2
    ty = y0 + (y1 - y0 - th) // 2
    draw_text(cv, text, tx, ty, color, vertical=vertical, spacing=spacing, shadow=shadow)


# ---------------------------------------------------------------------------
# Authentic Fable 5.2 Shared Architectural Helpers
# ---------------------------------------------------------------------------

def draw_kawara_roof(cv, x0, y0, x1, y1, ramp='kawara', moss=0.06,
                     onigawara=True, skylight=None, vent=None, seed=0):
    """Authentic ribbed Japanese kawara / ibushi / cha / midori pitched roof."""
    w = x1 - x0
    h = y1 - y0
    for y in range(y0, y1):
        ry = y - y0
        for x in range(x0, x1):
            rx = x - x0
            if ry == 0:
                if rx in (0, w - 1):
                    cv.p(x, y, col(ramp, 0))
                else:
                    cv.p(x, y, col(ramp, 7 if len(col(ramp, 7)) else 6))
            elif ry == 1:
                cv.p(x, y, col(ramp, 5 if rx % 4 != 3 else 4))
            elif ry == 2:
                cv.p(x, y, col(ramp, 2))
            elif ry == h - 1:
                cv.p(x, y, col(ramp, 0))
            elif ry == h - 2:
                # Rounded nokimarugawara eave tiles
                m = rx % 4
                cv.p(x, y, col(ramp, 5 if m == 1 else (4 if m == 2 else 1)))
            elif ry == h - 3:
                m = rx % 4
                cv.p(x, y, col(ramp, 3 if m in (1, 2) else 1))
            else:
                ci = (ry - 3) // 4
                yy = (ry - 3) % 4
                m = rx % 4
                bi = rx // 4
                r = hsh(bi, ci, seed)
                right_sh = 1 if rx >= w - 4 else 0
                left_hi = 1 if rx < 4 and m == 1 else 0
                if yy == 3:
                    cv.p(x, y, col(ramp, max(0, 1 - right_sh)))
                elif m == 0:
                    cv.p(x, y, col(ramp, max(0, 1 - right_sh)))
                elif moss > 0 and r > 1.0 - moss and ry >= h // 2 - 1:
                    cv.p(x, y, col('moss', 4 if yy == 0 and m == 1 else (3 if yy <= 1 else 2)))
                else:
                    base = 5 if ry < h // 2 else 4
                    if m == 2:
                        base -= 1
                    elif m == 3:
                        base -= 2
                    if r > 0.78:
                        base += 1
                    elif r < 0.22:
                        base -= 1
                    if yy == 0 and m == 1:
                        base += 1
                    cv.p(x, y, col(ramp, max(1, min(6, base + left_hi - right_sh))))

    # Sculpted onigawara ridge finials on left & right ends
    if onigawara and w >= 24:
        for ox in (x0, x1 - 4):
            cv.rect(ox, y0 - 1, ox + 4, y0 + 3, col(ramp, 1))
            cv.rect(ox + 1, y0, ox + 3, y0 + 2, col(ramp, 6))
            cv.p(ox + 1, y0 - 1, col(ramp, 4))
            cv.p(ox + 2, y0 - 1, col(ramp, 4))

    # Optional small attic skylight
    if skylight:
        sx, sy, sw, sh_ = skylight
        cv.outline_box(sx, sy, sx + sw, sy + sh_, col('glass', 2), col('steel', 1), top_hi=col('steel', 5))
        cv.hline(sx + 1, sx + sw - 1, sy + 2, col('glass', 5))
        cv.vline(sx + sw // 2, sy + 1, sy + sh_ - 1, col('steel', 1))
        cv.hline(sx + 1, sx + sw, sy + sh_, col(ramp, 0))

    # Optional small roof vent
    if vent:
        vx, vy = vent
        cv.outline_box(vx, vy, vx + 6, vy + 5, col('steel', 4), col('steel', 0), top_hi=col('steel', 6))
        cv.hline(vx + 1, vx + 5, vy + 3, col('steel', 2))

    # Crisp dark overhanging eave shadow below roof
    cv.hline(x0 + 1, x1 - 1, y1, col('ink', 0))
    cv.hline(x0 + 2, x1 - 2, y1 + 1, col('ink', 1))


def draw_corrugated_roof(cv, x0, y0, x1, y1, ramp='steel', rust_rate=0.14, seed=0):
    """Sloped ribbed corrugated metal roof with horizontal lap seams & weathering."""
    w = x1 - x0
    h = y1 - y0
    for y in range(y0, y1):
        ry = y - y0
        for x in range(x0, x1):
            rx = x - x0
            if ry == 0:
                cv.p(x, y, col(ramp, 1 if rx in (0, w - 1) else 6))
            elif ry == 1:
                cv.p(x, y, col(ramp, 5 if rx % 3 != 2 else 3))
            elif ry == h - 1:
                cv.p(x, y, col(ramp, 0))
            elif ry == h - 2:
                cv.p(x, y, col(ramp, 2 if rx % 3 != 0 else 1))
            else:
                m = rx % 3
                sheet_row = ry // 7
                r = hsh(rx // 3, sheet_row, seed)
                r2 = hsh(rx, ry, seed + 17)
                if ry % 7 == 6:
                    # Horizontal overlapping metal seam
                    cv.p(x, y, col(ramp, 1))
                elif rust_rate > 0 and r > 1.0 - rust_rate and r2 > 0.35:
                    cv.p(x, y, col('rooftile', 3 if m == 1 else 2))
                else:
                    base = 4 if ry < h // 2 else 3
                    if m == 0:
                        base -= 1
                    elif m == 1:
                        base += 1
                    if rx >= w - 4:
                        base -= 1
                    cv.p(x, y, col(ramp, max(1, min(6, base))))
    cv.hline(x0 + 1, x1 - 1, y1, col('ink', 0))
    cv.hline(x0 + 2, x1 - 2, y1 + 1, col('ink', 1))


def draw_drainpipe(cv, x, y0, y1, ramp='steel'):
    """Vertical metal rainwater downspout with wall bracket bands."""
    cv.vline(x, y0, y1, col(ramp, 1))
    cv.vline(x + 1, y0, y1, col(ramp, 5))
    cv.vline(x + 2, y0, y1, col(ramp, 2))
    for by in range(y0 + 5, y1 - 3, 12):
        cv.hline(x - 1, x + 3, by, col(ramp, 0))
        cv.hline(x, x + 2, by + 1, col(ramp, 4))


def draw_ac_wall(cv, x, y):
    """Compact wall-mounted outdoor AC unit (11x8) with grille & pipe."""
    cv.outline_box(x, y, x + 11, y + 8, col('coolwhite', 4), col('steel', 1), top_hi=col('white', 6), bot_sh=col('steel', 2))
    cv.rect(x + 2, y + 2, x + 7, y + 6, col('steel', 1))
    cv.p(x + 3, y + 3, col('steel', 4))
    cv.p(x + 5, y + 3, col('steel', 4))
    cv.p(x + 4, y + 4, col('steel', 5))
    cv.p(x + 3, y + 5, col('steel', 3))
    cv.p(x + 5, y + 5, col('steel', 3))
    cv.vline(x + 8, y + 2, y + 6, col('steel', 3))
    cv.vline(x + 9, y + 2, y + 6, col('steel', 2))
    cv.hline(x + 1, x + 11, y + 8, col('ink', 1))


def draw_hanging_lantern(cv, cx, y0, ramp='red', glow='yellow:5', tall=True):
    """Warm glowing chochin or glass alley lantern."""
    h = 9 if tall else 6
    cv.p(cx, y0, col('ink', 0))
    cv.hline(cx - 1, cx + 2, y0 + 1, col('darkwood', 1))
    for dy in range(2, h - 1):
        y = y0 + dy
        cv.p(cx - 2, y, col(ramp, 1))
        cv.p(cx + 2, y, col(ramp, 1))
        if dy % 2 == 0:
            cv.p(cx - 1, y, col(ramp, 4))
            cv.p(cx, y, glow)
            cv.p(cx + 1, y, col(ramp, 3))
        else:
            cv.p(cx - 1, y, col(ramp, 3))
            cv.p(cx, y, col(ramp, 5))
            cv.p(cx + 1, y, col(ramp, 2))
    cv.hline(cx - 1, cx + 2, y0 + h - 1, col('darkwood', 1))
    cv.p(cx, y0 + h, col('ink', 1))


def draw_potted_plant(cv, x, y_bot, pot_ramp='brick', blossom=None, seed=0):
    """Compact sidewalk terracotta potted plant (7x10)."""
    # Pot
    cv.outline_box(x + 1, y_bot - 5, x + 6, y_bot, col(pot_ramp, 4), col(pot_ramp, 1), top_hi=col(pot_ramp, 5))
    cv.hline(x, x + 7, y_bot - 5, col(pot_ramp, 5))
    cv.hline(x + 1, x + 6, y_bot - 4, col(pot_ramp, 2))
    # Foliage crown
    cv.foliage_cluster(x + 3, y_bot - 8, 3, 3, ramp='foliage', seed=seed, blossom=blossom)


def draw_ground_curb(cv, x0, x1, y_bot, ramp='concrete'):
    """Crisp bottom grounding foundation & cast sidewalk curb shadow."""
    cv.hline(x0, x1, y_bot - 2, col(ramp, 3))
    cv.hline(x0, x1, y_bot - 1, col('ink', 1))
    cv.hline(x0 + 1, x1 - 1, y_bot, col('ink', 0))


def frame_walls(cv, x0, y0, x1, y1, shade_left=True):
    """Crisp warm-violet architectural edge outlines & subtle left/right bevel."""
    for y in range(y0, y1):
        if shade_left:
            cv.p(x0, y, col('ink', 1))
        cv.p(x1 - 1, y, col('ink', 0))
        if x1 - 2 > x0:
            cv.p(x1 - 2, y, shade_rgba(cv.get(x1 - 2, y), -1))


# ---------------------------------------------------------------------------
# 1. mf-bldg-nl_coin_laundry (80x96)
# ---------------------------------------------------------------------------

def build_coin_laundry():
    W, H = 80, 96
    cv = Canvas(W, H)

    # 1) Pitched dark kawara roof (y=2..27)
    draw_kawara_roof(cv, 2, 2, 78, 27, ramp='kawara', moss=0.05,
                     onigawara=True, skylight=(12, 10, 12, 8), vent=(62, 11), seed=101)

    # 2) 2F Lived-in Apartment (y=28..53)
    cv.stipple_rect(3, 28, 77, 54, 'cream', 4, lo_i=3, hi_i=5, seed=102, rate=0.16)
    cv.hline(3, 77, 28, col('ink', 1))
    cv.hline(3, 77, 29, col('cream', 2))  # Eave shadow
    frame_walls(cv, 3, 28, 77, 54)

    # 2F Left-center apartment sliding window + laundry clothesline & balcony rail
    cv.window(8, 32, 44, 48, style='warm', frame='steel:1', sill='concrete:5', curtain='teal', seed=103)
    # Clothesline pole & colorful hanging laundry above railing
    cv.hline(7, 46, 37, col('steel', 5))
    cv.hline(7, 46, 38, col('steel', 2))
    # Hanging white shirt
    cv.outline_box(11, 38, 18, 45, col('white', 5), col('coolwhite', 1), top_hi=col('white', 6))
    # Hanging blue shirt
    cv.outline_box(20, 38, 27, 45, col('blue', 4), col('blue', 1), top_hi=col('blue', 5))
    # Hanging pink towel
    cv.outline_box(29, 38, 35, 46, col('pink', 4), col('pink', 1), top_hi=col('pink', 5))
    # Hanging yellow cloth
    cv.outline_box(37, 38, 42, 44, col('yellow', 5), col('yellow', 2))
    # Iron balcony railing
    cv.hline(7, 46, 44, col('steel', 5))
    cv.hline(7, 46, 45, col('steel', 1))
    for rx in range(8, 46, 4):
        cv.vline(rx, 45, 51, col('steel', 2))
    cv.hline(7, 46, 50, col('steel', 4))
    cv.hline(7, 46, 51, col('steel', 0))
    # Small potted plant on balcony corner
    cv.planter_box(38, 46, 45, 51, flower='red:4', pot_ramp='brick')

    # 2F Right small window + wall-mounted AC unit
    cv.window(52, 32, 68, 42, style='blinds', frame='steel:1', sill='concrete:5', seed=104)
    draw_ac_wall(cv, 57, 44)
    # Copper AC conduit pipe down right wall
    cv.vline(69, 46, 54, col('steel', 2))
    cv.vline(70, 46, 54, col('steel', 4))

    # 3) Warm Turquoise Fascia Sign (y=53..64)
    cv.outline_box(2, 53, 78, 64, col('teal', 3), col('teal', 0), top_hi=col('teal', 5), bot_sh=col('teal', 1))
    # Inner glowing white/mint sign badge
    cv.outline_box(5, 55, 75, 62, col('teal', 2), col('teal', 0))
    # Cute soap bubble icon on left of sign
    cv.rect(8, 56, 13, 61, col('coolwhite', 5))
    cv.p(8, 56, col('teal', 2))
    cv.p(12, 56, col('teal', 2))
    cv.p(8, 60, col('teal', 2))
    cv.p(12, 60, col('teal', 2))
    cv.p(9, 57, col('white', 6))
    cv.p(14, 57, col('coolwhite', 5))
    cv.p(15, 59, col('white', 6))
    # Crisp glowing "24H COIN" lettering
    draw_text(cv, '24H COIN', 19, 56, 'yellow:5', spacing=1, shadow='teal:0')
    # Under-sign fluorescent tube & shadow
    cv.hline(4, 76, 64, col('white', 6))
    cv.hline(3, 77, 65, col('ink', 1))

    # 4) 1F Bright Mint / White Ceramic Tiled Facade (y=65..95)
    cv.tile_cladding(3, 65, 77, 94, ramp='coolwhite', base_i=5, cw=4, ch=4, seed=105)
    # Mint-teal ceramic dado band along bottom & left/right trims
    cv.tile_cladding(3, 86, 77, 94, ramp='teal', base_i=4, cw=4, ch=4, seed=106)
    frame_walls(cv, 3, 65, 77, 94)

    # Wide glowing storefront window revealing 4 front-loading washing machines!
    wx0, wy0, wx1, wy1 = 6, 66, 54, 89
    cv.outline_box(wx0, wy0, wx1, wy1, col('cream', 6), col('steel', 1), top_hi=col('teal', 5))
    # Bright glowing fluorescent laundromat interior
    cv.rect(wx0 + 1, wy0 + 1, wx1 - 1, wy0 + 4, col('white', 6))
    cv.rect(wx0 + 1, wy0 + 4, wx1 - 1, wy0 + 9, col('yellow', 5))
    cv.rect(wx0 + 1, wy0 + 9, wx1 - 1, wy1 - 1, col('coolwhite', 3))
    # Hanging fluorescent light fixtures inside
    cv.hline(wx0 + 5, wx0 + 18, wy0 + 2, col('coolwhite', 5))
    cv.hline(wx0 + 26, wx0 + 42, wy0 + 2, col('coolwhite', 5))
    # Overhead soap/detergent bottles on shelf
    for sx, sc in [(10, 'blue:4'), (14, 'pink:4'), (18, 'yellow:4'), (31, 'teal:4'), (36, 'orange:4'), (45, 'red:4')]:
        cv.rect(sx, wy0 + 5, sx + 3, wy0 + 9, sc)
        cv.p(sx + 1, wy0 + 4, col('white', 6))
    cv.hline(wx0 + 2, wx1 - 2, wy0 + 9, col('wood', 4))

    # Row of 4 front-loading stainless washing machines with round glass portholes!
    drum_colors = ['blue:4', 'pink:4', 'yellow:4', 'teal:4']
    for i in range(4):
        mx = wx0 + 3 + i * 11
        my = wy0 + 10
        # Stainless steel body (10x12)
        cv.outline_box(mx, my, mx + 10, my + 12, col('coolwhite', 4), col('steel', 1), top_hi=col('white', 6))
        # Control panel strip + tiny glowing green/red LED
        cv.hline(mx + 1, mx + 9, my + 2, col('steel', 2))
        cv.p(mx + 2, my + 1, col('green', 4) if i % 2 == 0 else col('orange', 4))
        cv.p(mx + 7, my + 1, col('steel', 5))
        # Round glass porthole door (6x6)
        px0, py0 = mx + 2, my + 4
        cv.rect(px0, py0, px0 + 6, py0 + 6, col('steel', 2))
        cv.p(px0, py0, col('coolwhite', 4))
        cv.p(px0 + 5, py0, col('coolwhite', 4))
        cv.p(px0, py0 + 5, col('coolwhite', 4))
        cv.p(px0 + 5, py0 + 5, col('coolwhite', 4))
        # Dark glass interior + spinning colorful laundry + white suds
        cv.rect(px0 + 1, py0 + 1, px0 + 5, py0 + 5, col('glass', 1))
        cv.p(px0 + 2, py0 + 3, drum_colors[i])
        cv.p(px0 + 3, py0 + 3, drum_colors[i])
        cv.p(px0 + 2, py0 + 4, col('white', 6))
        cv.p(px0 + 3, py0 + 4, col('coolwhite', 5))
        # Crisp diagonal glass glint
        cv.p(px0 + 1, py0 + 1, col('glass', 6))
        cv.p(px0 + 2, py0 + 1, col('glass', 5))

    # Crisp glass window reflection diagonals over storefront
    for d in range(6):
        cv.p(wx0 + 3 + d, wy0 + 3 + d, col('glass', 6))
        cv.p(wx0 + 28 + d, wy0 + 3 + d, col('glass', 6))
    # Window sill
    cv.hline(wx0 - 1, wx1 + 1, wy1, col('steel', 5))
    cv.hline(wx0, wx1, wy1 + 1, col('ink', 1))

    # Right 1F glass automatic door (x=57..73, y=67..94)
    cv.door_glass(57, 67, 73, 94, frame='teal:1', warm=True)
    # Glowing pink/blue "OPEN" tag in door glass
    cv.rect(60, 73, 66, 76, col('pink', 4))
    cv.hline(61, 65, 74, col('white', 6))
    # Metal handle bar
    cv.vline(64, 79, 85, col('steel', 6))
    cv.vline(66, 79, 85, col('steel', 6))

    # Right drainpipe & neat blue laundry basket tucked cleanly below window sill
    draw_drainpipe(cv, 74, 28, 94, ramp='steel')
    cv.outline_box(7, 89, 16, 94, col('blue', 4), col('blue', 1), top_hi=col('white', 6))
    cv.hline(8, 15, 90, col('white', 5))
    cv.hline(8, 15, 92, col('blue', 2))
    # Small potted herb beside door
    draw_potted_plant(cv, 47, 94, pot_ramp='brick', blossom='pink:4', seed=107)

    draw_ground_curb(cv, 2, 78, 95, ramp='concrete')
    return cv


# ---------------------------------------------------------------------------
# 2. mf-bldg-nl_sento_chimney (112x128)
# ---------------------------------------------------------------------------

def build_sento_chimney():
    W, H = 112, 128
    cv = Canvas(W, H)

    # 1) Tall Tapered Brick/Concrete Bathhouse Smokestack Chimney rising behind right-rear (y=2..50)
    # Wispy crisp binary-alpha steam puffs curling from chimney top
    for px, py, r in [(86, 1, 2), (91, 2, 2), (96, 1, 2), (100, 3, 2)]:
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if dx * dx + dy * dy <= r * r:
                    c = col('white', 6) if dy < 0 else col('coolwhite', 4)
                    cv.p(px + dx, py + dy, c)

    # Chimney shaft (tapers from width 12 at top to width 18 at roof base)
    for y in range(4, 50):
        t = (y - 4) / 46.0
        half_w = 6 + int(round(t * 3.5))
        cx = 85
        lx0, lx1 = cx - half_w, cx + half_w + 1
        for x in range(lx0, lx1):
            rx = x - lx0
            rw = lx1 - lx0
            if y == 4:
                cv.p(x, y, col('kuro', 1))
            elif y == 5:
                cv.p(x, y, col('kuro', 2) if rx in (0, rw - 1) else col('steel', 5))
            elif x == lx0:
                cv.p(x, y, col('ink', 1))
            elif x == lx1 - 1:
                cv.p(x, y, col('ink', 0))
            elif 12 <= y <= 19:
                # Iconic RED-AND-WHITE bathhouse smokestack warning stripe!
                if 14 <= y <= 16:
                    c_i = 6 if rx < rw // 2 else (4 if rx < rw - 3 else 2)
                    cv.p(x, y, col('white', c_i))
                else:
                    c_i = 4 if rx < rw // 2 else (3 if rx < rw - 3 else 1)
                    cv.p(x, y, col('red', c_i))
            elif y % 8 == 0:
                # Iron tension band around chimney
                cv.p(x, y, col('steel', 1 if rx > rw // 2 else 3))
            else:
                # Weathered warm brick + soot concrete chimney texture
                r_n = hsh(x // 2, y // 2, 201)
                if y < 26:
                    # Upper concrete & soot cylinder shading
                    if rx <= 2:
                        base = 5
                    elif rx < rw // 2:
                        base = 4
                    elif rx < rw - 3:
                        base = 3
                    else:
                        base = 2
                    cv.p(x, y, col('concrete', max(1, min(6, base + (1 if r_n > 0.78 else 0)))))
                else:
                    # Lower aged red-brick smokestack masonry
                    if rx <= 2:
                        base = 5
                    elif rx < rw // 2:
                        base = 4
                    elif rx < rw - 3:
                        base = 3
                    else:
                        base = 2
                    if y % 3 == 2:
                        base = max(1, base - 1)
                    cv.p(x, y, col('brick', max(1, min(6, base + (1 if r_n > 0.75 else 0)))))

    # 2) Raised Bathhouse Steam-Vent Clerestory Cupola on Main Roof (x=18..64, y=14..28)
    draw_kawara_roof(cv, 16, 14, 66, 23, ramp='kawara', moss=0.04, onigawara=True, seed=202)
    cv.outline_box(20, 23, 62, 31, col('darkwood', 3), col('ink', 0))
    # Glowing steam louvers inside clerestory
    for lx in range(23, 59, 5):
        cv.rect(lx, 24, lx + 3, 29, col('orange', 4))
        cv.p(lx + 1, 25, col('yellow', 5))
        cv.p(lx + 1, 27, col('yellow', 4))

    # 3) Broad Main Bathhouse Pitched Kawara Roof (x=4..108, y=28..56)
    draw_kawara_roof(cv, 4, 28, 108, 56, ramp='kawara', moss=0.07, onigawara=True, seed=203)

    # 4) Upper Traditional Plaster & Timber Bathhouse Wall (x=5..107, y=56..78)
    cv.stipple_rect(5, 56, 107, 79, 'kinari', 4, lo_i=3, hi_i=5, seed=204, rate=0.14)
    cv.hline(5, 107, 56, col('ink', 0))
    cv.hline(5, 107, 57, col('kinari', 2))
    # Heavy dark timber horizontal beam & vertical corner posts
    cv.rect(5, 56, 10, 79, col('darkwood', 3))
    cv.vline(6, 56, 79, col('darkwood', 5))
    cv.rect(102, 56, 107, 79, col('darkwood', 3))
    cv.vline(103, 56, 79, col('darkwood', 4))
    cv.rect(5, 74, 107, 79, col('darkwood', 2))
    cv.hline(5, 107, 74, col('darkwood', 5))
    frame_walls(cv, 5, 56, 107, 79)

    # Twin Upper Frosted Bathhouse Lattice Windows (left & right of central gable)
    for wx in (13, 81):
        cv.outline_box(wx, 60, wx + 18, 72, col('orange', 4), col('darkwood', 1))
        cv.rect(wx + 1, 61, wx + 17, 71, col('yellow', 5))
        cv.hline(wx + 1, wx + 17, 62, col('orange', 3))
        for gx in range(wx + 3, wx + 16, 3):
            cv.vline(gx, 61, 71, col('darkwood', 3))
        cv.hline(wx + 1, wx + 17, 66, col('darkwood', 2))
        cv.hline(wx - 1, wx + 19, 72, col('darkwood', 4))

    # 5) Iconic Sweeping Curved Dark-Kawara Gabled Entrance Roof (Kara-hafu, x=28..84, y=42..73)
    # Draw sweeping curved roof silhouette with central peak
    cx = 56
    for y in range(42, 72):
        ry = y - 42
        # Gentle sweeping bell curve width
        if ry < 20:
            half_w = 3 + int((ry ** 1.15) * 0.88)
        else:
            half_w = 27 + (ry - 20) // 4
        half_w = min(28, half_w)
        gx0, gx1 = cx - half_w, cx + half_w
        # Outer dark kawara eaves curve
        for x in range(gx0, gx1):
            dist_edge = min(x - gx0, gx1 - 1 - x)
            if ry == 0 or dist_edge == 0:
                cv.p(x, y, col('kawara', 0))
            elif dist_edge <= 3 or ry <= 4 or ry >= 26:
                # Curved kawara tile bargeboard & lower eave
                t = 5 if (x + y) % 3 == 0 else (4 if dist_edge <= 2 else 2)
                if x > cx + 6:
                    t = max(1, t - 1)
                if ry == 28:
                    t = 5 if (x % 4) in (1, 2) else 1
                elif ry >= 29:
                    t = 0
                cv.p(x, y, col('kawara', t))
            else:
                # Inside curved gable tympanum: cream plaster + carved darkwood & gold "ゆ" emblem!
                cv.p(x, y, col('cream', 5 if y < 58 else 4))

    # Ornate onigawara finial at peak of kara-hafu gable + subtle upturned eave tips
    cv.outline_box(cx - 3, 39, cx + 4, 44, col('kawara', 4), col('kawara', 0), top_hi=col('kawara', 7))
    cv.p(cx, 40, col('yellow', 5))
    for ex, sgn in ((27, -1), (84, 1)):
        cv.rect(ex, 67, ex + 2, 71, col('kawara', 0))
        cv.p(ex + (0 if sgn < 0 else 1), 66, col('kawara', 5))
        cv.p(ex + (1 if sgn < 0 else 0), 68, col('kawara', 4))

    # Carved darkwood gable beams & round glowing "ゆ" bathhouse emblem plaque
    cv.hline(cx - 19, cx + 19, 65, col('darkwood', 1))
    cv.hline(cx - 19, cx + 19, 66, col('wood', 4))
    cv.vline(cx - 12, 54, 66, col('darkwood', 2))
    cv.vline(cx + 12, 54, 66, col('darkwood', 2))
    # Round red/gold emblem badge with authentic "ゆ" glyph
    cv.outline_box(cx - 8, 50, cx + 8, 64, col('red', 3), col('darkwood', 0), top_hi=col('red', 5))
    cv.outline_box(cx - 7, 51, cx + 7, 63, col('red', 2), col('yellow', 4))
    draw_text_centered(cv, 'ゆ', cx - 6, 52, cx + 6, 62, 'white:6', shadow='red:0')
    # Deep cast shadow under sweeping entrance eave
    cv.hline(29, 83, 72, col('ink', 0))
    cv.hline(30, 82, 73, col('ink', 1))

    # 6) 1F Retro Tiled Lower Bathhouse Facade (x=4..108, y=79..126)
    cv.tile_cladding(4, 79, 108, 118, ramp='tile', base_i=5, cw=4, ch=4, seed=205)
    # Crisp white ceramic trim bands
    cv.hline(5, 107, 79, col('coolwhite', 5))
    cv.hline(5, 107, 80, col('tile', 2))
    # Heavy granite stone foundation plinth (y=118..126)
    cv.brick_wall(4, 118, 108, 126, ramp='stone', base_i=3, course_h=4, brick_w=8, seed=206)
    frame_walls(cv, 4, 79, 108, 126)

    # Left & Right 1F Frosted Bathhouse Windows with wood frames
    for wx in (8, 86):
        cv.outline_box(wx, 85, wx + 18, 107, col('coolwhite', 5), col('wood', 1), top_hi=col('wood', 4))
        # Warm backlit frosted panes
        cv.rect(wx + 1, 86, wx + 17, 106, col('cream', 5))
        for gy in range(88, 106, 5):
            cv.hline(wx + 1, wx + 17, gy, col('wood', 3))
        cv.vline(wx + 9, 86, 106, col('wood', 2))
        cv.hline(wx - 1, wx + 19, 107, col('stone', 5))
        cv.hline(wx, wx + 18, 108, col('ink', 1))

    # Wooden price/info board under right window + small potted bamboo under left
    cv.outline_box(88, 110, 102, 117, col('cedar', 5), col('wood', 1))
    cv.hline(90, 100, 112, col('darkwood', 2))
    cv.hline(90, 98, 114, col('darkwood', 2))
    draw_potted_plant(cv, 9, 125, pot_ramp='stone', seed=207)
    # Wooden bath bucket & milk crate on right sidewalk
    cv.outline_box(97, 118, 105, 125, col('yellow', 4), col('wood', 1), top_hi=col('yellow', 5))
    cv.hline(98, 104, 120, col('cedar', 2))
    cv.hline(98, 104, 123, col('cedar', 2))

    # 7) Center Twin Warm Wood/Glass Sliding Doors with Iconic Blue & Red Split Noren Curtains!
    # Main entrance wooden surround (x=30..82, y=79..124)
    cv.outline_box(30, 79, 82, 124, col('wood', 3), col('darkwood', 0), top_hi=col('cedar', 5))
    # Central bandai pillar separating Men (left) & Women (right) entrances
    cv.rect(54, 80, 58, 124, col('darkwood', 3))
    cv.vline(55, 80, 124, col('wood', 5))

    # Left Door (Men's Bath — Blue split noren!)
    cv.outline_box(32, 82, 54, 122, col('orange', 4), col('darkwood', 1))
    # Warm backlit wood/glass sliding door panels visible below noren
    cv.rect(33, 83, 53, 121, col('yellow', 4))
    for lx in (38, 43, 48):
        cv.vline(lx, 83, 121, col('wood', 3))
    for ly in (100, 106, 112):
        cv.hline(33, 53, ly, col('wood', 3))
    cv.rect(33, 114, 53, 121, col('wood', 4))
    cv.hline(33, 53, 114, col('wood', 1))
    # Blue 3-panel split noren curtain (y=82..98) with crisp 1px slits showing warm glow
    cv.hline(31, 55, 82, col('cedar', 5))  # Bamboo pole
    for p_i in range(3):
        nx0 = 33 + p_i * 7
        nx1 = nx0 + 6
        cv.rect(nx0, 83, nx1, 98, col('blue', 3))
        cv.vline(nx0, 83, 98, col('blue', 4))
        cv.vline(nx1 - 1, 83, 98, col('blue', 1))
        cv.hline(nx0, nx1, 97, col('blue', 1))
        if p_i < 2:
            cv.vline(nx1, 86, 98, col('orange', 4))
    # Crisp white "ゆ" emblem centered across blue noren
    draw_text_centered(cv, 'ゆ', 36, 85, 50, 96, 'white:6', shadow='blue:0')

    # Right Door (Women's Bath — Red split noren!)
    cv.outline_box(58, 82, 80, 122, col('orange', 4), col('darkwood', 1))
    cv.rect(59, 83, 79, 121, col('yellow', 4))
    for lx in (64, 69, 74):
        cv.vline(lx, 83, 121, col('wood', 3))
    for ly in (100, 106, 112):
        cv.hline(59, 79, ly, col('wood', 3))
    cv.rect(59, 114, 79, 121, col('wood', 4))
    cv.hline(59, 79, 114, col('wood', 1))
    # Red 3-panel split noren curtain (y=82..98) with crisp 1px slits showing warm glow
    cv.hline(57, 81, 82, col('cedar', 5))
    for p_i in range(3):
        nx0 = 59 + p_i * 7
        nx1 = nx0 + 6
        cv.rect(nx0, 83, nx1, 98, col('red', 3))
        cv.vline(nx0, 83, 98, col('red', 4))
        cv.vline(nx1 - 1, 83, 98, col('red', 1))
        cv.hline(nx0, nx1, 97, col('red', 1))
        if p_i < 2:
            cv.vline(nx1, 86, 98, col('orange', 4))
    draw_text_centered(cv, 'ゆ', 62, 85, 76, 96, 'white:6', shadow='red:0')

    # Twin warm hanging entrance lanterns flanking the doorways
    draw_hanging_lantern(cv, 27, 83, ramp='orange', glow='yellow:5', tall=True)
    draw_hanging_lantern(cv, 85, 83, ramp='orange', glow='yellow:5', tall=True)

    # Broad stone entrance steps (x=28..84, y=122..127)
    cv.outline_box(28, 122, 84, 127, col('stone', 5), col('stone', 1), top_hi=col('stone', 6))
    cv.hline(29, 83, 124, col('stone', 3))

    draw_ground_curb(cv, 3, 109, 127, ramp='stone')
    return cv


# ---------------------------------------------------------------------------
# 3. mf-bldg-nl_retro_arcade (96x112)
# ---------------------------------------------------------------------------

def build_retro_arcade():
    W, H = 96, 112
    cv = Canvas(W, H)

    # 1) Recessed Flat Roof (y=12..25) + Rooftop AC Units + Giant Rooftop Game Billboard!
    cv.flat_roof(4, 12, 84, 26, deck_ramp='pavement', deck_i=2, para_ramp='steel', seed=301)
    cv.roof_ac(8, 15)
    cv.roof_ac(70, 15)

    # Giant Illuminated Rooftop Game Billboard (x=19..69, y=1..17)
    # Steel support struts
    cv.vline(24, 16, 22, col('steel', 1))
    cv.vline(25, 16, 22, col('steel', 4))
    cv.vline(62, 16, 22, col('steel', 1))
    cv.vline(63, 16, 22, col('steel', 4))
    # Neon-framed billboard box
    cv.outline_box(19, 1, 69, 17, col('navy', 0), col('steel', 1), top_hi=col('steel', 5))
    # Glowing cyan/pink outer neon rim inside frame
    cv.hline(21, 67, 2, col('pink', 4))
    cv.hline(21, 67, 15, col('teal', 5))
    cv.vline(20, 2, 16, col('pink', 4))
    cv.vline(67, 2, 16, col('teal', 5))
    # Cute pixel-art alien/invader icon on left (x=23..32, y=5..12)
    invader = [
        '..#...#..',
        '...#.#...',
        '..#####..',
        '.##.#.##.',
        '#########',
        '#.#####.#',
        '#.#...#.#',
    ]
    for ry, row in enumerate(invader):
        for rx, b in enumerate(row):
            if b == '#':
                cv.p(23 + rx, 5 + ry, col('teal', 5) if ry < 4 else col('green', 4))
    # Bold glowing "GAME" lettering + retro pixel cherry icon on right
    draw_text(cv, 'GAME', 34, 6, 'yellow:5', spacing=1, shadow='red:2')
    cv.rect(60, 8, 63, 11, col('red', 4))
    cv.p(61, 9, col('white', 6))
    cv.rect(62, 10, 65, 13, col('red', 3))
    cv.p(63, 11, col('pink', 5))
    cv.p(62, 6, col('green', 4))
    cv.p(63, 7, col('green', 5))

    # 2) 3F & 2F Dark-Navy Panel Facade (x=4..84, y=26..74)
    cv.siding_wall(4, 26, 84, 74, ramp='navy', base_i=1, horizontal=False, step=4, seed=302)
    cv.hline(4, 84, 26, col('ink', 0))
    cv.hline(4, 84, 27, col('navy', 0))
    frame_walls(cv, 4, 26, 84, 74)

    # --- 3F Layout (y=28..48): Glowing Cyan Window Left + 2 Game Posters Right ---
    cv.outline_box(8, 30, 44, 45, col('glass', 1), col('teal', 4), top_hi=col('teal', 5))
    cv.rect(9, 31, 43, 44, col('glass', 3))
    # Glowing arcade light silhouettes inside 3F cyan window
    cv.rect(11, 33, 18, 43, col('pink', 4))
    cv.rect(12, 34, 17, 39, col('yellow', 5))
    cv.rect(21, 34, 29, 43, col('teal', 5))
    cv.rect(22, 35, 28, 39, col('white', 6))
    cv.rect(32, 33, 41, 43, col('blue', 4))
    cv.rect(33, 34, 40, 38, col('teal', 5))
    # Glass diagonal reflection
    for d in range(6):
        cv.p(11 + d, 32 + d, col('glass', 6))
        cv.p(35 + d, 32 + d, col('glass', 6))
    # Backlit Game Poster #1 (Red/Yellow Fighter Flame Art)
    cv.outline_box(48, 29, 63, 45, col('red', 2), col('steel', 5), top_hi=col('yellow', 5))
    cv.rect(50, 31, 61, 38, col('orange', 4))
    cv.rect(53, 32, 58, 37, col('yellow', 5))
    cv.rect(51, 39, 60, 43, col('red', 4))
    cv.p(55, 34, col('white', 6))
    # Backlit Game Poster #2 (Green/Pink Space Shooter)
    cv.outline_box(66, 29, 80, 45, col('navy', 0), col('pink', 4), top_hi=col('pink', 5))
    cv.rect(68, 31, 78, 37, col('blue', 3))
    cv.p(73, 33, col('yellow', 5))
    cv.p(72, 34, col('white', 6))
    cv.p(74, 34, col('white', 6))
    cv.rect(68, 38, 78, 43, col('pink', 3))
    cv.hline(69, 77, 40, col('teal', 5))

    # Glowing Pink Neon Divider Strip between 3F & 2F (y=47..49)
    cv.hline(5, 83, 47, col('pink', 5))
    cv.hline(5, 83, 48, col('pink', 3))
    cv.hline(5, 83, 49, col('ink', 0))

    # --- 2F Layout (y=50..72): Completely distinct! Large Poster Left + Panoramic Window Right ---
    # Bold vertical yellow/orange/red retro mecha poster on left
    cv.outline_box(8, 52, 27, 70, col('orange', 3), col('yellow', 5))
    cv.rect(10, 54, 25, 63, col('red', 3))
    cv.rect(14, 55, 21, 61, col('yellow', 5))
    cv.rect(15, 56, 20, 59, col('teal', 5))
    cv.rect(10, 64, 25, 68, col('navy', 1))
    cv.hline(12, 23, 66, col('yellow', 5))

    # Wide panoramic glowing cyan/purple arcade floor window (x=31..79, y=52..69)
    cv.outline_box(31, 52, 79, 69, col('glass', 1), col('steel', 4), top_hi=col('teal', 5))
    cv.rect(32, 53, 78, 68, col('glass', 2))
    # Glowing ceiling neon bar inside 2F
    cv.hline(34, 76, 54, col('pink', 5))
    # Silhouetted rhythm/claw machines & glowing screens
    for sx, sc1, sc2 in [(35, 'teal:5', 'white:6'), (45, 'yellow:5', 'orange:4'), (56, 'pink:4', 'white:6'), (67, 'green:4', 'yellow:5')]:
        cv.rect(sx, 57, sx + 7, 67, col('navy', 1))
        cv.rect(sx + 1, 58, sx + 6, 63, sc1)
        cv.p(sx + 2, 59, sc2)
        cv.hline(sx + 1, sx + 6, 65, col('steel', 4))
    # Window mullion & crisp reflection
    cv.vline(54, 53, 68, col('steel', 2))
    for d in range(5):
        cv.p(33 + d, 55 + d, col('glass', 6))
        cv.p(71 + d, 55 + d, col('glass', 6))

    # Tall Vertical Neon Blade Sign Mounted on Right Side (x=82..95, y=26..78)
    # Iron mounting brackets
    cv.hline(80, 84, 34, col('steel', 3))
    cv.hline(80, 84, 52, col('steel', 3))
    cv.hline(80, 84, 70, col('steel', 3))
    cv.outline_box(83, 26, 95, 77, col('navy', 0), col('pink', 4), top_hi=col('pink', 5), bot_sh=col('pink', 2))
    cv.outline_box(85, 28, 93, 75, col('navy', 1), col('teal', 5))
    # Vertical glowing "GAME" + star
    draw_text_centered(cv, '★GAME', 85, 29, 93, 74, 'yellow:5', vertical=True, spacing=3, shadow='red:2')

    # 3) 1F Glowing Pink/Cyan/Yellow Neon Marquee Canopy (x=2..88, y=72..83)
    cv.outline_box(2, 72, 87, 83, col('navy', 0), col('ink', 0))
    cv.hline(3, 86, 73, col('pink', 4))
    cv.hline(3, 86, 81, col('teal', 5))
    # Chasing marquee bulbs strictly along top & bottom trim (never overlapping text!)
    for bx in range(5, 85, 4):
        cv.p(bx, 73, col('yellow', 5))
        cv.p(bx + 2, 81, col('yellow', 5))
    # Bold glowing "ARCADE" sign text with crisp dark backing
    draw_text_centered(cv, 'ARCADE', 6, 75, 83, 80, 'yellow:5', spacing=2, shadow='pink:1')
    cv.hline(3, 86, 83, col('ink', 0))

    # 4) 1F Glowing Open Arcade Entrance with Colorful Arcade Cabinets Inside (y=84..111)
    # Dark-navy tiled entrance piers left & right
    cv.tile_cladding(3, 84, 13, 110, ramp='navy', base_i=2, cw=4, ch=4, seed=303)
    cv.tile_cladding(76, 84, 86, 110, ramp='navy', base_i=2, cw=4, ch=4, seed=304)
    # Mini glowing game poster + coin sticker on left pier
    cv.outline_box(5, 87, 11, 97, col('yellow', 4), col('pink', 4))
    cv.rect(6, 89, 10, 94, col('red', 4))
    cv.p(8, 91, col('white', 6))
    cv.outline_box(5, 100, 11, 107, col('teal', 2), col('teal', 5))
    cv.hline(6, 10, 103, col('yellow', 5))
    # Gachapon capsule vending machines outside right pier!
    cv.outline_box(77, 92, 85, 109, col('white', 5), col('steel', 1), top_hi=col('white', 6))
    cv.rect(78, 93, 84, 100, col('glass', 5))
    for gx, gy, gc in [(79, 95, 'red:4'), (81, 95, 'yellow:5'), (82, 97, 'blue:4'), (79, 98, 'pink:4'), (81, 98, 'green:4')]:
        cv.p(gx, gy, gc)
    cv.hline(78, 84, 101, col('red', 4))
    cv.rect(80, 103, 82, 106, col('steel', 2))

    # Wide Open Glowing Arcade Interior (x=13..76, y=84..109)
    cv.rect(13, 84, 76, 109, col('navy', 0))
    # Back glowing neon wallpaper stripes
    cv.hline(14, 75, 86, col('pink', 4))
    cv.hline(14, 75, 87, col('teal', 4))
    # Retro checkered glowing arcade floor (y=103..109)
    for y in range(103, 109):
        for x in range(13, 76):
            cv.p(x, y, col('navy', 2) if ((x // 4 + y // 3) % 2 == 0) else col('pink', 1))

    # 4 Vivid Colorful Arcade Cabinets Inside!
    cabs = [
        (15, 'red', 'yellow:5', 'orange:4'),
        (30, 'blue', 'teal:5', 'white:6'),
        (45, 'pink', 'yellow:5', 'pink:5'),
        (60, 'green', 'white:6', 'yellow:5'),
    ]
    for cx0, cramp, scr1, scr2 in cabs:
        # Cabinet silhouette (13x20)
        cv.outline_box(cx0, 88, cx0 + 13, 107, col(cramp, 3), col('ink', 0), top_hi=col(cramp, 5))
        # Glowing top marquee
        cv.rect(cx0 + 1, 89, cx0 + 12, 92, col('yellow', 5) if cramp != 'green' else col('teal', 5))
        cv.hline(cx0 + 2, cx0 + 11, 90, col(cramp, 4))
        # Glowing CRT screen
        cv.outline_box(cx0 + 2, 93, cx0 + 11, 100, scr1, col('ink', 0))
        cv.p(cx0 + 4, 95, scr2)
        cv.p(cx0 + 7, 96, col('red', 4) if cramp != 'red' else col('teal', 5))
        cv.p(cx0 + 5, 98, col('white', 6))
        # Control deck + joysticks & buttons
        cv.hline(cx0 + 1, cx0 + 12, 100, col('steel', 5))
        cv.p(cx0 + 3, 99, col('red', 4))
        cv.p(cx0 + 9, 99, col('yellow', 5))
        # Coin slot lower panel
        cv.rect(cx0 + 4, 102, cx0 + 9, 106, col('steel', 1))
        cv.p(cx0 + 6, 104, col('orange', 4))

    # Entrance side wall frame + warm neon floor spill
    cv.vline(13, 84, 110, col('teal', 5))
    cv.vline(75, 84, 110, col('pink', 4))
    draw_ground_curb(cv, 3, 87, 111, ramp='asphalt')
    return cv


# ---------------------------------------------------------------------------
# 4. mf-bldg-nl_karaoke_neon_tower (80x144)
# ---------------------------------------------------------------------------

def build_karaoke_neon_tower():
    W, H = 80, 144
    cv = Canvas(W, H)

    # 1) Rooftop Illuminated Neon Crown Frame (x=12..68, y=1..14) + Flat Roof (y=12..24)
    cv.flat_roof(6, 12, 74, 25, deck_ramp='pavement', deck_i=2, para_ramp='steel', seed=401)
    # Stairwell penthouse hatch on left, AC on right
    cv.roof_penthouse(9, 13, w=12, h=9, ramp='steel')
    cv.roof_ac(56, 14)

    # Neon Crown Truss Frame soaring above roof
    cv.outline_box(16, 2, 64, 14, col('navy', 0), col('steel', 3))
    cv.clear(18, 4, 62, 12)  # Open steel neon frame look, backed by neon bars!
    # Re-fill subtle truss struts & bright stacked neon crown tubes
    cv.vline(16, 2, 15, col('steel', 4))
    cv.vline(63, 2, 15, col('steel', 4))
    cv.vline(30, 3, 14, col('steel', 2))
    cv.vline(49, 3, 14, col('steel', 2))
    cv.hline(16, 64, 2, col('pink', 5))
    cv.hline(17, 63, 3, col('pink', 4))
    cv.hline(17, 63, 12, col('teal', 5))
    cv.hline(17, 63, 13, col('teal', 3))
    # Central glowing neon badge with music note & crisp padding
    cv.outline_box(22, 3, 58, 13, col('navy', 0), col('yellow', 5))
    draw_text_centered(cv, '♪SING♪', 23, 4, 57, 12, 'yellow:5', spacing=1, shadow='pink:2')

    # 2) Dark-Slate Ceramic Tile Tower Body (x=6..70, y=25..108)
    cv.tile_cladding(8, 25, 68, 108, ramp='kuro', base_i=3, cw=4, ch=4, seed=402)
    cv.hline(8, 68, 25, col('ink', 0))
    frame_walls(cv, 8, 25, 68, 108)

    # --- 4F (y=27..51): Wide Pink Party Window Left + Narrow Cyan Stair Window Right + Yellow Horizontal Sign ---
    cv.outline_box(11, 28, 42, 41, col('pink', 2), col('steel', 4), top_hi=col('pink', 5))
    cv.rect(12, 29, 41, 40, col('pink', 3))
    # Glowing disco mirror-ball & colorful karaoke mood lights inside 4F
    cv.rect(24, 30, 29, 34, col('white', 6))
    cv.p(25, 31, col('teal', 5))
    cv.p(27, 32, col('yellow', 5))
    cv.rect(14, 36, 39, 39, col('pink', 4))
    cv.hline(15, 38, 37, col('yellow', 5))
    cv.vline(26, 29, 40, col('steel', 1))
    # Narrow stairwell cyan window on right
    cv.window(46, 29, 62, 41, style='glass', frame='steel:2', sill='steel:4', seed=403)
    # Staircase diagonal visible inside stairwell glass
    for d in range(8):
        cv.p(48 + d, 39 - d, col('yellow', 5))
    # Horizontal glowing YELLOW/ORANGE neon sign below 4F (9px tall for crisp 5px text!)
    cv.outline_box(9, 43, 65, 52, col('orange', 1), col('yellow', 5))
    draw_text_centered(cv, 'VIP ROOM', 11, 45, 63, 50, 'white:6', spacing=1, shadow='orange:0')

    # --- 3F (y=53..78): Distinct! Small Amber Window Left + Double Teal Lounge Window Center + AC + Teal Sign ---
    cv.window(11, 55, 25, 66, style='warm', frame='steel:2', sill='steel:5', curtain='red', seed=404)
    # Wall AC right underneath left window
    draw_ac_wall(cv, 12, 68)
    # Double glowing teal/blue karaoke lounge window
    cv.outline_box(29, 54, 63, 67, col('teal', 2), col('steel', 5), top_hi=col('teal', 5))
    cv.rect(30, 55, 62, 66, col('teal', 4))
    # Glowing screen & sofa inside 3F
    cv.rect(33, 57, 44, 63, col('yellow', 5))
    cv.rect(35, 58, 42, 61, col('white', 6))
    cv.rect(48, 57, 59, 64, col('glass', 5))
    cv.p(52, 59, col('pink', 4))
    cv.p(55, 61, col('yellow', 5))
    cv.vline(46, 55, 66, col('steel', 1))
    # Horizontal glowing TEAL neon fascia sign (9px tall for crisp 5px text!)
    cv.outline_box(24, 69, 66, 78, col('teal', 0), col('teal', 5))
    draw_text_centered(cv, '24H LIVE', 25, 71, 65, 76, 'yellow:5', spacing=1, shadow='teal:1')

    # --- 2F (y=79..107): Distinct! Tall Golden Karaoke Bay Window Center + Dark Mirror Neon Window Right + Orange Sign ---
    cv.outline_box(16, 80, 43, 96, col('orange', 3), col('yellow', 4), top_hi=col('yellow', 5))
    cv.rect(17, 81, 42, 95, col('yellow', 4))
    cv.hline(17, 42, 82, col('orange', 4))
    # Red velvet karaoke sofa & microphone stand silhouette inside!
    cv.rect(19, 90, 34, 94, col('red', 3))
    cv.hline(20, 33, 90, col('red', 4))
    cv.vline(37, 85, 94, col('ink', 0))
    cv.p(37, 84, col('white', 6))
    cv.vline(29, 81, 95, col('darkwood', 2))
    # Right dark-glass window with glowing pink neon heart/note inside
    cv.outline_box(46, 81, 64, 95, col('glass', 0), col('steel', 4))
    cv.rect(47, 82, 63, 94, col('navy', 1))
    draw_text_centered(cv, '♪', 49, 83, 61, 93, 'pink:5')
    # Horizontal glowing ORANGE/RED neon sign (9px tall for crisp 5px text!)
    cv.outline_box(15, 98, 66, 107, col('red', 1), col('orange', 4))
    draw_text_centered(cv, 'KARAOKE', 16, 100, 65, 105, 'yellow:5', spacing=1, shadow='red:0')

    # --- STACKED COLORFUL VERTICAL BLADE SIGNS (Both Sides!) ---
    # Right Upper Vertical Blade Sign (Pink/Yellow Korean "노래방", x=67..79, y=26..66)
    cv.hline(65, 68, 34, col('steel', 4))
    cv.hline(65, 68, 58, col('steel', 4))
    cv.outline_box(67, 26, 79, 66, col('pink', 2), col('pink', 5), top_hi=col('white', 6))
    cv.outline_box(69, 28, 77, 64, col('pink', 1), col('yellow', 5))
    draw_text_centered(cv, '노래방', 69, 30, 77, 62, 'white:6', vertical=True, spacing=3, shadow='pink:0')

    # Right Lower Vertical Blade Sign (Orange/Yellow "24H", x=67..79, y=70..107)
    cv.hline(65, 68, 78, col('steel', 4))
    cv.hline(65, 68, 98, col('steel', 4))
    cv.outline_box(67, 70, 79, 107, col('orange', 2), col('yellow', 5), top_hi=col('white', 6))
    draw_text_centered(cv, '24H♪', 69, 73, 77, 104, 'yellow:5', vertical=True, spacing=2, shadow='red:0')

    # Left Vertical Blade Sign (Teal/Cyan "CLUB", x=1..13, y=58..105)
    cv.hline(12, 16, 68, col('steel', 4))
    cv.hline(12, 16, 94, col('steel', 4))
    cv.outline_box(1, 58, 13, 105, col('teal', 1), col('teal', 5), top_hi=col('coolwhite', 5))
    cv.outline_box(3, 60, 11, 103, col('navy', 0), col('teal', 4))
    draw_text_centered(cv, 'SONG', 3, 63, 11, 100, 'teal:5', vertical=True, spacing=4, shadow='navy:0')

    # 3) 1F Bright Lit Glass Stairwell Lobby & Glowing Price Board (y=108..143)
    # Sleek metallic neon-lit lobby canopy (x=5..75, y=108..114)
    cv.outline_box(5, 108, 75, 114, col('steel', 1), col('ink', 0), top_hi=col('teal', 5))
    cv.hline(7, 73, 110, col('pink', 5))
    cv.hline(7, 73, 112, col('yellow', 5))
    # Dark granite 1F entrance wall & columns
    cv.tile_cladding(7, 114, 73, 142, ramp='kuro', base_i=2, cw=4, ch=4, seed=405)
    frame_walls(cv, 7, 114, 73, 142)

    # Left: Glowing Price Board & Menu Case (x=10..27, y=116..139)
    cv.outline_box(10, 116, 27, 139, col('white', 5), col('pink', 4), top_hi=col('yellow', 5))
    cv.rect(11, 117, 26, 121, col('pink', 3))
    cv.hline(13, 24, 119, col('yellow', 5))
    # Color-coded price tier rows
    for ry, rc in [(123, 'teal:4'), (127, 'orange:4'), (131, 'blue:4'), (135, 'red:4')]:
        cv.rect(12, ry, 19, ry + 2, rc)
        cv.rect(21, ry, 25, ry + 2, col('ink', 1))

    # Center-Right: Bright Lit Glass Stairwell Lobby & Double Doors (x=30..70, y=116..141)
    cv.outline_box(30, 116, 70, 141, col('cream', 6), col('steel', 4), top_hi=col('white', 6))
    # Warm bright lobby interior glow
    cv.rect(31, 117, 69, 122, col('white', 6))
    cv.rect(31, 122, 69, 140, col('yellow', 5))
    # Visible illuminated stairs climbing to upper right inside lobby!
    for step_i in range(6):
        sx = 47 + step_i * 3
        sy = 138 - step_i * 3
        cv.rect(sx, sy, 68, sy + 2, col('red', 3))
        cv.hline(sx, 68, sy, col('orange', 4))
    # Diagonal steel stair handrail
    for d in range(18):
        cv.p(46 + d, 133 - d, col('steel', 2))
        cv.p(46 + d, 132 - d, col('steel', 5))
    # Glass double door mullions & handles
    cv.vline(46, 117, 140, col('steel', 2))
    cv.vline(58, 117, 140, col('steel', 2))
    cv.vline(44, 128, 134, col('steel', 6))
    cv.vline(48, 128, 134, col('steel', 6))
    # Bright lobby entrance carpet mat
    cv.rect(34, 139, 54, 142, col('red', 3))
    cv.hline(35, 53, 140, col('yellow', 5))

    draw_ground_curb(cv, 6, 74, 143, ramp='asphalt')
    return cv


# ---------------------------------------------------------------------------
# 5. mf-bldg-nl_pojangmacha_hall (112x80)
# ---------------------------------------------------------------------------

def build_pojangmacha_hall():
    W, H = 112, 80
    cv = Canvas(W, H)

    # 1) Corrugated Metal Gable/Pitched Roof (x=3..109, y=4..27) + Kitchen Exhaust Ducts!
    draw_corrugated_roof(cv, 3, 5, 109, 27, ramp='steel', rust_rate=0.18, seed=501)

    # Twin Kitchen Galvanized Exhaust Ducts rising from roof with steam wisps
    for dx in (16, 84):
        cv.outline_box(dx, 2, dx + 10, 6, col('steel', 5), col('steel', 0), top_hi=col('white', 5))
        cv.outline_box(dx + 2, 6, dx + 8, 19, col('steel', 4), col('steel', 1))
        cv.vline(dx + 3, 6, 18, col('steel', 6))
        cv.hline(dx + 2, dx + 8, 11, col('steel', 2))
        cv.hline(dx + 2, dx + 8, 15, col('steel', 2))
        # Crisp warm steam pixel puffs
        cv.p(dx + 4, 0, col('white', 6))
        cv.p(dx + 6, 1, col('coolwhite', 5))
        cv.p(dx + 8, 0, col('coolwhite', 4))
    # Center roof vent hood
    cv.outline_box(49, 8, 63, 16, col('steel', 4), col('steel', 1), top_hi=col('steel', 6))
    cv.hline(51, 61, 12, col('steel', 1))
    cv.hline(51, 61, 14, col('steel', 2))

    # Retro Warm Lit Korean Signboard centered under eaves (x=25..87, y=16..29)
    cv.outline_box(25, 16, 87, 29, col('red', 2), col('darkwood', 0), top_hi=col('orange', 4))
    cv.outline_box(27, 18, 85, 27, col('yellow', 5), col('red', 1))
    draw_text_centered(cv, '포차 POCHA', 28, 19, 84, 26, 'red:1', spacing=2)

    # 2) Iconic Orange-and-Red Vinyl Tarpaulin Tent Awning (x=2..110, y=28..45)
    for y in range(28, 44):
        ry = y - 28
        for x in range(2, 110):
            rx = x - 2
            stripe = (rx // 8) % 2
            rmp = 'orange' if stripe == 0 else 'red'
            if ry == 0:
                cv.p(x, y, col(rmp, 1))
            elif ry == 15:
                # Scalloped vinyl lower flap edge
                cv.p(x, y, col(rmp, 0) if rx % 8 in (0, 7) else col(rmp, 1))
            elif ry == 14:
                cv.p(x, y, col(rmp, 2))
            else:
                # Subtle wrinkled vinyl sheen & top-left sunlit folds
                fold = 1 if (rx % 8 in (1, 2) and ry < 11) else (-1 if rx % 8 == 7 else 0)
                base = 4 if ry < 8 else 3
                cv.p(x, y, col(rmp, max(1, min(5, base + fold))))
    # Taut rope ties & steel grommets along awning bottom
    cv.hline(2, 110, 44, col('ink', 0))
    for gx in range(6, 108, 16):
        cv.p(gx, 42, col('steel', 6))

    # 3) Warm Wooden-Frame Alley Tavern Open Interior (x=4..108, y=45..78)
    # Exposed weathered wood structural posts & back warm cedar paneling
    cv.siding_wall(5, 45, 107, 77, ramp='wood', base_i=3, horizontal=True, step=4, seed=502)
    # Cozy amber interior lighting gradient across open hall
    cv.rect(13, 45, 99, 68, col('cedar', 4))
    cv.rect(13, 45, 99, 51, col('orange', 3))
    cv.rect(13, 66, 99, 77, col('stone', 2))  # Warm-lit tavern concrete floor

    # Heavy left & right wooden tavern frame posts + rolled-up orange vinyl side curtains
    cv.rect(4, 44, 13, 77, col('orange', 3))
    cv.vline(4, 44, 77, col('ink', 0))
    cv.vline(6, 44, 77, col('orange', 5))
    cv.vline(11, 44, 77, col('wood', 2))
    cv.vline(12, 44, 77, col('wood', 4))
    cv.rect(99, 44, 108, 77, col('red', 3))
    cv.vline(99, 44, 77, col('wood', 4))
    cv.vline(100, 44, 77, col('wood', 2))
    cv.vline(105, 44, 77, col('red', 4))
    cv.vline(107, 44, 77, col('ink', 0))
    # Clear vinyl window slits on side tarps
    cv.outline_box(6, 51, 11, 61, col('yellow', 5), col('orange', 1))
    cv.outline_box(101, 51, 106, 61, col('yellow', 5), col('red', 1))

    # Glowing Bare String Bulbs hanging in a warm swag under the awning (y=45..49)
    cv.hline(12, 100, 45, col('ink', 1))
    for bx in range(18, 98, 12):
        by = 46 + (1 if (bx // 12) % 2 == 0 else 0)
        cv.p(bx, by - 1, col('ink', 0))
        # Soft warm amber glow halo around each bare filament bulb
        cv.p(bx - 2, by + 1, col('orange', 4))
        cv.p(bx + 2, by + 1, col('orange', 4))
        cv.rect(bx - 1, by, bx + 2, by + 2, col('yellow', 4))
        cv.p(bx, by, col('white', 6))
        cv.p(bx, by + 1, col('yellow', 5))

    # Varied Hand-Written Back-Wall Menu Placards, Soju Poster & Chalkboard (no cloned cards!)
    # 1) Cream vertical calligraphy slip
    cv.outline_box(17, 49, 23, 56, col('cream', 5), col('wood', 1))
    cv.vline(20, 50, 55, col('darkwood', 1))
    cv.p(19, 51, col('darkwood', 2))
    cv.p(18, 54, col('red', 4))
    # 2) Shorter yellow slip with horizontal menu lines
    cv.outline_box(25, 50, 32, 56, col('yellow', 5), col('wood', 1))
    cv.hline(27, 30, 52, col('darkwood', 2))
    cv.hline(27, 31, 54, col('red', 3))
    # 3) Wide red-framed white daily special placard
    cv.outline_box(34, 49, 44, 56, col('white', 6), col('red', 2))
    cv.hline(36, 42, 51, col('red', 4))
    cv.hline(36, 40, 53, col('ink', 1))
    cv.p(42, 53, col('ink', 1))
    # Wall hook gap at x=45..48
    cv.p(46, 52, col('steel', 4))
    cv.p(46, 53, col('steel', 2))
    # 4) Classic green Korean soju poster placard
    cv.outline_box(49, 49, 56, 56, col('cream', 5), col('green', 1))
    cv.hline(50, 55, 50, col('green', 4))
    cv.vline(52, 51, 55, col('green', 3))
    cv.p(53, 53, col('green', 4))
    # 5) Staggered cream two-column menu card
    cv.outline_box(58, 50, 65, 57, col('cream', 5), col('wood', 1))
    cv.vline(60, 51, 55, col('darkwood', 2))
    cv.vline(62, 52, 56, col('darkwood', 1))
    # 6) Warm cedar wooden hanging menu plaque
    cv.outline_box(67, 49, 74, 55, col('cedar', 5), col('darkwood', 1))
    cv.hline(69, 72, 51, col('darkwood', 1))
    cv.p(70, 53, col('darkwood', 2))
    cv.p(72, 53, col('red', 3))
    # 7) Bright yellow tall hand-brushed slip with top red stamp
    cv.outline_box(76, 49, 82, 56, col('yellow', 5), col('wood', 1))
    cv.p(80, 50, col('red', 4))
    cv.hline(78, 80, 52, col('darkwood', 1))
    cv.vline(79, 52, 55, col('darkwood', 2))
    # 8) Wide dark chalkboard price list on far right
    cv.outline_box(84, 49, 95, 56, col('ink', 1), col('wood', 3))
    cv.hline(86, 91, 51, col('yellow', 5))
    cv.hline(86, 93, 53, col('white', 6))
    cv.p(93, 51, col('orange', 4))

    # Steaming Food Counter spanning open interior (x=16..95, y=58..71)
    # Stainless steel & warm wood bar top
    cv.outline_box(16, 58, 95, 63, col('coolwhite', 4), col('wood', 1), top_hi=col('white', 6))
    cv.siding_wall(16, 63, 95, 72, ramp='wood', base_i=4, horizontal=False, step=4, seed=503)
    cv.hline(16, 95, 63, col('darkwood', 1))
    cv.hline(16, 95, 71, col('darkwood', 0))

    # Steaming Tteokbokki Tray, Odeng Broth Pot & Dishes on Counter!
    # Spicy red tteokbokki pan (left)
    cv.outline_box(21, 56, 36, 61, col('red', 4), col('steel', 1))
    cv.hline(23, 34, 58, col('orange', 4))
    cv.p(26, 57, col('yellow', 5))
    cv.p(31, 59, col('yellow', 5))
    # Steaming silver odeng/ramen broth vat (center)
    cv.outline_box(42, 55, 58, 61, col('steel', 5), col('steel', 1), top_hi=col('white', 6))
    cv.rect(44, 56, 56, 59, col('orange', 4))
    for sx in (45, 49, 53):
        cv.vline(sx, 54, 58, col('cedar', 6))  # Skewers!
    # Rising crisp white steam wisps above pots!
    for stx, sty in [(26, 53), (27, 51), (31, 54), (47, 52), (48, 50), (52, 53), (53, 51)]:
        cv.p(stx, sty, col('white', 6))
        cv.p(stx + 1, sty + 1, col('coolwhite', 5))
    # Grill pan & green soju bottles on right counter
    cv.outline_box(64, 56, 78, 61, col('asphalt', 2), col('steel', 1))
    cv.p(67, 58, col('orange', 4))
    cv.p(71, 58, col('red', 4))
    cv.p(74, 58, col('yellow', 5))
    for bx in (82, 85, 89):
        cv.vline(bx, 55, 60, col('green', 4))
        cv.p(bx, 54, col('white', 6))

    # Iconic Row of 6 Red Plastic Stools tucked along Counter (y=68..77)
    for sx in (20, 32, 44, 56, 68, 82):
        # Round/square red plastic top
        cv.outline_box(sx, 68, sx + 8, 72, col('red', 4), col('red', 0), top_hi=col('red', 5))
        # Stool legs
        cv.vline(sx + 1, 72, 77, col('red', 2))
        cv.vline(sx + 2, 72, 77, col('red', 4))
        cv.vline(sx + 5, 72, 77, col('red', 4))
        cv.vline(sx + 6, 72, 77, col('red', 1))
        cv.hline(sx + 1, sx + 7, 74, col('red', 2))

    # Stacked Green Soju Crates on Left Sidewalk & Propane Cylinder on Right
    cv.outline_box(4, 67, 13, 77, col('green', 3), col('green', 0), top_hi=col('green', 5))
    cv.hline(5, 12, 71, col('green', 1))
    cv.p(6, 69, col('white', 6))
    cv.p(9, 69, col('white', 6))
    # Steel propane tank outside right edge
    cv.outline_box(100, 65, 107, 77, col('steel', 4), col('steel', 0), top_hi=col('steel', 6))
    cv.hline(101, 106, 68, col('red', 4))
    cv.rect(102, 63, 105, 65, col('steel', 2))

    draw_ground_curb(cv, 3, 109, 79, ramp='concrete')
    return cv


# ---------------------------------------------------------------------------
# 6. mf-bldg-nl_lp_bar_extstair (80x112)
# ---------------------------------------------------------------------------

def build_lp_bar_extstair():
    W, H = 80, 112
    cv = Canvas(W, H)

    # 1) 2.5F Flat Rooftop Garden with Plants & Cozy Attic Shed (y=2..25)
    cv.flat_roof(12, 11, 76, 25, deck_ramp='pavement', deck_i=2, para_ramp='concrete', seed=601)
    # Tiny rooftop storage/music attic cabin (x=31..53, y=2..17)
    cv.outline_box(31, 2, 53, 7, col('darkwood', 3), col('ink', 0), top_hi=col('wood', 5))
    cv.siding_wall(32, 7, 52, 18, ramp='wood', base_i=3, horizontal=False, step=3, seed=602)
    cv.outline_box(35, 9, 43, 15, col('yellow', 5), col('darkwood', 1))
    cv.vline(39, 9, 15, col('darkwood', 2))
    cv.door_wood(45, 8, 51, 18, ramp='darkwood', glass_top=False)
    # Lush rooftop plants & planter boxes left & right!
    cv.planter_box(14, 14, 28, 21, flower='yellow:5', pot_ramp='brick')
    cv.foliage_cluster(19, 12, 5, 4, ramp='foliage', seed=603)
    cv.planter_box(56, 14, 72, 21, flower='orange:4', pot_ramp='wood')
    cv.foliage_cluster(65, 11, 6, 4, ramp='foliage', seed=604, blossom='pink:4')
    # Trailing green vines hanging casually over the parapet edge!
    for vx, vl in [(17, 7), (22, 5), (60, 8), (68, 6)]:
        for dy in range(vl):
            cv.p(vx + (dy % 2), 21 + dy, col('foliage', 4 if dy < vl - 2 else 2))

    # 2) 2F Atmospheric Euljiro / Shimokitazawa Vinyl LP Bar (x=14..76, y=25..66)
    cv.brick_wall(14, 25, 76, 66, ramp='brick', base_i=3, course_h=3, brick_w=6, seed=605)
    cv.hline(14, 76, 25, col('ink', 0))
    cv.hline(14, 76, 26, col('brick', 1))
    frame_walls(cv, 14, 25, 76, 66)

    # Vintage Carved Timber Signboard "LP BAR" + Spinning Vinyl Disc Emblem (x=18..72, y=28..37)
    cv.outline_box(18, 28, 72, 37, col('darkwood', 1), col('ink', 0), top_hi=col('wood', 4))
    # Vinyl LP record icon on left (x=21..28, y=29..36)
    cv.rect(22, 29, 27, 36, col('kuro', 0))
    cv.rect(21, 30, 28, 35, col('kuro', 1))
    cv.p(23, 30, col('steel', 4))
    cv.p(26, 34, col('steel', 4))
    cv.rect(23, 31, 26, 34, col('orange', 4))
    cv.p(24, 32, col('yellow', 5))
    draw_text(cv, 'LP BAR', 32, 30, 'yellow:5', spacing=2, shadow='darkwood:0')

    # 2F Heavy Wood Bar Door on Left Landing (x=18..33, y=40..64)
    cv.outline_box(18, 40, 33, 64, col('darkwood', 3), col('ink', 0), top_hi=col('wood', 4))
    for vx in (21, 25, 29):
        cv.vline(vx, 41, 63, col('darkwood', 1))
    # Round warm amber porthole glass in heavy door
    cv.rect(23, 44, 29, 50, col('orange', 4))
    cv.rect(24, 45, 28, 49, col('yellow', 5))
    cv.p(23, 44, col('darkwood', 3))
    cv.p(28, 44, col('darkwood', 3))
    cv.p(23, 49, col('darkwood', 3))
    cv.p(28, 49, col('darkwood', 3))
    # Brass doorknob & iron strap hinge
    cv.p(30, 54, col('yellow', 5))
    cv.hline(19, 23, 45, col('steel', 2))
    cv.hline(19, 23, 58, col('steel', 2))

    # Warm Hanging Amber Lantern beside 2F Door! (x=14..18, y=41..50)
    cv.hline(14, 19, 41, col('steel', 1))
    draw_hanging_lantern(cv, 15, 41, ramp='orange', glow='white:6', tall=False)

    # 2F Warm Backlit Music-Bar Windows with Vinyl Record Shelves Visible! (x=38..72, y=40..60)
    cv.outline_box(38, 40, 72, 60, col('orange', 3), col('darkwood', 0), top_hi=col('wood', 4))
    cv.rect(39, 41, 71, 59, col('orange', 4))
    cv.rect(39, 41, 71, 46, col('orange', 3))
    # Warm glowing brass pendant lamp inside window
    cv.vline(55, 41, 44, col('darkwood', 1))
    cv.hline(53, 58, 44, col('yellow', 5))
    cv.p(55, 45, col('white', 6))
    # Silhouetted colorful vinyl LP record shelves along back wall!
    cv.hline(40, 70, 50, col('darkwood', 2))
    cv.hline(40, 70, 56, col('darkwood', 2))
    spine_cols = ['red:3', 'blue:3', 'yellow:4', 'teal:3', 'cream:5', 'orange:3', 'pink:3', 'green:3']
    for i, sx in enumerate(range(41, 69, 2)):
        cv.vline(sx, 46, 50, spine_cols[i % len(spine_cols)])
        cv.vline(sx, 51, 56, spine_cols[(i + 3) % len(spine_cols)])
    # Turntable silhouette on counter
    cv.rect(42, 57, 50, 59, col('kuro', 1))
    cv.hline(43, 49, 57, col('steel', 5))
    # Wooden window mullions & sill
    cv.vline(55, 41, 59, col('darkwood', 1))
    cv.hline(37, 73, 60, col('wood', 5))
    cv.hline(38, 72, 61, col('ink', 1))

    # 3) 1F Weathered Brick Alley Shop (x=18..76, y=67..110)
    cv.brick_wall(18, 67, 76, 110, ramp='brick', base_i=2, course_h=3, brick_w=6, seed=606)
    cv.hline(18, 76, 67, col('ink', 0))
    cv.hline(18, 76, 68, col('brick', 0))
    # Stone water-table plinth along bottom
    cv.brick_wall(18, 102, 76, 110, ramp='stone', base_i=2, course_h=4, brick_w=8, seed=607)
    frame_walls(cv, 18, 67, 76, 110)

    # 1F Wooden Shuttered Doorway (x=28..45, y=80..109)
    cv.outline_box(28, 80, 45, 109, col('wood', 3), col('darkwood', 0), top_hi=col('wood', 4))
    for sx in range(30, 44, 3):
        cv.vline(sx, 81, 108, col('darkwood', 2))
        cv.vline(sx + 1, 81, 108, col('wood', 4))
    # Heavy horizontal wooden shutter battens & iron latch
    cv.hline(29, 44, 88, col('darkwood', 1))
    cv.hline(29, 44, 89, col('wood', 5))
    cv.hline(29, 44, 100, col('darkwood', 1))
    cv.hline(29, 44, 101, col('wood', 5))
    cv.rect(40, 93, 43, 96, col('steel', 3))
    # Small vintage gig flyer taped to wooden shutter
    cv.rect(32, 91, 37, 97, col('cream', 5))
    cv.hline(33, 36, 93, col('red', 3))
    cv.hline(33, 36, 95, col('ink', 1))

    # 1F Right Shuttered Alley Window + A-Frame Chalkboard & Crate (x=50..72)
    cv.window(50, 76, 71, 93, style='warm', frame='darkwood:1', sill='stone:4', seed=608)
    # Closed wooden louver shutters flanking right window
    cv.outline_box(48, 76, 52, 93, col('midori', 2), col('darkwood', 0))
    cv.outline_box(69, 76, 73, 93, col('midori', 2), col('darkwood', 0))
    for ly in range(78, 92, 2):
        cv.hline(49, 51, ly, col('midori', 4))
        cv.hline(70, 72, ly, col('midori', 4))
    # Standing wooden A-frame chalkboard easel ("LP 2F")
    cv.outline_box(50, 97, 60, 109, col('kuro', 1), col('wood', 3), top_hi=col('cedar', 5))
    cv.hline(52, 58, 100, col('yellow', 5))
    cv.hline(52, 57, 102, col('cream', 5))
    cv.hline(53, 56, 104, col('orange', 4))
    # Stacked vintage wooden crate & fern
    cv.outline_box(62, 99, 72, 109, col('wood', 4), col('darkwood', 1), top_hi=col('cedar', 5))
    cv.hline(63, 71, 103, col('darkwood', 2))
    cv.hline(63, 71, 106, col('darkwood', 2))

    # 4) ICONIC EXTERIOR IRON STAIRCASE Climbing Up the Left Side (x=2..35, y=56..111)
    # 2F Iron Landing Platform (x=2..35, y=64..68)
    cv.outline_box(2, 64, 35, 68, col('steel', 2), col('ink', 0), top_hi=col('steel', 5))
    # Open 2F Landing Railing: left guard section (x=2..16) + right return post (x=29..34),
    # cleanly OPEN across x=17..28 where the stair landing meets the 2F wooden bar door!
    cv.hline(2, 17, 56, col('steel', 5))
    cv.hline(2, 17, 57, col('steel', 1))
    for rx in (3, 7, 11):
        cv.vline(rx, 57, 64, col('steel', 2))
    # Sturdy corner landing newel post at x=15..16 (where diagonal stair handrail ties in smoothly!)
    cv.vline(15, 56, 65, col('steel', 5))
    cv.vline(16, 56, 65, col('steel', 1))
    # Right-side short return railing & newel post past the 2F door opening (x=29..34)
    cv.hline(29, 35, 56, col('steel', 5))
    cv.hline(29, 35, 57, col('steel', 1))
    cv.vline(29, 56, 65, col('steel', 5))
    cv.vline(30, 56, 65, col('steel', 1))
    cv.vline(33, 57, 64, col('steel', 2))

    # Supporting vertical iron column under left landing corner (grounded onto street curb)
    cv.vline(3, 68, 110, col('steel', 1))
    cv.vline(4, 68, 110, col('steel', 4))
    cv.vline(5, 68, 110, col('ink', 0))

    # Diagonal exterior iron staircase descending cleanly from 2F landing (y=68) all the way to street baseline (y=111)!
    num_steps = 14
    for i in range(num_steps):
        sy = 68 + i * 3
        sx = 16 - i
        # Cast shadow on wall/underneath stair
        if sy + 3 <= 110:
            cv.hline(sx + 1, sx + 13, sy + 3, col('ink', 0))
        # Iron tread step (12px wide)
        cv.hline(sx, sx + 12, sy, col('steel', 5))
        cv.hline(sx, sx + 12, sy + 1, col('steel', 2))
        cv.hline(sx, sx + 12, sy + 2, col('ink', 0))
    # Continuous diagonal inner (right) & outer (left) iron stringer beams grounded on street baseline (y=111)!
    for k in range(43):
        by = 67 + k
        lx = 16 - int(round(k * 13 / 42.0))
        rx = lx + 11
        # Outer (left) structural stringer
        cv.p(lx, by, col('steel', 1))
        cv.p(lx + 1, by, col('steel', 4))
        # Inner (right) structural stringer
        cv.p(rx, by, col('steel', 2))
        cv.p(rx + 1, by, col('ink', 0))
    # Diagonal outer handrail tied smoothly into the 2F landing newel post (15, 57) down to bottom post (2, 99)
    for k in range(43):
        hy = 57 + k
        hx = 15 - int(round(k * 13 / 42.0))
        if k % 6 == 0 and k > 0:
            # Crisp vertical balusters tying handrail down to outer stringer
            cv.vline(hx, hy + 1, min(110, hy + 11), col('steel', 2))
        cv.p(hx, hy, col('steel', 5))
        cv.p(hx, hy + 1, col('steel', 1))
    # Grounded bottom newel post, bolted steel footing pads & solid contact shadow on street baseline (y=108..111)
    cv.vline(2, 99, 110, col('steel', 5))
    cv.vline(3, 99, 110, col('steel', 1))
    cv.rect(2, 108, 17, 111, col('concrete', 3))
    cv.hline(2, 17, 108, col('steel', 4))
    cv.hline(2, 17, 109, col('ink', 1))
    cv.hline(2, 18, 110, col('ink', 0))
    cv.hline(2, 18, 111, col('ink', 0))

    # Glowing yellow-framed "2F" wall sign shifted cleanly right onto 1F brick wall above 1F door (zero stair collision!)
    cv.outline_box(32, 70, 43, 78, col('darkwood', 1), col('yellow', 4))
    # Crisp 3x5 "2F" lettering inside sign (x=34..40, y=71..76)
    for dy, row in enumerate(['111.111', '..1.1..', '111.11.', '1...1..', '111.1..']):
        for dx, bit in enumerate(row):
            if bit == '1':
                cv.p(34 + dx, 72 + dy, col('yellow', 5))
    # Potted plant cleanly beside stair footing on right
    draw_potted_plant(cv, 19, 110, pot_ramp='brick', blossom='yellow:5', seed=609)

    draw_ground_curb(cv, 2, 77, 111, ramp='concrete')
    return cv


# ---------------------------------------------------------------------------
# 7. mf-bldg-nl_bowling_alley (128x96)
# ---------------------------------------------------------------------------

def build_bowling_alley():
    W, H = 128, 96
    cv = Canvas(W, H)

    # 1) Broad Flat Mid-Century Roof (x=3..125, y=22..35) + AC Units
    cv.flat_roof(3, 22, 125, 36, deck_ramp='pavement', deck_i=2, para_ramp='teal', seed=701)
    cv.roof_ac(8, 24)
    cv.roof_ac(110, 24)
    # Teal rooftop trim & flanking neon steel wings
    cv.outline_box(22, 13, 50, 23, col('teal', 1), col('steel', 3), top_hi=col('teal', 5))
    draw_text_centered(cv, 'BOWL', 24, 15, 48, 21, 'yellow:5', spacing=1, shadow='teal:0')
    cv.outline_box(78, 13, 106, 23, col('teal', 1), col('steel', 3), top_hi=col('teal', 5))
    draw_text_centered(cv, 'LANE', 80, 15, 104, 21, 'pink:5', spacing=1, shadow='teal:0')
    # Support struts for flanking rooftop signs
    for sx in (28, 44, 84, 100):
        cv.vline(sx, 23, 28, col('steel', 2))
        cv.vline(sx + 1, 23, 28, col('steel', 4))

    # 2) ICONIC SCULPTED GIANT WHITE & RED BOWLING PIN ROOFTOP LANDMARK (cx=64, y=1..29)
    # Steel mounting base pedestal on roof
    cv.outline_box(53, 24, 75, 29, col('steel', 2), col('ink', 0), top_hi=col('steel', 5))
    cv.hline(55, 73, 26, col('red', 4))

    # Sculpted curved giant bowling pin profile (half-widths by y from y=2..25)
    pin_profile = {
        2: 3, 3: 4, 4: 5, 5: 5, 6: 4, 7: 3,      # Rounded head
        8: 3, 9: 3, 10: 3, 11: 4, 12: 5,         # Tapered neck (red stripes!)
        13: 6, 14: 7, 15: 8, 16: 8, 17: 9, 18: 9,# Swelling belly
        19: 9, 20: 8, 21: 8, 22: 7, 23: 6, 24: 6 # Base taper
    }
    cx = 64
    for y, hw in pin_profile.items():
        for x in range(cx - hw, cx + hw + 1):
            dx = x - cx
            # Slight downward cylindrical curve on twin red neck stripes for authentic 3/4 feel!
            curve_off = 1 if abs(dx) <= 1 else 0
            is_stripe = (y == 10 + curve_off) or (y == 12 + curve_off)
            if abs(dx) == hw or y == 2 or y == 24:
                cv.p(x, y, col('ink', 1))
            elif is_stripe:
                # Twin iconic glossy RED neck stripes wrapping around cylinder!
                if dx < -1:
                    cv.p(x, y, col('red', 5))
                elif dx < hw - 2:
                    cv.p(x, y, col('red', 3))
                else:
                    cv.p(x, y, col('red', 1))
            else:
                # Glossy cylindrical white shading (top-left bright, right cool-shaded)
                if dx <= -hw + 2:
                    cv.p(x, y, col('white', 6))
                elif dx <= 0:
                    cv.p(x, y, col('white', 5))
                elif dx <= hw - 3:
                    cv.p(x, y, col('coolwhite', 3))
                else:
                    cv.p(x, y, col('coolwhite', 1))
    # Specular highlight dots on pin head & belly
    cv.p(cx - 2, 4, col('white', 6))
    cv.vline(cx - 5, 15, 20, col('white', 6))

    # 3) Broad Mid-Century Cream-and-Teal Upper Facade (x=3..125, y=35..61)
    cv.stipple_rect(3, 35, 125, 61, 'cream', 5, lo_i=4, hi_i=6, seed=702, rate=0.14)
    cv.hline(3, 125, 35, col('ink', 0))
    cv.hline(3, 125, 36, col('cream', 3))
    frame_walls(cv, 3, 35, 125, 61)

    # Colorful Mid-Century Neon Accent Stripes running horizontally!
    cv.hline(4, 124, 38, col('teal', 4))
    cv.hline(4, 124, 39, col('teal', 2))
    cv.hline(4, 124, 57, col('orange', 4))
    cv.hline(4, 124, 58, col('pink', 4))
    cv.hline(4, 124, 59, col('teal', 3))

    # Left & Right Mid-Century Clerestory Windows + Atomic Starburst Emblems
    for wx in (9, 95):
        cv.outline_box(wx, 42, wx + 24, 54, col('glass', 2), col('teal', 1), top_hi=col('teal', 4))
        cv.rect(wx + 1, 43, wx + 23, 53, col('glass', 3))
        # Warm retro pendant reflections inside
        cv.rect(wx + 3, 45, wx + 9, 51, col('yellow', 5))
        cv.rect(wx + 14, 45, wx + 21, 51, col('orange', 4))
        cv.vline(wx + 12, 43, 53, col('teal', 1))
        for d in range(5):
            cv.p(wx + 2 + d, 43 + d, col('glass', 6))

    # Center Fluted Teal Relief Panel with Retro "BOWLING" Neon Sign (x=38..90, y=41..55)
    cv.outline_box(38, 41, 90, 55, col('teal', 2), col('teal', 0), top_hi=col('teal', 5))
    for fx in range(40, 89, 3):
        cv.vline(fx, 42, 54, col('teal', 3))
    draw_text_centered(cv, 'BOWLING', 40, 44, 88, 52, 'yellow:5', spacing=2, shadow='teal:0')
    # Retro starburst diamonds flanking center sign
    for sx in (35, 92):
        cv.p(sx, 45, col('red', 4))
        cv.hline(sx - 1, sx + 2, 46, col('orange', 4))
        cv.p(sx, 47, col('yellow', 5))

    # 4) 1F Teal Ceramic-Tiled Left & Right Wings (y=61..94)
    cv.tile_cladding(3, 61, 34, 94, ramp='teal', base_i=3, cw=4, ch=4, seed=703)
    cv.tile_cladding(94, 61, 125, 94, ramp='teal', base_i=3, cw=4, ch=4, seed=704)
    frame_walls(cv, 3, 61, 125, 94)

    # Backlit Retro Poster Display Cases on Wings (showing bowling ball & pins!)
    for px in (9, 101):
        cv.outline_box(px, 67, px + 18, 84, col('cream', 6), col('steel', 2), top_hi=col('white', 6))
        cv.rect(px + 1, 68, px + 17, 74, col('red', 3))
        cv.hline(px + 3, px + 15, 71, col('yellow', 5))
        # Cute mini bowling ball & 3 pins icon inside poster
        cv.rect(px + 3, 76, px + 8, 81, col('navy', 1))
        cv.p(px + 4, 77, col('glass', 6))
        for pinx in (11, 13, 15):
            cv.vline(px + pinx, 76, 82, col('white', 6))
            cv.p(px + pinx, 78, col('red', 4))

    # Mid-century stone planter boxes under wings
    cv.planter_box(6, 86, 30, 94, flower='orange:4', pot_ramp='stone')
    cv.planter_box(98, 86, 122, 94, flower='yellow:5', pot_ramp='stone')

    # 5) BOLD ANGLED RETRO MARQUEE CANOPY (x=24..104, y=57..71)
    # Cantilevered Googie trapezoidal silhouette (wider at top!)
    for y in range(57, 70):
        ry = y - 57
        inset = ry // 2
        mx0, mx1 = 24 + inset, 104 - inset
        for x in range(mx0, mx1):
            if ry == 0 or x in (mx0, mx1 - 1):
                cv.p(x, y, col('ink', 0))
            elif ry <= 3:
                # Top sunlit angled teal canopy roof plane
                cv.p(x, y, col('teal', 5 if ry == 1 else 4))
            elif ry == 4:
                cv.p(x, y, col('red', 4))
            elif ry == 12:
                cv.p(x, y, col('ink', 0))
            elif ry == 11:
                cv.p(x, y, col('orange', 4))
            else:
                # Crisp cream marquee fascia for razor-sharp retro lettering
                cv.p(x, y, col('cream', 6))
    # Chasing marquee bulbs strictly along top red rim (y=61) and bottom orange lip (y=68)
    for bx in range(29, 100, 4):
        cv.p(bx, 61, col('yellow', 5))
        if 32 <= bx <= 96:
            cv.p(bx + 1, 68, col('yellow', 5))
    draw_text_centered(cv, 'OPEN 24H', 36, 62, 92, 67, 'red:2', spacing=1)
    # Cast shadow beneath marquee
    cv.hline(30, 98, 70, col('ink', 0))
    cv.hline(32, 96, 71, col('ink', 1))

    # 6) Wide 1F Glass Lobby Doors & Warm Visible Bowling Lobby Interior (x=34..94, y=71..94)
    cv.outline_box(34, 71, 94, 94, col('orange', 3), col('steel', 1), top_hi=col('steel', 5))
    # Warm sunlit lobby interior + bowling lane perspective stripes!
    cv.rect(35, 72, 93, 81, col('yellow', 5))
    cv.rect(35, 81, 93, 93, col('cedar', 5))
    # Retro lane perspective lines inside glass
    for lx in range(39, 91, 6):
        cv.vline(lx, 81, 93, col('floorwood', 3))
    # Glowing lobby reception counter on left inside
    cv.outline_box(37, 82, 52, 90, col('teal', 3), col('teal', 0), top_hi=col('cream', 5))
    # 4-bay glass door frames & shiny aluminum handles
    for mx in (49, 64, 79):
        cv.vline(mx, 72, 93, col('steel', 2))
        cv.vline(mx + 1, 72, 93, col('steel', 5))
    cv.vline(61, 80, 86, col('white', 6))
    cv.vline(67, 80, 86, col('white', 6))
    # Glass diagonal reflections
    for d in range(6):
        cv.p(37 + d, 73 + d, col('glass', 6))
        cv.p(81 + d, 73 + d, col('glass', 6))
    # Retro welcome mat at center doors
    cv.rect(53, 92, 75, 95, col('red', 3))
    cv.hline(55, 73, 93, col('yellow', 5))

    draw_ground_curb(cv, 3, 125, 95, ramp='concrete')
    return cv


# ---------------------------------------------------------------------------
# 8. mf-bldg-nl_barbershop_home (64x96)
# ---------------------------------------------------------------------------

def build_barbershop_home():
    W, H = 64, 96
    cv = Canvas(W, H)

    # 1) Pitched Brown Kawara Roof (x=2..62, y=2..27)
    draw_kawara_roof(cv, 2, 2, 62, 27, ramp='cha', moss=0.05,
                     onigawara=True, skylight=(42, 11, 10, 7), seed=801)

    # 2) 2F Cozy Residential Apartment (x=3..61, y=28..55)
    cv.stipple_rect(3, 28, 61, 56, 'cream', 4, lo_i=3, hi_i=5, seed=802, rate=0.16)
    cv.hline(3, 61, 28, col('ink', 0))
    cv.hline(3, 61, 29, col('cream', 2))
    frame_walls(cv, 3, 28, 61, 56)

    # 2F Cozy Residential Window with Warm Curtains & Lush Flower Box! (x=9..41, y=32..52)
    cv.window(10, 32, 40, 47, style='warm', frame='wood:2', sill='wood:5', curtain='pink', seed=803)
    # Lush wooden flower box below 2F window
    cv.planter_box(9, 46, 41, 53, flower='red:4', pot_ramp='wood')
    cv.p(16, 46, col('yellow', 5))
    cv.p(28, 46, col('yellow', 5))
    cv.p(35, 47, col('pink', 4))

    # Wall-mounted AC outdoor unit on right (x=45..56, y=38..46)
    draw_ac_wall(cv, 46, 39)
    # Copper pipe running down right edge
    cv.vline(58, 41, 56, col('steel', 3))
    cv.vline(59, 41, 56, col('steel', 1))

    # 3) Classic Retro Barbershop Fascia Sign (x=2..62, y=54..65 — clean 7px interior for 5px letters!)
    cv.outline_box(2, 54, 62, 65, col('teal', 2), col('teal', 0), top_hi=col('teal', 5), bot_sh=col('teal', 1))
    cv.outline_box(4, 56, 60, 64, col('cream', 5), col('teal', 1))
    # Red-and-blue vintage barbershop accent pips flanking "BARBER"
    cv.rect(6, 58, 10, 62, col('red', 4))
    cv.rect(54, 58, 58, 62, col('blue', 4))
    draw_text_centered(cv, 'BARBER', 11, 57, 53, 63, 'teal:0', spacing=1)
    cv.hline(3, 61, 65, col('ink', 1))

    # 4) 1F Mint-Green Ceramic Tiled Barbershop Front (x=3..61, y=66..95)
    cv.tile_cladding(3, 66, 61, 94, ramp='teal', base_i=5, cw=4, ch=4, seed=804)
    # Lower dark-teal stone wainscot base
    cv.tile_cladding(3, 88, 61, 94, ramp='teal', base_i=2, cw=4, ch=4, seed=805)
    frame_walls(cv, 3, 66, 61, 94)

    # Warm Window Showing Barber Chair & Mirror! (x=6..33, y=68..90)
    cv.outline_box(6, 68, 33, 90, col('cream', 5), col('wood', 1), top_hi=col('wood', 4))
    # Warm sunlit barbershop interior
    cv.rect(7, 69, 32, 89, col('cream', 5))
    cv.rect(7, 69, 32, 74, col('yellow', 5))
    # Framed gleaming Barber Mirror on back wall (x=10..24, y=71..81)
    cv.outline_box(10, 71, 24, 81, col('glass', 5), col('wood', 2), top_hi=col('white', 6))
    cv.p(12, 73, col('white', 6))
    cv.p(13, 74, col('white', 6))
    cv.p(14, 75, col('glass', 6))
    # Tonic bottles on mirror shelf
    cv.hline(9, 25, 81, col('wood', 4))
    cv.p(11, 80, col('green', 4))
    cv.p(14, 80, col('blue', 4))
    cv.p(22, 80, col('orange', 4))
    # Classic Red-Leather & Chrome Barber Chair silhouette (x=15..25, y=79..89)
    cv.outline_box(16, 79, 24, 86, col('red', 4), col('red', 1), top_hi=col('red', 5))
    cv.vline(19, 86, 89, col('steel', 5))
    cv.vline(20, 86, 89, col('steel', 3))
    cv.hline(17, 23, 88, col('steel', 5))
    # Warm brass sconce on right wall inside
    cv.p(28, 74, col('yellow', 5))
    cv.p(28, 75, col('orange', 4))
    # Crisp glass reflection across window
    for d in range(5):
        cv.p(8 + d, 70 + d, col('white', 6))
    cv.hline(5, 34, 90, col('white', 5))
    cv.hline(6, 33, 91, col('ink', 1))

    # Classic Glass & Wood Barbershop Door (x=36..51, y=69..94)
    cv.door_wood(36, 69, 51, 94, ramp='wood', glass_top=False)
    cv.window(38, 71, 49, 85, style='warm', frame='wood:1', sill=None, seed=806)
    # Little hanging "OPEN" sign in glass door
    cv.rect(40, 76, 47, 79, col('red', 3))
    cv.hline(41, 46, 77, col('white', 6))
    # Brass handle
    cv.p(49, 87, col('yellow', 5))

    # ICONIC SPINNING RED-WHITE-BLUE BARBER POLE beside Door! (x=53..59, y=69..89)
    # Steel wall brackets
    cv.hline(51, 54, 72, col('steel', 2))
    cv.hline(51, 54, 86, col('steel', 2))
    # Chrome dome caps top & bottom
    cv.rect(54, 69, 59, 72, col('steel', 5))
    cv.hline(54, 59, 69, col('steel', 1))
    cv.p(55, 70, col('white', 6))
    cv.rect(54, 86, 59, 89, col('steel', 4))
    cv.hline(54, 59, 88, col('steel', 1))
    # Striped rotating glass cylinder (x=54..59, y=72..86)
    stripe_seq = ['red:4', 'white:6', 'blue:3', 'white:6']
    for y in range(72, 86):
        for x in range(54, 59):
            if x == 54 or x == 58:
                cv.p(x, y, col('steel', 2))
            else:
                idx = ((x - 54) + (y - 72)) // 2 % len(stripe_seq)
                cv.p(x, y, stripe_seq[idx])
        # Vertical glass shine along left edge
        cv.p(55, y, col('white', 6) if y % 3 == 0 else cv.get(55, y))

    # Small sidewalk potted plant left of window
    draw_potted_plant(cv, 4, 94, pot_ramp='brick', blossom='yellow:5', seed=807)

    draw_ground_curb(cv, 2, 62, 95, ramp='concrete')
    return cv


# ---------------------------------------------------------------------------
# 9. mf-bldg-nl_repair_workshop (96x80)
# ---------------------------------------------------------------------------

def build_repair_workshop():
    W, H = 96, 80
    cv = Canvas(W, H)

    # 1) Slanted Corrugated Metal Roof with Translucent Skylight (x=2..94, y=3..24)
    draw_corrugated_roof(cv, 2, 3, 94, 24, ramp='steel', rust_rate=0.20, seed=901)
    # Bright industrial roof skylight panel (x=18..48, y=7..16)
    cv.outline_box(18, 7, 48, 16, col('glass', 4), col('steel', 1), top_hi=col('white', 6))
    for sx in range(21, 47, 5):
        cv.vline(sx, 8, 15, col('glass', 6))
        cv.vline(sx + 2, 8, 15, col('steel', 3))
    cv.hline(19, 47, 11, col('steel', 2))
    # Roof turbine exhaust vent (x=72..82, y=6..14)
    cv.outline_box(73, 6, 81, 14, col('steel', 5), col('steel', 0), top_hi=col('white', 6))
    cv.hline(74, 80, 9, col('steel', 2))
    cv.hline(74, 80, 11, col('steel', 2))

    # 2) Weathered Blue Fascia Sign (x=3..93, y=24..36)
    cv.outline_box(3, 24, 93, 36, col('blue', 2), col('blue', 0), top_hi=col('blue', 4), bot_sh=col('blue', 1))
    # Subtle weathered chipped-paint & rust specks on sign corners
    for wx, wy in [(5, 26), (6, 27), (89, 25), (90, 26), (88, 33), (7, 33)]:
        cv.p(wx, wy, col('rooftile', 2))
    # Wrench pixel emblem on left of sign (x=9..21, y=27..33)
    cv.hline(12, 20, 30, col('white', 5))
    cv.rect(9, 28, 13, 32, col('white', 6))
    cv.p(9, 30, col('blue', 2))
    cv.rect(19, 29, 22, 32, col('white', 5))
    # Bold crisp "REPAIR" sign lettering
    draw_text(cv, 'REPAIR', 27, 27, 'yellow:5', spacing=2, shadow='blue:0')
    # Twin industrial gooseneck lamps mounted on top edge of sign
    for lx in (24, 68):
        cv.hline(lx, lx + 5, 23, col('steel', 1))
        cv.hline(lx + 1, lx + 4, 24, col('steel', 5))
        cv.hline(lx + 1, lx + 4, 25, col('yellow', 5))
    cv.hline(3, 93, 36, col('ink', 0))

    # 3) Concrete & Corrugated-Metal Lower Workshop Wall (x=3..93, y=36..78)
    # Left concrete structural pier (x=3..14)
    cv.stipple_rect(3, 36, 14, 78, 'concrete', 3, lo_i=2, hi_i=4, seed=902, rate=0.22)
    # Yellow/black industrial hazard stripes near bottom of left pier
    for hy in range(66, 76):
        for hx in range(4, 13):
            cv.p(hx, hy, col('yellow', 4) if ((hx + hy) // 2) % 2 == 0 else col('ink', 1))
    # Right corrugated metal utility wing (x=72..93)
    cv.siding_wall(72, 36, 93, 78, ramp='concrete', base_i=3, horizontal=False, step=3, seed=903)
    # Small wire-grated workshop office window on right wing (x=76..90, y=41..52)
    cv.window(76, 41, 90, 52, style='warm', frame='steel:1', sill='concrete:5', seed=904)
    cv.vline(80, 42, 51, col('steel', 2))
    cv.vline(85, 42, 51, col('steel', 2))
    frame_walls(cv, 3, 36, 93, 78)

    # 4) WIDE OPEN STEEL GARAGE BAY (x=14..72, y=37..78)
    cv.outline_box(14, 37, 72, 78, col('asphalt', 1), col('steel', 1))
    # Rolled-up corrugated steel shutter slats at top of bay (y=38..44)
    for sy in range(38, 44):
        cv.hline(15, 71, sy, col('steel', 4 if sy % 2 == 0 else 2))
    cv.hline(15, 71, 44, col('ink', 0))

    # Warm overhead fluorescent workshop tube lamp (y=45..47)
    cv.rect(28, 45, 58, 47, col('white', 6))
    cv.hline(26, 60, 47, col('yellow', 5))
    # Back concrete shop wall illuminated warmly
    cv.stipple_rect(15, 47, 71, 69, 'concrete', 2, lo_i=1, hi_i=3, seed=905, rate=0.16)
    # Concrete garage floor apron (y=69..78)
    cv.stipple_rect(15, 69, 71, 78, 'pavement', 3, lo_i=2, hi_i=4, seed=906, rate=0.18)

    # Pegboard with Hanging Tools above Workbench! (x=18..52, y=48..59)
    cv.outline_box(18, 48, 52, 59, col('wood', 2), col('darkwood', 0))
    # Crisp hanging wrenches, hammer, screwdriver, saw silhouettes
    # Wrench 1
    cv.vline(21, 50, 57, col('steel', 5))
    cv.hline(20, 23, 50, col('steel', 6))
    # Wrench 2
    cv.vline(25, 51, 57, col('steel', 4))
    cv.hline(24, 27, 51, col('steel', 5))
    # Hammer
    cv.vline(31, 51, 57, col('cedar', 5))
    cv.hline(29, 34, 50, col('steel', 5))
    # Red-handle screwdrivers
    cv.vline(37, 52, 57, col('steel', 5))
    cv.rect(36, 50, 39, 53, col('red', 4))
    cv.vline(41, 52, 57, col('steel', 5))
    cv.rect(40, 50, 43, 53, col('yellow', 4))
    # Hand saw
    cv.rect(45, 51, 50, 53, col('orange', 4))
    cv.rect(46, 53, 49, 57, col('steel', 5))

    # Warm Wooden Workbench (x=17..53, y=60..72)
    cv.outline_box(17, 60, 53, 64, col('cedar', 5), col('wood', 1), top_hi=col('yellow', 5))
    cv.rect(18, 64, 52, 72, col('wood', 2))
    cv.vline(19, 64, 72, col('wood', 4))
    cv.vline(50, 64, 72, col('wood', 4))
    cv.hline(20, 50, 68, col('wood', 3))
    # Metal bench vice & appliance/motor housing on workbench!
    cv.outline_box(22, 57, 27, 61, col('blue', 3), col('steel', 1))
    cv.outline_box(33, 56, 44, 61, col('steel', 4), col('steel', 0), top_hi=col('steel', 6))
    cv.p(36, 58, col('orange', 4))
    cv.p(40, 58, col('yellow', 5))

    # Bright RED Rolling Mechanic's Toolbox! (x=55..69, y=56..73)
    cv.outline_box(55, 56, 69, 72, col('red', 3), col('red', 0), top_hi=col('red', 5))
    for dy in (60, 64, 68):
        cv.hline(56, 68, dy, col('red', 1))
        cv.hline(60, 64, dy - 2, col('steel', 6))  # Silver drawer pulls
    # Casters
    cv.rect(56, 72, 59, 74, col('ink', 0))
    cv.rect(65, 72, 68, 74, col('ink', 0))

    # Stacked Spare Rubber Tires inside left & right bay corners!
    for tx, ty in [(17, 70), (26, 71), (59, 72)]:
        cv.outline_box(tx, ty, tx + 8, ty + 6, col('kuro', 1), col('ink', 0), top_hi=col('kuro', 3))
        cv.rect(tx + 2, ty + 2, tx + 6, ty + 4, col('steel', 4))

    # 5) Cluttered Side Oil Drums (with top-3/4 elliptical rims!) & Coiled Air Hose
    # Coiled orange air hose hanging on left concrete bay pier
    cv.outline_box(6, 48, 11, 54, col('orange', 4), col('orange', 1), top_hi=col('yellow', 5))
    cv.rect(7, 50, 10, 52, col('concrete', 3))
    # Blue 55-gallon oil drum with sunlit top-3/4 lid rim
    cv.outline_box(74, 60, 83, 77, col('blue', 3), col('blue', 0))
    cv.rect(75, 61, 82, 63, col('blue', 5))  # Top sunlit elliptical drum lid
    cv.p(77, 61, col('steel', 6))            # Bung cap
    cv.hline(75, 82, 63, col('blue', 1))
    cv.hline(75, 82, 68, col('blue', 1))
    cv.hline(75, 82, 73, col('blue', 1))
    cv.vline(76, 64, 76, col('blue', 4))
    # Weathered Red/Yellow Oil Drum beside it with sunlit top-3/4 lid
    cv.outline_box(84, 62, 92, 77, col('red', 3), col('red', 0))
    cv.rect(85, 63, 91, 65, col('orange', 4))
    cv.p(87, 63, col('yellow', 5))
    cv.hline(85, 91, 65, col('red', 1))
    cv.hline(85, 91, 69, col('yellow', 4))
    cv.hline(85, 91, 70, col('yellow', 3))
    cv.hline(85, 91, 73, col('red', 1))
    # Subtle dark oil spot on garage concrete apron
    cv.rect(40, 75, 48, 77, col('asphalt', 1))

    draw_ground_curb(cv, 2, 94, 79, ramp='concrete')
    return cv


# ---------------------------------------------------------------------------
# 10. mf-bldg-nl_antique_corner (80x96)
# ---------------------------------------------------------------------------

def build_antique_corner():
    W, H = 80, 96
    cv = Canvas(W, H)

    # 1) Mossy Kawara Pitched Roof with Old Chimney & Charming Dormer! (x=2..78, y=3..29)
    draw_kawara_roof(cv, 2, 4, 78, 29, ramp='ibushi', moss=0.14, onigawara=True, seed=1001)

    # Aged mossy brick chimney rising on roof left (x=8..16, y=1..15)
    cv.brick_wall(8, 2, 16, 15, ramp='brick', base_i=3, course_h=3, brick_w=4, seed=1002)
    cv.hline(7, 17, 1, col('stone', 5))
    cv.hline(7, 17, 2, col('stone', 2))
    cv.p(9, 13, col('moss', 3))
    cv.p(14, 12, col('moss', 2))

    # Projecting Gabled Attic Dormer on Roof (x=35..57, y=6..25)
    dcx = 46
    for y in range(6, 15):
        hw = 1 + (y - 6) * 11 // 8
        cv.hline(dcx - hw, dcx + hw + 1, y, col('kawara', 0))
        if hw >= 2:
            cv.hline(dcx - hw + 1, dcx + hw, y, col('kawara', 4 if y % 2 == 0 else 3))
        if hw >= 4 and y >= 10:
            cv.hline(dcx - hw + 3, dcx + hw - 2, y, col('kinari', 4))
    cv.outline_box(37, 15, 55, 25, col('kinari', 4), col('darkwood', 1))
    # Warm glowing attic dormer window
    cv.outline_box(40, 16, 52, 24, col('orange', 4), col('darkwood', 0))
    cv.rect(41, 17, 51, 23, col('yellow', 5))
    cv.vline(46, 17, 23, col('darkwood', 2))
    cv.hline(41, 51, 20, col('darkwood', 2))
    cv.hline(36, 56, 25, col('darkwood', 0))

    # 2) 2F Dark-Timber & Aged-Plaster Half-Timbered Facade (x=3..77, y=29..56)
    cv.stipple_rect(3, 29, 77, 56, 'kinari', 4, lo_i=3, hi_i=5, seed=1003, rate=0.18)
    cv.hline(3, 77, 29, col('ink', 0))
    cv.hline(3, 77, 30, col('kinari', 2))
    # Rich dark-timber corner posts, mid-beam & decorative diagonal struts
    for tx in (3, 36, 74):
        cv.rect(tx, 29, tx + 3, 56, col('darkwood', 3))
        cv.vline(tx + 1, 29, 56, col('wood', 4))
    cv.rect(3, 50, 77, 56, col('darkwood', 2))
    cv.hline(3, 77, 50, col('wood', 4))
    frame_walls(cv, 3, 29, 77, 56)

    # 2F Left Mullioned Window with Moss-Green Wooden Shutters (x=8..33, y=33..48)
    cv.window(12, 33, 29, 47, style='warm', frame='darkwood:1', sill='wood:4', seed=1004)
    cv.outline_box(8, 33, 12, 47, col('midori', 3), col('darkwood', 0))
    cv.outline_box(29, 33, 33, 47, col('midori', 3), col('darkwood', 0))
    for sy in range(35, 46, 2):
        cv.hline(9, 11, sy, col('midori', 4))
        cv.hline(30, 32, sy, col('midori', 4))

    # 2F Right Antique Studio Window showing Books & Globe Silhouette (x=42..68, y=33..48)
    cv.outline_box(42, 33, 68, 48, col('orange', 3), col('darkwood', 0))
    cv.rect(43, 34, 67, 47, col('orange', 4))
    cv.rect(43, 34, 67, 42, col('yellow', 4))
    # Antique globe & stacked books silhouettes inside
    cv.rect(46, 40, 51, 45, col('teal', 3))
    cv.vline(48, 45, 47, col('darkwood', 1))
    for bx, bc in [(56, 'red:3'), (58, 'blue:3'), (60, 'green:3'), (62, 'wood:4'), (64, 'maple:3')]:
        cv.vline(bx, 40, 46, bc)
    cv.vline(55, 34, 47, col('darkwood', 1))
    cv.hline(41, 69, 48, col('wood', 4))

    # Hanging Wrought-Iron Antique Sign Bracket on Right Edge (x=69..79, y=35..46)
    cv.hline(69, 79, 35, col('ink', 0))
    cv.outline_box(71, 37, 79, 45, col('darkwood', 1), col('yellow', 4))
    # Tiny antique pocket-watch / clock face icon
    cv.rect(73, 39, 77, 43, col('cream', 6))
    cv.p(75, 40, col('ink', 0))
    cv.p(76, 41, col('ink', 0))

    # Carved Gold-Leaf Fascia Signboard "ANTIQUE" (clean 9px box, razor-sharp gold text!)
    cv.outline_box(13, 48, 67, 57, col('darkwood', 0), col('yellow', 4))
    cv.outline_box(14, 49, 66, 56, col('darkwood', 1), col('darkwood', 0))
    draw_text_centered(cv, 'ANTIQUE', 16, 50, 64, 55, 'yellow:5', spacing=1, shadow='darkwood:0')

    # 3) Striped Burgundy-and-Cream Fabric Awning over Display Bay (x=4..54, y=57..65)
    cv.awning(4, 57, 54, 65, ramp_a='maple', ramp_b='cream', stripe_w=4)

    # 4) 1F Dark-Timber Shopfront, Packed Bay Display Window & Leaning Frames! (y=65..95)
    cv.siding_wall(3, 65, 77, 94, ramp='darkwood', base_i=3, horizontal=False, step=4, seed=1005)
    # Aged stone plinth base
    cv.brick_wall(3, 89, 77, 94, ramp='stone', base_i=2, course_h=3, brick_w=7, seed=1006)
    frame_walls(cv, 3, 65, 77, 94)

    # Protruding Wooden Bay Display Window packed with Glowing Brass Lamps, Clocks & Curios! (x=5..49, y=66..89)
    cv.outline_box(5, 66, 49, 89, col('orange', 2), col('darkwood', 0), top_hi=col('wood', 5))
    cv.rect(6, 67, 48, 88, col('orange', 3))
    cv.rect(6, 67, 48, 76, col('orange', 4))
    # Display shelf levels inside bay
    cv.hline(6, 48, 77, col('darkwood', 1))
    cv.hline(6, 48, 86, col('wood', 4))

    # --- Packed Curiosities inside Bay Window! ---
    # 1. Tall Grandfather Clock on left (x=8..14, y=69..87)
    cv.outline_box(8, 69, 14, 87, col('wood', 3), col('darkwood', 0))
    cv.rect(9, 70, 13, 74, col('cream', 6))  # Clock dial
    cv.p(11, 71, col('ink', 0))
    cv.p(12, 72, col('ink', 0))
    cv.vline(11, 76, 84, col('yellow', 5))  # Brass pendulum!
    # 2. Glowing Brass Table Lamp #1 (x=17..23, y=70..77)
    cv.rect(17, 70, 23, 73, col('yellow', 5))
    cv.hline(18, 22, 71, col('white', 6))
    cv.vline(20, 73, 77, col('yellow', 4))
    cv.hline(18, 22, 76, col('yellow', 4))
    # 3. Brass Gramophone Horn (x=25..33, y=70..77)
    cv.rect(25, 74, 31, 77, col('wood', 4))
    cv.rect(28, 70, 33, 74, col('yellow', 5))
    cv.p(32, 71, col('white', 6))
    # 4. Glowing Brass Lantern & Wall Clock (x=36..46, y=68..76)
    cv.outline_box(36, 68, 42, 74, col('cream', 6), col('yellow', 4))
    cv.p(39, 70, col('ink', 0))
    cv.p(40, 71, col('ink', 0))
    cv.rect(43, 70, 47, 76, col('yellow', 5))
    cv.p(45, 72, col('white', 6))
    # 5. Lower Shelf Curios: Blue Porcelain Vase, Stacked Leather Books, Glowing Brass Lamp #2!
    cv.rect(17, 80, 21, 86, col('blue', 4))
    cv.p(18, 81, col('white', 6))
    cv.hline(18, 20, 79, col('blue', 5))
    # Leather-bound antique books
    cv.hline(23, 31, 85, col('maple', 4))
    cv.hline(24, 30, 84, col('green', 4))
    cv.hline(23, 30, 83, col('red', 4))
    cv.hline(25, 29, 82, col('yellow', 4))
    # Second glowing brass lamp & gold chalice
    cv.rect(34, 79, 40, 82, col('yellow', 5))
    cv.hline(35, 39, 80, col('white', 6))
    cv.vline(37, 82, 86, col('yellow', 4))
    cv.rect(42, 81, 46, 86, col('yellow', 4))
    cv.p(44, 82, col('white', 6))

    # Wooden Bay Window Mullions & Protruding Sill
    cv.vline(24, 67, 88, col('darkwood', 1))
    cv.vline(35, 67, 88, col('darkwood', 1))
    for d in range(4):
        cv.p(7 + d, 68 + d, col('glass', 6))
    cv.hline(4, 50, 89, col('wood', 5))
    cv.hline(5, 49, 90, col('ink', 1))

    # Vintage Arched Dark-Timber Entrance Door (x=54..72, y=66..94)
    cv.outline_box(54, 66, 72, 94, col('wood', 3), col('darkwood', 0), top_hi=col('wood', 5))
    # Leaded warm amber upper door pane
    cv.outline_box(57, 69, 69, 82, col('orange', 4), col('darkwood', 1))
    cv.rect(58, 70, 68, 81, col('yellow', 5))
    cv.vline(63, 70, 81, col('darkwood', 2))
    cv.hline(58, 68, 75, col('darkwood', 2))
    # Brass doorknob & warm lantern above door
    cv.p(69, 85, col('yellow', 5))
    draw_hanging_lantern(cv, 63, 59, ramp='orange', glow='yellow:5', tall=False)

    # LEANING VINTAGE PICTURE FRAMES & MIRROR by Entrance! (x=46..55 & x=70..78, y=81..94)
    # Ornate gold-framed painting leaning left of doorway
    cv.outline_box(46, 82, 54, 94, col('blue', 3), col('yellow', 4), top_hi=col('yellow', 5))
    cv.rect(48, 84, 52, 89, col('cream', 5))
    cv.rect(48, 89, 52, 92, col('foliage', 3))
    cv.p(50, 86, col('orange', 4))
    # Tall vintage oval/gold mirror leaning right of doorway
    cv.outline_box(71, 80, 78, 94, col('glass', 5), col('yellow', 4), top_hi=col('yellow', 5))
    cv.p(73, 83, col('white', 6))
    cv.p(74, 84, col('white', 6))
    cv.p(75, 85, col('glass', 6))
    # Small leaning brass clock/frame on far left
    cv.outline_box(4, 84, 11, 94, col('maple', 3), col('yellow', 4), top_hi=col('yellow', 5))
    cv.rect(6, 86, 9, 91, col('cream', 5))

    draw_ground_curb(cv, 2, 78, 95, ramp='stone')
    return cv


# ---------------------------------------------------------------------------
# Manifest & Batch Export
# ---------------------------------------------------------------------------

BUILDINGS = [
    {
        'id': 'mf-bldg-nl_coin_laundry',
        'name': '24시 코인 세탁방 (2층)',
        'category': 'alley-nightlife',
        'w': 5,
        'h': 6,
        'pixelSize': [80, 96],
        'passableTopRows': 2,
        'tags': ['alley-nightlife', 'laundromat', 'coin-laundry', '24h', 'retro', 'kawara'],
        'fn': build_coin_laundry,
    },
    {
        'id': 'mf-bldg-nl_sento_chimney',
        'name': '굴뚝 동네 목욕탕·센토',
        'category': 'alley-nightlife',
        'w': 7,
        'h': 8,
        'pixelSize': [112, 128],
        'passableTopRows': 3,
        'tags': ['alley-nightlife', 'sento', 'bathhouse', 'chimney', 'noren', 'kawara', 'landmark'],
        'fn': build_sento_chimney,
    },
    {
        'id': 'mf-bldg-nl_retro_arcade',
        'name': '레트로 골목 오락실 (3층)',
        'category': 'alley-nightlife',
        'w': 6,
        'h': 7,
        'pixelSize': [96, 112],
        'passableTopRows': 2,
        'tags': ['alley-nightlife', 'arcade', 'game-center', 'neon', 'retro', 'nightlife'],
        'fn': build_retro_arcade,
    },
    {
        'id': 'mf-bldg-nl_karaoke_neon_tower',
        'name': '네온 노래방 타워 (4층)',
        'category': 'alley-nightlife',
        'w': 5,
        'h': 9,
        'pixelSize': [80, 144],
        'passableTopRows': 2,
        'tags': ['alley-nightlife', 'karaoke', 'noraebang', 'neon', 'tower', 'nightlife'],
        'fn': build_karaoke_neon_tower,
    },
    {
        'id': 'mf-bldg-nl_pojangmacha_hall',
        'name': '골목 포장마차 홀',
        'category': 'alley-nightlife',
        'w': 7,
        'h': 5,
        'pixelSize': [112, 80],
        'passableTopRows': 2,
        'tags': ['alley-nightlife', 'pojangmacha', 'street-food', 'tavern', 'nightlife', 'awning'],
        'fn': build_pojangmacha_hall,
    },
    {
        'id': 'mf-bldg-nl_lp_bar_extstair',
        'name': '외부계단 LP 바이닐 바 (2.5층)',
        'category': 'alley-nightlife',
        'w': 5,
        'h': 7,
        'pixelSize': [80, 112],
        'passableTopRows': 2,
        'tags': ['alley-nightlife', 'lp-bar', 'vinyl', 'ext-stair', 'brick', 'nightlife'],
        'fn': build_lp_bar_extstair,
    },
    {
        'id': 'mf-bldg-nl_bowling_alley',
        'name': '레트로 볼링장 (볼링핀 간판)',
        'category': 'alley-nightlife',
        'w': 8,
        'h': 6,
        'pixelSize': [128, 96],
        'passableTopRows': 2,
        'tags': ['alley-nightlife', 'bowling', 'retro', 'marquee', 'landmark', 'nightlife'],
        'fn': build_bowling_alley,
    },
    {
        'id': 'mf-bldg-nl_barbershop_home',
        'name': '동네 레트로 이발소 (2층)',
        'category': 'alley-nightlife',
        'w': 4,
        'h': 6,
        'pixelSize': [64, 96],
        'passableTopRows': 2,
        'tags': ['alley-nightlife', 'barbershop', 'retro', 'alley', 'mint-tile', 'kawara'],
        'fn': build_barbershop_home,
    },
    {
        'id': 'mf-bldg-nl_repair_workshop',
        'name': '골목 수리 공방·정비소',
        'category': 'alley-nightlife',
        'w': 6,
        'h': 5,
        'pixelSize': [96, 80],
        'passableTopRows': 2,
        'tags': ['alley-nightlife', 'workshop', 'repair', 'garage', 'industrial', 'corrugated'],
        'fn': build_repair_workshop,
    },
    {
        'id': 'mf-bldg-nl_antique_corner',
        'name': '모퉁이 골동품·앤티크샵 (2층)',
        'category': 'alley-nightlife',
        'w': 5,
        'h': 6,
        'pixelSize': [80, 96],
        'passableTopRows': 2,
        'tags': ['alley-nightlife', 'antique', 'vintage', 'curiosity', 'dormer', 'kawara'],
        'fn': build_antique_corner,
    },
]


def main():
    batch = 'pack08_alley_nightlife'
    out_dir = os.path.join(OUT_ROOT, 'buildings', batch)
    os.makedirs(out_dir, exist_ok=True)

    manifest_items = []
    for spec in BUILDINGS:
        cv = spec['fn']()
        expected_w, expected_h = spec['pixelSize']
        assert (cv.w, cv.h) == (expected_w, expected_h), f"{spec['id']} size mismatch"
        out_path = os.path.join(out_dir, f"{spec['id']}.png")
        cv.save(out_path)
        item = {k: v for k, v in spec.items() if k != 'fn'}
        manifest_items.append(item)
        print(f"  wrote {out_path} ({cv.w}x{cv.h})")

    manifest = {
        'batch': batch,
        'kind': 'buildings',
        'items': manifest_items,
    }
    mpath = os.path.join(out_dir, 'manifest.json')
    with open(mpath, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"wrote manifest -> {mpath} ({len(manifest_items)} items)")


if __name__ == '__main__':
    main()
