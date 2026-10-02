"""조선 칩셋 국내성 원작 규모 맵(200×208): 원작 전체 지도의 좌표를 따라 성벽 고리 · 해자 · 중앙 왕궁 · 구획 건물 · 숲을 배치한다.

    python3 demo_gungnae_full.py        # tiledata/joseon-gungnae-full/ 에 쓴다
    JS_SKIPGATE=1  반복 작업용(조각 게이트·카탈로그 캐시 사용). 최종 굽기는 게이트를 건다.
    JS_STAGE=1..6  단계까지만 놓고 /tmp/vqa20/gnf_stage*.png 를 낸다(성벽+문 → 해자+다리 → 왕궁 → 건물 → 숲·소품 → 사람).
구조는 demo_gungnae.py(96×96) 와 같다: 지형 칸 + 물체 층(조각 칸) → 시트 칸 번호만으로 재조립해 pixelDiff 0 증명 → 지도 게이트 → 사람 오버레이.
기존 96×96 맵(demo_gungnae.py · tiledata/joseon-gungnae)은 건드리지 않는다.
좌표 약속: 모든 (x, y) 는 칸. 원작 칸 좌표(835×838px 지도에서 px/4.175)는 OX/OY 로 우리 맵에 옮긴다 — 가로는 그대로, 세로는
북 성벽을 망루 높이(12칸)만큼 아래로 내린 만큼 3.6% 눌러 놓는다(OY).
"""
import json, os, sys, glob, pickle, random
import numpy as np

os.environ.setdefault('JS_PROFILE', 'gungnae_full')
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'harness'))
from tk import *
import ground as G
import water_blob as WB
import catalog

STAGE = int(os.environ.get('JS_STAGE', '9'))
SKIPGATE = bool(os.environ.get('JS_SKIPGATE'))
if not SKIPGATE:
    import gate as _gate
    # 새 조각은 독립 적대 리뷰(A)가 아직 없다 — A 만 건너뛰고 나머지(P·E·T·L·S·K·TR·V)는 그대로 막는다.
    _rows, _fails, _warns, _ = _gate.run(skip_a=True)
    if _fails:
        print("게이트 FAIL %d — 굽지 않는다. python3 harness/gate.py 로 확인" % _fails)
        sys.exit(1)
from PIL import Image

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
OUT = os.path.join(ROOT, 'tiledata', 'joseon-gungnae-full')
TMP = '/tmp/vqa20'
os.makedirs(TMP, exist_ok=True)
MW, MH = 200, 208
N, E, S, W = G.N, G.E, G.S, G.W
COLS = 16


def OY(y):
    """원작 칸 y → 우리 맵 y(북 성벽 발 행 14 ← 원작 7, 남 성벽 발 행 199 ← 199)."""
    return int(round(14 + (y - 7) * 0.9635))


def _load_catalog():
    """조각 12초·지형 1초: 반복 작업(JS_SKIPGATE)에서는 /tmp 에 캐시한다(조각 모듈 mtime 이 바뀌면 다시)."""
    key = max(os.path.getmtime(f) for f in glob.glob(os.path.join(HERE, '*.py')) if not os.path.basename(f).startswith('demo'))
    cp = '/tmp/gnf_objcache.pkl'
    if SKIPGATE and os.path.exists(cp):
        try:
            k, t, o = pickle.load(open(cp, 'rb'))
            if k == key:
                return t, o
        except Exception:
            pass
    t, o = catalog.terrain(), catalog.objects()
    if SKIPGATE:
        pickle.dump((key, t, o), open(cp, 'wb'))
    return t, o


# ---------------------------------------------------------------- 지형 목록(시트 앞쪽 고정)
tiles = []
pieces = {}
terr, objects = _load_catalog()


def add_group(name, cvs):
    ids = []
    for c in cvs:
        tiles.append(c)
        ids.append(len(tiles) - 1)
    pieces[name] = {'id': ids[0], 'count': len(ids), 'tiles': ids}


def pad_row():
    while len(tiles) % COLS:
        tiles.append(Cv(T, T))


for _k in ('grass8', 'yard', 'paving', 'field'):
    add_group(_k, terr[_k])
pad_row()
for _k in ('road64', 'yard64', 'water47g', 'water_deep', 'rice16', 'slab', 'slab_edge16', 'slab_dirt', 'diamond', 'palace_court', 'palace_court16'):
    add_group(_k, terr[_k])
    pad_row()
TID = {k: pieces[k]['id'] for k in pieces}
GRASS, YARD, ROAD, YARD16, STREAM, PADDY = TID['grass8'], TID['yard'], TID['road64'], TID['yard64'], TID['water47g'], TID['rice16']
DEEP = TID['water_deep']
SLAB, SLAB16, SLABD, DIAM, COURT, COURT16, FIELD = TID['slab'], TID['slab_edge16'], TID['slab_dirt'], TID['diamond'], TID['palace_court'], TID['palace_court16'], TID['field']
TARR = [t.a for t in tiles]

# ---------------------------------------------------------------- 바닥 종류 격자
KG = [[None] * MW for _ in range(MH)]          # None=풀


def inb(x, y):
    return 0 <= x < MW and 0 <= y < MH


def paint(kind, x0, y0, x1, y1):
    """x0..x1, y0..y1 (끝 포함) 사각형을 kind 로. 물·다리 칸은 길·석판이 덮지 않는다(다리 홍예 밑이 물이어야 한다)."""
    for y in range(max(0, y0), min(MH - 1, y1) + 1):
        for x in range(max(0, x0), min(MW - 1, x1) + 1):
            if KG[y][x] in ('bridge', 'water') and kind not in ('bridge', 'water'):
                continue
            if KG[y][x] == 'wall' and kind in ('road', 'yard'):
                continue
            KG[y][x] = kind


def cells_of(*kinds):
    return {(x, y) for y in range(MH) for x in range(MW) if KG[y][x] in kinds}


# ---------------------------------------------------------------- 물체 층
items = []                 # (바닥 행, 높이, x, 이름, Cv)
placed = []                # (이름, x, y, w, h)  놓은 순서
BODY = set()               # 건물·벽 등 막힌 칸(나무·소품이 못 서는 칸)
KEEP = set()               # 나무·덤불이 가리면 안 되는 칸(문 앞·다리 끝)
DOORS = []                 # {'x','y','piece'}
ENDS = []                  # 다리 끝·성문 앞 등 길망에 이어야 하는 칸(문은 아님)


def qa(a):
    """그림자 투명도를 3단(14·28·44)으로 끊는다: 땅과 섞여 생기는 색 수를 줄이고 도트 띠 느낌을 낸다."""
    return 0 if a < 9 else (20 if a < 26 else (36 if a < 44 else 54))


_SHADOWED = ('gn_shop', 'gn_thatch', 'gn_l_giwa', 'gn_g2', 'giwa_', 'thatch_', 'tower_', 'gwanah', 'palace_hall', 'gnf_palace_hall', 'palace_haenggak', 'palace_jeongak', 'seonangdang', 'gn_jm_', 'gn_u_', 'gn_l_', 'pavilion')


def P(name, x, y, solid='foot', tag=None):
    """조각 왼쪽 위 칸 (x, y) 에 놓는다. solid: 'foot'(맨 아래 행만 막힘) · 'body'(아래 2/3) · 'all'(전체) · None."""
    cv = objects[name]
    w, h = cv.w // T, cv.h // T
    placed.append((name, x, y, w, h))
    items.append((y + h, h, x, name, cv))
    if name.startswith(_SHADOWED) and h >= 3 and w >= 2:        # 건물·전각: 오른쪽·아래로 드리운 땅 그림자(나무와 같은 방향)
        bw, bh = w * T, h * T
        sc = Cv(bw + 12, bh + 6)
        for yy in range(int(bh * 0.55), bh):
            fade = max(0.0, min(1.0, (yy - bh * 0.55) / 10.0))
            for i in range(12):
                sc.put(bw + i, yy, SHADOW, qa(int(96 * fade * (1 - i / 12.0))))
        for yy in range(bh - 1, bh + 6):
            for xx in range(5, bw + 8):
                al = qa(int(84 * (1 - (yy - (bh - 1)) / 7.0) * min(1.0, (bw + 8 - xx) / 8.0 + 0.2)))
                if al > 0: sc.put(xx, yy, SHADOW, al)
        items.append((y + sc.h / T - 0.01, 0, x, 'shadow', sc))
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


# ================================================================ 중간 점검 그림
def _stage_png(tag):
    gr = ground_ids()
    ground = np.zeros((MH * T, MW * T, 4), np.uint8)
    for y in range(MH):
        for x in range(MW):
            ground[y * T:(y + 1) * T, x * T:(x + 1) * T] = TARR[gr[y][x]]
    direct = ground.copy()
    obj = compose_objects()
    _comp(direct, obj, 0, 0)
    Image.fromarray(direct, 'RGBA').save('%s/gnf_stage_%s.png' % (TMP, tag))
    return direct


def _comp(dst, src, x, y):
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


def compose_objects():
    OBJ = np.zeros((MH * T, MW * T, 4), np.uint8)
    for (_b, _h, x, name, cv) in sorted(items, key=lambda i: (i[0], i[1], i[2])):
        _comp(OBJ, cv.a, x * T, int(round((_b - cv.h / T) * T)) if name == 'shadow' else int(round((_b - _h) * T)))
    return OBJ


def ground_ids():
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
        return STREAM + WB.index47(m) + 47 * (hsh(x, y, 29) % 4)

    slabc = fams['slab']
    wallc = cells_of('wall')
    court = fams['paving']
    paddyc = fams['paddy']
    gr = [[0] * MW for _ in range(MH)]
    for y in range(MH):
        for x in range(MW):
            k = KG[y][x]
            if k in (None, 'wall'):
                gid = GRASS + (hsh(x, y, 3) % 6 if hsh(x, y, 5) % 12 < 10 else 6 + hsh(x, y, 9) % 2)
            elif k == 'road':
                gid = ROAD + 16 * (hsh(x, y, 41) % 4) + mask_in(dirt | slabc | wallc, x, y, True)
            elif k == 'yard':
                gid = YARD16 + 16 * (hsh(x, y, 43) % 4) + mask_in(dirt | slabc | wallc, x, y, False)
            elif k == 'diamond':
                gid = DIAM + (x + y) % 2
            elif k == 'slab':
                m = mask_in(slabc | dirt | wset | court, x, y, True)
                gid = SLAB + hsh(x, y, 17) % 5 if m == 15 else SLAB16 + m
            elif k == 'paving':
                m = mask_in(court | slabc, x, y, False)
                gid = COURT + hsh(x, y, 19) % 3 if m == 15 else COURT16 + m
            elif k in ('water', 'bridge'):
                gid = water_id(x, y)
            elif k == 'paddy':
                gid = PADDY + mask_in(paddyc, x, y, False)
            elif k == 'field':
                gid = FIELD + hsh(x, y, 11) % 2
            else:
                gid = GRASS
            gr[y][x] = gid
    return gr



