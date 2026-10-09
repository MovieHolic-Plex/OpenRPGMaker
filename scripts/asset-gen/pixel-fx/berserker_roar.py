"""berserker_roar: 피의 함성: 붉은 불길이 발치에서 치솟고 톱니 충격 고리가 머리에서 퍼지며 상승 화살표가 떠오른다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'berserker_roar', 64, 8, 'user'
PAL = pal(EMBER, pick(LEATHER, 'l2'), WHITE)
HX, HY = 30, 22  # 머리(왼쪽을 본다)


def draw(c, f):
    flick = [0, 2, -1, 3, 1, -2, 2, 0][f]
    # 발치 불길: 프레임마다 키가 다른 혀 다섯 개
    if f <= 6:
        for i, dx in enumerate((-13, -6, 0, 7, 14)):
            h = (8 + (f * 3 + i * 5) % 8) * (1 if f > 0 else .6)
            c.flame(CX + dx, FEET + 1, h, 3 + (i % 2), ['m0', 'm1', 'm2', 'm3'][:4 if f > 1 else 3], lean=((f + i) % 3 - 1))
    # 함성 고리
    if 1 <= f <= 5:
        r = [0, 9, 15, 21, 27, 31][f]
        th = [0, 3, 3, 3, 2, 1][f]
        zring(c, HX - 2, HY, r, th, 'm2', n=11, rot=f * .2, squash=.85)
        if f <= 4:
            zring(c, HX - 2, HY, max(3, r - 5), 1, 'm4', n=11, rot=f * .2, squash=.85)
    if f == 0:
        c.spark(HX - 3, HY + 2, 5, 'w', 'm4')
    if f in (1, 2):
        # 입에서 터지는 충격 별
        star(c, HX - 6, HY + 3, 8, 6 + f * 2, 3, 'm3', rot=.3)
        star(c, HX - 6, HY + 3, 8, 3 + f, 1.5, 'w', rot=.3)
    # 공격력 상승 화살표
    if f >= 3:
        for i, (dx, base) in enumerate(((-11, 44), (0, 50), (11, 46))):
            y = base - (f - 3) * 5 - i * 2
            if y > 4:
                chevron(c, CX + dx, y, 4, 'm4', ol='m0', up=True)
                chevron(c, CX + dx, y + 5, 4, 'm3', ol='m0', up=True)
    for i in range(6):
        x = 10 + (i * 11 + f * 3) % 44
        y = 54 - ((f * 6 + i * 9) % 44)
        c.px(x, y, 'm4' if i % 2 else 'm3')


if __name__ == '__main__':
    run(globals())
