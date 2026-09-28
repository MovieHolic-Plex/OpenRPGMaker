"""scout_backstab: 그림자 습격 (착탄). The scout surfaces from shadow behind the enemy (left) and thrusts through it.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'scout_backstab', 64, 8, 'target'
PAL = pal(SHADOW, CRIMSON, pick(STEEL, 's2'), WHITE)
CX, CY = 32, 36


def shards(c, dist, size, seed, spread=0.8, drop=0):
    r = rng(seed)
    for i in range(9):
        a = r.uniform(-spread, spread)
        d = dist + r.uniform(-3, 3)
        x, y = CX + math.cos(a) * d, CY + math.sin(a) * d + drop * (i % 3)
        tail = (x - math.cos(a) * size, y - math.sin(a) * size)
        c.line([tail, (x, y)], 'r1' if i % 3 else 'r2', 2 if size > 3 else 1)
        c.px(x, y, 'w')


def draw(c, f):
    if f == 0:
        c.puff(12, 38, 8, ['k', 'd', 'm'], seed=4, lobes=4)
        c.px(13, 34, 'r2')
        c.px(16, 34, 'r2')
        c.dring(12, 38, 11, 'v')
    elif f == 1:
        c.puff(13, 38, 10, ['k', 'd', 'm', 'v'], seed=5, lobes=5)
        c.line([(19, 22), (19, 44)], 'r1', 3)
        c.line([(19, 22), (19, 42)], 'w')
        c.spark(19, 22, 3, 'w', 'r2')
    elif f == 2:
        c.puff(8, 40, 7, ['d', 'm'], seed=6, lobes=3)
        c.streak((4, 38), (48, 34), [('d', 7), ('v', 5), ('l', 3), ('w', 1)])
        c.spark(48, 34, 7, 'w', 'r2', diag=True)
        c.ring(CX, CY, 6, 'r1', 1)
    elif f == 3:
        c.line([(CX - 13, CY - 13), (CX + 13, CY + 13)], 'r1', 5)
        c.line([(CX - 13, CY + 13), (CX + 13, CY - 13)], 'r1', 5)
        c.line([(CX - 12, CY - 12), (CX + 12, CY + 12)], 'w', 2)
        c.line([(CX - 12, CY + 12), (CX + 12, CY - 12)], 'w', 2)
        c.ring(CX, CY, 9, 'r2', 1)
        c.spark(CX, CY, 17, 'w', 'l')
        c.disc(CX, CY, 3, 'w')
    elif f == 4:
        c.ring(CX, CY, 14, 'r1', 2)
        c.ring(CX, CY, 12, 'r2', 1)
        c.line([(4, 38), (28, 35)], 'm', 1)
        shards(c, 18, 5, 1)
        c.spark(CX, CY, 5, 'w', 'r2')
    elif f == 5:
        c.dring(CX, CY, 19, 'r1')
        c.dring(CX, CY, 18, 'r0', 1)
        shards(c, 24, 3, 2, drop=1)
        c.line([(6, 38), (20, 36)], 'd')
    elif f == 6:
        c.dring(CX, CY, 23, 'r0')
        r = rng(9)
        for i in range(7):
            x, y = CX + r.randint(6, 26), CY + r.randint(-8, 16)
            c.line([(x, y), (x, y + 2)], 'r1')
    elif f == 7:
        r = rng(11)
        for i in range(5):
            c.spark(CX + r.randint(4, 26), CY + r.randint(-6, 18), 1, 'r2')


if __name__ == '__main__':
    run(globals())

