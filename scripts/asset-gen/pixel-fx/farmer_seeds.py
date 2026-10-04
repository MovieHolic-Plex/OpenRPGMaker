"""farmer_seeds: 씨앗 흩뿌리기: 오른쪽에서 씨앗 한 줌이 부채꼴로 날아와 대상에 따닥 박히고 새싹이 돋는다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'farmer_seeds', 64, 8, 'target'
PAL = pal(pick(EARTHB, 'd0', 'd1', 'd2', 'd3'), pick(LEAFG, 'g1', 'g2', 'g3'), WHITE)


def draw(c, f):
    r = rng(8)
    seeds = [(r.uniform(-12, 12), r.uniform(-10, 10)) for _ in range(12)]
    if f <= 3:
        for i, (ox, oy) in enumerate(seeds):
            t = f / 3
            x = lerp(56, 30 + ox, t) + (i % 3) * 2
            y = lerp(20 + oy * .3, 32 + oy, t)
            c.oval(x, y, 1.4, 1, 'd2')
            c.px(x - 1, y, 'd3')
            c.px(x + 2, y, 'd1')
    if f == 3:
        for ox, oy in seeds[::3]:
            c.spark(30 + ox, 32 + oy, 2, 'w', 'd3')
    if f >= 4:
        g = f - 4
        for i, (ox, oy) in enumerate(seeds):
            x, y = 30 + ox, 32 + oy
            c.px(x, y, 'd1')
            if i % 2 == 0 and g >= 1:
                c.line([(x, y), (x, y - g)], 'g1')
                c.px(x - 1, y - g, 'g2')
                c.px(x + 1, y - g - 1, 'g3')
        if f == 4:
            burst(c, 30, 32, .5, 10, 2, ['d3', 'd2'], spd=(4, 12))


if __name__ == '__main__':
    run(globals())

