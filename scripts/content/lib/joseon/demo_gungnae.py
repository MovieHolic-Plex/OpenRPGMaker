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
for _k in ('road16', 'yard16', 'water47g', 'water_deep', 'rice16', 'slab', 'slab_edge16', 'slab_dirt', 'diamond', 'palace_court', 'palace_court16'):
    add_group(_k, terr[_k])
    pad_row()
TID = {k: pieces[k]['id'] for k in pieces}
GRASS, YARD, ROAD, YARD16, STREAM, PADDY = TID['grass'], TID['yard'], TID['road16'], TID['yard16'], TID['water47g'], TID['rice16']
DEEP = TID['water_deep']
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
                if KG[y][x] in ('bridge', 'water') and kind not in ('bridge', 'water'):
                    continue                       # 물·다리 칸은 길·석판이 덮지 않는다(다리 홍예 밑이 물이어야 한다)
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
XW, XE = 7, 86                 # 서·동 성벽 왼쪽 칸(폭 3: 7..9 · 86..88)
YN, YS = 14, 87                # 북·남 성벽 발 행(그림은 위로 5칸)
GX = 42                        # 대문루 왼쪽 칸(폭 12 → 42..53, 가운데 x=48.0)
YG = 50                        # 동·서 소문루 발 행(그림 9칸: 42..50)
IN_X0, IN_X1, IN_Y0, IN_Y1 = XW + 3, XE - 1, YN + 1, YS - 5      # 성 안 칸 범위(10..85, 15..82)
CX = 48                        # 중심 경계선 x

# --- 바깥 흙길 고리(폭 2) · 바깥 숲띠는 나무로(아래)
paint('road', 0, 0, MW - 1, 1); paint('road', 0, MH - 2, MW - 1, MH - 1)
paint('road', 0, 0, 1, MH - 1); paint('road', MW - 2, 0, MW - 1, MH - 1)
# --- 성벽 밑(막힘)
paint('wall', XW, YN - 4, XE + 2, YN); paint('wall', XW, YS - 4, XE + 2, YS)
paint('wall', XW, YN, XW + 2, YS); paint('wall', XE, YN, XE + 2, YS)
# --- 북·남 대문 통로 + 석판 대로(폭 4: 46..49)
paint('slab', 46, 2, 49, YN)                                                   # 북문 아래(문루 그림이 덮는다) + 문 앞
paint('slab', 46, YN + 1, 49, 28)                                              # 북문 → 해자 다리 앞(다리 데크가 21..27 을 덮는다)
paint('slab', 46, YS - 12, 49, YS + 6)                                         # 남문(그림 덮음)·성 안 앞·성 밖 대로
# --- 동·서 측면 문루 통로(성벽을 동서로 가로지르는 길, 폭 4: 행 46..49 = 궁 가운데 축)
GATE_Y0, GATE_Y1 = 39, 49                          # 측면 문루 그림이 덮는 행(위 지붕 7 · 통로 4)
GAP_Y0, GAP_Y1 = 46, 49
paint('road', 0, GAP_Y0, 27, GAP_Y1); paint('road', 68, GAP_Y0, MW - 1, GAP_Y1)
paint('slab', XW - 1, GAP_Y0, XW + 3, GAP_Y1); paint('slab', XE - 1, GAP_Y0, XE + 3, GAP_Y1)


def wall_ring():
    """네 변 성벽 + 모서리 망루 + 대문루(북·남) + 측면 문루(동·서)."""
    H3 = ['gungnae_wall_h', 'gungnae_wall_h1', 'gungnae_wall_h2']
    V3 = ['gungnae_wall_v', 'gungnae_wall_v1', 'gungnae_wall_v2']
    VE3 = ['gungnae_wall_v_e', 'gungnae_wall_v1_e', 'gungnae_wall_v2_e']
    for yb, cl, cr in ((YN, 'gungnae_wall_corner_nw', 'gungnae_wall_corner_ne'), (YS, 'gungnae_wall_corner_sw', 'gungnae_wall_corner_se')):
        Pb(cl, XW, yb, 'foot'); Pb(cr, XE, yb, 'foot')
        for x in range(XW + 3, XE):                    # 성벽은 대문 밑까지 이어 깐다(문 기단의 기울어진 옆면 뒤로 돌이 비친다)
            Pb(H3[(x * 5 + (yb % 7)) % 3], x, yb)
        Pb('gungnae_gate_great_12', GX, yb, None)
        for xx in list(range(GX, GX + 4)) + list(range(GX + 8, GX + 12)):
            BODY.add((xx, yb))
    for y in range(YN + 1, YS):
        if GATE_Y0 <= y <= GATE_Y1:                     # 측면 문루 몸체 + 통로
            continue
        P(V3[y % 3], XW, y, 'foot'); P(VE3[y % 3], XE, y, 'foot')
    for gx in (XW - 1, XE - 1):
        P('gungnae_gate_side_5', gx, GATE_Y0, None)
        for yy in range(GATE_Y0, GAP_Y0):
            for xx in range(gx + 1, gx + 4):
                BODY.add((xx, yy))
    # 모서리 망루(폭 4: 성벽 바깥으로 한 칸 나온다)
    for (x, yb) in ((XW - 1, YN), (XE, YN), (XW - 1, YS), (XE, YS)):
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


# --- 닫힌 고리: 폭 5 의 해자. 궁 담(+안쪽 고리 길)과 물 사이 여유는 남·북이 같다(4칸). 기슭은 굽이친다:
#     안쪽 기슭은 군데군데 한 칸 물러서고(폭 4), 바깥 기슭은 둥글게 부풀어 폭 6~8 이 된다. 다리 앞뒤는 폭 5 를 지킨다(다리 길이가 6).
MX0, MX1 = 28, 67                  # 해자 바깥 x 범위(28..32 · 63..67)
MY0, MY1 = 24, 71                  # 해자 바깥 y 범위(북 24..28 · 남 67..71)
w_rect(MX0, MY0, MX1, MY0 + 4); w_rect(MX0, MY1 - 4, MX1, MY1)
w_rect(MX0, MY0, MX0 + 4, MY1); w_rect(MX1 - 4, MY0, MX1, MY1)
# 바깥 기슭 불룩(다리 자리 x 35..40 · 45..50 · 57..62, 서·동 다리 행 44..51 은 피한다)
for (cx, cy, rx, ry) in ((29, 36, 3.6, 4.6), (30, 60, 2.8, 3.8), (29, 29, 2.4, 2.6),
                         (41.5, 24.5, 3.2, 2.4), (54, 25, 3.4, 2.6), (66, 30, 2.4, 3.4), (66.5, 62, 2.6, 3.6),
                         (38, 70.5, 3.6, 2.6), (56, 70.5, 3.4, 2.6), (65, 67, 2.4, 2.4)):
    w_ell(cx, cy, rx, ry)
