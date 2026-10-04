# Round 2 (v7) kit family: 버들항 OUTSKIRTS WOODEN HOUSES (성 밖 외곽 나무집), ids bd-out-*.
# Reference: tiledata/city-refs/outskirts-wooden-houses.png (log/plank houses, steep brown shingle roofs, sand path, cobble plaza).
# Everything is a cell-piece assembly: PART kits (roof pieces, wall bays, gable blocks, chimney, shed, ivy, sign) are drawn once,
# saved as role "part", and the full houses are composed from them with assembly=[(part,x,y),...] (validate() checks equality).
# Run `python3 kits7_outskirts.py` to (re)create every kit deterministically (no randomness outside hash()).
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from PIL import Image
import kits7_common as K
from px2 import _hash
T = 16

def rgb(s):
    s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
def H(x, y, s=0): return _hash(int(x), int(y), int(s))
def mix(a, b, t): return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3)) + (255,)
def dark(c, k): return (int(c[0] * k), int(c[1] * k), min(255, int(c[2] * k * 1.08)), c[3])

# ---- chipset colours (all sampled from jungle-chipset-v6 / the palette ramps) ----
WD = dict(hi=rgb('#c69250'), lit=rgb('#a26e36'), mid=rgb('#885a26'), mid2=rgb('#744c2a'), lo=rgb('#5e3a1c'), dk=rgb('#452a17'), deep=rgb('#312210'),
          warm=rgb('#e1975a'), pale=rgb('#ffe4ae'), pale2=rgb('#eca660'))
GL = dict(dk=rgb('#212d42'), mid=rgb('#3fa2ae'), hi=rgb('#a7d4db'), deep=rgb('#071528'))
LF = dict(dk=rgb('#205030'), mid=rgb('#4b8232'), lit=rgb('#73b83e'), hi=rgb('#8fd24a'), deep=rgb('#143a27'))
ST = dict(hi=rgb('#dee0dd'), lit=rgb('#c4c6c3'), mid=rgb('#929491'), lo=rgb('#595b58'), dk=rgb('#3e403d'), deep=rgb('#2b3934'))
MAUVE = dict(hi=rgb('#bcaaa0'), mid=rgb('#9e8d83'), lo=rgb('#703f57'), dk=rgb('#51283d'))

class Cv:
    def __init__(s, w, h):
        s.w, s.h = w, h; s.im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); s.p = s.im.load()
    def set(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.p[x, y] = c
    def get(s, x, y): return s.p[x, y] if 0 <= x < s.w and 0 <= y < s.h else (0, 0, 0, 0)
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1):
            for x in range(x0, x1): s.set(x, y, c)
    def hline(s, x0, x1, y, c):
        for x in range(x0, x1): s.set(x, y, c)
    def vline(s, x, y0, y1, c):
        for y in range(y0, y1): s.set(x, y, c)
    def shade(s, x0, y0, x1, y1, k):
        for y in range(max(0, y0), min(s.h, y1)):
            for x in range(max(0, x0), min(s.w, x1)):
                if s.p[x, y][3]: s.p[x, y] = dark(s.p[x, y], k)
    def paste(s, im, x, y): s.im.alpha_composite(im, (x, y)); s.p = s.im.load()

def outline(im, open_='tblr', k=0.6):
    """Inset outline (like city6.soft_outline) but only along silhouette edges: a cell edge counts as silhouette only on the
    sides in `open_` (t,b,l,r); on the other sides the part continues into its neighbour, so no seam line is drawn."""
    im = im.copy(); p = im.load(); W_, H_ = im.size; edge = []
    for y in range(H_):
        for x in range(W_):
            if p[x, y][3] < 128: continue
            for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < W_ and 0 <= yy < H_: hit = p[xx, yy][3] < 128
                else: hit = ('r' if xx >= W_ else 'l' if xx < 0 else 'b' if yy >= H_ else 't') in open_
                if hit: edge.append((x, y)); break
    for x, y in edge:
        r, g, b, a = p[x, y]; p[x, y] = (int(r * k), int(g * k), min(255, int(b * k * 1.1)), a)
    return im

