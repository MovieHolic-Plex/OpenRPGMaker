import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

CEIL = auto('SA-WallA01.png')
def door(m, name, x, y, fw=32, fh=64):
    """closed frame 0 of a PAW door sprite sheet at cell (x,y); bottom row sits on the wall base"""
    m.image(name, x, y, (0, 0, fw, fh))

S, S2 = 'ST-Schl-I01.png', 'ST-Schl-I02.png'
m = Map('m44_school_corridor', '학교 복도와 보건실', 24, 16, 'interior', '서쪽 현관 복도(신발장·교실문), 동쪽 보건실(침대 2·가림막·약장·체중계·시력표)')
# corridor x1..12 ends in the entrance hall (concrete shoe area); the nurse room x14..22 sits behind
# a solid partition (x13) whose south end shows its wall face (rows 9-11) and leaves an opening at
# rows 12-13 onto the entrance hall; the nurse room's SE corner is notched by a storage closet.
rows = ['########################',
        '#............#.........#',
        '#............#.........#',
        '#............#.........#',
        '#............#.........#',
        '#............#.........#',
        '#............#.........#',
        '#............#.........#',
        '#............#.........#',
        '#......................#',
        '#......................#',
        '#......................#',
        '#............D.........#',
        '#............D......####',
        '#............###########',
        '######DD################']
def floor(x, y): return tile(S2, 6) if x >= 14 else tile(S, 6)
def walls(x, y): return [tile(S2, 17), tile(S2, 25), tile(S2, 33)] if x >= 14 else [tile(S, 41), tile(S, 49), tile(S, 57)]
m.layout(rows, {'.': floor}, CEIL, walls)
m.fill(1, 12, 13, 3, auto('SA-Concrete01.png'))          # entrance concrete (shoe area, runs into the opening)
m.recipe(S, 'school-classroom-door', 3, 1)
m.recipe(S, 'school-classroom-door', 9, 1)
m.recipe(S, 'school-notice', 5, 2)
m.recipe(S, 'school-clock', 7, 2)
m.recipe(S, 'school-cleaning-locker', 1, 4)
m.recipe(S, 'school-plant', 12, 4)
m.recipe(S, 'school-shoe-locker', 1, 9)
m.recipe(S, 'school-shoe-locker', 10, 9)
m.chip('SPT-Gym01.png', 2, 12, 0, 0, 1, 2)                # ceremony standing sign
m.recipe(S2, 'special-window', 14, 1)
m.recipe(S2, 'special-eye-chart', 18, 2)
m.recipe(S2, 'special-medical-cabinet', 20, 2)
m.recipe(S2, 'special-scale', 17, 4)
m.recipe(S2, 'special-plant', 22, 4)
m.recipe(S2, 'special-bed', 21, 6)
m.recipe(S2, 'special-screen', 18, 8)
m.recipe(S2, 'special-bed', 21, 9)
m.recipe(S2, 'special-stool', 20, 11)
m.recipe(S2, 'special-plant', 14, 10)
m.save()