# 안쪽 기슭 물러남(폭 4): 서·동 x=32/63 열, 북·남 y=28/67 행
for y in list(range(33, 41)) + list(range(55, 62)):
    WATER.discard((MX0 + 4, y))
for y in list(range(31, 38)) + list(range(57, 64)):
    WATER.discard((MX1 - 4, y))
for x in list(range(31, 35)) + list(range(52, 57)):
    WATER.discard((x, MY0 + 4))
for x in list(range(42, 45)) + list(range(33, 36)) + list(range(52, 58)):
    WATER.discard((x, MY1 - 4))
# 서쪽 연못(좌성황 섬): 해자에서 떨어진 못
w_ell(25, 40, 5.0, 4.2)
# 동쪽 큰 호수(감옥 섬 · 도사의 길 섬): 해자 동변과 이어져 한 덩이 물이 된다
w_ell(75, 58.5, 8.6, 7.0)
w_clean()
# --- 섬(연못 안 땅): 좌성황 섬 · 감옥 섬 · 도사의 길 섬
ISLANDS = []


def island(cx, cy, rx, ry):
    w_cut_ell(cx, cy, rx, ry)
    ISLANDS.append((cx, cy, rx, ry))


island(25, 40, 2.0, 1.7)
island(75, 57.5, 4.5, 3.8)
island(80.5, 54.5, 1.9, 1.5)
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
# 서·동 다리
bridge_h(MX0, 45, '6'); bridge_h(MX1 - 4, 45, '6')    # 서·동 중앙 다리(폭 4): 걷는 행 46..49 = 궁 가운데 축


# 섬으로 가는 좁은 다리(폭 1칸)
def bridge_narrow_h(x, y, length=4):
    P('gungnae_bridge_narrow_h' + ('' if length == 4 else str(length)), x, y, solid=None)
    for xx in range(x, x + length):
        KG[y + 1][xx] = 'bridge'


bridge_narrow_h(19, 39, 5)     # 서쪽 연못: 서안 → 좌성황 섬
bridge_narrow_h(78, 60, 6)     # 동쪽 호수: 동안(고리 길) → 감옥 섬 남쪽 길(걷는 행 61)

# ================================================================ 3단계: 중앙 왕궁 구역(담 + 정전 + 전각 + 행각 + 궁문 + 연못 + 소나무 + 석등)
PX0_, PY0_, PX1_, PY1_ = 34, 33, 61, 62                 # 궁 담 사각형(모서리 칸 좌표)
PV0, PV1, PH0, PH1 = 37, 58, 37, 59                     # 포장 마당(x 37..58, y 37..59)
paint('yard', PX0_, PY0_ + 2, PX1_, PY1_ - 1)
paint('paving', PV0, PH0, PV1, PH1)
# 안쪽 고리 길(해자 안 땅): 담 둘레 한 칸
paint('road', 33, 31, 62, 31); paint('road', 33, 31, 33, 63); paint('road', 62, 31, 62, 63); paint('road', 33, 63, 62, 63)
# 북·남 보조 다리 앞 샛길
paint('road', 36, 29, 39, 30); paint('road', 58, 29, 61, 30)
paint('slab', 46, 28, 49, 36)                           # 북 대로 → 궁 북문
paint('slab', 46, 57, 49, 69)                           # 궁 남문 → 남쪽 해자 다리
paint('slab', PX0_, 46, PV0 - 1, 49); paint('slab', PV1 + 1, 46, PX1_, 49)     # 서·동 궁문 안쪽 길(문 → 포장 마당)
paint('slab', 46, 70, 49, YS - 12)                      # 다리 앞 대로(남문루까지 석판)


def palace():
    pw = ['palace_wall_h', 'palace_wall_h1', 'palace_wall_h2']
    for x in range(PX0_ + 1, PX1_):
        P(pw[x % 3], x, PY0_, 'foot'); P(pw[(x + 1) % 3], x, PY1_ - 2, 'foot')
    P('palace_wall_nw', PX0_, PY0_); P('palace_wall_ne', PX1_, PY0_)
    P('palace_wall_sw', PX0_, PY1_ - 2); P('palace_wall_se', PX1_, PY1_ - 2)
    for y in range(PY0_ + 2, PY1_ - 2):
        if 39 <= y <= 49:                                # 서·동 측면 궁문 자리
            continue
        P('palace_wall_v', PX0_, y); P('palace_wall_v_e', PX1_, y)
    for gx in (PX0_ - 1, PX1_ - 1):                      # 서·동 궁문: 담을 가로질러 길이 동서로 지난다(행 46..49)
        P('palace_gate_side_3', gx, 39, None)
        for yy in range(39, 46):
            BODY.add((gx + 1, yy))
    for gy in (PY0_ - 3, PY1_ - 5):                      # 북·남 궁문(담이 문 기둥 곁까지 이어진다: 문 뒤로 담을 깐다)
        P('palace_gate_4', 45, gy, None)
        for xx in (45, 46, 49, 50):
            BODY.add((xx, gy + 5))
    # 정전: 넓은 단층 대전 + 낮은 3단 월대(가운데가 칸 경계 x=48). 뒤로 5줄 마당이 남는다.
    P('palace_hall_wide_8', 42, 42, None)
    for yy in range(44, 49):
        for xx in range(43, 53):
            BODY.add((xx, yy))
    for y in range(52, 57):
        P('palace_eodo', 46, y, None)
    P('palace_haenggak_3', 37, 42, 'body'); P('palace_haenggak_3', 54, 42, 'body')
    P('palace_jeongak_a', 38, 53, 'body'); P('palace_jeongak_a', 51, 53, 'body')
    P('palace_pond_4', 37, 49, 'body'); P('palace_pond_4', 55, 49, 'body')
    for x, nm in ((37, 'palace_pine_a'), (41, 'palace_pine_c'), (51, 'palace_pine_b'), (55, 'palace_pine_a')):
        P(nm, x, 36, 'foot')
    P('palace_haetae', 44, 52); P('palace_haetae', 50, 52)
    P('palace_deumeu', 41, 48); P('palace_deumeu', 54, 48)
    P('palace_lantern', 45, 54); P('palace_lantern', 50, 54)


