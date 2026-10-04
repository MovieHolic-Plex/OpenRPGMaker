"""squire_combo: 삼연격: 서로 다른 방향의 세 줄기 강철 참격이 차례로 그어지고 불똥이 튄다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'squire_combo', 64, 8, 'target'
PAL = pal(STEELB, pick(GOLDY, 'y2', 'y3'), WHITE)


def draw(c, f):
    S = [((10, 8), (52, 42)), ((54, 12), (10, 46)), ((8, 30), (58, 28))]
    for i, (p0, p1) in enumerate(S):
        age = f - i * 2
        if age < 0:
            continue
        if age == 0:
            c.lens(p0, p1, 6, ['b0', 'b2', 'b3', 'w'], frac=.55)
        elif age == 1:
            c.lens(p0, p1, 7, ['b0', 'b2', 'b3', 'w'])
            mx, my = (p0[0] + p1[0]) // 2, (p0[1] + p1[1]) // 2
            c.spark(mx, my, 6, 'w', 'y3', diag=True)
        elif age <= 3:
            c.lens(p0, p1, 4, ['b0', 'b1', 'b2'])
        else:
            c.dline(p0, p1, 'b1', 3, phase=f)
    if f >= 4:
        star(c, CX, CY, 9, 8 + (f - 4) * 2, 4, 'y2', rot=.3)
        c.disc(CX, CY, 2, 'w')
        burst(c, CX, CY, (f - 4) / 4, 8, 3, ['w', 'y3', 'y2'], spd=(10, 24))


if __name__ == '__main__':
    run(globals())
