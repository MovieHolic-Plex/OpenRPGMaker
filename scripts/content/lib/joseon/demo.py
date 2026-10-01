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
MW, MH = 40, 34
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

# 큰길 y=21..22 (다리 구간은 비움), 대문 진입로, 초가 진입로
road = {(x, y) for y in (21, 22) for x in range(MW) if not 29 <= x <= 33}
road |= {(x, y) for y in (19, 20) for x in (11, 12)}
road |= {(24, 20)}
for (x, y) in road:
    m = mask_of(road, x, y)
    if x == 28 and y in (21, 22): m |= E
    if x == 34 and y in (21, 22): m |= W
    setg(x, y, ROAD + m, 'road')

# 마당(이음 있는 흙바닥)
yard = {(x, y) for y in range(1, 17) for x in range(6, 19)}
yard |= {(x, y) for y in range(13, 21) for x in range(20, 29)}
ysets = yard | road
for (x, y) in yard:
    if (x, y) in road: continue
    setg(x, y, YARD16 + mask_of(ysets, x, y, wrap=False), 'yard')
for y in range(8, 19):
    for x in (11, 12):
        setg(x, y, PAV + (x + y) % 2, 'paving')
# 논과 밭
paddy = {(x, y) for y in range(25, 33) for x in range(2, 15)}
for (x, y) in paddy:
    setg(x, y, PADDY + mask_of(paddy, x, y, wrap=False), 'paddy')
for y in range(25, 31):
    for x in range(17, 26):
        setg(x, y, FIELD + hsh(x, y, 9) % 2, 'field')

# ---------- 물체 층 ----------
OBJ = Cv(MW * T, MH * T)
placed = []


def put_obj(name, tx, ty):
    cv = objects[name]
    return (ty + cv.h // T, name, tx, ty, cv)      # y 정렬 키 = 아래쪽 칸


items = []
# 양반집: 기와집(팔작) · 솟을 아닌 맞배 대문 · 토석담
items.append(put_obj('giwa_house_6', 8, 1))
items.append(put_obj('gate_4', 9, 12))
for x in (6, 7, 8): items.append(put_obj('wall_h', x, 17))
for x in (15, 16, 17, 18): items.append(put_obj('wall_h', x, 17))
items.append(put_obj('wall_corner_l', 5, 17)); items.append(put_obj('wall_corner_r', 19, 17))
for y in range(1, 17):
    items.append(put_obj('wall_v', 5, y)); items.append(put_obj('wall_v', 19, y))
items.append(put_obj('jars', 6, 5))
items.append(put_obj('well', 17, 2))
items.append(put_obj('persimmon', 15, 12))
items.append(put_obj('bench', 6, 10))
items.append(put_obj('lantern', 9, 9))
# 초가집과 살림살이
items.append(put_obj('thatch_house_5', 21, 13))
items.append(put_obj('mat_peppers', 22, 20))
items.append(put_obj('jars', 26, 19))
# 마을 어귀
items.append(put_obj('jangseung_m', 2, 19)); items.append(put_obj('jangseung_f', 2, 23))
items.append(put_obj('sotdae', 4, 19))
# 시내 둔덕
items.append(put_obj('bridge', 29, 20))
items.append(put_obj('willow', 26, 6))
items.append(put_obj('pavilion_5', 33, 10))
items.append(put_obj('lantern', 33, 17))
items.append(put_obj('pine', 35, 1)); items.append(put_obj('pine', 0, 0)); items.append(put_obj('pine', 1, 7))
items.append(put_obj('pine', 22, 0)); items.append(put_obj('persimmon', 18, 29))
items.append(put_obj('willow', 33, 25))
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
