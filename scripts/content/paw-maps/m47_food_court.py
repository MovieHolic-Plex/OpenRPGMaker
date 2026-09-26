import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

CEIL = auto('SA-WallA01.png')
def door(m, name, x, y, fw=32, fh=64):
    """closed frame 0 of a PAW door sprite sheet at cell (x,y); bottom row sits on the wall base"""
    m.image(name, x, y, (0, 0, fw, fh))

S = 'ST-Icecream-I01.png'
m = Map('m47_food_court', '파티 홀과 푸드코트', 22, 16, 'interior', '북쪽 뷔페 카운터, 중앙 파티 테이블(파티 요리·케이크·음료), 남쪽 중화·라멘·도시락·초밥 테이블')
# central structural pillar between the two table rows (wall faces run down its south side),
# chamfered south corners, service door on the kitchen side of the north wall.
rows = ['######################',
        '#....................#',
        '#....................#',
        '#....................#',
        '#....................#',
        '#....................#',
        '#....................#',
        '#....................#',
        '#....................#',
        '#..........#.........#',
        '#....................#',
        '#....................#',
        '#....................#',
        '#....................#',
        '##..................##',
        '##########DD##########']
m.layout(rows, {'.': auto('SA-Floor-T10.png')}, CEIL, [tile(S, 17), tile(S, 25)])
m.fill(5, 3, 12, 2, auto('SA-Floor-T07.png'))           # buffet service strip
m.recipe(S, 'icecream-window', 2, 1)
m.recipe(S, 'icecream-window', 15, 1)
m.recipe(S, 'icecream-menu', 9, 1)
m.recipe(S, 'icecream-menu', 12, 1)
m.fill(6, 4, 10, 1, auto('Autotile-MarbleCounter01.png'), 'up')   # buffet counter
for i, (sh, t) in enumerate((('SC-F-Party01.png', 0), ('SC-F-Party01.png', 5), ('SC-F-Party01.png', 7), ('F-Party02.png', None),
                              ('SC-F-Party02.png', 6), ('SC-F-Party02.png', 0), ('SC-F-Party01.png', 12), ('SC-F-Juice01.png', 8), ('Cupnoodle.png', None), ('SC-F-Party02.png', 2))):
    x = 6 + i
    if sh == 'F-Party02.png': m.recipe(sh, 'paw-food-legacy-pizza-03', x, 4)
    elif sh == 'Cupnoodle.png': m.rect(sh, 4, 0, 1, 1, x, 4)
    else: m.rect(sh, t % 4, t // 4, 1, 1, x, 4)
m.recipe(S, 'icecream-plant', 1, 3)
door(m, 'SC-Door-Metal02.png', 19, 1)
m.recipe(S, 'icecream-plant', 20, 3)
tables = ((2, 7), (8, 7), (14, 7), (2, 11), (8, 11), (14, 11))
foods = ((('SC-F-Party01.png', 8), ('SC-F-Party02.png', 11), ('SC-F-Party01.png', 14)),
         (('SC-F-Party01.png', 1), ('SC-F-Party02.png', 8), ('SC-F-Party02.png', 12)),
         (('F-Party02.png', 'paw-food-legacy-pizza-07'), ('F-Party02.png', 'paw-food-legacy-pizza-01'), ('F-Party02.png', 'paw-food-legacy-pizza-08')),
         (('SC-F-Cninese01.png', 0), ('SC-F-Cninese01.png', 8), ('SC-F-Cninese02.png', 1)),
         (('SC-F-IstNudle01.png', 1), ('SC-F-IstNudle01.png', 5), ('SC-F-Obento01.png', 1)),
         (('susi.png', 9), ('susi.png', 8), ('SC-F-Juice01.png', 4)))
for (tx, ty), fs in zip(tables, foods):
    m.recipe(S, 'icecream-table-wide', tx, ty)
    for cx in (tx, tx + 2):
        m.recipe(S, 'icecream-chair-south', cx, ty - 1)
        m.recipe(S, 'icecream-chair-north', cx, ty + 2)
    for i, (sh, t) in enumerate(fs):
        if isinstance(t, str): m.recipe(sh, t, tx + i, ty)
        else: m.rect(sh, t % 4, t // 4, 1, 1, tx + i, ty)
m.save()
