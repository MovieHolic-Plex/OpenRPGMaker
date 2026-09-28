"""mon_dark_crater: 암흑 운석 (전원 착탄). The black meteor falls in from the upper LEFT, strikes beside the ally:
violet flash, a crimson-rimmed shock ring and black rubble thrown out, a dark fire column erupts, then a smoking
crater of violet embers is left on the floor."""
import math

from lib_monster_36_52 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_dark_crater', 64, 10, 'allTargets'
PAL = pal(DARK, CRIM, pick(ROCK, 'o0', 'o1', 'o2'), WHITE)
PEAK = 3
GX, GY = BX, FEET - 1
CH = ('v0', 'o1', 'o2')


def meteor(c, x, y, r):
    c.poly([(x - r, y - r * 0.6), (x - r * 3.2, y - r * 3.4), (x - r * 0.4, y - r * 1.1)], 'v2')
    c.poly([(x - r * 0.6, y - r * 0.8), (x - r * 2.3, y - r * 2.6), (x - r * 0.2, y - r * 0.9)], 'v4')
    c.disc(x, y, r, 'c1')
    c.disc(x, y, r - 1, 'v0')
    c.px(x + r * 0.4, y - r * 0.5, 'v5')


def rubble(c, t, n, seed):
    r = rng(seed)
    for i in range(n):
        a = r.uniform(-math.pi * 0.95, -math.pi * 0.05)
        v = r.uniform(10, 24)
        x = GX + math.cos(a) * v * ease(t)
        y = min(GY, GY - 3 + math.sin(a) * v * ease(t) + 28 * t * t)
        chunk(c, x, y, r.uniform(1.4, 2.8), r.uniform(0, 6), CH)


def draw(c, f):
    if f == 0:
        meteor(c, 18, 12, 4)
        c.dring(GX, GY, 10, 'v2', squash=0.3)
    elif f == 1:
        meteor(c, 28, 34, 5)
        c.ring(GX, GY, 12, 'c1', 1, squash=0.3)
        c.ddisc(GX, GY, 10, 'v1', squash=0.3)
    elif f == 2:        # strike flash
        pow_burst(c, GX, GY - 6, 16, ['v1', 'v3', 'v5', 'w'], rot=0.2)
        c.ring(GX, GY, 18, 'c2', 2, squash=0.3)
        rubble(c, 0.15, 10, 2)
    elif f == 3:        # PEAK: dark column erupts
        c.oval(GX, GY, 26, 7, 'c1', 1)
        c.oval(GX, GY, 24, 6, 'c3', 1)
        c.flame(GX, GY + 1, 44, 9, ['v0', 'v1', 'c1', 'v3', 'v5'], lean=0)
        c.flame(GX - 12, GY, 20, 5, ['v1', 'c1', 'v3'], lean=-3)
        c.flame(GX + 12, GY, 20, 5, ['v1', 'c1', 'v3'], lean=3)
        c.spark(GX, 18, 7, 'w', 'v5', diag=True)
        rubble(c, 0.4, 12, 2)
    elif f == 4:
        c.oval(GX, GY, 30, 8, 'c1', 1)
        c.dring(GX, GY, 26, 'v2', squash=0.28)
        c.flame(GX, GY + 1, 36, 8, ['v0', 'v1', 'v2', 'v3', 'v4'], lean=1)
        rubble(c, 0.7, 12, 2)
    elif f == 5:
        c.dring(GX, GY, 29, 'c1', squash=0.26)
        c.flame(GX, GY + 1, 24, 6, ['v1', 'c1', 'v3'], lean=-1)
        c.cloud(GX - 8, GY - 30, 8, ['v0', 'v1', 'v2'], seed=5, lobes=6)
        rubble(c, 1.0, 12, 2)
    elif f == 6:        # crater with smoke
        c.oval(GX, GY, 16, 4, 'v0')
        c.oval(GX, GY - 1, 13, 3, 'v1')
        c.line([(GX - 13, GY - 3), (GX + 13, GY - 3)], 'c1')
        c.flame(GX - 4, GY - 1, 10, 3, ['v1', 'c2', 'v4'])
        c.flame(GX + 6, GY - 1, 7, 2.4, ['v1', 'c2', 'v4'])
        c.cloud(GX, GY - 32, 10, ['v0', 'v1', 'v2'], seed=6, lobes=7)
        rubble(c, 1.0, 12, 2)
    elif f == 7:
        c.oval(GX, GY, 16, 4, 'v0')
        c.oval(GX, GY - 1, 13, 3, 'v1')
        c.line([(GX - 12, GY - 3), (GX + 12, GY - 3)], 'c1')
        c.flame(GX + 2, GY - 1, 6, 2.2, ['v1', 'c2', 'v3'])
        c.ddisc(GX + 2, GY - 36, 10, 'v1', squash=0.7)
        embers(c, GX, GY - 14, 8, 7, 10, 12, ['v2', 'v4'])
    elif f == 8:
        c.oval(GX, GY, 15, 3.5, 'v0')
        c.line([(GX - 11, GY - 2), (GX + 11, GY - 2)], 'v2')
        c.ddisc(GX + 4, GY - 40, 9, 'v1', squash=0.6, parity=1)
        embers(c, GX, GY - 20, 8, 8, 12, 14, ['v1', 'v3'])
    else:
        c.ddisc(GX, GY, 14, 'v0', squash=0.28)
        for i in range(5):
            c.px(GX - 10 + i * 5, GY - 1, 'c1')
            c.px(GX - 10 + i * 5, GY - 2, 'v3')
        embers(c, GX, GY - 26, 6, 9, 12, 14, ['v1', 'v2'])
    fade_edges(c, T=4, L=3, R=3, B=2)


if __name__ == '__main__':
    run(globals())

