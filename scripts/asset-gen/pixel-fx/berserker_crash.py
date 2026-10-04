"""berserker_crash: 도약 강타: 붉은 유성 궤적이 도끼와 함께 꽂히고 땅이 갈라지며 돌과 먼지가 솟는다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'berserker_crash', 64, 9, 'target'
PAL = pal(EMBER, pick(STEELB, 'b0', 'b1', 'b2', 'b3'), pick(LEATHER, 'l1', 'l2', 'l3'), WHITE)
IX, IY = 32, 54


def draw(c, f):
    if f == 0:
        c.lens((4, 0), (30, 38), 5, ['m1', 'm3', 'm4', 'w'])
        axe(c, 31, 41, math.radians(-58), L=22, hw=9, side=1)
        c.dline((10, 12), (34, 46), 'm2', 3)
    elif f == 1:
        axe(c, 30, 46, math.radians(-30), L=22, hw=9, side=1)
        pow_burst(c, IX, IY - 2, 14, ['m1', 'm3', 'm4', 'w'], rot=.2, n=10)
        c.oval(IX, 57, 14, 4, 'm0')
        c.rays(IX, IY - 2, 12, 12, 24, 'm4', rot=.1, jitter=[1, .7, .9, .6], squash=.6)
    elif f == 2:
        c.oval(IX, 57, 22, 5, 'm0')
        crack(c, IX, 57, 0.0, 7, 28, ('m0', 'm4'), 5, grow=.55, squash=.25)
        axe(c, 30, 49, math.radians(-28), L=20, hw=9, side=1)
        shock(c, IX, 57, 15, 'm4', 2, squash=.32)
        debris(c, IX, 54, .1, 10, 6, ['l2', 'l3', 'b2'], spd=(14, 30))
        c.spark(IX, 52, 5, 'w', 'm4')
    elif f == 3:
        c.oval(IX, 57, 26, 5, 'm0')
        crack(c, IX, 57, 0.0, 7, 28, ('m0', 'm3'), 5, grow=.85, squash=.25)
        shock(c, IX, 57, 22, 'm3', 2, squash=.32)
        debris(c, IX, 54, .3, 12, 6, ['l2', 'l3', 'b2'], spd=(14, 30))
        dust_puff(c, 12, 57, 8, ['l2', 'l1'], 1)
        dust_puff(c, 52, 57, 8, ['l2', 'l1'], 2)
        axe(c, 30, 50, math.radians(-26), L=18, hw=9, side=1)
    elif f == 4:
        crack(c, IX, 57, 0.0, 7, 28, ('m0', 'm3'), 5, grow=1.0, squash=.25)
        shock(c, IX, 57, 28, 'm2', 1, squash=.32)
        debris(c, IX, 54, .5, 12, 6, ['l2', 'l3', 'b2'], spd=(14, 30))
        dust_puff(c, 10, 55, 10, ['l2', 'l3'], 3)
        dust_puff(c, 54, 55, 10, ['l2', 'l3'], 4)
        c.cloud(32, 46, 10, ['l1', 'l2', 'l3'], 7)
    elif f == 5:
        crack(c, IX, 57, 0.0, 7, 28, ('m0', 'm2'), 5, grow=1.0, squash=.25)
        debris(c, IX, 54, .7, 10, 6, ['l2', 'l1'], spd=(14, 30))
        c.cloud(32, 42, 13, ['l1', 'l2', 'l3'], 8)
        c.puff(14, 52, 8, ['l1', 'l2'], 9)
        c.puff(50, 52, 8, ['l1', 'l2'], 10)
        shock(c, IX, 57, 30, 'm1', 1, dither=True, squash=.32)
    elif f == 6:
        crack(c, IX, 57, 0.0, 7, 28, ('m0', 'm1'), 5, grow=1.0, squash=.25)
        c.cloud(32, 38, 14, ['l1', 'l2', 'l3'], 8)
        c.puff(12, 50, 9, ['l1', 'l2'], 9)
        c.puff(52, 50, 9, ['l1', 'l2'], 10)
        debris(c, IX, 54, .9, 6, 6, ['l1'], spd=(14, 30))
    elif f == 7:
        crack(c, IX, 57, 0.0, 6, 24, ('m0', 'm1'), 5, grow=1.0, squash=.25)
        c.cloud(32, 34, 12, ['l1', 'l2'], 8, parity=1)
        c.puff(10, 48, 8, ['l1', 'l2'], 9)
        c.puff(54, 48, 8, ['l1', 'l2'], 10)
        dissolve(c, .4)
    else:
        c.puff(32, 34, 10, ['l1'], 8)
        c.puff(10, 46, 6, ['l1'], 9)
        c.puff(54, 46, 6, ['l1'], 10)
        crack(c, IX, 57, 0.0, 5, 20, ('m0', 'm0'), 5, grow=1.0, squash=.25, branch=False)
        dissolve(c, .7)


if __name__ == '__main__':
    run(globals())