# ================================================================ 1단계: 틀(성벽 + 문 + 바깥 길 + 숲띠)
XW, XE = 10, 188               # 서·동 성벽 왼쪽 칸(폭 3: 10..12 · 188..190) — 원작 성벽 x≈10.5..12 · 189..190
YN, YS = 14, 199               # 북·남 성벽 발 행(그림은 위로 5칸)
GX = 94                        # 대문루 왼쪽 칸(폭 12 → 94..105, 가운데 x=100.0)
AV0, AV1 = GX + 4, GX + 7      # 석판 대로 98..101
GATE_Y0 = 95                   # 측면 문루 그림이 덮는 첫 행(지붕 4 · 통로 4)
GAP_Y0, GAP_Y1 = 99, 102       # 측면 통로 행(원작 서·동문 y≈98 → OY)
IN_X0, IN_X1, IN_Y0, IN_Y1 = XW + 3, XE - 1, YN + 1, YS - 5      # 성 안 칸 범위(13..187, 15..194)

# --- 바깥 흙길 고리(폭 2): 북 y0..1 · 남 y205..206 · 서 x4..5 · 동 x195..196
paint('road', 0, 0, MW - 1, 1); paint('road', 0, MH - 3, MW - 1, MH - 2)
paint('road', 4, 0, 5, MH - 1); paint('road', MW - 5, 0, MW - 4, MH - 1)
# --- 성벽 밑(막힘)
paint('wall', XW, YN - 4, XE + 2, YN); paint('wall', XW, YS - 4, XE + 2, YS)
paint('wall', XW, YN, XW + 2, YS); paint('wall', XE, YN, XE + 2, YS)
# --- 북·남 대문 통로 + 석판 대로(폭 4: 98..101) — 성 밖 길까지
paint('slab', AV0, 2, AV1, YN)
paint('slab', AV0, YS - 12, AV1, MH - 3)
# --- 동·서 측면 문루 통로(성벽을 동서로 가로지르는 길, 폭 4)
paint('road', 0, GAP_Y0, XW - 1, GAP_Y1); paint('road', XE + 3, GAP_Y0, MW - 1, GAP_Y1)
paint('slab', XW, GAP_Y0, XW + 2, GAP_Y1); paint('slab', XE, GAP_Y0, XE + 2, GAP_Y1)


def wall_ring():
    """네 변 성벽 + 모서리 망루 + 대문루(북·남) + 측면 문루(동·서)."""
    H3 = ['gungnae_wall_h', 'gungnae_wall_h1', 'gungnae_wall_h2', 'gungnae_wall_h3', 'gungnae_wall_h4', 'gungnae_wall_h5']
    V3 = ['gungnae_wall_v'] + [f'gungnae_wall_v{i}' for i in range(1, 6)]
    VE3 = ['gungnae_wall_v_e'] + [f'gungnae_wall_v{i}_e' for i in range(1, 6)]
    for yb, cl, cr in ((YN, 'gungnae_wall_corner_nw', 'gungnae_wall_corner_ne'), (YS, 'gungnae_wall_corner_sw', 'gungnae_wall_corner_se')):
        Pb(cl, XW, yb, 'foot'); Pb(cr, XE, yb, 'foot')
        for x in range(XW + 3, XE):                # 성벽은 대문 밑까지 이어 깐다(문 기단의 기울어진 옆면 뒤로 돌이 비친다)
            Pb(H3[hsh(x, yb, 7) % 6], x, yb)
        Pb('gungnae_gate_great_12', GX, yb, None)
        for xx in list(range(GX, GX + 4)) + list(range(GX + 8, GX + 12)):
            BODY.add((xx, yb))
        ENDS.append({'x': AV0 + 1, 'y': yb + 1 if yb == YN else yb + 1})
    for y in range(YN + 1, YS):
        if GATE_Y0 <= y <= GAP_Y1:                     # 측면 문루 몸체 + 통로
            continue
        P(V3[hsh(y, 3, 7) % 6], XW, y, 'foot'); P(VE3[hsh(y, 5, 7) % 6], XE, y, 'foot')
    for gx in (XW - 1, XE - 1):
        P('gungnae_gate_side_5', gx, GATE_Y0, None)
        for yy in range(GATE_Y0, GAP_Y0):
            for xx in range(gx + 1, gx + 4):
                BODY.add((xx, yy))
    # 북·남 성벽 밑 땅 그림자(오른쪽 아래로 드리운 반투명 띠: 문루 자리는 제외)
    shv = Cv(T, 12)
    for yy, al in enumerate((74, 66, 56, 46, 36, 28, 20, 14, 9, 5, 3, 1)):
        for xx in range(T):
            if qa(al): shv.put(xx, yy, SHADOW, max(20, qa(al)))
    for yb in (YN, YS):
        for x in range(XW + 3, XE):
            if GX <= x < GX + 12:
                continue
            items.append((yb + 1 + 12 / T, 0, x, 'shadow', shv))
    # 동·서 세로 성벽 밑 땅 그림자(몸체 오른쪽 한 칸에 반투명 3단: 문루 행은 문 조각이 제 그림자를 갖는다)
    svx = Cv(T, T)
    for xx, al in enumerate((54, 54, 36, 36, 36, 20, 20, 20, 0)):
        for yy in range(T):
            if al: svx.put(xx, yy, SHADOW, al)
    for xs in (XW + 3, XE + 3):
        for yy in range(YN + 1, YS):
            if GATE_Y0 <= yy <= GAP_Y1:
                continue
            items.append((yy + 1, 0, xs, 'shadow', svx))
    # 모서리 망루(폭 5: 성벽 바깥으로 한 칸 나온다)
    for (x, yb) in ((XW - 1, YN), (XE - 1, YN), (XW - 1, YS), (XE - 1, YS)):
        Pb('gungnae_tower_corner_5', x, yb)


wall_ring()

# ================================================================ 2단계: 해자(원작 윤곽) + 다리
WATER = set()
from gungnae_full_layout import WATER_ROWS
for _y0, _runs in WATER_ROWS.items():
    _y = OY(_y0)
    if _y < 22 or _y > 190:
        continue
    for (_a, _b) in _runs:
        for _x in range(_a, _b + 1):
            if 17 <= _x <= 183:
                WATER.add((_x, _y))


