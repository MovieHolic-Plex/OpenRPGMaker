"""squire_courage: 용기의 외침: 붉은 깃발이 펄럭이며 솟고 금빛 별과 위로 향한 화살표가 아군 위로 번진다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'squire_courage', 64, 10, 'allAllies'
PAL = pal(pick(EMBER, 'm0', 'm1', 'm2', 'm3'), pick(GOLDY, 'y1', 'y2', 'y3'), pick(LEATHER, 'l1', 'l2'), WHITE)


def draw(c, f):
    lvl = [.4, .7, 1, 1, 1, 1, 1, 1, .7, .4][f]
    # 깃대
    top = 58 - 46 * min(1, lvl * 1.2)
    c.line([(CX - 8, 58), (CX - 8, top)], 'l1', 2)
    c.line([(CX - 9, 58), (CX - 9, top)], 'l2')
    c.disc(CX - 8, top - 1, 2, 'y2')
    # 깃발(사인 물결)
    W = 22 * lvl
    for x in range(int(W)):
        y0 = top + 2 + math.sin(x * .45 - f * 1.3) * 2.2
        c.line([(CX - 7 + x, y0), (CX - 7 + x, y0 + 12 - x * .12)], 'm2')
        c.px(CX - 7 + x, y0, 'm3')
        c.px(CX - 7 + x, y0 + 12 - x * .12, 'm1')
    # 깃발 문장: 금 별
    if W > 10:
        c.spark(CX + 1, top + 8 + math.sin(4 - f * 1.3) * 2, 3, 'y3', 'y2')
    # 화살표
    for j in range(3):
        chevron(c, CX + 6 + j * 8, 46 - f * 3 - j * 4, 3, 'y3', ol='m0', up=True)
    for i in range(7):
        c.spark(10 + (i * 8 + f * 3) % 46, 54 - ((f * 6 + i * 9) % 46), 2 if i % 2 else 1, 'w', 'y3') if (i + f) % 2 == 0 else None
    c.dring(CX, 57, 14 + lvl * 6, 'y2', squash=.3, parity=f)


if __name__ == '__main__':
    run(globals())
