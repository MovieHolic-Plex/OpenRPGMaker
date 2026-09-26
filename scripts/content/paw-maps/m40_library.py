import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

CEIL = auto('SA-WallA01.png')
def door(m, name, x, y, fw=32, fh=64):
    """closed frame 0 of a PAW door sprite sheet at cell (x,y); bottom row sits on the wall base"""
    m.image(name, x, y, (0, 0, fw, fh))

S = 'ST-Libry-I01.png'
m = Map('m40_library', '도서관 열람실', 20, 14, 'interior', '북벽 서가 3개·잡지대·낮은 서가, 독서 탁자 2개, 대출대, 소파, 괘종시계')
# stacks along the full-height north wall; the east wing (loan desk) is shallower because a stair
# core occupies the NE corner, and a pillar pair (x10) splits stacks from the lounge.
rows = ['####################',
        '#.............######',
        '#.............######',
        '#.............######',
        '#..................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '##.................#',
        '#############DD#####']
m.layout(rows, {'.': tile(S, 6)}, CEIL, [tile(S, 25), tile(S, 33)])
m.recipe(S, 'bookcase', 1, 1)
m.recipe(S, 'bookcase', 4, 1)
m.recipe(S, 'bookcase', 7, 1)
m.recipe(S, 'magazines', 10, 1)
door(m, 'SC-Door06.png', 17, 4)                           # stair-core door on the lower east wall
m.recipe(S, 'low-books', 14, 6)
clock = sheet('!$PClock01.png').crop((0, 0, 32, 80))    # pendulum clock sprite frame, standing against the NE wall
m.over.append((18 * 32, 7 * 32 - 80, clock)); m.used.add('!$PClock01.png')
m.fill(1, 6, 9, 5, auto('SA-FloorT03.png'))            # reading-area carpet
for tx in (1, 6):
    m.recipe(S, 'reading-table', tx, 6)
    m.recipe(S, 'reading-chair-back', tx, 9)
    m.recipe(S, 'reading-chair-back', tx + 2, 9)
m.recipe(S, 'sofa-front', 11, 7)
m.recipe(S, 'low-books', 11, 10)
m.recipe(S, 'librarian-chair', 16, 8)
m.recipe(S, 'loan-counter', 15, 9)
m.fill(13, 11, 2, 2, auto('SA-Floor-T08.png'))
m.save()