def w_rect(x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            WATER.add((x, y))


def w_cut(x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            WATER.discard((x, y))


def w_clean(it=4):
    """1칸 두께 가시·1칸 구멍을 없앤다(8방향 블롭이 깨끗하게 이어지도록)."""
    for _ in range(it):
        add, rem = set(), set()
        for (x, y) in list(WATER) + [(x, y) for (x0_, y0_) in list(WATER) for (x, y) in ((x0_ + 1, y0_), (x0_ - 1, y0_), (x0_, y0_ + 1), (x0_, y0_ - 1))]:
            c = (x, y) in WATER
            n_, s_, e_, w_ = ((x, y - 1) in WATER), ((x, y + 1) in WATER), ((x + 1, y) in WATER), ((x - 1, y) in WATER)
            if not c and ((n_ and s_) or (e_ and w_)):
                add.add((x, y))
            if c and ((not n_ and not s_) or (not e_ and not w_)):
                rem.add((x, y))
        WATER.update(add); WATER.difference_update(rem)


w_clean(3)

BRIDGES = []   # (종류, 데크 좌상 칸 x, y, 데크 w, h) 기록(통행 검사·그림용)


def _run_v(col, yh, reach=5):
    """열 col 에서 yh 근처(±reach)의 연속 물 구간 [ya, yb]."""
    for d in sorted(range(-reach, reach + 1), key=abs):
        y = yh + d
        if (col, y) in WATER:
            ya = yb = y
            while (col, ya - 1) in WATER: ya -= 1
            while (col, yb + 1) in WATER: yb += 1
            return ya, yb
    return None


def _run_h(row, xh, reach=5):
    for d in sorted(range(-reach, reach + 1), key=abs):
        x = xh + d
        if (x, row) in WATER:
            xa = xb = x
            while (xa - 1, row) in WATER: xa -= 1
            while (xb + 1, row) in WATER: xb += 1
            return xa, xb
    return None


PERIOD = 7           # 연속 다리: 물 5칸 + 둑(뭍) 2칸


def _plan(L):
    """물 구간 길이 L → 다리 수 n 과 시작 오프셋. 한 다리는 물 5칸을 덮는다."""
    n = max(1, int(round((L + 2) / float(PERIOD))))
    return n, (L - (PERIOD * n - 2)) // 2


def bridge_v(x, yh, wd=4, tag=''):
    """남북 다리(데크 폭 wd, 기본 4): 열 x+1 의 물 구간을 5칸씩으로 깎아 v6(물 5)을 놓는다. 긴 물은 2칸 둑을 끼워 이어 놓는다."""
    cname = 'gungnae_bridge_v6' if wd == 4 else 'gungnae_bridge_v5'
    wat = 5 if wd == 4 else 4
    rr = _run_v(x + 1, yh)
    if rr is None:
        print('다리(v) 물 없음', x, yh, tag); return 0
    ya, yb = rr
    L = yb - ya + 1
    if L > 3 * (wat + 2):
        print('다리(v) 물이 운하 방향이라 건너지 않음', x, yh, L, tag); return 0
    n = 1 if L <= 2 * (wat + 2) else max(1, int(round((L + 2) / float(wat + 2))))
    start = ya + (L - ((wat + 2) * n - 2)) // 2
    lo, hi = min(ya, start), max(yb, start + (wat + 2) * n - 2)
    for xx in range(x - 1, x + wd + 1):          # 물 구간을 다리 칸 수에 맞춘다
        for yy in range(lo, hi + 1):
            k = yy - start
            in_w = 0 <= k < (wat + 2) * n - 2 and (k % (wat + 2)) < wat
            if in_w: WATER.add((xx, yy))
            else: WATER.discard((xx, yy))
    for i in range(n):
        y0 = start + i * (wat + 2)
        top = y0 - 1
        P(cname, x, top, solid=None)
        h = objects[cname].h // T
        for yy in range(top, top + h):
            for xx in range(x, x + wd):
                KG[yy][xx] = 'bridge'
        BRIDGES.append(('v', x, top, wd, h))
        KEEP.update({(xx, yy) for yy in range(top - 1, top + h + 1) for xx in range(x - 1, x + wd + 1)})
    ENDS.append({'x': x + 1, 'y': start - 2}); ENDS.append({'x': x + 1, 'y': start + (wat + 2) * n - 1 + 1})
    return n


def bridge_h(xh, y, wd=4, tag=''):
    """동서 다리: 행 y+1 의 물 구간(걷는 행 = 조각 1..wd)을 5칸씩으로 깎아 h6(물 5)을 놓는다."""
    rr = _run_h(y + 1, xh)
    if rr is None:
        print('다리(h) 물 없음', xh, y, tag); return 0
    xa, xb = rr
    L = xb - xa + 1
    if L > 21:
        print('다리(h) 물이 운하 방향이라 건너지 않음', xh, y, L, tag); return 0
    n = 1 if L <= 14 else max(1, int(round((L + 2) / 7.0)))
    start = xa + (L - (7 * n - 2)) // 2
    lo, hi = min(xa, start), max(xb, start + 7 * n - 2)
    for yy in range(y, y + wd + 2):
        for xx in range(lo, hi + 1):
            k = xx - start
            in_w = 0 <= k < 7 * n - 2 and (k % 7) < 5
            if in_w: WATER.add((xx, yy))
            else: WATER.discard((xx, yy))
    for i in range(n):
        x0 = start + i * 7
        P('gungnae_bridge_h6', x0 - 1, y, solid=None)
        for yy in range(y + 1, y + 1 + wd):
            for xx in range(x0 - 1, x0 + 5):
                KG[yy][xx] = 'bridge'
        BRIDGES.append(('h', x0 - 1, y, 6, wd + 2))
        KEEP.update({(xx, yy) for yy in range(y - 1, y + wd + 3) for xx in range(x0 - 2, x0 + 6)})
    ENDS.append({'x': start - 2, 'y': y + 2}); ENDS.append({'x': start + 7 * n - 2 + 1, 'y': y + 2})
    return n


def bridge_narrow_h(xh, yrow, tag=''):
    """섬·샛길용 폭 1칸 나무다리(가로): 행 yrow 의 물 구간 길이에 맞는 4·5·6칸."""
    rr = _run_h(yrow, xh)
    if rr is None:
        print('좁은 다리(h) 물 없음', xh, yrow, tag); return 0
    xa, xb = rr
    L = xb - xa + 1
    ln = 4 if L <= 4 else (5 if L == 5 else 6)
    xs = xa - ((ln - L) // 2)
    nm = 'gungnae_bridge_narrow_h' + ('' if ln == 4 else str(ln))
    for xx in range(xa, xb + 1):              # 물 폭이 다리보다 길면 남는 칸은 뭍(착지판)으로 바꾼다
        WATER.discard((xx, yrow))
        KG[yrow][xx] = 'bridge' if xs <= xx < xs + ln else None
    P(nm, xs, yrow - 1, solid=None)
    BRIDGES.append(('nh', xs, yrow - 1, ln, 3))
    ENDS.append({'x': xs - 1, 'y': yrow}); ENDS.append({'x': xs + ln, 'y': yrow})
    return 1


def apply_water():
    for (x, y) in WATER:
        if inb(x, y) and KG[y][x] not in ('wall',):
            KG[y][x] = 'water'


# 다리(원작 위치): v = 남북으로 건넌다(원작 y 로 물을 찾는다) · h = 동서로 건넌다
def place_bridges():
    # 북 운하: 대로(98..101)와 보조 다리 셋
    for (x, yo) in ((98, 38), (111, 38), (122, 38), (133, 38)):
        bridge_v(x, OY(yo))
    bridge_v(165, OY(45))                    # 동북 별채 아래(물이 운하 방향이면 건너지 않는다)
    bridge_v(152, OY(29), 4)                 # 동북 해자 안 별채 앞
    bridge_v(44, OY(50))                     # 전사의 길 석판길 (긴 물은 연속 다리)
    bridge_v(35, OY(71), 3)                  # 좌성황 위
    bridge_v(98, OY(170))                    # 마름모 광장 위 대로 건너기
    bridge_v(129, OY(160), 3)                # 기원 곁
    bridge_v(138, OY(185), 3)                # 예식장 앞
    bridge_v(156, OY(175))                   # 호수를 가로지르는 긴 돌길(도사의 길 · 섬 집)
    bridge_v(99, OY(152), 3)
    # 서·동 큰 운하를 가로지르는 다리(동서)
    for (xo, yo) in ((26, 30), (26, 99), (26, 131), (54, 95), (111, 136), (165, 100), (165, 123), (34, 182)):
        bridge_h(xo, OY(yo))


place_bridges()
w_clean(2)
apply_water()
bridge_narrow_h(22, OY(59))              # 흉가 가는 길(물 닫기 뒤에 놓는다: 남는 물 칸을 뭍으로 바꿀 때 w_clean 이 되메우지 않게)
bridge_narrow_h(25, OY(87))              # 좌성황 서쪽
for (_k, _x, _y, _w, _h) in BRIDGES:         # 다리 칸은 다리 종류로 다시 표시(w_clean·apply_water 가 덮지 않게)
    if _k == 'v':
        for yy in range(_y, _y + _h):
            for xx in range(_x, _x + _w):
                KG[yy][xx] = 'bridge'
    elif _k == 'h':
        for yy in range(_y + 1, _y + 1 + (_h - 2)):
            for xx in range(_x, _x + _w):
                KG[yy][xx] = 'bridge'
    else:
        for xx in range(_x, _x + _w):
            KG[_y + 1][xx] = 'bridge'


# ================================================================ 3단계: 중앙 왕궁(담 + 정전 + 전각 + 행각 + 궁문 + 연못 + 소나무)
PX0_, PY0_, PX1_, PY1_ = 73, 72, 127, 116               # 궁 담 사각형(모서리 칸 좌표) — 원작 마당 약 57×46
PV0, PV1, PH0, PH1 = 77, 123, 76, 113                   # 포장 마당(x 77..123, y 76..113)
PGY0 = 95                                               # 궁 측면 문(조각 위 행) → 통로 행 99..102 = 성 측면 문과 같다
for _y in range(PY0_ - 4, PY1_ + 5):
    for _x in range(PX0_ - 4, PX1_ + 5):
        if KG[_y][_x] == 'water': KG[_y][_x] = None
        WATER.discard((_x, _y))
paint('yard', PX0_, PY0_ + 2, PX1_, PY1_ - 1)
paint('paving', PV0, PH0, PV1, PH1)
# 안쪽 고리 길: 담 둘레 한 칸
paint('road', PX0_ - 2, PY0_ - 2, PX1_ + 2, PY0_ - 2); paint('road', PX0_ - 2, PY0_ - 2, PX0_ - 2, PY1_)
paint('road', PX1_ + 2, PY0_ - 2, PX1_ + 2, PY1_); paint('road', PX0_ - 2, PY1_, PX1_ + 2, PY1_)
paint('slab', AV0, 22, AV1, PY0_ - 1)                   # 북 대로 → 궁 북문
paint('slab', AV0, PY1_ - 4, AV1, YS + 6)               # 궁 남문 → 남문루
paint('slab', PX0_, GAP_Y0, PV0 - 1, GAP_Y1); paint('slab', PV1 + 1, GAP_Y0, PX1_, GAP_Y1)    # 서·동 궁문 안쪽 길(문 → 포장 마당)
paint('slab', XW + 3, GAP_Y0, PX0_ - 1, GAP_Y1); paint('slab', PX1_ + 1, GAP_Y0, XE - 1, GAP_Y1)   # 성 측면 문 → 궁 측면 문(큰길)
paint('slab', AV0, PV0 - 1, AV1, PH1)                   # 마당 가운데 축


def palace():
    pw = ['palace_wall_h', 'palace_wall_h1', 'palace_wall_h2']
    for x in range(PX0_ + 1, PX1_):
        P(pw[x % 3], x, PY0_, 'foot'); P(pw[(x + 1) % 3], x, PY1_ - 2, 'foot')
    shp = Cv(T, 10)                                      # 궁 담 밑 땅 그림자(남·북 담: 오른쪽 아래, 부드럽게)
    for yy, al in enumerate((60, 50, 40, 30, 22, 15, 9, 5, 3, 1)):
        for xx in range(T):
            if qa(al): shp.put(xx, yy, SHADOW, qa(al))
    for yb in (PY0_ + 2, PY1_):
        for x in range(PX0_ + 1, PX1_):
            if AV0 - 1 <= x <= AV1 + 1:
                continue
            items.append((yb + 10 / T, 0, x, 'shadow', shp))
    P('palace_wall_nw', PX0_, PY0_); P('palace_wall_ne', PX1_, PY0_)
    P('palace_wall_sw', PX0_, PY1_ - 2); P('palace_wall_se', PX1_, PY1_ - 2)
    for y in range(PY0_ + 2, PY1_ - 2):
        if PGY0 <= y <= GAP_Y1:                          # 서·동 측면 궁문 자리
            continue
        P('palace_wall_v', PX0_, y); P('palace_wall_v_e', PX1_, y)
    for gx in (PX0_ - 1, PX1_ - 1):                      # 서·동 궁문: 담을 가로질러 길이 동서로 지난다(행 99..102)
        P('palace_gate_side_3', gx, PGY0, None)
        for yy in range(PGY0, GAP_Y0):
            BODY.add((gx + 1, yy))
    for gy in (PY0_ - 3, PY1_ - 5):                      # 북·남 궁문(담이 문 기둥 곁까지 이어진다)
        P('palace_gate_4', AV0 - 1, gy, None)
        for xx in (AV0 - 1, AV0, AV1, AV1 + 1):
            BODY.add((xx, gy + 5))
    # 정전: 원작 마당 위쪽 한가운데의 큰 대전(폭 18칸, 가운데가 칸 경계 x=100). 앞으로 어도·월대.
    hx = 100 - 9
    P('gnf_palace_hall_wide_14', hx, 81, None)
    for yy in range(83, 90):
        for xx in range(hx + 1, hx + 17):
            BODY.add((xx, yy))
    for y in range(91, 96):
        P('palace_eodo', AV0, y, None)
    # 정전 앞 양옆 소나무 화단(북 문 안쪽)
    for x, nm in ((78, 'palace_pine_a'), (84, 'palace_pine_c'), (90, 'palace_pine_b'), (106, 'palace_pine_b'), (112, 'palace_pine_a'), (118, 'palace_pine_c')):
        P(nm, x, 75, 'foot')
    # 정전 옆 행각(좌우 낭하)
    for x in (78, 116):
        P('palace_haengnak_6', x, 82, 'body')
        P('palace_haengnak_6', x, 88, 'body')
    # 남쪽 전각 둘(원작: 마당 남쪽 좌우)과 연못
    P('palace_jeongak_a', 82, 103, 'body'); P('palace_jeongak_c', 111, 103, 'body')
    P('palace_pond_6', 80, 110, 'body'); P('palace_pond_6', 114, 110, 'body')
    for x, nm in ((90, 'palace_pine_a'), (106, 'palace_pine_b')):
        P(nm, x, 103, 'foot')
    P('palace_haetae', 96, 97); P('palace_haetae', 102, 97)
    P('palace_deumeu', 94, 93); P('palace_deumeu', 106, 93)
    P('palace_lantern', 95, 100); P('palace_lantern', 104, 100)
    P('palace_lantern', 95, 107); P('palace_lantern', 104, 107)


palace()




if STAGE <= 3:
    _stage_png('s%d' % STAGE)
    print('stage', STAGE, 'placed', len(placed), 'water', len(WATER), 'bridges', len(BRIDGES))
    sys.exit(0)

# ================================================================ 4단계: 길 + 마당 + 구획 건물(문 앞은 길망에 닿는다)
from collections import deque
USED = set()             # 건물·마당 사각형(다른 건물이 겹치지 않게)
NOTREE = []              # 나무가 서면 안 되는 사각형 (x, y, w, h)


def seg(x0, y0, x1, y1, kind='road'):
    """원작 칸 좌표(y 는 OY)로 길 사각형을 칠한다."""
    paint(kind, x0, OY(y0), x1, OY(y1))


def segy(x0, y0, x1, y1, kind='road'):
    """우리 칸 좌표로."""
    paint(kind, x0, y0, x1, y1)


# --- 성 안 고리 길(폭 2): 성벽 3칸 안쪽, 그 사이는 숲띠
segy(15, 19, 185, 20); segy(15, 19, 16, 192); segy(184, 19, 185, 192); segy(15, 191, 185, 192)
segy(XW + 3, GAP_Y0, 16, GAP_Y1); segy(184, GAP_Y0, XE - 1, GAP_Y1)
# --- 북문 앞 흙 마당(원작: 대로 양옆 갈색 터)과 남문 앞
for (x0, y0, x1, y1) in ((91, 16, 108, 22), (89, 19, 110, 20), (90, 193, 109, 198), (94, 186, 105, 192)):
    segy(x0, y0, x1, y1, 'yard')
paint('slab', AV0, 2, AV1, YN); paint('slab', AV0, YN + 1, AV1, 69)
paint('slab', AV0, 117, AV1, YS + 6)
# --- 구획을 얽는 길(원작 좌표). 물 위·성벽 위에는 칠해지지 않는다.
for (x0, y0, x1, y1) in (
        (28, 12, 56, 12), (55, 12, 55, 61), (40, 66, 58, 66), (40, 66, 40, 78), (57, 66, 57, 80),            # 서북 구획
        (62, 53, 96, 53), (87, 44, 87, 77), (76, 55, 76, 77), (62, 60, 96, 60),                            # 북중앙 소극장·과수
        (112, 42, 112, 70), (123, 42, 123, 63), (134, 48, 134, 70), (112, 24, 133, 25),                    # 동북 과수원·사슴굴길
        (110, 24, 110, 34), (140, 12, 140, 34),
        (169, 52, 184, 52), (170, 52, 170, 76), (172, 100, 184, 100), (176, 100, 176, 135),                # 동쪽
        (137, 104, 160, 104), (137, 104, 137, 124), (160, 130, 160, 148), (146, 130, 168, 130),
        (88, 104, 88, 130), (60, 104, 88, 104), (32, 130, 60, 130), (60, 104, 60, 134),                     # 서남 큰길
        (32, 108, 50, 108), (35, 120, 35, 133),
        (62, 163, 135, 163), (62, 159, 62, 163), (108, 154, 108, 170), (92, 140, 92, 168),                 # 남중앙
        (36, 172, 62, 172), (62, 172, 62, 190), (110, 172, 140, 172), (140, 172, 140, 183),
        (66, 190, 92, 190), (110, 190, 154, 190), (150, 163, 150, 183), (160, 190, 184, 190),
        (176, 104, 176, 187), (16, 160, 30, 160)):
    seg(x0, y0, x1, y1)
# 서·동 측면 문 큰길: 성 안 석판은 이미 깔았다. 해자 서·동 다리 앞은 다리 끝 칸이 이어 준다.

# --- 마당·터(원작): 서쪽 맨 흙 띠, 도적의 길, 동쪽 삼각 터, 주막 앞 큰 마당, 마름모 광장, 인형굴 터
for (x0, y0, x1, y1) in ((14, 70, 22, 100), (14, 100, 27, 112), (11, 168, 27, 192), (178, 96, 187, 110), (181, 100, 187, 108),
                         (40, 158, 92, 166), (150, 112, 160, 126), (113, 131, 122, 145), (113, 146, 128, 158), (123, 131, 138, 135),
                         (93, 22, 108, 26)):
    seg(x0, y0, x1, y1, 'yard')
seg(95, 173, 106, 184, 'diamond')
segy(131, 166, 143, 171, 'yard')         # 예식장 뒤 섬 마당(탑 꼭대기 옆 빈 터를 흙마당으로: 지붕 뒤라 나무를 못 심는다)
# --- 남중앙 밭(원작: 초록 밭 + 청록 논칸): 4×4 판
for _j in range(4):
    for _i in range(4):
        _k = 'paddy' if (hsh(_i, _j, 71) % 4 == 0) else 'field'
        _x0, _y0 = 88 + 5 * _i, OY(130) + 4 * _j
        if all(KG[_yy][_xx] is None for _yy in range(_y0, _y0 + 3) for _xx in range(_x0, _x0 + 4)):
            paint(_k, _x0, _y0, _x0 + 3, _y0 + 2)
            USED.update({(_xx, _yy) for _yy in range(_y0 - 1, _y0 + 4) for _xx in range(_x0 - 1, _x0 + 5)})
# 밭 사이 이랑길: 판 사이·가장자리 풀을 마른 흙길로 덮는다(맨 풀밭 창 방지 — 밭머리 길이 되어 걸을 수 있다).
for (_xa, _xb) in ((87, 97), (102, 112)):
    for _yy in range(OY(130) - 1, OY(130) + 16):
        for _xx in range(_xa, _xb + 1):
            if inb(_xx, _yy) and KG[_yy][_xx] is None and (_xx, _yy) not in BODY:
                KG[_yy][_xx] = 'yard'
NOTREE.append((86, OY(128), 26, 20))


def cut_water(x0, y0, x1, y1):
    """사각형 안 물을 걷어 풀(뭍)로 만든다(섬·담 둘린 터)."""
    for yy in range(y0, y1 + 1):
        for xx in range(x0, x1 + 1):
            WATER.discard((xx, yy))
            if inb(xx, yy) and KG[yy][xx] == 'water':
                KG[yy][xx] = None


def walkable_free(x, y):
    return inb(x, y) and KG[y][x] not in ('water', 'bridge', 'wall') and (x, y) not in BODY


def fits(x, y, w, h, apron=True):
    """건물 사각형(x, y, w, h)이 물·다리·성벽·다른 건물과 겹치지 않고 문 앞이 걸을 수 있는가."""
    if x < IN_X0 + 3 or x + w > IN_X1 - 3 or y < IN_Y0 + 2 or y + h > IN_Y1 - 1:
        return False
    for yy in range(y, y + h + (1 if apron else 0)):
        for xx in range(x, x + w):
            if not inb(xx, yy) or KG[yy][xx] in ('water', 'bridge', 'wall') or (xx, yy) in USED or (xx, yy) in BODY:
                return False
            if KG[yy][xx] in ('slab', 'paving', 'paddy', 'field', 'diamond') and yy >= y + h - 4:
                return False
    return True


def mark_used(x, y, w, h, m=1):
    for yy in range(y - 1, y + h + 2):
        for xx in range(x - m, x + w + m):
            USED.add((xx, yy))


def near(name_w, name_h, x, y, R=9, dx_pref=0):
    """(x, y) 에 가장 가까운 놓을 수 있는 자리(없으면 None)."""
    best = None
    for dy in range(-R, R + 1):
        for dx in range(-R, R + 1):
            d = dx * dx + dy * dy
            if best is not None and d >= best[0]:
                continue
            if fits(x + dx, y + dy, name_w, name_h):
                best = (d, x + dx, y + dy)
    return None if best is None else (best[1], best[2])


def building(name, x, yb_orig, door=None, apron=True, solid='body', notree=True, R=9, yb=None):
    """건물: 원작 좌표 (x, 바닥 행) 근처의 빈자리에 놓고, 발 밑 한 줄을 흙(yard) 앞마당으로 깔고, 문 앞 칸을 DOORS 에 적는다."""
    cv = objects[name]
    w, h = cv.w // T, cv.h // T
    yy = (OY(yb_orig) if yb is None else yb) + 1 - h
    pos = near(w, h, x, yy, R)
    if pos is None:
        print('건물 자리 없음', name, x, yy); return None
    x, y = pos
    P(name, x, y, solid)
    d = (w // 2) if door is None else door
    if apron:                                           # 앞마당은 문 앞 폭 3~4칸만(건물 앞 전체를 길로 깔면 샛길이 물가·담까지 번진다)
        ax0, ax1 = (x, x + w) if w <= 4 else (max(x, x + d - 1), min(x + w, x + d + 2))
        for xx in range(ax0, ax1):
            if inb(xx, y + h) and KG[y + h][xx] in (None, 'yard'):
                KG[y + h][xx] = 'yard'
    DOORS.append({'x': x + d, 'y': y + h, 'piece': name})
    mark_used(x, y, w, h)
    if notree:
        NOTREE.append((x - 1, y + h - 1, w + 2, 4))
    return x, y, w, h


def walled(x0, y0, W_, H_, tag='gn_stone', gate='gn_sarip_stone', gate_dx=None, ground='yard', gate_side='S', keep_open=()):
    """담(구획 담 세트)으로 두른 사각 터: 모서리 x0,y0 · 폭 W_ · 높이 H_. 앞(남) 담 가운데에 사립문, 안은 ground."""
    cut_water(x0 - 1, y0 - 1, x0 + W_, y0 + H_ + 1)
    paint(ground, x0, y0, x0 + W_ - 1, y0 + H_ - 1)
    gw = 3 if 'stone' in gate else 2
    gx = x0 + (W_ // 2 - gw // 2 if gate_dx is None else gate_dx)
    gy_ = y0 if gate_side == 'N' else y0 + H_ - 1
    for x in range(x0 + 1, x0 + W_ - 1):
        if not (gate_side == 'N' and gx <= x < gx + gw):
            P(f'{tag}_h{x % 3}', x, y0, 'foot')
        if not (gate_side != 'N' and gx <= x < gx + gw):
            P(f'{tag}_h{(x + 1) % 3}', x, y0 + H_ - 1, 'foot')
    P(f'{tag}_c_nw', x0, y0); P(f'{tag}_c_ne', x0 + W_ - 1, y0)
    P(f'{tag}_c_sw', x0, y0 + H_ - 1); P(f'{tag}_c_se', x0 + W_ - 1, y0 + H_ - 1)
    for y in range(y0 + 1, y0 + H_ - 1):
        P(f'{tag}_v', x0, y); P(f'{tag}_v1', x0 + W_ - 1, y)
    P(gate, gx, gy_, None)
    NOTREE.append((x0 - 1, y0 - 1, W_ + 2, H_ + 5))
    if gate_side == 'N':
        DOORS.append({'x': gx, 'y': y0 - 1, 'piece': gate})
        KEEP.update({(xx, yy) for xx in range(gx - 1, gx + gw + 1) for yy in (y0 - 1, y0 + 1)})
    else:
        DOORS.append({'x': gx, 'y': y0 + H_, 'piece': gate})
        for xx in range(x0, x0 + W_):
            if inb(xx, y0 + H_) and KG[y0 + H_][xx] is None:
                KG[y0 + H_][xx] = 'yard'
    for yy in range(y0 - 1, y0 + H_ + 2):
        for xx in range(x0 - 1, x0 + W_ + 1):
            USED.add((xx, yy))
    return gx


def jumak2(x0, y0, W_=26, H_=24, wall='gn_mudg'):
    """ㅁ자 큰 주막(원작 약 26×20~26): 담 W_×H_ 안에 안채·뒤 모서리 둘·세로 행랑·앞 대문채(주막 키트 조합)."""
    paint('yard', x0, y0, x0 + W_ - 1, y0 + H_ - 1)
    gx = x0 + W_ // 2 - 1
    for x in range(x0 + 1, x0 + W_ - 1):
        P(f'{wall}_h{x % 3}', x, y0, 'foot')
        if abs(x - (gx + 0.5)) > 1.2:
            P(f'{wall}_h{(x + 1) % 3}', x, y0 + H_ - 1, 'foot')
    P(f'{wall}_c_nw', x0, y0); P(f'{wall}_c_ne', x0 + W_ - 1, y0)
    P(f'{wall}_c_sw', x0, y0 + H_ - 1); P(f'{wall}_c_se', x0 + W_ - 1, y0 + H_ - 1)
    for y in range(y0 + 1, y0 + H_ - 1):
        P(f'{wall}_v', x0, y); P(f'{wall}_v1', x0 + W_ - 1, y)
    bx, by = x0 + 1, y0 + 1
    iw = W_ - 2
    P('gn_jm_corner_l', bx, by, 'body')
    P('gn_jm_row_back_6', bx + 5, by, 'body')
    P('gn_jm_anchae_5', bx + 13, by, 'body')
    P('gn_jm_corner_r', bx + iw - 5, by, 'body')
    ybot = by + H_ - 2 - 6                                   # 아래 행 윗줄
    for yy in range(by + 6, ybot - 2, 3):
        P('gn_jm_row_v_3', bx, yy, 'body'); P('gn_jm_row_v_3', bx + iw - 4, yy, 'body')
    P('gn_jm_row_room_4', bx, ybot, 'body'); P('gn_jm_daemun_6', gx - 3, ybot, 'body'); P('gn_jm_row_store_5', bx + iw - 7, ybot, 'body')
    P('gn_sarip_mud', gx, y0 + H_ - 1, None)
    for yy in range(ybot + 2, ybot + 6):                     # 대문채 가운데 통로(문간)는 걸어 지난다
        for xx in (gx, gx + 1):
            BODY.discard((xx, yy))
    my = by + 7
    P('jars', bx + 6, my); P('well', bx + 9, my); P('pyeongsang', bx + 12, my, 'foot'); P('jars', bx + 15, my)
    P('market_stall_pots', bx + 8, my + 5) if W_ >= 26 else None
    NOTREE.append((x0 - 1, y0 + H_ - 2, W_ + 2, 5))
    DOORS.append({'x': gx, 'y': y0 + H_, 'piece': 'gn_jm_daemun_6'}); DOORS.append({'x': gx + 1, 'y': y0 + H_, 'piece': 'gn_jm_daemun_6'})
    for xx in range(x0, x0 + W_):
        if KG[y0 + H_][xx] is None:
            KG[y0 + H_][xx] = 'yard'
    for yy in range(y0 - 1, y0 + H_ + 2):
        for xx in range(x0 - 1, x0 + W_ + 1):
            USED.add((xx, yy))


# --- 큰 주막 둘(원작: 서남 · 동북)
jumak2(36, OY(135), 26, 24)
jumak2(135, OY(76), 26, 22)
# --- 담 두른 구획들(원작): 좌·우 성황당(섬 위 돌담 사당), 술사의 길, 동북 별채, 도사의 길
_g = walled(37, OY(77), 11, 15, 'gn_stone', 'gn_sarip_stone')
P('seonangdang', 41, OY(77) + 3, 'foot'); P('lantern', 39, OY(77) + 9, 'foot'); P('lantern', 45, OY(77) + 9, 'foot')
_g = walled(172, OY(83), 11, 15, 'gn_stone', 'gn_sarip_stone')
P('seonangdang', 176, OY(83) + 3, 'foot'); P('lantern', 174, OY(83) + 9, 'foot'); P('lantern', 180, OY(83) + 9, 'foot')
_g = walled(143, OY(50), 25, 27, 'gn_stone', 'gn_sarip_stone', gate_dx=22, gate_side='N')
P('tower_sulsa_5', 143 + 8, OY(50) + 5, 'body'); DOORS.append({'x': 143 + 8 + 4, 'y': OY(50) + 5 + 14, 'piece': 'tower_sulsa_5'})
P('stone_pagoda', 146, OY(50) + 21, 'foot'); P('lantern', 160, OY(50) + 22, 'foot'); P('stele', 164, OY(50) + 22, 'foot')
_g = walled(161, OY(21), 22, 18, 'gn_stone', 'gn_sarip_stone')
P('giwa_seowon', 161 + 6, OY(21) + 3, 'body'); DOORS.append({'x': 161 + 6 + 4, 'y': OY(21) + 3 + 6, 'piece': 'giwa_seowon'})
P('stone_pagoda', 165, OY(21) + 11, 'foot'); P('lantern', 177, OY(21) + 11, 'foot')
_g = walled(158, OY(168), 12, 9, 'gn_stone', 'gn_sarip_stone')
P('stele', 163, OY(168) + 2, 'foot'); P('stone_pagoda', 165, OY(168) + 2, 'foot'); P('rocks', 162, OY(168) + 4, 'foot'); P('rocks', 167, OY(168) + 4, 'foot')

# --- 섬(연못 안 땅): 감옥 · 예식장 터 · 섬 집
cut_water(127, OY(138), 146, OY(152)); cut_water(126, OY(165), 143, OY(181)); cut_water(149, OY(148), 163, OY(162))


def causeway_v(x, y_top, y_bot):
    """섬에서 뭍으로 가는 좁은 나무다리(세로): y_top..y_bot 사이 가운데 4행만 물 위 다리, 나머지는 2칸 폭 뭍 둑."""
    gap0 = y_top + (y_bot - y_top + 1 - 4) // 2
    for yy in range(y_top, y_bot + 1):
        for xx in (x, x + 1):
            if gap0 <= yy < gap0 + 4:
                WATER.add((xx, yy)); KG[yy][xx] = 'water'
            else:
                WATER.discard((xx, yy)); KG[yy][xx] = None
    P('gungnae_bridge_narrow_v', x, gap0, None)
    for yy in range(gap0, gap0 + 4):
        KG[yy][x] = 'bridge'
    BRIDGES.append(('nv', x, gap0, 2, 4))
    ENDS.append({'x': x, 'y': y_bot + 1})


# --- 섬 집 둘을 뭍과 좁은 나무다리로 잇는다(원작 사마귀굴 섬·감옥 곁 섬): 물 구간 둘레 4행
for _cx, _cy in ((73, 45), (157, 166)):
    _rr = _run_v(_cx, _cy, 4)
    if _rr is None:
        print('섬 다리 물 없음', _cx, _cy)
    else:
        _ya, _yb = _rr
        print('섬 다리', _cx, _rr, 'L', _yb - _ya + 1)
        causeway_v(_cx, _ya - 1, _yb + 1)
        KEEP.update({(xx, yy) for xx in range(_cx - 1, _cx + 3) for yy in (_ya - 2, _yb + 2)})

# --- 구획 건물: (이름, x, 바닥 행(원작), 문 칸 번호, 허용 이동 반경)
for (nm, x, yb, dr, R) in (
        ('gn_shop_cloth', 18, 15, 4, 6), ('gwanah_5', 84, 50, 3, 9), ('pavilion_5', 60, 64, 3, 6), ('giwa_house_5b', 28, 60, 3, 6),
        ('gn_shop_smithy', 50, 114, 4, 8), ('gn_shop_butcher', 34, 127, 3, 8), ('giwa_house_4', 64, 137, 3, 6), ('gn_shop_cloth', 67, 152, 4, 5),
        ('gn_shop_armory', 52, 160, 6, 4), ('gn_u_giwa_7', 63, 181, 4, 6), ('giwa_house_3', 60, 190, 2, 14),
        ('giwa_haengnang_7', 108, 166, 4, 6), ('gwanah_7', 132, 150, 4, 4), ('tower_yesik_7', 131, 180, 5, 4), ('giwa_house_3b', 155, 160, 2, 6),
        ('giwa_house_5', 176, 190, 3, 14), ('giwa_house_4w', 114, 190, 3, 14),
        ('thatch_house_4k', 14, 189, 3, 6), ('thatch_hut_2', 20, 190, 1, 6), ('thatch_house_3', 23, 186, 2, 6)):
    building(nm, x, yb, dr, R=R)
for (nm, x, yb) in (('thatch_house_4', 31, 30), ('giwa_house_4', 70, 30), ('thatch_house_3b', 120, 33), ('giwa_house_3', 142, 30),
                    ('thatch_house_5', 178, 112), ('giwa_house_5b', 182, 128), ('thatch_house_4k', 72, 182), ('giwa_house_3b', 100, 197),
                    ('thatch_house_3', 20, 140), ('giwa_house_4', 45, 100), ('thatch_house_5', 120, 120), ('giwa_house_3', 72, 120)):
    building(nm, x, yb, None, R=10)

if STAGE <= 4:
    _stage_png('s%d' % STAGE)
    print('stage', STAGE, 'placed', len(placed), 'doors', len(DOORS))
    sys.exit(0)

# ================================================================ 5단계: 길 이음 + 숲띠 + 나무 채움 + 소품
WALKK = ('road', 'yard', 'slab', 'paving', 'bridge', 'diamond')


def walk_ok(x, y):
    if not inb(x, y):
        return False
    if KG[y][x] in ('water', 'wall'):
        return False
    if (x, y) in BODY:
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


def carve_lanes(targets):
    """네트워크에 안 닿는 문 앞 칸·다리 끝마다 가장 가까운 네트워크 칸까지 1칸 폭 샛길(흙)을 낸다."""
    net = network()
    carved = 0
    for d in targets:
        c = (d['x'], d['y'])
        if not inb(*c) or c in net:
            continue
        if KG[c[1]][c[0]] in ('water', 'wall') or c in BODY:
            continue
        prev = {c: None}
        dq = deque([c])
        goal = None
        while dq and goal is None:
            x, y = dq.popleft()
            for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                n = (x + dx, y + dy)
                if n in prev or not walk_ok(*n):
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


def prune_deadends():
    """막다른 길 지우기: 이웃 걷는 칸이 하나뿐인 흙길 칸(문 앞·다리 끝 제외)을 되풀이해 지운다."""
    protect = {(d['x'], d['y']) for d in DOORS} | {(d['x'], d['y']) for d in ENDS}
    n_rm = 0
    for _ in range(40):
        rm = []
        for y in range(2, MH - 2):
            for x in range(6, MW - 6):
                if KG[y][x] != 'road' or (x, y) in protect:
                    continue
                nb = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if inb(x + dx, y + dy) and KG[y + dy][x + dx] in WALKK)
                if nb <= 1:
                    rm.append((x, y))
        if not rm:
            break
        for (x, y) in rm:
            KG[y][x] = None
        n_rm += len(rm)
    return n_rm


_TG = ENDS + [{'x': d['x'], 'y': d['y']} for d in ENDS]
carve_lanes(DOORS + ENDS); carve_lanes(DOORS + ENDS)
print('막다른 길 지움', prune_deadends())
carve_lanes(DOORS + ENDS)

# 길망에서 떨어진 흙길·마당 조각(물에 갈려 나간 터, 뜬 길)은 풀로 되돌린다 — 어디로도 이어지지 않는 길을 만들지 않는다.
def drop_orphans():
    net = network()
    rest = {(x, y) for y in range(MH) for x in range(MW) if KG[y][x] in ('road', 'yard', 'diamond') and (x, y) not in net and (x, y) not in BODY}
    n = 0
    for c in rest:
        KG[c[1]][c[0]] = None; n += 1
    return n


print('뜬 길·마당 칸 지움', drop_orphans())

# ---------------------------------------------------------------- 나무 엔진(칸 배열 + 구역 색인: 큰 맵에서도 빠르게)
ZEL = ['zelkova_' + c for c in 'abcdefghij']
PIN = ['pine_' + c for c in 'abcdef']
BIG = [('zelkova_' + c, 4, 5) for c in 'abcdefghij'] + [('pine_' + c, 4, 5) for c in 'abcdef']
MID = [('persimmon_' + c, 3, 4) for c in 'abcdef'] + [('small_z_a', 2, 3), ('small_z_b', 2, 3), ('small_p', 2, 3)]
BUSH = [('bush_a', 2, 2), ('bush_b', 2, 2), ('bush_c', 2, 2), ('bush_l_a', 3, 2), ('bush_l_b', 3, 2), ('bush_s_a', 2, 1), ('bush_s_b', 2, 1), ('bush_d', 2, 2), ('bush_e', 2, 2), ('bush_f', 2, 2), ('bush_l_c', 3, 2), ('bush_l_d', 3, 2), ('bush_s_c', 2, 1), ('bush_s_d', 2, 1)]
_DIRT = ('road', 'yard', 'slab', 'paving', 'diamond', 'bridge', 'wall', 'water', 'paddy', 'field')
TREEPOS = []                 # (이름, x, 발 행, w, h)
_BK = {}                     # 구역(8칸) → TREEPOS 번호들
OCC = np.zeros((MH, MW), bool)
FREE = np.zeros((MH, MW), bool)
DIRT = np.zeros((MH, MW), bool)
ROADK = np.zeros((MH, MW), bool)
NT = np.zeros((MH, MW), bool)


def _tree_kind(n):
    return n.split('_')[0] in ('zelkova', 'pine', 'persimmon', 'willow', 'bamboo', 'small', 'bush', 'rocks', 'reeds', 'jars', 'well', 'lantern', 'scarecrow', 'stepping', 'flower', 'sotdae', 'bench', 'haystack', 'firewood', 'millstone', 'stele', 'jangseung', 'dolmadam', 'stone', 'market', 'pyeongsang', 'jangdokdae', 'boat', 'laundry', 'mat', 'gochu', 'palace')


def build_masks():
    global NRX, NRY, NRW, NRH, BRX, BRY, BRW, BRH
    for y in range(MH):
        for x in range(MW):
            k = KG[y][x]
            FREE[y, x] = k is None and (x, y) not in BODY and (x, y) not in KEEP
            DIRT[y, x] = k in _DIRT
            ROADK[y, x] = k in ('road', 'yard', 'slab', 'diamond')
    NT[:] = False
    for (nx, ny, nw, nh) in NOTREE:
        NT[max(0, ny):max(0, ny + nh), max(0, nx):max(0, nx + nw)] = True
    nr = [(x, y, w, h) for (nm, x, y, w, h) in placed if not _tree_kind(nm)]
    br = [(x, y, w, h) for (nm, x, y, w, h) in placed if nm.startswith(_SHADOWED) and h >= 3 and w >= 2]
    NRX, NRY, NRW, NRH = [np.array([r[i] for r in nr]) for i in range(4)]
    BRX, BRY, BRW, BRH = [np.array([r[i] for r in br]) for i in range(4)]


def _bk(x, y):
    return (x // 8, y // 8)


def _near_trees(x, y):
    bx, by = _bk(x, y)
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for t in _BK.get((bx + i, by + j), ()):
                yield TREEPOS[t]


def crown_overlap(x, yb, w, h):
    y = yb + 1 - h
    n = 0
    for (_n, tx, tyb, tw, th) in _near_trees(x + w // 2, yb):
        ox = min(x + w, tx + tw) - max(x, tx)
        oy = min(yb + 1, tyb + 1) - max(y, tyb + 1 - th)
        if ox > 0 and oy > 0:
            n += ox * oy
    return n


def tree_ok(name, w, h, x, yb, dist, ov_big=8, ov_small=4, roadside=True, rng=6):
    y = yb + 1 - h
    if x < 0 or x + w > MW or y < 0 or yb >= MH:
        return False
    d0 = max(0, dist)
    if OCC[max(0, yb - d0):yb + d0 + 1, max(0, x - d0):x + w + d0].any():
        return False
    if not FREE[yb, x:x + w].all() or NT[yb, x:x + w].any():
        return False
    if DIRT[max(0, y):yb, x:x + w].any():
        return False
    if roadside and h >= 4 and ((x - 1 >= 0 and ROADK[yb, x - 1]) or (x + w < MW and ROADK[yb, x + w])):
        return False
    if len(NRX):                                           # 수관이 건물·담 위 2행·좌우를 가리는 자리 금지
        m = (x < NRX + NRW) & (NRX < x + w) & (y < NRY + NRH) & (NRY < yb + 1) & (yb >= NRY + 2)
        if m.any():
            return False
    if len(BRX):                                           # 건물류: 지붕 뒤 줄기·지붕에 박힌 나무 금지(위 1행·좌우 1칸 여유)
        m_ = 1 if h >= 3 else 0
        m = (x < BRX + BRW + m_) & (BRX - m_ < x + w) & (BRY - 1 <= yb) & (yb < BRY + BRH)
        if m.any():
            return False
    if crown_overlap(x, yb, w, h) > (ov_big if h >= 4 else ov_small):
        return False
    r = 3 if name.startswith('bush') else rng
    for (n, tx, ty, _, _) in _near_trees(x + w // 2, yb):
        if n == name and abs(x - tx) <= r and abs(yb - ty) <= r:
            return False
    return True


def Tf(name, x, yb):
    cv = objects[name]
    w, h = cv.w // T, cv.h // T
    placed.append((name, x, yb + 1 - h, w, h))
    SH(x, yb + 1 - h, w, h) if name.split('_')[0] in ('zelkova', 'pine', 'persimmon', 'willow', 'small') else None
    items.append((yb + 1, h, x, name, cv))
    TREEPOS.append((name, x, yb, w, h))
    _BK.setdefault(_bk(x + w // 2, yb), []).append(len(TREEPOS) - 1)
    OCC[max(0, yb - 1):yb + 1, x:x + w] = True


def region_fill(rects, weights=(0.6, 0.32, 0.08), dist=0, seed=1, passes=1, ov=(5, 2), roadside=False, pools=None, rng_tab=6):
    """rects = [(x0, x1, yb0, yb1)] (발 행·열 범위). 후보 칸을 무작위로 돌며 큰 나무·중간 나무·덤불을 섞어 심는다."""
    rg = random.Random(seed)
    for _ in range(passes):
        cells = [(x, y) for (xa, xb, ya, yb_) in rects for y in range(ya, yb_ + 1) for x in range(xa, xb + 1) if inb(x, y) and FREE[y, x] and not OCC[y, x]]
        rg.shuffle(cells)
        for (cx, cy) in cells:
            if OCC[cy, cx]:
                continue
            pool = rg.choices([BIG, MID, BUSH], weights=weights, k=1)[0] if pools is None else rg.choice(pools)
            cand = list(pool); rg.shuffle(cand)
            for name, w, h in cand[:3]:
                x = cx - w // 2
                if tree_ok(name, w, h, x, cy, dist if not name.startswith('bush') else min(dist, 1), ov[0], ov[1], roadside, rng_tab):
                    Tf(name, x, cy)
                    break


def tree_row(x, ys, names, jit=0, seed=0):
    """한 줄 심기: 열 x 에 발 행 ys 마다 names 를 돌려 가며(밑동 위치를 조금씩 흔든다)."""
    rg = random.Random(seed)
    for i, yb in enumerate(ys):
        nm = names[i % len(names)]
        w, h = objects[nm].w // T, objects[nm].h // T
        xx = x + (rg.randint(-jit, jit) if jit else 0)
        yy = yb + (rg.randint(0, 1) if jit else 0)
        if tree_ok(nm, w, h, xx, yy, 0, 8, 4, False, 3):
            Tf(nm, xx, yy)


def tree_row_h(y, xs, names, jit=0, seed=0):
    rg = random.Random(seed)
    for i, x in enumerate(xs):
        nm = names[i % len(names)]
        w, h = objects[nm].w // T, objects[nm].h // T
        xx = x + (rg.randint(-jit, jit) if jit else 0)
        yy = y + (rg.randint(0, 1) if jit else 0)
        if tree_ok(nm, w, h, xx, yy, 0, 8, 4, False, 3):
            Tf(nm, xx, yy)


# --- 전사의 길(원작 북서 반도: 대나무숲 + 돌길 정원). 다리 북단(x 44..47, y 53)에서 북쪽으로 폭 2 돌길, 양옆 대나무 숲.
for _yy in range(38, 54):
    for _xx in (45, 46):
        if inb(_xx, _yy) and KG[_yy][_xx] is None and (_xx, _yy) not in BODY:
            KG[_yy][_xx] = 'slab'
NOTREE.append((43, 37, 6, 17))
build_masks()
_gard = [('bamboo_grove', 39, 42), ('bamboo_grove', 39, 47), ('bamboo_grove', 51, 42), ('bamboo_grove', 51, 47), ('bamboo_grove', 43 - 4, 51),
         ('bamboo_grove', 55, 45), ('bamboo', 41, 39), ('bamboo', 49, 39), ('bamboo', 37, 44), ('bamboo', 53, 40), ('bamboo', 48, 51), ('bamboo', 42, 45),
         ('bamboo', 49, 45), ('bamboo_grove', 35, 44), ('bamboo', 55, 50), ('bamboo', 38, 50)]
for (_nm, _x, _yb) in _gard:
    _w, _h = objects[_nm].w // T, objects[_nm].h // T
    if all(inb(_xx, _yb) and FREE[_yb, _xx] and not OCC[_yb, _xx] for _xx in range(_x, _x + _w)):
        Tf(_nm, _x, _yb)
for _nm, _x, _yb in (('lantern', 44, 40), ('lantern', 47, 40), ('lantern', 44, 47), ('lantern', 47, 47), ('stepping_stones', 48, 44), ('rocks', 43, 50)):
    if inb(_x, _yb) and KG[_yb][_x] is None and not OCC[_yb, _x] and (_x, _yb) not in BODY:
        _h = objects[_nm].h // T
        P(_nm, _x, _yb + 1 - _h, 'foot'); OCC[_yb, _x] = True
build_masks()
# --- 바깥 숲띠: 성벽 밖 5~8칸(줄 맞춘 나무 + 불규칙 덩이). 대문루·망루·바깥 길 자리는 비운다.
_n0 = len(TREEPOS)
SMALLS = ['small_z_a', 'small_p', 'small_z_b']
# 줄 맞춘 줄: 북 발 행 5·8(엇갈림), 남 201·204, 서 x 7·9, 동 x 192·194
for j, (yb, off) in enumerate(((5, 0), (8, 2))):
    tree_row_h(yb, [x for x in range(8 + off, 194, 5) if not (88 <= x <= 111)], ZEL[j * 3:] + PIN[j:], jit=1, seed=10 + j)
for j, (yb, off) in enumerate(((201, 1), (204, 3))):
    tree_row_h(yb, [x for x in range(8 + off, 194, 5) if not (88 <= x <= 111)], PIN[j:] + ZEL[j * 4:], jit=1, seed=20 + j)
for j, (x, off) in enumerate(((7, 0), (9, 2))):
    tree_row(x, [y for y in range(18 + off, 200, 5) if not (92 <= y <= 106)], ZEL[j * 2:] + PIN, jit=1, seed=30 + j)
for j, (x, off) in enumerate(((191, 1), (193, 3))):
    tree_row(x, [y for y in range(18 + off, 200, 5) if not (92 <= y <= 106)], PIN[j:] + ZEL[j * 5:], jit=1, seed=40 + j)
# 불규칙 덩이: 길 바깥쪽 가장자리 숲과 줄 사이 틈
region_fill([(1, 197, 3, 9), (1, 197, 199, 204), (0, 3, 10, 205), (6, 10, 10, 200), (191, 195, 10, 200), (196, 199, 10, 205)], dist=0, seed=3, passes=2, ov=(5, 2), roadside=False)
print('바깥 숲띠 나무', len(TREEPOS) - _n0)
# --- 성벽 안쪽 숲띠(성벽과 안쪽 고리 길 사이): 서·동 x 13..14 · 북 y 15..18 · 남 y 193..194
_n0 = len(TREEPOS)
tree_row(13, list(range(22, 192, 4)), SMALLS + ['persimmon_a', 'persimmon_b'], jit=0, seed=50)
tree_row(186, list(range(22, 192, 4)), SMALLS[::-1] + ['persimmon_c', 'persimmon_d'], jit=0, seed=51)
tree_row_h(17, [x for x in range(16, 186, 4) if not (90 <= x <= 109)], SMALLS + ['persimmon_e', 'persimmon_f'], jit=1, seed=52)
tree_row_h(194, [x for x in range(16, 186, 4) if not (90 <= x <= 109)], SMALLS[::-1] + ['persimmon_a', 'persimmon_c'], jit=1, seed=53)
print('안쪽 줄 나무', len(TREEPOS) - _n0)

# --- 나무 채움: 풀밭마다 3~5칸당 하나(큰 나무·작은 나무·덤불 섞기, 같은 그림 6칸 안 반복 금지)
_n0 = len(TREEPOS)
_IN = [(IN_X0 - 1, IN_X1 + 2, IN_Y0, IN_Y1)]
region_fill(_IN, weights=(0.45, 0.33, 0.22), dist=2, seed=7, passes=3, ov=(8, 4), roadside=True)
region_fill(_IN, weights=(0.25, 0.4, 0.35), dist=1, seed=8, passes=3, ov=(8, 4), roadside=True)
region_fill(_IN, weights=(0.05, 0.3, 0.65), dist=1, seed=9, passes=4, ov=(8, 4), roadside=True)
region_fill(_IN, weights=(0.0, 0.25, 0.75), dist=0, seed=10, passes=4, ov=(8, 4), roadside=False)
print('채움 나무', len(TREEPOS) - _n0)


# ---------------------------------------------------------------- 소품(주인 곁 무리) — 풀 칸에만 놓아 길·앞마당을 막지 않는다
def prop(name, x, yb, kinds=(None,)):
    """소품 (x, 바닥 행 yb). 발 밑 칸이 kinds 이고 건물·물·문 앞 칸이 아니어야 한다."""
    cv = objects[name]
    w, h = cv.w // T, cv.h // T
    doorc = {(d['x'], d['y']) for d in DOORS}
    for xx in range(x, x + w):
        if not inb(xx, yb) or KG[yb][xx] not in kinds or (xx, yb) in BODY or (xx, yb) in doorc or OCC[yb, xx]:
            return False
    for (bn, bx, by, bw, bh) in placed:                      # 소품이 건물(지붕 포함) 칸 위·뒤에 서지 않는다
        if bn.startswith(_SHADOWED) and bh >= 3 and bx < x + w and x < bx + bw and by - 1 <= yb < by + bh:
            return False
    if name in ('reeds', 'rocks'):                           # 갈대·바위: 모든 칸이 물에 닿아야 한다
        for xx in range(x, x + w):
            if not any(inb(xx + dx, yb + dy) and KG[yb + dy][xx + dx] == 'water' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                return False
    P(name, x, yb + 1 - h, 'foot')
    OCC[max(0, yb - h + 1):yb + 1, x:x + w] = True
    return True


def beside(bname, cands, side='LR'):
    for (nm, x, y, w, h) in placed:
        if nm == bname:
            for pn in cands:
                pw = objects[pn].w // T
                for sx in ([x + w] if 'R' in side else []) + ([x - pw] if 'L' in side else []):
                    if prop(pn, sx, y + h - 1):
                        return pn
    return None


_cnt = {}
for (nm, x, y, w, h) in list(placed):
    if nm in ('gn_shop_smithy', 'gn_shop_butcher', 'gn_shop_cloth', 'gn_shop_armory'):
        beside(nm, ['firewood', 'jars', 'bench'], 'LR')
    elif nm.startswith(('giwa_house', 'thatch_house', 'thatch_hut')):
        beside(nm, ['jars', 'jangdokdae', 'haystack', 'firewood'], 'LR')
    elif nm in ('tower_yesik_7', 'giwa_haengnang_7', 'gwanah_7', 'gn_u_giwa_7'):
        beside(nm, ['lantern', 'sotdae', 'bench'], 'LR')
for xx, yy, nm in ((97, 22, 'palace_lantern'), (102, 22, 'palace_lantern'), (97, 36, 'palace_lantern'), (102, 36, 'palace_lantern'), (97, 62, 'palace_lantern'), (102, 62, 'palace_lantern')):
    prop(nm, xx, yy, ('road', 'yard', None))
for xx, nm in ((96, 'jangseung_m'), (103, 'jangseung_f')):
    prop(nm, xx, 203, (None,))                                                          # 남문 밖

# 해자·연못 기슭: 갈대·돌(풀 칸, 물이 바로 옆, 6칸 간격)
_shore = [(x, y) for y in range(IN_Y0, IN_Y1) for x in range(IN_X0, IN_X1) if KG[y][x] is None and (x, y) not in BODY and any(KG[y + dy][x + dx] == 'water' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
_rng0 = random.Random(5)
_rng0.shuffle(_shore)
_last = []
for (x, y) in _shore:
    if any(abs(x - a) + abs(y - b) < 7 for a, b in _last):
        continue
    if prop('reeds' if _rng0.random() < 0.55 else 'rocks', x, y):
        _last.append((x, y))
    if len(_last) >= 90:
        break
print('기슭 소품', len(_last))

# 궁 마당 둘레 흙띠: 담 안쪽 석등을 일정 간격으로(나무 수관이 길을 덮지 않게 석등으로 한다)
for yb in range(78, 112, 6):
    for xx in (74, 124):
        if KG[yb][xx] == 'yard' and (xx, yb) not in BODY and not OCC[yb, xx]:
            P('palace_lantern', xx, yb + 1 - objects['palace_lantern'].h // T, 'foot'); OCC[yb, xx] = True

if STAGE <= 5:
    d_ = _stage_png('s%d' % STAGE)
    print('stage', STAGE, 'placed', len(placed), 'trees', len(TREEPOS))
    sys.exit(0)

# ================================================================ 6단계: 맨 잔디 창 채우기(지도 게이트 M1) + 마당 소품 + 사람
from spacemetrics import lawn_cells, window_stats


def composite():
    gr = ground_ids()
    ground = np.zeros((MH * T, MW * T, 4), np.uint8)
    for y in range(MH):
        for x in range(MW):
            ground[y * T:(y + 1) * T, x * T:(x + 1) * T] = TARR[gr[y][x]]
    OBJ = compose_objects()
    direct = ground.copy()
    _comp(direct, OBJ, 0, 0)
    return gr, OBJ, direct


LOWPROPS = ['bench', 'flower_bed', 'haystack', 'firewood', 'stepping_stones', 'millstone', 'jars', 'mat_peppers']


def fill_lawn(rounds=3, thr=0.10, seed=100, ovs=4, rng_t=6, wts=(0.45, 0.4, 0.15)):
    """맨 잔디(칸의 90% 이상이 잔디색)가 20×15칸 창의 thr 를 넘는 곳에 중간 나무·덤불·낮은 소품을 심는다."""
    rg = random.Random(seed)
    for r in range(rounds):
        _, _, direct = composite()
        G_ = lawn_cells(direct[:, :, :3], T)
        worst = 0.0
        cand = []
        for y0 in range(0, MH - 15 + 1, 5):
            for x0 in range(0, MW - 20 + 1, 5):
                sub = G_[y0:y0 + 15, x0:x0 + 20]
                f = float(sub.mean())
                worst = max(worst, f)
                if f > thr:
                    ys, xs = np.nonzero(sub)
                    cand.extend((int(x0 + a), int(y0 + b)) for a, b in zip(xs, ys))
        cand = list(dict.fromkeys(cand))
        rg.shuffle(cand)
        n = 0
        for (cx, cy) in cand:
            if OCC[cy, cx] or not FREE[cy, cx]:
                continue
            pool = rg.choices([MID, BUSH, 'prop'], weights=wts, k=1)[0]
            if pool == 'prop':
                nm = rg.choice(LOWPROPS)
                w_, h_ = objects[nm].w // T, objects[nm].h // T
                if not any(abs(dd['x'] - (cx + w_ // 2)) <= 2 and -1 <= cy - dd['y'] <= 4 for dd in DOORS) and (prop(nm, cx, cy) or prop(nm, cx - 1, cy)):
                    n += 1
                continue
            cands = list(pool); rg.shuffle(cands)
            for name, w, h in cands[:3]:
                x = cx - w // 2
                if tree_ok(name, w, h, x, cy, 0, 8, ovs, False, rng_t):
                    Tf(name, x, cy); n += 1
                    break
        print('잔디 채움', r, '최악 창', round(worst, 3), '+', n)
        if worst <= thr:
            break
    return worst


# --- 마당 소품(원작: 도적의 길 장터·서쪽 흙 띠·주막 곁 큰 마당·동쪽 터): 풀이 아니라 흙마당 위에 드문드문
_rgp = random.Random(77)
_STALLS = ['market_stall_cloth', 'market_stall_pots', 'market_stall', 'market_stall_thatch']
_LOWY = ['haystack', 'jars', 'firewood', 'millstone', 'well', 'pyeongsang', 'jangdokdae', 'gochu_mat', 'laundry']
_yard_props = 0
for (xa, xb, ya, yb_, nst, nlo) in ((12, 26, 170, 190, 5, 7), (14, 21, 72, 98, 0, 6), (42, 90, 159, 165, 6, 8), (151, 159, 113, 125, 2, 4),
                                    (114, 121, 132, 144, 0, 3), (114, 127, 147, 157, 0, 4), (180, 186, 98, 109, 0, 2)):
    for kind_, cnt in ((_STALLS, nst), (_LOWY, nlo)):
        for _t in range(cnt * 6):
            if cnt <= 0:
                break
            nm = _rgp.choice(kind_)
            cx_, cy_ = _rgp.randint(xa, xb), _rgp.randint(ya, yb_)
            if prop(nm, cx_, cy_, kinds=('yard',)):
                _yard_props += 1
                cnt -= 1
print('마당 소품', _yard_props)
fill_lawn(rounds=3, thr=0.10)
fill_lawn(rounds=4, thr=0.15, seed=200, ovs=8, rng_t=3, wts=(0.15, 0.35, 0.5))


if STAGE <= 6:
    d_ = _stage_png('s%d' % STAGE)
    print('stage', STAGE, 'placed', len(placed), 'trees', len(TREEPOS))
    sys.exit(0)


# ================================================================ 7단계: 점검(문·다리 끝·성문 도달, 막다른 길, 건물 겹침)
def audit():
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
        hit = False
        for yy in range(yb + 1 - h, yb):
            for xx in range(x, x + w):
                if inb(xx, yy) and KG[yy][xx] in ('road', 'yard', 'slab', 'bridge', 'paving', 'diamond') and 12 <= xx <= 188 and 15 <= yy <= 198:
                    hit = True; break
            if hit:
                break
        if hit:
            crown.append((nm, x, yb))
    print('수관이 길·다리를 가리는 나무', len(crown), crown[:10])
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
    print('외톨이 길 조각', len(comps), comps[:8])
    bad_d = [d for d in DOORS if (d['x'], d['y']) not in net]
    bad_e = [d for d in ENDS if (d['x'], d['y']) not in net]
    print('길 안 닿는 문', len(bad_d), bad_d[:8])
    print('길 안 닿는 다리 끝·성문 앞', len(bad_e), bad_e[:8])
    wset = {(x, y) for y in range(MH) for x in range(MW) if KG[y][x] in ('water', 'bridge')}
    # 해자 닫힘: 해자 둘레(북·남 가로선, 서·동 세로선)가 한 줄로 이어지는지 — 궁 둘레 고리 하나가 물 칸으로 이어지는가
    seen = set(); st = [next(iter(wset))]; seen.add(st[0])
    while st:
        x, y = st.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n in wset and n not in seen:
                seen.add(n); st.append(n)
    print('물 연결 성분 최대', len(seen), '/', len(wset))
    # 다리 끝 착지: 다리 칸 한 칸마다 물이 아닌 걷는 칸(또는 다리)이 반대편으로 이어지는지는 BFS 로 확인했다(위).
    pd = [(x, y) for y in range(MH) for x in range(MW) if KG[y][x] == 'palace_yard']
    return len(ov), len(crown), len(comps), len(bad_d), len(bad_e)


audit_res = audit()
if os.environ.get('JS_DBG'):
    exec(open(os.environ['JS_DBG']).read())
if STAGE <= 7:
    _stage_png('s7')
    print('stage 7 audit', audit_res)
    sys.exit(0)

# ================================================================ 8단계: 사람(Actor1) — 건물 앞·큰길·궁 마당에 가만히 서 있게
from people import UP, RIGHT, FRONT, LEFT
import people as _pp


def _walk_cell(x, y):
    return inb(x, y) and KG[y][x] in ('road', 'yard', 'slab', 'paving', 'diamond') and (x, y) not in BODY


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
        if any(nm.startswith(('gungnae_gate', 'palace_gate')) and bx <= x < bx + bw and by <= y < by + bh - 3 for (nm, bx, by, bw, bh) in placed):
            print('사람 자리 거절(문루 지붕):', p); continue
        _wk = lambda xx, yy: inb(xx, yy) and KG[yy][xx] in ('road', 'yard', 'slab', 'paving', 'diamond', 'bridge')
        if (_wk(x - 1, y) and _wk(x + 1, y) and not _wk(x, y - 1) and not _wk(x, y + 1)) or (_wk(x, y - 1) and _wk(x, y + 1) and not _wk(x - 1, y) and not _wk(x + 1, y)):
            print('사람 자리 거절(좁은 길):', p); continue
        if any(OCC[yy, xx] for yy in (y,) for xx in (x,)):
            print('사람 자리 거절(소품 위):', p); continue
        out.append(p)
    return out


def make_people(n_target=40, seed=5):
    rg = random.Random(seed)
    net = network()
    doorc = {(d['x'], d['y']) for d in DOORS}
    cand = []                                        # (우선순위, x, y, 방향)
    for d in DOORS:                                  # 문 앞 양옆 한 칸(문 칸 자체는 비운다)
        for dx in (-1, 1, -2, 2):
            x, y = d['x'] + dx, d['y']
            if _walk_cell(x, y) and (x, y) in net and (x, y) not in doorc and (x, y) not in {(a['x'], a['y']) for a in ENDS}:
                cand.append((0, x, y, UP if dx else FRONT))
                break
    # 큰길·궁 마당·마름모 광장·큰 마당
    for y in range(MH):
        for x in range(MW):
            k = KG[y][x]
            if (x, y) not in net or (x, y) in doorc or (x, y) in BODY:
                continue
            if k == 'paving' and (x + y) % 5 == 0:
                cand.append((2, x, y, rg.choice((UP, FRONT, LEFT, RIGHT))))
            elif k == 'diamond' and (x + y) % 3 == 0:
                cand.append((1, x, y, rg.choice((UP, FRONT, LEFT, RIGHT))))
            elif k == 'slab' and (x in (96, 97, 102, 103) or y in (97, 98, 101, 102)) and (x + y) % 7 == 0:
                cand.append((2, x, y, rg.choice((UP, FRONT))))
            elif k == 'yard' and (x * 3 + y) % 11 == 0:
                cand.append((3, x, y, rg.choice((UP, FRONT, LEFT, RIGHT))))
            elif k == 'road' and (x * 7 + y * 3) % 23 == 0 and 14 <= x <= 186 and 18 <= y <= 196:
                cand.append((4, x, y, rg.choice((UP, FRONT))))
    cand.sort(key=lambda c: (c[0], rg.random()))
    chosen = []
    for (_, x, y, d) in cand:
        if len(chosen) >= n_target:
            break
        dmin = 5 if _ == 0 else 11
        if any(abs(x - c[0]) + abs(y - c[1]) < dmin for c in chosen):
            continue
        chosen.append((x, y, rg.randrange(8), d, rg.randrange(3)))
    return _people_filter(chosen)


PEOPLE_LIST = make_people()
print('사람', len(PEOPLE_LIST))
if STAGE <= 8:
    d_ = _stage_png('s8')
    _pp.overlay(Image.fromarray(d_, 'RGBA'), PEOPLE_LIST).save('%s/gnf_stage_s8_people.png' % TMP)
    sys.exit(0)


# ================================================================ 9단계: 굽기(시트 재조립 pixelDiff 0 · 게이트 · 파일)
def bake():
    gr, OBJ, direct = composite()
    import mapgate as _mg
    cvD = Cv(MW * T, MH * T); cvD.a = direct
    cvO = Cv(MW * T, MH * T); cvO.a = OBJ
    mf, mrep = _mg.check(placed, cvD, cvO)
    print('지도 게이트', json.dumps(mrep, ensure_ascii=False))
    if mf:
        print('지도 게이트 FAIL:\n  ' + '\n  '.join(mf))
        if not os.environ.get('JS_FORCE'):
            sys.exit(1)
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
    re_ = np.zeros((MH * T, MW * T, 4), np.uint8)
    for y in range(MH):
        for x in range(MW):
            re_[y * T:(y + 1) * T, x * T:(x + 1) * T] = TARR[gr[y][x]]
    for y in range(MH):
        for x in range(MW):
            if obj_ids[y][x] >= 0:
                t = grid[(obj_ids[y][x] % COLS, obj_ids[y][x] // COLS)]
                d = re_[y * T:(y + 1) * T, x * T:(x + 1) * T]
                a = t[:, :, 3:4].astype(np.float32) / 255.0
                full = t[:, :, 3] == 255
                blend = (d[:, :, :3] * (1 - a) + t[:, :, :3] * a).astype(np.uint8)
                d[:, :, :3] = np.where(full[:, :, None], t[:, :, :3], np.where((t[:, :, 3] > 0)[:, :, None], blend, d[:, :, :3]))
                d[:, :, 3] = np.maximum(d[:, :, 3], t[:, :, 3])
    diff = int((direct != re_).any(axis=2).sum())
    net = network()
    reach = [d for d in DOORS if (d['x'], d['y']) in net]
    reach_e = [d for d in ENDS if (d['x'], d['y']) in net]
    os.makedirs(OUT, exist_ok=True)
    ppl = PEOPLE_LIST
    Image.fromarray(direct, 'RGBA').save(os.path.join(OUT, 'joseon-gungnae-full-map.png'))
    _pp.overlay(Image.fromarray(direct, 'RGBA'), ppl).save(os.path.join(OUT, 'joseon-gungnae-full-map-people.png'))
    Image.fromarray(SHEET, 'RGBA').save(os.path.join(OUT, 'joseon-gungnae-full-chipset.png'))
    Image.fromarray(re_, 'RGBA').save(os.path.join(OUT, 'joseon-gungnae-full-map-from-sheet.png'))
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
    import re as _re
    bre = _re.compile(r'^(giwa|thatch|gate|pavilion|gwanah|nugak|fort)_|^gn_(shop|l|u|g2|g3|thatch|jm_(corner|anchae|daemun|row))|^palace_(hall|jeongak|haeng(nak|gak)|gate)|^tower_|^gungnae_(gate|tower)')
    nb = sum(1 for p in placed if bre.match(p[0]))
    print(json.dumps({'sheet': f'{COLS}x{sheet_rows} tiles', 'pixelDiffMapVsSheet': diff, 'overlapTiles': len(extra), 'uniqueOpaqueColors': len(colors),
                      'doors': len(DOORS), 'doorsReachable': len(reach), 'ends': len(ENDS), 'endsReachable': len(reach_e), 'placed': len(placed),
                      'buildingBodies': nb, 'people': len(ppl)}, ensure_ascii=False))
    audit()
    # 확인 그림: 전체 축소 + 원작 나란히
    full = Image.fromarray(_pp.overlay(Image.fromarray(direct, 'RGBA'), ppl).convert('RGBA'))
    sm = full.resize((MW * 16 // 3, MH * 16 // 3), Image.LANCZOS)
    sm.save(TMP + '/gnf_full.png')
    ref = Image.open(TMP + '/gungnae/gungnae_map.png').convert('RGB')
    ref = ref.resize((int(ref.width * sm.height / ref.height), sm.height), Image.LANCZOS)
    vs = Image.new('RGB', (sm.width + ref.width + 16, sm.height), (30, 30, 30))
    vs.paste(sm.convert('RGB'), (0, 0)); vs.paste(ref, (sm.width + 16, 0))
    vs.save(TMP + '/gnf_vs_ref.png')
    W_, H_ = full.size
    for i in range(4):
        for j in range(4):
            full.crop((j * W_ // 4, i * H_ // 4, (j + 1) * W_ // 4, (i + 1) * H_ // 4)).save('%s/gnf_sec_%d%d.png' % (TMP, i, j))
    return diff


if __name__ == '__main__':
    bake()
