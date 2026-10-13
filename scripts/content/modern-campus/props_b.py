#!/usr/bin/env python3
"""modern_campus 야외 소품 B — 탈것·놀이·정원·시설. python3 props_b.py"""
from mc_core import *
from props_a import ell
R = Reg('props_b'); A = R.add


def gs(c, y, x0, x1): c.HL(x0, y, x1 - x0, K('yoru', -2))


@A('school-bus', '통학 버스(노란 지붕 윗면 + 앞면 창띠)', 5, 3, 'structure', solid=[(x, 2) for x in range(5)], tags=['버스', '탈것', '통학'], rules='정문 앞 도로. 남쪽을 보는 정차 상태.')
def _bus(c):
    cube(c, 1, 1, 78, 22, 5, 'kii', tt=2, ft=-1)
    c.R(4, 4, 72, 16, K('kii', 3)); c.HL(4, 4, 72, K('kii', 4)); c.HL(4, 19, 72, K('kii', 1))
    for x in (12, 36, 60): c.R(x, 8, 10, 8, K('kii', 4)); c.HL(x, 8, 10, K('shiro', 3)); c.R(x + 2, 10, 6, 4, K('kii', 2))
    c.R(1, 28, 78, 14, K('kii', 0)); c.HL(1, 28, 78, K('kii', -2)); c.VL(1, 28, 14, K('kii', 2)); c.VL(78, 28, 14, K('kii', -2))
    for i in range(6): c.R(5 + i * 12, 30, 9, 6, OL); c.R(6 + i * 12, 31, 7, 4, K('garasu', -1)); c.HL(6 + i * 12, 31, 7, K('garasu', 1))
    c.R(1, 38, 78, 2, K('sumi', 1)); c.HL(1, 40, 78, K('kii', -1))
    c.R(1, 42, 78, 5, K('yoru', -1)); c.HL(1, 42, 78, K('sumi', 0))
    for x in (8, 54): c.R(x, 41, 14, 7, OL); c.R(x + 1, 42, 12, 5, K('yoru', -3)); c.R(x + 5, 43, 4, 3, K('hodo', 0))
    c.R(66, 31, 10, 7, K('sora', -1)); c.R(2, 40, 3, 2, K('aka', 1)); c.R(75, 40, 3, 2, K('aka', 1))
    c.HL(1, 22, 78, OL); c.HL(1, 47, 78, OL); c.VL(0, 1, 47, OL); c.VL(79, 1, 47, OL); gs(c, 47, 3, 76)


@A('bicycle', '자전거(눕혀 본 3/4: 안장 윗면 + 바퀴 + 프레임)', 1, 1, 'other', solid=[(0, 0)], tags=['자전거', '탈것'], rules='거치대 위·교정 곳곳. 막힘 칸 아님으로 써도 된다.')
def _bike(c):
    cube(c, 3, 1, 10, 7, 3, 'aka', tt=2, ft=-1)
    c.R(6, 3, 4, 4, K('aka', 3)); c.R(1, 8, 4, 6, K('sumi', 1)); c.R(11, 8, 4, 6, K('sumi', 1))
    c.R(2, 9, 2, 4, K('hodo', 2)); c.R(12, 9, 2, 4, K('hodo', 2)); c.HL(4, 10, 8, K('tekko', 1)); c.HL(4, 11, 8, K('tekko', -1)); c.HL(1, 15, 14, K('yoru', -2))


@A('picnic-table', '교정 식탁(윗면 판 + 벤치 둘)', 3, 1, 'low_furniture', solid=[(0, 0), (1, 0), (2, 0)], tags=['식탁', '정원'], rules='식당·교정 잔디.')
def _pt(c):
    cube(c, 2, 1, 44, 7, 3, 'ita', tt=3, ft=-1); [c.HL(3, y, 42, K('ita', 4)) for y in (3, 5)]
    cube(c, 0, 10, 48, 3, 2, 'ita', tt=2, ft=-1); c.R(4, 15, 3, 1, K('tekko', 0)); c.R(41, 15, 3, 1, K('tekko', 0)); gs(c, 15, 0, 48)


