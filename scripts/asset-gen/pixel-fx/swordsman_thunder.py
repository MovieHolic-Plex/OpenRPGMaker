"""swordsman_thunder: 낙뢰검: 검에 내리꽂힌 번개가 노란 벼락 기둥이 되어 적을 때리고 청백 고리가 퍼진다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'swordsman_thunder', 64, 9, 'target'
PAL = pal(pick(ICEB, 'i1', 'i2', 'i3', 'i4'), pick(BOLT, 'y0', 'y1', 'y2', 'y3'), WHITE)
IX, IY = 32, 48


def draw(c, f):
    if f == 0:
        c.dline((32, 0), (32, 28), 'y2', 2)
        c.spark(32, 26, 5, 'w', 'y3')
    elif f == 1:
        bolt(c, (32, 0), (32, IY), 11, ['y0', 'y2', 'w'], segs=8, jitter=5)
        c.spark(IX, IY, 7, 'w', 'y3', diag=True)
    elif f == 2:
        bolt(c, (32, 0), (32, IY), 12, ['y1', 'y3', 'w'], segs=8, jitter=6)
        bolt(c, (28, 8), (36, IY - 4), 13, ['i2', 'i4'], segs=7, jitter=5)
        star(c, IX, IY, 10, 14, 7, 'y2', rot=.2)
        star(c, IX, IY, 10, 8, 4, 'w', rot=.2)
        c.ring(IX, 54, 16, 'i3', 2, squash=.34)
    elif f == 3:
        bolt(c, (32, 0), (32, IY), 14, ['y1', 'y3', 'w'], segs=8, jitter=6)
        c.ring(IX, 54, 22, 'y2', 2, squash=.34)
        c.ring(IX, 54, 14, 'i3', 1, squash=.34)
        for i in range(6):
            a = i * 1.05
            bolt(c, (IX, IY), pol(IX, IY, 20, a, .5), 20 + i, ['y1', 'y3'], segs=3, jitter=3)
    elif f == 4:
        bolt(c, (32, 6), (32, IY), 15, ['y0', 'y2'], segs=8, jitter=5)
        c.ring(IX, 54, 27, 'y1', 1, squash=.34)
        burst(c, IX, IY, .35, 10, 3, ['w', 'y3', 'i3'], spd=(10, 26))
    elif f == 5:
        bolt(c, (32, 16), (32, IY), 16, ['y0', 'y1'], segs=6, jitter=4)
        c.dring(IX, 54, 30, 'i2', squash=.34)
        burst(c, IX, IY, .6, 8, 3, ['y3', 'y2'], spd=(10, 26), grav=.4)
    elif f == 6:
        c.dline((32, 24), (32, IY), 'y1', 3)
        burst(c, IX, IY, .85, 6, 3, ['y2', 'i3'], spd=(10, 26), grav=.8)
    elif f == 7:
        for i in range(6):
            c.px(16 + i * 6, 44 + (i * 5) % 10, 'y2' if i % 2 else 'i3')
        c.dring(IX, 54, 31, 'i1', squash=.34)
    else:
        for i in range(4):
            c.px(20 + i * 8, 46 + (i * 5) % 8, 'y2')
        c.spark(IX - 6, IY - 14, 2, 'i4', 'y2')


if __name__ == '__main__':
    run(globals())
