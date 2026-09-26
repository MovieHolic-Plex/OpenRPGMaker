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

S = 'ST-Libry-I01.png'
m = Map('m40_library', '도서관 열람실', 20, 14, 'interior', '북벽 서가 3개·잡지대·낮은 서가, 독서 탁자 2개, 대출대, 소파, 괘종시계')
room(m, S, (25, 33), tile(S, 6), doors=(13, 14))
m.recipe(S, 'bookcase', 1, 1)
m.recipe(S, 'bookcase', 4, 1)
m.recipe(S, 'bookcase', 7, 1)
door(m, 'SC-Door06.png', 10, 1)
m.recipe(S, 'magazines', 11, 1)
m.recipe(S, 'low-books', 14, 2)
clock = sheet('!$PClock01.png').crop((0, 0, 32, 80))    # pendulum clock sprite frame, bottom on floor row 3
m.over.append((18 * 32, 4 * 32 - 80, clock)); m.used.add('!$PClock01.png')
m.fill(1, 6, 9, 5, auto('SA-FloorT03.png'))            # reading-area carpet
for tx in (1, 6):
    m.recipe(S, 'reading-table', tx, 6)
    m.recipe(S, 'reading-chair-back', tx, 9)
    m.recipe(S, 'reading-chair-back', tx + 2, 9)
m.recipe(S, 'sofa-front', 11, 5)
m.recipe(S, 'low-books', 11, 9)
m.recipe(S, 'librarian-chair', 16, 7)
m.recipe(S, 'loan-counter', 15, 8)
m.fill(13, 11, 2, 2, auto('SA-Floor-T08.png'))
m.save()
