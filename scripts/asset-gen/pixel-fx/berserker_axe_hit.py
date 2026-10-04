"""berserker_axe_hit: 투척 도끼 착탄: 도끼가 박히며 붉은 폭발이 일고 자루가 떨리다 사라진다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'berserker_axe_hit', 64, 8, 'target'
PAL = pal(EMBER, pick(STEELB, 'b0', 'b1', 'b2', 'b3'), pick(LEATHER, 'l1', 'l2'), WHITE)


def draw(c, f):
    wob = [0, 14, -10, 8, -5, 3, 0, 0][f]
    ang = math.radians(-42 + wob)
    hx, hy = 24, 38
    if f <= 5:
        axe(c, hx, hy, ang, L=24, hw=8, side=1)
    elif f == 6:
        axe(c, hx, hy, ang, L=24, hw=8, side=1)
        dissolve(c, .45)
    else:
        axe(c, hx, hy, ang, L=24, hw=8, side=1)
        dissolve(c, .8)
    if f == 0:
        pow_burst(c, 26, 38, 15, ['m1', 'm3', 'm4', 'w'], rot=.3, n=9)
        c.rays(26, 38, 10, 14, 26, 'm4', jitter=[1, .7, .9, .6])
    elif f == 1:
        star(c, 26, 38, 9, 13, 6, 'm2')
        star(c, 26, 38, 9, 8, 3, 'm4')
        c.spark(26, 38, 5, 'w', 'm4')
        drops(c, 26, 38, .15, 8, 3, ['m2', 'm3'])
    elif f == 2:
        c.ring(26, 38, 16, 'm3', 2, squash=.9)
        drops(c, 26, 38, .3, 9, 3, ['m1', 'm2', 'm3'])
    elif f == 3:
        c.ring(26, 38, 21, 'm2', 1, squash=.9)
        drops(c, 26, 38, .5, 9, 3, ['m1', 'm2'])
    elif f == 4:
        c.dring(26, 38, 25, 'm1', squash=.9)
        drops(c, 26, 38, .7, 8, 3, ['m1', 'm2'])
    elif f == 5:
        drops(c, 26, 38, .9, 6, 3, ['m1'])
    if f >= 2:
        c.line([(20, 46), (14, 52)], 'm1')


if __name__ == '__main__':
    run(globals())
