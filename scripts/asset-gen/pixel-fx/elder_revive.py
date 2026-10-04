"""elder_revive: 되살림: 대상 위로 흰 손 두 개가 내려와 어깨를 흔들고, 빛 기둥이 솟으며 영혼 불꽃이 몸으로 돌아온다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'elder_revive', 64, 12, 'target'
PAL = pal(pick(GOLDY, 'y1', 'y2', 'y3'), pick(TEAL, 't1', 't2', 't3'), pick(PAPER, 'n1', 'n3'), WHITE)


def hand(c, x, y):
    c.disc(x, y, 3, 'n1')
    c.disc(x, y, 2, 'n3')
    for i in range(3):
        c.line([(x - 2 + i * 2, y + 2), (x - 2 + i * 2, y + 5)], 'n3')


def draw(c, f):
    if f <= 5:
        yy = [4, 10, 16, 18, 19, 18][f]
        shake = (f % 2) * 2 - 1 if f >= 3 else 0
        hand(c, 22 + shake, yy)
        hand(c, 42 + shake, yy)
    if 4 <= f <= 10:
        w = [0, 0, 0, 0, 4, 8, 12, 12, 10, 7, 4][f]
        beam(c, CX, 2, CX, FEET, w * .6, w, 'y3', 'y1', phase=f, stripes=3)
    if 5 <= f <= 9:
        t = (f - 5) / 4
        y = 8 + t * 26
        c.flame(CX, y + 4, 6, 2.2, ['t1', 't2', 't3'])
        c.px(CX, y, 'w')
    if f >= 9:
        c.spark(CX, 34, [0] * 9 + [7, 5, 3][f - 9:f - 8][0:1][0] if False else [7, 5, 3][f - 9], 'w', 'y3', diag=True)
        c.dring(CX, 40, 10 + (f - 9) * 5, 'y2', parity=f)


if __name__ == '__main__':
    run(globals())

