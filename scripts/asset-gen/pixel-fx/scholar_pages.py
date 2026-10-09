"""scholar_pages: 책장 베기: 흩어진 책장들이 칼날처럼 날아와 대상을 X 자로 가르고 종이 조각이 흩어진다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'scholar_pages', 64, 8, 'target'
PAL = pal(PAPER, pick(ICEB, 'i1', 'i2', 'i3'), WHITE)


def draw(c, f):
    t = f / 7
    if f <= 3:
        for i in range(5):
            a = i * 1.26 + f * .3
            d = 26 - f * 7
            x, y = CX + math.cos(a) * d, 32 + math.sin(a) * d * .7
            page(c, x, y, a + f, 3, 'n2', 'n0', 'n1')
            c.line([(x, y), (x + math.cos(a) * 5, y + math.sin(a) * 4)], 'i2')
    if 2 <= f <= 5:
        k = [None, None, ['i1', 'i3'], ['i1', 'i2', 'i3', 'w'], ['i1', 'i2', 'n3'], ['i1', 'n2']][f]
        c.lens((14, 14), (50, 50), 3 if f != 3 else 4, k)
        if f >= 3:
            c.lens((50, 14), (14, 50), 3, k)
    if f == 3:
        c.spark(CX, 32, 7, 'w', 'i3', diag=True)
    if f >= 4:
        r = rng(3)
        for i in range(10):
            a = r.uniform(0, 2 * math.pi)
            d = 6 + (f - 3) * r.uniform(4, 7)
            x, y = CX + math.cos(a) * d, 32 + math.sin(a) * d * .8 + (f - 4) * 2
            if f == 7 and i % 2:
                continue
            page(c, x, y, a * 2 + f, 1.6 if i % 3 else 2.2, 'n3' if i % 2 else 'n2', 'n1')


if __name__ == '__main__':
    run(globals())

