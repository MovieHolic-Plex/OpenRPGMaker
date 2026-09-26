import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

CEIL = auto('SA-WallA01.png')
def room(m, sheet, walls, floor, doors=()):
    """XP ceiling ring, north wall face rows (walls = tile ids top->bottom), floor, south door gap columns."""
    m.fill(0, 0, m.w, m.h, CEIL)
    for i, t in enumerate(walls): m.fill(1, 1 + i, m.w - 2, 1, tile(sheet, t))
    top = 1 + len(walls)
    m.fill(1, top, m.w - 2, m.h - top - 1, floor)
    for x in doors: m.fill(x, m.h - 1, 1, 1, floor)
    return top
def door(m, name, x, y, fw=32, fh=64):
    """closed frame 0 of a PAW door sprite sheet at cell (x,y); bottom row sits on the wall base"""
    m.image(name, x, y, (0, 0, fw, fh))

S = 'ST-Bakery-I01.png'
m = Map('m42_bakery', '빵집', 16, 13, 'interior', '서쪽 빵 벽선반·진열 카운터 완성 세트, 동쪽 케이크 쇼케이스와 창가 테이블')
room(m, S, (17, 17), auto('SA-Floor01.png'), doors=(11, 12))
m.rect(S, 0, 6, 8, 10, 1, 1)                  # whole bakery wall-shelf + counter composite (8x10, closed block)
m.rect(S, 0, 19, 4, 3, 10, 2)                 # cake showcase
for i, (cx, cy) in enumerate(((0, 2), (1, 2), (2, 3))):
    m.rect('Cakes01.png', cx, cy, 1, 1, 10 + i, 2)   # cakes displayed on the showcase top
m.rect(S, 6, 19, 1, 3, 14, 2)                 # tall plant
m.rect(S, 0, 4, 2, 2, 10, 8)                  # small cafe table set
m.rect(S, 2, 4, 2, 2, 13, 8)
m.rect(S, 7, 13, 1, 2, 9, 1)
m.save()
