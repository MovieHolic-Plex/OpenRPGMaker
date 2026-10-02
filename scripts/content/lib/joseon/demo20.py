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
for _k in ('road16', 'yard16', 'stream16', 'paddy16', 'rice16'):
    add_group(_k, _terr[_k])
GRASS, YARD, PAV, FIELD = (pieces[k]['id'] for k in ('grass', 'yard', 'paving', 'field'))
PADDY = pieces['rice16']['id']
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


RX = 41


def river_L(y):
    if y < 7: return 41
    if y < 14: return 40
    if y < 21: return 41
    if y < 38: return 41
    if y < 45: return 40
    return 41


def river_R(y):
    if y < 7: return 44
    if y < 14: return 44
    if y < 21: return 43
    if y < 38: return 44
    if y < 45: return 43
    if y < 52: return 44
    return 45


water = {(x, y) for y in range(MH) for x in range(river_L(y), river_R(y) + 1)}
pond = {(x, y) for y in range(40, 54) for x in range(0, 10)
        if ((x - 4.6 + 0.9 * math.sin(y * 0.9)) / (4.8 + 0.7 * math.sin(x * 0.8))) ** 2 + ((y - 46.5 + 0.7 * math.sin(x * 0.9)) / 6.2) ** 2 + (rnd(x, y, 61) - 0.5) * 0.3 <= 1.0}
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

# ---- 길 체계(고증 검토 반영): 큰길(폭 2, 구간마다 한 행씩 어긋남) > 안길(폭 1, 직선 구간을 꺾어 이음) > 샛길(막다른)
def path(*pts):
    cells = set()
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            for y in range(min(y0, y1), max(y0, y1) + 1):
                cells.add((x, y))
    return cells


BIG = [(0, 13, 28), (14, 33, 29), (34, 63, 28)]
road = set()
for _x0, _x1, _yt in BIG:
    for _x in range(_x0, _x1 + 1):
        road |= {(_x, _yt), (_x, _yt + 1)}
LANE = set()
LANE |= path((6, 27), (6, 3)) | path((7, 27), (7, 3))                                  # L1 서쪽 고샅(담 곁에서 한 칸 비껴감)
LANE |= path((30, 28), (30, 3)) | path((31, 28), (31, 3))        # L2 서안 안길
LANE |= path((46, 27), (46, 0)) | path((47, 27), (47, 0))        # L3 동안 안길(북쪽 고개로 나가는 유일한 출구)
LANE |= path((46, 30), (46, 38))                                                     # 주막 샛길(폭 1)                                              # 주막 샛길
LANE |= path((29, 31), (29, 37))                                                     # 방앗간 샛길(폭 1)                                              # 방앗간·대장간 샛길
LANE |= {(x, y) for x in (16, 17) for y in range(24, 30)}                                         # 양반댁 대문 앞길(폭 2)
road |= LANE
road -= water
for (x, y) in road:
    m = mask_of(road, x, y)
    if x == river_L(y) - 1 and y in (28, 29): m |= E
    if x == river_R(y) + 1 and y in (28, 29): m |= W
    setg(x, y, ROAD + m, 'road')
# 논·밭에 물 대는 도랑(물 타일): 연못→논 사이 골, 강→동쪽 밭
DITCH = {(x, 39) for x in range(9, 22)} | {(9, 40)} | {(x, 43) for x in range(44, 48)}
for (x, y) in DITCH:
    if (x, y) not in road:
        water.add((x, y))
for (x, y) in DITCH:
    if (x, y) not in road:
        setg(x, y, STREAM + mask_of(water, x, y, wrap=False), 'water')

