"""mon_arrow_hit: 뼈화살 난사 (착탄, 아군 전원). Bone arrows rain in from the upper left one after another,
stick around the ally with violet grave sparks, then splinter into bone chips and grave dust.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_18_35 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_arrow_hit', 64, 8, 'allTargets'
PAL = pal(BONE, GRAVE, WHITE)
PEAK = 3
ANG = 0.5  # flying down-right (from the monster on the left)
# (tip x, tip y) where each arrow lands, in landing order
HITS = [(24, 38), (38, 46), (30, 30), (44, 34), (20, 50)]


def incoming(c, i, back, L=16):
    x, y = HITS[i]
    ux, uy = math.cos(ANG), math.sin(ANG)
    tx, ty = x - ux * back, y - uy * back
    c.line([(tx - ux * L, ty - uy * L), (tx - ux * (L + 8), ty - uy * (L + 8))], 'v2')
    c.bone_arrow(tx, ty, ANG, L)


def stuck(c, i, depth=4, L=13):
    x, y = HITS[i]
    ux, uy = math.cos(ANG), math.sin(ANG)
    c.bone_arrow(x - ux * depth, y - uy * depth, ANG, L)


def impact(c, i, r, keys=('v2', 'v3', 'w')):
    x, y = HITS[i]
    c.spark(x, y, r, keys[2], keys[1], diag=r >= 4)
    c.ring(x, y, r + 1, keys[0])


def chips(c, i, dist, seed, drop):
    x, y = HITS[i]
    r = rng(seed)
    for j in range(5):
        a = r.uniform(-2.6, 0.4)
        d = dist * r.uniform(0.6, 1.1)
        px, py = x + math.cos(a) * d, y + math.sin(a) * d + drop * r.uniform(0.6, 1.2)
        c.line([(px, py), (px + 2 * math.cos(a + 1), py + 2 * math.sin(a + 1))], 'b2' if j % 2 else 'b3')
        c.px(px + 1, py + 1, 'b1')


def draw(c, f):
    if f == 0:
        incoming(c, 0, 22)
        incoming(c, 1, 34)
        incoming(c, 2, 44, 14)
    elif f == 1:
        stuck(c, 0)
        impact(c, 0, 4)
        incoming(c, 1, 14)
        incoming(c, 2, 26)
        incoming(c, 3, 40, 14)
    elif f == 2:
        stuck(c, 0)
        stuck(c, 1)
        impact(c, 1, 5)
        c.dring(HITS[0][0], HITS[0][1], 6, 'v2')
        incoming(c, 2, 10)
        incoming(c, 3, 22)
        incoming(c, 4, 36, 14)
    elif f == 3:  # peak: all five in, grave burst
        c.ring(CX, CY, 20, 'v1', 2, squash=0.8)
        c.dring(CX, CY, 24, 'v2', squash=0.8)
        for i in range(5):
            stuck(c, i)
        impact(c, 2, 6)
        impact(c, 3, 5)
        impact(c, 4, 4)
        chips(c, 0, 7, 30, 0)
        chips(c, 1, 7, 31, 0)
    elif f == 4:
        c.dring(CX, CY, 24, 'v1', squash=0.8)
        for i in range(5):
            stuck(c, i, depth=4, L=11)
        chips(c, 2, 9, 42, 2)
        chips(c, 3, 9, 43, 2)
        chips(c, 4, 9, 44, 2)
        motes(c, CX, CY, 8, 12, 22, 4, ['v2', 'v3'], sq=0.8, spark_every=4)
    elif f == 5:  # shafts crack apart
        for i in range(5):
            x, y = HITS[i]
            ux, uy = math.cos(ANG), math.sin(ANG)
            c.line([(x - ux * 6, y - uy * 6), (x - ux * 10, y - uy * 10)], 'b1', 2)
            c.line([(x - ux * 12, y - uy * 12 - 2), (x - ux * 15, y - uy * 15 - 3)], 'b2')
            chips(c, i, 11, 50 + i, 5)
        motes(c, CX, CY, 10, 14, 26, 5, ['v1', 'v2'], sq=0.8)
    elif f == 6:
        for i in range(5):
            chips(c, i, 13, 60 + i, 9)
        r = rng(6)
        for i in range(7):
            x, y = CX + r.uniform(-18, 18), FEET - r.uniform(0, 4)
            c.oval(x, y, 3, 1, 'v1')
            c.mote(x - 1, y - 1, 'b1')
    else:
        r = rng(7)
        for i in range(8):
            x, y = CX + r.uniform(-20, 20), FEET - r.uniform(0, 3)
            c.drect(x - 3, y - 1, x + 3, y + 1, 'v1', i % 2)
        motes(c, CX, CY + 6, 6, 10, 22, 7, ['b1', 'v2'], sq=0.6, dy=4)


if __name__ == '__main__':
    run(globals())
