import sys, json
sys.path.insert(0, '/tmp/town')
from lib import *
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

def shop(x, y, w, diner=False, name=None):
    h = 7; name = name or f'shop@{x}'
    claim(x, y, w, h, name)
    xpcells(rect(x, y, w, 3), R1)
    for dy in range(3, h):
        for dx in range(w): put(x + dx, y + dy, T(CV, 289), 'lo', True)
    for dx in range(1, w - 1):
        for dy in range(3): put(x + dx, y + 4 + dy, T(CV, (44 + dy) * 8 + dx % 2))
    door = w // 2 - 1
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
for yy in range(34, 38): put(44, yy, T(CV, 14), 'up', False); put(51, yy, T(CV, 14), 'up', False)

def signal(x, y, name):
    claim(x, y, 1, 4, name)
    stamp(x, y, CV, 0, 24, 1, 4, 'up', False); solid[y + 3][x] = True
    stamp(x + 1, y + 1, CV, 1, 25, 2, 1, 'up', False)

# ---------------------------------------------------------------- canal y64-67, walks y63 / y68
CANAL_Y = 64
bridges = [(22, 23), (45, 50), (74, 75)]
canal = [(x, y) for y in range(CANAL_Y, CANAL_Y + 4) for x in range(W) if not any(a <= x <= b for a, b in bridges)]
for (x, y) in canal: lo[y][x] = [SOIL]
xpcells(canal, DITCH)
ground(0, 63, W, 1, WALK); ground(0, 68, W, 1, WALK)
for a, b in bridges:
    for y in range(63, 69):
        for x in range(a, b + 1): lo[y][x] = [WALK if x in (45, 50) else ASPH]
CH = 'by-source/sozai/chips/'
GR = CH + 'guardrail.png'
# water in the inner two rows of the ditch (SA-Pool01 translucent water autotile)
xpcells([c for c in canal if c[1] in (65, 66)], 'SA-Pool01.png', 'lo')
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
# vertical guardrails on both sides of every bridge (guardrail chip col 6 / col 7, 4 tall)
for a, b in bridges:
    for i, y in enumerate(range(CANAL_Y, CANAL_Y + 4)):
        put(a, y, T(GR, 38 + 8 * i), 'up', False)
        put(b, y, T(GR, 39 + 8 * i), 'up', False)

def chip(x, y, f, cols, t0, w, h, name=None, s=True, layer='up'):
    if name: claim(x, y, w, h, name)
    for dy in range(h):
        for dx in range(w):
            put(x + dx, y + dy, T(CH + f, t0 + dy * cols + dx), layer, s)

# ================================================================= SCHOOL (NW) campus x2..44, y0..32
ground(2, 0, 43, 33, PAVE)
for yy in range(0, 31):   # hedge columns on the west and east campus edges
    put(1, yy, T(TN, 167 if yy % 2 else 159), 'up', True)
    put(44, yy, T(TN, 167), 'up', True)
claim(1, 0, 1, 31, 'hedge-w'); claim(44, 0, 1, 31, 'hedge-e')

def school_main(x, y, w):
    roof_h, floors = 5, 4
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

MX, MY, MW = 3, 1, 32
school_main(MX, MY, MW)   # x3..34, y1..18; door x18-19

GX, GYy, GW = 36, 2, 8
claim(GX, GYy, GW, 11, 'school-gym')
nine(GX, GYy, GW, 6, SC, 0, 39)
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

# yard y21..28 (dirt), paved strip y29-30 with bikes, hedge y31-32 with the gate
YX0, YY0, YX1, YY1 = 3, 21, 34, 28
ground(YX0, YY0, YX1 - YX0 + 1, YY1 - YY0 + 1, DIRT)
for ly in (23, 25, 27):
    for xx in range(YX0 + 4, YX1 - 3): put(xx, ly, T(SC, 14), 'up', False)
for xx in (YX0 + 4, YX1 - 4):
    for yy in range(22, 28): put(xx, yy, T(SC, 6), 'up', False)
stamp(YX0, YY0, SC, 5, 49, 2, 4, 'up', True, 'backstop')
stamp(31, 27, SC, 3, 55, 2, 2, 'up', True, 'tires')
stamp(31, 21, SC, 0, 53, 4, 2, 'up', True, 'iron-bars')
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
for ty in range(0, 31, 3): put(0, ty + 1, T(TN, 159), 'up', True)

