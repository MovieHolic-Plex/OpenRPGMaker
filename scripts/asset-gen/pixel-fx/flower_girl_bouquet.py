"""flower_girl_bouquet: 꽃다발 탄: 리본 묶은 분홍·노랑 꽃다발이 빙글 돌며 꽃잎을 흘린다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'flower_girl_bouquet', 32, 4, 'projectile'
PAL = pal(pick(ROSE, 'p0', 'p1', 'p2', 'p3', 'p4'), pick(LEAFG, 'g1', 'g2', 'g3'), pick(GOLDY, 'y2', 'y3'), pick(LEATHER, 'l1', 'l2'), WHITE)
EDGE = None


def draw(c, f):
    cx, cy = 12, 16
    a = f * math.pi / 2
    for i in range(3):
        c.line([pol(cx, cy, 2, a + 2.4 + i * .5), pol(cx, cy, 10, a + 2.4 + i * .5)], 'g1', 1)
    c.line([pol(cx, cy, 6, a + math.pi), pol(cx, cy, 11, a + math.pi)], 'g2', 2)
    c.line([pol(cx, cy, 8, a + math.pi - .3), pol(cx, cy, 13, a + math.pi + .5)], 'p3')
    for i, (dx, dy, k, rr) in enumerate(((-3, -2, 'p2', 3), (2, -3, 'y2', 2.5), (-1, 2, 'p3', 3), (3, 1, 'p1', 2.5), (-4, 2, 'y3', 2))):
        x, y = pol(cx, cy, math.hypot(dx, dy), math.atan2(dy, dx) + a)
        c.disc(x, y, rr, k)
        c.px(x - 1, y - 1, 'p4')
    c.disc(cx, cy, 1.5, 'y3')
    for i in range(4):
        c.petal(22 + (i * 4 + f * 3) % 9, 10 + (i * 5 + f * 2) % 13, i + f, 3, 'p2' if i % 2 else 'p3', None)


if __name__ == '__main__':
    run(globals())
