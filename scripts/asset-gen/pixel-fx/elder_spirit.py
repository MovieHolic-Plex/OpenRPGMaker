"""elder_spirit: 조상의 영혼: 대상 뒤에 푸른 옛 노인 혼령이 스르르 떠올라 손가락질하고 빛 채찍이 내리친다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'elder_spirit', 64, 10, 'target'
PAL = pal(pick(TEAL, 't0', 't1', 't2', 't3'), pick(ICEB, 'i3', 'i4'), pick(GOLDY, 'y2', 'y3'), WHITE)


def ghost(c, x, y, a):
    c.disc(x, y, 7, 't1')
    c.disc(x, y - 1, 6, 't2')
    c.poly([(x - 7, y), (x + 7, y), (x + 5, y + 14), (x + 2, y + 11), (x, y + 15), (x - 3, y + 11), (x - 6, y + 14)], 't1')
    c.poly([(x - 5, y + 1), (x + 5, y + 1), (x + 3, y + 10), (x - 3, y + 10)], 't2')
    c.line([(x - 4, y + 4), (x, y + 9), (x + 4, y + 4)], 'i4')
    c.px(x - 3, y - 1, 't0'); c.px(x + 2, y - 1, 't0')
    c.line([(x - 4, y - 4), (x - 1, y - 3)], 'i4'); c.line([(x + 1, y - 3), (x + 4, y - 4)], 'i4')
    c.line([(x - 6, y + 4), (x - 12, y + a)], 't2', 2)


def draw(c, f):
    rise = [0, .3, .6, .85, 1, 1, 1, 1, 1, 1][f]
    x, y = 40, 30 - rise * 12
    if f >= 1:
        ghost(c, x, y, 2 if f < 5 else -2)
        if f <= 2 or f >= 8:
            dissolve(c, .6 if f in (1, 9) else .35, box=(28, 4, 54, 48))
    if 5 <= f <= 7:
        k = f - 5
        c.bolt((x - 12, y), (22, 38), f, ['t2', 'i3', 'w'][k:], segs=4, jitter=3)
        pow_burst(c, 22, 38, 7 + k * 2, ['t1', 'y2', 'y3', 'w'][k:], n=8)
    c.dring(40, 56, 8 + f, 't1', squash=.3, parity=f)


if __name__ == '__main__':
    run(globals())

