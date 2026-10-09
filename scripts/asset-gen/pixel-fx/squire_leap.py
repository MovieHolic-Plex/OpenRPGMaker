"""squire_leap: 도약 베기: 위에서 내리꽂히는 흰 강철 사선과 착탄 별, 원형 충격 고리와 흙먼지
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'squire_leap', 64, 9, 'target'
PAL = pal(STEELB, pick(GOLDY, 'y1', 'y2', 'y3'), pick(LEATHER, 'l2', 'l3'), pick(SMOG, 'q2', 'q3'), WHITE)


def draw(c, f):
    if f == 0:
        c.lens((54, 2), (36, 30), 5, ['b1', 'b2', 'b3'], frac=.7)
        c.dline((56, 0), (40, 24), 'b3', 2)
    elif f == 1:
        c.lens((56, 0), (26, 50), 7, ['b0', 'b2', 'b3', 'w'])
        c.spark(28, 48, 5, 'w', 'b3')
    elif f == 2:
        c.lens((56, 0), (26, 50), 6, ['b0', 'b2', 'b3', 'w'])
        star(c, 26, 50, 9, 13, 6, 'y2', rot=.2)
        star(c, 26, 50, 9, 8, 3, 'w', rot=.2)
        c.rays(26, 50, 12, 12, 24, 'b3', jitter=[1, .6, .85], squash=.7)
    elif f == 3:
        c.lens((56, 0), (26, 50), 4, ['b0', 'b1', 'b3'])
        c.ring(26, 54, 17, 'y2', 2, squash=.34)
        c.ring(26, 54, 11, 'b3', 1, squash=.34)
        debris(c, 26, 52, .15, 8, 3, ['l2', 'l3', 'q3'], spd=(12, 24))
    elif f == 4:
        c.lens((56, 0), (26, 50), 2.5, ['b0', 'b1'])
        c.ring(26, 54, 24, 'y1', 1, squash=.34)
        debris(c, 26, 52, .4, 8, 3, ['l2', 'l3', 'q3'], spd=(12, 24))
        dust_puff(c, 12, 55, 7, ['q3', 'q2'], 1)
        dust_puff(c, 40, 55, 7, ['q3', 'q2'], 2)
    elif f == 5:
        c.dring(26, 54, 29, 'b2', squash=.34)
        debris(c, 26, 52, .65, 7, 3, ['l2', 'l3'], spd=(12, 24))
        dust_puff(c, 10, 55, 8, ['q3', 'q2'], 3)
        dust_puff(c, 44, 55, 8, ['q3', 'q2'], 4)
    elif f == 6:
        c.dline((56, 2), (28, 48), 'b1', 3)
        dust_puff(c, 10, 55, 8, ['q3', 'q2'], 5)
        dust_puff(c, 44, 55, 8, ['q3', 'q2'], 6)
        debris(c, 26, 52, .9, 5, 3, ['l2'], spd=(12, 24))
    elif f == 7:
        dust_puff(c, 10, 55, 7, ['q2', 'q2'], 7)
        dust_puff(c, 44, 55, 7, ['q2', 'q2'], 8)
        dissolve(c, .3)
    else:
        dust_puff(c, 10, 55, 5, ['q2', 'q2'], 9)
        dust_puff(c, 44, 55, 5, ['q2', 'q2'], 10)
        dissolve(c, .65)


if __name__ == '__main__':
    run(globals())
