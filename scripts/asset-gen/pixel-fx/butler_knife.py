"""butler_knife: 은식기 투척: 왼쪽으로 날며 도는 은 나이프(4칸 루프)"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'butler_knife', 32, 4, 'projectile'
PAL = pal(pick(STEELB, 'b0', 'b1', 'b2', 'b3'), pick(GOLDY, 'y2'), WHITE)


def draw(c, f):
    a = math.pi + f * math.pi / 2 * .5
    x, y = 14, 16
    ux, uy = math.cos(a), math.sin(a)
    tip = (x + ux * 7, y + uy * 7)
    tail = (x - ux * 6, y - uy * 6)
    vx, vy = -uy, ux
    c.poly([tip, (x + vx * 1.5, y + vy * 1.5), (x - vx * 1.5, y - vy * 1.5)], 'b2', outline='b0')
    c.line([(x, y), tail], 'b1', 2)
    c.px(*tail, 'y2')
    c.line([(x, y), tip], 'b3')
    c.px(*tip, 'w')
    c.line([(20, 13 + f % 2), (29, 13 + f % 2)], 'b2')
    c.line([(22, 19 - f % 2), (30, 19 - f % 2)], 'b1')


if __name__ == '__main__':
    run(globals())

