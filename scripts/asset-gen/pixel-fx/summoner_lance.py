"""summoner_lance: 정령 창: 왼쪽을 겨눈 푸른 유령 창과 물결치는 영혼 꼬리
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'summoner_lance', 32, 4, 'projectile'
PAL = pal(pick(TEAL, 't1', 't2', 't3'), pick(ICEB, 'i2', 'i3', 'i4'), pick(PURP, 'v2', 'v3'), WHITE)
EDGE = None


def draw(c, f):
    y = 16
    # 영혼 꼬리(사인 두 가닥)
    for k, col in ((0, 'i2'), (1, 't2')):
        pts = [(22 + i * 1.5, y + math.sin(i * .7 + f * 1.6 + k * 2) * (2 + i * .25)) for i in range(8)]
        c.line(pts, col, 1)
    # 자루 + 고리 장식
    c.line([(9, y), (24, y)], 'i3', 2)
    c.line([(9, y - 1), (24, y - 1)], 'i4', 1)
    for x in (13, 19):
        c.line([(x, y - 3), (x, y + 3)], 'v3')
    # 창날
    c.poly([(2, y), (9, y - 4), (11, y), (9, y + 4)], 'i2')
    c.poly([(3, y), (9, y - 3), (10, y)], 'i4')
    c.line([(3, y), (10, y)], 'w')
    for i in range(3):
        c.px(24 + (i * 3 + f * 2) % 8, y - 4 + (i * 3 + f) % 8, 'w' if i % 2 else 't3')
    c.spark(3, y, 2, 'w', 't3') if f % 2 == 0 else None


if __name__ == '__main__':
    run(globals())
