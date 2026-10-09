"""flower_girl_bloom_glow: 만개 여운: 아군 위로 꽃잎 빛기둥이 솟고 초록 십자가와 나비가 피어오른다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'flower_girl_bloom_glow', 64, 8, 'allAllies'
PAL = pal(ROSE, pick(LEAFG, 'g2', 'g3'), pick(GOLDY, 'y2', 'y3'), WHITE)


def draw(c, f):
    lvl = [.3, .7, 1, 1, 1, .9, .6, .3][f]
    beam(c, CX, 4, CX, 58, 3 * lvl + 1, 13 * lvl + 2, 'y3', 'p3', phase=-f * 3)
    c.ring(CX, 56, 14 * lvl + 4, 'g3', 1, squash=.3)
    c.dring(CX, 56, 20 * lvl + 4, 'p2', squash=.3, parity=f)
    for i in range(10):
        u = (i / 10 + f * .1) % 1
        a = u * 8 + i
        x, y = CX + math.cos(a) * (8 + 6 * u), 56 - u * 48 + math.sin(a) * 3
        c.petal(x, y, a + 1.2, 4, 'p2' if i % 2 else 'p3', 'p4')
    for j in range(3):
        c.rect(CX - 10 + j * 10 - 1, 30 - f * 2 - j * 3, CX - 10 + j * 10 + 1, 30 - f * 2 - j * 3 + 0, 'g3')
        c.rect(CX - 10 + j * 10, 30 - f * 2 - j * 3 - 2, CX - 10 + j * 10, 30 - f * 2 - j * 3 + 2, 'g3')
    for i in range(5):
        c.spark(CX - 12 + (i * 5) % 26, 50 - ((f * 6 + i * 9) % 44), 2, 'w', 'y3')


if __name__ == '__main__':
    run(globals())
