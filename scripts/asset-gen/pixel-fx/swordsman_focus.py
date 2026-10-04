"""swordsman_focus: 심안: 눈 모양의 청백 원이 이마 앞에 열려 홍채가 좁혀들고 조준선이 번진다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'swordsman_focus', 64, 8, 'user'
PAL = pal(pick(ICEB, 'i0', 'i1', 'i2', 'i3', 'i4'), pick(GOLDY, 'y2', 'y3'), WHITE)
EX, EY = 28, 22


def eye(c, o, k0, k1, k2):
    w = 12 * o
    h = 6 * o
    c.oval(EX, EY, w, h, k0)
    c.oval(EX, EY, w - 1, max(1, h - 1), 'i1')
    c.oval(EX, EY, w * .5 + 1, max(1, h * .9), k2)
    c.oval(EX, EY, w * .3, max(1, h * .65), k1)
    c.px(EX - 1, EY - 1, 'w')


def draw(c, f):
    o = [.2, .5, .8, 1, 1, 1, .7, .3][f]
    if o > .15:
        eye(c, o, 'i3', 'i0', 'i3')
    if 2 <= f <= 5:
        r = [20, 16, 12, 9][f - 2]
        c.ring(EX, EY, r, 'i3', 1)
        c.line([(EX - r - 4, EY), (EX - r + 3, EY)], 'i4')
        c.line([(EX + r - 3, EY), (EX + r + 4, EY)], 'i4')
        c.line([(EX, EY - r - 4), (EX, EY - r + 3)], 'i4')
        c.line([(EX, EY + r - 3), (EX, EY + r + 4)], 'i4')
    if f in (3, 4):
        c.spark(EX, EY, 6, 'w', 'y3', diag=True)
    c.dring(CX, 56, 12 + f * 2, 'i2', squash=.3, parity=f)
    for i in range(5):
        c.px(12 + (i * 11 + f * 3) % 42, 50 - ((f * 6 + i * 9) % 42), 'i4')


if __name__ == '__main__':
    run(globals())
