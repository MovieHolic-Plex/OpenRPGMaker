"""mon_backstab_slash: 기습 (착탄). A shadow darts in from the LEFT, a dagger stabs the ally's back side,
two quick crimson cuts cross and blood-red sparks spray off to the right, then the dark trail thins out."""
import math

from lib_monster_36_52 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_backstab_slash', 64, 8, 'target'
PAL = pal(SHADE, STEEL, BLOOD, pick(DARK, 'v2', 'v3'), WHITE)
PEAK = 3


def dagger(c, x, y, L=12):
    """Dagger pointing RIGHT with its tip at (x, y)."""
    c.poly([(x, y), (x - L * 0.55, y - 2), (x - L * 0.6, y + 1)], 's1')
    c.line([(x - 1, y), (x - L * 0.55, y - 1)], 's3')
    c.rect(x - L * 0.62, y - 3, x - L * 0.56, y + 2, 'd1')
    c.line([(x - L * 0.62, y), (x - L, y)], 'r0', 2)


def spray(c, n, seed, t, x0=BX, y0=BY - 2):
    r = rng(seed)
    for i in range(n):
        a = r.uniform(-0.9, 0.7)
        d = 4 + r.uniform(6, 20) * ease(t)
        x, y = pol(x0, y0, d, a)
        y += 14 * t * t * r.uniform(0.5, 1)
        k = 'r3' if i % 3 == 0 else 'r2' if i % 3 == 1 else 'r1'
        c.px(x, y, k)
        c.px(x - math.cos(a), y - math.sin(a), 'r1')


def draw(c, f):
    if f == 0:          # shadow streak rushing in from the left
        for j, (yy, x1) in enumerate(((BY - 6, 22), (BY - 1, 28), (BY + 4, 20))):
            c.line([(2, yy), (x1, yy)], 'd0' if j != 1 else 'd1', 2 if j == 1 else 1)
        c.line([(10, BY - 1), (28, BY - 1)], 'v2')
        c.disc(26, BY - 1, 2, 'v3')
    elif f == 1:        # blade enters
        c.line([(4, BY - 3), (18, BY - 3)], 'd1', 3)
        c.line([(2, BY + 3), (14, BY + 3)], 'd0')
        dagger(c, 30, BY - 3, 14)
        c.spark(31, BY - 3, 2, 'w', 's2')
    elif f == 2:        # stab impact
        c.line([(6, BY - 3), (22, BY - 3)], 'd1', 2)
        dagger(c, 35, BY - 3, 14)
        c.ring(34, BY - 3, 5, 'r2')
        c.spark(34, BY - 3, 6, 'w', 'r3', diag=True)
        c.rays(34, BY - 3, 6, 7, 11, 'r2', rot=0.3)
    elif f == 3:        # PEAK: two crossing crimson cuts + flash
        c.lens((16, BY - 16), (48, BY + 12), 4.5, ['r0', 'r1', 'r2', 's3'])
        c.lens((14, BY + 10), (46, BY - 14), 3.5, ['d1', 'r1', 'r3', 'w'])
        c.spark(31, BY - 2, 7, 'w', 's2', diag=True)
        c.disc(31, BY - 2, 2, 'w')
        spray(c, 10, 3, 0.25)
    elif f == 4:        # cuts widen and drift, spray flies
        c.lens((18, BY - 16), (50, BY + 12), 2.5, ['r1', 'r2'])
        c.lens((16, BY + 10), (48, BY - 14), 2, ['r1', 'r3'])
        c.ring(31, BY - 2, 9, 'r1')
        spray(c, 14, 4, 0.55)
    elif f == 5:        # afterimage lines + spray falling
        c.dline((20, BY - 13), (50, BY + 13), 'r1', step=2)
        c.dline((18, BY + 9), (48, BY - 13), 'r2', step=2, phase=1)
        c.dring(31, BY - 2, 12, 'r1')
        spray(c, 14, 4, 0.85)
    elif f == 6:        # shadow wisps curling away to the left
        for i in range(4):
            a0 = 150 + i * 20
            c.brush(28, BY - 2, 10 + i * 2, a0, a0 + 60, 1.2, 0.3, 'd1' if i % 2 else 'v2', squash=0.6)
        spray(c, 8, 6, 1.0)
    else:
        c.dline((24, BY - 6), (42, BY + 6), 'r1', step=3)
        for i in range(5):
            c.px(40 + i * 3, FEET - 2 + (i % 2), 'r1')
            c.px(14 + i * 2, BY - 4 - i * 2, 'd1')
    fade_edges(c, L=4, R=3)


if __name__ == '__main__':
    run(globals())

