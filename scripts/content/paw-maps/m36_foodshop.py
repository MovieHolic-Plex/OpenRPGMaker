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

S = 'ST-Fdshop-I01.png'
m = Map('m36_foodshop', '버거 가게와 식재료 진열', 20, 14, 'interior', '북쪽 조리실·주문대 줄, 남쪽 2인 식탁 3개와 분리수거')
room(m, S, (17, 33), tile(S, 0), doors=(9, 10))
m.fill(1, 3, 18, 3, auto('SA-Floor-T05.png'))            # kitchen tiles behind the counters
m.recipe(S, 'diner-menu-burger', 1, 1)
m.recipe(S, 'diner-menu-sandwich', 2, 1)
m.recipe(S, 'diner-menu-drink', 3, 1)
m.recipe(S, 'diner-kitchen-unit', 5, 1)
m.recipe(S, 'diner-oven', 9, 2)
m.recipe(S, 'diner-kitchen-unit', 12, 1)
m.recipe(S, 'diner-poster', 15, 1)
door(m, 'SC-Door-AutoAS.png', 17, 1)
m.recipe(S, 'diner-counter', 1, 6)
m.recipe(S, 'diner-counter', 4, 6)
m.recipe(S, 'diner-counter', 7, 6)
m.recipe(S, 'diner-counter', 10, 6)
for i, (x, t) in enumerate(((1, 4), (2, 5), (5, 6), (7, 8), (8, 9), (11, 15))):
    m.rect('SC-F-Vegetable01.png', t % 4, t // 4, 1, 1, x, 6)   # produce on the counter tops
m.recipe(S, 'diner-plant', 18, 4)
for tx in (3, 9, 15):
    m.recipe(S, 'diner-table', tx, 9)
    m.recipe(S, 'diner-chair-east', tx - 1, 10)
    m.recipe(S, 'diner-chair-west', tx + 1, 10)
m.recipe(S, 'diner-waste', 17, 10)
m.fill(9, 11, 2, 2, auto('SA-FloorM03.png'))        # entrance mat
m.save()
