"""priest_monk_bell: 범종: 적진 위에 큰 범종이 나타나 흔들리며 울리고 동심원 음파가 적 전체를 덮친다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'priest_monk_bell', 64, 10, 'allTargets'
PAL = pal(pick(GOLDY, 'y0', 'y1', 'y2', 'y3'), pick(EARTHB, 'd0', 'd1'), WHITE)


def bell(c, x, y, a):
    pts = rot_pts([(x - 5, y - 9), (x + 5, y - 9), (x + 9, y + 7), (x - 9, y + 7)], x, y - 9, a)
    c.poly(pts, 'y1', outline='y0')
    c.line(rot_pts([(x - 7, y + 1), (x + 7, y + 1)], x, y - 9, a), 'y2')
    c.line(rot_pts([(x - 3, y - 6), (x - 3, y + 4)], x, y - 9, a), 'y3')
    c.rect(x - 2, y - 12, x + 2, y - 10, 'd1')


def draw(c, f):
    a = [0, 0, .2, -.2, .15, -.12, .08, -.05, 0, 0][f]
    bell(c, CX, 16, a)
    if f <= 1:
        dissolve(c, .7 - f * .3)
    for j in range(3):
        r = (f - 2 - j * 1.5) * 6
        if 4 < r < 30:
            c.ring(CX, 20, r, 'y2' if j == 0 else 'y1', squash=.7)
            c.dring(CX, 24, r + 3, 'y0', parity=j, squash=.7)
    if f in (2, 4):
        c.spark(CX + 10, 22, 3, 'w', 'y3')
    if f == 9:
        dissolve(c, .4)


if __name__ == '__main__':
    run(globals())

