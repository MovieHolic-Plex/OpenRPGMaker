"""priest_monk_vajra: 금강신: 몸 둘레에 금빛 후광 고리가 솟고 금강저 문양이 앞에 떠올라 단단한 금빛 막이 굳는다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'priest_monk_vajra', 64, 10, 'user'
PAL = pal(pick(GOLDY, 'y0', 'y1', 'y2', 'y3'), pick(EMBER, 'm2', 'm3'), WHITE)


def vajra(c, x, y, s):
    c.line([(x, y - s), (x, y + s)], 'y2', 2)
    for d in (-1, 1):
        c.arc(x, y + d * s * .6, s * .5, math.pi * (1 if d < 0 else 0), math.pi * (2 if d < 0 else 1), 'y3')
        c.px(x, y + d * s, 'w')
    c.disc(x, y, 1.5, 'm3')


def draw(c, f):
    o = [.2, .4, .6, .8, 1, 1, 1, 1, .9, .8][f]
    c.ring(CX, 18, 8 * o + 2, 'y2')
    c.rays(CX, 18, 12, 8 * o + 3, 10 * o + 6, 'y1', rot=f * .1)
    if f >= 2:
        c.oval(CX, 38, 14 * o, 18 * o, 'y0', w=1)
    if f >= 4:
        c.dring(CX, 38, 16, 'y2', parity=f, squash=1.2)
        vajra(c, CX - 14, 34, 6)
    if f in (5, 7):
        c.spark(CX + 12, 26, 4, 'w', 'y3')
    c.dring(CX, FEET, 12 + f, 'y1', squash=.3, parity=f)


if __name__ == '__main__':
    run(globals())

