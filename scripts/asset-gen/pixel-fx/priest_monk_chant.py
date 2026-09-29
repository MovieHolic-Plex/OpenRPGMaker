"""priest_monk_chant: 염불: 대상 둘레에 금빛 범자 글귀가 원을 그리며 돌고 은은한 빛이 내려 치유한다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'priest_monk_chant', 64, 10, 'target'
PAL = pal(pick(GOLDY, 'y0', 'y1', 'y2', 'y3'), pick(EMBER, 'm2', 'm3'), WHITE)


def draw(c, f):
    n = min(8, f + 2)
    for i in range(n):
        a = i * 2 * math.pi / 8 + f * .3
        x, y = CX + math.cos(a) * 18, 34 + math.sin(a) * 9
        glyph(c, x - 1, y - 2, 'oSv7'[i % 4], 'y2' if math.sin(a) > 0 else 'y1', ol='y0')
    if f >= 3:
        beam(c, CX, 4, CX, 50, 3, 10, 'y3', 'y1', phase=f, stripes=0)
    if f >= 5:
        c.ring(CX, 34, 10 + (f - 5), 'm3' if f % 2 else 'y3')
        c.spark(CX, 20, [3, 5, 4, 3, 2][f - 5], 'w', 'y3')
    if f == 9:
        dissolve(c, .45)


if __name__ == '__main__':
    run(globals())

