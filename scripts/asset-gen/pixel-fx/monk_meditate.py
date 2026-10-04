"""monk_meditate: 명상. A lotus of warm light opens under the feet, breath rings rise up the body,
a golden halo rests at the head, and healing motes lift away.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'monk_meditate', 64, 10, 'user'
PAL = pal(MONK, pick(CHI, 'c2', 'c3'), WHITE)
CX, CY, FEET = 32, 34, 56
HEAD = 16


def lotus(c, open_, keys):
    """Petals fanned above the feet; open_ 0..1 spreads them."""
    n = 7
    for i, k in enumerate(keys):
        for j in range(n):
            a = math.pi + (j + 0.5) * math.pi / n
            spread = lerp(0.35, 1.0, open_)
            a = -math.pi / 2 + (a + math.pi / 2) * spread
            L = (12 - i * 3) * (0.6 + 0.4 * open_)
            w = 3.2 - i * 0.9
            tip = pol(CX, FEET, L, a, 0.55)
            mid = pol(CX, FEET, L * 0.5, a, 0.55)
            ux, uy = math.cos(a + math.pi / 2), math.sin(a + math.pi / 2) * 0.55
            c.poly([(CX, FEET), (mid[0] + ux * w, mid[1] + uy * w), tip, (mid[0] - ux * w, mid[1] - uy * w)], k)
    c.oval(CX, FEET + 1, 14 * (0.6 + 0.4 * open_), 2, keys[0])


def breath(c, y, r, k, w=1):
    c.ring(CX, y, r, k, w, squash=0.32)


def halo(c, r, keys):
    c.ring(CX, HEAD - 4, r, keys[0], 2, squash=0.35)
    c.ring(CX, HEAD - 4, r - 1, keys[1], 1, squash=0.35)


def motes(c, t, n, seed, keys):
    r = rng(seed)
    for i in range(n):
        x = CX + r.uniform(-18, 18)
        y0 = r.uniform(34, FEET)
        y = y0 - t * r.uniform(24, 40)
        if y < 2:
            continue
        k = keys[i % len(keys)]
        if i % 3 == 0:
            c.spark(x, y, 2, 'w', k)
        else:
            c.px(x, y, k)
            c.px(x, y + 1, keys[0])


def draw(c, f):
    if f == 0:
        lotus(c, 0.1, ['o1', 'y2'])
    elif f == 1:
        lotus(c, 0.45, ['o1', 'y1', 'y3'])
        breath(c, FEET - 4, 12, 'y2')
    elif f == 2:
        lotus(c, 0.8, ['o1', 'y1', 'y3'])
        breath(c, FEET - 12, 14, 'y2', 2)
        breath(c, FEET - 4, 10, 'y3')
        motes(c, 0.2, 10, 1, ['y2', 'c3'])
    elif f == 3:
        lotus(c, 1.0, ['o1', 'y1', 'y3'])
        breath(c, CY, 16, 'y1', 2)
        breath(c, FEET - 12, 12, 'y3')
        halo(c, 8, ['o2', 'y3'])
        motes(c, 0.4, 12, 1, ['y2', 'c3'])
    elif f == 4:
        lotus(c, 1.0, ['o1', 'y1', 'y3'])
        c.poly([(CX - 14, FEET), (CX - 8, 8), (CX + 8, 8), (CX + 14, FEET)], 'y1')  # column of light
        c.poly([(CX - 8, FEET), (CX - 4, 8), (CX + 4, 8), (CX + 8, FEET)], 'y3')
        c.line([(CX, 8), (CX, FEET)], 'w', 2)
        halo(c, 11, ['o2', 'w'])
        c.spark(CX, HEAD - 4, 6, 'w', 'y3', diag=True)
    elif f == 5:
        lotus(c, 1.0, ['o1', 'y1', 'y3'])
        c.poly([(CX - 10, FEET), (CX - 6, 8), (CX + 6, 8), (CX + 10, FEET)], 'y2')
        c.line([(CX, 8), (CX, FEET)], 'y3', 3)
        halo(c, 13, ['y1', 'y3'])
        breath(c, CY - 6, 20, 'y3')
        motes(c, 0.6, 16, 2, ['y2', 'c3', 'y3'])
    elif f == 6:
        lotus(c, 0.9, ['o1', 'y1'])
        halo(c, 14, ['o1', 'y2'])
        breath(c, CY - 12, 22, 'y2')
        for y in range(10, FEET, 3):
            c.px(CX + (y // 3) % 3 - 1, y, 'y3')
        motes(c, 0.8, 16, 2, ['y2', 'c3', 'y3'])
        c.spark(CX - 12, 22, 3, 'w', 'c2')
    elif f == 7:
        lotus(c, 0.6, ['o0', 'o1'])
        c.dring(CX, HEAD - 4, 15, 'y1', squash=0.35)
        motes(c, 1.0, 16, 2, ['y2', 'c3', 'y3'])
        motes(c, 0.3, 8, 3, ['c2', 'c3'])
    elif f == 8:
        c.oval(CX, FEET, 10, 2, 'o0')
        c.oval(CX, FEET, 6, 1, 'o1')
        motes(c, 1.2, 14, 2, ['y2', 'c3'])
        motes(c, 0.6, 8, 3, ['c2', 'c3'])
    elif f == 9:
        motes(c, 1.45, 12, 2, ['y1', 'c2'])
        motes(c, 0.9, 8, 3, ['c2', 'y2'])


if __name__ == '__main__':
    run(globals())

