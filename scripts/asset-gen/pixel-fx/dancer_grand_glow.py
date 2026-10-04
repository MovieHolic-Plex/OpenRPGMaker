"""dancer_grand_glow: 천상의 무도 여운: 장밋빛 빛기둥이 솟고 꽃잎과 별이 함께 떠오른다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'dancer_grand_glow', 64, 8, 'allAllies'
PAL = pal(ROSE, pick(GOLDY, 'y1', 'y2', 'y3'), WHITE)


def draw(c, f):
    lvl = [.3, .7, 1, 1, 1, .9, .6, .3][f]
    beam(c, CX, 4, CX, 58, 3 * lvl + 1, 14 * lvl + 2, 'y3', 'p2', phase=-f * 3)
    c.ring(CX, 55, 14 * lvl + 4, 'y2', 1, squash=.3)
    c.dring(CX, 55, 20 * lvl + 4, 'p2', squash=.3, parity=f)
    burst_petals(c, CX, 40, 8, 14, 3 + f, drop=-f * 4, L=4, keys=('p1', 'p2', 'p3'), hi='p4')
    for i in range(6):
        c.spark(CX - 12 + (i * 5) % 26, 50 - ((f * 6 + i * 9) % 44), 2, 'w', 'y3')


if __name__ == '__main__':
    run(globals())
