"""flower_girl_sunflower: 해바라기: 큰 해바라기가 활짝 피어 금빛 광채를 뿜고 씨앗 같은 빛이 아군에게 내린다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'flower_girl_sunflower', 64, 10, 'allAllies'
PAL = pal(pick(GOLDY, 'y0', 'y1', 'y2', 'y3'), pick(LEAFG, 'g1', 'g2', 'g3'), pick(LEATHER, 'l0', 'l1', 'l2'), WHITE)


def sunflower(c, x, y, r, open_):
    n = 12
    for k, (col, s) in enumerate((('y1', 1.0), ('y2', .82), ('y3', .5))):
        for i in range(n):
            a = i * 2 * math.pi / n + k * .26
            L = r * s * open_
            c.petal(x + math.cos(a) * L * .72, y + math.sin(a) * L * .72, a, L * .6 + 2, col, None)
    c.disc(x, y, r * .5 * (.4 + .6 * open_), 'l0')
    c.disc(x, y, r * .4 * (.4 + .6 * open_), 'l1')
    for i in range(6):
        a = i * 1.1
        c.px(x + math.cos(a) * r * .22, y + math.sin(a) * r * .22, 'l2')
    c.px(x - 1, y - 1, 'l2')


def draw(c, f):
    lvl = [.3, .55, .8, 1, 1, 1, 1, .85, .6, .35][f]
    op = min(1, lvl * 1.15)
    top = 58 - 30 * min(1, lvl * 1.3)
    c.line([(CX, 58), (CX + math.sin(f * .5) * 1, top)], 'g1', 3)
    c.line([(CX - 1, 58), (CX - 1, top)], 'g2', 1)
    c.petal(CX - 8, 46, -.5, 8, 'g1', 'g3')
    c.petal(CX + 8, 42, 3.6, 8, 'g1', 'g3')
    sunflower(c, CX, top - 4, 13, op)
    c.rays(CX, top - 4, 14, 18, 27 + (f % 3) * 3, 'y3', rot=f * .12, jitter=[1, .55, .8, .65]) if 3 <= f <= 7 else None
    for i in range(8):
        y = top + ((f * 5 + i * 9) % 40)
        c.spark(10 + (i * 7) % 46, y, 2 if i % 2 else 1, 'w', 'y3') if (i + f) % 2 == 0 else c.px(10 + (i * 7) % 46, y, 'y2')
    c.dring(CX, 57, 12 + lvl * 8, 'y2', squash=.3, parity=f)


if __name__ == '__main__':
    run(globals())
