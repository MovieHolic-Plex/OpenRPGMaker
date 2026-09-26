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

S = 'ST-Convi-I01.png'
m = Map('m35_konbini', '편의점 내부', 16, 12, 'interior', '냉장 진열·계산대·ATM·잡지대·과자 선반, 계산대 위 도시락/컵라면')
# L-shaped shop: staff backroom notch in the NE corner (ceiling mass) pushes the east wall down,
# windbreak vestibule jutting south at the entrance.
rows = ['################',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '####...........#',
        '####.........###',
        '#######DD#######']
m.layout(rows, {'.': tile(S, 1)}, CEIL, [tile(S, 17), tile(S, 25)])
m.fill(7, 10, 2, 1, auto('SA-FloorM01.png'))           # entrance mat
m.recipe(S, 'conveni-rice-meals', 1, 2)
m.recipe(S, 'conveni-desserts', 3, 2)
m.recipe(S, 'conveni-drinks', 5, 2)
m.recipe(S, 'conveni-clock', 7, 1)
m.recipe(S, 'conveni-fridge', 9, 2)
m.recipe(S, 'conveni-fridge', 11, 2)
m.recipe(S, 'conveni-atm', 13, 1)
door(m, 'SC-Door-Metal02.png', 14, 1)                     # staff room
m.recipe(S, 'conveni-service-counter', 1, 6)
m.rect('SC-F-Obento01.png', 0, 0, 1, 1, 1, 6)             # boxed lunch on the counter top
m.rect('SC-F-IstNudle01.png', 0, 0, 1, 1, 3, 6)           # cup noodle on the counter top
m.recipe(S, 'conveni-wine', 5, 6)
m.recipe(S, 'conveni-dry-goods', 8, 6)
m.recipe(S, 'conveni-magazines', 12, 6)
m.recipe(S, 'conveni-snacks', 4, 9)
m.recipe(S, 'conveni-cosmetics', 10, 9)
m.recipe(S, 'conveni-basket', 13, 9)
m.fill(1, 8, 4, 1, auto('SA-FloorS01.png'))          # staff mat behind the counter
m.save()
