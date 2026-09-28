"""ranger_frost_arrow: 빙결 화살 (투사체). An ice-crystal arrowhead with a frosty trail and twinkling snow motes, tip left.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'ranger_frost_arrow', 32, 4, 'projectile'
PAL = pal(FROST, pick(WOOD, 't1', 't2'), WHITE)
Y = 16


def draw(c, f):
    # frost trail: a tapering pale band and scrolling snow
    c.poly([(8, Y - 3), (31, Y - 1), (31, Y + 1), (8, Y + 3)], 'i1')
    c.poly([(8, Y - 2), (26, Y), (8, Y + 2)], 'i2')
    c.line([(18, Y), (29, Y)], 't1')
    c.line([(26, Y - 2), (30, Y - 3)], 'i3')
    c.line([(26, Y + 2), (30, Y + 3)], 'i3')
    for i in range(4):
        x = 12 + (i * 5 + f * 4) % 19
        y = Y + [-7, 6, -5, 8][i]
        c.spark(x, y, 1 if (i + f) % 2 else 0, 'w', 'i3')
    # crystal head
    c.poly([(1, Y), (6, Y - 5), (12, Y - 2), (12, Y + 2), (6, Y + 5)], 'i2', outline='i0')
    c.poly([(2, Y), (6, Y - 3), (10, Y), (6, Y + 1)], 'i3')
    c.line([(2, Y), (8, Y - 2)], 'i4')
    c.px(1, Y, 'w')
    if f % 2 == 0:
        c.spark(6, Y - 5, 2, 'w', 'i4')
    else:
        c.spark(6, Y + 5, 2, 'w', 'i4')


if __name__ == '__main__':
    run(globals())

