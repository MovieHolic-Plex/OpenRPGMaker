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


def _door_open_wood(c):
    # 양실 문: 밝은 나무 문틀 + 복도 쪽으로 젖혀져 비스듬히 선 갈색 판문(닫힌 문 W_(1) 재질).
    _posts(c, W_(-2), W_(2), W_(3), W_(0))
    _doorway_shade(c, 4, W_(-2))
    _threshold(c, W_(3), W_(2), W_(-2))
    _leaf(c, W_, 4, 6, 7, 22, 1, panels=((3, 9), (12, None)))
    c.P(9, 17, ST(3)); c.P(9, 18, ST(2)); c.P(10, 18, ST(-2))              # 손잡이(자유 끝 쪽)


def _door_open_toilet(c):
    # 화장실 문: 크림색 문틀 + 젖혀진 크림색 문짝(위에 서리유리 창·아래 환기 살)
    _posts(c, K('sumi', 0), KI(2), KI(3), KI(0))
    _doorway_shade(c, 4, K('sumi', 0))
    _threshold(c, KI(3), KI(2), KI(-1))
    _leaf(c, KI, 4, 6, 7, 22, 1, flat=True)
    for u in range(2, 5):                                                     # 서리유리 창(위쪽, 문짝 따라 기운다)
        sh = (u * 1 + 5) // 6
        for v in range(3, 10):
            c.P(4 + u, 6 + v + sh, GL(2) if (u == 1 or v == 3) else GL(-2) if v < 9 else GL(-3))
        c.P(4 + u, 6 + 2 + sh, KI(-2)); c.P(4 + u, 6 + 10 + sh, KI(-2))
    for u in range(2, 5):
        sh = (u * 1 + 5) // 6
        for v in (14, 16, 18): c.P(4 + u, 6 + v + sh, KI(-1))                 # 환기 살
    c.P(9, 17, ST(3)); c.P(9, 18, ST(2)); c.P(10, 18, ST(-2))              # 레버


def _kamoi_shikii(c, post, hi, lo, dk):
    """어두운 나무: 기둥 4px + 위 가모이(鴨居)·아래 시키이(敷居) 두 줄 레일."""
    c.R(0, 0, 4, 32, post); c.R(12, 0, 4, 32, post)
    c.VL(1, 0, 32, hi); c.VL(0, 0, 32, lo); c.VL(15, 0, 32, lo); c.VL(14, 0, 32, post); c.VL(3, 0, 32, dk); c.VL(12, 0, 32, hi); c.VL(13, 0, 32, post); c.VL(2, 0, 32, post)
    c.R(0, 0, 16, 5, post); c.HL(0, 0, 16, hi); c.HL(1, 1, 14, post)
    c.HL(2, 2, 12, lo); c.HL(3, 3, 10, dk); c.HL(3, 4, 10, lo)          # 가모이: 보 + 홈 + 입술
    c.P(0, 0, lo); c.P(15, 0, lo)
    # 시키이: 두 줄 레일 + 사이 홈
    c.HL(4, 28, 8, hi); c.HL(4, 29, 8, post); c.HL(4, 30, 8, dk); c.HL(4, 31, 8, lo)
    c.P(5, 29, hi); c.P(10, 29, hi)                                      # 레일 위쪽 반짝이는 선


def _door_open_fusuma(c):
    _kamoi_shikii(c, W_(-1), W_(1), W_(-3), W_(-2))
    _doorway_shade(c, 5, W_(-3))
    # 반쯤 열린 후스마 한 짝 — 왼쪽 6px 를 종이 면이 덮고 오른쪽 2px 로 안쪽 바닥이 비친다
    x0, y0, w, h = 4, 5, 7, 23
    c.R(x0, y0, w, h, KI(1))
    c.HL(x0, y0, w, W_(-2)); c.HL(x0, y0 + h - 1, w, W_(-3)); c.VL(x0, y0, h, W_(-2)); c.VL(x0 + w - 1, y0, h, W_(-2))   # 검은 칠 테두리
    c.HL(x0 + 1, y0 + 1, w - 2, KI(3)); c.VL(x0 + 1, y0 + 1, h - 2, KI(2))                                           # 종이 윗면·왼쪽 밝게
    c.HL(x0 + 1, y0 + 4, w - 2, W_(-1)); c.HL(x0 + 1, y0 + h - 5, w - 2, W_(-1))                                       # 위아래 띠(문양 경계)
    for x, y in ((7, 10), (6, 20), (9, 22)): c.P(x, y, K('conc', 1))                              # 먹 번짐
    c.R(9, 14, 1, 4, W_(-3)); c.P(9, 14, ST(2)); c.P(9, 17, ST(-1))                              # 손잡이 홈 + 금속 테
    c.VL(x0 + w, y0 + 1, h - 1, W_(-3))                                                                               # 문짝 두께 그림자 1px


