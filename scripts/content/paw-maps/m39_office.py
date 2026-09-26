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

S = 'ST-Office-I01.png'
m = Map('m39_office', '사무실 층', 20, 14, 'interior', '책상 4조·임원 책상·자료 책장·유리 회의탁자')
room(m, S, (17, 25), tile(S, 10), doors=(14, 15))
for x, rid in ((1, 'desk-white'), (5, 'desk-wood'), (10, 'desk-white'), (14, 'desk-wood')):
    m.recipe(S, rid, x, 4)
    m.recipe(S, 'chair-blue-back', x + 1, 7)
m.recipe(S, 'bookcase', 16, 1)
door(m, 'SC-Door-Metal01.png', 13, 1)
m.recipe(S, 'chair-blue', 8, 9)
m.recipe(S, 'desk-executive', 7, 10)
m.fill(1, 9, 5, 4, auto('SA-Floor-T11.png'))           # meeting-zone carpet
m.chip('gtaible.png', 1, 9)                               # 5x3 glass meeting table
m.fill(14, 11, 2, 2, auto('SA-FloorT04.png'))            # entrance mat
m.save()
