"""farmer_hay: 건초 더미: 아군 둘레에 건초 더미가 쌓여 오르며 짚이 날리고 따뜻한 보호막으로 감싼다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'farmer_hay', 64, 10, 'allAllies'
PAL = pal(pick(GOLDY, 'y0', 'y1', 'y2', 'y3'), pick(EARTHB, 'd1', 'd2'), WHITE)


def draw(c, f):
    h = [2, 5, 9, 13, 16, 18, 18, 18, 16, 12][f]
    for side in (-1, 1):
        x = CX + side * 16
        c.oval(x, FEET - h * .5, 7, h * .55, 'y1')
        c.oval(x - 1, FEET - h * .6, 5, h * .4, 'y2')
        for j in range(4):
            c.line([(x - 4 + j * 3, FEET - h * .9 + j % 2), (x - 5 + j * 3, FEET - h * .9 - 3)], 'y3')
        c.line([(x - 6, FEET - h * .45), (x + 6, FEET - h * .45)], 'd2')
    if 3 <= f <= 8:
        c.dring(CX, FEET - 16, 18 + (f % 2), 'y2', parity=f, squash=.9)
    r = rng(f)
    for i in range(6):
        x = CX + r.uniform(-24, 24)
        y = FEET - r.uniform(10, 42)
        a = r.uniform(0, math.pi)
        c.line([(x, y), (x + math.cos(a) * 3, y + math.sin(a) * 2)], 'y3' if i % 2 else 'y1')
    if f in (5, 6):
        c.spark(CX, FEET - 34, 4, 'w', 'y3')


if __name__ == '__main__':
    run(globals())

