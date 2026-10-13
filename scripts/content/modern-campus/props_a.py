#!/usr/bin/env python3
"""modern_campus 야외 소품 A — 교정·운동장·옥상 소품. python3 props_a.py -> tiledata/modern-campus/props_a/_gate + preview"""
import sys
from mc_core import *
R = Reg('props_a'); A = R.add


def ell(c, cx, cy, rx, ry, col, fill=True):
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            d = ((x - cx + .5) / (rx + .5)) ** 2 + ((y - cy + .5) / (ry + .5)) ** 2
            if (d <= 1 if fill else 0.72 <= d <= 1): c.P(x, y, col)


def ground_shadow(c, y, x0, x1): c.HL(x0, y, x1 - x0, K('yoru', -2))


@A('clock-tower', '시계탑(벽돌 몸통 + 시계판 + 평지붕 슬래브)', 2, 4, 'structure', solid=[(0, 3), (1, 3)], tags=['시계탑', '교정', '랜드마크'], rules='본관 앞 광장 한가운데. 시계는 글자 없는 점 표시.')
def _ct(c):
    cube(c, 2, 1, 28, 12, 4, 'conc', tt=3, ft=-1)                                   # 옥상 슬래브 윗면 12행
    c.R(5, 3, 22, 8, K('conc', 4)); c.HL(5, 3, 22, K('conc', 2)); c.HL(5, 10, 22, K('conc', 1)); c.VL(5, 3, 8, K('conc', 2)); c.VL(26, 3, 8, K('conc', 1))
    c.R(11, 5, 10, 4, K('kawara', 1)); c.HL(11, 5, 10, K('kawara', 3)); c.HL(11, 8, 10, K('kawara', -1))
    bricks(c, 6, 17, 20, 30); c.VL(6, 17, 30, K('renga', 2)); c.VL(25, 17, 30, K('renga', -2)); c.VL(5, 17, 30, OL); c.VL(26, 17, 30, OL)
    ell(c, 16, 25, 7, 6, OL); ell(c, 16, 25, 6, 5, K('shiro', 2)); ell(c, 16, 25, 5, 4, K('shiro', 1))
    for a, b in ((16, 21), (16, 29), (11, 25), (21, 25)): c.P(a, b, K('sumi', 0))
    c.VL(16, 21, 5, K('sumi', 0)); c.HL(16, 25, 4, K('sumi', 0))
    c.R(6, 36, 20, 2, K('renga', -2)); c.HL(6, 38, 20, K('renga', 2))
    cube(c, 3, 49, 26, 4, 8, 'conc', tt=3, ft=-1)
    c.R(4, 61, 24, 1, K('conc', -2)); c.HL(3, 62, 26, K('yoru', -2))


@A('flagpole', '게양대(콘크리트 각기둥 + 깃발)', 1, 2, 'column', solid=[(0, 1)], tags=['게양대', '교정'], rules='운동장·현관 앞.')
def _fp(c):
    cube(c, 1, 20, 14, 8, 4, 'conc', tt=3, ft=-1)
    cube(c, 3, 8, 10, 8, 12, 'shiro', tt=3, ft=0)
    c.R(11, 1, 5, 4, K('aka', 0)); c.HL(11, 1, 5, K('aka', 2)); c.HL(11, 4, 5, K('aka', -2)); c.HL(11, 0, 5, OL); c.HL(11, 5, 5, OL); c.VL(10, 0, 8, OL)
    c.HL(2, 31, 12, K('yoru', -2))


@A('lamp-post', '정원등(콘크리트 상자 + 등 윗면)', 1, 1, 'box', solid=[(0, 0)], tags=['가로등', '교정'], rules='보도 가장자리 4칸 간격.')
def _lp(c):
    cube(c, 1, 1, 14, 10, 5, 'conc', tt=3, ft=-1); c.R(4, 3, 8, 6, K('kii', 4)); c.HL(4, 3, 8, K('kii', 2)); c.HL(4, 8, 8, K('kii', 1)); c.VL(4, 3, 6, K('kii', 2)); c.VL(11, 3, 6, K('kii', 1))
    c.HL(1, 14, 14, K('conc', -3)); c.HL(2, 15, 12, K('yoru', -2))


