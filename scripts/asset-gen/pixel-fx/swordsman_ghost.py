"""swordsman_ghost: 잔영 베기: 푸른 검사 실루엣 잔영 둘이 차례로 흩어지고 뒤에서 대각선 참격이 그어진다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'swordsman_ghost', 64, 8, 'target'
PAL = pal(pick(ICEB, 'i0', 'i1', 'i2', 'i3', 'i4'), pick(STEELB, 'b3'), WHITE)


def draw(c, f):
    for i, x in enumerate((48, 36)):
        age = f - i
        if age < 0 or age > 3:
            continue
        body = ['i2', 'i1', 'i1', 'i0'][age]
        rim = ['i4', 'i3', 'i2', 'i1'][age]
        c.ninja(x, 56, 36, body, rim, 'w', scarf=None)
        c.line([(x - 12, 34), (x - 20, 28)], 'i3', 2)
        dissolve(c, [0, .25, .5, .8][age], box=(x - 22, 12, x + 14, 58))
    if 2 <= f <= 6:
        k = f - 2
        p0, p1 = (60, 6), (6, 54)
        if k == 0:
            c.lens(p0, p1, 6, ['i0', 'i2', 'i4', 'w'], frac=.7)
        elif k == 1:
            c.lens(p0, p1, 8, ['i0', 'i2', 'i4', 'w'])
            c.spark(32, 30, 9, 'w', 'i3', diag=True)
        elif k == 2:
            c.lens(p0, p1, 6, ['i0', 'i2', 'i3'])
            c.ring(32, 30, 12, 'i3', 1)
        else:
            c.lens(p0, p1, 3, ['i0', 'i1'])
            c.dring(32, 30, 17 + k * 2, 'i2')
    if f == 7:
        c.dline((60, 6), (6, 54), 'i1', 4)
        for i in range(4):
            c.px(14 + i * 12, 44 - i * 9, 'i3')


if __name__ == '__main__':
    run(globals())
