"""miner_rockfall: 낙석: 위에서 모난 바위 세 개가 떨어져 차례로 부서지며 먼지가 인다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'miner_rockfall', 64, 10, 'allTargets'
PAL = pal(STONE, pick(EARTHB, 'd1', 'd2', 'd3'), WHITE)
ROCKS = [(22, 0, 6, 1), (40, 2, 7, 2), (31, 4, 5, 3)]


def draw(c, f):
    for i, (x, start, r, seed) in enumerate(ROCKS):
        t = f - start
        if t < 0:
            if t >= -2:
                c.px(x + (f % 2), 4 - t, 'd2')
            continue
        y = 6 + t * 14
        if y < 42:
            rock(c, x, y, r, ('r0', 'r2', 'r3'), seed)
            c.line([(x - 2, y - r - 6), (x - 2, y - r - 2)], 'r3')
            c.line([(x + 2, y - r - 8), (x + 2, y - r - 3)], 'r3')
        else:
            tt = min(1, (y - 42) / 40)
            if tt < .15:
                pow_burst(c, x, 48, r + 5, ['r1', 'r2', 'r3', 'w'], rot=seed, n=7)
            debris(c, x, 48, tt + .1, 8, seed + 10, ['r2', 'r1', 'r3'], spd=(6, 18))
            dust_puff(c, x, 54, 5 + tt * 6, ['d1', 'd2'], seed + f)


if __name__ == '__main__':
    run(globals())

