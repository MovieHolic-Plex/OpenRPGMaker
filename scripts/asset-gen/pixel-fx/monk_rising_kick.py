"""monk_rising_kick: 승룡각. Dust at the feet, a rising crescent kick sweeps bottom to top,
a flame pillar launches the target and embers rain off it.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'monk_rising_kick', 64, 9, 'target'
PAL = pal(MONK, pick(EARTH, 't1', 't2'), WHITE)
CX, FEET = 32, 56
ARC0, ARC1 = (44, 58), (26, 2)
EDGE = ['o0', 'o1', 'y2', 'w']


def dust(c, t, seed):
    for side in (-1, 1):
        for i in range(3):
            x = CX + side * (6 + i * 5 + t * 10)
            y = FEET - 1 - i
            c.disc(x, y, 3 - i * 0.6 - t, 't1')
            c.disc(x - side, y - 1, 2 - i * 0.5 - t, 't2')


def pillar(c, w, top, keys):
    for i, k in enumerate(keys):
        ww = w * (1 - i / (len(keys) + 0.5))
        c.poly([(CX - ww, FEET), (CX - ww * 0.7, top + i * 2), (CX, top - 4 + i * 3), (CX + ww * 0.7, top + i * 2), (CX + ww, FEET)], k)


def draw(c, f):
    if f == 0:
        dust(c, 0, 0)
        c.oval(CX, FEET, 10, 2, 'o1')
        c.oval(CX, FEET, 6, 1, 'y2')
        converge(c, CX, FEET - 6, 0.5, 8, 1, ['o2', 'y3'], r0=18, r1=4, squash=0.5)
    elif f == 1:
        dust(c, 0.3, 1)
        c.blade(ARC0, ARC1, -14, 7, EDGE, frac=0.4)
        c.spark(40, 40, 3, 'w', 'y2')
    elif f == 2:
        dust(c, 0.5, 2)
        c.blade(ARC0, ARC1, -14, 9, EDGE, frac=0.8)
        pow_burst(c, CX, 30, 9, ['o1', 'y2', 'w'], rot=0.3)
    elif f == 3:
        c.blade(ARC0, ARC1, -14, 10, EDGE)
        pillar(c, 9, 6, ['o0', 'o1', 'o2', 'y2'])
        pow_burst(c, CX, 20, 13, ['o1', 'o2', 'y2', 'w'], rot=0.1)
    elif f == 4:
        c.blade(ARC0, ARC1, -14, 4, ['o1', 'y2'])
        pillar(c, 11, 2, ['o0', 'o1', 'o2', 'y2', 'y3'])
        c.line([(CX, 4), (CX, FEET)], 'w', 3)
        c.spark(CX, 10, 10, 'w', 'y2', diag=True)
        burst(c, CX, 22, 0.3, 14, 4, ['w', 'y3', 'y2'], spd=(8, 22), up=0.6)
    elif f == 5:
        pillar(c, 8, 4, ['o0', 'o1', 'o2'])
        for i in range(4):   # spiral streaks climbing the pillar
            y = FEET - 8 - i * 12
            c.arc(CX, y, 11, 200, 340, 'y2', 2, squash=0.35)
        c.line([(CX, 8), (CX, FEET)], 'y3', 1)
        burst(c, CX, 22, 0.55, 14, 4, ['w', 'y3', 'y2', 'o2'], spd=(8, 22), up=0.6)
    elif f == 6:
        pillar(c, 5, 10, ['o0', 'o1'])
        c.oval(CX, FEET, 12, 2, 'o0')
        burst(c, CX, 22, 0.75, 14, 4, ['y3', 'y2', 'o2', 'o1'], spd=(8, 22), up=0.6)
        burst(c, CX, 40, 0.5, 8, 9, ['y2', 'o2'], spd=(4, 10), up=1.0)
    elif f == 7:
        for y in range(14, FEET, 3):
            c.px(CX + (y % 2), y, 'o1' if y % 2 else 'o0')
        c.dring(CX, FEET, 14, 'o0', squash=0.2)
        burst(c, CX, 22, 0.9, 14, 4, ['y2', 'o2', 'o1', 'o0'], spd=(8, 22), up=0.6)
    elif f == 8:
        burst(c, CX, 22, 1.0, 14, 5, ['o2', 'o1', 'o0'], spd=(10, 24), up=0.4, grav=0.4)
        c.spark(CX, 8, 2, 'y3', 'o2')


if __name__ == '__main__':
    run(globals())

