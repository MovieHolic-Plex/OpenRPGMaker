#!/usr/bin/env python3
"""jp_city 블록 interior_doors — 일본 실내: 방 사이 통로에 다는 열린 문(kind door)과 현관 바깥문 문턱.
  python3 scripts/content/jp-city/blocks/interior_doors.py     # selftest + tiledata/jp-city/blocks/interior_doors/_all-x3.png
문(kind door)은 가로 칸막이('#' 줄)의 1칸 틈 칸 (x,y) 에 단다. 그림 16×32 = 틈 아래 벽면 높이 두 줄(윗줄 ★ · 아랫줄 2층 밟음).
틈 칸 자체의 인방(천장 띠)은 ikit 가 덧붙인다. 통로는 막지 않는다 — 문짝은 열려 있다(옆으로 밀렸거나 안쪽으로 젖혀졌다).
문 안쪽(통로)은 투명 — 아래 바닥이 비친다. 좌우 1px 은 문틀 색으로 채워 옆 벽지와 이어진다."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT   # noqa: E402,F401

BLOCK = 'interior_doors'
R = Registry(BLOCK, '열린 방문·현관문')
W_ = lambda t: K('ita', t)
KI = lambda t: K('kinari', t)
ST = lambda t: K('tekko', t)
GL = lambda t: K('garasu', t)
SH = lambda t: K('shiro', t)
# 통로 안쪽 가로 범위 x 3..12, 세로 head 아래 ~ 문턱 위. 안쪽은 칠하지 않는다(투명).


def _posts(c, outer, mid, hi, lo, head_h=4):
    """좌우 문틀 기둥 4px(왼쪽 밝고 오른쪽 어둡다) + 위 문틀 head_h px. 바깥 1px 은 옆 벽지와 이어지는 외곽색."""
    c.R(0, 0, 4, 32, mid); c.R(12, 0, 4, 32, mid)
    c.VL(0, 0, 32, outer); c.VL(15, 0, 32, outer)
    c.VL(1, 0, 32, hi); c.VL(2, 0, 32, mid); c.VL(3, 0, 32, lo)
    c.VL(12, 0, 32, hi); c.VL(13, 0, 32, mid); c.VL(14, 0, 32, lo)
    c.R(0, 0, 16, head_h, mid); c.HL(0, 0, 16, hi); c.HL(1, head_h - 1, 14, lo)
    c.P(0, 0, outer); c.P(15, 0, outer)
    c.VL(0, 0, head_h, outer); c.VL(15, 0, head_h, outer)


def _threshold(c, hi, mid, lo):
    """바닥 쪽 문턱 — 통로 폭 가로 3줄(윗면 밝게·앞 모서리 어둡게)."""
    c.HL(4, 29, 8, hi); c.HL(4, 30, 8, mid); c.HL(4, 31, 8, lo)


def _doorway_shade(c, y0, dark):
    """상인방 밑 통로 그늘 — 두 줄(위 가득·아래 걸러). 바닥이 비치되 판때기처럼 읽히지 않게 윗부분을 눌러 준다."""
    c.HL(4, y0, 8, dark)
    for x in range(4, 12, 2): c.P(x, y0 + 1, dark)


def _leaf(c, M, x0, ytop, w, h, shear, panels=((2, 9), (12, None)), flat=False):
    """젖혀진 여닫이 한 짝 — 왼쪽 경첩 기둥에서 앞(남쪽)으로 비스듬히 선 평행사변형(자유 끝이 shear px 낮다).
    열 u: 0=경첩쪽 어두운 테 · 1..w-2=면(판넬 안쪽은 위 어둡고 아래 밝은 오목) · w-1=문 두께 밝은 가장자리.
    행 v: 0=위 밝은 줄 · h-1=아래 어두운 줄. 문짝 밑 그림자 1줄 + 경첩 점(위·아래 두 곳)."""
    for u in range(w):
        sh = (u * shear + (w - 2)) // (w - 1)
        for v in range(h):
            if u == 0: col = M(-3)
            elif v == 0: col = M(3)
            elif v == h - 1: col = M(-3)
            elif u == w - 1: col = M(2)
            else:
                col = M(1)
                if not flat:
                    for p0, p1 in panels:
                        p1 = h - 3 if p1 is None else p1
                        if 2 <= u <= w - 3 and p0 <= v <= p1:               # 오목 판넬: 위·왼쪽 어둡고 아래·오른쪽 밝다
                            if v == p0 or u == 2: col = M(-2)
                            elif v == p1 or u == w - 3: col = M(3)
                            else: col = M(0)
            c.P(x0 + u, ytop + v + sh, col)
        c.P(x0 + u, ytop + h + sh, M(-3))                                       # 문짝 밑 그림자 1줄
    for hy in (3, h - 5):                                                         # 경첩 점: 경첩쪽 가장자리 위·아래
        c.P(x0, ytop + hy, ST(3)); c.P(x0, ytop + hy + 1, ST(2))


def M5(name):
    """5단 램프를 _leaf 의 7단 눈금(-3…+3)으로 — 판넬 오목 단계가 뭉개지지 않게 고른 대응."""
    m = {-3: -2, -2: -1, -1: -1, 0: 0, 1: 1, 2: 1, 3: 2}
    return lambda t: K(name, m[max(-3, min(3, t))])


YU = M5('yuka')          # 양실 문짝: 따뜻한 중간 나무(오렌지 갈색)
SO = M5('soil')          # LDK 옆문: 짙은 호두나무
MA = M5('mado')          # 탈의실 미닫이: 노란 결 나무(오동·삼나무)
SHM = M5('shiro')        # 흰 알루미늄·흰 칠
LI = lambda t: K('lino', t)
KO = lambda t: K('kon', t)


def _lp(c, x0, ytop, u, v, col, w, shear):
    """문짝 좌표 (u,v) → 그림 좌표(_leaf 와 같은 기울기)."""
    sh = (u * shear + (w - 2)) // (w - 1)
    c.P(x0 + u, ytop + v + sh, col)


def _door_open_wood(c):
    # 양실 문: 짙은 나무 문틀(케이싱) + 복도 쪽으로 젖혀진 오렌지 갈색 판문(오목 판넬 둘·놋쇠 손잡이).
    _posts(c, W_(-3), W_(-1), W_(1), W_(-2))
    _doorway_shade(c, 4, W_(-3))
    _threshold(c, W_(2), W_(0), W_(-3))
    _leaf(c, YU, 4, 6, 7, 22, 1, panels=((3, 9), (12, None)))
    _lp(c, 4, 6, 5, 11, K('kii', 2), 7, 1); _lp(c, 4, 6, 5, 12, K('kii', 0), 7, 1)   # 놋쇠 손잡이


def _door_open_toilet(c):
    # 화장실 문: 흰 문틀 + 좁게(5px) 젖혀진 흰 문짝, 문짝 대부분이 하늘빛 서리유리(점 무늬). 아래 환기 살.
    _posts(c, SH(-2), SH(0), SH(2), SH(-1))
    _doorway_shade(c, 4, SH(-2))
    _threshold(c, SH(2), SH(0), SH(-2))
    w, h, x0, y0 = 5, 22, 4, 6
    _leaf(c, SHM, x0, y0, w, h, 1, flat=True)
    for u in range(1, w - 1):                                                 # 서리유리 큰 창(v 2..14)
        for v in range(2, 15):
            col = GL(3) if (u + v) % 3 else SH(1)
            if v == 2: col = SH(2)
            if v == 14: col = GL(1)
            _lp(c, x0, y0, u, v, col, w, 1)
    for u in range(1, w - 1):
        for v in (16, 18): _lp(c, x0, y0, u, v, SH(-1), w, 1)                   # 환기 살
    _lp(c, x0, y0, 3, 10, ST(3), w, 1); _lp(c, x0, y0, 3, 11, ST(-1), w, 1)   # 레버(잠금 표시)
    _lp(c, x0, y0, 3, 12, K('aka', 0), w, 1)


def _kamoi_shikii(c, post, hi, lo, dk):
    """나무: 기둥 4px + 위 가모이(鴨居)·아래 시키이(敷居) 두 줄 레일."""
    c.R(0, 0, 4, 32, post); c.R(12, 0, 4, 32, post)
    c.VL(1, 0, 32, hi); c.VL(0, 0, 32, lo); c.VL(15, 0, 32, lo); c.VL(14, 0, 32, post); c.VL(3, 0, 32, dk); c.VL(12, 0, 32, hi); c.VL(13, 0, 32, post); c.VL(2, 0, 32, post)
    c.R(0, 0, 16, 5, post); c.HL(0, 0, 16, hi); c.HL(1, 1, 14, post)
    c.HL(2, 2, 12, lo); c.HL(3, 3, 10, dk); c.HL(3, 4, 10, lo)          # 가모이: 보 + 홈 + 입술
    c.P(0, 0, lo); c.P(15, 0, lo)
    c.HL(4, 28, 8, hi); c.HL(4, 29, 8, post); c.HL(4, 30, 8, dk); c.HL(4, 31, 8, lo)   # 시키이: 두 줄 레일 + 사이 홈
    c.P(5, 29, hi); c.P(10, 29, hi)


def _door_open_fusuma(c):
    _kamoi_shikii(c, W_(-1), W_(1), W_(-3), W_(-2))
    _doorway_shade(c, 5, W_(-3))
    # 반쯤 열린 후스마 한 짝 — 검은 옻칠 테(위 밝은 줄) + 미색 종이 + 가운데 남색 가라카미 문양 띠(마름모) + 금빛 점 + 둥근 히키테.
    x0, y0, w, h = 4, 5, 7, 23
    c.R(x0, y0, w, h, KI(1))
    for x, y in ((6, 8), (9, 10), (7, 22), (9, 24), (6, 25)): c.P(x, y, K('kii', 1))          # 종이에 흩뿌린 금박 점
    DIA = ('..#..', '.#.#.', '#...#', '.#.#.', '..#..', '.....')
    for j in range(8):                                                                          # 문양 띠: 남색 바탕 + 하늘빛 마름모 줄(가라카미)
        for i in range(w - 2):
            c.P(x0 + 1 + i, 11 + j, K('sora', 1) if DIA[j % 6][i % 5] == '#' else KO(-1))
    c.HL(x0 + 1, 10, w - 2, K('kii', 0)); c.HL(x0 + 1, 19, w - 2, K('kii', 0))                # 띠 위아래 금선
    c.HL(x0, y0, w, K('yoru', -1)); c.HL(x0, y0 + 1, w, K('yoru', 1))                         # 옻칠 테: 윗면(밝게) + 앞
    c.HL(x0, y0 + h - 1, w, K('sumi', -1)); c.VL(x0, y0, h, K('yoru', 0)); c.VL(x0 + w - 1, y0, h, K('sumi', 0))
    c.VL(x0 + 1, y0 + 2, h - 3, KI(2))
    c.R(8, 20, 2, 3, K('sumi', 0)); c.P(8, 20, K('kii', 1)); c.P(9, 22, K('kii', -1))          # 히키테(둥근 손잡이 홈, 금테)
    c.VL(x0 + w, y0 + 1, h - 1, W_(-3))                                                          # 문짝 두께 그림자 1px


def _door_open_shoji(c):
    # 쇼지: 밝은 노송나무 기둥·가모이 + 반쯤 밀린 흰 종이 문짝, 가는 짙은 나무 격자(구미코) + 아래 나무 허리판.
    _kamoi_shikii(c, W_(1), W_(3), W_(-1), W_(0))
    _doorway_shade(c, 5, W_(-1))
    x0, y0, w, h = 4, 5, 7, 23
    c.R(x0, y0, w, h, SH(1))
    c.HL(x0 + 1, y0 + 1, w - 2, SH(2))
    for x in (x0 + 2, x0 + 4): c.VL(x, y0 + 1, h - 6, W_(-1))                                   # 세로 살
    for y in range(y0 + 4, y0 + h - 5, 4): c.HL(x0 + 1, y, w - 2, W_(-1))                       # 가로 살
    c.R(x0 + 1, y0 + h - 5, w - 2, 4, W_(1)); c.HL(x0 + 1, y0 + h - 5, w - 2, W_(3)); c.HL(x0 + 1, y0 + h - 2, w - 2, W_(-1))   # 허리판
    c.HL(x0, y0, w, W_(3)); c.HL(x0, y0 + h - 1, w, W_(-2)); c.VL(x0, y0, h, W_(2)); c.VL(x0 + w - 1, y0, h, W_(-2))           # 문짝 테
    c.VL(x0 + w, y0 + 1, h - 1, W_(-3))


def _door_open_staff(c):
    # 패밀리 레스토랑 주방 스윙문: 회색 강철 문틀 + 젖혀진 스테인리스 문짝, 둥근 창(유리 + 테), 아래 킥 플레이트.
    _posts(c, ST(-3), ST(0), ST(2), ST(-2))
    _doorway_shade(c, 4, ST(-3))
    _threshold(c, ST(3), ST(1), ST(-3))
    x0, y0, w, h = 4, 6, 7, 22
    _leaf(c, ST, x0, y0, w, h, 1, flat=True)
    for (u, v) in ((2, 10), (3, 9), (4, 8), (2, 13), (3, 12)): _lp(c, x0, y0, u, v, ST(3), w, 1)   # 스테인리스 반사 사선
    ring = {(2, 3), (3, 3), (4, 3), (1, 4), (5, 4), (1, 5), (5, 5), (1, 6), (5, 6), (2, 7), (3, 7), (4, 7)}
    for (u, v) in ring: _lp(c, x0, y0, u, v, ST(-2), w, 1)
    for u in (2, 3, 4):
        for v in (4, 5, 6): _lp(c, x0, y0, u, v, GL(-1), w, 1)
    _lp(c, x0, y0, 2, 4, GL(3), w, 1); _lp(c, x0, y0, 3, 4, GL(1), w, 1)
    for u in range(1, w - 1):                                                   # 킥 플레이트(어둡게 + 위 밝은 테 + 나사 점)
        for v in range(h - 6, h - 1): _lp(c, x0, y0, u, v, ST(-1), w, 1)
        _lp(c, x0, y0, u, h - 6, ST(3), w, 1)
    _lp(c, x0, y0, 1, h - 4, ST(2), w, 1); _lp(c, x0, y0, w - 2, h - 4, ST(2), w, 1)
    _lp(c, x0, y0, 5, 11, ST(-2), w, 1); _lp(c, x0, y0, 5, 12, ST(-2), w, 1)                   # 미는 판


@R.obj('door-open-western', '양실 문(열림)', kind='door', use=('travel',), tags=('문', '방', '양실', '복도'),
       place='가로 칸막이 1칸 틈 칸', desc='짙은 갈색 4px 나무 문틀(케이싱) + 안쪽으로 젖혀진 7px 폭 오렌지 갈색 판문(오목 판넬 2칸·경첩 점·놋쇠 손잡이), 바닥 쪽 나무 문턱선.')
def _dw(c): _door_open_wood(c)


@R.obj('door-open-toilet', '화장실 문(열림)', kind='door', use=('travel',), tags=('문', '화장실', '탈의실'),
       place='가로 칸막이 1칸 틈 칸', desc='흰 4px 문틀 + 좁게(5px) 젖혀진 흰 문짝 — 문짝 대부분이 하늘빛 서리유리(점 무늬), 아래 환기 살·잠금 레버, 흰 문턱선.')
def _dt(c): _door_open_toilet(c)


@R.obj('fusuma-open', '후스마(열림)', kind='door', use=('travel',), tags=('문', '화실', '襖'),
       place='가로 칸막이 1칸 틈 칸', desc='어두운 나무 기둥·가모이·시키이 두 줄 레일, 한쪽으로 밀린 후스마 한 짝 — 검은 옻칠 테, 미색 종이에 금박 점, 가운데 남색 마름모 가라카미 문양 띠(금선 둘), 둥근 히키테.')
def _df(c): _door_open_fusuma(c)


@R.obj('shoji-open', '쇼지(열림)', kind='door', use=('travel',), tags=('문', '화실', '障子', '쇼지', '툇마루'),
       place='가로 칸막이 1칸 틈 칸(화실·툇마루 사이)', desc='밝은 노송나무 기둥·가모이·시키이, 반쯤 밀린 쇼지 한 짝 — 흰 종이에 짙은 나무 격자(세로 살 둘·가로 살 4px 간격), 아래 나무 허리판.')
def _dsj(c): _door_open_shoji(c)


@R.obj('door-open-staff', '주방 스윙문(열림)', kind='door', use=('travel',), tags=('문', '주방', '패밀리 레스토랑', '식당', '직원'),
       place='홀과 주방 사이 가로 칸막이 1칸 틈 칸', desc='회색 강철 문틀 + 젖혀진 스테인리스 스윙 문짝(헤어라인 결·둥근 유리창·아래 킥 플레이트), 금속 문턱선.')
def _dst(c): _door_open_staff(c)


@R.obj('genkan-door', '현관문 문턱', kind='flat', use=('travel', 'walk'), tags=('현관', '문'),
       place='맨 아래 출입구 틈 칸', desc='현관 미닫이 유리문 문턱 — 짙은 알루미늄 틀의 유리문(유리 세 칸)이 왼쪽으로 밀려 서 있고, 그 앞 은색 레일 2줄, 아래 토간 콘크리트.')
def _gd(c):
    cn = lambda t: K('conc', t)
    c.R(0, 0, 16, 16, cn(0))
    for x, y in ((11, 13), (8, 14), (3, 15), (13, 12), (6, 13)): c.P(x, y, cn(1))
    c.R(0, 0, 2, 16, ST(-2)); c.R(14, 0, 2, 16, ST(-2)); c.VL(1, 0, 16, ST(0)); c.VL(14, 0, 16, ST(-1)); c.VL(0, 0, 16, ST(-3)); c.VL(15, 0, 16, ST(-3))   # 좌우 문틀(짙은 알루미늄)
    # 왼쪽으로 밀린 유리문 앞면(9px) — 짙은 알루미늄 틀 + 유리 2×2 칸(세로 살·가로 살), 오른쪽 열린 틈으로 바닥.
    c.R(2, 0, 9, 9, ST(-2)); c.HL(2, 0, 9, ST(0))
    for gx in (3, 7):
        for gy in (1, 5):
            c.R(gx, gy, 3, 3, GL(0)); c.P(gx, gy, GL(3)); c.P(gx + 1, gy, GL(2)); c.P(gx, gy + 1, GL(2))
            c.P(gx + 2, gy + 2, GL(-2))
    c.VL(6, 1, 7, ST(-1)); c.HL(3, 4, 7, ST(-1))
    c.VL(10, 0, 9, ST(-3)); c.R(10, 3, 1, 3, ST(2))                         # 문짝 끝 + 당김 손잡이
    c.HL(2, 9, 12, ST(-3))
    for y in (10, 12):                                                     # 은색 레일 2줄
        c.HL(2, y, 12, ST(3)); c.HL(2, y + 1, 12, ST(-1))
    c.HL(2, 14, 12, cn(-1))


# ───────────────────────── 옆문(kind sidedoor) — 세로 칸막이 3줄 틈 ─────────────────────────
# 그림 16×48: 위 두 줄(0~31) = 틈 위 칸막이 끝 벽면(남쪽 끝, 앞에서 본 16px) 위에 겹친다(★), 아랫줄(32~47) = 통로 칸(2층, 통로는 동서로 지난다).
# 벽 두께 양쪽 가장자리에 문틀 기둥(왼쪽 밝고 오른쪽 어둡다) + 가로 상인방, 통로 가운데는 투명(벽지·바닥이 비친다).
# 통로 바닥에는 문턱 레일이 남북으로(화면 세로) 놓인다.
def _side_frame(c, M=W_):
    # 기둥: 서쪽 면(왼쪽)·동쪽 면(오른쪽) 문틀 3px, 맨 아래 받침. M = 문틀 재질 램프(나무 W_, 흰 알루미늄 SHM).
    c.R(0, 0, 3, 32, M(2)); c.VL(0, 0, 32, M(-2)); c.VL(1, 0, 32, M(3)); c.VL(2, 0, 32, M(0))
    c.R(13, 0, 3, 32, M(2)); c.VL(13, 0, 32, M(0)); c.VL(14, 0, 32, M(2)); c.VL(15, 0, 32, M(-2))
    c.R(0, 29, 3, 3, M(0)); c.R(13, 29, 3, 3, M(0)); c.HL(0, 31, 3, M(-2)); c.HL(13, 31, 3, M(-2))   # 기둥 받침(굽도리)
    # 상인방: 기둥 사이를 가로지르는 5px 보 + 밑 그늘
    c.R(0, 22, 16, 6, M(2)); c.HL(0, 22, 16, M(3)); c.HL(1, 23, 14, M(2))
    c.HL(1, 26, 14, M(0)); c.HL(0, 27, 16, M(-2)); c.VL(0, 22, 6, M(-2)); c.VL(15, 22, 6, M(-2))
    c.HL(3, 28, 10, W_(-2))
    for x in range(3, 13, 2): c.P(x, 29, W_(-2))              # 보 밑 그늘(걸러 찍기)


def _side_sill(c, rails, M=W_):
    # 통로 바닥의 문턱 — 남북으로 놓인 레일(화면 세로). rails = [(x0, 폭)] 목록. 윗면 밝게·아래 어둡게.
    for x0, w in rails:
        c.VL(x0, 32, 15, M(3))
        for i in range(1, w - 1): c.VL(x0 + i, 32, 15, M(2))
        c.VL(x0 + w - 1, 32, 15, M(-2))
        c.HL(x0, 32, w, M(3)); c.HL(x0, 46, w, M(-2))


def _side(c):
    # LDK 문: 밝은 나무 문틀 + 짙은 호두나무 여닫이(세로 유리 띠 + 아래 판넬 하나), 은색 레버.
    _side_frame(c)
    _side_sill(c, [(12, 3)])
    x0, y0, w, h, shr = 3, 28, 9, 16, 2
    _leaf(c, SO, x0, y0, w, h, shr, panels=((10, 13),))
    for u in (3, 4, 5):                                                        # 세로 유리 띠(v 2..8)
        for v in range(2, 9):
            col = GL(1) if u > 3 else GL(3)
            if v == 2: col = GL(3)
            if u == 5 and v > 5: col = GL(-1)
            _lp(c, x0, y0, u, v, col, w, shr)
    for v in range(1, 10): _lp(c, x0, y0, 2, v, SO(-2), w, shr); _lp(c, x0, y0, 6, v, SO(2), w, shr)
    _lp(c, x0, y0, 7, 8, ST(3), w, shr); _lp(c, x0, y0, 7, 9, ST(-1), w, shr)   # 레버


def _side_slide(c):
    # 탈의실↔복도 미닫이: 나무 문틀 + 벽 속으로 반쯤 밀린 노란 결 나무 판문(세로 결 줄 + 작은 오목 손잡이 홈).
    _side_frame(c)
    _side_sill(c, [(2, 2), (13, 2)])
    x0, y0, w, h = 3, 28, 9, 17
    c.R(x0, y0, w, h, MA(1))
    for x, y1, y2 in ((5, 30, 38), (6, 33, 43), (8, 29, 36), (9, 37, 44), (7, 40, 44)): c.VL(x, y1, y2 - y1, MA(-1))   # 나뭇결
    c.P(5, 39, MA(0)); c.P(8, 37, MA(0))
    c.HL(x0, y0, w, MA(3)); c.HL(x0, y0 + h - 1, w, MA(-3)); c.VL(x0, y0, h, MA(-2)); c.VL(x0 + w - 1, y0, h, MA(-3))
    c.VL(x0 + 1, y0 + 1, h - 2, MA(2))
    c.R(9, 35, 2, 3, MA(-3)); c.HL(9, 35, 2, MA(-2)); c.P(10, 37, MA(2))         # 오목 손잡이 홈
    c.VL(x0 + w, y0 + 1, h - 1, W_(-3))


def _side_bath(c):
    # 욕실↔탈의실: 흰 알루미늄 문틀·상인방 + 반쯤 접힌 2폭 접이식 욕실문(흰 테, 하늘빛 서리유리, 가운데 접힘 경첩).
    _side_frame(c, SHM)
    _side_sill(c, [(2, 2), (12, 3)], SHM)
    x0, y0, h = 3, 28, 17
    for px0, pw, lit in ((x0, 4, True), (x0 + 4, 4, False)):                    # 접힌 두 폭: 앞 폭 밝게, 꺾인 뒤 폭 어둡게
        c.R(px0, y0, pw, h, SH(2) if lit else SH(0))
        c.HL(px0, y0, pw, SH(2)); c.HL(px0, y0 + h - 1, pw, SH(-2))
        for y in range(y0 + 2, y0 + h - 3):
            for x in range(px0 + 1, px0 + pw - 1):
                c.P(x, y, (GL(3) if (x + y) % 3 else SH(2)) if lit else (GL(2) if (x + y) % 3 else GL(3)))
        c.HL(px0 + 1, y0 + 1, pw - 2, SH(2))
    c.VL(x0 + 4, y0, h, SH(-2)); c.P(x0 + 4, y0 + 4, ST(3)); c.P(x0 + 4, y0 + 12, ST(3))   # 접힘 경첩
    c.VL(x0, y0, h, SH(-1)); c.R(x0 + 6, y0 + 7, 1, 3, ST(-1))                # 손잡이
    c.VL(x0 + 8, y0 + 1, h - 1, SH(-2))


@R.obj('door-side-western', 'LDK 옆문(열림)', kind='sidedoor', use=('travel',), tags=('문', '방', '복도', '거실', 'LDK'), place='세로 칸막이 3줄 틈의 통로 칸(셋째 줄)', desc='세로 벽 끝 양쪽 밝은 나무 문틀 기둥 + 상인방, 안쪽으로 젖혀진 9px 폭 짙은 호두나무 문짝(세로 유리 띠·아래 판넬·은색 레버), 통로 바닥에 남북 문턱 레일 1줄, 가운데는 투명.')
def _sw(c): _side(c)


@R.obj('door-side-sliding', '미닫이 옆문(열림)', kind='sidedoor', use=('travel',), tags=('문', '탈의실', '복도', '화실', '미닫이'), place='세로 칸막이 3줄 틈의 통로 칸(셋째 줄)', desc='세로 벽 끝 양쪽 나무 문틀 기둥 + 상인방, 벽 속으로 반쯤 밀린 9px 폭 노란 결 나무 판문(세로 나뭇결·작은 오목 손잡이 홈), 통로 바닥에 남북 문턱 레일 2줄, 가운데는 투명.')
def _ss(c): _side_slide(c)


@R.obj('door-side-bath', '욕실 접이문(열림)', kind='sidedoor', use=('travel',), tags=('문', '욕실', '탈의실', '접이문', '서리유리'), place='욕실과 탈의실 사이 세로 칸막이 3줄 틈의 통로 칸(셋째 줄)', desc='흰 알루미늄 문틀 기둥 + 상인방, 반쯤 접힌 2폭 욕실 접이문(흰 테·하늘빛 서리유리·접힘 경첩·손잡이), 통로 바닥에 흰 레일 2줄, 가운데는 투명.')
def _sb(c): _side_bath(c)


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK))
