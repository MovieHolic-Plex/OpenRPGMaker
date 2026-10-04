"""gunner_pocks: 연사 착탄: 여러 점에 차례로 탄흔이 터지며 파편이 튀고 연기가 오른다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'gunner_pocks', 64, 8, 'target'
PAL = pal(pick(GOLDY, 'y1', 'y2', 'y3'), SMOG, WHITE)
SPOTS = [(22, 22), (40, 28), (28, 38), (44, 42), (18, 46), (34, 20), (36, 50)]


def draw(c, f):
    for i, (x, y) in enumerate(SPOTS):
        age = f - i
        if age < 0 or age > 5:
            continue
        if age == 0:
            c.spark(x, y, 6, 'w', 'y3', diag=True)
            c.disc(x, y, 2, 'w')
        elif age == 1:
            star(c, x, y, 7, 6, 3, 'y2', rot=i)
            c.disc(x, y, 1, 'w')
            burst(c, x, y, .3, 5, i, ['y3', 'y2'], spd=(6, 12))
        elif age == 2:
            c.ring(x, y, 5, 'y1', 1)
            burst(c, x, y, .6, 5, i, ['y2', 'y1'], spd=(6, 12), grav=.4)
            c.px(x, y, 'q0')
        elif age <= 4:
            c.disc(x, y, 1, 'q0')
            c.puff(x + 1, y - 5 - (age - 2) * 3, 3, ['q1', 'q2'], i)
        else:
            c.px(x, y, 'q0')
    if f >= 5:
        for i, (x, y) in enumerate(SPOTS[:5]):
            c.px(x, y, 'q1')


if __name__ == '__main__':
    run(globals())
