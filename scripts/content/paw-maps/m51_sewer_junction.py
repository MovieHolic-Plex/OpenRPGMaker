import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

SW = 'ST-Sewer-01.png'
def T(i): return tile(SW, i)
W, H = 24, 18
m = Map('m51_sewer_junction', '하수도 합류 수조실', W, H, 'interior',
        '북쪽 수조(벽240/248→수면선256→수중벽264/272→수중바닥288 단면), 큰 폭포 SC-Water02, 배수구 SC-Water01. 좌우 깊이가 다른 곁방(서 ㄱ자·동 벽감), 남쪽 가로 수로 304/312와 동쪽 마른 건널목.')
g = [['#'] * W for _ in range(H)]
def carve(x0, y0, x1, y1, c='.'):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): g[y][x] = c
carve(1, 1, 5, 10)                   # west chamber (walls 1-2), L-shaped by the notch below
carve(1, 7, 2, 10, '#')
carve(6, 3, 6, 10)                   # step between west chamber and basin: its wall comes lower
carve(7, 1, 16, 10)                  # basin hall
carve(7, 3, 16, 8, 'b')              # basin section rows
carve(17, 3, 17, 10)
carve(18, 3, 22, 10)                 # east chamber: deeper ceiling
carve(21, 3, 22, 4, '#')             # alcove notch in its NE corner
carve(0, 11, 23, 17)                 # junction floor
carve(0, 14, 14, 17, '~')            # south cross channel, dry crossing to the east
carve(23, 11, 23, 17, '#')
rows = [''.join(r) for r in g]
BAS = {3: 240, 4: 248, 5: 256, 6: 264, 7: 272, 8: 288}
m.layout(rows, {'.': T(0), 'b': lambda x, y: T(BAS[y]), '~': lambda x, y: T(304 if y == 14 else 312)},
         auto('SA-WallA02.png'), [T(57), T(65)])
m.fill(7, 9, 10, 1, T(304)); m.fill(7, 10, 10, 1, T(312))   # basin outflow channel below the section
m.fill(7, 11, 10, 3, T(0))
# maintenance doors on the generated wall rows
for x, y in ((3, 1), (19, 3)): m.cells([(x, y)], T(79), 'up'); m.cells([(x, y + 1)], T(87), 'up')
# big waterfall (first 96x160 phase of SC-Water02) into the basin, small spouts either side
m.image('SC-Water02.png', 10, 3, (0, 0, 96, 160))
for sx in (8, 15):
    m.image('SC-Water01.png', sx, 3, (0, 0, 32, 64)); m.image('SC-Water01.png', sx, 5, (0, 96, 32, 128))
# stairs down from the west chamber's back door
for sx, sy in ((3, 3),):
    for dy, row in enumerate(((192, 193, 194), (200, 201, 202), (208, 209, 210))):
        for dx, t in enumerate(row): m.cells([(sx + dx, sy + dy)], T(t), 'up')
# drums along the walls
for (x, y) in ((1, 3), (22, 7), (21, 7), (20, 12), (16, 15)):
    m.cells([(x, y)], T(178), 'up'); m.cells([(x, y + 1)], T(186), 'up')
m.save()
