"""elder_scold: 호통: 오른쪽에서 톱니 모양 호통 충격파가 적진을 덮치고 느낌표와 땀방울이 튄다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'elder_scold', 64, 8, 'allTargets'
PAL = pal(pick(EMBER, 'm1', 'm2', 'm3', 'm4'), pick(ICEB, 'i2', 'i3'), WHITE)


def bang(c, x, y, k):
    c.rect(x, y, x + 1, y + 6, k)
    c.rect(x, y + 8, x + 1, y + 9, k)


def draw(c, f):
    for j in range(3):
        r = 6 + (f - j * 1.5) * 7
        if 4 < r < 34:
            zring(c, 58, 32, r, 2, 'm3' if j == 0 else 'm2', n=10, rot=f * .2, squash=1.0)
    if 2 <= f <= 6:
        bang(c, 18, 8 + (f % 2), 'm4')
        bang(c, 26, 6, 'm3')
    if f >= 3:
        t = (f - 3) / 4
        for i, (x, y) in enumerate(((16, 24), (44, 22), (30, 16))):
            c.disc(x + t * 4 * (1 if i % 2 else -1), y + t * 10, 1.3, 'i3')
            c.px(x + t * 4 * (1 if i % 2 else -1), y + t * 10 - 2, 'i2')
    if f in (2, 3):
        c.spark(34, 32, 5, 'w', 'm4')


if __name__ == '__main__':
    run(globals())

