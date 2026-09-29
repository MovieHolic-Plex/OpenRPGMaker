"""gunner_spinfire: 회전 난사: 여덟 방향으로 예광탄이 뻗고 총구 불꽃이 한 바퀴 돌며 탄피가 흩날린다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'gunner_spinfire', 64, 10, 'allTargets'
PAL = pal(pick(GOLDY, 'y1', 'y2', 'y3'), pick(EMBER, 'm3', 'm4'), pick(SMOG, 'q2', 'q3'), WHITE)
IX, IY = 32, 38


def draw(c, f):
    rot = f * math.pi / 8
    grow = [0, .4, .8, 1, 1, 1, 1, .9, .6, .3][f]
    if grow:
        for i in range(8):
            a = rot + i * math.pi / 4
            r0, r1 = 6, 6 + 25 * grow
            p0, p1 = pol(IX, IY, r0, a, .6), pol(IX, IY, r1, a, .6)
            c.line([p0, p1], 'y1', 3 if f in (2, 3, 4) else 1)
            c.line([p0, p1], 'y3')
            tip = p1
            if f in (2, 3, 4, 5, 6):
                c.spark(tip[0], tip[1], 2, 'w', 'y2')
        # 회전 자취 호
        c.arc(IX, IY, 21 * grow + 3, f * 22 - 40, f * 22 + 60, 'm3', 1, squash=.6)
        c.arc(IX, IY, 27 * grow + 3, f * 22 + 120, f * 22 + 220, 'q3', 1, squash=.6)
    if f <= 6:
        for i in range(4):
            a = rot * 2 + i * math.pi / 2
            x, y = pol(IX, IY, 9 + f * 2, a, .6)
            c.spark(x, y, 3, 'w', 'm3')
    # 탄피
    for i in range(6):
        a = -1.2 + i * .5
        d = (4 + f * 4 + i * 2)
        x, y = IX + math.cos(a) * d, IY - 4 + math.sin(a) * d * .6 + (f * f * .25)
        if 1 <= f <= 8:
            c.rect(x, y, x + 1, y + 1, 'y2')
    if f >= 6:
        c.dring(IX, IY + 12, 8 + (f - 6) * 6, 'q2', squash=.35)
    if f <= 1:
        c.disc(IX, IY, 5 - f * 2, 'm4')


if __name__ == '__main__':
    run(globals())