@A('trash-can', '쓰레기통(콘크리트 각통 + 뚜껑)', 1, 1, 'box', solid=[(0, 0)], tags=['쓰레기통', '교정'], rules='벤치·자판기 옆.')
def _tc(c):
    cube(c, 1, 1, 14, 9, 5, 'conc', tt=3, ft=-1)
    c.R(4, 3, 8, 5, K('conc', 4)); c.HL(4, 3, 8, K('conc', 2)); c.HL(4, 7, 8, K('conc', 1)); c.VL(4, 3, 5, K('conc', 2)); c.VL(11, 3, 5, K('conc', 1))
    c.HL(1, 12, 14, K('conc', -3)); c.HL(1, 15, 14, K('yoru', -2))


@A('ac-unit', '옥상 실외기(철 상자 + 팬)', 1, 1, 'box', solid=[(0, 0)], tags=['옥상', '실외기'], rules='평지붕 옥상 위 소품.')
def _ac(c):
    cube(c, 1, 1, 14, 6, 8, 'tekko', tt=4, ft=1)
    ell(c, 8, 4, 4, 2, K('sumi', 1)); ell(c, 8, 4, 3, 1, K('tekko', 0)); c.HL(6, 4, 5, K('tekko', 2))
    for y in (8, 10, 12): c.HL(3, y, 10, K('tekko', -2))
    c.HL(1, 15, 14, K('yoru', -2))


@A('water-tank', '옥상 물탱크(철 각 탱크 + 뚜껑)', 1, 2, 'box', solid=[(0, 1)], tags=['옥상', '물탱크'], rules='평지붕 옥상 위.')
def _wt(c):
    cube(c, 1, 1, 14, 10, 16, 'tekko', tt=3, ft=0)
    c.R(4, 4, 8, 4, K('tekko', 1)); c.HL(4, 4, 8, K('tekko', 4)); c.P(8, 6, K('sumi', 0))
    for y in (16, 22): c.HL(1, y, 14, K('tekko', -2)); c.HL(1, y + 1, 14, K('tekko', 2))
    cube(c, 3, 28, 10, 2, 2, 'conc', tt=2, ft=-1); c.HL(3, 31, 10, K('yoru', -2))


@A('podium', '조회대(콘크리트 단 + 계단)', 3, 1, 'box', solid=[(0, 0), (1, 0), (2, 0)], tags=['조회대', '운동장'], rules='운동장 북쪽 가운데.')
def _pd(c):
    cube(c, 1, 1, 46, 8, 6, 'conc', tt=3, ft=-1)
    for x in (4, 20, 36): c.HL(x, 4, 8, K('conc', 4))
    c.HL(1, 9, 46, K('conc', -3))
    for i in range(3): c.R(18 + i * 0, 11 + i * 1, 12, 1, K('conc', 1 - i))
    c.HL(2, 15, 44, K('yoru', -2))


@A('school-sign', '교명석(큰 돌 + 마크)', 2, 1, 'box', solid=[(0, 0), (1, 0)], tags=['교명석', '정문'], rules='정문 안쪽. 글자 대신 마크(원+선)만.')
def _ss(c):
    cube(c, 1, 1, 30, 7, 7, 'hodo', tt=3, ft=-1)
    c.HL(3, 3, 26, K('hodo', 4)); c.HL(3, 5, 26, K('hodo', 4))
    ell(c, 16, 11, 3, 2, K('kokuban', 1)); c.HL(11, 11, 10, K('kokuban', 0)); c.P(16, 11, K('shiro', 2))
    c.HL(2, 15, 28, K('yoru', -2))


@A('basket-hoop', '농구 골대(받침 블록 + 백보드 상자)', 2, 3, 'frame', solid=[(0, 2)], tags=['농구', '운동장'], rules='운동장 양 끝.')
def _bh(c):
    cube(c, 1, 1, 30, 14, 6, 'shiro', tt=3, ft=-2); c.R(4, 3, 24, 10, K('shiro', 4)); c.HL(4, 3, 24, K('shiro', 2)); c.HL(4, 12, 24, K('shiro', 1)); c.R(10, 5, 12, 6, K('aka', 0)); c.HL(10, 5, 12, K('aka', 2))
    cube(c, 4, 24, 24, 8, 4, 'tekko', tt=3, ft=-1)
    cube(c, 2, 38, 28, 8, 3, 'conc', tt=3, ft=-2); c.R(12, 36, 8, 2, K('tekko', 0))
    c.HL(2, 47, 28, K('yoru', -2))


