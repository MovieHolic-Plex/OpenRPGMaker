"""miner_gem: 보석 발견: 발밑 바위가 갈라지며 푸른 보석이 떠올라 반짝이고 몸으로 빛이 스민다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'miner_gem', 64, 8, 'user'
PAL = pal(pick(ICEB, 'i0', 'i1', 'i2', 'i3', 'i4'), pick(STONE, 'r0', 'r1', 'r2'), pick(GOLDY, 'y2', 'y3'), WHITE)


def draw(c, f):
    gy = [52, 50, 44, 36, 28, 26, 26, 30][f]
    if f <= 2:
        rock(c, 30, 52, 6 - f, ('r0', 'r1', 'r2'), 4)
        rock(c, 36, 53, 5 - f, ('r0', 'r1', 'r2'), 5)
    if f >= 1:
        s = [0, 2, 3, 4, 5, 5, 4, 3][f]
        gem(c, 32, gy, s, ('i0', 'i1', 'i2', 'i4'))
    if 3 <= f <= 6:
        c.spark(32 + (f % 2) * 6 - 3, gy - 7, [0, 0, 0, 5, 4, 6, 3][f], 'w', 'y3')
        tick_ring(c, 32, gy, 9 + f, 8, 'i3', rot=f * .3, L=2)
    if f >= 5:
        converge(c, 32, 40, (f - 5) / 2, 8, 2, ['i2', 'i4'], r0=20, r1=4)
    if f == 7:
        c.dring(32, 40, 12, 'i3', parity=1)


if __name__ == '__main__':
    run(globals())

