"""monk_earth_palm: 파산장. A giant golden palm print slams into the target, the ground cracks under it,
rock shards and a dust wave blow out, and the handprint fades in embers.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'monk_earth_palm', 128, 10, 'target'
PAL = pal(pick(MONK, 'k', 'o0', 'o1', 'o2', 'y2', 'y3'), EARTH, WHITE)
CX, CY, FEET = 64, 76, 120


def cracks(c, t, k, w=1):
    r = rng(5)
    for i in range(9):
        side = -1 if i % 2 else 1
        L = r.uniform(24, 52) * t
        pts = [(CX, FEET)]
        x, y = CX, FEET
        a = side * r.uniform(0.05, 0.6)
        for s in range(4):
            x += side * L / 4 * math.cos(a)
            y += L / 4 * math.sin(a) * 0.2 * (1 if s % 2 else -1)
            pts.append((x, y + r.uniform(-1, 1)))
        c.line(pts, k, w)


def shards(c, t, seed, n=10):
    r = rng(seed)
    for i in range(n):
        side = -1 if i % 2 else 1
        vx = side * r.uniform(10, 46)
        vy = -r.uniform(26, 52)
        x = CX + side * r.uniform(4, 16) + vx * t
        y = FEET - 4 + vy * t + 70 * t * t
        if y > FEET + 2:
            continue
        s = r.uniform(2, 4.5) * (1 - 0.3 * t)
        rot = r.uniform(0, 6) + t * 5
        pts = [pol(x, y, s * (1 if k % 2 else 0.6), rot + k * math.pi / 2.5) for k in range(5)]
        c.poly(pts, 't0')
        c.poly([(px_ - 0.5, py_ - 0.5) for px_, py_ in pts[:3]] + [(x, y)], 't2')
        c.px(x - 1, y - 1, 't3')


def dust(c, t, keys):
    for side in (-1, 1):
        for i in range(5):
            d = 14 + i * 9 + t * 22
            x = CX + side * d
            r = (7 - i) * (1 - 0.5 * t)
            if r < 1:
                continue
            c.cloud(x, FEET - r * 0.7, r, keys, seed=i * 3 + (side > 0), lobes=6)


def print_(c, s, keys, x=CX, y=CY + 18):
    """keys: outline, body, then lighter inner layers shrinking up-left."""
    palm(c, x, y, s, keys[0], grow=1)
    palm(c, x, y, s, keys[1], grow=0)
    for i, k in enumerate(keys[2:]):
        palm(c, x - 1 - i * 0.5, y - 1 - i * 0.5, s, k, grow=-(1 + i))


def draw(c, f):
    if f == 0:
        converge(c, CX, CY, 0.5, 18, 2, ['o1', 'y2'], r0=54, r1=14, trail=6)
        print_(c, 1.4, ['o0', 'o1'], x=CX + 20)
        c.spark(CX, CY, 5, 'w', 'y2')
    elif f == 1:
        print_(c, 2.0, ['k', 'o1', 'o2', 'y2'], x=CX + 8)
        for i in range(5):
            y = CY - 10 + i * 8
            c.line([(CX + 34, y), (CX + 60, y)], 'y2' if i % 2 else 'o2', 2)
    elif f == 2:
        c.rays(CX, CY, 20, 30, 62, 'y2', rot=0.08, jitter=[1, 0.75, 0.9, 0.7, 0.95])
        print_(c, 2.4, ['k', 'o1', 'o2', 'y2', 'y3', 'w'])
        pow_burst(c, CX, CY, 20, ['o1', 'y2', 'w'], rot=0.2, n=10)
        cracks(c, 0.4, 'k', 2)
    elif f == 3:
        print_(c, 2.4, ['k', 'o1', 'o2', 'y2', 'y3'])
        c.ring(CX, CY, 34, 'o1', 3)
        c.ring(CX, CY, 33, 'y3', 1)
        cracks(c, 0.8, 'k', 3)
        cracks(c, 0.8, 'y2', 1)
        c.oval(CX, FEET, 36, 5, 't0')
        c.oval(CX, FEET, 26, 3, 'o1')
        shards(c, 0.15, 1)
    elif f == 4:
        print_(c, 2.4, ['o0', 'o1', 'o2', 'y2'])
        c.ring(CX, CY, 46, 'o0', 2)
        c.dring(CX, CY, 44, 'y2')
        cracks(c, 1.0, 'k', 3)
        cracks(c, 1.0, 'o2', 1)
        dust(c, 0.1, ['t0', 't1', 't2', 't3'])
        shards(c, 0.35, 1)
        burst(c, CX, CY, 0.3, 20, 4, ['w', 'y3', 'y2', 'o2'], spd=(26, 50), size=(1, 3))
    elif f == 5:
        print_(c, 2.4, ['o0', 'o1', 'o2'])
        c.dring(CX, CY, 54, 'o1')
        cracks(c, 1.0, 'k', 3)
        cracks(c, 1.0, 'o1', 1)
        dust(c, 0.35, ['t0', 't1', 't2', 't3'])
        shards(c, 0.55, 1)
        burst(c, CX, CY, 0.5, 20, 4, ['w', 'y3', 'y2', 'o2', 'o1'], spd=(26, 50), size=(1, 3))
    elif f == 6:
        print_(c, 2.4, ['o0', 'o1'])
        cracks(c, 1.0, 'k', 2)
        dust(c, 0.6, ['t0', 't1', 't2'])
        shards(c, 0.75, 1)
        burst(c, CX, CY, 0.7, 20, 4, ['y3', 'y2', 'o2', 'o1'], spd=(26, 50), size=(1, 3), grav=0.3)
    elif f == 7:
        for y in range(CY - 16, CY + 20, 2):   # palm print breaking up
            for x in range(CX - 12, CX + 12, 3):
                if (x * 3 + y * 5) % 7 < 2:
                    c.px(x, y, 'o1')
        cracks(c, 1.0, 't0', 1)
        dust(c, 0.85, ['t0', 't1'])
        shards(c, 0.95, 1)
        burst(c, CX, CY, 0.9, 20, 4, ['y2', 'o2', 'o1', 'o0'], spd=(26, 50), size=(1, 3), grav=0.6)
    elif f == 8:
        cracks(c, 1.0, 't0', 1)
        for i in range(12):
            x = CX - 44 + i * 8
            c.cloud(x, FEET - 3, 3, ['t0', 't1'], seed=i, lobes=5, parity=i)
        burst(c, CX, CY, 1.0, 12, 9, ['o2', 'o1', 'o0'], spd=(10, 30), up=0.8)
    elif f == 9:
        for i in range(14):
            x = CX - 50 + i * 7
            c.ddisc(x, FEET - 3, 3, 't0', parity=i)
        burst(c, CX, CY - 10, 1.0, 10, 11, ['o1', 'o0'], spd=(14, 34), up=1.2)


if __name__ == '__main__':
    run(globals())

