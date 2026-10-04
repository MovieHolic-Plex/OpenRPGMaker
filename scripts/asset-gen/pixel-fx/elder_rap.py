"""elder_rap: 지팡이 꿀밤: 지팡이 끝이 이마를 딱 치고 혹이 부풀며 작은 별이 돈다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'elder_rap', 64, 8, 'target'
PAL = pal(pick(EARTHB, 'd0', 'd1', 'd2', 'd3'), pick(ROSE, 'p1', 'p2', 'p3'), pick(GOLDY, 'y2', 'y3'), WHITE)
HX, HY = 30, 20


def cane(c, a):
    tip = (HX + 2, HY - 2)
    ux, uy = math.cos(a), math.sin(a)
    end = (tip[0] + ux * 26, tip[1] + uy * 26)
    c.line([tip, end], 'd0', 3)
    c.line([tip, end], 'd2', 1)
    c.disc(*end, 2, 'd3')


def draw(c, f):
    a = [-1.3, -.9, -.5, -.35, -.4, -.55, -.8, -1.1][f]
    if f <= 5:
        cane(c, a)
    if f <= 1:
        c.arc(HX + 2, HY - 2, 20, a - .5, a, 'd3')
    if f == 2:
        pow_burst(c, HX, HY, 8, ['d1', 'y2', 'y3', 'w'], n=7)
    if f >= 3:
        b = [0, 0, 0, 2, 3, 4, 4, 3][f]
        c.disc(HX - 1, HY - 3 - b * .4, b, 'p1')
        c.disc(HX - 1, HY - 3 - b * .5, b - 1, 'p2')
        c.px(HX - 2, HY - 4 - b * .5, 'p3')
        for i in range(3):
            a2 = i * 2.1 + f * .8
            c.spark(HX + math.cos(a2) * 9, HY - 8 + math.sin(a2) * 3, 2, 'w', 'y2')


if __name__ == '__main__':
    run(globals())

