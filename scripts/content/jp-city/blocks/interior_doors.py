#!/usr/bin/env python3
"""jp_city 블록 interior_doors — 일본 실내: 방 사이 통로에 다는 열린 문(kind door)과 현관 바깥문 문턱.
  python3 scripts/content/jp-city/blocks/interior_doors.py     # selftest + tiledata/jp-city/blocks/interior_doors/_all-x3.png
문(kind door)은 가로 칸막이('#' 줄)의 1칸 틈 칸 (x,y) 에 단다. 그림 16×32 = 틈 아래 벽면 높이 두 줄(윗줄 ★ · 아랫줄 2층 밟음).
틈 칸 자체의 인방(천장 띠)은 ikit 가 덧붙인다. 통로는 막지 않는다 — 문짝은 열려 있다(옆으로 밀렸거나 안쪽으로 젖혀졌다).
(임시 자리표시 그림 — 작업자가 다시 그린다.)"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT   # noqa: E402,F401

BLOCK = 'interior_doors'
R = Registry(BLOCK, '열린 방문·현관문')
W_ = lambda t: K('ita', t)


def _frame(c, leaf):
    c.R(0, 0, 3, 32, W_(-3)); c.R(13, 0, 3, 32, W_(-3))
    c.R(1, 0, 1, 32, W_(1)); c.R(14, 0, 1, 32, W_(0))
    c.R(0, 0, 16, 3, W_(-3)); c.HL(0, 1, 16, W_(1))
    c.R(3, 3, 10, 2, K('sumi', 0))
    c.HL(3, 30, 10, W_(-2)); c.HL(3, 31, 10, W_(-3))
    c.R(3, 5, 3, 25, leaf)


@R.obj('door-open-western', '양실 문(열림)', kind='door', use=('travel',), tags=('문', '방', '양실', '복도'), place='가로 칸막이 1칸 틈 칸', desc='방 입구에 다는 열린 나무 여닫이 문.')
def _dw(c): _frame(c, W_(1))


@R.obj('door-open-toilet', '화장실 문(열림)', kind='door', use=('travel',), tags=('문', '화장실', '탈의실'), place='가로 칸막이 1칸 틈 칸', desc='화장실·탈의실 입구의 열린 밝은 문.')
def _dt(c): _frame(c, K('kinari', 2))


@R.obj('fusuma-open', '후스마(열림)', kind='door', use=('travel',), tags=('문', '화실', '襖'), place='가로 칸막이 1칸 틈 칸', desc='화실 입구의 열린 후스마.')
def _df(c): _frame(c, K('kinari', 1))


@R.obj('shoji-open', '쇼지 문(열림)', kind='door', use=('travel',), tags=('문', '화실', '障子'), place='가로 칸막이 1칸 틈 칸', desc='화실 입구의 열린 쇼지.')
def _ds(c): _frame(c, K('shiro', 2))


@R.obj('genkan-door', '현관문 문턱', kind='flat', use=('travel', 'walk'), tags=('현관', '문'), place='맨 아래 출입구 틈 칸', desc='현관 바깥문(미닫이) 문턱과 문틀.')
def _gd(c):
    c.R(0, 0, 2, 16, W_(-3)); c.R(14, 0, 2, 16, W_(-3)); c.R(2, 6, 12, 3, K('tekko', 0)); c.HL(2, 6, 12, K('tekko', 2))


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK))
