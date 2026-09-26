import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

CEIL = auto('SA-WallA01.png')
def door(m, name, x, y, fw=32, fh=64):
    """closed frame 0 of a PAW door sprite sheet at cell (x,y); bottom row sits on the wall base"""
    m.image(name, x, y, (0, 0, fw, fh))

S = 'ST-Icecream-I01.png'
m = Map('m41_icecream', '아이스크림 가게', 16, 14, 'interior', '쇼케이스 2개·주문줄, 마주 보는 8석 테이블 2개와 2인석, 음료')
# serving bay in the NW (full-height wall), seating hall steps out east under a lower wall with a
# window bay; freezer room block NE; SE corner chamfered by the entrance.
rows = ['################',
        '#.......########',
        '#.......########',
        '#.......#......#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#.............##',
        '#######DD#######']
rows[3] = '#..............#'
m.layout(rows, {'.': tile(S, 0)}, CEIL, [tile(S, 17), tile(S, 25)])
m.recipe(S, 'icecream-menu', 2, 1)
m.recipe(S, 'icecream-menu', 5, 1)
m.recipe(S, 'icecream-window', 9, 3)
door(m, 'SC-Door07.png', 13, 3)
m.recipe(S, 'icecream-showcase', 1, 4)
m.recipe(S, 'icecream-showcase', 4, 4)
m.recipe(S, 'icecream-plant', 7, 3)
m.recipe(S, 'icecream-plant', 14, 5)
for tx in (1, 9):
    m.recipe(S, 'icecream-table-wide', tx, 9)
    for cx in (tx, tx + 2):
        m.recipe(S, 'icecream-chair-south', cx, 8)
        m.recipe(S, 'icecream-chair-north', cx, 11)
m.rect('SC-F-Juice01.png', 0, 0, 1, 1, 2, 9)
m.rect('SC-F-Juice01.png', 1, 2, 1, 1, 10, 9)
m.recipe(S, 'icecream-table-small', 12, 5)                # window-side two-seater
m.recipe(S, 'icecream-chair-east', 11, 5)
m.recipe(S, 'icecream-chair-west', 13, 5)
m.rect('SC-F-Juice01.png', 0, 1, 1, 1, 12, 5)
m.recipe(S, 'icecream-table-small', 13, 9)
m.recipe(S, 'icecream-chair-west', 14, 9)
m.fill(7, 11, 2, 2, auto('SA-Floor-T06.png'))
m.save()
