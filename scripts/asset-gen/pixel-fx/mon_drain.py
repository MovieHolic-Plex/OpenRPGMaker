"""mon_drain: 흡혈 (착탄). Two fangs plunge into the ally shoulder, blood spurts, and crimson beads stream back left toward the monster inside a violet swirl.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_0_17 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_drain', 64, 10, 'target'
PAL = pal(GORE, pick(DUSK, 'v1', 'v2', 'v3', 'v4'), pick(BONE, 'b2', 'b3'), WHITE)
BX, BY = CX - 3, CY - 6                                  # bite on the neck / shoulder


def fangs(c, y, big):
    for dx in (-4, 3):
        fang(c, BX + dx, y, 8 if big else 5, 2 if big else 1.4, True, 'b3', 'w', edge='v1')


def stream(c, t, n=7):
    """Beads on the curve wound -> upper-left edge; t shifts them along."""
    for i in range(n):
        u = (i / n + t) % 1.0
        if u < 0.05:
            continue
        x = lerp(BX, -4, u)
        y = BY - math.sin(u * math.pi) * 14 - u * 8
        s = 2.5 - u * 1.2
        c.diamond(x, y, max(1, s * 0.8), s, 'r1')
        c.diamond(x - 0.5, y - 0.5, max(0.6, s * 0.5), max(1, s - 1), 'r3')
        c.px(x - 1, y - 1, 'r4')


def swirl(c, phase, r, k):
    for i in range(3):
        a = phase + i * 120
        c.brush(BX - 2, BY - 4, r - i * 3, a, a + 100, 0.5, 1.4, k, squash=0.55)


def draw(c, f):
    if f == 0:
        specks(c, BX, BY - 10, 10, 8, 18, 3, ['v2', 'v3'])
        fangs(c, BY - 16, False)
    elif f == 1:
        swirl(c, 20, 16, 'v1')
        fangs(c, BY - 11, True)
        c.line([(BX - 4, BY - 20), (BX - 4, BY - 14)], 'v3')
        c.line([(BX + 3, BY - 20), (BX + 3, BY - 14)], 'v3')
    elif f == 2:
        fangs(c, BY - 7, True)
        star(c, BX, BY + 2, 9, 3, 6, 0.3, 'r2')
        c.disc(BX, BY + 2, 3, 'r3')
        c.spark(BX - 4, BY + 1, 3, 'w', 'r4')
        c.spark(BX + 3, BY + 1, 3, 'w', 'r4')
    elif f == 3:
        star(c, BX, BY + 1, 14, 5, 7, 0.1, 'r1')
        star(c, BX, BY + 1, 11, 4, 7, 0.1, 'r2')
        c.disc(BX - 1, BY, 4, 'r3')
        c.disc(BX - 2, BY - 1, 2, 'r4')
        drops(c, BX, BY, 10, 13, 20, 33, 'r2', 'r4', a0=math.pi * 0.7, a1=math.pi * 1.9, size=1.5)
        c.ring(BX, BY + 1, 17, 'v2', 1, squash=0.7)
    elif f in (4, 5, 6, 7):
        t = (f - 4) * 0.12
        swirl(c, f * 55, 20, 'v2')
        swirl(c, f * 55 + 60, 14, 'v3')
        stream(c, t, 7 if f < 7 else 5)
        for dx in (-4, 3):
            c.disc(BX + dx, BY + 1, 1.2, 'r1')
            c.px(BX + dx, BY + 1, 'r3')
        if f == 5:
            c.disc(BX - 1, BY - 2, 3, 'r2')
            c.px(BX - 2, BY - 3, 'r4')
    elif f == 8:
        stream(c, 0.55, 3)
        c.dring(BX - 2, BY - 4, 18, 'v2', squash=0.55)
        for dx in (-4, 3):
            c.px(BX + dx, BY + 1, 'r1')
    else:
        specks(c, BX - 8, BY - 8, 10, 6, 18, 9, ['v3', 'r3', 'v2'])


if __name__ == '__main__':
    run(globals())

