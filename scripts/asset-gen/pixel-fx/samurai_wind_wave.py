"""samurai_wind_wave: 풍절 (투사체). A crescent of cutting wind, convex face leading left, with streaming ribbons behind.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'samurai_wind_wave', 32, 4, 'projectile'
PAL = pal(INDIGO, pick(SAKURA, 's2', 's3'), WHITE)


def draw(c, f):
    ph = f % 4
    for i, (y, ln, k) in enumerate([(7, 12, 'n2'), (11, 16, 'n3'), (16, 18, 'n4'), (21, 15, 'n3'), (25, 10, 'n2')]):
        x0 = 11 + (i + ph) % 3 * 2
        c.line([(x0, y), (x0 + ln - (ph + i) % 4, y)], k)
        c.px(x0 + ln + 2 - (ph + i) % 2, y, 'n2')
    wob = [0, 1, 0, -1][f]
    c.blade((10, 2 + wob), (10, 30 + wob), 7, 7, ['n1', 'n3', 'n4', 'w'])
    c.px(3, 16 + wob, 'w')
    c.spark(4, [9, 16, 23, 16][f] + wob, 2, 'w', 'n4')
    c.petal(24 - ph * 2, [5, 27, 6, 26][f], ph * 0.9, 3, 's2', 's3')


if __name__ == '__main__':
    run(globals())

