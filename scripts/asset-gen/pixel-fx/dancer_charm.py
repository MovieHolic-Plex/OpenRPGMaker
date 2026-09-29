"""dancer_charm: 매혹의 눈짓: 분홍 하트가 머리 위를 나선으로 돌고 최면 소용돌이와 반짝임이 번진다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'dancer_charm', 64, 8, 'target'
PAL = pal(ROSE, pick(PURP, 'v2', 'v3'), pick(GOLDY, 'y2'), WHITE)
HX, HY = 32, 20


def draw(c, f):
    if f == 0:
        c.spark(HX - 4, HY + 2, 5, 'w', 'p3', diag=True)
        c.spark(HX + 5, HY - 3, 3, 'p3', 'p2')
    if 1 <= f <= 6:
        n = 5
        for i in range(n):
            a = f * .75 + i * 2 * math.pi / n
            rr = 10 + f * 2.2 + (i % 2) * 3
            x, y = HX + math.cos(a) * rr, HY + math.sin(a) * rr * .45 - f * 1.6 + (i % 3) * 2
            s = 2.4 + (i % 2) * .8
            heart(c, x, y, s, 'p2' if i % 2 else 'p3', ol='p0')
    if 2 <= f <= 5:
        spiral(c, HX, HY + 8, 11 + f, 2.2, 'v3', rot=f * 1.1, squash=.65, w=1)
        spiral(c, HX, HY + 8, 9 + f, 2.2, 'p2', rot=f * 1.1 + 1.6, squash=.65, w=1)
    if f in (1, 2, 3):
        c.ring(HX, HY + 6, 6 + f * 4, 'p3', 1, squash=.7)
    if f == 7:
        dissolve(c, .0)
        for i in range(6):
            heart(c, 14 + i * 7, 12 + (i * 11) % 24, 2, 'p2', ol=None)
        dissolve(c, .5)
    for i in range(5):
        x = 10 + (i * 11 + f * 5) % 46
        y = 8 + (i * 13) % 40
        c.spark(x, y, 1 + (f + i) % 2, 'w', 'p3') if (f + i) % 3 == 0 else None


if __name__ == '__main__':
    run(globals())
