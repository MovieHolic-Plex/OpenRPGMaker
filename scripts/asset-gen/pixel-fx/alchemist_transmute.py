"""alchemist_transmute: 등가 교환: 발밑에 육망성 연성진이 그려지고 금빛 기둥과 덮개가 솟아 아군을 감싼다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'alchemist_transmute', 64, 10, 'allAllies'
PAL = pal(GOLDY, pick(ROSE, 'p2', 'p3'), pick(EMBER, 'm2', 'm3'), WHITE)


def draw(c, f):
    lvl = [.3, .6, .9, 1, 1, 1, 1, .8, .5, .3][f]
    r = 22 * lvl
    ry = .34
    OY = 54
    # 연성진: 이중 원 + 육망성 + 룬 점
    c.ring(CX, OY, r, 'y2', 2 if lvl > .6 else 1, squash=ry)
    c.ring(CX, OY, r * .72, 'y1', 1, squash=ry)
    if lvl > .5:
        hexagram(c, CX, OY, r * .95, 'y3', rot=f * .35, squash=ry)
        for i in range(8):
            x, y = pol(CX, OY, r * 1.16, f * .35 + i * math.pi / 4, ry)
            c.px(x, y, 'w' if i % 2 else 'y3')
    # 금빛 기둥 + 덮개(점묘)
    if f >= 2:
        beam(c, CX, 6, CX, OY - 2, 8 * lvl, r * .7, 'y3', 'y2', phase=-f * 3)
        for i in range(10):
            a = i * math.pi / 9
            x, y = pol(CX, 34, 22 * lvl, math.pi + a, 1.05)
            if i % 2 == f % 2:
                c.px(x, y, 'p3')
    for i in range(6):
        c.spark(14 + (i * 10 + f * 3) % 38, 50 - ((f * 6 + i * 11) % 44), 2 if i % 2 else 1, 'w', 'y3')
    if f in (3, 4):
        c.spark(CX, 30, 7, 'w', 'y3', diag=True)


if __name__ == '__main__':
    run(globals())
