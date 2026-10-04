"""ranger_fire_arrow: 화염 화살 (투사체). A burning arrowhead with a flickering flame tongue and ember trail, tip left.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'ranger_fire_arrow', 32, 4, 'projectile'
PAL = pal(FIRE, pick(WOOD, 't0', 't1', 't2'), pick(STEEL, 's1'), WHITE)
Y = 16


def flame(c, x, y, L, h, k):
    c.poly([(x, y - h * 0.6), (x + L * 0.3, y - h), (x + L, y - h * 0.2), (x + L * 0.9, y + h * 0.5), (x + L * 0.3, y + h), (x, y + h * 0.6)], k)


def draw(c, f):
    wob = [0, 1, 0, -1][f]
    flame(c, 3, Y, 22 + wob * 2, 6 + (f % 2), 'e1')
    flame(c, 3, Y + wob * 0.5, 16 + wob, 4, 'e2')
    flame(c, 3, Y, 10, 2.5, 'e3')
    c.line([(4, Y), (9, Y)], 'e4', 1)
    # shaft + fletching visible behind the flame
    c.line([(19, Y), (29, Y)], 't1')
    c.line([(26, Y - 2), (30, Y - 2)], 't2')
    c.line([(26, Y + 2), (30, Y + 2)], 't2')
    c.poly([(1, Y), (5, Y - 2), (5, Y + 2)], 's1')
    c.px(1, Y, 'w')
    # embers scroll back
    for i in range(4):
        x = 16 + (i * 4 + f * 3) % 15
        y = Y + [(-7), 6, -5, 8][i] + (f + i) % 2
        c.px(x, y, 'e3' if i % 2 else 'e4')
        c.px(x + 1, y, 'e2')


if __name__ == '__main__':
    run(globals())

