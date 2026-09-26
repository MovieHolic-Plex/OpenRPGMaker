import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

SW = 'ST-Sewer-01.png'
def T(i): return tile(SW, i)
W, H = 32, 20
m = Map('m50_sewer_tunnels', '지하 하수도 수로 터널', W, H, 'interior',
        'ST-Sewer-01 정비 통로: 북벽57/65, 발판113, 계단, 수면304/물312, 남쪽 통로. SC-Water01 배수 물줄기.')
# north wall block (2 rows) and upper catwalk
m.fill(0, 0, W, 1, T(57)); m.fill(0, 1, W, 1, T(65))
m.fill(0, 2, W, 1, T(0))
m.fill(0, 2, 1, 1, T(112), 'up'); m.fill(1, 2, W - 2, 1, T(113), 'up'); m.fill(W - 1, 2, 1, 1, T(114), 'up')
# vertical drop face under catwalk (rows 3-5), two stairs down
m.fill(0, 3, W, 2, T(57)); m.fill(0, 5, W, 1, T(65))
m.fill(0, 3, W, 1, T(145), 'up'); m.fill(0, 4, W, 2, T(8), 'up')
for sx in (5, 22):
    m.fill(sx, 3, 3, 3, T(0))
    for dy, row in enumerate(((192, 193, 194), (200, 201, 202), (208, 209, 210))):
        for dx, t in enumerate(row):
            m.cells([(sx + dx, 3 + dy)], T(t), 'up')
# maintenance doors on north wall
m.cells([(2, 0)], T(79), 'up'); m.cells([(2, 1)], T(87), 'up')
m.cells([(28, 0)], T(79), 'up'); m.cells([(28, 1)], T(87), 'up')
# lower walkway, water channel, south walkway
m.fill(0, 6, W, 2, T(0))
m.fill(0, 8, W, 1, T(304)); m.fill(0, 9, W, 6, T(312))
m.fill(0, 15, W, 5, T(0))
# transparent arch partition over the dry south walkway (source 3x2 block 72..82 whole)
m.rect(SW, 0, 9, 3, 2, 8, 16)
m.rect(SW, 0, 9, 3, 2, 25, 16)
# drums on walkway
m.cells([(12, 6)], T(178), 'up'); m.cells([(12, 7)], T(186), 'up')
m.cells([(18, 15)], T(178), 'up'); m.cells([(18, 16)], T(186), 'up')
# water spout from north wall face into channel (SC-Water01 phase 0: rows 0,1,2,3)
# box = (x0, y0, x1, y1) pixels; drain+lip rows 0-1, column row 2 repeated, splash row 3 on the water line
m.image('SC-Water01.png', 15, 4, (0, 0, 32, 64))
m.image('SC-Water01.png', 15, 6, (0, 64, 32, 96)); m.image('SC-Water01.png', 15, 7, (0, 64, 32, 96))
m.image('SC-Water01.png', 15, 8, (0, 96, 32, 128))
m.save()
