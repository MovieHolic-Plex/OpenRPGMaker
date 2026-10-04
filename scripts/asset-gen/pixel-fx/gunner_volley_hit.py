"""gunner_volley_hit: 마탄의 일제사격 착탄: 여러 곳에 동시에 터지는 섬광 뒤 큰 폭발이 겹쳐 연기로 번진다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'gunner_volley_hit', 64, 8, 'target'
PAL = pal(EMBER, GOLDY, SMOG, WHITE)
SPOTS = [(20, 24), (44, 20), (30, 38), (48, 44), (16, 46), (36, 28), (26, 14), (42, 34)]


def draw(c, f):
    for i, (x, y) in enumerate(SPOTS):
        age = f - (i // 2)
        if age < 0 or age > 4:
            continue
        if age == 0:
            c.spark(x, y, 5, 'w', 'y3', diag=True)
        elif age == 1:
            star(c, x, y, 7, 8, 4, 'y2', rot=i)
            c.disc(x, y, 2, 'w')
        elif age == 2:
            c.disc(x, y, 5, 'm3')
            c.disc(x, y, 3, 'm4')
            c.px(x, y, 'w')
        elif age == 3:
            c.puff(x, y - 2, 5, ['q1', 'q2', 'q3'], i)
        else:
            c.puff(x, y - 5, 4, ['q1', 'q2'], i)
    if f == 4:
        c.disc(CX, CY, 8, 'm3')
        c.disc(CX, CY, 5, 'm4')
        c.disc(CX, CY, 2, 'w')
    elif f == 5:
        c.cloud(CX, CY - 4, 14, ['m1', 'm2', 'm3', 'm4'], 5)
    elif f == 6:
        c.cloud(CX, CY - 8, 14, ['q0', 'm1', 'm2'], 5)
        c.puff(CX, CY + 4, 8, ['q1', 'q2'], 2)
    elif f == 7:
        c.cloud(CX, CY - 12, 12, ['q1', 'q2', 'q3'], 5, parity=1)
        c.puff(CX, CY + 2, 8, ['q1', 'q2'], 2)
        dissolve(c, .4)


if __name__ == '__main__':
    run(globals())
