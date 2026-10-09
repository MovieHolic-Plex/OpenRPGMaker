"""grandma_feast: 할머니의 잔칫상: 화면 가운데 큰 상이 차려지고 음식 그릇에서 김이 솟아 하트와 빛방울이 아군 쪽으로 번진다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'grandma_feast', 128, 12, 'screen'
PAL = pal(pick(EARTHB, 'd0', 'd1', 'd2'), pick(EMBER, 'm2', 'm3'), pick(PAPER, 'n2', 'n3'), pick(ROSE, 'p1', 'p2', 'p3'), pick(LEAFG, 'g2'), pick(GOLDY, 'y2'), WHITE)
OX, OY = 64, 76
DISHES = [(40, 'm2'), (54, 'g2'), (68, 'y2'), (82, 'p2'), (96, 'm3')]


def draw(c, f):
    lvl = [.3, .55, .8, 1, 1, 1, 1, 1, 1, 1, .7, .35][f]
    shade(c, OX, OY - 8, 50 * lvl + 12, 'd0', squash=.8, dense='d0')
    w = min(1, f / 3) * 40 + (1 if f == 5 else 0)
    c.oval(OX, OY, w + 2, 9, 'd0')
    c.oval(OX, OY - 1, w, 7, 'd2')
    c.line([(OX - w * .8, OY + 6), (OX - w * .8, OY + 16)], 'd1', 2)
    c.line([(OX + w * .8, OY + 6), (OX + w * .8, OY + 16)], 'd1', 2)
    for i, (x, k) in enumerate(DISHES):
        if f < 2 + i // 2:
            continue
        c.oval(x, OY - 3, 5, 2.5, 'n2')
        c.oval(x, OY - 4, 4, 1.5, k)
        if f >= 4 and (f + i) % 2:
            bubble(c, x - 1 + (f % 3), OY - 6, 1, 'n3')
        if f >= 4:
            steam(c, x, OY - 7, 10 + (f - 4) * 4, f * .9 + i, 'n3', amp=2)
    if f in (4, 5):
        c.spark(40 + (f - 4) * 56, OY - 16, 3, 'w', 'y2')
    if f >= 6:
        k = f - 6
        for i in range(8):
            a = -math.pi / 2 + (i - 3.5) * .35
            d = 16 + k * 8 + (i % 2) * 5
            x, y = OX + math.cos(a) * d * 1.3, OY - 20 + math.sin(a) * d
            heart(c, x, y, 2 if i % 2 else 3, 'p2', ol='p1')
        c.ring(OX, OY - 10, 30 + k * 6, 'p3', squash=.6)
    if f in (7, 9):
        c.spark(OX, OY - 34, 8, 'w', 'p3', diag=True)


if __name__ == '__main__':
    run(globals())

