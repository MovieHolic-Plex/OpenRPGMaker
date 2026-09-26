import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

CEIL = auto('SA-WallA01.png')
def door(m, name, x, y, fw=32, fh=64):
    """closed frame 0 of a PAW door sprite sheet at cell (x,y); bottom row sits on the wall base"""
    m.image(name, x, y, (0, 0, fw, fh))

S = 'ST-Toilet-I01.png'
m = Map('m38_restroom', '공용 화장실', 16, 11, 'interior', '칸막이 두 칸·전면 차폐, 동쪽 세면대와 소변기, 청소 도구')
# L-shaped: the stall bank sits in the deep west bay; the wash area to the east is shallower
# (pipe chase above the sinks pushes the wall down), and the cleaner's alcove is a notch in the SW.
rows = ['################',
        '#.........######',
        '#.........######',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '###............#',
        '###########DD###']
m.layout(rows, {'.': tile(S, 1)}, CEIL, [tile(S, 48), tile(S, 56)])
m.fill(11, 8, 4, 2, auto('SA-Concrete02.png'))          # wet-floor area by the entrance
m.recipe(S, 'restroom-partition', 1, 3)
m.recipe(S, 'restroom-toilet-open', 2, 3)
m.recipe(S, 'restroom-partition', 5, 3)
m.recipe(S, 'restroom-toilet-closed', 7, 3)
m.recipe(S, 'restroom-partition', 9, 3)
m.recipe(S, 'restroom-privacy-panel', 1, 6)
m.recipe(S, 'restroom-privacy-panel', 6, 6)
m.recipe(S, 'restroom-mirror', 10, 3)
m.recipe(S, 'restroom-sinks', 10, 4)
m.recipe(S, 'restroom-urinal', 14, 3)
m.recipe(S, 'restroom-urinal', 13, 3)
m.recipe(S, 'restroom-utility-sink', 14, 6)
m.recipe(S, 'restroom-mop', 3, 8)
m.recipe(S, 'restroom-broom', 4, 8)
m.recipe(S, 'restroom-bucket', 5, 9)
m.save()
