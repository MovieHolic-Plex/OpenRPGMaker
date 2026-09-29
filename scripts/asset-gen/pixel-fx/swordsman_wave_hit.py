"""swordsman_wave_hit: 검압 착탄: 초승달 검기가 가로로 쓸고 지나가며 청백 별과 세로 균열선이 번진다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'swordsman_wave_hit', 64, 8, 'target'
PAL = pal(pick(ICEB, 'i0', 'i1', 'i2', 'i3', 'i4'), pick(STEELB, 'b3'), pick(GOLDY, 'y3'), WHITE)
IX, IY = 32, 34


def draw(c, f):
    if f == 0:
        c.blade((44, 6), (44, 62), 16, 10, ['i1', 'i2', 'i3', 'w'], frac=.9)
    elif f == 1:
        c.blade((36, 4), (36, 62), 20, 12, ['i1', 'i2', 'i3', 'w'])
        c.spark(IX, IY, 6, 'w', 'i3')
    elif f == 2:
        c.blade((26, 4), (26, 62), 20, 12, ['i0', 'i2', 'i3', 'w'])
        star(c, IX, IY, 9, 13, 6, 'i2', rot=.2)
        star(c, IX, IY, 9, 8, 3, 'w', rot=.2)
        c.rays(IX, IY, 12, 12, 26, 'i3', jitter=[1, .6, .85])
    elif f == 3:
        c.blade((16, 6), (16, 60), 16, 8, ['i0', 'i1', 'i3'])
        c.lens((IX, 6), (IX, 58), 3, ['i1', 'i3', 'w'])
        c.ring(IX, IY, 16, 'i3', 1)
    elif f == 4:
        c.blade((8, 8), (8, 56), 10, 4, ['i0', 'i1'])
        c.lens((IX, 8), (IX, 56), 2, ['i1', 'i2'])
        c.dring(IX, IY, 22, 'i2')
        burst(c, IX, IY, .4, 8, 3, ['w', 'i3', 'y3'], spd=(10, 24))
    elif f == 5:
        c.dline((IX, 10), (IX, 54), 'i1', 3)
        c.dring(IX, IY, 27, 'i1')
        burst(c, IX, IY, .7, 8, 3, ['i3', 'i2'], spd=(10, 24), grav=.4)
    elif f == 6:
        for i in range(6):
            c.px(IX - 10 + i * 4, 26 + (i * 5) % 16, 'i3')
        c.dring(IX, IY, 29, 'i0')
    else:
        for i in range(4):
            c.px(IX - 8 + i * 5, 30 + (i * 7) % 12, 'i2')
        c.spark(IX + 4, IY - 8, 2, 'i4', 'i2')


if __name__ == '__main__':
    run(globals())
