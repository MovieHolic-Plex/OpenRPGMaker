"""scholar_analyze: 약점 간파: 돋보기 조준 고리가 대상 위를 훑다가 한 점에 멈추고, 붉은 약점 표식과 화살표가 뜬다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'scholar_analyze', 64, 10, 'target'
PAL = pal(pick(ICEB, 'i0', 'i1', 'i2', 'i3', 'i4'), pick(EMBER, 'm1', 'm2', 'm3'), pick(PAPER, 'n1', 'n2'), WHITE)
TX, TY = 30, 30


def lens(c, x, y, r):
    c.ring(x, y, r + 1, 'i0', 1)
    c.ring(x, y, r, 'i3', 1)
    c.px(x - r * .5, y - r * .5, 'w')
    c.px(x - r * .5 + 1, y - r * .5, 'i4')
    hx, hy = x + r * .72, y + r * .72
    c.line([(hx, hy), (hx + 7, hy + 7)], 'n1', 3)
    c.line([(hx, hy), (hx + 7, hy + 7)], 'n2', 1)


def draw(c, f):
    path = [(46, 18), (40, 42), (22, 40), (20, 22), (30, 30), (30, 30), (30, 30), (30, 30), (30, 30), (30, 30)]
    x, y = path[f]
    if f <= 4:
        c.dline((path[max(0, f - 1)][0], path[max(0, f - 1)][1]), (x, y), 'i2')
        lens(c, x, y, 7)
    else:
        r = [None] * 5 + [12, 9, 7, 7, 7][f - 5:f - 4]
        r = [12, 9, 7, 7, 7][f - 5]
        tick_ring(c, TX, TY, r, 8, 'i3', rot=f * .2, L=2)
        c.line([(TX - r - 5, TY), (TX - 2, TY)], 'i2')
        c.line([(TX + 2, TY), (TX + r + 5, TY)], 'i2')
        c.line([(TX, TY - r - 5), (TX, TY - 2)], 'i2')
        c.line([(TX, TY + 2), (TX, TY + r + 5)], 'i2')
        if f >= 6:
            c.diamond(TX, TY, 2, 2, 'm2')
            c.px(TX, TY, 'm3')
        if f >= 7:
            ox = [0, 0, 0, 0, 0, 0, 0, 0, 2, 4][f]
            for dx in (-14, 14):
                c.line([(TX + dx, 44 + ox), (TX + dx, 52 + ox)], 'm2', 2)
                c.poly([(TX + dx - 3, 52 + ox), (TX + dx + 3, 52 + ox), (TX + dx, 56 + ox)], 'm2')
            c.spark(TX, TY, 5 if f == 7 else 3, 'w', 'm3')
        if f == 9:
            dissolve(c, .5)


if __name__ == '__main__':
    run(globals())

