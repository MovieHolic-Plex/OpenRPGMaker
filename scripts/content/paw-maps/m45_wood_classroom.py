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

S, S2 = 'ST-Schl-WI01.png', 'ST-Schl-WI02.png'
m = Map('m45_wood_classroom', '목조 학교 교실과 과학 준비실', 24, 15, 'interior', '서쪽 목조 교실(9석), 동쪽 목조 과학실(실험대·표본·골격)')
m.fill(0, 0, 24, 15, CEIL)
m.fill(1, 1, 14, 1, tile(S, 41)); m.fill(1, 2, 14, 1, tile(S, 49)); m.fill(1, 3, 14, 1, tile(S, 57))
m.fill(1, 4, 14, 10, auto('SA-Floor-T03.png')); m.fill(7, 14, 2, 1, auto('SA-Floor-T03.png'))
m.recipe(S, 'wood-school-window', 1, 1)
m.recipe(S, 'wood-school-blackboard', 5, 1)
m.recipe(S, 'wood-school-clock', 8, 2)
m.recipe(S, 'wood-school-grid-board', 9, 1)
m.chip('SPT-WSchool01.png', 11, 1, 6, 0, 2, 1)            # dark transom window
m.recipe(S, 'wood-school-lectern', 6, 4)
for r in range(3):
    for c in range(3):
        x, y = 2 + 3 * c, 6 + 3 * r
        if y + 2 > 13: continue
        m.recipe(S, 'wood-school-student-desk', x, y)
        m.recipe(S, 'wood-school-chair-back', x, y + 2)
m.recipe(S, 'wood-school-cleaning-locker', 13, 4)
m.recipe(S, 'wood-school-plant', 13, 11)
# lab x16..22
m.fill(16, 1, 7, 1, tile(S2, 17)); m.fill(16, 2, 7, 1, tile(S2, 25)); m.fill(16, 3, 7, 1, tile(S2, 33))
m.fill(16, 4, 7, 10, tile(S2, 6)); m.fill(15, 8, 1, 2, auto('SA-Floor-T03.png'))
m.fill(17, 4, 4, 1, tile(S2, 340)); m.fill(18, 4, 1, 1, tile(S2, 341)); m.fill(19, 4, 1, 1, tile(S2, 342)); m.fill(20, 4, 1, 1, tile(S2, 343))
m.recipe(S2, 'wood-special-counter-front', 17, 5)
m.recipe(S2, 'wood-special-microscope', 17, 4)
m.recipe(S2, 'wood-special-specimen', 18, 4)
m.recipe(S2, 'wood-special-test-tubes', 20, 4)
m.recipe(S2, 'wood-special-window', 17, 1)
m.image('SC-Door-SchlW01.png', 20, 1, (32, 0, 96, 64))   # wooden sliding door, closed frame (opaque part)
m.recipe(S2, 'wood-special-skeleton', 21, 3)
m.recipe(S2, 'wood-special-worktable', 17, 8)
m.recipe(S2, 'wood-special-stool', 18, 7)
m.recipe(S2, 'wood-special-stool', 18, 10)
m.recipe(S2, 'wood-special-bookcase', 17, 12)
m.recipe(S2, 'wood-special-plant', 21, 11)
m.save()
