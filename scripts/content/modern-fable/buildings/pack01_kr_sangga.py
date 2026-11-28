#!/usr/bin/env python3
"""Building Pack 01: Korean Commercial Sangga (pack01_kr_sangga, 10 buildings).

Fable 5.2 top-3/4 RPG pixel-art baseline, strictly locked to tiledata/jp-city/fable-city/palette.json.
Outputs 10 RGBA PNGs + manifest.json into tiledata/modern-fable/buildings/pack01_kr_sangga/.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PARENT = os.path.abspath(os.path.join(HERE, '..'))
if PARENT not in sys.path:
    sys.path.insert(0, PARENT)

from fable_lib import Canvas, col, hsh, shade_rgba, OUT_ROOT

PACK = 'pack01_kr_sangga'
OUT_DIR = os.path.join(OUT_ROOT, 'buildings', PACK)


# ---------------------------------------------------------------------------
# Crisp 5x5 pixel Hangul / Latin / symbol glyphs for readable Korean signage
# ---------------------------------------------------------------------------
GLYPHS_5X5 = {
    '치': [
        '..#..',
        '###.#',
        '.#..#',
        '#.#.#',
        '....#',
    ],
    '킨': [
        '###.#',
        '..#.#',
        '###.#',
        '#...#',
        '#####',
    ],
    '호': [
        '..#..',
        '#####',
        '.###.',
        '..#..',
        '#####',
    ],
    '프': [
        '#####',
        '.#.#.',
        '#####',
        '.....',
        '#####',
    ],
    '학': [
        '.#..#',
        '###.#',
        '.#..#',
        '####.',
        '...#.',
    ],
    '원': [
        '.#..#',
        '#.#.#',
        '###.#',
        '#....',
        '####.',
    ],
    '카': [
        '###.#',
        '..#.#',
        '###.#',
        '..#.#',
        '....#',
    ],
    '페': [
        '####.',
        '.##.#',
        '####.',
        '..#.#',
        '..#.#',
    ],
    '빵': [
        '##.##',
        '#####',
        '##.##',
        '.###.',
        '.###.',
    ],
    '집': [
        '###.#',
        '.#..#',
        '#.#.#',
        '#####',
        '#...#',
    ],
    '과': [
        '###.#',
        '..#.#',
        '..###',
        '.#..#',
        '###.#',
    ],
    '당': [
        '###.#',
        '#...#',
        '###.#',
        '.###.',
        '.#.#.',
    ],
    '구': [
        '#####',
        '....#',
        '#####',
        '..#..',
        '..#..',
    ],
    '피': [
        '###.#',
        '.#..#',
        '###.#',
        '....#',
        '....#',
    ],
    '씨': [
        '##.##',
        '#.#.#',
        '#.#.#',
        '....#',
        '....#',
    ],
    '방': [
        '#.#.#',
        '###.#',
        '###.#',
        '.###.',
        '.#.#.',
    ],
    '2': [
        '###..',
        '..#..',
        '###..',
        '#....',
        '###..',
    ],
    '4': [
        '#.#..',
        '#.#..',
        '###..',
        '..#..',
        '..#..',
    ],
    '시': [
        '.#..#',
        '#.#.#',
        '#.#.#',
        '....#',
        '....#',
    ],
    '분': [
        '#.#..',
        '###..',
        '#####',
        '#....',
        '####.',
    ],
    '식': [
        '.#..#',
        '#.#.#',
        '....#',
        '####.',
        '...#.',
    ],
    '미': [
        '###.#',
        '#.#.#',
        '###.#',
        '....#',
        '....#',
    ],
    '용': [
        '.###.',
        '#...#',
        '.###.',
        '.#.#.',
        '#####',
    ],
    '장': [
        '###.#',
        '.#..#',
        '#.#.#',
        '.###.',
        '.#.#.',
    ],
    '약': [
        '.#..#',
        '#.#.#',
        '.#..#',
        '####.',
        '...#.',
    ],
    '국': [
        '####.',
        '...#.',
        '#####',
        '..#..',
        '####.',
    ],
    '수': [
        '..#..',
        '.#.#.',
        '#####',
        '..#..',
        '..#..',
    ],
    '영': [
        '.#..#',
        '#.#.#',
        '.#..#',
        '.###.',
        '.#.#.',
    ],
    '어': [
        '.#..#',
        '#.#.#',
        '.#..#',
        '....#',
        '....#',
    ],
    '의': [
        '.#..#',
        '#.#.#',
        '.#..#',
        '###.#',
        '....#',
    ],
    '술': [
        '..#..',
        '.#.#.',
        '#####',
        '..#..',
        '####.',
    ],
    '논': [
        '#....',
        '####.',
        '..#..',
        '#####',
        '####.',
    ],
    '커': [
        '###.#',
        '..#.#',
        '###.#',
        '..#.#',
        '....#',
    ],
    '전': [
        '###.#',
        '.#.##',
        '#.#.#',
        '#....',
        '####.',
    ],
    '통': [
        '#####',
        '#....',
        '#####',
        '.###.',
        '.#.#.',
    ],
    '실': [
        '.#..#',
        '#.#.#',
        '....#',
        '####.',
        '####.',
    ],
    'P': [
        '###..',
        '#.#..',
        '###..',
        '#....',
        '#....',
    ],
    'C': [
        '.##..',
        '#....',
        '#....',
        '#....',
        '.##..',
    ],
    '+': [
        '..#..',
        '..#..',
        '#####',
        '..#..',
        '..#..',
    ],
    '·': [
        '.....',
        '.....',
        '..#..',
        '.....',
        '.....',
    ],
}


def draw_glyphs(cv, x, y, text, color, vertical=False, spacing=6):
    """Draw crisp 5x5 Hangul/symbol glyphs horizontally or vertically."""
    cx, cy = x, y
    for ch in text:
        g = GLYPHS_5X5.get(ch)
        if g:
            for ry, row in enumerate(g):
                for rx, bit in enumerate(row):
                    if bit == '#':
                        cv.p(cx + rx, cy + ry, color)
        if vertical:
            cy += spacing
        else:
            cx += spacing


# ---------------------------------------------------------------------------
# Crisp 7x7 / 8x7 Hangul, 7x9 Hangul (for 3-tier ㄹ glyphs), 5px/7px Latin & icons
# ---------------------------------------------------------------------------
GLYPHS_7X7 = {
    '치': [
        '..#...#',
        '#####.#',
        '..#...#',
        '.#.#..#',
        '#...#.#',
        '#...#.#',
        '......#',
    ],
    '킨': [
        '####..#',
        '...#..#',
        '####..#',
        '...#..#',
        '......#',
        '#......',
        '#######',
    ],
    '호': [
        '...#...',
        '.#####.',
        '..###..',
        '..#.#..',
        '..###..',
        '...#...',
        '#######',
    ],
    '프': [
        '.#####.',
        '..#.#..',
        '..#.#..',
        '..#.#..',
        '.#####.',
        '.......',
        '#######',
    ],
    '수': [
        '...#...',
        '..#.#..',
        '.#...#.',
        '.......',
        '#######',
        '...#...',
        '...#...',
    ],
    '학': [
        '..#...#.',
        '#####.#.',
        '.#.#..##',
        '.###..#.',
        '......#.',
        '.######.',
        '......#.',
    ],
    '영': [
        '.###..#',
        '.#.#.##',
        '.###..#',
        '.....##',
        '..###..',
        '.#...#.',
        '..###..',
    ],
    '어': [
        '......#',
        '.##...#',
        '#..#..#',
        '#..#.##',
        '#..#..#',
        '.##...#',
        '......#',
    ],
    '시': [
        '..#...#',
        '..#...#',
        '.#.#..#',
        '.#.#..#',
        '#...#.#',
        '#...#.#',
        '......#',
    ],
    '장': [
        '####..#.',
        '..#...#.',
        '.#.#..##',
        '#..#..#.',
        '..###...',
        '.#...#..',
        '..###...',
    ],
    '분': [
        '.#...#.',
        '.#...#.',
        '.#####.',
        '.......',
        '#######',
        '#..#...',
        '#######',
    ],
    '식': [
        '..#...#',
        '..#...#',
        '.#.#..#',
        '#...#.#',
        '......#',
        '.#####.',
        '.....#.',
    ],
    '방': [
        '#..#..#.',
        '#..#..##',
        '####..#.',
        '......#.',
        '..###...',
        '.#...#..',
        '..###...',
    ],
    '당': [
        '####..#.',
        '#.....##',
        '####..#.',
        '......#.',
        '..###...',
        '.#...#..',
        '..###...',
    ],
    '구': [
        '.#####.',
        '.....#.',
        '.....#.',
        '.......',
        '#######',
        '...#...',
        '...#...',
    ],
    '국': [
        '.#####.',
        '.....#.',
        '.......',
        '#######',
        '...#...',
        '.#####.',
        '.....#.',
    ],
    'P': [
        '####.',
        '#...#',
        '#...#',
        '####.',
        '#....',
        '#....',
        '#....',
    ],
    'C': [
        '.###.',
        '#...#',
        '#....',
        '#....',
        '#....',
        '#...#',
        '.###.',
    ],
    'H': [
        '#...#',
        '#...#',
        '#...#',
        '#####',
        '#...#',
        '#...#',
        '#...#',
    ],
    'O': [
        '.###.',
        '#...#',
        '#...#',
        '#...#',
        '#...#',
        '#...#',
        '.###.',
    ],
    'F': [
        '#####',
        '#....',
        '#....',
        '####.',
        '#....',
        '#....',
        '#....',
    ],
    'U': [
        '#...#',
        '#...#',
        '#...#',
        '#...#',
        '#...#',
        '#...#',
        '.###.',
    ],
    'B': [
        '####.',
        '#...#',
        '#...#',
        '####.',
        '#...#',
        '#...#',
        '####.',
    ],
    '·': [
        '...',
        '...',
        '...',
        '.#.',
        '...',
        '...',
        '...',
    ],
}

# 7x9 Hangul specifically for 3-tier ㄹ characters ('미술') so all 3 bars of ㄹ stay razor-sharp
GLYPHS_9 = {
    '미': [
        '......#',
        '####..#',
        '#..#..#',
        '#..#..#',
        '#..#..#',
        '#..#..#',
        '####..#',
        '......#',
        '......#',
    ],
    '술': [
        '...#...',
        '..#.#..',
        '#######',
        '...#...',
        '.#####.',
        '.....#.',
        '.#####.',
        '.#.....',
        '.#####.',
    ],
}

GLYPHS_LATIN_5 = {
    'A': ['.##.', '#..#', '####', '#..#', '#..#'],
    'B': ['###.', '#..#', '###.', '#..#', '###.'],
    'C': ['.###', '#...', '#...', '#...', '.###'],
    'E': ['####', '#...', '###.', '#...', '####'],
    'F': ['####', '#...', '###.', '#...', '#...'],
    'H': ['#..#', '#..#', '####', '#..#', '#..#'],
    'I': ['###',  '.#.',  '.#.',  '.#.',  '###' ],
    'K': ['#..#', '#.#.', '##..', '#.#.', '#..#'],
    'M': ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
    'O': ['.##.', '#..#', '#..#', '#..#', '.##.'],
    'P': ['###.', '#..#', '###.', '#...', '#...'],
    'R': ['###.', '#..#', '###.', '#.#.', '#..#'],
    'S': ['.###', '#...', '.##.', '...#', '###.'],
    'T': ['###',  '.#.',  '.#.',  '.#.',  '.#.' ],
    'U': ['#..#', '#..#', '#..#', '#..#', '.##.'],
    '2': ['###.', '...#', '.##.', '#...', '####'],
    ' ': ['..',   '..',   '..',   '..',   '..'  ],
}


def measure_bitmap_text(text, table, gap=2, vertical=False):
    """Measure pixel width & height of variable-width bitmap text."""
    gs = [table[ch] for ch in text if ch in table]
    if not gs:
        return 0, 0
    if vertical:
        w = max(len(g[0]) for g in gs)
        h = sum(len(g) for g in gs) + gap * (len(gs) - 1)
        return w, h
    w = sum(len(g[0]) for g in gs) + gap * (len(gs) - 1)
    h = max(len(g) for g in gs)
    return w, h


def draw_bitmap_text(cv, x, y, text, color, table, gap=2, vertical=False):
    """Draw crisp variable-width pixel glyphs horizontally or vertically."""
    cx, cy = x, y
    for ch in text:
        g = table.get(ch)
        if not g:
            continue
        gw = len(g[0])
        gh = len(g)
        for ry, row in enumerate(g):
            for rx, bit in enumerate(row):
                if bit == '#':
                    cv.p(cx + rx, cy + ry, color)
        if vertical:
            cy += gh + gap
        else:
            cx += gw + gap


def draw_crisp_sign_box(cv, x0, y0, x1, y1, bg_col, border_col, hi_col=None, shadow=True):
    """Flat, noise-free signboard panel with 1px outer border so 1px inner margins stay clean."""
    cv.rect(x0, y0, x1, y1, bg_col)
    cv.hline(x0, x1, y0, border_col)
    cv.hline(x0, x1, y1 - 1, border_col)
    cv.vline(x0, y0, y1, border_col)
    cv.vline(x1 - 1, y0, y1, border_col)
    if hi_col is not None:
        cv.hline(x0 + 1, x1 - 1, y0, hi_col)
    if shadow:
        cv.hline(x0 + 1, x1, y1, col('ink', 1))


def draw_beer_mug_icon(cv, x, y):
    """Crisp 7x7 foaming golden beer mug emblem."""
    art = [
        '.WWWW..',
        'WWWWW..',
        'YGGGYCC',
        'YGGGY.C',
        'YGOOY.C',
        'YOOOYCC',
        '.OOO...',
    ]
    cmap = {
        'W': col('white', 6),
        'C': col('cream', 5),
        'Y': col('yellow', 5),
        'G': col('yellow', 4),
        'O': col('orange', 4),
    }
    for ry, row in enumerate(art):
        for rx, ch in enumerate(row):
            if ch in cmap:
                cv.p(x + rx, y + ry, cmap[ch])


def draw_noodle_bowl_icon(cv, x, y):
    """Crisp 7x7 steaming noodle/snack bowl emblem."""
    art = [
        '..W.W..',
        '.W...W.',
        '.YYYYY.',
        'RRRRRRR',
        '.RWWWR.',
        '..RRR..',
        '..WWW..',
    ]
    cmap = {
        'W': col('white', 6),
        'Y': col('yellow', 5),
        'R': col('red', 4),
    }
    for ry, row in enumerate(art):
        for rx, ch in enumerate(row):
            if ch in cmap:
                cv.p(x + rx, y + ry, cmap[ch])


def draw_eight_ball_icon(cv, x, y):
    """Crisp 7x7 black billiard 8-ball emblem with white center circle."""
    art = [
        '..KKK..',
        '.KSKKK.',
        'KKWWWKK',
        'KKWKWKK',
        'KKWWWKK',
        '.KKKKK.',
        '..KKK..',
    ]
    cmap = {
        'K': col('ink', 0),
        'S': col('steel', 4),
        'W': col('white', 6),
    }
    for ry, row in enumerate(art):
        for rx, ch in enumerate(row):
            if ch in cmap:
                cv.p(x + rx, y + ry, cmap[ch])


# ---------------------------------------------------------------------------
# Architectural primitives matching Fable 5.2 references
# ---------------------------------------------------------------------------
def draw_floor_ledge(cv, x0, x1, y, ramp='concrete', cast_shadow=True):
    """3px protruding concrete floor slab cornice + cast shadow onto wall below."""
    cv.hline(x0, x1, y, col(ramp, 6))
    cv.hline(x0, x1, y + 1, col(ramp, 4))
    cv.hline(x0, x1, y + 2, col(ramp, 1))
    cv.p(x0, y, col(ramp, 2))
    cv.p(x1 - 1, y, col(ramp, 1))
    if cast_shadow:
        cv.shade_rect(x0, y + 3, x1, y + 5, -1)


def draw_parapet_roof(cv, x0, y0, x1, y1, deck='urethane', para_ramp='concrete', seed=0):
    """Fable-style recessed top-3/4 parapet roof (moss urethane, grey concrete, or wood deck)."""
    if deck == 'urethane':
        dramp, di = 'moss', 3
    elif deck == 'midori':
        dramp, di = 'midori', 4
    elif deck == 'wood':
        dramp, di = 'floorwood', 4
    else:
        dramp, di = 'pavement', 4

    # Outer parapet body
    cv.rect(x0, y0, x1, y1, col(para_ramp, 4))
    # Top parapet coping rim (3px)
    cv.hline(x0, x1, y0, col(para_ramp, 1))
    cv.hline(x0 + 1, x1 - 1, y0 + 1, col(para_ramp, 6))
    cv.hline(x0 + 2, x1 - 2, y0 + 2, col(para_ramp, 2))
    # Left/right parapet walls
    cv.vline(x0, y0, y1, col(para_ramp, 1))
    cv.vline(x0 + 1, y0 + 1, y1 - 1, col(para_ramp, 5))
    cv.vline(x1 - 1, y0, y1, col(para_ramp, 0))
    cv.vline(x1 - 2, y0 + 1, y1 - 1, col(para_ramp, 3))

    # Inner recessed deck
    ix0, iy0, ix1, iy1 = x0 + 2, y0 + 3, x1 - 2, y1 - 4
    if deck == 'wood':
        for y in range(iy0, iy1):
            for x in range(ix0, ix1):
                r = hsh(x // 4, y // 3, seed)
                if y % 3 == 2:
                    cv.p(x, y, col('floorwood', 2))
                else:
                    cv.p(x, y, col('floorwood', 5 if (y % 3 == 0 and r > 0.45) else 4))
    else:
        cv.stipple_rect(ix0, iy0, ix1, iy1, dramp, di, max(0, di - 1), di + 1, seed=seed, rate=0.22)
        # Expansion joints / waterproof panel seams
        for gy in range(iy0 + 5, iy1 - 1, 6):
            cv.hline(ix0 + 1, ix1 - 1, gy, col(dramp, max(0, di - 1)))
        for gx in range(ix0 + 12, ix1 - 4, 16):
            cv.vline(gx, iy0 + 1, iy1, col(dramp, max(0, di - 1)))
    # North & West parapet cast shadow inside roof
    cv.hline(ix0, ix1, iy0, col(dramp, max(0, di - 2)))
    cv.hline(ix0, ix1, iy0 + 1, col(dramp, max(0, di - 1)))
    cv.vline(ix0, iy0, iy1, col(dramp, max(0, di - 2)))
    cv.vline(ix0 + 1, iy0, iy1, col(dramp, max(0, di - 1)))

    # Front parapet coping + shaded vertical face
    cv.hline(x0 + 1, x1 - 1, y1 - 4, col(para_ramp, 6))
    cv.hline(x0 + 1, x1 - 1, y1 - 3, col(para_ramp, 4))
    cv.hline(x0 + 1, x1 - 1, y1 - 2, col(para_ramp, 2))
    cv.hline(x0, x1, y1 - 1, col(para_ramp, 0))


def draw_water_tank(cv, x, y, style='cream'):
    """Detailed 12x15 cylindrical rooftop water tank (Fable style, pokes above parapet)."""
    rmp = 'cream' if style == 'cream' else 'coolwhite'
    # Top cap / hatch
    cv.rect(x + 3, y, x + 9, y + 2, col(rmp, 5))
    cv.hline(x + 3, x + 9, y, col('steel', 1))
    cv.p(x + 5, y + 1, col(rmp, 6))
    cv.p(x + 6, y + 1, col(rmp, 6))
    # Main cylinder body
    cv.rect(x + 1, y + 2, x + 11, y + 12, col(rmp, 4))
    cv.vline(x + 1, y + 2, y + 12, col('steel', 1))
    cv.vline(x + 2, y + 2, y + 12, col(rmp, 5))
    cv.vline(x + 3, y + 2, y + 12, col(rmp, 6))
    cv.vline(x + 8, y + 2, y + 12, col(rmp, 3))
    cv.vline(x + 9, y + 2, y + 12, col(rmp, 2))
    cv.vline(x + 10, y + 2, y + 12, col('steel', 1))
    # Horizontal metal hoops
    cv.hline(x + 1, x + 11, y + 2, col('steel', 2))
    cv.hline(x + 1, x + 11, y + 6, col('steel', 3))
    cv.hline(x + 1, x + 11, y + 9, col('steel', 3))
    cv.hline(x + 1, x + 11, y + 12, col('steel', 1))
    # Steel legs + cross brace
    cv.rect(x + 2, y + 12, x + 4, y + 15, col('steel', 1))
    cv.rect(x + 8, y + 12, x + 10, y + 15, col('steel', 1))
    cv.hline(x + 4, x + 8, y + 13, col('steel', 2))
    # Cast shadow
    cv.hline(x + 2, x + 12, y + 15, col('ink', 1))


def draw_penthouse(cv, x, y, w=15, h=15, wall_ramp='concrete', door_ramp='teal'):
    """Rooftop stairwell penthouse with roof overhang, steel access door & cast shadow."""
    # Roof cap
    cv.outline_box(x - 1, y, x + w + 1, y + 4, col(wall_ramp, 5), col(wall_ramp, 1), top_hi=col(wall_ramp, 6))
    # Front wall
    cv.outline_box(x, y + 3, x + w, y + h, col(wall_ramp, 4), col(wall_ramp, 1), top_hi=col(wall_ramp, 3), bot_sh=col(wall_ramp, 2))
    # Right side depth strip
    cv.vline(x + w - 2, y + 4, y + h - 1, col(wall_ramp, 3))
    # Steel door
    dx0 = x + 3
    dx1 = x + min(w - 3, 10)
    cv.outline_box(dx0, y + 6, dx1, y + h, col(door_ramp, 3), col('steel', 0), top_hi=col(door_ramp, 4))
    cv.p(dx1 - 2, y + (h + 6) // 2, col('yellow', 5))
    # Small louvered vent beside door if wide enough
    if w >= 14:
        cv.rect(x + w - 4, y + 7, x + w - 2, y + 10, col('steel', 1))
        cv.p(x + w - 3, y + 8, col('steel', 4))
    # Cast shadow on deck
    cv.hline(x + 1, x + w + 2, y + h, col('ink', 1))
    cv.vline(x + w, y + 4, y + h + 1, col('ink', 1))


def draw_ac_box(cv, x, y, pipe_dir='right'):
    """Detailed 10x8 AC outdoor unit with fan grille, louvers, copper pipe & cast shadow."""
    cv.outline_box(x, y, x + 10, y + 8, col('coolwhite', 4), col('steel', 1), top_hi=col('white', 6))
    cv.hline(x + 1, x + 9, y + 2, col('steel', 3))
    # Fan grille
    cv.rect(x + 2, y + 3, x + 6, y + 7, col('steel', 1))
    cv.p(x + 3, y + 4, col('steel', 4))
    cv.p(x + 4, y + 5, col('steel', 4))
    cv.p(x + 4, y + 4, col('steel', 2))
    # Louvers on right
    cv.p(x + 7, y + 4, col('steel', 3))
    cv.p(x + 7, y + 6, col('steel', 3))
    cv.vline(x + 8, y + 3, y + 7, col('coolwhite', 2))
    # Copper/orange drain hose
    if pipe_dir == 'right':
        cv.p(x + 10, y + 5, col('orange', 3))
        cv.p(x + 10, y + 6, col('orange', 2))
    elif pipe_dir == 'left':
        cv.p(x - 1, y + 5, col('orange', 3))
        cv.p(x - 1, y + 6, col('orange', 2))
    cv.hline(x + 1, x + 11, y + 8, col('ink', 1))


def draw_wall_ac(cv, x, y):
    """Compact 9x7 wall-mounted AC unit on dark steel L-brackets."""
    cv.outline_box(x, y, x + 9, y + 6, col('white', 4), col('steel', 1), top_hi=col('white', 6))
    cv.rect(x + 2, y + 2, x + 5, y + 5, col('steel', 1))
    cv.p(x + 3, y + 3, col('steel', 4))
    cv.p(x + 6, y + 3, col('steel', 3))
    # L-brackets underneath
    cv.vline(x + 1, y + 6, y + 8, col('steel', 1))
    cv.vline(x + 7, y + 6, y + 8, col('steel', 1))
    cv.hline(x + 1, x + 8, y + 6, col('ink', 1))


def draw_roof_railing(cv, x0, x1, y, ramp='steel'):
    """Crisp thin rooftop metal railing sitting atop front parapet."""
    cv.hline(x0, x1, y, col(ramp, 5))
    cv.hline(x0, x1, y + 2, col(ramp, 3))
    for x in range(x0, x1, 5):
        cv.vline(x, y, y + 5, col(ramp, 2))
        cv.p(x, y, col(ramp, 6))


def draw_antenna(cv, x, y, h=10):
    """Rooftop TV antenna / mast."""
    cv.vline(x, y, y + h, col('steel', 2))
    cv.hline(x - 3, x + 4, y + 1, col('steel', 4))
    cv.hline(x - 2, x + 3, y + 3, col('steel', 3))
    cv.p(x, y, col('white', 6))


def draw_downspout(cv, x, y0, y1):
    """Vertical rainwater pipe running down building wall with mounting clips."""
    cv.vline(x, y0, y1, col('steel', 2))
    cv.vline(x + 1, y0, y1, col('steel', 4))
    cv.vline(x + 2, y0, y1, col('ink', 1))
    for y in range(y0 + 6, y1 - 4, 14):
        cv.hline(x - 1, x + 2, y, col('steel', 1))


def draw_sign_fascia(cv, x0, y0, x1, y1, bg_ramp='blue', bg_i=3, text='', text_col='white:6', border_col=None, shadow=True):
    """Crisp horizontal commercial fascia signboard with readable pixel glyphs."""
    bc = border_col if border_col else col(bg_ramp, 0)
    cv.outline_box(x0, y0, x1, y1, col(bg_ramp, bg_i), bc, top_hi=col(bg_ramp, min(bg_i + 2, 5)), bot_sh=col(bg_ramp, max(bg_i - 1, 1)))
    if text:
        tw = len(text) * 6 - 1
        tx = x0 + max(2, (x1 - x0 - tw) // 2)
        ty = y0 + max(1, (y1 - y0 - 5) // 2)
        draw_glyphs(cv, tx, ty, text, text_col, vertical=False, spacing=6)
    if shadow:
        cv.hline(x0 + 1, x1, y1, col('ink', 1))


def draw_blade_sign(cv, x0, y0, x1, y1, bg_ramp='yellow', bg_i=4, text='', text_col='red:1', side='right'):
    """Vertical Korean blade sign mounted via steel brackets."""
    # Steel mounting brackets
    bx = x0 - 2 if side == 'right' else x1
    for by in (y0 + 4, y1 - 6):
        cv.hline(bx, bx + 2, by, col('steel', 1))
        cv.hline(bx, bx + 2, by + 1, col('steel', 4))
    cv.outline_box(x0, y0, x1, y1, col(bg_ramp, bg_i), col(bg_ramp, 0), top_hi=col(bg_ramp, min(bg_i + 1, 5)), bot_sh=col(bg_ramp, max(bg_i - 2, 1)))
    if text:
        th = len(text) * 6 - 1
        tx = x0 + max(2, (x1 - x0 - 5) // 2)
        ty = y0 + max(2, (y1 - y0 - th) // 2)
        draw_glyphs(cv, tx, ty, text, text_col, vertical=True, spacing=6)
    cv.hline(x0 + 1, x1 + 1, y1, col('ink', 1))


def draw_rich_window(cv, x0, y0, x1, y1, mode='glass', frame='steel:1', sill='concrete:5',
                     curtain=None, poster_cols=None, flower=None, seed=0):
    """High-detail lived-in Fable window with interior storytelling."""
    w = x1 - x0
    h = y1 - y0
    cv.outline_box(x0, y0, x1, y1, col('glass', 1), frame)
    ix0, iy0, ix1, iy1 = x0 + 1, y0 + 1, x1 - 1, y1 - 1
    iw, ih = ix1 - ix0, iy1 - iy0

    for y in range(iy0, iy1):
        ry = y - iy0
        for x in range(ix0, ix1):
            rx = x - ix0
            if mode == 'warm':
                # Warm cozy glowing room with ceiling light gradient
                if ry == 0:
                    cv.p(x, y, col('orange', 2))
                elif ry == 1:
                    cv.p(x, y, col('orange', 4))
                elif ry < ih - 2:
                    cv.p(x, y, col('yellow', 5 if (rx + ry) % 4 == 0 else 4))
                else:
                    cv.p(x, y, col('orange', 3 if rx % 3 else 2))
            elif mode == 'blinds':
                if ry < (ih * 2) // 3:
                    cv.p(x, y, col('cream', 5 if ry % 2 == 0 else 3))
                else:
                    cv.p(x, y, col('glass', 2 if (rx + ry) % 3 else 4))
            elif mode == 'blinds_warm':
                if ry < ih // 2:
                    cv.p(x, y, col('cream', 6 if ry % 2 == 0 else 4))
                else:
                    cv.p(x, y, col('yellow', 4 if ry % 2 else 5))
            elif mode == 'neon_cyan':
                if ry == 0:
                    cv.p(x, y, col('navy', 1))
                elif ry >= ih - 3:
                    cv.p(x, y, col('teal', 4 if rx % 3 != 0 else 5))
                else:
                    cv.p(x, y, col('glass', 5 if (rx % 4 in (1, 2) and ry >= 2) else 3))
            elif mode == 'neon_green':
                if ry == 0:
                    cv.p(x, y, col('green', 1))
                elif ry == 1 and rx % 4 == 2:
                    cv.p(x, y, col('yellow', 5))  # hanging billiard lamp
                elif ry >= ih - 3:
                    cv.p(x, y, col('green', 4 if rx % 2 == 0 else 3))  # green felt glow
                else:
                    cv.p(x, y, col('orange', 4 if ry == 2 else 3))
            elif mode == 'dark_lounge':
                if ry == 0:
                    cv.p(x, y, col('ink', 0))
                elif (rx + ry) in (2, 3):
                    cv.p(x, y, col('tile', 4))
                elif ry >= ih - 2 and rx % 5 == 2:
                    cv.p(x, y, col('orange', 3))  # dim warm sconce
                else:
                    cv.p(x, y, col('navy', 1 if (rx + ry) % 4 else 2))
            elif mode == 'frosted':
                # Glass blocks for stairwell
                if rx % 3 == 2 or ry % 3 == 2:
                    cv.p(x, y, col('coolwhite', 2))
                else:
                    cv.p(x, y, col('coolwhite', 5 if (rx + ry) % 2 == 0 else 4))
            elif mode == 'shuttered':
                cv.p(x, y, col('wood', 4 if ry % 2 == 0 else 2))
            else:
                # Crisp sky-reflective teal-blue glass with diagonal specular shine
                if ry == 0:
                    cv.p(x, y, col('glass', 0))
                elif (rx + ry) in (1, 2) or (rx + ry == 5 and ry <= 3):
                    cv.p(x, y, col('glass', 5))
                elif (rx + ry) == 6 and ry <= 2:
                    cv.p(x, y, col('glass', 6))
                elif ry >= ih - 2:
                    cv.p(x, y, col('glass', 3))
                else:
                    cv.p(x, y, col('glass', 2 if hsh(rx, ry, seed) > 0.25 else 1))

    # Tiny interior storytelling silhouettes for warm rooms
    if mode == 'warm' and iw >= 7 and ih >= 6:
        # Hanging lamp dot at top center
        cv.p(ix0 + iw // 2, iy0, col('steel', 1))
        cv.p(ix0 + iw // 2, iy0 + 1, col('yellow', 5))
        # Subtle interior furniture silhouette along bottom
        for x in range(ix0 + 1, ix1 - 1, 3):
            if hsh(x, iy1, seed + 9) > 0.45:
                cv.rect(x, iy1 - 2, min(x + 2, ix1), iy1, col('wood', 2))

    # Optional colorful posters stuck to inside of glass (Korean hagwon / clinic)
    if poster_cols and iw >= 6 and ih >= 6:
        px = ix0 + 1
        for pc in poster_cols:
            if px + 2 < ix1:
                cv.rect(px, iy1 - 4, px + 3, iy1 - 1, pc)
                px += 4

    # Optional side curtains
    if curtain and iw >= 5:
        for y in range(iy0, iy1):
            cv.p(ix0, y, col(curtain, 4 if y % 2 == 0 else 2))
            if iw >= 8:
                cv.p(ix1 - 1, y, col(curtain, 3 if y % 2 == 0 else 1))

    # Mullions
    if mode != 'frosted':
        if w >= 12:
            step = w // 3
            cv.vline(x0 + step, iy0, iy1, frame)
            cv.vline(x0 + step * 2, iy0, iy1, frame)
        elif w >= 7:
            cv.vline((x0 + x1) // 2, iy0, iy1, frame)
        if h >= 10:
            cv.hline(ix0, ix1, (y0 + y1) // 2, frame)

    # Sill + drop shadow
    if sill:
        cv.hline(x0 - 1, x1 + 1, y1, sill)
        cv.hline(x0, x1, y1 + 1, col('ink', 1))

    # Optional flower box sitting on sill
    if flower:
        cv.planter_box(x0, y1 - 3, x1, y1 + 1, flower=flower, pot_ramp='brick')


def draw_a_frame_menu(cv, x, y):
    """Compact 9x12 wooden A-frame sidewalk menu board."""
    cv.outline_box(x, y, x + 8, y + 10, col('asphalt', 1), col('wood', 2), top_hi=col('wood', 4))
    cv.hline(x + 2, x + 6, y + 2, col('yellow', 5))
    cv.hline(x + 2, x + 5, y + 4, col('white', 5))
    cv.hline(x + 2, x + 6, y + 6, col('orange', 4))
    cv.vline(x + 1, y + 10, y + 12, col('wood', 1))
    cv.vline(x + 6, y + 10, y + 12, col('wood', 1))


def draw_potted_shrub(cv, x, y, flower=None):
    """8x12 lush potted street shrub in terracotta pot."""
    cv.foliage_cluster(x + 4, y + 3, 3, 3, 'foliage', seed=x * 7 + y, blossom=flower)
    cv.outline_box(x + 1, y + 6, x + 7, y + 12, col('brick', 4), col('brick', 1), top_hi=col('brick', 5))
    cv.hline(x, x + 8, y + 6, col('brick', 5))


def draw_stair_lobby(cv, x0, y0, x1, y1, door_frame='steel:1'):
    """Recessed Korean sangga stairwell entrance with ascending steps & directory."""
    cv.outline_box(x0, y0, x1, y1, col('pavement', 1), door_frame)
    # Bright ceiling fluorescent strip
    cv.hline(x0 + 2, x1 - 2, y0 + 2, col('coolwhite', 5))
    # Ascending stair treads inside
    sy = y1 - 3
    inset = 2
    while sy > y0 + 5 and x0 + inset < x1 - inset:
        cv.hline(x0 + inset, x1 - inset, sy, col('concrete', 4))
        cv.hline(x0 + inset, x1 - inset, sy - 1, col('concrete', 2))
        sy -= 3
    # Glass door framing overlay
    cv.vline(x0 + 1, y0 + 1, y1 - 1, col('glass', 3))
    cv.vline(x1 - 2, y0 + 1, y1 - 1, col('glass', 2))
    cv.hline(x0, x1, y1 - 1, col('concrete', 5))


def finish_building_edges(cv, bx0, bx1, top_y, bot_y):
    """Crisp Fable-style architectural edge finish & right/bottom grounding shade."""
    for y in range(top_y, bot_y):
        if cv.get(bx0, y)[3] == 255:
            cv.p(bx0, y, shade_rgba(cv.get(bx0, y), -1))
        if cv.get(bx1 - 1, y)[3] == 255:
            cv.p(bx1 - 1, y, shade_rgba(cv.get(bx1 - 1, y), -2))
        if bx1 - 2 >= 0 and cv.get(bx1 - 2, y)[3] == 255:
            cv.p(bx1 - 2, y, shade_rgba(cv.get(bx1 - 2, y), -1))
    for x in range(bx0, bx1):
        if cv.get(x, bot_y - 1)[3] == 255:
            cv.p(x, bot_y - 1, shade_rgba(cv.get(x, bot_y - 1), -2))


# ---------------------------------------------------------------------------
# Building 1: mf-bldg-kr_chicken_pub (96x112)
# ---------------------------------------------------------------------------
def build_kr_chicken_pub():
    cv = Canvas(96, 112)
    # Base red-brick body (x=1..87, y=24..112; right margin reserved for vertical blade sign x=85..96)
    bx0, bx1 = 1, 87
    cv.brick_wall(bx0, 24, bx1, 112, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=101)

    # Green urethane flat roof (y=4..24)
    draw_parapet_roof(cv, bx0, 4, bx1, 24, deck='urethane', para_ramp='concrete', seed=102)
    # Rooftop props poking slightly into sky (y=0..4)
    draw_water_tank(cv, 7, 1, style='cream')
    # Small pipe & vent
    cv.vline(24, 5, 16, col('steel', 3))
    cv.vline(25, 5, 16, col('steel', 1))
    cv.hline(23, 27, 5, col('steel', 5))
    # Twin rooftop AC units + potted roof shrub
    draw_ac_box(cv, 46, 10, pipe_dir='left')
    draw_ac_box(cv, 60, 10, pipe_dir='right')
    cv.planter_box(73, 12, 83, 18, flower='yellow:5', pot_ramp='brick')
    # Concrete roof corner trim columns
    cv.vline(bx0 + 1, 24, 111, col('brick', 2))
    cv.vline(bx1 - 2, 24, 111, col('brick', 2))

    # --- 3F: Warm studio windows (y=24..44) ---
    cv.shade_rect(bx0, 24, bx1, 26, -1)
    draw_downspout(cv, 4, 24, 111)
    # Left wide cozy warm studio window with pink side curtain
    draw_rich_window(cv, 11, 28, 34, 41, mode='warm', frame='wood:1', sill='concrete:5', curtain='pink', seed=11)
    # Center smaller casement window with flower box
    draw_rich_window(cv, 40, 29, 54, 40, mode='glass', frame='steel:1', sill='concrete:5', flower='red:4', seed=12)
    # Right studio window with warm blinds + wall-mounted AC beside it
    draw_rich_window(cv, 60, 28, 74, 40, mode='blinds_warm', frame='steel:1', sill='concrete:5', seed=13)
    draw_wall_ac(cv, 75, 34)

    # --- 2F: Clean office/pub upper floor with crisp slate plaque (y=44..68) ---
    draw_floor_ledge(cv, bx0, bx1, 44, ramp='concrete')
    # Subtle cream stucco inset panel on 2F to break masonry rhythm
    cv.outline_box(9, 48, 81, 66, col('cream', 4), col('brick', 1))
    cv.stipple_rect(10, 49, 80, 65, 'cream', 4, 3, 5, seed=105, rate=0.14)
    draw_rich_window(cv, 13, 49, 37, 57, mode='blinds', frame='steel:1', sill='concrete:5', seed=21)
    draw_rich_window(cv, 43, 49, 61, 57, mode='glass', frame='steel:1', sill='concrete:5', curtain='cream', seed=22)
    draw_rich_window(cv, 65, 49, 78, 57, mode='warm', frame='steel:1', sill='concrete:5', seed=23)
    # Clean dark-slate 2F office plaque (crisp 5px Latin "2F OFFICE")
    draw_crisp_sign_box(cv, 13, 58, 79, 67, col('steel', 1), col('steel', 0), hi_col=col('steel', 3))
    tw, _ = measure_bitmap_text('2F OFFICE', GLYPHS_LATIN_5, gap=1)
    draw_bitmap_text(cv, 13 + (66 - tw) // 2, 60, '2F OFFICE', col('cream', 6), GLYPHS_LATIN_5, gap=1)

    # --- 1F: Warm-lit Korean Chicken & Hof Pub (y=68..112) ---
    cv.brick_wall(bx0, 68, bx1, 112, ramp='brick', base_i=3, course_h=3, brick_w=6, seed=109)
    # Crisp high-contrast 1F pub fascia: golden beer mugs + 7x7 "치킨·호프" (x=5..83, y=68..79)
    draw_crisp_sign_box(cv, 5, 68, 83, 79, col('red', 0), col('darkwood', 0), hi_col=col('cedar', 4))
    draw_beer_mug_icon(cv, 10, 70)
    pub_txt = '치킨·호프'
    pw, _ = measure_bitmap_text(pub_txt, GLYPHS_7X7, gap=2)
    draw_bitmap_text(cv, 5 + (78 - pw) // 2, 70, pub_txt, col('yellow', 5), GLYPHS_7X7, gap=2)
    draw_beer_mug_icon(cv, 71, 70)

    # Red/cream striped awning directly under pub fascia
    cv.awning(5, 79, 76, 85, ramp_a='red', ramp_b='cream', stripe_w=3)
    # Wide glowing front pub window (x=7..45, y=86..105)
    cv.outline_box(7, 86, 45, 105, col('orange', 4), col('darkwood', 1))
    # Backlit warm pub interior: hanging bulbs, shelves, beer mugs & chicken counter
    for y in range(87, 104):
        for x in range(8, 44):
            if y <= 89:
                cv.p(x, y, col('orange', 2))
            elif y <= 97:
                cv.p(x, y, col('yellow', 5 if (x + y) % 3 == 0 else 4))
            else:
                cv.p(x, y, col('orange', 4))
    # 3 hanging Edison pub lamps
    for lx in (14, 25, 36):
        cv.vline(lx, 87, 90, col('darkwood', 0))
        cv.rect(lx - 1, 90, lx + 2, 92, col('yellow', 5))
        cv.p(lx, 91, col('white', 6))
    # Bar counter & beer mugs / golden chicken platters inside
    cv.rect(8, 98, 44, 104, col('wood', 2))
    cv.hline(8, 44, 98, col('cedar', 5))
    cv.hline(8, 44, 99, col('wood', 3))
    # Back bottle shelf silhouettes
    cv.hline(9, 43, 94, col('wood', 2))
    for bx in range(10, 42, 4):
        cv.vline(bx, 92, 94, col('green', 3) if bx % 8 == 2 else col('orange', 2))
    for mx in (12, 18, 27, 34, 40):
        cv.rect(mx, 95, mx + 2, 98, col('yellow', 5))
        cv.p(mx, 95, col('white', 6))  # beer foam!
    # Tiny glowing red-gold neon emblem on left pane
    cv.rect(10, 90, 17, 93, col('red', 4))
    cv.hline(11, 16, 91, col('yellow', 5))
    # Subtle glass diagonal reflection across warm pub glass
    for d in range(6):
        cv.p(36 + d, 92 - d, col('cream', 6))
        cv.p(10 + d, 97 - d, col('cream', 6))
    # Window vertical wood mullions & wainscot below
    cv.vline(20, 87, 104, col('darkwood', 1))
    cv.vline(32, 87, 104, col('darkwood', 1))
    cv.siding_wall(7, 105, 45, 111, ramp='wood', base_i=3, horizontal=False, step=3, seed=14)
    cv.hline(7, 45, 105, col('cedar', 5))

    # Recessed pub wood+glass door (x=48..64, doorCol=3)
    cv.door_wood(48, 86, 64, 111, ramp='wood', glass_top=True)
    draw_rich_window(cv, 50, 88, 62, 98, mode='warm', frame='darkwood:1', sill=None, seed=15)
    cv.hline(47, 65, 110, col('concrete', 5))

    # A-frame menu board + red beer crate (x=66..75)
    draw_a_frame_menu(cv, 67, 98)
    cv.hline(67, 75, 98, col('cedar', 5))
    cv.rect(67, 92, 74, 97, col('red', 3))
    cv.hline(67, 74, 92, col('red', 5))
    cv.hline(68, 73, 94, col('red', 1))
    # Upper-floor narrow steel stairwell entry on right (x=76..86)
    draw_stair_lobby(cv, 76, 86, 86, 111)
    # Tiny warm pub lantern beside door
    cv.rect(45, 87, 48, 92, col('red', 4))
    cv.p(46, 89, col('yellow', 5))

    # Grounded stone sidewalk plinth & building edges BEFORE overhanging right blade sign
    cv.hline(bx0, bx1, 111, col('stone', 2))
    finish_building_edges(cv, bx0, bx1, 4, 112)

    # Crisp vertical pub blade sign on right edge (x=85..96, y=27..73): stacked "HOF" + beer mug badge
    for by in (32, 65):
        cv.hline(83, 85, by, col('steel', 1))
        cv.hline(83, 85, by + 1, col('steel', 4))
    draw_crisp_sign_box(cv, 85, 27, 96, 73, col('yellow', 4), col('red', 1), hi_col=col('yellow', 5))
    draw_bitmap_text(cv, 88, 30, 'HOF', col('red', 0), GLYPHS_7X7, gap=2, vertical=True)
    # Lower dark burgundy beer-mug badge on blade sign
    cv.rect(86, 59, 95, 72, col('red', 0))
    cv.hline(86, 95, 59, col('red', 2))
    draw_beer_mug_icon(cv, 87, 62)

    return cv, {
        'id': 'mf-bldg-kr_chicken_pub',
        'name': '치킨호프 적벽돌 3층 상가',
        'pack': PACK, 'w': 6, 'h': 7, 'doorCol': 3,
        'lightAnchors': [[26, 93], [56, 91], [90, 48], [22, 36]],
        'tags': ['sangga', 'korean', 'pub', 'chicken', 'brick', 'commercial', '3f'],
    }


# ---------------------------------------------------------------------------
# Building 2: mf-bldg-kr_hagwon_cafe (96x128)
# ---------------------------------------------------------------------------
def build_kr_hagwon_cafe():
    cv = Canvas(96, 128)
    bx0, bx1 = 1, 95
    # Granite-tile clad body
    cv.tile_cladding(bx0, 24, bx1, 128, ramp='concrete', base_i=4, cw=5, ch=4, seed=201)

    # Rooftop (y=5..24) with concrete parapet + stairwell penthouse & railing
    draw_parapet_roof(cv, bx0, 5, bx1, 24, deck='urethane', para_ramp='concrete', seed=202)
    draw_penthouse(cv, 8, 1, w=17, h=17, wall_ramp='concrete', door_ramp='teal')
    draw_ac_box(cv, 44, 11, pipe_dir='left')
    draw_ac_box(cv, 58, 11, pipe_dir='right')
    cv.planter_box(73, 12, 89, 18, flower='orange:4', pot_ramp='stone')
    draw_antenna(cv, 34, 2, h=11)
    draw_roof_railing(cv, 26, 92, 16, ramp='steel')

    # --- 3F: Math/Art Hagwon (y=24..54) ---
    cv.shade_rect(bx0, 24, bx1, 26, -1)
    # 3 distinct windows on 3F with clean unbroken mullions (no floating green patch!)
    draw_rich_window(cv, 6, 26, 29, 39, mode='warm', frame='navy:1', sill='concrete:6',
                     poster_cols=[col('yellow', 4), col('orange', 4)], seed=211)
    draw_rich_window(cv, 34, 26, 57, 39, mode='blinds', frame='navy:1', sill='concrete:6', seed=212)
    draw_rich_window(cv, 62, 26, 80, 39, mode='glass', frame='navy:1', sill='concrete:6',
                     poster_cols=[col('green', 4)], seed=213)
    # Stairwell frosted vertical glass block strip on far right
    draw_rich_window(cv, 84, 26, 91, 42, mode='frosted', frame='steel:2', sill=None, seed=214)

    # 3F Split Two-Tenant Hagwon Fascia Signboards: crisp "수학" + crisp "미술" (y=41..54)
    draw_crisp_sign_box(cv, 5, 41, 46, 54, col('orange', 2), col('orange', 0), hi_col=col('orange', 4))
    sw, _ = measure_bitmap_text('수학', GLYPHS_7X7, gap=3)
    draw_bitmap_text(cv, 5 + (41 - sw) // 2, 44, '수학', col('white', 6), GLYPHS_7X7, gap=3)

    draw_crisp_sign_box(cv, 48, 41, 82, 54, col('navy', 1), col('navy', 0), hi_col=col('navy', 3))
    aw, _ = measure_bitmap_text('미술', GLYPHS_9, gap=3)
    draw_bitmap_text(cv, 48 + (34 - aw) // 2, 43, '미술', col('yellow', 5), GLYPHS_9, gap=3)

    # --- 2F: English Hagwon (y=54..84) ---
    draw_floor_ledge(cv, bx0, bx1, 54, ramp='concrete')
    # Distinct 2-bay wide window layout (NO floor cloning!)
    draw_rich_window(cv, 6, 58, 44, 71, mode='blinds_warm', frame='steel:1', sill='concrete:6',
                     poster_cols=[col('red', 4), col('yellow', 5), col('blue', 4), col('green', 4)], seed=221)
    draw_rich_window(cv, 49, 58, 71, 71, mode='warm', frame='steel:1', sill='concrete:6', curtain='teal', seed=222)
    draw_wall_ac(cv, 72, 63)
    draw_rich_window(cv, 84, 58, 91, 74, mode='frosted', frame='steel:2', sill=None, seed=223)
    # 2F Bold Emerald Green Hagwon fascia signboard: crisp 7x7 "영어" (y=73..84)
    draw_crisp_sign_box(cv, 5, 73, 81, 84, col('green', 1), col('green', 0), hi_col=col('green', 3))
    ew, _ = measure_bitmap_text('영어', GLYPHS_7X7, gap=4)
    draw_bitmap_text(cv, 5 + (76 - ew) // 2, 75, '영어', col('white', 6), GLYPHS_7X7, gap=4)
    # Clean decorative side accent bars
    cv.hline(12, 24, 78, col('yellow', 5))
    cv.hline(62, 74, 78, col('yellow', 5))

    # --- 1F: Cozy Espresso Cafe + Granite Stairwell (y=84..128) ---
    draw_floor_ledge(cv, bx0, bx1, 84, ramp='stone')
    # Dark-wood cafe storefront framing on left (x=3..74)
    cv.siding_wall(3, 87, 74, 127, ramp='wood', base_i=3, horizontal=True, step=3, seed=230)
    # Crisp 1F Cafe fascia signboard: crisp 5px Latin "CAFE" (x=6..56, y=88..97)
    draw_crisp_sign_box(cv, 6, 88, 56, 97, col('darkwood', 0), col('cedar', 4), hi_col=col('cedar', 5))
    cw, _ = measure_bitmap_text('CAFE', GLYPHS_LATIN_5, gap=2)
    draw_bitmap_text(cv, 6 + (50 - cw) // 2, 90, 'CAFE', col('cream', 6), GLYPHS_LATIN_5, gap=2)
    cv.p(12, 92, col('yellow', 5))
    cv.p(49, 92, col('yellow', 5))
    # Tiny brass sconce lights flanking sign
    for sx in (59, 69):
        cv.rect(sx, 91, sx + 3, 95, col('yellow', 5))
        cv.p(sx + 1, 92, col('white', 6))
        cv.hline(sx, sx + 3, 90, col('darkwood', 0))

    # Wide wood-trimmed cafe glass window (x=6..48, y=99..120)
    cv.outline_box(6, 99, 48, 120, col('orange', 4), col('cedar', 3))
    for y in range(100, 119):
        for x in range(7, 47):
            if y < 103:
                cv.p(x, y, col('orange', 2))
            elif y < 113:
                cv.p(x, y, col('yellow', 4 if (x + y) % 3 else 5))
            else:
                cv.p(x, y, col('cedar', 3))  # wooden espresso counter
    # Espresso machine & pastry display case inside window
    cv.rect(11, 108, 19, 113, col('steel', 4))
    cv.rect(12, 109, 18, 112, col('steel', 2))
    cv.p(14, 110, col('red', 4))
    # Glass pastry dome & warm muffins
    cv.rect(25, 108, 39, 113, col('glass', 5))
    cv.hline(26, 38, 111, col('orange', 4))
    cv.hline(26, 38, 112, col('yellow', 5))
    # Hanging bulbs
    for lx in (15, 27, 39):
        cv.vline(lx, 100, 103, col('darkwood', 0))
        cv.p(lx, 103, col('white', 6))
    # Mullions
    cv.vline(21, 100, 119, col('cedar', 2))
    cv.vline(34, 100, 119, col('cedar', 2))
    # Planter boxes along bottom of cafe window
    cv.planter_box(6, 118, 25, 127, flower='pink:4', pot_ramp='wood')
    cv.planter_box(27, 118, 47, 127, flower='yellow:5', pot_ramp='wood')

    # Cafe cedar-wood glass door (x=51..69, doorCol=3)
    cv.door_wood(51, 99, 69, 127, ramp='cedar', glass_top=True)
    draw_rich_window(cv, 53, 101, 67, 115, mode='warm', frame='wood:1', sill=None, seed=235)
    cv.hline(50, 70, 126, col('stone', 5))

    # Right-side recessed stairwell lobby for 2F/3F hagwons (x=76..92)
    draw_stair_lobby(cv, 76, 94, 92, 127)
    # Mini floor directory plaque beside lobby
    cv.outline_box(76, 87, 92, 93, col('white', 5), col('steel', 1))
    cv.hline(78, 84, 89, col('orange', 4))
    cv.hline(85, 90, 89, col('green', 4))
    cv.hline(78, 89, 91, col('navy', 3))

    finish_building_edges(cv, bx0, bx1, 5, 128)
    return cv, {
        'id': 'mf-bldg-kr_hagwon_cafe',
        'name': '학원·에스프레소 카페 화강석 3층 상가',
        'pack': PACK, 'w': 6, 'h': 8, 'doorCol': 3,
        'lightAnchors': [[27, 108], [60, 108], [18, 36], [25, 66]],
        'tags': ['sangga', 'korean', 'hagwon', 'cafe', 'granite', 'commercial', '3f'],
    }


# ---------------------------------------------------------------------------
# Building 3: mf-bldg-kr_bakery_clinic (112x112)
# ---------------------------------------------------------------------------
def build_kr_bakery_clinic():
    cv = Canvas(112, 112)
    bx0, bx1 = 1, 111
    # Cream stucco & warm stone sangga body
    cv.stipple_rect(bx0, 24, bx1, 112, 'cream', 4, 3, 5, seed=301, rate=0.16)
    # Warm stone side pilasters
    cv.tile_cladding(bx0, 24, 10, 112, ramp='stone', base_i=4, cw=4, ch=4, seed=302)
    cv.tile_cladding(102, 24, bx1, 112, ramp='stone', base_i=4, cw=4, ch=4, seed=303)

    # Rooftop (y=5..24) with timber pergola + climbing vines + AC + tank
    draw_parapet_roof(cv, bx0, 5, bx1, 24, deck='concrete', para_ramp='stone', seed=304)
    # Rooftop timber pergola on left-center (x=10..62, y=1..18)
    for px in (12, 34, 56):
        cv.vline(px, 3, 18, col('wood', 2))
        cv.vline(px + 1, 3, 18, col('cedar', 4))
    cv.hline(9, 60, 2, col('wood', 1))
    cv.hline(9, 60, 3, col('cedar', 5))
    cv.hline(9, 60, 4, col('wood', 2))
    # Cross slats on pergola
    for sx in range(13, 58, 6):
        cv.vline(sx, 1, 5, col('cedar', 4))
    # Climbing greenery across pergola roof
    cv.foliage_cluster(22, 3, 8, 2, 'foliage', seed=305, blossom='pink:4')
    cv.foliage_cluster(47, 4, 7, 2, 'foliage', seed=306, blossom='white:6')
    # Right side roof props: water tank + AC unit + planter
    draw_water_tank(cv, 72, 1, style='coolwhite')
    draw_ac_box(cv, 89, 10, pipe_dir='left')
    cv.planter_box(16, 13, 30, 19, flower='red:4', pot_ramp='brick')

    # --- 3F: Recessed Veranda Terrace with Potted Shrubs (y=24..50) ---
    cv.shade_rect(bx0, 24, bx1, 26, -1)
    # Recessed shaded veranda interior (x=12..100, y=27..47)
    cv.stipple_rect(12, 27, 100, 44, 'kinari', 3, 2, 4, seed=310, rate=0.12)
    cv.hline(12, 100, 27, col('stone', 1))
    cv.hline(12, 100, 28, col('stone', 2))
    # Warm sunlit patio sliding doors inside veranda
    draw_rich_window(cv, 16, 29, 44, 42, mode='warm', frame='wood:1', sill=None, curtain='cream', seed=311)
    draw_rich_window(cv, 49, 29, 73, 42, mode='glass', frame='wood:1', sill=None, curtain='pink', seed=312)
    draw_rich_window(cv, 78, 29, 96, 42, mode='blinds_warm', frame='wood:1', sill=None, seed=313)
    # Veranda deck floor & open wooden balustrade
    cv.terrace_deck(12, 40, 100, 49, floor_ramp='floorwood', rail_ramp='cedar', seed=314)
    # Lush potted shrubs along terrace
    cv.planter_box(15, 37, 29, 43, flower='yellow:5', pot_ramp='brick')
    cv.planter_box(46, 37, 62, 43, flower='red:4', pot_ramp='brick')
    cv.planter_box(82, 37, 96, 43, flower='pink:4', pot_ramp='brick')

    # --- 2F: Dental Clinic with Wide Panoramic Tinted Glass & Pale Blue Cross Sign (y=50..76) ---
    draw_floor_ledge(cv, bx0, bx1, 49, ramp='stone')
    # Wide panoramic tinted glass windows
    draw_rich_window(cv, 12, 54, 62, 66, mode='glass', frame='steel:2', sill='concrete:6',
                     poster_cols=[col('coolwhite', 5), col('teal', 4)], seed=321)
    # Subtle dental chair silhouette & white overhead lamp inside panoramic bay
    cv.hline(24, 34, 56, col('white', 6))
    cv.rect(26, 61, 33, 64, col('teal', 4))
    draw_rich_window(cv, 65, 54, 98, 66, mode='blinds', frame='steel:2', sill='concrete:6', seed=322)
    # Pale blue dental clinic fascia sign + cross emblem
    draw_sign_fascia(cv, 12, 68, 86, 76, bg_ramp='blue', bg_i=4, text='+치과의원', text_col='white:6', border_col=col('blue', 1))
    # Crisp protruding pale-blue cross box on right
    cv.outline_box(90, 67, 101, 76, col('coolwhite', 5), col('blue', 2))
    draw_glyphs(cv, 93, 69, '+', col('blue', 3))

    # --- 1F: Artisan Bakery + Clinic Entry (y=76..112) ---
    draw_floor_ledge(cv, bx0, bx1, 76, ramp='stone', cast_shadow=False)
    cv.tile_cladding(10, 79, 102, 112, ramp='stone', base_i=4, cw=6, ch=4, seed=330)
    # Dark green & cream striped scalloped awning over bakery storefront
    cv.awning(8, 78, 80, 85, ramp_a='green', ramp_b='cream', stripe_w=4)

    # Golden bread display window (x=10..55, y=86..106)
    cv.outline_box(10, 86, 55, 106, col('orange', 4), col('wood', 1))
    for y in range(87, 105):
        for x in range(11, 54):
            cv.p(x, y, col('yellow', 5 if y < 95 else 4) if (x + y) % 3 else col('orange', 4))
    # 3 tiered wooden bread display shelves packed with golden loaves & pastries!
    for sy in (92, 98, 103):
        cv.hline(12, 53, sy, col('wood', 2))
        cv.hline(12, 53, sy + 1, col('cedar', 4))
        for bx in range(13, 50, 6):
            # Golden round boule / baguette loaf
            cv.rect(bx, sy - 3, bx + 4, sy, col('orange', 3 if (bx + sy) % 4 else 4))
            cv.hline(bx + 1, bx + 3, sy - 3, col('yellow', 5))
    cv.vline(32, 87, 105, col('wood', 1))
    # Wood panel below bakery window
    cv.siding_wall(10, 106, 55, 111, ramp='cedar', base_i=3, horizontal=False, step=3, seed=331)

    # Warm artisan wood bakery door (x=59..77, doorCol=4)
    cv.door_wood(59, 86, 77, 111, ramp='wood', glass_top=True)
    draw_rich_window(cv, 61, 88, 75, 98, mode='warm', frame='darkwood:1', sill=None, seed=332)
    cv.hline(58, 78, 110, col('stone', 6))

    # Right side: Clinic stairwell entrance + A-frame bread sign + potted shrub
    draw_stair_lobby(cv, 84, 86, 100, 111, door_frame='steel:2')
    draw_potted_shrub(cv, 101, 99, flower='white:6')
    draw_potted_shrub(cv, 2, 99, flower='yellow:5')

    finish_building_edges(cv, bx0, bx1, 5, 112)
    return cv, {
        'id': 'mf-bldg-kr_bakery_clinic',
        'name': '베이커리·치과 크림스투코 3층 상가',
        'pack': PACK, 'w': 7, 'h': 7, 'doorCol': 4,
        'lightAnchors': [[32, 95], [68, 93], [30, 35], [50, 60]],
        'tags': ['sangga', 'korean', 'bakery', 'clinic', 'stucco', 'commercial', '3f'],
    }


# ---------------------------------------------------------------------------
# Building 4: mf-bldg-kr_pcbang_billiard (96x128)
# ---------------------------------------------------------------------------
def build_kr_pcbang_billiard():
    cv = Canvas(96, 128)
    bx0, bx1 = 1, 87
    # Dark-slate/concrete entertainment sangga body
    cv.tile_cladding(bx0, 19, bx1, 128, ramp='steel', base_i=2, cw=5, ch=4, seed=401)
    # Dark concrete vertical corner bands
    cv.rect(bx0, 19, 5, 128, col('asphalt', 2))
    cv.rect(bx1 - 4, 19, bx1, 128, col('asphalt', 1))

    # Rooftop (y=2..19): dark concrete deck + array of 3 AC units + steel water tank
    draw_parapet_roof(cv, bx0, 2, bx1, 19, deck='concrete', para_ramp='steel', seed=402)
    draw_ac_box(cv, 7, 6, pipe_dir='right')
    draw_ac_box(cv, 21, 6, pipe_dir='right')
    draw_ac_box(cv, 35, 6, pipe_dir='right')
    draw_water_tank(cv, 68, 0, style='steel')
    draw_antenna(cv, 54, 1, h=10)

    # --- 4F: Dark Lounge (y=19..38) ---
    cv.shade_rect(bx0, 19, bx1, 21, -1)
    draw_rich_window(cv, 8, 23, 36, 35, mode='dark_lounge', frame='steel:0', sill='steel:4', seed=411)
    for lx in (13, 21, 29):
        cv.p(lx, 26, col('orange', 4))
        cv.p(lx, 32, col('pink', 4))
    draw_rich_window(cv, 41, 23, 61, 35, mode='dark_lounge', frame='steel:0', sill='steel:4', seed=412)
    cv.hline(45, 57, 32, col('orange', 3))
    cv.p(49, 26, col('yellow', 5))
    # Exhaust louver vent on 4F right
    cv.outline_box(66, 25, 79, 35, col('steel', 1), col('ink', 0))
    for vy in range(27, 34, 2):
        cv.hline(68, 77, vy, col('steel', 4))

    # --- 3F: PC Bang with 3 Visually Differentiated Windows + Crisp "PC방" Sign (y=38..68) ---
    draw_floor_ledge(cv, bx0, bx1, 38, ramp='steel')

    # Window 1 (left, x=7..29, y=42..54): Cool cyan gaming booth w/ top dark half-blinds & pink RGB glow
    cv.outline_box(7, 42, 29, 54, col('navy', 1), col('navy', 0))
    for y in range(43, 53):
        for x in range(8, 28):
            if y <= 45:
                cv.p(x, y, col('steel', 2 if y % 2 == 0 else 1))  # dark pulled half-blinds
            else:
                cv.p(x, y, col('glass', 2 if (x + y) % 3 else 3))
    # Two offset wide cyan gaming monitors + magenta RGB keyboard glow
    cv.rect(9, 47, 15, 50, col('glass', 6))
    cv.hline(10, 14, 48, col('white', 6))
    cv.hline(10, 14, 51, col('pink', 4))
    cv.rect(19, 48, 26, 51, col('teal', 5))
    cv.hline(20, 25, 49, col('glass', 6))
    cv.p(22, 52, col('pink', 4))
    cv.vline(17, 43, 53, col('navy', 0))
    cv.hline(6, 30, 54, col('steel', 4))
    cv.hline(7, 29, 55, col('ink', 1))

    # Window 2 (center, x=33..56, y=42..54): Cyber-cafe bay w/ vibrant vertical game poster & dual teal monitors
    cv.outline_box(33, 42, 56, 54, col('navy', 1), col('navy', 0))
    for y in range(43, 53):
        for x in range(34, 55):
            if y == 43:
                cv.p(x, y, col('teal', 4 if x > 43 else 2))  # ceiling LED strip
            else:
                cv.p(x, y, col('glass', 3 if (x + y) % 4 == 0 else 1))
    # Bright game poster silhouette stuck inside left pane (x=35..41, y=44..52)
    cv.outline_box(35, 44, 42, 52, col('orange', 4), col('navy', 0))
    cv.hline(36, 41, 45, col('red', 4))
    cv.hline(36, 41, 47, col('yellow', 5))
    cv.rect(37, 48, 40, 51, col('blue', 4))
    # Dual offset glowing monitors on right pane
    cv.rect(44, 48, 48, 51, col('glass', 6))
    cv.p(45, 49, col('white', 6))
    cv.rect(50, 46, 54, 50, col('teal', 5))
    cv.hline(51, 53, 47, col('white', 6))
    cv.vline(43, 43, 53, col('navy', 0))
    cv.hline(32, 57, 54, col('steel', 4))
    cv.hline(33, 56, 55, col('ink', 1))

    # Window 3 (right, x=60..80, y=42..54): VIP corner booth w/ warm amber screen & cream blinds on right
    cv.outline_box(60, 42, 80, 54, col('navy', 1), col('navy', 0))
    for y in range(43, 53):
        for x in range(61, 79):
            if x >= 70 and y <= 49:
                cv.p(x, y, col('cream', 4 if y % 2 == 0 else 3))  # drawn Venetian blinds on right half
            else:
                cv.p(x, y, col('navy', 2 if y < 48 else 1))
    # Warm amber/orange lit VIP gaming monitor on left half
    cv.rect(62, 47, 68, 51, col('orange', 4))
    cv.hline(63, 67, 48, col('yellow', 5))
    cv.p(65, 51, col('steel', 1))
    # Cool green/teal drink cooler glow tucked below blinds on right
    cv.rect(72, 50, 77, 53, col('teal', 4))
    cv.hline(73, 76, 51, col('glass', 6))
    cv.vline(70, 43, 53, col('navy', 0))
    cv.hline(59, 81, 54, col('steel', 4))
    cv.hline(60, 80, 55, col('ink', 1))

    # Crisp 3F PC Bang neon fascia: crisp 7px "PC방" (x=6..81, y=56..67)
    draw_crisp_sign_box(cv, 6, 56, 81, 67, col('navy', 1), col('teal', 4), hi_col=col('glass', 5))
    pc_txt = 'PC방'
    pw, _ = measure_bitmap_text(pc_txt, GLYPHS_7X7, gap=2)
    draw_bitmap_text(cv, 6 + (75 - pw) // 2, 58, pc_txt, col('white', 6), GLYPHS_7X7, gap=2)
    # Clean cyber-neon side accent lines
    cv.hline(11, 23, 61, col('teal', 4))
    cv.p(24, 61, col('pink', 4))
    cv.hline(64, 76, 61, col('teal', 4))
    cv.p(62, 61, col('pink', 4))

    # --- 2F: Billiard Hall with Glowing Green/Amber Windows & Crisp "당구" Sign (y=68..97) ---
    draw_floor_ledge(cv, bx0, bx1, 68, ramp='steel')
    draw_rich_window(cv, 7, 72, 46, 83, mode='neon_green', frame='darkwood:1', sill='steel:4', seed=431)
    draw_rich_window(cv, 50, 72, 68, 83, mode='blinds', frame='steel:1', sill='steel:4', seed=432)
    draw_wall_ac(cv, 71, 75)
    # Bold yellow billiard fascia sign: crisp 7x7 "당구" + billiard balls (x=6..81, y=85..96)
    draw_crisp_sign_box(cv, 6, 85, 81, 96, col('yellow', 4), col('navy', 0), hi_col=col('yellow', 5))
    bw, _ = measure_bitmap_text('당구', GLYPHS_7X7, gap=3)
    draw_bitmap_text(cv, 6 + (75 - bw) // 2, 87, '당구', col('navy', 0), GLYPHS_7X7, gap=3)
    # Crisp 5x5 red ball on left & 5x5 black 8-ball on right
    cv.rect(12, 89, 17, 92, col('red', 4))
    cv.rect(13, 88, 16, 93, col('red', 4))
    cv.p(13, 89, col('white', 6))
    cv.rect(70, 89, 75, 92, col('ink', 0))
    cv.rect(71, 88, 74, 93, col('ink', 0))
    cv.p(72, 90, col('white', 6))

    # --- 1F: Street Noodle Shop + Glass Stairwell Lobby (y=97..128) ---
    draw_floor_ledge(cv, bx0, bx1, 97, ramp='concrete')
    # Left: Warm street noodle shop with crisp 7x7 "국수" + steaming bowl fascia (x=5..53, y=99..110)
    draw_crisp_sign_box(cv, 5, 99, 53, 110, col('red', 0), col('red', 2), hi_col=col('orange', 4))
    draw_noodle_bowl_icon(cv, 10, 101)
    draw_bitmap_text(cv, 21, 101, '국수', col('yellow', 5), GLYPHS_7X7, gap=3)
    cv.awning(5, 110, 53, 114, ramp_a='orange', ramp_b='cream', stripe_w=3)
    # Glowing noodle counter window
    draw_rich_window(cv, 6, 114, 34, 124, mode='warm', frame='wood:1', sill='wood:3', seed=440)
    for nx in (11, 20, 28):
        cv.hline(nx, nx + 3, 121, col('white', 6))
        cv.p(nx + 1, 119, col('white', 5))  # steam!
    cv.siding_wall(6, 124, 34, 127, ramp='wood', base_i=3, horizontal=False, step=2, seed=441)
    # Compact noodle shop sliding door
    cv.door_wood(36, 114, 52, 127, ramp='wood', glass_top=True)

    # Right: Glass stairwell lobby (x=56..76, doorCol=4)
    draw_stair_lobby(cv, 56, 101, 76, 127, door_frame='steel:2')
    # Illuminated vending machine tucked on right corner (x=78..86)
    cv.outline_box(78, 107, 86, 127, col('white', 5), col('steel', 1), top_hi=col('white', 6))
    cv.rect(79, 109, 85, 117, col('glass', 5))
    cv.hline(80, 84, 111, col('red', 4))
    cv.hline(80, 84, 113, col('blue', 4))
    cv.hline(80, 84, 115, col('green', 4))
    cv.rect(80, 121, 84, 124, col('steel', 1))

    # Finish main building edges BEFORE drawing overhanging right vertical blade sign
    finish_building_edges(cv, bx0, bx1, 2, 128)

    # Vertical neon blade sign on right edge (x=85..96, y=38..91): stacked "PC" + 8-ball emblem!
    for by in (43, 84):
        cv.hline(83, 85, by, col('steel', 1))
        cv.hline(83, 85, by + 1, col('steel', 4))
    # Upper PC neon section (y=38..65)
    draw_crisp_sign_box(cv, 85, 38, 96, 65, col('navy', 1), col('teal', 4), hi_col=col('pink', 4), shadow=False)
    draw_bitmap_text(cv, 88, 42, 'PC', col('white', 6), GLYPHS_7X7, gap=3, vertical=True)
    # Lower Billiard 8-ball section (y=65..91)
    draw_crisp_sign_box(cv, 85, 65, 96, 91, col('yellow', 4), col('navy', 0), hi_col=col('yellow', 5))
    cv.hline(87, 94, 68, col('red', 4))
    draw_eight_ball_icon(cv, 87, 74)
    cv.hline(87, 94, 86, col('navy', 1))

    return cv, {
        'id': 'mf-bldg-kr_pcbang_billiard',
        'name': 'PC방·당구장·국수집 4층 유흥상가',
        'pack': PACK, 'w': 6, 'h': 8, 'doorCol': 4,
        'lightAnchors': [[44, 48], [26, 78], [90, 62], [20, 118], [66, 114]],
        'tags': ['sangga', 'korean', 'pcbang', 'billiard', 'neon', 'commercial', '4f'],
    }


# ---------------------------------------------------------------------------
# Building 5: mf-bldg-kr_corner_conv24 (96x96)
# ---------------------------------------------------------------------------
def build_kr_corner_conv24():
    cv = Canvas(96, 96)
    bx0, bx1 = 1, 95
    # 2F cozy red-brick apartment
    cv.brick_wall(bx0, 22, bx1, 52, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=501)

    # Green urethane waterproof flat roof (y=3..22)
    draw_parapet_roof(cv, bx0, 3, bx1, 22, deck='urethane', para_ramp='concrete', seed=502)
    draw_water_tank(cv, 7, 0, style='cream')
    # Rooftop hanging laundry rack (center-right)
    cv.vline(38, 5, 16, col('steel', 2))
    cv.vline(66, 5, 16, col('steel', 2))
    cv.hline(38, 67, 6, col('steel', 5))
    # Hanging colorful laundry items!
    clothes = [(41, 'white', 6), (47, 'blue', 4), (53, 'pink', 4), (59, 'yellow', 5)]
    for cx, cramp, ci in clothes:
        cv.rect(cx, 7, cx + 4, 13, col(cramp, ci))
        cv.hline(cx, cx + 4, 12, col(cramp, max(1, ci - 2)))
    draw_ac_box(cv, 76, 9, pipe_dir='left')

    # --- 2F: Cozy Brick Apartment with Hanging Laundry & AC (y=22..51) ---
    cv.shade_rect(bx0, 22, bx1, 24, -1)
    # Left recessed apartment balcony with laundry towel & flower box
    draw_rich_window(cv, 8, 27, 37, 42, mode='warm', frame='wood:1', sill=None, curtain='cream', seed=511)
    # Balcony railing across lower part
    cv.hline(6, 40, 38, col('steel', 5))
    cv.hline(6, 40, 39, col('steel', 1))
    for rx in range(7, 40, 4):
        cv.vline(rx, 39, 46, col('steel', 2))
    cv.hline(6, 40, 45, col('concrete', 5))
    cv.hline(6, 40, 46, col('concrete', 2))
    # Draped blanket/towel over left balcony rail
    cv.rect(11, 38, 20, 44, col('blue', 4))
    cv.hline(12, 19, 39, col('white', 6))
    cv.hline(12, 19, 41, col('blue', 5))
    # Potted flowers on balcony corner
    cv.planter_box(27, 40, 38, 45, flower='red:4', pot_ramp='brick')

    # Right apartment bedroom window (cool sky-glass + curtains for contrast against left warm balcony!) + wall AC + downspout
    draw_rich_window(cv, 49, 28, 70, 42, mode='glass', frame='steel:1', sill='concrete:5', curtain='cream', seed=512)
    draw_wall_ac(cv, 74, 34)
    draw_downspout(cv, 89, 22, 95)

    # --- 1F: Iconic 24h Convenience Store (y=50..96) ---
    # Wrap-around glowing white/orange/green fascia band!
    cv.rect(bx0, 49, bx1, 61, col('white', 6))
    cv.hline(bx0, bx1, 49, col('steel', 1))
    cv.hline(bx0, bx1, 50, col('white', 6))
    # Iconic bright orange & green accent stripes wrapping full width
    cv.hline(bx0 + 1, bx1 - 1, 51, col('orange', 4))
    cv.hline(bx0 + 1, bx1 - 1, 52, col('orange', 3))
    cv.hline(bx0 + 1, bx1 - 1, 58, col('green', 4))
    cv.hline(bx0 + 1, bx1 - 1, 59, col('green', 3))
    cv.hline(bx0, bx1, 60, col('steel', 1))
    cv.hline(bx0, bx1, 61, col('ink', 1))  # fascia shadow
    # Crisp glowing "24시" sign badge centered on fascia
    cv.outline_box(31, 51, 65, 60, col('white', 6), col('green', 2))
    draw_glyphs(cv, 37, 53, '24시', col('green', 1), spacing=7)
    cv.rect(8, 53, 25, 57, col('orange', 4))
    cv.hline(9, 24, 55, col('white', 6))
    cv.rect(71, 53, 88, 57, col('green', 4))
    cv.hline(72, 87, 55, col('white', 6))

    # Full-height bright storefront glass walls (y=62..95)
    cv.rect(bx0, 62, bx1, 95, col('coolwhite', 5))
    # Structural white/steel framing
    cv.outline_box(3, 62, 36, 93, col('yellow', 5), col('steel', 2))
    # Bright warm interior merchandise shelves (left bay)
    for y in range(63, 92):
        for x in range(4, 35):
            cv.p(x, y, col('cream', 6 if y < 68 else 5))
    # Ceiling fluorescent strip
    cv.hline(6, 33, 64, col('white', 6))
    # 4 colorful packed snack/ramen shelves
    shelf_cols = [col('red', 4), col('orange', 4), col('yellow', 4), col('green', 4), col('blue', 4), col('pink', 4)]
    for si, sy in enumerate((70, 76, 82, 88)):
        cv.hline(5, 34, sy, col('steel', 3))
        for gx in range(6, 33, 3):
            c = shelf_cols[(gx + si * 2) % len(shelf_cols)]
            cv.rect(gx, sy - 4, gx + 2, sy, c)
    # Subtle glass glare diagonal
    for d in range(6):
        cv.p(5 + d, 68 - d, col('glass', 6))
        cv.p(6 + d, 68 - d, col('white', 6))

    # Center automatic sliding glass doors (x=38..60, y=62..95, doorCol=3)
    cv.door_glass(38, 62, 60, 95, frame='steel:2', warm=True)
    # Sliding door sensor bar & green/orange horizontal safety stripe
    cv.rect(45, 62, 53, 64, col('asphalt', 1))
    cv.hline(39, 59, 78, col('orange', 4))
    cv.hline(39, 59, 79, col('green', 4))
    cv.rect(40, 93, 58, 95, col('pavement', 3))  # entry doormat

    # Right bay: illuminated drink coolers + outdoor ice-cream freezer! (x=62..93)
    cv.outline_box(62, 62, 93, 93, col('coolwhite', 5), col('steel', 2))
    cv.hline(64, 91, 64, col('white', 6))
    # Drink cooler racks
    for si, sy in enumerate((70, 76, 82)):
        cv.hline(63, 92, sy, col('steel', 3))
        for gx in range(64, 90, 3):
            c = shelf_cols[(gx + si * 3 + 2) % len(shelf_cols)]
            cv.rect(gx, sy - 4, gx + 2, sy, c)

    # Outdoor ice-cream chest freezer sitting right outside on sidewalk (x=64..82, y=82..95)
    cv.outline_box(64, 82, 82, 95, col('white', 6), col('steel', 1), top_hi=col('glass', 6))
    cv.rect(66, 83, 80, 86, col('glass', 5))  # sliding glass top lid
    cv.hline(66, 80, 87, col('blue', 4))      # ice-cream stripe
    cv.hline(66, 80, 89, col('pink', 4))
    cv.hline(65, 81, 93, col('steel', 3))
    # Sidewalk recycling bin beside freezer (x=84..91, y=85..95)
    cv.outline_box(84, 85, 91, 95, col('blue', 3), col('navy', 0), top_hi=col('blue', 5))
    cv.rect(86, 87, 89, 89, col('navy', 0))

    # Crisp sidewalk curb plinth
    cv.hline(bx0, bx1, 95, col('pavement', 3))

    finish_building_edges(cv, bx0, bx1, 3, 96)
    return cv, {
        'id': 'mf-bldg-kr_corner_conv24',
        'name': '24시 코너 편의점·적벽돌 2층 상가',
        'pack': PACK, 'w': 6, 'h': 6, 'doorCol': 3,
        'lightAnchors': [[20, 76], [49, 74], [77, 72], [22, 34]],
        'tags': ['sangga', 'korean', 'convenience', '24h', 'brick', 'corner', '2f'],
    }


# ---------------------------------------------------------------------------
# Building 6: mf-bldg-kr_rooftop_cafe (96x112)
# ---------------------------------------------------------------------------
def build_kr_rooftop_cafe():
    cv = Canvas(96, 112)
    bx0, bx1 = 1, 95
    # Renovated Seongsu/Hongdae red-brick body (y=29..112)
    cv.brick_wall(bx0, 29, bx1, 112, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=601)

    # --- 3F Rooftop Deck (y=2..29): brick back wall + horizontal receding wood deck + open baluster railing ---
    # Clear red-brick back parapet wall behind the rooftop furniture (y=6..13)
    cv.brick_wall(bx0, 7, bx1, 14, ramp='brick', base_i=3, course_h=2, brick_w=5, seed=602)
    # Stone coping cap along north parapet wall
    cv.hline(bx0, bx1, 6, col('stone', 1))
    cv.hline(bx0 + 1, bx1 - 1, 7, col('stone', 6))
    cv.hline(bx0 + 1, bx1 - 1, 8, col('stone', 4))
    # Side brick parapet return walls (x=1..5 and x=91..95)
    cv.brick_wall(bx0, 7, 5, 28, ramp='brick', base_i=3, course_h=3, brick_w=4, seed=603)
    cv.brick_wall(91, 7, bx1, 28, ramp='brick', base_i=2, course_h=3, brick_w=4, seed=604)
    cv.vline(bx0, 6, 28, col('stone', 1))
    cv.vline(bx0 + 1, 7, 27, col('stone', 5))
    cv.vline(bx1 - 1, 6, 28, col('stone', 0))
    cv.vline(bx1 - 2, 7, 27, col('stone', 3))

    # Distinct horizontal receding wooden floor deck (x=5..91, y=13..27)
    for y in range(13, 27):
        ry = y - 13
        for x in range(5, 91):
            if ry == 0:
                cv.p(x, y, col('floorwood', 1))  # crisp brick back-wall cast shadow
            elif ry == 1:
                cv.p(x, y, col('floorwood', 2))
            elif x == 5:
                cv.p(x, y, col('floorwood', 1))  # west side-wall cast shadow
            elif x == 6:
                cv.p(x, y, col('floorwood', 2))
            elif ry % 3 == 2:
                cv.p(x, y, col('floorwood', 3))  # plank horizontal seam
            else:
                r = hsh((x + (ry // 3) * 7) // 6, ry // 3, 605)
                cv.p(x, y, col('floorwood', 5 if (ry % 3 == 0 and r > 0.35) else 4))

    # String-light iron poles anchored against back brick wall
    for px in (7, 56, 89):
        cv.vline(px, 2, 14, col('asphalt', 0))
        cv.p(px, 14, col('floorwood', 1))
    # Festive catenary string lights with warm glowing bulbs
    for x in range(8, 89):
        span = abs((x - 31) / 24.0) if x < 56 else abs((x - 72) / 17.0)
        ly = int(6 - 3 * (span * span))
        cv.p(x, ly, col('steel', 1))
        if x % 6 == 0:
            cv.p(x, ly + 1, col('yellow', 5))
            cv.p(x, ly + 2, col('orange', 4))

    # Left rooftop parasol + bistro set WITH crisp dark cast shadow directly beneath on wood deck
    cv.rect(16, 20, 37, 22, col('floorwood', 1))
    cv.hline(17, 36, 21, col('darkwood', 0))
    cv.rect(16, 16, 20, 20, col('darkwood', 2))  # left chair
    cv.hline(16, 20, 16, col('cedar', 4))
    cv.rect(32, 16, 36, 20, col('darkwood', 2))  # right chair
    cv.hline(32, 36, 16, col('cedar', 4))
    cv.vline(26, 11, 21, col('wood', 1))         # parasol pole & pedestal
    cv.rect(21, 16, 31, 18, col('cream', 5))     # bistro table top
    cv.hline(21, 31, 18, col('wood', 2))
    cv.p(23, 16, col('white', 6))                # coffee cup
    # Striped cream & terracotta parasol canopy
    for ry in range(7):
        half = min(11, 3 + ry * 2)
        for dx in range(-half, half + 1):
            c = col('cream', 6 if ry < 4 else 4) if ((dx + 12) // 3) % 2 == 0 else col('brick', 5 if ry < 4 else 3)
            if ry == 6:
                c = shade_rgba(c, -2)
            cv.p(26 + dx, 4 + ry, c)
    cv.p(26, 3, col('wood', 2))

    # Center-right rooftop small coffee table WITH cast shadow directly beneath
    cv.rect(45, 20, 55, 22, col('floorwood', 1))
    cv.hline(46, 54, 21, col('darkwood', 0))
    cv.vline(47, 18, 21, col('asphalt', 0))
    cv.vline(52, 18, 21, col('asphalt', 0))
    cv.rect(45, 16, 55, 18, col('cream', 5))
    cv.hline(45, 55, 18, col('wood', 2))
    cv.p(47, 16, col('white', 6))
    cv.p(51, 16, col('orange', 4))

    # Right rooftop wood planters against back brick wall WITH cast shadows directly beneath
    cv.rect(61, 18, 74, 20, col('floorwood', 1))
    cv.rect(77, 18, 90, 20, col('floorwood', 1))
    cv.planter_box(60, 11, 73, 18, flower='yellow:5', pot_ramp='wood')
    cv.planter_box(76, 11, 89, 18, flower='white:6', pot_ramp='wood')
    cv.foliage_cluster(82, 10, 4, 3, 'foliage', seed=606)

    # Open vertical-baluster front railing on 3F rooftop (y=21..27) showing wood deck through gaps!
    cv.hline(4, 92, 21, col('cedar', 5))
    cv.hline(4, 92, 22, col('asphalt', 0))
    for rx in range(6, 91, 4):
        cv.vline(rx, 22, 27, col('asphalt', 0))
        cv.p(rx, 23, col('steel', 3))
    # Front stone rooftop slab fascia (y=27..29)
    cv.hline(bx0, bx1, 27, col('stone', 6))
    cv.hline(bx0, bx1, 28, col('stone', 4))
    cv.hline(bx0, bx1, 29, col('stone', 1))
    cv.shade_rect(bx0, 30, bx1, 32, -1)

    # --- 2F: Clear Brick Upper Back Wall + Horizontal Wood Terrace Deck + Open Baluster Railing (y=30..67) ---
    # Industrial dark-steel loft windows clearly set in red-brick back wall ABOVE terrace deck (y=32..47)
    draw_rich_window(cv, 12, 32, 41, 47, mode='warm', frame='asphalt:0', sill=None, seed=611)
    draw_rich_window(cv, 45, 32, 67, 47, mode='warm', frame='asphalt:0', sill=None, curtain='cream', seed=612)
    draw_rich_window(cv, 71, 32, 86, 47, mode='glass', frame='asphalt:0', sill=None, seed=613)

    # Distinct horizontal receding wooden terrace floor deck (x=5..91, y=48..64)
    cv.rect(4, 48, 6, 65, col('asphalt', 0))   # left railing end post
    cv.rect(90, 48, 92, 65, col('asphalt', 0)) # right railing end post
    for y in range(48, 64):
        ry = y - 48
        for x in range(6, 90):
            if ry == 0:
                cv.p(x, y, col('floorwood', 1))  # crisp brick-wall-to-deck cast shadow
            elif ry == 1:
                cv.p(x, y, col('floorwood', 2))
            elif x == 6:
                cv.p(x, y, col('floorwood', 2))
            elif ry % 3 == 2:
                cv.p(x, y, col('floorwood', 3))  # plank seam
            else:
                r = hsh((x + (ry // 3) * 5) // 6, ry // 3, 614)
                cv.p(x, y, col('floorwood', 5 if (ry % 3 == 0 and r > 0.35) else 4))

    # Two bistro tables + chairs on 2F terrace WITH crisp dark cast shadows directly beneath!
    for tx in (22, 53):
        cv.rect(tx - 4, 56, tx + 14, 58, col('floorwood', 1))
        cv.hline(tx - 2, tx + 12, 57, col('darkwood', 0))
        # Left & right cafe chairs
        cv.rect(tx - 4, 51, tx - 1, 56, col('darkwood', 2))
        cv.hline(tx - 4, tx - 1, 51, col('cedar', 4))
        cv.rect(tx + 11, 51, tx + 14, 56, col('darkwood', 2))
        cv.hline(tx + 11, tx + 14, 51, col('cedar', 4))
        # Bistro table + pedestal + coffee cups
        cv.vline(tx + 5, 54, 57, col('asphalt', 0))
        cv.rect(tx, 51, tx + 10, 54, col('cream', 5))
        cv.hline(tx, tx + 10, 54, col('wood', 2))
        cv.p(tx + 2, 51, col('white', 6))
        cv.p(tx + 7, 52, col('orange', 4))

    # Right terrace wooden planter WITH cast shadow directly beneath
    cv.rect(75, 56, 88, 58, col('floorwood', 1))
    cv.planter_box(74, 49, 87, 56, flower='pink:4', pot_ramp='wood')

    # Open vertical-baluster front railing on 2F terrace (y=57..64) showing wood floor through 3px gaps!
    cv.hline(4, 92, 57, col('cedar', 5))
    cv.hline(4, 92, 58, col('asphalt', 0))
    for rx in range(6, 91, 4):
        cv.vline(rx, 58, 64, col('asphalt', 0))
        cv.p(rx, 59, col('steel', 3))
    # Stone terrace deck slab edge (y=64..67)
    cv.hline(bx0, bx1, 64, col('stone', 6))
    cv.hline(bx0, bx1, 65, col('stone', 4))
    cv.hline(bx0, bx1, 66, col('stone', 1))
    cv.hline(bx0, bx1, 67, col('ink', 1))

    # --- Organic, Irregular Climbing Ivy on Left Brick Corner (hand-sculpted vine & varied leaf sprigs) ---
    # Winding woody vine stems
    vine_pts = [
        (3, 29), (4, 30), (4, 31), (5, 32), (5, 33), (4, 34), (4, 35), (5, 36), (6, 37),
        (5, 38), (4, 39), (3, 40), (3, 41), (4, 42), (5, 43), (6, 44), (7, 45), (8, 46),
        (8, 47), (7, 48), (6, 49), (6, 50), (7, 51), (8, 52), (9, 53), (8, 54), (7, 55),
        (6, 56), (5, 57), (5, 58), (6, 59), (6, 60), (5, 61), (4, 62), (4, 63), (3, 64),
        (4, 65), (5, 66), (5, 67), (4, 68), (4, 69), (3, 70), (3, 71), (4, 72), (3, 73),
        (3, 74), (2, 75), (2, 76),
    ]
    for vx, vy in vine_pts:
        cv.p(vx, vy, col('foliage', 1))
    # Irregular asymmetric leaf clumps & creeping mortar-joint tendrils (no repeated circles!)
    ivy_sprigs = [
        # (x0, y0, x1, y1, shade_hi, shade_mid, shade_lo)
        (2, 29, 7, 32, 5, 4, 2),
        (6, 30, 10, 32, 5, 3, 2),     # upper horizontal tendril creeping right
        (2, 33, 6, 36, 4, 3, 1),
        (5, 35, 9, 38, 6, 4, 2),
        (2, 39, 5, 42, 4, 3, 1),      # slender waist
        (3, 43, 10, 47, 5, 4, 2),     # wide organic drape reaching terrace corner
        (9, 45, 13, 48, 6, 4, 2),
        (4, 48, 11, 53, 5, 4, 2),     # lush asymmetric cascade over rail corner
        (9, 51, 13, 55, 5, 3, 1),
        (3, 54, 8, 58, 4, 3, 1),
        (6, 58, 10, 61, 5, 4, 2),     # right-reaching offshoot
        (2, 60, 6, 64, 4, 3, 1),
        (3, 65, 7, 68, 5, 3, 1),
        (2, 69, 5, 72, 4, 3, 1),      # tapering tail
        (2, 73, 4, 76, 3, 2, 1),
    ]
    for si, (ix0, iy0, ix1, iy1, hi, mid, lo) in enumerate(ivy_sprigs):
        for y in range(iy0, iy1):
            for x in range(ix0, ix1):
                # Carve irregular corners & notches so silhouette reads like real leaves
                n = hsh(x, y, 650 + si)
                if (x in (ix0, ix1 - 1) and y in (iy0, iy1 - 1) and n < 0.65):
                    continue
                if y == iy0 and x < (ix0 + ix1) // 2 + 1 and n > 0.35:
                    cv.p(x, y, col('foliage', hi))
                elif y == iy1 - 1 or x == ix1 - 1:
                    cv.p(x, y, col('foliage', lo))
                else:
                    cv.p(x, y, col('foliage', mid if n > 0.3 else lo))
    # Tiny crisp white ivy blossoms & trailing single-leaf tips
    for bx, by in ((7, 36), (10, 46), (8, 52)):
        cv.p(bx, by, col('white', 6))
    for lx, ly in ((10, 31), (13, 47), (12, 55), (10, 59), (5, 72), (2, 77)):
        cv.p(lx, ly, col('foliage', 4))

    # --- 1F: Industrial Dark-Steel Tall Arched/Framed Glass Bay + Wood Entrance (y=67..112) ---
    # Tall dark-steel industrial grid glass bay (x=7..55, y=70..109)
    cv.outline_box(7, 70, 55, 109, col('orange', 4), col('asphalt', 0))
    for dx in range(4):
        for dy in range(4 - dx):
            cv.p(8 + dx, 71 + dy, col('brick', 2))
            cv.p(53 - dx, 71 + dy, col('brick', 2))
    # Warm golden industrial cafe interior
    for y in range(71, 108):
        for x in range(8, 54):
            if (x - 8 + y - 71) < 4 or (53 - x + y - 71) < 4:
                continue
            if y < 77:
                cv.p(x, y, col('orange', 2))
            elif y < 94:
                cv.p(x, y, col('orange', 4 if y < 83 else 5) if (x + y) % 5 else col('yellow', 5))
            else:
                cv.p(x, y, col('wood', 3 if y > 98 else 4))
    # Back-wall wooden coffee bean & book shelves inside loft cafe
    for sy in (84, 89):
        cv.hline(10, 52, sy, col('wood', 2))
        for bx in range(11, 50, 4):
            cv.rect(bx, sy - 3, bx + 2, sy, col('cedar', 3) if bx % 8 == 3 else col('brick', 3))
    # Foreground dark-wood espresso bar counter + gleaming espresso machine + warm cups
    cv.rect(9, 96, 53, 107, col('darkwood', 3))
    cv.hline(9, 53, 96, col('cedar', 5))
    cv.rect(12, 91, 21, 96, col('steel', 4))
    cv.rect(13, 92, 20, 95, col('steel', 2))
    cv.p(15, 93, col('red', 4))
    cv.rect(26, 92, 36, 96, col('glass', 5))
    cv.hline(27, 35, 94, col('orange', 4))
    cv.rect(42, 93, 45, 96, col('white', 6))
    cv.rect(47, 93, 50, 96, col('cream', 5))
    # Hanging industrial Edison pendant lights inside
    for lx in (16, 31, 45):
        cv.vline(lx, 71, 77, col('asphalt', 0))
        cv.rect(lx - 1, 77, lx + 2, 79, col('yellow', 5))
        cv.p(lx, 78, col('white', 6))
    # Crisp diagonal glass glare across industrial panes
    for d in range(8):
        cv.p(10 + d, 90 - d, col('white', 6))
        cv.p(41 + d, 88 - d, col('cream', 6))
    # Industrial steel grid mullions
    for gx in (23, 39):
        cv.vline(gx, 71, 108, col('asphalt', 0))
    for gy in (82, 95):
        cv.hline(8, 54, gy, col('asphalt', 0))
    # Low brick sill below window
    cv.rect(7, 107, 55, 111, col('brick', 2))
    cv.hline(7, 55, 107, col('stone', 5))

    # Crisp minimal black/gold 1F signboard above door: crisp 5px Latin "CAFE" (x=58..89, y=69..78)
    draw_crisp_sign_box(cv, 58, 69, 89, 78, col('asphalt', 0), col('cedar', 4), hi_col=col('cedar', 5))
    cw, _ = measure_bitmap_text('CAFE', GLYPHS_LATIN_5, gap=2)
    draw_bitmap_text(cv, 58 + (31 - cw) // 2, 71, 'CAFE', col('cream', 6), GLYPHS_LATIN_5, gap=2)

    # Heavy warm cedar-wood entrance door (x=59..78, y=80..111, doorCol=4)
    cv.door_wood(59, 80, 78, 111, ramp='cedar', glass_top=True)
    draw_rich_window(cv, 62, 82, 75, 98, mode='warm', frame='asphalt:0', sill=None, seed=635)
    cv.hline(58, 79, 110, col('stone', 5))

    # Sidewalk chalkboard easel + lush potted plant on right (x=80..93)
    draw_a_frame_menu(cv, 81, 99)
    draw_potted_shrub(cv, 85, 86, flower='white:6')
    cv.rect(81, 82, 84, 85, col('yellow', 5))
    cv.hline(80, 85, 81, col('asphalt', 0))

    finish_building_edges(cv, bx0, bx1, 6, 112)
    return cv, {
        'id': 'mf-bldg-kr_rooftop_cafe',
        'name': '성수 적벽돌 루프탑 테라스 카페',
        'pack': PACK, 'w': 6, 'h': 7, 'doorCol': 4,
        'lightAnchors': [[31, 84], [68, 90], [31, 38], [32, 8], [72, 8]],
        'tags': ['sangga', 'korean', 'cafe', 'rooftop', 'brick', 'terrace', '2f'],
    }


# ---------------------------------------------------------------------------
# Building 7: mf-bldg-kr_narrow_alley_shop (64x96)
# ---------------------------------------------------------------------------
def build_kr_narrow_alley_shop():
    cv = Canvas(64, 96)
    bx0, bx1 = 1, 56  # Right margin x=53..64 for crisp 11px vertical blade sign

    # 2F vintage cream/stone square ceramic tile wall (y=22..96)
    cv.tile_cladding(bx0, 22, bx1, 96, ramp='cream', base_i=4, cw=4, ch=4, seed=701)

    # --- Clearly Shaded Pitched Dark-Metal / Slate Tile Roof (x=0..57, y=4..22) ---
    rx0, rx1 = bx0 - 1, bx1 + 1  # 1px overhanging eave on left & right
    rw = rx1 - rx0
    for y in range(4, 22):
        ry = y - 4
        for x in range(rx0, rx1):
            rx = x - rx0
            if ry == 0:
                # Top ridge outline
                cv.p(x, y, col('kuro', 0 if rx in (0, rw - 1) else 1))
            elif ry == 1:
                # Bright sunlit ridge cap with 4px ridge-tile joints
                cv.p(x, y, col('kuro', 4 if rx % 4 == 3 else (7 if rx < rw - 6 else 6)))
            elif ry == 2:
                # Ridge cap shadow bevel
                cv.p(x, y, col('kuro', 2 if rx % 4 != 1 else 3))
            elif ry == 17:
                # Dark overhanging eave underside
                cv.p(x, y, col('kuro', 0))
            elif ry == 16:
                # Scalloped lower eave drip tips
                cv.p(x, y, col('kuro', 1 if rx % 4 in (0, 3) else 2))
            else:
                # Staggered horizontal overlapping slate/metal tile courses with clear downward slope gradient!
                course = (ry - 3) // 3
                cy = (ry - 3) % 3
                shift = 2 if (course % 2 == 1) else 0
                tx = (rx + shift) % 4
                ti = (rx + shift) // 4
                r = hsh(ti, course, 702)
                right_sh = 1 if rx >= rw - 4 else 0
                # Downward slope shading: sunlit upper courses -> darker lower slope toward eave
                slope_base = 5 if ry < 8 else (4 if ry < 12 else 3)
                if cy == 2:
                    # Horizontal overlapping shingle course shadow line
                    cv.p(x, y, col('kuro', max(1, slope_base - 2 - right_sh)))
                elif tx == 3:
                    # Subtle vertical tile butt joint
                    cv.p(x, y, col('kuro', max(1, slope_base - 1 - right_sh)))
                elif r > 0.93 and ry >= 10:
                    cv.p(x, y, col('moss', 2 if cy == 1 else 3))
                else:
                    t = slope_base + (1 if (cy == 0 and tx == 0 and ry < 12) else 0)
                    if r > 0.78:
                        t += 1
                    elif r < 0.22:
                        t -= 1
                    cv.p(x, y, col('kuro', max(1, min(6, t - right_sh))))

    # Tall galvanized exhaust chimney pipe poking up on left (x=9..13, y=0..15) + roof cast shadow
    for sy in range(5, 16):
        cv.p(13, sy, col('kuro', 1))
        cv.p(14, sy, col('kuro', 2))
    cv.rect(9, 2, 13, 15, col('steel', 4))
    cv.vline(9, 2, 15, col('steel', 1))
    cv.vline(10, 2, 15, col('coolwhite', 5))
    cv.vline(12, 2, 15, col('steel', 2))
    cv.hline(7, 15, 1, col('steel', 5))  # chimney rain cap
    cv.hline(8, 14, 0, col('steel', 1))
    cv.hline(9, 15, 15, col('kuro', 0))

    # --- 2.5F Compact Attic/Mezzanine Strip (y=22..33) with heavy shadowed eave overhang ---
    cv.siding_wall(bx0, 22, bx1, 33, ramp='steel', base_i=3, horizontal=True, step=3, seed=703)
    cv.shade_rect(bx0, 22, bx1, 24, -2)  # strong eave overhang cast shadow!
    cv.shade_rect(bx0, 24, bx1, 25, -1)
    draw_rich_window(cv, 20, 24, 34, 31, mode='warm', frame='steel:0', sill='steel:5', seed=704)
    cv.outline_box(40, 25, 48, 31, col('coolwhite', 4), col('steel', 1))

    # --- 2F: Tiled Wall with Single Asymmetric Balcony & AC Unit (y=33..58) ---
    draw_floor_ledge(cv, bx0, bx1, 33, ramp='concrete')
    draw_rich_window(cv, 8, 37, 32, 51, mode='warm', frame='wood:1', sill=None, curtain='orange', seed=710)
    # Balcony floor & dark iron railing
    cv.hline(5, 36, 47, col('steel', 4))
    cv.hline(5, 36, 48, col('steel', 1))
    for rx in range(6, 36, 4):
        cv.vline(rx, 48, 54, col('steel', 2))
    cv.rect(5, 54, 36, 57, col('concrete', 4))
    cv.hline(5, 36, 54, col('concrete', 6))
    cv.hline(5, 36, 57, col('ink', 1))
    cv.planter_box(8, 49, 20, 54, flower='red:4', pot_ramp='brick')
    draw_wall_ac(cv, 39, 43)
    draw_downspout(cv, 2, 33, 95)

    # --- 1F: Warm Tteokbokki / Snack Bar (y=58..96) ---
    # High-contrast dark-backed 1F fascia signboard: steaming bowl icon + crisp 7x7 "분식" (x=3..53, y=58..69)
    draw_crisp_sign_box(cv, 3, 58, 53, 69, col('red', 0), col('orange', 4), hi_col=col('yellow', 5))
    draw_noodle_bowl_icon(cv, 10, 60)
    draw_bitmap_text(cv, 21, 60, '분식', col('yellow', 5), GLYPHS_7X7, gap=3)

    # Orange vinyl awning / street curtain (y=69..76)
    cv.awning(4, 69, 52, 76, ramp_a='orange', ramp_b='yellow', stripe_w=4)

    # Glowing snack counter window (x=5..35, y=77..89)
    cv.outline_box(5, 77, 35, 89, col('yellow', 5), col('wood', 1))
    for y in range(78, 88):
        for x in range(6, 34):
            cv.p(x, y, col('yellow', 5 if y < 84 else 4))
    # Bright red tteokbokki steel pan + yellow eomuk fishcake pot + steam wisps
    cv.outline_box(7, 83, 20, 89, col('red', 4), col('steel', 1))
    cv.hline(8, 19, 85, col('orange', 4))
    cv.hline(9, 18, 86, col('red', 3))
    cv.outline_box(22, 83, 33, 89, col('steel', 4), col('steel', 1))
    cv.hline(23, 32, 84, col('yellow', 5))
    for sk in (24, 27, 30):
        cv.vline(sk, 82, 85, col('cedar', 5))
    # Translucent orange vinyl strip curtain draped along left counter edge
    for vy in range(77, 88):
        cv.p(6, vy, col('orange', 4 if vy % 2 == 0 else 3))
        cv.p(7, vy, col('orange', 3 if vy % 3 else 5))
    for sx in (12, 16, 26, 29):
        cv.p(sx, 81, col('white', 6))
        cv.p(sx + 1, 79, col('cream', 6))
    cv.vline(20, 78, 80, col('darkwood', 0))
    cv.p(20, 80, col('white', 6))
    # Counter ledge + grounded apron + 2 red plastic stools all the way to y=96
    cv.rect(5, 89, 36, 96, col('wood', 3))
    cv.hline(4, 36, 89, col('cedar', 5))
    cv.hline(4, 36, 95, col('wood', 1))
    for sx in (10, 24):
        cv.rect(sx, 91, sx + 5, 93, col('red', 4))
        cv.vline(sx, 93, 96, col('red', 2))
        cv.vline(sx + 4, 93, 96, col('red', 2))

    # Grounded 1F right double door extending ALL THE WAY DOWN to y=95 (zero cream wall gap!)
    # Outer darkwood double-door frame (x=37..53, y=77..94)
    cv.outline_box(37, 77, 53, 95, col('wood', 2), col('darkwood', 0))
    # Left & right warm backlit glass panes (y=78..88)
    for px0, px1 in ((38, 44), (46, 52)):
        for y in range(78, 89):
            for x in range(px0, px1):
                if y == 78:
                    cv.p(x, y, col('orange', 2))
                elif y < 84:
                    cv.p(x, y, col('yellow', 5 if (x + y) % 3 else 4))
                else:
                    cv.p(x, y, col('orange', 4))
        # Subtle glass reflection diagonal
        cv.p(px0 + 1, 80, col('white', 6))
        cv.p(px0 + 2, 79, col('cream', 6))
        # Solid wood lower kick panels (y=89..93)
        cv.outline_box(px0, 89, px1, 94, col('wood', 3), col('wood', 1), top_hi=col('cedar', 4))
    # Center vertical double-door stile + brass handles
    cv.vline(44, 77, 94, col('darkwood', 0))
    cv.vline(45, 77, 94, col('wood', 1))
    cv.p(43, 86, col('yellow', 5))
    cv.p(46, 86, col('yellow', 5))
    # Crisp stone threshold step reaching cleanly to street baseline y=95 (x=36..54)
    cv.hline(36, 54, 94, col('stone', 4))
    cv.hline(36, 54, 95, col('stone', 2))
    # Dark stone sidewalk plinth along far-left & far-right corners of baseline
    cv.hline(bx0, 5, 95, col('stone', 2))
    cv.hline(53, bx1, 95, col('stone', 2))

    # Finish main building edges BEFORE overhanging right vertical blade sign
    finish_building_edges(cv, bx0, bx1, 22, 96)

    # High-contrast dark-backed vertical red blade sign on right edge (x=53..64, y=34..69): crisp 7x7 "분식"
    for by in (39, 62):
        cv.hline(51, 53, by, col('steel', 1))
        cv.hline(51, 53, by + 1, col('steel', 4))
    draw_crisp_sign_box(cv, 53, 34, 64, 69, col('red', 0), col('red', 3), hi_col=col('orange', 4))
    draw_bitmap_text(cv, 55, 38, '분식', col('yellow', 5), GLYPHS_7X7, gap=4, vertical=True)
    # Warm red-gold bowl accent at bottom of blade sign
    cv.hline(55, 62, 60, col('orange', 4))
    cv.hline(56, 61, 63, col('yellow', 5))
    cv.hline(55, 62, 64, col('red', 3))

    return cv, {
        'id': 'mf-bldg-kr_narrow_alley_shop',
        'name': '골목 분식집 슬레이트 2.5층 협소상가',
        'pack': PACK, 'w': 4, 'h': 6, 'doorCol': 2,
        'lightAnchors': [[20, 82], [44, 84], [58, 50], [20, 44]],
        'tags': ['sangga', 'korean', 'alley', 'snack', 'tteokbokki', 'compact', '2f'],
    }


# ---------------------------------------------------------------------------
# Building 8: mf-bldg-kr_glass_salon (80x112)
# ---------------------------------------------------------------------------
def build_kr_glass_salon():
    cv = Canvas(80, 112)
    bx0, bx1 = 1, 79
    # Smooth minimalist white architectural concrete body
    cv.stipple_rect(bx0, 22, bx1, 112, 'white', 5, 4, 6, seed=801, rate=0.14)
    # Subtle architectural concrete panel seams
    for gy in (34, 46, 62, 74):
        cv.hline(bx0 + 1, bx1 - 1, gy, col('white', 3))

    # --- Roof (y=4..22): Minimalist concrete parapet + 2 sculptural potted olive trees ---
    draw_parapet_roof(cv, bx0, 5, bx1, 22, deck='concrete', para_ramp='white', seed=802)
    # Sleek glass skylight strip on roof center
    cv.outline_box(28, 10, 52, 16, col('glass', 5), col('steel', 2), top_hi=col('glass', 6))
    cv.vline(36, 11, 15, col('steel', 3))
    cv.vline(44, 11, 15, col('steel', 3))
    # Two sculptural olive trees in white architectural pots poking above parapet to y=0!
    for ox in (14, 64):
        cv.outline_box(ox - 4, 11, ox + 5, 17, col('white', 5), col('concrete', 2), top_hi=col('white', 6))
        cv.vline(ox, 7, 11, col('wood', 2))
        cv.foliage_cluster(ox, 5, 5, 4, 'midori', seed=805 + ox)
        cv.foliage_cluster(ox - 1, 4, 3, 2, 'foliage', seed=815 + ox)

    # --- 3F: Recessed Minimalist Studio Glass + Vertical Timber Fins (y=22..48) ---
    cv.shade_rect(bx0, 22, bx1, 24, -1)
    # Vertical cedar timber louver fins on left accent bay (x=5..17)
    for fx in range(5, 17, 3):
        cv.vline(fx, 25, 46, col('cedar', 4))
        cv.vline(fx + 1, 25, 46, col('wood', 2))
    # Recessed studio glass window (x=21..74, y=26..45)
    draw_rich_window(cv, 21, 26, 74, 45, mode='glass', frame='steel:2', sill='white:6', seed=810)
    # Warm studio ceiling ring-light glow visible through glass
    cv.hline(34, 46, 29, col('yellow', 5))
    cv.hline(56, 66, 29, col('yellow', 5))
    cv.rect(28, 38, 35, 43, col('cream', 5))  # minimalist studio sofa silhouette

    # --- 2F: Curved/Cantilevered Planter Balcony (y=48..76) ---
    draw_floor_ledge(cv, bx0, bx1, 48, ramp='white')
    # Tall timber-framed glass sliding doors behind balcony (x=8..72, y=51..67)
    draw_rich_window(cv, 8, 51, 40, 66, mode='warm', frame='cedar:2', sill=None, curtain='white', seed=820)
    draw_rich_window(cv, 42, 51, 72, 66, mode='blinds_warm', frame='cedar:2', sill=None, seed=821)
    # Cantilevered sculpted/curved white-concrete planter balcony projecting forward (y=62..74)
    cv.rect(4, 64, 76, 73, col('white', 5))
    cv.hline(5, 75, 63, col('white', 6))
    cv.hline(4, 76, 64, col('white', 6))
    cv.hline(5, 75, 72, col('white', 3))
    cv.hline(6, 74, 73, col('concrete', 2))
    cv.hline(7, 73, 74, col('ink', 1))  # curved chamfered bottom shadow
    # Curved beveled ends
    cv.p(4, 72, col('concrete', 3))
    cv.p(75, 72, col('concrete', 2))
    # Lush continuous greenery & white blossoms spilling out of cantilevered planter!
    for gx in range(8, 72, 7):
        cv.foliage_cluster(gx + 2, 62, 4, 2, 'foliage', seed=830 + gx, blossom='white:6')
    # Sleek minimal boutique sign plaque on right side
    draw_sign_fascia(cv, 44, 66, 72, 72, bg_ramp='darkwood', bg_i=2, text='미용실', text_col='cream:6', shadow=False)

    # --- 1F: Recessed Double-Height-Feel Timber & Glass Showcase (y=75..112) ---
    # Warm vertical cedar-timber architectural surround
    cv.siding_wall(bx0, 75, bx1, 112, ramp='cedar', base_i=4, horizontal=False, step=3, seed=840)
    # Recessed spotlighted showcase window (x=6..51, y=78..109)
    cv.outline_box(6, 78, 51, 109, col('cream', 5), col('darkwood', 1))
    # Warm interior gradient + 3 bright ceiling spotlight cones!
    for y in range(79, 108):
        for x in range(7, 50):
            dist = min(abs(x - 16), abs(x - 29), abs(x - 41))
            if y < 82:
                cv.p(x, y, col('wood', 2))
            elif dist <= (y - 78) // 5 + 2:
                cv.p(x, y, col('yellow', 5 if y < 94 else 4))
            else:
                cv.p(x, y, col('cream', 4 if y < 96 else 3))
    # Spotlight fixtures
    for lx in (16, 29, 41):
        cv.rect(lx - 1, 79, lx + 2, 81, col('white', 6))
    # Stylish tall arched salon mirror & stylist chair silhouette inside!
    cv.outline_box(12, 86, 21, 102, col('glass', 5), col('cedar', 3), top_hi=col('white', 6))
    cv.outline_box(25, 86, 34, 102, col('glass', 5), col('cedar', 3), top_hi=col('white', 6))
    cv.rect(14, 101, 19, 107, col('darkwood', 2))
    cv.rect(27, 101, 32, 107, col('darkwood', 2))
    # Boutique display pedestal on right of window
    cv.rect(39, 98, 45, 107, col('white', 6))
    cv.p(41, 96, col('pink', 4))
    cv.p(42, 97, col('pink', 4))

    # Tall frameless glass salon entrance door (x=54..71, y=79..111, doorCol=3)
    cv.door_glass(54, 79, 71, 111, frame='steel:2', warm=True)
    cv.vline(62, 88, 99, col('cedar', 5))  # tall warm oak pull handle
    cv.hline(53, 72, 110, col('white', 6))

    # Tall ceramic architectural plant pot on far right
    draw_potted_shrub(cv, 72, 99, flower='white:6')

    finish_building_edges(cv, bx0, bx1, 5, 112)
    return cv, {
        'id': 'mf-bldg-kr_glass_salon',
        'name': '모던 콘크리트·우드 헤어살롱 3층 상가',
        'pack': PACK, 'w': 5, 'h': 7, 'doorCol': 3,
        'lightAnchors': [[28, 92], [62, 94], [24, 58], [46, 35]],
        'tags': ['sangga', 'korean', 'salon', 'boutique', 'modern', 'glass', '3f'],
    }


# ---------------------------------------------------------------------------
# Building 9: mf-bldg-kr_market_arcade (128x96)
# ---------------------------------------------------------------------------
def build_kr_market_arcade():
    cv = Canvas(128, 96)
    bx0, bx1 = 1, 127
    # Warm stone/cream tiled upper facade
    cv.tile_cladding(bx0, 26, bx1, 96, ramp='cream', base_i=4, cw=5, ch=4, seed=901)

    # --- Deepened Recessed Top-3/4 Flat Roof Deck (y=3..26) behind Trimmer Rooftop Signboard ---
    draw_parapet_roof(cv, bx0, 3, bx1, 26, deck='concrete', para_ramp='stone', seed=902)
    # Crisp, deep north & left parapet cast shadows across the recessed roof slab
    cv.hline(bx0 + 2, bx1 - 2, 6, col('pavement', 1))
    cv.hline(bx0 + 2, bx1 - 2, 7, col('pavement', 2))
    cv.hline(bx0 + 2, bx1 - 2, 8, col('pavement', 3))
    cv.vline(bx0 + 2, 6, 22, col('pavement', 1))
    cv.vline(bx0 + 3, 6, 22, col('pavement', 2))
    cv.vline(bx0 + 4, 7, 22, col('pavement', 3))
    # Rooftop props sitting cleanly inside the deep recessed deck
    draw_ac_box(cv, 9, 10, pipe_dir='right')
    # Twin low ventilation skylights visible on recessed deck behind signboard
    for vx in (45, 73):
        cv.outline_box(vx, 8, vx + 10, 13, col('steel', 4), col('steel', 1), top_hi=col('steel', 6))
        cv.hline(vx + 2, vx + 8, 10, col('steel', 2))
        cv.hline(vx + 1, vx + 11, 13, col('pavement', 2))
    draw_water_tank(cv, 110, 2, style='cream')
    # Rear steel support struts anchoring trimmer signboard to deck
    for sx in (38, 64, 90):
        cv.vline(sx, 13, 16, col('steel', 1))
        cv.vline(sx + 1, 13, 16, col('steel', 4))
    # Trimmer Front-Parapet Rooftop Signboard: crisp 7x7 "시장" (x=32..96, y=15..26, leaves 9px deck visible behind!)
    draw_crisp_sign_box(cv, 32, 15, 96, 26, col('navy', 1), col('navy', 0), hi_col=col('yellow', 5))
    # Traditional red-and-gold end accent caps
    cv.rect(33, 16, 38, 25, col('red', 3))
    cv.vline(38, 16, 25, col('yellow', 5))
    cv.rect(90, 16, 95, 25, col('red', 3))
    cv.vline(89, 16, 25, col('yellow', 5))
    # Crisp 7x7 "시장" centered with clean 1px top/bottom margins + gold diamond accents
    mw, _ = measure_bitmap_text('시장', GLYPHS_7X7, gap=4)
    draw_bitmap_text(cv, 32 + (64 - mw) // 2, 17, '시장', col('yellow', 5), GLYPHS_7X7, gap=4)
    for dx in (45, 82):
        cv.p(dx, 19, col('orange', 4))
        cv.p(dx - 1, 20, col('yellow', 5))
        cv.p(dx, 20, col('white', 6))
        cv.p(dx + 1, 20, col('yellow', 5))
        cv.p(dx, 21, col('orange', 4))

    # --- 2F: Varied Shuttered / Curtained Upper Facade (y=26..49) ---
    cv.shade_rect(bx0, 26, bx1, 28, -1)
    # 4 genuinely distinct windows across 128px!
    draw_rich_window(cv, 8, 30, 28, 43, mode='warm', frame='wood:1', sill='stone:5', flower='red:4', seed=911)
    cv.rect(5, 30, 8, 43, col('wood', 3))
    cv.rect(28, 30, 31, 43, col('wood', 3))
    draw_rich_window(cv, 36, 30, 59, 43, mode='blinds', frame='steel:1', sill='stone:5', poster_cols=[col('yellow', 5)], seed=912)
    draw_rich_window(cv, 68, 30, 88, 43, mode='warm', frame='steel:1', sill='stone:5', curtain='pink', seed=913)
    draw_wall_ac(cv, 90, 35)
    draw_rich_window(cv, 103, 30, 121, 43, mode='shuttered', frame='wood:0', sill='stone:5', flower='yellow:5', seed=914)

    # --- 1F: Central Wide Open Arched Arcade Entrance Flanked by Colorful Stalls (y=49..96) ---
    draw_floor_ledge(cv, bx0, bx1, 48, ramp='stone')

    # Central stone arch framing pillars (x=42..86, y=51..96, doorCol=4)
    cv.tile_cladding(42, 51, 86, 96, ramp='stone', base_i=5, cw=4, ch=4, seed=920)
    # Crisp 1F Green Overhead Arcade Banner: crisp 5px Latin "MARKET" (x=44..84, y=51..60)
    draw_crisp_sign_box(cv, 44, 51, 84, 60, col('green', 1), col('green', 0), hi_col=col('green', 3))
    mkw, _ = measure_bitmap_text('MARKET', GLYPHS_LATIN_5, gap=1)
    draw_bitmap_text(cv, 44 + (40 - mkw) // 2, 53, 'MARKET', col('yellow', 5), GLYPHS_LATIN_5, gap=1)

    # OPEN Arched Arcade Interior ALL THE WAY DOWN to street baseline y=95 (x=46..82, y=60..96)
    # Dark shadowed receding arcade ceiling vault & depth background
    cv.rect(46, 60, 82, 96, col('ink', 0))
    cv.rect(47, 63, 81, 96, col('darkwood', 0))
    cv.rect(50, 67, 78, 92, col('darkwood', 1))
    # Deep distant warmly lit corridor heart (x=56..72, y=71..84)
    cv.rect(56, 71, 72, 84, col('wood', 2))
    cv.rect(58, 73, 70, 83, col('orange', 2))
    cv.rect(60, 75, 68, 82, col('orange', 3))
    # Tiny distant lit market shop fronts inside vanishing arcade heart
    cv.rect(61, 77, 64, 81, col('yellow', 4))
    cv.rect(65, 76, 68, 81, col('yellow', 5))
    cv.hline(58, 70, 74, col('red', 3))  # distant inner banner
    # Perspective-receding left & right interior market stalls (foreground -> midground)
    # Foreground left stall (x=46..51, y=70..91) & right stall (x=77..82, y=70..91)
    cv.rect(46, 70, 51, 90, col('darkwood', 2))
    cv.hline(46, 51, 71, col('red', 3))
    cv.rect(47, 77, 50, 81, col('orange', 4))
    cv.rect(47, 83, 50, 87, col('green', 3))
    cv.rect(77, 70, 82, 90, col('darkwood', 2))
    cv.hline(77, 82, 71, col('orange', 3))
    cv.rect(78, 77, 81, 81, col('yellow', 4))
    cv.rect(78, 83, 81, 87, col('red', 3))
    # Midground left stall (x=51..56, y=72..87) & right stall (x=72..77, y=72..87)
    cv.rect(51, 72, 56, 86, col('wood', 2))
    cv.hline(51, 56, 73, col('green', 3))
    cv.rect(52, 78, 55, 83, col('yellow', 4))
    cv.rect(72, 72, 77, 86, col('wood', 2))
    cv.hline(72, 77, 73, col('red', 3))
    cv.rect(73, 78, 76, 83, col('orange', 4))

    # Receding dark-warm stone walkway floor widening smoothly from vanishing corridor (y=83) ALL THE WAY to y=95!
    for y in range(83, 96):
        t = (y - 83) / 12.0
        wx0 = int(round(56 - 10 * t))
        wx1 = int(round(72 + 10 * t))
        for x in range(wx0, wx1):
            center_dist = abs(x - 64) / max(1.0, (wx1 - wx0) * 0.5)
            # Subtle warm lantern light pool down the center of the shadowed stone walkway
            if y % 3 == 0 and (x + y) % 5 == 0:
                cv.p(x, y, col('pavement', 1))
            elif center_dist < 0.45:
                cv.p(x, y, col('stone', 3 if y < 88 else 4) if (x + y) % 4 != 0 else col('pavement', 3))
            elif center_dist < 0.78:
                cv.p(x, y, col('pavement', 2 if y % 2 == 0 else 3))
            else:
                cv.p(x, y, col('asphalt', 2))  # deep edge shadow beside interior stalls
        # Crisp perspective floor-wall boundary line
        cv.p(wx0, y, col('ink', 0))
        cv.p(wx1 - 1, y, col('ink', 0))

    # Hanging colorful market lanterns along dark arcade vault ceiling (foreground + distant)
    for lx, lcol in ((51, 'red:4'), (59, 'yellow:5'), (69, 'orange:4'), (77, 'red:4')):
        cv.vline(lx, 61, 65, col('steel', 1))
        cv.rect(lx - 1, 65, lx + 2, 69, lcol)
        cv.p(lx, 67, col('white', 6))
    for lx, lcol in ((59, 'orange:4'), (69, 'yellow:5')):
        cv.vline(lx, 70, 72, col('steel', 1))
        cv.rect(lx - 1, 72, lx + 1, 74, lcol)

    # Rounded stone arch spandrels & crisp inner pillar bevels
    for dx in range(5):
        for dy in range(5 - dx):
            cv.p(46 + dx, 60 + dy, col('stone', 4 if dx + dy < 4 else 2))
            cv.p(81 - dx, 60 + dy, col('stone', 4 if dx + dy < 4 else 2))
    cv.vline(45, 60, 96, col('stone', 2))
    cv.vline(82, 60, 96, col('stone', 2))

    # Left Produce Stall (x=3..41, y=54..95)
    cv.awning(3, 55, 41, 63, ramp_a='green', ramp_b='white', stripe_w=3)
    cv.rect(4, 64, 40, 81, col('wood', 2))
    for lx in (13, 29):
        cv.vline(lx, 64, 67, col('darkwood', 0))
        cv.rect(lx - 1, 67, lx + 2, 69, col('yellow', 5))
    cv.rect(4, 77, 40, 95, col('wood', 3))
    produce_crates = [
        (5, 72, 16, 82, 'red', 4),
        (17, 72, 28, 82, 'orange', 4),
        (29, 72, 39, 82, 'foliage', 5),
        (5, 83, 16, 94, 'yellow', 5),
        (17, 83, 28, 94, 'green', 4),
        (29, 83, 39, 94, 'brick', 5),
    ]
    for cx0, cy0, cx1, cy1, cramp, ci in produce_crates:
        cv.outline_box(cx0, cy0, cx1, cy1, col('cedar', 3), col('wood', 1))
        for py in range(cy0 + 1, cy1 - 2, 2):
            for px in range(cx0 + 1, cx1 - 2, 3):
                cv.rect(px, py, min(px + 2, cx1 - 1), min(py + 2, cy1 - 2), col(cramp, ci))
                cv.p(px, py, col(cramp, min(ci + 1, 5)))
                if px + 2 < cx1 - 1:
                    cv.p(px + 2, py + 1, col(cramp, max(1, ci - 2)))
        cv.rect(cx0 + 2, cy1 - 2, cx0 + 5, cy1 - 1, col('white', 6))

    # Right Rice-Cake (Tteok) & Side-Dish Stall (x=87..125, y=54..95)
    cv.awning(87, 55, 125, 63, ramp_a='red', ramp_b='yellow', stripe_w=3)
    cv.rect(88, 64, 124, 80, col('cream', 4))
    for lx in (98, 114):
        cv.vline(lx, 64, 67, col('darkwood', 0))
        cv.rect(lx - 1, 67, lx + 2, 69, col('yellow', 5))
    cv.outline_box(88, 73, 124, 86, col('cream', 5), col('steel', 2))
    tteok_trays = [(90, 'pink', 4), (99, 'white', 6), (108, 'green', 4), (116, 'yellow', 5)]
    for tx, tramp, ti in tteok_trays:
        cv.outline_box(tx, 75, tx + 8, 85, col('wood', 2), col('wood', 0))
        for ry in (76, 79, 82):
            for rx in (tx + 1, tx + 4):
                cv.rect(rx, ry, rx + 2, ry + 2, col(tramp, ti))
                cv.p(rx, ry, col(tramp, min(ti + 1, 5)))
                cv.p(rx + 2, ry + 1, col(tramp, max(1, ti - 2)))
    for d in range(5):
        cv.p(91 + d, 78 - d, col('glass', 6))
        cv.p(111 + d, 78 - d, col('glass', 6))
    cv.siding_wall(88, 86, 124, 95, ramp='cedar', base_i=3, horizontal=False, step=3, seed=925)
    cv.hline(88, 124, 86, col('wood', 1))

    # Finish outer building edges without darkening the open arcade stone walkway at y=95
    for y in range(3, 96):
        if cv.get(bx0, y)[3] == 255:
            cv.p(bx0, y, shade_rgba(cv.get(bx0, y), -1))
        if cv.get(bx1 - 1, y)[3] == 255:
            cv.p(bx1 - 1, y, shade_rgba(cv.get(bx1 - 1, y), -2))
        if bx1 - 2 >= 0 and cv.get(bx1 - 2, y)[3] == 255:
            cv.p(bx1 - 2, y, shade_rgba(cv.get(bx1 - 2, y), -1))
    for x in range(bx0, bx1):
        if 46 <= x < 82:
            continue  # keep open arcade walkway clear to street baseline y=95
        if cv.get(x, 95)[3] == 255:
            cv.p(x, 95, shade_rgba(cv.get(x, 95), -2))

    return cv, {
        'id': 'mf-bldg-kr_market_arcade',
        'name': '전통시장 아케이드·청과·떡집 2층 상가',
        'pack': PACK, 'w': 8, 'h': 6, 'doorCol': 4,
        'lightAnchors': [[64, 72], [21, 68], [106, 68], [64, 20], [18, 36]],
        'tags': ['sangga', 'korean', 'market', 'arcade', 'stalls', 'commercial', '2f'],
    }


# ---------------------------------------------------------------------------
# Building 10: mf-bldg-kr_corner_pharmacy (80x96)
# ---------------------------------------------------------------------------
def build_kr_corner_pharmacy():
    cv = Canvas(80, 96)
    bx0, bx1 = 1, 74  # Slight right margin x=68..79 for illuminated pharmacy cross sign!

    # Bright white ceramic tile body
    cv.tile_cladding(bx0, 26, bx1, 96, ramp='white', base_i=5, cw=4, ch=4, seed=1001)
    # Mint/teal corner accent trim stripes
    cv.vline(bx0 + 1, 26, 95, col('teal', 4))
    cv.vline(bx1 - 2, 26, 95, col('teal', 3))

    # --- Sloped Grey Kawara/Metal Pitched Roof (y=3..26) ---
    cv.pitched_roof(bx0 - 1, 4, bx1 + 1, 26, ramp='kawara', ridge_hi=True, moss_rate=0.04, seed=1002)
    # Small roof dormer vent on left + metal flue on right
    cv.outline_box(13, 10, 22, 17, col('kawara', 3), col('kawara', 0), top_hi=col('kawara', 6))
    cv.rect(15, 12, 20, 15, col('glass', 2))
    cv.p(16, 13, col('glass', 5))
    cv.rect(58, 1, 62, 11, col('steel', 4))
    cv.hline(57, 63, 1, col('steel', 6))
    cv.vline(58, 1, 11, col('steel', 1))

    # --- 2F: Bright White Tile + Wood-Shuttered Residential Windows (y=26..54) ---
    cv.shade_rect(bx0, 26, bx1, 29, -1)
    # Left cozy warm window with open wooden shutters & flower box
    draw_rich_window(cv, 11, 32, 30, 45, mode='warm', frame='wood:1', sill='white:6', curtain='cream', flower='pink:4', seed=1011)
    cv.rect(7, 32, 11, 45, col('wood', 4))
    cv.hline(7, 11, 35, col('wood', 2))
    cv.hline(7, 11, 39, col('wood', 2))
    cv.rect(30, 32, 34, 45, col('wood', 4))
    cv.hline(30, 34, 35, col('wood', 2))
    cv.hline(30, 34, 39, col('wood', 2))

    # Right residential window with reflective glass + half-shutter + compact wall AC
    draw_rich_window(cv, 43, 32, 58, 45, mode='glass', frame='wood:1', sill='white:6', seed=1012)
    cv.rect(39, 32, 43, 45, col('cedar', 4))
    draw_wall_ac(cv, 60, 39)

    # --- 1F: Crisp Bright Turquoise/White Corner Pharmacy (y=53..96) ---
    # Bright turquoise/mint & white fascia band!
    cv.rect(bx0, 53, bx1, 63, col('white', 6))
    cv.hline(bx0, bx1, 53, col('teal', 1))
    cv.rect(bx0 + 1, 54, bx1 - 1, 61, col('teal', 4))
    cv.hline(bx0 + 1, bx1 - 1, 54, col('teal', 5))
    cv.hline(bx0 + 1, bx1 - 1, 61, col('teal', 2))
    cv.hline(bx0, bx1, 62, col('teal', 1))
    cv.hline(bx0, bx1, 63, col('ink', 1))
    # Crisp white center badge with green cross + "약국"
    cv.rect(14, 54, 58, 61, col('white', 6))
    draw_glyphs(cv, 17, 55, '+', col('green', 3))
    draw_glyphs(cv, 26, 55, '약국', col('teal', 1), spacing=7)
    draw_glyphs(cv, 45, 55, '+', col('green', 3))

    # Wide clean display window showing neat medicine shelves (x=4..43, y=65..92)
    cv.outline_box(4, 65, 43, 92, col('coolwhite', 5), col('teal', 2))
    for y in range(66, 91):
        for x in range(5, 42):
            cv.p(x, y, col('white', 6 if y < 70 else 5))
    # 3 crisp medicine shelves with recessed shadow and varied box/bottle heights!
    med_cols = [col('green', 4), col('teal', 4), col('blue', 4), col('orange', 4), col('red', 4), col('yellow', 4)]
    for si, sy in enumerate((73, 80, 87)):
        cv.hline(6, 41, sy - 5, col('coolwhite', 3))  # recessed shelf back shadow
        cv.hline(6, 41, sy, col('steel', 2))
        cv.hline(6, 41, sy + 1, col('coolwhite', 4))
        for gx in range(7, 39, 4):
            bh = 4 if (gx + si) % 3 != 0 else 3
            c = med_cols[(gx + si * 2) % len(med_cols)]
            cv.rect(gx, sy - bh, gx + 3, sy, c)
            cv.p(gx + 1, sy - bh, col('white', 6))  # bottle cap / box label highlight!
    # Crisp green pharmacy cross decal on left window corner + glass reflection
    draw_glyphs(cv, 8, 67, '+', col('green', 4))
    for d in range(6):
        cv.p(34 + d, 71 - d, col('glass', 6))
    # Clean mint-white lower tile kickplate
    cv.rect(4, 92, 43, 95, col('teal', 4))
    cv.hline(4, 43, 92, col('teal', 2))

    # Clean glass pharmacy entry door (x=46..64, y=65..95, doorCol=3)
    cv.door_glass(46, 65, 64, 95, frame='teal:2', warm=True)
    cv.hline(47, 63, 79, col('teal', 4))  # frosted privacy stripe
    cv.hline(45, 65, 94, col('white', 6))  # clean concrete entry ramp/step

    # Potted mint/green shrub beside entrance
    draw_potted_shrub(cv, 65, 83, flower='white:6')

    # Illuminated green pharmacy cross blade sign mounted on right corner (x=68..79, y=38..51)
    cv.hline(66, 68, 41, col('steel', 1))
    cv.hline(66, 68, 48, col('steel', 1))
    cv.outline_box(68, 38, 79, 51, col('white', 6), col('green', 1), top_hi=col('white', 6))
    # Glowing bright green medical cross (7x7 bold)
    cv.rect(72, 40, 75, 49, col('green', 4))
    cv.rect(70, 43, 77, 46, col('green', 4))
    cv.rect(73, 41, 74, 48, col('green', 5))
    cv.rect(71, 44, 76, 45, col('green', 5))

    finish_building_edges(cv, bx0, bx1, 4, 96)
    return cv, {
        'id': 'mf-bldg-kr_corner_pharmacy',
        'name': '민트·화이트 코너 약국 2층 상가',
        'pack': PACK, 'w': 5, 'h': 6, 'doorCol': 3,
        'lightAnchors': [[23, 78], [55, 78], [73, 44], [20, 38]],
        'tags': ['sangga', 'korean', 'pharmacy', 'corner', 'white-tile', '2f'],
    }


BUILDERS = [
    build_kr_chicken_pub,
    build_kr_hagwon_cafe,
    build_kr_bakery_clinic,
    build_kr_pcbang_billiard,
    build_kr_corner_conv24,
    build_kr_rooftop_cafe,
    build_kr_narrow_alley_shop,
    build_kr_glass_salon,
    build_kr_market_arcade,
    build_kr_corner_pharmacy,
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    items = []
    for fn in BUILDERS:
        cv, meta = fn()
        out_path = os.path.join(OUT_DIR, f"{meta['id']}.png")
        cv.save(out_path)
        items.append(meta)
        print(f"wrote {meta['id']}.png ({cv.w}x{cv.h})")

    manifest = {
        'pack': PACK,
        'items': items,
    }
    mpath = os.path.join(OUT_DIR, 'manifest.json')
    with open(mpath, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"wrote {mpath} ({len(items)} items)")


if __name__ == '__main__':
    main()
