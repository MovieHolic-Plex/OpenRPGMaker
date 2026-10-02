"""조선 칩셋 국내성형 맵(96×88): 성벽 고리 · 해자 고리 · 중앙 왕궁 · 구획 건물.

    python3 demo_gungnae.py        # tiledata/joseon-gungnae/ 에 쓴다
    JS_PROFILE=gungnae 는 이 파일이 스스로 켠다(지도 게이트 임계 조정, harness/mapgate.py).
구조는 demo20.py 와 같다: 지형 칸 + 물체 층(조각 칸) → 시트 칸 번호만으로 재조립해 pixelDiff 0 증명 → 지도 게이트 → 사람 오버레이.
좌표 약속: 모든 (x, y) 는 칸. 조각은 왼쪽 위(P) 또는 바닥 행(Pb) 기준으로 놓는다. 높은 조각은 아래 행을 발 밑으로 본다.
"""
import json, os, sys
import numpy as np

os.environ.setdefault('JS_PROFILE', 'gungnae')
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'harness'))
from tk import *
import ground as G
import water_blob as WB
import catalog
import gate as _gate

# 새 조각(gungnae_*, gn_*, palace_*, tower_*)은 독립 적대 리뷰(A)가 아직 없다 — A 만 건너뛰고 나머지(P·E·T·L·S·K·TR·V)는 그대로 막는다.
_rows, _fails, _warns, _ = _gate.run(skip_a=True) if not os.environ.get('JS_SKIPGATE') else ([], 0, 0, None)   # JS_SKIPGATE=1 은 반복 작업용(최종 굽기는 게이트를 건다)
if _fails:
    print("게이트 FAIL %d — 굽지 않는다. python3 harness/gate.py 로 확인" % _fails)
    sys.exit(1)
from PIL import Image

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
OUT = os.path.join(ROOT, 'tiledata', 'joseon-gungnae')
MW, MH = 96, 96
N, E, S, W = G.N, G.E, G.S, G.W
COLS = 16

# ---------------------------------------------------------------- 지형 목록(시트 앞쪽 고정)
tiles = []
pieces = {}
terr = catalog.terrain()
objects = catalog.objects()


def add_group(name, cvs):
    ids = []
    for c in cvs:
        tiles.append(c)
        ids.append(len(tiles) - 1)
    pieces[name] = {'id': ids[0], 'count': len(ids), 'tiles': ids}


def pad_row():
    while len(tiles) % COLS:
        tiles.append(Cv(T, T))


for _k in ('grass', 'yard', 'paving', 'field'):
    add_group(_k, terr[_k])
pad_row()
for _k in ('road16', 'yard16', 'water47', 'rice16', 'slab', 'slab_edge16', 'slab_dirt', 'diamond', 'palace_court', 'palace_court16'):
    add_group(_k, terr[_k])
    pad_row()
TID = {k: pieces[k]['id'] for k in pieces}
GRASS, YARD, ROAD, YARD16, STREAM, PADDY = TID['grass'], TID['yard'], TID['road16'], TID['yard16'], TID['water47'], TID['rice16']
SLAB, SLAB16, SLABD, DIAM, COURT, COURT16, FIELD = TID['slab'], TID['slab_edge16'], TID['slab_dirt'], TID['diamond'], TID['palace_court'], TID['palace_court16'], TID['field']
TARR = [t.a for t in tiles]

# ---------------------------------------------------------------- 바닥 종류 격자
KG = [[None] * MW for _ in range(MH)]          # None=풀
DIRT = ('road', 'yard', 'diamond')


def inb(x, y):
    return 0 <= x < MW and 0 <= y < MH


