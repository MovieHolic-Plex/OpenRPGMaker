"""butler_cutlery: 식기 난무: 포크와 나이프가 번갈아 대상에 꽂히며 은빛 X 자국이 쌓인다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'butler_cutlery', 64, 10, 'target'
PAL = pal(pick(STEELB, 'b0', 'b1', 'b2', 'b3'), pick(GOLDY, 'y2', 'y3'), WHITE)
HITS = [(26, 22, -.5), (36, 30, .5), (24, 38, -.3), (38, 18, .6), (30, 32, 0)]


def fork(c, x, y, a):
    ux, uy = math.cos(a), math.sin(a)
    vx, vy = -uy, ux
    c.line([(x, y), (x + ux * 10, y + uy * 10)], 'b1', 2)
    for s in (-1.5, 0, 1.5):
        c.line([(x + vx * s, y + vy * s), (x - ux * 4 + vx * s, y - uy * 4 + vy * s)], 'b3')


def knife(c, x, y, a):
    ux, uy = math.cos(a), math.sin(a)
    c.line([(x, y), (x + ux * 10, y + uy * 10)], 'b0', 2)
    c.line([(x - ux * 5, y - uy * 5), (x, y)], 'b3', 2)
    c.px(x - ux * 5, y - uy * 5, 'w')


def draw(c, f):
    for i, (x, y, a) in enumerate(HITS):
        age = f - i * 2
        if age < 0:
            continue
        if age < 5:
            (fork if i % 2 else knife)(c, x, y, a + .4)
        if age == 0:
            c.spark(x, y, 4, 'w', 'b3')
        elif age <= 6:
            c.line([(x - 2, y - 2), (x + 2, y + 2)], 'b2')
            c.line([(x - 2, y + 2), (x + 2, y - 2)], 'b2')
    if f == 9:
        pow_burst(c, 30, 30, 8, ['b1', 'y2', 'w'], n=8)


if __name__ == '__main__':
    run(globals())

