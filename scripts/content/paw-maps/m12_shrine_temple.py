import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *
from pawlib import _xp_piece
import json
from PIL import Image
# ---- map-local helpers (kits / composites / assemblies / loose chips from tiledata, with an overlap guard) ----
TD = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tiledata/pixel-art-world'))
_J = {}
def J(n):
    if n not in _J: _J[n] = json.load(open(os.path.join(TD, n)))
    return _J[n]
OWN = {}
def claim(m, x, y, w, h, name):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            assert 0 <= xx < m.w and 0 <= yy < m.h, (name, 'outside', xx, yy)
            assert (xx, yy) not in OWN, f'{name} overlaps {OWN[(xx, yy)]} at {xx},{yy}'
            OWN[(xx, yy)] = name
def free(x, y, w=1, h=1): return all((xx, yy) not in OWN for yy in range(y, y + h) for xx in range(x, x + w))
def over(m, x, y, im, used): m.over.append((x * 32, y * 32, im)); m.used.update(used)
def R(m, sh, sx, sy, w, h, x, y, name=None):
    """whole block from a sheet, claimed"""
    if name is not False: claim(m, x, y, w, h, name or f'{sh}@{sx},{sy}')
    m.rect(sh, sx, sy, w, h, x, y)
def rec(m, sh, rid, x, y, name=None):
    q = CATALOG['recipes'][sh][rid]['rect']; R(m, sh, q['x'], q['y'], q['width'], q['height'], x, y, name or rid)
