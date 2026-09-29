"""summoner_imp: 불의 정령: 보랏빛 소환진 불꽃에서 작은 불도깨비가 튀어나와 꼬리를 끌며 돌진해 폭발한다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'summoner_imp', 64, 8, 'target'
PAL = pal(EMBER, pick(PURP, 'v1', 'v2', 'v3'), pick(GOLDY, 'y2'), WHITE)


def imp(c, x, y, s, wing):
    """왼쪽을 보는 불도깨비: 머리(뿔 둘)·몸통·박쥐 날개·화살촉 꼬리. (x, y) 는 머리 중심."""
    w = [-3, 3][wing]
    # 뒤쪽(오른쪽) 박쥐 날개
    for j, (dx, dy) in enumerate(((9, -4), (11, 1), (9, 5))):
        c.line([(x + 5 * s, y + 3 * s), (x + dx * s * 1.6, y + (dy * 1.8 + w) * s)], 'v1', 2)
        c.px(x + dx * s * 1.6, y + (dy * 1.8 + w) * s, 'v3')
    c.poly([(x + 5 * s, y + 3 * s), (x + 14 * s, y + (-7 + w) * s), (x + 17 * s, y + (2 + w) * s), (x + 14 * s, y + (7 + w) * s)], 'v2', outline='v1')
    # 꼬리
    c.line([(x + 6 * s, y + 9 * s), (x + 12 * s, y + 13 * s), (x + 15 * s, y + 10 * s)], 'm1', 1)
    c.poly([(x + 14 * s, y + 8 * s), (x + 17 * s, y + 10 * s), (x + 14 * s, y + 12 * s)], 'm3')
    # 몸통
    c.oval(x + 3 * s, y + 8 * s, 5 * s, 6 * s, 'm1')
    c.oval(x + 3 * s, y + 8 * s, 4 * s, 5 * s, 'm2')
    c.oval(x + 2 * s, y + 9 * s, 2 * s, 3 * s, 'm3')
    # 머리
    c.disc(x, y, 6 * s + 1, 'm1')
    c.disc(x, y, 6 * s, 'm2')
    c.disc(x - 1 * s, y + 1 * s, 3 * s, 'm3')
    # 뿔
    c.poly([(x - 5 * s, y - 4 * s), (x - 8 * s, y - 10 * s), (x - 2 * s, y - 6 * s)], 'y2')
    c.poly([(x + 1 * s, y - 6 * s), (x + 4 * s, y - 11 * s), (x + 4 * s, y - 4 * s)], 'y2')
    # 얼굴
    c.line([(x - 5 * s, y - 1 * s), (x - 2 * s, y - 1 * s)], 'm1', 2)
    c.px(x - 4 * s, y - 1 * s, 'w')
    c.px(x - 3 * s, y - 1 * s, 'y2')
    c.line([(x - 5 * s, y + 3 * s), (x - 1 * s, y + 4 * s)], 'm1')
    c.px(x - 3 * s, y + 3 * s, 'w')


def tail(c, x, y, L):
    c.lens((x + 18, y + 6), (x + 18 + L, y + 8), 5, ['m1', 'm2', 'm3'])
    for i in range(4):
        c.px(x + 20 + (i * 7) % max(4, L), y + 3 + (i * 5) % 9, 'm4')


def draw(c, f):
    if f == 0:
        c.ring(50, 48, 9, 'v2', 1, squash=.35)
        c.ring(50, 48, 5, 'v3', 1, squash=.35)
        for i in range(4):
            c.spark(46 + i * 3, 44 - i * 2, 2, 'y2', 'm3')
    elif f == 1:
        c.ring(50, 48, 12, 'v2', 1, squash=.35)
        c.flame(50, 48, 12, 4, ['m1', 'm2', 'm3'], lean=-.5)
        imp(c, 48, 32, .55, 0)
    elif f <= 3:
        x = [40, 24][f - 2]
        y = [30, 32][f - 2]
        tail(c, x, y, 16 + f * 4)
        imp(c, x, y, .8 + (f - 2) * .1, f % 2)
    elif f == 4:
        pow_burst(c, 24, 34, 16, ['m1', 'm3', 'm4', 'w'], rot=.2, n=9)
        c.rays(24, 34, 10, 14, 27, 'm4', jitter=[1, .7, .9, .6])
    elif f == 5:
        c.disc(26, 34, 13, 'm2')
        c.disc(26, 34, 9, 'm3')
        c.disc(26, 34, 5, 'm4')
        c.ring(26, 48, 20, 'm3', 2, squash=.4)
        burst(c, 26, 34, .4, 10, 5, ['m4', 'm3', 'm2'], spd=(10, 24), grav=.4)
    elif f == 6:
        c.flame(26, 50, 18, 9, ['m1', 'm2', 'm3'], lean=0)
        c.ring(26, 48, 25, 'm2', 1, squash=.4)
        burst(c, 26, 34, .7, 8, 5, ['m3', 'm2', 'v3'], spd=(10, 24), grav=.7)
        c.spark(26, 28, 3, 'y2', 'v3')
    else:
        burst(c, 26, 36, .95, 7, 5, ['m2', 'v3'], spd=(10, 24), grav=1.0)
        c.dring(26, 48, 28, 'v2', squash=.4)
        for i in range(4):
            c.spark(16 + i * 8, 20 + (i * 7) % 12, 2, 'v3', 'y2')


if __name__ == '__main__':
    run(globals())
