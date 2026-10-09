"""mon_dark_flame: 암흑 화염 (화면). The demon lord gathers violet fire at the mouth (LEFT), exhales a black-violet
flame stream LEFT -> RIGHT with a crimson rim, it blooms into a wall of dark fire over the allies' side, then breaks
into drifting violet cinders and black haze."""
import math

from lib_monster_36_52 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_dark_flame', 128, 10, 'screen'
PAL = pal(DARK, CRIM, pick(SHADE, 'd0'), WHITE)
PEAK = 5
MX, MY = 14, 52
FK = ['v1', 'c1', 'v2', 'v3', 'v4']


def cinders(c, n, seed, t, x0=70, spread=50):
    r = rng(seed)
    for i in range(n):
        x = x0 + r.uniform(-spread, spread) + 14 * t
        y = MY + r.uniform(-20, 40) - 30 * t * r.uniform(0.5, 1.2)
        c.px(x, y, 'v4' if i % 3 else 'c3')
        c.px(x, y + 1, 'v2')


def draw(c, f):
    t = f * 1.25
    if f == 0:
        shade(c, 64, 64, 46, 'v1')
        converge(c, MX + 4, MY, 0.5, 10, 1, ['v2', 'v4'], r0=22, r1=4)
        c.disc(MX + 3, MY, 3, 'v3')
    elif f == 1:
        shade(c, 64, 64, 48, 'v1', dense='d0')
        converge(c, MX + 4, MY, 0.95, 12, 2, ['v3', 'v5'], r0=24, r1=3)
        c.disc(MX + 3, MY, 6, 'c1')
        c.disc(MX + 3, MY, 4, 'v3')
        c.spark(MX + 3, MY, 6, 'w', 'v5', diag=True)
    elif f == 2:
        shade(c, 64, 64, 48, 'v1', dense='d0')
        cone(c, MX, MY, 50, t, FK, wob=0.7, spread=0.28, w0=3, lift=-0.1)
    elif f == 3:
        shade(c, 64, 64, 48, 'v1', dense='d0')
        cone(c, MX, MY, 84, t, ['v0'] + FK, wob=0.9, spread=0.32, w0=4, lift=-0.12)
        cinders(c, 6, 3, 0.1, 60, 20)
    elif f == 4:
        shade(c, 64, 64, 50, 'v1', dense='d0')
        cone(c, MX, MY, 108, t, ['v0'] + FK, wob=1.0, spread=0.35, w0=4, lift=-0.13)
        cinders(c, 8, 4, 0.2)
    elif f == 5:        # PEAK: dark fire wall on the allies' side
        shade(c, 64, 64, 50, 'v1', dense='d0')
        yc = cone(c, MX, MY, 112, t, ['v0'] + FK + ['v5'], wob=1.0, spread=0.37, w0=5, lift=-0.13)
        for i in range(6):
            c.flame(78 + i * 7, 104, 22 + (i % 2) * 10, 5, ['v1', 'c1', 'c2', 'v3', 'v5'], lean=2)
        c.spark(110, yc - 4, 8, 'w', 'c3', diag=True)
        cinders(c, 10, 5, 0.3)
    elif f == 6:
        shade(c, 64, 64, 50, 'v1', dense='d0')
        cone(c, MX, MY, 114, t, ['v0'] + FK, wob=1.2, spread=0.37, w0=4, lift=-0.13)
        for i in range(6):
            c.flame(76 + i * 7, 104, 26 + (i % 2) * 6, 5, ['v1', 'c1', 'v2', 'v3', 'v4'], lean=-1)
        cinders(c, 12, 6, 0.5)
    elif f == 7:        # tail breaks away from the mouth
        shade(c, 64, 64, 46, 'v1')
        cone(c, MX, MY, 116, t, ['v0', 'v1', 'c1', 'v2', 'v3'], wob=1.2, spread=0.37, w0=4, lift=-0.13, tail=56)
        for i in range(5):
            c.flame(80 + i * 8, 104, 14 + (i % 2) * 6, 4, ['v1', 'c1', 'v3'])
        cinders(c, 14, 7, 0.7)
    elif f == 8:
        for x in (74, 96, 116):
            c.cloud(x, MY + (x % 3) * 4, 10, ['v0', 'v1', 'v2'], seed=x, lobes=7, parity=x % 2)
        for i in range(3):
            c.flame(88 + i * 10, 104, 8, 3, ['v1', 'c1', 'v3'])
        cinders(c, 14, 8, 0.9)
    else:
        for x in (80, 104):
            c.ddisc(x, MY - 4, 12, 'v1', squash=0.7, parity=x % 2)
            c.ddisc(x - 3, MY - 10, 6, 'v2', squash=0.7)
        cinders(c, 10, 9, 1.1, 90, 30)
    fade_oval(c, band=0.3)


if __name__ == '__main__':
    run(globals())

