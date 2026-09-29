"""flower_girl_bloom: 만개: 무대 바닥에서 색색의 꽃이 차례로 피어나 꽃밭이 번지고 꽃잎과 빛 알갱이가 소용돌이친다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'flower_girl_bloom', 128, 12, 'screen'
PAL = pal(ROSE, pick(LEAFG, 'g0', 'g1', 'g2', 'g3'), pick(GOLDY, 'y2', 'y3'), pick(ICEB, 'i3'), WHITE)


def flower(c, x, y, r, kk, open_):
    cols = {0: ('p1', 'p2', 'p3'), 1: ('y1', 'y2', 'y3'), 2: ('i2', 'i3', 'i4'), 3: ('p2', 'p3', 'p4')}
    e, m, h = ('p1', 'p2', 'p3') if kk % 4 == 0 else ('p2', 'p3', 'p4') if kk % 4 == 3 else ('y2', 'y3', 'w') if kk % 4 == 1 else ('p1', 'p3', 'w')
    c.line([(x, y + r * 1.4), (x, y + r * 3.4 + 2)], 'g1', 2)
    for i in range(5):
        a = -math.pi / 2 + i * 2 * math.pi / 5
        c.petal(x + math.cos(a) * r * .8 * open_, y + math.sin(a) * r * .8 * open_, a, (r * 1.2 + 2) * open_ + 1, m, h)
    c.disc(x, y, max(1, r * .35), 'y2')


def draw(c, f):
    lvl = [.3, .55, .8, 1, 1, 1, 1, 1, 1, 1, .7, .4][f]
    shade(c, 64, 72, 48 * lvl + 14, 'g0', squash=.8)
    c.ring(64, 96, 44 * lvl, 'g2', 1, squash=.3)
    r = rng(17)
    spots = [(r.uniform(14, 114), r.uniform(70, 108)) for _ in range(30)]
    for i, (x, y) in enumerate(spots):
        t = f * 1.0 - i * .22 + 1
        if t <= 0:
            continue
        op = min(1, t / 2.5)
        if op < .3:
            c.line([(x, y + 3), (x, y - 3 * op * 6)], 'g2')
        else:
            flower(c, x, y - 4, 3.2 + (i % 3), i, op)
    if f >= 3:
        for i in range(22):
            u = (i / 22 + f * .05) % 1
            a = u * 9 + i
            rr = 10 + 44 * u
            x, y = 64 + math.cos(a) * rr, 96 - u * 82 + math.sin(a) * rr * .3
            c.petal(x, y, a + 1.3, 4 + i % 2, ['p2', 'p3', 'y2', 'i3', 'w'][i % 5], 'p4' if i % 3 == 0 else None)
    for i in range(10):
        c.spark(14 + (i * 23 + f * 7) % 100, 16 + (i * 19) % 90, 2 if i % 2 else 1, 'w', 'y3') if (i + f) % 2 == 0 else None


if __name__ == '__main__':
    run(globals())
