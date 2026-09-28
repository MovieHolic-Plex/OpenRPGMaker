"""berserker_whirl: 회전 도끼: 붉은 초승달 궤적 두 줄이 적 발치를 타원으로 휘감아 돌며 먼지와 불똥을 일으킨다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'berserker_whirl', 64, 10, 'allTargets'
PAL = pal(EMBER, pick(STEELB, 'b0', 'b1', 'b2', 'b3'), pick(LEATHER, 'l1', 'l2'), WHITE)
OX, OY = 32, 38


def draw(c, f):
    r0 = [8, 15, 21, 24, 25, 25, 24, 22, 19, 15][f]
    ry = r0 * .5
    rot = f * 58
    grow = f <= 2
    fade = f >= 7
    a = rot
    if f <= 8:
        # 두 날: 서로 반대편, 앞쪽(아래)이 진하고 뒤쪽은 흐려진다
        band(c, OX, OY, r0, ry, a, a + 115, 8 if not fade else 5, ['m1', 'm2', 'm4', 'w'])
        band(c, OX, OY, r0, ry, a + 180, a + 295, 8 if not fade else 5, ['m1', 'm2', 'm4', 'w'])
    if 1 <= f <= 8:
        band(c, OX, OY + 1, r0 + 3, ry + 2, a - 60, a + 10, 3, ['m0', 'm1'])
        band(c, OX, OY + 1, r0 + 3, ry + 2, a + 120, a + 190, 3, ['m0', 'm1'])
    if 2 <= f <= 8:
        # 도끼날: 궤도 앞머리에 쇠 날
        for k in (0, 1):
            ang = math.radians(a + 115 + k * 180)
            x, y = OX + math.cos(ang) * r0, OY + math.sin(ang) * ry
            axe(c, x, y, math.atan2(OY - y, OX - x), L=9, hw=4, side=1 if k else -1)
    if f >= 1:
        for k in range(6):
            aa = math.radians(a * 1.3 + k * 60)
            x, y = OX + math.cos(aa) * (r0 + 6), OY + math.sin(aa) * (ry + 4)
            c.px(x, y, 'm3' if k % 2 else 'm4')
    if 2 <= f <= 8:
        dust_puff(c, OX - r0 - 2, 54, 5, ['l2', 'l1'], f)
        dust_puff(c, OX + r0 + 2, 54, 5, ['l2', 'l1'], f + 1)
    if f in (0, 9):
        shock(c, OX, 55, 10 if f == 0 else 26, 'm3', 1, dither=(f == 9))
    if f == 9:
        specks(c, OX, OY, 7, 10, 24, 3, ['m3', 'm2'], sq=.6)


if __name__ == '__main__':
    run(globals())
