"""alchemist_stone: 현자의 돌: 붉은 보석이 깨어나 거대한 연성진이 무대를 뒤덮고 붉은 금빛 광선이 모여 폭주한다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'alchemist_stone', 128, 12, 'screen'
PAL = pal(EMBER, pick(GOLDY, 'y1', 'y2', 'y3'), pick(ROSE, 'p2'), WHITE)
GX, GY = 64, 30
OX, OY = 64, 88


def draw(c, f):
    lvl = [.3, .5, .7, .9, 1, 1, 1, 1, 1, 1, .7, .4][f]
    shade(c, 64, 70, 50 * lvl + 14, 'm0', squash=.8)
    # 지면 연성진
    R = 50 * lvl
    ry = .34
    c.ring(OX, OY, R, 'y2', 2, squash=ry)
    c.ring(OX, OY, R * .78, 'm3', 1, squash=ry)
    if lvl > .5:
        hexagram(c, OX, OY, R * .95, 'y3', rot=f * .25, squash=ry, w=1)
        for i in range(12):
            x, y = pol(OX, OY, R * 1.12, f * .25 + i * math.pi / 6, ry)
            c.px(x, y, 'w' if i % 3 == 0 else 'y2')
    # 보석 + 모이는 광선
    if f >= 2:
        for i in range(10):
            a = i * .63 + f * .1
            t = ((f * .18 + i * .1) % 1)
            x0, y0 = pol(OX, OY, R, a, ry)
            x, y = lerp(x0, GX, t), lerp(y0, GY, t)
            c.line([(x, y), (lerp(x0, GX, max(0, t - .12)), lerp(y0, GY, max(0, t - .12)))], 'y3')
        s = 1 + (f % 2) * .1
        c.disc(GX, GY, 15 * s, 'm1')
        c.dring(GX, GY, 21 * s, 'm3', parity=f)
        gem(c, GX, GY, 8 * s, ['m1', 'm2', 'm4', 'w'])
        c.rays(GX, GY, 12, 14, 26 + (f % 3) * 3, 'y2', rot=f * .2, jitter=[1, .55, .8, .65])
    if f >= 6:
        beam(c, GX, GY, OX, OY, 4, 10 + f, 'y3', 'm3', phase=f * 3)
    if f >= 9:
        star(c, GX, GY, 12, 30 + (f - 9) * 10, 14, 'm3', rot=.1)
        star(c, GX, GY, 12, 18 + (f - 9) * 6, 8, 'm4', rot=.1)
        c.disc(GX, GY, 8, 'w')
    for i in range(10):
        x = 18 + (i * 21 + f * 5) % 92
        y = 112 - ((f * 8 + i * 13) % 96)
        c.px(x, y, 'm4' if i % 2 else 'y3')


if __name__ == '__main__':
    run(globals())
