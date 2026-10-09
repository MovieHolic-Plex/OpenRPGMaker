"""ninja_water_dragon: 수룡탄 (화면). A water seal spins up a column from the lower right, the column rears into a serpent dragon (head, eye, horns, fins), arcs across the stage and dives left into a tidal crash, then spray rains down.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'ninja_water_dragon', 128, 10, 'screen'
PAL = pal(WATER, pick(NIGHT, 'v1', 'v2', 'v3'), pick(BLOOD, 'r2'), WHITE)
WK = ['a0', 'a1', 'a2', 'a3']


def path(t):
    """Dragon spine: rises at the right (t=0), loops over the top, dives down-left (t=1)."""
    x = 112 - 96 * t
    y = 120 - 80 * math.sin(math.pi * min(1, t * 1.05)) + 18 * math.sin(t * 9)
    return x, y


def body(c, t0, t1, w=9):
    n = 40
    pts = [path(lerp(t0, t1, i / n)) for i in range(n + 1)]
    for k, ww in zip(WK, (w, w - 2, w - 4.5, w - 7)):
        if ww > 0:
            for i, (x, y) in enumerate(pts):
                taper = 0.45 + 0.55 * (i / n)
                c.disc(x, y, max(0.6, ww * taper), k)
    # scales: dithered belly highlights and fins on the back
    for i in range(3, n, 4):
        x, y = pts[i]
        x2, y2 = pts[i - 1]
        a = math.atan2(y - y2, x - x2) - math.pi / 2
        c.line([(x, y), pol(x, y, w + 4, a)], 'a2')
        c.px(*pol(x, y, w + 5, a), 'a4')
    for i in range(1, n, 3):
        c.px(*pts[i], 'a4')
    return pts


def head(c, x, y, ang, s=1.0):
    ux, uy = math.cos(ang), math.sin(ang)
    vx, vy = -uy, ux

    def P(a, b):
        return (x + ux * a * s + vx * b * s, y + uy * a * s + vy * b * s)
    # mane: water spikes flaring back from the skull
    for j, (a, b) in enumerate(((-8, -14), (-12, -8), (-12, 0), (-10, 8), (-6, 14))):
        c.line([P(-2, b * 0.4), P(a, b)], 'a2' if j % 2 else 'a3', 2)
        c.px(*P(a - 1, b + (1 if b > 0 else -1)), 'a4')
    # skull + upper jaw
    c.poly([P(-6, -10), P(8, -9), P(20, -4), P(22, 0), P(8, 1), P(-6, 2)], 'a1', outline='a0')
    c.poly([P(-3, -8), P(8, -7), P(18, -3), P(6, -1)], 'a2')
    c.line([P(0, -9), P(16, -4)], 'a3')
    # open lower jaw
    c.poly([P(-4, 3), P(6, 4), P(18, 9), P(16, 11), P(2, 10), P(-6, 8)], 'a1', outline='a0')
    c.line([P(0, 6), P(14, 9)], 'a2')
    for i in range(4):
        c.px(*P(9 + i * 3, 0.5 + i * 0.3), 'w')
        c.px(*P(8 + i * 3, 5 + i * 1.2), 'w')
    # horns and whiskers
    c.line([P(0, -9), P(-10, -20)], 'a3', 2)
    c.line([P(5, -9), P(-2, -22)], 'a4', 1)
    c.line([P(20, 0), P(26, -6), P(30, -4)], 'a3')
    c.line([P(16, 10), P(22, 16), P(28, 15)], 'a3')
    # glaring eye
    c.disc(*P(9, -5), 2.2 * s, 'w')
    c.disc(*P(10, -5), 1.0 * s, 'r2')


def spray(c, cx, cy, n, dist, seed, drop=0.0):
    r = rng(seed)
    for i in range(n):
        a = r.uniform(math.pi, 2 * math.pi)
        d = dist * r.uniform(0.3, 1.0)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d * 0.7 + drop * r.uniform(0.5, 1.2)
        c.disc(x, y, r.choice([1, 1, 1.6]), 'a3')
        c.px(x - 1, y - 1, 'a4')


def draw(c, f):
    if f == 0:
        c.ring(112, 118, 16, 'v2', 2, squash=0.35)
        c.ring(112, 118, 10, 'a2', 2, squash=0.35)
        c.spark(112, 114, 6, 'w', 'a3')
        spray(c, 112, 118, 8, 14, 0)
    elif f == 1:
        c.ring(112, 118, 22, 'a1', 3, squash=0.35)
        c.ring(112, 118, 21, 'a3', 1, squash=0.35)
        body(c, 0, 0.12, 8)
        spray(c, 112, 112, 14, 22, 1)
    elif f == 2:
        pts = body(c, 0, 0.3, 9)
        x, y = path(0.3)
        head(c, x, y, math.atan2(y - path(0.27)[1], x - path(0.27)[0]), 1.4)
        spray(c, 112, 118, 12, 24, 2)
    elif f in (3, 4, 5):
        t1 = [0.5, 0.68, 0.86][f - 3]
        t0 = max(0, t1 - 0.62)
        body(c, t0, t1, 10)
        x, y = path(t1)
        px_, py_ = path(t1 - 0.03)
        head(c, x, y, math.atan2(y - py_, x - px_), 1.7)
        for i in range(6):
            tt = t0 + (t1 - t0) * i / 6
            bx, by = path(tt)
            c.px(bx + 6, by + 10, 'a3')
            c.px(bx - 5, by + 13, 'a4')
        if f == 5:
            c.spark(x - 8, y + 10, 8, 'w', 'a4', diag=True)
    elif f == 6:
        body(c, 0.42, 1.0, 10)
        c.oval(16, 112, 30, 12, 'a1')
        c.oval(16, 108, 22, 8, 'a2')
        c.oval(16, 104, 12, 5, 'a4')
        c.disc(18, 104, 6, 'w')
        c.spark(18, 102, 16, 'w', 'a4', diag=True)
        spray(c, 18, 104, 18, 36, 6)
    elif f == 7:
        body(c, 0.7, 1.0, 7)
        c.ring(18, 110, 34, 'a2', 3, squash=0.4)
        c.ring(18, 110, 33, 'a4', 1, squash=0.4)
        for i in range(6):
            x = 2 + i * 8
            c.flame(x, 116, 22 + (i * 7) % 16, 3, ['a1', 'a2', 'a3', 'a4'], lean=(i - 2.5) * 2)
        spray(c, 22, 96, 22, 44, 7)
    elif f == 8:
        c.dring(18, 112, 44, 'a2', squash=0.4)
        for i in range(5):
            c.flame(4 + i * 10, 118, 10 + (i * 5) % 8, 2.5, ['a1', 'a2', 'a3'])
        spray(c, 30, 90, 26, 56, 8, drop=10)
    else:
        c.dring(18, 114, 52, 'a1', parity=1, squash=0.4)
        spray(c, 40, 88, 20, 64, 9, drop=24)


if __name__ == '__main__':
    run(globals())

