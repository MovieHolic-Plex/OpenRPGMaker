#!/usr/bin/env python3
"""jp_city 4묶음 현대 던전 — 폐교(수십 년 버려진 시골 목조·콘크리트 학교). id 머리 `as-`.

학교 본관 블록 `interior_school.py`(sc-, 3묶음 정본)를 **불러와 같은 그리기 함수로 그린 뒤** 먼지·금·녹·곰팡이·덩굴을 덧칠한
망가진 판(그 파일은 고치지 않는다) + 폐교에만 있는 것(넘어진 책상·마루 구멍·잔해·빗물·덩굴·쇠사슬 문·단서 상자).
바닥·벽면은 일반 학교 판보다 1~2단 어둡다. 사람·얼굴·해골·글자·낙서 없음(칠판은 지워진 자국과 금뿐).

칸 16px = 1m, 3/4 시점(윗면 + 남쪽 앞면), 왼위 빛, 팔레트 modern3 램프만(덧칠도 같은 램프의 낮은 단 = ikit 단 내리기).
크기(§12-3, 1칸 = 1m):
  학생 책상 0.6×0.45×0.75 → 1×1 · 넘어진 책상(옆으로 누움, 다리 0.75m 가 북쪽으로 뻗음) → 1×1 up0 ·
  교탁 0.9×0.6×1.0 → 1×1 · 사물함 0.6×0.5×1.8 → 1×1 up16(F 28·T 4) · 칠판 3.6×1.2 → 걸이 4칸 ·
  그랜드 피아노 1.5×1.8 → 2×2 up8 · 넘어진 서가(0.9×0.3×1.8 이 엎어짐: 길이 1.8 → 폭 2칸, 깊이 0.9 → T 9, 두께 0.3 → F 5) → 2×1 ·
  나무 신발장 1.6×0.35×1.5 → 2×1 up16 · 잔해 더미 1×1×0.5 → 1×1 up6 · 공구함 0.45×0.2×0.2 → 1×1 ·
  교무실 책상 1.4×0.7×0.75 → 2×1 · 실험대 1.8×0.9×0.8 → 2×1 · 벽 서가 1.8m → 2×1 up16.
분류는 interior/categories.py 의 `ruin-school` 하나.
"""
import importlib.util, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT, RAMPS   # noqa: E402

BLOCK = 'dungeon_school'
R = Registry(BLOCK, '폐교')

# 정상 학교 블록을 사본 이름으로 불러온다(같은 그리기 함수 재사용 — 굽기의 interior_school 모듈과 섞이지 않게).
_sp = importlib.util.spec_from_file_location('_as_src_interior_school', os.path.join(HERE, 'interior_school.py'))
SC = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(SC)
hs, rnd, px, rc, hl, vl, outline, disc, block3 = SC.hs, SC.rnd, SC.px, SC.rc, SC.hl, SC.vl, SC.outline, SC.disc, SC.block3
kc = K
WD = lambda t: K('yuka', t)
DW = lambda t: K('ita', t)
ST = lambda t: K('tekko', t)
WH = lambda t: K('shiro', t)
GL = lambda t: K('garasu', t)
LF = lambda t: K('ki', t)


def sc_draw(c, id_, *a):
    """정상 학교 가구 그림을 그대로 그린다."""
    SC.R.objs[id_]['draw'](c, *a)


# ══ 낡게 만드는 덧칠(같은 램프 단 이동 — 팔레트 밖 색을 만들지 않는다) ══════════
def _hx(v): return ((v >> 16) & 255, (v >> 8) & 255, v & 255)


_INV = {}
for _n, _r in RAMPS.items():
    for _i, _c in enumerate(_r): _INV.setdefault(_hx(_c), (_n, _i))


def shift(rgb, n):
    hit = _INV.get(tuple(int(v) for v in rgb[:3]))
    if not hit or not n: return tuple(int(v) for v in rgb[:3])
    name, i = hit
    return _hx(RAMPS[name][max(0, min(len(RAMPS[name]) - 1, i + n))])


def _box(c, box):
    x0, y0, x1, y1 = box if box else (0, 0, c.w, c.h)
    return max(0, x0), max(0, y0), min(c.w, x1), min(c.h, y1)


def age(c, n=-1, box=None):
    """불투명 화소를 같은 램프에서 n 단 내린다(먼지 앉고 바랜 판)."""
    x0, y0, x1, y1 = _box(c, box)
    for y in range(y0, y1):
        for x in range(x0, x1):
            if c.a[y, x, 3]: c.a[y, x, :3] = shift(c.a[y, x], n)


def grime(c, seed, per, n=-1, box=None):
    """드문드문 한 단 더 어둡게(때·얼룩)."""
    x0, y0, x1, y1 = _box(c, box)
    for y in range(y0, y1):
        for x in range(x0, x1):
            if c.a[y, x, 3] and rnd(x, y, seed, per): c.a[y, x, :3] = shift(c.a[y, x], n)


def speck(c, seed, per, cols, box=None):
    """불투명 화소 위 먼지·녹 점."""
    x0, y0, x1, y1 = _box(c, box)
    for y in range(y0, y1):
        for x in range(x0, x1):
            if c.a[y, x, 3] and rnd(x, y, seed, per): c.P(x, y, cols[hs(x, y, seed + 1) % len(cols)])


def crack(c, x, y, n, seed, col=None, lit=None, dx=0):
    """아래로 갈라지는 금: 한 행마다 x 가 -1·0·+1 흔들린다. lit = 금 오른쪽 아래 밝은 날."""
    col = col or OL
    for i in range(n):
        if 0 <= x < c.w and 0 <= y < c.h and c.a[y, x, 3]:
            c.P(x, y, col)
            if lit is not None and x + 1 < c.w and c.a[y, x + 1, 3]: c.P(x + 1, y, lit)
        y += 1
        x += (hs(i, seed, 7) % 3 - 1) + dx * (i % 2)


def rust(c, x, y, n, seed=0):
    """녹 줄기: 위가 짙고 아래로 옅어진다."""
    for i in range(n):
        if 0 <= x < c.w and 0 <= y + i < c.h and c.a[y + i, x, 3]:
            c.P(x, y + i, K('daidai', -2) if i < n // 2 else K('soil', -1))
    px(c, x + 1, y, K('daidai', -1))


def leaf(c, x, y, t=0, ramp='ki'):
    """3px 잎: 가운데 + 왼위 밝은 점 + 오른아래 어두운 점."""
    px(c, x, y, kc(ramp, t)); px(c, x - 1, y, kc(ramp, t + 1)); px(c, x, y - 1, kc(ramp, t + 1))
    px(c, x + 1, y, kc(ramp, t - 1)); px(c, x, y + 1, kc(ramp, t - 1))


def ivy(c, x, y0, y1, seed, dense=60, up=False):
    """덩굴 줄기 한 가닥(y0→y1) + 잎 송이."""
    xx = x
    rng = range(y0, y1) if not up else range(y1 - 1, y0 - 1, -1)
    for i, y in enumerate(rng):
        px(c, xx, y, LF(-2))
        if i % 3 == 2: xx += hs(i, seed, 3) % 3 - 1
        if rnd(i, y, seed, dense * 10):
            side = 1 if hs(i, seed, 5) % 2 else -1
            leaf(c, xx + side * 2, y, (0, -1, 1, 0)[hs(i, y, seed) % 4])


def poly(c, pts, col):
    """볼록 다각형 채우기(점 순서대로) — 기울어진 판·넘어진 가구."""
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    for y in range(int(min(ys)), int(max(ys)) + 1):
        for x in range(int(min(xs)), int(max(xs)) + 1):
            sgn = 0; inside = True
            for i in range(len(pts)):
                (ax, ay), (bx, by) = pts[i], pts[(i + 1) % len(pts)]
                cr = (bx - ax) * (y + .5 - ay) - (by - ay) * (x + .5 - ax)
                if cr != 0:
                    if sgn == 0: sgn = 1 if cr > 0 else -1
                    elif (cr > 0) != (sgn > 0): inside = False; break
            if inside: px(c, x, y, col)


def line(c, x0, y0, x1, y1, col):
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1): px(c, int(round(x0 + (x1 - x0) * i / n)), int(round(y0 + (y1 - y0) * i / n)), col)


