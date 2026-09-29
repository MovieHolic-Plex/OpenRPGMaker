"""alchemist_bomb_fuse: 연금 폭탄 탄: 심지가 타는 검은 쇠 폭탄이 구르며 날고 불똥이 흩날린다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'alchemist_bomb_fuse', 32, 4, 'projectile'
PAL = pal(pick(STEELB, 'b0', 'b1', 'b2', 'b3'), pick(EMBER, 'm2', 'm3', 'm4'), pick(LEATHER, 'l2', 'l3'), pick(GOLDY, 'y2'), WHITE)
EDGE = None


def draw(c, f):
    cx, cy = 13, 17
    c.disc(cx, cy, 7, 'b0')
    c.disc(cx, cy, 6, 'b1')
    # 구르는 하이라이트
    a = f * math.pi / 2
    hx, hy = pol(cx, cy, 3.4, a - 2.4)
    c.disc(hx, hy, 1.6, 'b2')
    c.px(hx - .5, hy - .5, 'b3')
    # 리벳 띠
    c.arc(cx, cy, 5, 200 + f * 90, 320 + f * 90, 'b0', 1)
    # 심지: 위쪽에서 구불
    fx, fy = cx + 2, cy - 7
    c.line([(fx, fy), (fx + 2, fy - 3), (fx + 1, fy - 5)], 'l2', 1)
    c.rect(cx, cy - 8, cx + 3, cy - 6, 'b3')
    tipx, tipy = fx + 1, fy - 6
    c.spark(tipx, tipy, 2 + (f % 2), 'w', 'm3')
    for i in range(5):
        px_ = tipx + 1 + (i * 3 + f * 4) % 9
        py_ = tipy - 2 + (i * 5 + f * 3) % 7
        c.px(px_, py_, 'm4' if i % 2 else 'y2')
    for i in range(4):
        c.px(22 + (f * 3 + i * 4) % 9, 15 + i * 2, 'm2')


if __name__ == '__main__':
    run(globals())
