"""summoner_thunderbird: 천둥새: 번개 구름에서 날개를 편 천둥새가 급강하해 적을 꿰뚫고 벼락과 고리가 퍼진다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'summoner_thunderbird', 64, 10, 'target'
PAL = pal(pick(BOLT, 'y1', 'y2', 'y3'), pick(ICEB, 'i1', 'i2', 'i3', 'i4'), pick(PURP, 'v1', 'v2'), WHITE)


def bird(c, x, y, s, flap):
    """정면에서 내리꽂는 새: 뾰족한 날개 두 장(번개 모양), 몸통, 부리는 아래."""
    w = [.8, 1.15, 1.0][flap % 3]
    L = [(x, y - 4 * s), (x - 9 * s * w, y - 8 * s), (x - 15 * s * w, y - 5 * s), (x - 11 * s * w, y - 1 * s), (x - 17 * s * w, y + 1 * s),
         (x - 8 * s * w, y + 4 * s), (x - 3 * s, y + 5 * s)]
    R = [(2 * x - px_, py_) for px_, py_ in L]
    for pts in (L, R):
        c.poly(pts, 'i1', outline='i1')
        c.poly([(x - (x - px_) * .75, y + (py_ - y) * .75) for px_, py_ in pts], 'y2')
        c.line(pts[1:4], 'y3')
    c.poly([(x, y - 6 * s), (x + 3 * s, y), (x, y + 8 * s), (x - 3 * s, y)], 'i1')
    c.poly([(x, y - 5 * s), (x + 2 * s, y), (x, y + 6 * s), (x - 2 * s, y)], 'y2')
    c.disc(x, y - 6 * s, 2 * s, 'i1')
    c.disc(x, y - 6 * s, 2 * s - 1, 'y3')
    c.poly([(x - s, y + 7 * s), (x + s, y + 7 * s), (x, y + 11 * s)], 'w')
    c.px(x - s, y - 7 * s, 'v1')
    c.px(x + s, y - 7 * s, 'v1')
    for i in (-1, 1):
        c.line([(x + i * 2 * s, y - 6 * s), (x + i * 3 * s, y - 11 * s)], 'y3')


def draw(c, f):
    if f == 0:
        for i in range(5):
            c.cloud(14 + i * 9, 6 + (i % 2) * 2, 6, ['v1', 'v2'], i)
        bolt(c, (32, 10), (30, 28), 1, ['i2', 'y2', 'w'], segs=4, jitter=3)
    elif f <= 3:
        y = [16, 25, 33][f - 1]
        s = [1.0, 1.5, 2.0][f - 1]
        for i in range(3):
            c.line([(CX - 4 + i * 4, y - 12), (CX - 4 + i * 4, y - 22)], 'i3')
        bird(c, CX, y, s, f)
        if f >= 2:
            c.spark(CX, y + 11 * s, 3, 'w', 'y3')
    elif f == 4:
        bolt(c, (32, 2), (32, 46), 4, ['i1', 'y2', 'w'], segs=8, jitter=5)
        bolt(c, (30, 4), (34, 46), 5, ['i2', 'y3'], segs=8, jitter=4)
        star(c, 32, 46, 9, 15, 7, 'y2', rot=.3)
        star(c, 32, 46, 9, 9, 4, 'w', rot=.3)
        c.rays(32, 46, 12, 14, 28, 'i3', jitter=[1, .6, .85])
    elif f == 5:
        bird(c, CX, 40, 2.0, 1)
        c.ring(32, 50, 14, 'y3', 2, squash=.4)
        for j in range(3):
            bolt(c, (32 + (j - 1) * 4, 46), (32 + (j - 1) * 20, 52 + (j % 2) * 4), 20 + j, ['i1', 'y3'], segs=4, jitter=3)
        c.spark(32, 46, 6, 'w', 'y3', diag=True)
    elif f == 6:
        c.ring(32, 52, 22, 'y2', 2, squash=.36)
        c.ring(32, 52, 15, 'i3', 1, squash=.36)
        bolt(c, (18, 46), (10, 56), 30, ['i1', 'y3'], segs=3, jitter=2)
        bolt(c, (46, 46), (54, 56), 31, ['i1', 'y3'], segs=3, jitter=2)
        burst(c, 32, 46, .3, 10, 5, ['w', 'y3', 'y2'], spd=(10, 24))
    elif f == 7:
        c.ring(32, 52, 27, 'y1', 1, squash=.36)
        burst(c, 32, 46, .55, 10, 5, ['y3', 'y2', 'i3'], spd=(10, 24), grav=.4)
        for j in range(3):
            c.spark(14 + j * 18, 46 + (j % 2) * 5, 3, 'i4', 'i2')
    elif f == 8:
        c.dring(32, 52, 29, 'i2', squash=.36)
        burst(c, 32, 46, .8, 8, 5, ['y2', 'i3'], spd=(10, 24), grav=.8)
    else:
        c.dring(32, 52, 30, 'i1', squash=.36)
        burst(c, 32, 46, 1.0, 5, 5, ['y2'], spd=(10, 24), grav=1.0)


if __name__ == '__main__':
    run(globals())
