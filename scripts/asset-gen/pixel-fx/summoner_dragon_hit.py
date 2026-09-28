"""summoner_dragon_hit: 용신의 숨결 착탄: 푸른 금빛 광주가 내리꽂혀 별 모양 충격이 일고 용의 비늘 같은 빛 알갱이가 흩날린다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'summoner_dragon_hit', 64, 8, 'allTargets'
PAL = pal(pick(ICEB, 'i1', 'i2', 'i3', 'i4'), pick(GOLDY, 'y2', 'y3'), pick(PURP, 'v2'), WHITE)
IX, IY = 32, 46


def draw(c, f):
    if f == 0:
        beam(c, 32, 2, 32, 50, 2, 5, 'y3', 'i3', phase=0)
        c.spark(32, 44, 4, 'w', 'y3')
    elif f <= 2:
        beam(c, 32, 0, 32, 52, 5 + f * 2, 9 + f * 3, 'y3', 'i3', phase=f * 3)
        star(c, IX, IY, 9, 10 + f * 4, 5 + f * 2, 'i2', rot=f * .3)
        star(c, IX, IY, 9, 6 + f * 2, 3 + f, 'y3', rot=f * .3)
        c.disc(IX, IY, 3, 'w')
    elif f <= 4:
        k = f - 3
        beam(c, 32, 0, 32, 52, 8 - k * 3, 14, 'y3', 'i3', phase=f * 3)
        c.ring(IX, 54, 16 + k * 8, 'y2', 2, squash=.34)
        c.ring(IX, 54, 11 + k * 6, 'i3', 1, squash=.34)
        burst(c, IX, IY, .3 + k * .3, 10, 5, ['w', 'y3', 'i3'], spd=(10, 26), up=1.2)
    else:
        k = f - 5
        c.dring(IX, 54, 26 + k * 2, 'i2', squash=.34)
        burst(c, IX, IY, .7 + k * .12, 10, 5, ['y3', 'i3', 'i2'], spd=(10, 26), up=1.6)
        for i in range(5):
            c.spark(14 + (i * 11) % 38, 30 - k * 5 + (i * 7) % 16, 2, 'w', 'y3')
        dissolve(c, .15 * k)


if __name__ == '__main__':
    run(globals())
