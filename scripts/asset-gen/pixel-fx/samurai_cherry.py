"""samurai_cherry: 벚꽃 난무 (착탄). Petals swirl in, four quick pink-white cuts, a sakura bloom bursts at the core and scatters into falling petals.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'samurai_cherry', 64, 10, 'target'
PAL = pal(SAKURA, pick(INDIGO, 'n1', 'n2', 'n4'), WHITE)
CUT = ['s0', 's2', 's4', 'w']
CUTS = [((6, 12), (58, 56)), ((58, 10), (6, 54)), ((2, 30), (62, 36)), ((24, 4), (40, 62))]


def swirl(c, rot, r, n, seed, L=4):
    rr = rng(seed)
    for i in range(n):
        a = rot + i * 2 * math.pi / n
        rad = r * rr.uniform(0.8, 1.1)
        c.petal(*pol(CX, CY, rad, a, 0.8), a + math.pi / 2, L, 's2' if i % 2 else 's3', 's4')


def draw(c, f):
    if f == 0:
        swirl(c, 0.0, 26, 10, 1)
        c.dring(CX, CY, 20, 's1', squash=0.8)
    elif 1 <= f <= 4:
        swirl(c, f * 0.6, 26 - f * 3, 8, f, 3.5)
        for j in range(f - 1):
            (p0, p1) = CUTS[j]
            c.lens(p0, p1, 1.2, ['s1', 's2'])
        p0, p1 = CUTS[f - 1]
        c.lens(p0, p1, 4.5, CUT)
        c.spark(*p1, 4, 'w', 's3')
        if f == 4:
            c.disc(CX, CY, 5, 's3')
            c.disc(CX, CY, 3, 'w')
    elif f == 5:
        c.ring(CX, CY, 22, 's1', 3)
        c.ring(CX, CY, 21, 's3', 1)
        c.flower(CX, CY, 17, -math.pi / 2, ('s1', 's2', 's4'), dots='s0')
        c.spark(CX, CY, 9, 'w', 'w', diag=True)
        c.rays(CX, CY, 10, 24, 30, 's3', rot=0.3)
    elif f == 6:
        c.ring(CX, CY, 27, 's2', 1)
        c.flower(CX, CY, 10, -math.pi / 2 + 0.3, ('s1', 's2', 's4'), dots='s0')
        burst_petals(c, CX, CY, 14, 22, 6, L=5)
        specks(c, CX, CY, 6, 10, 22, 6, ['s4', 'w'], spark_every=3)
    elif f == 7:
        c.dring(CX, CY, 29, 's1')
        burst_petals(c, CX, CY, 16, 25, 7, drop=4, L=4.5)
        c.flower(CX, CY - 1, 5, 0.6, ('s1', 's2', 's3'))
    elif f == 8:
        burst_petals(c, CX, CY, 14, 27, 8, drop=9, L=4)
        specks(c, CX, CY, 5, 14, 26, 8, ['s3', 'n4'], spark_every=3)
    else:
        burst_petals(c, CX, CY, 10, 28, 9, drop=15, L=3, keys=('s1', 's2'))
        specks(c, CX, CY, 5, 16, 28, 9, ['s1', 'n2'], spark_every=4, core='s3')


if __name__ == '__main__':
    run(globals())

