import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

SW = 'ST-Sewer-01.png'
def T(i): return tile(SW, i)
W, H = 24, 18
m = Map('m51_sewer_junction', '하수도 합류 수조실', W, H, 'interior',
        '북쪽 발판 아래 수조: 벽240/248→수면선256→수중벽264/272→수중바닥288 단면 교본 그대로. 큰 폭포 SC-Water02, 배수구 SC-Water01, 남쪽 가로 수로 304/312.')
m.fill(0, 0, W, 1, T(57)); m.fill(0, 1, W, 1, T(65))
m.fill(0, 2, W, 1, T(0))
m.fill(0, 2, 1, 1, T(112), 'up'); m.fill(1, 2, W - 2, 1, T(113), 'up'); m.fill(W - 1, 2, 1, 1, T(114), 'up')
m.cells([(3, 0)], T(79), 'up'); m.cells([(3, 1)], T(87), 'up')
m.cells([(20, 0)], T(79), 'up'); m.cells([(20, 1)], T(87), 'up')
# side walls under catwalk: vertical faces (rows 3-5) and dry floor below
for x0, x1 in ((0, 7), (17, W)):
    m.fill(x0, 3, x1 - x0, 2, T(57)); m.fill(x0, 5, x1 - x0, 1, T(65))
    m.fill(x0, 3, x1 - x0, 1, T(145), 'up'); m.fill(x0, 4, x1 - x0, 2, T(8), 'up')
# central basin: exact water-section order, one waterline row
for y, t in zip(range(3, 9), (240, 248, 256, 264, 272, 288)):
    m.fill(7, y, 10, 1, T(t))
m.fill(7, 9, 10, 1, T(304)); m.fill(7, 10, 10, 1, T(312))
m.fill(0, 6, 7, 5, T(0)); m.fill(17, 6, 7, 5, T(0))
# stairs down from the catwalk on each side
for sx in (2, 19):
    m.fill(sx, 3, 3, 3, T(0))
    for dy, row in enumerate(((192, 193, 194), (200, 201, 202), (208, 209, 210))):
        for dx, t in enumerate(row): m.cells([(sx + dx, 3 + dy)], T(t), 'up')
# big waterfall (first 96x160 phase of SC-Water02) pouring into the basin, small spouts either side
m.image('SC-Water02.png', 10, 3, (0, 0, 96, 160))
for sx in (8, 15):
    m.image('SC-Water01.png', sx, 3, (0, 0, 32, 64)); m.image('SC-Water01.png', sx, 5, (0, 96, 32, 128))
# dry junction floor and the south cross channel with a dry crossing on the east
m.fill(0, 11, W, 7, T(0))
m.fill(0, 14, 15, 1, T(304)); m.fill(0, 15, 15, 3, T(312))
m.fill(7, 11, 10, 3, T(0))
# drums and crates along walls
for (x, y) in ((1, 6), (22, 7), (20, 16)):
    m.cells([(x, y)], T(178), 'up'); m.cells([(x, y + 1)], T(186), 'up')
m.save()
