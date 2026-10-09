"""grandma_broth: 보양탕: 아군 발치에 뚝배기가 놓이고 보글보글 끓어 김이 모락모락 올라 몸을 감싼다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'grandma_broth', 64, 10, 'allAllies'
PAL = pal(pick(EARTHB, 'd0', 'd1', 'd2'), pick(EMBER, 'm1', 'm2', 'm3'), pick(PAPER, 'n2', 'n3'), pick(LEAFG, 'g2'), WHITE)


def draw(c, f):
    px_ = 40 if f < 2 else 48
    c.oval(px_ - 20, 52, 9, 4, 'd0')
    c.oval(px_ - 20, 50, 8, 3, 'd1')
    c.oval(px_ - 20, 49, 6, 1.5, 'm2')
    c.px(px_ - 23, 49, 'g2'); c.px(px_ - 18, 49, 'g2')
    c.flame(px_ - 20, 57, 2, 3, ['m1', 'm3'])
    for i in range(3):
        bx = px_ - 23 + i * 3
        by = 49 - (f + i) % 3
        bubble(c, bx, by, 1, 'm3')
    h = min(1, f / 5)
    for j in range(5):
        steam(c, CX - 12 + j * 6, 46, 8 + h * 30, f * .35 + j, 'n3' if j % 2 else 'n2', amp=2)
    if f >= 5:
        c.dring(CX, 30, 16, 'n3', parity=f)
    if f in (6, 8):
        c.spark(CX, 14, 3, 'w', 'n3')


if __name__ == '__main__':
    run(globals())

