# Round 2 (v7) kit family: 버들항 NOBLE MANOR (귀족 저택) — ids bd-mpart-* (parts), bd-manor-* (full manors), bd-garden-* (gardens).
# References: tiledata/city-refs/noble-manor-forest-house-rmxp.jpg (half-timbered plaster manor, steep central gable, dormers, formal
# symmetric garden) and tiledata/city-refs/itch-structure-ref.jpg (PART STRUCTURE only: roof / gable / dormer / storey band / pilaster
# bays with arched windows / side tower / columned porch / finial stairs / ivy variants).
# Everything is drawn once as a PART kit (role "part"); the full manors are the parts composited at cell offsets (assembly=...), so
# validate() can check that the manor kit is exactly its parts.  Run `python3 kits7_manor.py` to (re)create every kit (deterministic).
#
# Grid conventions used by the manor plans (16 px cells):
#   roof 3 rows (48 px, steep hip)  |  upper storey 2 rows (32 px)  |  ground storey 3 rows (48 px, tall windows, door)  |  bay = 1 cell
#   a wall bay is 1 cell wide and 5 rows tall (upper + ground storey, band between, stone plinth): 'l' bays have their pilaster on
#   the LEFT edge (used left of the axis), 'r' bays on the RIGHT edge (right of the axis) so the facade is symmetric.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np
from PIL import Image
import palette; palette.apply()
import pj, pv, ph2, pz, roman
import kits7_common as K
from px2 import _hash
T = 16

# ---------------------------------------------------------------- chipset colour ramps (tone 0 = outline .. 6 = brightest)
def _rgb(s): s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))
def _ramp(n): return [_rgb(c) for c in palette.ramp7(n)]
WD = _ramp('wood'); PL = _ramp('plaster'); ST = _ramp('stone'); GL = _ramp('glass'); LF = _ramp('leaf')
RD = _ramp('red'); SW = _ramp('straw'); RW = _ramp('roofw'); MS = _ramp('moss')
def H(x, y, s=0): return _hash(int(x), int(y), int(s))
def mul(c, k): return (max(0, min(255, int(c[0] * k))), max(0, min(255, int(c[1] * k))), max(0, min(255, int(c[2] * k * (1.08 if k < 1 else 1)))))

