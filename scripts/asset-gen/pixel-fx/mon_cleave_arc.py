"""mon_cleave_arc: 쪼개기 · 미궁의 광란 (착탄). A heavy axe-shaped arc winds up high on the left, crashes down
across the ally from upper-left to lower-right in steel-and-crimson at the peak, splits the ground, and fades as sparks.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_18_35 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_cleave_arc', 64, 10, 'target'
PAL = pal(STEEL, CRIMSON, pick(EARTH, 'd0', 'd2'), WHITE)
PEAK = 4
P0, P1 = (6, 6), (54, 56)  # swing path: upper left -> lower right
SK = ['c0', 'c1', 'm2', 'm3', 'w']


def swing(c, frac, th, keys=SK, bulge=-16):
    c.blade(P0, P1, bulge, th, keys, frac=frac)


def ground_split(c, w, seed):
    pts = c.crack(CX - 4, FEET + 1, CX + 22, FEET + 3, seed, 'd0', segs=4, jit=1.2, w=w + 1)
    if w > 1:
        c.line(pts, 'c2')


def chips(c, n, seed, top):
    r = rng(seed)
    for i in range(n):
        x, y = CX + r.uniform(-4, 26), r.uniform(top, FEET)
        c.line([(x, y), (x + 2, y - 2)], 'd2')


def draw(c, f):
    if f == 0:  # wind-up glint high on the left
        c.spark(8, 8, 3, 'w', 'm2')
        c.arc(8, 8, 6, 180, 300, 'm1')
    elif f == 1:
        c.spark(10, 6, 5, 'w', 'm3', diag=True)
        swing(c, 0.2, 5, ['m1', 'm2', 'w'])
    elif f == 2:
        swing(c, 0.5, 8, ['c1', 'm2', 'm3', 'w'])
    elif f == 3:
        swing(c, 0.85, 11)
    elif f == 4:  # peak impact
        c.blade(P0, P1, -18, 15, SK)
        c.blade((10, 2), (60, 50), -18, 4, ['m2', 'w'])
        c.lens((12, 10), (58, 58), 3, ['c2', 'w'])
        c.spark(44, 46, 8, 'w', 'c3', diag=True)
        c.rays(44, 46, 10, 9, 16, 'c2', rot=0.2)
        ground_split(c, 2, 4)
        chips(c, 5, 4, 38)
    elif f == 5:
        c.blade(P0, P1, -18, 10, ['c0', 'c1', 'c2', 'm3'])
        c.lens((14, 14), (56, 56), 2, ['c1', 'c3'])
        ground_split(c, 2, 5)
        chips(c, 6, 5, 32)
        motes(c, 44, 46, 6, 6, 14, 5, ['c3', 'm3'])
    elif f == 6:
        c.blade(P0, P1, -18, 6, ['c0', 'c1', 'c2'])
        c.lens((16, 16), (54, 54), 1.2, ['c1'])
        ground_split(c, 1, 6)
        chips(c, 5, 6, 30)
    elif f == 7:
        c.blade(P0, P1, -18, 3, ['c0', 'c1'])
        ground_split(c, 1, 7)
        motes(c, 36, 40, 7, 6, 18, 7, ['c1', 'm2'])
    elif f == 8:
        c.blade(P0, P1, -18, 1.5, ['c0'], frac=0.7)
        c.crack(CX - 4, FEET + 1, CX + 22, FEET + 3, 7, 'd0', segs=4, jit=1.2)
        motes(c, 40, 44, 5, 6, 18, 8, ['c1', 'm1'], dy=4)
    else:
        c.crack(CX - 4, FEET + 1, CX + 22, FEET + 3, 7, 'c0', segs=4, jit=1.2)
        c.ddisc(CX + 8, FEET + 1, 14, 'd0', squash=0.25)


if __name__ == '__main__':
    run(globals())
