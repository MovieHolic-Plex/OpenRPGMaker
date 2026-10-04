"""samurai_thunder_hit: 뇌광 일섬 (착탄). A horizontal gold cut through the target, a lightning bolt drops onto it, crackling shock ring, electric sparks bleed off.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'samurai_thunder_hit', 64, 8, 'allTargets'
PAL = pal(pick(INDIGO, 'n0', 'n1', 'n2', 'n3', 'n4'), BOLT, WHITE)


def crackle(c, r, seed, keys, n=6):
    rr = rng(seed)
    for i in range(n):
        a = i * 2 * math.pi / n + rr.uniform(-.3, .3)
        c.bolt(pol(CX, CY, r * 0.4, a, 0.8), pol(CX, CY, r, a + rr.uniform(-.3, .3), 0.8), seed + i, keys, segs=3, jitter=2.5, widths=[1] * len(keys))


def draw(c, f):
    if f == 0:
        c.lens((64, CY), (20, CY), 3, ['y1', 'y2', 'w'])
        c.spark(22, CY, 4, 'w', 'y2')
    elif f == 1:
        c.lens((66, CY), (-2, CY), 5, ['y0', 'y1', 'y2', 'w'])
        c.bolt((CX + 6, 0), (CX, CY), 11, ['y1', 'y3'], segs=5, jitter=4, widths=[3, 1])
    elif f == 2:
        c.bolt((CX + 4, 0), (CX, CY), 12, ['y0', 'y2', 'w'], segs=6, jitter=5, widths=[5, 3, 1])
        c.lens((66, CY), (-2, CY), 3, ['y2', 'w'])
        c.disc(CX, CY, 8, 'y2')
        c.disc(CX, CY, 5, 'w')
        c.spark(CX, CY, 14, 'w', 'y3', diag=True)
    elif f == 3:
        c.ring(CX, CY, 16, 'y1', 3, squash=0.8)
        c.ring(CX, CY, 15, 'y3', 1, squash=0.8)
        crackle(c, 26, 3, ['y2', 'w'], 8)
        c.disc(CX, CY, 6, 'y3')
        c.disc(CX, CY, 3, 'w')
        c.bolt((CX + 2, 4), (CX, CY - 5), 13, ['y1', 'y3'], segs=4, jitter=3, widths=[2, 1])
    elif f == 4:
        c.ring(CX, CY, 22, 'n2', 2, squash=0.8)
        c.ring(CX, CY, 21, 'y2', 1, squash=0.8)
        crackle(c, 28, 4, ['y1', 'y3'], 7)
        c.spark(CX, CY, 5, 'w', 'y2')
        specks(c, CX, CY, 8, 10, 20, 4, ['y3', 'w'])
    elif f == 5:
        c.dring(CX, CY, 26, 'y1', squash=0.8)
        crackle(c, 22, 5, ['y1', 'y2'], 5)
        specks(c, CX, CY, 12, 12, 28, 5, ['y2', 'y3', 'n4'], spark_every=4)
    elif f == 6:
        c.dring(CX, CY, 28, 'n2', parity=1, squash=0.8)
        for i in range(3):
            x = 14 + i * 18
            c.bolt((x, CY - 8 + i * 5), (x + 8, CY - 2 + i * 5), 60 + i, ['y1'], segs=3, jitter=2, widths=[1])
        specks(c, CX, CY, 12, 14, 29, 6, ['y1', 'y2', 'n3'], spark_every=4, core='y3')
    else:
        specks(c, CX, CY - 4, 10, 16, 30, 7, ['y1', 'n3', 'n2'], spark_every=4, core='y2')


if __name__ == '__main__':
    run(globals())

