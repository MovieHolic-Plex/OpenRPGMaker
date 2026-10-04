"""butler_silver_rain: 은빛 비: 하늘에서 은 식기가 비처럼 쏟아져 적진 바닥에 꽂히고 반짝인다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'butler_silver_rain', 64, 10, 'allTargets'
PAL = pal(pick(STEELB, 'b0', 'b1', 'b2', 'b3'), pick(GOLDY, 'y2'), WHITE)


def draw(c, f):
    r = rng(5)
    drops = [(r.uniform(8, 56), r.uniform(-30, 0), r.random() < .5) for _ in range(14)]
    for x, y0, isfork in drops:
        y = y0 + f * 8
        if y < 2:
            continue
        if y < 46:
            c.line([(x, y - 8), (x, y)], 'b1', 2 if isfork else 1)
            c.px(x, y, 'w')
            c.line([(x + 1, y - 14), (x + 1, y - 9)], 'b2')
        else:
            c.line([(x, 42), (x, 48)], 'b1', 2 if isfork else 1)
            c.px(x, 41, 'y2')
            if y < 54:
                c.spark(x, 48, 2, 'w', 'b3')
    c.dring(CX, 50, 12 + f * 2, 'b2', squash=.3, parity=f)


if __name__ == '__main__':
    run(globals())

