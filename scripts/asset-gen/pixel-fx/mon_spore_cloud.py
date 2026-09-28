"""mon_spore_cloud: 수면 포자 (착탄, 아군 전원). Pink-violet spores drift in from the left, bloom into a sweet
spore cloud round the ally's head, peak in a soft glow with floating Z marks (sleep), then settle as dust.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_18_35 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_spore_cloud', 64, 10, 'allTargets'
PAL = pal(SPORE, pick(TOXIC, 'g2', 'g3'), pick(GRAVE, 'v1'), WHITE)
PEAK = 5
HEAD = (CX, 30)


def spore(c, x, y, r, k='s2', hi='s4'):
    c.disc(x, y, r, 's1')
    c.disc(x - 0.4, y - 0.4, max(0.6, r - 1), k)
    if r >= 2:
        c.px(x - r * 0.5, y - r * 0.5, hi)


def drift(c, n, seed, x0, x1, y0, y1, big=2):
    r = rng(seed)
    for i in range(n):
        x, y = r.uniform(x0, x1), r.uniform(y0, y1)
        spore(c, x, y, big if i % 3 == 0 else 1.5, 's2' if i % 2 else 's3')


def zz(c, x, y, s, k='s4'):
    c.zee(x, y, s, 'v1')
    c.zee(x - 1, y - 1, s, k)


def draw(c, f):
    if f == 0:
        drift(c, 5, 1, 0, 18, 22, 44)
    elif f == 1:
        drift(c, 8, 2, 4, 30, 18, 44)
        c.line([(6, 40), (2, 44)], 'g2')
    elif f == 2:
        c.cloud(HEAD[0] - 8, HEAD[1] + 4, 8, ('s1', 's2'), seed=3, lobes=7)
        drift(c, 8, 3, 8, 50, 14, 46)
    elif f == 3:
        c.cloud(HEAD[0] - 2, HEAD[1] + 2, 12, ('s1', 's2', 's3'), seed=4, lobes=9)
        drift(c, 10, 4, 6, 58, 10, 48)
    elif f == 4:
        c.dring(HEAD[0], HEAD[1] + 6, 22, 's1', squash=0.8)
        c.cloud(HEAD[0] - 14, HEAD[1] + 2, 8, ('s1', 's2', 's3'), seed=5, lobes=7)
        c.cloud(HEAD[0] + 14, HEAD[1] - 2, 7, ('s1', 's2', 's3'), seed=51, lobes=7)
        c.cloud(HEAD[0], 12, 7, ('s1', 's2', 's3', 's4'), seed=52, lobes=7)
        drift(c, 10, 5, 4, 60, 8, 50)
        zz(c, CX + 12, 12, 4)
    elif f == 5:  # peak: glowing bloom, big Z's
        # a ring of blooms around the body (not over it) with a bright crown above the head
        c.ring(HEAD[0], HEAD[1] + 6, 25, 's2', 1, squash=0.8)
        c.dring(HEAD[0], HEAD[1] + 6, 22, 's3', squash=0.8)
        c.cloud(HEAD[0] - 17, HEAD[1] + 6, 9, ('s1', 's2', 's3', 's4'), seed=6, lobes=8)
        c.cloud(HEAD[0] + 17, HEAD[1] + 2, 9, ('s1', 's2', 's3', 's4'), seed=61, lobes=8)
        c.cloud(HEAD[0], 11, 10, ('s1', 's2', 's3', 's4'), seed=62, lobes=9)
        c.spark(HEAD[0] - 4, 8, 4, 'w', 's4', diag=True)
        drift(c, 12, 6, 2, 62, 6, 52)
        zz(c, CX + 10, 10, 5)
        zz(c, CX + 18, 3, 3)
    elif f == 6:
        c.cloud(HEAD[0] - 16, HEAD[1] + 8, 8, ('s1', 's2', 's3'), seed=7, lobes=7)
        c.cloud(HEAD[0] + 18, HEAD[1] + 4, 8, ('s1', 's2', 's3'), seed=71, lobes=7)
        c.cloud(HEAD[0] + 2, 12, 8, ('s1', 's2', 's3'), seed=72, lobes=8)
        drift(c, 10, 7, 4, 62, 10, 54)
        zz(c, CX + 12, 8, 4)
        zz(c, CX + 20, 2, 3)
        zz(c, CX - 16, 12, 3)
    elif f == 7:
        c.cloud(HEAD[0] + 18, HEAD[1] + 8, 7, ('s1', 's2'), seed=8, lobes=7, parity=1)
        c.cloud(HEAD[0] + 4, 12, 6, ('s1', 's2'), seed=81, lobes=6)
        drift(c, 8, 8, 6, 60, 20, 56, 1.5)
        zz(c, CX + 14, 6, 3)
        zz(c, CX - 14, 10, 3, 's3')
    elif f == 8:
        c.dring(HEAD[0] + 4, HEAD[1] + 8, 16, 's1', squash=0.8)
        drift(c, 8, 9, 8, 58, 34, 56, 1.5)
        zz(c, CX + 16, 4, 3, 's3')
    else:
        c.ddisc(CX, FEET, 16, 's1', 1, squash=0.3)
        drift(c, 5, 10, 10, 54, 44, 56, 1.5)


if __name__ == '__main__':
    run(globals())