# ---- 건물 (이름, 칸x, 칸y). 문 앞 꼬리길은 건물 아래 행(y+높이)에서 가장 가까운 길 칸으로 이어진다.
BUILDINGS = [
    # 양반댁(담 x8..26, y1..23): 안채 · 사랑채 · 곳간 + 남쪽 솟을대문
    ('giwa_house_6', 13, 4), ('giwa_numa', 9, 11), ('thatch_gotgan', 21, 9), ('gate_solseul', 12, 17),
    # 서쪽 고샅(L1, 폭 2): 집은 x≤5 에 둔다
    ('thatch_hut_2', 2, 2), ('giwa_house_4w', 0, 9), ('thatch_house_4', 0, 16), ('thatch_porch_4', 0, 22),
    # 서안 안길(L2) 동쪽 줄
    ('thatch_house_4', 33, 3), ('giwa_house_5b', 32, 10), ('thatch_hut_2', 34, 17),
    # 동안 안길(L3) 동쪽 — 같은 줄 두 채는 꼬리길을 공유하되 지붕 종류가 다르다
    ('thatch_house_4k', 49, 1), ('giwa_house_4', 50, 8), ('thatch_house_5', 49, 15), ('giwa_seodang', 50, 22),
    ('thatch_house_3b', 56, 1), ('thatch_gotgan', 56, 15), ('thatch_house_3', 57, 22),
    # 큰길 남쪽: 대장간 · 방앗간(물레방아) · 주막 · 정자
    ('thatch_smithy', 23, 31), ('thatch_bangatgan', 33, 31), ('thatch_jumak', 48, 31), ('pavilion_5g', 0, 31),
]
DOOR = {'thatch_jumak': 3, 'thatch_smithy': 3}
bsize = {n: (objects[n].w // T, objects[n].h // T) for n in {b[0] for b in BUILDINGS}}
_lane_cells = sorted(LANE | road)
for _i, (_n, _x, _y) in enumerate(BUILDINGS):
    _w, _h = bsize[_n]
    _cells = {(_x + i, _y + j) for i in range(_w) for j in range(_h)}
    if _cells & LANE: print('길 위 건물:', _n, _x, _y, sorted(_cells & LANE)[:3])
    for (_m, _x2, _y2) in BUILDINGS[_i + 1:]:
        _w2, _h2 = bsize[_m]
        if _x < _x2 + _w2 and _x2 < _x + _w and _y < _y2 + _h2 and _y2 < _y + _h and not (_n.startswith('gate') or _m.startswith('gate')):
            print('건물 겹침:', _n, _x, _y, _m, _x2, _y2)


def tail_target(n, x, y):
    w, h = bsize[n]
    dx = x + DOOR.get(n, w // 2)
    r = y + h
    cand = [c for c in _lane_cells if c[1] == r and abs(c[0] - dx) <= 14]
    if not cand:
        return dx, r, None
    return dx, r, min(cand, key=lambda c: abs(c[0] - dx))[0]


yard = set()
for n, x, y in BUILDINGS:
    if n.startswith('pavilion') or n == 'gate_solseul' or (8 <= x <= 26 and y <= 22):
        continue
    dx, r, xl = tail_target(n, x, y)
    if xl is None:
        print('꼬리길 없음:', n, x, y, '행', r)
        xl = dx
    for xx in range(min(dx, xl), max(dx, xl) + 1):
        yard.add((xx, r))
    for xx in range(dx - 1, dx + 2): yard.add((xx, r))                      # 문 앞 3칸
    for xx in range(x, x + w): yard.add((xx, r - 1))                         # 기단 밑 줄: 처마 밑 땅을 흙으로(풀띠 방지)
# 양반댁 마당: 담 안 전체가 다진 흙 마당(건물이 놓이는 칸은 건물이 덮는다)
yard |= {(x, y) for y in range(10, 22) for x in range(9, 26)}
# 마을 우물 마당(공동우물·정자나무·빨래터) · 방앗간/대장간/주막 마당 · 정자 가는 길
yard |= {(x, y) for y in range(24, 28) for x in range(32, 40)} | {(32, 28), (33, 28)}
yard |= {(x, y) for y in range(37, 39) for x in range(24, 29)}
yard |= {(x, y) for y in range(37, 40) for x in range(29, 39)}
yard |= {(x, y) for y in range(37, 40) for x in range(46, 57)}
yard |= {(x, y) for y in range(30, 39) for x in (7, 8)} | {(x, y) for y in (37, 38) for x in range(0, 9)}
yard -= water
yard -= road
ysets = yard | road | {(x + i, y + h - 1) for n, x, y in BUILDINGS for (w, h) in [bsize[n]] for i in range(1, w - 1)}
for (x, y) in yard:
    if not (0 <= x < MW and 0 <= y < MH): continue
    setg(x, y, YARD16 + mask_of(ysets, x, y, wrap=False), 'yard')
# 논
for (x0, y0, x1, y1) in ((10, 34, 15, 39), (16, 34, 21, 39), (10, 40, 15, 45), (16, 40, 21, 45)):
    plot = {(x, y) for y in range(y0, y1) for x in range(x0, x1)}
    for (x, y) in plot:
        setg(x, y, PADDY + mask_of(plot, x, y, wrap=False), 'paddy')
for rect, sd in (((48, 41, 55, 51), 11), ((56, 42, 64, 50), 23), ((38, 4, 41, 12), 15), ((38, 14, 41, 19), 16), ((62, 3, 64, 14), 20), ((62, 17, 64, 27), 22), ((27, 3, 30, 22), 24), ((30, 41, 38, 48), 13), ((57, 9, 60, 14), 21)):
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
CANOPY_PFX = TREE_PFX + ('bush',)
NEAR_D = 1
NOTREE = []          # 나무·덤불 수관이 덮으면 안 되는 사각형: 건물 · 문 앞 · 담 띠 · 정자 앞


def _kind(x, y):
    return ground_kind[y][x] if 0 <= x < MW and 0 <= y < MH else None


def _near(x, y, kinds, d):
    return any(_kind(x + i, y + j) in kinds for i in range(-d, d + 1) for j in range(-d, d + 1))


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
    if not force and (tx < 0 or tx + w > MW):
        SKIPPED.append((name, tx, ty)); return False
    if not force and not name.startswith('bridge'):
        KEEP = _keep_cells()
        low = [(tx + i, ty + j) for i in range(w) for j in range(max(0, h // 2), h)]
        if any(c in KEEP for c in low):
            SKIPPED.append((name, tx, ty)); return False
        if name.startswith(TREE_PFX):
            for (bx, by, bw, bh) in BODYF:
                if any(bx <= fx < bx + bw and by - 1 <= fy < by + bh for fx, fy in foot):
                    SKIPPED.append((name, tx, ty)); return False
    if not force and name.startswith(CANOPY_PFX):
        for (bx, by, bw, bh) in NOTREE:
            if tx < bx + bw and bx < tx + w and ty < by + bh and by < ty + h:
                SKIPPED.append((name, tx, ty)); return False
        if any(_near(fx, fy, {'road', 'yard', 'paving'}, NEAR_D) or _near(fx, fy, {'paddy', 'field', 'water'}, 1) for fx, fy in foot):
            SKIPPED.append((name, tx, ty)); return False
    bad = {'water', 'paddy', 'road'}
    if name.startswith(CANOPY_PFX): bad |= {'yard', 'paving', 'field'}
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
    if name.startswith(('zelkova', 'pine', 'persimmon', 'willow', 'small')):      # 왼쪽 위 빛 → 나무 밑동 오른쪽 아래로 땅 그림자
        import props5 as _p5
        sh = Cv(w * T, h * T)
        _p5.shadow_ell(sh, w * T * 0.58, h * T - 4, w * T * 0.36, 3.4, 58)
        items.append((ty + h - 0.5, 'shadow', tx, ty, sh))
    items.append((ty + h, name, tx, ty, cv))
    return True


def put_any(names, x, y):
    for nm in names:
        if not any(p[0] == nm and abs(p[1] - x) <= 6 and abs(p[2] - y) <= 6 for p in placed):
            return put_obj(nm, x, y)
    return False


for n, x, y in BUILDINGS:
    put_obj(n, x, y, force=True)
    _w, _h = bsize[n]
    NOTREE.append((x, y, _w, _h))
    NOTREE.append((x + DOOR.get(n, _w // 2) - 1, y + _h, 3, 3))
NOTREE += [(8, 0, 19, 4), (7, 3, 3, 21), (25, 3, 3, 21), (8, 21, 19, 3), (0, 36, 10, 3), (0, 30, 10, 2), (13, 0, 8, 10), (32, 24, 8, 4), (7, 30, 4, 10)]

# 양반댁: 네 변 같은 토석담 · 모서리 4 · 남쪽은 솟을대문 양옆으로 담이 닿는다
WALLS = ('wall_h', 'wall_h1', 'wall_h2')
for x in range(9, 26): put_obj(WALLS[x % 3], x, 1, True)
for x in list(range(9, 13)) + list(range(21, 26)): put_obj(WALLS[x % 3], x, 22, True)
put_obj('wall_corner_nw', 8, 1, True); put_obj('wall_corner_ne', 26, 1, True)
put_obj('wall_corner_sw', 8, 22, True); put_obj('wall_corner_se', 26, 22, True)
for y in range(3, 22):
    put_obj('wall_v', 8, y, True); put_obj('wall_v_e', 26, y, True)
BODY += [(8, 1, 19, 2), (8, 3, 1, 19), (26, 3, 1, 19), (8, 22, 19, 2)]

# 양반댁 안: 우물 · 장독대 · 굴뚝 · 사랑채 앞 평상 · 화단 · 정원수 (석등은 사찰 어휘라 뺐다)
for nm, x, y in (('flower_bed', 15, 10), ('flower_bed', 19, 10), ('well', 22, 4), ('jangdokdae', 9, 3), ('chimney', 12, 3), ('pyeongsang', 17, 14)):
    put_obj(nm, x, y, True)
for nm, x, y in (('persimmon_a', 22, 17), ('pine_c', 10, 6), ('bush_b', 23, 2), ('small_z_a', 23, 7)):
    put_obj(nm, x, y, True)

# 집 곁 살림 + 마당 앞 낮은 담(문 앞은 사립문 틈) — 집마다 담 종류·살림이 다르다
_PROPS = ['jars', 'haystack', 'jangdokdae']
for i, (n, x, y) in enumerate(BUILDINGS):
    if n.startswith(('pavilion', 'gate')) or (8 <= x <= 26 and y <= 22): continue
    w, h = bsize[n]
    nm = _PROPS[i % len(_PROPS)]
    pw, ph = objects[nm].w // T, objects[nm].h // T
    for tx in (x + w, x - pw):
        if put_obj(nm, tx, y + h - ph): break
    dx, r, xl = tail_target(n, x, y)
    gap = set(range(min(dx, xl if xl is not None else dx) - 1, max(dx, xl if xl is not None else dx) + 2))
    wall = 'dolmadam' if n.startswith('giwa') else ('toldam' if i % 2 == 0 else 'jukbyeok')
    xs = [xx for xx in range(x, x + w) if xx not in gap and 0 <= xx < MW]
    runs, cur = [], []
    for xx in xs:
        if cur and xx != cur[-1] + 1: runs.append(cur); cur = []
        cur.append(xx)
    if cur: runs.append(cur)
    for run in runs:
        if len(run) >= 3:                                   # 한두 칸 토막은 허공에 뜬 도장처럼 보이므로 두지 않는다
            for xx in run: put_obj(wall, xx, r)

# 마을 어귀: 서쪽은 큰길 양옆 장승 · 서낭당 · 솟대 / 동쪽은 큰길 양옆 장승 + 당산나무 + 금줄 제단
put_obj('jangseung_m', 7, 26, True); put_obj('jangseung_f', 7, 30, True); put_obj('sotdae', 10, 26, True)
put_obj('seonangdang', 12, 31, True); put_obj('sotdae', 15, 31, True)
put_obj('jangseung_m', 60, 26, True); put_obj('jangseung_f', 60, 30, True); put_obj('sotdae', 62, 26, True)
put_obj('zelkova_a', 59, 34, True); put_obj('geumjul_altar', 58, 39, True)
# 북쪽 고갯길 어귀(L3 끝): 서낭 돌무더기
put_obj('seonangdang', 45, 1, True)
# 다리
put_obj('bridge', RX - 1, 27, True)
# 마을 우물 마당: 공동우물 · 평상 · 정자나무 · 빨래터
for nm, x, y in (('well', 32, 25), ('pyeongsang', 35, 26), ('laundry', 38, 25)):
    put_obj(nm, x, y, True)
put_obj('zelkova_c', 37, 20, True); put_obj('stepping_stones', 39, 23, True)
# 방앗간: 물레방아는 시내 위, 연자방아·맷돌·낟가리 / 주막: 큰 평상 · 장독대
put_obj('waterwheel', 40, 30, True)
for nm, x, y in (('yeonja_mill', 36, 38), ('haystack', 32, 38), ('millstone', 34, 38), ('zelkova_a', 33, 42),
                 ('pyeongsang', 49, 38), ('jangdokdae', 50, 36), ('laundry', 55, 38),
                 ('gochu_mat', 26, 37)):
    put_obj(nm, x, y)
for nm, x, y in (('scarecrow', 56, 44), ('scarecrow', 58, 11), ('gochu_mat', 60, 8)):
    put_obj(nm, x, y)
# 연못 선착장: 샛길 끝에서 물가로, 배 한 척
put_obj('dock', 8, 39, True); put_obj('dock', 8, 41, True); put_obj('boat', 5, 44, True)
# 연못 둘레: 남쪽 기슭에 갈대 · 바위
_shore = sorted([(x, y) for (x, y) in pond if (x, y + 1) not in water and 3 <= x <= 8])
for k, (x, y) in enumerate(_shore[::2][:4]):
    put_obj('reeds' if k % 2 == 0 else 'rocks', x, y - (objects['reeds' if k % 2 == 0 else 'rocks'].h // T) + 2)
# 시내 둑: 오른쪽 기슭 갈대 · 돌
for k, yy in enumerate((9, 17, 34, 43, 50)):
    put_obj('reeds' if k % 2 == 0 else 'rocks', river_R(yy) + 1, yy - objects['reeds' if k % 2 == 0 else 'rocks'].h // T + 1)
# 과수원(남서 쪽): 감나무를 엇갈려 줄지어 심는다
for r, yy in enumerate((48, 52)):
    for c, xx in enumerate(range(12 + 2 * r, 36, 6)):
        put_obj(('persimmon_a', 'persimmon_b', 'persimmon_c')[(c + 2 * r) % 3], xx, yy)
# 배산: 북쪽 소나무·바위 띠
put_obj('stele', 6, 1, True); put_obj('pyeongsang', 30, 1, True)
for x in (34, 41, 53, 58):
    put_obj('rocks', x, 1)
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
_POOL = ['bush_l_a', 'bush_l_b', 'bush_s_a', 'bush_s_b', 'pine_c', 'pine_d', 'pine_a', 'bamboo_grove', 'bush_a', 'bush_b', 'bush_c', 'small_z_a', 'small_z_b', 'small_p', 'bush_a', 'bush_b', 'bush_c', 'persimmon_b', 'persimmon_c']
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
NEAR_D = 1
_filled = 0
for _it in range(260):
    g = _lawn_grid()
    best, bx, by = -1, 0, 0
    for yy in range(0, MH - 14):
        for xx in range(0, MW - 19):
            v = g[yy:yy + 15, xx:xx + 20].mean()
            if v > best: best, bx, by = v, xx, yy
    if best <= 0.24:
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
_pp.overlay(direct.img(), [p for p in _pp.VILLAGE if ground_kind[p[1]][p[0]] in ('road', 'yard') and not any(bx <= p[0] < bx + bw and by <= p[1] < by + bh for (bx, by, bw, bh) in BODYF)]).save(os.path.join(OUT, 'joseon-village20-map-people.png'))
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
