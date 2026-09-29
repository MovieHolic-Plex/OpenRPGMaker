"""alchemist_stone_hit: 현자의 돌 착탄: 붉은 연성진 위로 마름모 결정 파편이 터지며 금빛 섬광과 불씨가 솟는다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'alchemist_stone_hit', 64, 8, 'target'
PAL = pal(EMBER, pick(GOLDY, 'y2', 'y3'), WHITE)
IX, IY = 32, 36


def draw(c, f):
    if f == 0:
        c.ring(IX, 54, 12, 'y2', 1, squash=.34)
        c.spark(IX, IY, 9, 'w', 'y3', diag=True)
        gem(c, IX, IY, 4, ['m1', 'm2', 'm4', 'w'])
    elif f <= 3:
        r = [0, 22, 26, 28][f]
        c.ring(IX, 54, r * .9, 'y2', 1 if f > 1 else 2, squash=.34)
        hexagram(c, IX, 54, r * .8, 'y3', rot=f * .3, squash=.34)
        star(c, IX, IY, 9, 6 + f * 5, 3 + f * 2, 'm2', rot=f)
        star(c, IX, IY, 9, 3 + f * 3, 2 + f, 'm4', rot=f)
        c.disc(IX, IY, 3, 'w')
        for i in range(7):
            a = i * .9 + f * .3
            gem(c, *pol(IX, IY, 6 + f * 6, a), 2, ['m1', 'm2', 'm4', 'w'])
    elif f <= 5:
        k = f - 4
        c.ring(IX, 54, 26, 'y2', 1, squash=.34)
        for i in range(7):
            a = i * .9 + .9
            x, y = pol(IX, IY, 26 + k * 4, a)
            gem(c, x, y + k * 3, 2, ['m1', 'm2', 'm4', 'w'])
        burst(c, IX, IY, .6 + k * .2, 10, 3, ['m4', 'm3', 'y3'], spd=(10, 26), up=1.2)
    else:
        k = f - 6
        c.dring(IX, 54, 26, 'm2', squash=.34)
        burst(c, IX, IY, .55 + k * .2, 12, 3, ['m3', 'm2', 'y3'], spd=(10, 26), up=1.6)
        dissolve(c, .2 + k * .2)


if __name__ == '__main__':
    run(globals())