@A('notice-board', '게시판(코르크 + 철제 틀 + 덮개)', 2, 2, 'box', solid=[(0, 1), (1, 1)], tags=['게시판', '교정'], rules='현관 옆.')
def _nb(c):
    cube(c, 1, 1, 30, 7, 3, 'tekko', tt=3, ft=-1)
    c.R(3, 12, 26, 14, K('ita', 3)); c.HL(3, 12, 26, K('ita', 4)); c.VL(2, 11, 16, OL); c.VL(29, 11, 16, OL); c.HL(2, 11, 28, OL); c.HL(2, 26, 28, OL)
    for x, y, col in ((5, 14, 'shiro'), (13, 15, 'sora'), (20, 14, 'kii'), (8, 20, 'pinku'), (17, 20, 'shiro')): c.R(x, y, 6, 5, K(col, 2)); c.P(x + 2, y, K('aka', 0))
    c.R(2, 27, 2, 4, K('tekko', 0)); c.R(28, 27, 2, 4, K('tekko', 0)); gs(c, 31, 2, 30)


@A('drinking-fountain', '수돗가(콘크리트 싱크 + 수도꼭지 셋)', 2, 1, 'container', solid=[(0, 0), (1, 0)], tags=['수돗가', '운동장'], rules='운동장 옆.')
def _df(c):
    cube(c, 1, 1, 30, 11, 3, 'conc', tt=3, ft=-1)
    c.R(3, 3, 26, 7, K('sora', -1)); c.HL(3, 3, 26, K('sora', -2)); c.R(5, 6, 22, 3, K('sora', 1))
    for x in (6, 15, 24): c.R(x, 1, 3, 3, K('tekko', 3)); c.R(x, 4, 1, 2, K('tekko', 1))
    c.HL(1, 15, 30, K('yoru', -2))


@A('planter-round', '둥근 화분(콘크리트 + 흙 + 관목)', 1, 1, 'container', solid=[(0, 0)], tags=['화분', '교정'], rules='현관 양옆.')
def _pr(c):
    ell(c, 8, 5, 7, 4, OL); ell(c, 8, 5, 6, 3, K('conc', 3)); ell(c, 8, 5, 5, 2, K('soil', -1))
    for x, y in ((6, 3), (9, 3), (8, 5), (5, 5), (11, 5), (7, 6)): c.R(x, y, 3, 2, K('midori', 1)); c.P(x, y, K('pinku', 1) if (x + y) % 2 else K('midori', 2))
    c.R(2, 8, 12, 5, K('conc', 0)); c.VL(2, 8, 5, K('conc', 2)); c.VL(13, 8, 5, K('conc', -2)); c.VL(1, 7, 6, OL); c.VL(14, 7, 6, OL); c.HL(2, 13, 12, OL); c.HL(2, 15, 12, K('yoru', -2))


@A('jungle-gym', '정글짐(철 격자 윗면 + 기둥)', 3, 2, 'frame', solid=[(0, 1), (2, 1)], tags=['정글짐', '놀이'], rules='운동장 구석.')
def _jg(c):
    cube(c, 2, 1, 44, 12, 3, 'tekko', tt=2, ft=0, sides=False)
    for x in range(4, 44, 6): c.VL(x, 2, 11, K('tekko', 4))
    for y in (5, 9): c.HL(3, y, 42, K('tekko', 4))
    for x in (3, 16, 29, 42): c.R(x, 16, 3, 14, K('tekko', 0)); c.VL(x, 16, 14, K('tekko', 2)); c.VL(x - 1, 16, 14, OL); c.VL(x + 3, 16, 14, OL)
    c.HL(10, 22, 30, K('tekko', 1)); c.HL(10, 26, 30, K('tekko', 1)); gs(c, 31, 2, 46)


