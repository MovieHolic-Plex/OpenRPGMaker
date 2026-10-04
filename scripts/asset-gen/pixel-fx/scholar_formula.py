"""scholar_formula: 공식 폭발: 대상 둘레에 수식이 한 줄씩 적히며 빛나고, 등호가 닫히는 순간 푸른 빛으로 터진다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'scholar_formula', 64, 10, 'allTargets'
PAL = pal(pick(ICEB, 'i0', 'i1', 'i2', 'i3', 'i4'), pick(GOLDY, 'y2', 'y3'), WHITE)
LINES = ['2x3=', '7+1=', 'pSa']


def draw(c, f):
    if f <= 5:
        for row, s in enumerate(LINES):
            shown = max(0, min(len(s), (f + 1) * 2 - row * 2))
            for i in range(shown):
                glyph(c, 14 + i * 5 + row * 3, 12 + row * 8, s[i], 'i4' if row != 1 else 'y3', ol='i0')
        c.ring(CX, 36, 18 - f, 'i2', squash=.6)
    if f in (4, 5):
        c.rays(CX, 36, 8, 6, 12 + (f - 4) * 4, 'i3', rot=f * .3)
    if f >= 6:
        k = f - 6
        pow_burst(c, CX, 38, [16, 20, 14, 8][k], ['i1', 'i2', 'i3', 'w'][k:], rot=f * .2, n=10)
        c.ring(CX, 38, 12 + k * 6, 'i3' if k < 2 else 'i1', squash=.7)
        r = rng(9)
        for i in range(8):
            a = r.uniform(0, 2 * math.pi)
            d = 10 + k * 5
            glyph(c, CX + math.cos(a) * d - 1, 38 + math.sin(a) * d * .7 - 2, '+x=o'[i % 4], 'i3' if k < 2 else 'i1')
        if f == 9:
            dissolve(c, .5)


if __name__ == '__main__':
    run(globals())

