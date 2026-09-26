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
    ROOF = {'dark': {274: 283, 282: 291, 302: 299}, 'light': {274: 286, 282: 294, 302: 302}, 'mid': {274: 281, 282: 289, 302: 292}}.get(roof, {})
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

V = 'y'; SH = 'ST-MsionY-E01.png'
def mx(rid, x, y, name=None): rec(m, SH, f'msex-y-' + rid, x, y, name or f'{rid}@{x},{y}')
m = Map('m05_mansion_y_topiary', '양관 Y 정원수 길', 36, 26, 'exterior', '노란 양관. 두꺼운 생울타리 안, 남문에서 굽이치며 현관으로 오르는 자갈 관리로, 곡선으로 깎은 정원수 생울타리 줄과 동서 화단.')

def box(x, y, w, h): return {(xx, yy) for yy in range(y, y + h) for xx in range(x, x + w)}
def octo(cx, cy, rows): return {(cx + dx, cy + dy) for dy, hw in rows for dx in range(-hw, hw + 1)}
def mir(cells, axis=34): return {(axis - x, y) for x, y in cells}
def ring(inside, gate=()):
    """1-cell hedge/fence following the 8-neighbour outline of an arbitrary inside cell set"""
    return {(x, y) for y in range(m.h) for x in range(m.w) if (x, y) not in inside and (x, y) not in gate
            and any((x + a, y + b) in inside for a in (-1, 0, 1) for b in (-1, 0, 1))}
def core(cells): return {c for c in cells if all((c[0] + a, c[1] + b) in cells for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
def paint(cells, ref, name=None):
    m.cells(sorted(cells), ref)
    if name:
        for x, y in cells: claim(m, x, y, 1, 1, name)
def onbed(rid, x, y, name):
    """standing plant on a bed: every cell must be bed (then the bed claim is handed over)"""
    q = CATALOG['recipes'][SH][f'msex-{V}-' + rid]['rect']
    cs = box(x, y, q['width'], q['height'])
    assert all(OWN.get(c) == 'bed' for c in cs), (name, 'not on bed')
    for c in cs: del OWN[c]
    mx(rid, x, y, name)

m.fill(0, 0, 36, 26, auto('SA-GrassC01.png'))
# boundary hedge: a 2-row north mass that steps down beside the house, stepped east/west sides, south gate
inside = (box(2, 2, 32, 21) | box(4, 1, 28, 1) | box(4, 23, 10, 1) | box(21, 23, 11, 1)) - \
         {(2, 2), (33, 2), (2, 3), (33, 3), (2, 22), (33, 22), (2, 21), (33, 21), (3, 22), (32, 22)}
inside |= box(14, 23, 7, 1) | box(14, 1, 7, 1)
gate = box(16, 24, 3, 2)
inside -= box(4, 1, 10, 1) | box(21, 1, 11, 1)          # north hedge is 2 rows deep beside the house
inside |= box(14, 0, 7, 1)                                  # lawn strip behind the house, no 1-tile hedge strip on the edge
paint(ring(inside, gate), auto('SA-GBorderB01.png'), 'hedge')
m.cells(sorted(box(0, 0, 36, 26) - inside - gate - {c for c in OWN if OWN[c] == 'hedge'}), auto('SA-GBorderB01.png'))
for c in sorted(box(0, 0, 36, 26) - inside - gate):
    if c not in OWN: claim(m, *c, 1, 1, 'hedge')
# gravel walk: gate -> jogs west -> climbs back to the porch; side loops round each hedge garden
walk = (box(16, 21, 3, 5) | box(14, 18, 4, 3) | box(13, 15, 3, 3) | box(14, 13, 3, 2) | box(15, 11, 5, 2)) - {(13, 15), (19, 12), (15, 12)}
walk |= box(17, 19, 2, 2)
def dil(c): return {(x + a, y + b) for x, y in c for a in (-1, 0, 1) for b in (-1, 0, 1)}
stw = octo(8, 18, [(-2, 2), (-1, 3), (0, 4), (1, 3), (2, 2)]); ste = octo(26, 17, [(-2, 2), (-1, 3), (0, 4), (1, 3)])
hw, he = dil(stw) - stw, dil(ste) - ste                       # clipped hedge ring round a stone court
loopw, loope = dil(dil(stw)) - dil(stw), dil(dil(ste)) - dil(ste)   # gravel loop round each hedge garden, 4-connected
walk |= box(19, 16, 2, 2)
paint(walk | loopw | loope, auto('SA-SRoad02.png'))
comp(m, 'msex-y-whole-house', 14, 1, 'house')          # 7x10, porch (17,10) -> approach (17,11)
paint(hw, auto('SA-BorderG02.png'), 'hrow-w'); paint(he, auto('SA-BorderG02.png'), 'hrow-e')
paint(stw, auto('SA-Stone01.png')); paint(ste, auto('SA-Stone01.png'))
mx('flower-pedestal', 8, 17, 'ped-w'); mx('flower-pedestal', 26, 16, 'ped-e')
# north beds flanking the house: notched outlines, flowers only inside, topiaries behind
bw = box(4, 8, 8, 3) - {(4, 8), (11, 10), (4, 10)} | {(5, 7), (6, 7)}
be = mir(bw)
paint(bw | be, auto('SA-Kadan03.png'))
for x, y in bw | be: claim(m, x, y, 1, 1, 'bed')
onbed('rose-pink', 6, 8, 'rose-w'); onbed('rose-red', 27, 8, 'rose-e')
m.cells(sorted({c for c in core(bw) | core(be) | {(9, 9), (10, 9), (24, 9), (25, 9)} if OWN.get(c) == 'bed'}), auto('SA-Flower01.png'), 'up')
mx('topiary-tall', 4, 3, 'tall-a'); mx('topiary-round', 8, 3, 'rnd-a'); mx('topiary-tall', 11, 2, 'tall-b')
mx('topiary-round', 22, 3, 'rnd-b'); mx('topiary-tall', 25, 2, 'tall-c'); mx('topiary-round', 29, 4, 'rnd-c')
# benches off the walk, staggered
mx('bench-front', 23, 11, 'bench-e'); mx('flower-pedestal', 15, 22, 'ped-gate-l'); mx('flower-pedestal', 19, 22, 'ped-gate-r'); mx('bench-front', 7, 11, 'bench-w')
mx('topiary-round', 30, 21, 'rnd-se'); mx('topiary-round', 11, 12, 'rnd-mid')
finish(m)
