"""ranger_leaves: 자연의 부름 (아군 전체 회복). A green sigil blooms under the ally, a spiral of leaves rises around them, healing sparkles and plus marks float up.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'ranger_leaves', 64, 10, 'allAllies'
PAL = pal(LEAF, pick(GOLD, 'y2', 'y3'), pick(WOOD, 't1'), WHITE)
CX, FEET = 32, 56


def plus(c, x, y, k, hi='w'):
    c.line([(x - 2, y), (x + 2, y)], k, 2)
    c.line([(x, y - 2), (x, y + 2)], k, 2)
    c.px(x, y, hi)


def sigil(c, r, k, inner):
    c.oval(CX, FEET, r, r * 0.28, k, 1)
    c.oval(CX, FEET, r * 0.65, r * 0.18, inner, 1)
    for i in range(6):
        a = i * math.pi / 3
        c.px(*pol(CX, FEET, r * 0.82, a, 0.28), 'l4')


def draw(c, f):
    if f <= 8:
        sigil(c, [6, 12, 18, 22, 23, 23, 23, 22, 18][f], 'l2', 'l3' if f % 2 else 'l1')
    if f == 0:
        c.spark(CX, FEET - 2, 3, 'w', 'l3')
        return
    # leaves spiral up around the body (helix, front leaves overlap back ones)
    n = 10
    for i in range(n):
        p = (i / n + f * 0.07)
        h = (p * 48 + f * 3) % 52
        if f < 3 and h > 16 + f * 12:
            continue
        a = i * 2.3 + f * 0.8
        x = CX + math.cos(a) * (18 - h * 0.12)
        y = FEET - 4 - h + math.sin(a) * 3
        if f >= 8 and h > 30:
            continue
        body = 'l2' if math.sin(a) > 0 else 'l1'
        c.leaf(x, y, a + math.pi / 2, 7, body, 'l3', edge='l0' if math.sin(a) > 0 else None)
    if 3 <= f <= 7:
        c.line([(CX, FEET - 2), (CX, FEET - 12 - (f - 3) * 7)], 'l3', 2 if f < 6 else 1)
        c.line([(CX, FEET - 2), (CX, FEET - 10 - (f - 3) * 7)], 'l4')
        for i in range(4):
            x = 16 + i * 10 + (f % 2) * 2
            y = FEET - 8 - ((f * 7 + i * 13) % 40)
            plus(c, x, y, 'l3' if i % 2 else 'y2')
    if f == 5:
        c.spark(CX, 20, 8, 'w', 'y3', diag=True)
        c.ring(CX, 20, 5, 'l3', 1)
    if f in (6, 7):
        c.dring(CX, 30, 20 + (f - 6) * 5, 'l3', parity=f)
        c.spark(CX, 20 - (f - 6) * 6, 4, 'w', 'y3')
    if f >= 8:
        for i, (x, y) in enumerate([(20, 16), (44, 20), (30, 8), (38, 30), (16, 30)]):
            c.spark(x, y - (f - 8) * 3, 2 if i % 2 else 1, 'w', 'l4')


if __name__ == '__main__':
    run(globals())