palace()


# ================================================================ 4단계: 길 고리 + 구획 건물(문 앞은 길망에 닿는다)
paint('road', 10, 15, 85, 16); paint('road', 10, 81, 85, 82)            # 성 안 고리 길(폭 2, 성벽 바로 안쪽)
paint('road', 10, 15, 11, 82); paint('road', 84, 15, 85, 82)
paint('road', 10, GAP_Y0, 27, GAP_Y1); paint('road', 68, GAP_Y0, 85, GAP_Y1)  # 동서 큰길(폭 4) → 해자 다리
paint('slab', 46, 17, 49, 28)                                            # 북 대로가 안쪽 고리를 가로지른다
paint('road', 36, 17, 39, 22); paint('road', 58, 17, 61, 22)             # 북 보조 다리 앞 샛길(바깥 고리 길 → 다리)
paint('slab', 46, 70, 49, YS - 12)                                       # 남 대로
# 석판 대로·측면 문 앞 석판을 맨 마지막에 다시 깐다(안쪽 고리 길이 문 아치와 대로 사이를 끊지 않는다)
paint('slab', 46, 2, 49, YN); paint('slab', 46, YN + 1, 49, 36); paint('slab', 46, 57, 49, YS + 6)
paint('slab', XW - 1, GAP_Y0, XW + 3, GAP_Y1); paint('slab', XE - 1, GAP_Y0, XE + 3, GAP_Y1)
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
        NOTREE.append((x - 1, y + h - 1, w + 2, 4))
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
    P('gn_sarip_mud', x0 + 10, y0 + H_ - 1, None)
    for yy in range(by + 9 + 2, by + 9 + 6):                 # 대문채 가운데 통로(문간)는 걸어 지난다
        for xx in (x0 + 10, x0 + 11):
            BODY.discard((xx, yy))
    # 마당 소품: 뒤 담 쪽 장독대와 우물
    P('jars', bx + 5, by + 6); P('well', bx + 7, by + 6); P('pyeongsang', x0 + 6, by + 8, 'foot')
    NOTREE.append((x0 - 1, y0 + H_ - 2, W_ + 2, 5))
    DOORS.append({'x': x0 + 10, 'y': y0 + H_, 'piece': 'gn_jm_daemun_6'})
    DOORS.append({'x': x0 + 11, 'y': y0 + H_, 'piece': 'gn_jm_daemun_6'})
    for xx in range(x0, x0 + W_):                        # 담 앞 한 줄: 큰 맨 흙 앞마당
        if KG[y0 + H_][xx] is None:
            KG[y0 + H_][xx] = 'yard'


# --- 서쪽(x 12..27): 상점은 크기를 섞고 사이를 벌려 듬성듬성 — 큰길(행 46..49)은 비워 둔다
building('gn_shop_armory', 12, 17, 4)                                               # 9×7
building('gn_shop_cloth', 19, 26, 4)                                                # 8×7, 위 상점과 두 줄 떨어뜨림
building('gn_shop_smithy', 12, 35, 3)                                               # 8×7
building('giwa_house_3', 23, 18, 2)                                                 # 상점 옆 기와 민가(두 칸 띄움)
jumak(12, 54)                                                                       # 서남 ㅁ자 주막(담 포함 x 12..27, y 54..71)
building('gn_thatch_b', 13, 74, 2)                                                  # 서남 초가(문 앞은 장터)
paint('yard', 20, 72, 27, 80)                                                       # 서남 주막 앞 큰 맨 흙 마당(장터)
for nm, x, y in (('market_stall_cloth', 21, 76), ('market_stall_pots', 25, 76), ('haystack', 22, 79), ('jars', 26, 79), ('well', 24, 73)):
    P(nm, x, y, 'foot')
P('seonangdang', 24, 39, 'foot')                                                    # 좌성황 섬 사당
# --- 동쪽(x 68..83)
building('giwa_house_3', 69, 37, 2); building('giwa_sadang', 75, 38, 2); building('thatch_hut_2', 80, 38, 2)   # 기와 민가 · 우성황 · 초가(한 칸씩 띄움)
P('gwanah_5', 72, 55, 'body')                                                       # 감옥(섬 위)
DOORS.append({'x': 75, 'y': 61, 'piece': 'gwanah_5'})
for xx in range(73, 78):
    KG[61][xx] = 'yard'                                                             # 섬 남쪽 가장자리 길
building('tower_yesik_7', 72, 66, 5, solid='foot', apron=False)                     # 예식장(호수 남쪽, 고리 길 앞)
paint('field', 68, 66, 71, 70); P('scarecrow', 70, 69)                              # 예식장 서쪽 텃밭
paint('diamond', 68, 80, 83, 82)                                                    # 예식장 앞 마름모 무늬 마당
# --- 남쪽 띠(해자 아래, 행 72..81)
building('gn_l_giwa_6', 28, 72, 4)                                                  # 남서 ㄱ자 기와
building('giwa_house_3', 37, 74, 2)                                                 # 남문 서쪽 민가
building('thatch_hut_2', 67, 72, 2)                                                 # 예식장 서쪽 초가
building('gn_g2_inn_6', 57, 72, 3)                                                  # 남문 동쪽 객주


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
    P(gate_piece, gx, y0 + H_ - 1, None)
    for (nm, dx, dy) in extra:
        P(nm, bx + dx, by + dy)
    NOTREE.append((x0 - 1, y0 + H_ - 2, W_ + 2, 5))
    DOORS.append({'x': gx, 'y': y0 + H_, 'piece': name})
    for xx in range(x0, x0 + W_):
        if inb(xx, y0 + H_) and KG[y0 + H_][xx] is None:
            KG[y0 + H_][xx] = 'yard'
    return x0, y0, W_, H_


