"""flower_girl_petal_heal: 꽃잎 치유: 분홍 꽃잎이 나선으로 감싸 오르며 초록 십자와 반짝임이 피어난다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'flower_girl_petal_heal', 64, 8, 'target'
PAL = pal(ROSE, pick(LEAFG, 'g2', 'g3'), pick(GOLDY, 'y2', 'y3'), WHITE)


def cross(c, x, y, s, k, ol):
    c.rect(x - s, y - 1, x + s, y + 1, ol)
    c.rect(x - 1, y - s, x + 1, y + s, ol)
    c.rect(x - s + 1, y, x + s - 1, y, k)
    c.rect(x, y - s + 1, x, y + s - 1, k)


def draw(c, f):
    lvl = [.3, .6, 1, 1, 1, 1, .7, .4][f]
    for i in range(14):
        u = (i / 14 + f * .07) % 1
        a = u * 6.6 + i * .9
        r = 14 * lvl * (1 - u * .3)
        x, y = CX + math.cos(a) * r, 52 - u * 42 + math.sin(a) * r * .35
        c.petal(x, y, a + 1.2, 4 + (i % 2), 'p2' if i % 3 else 'p3', 'p4')
    if f >= 2:
        cross(c, CX, 26 - (f - 2) * 3, 5, 'g3', 'g2')
    if 3 <= f <= 6:
        cross(c, CX - 11, 40 - (f - 3) * 3, 3, 'g3', 'g2')
        cross(c, CX + 12, 34 - (f - 3) * 3, 3, 'g3', 'g2')
    for i in range(6):
        c.spark(12 + (i * 9 + f * 3) % 42, 50 - ((f * 6 + i * 9) % 42), 2 if i % 2 else 1, 'w', 'y3') if (i + f) % 2 == 0 else None
    c.dring(CX, 56, 10 + lvl * 6, 'p2', squash=.3, parity=f)


if __name__ == '__main__':
    run(globals())
