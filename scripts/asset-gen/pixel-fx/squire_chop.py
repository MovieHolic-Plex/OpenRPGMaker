"""squire_chop: 내려베기: 곧게 내려긋는 흰 강철 궤적과 가로 잔광, 먼지 한 줄기가 인다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'squire_chop', 64, 8, 'target'
PAL = pal(STEELB, pick(GOLDY, 'y2', 'y3'), pick(SMOG, 'q2', 'q3'), WHITE)


def draw(c, f):
    if f == 0:
        c.lens((36, 4), (32, 30), 4, ['b1', 'b2', 'b3'], frac=.6)
        c.spark(33, 22, 3, 'w', 'b3')
    elif f == 1:
        c.lens((38, 2), (30, 54), 8, ['b0', 'b1', 'b2', 'b3', 'w'])
        c.spark(30, 50, 5, 'w', 'b3')
    elif f == 2:
        c.lens((38, 2), (30, 54), 6, ['b0', 'b1', 'b3', 'w'])
        c.line([(16, 46), (48, 44)], 'b3', 2)
        c.line([(20, 48), (44, 47)], 'w')
        star(c, 30, 46, 8, 11, 5, 'y2', rot=.2)
        c.disc(30, 46, 2, 'w')
    elif f == 3:
        c.lens((38, 2), (30, 54), 4, ['b0', 'b1', 'b3'])
        c.line([(12, 47), (52, 45)], 'b2')
        c.ring(30, 48, 14, 'y2', 1, squash=.4)
        burst(c, 30, 46, .3, 8, 3, ['w', 'y3', 'b3'], spd=(8, 22))
    elif f == 4:
        c.lens((38, 2), (30, 54), 2.5, ['b0', 'b1'])
        c.dring(30, 48, 20, 'b2', squash=.35)
        dust_puff(c, 16, 54, 6, ['q3', 'q2'], 1)
        dust_puff(c, 44, 54, 6, ['q3', 'q2'], 2)
    elif f == 5:
        c.dline((37, 6), (31, 52), 'b1', 3)
        dust_puff(c, 14, 54, 7, ['q3', 'q2'], 3)
        dust_puff(c, 46, 54, 7, ['q3', 'q2'], 4)
        dissolve(c, .2)
    elif f == 6:
        dust_puff(c, 14, 54, 6, ['q3', 'q2'], 5)
        dust_puff(c, 46, 54, 6, ['q3', 'q2'], 6)
        c.dline((36, 8), (31, 50), 'b1', 4)
    else:
        dust_puff(c, 12, 54, 5, ['q2', 'q2'], 7)
        dust_puff(c, 48, 54, 5, ['q2', 'q2'], 8)
        dissolve(c, .5)


if __name__ == '__main__':
    run(globals())