@R.obj('door-open-western', '양실 문(열림)', kind='door', use=('travel',), tags=('문', '방', '양실', '복도'),
       place='가로 칸막이 1칸 틈 칸', desc='굵은 4px 나무 문틀 + 안쪽으로 젖혀진 7px 폭 갈색 판문 문짝(판넬 2칸·경첩 점·손잡이), 바닥 쪽 문턱선.')
def _dw(c): _door_open_wood(c)


@R.obj('door-open-toilet', '화장실 문(열림)', kind='door', use=('travel',), tags=('문', '화장실', '탈의실'),
       place='가로 칸막이 1칸 틈 칸', desc='굵은 4px 크림색 문틀 + 젖혀진 7px 폭 크림색 문짝(서리유리 창·환기 살·레버·경첩 점), 바닥 쪽 문턱선.')
def _dt(c): _door_open_toilet(c)


@R.obj('fusuma-open', '후스마(열림)', kind='door', use=('travel',), tags=('문', '화실', '襖'),
       place='가로 칸막이 1칸 틈 칸', desc='어두운 나무 기둥·가모이·시키이 두 줄 레일, 한쪽으로 밀려 7px 폭 종이 면이 보이는 후스마 한 짝(검은 테·손잡이 홈).')
def _df(c): _door_open_fusuma(c)


@R.obj('genkan-door', '현관문 문턱', kind='flat', use=('travel', 'walk'), tags=('현관', '문'),
       place='맨 아래 출입구 틈 칸', desc='위에서 본 현관 미닫이문 문턱 — 알루미늄 레일 2줄, 좌우 문틀, 한쪽으로 밀린 유리문 끝.')
def _gd(c):
    cn = lambda t: K('conc', t)
    c.R(0, 0, 16, 16, cn(0))                                           # 토간 콘크리트 바닥(어둡게 — 바깥 벽의 어두운 칸 사이에서 눈부시지 않게)
    for x, y in ((5, 1), (11, 2), (8, 13), (3, 14), (13, 12), (6, 9), (10, 7)): c.P(x, y, cn(1))
    c.R(0, 0, 3, 16, W_(-1)); c.R(13, 0, 3, 16, W_(-1))                  # 좌우 문틀 3px
    c.VL(0, 0, 16, W_(-3)); c.VL(15, 0, 16, W_(-3)); c.VL(1, 0, 16, W_(1)); c.VL(14, 0, 16, W_(0)); c.VL(2, 0, 16, W_(2)); c.VL(13, 0, 16, W_(-2))
    for y in (3, 9):                                                   # 알루미늄 레일 2줄(바깥 위·안쪽 아래), 사이 홈
        c.HL(3, y, 10, ST(3)); c.HL(3, y + 1, 10, ST(2)); c.HL(3, y + 2, 10, ST(-1)); c.HL(3, y + 3, 10, cn(-1))
    # 한쪽(왼쪽)으로 밀린 유리문 끝 — 바깥 레일 위, 알루미늄 틀 + 유리
    c.R(3, 1, 6, 6, ST(2)); c.HL(3, 1, 6, ST(3)); c.HL(3, 6, 6, ST(-1))
    c.R(4, 2, 4, 3, GL(2)); c.P(4, 2, GL(5)); c.P(5, 2, GL(4)); c.P(7, 4, GL(0))
    c.VL(8, 1, 6, ST(-1)); c.R(7, 3, 1, 2, ST(3))                       # 문짝 끝 + 당김 손잡이


