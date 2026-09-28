"""mon_smoke_cloud: 연막탄 (착탄). The bomb pops at the ally's chest, a ring of olive smoke balloons around the
body (thin, dithered in the middle so the battler still shows), swirls, then frays into wisps."""
import math

from lib_monster_36_52 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_smoke_cloud', 64, 8, 'allTargets'
PAL = pal(SOOT, pick(IRON, 'i0', 'i2'), SHOCK, pick(FIRE, 'e3'), WHITE)
PEAK = 3
SK = ['k0', 'k1', 'k2', 'k3']


def ring_of_puffs(c, r, n, rot, lob, keys, sq=0.72, seed=0):
    for i in range(n):
        a = rot + i * 2 * math.pi / n
        x, y = pol(BX, BY - 2, r, a, sq)
        c.cloud(x, y, lob * (0.85 + 0.3 * ((i * 7 + seed) % 3) / 2), keys, seed=seed + i, lobes=6, parity=i % 2)


def draw(c, f):
    if f == 0:          # the bomb pops
        c.disc(BX - 2, BY - 2, 4, 'i0')
        c.px(BX - 3, BY - 4, 'i2')
        c.spark(BX + 2, BY - 6, 4, 'w', 'h2', diag=True)
        c.ring(BX - 2, BY - 2, 7, 'k2')
    elif f == 1:        # flash + first puffs
        pow_burst(c, BX, BY - 2, 10, ['k2', 'h1', 'h2', 'w'])
        ring_of_puffs(c, 9, 5, 0.3, 4.5, SK[:3], seed=10)
    elif f == 2:
        ring_of_puffs(c, 15, 6, 0.1, 6, SK, seed=20)
        c.dring(BX, BY - 2, 9, 'k2', squash=0.9)
        c.spark(BX - 1, BY - 3, 3, 'h2', 'e3')
    elif f == 3:        # PEAK: full swirling ring, dithered heart
        ring_of_puffs(c, 20, 7, 0.4, 7, SK + ['k4'], seed=30)
        c.dring(BX, BY - 2, 11, 'k2', squash=0.85)
        c.dring(BX, BY - 2, 7, 'k3', squash=0.85, parity=1)
        c.brush(BX, BY - 2, 10, 200, 320, 1.4, 0.4, 'k4', squash=0.7)
    elif f == 4:
        ring_of_puffs(c, 21, 7, 0.75, 6.5, SK, seed=40)
        c.dring(BX, BY - 2, 12, 'k1', squash=0.85, parity=1)
        c.brush(BX, BY - 2, 12, 20, 150, 1.4, 0.4, 'k3', squash=0.7)
    elif f == 5:        # fraying: puffs drift up and outward
        for i in range(6):
            a = 1.0 + i * 2 * math.pi / 6
            x, y = pol(BX, BY - 6, 21, a, 0.7)
            c.cloud(x, y - 3, 5, ['k0', 'k1', 'k2'], seed=50 + i, lobes=5, parity=i % 2)
        c.dring(BX, BY - 2, 12, 'k1', squash=0.8)
    elif f == 6:
        for i in range(6):
            a = 1.3 + i * 2 * math.pi / 6
            x, y = pol(BX, BY - 10, 23, a, 0.6)
            c.ddisc(x, y - 4, 4.5, 'k2', parity=i % 2)
            c.px(x - 1, y - 6, 'k3')
        for i in range(3):
            c.brush(BX, BY - 4, 14 + i * 4, 200 + i * 40, 250 + i * 40, 1, 0.3, 'k1', squash=0.6)
    else:
        for i in range(5):
            a = 1.6 + i * 2 * math.pi / 5
            x, y = pol(BX, BY - 14, 24, a, 0.55)
            c.brush(x, y, 3, 180, 330, 0.8, 0.3, 'k2')
            c.px(x, y - 2, 'k1')
    fade_edges(c, T=4, B=3, L=4, R=4)


if __name__ == '__main__':
    run(globals())

