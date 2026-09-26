import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

CEIL = auto('SA-WallA01.png')
def door(m, name, x, y, fw=32, fh=64):
    """closed frame 0 of a PAW door sprite sheet at cell (x,y); bottom row sits on the wall base"""
    m.image(name, x, y, (0, 0, fw, fh))

S = 'ST-Fdshop-I01.png'
m = Map('m36_foodshop', '버거 가게와 식재료 진열', 20, 14, 'interior', '북쪽 조리실·주문대 줄, 남쪽 2인 식탁 3개와 분리수거')
# NE staff-room block pushes the east wall down (auto door on the lower wall), SW corner notched for
# a recessed seating nook wall; entrance vestibule juts south between two ceiling shoulders.
rows = ['####################',
        '#..............####',
        '#..............####',
        '#..................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '###................#',
        '###................#',
        '#########DD#########']
rows[1] += '#'; rows[2] += '#'
m.layout(rows, {'.': tile(S, 0)}, CEIL, [tile(S, 17), tile(S, 33)])
m.fill(1, 3, 14, 3, auto('SA-Floor-T05.png'))            # kitchen tiles behind the counters
m.recipe(S, 'diner-menu-burger', 1, 1)
m.recipe(S, 'diner-menu-sandwich', 2, 1)
m.recipe(S, 'diner-menu-drink', 3, 1)
m.recipe(S, 'diner-kitchen-unit', 5, 1)
m.recipe(S, 'diner-oven', 9, 2)
m.recipe(S, 'diner-kitchen-unit', 12, 1)
m.recipe(S, 'diner-poster', 16, 3)
door(m, 'SC-Door-AutoAS.png', 17, 3)                      # staff room door on the pushed-down east wall
m.recipe(S, 'diner-counter', 1, 6)
m.recipe(S, 'diner-counter', 4, 6)
m.recipe(S, 'diner-counter', 7, 6)
m.recipe(S, 'diner-counter', 10, 6)
m.recipe(S, 'diner-register', 13, 6)
for x, t in ((1, 4), (2, 5), (5, 6), (7, 8), (8, 9), (11, 15)):
    m.rect('SC-F-Vegetable01.png', t % 4, t // 4, 1, 1, x, 6)   # produce on the counter tops
m.recipe(S, 'diner-plant', 18, 5)
for tx in (4, 9, 15):
    m.recipe(S, 'diner-table', tx, 9)
    m.recipe(S, 'diner-chair-east', tx - 1, 10)
    m.recipe(S, 'diner-chair-west', tx + 1, 10)
m.recipe(S, 'diner-waste', 17, 11)
m.fill(9, 11, 2, 2, auto('SA-FloorM03.png'))        # entrance mat
m.save()
