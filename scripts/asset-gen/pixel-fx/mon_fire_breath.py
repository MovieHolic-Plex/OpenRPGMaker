"""mon_fire_breath: 화염 브레스 (화면). The dragon inhales (sparks gather at the mouth on the LEFT), a roaring cone of
fire pours LEFT -> RIGHT across the stage, peaks as a billowing wall over the allies' side, then thins from the tail
into embers and a brown smoke haze."""
import math

from lib_monster_36_52 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_fire_breath', 128, 10, 'screen'
PAL = pal(FIRE, pick(SOOT, 'k0', 'k1', 'k2'), pick(DUST, 'u2'), pick(SHOCK, 'h2'), WHITE)
PEAK = 5
MX, MY = 12, 58
FK = ['e0', 'e1', 'e2', 'e3', 'e4']


def draw(c, f):
    t = f * 1.3
    if f == 0:          # inhale: sparks drawn into the mouth
        converge(c, MX + 4, MY, 0.5, 10, 1, ['e1', 'e3'], r0=22, r1=4)
        c.disc(MX + 2, MY, 3, 'e2')
        c.px(MX + 2, MY, 'e4')
    elif f == 1:
        converge(c, MX + 4, MY, 0.9, 12, 2, ['e2', 'e4'], r0=24, r1=3)
        c.disc(MX + 3, MY, 5, 'e1')
        c.disc(MX + 3, MY, 3, 'e3')
        c.spark(MX + 3, MY, 5, 'w', 'e4', diag=True)
    elif f == 2:        # first jet
        cone(c, MX, MY, 44, t, FK, wob=0.6, spread=0.26, w0=3, lift=-0.08)
        c.spark(MX + 2, MY, 4, 'w', 'h2')
    elif f == 3:
        cone(c, MX, MY, 78, t, FK, wob=0.8, spread=0.3, w0=4, lift=-0.1)
        embers(c, 60, MY - 10, 6, 3, 8, 16, ['e3', 'e4'])
    elif f == 4:
        cone(c, MX, MY, 106, t, FK, wob=1.0, spread=0.33, w0=4, lift=-0.12)
        embers(c, 80, MY - 14, 8, 4, 10, 20, ['e3', 'e4'])
    elif f == 5:        # PEAK: full blast breaking over the allies
        yc = cone(c, MX, MY, 112, t, FK + ['w'], wob=1.0, spread=0.36, w0=5, lift=-0.12)
        for i in range(5):
            c.flame(96 + i * 6 - 12, 104, 16 + (i % 2) * 8, 5, FK[1:], lean=2)
        c.spark(112, yc - 6, 7, 'w', 'h2', diag=True)
        embers(c, 90, MY - 24, 10, 5, 12, 26, ['e3', 'e4', 'h2'])
    elif f == 6:
        cone(c, MX, MY, 114, t, FK, wob=1.2, spread=0.36, w0=4, lift=-0.12)
        for i in range(5):
            c.flame(86 + i * 7, 104, 20 + (i % 2) * 6, 5, FK[:4], lean=-1)
        embers(c, 88, MY - 26, 12, 6, 16, 28, ['e2', 'e3', 'e4'])
    elif f == 7:        # the jet stops: tail breaks away from the mouth
        cone(c, MX, MY, 116, t, FK[:4], wob=1.2, spread=0.36, w0=4, lift=-0.12, tail=52)
        for i in range(4):
            c.flame(88 + i * 8, 104, 12 + (i % 2) * 5, 4, FK[:3])
        embers(c, 70, MY - 20, 12, 7, 20, 40, ['e2', 'e3', 'e4'])
    elif f == 8:        # embers + smoke
        for x in (76, 98, 116):
            c.cloud(x, MY - 6 + (x % 3) * 4, 10, ['k0', 'k1', 'k2'], seed=x, lobes=7, parity=x % 2)
        for i in range(3):
            c.flame(92 + i * 9, 104, 7, 3, ['e1', 'e2', 'e3'])
        embers(c, 80, MY - 24, 14, 8, 26, 40, ['e2', 'e3', 'u2'])
    else:
        for x in (82, 104):
            c.ddisc(x, MY - 12, 12, 'k1', squash=0.7, parity=x % 2)
            c.ddisc(x - 3, MY - 18, 6, 'k2', squash=0.7)
        embers(c, 86, MY - 34, 10, 9, 20, 34, ['e1', 'e2', 'u2'])
    fade_oval(c, band=0.3)


if __name__ == '__main__':
    run(globals())

