"""mon_rot_cloud: 썩은 숨결 (착탄, 아군 전원). A sickly yellow-green rot cloud rolls in from the left,
swallows the ally's legs, swells into a skull-faced plume at its peak, bubbles and drips violet rot, then thins away.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_18_35 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_rot_cloud', 64, 10, 'allTargets'
PAL = pal(TOXIC, PLAGUE, pick(GRAVE, 'v0'))
PEAK = 4
G = ('g1', 'g2', 'g3', 'g4')


def bubble(c, x, y, r):
    c.ring(x, y, r, 'p2')
    c.px(x - r * 0.5, y - r * 0.5, 'p3')


def drip(c, x, y, L):
    c.line([(x, y), (x, y + L)], 'p1')
    c.disc(x, y + L + 1, 1, 'p2')


def draw(c, f):
    if f == 0:
        c.cloud(10, FEET - 6, 7, G[:3], seed=1, lobes=7)
        c.cloud(2, FEET - 10, 5, G[:2], seed=2, lobes=6)
    elif f == 1:
        c.cloud(18, FEET - 6, 9, G[:3], seed=3)
        c.cloud(6, FEET - 12, 7, G[:3], seed=4, lobes=7)
        bubble(c, 14, FEET - 18, 2)
    elif f == 2:
        c.cloud(CX - 6, FEET - 6, 12, G, seed=5)
        c.cloud(CX + 12, FEET - 4, 8, G[:3], seed=6, lobes=7)
        c.cloud(10, FEET - 16, 7, G[:3], seed=7, lobes=7)
        bubble(c, CX - 10, FEET - 22, 2)
        bubble(c, CX + 8, FEET - 14, 1.5)
    elif f == 3:
        c.cloud(CX, FEET - 3, 13, G, seed=8, lobes=11)
        c.cloud(CX - 14, FEET - 22, 8, G[:3], seed=9, lobes=7)
        c.cloud(CX + 14, FEET - 20, 8, G[:3], seed=10, lobes=7)
        for x, y, r in [(CX - 4, 26, 2), (CX + 10, 30, 2), (CX - 16, 34, 1.5)]:
            bubble(c, x, y, r)
    elif f == 4:  # peak: plume rises into a skull face over the head, rot aura ring
        c.dring(CX, FEET - 6, 26, 'p1', squash=0.45)
        # knee-high cloud bank and two flank plumes: the ally's torso and face stay visible between them
        c.cloud(CX, FEET - 2, 13, G, seed=11, lobes=11)
        c.ddisc(CX, 38, 12, 'g1', squash=0.9)
        c.cloud(CX - 18, 36, 8, G, seed=12, lobes=7)
        c.cloud(CX + 19, 34, 8, G, seed=13, lobes=7)
        c.cloud(CX, 18, 11, ('p1', 'p2', 'p3'), seed=14, lobes=9)
        c.disc(CX - 4, 17, 2.5, 'v0')
        c.disc(CX + 4, 17, 2.5, 'v0')
        c.px(CX - 5, 16, 'g3')
        c.px(CX + 3, 16, 'g3')
        c.poly([(CX - 1, 21), (CX + 1, 21), (CX, 23)], 'v0')
        c.line([(CX - 5, 25), (CX + 5, 25)], 'v0')
        for x in (CX - 3, CX, CX + 3):
            c.px(x, 26, 'v0')
        drip(c, CX - 7, 27, 4)
        drip(c, CX + 6, 28, 3)
    elif f == 5:
        c.cloud(CX, FEET - 2, 13, G, seed=15, lobes=11)
        c.ddisc(CX, 38, 11, 'g1', 1, squash=0.9)
        c.cloud(CX + 18, 38, 7, G[:3], seed=151, lobes=7)
        c.cloud(CX - 1, 16, 10, ('p1', 'p2', 'p3'), seed=16, lobes=9)
        c.disc(CX - 4, 16, 2, 'v0')
        c.disc(CX + 4, 16, 2, 'v0')
        c.line([(CX - 4, 23), (CX + 4, 23)], 'v0')
        for x, y, L in [(CX - 12, 30, 5), (CX + 10, 26, 6), (CX + 1, 26, 4)]:
            drip(c, x, y, L)
        bubble(c, CX + 18, 34, 2)
        bubble(c, CX - 18, 38, 2)
    elif f == 6:
        c.cloud(CX + 2, FEET - 2, 12, G[:3], seed=17, lobes=10)
        c.cloud(CX + 2, 14, 9, ('p0', 'p1', 'p2'), seed=18, lobes=8)
        c.disc(CX - 1, 14, 1.5, 'v0')
        c.disc(CX + 5, 14, 1.5, 'v0')
        for x, y, L in [(CX - 10, 36, 7), (CX + 12, 32, 8)]:
            drip(c, x, y, L)
        motes(c, CX, 34, 8, 14, 24, 6, ['g2', 'p2'], sq=0.7)
    elif f == 7:
        c.cloud(CX + 8, FEET - 2, 10, G[:3], seed=19, lobes=9, parity=1)
        c.cloud(CX + 6, 12, 7, ('p0', 'p1'), seed=20, lobes=7)
        bubble(c, CX - 6, 40, 2)
        motes(c, CX, 30, 10, 14, 26, 7, ['g2', 'g3', 'p2'], sq=0.7, dy=-4)
    elif f == 8:
        c.ddisc(CX + 8, FEET - 4, 13, 'g1', squash=0.45)
        c.cloud(CX + 12, FEET - 5, 7, ('g1', 'g2'), seed=21, lobes=7)
        c.ddisc(CX + 8, 11, 7, 'p1', squash=0.8)
        motes(c, CX + 4, 28, 10, 12, 26, 8, ['g2', 'p1'], sq=0.7, dy=-6)
    else:
        c.ddisc(CX + 12, FEET - 3, 10, 'g1', 1, squash=0.35)
        c.ddisc(CX + 10, 9, 5, 'p1', 1)
        motes(c, CX + 6, 26, 8, 12, 26, 9, ['g1', 'p1'], sq=0.7, dy=-8)


if __name__ == '__main__':
    run(globals())
