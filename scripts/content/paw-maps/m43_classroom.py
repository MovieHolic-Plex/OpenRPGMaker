import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

CEIL = auto('SA-WallA01.png')
def door(m, name, x, y, fw=32, fh=64):
    """closed frame 0 of a PAW door sprite sheet at cell (x,y); bottom row sits on the wall base"""
    m.image(name, x, y, (0, 0, fw, fh))

S = 'ST-Schl-I01.png'
m = Map('m43_classroom', '현대식 교실', 16, 15, 'interior', '12석 교실, 교단·칠판·창·사물함, 앞문')
# structural pillar juts from the east wall between the two desk rows (wall face runs down its south
# side); the rear-west corner is notched by the neighbouring stair well, so the back lockers sit
# in the bay beside it.
rows = ['################',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#.............##',
        '#..............#',
        '#..............#',
        '#..............#',
        '###............#',
        '###............#',
        '##############D#']
m.layout(rows, {'.': tile(S, 6)}, CEIL, [tile(S, 41), tile(S, 49), tile(S, 57)])
m.fill(4, 4, 7, 2, auto('SA-Kyodan01.png'))               # teacher platform
m.recipe(S, 'school-window', 1, 1)
m.recipe(S, 'school-notice', 4, 2)
m.recipe(S, 'school-blackboard', 6, 1)
m.recipe(S, 'school-clock', 10, 2)
m.recipe(S, 'school-window', 11, 1)
m.recipe(S, 'school-classroom-door', 14, 1)
m.recipe(S, 'school-lectern', 7, 4)
for r in range(2):
    for c in range(6):
        x, y = 2 + 2 * c, 6 + 3 * r
        m.recipe(S, 'school-student-desk', x, y)
        m.recipe(S, 'school-chair-back', x, y + 2)
m.rect(S, 2, 22, 3, 2, 3, 12)                             # rear lockers (classroom-rear-lockers)
m.recipe(S, 'school-plant', 7, 12)
m.recipe(S, 'school-cleaning-locker', 12, 12)
m.recipe(S, 'school-plant', 14, 5)
m.save()
