"""gunner_butt: 개머리판 타격: 둔탁한 별 모양 충격과 노란 별 무리, 갈색 나무 조각이 튄다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'gunner_butt', 64, 8, 'target'
PAL = pal(pick(EMBER, 'm1', 'm2', 'm3'), pick(GOLDY, 'y1', 'y2', 'y3'), pick(LEATHER, 'l0', 'l1', 'l2', 'l3'), pick(SMOG, 'q1', 'q2'), WHITE)
IX, IY = 34, 34


def draw(c, f):
    if f == 0:
        slash(c, (58, 18), (36, 36), -6, 8, ['l0', 'l2', 'l3', 'w'])
        c.spark(IX, IY, 5, 'w', 'y3')
    elif f == 1:
        star(c, IX, IY, 10, 17, 8, 'm1', rot=.1)
        star(c, IX, IY, 10, 13, 6, 'm3', rot=.1)
        star(c, IX, IY, 10, 8, 4, 'y3', rot=.1)
        c.disc(IX, IY, 3, 'w')
        c.rays(IX, IY, 10, 17, 26, 'y2', rot=.15, jitter=[1, .6, .85, .7])
    elif f == 2:
        star(c, IX, IY, 10, 15, 7, 'm2', rot=.2)
        star(c, IX, IY, 10, 9, 4, 'y2', rot=.2)
        c.ring(IX, IY, 20, 'y1', 1, squash=.9)
        for i in range(3):
            a = -1.9 + i * .9
            x, y = pol(IX, IY - 8, 15, a)
            c.spark(x, y, 4, 'y3', 'y2')
        debris(c, IX, IY + 4, .1, 8, 3, ['l1', 'l2', 'l3'], spd=(10, 22), up=1.2)
    elif f == 3:
        for i in range(3):
            a = -2.1 + i * 1.0
            x, y = pol(IX, IY - 8, 17 + i, a)
            c.spark(x, y, 3, 'y3', 'y2')
        c.ring(IX, IY, 22, 'm3', 1, squash=.9)
        debris(c, IX, IY + 4, .3, 8, 3, ['l1', 'l2', 'l3'], spd=(10, 22), up=1.2)
        dust_puff(c, IX, 52, 9, ['q2', 'q1'], 1)
    elif f == 4:
        for i in range(3):
            a = -2.2 + i * 1.1
            x, y = pol(IX, IY - 8, 19, a)
            c.spark(x, y, 2, 'y2', 'y1')
        dust_puff(c, IX - 6, 53, 9, ['q2', 'q1'], 2)
        dust_puff(c, IX + 8, 52, 9, ['q2', 'q1'], 3)
        debris(c, IX, IY + 4, .55, 7, 3, ['l1', 'l2'], spd=(10, 22), up=1.2)
    elif f == 5:
        for i in range(2):
            x, y = pol(IX, IY - 8, 21, -2.0 + i * 1.3)
            c.px(x, y, 'y2')
        dust_puff(c, IX - 8, 52, 10, ['q1', 'q2'], 4)
        dust_puff(c, IX + 10, 51, 10, ['q1', 'q2'], 5)
        debris(c, IX, IY + 4, .8, 5, 3, ['l1'], spd=(10, 22), up=1.2)
    else:
        dust_puff(c, IX - 9, 51, 10, ['q1', 'q1'], 6)
        dust_puff(c, IX + 11, 50, 10, ['q1', 'q1'], 7)
        dissolve(c, .45 if f == 6 else .75)


if __name__ == '__main__':
    run(globals())
