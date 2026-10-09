"""scholar_runes: 지식의 강의: 아군 발밑에서 빛나는 글자와 수식이 떠올라 머리 위를 돌며 스며든다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'scholar_runes', 64, 10, 'allAllies'
PAL = pal(pick(ICEB, 'i0', 'i1', 'i2', 'i3', 'i4'), pick(GOLDY, 'y1', 'y2', 'y3'), WHITE)
CH = 'a+=17pS3o2'


def draw(c, f):
    t = f / 9
    c.dring(CX, FEET, 10 + f * 1.4, 'i2', squash=.3, parity=f)
    if f <= 6:
        c.ring(CX, FEET, 8 + f, 'i3', squash=.3)
    for i in range(8):
        a = i * 2 * math.pi / 8 + f * .35
        h = min(1, t * 1.6 + i * .04)
        y = FEET - 6 - h * 34 + math.sin(a) * 4
        x = CX + math.cos(a) * (18 - h * 6)
        if f >= 8 and i % 2 == f % 2:
            continue
        k = 'y2' if i % 3 == 0 else 'i4'
        glyph(c, x - 1, y - 2, CH[(i + f) % len(CH)], k, ol='i0')
    if f >= 5:
        c.spark(CX, 16, [0, 0, 0, 0, 0, 3, 5, 6, 4, 2][f], 'w', 'y3')


if __name__ == '__main__':
    run(globals())

