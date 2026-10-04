"""farmer_scarecrow: 허수아비: 적진 앞에 허수아비가 불쑥 솟아 팔을 벌리고, 까마귀가 흩어지며 적이 움츠러든다(아래 화살표)"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'farmer_scarecrow', 64, 8, 'allTargets'
PAL = pal(pick(EARTHB, 'd0', 'd1', 'd2'), pick(GOLDY, 'y1', 'y2', 'y3'), pick(EMBER, 'm1', 'm2'), pick(INKK, 'k0', 'k2'), WHITE)


def crow(c, x, y, flap):
    c.oval(x, y, 2, 1.2, 'k0')
    wy = -2 if flap else 1
    c.line([(x - 4, y + wy), (x, y), (x + 4, y + wy)], 'k0')
    c.px(x - 3, y - 1, 'y2')


def draw(c, f):
    h = [6, 14, 22, 26, 26, 26, 26, 26][f]
    base = 54
    top = base - h
    c.line([(32, base), (32, top)], 'd1', 2)
    if h > 12:
        c.line([(20, top + 8), (44, top + 8)], 'd1', 2)
        c.rect(26, top + 6, 38, top + 16, 'm1')
        c.line([(26, top + 11), (38, top + 11)], 'm2')
        for x in (20, 44):
            c.line([(x, top + 8), (x + (-2 if x < 32 else 2), top + 12)], 'y2')
        c.disc(32, top + 1, 4, 'y1')
        c.px(30, top, 'k0'); c.px(34, top, 'k0')
        c.line([(30, top + 3), (34, top + 3)], 'k0')
        c.poly([(25, top - 2), (39, top - 2), (32, top - 8)], 'd2')
    if f >= 3:
        for i in range(4):
            t = (f - 3) / 4
            x = 32 + (i - 1.5) * 10 + (i - 1.5) * t * 16
            y = top - 4 - t * 16 - i % 2 * 4
            crow(c, x, y, (f + i) % 2)
    if f >= 4:
        for dx in (-18, 18):
            yy = 30 + (f - 4) * 2
            c.line([(32 + dx, yy), (32 + dx, yy + 6)], 'm2', 2)
            c.poly([(32 + dx - 3, yy + 6), (32 + dx + 3, yy + 6), (32 + dx, yy + 10)], 'm2')


if __name__ == '__main__':
    run(globals())

