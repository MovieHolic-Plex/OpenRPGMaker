"""swordsman_flash: 일섬: 화면을 가르는 가늘고 긴 청백 한 줄기와 갈라지는 잔광이 번쩍인다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'swordsman_flash', 64, 8, 'target'
PAL = pal(pick(ICEB, 'i0', 'i1', 'i2', 'i3', 'i4'), pick(STEELB, 'b3'), WHITE)
A, B = (0, 40), (63, 24)


def draw(c, f):
    if f == 0:
        c.line([(20, 34), (44, 28)], 'i2')
        c.spark(32, 31, 4, 'w', 'i3')
    elif f == 1:
        c.lens(A, B, 5, ['i1', 'i2', 'i4', 'w'], frac=.75)
        c.spark(48, 28, 5, 'w', 'i3')
    elif f == 2:
        c.lens((0, 41), (63, 23), 9, ['i0', 'i1', 'i2', 'i3', 'w'])
        c.spark(32, 32, 10, 'w', 'i3', diag=True)
        c.rays(32, 32, 10, 8, 26, 'i3', jitter=[1, .55, .85], squash=.6)
    elif f == 3:
        c.lens((0, 41), (63, 23), 7, ['i0', 'i2', 'i3', 'w'])
        c.lens((6, 30), (58, 34), 2, ['i2', 'i4'])
        c.ring(32, 32, 11, 'i3', 1, squash=.6)
    elif f == 4:
        c.lens((0, 41), (63, 23), 5, ['i1', 'i2', 'i4'])
        c.ring(32, 32, 18, 'i2', 1, squash=.55)
        for s in (-1, 1):
            c.lens((6, 41 + s * 6), (58, 23 + s * 6), 1.5, ['i1', 'i3'])
    elif f == 5:
        c.lens((2, 41), (61, 23), 3, ['i0', 'i2'])
        c.dring(32, 32, 24, 'i2', squash=.55)
    elif f == 6:
        c.dline((0, 41), (63, 23), 'i1', 2, phase=1)
        c.dring(32, 32, 28, 'i1', squash=.55)
    else:
        c.dline((0, 41), (63, 23), 'i0', 4)
        for i in range(4):
            c.px(12 + i * 13, 38 - i * 4, 'i3')


if __name__ == '__main__':
    run(globals())
