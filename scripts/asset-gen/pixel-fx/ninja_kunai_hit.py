"""ninja_kunai_hit: 쿠나이 비 (착탄). Kunai rain down around the target in waves, each strike kicks a spark; the ground ring flashes violet and the blades vanish in smoke puffs.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'ninja_kunai_hit', 64, 8, 'allTargets'
PAL = pal(IRON, pick(NIGHT, 'v1', 'v2', 'v3', 'v4'), pick(BLOOD, 'r2'), pick(SMOKEV, 'q1', 'q2', 'q3'), WHITE)
ANG = math.pi / 2 + 0.35
DROPS = [(12, 0), (44, 0), (28, 1), (20, 2), (52, 2), (36, 3), (8, 3)]


def stuck(c, x, k='i2'):
    c.kunai(x, FEET, ANG, 12, 'i0', k, 'i3', 'v2', 'r2')


def draw(c, f):
    if f < 4:
        for x, t in DROPS:
            if t < f:
                stuck(c, x)
            elif t == f:
                ux, uy = math.cos(ANG), math.sin(ANG)
                c.kunai(x - ux * 14, FEET - 16, ANG, 13, 'i0', 'i2', 'w', 'v2', 'r2')
                c.line([(x - ux * 30, FEET - 44), (x - ux * 16, FEET - 30)], 'v3')
            if t == f - 1:
                c.spark(x, FEET - 1, 4, 'w', 'v3', diag=True)
                c.ring(x, FEET, 5, 'v2', 1, squash=0.35)
        if f == 3:
            c.ring(CX, CY, 12, 'v2', 2)
            c.spark(CX, CY, 7, 'w', 'v4')
    elif f == 4:
        c.ring(CX, FEET, 28, 'v2', 3, squash=0.3)
        c.ring(CX, FEET, 27, 'v4', 1, squash=0.3)
        for x, t in DROPS:
            stuck(c, x, 'i3')
            c.spark(x, FEET - 3, 3, 'w', 'v3')
        c.lens((CX, FEET), (CX, 10), 5, ['v1', 'v3', 'v4', 'w'])
    elif f == 5:
        c.dring(CX, FEET, 30, 'v3', squash=0.3)
        for i, (x, t) in enumerate(DROPS):
            if i % 2:
                stuck(c, x)
            else:
                c.puff(x, FEET - 5, 5, ['q1', 'q2', 'q3'], seed=i, lobes=4)
        specks(c, CX, CY, 8, 8, 24, 5, ['v4', 'w'], spark_every=3)
    elif f == 6:
        for i, (x, t) in enumerate(DROPS):
            c.puff(x, FEET - 7 - i % 2 * 2, 5 - (i % 2), ['q1', 'q2', 'q3'], seed=i + 10, lobes=4)
        specks(c, CX, CY, 8, 10, 26, 6, ['v3', 'q3'], spark_every=4)
    else:
        for i, (x, t) in enumerate(DROPS):
            c.ddisc(x, FEET - 10, 4, 'q1', parity=i)
            c.px(x, FEET - 14, 'q2')
        specks(c, CX, CY, 6, 12, 28, 7, ['v2', 'q2'], spark_every=3, core='v4')


if __name__ == '__main__':
    run(globals())

