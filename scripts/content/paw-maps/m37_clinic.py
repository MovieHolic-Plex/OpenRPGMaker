import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

CEIL = auto('SA-WallA01.png')
def door(m, name, x, y, fw=32, fh=64):
    """closed frame 0 of a PAW door sprite sheet at cell (x,y); bottom row sits on the wall base"""
    m.image(name, x, y, (0, 0, fw, fh))

S = 'ST-Hospital-I01.png'
m = Map('m37_clinic', '동네의원 대기실과 진찰실', 16, 12, 'interior', '서쪽 접수·TV·대기 의자, 북동 진찰 침상·모니터·가림막')
# exam bay in the NE behind a partition wall (x8) that ends in a short wall stub; screens close the rest,
# entry to the bay on the east side. South corners chamfered around the entrance.
rows = ['################',
        '#.......#......#',
        '#.......#......#',
        '#.......#......#',
        '#.......#......#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '##............##',
        '######DD########']
m.layout(rows, {'.': tile(S, 1)}, CEIL, [tile(S, 17), tile(S, 25)])
m.fill(6, 9, 2, 2, auto('SA-Floor-T12.png'))            # entrance mat
m.fill(9, 3, 6, 2, auto('SA-Floor-T01.png'))           # exam bay vinyl
m.recipe(S, 'clinic-poster', 1, 1)
m.recipe(S, 'clinic-clock', 2, 1)
m.recipe(S, 'clinic-reception', 1, 3)
m.recipe(S, 'clinic-tv', 4, 1)
m.recipe(S, 'clinic-plant', 7, 2)
m.recipe(S, 'clinic-window', 9, 1)
door(m, 'SC-Door05.png', 12, 1)                          # consulting-room back door
m.recipe(S, 'clinic-medicine', 14, 1)
m.recipe(S, 'clinic-exam-couch', 9, 3)
m.recipe(S, 'clinic-monitor', 11, 3)
m.recipe(S, 'clinic-stool', 12, 4)
m.recipe(S, 'clinic-privacy', 9, 5)
m.recipe(S, 'clinic-privacy', 11, 5)
m.recipe(S, 'clinic-privacy-side', 13, 5)
for x, y in ((2, 6), (3, 6), (4, 6), (2, 8), (3, 8), (4, 8)):
    m.recipe(S, 'clinic-waiting-bench', x, y)
m.recipe(S, 'clinic-waiting-chair-back', 1, 9)
m.recipe(S, 'clinic-plant', 14, 7)
m.save()