# ================================================================= NE x51..95, y0..32
# shotengai: shops y26..32 facing the y33 sidewalk; plaza x51-53 with a signal
ground(51, 25, 3, 8, WALK)
signal(50, 30, 'signal-ne')
place_comp('retro-rtown-whole-building', 54, 25, 'rtown-shop-1')
shop(60, 26, 5, name='shop-2')
shop(65, 26, 5, diner=True, name='diner-3')
shop(72, 26, 5, diner=True, name='diner-4')
place_comp('retro-rtown-whole-building', 77, 25, 'rtown-shop-5')
shop(83, 26, 6, name='shop-6')
shop(89, 26, 7, diner=True, name='diner-7')
# park y18..24 between the back lane and the shop roofs
ground(51, 18, 19, 7, GRASS); ground(72, 18, 24, 7, GRASS)
ground(52, 21, 17, 1, SOIL); ground(73, 21, 22, 1, SOIL)
place_kit('park-swings', 52, 18); place_kit('park-slide', 56, 18); place_kit('park-sandpit', 62, 18)
place_kit('park-bench-front', 53, 22); place_kit('park-bench-front', 58, 22); place_kit('park-lamp', 61, 21)
place_kit('park-tree-planter', 66, 19)
place_kit('park-tree-planter', 73, 18); place_kit('park-bench-front', 78, 22); place_kit('park-lamp', 81, 20)
place_kit('park-bench-front', 83, 22); place_kit('park-tree-planter', 86, 18); place_kit('park-sandpit', 91, 18)
place_kit('park-bench-back', 91, 22)
# north of the back lane: apartment + clinic west, mansion + houses east
place_kit('apartment-dark-roof', 51, 6, 'apartment-ne')
place_kit('clinic-small', 61, 8, 'clinic-ne')
place_comp('msex-b-whole-house', 72, 5, 'mansion-ne')
place_kit('home-red-gable', 81, 6, 'house-ne-1')
place_kit('home-red-gable', 88, 6, 'house-ne-2')
# back-hill grove behind the NE lots: maples + dense trees + a garbage station, all existing chips
chip(51, 0, 'momiji.png', 4, 0, 4, 4, 'momiji-ne-1')
chip(59, 0, 'momiji.png', 4, 0, 4, 4, 'momiji-ne-2')
for tx in (55, 57, 63, 65):
    stamp(tx, 0, TN, 5, 16, 2, 3, 'up', True, f'tree{tx},0')
chip(68, 0, 'gomi.png', 2, 0, 2, 3, 'gomi-ne')
for tx in range(72, 95, 2):
    stamp(tx, 0, TN, 5, 16, 2, 3, 'up', True, f'tree{tx},0')

# ================================================================= SW x0..44, y39..63
signal(44, 39, 'signal-sw'); ground(43, 39, 2, 4, WALK)
place_kit('home-red-gable', 1, 42, 'house-sw-1')
place_comp('retro-rtown-whole-building', 8, 43, 'rtown-sw-2')
place_kit('home-red-gable', 15, 42, 'house-sw-3')
place_comp('retro-sento-whole-building', 25, 40, 'sento')
place_kit('home-red-gable', 33, 42, 'house-sw-4')
place_comp('retro-rtown-whole-building', 37 + 2, 43, 'rtown-sw-5')
place_kit('apartment-dark-roof', 1, 54, 'apartment-sw')
place_kit('home-red-gable', 12, 54, 'house-sw-6')
place_comp('retro-rtown-paper-doors', 19, 60, 'shed-sw')
place_kit('apartment-dark-roof', 25, 54, 'apartment-sw-2')
place_kit('home-red-gable', 36, 54, 'house-sw-7')

# ================================================================= SE x51..95, y39..63
signal(51, 39, 'signal-se'); ground(51, 39, 3, 7, WALK)
shop(54, 39, 10, name='konbini')
stamp(64, 43, CV, 0, 29, 2, 3, 'up', True, 'vending')
stamp(66, 40, CV, 5, 44, 2, 6, 'up', True, 'pole-sign')
ground(51, 46, 16, 8, ASPH)
for sx in range(52, 65, 4):
    for yy in range(47, 50): put(sx, yy, T(CV, 6), 'up', False)
