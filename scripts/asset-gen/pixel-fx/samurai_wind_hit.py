"""samurai_wind_hit: 풍절 (착탄). The wind blade slams in, criss-cross cuts, a white vortex spins up around the target and throws petals.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'samurai_wind_hit', 64, 8, 'allTargets'
PAL = pal(INDIGO, pick(SAKURA, 's1', 's2', 's3'), WHITE)
CUT = ['n1', 'n3', 'n4', 'w']


def vortex(c, rot, r, keys, w0=0.5, w1=2.0, sq=0.42, n=3, span=110, y=CY):
    for i in range(n):
        a = rot + i * 360 / n
        k = keys[i % len(keys)]
        c.brush(CX, y, r, a, a + span, w0, w1, k, squash=sq)


def draw(c, f):
    if f == 0:
        c.blade((44, 10), (44, 58), 9, 8, CUT)
        for y in (16, 24, 34, 44, 52):
            c.line([(50, y), (62, y)], 'n3')
    elif f == 1:
        c.blade((34, 6), (34, 60), 11, 10, CUT)
        c.lens((6, 34), (60, 34), 3, ['n2', 'n4', 'w'])
        c.spark(34, 34, 7, 'w', 'n4', diag=True)
    elif f == 2:
        c.lens((6, 12), (58, 54), 4, CUT)
        c.lens((6, 54), (58, 12), 4, CUT)
        c.disc(CX, 33, 5, 'w')
        c.ring(CX, 33, 11, 'n3', 2)
        c.spark(CX, 33, 11, 'w', 'n4', diag=True)
    elif f == 3:
        vortex(c, 0, 24, ['n2', 'n3', 'n4'], 1, 3)
        vortex(c, 60, 15, ['n4', 'w'], 0.5, 2, n=2, y=30)
        c.lens((10, 16), (54, 50), 2, ['n4', 'w'])
        c.lens((10, 50), (54, 16), 2, ['n4', 'w'])
        c.disc(CX, 33, 3, 'w')
    elif f == 4:
        vortex(c, 90, 27, ['n2', 'n3', 'n4'], 1, 3, y=30)
        vortex(c, 170, 18, ['n4', 'w'], 0.5, 2, n=3, y=22)
        vortex(c, 20, 11, ['n3', 'w'], 0.5, 1.5, n=2, y=14)
        burst_petals(c, CX, 30, 7, 20, 4, L=4, sq=0.6)
    elif f == 5:
        vortex(c, 190, 29, ['n2', 'n3'], 0.5, 2.5, y=26)
        vortex(c, 260, 20, ['n3', 'n4'], 0.5, 1.5, y=16)
        burst_petals(c, CX, 26, 10, 26, 5, L=4, sq=0.7)
        specks(c, CX, 30, 5, 10, 22, 5, ['n4', 'w'], spark_every=3)
    elif f == 6:
        vortex(c, 280, 30, ['n1', 'n2'], 0.5, 1.5, y=22, span=80)
        for i in range(3):
            c.dline((10 + i * 16, 20 - i * 3), (22 + i * 16, 18 - i * 3), 'n3', phase=i)
        burst_petals(c, CX, 24, 10, 28, 6, drop=6, L=3.5)
    else:
        burst_petals(c, CX, 24, 8, 30, 7, drop=12, L=3, keys=('s1', 's2'))
        specks(c, CX, 28, 7, 12, 28, 7, ['n3', 'n2'], spark_every=3, core='n4')


if __name__ == '__main__':
    run(globals())

