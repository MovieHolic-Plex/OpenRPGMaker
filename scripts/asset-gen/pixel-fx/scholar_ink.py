"""scholar_ink: 먹물 폭탄: 먹물 방울이 대상 얼굴에 튀어 검게 번지고 흘러내린다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'scholar_ink', 64, 8, 'target'
PAL = pal(INKK, pick(PURP, 'v1', 'v2', 'v3'), WHITE)
HX, HY = 30, 26


def draw(c, f):
    if f == 0:
        c.disc(48, 12, 3, 'k1'); c.disc(48, 12, 2, 'k0'); c.px(47, 11, 'k2')
        c.line([(52, 8), (56, 4)], 'v2')
    elif f == 1:
        c.disc(38, 20, 3, 'k0'); c.px(37, 19, 'k2')
        c.dline((40, 18), (50, 10), 'v2')
    elif f == 2:
        star(c, HX, HY, 9, 12, 5, 'k0', rot=.3)
        star(c, HX, HY, 9, 8, 4, 'k1', rot=.5)
        for i in range(6):
            a = i * 1.05
            c.disc(HX + math.cos(a) * 15, HY + math.sin(a) * 12, 1.5, 'k0')
    else:
        g = f - 3
        c.oval(HX, HY, 11 - g, 8 - g * .5, 'k0')
        c.oval(HX - 2, HY - 2, 5, 3, 'k1')
        c.px(HX - 4, HY - 3, 'k2')
        for i, x in enumerate((HX - 7, HX - 2, HX + 4, HX + 8)):
            L = 4 + g * (2 + i % 2)
            c.line([(x, HY + 5), (x, HY + 5 + L)], 'k0', 2)
            c.disc(x, HY + 6 + L, 1.2, 'k0')
        for i in range(3):
            c.px(HX + 14 + i * 2, HY - 8 + ((f + i) % 3) * 2, 'v3')
        if f == 7:
            dissolve(c, .45)


if __name__ == '__main__':
    run(globals())

