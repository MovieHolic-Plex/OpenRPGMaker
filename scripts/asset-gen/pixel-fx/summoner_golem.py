"""summoner_golem: 거인의 주먹: 보랏빛 소환진 위로 바위 주먹이 내려꽂혀 땅이 갈라지고 돌조각과 먼지가 튄다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'summoner_golem', 64, 10, 'target'
PAL = pal(pick(STEELB, 'b0', 'b1', 'b2', 'b3'), pick(LEATHER, 'l1', 'l2'), pick(PURP, 'v2', 'v3'), pick(SMOG, 'q2'), WHITE)
FX_ = 32


def fist(c, x, y, s):
    """위에서 내려오는 바위 주먹(손가락 마디 넷이 아래)."""
    c.poly([(x - 12 * s, y - 30 * s), (x + 12 * s, y - 30 * s), (x + 14 * s, y - 2 * s), (x - 14 * s, y - 2 * s)], 'b0')
    c.poly([(x - 11 * s, y - 30 * s), (x + 11 * s, y - 30 * s), (x + 13 * s, y - 3 * s), (x - 13 * s, y - 3 * s)], 'b1')
    for i in range(4):
        fxx = x - 10.5 * s + i * 7 * s
        c.rect(fxx, y - 4 * s, fxx + 5.5 * s, y + 6 * s, 'b0')
        c.rect(fxx + 1, y - 4 * s, fxx + 4.5 * s, y + 5 * s, 'b1')
        c.line([(fxx + 1, y - 3 * s), (fxx + 4, y - 3 * s)], 'b3')
        c.px(fxx + 1, y + 3 * s, 'b3')
    c.rect(x - 12 * s, y - 28 * s, x - 9 * s, y - 4 * s, 'b2')
    for i in range(4):
        c.line([(x - 10 * s + i * 7 * s, y - 20 * s + (i % 2) * 6), (x - 6 * s + i * 7 * s, y - 15 * s + (i % 2) * 6)], 'b0')
    c.line([(x - 4 * s, y - 26 * s), (x + 2 * s, y - 20 * s), (x - 1 * s, y - 14 * s)], 'b0')
    c.line([(x + 6 * s, y - 28 * s), (x + 8 * s, y - 20 * s)], 'l2')


def draw(c, f):
    if f == 0:
        c.ring(FX_, 52, 18, 'v2', 1, squash=.3)
        c.ring(FX_, 52, 11, 'v3', 1, squash=.3)
        hexagram(c, FX_, 52, 15, 'v3', rot=.2, squash=.3)
        c.oval(FX_, 54, 12, 3, 'b0')
    elif f <= 2:
        y = [10, 26][f - 1]
        c.ring(FX_, 54, 20, 'v2', 1, squash=.3)
        hexagram(c, FX_, 54, 16, 'v3', rot=.4, squash=.3)
        c.oval(FX_, 55, 8 + f * 4, 2 + f, 'b0')
        fist(c, FX_, y, .85 + f * .1)
        for i in range(3):
            c.line([(FX_ - 10 + i * 10, y - 26), (FX_ - 10 + i * 10, y - 38)], 'q2')
    elif f == 3:
        fist(c, FX_, 44, 1.0)
        pow_burst(c, FX_, 54, 12, ['l1', 'l2', 'w'], rot=.2, n=9)
        crack(c, FX_, 57, 0.0, 6, 26, ('b0', 'v3'), 4, grow=.6, squash=.3)
        c.ring(FX_, 57, 14, 'v3', 2, squash=.34)
    elif f <= 6:
        k = f - 4
        fist(c, FX_, 46, 1.0)
        crack(c, FX_, 57, 0.0, 6, 26, ('b0', 'v3'), 4, grow=1.0, squash=.3)
        c.ring(FX_, 57, 22 + k * 3, 'v2', 1, squash=.34)
        debris(c, FX_, 54, .2 + k * .25, 10, 4, ['b2', 'b1', 'l2'], spd=(14, 30))
        dust_puff(c, 12, 56, 8, ['q2', 'b1'], k + 1)
        dust_puff(c, 52, 56, 8, ['q2', 'b1'], k + 2)
    else:
        k = f - 7
        fist(c, FX_, 46, 1.0)
        dissolve(c, .25 + k * .3, box=(4, 0, 60, 52))
        crack(c, FX_, 57, 0.0, 6, 26, ('b0', 'v2'), 4, grow=1.0, squash=.3)
        dust_puff(c, 14, 55, 9, ['q2', 'b1'], k + 3)
        dust_puff(c, 50, 55, 9, ['q2', 'b1'], k + 4)
        c.dring(FX_, 57, 28, 'v2', squash=.34)


if __name__ == '__main__':
    run(globals())
