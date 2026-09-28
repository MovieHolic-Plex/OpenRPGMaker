"""monk_fist_flurry: 백열권. Golden fists hammer the target from the right, pow stars pile up,
then one big fist ends in a flash, a shockwave ring and falling embers.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'monk_fist_flurry', 64, 10, 'target'
PAL = pal(MONK, WHITE)
CX, CY = 32, 34
FK = ('k', 'y1', 'y2', 'y3')
# (frame, knuckle x, y, scale) for the flurry; each fist leaves a pow star next frame
HITS = [(1, 22, 26, 1), (1, 30, 44, 1), (2, 18, 36, 1), (2, 28, 22, 1), (3, 24, 40, 1), (3, 16, 28, 1),
        (4, 26, 32, 1), (4, 20, 46, 1), (5, 22, 30, 1), (5, 30, 40, 1)]


def draw(c, f):
    if f == 0:
        converge(c, CX, CY, 0.55, 14, 3, ['o1', 'y2'], r0=30, r1=10, trail=5)
        c.spark(CX, CY, 3, 'w', 'y2')
        return
    if f <= 5:
        for (hf, x, y, s) in HITS:
            if hf == f - 1:      # last frame's fists turned into pow stars
                pow_burst(c, x - 1, y, 7, ['o1', 'y2', 'w'], rot=x * 0.2)
            elif hf == f - 2:    # older pow stars shrink to sparks
                c.spark(x - 2, y, 2, 'y3', 'o2')
        for (hf, x, y, s) in HITS:
            if hf == f:
                fist(c, x, y, s, FK, streak=14)
        burst(c, CX, CY, 0.15 + f * 0.12, 10, f, ['y3', 'y2', 'o2'], spd=(10, 20))
        return
    if f == 6:
        pow_burst(c, CX - 2, CY, 22, ['o0', 'o1', 'o2', 'y2', 'w'], rot=0.2, n=10)
        fist(c, CX + 2, CY, 2, FK, streak=10)
        c.rays(CX, CY, 12, 22, 30, 'y2', rot=0.13)
    elif f == 7:
        c.ring(CX, CY, 17, 'o1', 3)
        c.ring(CX, CY, 16, 'y2', 1)
        c.disc(CX, CY, 8, 'y2')
        c.disc(CX, CY, 5, 'w')
        c.rays(CX, CY, 10, 20, 29, 'y3', rot=0.4)
        burst(c, CX, CY, 0.35, 18, 70, ['w', 'y3', 'y2', 'o2'], spd=(12, 28), size=(1, 3))
    elif f == 8:
        c.ring(CX, CY, 24, 'o0', 2)
        c.dring(CX, CY, 22, 'o2')
        c.disc(CX, CY, 3, 'y2')
        burst(c, CX, CY, 0.6, 18, 70, ['w', 'y3', 'y2', 'o2', 'o1'], spd=(12, 28), size=(1, 3), grav=0.4)
    elif f == 9:
        c.dring(CX, CY, 28, 'o0', 1)
        burst(c, CX, CY, 0.85, 18, 70, ['y2', 'o2', 'o1', 'o0'], spd=(12, 28), size=(1, 3), grav=0.8)


if __name__ == '__main__':
    run(globals())