# ───────────────────────── 옆문(kind sidedoor) — 세로 칸막이 3줄 틈 ─────────────────────────
# 그림 16×48: 위 두 줄(0~31) = 틈 위 칸막이 끝 벽면(남쪽 끝, 앞에서 본 16px) 위에 겹친다(★), 아랫줄(32~47) = 통로 칸(2층, 통로는 동서로 지난다).
# 벽 두께 양쪽 가장자리에 문틀 기둥(왼쪽 밝고 오른쪽 어둡다) + 가로 상인방, 통로 가운데는 투명(벽지·바닥이 비친다).
# 통로 바닥에는 문턱 레일이 남북으로(화면 세로) 놓인다.
def _side_frame(c):
    # 기둥: 서쪽 면(왼쪽)·동쪽 면(오른쪽) 문틀 3px, 맨 아래 받침
    c.R(0, 0, 3, 32, W_(2)); c.VL(0, 0, 32, W_(-2)); c.VL(1, 0, 32, W_(3)); c.VL(2, 0, 32, W_(0))
    c.R(13, 0, 3, 32, W_(2)); c.VL(13, 0, 32, W_(0)); c.VL(14, 0, 32, W_(2)); c.VL(15, 0, 32, W_(-2))
    c.R(0, 29, 3, 3, W_(0)); c.R(13, 29, 3, 3, W_(0)); c.HL(0, 31, 3, W_(-2)); c.HL(13, 31, 3, W_(-2))   # 기둥 받침(굽도리)
    # 상인방: 기둥 사이를 가로지르는 5px 보 + 밑 그늘
    c.R(0, 22, 16, 6, W_(2)); c.HL(0, 22, 16, W_(3)); c.HL(1, 23, 14, W_(2))
    c.HL(1, 26, 14, W_(0)); c.HL(0, 27, 16, W_(-2)); c.VL(0, 22, 6, W_(-2)); c.VL(15, 22, 6, W_(-2))
    c.HL(3, 28, 10, W_(-2))
    for x in range(3, 13, 2): c.P(x, 29, W_(-2))              # 보 밑 그늘(걸러 찍기)


def _side_sill(c, rails):
    # 통로 바닥의 문턱 — 남북으로 놓인 레일(화면 세로). rails = [(x0, 폭)] 목록. 윗면 밝게·아래 어둡게.
    for x0, w in rails:
        c.VL(x0, 32, 15, W_(3))
        for i in range(1, w - 1): c.VL(x0 + i, 32, 15, W_(2))
        c.VL(x0 + w - 1, 32, 15, W_(-2))
        c.HL(x0, 32, w, W_(3)); c.HL(x0, 46, w, W_(-2))


def _side(c, leaf):
    _side_frame(c)
    _side_sill(c, [(12, 3)])
    # 안쪽으로 젖혀진 여닫이 — 왼쪽 기둥 경첩에서 통로 쪽(남쪽)으로 비스듬히 선 9px 폭 문짝(칸의 절반 넘게). 판넬 둘·경첩 점·손잡이.
    _leaf(c, W_, 3, 28, 9, 16, 2, panels=((2, 6), (8, 12)))
    c.P(9, 37, ST(3)); c.P(9, 38, ST(2)); c.P(10, 38, ST(-2))         # 손잡이(문 앞면 쪽)


def _side_slide(c):
    _side_frame(c)
    _side_sill(c, [(2, 2), (13, 2)])
    # 벽 속으로 반쯤 밀린 미닫이 — 폭 7px 크림색 판 + 검은 테 + 손잡이 홈. 오른쪽은 비어 통로가 보인다.
    x0, y0, w, h = 3, 28, 9, 17
    c.R(x0, y0, w, h, KI(1))
    c.HL(x0, y0, w, W_(-2)); c.HL(x0, y0 + h - 1, w, W_(-3)); c.VL(x0, y0, h, W_(-2)); c.VL(x0 + w - 1, y0, h, W_(-2))
    c.HL(x0 + 1, y0 + 1, w - 2, KI(3)); c.VL(x0 + 1, y0 + 1, h - 2, KI(2))
    c.HL(x0 + 1, y0 + 4, w - 2, W_(-1)); c.HL(x0 + 1, y0 + h - 4, w - 2, W_(-1))
    c.R(9, 34, 2, 5, W_(-3)); c.P(9, 34, ST(2)); c.P(10, 34, W_(-1)); c.P(9, 38, ST(-1))       # 손잡이 홈 + 금속 테
    c.VL(x0 + w, y0 + 1, h - 1, W_(-3))


@R.obj('door-side-western', '옆문(열림)', kind='sidedoor', use=('travel',), tags=('문', '방', '복도', '탈의실', '거실'), place='세로 칸막이 3줄 틈의 통로 칸(셋째 줄)', desc='세로 벽 끝 양쪽 밝은 나무 문틀 기둥 + 상인방, 안쪽으로 젖혀진 9px 폭 갈색 판문 문짝(판넬 2칸·경첩 점·손잡이), 통로 바닥에 남북 문턱 레일 1줄, 가운데는 투명.')
def _sw(c): _side(c, W_(1))


@R.obj('door-side-sliding', '미닫이 옆문(열림)', kind='sidedoor', use=('travel',), tags=('문', '욕실', '탈의실', '화실', '미닫이'), place='세로 칸막이 3줄 틈의 통로 칸(셋째 줄)', desc='세로 벽 끝 양쪽 나무 문틀 기둥 + 상인방, 벽 속으로 반쯤 밀려 9px 폭 면과 손잡이 홈이 보이는 크림색 미닫이, 통로 바닥에 남북 문턱 레일 2줄, 가운데는 투명.')
def _ss(c): _side_slide(c)


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK))
