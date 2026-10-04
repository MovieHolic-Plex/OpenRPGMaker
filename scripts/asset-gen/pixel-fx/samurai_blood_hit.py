"""samurai_blood_hit: 혈월 (착탄). Red moonlight lances down, a crimson crescent cut, the target's strength is drawn up as red motes into a draining vortex.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'samurai_blood_hit', 64, 8, 'allTargets'
PAL = pal(BLOOD, pick(INDIGO, 'n0', 'n1'), pick(SAKURA, 's1', 's2'), WHITE)


def motes(c, f, n, seed, rise):
    r = rng(seed)
    for i in range(n):
        x = CX + r.uniform(-18, 18)
        y = FEET - r.uniform(4, 30) - rise * r.uniform(0.7, 1.3)
        c.diamond(x, y, 1, 2, 'r2' if i % 3 else 'r3')
        c.px(x, y + 3, 'r1')


def draw(c, f):
    if f == 0:
        c.lens((CX, 0), (CX, FEET), 2, ['r1', 'r3'])
        c.ring(CX, FEET, 8, 'r1', 1, squash=0.3)
    elif f == 1:
        c.rect(CX - 5, 0, CX + 5, FEET, 'r1')
        c.rect(CX - 3, 0, CX + 3, FEET, 'r2')
        c.rect(CX - 1, 0, CX + 1, FEET, 'r4')
        c.ring(CX, FEET, 14, 'r2', 2, squash=0.3)
    elif f == 2:
        c.blade((50, 6), (14, 60), 14, 10, ['r0', 'r1', 'r2', 'r4', 'w'])
        c.spark(14, 58, 5, 'w', 'r3')
        c.ring(CX, FEET, 18, 'r1', 2, squash=0.3)
    elif f == 3:
        c.blade((50, 6), (14, 60), 14, 5, ['r1', 'r3'])
        c.ring(CX, CY, 14, 'r1', 3)
        c.ring(CX, CY, 13, 'r3', 1)
        c.disc(CX, CY, 6, 'r3')
        c.disc(CX, CY, 3, 'w')
        c.rays(CX, CY, 10, 16, 26, 'r2', rot=0.2)
    elif f == 4:
        for i in range(3):
            a = f * 70 + i * 120
            c.brush(CX, CY - 4, 20 - i * 3, a, a + 130, 0.5, 2, ['r1', 'r2', 'r3'][i], squash=0.6)
        motes(c, f, 10, 4, 6)
        c.disc(CX, CY - 6, 3, 'r3')
    elif f == 5:
        for i in range(3):
            a = f * 70 + i * 120
            c.brush(CX, CY - 8, 16 - i * 3, a, a + 130, 0.5, 1.5, ['r1', 'r2', 'r3'][i], squash=0.6)
        motes(c, f, 12, 5, 14)
        c.disc(CX, 12, 4, 'r2')
        c.disc(CX, 12, 2, 'r4')
    elif f == 6:
        motes(c, f, 10, 6, 24)
        c.lens((CX, 26), (CX, 0), 2.5, ['r1', 'r3'])
        c.dring(CX, FEET, 22, 'r1', squash=0.3)
    else:
        motes(c, f, 6, 7, 34)
        specks(c, CX, CY, 8, 12, 26, 7, ['r1', 'n1', 's1'], spark_every=4, core='r3')


if __name__ == '__main__':
    run(globals())

