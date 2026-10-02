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

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'tiledata', 'joseon-village20'))
MW, MH = 64, 56
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


# ---------- 지도: 소규모 마을 (집 20채) ----------
gr = [[GRASS + hsh(x, y, 3) % 4 for x in range(MW)] for y in range(MH)]
ground_kind = [[None] * MW for _ in range(MH)]


def setg(x, y, tid, kind):
    if 0 <= x < MW and 0 <= y < MH:
        gr[y][x] = tid
        ground_kind[y][x] = kind


import math
import random as _rand


def river_dx(y):
    k = max(0.0, min(1.0, (abs(y - 28.5) - 3.5) / 4.0))
    return int(round(2.4 * math.sin((y - 28.5) / 6.0) * k))


RX = 40
water = {(x + river_dx(y), y) for y in range(MH) for x in range(RX, RX + 4)}
pond = {(x, y) for y in range(34, 48) for x in range(0, 10)
        if ((x - 4.6 + 0.9 * math.sin(y * 0.9)) / (4.8 + 0.7 * math.sin(x * 0.8))) ** 2 + ((y - 40.5 + 0.7 * math.sin(x * 0.9)) / 6.2) ** 2 + (rnd(x, y, 61) - 0.5) * 0.3 <= 1.0}
_nb = lambda c, st: sum(((c[0] + dx, c[1] + dy) in st) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
for _ in range(2):
    pond = {c for c in pond if _nb(c, pond) >= 2}
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

# ---- 길: 큰길 · 골목(4줄) · 대문 앞길
LANES = [6, 29, 46, 59]
RY = (28, 29)
road = {(x, y) for y in RY for x in range(MW) if (x, y) not in water}
for lx in LANES:
    road |= {(lx, y) for y in range(0, 28)}
road |= {(29, y) for y in range(30, 45)} | {(46, y) for y in range(30, 45)}
road |= {(x, y) for x in (16, 17) for y in range(22, 28)}                    # 양반댁 대문 앞길
for (x, y) in road:
    if (x, y) in water: continue
    m = mask_of(road, x, y)
    if x == RX - 1 + river_dx(y) and y in RY: m |= E
    if x == RX + 4 + river_dx(y) and y in RY: m |= W
    setg(x, y, ROAD + m, 'road')

# ---- 건물 (이름, 칸x, 칸y, 문 앞 길이 닿는 골목 x 또는 None)
BUILDINGS = [
    # 양반댁(담 x8..26, y1..20): 안채 · 사랑채 · 행랑채 · 대문채
    ('giwa_house_6', 13, 4, None), ('giwa_house_3b', 21, 9, None), ('giwa_haengnang_7', 9, 10, None), ('gate_4', 14, 16, None),
    # 서쪽 골목(x=6)
    ('thatch_house_3', 0, 1, 6), ('giwa_house_3', 0, 8, 6), ('thatch_house_3b', 0, 15, 6), ('thatch_house_3', 0, 22, 6),
    # 동쪽 골목(x=29)
    ('thatch_house_3b', 31, 1, 29), ('giwa_house_3', 31, 8, 29), ('thatch_house_3', 31, 15, 29), ('giwa_seodang', 31, 21, 29),
    # 개울 건너 동쪽 마을(골목 x=46, 59)
    ('thatch_house_3', 48, 1, 46), ('giwa_house_3', 48, 8, 46), ('thatch_house_3b', 48, 15, 46), ('thatch_house_3', 48, 21, 46),
    ('thatch_house_3b', 54, 1, 59), ('giwa_house_3', 54, 8, 59), ('thatch_house_3', 54, 15, 59),
    # 큰길 남쪽: 대장간 · 방앗간 · 주막 · 정자
    ('thatch_smithy', 23, 31, 29), ('thatch_porch_5', 31, 31, 29), ('thatch_jumak', 48, 31, 46), ('pavilion_5', 1, 49, None),
]
DOOR = {'thatch_jumak': 3, 'thatch_smithy': 3}
bsize = {n: (objects[n].w // T, objects[n].h // T) for n in {b[0] for b in BUILDINGS}}

yard = set()
for n, x, y, lane in BUILDINGS:
    w, h = bsize[n]
    if lane is None: continue
    dx = x + DOOR.get(n, w // 2)
    for xx in range(min(dx, lane), max(dx, lane) + 1):
        yard.add((xx, y + h))
    for xx in range(dx - 1, dx + 2): yard.add((xx, y + h))                      # 문 앞 3칸
# 양반댁 마당 / 후원
yard |= {(x, y) for y in range(10, 20) for x in range(9, 26)} - {(x, y) for y in range(10, 16) for x in range(9, 16)} - {(x, y) for y in range(9, 15) for x in range(21, 26)} - {(x, y) for y in range(16, 20) for x in range(14, 20)}
yard |= {(x, 22) for x in range(15, 19)}
yard |= {(x, y) for y in range(33, 36) for x in range(30, 39)}                     # 방앗간 마당
yard |= {(x, y) for y in range(33, 38) for x in range(47, 56)}                     # 주막 앞 마당(평상)
yard |= {(x, y) for y in (27,) for x in (8, 9)} | {(x, y) for y in range(30, 33) for x in range(7, 11)}   # 연못으로 가는 샛길 일부
yard |= {(x, y) for y in range(30, 36) for x in range(7, 10)} | {(x, 36) for x in range(7, 10)}
yard -= water
ysets = yard | road | {(x + i, y + h - 1) for n, x, y, lane in BUILDINGS for (w, h) in [bsize[n]] for i in range(1, w - 1)}
for (x, y) in yard:
    if (x, y) in road or not (0 <= x < MW and 0 <= y < MH): continue
    setg(x, y, YARD16 + mask_of(ysets, x, y, wrap=False), 'yard')
for y in range(10, 16):
    for x in (16, 17):
        setg(x, y, PAV + (x + y) % 2, 'paving')
for x in range(14, 20):
    setg(x, 10, PAV + x % 2, 'paving')
# 논
for (x0, y0, x1, y1) in ((11, 33, 17, 38), (18, 33, 24, 38), (11, 39, 17, 44), (18, 39, 24, 44)):
    plot = {(x, y) for y in range(y0, y1) for x in range(x0, x1)}
    for (x, y) in plot:
        setg(x, y, PADDY + mask_of(plot, x, y, wrap=False), 'paddy')
for rect, sd in (((10, 32, 25, 45), 9), ((48, 40, 64, 46), 11), ((31, 44, 38, 46), 13), ((36, 2, 39, 8), 15), ((36, 10, 39, 15), 16), ((36, 17, 39, 21), 17), ((1, 6, 5, 7), 18), ((53, 22, 59, 27), 19), ((60, 2, 64, 12), 20)):
    x0, y0, x1, y1 = rect
    for y in range(y0, min(y1, MH)):
        for x in range(x0, min(x1, MW)):
            if ground_kind[y][x] is None:
                setg(x, y, FIELD + hsh(x, y, sd) % 2, 'field')

# ---------- 물체 층 ----------
OBJ = Cv(MW * T, MH * T)
placed = []
items = []
BODYF = []
BODY = []
SKIPPED = []
TREE_PFX = ('zelkova', 'pine', 'persimmon', 'willow', 'bamboo', 'small')


def _keep_cells():
    k = set()
    for y in range(MH):
        for x in range(MW):
            if ground_kind[y][x] in ('road', 'paving'): k.add((x, y))
    return k


def put_obj(name, tx, ty, force=False):
    cv = objects[name]
    w, h = cv.w // T, cv.h // T
    foot = [(tx + i, ty + h - 1) for i in range(w)]
    if not force and not name.startswith('bridge'):
        KEEP = _keep_cells()
        low = [(tx + i, ty + j) for i in range(w) for j in range(max(0, h // 2), h)]
        if any(c in KEEP for c in low):
            SKIPPED.append((name, tx, ty)); return False
        if name.startswith(TREE_PFX):
            for (bx, by, bw, bh) in BODYF:
                if any(bx <= fx < bx + bw and by - 1 <= fy < by + bh for fx, fy in foot):
                    SKIPPED.append((name, tx, ty)); return False
    bad = {'water', 'paddy', 'road'}
    if name.startswith(('bridge', 'reeds', 'rocks')): bad = set()
    elif name.startswith('willow'): bad = {'paddy', 'road', 'water'}
    if not force and any(0 <= x < MW and 0 <= y < MH and ground_kind[y][x] in bad for x, y in foot):
        SKIPPED.append((name, tx, ty)); return False
    isb = name.split('_')[0] in ('giwa', 'thatch', 'gate', 'pavilion', 'gwanah', 'nugak', 'fort')
    if not force and not isb:
        for (bx, by, bw, bh) in BODY:
            if any(bx <= fx < bx + bw and by <= fy < by + bh for fx, fy in foot):
                SKIPPED.append((name, tx, ty)); return False
    if isb: BODY.append((tx, ty + 2, w, h - 2)); BODYF.append((tx, ty, w, h))
    placed.append((name, tx, ty, w, h))
    items.append((ty + h, name, tx, ty, cv))
    return True


def put_any(names, x, y):
    for nm in names:
        if not any(p[0] == nm and abs(p[1] - x) <= 6 and abs(p[2] - y) <= 6 for p in placed):
            return put_obj(nm, x, y)
    return False


for n, x, y, lane in BUILDINGS:
    put_obj(n, x, y, force=True)

# 양반댁: 네 변 같은 토석담 · 모서리 4 · 남쪽은 대문채가 막고 양옆 담이 처마 밑까지
WALLS = ('wall_h', 'wall_h1', 'wall_h2')
for x in range(9, 26): put_obj(WALLS[x % 3], x, 1, True)
for x in list(range(9, 14)) + list(range(20, 26)): put_obj(WALLS[x % 3], x, 20, True)
put_obj('wall_corner_nw', 8, 1, True); put_obj('wall_corner_ne', 26, 1, True)
put_obj('wall_corner_sw', 8, 20, True); put_obj('wall_corner_se', 26, 20, True)
for y in range(3, 20):
    put_obj('wall_v', 8, y, True); put_obj('wall_v_e', 26, y, True)
BODY += [(8, 1, 19, 2), (8, 3, 1, 17), (26, 3, 1, 17), (8, 20, 19, 2)]

# 양반댁 안: 석등·우물·장독대·굴뚝·평상·꽃
for nm, x, y in (('lantern', 15, 10), ('lantern', 18, 10), ('well', 22, 4), ('jars', 10, 4), ('chimney', 21, 7), ('bench', 11, 17), ('flower_bed', 20, 17),
                 ('persimmon_a', 23, 15), ('bush_a', 10, 8), ('bush_b', 24, 3), ('bamboo', 9, 3)):
    put_obj(nm, x, y)

# 집 앞 토담·사립문, 항아리·낟가리·빨랫줄
for n, x, y, lane in BUILDINGS:
    if lane is None or n.startswith(('pavilion',)): continue
    w, h = bsize[n]
    dx = x + DOOR.get(n, w // 2)
    side = [xx for xx in range(x + 1, x + w - 1) if abs(xx - dx) > 1 and (lane - xx) * (lane - dx) <= 0 is False]
    if (x + y) % 2 == 0:
        for xx in range(x + 1, x + w - 1):
            if abs(xx - dx) > 1 and not (min(dx, lane) <= xx <= max(dx, lane)): put_obj('toldam', xx, y + h)
    if (x * 3 + y) % 5 == 0: put_obj('sarip', dx - 1, y + h, True)
    if (x + y) % 3 == 0: put_obj('jars', x + w, y + h - 1)

# 마을 어귀: 서낭당 · 장승 · 솟대 (서쪽 입구), 장승 한 쌍 (동쪽 입구)
put_obj('seonangdang', 1, 30); put_obj('jangseung_m', 4, 30, True); put_obj('jangseung_f', 8, 30, True); put_obj('sotdae', 2, 33)
put_obj('jangseung_m', 60, 30, True); put_obj('jangseung_f', 63, 30, True)
# 다리
put_obj('bridge', 39, 27, True)
# 방앗간: 연자방아 · 낟가리, 정자나무 · 평상
for nm, x, y in (('yeonja_mill', 31, 38), ('haystack', 35, 38), ('zelkova_a', 33, 41), ('bench', 34, 39), ('laundry', 24, 38), ('jars', 26, 36), ('chimney', 28, 33),
                 ('bench', 50, 38), ('jars', 55, 37), ('laundry', 56, 33), ('haystack', 60, 36), ('flower_bed', 31, 3), ('laundry', 37, 6)):
    put_obj(nm, x, y)
# 연못 둘레
for nm, x, y in (('reeds', 4, 33), ('reeds', 10, 36), ('reeds', 10, 42), ('rocks', 1, 36), ('rocks', 11, 47), ('reeds', 7, 48), ('willow', 11, 29), ('small_z_a', 9, 46), ('bush_c', 6, 52)):
    put_obj(nm, x, y)
# 시내 둑
for nm, x, y in (('reeds', 38, 12), ('reeds', 45, 33), ('rocks', 38, 36), ('reeds', 38, 20), ('rocks', 44, 18), ('reeds', 44, 40), ('reeds', 38, 46)):
    put_obj(nm, x, y)
# 숲띠(뒷산)
for nm, x, y in (('zelkova_a', 0, -4), ('pine_a', 4, -4), ('zelkova_b', 9, -5), ('pine_b', 14, -5), ('zelkova_c', 19, -5), ('pine_c', 23, -4), ('zelkova_e', 28, -4), ('pine_d', 33, -4),
                 ('zelkova_e', 37, -4), ('pine_a', 45, -4), ('zelkova_c', 50, -4), ('pine_d', 55, -4), ('zelkova_b', 60, -4),
                 ('persimmon_a', 3, 5), ('persimmon_b', 40, 8), ('small_p', 44, 3), ('bamboo', 41, 14), ('bamboo_grove', 60, 16), ('pine_c', 61, 22)):
    put_obj(nm, x, y)
# 마을 가장자리 덤불·어린 나무
for nm, x, y in (('bush_b', 5, 28), ('small_z_a', 27, 22), ('bush_a', 28, 12), ('bush_c', 7, 20), ('small_z_b', 37, 19), ('bush_b', 36, 27), ('small_p', 44, 25), ('bush_a', 52, 29),
                 ('bush_c', 47, 46), ('small_z_a', 56, 44), ('bush_b', 61, 40), ('small_z_b', 26, 46), ('bush_a', 19, 46), ('bush_c', 14, 49), ('small_p', 26, 50), ('bush_b', 38, 50),
                 ('zelkova_d', 50, 49), ('pine_a', 58, 48), ('bush_a', 44, 52), ('bamboo_grove', 20, 51)):
    put_obj(nm, x, y)
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
_POOL = ['bush_l_a', 'bush_l_b', 'bush_s_a', 'bush_s_b', 'pine_c', 'pine_d', 'pine_a', 'bamboo_grove', 'bush_a', 'bush_b', 'bush_c', 'small_z_a', 'small_z_b', 'small_p', 'flower_bed', 'bush_a', 'bush_b', 'bush_c', 'jars', 'persimmon_b', 'persimmon_c']
_rng = _rand.Random(int(os.environ.get('JS_SEED', '1')))


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
    if best <= 0.08:
        break
    cells = [(x, y) for y in range(by, by + 15) for x in range(bx, bx + 20) if g[y, x]]
    _rng.shuffle(cells)
    done = False
    for (cx, cy) in cells[:400]:
        nm = _rng.choice(_POOL)
        cv = objects[nm]
        w, h = cv.w // T, cv.h // T
        tx, ty = cx - w // 2, cy - h + 1
        if not (0 <= tx and tx + w <= MW and 0 <= ty): continue
        if _same_near(nm, tx, ty): continue
        if any(not g[ty + j, tx + i] for j in range(h) for i in range(w) if 0 <= ty + j < MH and 0 <= tx + i < MW and j >= h - 1): continue
        if put_obj(nm, tx, ty):
            OBJ.paste(cv, tx * T, ty * T); _filled += 1; done = True; break
    if not done:
        allc = [(x, y) for y in range(MH) for x in range(MW) if g[y, x]]
        _rng.shuffle(allc)
        for (cx, cy) in allc[:1500]:
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
import people as _pp
_pp.overlay(direct.img(), _pp.VILLAGE).save(os.path.join(OUT, 'joseon-village20-map-people.png'))
SHEET.img().save(os.path.join(OUT, 'joseon-village20-chipset.png'))
direct.img().save(os.path.join(OUT, 'joseon-village20-map.png'))
re.img().save(os.path.join(OUT, 'joseon-village20-map-from-sheet.png'))
json.dump({'tile': T, 'cols': COLS, 'rows': sheet_rows, 'tileCount': len(grid), 'pieces': pieces,
           'overlapTiles': {'start': base, 'count': len(extra)}},
          open(os.path.join(OUT, 'pieces.json'), 'w'), ensure_ascii=False, indent=1)
json.dump({'width': MW, 'height': MH, 'ground': gr, 'object': obj_ids}, open(os.path.join(OUT, 'map.json'), 'w'))
colors = set(map(tuple, SHEET.a.reshape(-1, 4)[SHEET.a.reshape(-1, 4)[:, 3] == 255][:, :3]))
print(json.dumps({'sheet': f'{COLS}x{sheet_rows} tiles', 'pixelDiffMapVsSheet': diff, 'overlapTiles': len(extra),
                  'uniqueOpaqueColors': len(colors)}))
