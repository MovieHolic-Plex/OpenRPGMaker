"""dancer_waltz: 달빛 왈츠: 초승달에서 흰 빛 기둥이 내리고 발자국 점이 원을 돌며 별가루가 흩날린다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'dancer_waltz', 64, 10, 'allAllies'
PAL = pal(pick(ICEB, 'i1', 'i2', 'i3', 'i4'), pick(PURP, 'v1', 'v2'), pick(GOLDY, 'y2', 'y3'), WHITE)
MX, MY = 32, 12


def draw(c, f):
    lvl = [.3, .6, 1, 1, 1, 1, 1, 1, .7, .4][f]
    # 달빛 원뿔: 가장자리는 점묘, 안쪽 밝은 띠가 흘러내린다
    beam(c, MX, MY + 4, CX, 58, 3, 6 + 17 * lvl, 'i3', 'i2', phase=f * 3)
    for j in range(4):
        y = MY + 8 + ((f * 5 + j * 12) % 44)
        half = 3 + (y - MY) / 44 * 15 * lvl
        c.line([(CX - half * .6, y), (CX + half * .6, y)], 'i4')
    # 초승달
    c.crescent(MX, MY, 8 * (.6 + .4 * lvl), ['i1', 'i2', 'i3', 'i4'][:4], 4, -2, cut=6)
    c.spark(MX - 6, MY - 5, 3, 'w', 'i3')
    # 바닥 원과 스텝 점
    c.ring(CX, 54, 16, 'i2', 1, squash=.3)
    for i in range(8):
        a = f * .5 + i * math.pi / 4
        x, y = pol(CX, 54, 16, a, .3)
        c.disc(x, y, 1.4 if i % 2 else 1, 'w' if i == f % 8 else 'i4')
    for i in range(7):
        x = 12 + (i * 9 + f * 3) % 42
        y = 50 - ((f * 5 + i * 11) % 40)
        c.spark(x, y, 2 if i % 2 else 1, 'y3', 'v2') if (i + f) % 2 == 0 else c.px(x, y, 'i4')


if __name__ == '__main__':
    run(globals())
