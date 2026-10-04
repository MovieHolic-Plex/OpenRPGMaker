"""butler_final: 마지막 시중: 화면 가운데 촛대의 불꽃이 꺼지며 어둠이 내리고, 사방에서 은빛 식기 수백 줄기가 한 점으로 모여 번쩍인다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'butler_final', 128, 12, 'screen'
PAL = pal(pick(INKK, 'k0', 'k1', 'k2'), pick(STEELB, 'b1', 'b2', 'b3'), pick(GOLDY, 'y1', 'y2', 'y3'), pick(EMBER, 'm3'), WHITE)
OX, OY = 64, 64


def candle(c, lit):
    c.rect(60, 70, 68, 72, 'y1')
    c.rect(63, 58, 65, 70, 'b3')
    c.rect(56, 72, 72, 73, 'y1')
    if lit > 0:
        c.flame(64, 58, 4 + lit * 4, 2, ['m3', 'y2', 'y3'])


def draw(c, f):
    lvl = [.4, .6, .8, 1, 1, 1, 1, 1, 1, 1, .7, .35][f]
    shade(c, OX, OY, 50 * lvl + 12, 'k0', squash=.85, dense='k0')
    lit = [1, .8, .5, .2, 0, 0, 0, 0, 0, 0, 0, 0][f]
    candle(c, lit)
    if f in (3, 4):
        steam(c, 64, 56, 10 + (f - 3) * 8, f, 'k2', amp=2 + f - 3)
    if 3 <= f <= 5:
        for i in range(24):
            a = i * 2 * math.pi / 24 + f * .2
            x, y = pol(OX, OY - 6, 56 - (f - 3) * 6, a, .8)
            tx, ty = pol(OX, OY - 6, 60 - (f - 3) * 6, a, .8)
            c.line([(tx, ty), (x, y)], 'b3' if i % 2 else 'b2')
    if 5 <= f <= 9:
        t = (f - 5) / 4
        for i in range(24):
            a = i * 2 * math.pi / 24 + .1
            d0 = 70
            d = lerp(d0, 6, ease(t))
            x, y = pol(OX, OY - 6, d, a, .8)
            tx, ty = pol(OX, OY - 6, d + 10, a, .8)
            c.line([(tx, ty), (x, y)], 'b2' if i % 2 else 'b1')
            c.px(x, y, 'w')
    if f >= 9:
        k = f - 9
        c.disc(OX, OY - 6, [16, 24, 14][k], 'b3' if k else 'w')
        c.rays(OX, OY - 6, 16, 10, 40 + k * 8, 'b2', rot=.1)
        if k == 2:
            dissolve(c, .5)


if __name__ == '__main__':
    run(globals())

