"""gunner_bullet_hit: 조준 사격 착탄: 흰 섬광과 금빛 불똥, 튕겨 나가는 쇠 조각과 연기 한 줄기
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'gunner_bullet_hit', 64, 6, 'target'
PAL = pal(pick(GOLDY, 'y1', 'y2', 'y3'), SMOG, pick(EMBER, 'm2', 'm3'), WHITE)
IX, IY = 32, 34


def draw(c, f):
    if f == 0:
        c.spark(IX, IY, 9, 'w', 'y3', diag=True)
        c.disc(IX, IY, 3, 'w')
        c.rays(IX, IY, 8, 6, 15, 'y2', rot=.2, jitter=[1, .6, .85, .7])
    elif f == 1:
        star(c, IX, IY, 8, 11, 5, 'y2', rot=.3)
        star(c, IX, IY, 8, 7, 3, 'y3', rot=.3)
        c.disc(IX, IY, 2, 'w')
        c.ring(IX, IY, 13, 'y1', 1)
        burst(c, IX, IY, .25, 8, 4, ['w', 'y3', 'y2'], spd=(10, 22))
    elif f == 2:
        c.ring(IX, IY, 15, 'm3', 1)
        c.dring(IX, IY, 18, 'y1')
        burst(c, IX, IY, .5, 10, 4, ['y3', 'y2', 'y1'], spd=(10, 24), grav=.5)
        c.puff(IX + 4, IY - 4, 4, ['q1', 'q2', 'q3'], 3)
    elif f == 3:
        burst(c, IX, IY, .75, 8, 4, ['y2', 'y1', 'm2'], spd=(10, 24), grav=.8)
        c.puff(IX + 3, IY - 8, 6, ['q1', 'q2', 'q3'], 3)
        c.disc(IX, IY, 2, 'q1')
    elif f == 4:
        c.puff(IX + 2, IY - 13, 6, ['q1', 'q2', 'q3'], 4)
        c.disc(IX, IY, 2, 'q0')
        c.dring(IX, IY, 5, 'q1')
    else:
        c.puff(IX + 1, IY - 18, 5, ['q1', 'q2'], 5)
        dissolve(c, .5)


if __name__ == '__main__':
    run(globals())
