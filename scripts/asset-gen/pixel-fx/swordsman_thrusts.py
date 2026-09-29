"""swordsman_thrusts: 연속 찌르기: 좌우로 벌어진 점 형태의 찌르기 궤적 여섯 개가 차례로 번득이고 십자 섬광이 박힌다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'swordsman_thrusts', 64, 8, 'target'
PAL = pal(pick(ICEB, 'i1', 'i2', 'i3', 'i4'), pick(STEELB, 'b0', 'b3'), pick(GOLDY, 'y2', 'y3'), WHITE)
HIT = [(26, 20), (40, 26), (22, 34), (44, 38), (30, 46), (36, 30)]


def draw(c, f):
    for i, (x, y) in enumerate(HIT):
        age = f - i
        if age < 0 or age > 3:
            continue
        # 오른쪽에서 꽂혀 들어오는 가는 찌르기 줄
        a = -.15 + (i % 3) * .12
        p0 = (x + 30, y - 30 * math.tan(a))
        if age == 0:
            c.lens(p0, (x, y), 3, ['i1', 'i3', 'w'], frac=.9)
            c.spark(x, y, 4, 'w', 'i3')
        elif age == 1:
            c.lens(p0, (x - 3, y), 3, ['i1', 'i3', 'w'])
            c.spark(x, y, 5, 'w', 'y3', diag=True)
            c.ring(x, y, 5, 'i2', 1)
        elif age == 2:
            c.lens(p0, (x - 3, y), 1.5, ['i1', 'i2'])
            c.dring(x, y, 7, 'i2')
        else:
            c.dline(p0, (x - 3, y), 'i1', 4)
    if f >= 5:
        for i, (x, y) in enumerate(HIT):
            c.px(x, y, 'y3' if i % 2 else 'i4')


if __name__ == '__main__':
    run(globals())
