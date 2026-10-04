"""priest_monk_beads: 염주 던지기: 염주알이 부채꼴로 흩어져 날아가 대상에 따닥 맞고 알알이 튕긴다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'priest_monk_beads', 64, 8, 'target'
PAL = pal(pick(EARTHB, 'd0', 'd1', 'd2', 'd3'), pick(GOLDY, 'y2', 'y3'), WHITE)


def draw(c, f):
    r = rng(2)
    beads = [(r.uniform(-10, 10), r.uniform(-10, 10)) for _ in range(9)]
    for i, (ox, oy) in enumerate(beads):
        if f <= 3:
            t = f / 3
            x, y = lerp(60, 30 + ox, t), lerp(24 + oy * .2, 32 + oy, t)
        else:
            t = (f - 3) / 4
            x, y = 30 + ox + ox * t * 1.4, 32 + oy - t * 8 + t * t * 20
        c.disc(x, y, 1.6, 'd1')
        c.px(x - 1, y - 1, 'd3')
    if f == 3:
        for ox, oy in beads[::2]:
            c.spark(30 + ox, 32 + oy, 2, 'w', 'y2')
    if 3 <= f <= 5:
        c.ring(30, 32, 8 + (f - 3) * 4, 'y2')


if __name__ == '__main__':
    run(globals())

