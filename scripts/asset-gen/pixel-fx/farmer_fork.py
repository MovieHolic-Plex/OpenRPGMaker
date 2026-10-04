"""farmer_fork: 쇠스랑 찌르기: 세 갈래 쇠스랑이 오른쪽에서 왼쪽으로 찔러 들어가 세 줄 자국과 짚 부스러기가 남는다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'farmer_fork', 64, 8, 'target'
PAL = pal(pick(STONE, 'r0', 'r2', 'r3'), pick(EARTHB, 'd1', 'd2', 'd3'), pick(GOLDY, 'y1', 'y2', 'y3'), WHITE)
TY = 32


def fork(c, x, y):
    c.line([(x + 8, y), (x + 40, y)], 'd1', 3)
    c.line([(x + 8, y - 1), (x + 40, y - 1)], 'd2')
    c.line([(x + 8, y - 6), (x + 8, y + 6)], 'r0', 2)
    for dy in (-6, 0, 6):
        c.line([(x, y + dy), (x + 8, y + dy)], 'r2')
        c.px(x, y + dy, 'r3')


def draw(c, f):
    x = [52, 36, 20, 16, 18, 22, 30, 40][f]
    if f <= 5:
        fork(c, x, TY)
    if f <= 2:
        for dy in (-6, 0, 6):
            c.line([(x + 10, TY + dy), (x + 22, TY + dy)], 'y3')
    if f == 3:
        for dy in (-6, 0, 6):
            c.spark(16, TY + dy, 3, 'w', 'y2')
    if f >= 3:
        L = min(20, (f - 2) * 7)
        for dy in (-6, 0, 6):
            c.line([(18, TY + dy), (18 + L, TY + dy)], 'y2' if f < 6 else 'y1')
        burst(c, 20, TY, (f - 3) / 4, 10, 3, ['y3', 'y2', 'd3'], spd=(4, 16), grav=1.2)
    if f == 7:
        dissolve(c, .4)


if __name__ == '__main__':
    run(globals())

