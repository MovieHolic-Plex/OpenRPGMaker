"""ninja_kunai: 쿠나이 비 (투사체). A fan of three kunai diving down-left with violet speed lines.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'ninja_kunai', 32, 4, 'projectile'
PAL = pal(IRON, pick(NIGHT, 'v1', 'v2', 'v3', 'v4'), pick(BLOOD, 'r2'), WHITE)
ANG = math.pi - 0.5  # pointing left and down (y grows downward)


def draw(c, f):
    j = [(0, 0), (1, 0), (0, 1), (-1, 0)][f]
    for i, (x, y, L) in enumerate([(3, 20, 17), (10, 28, 14), (13, 11, 14)]):
        ux, uy = math.cos(ANG), math.sin(ANG)
        tx, ty = x - ux * (L + 3), y - uy * (L + 3)
        c.line([(tx, ty), (tx - ux * (4 + (f + i) % 3), ty - uy * (4 + (f + i) % 3))], 'v3')
        c.line([(tx + 2, ty - 1), (tx + 2 - ux * 3, ty - 1 - uy * 3)], 'v2')
        c.kunai(x + j[0], y + j[1], ANG, L, 'i0', 'i2', 'i3', 'v2', 'r2')
    c.spark(4 + j[0], 12 + j[1], 2, 'w', 'v4') if f % 2 == 0 else c.px(10, 22, 'w')


if __name__ == '__main__':
    run(globals())

