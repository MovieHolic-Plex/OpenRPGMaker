"""ninja_fire_breath: 화둔 (착탄). A violet seal flares, a roaring fireball cone pours over the target from the right, balloons into a blaze, and burns down to embers and smoke.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'ninja_fire_breath', 64, 10, 'target'
PAL = pal(FLAME, pick(NIGHT, 'v1', 'v2', 'v3'), pick(SMOKEV, 'q1', 'q2', 'q3'), WHITE)
FK = ['e0', 'e1', 'e2', 'e3', 'e4']


def ball(c, x, y, r, keys=FK):
    for i, k in enumerate(keys):
        c.disc(x - i * r * 0.08, y - i * r * 0.1, max(0.6, r * (1 - i * 0.2)), k)


def stream(c, head, r, seed, n=6):
    rr = rng(seed)
    for i in range(n):
        t = i / (n - 1)
        x = lerp(64, head, t) if head < 64 else 64
        y = CY + rr.uniform(-2, 2) * (1 - t)
        ball(c, x, y, lerp(4, r, t))


def draw(c, f):
    if f == 0:
        c.ring(58, CY, 7, 'v2', 1)
        c.diamond(58, CY, 4, 4, 'v3')
        c.spark(58, CY, 5, 'w', 'e3')
    elif f == 1:
        stream(c, 44, 7, 1, 4)
        c.spark(44, CY, 4, 'w', 'e4')
    elif f == 2:
        stream(c, 28, 11, 2, 6)
        ball(c, 22, CY, 7, FK[1:])
    elif f == 3:
        stream(c, 30, 14, 3, 6)
        ball(c, CX, CY, 16)
        for i in range(5):
            c.flame(18 + i * 7, CY - 10, 10 + (i % 2) * 6, 3, ['e1', 'e2', 'e3'], lean=(i - 2) * 2)
    elif f == 4:
        ball(c, CX, CY, 21)
        c.ring(CX, CY, 24, 'e1', 2)
        for i in range(7):
            c.flame(10 + i * 7, CY - 14, 12 + (i * 5) % 9, 3.5, ['e0', 'e2', 'e3', 'e4'], lean=(i - 3) * 1.5)
        c.disc(CX, CY, 7, 'w')
        c.spark(CX, CY, 12, 'w', 'e4', diag=True)
    elif f == 5:
        for i in range(8):
            c.flame(6 + i * 7.3, FEET, 22 + (i * 7) % 14, 5, ['e0', 'e1', 'e2', 'e3', 'e4'], lean=(i - 3.5) * 1.2)
        ball(c, CX, CY + 2, 12, FK[1:])
        c.ring(CX, CY, 28, 'e2', 1)
        specks(c, CX, CY, 10, 16, 30, 5, ['e3', 'e4'], spark_every=4)
    elif f == 6:
        for i in range(8):
            c.flame(6 + i * 7.3, FEET, 18 + (i * 5 + 3) % 14, 4.5, ['e0', 'e1', 'e2', 'e3'], lean=(3.5 - i) * 1.2)
        c.cloud(CX, 14, 10, ['q1', 'q2', 'q3'], seed=6)
        specks(c, CX, CY, 12, 14, 30, 6, ['e3', 'e4', 'e2'], spark_every=4)
    elif f == 7:
        for i in range(6):
            c.flame(10 + i * 9, FEET, 12 + (i * 5) % 8, 3.5, ['e0', 'e1', 'e2'], lean=(i - 2.5))
        c.cloud(CX - 4, 12, 12, ['q1', 'q2', 'q3'], seed=7)
        specks(c, CX, CY - 6, 12, 10, 28, 7, ['e2', 'e3'], spark_every=5)
    elif f == 8:
        for i in range(5):
            c.flame(12 + i * 10, FEET, 6 + (i * 3) % 5, 2.5, ['e0', 'e1'])
        c.cloud(CX - 6, 9, 11, ['q1', 'q2'], seed=8, parity=1)
        specks(c, CX, CY - 8, 10, 10, 28, 8, ['e1', 'e2', 'e3'])
    else:
        c.ddisc(CX - 8, 8, 9, 'q1')
        for i in range(8):
            c.px(12 + i * 6, FEET - 2 - (i * 5) % 20, 'e2' if i % 2 else 'e3')
            c.px(12 + i * 6, FEET - 1 - (i * 5) % 20, 'e0')


if __name__ == '__main__':
    run(globals())

