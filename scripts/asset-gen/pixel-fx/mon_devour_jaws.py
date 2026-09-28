"""mon_devour_jaws: 통째로 삼키기 (착탄). A huge shadow maw opens around the ally from the left, rows of teeth,
wet crimson gullet, snaps shut at the peak with a white bite flash, then chews and pulls back leaving drool and dark mist.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_18_35 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_devour_jaws', 64, 10, 'target'
PAL = pal(CRIMSON, pick(GRAVE, 'v0', 'v1', 'v2'), pick(BONE, 'b1', 'b2', 'b3'), WHITE)
PEAK = 5
HX = 4  # hinge on the left (monster side)


def jaw(c, gap, reach, upper=True, teeth=True):
    """One jaw as a thick wedge from the hinge; gap = half opening angle in radians."""
    s = -1 if upper else 1
    a = s * gap
    tip = (HX + math.cos(a) * reach, CY + math.sin(a) * reach)
    back = (HX, CY + s * 12)
    mid_out = (HX + math.cos(a) * reach * 0.55 + (-math.sin(a)) * s * -8, CY + math.sin(a) * reach * 0.55 + s * 8)
    c.poly([back, mid_out, (tip[0] + 2, tip[1] + s * 3), tip, (HX + 2, CY)], 'v0')
    c.poly([(back[0] + 1, back[1] - s * 2), (mid_out[0], mid_out[1] - s * 2), (tip[0], tip[1]), (HX + 3, CY)], 'v1')
    c.line([(HX + 3, CY), tip], 'c1', 2)
    if teeth:
        n = max(2, int(reach / 7))
        for i in range(1, n + 1):
            t = i / (n + 0.5)
            x, y = lerp(HX + 3, tip[0], t), lerp(CY, tip[1], t)
            L = 4 + (i % 2) * 2
            c.poly([(x - 2, y), (x + 2, y), (x + 0.5, y - s * -L)], 'b2')
            c.line([(x - 1, y), (x, y - s * -(L - 1))], 'b3')
    return tip


def gullet(c, r):
    c.oval(HX + 6, CY, r, r * 0.8, 'c0')
    c.oval(HX + 5, CY, r * 0.6, r * 0.45, 'c1')


def draw(c, f):
    if f == 0:
        c.ddisc(HX + 6, CY, 12, 'v1')
        c.disc(HX + 6, CY - 10, 2, 'c2')
    elif f == 1:
        gullet(c, 8)
        jaw(c, 0.35, 26)
        jaw(c, 0.35, 26, False)
    elif f == 2:
        gullet(c, 12)
        jaw(c, 0.7, 40)
        jaw(c, 0.6, 38, False)
    elif f == 3:  # wide open around the ally
        c.dring(HX + 20, CY, 30, 'v1', squash=0.9)
        gullet(c, 14)
        jaw(c, 0.95, 52)
        jaw(c, 0.8, 50, False)
        c.line([(HX + 14, CY - 6), (HX + 14, CY + 10)], 'c2')
    elif f == 4:  # closing fast
        gullet(c, 10)
        jaw(c, 0.45, 56)
        jaw(c, 0.4, 54, False)
        c.brush(HX, CY, 50, -40, -10, 0.5, 1.5, 'v2')
        c.brush(HX, CY, 50, 40, 10, 0.5, 1.5, 'v2')
    elif f == 5:  # peak: SNAP
        c.rays(CX + 6, CY, 12, 10, 26, 'c2', rot=0.1, jitter=[1, 0.6])
        jaw(c, 0.08, 58)
        jaw(c, 0.08, 58, False)
        c.lens((HX + 20, CY), (62, CY), 3, ['c3', 'w'])
        c.spark(CX + 12, CY, 9, 'w', 'c3', diag=True)
        motes(c, CX + 8, CY, 8, 10, 20, 5, ['c2', 'b3'])
    elif f == 6:  # chew
        jaw(c, 0.18, 52)
        jaw(c, 0.14, 52, False)
        for x in (24, 36, 46):
            c.line([(x, CY + 4), (x, CY + 10)], 'c2')
            c.disc(x, CY + 11, 1, 'c3')
        c.spark(CX + 10, CY - 6, 3, 'w', 'c3')
    elif f == 7:  # pull back
        jaw(c, 0.25, 36)
        jaw(c, 0.2, 34, False)
        for x, L in ((22, 8), (32, 12), (42, 6)):
            c.line([(x, CY + 4), (x, CY + 4 + L)], 'c1')
            c.disc(x, CY + 5 + L, 1, 'c2')
        c.ddisc(CX + 6, CY, 14, 'v1')
    elif f == 8:
        jaw(c, 0.2, 18, teeth=False)
        jaw(c, 0.2, 16, False, teeth=False)
        c.ddisc(CX + 4, CY + 2, 16, 'v1')
        for x in (30, 40):
            c.disc(x, FEET - 2, 1.5, 'c1')
    else:
        c.ddisc(CX, CY + 4, 14, 'v0', 1)
        c.ddisc(CX + 4, FEET, 10, 'c0', squash=0.3)


if __name__ == '__main__':
    run(globals())
