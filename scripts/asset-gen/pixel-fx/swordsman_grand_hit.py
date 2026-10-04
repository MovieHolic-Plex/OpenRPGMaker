"""swordsman_grand_hit: 천상 연참 착탄: 여러 방향의 청백 참격이 교차하며 별 모양 폭발이 일고 검광이 흩어진다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'swordsman_grand_hit', 64, 8, 'target'
PAL = pal(pick(ICEB, 'i0', 'i1', 'i2', 'i3', 'i4'), pick(GOLDY, 'y3'), WHITE)


def draw(c, f):
    L = [((4, 14), (60, 52)), ((60, 12), (4, 50)), ((32, 2), (32, 62)), ((2, 34), (62, 30)), ((12, 4), (52, 60))]
    for i, (p0, p1) in enumerate(L):
        age = f - i * .7
        if age < 0:
            continue
        if age < 1:
            c.lens(p0, p1, 5, ['i0', 'i2', 'i4', 'w'], frac=.8)
        elif age < 2.5:
            c.lens(p0, p1, 6, ['i0', 'i2', 'i4', 'w'])
        elif age < 4.5:
            c.lens(p0, p1, 3, ['i0', 'i1', 'i3'])
        else:
            c.dline(p0, p1, 'i1', 4)
    if f >= 2:
        star(c, CX, CY, 10, 8 + f * 2, 4 + f, 'i2', rot=.3)
        star(c, CX, CY, 10, 5 + f, 3, 'w', rot=.3)
    if f >= 3:
        c.ring(CX, CY, 8 + f * 3, 'i3', 1)
        burst(c, CX, CY, (f - 3) / 4, 8, 5, ['w', 'y3', 'i3'], spd=(10, 26))
    if f == 0:
        c.spark(CX, CY, 6, 'w', 'i3')


if __name__ == '__main__':
    run(globals())
