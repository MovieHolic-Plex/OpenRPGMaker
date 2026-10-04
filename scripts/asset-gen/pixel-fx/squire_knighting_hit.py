"""squire_knighting_hit: 기사 서임 착탄: 십자 광검이 내리꽂히며 금빛 별과 원형 충격이 퍼진다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'squire_knighting_hit', 64, 8, 'target'
PAL = pal(pick(GOLDY, 'y1', 'y2', 'y3'), pick(ICEB, 'i2', 'i3', 'i4'), WHITE)
IX, IY = 32, 34


def draw(c, f):
    if f == 0:
        c.lens((32, 0), (32, 34), 4, ['i2', 'i4', 'w'], frac=.9)
        c.spark(IX, IY, 5, 'w', 'y3')
    elif f == 1:
        c.lens((32, 0), (32, 58), 7, ['i2', 'i3', 'i4', 'w'])
        c.lens((6, IY), (58, IY), 4, ['y1', 'y3', 'w'])
        star(c, IX, IY, 10, 12, 5, 'y2', rot=.2)
        c.disc(IX, IY, 3, 'w')
    elif f == 2:
        c.lens((32, 0), (32, 58), 5, ['i2', 'i3', 'w'])
        c.lens((6, IY), (58, IY), 5, ['y1', 'y3', 'w'])
        star(c, IX, IY, 10, 16, 7, 'y2', rot=.4)
        star(c, IX, IY, 10, 9, 4, 'w', rot=.4)
        c.ring(IX, IY, 18, 'y2', 1)
    elif f == 3:
        c.lens((32, 0), (32, 58), 3, ['i2', 'i3'])
        c.lens((6, IY), (58, IY), 3, ['y1', 'y3'])
        c.ring(IX, IY, 22, 'y2', 2)
        c.ring(IX, IY, 16, 'i3', 1)
        burst(c, IX, IY, .35, 10, 3, ['w', 'y3', 'i3'], spd=(10, 26))
    elif f == 4:
        c.lens((32, 4), (32, 54), 1.5, ['i2', 'i3'])
        c.lens((10, IY), (54, IY), 1.5, ['y1', 'y3'])
        c.ring(IX, IY, 26, 'y1', 1)
        burst(c, IX, IY, .6, 10, 3, ['y3', 'y2', 'i3'], spd=(10, 26), grav=.4)
    elif f == 5:
        c.dring(IX, IY, 29, 'y1')
        c.dline((32, 4), (32, 54), 'i2', 3)
        burst(c, IX, IY, .85, 8, 3, ['y2', 'i3'], spd=(10, 26), grav=.8)
    elif f == 6:
        c.dring(IX, IY, 30, 'i2')
        burst(c, IX, IY, 1.0, 6, 3, ['y2'], spd=(10, 26), grav=1.0)
    else:
        for i in range(5):
            c.spark(14 + (i * 11) % 38, 22 + (i * 7) % 24, 1, 'w', 'y3')


if __name__ == '__main__':
    run(globals())
