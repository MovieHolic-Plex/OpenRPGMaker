"""ninja_needle: 마비침 (투사체). Three thin poisoned needles, tips left, dripping sickly green-yellow with an electric crackle trail.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'ninja_needle', 32, 4, 'projectile'
PAL = pal(IRON, SPARK, pick(NIGHT, 'v2', 'v3'), WHITE)


def needle(c, x, y, L, f, i):
    c.line([(x + L, y), (x + L + 6 + (f + i) % 3, y)], 'v2')
    zig = [(x + L + j * 2, y + ((j + f + i) % 2 * 2 - 1)) for j in range(5)]
    c.line(zig, 'g2')
    c.line([(x, y), (x + L, y)], 'i1', 2)
    c.line([(x, y), (x + L - 1, y)], 'i3')
    c.line([(x, y), (x + 3, y)], 'g3')
    c.px(x - 1, y, 'w')
    c.px(x + 2, y + 1 + (f + i) % 2, 'g2')
    c.px(x + 4, y + 2 + (f + i) % 3, 'g1')


def draw(c, f):
    j = [(0, 0), (1, 0), (0, 1), (-1, 0)][f]
    needle(c, 3 + j[0], 10, 12, f, 0)
    needle(c, 7 + j[1], 17, 11, f, 1)
    needle(c, 2 + j[0], 24, 12, f, 2)
    if f % 2 == 0:
        c.spark(4, 10 + (f // 2) * 14, 2, 'w', 'g3')


if __name__ == '__main__':
    run(globals())

