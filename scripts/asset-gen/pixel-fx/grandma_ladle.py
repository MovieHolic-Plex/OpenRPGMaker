"""grandma_ladle: 국자 후려치기: 국자가 옆에서 휘둘러 머리를 탁 치고 국물 방울이 튄다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'grandma_ladle', 64, 8, 'target'
PAL = pal(pick(EARTHB, 'd0', 'd1', 'd2', 'd3'), pick(GOLDY, 'y1', 'y2', 'y3'), pick(EMBER, 'm2', 'm3'), WHITE)


def ladle(c, x, y, a):
    ux, uy = math.cos(a), math.sin(a)
    end = (x + ux * 20, y + uy * 20)
    c.line([(x, y), end], 'd0', 3)
    c.line([(x, y), end], 'd2', 1)
    c.disc(x, y, 4, 'd0')
    c.disc(x, y, 3, 'd1')
    c.oval(x, y - 1, 2, 1, 'y2')


def draw(c, f):
    pos = [(50, 12, -.2), (42, 16, .3), (32, 22, .6), (28, 24, .7), (26, 26, .9), (24, 30, 1.1), (22, 34, 1.3), (20, 38, 1.4)][f]
    if f <= 5:
        ladle(c, *pos)
    if f <= 2:
        c.arc(56, 36, 26, 3.4, 4.1 + f * .1, 'd3', 1)
    if f == 3:
        pow_burst(c, 30, 24, 9, ['d1', 'y2', 'y3', 'w'], n=8)
    if f >= 3:
        drops(c, 30, 24, (f - 3) / 5, 10, 5, ['y2', 'y1', 'm3'], spd=(6, 18))
        for i in range(3):
            a2 = i * 2.1 + f * .8
            c.spark(30 + math.cos(a2) * 8, 16 + math.sin(a2) * 3, 1, 'w', 'y3')


if __name__ == '__main__':
    run(globals())

