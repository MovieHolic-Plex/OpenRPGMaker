#!/usr/bin/env python3
"""modern_campus 담·자판기 재시도·옥상 난간. python3 props_c.py"""
from mc_core import *
R = Reg('props_c'); A = R.add


@A('wall-conc', '콘크리트 담 2칸(두꺼운 갓돌 윗면 + 앞면)', 2, 2, 'structure', solid=[(0, 1), (1, 1)], tags=['담', '학교'], rules='학교 둘레를 가로로 잇는다. 양끝 gatepost.')
def _wc(c):
    cube(c, 0, 4, 32, 9, 4, 'conc', tt=3, ft=-1, sides=False); c.R(2, 6, 28, 5, K('conc', 4)); c.HL(2, 6, 28, K('conc', 2)); c.HL(2, 10, 28, K('conc', 1))
    c.R(0, 17, 32, 13, K('kinari', 0)); c.HL(0, 22, 32, K('kinari', 1)); c.HL(0, 27, 32, K('kinari', 1)); c.VL(16, 17, 5, K('kinari', -1)); c.VL(8, 22, 5, K('kinari', -1)); c.VL(24, 22, 5, K('kinari', -1)); c.VL(16, 27, 3, K('kinari', -1))
    c.HL(0, 30, 32, K('conc', -2)); c.HL(0, 31, 32, OL)
    for x in range(1, 32, 7): c.P(x, 20, K('midori', -1)); c.P(x + 1, 19, K('midori', 0)); c.P(x, 19, K('midori', 1))


@A('wall-brick', '벽돌 담 2칸(갓돌 윗면)', 2, 2, 'structure', solid=[(0, 1), (1, 1)], tags=['담', '학교'], rules='벽돌 교문 기둥과 잇는다.')
def _wb(c):
    cube(c, 0, 4, 32, 9, 4, 'conc', tt=3, ft=-1, sides=False); c.R(2, 6, 28, 5, K('conc', 4)); c.HL(2, 6, 28, K('conc', 2)); c.HL(2, 10, 28, K('conc', 1))
    bricks(c, 0, 17, 32, 14); c.HL(0, 31, 32, OL)


@A('wall-wire', '철망 담 2칸(콘크리트 턱 윗면 + 철망)', 2, 2, 'structure', solid=[(0, 1), (1, 1)], tags=['담', '철망'], rules='운동장·옥상 가장자리.')
def _ww(c):
    cube(c, 0, 18, 32, 8, 3, 'conc', tt=3, ft=-1, sides=False); c.R(1, 20, 30, 4, K('conc', 4)); c.HL(1, 20, 30, K('conc', 2))
    cube(c, 0, 2, 32, 7, 2, 'tekko', tt=3, ft=0, sides=False)
    for x in range(1, 32, 4): c.VL(x, 9, 9, K('tekko', 2))
    for y in (11, 14): c.HL(0, y, 32, K('tekko', 1))
    cube(c, 0, 28, 32, 1, 2, 'conc', tt=1, ft=-1, sides=False)


@A('wall-conc-end', '콘크리트 담 끝 기둥', 1, 2, 'structure', solid=[(0, 1)], tags=['담', '학교'], rules='담 줄 끝·모서리.')
def _we(c):
    cube(c, 1, 3, 14, 10, 4, 'conc', tt=3, ft=-1); c.R(4, 5, 8, 6, K('conc', 4)); c.HL(4, 5, 8, K('conc', 2))
    c.R(2, 17, 12, 13, K('kinari', 0)); c.VL(2, 17, 13, K('kinari', 2)); c.VL(13, 17, 13, K('kinari', -2)); c.VL(1, 16, 14, OL); c.VL(14, 16, 14, OL); c.HL(1, 31, 14, OL)


@A('vending2', '자판기(두꺼운 덮개 몸통)', 1, 2, 'box', solid=[(0, 1)], tags=['자판기', '교정'], rules='현관 옆. 앞 칸 비움.')
def _v2(c):
    cube(c, 1, 1, 14, 11, 4, 'conc', tt=3, ft=-2); c.R(3, 3, 10, 7, K('conc', 4)); c.HL(3, 3, 10, K('conc', 2)); c.HL(3, 9, 10, K('conc', 1))
    c.R(1, 16, 14, 15, K('sora', 0)); c.VL(1, 16, 15, K('sora', 2)); c.VL(14, 16, 15, K('sora', -2)); c.VL(0, 16, 16, OL); c.VL(15, 16, 16, OL); c.HL(0, 31, 16, OL)
    c.R(3, 17, 7, 7, K('garasu', -2)); c.HL(3, 17, 7, K('garasu', 1)); c.VL(3, 17, 7, OL); c.HL(3, 24, 7, OL)
    for r in range(2):
        for i in range(3): c.R(4 + i * 2, 18 + r * 3, 2, 2, K(('aka', 'kii', 'midori', 'daidai', 'sora', 'pinku')[r * 3 + i], 1))
    c.R(11, 17, 3, 5, K('conc', 1)); c.R(4, 27, 8, 3, K('sumi', 2))


@A('fence-roof', '옥상 난간 2칸(콘크리트 윗면 넓게)', 2, 1, 'structure', solid=[(0, 0), (1, 0)], tags=['옥상', '난간'], rules='평지붕 가장자리.')
def _fr(c):
    cube(c, 0, 0, 32, 11, 4, 'conc', tt=4, ft=-3, sides=False); c.R(2, 2, 28, 7, K('conc', 4)); c.HL(2, 2, 28, K('shiro', 3)); c.HL(2, 8, 28, K('conc', 2))
    for x in range(1, 32, 8): c.R(x, 4, 2, 3, K('tekko', 0))
    c.HL(0, 15, 32, K('yoru', -2))


if __name__ == '__main__':
    metas, ims = R.export(); sheet(ims, os.path.join(OUT, R.group, 'preview.png'), W=360, z=3); print(len(metas), 'props_c')