@A('pullup-bar', '철봉(콘크리트 기둥 둘 + 굵은 가로대)', 3, 2, 'frame', solid=[(0, 1), (2, 1)], tags=['철봉', '운동장'], rules='운동장 구석. 가운데 칸은 비움.')
def _pb(c):
    for x0 in (2, 34):
        cube(c, x0 + 1, 20, 10, 8, 4, 'conc', tt=3, ft=-1)
        cube(c, x0 + 2, 8, 8, 7, 6, 'tekko', tt=3, ft=0)
    cube(c, 2, 1, 44, 8, 4, 'tekko', tt=4, ft=1, sides=False)
    c.VL(1, 0, 14, OL); c.VL(46, 0, 14, OL)
    c.HL(3, 31, 12, K('yoru', -2)); c.HL(35, 31, 12, K('yoru', -2))


@A('soccer-goal', '축구 골대(흰 틀 + 그물 윗면)', 4, 2, 'frame', solid=[(0, 1), (3, 1)], tags=['축구', '운동장'], rules='운동장 남북 끝 가운데.')
def _sg(c):
    cube(c, 2, 1, 60, 10, 3, 'shiro', tt=1, ft=0, sides=False)
    for x in range(5, 60, 3): c.VL(x, 2, 9, K('shiro', -1))
    for y in (4, 7): c.HL(3, y, 58, K('shiro', -1))
    c.R(2, 14, 5, 15, K('shiro', 1)); c.VL(2, 14, 15, K('shiro', 2)); c.VL(6, 14, 15, K('shiro', -1)); c.VL(1, 14, 15, OL); c.VL(7, 14, 15, OL)
    c.R(57, 14, 5, 15, K('shiro', 0)); c.VL(57, 14, 15, K('shiro', 1)); c.VL(61, 14, 15, K('shiro', -2)); c.VL(56, 14, 15, OL); c.VL(62, 14, 15, OL)
    for x in range(9, 56, 3): c.VL(x, 14, 14, K('shiro', -2))
    cube(c, 0, 29, 9, 2, 1, 'conc', tt=2, ft=-1); cube(c, 55, 29, 9, 2, 1, 'conc', tt=2, ft=-1)


@A('fountain', '분수대(돌 수반 + 물 + 가운데 기둥)', 3, 3, 'container', solid=[(0, 1), (1, 1), (2, 1), (0, 2), (1, 2), (2, 2)], tags=['분수', '광장'], rules='광장 한가운데.')
def _fo(c):
    ell(c, 24, 20, 23, 17, OL); ell(c, 24, 20, 22, 16, K('hodo', 3)); ell(c, 24, 21, 20, 14, K('hodo', 0)); ell(c, 24, 20, 20, 13, K('hodo', 3))
    ell(c, 24, 20, 18, 11, K('sora', -1)); ell(c, 24, 21, 16, 9, K('sora', 0)); ell(c, 24, 22, 11, 6, K('sora', 1))
    for a in range(0, 360, 40):
        import math; x = int(24 + 14 * math.cos(math.radians(a))); y = int(22 + 7 * math.sin(math.radians(a))); c.P(x, y, K('shiro', 2)); c.P(x + 1, y, K('sora', 2))
    ell(c, 24, 20, 5, 3, OL); ell(c, 24, 20, 4, 2, K('hodo', 3))
    c.R(22, 12, 5, 9, K('hodo', 1)); c.VL(21, 12, 9, OL); c.VL(27, 12, 9, OL); c.VL(22, 12, 9, K('hodo', 2))
    ell(c, 24, 9, 5, 3, OL); ell(c, 24, 9, 4, 2, K('shiro', 0)); ell(c, 24, 8, 3, 1, K('shiro', 2))
    for x, y in ((19, 7), (29, 7), (17, 12), (31, 12), (24, 3), (22, 5), (26, 5)): c.P(x, y, K('shiro', 2))
    c.HL(6, 38, 36, K('yoru', -2))


