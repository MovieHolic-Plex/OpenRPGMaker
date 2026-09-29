"""dancer_afterimage: 잔상무: 장밋빛 잔상 셋이 차례로 스러지고 적 뒤에서 부채 참격이 그어져 꽃잎이 흩날린다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'dancer_afterimage', 64, 8, 'target'
PAL = pal(ROSE, pick(GOLDY, 'y2', 'y3'), WHITE)


def draw(c, f):
    xs = [50, 38, 26]
    for i, x in enumerate(xs):
        age = f - i
        if age < 0 or age > 3:
            continue
        body = ['p2', 'p1', 'p1', 'p0'][age]
        rim = ['p4', 'p3', 'p2', 'p1'][age]
        c.ninja(x, 56, 34, body, rim, 'w', scarf='p3')
        dissolve(c, [0, .25, .5, .75][age], box=(x - 14, 14, x + 16, 58))
    if 3 <= f <= 6:
        k = f - 3
        p0, p1 = (6, 44), (58, 14)
        if k == 0:
            c.lens(p0, p1, 6, ['p0', 'p2', 'p4', 'w'], frac=.7)
        elif k == 1:
            c.lens(p0, p1, 7, ['p0', 'p2', 'p4', 'w'])
            c.spark(32, 29, 8, 'w', 'y3', diag=True)
        else:
            c.lens(p0, p1, 5 - k, ['p0', 'p1', 'p3'])
        burst_petals(c, 32, 29, 8, 8 + k * 6, 4 + k, drop=k * 4, L=4, keys=('p1', 'p2', 'p3'), hi='p4')
    if f == 7:
        burst_petals(c, 32, 30, 6, 26, 12, drop=12, L=3.5, keys=('p1', 'p2'), hi=None)
        c.dline((6, 44), (58, 14), 'p1', 3)


if __name__ == '__main__':
    run(globals())
