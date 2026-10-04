"""ninja_paralyze: 마비침 (착탄). Needles prick in, venom-green lightning crawls over the body, locking rings clamp down, and yellow-green sparks jitter as the paralysis sets.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'ninja_paralyze', 64, 8, 'target'
PAL = pal(SPARK, pick(NIGHT, 'v0', 'v1', 'v2', 'v3', 'v4'), pick(IRON, 'i1', 'i3'), WHITE)


def needles(c, depth):
    for x, y in ((24, 26), (36, 32), (28, 40)):
        c.line([(x + depth, y), (x + depth + 8, y)], 'i3')
        c.px(x + depth + 8, y, 'i1')


def crawl(c, seed, n, keys=('g1', 'g3')):
    r = rng(seed)
    for i in range(n):
        a = r.uniform(0, 2 * math.pi)
        p0 = pol(CX, CY, r.uniform(2, 8), a)
        p1 = pol(CX, CY, r.uniform(14, 24), a + r.uniform(-.5, .5), 1.1)
        c.bolt(p0, p1, seed * 10 + i, list(keys), segs=4, jitter=3, widths=[2, 1])


def lock(c, y, r, k, w=2):
    c.ring(CX, y, r, k, w, squash=0.3)


def draw(c, f):
    if f == 0:
        needles(c, 10)
        c.spark(34, 26, 3, 'w', 'g3')
    elif f == 1:
        needles(c, 0)
        for x, y in ((24, 26), (36, 32), (28, 40)):
            c.spark(x, y, 4, 'w', 'g3')
        c.ring(CX, CY, 8, 'g2', 1)
    elif f == 2:
        needles(c, 0)
        crawl(c, 2, 6)
        c.disc(CX, CY, 4, 'g3')
        c.ring(CX, CY, 12, 'v2', 2)
    elif f == 3:
        crawl(c, 3, 9, ('g1', 'g2', 'w'))
        lock(c, 20, 17, 'v2', 3)
        lock(c, 20, 16, 'g3', 1)
        lock(c, 44, 17, 'v2', 3)
        lock(c, 44, 16, 'g3', 1)
        c.spark(CX, CY, 10, 'w', 'g3', diag=True)
    elif f == 4:
        crawl(c, 4, 8)
        for y in (16, 30, 44):
            lock(c, y, 15, 'v1', 3)
            lock(c, y, 14, 'g2', 1)
        specks(c, CX, CY, 10, 10, 24, 4, ['g3', 'w'], spark_every=3)
    elif f == 5:
        crawl(c, 5, 6, ('g1', 'g2'))
        for y in (18, 32, 46):
            lock(c, y, 14, 'v2', 1)
        c.bolt((8, 10), (20, 22), 51, ['g2', 'g3'], segs=3, widths=[2, 1])
        c.bolt((56, 42), (44, 30), 52, ['g2', 'g3'], segs=3, widths=[2, 1])
    elif f == 6:
        crawl(c, 6, 4, ('g1', 'g3'))
        for y in (18, 32, 46):
            c.dring(CX, y, 14, 'v2', squash=0.3)
        specks(c, CX, CY, 12, 12, 28, 6, ['g2', 'g3', 'v4'], spark_every=4)
    else:
        c.bolt((14, 20), (22, 28), 71, ['g1', 'g3'], segs=3, widths=[1, 1])
        c.bolt((48, 38), (40, 46), 72, ['g1', 'g3'], segs=3, widths=[1, 1])
        specks(c, CX, CY, 8, 14, 28, 7, ['g1', 'v3'], spark_every=3, core='g3')


if __name__ == '__main__':
    run(globals())

