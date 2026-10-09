"""priest_monk_staff: 석장 치기: 금고리 석장이 위에서 내려쳐 고리가 짤랑 울리고 금빛 파문이 퍼진다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'priest_monk_staff', 64, 8, 'target'
PAL = pal(pick(GOLDY, 'y0', 'y1', 'y2', 'y3'), pick(EARTHB, 'd0', 'd1', 'd2'), WHITE)


def staff(c, x, y, a):
    ux, uy = math.cos(a), math.sin(a)
    end = (x + ux * 28, y + uy * 28)
    c.line([(x, y), end], 'd0', 3)
    c.line([(x, y), end], 'd2', 1)
    c.ring(x - ux * 3, y - uy * 3, 4, 'y2')
    c.ring(x - ux * 3 + 3, y - uy * 3 + 2, 2, 'y1')
    c.ring(x - ux * 3 - 3, y - uy * 3 + 2, 2, 'y1')


def draw(c, f):
    pos = [(40, 6, -.4), (36, 12, .1), (32, 20, .6), (30, 24, .9), (30, 24, .95), (31, 22, .9), (32, 20, .8), (33, 18, .75)][f]
    if f <= 6:
        staff(c, *pos)
    if f <= 2:
        c.arc(58, 34, 28, 3.4, 3.8 + f * .2, 'y3')
    if f == 3:
        pow_burst(c, 28, 24, 10, ['y0', 'y2', 'y3', 'w'], n=8)
    if f >= 3:
        for j in range(2):
            r = (f - 3) * 5 + j * 6
            if r > 2:
                c.ring(28, 24, r, 'y2' if j == 0 else 'y1', squash=.8)
    if f >= 5:
        for i in range(3):
            c.px(22 + i * 6, 12 - (f - 5) * 2 + i % 2 * 2, 'y3')


if __name__ == '__main__':
    run(globals())

