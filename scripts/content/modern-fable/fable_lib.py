#!/usr/bin/env python3
"""Fable-baseline modern pixel-art library (strictly locked to tiledata/jp-city/fable-city/palette.json).

All 100 modern objects, 100 modern buildings, and ground/street tiles draw through this library so:
  - 0 off-palette pixels (100% locked to Fable 6-8 step ramps),
  - Consistent top-3/4 camera angle (visible sunlit top planes, subtle warm-violet ink outlines, soft cast shadows),
  - Rich organic pixel texture (stipple, masonry, brick, tile, woodgrain, glass reflections, backlit windows, signage).
"""
import json
import os
import zlib
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
PAL_PATH = os.path.join(REPO, 'tiledata', 'jp-city', 'fable-city', 'palette.json')
GLYPHS_PATH = os.path.join(REPO, 'tiledata', 'jp-city', 'fable-city', 'glyphs9.json')
OUT_ROOT = os.path.join(REPO, 'tiledata', 'modern-fable')

_PAL = None
_RGB_SET = None
_RAMP_IDX = None
_GLYPHS = None


def _hx(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def load_palette():
    global _PAL, _RGB_SET, _RAMP_IDX
    if _PAL is None:
        raw = json.load(open(PAL_PATH, encoding='utf-8'))['ramps']
        _PAL = {k: [_hx(c) for c in v] for k, v in raw.items()}
        _RGB_SET = {c for cols in _PAL.values() for c in cols}
        _RAMP_IDX = {}
        for rname, cols in _PAL.items():
            for idx, c in enumerate(cols):
                _RAMP_IDX.setdefault(c[:3], (rname, idx))
    return _PAL


def allowed_rgba():
    load_palette()
    return _RGB_SET


def col(ramp, idx):
    pal = load_palette()
    arr = pal[ramp]
    return arr[max(0, min(len(arr) - 1, int(idx)))]


def C(spec):
    """Shorthand: C('brick:4') or ('brick', 4) or RGBA tuple."""
    if spec is None:
        return (0, 0, 0, 0)
    if isinstance(spec, tuple):
        if len(spec) == 2 and isinstance(spec[0], str):
            return col(spec[0], spec[1])
        return spec
    name, idx = spec.split(':')
    return col(name, int(idx))


def hsh(x, y, seed=0):
    v = ((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) & 0x7FFFFFFF
    return (v % 10000) / 10000.0


def seed_of(name):
    return zlib.crc32(name.encode('utf-8')) & 0xFFFF


def shade_rgba(px, delta=-1):
    if px[3] == 0:
        return px
    load_palette()
    k = _RAMP_IDX.get(px[:3])
    if k is None:
        return px
    return col(k[0], k[1] + delta)


class Canvas:
    """RGBA pixel canvas strictly drawing Fable-palette colors."""

    def __init__(self, w, h):
        self.w = w
        self.h = h
        self.im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        self.px = self.im.load()

    def p(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = C(c) if not (isinstance(c, tuple) and len(c) == 4) else c

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[x, y]
        return (0, 0, 0, 0)

    def clear(self, x0, y0, x1, y1):
        for y in range(max(0, y0), min(self.h, y1)):
            for x in range(max(0, x0), min(self.w, x1)):
                self.px[x, y] = (0, 0, 0, 0)

    def rect(self, x0, y0, x1, y1, c):
        rgba = C(c) if not (isinstance(c, tuple) and len(c) == 4) else c
        for y in range(max(0, y0), min(self.h, y1)):
            for x in range(max(0, x0), min(self.w, x1)):
                self.px[x, y] = rgba

    def hline(self, x0, x1, y, c):
        self.rect(x0, y, x1, y + 1, c)

    def vline(self, x, y0, y1, c):
        self.rect(x, y0, x + 1, y1, c)

    def shade_rect(self, x0, y0, x1, y1, delta=-1):
        for y in range(max(0, y0), min(self.h, y1)):
            for x in range(max(0, x0), min(self.w, x1)):
                self.px[x, y] = shade_rgba(self.px[x, y], delta)

    def outline_box(self, x0, y0, x1, y1, fill, border, top_hi=None, bot_sh=None):
        self.rect(x0, y0, x1, y1, fill)
        self.hline(x0, x1, y0, border)
        self.hline(x0, x1, y1 - 1, border)
        self.vline(x0, y0, y1, border)
        self.vline(x1 - 1, y0, y1, border)
        if top_hi is not None and y1 - y0 >= 3 and x1 - x0 >= 3:
            self.hline(x0 + 1, x1 - 1, y0 + 1, top_hi)
        if bot_sh is not None and y1 - y0 >= 4 and x1 - x0 >= 3:
            self.hline(x0 + 1, x1 - 1, y1 - 2, bot_sh)

    def stipple_rect(self, x0, y0, x1, y1, ramp, base_i, lo_i=None, hi_i=None, seed=0, rate=0.14):
        if lo_i is None:
            lo_i = max(0, base_i - 1)
        if hi_i is None:
            hi_i = base_i + 1
        c_base = col(ramp, base_i)
        c_lo = col(ramp, lo_i)
        c_hi = col(ramp, hi_i)
        for y in range(max(0, y0), min(self.h, y1)):
            for x in range(max(0, x0), min(self.w, x1)):
                r = hsh(x, y, seed)
                if r < rate * 0.65:
                    self.px[x, y] = c_lo
                elif r > 1.0 - rate * 0.35:
                    self.px[x, y] = c_hi
                else:
                    self.px[x, y] = c_base

    def brick_wall(self, x0, y0, x1, y1, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=0):
        """Hand-varied Fable brick/tile masonry with mortar & subtle per-brick tone shift."""
        for y in range(max(0, y0), min(self.h, y1)):
            ry = y - y0
            ci = ry // course_h
            yy = ry % course_h
            off = (brick_w // 2) if (ci % 2 == 1) else 0
            for x in range(max(0, x0), min(self.w, x1)):
                rx = (x - x0) + off
                bi = rx // brick_w
                bx = rx % brick_w
                if yy == course_h - 1 or bx == brick_w - 1:
                    self.px[x, y] = col(ramp, max(0, base_i - 2))
                else:
                    r = hsh(bi, ci, seed)
                    t = base_i + (1 if r > 0.76 else (-1 if r < 0.22 else 0))
                    if yy == 0 and bx == 0:
                        t = min(t + 1, 6)
                    self.px[x, y] = col(ramp, t)

    def tile_cladding(self, x0, y0, x1, y1, ramp='concrete', base_i=4, cw=4, ch=4, seed=0):
        """Modern ceramic/granite exterior tile cladding (Korean/Japanese mid-rise)."""
        for y in range(max(0, y0), min(self.h, y1)):
            ry = y - y0
            ci = ry // ch
            yy = ry % ch
            for x in range(max(0, x0), min(self.w, x1)):
                rx = x - x0
                bi = rx // cw
                bx = rx % cw
                if yy == ch - 1 or bx == cw - 1:
                    self.px[x, y] = col(ramp, max(1, base_i - 2))
                else:
                    r = hsh(bi, ci, seed)
                    t = base_i + (1 if r > 0.80 else (-1 if r < 0.18 else 0))
                    self.px[x, y] = col(ramp, t)

    def siding_wall(self, x0, y0, x1, y1, ramp='wood', base_i=4, horizontal=True, step=3, seed=0):
        """Horizontal clapboard or vertical corrugated metal/wood siding."""
        for y in range(max(0, y0), min(self.h, y1)):
            for x in range(max(0, x0), min(self.w, x1)):
                d = (y - y0) if horizontal else (x - x0)
                idx = d // step
                rem = d % step
                r = hsh(idx, (x if horizontal else y) // 5, seed)
                if rem == step - 1:
                    self.px[x, y] = col(ramp, max(0, base_i - 2))
                elif rem == 0:
                    self.px[x, y] = col(ramp, base_i + (1 if r > 0.4 else 0))
                else:
                    self.px[x, y] = col(ramp, base_i + (-1 if r < 0.25 else 0))

    def pitched_roof(self, x0, y0, x1, y1, ramp='kawara', ridge_hi=True, moss_rate=0.06, seed=0):
        """Fable-style top-3/4 pitched shingle/kawara roof with ridge cap, staggered tiles & drip eave."""
        w = x1 - x0
        h = y1 - y0
        for y in range(max(0, y0), min(self.h, y1)):
            ry = y - y0
            for x in range(max(0, x0), min(self.w, x1)):
                rx = x - x0
                if ry == 0:
                    self.px[x, y] = col(ramp, 1) if rx in (0, w - 1) else col(ramp, 6 if ridge_hi else 5)
                elif ry == 1:
                    self.px[x, y] = col(ramp, 5 if rx % 3 != 2 else 4)
                elif ry == 2:
                    self.px[x, y] = col(ramp, 2)
                elif ry == h - 1:
                    self.px[x, y] = col(ramp, 0)
                elif ry == h - 2:
                    self.px[x, y] = col(ramp, 1 if rx % 4 != 1 else 2)
                else:
                    ci = (ry - 3) // 4
                    yy = (ry - 3) % 4
                    tw = 4
                    bx = (rx + (2 if ci % 2 else 0)) % tw
                    bi = (rx + (2 if ci % 2 else 0)) // tw
                    r = hsh(bi, ci, seed)
                    # Top-left lighting: upper-left slightly brighter, right edge shaded
                    right_sh = 1 if rx >= w - 3 else 0
                    if yy == 3 or bx == tw - 1:
                        self.px[x, y] = col(ramp, max(0, 1 - right_sh))
                    elif moss_rate > 0 and r > 1.0 - moss_rate and ry >= h // 2:
                        self.px[x, y] = col('moss', 3 if yy <= 1 else 2)
                    else:
                        base_t = 4 if ry < h // 2 else 3
                        if r > 0.78:
                            base_t += 1
                        elif r < 0.22:
                            base_t -= 1
                        if yy == 0 and bx == 0:
                            base_t += 1
                        self.px[x, y] = col(ramp, max(1, base_t - right_sh))

    def flat_roof(self, x0, y0, x1, y1, deck_ramp='moss', deck_i=2, para_ramp='concrete', seed=0, urethane_green=False):
        """Fable-style recessed top-3/4 flat parapet roof (concrete or green urethane waterproof slab)."""
        if urethane_green:
            deck_ramp = 'midori'
            deck_i = 4
        # Outer parapet rim (3px top, 2px left/right, 3px front parapet coping+face)
        self.rect(x0, y0, x1, y1, col(para_ramp, 4))
        self.hline(x0, x1, y0, col(para_ramp, 1))
        self.hline(x0 + 1, x1 - 1, y0 + 1, col(para_ramp, 6))
        self.hline(x0 + 2, x1 - 2, y0 + 2, col(para_ramp, 2))
        self.vline(x0, y0, y1, col(para_ramp, 1))
        self.vline(x0 + 1, y0 + 1, y1 - 1, col(para_ramp, 5))
        self.vline(x1 - 1, y0, y1, col(para_ramp, 0))
        self.vline(x1 - 2, y0 + 1, y1 - 1, col(para_ramp, 3))
        # Inner recessed roof floor
        ix0, iy0, ix1, iy1 = x0 + 2, y0 + 3, x1 - 2, y1 - 4
        if ix1 > ix0 and iy1 > iy0:
            self.stipple_rect(ix0, iy0, ix1, iy1, deck_ramp, deck_i, max(0, deck_i - 1), deck_i + 1, seed=seed, rate=0.18)
            # Subtle north & left parapet cast shadow inside the roof slab
            self.hline(ix0, ix1, iy0, col(deck_ramp, max(0, deck_i - 2)))
            self.hline(ix0, ix1, iy0 + 1, col(deck_ramp, max(0, deck_i - 1)))
            self.vline(ix0, iy0, iy1, col(deck_ramp, max(0, deck_i - 1)))
            # Expansion joints on roof slab
            for gy in range(iy0 + 6, iy1 - 2, 7):
                self.hline(ix0 + 1, ix1 - 1, gy, col(deck_ramp, max(0, deck_i - 1)))
        # Front parapet coping + shaded south face
        if y1 - y0 >= 6:
            self.hline(x0 + 1, x1 - 1, y1 - 4, col(para_ramp, 6))
            self.hline(x0 + 1, x1 - 1, y1 - 3, col(para_ramp, 4))
            self.hline(x0 + 1, x1 - 1, y1 - 2, col(para_ramp, 2))
            self.hline(x0, x1, y1 - 1, col(para_ramp, 0))

    def roof_ac(self, x, y):
        """Compact 9x7 top-3/4 rooftop AC outdoor unit."""
        self.outline_box(x, y, x + 9, y + 7, col('white', 4), col('steel', 1), top_hi=col('white', 6))
        self.hline(x + 1, x + 8, y + 2, col('steel', 3))
        # Dark fan grille on front face
        self.rect(x + 2, y + 3, x + 6, y + 6, col('steel', 1))
        self.p(x + 3, y + 4, col('steel', 4))
        self.p(x + 4, y + 4, col('steel', 3))
        self.vline(x + 7, y + 3, y + 6, col('steel', 3))
        # Cast shadow
        self.hline(x + 1, x + 10, y + 7, col('ink', 1))

    def roof_tank(self, x, y):
        """Compact 10x12 top-3/4 cylindrical rooftop water tank with legs."""
        # Rounded top
        self.rect(x + 2, y, x + 8, y + 2, col('coolwhite', 5))
        self.hline(x + 2, x + 8, y, col('steel', 2))
        self.rect(x + 1, y + 2, x + 9, y + 9, col('coolwhite', 4))
        self.vline(x + 1, y + 2, y + 9, col('steel', 2))
        self.vline(x + 2, y + 2, y + 9, col('coolwhite', 5))
        self.vline(x + 7, y + 2, y + 9, col('coolwhite', 2))
        self.vline(x + 8, y + 2, y + 9, col('steel', 1))
        self.hline(x + 1, x + 9, y + 5, col('steel', 3))
        self.hline(x + 1, x + 9, y + 9, col('steel', 1))
        # Steel legs
        self.rect(x + 2, y + 10, x + 4, y + 12, col('steel', 1))
        self.rect(x + 6, y + 10, x + 8, y + 12, col('steel', 1))

    def roof_penthouse(self, x, y, w=12, h=11, ramp='concrete'):
        """Stairwell penthouse on a flat roof (3/4 top + door)."""
        self.outline_box(x, y, x + w, y + 4, col(ramp, 5), col(ramp, 1), top_hi=col(ramp, 6))
        self.outline_box(x, y + 3, x + w, y + h, col(ramp, 4), col(ramp, 1), bot_sh=col(ramp, 2))
        # Steel access door
        dx = x + w // 2 - 2
        self.outline_box(dx, y + 5, dx + 5, y + h, col('steel', 3), col('steel', 0), top_hi=col('steel', 4))
        self.p(dx + 3, y + 8, col('yellow', 4))

    def window(self, x0, y0, x1, y1, style='glass', frame='steel:1', sill='concrete:5', curtain=None, warm=False, seed=0):
        """Versatile high-detail modern/Fable window (glass, warm, shuttered, blinds, arched, display)."""
        w = x1 - x0
        h = y1 - y0
        self.outline_box(x0, y0, x1, y1, col('glass', 1), frame)
        ix0, iy0, ix1, iy1 = x0 + 1, y0 + 1, x1 - 1, y1 - 1
        for y in range(iy0, iy1):
            for x in range(ix0, ix1):
                rx, ry = x - ix0, y - iy0
                if warm or style == 'warm':
                    # Cozy backlit amber interior
                    if ry == 0:
                        self.px[x, y] = col('orange', 2)
                    elif ry >= (iy1 - iy0) // 2:
                        self.px[x, y] = col('yellow', 5 if (rx + ry) % 3 == 0 else 4)
                    else:
                        self.px[x, y] = col('orange', 4 if rx % 3 != 2 else 3)
                elif style == 'blinds':
                    self.px[x, y] = col('cream', 5 if ry % 2 == 0 else 3) if ry < (iy1 - iy0) // 2 + 1 else col('glass', 3)
                else:
                    # Crisp top-left sky reflection diagonal on deep blue-teal glass
                    if ry == 0:
                        self.px[x, y] = col('glass', 0)
                    elif (rx + ry) in (1, 2) or (rx + ry == 4 and ry <= 2):
                        self.px[x, y] = col('glass', 5)
                    elif ry >= (iy1 - iy0) - 2:
                        self.px[x, y] = col('glass', 3)
                    else:
                        self.px[x, y] = col('glass', 2 if (rx + ry) % 4 != 0 else 3)
        # Optional side drapes/curtains
        if curtain and w >= 6:
            cramp = curtain
            for y in range(iy0, iy1):
                self.p(ix0, y, col(cramp, 4 if y % 2 == 0 else 2))
                if w >= 8:
                    self.p(ix1 - 1, y, col(cramp, 3 if y % 2 == 0 else 1))
        # Mullion cross if large enough
        if w >= 7:
            mx = (x0 + x1) // 2
            self.vline(mx, iy0, iy1, frame)
        if h >= 8:
            my = (y0 + y1) // 2
            self.hline(ix0, ix1, my, frame)
        # Protruding sill + drop shadow
        if sill:
            self.hline(x0 - 1, x1 + 1, y1, sill)
            self.hline(x0, x1, y1 + 1, col('ink', 1))

    def awning(self, x0, y0, x1, y1, ramp_a='red', ramp_b='white', stripe_w=3):
        """Striped 3/4 shopfront fabric awning with scalloped front edge and cast shadow."""
        h = y1 - y0
        for y in range(max(0, y0), min(self.h, y1)):
            ry = y - y0
            for x in range(max(0, x0), min(self.w, x1)):
                rx = x - x0
                use_a = ((rx // stripe_w) % 2 == 0)
                rmp = ramp_a if use_a else ramp_b
                if ry == 0:
                    self.px[x, y] = col(rmp, 2)
                elif ry == h - 1:
                    self.px[x, y] = col(rmp, 1 if (rx % stripe_w != 0) else 0)
                elif ry == h - 2:
                    self.px[x, y] = col(rmp, 3 if use_a else 4)
                else:
                    self.px[x, y] = col(rmp, 4 if use_a else 5)
        self.hline(x0 + 1, x1, y1, col('ink', 1))

    def signboard(self, x0, y0, x1, y1, ramp='blue', accent='yellow:5', vertical=False, seed=0):
        """Readable crisp pixel signboard (horizontal fascia or Korean/Japanese vertical blade sign)."""
        self.outline_box(x0, y0, x1, y1, col(ramp, 3), col(ramp, 0), top_hi=col(ramp, 5), bot_sh=col(ramp, 1))
        # Crisp faux-glyph strokes inside (no unreadable mud, cleanly spaced character blocks!)
        if vertical:
            cx = (x0 + x1) // 2
            for gy in range(y0 + 3, y1 - 3, 5):
                self.hline(x0 + 2, x1 - 2, gy, accent)
                self.p(cx, gy + 1, accent)
                if gy + 2 < y1 - 2:
                    self.hline(x0 + 2 + (gy % 2), x1 - 2, gy + 2, accent)
        else:
            cy = (y0 + y1) // 2
            for gx in range(x0 + 3, x1 - 3, 4):
                self.vline(gx, y0 + 2, y1 - 2, accent)
                self.p(gx + 1, cy, accent)
                if hsh(gx, y0, seed) > 0.45 and gx + 2 < x1 - 2:
                    self.p(gx + 2, y0 + 2, accent)
                    self.p(gx + 2, y1 - 3, accent)
        # Drop shadow
        self.hline(x0 + 1, x1 + 1, y1, col('ink', 1))

    def door_glass(self, x0, y0, x1, y1, frame='steel:2', warm=True):
        """Modern glass automatic or framed commercial door."""
        self.outline_box(x0, y0, x1, y1, col('glass', 1), frame)
        mx = (x0 + x1) // 2
        self.window(x0 + 1, y0 + 1, mx, y1 - 3, style='warm' if warm else 'glass', frame=frame, sill=None)
        self.window(mx, y0 + 1, x1 - 1, y1 - 3, style='warm' if warm else 'glass', frame=frame, sill=None)
        self.rect(x0 + 1, y1 - 3, x1 - 1, y1 - 1, frame)
        self.hline(x0, x1, y1 - 1, col('concrete', 5))

    def door_wood(self, x0, y0, x1, y1, ramp='wood', glass_top=True):
        """Warm wooden residential/cafe/shop door with optional backlit upper pane."""
        self.outline_box(x0, y0, x1, y1, col(ramp, 4), col(ramp, 0), top_hi=col(ramp, 5))
        if glass_top and (y1 - y0) >= 12 and (x1 - x0) >= 6:
            self.window(x0 + 2, y0 + 2, x1 - 2, y0 + 7, style='warm', frame=col(ramp, 1), sill=None)
        self.p(x1 - 3, (y0 + y1) // 2 + 1, col('yellow', 5))
        self.hline(x0 - 1, x1 + 1, y1 - 1, col('stone', 5))

    def planter_box(self, x0, y0, x1, y1, flower='red:4', pot_ramp='brick'):
        """Terracotta/wood planter box with lush foliage and colorful blossoms."""
        mid_y = y0 + max(2, (y1 - y0) // 2)
        for y in range(y0, mid_y + 1):
            for x in range(x0, x1):
                r = hsh(x, y, 71)
                if y == y0 and (x == x0 or x == x1 - 1):
                    continue
                if r > 0.78:
                    self.p(x, y, flower)
                elif r > 0.40:
                    self.p(x, y, col('foliage', 5 if y == y0 else 4))
                else:
                    self.p(x, y, col('foliage', 2))
        self.outline_box(x0, mid_y, x1, y1, col(pot_ramp, 4), col(pot_ramp, 1), top_hi=col(pot_ramp, 5))

    def foliage_cluster(self, cx, cy, rx, ry, ramp='foliage', seed=0, blossom=None):
        """Organic shaded pixel tree/bush canopy (top-left lit, deep bottom-right shadow)."""
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                dx = (x - cx) / max(rx, 1)
                dy = (y - cy) / max(ry, 1)
                d2 = dx * dx + dy * dy
                n = hsh(x // 2, y // 2, seed) * 0.25
                if d2 + n > 1.05:
                    continue
                if d2 + n > 0.85:
                    self.p(x, y, col(ramp, 1))
                elif dx + dy < -0.45:
                    t = 6 if (hsh(x, y, seed + 3) > 0.5) else 5
                    self.p(x, y, col(ramp, t))
                elif dx + dy < 0.25:
                    t = 4 if (hsh(x, y, seed + 5) > 0.35) else 3
                    self.p(x, y, col(ramp, t))
                else:
                    self.p(x, y, col(ramp, 2 if dy < 0.6 else 1))
                if blossom and hsh(x, y, seed + 19) > 0.87 and dy < 0.3:
                    self.p(x, y, blossom)

    def terrace_deck(self, x0, y0, x1, y1, floor_ramp='floorwood', rail_ramp='wood', seed=0):
        """Spacious walkable top-3/4 modern balcony/rooftop terrace deck with cast shadows & open rail."""
        rail_h = min(8, max(5, (y1 - y0) // 3))
        fy1 = y1 - rail_h
        # Horizontal bright oak/stone floorboards
        for y in range(y0, fy1):
            ry = y - y0
            for x in range(x0, x1):
                rx = x - x0
                if ry == 0:
                    self.p(x, y, col(floor_ramp, 1))  # North wall shadow
                elif ry == 1:
                    self.p(x, y, col(floor_ramp, 2))
                elif rx in (0, 1):
                    self.p(x, y, col(rail_ramp, 1 if rx == 0 else 4))  # Left side rail
                elif rx in (x1 - x0 - 2, x1 - x0 - 1):
                    self.p(x, y, col(rail_ramp, 3 if rx == x1 - x0 - 2 else 1))  # Right side rail
                elif rx == 2:
                    self.p(x, y, col(floor_ramp, 2))  # Left rail shadow
                elif ry % 4 == 3:
                    self.p(x, y, col(floor_ramp, 3 if hsh(rx // 4, ry, seed) > 0.3 else 2))
                else:
                    r = hsh(rx // 5, ry // 4, seed)
                    self.p(x, y, col(floor_ramp, 5 if (ry % 4 == 0 and r > 0.4) else 4))
        # Open front balustrade
        self.hline(x0, x1, fy1, col(rail_ramp, 5))
        self.hline(x0, x1, fy1 + 1, col(rail_ramp, 1))
        for y in range(fy1 + 2, y1 - 2):
            for x in range(x0, x1):
                rx = x - x0
                if rx in (0, x1 - x0 - 1) or rx % 4 == 0:
                    self.p(x, y, col(rail_ramp, 4 if y < y1 - 3 else 3))
                elif rx % 4 == 1:
                    self.p(x, y, col(rail_ramp, 1))
                else:
                    self.p(x, y, col(floor_ramp, 2 if y == fy1 + 2 else 3))
        self.hline(x0, x1, y1 - 2, col(rail_ramp, 4))
        self.hline(x0, x1, y1 - 1, col(rail_ramp, 0))

    def edge_finish(self, top_y=0):
        """Subtle Fable-style left/right/bottom wall grounding shade."""
        for y in range(top_y, self.h):
            if self.px[0, y][3] == 255:
                self.px[0, y] = shade_rgba(self.px[0, y], -1)
            if self.px[self.w - 1, y][3] == 255:
                self.px[self.w - 1, y] = shade_rgba(self.px[self.w - 1, y], -2)
        for x in range(self.w):
            if self.px[x, self.h - 1][3] == 255:
                self.px[x, self.h - 1] = shade_rgba(self.px[x, self.h - 1], -2)

    def save(self, path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.im.save(path)
        return path
