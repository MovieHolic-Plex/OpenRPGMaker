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

S = 'ST-Icecream-I01.png'
m = Map('m41_icecream', '아이스크림 가게', 16, 14, 'interior', '쇼케이스 2개·주문줄, 마주 보는 8석 테이블 2개와 2인석, 음료')
room(m, S, (17, 25), tile(S, 0), doors=(7, 8))
m.recipe(S, 'icecream-menu', 2, 1)
m.recipe(S, 'icecream-window', 6, 1)
m.recipe(S, 'icecream-window', 10, 1)
door(m, 'SC-Door07.png', 14, 1)
m.recipe(S, 'icecream-showcase', 1, 4)
m.recipe(S, 'icecream-showcase', 4, 4)
m.recipe(S, 'icecream-plant', 14, 3)
for tx in (1, 6):
    m.recipe(S, 'icecream-table-wide', tx, 8)
    for cx in (tx, tx + 2):
        m.recipe(S, 'icecream-chair-south', cx, 7)
        m.recipe(S, 'icecream-chair-north', cx, 10)
m.rect('SC-F-Juice01.png', 0, 0, 1, 1, 2, 8)
m.rect('SC-F-Juice01.png', 1, 2, 1, 1, 7, 8)
m.recipe(S, 'icecream-table-small', 12, 8)
m.recipe(S, 'icecream-chair-east', 11, 8)
m.recipe(S, 'icecream-chair-west', 13, 8)
m.rect('SC-F-Juice01.png', 0, 1, 1, 1, 12, 8)
m.fill(7, 11, 2, 2, auto('SA-Floor-T06.png'))
m.save()
