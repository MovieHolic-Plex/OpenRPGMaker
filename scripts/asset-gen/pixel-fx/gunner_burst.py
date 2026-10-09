"""gunner_burst: 연사 탄: 세 발이 각기 다른 높이로 나란히 날아가는 예광
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'gunner_burst', 32, 4, 'projectile'
PAL = pal(pick(GOLDY, 'y1', 'y2', 'y3'), pick(SMOG, 'q2', 'q3'), pick(EMBER, 'm3'), WHITE)
EDGE = None


def draw(c, f):
    for i, (x, y) in enumerate(((5, 8), (13, 16), (21, 24))):
        x += (f * 2) % 4 - 2 if i != 1 else 0
        for j in range(6):
            xx = x + 8 + j * 2
            if (j + f + i) % 3:
                c.px(xx, y, 'y2' if j < 3 else 'm3')
        c.rect(x, y - 1, x + 4, y + 1, 'y1')
        c.line([(x, y - 1), (x + 4, y - 1)], 'y3')
        c.poly([(x - 3, y), (x, y - 2), (x, y + 2)], 'w')
    c.line([(20, 8), (31, 8)], 'q3') if f % 2 == 0 else c.line([(26, 24), (31, 24)], 'q2')
    # 총구 불꽃 흔적
    if f == 0:
        c.spark(29, 16, 2, 'w', 'm3')


if __name__ == '__main__':
    run(globals())
