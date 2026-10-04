"""scholar_library: 대도서관: 화면에 서가가 솟고 수십 권 책이 열려 날아오르며 책장 사이로 금빛 지식이 쏟아진다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'scholar_library', 128, 12, 'screen'
PAL = pal(pick(EMBER, 'm0', 'm1'), pick(PAPER, 'n0', 'n1', 'n2', 'n3'), pick(GOLDY, 'y1', 'y2', 'y3'), pick(ICEB, 'i0', 'i2', 'i3'), WHITE)
OX, OY = 64, 66


def shelf(c, x0, x1, y, h, seed):
    r = rng(seed)
    c.rect(x0, y, x1, y + 1, 'n0')
    x = x0 + 1
    while x < x1 - 2:
        w = r.choice((2, 3, 3, 4))
        hh = h - r.choice((0, 1, 2))
        k = r.choice(('m1', 'i0', 'n1', 'y1'))
        c.rect(x, y - hh, min(x + w - 1, x1), y - 1, k)
        c.px(x, y - hh + 1, 'y2' if k != 'y1' else 'n3')
        x += w + (1 if r.random() < .3 else 0)


def draw(c, f):
    lvl = [.3, .6, .9, 1, 1, 1, 1, 1, 1, 1, .7, .35][f]
    shade(c, OX, OY, 50 * lvl + 12, 'i0', squash=.8, dense='i0')
    rise = min(1, f / 3)
    for j in range(4):
        y = int(100 - j * 18 - (1 - rise) * 30)
        if y < 20:
            continue
        shelf(c, 20, 44, y, 10, j * 3 + 1)
        shelf(c, 84, 108, y, 10, j * 3 + 2)
    if f >= 3:
        for i in range(10):
            a = i * .63 + f * .22
            d = 12 + ((f - 3) * 5 + i * 7) % 40
            x, y = OX + math.cos(a) * d * .8, OY - 8 + math.sin(a) * d * .5 - (f - 3) * 2
            book(c, x, y - 3, 4, 4, 'm1', 'n2', 'n1', spread=.6 + .4 * ((i + f) % 2))
    if 4 <= f <= 10:
        beam(c, OX, 6, OX, OY + 30, 6, 22 + (f % 2) * 2, 'y3', 'y1', phase=f * 2, stripes=4)
        for i in range(12):
            x = OX - 22 + (i * 11 + f * 3) % 46
            y = 10 + (i * 17 + f * 9) % 80
            glyph(c, x, y, 'a+=o7pS'[i % 7], 'y2' if i % 2 else 'n3')
    if f in (6, 8):
        c.spark(OX, OY, 10, 'w', 'y3', diag=True)


if __name__ == '__main__':
    run(globals())

