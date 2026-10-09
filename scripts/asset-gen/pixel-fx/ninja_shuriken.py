"""ninja_shuriken: 수리검 (투사체). Three spinning iron stars in a staggered line, lead star leftmost, violet spin trails behind.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'ninja_shuriken', 32, 4, 'projectile'
PAL = pal(IRON, pick(NIGHT, 'v1', 'v2', 'v3', 'v4'), WHITE)


def draw(c, f):
    rot = f * math.pi / 8
    for i, (x, y, r) in enumerate([(7, 15, 5.5), (18, 9, 4), (26, 21, 3.5)]):
        c.brush(x, y, r + 2, -60 + f * 22, 60 + f * 22, 0.5, 0.5, 'v2')
        c.line([(x + r + 1, y), (x + r + 5 + i, y)], 'v3')
        c.px(x + r + 7 + i, y, 'v2')
        c.shuriken(x, y, r, rot + i * 0.4, 'i0', 'i2', 'i3')
    c.spark(3, 13 + (f % 2), 2, 'w', 'v4') if f in (0, 2) else c.px(4, 17, 'w')


if __name__ == '__main__':
    run(globals())

