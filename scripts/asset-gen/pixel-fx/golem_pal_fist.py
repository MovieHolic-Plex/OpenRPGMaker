"""golem_pal_fist: 돌주먹. 커다란 점토 주먹이 위에서 내리꽂히며 방사 균열과 흙덩이, 별 모양 충격을 남긴다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'golem_pal_fist', 64, 8, 'target'
PAL = pal(CLAY, pick(GOLD, 'y3'))


def fist(c, x, y, w, h):
    c.poly([(x - w, y - h + 3), (x - w + 3, y - h), (x + w - 3, y - h), (x + w, y - h + 3), (x + w, y + h - 3), (x + w - 3, y + h), (x - w + 3, y + h), (x - w, y + h - 3)], 'c0')
    c.poly([(x - w + 1, y - h + 4), (x - w + 4, y - h + 1), (x + w - 5, y - h + 1), (x - w + 4, y + 2)], 'c3')
    c.rect(x - w + 1, y - h + 3, x + w - 2, y + h - 3, 'c2')
    c.poly([(x - w + 1, y - h + 4), (x - w + 4, y - h + 1), (x + w - 4, y - h + 1), (x + w - 2, y - h + 4), (x - w + 4, y - h + 5)], 'c3')
    for k in (-1, 0, 1):
        c.line([(x + k * 5, y + 1), (x + k * 5, y + h - 2)], 'c1')
    c.line([(x - w + 2, y + h - 2), (x + w - 2, y + h - 2)], 'c1')


def draw(c, f):
    cx, gy = 32, 54
    if f <= 2:
        t = (f + 1) / 3
        y = lerp(-2, gy - 12, t * t)
        for k in range(1, 4):
            c.line([(cx - 8 + k * 8, y - 18 - k * 3), (cx - 8 + k * 8, y - 12 - k * 6)], 'c1')
        fist(c, cx, y, 12, 11)
    if f == 3:
        fist(c, cx, gy - 10, 12, 10)
    if f in (2, 3):
        c.spark(cx, gy - 2, 14 - (f - 2) * 4, 'y3', 'c4', diag=True)
    if f >= 3:
        t = (f - 3) / 4
        for k in range(6):
            crack(c, cx, gy, math.radians(190 + k * 28), 26, 3 + k, 'c0', min(1.0, t * 2), branch=1, k2='c1')
        for k in range(8):
            r = rng(4 + k)
            a = math.radians(210 + k * 15)
            d = r.uniform(10, 26) * ease(t)
            rock(c, cx + math.cos(a) * d, gy - 4 + math.sin(a) * d * 1.1 + t * t * 14, 2.6 - t, ['c0', 'c2', 'c3'], k, 5)
        c.oval(cx, gy, 8 + t * 24, 2 + t * 5, 'c3', 1)
    if f >= 4:
        dust(c, cx, gy + 2, 10 + (f - 4) * 3, 6, ['c1', 'c2', 'c3', 'c4'], fade=f >= 6)


if __name__ == '__main__':
    run(globals())
