"""flower_girl_wreath: 화관: 꽃 화관이 내려앉아 빛 고리가 번지고 흰 나비 같은 빛이 피어오르며 생명이 돌아온다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'flower_girl_wreath', 64, 10, 'target'
PAL = pal(ROSE, pick(LEAFG, 'g1', 'g2', 'g3'), pick(GOLDY, 'y2', 'y3'), WHITE)


def wreath(c, x, y, rx, ry, phase):
    n = 14
    for i in range(n):
        a = i * 2 * math.pi / n + phase
        px_, py_ = x + math.cos(a) * rx, y + math.sin(a) * ry
        if math.sin(a) < -.2 or True:
            c.disc(px_, py_, 1.8, 'g1')
            c.px(px_ + 1, py_ - 1, 'g2')
    for i in range(6):
        a = i * math.pi / 3 + phase * 1.4
        px_, py_ = x + math.cos(a) * rx, y + math.sin(a) * ry
        c.disc(px_, py_, 2.2, 'p2' if i % 2 else 'y2')
        c.px(px_ - 1, py_ - 1, 'p4')


def draw(c, f):
    if f <= 2:
        y = [4, 12, 20][f]
        wreath(c, CX, y, 10, 4, 0)
        c.line([(CX - 6, y + 4), (CX - 6, y + 12)], 'p3') if f else None
    elif f <= 5:
        k = f - 3
        wreath(c, CX, 22, 10, 4, k * .3)
        c.ring(CX, 22, 14 + k * 4, 'y3', 1, squash=.45)
        beam(c, CX, 26, CX, 58, 3, 10 + k * 3, 'y3', 'p3', phase=f * 3)
        for i in range(5):
            c.petal(CX - 14 + i * 7, 30 + ((k * 8 + i * 9) % 24), i + k, 4, 'p2' if i % 2 else 'p3', 'p4')
    else:
        k = f - 6
        wreath(c, CX, 22, 10, 4, k * .3 + 1)
        for i in range(3):
            butterfly_x = 14 + (i * 17 + k * 6) % 40
            c.oval(butterfly_x - 3, 30 - k * 4 - i * 4, 3, 2, 'w')
            c.oval(butterfly_x + 3, 30 - k * 4 - i * 4, 3, 2, 'w')
            c.px(butterfly_x, 30 - k * 4 - i * 4, 'g1')
        for i in range(6):
            c.spark(12 + (i * 9 + k * 3) % 42, 46 - ((k * 6 + i * 9) % 38), 2, 'w', 'y3')
        c.dring(CX, 57, 16 + k * 3, 'p2', squash=.3)
        dissolve(c, .12 * k)


if __name__ == '__main__':
    run(globals())
