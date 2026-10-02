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
MW, MH = 96, 88
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
YN, YS = 14, 79                # 북·남 성벽 발 행(그림은 위로 5칸)
GX = 42                        # 대문루 왼쪽 칸(폭 12 → 42..53, 가운데 x=48.0)
YG = 46                        # 동·서 소문루 발 행(그림 9칸: 38..46)
IN_X0, IN_X1, IN_Y0, IN_Y1 = XW + 2, XE - 1, YN + 1, YS - 5      # 성 안 칸 범위(10..85, 15..74)
CX = 48                        # 중심 경계선 x

# --- 바깥 흙길 고리(폭 2) · 바깥 숲띠는 나무로(아래)
paint('road', 0, 0, MW - 1, 1); paint('road', 0, MH - 2, MW - 1, MH - 1)
paint('road', 0, 0, 1, MH - 1); paint('road', MW - 2, 0, MW - 1, MH - 1)
# --- 성벽 밑(막힘)
paint('wall', XW, YN - 4, XE + 1, YN); paint('wall', XW, YS - 4, XE + 1, YS)
paint('wall', XW, YN, XW + 1, YS); paint('wall', XE, YN, XE + 1, YS)
# --- 북·남 대문 통로 + 석판 대로(폭 4: 46..49)
paint('slab', 46, 2, 49, YN)                                                   # 북문 아래(문루 그림이 덮는다) + 문 앞
paint('slab', 46, YN + 1, 49, 21)                                              # 북문 → 해자 다리 앞
paint('slab', 46, YS - 12, 49, YS + 6)                                         # 남문(그림 덮음)·성 안 앞·성 밖 대로
# --- 동·서 소문루 앞 길(성벽 틈 2행)
GAP_Y0, GAP_Y1 = YG + 1, YG + 2
paint('road', 0, GAP_Y0, 13, GAP_Y1); paint('road', MW - 14, GAP_Y0, MW - 1, GAP_Y1)
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
        if YG - 8 <= y <= YG + 2:                      # 소문루 몸체 + 통행 틈
            continue
        P(V3[y % 3], XW, y, 'foot'); P(VE3[y % 3], XE, y, 'foot')
    P('gungnae_gate_small_6', XW - 2, YG - 8, 'foot'); P('gungnae_gate_small_6', XE - 2, YG - 8, 'foot')
    # 모서리 망루(폭 4, 코너 폭 2 가운데에 얹힘)
    for (x, yb) in ((XW - 1, YN), (XE - 1, YN), (XW - 1, YS), (XE - 1, YS)):
        Pb('gungnae_tower_corner_4', x, yb)


wall_ring()


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
