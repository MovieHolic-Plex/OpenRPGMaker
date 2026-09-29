"""alchemist_bomb_blast: 연금 폭탄 착탄: 별 모양 섬광과 톱니 충격파가 터지고 검은 연기 고리와 쇳조각이 튄다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'alchemist_bomb_blast', 64, 10, 'target'
PAL = pal(EMBER, pick(GOLDY, 'y3'), pick(SMOG, 'q0', 'q1', 'q2'), pick(STEELB, 'b2'), WHITE)
IX, IY = 32, 36


def smokeb(c, x, y, r, seed):
    c.ddisc(x, y, r + 1, 'q0', parity=seed)
    c.disc(x, y, r * .5, 'q1')
    c.ddisc(x - 1, y - 1, r * .8, 'q2', parity=seed + 1)


def draw(c, f):
    if f == 0:
        star(c, IX, IY, 10, 14, 6, 'm4', rot=.1)
        c.disc(IX, IY, 6, 'w')
        c.rays(IX, IY, 14, 8, 30, 'y3', rot=.05, jitter=[1, .55, .85, .65])
    elif f == 1:
        star(c, IX, IY, 10, 24, 11, 'm2', rot=.3)
        star(c, IX, IY, 10, 19, 8, 'm3', rot=.3)
        star(c, IX, IY, 10, 11, 5, 'm4', rot=.3)
        c.disc(IX, IY, 5, 'w')
    elif f == 2:
        zring(c, IX, IY, 25, 4, 'm3', n=13, rot=.1, squash=.85)
        star(c, IX, IY, 10, 15, 7, 'm2', rot=.5)
        star(c, IX, IY, 10, 9, 4, 'm4', rot=.5)
        c.spark(IX, IY, 7, 'w', 'y3', diag=True)
        for i in range(8):
            a = i * .78 + .2
            c.line([pol(IX, IY, 26, a, .85), pol(IX, IY, 31, a, .85)], 'b2')
    elif f == 3:
        zring(c, IX, IY, 29, 3, 'm2', n=13, rot=.1, squash=.85)
        c.disc(IX, IY, 11, 'm2')
        c.disc(IX, IY, 7, 'm3')
        c.disc(IX, IY, 3, 'm4')
        burst(c, IX, IY, .4, 10, 3, ['b2', 'y3'], spd=(14, 28), grav=.4)
        for i in range(6):
            a = i * 1.05
            smokeb(c, *pol(IX, IY, 16, a, .85), 4, i)
    elif f == 4:
        zring(c, IX, IY, 31, 2, 'm1', n=13, rot=.1, squash=.85)
        for i in range(8):
            a = i * .78
            smokeb(c, *pol(IX, IY, 20, a, .85), 6, i)
        c.disc(IX, IY, 6, 'm2')
        c.disc(IX, IY, 3, 'm3')
        burst(c, IX, IY, .65, 8, 3, ['b2', 'm3'], spd=(14, 28), grav=.8)
    elif f == 5:
        for i in range(8):
            a = i * .78
            smokeb(c, *pol(IX, IY, 23, a, .85), 6, i + 1)
        c.disc(IX, IY, 4, 'm1')
        burst(c, IX, IY, .85, 6, 3, ['b2', 'm2'], spd=(14, 28), grav=1.1)
    elif f == 6:
        for i in range(8):
            a = i * .78
            smokeb(c, *pol(IX, IY - 2, 24, a, .8), 6, i + 2)
        c.dring(IX, IY, 26, 'q2', squash=.85)
    elif f == 7:
        for i in range(8):
            a = i * .78
            smokeb(c, *pol(IX, IY - 4, 25, a, .8), 5, i + 3)
        dissolve(c, .3)
    elif f == 8:
        for i in range(8):
            a = i * .78
            smokeb(c, *pol(IX, IY - 6, 26, a, .8), 4, i + 3)
        dissolve(c, .6)
    else:
        for i in range(8):
            a = i * .78
            c.px(*pol(IX, IY - 8, 27, a, .8), 'q1')


if __name__ == '__main__':
    run(globals())
