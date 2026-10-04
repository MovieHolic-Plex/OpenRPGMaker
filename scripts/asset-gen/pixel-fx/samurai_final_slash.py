"""samurai_final_slash: 무명 일도 (착탄). Stillness then one diagonal cut appears through each foe after the fact: thin line -> white burst -> the cut shears open, indigo shock rings and petals.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'samurai_final_slash', 64, 10, 'allTargets'
PAL = pal(INDIGO, pick(SAKURA, 's1', 's2', 's3', 's4'), WHITE)
P0, P1 = (60, 6), (4, 60)
M = (32, 33)
L = math.hypot(P1[0] - P0[0], P1[1] - P0[1])
NX, NY = -(P1[1] - P0[1]) / L, (P1[0] - P0[0]) / L


def off(p, o):
    return (p[0] + NX * o, p[1] + NY * o)


def draw(c, f):
    if f == 0:
        c.spark(*M, 2, 'n4', 'n3')
        c.dring(*M, 12, 'n2')
    elif f == 1:
        c.line([P0, P1], 'n4')
        c.spark(*M, 4, 'w', 'n4')
    elif f == 2:
        c.lens(off(P0, 0), off(P1, 0), 3, ['n3', 'n4', 'w'])
        c.spark(*M, 8, 'w', 'n4', diag=True)
    elif f == 3:
        c.lens((66, 0), (-2, 66), 8, ['n1', 'n2', 'n3', 'n4', 'w'])
        c.disc(*M, 8, 'w')
        c.spark(*M, 16, 'w', 'w', diag=True)
        c.rays(*M, 14, 18, 30, 'n4', rot=0.3, jitter=[1, 0.6, 0.85])
    elif f == 4:
        c.ring(*M, 18, 'n2', 3)
        c.ring(*M, 17, 'n4', 1)
        for s in (-1, 1):
            c.lens(off((64, 2), s * 4), off((0, 64), s * 4), 3, ['n3', 'n4', 'w'])
        c.disc(*M, 4, 'w')
    elif f == 5:
        c.ring(*M, 24, 'n3', 2)
        c.dring(*M, 29, 'n2')
        for s in (-1, 1):
            c.lens(off((62, 4), s * 8), off((2, 62), s * 8), 2, ['n3', 'w'])
        line_petals(c, P0, P1, 10, 12, 5, L=4.5)
    elif f == 6:
        c.dring(*M, 30, 'n3')
        for s in (-1, 1):
            c.line([off((60, 6), s * 11), off((4, 60), s * 11)], 'n3')
        line_petals(c, P0, P1, 14, 16, 6, drop=3, L=4.5)
        specks(c, *M, 8, 8, 24, 6, ['n4', 'w'], spark_every=3)
    elif f == 7:
        c.dring(*M, 31, 'n2', parity=1)
        for s in (-1, 1):
            c.dline(off((56, 10), s * 14), off((8, 56), s * 14), 'n2')
        line_petals(c, P0, P1, 14, 20, 7, drop=7, L=4)
    elif f == 8:
        line_petals(c, P0, P1, 12, 22, 8, drop=12, L=3.5)
        specks(c, *M, 7, 12, 28, 8, ['n3', 'n4'], spark_every=3)
    else:
        line_petals(c, P0, P1, 8, 24, 9, drop=17, L=3, keys=('s1', 's2'))
        specks(c, *M, 5, 14, 30, 9, ['n2', 'n3'], spark_every=3, core='n4')


if __name__ == '__main__':
    run(globals())