@A('sandbox', '모래밭(나무 틀 + 모래)', 2, 1, 'container', solid=[(0, 0), (1, 0)], tags=['모래밭', '놀이'], rules='놀이터.')
def _sb(c):
    cube(c, 1, 1, 30, 12, 3, 'ita', tt=2, ft=-1)
    c.R(4, 4, 24, 7, K('kinari', 2)); c.HL(4, 4, 24, K('soil', 2)); [c.P(5 + (hsh(i, 1) % 22), 5 + hsh(i, 2) % 5, K('soil', 3)) for i in range(10)]
    c.HL(1, 15, 30, K('yoru', -2))


@A('slide', '미끄럼틀(계단 탑 윗면 + 긴 미끄럼 판)', 3, 2, 'structure', solid=[(0, 1)], tags=['미끄럼틀', '놀이'], rules='놀이터.')
def _sl(c):
    cube(c, 1, 1, 18, 11, 7, 'aka', tt=2, ft=-1); c.R(4, 3, 12, 7, K('aka', 4)); c.HL(4, 3, 12, K('aka', 2))
    cube(c, 20, 10, 26, 10, 4, 'tekko', tt=3, ft=0, sides=True); [c.HL(22, y, 22, K('shiro', 3)) for y in (13, 16)]
    cube(c, 2, 21, 8, 4, 6, 'tekko', tt=3, ft=0); cube(c, 12, 21, 8, 4, 6, 'tekko', tt=3, ft=0)
    for y in (24, 27): c.HL(10, y, 2, K('tekko', 2))
    gs(c, 31, 2, 46)


@A('mailbox', '우체통(빨간 큰 상자 · 넓은 윗면)', 1, 1, 'box', solid=[(0, 0)], tags=['우체통', '교외'], rules='보도.')
def _mb(c):
    cube(c, 0, 0, 16, 11, 5, 'aka', tt=4, ft=-3); c.R(2, 2, 12, 7, K('aka', 4)); c.HL(2, 2, 12, K('shiro', 3)); c.HL(2, 8, 12, K('aka', 2)); c.HL(4, 5, 8, K('sumi', 1)); gs(c, 15, 1, 15)


@A('utility-pole', '배전함(회색 큰 상자 + 문 + 윗덮개)', 1, 1, 'box', solid=[(0, 0)], tags=['배전함', '교외', '전선'], rules='교외 도로변.')
def _up(c):
    cube(c, 1, 1, 14, 10, 5, 'tekko', tt=3, ft=0); c.R(4, 3, 8, 6, K('tekko', 4)); c.HL(4, 3, 8, K('tekko', 2)); c.VL(8, 12, 3, K('sumi', 1)); gs(c, 15, 2, 14)


@A('stone-lantern', '정원 석등(넓은 돌 윗면 3단)', 1, 2, 'column', solid=[(0, 1)], tags=['석등', '정원'], rules='교정 정원.')
def _stl(c):
    cube(c, 1, 0, 14, 11, 3, 'hodo', tt=4, ft=-1); c.R(6, 12, 4, 3, K('kii', 3))
    cube(c, 4, 17, 8, 6, 3, 'hodo', tt=3, ft=-1); cube(c, 0, 24, 16, 8, 0, 'hodo', tt=3, ft=-2, lip=False); gs(c, 31, 1, 15)


