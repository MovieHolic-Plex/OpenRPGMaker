"""miner_burrow: 땅굴 기습: 대상 발밑에 흙더미가 부풀고 균열이 퍼지다가 흙이 폭발하듯 솟구친다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'miner_burrow', 64, 10, 'target'
PAL = pal(EARTHB, pick(STONE, 'r0', 'r1', 'r2', 'r3'), pick(GOLDY, 'y2', 'y3'), WHITE)
GX, GY = 32, 54


def draw(c, f):
    if f <= 4:
        h = [2, 3, 5, 6, 8][f]
        w = 8 + f * 2
        c.oval(GX + (f % 2), GY - h * .4, w, h * .6, 'd1')
        c.oval(GX + (f % 2) - 1, GY - h * .6, w * .7, h * .35, 'd2')
        c.px(GX - 3, GY - h * .7, 'd3')
        if f >= 2:
            crack(c, GX, GY, 0, 5, 10 + f * 2, ('d0', 'd2'), 3, grow=f / 4, squash=.25)
        for i in range(f):
            c.px(GX - w + i * 5, GY - h - 1 - (i % 2), 'd3')
    if f == 5:
        pow_burst(c, GX, GY - 10, 14, ['d1', 'd2', 'd3', 'w'], rot=.2, n=9)
        c.line([(GX, GY - 4), (GX, GY - 30)], 'y3', 3)
        c.spark(GX, GY - 30, 5, 'w', 'y2')
    if f >= 5:
        t = (f - 5) / 4
        debris(c, GX, GY - 4, t, 14, 7, ['d2', 'd1', 'r2', 'd3'], spd=(12, 30), up=1.3, grav=1.8)
        crack(c, GX, GY, 0, 6, 20, ('d0', 'd1'), 3, grow=1, squash=.25)
    if f >= 7:
        dust_puff(c, GX - 10, GY, 7, ['d1', 'd2'], f)
        dust_puff(c, GX + 10, GY, 7, ['d1', 'd2'], f + 1)


if __name__ == '__main__':
    run(globals())

