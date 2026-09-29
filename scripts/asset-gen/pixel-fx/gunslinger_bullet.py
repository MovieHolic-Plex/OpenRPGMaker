"""gunslinger_bullet: 속사 탄: 왼쪽으로 나는 금빛 탄두와 짧은 빛꼬리(4칸 루프)"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'gunslinger_bullet', 32, 4, 'projectile'
PAL = pal(pick(GOLDY, 'y1', 'y2', 'y3'), pick(EMBER, 'm2', 'm3'), WHITE)


def draw(c, f):
    x = 6
    L = [16, 20, 18, 22][f]
    c.line([(x + 3, 16), (x + L, 16)], 'm2')
    c.line([(x + 3, 15), (x + L - 6, 15)], 'y1')
    c.line([(x + 3, 17), (x + L - 8 + f, 17)], 'y1')
    c.line([(x + 3, 16), (x + L * .5, 16)], 'y3')
    c.poly([(x, 16), (x + 2, 14), (x + 5, 14), (x + 5, 18), (x + 2, 18)], 'y2')
    c.px(x + 1, 15, 'w'); c.px(x, 16, 'w')
    for i in range(2):
        c.px(x + 8 + i * 6 + f, 13 + (i + f) % 2 * 6, 'm3')


if __name__ == '__main__':
    run(globals())

