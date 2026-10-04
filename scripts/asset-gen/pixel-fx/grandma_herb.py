"""grandma_herb: 약초 찜질: 대상 위로 초록 약초 잎이 모여 내려앉아 감싸고 김이 오르며 치유된다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'grandma_herb', 64, 10, 'target'
PAL = pal(pick(LEAFG, 'g0', 'g1', 'g2', 'g3'), pick(PAPER, 'n2', 'n3'), pick(GOLDY, 'y2'), WHITE)


def draw(c, f):
    t = min(1, f / 5)
    for i in range(7):
        a = i * 2 * math.pi / 7 + f * .25
        d = lerp(24, 8, ease(t))
        x, y = CX + math.cos(a) * d, 34 + math.sin(a) * d * .6 - (1 - t) * 8
        c.leaf(x, y, a + math.pi / 2, 6, 'g2', 'g3', 'g0')
    if f >= 5:
        k = f - 5
        for j in range(4):
            steam(c, CX - 9 + j * 6, 30, 8 + k * 3, f * .4 + j, 'n3', amp=1.5)
        c.ring(CX, 36, 10 + k * 3, 'g3', squash=.7)
        if k in (1, 3):
            c.spark(CX + (k - 2) * 8, 22, 3, 'w', 'y2')
        if f == 9:
            dissolve(c, .45)


if __name__ == '__main__':
    run(globals())

