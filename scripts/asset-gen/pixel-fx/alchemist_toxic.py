"""alchemist_toxic: 독무: 보랏빛 독 안개가 소용돌이치며 피어오르고 작은 해골 거품이 떠올라 터진다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'alchemist_toxic', 64, 10, 'allTargets'
PAL = pal(pick(PURP, 'v0', 'v1', 'v2', 'v3'), pick(LEAFG, 'g1', 'g2', 'g3'), pick(BONE, 'o2'), WHITE)
OX, OY = 32, 40


def draw(c, f):
    lvl = [.3, .55, .8, 1, 1, 1, 1, .85, .6, .35][f]
    R = 22 * lvl
    for i in range(6):
        a = f * .45 + i * math.pi / 3
        x, y = pol(OX, OY, R * .55, a, .55)
        c.cloud(x, y - 3 - (i % 2) * 3, 9 * lvl + 3, ['v0', 'v1', 'v2', 'v3'], i + (f // 4), parity=f % 2)
    c.cloud(OX, OY - 6, 12 * lvl + 3, ['g1', 'g2', 'g3'], 9, parity=(f + 1) % 2) if 1 <= f <= 8 else None
    for i in range(5):
        x = 14 + (i * 11) % 38
        y = 50 - ((f * 6 + i * 9) % 44)
        if 2 <= f <= 8 and y > 8:
            if i % 2 == 0:
                skull(c, x, y, 'o2', 'v0')
            else:
                bubble(c, x, y, 2, 'g3')
    if f >= 3:
        c.dring(OX, 56, 16 + f, 'v2', squash=.3, parity=f)


if __name__ == '__main__':
    run(globals())
