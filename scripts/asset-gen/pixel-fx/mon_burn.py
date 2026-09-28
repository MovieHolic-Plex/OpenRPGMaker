"""mon_burn: 화염 브레스 (전원 착탄). Flames catch on the ally from the LEFT side: sparks, orange tongues climb the
flanks (the face stays readable), a peak flare with a white core at the chest, then the fire gutters into embers and smoke."""
import math

from lib_monster_36_52 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_burn', 64, 8, 'allTargets'
PAL = pal(FIRE, pick(SOOT, 'k1', 'k2', 'k3'), pick(SHOCK, 'h2'), WHITE)
PEAK = 3
FK = ['e0', 'e1', 'e2', 'e3', 'e4']


def ring_flames(c, h, n, seed, keys, w=4.2, lean=1.0):
    r = rng(seed)
    for i in range(n):
        x = BX - 14 + i * 28 / max(1, n - 1) + r.uniform(-1.5, 1.5)
        side = abs(x - BX) / 14                       # taller on the flanks, low in the middle
        hh = h * (0.4 + 0.55 * side) * r.uniform(0.8, 1.1)
        c.flame(x, FEET + 1 - (1 - side) * 1.5, hh, w * r.uniform(0.8, 1.2), keys, lean=lean * r.uniform(0.3, 1.2))


def draw(c, f):
    if f == 0:          # catching sparks from the left
        for i in range(5):
            c.px(8 + i * 4, BY - 8 + (i % 2) * 6, 'e3')
            c.px(7 + i * 4, BY - 8 + (i % 2) * 6, 'e1')
        c.flame(22, FEET, 8, 3, FK[1:4], lean=2)
        c.spark(24, BY, 3, 'e4', 'e2')
    elif f == 1:
        c.flame(20, FEET, 18, 4, FK[:4], lean=2)
        c.flame(28, FEET, 10, 3, FK[1:4], lean=1)
        c.flame(44, FEET, 8, 3, FK[1:4], lean=1)
        embers(c, 26, BY - 10, 5, 1, 4, 8, ['e3', 'e4'])
    elif f == 2:
        ring_flames(c, 24, 7, 2, FK[:4])
        c.ring(BX, FEET, 18, 'e1', 1, squash=0.3)
        embers(c, BX, BY - 14, 6, 2, 6, 14, ['e3', 'e4'])
    elif f == 3:        # PEAK flare
        ring_flames(c, 34, 8, 3, FK + ['w'], w=4.2, lean=1.5)
        c.disc(BX, BY - 4, 5, 'e3')
        c.disc(BX, BY - 4, 3, 'e4')
        c.spark(BX, BY - 4, 7, 'w', 'h2', diag=True)
        embers(c, BX, BY - 20, 9, 3, 6, 18, ['e3', 'e4', 'h2'])
    elif f == 4:
        ring_flames(c, 30, 8, 4, FK[:4], w=3.8, lean=-0.6)
        embers(c, BX, BY - 22, 10, 4, 10, 18, ['e2', 'e3', 'e4'])
    elif f == 5:
        ring_flames(c, 20, 6, 5, FK[:4], w=3.2)
        c.cloud(BX + 6, 14, 6, ['k1', 'k2'], seed=5, lobes=5)
        embers(c, BX, BY - 24, 10, 5, 14, 20, ['e2', 'e3'])
    elif f == 6:        # guttering
        ring_flames(c, 11, 5, 6, FK[:3], w=2.6)
        c.cloud(BX - 4, 12, 7, ['k1', 'k2', 'k3'], seed=6, lobes=6)
        embers(c, BX, BY - 26, 8, 6, 16, 20, ['e1', 'e2', 'e3'])
    else:
        for i in range(4):
            c.px(BX - 12 + i * 8, FEET, 'e2')
            c.px(BX - 12 + i * 8, FEET - 1, 'e1')
        c.ddisc(BX + 2, 10, 8, 'k1', squash=0.6)
        c.ddisc(BX - 1, 7, 4, 'k2', squash=0.7, parity=1)
        embers(c, BX, BY - 28, 7, 7, 18, 18, ['e1', 'e2'])
    fade_edges(c, T=4, L=3, R=3, B=2)


if __name__ == '__main__':
    run(globals())

