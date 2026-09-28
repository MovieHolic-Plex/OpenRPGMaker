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
    """One jaw: a curved beak-like shell from the hinge; the gum line bows inward and the tip hooks toward the
    other jaw. gap = half opening angle (radians). Teeth hang from the gum line toward the mouth centre."""
    s = -1 if upper else 1
    a = s * gap
    ux, uy = math.cos(a), math.sin(a)
    nx, ny = -uy * s, ux * s            # normal pointing away from the mouth (up for the upper jaw)
    tip = (HX + ux * reach, CY + uy * reach)
    hook = (tip[0] - ux * 3 - nx * 4, tip[1] - uy * 3 - ny * 4)
    gum = bez([(HX + 2, CY), (HX + ux * reach * 0.5 - nx * 1, CY + uy * reach * 0.5 - ny * 1), tip], 12)
    shell = bez([tip, (HX + ux * reach * 0.7 + nx * 12, CY + uy * reach * 0.7 + ny * 12),
                 (HX + ux * reach * 0.2 + nx * 14, CY + uy * reach * 0.2 + ny * 14), (HX - 4, CY + ny * 8)], 14)
    c.poly(gum + [hook] + shell + [(HX - 4, CY)], 'v0')
    inner = bez([(tip[0] - ux * 3, tip[1] - uy * 3), (HX + ux * reach * 0.65 + nx * 9, CY + uy * reach * 0.65 + ny * 9),
                 (HX + ux * reach * 0.2 + nx * 11, CY + uy * reach * 0.2 + ny * 11), (HX - 2, CY + ny * 6)], 12)
    c.poly([(x + nx * 1, y + ny * 1) for x, y in gum] + inner, 'v1')
    if upper:  # lit ridge (light from the upper left)
        c.line(inner[1:-2], 'v2')
    c.line(gum, 'c1', 2)
    c.poly([tip, hook, (tip[0] - ux * 6, tip[1] - uy * 6)], 'b2')
    if teeth:
        n = max(2, int(reach / 7))
        for i in range(1, n + 1):
            x, y = gum[min(len(gum) - 2, int(i / (n + 1) * len(gum)))]
            L = 4 + (i % 2) * 2
            c.poly([(x - 2 * ux, y - 2 * uy), (x + 2 * ux, y + 2 * uy), (x - nx * L, y - ny * L)], 'b2')
            c.line([(x - ux, y - uy), (x - nx * (L - 1), y - ny * (L - 1))], 'b3')
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
        jaw(c, 0.12, 56)
        jaw(c, 0.12, 56, False)
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
