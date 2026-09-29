"""grandma_moxa: 뜸: 몸 둘레에 작은 뜸 뭉치 네 개가 놓여 불씨가 붙고 따뜻한 연기가 둘러싸 보호막이 된다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'grandma_moxa', 64, 8, 'user'
PAL = pal(pick(EMBER, 'm1', 'm2', 'm3', 'm4'), pick(PAPER, 'n1', 'n2', 'n3'), pick(GOLDY, 'y2'), WHITE)
SPOTS = [(18, 30), (46, 30), (22, 46), (42, 46)]


def draw(c, f):
    for i, (x, y) in enumerate(SPOTS):
        if f < i:
            continue
        c.poly([(x - 2, y + 2), (x + 2, y + 2), (x, y - 3)], 'n2')
        c.px(x, y - 2, 'n3')
        if f >= i + 1:
            c.px(x, y - 4, 'm4' if (f + i) % 2 else 'm3')
            steam(c, x, y - 5, 6 + f, f * .4 + i, 'n1', amp=1)
    if f >= 4:
        c.dring(CX, 38, 18 + (f - 4), 'm3', parity=f, squash=1)
        c.ring(CX, 38, 16, 'm2' if f % 2 else 'y2')
    if f == 6:
        c.spark(CX, 20, 4, 'w', 'm4')


if __name__ == '__main__':
    run(globals())

