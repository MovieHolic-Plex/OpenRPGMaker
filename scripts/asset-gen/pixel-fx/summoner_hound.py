"""summoner_hound: 지옥견: 보랏빛 소환진 속 눈빛에서 불꽃 갈기의 사냥개 머리가 뛰쳐나와 물어뜯고 불길을 남긴다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'summoner_hound', 64, 8, 'target'
PAL = pal(EMBER, pick(PURP, 'v1', 'v2', 'v3'), WHITE)


def head(c, x, y, s, jaw):
    """왼쪽을 보는 지옥견 머리: jaw 0 닫힘 ~ 1 크게 벌림."""
    # 갈기 불꽃
    for i in range(5):
        c.flame(x + (3 + i * 2.2) * s, y - (2 + i * .6) * s, (7 + i % 2 * 3) * s, 3 * s, ['m1', 'm2', 'm3'], lean=.7)
    c.poly([(x - 9 * s, y - 1 * s), (x - 6 * s, y - 5 * s), (x + 2 * s, y - 6 * s), (x + 7 * s, y - 1 * s), (x + 6 * s, y + 3 * s), (x - 5 * s, y + 3 * s)], 'm0', outline='m0')
    c.poly([(x - 8 * s, y - 1 * s), (x - 6 * s, y - 4 * s), (x + 2 * s, y - 5 * s), (x + 6 * s, y - 1 * s), (x + 5 * s, y + 2 * s), (x - 4 * s, y + 2 * s)], 'm1')
    # 아래턱
    jy = jaw * 8 * s
    c.poly([(x - 8 * s, y + 2 * s + jy), (x + 4 * s, y + 3 * s), (x + 3 * s, y + 7 * s + jy), (x - 7 * s, y + 5 * s + jy)], 'm0', outline='m0')
    c.poly([(x - 7 * s, y + 3 * s + jy), (x + 3 * s, y + 3.5 * s), (x + 2 * s, y + 6 * s + jy), (x - 6 * s, y + 4.5 * s + jy)], 'm1')
    # 송곳니
    for fx in (-7, -4, -1):
        c.poly([(x + fx * s, y + 2 * s), (x + (fx + 1.6) * s, y + 2 * s), (x + (fx + .8) * s, y + (5 + jaw * 3) * s)], 'w')
        c.poly([(x + fx * s, y + (3 + jaw * 8) * s), (x + (fx + 1.6) * s, y + (3 + jaw * 8) * s), (x + (fx + .8) * s, y + (0 + jaw * 5) * s)], 'w')
    c.disc(x - 3 * s, y - 2.5 * s, 1.6 * s, 'm4')
    c.px(x - 3 * s, y - 2.5 * s, 'w')
    c.poly([(x - 8 * s, y - 1 * s), (x - 10 * s, y + 0 * s), (x - 8.5 * s, y + 1.5 * s)], 'm2')
    c.px(x - 9 * s, y + 0 * s, 'm0')
    c.poly([(x + 3 * s, y - 5 * s), (x + 5 * s, y - 9 * s), (x + 6 * s, y - 4 * s)], 'm1')


def draw(c, f):
    if f == 0:
        c.ring(46, 40, 12, 'v2', 1, squash=.4)
        c.ring(46, 40, 7, 'v3', 1, squash=.4)
        c.px(44, 37, 'm4')
        c.px(49, 37, 'm4')
        c.spark(46, 32, 3, 'm3', 'v3')
    elif f == 1:
        c.ring(46, 40, 13, 'v2', 1, squash=.4)
        head(c, 46, 34, .8, .5)
        c.spark(38, 30, 3, 'w', 'm3')
    elif f == 2:
        head(c, 34, 32, 1.4, 1.0)
        c.line([(46, 30), (58, 26)], 'm2')
        c.line([(46, 36), (60, 38)], 'm2')
        c.dline((48, 24), (60, 20), 'm3', 3)
    elif f == 3:
        head(c, 30, 34, 1.4, .0)
        pow_burst(c, 26, 36, 12, ['m1', 'm3', 'm4', 'w'], rot=.3, n=8)
        c.rays(26, 36, 10, 14, 26, 'm4', jitter=[1, .7, .9, .6])
    elif f == 4:
        head(c, 30, 34, 1.35, .05)
        for i in range(3):
            c.line([(20 + i * 4, 28), (24 + i * 4, 44)], 'm0', 2)
            c.line([(20 + i * 4, 28), (24 + i * 4, 44)], 'm4', 1)
        drops(c, 26, 36, .3, 6, 5, ['m2', 'm3'])
    elif f == 5:
        for i in range(3):
            c.line([(20 + i * 4, 28), (24 + i * 4, 44)], 'm1', 1)
        c.flame(30, 56, 16, 7, ['m1', 'm2', 'm3'], lean=-.3)
        c.flame(20, 56, 10, 5, ['m1', 'm2'], lean=-.3)
        c.flame(40, 56, 10, 5, ['m1', 'm2'], lean=.3)
        dissolve(c, .3)
        burst(c, 26, 36, .6, 6, 5, ['m3', 'm2'], spd=(8, 20), grav=.6)
    elif f == 6:
        c.flame(30, 56, 12, 6, ['m1', 'm2'], lean=-.3)
        c.flame(20, 56, 7, 4, ['m1', 'm2'], lean=-.3)
        c.flame(40, 56, 7, 4, ['m1', 'm2'], lean=.3)
        burst(c, 26, 40, .85, 6, 5, ['m2', 'v3'], spd=(8, 20), grav=.9)
        dissolve(c, .5)
    else:
        c.dring(30, 56, 16, 'v2', squash=.3)
        burst(c, 26, 42, 1.0, 5, 5, ['v3', 'm2'], spd=(8, 20), grav=1.0)


if __name__ == '__main__':
    run(globals())
