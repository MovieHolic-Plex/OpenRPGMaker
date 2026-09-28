"""mon_tusk_hit: 돌진 (착탄). Twin ivory tusks gore in from the left, a heavy impact burst and flying dirt, the ally skids back in a dust cloud.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_0_17 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_tusk_hit', 64, 8, 'target'
PAL = pal(BONE, DIRT, pick(IMPACT, 'y2', 'y3'), pick(GORE, 'r2'), WHITE)
TY = CY - 1


def tusks(c, tip):
    """Two curved tusks pointing right with their points at x=tip."""
    for dy, s in ((-5, -1), (5, 1)):
        base = tip - 16
        pts_o = [(base, TY + dy + s * 3), (tip - 6, TY + dy + s * 1), (tip, TY + dy - s * 3), (tip - 7, TY + dy - s * 1), (base, TY + dy - s * 1)]
        c.poly(pts_o, 'b1')
        c.line([(base + 1, TY + dy - s * 1), (tip - 7, TY + dy - s * 1), (tip - 1, TY + dy - s * 3)], 'b3')
        c.line([(base + 1, TY + dy + s * 2), (tip - 6, TY + dy)], 'b2')


def dirt(c, seed, n, dist, fall):
    r = rng(seed)
    for i in range(n):
        a = r.uniform(-2.6, 0.9)
        x, y = pol(CX + 2, TY, dist * r.uniform(0.7, 1.1), a)
        y += fall * r.uniform(0.5, 1.3)
        c.rect(x, y, x + 1, y + 1, 'd1')
        c.px(x, y, 'd3')


def draw(c, f):
    if f == 0:
        tusks(c, 16)
        for y in (TY - 11, TY + 11):
            c.line([(0, y), (8, y)], 'd3')
    elif f == 1:
        tusks(c, CX - 2)
        speed_lines(c, 0, 10, (TY - 12, TY, TY + 12), 'd4', 1)
        c.spark(CX - 1, TY - 4, 3, 'w', 'y3')
        c.spark(CX - 1, TY + 6, 3, 'w', 'y3')
    elif f == 2:
        tusks(c, CX + 5)
        star(c, CX + 4, TY, 17, 6, 9, 0.2, 'y2')
        star(c, CX + 4, TY, 10, 4, 9, 0.5, 'y3')
        c.disc(CX + 4, TY, 3, 'w')
        tusks(c, CX + 5)
    elif f == 3:
        c.ring(CX + 4, TY, 13, 'y2', 2)
        c.rays(CX + 4, TY, 9, 15, 22, 'w', rot=0.1)
        dirt(c, 3, 10, 18, 0)
        c.disc(CX + 6, TY - 3, 2, 'r2')
        c.puff(CX - 2, FEET - 3, 5, ['d1', 'd2', 'd3'], seed=3)
    elif f == 4:
        c.dring(CX + 4, TY, 18, 'y2')
        dirt(c, 3, 10, 22, 5)
        c.puff(CX + 8, FEET - 4, 7, ['d1', 'd2', 'd3', 'd4'], seed=4)
        c.puff(CX - 8, FEET - 3, 5, ['d1', 'd2', 'd3'], seed=5)
        for y in (FEET - 1, FEET + 1):
            c.line([(CX - 14, y), (CX + 2, y)], 'd2')
    elif f == 5:
        dirt(c, 3, 7, 24, 11)
        c.puff(CX + 12, FEET - 6, 8, ['d1', 'd2', 'd3', 'd4'], seed=6)
        c.puff(CX - 4, FEET - 5, 6, ['d1', 'd2', 'd3'], seed=7)
        c.line([(CX - 16, FEET + 1), (CX + 6, FEET + 1)], 'd1')
    elif f == 6:
        c.ddisc(CX + 14, FEET - 8, 9, 'd2', squash=0.7)
        c.ddisc(CX + 13, FEET - 10, 5, 'd3', parity=1, squash=0.7)
        c.ddisc(CX - 4, FEET - 6, 6, 'd2', squash=0.7)
    else:
        specks(c, CX + 8, FEET - 10, 10, 6, 20, 8, ['d2', 'd3'], sq=0.5)


if __name__ == '__main__':
    run(globals())