class Cv:
    def __init__(s, w, h, base=None):
        s.w, s.h = w, h
        s.im = Image.new('RGBA', (w, h), (0, 0, 0, 0)) if base is None else base.copy().convert('RGBA')
        s.p = s.im.load()
    def set(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.p[x, y] = (c[0], c[1], c[2], 255)
    def get(s, x, y): return s.p[x, y] if 0 <= x < s.w and 0 <= y < s.h else (0, 0, 0, 0)
    def rect(s, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w): s.set(xx, yy, c)
    def hl(s, x0, x1, y, c):        # x1 exclusive
        for xx in range(x0, x1): s.set(xx, y, c)
    def vl(s, x, y0, y1, c):        # y1 exclusive
        for yy in range(y0, y1): s.set(x, yy, c)
    def shade(s, x0, y0, x1, y1, k):
        for yy in range(max(0, y0), min(s.h, y1)):
            for xx in range(max(0, x0), min(s.w, x1)):
                r, g, b, a = s.p[xx, yy]
                if a: s.p[xx, yy] = mul((r, g, b), k) + (a,)
    def paste(s, im, x=0, y=0): s.im.alpha_composite(im, (x, y))

def plaster(w, h, dx=0, dy=0):
    return Cv(w, h, pj.tex('tim.wall', w, h, dx, dy))

def inset_outline(im, k=0.62):
    """Inset outline (same as city6.soft_outline): only the silhouette's own edge pixels get darker."""
    im = im.copy(); p = im.load(); W, Hh = im.size; edge = []
    for y in range(Hh):
        for x in range(W):
            if p[x, y][3] < 128: continue
            for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                xx, yy = x + dx, y + dy
                if not (0 <= xx < W and 0 <= yy < Hh) or p[xx, yy][3] < 128: edge.append((x, y)); break
    for x, y in edge:
        r, g, b, a = p[x, y]; p[x, y] = (int(r * k), int(g * k), int(b * k * 1.1), a)
    return im

# ---------------------------------------------------------------- small drawing primitives
def arch_mask(w, h):
    r = w / 2.0; out = set()
    for dy in range(h):
        half = math.sqrt(max(0.0, r * r - (r - dy - 0.5) ** 2)) if dy < r else r
        for dx in range(w):
            if abs(dx + 0.5 - r) <= half: out.add((dx, dy))
    return out

def arch_window(cv, x, y, w, h, F=None, lit=False, mull=True, sill=True, seed=0, glass_hi=True, curtain=False):
    """Round-topped window: 1 px dark outline, 1 px frame, glass. F = frame ramp (wood or leaf). Sill ledge under it."""
    F = F or WD
    outer = arch_mask(w, h); inner = {(dx + 2, dy + 2) for dx, dy in arch_mask(w - 4, h - 3)}
    for dx, dy in outer:
        edge = any((dx + a, dy + b) not in outer for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge: c = F[1]
        else: c = F[5] if (dx <= 2 or dy <= 2) else F[3]
        cv.set(x + dx, y + dy, c)
    iw, ih = w - 4, h - 3
    for dx, dy in inner:
        t = (dy - 2) / max(1, ih)
        if lit: c = SW[5] if t < 0.55 else SW[4]
        else: c = GL[2] if t < 0.32 else GL[3]
        cv.set(x + dx, y + dy, c)
    if glass_hi:                                            # two diagonal light strokes + one bright pixel
        for dx, dy in sorted(inner):
            u, v = dx - 2, dy - 2
            if lit:
                if (u + v) in (2,) and v < ih * 0.6: cv.set(x + dx, y + dy, SW[6])
            else:
                if (u + v) in (3, 4) and v < ih * 0.6 and u < iw - 1: cv.set(x + dx, y + dy, GL[5])
                if (u, v) == (1, 1): cv.set(x + dx, y + dy, GL[6])
    if mull:
        cxm = x + w // 2; mc = F[2] if not lit else F[1]
        for dy in range(3, h - 1):
            if (w // 2, dy) in inner: cv.set(cxm, y + dy, mc)
        ty = y + 2 + int(ih * 0.5)
        for dx in range(2, w - 2):
            if (dx, ty - y) in inner: cv.set(x + dx, ty, mc)
    if curtain and not lit:                                        # curtains drawn back to both sides of the upper glass
        for dy in range(3, 3 + max(5, h // 3)):
            for dx in (2, 3, w - 4, w - 3):
                if (dx, dy) in inner: cv.set(x + dx, y + dy, PL[5] if dx in (2, w - 4) else PL[3])
    if sill:
        cv.hl(x - 1, x + w + 1, y + h, PL[6]); cv.hl(x - 1, x + w + 1, y + h + 1, PL[3]); cv.hl(x, x + w, y + h + 2, mul(PL[2], 0.8))

def flowerbox(cv, x, y, w, cols, seed=0):
    """Wooden box (4 px tall) at (x,y) w px wide with leaves and blossoms on top."""
    cv.hl(x, x + w, y, WD[5]); cv.hl(x, x + w, y + 1, WD[4]); cv.hl(x, x + w, y + 2, WD[3]); cv.hl(x, x + w, y + 3, WD[1])
    cv.set(x, y + 1, WD[5]); cv.set(x + w - 1, y + 1, WD[2]); cv.set(x + w - 1, y + 2, WD[1])
    i = 0
    for xx in range(x, x + w):
        hh = 2 + int(H(xx, y, seed) * 2)
        for k in range(1, hh + 1): cv.set(xx, y - k, LF[3 if (xx + k) % 3 else 4] if k < hh else LF[5])
        if (xx - x) % 3 == 1:
            c = cols[i % len(cols)]; i += 1
            cv.set(xx, y - hh - 1, c); cv.set(xx + 1, y - hh, c) if (xx + 1) < x + w else None; cv.set(xx, y - hh, c)

def lantern(cv, x, y):
    """Wall lantern on an iron bracket (glowing straw glass)."""
    cv.set(x, y, ST[3]); cv.set(x + 1, y, ST[3]); cv.set(x + 2, y, ST[3])
    for yy in range(y + 1, y + 5):
        cv.set(x, yy, ST[2]); cv.set(x + 2, yy, ST[1]); cv.set(x + 1, yy, SW[6] if yy < y + 3 else SW[5])
    cv.set(x + 1, y + 5, ST[2]); cv.set(x, y + 5, ST[1]); cv.set(x + 2, y + 5, ST[1])

def stone_plinth(cv, x0, x1, y0=74, y1=80, seed=0):
    for y in range(y0, y1):
        for x in range(x0, x1):
            r = y - y0
            c = ST[5] if r == 0 else ST[4] if r == 1 else ST[3] if r < 4 else ST[2] if r == 4 else ST[1]
            off = 4 if (r // 3) % 2 else 0
            if r in (2, 3) and (x + off) % 8 == 0 and 0 < r: c = ST[2]
            cv.set(x, y, c)

def post(cv, x0, y0, y1, tones=(5, 3, 1)):
    for y in range(y0, y1):
        for k, t in enumerate(tones): cv.set(x0 + k, y, WD[t])

def quad_brace(cv, side, y_top, y_bot, x_left, x_right, width=2):
    """A chunky curved knee-brace: rises steeply from the pilaster foot, flattens toward the beam (half-timber arc), 3 px thick."""
    n = 60
    for i in range(n + 1):
        s = i / n
        xx = x_left + (x_right - x_left) * s
        yy = y_bot - (y_bot - y_top) * (1 - (1 - s) ** 2)
        xi = int(round(xx)) if side == 'l' else int(round(x_left + x_right - xx)); yi = int(round(yy))
        sg = 1 if side == 'l' else -1
        for dx in (0, 1, 2):
            for dy in (0, 1, 2):
                c = WD[5] if (dx == 0 and dy == 0) else WD[2] if (dx == 2 or dy == 2) else WD[4]
                if side == 'r' and dx == 2 and dy == 2: c = WD[1]
                cv.set(xi + sg * dx if False else xi + dx * (1 if side == 'l' else -1), yi + dy, c)

# ---------------------------------------------------------------- wall bays (1 cell wide, 5 rows tall = 80 px)
BAYVAR = {
    'a': dict(F=WD, fl=[RD[4], SW[5], RD[5], SW[6]], lit=False),
    'b': dict(F=LF, fl=[PL[6], RD[4], PL[5], RD[5]], lit=False, curtain=True),
    'lit': dict(F=WD, fl=[SW[5], PL[6], SW[6], PL[5]], lit=True),
}
def band(cv, x0, x1, y=28):
    """Storey band: timber beam over a projecting grey stone ledge, shadow under it."""
    cv.hl(x0, x1, y, WD[5]); cv.hl(x0, x1, y + 1, WD[3]); cv.hl(x0, x1, y + 2, WD[1]); cv.hl(x0, x1, y + 3, ST[4])
    cv.shade(x0, y + 4, x1, y + 7, 0.78)
def eave_top(cv, x0, x1, y=0):
    cv.hl(x0, x1, y, WD[4]); cv.hl(x0, x1, y + 1, WD[2])
    cv.shade(x0, y + 2, x1, y + 5, 0.62); cv.shade(x0, y + 5, x1, y + 8, 0.82)

def bay(kind, side, var='a'):
    W, Hh = 16, 80
    cv = plaster(W, Hh); v = BAYVAR[var]
    px0 = 0 if side == 'l' else 13
    eave_top(cv, 0, W)
    post(cv, px0, 2, 74)
    if kind == 'win':
        wx = 4 if side == 'l' else 2
        arch_window(cv, wx, 6, 10, 18, v['F'], lit=v['lit'], sill=True, curtain=v.get('curtain', False))                       # upper storey
        band(cv, 0, W); post(cv, px0, 32, 74)
        arch_window(cv, wx, 39, 10, 24, v['F'], lit=False, sill=False)                          # ground storey, taller
        flowerbox(cv, wx - 1, 63, 12, v['fl'], seed=len(var))
        post(cv, px0, 2, 28); post(cv, px0, 32, 74)
    else:
        band(cv, 0, W)
        if side == 'l':
            quad_brace(cv, 'l', 8, 26, 3, 13); quad_brace(cv, 'l', 42, 70, 3, 13)
        else:
            quad_brace(cv, 'r', 8, 26, 3, 13); quad_brace(cv, 'r', 42, 70, 3, 13)
        lantern(cv, 6 if side == 'l' else 5, 47)
        post(cv, px0, 2, 28); post(cv, px0, 32, 74)
    stone_plinth(cv, 0, W)
    # pilaster foot / capital blocks
    cv.hl(px0 - (1 if side == 'l' and px0 > 0 else 0), px0 + 3, 73, ST[4])
    return cv.im

def door_bay():
    W, Hh = 48, 80
    cv = plaster(W, Hh)
    eave_top(cv, 0, W)
    band(cv, 0, W)
    # upper storey: wide arched window with flower box above the porch
    arch_window(cv, 17, 4, 14, 19, WD, lit=False, sill=False)
    flowerbox(cv, 16, 21, 16, [RD[4], PL[6], RD[5], SW[5]], seed=7)
    # ground storey: stone door surround + double door
    cv.rect(14, 44, 20, 30, PL[4])
    for y in range(44, 74):
        cv.set(14, y, PL[6]); cv.set(15, y, PL[5]); cv.set(32, y, PL[2]); cv.set(33, y, PL[1])
    cv.hl(14, 34, 44, PL[6]); cv.hl(14, 34, 45, PL[3]); cv.hl(14, 34, 46, PL[2]); cv.hl(14, 34, 47, PL[1]) if False else None
    for y in range(48, 74):                                    # door leaves x 17..30
        for x in range(17, 31):
            base = WD[4] if x < 24 else WD[3]
            if x in (17, 30): base = WD[1]
            if x in (23, 24): base = WD[1]
            cv.set(x, y, base)
    for (x0, x1) in ((18, 22), (25, 29)):                      # raised panels
        for (y0, y1) in ((51, 58), (61, 71)):
            for y in range(y0, y1):
                for x in range(x0, x1):
                    edge_l = x == x0; edge_t = y == y0
                    cv.set(x, y, WD[6] if (edge_l or edge_t) else (WD[5] if x < 24 else WD[4]))
            cv.set(x1 - 1, y1 - 1, WD[2])
    cv.set(22, 66, SW[6]); cv.set(22, 67, SW[4]); cv.set(25, 66, SW[6]); cv.set(25, 67, SW[4])
    cv.hl(17, 31, 48, WD[1])                                    # lintel shadow
    for x in range(17, 31): cv.set(x, 49, mul(WD[3], 0.8)); cv.set(x, 50, mul(WD[4], 0.9))
    lantern(cv, 6, 50); lantern(cv, 40, 50)
    post(cv, 0, 2, 28); post(cv, 45, 2, 28); post(cv, 0, 32, 74); post(cv, 45, 32, 74)
    stone_plinth(cv, 0, W)
    for x in range(14, 34): cv.set(x, 74, ST[6]); cv.set(x, 75, ST[5])
    return cv.im

# ---------------------------------------------------------------- roof (3 rows steep hip; l / m / r cut from one drawing)
ROOF_H = 48
def _roof_full(wc=7):
    W = wc * 16
    r = ph2.steep_hip('tim', W, ROOF_H, e=48, ends=True)
    cv = Cv(W, ROOF_H, r)
    # eave fascia along the bottom of the front slope
    for x in range(W):
        if cv.get(x, ROOF_H - 3)[3]: cv.set(x, ROOF_H - 3, WD[4]); cv.set(x, ROOF_H - 2, WD[2]); cv.set(x, ROOF_H - 1, WD[1])
    return cv.im
def roof_part(which):
    full = _roof_full(7)
    return {'l': full.crop((0, 0, 48, ROOF_H)), 'm': full.crop((48, 0, 64, ROOF_H)), 'r': full.crop((64, 0, 112, ROOF_H))}[which]

# ---------------------------------------------------------------- round window, gable block, dormer, porch, stairs, chimney
def round_window(cv, cx, cy, r, F=None, lit=False):
    F = F or WD
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d > r + 0.5: continue
            if d > r - 0.6: cv.set(x, y, F[1])
            elif d > r - 1.6: cv.set(x, y, F[5] if (x + y) % 2 == 0 or x < cx else F[3])
            else:
                c = (SW[5] if lit else GL[2]) if y < cy else (SW[4] if lit else GL[3])
                cv.set(x, y, c)
    for k in range(int(-r) + 2, int(r) - 1):
        cv.set(int(cx), int(cy) + k, F[2]); cv.set(int(cx) + k, int(cy), F[2])
    if not lit: cv.set(int(cx) - 2, int(cy) - 2, GL[5])

def gable_block(wc=5, rows=4, G=60, Rh=ROOF_H, win=None, ivy=None):
    """Cross gable: the roof of a north-south ridge seen from the front and above (lit left slope, shaded right slope, ridge cap) with
    the triangular gable wall in its lower G px; over the main roof (top Rh px) only the valley triangle shows (transparent outside).
    win = list of (variant, lit) for the three attic windows."""
    W, Hh = wc * 16, rows * 16; gx = W / 2.0; apex = Hh - G
    lit = pj.nstex('tim', 'l', W, Hh).load(); dk = pj.nstex('tim', 'r', W, Hh).load(); wall = pj.tex('tim.wall', W, Hh).load()
    cv = Cv(W, Hh)
    for y in range(Hh):
        vh = gx * (y + 1) / Rh if y < Rh else gx + 9
        half = (y - apex + 1) / G * gx if y >= apex else -1
        for x in range(W):
            d = abs(x + 0.5 - gx); left = x + 0.5 < gx
            if d > vh: continue
            if d <= half - 2: c = wall[x, y][:3]
            elif d <= half: c = WD[5] if left else WD[2]
            else:
                c = (lit if left else dk)[x, y][:3]; c = mul(c, 1.06 if left else 0.86)
                if y < Rh and vh - d < 1.6: c = (60, 34, 30)
                if y >= Hh - 2: c = WD[3] if y == Hh - 2 else WD[1]
            cv.set(x, y, c)
    for y in range(0, apex):                                         # ridge cap of the cross roof
        cv.set(int(gx) - 1, y, WD[5]); cv.set(int(gx), y, WD[2])
    # finial on the apex
    ax = int(gx)
    for y in range(max(0, apex - 4), apex + 2): cv.set(ax - 1, y, WD[5]); cv.set(ax, y, WD[2])
    cv.set(ax - 1, max(0, apex - 5), SW[6]); cv.set(ax, max(0, apex - 5), SW[4])
    # timber: king post below the oculus is left out (windows sit on the axis); tie beam and a collar beam
    def tri_half(y): return (y - apex + 1) / G * gx - 2
    for yy, tones in ((Hh - 7, (5,)), (Hh - 6, (4,)), (Hh - 5, (3,)), (Hh - 4, (1,))):
        for x in range(W):
            if abs(x + 0.5 - gx) <= tri_half(yy): cv.set(x, yy, WD[tones[0]])
    if wc >= 5:
        round_window(cv, gx, apex + 24, 4.6, WD)
        win = win or [('a', False), ('b', False), ('a', False)]
        xs = [int(gx) - 17, int(gx) - 5, int(gx) + 7]
        for (var, lt), x0 in zip(win, xs):
            v = BAYVAR[var]
            arch_window(cv, x0, apex + 32, 10, 16, v['F'], lit=lt, sill=False)
            flowerbox(cv, x0, apex + 47, 10, v['fl'], seed=x0)
    else:                                                            # narrow wall gable: one tall arched window over the door
        var, lt = (win or [('b', False)])[0]; v = BAYVAR[var]
        arch_window(cv, int(gx) - 5, apex + 17, 10, 19, v['F'], lit=lt, sill=False)
        flowerbox(cv, int(gx) - 5, Hh - 12, 10, v['fl'], seed=5)
    return cv.im

def dormer(var='a', lit=False):
    """Gable dormer with an arched window, 2x2 cells; sits on the front slope (its foot 4 px above the eave)."""
    W, Hh = 32, 32; gx = 16.0; apex = 1; G = 13
    litt = pj.nstex('tim', 'l', W, Hh).load(); dk = pj.nstex('tim', 'r', W, Hh).load(); wall = pj.tex('tim.wall', W, Hh).load()
    cv = Cv(W, Hh); v = BAYVAR[var]
    for y in range(apex, 28):
        half = min(14.0, (y - apex + 1) / G * 14.0)
        for x in range(W):
            d = abs(x + 0.5 - gx); left = x + 0.5 < gx
            if d > 14: continue
            if y - apex < G and d > half: continue
            if d <= half - 2.5 or (y - apex >= G and d <= 12): c = wall[x, y][:3]
            elif y - apex < G and d <= half: c = WD[5] if left else WD[2]
            elif y - apex < G:
                c = (litt if left else dk)[x, y][:3]
            else: c = WD[5] if left else WD[3]
            cv.set(x, y, c)
    for y in range(apex + G, 28):                                    # cheek posts
        cv.set(2, y, WD[5]); cv.set(3, y, WD[3]); cv.set(28, y, WD[3]); cv.set(29, y, WD[1])
    # roof slope strips beside the gable triangle (tiles) with dark barge edge
    for y in range(apex, apex + G):
        half = min(14.0, (y - apex + 1) / G * 14.0)
        for x in range(W):
            d = abs(x + 0.5 - gx)
            if half < d <= half + 3 and d <= 16:
                c = (litt if x + 0.5 < gx else dk)[x, y][:3]; cv.set(x, y, mul(c, 1.05 if x + 0.5 < gx else 0.85))
    arch_window(cv, 10, 10, 12, 16, v['F'], lit=lit, sill=False)
    cv.hl(3, 29, 26, WD[4]); cv.hl(3, 29, 27, WD[2]); cv.hl(3, 29, 28, WD[1])
    cv.set(15, 0, SW[5]); cv.set(16, 0, SW[4])
    return cv.im

def column(cv, x, y0, y1, w=5):
    tones = [PL[2], PL[6], PL[5], PL[3], PL[1]]
    for yy in range(y0, y1):
        for k in range(w): cv.set(x + k, yy, tones[k] if w == 5 else tones[k + 1])
    # capital and base
    cv.hl(x - 1, x + w + 1, y0, PL[6]); cv.hl(x - 1, x + w + 1, y0 + 1, PL[5]); cv.hl(x - 1, x + w + 1, y0 + 2, PL[2])
    cv.hl(x - 1, x + w + 1, y1 - 3, PL[4]); cv.hl(x - 1, x + w + 1, y1 - 2, ST[4]); cv.hl(x - 1, x + w + 1, y1 - 1, ST[2])

def porch():
    """Columned pediment porch, 3x3 cells; the door shows through between the columns (transparent)."""
    W, Hh = 48, 48; cv = Cv(W, Hh); gx = 24.0
    litt = pj.nstex('tim', 'l', W, Hh).load(); dk = pj.nstex('tim', 'r', W, Hh).load(); wall = pj.tex('tim.wall', W, Hh).load()
    PH = 13
    for y in range(PH):
        half = (y + 1) / PH * 24.0
        for x in range(W):
            d = abs(x + 0.5 - gx); left = x + 0.5 < gx
            if d > half: continue
            if d <= half - 4: c = mul(wall[x, y][:3], 0.96)
            elif d <= half - 2: c = WD[5] if left else WD[2]
            else: c = mul((litt if left else dk)[x, y][:3], 1.05 if left else 0.85)
            cv.set(x, y, c)
    for y in range(PH):                                              # tile band edge beside the pediment
        pass
    cv.set(23, 0, SW[5]); cv.set(24, 0, SW[4])
    # entablature
    cv.hl(0, W, PH, PL[6]); cv.hl(0, W, PH + 1, PL[5]); cv.hl(0, W, PH + 2, WD[3]); cv.hl(0, W, PH + 3, WD[1])
    # small round vent in the pediment
    round_window(cv, 24, 7, 2.6, WD)
    column(cv, 1, PH + 4, 47); column(cv, 42, PH + 4, 47)
    for y in range(PH + 4, PH + 8):                                  # soffit shading under the entablature, between the columns
        pass
    return cv.im

def stairs():
    """5x2 cells: flight of steps (LOWER picture, walkable) in the middle three cells and two finial posts (upper picture, blocked)."""
    W, Hh = 80, 32
    lo = Image.new('RGBA', (W, Hh), (0, 0, 0, 0)); p = lo.load()
    for i in range(4):                                                # 4 steps: worn tread with lit nosing, shaded riser
        y0 = i * 8
        for x in range(16, 64):
            for k in range(8):
                y = y0 + k; wear = H(x // 6, i, 3)
                if k == 0: c = ST[6]
                elif k < 4: c = ST[5] if wear > 0.3 else ST[4]
                elif k < 7: c = ST[4] if (x + i * 5) % 13 else ST[3]
                else: c = ST[2]
                if x < 19 and k < 7: c = mul(c, 1.08)                  # lit stringer edge
                if x > 60: c = mul(c, 0.78)                            # shaded stringer edge
                if k in (1, 2, 3) and H(x, y, 9) > 0.93: c = ST[4]
                p[x, y] = mul(c, 1.0) + (255,)
    cv = Cv(W, Hh)
    for px0 in (3, 65):                                              # finial posts on the cheek walls
        cv.rect(px0, 10, 12, 20, PL[4])
        for y in range(10, 30):
            cv.set(px0, y, PL[6]); cv.set(px0 + 1, y, PL[5]); cv.set(px0 + 10, y, PL[2]); cv.set(px0 + 11, y, PL[1])
        cv.hl(px0 - 1, px0 + 13, 8, PL[6]); cv.hl(px0 - 1, px0 + 13, 9, PL[5]); cv.hl(px0 - 1, px0 + 13, 10, PL[2])   # cap
        cv.hl(px0 - 1, px0 + 13, 27, PL[3]); cv.hl(px0 - 1, px0 + 13, 28, ST[4]); cv.hl(px0 - 1, px0 + 13, 29, ST[2]); cv.hl(px0 - 1, px0 + 13, 30, ST[1]); cv.hl(px0 - 1, px0 + 13, 31, ST[1])
        for y in range(15, 24): cv.set(px0 + 4, y, PL[3]); cv.set(px0 + 5, y, PL[3])                                   # recessed panel
        cv.rect(px0 + 3, 14, 6, 1, PL[6]); cv.rect(px0 + 3, 24, 6, 1, PL[2])
        for y in range(0, 8):                                         # finial ball with a point
            for x in range(px0 + 1, px0 + 11):
                dx = (x + 0.5 - (px0 + 6)) / 4.5; dy = (y + 0.5 - 4.2) / 4.0
                if dx * dx + dy * dy <= 1:
                    c = PL[6] if (dx + dy) < -0.7 else PL[5] if (dx + dy) < 0.1 else PL[3] if dx + dy < 0.8 else PL[2]
                    cv.set(x, y, c)
        cv.set(px0 + 5, 0, PL[6]); cv.set(px0 + 6, 0, PL[5])
    return cv.im, lo

def chimney():
    L = pj.library(); im = Image.new('RGBA', (16, 32)); im.alpha_composite(L['tim.chimney.top'], (0, 0)); im.alpha_composite(L['tim.chimney.bot'], (0, 16))
    cv = Cv(16, 32, im)
    cv.hl(3, 13, 29, ST[5]); cv.hl(3, 13, 30, ST[3]); cv.hl(3, 13, 31, ST[1])          # lead flashing where it meets the roof
    return cv.im

# ---------------------------------------------------------------- side tower (round plaster body, terracotta cone)
def slit_window(cv, x, y, w, h, lit=False):
    for dy in range(h):
        for dx in range(w):
            top = dy == 0 and (dx in (0, w - 1)) and w > 3
            if top: continue
            edge = dx in (0, w - 1) or dy in (0, h - 1)
            c = WD[1] if edge else ((SW[5] if dy < h // 2 else SW[4]) if lit else (GL[2] if dy < h // 2 else GL[3]))
            cv.set(x + dx, y + dy, c)
    if not lit and w > 3: cv.set(x + 1, y + 1, GL[6]); cv.set(x + 1, y + 2, GL[5])
    cv.hl(x - 1, x + w + 1, y + h, PL[6]); cv.hl(x - 1, x + w + 1, y + h + 1, PL[3])

def round_tower(wc=3, cone_h=48, wall_h=90, ry=5):
    W = wc * 16; R = W / 2.0; Hc = cone_h; Hw = wall_h; TH = Hc + Hw + ry + 1; Rb = R - 2.5
    cv = Cv(W, TH); px = cv.p
    walltex = pj.tex('tim.wall', W * 2, Hw + ry * 3 + 32).load(); stotex = pj.tex('sto.wall', W * 2, Hw + ry * 3 + 32).load()
    lit = pj.pairtex('tim', 'back', W * 2, Hc + ry * 3).load(); dk = pj.pairtex('tim', 'front', W * 2, Hc + ry * 3).load()
    def bow(d, rr): return ry * math.sqrt(max(0.0, 1 - (d / rr) ** 2))
    for y in range(Hc - ry, TH):                                     # cylinder between two ellipses
        for x in range(W):
            d = x + 0.5 - R
            if abs(d) > Rb: continue
            u, cz = pv._wrap(d, Rb); b = ry * cz
            if y < Hc + b or y > Hc + Hw + b: continue
            yy = int(y - b - Hc + ry); s = y - (Hc + b)             # s = depth below the eave line
            if s > Hw - 10:                                          # stone foot: ashlar courses in the stone ramp
                cr = (s - (Hw - 10)) // 4; uj = int(u + 200) + (4 if cr % 2 else 0)
                c = ST[5] if H(uj // 8, cr, 21) > 0.6 else ST[4]
                if (s - (Hw - 10)) % 4 == 3 or uj % 8 == 7: c = ST[3]
                if s == Hw - 10: c = ST[6]
            else: c = walltex[int(u + R * 2 - Rb) % (W * 2), max(0, yy)][:3]
            k = 0.62 + 0.5 * max(0, cz * 0.8 - 0.25 * (d / Rb)); c = mul(c, min(1.12, k))
            if s < 4: c = mul(c, 0.55 + 0.11 * s)                    # eave shadow
            if abs(d) > Rb - 1.2: c = mul(c, 0.7)
            cv.set(x, y, c)
    for y_s in (31, 62):                                              # belt courses (beam over a stone ledge)
        for x in range(W):
            d = x + 0.5 - R
            if abs(d) > Rb: continue
            _, cz = pv._wrap(d, Rb); yb = int(Hc + ry * cz + y_s)
            for k, col in enumerate((WD[5], WD[3], WD[1], ST[4])): cv.set(x, yb + k, mul(col, 1.0 if d < 0 else 0.85))
            for k, m in ((4, 0.78), (5, 0.78), (6, 0.85)): 
                r, g, b_, a = cv.get(x, yb + k)
                if a: cv.set(x, yb + k, mul((r, g, b_), m))
    for fl, (ys, hh) in enumerate(((7, 17), (38, 17), (66, 12))):     # windows on the axis and two foreshortened ones
        for d_f in (-0.62, 0.0, 0.62):
            d = d_f * Rb; _, cz = pv._wrap(d, Rb); b = ry * cz
            ww = max(6, int(round(10 * cz))); x0 = int(round(R + d - ww / 2.0)); y0 = int(Hc + b + ys)
            lit_w = (fl == 1 and d_f == 0.0)
            F = LF if (fl == 0 and d_f == 0.0) else WD
            if ww >= 6: arch_window(cv, x0, y0, ww, hh, F, lit=lit_w, sill=(fl != 2), mull=(ww >= 8), glass_hi=True)
    for y in range(Hc + Hw + ry + 1):                                # ground line dark
        pass
    # cone with an overhanging eave
    for y in range(Hc + ry + 1):
        half = R * min(1, (y + 1) / Hc)
        for x in range(W):
            d = x + 0.5 - R
            if abs(d) > half: continue
            u, cz = pv._wrap(d, half); b = ry * (half / R) * cz
            if y > Hc + b and y >= Hc - ry: continue
            yy = int(y - b) + ry
            c = (lit if d < 0 else dk)[int(u + R) % (W * 2), max(0, yy)][:3]
            k = 1.0 if d < 0 else 0.88
            if abs(abs(d) - half) < 1.2: c = WD[5] if d < 0 else WD[1]
            cv.set(x, y, mul(c, k))
    for x in range(W):                                               # eave board along the front ellipse
        d = x + 0.5 - R
        if abs(d) <= R:
            _, cz = pv._wrap(d, R); yb = int(Hc + ry * cz)
            cv.set(x, yb, WD[4]); cv.set(x, yb + 1, WD[2]); cv.set(x, yb + 2, WD[1]) if abs(d) < R - 2 else None
    cx = int(R)                                                       # finial
    for y in range(0, 5): cv.set(cx - 1, y, ST[4]); cv.set(cx, y, ST[2])
    cv.set(cx - 1, 0, SW[6]); cv.set(cx, 0, SW[5]); cv.set(cx - 1, 1, SW[5]); cv.set(cx, 1, SW[4])
    return cv.im

# ---------------------------------------------------------------- garden props
def cypress_tub(rows=3, seed=1):
    """Cypress in a wooden barrel planter, 1 x rows cells."""
    W, Hh = 16, rows * 16
    tree = roman.cypress(rows, seed)
    im = Image.new('RGBA', (W, Hh)); im.alpha_composite(tree)
    cv = Cv(W, Hh, im)
    by = Hh - 12                                                      # barrel 14 wide x 12 tall (bulging)
    for y in range(by, Hh):
        t = (y - by) / 11.0; half = 6.6 + 0.9 * math.sin(t * math.pi)
        for x in range(W):
            d = x + 0.5 - 8
            if abs(d) > half: continue
            u = d / half; c = WD[5] if u < -0.55 else WD[4] if u < 0.05 else WD[3] if u < 0.6 else WD[2]
            if abs(d) > half - 1: c = WD[1]
            if y in (by + 3, by + 4, by + 8, by + 9): c = ST[3] if u < 0.1 else ST[2]     # iron hoops
            cv.set(x, y, c)
    for x in range(2, 14):                                            # rim + soil
        cv.set(x, by, WD[6]); cv.set(x, by + 1, WD[1] if x in (2, 13) else PL[1] if False else WD[2])
    for x in range(4, 12): cv.set(x, by + 1, WD[1])
    cv.hl(3, 13, Hh - 1, WD[1])
    return cv.im

def lamp_post(rows=3):
    """Tall double-lantern lamp post (iron), 1 x rows cells; ref: lamp posts flanking the garden axis."""
    W, Hh = 16, rows * 16; cv = Cv(W, Hh)
    by = Hh - 8
    cv.rect(4, by, 8, 8, ST[4]); cv.hl(3, 13, by, ST[6]); cv.hl(3, 13, by + 1, ST[5])
    for y in range(by + 2, Hh): cv.set(4, y, ST[5]); cv.set(11, y, ST[2])
    cv.hl(4, 12, Hh - 1, ST[1]); cv.hl(5, 11, by + 4, ST[3])
    cv.rect(6, by - 4, 4, 4, ST[3]); cv.hl(5, 11, by - 4, ST[5])
    for y in range(13, by - 3): cv.set(7, y, ST[3]); cv.set(8, y, ST[1])
    for y in (by - 12, by - 22): cv.hl(6, 10, y, ST[5]); cv.hl(6, 10, y + 1, ST[2])
    cv.hl(2, 14, 11, ST[4]); cv.hl(2, 14, 12, ST[1])                   # cross arm
    for (x, y) in ((3, 12), (4, 13), (12, 13), (11, 12)): cv.set(x, y, ST[3])
    for cx in (2, 13):                                                # two hanging lanterns
        cv.set(cx, 12, ST[2]); cv.set(cx + 1, 12, ST[2])
        for yy in range(13, 20):
            for xx in (cx - 1, cx, cx + 1, cx + 2):
                if xx in (cx - 1, cx + 2): cv.set(xx, yy, ST[2] if xx == cx - 1 else ST[1])
                else: cv.set(xx, yy, SW[6] if (yy < 16 and xx == cx) else SW[5] if yy < 18 else SW[4])
        cv.hl(cx - 1, cx + 3, 20, ST[2])
    cv.set(7, 8, ST[5]); cv.set(8, 8, ST[3]); cv.set(7, 9, ST[4]); cv.set(8, 9, ST[2]); cv.set(7, 10, ST[3]); cv.set(8, 10, ST[1])
    cv.set(7, 7, SW[6]); cv.set(8, 7, SW[4])
    return cv.im

def hedge_run(wc, hc=1, seed=3):
    """Clipped hedge run wc x hc cells (chipset leaf texture, inset outline); the hedge body is 12 px tall at the bottom of its cell row."""
    W, Hh = wc * 16, hc * 16; im = Image.new('RGBA', (W, Hh)); px = im.load()
    top = Hh - 15; bot = Hh - 2
    def inside(x, y):
        if not (top <= y <= bot): return False
        if (x in (0, W - 1)) and (y in (top, bot)): return False
        return 0 <= x < W
    def shade(x, y):
        v = y - top
        s = 1 if v < 3 else 0 if v < 9 else -1
        if (x + y * 3 + seed) % 7 == 0: s -= 1
        return s
    roman.foliage(px, W, Hh, inside, shade, dark=0, ox=seed * 5, oy=seed * 3)
    return pz.fin(im)

def low_wall(kind='wall'):
    """1x1 low garden wall / rail piece, aligned to the bottom of its cell."""
    cv = Cv(16, 16)
    if kind == 'wall':
        cv.hl(0, 16, 5, ST[6]); cv.hl(0, 16, 6, ST[5]); cv.hl(0, 16, 7, ST[3])
        for y in range(8, 15):
            for x in range(16):
                off = 4 if ((y - 8) // 3) % 2 else 0
                c = ST[4] if x < 15 else ST[3]
                if (y - 8) % 3 == 2 or (x + off) % 8 == 0: c = ST[3]
                cv.set(x, y, c)
        cv.hl(0, 16, 15, ST[1]); cv.vl(0, 6, 15, ST[5]); cv.vl(15, 8, 15, ST[2])
    else:                                                            # baluster rail
        cv.hl(0, 16, 3, ST[6]); cv.hl(0, 16, 4, ST[5]); cv.hl(0, 16, 5, ST[3])
        for bx in (2, 6, 10, 14):
            for y in range(6, 13):
                wdt = 2 if y in (8, 9) else 1
                cv.set(bx, y, ST[5]); 
                if wdt == 2: cv.set(bx + 1, y, ST[3]); cv.set(bx - 1, y, ST[5])
                else: cv.set(bx + 1, y, ST[3]) if False else None
        cv.hl(0, 16, 13, ST[4]); cv.hl(0, 16, 14, ST[3]); cv.hl(0, 16, 15, ST[1])
    return cv.im

def ivy_arch():
    """3x3 cells: two stone pillars and an ivy-covered arch; the passage under it is walkable (C under the arch top)."""
    W, Hh = 48, 48; cv = Cv(W, Hh)
    for x0 in (3, 38):
        for y in range(16, 46):
            for k in range(7):
                c = ST[5] if k == 0 else ST[4] if k < 3 else ST[3] if k < 5 else ST[2]
                cv.set(x0 + k, y, c)
        cv.hl(x0 - 1, x0 + 8, 14, ST[6]); cv.hl(x0 - 1, x0 + 8, 15, ST[4]); cv.hl(x0 - 1, x0 + 8, 16, ST[2])
        cv.hl(x0 - 1, x0 + 8, 43, ST[4]); cv.hl(x0 - 1, x0 + 8, 44, ST[3]); cv.hl(x0 - 1, x0 + 8, 45, ST[1])
    for x in range(W):                                               # arch band between the pillar tops
        u = (x + 0.5 - 24) / 21.0
        if abs(u) > 1: continue
        yc = 15 - 12 * math.sqrt(max(0, 1 - u * u))
        for t in range(-2, 3): cv.set(x, int(round(yc + t)), WD[4] if t < 0 else WD[3] if t < 2 else WD[2])
    ivy_cover(cv, [(x, 15 - 12 * math.sqrt(max(0, 1 - ((x + 0.5 - 24) / 21.0) ** 2))) for x in range(3, 46)], seed=5, thick=4)
    for x0 in (2, 38):
        ivy_blob(cv, x0 + 4, 30, 6, 12, 9)
    return cv.im

# ---------------------------------------------------------------- ivy / bush painting
def ivy_blob(cv, cx, cy, rx, ry, seed, flowers=True, k=1.0):
    for y in range(int(cy - ry) - 2, int(cy + ry) + 3):
        for x in range(int(cx - rx) - 2, int(cx + rx) + 3):
            dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry; r2 = dx * dx + dy * dy
            wob = (H(x // 2, y // 2, seed) - 0.5) * 0.5
            if r2 > 1 + wob: continue
            lit = -(dx * 0.5 + dy * 0.75) + (H(x, y, seed + 3) - 0.5) * 0.7
            t = 5 if lit > 0.55 else 4 if lit > 0.15 else 3 if lit > -0.25 else 2
            if r2 > 0.8: t -= 1
            if H(x // 2, y // 2, seed + 9) > 0.86: t += 1
            cv.set(x, y, LF[max(1, min(6, t))])
    if flowers:
        for i in range(3):
            fx = int(cx - rx * 0.6 + H(i, seed, 1) * rx * 1.2); fy = int(cy - ry * 0.5 + H(i, seed, 2) * ry * 1.0)
            if cv.get(fx, fy)[3]: cv.set(fx, fy, PL[6]); cv.set(fx, fy + 1, PL[4]) if cv.get(fx, fy + 1)[3] else None

def ivy_cover(cv, pts, seed=1, thick=3):
    for i, (x, y) in enumerate(pts):
        if i % 2 == 0:
            ivy_blob(cv, x, y, thick + H(i, seed, 4) * 2, thick + H(i, seed, 5), seed + i, flowers=(i % 9 == 0))

def ivy_strand(cv, x, y0, y1, seed, w=3):
    """Vine hanging down: a wobbling stem with alternating leaf pairs."""
    for y in range(y0, y1):
        xx = x + int(round(math.sin(y * 0.35 + seed) * 1.2))
        cv.set(xx, y, LF[2]); cv.set(xx + 1, y, LF[3])
        if y % 3 == 0:
            s = -1 if (y // 3) % 2 else 1
            for k in range(1, w + 1):
                cv.set(xx + s * k, y, LF[4] if k < w else LF[5]); cv.set(xx + s * k, y + 1, LF[3])
    cv.set(x + int(round(math.sin(y1 * 0.35 + seed) * 1.2)), y1, LF[5])

def bush(kind):
    """The chipset's own round bushes (2x2 cells), placed at wall feet."""
    src = {'c': (336, 512), 'e': (368, 560)}[kind]
    return pz.chip(src[0], src[1], 32, 32)

def ivy_eave(side):
    """3x3 cells of ivy hanging over a roof end and the wall head below it (side 'l' / 'r')."""
    W, Hh = 48, 48; cv = Cv(W, Hh); s = 1 if side == 'l' else -1
    def X(x): return x if side == 'l' else W - 1 - x
    for (cx, cy, rx, ry, sd) in ((9, 8, 10, 7, 1), (22, 5, 8, 5, 2), (5, 20, 6, 8, 3), (16, 16, 6, 5, 4)):
        ivy_blob(cv, X(cx), cy, rx, ry, sd * 11 + (0 if side == 'l' else 50))
    for (x, y0, y1, sd) in ((3, 20, 44, 1), (11, 16, 38, 2), (18, 15, 30, 3), (26, 8, 20, 4)):
        ivy_strand(cv, X(x), y0, y1, sd + (0 if side == 'l' else 7))
    return cv.im

def ivy_wall(var):
    """1x3 cells of vine climbing a pilaster: a twisting stem with many small leaf clusters of different sizes."""
    cv = Cv(16, 48); sd = 3 if var == 'a' else 11; xc = 7.0
    n = 0
    for y in range(0, 47, 3):
        xc_ = 7 + 2.2 * math.sin(y * 0.22 + sd) + (H(y, sd, 1) - 0.5) * 1.5
        cv.set(int(xc_), y, LF[2]); cv.set(int(xc_) + 1, y, LF[3]); cv.set(int(xc_), y + 1, LF[2]); cv.set(int(xc_) + 1, y + 1, LF[2])
        side = -1 if n % 2 else 1; n += 1
        rr = 2.0 + H(y, sd, 2) * 1.6
        ivy_blob(cv, xc_ + side * (2.5 + H(y, sd, 3) * 2), y + 1 + (H(y, sd, 4) - 0.5) * 3, rr, rr * 0.9, sd * 7 + y, flowers=False)
        if H(y, sd, 6) > 0.45:
            ivy_blob(cv, xc_ - side * (2 + H(y, sd, 7) * 1.5), y + 3, 1.8 + H(y, sd, 8), 1.7, sd * 5 + y, flowers=(H(y, sd, 9) > 0.6))
    return cv.im

def flower_patch(seed=0):
    """1x1 low flower clump for the garden beds (transparent around it)."""
    cv = Cv(16, 16)
    cols = [RD[4], PL[6], SW[5], RD[5], PL[5], (0x7e, 0x7a, 0x8b)]
    for i in range(11):
        x = 2 + int(H(i, seed, 1) * 11); y = 6 + int(H(i, seed, 2) * 7)
        for dx, dy in ((0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (1, 2), (-1, 1)): cv.set(x + dx, y + dy, LF[2] if dy > 0 and dx else LF[3] if dx < 2 else LF[4])
        c = cols[(i + seed) % len(cols)]; cv.set(x, y - 1, c); cv.set(x + 1, y - 1, c); cv.set(x + 1, y - 2, mul(c, 1.12)); cv.set(x + 2, y - 1, mul(c, 0.85))
    return pz.fin(cv.im)

# ---------------------------------------------------------------- formal garden
def shrub_tub(seed=2):
    """Round clipped shrub in a wooden barrel, 1x2 cells (ref: leafy round shrubs in tubs beside the cypresses)."""
    W, Hh = 16, 32; im = Image.new('RGBA', (W, Hh)); px = im.load()
    cl = [(8, 12, 7.4, 6.6), (5.5, 14, 4.4, 4.2), (11, 14, 4.4, 4.2), (8, 9, 5, 4.4)]
    roman.clumps(px, W, Hh, cl, dark=0, seed=seed)
    im = pz.fin(im); cv = Cv(W, Hh, im); by = Hh - 12
    for y in range(by, Hh):
        t = (y - by) / 11.0; half = 6.6 + 0.9 * math.sin(t * math.pi)
        for x in range(W):
            d = x + 0.5 - 8
            if abs(d) > half: continue
            u = d / half; c = WD[5] if u < -0.55 else WD[4] if u < 0.05 else WD[3] if u < 0.6 else WD[2]
            if abs(d) > half - 1: c = WD[1]
            if y in (by + 3, by + 4, by + 8, by + 9): c = ST[3] if u < 0.1 else ST[2]
            cv.set(x, y, c)
    for x in range(2, 14): cv.set(x, by, WD[6])
    for x in range(4, 12): cv.set(x, by + 1, WD[1])
    cv.hl(3, 13, Hh - 1, WD[1])
    return cv.im

def cobble_lo(size, cells, seed=4):
    """Lower picture: irregular rounded cobbles (chipset stone + warm mauve), courses continuous across cells, curb where the path ends.
    cells = set of (cx,cy) path cells."""
    W, Hh = size; im = Image.new('RGBA', size, (0, 0, 0, 0)); p = im.load()
    def is_path(cx, cy): return (cx, cy) in cells
    rows = {}
    for r in range(Hh // 5 + 2):                                      # stone boundaries per course
        xs = [-int(H(r, 1, seed) * 6)]; k = 0
        while xs[-1] < W + 10:
            k += 1; xs.append(xs[-1] + 5 + int(H(r, k, seed + 2) * 5))
        rows[r] = xs
    tones = (ST[4], ST[5], PL[3], PL[2], ST[4], PL[3])
    for (cx, cy) in cells:
        for y in range(cy * T, cy * T + T):
            r = y // 5; iy = y % 5; xs = rows[r]
            for x in range(cx * T, cx * T + T):
                i = max(j for j in range(len(xs) - 1) if xs[j] <= x); x0, x1 = xs[i], xs[i + 1]
                hs = H(i, r, seed + 5); base = tones[int(hs * len(tones))]
                base = mul(base, 0.93 + 0.14 * H(i, r, seed + 6))
                c = base; ix = x - x0; wdt = x1 - x0
                if ix == wdt - 1 or iy == 4: c = ST[2] if hs < 0.5 else ST[3]                       # joint
                elif (ix == 0 and iy in (0, 3)) or (ix == wdt - 2 and iy in (0, 3)): c = ST[3]        # rounded corners
                elif iy == 0 or ix == 0: c = mul(base, 1.12)
                elif iy == 3 or ix == wdt - 2: c = mul(base, 0.86)
                lx, ly = x - cx * T, y - cy * T
                edge = ((lx == 0 and not is_path(cx - 1, cy)) or (lx == 15 and not is_path(cx + 1, cy)) or
                        (ly == 0 and not is_path(cx, cy - 1) and cy > 0) or (ly == 15 and not is_path(cx, cy + 1)))
                if edge: c = ST[3]
                p[x, y] = c + (255,)
    return im

def garden_formal():
    Wc, Hc = 17, 9; size = (Wc * T, Hc * T)
    path = {(x, y) for y in range(Hc) for x in (7, 8, 9)} | {(x, 4) for x in range(Wc)}
    lo = cobble_lo(size, path)
    up = Image.new('RGBA', size); over = {}; items = []
    for bx in (1, 11):
        for by in (1, 5):
            sd = bx + by
            up.alpha_composite(hedge_run(5, 1, seed=3 + sd), (bx * T, by * T))
            up.alpha_composite(hedge_run(5, 1, seed=8 + sd), (bx * T, (by + 2) * T))
            for x in range(bx, bx + 5): over[(x, by)] = 'X'; over[(x, by + 2)] = 'X'
            items += [(by + 1, 'cyp', bx), (by + 1, 'shr', bx + 2), (by + 1, 'cyp', bx + 4)]
            for k, px_ in enumerate((bx + 1, bx + 3)):
                up.alpha_composite(flower_patch(sd + k * 3), (px_ * T, (by + 1) * T)); over[(px_, by + 1)] = 'X'
    for by in (1, 5): items += [(by + 1, 'lamp', 6), (by + 1, 'lamp', 10)]
    cyps = [cypress_tub(3, 1), cypress_tub(3, 4)]; shr = shrub_tub(); lamp = lamp_post(3)
    for (yb, kind, x) in sorted(items, key=lambda t: (t[0], t[2])):
        if kind == 'cyp': im_, rows = cyps[(x // 4) % 2], 3
        elif kind == 'shr': im_, rows = shr, 2
        else: im_, rows = lamp, 3
        up.alpha_composite(im_, (x * T, (yb - rows + 1) * T))
        over[(x, yb)] = 'X'
        for k in range(1, rows):
            if over.get((x, yb - k)) != 'X': over[(x, yb - k)] = 'C'
    return up, lo, over

def garden_gate():
    Wc, Hc = 5, 3; size = (Wc * T, Hc * T)
    cv = Cv(*size)
    cv.paste(roman.gate_pier(True), 0, 0); cv.paste(roman.gate_pier(True), 4 * T, 0)
    for (x0, sd) in ((17, 1), (58, -1)):                              # open leaves folded against the piers: bars with spear tips
        for i in range(6):
            x = x0 + i * (1 if sd > 0 else 1)
            for y in range(24, 46):
                cv.set(x, y, ST[4] if i % 2 == 0 else ST[2])
            if i % 2 == 0: cv.set(x, 22, SW[5]); cv.set(x, 23, SW[4])
        for y in (24, 34, 45): cv.hl(x0, x0 + 6, y, ST[5]); cv.hl(x0, x0 + 6, y + 1, ST[1])
    for x in range(16, 64):                                           # wrought-iron arch between the piers with a hanging lantern
        u = (x + 0.5 - 40) / 24.0
        yy = 22 - int(round(11 * (1 - u * u)))
        cv.set(x, yy, ST[5]); cv.set(x, yy + 1, ST[3]); cv.set(x, yy + 2, ST[1]) if abs(u) > 0.15 else None
        if x % 5 == 2 and abs(u) < 0.9: cv.set(x, yy + 3, ST[3]); cv.set(x, yy + 4, ST[3]) if False else None
    for y in range(12, 15): cv.set(39, y, ST[3]); cv.set(40, y, ST[1])
    for yy in range(15, 21):
        cv.set(38, yy, ST[2]); cv.set(41, yy, ST[1])
        for xx in (39, 40): cv.set(xx, yy, SW[6] if yy < 17 and xx == 39 else SW[5] if yy < 19 else SW[4])
    cv.hl(38, 42, 21, ST[2]); cv.set(39, 11, SW[6]); cv.set(40, 11, SW[4])
    up = cv.im
    lo = cobble_lo(size, {(1, 1), (2, 1), (3, 1), (1, 2), (2, 2), (3, 2)})
    return up, lo

def build_gardens():
    up, lo, over = garden_formal()
    walk = autowalk(up, lo, over=over)
    K.save_kit('bd-garden-formal', '정형 정원 (대칭 자갈 십자길·산울타리·사이프러스 통)', up, walk,
               '17x9칸 대칭 정형 정원(저택 참고 그림): 3칸 폭 자갈 중심길(현관 계단과 같은 폭)과 가로길 셋·바깥 세로길, 네 화단마다 위아래 산울타리, 바깥쪽 통 속 사이프러스, 가운데 통 속 둥근 관목, 안쪽 쌍등 가로등. 길은 아래 그림(걷기), 나머지는 위 그림.',
               '저택 바로 아래에 붙인다: 정원 x = 저택 x + (저택 문 칸 x - 8), 정원 y = 저택 y + 저택 높이(계단 끝). bd-manor-timber/vine 은 문 칸 x=8, 높이 12 → 같은 x, y+12 에 놓으면 정원 (8,0) 길칸이 계단 바로 아래에 이어진다. 화단 잔디 칸은 비워 둬 맵의 잔디가 보인다.',
               ['귀족저택', '정원', '대칭', '정형'], role='garden', lo=lo,
               notes='STAMP: garden.x = manor.x + (manor door dx - 8), garden.y = manor.y + manor.h. For bd-manor-timber / bd-manor-vine (door dx 8, h 12) that is the same x and y+12: the garden path cell (8,0) then sits directly under the stairs cell (8,11). For bd-manor-tower (door dx 9, h 11) use x-1, y+11. For bd-manor-small (door dx 5, h 12) use x+3, y+12 (the garden is 17 wide).')
    up, lo = garden_gate()
    walk = autowalk(up, lo, over={(1, 1): 'F', (2, 1): 'F', (3, 1): 'F', (1, 2): 'F', (2, 2): 'F', (3, 2): 'F', (1, 0): 'C', (2, 0): 'C', (3, 0): 'C', (0, 0): 'X', (4, 0): 'X', (0, 1): 'X', (4, 1): 'X', (0, 2): 'X', (4, 2): 'X'})
    K.save_kit('bd-garden-gate', '정원 정문 (돌기둥·열린 쇠문)', up, walk,
               '5x3칸: 항아리 얹은 돌기둥 둘 사이 3칸 쇠문(활짝 열려 기둥 쪽에 접혀 있음), 바닥은 자갈. 가운데 세 칸은 걸을 수 있다.',
               '정원 아래쪽 끝 가운데 길(7~9칸) 위에 놓는다: 게이트 x = 정원 x + 6, y = 정원 y + 8.', ['귀족저택', '정원', '문'], role='garden', lo=lo, doors=[],
               notes='STAMP: gate.x = garden.x + 6 (path cells 7..9 of the formal garden), gate.y = garden.y + 8 (the gate cobble rows 1-2 continue the path; garden path rows are y+0..y+8, so the gate overlaps the last path row).')
    return ['bd-garden-formal', 'bd-garden-gate']

# ---------------------------------------------------------------- generic helpers for saving
def autowalk(up, lo=None, thresh=0.22, over=None, force_x=()):
    """Collision string list from the pictures: covered >= thresh -> X, partly covered -> C, empty -> '.', opaque lower cell -> F."""
    over = over or {}
    A = np.array(up)[..., 3]; L = np.array(lo)[..., 3] if lo is not None else None
    Wc, Hc = up.width // T, up.height // T; rows = []
    for y in range(Hc):
        r = ''
        for x in range(Wc):
            if (x, y) in over: r += over[(x, y)]; continue
            cov = float((A[y * T:(y + 1) * T, x * T:(x + 1) * T] > 0).mean())
            fl = L is not None and bool((L[y * T:(y + 1) * T, x * T:(x + 1) * T] == 255).all())
            if cov == 0: r += 'F' if fl else '.'
            elif fl and cov < 0.5: r += 'F'
            elif cov >= thresh or (x, y) in force_x: r += 'X'
            else: r += 'C'
        rows.append(r)
    return rows

def compose(size, assembly, extra=()):
    """Composite saved part kits (upper + lower) at cell offsets exactly like validate() does."""
    up = Image.new('RGBA', size); lo = Image.new('RGBA', size)
    for kid, x, y in assembly:
        _, pu, pl_ = K.load_kit(kid); up.alpha_composite(pu, (x * T, y * T))
        if pl_ is not None: lo.alpha_composite(pl_, (x * T, y * T))
    return up, (lo if np.array(lo)[..., 3].any() else None)

PARTS = []
def part(kid, name, up, description, rules, tags, lo=None, over=None, thresh=0.22, notes=None):
    Wc, Hc = up.width // T, up.height // T
    walk = autowalk(up, lo, thresh=thresh, over=over)
    K.save_kit(kid, name, up, walk, description, rules, ['귀족저택', '부품'] + list(tags), role='part', lo=lo, notes=notes)
    PARTS.append(kid)

def build_parts():
    # ---- roof
    part('bd-mpart-roof-l', '저택 지붕 좌끝(4면 지붕)', roof_part('l'), '가파른 테라코타 4면 지붕의 왼쪽 끝 3칸x3줄. 왼쪽 처마 모서리와 마룻대.', '지붕줄은 좌끝 + 가운데x n + 우끝으로 잇고 그 아래 벽 5줄을 둔다.', ['지붕'])
    part('bd-mpart-roof-m', '저택 지붕 가운데', roof_part('m'), '테라코타 앞 경사 1칸x3줄. 좌우로 이어 붙인다.', '좌끝 지붕과 우끝 지붕 사이에 필요한 만큼 반복.', ['지붕'])
    part('bd-mpart-roof-r', '저택 지붕 우끝(4면 지붕)', roof_part('r'), '테라코타 4면 지붕의 오른쪽 끝 3칸x3줄(그늘진 쪽).', '가운데 지붕의 오른쪽 끝에 놓는다.', ['지붕'])
    # ---- wall bays
    for var in ('a', 'b', 'lit'):
        for side in ('l', 'r'):
            nm = {'a': '붉은 꽃', 'b': '흰 꽃·초록 틀', 'lit': '불 켠 창'}[var]
            part(f'bd-mpart-bay-win-{var}-{side}', f'저택 창 벽칸 {nm} ({"왼" if side=="l" else "오른"}기둥)',
                 bay('win', side, var), '반목조 회벽 1칸x5줄: 위아래 층 사이 띠(귀틀+돌 턱), 둥근 아치 창(위층 낮은 창·아래층 긴 창), 아래층 창 밑 꽃상자, 돌 받침. ' + nm + '.',
                 f'{"왼" if side=="l" else "오른"}쪽 날개는 {side} 칸을 쓴다(축 기준 대칭). 창 칸과 민벽 칸을 번갈아 세운다. 다섯 줄 모두 막힘.', ['벽', '창'])
    for side in ('l', 'r'):
        part(f'bd-mpart-bay-plain-{side}', f'저택 민벽 벽칸 ({"왼" if side=="l" else "오른"}기둥)', bay('plain', side),
             '반목조 회벽 1칸x5줄: 곡선 버팀목 두 개와 벽등. 창 칸 사이에 끼운다.', '창 칸 사이 간격 메우기. 막힘.', ['벽'])
    part('bd-mpart-door-bay', '저택 현관 벽칸(3칸)', door_bay(), '3칸x5줄: 위층 큰 아치 창+꽃상자, 아래층 돌 문틀과 겹문, 좌우 벽등. 문은 가운데 칸.', '문 칸은 (1,3)~(1,4) 가운데 칸. 앞에 bd-mpart-porch 와 bd-mpart-stairs 를 붙인다.', ['벽', '문'])
    part('bd-mpart-gable', '저택 가운데 박공(급경사)', gable_block(), '5칸x4줄: 가운데 앞으로 튀어나온 가파른 박공. 용마루 끝 장식, 박공 벽에 둥근 창과 아치 창 셋(꽃상자), 아래 들보. 좌우에 옆 경사 지붕.', '기본 지붕줄(3줄) 위 가운데 5칸에 (x,1)로 얹는다. 박공 아래 벽은 한 줄 더 내려 (x,5)부터 시작.', ['박공'])
    part('bd-mpart-gable-s', '현관 위 벽 박공(3칸)', gable_block(3, 3, 44, 48), '3x3칸: 지붕을 뚫고 오르는 급경사 벽 박공(현관 위). 아치 창 하나와 꽃상자, 꼭대기 장식.', '지붕 3줄(y+1~y+3) 위, 현관 벽칸(3칸) 바로 위에 얹는다. 박공 밑변이 벽 머리와 만난다.', ['박공'])
    part('bd-mpart-dormer', '지붕 창(다락 박공창)', dormer('a'), '2x2칸 다락 지붕창: 작은 박공 지붕, 아치 창. 지붕 앞 경사 처마 바로 위에 얹는다.', '지붕 3줄의 아래 두 줄(y+1,y+2)에 얹는다. 좌우 끝 사면에는 놓지 않는다.', ['지붕창'])
    part('bd-mpart-dormer-lit', '지붕 창(불 켠 창)', dormer('b', True), '2x2칸 다락 지붕창: 불 켠 창, 초록 창틀.', '지붕 창과 같음.', ['지붕창'])
    part('bd-mpart-porch', '기둥 박공 현관 지붕', porch(), '3x3칸: 낮은 박공(페디먼트)과 들보, 흰 기둥 둘. 기둥 사이는 비어 문이 보인다.', 'bd-mpart-door-bay 위에 3칸 폭으로 겹친다(문 칸 앞). 기둥 칸은 막힘, 가운데 칸 위쪽은 막힘.', ['현관'])
    su, sl = stairs()
    part('bd-mpart-stairs', '돌계단과 끝장식 기둥', su, '5x2칸: 가운데 3칸은 걸을 수 있는 돌계단(아래 그림), 양옆에 꼭지 장식이 있는 돌기둥(막힘).', '현관 앞 바로 아래(문 칸 바로 밑이 계단 맨 윗칸).', ['현관'], lo=sl, over={(1, 0): 'F', (2, 0): 'F', (3, 0): 'F', (1, 1): 'F', (2, 1): 'F', (3, 1): 'F'})
    part('bd-mpart-tower', '저택 둥근 옆탑(원뿔 지붕)', round_tower(), '3x9칸: 회벽 둥근 탑신(층마다 아치 창·띠, 아래 돌 받침)과 테라코타 원뿔 지붕, 꼭대기 장식. 본채 옆에 붙인다.', '본채 지붕줄 왼쪽(또는 오른쪽) 끝에 겹쳐 세운다(탑이 본채 앞). 원뿔 꼭대기 칸은 걸을 수 있고 나머지는 막힘.', ['탑'], over={(1, 0): 'C', (0, 1): 'C', (2, 1): 'C'})
    part('bd-mpart-ivy-arch', '담쟁이 아치(정원 입구)', ivy_arch(), '3x3칸: 돌기둥 둘 위에 담쟁이 덩굴 아치. 가운데 칸 아래는 지나갈 수 있다(아치 윗부분은 캐릭터 위에 그려짐).', '정원 길 위에 세운다. 양옆 기둥 칸은 막힘.', ['정원', '아치'], over={(1, 0): 'C', (1, 1): '.', (1, 2): '.'})
    part('bd-mpart-cypress-tub', '통 속 사이프러스', cypress_tub(), '1x3칸: 나무통(쇠테)에 심은 키 큰 사이프러스. 통 칸만 막힘.', '정형 정원 모서리·문 옆에 놓는다.', ['정원', '나무'], over={(0, 0): 'C', (0, 1): 'C'})
    part('bd-mpart-lamp-post', '정원 가로등(쌍등)', lamp_post(), '1x3칸 쇠 기둥에 두 갈래 초롱등. 돌 받침 칸만 막힘.', '정원 길 양옆에 마주 보게 놓는다.', ['정원', '가로등'], over={(0, 0): 'C', (0, 1): 'C'})
    part('bd-mpart-shrub-tub', '통 속 둥근 관목', shrub_tub(), '1x2칸: 나무통(쇠테)에 심은 둥근 손질 관목(칩셋 잎 결). 통 칸만 막힘.', '정형 정원 화단 가운데에 놓는다.', ['정원', '나무'], over={(0, 0): 'C'})
    part('bd-mpart-flower-patch', '화단 꽃무더기', flower_patch(), '1x1칸 낮은 꽃무더기(붉은·흰·노랑·연보라), 둘레는 투명.', '정형 정원 화단 잔디 칸에 놓는다. 막힘.', ['정원', '꽃'])
    part('bd-mpart-hedge', '다듬은 산울타리 조각', hedge_run(1), '1x1칸 다듬은 산울타리(칩셋 잎 결). 이어 붙여 낮은 울타리로 쓴다.', '가로로 이어 붙임. 막힘.', ['정원', '산울타리'])
    part('bd-mpart-low-wall', '낮은 정원 돌담 조각', low_wall('wall'), '1x1칸 낮은 돌담(턱 돌 얹음). 가로로 이어 붙인다.', '막힘.', ['정원', '담'])
    part('bd-mpart-rail', '낮은 난간(난간동자) 조각', low_wall('rail'), '1x1칸 돌 난간동자 난간. 가로로 이어 붙인다.', '막힘.', ['정원', '난간'])
    part('bd-mpart-ivy-eave-l', '담쟁이(처마 왼쪽)', ivy_eave('l'), '3x3칸 투명 덧그림: 지붕 왼쪽 끝과 벽머리에 늘어진 담쟁이.', '변형(덩굴) 저택에서 지붕 좌끝 아래 (0,2)부터 겹친다. 그림만 있고 충돌은 아래 부품을 따른다.', ['담쟁이'])
    part('bd-mpart-ivy-eave-r', '담쟁이(처마 오른쪽)', ivy_eave('r'), '3x3칸 투명 덧그림: 지붕 오른쪽 끝과 벽머리에 늘어진 담쟁이.', '지붕 우끝 아래에 겹친다.', ['담쟁이'])
    part('bd-mpart-ivy-wall-a', '담쟁이(벽 기둥 타고)', ivy_wall('a'), '1x3칸 투명 덧그림: 벽 기둥을 타고 오르는 덩굴 (변형 a).', '벽칸 위에 겹친다.', ['담쟁이'])
    part('bd-mpart-ivy-wall-b', '담쟁이(벽 기둥 타고) b', ivy_wall('b'), '1x3칸 투명 덧그림: 벽 기둥을 타고 오르는 덩굴 (변형 b).', '벽칸 위에 겹친다.', ['담쟁이'])
    part('bd-mpart-bush-c', '벽 밑 덤불(짙은 둥근)', bush('c'), '2x2칸 칩셋 둥근 덤불(짙은 색). 벽 밑을 가린다.', '벽 아래 두 줄에 겹친다. 이미 막힌 벽칸 위에만 놓는다.', ['덤불'])
    part('bd-mpart-bush-e', '벽 밑 덤불(밝은 둥근)', bush('e'), '2x2칸 칩셋 둥근 덤불(밝은 색). 벽 밑을 가린다.', '벽 아래 두 줄에 겹친다. 이미 막힌 벽칸 위에만 놓는다.', ['덤불'])
    part('bd-mpart-chimney', '저택 굴뚝', chimney(), '1x2칸 붉은 벽돌 굴뚝(돌 갓). 지붕 마룻대 위에 올린다.', '윗칸(꼭대기)은 지붕 위로 삐져나오는 부분이라 걸을 수 있음, 아랫칸은 지붕에 박힘.', ['굴뚝'], over={(0, 0): 'C'})
    return PARTS

# ---------------------------------------------------------------- full manors = parts at cell offsets
BUILDINGS = []
def building(kid, name, size, assembly, description, rules, tags, doors, over=None, notes=None, thresh=0.22):
    up, lo = compose(size, assembly)
    walk = autowalk(up, lo, thresh=thresh, over=over)
    K.save_kit(kid, name, up, walk, description, rules, ['귀족저택'] + list(tags), role='building', lo=lo, doors=doors, notes=notes, assembly=assembly)
    BUILDINGS.append(kid)

def timber_assembly():
    a = [('bd-mpart-roof-l', 0, 1)] + [('bd-mpart-roof-m', x, 1) for x in range(3, 14)] + [('bd-mpart-roof-r', 14, 1)]
    a += [('bd-mpart-gable', 6, 1), ('bd-mpart-dormer', 2, 2), ('bd-mpart-dormer-lit', 13, 2)]
    a += [('bd-mpart-chimney', 5, 0), ('bd-mpart-chimney', 11, 0)]
    left = [('win-b', 'l'), ('plain', 'l'), ('win-a', 'l'), ('plain', 'l'), ('win-lit', 'l'), ('plain', 'l')]
    right = [('plain', 'r'), ('win-a', 'r'), ('plain', 'r'), ('win-b', 'r'), ('plain', 'r'), ('win-a', 'r')]
    for i, (k, sd) in enumerate(left): a.append((f'bd-mpart-bay-{k}-{sd}', i, 4))
    for i, (k, sd) in enumerate(right): a.append((f'bd-mpart-bay-{k}-{sd}', 11 + i, 4))
    a += [('bd-mpart-bay-win-a-l', 6, 5), ('bd-mpart-door-bay', 7, 5), ('bd-mpart-bay-win-b-r', 10, 5)]
    a += [('bd-mpart-porch', 7, 7), ('bd-mpart-stairs', 6, 10)]
    return a

def tower_assembly():
    a = [('bd-mpart-roof-l', 2, 1)] + [('bd-mpart-roof-m', x, 1) for x in range(5, 11)] + [('bd-mpart-roof-r', 11, 1)]
    a += [('bd-mpart-dormer', 5, 2), ('bd-mpart-gable-s', 8, 1), ('bd-mpart-chimney', 7, 0)]
    for i, k in enumerate(['plain-l', 'win-a-l', 'plain-l', 'win-b-l', 'plain-l', 'win-a-l']): a.append((f'bd-mpart-bay-{k}', 2 + i, 4))
    a.append(('bd-mpart-door-bay', 8, 4))
    for i, k in enumerate(['win-lit-r', 'plain-r', 'win-b-r']): a.append((f'bd-mpart-bay-{k}', 11 + i, 4))
    a += [('bd-mpart-porch', 8, 6), ('bd-mpart-stairs', 7, 9), ('bd-mpart-tower', 0, 0)]
    return a

def vine_assembly():
    a = timber_assembly()
    a += [('bd-mpart-ivy-eave-l', 0, 2), ('bd-mpart-ivy-eave-r', 14, 2)]
    a += [('bd-mpart-ivy-wall-a', 1, 5), ('bd-mpart-ivy-wall-b', 4, 5), ('bd-mpart-ivy-wall-b', 12, 5), ('bd-mpart-ivy-wall-a', 15, 4),
          ('bd-mpart-ivy-wall-a', 7, 7), ('bd-mpart-ivy-wall-b', 9, 7), ('bd-mpart-ivy-wall-a', 5, 4)]
    a += [('bd-mpart-bush-c', 1, 7), ('bd-mpart-bush-e', 4, 7), ('bd-mpart-bush-e', 11, 7), ('bd-mpart-bush-c', 14, 7), ('bd-mpart-bush-c', 5, 8), ('bd-mpart-bush-e', 10, 8)]
    return a

def small_assembly():
    a = [('bd-mpart-roof-l', 0, 1)] + [('bd-mpart-roof-m', x, 1) for x in range(3, 8)] + [('bd-mpart-roof-r', 8, 1)]
    a += [('bd-mpart-gable', 3, 1), ('bd-mpart-chimney', 3, 0), ('bd-mpart-chimney', 7, 0)]
    for i, k in enumerate(['win-a-l', 'plain-l', 'win-lit-l']): a.append((f'bd-mpart-bay-{k}', i, 4))
    for i, k in enumerate(['win-b-r', 'plain-r', 'win-a-r']): a.append((f'bd-mpart-bay-{k}', 8 + i, 4))
    a += [('bd-mpart-bay-win-b-l', 3, 5), ('bd-mpart-door-bay', 4, 5), ('bd-mpart-bay-win-a-r', 7, 5), ('bd-mpart-porch', 4, 7), ('bd-mpart-stairs', 3, 10)]
    return a

def build_buildings():
    building('bd-manor-timber', '귀족 저택 (반목조, 가운데 박공)', (17 * T, 12 * T), timber_assembly(),
             '좌우 대칭 17칸x12줄 반목조 저택: 가파른 테라코타 4면 지붕, 가운데 5칸 급경사 박공(창 넷·둥근 창), 양 날개 지붕창·굴뚝, 아치 창과 꽃상자가 달린 벽칸 열과 층 사이 띠, 기둥 둘 박공 현관, 꼭지 장식 돌기둥 계단.',
             '문은 (8,9). 문 앞 (8,10)은 계단 맨 윗칸(걸음). 정원 bd-garden-formal 은 같은 x 에서 바로 아래(y=12)에 붙인다.', ['반목조', '대칭'], [(8, 9, '현관 겹문 (계단 위)')], over={(5, 0): 'C', (11, 0): 'C'})
    building('bd-manor-tower', '귀족 저택 (둥근 탑 딸린 본채)', (14 * T, 11 * T), tower_assembly(),
             '비대칭 14칸x11줄: 왼쪽에 3칸 둥근 회벽 탑(원뿔 테라코타 지붕, 층마다 아치 창), 오른쪽으로 길게 4면 지붕 본채(지붕창·현관 위 벽 박공·굴뚝), 문은 본채 오른쪽 3칸 현관(박공 지붕 기둥 현관, 꼭지 장식 계단).',
             '문은 (9,8). 문 앞 (9,9)은 계단 맨 윗칸. 탑 아래쪽은 본채 앞 마당 쪽으로 튀어나오지 않아 같은 바닥선을 쓴다.', ['탑', '비대칭'], [(9, 8, '현관 겹문 (계단 위)')], over={(1, 0): 'C', (0, 1): 'C', (7, 0): 'C'})
    building('bd-manor-vine', '귀족 저택 (담쟁이 덮인 반목조)', (17 * T, 12 * T), vine_assembly(),
             'bd-manor-timber 와 같은 뼈대에 담쟁이(지붕 좌우 끝, 벽 기둥, 현관 기둥)와 벽 밑 덤불을 얹은 변형. 오래된 저택 느낌.',
             '문은 (8,9). 충돌은 timber 와 같고 덤불이 앉은 칸은 막힘.', ['반목조', '대칭', '담쟁이'], [(8, 9, '현관 겹문 (계단 위)')], over={(5, 0): 'C', (11, 0): 'C'})
    building('bd-manor-small', '작은 저택 (반목조 11칸)', (11 * T, 12 * T), small_assembly(),
             '11칸x12줄 작은 대칭 저택: 4면 지붕, 가운데 5칸 박공, 좌우 3칸 날개(굴뚝 둘), 창 열, 기둥 현관과 끝장식 계단.',
             '문은 (5,9). 문 앞 (5,10)은 계단 맨 윗칸.', ['반목조', '대칭', '작은'], [(5, 9, '현관 겹문 (계단 위)')], over={(3, 0): 'C', (7, 0): 'C'})
    return BUILDINGS

if __name__ == '__main__':
    ids = build_parts() + build_buildings() + build_gardens()
    print(len(ids), 'kits')
