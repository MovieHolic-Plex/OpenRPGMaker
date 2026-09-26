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

S = 'ST-Toilet-I01.png'
m = Map('m38_restroom', '공용 화장실', 16, 11, 'interior', '칸막이 두 칸·전면 차폐, 동쪽 세면대와 소변기, 청소 도구')
room(m, S, (48, 56), tile(S, 1), doors=(12, 13))
m.fill(11, 8, 4, 2, auto('SA-Concrete02.png'))          # wet-floor area by the entrance
m.recipe(S, 'restroom-partition', 1, 3)
m.recipe(S, 'restroom-toilet-open', 2, 3)
m.recipe(S, 'restroom-partition', 5, 3)
m.recipe(S, 'restroom-toilet-closed', 7, 3)
m.recipe(S, 'restroom-partition', 10, 3)
m.recipe(S, 'restroom-privacy-panel', 1, 6)
m.recipe(S, 'restroom-privacy-panel', 7, 6)
m.recipe(S, 'restroom-mirror', 11, 2)
m.recipe(S, 'restroom-sinks', 11, 3)
m.recipe(S, 'restroom-urinal', 14, 1)
m.recipe(S, 'restroom-utility-sink', 14, 6)
m.recipe(S, 'restroom-mop', 12, 6)
m.recipe(S, 'restroom-bucket', 11, 7)
m.save()
