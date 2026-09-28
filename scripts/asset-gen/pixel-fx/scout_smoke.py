"""scout_smoke: 연막탄 (착탄). Bomb flash at the feet, a billowing grey cloud that swallows the target, dizzy stars, then drifting wisps.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'scout_smoke', 64, 10, 'allTargets'
PAL = pal(SMOKE, pick(GOLD, 'y2', 'y3'), pick(SHADOW, 'v', 'l'), WHITE)
CX = 32
CLOUD = ['q1', 'q2', 'q3', 'q4']


def stars(c, f):
    for i in range(3):
        a = f * 0.9 + i * 2.09
        x, y = CX + math.cos(a) * 13, 17 + math.sin(a) * 4
        c.spark(x, y, 2, 'w' if i == f % 3 else 'l', 'v')


def draw(c, f):
    if f == 0:
        c.disc(30, 52, 3, 'q0')
        c.px(29, 51, 'q3')
        c.spark(33, 48, 3, 'w', 'y3')
        c.oval(CX, 56, 8, 2, 'q1', 1)
    elif f == 1:
        c.spark(CX, 49, 12, 'w', 'y3', diag=True)
        c.ring(CX, 49, 6, 'y2', 1)
        c.disc(CX, 49, 3, 'w')
        c.oval(CX, 56, 13, 3, 'q2', 1)
    elif f == 2:
        c.rays(CX, 48, 10, 11, 20, 'y2', rot=0.2)
        c.cloud(CX, 46, 12, CLOUD, seed=1, lobes=7)
        c.spark(CX + 2, 47, 5, 'w', 'y3')
    elif f == 3:
        c.cloud(CX, 41, 18, CLOUD, seed=2, lobes=9)
        c.cloud(12, 50, 7, CLOUD[:3], seed=3, lobes=5)
        c.cloud(52, 50, 7, CLOUD[:3], seed=4, lobes=5)
    elif f in (4, 5, 6):
        k = f - 4
        c.cloud(CX + (k - 1) * 2, 37 - k, 22 - k, CLOUD, seed=5 + k, lobes=11, parity=k)
        c.cloud(11 - k, 49 - k, 8, CLOUD[:3], seed=9 + k, lobes=5, parity=k)
        c.cloud(53 + k, 47 - k, 8, CLOUD[:3], seed=12 + k, lobes=5, parity=k)
        # swirl lines inside the cloud
        c.arc(CX, 38, 10 + k * 2, 200 + k * 50, 300 + k * 50, 'q1', 1)
        c.arc(CX, 40, 6 + k, 20 + k * 60, 120 + k * 60, 'q2', 1)
        stars(c, f)
    elif f == 7:
        for i in range(5):
            a = i * 2 * math.pi / 5 - math.pi / 2
            x, y = pol(CX, 36, 15, a)
            c.cloud(x, y, 10, CLOUD[:3], seed=20 + i, lobes=6, parity=i)
        stars(c, f)
    elif f == 8:
        for i in range(5):
            a = i * 2 * math.pi / 5 - math.pi / 2 + 0.3
            x, y = pol(CX, 33, 21, a)
            c.dring(x, y, 7, 'q2', parity=i)
            c.cloud(x, y, 5, ['q1', 'q2', 'q3'], seed=40 + i, lobes=5)
        stars(c, f)
    elif f == 9:
        for i in range(5):
            a = i * 2 * math.pi / 5 - math.pi / 2 + 0.55
            x, y = pol(CX, 30, 26, a)
            c.disc(x, y, 2, 'q1')
            c.dring(x, y, 4, 'q2', parity=i)
        c.spark(CX + 8, 16, 1, 'l')


if __name__ == '__main__':
    run(globals())