@A('gazebo', '정자(기와 지붕 윗면 + 기둥 4)', 3, 3, 'structure', solid=[(0, 2), (2, 2)], tags=['정자', '정원'], rules='교정 구석.')
def _gz(c):
    cube(c, 1, 1, 46, 20, 4, 'kawara', tt=1, ft=-1)
    c.R(4, 3, 40, 16, K('kawara', 2)); [c.HL(5, y, 38, K('kawara', 1 if (y // 3) % 2 else 3)) for y in range(4, 18, 3)]
    c.HL(4, 3, 40, K('kawara', 4)); c.R(18, 5, 12, 4, K('kawara', 4))
    for x in (4, 40): c.R(x, 27, 4, 20, K('ita', 0)); c.VL(x, 27, 20, K('ita', 2)); c.VL(x - 1, 27, 20, OL); c.VL(x + 4, 27, 20, OL)
    c.R(4, 26, 40, 3, K('ita', -1)); c.HL(4, 26, 40, K('ita', 1))
    cube(c, 2, 46, 44, 1, 1, 'hodo', tt=2, ft=-1); gs(c, 47, 2, 46)


@A('shed', '창고(철판 지붕 윗면 + 문)', 2, 2, 'structure', solid=[(0, 1), (1, 1)], tags=['창고', '교정'], rules='운동장 뒤편.')
def _sd(c):
    cube(c, 1, 1, 30, 12, 5, 'tekko', tt=3, ft=-1)
    for x in range(4, 30, 4): c.VL(x, 2, 10, K('tekko', 1))
    c.R(2, 18, 28, 13, K('kinari', 0)); c.VL(2, 18, 13, K('kinari', 2)); c.VL(29, 18, 13, K('kinari', -2)); c.VL(1, 17, 14, OL); c.VL(30, 17, 14, OL)
    c.R(10, 20, 12, 11, K('tekko', -1)); c.VL(10, 20, 11, OL); c.VL(21, 20, 11, OL); c.HL(10, 20, 12, OL); c.VL(16, 20, 11, K('sumi', 1)); c.HL(1, 31, 30, OL)


@A('scoreboard', '전광판(철 틀 + 어두운 판 + 받침 슬래브)', 3, 2, 'structure', solid=[(0, 1), (2, 1)], tags=['전광판', '운동장'], rules='운동장 가장자리. 글자 없음(점선 칸만).')
def _scb(c):
    cube(c, 1, 1, 46, 8, 3, 'tekko', tt=3, ft=-1)
    c.R(3, 12, 42, 12, K('kon', -2)); c.VL(2, 11, 14, OL); c.VL(45, 11, 14, OL)
    for x in range(6, 40, 8): c.R(x, 15, 5, 6, K('kii', -1)); c.R(x + 1, 16, 3, 4, K('kon', -2))
    c.R(5, 25, 4, 6, K('tekko', 0)); c.R(39, 25, 4, 6, K('tekko', 0)); c.VL(4, 25, 6, OL); c.VL(9, 25, 6, OL); c.VL(38, 25, 6, OL); c.VL(43, 25, 6, OL); gs(c, 31, 4, 44)


@A('tennis-net', '테니스 네트(받침 + 흰 윗띠)', 3, 1, 'frame', solid=[(0, 0), (2, 0)], tags=['테니스', '운동장'], rules='코트 가운데.')
def _tn(c):
    cube(c, 0, 0, 48, 10, 3, 'shiro', tt=3, ft=-2, sides=False); c.R(2, 2, 44, 6, K('shiro', 4))
    for x in range(3, 46, 3): c.VL(x, 13, 2, K('tekko', 1))
    for x in (0, 36): cube(c, x, 4, 12, 9, 3, 'conc', tt=3, ft=-2)
    gs(c, 15, 0, 48)


@A('crate-recycle', '분리수거함 셋(색 상자 윗덮개)', 3, 1, 'box', solid=[(0, 0), (1, 0), (2, 0)], tags=['분리수거', '교정'], rules='식당·기숙사 옆.')
def _cr(c):
    for i, col in enumerate(('sora', 'midori', 'kii')):
        cube(c, 1 + i * 16, 1, 14, 8, 6, col, tt=1, ft=-1); c.R(4 + i * 16, 3, 8, 3, K('sumi', 1)); c.HL(4 + i * 16, 3, 8, K('sumi', 0))
    gs(c, 15, 1, 47)


@A('sports-locker', '운동 기구함(철 상자 + 큰 덮개)', 2, 1, 'box', solid=[(0, 0), (1, 0)], tags=['운동', '체육'], rules='체육관 옆.')
def _sk(c):
    cube(c, 1, 1, 30, 9, 4, 'daidai', tt=2, ft=-1); c.R(4, 3, 24, 5, K('daidai', 3)); c.HL(4, 3, 24, K('daidai', 4)); c.VL(16, 11, 3, K('sumi', 0)); gs(c, 15, 1, 31)


if __name__ == '__main__':
    metas, ims = R.export(); sheet(ims, os.path.join(OUT, R.group, 'preview.png'), W=700, z=2); print(len(metas), 'props_b')
