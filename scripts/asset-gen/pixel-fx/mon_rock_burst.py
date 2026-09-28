"""mon_rock_burst: 바위 던지기 (착탄). The boulder slams in from the LEFT, cracks with a flash, shatters into
flying chunks and a brown-orange dust bloom, the chunks rain onto the floor and the dust settles."""
import math

from lib_monster_36_52 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_rock_burst', 64, 8, 'target'
PAL = pal(ROCK, DUST, pick(SHOCK, 'h2'), WHITE)
PEAK = 2
RK = ('o0', 'o1', 'o2', 'o3', 'o4')
CH = ('o0', 'o2', 'o4')


def chunks(c, t, n, seed, x0=BX - 4, y0=BY - 4):
    r = rng(seed)
    for i in range(n):
        a = r.uniform(-math.pi * 0.95, math.pi * 0.25)
        v = r.uniform(10, 24)
        x = x0 + math.cos(a) * v * ease(t)
        y = y0 + math.sin(a) * v * ease(t) + 26 * t * t
        y = min(y, FEET + r.uniform(-1, 2))
        chunk(c, x, y, r.uniform(1.4, 3.2) * (1 - 0.3 * t), r.uniform(0, 6), CH)


def dust(c, cx, cy, rr, keys, seed, parity=0):
    c.cloud(cx, cy, rr, keys, seed=seed, lobes=8, parity=parity)


def draw(c, f):
    if f == 0:          # boulder arriving from the left
        for yy, L in ((BY - 10, 10), (BY - 3, 14), (BY + 4, 9)):
            c.line([(0, yy), (L, yy)], 'u2')
        rock(c, 20, BY - 4, 10, 0.4, RK, seed=5)
    elif f == 1:        # impact: crack + flash
        rock(c, 26, BY - 4, 10, 0.9, RK, seed=5, cracks=False)
        c.line([(20, BY - 12), (27, BY - 4), (23, BY + 3)], 'h2', 1)
        c.line([(27, BY - 4), (34, BY - 7)], 'w')
        c.spark(34, BY - 4, 7, 'w', 'u3', diag=True)
        c.arc(32, BY - 4, 12, 290, 70, 'u3', 2)
    elif f == 2:        # PEAK: shatter
        dust(c, BX - 4, BY - 2, 13, ['u0', 'u1', 'u2', 'u3'], 2)
        pow_burst(c, BX - 4, BY - 4, 11, ['o3', 'u3', 'w'], rot=0.2)
        chunks(c, 0.25, 12, 3)
        c.rays(BX - 4, BY - 4, 10, 16, 24, 'u2', rot=0.1, jitter=(1, .8, 1.1, .7, .9))
    elif f == 3:
        dust(c, BX - 6, BY, 15, ['u0', 'u1', 'u2', 'u3'], 3, parity=1)
        chunks(c, 0.5, 12, 3)
        dust(c, BX + 8, BY - 8, 6, ['u1', 'u2', 'u3'], 7)
    elif f == 4:        # chunks falling, dust rolling outward along the floor
        dust(c, BX - 14, FEET - 7, 9, ['u0', 'u1', 'u2'], 4)
        dust(c, BX + 10, FEET - 6, 8, ['u0', 'u1', 'u2'], 5, parity=1)
        c.ddisc(BX - 2, BY - 4, 9, 'u1', squash=0.8)
        chunks(c, 0.78, 12, 3)
    elif f == 5:
        dust(c, BX - 18, FEET - 5, 7, ['u0', 'u1', 'u2'], 8)
        dust(c, BX + 16, FEET - 5, 7, ['u0', 'u1', 'u2'], 9, parity=1)
        c.ddisc(BX, FEET - 10, 8, 'u1', squash=0.6, parity=1)
        chunks(c, 1.0, 12, 3)
    elif f == 6:        # settling
        c.ddisc(BX - 18, FEET - 4, 7, 'u1', squash=0.6)
        c.ddisc(BX + 18, FEET - 4, 6, 'u1', squash=0.6, parity=1)
        c.dring(BX, FEET - 1, 18, 'u0', squash=0.25)
        r = rng(3)
        for i in range(9):
            chunk(c, BX - 14 + i * 3.6, FEET - r.uniform(0, 2), 1.4 + (i % 3) * 0.5, i, CH)
    else:
        c.dring(BX, FEET - 1, 22, 'u0', squash=0.2)
        for i in range(6):
            chunk(c, BX - 12 + i * 5, FEET - (i % 2), 1.2 + (i % 2) * 0.6, i, CH)
    fade_edges(c, T=3, B=3, L=3, R=3)


if __name__ == '__main__':
    run(globals())

