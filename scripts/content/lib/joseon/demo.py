"""조선 데모 칩셋: 시트 굽기 + 시트 칸만으로 깐 데모 마을.

    python3 demo.py            # tiledata/joseon-demo/ 에 쓴다
검증: 지도를 직접 그린 그림과, 시트 칸 번호만으로 다시 조립한 그림이 한 화소도 다르지 않아야 한다.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from tk import *
import ground as G, build as B, props as P
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "harness"))
import gate as _gate
_CANDIDATE = '--candidate' in sys.argv
_rows, _fails, _warns, _ = _gate.run(skip_a=_CANDIDATE)
if _fails:
    print("게이트 FAIL %d — 굽지 않는다. python3 harness/gate.py 로 확인 (후보 굽기: --candidate = 적대 리뷰 A 만 건너뜀)" % _fails); sys.exit(1)
from PIL import Image

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'tiledata', 'joseon-demo'))
MW, MH = 48, 42
N, E, S, W = G.N, G.E, G.S, G.W

# ---------- 시트 ----------
COLS = 16
tiles = []            # (name, Cv) 순서 = 칸 번호
pieces = {}           # 이름 -> {id, w, h, tiles:[[id...]]}


def add_tile(c):
    tiles.append(c)
    return len(tiles) - 1


def pad_row():
    while len(tiles) % COLS:
        tiles.append(Cv(T, T))


def add_group(name, cvs):
    ids = [add_tile(c) for c in cvs]
    pieces[name] = {'id': ids[0], 'count': len(ids), 'tiles': ids}


# 지형
import catalog
_terr = catalog.terrain()
for _k in ('grass', 'yard', 'paving'):
    add_group(_k, _terr[_k])
add_group('field', _terr['field'])
pad_row()
for _k in ('road16', 'yard16', 'stream16', 'paddy16'):
    add_group(_k, _terr[_k])
GRASS, YARD, PAV, FIELD = (pieces[k]['id'] for k in ('grass', 'yard', 'paving', 'field'))
PADDY = pieces['paddy16']['id']
YARD16 = pieces['yard16']['id']
ROAD, STREAM = pieces['road16']['id'], pieces['stream16']['id']

# 물체: 칸 블록으로 시트에 놓는다(줄 맞춰 쌓기)
objects = catalog.objects()


def slice_tiles(cv):
    out = []
    for ty in range(cv.h // T):
        row = []
        for tx in range(cv.w // T):
            c = Cv(T, T)
            c.a = cv.a[ty * T:(ty + 1) * T, tx * T:(tx + 1) * T].copy()
            row.append(c)
        out.append(row)
    return out


# 선반 쌓기: 칸 단위 직사각형을 16열 시트에 줄 단위로 채운다
shelf = []          # 시트 칸 격자 (None = 빈칸)
rows_used = (len(tiles) + COLS - 1) // COLS
grid = {}           # (col,row) -> Cv
for i, c in enumerate(tiles):
    grid[(i % COLS, i // COLS)] = c
cur_x, cur_y, row_h = 0, rows_used, 0
for name, cv in objects.items():
    w, h = cv.w // T, cv.h // T
    if cur_x + w > COLS:
        cur_x, cur_y, row_h = 0, cur_y + row_h, 0
    ts = slice_tiles(cv)
    ids = []
    for ty in range(h):
        r = []
        for tx in range(w):
            grid[(cur_x + tx, cur_y + ty)] = ts[ty][tx]
            r.append((cur_y + ty) * COLS + cur_x + tx)
        ids.append(r)
    pieces[name] = {'id': ids[0][0], 'w': w, 'h': h, 'tiles': ids}
    cur_x += w
    row_h = max(row_h, h)
sheet_rows = cur_y + row_h
SHEET = Cv(COLS * T, sheet_rows * T)
for (cx, cy), c in grid.items():
    SHEET.paste(c, cx * T, cy * T)


# ---------- 지도 ----------
gr = [[GRASS + hsh(x, y, 3) % 4 for x in range(MW)] for y in range(MH)]     # 칸 번호
ground_kind = [[None] * MW for _ in range(MH)]


def setg(x, y, tid, kind):
    if 0 <= x < MW and 0 <= y < MH:
        gr[y][x] = tid
        ground_kind[y][x] = kind


import math
import random as _rand


def river_dx(y):
    k = max(0.0, min(1.0, (abs(y - 25.5) - 3.5) / 4.0))
    return int(round(3.2 * math.sin((y - 25.5) / 5.2) * k))


def river_w(y):
    return 4 if (7 <= y <= 13 or 36 <= y <= 41) else 3


water = {(x + river_dx(y), y) for y in range(MH) for x in range(30, 30 + river_w(y))}
pond = {(x, y) for y in range(26, 41) for x in range(0, 16)
        if ((x - 7.5) / 7.2) ** 2 + ((y - 33.5) / 5.6) ** 2 + (rnd(x, y, 61) - 0.5) * 0.35 <= 1.0}
water |= pond


def mask_of(cells, x, y, wrap=True):
    m = 0
    for bit, (dx, dy) in ((N, (0, -1)), (E, (1, 0)), (S, (0, 1)), (W, (-1, 0))):
        X, Y = x + dx, y + dy
        out = not (0 <= X < MW and 0 <= Y < MH)
        if (X, Y) in cells or (wrap and out):
            m |= bit
    return m


for (x, y) in water:
    setg(x, y, STREAM + mask_of(water, x, y, wrap=(x, y) not in pond), 'water')

# 길
RY = (25, 26)
road = {(x, y) for y in RY for x in range(MW) if (x, y) not in water and not 29 <= x <= 33}
road |= {(x, y) for y in (23, 24) for x in (11, 12)}
road |= {(24, 24), (24, 23)}
road |= {(24, 14), (24, 15), (24, 16)}
road |= {(36, 24)}
road |= {(44, 24)}
road |= {(x, y) for x in (42, 43) for y in range(27, 42)}
for (x, y) in road:
    m = mask_of(road, x, y)
    if x == 28 and y in RY: m |= E
    if x == 34 and y in RY: m |= W
    setg(x, y, ROAD + m, 'road')

# 건물 배치(이름, 칸x, 칸y, 앞마당 깊이). 앞마당 흙은 건물 폭만큼, 건물 밑에서 depth 칸.
BUILDINGS = [
    ('giwa_house_6', 8, 5, 0), ('gate_4', 9, 16, 0), ('giwa_house_4', 13, 11, 0),
    ('thatch_house_3', 0, 6, 1), ('giwa_house_3', 1, 12, 1), ('thatch_house_3b', 0, 18, 1),
    ('giwa_house_5', 21, 8, 2), ('thatch_porch_5', 21, 17, 3),
    ('nugak', 34, 8, 0), ('thatch_porch_4', 34, 18, 2), ('gwanah_5b', 41, 18, 2),
    ('gwanah_5', 41, 2, 2),
    ('fort_gate', 38, 33, 0), ('thatch_house_3b', 0, 0, 0), ('thatch_house_3', 43, 12, 1),
]
bsize = {n: (objects[n].w // T, objects[n].h // T) for n in {b[0] for b in BUILDINGS}}
yard = set()
for n, x, y, dep in BUILDINGS:
    w, h = bsize[n]
    for yy in range(y + h, y + h + dep):
        for xx in range(x + 1, x + w - 1):
            yard.add((xx, yy))
yard |= {(x, y) for y in range(11, 22) for x in range(7, 18)} - {(x, y) for y in range(11, 17) for x in range(13, 19)} - {(x, y) for y in range(15, 22) for x in list(range(6, 9)) + list(range(15, 19))}
yard |= {(x, y) for y in range(13, 17) for x in range(21, 28)}
yard -= water
ysets = yard | road
for (x, y) in yard:
    if (x, y) in road or not (0 <= x < MW and 0 <= y < MH): continue
    setg(x, y, YARD16 + mask_of(ysets, x, y, wrap=False), 'yard')
for y in range(11, 22):
    for x in (11, 12):
        setg(x, y, PAV + (x + y) % 2, 'paving')
for x in range(9, 15):
    setg(x, 11, PAV + x % 2, 'paving')
# 논: 두렁으로 나뉜 구획 + 사이 밭
for (x0, y0, x1, y1) in ((17, 28, 22, 32), (23, 28, 28, 32), (17, 33, 22, 37), (23, 33, 28, 38)):
    plot = {(x, y) for y in range(y0, y1) for x in range(x0, x1)}
    for (x, y) in plot:
        setg(x, y, PADDY + mask_of(plot, x, y, wrap=False), 'paddy')
for rect, sd in (((16, 27, 29, 40), 9), ((38, 36, 48, 41), 11), ((0, 25, 5, 28), 12), ((6, 22, 11, 25), 13), ((13, 22, 19, 25), 14), ((0, 0, 4, 1), 17)):
    x0, y0, x1, y1 = rect
    for y in range(y0, min(y1, MH)):
        for x in range(x0, min(x1, MW)):
            if ground_kind[y][x] is None:
                setg(x, y, FIELD + hsh(x, y, sd) % 2, 'field')

# ---------- 물체 층 ----------
OBJ = Cv(MW * T, MH * T)
placed = []          # (이름, 칸x, 칸y, 폭칸, 높이칸) — 지도 게이트가 읽는다
items = []
BODY = []            # 건물 몸채 칸(위 2줄 지붕 제외) — 나무·소품은 이 위에 서지 못한다
SKIPPED = []
WATERFREE = ('bridge', 'reeds', 'rocks', 'willow')


def put_obj(name, tx, ty, force=False):
    cv = objects[name]
    w, h = cv.w // T, cv.h // T
    foot = [(tx + i, ty + h - 1) for i in range(w)]
    bad = {'water', 'paddy', 'road'}
    if name.startswith(('bridge', 'reeds', 'rocks')): bad = set()
    elif name.startswith('willow'): bad = {'paddy', 'road'}
    if not force and any(0 <= x < MW and 0 <= y < MH and ground_kind[y][x] in bad for x, y in foot):
        SKIPPED.append((name, tx, ty)); return False
    isb = name.split('_')[0] in ('giwa', 'thatch', 'gate', 'pavilion', 'gwanah', 'nugak', 'fort')
    if not force and not isb:
        for (bx, by, bw, bh) in BODY:
            if any(bx <= fx < bx + bw and by <= fy < by + bh for fx, fy in foot):
                SKIPPED.append((name, tx, ty)); return False
    if isb: BODY.append((tx, ty + 2, w, h - 2))
    placed.append((name, tx, ty, w, h))
    items.append((ty + h, name, tx, ty, cv))
    return True


def put_any(names, x, y):
    for nm in names:
        if not any(p[0] == nm and abs(p[1] - x) <= 6 and abs(p[2] - y) <= 6 for p in placed):
            return put_obj(nm, x, y)
    return False


for n, x, y, dep in BUILDINGS:
    put_obj(n, x, y, force=True)
# 집마다 터: 앞마당 양옆 울타리와 독
for n, x, y, dep in BUILDINGS[3:]:
    if n.startswith(('pavilion', 'nugak', 'fort')): continue
    w, h = bsize[n]
    put_obj('fence_h', x, y + h); put_obj('fence_h', x + w - 1, y + h)
    if (x + y) % 3 == 0: put_obj('jars', x + w, y + h - 1)
# 양반댁: 토석담 + 석축 둑(후원은 한 단 높다)
for x in (6, 7, 8): put_obj(('wall_h', 'wall_h1', 'wall_h2')[x % 3], x, 20, True)
for x in (15, 16, 17, 18): put_obj(('wall_h', 'wall_h1', 'wall_h2')[x % 3], x, 20, True)
put_obj('wall_corner_l', 5, 20, True); put_obj('wall_corner_r', 19, 20, True)
for y in range(5, 20):
    put_obj('wall_v', 5, y, True); put_obj('wall_v', 19, y, True)
for x in range(5, 20): put_obj('stone_bank', x, 3, True)
# 정자가 선 언덕: 석축 둑과 돌계단
put_obj('fort_wall_end_l', 34, 40, True)
for x in range(35, 38): put_obj(('fort_wall_h', 'fort_wall_h1', 'fort_wall_h2')[x % 3], x, 40, True)

# 숲띠: 큰 나무·어린 나무·덤불을 크기 섞어 겹치게(맵 밖으로 이어지는 뒷숲 포함)
for nm, x, y in (('zelkova_a', 0, -1), ('pine_a', 3, -2), ('zelkova_b', 7, -2), ('pine_b', 11, -2), ('zelkova_c', 15, -2), ('pine_c', 19, -2), ('zelkova_e', 23, -2), ('pine_d', 27, -2),
                 ('zelkova_e', 33, -2), ('zelkova_c', 37, -2), ('pine_a', 44, -2), ('zelkova_b', 41, -2),
                 ('small_p', 3, 2), ('persimmon_a', 8, 1), ('zelkova_e', 11, 0), ('persimmon_b', 13, 2), ('small_z_b', 16, 2), ('pine_d', 17, 0), ('zelkova_d', 20, 0), ('small_z_a', 23, 2),
                 ('zelkova_a', 24, 0), ('small_p', 27, 1), ('bamboo', 29, 1), ('pine_a', 33, 0), ('small_z_b', 36, 2), ('zelkova_a', 36, 0), ('small_z_a', 39, 0), ('persimmon_a', 31, 4),
                 ('bush_a', 19, 3), ('bush_c', 26, 3), ('bush_b', 1, 4), ('bush_c', 7, 3), ('bush_a', 15, 4), ('bush_b', 17, 4), ('bush_b', 38, 4), ('bush_c', 34, 4)):
    put_obj(nm, x, y)
# 양반댁 안: 우물·장독대·텃밭·평상·꽃
for nm, x, y in (('well', 17, 6), ('jars', 6, 9), ('jars', 17, 10), ('bench', 6, 14), ('lantern', 9, 13), ('bamboo', 17, 8), ('persimmon_a', 14, 17),
                 ('flower_bed', 9, 12), ('bush_a', 7, 12), ('bush_b', 8, 19), ('bush_c', 14, 19), ('small_z_b', 6, 6), ('bush_c', 6, 10), ('small_p', 16, 19), ('bush_b', 16, 9)):
    put_obj(nm, x, y)
for x in range(15, 19): put_obj('fence_h', x, 17)
# 초가·이웃: 멍석·독·낟가리·빨랫줄
for nm, x, y in (('jars', 22, 14), ('haystack', 27, 12), ('persimmon_b', 26, 14), ('mat_peppers', 22, 24), ('jars', 26, 23), ('haystack', 27, 20), ('laundry', 25, 8), ('laundry', 41, 24),
                 ('flower_bed', 22, 15), ('haystack', 37, 23), ('jars', 36, 25), ('laundry', 44, 15), ('flower_bed', 36, 24), ('haystack', 46, 28), ('jars', 40, 32)):
    put_obj(nm, x, y)
# 마을 어귀: 장승·솟대
put_obj('jangseung_m', 2, 23); put_obj('jangseung_f', 6, 23); put_obj('sotdae', 4, 23)
for x in range(20, 21): put_obj('fence_h', x, 20)
# 다리·정자 둔덕
put_obj('bridge', 29, 24)
put_obj('willow', 27, 5)
put_obj('lantern', 33, 17); put_obj('persimmon_a', 36, 5)
# 바람의나라 연구: 관아 앞 홍살문, 마을 한복판 청사초롱 문, 어귀 장터 차일, 석탑, 원두막, 성문·성벽
put_obj('hongsalmun', 42, 9, True)
put_obj('deungrong_mun', 24, 22, True)
put_obj('stone_pagoda', 38, 3)
for nm, x, y in (('market_stall', 35, 27), ('market_stall_thatch', 38, 27), ('market_stall_thatch', 45, 27)):
    put_obj(nm, x, y)
for (x, y) in ((27, 37), (15, 36), (46, 29)):
    if put_obj('wondumak', x, y): break
# 연못 둘레: 갈대·돌·버드나무
for nm, x, y in (('reeds', 4, 26), ('reeds', 1, 29), ('reeds', 10, 27), ('reeds', 13, 29), ('rocks', 2, 31), ('rocks', 14, 31), ('rocks', 6, 26), ('reeds', 3, 37), ('rocks', 11, 39), ('reeds', 9, 40),
                 ('willow', 12, 28), ('small_z_b', 1, 27), ('small_z_a', 5, 38), ('bush_c', 2, 39), ('small_p', 13, 38)):
    put_obj(nm, x, y)
# 시내 둑
for nm, x, y in (('reeds', 29, 12), ('reeds', 33, 33), ('rocks', 29, 27), ('rocks', 34, 30), ('reeds', 30, 28), ('reeds', 31, 20), ('rocks', 28, 17), ('reeds', 33, 14)):
    put_obj(nm, x, y)
# 논밭 둘레 나무
for nm, x, y in (('zelkova_b', 15, 33), ('persimmon_b', 15, 29), ('zelkova_a', 28, 33), ('pine_b', 22, 38), ('persimmon_a', 28, 29), ('bush_a', 16, 38), ('bush_b', 24, 38),
                 ('bamboo', 45, 37), ('zelkova_c', 40, 36), ('pine_a', 35, 38), ('small_p', 42, 39), ('bush_c', 46, 36), ('small_z_a', 33, 38), ('haystack', 30, 38), ('haystack', 28, 36)):
    put_obj(nm, x, y)
# 길가·마당 가장자리 덤불·어린 나무(크기 섞어 무리로)
for nm, x, y in (('bush_b', 8, 23), ('bush_c', 9, 22), ('bush_a', 14, 23), ('bush_b', 17, 22), ('fence_h', 7, 24), ('fence_h', 8, 24), ('bush_a', 20, 6), ('small_z_a', 28, 9), ('bush_b', 20, 15),
                 ('small_z_b', 30, 17), ('bush_a', 32, 12), ('small_p', 31, 14), ('bush_c', 34, 16), ('bush_b', 39, 15), ('small_z_a', 46, 6), ('bush_a', 39, 12), ('small_z_b', 42, 15), ('bush_c', 47, 12),
                 ('bush_b', 29, 20), ('bush_c', 29, 22), ('small_p', 34, 22), ('bush_a', 40, 24), ('bush_b', 31, 23), ('small_z_a', 46, 21), ('bush_c', 47, 25)):
    put_obj(nm, x, y)
# 물가 따라 갈대·돌을 이어 놓는다(연못은 촘촘, 시내는 드문드문)
_sr = _rand.Random(21)
_used = set()
for y in range(MH):
    for x in range(MW):
        if ground_kind[y][x] is not None: continue
        near = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if (x + dx, y + dy) in water]
        if not near: continue
        in_pond = near[0] in pond
        if _sr.random() > (0.5 if in_pond else 0.3): continue
        if any((x + i, y + j) in _used for i in (-1, 0, 1) for j in (-1, 0, 1)): continue
        if put_obj(_sr.choice(['reeds', 'reeds', 'rocks']) if in_pond else _sr.choice(['reeds', 'rocks', 'rocks']), x, y - (1 if False else 0)):
            _used.add((x, y))
for nm, x, y in (('bamboo_grove', 44, 33), ('bamboo_grove', 25, 3), ('willow', 27, 17), ('willow', 35, 29), ('willow', 27, 36), ('pine_d', 22, 3), ('pine_d', 29, 14), ('pine_c', 46, 14)):
    put_any([nm, 'pine_a', 'pine_b', 'pine_c', 'pine_d'], x, y)
print('빼낸 물체:', len(SKIPPED))

items.sort(key=lambda i: (i[0], i[3], i[2]))
for _, name, tx, ty, cv in items:
    OBJ.paste(cv, tx * T, ty * T)

# ---------- 직접 렌더 ----------
def render_direct():
    cv = Cv(MW * T, MH * T)
    for y in range(MH):
        for x in range(MW):
            cv.paste(tiles_by_id(gr[y][x]), x * T, y * T)
    cv.paste(OBJ, 0, 0)
    return cv


def tiles_by_id(i):
    return grid[(i % COLS, i // COLS)]


# ---------- 빈 잔디 채우기: 맨 잔디 창이 가장 큰 곳에 덤불·어린 나무·화단을 놓는다(같은 그림 6칸 안 반복 금지) ----------
import random as _rand
_POOL = ['bush_l_a', 'bush_l_b', 'bush_s_a', 'bush_s_b', 'pine_c', 'pine_d', 'pine_a', 'bamboo_grove', 'bush_a', 'bush_b', 'bush_c', 'small_z_a', 'small_z_b', 'small_p', 'flower_bed', 'bush_a', 'bush_b', 'bush_c', 'haystack', 'jars', 'persimmon_b', 'persimmon_c']
_rng = _rand.Random(int(os.environ.get('JS_SEED', '9')))


def _lawn_grid():
    g = np.zeros((MH, MW), bool)
    for y in range(MH):
        for x in range(MW):
            if ground_kind[y][x] is None and OBJ.a[y * T:(y + 1) * T, x * T:(x + 1) * T, 3].max() == 0:
                g[y, x] = True
    return g


def _same_near(name, tx, ty):
    return any(p[0] == name and abs(p[1] - tx) <= 6 and abs(p[2] - ty) <= 6 for p in placed)


import numpy as np
_filled = 0
for _it in range(260):
    g = _lawn_grid()
    best, bx, by = -1, 0, 0
    for yy in range(0, MH - 14):
        for xx in range(0, MW - 19):
            v = g[yy:yy + 15, xx:xx + 20].mean()
            if v > best: best, bx, by = v, xx, yy
    if best <= 0.12:
        break
    cells = [(x, y) for y in range(by, by + 15) for x in range(bx, bx + 20) if g[y, x]]
    _rng.shuffle(cells)
    done = False
    for (cx, cy) in cells[:40]:
        nm = _rng.choice(_POOL)
        cv = objects[nm]
        w, h = cv.w // T, cv.h // T
        tx, ty = cx - w // 2, cy - h + 1
        if not (0 <= tx and tx + w <= MW and 0 <= ty): continue
        if _same_near(nm, tx, ty): continue
        if any(not g[ty + j, tx + i] for j in range(h) for i in range(w) if 0 <= ty + j < MH and 0 <= tx + i < MW and j >= h - 1): continue
        if put_obj(nm, tx, ty):
            OBJ.paste(cv, tx * T, ty * T); _filled += 1; done = True; break
    if not done: break
print('자동 채움', _filled, '개, 잔디 창 최대', round(float(best), 3))
OBJ = Cv(MW * T, MH * T)
items.sort(key=lambda i: (i[0], i[3], i[2]))
for _, name, tx, ty, cv in items:
    OBJ.paste(cv, tx * T, ty * T)
direct = render_direct()

# ---------- 물체 층을 칸으로 자르고(빈칸 -1) 시트 칸 번호만으로 다시 조립 ----------
# 물체 층의 칸이 시트 어디에 있는지 찾는다: 같은 그림이면 같은 칸 번호(없으면 시트에 추가).
lookup = {}
for (cx, cy), c in grid.items():
    lookup.setdefault(c.a.tobytes(), cy * COLS + cx)
extra = []
obj_ids = [[-1] * MW for _ in range(MH)]
for y in range(MH):
    for x in range(MW):
        sub = OBJ.a[y * T:(y + 1) * T, x * T:(x + 1) * T]
        if sub[:, :, 3].max() == 0:
            continue
        key = sub.tobytes()
        if key not in lookup:
            c = Cv(T, T); c.a = sub.copy()
            extra.append(c)
            lookup[key] = -2 - len(extra)      # 임시: 시트 끝에 붙일 칸
        obj_ids[y][x] = lookup[key]
# 겹친 칸(물체끼리 가려진 칸)은 시트 끝 「겹침 칸」 구역으로
base = sheet_rows * COLS
for k, c in enumerate(extra):
    grid[((base + k) % COLS, (base + k) // COLS)] = c
for y in range(MH):
    for x in range(MW):
        if obj_ids[y][x] <= -3:
            obj_ids[y][x] = base + (-obj_ids[y][x] - 3)
if extra:
    sheet_rows = (base + len(extra) + COLS - 1) // COLS
    SHEET = Cv(COLS * T, sheet_rows * T)
    for (cx, cy), c in grid.items():
        SHEET.paste(c, cx * T, cy * T)

direct = render_direct()
import mapgate as _mg
_mf, _mrep = _mg.check(placed, direct, OBJ)
print('지도 게이트', json.dumps(_mrep, ensure_ascii=False))
if _mf:
    print('지도 게이트 FAIL:\n  ' + '\n  '.join(_mf))
    direct.img().save('/tmp/joseon-map-rejected.png')
    sys.exit(1)
re = Cv(MW * T, MH * T)
for y in range(MH):
    for x in range(MW):
        re.paste(tiles_by_id(gr[y][x]), x * T, y * T)
for y in range(MH):
    for x in range(MW):
        if obj_ids[y][x] >= 0:
            re.paste(tiles_by_id(obj_ids[y][x]), x * T, y * T)
diff = int((direct.a != re.a).any(axis=2).sum())

os.makedirs(OUT, exist_ok=True)
SHEET.img().save(os.path.join(OUT, 'joseon-demo-chipset.png'))
direct.img().save(os.path.join(OUT, 'joseon-demo-map.png'))
re.img().save(os.path.join(OUT, 'joseon-demo-map-from-sheet.png'))
json.dump({'tile': T, 'cols': COLS, 'rows': sheet_rows, 'tileCount': len(grid), 'pieces': pieces,
           'overlapTiles': {'start': base, 'count': len(extra)}},
          open(os.path.join(OUT, 'pieces.json'), 'w'), ensure_ascii=False, indent=1)
json.dump({'width': MW, 'height': MH, 'ground': gr, 'object': obj_ids}, open(os.path.join(OUT, 'map.json'), 'w'))
colors = set(map(tuple, SHEET.a.reshape(-1, 4)[SHEET.a.reshape(-1, 4)[:, 3] == 255][:, :3]))
print(json.dumps({'sheet': f'{COLS}x{sheet_rows} tiles', 'pixelDiffMapVsSheet': diff, 'overlapTiles': len(extra),
                  'uniqueOpaqueColors': len(colors)}))
