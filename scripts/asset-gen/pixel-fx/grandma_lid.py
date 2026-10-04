"""grandma_lid: 냄비 뚜껑: 냄비 뚜껑이 빙글빙글 원반처럼 날아와 대상을 땡 치고 튕겨 나간다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'grandma_lid', 64, 8, 'target'
PAL = pal(pick(STONE, 'r0', 'r1', 'r2', 'r3'), pick(GOLDY, 'y2', 'y3'), WHITE)


def lid(c, x, y, sq):
    c.oval(x, y, 8, 8 * sq + .5, 'r0')
    c.oval(x, y, 7, 7 * sq, 'r2')
    c.oval(x - 1, y - sq * 2, 4, 3 * sq, 'r3')
    c.disc(x, y - 1 - sq * 2, 1.4, 'r1')


def draw(c, f):
    path = [(60, 24), (48, 26), (36, 28), (30, 30), (38, 22), (46, 14), (54, 8), (60, 4)]
    x, y = path[f]
    sq = [.3, .6, .9, .5, .2, .6, 1, .4][f]
    if f <= 2:
        c.line([(x + 9, y), (x + 18, y)], 'r3')
        c.line([(x + 9, y + 2), (x + 15, y + 2)], 'r2')
    if f == 3:
        pow_burst(c, 28, 30, 10, ['r1', 'y2', 'y3', 'w'], n=8)
        for r in (12, 16):
            c.arc(28, 30, r, -2.6, -2.0, 'y3')
    lid(c, x, y, sq)
    if f >= 4:
        c.spark(28, 30, [0, 0, 0, 0, 4, 3, 2, 1][f], 'w', 'y2')


if __name__ == '__main__':
    run(globals())