# parked cars (car.png: front view cols 0-2, rear view cols 3-5, 3x4)
chip(53, 47, 'car.png', 11, 0, 3, 4, 'car-1')
chip(57, 47, 'car.png', 11, 3, 3, 4, 'car-2')
chip(61, 47, 'car.png', 11, 0, 3, 4, 'car-3')
place_comp('retro-rtown-whole-building', 67, 46, 'rtown-se')
place_kit('clinic-small', 77, 47, 'clinic-se')
place_kit('apartment-dark-roof', 86, 45, 'apartment-se')
# vegetable field behind the konbini (SA-Hatake01 soil + vege chips + scarecrow)
field = [(x, y) for y in range(39, 44) for x in range(69, 79)]
claim(69, 39, 10, 5, 'field-se')
xpcells(field, 'SA-Hatake01.png', 'lo', True)
for i, x in enumerate(range(70, 78)):
    put(x, 40, T(CH + 'vege.png', (4, 5, 8, 9)[i % 4]), 'up', False)
    put(x, 42, T(CH + 'vege.png', (16, 17, 18, 19)[i % 4]), 'up', False)
put(74, 40, T(CH + 'vege.png', 2), 'up', False); put(74, 41, T(CH + 'vege.png', 6), 'up', False)
# roadside jizo + big sakura
chip(80, 40, 'jizo.png', 3, 0, 3, 4, 'jizo-se')
chip(84, 38, 'sakura2.png', 6, 0, 6, 5, 'sakura-se')
chip(91, 39, 'momiji.png', 4, 0, 4, 4, 'momiji-se')
chip(90, 42, 'post.png', 2, 0, 1, 2, 'post-se')
# riverside park y56..62
ground(51, 56, 23, 7, GRASS); ground(76, 56, 20, 7, GRASS)
ground(51, 60, 23, 1, SOIL); ground(76, 60, 20, 1, SOIL)
place_kit('park-tree-planter', 52, 56); place_kit('park-bench-front', 57, 58); place_kit('park-lamp', 60, 56)
place_kit('park-tree-planter', 63, 56); place_kit('park-bench-front', 68, 58)
place_kit('park-tree-planter', 77, 56); place_kit('park-bench-front', 82, 58); place_kit('park-lamp', 85, 56)
place_kit('park-tree-planter', 88, 56); place_kit('park-bench-front', 93, 58)


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
    for yy in range(y0, y1 + 1):
        for xx in range(x0, x1 + 1):
            if free(xx, yy): lo[yy][xx] = [GRAVEL]; owner[yy][xx] = name + '-yard'
    wx0, wy0, wx1, wy1 = x0 - 1, y0 - 1, x1 + 1, y1 + 1
    gate = {gx, gx + 1} if free(gx + 1, wy1) or gx + 1 <= x1 else {gx}
    for yy in range(wy0, wy1 + 1):
        for xx in range(wx0, wx1 + 1):
            if not (yy in (wy0, wy1) or xx in (wx0, wx1)): continue
            if yy == wy1 and xx in gate: lo[yy][xx] = [GRAVEL] if free(xx, yy) else lo[yy][xx]; continue
            if not free(xx, yy): continue
            if yy == wy1:
                t = 40 if xx == wx0 else 42 if xx == wx1 else 43 if xx + 1 == min(gate) else 44 if xx - 1 == max(gate) else (50 if (xx // 3) % 3 == 1 else 41)
            elif yy == wy0:
                t = 16 if xx == wx0 else 18 if xx == wx1 else 17
            else:
                t = 24 if xx == wx0 else 26
            put(xx, yy, T(TN, t), 'up', True); owner[yy][xx] = name + '-wall'
    if free(gx - 1, wy1 + 0) is False and (gx - 1, wy1) not in APPR: pass
    put_mail = (gx + 2, wy1) if gx + 2 < wx1 else None
    if put_mail and any(r == T(TN, 44) for r in up[wy1][gx + 2]): up[wy1][gx + 2] = [T(TN, 54)]

for n in ('house-sw-1', 'house-sw-3', 'house-sw-4', 'house-sw-6', 'house-sw-7', 'rtown-sw-2', 'rtown-sw-5',
          'apartment-sw', 'apartment-sw-2', 'house-ne-1', 'house-ne-2', 'mansion-ne', 'apartment-ne',
          'rtown-se', 'clinic-se', 'apartment-se'):
    lot(n)

# ================================================================= south of canal y69..71: tree row
for tx in range(0, W, 3):
    if any(a - 1 <= tx + d <= b for a, b in bridges for d in (0, 1)): continue
    stamp(tx, 69, TN, 5, 16, 2, 3, 'up', True, f'bank{tx}')

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
json.dump({'width': W, 'height': H, 'placements': placements, 'entrances': entrances}, open('/tmp/town/town.json', 'w'), ensure_ascii=False)
print('ok', len(placements))
