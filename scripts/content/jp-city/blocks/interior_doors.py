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


def _posts(c, outer, mid, hi, lo, head_h=3, sill=None):
    """좌우 기둥 3px(왼쪽 밝고 오른쪽 어둡다) + 위 문틀 head_h px. 좌우 끝 1px 은 옆 벽지와 이어지는 문틀 색."""
    c.R(0, 0, 3, 32, mid); c.R(13, 0, 3, 32, mid)
    c.VL(0, 0, 32, outer); c.VL(15, 0, 32, outer)
    c.VL(1, 0, 32, hi); c.VL(14, 0, 32, mid)
    c.VL(2, 0, 32, lo); c.VL(13, 0, 32, lo)
    c.R(0, 0, 16, head_h, mid); c.HL(0, 0, 16, hi); c.HL(1, head_h - 1, 14, lo)
    c.P(0, 0, outer); c.P(15, 0, outer)


def _hinge(c, y):
    c.R(3, y, 1, 3, ST(2)); c.P(3, y, ST(3)); c.P(3, y + 2, ST(-1))


def _doorway_shade(c, y0, dark):
    """상인방 밑 통로 그늘 — 두 줄(위 가득·아래 걸러). 바닥이 비치되 판때기처럼 읽히지 않게 윗부분을 눌러 준다."""
    c.HL(3, y0, 10, dark)
    for x in range(3, 13, 2): c.P(x, y0 + 1, dark)


def _swung_leaf(c, face, edge, hi, shade, top=5):
    """안쪽(북쪽)으로 젖힌 여닫이 — 왼쪽 경첩 기둥 옆에 보이는 문짝 가장자리(4px). 바닥에는 그림자 한 줄."""
    c.R(3, top, 3, 24, face); c.R(4, top - 1, 2, 1, face)
    c.VL(3, top, 24, hi); c.VL(5, top - 1, 25, edge); c.VL(6, top, 25, hi)   # 문짝 두께(밝은 모서리)
    c.VL(7, top + 1, 23, shade)
    c.HL(3, top + 24, 5, shade)
    _hinge(c, top + 3); _hinge(c, 24)


def _door_open_wood(c):
    # 양실 문: 밝은 나무 문틀 + 안쪽으로 젖힌 갈색 문짝(닫힌 문 W_(1)/(−1) 와 같은 재질). 바깥 1px 는 닫힌 문처럼 어두운 외곽.
    _posts(c, W_(-2), W_(2), W_(3), W_(0), 3)
    _doorway_shade(c, 3, W_(-2))
    _swung_leaf(c, W_(1), W_(-1), W_(3), W_(-3))
    c.R(4, 12, 1, 4, W_(2)); c.R(4, 18, 1, 4, W_(2))                  # 문짝 판넬 두 개(닫힌 문과 같은 상하 분할)
    c.P(5, 15, ST(3)); c.P(5, 16, ST(2)); c.P(5, 17, ST(-2))           # 걸쇠
    c.HL(3, 29, 10, W_(3)); c.HL(3, 30, 10, W_(2)); c.HL(3, 31, 10, W_(-2))   # 문턱 1~2px


def _door_open_toilet(c):
    # 화장실 문: 크림색 문틀 + 젖힌 크림색 문짝, 짧은 서리유리 창 조각
    _posts(c, K('sumi', 0), KI(2), KI(3), KI(0), 3)
    _doorway_shade(c, 3, K('sumi', 0))
    c.R(3, 5, 3, 24, KI(2)); c.R(4, 4, 2, 1, KI(2))
    c.VL(3, 5, 24, KI(3)); c.VL(5, 4, 25, KI(0)); c.VL(6, 5, 25, KI(3)); c.VL(7, 6, 25, K('sumi', 0))
    c.HL(3, 29, 5, K('sumi', 0))
    c.R(3, 8, 2, 5, GL(-2)); c.P(3, 8, GL(2)); c.P(3, 9, GL(1)); c.P(4, 12, GL(-3))    # 서리유리
    c.HL(3, 20, 3, KI(0)); c.HL(3, 22, 3, KI(0)); c.HL(3, 24, 3, KI(0))               # 환기 살
    c.P(5, 17, ST(2)); c.P(5, 18, ST(-1)); c.P(4, 17, ST(3))                           # 레버
    c.HL(3, 29, 10, KI(1)); c.HL(3, 30, 10, KI(3)); c.HL(3, 31, 10, KI(0))              # 문턱
    c.HL(3, 29, 4, K('sumi', 0))
    _hinge(c, 7); _hinge(c, 24)


