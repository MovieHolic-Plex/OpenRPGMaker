"""squire_rush: 방패 돌진: 푸른 방패 모양 충격판이 정면에서 부딪혀 방사형 충격선과 먼지 구름을 밀어낸다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'squire_rush', 64, 8, 'target'
PAL = pal(pick(ICEB, 'i0', 'i1', 'i2', 'i3', 'i4'), pick(GOLDY, 'y2', 'y3'), pick(SMOG, 'q2', 'q3'), WHITE)
SX, SY = 36, 34


def sh(c, x, y, s):
    pts = [(x - 8 * s, y - 11 * s), (x + 8 * s, y - 11 * s), (x + 9 * s, y + 2 * s), (x, y + 12 * s), (x - 9 * s, y + 2 * s)]
    c.poly([(px_ + (1 if px_ > x else -1), py_ + (1 if py_ > y else -1)) for px_, py_ in pts], 'i0')
    c.poly(pts, 'i2')
    c.poly([(x - 6 * s, y - 9 * s), (x + 6 * s, y - 9 * s), (x + 7 * s, y + 1 * s), (x, y + 9 * s), (x - 7 * s, y + 1 * s)], 'i3')
    c.line([(x, y - 9 * s), (x, y + 10 * s)], 'i1')
    c.line([(x - 7 * s, y - 2 * s), (x + 7 * s, y - 2 * s)], 'i1')
    c.disc(x, y - 2 * s, 2 * s, 'y2')
    c.px(x - 1, y - 3 * s, 'w')


def draw(c, f):
    if f == 0:
        c.lens((62, SY), (30, SY), 6, ['i1', 'i2', 'i3'])
        sh(c, 44, SY, .8)
    elif f == 1:
        sh(c, 38, SY, 1.0)
        c.lens((62, SY - 6), (44, SY - 6), 2, ['i1', 'i3'])
        c.lens((62, SY + 8), (44, SY + 8), 2, ['i1', 'i3'])
    elif f == 2:
        sh(c, SX, SY, 1.1)
        star(c, SX - 8, SY, 10, 18, 9, 'y2', rot=.1)
        star(c, SX - 8, SY, 10, 11, 5, 'w', rot=.1)
        c.rays(SX - 8, SY, 14, 16, 30, 'i4', jitter=[1, .6, .85])
    elif f == 3:
        sh(c, SX + 2, SY, 1.1)
        c.ring(SX - 8, SY, 20, 'i3', 2, squash=1.1)
        c.ring(SX - 8, SY, 26, 'i2', 1, squash=1.1)
        for i in range(8):
            a = math.pi * .6 + i * math.pi * .1
            c.line([pol(SX - 8, SY, 12, a - math.pi * .3), pol(SX - 8, SY, 22, a - math.pi * .3)], 'w')
        dust_puff(c, 16, 54, 8, ['q3', 'q2'], 1)
    elif f == 4:
        sh(c, SX + 4, SY, 1.05)
        c.dring(SX - 8, SY, 28, 'i2', squash=1.1)
        dust_puff(c, 12, 54, 9, ['q3', 'q2'], 2)
        dust_puff(c, 28, 55, 8, ['q3', 'q2'], 3)
    elif f == 5:
        sh(c, SX + 8, SY, .9)
        dust_puff(c, 10, 54, 10, ['q3', 'q2'], 4)
        dust_puff(c, 26, 55, 9, ['q3', 'q2'], 5)
        dissolve(c, .3)
    elif f == 6:
        sh(c, SX + 12, SY, .8)
        dust_puff(c, 10, 54, 10, ['q2', 'q2'], 6)
        dust_puff(c, 26, 55, 8, ['q2', 'q2'], 7)
        dissolve(c, .6)
    else:
        dust_puff(c, 10, 54, 8, ['q2', 'q2'], 8)
        dissolve(c, .7)


if __name__ == '__main__':
    run(globals())
