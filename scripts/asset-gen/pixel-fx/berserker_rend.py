"""berserker_rend: 살점 베기: 도끼날이 세 줄기로 비스듬히 찢고 핏방울이 튄다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'berserker_rend', 64, 8, 'target'
PAL = pal(EMBER, WHITE)
X0 = (12, 26, 40)


def draw(c, f):
    for i, x in enumerate(X0):
        p0, p1 = (x - 4, 6 + i * 3), (x + 16, 56 - i * 2)
        if f < i:
            continue
        age = f - i
        if age == 0:
            c.lens(p0, p1, 6, ['m0', 'm2', 'm4', 'w'], frac=.6)
            c.spark(lerp(p0[0], p1[0], .6), lerp(p0[1], p1[1], .6), 4, 'w', 'm4')
        elif age == 1:
            c.lens(p0, p1, 6, ['m0', 'm2', 'm4', 'w'])
            c.rays(p1[0], p1[1] - 4, 6, 4, 10, 'm3', rot=i)
        elif age <= 3:
            c.lens(p0, p1, 4, ['m0', 'm1', 'm3'])
        elif age <= 5:
            c.lens(p0, p1, 3, ['m0', 'm1'])
        else:
            c.dline(p0, p1, 'm1', 2, phase=f)
    if f == 2:
        c.spark(CX, CY, 9, 'w', 'm4', diag=True)
    for i, x in enumerate(X0):
        if f >= i + 1:
            drops(c, x + 8, 30 + i * 4, min(1, (f - i - 1) / 5), 6, 20 + i, ['m1', 'm2', 'm0'], spd=(8, 22))


if __name__ == '__main__':
    run(globals())
