"""elder_wisdom: 노인의 지혜: 아군 머리 위에 두루마리가 펼쳐지고 은은한 부엉이 눈빛과 반짝이가 내려앉는다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'elder_wisdom', 64, 10, 'allAllies'
PAL = pal(PAPER, pick(GOLDY, 'y1', 'y2', 'y3'), pick(TEAL, 't1', 't2', 't3'), WHITE)


def scroll(c, x, y, w):
    c.rect(x - w, y - 4, x + w, y + 4, 'n2')
    c.line([(x - w, y - 4), (x + w, y - 4)], 'n1')
    c.line([(x - w, y + 4), (x + w, y + 4)], 'n1')
    for j in (-1, 2):
        c.line([(x - w + 3, y + j), (x + w - 3, y + j)], 'n1')
    for sx in (x - w - 1, x + w + 1):
        c.rect(sx - 1, y - 6, sx + 1, y + 6, 'n0')
        c.px(sx, y - 6, 'y2'); c.px(sx, y + 6, 'y2')


def draw(c, f):
    w = [1, 4, 8, 12, 14, 14, 14, 14, 12, 8][f]
    scroll(c, CX, 12, w)
    if f >= 3:
        glyph(c, CX - 5, 10, 'o', 't3')
        glyph(c, CX + 2, 10, 'o', 't3')
    if f >= 4:
        t = (f - 4) / 5
        for i in range(8):
            x = CX - 20 + i * 6
            y = 18 + t * 30 + (i % 3) * 4
            c.px(x, y, 'y3' if i % 2 else 't3')
            if i % 3 == 0:
                c.spark(x, y, 2, 'w', 'y2')
        c.dring(CX, FEET, 12 + f, 't2', squash=.3, parity=f)
    if f >= 8:
        dissolve(c, (f - 7) * .3)


if __name__ == '__main__':
    run(globals())

