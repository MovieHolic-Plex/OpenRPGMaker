"""mon_quake_crack: 대지 강타 (착탄, 아군 전원). A shock line races in from the left along the ground, the earth
splits under the ally into an orange-lit fissure, slabs and rocks heave up at the peak in brown dust, then settle.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_18_35 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_quake_crack', 64, 10, 'allTargets'
PAL = pal(EARTH, pick(FIRE, 'e2', 'e3', 'e4'), pick(STONE, 'o1', 'o2'))
PEAK = 4
GY = FEET + 1


def fissure(c, width, seed, glow=True):
    pts = c.crack(2, GY, 62, GY - 1, seed, 'd0', segs=9, jit=2.5, w=max(1, int(width)) + 2)
    if glow and width >= 1:
        c.line(pts, 'e2', max(1, int(width)))
        if width >= 2:
            c.line(pts, 'e4')
    for i in range(2, len(pts) - 1, 2):
        x, y = pts[i]
        c.crack(x, y, x + (4 if i % 4 else -4), y + 5, seed + i, 'd0', segs=2, jit=1)
    return pts


def slab(c, x, lift, w, tilt, seed):
    y = GY - lift
    pts = [(x - w, y + tilt), (x + w, y - tilt), (x + w - 1, y - tilt + 5), (x - w + 1, y + tilt + 5)]
    c.poly(pts, 'd1')
    c.poly([(x - w, y + tilt), (x + w, y - tilt), (x + w - 1, y - tilt + 2), (x - w + 1, y + tilt + 2)], 'd3')
    c.line([(x - w, y + tilt), (x + w, y - tilt)], 'd4')


def dust(c, n, seed, top, keys=('d2', 'd3', 'd1')):
    r = rng(seed)
    for i in range(n):
        x = r.uniform(4, 60)
        y = r.uniform(top, GY - 2)
        c.puff(x, y, r.uniform(2.5, 5), keys, seed=seed + i, lobes=3)


def rocks(c, n, seed, top, spread=26):
    r = rng(seed)
    for i in range(n):
        c.rock(CX + r.uniform(-spread, spread), r.uniform(top, GY - 8), r.uniform(1.5, 3.2), ['d1', 'd3', 'd4'], seed=i)


def draw(c, f):
    if f == 0:
        c.line([(0, GY), (16, GY)], 'd2', 2)
        c.puff(6, GY - 3, 3, ('d1', 'd2'), seed=1, lobes=3)
    elif f == 1:
        c.crack(0, GY, 34, GY - 1, 2, 'd0', segs=5, jit=1.5, w=2)
        c.puff(14, GY - 4, 4, ('d1', 'd2'), seed=2, lobes=4)
        c.puff(26, GY - 3, 3, ('d1', 'd2'), seed=3, lobes=3)
    elif f == 2:
        fissure(c, 1, 3)
        dust(c, 3, 3, GY - 10)
    elif f == 3:
        c.oval(CX, GY, 30, 6, 'd1')
        fissure(c, 2, 4)
        slab(c, CX - 14, 4, 6, 1, 4)
        slab(c, CX + 12, 5, 7, -1, 5)
        rocks(c, 4, 4, 34)
    elif f == 4:  # peak: slabs heave, fire-lit fissure, rocks thrown high
        c.oval(CX, GY, 31, 7, 'd0')
        c.oval(CX, GY, 26, 4, 'e2')
        c.oval(CX, GY, 18, 2, 'e4')
        slab(c, CX - 16, 10, 8, 3, 6)
        slab(c, CX + 14, 12, 8, -3, 7)
        slab(c, CX - 1, 6, 5, 0, 8)
        dust(c, 5, 6, GY - 16)
        rocks(c, 8, 6, 8)
        c.spark(CX + 2, GY - 6, 4, 'e4', 'e3')
    elif f == 5:
        c.oval(CX, GY, 30, 6, 'd0')
        c.oval(CX, GY, 22, 3, 'e2')
        slab(c, CX - 16, 8, 8, 2, 6)
        slab(c, CX + 14, 9, 8, -2, 7)
        dust(c, 7, 7, GY - 22)
        rocks(c, 7, 7, 4, 30)
    elif f == 6:
        fissure(c, 1.5, 8)
        slab(c, CX - 16, 4, 7, 1, 6)
        slab(c, CX + 14, 5, 7, -1, 7)
        dust(c, 8, 8, GY - 26, ('d1', 'd2', 'd3'))
        rocks(c, 5, 8, 20, 30)
    elif f == 7:
        fissure(c, 1, 9, glow=True)
        dust(c, 7, 9, GY - 22, ('d1', 'd2'))
        rocks(c, 4, 9, GY - 14, 28)
    elif f == 8:
        fissure(c, 0, 10, glow=False)
        c.ddisc(CX, GY - 6, 26, 'd1', squash=0.3)
        rocks(c, 4, 10, GY - 8, 28)
    else:
        c.crack(6, GY, 58, GY - 1, 10, 'd1', segs=8, jit=2)
        c.ddisc(CX, GY - 3, 24, 'd1', 1, squash=0.2)


if __name__ == '__main__':
    run(globals())
