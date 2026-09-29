"""ranger_fire_hit: 화염 화살 착탄. Flash, a fireball bloom, flame tongues climbing the target, rising embers and smoke.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'ranger_fire_hit', 64, 8, 'target'
PAL = pal(FIRE, pick(SMOKE, 'q0', 'q1', 'q2'), pick(WOOD, 't1'), WHITE)
CX, CY, FEET = 32, 36, 56


def tongue(c, x, base, h, w, keys, lean=0):
    for i, k in enumerate(keys):
        s = 1 - i * 0.28
        hh, ww = h * s, w * s
        c.poly([(x - ww, base), (x - ww * 0.6, base - hh * 0.5), (x + lean, base - hh), (x + ww * 0.7, base - hh * 0.45), (x + ww, base)], k)


def embers(c, f, n=8, top=10):
    r = rng(5)
    for i in range(n):
        x = 14 + r.randint(0, 36) + (f % 2) * (1 if i % 2 else -1)
        y = FEET - 6 - ((r.randint(0, 30) + f * 6) % (FEET - top))
        c.px(x, y, 'e4' if i % 3 == 0 else 'e3')
        c.px(x, y + 1, 'e2')


def draw(c, f):
    if f == 0:
        c.spark(CX, CY, 10, 'w', 'e4', diag=True)
        c.disc(CX, CY, 5, 'e3')
        c.disc(CX, CY, 3, 'w')
        c.line([(CX + 4, CY), (CX + 14, CY)], 't1')
    elif f == 1:
        c.disc(CX, CY, 13, 'e1')
        c.disc(CX - 1, CY - 1, 10, 'e2')
        c.disc(CX - 2, CY - 2, 7, 'e3')
        c.disc(CX - 2, CY - 2, 4, 'e4')
        c.rays(CX, CY, 10, 14, 20, 'e3', rot=0.3)
    elif f == 2:
        c.disc(CX, CY, 17, 'e0')
        c.disc(CX, CY - 1, 15, 'e1')
        c.disc(CX - 1, CY - 2, 11, 'e2')
        c.disc(CX - 2, CY - 3, 7, 'e3')
        c.disc(CX - 3, CY - 4, 3, 'e4')
        c.ring(CX, CY, 21, 'e2', 1)
        embers(c, f, 6)
    elif f in (3, 4, 5):
        k = f - 3
        flick = [(20, 24, 7, -2), (32, 38 - k * 3, 10, 1 if k % 2 else -1), (44, 26 + k * 2, 7, 2), (26, 18, 5, 0), (39, 20, 5, 1)]
        for x, h, w, lean in flick:
            tongue(c, x + (k % 2) * (1 if x < 32 else -1), FEET, h, w, ['e1', 'e2', 'e3', 'e4'], lean)
        c.oval(CX, FEET, 22, 3, 'e0')
        c.line([(CX - 18, FEET - 1), (CX + 18, FEET - 1)], 'e1')
        if k == 0:
            c.dring(CX, CY, 24, 'e2')
        embers(c, f, 10)
    elif f == 6:
        for x, h in [(24, 14), (34, 20), (42, 12)]:
            tongue(c, x, FEET, h, 5, ['e1', 'e2', 'e3'])
        c.cloud(CX, 18, 9, ['q0', 'q1', 'q2'], seed=3, lobes=6)
        embers(c, f, 8)
    elif f == 7:
        tongue(c, 32, FEET, 8, 4, ['e1', 'e2'])
        c.cloud(CX + 2, 12, 8, ['q0', 'q1', 'q2'], seed=4, lobes=6, parity=1)
        c.ddisc(CX, FEET, 14, 'e0', squash=0.25)
        embers(c, f, 5, 4)


if __name__ == '__main__':
    run(globals())

