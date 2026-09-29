"""gunslinger_hat: 모자 인사: 머리 위 중절모 실루엣이 기울어 챙을 내리고, 그림자 속 눈빛과 조준 반짝이가 켜진다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'gunslinger_hat', 64, 8, 'user'
PAL = pal(pick(INKK, 'k0', 'k1', 'k2'), pick(GOLDY, 'y1', 'y2', 'y3'), pick(EMBER, 'm2', 'm3'), WHITE)


def hat(c, x, y, a):
    brim = rot_pts([(x - 11, y + 3), (x + 11, y + 3), (x + 11, y + 5), (x - 11, y + 5)], x, y, a)
    crown = rot_pts([(x - 6, y - 5), (x + 6, y - 5), (x + 6, y + 3), (x - 6, y + 3)], x, y, a)
    c.poly(brim, 'k1', outline='k0')
    c.poly(crown, 'k1', outline='k0')
    c.line(rot_pts([(x - 6, y + 1), (x + 6, y + 1)], x, y, a), 'y1', 1)


def draw(c, f):
    a = [0, -.1, -.25, -.3, -.3, -.3, -.2, -.1][f]
    y = [10, 12, 14, 15, 15, 15, 14, 13][f]
    hat(c, CX, y, a)
    if 3 <= f <= 6:
        c.px(CX - 4, 24, 'm3'); c.px(CX + 2, 24, 'm3')
        c.spark(CX - 14, 24, [0, 0, 0, 3, 5, 4, 2][f], 'w', 'y3', diag=True)
    if f >= 4:
        tick_ring(c, CX, 34, 14 + (f - 4) * 2, 8, 'y2', rot=f * .2, L=2)
    c.dring(CX, FEET, 10 + f, 'k2', squash=.3, parity=f)


if __name__ == '__main__':
    run(globals())

