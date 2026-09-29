"""berserker_frenzy: 광란: 핏빛 불길이 몸을 타고 오르고 붉은 전류가 튀며 눈이 번뜩인다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'berserker_frenzy', 64, 10, 'user'
PAL = pal(EMBER, WHITE)


def draw(c, f):
    lvl = [.35, .6, 1, 1, 1, 1, 1, 1, .7, .4][f]
    # 몸 둘레의 불길
    spots = [(-15, 54), (-16, 44), (-15, 34), (-14, 24), (-8, 15), (0, 12), (8, 15), (14, 24), (15, 34), (16, 44), (15, 54)]
    for i, (dx, y) in enumerate(spots):
        h = (7 + ((f * 5 + i * 7) % 9)) * lvl
        w = (3 + (i % 2)) * (.6 + lvl * .4)
        keys = ['m0', 'm1', 'm2', 'm3'] if lvl > .5 else ['m0', 'm1', 'm2']
        c.flame(CX + dx, y, h, w, keys, lean=((f + i) % 3 - 1) * 1.5)
    # 전류
    if 1 <= f <= 8:
        for j in range(2):
            sx = CX + (-12 if j else 12)
            bolt(c, (sx, 22 + j * 6), (sx + (-9 if j else 9), 40 + ((f * 7 + j * 5) % 9)), f * 3 + j, ['m1', 'm3', 'w'], segs=4, jitter=3)
    # 번뜩이는 눈
    if 1 <= f <= 8:
        c.px(27, 21, 'w')
        c.px(26, 21, 'm4')
        c.px(25, 20, 'm3')
        c.line([(22, 19), (29, 20)], 'm4') if f % 3 == 0 else None
    c.dring(CX, FEET + 1, 17, 'm2', parity=f, squash=.28)
    for i in range(7):
        x = 12 + (i * 9 + f * 4) % 40
        y = 52 - ((f * 5 + i * 8) % 44)
        c.px(x, y, 'm4' if i % 2 else 'm3')


if __name__ == '__main__':
    run(globals())
