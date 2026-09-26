import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

CEIL = auto('SA-WallA01.png')
def door(m, name, x, y, fw=32, fh=64):
    """closed frame 0 of a PAW door sprite sheet at cell (x,y); bottom row sits on the wall base"""
    m.image(name, x, y, (0, 0, fw, fh))

S = 'ST-Office-I01.png'
m = Map('m39_office', '사무실 층', 20, 14, 'interior', '책상 3조·임원 책상·자료 책장·칸막이 회의실 유리 탁자')
# NE server-closet block pushes the east wall down (archive shelves sit on that lower wall);
# a partition wall (x6) closes a meeting nook in the SW, entered from the desk aisle.
rows = ['####################',
        '#..............#####',
        '#..............#####',
        '#..................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '#.....#............#',
        '#.....#............#',
        '#.....#............#',
        '#.....#............#',
        '##############DD####']
m.layout(rows, {'.': tile(S, 10)}, CEIL, [tile(S, 17), tile(S, 25)])
m.fill(1, 9, 5, 4, auto('SA-Floor-T11.png'))           # meeting-nook carpet
for x, rid in ((1, 'desk-white'), (5, 'desk-wood'), (9, 'desk-white')):
    m.recipe(S, rid, x, 3)
    m.recipe(S, 'chair-blue-back', x + 1, 6)
door(m, 'SC-Door-Metal01.png', 13, 1)
m.recipe(S, 'bookcase', 16, 3)
m.chip('gtaible.png', 1, 9)                               # 5x3 glass meeting table
m.recipe(S, 'chair-blue', 12, 9)
m.recipe(S, 'desk-executive', 11, 10)
m.recipe(S, 'bookcase', 16, 6)
m.fill(14, 11, 2, 2, auto('SA-FloorT04.png'))            # entrance mat
m.save()
