"""farmer_turnip: 순무 뽑기: 거대한 흰 순무가 잎을 휘날리며 위에서 떨어져 대상을 쿵 짓누른다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'farmer_turnip', 64, 10, 'target'
PAL = pal(pick(LEAFG, 'g0', 'g1', 'g2', 'g3'), pick(ROSE, 'p1', 'p2'), pick(PAPER, 'n1', 'n2', 'n3'), pick(EARTHB, 'd1', 'd2'), WHITE)


def turnip(c, x, y, s, a=0.0):
    c.disc(x, y, s + 1, 'n1')
    c.disc(x, y, s, 'n3')
    c.disc(x, y - s * .45, s * .75, 'p2')
    c.disc(x - s * .3, y - s * .6, s * .3, 'p1')
    c.line([(x, y + s), (x + 1, y + s + 3)], 'n1')
    for i, da in enumerate((-.6, 0, .6)):
        aa = -math.pi / 2 + da + a
        tip = (x + math.cos(aa) * s * 1.6, y - s + math.sin(aa) * s * 1.2)
        c.line([(x, y - s), tip], 'g1', 3)
        c.line([(x, y - s), tip], 'g2', 1)
        c.px(*tip, 'g3')
    c.px(x - s * .4, y - s * .1, 'w')


def draw(c, f):
    y = [8, 14, 20, 27, 34, 36, 35, 36, 36, 36][f]
    wob = [0, .3, -.3, .2, 0, .5, -.4, .2, 0, 0][f]
    s = [5, 6, 7, 8, 10, 9, 9, 9, 9, 9][f]
    if f <= 3:
        for j in range(3):
            c.line([(26 + j * 6, y - 20), (26 + j * 6, y - 26)], 'n2')
    if f == 4:
        pow_burst(c, 32, 48, 13, ['d1', 'd2', 'n2', 'w'], rot=.1, n=9)
    if f >= 4:
        debris(c, 32, 50, (f - 4) / 5, 10, 3, ['d2', 'd1', 'g2'], spd=(8, 20))
        c.ring(32, 54, 10 + (f - 4) * 3, 'd2', squash=.3)
    if y > -2:
        turnip(c, 32, y, s, wob)
    if f == 9:
        dissolve(c, .5)


if __name__ == '__main__':
    run(globals())

