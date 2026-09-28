"""ranger_arrow: shared ranger arrow loop (강사·연사·저격). Tip left, white wind streaks and a gold glint running along the shaft.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'ranger_arrow', 32, 4, 'projectile'
PAL = pal(WOOD, STEEL, pick(GOLD, 'y2', 'y3'), pick(LEAF, 'l1', 'l3'), WHITE)
Y = 16


def draw(c, f):
    # wind streaks trail to the right and scroll back each frame
    for i, (y, L) in enumerate([(Y - 4, 7), (Y + 4, 6), (Y - 2, 9), (Y + 2, 5)]):
        x = 18 + (i * 5 + f * 4) % 12
        c.line([(x, y), (min(31, x + L), y)], 's1' if i < 2 else 's2')
    c.arrow(2, Y, math.pi, 26, 't1', 's1', 'l1', hi='s2', fletch2='l3', head_len=6, head_w=3)
    c.line([(8, Y + 1), (26, Y + 1)], 't0')
    c.line([(8, Y), (26, Y)], 't2')
    gx = 8 + f * 5
    c.px(gx, Y, 'y3')
    c.px(gx + 1, Y, 'y2')
    if f % 2 == 0:
        c.spark(3, Y, 2, 'w', 'y3')
    else:
        c.px(1, Y, 'w')


if __name__ == '__main__':
    run(globals())

