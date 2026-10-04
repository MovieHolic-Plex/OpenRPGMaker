"""mon_acid_splash: 산성 침 (착탄). The glob bursts on the ally chest from the left, drips down the body, sizzles and leaves violet fumes over a puddle.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_0_17 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_acid_splash', 64, 8, 'target'
PAL = pal(ACID, TOXV, WHITE)
PX, PY = CX - 4, CY - 2


def splat(c, x, y, r, seed, keys, lobes=9):
    rr = rng(seed)
    rad = [rr.uniform(0.6, 1.12) for _ in range(lobes)]
    for i, k in enumerate(keys):
        s = r * (1 - i * 0.28)
        pts = []
        for j in range(lobes * 2):
            a = j * math.pi / lobes + 0.2
            q = rad[j // 2] if j % 2 == 0 else 0.55
            pts.append((x - i * 0.8 + math.cos(a) * s * q, y - i * 0.8 + math.sin(a) * s * q))
        c.poly(pts, k)


def puddle(c, rx, dither=False):
    if dither:
        c.ddisc(CX, FEET, rx, 'a1', squash=0.22)
        return
    c.oval(CX, FEET, rx, 3, 'a0')
    c.oval(CX - 1, FEET - 1, rx - 3, 2, 'a1')
    c.line([(CX - rx + 4, FEET - 1), (CX - rx + 8, FEET - 1)], 'a3')


def bubbles(c, seed, n, lift):
    r = rng(seed)
    for i in range(n):
        x = CX + r.uniform(-12, 12)
        y = CY + r.uniform(-4, 10) - lift * r.uniform(0.7, 1.3)
        rad = r.choice((1, 1.5, 2))
        c.ring(x, y, rad, 'u3' if i % 2 else 'a3')
        c.px(x - 1, y - 1, 'a4')


def draw(c, f):
    if f == 0:
        c.poly([(0, PY), (12, PY - 4), (12, PY + 4)], 'a1')
        c.oval(15, PY, 5, 4, 'a0')
        c.oval(15, PY, 4, 3, 'a2')
        c.disc(14, PY - 1, 1, 'a4')
        for x in (3, 7):
            c.px(x, PY + 3, 'u2')
    elif f == 1:
        c.oval(PX - 2, PY, 3, 7, 'a0')
        c.oval(PX - 2, PY, 2, 6, 'a2')
        c.line([(PX - 1, PY - 5), (PX - 1, PY + 4)], 'a4')
        for i in range(7):
            a = math.pi * (0.55 + i * 0.15)
            c.line([pol(PX - 2, PY, 5, a), pol(PX - 2, PY, 10, a)], 'a3')
        c.spark(PX, PY, 4, 'w', 'a4')
    elif f == 2:
        splat(c, PX, PY, 15, 2, ['a0', 'a2', 'a3', 'a4'])
        drops(c, PX, PY, 14, 16, 24, 21, 'a2', 'a4', size=1.8)
        drops(c, PX, PY, 6, 12, 20, 22, 'u2', 'u3', size=1.3)
        c.disc(PX - 2, PY - 2, 3, 'u3')
        c.spark(PX - 2, PY - 2, 6, 'w', 'a4', diag=True)
    elif f == 3:
        splat(c, PX, PY + 1, 11, 3, ['a0', 'a2', 'a3'])
        drops(c, PX, PY, 12, 20, 27, 21, 'a2', 'a4', size=1.4, fall=4)
        for x in (PX - 6, PX - 1, PX + 5):
            c.line([(x, PY + 6), (x, PY + 12)], 'a1', 2)
            c.disc(x, PY + 13, 1.2, 'a2')
        c.disc(PX + 2, PY - 3, 2, 'u2')
        c.px(PX + 1, PY - 4, 'u3')
    elif f == 4:
        splat(c, PX + 1, PY + 2, 7, 4, ['a1', 'a2'])
        for i, x in enumerate((PX - 7, PX - 2, PX + 4, PX + 8)):
            c.line([(x, PY + 3), (x, PY + 8 + 3 * (i % 2) + 4)], 'a1', 2)
            c.line([(x, PY + 3), (x, PY + 6 + 3 * (i % 2))], 'a3')
        bubbles(c, 44, 6, 4)
        puddle(c, 10)
    elif f == 5:
        for x, y, r in ((CX - 6, CY - 12, 5), (CX + 4, CY - 16, 4), (CX - 1, CY - 22, 3)):
            c.puff(x, y, r, ['u1', 'u2', 'u3'], seed=x)
        bubbles(c, 55, 7, 10)
        puddle(c, 14)
    elif f == 6:
        for x, y, r in ((CX - 8, CY - 20, 5), (CX + 5, CY - 25, 4), (CX - 2, CY - 31, 3)):
            c.ddisc(x, y, r, 'u2')
            c.ddisc(x - 1, y - 1, r - 2, 'u3', parity=1)
        bubbles(c, 66, 4, 18)
        puddle(c, 15)
    else:
        for x, y in ((CX - 6, CY - 30), (CX + 6, CY - 34), (CX, CY - 38)):
            c.px(x, y, 'u3')
            c.px(x + 1, y + 1, 'u2')
        c.ring(CX + 9, CY - 20, 1.5, 'a3')
        puddle(c, 15, dither=True)


if __name__ == '__main__':
    run(globals())