# ---------------- textures ----------------
def logs(cv, x0, y0, x1, y1, seed=1, flat=False):
    """horizontal log courses, 4 px each (lit top edge, shaded underside). y0 must be a multiple of 4 (course phase).
    flat=True: sawn lap boards (thinner contrast, hairline seams) instead of round logs."""
    for y in range(y0, y1):
        r = (y - y0) % 4; ci = (y - y0) // 4
        tone = 0 if H(ci, 3, seed) < .5 else 1
        if flat: cols = [WD['dk'], WD['mid2'], WD['mid'] if tone else WD['mid2'], WD['mid2']]
        else: cols = [WD['hi'], WD['lit'] if tone == 0 else WD['mid'], WD['mid'] if tone == 0 else WD['mid2'], WD['lo']]
        for x in range(x0, x1):
            c = cols[r]
            if r in (1, 2) and H(x, y, seed) < .07: c = WD['hi'] if r == 1 and not flat else WD['lo']
            cv.set(x, y, c)
        # butt-joint ticks / knots
        if not flat and r in (1, 2):
            for j in range(2):
                kx = x0 + int(H(ci, j, seed + 9) * (x1 - x0 - 2))
                if H(ci, j, seed + 5) < .35 and (x1 - x0) > 6: cv.set(kx, y, WD['dk'])
        if flat and r == 1:
            for x in range(x0, x1): cv.set(x, y, WD['lit'] if H(x // 3, ci, seed) < .35 else WD['mid'])
def planks_v(cv, x0, y0, x1, y1, seed=1):
    """vertical planks 4 px wide: dark seam, light left edge"""
    for x in range(x0, x1):
        q = (x - x0) % 4; pi = (x - x0) // 4; tone = H(pi, 1, seed) < .5
        for y in range(y0, y1):
            c = [WD['dk'], WD['lit'] if not tone else WD['mid'], WD['mid'] if not tone else WD['mid2'], WD['mid2'] if not tone else WD['lo']][q]
            if H(x, y, seed) < .06: c = WD['lo']
            cv.set(x, y, c)
        for j in range(2):        # nail heads
            for yy in (y0 + 2, y1 - 3):
                if q == 1 and H(pi, yy, seed) < .6: cv.set(x, yy, WD['dk'])
def rail(cv, x0, x1, y):
    """a horizontal band (rail) 3 px: lit top, dark under"""
    cv.hline(x0, x1, y, WD['hi']); cv.hline(x0, x1, y + 1, WD['lit']); cv.hline(x0, x1, y + 2, WD['dk'])

# shingles ------------------------------------------------------------------------------------------------
SH = [3, 4, 5, 5, 5, 5, 4, 3]          # visible height of one shingle scale (rows) per column of its 8 px width: rounded tip
def shingles(cv, x0, y0, x1, y1, seed, lit=False, scallop=True, shadowfill=None):
    """front roof slope: courses of 8 px scales (4 rows visible, rounded tips overlapping the course below), alternate courses
    offset by 4. Upper courses are painted last so they overlap. The last course keeps its scalloped edge over the eave shadow."""
    if lit: cols = dict(hi=WD['warm'], a=WD['hi'], b=WD['lit'], lo=WD['mid'], jt=WD['mid2'])
    else: cols = dict(hi=WD['hi'], a=WD['lit'], b=WD['mid'], lo=WD['mid2'], jt=WD['lo'])
    n = (y1 - y0) // 4
    for y in range(y0, y1):
        for x in range(x0, x1): cv.set(x, y, shadowfill or (WD['deep'] if scallop else cols['jt']))
    for ci in range(n - 1, -1, -1):
        off = 4 if ci % 2 else 0
        for x in range(x0 - 8, x1 + 8):
            xm = (x - x0 + off) % 8; sid = (x - x0 + off) // 8
            hgt = SH[xm] if ci < n - 1 else min(SH[xm], 4) - (1 if scallop and xm in (0, 7) else 0) - (1 if scallop and xm in (0, 1, 6, 7) else 0) + (0 if scallop else 1)
            if ci == n - 1 and not scallop: hgt = 4
            tone = H(sid, ci, seed) < .4
            for r in range(hgt):
                y = y0 + ci * 4 + r
                if not (y0 <= y < y1): continue
                if r == hgt - 1: c = cols['lo']                                  # underside of the scale
                elif r == 0: c = cols['hi'] if xm not in (0, 7) else cols['a']
                else: c = cols['a'] if not tone else cols['b']
                if xm == 7 and r not in (0, hgt - 1): c = mix(c, cols['lo'], .5)  # shaded right edge of the scale
                if xm == 0 and r not in (0, hgt - 1): c = mix(c, cols['hi'], .3)
                if r not in (0, hgt - 1) and H(x, y, seed + 2) < .06: c = cols['b'] if not tone else cols['a']
                cv.set(x, y, c)

def eave_shadow(cv, y0, x0=0, x1=None):
    x1 = cv.w if x1 is None else x1
    cv.shade(x0, y0, x1, y0 + 2, .5); cv.shade(x0, y0 + 2, x1, y0 + 4, .72); cv.shade(x0, y0 + 4, x1, y0 + 5, .88)

# ---------------- small motifs ----------------
def window(cv, x0, y0, w=8, h=9, arch=False, shutters=None, sill=True, box=False, seed=0):
    """small window with muntins; x0,y0 = top-left of the frame. shutters=colour or None; box=flower box under the sill"""
    if shutters:
        for sx in (x0 - 3, x0 + w):
            for y in range(y0, y0 + h):
                c = shutters; c = mix(c, WD['deep'], .35) if (y - y0) % 3 == 2 else c
                cv.set(sx, y, c); cv.set(sx + 1, y, mix(c, rgb('#000000'), .1)); cv.set(sx + 2, y, mix(c, WD['deep'], .3))
            cv.vline(sx, y0, y0 + h, mix(shutters, rgb('#ffffff'), .18))
    for y in range(h):
        for x in range(w):
            if arch and ((y == 0 and (x in (0, w - 1) or (w > 7 and x in (1, w - 2)))) or (y == 1 and w > 7 and x in (0, w - 1))): continue
            edge = x in (0, w - 1) or y == 0 or y == h - 1
            if edge: cv.set(x0 + x, y0 + y, WD['hi'] if (x == 0 or y == 0) else WD['lo'])
            else: cv.set(x0 + x, y0 + y, GL['dk'])
    # muntin cross + glass glints
    mx = x0 + w // 2; my = y0 + 1 + (h - 2) // 2
    cv.vline(mx, y0 + 1, y0 + h - 1, WD['lit']); cv.hline(x0 + 1, x0 + w - 1, my, WD['lit'])
    cv.set(x0 + 2, y0 + 2, GL['mid']); cv.set(x0 + 1, y0 + 3, GL['mid']); cv.set(x0 + w - 3, my + 2, GL['mid']); cv.set(x0 + 2, my + 1, GL['hi'])
    if sill:
        cv.hline(x0 - 1, x0 + w + 1, y0 + h, WD['hi']); cv.hline(x0 - 1, x0 + w + 1, y0 + h + 1, WD['lo'])
    if box:
        by = y0 + h + 2
        cv.hline(x0 - 1, x0 + w + 1, by, WD['mid2']); cv.hline(x0 - 1, x0 + w + 1, by + 1, WD['dk'])
        for i in range(-1, w + 1):
            c = LF['mid'] if H(i, 1, seed) < .6 else LF['lit']
            cv.set(x0 + i, by - 1, c)
            if H(i, 2, seed) < .5: cv.set(x0 + i, by - 2, LF['dk'] if H(i, 3, seed) < .5 else LF['mid'])
        for i in (0, 3, 6):
            cv.set(x0 + i, by - 2, rgb('#e0482a')); cv.set(x0 + i + 1, by - 3 + 1, WD['pale']) if False else None
        cv.set(x0 + 2, by - 3, WD['pale']); cv.set(x0 + 5, by - 3, rgb('#ec9900'))

def door(cv, x0, y0, w=10, h=22, col='brown', pane=True):
    """plank door with a small 4-pane window, iron hinges and a latch; x0,y0 = top-left of the frame"""
    body = dict(brown=('#744c2a', '#5e3a1c'), green=('#3c7a3a', '#205030'), red=('#9a5d39', '#62351c'), blue=('#5b6667', '#374243'))[col]
    b1, b2 = rgb(body[0]), rgb(body[1])
    for y in range(h):
        for x in range(w):
            edge = x in (0, w - 1) or y == 0
            if edge: cv.set(x0 + x, y0 + y, WD['dk'] if x == w - 1 else WD['hi'] if (y == 0 or x == 0) else WD['dk'])
            else: cv.set(x0 + x, y0 + y, b1 if (x % 2 == 1) else b2)
    if pane:
        for y in range(2, 7):
            for x in range(2, w - 2): cv.set(x0 + x, y0 + y, GL['dk'])
        cv.vline(x0 + w // 2, y0 + 2, y0 + 7, WD['lit']); cv.hline(x0 + 2, x0 + w - 2, y0 + 4, WD['lit'])
        cv.set(x0 + 2, y0 + 2, GL['mid']); cv.set(x0 + 3, y0 + 3, GL['mid']); cv.set(x0 + w - 3, y0 + 5, GL['hi'])
        cv.hline(x0 + 1, x0 + w - 1, y0 + 7, WD['dk'])
    for y in (y0 + 9, y0 + h - 4): cv.set(x0 + 1, y, ST['mid']); cv.set(x0 + 2, y, ST['lo'])
    cv.set(x0 + w - 3, y0 + h // 2 + 1, ST['lit']); cv.set(x0 + w - 3, y0 + h // 2 + 2, ST['lo'])
    for y in range(y0 + 8, y0 + h): cv.set(x0 + w - 1, y, WD['deep'])

def step(cv, x0, y0, w=12, col='wood'):
    if col == 'wood':
        cv.hline(x0, x0 + w, y0, WD['lit']); cv.hline(x0, x0 + w, y0 + 1, WD['mid']); cv.hline(x0, x0 + w, y0 + 2, WD['dk'])
    else:
        cv.hline(x0, x0 + w, y0, ST['lit']); cv.hline(x0, x0 + w, y0 + 1, ST['mid']); cv.hline(x0, x0 + w, y0 + 2, ST['lo'])

def ivy(cv, x, y0, y1, seed=0, side=1):
    """climbing plant: a wobbly stem with leaf pairs (3-4 px clusters, lit edge)"""
    xx = x
    for y in range(y1, y0, -1):
        i = y1 - y
        if i % 5 == 0: xx = x + int((H(i, 1, seed) - .5) * 3)
        cv.set(xx, y, LF['dk'])
        if i % 2 == 1:
            s = 1 if (i // 2) % 2 == 0 else -1
            cv.set(xx + s, y, LF['mid']); cv.set(xx + 2 * s, y, LF['lit']); cv.set(xx + 2 * s, y - 1, LF['mid']); cv.set(xx + s, y - 1, LF['lit'])
            if H(i, 4, seed) < .6: cv.set(xx + 3 * s, y, LF['hi']); cv.set(xx + 2 * s, y + 1, LF['dk'])

def post_v(cv, x0, y0, y1, w=8, cap=True):
    """vertical round log post, lit on the left, shaded on the right, with a lighter cap ring"""
    for y in range(y0, y1):
        for i in range(w):
            t = i / (w - 1)
            c = [WD['dk'], WD['hi'], WD['lit'], WD['lit'], WD['mid'], WD['mid2'], WD['lo'], WD['dk']] if w == 8 else \
                [WD['dk'], WD['hi'], WD['mid'], WD['mid2'], WD['lo'], WD['dk']][:w]
            cc = c[i]
            if H(i, y // 2, 3) < .08: cc = WD['lit'] if i < w // 2 else WD['lo']
            cv.set(x0 + i, y, cc)
    if cap:
        cv.hline(x0, x0 + w, y0, WD['dk']); cv.hline(x0 + 1, x0 + w - 1, y0 + 1, WD['hi'])

# =================================================== PARTS ===================================================
PARTS = {}
def reg(kid, name, im, desc, rules, tags, over=None, role='part', doors=(), lo=None, assembly=None, walk=None, notes=None):
    W_, H_ = im.width // T, im.height // T
    if walk is None:
        a = im.split()[3]; walk = []
        for y in range(H_):
            row = ''
            for x in range(W_):
                has = a.crop((x * T, y * T, x * T + T, y * T + T)).getbbox() is not None
                row += (over or {}).get((x, y), 'X') if has else '.'
            walk.append(row)
    K.save_kit(kid, name, im, walk, desc, rules, tags, role=role, lo=lo, doors=doors, notes=notes, assembly=assembly)
    PARTS[kid] = im
    return im

def compose(w, h, plan):
    im = Image.new('RGBA', (w * T, h * T), (0, 0, 0, 0))
    for pid, x, y in plan: im.alpha_composite(PARTS[pid], (x * T, y * T))
    return im

# ---- roof pieces (side-gable): 1 cell wide x 3 rows; ridge log + lit back strip + shaded front slope with a scalloped last course ----
def roof_piece2(side, seed=5, worn=False):
    cv = Cv(16, 48)
    for y, c in enumerate([WD['hi'], WD['lit'], WD['mid'], WD['lo']]): cv.hline(0, 16, y, c)
    for x in range(16):
        if H(x, 0, seed) < .15: cv.set(x, 1, WD['hi'])
    shingles(cv, 0, 4, 16, 12, seed + 1, lit=True, scallop=False)          # y 4..11 back slope
    # front slope: 36 px = 9 courses, y 12..47
    shingles(cv, 0, 12, 16, 48, seed + 2)
    cv.hline(0, 16, 12, WD['dk'])                                            # ridge shadow line on top of the front slope
    cv.hline(0, 16, 13, WD['lit'])
    if side == 'l':
        for y in range(0, 48):
            cv.set(0, y, WD['dk']); cv.set(1, y, WD['hi'] if y > 3 else WD['lit']); cv.set(2, y, WD['lit'] if y > 3 else cv.get(2, y)); cv.set(3, y, WD['mid2'] if y > 3 else cv.get(3, y))
    if side == 'r':
        for y in range(0, 48):
            cv.set(15, y, WD['deep']); cv.set(14, y, WD['lo']); cv.set(13, y, WD['mid2'] if y > 3 else cv.get(13, y))
    if worn:                                   # a repaired patch of newer, lighter shingles and a moss stain (keeps the seams intact)
        for (px_, py_, pw, ph_) in ((4, 21, 6, 4), (9, 33, 5, 4)):
            for y in range(py_, py_ + ph_):
                for x in range(px_, px_ + pw):
                    c = cv.get(x, y); cv.set(x, y, mix(c, WD['warm'], .7 if y == py_ else .5))
        for (mx, my) in ((3, 37), (4, 37), (5, 37), (3, 38), (4, 38), (2, 38), (4, 39), (5, 39), (12, 27), (13, 27), (12, 28)):
            c = cv.get(mx, my); cv.set(mx, my, mix(c, LF['dk'] if H(mx, my, 3) < .5 else LF['mid'], .85))
    cv.shade(0, 44, 16, 48, .8)
    return cv


def roof_hip(side, seed=5):
    """hipped end of a side-gable roof seen from the front-above: the ridge log starts one cell in, the silhouette slants out to the
    full eave width (trapezoid). A hip rafter runs from the ridge end down to the front eave corner; the end slope (a wedge between
    the silhouette and the rafter) is lit on the left end and shaded on the right end. Front slope texture continues the roof-m courses."""
    base = roof_piece2('m', seed).im.load(); cv = Cv(16, 48); L = side == 'l'
    def fx(x): return x if L else 15 - x               # work in 'left end' coordinates, mirror when reading/writing
    for y in range(48):
        for x in range(16):
            xx = fx(x)
            ytop = (15.5 - xx) * 1.1 + 2                 # silhouette diagonal (apex near the ridge end, ~19 px down at the eave corner)
            yraf = 4 + (15 - xx) * 43 / 15.0             # hip rafter diagonal
            if y < ytop: continue
            if y >= yraf:                                # front slope side of the rafter: same pixels as roof-m
                if y < 4 and False: continue
                cv.set(x, y, base[x, y])
            else:                                        # end slope wedge
                u = y - ytop; r = int(u) % 4
                if L: c = [WD['hi'], WD['warm'], WD['warm'], WD['hi']][r] if u >= 2 else WD['pale2']
                else: c = [WD['lo'], WD['mid2'], WD['mid2'], WD['lo']][r] if u >= 2 else WD['mid']
                if H(x, y, seed + 11) < .07: c = mix(c, WD['lo'], .4)
                cv.set(x, y, c)
    for y in range(4, 48):                               # the hip rafter: lit edge + shadow line
        xr = 15 - (y - 4) * 15 / 43.0; xi = int(round(fx(0) + (xr if L else 15 - xr) - (0 if L else 0)))
        xi = int(round(xr)) if L else 15 - int(round(xr))
        cv.set(xi, y, WD['warm'] if L else WD['hi']); cv.set(xi + (1 if L else -1), y, WD['lo'])
    cv.hline(0, 16, 47, WD['dk'])
    return cv

def part_roofs():
    for side, nm in (('l', '좌끝'), ('m', '가운데'), ('m2', '가운데(손본 자국·이끼)'), ('r', '우끝')):
        cv = roof_piece2(side[0], worn=side == 'm2')
        im = outline(cv.im, 't' + (side if side in 'lr' else ''))
        reg(f'bd-out-roof-{side}', f'외곽 나무집 지붕 {nm}', im,
            f'가파른 갈색 나무 널 지붕 조각({nm}), 1칸x3줄. 위: 둥근 통나무 용마루, 밝은 뒤쪽 경사, 아래: 물결(스캘럽) 마지막 줄이 있는 앞쪽 경사.',
            '지붕 줄은 좌끝+가운데×n+우끝으로 이어 붙이고, 그 아래 벽 칸(2~3줄)을 둔다. 용마루 끝에는 bd-out-ridge-end-l/r 을 겹친다.',
            ['외곽', '나무집', '지붕', '부품'])
    for side in 'lr':
        im = outline(roof_hip(side).im, 't' + side)
        reg(f'bd-out-roof-h{side}', f'외곽 나무집 지붕 모임(추녀) {"좌" if side == "l" else "우"}끝', im,
            '옆박공 지붕의 모임지붕식 끝 칸(1칸x3줄): 용마루가 한 칸 안에서 시작하고 실루엣이 처마 폭까지 비스듬히 넓어지는 사다리꼴. 추녀마루 선, ' + ('밝은' if side == 'l' else '그늘진') + ' 끝면, 앞 경사는 roof-m 과 이어진다.',
            'roof-hl + roof-m×n + roof-hr 로 잇고 ridge-end-l 을 (1,·), ridge-end-r 을 (끝-1,·) 칸에 겹친다.', ['외곽', '나무집', '지붕', '부품', '모임지붕'])
    for side in 'lr':
        cv = Cv(16, 16)
        log_disc(cv, 0 if side == 'l' else 11, 0, seed=4 if side == 'l' else 6)
        reg(f'bd-out-ridge-end-{side}', f'용마루 통나무 단면 {"좌" if side == "l" else "우"}', cv.im,
            '용마루 끝의 둥근 통나무 단면(연한 나이테). 지붕 좌끝/우끝 조각 위에 겹치는 1칸 덧그림.',
            f'roof-{side} 조각과 같은 칸에 겹친다.', ['외곽', '나무집', '지붕', '부품'])

# ---- log wall bays: 1 cell wide x 2 rows (32 px = 8 courses) ----
def log_end(cv, x, y, flip=False):
    rows = ['pwwwd', 'wpppd', 'wpcpd', 'dddd.'] if not flip else ['dwwwp', 'dpppw', 'dpcpw', '.dddd']
    cmap = {'p': WD['pale'], 'w': WD['pale2'], 'c': WD['mid'], 'd': WD['lo']}
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != '.': cv.set(x + i, y + j, cmap[ch])
def bay_log(kind, seed=7, rows=2, opts=None, eave=True):
    o = opts or {}; H_ = 16 * rows; cv = Cv(16, H_)
    logs(cv, 0, 0, 16, H_, seed)
    if kind in ('l', 'r'):
        cv.rect(0, 0, 16, H_, (0, 0, 0, 0))
        for ci in range(H_ // 4):
            odd = ci % 2
            if kind == 'l':
                ex = 2 if odd else 0
                for y in range(ci * 4, ci * 4 + 4):
                    for x in range(ex, 16): cv.set(x, y, logs_px(x, y, seed))
                log_end(cv, ex, ci * 4)
            else:
                ex = 16 - 5 - (2 if odd else 0)
                for y in range(ci * 4, ci * 4 + 4):
                    for x in range(0, ex + 5): cv.set(x, y, logs_px(x, y, seed))
                log_end(cv, ex, ci * 4, flip=True)
    if eave: eave_shadow(cv, 0)
    else: cv.shade(0, 0, 16, 1, .8)
    if kind == 'window' or kind == 'window-shut' or kind == 'window-box':
        window(cv, 4, 5, 8, 9, shutters=rgb('#4b8232') if kind == 'window-shut' else (rgb('#9e2514') if o.get('red') else None), box=(kind == 'window-box'), seed=seed)
    if kind == 'arch':
        window(cv, 4, 5, 8, 10, arch=True, seed=seed)
    if kind.startswith('door'):
        door(cv, 3, 8, 10, 21, col=kind[5:] or 'brown')
        step(cv, 2, 29, 12)
    return cv
def logs_px(x, y, seed):
    t = Cv(16, 4 * ((y // 4) + 1)); logs(t, 0, 0, 16, t.h, seed); return t.get(x, y)

def part_log_walls():
    spec = [('l', '통나무 벽 좌모서리', '모서리 통나무 단면이 엇갈려 튀어나온 왼쪽 끝 칸'), ('r', '통나무 벽 우모서리', '모서리 통나무 단면이 엇갈려 튀어나온 오른쪽 끝 칸'),
            ('wall', '통나무 벽 칸', '4px 통나무 단(윗줄 밝음, 밑줄 그늘)'), ('window', '통나무 벽 창칸', '작은 4칸 유리창과 창턱'),
            ('window-shut', '통나무 벽 덧문창칸', '초록 덧문이 달린 작은 창'), ('window-box', '통나무 벽 꽃상자창칸', '창턱 아래 꽃상자'),
            ('arch', '통나무 벽 아치창칸', '위가 둥근 작은 창'), ('door', '통나무 벽 문칸(갈색)', '판자문(작은 4칸 유리창)과 나무 계단'),
            ('door-green', '통나무 벽 문칸(초록)', '초록 판자문과 나무 계단'), ('door-blue', '통나무 벽 문칸(청회색)', '청회색 판자문과 나무 계단'), ('door-red', '통나무 벽 문칸(붉은갈색)', '붉은갈색 판자문과 나무 계단')]
    for eave in (True, False):
        for kind, nm, d in spec:
            if not eave and kind not in ('l', 'r', 'wall', 'window', 'window-box', 'window-shut', 'arch', 'door', 'door-blue', 'door-green', 'door-red'): continue
            cv = bay_log(kind, eave=eave)
            op = 'b' + ('l' if kind == 'l' else 'r' if kind == 'r' else '')
            im = outline(cv.im, op)
            kid = f'bd-out-{"log" if eave else "logg"}-{kind}'
            reg(kid, f'외곽 {nm}' + ('' if eave else ' (박공벽 아래)'), im, d + '. 1칸x2줄.' + ('' if eave else ' 처마 그림자가 없다(박공 정면 벽 이어짐).'),
                '벽 줄 맨 아래에 놓는다. ' + ('옆박공 지붕(roof-*) 아래용: 처마 그림자가 있다.' if eave else '박공 정면 지붕(gable-*) 아래용.'), ['외곽', '나무집', '통나무벽', '부품'])

# ---- plank wall bays: 1 cell x 3 rows (48 px): lap boards above, rail, vertical planks below ----
def bay_plank(kind, seed=11, opts=None):
    o = opts or {}; cv = Cv(16, 48)
    logs(cv, 0, 0, 16, 24, seed, flat=True)
    rail(cv, 0, 16, 24)
    planks_v(cv, 0, 27, 16, 48, seed)
    eave_shadow(cv, 0)
    cv.hline(0, 16, 46, WD['lo']); cv.hline(0, 16, 47, WD['dk'])
    if kind in ('l', 'r'):
        x0 = 0 if kind == 'l' else 8
        post_v(cv, x0, 0, 48, 8)
        if kind == 'l': pass
    if kind in ('window', 'window-shut'):
        window(cv, 4, 8, 8, 9, shutters=rgb('#31633a') if kind == 'window-shut' else None, seed=seed)
    if kind == 'door':
        door(cv, 3, 21, 10, 24, col='red', pane=True)
        step(cv, 2, 45, 12)
    return cv
def part_plank():
    spec = [('wall', '판자 벽 칸', '위 겹판자, 허리띠, 아래 세로판자'), ('window', '판자 벽 창칸', '위층 네모 창(4칸)'), ('window-shut', '판자 벽 덧문창칸', '위층 창 + 초록 덧문'),
            ('door', '판자 벽 문칸', '아래층 판자문 + 계단, 위는 간판을 매달 자리'), ('l', '판자 벽 좌기둥', '둥근 통나무 기둥이 선 왼쪽 끝 칸'), ('r', '판자 벽 우기둥', '둥근 통나무 기둥이 선 오른쪽 끝 칸')]
    for kind, nm, d in spec:
        cv = bay_plank(kind); op = 'b' + ('l' if kind == 'l' else 'r' if kind == 'r' else '')
        im = outline(cv.im, op)
        doors = [(0, 1, '문 칸')] if kind == 'door' else ()
        reg(f'bd-out-plank-{kind}', f'외곽 {nm}', im, d + '. 1칸x3줄(2층).', '판자집 벽 줄 맨 아래에 놓는다.', ['외곽', '나무집', '판자벽', '부품'])

# ---- gable-front blocks: steep roof seen with its ridge running away from us: two sloped quads (lit left / shaded right), a round-log
#      ridge with visible pale log ends, a lit barge board along the gable edge, and the gable wall (log courses) with a round window ----
def gable_cv(w, e, A, rows, seed=3, wnd=None, flat=False):
    W_, H_ = w * 16, rows * 16; cx = W_ / 2.0; k = e / cx; cv = Cv(W_, H_)
    logs(cv, 0, 0, W_, H_, seed, flat=flat)
    base = Cv(W_, H_); base.im.paste(cv.im); wallpx = base.p
    out = Cv(W_, H_)
    for y in range(H_):
        for x in range(W_):
            dx = abs(x + .5 - cx); yf = k * dx; yn = A + k * dx; yy = y + .5
            if yy < yf: continue
            if yy >= yn:
                c = wallpx[x, y]; d = yy - yn
                if d < 2: c = dark(c, .5)
                elif d < 4: c = dark(c, .75)
                out.set(x, y, c); continue
            left = x + .5 < cx
            u = (A + k * cx) - (y + .5 + k * x) if left else (A - k * cx) - (y + .5 - k * x)
            if u < 3:                                              # barge board along the gable edge
                c = WD['mid2'] if u < 1 else (WD['hi'] if left else WD['lit']) if u < 2 else (WD['warm'] if left else WD['hi']) if False else (WD['hi'] if left else WD['lit'])
                if u >= 2 and left: c = WD['warm'] if H(x, y, seed) < .5 else WD['hi']
            else:
                v = u - 3; r = int(v) % 6; ci = int(v) // 6
                sx = x if left else -x
                tone = H(ci, int(sx // 11), seed + 4) < .35
                L1 = [WD['mid2'], WD['mid'], WD['mid'], WD['lit'], WD['lit'], WD['hi']]; L2 = [WD['lo'], WD['mid2'], WD['mid2'], WD['mid'], WD['mid'], WD['lit']]
                R1 = [WD['lo'], WD['mid2'], WD['mid2'], WD['mid'], WD['mid'], WD['lit']]; R2 = [WD['dk'], WD['lo'], WD['lo'], WD['mid2'], WD['mid2'], WD['mid']]
                c = (L1 if not tone else L2)[r] if left else (R1 if not tone else R2)[r]
                if H(x, y, seed + 8) < .05 and 0 < r < 5: c = mix(c, WD['hi'] if left else WD['lit'], .45)
                if H(ci, int(sx // 15), seed + 6) < .2 and r in (2, 3) and int(sx) % 15 == 0: c = WD['dk']        # log butt joint
            out.set(x, y, c)
    # ridge log
    rx = int(cx) - 2
    for y in range(0, int(A) + 1):
        for i in range(4):
            r = y % 4
            col = {0: [WD['lit'], WD['hi'], WD['mid'], WD['mid2']], 1: [WD['pale'], WD['pale'], WD['mid'], WD['lo']],
                   2: [WD['pale'], WD['pale2'], WD['mid'], WD['lo']], 3: [WD['lo'], WD['mid'], WD['lo'], WD['dk']]}[r][i]
            out.set(rx + i, y, col)
    # round window in the gable wall
    if wnd:
        ww, wh, wy = wnd
        window(out, int(cx - ww / 2), wy, ww, wh, arch=True, seed=seed)
    return out

def part_gables():
    # (id, cells wide, eave drop e, ridge depth A, rows, window (w,h,y))
    for kid, w, e, A, rows, wnd, nm in (('bd-out-gable-5', 5, 40, 24, 4, (10, 12, 36), '5칸'), ('bd-out-gable-4', 4, 24, 8, 2, None, '4칸(작은 집)'),
                                         ('bd-out-gable-3', 3, 24, 24, 3, (6, 8, 32), '3칸')):
        cv = gable_cv(w, e, A, rows, wnd=wnd, seed=3 + w)
        im = outline(cv.im, 'tlr')
        reg(kid, f'외곽 나무집 박공 지붕 {nm}', im,
            f'박공이 앞을 향한 가파른 나무 지붕({nm} 폭): 왼쪽 밝은 비탈·오른쪽 그늘 비탈, 둥근 통나무 용마루(연한 나이테 끝), 밝은 박공 널, 통나무 박공벽' + (' 과 둥근 창' if wnd else '') + '.',
            '그 아래에 통나무/판자 벽 칸 줄(2줄)을 붙인다. 좌우 바깥 칸이 모서리(log-l/r 또는 plank-l/r).', ['외곽', '나무집', '박공', '지붕', '부품'])

def log_disc(cv, x, y, seed=0):
    """a round cut log end 5x5 (bark ring, warm wood, growth-ring dot)"""
    rows = ['.ddd.', 'dwwwd', 'wpcpw', 'dwpwd', '.ddd.']
    cm = {'d': WD['lo'], 'w': WD['hi'], 'p': WD['pale2'], 'c': WD['mid']}
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == '.': continue
            c = cm[ch]
            if ch == 'p' and H(i, j, seed) < .4: c = WD['warm']
            if ch == 'w' and H(i, j, seed + 3) < .3: c = WD['lit']
            cv.set(x + i, y + j, c)

# ---- chimney (stone box + shaft, 1x2), ivy, hanging sign, woodshed ----
def part_chimney():
    cv = Cv(16, 32); dy = 12
    cv.rect(3, 1 + dy, 13, 4 + dy, MAUVE['hi'])                            # box rim seen from above: light stone frame
    cv.rect(5, 2 + dy, 11, 4 + dy, MAUVE['dk']); cv.hline(5, 11, 2 + dy, MAUVE['lo'])       # dark flue opening
    cv.vline(12, 1 + dy, 4 + dy, MAUVE['mid'])
    cv.rect(3, 4 + dy, 13, 8 + dy, MAUVE['mid']); cv.hline(3, 13, 4 + dy, MAUVE['hi'])       # front face of the box
    cv.vline(3, 4 + dy, 8 + dy, MAUVE['hi']); cv.vline(12, 4 + dy, 8 + dy, MAUVE['lo']); cv.hline(3, 13, 7 + dy, MAUVE['lo'])
    for x in (6, 9): cv.set(x, 5 + dy, mix(MAUVE['mid'], MAUVE['dk'], .5)); cv.set(x, 6 + dy, mix(MAUVE['mid'], MAUVE['dk'], .5))
    for y in range(8 + dy, 32):                                            # shaft, a little narrower than the box
        for x in range(4, 12):
            c = MAUVE['mid'] if x < 8 else MAUVE['lo']
            if x == 4: c = MAUVE['hi']
            if x == 11: c = MAUVE['dk']
            if (y - 8 - dy) % 4 == 3: c = mix(c, MAUVE['dk'], .45)                    # mortar course
            elif (x + ((y - 8 - dy) // 4) * 3) % 6 == 0: c = mix(c, MAUVE['dk'], .45)
            cv.set(x, y, c)
    cv.rect(4, 31, 12, 32, MAUVE['dk'])
    reg('bd-out-chimney', '외곽 나무집 굴뚝', outline(cv.im, 'tlrb'), '지붕 경사 위에 서는 돌 굴뚝(연한 자줏빛 돌 상자 + 벽돌 기둥), 1칸x2줄 덧그림.',
        '용마루나 앞 경사 위 칸에 겹친다. 위 칸의 튀어나온 머리는 C(플레이어 위에 그림).', ['외곽', '나무집', '굴뚝', '부품'])

def part_ivy():
    for kid, nm, spec in (('bd-out-ivy', '덩굴 벽칸', [(5, 6, 29, 1), (12, 12, 30, 2)]), ('bd-out-ivy-corner', '덩굴 모서리', [(3, 3, 30, 3)])):
        cv = Cv(16, 32)
        for x, y0, y1, sd in spec: ivy(cv, x, y0, y1, seed=sd)
        # grass tuft at the foot
        for x in (spec[0][0] - 2, spec[0][0] - 1, spec[0][0], spec[0][0] + 1):
            cv.set(x, 31, LF['mid']); cv.set(x, 30, LF['lit'] if x % 2 else LF['dk'])
        reg(kid, f'외곽 나무집 {nm}', cv.im, '벽을 타고 오르는 덩굴 덧그림(1칸x2줄). 벽 칸 위에 겹친다.', '벽 칸(log-*)과 같은 칸에 겹친다.', ['외곽', '나무집', '덩굴', '부품'])

def part_sign():
    cv = Cv(16, 16)
    cv.hline(1, 15, 0, ST['lo']); cv.hline(1, 15, 1, ST['dk'])                 # iron bracket arm
    for x in (3, 12): cv.set(x, 2, ST['mid']); cv.set(x, 3, ST['mid'])           # chains
    cv.rect(2, 4, 14, 15, WD['dk']); cv.rect(3, 5, 13, 14, WD['mid2'])
    cv.hline(3, 13, 5, WD['hi']); cv.vline(3, 5, 14, WD['lit'])
    cv.rect(4, 6, 12, 13, WD['lo'])                                            # shield field
    for i in range(6):                                                       # two crossed swords
        cv.set(4 + i, 6 + i, ST['hi']); cv.set(11 - i, 6 + i, ST['lit'])
        cv.set(5 + i, 6 + i, ST['mid']) if i < 5 and False else None
    cv.set(4, 6, ST['lit']); cv.set(11, 6, ST['hi'])
    for (x, y) in ((3, 11), (12, 11), (4, 12), (11, 12)): cv.set(x, y, rgb('#ecc04a'))     # hilts
    cv.set(7, 9, ST['deep']); cv.set(8, 9, ST['deep'])
    cv.rect(4, 13, 12, 14, WD['mid2'])
    reg('bd-out-hanging-sign', '외곽 나무집 걸이 간판', outline(cv.im, 'tlrb'), '쇠 걸이에 매단 나무 간판(교차한 검 무늬), 1칸 덧그림.', '2층 판자집 벽 칸의 위쪽에 겹친다.', ['외곽', '나무집', '간판', '부품'])

def part_shed():
    cv = Cv(48, 48)
    for y in range(20, 48): cv.hline(0, 48, y, WD['deep'] if y < 30 else WD['dk'])
    for x in range(0, 48, 5): cv.vline(x, 20, 30, WD['dk'])
    for x in range(0, 48): cv.set(x, 20, WD['deep'])
    for r in range(4):                                                         # the log stack: round cut ends toward us
        y = 26 + r * 5
        for i in range(7):
            x = 7 + i * 5 - (2 if r % 2 else 0)
            if 7 <= x <= 36: log_disc(cv, x + int(H(i, r, 9) * 2.2) - 1, y + int(H(r, i, 4) * 1.6), seed=r * 7 + i)
    for x, w_ in ((1, 6), (41, 6)): post_v(cv, x, 19, 48, w_)
    shingles(cv, 0, 0, 48, 20, 21)
    cv.hline(0, 48, 0, WD['lit']); cv.hline(0, 48, 1, WD['mid'])
    for y in range(0, 20): cv.set(0, y, WD['dk']); cv.set(47, y, WD['deep'])
    cv.hline(0, 48, 46, WD['lo']); cv.hline(0, 48, 47, WD['dk'])
    reg('bd-out-woodshed', '외곽 나무집 장작 헛간(붙임지붕)', outline(cv.im, 'tlrb'), '기둥 둘과 한쪽으로 기운 널 지붕 아래 쌓인 장작(둥근 단면), 3칸x3줄.', '집 옆벽에 기대어 놓거나 마당에 단독으로 놓는다.', ['외곽', '나무집', '헛간', '부품'])

def build_parts():
    part_roofs(); part_log_walls(); part_plank(); part_gables(); part_chimney(); part_ivy(); part_sign(); part_shed()

# =================================================== FULL HOUSES (assembled from the parts) ===================================================
def house(kid, name, w, h, plan, desc, rules, doors, over=None, tags=(), notes=None):
    im = compose(w, h, plan)
    reg(kid, name, im, desc, rules, ['외곽', '나무집'] + list(tags), over=over, role='building', doors=doors, assembly=plan, notes=notes)

def build_houses():
    # bd-out-cabin: gable-front log cabin, 5 x 6
    plan = [('bd-out-gable-5', 0, 0), ('bd-out-logg-l', 0, 4), ('bd-out-logg-window-box', 1, 4), ('bd-out-logg-door', 2, 4), ('bd-out-logg-wall', 3, 4), ('bd-out-logg-r', 4, 4),
            ('bd-out-ivy', 3, 4), ('bd-out-chimney', 1, 0)]
    house('bd-out-cabin', '외곽 통나무 오두막(박공 정면)', 5, 6, plan,
          '가파른 통나무 지붕과 앞을 향한 박공(둥근 용마루 통나무 끝, 둥근 창), 통나무 벽에 꽃상자 창과 판자문, 왼쪽 지붕 위 돌 굴뚝, 덩굴. 성 밖 마을의 오두막.',
          '문은 (2,5), 그 아래 칸이 문 앞 길. 굴뚝 머리 (1,0)은 C. 좌우 위 모서리 칸은 비어 있어 잔디가 보인다.', [(2, 5, '판자문 (아래 칸이 문 앞)')], over={(1, 0): 'C'}, tags=['오두막', '박공'])
    # bd-out-house-plank: side-gable plank main wing (5 wide) + gable-front wing (3 wide) with a hanging sign, 8 x 6
    plan = [('bd-out-roof-hl', 0, 0), ('bd-out-roof-m', 1, 0), ('bd-out-roof-m2', 2, 0), ('bd-out-roof-m', 3, 0), ('bd-out-roof-hr', 4, 0), ('bd-out-ridge-end-l', 1, 0), ('bd-out-ridge-end-r', 3, 0), ('bd-out-gable-3', 5, 0),
            ('bd-out-plank-l', 0, 3), ('bd-out-plank-window', 1, 3), ('bd-out-plank-wall', 2, 3), ('bd-out-plank-window-shut', 3, 3), ('bd-out-plank-wall', 4, 3),
            ('bd-out-plank-l', 5, 3), ('bd-out-plank-door', 6, 3), ('bd-out-plank-r', 7, 3), ('bd-out-ivy', 4, 4), ('bd-out-hanging-sign', 6, 3), ('bd-out-chimney', 3, 0)]
    house('bd-out-house-plank', '외곽 판자 2층집(간판)', 8, 6, plan,
          '왼쪽은 옆박공 판자 본채(물결 끝단 널 지붕, 창 둘), 오른쪽은 박공이 앞을 향한 3칸 날개(둥근 통나무 기둥, 교차한 검 간판, 판자문 + 계단). 2층 겹판자 벽과 허리띠.',
          '문은 (6,5). 굴뚝은 지붕 앞 경사 위에 얹혀 있다(전부 X). 지붕 위 빈 칸은 잔디.', [(6, 5, '판자문 (아래 칸이 문 앞)')], tags=['판자', '2층', '간판'])
    # bd-out-longhouse: 10 x 6, side-gable log house, two windows, chimney on the ridge
    lw = ['wall', 'window-box', 'wall', 'door-green', 'wall', 'wall', 'wall', 'window-shut']
    plan = [('bd-out-roof-hl', 0, 1)] + [('bd-out-roof-m2' if i in (3, 7) else 'bd-out-roof-m', i, 1) for i in range(1, 9)] + [('bd-out-roof-hr', 9, 1), ('bd-out-ridge-end-l', 1, 1), ('bd-out-ridge-end-r', 8, 1)]
    plan += [('bd-out-log-l', 0, 4)] + [(f'bd-out-log-{k}', i + 1, 4) for i, k in enumerate(lw)] + [('bd-out-log-r', 9, 4)]
    plan += [('bd-out-ivy-corner', 5, 4), ('bd-out-chimney', 6, 0)]
    house('bd-out-longhouse', '외곽 통나무 긴 집', 10, 6, plan,
          '옆박공 긴 통나무 집: 물결 끝단 널 지붕, 용마루 통나무 끝, 벽에 꽃상자 창과 덧문 창 둘, 판자문(초록), 용마루 위 돌 굴뚝, 모서리 덩굴.',
          '문은 (4,5). 굴뚝 머리 (6,0)은 C. 맨 윗줄은 굴뚝 자리만 있다.', [(4, 5, '판자문 (아래 칸이 문 앞)')], over={(6, 0): 'C'}, tags=['긴집'])
    # bd-out-cabin-small: tiny hut 4 x 4
    plan = [('bd-out-gable-4', 0, 0), ('bd-out-logg-l', 0, 2), ('bd-out-logg-door-blue', 1, 2), ('bd-out-logg-window-shut', 2, 2), ('bd-out-logg-r', 3, 2), ('bd-out-ivy-corner', 3, 2)]
    house('bd-out-cabin-small', '외곽 작은 통나무 오두막', 4, 4, plan,
          '4x4 작은 통나무 오두막: 낮고 넓은 박공 지붕(짧은 용마루), 판자문과 덧문 창, 모서리 덩굴.',
          '문은 (1,3). 지붕 위쪽 모서리 칸은 비어 있다.', [(1, 3, '판자문 (아래 칸이 문 앞)')], tags=['작은집'])

# =================================================== GROUND: sand path + cobble plaza ===================================================
LAWN = Image.open(os.path.join(HERE, 'assets', 'lawn16.png')).convert('RGBA')
def lawn_px(x, y): return LAWN.getpixel((x % 16, y % 16))
SAND = dict(base=rgb('#e0cf9a'), dk=rgb('#cbb87c'), mid=rgb('#d3c088'), lt=rgb('#efe2ae'), peb=rgb('#b9a672'), warm=rgb('#d8c184'))
def _pnoise(x, y, sc, seed, per=16):
    """periodic value noise on a per-px period (seamless 16 px tile)"""
    from px2 import vnoise
    return vnoise(x % per, y % per, sc, seed, per=per // sc)
def sand_px(x, y, seed=0):
    n = _pnoise(x, y, 8, seed + 3) * .6 + _pnoise(x, y, 4, seed + 5) * .4
    r = H(x % 16, y % 16, seed + 1)
    c = SAND['base']
    if n < .30: c = SAND['mid'] if r < .6 else SAND['base']
    elif n > .72: c = SAND['lt'] if r < .4 else SAND['base']
    if r < .09: c = SAND['dk']
    elif r < .13: c = SAND['warm']
    elif r > .975: c = SAND['peb']
    elif r > .94: c = SAND['lt']
    return c
def sand_tile(seed=0):
    """ONE seamless 16x16 sand RGBA tile (light sandy #e0cf9a family with darker speckles and a few pebbles)."""
    im = Image.new('RGBA', (16, 16))
    for y in range(16):
        for x in range(16): im.putpixel((x, y), sand_px(x, y, seed))
    return im

def part_sand_patch():
    W_, H_ = 6, 4; w, h = W_ * T, H_ * T; im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); cx, cy = w / 2 - .5, h / 2 - .5
    def inside(x, y):
        dx, dy = (x - cx) / (w / 2 - 6), (y - cy) / (h / 2 - 4); r = (dx * dx + dy * dy) ** .5
        ang = math.atan2(dy, dx); wob = 1 + .10 * math.sin(3 * ang + 1) + .07 * math.sin(5 * ang + 2)
        rag = (_hval(x, y) - .5) * .30
        return r < wob + rag
    def _hval(x, y): return .55 * H(x // 2, y // 2, 4) + .45 * H(x, y, 9)
    cells = {}
    for cyy in range(H_):
        for cxx in range(W_):
            n = sum(inside(cxx * T + i, cyy * T + j) for j in range(T) for i in range(T)); cells[(cxx, cyy)] = n
    walk = []
    for cyy in range(H_):
        row = ''
        for cxx in range(W_):
            if cells[(cxx, cyy)] == 0: row += '.'; continue
            row += 'F'
            for j in range(T):
                for i in range(T):
                    x, y = cxx * T + i, cyy * T + j
                    if inside(x, y):
                        # a lawn blade right at the ragged edge
                        edge = not all(inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                        c = sand_px(x, y, 0)
                        if edge and H(x, y, 21) < .35: c = mix(c, lawn_px(x, y), .5)
                        im.putpixel((x, y), c)
                    else:
                        c = lawn_px(x, y)
                        near = any(inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1)))
                        if near and H(x, y, 33) < .5: c = mix(c, rgb('#4b8232'), .5)
                        im.putpixel((x, y), c)
        walk.append(row)
    up = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    K.save_kit('bd-out-sand-patch', '외곽 모래길 조각 6x4', up, walk, '성 밖 마을 길의 모래 바닥 표본: 6x4 불규칙 모래 조각, 가장자리 칸에는 잔디 가닥이 들쭉날쭉 섞인다(해시). 아래 그림만 있다(F).',
               '가장자리 바깥 칸은 비어 있어 지도의 잔디가 보인다. 모래 타일 원본은 kits7_outskirts.sand_tile(seed).', ['외곽', '모래길', '바닥', '표본'], role='garden', lo=im)

# ---- cobble plaza: irregular round, light grey rocks with tan joints; the ragged edge follows whole rocks ----
def _seeds(w, h, sp, seed, jit=3):
    pts = []
    for gy in range(-1, h // sp + 2):
        for gx in range(-1, w // sp + 2):
            pts.append((gx * sp + sp / 2 + (H(gx, gy, seed) - .5) * 2 * jit + (sp / 2 if gy % 2 else 0) * .0, gy * sp + sp / 2 + (H(gx, gy, seed + 1) - .5) * 2 * jit))
    return pts
ROCKC = [ST['lit'], rgb('#b4b7b4'), rgb('#a8aba8'), ST['lit'], rgb('#bcbfbc')]
JOINT = [rgb('#8a745c'), rgb('#9e8b64'), rgb('#7f6a55')]
def cobble_px(x, y, pts, seed):
    d = sorted(((x + .5 - px) ** 2 + (y + .5 - py) ** 2, i) for i, (px, py) in enumerate(pts))[:2]
    d1, i1 = d[0][0] ** .5, d[0][1]; d2 = d[1][0] ** .5
    px_, py_ = pts[i1]; gap = d2 - d1
    if gap < 1.35: return JOINT[int(H(x, y, seed) * 3) % 3], i1, True
    base = ROCKC[int(H(i1, 7, seed) * len(ROCKC)) % len(ROCKC)]
    dx, dy = (x + .5 - px_) / 6.5, (y + .5 - py_) / 6.5; v = -.6 * dx - .8 * dy
    c = base
    if v > .35: c = mix(base, ST['hi'], .5)
    elif v < -.45: c = mix(base, ST['mid'], .55)
    if gap < 2.3 and (dx + dy) > 0: c = mix(c, ST['mid'], .55)        # shaded lower-right rim of each rock
    if H(x, y, seed + 5) < .05: c = mix(c, ST['mid'], .5)
    return c, i1, False

def flat_stones(seed, W_=24, H_=20):
    """a rosette of flat pale stones (transparent background)"""
    cv = Cv(W_, H_); cxx, cyy = W_ / 2, H_ / 2; rx, ry = W_ / 2 - 1, H_ / 2 - 1
    pts = [(cxx + math.cos(a) * rx * .5 + (H(i, 1, seed) - .5) * 2, cyy + math.sin(a) * ry * .5 + (H(i, 2, seed) - .5) * 2) for i, a in enumerate([j * 2 * math.pi / 6 + .4 for j in range(6)])] + [(cxx, cyy)]
    for y in range(H_):
        for x in range(W_):
            dx, dy = (x + .5 - cxx) / (rx + 1), (y + .5 - cyy) / (ry + 1)
            ang = math.atan2(dy, dx); rr = (dx * dx + dy * dy) ** .5
            if rr > 1 - .08 * math.sin(4 * ang + seed) - .05: continue
            c, i1, jt = cobble_px(x, y, pts, seed)
            if jt: c = rgb('#8a745c')
            elif i1 == 6: c = mix(c, ST['hi'], .3)
            cv.set(x, y, c)
    return outline(cv.im, 'tblr', .7)

def shape_r(ang): return 1 + .09 * math.sin(3 * ang + 1) + .06 * math.sin(5 * ang + 2) + .05 * math.sin(7 * ang)

RX, RY = 64.0, 56.0
def make_plaza(seed=5, fill='lawn'):
    Wc, Hc = 9, 8; w, h = Wc * T, Hc * T; cxx, cyy = 72, 64
    pts = _seeds(w, h, 12, seed, 3.5)
    inrock = {}
    for i, (px, py) in enumerate(pts):
        dx, dy = (px - cxx) / RX, (py - cyy) / RY; inrock[i] = (dx * dx + dy * dy) ** .5 < shape_r(math.atan2(dy, dx))
    def at(x, y):
        c, i1, jt = cobble_px(x, y, pts, seed); return c, inrock[i1]
    cover = {}
    for cy_ in range(Hc):
        for cx_ in range(Wc):
            cover[(cx_, cy_)] = sum(at(cx_ * T + i, cy_ * T + j)[1] for j in range(T) for i in range(T))
    lo = Image.new('RGBA', (w, h), (0, 0, 0, 0)); kept = {k for k, v in cover.items() if v >= 6}
    for (cx_, cy_) in kept:
        for j in range(T):
            for i in range(T):
                x, y = cx_ * T + i, cy_ * T + j; c, ok = at(x, y)
                if not ok:
                    edge_near = any(at(x + dx, y + dy)[1] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                    c = lawn_px(x, y) if fill == 'lawn' else sand_px(x, y, 0)
                    if edge_near: c = mix(c, rgb('#4b8232'), .55) if fill == 'lawn' else mix(c, rgb('#9e8b64'), .45)
                else:
                    if not all(at(x + dx, y + dy)[1] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): c = dark(c, .62)      # inset outline
                lo.putpixel((x, y), c)
    return lo, kept, pts, at

def draw_shrub(seed=1):
    import palette; palette.apply()
    from px2 import C
    import pz
    c = C(16, 16, seed=200 + seed); c.shadow(8, 14, 7, 1.6)
    c.group(1); c.ellipsoid(8, 8.6, 7, 6, 'leaf', amb=.4, bias=.1, bump=.9, bsc=2.4)
    c.group(2); c.ellipsoid(5, 6.5, 3.6, 3.4, 'leaf', amb=.4, bump=.7, bsc=2, bias=.2); c.ellipsoid(11, 6.5, 3.6, 3.4, 'leaf', amb=.4, bump=.7, bsc=2, bias=.1)
    return pz.fin(c)

def draw_well():
    import palette; palette.apply()
    from px2 import C, _hash as _h
    import pz
    c = C(32, 32, seed=91); c.shadow(16, 29.4, 14.5, 2)
    cx, cy, rx, ry = 16, 19, 12.5, 5
    c.group(6); c.new()
    for y in range(12, 26):
        for x in range(2, 31):
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
            if dx * dx + dy * dy <= 1: c.setv(x, y, 'stone', .98 - .12 * dy - .1 * max(0, dx))
    c.group(7); c.new()
    for y in range(12, 26):
        for x in range(2, 31):
            dx = (x + .5 - cx) / (rx - 3.2); dy = (y + .5 - cy + .2) / (ry - 1.9)
            if dx * dx + dy * dy <= 1:
                if dy < -.15: c.tone(x, y, 'stone', 2 if dy < -.6 else 1)
                else: c.tone(x, y, 'teal', 1 if dy < .5 else 2)
    for x in range(12, 15): c.tone(x, 20, 'teal', 4)
    c.tone(19, 21, 'teal', 3); c.tone(20, 21, 'teal', 3)
    for x in range(2, 31):
        dx = (x + .5 - cx) / rx
        if abs(dx) > 1: continue
        yt = int(round(cy + ry * math.sqrt(1 - dx * dx)))
        for j in range(6):
            y = yt + 1 + j; course = 0 if j < 3 else 1; off = 3 if course else 0
            v = .08 + c.shade(dx, .1, math.sqrt(1 - dx * dx), .3) + (_h((x + off) // 6, course, 91) - .5) * .14
            if j == 2 or (x + off) % 6 == 0: v -= .3
            if j == 5: v -= .2
            c.setv(x, y, 'stone', v, oid=700)
        c.tone(x, yt, 'stone', 5 if dx < .3 else 4)
    for y in range(12, 24):
        for x in range(32):
            if c.m[y][x] == 'stone' and (c.fix[y][x] is None or c.fix[y][x] >= 3): c.darken(x, y, 1)
    im = pz.fin(c)
    # rope + wooden bucket at the front right
    cv = Cv(32, 32); cv.im.paste(im); cv.p = cv.im.load()
    for (x, y) in ((22, 27), (23, 28), (24, 28), (25, 29)): cv.set(x, y, WD['lit'])
    for y in range(25, 31):
        for x in range(25, 30):
            c_ = WD['mid'] if x < 28 else WD['lo']
            if y == 25 or y == 30: c_ = WD['dk']
            cv.set(x, y, c_)
    cv.hline(25, 30, 27, ST['mid']); cv.set(26, 24, WD['lit']); cv.set(28, 24, WD['lit']); cv.hline(26, 29, 23, WD['lit'])
    return cv.im

def draw_board():
    cv = Cv(32, 32)
    for x0 in (5, 24):
        for y in range(18, 31):
            cv.set(x0, y, WD['hi']); cv.set(x0 + 1, y, WD['mid']); cv.set(x0 + 2, y, WD['lo'])
    cv.rect(1, 8, 31, 23, WD['dk']); cv.rect(2, 9, 30, 22, WD['lit']); cv.hline(2, 30, 9, WD['hi']); cv.hline(2, 30, 21, WD['mid'])
    cv.rect(3, 10, 29, 21, WD['mid2'])
    cv.rect(4, 11, 13, 20, rgb('#ecd6c6')); cv.rect(4, 11, 13, 12, rgb('#f7fdff'))
    for y in (13, 15, 17): cv.hline(5, 12, y, rgb('#595b58'))
    cv.hline(5, 9, 19, rgb('#595b58'))
    cv.rect(15, 12, 24, 19, rgb('#dee0dd')); cv.hline(16, 23, 14, rgb('#929491')); cv.hline(16, 22, 16, rgb('#929491')); cv.hline(16, 20, 18, rgb('#929491'))
    cv.rect(25, 12, 28, 18, rgb('#ecd6c6')); cv.rect(26, 13, 28, 15, rgb('#dd2912')); cv.vline(26, 16, 18, rgb('#595b58'))
    for (x, y) in ((8, 11), (19, 12), (26, 12)): cv.set(x, y, WD['deep'])
    cv.hline(2, 30, 23, WD['lo'])
    return outline(cv.im, 'tblr')

def part_plaza(kid='bd-out-well-plaza', fill='lawn'):
    Wc, Hc = 9, 8
    lo, kept, pts, at = make_plaza(5, fill)
    # flat stone rosettes baked into the cobble (lower picture stays opaque)
    for (fx, fy, sd) in ((20, 92, 3), (104, 84, 8)):
        fs = flat_stones(sd, 24, 20); lo.alpha_composite(fs, (fx, fy))
    up = Image.new('RGBA', (Wc * T, Hc * T), (0, 0, 0, 0)); over = {}
    up.alpha_composite(draw_well(), (3 * T, 3 * T)); over.update({(3, 3): 'C', (4, 3): 'C', (3, 4): 'X', (4, 4): 'X'})
    up.alpha_composite(draw_board(), (1 * T, 1 * T)); over.update({(1, 1): 'C', (2, 1): 'C', (1, 2): 'X', (2, 2): 'X'})
    for i, (sx, sy) in enumerate(((3, 0), (4, 0))):
        up.alpha_composite(draw_shrub(i), (sx * T, sy * T)); over[(sx, sy)] = 'X'
    decals = ((7, 0, 11), (0, 7, 14))
    for (dx, dy, sd) in decals:
        up.alpha_composite(flat_stones(sd, 16, 14), (dx * T, dy * T + 1)); over[(dx, dy)] = 'F'
    walk = []
    for y in range(Hc):
        row = ''
        for x in range(Wc):
            row += over.get((x, y), 'F' if (x, y) in kept else '.')
        walk.append(row)
    # the lower picture only where the cell is kept
    K.save_kit(kid, '외곽 우물 광장' + ('' if fill == 'lawn' else ' (모래길 위)'), up, walk,
               '불규칙한 원형 자갈 광장 9x8(연회색 둥근 돌 + 황갈색 틈, 바닥에 구운 그림), 가운데 돌 우물(양동이), 왼쪽 위 게시판(종이), 위쪽 둥근 관목 둘, 납작한 돌 무리 넷(둘은 바닥, 둘은 광장 밖 모서리 장식).',
               '바깥 모서리 칸은 비어 있어 지도의 잔디가 보인다. 우물·게시판 윗줄은 C(플레이어 위에 그림), 아랫줄과 관목은 X. 광장 모서리 장식 돌 칸(7,0)(0,7)은 F(위 그림만).',
               ['외곽', '광장', '우물', '자갈', '게시판'], role='garden', lo=lo,
               notes='자갈이 부분적으로 닿은 가장자리 칸은 ' + ('잔디(lawn16)' if fill == 'lawn' else '모래(sand_tile)') + '로 채워 불투명하게 구웠다. 모래길 위에 놓을 때는 -sand 판을 쓴다.')
    return lo, kept


# =================================================== PROPS (reuse the city's px2 props where they already fit) ===================================================
def part_props():
    import palette; palette.apply()
    import pi, pl, ph, pz
    # woodpile 2x1 (pi.woodpile: split logs, cut ends toward the viewer, pyramid) 
    wp = pz.fin(pi.woodpile())
    reg('bd-out-woodpile', '외곽 장작더미', wp, '쪼갠 장작을 쌓은 2칸 더미(둥근 단면이 앞을 향함).', '집 옆 마당에 놓는다.', ['외곽', '소품', '장작'], role='prop')
    # hay + barrels 3x1: barrel, crate with a hay heap, barrel
    cv = Cv(48, 16)
    cv.im.alpha_composite(pz.fin(pl.rainbarrel()), (0, 0)); cv.im.alpha_composite(pz.fin(pi.crate()), (16, 0)); cv.im.alpha_composite(pz.fin(pl.rainbarrel()), (32, 0))
    cv.p = cv.im.load()
    hay = Cv(48, 16)
    for (hx, hy, hw) in ((17, 11, 13), (20, 9, 8)):                        # heap of straw in front of / over the crate
        for y in range(hy, 16):
            f = (y - hy) / max(1, 15 - hy)
            half = hw / 2 * (0.45 + 0.75 * f)
            for x in range(int(hx + hw / 2 - half), int(hx + hw / 2 + half) + 1):
                c = ST['lit'] if False else [rgb('#ecdb95'), rgb('#ecc04a'), rgb('#aa7a08'), rgb('#845c1f')][min(3, int((y - hy) / 2))]
                if H(x, y, 5) < .3: c = rgb('#ecdb95')
                hay.set(x, y, c)
    hay = outline(hay.im, 'tblr', .7)
    cv.im.alpha_composite(hay, (0, 0))
    reg('bd-out-hay-barrels', '외곽 건초·통·상자', cv.im, '통 둘과 건초를 쌓은 상자, 3칸x1줄.', '집 옆이나 광장 가장자리에 놓는다.', ['외곽', '소품', '건초', '통'], role='prop')
    # fence run 4x1: post-and-rail picket fence with a gap (open gate) at cell 2
    ims = [ph.fence_cell(ph.E), ph.fence_cell(ph.E | ph.Wd), None, ph.fence_cell(ph.Wd)]
    fr = Cv(64, 16)
    for i, c in enumerate(ims):
        if c is not None: fr.im.alpha_composite(pz.fin(c), (i * 16, 0))
    g = Cv(16, 16)
    for x0 in (1, 13):                                                         # two gate posts, taller than the fence
        for y in range(1, 15): g.set(x0, y, WD['lit']); g.set(x0 + 1, y, WD['mid2'])
        g.set(x0, 0, WD['hi']); g.set(x0 + 1, 0, WD['mid'])
    for y in range(6, 15): g.set(4, y, WD['lit']); g.set(5, y, WD['mid2'])            # gate leaf swung open against the left post
    g.hline(3, 7, 6, WD['hi']); g.hline(3, 7, 11, WD['mid'])
    fr.im.alpha_composite(outline(g.im, 'tblr', .7), (32, 0))
    reg('bd-out-fence-run', '외곽 나무 울타리(문틈)', fr.im, '말뚝 울타리 4칸: 양 끝 울타리, 가운데 열린 문틈(기둥 둘 + 열린 문짝).', '가운데 문틈 칸(2,0)은 걸어 지나간다(C: 기둥만 위에 그려짐).', ['외곽', '소품', '울타리'], role='prop', over={(2, 0): 'C'})
    # signpost 1x2 (top cell: boards over the player, bottom cell: post foot)
    sp = pz.fin(pl.signpost())
    reg('bd-out-signpost', '외곽 이정표', sp, '나무 이정표(화살표 판 둘), 1칸x2줄.', '갈림길이나 마을 입구에 놓는다. 윗칸은 C, 아랫칸(기둥 밑)은 X.', ['외곽', '소품', '이정표'], role='prop', over={(0, 0): 'C', (0, 1): 'X'})

def build_all():
    build_parts(); build_houses(); part_plaza(); part_plaza('bd-out-well-plaza-sand', 'sand'); part_sand_patch(); part_props()
    if hasattr(sys.modules[__name__], 'build_extra'): build_extra()

IDS = None
def all_ids():
    return sorted(p for p in K.all_kits() if p.startswith('bd-out-'))

if __name__ == '__main__':
    build_all()
    bad = 0
    for k in all_ids():
        e = K.validate(k); K.preview(k)
        print(k, 'OK' if not e else e[:5]); bad += bool(e)
    sys.exit(1 if bad else 0)
