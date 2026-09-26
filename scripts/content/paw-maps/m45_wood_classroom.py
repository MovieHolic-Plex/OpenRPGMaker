import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

CEIL = auto('SA-WallA01.png')
def door(m, name, x, y, fw=32, fh=64):
    """closed frame 0 of a PAW door sprite sheet at cell (x,y); bottom row sits on the wall base"""
    m.image(name, x, y, (0, 0, fw, fh))

S, S2 = 'ST-Schl-WI01.png', 'ST-Schl-WI02.png'
m = Map('m45_wood_classroom', '목조 학교 교실과 과학 준비실', 24, 15, 'interior', '서쪽 목조 교실(8석), 동쪽 목조 과학실(실험대·표본·골격)')
# classroom x1..14 narrows into a south entrance bay (x6..9); a solid partition (x15) separates the
# lab, its wall face shows on rows 8-10 and it opens onto the classroom at rows 11-12; the lab's
# SE corner is taken by a prep closet.
rows = ['########################',
        '#..............#.......#',
        '#..............#.......#',
        '#..............#.......#',
        '#..............#.......#',
        '#..............#.......#',
        '#..............#.......#',
        '#..............#.......#',
        '#......................#',
        '#......................#',
        '#......................#',
        '#..............D.....###',
        '#..............D.....###',
        '######....##############',
        '#######DD###############']
FW = auto('SA-Floor-T03.png')
def floor(x, y): return tile(S2, 6) if x >= 16 else FW
def walls(x, y): return [tile(S2, 17), tile(S2, 25), tile(S2, 33)] if x >= 16 else [tile(S, 41), tile(S, 49), tile(S, 57)]
m.layout(rows, {'.': floor}, CEIL, walls)
m.recipe(S, 'wood-school-window', 1, 1)
m.recipe(S, 'wood-school-blackboard', 5, 1)
m.recipe(S, 'wood-school-clock', 8, 2)
m.recipe(S, 'wood-school-grid-board', 9, 1)
m.chip('SPT-WSchool01.png', 12, 1, 6, 0, 2, 1)            # dark transom window
m.recipe(S, 'wood-school-lectern', 6, 4)
for r in range(2):
    for c in range(4):
        x, y = 2 + 3 * c, 6 + 3 * r
        m.recipe(S, 'wood-school-student-desk', x, y)
        m.recipe(S, 'wood-school-chair-back', x, y + 2)
m.recipe(S, 'wood-school-cleaning-locker', 14, 4)
m.recipe(S, 'wood-school-notice', 4, 2)
m.recipe(S, 'wood-school-plant', 1, 11)
# lab x16..22
m.fill(17, 4, 1, 1, tile(S2, 340)); m.fill(18, 4, 1, 1, tile(S2, 341)); m.fill(19, 4, 1, 1, tile(S2, 342)); m.fill(20, 4, 1, 1, tile(S2, 343))
m.recipe(S2, 'wood-special-counter-front', 17, 5)
m.recipe(S2, 'wood-special-microscope', 17, 4)
m.recipe(S2, 'wood-special-specimen', 18, 4)
m.recipe(S2, 'wood-special-test-tubes', 20, 4)
m.recipe(S2, 'wood-special-window', 17, 1)
m.image('SC-Door-SchlW01.png', 21, 2, (32, 0, 96, 64))   # wooden sliding door to the prep room, closed frame
m.recipe(S2, 'wood-special-skeleton', 22, 6)
m.recipe(S2, 'wood-special-worktable', 17, 8)
m.recipe(S2, 'wood-special-stool', 18, 7)
m.recipe(S2, 'wood-special-stool', 18, 10)
m.recipe(S2, 'wood-special-bookcase', 17, 11)
m.recipe(S2, 'wood-special-plant', 22, 9)
m.save()
