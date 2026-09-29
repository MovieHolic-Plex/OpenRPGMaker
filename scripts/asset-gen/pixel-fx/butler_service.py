"""butler_service: 완벽한 시중: 아군 둘레를 흰 장갑이 스치듯 돌며 옷매무새를 털고, 반짝이 먼지와 은빛 고리가 남는다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'butler_service', 64, 10, 'allAllies'
PAL = pal(pick(PAPER, 'n1', 'n3'), pick(STEELB, 'b1', 'b2', 'b3'), pick(GOLDY, 'y2'), WHITE)


def glove(c, x, y):
    c.disc(x, y, 3, 'n1')
    c.disc(x, y, 2, 'n3')
    for i in range(3):
        c.px(x - 3 + i * 2, y - 3, 'n3')


def draw(c, f):
    a = f * .7
    for i in range(2):
        aa = a + i * math.pi
        x, y = CX + math.cos(aa) * 18, 34 + math.sin(aa) * 12
        glove(c, x, y)
        tx, ty = CX + math.cos(aa - .5) * 18, 34 + math.sin(aa - .5) * 12
        c.line([(tx, ty), (x, y)], 'b2')
    r = rng(f)
    for i in range(8):
        c.px(CX + r.uniform(-20, 20), 20 + r.uniform(0, 34), 'b3' if i % 2 else 'y2')
    if f >= 5:
        c.ring(CX, FEET, 12 + (f - 5) * 2, 'b2', squash=.3)
        c.spark(CX + 14, 14, [0] * 5 + [3, 5, 4, 2, 1][f - 5:f - 4], 'w', 'b3') if False else c.spark(CX + 14, 14, [3, 5, 4, 2, 1][f - 5], 'w', 'b3')


if __name__ == '__main__':
    run(globals())

