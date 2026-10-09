"""squire_knighting: 기사 서임: 하늘에서 빛의 검이 내려와 방패 문장 위에 꽂히고 금빛 원과 빛기둥이 무대를 밝힌다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'squire_knighting', 128, 12, 'screen'
PAL = pal(pick(GOLDY, 'y1', 'y2', 'y3'), pick(ICEB, 'i1', 'i2', 'i3', 'i4'), pick(STEELB, 'b0', 'b3'), WHITE)
GX, GY = 64, 86


def sword(c, x, y, L, s=1.0):
    """수직 큰 검: 칼끝 (x, y) 아래, 위로 L. 십자 가드와 자루."""
    c.poly([(x, y), (x - 5 * s, y - 10 * s), (x - 5 * s, y - L * .75), (x + 5 * s, y - L * .75), (x + 5 * s, y - 10 * s)], 'b0')
    c.poly([(x, y - 1), (x - 4 * s, y - 10 * s), (x - 4 * s, y - L * .75), (x + 4 * s, y - L * .75), (x + 4 * s, y - 10 * s)], 'i3')
    c.rect(x - 1, y - 8 * s, x + 1, y - L * .75 + 2, 'w')
    c.line([(x - 3 * s, y - 12 * s), (x - 3 * s, y - L * .7)], 'i2')
    gy = y - L * .75
    c.rect(x - 14 * s, gy - 3, x + 14 * s, gy + 1, 'y1')
    c.rect(x - 13 * s, gy - 2, x + 13 * s, gy, 'y2')
    c.disc(x - 15 * s, gy - 1, 2, 'y3')
    c.disc(x + 15 * s, gy - 1, 2, 'y3')
    c.rect(x - 2, gy - 12 * s, x + 2, gy - 3, 'i1')
    c.rect(x - 1, gy - 12 * s, x, gy - 3, 'i2')
    c.disc(x, gy - 13 * s, 3, 'y2')
    c.px(x - 1, gy - 14 * s, 'w')


def draw(c, f):
    lvl = [.3, .55, .8, 1, 1, 1, 1, 1, 1, 1, .7, .4][f]
    shade(c, 64, 70, 48 * lvl + 14, 'b0', squash=.8)
    # 빛기둥
    if f >= 1:
        beam(c, GX, 0, GX, GY, 6 + 6 * lvl, 12 + 14 * lvl, 'w', 'y2', phase=f * 4)
    # 바닥 원
    c.ring(GX, GY, 36 * lvl + 6, 'y2', 2, squash=.3)
    c.ring(GX, GY, 26 * lvl + 4, 'y3', 1, squash=.3)
    if f >= 3:
        for i in range(12):
            x, y = pol(GX, GY, 41 * lvl, f * .3 + i * math.pi / 6, .3)
            c.px(x, y, 'w' if i % 2 else 'y3')
    # 검
    if f >= 2:
        ty = [0, 0, 10, 40, 70, 78, 78, 78, 78, 78, 78, 78][f]
        sword(c, GX, ty, 66, 1.0)
    if f in (4, 5):
        star(c, GX, GY - 2, 12, 18 + (f - 4) * 12, 8, 'y2', rot=.2)
        c.disc(GX, GY - 2, 6, 'w')
    for i in range(12):
        c.spark(14 + (i * 19 + f * 5) % 100, 10 + (i * 23) % 96, 2 if i % 2 else 1, 'w', 'y3') if (i + f) % 2 == 0 else None


if __name__ == '__main__':
    run(globals())
