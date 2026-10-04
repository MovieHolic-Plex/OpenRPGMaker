"""ninja_thousand_hit: 천본 벚꽃 (착탄). Kunai stab into each foe from above in quick succession, violet cut lines cross over the body, a sakura-shaped burst blooms and blows away as petals and iron glints.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'ninja_thousand_hit', 64, 10, 'allTargets'
PAL = pal(pick(NIGHT, 'v0', 'v1', 'v2', 'v3', 'v4'), IRON, pick(SAKURA, 's1', 's2', 's3'), pick(BLOOD, 'r2'), WHITE)
ANG = math.pi / 2 + 0.3
R = rng(7)
HITS = [(R.uniform(12, 52), R.uniform(16, 50), i % 4) for i in range(14)]
CUTS = [((4, 14), (60, 46)), ((60, 12), (4, 50)), ((6, 32), (58, 30))]


def draw(c, f):
    if f < 4:
        for i, (x, y, t) in enumerate(HITS):
            if t < f:
                c.kunai(x, y, ANG, 10, 'i0', 'i1', 'i2', 'v1', 'r2')
            elif t == f:
                c.kunai(x, y, ANG, 12, 'i0', 'i2', 'w', 'v2', 'r2')
                c.spark(x, y, 3, 'w', 'v4')
        if f >= 1:
            c.lens(*CUTS[f - 1], 3.5, ['v1', 'v3', 'w'])
        if f == 3:
            c.lens(*CUTS[2], 3.5, ['v1', 'v3', 'w'])
    elif f == 4:
        for p in CUTS:
            c.lens(*p, 2.5, ['v2', 'w'])
        c.flower(CX, CY, 20, -math.pi / 2, ('v1', 'v3', 'v4'), core='w', dots='s2')
        c.spark(CX, CY, 14, 'w', 'w', diag=True)
    elif f == 5:
        c.ring(CX, CY, 25, 'v2', 3)
        c.ring(CX, CY, 24, 'v4', 1)
        c.flower(CX, CY, 16, -math.pi / 2 + 0.3, ('s1', 's2', 's3'), core='w', dots='s1')
        c.rays(CX, CY, 10, 26, 31, 'i3', rot=0.3)
    elif f == 6:
        c.dring(CX, CY, 29, 'v3')
        c.flower(CX, CY, 9, 0.2, ('s1', 's2', 's3'))
        burst_petals(c, CX, CY, 16, 24, 6, L=4.5, keys=('s1', 's2', 's3', 'v3'), hi='w')
        specks(c, CX, CY, 6, 10, 24, 6, ['i3', 'w'], spark_every=3)
    elif f == 7:
        c.dring(CX, CY, 31, 'v2', parity=1)
        burst_petals(c, CX, CY, 18, 27, 7, drop=4, L=4, keys=('s1', 's2', 's3', 'v3'), hi='w')
        for i, (x, y, t) in enumerate(HITS[::3]):
            c.px(x, y, 'i3')
    elif f == 8:
        burst_petals(c, CX, CY, 14, 28, 8, drop=10, L=3.5, keys=('s1', 's2', 'v3'))
        specks(c, CX, CY, 6, 12, 28, 8, ['i2', 'v4'], spark_every=3)
    else:
        burst_petals(c, CX, CY, 9, 29, 9, drop=16, L=3, keys=('s1', 'v2'))
        specks(c, CX, CY, 5, 14, 30, 9, ['v2', 'i1'], spark_every=3, core='v3')


if __name__ == '__main__':
    run(globals())

