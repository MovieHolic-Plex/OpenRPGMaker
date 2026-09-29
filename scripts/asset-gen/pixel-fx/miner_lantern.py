"""miner_lantern: 광산 등불: 아군 머리 위에 광산 등불이 켜지며 따뜻한 빛 고리가 흔들린다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'miner_lantern', 64, 8, 'allAllies'
PAL = pal(pick(GOLDY, 'y0', 'y1', 'y2', 'y3'), pick(STONE, 'r0', 'r1', 'r2'), pick(EMBER, 'm2', 'm3'), WHITE)
LX, LY = 32, 12


def draw(c, f):
    sway = [0, 1, 2, 1, 0, -1, -2, -1][f]
    x = LX + sway
    lit = [0, .4, .8, 1, 1, 1, .9, .7][f]
    if lit > .3:
        c.dring(x, LY + 5, 8 + lit * 8, 'y1', parity=f)
        c.ring(x, LY + 5, 5 + lit * 5, 'y2')
        beam(c, x, LY + 8, CX, FEET, 3, 16 * lit, 'y3', 'y1', phase=f, stripes=0)
    c.line([(LX, 1), (x, LY - 4)], 'r1')
    c.rect(x - 3, LY - 3, x + 3, LY - 2, 'r1')
    c.rect(x - 3, LY - 1, x + 3, LY + 6, 'r0')
    c.rect(x - 2, LY, x + 2, LY + 5, 'y2' if lit > .3 else 'y0')
    c.px(x, LY + 2, 'w' if lit > .3 else 'y1')
    c.flame(x, LY + 4, 3 + (f % 2), 1.2, ['m2', 'm3'])
    c.rect(x - 3, LY + 7, x + 3, LY + 7, 'r1')


if __name__ == '__main__':
    run(globals())

