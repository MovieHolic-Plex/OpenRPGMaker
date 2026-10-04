"""priest_monk_lotus: 열반: 화면 아래 큰 연꽃이 피어나고 금빛 후광 속에서 거대한 손바닥이 내려와 빛이 퍼진다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'priest_monk_lotus', 128, 12, 'screen'
PAL = pal(pick(ROSE, 'p1', 'p2', 'p3'), pick(GOLDY, 'y0', 'y1', 'y2', 'y3'), pick(LEAFG, 'g1', 'g2'), WHITE)
OX, OY = 64, 64


def palm_shape(c, x, y, s):
    c.oval(x, y, 10 * s, 12 * s, 'y1')
    c.oval(x, y, 9 * s, 11 * s, 'y2')
    for i in range(4):
        fx_ = x - 7 * s + i * 4.6 * s
        c.rect(fx_ - 1.5 * s, y - 22 * s, fx_ + 1.5 * s, y - 8 * s, 'y2')
        c.line([(fx_ - 1.5 * s, y - 22 * s), (fx_ - 1.5 * s, y - 8 * s)], 'y1')
    c.disc(x, y, 2.5 * s, 'y3')


def draw(c, f):
    lvl = [.3, .55, .8, 1, 1, 1, 1, 1, 1, 1, .7, .35][f]
    shade(c, OX, OY, 50 * lvl + 12, 'y0', squash=.8, dense='y0')
    o = min(1, f / 5)
    c.oval(OX, 104, 34 * o + 4, 5, 'g1')
    c.oval(OX, 103, 28 * o + 2, 3, 'g2')
    for i in range(9):
        a = -math.pi / 2 + (i - 4) * .3 * (.3 + .7 * o)
        L = (14 + (i % 2) * 4) * (.4 + .6 * o)
        c.petal(OX + math.cos(a) * L * .45, 98 + math.sin(a) * L * .45, a, L, 'p2' if i % 2 else 'p1', 'p3')
    c.disc(OX, 97, 3 * o + 1, 'y2')
    if f >= 3:
        c.ring(OX, 44, 18 + (f - 3) * 2, 'y2')
        c.rays(OX, 44, 16, 20 + f, 30 + f * 2, 'y1', rot=f * .08)
    if f >= 5:
        y = [0] * 5 + [10, 22, 34, 40, 42, 42, 42]
        palm_shape(c, OX, y[f], 1.3)
    if f in (8, 9):
        c.disc(OX, 60, 12 + (f - 8) * 10, 'y3')
        c.disc(OX, 60, 6 + (f - 8) * 6, 'w')
    if f >= 10:
        dissolve(c, (f - 9) * .3)


if __name__ == '__main__':
    run(globals())

