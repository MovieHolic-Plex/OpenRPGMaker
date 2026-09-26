# PAW 일본 소도시 96×72 직접 배치 생성기. 그림은 재배포 금지 — 출력 PNG 는 저장소 밖(~/claude-viz)에만 쓴다.
import json
from PIL import Image
W='/home/main/z-project/rpg-zzu/.claude/worktrees/paw-ext'
SRC='/home/main/.local/share/oprn/pixel-art-world-downloads'
TD=W+'/tiledata/pixel-art-world'
_c={}
def img(n):
    if n not in _c: _c[n]=Image.open(f'{SRC}/{n}').convert('RGBA')
    return _c[n]
def tile(n,t):
    s=img(n); return s.crop((t%(s.width//32)*32,t//(s.width//32)*32,t%(s.width//32)*32+32,t//(s.width//32)*32+32))
def norm(m):
    r=m&15
    for d,i in ((16,3),(32,6),(64,12),(128,9)):
        if (m&i)==i and m&d: r|=d
    return r
def xp(n,mask):
    s=img(n); o=Image.new('RGBA',(32,32)); m=norm(mask)
    for q in range(4):
        right,bottom=q%2,q//2; dx,dy=right*16,bottom*16
        if m==0: sx,sy=dx,dy
        else:
            v=m&(4 if bottom else 1); h=m&(2 if right else 8)
            dg=m&((32 if right else 64) if bottom else (16 if right else 128))
            if v and h and not dg: sx,sy=64+dx,dy
            else: sx=32+dx if h else (80 if right else 0); sy=64+dy if v else (112 if bottom else 32)
        o.alpha_composite(s.crop((sx,sy,sx+16,sy+16)),(dx,dy))
    return o
KD=json.load(open(TD+'/city-kits.json'))
SRCS={s['id']:s for s in KD['sources']}
KITS={k['id']:k for k in KD['kits']}
def kit_cell(ref):
    s=SRCS[ref['source']]
    if s['format']=='xp-autotile': return xp(s['filename'], s['variantMasks'][ref['tile']])
    return tile(s['filename'],ref['tile'])
def kit_images(kid):
    k=KITS[kid]; w,h=k['width'],k['height']
    lo=Image.new('RGBA',(w*32,h*32)); up=Image.new('RGBA',(w*32,h*32))
    for layer,im in (('lowerTiles',lo),('upperTiles',up)):
        for i,r in enumerate(k.get(layer) or []):
            if r is None or (isinstance(r,dict) and r.get('tile',-1)<0) or r==-1: continue
            im.alpha_composite(kit_cell(r),(i%w*32,i//w*32))
    return lo,up
COMP={}
for f in ['mansion-exteriors-layout.json','retrotown-exteriors-layout.json']:
    for p in json.load(open(TD+'/'+f)):
        for c in p['composites']: COMP[c['id']]=(p['sourceFilename'],c)
def comp_image(cid):
    fn,c=COMP[cid]; o=Image.new('RGBA',(c['canvas']['width'],c['canvas']['height'])); s=img(fn)
    for p in c['parts']:
        r=p['sourceRect']; o.alpha_composite(s.crop((r['x'],r['y'],r['x']+r['width'],r['y']+r['height'])),(p['offset']['x'],p['offset']['y']))
    return o
import sys, json
from collections import deque

W, H = 96, 72
SC, TN, CV, PK, GY = 'ST-Schl-E01.png', 'ST-Town-E01.png', 'ST-Convi-E01.png', 'ST-Park-E01.png', 'ST-Schl-Gym.png'
R1, R2, R3, R4 = 'SA-Roof01.png', 'SA-Roof02.png', 'SA-Roof03.png', 'SA-Roof04.png'
DITCH = 'SA-Ditch01.png'

lo = [[[] for _ in range(W)] for _ in range(H)]
up = [[[] for _ in range(W)] for _ in range(H)]
solid = [[False] * W for _ in range(H)]
owner = [[None] * W for _ in range(H)]
placements, entrances = [], []

def T(f, t): return ('t', f, t)

def ground(x, y, w, h, ref):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            lo[yy][xx] = [ref]

def claim(x, y, w, h, name):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            assert 0 <= xx < W and 0 <= yy < H, (name, xx, yy)
            assert owner[yy][xx] is None, f'{name} overlaps {owner[yy][xx]} at {xx},{yy}'
            owner[yy][xx] = name

def put(x, y, ref, layer='up', s=None):
    (up if layer == 'up' else lo)[y][x].append(ref)
    if s is not None: solid[y][x] = s

def stamp(x, y, f, sx, sy, w, h, layer='up', s=True, name=None):
    if name: claim(x, y, w, h, name)
    for dy in range(h):
        for dx in range(w):
            put(x + dx, y + dy, T(f, (sy + dy) * 8 + sx + dx), layer, s)

def xpcells(cells, f, layer='lo', s=True):
    cs = set(cells)
    for (x, y) in cs:
        m = 0
        for (dx, dy, b) in ((0, -1, 1), (1, 0, 2), (0, 1, 4), (-1, 0, 8), (1, -1, 16), (1, 1, 32), (-1, 1, 64), (-1, -1, 128)):
            if (x + dx, y + dy) in cs: m |= b
        put(x, y, ('x', f, norm(m)), layer, s)

def rect(x, y, w, h): return [(xx, yy) for yy in range(y, y + h) for xx in range(x, x + w)]

def nine(x, y, w, h, f, sx, sy, layer='lo', s=True, cols=(0, 1, 2, 3), rows=(0, 1, 2)):
    """nine-slice: cols = (left, mid-a, mid-b, right) offsets, rows = (top, mid, bottom)."""
    for dy in range(h):
        ry = rows[0] if dy == 0 else rows[2] if dy == h - 1 else rows[1]
        for dx in range(w):
            cx = cols[0] if dx == 0 else cols[-1] if dx == w - 1 else cols[1 + (dx - 1) % (len(cols) - 2)]
            put(x + dx, y + dy, T(f, (sy + ry) * 8 + sx + cx), layer, s)

def entrance(name, ex, ey, ax, ay):
    entrances.append({'building': name, 'x': ex, 'y': ey, 'approach': {'x': ax, 'y': ay}})

# ---------------------------------------------------------------- ground
ground(0, 0, W, H, T(PK, 0))
ASPH, WALK, SOIL, DIRT, PAVE, GRASS = T(CV, 11), T(CV, 4), T(PK, 2), T(SC, 2), T(SC, 4), T(PK, 0)
kitpaste = []   # (x, y, lo_img, up_img)

def place_kit(kid, x, y, name=None):
    k = KITS[kid]; w, h = k['width'], k['height']; name = name or f'{kid}@{x},{y}'
    claim(x, y, w, h, name)
    for yy in range(y, y + h):
        for xx in range(x, x + w): solid[yy][xx] = True
    l, u = kit_images(kid); kitpaste.append((x, y, l, u))
    placements.append({'id': name, 'kit': kid, 'x': x, 'y': y, 'width': w, 'height': h})
    if k.get('entrance'):
        e, a = k['entrance'], k['approach']
        entrance(name, x + e['x'], y + e['y'], x + a['x'], y + a['y'])

def place_comp(cid, x, y, name=None, door=True):
    fn, c = COMP[cid]; w, h = c['canvas']['width'] // 32, c['canvas']['height'] // 32
    name = name or f'{cid}@{x},{y}'
    claim(x, y, w, h, name)
    for yy in range(y, y + h):
        for xx in range(x, x + w): solid[yy][xx] = True
    kitpaste.append((x, y, comp_image(cid), None))
    placements.append({'id': name, 'composite': cid, 'x': x, 'y': y, 'width': w, 'height': h})
    if door: entrance(name, x + w // 2, y + h - 1, x + w // 2, y + h)

# ---------------------------------------------------------------- variants: same kit/composite, other tiles from the SAME sheet
def _rt_rect(t): return {'x': t % 8 * 32, 'y': t // 8 * 32, 'width': 32, 'height': 32}
def comp_var_image(cid, wall=None, roof=None, awning=True, front='shop', window=True, fire=True):
    """composite with its wall / roof tiles remapped and optional parts dropped (paper doors replace the shop front)."""
    fn, c = COMP[cid]; s = img(fn)
    o = Image.new('RGBA', (c['canvas']['width'], c['canvas']['height']))
    for p in c['parts']:
        r, off, role = dict(p['sourceRect']), dict(p['offset']), p['role']
        t = r['y'] // 32 * 8 + r['x'] // 32
        if r['width'] == 32 and role.startswith('wood-wall') and wall: r = _rt_rect(wall.get(t, t))
        if r['width'] == 32 and role.startswith('roof') and roof: r = _rt_rect(roof.get(t, t))
        if role == 'native-striped-awning-section' and not awning: continue
        if role == 'whole-window-under-eave' and not window: continue
        if role == 'whole-fire-warning' and not fire: continue
        if role.startswith('complete-shop-front') and front == 'paper':
            r = {'x': 0, 'y': 1376, 'width': 64, 'height': 68}; off = {'x': 64, 'y': 188}   # cols 2-3: door col w//2 = 3
        o.alpha_composite(s.crop((r['x'], r['y'], r['x'] + r['width'], r['y'] + r['height'])), (off['x'], off['y']))
    return o

RT_WALL = {'grey': {232: 266, 233: 267, 234: 266, 240: 266, 241: 267, 242: 266},
           'plaster': {232: 250, 233: 251, 234: 252, 240: 250, 241: 251, 242: 252}}
RT_ROOF = {'dark': {274: 283, 282: 291, 302: 299}, 'light': {274: 286, 282: 294, 302: 302}, 'mid': {274: 281, 282: 289, 302: 292}}

def rtown(x, y, name, wall=None, roof=None, **kw):
    """retro-rtown-whole-building with a wall material / roof tone / front variant."""
    cid = 'retro-rtown-whole-building'
    place_comp(cid, x, y, name)
    kitpaste[-1] = (x, y, comp_var_image(cid, RT_WALL.get(wall), RT_ROOF.get(roof), **kw), None)
    placements[-1]['variant'] = {'wall': wall or 'wood', 'roof': roof or 'orig', **kw}

def kit_var_images(kid, remap=None, sub=None):
    """kit with tile ids remapped on its own sheet, and xp-autotile sources swapped for another roof sheet."""
    k = KITS[kid]; w, h = k['width'], k['height']; remap = remap or {}; sub = sub or {}
    l_, u_ = Image.new('RGBA', (w * 32, h * 32)), Image.new('RGBA', (w * 32, h * 32))
    for layer, im in (('lowerTiles', l_), ('upperTiles', u_)):
        for i, r in enumerate(k.get(layer) or []):
            if r is None or (isinstance(r, dict) and r.get('tile', -1) < 0) or r == -1: continue
            s = SRCS[r['source']]; fn = sub.get(r['source'], s['filename'])
            c = xp(fn, s['variantMasks'][r['tile']]) if s['format'] == 'xp-autotile' else tile(fn, remap.get(r['tile'], r['tile']))
            im.alpha_composite(c, (i % w * 32, i // w * 32))
    return l_, u_

APT = {'light': {284: 286, 292: 294, 300: 302, 308: 318}, 'wood': {57: 225, 65: 233},
       'light-glass': {284: 286, 292: 294, 300: 302, 308: 318, 245: 262, 253: 270}}
def kit_variant(kid, x, y, name, remap=None, sub=None, label=None):
    place_kit(kid, x, y, name)
    kitpaste[-1] = (x, y, *kit_var_images(kid, remap, sub))
    placements[-1]['variant'] = label

def shop(x, y, w, diner=False, name=None, style=None, roof=R1):
    h = 7; name = name or f'shop@{x}'
    claim(x, y, w, h, name)
    xpcells(rect(x, y, w, 3), roof)
    for dy in range(3, h):
        for dx in range(w): put(x + dx, y + dy, T(CV, 289), 'lo', True)
    door = w // 2 - 1
    if style:   # non-konbini: TN glass or shutter front, 2 rows at ground level, plain signboard band
        for dx in range(w): put(x + dx, y + 3, T(TN, 237 if dx == 0 else 239 if dx == w - 1 else 238))
        for dx in range(1, w - 1):
            for dy in range(2):
                a = (262, 270) if style == 'glass' else (257, 265)
                par = (dx - 1) % 2 if style == 'glass' else (dx - door - 1) % 2
                put(x + dx, y + 5 + dy, T(TN, a[dy] + par))
        for dy in range(2): up[y + 5 + dy][x + door] = [T(TN, (243 if style == 'glass' else 259) + dy * 8)]
        if style == 'glass': 
            for dy in range(2): up[y + 5 + dy][x + door + 1] = [T(TN, 244 + dy * 8)]
        placements.append({'id': name, 'kit': style + '-shop-front', 'x': x, 'y': y, 'width': w, 'height': h})
        entrance(name, x + door, y + h - 1, x + door, y + h)
        return
    for dx in range(1, w - 1):
        for dy in range(3): put(x + dx, y + 4 + dy, T(CV, (44 + dy) * 8 + dx % 2))
    for dy in range(3):
        for dx in range(2): up[y + 4 + dy][x + door + dx] = [T(CV, (47 + dy) * 8 + 4 + dx)]
    if not diner:
        for dx in range(w): put(x + dx, y + 3, T(CV, 344 + (2 if dx == 2 else 0)))
    else:
        for dy in range(2):
            for dx in range(w): put(x + dx, y + 3 + dy, T(TN, (30 + dy) * 8 + (0 if dx == 0 else 2 if dx == w - 1 else 1)))
    placements.append({'id': name, 'kit': 'diner-front' if diner else 'shop-front', 'x': x, 'y': y, 'width': w, 'height': h})
    entrance(name, x + door, y + h - 1, x + door, y + h)

def lane(x, y, w, h): ground(x, y, w, h, ASPH)

# arterials: horizontal y34-37, vertical x46-49; sidewalks y33/y38 and x45/x50
ground(0, 33, W, 1, WALK); ground(0, 38, W, 1, WALK)
ground(45, 0, 1, H, WALK); ground(50, 0, 1, H, WALK)
ground(0, 34, W, 4, ASPH); ground(46, 0, 4, H, ASPH)
lane(51, 16, 45, 2); lane(70, 0, 2, 33)          # NE
lane(0, 52, 45, 2); lane(22, 39, 2, 33)          # SW
lane(51, 54, 45, 2); lane(74, 39, 2, 33)         # SE

for xx in range(46, 50): put(xx, 32, T(CV, 6), 'up', False); put(xx, 39, T(CV, 6), 'up', False)
# centre lines (dashed white, keep-left 2-lane arterials); gap through the junction and the crossings
for xx in range(0, W, 2):
    if 44 <= xx <= 51: continue
    put(xx, 36, T(SC, 14), 'lo', None)
for yy in range(0, H, 2):
    if 31 <= yy <= 40 or 63 <= yy <= 68: continue
    put(48, yy, T(CV, 6), 'lo', None)
for yy in range(34, 38): put(44, yy, T(CV, 14), 'up', False); put(51, yy, T(CV, 14), 'up', False)

def signal(x, y, name):
    claim(x, y, 1, 4, name)
    stamp(x, y, CV, 0, 24, 1, 4, 'up', False); solid[y + 3][x] = True
    stamp(x + 1, y + 1, CV, 1, 25, 2, 1, 'up', False)

# ---------------------------------------------------------------- canal y64-67, walks y63 / y68
CANAL_Y = 64
bridges = [(22, 23), (45, 50), (74, 75)]
canal_all = [(x, y) for y in range(CANAL_Y, CANAL_Y + 4) for x in range(W)]   # one continuous channel: water runs under the bridges
canal = [(x, y) for (x, y) in canal_all if not any(a <= x <= b for a, b in bridges)]
for (x, y) in canal_all: lo[y][x] = [SOIL]
xpcells(canal_all, DITCH)
ground(0, 63, W, 1, WALK); ground(0, 68, W, 1, WALK)
for a, b in bridges:
    for x in range(a, b + 1): lo[63][x] = [WALK if x in (45, 50) else ASPH]; lo[68][x] = [WALK if x in (45, 50) else ASPH]
CH = 'by-source/sozai/chips/'
GR = CH + 'guardrail.png'
# water in the inner two rows of the ditch (SA-Pool01 translucent water autotile)
for c in canal_all:
    if c[1] in (65, 66): put(c[0], c[1], ('x', 'SA-Pool01.png', 255), 'lo', True)  # interior water piece only: no rounded pool corners
for a, b in bridges:   # deck drawn over the channel on the upper layer, walkable
    for y in range(CANAL_Y, CANAL_Y + 4):
        for x in range(a, b + 1): put(x, y, WALK if x in (45, 50) else ASPH, 'up', False)
# white guardrail along the canal lip (guardrail chip 32..35), segments between bridges
edges = sorted({x for (x, y) in canal if y == CANAL_Y})
segs, cur = [], []
for x in edges:
    if cur and x != cur[-1] + 1: segs.append(cur); cur = []
    cur.append(x)
segs.append(cur)
for seg in segs:
    for i, x in enumerate(seg):
        t = 32 if i == 0 else 35 if i == len(seg) - 1 else (33 if i % 2 else 34)
        put(x, CANAL_Y, T(GR, t), 'up', True)
        put(x, CANAL_Y + 3, T(GR, t), 'up', True)   # south lip rail too
# vertical guardrails on both sides of every bridge (guardrail chip col 6 / col 7, 4 tall)
for a, b in bridges:   # rails on the channel cells just outside the deck, so the deck stays full width
    for i, y in enumerate(range(CANAL_Y, CANAL_Y + 4)):
        put(a - 1, y, T(GR, 39 + 8 * i), 'up', True)
        put(b + 1, y, T(GR, 38 + 8 * i), 'up', True)

def chip(x, y, f, cols, t0, w, h, name=None, s=True, layer='up'):
    if name: claim(x, y, w, h, name)
    for dy in range(h):
        for dx in range(w):
            put(x + dx, y + dy, T(CH + f, t0 + dy * cols + dx), layer, s)


# ---------------------------------------------------------------- Japanese houses (author sample s15: gable wing + side wing)
_=None
def jgrid(L, wall='wood', roof='dark', side='right', front='wood'):
    """Japanese house after author sample s15: 5-wide gable wing + L-wide side wing. 10 rows.
    side='right': door at (2,8); side='left' puts the wing west of the gable, door at (L+2,8).
    front='plaster' gives the gable wing a plaster ground floor instead of the wood one."""
    R2, R3, R5 = (284, 292, 308) if roof == 'dark' else (286, 294, 318)
    W = 5 + L
    g = [[None] * W for _r in range(10)]
    gable = [[_,273,274,275,_],[273,281,282,283,275],[281,281,282,283,283],[281,281,282,283,283],
             [281,(57,297),(57,298),(57,299),283],[(57,297),(57,305),(57,304),(57,307),(57,299)],
             [216,(217,316),(217,316),(217,316),218],[224,349,350,351,226],[232,357,358,359,234],
             [204,237,238,239,206]]
    for y, r in enumerate(gable):
        for x, c in enumerate(r): g[y][x] = c
    if front == 'plaster':
        g[7][0], g[7][4] = 57, 58; g[8][0], g[8][4] = 65, 66
        for x in (1, 2, 3): g[7][x] = (57, g[7][x]); g[8][x] = (65, g[8][x])
    if L:
        if wall == 'wood': top, mid = (227, 225, 226), (235, 233, 234)
        else: top, mid = (57, 57, 58), (65, 65, 66)
        for i in range(L):
            x = 5 + i; k = 0 if i == 0 else (2 if i == L - 1 else 1)
            g[2][x] = R2; g[3][x] = R3; g[4][x] = R3
            g[5][x] = ((216, 217, 218)[k], R5)
            g[6][x] = top[k]; g[7][x] = mid[k]
        if L >= 5:            # shoji window + engawa step
            for j, (a, b) in enumerate(((344, 352), (345, 353), (346, 354))):
                g[6][6 + j] = a; g[7][6 + j] = b
            g[8][7] = 360; g[8][8] = 360
            g[6][5] = (g[6][5], 330); g[7][5] = (g[7][5], 338)
        if L >= 3: g[6][W - 2] = (g[6][W - 2], 340)
    if side == 'left' and L:
        g = [r[5:] + r[:5] for r in g]
    return g
def house(x, y, L, name, wall='wood', roof='dark', stones=True, side='right', front='wood'):
    """(5+L)x10 house: 5-wide kawara gable wing with the genkan, L-wide side wing (east or west of the gable).
    stones=False drops the step-stone row so the genkan opens straight onto the sidewalk below (9 rows)."""
    g = jgrid(L, wall, roof, side, front); w = len(g[0])
    dx0 = L if side == 'left' else 0
    if not stones: g = g[:9]
    claim(x, y, w, len(g), name)
    for dy, r in enumerate(g):
        for dx, c in enumerate(r):
            for t in (c if isinstance(c, tuple) else (c,)):
                if t is not None: put(x + dx, y + dy, T(TN, t), 'up', not (dy == 9 and dx0 + 1 <= dx <= dx0 + 3))
    placements.append({'id': name, 'kind': f'house-j{L}-{wall}-{roof}-{side}-{front}', 'x': x, 'y': y, 'width': w, 'height': len(g)})
    entrance(name, x + dx0 + 2, y + 8, x + dx0 + 2, y + 9)

# ================================================================= SCHOOL (NW) campus x2..44, y0..32
ground(2, 0, 43, 33, PAVE)
for yy in range(0, 31):   # hedge columns on the west and east campus edges
    put(1, yy, T(TN, 167 if yy % 2 else 159), 'up', True)
    put(44, yy, T(TN, 167), 'up', True)
claim(1, 0, 1, 31, 'hedge-w'); claim(44, 0, 1, 31, 'hedge-e')

def school_main(x, y, w):
    roof_h, floors = 5, 3
    h = roof_h + 1 + floors * 3
    claim(x, y, w, h, 'school-main')
    xpcells(rect(x, y, w, roof_h), R1)
    ry = y + roof_h
    for dx in range(w): put(x + dx, ry, T(SC, 241), 'lo', True)
    put(x + w // 2, ry, T(SC, 195))
    door = x + w // 2 - 1
    for f in range(floors):
        fy = ry + 1 + f * 3; last = f == floors - 1
        for dx in range(w):
            put(x + dx, fy, T(SC, 241), 'lo', True); put(x + dx, fy + 1, T(SC, 241), 'lo', True)
            if last: put(x + dx, fy + 2, T(SC, 249), 'lo', True)
            else: put(x + dx, fy + 2, T(SC, 256 if dx == 0 else 258 if dx == w - 1 else 257), 'lo', True)
            inner = 1 <= dx <= w - 2 and dx % 8 != 0
            if inner and not (last and door - 1 <= x + dx <= door + 2):
                put(x + dx, fy, T(SC, 266 + (dx % 2 == 0))); put(x + dx, fy + 1, T(SC, 274 + (dx % 2 == 0)))
        if last:
            put(door, fy + 1, T(SC, 280)); put(door + 1, fy + 1, T(SC, 281))
            put(door, fy + 2, T(SC, 288)); put(door + 1, fy + 2, T(SC, 289))
            entrance('school-main', door, fy + 2, door, fy + 3)
    placements.append({'id': 'school-main', 'x': x, 'y': y, 'width': w, 'height': h})

MX, MY, MW = 3, 1, 24
school_main(MX, MY, MW)   # x3..28, y1..15 (3 floors); door x15-16
# 校庭の桜: cherry trees in the pocket east of the main building
# east of the main building: one big cherry by the gym path + a low hedge row along the building's east wall
chip(28, 1, 'sakura2.png', 6, 0, 6, 6, 'school-sakura-1')
for hy in range(8, 16):
    put(27, hy, T(TN, 167 if hy % 2 else 159), 'up', True)
claim(27, 8, 1, 8, 'school-hedge-e')
chip(30, 8, 'icho2.png', 4, 0, 4, 6, 'school-icho')   # ginkgo, the classic 校庭の木

GX, GYy, GW = 36, 2, 8
claim(GX, GYy, GW, 11, 'school-gym')
nine(GX, GYy, GW, 6, SC, 0, 39, cols=(0, 1, 1, 2), rows=(0, 1, 3))
for dy in range(6, 11):
    for dx in range(GW): put(GX + dx, GYy + dy, T(SC, 249 if dy == 10 else 241), 'lo', True)
for dx in range(1, GW - 1): put(GX + dx, GYy + 7, T(SC, 266 + (dx % 2 == 0)))
put(GX + 3, GYy + 9, T(SC, 280)); put(GX + 4, GYy + 9, T(SC, 281))
put(GX + 3, GYy + 10, T(SC, 288)); put(GX + 4, GYy + 10, T(SC, 289))
entrance('school-gym', GX + 3, GYy + 10, GX + 3, GYy + 11)
placements.append({'id': 'school-gym', 'x': GX, 'y': GYy, 'width': GW, 'height': 11})

PX, PY = 36, 14
claim(PX, PY, 8, 7, 'school-pool')
nine(PX + 1, PY + 1, 6, 4, SC, 5, 42, cols=(0, 1, 1, 2))
for dx in range(8):
    if dx in (3, 4): continue
    stamp(PX + dx, PY + 5, SC, 5 + (0 if dx == 0 else 2 if dx == 7 else 1), 55, 1, 2, 'up', True)

# yard y17..28 (dirt, 32x12: larger than the 26x15 main building), paved strip y29-30 with bikes, hedge y31-32 with the gate
YX0, YY0, YX1, YY1 = 3, 17, 34, 28
ground(YX0, YY0, YX1 - YX0 + 1, YY1 - YY0 + 1, DIRT)
for ly in (19, 26):   # running track: one closed loop of white line tiles (corners included)
    for xx in range(YX0 + 4, YX1 - 3): put(xx, ly, T(SC, 14), 'up', False)
for xx in (YX0 + 4, YX1 - 4):
    for yy in range(19, 27): put(xx, yy, T(SC, 6), 'up', False)
stamp(YX0, YY0 + 3, SC, 5, 49, 2, 4, 'up', True, 'backstop')
stamp(31, 27, SC, 3, 55, 2, 2, 'up', True, 'tires')
stamp(31, 17, SC, 0, 53, 4, 2, 'up', True, 'iron-bars')
stamp(35, 22, SC, 4, 24, 4, 6, 'up', True, 'school-tree-a')
stamp(40, 22, SC, 4, 24, 4, 6, 'up', True, 'school-tree-b')
# bicycle racks: front-facing bikes (bicycle01 col 0, 1x2), colours cycle red/blue/green
for bx in list(range(22, 28)) + list(range(36, 42)):
    c = (0, 10, 20)[(bx * 7) % 3]
    chip(bx, 29, 'bicycle01.png', 5, c, 1, 2, f'bike{bx}')
for px in (5, 9, 13, 29):
    stamp(px, 29, SC, 2, 28, 2, 2, 'up', True, f'pots{px}')

def hedge_h(x, y, w, name):
    claim(x, y, w, 2, name)
    for dx in range(w):
        c = 0 if dx == 0 else 2 if dx == w - 1 else 1
        stamp(x + dx, y, SC, c, 16, 1, 2, 'up', True)
gate_x = 17
hedge_h(2, 31, gate_x - 2, 'hedge-s1')
hedge_h(gate_x + 4, 31, 44 - gate_x - 3, 'hedge-s2')
stamp(gate_x, 31, SC, 0, 48, 1, 2, 'up', True, 'gate-l')
stamp(gate_x + 3, 31, SC, 2, 48, 1, 2, 'up', True, 'gate-r')
signal(45, 30, 'signal-nw')
stamp(16, 29, SC, 3, 25, 1, 2, 'up', True, 'school-stele')      # stone stele SC 203/211
for fx in (3, 4, 7, 8, 11, 12, 15):
    put(fx, 30, T(SC, (149, 150, 157, 156)[fx % 4]), 'up', False)

# west margin x0: trees
for ty in range(0, 31):   # west margin: continuous hedge, matching the x1 column
    put(0, ty, T(TN, 167 if ty % 2 else 159), 'up', True)

# ================================================================= NE x51..95, y0..32
# shotengai: shops y26..32 facing the y33 sidewalk; plaza x51-53 with a signal
ground(51, 25, 3, 8, WALK)
signal(50, 30, 'signal-ne')
# plaza: lamp + postbox at the north end, bus shelter bench beside the stop pole at the kerb end; middle kept open
chip(51, 25, 'streetlamp.png', 3, 2, 1, 4, 'lamp-plaza')
chip(53, 25, 'post.png', 2, 0, 1, 2, 'post-plaza')
chip(51, 30, 'streetlamp.png', 3, 0, 2, 2, 'bench-plaza')   # bench waiting for the bus
chip(53, 30, 'busstop.png', 4, 2, 1, 3, 'busstop-plaza')   # pole foot y32 = plaza kerb line; y33 walk kept clear for pedestrians
place_comp('retro-rtown-whole-building', 54, 25, 'rtown-shop-1')
shop(60, 26, 5, name='shop-2', style='shutter', roof=R2)
shop(65, 26, 5, diner=True, name='diner-3')
shop(72, 26, 5, name='shop-4', style='glass', roof=R4)
rtown(77, 25, 'rtown-shop-5', wall='grey', roof='dark', fire=False)
shop(83, 26, 6, name='shop-6', style='glass', roof=R3)
shop(89, 26, 7, name='shop-7', style='shutter', roof=R4)
# park y18..24 between the back lane and the shop roofs
ground(51, 18, 19, 7, GRASS); ground(72, 18, 24, 7, GRASS)
ground(52, 21, 17, 1, SOIL); ground(73, 21, 22, 1, SOIL)
# NE park (児童公園 west of the x70 lane, 緑地 east of it). Path y21 clear.
# west: play equipment in one row north of the path, two benches facing it from the south, gomi station at the lane corner
place_kit('park-swings', 53, 18); place_kit('park-slide', 57, 18); place_kit('park-sandpit', 63, 18)
place_kit('park-bench-back', 55, 22); place_kit('park-bench-back', 60, 22)
chip(67, 22, 'gomi.png', 2, 0, 2, 3, 'gomi-ne')   # ゴミ集積所 on the lane edge at x68-69 facing the x70 lane
# east green: a row of trees north of the path at even spacing, benches under them facing the path
for i, tx in enumerate((73, 79, 85, 91)):
    if i % 2 == 0: chip(tx, 18, 'ume.png', 6, 0, 3, 3, f'ume-ne-{i}')
    else: stamp(tx, 18, TN, 5, 16, 2, 3, 'up', True, f'parktree{tx}')
for bx in (76, 82, 88): place_kit('park-bench-back', bx, 22)
# north of the back lane: apartment + clinic west, mansion + houses east
# hillside inari shrine (稲荷神社) against the back-hill grove, approach down to the y16 lane
chip(51, 4, 'oinarisama.png', 10, 0, 10, 10, 'shrine-ne')
placements.append({'id': 'shrine-ne', 'kit': 'chip:oinarisama', 'x': 51, 'y': 4, 'width': 10, 'height': 10})
ground(56, 14, 3, 2, T(TN, 22))   # 参道: gravel approach under the chip's stone steps (chip cols 5-7) down to the lane
for tx in (61, 63, 65, 67):   # 鎮守の森: dense grove east of the shrine
    stamp(tx, 4, TN, 5, 16, 2, 3, 'up', True, f'grove{tx},4')
entrance('shrine-ne', 57, 13, 57, 14)
place_kit('clinic-small', 61, 7, 'clinic-ne')
# clinic front car park (2 bays) onto the y16 lane
ground(61, 14, 9, 2, ASPH)
for sx in (62, 67): put(sx, 14, T(CV, 6), 'up', False)
place_comp('msex-b-whole-house', 72, 5, 'mansion-ne')
house(81, 4, 7, 'house-ne-1')
# back-hill grove behind the NE lots: maples + dense trees + a garbage station, all existing chips
chip(51, 0, 'momiji.png', 4, 0, 4, 4, 'momiji-ne-1')
chip(59, 0, 'momiji.png', 4, 0, 4, 4, 'momiji-ne-2')
for tx in (55, 57, 63, 65):
    stamp(tx, 0, TN, 5, 16, 2, 3, 'up', True, f'tree{tx},0')
stamp(68, 0, TN, 5, 16, 2, 3, 'up', True, 'tree68,0')   # ゴミ集積所 at the lane corner (x70 lane meets y16 lane), not in the woods
# back-hill canopy east: mixed evergreen + chestnut + maple, not one clone repeated
for tx in range(72, 95, 2):
    if 76 <= tx <= 81 or 86 <= tx <= 91: continue
    stamp(tx, 0, TN, 5, 16, 2, 3, 'up', True, f'tree{tx},0')
chip(77, 0, 'momiji.png', 4, 0, 4, 4, 'momiji-hill-1')
chip(87, 0, 'momiji.png', 4, 0, 4, 4, 'momiji-hill-2')

# ================================================================= SW x0..44, y39..63
signal(44, 39, 'signal-sw'); ground(43, 39, 2, 4, WALK)
# houses one row up (y40..49) so the front block wall lands on y51, not on the y52 lane
house(1, 40, 0, 'house-sw-1', roof='light', front='plaster')
rtown(8, 43, 'rtown-sw-2', wall='plaster', roof='light', front='paper', awning=False)   # old machiya: paper doors, no awning
house(15, 40, 2, 'house-sw-3', 'plaster', 'dark', side='left')   # L=2: x15..21, clear of the x22 lane
place_comp('retro-sento-whole-building', 25, 40, 'sento')
house(33, 40, 0, 'house-sw-4')
rtown(37 + 2, 43, 'rtown-sw-5', wall='grey', roof='mid', front='paper', awning=False, window=False)
kit_variant('apartment-dark-roof', 1, 54, 'apartment-sw', APT['light'], label='light-roof')
house(12, 54, 5, 'house-sw-6', 'wood', 'light', stones=False, side='left', front='plaster')   # y54..62 between the lane and the y63 sidewalk
kit_variant('apartment-dark-roof', 25, 54, 'apartment-sw-2', APT['wood'], label='wood-wall')
house(36, 54, 3, 'house-sw-7', 'plaster', 'light', stones=False)



# ================================================================= SE x51..95, y39..63
signal(51, 39, 'signal-se'); ground(51, 39, 3, 7, WALK)
# konbini: storefront faces south onto its own car park, which opens west onto the x50 sidewalk of the N-S arterial (ロードサイド型)
shop(54, 39, 10, name='konbini')
stamp(64, 43, CV, 0, 29, 2, 3, 'up', True, 'vending')
stamp(66, 40, CV, 5, 44, 3, 3, 'up', True, 'pole-sign')       # sign box spans 3 cols; pole is only col 6
stamp(67, 43, CV, 6, 47, 1, 3, 'up', True, 'pole-sign-post')
ground(51, 46, 16, 8, ASPH)
for sx in (52, 56, 60, 64):
    for yy in range(48, 51): put(sx, yy, T(CV, 6), 'up', False)
# parked cars (car.png: front view cols 0-2, rear view cols 3-5, 3x4); bay in front of the door (x57-59) left empty
chip(53, 48, 'car.png', 11, 3, 3, 4, 'car-1')
chip(61, 48, 'patcar.png', 11, 3, 3, 4, 'car-2')   # both nose-in toward the store (rear view), same orientation
rtown(67, 46, 'rtown-se', wall='plaster', roof='dark', awning=False)
kit_variant('clinic-small', 77, 45, 'clinic-se', sub={'xp-roof01': R3}, label='roof03')
ground(77, 52, 9, 2, ASPH)   # clinic front car park onto the y54 lane
for sx in (78, 84): put(sx, 52, T(CV, 6), 'up', False)
kit_variant('apartment-dark-roof', 86, 45, 'apartment-se', APT['light-glass'], label='light-roof-glass')
# vegetable field behind the konbini (SA-Hatake01 soil + vege chips + scarecrow)
field = [(x, y) for y in range(39, 44) for x in range(76, 84)]   # east of the x74 lane, never over its asphalt
claim(76, 39, 8, 5, 'field-se')
xpcells(field, 'SA-Hatake01.png', 'lo', True)
for i, x in enumerate(range(77, 83)):
    put(x, 40, T(CH + 'vege.png', (4, 5, 8, 9)[i % 4]), 'up', False)
    put(x, 42, T(CH + 'vege.png', (16, 17, 18, 19)[i % 4]), 'up', False)
put(80, 40, T(CH + 'vege.png', 2), 'up', False); put(80, 41, T(CH + 'vege.png', 6), 'up', False)
# jizo at the corner where the x74 lane leaves the arterial; big sakura inside the lot line, off the sidewalk
chip(71, 40, 'jizo.png', 3, 0, 3, 4, 'jizo-se')
chip(87, 39, 'sakura2.png', 6, 0, 6, 6, 'sakura-se')   # lone roadside cherry with 3 tiles of grass to the field
# riverside park y56..62
ground(51, 56, 23, 7, GRASS); ground(76, 56, 20, 7, GRASS)
ground(51, 62, 23, 1, SOIL)
# riverside park west of the bridge: a cherry-lined promenade (桜並木) — 3 cherries at even spacing,
# benches between them facing the canal (back view), path on y62 along the canal walk
for i, sx in enumerate((51, 59, 67)):
    chip(sx, 56, 'sakura2.png', 6, 0, 6, 6, f'sakura-river-{i}')
for bx in (57, 65): place_kit('park-bench-back', bx, 60)
# temple graveyard (寺の墓地) east of the bridge: gravel yard, grave blocks, bell; graves belong to a temple, never the shrine
ground(76, 56, 20, 7, T(TN, 22))
for gx in (78, 83): chip(gx, 56, 'ohaka.png', 4, 0, 4, 6, f'graves-{gx}')   # two grave blocks with a 1-tile aisle
# no temple hall fits beside it: a walled community cemetery (共同墓地), no bell
for wy in range(56, 63): put(76, wy, T(TN, 24 if wy < 62 else 40), 'up', True)
put(76, 56, T(TN, 16), 'up', True)
for tx in (90, 92, 94): stamp(tx, 56, TN, 5, 16, 2, 3, 'up', True, f'tgrove{tx}')   # evergreen screen behind the graves
for tx in (90, 92, 94): stamp(tx, 59, TN, 5, 16, 2, 3, 'up', True, f'tgrove{tx}b')


# ================================================================= block-wall lots (gravel yard + wall ring)
GRAVEL = T(TN, 22)
APPR = {(e['approach']['x'], e['approach']['y']) for e in entrances}
def lot(name, pl=1, pt=1, pr=1, pb=1):
    p = next(p for p in placements if p['id'] == name)
    e = next(e for e in entrances if e['building'] == name)
    x0, y0 = p['x'] - pl, p['y'] - pt
    x1, y1 = p['x'] + p['width'] - 1 + pr, p['y'] + p['height'] - 1 + pb
    gx = e['approach']['x']
    def free(x, y): return 0 <= x < W and 0 <= y < H and owner[y][x] is None and lo[y][x] == [GRASS] and (x, y) not in APPR
    ax, ay = e['approach']['x'], e['approach']['y']
    for yy in range(y0, y1 + 1):
        for xx in range(x0, x1 + 1):
            if free(xx, yy):
                if xx == ax and yy >= ay: lo[yy][xx] = [GRAVEL]   # stone path door -> gate only; rest stays garden
                owner[yy][xx] = name + '-yard'
    wx0, wy0, wx1, wy1 = x0 - 1, y0 - 1, x1 + 1, y1 + 1
    gate = {gx, gx + 1} if free(gx + 1, wy1) or gx + 1 <= x1 else {gx}
    pids = {q['id'] for q in placements} - {name}
    def cut(cells): return any(0 <= x < W and 0 <= y < H and owner[y][x] in pids for x, y in cells)
    drop = {s for s, cells in (('L', [(wx0, y) for y in range(wy0 + 1, wy1)]), ('R', [(wx1, y) for y in range(wy0 + 1, wy1)]),
                               ('T', [(x, wy0) for x in range(wx0 + 1, wx1)])) if cut(cells)}   # corners excluded: a building on a corner only clips it   # another building cuts this side: it is the boundary
    for yy in range(wy0, wy1 + 1):
        for xx in range(wx0, wx1 + 1):
            if not (yy in (wy0, wy1) or xx in (wx0, wx1)): continue
            side = yy not in (wy0, wy1)
            if side and (('L' in drop and xx == wx0) or ('R' in drop and xx == wx1)): continue
            if 'T' in drop and yy == wy0: continue
            if yy == wy1 and xx in gate: lo[yy][xx] = [GRAVEL] if free(xx, yy) else lo[yy][xx]; continue
            if not free(xx, yy): continue
            # only a PARALLEL neighbour wall makes a double wall; a collinear one is the same wall continuing
            nb = [owner[yy][xx + d] for d in (-1, 1) if 0 <= xx + d < W] if side else [owner[yy + d][xx] for d in (-1, 1) if 0 <= yy + d < H]
            if any(o and o.endswith('-wall') and not o.startswith(name) for o in nb): continue   # share the neighbour's wall
            if yy == wy1:
                t = 40 if xx == wx0 and 'L' not in drop else 42 if xx == wx1 and 'R' not in drop else 43 if xx + 1 == min(gate) else 44 if xx - 1 == max(gate) else (50 if (xx // 3) % 3 == 1 else 41)
            elif yy == wy0:
                t = 16 if xx == wx0 and 'L' not in drop else 18 if xx == wx1 and 'R' not in drop else 17
            else:
                t = 24 if xx == wx0 else 26
            put(xx, yy, T(TN, t), 'up', True); owner[yy][xx] = name + '-wall'
    if free(gx - 1, wy1 + 0) is False and (gx - 1, wy1) not in APPR: pass
    put_mail = (gx + 2, wy1) if gx + 2 < wx1 else None
    if put_mail and any(r == T(TN, 44) for r in up[wy1][gx + 2]): up[wy1][gx + 2] = [T(TN, 54)]

lot('rtown-sw-2', pt=3); lot('rtown-sw-5', pt=3)   # shops sit 3 rows below the houses' top: align their back wall with the houses'
for n in ('house-sw-1', 'house-sw-3', 'house-sw-4', 'house-sw-6', 'house-sw-7',
          'apartment-sw', 'apartment-sw-2', 'house-ne-1', 'mansion-ne',
          'rtown-se', 'clinic-se', 'apartment-se'):
    lot(n)

# SW house row: one continuous rear block wall along y39 (the arterial sidewalk side), posts at run ends
def rear_wall(y, x0, x1, name):
    for x in range(x0, x1 + 1):
        if owner[y][x] and owner[y][x].endswith('-wall'): continue
        if not (owner[y][x] is None or owner[y][x].endswith('-yard')) or up[y][x]: continue
        t = 16 if x == x0 else 18 if x == x1 else 17
        put(x, y, T(TN, t), 'up', True); owner[y][x] = name + '-wall'
rear_wall(39, 0, 21, 'sw-rear-a'); rear_wall(39, 24, 42, 'sw-rear-b')

# lived-in yards (few, deliberate): laundry pole in a back garden, a bicycle by a side door, a pot by the genkan
def yard_prop(x, y, t, name, solid_=True, f=TN):
    if not (owner[y][x] and owner[y][x].endswith('-yard')) or up[y][x] or (x, y) in APPR: return False
    put(x, y, T(f, t), 'up', solid_); owner[y][x] = name; return True
yard_prop(88, 3, 155, 'laundry-ne-a'); yard_prop(89, 3, 156, 'laundry-ne-b')
if all(owner[y][44] and owner[y][44].endswith('-yard') and not up[y][44] for y in (55, 56)):
    put(44, 55, T(CH + 'bicycle01.png', 0), 'up', True); put(44, 56, T(CH + 'bicycle01.png', 5), 'up', True)
    owner[55][44] = owner[56][44] = 'bike-sw-7'
yard_prop(35, 60, 204, 'pot-sw-7'); yard_prop(11, 60, 204, 'pot-sw-6'); yard_prop(0, 48, 204, 'pot-sw-1')

# a back-wall run with no corner post that stops mid-garden is a floating plank: pull it
TOPW = {T(TN, t) for t in (16, 17, 18)}
def topw(x, y): return 0 <= x < W and 0 <= y < H and owner[y][x] and owner[y][x].endswith('-wall') and any(r in TOPW for r in up[y][x])
def open_grass(x, y): return 0 <= x < W and 0 <= y < H and (owner[y][x] is None or owner[y][x].endswith('-yard')) and lo[y][x] == [GRASS]
for y in range(H):
    x = 0
    while x < W:
        if not topw(x, y): x += 1; continue
        x1 = x
        while topw(x1 + 1, y): x1 += 1
        run = range(x, x1 + 1)
        posts = any(T(TN, t) in up[y][xx] for xx in run for t in (16, 18))
        if not posts and (open_grass(x - 1, y) or open_grass(x1 + 1, y)):
            for xx in run:
                up[y][xx] = [r for r in up[y][xx] if r not in TOPW]; solid[y][xx] = False; owner[y][xx] = None
        x = x1 + 1
# the same for a lone side-wall column whose top and bottom both touch no wall
SIDEW = {T(TN, t) for t in (24, 26)}
def anyw(x, y): return 0 <= x < W and 0 <= y < H and owner[y][x] and owner[y][x].endswith('-wall')
for x in range(W):
    y = 0
    while y < H:
        if not (anyw(x, y) and any(r in SIDEW for r in up[y][x])): y += 1; continue
        y1 = y
        while anyw(x, y1 + 1) and any(r in SIDEW for r in up[y1 + 1][x]): y1 += 1
        if not anyw(x, y - 1) and not anyw(x, y1 + 1):
            for yy in range(y, y1 + 1):
                up[yy][x] = [r for r in up[yy][x] if r not in SIDEW]; solid[yy][x] = False; owner[yy][x] = None
        y = y1 + 1

# ================================================================= south of canal y69..71: tree row
# farmland edge past the canal (田園): field plots of two kinds between bridges, tree clumps, not one clone row
def bank_field(x0, x1, f):
    cells = [(x, y) for y in range(69, 72) for x in range(x0, x1 + 1)]
    claim(x0, 69, x1 - x0 + 1, 3, f'bankfield{x0}')
    xpcells(cells, f, 'lo', True)
    if f == 'SA-Hatake01.png':   # crop rows on the upper and lower furrow, like the SE field
        for i, x in enumerate(range(x0 + 1, x1)):
            put(x, 70, T(CH + 'vege.png', (4, 5, 8, 9)[i % 4]), 'up', False)   # one crop row down the middle furrow
bank_field(0, 7, 'SA-Hatake01.png')
for tx in (9, 11): stamp(tx, 69, TN, 5, 16, 2, 3, 'up', True, f'bank{tx}')
bank_field(14, 20, 'SA-Hatake03.png')
bank_field(25, 34, 'SA-Hatake01.png')
chip(36, 69, 'ume.png', 6, 18, 3, 3, 'bank-ume')
bank_field(40, 43, 'SA-Hatake03.png')
for tx in (52, 54, 58): stamp(tx, 69, TN, 5, 16, 2, 3, 'up', True, f'bank{tx}')
bank_field(61, 72, 'SA-Hatake01.png')
bank_field(77, 85, 'SA-Hatake03.png')
for tx in (88, 90, 93): stamp(tx, 69, TN, 5, 16, 2, 3, 'up', True, f'bank{tx}')

# ---------------------------------------------------------------- vending machines (自販機) on private frontage facing a walk, 2x3 CV stamp
def vend_ok(x, y):
    cells = [(x + dx, y + dy) for dy in range(3) for dx in range(2)]
    if not all(0 <= a < W and 0 <= b < H and owner[b][a] in (None,) + tuple(o for o in [owner[b][a]] if o and o.endswith('-yard')) and not up[b][a] for a, b in cells): return False
    below = [(x, y + 3), (x + 1, y + 3)]
    return all(0 <= b < H and not solid[b][a] for a, b in below)
vends = 0
for (vx, vy) in ():   # vending machines only on private frontage: none in the park
    if vend_ok(vx, vy):
        for dy in range(3):
            for dx in range(2): owner[vy + dy][vx + dx] = f'vend@{vx},{vy}'
        stamp(vx, vy, CV, 0, 29, 2, 3, 'up', True); vends += 1
    else: print('vend skipped', vx, vy)
print('vends', vends)

# shotengai sidewalk: 1-tile potted plants (TN 204) at shop boundaries; the walk is 1 tile, so nothing taller
for px in (60, 67, 71, 80, 86, 91):
    if (px, 33) in APPR or (px, 32) in {(e['x'], e['y']) for e in entrances} or up[33][px] or owner[33][px]: continue
    put(px, 33, T(TN, 204), 'up', False); owner[33][px] = f'pot@{px}'   # low planter: walkable edge, never blocks the 1-tile walk

# ---------------------------------------------------------------- utility poles (電柱): TN 85/93/101, base on the sidewalk, ~10-14 tiles apart, irregular
APPR = {(e['approach']['x'], e['approach']['y']) for e in entrances}
pole_at = []
def pole(x, y):
    if not (0 <= x < W and 2 <= y < H): return False
    if lo[y][x] != [WALK]: return False                               # base only on a sidewalk, never in a traffic lane
    if owner[y][x] is not None or (x, y) in APPR or any(up[y + d][x] for d in (0, -1, -2)): return False   # top rows must not draw over anything
    if any(abs(px - x) + abs(py - y) < 4 for px, py in pole_at): return False   # no twin poles
    if any((x, y + d) in APPR for d in (1, -1)) or any((x + d, y) in APPR for d in (1, -1)): return False
    for dy, t in ((-2, 85), (-1, 93), (0, 101)): put(x, y + dy, T(TN, t), 'up', dy == 0)
    owner[y][x] = f'pole@{x},{y}'; pole_at.append((x, y))
    return True
poles = 0
for y, xs in ((38, range(3, 95, 12)), (63, range(6, 95, 13)), (33, range(9, 95, 14))):
    for x0 in xs:
        for dx in (0, 1, -1, 2, -2, 3, -3):
            if pole(x0 + dx, y): poles += 1; break
for x, ys in ((45, range(6, 70, 13)), (50, range(12, 70, 13))):
    for y0 in ys:
        for dy in (0, 1, -1, 2, -2, 3):
            if pole(x, y0 + dy): poles += 1; break
print('poles', poles)

# ---------------------------------------------------------------- checks
def passable(x, y): return 0 <= x < W and 0 <= y < H and not solid[y][x]
seen = {(47, 35)}; q = deque([(47, 35)])
while q:
    x, y = q.popleft()
    for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
        if passable(nx, ny) and (nx, ny) not in seen: seen.add((nx, ny)); q.append((nx, ny))
bad = [e['building'] for e in entrances if (e['approach']['x'], e['approach']['y']) not in seen]
print('entrances', len(entrances), 'unreachable', bad)

# ---------------------------------------------------------------- render
from PIL import Image
out = Image.new('RGBA', (W * 32, H * 32))
def ref_img(r):
    if r[0] == 't': return tile(r[1], r[2])
    return xp(r[1], r[2])
for y in range(H):
    for x in range(W):
        for r in lo[y][x]: out.alpha_composite(ref_img(r), (x * 32, y * 32))
for (x, y, l, u) in kitpaste: out.alpha_composite(l, (x * 32, y * 32))
for y in range(H):
    for x in range(W):
        for r in up[y][x]: out.alpha_composite(ref_img(r), (x * 32, y * 32))
for (x, y, l, u) in kitpaste:
    if u: out.alpha_composite(u, (x * 32, y * 32))
import os; os.makedirs('/home/main/claude-viz/paw-town', exist_ok=True)
out.save('/home/main/claude-viz/paw-town/town.png')
json.dump({'width': W, 'height': H, 'placements': placements, 'entrances': entrances}, open(TD + '/town.json', 'w'), ensure_ascii=False)
print('ok', len(placements))
