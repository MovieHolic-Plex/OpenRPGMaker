import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

SW = 'ST-Sewer-01.png'
def T(i): return tile(SW, i)
W, H = 32, 20
m = Map('m50_sewer_tunnels', '지하 하수도 수로 터널', W, H, 'interior',
        'ST-Sewer-01 정비 통로: 가로 본류 수로 + 북쪽 지류 터널, 북서 ㄱ자 펌프실, 남동 문 달린 곁방, 남서 계단 터널. 벽57/65 자동, 수면304/물312, SC-Water01 배수 물줄기.')
g = [['#'] * W for _ in range(H)]
def carve(x0, y0, x1, y1, c='.'):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): g[y][x] = c
# ceiling bottom per column on the north side: walls take the next two rows
for x0, x1, cb in ((0, 1, 5), (2, 4, 3), (5, 10, 1), (11, 14, 5), (19, 21, 5)): carve(x0, cb, x1, 8)
carve(15, 0, 18, 8); carve(16, 0, 17, 8, '~')           # north branch tunnel, water down the middle into the main channel
carve(22, 7, 31, 8, '~')                                  # east: tunnel wall drops straight into the water
carve(0, 9, 31, 11, '~')                                  # main channel
carve(0, 12, 31, 13)                                      # south walkway
carve(6, 14, 8, 19)                                       # south stair tunnel
carve(19, 17, 30, 18); carve(19, 15, 23, 16); carve(26, 15, 30, 16)   # south-east side room (walls fill 15-16)
g[14][24] = 'D'; g[14][25] = 'D'                           # its doorway
g[15][24] = g[15][25] = g[16][24] = g[16][25] = '.'
carve(29, 17, 30, 18, '#'); carve(27, 19, 30, 19, '#')     # notch: room is not a box
rows = [''.join(r) for r in g]
m.layout(rows, {'.': T(0), '~': T(312)}, auto('SA-WallA02.png'), [T(57), T(65)])
for y in range(H):                                         # waterline under anything that is not water
    for x in range(W):
        if rows[y][x] == '~' and m.cls[y][x] == 'F' and (y == 0 or rows[y - 1][x] != '~' or m.cls[y - 1][x] == 'W'):
            m.cells([(x, y)], T(304))
# maintenance doors on the generated wall rows
for x, y in ((6, 1), (13, 5)): m.cells([(x, y)], T(79), 'up'); m.cells([(x, y + 1)], T(87), 'up')
m.cells([(26, 15)], T(79), 'up'); m.cells([(26, 16)], T(87), 'up')
# stairs going down out of the south tunnel
for dy, row in enumerate(((192, 193, 194), (200, 201, 202), (208, 209, 210))):
    for dx, t in enumerate(row): m.cells([(6 + dx, 17 + dy)], T(t), 'up')
# arch frame over the mouth of the stair tunnel
m.rect(SW, 0, 9, 3, 2, 6, 14)
# drums in the pump room and the side room, one on the walkway
for x, y in ((3, 5), (4, 5), (9, 3), (20, 17), (28, 17), (13, 12)):
    m.cells([(x, y)], T(178), 'up'); m.cells([(x, y + 1)], T(186), 'up')
# drain spouts from the east tunnel wall into the channel
for x in (23, 30):
    m.image('SC-Water01.png', x, 7, (0, 0, 32, 64)); m.image('SC-Water01.png', x, 9, (0, 96, 32, 128))
m.save()
