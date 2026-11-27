#!/usr/bin/env python3
"""Modern-Fable Buildings — Pack 03: Japanese Shotengai & Neighborhood Shops (10 buildings).

Strictly locked to tiledata/jp-city/fable-city/palette.json via fable_lib.
Matches the Fable 5.2 top-3/4 RPG pixel-art baseline (bldg-f-shop-1 / bldg-f-house-1):
  - Sunlit top-3/4 pitched kawara/ibushi/midori/rooftile/tin/glass/flat roofs,
  - Cozy handcrafted Japanese street warmth: noren curtains, glowing red chochin lanterns,
    weathered cedar lattice, backlit amber interiors, AC units, bikes, crates, planters,
  - Crisp Galmuri9 Japanese signboard glyphs from tiledata/jp-city/fable-city/glyphs9.json,
  - 0 off-palette pixels, binary alpha (0/255), 28-55 unique colors, zero floor cloning.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from fable_lib import Canvas, col, C, hsh, shade_rgba, OUT_ROOT, GLYPHS_PATH


_GLYPHS_CACHE = None

EXTRA_GLYPHS = {
    '花': [
        '..#...#..',
        '#########',
        '..#...#..',
        '..#.#....',
        '.#..#...#',
        '##..#.##.',
        '.#..##...',
        '.#..#...#',
        '.#...####',
    ],
    'パ': [
        '.......#.',
        '..#...#.#',
        '..#.#..#.',
        '..#..#...',
        '.#...#...',
        '.#....#..',
        '#.....#..',
        '#......#.',
    ],
    'ン': [
        '.##......',
        '...#.....',
        '........#',
        '.......#.',
        '.......#.',
        '......#..',
        '....##...',
        '.###.....',
    ],
    'V': ['#...#', '#...#', '#...#', '.#.#.', '..#..'],
    'I': ['###', '.#.', '.#.', '.#.', '###'],
    'N': ['#...#', '##..#', '#.#.#', '#..##', '#...#'],
    'Y': ['#...#', '.#.#.', '..#..', '..#..', '..#..'],
    'L': ['#....', '#....', '#....', '#....', '#####'],
    'P': ['####.', '#...#', '####.', '#....', '#....'],
    'R': ['####.', '#...#', '####.', '#.#..', '#..#.'],
    'E': ['####', '#...', '###.', '#...', '####'],
    'C': ['.###', '#...', '#...', '#...', '.###'],
    'O': ['.##.', '#..#', '#..#', '#..#', '.##.'],
    'D': ['###.', '#..#', '#..#', '#..#', '###.'],
    'S': ['.###', '#...', '.##.', '...#', '###.'],
    'A': ['.##.', '#..#', '####', '#..#', '#..#'],
    'F': ['####', '#...', '###.', '#...', '#...'],
    'B': ['###.', '#..#', '###.', '#..#', '###.'],
    'K': ['#..#', '#.#.', '##..', '#.#.', '#..#'],
}


def load_glyphs():
    global _GLYPHS_CACHE
    if _GLYPHS_CACHE is None:
        raw = json.load(open(GLYPHS_PATH, encoding='utf-8'))['glyphs']
        _GLYPHS_CACHE = dict(raw)
        _GLYPHS_CACHE.update(EXTRA_GLYPHS)
    return _GLYPHS_CACHE


def draw_glyph_text(cv, text, x, y, color, vertical=False, spacing=1, shadow=None):
    """Render crisp 1px-stroke Galmuri9 Japanese kanji/katakana or 5px Latin glyphs."""
    glyphs = load_glyphs()
    rgba = C(color)
    sh_rgba = C(shadow) if shadow is not None else None
    cx, cy = x, y
    for ch in text:
        g = glyphs.get(ch)
        if not g:
            if vertical:
                cy += 4
            else:
                cx += 4
            continue
        gh = len(g)
        gw = max(len(row) for row in g)
        if sh_rgba is not None:
            for ry, row in enumerate(g):
                for rx, bit in enumerate(row):
                    if bit == '#':
                        cv.p(cx + rx, cy + ry + 1, sh_rgba)
        for ry, row in enumerate(g):
            for rx, bit in enumerate(row):
                if bit == '#':
                    cv.p(cx + rx, cy + ry, rgba)
        if vertical:
            cy += gh + spacing
        else:
            cx += gw + spacing


def text_size(text, vertical=False, spacing=1):
    glyphs = load_glyphs()
    if vertical:
        w = max((max(len(r) for r in glyphs[ch]) for ch in text if ch in glyphs), default=0)
        h = sum((len(glyphs[ch]) + spacing for ch in text if ch in glyphs)) - (spacing if text else 0)
        return w, max(0, h)
    else:
        w = sum((max(len(r) for r in glyphs[ch]) + spacing for ch in text if ch in glyphs)) - (spacing if text else 0)
        h = max((len(glyphs[ch]) for ch in text if ch in glyphs), default=0)
        return max(0, w), h


# ---------------------------------------------------------------------------
# Authentic Fable 5.2 Japanese Shotengai Architectural Primitives
# ---------------------------------------------------------------------------

def draw_kawara_roof(cv, x0, y0, x1, y1, ramp='kawara', moss=0.07,
                     onigawara=True, skylight=None, vent=None, seed=0):
    """Authentic ribbed Japanese kawara / ibushi / midori / cha pitched roof.

    Features top ridge beam (mune), sculpted onigawara end finials, wave-ribbed
    tile courses with top-left sunlight, organic moss accents, round nokimarugawara
    eave tile ends, and a deep cast shadow band beneath the overhanging eave.
    """
    w = x1 - x0
    h = y1 - y0
    # Main tiled slope (leave top 3px for ridge beam, bottom 3px for overhanging eave)
    for y in range(y0 + 3, y1 - 3):
        ry = y - (y0 + 3)
        ci = ry // 4
        yy = ry % 4
        for x in range(x0, x1):
            rx = x - x0
            # Ribbed vertical tile flutes (3px repeat: bright crest, mid, shadow trough)
            rib = (rx + (0 if ramp in ('kawara', 'ibushi', 'midori') else (ci % 2))) % 3
            bi = rx // 3
            r = hsh(bi, ci, seed)
            right_sh = 1 if rx >= w - 3 else 0
            left_hi = 1 if rx <= 2 else 0
            # Horizontal tile lip at yy == 3
            if yy == 3:
                cv.p(x, y, col(ramp, max(0, 1 - right_sh)))
            elif rib == 2:
                # Deep vertical flute trough
                cv.p(x, y, col(ramp, max(0, 1 - right_sh)))
            elif moss > 0 and r > 1.0 - moss and ry >= (h - 6) // 2 and yy in (1, 2):
                cv.p(x, y, col('moss', 4 if rib == 0 else 2))
            else:
                # Sunlit upper slope transitioning to slightly deeper lower courses
                base = 5 if (ry < (h - 6) // 2 and rib == 0) else (4 if rib == 0 else 3)
                if yy == 0 and rib == 0:
                    base += 1
                if r > 0.80:
                    base += 1
                elif r < 0.20:
                    base -= 1
                base = max(1, min(6, base + left_hi - right_sh))
                cv.p(x, y, col(ramp, base))

    # Side gable verge trim (1px dark border + inner highlight on left)
    cv.vline(x0, y0 + 2, y1 - 1, col(ramp, 0))
    cv.vline(x0 + 1, y0 + 3, y1 - 3, col(ramp, 5))
    cv.vline(x1 - 1, y0 + 2, y1 - 1, col(ramp, 0))
    cv.vline(x1 - 2, y0 + 3, y1 - 3, col(ramp, 1))

    # Top ridge beam (mune)
    cv.hline(x0 + 1, x1 - 1, y0, col(ramp, 1))
    cv.hline(x0 + 1, x1 - 1, y0 + 1, col(ramp, 6))
    for x in range(x0 + 2, x1 - 2, 4):
        cv.p(x, y0 + 1, col(ramp, 7 if len(col(ramp, 7)) else 6))
    cv.hline(x0 + 1, x1 - 1, y0 + 2, col(ramp, 3))
    cv.hline(x0 + 1, x1 - 1, y0 + 3, col(ramp, 0))

    # Sculpted onigawara ridge end finials
    if onigawara:
        for ox in (x0, x1 - 4):
            cv.rect(ox, y0, ox + 4, y0 + 4, col(ramp, 2))
            cv.hline(ox + 1, ox + 3, y0, col(ramp, 6))
            cv.p(ox + 1, y0 + 1, col(ramp, 7))
            cv.p(ox + 2, y0 + 1, col(ramp, 5))
            cv.hline(ox, ox + 4, y0 + 3, col(ramp, 0))
            cv.p(ox, y0, col(ramp, 0))
            cv.p(ox + 3, y0, col(ramp, 0))

    # Optional small recessed skylight window on roof slope
    if skylight:
        sx, sy, sw, sh = skylight
        cv.outline_box(sx, sy, sx + sw, sy + sh, col('glass', 2), col(ramp, 0), top_hi=col(ramp, 5))
        cv.window(sx + 1, sy + 1, sx + sw - 1, sy + sh - 1, style='glass', frame=col('steel', 1), sill=None)
        cv.hline(sx, sx + sw, sy + sh, col(ramp, 0))

    # Optional small exhaust hood / vent on roof
    if vent:
        vx, vy = vent
        cv.outline_box(vx, vy, vx + 6, vy + 7, col('steel', 3), col('steel', 0), top_hi=col('steel', 6))
        cv.rect(vx + 1, vy + 3, vx + 5, vy + 6, col('steel', 1))
        cv.hline(vx + 1, vx + 5, vy + 4, col('steel', 4))
        cv.hline(vx, vx + 6, vy + 7, col(ramp, 0))

    # Overhanging front eave (noki) with scalloped nokimarugawara round tile ends
    ey = y1 - 3
    cv.hline(x0, x1, ey, col(ramp, 2))
    cv.hline(x0, x1, ey + 1, col(ramp, 1))
    cv.hline(x0, x1, ey + 2, col(ramp, 0))
    for x in range(x0 + 1, x1 - 1, 3):
        cv.p(x, ey, col(ramp, 5))
        cv.p(x + 1, ey, col(ramp, 4))
        cv.p(x, ey + 1, col(ramp, 4))
        cv.p(x + 1, ey + 1, col(ramp, 2))


def draw_hisashi_eave(cv, x0, y0, x1, y1, ramp='kawara', seed=0):
    """Inter-story projecting tiled Japanese eave (hisashi) with cast shadow below."""
    w = x1 - x0
    h = y1 - y0
    cv.hline(x0, x1, y0, col(ramp, 0))
    for y in range(y0 + 1, y1 - 2):
        ry = y - y0
        for x in range(x0, x1):
            rx = x - x0
            rib = rx % 3
            if rx == 0 or rx == w - 1:
                cv.p(x, y, col(ramp, 0))
            elif rib == 2:
                cv.p(x, y, col(ramp, 1))
            elif ry == 1:
                cv.p(x, y, col(ramp, 5 if rib == 0 else 4))
            else:
                r = hsh(rx // 3, ry, seed)
                t = 4 if rib == 0 else 3
                if r > 0.8:
                    t += 1
                cv.p(x, y, col(ramp, min(6, t)))
    # Nokimarugawara round tile-end rim
    cv.hline(x0, x1, y1 - 2, col(ramp, 1))
    for x in range(x0 + 1, x1 - 1, 3):
        cv.p(x, y1 - 2, col(ramp, 5))
        cv.p(x + 1, y1 - 2, col(ramp, 3))
    cv.hline(x0, x1, y1 - 1, col(ramp, 0))
    # Deep eave cast shadow onto 1F wall
    if y1 < cv.h:
        cv.hline(x0 + 1, x1 - 1, y1, col('ink', 0))
    if y1 + 1 < cv.h:
        cv.hline(x0 + 1, x1 - 1, y1 + 1, col('ink', 1))


def draw_plaster_wall(cv, x0, y0, x1, y1, ramp='cream', base_i=5, seed=0,
                      eave_shadow=True, damp_base=False):
    """Hand-textured warm Japanese stucco/plaster wall with subtle organic tone shifts."""
    cv.stipple_rect(x0, y0, x1, y1, ramp, base_i, max(1, base_i - 1), min(6, base_i + 1), seed=seed, rate=0.16)
    # Subtle vertical weathering streaks
    for x in range(x0 + 3, x1 - 3, 7):
        if hsh(x, y0, seed + 17) > 0.55:
            slen = 3 + int(hsh(x, y0, seed + 23) * 5)
            for dy in range(slen):
                if y0 + dy < y1:
                    cv.p(x, y0 + dy, col(ramp, max(1, base_i - 1)))
    if eave_shadow:
        cv.hline(x0, x1, y0, col(ramp, max(0, base_i - 3)))
        if y0 + 1 < y1:
            cv.hline(x0, x1, y0 + 1, col(ramp, max(1, base_i - 2)))
    if damp_base and y1 - y0 >= 6:
        cv.hline(x0, x1, y1 - 2, col(ramp, max(1, base_i - 2)))
        cv.hline(x0, x1, y1 - 1, col(ramp, max(0, base_i - 3)))


def draw_wood_slats(cv, x0, y0, x1, y1, ramp='cedar', base_i=4, step=2, seed=0):
    """Vertical Japanese cedar/hinoki batten siding or slatted koshi wall."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            rx = x - x0
            r = hsh(rx // step, y // 6, seed)
            if rx % step == step - 1:
                cv.p(x, y, col(ramp, max(0, base_i - 2)))
            else:
                t = base_i + (1 if r > 0.68 else (-1 if r < 0.20 else 0))
                if y == y0:
                    t = max(0, t - 2)
                cv.p(x, y, col(ramp, min(6, t)))


def draw_noren(cv, x0, y0, x1, y1, ramp='red', panels=4, crest_col='white:5'):
    """Split Japanese noren shop curtain hanging from a bamboo rod."""
    w = x1 - x0
    h = y1 - y0
    # Bamboo rod (take-bo) across top
    cv.hline(x0 - 1, x1 + 1, y0, col('cedar', 2))
    cv.hline(x0, x1, y0, col('cedar', 5))
    cv.p(x0 - 1, y0, col('darkwood', 1))
    cv.p(x1, y0, col('darkwood', 1))

    # Hanging cloth panels with 1px slits
    pw = max(3, (w - (panels - 1)) // panels)
    cx = x0
    for idx in range(panels):
        px1 = x1 if idx == panels - 1 else min(x1, cx + pw)
        if px1 <= cx:
            break
        # Hanging loops on rod
        cv.p(cx + 1, y0, col(ramp, 1))
        if px1 - cx >= 4:
            cv.p(px1 - 2, y0, col(ramp, 1))
        for y in range(y0 + 1, y1):
            ry = y - (y0 + 1)
            for x in range(cx, px1):
                rx = x - cx
                if ry == 0:
                    cv.p(x, y, col(ramp, 2))
                elif y == y1 - 1:
                    cv.p(x, y, col(ramp, 1))
                elif rx == 0:
                    cv.p(x, y, col(ramp, 4))
                elif rx == (px1 - cx) - 1:
                    cv.p(x, y, col(ramp, 2))
                else:
                    cv.p(x, y, col(ramp, 3 if (rx % 2 == 1) else 4))
        # Crisp white crest / kamon dot or stripe in middle of panel
        if crest_col and (px1 - cx) >= 4 and h >= 6:
            mx = (cx + px1) // 2
            my = y0 + 1 + (h - 2) // 2
            cv.p(mx, my, crest_col)
            if (px1 - cx) >= 5:
                cv.p(mx - 1, my, crest_col)
            if h >= 8:
                cv.p(mx, my - 1, crest_col)
        # 1px slit gap showing warm shadow/glow behind
        if idx < panels - 1 and px1 < x1:
            for y in range(y0 + 2, y1):
                cv.p(px1, y, col('orange', 2) if y > y0 + 3 else col('ink', 0))
        cx = px1 + 1


def draw_chochin(cv, cx, y0, ramp='red', h=9, lit=True):
    """Glowing ribbed Japanese chochin paper lantern (width 5-7px)."""
    # Hanging string
    cv.p(cx, y0, col('ink', 0))
    # Top cap
    cv.hline(cx - 1, cx + 2, y0 + 1, col('ink', 0))
    body_y0 = y0 + 2
    body_y1 = y0 + h - 2
    for y in range(body_y0, body_y1):
        ry = y - body_y0
        mid = (body_y1 - body_y0) // 2
        half_w = 2 if abs(ry - mid) <= max(1, mid - 1) else 1
        for x in range(cx - half_w, cx + half_w + 1):
            dx = abs(x - cx)
            if dx == half_w:
                cv.p(x, y, col(ramp, 1 if ry % 2 == 1 else 2))
            elif lit and dx == 0 and abs(ry - mid) <= 1:
                cv.p(x, y, col('yellow', 5 if ry == mid else 4))
            elif lit and dx <= 1:
                cv.p(x, y, col('orange', 4) if ramp == 'orange' else col(ramp, 4 if ry % 2 == 0 else 3))
            else:
                cv.p(x, y, col(ramp, 3 if ry % 2 == 0 else 2))
    # Bottom cap + tassel
    cv.hline(cx - 1, cx + 2, body_y1, col('ink', 0))
    cv.p(cx, body_y1 + 1, col('ink', 1))


def draw_andon(cv, x, y, w=6, h=11):
    """Standing wooden Japanese glowing shoji lantern box (andon)."""
    cv.outline_box(x, y, x + w, y + 2, col('darkwood', 3), col('darkwood', 0), top_hi=col('wood', 5))
    cv.outline_box(x + 1, y + 2, x + w - 1, y + h - 2, col('yellow', 4), col('darkwood', 1))
    for yy in range(y + 3, y + h - 3):
        for xx in range(x + 2, x + w - 2):
            cv.p(xx, yy, col('yellow', 5) if yy <= y + 5 else col('orange', 4))
    # Dark wood vertical strut + legs
    cv.hline(x, x + w, y + h - 2, col('darkwood', 1))
    cv.p(x + 1, y + h - 1, col('darkwood', 0))
    cv.p(x + w - 2, y + h - 1, col('darkwood', 0))


def draw_ac_unit(cv, x, y, pipe_y1=None):
    """Wall-mounted compact Japanese AC outdoor unit with fan grille & wall pipe."""
    # Wall brackets
    cv.vline(x + 1, y + 7, y + 9, col('steel', 1))
    cv.vline(x + 8, y + 7, y + 9, col('steel', 1))
    # Box body (10x7)
    cv.outline_box(x, y, x + 10, y + 7, col('coolwhite', 4), col('steel', 1), top_hi=col('white', 6))
    cv.hline(x + 1, x + 9, y + 2, col('coolwhite', 2))
    # Circular fan grille on left
    cv.rect(x + 2, y + 2, x + 6, y + 6, col('steel', 1))
    cv.p(x + 3, y + 3, col('steel', 4))
    cv.p(x + 4, y + 4, col('steel', 3))
    cv.p(x + 3, y + 4, col('steel', 2))
    # Right service louver
    cv.vline(x + 7, y + 2, y + 6, col('steel', 3))
    cv.vline(x + 8, y + 2, y + 6, col('coolwhite', 3))
    # Shadow below
    cv.hline(x + 1, x + 10, y + 7, col('ink', 1))
    # Refrigerant pipe going down wall
    if pipe_y1 is not None and pipe_y1 > y + 4:
        px = x + 10
        cv.vline(px, y + 3, pipe_y1, col('coolwhite', 4))
        cv.vline(px + 1, y + 3, pipe_y1, col('steel', 2))
        cv.p(px - 1, y + 3, col('coolwhite', 3))


def draw_drainpipe(cv, x, y0, y1, ramp='steel'):
    """Subtle vertical Japanese rain gutter downspout with brackets."""
    cv.vline(x, y0, y1, col(ramp, 4))
    cv.vline(x + 1, y0, y1, col(ramp, 1))
    for by in range(y0 + 5, y1 - 3, 14):
        cv.hline(x - 1, x + 2, by, col(ramp, 0))


def draw_koshi_window(cv, x0, y0, x1, y1, frame='darkwood:1', bar='wood:3',
                      warm=True, sill=True, spacing=3):
    """Traditional Japanese wooden lattice (koshi) window with glowing shoji/amber interior."""
    cv.outline_box(x0, y0, x1, y1, col('orange', 3) if warm else col('glass', 2), frame)
    ix0, iy0, ix1, iy1 = x0 + 1, y0 + 1, x1 - 1, y1 - 1
    for y in range(iy0, iy1):
        ry = y - iy0
        for x in range(ix0, ix1):
            if warm:
                if ry == 0:
                    cv.p(x, y, col('orange', 2))
                elif ry >= (iy1 - iy0) // 2:
                    cv.p(x, y, col('yellow', 5 if (x + y) % 3 == 0 else 4))
                else:
                    cv.p(x, y, col('cream', 5) if ry == 1 else col('orange', 4))
            else:
                cv.p(x, y, col('glass', 4 if (x - ix0 + ry) <= 3 else 2))
    # Vertical wooden lattice slats
    for x in range(ix0 + spacing - 1, ix1, spacing):
        cv.vline(x, iy0, iy1, bar)
    # Horizontal mid transom bar
    if iy1 - iy0 >= 7:
        cv.hline(ix0, ix1, (iy0 + iy1) // 2, frame)
    if sill:
        cv.hline(x0 - 1, x1 + 1, y1, col('wood', 5))
        cv.hline(x0, x1, y1 + 1, col('ink', 1))


def draw_sliding_door(cv, x0, y0, x1, y1, ramp='wood', warm=True, panels=2, kick_h=7):
    """Japanese wooden sliding shop door (hikido) with backlit frosted glass & timber base."""
    cv.outline_box(x0, y0, x1, y1, col(ramp, 3), col(ramp, 0))
    w = x1 - x0 - 2
    pw = max(5, w // panels)
    for i in range(panels):
        px0 = x0 + 1 + i * pw
        px1 = (x1 - 1) if i == panels - 1 else (px0 + pw)
        cv.outline_box(px0, y0 + 1, px1, y1 - 1, col(ramp, 4), col(ramp, 1), top_hi=col(ramp, 5))
        # Upper backlit frosted/warm glass pane
        gy1 = max(y0 + 5, y1 - 1 - kick_h)
        if gy1 > y0 + 3 and px1 - px0 >= 5:
            for y in range(y0 + 2, gy1):
                ry = y - (y0 + 2)
                for x in range(px0 + 1, px1 - 1):
                    if warm:
                        if ry == 0:
                            cv.p(x, y, col('orange', 2))
                        elif ry >= (gy1 - y0 - 2) // 2:
                            cv.p(x, y, col('yellow', 5 if (x + y) % 3 == 0 else 4))
                        else:
                            cv.p(x, y, col('orange', 4 if x % 2 == 0 else 3))
                    else:
                        cv.p(x, y, col('glass', 4 if (x - px0 + ry) <= 3 else 2))
            # Crisp shoji/muntin lattice inside glass
            if px1 - px0 >= 7:
                cv.vline((px0 + px1) // 2, y0 + 2, gy1, col(ramp, 2))
            if gy1 - y0 >= 9:
                cv.hline(px0 + 1, px1 - 1, (y0 + 2 + gy1) // 2, col(ramp, 2))
        # Lower wood kick panel with vertical slats
        for y in range(gy1, y1 - 2):
            for x in range(px0 + 1, px1 - 1):
                cv.p(x, y, col(ramp, 3 if (x - px0) % 2 == 0 else 4))
        # Recessed wooden door pull
        handle_x = px0 + 2 if i == 1 else px1 - 3
        cv.vline(handle_x, gy1 - 2, gy1 + 2, col(ramp, 0))
    # Ground threshold bar
    cv.hline(x0, x1, y1 - 1, col('stone', 5))


def draw_aframe_menu(cv, x, y, board_ramp='asphalt', frame_ramp='wood'):
    """Sidewalk wooden A-frame chalkboard menu stand (8x10px)."""
    cv.outline_box(x, y, x + 8, y + 8, col(board_ramp, 1), col(frame_ramp, 2), top_hi=col(frame_ramp, 5))
    # Tiny chalk header + menu lines
    cv.hline(x + 2, x + 6, y + 2, col('yellow', 5))
    cv.hline(x + 2, x + 5, y + 4, col('white', 5))
    cv.hline(x + 2, x + 6, y + 6, col('cream', 4))
    # Legs
    cv.vline(x + 1, y + 8, y + 10, col(frame_ramp, 1))
    cv.vline(x + 6, y + 8, y + 10, col(frame_ramp, 1))
    cv.hline(x + 1, x + 7, y + 10, col('ink', 1))


def draw_beer_crates(cv, x, y, ramp_top='yellow', ramp_bot='red'):
    """Stacked izakaya beer crates with tiny green/amber glass bottle necks (10x12px)."""
    # Bottom crate (10x6)
    cv.outline_box(x, y + 6, x + 10, y + 12, col(ramp_bot, 3), col(ramp_bot, 0), top_hi=col(ramp_bot, 4))
    cv.hline(x + 2, x + 8, y + 8, col(ramp_bot, 1))
    cv.hline(x + 2, x + 8, y + 10, col(ramp_bot, 2))
    # Top crate (10x6)
    cv.outline_box(x, y + 1, x + 10, y + 7, col(ramp_top, 3), col(ramp_top, 0), top_hi=col(ramp_top, 5))
    cv.hline(x + 2, x + 8, y + 3, col(ramp_top, 1))
    cv.hline(x + 2, x + 8, y + 5, col(ramp_top, 2))
    # Bottle necks peeking out top
    for bx, br in ((x + 2, 'green'), (x + 4, 'wood'), (x + 6, 'green'), (x + 8, 'wood')):
        cv.p(bx, y, col(br, 3))
        cv.p(bx, y + 1, col(br, 4))


def draw_bicycle(cv, x, y, frame_ramp='red'):
    """Crisp pixel-art parked Japanese bicycle (~17x11px, grounded at y+10)."""
    # Rear wheel (cx=x+3, cy=y+7) & Front wheel (cx=x+13, cy=y+7)
    for wcx in (x + 3, x + 13):
        for dy in range(-3, 4):
            for dx in range(-3, 4):
                d2 = dx * dx + dy * dy
                if 5 <= d2 <= 10:
                    cv.p(wcx + dx, y + 7 + dy, col('asphalt', 0))
                elif d2 < 5:
                    if dx == 0 or dy == 0:
                        cv.p(wcx + dx, y + 7 + dy, col('steel', 4))
        cv.p(wcx, y + 7, col('steel', 6))
        cv.p(wcx - 1, y + 5, col('steel', 5))
    # Frame tubes
    cv.hline(x + 4, x + 11, y + 4, col(frame_ramp, 4))
    cv.hline(x + 4, x + 10, y + 5, col(frame_ramp, 2))
    for i in range(4):
        cv.p(x + 3 + i, y + 7 - i, col(frame_ramp, 3))
        cv.p(x + 11 + i // 2, y + 3 + i, col(frame_ramp, 4))
    # Saddle on left
    cv.hline(x + 4, x + 7, y + 2, col('darkwood', 1))
    cv.p(x + 5, y + 3, col('steel', 4))
    # Handlebars + front wire basket on right
    cv.hline(x + 10, x + 13, y + 1, col('steel', 5))
    cv.p(x + 11, y + 2, col('steel', 4))
    cv.outline_box(x + 12, y + 2, x + 16, y + 5, col('steel', 3), col('steel', 1), top_hi=col('steel', 5))
    # Ground contact shadow
    cv.hline(x + 1, x + 16, y + 10, col('ink', 1))


def draw_bamboo_planter(cv, x, y, w=10, h=16):
    """Refined Japanese bamboo stalks in a stone trough planter."""
    pot_y = y + h - 5
    # Slender bamboo culms & feathery leaves
    stalks = [x + 2, x + 5, x + w - 3]
    for idx, sx in enumerate(stalks):
        top_y = y + (idx % 2) * 2
        for yy in range(top_y, pot_y):
            cv.p(sx, yy, col('foliage', 5 if yy % 3 != 0 else 3))
            if yy < pot_y - 3 and hsh(sx, yy, 91) > 0.45:
                dx = -1 if (yy % 2 == 0) else 1
                cv.p(sx + dx, yy, col('foliage', 4 if yy < y + 6 else 2))
                if yy < y + 7:
                    cv.p(sx + dx * 2, yy - 1, col('foliage', 6 if hsh(sx, yy, 11) > 0.5 else 4))
    # Dark stone planter box
    cv.outline_box(x, pot_y, x + w, y + h, col('stone', 3), col('stone', 0), top_hi=col('stone', 5))
    cv.hline(x + 1, x + w - 1, pot_y + 1, col('soil', 2))


def draw_ivy_vine(cv, x, y0, y1, spread=5, seed=0):
    """Organic climbing ivy leaves trailing down a plaster or brick wall."""
    for y in range(y0, y1):
        cx = x + int((hsh(0, y // 3, seed) - 0.5) * spread)
        for dx in range(-2, 3):
            if hsh(cx + dx, y, seed + 5) > 0.46:
                t = 5 if (dx < 0 and y % 2 == 0) else (3 if dx == 0 else 2)
                cv.p(cx + dx, y, col('foliage', t))


def draw_stone_threshold(cv, x0, y, x1, h=3):
    """Grounded Japanese cut-stone threshold/base plinth along building bottom."""
    for yy in range(y, y + h):
        for x in range(x0, x1):
            if yy == y:
                cv.p(x, yy, col('stone', 5 if x % 8 != 0 else 2))
            elif yy == y + h - 1:
                cv.p(x, yy, col('stone', 1))
            else:
                cv.p(x, yy, col('stone', 4 if (x // 6) % 2 == 0 else 3))


def draw_bistro_table(cv, cx, y, cloth_ramp='white'):
    """Top-3/4 European-Japanese cafe bistro table with two chairs & tiny coffee cup."""
    # Left & right bistro chairs
    for sx in (cx - 6, cx + 4):
        cv.outline_box(sx, y + 1, sx + 3, y + 7, col('wood', 3), col('darkwood', 0), top_hi=col('wood', 5))
        cv.vline(sx, y + 7, y + 9, col('darkwood', 1))
        cv.vline(sx + 2, y + 7, y + 9, col('darkwood', 1))
    # Table pedestal & dark base
    cv.vline(cx, y + 5, y + 9, col('steel', 1))
    cv.hline(cx - 2, cx + 3, y + 9, col('steel', 0))
    # Round sunlit tabletop
    cv.rect(cx - 4, y + 1, cx + 5, y + 5, col(cloth_ramp, 5))
    cv.hline(cx - 3, cx + 4, y, col(cloth_ramp, 6))
    cv.hline(cx - 4, cx + 5, y + 5, col(cloth_ramp, 2))
    cv.vline(cx - 4, y + 1, y + 5, col(cloth_ramp, 3))
    cv.vline(cx + 4, y + 1, y + 5, col(cloth_ramp, 2))
    # Tiny espresso cup & golden pastry plate
    cv.p(cx - 2, y + 2, col('orange', 4))
    cv.p(cx - 1, y + 2, col('yellow', 5))
    cv.p(cx + 2, y + 2, col('red', 4))


# ---------------------------------------------------------------------------
# Building 1: mf-bldg-jp_ramen_shop (80x96)
# ---------------------------------------------------------------------------

def draw_jp_ramen_shop(cv):
    w, h = cv.w, cv.h  # 80x96
    # 1. Dark kawara pitched tiled roof with moss accents & kitchen exhaust vent
    draw_kawara_roof(cv, 0, 0, w, 28, ramp='kawara', moss=0.10, onigawara=True,
                     vent=(62, 12), seed=101)

    # 2. 2F cream plaster residential room with dark timber corner posts
    draw_plaster_wall(cv, 2, 28, w - 2, 54, ramp='cream', base_i=5, seed=102)
    # Dark timber corner pilasters & mid horizontal girth beam
    cv.rect(0, 28, 3, 54, col('darkwood', 2))
    cv.vline(2, 28, 54, col('wood', 4))
    cv.rect(w - 3, 28, w, 54, col('darkwood', 1))
    cv.vline(w - 3, 28, 54, col('wood', 3))
    cv.hline(0, w, 53, col('darkwood', 1))
    # 2F slatted wooden window (left-center) with warm interior & tiny sill planter
    draw_koshi_window(cv, 9, 34, 39, 49, frame='darkwood:1', bar='wood:4', warm=True, sill=True, spacing=4)
    cv.planter_box(13, 45, 24, 50, flower='red:4', pot_ramp='brick')
    # 2F wall-mounted AC unit (right) with pipe + kitchen exhaust duct running down
    draw_ac_unit(cv, 54, 37, pipe_y1=54)
    # Metal exhaust flue pipe from rooftop vent down behind fascia
    cv.rect(65, 28, 70, 54, col('steel', 3))
    cv.vline(65, 28, 54, col('steel', 1))
    cv.vline(66, 28, 54, col('steel', 5))
    cv.vline(69, 28, 54, col('steel', 0))
    for gy in (34, 44):
        cv.hline(64, 71, gy, col('steel', 0))

    # 3. Inter-story tiled hisashi eave + bold wood fascia signboard
    draw_hisashi_eave(cv, 0, 54, w, 62, ramp='kawara', seed=103)
    # Bold warm wood fascia board across upper 1F
    cv.outline_box(3, 62, w - 3, 72, col('wood', 3), col('darkwood', 0), top_hi=col('wood', 5), bot_sh=col('darkwood', 1))
    # Centered traditional cream-and-red ramen signboard plaque with crisp '麺'
    cv.outline_box(27, 56, 53, 71, col('red', 2), col('darkwood', 0), top_hi=col('red', 4))
    cv.outline_box(29, 58, 51, 69, col('cream', 5), col('red', 1))
    draw_glyph_text(cv, '麺', 36, 59, 'darkwood:0')
    # Decorative gold rivets on wood fascia
    for rx in (8, 16, 22, 58, 64, 72):
        cv.p(rx, 66, col('yellow', 4))

    # 4. 1F warm wooden storefront (y 72..96)
    draw_wood_slats(cv, 2, 72, w - 2, h - 2, ramp='wood', base_i=3, step=3, seed=104)
    cv.rect(0, 62, 3, h, col('darkwood', 2))
    cv.rect(w - 3, 62, w, h, col('darkwood', 1))

    # Left backlit frosted glass window revealing warm ramen counter & bowls
    cv.outline_box(6, 74, 29, 91, col('darkwood', 1), col('darkwood', 0))
    draw_koshi_window(cv, 7, 75, 28, 90, frame='wood:1', bar='wood:3', warm=True, sill=False, spacing=5)
    # Counter silhouette, white ramen bowls & delicate rising steam wisps inside frosted glass
    cv.hline(8, 27, 87, col('wood', 2))
    for bx in (11, 18, 23):
        cv.hline(bx, bx + 3, 86, col('white', 5))
        cv.p(bx + 1, 85, col('red', 4))
        cv.p(bx + 1, 83, col('white', 6))
        cv.p(bx + 2, 82, col('cream', 6))
    # Wood counter ledge under window
    cv.hline(5, 30, 91, col('cedar', 5))
    cv.hline(5, 30, 92, col('darkwood', 1))

    # Center-right warm wooden sliding doors draped with deep crimson split noren
    draw_sliding_door(cv, 32, 72, 62, h - 2, ramp='wood', warm=True, panels=2, kick_h=7)
    draw_noren(cv, 31, 71, 63, 82, ramp='red', panels=4, crest_col='cream:6')

    # Glowing red chochin paper lantern hanging on right timber post
    cv.hline(63, 73, 72, col('darkwood', 0))
    # Subtle warm glow halo on wood behind lantern
    for gy in range(74, 83):
        for gx in (64, 65, 71, 72):
            cv.p(gx, gy, col('red', 2 if gy % 2 == 0 else 1))
    draw_chochin(cv, 68, 72, ramp='red', h=11, lit=True)

    # Sidewalk details: A-frame menu board on right, low wooden bench/planter on left, stone base
    draw_aframe_menu(cv, 65, 84, board_ramp='asphalt', frame_ramp='wood')
    cv.planter_box(4, 88, 12, 95, flower='yellow:4', pot_ramp='wood')
    draw_stone_threshold(cv, 0, h - 2, w, h=2)
    draw_drainpipe(cv, 1, 28, h - 2, ramp='steel')
    cv.edge_finish(top_y=28)


# ---------------------------------------------------------------------------
# Building 2: mf-bldg-jp_sushi_bar (80x96)
# ---------------------------------------------------------------------------

def draw_jp_sushi_bar(cv):
    w, h = cv.w, cv.h  # 80x96
    # 1. Crisp ibushi-silver kawara pitched roof with ornate ridge ornaments
    draw_kawara_roof(cv, 0, 0, w, 27, ramp='ibushi', moss=0.03, onigawara=True, seed=201)
    # Extra central ridge finial crest (traditional sushiya elegance)
    cv.rect(38, 0, 42, 3, col('ibushi', 6))
    cv.hline(39, 41, 0, col('white', 6))
    cv.p(38, 2, col('ibushi', 1))
    cv.p(41, 2, col('ibushi', 1))

    # 2. 2F refined kinari plaster wall with dark-wood pilasters & lattice windows
    draw_plaster_wall(cv, 2, 27, w - 2, 54, ramp='kinari', base_i=4, seed=202)
    # Dark-wood vertical posts & horizontal lintels
    for px in (0, 14, w - 16, w - 2):
        cv.rect(px, 27, px + 2, 54, col('darkwood', 2))
    cv.hline(0, w, 32, col('darkwood', 1))
    cv.hline(0, w, 52, col('darkwood', 2))
    cv.hline(0, w, 53, col('darkwood', 0))
    # Wide centered 2F dark-wood koshi lattice window
    draw_koshi_window(cv, 17, 34, 63, 50, frame='darkwood:0', bar='darkwood:3', warm=True, sill=True, spacing=3)
    # Small warm wall lanterns flanking 2F lattice
    draw_chochin(cv, 8, 37, ramp='orange', h=8, lit=True)
    draw_chochin(cv, w - 9, 37, ramp='orange', h=8, lit=True)

    # 3. Inter-story ibushi kawara hisashi eave
    draw_hisashi_eave(cv, 0, 54, w, 63, ramp='ibushi', seed=203)

    # 4. 1F pale hinoki cedar slatted facade (y 63..96)
    draw_wood_slats(cv, 2, 63, w - 2, h - 3, ramp='cedar', base_i=5, step=2, seed=204)
    cv.rect(0, 63, 2, h, col('darkwood', 1))
    cv.rect(w - 2, 63, w, h, col('darkwood', 1))

    # Left-center recessed sliding wooden entrance with deep indigo noren
    cv.rect(12, 65, 42, h - 3, col('darkwood', 1))
    draw_sliding_door(cv, 14, 67, 40, h - 3, ramp='cedar', warm=True, panels=2, kick_h=7)
    draw_noren(cv, 13, 66, 41, 79, ramp='navy', panels=3, crest_col='white:6')

    # Right side refined small backlit sushi-counter lattice window
    draw_koshi_window(cv, 46, 73, 66, 85, frame='darkwood:1', bar='cedar:3', warm=True, sill=True, spacing=3)
    # Low stone splash apron below right window
    cv.brick_wall(45, 87, 68, h - 3, ramp='stone', base_i=3, course_h=3, brick_w=6, seed=205)

    # Crisp pale-hinoki signboard ('寿司') drawn cleanly OVER eave & top of 1F slats!
    cv.outline_box(43, 55, 71, 70, col('cedar', 5), col('darkwood', 0), top_hi=col('cedar', 6), bot_sh=col('wood', 2))
    cv.outline_box(45, 57, 69, 68, col('cream', 6), col('wood', 3))
    draw_glyph_text(cv, '寿司', 47, 58, 'darkwood:0', spacing=2)
    cv.hline(44, 71, 70, col('ink', 1))

    # Ground-level refined accents: warm shoji andon lantern box on left + bamboo planter on right
    draw_andon(cv, 4, 82, w=7, h=12)
    draw_bamboo_planter(cv, 68, 77, w=10, h=17)

    # Clean cut-stone entry threshold
    draw_stone_threshold(cv, 0, h - 3, w, h=3)
    draw_drainpipe(cv, 1, 27, h - 3, ramp='ibushi')
    cv.edge_finish(top_y=27)


# ---------------------------------------------------------------------------
# Building 3: mf-bldg-jp_izakaya_corner (96x96)
# ---------------------------------------------------------------------------

def draw_jp_izakaya_corner(cv):
    w, h = cv.w, cv.h  # 96x96
    # 1. Sloped midori-green corrugated/kawara roof
    draw_kawara_roof(cv, 0, 0, w, 27, ramp='midori', moss=0.07, onigawara=True,
                     skylight=(12, 11, 10, 8), seed=301)

    # 2. 2F dark-cedar siding + corner wooden balcony on right
    cv.siding_wall(2, 27, 60, 55, ramp='darkwood', base_i=4, horizontal=True, step=3, seed=302)
    cv.rect(0, 27, 2, 55, col('darkwood', 1))
    # Two lively warm amber 2F windows on left wing
    draw_koshi_window(cv, 8, 33, 27, 48, frame='darkwood:0', bar='wood:3', warm=True, sill=True, spacing=4)
    draw_koshi_window(cv, 33, 33, 52, 48, frame='darkwood:0', bar='wood:3', warm=True, sill=True, spacing=4)
    # Mini cedar eyebrows over 2F windows
    cv.hline(7, 28, 32, col('cedar', 4))
    cv.hline(32, 53, 32, col('cedar', 4))

    # 2F right corner wooden balcony (x 58..94, y 27..55)
    draw_plaster_wall(cv, 60, 27, 94, 46, ramp='cream', base_i=4, seed=303)
    draw_sliding_door(cv, 62, 30, 79, 47, ramp='wood', warm=True, panels=2, kick_h=4)
    # Balcony floor & dark timber railing
    cv.hline(58, 95, 45, col('wood', 5))
    cv.hline(58, 95, 46, col('darkwood', 0))
    for bx in range(58, 95):
        if (bx - 58) % 3 == 0 or bx in (58, 94):
            cv.vline(bx, 46, 54, col('wood', 4))
        else:
            cv.vline(bx, 46, 54, col('darkwood', 2))
    cv.hline(58, 95, 53, col('wood', 3))
    cv.hline(58, 95, 54, col('darkwood', 0))
    # Hanging small red decorative noren on corner balcony
    draw_noren(cv, 61, 30, 79, 36, ramp='red', panels=3, crest_col='yellow:5')

    # 3. Continuous deep projecting tiled midori eave (hisashi) spanning full front!
    draw_hisashi_eave(cv, 0, 55, w, 64, ramp='midori', seed=304)

    # 4. 1F lively wooden tavern storefront (y 64..96)
    cv.siding_wall(2, 64, w - 2, h - 3, ramp='wood', base_i=3, horizontal=True, step=4, seed=306)
    cv.rect(0, 64, 3, h, col('darkwood', 1))
    cv.rect(w - 3, 64, w, h, col('darkwood', 1))

    # Warm amber izakaya windows on left showing counter & sake bottles
    draw_koshi_window(cv, 7, 71, 35, 88, frame='darkwood:0', bar='wood:2', warm=True, sill=True, spacing=5)
    for bx, bc in ((10, 'green:4'), (13, 'orange:3'), (19, 'white:5'), (24, 'green:3'), (29, 'red:4')):
        cv.vline(bx, 84, 87, bc)
        cv.p(bx, 83, col('yellow', 5))

    # Center wooden sliding tavern door with navy/indigo noren
    draw_sliding_door(cv, 41, 68, 67, h - 3, ramp='wood', warm=True, panels=2, kick_h=6)
    draw_noren(cv, 40, 67, 68, 77, ramp='navy', panels=4, crest_col='cream:5')

    # Row of 4 warm glowing paper lanterns hung under the deep eave!
    draw_chochin(cv, 12, 63, ramp='red', h=10, lit=True)
    draw_chochin(cv, 28, 63, ramp='orange', h=10, lit=True)
    draw_chochin(cv, 38, 63, ramp='red', h=10, lit=True)
    draw_chochin(cv, 71, 63, ramp='red', h=10, lit=True)

    # Vertical glowing red-and-cream blade signboard ('居酒屋') mounted cleanly OVER right corner!
    cv.outline_box(81, 30, 95, 65, col('red', 2), col('darkwood', 0), top_hi=col('red', 4))
    cv.outline_box(83, 32, 93, 63, col('cream', 6), col('red', 1))
    draw_glyph_text(cv, '居酒屋', 84, 33, 'darkwood:0', vertical=True, spacing=1)
    cv.hline(82, 95, 65, col('ink', 1))

    # Right sidewalk props: chalk A-frame menu board + stacked wooden/yellow beer crates!
    draw_aframe_menu(cv, 71, 83, board_ramp='asphalt', frame_ramp='cedar')
    draw_beer_crates(cv, 82, 81, ramp_top='yellow', ramp_bot='red')
    cv.planter_box(3, 87, 11, 93, flower='orange:4', pot_ramp='wood')

    draw_stone_threshold(cv, 0, h - 3, w, h=3)
    draw_drainpipe(cv, 1, 27, h - 3, ramp='steel')
    cv.edge_finish(top_y=27)


# ---------------------------------------------------------------------------
# Building 4: mf-bldg-jp_kissaten_cafe (80x96)
# ---------------------------------------------------------------------------

def draw_jp_kissaten_cafe(cv):
    w, h = cv.w, cv.h  # 80x96
    # 1. Pitched warm brown tile roof (cha) with nostalgic brick chimney
    draw_kawara_roof(cv, 0, 0, w, 26, ramp='cha', moss=0.05, onigawara=True, seed=401)
    # Nostalgic brick chimney on upper right
    cv.brick_wall(58, 2, 68, 15, ramp='brick', base_i=4, course_h=3, brick_w=5, seed=402)
    cv.outline_box(57, 0, 69, 4, col('stone', 4), col('brick', 0), top_hi=col('stone', 6))
    cv.vline(58, 4, 15, col('brick', 1))
    cv.vline(67, 4, 15, col('brick', 0))
    cv.hline(58, 68, 15, col('cha', 0))

    # 2. 2F aged cream stucco wall with ivy, wooden shutters & flowerboxes
    draw_plaster_wall(cv, 2, 26, w - 2, 54, ramp='cream', base_i=4, seed=403)
    # Brick corner quoins framing the Showa cafe
    for qy in range(26, 54, 4):
        qw = 4 if (qy // 4) % 2 == 0 else 3
        cv.rect(0, qy, qw, qy + 3, col('brick', 4))
        cv.hline(0, qw, qy + 3, col('brick', 1))
        cv.rect(w - qw, qy, w, qy + 3, col('brick', 3))
        cv.hline(w - qw, w, qy + 3, col('brick', 0))

    # Two 2F retro windows with louvered dark-green shutters & flower boxes
    for wx in (11, 47):
        # Left & right wooden shutters
        cv.outline_box(wx - 4, 32, wx, 46, col('green', 2), col('green', 0), top_hi=col('green', 3))
        cv.outline_box(wx + 16, 32, wx + 20, 46, col('green', 2), col('green', 0), top_hi=col('green', 3))
        for sy in range(34, 45, 2):
            cv.hline(wx - 3, wx - 1, sy, col('green', 1))
            cv.hline(wx + 17, wx + 19, sy, col('green', 1))
        cv.window(wx, 32, wx + 16, 46, style='warm', frame='darkwood:1', sill='stone:5')
        cv.planter_box(wx + 1, 44, wx + 15, 49, flower='pink:4' if wx == 11 else 'yellow:4', pot_ramp='brick')

    # Nostalgic glowing brass wall lamp centered between 2F windows
    cv.vline(39, 34, 38, col('darkwood', 0))
    cv.rect(38, 36, 42, 40, col('yellow', 5))
    cv.outline_box(37, 35, 43, 41, col('yellow', 4), col('wood', 1))
    cv.p(39, 37, col('white', 6))
    cv.p(40, 38, col('yellow', 5))

    # Climbing green ivy trailing up the left corner & across cornice
    draw_ivy_vine(cv, 4, 27, 56, spread=4, seed=404)
    draw_ivy_vine(cv, 74, 27, 46, spread=3, seed=405)

    # 3. Inter-story brick cornice, '珈琲' brass-trimmed fascia & dark-green fabric awning
    cv.hline(0, w, 53, col('stone', 5))
    cv.hline(0, w, 54, col('brick', 1))
    # Dark-wood coffeehouse fascia board with brass trim & crisp '珈琲'
    cv.outline_box(21, 50, 59, 63, col('darkwood', 2), col('darkwood', 0), top_hi=col('yellow', 3))
    cv.outline_box(23, 52, 57, 61, col('darkwood', 1), col('wood', 3))
    draw_glyph_text(cv, '珈琲', 30, 52, 'yellow:5', spacing=2, shadow='darkwood:0')
    # Dark-green fabric awning over left bay window
    cv.awning(4, 62, 46, 69, ramp_a='green', ramp_b='midori', stripe_w=4)
    # Mini brass canopy over right door
    cv.awning(49, 62, 74, 68, ramp_a='green', ramp_b='cream', stripe_w=4)

    # 4. 1F aged red-brick wall (y 63..96)
    cv.brick_wall(0, 63, w, h - 3, ramp='brick', base_i=3, course_h=3, brick_w=6, seed=406)
    # Re-draw awnings cleanly over brick
    cv.awning(4, 61, 46, 68, ramp_a='green', ramp_b='midori', stripe_w=4)
    cv.awning(49, 62, 75, 68, ramp_a='green', ramp_b='midori', stripe_w=4)

    # Arched warm backlit stained-glass bay window (left half: x 7..43, y 69..89)
    cv.outline_box(7, 69, 43, 89, col('yellow', 4), col('darkwood', 0))
    # Arch spandrel corners in dark mahogany
    for cx, cy in ((8, 70), (9, 70), (8, 71), (41, 70), (40, 70), (41, 71)):
        cv.p(cx, cy, col('darkwood', 1))
    # Stained-glass jewel mosaic inside arched bay
    for y in range(70, 88):
        for x in range(8, 42):
            if (x in (8, 41) and y <= 71) or (x in (9, 40) and y == 70):
                continue
            if y < 74:
                # Upper colored stained-glass transom band (red, teal, yellow, amber)
                panel = (x - 8) // 5
                c_band = ('red:4', 'yellow:5', 'teal:4', 'orange:4')[panel % 4]
                cv.p(x, y, c_band)
            else:
                # Warm amber glowing cafe interior with diamond lead pattern
                if (x + y) % 6 == 0:
                    cv.p(x, y, col('orange', 3))
                else:
                    cv.p(x, y, col('yellow', 5 if y >= 80 else 4))
    # Dark lead mullions & brass bay sill
    cv.hline(8, 42, 74, col('darkwood', 0))
    for mx in (19, 30):
        cv.vline(mx, 70, 88, col('darkwood', 0))
    cv.hline(6, 44, 89, col('yellow', 3))
    cv.hline(6, 44, 90, col('darkwood', 0))

    # Illuminated glass food-sample case (right of window / beside door: x 31..44, y 83..93)
    cv.outline_box(31, 82, 45, 93, col('cream', 5), col('steel', 1), top_hi=col('white', 6))
    cv.hline(32, 44, 87, col('steel', 3))
    # Tiny food samples: melon cream soda (green+white), parfait (pink+white), omurice (yellow+red)
    cv.rect(33, 84, 35, 87, col('green', 4))
    cv.p(33, 83, col('white', 6))
    cv.rect(37, 84, 40, 87, col('yellow', 5))
    cv.p(38, 84, col('red', 4))
    cv.rect(41, 84, 43, 87, col('pink', 4))
    cv.p(42, 83, col('white', 6))
    # Lower shelf coffee cup & pudding
    cv.rect(34, 89, 37, 92, col('white', 5))
    cv.p(35, 89, col('wood', 2))
    cv.rect(39, 89, 43, 92, col('orange', 4))
    cv.p(41, 88, col('red', 4))

    # Right half: brass-rimmed mahogany cafe door (x 51..69, y 69..93)
    cv.outline_box(51, 69, 69, 93, col('wood', 3), col('darkwood', 0), top_hi=col('wood', 5))
    # Brass rim outline inside door + glowing arched glass pane
    cv.outline_box(53, 71, 67, 91, col('wood', 4), col('yellow', 3))
    cv.window(55, 73, 65, 83, style='warm', frame='darkwood:1', sill=None)
    # Brass handle & 'OPEN' plaque
    cv.vline(65, 83, 86, col('yellow', 5))
    cv.rect(57, 85, 63, 88, col('cream', 5))
    cv.hline(58, 62, 86, col('red', 3))

    # Sidewalk potted fern & coffee menu board
    cv.planter_box(70, 84, 78, 93, flower='white:6', pot_ramp='brick')
    cv.planter_box(5, 88, 16, 94, flower='red:4', pot_ramp='brick')
    draw_stone_threshold(cv, 0, h - 3, w, h=3)
    cv.edge_finish(top_y=26)


# ---------------------------------------------------------------------------
# Building 5: mf-bldg-jp_wagashi_gable (96x96)
# ---------------------------------------------------------------------------

def draw_jp_wagashi_gable(cv):
    w, h = cv.w, cv.h  # 96x96
    cx = w // 2  # 48

    # 1. Wide sweeping dark kawara gable/hipped roof (y 0..36)
    # Sweeping side tiled wings behind/beside the triangular gable
    for y in range(16, 36):
        ry = y - 16
        # Tapered upper hip/gable flare
        span = min(48, 22 + int(ry * 1.45))
        lx0, lx1 = max(0, cx - span), min(w, cx + span)
        ci = ry // 4
        yy = ry % 4
        for x in range(lx0, lx1):
            rib = x % 3
            r = hsh(x // 3, ci, 501)
            if yy == 3 or rib == 2:
                cv.p(x, y, col('kawara', 1))
            elif y >= 33:
                cv.p(x, y, col('kawara', 5 if (y == 33 and rib == 0) else (2 if y == 34 else 0)))
            else:
                t = 4 if rib == 0 else 3
                if r > 0.78:
                    t += 1
                cv.p(x, y, col('kawara', min(6, t)))
        cv.p(lx0, y, col('kawara', 0))
        cv.p(lx1 - 1, y, col('kawara', 0))

    # Central dramatic machiya front gable triangle (apex at cx, y=2 -> base y=35)
    for y in range(3, 35):
        dy = y - 3
        half_w = int(dy * 1.38) + 2
        x0 = max(0, cx - half_w)
        x1 = min(w - 1, cx + half_w)
        # Inner white plaster gable triangle (tsuma)
        inner_l = x0 + 5
        inner_r = x1 - 5
        if inner_r > inner_l:
            for x in range(inner_l, inner_r + 1):
                r = hsh(x, y, 502)
                cv.p(x, y, col('white', 5 if r > 0.35 else 4))
        # Thick bargeboard roof slopes (hafu) with white plaster edging & kawara cap
        for dx in range(5):
            c_l = col('kawara', (0, 5, 4, 2, 0)[dx])
            c_r = col('kawara', (0, 3, 2, 1, 0)[dx])
            if x0 + dx < w:
                cv.p(x0 + dx, y, c_l)
            if x1 - dx >= 0:
                cv.p(x1 - dx, y, c_r)
        # Crisp white bargeboard underside highlight
        if inner_l < w and y >= 7:
            cv.p(inner_l, y, col('white', 6))
        if inner_r >= 0 and y >= 7:
            cv.p(inner_r, y, col('coolwhite', 3))

    # Dark timber gable truss framing (koya-gumi) inside white triangle
    cv.rect(cx - 2, 11, cx + 2, 34, col('darkwood', 2))
    cv.hline(cx - 18, cx + 18, 22, col('darkwood', 2))
    cv.hline(cx - 18, cx + 18, 23, col('darkwood', 0))
    cv.hline(cx - 32, cx + 32, 31, col('darkwood', 2))
    cv.hline(cx - 32, cx + 32, 32, col('darkwood', 0))
    # Traditional small diamond/slatted attic vent in gable
    cv.outline_box(cx - 5, 16, cx + 5, 22, col('darkwood', 1), col('darkwood', 0))
    for vx in range(cx - 3, cx + 4, 2):
        cv.vline(vx, 17, 21, col('wood', 4))
    # Ornate top onigawara finial at gable apex
    cv.outline_box(cx - 3, 0, cx + 4, 6, col('kawara', 4), col('kawara', 0), top_hi=col('kawara', 7))
    cv.p(cx, 2, col('white', 5))
    # Crisp horizontal eave line across bottom of roof
    cv.hline(0, w, 34, col('kawara', 1))
    cv.hline(0, w, 35, col('kawara', 0))
    for x in range(1, w - 1, 3):
        cv.p(x, 34, col('kawara', 5))

    # 2. 2F white plaster wall with dark timber posts & small lattice windows (y 36..57)
    draw_plaster_wall(cv, 3, 36, w - 3, 57, ramp='white', base_i=5, seed=503)
    # Dark timber posts (shinkabe framing)
    for px in (1, 14, 31, 63, 80, w - 3):
        cv.rect(px, 36, px + 2, 57, col('darkwood', 2))
    cv.hline(1, w - 1, 38, col('darkwood', 1))
    cv.hline(1, w - 1, 55, col('darkwood', 2))
    cv.hline(1, w - 1, 56, col('darkwood', 0))
    # Small traditional mushiko-mado lattice windows on left & right bays
    draw_koshi_window(cv, 17, 41, 29, 52, frame='darkwood:0', bar='darkwood:3', warm=True, sill=True, spacing=3)
    draw_koshi_window(cv, 67, 41, 79, 52, frame='darkwood:0', bar='darkwood:3', warm=True, sill=True, spacing=3)
    # Centered traditional wooden wagashi plaque ('菓子') flanked by little lanterns
    cv.outline_box(33, 39, 63, 54, col('darkwood', 2), col('darkwood', 0), top_hi=col('wood', 5))
    cv.outline_box(35, 41, 61, 52, col('cream', 6), col('wood', 2))
    draw_glyph_text(cv, '菓子', 38, 42, 'darkwood:0', spacing=2)
    draw_chochin(cv, 8, 41, ramp='orange', h=8, lit=True)
    draw_chochin(cv, w - 9, 41, ramp='orange', h=8, lit=True)

    # 3. Wide sweeping inter-story dark kawara hisashi roof (y 57..66)
    draw_hisashi_eave(cv, 0, 57, w, 66, ramp='kawara', seed=504)

    # 4. 1F wide dark-wood lattice storefront & colorful wagashi showcase (y 66..96)
    draw_wood_slats(cv, 2, 66, w - 2, h - 3, ramp='darkwood', base_i=3, step=2, seed=505)
    cv.rect(0, 66, 3, h, col('darkwood', 1))
    cv.rect(w - 3, 66, w, h, col('darkwood', 1))

    # Left 2/3: Wide warm backlit showcase of colorful wagashi confections (x 6..58, y 70..91)
    cv.outline_box(6, 70, 58, 91, col('yellow', 4), col('darkwood', 0), top_hi=col('wood', 5))
    # Warm backlit interior background
    for y in range(71, 90):
        for x in range(7, 57):
            cv.p(x, y, col('cream', 6) if y < 77 else col('yellow', 5 if y < 83 else 4))
    # Two tiered cedar display shelves inside showcase
    for sy in (78, 85):
        cv.hline(7, 57, sy, col('cedar', 3))
        cv.hline(7, 57, sy + 1, col('wood', 1))
    # Colorful wagashi trays (pink sakura mochi, green matcha, yellow kuri, red/white daifuku)
    trays_top = [(10, 'pink:4'), (18, 'green:4'), (26, 'yellow:5'), (34, 'white:6'), (42, 'pink:3'), (49, 'orange:4')]
    for tx, tc in trays_top:
        cv.rect(tx, 75, tx + 6, 78, col('darkwood', 2))
        cv.rect(tx + 1, 74, tx + 5, 77, tc)
        cv.p(tx + 2, 74, col('white', 6))
    trays_bot = [(10, 'cream:6'), (19, 'red:4'), (28, 'green:5'), (37, 'pink:4'), (46, 'yellow:4')]
    for tx, tc in trays_bot:
        cv.rect(tx, 82, tx + 7, 85, col('cedar', 2))
        cv.rect(tx + 1, 81, tx + 6, 84, tc)
        cv.p(tx + 3, 81, col('white', 6))
    # Crisp dark-wood glass framing mullions over showcase
    cv.vline(23, 71, 90, col('darkwood', 1))
    cv.vline(41, 71, 90, col('darkwood', 1))
    # Carved wooden apron panels below showcase
    cv.rect(6, 90, 58, h - 3, col('wood', 3))
    for kx in range(8, 57, 4):
        cv.vline(kx, 90, h - 3, col('darkwood', 1))

    # Right 1/3: Recessed sliding entrance draped with refined cream noren (x 62..87)
    draw_sliding_door(cv, 62, 68, 86, h - 3, ramp='wood', warm=True, panels=2, kick_h=7)
    draw_noren(cv, 61, 67, 87, 79, ramp='cream', panels=3, crest_col='red:3')
    # Standing wooden lantern box (andon) on far right
    draw_andon(cv, 87, 81, w=7, h=12)

    # Wide traditional cut-stone threshold across the entire machiya base
    draw_stone_threshold(cv, 0, h - 3, w, h=3)
    cv.edge_finish(top_y=36)


# ---------------------------------------------------------------------------
# Building 6: mf-bldg-jp_vinyl_records (80x112)
# ---------------------------------------------------------------------------

def draw_jp_vinyl_records(cv):
    w, h = cv.w, cv.h  # 80x112
    # 1. Flat roof with concrete parapet, potted plants, AC unit & rooftop TV/FM antenna (y 0..24)
    cv.flat_roof(0, 4, w, 24, deck_ramp='concrete', deck_i=3, para_ramp='concrete', seed=601, urethane_green=True)
    # Rooftop AC unit (left) & potted rooftop garden plants (center-left)
    cv.roof_ac(6, 10)
    cv.planter_box(20, 10, 34, 18, flower='yellow:5', pot_ramp='wood')
    cv.planter_box(38, 11, 49, 18, flower='pink:4', pot_ramp='brick')
    cv.foliage_cluster(26, 10, 4, 3, ramp='foliage', seed=602, blossom='yellow:5')
    # Tall metal FM/TV antenna mast on upper right rising into y 0..17
    cv.vline(64, 0, 18, col('steel', 4))
    cv.vline(65, 0, 18, col('steel', 1))
    cv.hline(56, 73, 2, col('steel', 5))
    cv.hline(58, 71, 5, col('steel', 4))
    cv.hline(60, 69, 8, col('steel', 3))
    cv.p(56, 1, col('steel', 6))
    cv.p(72, 1, col('steel', 6))
    cv.rect(61, 16, 68, 19, col('concrete', 5))  # antenna base block

    # 2. 2F corrugated steel facade (y 24..64) + continuous right stairwell wall backing (y 24..109)
    # Left/main building body x 0..62, recessed right stairwell bay x 62..80
    cv.siding_wall(0, 24, 62, 64, ramp='steel', base_i=4, horizontal=False, step=3, seed=603)
    # Upper stairwell wall above 2F landing (y 24..46) + dark tiled backing behind ALL stairs (y 46..109)
    cv.siding_wall(62, 24, w, 46, ramp='concrete', base_i=4, horizontal=True, step=4, seed=604)
    cv.tile_cladding(62, 46, w, h - 3, ramp='asphalt', base_i=3, cw=4, ch=4, seed=606)
    # Subtle recess shadow along left edge of stairwell bay & crisp cornice
    cv.vline(62, 46, h - 3, col('asphalt', 1))
    cv.vline(w - 1, 24, h - 3, col('asphalt', 0))
    # Steel corner trim & cornice line
    cv.vline(0, 24, 64, col('steel', 1))
    cv.vline(61, 24, 64, col('steel', 1))
    cv.hline(0, w, 24, col('steel', 1))

    # Big colorful horizontal indie signboard spanning 2F upper fascia (x 4..59, y 27..40)
    cv.outline_box(4, 27, 59, 40, col('navy', 2), col('ink', 0), top_hi=col('teal', 4), bot_sh=col('navy', 0))
    # Retro mustard-yellow & red accent stripe on sign
    cv.rect(5, 28, 58, 30, col('yellow', 4))
    cv.hline(5, 58, 38, col('red', 4))
    # Spinning vinyl LP disc icon on left of sign (cx=12, cy=34)
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            d2 = dx * dx + dy * dy
            if d2 <= 9:
                cv.p(12 + dx, 34 + dy, col('asphalt', 0 if d2 >= 5 else 2))
    cv.rect(11, 33, 14, 36, col('red', 4))
    cv.p(12, 34, col('yellow', 5))
    # Crisp 'VINYL' pixel lettering on signboard with bright highlight
    draw_glyph_text(cv, 'VINYL', 20, 31, 'yellow:5', spacing=2, shadow='ink:0')
    draw_glyph_text(cv, 'VINYL', 20, 31, 'white:6', spacing=2)
    # Restore warm yellow body on lower rows of VINYL for retro 2-tone neon sheen
    for y in range(33, 37):
        for x in range(20, 55):
            if cv.get(x, y) == col('white', 6):
                cv.p(x, y, col('yellow', 5 if y == 33 else 4))

    # 2F loft studio windows (y 44..59): listening room & cassette shelf silhouettes
    cv.window(7, 44, 29, 59, style='warm', frame='steel:0', sill='steel:5')
    cv.window(34, 44, 56, 59, style='glass', frame='steel:0', sill='steel:5')
    # Tiny band poster inside right 2F window
    cv.rect(38, 49, 44, 56, col('pink', 4))
    cv.rect(46, 51, 52, 56, col('yellow', 4))

    # 3. Inter-story bright mustard-yellow & teal retro striped awning (x 2..62, y 63..72)
    cv.awning(2, 63, 62, 72, ramp_a='yellow', ramp_b='teal', stripe_w=4)

    # 4. 1F indie record shopfront (y 72..112, left main bay x 0..62)
    cv.tile_cladding(0, 72, 62, h - 3, ramp='concrete', base_i=3, cw=5, ch=5, seed=605)
    cv.vline(61, 72, h - 3, col('steel', 1))

    # Wide backlit glass display window lined with colorful LP sleeves (x 5..37, y 75..104)
    cv.outline_box(5, 75, 37, 104, col('cream', 5), col('steel', 0), top_hi=col('teal', 4))
    # Warm sunlit record shop interior
    cv.rect(6, 76, 36, 103, col('cream', 4))
    cv.hline(6, 36, 76, col('wood', 2))
    # 3 rows of colorful square vinyl LP sleeves (5x5 each!)
    sleeve_cols = [
        'red:4', 'teal:4', 'yellow:4', 'blue:4', 'pink:4',
        'orange:4', 'green:4', 'navy:4', 'maple:4', 'teal:3',
        'yellow:5', 'red:3', 'blue:3', 'pink:3', 'orange:3',
    ]
    idx = 0
    for row_y in (79, 87, 95):
        cv.hline(6, 36, row_y + 6, col('wood', 2))  # wooden LP rail shelf
        for col_x in range(7, 34, 6):
            sc = sleeve_cols[idx % len(sleeve_cols)]
            idx += 1
            cv.outline_box(col_x, row_y, col_x + 5, row_y + 6, sc, col('darkwood', 1))
            cv.p(col_x + 2, row_y + 2, col('white', 6) if idx % 2 == 0 else col('yellow', 5))
            cv.p(col_x + 3, row_y + 3, col('ink', 0))
    # Subtle glass diagonal glint across display
    for gi in range(6):
        cv.p(8 + gi, 77 + gi, col('white', 6))

    # Sticker-covered recessed indie door (x 40..54, y 75..109)
    cv.outline_box(40, 75, 54, 109, col('teal', 2), col('ink', 0), top_hi=col('teal', 4))
    cv.window(42, 77, 52, 90, style='warm', frame='steel:1', sill=None)
    # Colorful band/label stickers plastered on lower half & frame!
    stickers = [
        (42, 92, 'yellow:5'), (45, 93, 'red:4'), (49, 92, 'white:6'),
        (43, 96, 'pink:4'), (47, 97, 'orange:4'), (50, 95, 'teal:5'),
        (42, 101, 'blue:4'), (46, 102, 'yellow:4'), (49, 100, 'red:5'),
        (43, 87, 'yellow:5'), (49, 86, 'pink:4'),
    ]
    for sx, sy, sc in stickers:
        cv.rect(sx, sy, sx + 3, sy + 2, sc)
    cv.p(51, 94, col('yellow', 5))  # brass doorknob

    # Sidewalk wooden bargain-bin vinyl crate on left
    cv.outline_box(6, 101, 20, 109, col('wood', 4), col('darkwood', 0), top_hi=col('cedar', 5))
    for rx, rc in ((8, 'red:4'), (10, 'yellow:5'), (12, 'teal:4'), (14, 'pink:4'), (16, 'blue:4')):
        cv.vline(rx, 98, 102, rc)

    draw_stone_threshold(cv, 0, h - 3, w, h=3)

    # 5. Exterior dark-steel side staircase drawn OVER continuous dark tiled wall backing,
    #    extending ALL THE WAY DOWN cleanly to the street baseline (y=111)!
    # 2F steel access door & upper landing (x 63..79, y 29..47)
    cv.door_wood(65, 29, 76, 44, ramp='teal', glass_top=True)
    # Upper landing safety rail behind landing edge
    cv.hline(63, 79, 38, col('steel', 5))
    cv.hline(63, 79, 39, col('steel', 1))
    cv.hline(63, 79, 41, col('steel', 3))
    # Upper steel landing deck
    cv.rect(62, 44, 79, 47, col('steel', 2))
    cv.hline(62, 79, 44, col('steel', 5))
    cv.hline(62, 79, 46, col('steel', 0))
    cv.hline(63, 79, 47, col('ink', 0))

    # Upper flight steel treads (y 49..73, 7 crisp treads every 4px)
    for sy in range(49, 75, 4):
        cv.hline(64, 78, sy, col('steel', 5))
        for tx in range(66, 77, 3):
            cv.p(tx, sy, col('steel', 6))
        cv.hline(64, 78, sy + 1, col('steel', 2))
        cv.hline(64, 78, sy + 2, col('ink', 0))

    # Mid-level exterior steel landing platform (y 76..80) with wall bracket
    cv.rect(62, 76, 79, 80, col('steel', 3))
    cv.hline(62, 79, 76, col('steel', 6))
    cv.hline(63, 78, 77, col('steel', 4))
    cv.hline(62, 79, 79, col('steel', 0))
    cv.hline(63, 79, 80, col('ink', 0))

    # Lower flight steel treads (y 82..106, 7 crisp treads) descending cleanly to ground step
    for sy in range(82, 108, 4):
        cv.hline(64, 78, sy, col('steel', 5))
        for tx in range(65, 77, 3):
            cv.p(tx, sy, col('steel', 6))
        cv.hline(64, 78, sy + 1, col('steel', 2))
        cv.hline(64, 78, sy + 2, col('ink', 0))

    # Grounded bottom entry step meeting street baseline (y=108..111)
    cv.rect(63, 108, 79, 111, col('stone', 4))
    cv.hline(63, 79, 108, col('steel', 6))
    cv.hline(63, 79, 109, col('stone', 5))
    cv.hline(63, 79, 110, col('stone', 2))
    cv.hline(62, 80, 111, col('ink', 0))

    # Continuous left & right steel stringers + tubular handrails (y 38..111)
    cv.vline(63, 38, 111, col('steel', 0))
    cv.vline(64, 38, 111, col('steel', 4))
    cv.vline(77, 38, 111, col('steel', 5))
    cv.vline(78, 38, 111, col('steel', 0))
    # Horizontal handrail brackets / baluster rivets along both rails
    for ry in range(44, 110, 8):
        cv.p(64, ry, col('steel', 6))
        cv.p(77, ry, col('steel', 6))
        cv.p(63, ry, col('ink', 0))
        cv.p(78, ry, col('ink', 0))
    # Steel anchor baseplates firmly grounded at street baseline y=110..111
    cv.rect(62, 110, 66, 112, col('steel', 1))
    cv.rect(76, 110, 80, 112, col('steel', 1))
    cv.p(64, 110, col('steel', 5))
    cv.p(77, 110, col('steel', 5))

    # Sidewalk poster A-frame tucked neatly beside the bottom step (x 55..63, y 100..110)
    draw_aframe_menu(cv, 55, 100, board_ramp='navy', frame_ramp='yellow')

    draw_drainpipe(cv, 1, 24, h - 3, ramp='steel')
    cv.edge_finish(top_y=24)


# ---------------------------------------------------------------------------
# Building 7: mf-bldg-jp_bike_repair (96x96)
# ---------------------------------------------------------------------------

def draw_jp_bike_repair(cv):
    w, h = cv.w, cv.h  # 96x96
    # 1. Reworked blue-grey standing-seam metal roof (y 0..25):
    #    crisp sunlit top ridge cap, clean top-to-bottom pitch gradient (zero red flecks),
    #    and dark shadowed eave overhang.
    for y in range(4, 22):
        ry = y - 4  # 0..17
        # Smooth top-to-bottom pitch shading band: sunlit upper -> mid -> deeper lower
        pitch_band = 0 if ry < 6 else (1 if ry < 12 else 2)
        for x in range(2, w - 2):
            rem = x % 5
            right_sh = 1 if x >= w - 5 else 0
            r = hsh(x // 5, ry // 4, 701)
            if y == 13:
                # Subtle horizontal metal lap seam across slope
                cv.p(x, y, col('tile', 2 if rem != 0 else 1))
            elif rem == 0:
                # Standing-seam rib shadow trough
                cv.p(x, y, col('tile', max(0, 2 - (1 if pitch_band >= 1 else 0) - right_sh)))
            elif rem == 1:
                # Sunlit standing-seam crest highlight
                crest = (6, 5, 4)[pitch_band]
                if y == 14:
                    crest = min(6, crest + 1)
                cv.p(x, y, col('tile', max(2, crest - right_sh)))
            elif rem == 4:
                # Soft rib right-side shadow bevel
                cv.p(x, y, col('tile', max(1, (3, 2, 2)[pitch_band] - right_sh)))
            else:
                # Flat blue-grey steel pan with clean top-to-bottom pitch gradient
                pan = (5, 4, 3)[pitch_band]
                if r > 0.82 and pitch_band < 2:
                    pan = min(6, pan + 1)
                elif r < 0.16:
                    pan = max(2, pan - 1)
                cv.p(x, y, col('tile', max(1, pan - right_sh)))

    # Crisp side metal gable verge flashing
    cv.vline(0, 0, 25, col('tile', 0))
    cv.vline(1, 1, 24, col('tile', 5))
    cv.vline(w - 2, 1, 24, col('tile', 1))
    cv.vline(w - 1, 0, 25, col('tile', 0))

    # Crisp sunlit top ridge cap (y 0..3)
    cv.hline(0, w, 0, col('tile', 0))
    cv.hline(1, w - 1, 1, col('tile', 6))
    for rx in range(2, w - 2, 5):
        cv.p(rx, 1, col('coolwhite', 5))
    cv.hline(1, w - 1, 2, col('tile', 4))
    cv.hline(1, w // 2, 2, col('tile', 5))
    cv.hline(1, w - 1, 3, col('tile', 1))

    # Small roof vent cap on upper-right with grounded slope shadow
    cv.outline_box(76, 6, 84, 13, col('steel', 4), col('steel', 0), top_hi=col('steel', 6))
    cv.hline(77, 85, 13, col('tile', 1))
    cv.vline(84, 7, 14, col('tile', 1))

    # Dark shadowed overhanging metal eave & gutter lip (y 22..24)
    cv.hline(1, w - 1, 22, col('tile', 4))
    for rx in range(1, w - 1, 5):
        cv.p(rx, 22, col('tile', 5))
    cv.hline(1, w - 1, 23, col('tile', 1))
    cv.hline(0, w, 24, col('tile', 0))

    # 2. 2F continuous warm shaded cream stucco wall (y 25..69) — NO cutout gap flanking the sign!
    draw_plaster_wall(cv, 2, 25, w - 2, 69, ramp='cream', base_i=5, seed=702, eave_shadow=True)
    # Deep eave overhang shadow cast onto upper 2F wall
    cv.hline(2, w - 2, 25, col('ink', 1))
    cv.hline(2, w - 2, 26, col('cream', 2))
    # Subtle warm shaded lower plaster fascia band behind & flanking the 自転車 sign (y 52..62)
    cv.stipple_rect(2, 52, w - 2, 63, 'cream', 4, 3, 5, seed=709, rate=0.20)
    cv.hline(2, w - 2, 52, col('cream', 2))
    cv.hline(2, w - 2, 57, col('cream', 3))
    # Crisp dark side outlines running continuously down the entire 2F facade
    cv.vline(0, 25, 69, col('stone', 0))
    cv.vline(1, 25, 69, col('cream', 3))
    cv.vline(w - 2, 25, 69, col('cream', 2))
    cv.vline(w - 1, 25, 69, col('stone', 0))

    # 2F sliding window behind balcony (left-center)
    cv.window(10, 29, 48, 46, style='glass', frame='steel:1', sill=None)
    # Narrow metal residential balcony with hanging laundry!
    cv.rect(6, 40, 54, 52, col('coolwhite', 3))
    cv.hline(6, 54, 40, col('steel', 5))
    cv.hline(6, 54, 41, col('steel', 1))
    for bx in range(6, 54, 3):
        cv.vline(bx, 41, 51, col('steel', 2))
    cv.hline(6, 54, 50, col('concrete', 5))
    cv.hline(6, 54, 51, col('concrete', 1))
    # Cast shadow beneath the 2F balcony slab onto the warm cream wall below
    cv.hline(6, 55, 52, col('ink', 1))
    cv.hline(6, 55, 53, col('cream', 2))
    cv.hline(7, 54, 54, col('cream', 3))
    # Laundry pole & colorful clothes hanging over balcony
    cv.hline(9, 51, 35, col('steel', 5))
    cv.rect(12, 36, 19, 44, col('white', 6))  # white shirt
    cv.hline(12, 19, 43, col('coolwhite', 3))
    cv.rect(22, 36, 29, 45, col('blue', 4))  # blue towel
    cv.hline(22, 29, 44, col('blue', 2))
    cv.rect(33, 36, 39, 43, col('yellow', 5))  # yellow tee
    cv.rect(42, 36, 48, 44, col('pink', 4))  # pink cloth

    # 2F right side: compact window, AC unit (right), and UNCLIPPED hanging bike-wheel emblem above sign!
    cv.window(57, 28, 72, 38, style='blinds', frame='steel:1', sill='concrete:5')
    draw_ac_unit(cv, 81, 32, pipe_y1=62)
    # Small exterior junction box & wall conduit on right side of fascia beside sign
    cv.outline_box(76, 53, 83, 60, col('concrete', 4), col('steel', 1), top_hi=col('concrete', 6))
    cv.p(79, 56, col('red', 4))
    cv.hline(77, 83, 60, col('cream', 2))

    # Cleanly unclipped hanging metal bicycle-wheel emblem centered at (73, 44), radius 4 (y 40..48)
    # Iron wall bracket & hanging hook above wheel (y 38..40)
    cv.hline(71, 76, 38, col('steel', 1))
    cv.vline(73, 38, 41, col('steel', 2))
    # Subtle soft drop shadow on cream wall behind wheel
    for dy in range(-4, 5):
        for dx in range(-4, 5):
            d2 = dx * dx + dy * dy
            if 10 <= d2 <= 17:
                cv.p(74 + dx, 45 + dy, col('cream', 2))
    # Wheel tire, thin spokes & bright hub with airy cream wall showing between spokes (2px clear above sign!)
    for dy in range(-4, 5):
        for dx in range(-4, 5):
            d2 = dx * dx + dy * dy
            if 11 <= d2 <= 17:
                cv.p(73 + dx, 44 + dy, col('asphalt', 0))
            elif d2 < 11 and (dx == 0 or dy == 0):
                cv.p(73 + dx, 44 + dy, col('steel', 4))
    cv.p(71, 41, col('steel', 3))  # subtle top-left tire rim sheen
    cv.p(73, 44, col('steel', 6))  # bright hub center

    # 3. Inter-story navy signboard ('自転車') with crisp inner frame + red & blue striped canopy
    cv.outline_box(15, 50, 67, 64, col('navy', 2), col('ink', 0), top_hi=col('blue', 4))
    cv.outline_box(17, 52, 65, 62, col('navy', 1), col('blue', 3))
    draw_glyph_text(cv, '自転車', 25, 53, 'white:6', spacing=3, shadow='ink:0')
    cv.vline(67, 51, 64, col('cream', 2))  # subtle right cast shadow of sign onto cream wall
    # Red & blue striped shop canopy spanning the cycle workshop
    cv.awning(2, 62, w - 2, 69, ramp_a='red', ramp_b='blue', stripe_w=4)

    # 4. 1F wide open rolled-up shutter garage bay + right shop door (y 69..96)
    cv.tile_cladding(0, 69, w, h - 2, ramp='concrete', base_i=4, cw=4, ch=4, seed=703)
    # Wide open garage workshop bay (x 6..66, y 69..94)
    cv.outline_box(5, 68, 67, 94, col('wood', 2), col('steel', 0))
    # Rolled-up corrugated steel shutter coil tucked at top of bay (y 69..73)
    for sy in range(69, 73):
        cv.hline(6, 66, sy, col('steel', 5 if sy % 2 == 0 else 2))
    cv.hline(6, 66, 73, col('ink', 0))

    # Warm lit workshop interior (y 74..93)
    for y in range(74, 94):
        for x in range(6, 66):
            if y < 84:
                cv.p(x, y, col('cream', 4 if y < 78 else 5))
            else:
                cv.p(x, y, col('concrete', 3 if (x + y) % 2 == 0 else 4))
    # Warm overhead workshop lamp glow
    cv.hline(18, 52, 74, col('yellow', 5))
    cv.hline(20, 50, 75, col('white', 6))

    # Hanging spare bicycle tires on back wall (left-center)
    for tcx in (14, 23):
        for dy in range(-3, 4):
            for dx in range(-3, 4):
                d2 = dx * dx + dy * dy
                if 5 <= d2 <= 10:
                    cv.p(tcx + dx, 80 + dy, col('asphalt', 0))
    # Pegboard with hanging silver wrenches/tools (center)
    cv.outline_box(30, 76, 46, 85, col('wood', 3), col('darkwood', 1))
    for tx in (32, 35, 38, 41, 44):
        cv.vline(tx, 77, 83, col('steel', 5))
        cv.p(tx, 78, col('red', 4) if tx % 2 == 0 else col('blue', 4))
    # Blue repair stand holding a spare bike frame inside right of bay
    cv.vline(54, 78, 86, col('blue', 3))
    cv.hline(50, 61, 80, col('teal', 4))
    cv.hline(51, 59, 81, col('teal', 2))
    # Warm lit wooden workbench with vise & red toolbox (center-right inside bay)
    cv.outline_box(31, 85, 62, 92, col('cedar', 4), col('darkwood', 1), top_hi=col('cedar', 6))
    cv.rect(49, 82, 56, 85, col('red', 3))
    cv.hline(50, 55, 82, col('red', 5))
    cv.rect(35, 83, 39, 85, col('steel', 2))
    cv.rect(41, 83, 45, 85, col('yellow', 4))  # oil bottle & parts tray

    # Right side: small shop door & red floor air pump
    cv.door_glass(72, 71, 88, 94, frame='steel:1', warm=True)
    cv.vline(90, 84, 93, col('red', 4))
    cv.hline(89, 92, 84, col('steel', 5))
    cv.hline(89, 92, 93, col('steel', 1))

    # Parked customer bicycle outside on left foreground!
    draw_bicycle(cv, 7, 84, frame_ramp='red')
    # Second customer wheel / oil cans beside workbench edge
    cv.rect(63, 88, 67, 94, col('blue', 4))
    cv.hline(63, 67, 88, col('yellow', 5))

    draw_stone_threshold(cv, 0, h - 2, w, h=2)
    draw_drainpipe(cv, 1, 25, h - 2, ramp='steel')
    cv.edge_finish(top_y=25)


# ---------------------------------------------------------------------------
# Building 8: mf-bldg-jp_flower_greenhouse (96x96)
# ---------------------------------------------------------------------------

def draw_jp_flower_greenhouse(cv):
    w, h = cv.w, cv.h  # 96x96
    split_x = 56

    # 1. Split Roof: Left terracotta tile roof (0..56) + Right foreshortened top-3/4 sloped glass conservatory roof (56..96)
    draw_kawara_roof(cv, 0, 0, split_x + 2, 28, ramp='rooftile', moss=0.05, onigawara=True, seed=801)
    # Right sloped glass conservatory roof plane (y 4..28):
    # Hipped right edge tapers cleanly from x=89 at ridge (y=5) out to x=95 at eave (y=25),
    # with bright sky-reflection gradient, crisp aluminum ridge bar & angled roof ribs!
    ridge_r = w - 7  # 89
    for y in range(7, 25):
        ry = y - 7  # 0..17
        right_x = min(w - 1, ridge_r + int(round((y - 5) * 6 / 20.0)))
        for x in range(split_x, right_x + 1):
            rx = x - split_x
            # Lighter sky-reflection top-to-bottom gradient across the sloped glass plane
            if ry < 5:
                sky_c = col('white', 6) if ((rx + ry) % 10 in (1, 2, 3)) else col('glass', 6)
            elif ry < 11:
                sky_c = col('glass', 6) if ((rx + ry) % 9 in (0, 1, 2)) else col('glass', 5)
            else:
                r = hsh(rx // 2, ry // 2, 802)
                if (rx + ry) % 9 in (0, 1):
                    sky_c = col('glass', 6)
                elif ry >= 13 and r > 0.62:
                    sky_c = col('foliage', 5 if r > 0.80 else 4)  # sunlit upper canopy misted through roof glass
                else:
                    sky_c = col('glass', 5 if ry < 14 else 4)
            cv.p(x, y, sky_c)

    # Foreshortened horizontal aluminum roof purlins (tighter spacing near top -> deeper near eave)
    for py in (12, 18):
        p_rx = min(w - 1, ridge_r + int(round((py - 5) * 6 / 20.0)))
        cv.hline(split_x + 1, p_rx, py, col('coolwhite', 5))
        cv.hline(split_x + 1, p_rx, py + 1, col('steel', 2))

    # Foreshortened angled aluminum glazing ribs radiating subtly from ridge down to eave
    rib_specs = [
        (split_x, split_x),
        (64, 65),
        (72, 75),
        (80, 85),
    ]
    for rx0, rx1 in rib_specs:
        for y in range(7, 25):
            t = (y - 7) / 17.0
            xx = int(round(rx0 + (rx1 - rx0) * t))
            cv.p(xx, y, col('white', 6))
            cv.p(xx + 1, y, col('steel', 2))

    # Crisp angled right hip rafter framing the sloped glass conservatory plane
    for y in range(5, 26):
        ex = min(w - 1, ridge_r + int(round((y - 5) * 6 / 20.0)))
        cv.p(ex - 2, y, col('coolwhite', 5))
        cv.p(ex - 1, y, col('white', 6))
        cv.p(ex, y, col('steel', 1))

    # Crisp sunlit aluminum ridge bar & subtle conservatory ridge cresting (y 3..7)
    for cx in range(split_x + 2, ridge_r, 5):
        cv.p(cx, 3, col('coolwhite', 5))
    cv.hline(split_x, ridge_r + 1, 4, col('steel', 1))
    cv.hline(split_x, ridge_r, 5, col('white', 6))
    for cx in range(split_x + 1, ridge_r, 4):
        cv.p(cx, 5, col('coolwhite', 5))
    cv.hline(split_x, ridge_r + 1, 6, col('coolwhite', 3))
    cv.hline(split_x, ridge_r + 1, 7, col('steel', 1))

    # Dark horizontal aluminum eave overhang separating roof slope from vertical glass walls (y 25..28)
    cv.hline(split_x, w, 25, col('coolwhite', 5))
    for rx in (split_x + 1, 65, 75, 85, w - 2):
        cv.p(rx, 25, col('white', 6))
    cv.hline(split_x, w, 26, col('steel', 2))
    cv.hline(split_x, w, 27, col('ink', 0))

    # 2. 2F Left sunlit white-wood studio (0..56) + Right tall glass conservatory bay (56..96)
    cv.siding_wall(2, 28, split_x, 56, ramp='white', base_i=5, horizontal=True, step=3, seed=803)
    cv.rect(0, 28, 2, 56, col('coolwhite', 2))
    # Charming studio window with flowerbox & hanging ivy basket
    cv.window(10, 33, 34, 48, style='warm', frame='wood:3', sill='white:6', curtain='green')
    cv.planter_box(11, 46, 33, 52, flower='pink:4', pot_ramp='brick')
    # Hanging floral basket on right of studio window
    cv.vline(44, 30, 35, col('wood', 2))
    cv.foliage_cluster(44, 38, 4, 3, ramp='foliage', seed=804, blossom='yellow:5')
    cv.rect(42, 40, 47, 43, col('brick', 4))

    # Right 2F Vertical Glass Conservatory Bay (x 56..95, y 28..64) — noticeably deeper tone than bright sloped roof!
    cv.outline_box(split_x, 28, w - 1, 64, col('glass', 3), col('white', 5))
    for y in range(29, 63):
        for x in range(split_x + 1, w - 2):
            rx = x - split_x
            if rx % 9 == 0:
                cv.p(x, y, col('white', 5))
            elif y in (41, 53):
                cv.p(x, y, col('white', 4))
            else:
                if (rx + y) % 11 in (0, 1):
                    cv.p(x, y, col('glass', 5))
                else:
                    cv.p(x, y, col('glass', 3 if y < 44 else 2))
    # Lush indoor palms & flowering trees visible inside 2F conservatory
    cv.foliage_cluster(68, 47, 7, 7, ramp='foliage', seed=805, blossom='pink:4')
    cv.foliage_cluster(84, 51, 6, 8, ramp='foliage', seed=806, blossom='yellow:5')
    # Re-draw crisp conservatory vertical aluminum mullions over plants so plants look behind glass!
    for mx in range(split_x, w, 9):
        cv.vline(mx, 28, 64, col('white', 5))
        cv.vline(mx + 1, 28, 64, col('steel', 2))
    cv.hline(split_x, w - 1, 41, col('white', 5))
    cv.hline(split_x, w - 1, 53, col('white', 5))
    cv.vline(w - 1, 28, 64, col('steel', 1))
    # Cast dark eave overhang shadow onto top of vertical conservatory glass walls (y 28..30)!
    cv.shade_rect(split_x, 28, w, 29, -2)
    cv.shade_rect(split_x, 29, w, 31, -1)
    cv.hline(split_x, w, 27, col('ink', 0))

    # 3. Inter-story sage-green awning + crisp wood-framed '花' sign plaque (y 49..66)
    cv.awning(2, 58, split_x + 1, 66, ramp_a='midori', ramp_b='cream', stripe_w=4)
    cv.outline_box(20, 49, 39, 65, col('wood', 4), col('darkwood', 0), top_hi=col('cedar', 6), bot_sh=col('wood', 2))
    cv.outline_box(22, 51, 37, 64, col('cream', 6), col('green', 1))
    draw_glyph_text(cv, '花', 25, 53, 'green:0')
    cv.hline(21, 39, 65, col('ink', 1))

    # 4. 1F sunlit florist storefront (y 66..96)
    cv.siding_wall(2, 66, split_x, h - 3, ramp='cream', base_i=5, horizontal=True, step=3, seed=807)
    cv.rect(0, 66, 2, h, col('wood', 2))

    # Wood-framed glass shop doors (center-left: x 30..52, y 67..93)
    cv.door_glass(30, 67, 52, h - 3, frame='wood:3', warm=True)
    # Overflowing tiered flower buckets on left sidewalk (x 3..29, y 72..93)
    # Tiered wooden display steps
    cv.rect(3, 78, 29, 93, col('wood', 3))
    cv.hline(3, 29, 78, col('cedar', 5))
    cv.hline(3, 29, 85, col('cedar', 5))
    # Top tier flower buckets (lavender/blue, yellow, pink, red)
    buckets_top = [(4, 'pink:4'), (10, 'yellow:5'), (16, 'red:4'), (22, 'navy:5')]
    for bx, fc in buckets_top:
        cv.foliage_cluster(bx + 2, 74, 3, 2, ramp='foliage', seed=810 + bx, blossom=fc)
        cv.p(bx + 1, 73, fc)
        cv.p(bx + 3, 74, fc)
        cv.p(bx + 2, 72, fc)
        cv.outline_box(bx, 76, bx + 5, 81, col('steel', 4), col('steel', 1), top_hi=col('steel', 6))
    # Bottom tier flower buckets overflowing right onto the pavement!
    buckets_bot = [(4, 'red:4'), (10, 'orange:4'), (16, 'pink:4'), (22, 'yellow:5')]
    for bx, fc in buckets_bot:
        cv.foliage_cluster(bx + 2, 83, 3, 2, ramp='foliage', seed=820 + bx, blossom=fc)
        cv.p(bx + 2, 82, fc)
        cv.p(bx + 1, 83, fc)
        cv.p(bx + 3, 83, fc)
        cv.outline_box(bx, 86, bx + 5, 93, col('brick', 4), col('brick', 1), top_hi=col('brick', 5))

    # Right 1F Conservatory ground bay (x 56..95, y 64..93)
    cv.brick_wall(split_x, 84, w - 1, h - 3, ramp='stone', base_i=4, course_h=3, brick_w=5, seed=808)
    cv.outline_box(split_x, 64, w - 1, 85, col('glass', 4), col('white', 5))
    cv.foliage_cluster(67, 76, 6, 5, ramp='foliage', seed=809, blossom='red:4')
    cv.foliage_cluster(82, 75, 7, 6, ramp='foliage', seed=811, blossom='yellow:5')
    for mx in range(split_x, w, 9):
        cv.vline(mx, 64, 85, col('white', 5))
    cv.vline(w - 1, 64, h - 3, col('stone', 1))
    # Terracotta pots & watering can in front of conservatory
    cv.planter_box(58, 86, 70, 93, flower='pink:4', pot_ramp='brick')
    cv.planter_box(73, 86, 86, 93, flower='navy:5', pot_ramp='brick')
    # Tiny green watering can on right
    cv.rect(88, 89, 93, 93, col('teal', 4))
    cv.hline(86, 89, 90, col('teal', 5))
    cv.p(93, 90, col('teal', 2))

    draw_stone_threshold(cv, 0, h - 3, w, h=3)
    cv.edge_finish(top_y=28)


# ---------------------------------------------------------------------------
# Building 9: mf-bldg-jp_secondhand_books (80x96)
# ---------------------------------------------------------------------------

def draw_jp_secondhand_books(cv):
    w, h = cv.w, cv.h  # 80x96
    # 1. Dark weathered kawara pitched roof with subtle moss & attic skylight (y 0..26)
    draw_kawara_roof(cv, 0, 0, w, 26, ramp='kawara', moss=0.08, onigawara=True,
                     skylight=(12, 11, 11, 8), seed=901)

    # 2. 2F aged cream stucco with tall mullioned windows & vertical signboard ('古本') (y 26..55)
    draw_plaster_wall(cv, 2, 26, w - 2, 55, ramp='cream', base_i=4, seed=902)
    # Dark wood corner trim & belt molding
    cv.rect(0, 26, 2, 55, col('darkwood', 2))
    cv.rect(w - 2, 26, w, 55, col('darkwood', 1))
    cv.hline(0, w, 54, col('wood', 2))

    # Two tall mullioned Jimbocho windows (books stacked along inside lower panes!)
    for wx in (8, 34):
        cv.window(wx, 31, wx + 20, 50, style='glass', frame='darkwood:1', sill='wood:4')
        # Tiny colorful book stacks visible behind lower window panes
        for bx, bc in ((wx + 2, 'red:3'), (wx + 5, 'yellow:4'), (wx + 8, 'blue:3'),
                       (wx + 12, 'cream:5'), (wx + 15, 'green:3')):
            cv.rect(bx, 44, bx + 2, 49, bc)
        # Re-draw crisp mullion cross
        cv.vline(wx + 10, 32, 49, col('darkwood', 1))
        cv.hline(wx + 1, wx + 19, 40, col('darkwood', 1))

    # Vertical vintage navy & cream signboard ('古本') on right edge of 2F/1F
    cv.outline_box(61, 29, 77, 57, col('navy', 2), col('ink', 0), top_hi=col('navy', 4), bot_sh=col('navy', 0))
    cv.outline_box(63, 31, 75, 55, col('navy', 1), col('cream', 5))
    draw_glyph_text(cv, '古本', 65, 33, 'cream:6', vertical=True, spacing=2, shadow='ink:0')

    # 3. Vintage navy scalloped awning across 1F storefront (y 55..64)
    cv.awning(2, 56, w - 2, 64, ramp_a='navy', ramp_b='blue', stripe_w=5)
    cv.hline(2, w - 2, 62, col('cream', 5))  # classic cream trim ribbon on awning edge

    # 4. 1F dark wood bookshop packed with colorful tiny book spines + recessed entrance (y 64..96)
    cv.rect(0, 64, w, h - 3, col('darkwood', 2))
    cv.vline(0, 64, h - 3, col('darkwood', 0))
    cv.vline(w - 1, 64, h - 3, col('darkwood', 0))

    spine_palette = [
        'red:4', 'cream:5', 'blue:4', 'yellow:4', 'green:4', 'orange:4',
        'teal:4', 'brick:4', 'white:5', 'navy:4', 'pink:4', 'cedar:5',
    ]

    def draw_bookshelf(bx0, by0, bx1, by1, s_seed):
        cv.outline_box(bx0, by0, bx1, by1, col('darkwood', 1), col('wood', 3), top_hi=col('wood', 5))
        shelf_h = 6
        sy = by0 + 1
        row_i = 0
        while sy + shelf_h <= by1 - 1:
            # Horizontal wooden shelf board
            cv.hline(bx0 + 1, bx1 - 1, sy + shelf_h - 1, col('wood', 4))
            # Pack vertical tiny colorful book spines
            x = bx0 + 1
            while x < bx1 - 1:
                bw = 2 if hsh(x, row_i, s_seed) > 0.65 and x + 2 < bx1 else 1
                bh = 4 if hsh(x, row_i, s_seed + 7) > 0.3 else 3
                ci = int(hsh(x, row_i, s_seed + 13) * len(spine_palette)) % len(spine_palette)
                cv.rect(x, sy + (shelf_h - 1 - bh), x + bw, sy + shelf_h - 1, spine_palette[ci])
                x += bw + (1 if hsh(x, row_i, s_seed + 19) > 0.78 else 0)
            sy += shelf_h
            row_i += 1

    # Left & right tall storefront bookshelves overflowing with books
    draw_bookshelf(4, 67, 27, 92, 910)
    draw_bookshelf(53, 67, 76, 92, 920)

    # Center warm recessed wooden entrance (x 29..51, y 66..93)
    cv.rect(28, 65, 52, h - 3, col('darkwood', 0))
    draw_sliding_door(cv, 30, 68, 50, h - 3, ramp='wood', warm=True, panels=2, kick_h=7)
    # Warm glowing overhead porch bulb inside recess
    cv.hline(38, 42, 66, col('yellow', 5))
    cv.p(40, 67, col('white', 6))

    # Sidewalk bargain book boxes / stools in front of shelves
    for bx in (6, 56):
        cv.outline_box(bx, 86, bx + 18, 93, col('wood', 4), col('darkwood', 0), top_hi=col('cedar', 5))
        for rx in range(bx + 2, bx + 16, 2):
            c_book = spine_palette[(rx + bx) % len(spine_palette)]
            cv.rect(rx, 83, rx + 2, 87, c_book)

    draw_stone_threshold(cv, 0, h - 3, w, h=3)
    draw_drainpipe(cv, 1, 26, h - 3, ramp='steel')
    cv.edge_finish(top_y=26)


# ---------------------------------------------------------------------------
# Building 10: mf-bldg-jp_bakery_terrace (112x112)
# ---------------------------------------------------------------------------

def draw_jp_bakery_terrace(cv):
    w, h = cv.w, cv.h  # 112x112
    wing_x = 58  # Left bakery house wing: 0..58, Right open-air 2F terrace: 58..112

    # 1. Left wing terracotta shingled pitched roof (x 0..60, y 0..33)
    draw_kawara_roof(cv, 0, 2, wing_x + 2, 33, ramp='rooftile', moss=0.05, onigawara=True, seed=1001)
    # Charming brick bakery oven chimney on upper left
    cv.brick_wall(9, 2, 19, 17, ramp='brick', base_i=4, course_h=3, brick_w=5, seed=1002)
    cv.outline_box(8, 0, 20, 4, col('stone', 5), col('brick', 0), top_hi=col('stone', 6))
    cv.hline(9, 19, 17, col('rooftile', 0))

    # 2. Left wing 2F warm cream European-Japanese facade (x 2..58, y 33..69)
    draw_plaster_wall(cv, 2, 33, wing_x, 69, ramp='kinari', base_i=4, seed=1003)
    # Warm stone/brick corner quoins on left edge
    for qy in range(33, 69, 5):
        qw = 5 if (qy // 5) % 2 == 0 else 3
        cv.rect(0, qy, qw, qy + 4, col('stone', 4))
        cv.hline(0, qw, qy + 4, col('stone', 1))
    # Right edge timber pilaster bordering terrace
    cv.rect(wing_x - 2, 33, wing_x + 1, 69, col('wood', 3))
    cv.vline(wing_x, 33, 69, col('darkwood', 0))

    # 2F charming shuttered bakery studio window + blooming flowerbox
    cv.outline_box(8, 39, 12, 55, col('red', 2), col('red', 0), top_hi=col('red', 3))
    cv.outline_box(30, 39, 34, 55, col('red', 2), col('red', 0), top_hi=col('red', 3))
    cv.window(12, 39, 30, 55, style='warm', frame='wood:2', sill='stone:5', curtain='cream')
    cv.planter_box(12, 53, 30, 59, flower='yellow:5', pot_ramp='brick')

    # Crisp terracotta-and-cream vertical 'パン' bakery signboard on 2F (matching Fable pan baseline)
    cv.p(41, 35, col('darkwood', 0))
    cv.p(51, 35, col('darkwood', 0))
    cv.outline_box(38, 36, 55, 64, col('brick', 3), col('darkwood', 0), top_hi=col('brick', 5), bot_sh=col('brick', 1))
    cv.outline_box(40, 38, 53, 62, col('brick', 2), col('cedar', 5))
    draw_glyph_text(cv, 'パン', 42, 41, 'cream:6', vertical=True, spacing=3, shadow='darkwood:0')
    cv.hline(39, 55, 64, col('kinari', 2))

    # 3. SPACIOUS 2F OPEN-AIR WOODEN CAFE TERRACE WITH TOP-3/4 SLATTED CEDAR PERGOLA ROOF (x 58..112, y 9..69)
    # Back plaster wall along north edge of terrace (y 25..40)
    draw_plaster_wall(cv, wing_x, 25, w - 2, 40, ramp='cream', base_i=4, seed=1004, eave_shadow=False)
    cv.vline(w - 2, 25, 40, col('cream', 2))
    cv.vline(w - 1, 25, 69, col('darkwood', 0))
    # Walkable oak floorboards & open front balustrade (y 39..69)
    cv.terrace_deck(wing_x, 39, w, 69, floor_ramp='floorwood', rail_ramp='wood', seed=1005)
    # French doorway opening onto terrace cleanly between pergola posts (x 65..76, y 30..44)
    cv.outline_box(65, 30, 76, 44, col('yellow', 4), col('wood', 1), top_hi=col('wood', 5))
    cv.vline(70, 31, 43, col('wood', 2))
    cv.hline(66, 75, 37, col('wood', 2))
    # Warm brass terrace wall sconce beside French doorway
    cv.outline_box(80, 33, 84, 37, col('yellow', 5), col('darkwood', 1))
    cv.p(81, 34, col('white', 6))

    # Cast pergola underside shadow over terrace back wall & dappled slat shadows across upper floorboards
    cv.shade_rect(wing_x + 1, 26, w - 1, 30, -2)
    cv.shade_rect(wing_x + 1, 30, w - 1, 33, -1)
    # Subtle dappled cross-rafter cast shadows across upper terrace floorboards (y 39..46)
    for sx in range(wing_x + 2, w - 3, 7):
        cv.shade_rect(sx, 39, sx + 3, 45, -1)

    # Two charming bistro tables with chairs & pastries on the sunlit terrace deck!
    draw_bistro_table(cv, 73, 47, cloth_ramp='white')
    draw_bistro_table(cv, 96, 48, cloth_ramp='cream')

    # Lush potted greenery in terrace corners (grounded cleanly on deck)
    cv.foliage_cluster(63, 52, 3, 4, ramp='foliage', seed=1006, blossom='pink:4')
    cv.outline_box(61, 54, 66, 58, col('brick', 4), col('brick', 1))
    cv.foliage_cluster(105, 41, 3, 3, ramp='foliage', seed=1007, blossom='yellow:5')
    cv.outline_box(103, 43, 108, 47, col('brick', 4), col('brick', 1))

    # Sturdy cedar pergola support posts rising from terrace deck to pergola fascia (y 25..68)
    for px in (wing_x, 84, w - 4):
        cv.rect(px, 25, px + 3, 68, col('wood', 3))
        cv.vline(px, 25, 68, col('cedar', 5))
        cv.vline(px + 2, 25, 68, col('darkwood', 0))

    # PROPER TOP-3/4 SLATTED CEDAR PERGOLA ROOF OVERHANG (x 57..112, y 9..26)
    # Shaded recessed trellis underside between open cedar slats (grounded volume, no floating blobs!)
    for y in range(10, 24):
        for x in range(wing_x, w - 1):
            r = hsh(x // 2, y // 2, 1015)
            # Deep shaded underside under pergola with subtle dappled warmth
            cv.p(x, y, col('darkwood', 1 if y < 16 else 2) if r > 0.25 else col('wood', 1))

    # Sunlit horizontal cedar purlin slats receding in top-3/4 depth (y 11, 14, 17, 20)
    for idx_s, sy in enumerate((11, 14, 17, 20)):
        hi_c = col('cedar', 6 if idx_s < 2 else 5)
        mid_c = col('cedar', 4 if idx_s < 2 else 3)
        cv.hline(wing_x, w - 1, sy, hi_c)
        cv.hline(wing_x, w - 1, sy + 1, mid_c)
        cv.hline(wing_x, w - 1, sy + 2, col('darkwood', 1))

    # Receding top-3/4 front-to-back cedar cross-rafters (spaced every 7px across terrace width)
    for rx in range(wing_x + 1, w - 2, 7):
        for y in range(10, 26):
            top_sun = 6 if y < 17 else 5
            cv.p(rx, y, col('cedar', top_sun))
            cv.p(rx + 1, y, col('cedar', 4 if y < 18 else 3))
            cv.p(rx + 2, y, col('darkwood', 1))
        # Sculpted projecting rafter tail jutting 1px below front fascia
        cv.p(rx, 26, col('wood', 4))
        cv.p(rx + 1, 26, col('wood', 2))
        cv.p(rx + 2, 26, col('darkwood', 0))

    # Rear pergola ledger beam (y 9..11) & right side fascia verge beam
    cv.hline(wing_x - 1, w, 9, col('darkwood', 0))
    cv.hline(wing_x, w - 1, 10, col('cedar', 6))
    cv.hline(wing_x, w - 1, 11, col('wood', 3))
    cv.rect(w - 3, 10, w - 1, 26, col('wood', 3))
    cv.vline(w - 3, 10, 25, col('cedar', 5))
    cv.vline(w - 1, 9, 26, col('darkwood', 0))
    # Left ledger tie-in beam cleanly joining main house terracotta roof/wall
    cv.vline(wing_x - 1, 9, 26, col('darkwood', 0))
    cv.vline(wing_x, 10, 25, col('cedar', 5))

    # Heavy horizontal front pergola fascia beam (y 23..26) + underside shadow rim
    cv.hline(wing_x - 1, w, 23, col('cedar', 6))
    cv.hline(wing_x - 1, w, 24, col('cedar', 4))
    cv.hline(wing_x - 1, w, 25, col('wood', 1))
    cv.hline(wing_x - 1, w, 26, col('darkwood', 0))
    # Re-apply sculpted rafter tails on front face y=24..26
    for rx in range(wing_x + 1, w - 2, 7):
        cv.p(rx, 24, col('cedar', 5))
        cv.p(rx + 1, 25, col('wood', 3))
        cv.p(rx, 26, col('wood', 4))
        cv.p(rx + 1, 26, col('wood', 2))

    # Restrained climbing ivy & tiny rose blossoms twining along right corner post & eave corner
    # (keeps sunlit slatted cedar pergola rafters clearly readable!)
    draw_ivy_vine(cv, 108, 22, 65, spread=3, seed=1011)
    cv.foliage_cluster(105, 19, 4, 3, ramp='foliage', seed=1010, blossom='pink:4')
    cv.foliage_cluster(62, 22, 3, 2, ramp='foliage', seed=1008, blossom='white:6')

    # Warm cafe fairy string lights draped cleanly beneath front pergola fascia!
    for lx, ly in ((65, 27), (71, 28), (77, 28), (82, 27), (89, 27), (95, 28), (101, 28), (106, 27)):
        cv.p(lx, ly - 1, col('ink', 1))
        cv.p(lx, ly, col('yellow', 5))
    # Cascading flowers along terrace front balustrade
    cv.planter_box(68, 59, 82, 64, flower='red:4', pot_ramp='brick')
    cv.planter_box(88, 59, 103, 64, flower='pink:4', pot_ramp='brick')

    # 4. Inter-story crimson & cream striped awning spanning full 1F boulangerie (y 69..78)
    cv.awning(2, 69, w - 2, 78, ramp_a='red', ramp_b='cream', stripe_w=4)

    # 5. 1F warm stone & brick storefront (y 78..112)
    cv.brick_wall(0, 78, w, h - 4, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=1012)
    # Warm stone piers & plinth framing the boulangerie bays
    for px in (0, 44, 68, w - 5):
        cv.brick_wall(px, 78, px + 5, h - 4, ramp='stone', base_i=4, course_h=4, brick_w=5, seed=1013 + px)
        cv.vline(px, 78, h - 4, col('stone', 1))
    # Re-apply awning drop shadow onto brick
    cv.hline(2, w - 2, 78, col('ink', 0))
    cv.hline(2, w - 2, 79, col('ink', 1))

    # Left bay: wide glowing golden-amber bread showcase window (x 7..42, y 81..104)
    cv.outline_box(7, 81, 42, 104, col('yellow', 4), col('darkwood', 0), top_hi=col('wood', 5))
    cv.rect(8, 82, 41, 103, col('yellow', 5))
    cv.hline(8, 41, 82, col('orange', 3))
    # Wooden bakery shelves inside showcase (3 tiers)
    for sy in (89, 96, 102):
        cv.hline(8, 41, sy, col('wood', 3))
        cv.hline(8, 41, sy + 1, col('darkwood', 1))
    # Rows of golden pixel breads: boules, croissants, baguettes, brioche!
    for bx in range(10, 38, 6):
        # Round golden boules on top shelf
        cv.rect(bx, 86, bx + 4, 89, col('orange', 4))
        cv.hline(bx + 1, bx + 3, 85, col('yellow', 5))
        cv.p(bx + 2, 86, col('cream', 6))  # flour scoring dust
    for bx in range(10, 38, 7):
        # Croissants & rolls on middle shelf
        cv.rect(bx, 93, bx + 5, 96, col('cedar', 4))
        cv.hline(bx + 1, bx + 4, 92, col('orange', 4))
        cv.p(bx + 2, 93, col('yellow', 5))
    # Tall woven baguette basket on lower right of showcase
    cv.rect(32, 97, 39, 102, col('cedar', 3))
    for bgx in (33, 35, 37):
        cv.vline(bgx, 93, 98, col('orange', 4))
        cv.p(bgx, 93, col('yellow', 5))
    # Small pastry tarts on lower left
    for bx in (10, 16, 22, 27):
        cv.rect(bx, 99, bx + 4, 102, col('cream', 5))
        cv.p(bx + 1, 99, col('red', 4))
        cv.p(bx + 2, 99, col('yellow', 5))
    # Crisp timber window mullions & stone sill
    cv.vline(24, 82, 103, col('wood', 2))
    cv.hline(6, 43, 104, col('stone', 5))

    # Center bay: warm wood-and-glass bakery entrance door (x 50..66, y 81..108)
    cv.door_wood(50, 81, 66, h - 4, ramp='wood', glass_top=True)
    cv.window(52, 83, 64, 95, style='warm', frame='darkwood:1', sill=None)
    # Cozy 'OPEN' plaque & brass pull
    cv.rect(55, 91, 61, 94, col('cream', 6))
    cv.hline(56, 60, 92, col('red', 3))
    cv.vline(63, 96, 99, col('yellow', 5))

    # Right bay beneath terrace: cozy brick-framed cafe window + chalkboard menu + planters (x 75..105)
    cv.window(75, 82, 98, 99, style='warm', frame='wood:2', sill='stone:5', curtain='red')
    # Sidewalk bakery chalkboard A-frame menu & overflowing planter box
    draw_aframe_menu(cv, 98, 98, board_ramp='asphalt', frame_ramp='cedar')
    cv.planter_box(75, 101, 94, 108, flower='red:4', pot_ramp='brick')
    cv.planter_box(8, 104, 24, 109, flower='yellow:5', pot_ramp='stone')

    # Solid cut-stone foundation base
    draw_stone_threshold(cv, 0, h - 4, w, h=4)
    cv.edge_finish(top_y=33)


# ---------------------------------------------------------------------------
# Pack 03 Spec Table & Batch Builder
# ---------------------------------------------------------------------------

SPECS = [
    {
        'id': 'mf-bldg-jp_ramen_shop',
        'name': '일본 골목 라멘집 (2층)',
        'category': 'jp-shotengai',
        'w': 5, 'h': 6,
        'passableTopRows': 2,
        'tags': ['jp-shotengai', 'restaurant', 'ramen', 'noren', 'lantern', 'kawara'],
        'fn': draw_jp_ramen_shop,
    },
    {
        'id': 'mf-bldg-jp_sushi_bar',
        'name': '히노키 스시야 (2층)',
        'category': 'jp-shotengai',
        'w': 5, 'h': 6,
        'passableTopRows': 2,
        'tags': ['jp-shotengai', 'restaurant', 'sushi', 'hinoki', 'ibushi', 'noren'],
        'fn': draw_jp_sushi_bar,
    },
    {
        'id': 'mf-bldg-jp_izakaya_corner',
        'name': '목조 코너 이자카야 (2층)',
        'category': 'jp-shotengai',
        'w': 6, 'h': 6,
        'passableTopRows': 2,
        'tags': ['jp-shotengai', 'tavern', 'izakaya', 'lantern', 'balcony', 'midori'],
        'fn': draw_jp_izakaya_corner,
    },
    {
        'id': 'mf-bldg-jp_kissaten_cafe',
        'name': '쇼와 벽돌 킷사텐 카페 (2층)',
        'category': 'jp-shotengai',
        'w': 5, 'h': 6,
        'passableTopRows': 2,
        'tags': ['jp-shotengai', 'cafe', 'kissaten', 'brick', 'stained-glass', 'showa'],
        'fn': draw_jp_kissaten_cafe,
    },
    {
        'id': 'mf-bldg-jp_wagashi_gable',
        'name': '마치야 화과자점 (박공 2층)',
        'category': 'jp-shotengai',
        'w': 6, 'h': 6,
        'passableTopRows': 2,
        'tags': ['jp-shotengai', 'sweets', 'wagashi', 'machiya', 'gable', 'kawara'],
        'fn': draw_jp_wagashi_gable,
    },
    {
        'id': 'mf-bldg-jp_vinyl_records',
        'name': '시모키타자와 바이닐 레코드샵 (2.5층)',
        'category': 'jp-shotengai',
        'w': 5, 'h': 7,
        'passableTopRows': 2,
        'tags': ['jp-shotengai', 'music', 'vinyl', 'records', 'shimokitazawa', 'flat-roof'],
        'fn': draw_jp_vinyl_records,
    },
    {
        'id': 'mf-bldg-jp_bike_repair',
        'name': '동네 자전거 수리 공방 (2층)',
        'category': 'jp-shotengai',
        'w': 6, 'h': 6,
        'passableTopRows': 2,
        'tags': ['jp-shotengai', 'workshop', 'bicycle', 'shutter', 'balcony', 'tin-roof'],
        'fn': draw_jp_bike_repair,
    },
    {
        'id': 'mf-bldg-jp_flower_greenhouse',
        'name': '온실 플라워 샵 (2층)',
        'category': 'jp-shotengai',
        'w': 6, 'h': 6,
        'passableTopRows': 2,
        'tags': ['jp-shotengai', 'florist', 'greenhouse', 'conservatory', 'flowers'],
        'fn': draw_jp_flower_greenhouse,
    },
    {
        'id': 'mf-bldg-jp_secondhand_books',
        'name': '진보초 헌책방 (2층)',
        'category': 'jp-shotengai',
        'w': 5, 'h': 6,
        'passableTopRows': 2,
        'tags': ['jp-shotengai', 'bookstore', 'jimbocho', 'books', 'kawara'],
        'fn': draw_jp_secondhand_books,
    },
    {
        'id': 'mf-bldg-jp_bakery_terrace',
        'name': '테라스 불랑주리 베이커리 (2층)',
        'category': 'jp-shotengai',
        'w': 7, 'h': 7,
        'passableTopRows': 2,
        'tags': ['jp-shotengai', 'bakery', 'boulangerie', 'terrace', 'pergola', 'cafe'],
        'fn': draw_jp_bakery_terrace,
    },
]


def build_pack():
    out_dir = os.path.join(OUT_ROOT, 'buildings', 'pack03_jp_shotengai')
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
            'pixelSize': [pw, ph],
            'passableTopRows': spec['passableTopRows'],
            'tags': spec['tags'],
        })

    manifest_path = os.path.join(out_dir, 'manifest.json')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump({'batch': 'pack03_jp_shotengai', 'kind': 'buildings', 'items': items},
                  f, ensure_ascii=False, indent=2)
    print(f'pack03_jp_shotengai: generated {len(items)} buildings -> {out_dir}')
    return items


if __name__ == '__main__':
    build_pack()
