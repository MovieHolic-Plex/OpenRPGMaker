"""elder_calm: 느긋한 숨: 느린 숨결 고리가 부풀었다 가라앉고 녹색 잎사귀 두 장이 몸 둘레를 돈다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'elder_calm', 64, 8, 'user'
PAL = pal(pick(LEAFG, 'g1', 'g2', 'g3'), pick(TEAL, 't1', 't2', 't3'), WHITE)


def draw(c, f):
    b = [.3, .6, .9, 1, .9, .7, .5, .35][f]
    c.ring(CX, 36, 10 + b * 12, 't2', squash=1.1)
    c.dring(CX, 36, 14 + b * 12, 't1', parity=f, squash=1.1)
    for i in range(2):
        a = f * .8 + i * math.pi
        x, y = CX + math.cos(a) * 16, 36 + math.sin(a) * 8
        c.leaf(x, y, a + 1.5, 5, 'g2', 'g3', 'g1')
    for j in range(3):
        steam(c, CX - 6 + j * 6, 16, 6 + b * 4, f * .3 + j, 't3', amp=1)
    if f == 3:
        c.spark(CX, 14, 3, 'w', 't3')


if __name__ == '__main__':
    run(globals())

