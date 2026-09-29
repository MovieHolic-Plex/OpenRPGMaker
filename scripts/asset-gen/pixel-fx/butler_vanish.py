"""butler_vanish: 그림자 시중: 대상 뒤에 검은 연미복 그림자가 스윽 나타나 은빛 일섬을 긋고 흰 장갑 잔상만 남긴다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'butler_vanish', 64, 8, 'target'
PAL = pal(pick(INKK, 'k0', 'k1', 'k2'), pick(STEELB, 'b1', 'b2', 'b3'), pick(PAPER, 'n3'), WHITE)


def draw(c, f):
    if f <= 3:
        o = [.2, .5, .8, 1][f]
        x = 44
        c.oval(x, 30, 5 * o, 12 * o, 'k1')
        c.poly([(x - 5 * o, 38), (x + 5 * o, 38), (x + 7 * o, 52), (x, 48), (x - 7 * o, 52)], 'k0')
        c.disc(x, 16, 4 * o, 'k1')
        if o >= .8:
            c.px(x - 2, 16, 'b3')
        if f <= 1:
            dissolve(c, .5)
    if 3 <= f <= 5:
        k = ['b2', 'b3', 'w'][:3 - (f - 3)]
        c.lens((50, 12), (14, 48), 3 if f != 4 else 4, ['k2'] + k)
    if f == 4:
        c.spark(32, 30, 6, 'w', 'b3', diag=True)
    if f >= 5:
        t = (f - 5) / 2
        c.disc(46 + t * 4, 26 - t * 4, 2, 'n3')
        c.dring(32, 30, 8 + (f - 5) * 5, 'k2', parity=f)
        for i in range(4):
            c.px(20 + i * 7, 34 + (i % 2) * 4 + t * 4, 'b2')


if __name__ == '__main__':
    run(globals())

