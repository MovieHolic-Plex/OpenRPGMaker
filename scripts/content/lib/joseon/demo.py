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
MW, MH = 40, 40
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


# 시내: 큰 굽이(진폭 ±2~3칸). 다리 구간(y 22..29)은 곧게.
import math


def river_dx(y):
    k = max(0.0, min(1.0, (abs(y - 25.5) - 3.5) / 4.0))
    return int(round(3.2 * math.sin((y - 25.5) / 5.2) * k))


water = {(x + river_dx(y), y) for y in range(MH) for x in (30, 31, 32)}
# 연못: 돌 둑 이음(stream16)으로 곡선 윤곽
pond = {(x, y) for y in range(26, 40) for x in range(0, 16)
        if ((x - 7.5) / 7.2) ** 2 + ((y - 33) / 5.4) ** 2 + (rnd(x, y, 61) - 0.5) * 0.35 <= 1.0}
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

# 큰길 y=25..26 (다리 구간은 비움), 대문 진입로, 초가·이웃집 진입로
RY = (25, 26)
road = {(x, y) for y in RY for x in range(MW) if (x, y) not in water and not 29 <= x <= 33}
road |= {(x, y) for y in (23, 24) for x in (11, 12)}
road |= {(24, 24), (24, 23)}
road |= {(24, 14), (24, 15), (24, 16)}
road |= {(36, 24)}
for (x, y) in road:
    m = mask_of(road, x, y)
    if x == 28 and y in RY: m |= E
    if x == 34 and y in RY: m |= W
    setg(x, y, ROAD + m, 'road')

# 마당(이음 있는 흙바닥): 건물 앞 광장만 흙, 나머지는 풀·텃밭·나무
yard = {(x, y) for y in range(11, 22) for x in range(7, 18)} - {(x, y) for y in range(14, 19) for x in range(15, 19)}
yard -= {(x, y) for y in range(15, 22) for x in list(range(6, 9)) + list(range(15, 19))}
yard |= {(x, y) for y in range(12, 17) for x in range(21, 28)}
yard |= {(x, y) for y in range(22, 25) for x in range(20, 28)}
yard |= {(x, y) for y in range(17, 22) for x in range(20, 21)}
yard |= {(x, y) for y in range(22, 25) for x in range(34, 40)}
yard -= water
ysets = yard | road
for (x, y) in yard:
    if (x, y) in road: continue
    setg(x, y, YARD16 + mask_of(ysets, x, y, wrap=False), 'yard')
for y in range(11, 22):
    for x in (11, 12):
        setg(x, y, PAV + (x + y) % 2, 'paving')
for x in range(9, 15):
    setg(x, 11, PAV + x % 2, 'paving')
for y in range(14, 19):
    for x in range(15, 19):
        setg(x, y, FIELD + hsh(x, y, 5) % 2, 'field')
# 논: 두렁으로 나뉜 작은 구획, 사이는 밭
for (x0, y0, x1, y1) in ((17, 28, 22, 32), (23, 28, 28, 32), (17, 33, 22, 37), (23, 33, 28, 37)):
    plot = {(x, y) for y in range(y0, y1) for x in range(x0, x1)}
    for (x, y) in plot:
        setg(x, y, PADDY + mask_of(plot, x, y, wrap=False), 'paddy')
for rect, sd in (((16, 27, 29, 39), 9), ((34, 27, 40, 37), 11), ((0, 6, 5, 14), 12), ((6, 22, 11, 25), 13), ((13, 22, 19, 25), 14),
                 ((34, 5, 40, 8), 17)):
    x0, y0, x1, y1 = rect
    for y in range(y0, y1):
        for x in range(x0, x1):
            if ground_kind[y][x] is None:
                setg(x, y, FIELD + hsh(x, y, sd) % 2, 'field')

# ---------- 물체 층 ----------
OBJ = Cv(MW * T, MH * T)
placed = []          # (이름, 칸x, 칸y, 폭칸, 높이칸) — 지도 게이트가 읽는다
items = []


FREE = ('bridge', 'reeds', 'rocks', 'willow', 'wall', 'stone_bank', 'small', 'bush', 'fence')
SKIPPED = []