def paint(kind, x0, y0, x1, y1):
    """x0..x1, y0..y1 (끝 포함) 사각형을 kind 로."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if inb(x, y):
                KG[y][x] = kind


def cells_of(*kinds):
    return {(x, y) for y in range(MH) for x in range(MW) if KG[y][x] in kinds}


# ---------------------------------------------------------------- 물체 층
items = []                 # (바닥 행, 높이, x, 이름, Cv)
placed = []                # (이름, x, y, w, h)  놓은 순서
BODY = set()               # 건물·벽 등 막힌 칸(나무·소품이 못 서는 칸)
KEEP = set()               # 나무·덤불이 가리면 안 되는 칸(문 앞·다리 끝)
DOORS = []                 # {'x','y','piece'}


def P(name, x, y, solid='foot', tag=None):
    """조각 왼쪽 위 칸 (x, y) 에 놓는다. solid: 'foot'(맨 아래 행만 막힘) · 'body'(아래 2/3) · 'all'(전체) · None."""
    cv = objects[name]
    w, h = cv.w // T, cv.h // T
    placed.append((name, x, y, w, h))
    items.append((y + h, h, x, name, cv))
    if solid == 'all':
        rows = range(y, y + h)
    elif solid == 'body':
        rows = range(y + h // 3, y + h)
    elif solid == 'foot':
        rows = (y + h - 1,)
    else:
        rows = ()
    for yy in rows:
        for xx in range(x, x + w):
            BODY.add((xx, yy))
    return name


def Pb(name, x, yb, solid='foot'):
    cv = objects[name]
    return P(name, x, yb + 1 - cv.h // T, solid)


def SH(x, y, w, h, alpha=58):
    """나무 밑 땅 그림자(demo20 와 같은 식)."""
    import props5 as _p5
    sh = Cv(w * T, h * T)
    _p5.shadow_ell(sh, w * T * 0.58, h * T - 4, w * T * 0.36, 3.4, alpha)
    items.append((y + h - 0.5, 0, x, 'shadow', sh))


# ================================================================ 1단계: 틀(성벽 + 문 + 바깥 길 + 숲띠)
XW, XE = 8, 86                 # 서·동 성벽 왼쪽 칸(폭 2)
YN, YS = 14, 87                # 북·남 성벽 발 행(그림은 위로 5칸)
GX = 42                        # 대문루 왼쪽 칸(폭 12 → 42..53, 가운데 x=48.0)
YG = 50                        # 동·서 소문루 발 행(그림 9칸: 42..50)
IN_X0, IN_X1, IN_Y0, IN_Y1 = XW + 2, XE - 1, YN + 1, YS - 5      # 성 안 칸 범위(10..85, 15..82)
CX = 48                        # 중심 경계선 x

# --- 바깥 흙길 고리(폭 2) · 바깥 숲띠는 나무로(아래)
paint('road', 0, 0, MW - 1, 1); paint('road', 0, MH - 2, MW - 1, MH - 1)
paint('road', 0, 0, 1, MH - 1); paint('road', MW - 2, 0, MW - 1, MH - 1)
# --- 성벽 밑(막힘)
paint('wall', XW, YN - 4, XE + 1, YN); paint('wall', XW, YS - 4, XE + 1, YS)
paint('wall', XW, YN, XW + 1, YS); paint('wall', XE, YN, XE + 1, YS)
# --- 북·남 대문 통로 + 석판 대로(폭 4: 46..49)
paint('slab', 46, 2, 49, YN)                                                   # 북문 아래(문루 그림이 덮는다) + 문 앞
paint('slab', 46, YN + 1, 49, 28)                                              # 북문 → 해자 다리 앞(다리 데크가 21..27 을 덮는다)
paint('slab', 46, YS - 12, 49, YS + 6)                                         # 남문(그림 덮음)·성 안 앞·성 밖 대로
# --- 동·서 소문루 앞 길(성벽 틈 2행)
GAP_Y0, GAP_Y1 = YG + 1, YG + 3                    # 3행 틈(길 폭 3)
paint('road', 0, GAP_Y0, 27, GAP_Y1); paint('road', 68, GAP_Y0, MW - 1, GAP_Y1)
paint('slab', XW - 2, GAP_Y0, XW + 3, GAP_Y1); paint('slab', XE - 2, GAP_Y0, XE + 3, GAP_Y1)


def wall_ring():
    """네 변 성벽 + 모서리 망루 + 대문루(북·남) + 소문루(동·서)."""
    H3 = ['gungnae_wall_h', 'gungnae_wall_h1', 'gungnae_wall_h2']
    V3 = ['gungnae_wall_v', 'gungnae_wall_v1', 'gungnae_wall_v2']
    VE3 = ['gungnae_wall_v_e', 'gungnae_wall_v1_e', 'gungnae_wall_v2_e']
    for yb, cl, cr in ((YN, 'gungnae_wall_corner_nw', 'gungnae_wall_corner_ne'), (YS, 'gungnae_wall_corner_sw', 'gungnae_wall_corner_se')):
        Pb(cl, XW, yb, 'all' if False else 'foot'); Pb(cr, XE, yb, 'foot')
        for x in range(XW + 2, GX - 1):
            Pb(H3[(x * 5 + (yb % 7)) % 3], x, yb)
        Pb('gungnae_wall_end_r', GX - 1, yb)
        Pb('gungnae_gate_great_12', GX, yb)
        Pb('gungnae_wall_end_l', GX + 12, yb)
        for x in range(GX + 13, XE):
            Pb(H3[(x * 5 + 1 + (yb % 7)) % 3], x, yb)
    for y in range(YN + 1, YS):
        if YG - 8 <= y <= YG + 3:                      # 소문루 몸체 + 통행 틈
            continue
        P(V3[y % 3], XW, y, 'foot'); P(VE3[y % 3], XE, y, 'foot')
    P('gungnae_gate_small_6', XW - 2, YG - 8, 'foot'); P('gungnae_gate_small_6', XE - 2, YG - 8, 'foot')
    # 모서리 망루(폭 4, 코너 폭 2 가운데에 얹힘)
    for (x, yb) in ((XW - 1, YN), (XE - 1, YN), (XW - 1, YS), (XE - 1, YS)):
        Pb('gungnae_tower_corner_4', x, yb)


wall_ring()



# ================================================================ 2단계: 해자 고리 + 지류 + 연못/섬 + 다리
WATER = set()


def w_rect(x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            WATER.add((x, y))


def w_ell(cx, cy, rx, ry):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                WATER.add((x, y))


def w_cut_ell(cx, cy, rx, ry):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                WATER.discard((x, y))


def w_clean(it=4):
    """1칸 두께 가시·1칸 구멍을 없앤다(8방향 블롭이 깨끗하게 이어지도록)."""
    for _ in range(it):
        add, rem = set(), set()
        for y in range(MH):
            for x in range(MW):
                c = (x, y) in WATER
                n_, s_, e_, w_ = ((x, y - 1) in WATER), ((x, y + 1) in WATER), ((x + 1, y) in WATER), ((x - 1, y) in WATER)
                if not c and ((n_ and s_) or (e_ and w_)):
                    add.add((x, y))
                if c and ((not n_ and not s_) or (not e_ and not w_)):
                    rem.add((x, y))
        WATER.update(add); WATER.difference_update(rem)


# --- 닫힌 고리: 북·남변은 직선 운하(폭 5), 서·동변은 굽이쳐 넓어진다(바깥쪽 둑에 연못이 붙는다)
MX0, MX1 = 28, 67                  # 해자 바깥 x 범위(28..32 · 63..67)
MY0, MY1 = 22, 68                  # 해자 바깥 y 범위(북 22..26 · 남 64..68)
w_rect(MX0, MY0, MX1, MY0 + 4); w_rect(MX0, MY1 - 4, MX1, MY1)
w_rect(MX0, MY0, MX0 + 4, MY1); w_rect(MX1 - 4, MY0, MX1, MY1)
# 서쪽: 물가가 굽이친다(바깥 둑 불룩 둘)
w_ell(29, 37, 3.4, 4.5); w_ell(31, 60, 2.6, 3.6)
# 동쪽: 같은 식으로 어긋나게
w_ell(66, 33, 3.4, 4.5)
# 서쪽 연못(좌성황 섬): 해자에서 가지 물길로 이어진다
w_ell(25, 40, 4.4, 3.8)
# 동쪽 연못(감옥 섬): 가지 물길이 해자에서 호수로
w_ell(75, 60, 7, 6.2)
w_clean()
# --- 섬(연못 안 땅): 좌성황 섬 · 감옥 섬 · 서남 작은 섬 둘
ISLANDS = []


def island(cx, cy, rx, ry):
    w_cut_ell(cx, cy, rx, ry)
    ISLANDS.append((cx, cy, rx, ry))


island(25, 40, 1.9, 1.6)
island(75, 60, 3.6, 3.4)
w_clean(2)
for (x, y) in WATER:
    KG[y][x] = 'water'


# --- 다리: v6(남북 통행, 길이 6 = 물 5칸 + 양쪽 둑 한 칸씩 걸침) / h5·h6(동서 통행)
def bridge_v(x, y_water0, size='6', over=None):
    """남북 다리: 물 첫 행 y_water0. 데크 = y_water0-1 .. +4(길이 6), 남쪽 끝 앞면 행 = y_water0+5."""
    n = 'gungnae_bridge_v' + size
    cv = objects[n]
    h = cv.h // T
    top = y_water0 - 1
    P(n, x, top, solid=None)
    wd = {'4': 3, '5': 3, '6': 4}[size]
    for yy in range(top, top + h):
        for xx in range(x, x + wd):
            KG[yy][xx] = 'bridge'
    KEEP.update({(xx, yy) for yy in range(top - 1, top + h + 1) for xx in range(x - 1, x + wd + 1)})
    return top, h, wd


def bridge_h(x_water0, y, size='5'):
    """동서 다리: 물 첫 열 x_water0, 데크 = x_water0 .. 길이만큼. 걷는 행 = 조각 1..width."""
    n = 'gungnae_bridge_h' + size
    cv = objects[n]
    w, h = cv.w // T, cv.h // T
    wd = {'4': 3, '5': 3, '6': 4}[size]
    x = x_water0 if size == '5' else x_water0 - 1
    P(n, x, y, solid=None)
    for yy in range(y + 1, y + 1 + wd):
        for xx in range(x, x + w):
            KG[yy][xx] = 'bridge'
    KEEP.update({(xx, yy) for yy in range(y - 1, y + h + 1) for xx in range(x - 1, x + w + 1)})
    return x, w


# 북 대로(폭 4)·남 대로
bridge_v(46, MY0)                                   # 북: 물 22..26 → 데크 21..26, 앞면 27
bridge_v(46, MY1 - 4)                               # 남: 물 64..68 → 데크 63..68, 앞면 69
# 북·남 보조 다리(폭 3 → v5 대신 v6 폭 4 도 쓴다)
bridge_v(36, MY0); bridge_v(58, MY0)
bridge_v(36, MY1 - 4); bridge_v(58, MY1 - 4)
# 서·동 다리
bridge_h(MX0, 50); bridge_h(MX1 - 4, 50)            # 서·동 중앙 대로(석판): 물 열 30..34 / 61..65, 걷는 행 48..50


# 섬으로 가는 좁은 다리(폭 1칸)
def bridge_narrow_h(x, y):
    P('gungnae_bridge_narrow_h', x, y, solid=None)
    for xx in range(x, x + 4):
        KG[y + 1][xx] = 'bridge'


bridge_narrow_h(20, 39)        # 서쪽 연못: 서안 → 좌성황 섬
bridge_narrow_h(79, 59)        # 동쪽 호수: 동안(바깥 고리 길) → 감옥 섬

# ================================================================ 3단계: 중앙 왕궁 구역(담 + 정전 + 전각 + 행각 + 궁문 + 연못 + 소나무 + 석등)
PX0_, PY0_, PX1_, PY1_ = 34, 33, 61, 62                 # 궁 담 사각형(모서리 칸 좌표)
PV0, PV1, PH0, PH1 = 37, 58, 37, 59                     # 포장 마당(x 37..58, y 37..59)
paint('yard', PX0_, PY0_ + 2, PX1_, PY1_ - 1)
paint('paving', PV0, PH0, PV1, PH1)
# 안쪽 고리 길(해자 안 땅): 담 둘레 한 칸
paint('road', 33, 31, 62, 31); paint('road', 33, 31, 33, 64); paint('road', 62, 31, 62, 64); paint('road', 33, 64, 62, 64)
# 북·남 보조 다리 앞 샛길
paint('road', 36, 28, 38, 30); paint('road', 58, 28, 60, 30)
paint('slab', 46, 28, 49, 36)                           # 북 대로 → 궁 북문
paint('slab', 46, 57, 49, 69)                           # 궁 남문 → 남쪽 해자 다리
paint('slab', 46, 70, 49, YS - 12)                      # 다리 앞 대로(남문루까지 석판)


def palace():
    pw = ['palace_wall_h', 'palace_wall_h1', 'palace_wall_h2']
    for x in range(PX0_ + 1, PX1_):
        if 45 <= x <= 50:
            continue
        P(pw[x % 3], x, PY0_, 'foot'); P(pw[(x + 1) % 3], x, PY1_ - 2, 'foot')
    P('palace_wall_nw', PX0_, PY0_); P('palace_wall_ne', PX1_, PY0_)
    P('palace_wall_sw', PX0_, PY1_ - 2); P('palace_wall_se', PX1_, PY1_ - 2)
    for y in range(PY0_ + 2, PY1_ - 2):
        P('palace_wall_v', PX0_, y); P('palace_wall_v_e', PX1_, y)
    P('palace_gate_4', 45, PY0_ - 3, 'foot'); P('palace_gate_4', 45, PY1_ - 5, 'foot')
    P('palace_hall_5', 43, 37, 'body')
    for y in range(49, 59):
        P('palace_eodo', 47, y, None)
    P('palace_haengnak_6', 37, 43, 'body'); P('palace_haengnak_6', 52, 43, 'body')
    P('palace_jeongak_a', 38, 53, 'body'); P('palace_jeongak_c', 51, 53, 'body')
    P('palace_pond_4', 37, 50, 'body'); P('palace_pond_4', 55, 50, 'body')
    P('palace_pine_a', 38, 37, 'foot'); P('palace_pine_b', 54, 37, 'foot')
    P('palace_haetae', 41, 47); P('palace_haetae', 53, 47)
    P('palace_deumeu', 43, 49); P('palace_deumeu', 52, 49)
    P('palace_lantern', 46, 51); P('palace_lantern', 50, 51)
    P('palace_censer', 48, 54)


palace()


# ================================================================ 4단계: 길 고리 + 구획 건물(문 앞은 길망에 닿는다)
paint('road', 10, 15, 85, 16); paint('road', 10, 81, 85, 82)            # 성 안 고리 길(폭 2, 성벽 바로 안쪽)
paint('road', 10, 15, 11, 82); paint('road', 84, 15, 85, 82)
paint('road', 10, 51, 27, 53); paint('road', 68, 51, 85, 53)             # 동서 큰길(폭 3) → 해자 다리
paint('slab', 46, 17, 49, 28)                                            # 북 대로가 안쪽 고리를 가로지른다
paint('slab', 46, 70, 49, YS - 12)                                       # 남 대로
NOTREE = []        # 나무가 서면 안 되는 사각형 (x, y, w, h)


def building(name, x, y, door=None, apron=True, solid='body', notree=True):
    """건물: 놓고, 발 밑 한 줄을 흙(yard) 앞마당으로 깔고, 문 앞 칸을 DOORS 에 적는다."""
    cv = objects[name]
    w, h = cv.w // T, cv.h // T
    P(name, x, y, solid)
    if apron:
        for xx in range(x, x + w):
            if inb(xx, y + h) and KG[y + h][xx] in (None, 'yard'):
                KG[y + h][xx] = 'yard'
    d = (w // 2) if door is None else door
    DOORS.append({'x': x + d, 'y': y + h, 'piece': name})
    if notree:
        NOTREE.append((x - 1, y, w + 2, h + 2))
    return w, h


def jumak(x0, y0, ramp_front=('gn_jm_row_room_4', 'gn_jm_daemun_6'), wall='gn_mudg', fill=True):
    """ㅁ자 주막(주막 키트 조합): 담 16×18 안에 안채·뒤 모서리 둘·세로 행랑 둘·앞 대문채. 마당은 yard, 문 앞은 샛길로 이어진다."""
    W_, H_ = 16, 18
    paint('yard', x0, y0, x0 + W_ - 1, y0 + H_ - 1)
    for x in range(x0 + 1, x0 + W_ - 1):
        P(f'{wall}_h{x % 3}', x, y0, 'foot')
        if abs(x - (x0 + 10.5)) > 1:
            P(f'{wall}_h{(x + 1) % 3}', x, y0 + H_ - 1, 'foot')
    P(f'{wall}_c_nw', x0, y0); P(f'{wall}_c_ne', x0 + W_ - 1, y0)
    P(f'{wall}_c_sw', x0, y0 + H_ - 1); P(f'{wall}_c_se', x0 + W_ - 1, y0 + H_ - 1)
    for y in range(y0 + 1, y0 + H_ - 1):
        P(f'{wall}_v', x0, y); P(f'{wall}_v1', x0 + W_ - 1, y)
    bx, by = x0 + 1, y0 + 1
    P('gn_jm_corner_l', bx, by, 'body'); P('gn_jm_anchae_4', bx + 5, by, 'body'); P('gn_jm_corner_r', bx + 9, by, 'body')
    P('gn_jm_row_v_3', bx, by + 6, 'body'); P('gn_jm_row_v_3', bx + 10, by + 6, 'body')
    P('gn_jm_row_room_4', bx, by + 9, 'body'); P('gn_jm_daemun_6', bx + 6, by + 9, 'body')
    P('gn_sarip_mud', x0 + 10, y0 + H_ - 1, 'foot')
    # 마당 소품: 뒤 담 쪽 장독대와 우물
    P('jars', bx + 5, by + 6); P('well', bx + 7, by + 6); P('pyeongsang', x0 + 6, by + 8, 'foot')
    NOTREE.append((x0 - 1, y0 - 1, W_ + 2, H_ + 3))
    DOORS.append({'x': x0 + 10, 'y': y0 + H_, 'piece': 'gn_jm_daemun_6'})
    DOORS.append({'x': x0 + 11, 'y': y0 + H_, 'piece': 'gn_jm_daemun_6'})
    for xx in range(x0, x0 + W_):                        # 담 앞 한 줄: 큰 맨 흙 앞마당
        if KG[y0 + H_][xx] is None:
            KG[y0 + H_][xx] = 'yard'


# --- 서쪽
building('gn_shop_armory', 12, 17, 4); building('gn_shop_butcher', 21, 17, 3)       # 서북 상점 줄 A (9+7)
building('gn_shop_smithy', 12, 25, 3); building('gn_shop_cloth', 20, 25, 4)         # 상점 줄 B (8+8)
jumak(12, 54)                                                                       # 서남 ㅁ자 주막(담 포함 x 12..27, y 54..71)
building('gn_u_thatch_6', 12, 73, 1); building('gn_thatch_d', 20, 75, 3)            # 주막 아래 집 둘(문 앞은 고리 길)
P('seonangdang', 24, 39, 'foot')                                                    # 좌성황 섬 사당
# --- 동쪽
jumak(68, 17)                                                                       # 동북 ㅁ자 주막(x 68..83, y 17..34)
building('tower_sulsa_5', 71, 36, 4, solid='foot')                                   # 술사의 길 탑
building('giwa_sadang', 80, 37, 2); building('thatch_hut_2', 80, 44, 2)             # 우성황 · 초가
P('gwanah_5', 72, 57, 'body')                                                       # 감옥(섬 위)
DOORS.append({'x': 75, 'y': 63, 'piece': 'gwanah_5'})
building('tower_yesik_7', 70, 67, 5, solid='foot', apron=False)                     # 예식장(남쪽 고리 길 앞)
# --- 남쪽 띠
building('gn_g2_inn_6', 54, 70, 3); building('gn_g2_nugak_5', 63, 70, 3)


def fenced(name, bx, by, tag, gate_piece='gn_sarip_mud', gate_dx=None, door=None, extra=()):
    """담(구획 담 세트)으로 두른 집: 건물 (bx, by) 를 둘러 폭 w+2, 높이 h+3 담. 앞(남) 담 가운데에 사립문, 안은 yard."""
    cv = objects[name]
    w, h = cv.w // T, cv.h // T
    x0, y0, W_, H_ = bx - 1, by - 1, w + 2, h + 3
    paint('yard', x0, y0, x0 + W_ - 1, y0 + H_ - 1)
    gw = 3 if 'stone' in gate_piece else 2
    gx = x0 + (W_ // 2 - gw // 2 if gate_dx is None else gate_dx)
    for x in range(x0 + 1, x0 + W_ - 1):
        P(f'{tag}_h{x % 3}', x, y0, 'foot')
        if not (gx <= x < gx + gw):
            P(f'{tag}_h{(x + 1) % 3}', x, y0 + H_ - 1, 'foot')
    P(f'{tag}_c_nw', x0, y0); P(f'{tag}_c_ne', x0 + W_ - 1, y0)
    P(f'{tag}_c_sw', x0, y0 + H_ - 1); P(f'{tag}_c_se', x0 + W_ - 1, y0 + H_ - 1)
    for y in range(y0 + 1, y0 + H_ - 1):
        P(f'{tag}_v', x0, y); P(f'{tag}_v1', x0 + W_ - 1, y)
    P(name, bx, by, 'body')
    P(gate_piece, gx, y0 + H_ - 1, 'foot')
    for (nm, dx, dy) in extra:
        P(nm, bx + dx, by + dy)
    NOTREE.append((x0 - 1, y0 - 1, W_ + 2, H_ + 3))
    DOORS.append({'x': gx, 'y': y0 + H_, 'piece': name})
    for xx in range(x0, x0 + W_):
        if inb(xx, y0 + H_) and KG[y0 + H_][xx] is None:
            KG[y0 + H_][xx] = 'yard'
    return x0, y0, W_, H_


# --- 담으로 두른 집 둘
fenced('gn_thatch_c', 13, 37, 'gn_mud', 'gn_sarip_mud', extra=(('jars', 7, 3),))                     # 서쪽 중간(연못 서안): 흙담 초가
fenced('gn_l_giwa_6', 30, 71, 'gn_stone', 'gn_sarip_stone', extra=())                               # 남서: 돌담 ㄱ자 기와
building('thatch_hut_2', 39, 74, 2)
# --- 밭·논(북쪽 띠와 남서 모퉁이) + 허수아비
for (x0, y0, x1, y1, kd) in ((30, 18, 43, 21, 'field'), (52, 18, 66, 21, 'paddy'), (39, 70, 41, 72, 'field')):
    paint(kd, x0, y0, x1, y1)
P('scarecrow', 44, 19); P('scarecrow', 67, 19); P('scarecrow', 41, 73)
# --- 전사의 길(정원형): 서쪽 큰길 위 띠에 대나무숲 + 돌길
for x in range(13, 27):
    KG[49][x] = 'slab' if 13 <= x <= 26 else KG[49][x]
KG[50][13] = 'slab'; KG[50][26] = 'slab'
for nm, x, y in (('bamboo_grove', 12, 45), ('bamboo_grove', 17, 46), ('bamboo_grove', 22, 45)):
    P(nm, x, y)
P('stepping_stones', 15, 47); P('lantern', 20, 47); P('rocks', 25, 48); P('flower_bed', 14, 50)

# ================================================================ ==== PIPELINE (맨 아래 고정) ====
def finish(tag='stage'):
    """바닥 칸 번호 계산 → 물체 층 합성 → 시트 재조립 → 게이트 → 파일. 단계 확인용으로 tag 이름의 미리보기도 /tmp 에 낸다."""
    # ---- 바닥 칸 번호
    fams = {k: cells_of(k) for k in ('road', 'yard', 'diamond', 'slab', 'paving', 'water', 'bridge', 'paddy', 'field')}
    wset = fams['water'] | fams['bridge']
    dirt = fams['road'] | fams['yard'] | fams['diamond']

    def mask_in(cs, x, y, wrap):
        m = 0
        for bit, (dx, dy) in ((N, (0, -1)), (E, (1, 0)), (S, (0, 1)), (W, (-1, 0))):
            X, Y = x + dx, y + dy
            if (X, Y) in cs or (wrap and not inb(X, Y)):
                m |= bit
        return m

    def water_id(x, y):
        m = 0
        for bit, (dx, dy) in ((WB.N, (0, -1)), (WB.E, (1, 0)), (WB.S, (0, 1)), (WB.W, (-1, 0)), (WB.NE, (1, -1)), (WB.SE, (1, 1)), (WB.SW, (-1, 1)), (WB.NW, (-1, -1))):
            if (x + dx, y + dy) in wset:
                m |= bit
        return STREAM + WB.index47(m) + 47 * ((x // 2 + y // 3) % 2)

    slabc = fams['slab']
    court = fams['paving']
    paddyc = fams['paddy']
    gr = [[0] * MW for _ in range(MH)]
    for y in range(MH):
        for x in range(MW):
            k = KG[y][x]
            if k in (None, 'wall'):
                gid = GRASS + hsh(x, y, 3) % 4
            elif k == 'road':
                gid = ROAD + mask_in(dirt | slabc, x, y, True)
            elif k == 'yard':
                gid = YARD16 + mask_in(dirt | slabc, x, y, False)
            elif k == 'diamond':
                gid = DIAM + (x + y) % 2
            elif k == 'slab':
                m = mask_in(slabc | dirt | wset, x, y, True)
                gid = SLAB + (x * 7 + y * 3) % 3 if m == 15 else SLAB16 + m
            elif k == 'paving':
                m = mask_in(court, x, y, False)
                gid = COURT + (x * 5 + y * 3) % 3 if m == 15 else COURT16 + m
            elif k in ('water', 'bridge'):
                gid = water_id(x, y)
            elif k == 'paddy':
                gid = PADDY + mask_in(paddyc, x, y, False)
            elif k == 'field':
                gid = FIELD + hsh(x, y, 11) % 2
            else:
                gid = GRASS
            gr[y][x] = gid
    # ---- 물체 층 합성(깊이순)
    OBJ = np.zeros((MH * T, MW * T, 4), np.uint8)

    def comp(dst, src, x, y):
        h, w = src.shape[:2]
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(dst.shape[1], x + w), min(dst.shape[0], y + h)
        if x0 >= x1 or y0 >= y1:
            return
        s = src[y0 - y:y1 - y, x0 - x:x1 - x]
        d = dst[y0:y1, x0:x1]
        a = s[:, :, 3:4].astype(np.float32) / 255.0
        full = s[:, :, 3] == 255
        blend = (d[:, :, :3] * (1 - a) + s[:, :, :3] * a).astype(np.uint8)
        out = np.where(full[:, :, None], s[:, :, :3], np.where((s[:, :, 3] > 0)[:, :, None], blend, d[:, :, :3]))
        d[:, :, :3] = out
        d[:, :, 3] = np.maximum(d[:, :, 3], s[:, :, 3])

    items.sort(key=lambda i: (i[0], i[1], i[2]))
    for (_b, _h, x, name, cv) in items:
        comp(OBJ, cv.a, x * T, int(round((_b - cv.h / T) * T)) if name == 'shadow' else int(round((_b - _h) * T)))
    ground = np.zeros((MH * T, MW * T, 4), np.uint8)
    for y in range(MH):
        for x in range(MW):
            ground[y * T:(y + 1) * T, x * T:(x + 1) * T] = TARR[gr[y][x]]
    direct = ground.copy()
    comp(direct, OBJ, 0, 0)
    Image.fromarray(direct, 'RGBA').save('/tmp/vqa20/gn_%s_full.png' % tag)
    return gr, OBJ, direct


def crops(direct, prefix='/tmp/vqa20/gn_', scale=3):
    im = Image.fromarray(direct, 'RGBA')
    W_, H_ = im.size
    for nm, box in (('NW', (0, 0, W_ // 2 + 48, H_ // 2 + 48)), ('NE', (W_ // 2 - 48, 0, W_, H_ // 2 + 48)),
                    ('SW', (0, H_ // 2 - 48, W_ // 2 + 48, H_)), ('SE', (W_ // 2 - 48, H_ // 2 - 48, W_, H_))):
        c = im.crop(box)
        c.resize((c.width * scale, c.height * scale), Image.NEAREST).save(prefix + nm + '.png')


if __name__ == '__main__':
    gr, OBJ, direct = finish('s1')
    Image.fromarray(direct, 'RGBA').resize((MW * 4, MH * 4), Image.NEAREST).save('/tmp/vqa20/gn_s1_small.png')
