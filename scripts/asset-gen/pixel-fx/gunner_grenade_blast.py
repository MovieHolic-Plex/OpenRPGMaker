"""gunner_grenade_blast: 수류탄 폭발: 흰 섬광 뒤 주황 불덩이와 검은 연기 테두리, 파편 궤적과 충격 고리
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'gunner_grenade_blast', 64, 10, 'allTargets'
PAL = pal(EMBER, SMOG, pick(STEELB, 'b2'), WHITE)
IX, IY = 32, 42


def draw(c, f):
    if f == 0:
        c.disc(IX, IY, 9, 'm4')
        c.disc(IX, IY, 5, 'w')
        c.rays(IX, IY, 12, 8, 24, 'm4', rot=.1, jitter=[1, .6, .9, .7], squash=.8)
    elif f == 1:
        c.disc(IX, IY - 2, 15, 'm2')
        c.disc(IX, IY - 2, 12, 'm3')
        c.disc(IX - 1, IY - 3, 8, 'm4')
        c.disc(IX - 1, IY - 3, 4, 'w')
        c.ring(IX, IY + 4, 20, 'm4', 1, squash=.4)
    elif f == 2:
        c.cloud(IX, IY - 6, 18, ['m1', 'm2', 'm3', 'm4'], 3)
        c.ring(IX, IY + 8, 27, 'm3', 2, squash=.32)
        c.rays(IX, IY - 6, 10, 18, 29, 'b2', rot=.2, jitter=[1, .7, .9], squash=.9)
    elif f == 3:
        c.cloud(IX, IY - 10, 19, ['m0', 'm2', 'm3', 'm4'], 3)
        c.ring(IX, IY + 10, 29, 'm2', 1, squash=.3)
        burst(c, IX, IY - 6, .5, 10, 6, ['m4', 'm3', 'q3'], spd=(18, 30), grav=.5)
    elif f == 4:
        c.cloud(IX, IY - 14, 18, ['q0', 'm1', 'm2', 'm3'], 3)
        c.puff(IX, IY - 2, 10, ['q1', 'q2'], 5)
        burst(c, IX, IY - 6, .75, 8, 6, ['m3', 'm2', 'q2'], spd=(18, 30), grav=.8)
        c.dring(IX, IY + 10, 30, 'm1', squash=.3)
    elif f == 5:
        c.cloud(IX, IY - 18, 17, ['q0', 'q1', 'm1', 'm2'], 3)
        c.puff(IX, IY - 6, 11, ['q1', 'q2', 'q3'], 5)
    elif f == 6:
        c.cloud(IX, IY - 22, 16, ['q0', 'q1', 'q2'], 4)
        c.puff(IX, IY - 10, 11, ['q1', 'q2', 'q3'], 5)
        c.disc(IX, IY + 10, 5, 'm1')
    elif f == 7:
        c.cloud(IX, IY - 25, 15, ['q1', 'q2', 'q3'], 4, parity=1)
        c.puff(IX, IY - 14, 9, ['q1', 'q2'], 5)
        c.px(IX, IY + 10, 'm1')
    elif f == 8:
        c.cloud(IX, IY - 28, 13, ['q1', 'q2', 'q3'], 4, parity=1)
        dissolve(c, .3)
    else:
        c.cloud(IX, IY - 30, 11, ['q2', 'q3'], 4, parity=1)
        dissolve(c, .7)


if __name__ == '__main__':
    run(globals())