@A('bus-stop', '버스 정류장(지붕 + 뒷 유리판 + 벤치)', 3, 2, 'structure', solid=[(0, 1), (1, 1), (2, 1)], tags=['버스 정류장', '교외'], rules='도로 옆 보도.')
def _bs(c):
    cube(c, 1, 1, 46, 10, 3, 'conc', tt=2, ft=-2)
    for x in range(3, 44, 6): c.HL(x, 4, 4, K('conc', 4))
    c.HL(2, 9, 44, K('conc', 4)); c.HL(1, 14, 46, K('sumi', 1))
    for x in (3, 43): c.R(x, 15, 2, 16, K('tekko', 0)); c.VL(x, 15, 16, K('tekko', 2)); c.VL(x - 1, 15, 16, OL); c.VL(x + 2, 15, 16, OL)
    c.R(7, 15, 34, 10, K('garasu', -2)); c.HL(7, 15, 34, K('garasu', 1)); c.VL(7, 15, 10, K('garasu', 1)); c.HL(7, 24, 34, K('sumi', 1))
    for x in (14, 24, 34): c.VL(x, 16, 8, K('garasu', 0))
    cube(c, 9, 25, 30, 3, 3, 'ita', tt=2, ft=-1); c.HL(9, 31, 30, OL); c.VL(9, 30, 1, K('tekko', 0)); c.VL(37, 30, 1, K('tekko', 0))
    c.HL(2, 31, 44, K('yoru', -2))


@A('bleacher', '스탠드(콘크리트 3단 계단식 객석)', 4, 2, 'structure', solid=[(0, 1), (1, 1), (2, 1), (3, 1)], tags=['스탠드', '운동장'], rules='운동장 옆. 북쪽이 높다.')
def _bl(c):
    cube(c, 1, 1, 62, 6, 3, 'conc', tt=3, ft=-1)
    cube(c, 1, 10, 62, 6, 3, 'conc', tt=2, ft=-1)
    cube(c, 1, 19, 62, 6, 3, 'conc', tt=2, ft=-1)
    for y in (3, 12, 21):
        for x in range(4, 60, 8): c.R(x, y, 5, 1, K('ita', 2)); c.R(x, y + 1, 5, 1, K('ita', 0))
    c.R(1, 28, 62, 3, K('conc', -1)); c.HL(1, 28, 62, K('conc', 1)); c.HL(1, 31, 62, OL); c.VL(0, 1, 31, OL); c.VL(63, 1, 31, OL)
    c.HL(2, 31, 60, K('yoru', -2))


@A('tree-sakura', '벚나무(교정 가로수)', 2, 3, 'organic', solid=[(0, 2), (1, 2)], tags=['벚나무', '교정', '나무'], rules='교정 가장자리.')
def _tr(c):
    c.R(13, 30, 6, 14, K('ki', -1)); c.VL(13, 30, 14, K('ki', 1)); c.VL(18, 30, 14, K('ki', -2)); c.VL(12, 30, 14, OL); c.VL(19, 30, 14, OL); c.HL(11, 44, 10, OL)
    ell(c, 16, 18, 15, 15, OL)
    cols = ('pinku', 'pinku', 'shiro')
    for i in range(0, 340):
        x = 2 + hsh(i, 1) % 28; y = 3 + hsh(i, 2) % 28
        if ((x - 16) / 14.2) ** 2 + ((y - 18) / 14.2) ** 2 <= 1:
            t = -1 + (2 if y < 14 else 0) + (hsh(i, 3) % 2) - (1 if x > 20 and y > 20 else 0)
            c.R(x, y, 2, 2, K(cols[hsh(i, 4) % 3], max(-1, min(2, t))))
    for x, y in ((8, 28), (24, 30), (4, 24)): c.P(x, y, K('pinku', 1))


@A('hedge', '생울타리(둥근 덤불 윗면 + 앞면)', 2, 1, 'organic', solid=[(0, 0), (1, 0)], tags=['덤불', '교정'], rules='담 안쪽·화단 옆.')
def _hg(c):
    c.R(1, 2, 30, 13, K('midori', -1)); c.HL(1, 14, 30, OL)
    for i in range(80):
        x = 1 + hsh(i, 5) % 28; y = 1 + hsh(i, 6) % 10
        c.R(x, y, 3, 2, K('midori', 1 + (1 if y < 5 else 0)) if hsh(i, 7) % 3 else K('midori', 0))
    c.R(1, 11, 30, 3, K('midori', -2)); c.HL(1, 1, 30, OL); c.VL(0, 2, 13, OL); c.VL(31, 2, 13, OL)
    for x in range(3, 29, 5): c.P(x, 12, K('midori', -1))


if __name__ == '__main__':
    metas, ims = R.export(); sheet(ims, os.path.join(OUT, R.group, 'preview.png'), W=420, z=2); print(len(metas), 'props_a')
