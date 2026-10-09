"""berserker_doom_hit: 학살의 폭풍 착탄: 흰 섬광 뒤에 세 갈래 교차 참격이 그어지고 핏빛 고리가 퍼진다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'berserker_doom_hit', 64, 8, 'target'
PAL = pal(EMBER, WHITE)


def draw(c, f):
    lines = [((5, 6), (59, 56)), ((59, 6), (5, 56)), ((3, 33), (61, 27))]
    if f == 0:
        c.spark(CX, CY, 12, 'w', 'm4', diag=True)
        c.disc(CX, CY, 4, 'w')
    for i, (p0, p1) in enumerate(lines):
        if f < i + 1:
            continue
        age = f - i - 1
        if age == 0:
            c.lens(p0, p1, 6, ['m0', 'm2', 'm4', 'w'], frac=.7)
        elif age == 1:
            c.lens(p0, p1, 6, ['m0', 'm2', 'm4', 'w'])
        elif age <= 3:
            c.lens(p0, p1, 4, ['m0', 'm1', 'm3'])
        else:
            c.lens(p0, p1, 2, ['m0', 'm1'])
    if f >= 2:
        pow_burst(c, CX, CY, 10 + f, ['m1', 'm3', 'm4', 'w'] if f < 5 else ['m1', 'm2'], rot=.2, n=9)
    if f >= 3:
        c.ring(CX, CY, 8 + f * 4, 'm2', 1, squash=.8)
        drops(c, CX, CY, (f - 3) / 4, 10, 8, ['m1', 'm2', 'm3'], spd=(10, 26))


if __name__ == '__main__':
    run(globals())
