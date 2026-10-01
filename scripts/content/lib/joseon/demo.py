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


# 시내(x=30..32) — 지도 가장자리는 이어진 것으로 본다
water = {(x, y) for y in range(MH) for x in (30, 31, 32)}


def mask_of(cells, x, y, wrap=True):
    m = 0
    for bit, (dx, dy) in ((N, (0, -1)), (E, (1, 0)), (S, (0, 1)), (W, (-1, 0))):
        X, Y = x + dx, y + dy
        out = not (0 <= X < MW and 0 <= Y < MH)
        if (X, Y) in cells or (wrap and out):
            m |= bit
    return m


for (x, y) in water:
    setg(x, y, STREAM + mask_of(water, x, y), 'water')

# 큰길 y=25..26 (다리 구간은 비움), 대문 진입로, 초가·이웃집 진입로
RY = (25, 26)
road = {(x, y) for y in RY for x in range(MW) if not 29 <= x <= 33}
road |= {(x, y) for y in (23, 24) for x in (11, 12)}
road |= {(24, 24), (24, 23)}
road |= {(24, 14), (24, 15), (24, 16)}
road |= {(36, 24)}
for (x, y) in road:
    m = mask_of(road, x, y)
    if x == 28 and y in RY: m |= E
    if x == 34 and y in RY: m |= W
    setg(x, y, ROAD + m, 'road')

# 마당(이음 있는 흙바닥): 양반집 · 이웃 기와집 · 초가
yard = {(x, y) for y in range(5, 22) for x in range(6, 19)}
yard |= {(x, y) for y in range(8, 25) for x in range(21, 29)}
yard |= {(x, y) for y in range(17, 25) for x in range(20, 21)}
yard |= {(x, y) for y in range(18, 25) for x in range(34, 40)}
ysets = yard | road
for (x, y) in yard:
    if (x, y) in road: continue
    setg(x, y, YARD16 + mask_of(ysets, x, y, wrap=False), 'yard')
for y in range(12, 23):
    for x in (11, 12):
        setg(x, y, PAV + (x + y) % 2, 'paving')
# 논과 밭
paddy = {(x, y) for y in range(27, 39) for x in range(1, 15)}
for (x, y) in paddy:
    setg(x, y, PADDY + mask_of(paddy, x, y, wrap=False), 'paddy')
for rect, sd in (((17, 27, 27, 36), 9), ((34, 27, 40, 36), 11), ((0, 6, 5, 14), 12), ((6, 22, 11, 25), 13), ((13, 22, 19, 25), 14),
                 ((15, 27, 17, 36), 15), ((27, 27, 29, 36), 16), ((34, 5, 40, 8), 17)):
    x0, y0, x1, y1 = rect
    for y in range(y0, y1):
        for x in range(x0, x1):
            if ground_kind[y][x] is None:
                setg(x, y, FIELD + hsh(x, y, sd) % 2, 'field')

# ---------- 물체 층 ----------
OBJ = Cv(MW * T, MH * T)
placed = []          # (이름, 칸x, 칸y, 폭칸, 높이칸) — 지도 게이트가 읽는다
items = []


def put_obj(name, tx, ty):
    cv = objects[name]
    placed.append((name, tx, ty, cv.w // T, cv.h // T))
    items.append((ty + cv.h // T, name, tx, ty, cv))      # y 정렬 키 = 아래쪽 칸


# 뒷산: 북쪽 숲띠 — 높낮이가 다른 큰 나무를 겹쳐 세운다(버들항 수림처럼 빈틈 없이)
for nm, x, y in (('zelkova_a', 0, 0), ('pine_a', 3, 1), ('zelkova_b', 7, 0), ('pine_b', 11, 1), ('zelkova_c', 15, 0),
                 ('pine_a', 19, 1), ('zelkova_a', 23, 0), ('pine_b', 27, 1), ('zelkova_b', 34, 0), ('pine_a', 37, 2),
                 ('persimmon_a', 5, 3), ('persimmon_b', 21, 3), ('bush_a', 9, 3), ('bush_b', 13, 4), ('bush_c', 25, 3),
                 ('bush_a', 29, 3), ('bush_b', 1, 4), ('bush_c', 33, 4), ('bamboo', 17, 3), ('bamboo', 36, 4)):
    put_obj(nm, x, y)

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
put_obj('persimmon_a', 14, 15)
put_obj('bench', 6, 14)
put_obj('lantern', 9, 13)
put_obj('bamboo', 17, 10)
put_obj('bush_b', 14, 13); put_obj('bush_a', 6, 18); put_obj('bush_c', 17, 19)
put_obj('fence_h', 15, 12); put_obj('fence_h', 16, 12)
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
put_obj('willow', 33, 28)
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
for nm, x, y in (('zelkova_b', 15, 33), ('persimmon_b', 15, 30), ('bush_c', 16, 29),
                 ('zelkova_a', 27, 31), ('pine_b', 22, 36), ('persimmon_a', 28, 28), ('bamboo', 38, 29),
                 ('bush_c', 34, 31), ('haystack', 30, 36), ('haystack', 28, 34), ('bush_a', 17, 36),
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
                 ('bush_b', 29, 22), ('bush_c', 29, 18), ('bush_a', 29, 11), ('bush_b', 29, 16), ('bush_c', 33, 12), ('zelkova_a', 35, 4),
                 ('persimmon_b', 38, 5), ('bush_a', 34, 6), ('zelkova_c', 24, 6), ('bush_c', 31, 20), ('bush_a', 38, 26), ('bush_b', 19, 14)):
    put_obj(nm, x, y)

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
