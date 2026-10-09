"""ninja_clone_hit: 분신술 (착탄). Three violet clones strike from three angles in turn (each cut a steel-white line), then all three at once in a star-shaped burst; the clones pop into smoke.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'ninja_clone_hit', 64, 10, 'target'
PAL = pal(pick(NIGHT, 'v0', 'v1', 'v2', 'v3', 'v4'), IRON, pick(SMOKEV, 'q2', 'q3'), pick(BLOOD, 'r2'), WHITE)
CUT = ['v1', 'v3', 'i3', 'w']
SLASH = [((4, 10), (60, 50)), ((60, 8), (4, 52)), ((32, 2), (32, 62))]


def draw(c, f):
    if f == 0:
        for x in (8, 32, 56):
            c.ddisc(x, CY, 6, 'v1')
            c.px(x - 1, CY - 2, 'r2')
    elif f in (1, 2, 3):
        i = f - 1
        for j in range(i):
            c.lens(*SLASH[j], 1.2, ['v2', 'v3'])
        c.lens(*SLASH[i], 5, CUT)
        x = SLASH[i][1][0]
        y = SLASH[i][1][1]
        c.ninja(max(6, min(58, x)), min(FEET, y + 6), 20, 'v1', 'v0', 'r2', 'v3')
        c.spark(CX, CY, 5 + f, 'w', 'v4')
    elif f == 4:
        for p in SLASH:
            c.lens(*p, 3, ['v2', 'i3', 'w'])
        c.disc(CX, CY, 9, 'v3')
        c.disc(CX, CY, 6, 'w')
        c.spark(CX, CY, 16, 'w', 'w', diag=True)
    elif f == 5:
        c.ring(CX, CY, 17, 'v2', 3)
        c.ring(CX, CY, 16, 'v4', 1)
        for p in SLASH:
            c.lens(*p, 2, ['v3', 'w'])
        c.rays(CX, CY, 12, 19, 29, 'i3', rot=0.13, jitter=[1, 0.7, 0.85])
        c.disc(CX, CY, 3, 'w')
    elif f == 6:
        c.ring(CX, CY, 24, 'v3', 1)
        c.dring(CX, CY, 28, 'v2')
        for i, (x, y) in enumerate([(8, 44), (56, 44), (32, 14)]):
            c.cloud(x, y, 7, ['q2', 'q3', 'v4'], seed=i)
        specks(c, CX, CY, 10, 8, 22, 6, ['i3', 'w', 'v4'], spark_every=3)
    elif f == 7:
        c.dring(CX, CY, 30, 'v2', parity=1)
        for i, (x, y) in enumerate([(8, 42), (56, 42), (32, 12)]):
            c.cloud(x, y, 6, ['v1', 'q2', 'q3'], seed=i + 4, parity=i)
        specks(c, CX, CY, 10, 10, 26, 7, ['v3', 'i2'], spark_every=4)
    elif f == 8:
        for i, (x, y) in enumerate([(8, 40), (56, 40), (32, 10)]):
            c.ddisc(x, y, 5, 'q2', parity=i)
        specks(c, CX, CY, 9, 12, 28, 8, ['v3', 'i2'], spark_every=4, core='v4')
    else:
        for i, (x, y) in enumerate([(8, 38), (56, 38), (32, 8)]):
            c.ddisc(x, y, 3, 'v1', parity=i)
        specks(c, CX, CY, 6, 14, 30, 9, ['v2', 'i1'], spark_every=3, core='v3')


if __name__ == '__main__':
    run(globals())

