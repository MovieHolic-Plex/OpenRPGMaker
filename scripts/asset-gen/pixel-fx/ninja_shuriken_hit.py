"""ninja_shuriken_hit: 수리검 (착탄). Three stars thud in one after another (x-sparks), a violet impact flash, then they twirl out and drop.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'ninja_shuriken_hit', 64, 6, 'target'
PAL = pal(IRON, pick(NIGHT, 'v1', 'v2', 'v3', 'v4'), WHITE)
HITS = [(24, 24), (38, 34), (26, 42)]


def xhit(c, x, y, r, big=False):
    c.line([(x - r, y - r), (x + r, y + r)], 'v3', 3 if big else 1)
    c.line([(x - r, y + r), (x + r, y - r)], 'v3', 3 if big else 1)
    c.line([(x - r + 1, y - r + 1), (x + r - 1, y + r - 1)], 'w')
    c.line([(x - r + 1, y + r - 1), (x + r - 1, y - r + 1)], 'w')


def draw(c, f):
    if f < 3:
        for j in range(f):
            x, y = HITS[j]
            c.shuriken(x + 2, y, 4, 0.3 + j, 'i0', 'i2', 'i3')
        x, y = HITS[f]
        c.ring(x, y, 7 + f, 'v2', 2)
        xhit(c, x, y, 7, True)
        c.disc(x, y, 3, 'w')
        c.shuriken(x + 1, y, 5, 0.4 * f, 'i0', 'i2', 'i3')
        specks(c, x, y, 6, 6, 13, f, ['v4', 'i3', 'w'])
    elif f == 3:
        c.ring(CX, CY, 16, 'v2', 3, squash=0.9)
        c.ring(CX, CY, 15, 'v4', 1, squash=0.9)
        for j, (x, y) in enumerate(HITS):
            xhit(c, x, y, 4)
            c.shuriken(x + 2, y, 4, 0.8 + j, 'i0', 'i2', 'i3')
        c.rays(CX, CY, 10, 18, 26, 'v3', rot=0.2, jitter=[1, 0.7])
    elif f == 4:
        c.dring(CX, CY, 22, 'v2', squash=0.9)
        for j, (x, y) in enumerate(HITS):
            c.shuriken(x + (j - 1) * 6, y + 6, 3.5, 1.4 + j, 'i0', 'i1', 'i3')
            c.px(x + (j - 1) * 3, y, 'v4')
        specks(c, CX, CY, 10, 10, 24, 4, ['v3', 'i2'], spark_every=4)
    else:
        for j, (x, y) in enumerate(HITS):
            c.shuriken(x + (j - 1) * 9, FEET - 4 + j, 3, 2.2 + j, 'i0', 'i1', 'i2')
        specks(c, CX, CY, 8, 14, 26, 5, ['v2', 'i1'], spark_every=4, core='v4')


if __name__ == '__main__':
    run(globals())

