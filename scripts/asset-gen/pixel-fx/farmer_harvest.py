"""farmer_harvest: 수확: 크게 휘두른 쇠스랑이 낫처럼 가로 원을 그리고 밀 이삭이 흩날린다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'farmer_harvest', 64, 10, 'allTargets'
PAL = pal(pick(GOLDY, 'y0', 'y1', 'y2', 'y3'), pick(LEAFG, 'g1', 'g2'), pick(STONE, 'r2', 'r3'), WHITE)


def ear(c, x, y, a):
    ux, uy = math.cos(a), math.sin(a)
    c.line([(x, y), (x + ux * 5, y + uy * 5)], 'g1')
    for j in range(3):
        c.px(x + ux * (5 + j), y + uy * (5 + j), 'y2')
        c.px(x + ux * (5 + j) - uy, y + uy * (5 + j) + ux, 'y1')


def draw(c, f):
    if 1 <= f <= 7:
        a0 = -200 + f * 40
        band(c, CX, 38, 26, 12, a0, a0 + 140, 7, ['y1', 'y2', 'y3', 'w'])
    r = rng(4)
    for i in range(10):
        a = r.uniform(0, 2 * math.pi)
        t = max(0, (f - 2) / 7)
        d = 8 + t * r.uniform(14, 24)
        x, y = CX + math.cos(a) * d, 40 + math.sin(a) * d * .5 - t * 10 + t * t * 14
        if f >= 2 and not (f == 9 and i % 2):
            ear(c, x, y, a + f * .6)
    if f == 0:
        for x in range(14, 52, 6):
            ear(c, x, 48, -math.pi / 2)
    if f in (4, 5):
        c.spark(CX - 20 + f * 6, 32, 4, 'w', 'y3')


if __name__ == '__main__':
    run(globals())

