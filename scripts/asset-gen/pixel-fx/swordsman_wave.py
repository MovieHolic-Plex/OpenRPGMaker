"""swordsman_wave: 검압 탄: 왼쪽으로 볼록한 초승달 검기와 뒤로 흐르는 청백 줄기
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'swordsman_wave', 32, 4, 'projectile'
PAL = pal(pick(ICEB, 'i0', 'i1', 'i2', 'i3', 'i4'), pick(STEELB, 'b3'), WHITE)
EDGE = None


def draw(c, f):
    w = [0, 1, 0, -1][f]
    c.blade((14 + w, 2), (14 + w, 30), 9, 7, ['i1', 'i2', 'i3', 'w'])
    c.blade((17 + w, 6), (17 + w, 26), 5, 3, ['i0', 'i2'])
    for i, y in enumerate((8, 16, 24)):
        L = 7 + ((f + i) % 3) * 3
        c.line([(19 + w, y), (19 + w + L, y + (i - 1) * 1)], 'i2')
        c.px(19 + w + L, y + (i - 1), 'i4')
    for i in range(3):
        c.px(24 + (f * 4 + i * 5) % 8, 9 + (i * 6 + f * 2) % 14, 'w')


if __name__ == '__main__':
    run(globals())