def stain(c, cx, cy, rx, ry, seed, shade=-1):
    """물·흙 얼룩: 그 자리 바닥색을 한 단 내린 울퉁불퉁한 덩이(테두리는 성기게) — 벌레처럼 보이는 작은 점 덩이는 만들지 않는다."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            ang = math.atan2(y - cy, x - cx)
            rr = 1 + .22 * math.sin(3 * ang + seed) + .12 * math.sin(5 * ang + 2 * seed)
            d = math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) / rr
            if d <= 1 and (d < .45 or (x + y + seed) % 2 == 0 and (d < .8 or (x * 3 + y) % 4 == 0)):
                xx, yy = x % c.w, y % c.h
                c.a[yy, xx, :3] = shift(c.a[yy, xx], shade)


# ══ 바닥 ══════════════════════════════════════════════════════════════════════
@R.floor('as-wood-rotten', '썩고 들뜬 교실 마루', cols=4, rows=4, tags=('폐교', '교실', '음악실', '도서실', '마루'),
         desc='버려진 교실의 좁은 나무 판자 마루 — 일반 교실 마루보다 두 단 어둡고, 비에 젖어 회색으로 바랜 판, 갈라진 이음새, 들뜬 판 끝, 물 얼룩. 구멍 난 칸은 따로 마루 구멍(as-floor-hole)을 놓아 막는다.')
def _wood_rotten(c):
    W, H = c.w, c.h
    for r in range(H // 4):
        tone = (-1, -1, -2, -1, -1, -1, -2, -1, -2, -1, -1, -1, -2, -1, -1, -2)[r % 16]
        y0 = r * 4
        rc(c, 0, y0, W, 4, WD(tone))
        hl(c, 0, y0, W, WD(tone + 1))
        hl(c, 0, y0 + 3, W, WD(-2))                                            # 판자 사이 홈
        for k in range(2):
            sx = (r * 23 + 7 + k * 32 + hs(r, k, 3) % 9) % W
            vl(c, sx, y0, 3, WD(-2)); px(c, (sx + 1) % W, y0, WD(tone + 1))
            if hs(r, k, 4) % 3 == 0:                                            # 비에 바래 회색이 된 판 한 토막
                gx = (sx + 2) % W; gw = 7 + hs(r, k, 6) % 8
                for i in range(gw): rc(c, (gx + i) % W, y0 + 1, 1, 2, DW(0)); px(c, (gx + i) % W, y0, DW(1))
            if hs(r, k, 8) % 4 == 0:                                            # 들뜬 판 끝: 이음새가 벌어져 어둡다
                vl(c, (sx - 1) % W, y0, 3, K('sumi', 0)); px(c, (sx + 1) % W, y0 + 1, WD(tone + 1))
        for x in range(W):
            if rnd(x, r, 11, 22): px(c, x, y0 + 1 + hs(x, r, 2) % 2, WD(tone - 1) if tone > -2 else K('soil', -1))
    stain(c, 18, 22, 9, 5, 1); stain(c, 47, 50, 7, 4, 2)


@R.floor('as-corridor-dirty', '얼룩진 폐교 복도', cols=4, rows=4, tags=('폐교', '복도'),
         desc='버려진 학교 복도의 비닐 시트 — 일반 복도보다 두 단 어둡고 넓게 번진 물 얼룩, 흙 묻은 자국, 말려 올라간 시트 이음새 한 곳, 드문 먼지 점. 복도·계단참 바닥.')
def _corridor_dirty(c):
    rc(c, 0, 0, 64, 64, K('lino', -1))
    for y in range(64):
        for x in range(64):
            if rnd(x, y, 5, 32): px(c, x, y, K('lino', 0))
            elif rnd(x, y, 6, 26): px(c, x, y, K('lino', -2))
    hl(c, 0, 0, 64, K('lino', -2)); hl(c, 0, 1, 64, K('lino', 0))                          # 시트 이음새(64px 마다)
    for x in range(37, 45): px(c, x, 1, K('lino', 1)); px(c, x, 2, K('lino', -2))         # 말려 올라간 이음새
    stain(c, 18, 22, 11, 5, 3); stain(c, 47, 47, 8, 4, 4)
    for i in range(7): px(c, 6 + i * 4 + hs(i, 0, 9) % 2, 52 + hs(i, 1, 9) % 3, K('soil', -1))   # 흙 자국


@R.floor('as-tile-cracked', '금 간 현관 타일', cols=4, rows=4, tags=('폐교', '현관', '昇降口'),
         desc='무너진 昇降口의 회색 16px 타일 — 일반 현관 타일보다 두 단 어둡고, 몇 장은 금이 가고 한 장은 모서리가 깨졌으며 줄눈에 흙이 꼈다. 현관 바닥.')
def _tile_cracked(c):
    for ty in range(4):
        for tx in range(4):
            x0, y0 = tx * 16, ty * 16
            t = -1 if (tx + ty) % 2 == 0 else -2
            rc(c, x0, y0, 16, 16, K('conc', t))
            hl(c, x0, y0, 16, K('conc', -3)); vl(c, x0, y0, 16, K('conc', -3))
            hl(c, x0 + 1, y0 + 1, 15, K('conc', t + 1)); vl(c, x0 + 1, y0 + 1, 15, K('conc', t + 1))
            for k in range(4): px(c, x0 + 3 + hs(tx, ty, k) % 11, y0 + 3 + hs(ty, tx, k + 7) % 11, K('conc', t - 1))
            if hs(tx, ty, 3) % 3 == 0: px(c, x0 + 1 + hs(tx, ty, 4) % 14, y0, K('soil', -1)); px(c, x0, y0 + 2 + hs(tx, ty, 5) % 12, K('soil', -1))
    crack(c, 20, 3, 12, 3, K('conc', -3), K('conc', 0))                                     # 금 간 타일 셋
    crack(c, 41, 34, 11, 9, K('conc', -3), K('conc', -1))
    crack(c, 7, 50, 9, 5, K('conc', -3), K('conc', 0), dx=1)
    for y in range(17, 22):                                                                  # 깨진 모서리 한 곳
        for x in range(60 - (y - 17), 64): px(c, x, y, K('yoru', -2))
    stain(c, 30, 40, 9, 5, 6)


# ══ 벽면(2줄 32px) ════════════════════════════════════════════════════════════
def _patch(c, cx, cy, rx, ry, seed):
    """칠이 벗겨진 자리(울퉁불퉁한 덩이): 거친 시멘트 + 왼위 벗겨진 칠 끝 밝은 테 + 오른아래 그늘."""
    def inn(x, y):
        ang = math.atan2(y - cy, x - cx); rr = 1 + .3 * math.sin(2 * ang + seed) + .15 * math.sin(5 * ang + seed)
        return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= rr * rr
    for y in range(int(cy - ry * 1.5), int(cy + ry * 1.5) + 1):
        for x in range(int(cx - rx * 1.5), int(cx + rx * 1.5) + 1):
            if not (0 <= y < 18): continue
            if inn(x, y):
                px(c, x % c.w, y, K('conc', -2) if (x * 5 + y * 3) % 4 else K('conc', -3))
            elif inn(x + 1, y + 1): px(c, x % c.w, y, WH(1))
            elif inn(x - 1, y - 1): px(c, x % c.w, y, K('conc', -3))


def _peel(c):
    W = c.w
    rc(c, 0, 0, W, 18, WH(-1))
    for y in range(18):
        for x in range(W):
            if rnd(x, y, 21, 50): px(c, x, y, WH(0))
            elif rnd(x, y, 22, 25): px(c, x, y, K('kinari', -1))
    for x in range(1, W, 5):                                                                 # 빗물 자국(위에서 흘러내림, 길이 제각각)
        n = 2 + hs(x, 1, 9) % 13
        if hs(x, 2, 9) % 3: vl(c, x, 0, n, K('kinari', -1)); px(c, x, n, K('kinari', -2))
    _patch(c, 13, 7, 5, 3, 1)
    _patch(c, 47, 11, 3.5, 2.5, 4)
    crack(c, 30, 0, 17, 12, K('conc', -3))
    px(c, 56, 4, ST(-1)); rust(c, 56, 5, 10, 4)                                               # 녹슨 못 + 녹물 줄
    # 허리판: 레일 → 세로 널(갈라지고 하나는 빠짐) → 걸레받이
    hl(c, 0, 18, W, WD(0)); hl(c, 0, 19, W, WD(-2))
    rc(c, 0, 20, W, 9, WD(-1))
    for x in range(0, W, 8): vl(c, x, 20, 9, WD(-2)); vl(c, x + 1, 20, 9, WD(0))
    for x in range(W):
        if rnd(x, 3, 31, 120): vl(c, x, 21 + hs(x, 0, 2) % 3, 3 + hs(x, 1, 2) % 4, WD(-2))
    for x in range(18, 24):                                                                  # 아래가 부러져 나간 널(들쭉날쭉)
        top = 23 + hs(x, 4, 7) % 4
        vl(c, x, top, 29 - top, K('ita', -3)); px(c, x, top - 1, WD(0) if x % 2 else WD(-2))
    for x in range(42, 54):                                                                  # 칠이 바래 희끗한 널 한 자리
        for y in range(21, 28):
            if (x + y) % 3 == 0: px(c, x, y, WD(0))
    hl(c, 0, 29, W, K('ita', -1)); hl(c, 0, 30, W, K('ita', -2)); hl(c, 0, 31, W, K('ita', -3))
    for x in range(W):
        if rnd(x, 29, 33, 90): px(c, x, 29, K('soil', -1))                                   # 걸레받이 위 흙


@R.wall('as-wall-peel', '칠 벗겨진 폐교 벽', cols=4, tags=('폐교', '교실', '복도', '교무실', '도서실', '음악실'),
        desc='버려진 학교 벽 — 누렇게 바랜 회반죽에 빗물 자국·금, 칠이 벗겨져 시멘트가 드러난 자리, 아래 나무 허리판은 갈라지고 한 장이 빠졌다. 일반 학교 벽보다 두 단 어둡다.')
def _wall_peel(c): _peel(c)


@R.wall('as-wall-vine', '덩굴 낀 폐교 벽', cols=4, tags=('폐교', '현관', '복도', '덩굴'),
        desc='깨진 창으로 들어온 담쟁이덩굴이 아래에서 타고 오르고 위에서 늘어진 폐교 벽 — 칠 벗겨진 회반죽·갈라진 허리판 위로 짙은 녹색 잎 송이. 현관·창가 벽면.')
def _wall_vine(c):
    _peel(c)
    for i, x in enumerate((4, 15, 34, 51, 60)):
        ivy(c, x, 6 + hs(i, 0, 1) % 14, 31, 40 + i, dense=55, up=True)
    for i, x in enumerate((9, 26, 44)):
        ivy(c, x, 0, 6 + hs(i, 2, 1) % 10, 60 + i, dense=70)


# ══ 망가진 교실 가구 ══════════════════════════════════════════════════════════
@R.obj('as-desk-dusty-n', '먼지 쌓인 학생 책상·의자(북향)', w=1, h=1, kind='floor', surface=True, use=('sit',), facing='N',
       tags=('폐교', '교실', '책상'), place='폐교 교실 바닥, 학생 책상 자리 그대로 줄지어(사이사이 넘어진 책상)',
       desc='수십 년 버려진 학생 책상과 의자 한 벌 — 크림 상판에 먼지가 두껍게 앉고 금이 갔으며 쇠 다리는 녹슬었다. 학생 책상 자리 그대로 북쪽 칠판을 본다. 상판에 물건을 올릴 수 있다.')
def _desk_dusty(c):
    sc_draw(c, 'sc-desk-n')
    age(c, -1)
    speck(c, 71, 220, (K('kinari', -1), K('hodo', 0)), (3, 1, 13, 5))
    crack(c, 6, 1, 4, 5, K('kinari', -2))
    for x in (2, 13): rust(c, x, 10, 4, x)


@R.obj('as-desk-toppled', '넘어진 학생 책상', w=1, h=1, kind='floor', use=('block', 'search'), tags=('폐교', '교실', '책상', '잔해'),
       place='폐교 교실·복도 바닥, 줄지은 책상 사이에 드문드문(통로를 좁힌다)',
       desc='옆으로 넘어진 학생 책상 — 녹슨 쇠 다리 네 개가 북쪽으로 뻗고, 먼지 앉은 크림 상판이 남쪽을 향해 세워졌다. 발밑 칸을 막는다.')
def _desk_toppled(c):
    for (x0, y0, x1, y1) in ((9, 6, 14, 1), (12, 10, 15, 5)):                              # 북동쪽으로 뻗은 쇠 다리(앞 둘)
        line(c, x0, y0, x1, y1, ST(0)); line(c, x0 + 1, y0, x1 + 1 if x1 < 15 else x1, y1 + 1, ST(-2)); px(c, x1, y1, K('yoru', -1))
    line(c, 6, 4, 10, 0, ST(-1)); px(c, 10, 0, K('yoru', -1))                               # 뒤 다리(가려져 짧다)
    poly(c, [(5, 4), (10, 6), (12, 10), (7, 8)], ST(-2))                                    # 책 넣는 쇠 상자 밑
    poly(c, [(0, 10), (8, 5), (13, 10), (5, 15)], OL)                                       # 기울어진 상판(윤곽)
    poly(c, [(1, 10), (8, 6), (12, 10), (5, 14)], K('kinari', -1))
    line(c, 1, 10, 8, 6, K('kinari', 0)); line(c, 2, 11, 8, 7, K('kinari', 0))              # 빛 받는 위 가장자리
    line(c, 6, 14, 12, 10, K('kinari', -2))
    speck(c, 72, 160, (K('kinari', -2), K('hodo', 0)), (1, 6, 13, 14))
    rust(c, 13, 2, 3, 1)
    hl(c, 4, 15, 9, K('sumi', 0))


@R.obj('as-chair-toppled', '넘어진 학교 의자', w=1, h=1, kind='floor', use=('block',), tags=('폐교', '교실', '음악실', '의자', '잔해'),
       place='폐교 교실·음악실 바닥, 줄지은 의자·책상 사이',
       desc='옆으로 쓰러진 쇠 파이프 학교 의자 — 나무 좌판이 세로로 서고 녹슨 다리 둘이 동쪽으로 뻗었다. 발밑 칸을 막는다.')
def _chair_toppled(c):
    """뒤로 넘어진 의자: 등받이 판이 바닥에 눕고(남쪽), 좌판 밑면과 쇠 다리 넷이 북쪽 위로 뻗는다."""
    for (x0, y0, x1, y1) in ((4, 8, 2, 1), (11, 8, 13, 1)):                                 # 앞 다리 둘(위로 뻗음)
        line(c, x0, y0, x1, y1, ST(0)); line(c, x0 + 1, y0, x1 + 1, y1, ST(-2)); px(c, x1, y1, K('yoru', -1)); px(c, x1 + 1, y1, K('yoru', -1))
    for (x0, x1) in ((6, 5), (9, 10)): line(c, x0, 8, x1, 4, ST(-1))                         # 뒤 다리(짧게)
    poly(c, [(2, 7), (13, 7), (13, 11), (2, 11)], OL)                                        # 좌판 밑면
    rc(c, 3, 8, 10, 3, WD(-2)); hl(c, 3, 8, 10, WD(-1)); hl(c, 4, 9, 8, K('ita', -2))
    poly(c, [(1, 11), (14, 11), (15, 15), (0, 15)], OL)                                      # 바닥에 누운 등받이 판(윗면)
    rc(c, 2, 12, 12, 3, WD(0)); hl(c, 2, 12, 12, WD(1)); hl(c, 2, 14, 12, WD(-1))
    speck(c, 73, 150, (K('kinari', -1),), (2, 12, 14, 15))
    rust(c, 12, 3, 3, 2)


@R.obj('as-blackboard-cracked', '금 간 칠판', w=4, kind='hang', hrows=2, use=('read', 'search'), tags=('폐교', '교실', '칠판'),
       place='폐교 교실 북쪽 벽면 윗줄 가운데',
       desc='금이 가고 귀퉁이가 떨어져 나간 교실 칠판 4칸 — 바랜 녹색 판에 반쯤 지워진 분필 자국(소용돌이·얼룩뿐, 글자 없음), 곰팡이 핀 나무 틀, 분필 없이 먼지만 남은 받침.')
def _blackboard_cracked(c):
    sc_draw(c, 'sc-blackboard')
    rc(c, 3, 4, 58, 19, K('kokuban', -1))                                         # 옛 분필 선을 덮고
    for y in range(4, 23):
        for x in range(3, 61):
            if rnd(x, y, 41, 22): px(c, x, y, K('kokuban', 0))
            elif rnd(x, y, 42, 12): px(c, x, y, K('kokuban', -2))
    for (cx, cy, r0) in ((16, 12, 5), (44, 14, 6)):                                # 지우개로 문지른 흐린 소용돌이
        for t in range(28):
            a = 2 * math.pi * t / 14; rr = r0 * (0.4 + t / 40)
            px(c, int(round(cx + rr * math.cos(a) * 1.6)), int(round(cy + rr * math.sin(a))), K('kokuban', 1))
    for x in range(26, 36, 2): px(c, x, 9 + (x // 2) % 2, K('kokuban', 1))
    crack(c, 30, 3, 20, 11, OL, K('kokuban', 1))                                  # 금
    crack(c, 31, 10, 8, 13, OL, None, dx=1)
    for y in range(17, 24):                                                       # 떨어져 나간 오른쪽 아래 귀퉁이
        for x in range(54 - (y - 17), 62):
            px(c, x, y, K('yoru', -2) if (x + y) % 5 else K('yoru', -1))
        px(c, 53 - (y - 17), y, OL)
    age(c, -1, (0, 0, 64, 4)); age(c, -1, (0, 23, 64, 28))
    rc(c, 2, 24, 60, 2, K('ita', -1)); hl(c, 2, 24, 60, K('ita', 0))              # 빈 분필 받침
    speck(c, 43, 300, (K('kinari', -1), K('hodo', 0)), (2, 24, 62, 26))
    for (x, y) in ((1, 2), (2, 3), (62, 4), (61, 5), (1, 25)): px(c, x, y, LF(-2))   # 곰팡이


@R.obj('as-podium-broken', '부서진 교탁', w=1, h=1, kind='floor', use=('search',), tags=('폐교', '교실'),
       place='폐교 교실 칠판 앞(남쪽) 가운데 — 원래 교탁 자리',
       desc='상판이 반으로 갈라져 오른쪽이 내려앉고 앞판에 구멍이 뚫린 나무 교탁 — 먼지와 곰팡이, 갈라진 결. 발밑 칸을 막는다.')
def _podium_broken(c):
    sc_draw(c, 'sc-teacher-desk')
    age(c, -1)
    for y in range(1, 7):                                                         # 오른쪽 상판이 내려앉음
        for x in range(9, 15): px(c, x, y, WD(-2) if y < 3 else c_get(c, x, y - 2))
    vl(c, 8, 1, 7, K('sumi', 0)); px(c, 9, 1, WD(0)); px(c, 9, 3, WD(-1))
    rc(c, 4, 10, 4, 3, K('sumi', 0)); px(c, 4, 10, WD(-2)); px(c, 7, 12, WD(0))      # 앞판 구멍
    speck(c, 74, 200, (K('kinari', -1),), (1, 1, 8, 7))
    px(c, 2, 12, LF(-2)); px(c, 3, 13, LF(-2))


def c_get(c, x, y):
    """칸의 지금 색(램프 색 정수) — 내려앉은 판을 그릴 때 위 행을 옮긴다."""
    r, g, b = (int(v) for v in c.a[y, x, :3])
    return (r << 16) | (g << 8) | b


@R.obj('as-locker-open', '문 열린 녹슨 사물함', w=1, h=1, up=16, kind='wall', use=('open', 'search'), tags=('폐교', '교무실', '교실', '과학실', '사물함'),
       place='폐교 교무실·교실 뒤·과학실 북쪽 벽 바로 아래 첫 바닥 줄',
       desc='문이 열린 채 녹슨 회색 철제 사물함(1.8m) — 안은 어둡고 선반 하나에 먼지만, 열린 문짝이 남쪽으로 젖혀져 있고 환기 살 아래로 녹물이 흘렀다. 벽 붙이.')
def _locker_open(c):
    y = block3(c, 0, 2, 12, 30, 4, 'tekko', 0, front_t=-1)                                  # 몸통 x0~11, 앞면 y 부터
    hl(c, 1, 7, 10, ST(3))                                                                   # 앞 가장자리 하이라이트(윗면 T 5)
    rc(c, 2, y + 1, 8, 28 - y, K('yoru', -2)); outline(c, 1, y, 10, 30 - y, ST(-3))         # 들어간 안쪽 어둠
    hl(c, 2, y + 9, 8, ST(-1)); hl(c, 2, y + 10, 8, K('yoru', -1))                          # 선반
    rc(c, 3, y + 6, 3, 3, K('soil', -1)); px(c, 3, y + 6, K('soil', 0))                      # 낡은 걸레 덩이
    outline(c, 11, y - 1, 5, 32 - y, OL)                                                     # 남쪽으로 젖혀진 문짝(거의 옆모습)
    rc(c, 12, y, 3, 30 - y, ST(0)); vl(c, 12, y, 30 - y, ST(2)); vl(c, 14, y, 30 - y, ST(-2)); hl(c, 12, y, 3, ST(3))
    for yy in range(y + 2, y + 8, 2): px(c, 13, yy, ST(-2))
    for x in (3, 8): rust(c, x, y + 1, 4, x)
    rust(c, 13, y + 9, 6, 3)
    speck(c, 75, 60, (K('daidai', -2),), (0, 8, 12, 12))
    hl(c, 0, 31, 16, K('sumi', 0))


@R.obj('as-piano-broken', '부서진 그랜드 피아노', w=2, h=2, up=8, kind='floor', use=('search',), tags=('폐교', '음악실', '피아노'),
       place='폐교 음악실 북쪽 가운데 — 보스가 기다리는 자리, 둘레를 비워 둔다',
       desc='음악실에 버려진 검은 그랜드 피아노 2×2 — 뚜껑에 먼지가 하얗게 앉고 길게 금이 갔으며, 흰 건반 여러 개가 빠져 검은 틈이 났고 페달은 녹슬었다.')
def _piano_broken(c):
    sc_draw(c, 'sc-piano')
    speck(c, 76, 30, (K('hodo', -1), K('hodo', 0)), (2, 3, 31, 37))
    crack(c, 9, 6, 26, 21, K('yoru', 1), None, dx=1)
    for x in (5, 9, 13, 17, 22, 27): rc(c, x, 39, 1 + x % 2, 4, K('yoru', -2))       # 빠진 건반
    age(c, -1, (14, 44, 18, 46))
    px(c, 20, 45, K('kinari', -1)); px(c, 21, 45, K('kinari', -1))                     # 바닥에 떨어진 건반 하나


@R.obj('as-bookshelf-fallen', '넘어진 서가', w=2, h=1, kind='floor', use=('block', 'search'), tags=('폐교', '도서실', '책장', '잔해'),
       place='폐교 도서실 바닥 — 여러 개를 엇갈려 쓰러뜨려 미로를 만든다',
       desc='앞으로 엎어진 키 큰 나무 서가 2칸 — 위로 보이는 것은 먼지 앉은 뒤판(세로 널), 남쪽 옆으로 선반 끝, 둘레에 쏟아진 책 몇 권. 발밑 두 칸을 막는다.')
def _bookshelf_fallen(c):
    rc(c, 1, 2, 30, 9, DW(-1)); outline(c, 0, 1, 32, 15, OL)                            # 뒤판 윗면 T 9
    hl(c, 1, 2, 30, DW(1)); vl(c, 1, 2, 9, DW(1))
    for x in range(6, 30, 6): vl(c, x, 3, 8, DW(-2)); vl(c, x + 1, 3, 8, DW(0))
    hl(c, 1, 11, 30, DW(1))                                                              # 앞 가장자리
    rc(c, 1, 12, 30, 3, DW(-2)); hl(c, 1, 12, 30, DW(-3))                                # 옆면(두께)
    for x in range(3, 30, 7): rc(c, x, 13, 2, 2, DW(0))                                  # 선반 끝
    speck(c, 77, 140, (K('hodo', -1), K('kinari', -2)), (1, 2, 31, 11))
    crack(c, 19, 3, 8, 4, K('ita', -3))
    for (x, y, col) in ((2, 13, 'aka'), (26, 12, 'kon'), (10, 13, 'midori')):            # 쏟아진 책
        rc(c, x, y, 3, 2, kc(col, -1)); px(c, x, y, kc(col, 0))


@R.obj('as-bookshelf-dusty', '먼지 쌓인 벽 서가', w=2, h=1, up=16, kind='wall', use=('read', 'search'), tags=('폐교', '도서실', '책장'),
       place='폐교 도서실 북쪽 벽 바로 아래, 가로로 이어 붙인다',
       desc='버려진 도서실의 키 큰 나무 벽 서가 2칸 — 책이 군데군데 빠져 기울어지고, 칸 안은 어둡고 윗면과 선반에 먼지·거미줄. 벽 붙이.')
def _bookshelf_dusty(c):
    sc_draw(c, 'sc-bookshelf')
    age(c, -1)
    for (x, r, w) in ((5, 0, 6), (20, 1, 5), (9, 2, 7), (24, 3, 5)):                     # 빠진 책 자리
        rc(c, x, 10 + r * 6, w, 5, K('ita', -3))
        px(c, x + w, 10 + r * 6, kc('aka', -1)); px(c, x + w - 1, 11 + r * 6, kc('aka', -1))   # 기운 책
    speck(c, 78, 260, (K('hodo', 0), K('kinari', -1)), (1, 3, 31, 7))
    for i in range(5): px(c, 2 + i, 8 + i // 2, WH(-1)); px(c, 2, 8 + i, WH(-1))         # 거미줄
    px(c, 4, 9, WH(-1))


@R.obj('as-staff-desk-dusty', '먼지 쌓인 교사 책상', w=2, h=1, kind='floor', surface=True, use=('search',), tags=('폐교', '교무실', '책상'),
       place='폐교 교무실 가운데 — 등 맞댄 섬 그대로, 몇 개는 비어 있다',
       desc='버려진 교무실의 회색 철제 교사 책상 2칸 — 먼지 앉은 매트, 흩어진 누런 서류, 꺼진 모니터, 녹슨 서랍. 윗면에 물건을 올린다.')
def _staff_desk_dusty(c):
    sc_draw(c, 'sc-staff-desk')
    age(c, -1)
    for (x, y) in ((10, 3), (14, 5)): rc(c, x, y, 5, 3, K('kinari', 0)); hl(c, x, y + 2, 5, K('kinari', -1))   # 누런 서류
    speck(c, 79, 180, (K('hodo', 0), K('kinari', -1)), (1, 1, 31, 9))
    rust(c, 6, 11, 4, 1); rust(c, 25, 11, 4, 2)


@R.obj('as-lab-bench-dusty', '깨진 유리 흩어진 실험대', w=2, h=1, kind='floor', surface=True, use=('search',), tags=('폐교', '과학실'),
       place='폐교 과학실 가운데',
       desc='버려진 과학실 실험대 2칸 — 검은 상판에 먼지와 말라붙은 약품 얼룩, 깨진 비커 조각이 반짝이고 개수대 수도꼭지는 녹슬었다. 윗면에 물건을 올린다.')
def _lab_bench_dusty(c):
    sc_draw(c, 'sc-lab-bench')
    age(c, -1)
    speck(c, 80, 160, (K('hodo', 0),), (1, 1, 31, 8))
    for (x, y) in ((6, 3), (8, 5), (22, 2), (24, 4)): px(c, x, y, GL(1)); px(c, x + 1, y, GL(-1))   # 유리 조각
    for (x, y) in ((12, 3), (13, 3), (12, 4)): px(c, x, y, K('midori', -2))                        # 말라붙은 약품
    rust(c, 28, 2, 3, 4)


@R.obj('as-music-chair-n', '먼지 쌓인 음악실 의자(북향)', w=1, h=1, kind='floor', use=('sit',), facing='N', tags=('폐교', '음악실', '의자'),
       place='폐교 음악실 바닥 줄지어(피아노를 보게), 사이사이 넘어진 의자',
       desc='버려진 음악실의 쇠 파이프 의자 — 먼지 앉은 나무 좌판, 녹슨 다리, 남쪽 등받이 뒤판. 북쪽 피아노를 본다.')
def _music_chair_dusty(c):
    sc_draw(c, 'sc-music-chair-n')
    age(c, -1)
    speck(c, 81, 200, (K('kinari', -1), K('hodo', 0)), (3, 3, 13, 9))
    rust(c, 3, 12, 3, 1)


@R.obj('as-window-broken', '깨진 학교 창', w=2, kind='hang', hrows=2, use=('search',), tags=('폐교', '창', '교실', '복도', '窓'),
       place='폐교 교실·복도 북쪽 벽면 윗줄(칠판·게시판이 없는 곳)',
       desc='유리가 깨진 옛 나무 미닫이 창 2칸 — 깨진 구멍 너머 어두운 밤하늘과 담쟁이 잎, 남은 유리는 때가 끼고 금이 갔으며 창틀에 덩굴이 감겼다. 창턱에 유리 조각과 먼지.')
def _window_broken(c):
    W = 32
    rc(c, 0, 1, W, 25, DW(-1)); outline(c, 0, 1, W, 25, OL); hl(c, 1, 2, W - 2, DW(0))
    panes = [(2, 3), (9, 3), (17, 3), (24, 3), (2, 13), (9, 13), (17, 13), (24, 13)]
    broken = {1, 4, 6}
    for i, (x, y) in enumerate(panes):
        rc(c, x, y, 6, 9, GL(-2)); hl(c, x, y, 6, GL(-1))
        for k in range(3): px(c, x + 1 + k, y + 5 - k, GL(0))                            # 비친 빛 사선
        if i in broken:                                                                   # 깨진 구멍: 밤하늘 + 잎
            for yy in range(y, y + 9):
                for xx in range(x, x + 6):
                    if abs((xx - x - 2.5)) + abs(yy - y - 4) * .7 < 3.6 + hs(xx, yy, i) % 2:
                        px(c, xx, yy, K('kon', -2) if (xx + yy) % 4 else K('kon', -1))
            leaf(c, x + 2, y + 6, -1); leaf(c, x + 4, y + 3, 0)
            px(c, x + 1, y + 1, GL(1)); px(c, x + 4, y + 7, GL(1))                         # 깨진 날
        else:
            px(c, x + 4, y + 6, K('soil', -1)); px(c, x + 1, y + 7, K('soil', -1))
    vl(c, 15, 2, 23, DW(-3)); vl(c, 16, 2, 23, DW(0))                                     # 가운데 문틀
    for x in (8, 23): vl(c, x, 3, 19, DW(-2))
    hl(c, 1, 12, W - 2, DW(-2))
    rc(c, 0, 24, W, 3, DW(0)); hl(c, 0, 24, W, DW(1)); hl(c, 0, 26, W, DW(-3))              # 창턱
    for (x, y) in ((5, 24), (12, 25), (20, 24), (27, 25)): px(c, x, y, GL(1))
    speck(c, 82, 220, (K('hodo', 0),), (0, 24, 32, 26))
    ivy(c, 30, 2, 26, 83, dense=60); ivy(c, 1, 14, 26, 84, dense=50, up=True)


@R.obj('as-floor-hole', '마루 구멍', w=1, h=1, kind='floor', use=('block', 'trap'), tags=('폐교', '교실', '복도', '마루', '잔해'),
       place='폐교 썩은 마루(교실·복도) 위 — 몇 칸을 이어 방을 반쯤 막는다',
       desc='썩은 마루가 꺼져 뚫린 구멍 — 부러진 판자 끝이 들쭉날쭉하고 북쪽 가장자리에 판자 두께가 보이며, 아래는 마루 밑의 깊은 어둠과 장선 하나. 발밑 칸을 막는다.')
def _floor_hole(c):
    bands = ((2, 6, 4, 12), (6, 10, 1, 14), (10, 14, 2, 13))                                # 꺼진 판 세 장(4px 판 줄을 따라 계단진 가장자리)
    hole = set()
    for bi, (ya, yb, xa, xb) in enumerate(bands):
        for y in range(ya, yb):
            for x in range(xa + (hs(bi, y, 85) % 2), xb + 1 - (hs(y, bi, 86) % 2)): hole.add((x, y))
    for (x, y) in hole: px(c, x, y, K('sumi', -1))
    for x in range(16):
        ys = sorted(y for (xx, y) in hole if xx == x)
        if not ys: continue
        px(c, x, ys[0], WD(-1)); px(c, x, ys[0] + 1, WD(-2)); px(c, x, ys[0] + 2, K('ita', -3))   # 북쪽 안벽 = 판자 두께(빛 받는 단면)
        px(c, x, ys[0] - 1, WD(1) if (x + ys[0]) % 3 else WD(0))                               # 부러진 판 끝(밝은 생나무)
        px(c, x, ys[-1] + 1, WD(0))                                                             # 남쪽 가장자리(위를 향한 판 날)
    for (x, y) in sorted(hole):                                                                  # 옆 가장자리
        if (x - 1, y) not in hole: px(c, x - 1, y, WD(0))
        if (x + 1, y) not in hole: px(c, x + 1, y, WD(-2))
    for i in range(6): px(c, 4 + i, 7 + i // 2, WD(0)); px(c, 4 + i, 8 + i // 2, WD(-2))      # 꺾여 늘어진 판 조각
    hl(c, 3, 12, 10, K('ita', -2)); hl(c, 3, 13, 10, K('ita', -3))                              # 어둠 속 장선


@R.obj('as-debris', '무너진 잔해 더미', w=1, h=1, up=6, kind='floor', use=('block', 'search'), tags=('폐교', '잔해', '현관', '복도'),
       place='폐교 현관·복도·교실 — 무너진 천장 밑, 통로를 막거나 좁힌다',
       desc='무너진 천장 판·회반죽 덩이·부러진 각목이 쌓인 잔해 더미 — 위는 밝은 석고판 조각, 아래로 어두운 덩이. 높이 약 0.5m, 발밑 칸을 막는다.')
def _debris(c):
    for y in range(16, 32):                                                                  # 더미 몸통(언덕 꼴)
        half = 4 + (y - 16) * 4 // 9 if y < 28 else 8
        for x in range(8 - half, 8 + half):
            px(c, x, y, K('conc', -2) if (x * 7 + y * 3) % 5 else K('yoru', -1))
    for (x, y, w, h, ramp, t) in ((3, 18, 6, 2, 'kinari', -1), (9, 20, 5, 2, 'conc', -1), (1, 24, 5, 2, 'shiro', -2),
                                  (10, 25, 5, 2, 'conc', 0), (5, 27, 6, 2, 'kinari', -2)):          # 석고판·콘크리트 덩이: 윗면 + 앞날
        rc(c, x, y, w, h, kc(ramp, t)); hl(c, x, y, w, kc(ramp, t + 1)); hl(c, x, y + h, w, kc(ramp, t - 2))
        outline(c, x - 1, y - 1, w + 2, h + 2, OL)
    for i in range(10): px(c, 1 + i, 23 - i // 2, DW(0)); px(c, 1 + i, 24 - i // 2, DW(-2))  # 부러진 각목
    for i in range(6): px(c, 9 + i, 29 - i // 3, DW(-1))
    px(c, 11, 18, DW(1)); px(c, 6, 30, K('daidai', -2))
    hl(c, 0, 31, 16, K('sumi', 0))


@R.obj('as-stairs-up-broken', '부서진 콘크리트 계단(위)', w=2, h=1, up=32, kind='wall', walk=[(0, 0), (1, 0)], stairs='up', use=('travel',),
       tags=('계단', '폐교', '階段'),
       place='폐교 복도 북쪽 벽 바로 아래(벽 가구 자리) — 위층 계단통과 같은 x',
       desc='버려진 학교의 2칸 폭 콘크리트 계단 — 북쪽 벽 속으로 오르는 디딤판은 이가 빠지고 잔해·낙엽이 얹혔으며, 쇠 손잡이와 난간은 녹슬었다. 발칸 두 칸에서 위층으로 이동.')
def _stairs_broken(c):
    SC._conc_stairs(c, 2)
    age(c, -1, (0, 0, 32, 48))
    for (x, y, w) in ((6, 37, 3), (17, 27, 4), (9, 17, 3)):                                # 이 빠진 디딤판 끝
        rc(c, x, y, w, 2, K('yoru', -2)); px(c, x, y - 1, K('conc', -3))
    for (x, y) in ((12, 41), (20, 36), (8, 26), (22, 20)): rc(c, x, y, 2, 1, K('conc', 0)); px(c, x, y + 1, K('conc', -3))   # 잔해 조각
    for (x, y) in ((5, 42), (24, 31), (14, 12)): leaf(c, x, y, -1, 'daidai')
    speck(c, 86, 90, (K('daidai', -2),), (26, 6, 32, 30))
    ivy(c, 2, 20, 47, 87, dense=45, up=True)


@R.obj('as-stairwell-down', '부서진 내려가는 계단통', w=2, h=2, up=16, kind='floor', use=('travel',), stairs='down', walk=((0, 1), (1, 1)),
       tags=('계단', '폐교', '階段', '난간'),
       place='폐교 위층 복도 한쪽 — 아래층 올라가는 계단과 같은 x',
       desc='버려진 학교 위층 바닥에 뚫린 내려가는 콘크리트 계단통 2×2 — 녹슬어 휜 쇠 난간(북·동·서), 남쪽이 열린 입구, 계단에 잔해와 낙엽. 윗줄 난간은 막히고 아랫줄 두 칸은 밟는다 — 그 칸에 아래층으로 가는 이동.')
def _well_broken(c):
    SC.R.objs['sc-stairwell-down']['draw'](c)
    age(c, -1, (0, 0, 32, 48))
    for x in range(12, 18): px(c, x, 16 + (x - 12) // 2, ST(-1)); px(c, x, 17 + (x - 12) // 2, ST(-3))   # 휜 난간
    for (x, y) in ((8, 27), (20, 31), (14, 35)): rc(c, x, y, 2, 1, K('conc', -1))
    for (x, y) in ((24, 23), (6, 38)): leaf(c, x, y, -1, 'daidai')
    speck(c, 88, 120, (K('daidai', -2), K('soil', -1)), (0, 4, 32, 20))


@R.obj('as-door-locked', '쇠사슬 감긴 문(잠긴 문)', kind='door', use=('travel', 'key'), tags=('폐교', '문', '잠긴 문', '과학실', '음악실'),
       place='폐교 가로 칸막이의 1칸 틈 칸 — 잠긴 방(과학실·음악실) 입구. 잠금은 이벤트로 단다',
       desc='녹슨 쇠사슬이 문틀에 X 자로 감기고 가운데 놋쇠 자물쇠가 매달린 나무 미닫이 문 — 문짝은 밀려 있지만 사슬이 길을 막는다(열쇠로 여는 자리). 아래 문턱 레일에 사슬 끝이 늘어졌다.')
def _door_locked(c):
    sc_draw(c, 'sc-classroom-door')
    age(c, -1)
    for i in range(11):                                                                   # 쇠사슬 X
        for (x, y) in ((3 + i, 5 + i), (12 - i, 5 + i)):
            px(c, x, y, ST(0) if i % 2 else ST(-2)); px(c, x, y + 1, OL if i % 2 else ST(1))
    rc(c, 6, 14, 4, 4, K('kii', -1)); outline(c, 5, 13, 6, 6, OL); px(c, 6, 14, K('kii', 1)); px(c, 8, 16, K('yoru', -2))   # 자물쇠
    vl(c, 6, 11, 2, ST(0)); vl(c, 9, 11, 2, ST(0)); hl(c, 7, 11, 2, ST(1))
    for x in range(4, 12, 2): px(c, x, 28 + x % 3, ST(-1))                                 # 늘어진 사슬 끝
    rust(c, 1, 6, 6, 1); rust(c, 14, 9, 5, 2)


@R.obj('as-shoe-locker-rot', '썩은 나무 신발장', w=2, h=1, up=16, kind='floor', use=('open', 'search'), tags=('폐교', '현관', '昇降口', '신발장'),
       place='폐교 昇降口 타일 바닥 — 줄이 흐트러지게, 몇은 넘어진 잔해 옆',
       desc='썩어 곰팡이 핀 옛 나무 신발장 2칸 — 높이 1.5m, 칸막이 몇 개가 부러지고 칸 안은 텅 빈 어둠, 남은 실내화 두어 짝은 누렇게 바랬다. 바닥에 서는 floor 종류.')
def _shoe_locker_rot(c):
    y = block3(c, 0, 3, 32, 29, 4, 'ita', 0, front_t=-1)
    for r in range(4):
        for k in range(5):
            x0, y0 = 2 + k * 6, y + r * 6
            rc(c, x0, y0, 5, 5, K('ita', -3)); hl(c, x0, y0 + 4, 5, DW(-2))
            if hs(k, r, 14) % 7 == 0:
                rc(c, x0 + 1, y0 + 2, 3, 2, K('kinari', -1)); hl(c, x0 + 1, y0 + 2, 3, K('kinari', 0))   # 바랜 실내화
        hl(c, 1, y + r * 6 + 5, 30, DW(0))
    for (x, yy) in ((8, y + 6), (20, y + 12)): rc(c, x, yy - 1, 1, 5, K('ita', -3))          # 부러진 칸막이
    vl(c, 13, y + 13, 5, K('ita', -3)); px(c, 14, y + 12, DW(-1))
    speck(c, 89, 140, (LF(-2), LF(-1)), (1, y, 31, 31))                                    # 곰팡이
    speck(c, 90, 220, (K('hodo', -1),), (1, 4, 31, 8))
    crack(c, 25, 4, 5, 6, K('ita', -3))
    hl(c, 1, 30, 30, K('ita', -3))


# ══ 덩굴·낙엽·빗물·비상등 ═══════════════════════════════════════════════════════
@R.obj('as-vines', '늘어진 담쟁이덩굴(벽)', w=1, kind='hang', hrows=2, tags=('폐교', '덩굴', '창', '복도'),
       place='폐교 벽면 윗줄 — 깨진 창 옆, 현관·복도 벽',
       desc='깨진 창으로 들어와 벽을 타고 늘어진 담쟁이덩굴 한 칸 — 위가 빽빽하고 아래로 갈수록 줄기 몇 가닥. 벽면에 거는 그림.')
def _vines_hang(c):
    for i, x in enumerate((3, 8, 12)):
        ivy(c, x, 0, 18 + hs(i, 9, 1) % 12, 90 + i, dense=75)
    for (x, y) in ((2, 1), (6, 2), (10, 1), (13, 3), (4, 4), (9, 5)): leaf(c, x, y, (0, 1, -1)[(x + y) % 3])


@R.obj('as-vines-floor', '바닥을 덮은 덩굴', kind='flat', use=('walk',), tags=('폐교', '덩굴', '현관', '복도'),
       place='폐교 현관·창가 바닥 — 벽 밑에서 바닥으로 번진 곳',
       desc='금 간 바닥 틈으로 번진 담쟁이덩굴 — 짙은 녹색 잎 송이와 기는 줄기. 밟는 바닥 무늬.')
def _vines_floor(c):
    for i, (x0, y0) in enumerate(((1, 2), (6, 9), (11, 3))):
        xx, yy = x0, y0
        for k in range(9):
            px(c, xx, yy, LF(-2))
            xx += 1; yy += hs(k, i, 4) % 3 - 1
            if k % 2: leaf(c, xx, yy - 1 if k % 4 == 1 else yy + 1, (0, -1, 1)[(k + i) % 3])


@R.obj('as-leaves', '낙엽', kind='flat', use=('walk',), tags=('폐교', '낙엽', '현관', '복도', '교실'),
       place='폐교 현관·깨진 창 아래·복도 바닥 — 바람에 쓸려 들어온 곳',
       desc='깨진 창과 무너진 현관으로 쓸려 들어온 마른 낙엽 몇 장과 잔가지 — 주황·노랑·흙색. 밟는 바닥 무늬.')
def _leaves(c):
    for i, (x, y) in enumerate(((3, 3), (10, 2), (6, 8), (13, 9), (2, 12), (9, 13), (12, 5))):
        ramp, t = (('daidai', -1), ('kii', -1), ('soil', 0), ('daidai', 0), ('soil', 1), ('kii', 0), ('ki', -1))[i]
        px(c, x, y, kc(ramp, t)); px(c, x + 1, y, kc(ramp, t)); px(c, x - 1, y, kc(ramp, t + 1)); px(c, x, y - 1, kc(ramp, t + 1))
        px(c, x + 1, y + 1, kc(ramp, t - 1)); px(c, x + 2, y + 1, K('soil', -1))
    for i in range(5): px(c, 4 + i, 6 - i // 2, K('soil', -1))


@R.obj('as-puddle', '빗물 웅덩이', kind='flat', use=('walk',), tags=('폐교', '물', '복도', '교실'),
       place='폐교 복도·교실 — 무너진 천장·깨진 창 아래 바닥',
       desc='새는 천장에서 떨어진 빗물 웅덩이 — 어두운 물빛에 창빛 한 줄이 비치고 가장자리는 젖어 짙다. 밟는 바닥 무늬.')
def _puddle(c):
    lob = ((7, 8, 5.6, 3.4), (11.5, 10.5, 3.6, 2.6), (4, 11, 3, 2.0))                      # 세 덩이가 이어진 얕은 웅덩이(평평 — 아래 테두리 없음)
    def wet(x, y): return any(((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1 for cx, cy, rx, ry in lob)
    for y in range(16):
        for x in range(16):
            if wet(x, y):
                top = not wet(x, y - 1)
                px(c, x, y, GL(-2) if top else GL(-1) if (x + 2 * y) % 3 else GL(-2))
    for i in range(6): px(c, 4 + i, 7 + i // 3, GL(1))                                      # 창빛 반사
    px(c, 5, 7, GL(2)); hl(c, 10, 10, 3, GL(0)); px(c, 3, 11, GL(0))
    for (x, y) in ((9, 4), (15, 8), (2, 9)): px(c, x, y, GL(-1))                             # 튄 물방울


@R.obj('as-exit-light', '꺼져 가는 비상구 등', w=1, kind='hang', hrows=1, use=('light',), tags=('폐교', '복도', '조명', '비상등'),
       place='폐교 복도·현관 벽면 윗줄(문 위쪽)',
       desc='어둠 속에 희미하게 남은 비상구 유도등 — 짙은 녹색 판에 흰 화살표만(사람 그림 없음), 오른쪽 위 빨간 작은 점등. 녹슨 쇠 받침.')
def _exit_light(c):
    rc(c, 1, 4, 14, 8, K('midori', -2)); outline(c, 0, 3, 16, 10, OL); hl(c, 1, 4, 14, K('midori', -1))
    hl(c, 3, 8, 8, WH(-1)); px(c, 9, 7, WH(-1)); px(c, 9, 9, WH(-1)); px(c, 8, 6, WH(-1)); px(c, 8, 10, WH(-1))   # 화살표
    px(c, 13, 5, K('aka', 1)); px(c, 12, 5, K('aka', -1))
    hl(c, 2, 2, 12, ST(-1)); px(c, 2, 13, K('daidai', -2))


# ══ 보물·단서 자리 ═════════════════════════════════════════════════════════════
@R.obj('as-item-diary', '일기장 상자', w=1, h=1, kind='floor', use=('search',), tags=('폐교', '단서', '보물'),
       place='폐교 막다른 곳(교실 구석·도서실 미로 끝) — 단서 자리',
       desc='뚜껑이 반쯤 열린 낡은 골판지 상자 — 안에 남색 표지 일기장 한 권과 누런 종이 몇 장(글자 없이 회색 줄뿐). 조사하면 단서.')
def _item_diary(c):
    rc(c, 2, 4, 12, 5, K('soil', 1)); outline(c, 1, 3, 14, 12, OL)                      # 상자 위 입구(T 5)
    rc(c, 3, 5, 10, 3, K('soil', -1))
    rc(c, 4, 5, 6, 3, K('kon', -1)); hl(c, 4, 5, 6, K('kon', 1)); px(c, 9, 7, K('kii', -1))   # 일기장
    rc(c, 10, 5, 3, 2, K('kinari', 0)); hl(c, 10, 6, 3, K('kinari', -1))
    hl(c, 2, 9, 12, K('soil', 2))                                                         # 앞 가장자리
    rc(c, 2, 10, 12, 4, K('soil', 0)); hl(c, 2, 10, 12, K('soil', -2)); vl(c, 2, 11, 3, K('soil', 1))
    rc(c, 0, 1, 7, 3, K('soil', 1)); outline(c, 0, 0, 8, 4, OL); hl(c, 1, 1, 5, K('soil', 2))   # 젖혀진 뚜껑
    speck(c, 92, 200, (K('soil', -1),), (2, 10, 14, 14))


@R.obj('as-item-key-hook', '열쇠 고리판', w=1, kind='hang', hrows=2, use=('key', 'search'), tags=('폐교', '교무실', '열쇠', '단서'),
       place='폐교 교무실 벽면 윗줄(문 가까이) — 잠긴 방 열쇠를 찾는 자리',
       desc='교무실 벽의 먼지 앉은 나무 열쇠 고리판 — 고리 여섯 중 다섯은 비고, 하나에 빨간 꼬리표 달린 놋쇠 열쇠가 걸려 있다(글자 없음).')
def _item_key_hook(c):
    rc(c, 2, 3, 12, 17, DW(-1)); outline(c, 1, 2, 14, 19, OL); hl(c, 2, 3, 12, DW(1)); vl(c, 2, 3, 17, DW(0))
    for r in range(2):
        for k in range(3):
            x, y = 4 + k * 4, 6 + r * 7
            px(c, x, y, ST(1)); px(c, x, y + 1, ST(-1))
    rc(c, 8, 8, 2, 4, K('kii', 0)); px(c, 8, 8, K('kii', 1)); px(c, 9, 12, K('kii', -1)); px(c, 10, 11, K('kii', -1))   # 열쇠
    rc(c, 7, 13, 3, 3, K('aka', 0)); px(c, 7, 13, K('aka', 1))                              # 꼬리표
    speck(c, 93, 180, (K('hodo', 0),), (2, 3, 14, 5))
    crack(c, 4, 14, 5, 2, K('ita', -3))


@R.obj('as-item-toolbox', '녹슨 공구함', w=1, h=1, kind='floor', use=('search',), tags=('폐교', '보물', '공구'),
       place='폐교 막다른 곳(무너진 복도 끝·과학실 구석) — 보물 자리',
       desc='뚜껑 닫힌 빨간 철제 공구함 — 칠이 벗겨져 녹이 번지고 위에 쇠 손잡이, 앞에 놋쇠 걸쇠. 조사하면 도구가 나온다.')
def _item_toolbox(c):
    vl(c, 5, 3, 3, ST(0)); vl(c, 10, 3, 3, ST(-1)); hl(c, 5, 2, 6, ST(1))                  # 손잡이
    rc(c, 2, 6, 12, 4, K('aka', 0)); hl(c, 2, 6, 12, K('aka', 1)); outline(c, 1, 5, 14, 10, OL)   # 윗면
    hl(c, 2, 10, 12, K('aka', 1))
    rc(c, 2, 11, 12, 3, K('aka', -1)); hl(c, 2, 11, 12, K('aka', -2))
    rc(c, 7, 11, 2, 2, K('kii', 0))
    speck(c, 94, 220, (K('daidai', -2), K('soil', -1)), (2, 6, 14, 14))


@R.obj('as-item-photo-box', '사진 상자', w=1, h=1, kind='floor', use=('search',), tags=('폐교', '단서', '보물', '사진'),
       place='폐교 막다른 곳(과학실 준비 구석·도서실) — 단서 자리',
       desc='뚜껑이 살짝 어긋난 남색 양철 과자 상자 — 틈으로 흰 사진 테두리 모서리만 보인다(사진 속은 안 보인다). 조사하면 단서.')
def _item_photo_box(c):
    rc(c, 2, 4, 12, 5, K('kon', 0)); outline(c, 1, 3, 14, 11, OL); hl(c, 2, 4, 12, K('kon', 1)); vl(c, 2, 4, 5, K('kon', 1))   # 뚜껑 윗면
    disc(c, 8, 6.5, 2.5, 1.2, K('kii', -1))                                                 # 뚜껑 무늬(둥근 띠)
    hl(c, 2, 9, 12, K('kon', 2))
    rc(c, 2, 10, 12, 3, K('kon', -1)); hl(c, 2, 10, 12, K('kon', -2))
    rc(c, 10, 9, 4, 1, WH(1)); px(c, 13, 10, WH(0))                                         # 어긋난 틈의 사진 모서리
    speck(c, 95, 60, (K('daidai', -2),), (2, 4, 14, 13))


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)
