"""butler_tea: 티타임: 대상 위에 찻주전자가 기울어 찻잔에 홍차를 따르고, 향긋한 김이 하트 모양으로 피어 치유한다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'butler_tea', 64, 10, 'target'
PAL = pal(pick(PAPER, 'n1', 'n2', 'n3'), pick(EARTHB, 'd1', 'd2', 'd3'), pick(ROSE, 'p2', 'p3'), pick(GOLDY, 'y2'), WHITE)


def pot(c, x, y, a):
    c.disc(x, y, 6, 'n1')
    c.disc(x, y, 5, 'n3')
    sp = rot_pts([(x - 5, y + 1), (x - 11, y - 3)], x, y, a)
    c.line(sp, 'n1', 2)
    c.arc(x + 6, y, 3, -1.4, 1.4, 'n1')
    c.rect(x - 2, y - 7, x + 2, y - 6, 'y2')
    c.px(x - 2, y - 2, 'w')
    return sp[1]


def draw(c, f):
    c.poly([(22, 44), (32, 44), (31, 49), (23, 49)], 'n3')
    c.line([(22, 44), (32, 44)], 'n1')
    c.arc(34, 46, 2, -1.4, 1.4, 'n1')
    c.oval(27, 51, 8, 1.5, 'n2')
    if f >= 3:
        c.line([(23, 45), (31, 45)], 'd2')
        bubble(c, 25 + f % 3 * 2, 44 - f % 2, 1, 'd3')
    if f <= 6:
        a = [0, .25, .45, .6, .65, .5, .2][f]
        tip = pot(c, 40 + [4, 2, 0, 0, 0, 1, 3][f], 24 - [4, 2, 0, 0, 1, 1, 2][f], -a)
        if 2 <= f <= 5:
            c.line([tip, (27, 44)], 'd2')
            c.line([(tip[0] + 1, tip[1]), (28, 44)], 'd3')
    if f >= 4:
        for j in range(3):
            steam(c, 24 + j * 3, 42, 8 + (f - 4) * 2, f * .5 + j, 'n2', amp=1)
    if f >= 6:
        heart(c, 27, 24 - (f - 6) * 2, 3, 'p2', ol='p3')
        c.spark(18, 20, 2 + f % 2, 'w', 'p3')
    if f == 9:
        dissolve(c, .4)


if __name__ == '__main__':
    run(globals())

