"""scholar_smack: 두꺼운 책 강타: 두꺼운 가죽 사전이 위에서 내려와 대상 머리를 쾅 내려치고 별이 돈다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'scholar_smack', 64, 8, 'target'
PAL = pal(pick(EMBER, 'm0', 'm1', 'm2'), pick(PAPER, 'n0', 'n2', 'n3'), pick(GOLDY, 'y1', 'y2', 'y3'), WHITE)


def draw(c, f):
    pos = [(46, 4, -.9), (40, 10, -.5), (34, 18, -.1), (32, 20, 0), (32, 19, 0), (33, 16, .15), (34, 14, .25), (34, 13, .3)][f]
    x, y, a = pos
    if f <= 6:
        closed_book(c, x, y, 9, 6, a, 'm1', 'm0', 'n2')
        c.line(rot_pts([(x - 5, y - 3), (x + 5, y - 3)], x, y, a), 'y2')
    if f <= 2:
        for j in range(3):
            c.line([(x + 8 + j * 3, y - 10 + j * 2), (x + 12 + j * 3, y - 16 + j * 2)], 'n3')
    if f == 3:
        pow_burst(c, 32, 30, 12, ['m1', 'y2', 'y3', 'w'], rot=.2, n=9)
    if 4 <= f:
        for i in range(4):
            a2 = i * math.pi / 2 + f * .7
            sx, sy = 32 + math.cos(a2) * 11, 24 + math.sin(a2) * 4
            c.spark(sx, sy, 2, 'w', 'y2')
    if f == 4:
        c.ring(32, 30, 12, 'y3', squash=.5)
    if f == 5:
        c.dring(32, 30, 16, 'y2', squash=.5)


if __name__ == '__main__':
    run(globals())

