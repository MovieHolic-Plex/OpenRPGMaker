import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

CEIL = auto('SA-WallA01.png')
def door(m, name, x, y, fw=32, fh=64):
    """closed frame 0 of a PAW door sprite sheet at cell (x,y); bottom row sits on the wall base"""
    m.image(name, x, y, (0, 0, fw, fh))

S = 'ST-Bakery-I01.png'
m = Map('m42_bakery', '빵집', 16, 13, 'interior', '서쪽 빵 벽선반·진열 카운터 완성 세트, 동쪽 케이크 쇼케이스와 창가 테이블')
# bread wall runs the full depth in the west; the cafe corner to the east sits under a lower wall
# (oven flue block NE), SW corner notched beside the shelf set.
rows = ['################',
        '#.........######',
        '#.........######',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '###########DD###']
m.layout(rows, {'.': auto('SA-Floor01.png')}, CEIL, [tile(S, 17), tile(S, 17)])
m.rect(S, 0, 6, 8, 10, 1, 1)                  # whole bakery wall-shelf + counter composite (8x10, closed block)
m.rect(S, 7, 13, 1, 2, 9, 1)                  # wall-mounted price board beside the shelves
m.rect(S, 0, 19, 4, 3, 10, 5)                 # cake showcase against the lower east wall
for i, (cx, cy) in enumerate(((0, 2), (1, 2), (2, 3))):
    m.rect('Cakes01.png', cx, cy, 1, 1, 10 + i, 5)   # cakes displayed on the showcase top
m.rect(S, 6, 19, 1, 3, 14, 5)                 # tall plant
m.rect(S, 0, 4, 2, 2, 10, 9)                  # small cafe table sets
m.rect(S, 2, 4, 2, 2, 13, 9)
m.save()
