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

S, S2 = 'ST-Schl-I01.png', 'ST-Schl-I02.png'
m = Map('m44_school_corridor', '학교 복도와 보건실', 24, 16, 'interior', '서쪽 현관 복도(신발장·교실문), 동쪽 보건실(침대 2·가림막·약장·체중계·시력표)')
m.fill(0, 0, 24, 16, CEIL)
# corridor x1..13
m.fill(1, 1, 13, 1, tile(S, 41)); m.fill(1, 2, 13, 1, tile(S, 49)); m.fill(1, 3, 13, 1, tile(S, 57))
m.fill(1, 4, 13, 11, tile(S, 6)); m.fill(6, 15, 2, 1, tile(S, 6))
m.fill(1, 12, 13, 3, auto('SA-Concrete01.png'))           # entrance concrete (shoe area)
m.recipe(S, 'school-classroom-door', 3, 1)
m.recipe(S, 'school-classroom-door', 9, 1)
m.recipe(S, 'school-notice', 5, 2)
m.recipe(S, 'school-clock', 7, 2)
m.recipe(S, 'school-shoe-locker', 1, 9)
m.recipe(S, 'school-shoe-locker', 10, 9)
m.chip('SPT-Gym01.png', 2, 12, 0, 0, 1, 2)                # ceremony standing sign
# nurse room x15..22, separated by ceiling column x14
m.fill(15, 1, 8, 1, tile(S2, 17)); m.fill(15, 2, 8, 1, tile(S2, 25)); m.fill(15, 3, 8, 1, tile(S2, 33))
m.fill(15, 4, 8, 11, tile(S2, 6)); m.fill(14, 6, 1, 2, tile(S, 6))   # doorway through the partition
m.recipe(S2, 'special-window', 15, 1)
m.recipe(S2, 'special-eye-chart', 19, 2)
m.recipe(S2, 'special-medical-cabinet', 21, 2)
m.recipe(S2, 'special-scale', 18, 3)
m.recipe(S2, 'special-bed', 16, 9)
m.recipe(S2, 'special-bed', 16, 12)
m.recipe(S2, 'special-screen', 19, 9)
m.recipe(S2, 'special-plant', 22, 12)
m.recipe(S2, 'special-stool', 21, 6)
m.save()