def _kamoi_shikii(c, post, hi, lo, dk):
    """어두운 나무: 기둥 + 위 가모이(鴨居)·아래 시키이(敷居) 두 줄 레일."""
    c.R(0, 0, 3, 32, post); c.R(13, 0, 3, 32, post)
    c.VL(1, 0, 32, hi); c.VL(0, 0, 32, lo); c.VL(15, 0, 32, lo); c.VL(14, 0, 32, post); c.VL(2, 0, 32, dk); c.VL(13, 0, 32, dk)
    c.R(0, 0, 16, 5, post); c.HL(0, 0, 16, hi); c.HL(1, 1, 14, post)
    c.HL(2, 2, 12, lo); c.HL(3, 3, 10, dk); c.HL(3, 4, 10, lo)          # 가모이: 보 + 홈 + 입술
    c.P(0, 0, lo); c.P(15, 0, lo)
    # 시키이: 두 줄 레일 + 사이 홈
    c.HL(3, 28, 10, hi); c.HL(3, 29, 10, post); c.HL(3, 30, 10, dk); c.HL(3, 31, 10, lo)
    c.P(4, 29, hi); c.P(9, 29, hi)                                       # 레일 위쪽 반짝이는 선


def _door_open_fusuma(c):
    _kamoi_shikii(c, W_(-1), W_(1), W_(-3), W_(-2))
    # 밀려 모인 후스마 한 짝의 끝 — 왼쪽 기둥 옆 3px
    _doorway_shade(c, 5, W_(-3))
    c.R(3, 5, 3, 23, KI(1)); c.HL(3, 5, 3, KI(2))
    c.VL(5, 5, 23, W_(-2)); c.VL(6, 5, 23, W_(-3))                   # 문짝 테두리 + 그림자
    c.P(3, 20, K('conc', 1)); c.P(4, 23, KI(0)); c.P(3, 25, KI(0)); c.P(4, 26, K('conc', 1))   # 먹 번짐 흔적
    c.R(4, 15, 1, 2, W_(-3))                                           # 손잡이 구멍


def _door_open_shoji(c):
    _kamoi_shikii(c, W_(0), W_(2), W_(-2), W_(-1))
    # 밀려 모인 쇼지 한 짝의 끝 — 틀 + 종이 + 격자
    _doorway_shade(c, 5, W_(-3))
    c.R(3, 5, 3, 23, SH(1)); c.VL(3, 5, 23, W_(1)); c.VL(5, 5, 23, W_(0)); c.VL(6, 5, 23, W_(-2))
    c.HL(3, 5, 3, W_(1)); c.HL(3, 27, 3, W_(1))
    for y in (11, 17, 23): c.HL(3, y, 3, W_(1))                       # 격자 가로살(6px 간격)
    c.R(4, 15, 1, 2, K('sumi', 0))                                    # 손잡이


@R.obj('door-open-western', '양실 문(열림)', kind='door', use=('travel',), tags=('문', '방', '양실', '복도'),
       place='가로 칸막이 1칸 틈 칸', desc='밝은 나무 문틀 + 안쪽으로 젖혀져 가장자리만 보이는 갈색 판문(경첩 2개), 통로는 투명.')
def _dw(c): _door_open_wood(c)


@R.obj('door-open-toilet', '화장실 문(열림)', kind='door', use=('travel',), tags=('문', '화장실', '탈의실'),
       place='가로 칸막이 1칸 틈 칸', desc='크림색 문틀 + 젖혀진 크림색 문짝 가장자리(서리유리 조각·환기 살·레버), 통로는 투명.')
def _dt(c): _door_open_toilet(c)


@R.obj('fusuma-open', '후스마(열림)', kind='door', use=('travel',), tags=('문', '화실', '襖'),
       place='가로 칸막이 1칸 틈 칸', desc='어두운 나무 기둥·가모이·시키이 두 줄 레일, 한쪽으로 밀려 끝만 보이는 후스마 한 짝, 통로는 투명.')
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
# 그림 16×48: 위 두 줄(0~31) = 틈 위 칸막이 끝 벽면 위에 겹친다(★), 아랫줄(32~47) = 통로 칸(2층). (임시 자리표시 — 작업자가 다시 그린다.)
def _side(c, leaf):
    c.R(0, 0, 16, 3, W_(-3)); c.HL(0, 1, 16, W_(1))
    c.R(6, 3, 4, 40, W_(-3)); c.R(7, 3, 2, 40, leaf)
    c.HL(0, 44, 16, W_(-2)); c.HL(0, 45, 16, W_(-3))


@R.obj('door-side-western', '옆문(열림)', kind='sidedoor', use=('travel',), tags=('문', '방', '복도', '탈의실', '거실'), place='세로 칸막이 3줄 틈의 통로 칸(셋째 줄)', desc='세로 벽에 난 출입구의 열린 나무 문.')
def _sw(c): _side(c, W_(1))


@R.obj('door-side-sliding', '미닫이 옆문(열림)', kind='sidedoor', use=('travel',), tags=('문', '욕실', '탈의실', '화실', '미닫이'), place='세로 칸막이 3줄 틈의 통로 칸(셋째 줄)', desc='세로 벽에 난 출입구의 열린 미닫이(욕실 접이문·탈의실 미닫이).')
def _ss(c): _side(c, K('kinari', 2))


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK))
