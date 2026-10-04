"""mon_dark_burn: 암흑 화염·암흑의 심판 (전원 착탄). Black-violet flames with crimson hearts lick up the ally's flanks,
a dark flare cracks at the chest with a crimson ring, then violet cinders rise and a black haze thins out."""
import math

from lib_monster_36_52 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_dark_burn', 64, 8, 'allTargets'
PAL = pal(DARK, CRIM, pick(SHADE, 'd1'), WHITE)
PEAK = 3
FK = ['v1', 'c1', 'v2', 'v3', 'v4']


def flank_flames(c, h, n, seed, keys, w=4.2, lean=1.0):
    r = rng(seed)
    for i in range(n):
        x = BX - 15 + i * 30 / max(1, n - 1) + r.uniform(-1.5, 1.5)
        side = abs(x - BX) / 15
        c.flame(x, FEET + 1, h * (0.38 + 0.55 * side) * r.uniform(0.8, 1.1), w * r.uniform(0.9, 1.25), keys, lean=lean * r.uniform(-0.5, 1.2))


def draw(c, f):
    if f == 0:
        c.ring(BX, FEET, 12, 'v2', 1, squash=0.3)
        for i in range(4):
            c.flame(BX - 12 + i * 8, FEET, 6 + (i % 2) * 3, 2.4, ['v1', 'v2', 'v3'])
    elif f == 1:
        c.ring(BX, FEET, 17, 'c1', 1, squash=0.3)
        flank_flames(c, 18, 6, 1, FK[:4])
    elif f == 2:
        flank_flames(c, 26, 7, 2, FK)
        c.dring(BX, BY - 4, 11, 'v2')
        embers(c, BX, BY - 16, 6, 2, 6, 14, ['v2', 'v4'])
    elif f == 3:        # PEAK: dark flare with crimson ring
        flank_flames(c, 34, 8, 3, FK + ['v5'], w=4, lean=1.4)
        c.ring(BX, BY - 4, 12, 'c2', 1)
        c.ring(BX, BY - 4, 10, 'c3', 1)
        c.disc(BX, BY - 4, 4, 'v0')
        c.ring(BX, BY - 4, 4, 'v4', 1)
        c.rays(BX, BY - 4, 8, 14, 20, 'c2', rot=0.39)
        c.spark(BX, BY - 4, 3, 'w', 'v5')
        embers(c, BX, BY - 20, 8, 3, 6, 18, ['v2', 'v4', 'c3'])
    elif f == 4:
        flank_flames(c, 30, 8, 4, FK, w=3.6, lean=-0.6)
        c.dring(BX, BY - 4, 15, 'c1')
        embers(c, BX, BY - 22, 10, 4, 10, 18, ['v2', 'v3', 'v5'])
    elif f == 5:
        flank_flames(c, 20, 6, 5, FK[:4], w=3)
        c.cloud(BX + 5, 14, 6, ['v0', 'v1', 'v2'], seed=5, lobes=5)
        embers(c, BX, BY - 24, 10, 5, 14, 20, ['v2', 'v4', 'c3'])
    elif f == 6:
        flank_flames(c, 10, 5, 6, ['v1', 'c1', 'v3'], w=2.4)
        c.cloud(BX - 4, 11, 7, ['v0', 'v1', 'v2'], seed=6, lobes=6)
        embers(c, BX, BY - 26, 8, 6, 16, 20, ['v1', 'v3'])
    else:
        for i in range(4):
            c.px(BX - 12 + i * 8, FEET, 'v3')
            c.px(BX - 12 + i * 8, FEET - 1, 'c1')
        c.ddisc(BX + 2, 9, 8, 'v1', squash=0.6)
        c.ddisc(BX - 1, 6, 4, 'd1', squash=0.7, parity=1)
        embers(c, BX, BY - 28, 7, 7, 18, 18, ['v1', 'v3'])
    fade_edges(c, T=4, L=3, R=3, B=2)


if __name__ == '__main__':
    run(globals())

