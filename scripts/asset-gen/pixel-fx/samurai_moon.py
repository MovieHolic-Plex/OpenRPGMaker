"""samurai_moon: 쌍월참 (착탄). Two crescent-moon cuts, one from each side, lock into a full moon ring, flash, then split into two drifting crescents.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'samurai_moon', 64, 10, 'target'
PAL = pal(INDIGO, pick(SAKURA, 's2', 's3'), pick(BOLT, 'y2'), WHITE)
CUT = ['n1', 'n2', 'n3', 'n4', 'w']
T, Bt = (32, 8), (32, 58)


def first(c, frac=1.0, th=10, keys=CUT):
    c.blade(T, Bt, -20, th, keys, frac=frac)


def second(c, frac=1.0, th=10, keys=CUT):
    c.blade(Bt, T, -20, th, keys, frac=frac)


def draw(c, f):
    if f == 0:
        specks(c, CX, CY, 10, 16, 26, 1, ['n3', 'n4'], spark_every=3)
        c.crescent(CX, CY, 4, ['n3', 'n4'], 2, -1)
    elif f == 1:
        first(c, 0.55)
        c.spark(*pol(CX, CY - 1, 25, -math.pi / 2 - 0.9), 4, 'w', 'n4')
    elif f == 2:
        first(c)
        c.spark(Bt[0] + 1, Bt[1] - 1, 5, 'w', 'n4', diag=True)
    elif f == 3:
        first(c, th=5, keys=['n2', 'n4'])
        second(c, 0.55)
    elif f == 4:
        first(c, th=4, keys=['n2', 'n3'])
        second(c)
        c.spark(T[0], T[1] + 1, 5, 'w', 'n4', diag=True)
    elif f == 5:
        c.ring(CX, CY - 1, 25, 'n2', 3)
        c.ring(CX, CY - 1, 24, 'n4', 1)
        first(c, th=6, keys=['n4', 'w'])
        second(c, th=6, keys=['n4', 'w'])
        c.disc(CX, CY - 1, 7, 'w')
        c.spark(CX, CY - 1, 13, 'w', 'w', diag=True)
        c.rays(CX, CY - 1, 12, 27, 31, 'y2', rot=0.26)
    elif f == 6:
        c.ring(CX, CY - 1, 29, 'n3', 2)
        c.crescent(CX - 12, CY - 3, 9, ['n2', 'n4', 'w'], 4, -2)
        c.crescent(CX + 12, CY + 1, 9, ['n2', 'n4', 'w'], -4, 2)
        specks(c, CX, CY, 8, 10, 22, 6, ['n4', 's3'], spark_every=4)
    elif f == 7:
        c.dring(CX, CY - 1, 30, 'n3')
        c.crescent(CX - 17, CY - 6, 8, ['n2', 'n3', 'n4'], 4, -2)
        c.crescent(CX + 17, CY + 4, 8, ['n2', 'n3', 'n4'], -4, 2)
        specks(c, CX, CY, 10, 8, 26, 7, ['n4', 's2', 's3'], spark_every=4)
    elif f == 8:
        c.dring(CX, CY - 1, 31, 'n2', parity=1)
        c.crescent(CX - 21, CY - 9, 6, ['n2', 'n3'], 3, -2)
        c.crescent(CX + 21, CY + 7, 6, ['n2', 'n3'], -3, 2)
        specks(c, CX, CY, 8, 12, 28, 8, ['n3', 's2'], spark_every=4, core='n4')
    else:
        c.crescent(CX - 24, CY - 12, 4, ['n2'], 2, -1)
        c.crescent(CX + 24, CY + 10, 4, ['n2'], -2, 1)
        specks(c, CX, CY, 7, 14, 29, 9, ['n2', 'n3'], spark_every=3, core='n4')


if __name__ == '__main__':
    run(globals())