def kit(m, kid, x, y, name=None):
    ck = J('city-kits.json'); src = {s['id']: s for s in ck['sources']}; k = next(k for k in ck['kits'] if k['id'] == kid)
    w, h = k['width'], k['height']; claim(m, x, y, w, h, name or kid)
    im = Image.new('RGBA', (w * 32, h * 32)); used = set()
    for layer in ('lowerTiles', 'upperTiles'):
        for i, r in enumerate(k.get(layer) or []):
            if not r or r.get('tile', -1) < 0: continue
            s = src[r['source']]; used.add(s['filename'])
            c = _xp_piece(sheet(s['filename']), s['variantMasks'][r['tile']]) if s['format'] == 'xp-autotile' else tile(s['filename'], r['tile']).image()
            im.alpha_composite(c, (i % w * 32, i // w * 32))
    over(m, x, y, im, used)
def comp(m, cid, x, y, name=None):
    for f in ('mansion-exteriors-layout.json', 'retrotown-exteriors-layout.json'):
        for p in J(f):
            for c in p['composites']:
                if c['id'] != cid: continue
                W_, H_ = c['canvas']['width'], c['canvas']['height']; claim(m, x, y, -(-W_ // 32), -(-H_ // 32), name or cid)
                im = Image.new('RGBA', (W_, H_)); s = sheet(p['sourceFilename'])
                for q in c['parts']:
                    r = q['sourceRect']; im.alpha_composite(s.crop((r['x'], r['y'], r['x'] + r['width'], r['y'] + r['height'])), (q['offset']['x'], q['offset']['y']))
                return over(m, x, y, im, {p['sourceFilename']})
    raise KeyError(cid)
def arr(m, sh, a, x, y, name, skip=()):
    """full lower/upper id arrays (tiledata assemblies); ids in skip (ground) are left to the map's own floor"""
    w, h = a['width'], a['height']; claim(m, x, y, w, h, name)
    im = Image.new('RGBA', (w * 32, h * 32))
    for layer in ('lowerTiles', 'upperTiles'):
        for i, t in enumerate(a[layer]):
            if t is None or t < 0 or (layer == 'lowerTiles' and t in skip): continue
            im.alpha_composite(tile(sh, t).image(), (i % w * 32, i // w * 32))
    over(m, x, y, im, {sh})
def loose(m, fn, idx, x, y, name=None):
    p = next(p for p in J('loose.json')['packs'] if p['filename'] == fn); r = p['recipes'][idx]['pixelRect']
    claim(m, x, y, -(-r['width'] // 32), -(-r['height'] // 32), name or f'{fn}#{idx}@{x},{y}')
    m.image(fn, x, y, (r['x'], r['y'], r['x'] + r['width'], r['y'] + r['height']))
def T1(m, sh, t, x, y, name=None):
    """single sheet cell on the upper layer, claimed"""
    if name is not False: claim(m, x, y, 1, 1, name or f'{sh}:{t}@{x},{y}')
    m.put(x, y, tile(sh, t))
TN, RT, SE, CV, PK, SC, GY = 'ST-Town-E01.png', 'ST-RTown-E01.png', 'ST-Sento-E01.png', 'ST-Convi-E01.png', 'ST-Park-E01.png', 'ST-Schl-E01.png', 'ST-Schl-Gym.png'
def rtown(m, x, y, name, sh=RT, wall=None, roof=None, awning=True, front='shop', window=True, fire=True):
    """retro-rtown-whole-building (6x8) with wall/roof tiles remapped on the same sheet (TOWN.md 건물 다양화)"""
    WALL = {'grey': {232: 266, 233: 267, 234: 266, 240: 266, 241: 267, 242: 266}, 'plaster': {232: 250, 233: 251, 234: 252, 240: 250, 241: 251, 242: 252}}.get(wall, {})
    ROOF = {'dark': {274: 283, 282: 291, 302: 303}, 'light': {274: 286, 282: 294, 302: 302}, 'mid': {274: 281, 282: 289, 302: 292}}.get(roof, {})
    c = next(c for p in J('retrotown-exteriors-layout.json') for c in p['composites'] if c['id'] == 'retro-rtown-whole-building')
    claim(m, x, y, 6, 8, name); s = sheet(sh); im = Image.new('RGBA', (192, 256))
    for p in c['parts']:
        r, off, role = dict(p['sourceRect']), dict(p['offset']), p['role']; t = r['y'] // 32 * 8 + r['x'] // 32
        if r['width'] == 32 and role.startswith('wood-wall') and t in WALL: t = WALL[t]; r = {'x': t % 8 * 32, 'y': t // 8 * 32, 'width': 32, 'height': 32}
        if r['width'] == 32 and role.startswith('roof') and t in ROOF: t = ROOF[t]; r = {'x': t % 8 * 32, 'y': t // 8 * 32, 'width': 32, 'height': 32}
        if role == 'native-striped-awning-section' and not awning: continue
        if role == 'whole-window-under-eave' and not window: continue
        if role == 'whole-fire-warning' and not fire: continue
        if role.startswith('complete-shop-front') and front == 'paper': r = {'x': 0, 'y': 1376, 'width': 64, 'height': 68}; off = {'x': 64, 'y': 188}
        im.alpha_composite(s.crop((r['x'], r['y'], r['x'] + r['width'], r['y'] + r['height'])), (off['x'], off['y']))
    over(m, x, y, im, {sh})
_ = None
def jgrid(L, wall='wood', roof='dark', side='right', front='wood'):
    """Japanese house after author sample s15 (TOWN.md): 5-wide kawara gable wing + L-wide side wing, 10 rows"""
    R2, R3, R5 = (284, 292, 308) if roof == 'dark' else (286, 294, 318)
    W = 5 + L; g = [[None] * W for _r in range(10)]
    gable = [[_,273,274,275,_],[273,281,282,283,275],[281,281,282,283,283],[281,281,282,283,283],
             [281,(57,297),(57,298),(57,299),283],[(57,297),(57,305),(57,304),(57,307),(57,299)],
             [216,(217,316),(217,316),(217,316),218],[224,349,350,351,226],[232,357,358,359,234],[204,237,238,239,206]]
    for y, r in enumerate(gable):
        for x, c in enumerate(r): g[y][x] = c
    if front == 'plaster':
        g[7][0], g[7][4] = 57, 58; g[8][0], g[8][4] = 65, 66
        for x in (1, 2, 3): g[7][x] = (57, g[7][x]); g[8][x] = (65, g[8][x])
    if L:
        top, mid = ((227, 225, 226), (235, 233, 234)) if wall == 'wood' else ((57, 57, 58), (65, 65, 66))
        for i in range(L):
            x = 5 + i; k = 0 if i == 0 else (2 if i == L - 1 else 1)
            g[2][x] = R2; g[3][x] = R3; g[4][x] = R3; g[5][x] = ((216, 217, 218)[k], R5); g[6][x] = top[k]; g[7][x] = mid[k]
        if L >= 5:
            for j, (a, b) in enumerate(((344, 352), (345, 353), (346, 354))): g[6][6 + j] = a; g[7][6 + j] = b
            g[8][7] = 360; g[8][8] = 360; g[6][5] = (g[6][5], 330); g[7][5] = (g[7][5], 338)
        if L >= 3: g[6][W - 2] = (g[6][W - 2], 340)
    if side == 'left' and L: g = [r[5:] + r[:5] for r in g]
    return g
def jhouse(m, x, y, L, name, wall='wood', roof='dark', side='right', front='wood', stones=True):
    """(5+L)x10 (9 without step stones); returns the genkan approach cell"""
    g = jgrid(L, wall, roof, side, front)
    if not stones: g = g[:9]
    claim(m, x, y, len(g[0]), len(g), name)
    for dy, r in enumerate(g):
        for dx, c in enumerate(r):
            for t in (c if isinstance(c, tuple) else (c,)):
                if t is not None: m.put(x + dx, y + dy, tile(TN, t))
    dx0 = L if side == 'left' else 0
    return (x + dx0 + 2, y + len(g) - (0 if stones else 0))
def bwall(m, x0, y0, x1, y1, gates=(), open_sides='', name=None):
    """grey concrete-block wall ring from ST-Town-E01: back wall = cap row 104/105/106, sides 88/90,
    front wall = cap row (y1-1) 104/105/106 over face row (y1) 112/113/114; gates are open columns in the front wall"""
    name = name or f'wall@{x0},{y0}'
    def cap(xx, yy, t0):
        if not free(xx, yy): return
        l = xx == x0 or xx - 1 in gates; r = xx == x1 or xx + 1 in gates
        T1(m, TN, t0 + (0 if l and not r else 2 if r and not l else 1), xx, yy, name)
    for xx in range(x0, x1 + 1):
        if 'T' not in open_sides: cap(xx, y0, 104)
        if 'B' not in open_sides and xx not in gates: cap(xx, y1 - 1, 104); cap(xx, y1, 112)
    for yy in range(y0 + 1, y1 - 1):
        for xx, t, sd in ((x0, 88, 'L'), (x1, 90, 'R')):
            if sd in open_sides or not free(xx, yy): continue
            T1(m, TN, t, xx, yy, name)
def pole(m, x, y):
    """utility pole TN 85/93/101, base cell (x,y)"""
    claim(m, x, y - 2, 1, 3, f'pole@{x},{y}')
    for dy, t in ((-2, 85), (-1, 93), (0, 101)): m.put(x, y + dy, tile(TN, t))
def pine(m, x, y, name=None): R(m, TN, 5, 16, 2, 3, x, y, name or f'pine@{x},{y}')
def roofshop(m, x, y, w, style='shutter', roof='SA-Roof01.png', name=None):
    """7-row shop: XP roof 3 rows over a CV wall, TN glass or shutter front (TOWN.md shop())"""
    name = name or f'shop@{x}'; claim(m, x, y, w, 7, name); h = 7
    m.fill(x, y, w, 3, auto(roof), 'up')
    for dy in range(3, h): m.fill(x, y + dy, w, 1, tile(CV, 289), 'up')
    door = w // 2 - 1
    for dx in range(1, w - 1):
        for dy in range(2):
            a = (262, 270) if style == 'glass' else (257, 265)
            par = (dx - 1) % 2 if style == 'glass' else (dx - door - 1) % 2
            if style == 'glass' and dx in (door, door + 1): continue
            if style != 'glass' and dx == door: continue
            m.put(x + dx, y + 5 + dy, tile(TN, a[dy] + par))
    for dy in range(2):
        m.put(x + door, y + 5 + dy, tile(TN, (243 if style == 'glass' else 259) + dy * 8))
        if style == 'glass': m.put(x + door + 1, y + 5 + dy, tile(TN, 244 + dy * 8))
    return (x + door, y + h)
def konbini(m, x, y, w, roof='SA-Roof01.png', name='konbini'):
    """CV glass storefront (store-front 0,44 + store-door 4,47) under an XP roof, 7 rows"""
    claim(m, x, y, w, 7, name)
    m.fill(x, y, w, 3, auto(roof), 'up')
    for dy in range(3, 7): m.fill(x, y + dy, w, 1, tile(CV, 289), 'up')
    door = w // 2 - 1
    for dx in range(1, w - 1):
        for dy in range(3): m.put(x + dx, y + 4 + dy, tile(CV, (44 + dy) * 8 + dx % 2))
    for dy in range(3):
        for dx in range(2): m.up[y + 4 + dy][x + door + dx] = [tile(CV, (47 + dy) * 8 + 4 + dx)]
    for dx in range(w): m.put(x + dx, y + 3, tile(CV, 344 + (2 if dx == 2 else 0)))
    return (x + door, y + 7)
def school_main(m, x, y, w, floors=2, roof='SA-Roof01.png', name='school-main'):
    """ST-Schl-E01 main building (TOWN.md school_main): XP roof 5 rows, cornice, floors*3 rows of classroom windows"""
    rh = 5; h = rh + 1 + floors * 3; claim(m, x, y, w, h, name)
    m.fill(x, y, w, rh, auto(roof), 'up'); ry = y + rh
    m.fill(x, ry, w, 1, tile(SC, 241), 'up'); m.put(x + w // 2, ry, tile(SC, 195))
    door = x + w // 2 - 1
    for f in range(floors):
        fy = ry + 1 + f * 3; last = f == floors - 1
        for dx in range(w):
            m.put(x + dx, fy, tile(SC, 241)); m.put(x + dx, fy + 1, tile(SC, 241))
            m.put(x + dx, fy + 2, tile(SC, 249 if last else (256 if dx == 0 else 258 if dx == w - 1 else 257)))
            if 1 <= dx <= w - 2 and dx % 8 != 0 and not (last and door - 1 <= x + dx <= door + 2):
                m.put(x + dx, fy, tile(SC, 266 + (dx % 2 == 0))); m.put(x + dx, fy + 1, tile(SC, 274 + (dx % 2 == 0)))
        if last:
            m.put(door, fy + 1, tile(SC, 280)); m.put(door + 1, fy + 1, tile(SC, 281)); m.put(door, fy + 2, tile(SC, 288)); m.put(door + 1, fy + 2, tile(SC, 289))
    return (door, y + h)
def nine(m, x, y, w, h, sh, sx, sy, cols=(0, 1, 1, 2), rows=(0, 1, 2)):
    for dy in range(h):
        ry = rows[0] if dy == 0 else rows[2] if dy == h - 1 else rows[1]
        for dx in range(w):
            cx = cols[0] if dx == 0 else cols[-1] if dx == w - 1 else cols[1 + (dx - 1) % (len(cols) - 2)]
            m.put(x + dx, y + dy, tile(sh, (sy + ry) * 8 + sx + cx))
def finish(m):
    holes = [(x, y) for y in range(m.h) for x in range(m.w) if m.lo[y][x] is None]
    assert not holes, f'unfilled ground {holes[:5]}'
    m.save()
# ---- end helpers ----

def spans(rows):
    """{y: (x0, x1)} -> cell set (irregular outline row by row)"""
    return {(x, y) for y, (a, b) in rows.items() for x in range(a, b + 1)}
def brush(pts, w=2):
    """cells swept by a w x w brush along a polyline (winding paths; autotiles join on any cell set)"""
    out = set()
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            cx, cy = round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)
            out |= {(cx + a, cy + b) for a in range(w) for b in range(w)}
    return out
def ring(inner):
    """1-cell wall ring = 8-neighbour boundary of an interior cell set"""
    return {(x + a, y + b) for x, y in inner for a in (-1, 0, 1) for b in (-1, 0, 1)} - inner
PATH = set()
def onpath(x, y, w, h): assert not any((xx, yy) in PATH for xx in range(x, x + w) for yy in range(y, y + h)), ('on path', x, y)

m = Map('m12_shrine_temple', '신사와 절 경내', 44, 32, 'exterior', '서쪽은 이나리 신사: 돌 기단 위 사당과 붉은 도리이 줄. 동쪽은 절: 이끼 정원, 돌 기단의 범종, 굽은 돌길로 들어가는 돌담 묘지와 지장보살. 남쪽 참배길로 이어진다.')
m.fill(0, 0, 44, 32, auto('SA-GrassD02.png'))
# ---- south stone approach road, with small forecourts where each precinct opens onto it
road = {(x, y) for x in range(44) for y in range(28, 32)} | {(x, 27) for x in range(6, 13)} | {(x, 27) for x in range(29, 35)} | {(x, 26) for x in range(30, 34)}
m.cells(road, auto('SA-Ground-St01.png'))
# ---- shrine (west): gravel precinct with a ragged edge, stone platform under the hall, straight torii approach
yard = spans({9: (4, 14), 10: (2, 16), 11: (2, 17), 12: (3, 17), 13: (4, 17), 14: (4, 16), 15: (4, 16), 16: (3, 16), 17: (3, 16), 18: (3, 17),
              19: (4, 17), 20: (4, 17), 21: (4, 16), 22: (5, 16), 23: (5, 16), 24: (5, 15), 25: (4, 15), 26: (4, 14), 27: (3, 13)})
m.cells(yard - road, auto('SA-GroundY01.png'))
base = {(x, y) for x in range(4, 15) for y in range(2, 9)} - {(x, y) for x in (4, 5, 13, 14) for y in (2, 3)} - {(4, 8), (14, 8)}
m.cells(base, auto('SA-Ground-St01.png'))                           # stepped stone platform (kidan) under the hall
m.cells({(x, y) for x in range(8, 11) for y in range(8, 27)}, auto('SA-SRoad01.png'))   # sando, centred on the hall (x9)
loose(m, 'oinarisama.png', 0, 7, 2, 'shrine')                        # closed hall 5x6 (x7..11, y2..7)
loose(m, 'oinarisama.png', 8, 5, 6, 'fox-l'); loose(m, 'oinarisama.png', 9, 13, 6, 'fox-r')
loose(m, 'oinarisama.png', 7, 9, 8, 'offering-box')
loose(m, 'oinarisama.png', 12, 3, 9, 'banner-l'); loose(m, 'oinarisama.png', 13, 15, 9, 'banner-r')
for i, y in enumerate((12, 16, 20)): loose(m, 'torii01.png', 1 + (i % 2), 8, y, f'torii{y}')     # red torii tunnel over the path
loose(m, 'torii01.png', 0, 7, 24, 'torii-big')
rec(m, SE, 'retro-sento-stone-lantern', 5, 14, 'lantern-l'); rec(m, SE, 'retro-sento-stone-lantern', 13, 14, 'lantern-r')
# precinct edge: trees and hedges clustered unevenly along the ragged gravel line (grass side)
pine(m, 0, 0, 'pine-a'); pine(m, 15, 1, 'pine-b'); pine(m, 0, 10, 'pine-c'); pine(m, 1, 19, 'pine-d'); pine(m, 18, 5, 'pine-e')
rec(m, SE, 'retro-sento-tree', 0, 14, 'tree-w')
loose(m, 'momiji.png', 0, 13, 19, 'maple')
R(m, TN, 0, 17, 3, 2, 1, 24, 'hedge-sw'); R(m, TN, 0, 17, 3, 2, 17, 22, 'hedge-se'); R(m, TN, 0, 17, 3, 2, 1, 6, 'hedge-nw')
# ---- boundary between precincts: bamboo fence
loose(m, 'takezaku.png', 0, 19, 12, 'bamboo-fence')
# ---- temple (east): irregular walled graveyard entered by a gate, winding stone path, bell on a stone base, moss garden
grave_in = {(x, y) for x in range(25, 33) for y in range(4, 12)} | {(x, y) for x in range(29, 41) for y in range(2, 9)} | {(x, y) for x in range(33, 40) for y in range(9, 11)}
grave_in -= {(25, 4), (26, 4), (25, 5)}                               # clipped NW corner
wall = ring(grave_in); GATE = {(30, 12), (31, 12)}
tyard = spans({12: (23, 42), 13: (23, 42), 14: (24, 42), 15: (23, 41), 16: (23, 41), 17: (24, 42), 18: (24, 41), 19: (23, 41), 20: (23, 40),
               21: (24, 41), 22: (24, 41), 23: (25, 40), 24: (26, 39), 25: (27, 38), 26: (28, 36)})
m.cells(tyard - road, auto('SA-GroundG06.png'))
m.cells(grave_in, auto('SA-GroundG06.png'))
moss2 = spans({15: (26, 29), 16: (24, 30), 17: (24, 30), 18: (25, 30), 19: (24, 29), 20: (25, 29), 21: (26, 28)})
moss1 = spans({16: (26, 28), 17: (25, 29), 18: (26, 29), 19: (26, 28)})
m.cells(moss2, auto('SA-Moss02.png')); m.cells(moss1, auto('SA-Moss01.png'))
bell_base = {(x, y) for x in range(35, 39) for y in range(14, 18)} - {(35, 14), (38, 17)}
m.cells(bell_base, auto('SA-Ground-St01.png'))
PATH |= brush([(31, 26), (31, 24), (33, 22), (33, 19), (32, 17), (30, 15), (30, 12)])        # from the road forecourt to the gate
PATH |= brush([(33, 17), (35, 16)], 1)                                                   # spur to the bell base
PATH |= brush([(30, 11), (30, 9), (32, 7), (35, 6), (38, 5)], 1) | brush([(31, 9), (27, 8), (27, 6)], 1)   # inside: forks between the plots
PATH -= wall - GATE; PATH -= road
m.cells(PATH, auto('SA-SRoad01.png'))
m.cells(wall - GATE, auto('SA-StFence02.png'))
for c in wall - GATE: claim(m, c[0], c[1], 1, 1, 'stwall')
rec(m, SE, 'retro-sento-stone-lantern', 29, 13, 'gate-lantern-l'); rec(m, SE, 'retro-sento-stone-lantern', 32, 13, 'gate-lantern-r')
graves = ((26, 6, 3), (28, 5, 5), (26, 9, 7), (28, 10, 4), (30, 3, 6), (32, 3, 4), (34, 2, 7), (36, 3, 3), (39, 2, 5), (39, 6, 4), (36, 7, 6), (38, 8, 3))
for gx, gy, idx in graves:
    onpath(gx, gy, 1, {3: 2, 4: 2, 5: 3, 6: 2, 7: 3}[idx])
    loose(m, 'ohaka.png', idx, gx, gy, f'grave{gx},{gy}')
onpath(33, 9, 3, 2); loose(m, 'ohaka.png', 8, 33, 9, 'grave-fence')
onpath(27, 11, 1, 1); loose(m, 'ohaka.png', 2, 27, 11, 'bucket')
loose(m, 'kane.png', 0, 36, 15, 'bell')
loose(m, 'jizo.png', 0, 37, 20, 'jizo')
onpath(35, 22, 1, 2); rec(m, SE, 'retro-sento-stone-lantern', 35, 22, 'lantern-t')
pine(m, 41, 14, 'pine-f'); rec(m, SE, 'retro-sento-tree', 40, 22, 'tree-e'); pine(m, 22, 20, 'pine-g'); R(m, TN, 0, 17, 3, 2, 24, 24, 'hedge-t')
finish(m)
