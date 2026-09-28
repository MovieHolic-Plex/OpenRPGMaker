"""mon_vine_lash: 덩굴 채찍 (착탄). A thorny vine snakes in from the left, coils back, then cracks across the
ally in a bright whip arc at the peak with a green-gold snap flash and torn leaves, and slithers away.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_18_35 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_vine_lash', 64, 10, 'target'
PAL = pal(VINE, pick(CRIMSON, 'c1', 'c2'), pick(TOXIC, 'g4'), WHITE)
PEAK = 4
VK = ('n0', 'n2', 'n3')


def lash(c, ctrl, w=3, thorn='n1'):
    c.vine(bez(ctrl, 28), VK, thorn=thorn, w=w, every=5)


def leaf(c, x, y, a, L=5):
    c.leaf(x, y, a, L, 'n3', 'n1', 'n0')


def snap(c, x, y, r):
    c.spark(x, y, r, 'w', 'g4', diag=True)
    c.ring(x, y, r + 2, 'n4')


def draw(c, f):
    if f == 0:
        lash(c, [(-2, 50), (6, 46), (12, 52)], 2)
    elif f == 1:
        lash(c, [(-2, 50), (10, 40), (16, 48), (22, 42)], 3)
    elif f == 2:  # rears up
        lash(c, [(-2, 52), (8, 40), (4, 20), (18, 10)], 3)
        leaf(c, 8, 34, -0.6)
    elif f == 3:  # swing starts: motion smear
        c.brush(20, 44, 26, -100, -30, 0.5, 1.5, 'n1')
        lash(c, [(-2, 52), (10, 36), (22, 16), (40, 14)], 3)
    elif f == 4:  # peak crack across the body
        c.brush(18, 50, 30, -80, -5, 0.5, 2, 'n1')
        c.brush(18, 50, 28, -70, -5, 0.5, 1, 'n4')
        lash(c, [(-2, 54), (16, 28), (40, 26), (54, 44)], 3)
        snap(c, 54, 44, 6)
        c.line([(CX - 10, 32), (CX + 12, 46)], 'c2', 2)
        c.line([(CX - 8, 31), (CX + 10, 44)], 'w')
        for i, (x, y, a) in enumerate([(46, 34, -0.3), (52, 52, 1.2), (40, 50, 2.2)]):
            leaf(c, x, y, a)
    elif f == 5:
        lash(c, [(-2, 54), (18, 34), (40, 34), (50, 50)], 3)
        c.line([(CX - 10, 32), (CX + 12, 46)], 'c1', 2)
        motes(c, 50, 46, 6, 4, 10, 5, ['n4', 'g4'])
        for x, y, a in [(50, 30, -0.1), (58, 50, 1.7), (44, 56, 2.9)]:
            leaf(c, x, y, a)
    elif f == 6:  # second, shorter lash back
        lash(c, [(-2, 54), (20, 46), (34, 38), (44, 32)], 2)
        snap(c, 44, 32, 3)
        c.line([(CX - 10, 32), (CX + 12, 46)], 'c1')
        for x, y, a in [(52, 36, 0.7), (56, 56, 2.3)]:
            leaf(c, x, y, a, 4)
    elif f == 7:  # recoils
        lash(c, [(-2, 54), (12, 46), (20, 52), (26, 44)], 2)
        for x, y, a in [(50, 44, 1.4), (46, 58, 2.9), (58, 38, 0.2)]:
            leaf(c, x, y, a, 4)
    elif f == 8:
        lash(c, [(-2, 54), (6, 48), (12, 54)], 2)
        for x, y, a in [(48, 52, 2.0), (40, 58, 3.0)]:
            leaf(c, x, y, a, 4)
        c.line([(CX - 8, 34), (CX + 8, 44)], 'c1')
    else:
        leaf(c, 44, 57, 3.1, 4)
        leaf(c, 30, 58, 2.6, 3)
        c.ddisc(CX, FEET + 2, 12, 'n1', squash=0.25)


if __name__ == '__main__':
    run(globals())