# --- 담으로 두른 집: 술사의 길 탑 구획
fenced('tower_sulsa_5', 71, 18, 'gn_stone', 'gn_sarip_stone', extra=())             # x 70..80, y 17..33
# --- 밭·논(북쪽 띠) + 허수아비
for (x0, y0, x1, y1, kd) in ((40, 18, 43, 21, 'field'), (52, 18, 57, 21, 'paddy'), (62, 18, 66, 21, 'paddy')):
    paint(kd, x0, y0, x1, y1)
P('scarecrow', 44, 19); P('scarecrow', 67, 19)
# --- 전사의 길(정원형): 북쪽 띠 서쪽 칸 — 돌길 + 대나무숲 + 석등
for xx in range(29, 36):
    KG[17][xx] = 'slab'
for nm, x, y in (('bamboo_grove', 29, 21), ('bamboo', 34, 21), ('lantern', 33, 19)):
    P(nm, x, y - (objects[nm].h // T) + 1, 'foot')
P('stepping_stones', 31, 18); P('rocks', 35, 20)




# ================================================================ 소품(주인 곁 무리) — 풀 칸에만 놓아 길·앞마당을 막지 않는다
def prop(name, x, yb, kinds=(None,), force=False):
    """소품 (x, 바닥 행 yb). 발 밑 칸이 kinds 이고 건물·물·문 앞 칸이 아니어야 한다."""
    cv = objects[name]
    w, h = cv.w // T, cv.h // T
    doorc = {(d['x'], d['y']) for d in DOORS}
    for xx in range(x, x + w):
        if not inb(xx, yb) or KG[yb][xx] not in kinds or (xx, yb) in BODY or (xx, yb) in doorc:
            return False
    P(name, x, yb + 1 - h, 'foot')
    return True


def beside(bname, cands, side='LR'):
    """건물(placed 에서 이름으로 찾은 첫 항목) 곁에 cands 소품을 하나 놓는다. 오른쪽 → 왼쪽 순."""
    for (nm, x, y, w, h) in placed:
        if nm == bname:
            for pn in cands:
                pw = objects[pn].w // T
                for sx in ([x + w] if 'R' in side else []) + ([x - pw] if 'L' in side else []):
                    if prop(pn, sx, y + h - 1):
                        return pn
            return None
    return None


beside('gn_thatch_b', ['jangdokdae']); beside('gn_l_giwa_6', ['jars'])
beside('giwa_sadang', ['stele', 'sotdae']); beside('giwa_house_3', ['jars', 'jangdokdae'])
beside('gn_g2_inn_6', ['jars', 'jangdokdae'], 'R'); beside('gn_shop_butcher', ['firewood'], 'L')
beside('tower_sulsa_5', ['stone_pagoda', 'lantern'], 'L'); beside('tower_yesik_7', ['lantern', 'sotdae'], 'L')
beside('gn_shop_cloth', ['firewood'], 'R')
for xx, yy, nm in ((45, 20, 'palace_lantern'), (50, 20, 'palace_lantern'), (45, 24, 'palace_lantern'), (50, 24, 'palace_lantern')):
    prop(nm, xx, yy)
for xx, nm in ((44, 'jangseung_m'), (51, 'jangseung_f')):
    prop(nm, xx, 90)                                                                 # 남문 밖

# 해자·연못 기슭: 갈대·돌(풀 칸, 물이 바로 옆, 4칸 간격)
_shore = []
for y in range(IN_Y0, IN_Y1):
    for x in range(IN_X0, IN_X1):
        if KG[y][x] is None and (x, y) not in BODY and any(KG[y + dy][x + dx] == 'water' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            _shore.append((x, y))
_rng0 = __import__('random').Random(5)
_rng0.shuffle(_shore)
_last = []
for (x, y) in _shore:
    if any(abs(x - a) + abs(y - b) < 6 for a, b in _last):
        continue
    if prop('reeds' if (x + y) % 2 == 0 else 'rocks', x, y):
        _last.append((x, y))
    if len(_last) >= 26:
        break

# ================================================================ 5단계: 길 이음(문 앞 → 길망) + 숲띠 + 나무 채움 + 소품
from collections import deque
WALKK = ('road', 'yard', 'slab', 'paving', 'bridge', 'diamond')


def walk_ok(x, y, door=None):
    if not inb(x, y):
        return False
    k = KG[y][x]
    if k in ('water', 'wall'):
        return False
    if (x, y) in BODY and (x, y) != door:
        return False
    return True


def network():
    """바깥 고리 길 (0,0) 에서 길·마당·석판·다리 칸으로 이어지는 연결 성분."""
    seen = {(0, 0)}
    dq = deque([(0, 0)])
    while dq:
        x, y = dq.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n in seen or not inb(*n):
                continue
            if KG[n[1]][n[0]] in WALKK and (n not in BODY or KG[n[1]][n[0]] == 'bridge'):
                seen.add(n); dq.append(n)
    return seen


def carve_lanes():
    """네트워크에 안 닿는 문 앞 칸마다 가장 가까운 네트워크 칸까지 1칸 폭 샛길(흙)을 낸다."""
    net = network()
    carved = 0
    for d in DOORS:
        c = (d['x'], d['y'])
        if not inb(*c):
            continue
        if c in net:
            continue
        # 문 앞 칸에서 풀·마당을 건너 net 에 닿는 최단 경로
        prev = {c: None}
        dq = deque([c])
        goal = None
        while dq and goal is None:
            x, y = dq.popleft()
            for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                n = (x + dx, y + dy)
                if n in prev or not walk_ok(n[0], n[1]):
                    continue
                prev[n] = (x, y)
                if n in net:
                    goal = n; break
                dq.append(n)
        if goal is None:
            continue
        cur = prev[goal]
        while cur is not None:
            if KG[cur[1]][cur[0]] is None:
                KG[cur[1]][cur[0]] = 'road'
            cur = prev[cur]
        carved += 1
        net = network()
    return carved


carve_lanes()

# --- 바깥 숲띠: 줄 맞춰 심은 나무(성벽 밖 6~8칸)
ZEL = ['zelkova_a', 'zelkova_b', 'zelkova_c', 'zelkova_d', 'zelkova_e']
PIN = ['pine_a', 'pine_b', 'pine_c', 'pine_d']
TREEPOS = []                 # (이름, x, 발 행, w, h) — 나무·덤불만


def Tf(name, x, yb):
    cv = objects[name]
    w, h = cv.w // T, cv.h // T
    placed.append((name, x, yb + 1 - h, w, h))
    SH(x, yb + 1 - h, w, h) if name.split('_')[0] in ('zelkova', 'pine', 'persimmon', 'willow', 'small') else None
    items.append((yb + 1, h, x, name, cv))
    TREEPOS.append((name, x, yb, w, h))


_CYC = ['zelkova_a', 'pine_a', 'zelkova_b', 'pine_b', 'zelkova_c', 'pine_c', 'zelkova_d', 'pine_d', 'zelkova_e']


def band_pick(i, j, x=0, yb=0):
    k = (i + 4 * j) % len(_CYC)
    for t in range(len(_CYC)):                       # 같은 그림이 6칸 안에 또 서지 않도록 다음 그림으로 넘긴다
        nm = _CYC[(k + t) % len(_CYC)]
        if not any(n == nm and abs(x - tx) <= 6 and abs(yb - ty) <= 6 for (n, tx, ty, _, _) in TREEPOS):
            return nm
    return _CYC[k]


def forest_band():
    # 북: 발 행 6 · 9 두 줄(엇갈림). 대문루(42..53)·망루(7..10, 85..88) 자리는 비운다.
    for j, (yb, off) in enumerate(((6, -1), (9, 1))):
        for i, x in enumerate(range(off, MW, 4)):
            if 40 <= x <= 53 or (5 <= x <= 11 and yb < 15) or (84 <= x <= 90 and yb < 15):
                continue
            Tf(band_pick(i, j, x, yb), x, yb)
    # 남: 발 행 90(작은 감나무) · 93(큰 나무)
    for j, (yb, off, pool) in enumerate(((93, 0, None), (90, 2, 'p'))):
        for i, x in enumerate(range(off, MW, 4 if pool is None else 5)):
            if 41 <= x <= 52 or (5 <= x <= 11) or (84 <= x <= 90):
                continue
            Tf(band_pick(i, j + 1, x, yb) if pool is None else ('persimmon_a', 'persimmon_b', 'persimmon_c')[i % 3], x, yb)
    # 서·동: 두 줄 지그재그(발 행 2칸 간격). 소문루(6..11 · 84..89) 앞 큰길 구간(발 행 49..55)은 비운다.
    for side, xs in (('W', (2, 3)), ('E', (89, 90))):
        for i, yb in enumerate(range(11, 87, 2)):
            if 41 <= yb <= 54:
                continue
            Tf(band_pick(i, 3 if side == 'W' else 4, xs[i % 2], yb), xs[i % 2], yb)


# (바깥 숲띠는 아래 forest_band2 가 불규칙하게 심는다)

# --- 나무 채움: 풀밭마다 3~5칸당 하나(큰 나무·작은 나무·덤불 섞기, 같은 그림 6칸 안 반복 금지)
import random as _rand
_rng = _rand.Random(int(os.environ.get('JS_SEED', '7')))
NONTREE_RECTS = []            # 건물류(나무 수관이 문·앞마당을 가리면 안 되는 사각형)
for (nm, x, y, w, h) in placed:
    if nm.split('_')[0] not in ('zelkova', 'pine', 'persimmon', 'willow', 'bamboo', 'small', 'bush', 'rocks', 'reeds', 'jars', 'well', 'lantern', 'scarecrow', 'stepping', 'flower', 'sotdae'):
        NONTREE_RECTS.append((x, y, w, h))
BIG = [('zelkova_' + c, 4, 5) for c in 'abcde'] + [('pine_' + c, 4, 5) for c in 'abcd']
MID = [('persimmon_' + c, 3, 4) for c in 'abc'] + [('small_z_a', 2, 3), ('small_z_b', 2, 3), ('small_p', 2, 3)]
BUSH = [('bush_a', 2, 2), ('bush_b', 2, 2), ('bush_c', 2, 2), ('bush_l_a', 3, 2), ('bush_l_b', 3, 2), ('bush_s_a', 2, 1), ('bush_s_b', 2, 1)]
OCC = set()
for (nm, x, yb, w, h) in TREEPOS:
    for xx in range(x, x + w):
        for yy in range(yb - 1, yb + 1):
            OCC.add((xx, yy))


def near_kind(x, y, kinds, d=1):
    return any(inb(x + i, y + j) and KG[y + j][x + i] in kinds for i in range(-d, d + 1) for j in range(-d, d + 1))


_DIRT = ('road', 'yard', 'slab', 'paving', 'diamond', 'bridge', 'wall', 'water', 'paddy', 'field')


def tree_ok(name, w, h, x, yb, dist):
    y = yb + 1 - h
    if x < IN_X0 - 1 or x + w > IN_X1 + 2 or yb < IN_Y0 or yb > IN_Y1:
        return False
    for xx in range(x, x + w):                              # 발 밑은 풀·건물 밖
        if not inb(xx, yb) or KG[yb][xx] is not None or (xx, yb) in BODY:
            return False
        for (nx, ny, nw, nh) in NOTREE:
            if nx <= xx < nx + nw and ny <= yb < ny + nh:
                return False
    for yy in range(max(0, y), yb):                         # 수관 구역이 길·물·다리를 가리지 않는다
        for xx in range(x, x + w):
            if inb(xx, yy) and KG[yy][xx] in _DIRT:
                return False
    for yy in (yb, ):                                       # 발 옆 한 칸이 길이면 뿌리가 길에 닿는다 → 큰 나무만 금지
        if h >= 4 and any(inb(xx, yy) and KG[yy][xx] in ('road', 'yard', 'slab', 'diamond') for xx in (x - 1, x + w)):
            return False
    for (rx, ry, rw, rh) in NONTREE_RECTS:                 # 수관이 건물을 가리는 자리 금지(건물 뒤쪽 발 행은 허용)
        if x < rx + rw and rx < x + w and y < ry + rh and ry < yb + 1:
            if yb >= ry + 2:
                return False
    for xx in range(x - dist, x + w + dist):
        for yy in range(yb - dist, yb + dist + 1):
            if (xx, yy) in OCC:
                return False
    if not name.startswith('bush'):
        if any(n == name and abs(x - tx) <= 6 and abs(yb - ty) <= 6 for (n, tx, ty, _, _) in TREEPOS):
            return False
    return True


def fill_trees(target_dist=2, tries=1, weights=(0.45, 0.33, 0.22)):
    cells = [(x, y) for y in range(IN_Y0, IN_Y1 + 1) for x in range(IN_X0 - 1, IN_X1 + 2) if KG[y][x] is None]
    for _ in range(tries):
        _rng.shuffle(cells)
        for (cx, cy) in cells:
            if KG[cy][cx] is not None or (cx, cy) in OCC:
                continue
            order = _rng.choices([BIG, MID, BUSH], weights=weights, k=3)
            seen_p = []
            for pool in order:
                if pool in seen_p:
                    continue
                seen_p.append(pool)
                cand = list(pool); _rng.shuffle(cand)
                ok = False
                for name, w, h in cand[:4]:
                    x = cx - w // 2
                    if tree_ok(name, w, h, x, cy, target_dist if not name.startswith('bush') else 1):
                        Tf(name, x, cy)
                        for xx in range(x, x + w):
                            for yy in range(cy - 1, cy + 1):
                                OCC.add((xx, yy))
                        ok = True
                        break
                if ok:
                    break


def band_ok(name, w, h, x, yb, region):
    """바깥 숲띠 후보: 풀 칸 위, 다른 나무와 겹치지 않고(1칸 여유), 같은 그림이 6칸 안에 또 서지 않으며, 성벽·망루·문·길 위에 수관이 얹히지 않는다."""
    y = yb + 1 - h
    for xx in range(x, x + w):
        if not inb(xx, yb) or KG[yb][xx] is not None or (xx, yb) in BODY:
            return False
    for yy in range(max(0, y), yb):
        for xx in range(x, x + w):
            if inb(xx, yy) and KG[yy][xx] in _DIRT:
                return False
    for (rx, ry, rw, rh) in NONTREE_RECTS:
        if x < rx + rw and rx < x + w and y < ry + rh and ry < yb + 1:
            return False
    for xx in range(x + 1, x + w - 1):
        for yy in (yb - 1, yb):
            if (xx, yy) in OCC:
                return False
    if not name.startswith('bush'):
        if any(n == name and abs(x - tx) <= 6 and abs(yb - ty) <= 6 for (n, tx, ty, _, _) in TREEPOS):
            return False
    return True


def forest_band2():
    """성벽 밖 숲띠: 격자·한 줄 대신, 후보 칸을 무작위로 돌며 큰 나무·중간 나무·덤불을 섞어 2~3겹으로 심는다(간격·크기·종류가 들쭉날쭉)."""
    rg = _rand.Random(41)
    # (x 범위, 발 행 범위)
    regions = [((2, 93), (7, 9)), ((2, 93), (4, 8)), ((2, 93), (89, 93)), ((2, 93), (90, 93)), ((2, 6), (12, 86)), ((89, 93), (12, 86)), ((2, 6), (12, 86)), ((89, 93), (12, 86))]
    for (xa, xb), (ya, yb_) in regions:
        cells = [(x, y) for y in range(ya, yb_ + 1) for x in range(xa, xb + 1)]
        rg.shuffle(cells)
        for (cx, cy) in cells:
            if (cx, cy) in OCC:
                continue
            pool = rg.choices([BIG, MID, BUSH], weights=(0.6, 0.32, 0.08), k=1)[0]
            cand = list(pool); rg.shuffle(cand)
            for name, w, h in cand[:3]:
                x = cx - w // 2
                if xa == 2 and xb == 6 and x + w - 1 > 6:
                    x = 7 - w
                if xa == 89 and x < 89:
                    x = 89
                if x < 2 or x + w - 1 > 93:
                    continue
                if band_ok(name, w, h, x, cy, ((xa, xb), (ya, yb_))):
                    Tf(name, x, cy)
                    for xx in range(x, x + w):
                        for yy in range(cy - 1, cy + 1):
                            OCC.add((xx, yy))
                    break


_n0 = len(TREEPOS)
forest_band2()
print('숲띠 나무', len(TREEPOS) - _n0)
_n0 = len(TREEPOS)
fill_trees(2, 3)
fill_trees(1, 3, (0.25, 0.4, 0.35))
fill_trees(1, 4, (0.05, 0.3, 0.65))


def top_up(x0, y0, x1, y1, want, seed=3):
    """맨 잔디가 넓은 창(M1)을 채운다: 해당 사각형 풀 칸에 중간 나무·덤불을 간격 0 으로 심는다."""
    rg = _rand.Random(seed)
    cells = [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if KG[y][x] is None]
    rg.shuffle(cells)
    n = 0
    for (cx, cy) in cells:
        if n >= want:
            break
        pool = rg.choice([MID, MID, BUSH])
        name, w, h = rg.choice(pool)
        x = cx - w // 2
        if tree_ok(name, w, h, x, cy, 0 if not name.startswith('bush') else 0) :
            Tf(name, x, cy); n += 1
            for xx in range(x, x + w):
                for yy in range(cy - 1, cy + 1):
                    OCC.add((xx, yy))


for (_a, _b, _c, _d, _w) in ((63, 31, 83, 45, 14), (36, 58, 58, 78, 12), (60, 62, 85, 80, 12), (10, 36, 27, 44, 6), (60, 28, 69, 40, 6), (28, 72, 36, 80, 4)):
    top_up(_a, _b, _c, _d, _w)
print('채움 나무', len(TREEPOS) - _n0)
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
        if WB.canon(m) == 255:
            return DEEP + hsh(x, y, 23) % 8                    # 깊은 물: 변형 8종을 해시로 흩는다(무늬 격자 방지)
        return STREAM + WB.index47(m) + 47 * (hsh(x, y, 29) % 2)

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


def _people_filter(people):
    _BP = ('giwa', 'thatch', 'gate', 'pavilion', 'gwanah', 'nugak', 'tower', 'fort', 'gn_shop', 'gn_l_', 'gn_u_', 'gn_g2', 'gn_g3', 'gn_thatch', 'gn_jm', 'palace_hall', 'palace_jeongak', 'palace_haengnak', 'palace_gate', 'gungnae_gate', 'gungnae_tower', 'gungnae_wall')
    bodyf = [(x, y, w, h) for (nm, x, y, w, h) in placed if nm.startswith(_BP)]
    out = []
    for p in people:
        x, y = p[0], p[1]
        if not inb(x, y) or KG[y][x] not in ('road', 'yard', 'slab', 'paving', 'diamond'):
            print('사람 자리 거절(길 아님):', p); continue
        if any(bx <= x < bx + bw and by + bh // 3 <= y < by + bh for (bx, by, bw, bh) in bodyf):
            print('사람 자리 거절(건물 몸체):', p); continue
        out.append(p)
    return out


def audit():
    """적대 검수용 자동 점검: 건물 겹침 · 나무 수관이 길/다리/문을 가림 · 갈라진 길망 · 문 도달."""
    import re
    bre = re.compile(r'^(giwa|thatch|gate|pavilion|gwanah|nugak)_|^gn_(shop|l_|u_|g2|g3|thatch|jm_(corner|anchae|daemun|row))|^palace_(hall|jeongak|haengnak|gate)|^tower_|^gungnae_(gate|tower)')
    bl = [(n, x, y, w, h) for (n, x, y, w, h) in placed if bre.match(n)]
    ov = []
    for i, a in enumerate(bl):
        for b in bl[i + 1:]:
            if a[1] < b[1] + b[3] and b[1] < a[1] + a[3] and a[2] + 1 < b[2] + b[4] - 1 and b[2] + 1 < a[2] + a[4] - 1:
                if a[0].startswith('gungnae_') or b[0].startswith('gungnae_'):
                    continue
                ov.append((a[0], a[1], a[2], b[0], b[1], b[2]))
    print('건물 몸체 겹침', len(ov), ov[:8])
    crown = []
    for (nm, x, yb, w, h) in TREEPOS:
        for yy in range(yb + 1 - h, yb):
            for xx in range(x, x + w):
                if IN_X0 <= xx <= IN_X1 and IN_Y0 <= yy <= IN_Y1 and KG[yy][xx] in ('road', 'yard', 'slab', 'bridge', 'paving', 'diamond'):
                    crown.append((nm, x, yb)); break
            else:
                continue
            break
    print('수관이 길·다리를 가리는 나무', len(crown), crown[:8])
    net = network()
    walk = {(x, y) for y in range(MH) for x in range(MW) if KG[y][x] in WALKK and ((x, y) not in BODY or KG[y][x] == 'bridge')}
    rest = set(walk) - net
    comps = []
    while rest:
        c0 = next(iter(rest)); st = [c0]; seen = {c0}
        while st:
            x, y = st.pop()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + dx, y + dy)
                if n in rest and n not in seen:
                    seen.add(n); st.append(n)
        rest -= seen; comps.append(sorted(seen)[:3] + [len(seen)])
    print('외톨이 길 조각', len(comps), comps[:6])
    # 해자 닫힘: 물(+다리) 고리가 끊기지 않았나(해자 북·남·서·동 변 한 칸씩 확인)
    wset = {(x, y) for y in range(MH) for x in range(MW) if KG[y][x] in ('water', 'bridge')}
    ring_ok = all(any((x, y) in wset for y in range(MY0, MY1 + 1)) for x in (MX0 + 2, MX1 - 2)) and all(any((x, y) in wset for x in range(MX0, MX1 + 1)) for y in (MY0 + 2, MY1 - 2))
    print('해자 고리', '닫힘' if ring_ok else '끊김')
    # 칸이 해자 안쪽에서 바깥으로 다리로 닿는가: 바깥 길망에서 궁 마당 칸까지 도달
    print('궁 마당 도달', (48, 45) in net or (47, 55) in net)


def bake():
    gr, OBJ, direct = finish('s1')
    # ---- 지도 게이트
    import mapgate as _mg
    cvD = Cv(MW * T, MH * T); cvD.a = direct
    cvO = Cv(MW * T, MH * T); cvO.a = OBJ
    mf, mrep = _mg.check(placed, cvD, cvO)
    print('지도 게이트', json.dumps(mrep, ensure_ascii=False))
    if mf:
        print('지도 게이트 FAIL:\n  ' + '\n  '.join(mf))
        if not os.environ.get('JS_FORCE'):
            sys.exit(1)
    # ---- 시트: 지형 + 쓴 조각만
    grid = {}
    for i, c in enumerate(tiles):
        grid[(i % COLS, i // COLS)] = c.a
    rows_used = (len(tiles) + COLS - 1) // COLS
    cur_x, cur_y, row_h = 0, rows_used, 0
    used = []
    for (nm, x, y, w, h) in placed:
        if nm not in used:
            used.append(nm)
    for name in used:
        cv = objects[name]
        w, h = cv.w // T, cv.h // T
        if cur_x + w > COLS:
            cur_x, cur_y, row_h = 0, cur_y + row_h, 0
        ids = []
        for ty in range(h):
            r = []
            for tx in range(w):
                grid[(cur_x + tx, cur_y + ty)] = cv.a[ty * T:(ty + 1) * T, tx * T:(tx + 1) * T].copy()
                r.append((cur_y + ty) * COLS + cur_x + tx)
            ids.append(r)
        pieces[name] = {'id': ids[0][0], 'w': w, 'h': h, 'tiles': ids}
        cur_x += w
        row_h = max(row_h, h)
    sheet_rows = cur_y + row_h
    lookup = {}
    for (cx, cy), a in grid.items():
        if a[:, :, 3].max() > 0:
            lookup.setdefault(a.tobytes(), cy * COLS + cx)
    extra = []
    obj_ids = [[-1] * MW for _ in range(MH)]
    for y in range(MH):
        for x in range(MW):
            sub = OBJ[y * T:(y + 1) * T, x * T:(x + 1) * T]
            if sub[:, :, 3].max() == 0:
                continue
            key = sub.tobytes()
            if key not in lookup:
                extra.append(sub.copy())
                lookup[key] = -2 - len(extra)
            obj_ids[y][x] = lookup[key]
    base = sheet_rows * COLS
    for k, a in enumerate(extra):
        grid[((base + k) % COLS, (base + k) // COLS)] = a
    for y in range(MH):
        for x in range(MW):
            if obj_ids[y][x] <= -3:
                obj_ids[y][x] = base + (-obj_ids[y][x] - 3)
    if extra:
        sheet_rows = (base + len(extra) + COLS - 1) // COLS
    SHEET = np.zeros((sheet_rows * T, COLS * T, 4), np.uint8)
    for (cx, cy), a in grid.items():
        SHEET[cy * T:(cy + 1) * T, cx * T:(cx + 1) * T] = a
    # ---- 시트 칸 번호만으로 재조립
    def tile_by_id(i):
        return grid[(i % COLS, i // COLS)]
    re = np.zeros((MH * T, MW * T, 4), np.uint8)
    for y in range(MH):
        for x in range(MW):
            re[y * T:(y + 1) * T, x * T:(x + 1) * T] = TARR[gr[y][x]]
    for y in range(MH):
        for x in range(MW):
            if obj_ids[y][x] >= 0:
                t = tile_by_id(obj_ids[y][x])
                d = re[y * T:(y + 1) * T, x * T:(x + 1) * T]
                a = t[:, :, 3:4].astype(np.float32) / 255.0
                full = t[:, :, 3] == 255
                blend = (d[:, :, :3] * (1 - a) + t[:, :, :3] * a).astype(np.uint8)
                d[:, :, :3] = np.where(full[:, :, None], t[:, :, :3], np.where((t[:, :, 3] > 0)[:, :, None], blend, d[:, :, :3]))
                d[:, :, 3] = np.maximum(d[:, :, 3], t[:, :, 3])
    diff = int((direct != re).any(axis=2).sum())
    # ---- 문 → 길망 도달(BFS)
    net = network()
    reach = [d for d in DOORS if (d['x'], d['y']) in net]
    # ---- 파일
    os.makedirs(OUT, exist_ok=True)
    import people as _pp
    ppl = _people_filter(PEOPLE_LIST)
    Image.fromarray(direct, 'RGBA').save(os.path.join(OUT, 'joseon-gungnae-map.png'))
    _pp.overlay(Image.fromarray(direct, 'RGBA'), ppl).save(os.path.join(OUT, 'joseon-gungnae-map-people.png'))
    Image.fromarray(SHEET, 'RGBA').save(os.path.join(OUT, 'joseon-gungnae-chipset.png'))
    Image.fromarray(re, 'RGBA').save(os.path.join(OUT, 'joseon-gungnae-map-from-sheet.png'))
    json.dump({'tile': T, 'cols': COLS, 'rows': sheet_rows, 'tileCount': len(grid), 'pieces': pieces,
               'overlapTiles': {'start': base, 'count': len(extra)}}, open(os.path.join(OUT, 'pieces.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump({'width': MW, 'height': MH, 'ground': gr, 'object': obj_ids}, open(os.path.join(OUT, 'map.json'), 'w'))
    KIND = {None: 'grass', 'wall': 'wall', 'diamond': 'yard'}
    gk = [[KIND.get(KG[y][x], KG[y][x]) for x in range(MW)] for y in range(MH)]
    json.dump({'width': MW, 'height': MH,
               'placed': [{'name': n, 'x': x, 'y': y, 'w': w, 'h': h} for (n, x, y, w, h) in placed],
               'groundKind': gk,
               'doors': [{'x': d['x'], 'y': d['y'], 'piece': d['piece']} for d in DOORS],
               'people': [{'x': p[0], 'y': p[1], 'char': p[2], 'dir': ['up', 'right', 'down', 'left'][p[3]], 'frame': p[4]} for p in ppl]},
              open(os.path.join(OUT, 'extra.json'), 'w'), ensure_ascii=False)
    colors = set(map(tuple, SHEET.reshape(-1, 4)[SHEET.reshape(-1, 4)[:, 3] == 255][:, :3]))
    bn = [p for p in placed if p[0].split('_')[0] in ('giwa', 'thatch', 'gate', 'pavilion', 'gwanah', 'nugak', 'fort', 'gn', 'tower', 'palace', 'gungnae') and not any(k in p[0] for k in ('wall', 'bridge', 'sarip', 'samun', 'pine', 'pond', 'lantern', 'haetae', 'deumeu', 'censer', 'eodo', 'jm_', 'mud', 'stone_'))]
    audit()
    print(json.dumps({'sheet': f'{COLS}x{sheet_rows} tiles', 'pixelDiffMapVsSheet': diff, 'overlapTiles': len(extra), 'uniqueOpaqueColors': len(colors),
                      'doors': len(DOORS), 'doorsReachable': len(reach), 'placed': len(placed), 'people': len(ppl)}, ensure_ascii=False))
    for d in DOORS:
        if (d['x'], d['y']) not in net:
            print('길 안 닿는 문:', d)
    crops(direct)
    Image.fromarray(direct, 'RGBA').resize((MW * 16 // 3, MH * 16 // 3), Image.LANCZOS).save('/tmp/vqa20/gn_full.png')
    return diff


from people import UP, RIGHT, FRONT, LEFT
PEOPLE_LIST = [
    (48, 20, 0, FRONT, 1), (47, 28, 3, UP, 0),                       # 북 대로 · 궁 앞
    (48, 52, 5, FRONT, 1), (45, 56, 2, RIGHT, 2), (54, 49, 6, LEFT, 0),  # 궁 마당(포장)
    (18, 52, 4, RIGHT, 1), (25, 53, 7, LEFT, 2),                     # 서쪽 큰길
    (16, 24, 1, FRONT, 1), (24, 32, 6, FRONT, 2), (15, 45, 3, FRONT, 0),  # 상점 앞 · 전사의 길
    (20, 72, 0, FRONT, 1), (22, 63, 7, FRONT, 1),                    # 서남 주막 앞마당 · 안마당
    (77, 52, 2, FRONT, 1), (73, 51, 4, RIGHT, 0),                    # 동쪽 큰길
    (72, 47, 5, LEFT, 1), (58, 81, 3, FRONT, 1), (66, 81, 1, RIGHT, 2),    # 동북 주막 앞 · 객주 앞 · 예식장 앞
    (48, 74, 6, UP, 0), (75, 82, 0, LEFT, 1), (11, 70, 7, UP, 1),    # 남 대로 · 예식장 앞 · 서쪽 고리 길
]
if __name__ == '__main__':
    bake()
