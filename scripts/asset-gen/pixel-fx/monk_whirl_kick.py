"""monk_whirl_kick: 선풍각. A flat orange whirlwind of kick arcs spins up around the target,
three heel impacts flash on its rim, and it throws off dust and embers as it unwinds.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'monk_whirl_kick', 64, 10, 'allTargets'
PAL = pal(MONK, pick(EARTH, 't0', 't1', 't2'), WHITE)
CX, CY, FEET = 32, 36, 56


def ring_arc(c, cy, r, a0, span, keys, squash=0.36):
    for i, k in enumerate(keys):
        w = len(keys) - i
        c.arc(CX, cy, r - i * 0.6, a0 + i * span * 0.1, a0 + span, k, w + 1, squash=squash)


def draw(c, f):
    rot = f * 58
    if f == 0:
        c.oval(CX, FEET, 14, 3, 't1')
        ring_arc(c, FEET - 4, 16, rot, 120, ['o0', 'o1'])
        c.spark(CX - 14, FEET - 6, 2, 'y2', 'o2')
        return
    if f <= 6:
        k = min(1.0, f / 3)
        # three stacked tiers of whirl, widest in the middle
        for j, (cy, r) in enumerate(((FEET - 6, 18), (CY, 24), (CY - 14, 18))):
            if j > f - 1:
                continue
            ring_arc(c, cy, r * k + 4, rot + j * 70, 200, ['o0', 'o1', 'o2', 'y2'])
            ring_arc(c, cy, r * k, rot + j * 70 + 180, 140, ['o1', 'y2', 'w'])
        c.oval(CX, FEET, 18, 3, 't0')
        c.oval(CX, FEET, 16, 2, 't1')
        # heel impacts on the rim on frames 2, 4, 6
        if f in (2, 4, 6):
            a = math.radians(rot + 200)
            x, y = pol(CX, CY - 4 + (f - 4) * 6, 22, a, 0.4)
            pow_burst(c, x, y, 10 + f, ['o1', 'y2', 'w'], rot=f * 0.3)
        else:
            a = math.radians(rot)
            x, y = pol(CX, CY, 24, a, 0.36)
            c.spark(x, y, 4, 'w', 'y3')
        burst(c, CX, FEET - 2, 0.2 * f / 2, 10, f, ['t2', 't1'], spd=(14, 22), squash=0.25)
        return
    if f == 7:
        ring_arc(c, CY, 28, rot, 90, ['o0', 'o1', 'y2'])
        ring_arc(c, CY - 10, 22, rot + 160, 90, ['o1', 'y2'])
        c.dring(CX, FEET - 1, 22, 't1', squash=0.2)
        burst(c, CX, CY, 0.5, 16, 7, ['w', 'y3', 'y2', 'o2'], spd=(16, 30), squash=0.6)
    elif f == 8:
        ring_arc(c, CY, 30, rot, 40, ['o0', 'o1'])
        c.dring(CX, FEET - 1, 26, 't0', squash=0.2)
        burst(c, CX, CY, 0.75, 16, 7, ['y3', 'y2', 'o2', 'o1'], spd=(16, 30), squash=0.6, grav=0.4)
        burst(c, CX, FEET - 2, 0.7, 10, 8, ['t2', 't1', 't0'], spd=(14, 24), squash=0.25, up=0.4)
    elif f == 9:
        burst(c, CX, CY, 0.95, 16, 7, ['y2', 'o2', 'o1', 'o0'], spd=(16, 30), squash=0.6, grav=0.8)
        burst(c, CX, FEET - 2, 0.95, 10, 8, ['t2', 't1', 't0'], spd=(14, 24), squash=0.25, up=0.4)


if __name__ == '__main__':
    run(globals())

