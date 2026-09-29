"""summoner_lance_hit: 정령 창 착탄: 푸른 창이 적을 관통하며 빛무늬가 번지고 작은 영혼 불꽃이 떠오른다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'summoner_lance_hit', 64, 8, 'target'
PAL = pal(pick(TEAL, 't1', 't2', 't3'), pick(ICEB, 'i2', 'i3', 'i4'), pick(PURP, 'v2', 'v3'), WHITE)
IX, IY = 32, 34


def wisp(c, x, y, s):
    c.disc(x, y, s, 't3')
    c.poly([(x - s, y), (x + s, y), (x + s * .3, y + s * 3)], 't2')
    c.px(x - s * .3, y - s * .3, 'w')


def draw(c, f):
    if f == 0:
        c.lens((62, IY), (4, IY), 4, ['t1', 'i3', 'w'], frac=.5)
        c.spark(IX, IY, 5, 'w', 'i3')
    elif f == 1:
        c.lens((62, IY), (0, IY), 5, ['t1', 'i2', 'i4', 'w'])
        star(c, IX, IY, 8, 12, 5, 'i2', rot=.2)
        c.disc(IX, IY, 3, 'w')
    elif f == 2:
        c.lens((62, IY), (0, IY), 3, ['t1', 'i3', 'w'])
        c.ring(IX, IY, 10, 'i3', 2)
        c.ring(IX, IY, 15, 't2', 1)
        c.rays(IX, IY, 12, 12, 26, 'i4', jitter=[1, .6, .85])
    elif f == 3:
        c.lens((62, IY), (0, IY), 1.5, ['t2', 'i3'])
        c.ring(IX, IY, 18, 'i2', 1)
        c.ring(IX, IY, 22, 't2', 1, squash=.9)
        for i in range(6):
            a = i * 1.05
            hx, hy = pol(IX, IY, 14, a)
            c.line([(IX, IY), (hx, hy)], 'v3')
        c.spark(IX, IY, 4, 'w', 'i4')
    elif f <= 5:
        k = f - 4
        c.dring(IX, IY, 22 + k * 3, 'i2')
        for i in range(4):
            wisp(c, 16 + i * 11, 38 - k * 8 - (i % 2) * 6, 2)
        c.dline((0, IY), (62, IY), 't1', 3)
    else:
        k = f - 6
        for i in range(4):
            wisp(c, 14 + i * 12, 20 - k * 6 - (i % 2) * 4, 2 - k * .5)
        c.dring(IX, IY, 27, 't1')
        dissolve(c, .3 + k * .3)


if __name__ == '__main__':
    run(globals())
