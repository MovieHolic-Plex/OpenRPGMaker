"""dancer_fanwave: 불꽃 부채 파동: 왼쪽으로 볼록한 초승달 불꽃 날과 흩날리는 불티
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'dancer_fanwave', 32, 4, 'projectile'
PAL = pal(EMBER, pick(ROSE, 'p2', 'p3'), WHITE)
EDGE = None


def draw(c, f):
    w = [0, 1, 2, 1][f]
    c.blade((19 + w, 3), (19 + w, 29), 10, 8, ['m1', 'm2', 'm3', 'm4'])
    c.blade((21 + w, 6), (21 + w, 26), 6, 3, ['p2', 'p3'])
    # 꼬리 불꽃
    for i, y in enumerate((9, 16, 23)):
        L = 6 + ((f + i) % 3) * 3
        c.line([(23 + w, y), (23 + w + L, y + (i - 1))], 'm2')
        c.px(23 + w + L, y + (i - 1), 'm4')
    for i in range(4):
        c.px(26 + (f * 5 + i * 7) % 6, 8 + (i * 6 + f * 3) % 16, 'm3' if i % 2 else 'w')


if __name__ == '__main__':
    run(globals())
