"""mon_gaze_screen: 사안 (화면). Darkness closes in on the stage, a colossal eye opens across it, its crimson
iris locks onto the allies on the right and the whole stage throbs at the peak, then it narrows and sinks back.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_18_35 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_gaze_screen', 128, 8, 'screen'
PAL = pal(EYE, pick(CRIMSON, 'c1', 'c2', 'c3'), pick(GRAVE, 'v0', 'v1'), WHITE)
PEAK = 4
EX, EY = 64, 60


def veins(c, n, r0, r1, seed, k):
    r = rng(seed)
    for i in range(n):
        a = r.uniform(0, 2 * math.pi)
        p = pol(EX, EY, r0, a, 0.6)
        q = pol(EX, EY, r1 * r.uniform(0.7, 1), a + r.uniform(-.2, .2), 0.6)
        m = ((p[0] + q[0]) / 2 + r.uniform(-4, 4), (p[1] + q[1]) / 2 + r.uniform(-3, 3))
        c.line([p, m, q], k)


def big_eye(c, open_, look=0.0, rx=48, ry=26, iris_keys=('c1', 'c2'), glow=False):
    h = max(1, ry * open_)
    n = 24
    top = [(EX - rx * math.cos(math.pi * i / n), EY - h * math.sin(math.pi * i / n)) for i in range(n + 1)]
    bot = [(EX + rx * math.cos(math.pi * i / n), EY + h * math.sin(math.pi * i / n)) for i in range(n + 1)]
    c.poly([(x, y - 3) for x, y in top] + [(x, y + 3) for x, y in bot], 'v0')
    c.poly([(x, y - 2) for x, y in top] + [(x, y + 2) for x, y in bot], 'q1')
    if open_ < 0.12:
        c.line([(EX - rx, EY), (EX + rx, EY)], 'q3', 2)
        return
    c.poly(top + bot, 'q4' if glow else 'q3')
    c.poly([(x, y + h * 0.25) for x, y in top[3:-3]] + [(x, y - h * 0.1) for x, y in bot[3:-3]], 'q2')
    ix = EX + look
    ir = min(h, 20)
    c.disc(ix, EY, ir, 'c1')
    c.disc(ix - 1, EY - 1, ir * 0.8, iris_keys[1])
    c.ring(ix, EY, ir * 0.62, 'c3')
    c.oval(ix, EY, max(1, ir * 0.18), max(1, ir * 0.85), 'v0')
    c.rect(ix - ir * 0.55, EY - ir * 0.55, ix - ir * 0.55 + 2, EY - ir * 0.55 + 1, 'w')


def dark(c, parity=0):
    c.drect(0, 0, 127, 127, 'v0', parity)


def draw(c, f):
    if f == 0:
        dark(c)
        c.line([(EX - 30, EY), (EX + 30, EY)], 'q2')
    elif f == 1:
        dark(c)
        big_eye(c, 0.08)
        veins(c, 6, 50, 60, 1, 'q1')
    elif f == 2:
        dark(c)
        veins(c, 10, 46, 64, 2, 'q1')
        big_eye(c, 0.5)
    elif f == 3:
        dark(c)
        veins(c, 14, 44, 66, 3, 'q2')
        big_eye(c, 1.0, 0)
    elif f == 4:  # peak: iris swings right onto the allies, stage throbs
        dark(c)
        c.dring(EX, EY, 56, 'c1', squash=0.7)
        c.ring(EX, EY, 60, 'c2', 1, squash=0.66)
        veins(c, 18, 44, 70, 4, 'c2')
        big_eye(c, 1.0, 14, glow=True)
        c.rays(EX + 14, EY, 16, 22, 30, 'c3', rot=0.1)
        c.spark(EX + 30, EY - 10, 6, 'w', 'q4', diag=True)
    elif f == 5:
        dark(c)
        c.dring(EX, EY, 60, 'c1', squash=0.66)
        veins(c, 16, 44, 68, 5, 'c1')
        big_eye(c, 0.9, 16)
    elif f == 6:
        dark(c, 1)
        veins(c, 8, 46, 60, 6, 'q1')
        big_eye(c, 0.35, 10)
    else:
        dark(c, 1)
        big_eye(c, 0.06)
        motes(c, EX, EY, 10, 20, 50, 7, ['q2', 'c1'], sq=0.6)


if __name__ == '__main__':
    run(globals())
