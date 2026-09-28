"""flower_girl_bouquet_hit: 꽃다발 착탄: 꽃다발이 터지며 분홍·노랑 꽃잎이 사방으로 흩날려 떨어진다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'flower_girl_bouquet_hit', 64, 8, 'target'
PAL = pal(ROSE, pick(GOLDY, 'y2', 'y3'), pick(LEAFG, 'g2', 'g3'), WHITE)
IX, IY = 32, 34


def draw(c, f):
    if f == 0:
        c.spark(IX, IY, 7, 'w', 'p3', diag=True)
        star(c, IX, IY, 8, 9, 4, 'p2', rot=.2)
        c.disc(IX, IY, 2, 'w')
    elif f <= 3:
        k = f - 1
        star(c, IX, IY, 8, 10 - k * 2, 4, 'p3', rot=.2)
        burst_petals(c, IX, IY, 14, 10 + k * 8, f, drop=k * 3, L=5, keys=('p1', 'p2', 'p3', 'y2'), hi='p4')
        c.ring(IX, IY, 8 + k * 6, 'p3', 1)
    else:
        k = f - 4
        burst_petals(c, IX, IY, 12, 26 + k * 3, 3 + k, drop=6 + k * 8, L=4.5, keys=('p1', 'p2', 'p3', 'y2'), hi='p4')
        for i in range(4):
            c.petal(12 + i * 13, 10 + k * 8 + (i * 5) % 14, i + k, 4, 'g2', 'g3')
        if k >= 2:
            dissolve(c, .3 * (k - 1))


if __name__ == '__main__':
    run(globals())
