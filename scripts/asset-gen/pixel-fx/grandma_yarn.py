"""grandma_yarn: 뜨개 그물: 털실 뭉치가 날아와 풀리며 대상을 칭칭 감아 뜨개 그물로 묶는다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'grandma_yarn', 64, 10, 'target'
PAL = pal(pick(ROSE, 'p0', 'p1', 'p2', 'p3'), pick(PURP, 'v2', 'v3'), WHITE)


def ball(c, x, y, r):
    c.disc(x, y, r + 1, 'p0')
    c.disc(x, y, r, 'p1')
    c.line([(x - r + 1, y - 1), (x + r - 1, y + 1)], 'p2')
    c.line([(x - r + 1, y + 1), (x + r - 2, y - 2)], 'p2')
    c.px(x - 1, y - r + 1, 'p3')


def wraps(c, n, phase):
    """대상(가운데 x=32, 몸 y 16..52)을 사선으로 감는 실 n 가닥: 앞 가닥 밝게, 뒤 가닥 어둡게."""
    for i in range(n):
        y = 18 + i * 5
        c.line([(20, y + 3), (44, y - 2)], 'p0' if (i + phase) % 2 else 'p1')
        c.line([(20, y + 5), (44, y + 1)], 'p2')
        c.px(20, y + 4, 'p3')
        c.px(44, y - 1, 'p3')


def draw(c, f):
    if f <= 2:
        x = 54 - f * 10
        ball(c, x, 20 + f * 4, 4 - f // 2)
        c.line([(x + 4, 20 + f * 4), (62, 18)], 'p2')
        return
    n = min(7, (f - 2) * 2)
    wraps(c, n, f)
    if f < 7:
        y = 18 + (n - 1) * 5
        c.line([(44, y), (52, 14 + (f % 2) * 4)], 'p2')
        ball(c, 52, 14 + (f % 2) * 4, 2)
        for i in range(3):
            c.px(16 + ((f * 5 + i * 9) % 32), 10 + i * 3, 'p3')
    if f >= 6:
        for x in range(22, 44, 5):
            c.line([(x, 16), (x + (f % 2), 52)], 'p3')
    if f >= 7:
        for i in range(3):
            heart(c, 20 + i * 12, 8 + ((f + i) % 2) * 2, 2, 'p3', ol='p0')
    if f == 9:
        dissolve(c, .35)


if __name__ == '__main__':
    run(globals())

