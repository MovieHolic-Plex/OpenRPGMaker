"""mon_scythe_x: 교차 낫베기 (착탄). Two mantis-scythe sweeps from the left cross into a green-white X, flare, then split apart in chitin shards.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_0_17 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_scythe_x', 64, 10, 'target'
PAL = pal(ACID, pick(TOXV, 'u0', 'u1', 'u2'), pick(GORE, 'r2', 'r3'), WHITE)
A0, A1 = (6, 14), (52, 60)       # first sweep: upper left -> lower right
B0, B1 = (6, 62), (52, 16)       # second sweep: lower left -> upper right
KEYS = ['u1', 'a1', 'a3', 'a4', 'w']


def cut(c, p0, p1, bulge, frac, th=9, keys=KEYS):
    c.blade(p0, p1, bulge, th, keys, frac)


def draw(c, f):
    if f == 0:
        cut(c, A0, A1, 10, 0.35, 5, ['a1', 'a3', 'w'])
    elif f == 1:
        cut(c, A0, A1, 10, 0.85)
        c.spark(*lerp_pt(A0, A1, 0.8), 3, 'w', 'a4')
    elif f == 2:
        cut(c, A0, A1, 10, 1.0, 5, ['u1', 'a2', 'a4'])
        cut(c, B0, B1, -10, 0.45, 6, ['a1', 'a3', 'w'])
    elif f == 3:
        cut(c, A0, A1, 10, 1.0, 4, ['u1', 'a2'])
        cut(c, B0, B1, -10, 1.0)
    elif f == 4:                                          # the X flares
        for p0, p1, b in ((A0, A1, 10), (B0, B1, -10)):
            cut(c, p0, p1, b, 1.0, 10, ['u0', 'u2', 'a2', 'a4', 'w'])
        c.disc(CX + 1, CY - 5, 5, 'a4')
        c.rays(CX + 1, CY - 5, 8, 6, 14, 'w', rot=0.39)
        c.disc(CX + 1, CY - 5, 2, 'w')
    elif f == 5:
        for p0, p1, b in ((A0, A1, 10), (B0, B1, -10)):
            cut(c, p0, p1, b, 1.0, 6, ['u1', 'a3', 'w'])
        c.ring(CX + 1, CY - 5, 10, 'a3', 2)
        for a in (0.4, 2.0, 3.6, 5.1):
            x, y = pol(CX + 1, CY - 5, 16, a)
            c.px(x, y, 'r3')
            c.px(x + 1, y, 'r2')
    elif f == 6:
        for p0, p1, b, s in ((A0, A1, 10, -2), (B0, B1, -10, 2)):
            q0, q1 = (p0[0], p0[1] + s), (p1[0], p1[1] + s)
            cut(c, q0, q1, b, 1.0, 4, ['u1', 'a2'])
        c.dring(CX + 1, CY - 5, 15, 'a3')
        specks(c, CX + 1, CY - 5, 10, 8, 20, 6, ['a4', 'r3', 'a2'])
    elif f == 7:
        for p0, p1, b, s in ((A0, A1, 10, -4), (B0, B1, -10, 4)):
            q0, q1 = (p0[0] + 3, p0[1] + s), (p1[0] + 3, p1[1] + s)
            cut(c, q0, q1, b, 1.0, 2.5, ['u1', 'a2'])
        shards(c, 7, 18)
    elif f == 8:
        shards(c, 8, 23)
        for p0, p1, s in ((A0, A1, -5), (B0, B1, 5)):
            c.dline((p0[0] + 8, p0[1] + s), (p1[0] - 4, p1[1] + s), 'u2', 2)
    else:
        shards(c, 9, 27, small=True)


def lerp_pt(p0, p1, t):
    return (lerp(p0[0], p1[0], t), lerp(p0[1], p1[1], t))


def shards(c, seed, dist, small=False):
    r = rng(seed)
    for i in range(8):
        a = i * math.pi / 4 + 0.3 + r.uniform(-0.2, 0.2)
        x, y = pol(CX + 1, CY - 5, dist * r.uniform(0.8, 1.1), a)
        if small:
            c.px(x, y, 'a3' if i % 2 else 'u2')
        else:
            c.diamond(x, y, 1, 2, 'a2' if i % 2 else 'u2')
            c.px(x, y - 1, 'a4')


if __name__ == '__main__':
    run(globals())

