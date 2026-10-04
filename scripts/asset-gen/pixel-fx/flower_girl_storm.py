"""flower_girl_storm: 꽃보라: 분홍·흰 꽃잎 회오리가 적 둘레를 감아 오르고 바람 띠와 반짝임이 휘돈다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'flower_girl_storm', 64, 10, 'allTargets'
PAL = pal(ROSE, pick(LEAFG, 'g2', 'g3'), WHITE)
OX, OY = 32, 40


def draw(c, f):
    lvl = [.4, .7, 1, 1, 1, 1, 1, .9, .6, .35][f]
    for k in range(3):
        band(c, OX, OY + 6 - k * 8, 20 * lvl - k * 3, (20 * lvl - k * 3) * .38, f * 46 + k * 80, f * 46 + k * 80 + 150, 4, ['p1', 'p2', 'p4'])
    n = 26
    for i in range(n):
        u = i / n
        a = f * .6 + i * 2.4
        r = (4 + u * 20) * lvl
        x, y = OX + math.cos(a) * r, 56 - u * 44 * lvl + math.sin(a) * r * .38
        c.petal(x, y, a + 1.3, 3.5 + (i % 3) * .6, ['p1', 'p2', 'p3', 'w'][i % 4], 'p4' if i % 3 == 0 else None)
    for i in range(5):
        c.spark(10 + (i * 11 + f * 3) % 44, 10 + (i * 9 + f * 5) % 40, 1 + i % 2, 'w', 'g3') if (i + f) % 2 == 0 else None
    c.dring(OX, 56, 12 + f, 'p2', squash=.3, parity=f)


if __name__ == '__main__':
    run(globals())