def put_obj(name, tx, ty):
    cv = objects[name]
    foot = [(tx + i, ty + cv.h // T - 1) for i in range(cv.w // T)]
    bad = {'water', 'paddy', 'road'} if not name.startswith(('bridge', 'reeds', 'rocks')) else set()
    if name.startswith('willow'): bad = {'paddy', 'road'}
    if any(0 <= x < MW and 0 <= y < MH and ground_kind[y][x] in bad for x, y in foot):
        SKIPPED.append((name, tx, ty)); return
    placed.append((name, tx, ty, cv.w // T, cv.h // T))
    items.append((ty + cv.h // T, name, tx, ty, cv))      # y 정렬 키 = 아래쪽 칸


# 뒷산: 큰 나무·어린 나무·덤불을 크기 섞어 무리 짓는다(등간격 테두리 금지). 석축 둑 뒤가 후원의 높은 땅.
for nm, x, y in (('zelkova_a', 0, 0), ('small_p', 3, 2), ('pine_a', 4, 0), ('persimmon_a', 8, 1), ('zelkova_b', 11, 0), ('persimmon_b', 13, 2),
                 ('small_z_b', 16, 2), ('pine_b', 17, 0), ('bush_a', 19, 3), ('zelkova_c', 20, 0), ('small_z_a', 23, 2), ('zelkova_a', 24, 0),
                 ('bush_c', 26, 3), ('small_p', 27, 1), ('bush_b', 1, 4), ('bush_c', 7, 3), ('bush_a', 15, 4),
                 ('pine_a', 33, 0), ('small_z_b', 36, 2), ('zelkova_b', 36, 0), ('bush_b', 38, 4), ('persimmon_a', 38, 6), ('bush_c', 34, 4), ('bush_b', 17, 4), ('bamboo', 29, 1)):
    put_obj(nm, x, y)
for x in range(5, 20):
    put_obj('stone_bank', x, 3)

# 양반집: 기와집(팔작) · 대문 · 토석담
put_obj('giwa_house_6', 8, 5)
put_obj('gate_4', 9, 16)
for x in (6, 7, 8): put_obj('wall_h', x, 21)
for x in (15, 16, 17, 18): put_obj('wall_h', x, 21)
put_obj('wall_corner_l', 5, 21); put_obj('wall_corner_r', 19, 21)
for y in range(5, 21):
    put_obj('wall_v', 5, y); put_obj('wall_v', 19, y)
put_obj('jars', 6, 9)
put_obj('well', 17, 6)
put_obj('persimmon_a', 13, 15)
put_obj('bench', 6, 14)
put_obj('lantern', 9, 13)
put_obj('bamboo', 17, 9)
put_obj('bush_b', 14, 13); put_obj('bush_a', 6, 18); put_obj('bush_c', 17, 19)
for x in range(15, 19): put_obj('fence_h', x, 13)
put_obj('jars', 17, 10); put_obj('bush_a', 7, 12); put_obj('bush_b', 8, 19); put_obj('bush_c', 14, 19)
# 이웃 기와집과 안마당
put_obj('giwa_house_5', 21, 8)
put_obj('haystack', 27, 12)
put_obj('persimmon_b', 26, 14)
put_obj('jars', 22, 14)
# 초가집과 살림살이
put_obj('thatch_house_5', 21, 17)
put_obj('mat_peppers', 22, 24)
put_obj('jars', 26, 23)
put_obj('haystack', 27, 20)
put_obj('bush_c', 28, 22)
for x in range(20, 21): put_obj('fence_h', x, 20)
# 마을 어귀
put_obj('jangseung_m', 2, 23); put_obj('jangseung_f', 6, 23)
put_obj('sotdae', 4, 23)
put_obj('zelkova_a', 0, 18); put_obj('pine_b', 1, 12); put_obj('bamboo', 3, 17)
put_obj('bush_a', 3, 21); put_obj('bush_c', 0, 25)
# 시내와 다리
put_obj('bridge', 29, 24)
put_obj('willow', 27, 5)
put_obj('willow', 34, 28)
put_obj('bush_b', 29, 20); put_obj('bush_c', 33, 21); put_obj('bush_a', 29, 14)
# 시내 건너: 정자와 작은 초가
put_obj('pavilion_5', 33, 8)
put_obj('lantern', 33, 15)
put_obj('thatch_house_4', 34, 18)
put_obj('haystack', 37, 23)
put_obj('persimmon_a', 35, 15)
put_obj('zelkova_c', 36, 15)
put_obj('bush_b', 39, 17)
# 남쪽: 논밭 둘레
for nm, x, y in (('zelkova_b', 15, 33), ('persimmon_b', 15, 30), ('bush_c', 16, 29), ('reeds', 1, 29), ('reeds', 4, 26), ('reeds', 15, 31), ('rocks', 12, 26), ('rocks', 0, 36), ('reeds', 10, 39), ('rocks', 6, 26),
                 ('zelkova_a', 27, 31), ('pine_b', 22, 36), ('persimmon_a', 28, 28), ('bamboo', 38, 29),
                 ('bush_c', 34, 31), ('haystack', 29, 36), ('haystack', 28, 34), ('bush_a', 17, 36),
                 ('bush_b', 24, 29), ('zelkova_c', 35, 34), ('pine_a', 38, 34), ('bush_a', 15, 37)):
    put_obj(nm, x, y)

# 빈 곳 메우기: 텃밭 울타리·밭 가장자리 나무·길가 덤불
for x in range(0, 5): put_obj('fence_h', x, 14)
for y in range(6, 14):
    if y % 3 == 0: put_obj('bush_c', 4, y)
for nm, x, y in (('persimmon_b', 1, 7), ('bamboo', 0, 10), ('bush_a', 2, 12), ('zelkova_b', 0, 15)):
    put_obj(nm, x, y)
for nm, x, y in (('bush_b', 8, 23), ('bush_c', 9, 22), ('bush_a', 14, 23), ('bush_b', 17, 22), ('haystack', 15, 22), ('fence_h', 7, 24), ('fence_h', 8, 24),
                 ('bush_a', 2, 28), ('bush_b', 21, 27), ('pine_a', 18, 27), ('bush_c', 27, 27), ('zelkova_a', 15, 28), ('bush_a', 34, 27),
                 ('bush_b', 29, 22), ('bush_c', 29, 18), ('bush_b', 29, 16), ('reeds', 29, 12), ('reeds', 33, 33), ('rocks', 29, 27), ('rocks', 34, 30), ('reeds', 30, 28), ('bush_c', 33, 12), ('zelkova_a', 35, 4),
                 ('persimmon_b', 38, 5), ('bush_a', 34, 6), ('pine_b', 24, 5), ('bush_c', 31, 20), ('bush_a', 38, 26), ('bush_b', 19, 14)):
    put_obj(nm, x, y)

for nm, x, y in (('small_p', 31, 14), ('bush_c', 34, 16), ('small_z_a', 30, 17), ('bush_a', 31, 12), ('small_z_b', 35, 11), ('bush_b', 32, 18), ('bush_c', 25, 5), ('bush_a', 23, 9), ('bush_b', 30, 9), ('small_p', 28, 14)):
    put_obj(nm, x, y)
# 3라운드 보강: 연못 둘레·남쪽 가장자리·후원 잔디를 크기 다른 나무·덤불로
for nm, x, y in (('small_z_b', 1, 27), ('bush_a', 4, 27), ('reeds', 5, 28), ('rocks', 14, 29), ('small_p', 12, 28), ('bush_c', 2, 38), ('small_z_a', 5, 37), ('bush_b', 9, 38),
                 ('small_z_a', 13, 37), ('pine_b', 29, 36), ('bush_c', 31, 38), ('small_p', 33, 37), ('bush_a', 36, 38), ('small_z_b', 38, 36), ('bush_b', 16, 38), ('bush_a', 20, 38), ('small_z_b', 24, 37),
                 ('small_z_b', 6, 6), ('bush_c', 6, 10), ('bush_b', 16, 9), ('small_p', 16, 6), ('bush_a', 15, 10), ('small_z_a', 7, 16), ('bush_b', 17, 20), ('small_p', 16, 19),
                 ('bush_a', 21, 6), ('small_z_b', 27, 8), ('bush_b', 20, 14), ('small_z_b', 28, 17), ('bush_c', 39, 10), ('small_z_a', 38, 20)):
    put_obj(nm, x, y)

items.sort(key=lambda i: (i[0], i[3], i[2]))
for _, name, tx, ty, cv in items:
    OBJ.paste(cv, tx * T, ty * T)

print('물·길·논 위라 빼낸 물체:', SKIPPED)
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
