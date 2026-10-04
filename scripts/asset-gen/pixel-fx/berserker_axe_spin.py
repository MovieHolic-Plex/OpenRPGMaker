"""berserker_axe_spin: 투척 도끼: 머리를 왼쪽으로 두고 회전하며 날아가는 도끼와 꼬리 불똥
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'berserker_axe_spin', 32, 4, 'projectile'
PAL = pal(EMBER, pick(STEELB, 'b0', 'b1', 'b2', 'b3'), pick(LEATHER, 'l1', 'l2'))
EDGE = None


def draw(c, f):
    ang = math.radians(f * 90)
    # 회전 자취(점선 호)
    c.arc(13, 16, 11, 200 + f * 90, 320 + f * 90, 'm2', 1)
    # 도끼(무게중심 (13,16), 첫 칸은 머리가 왼쪽)
    ux, uy = math.cos(ang), math.sin(ang)
    hx, hy = 13 - ux * 4, 16 - uy * 4
    axe(c, hx, hy, ang, L=11, hw=6, side=1)
    # 꼬리
    for i, dy in enumerate((-4, 0, 4)):
        L = 8 + (f + i) % 3 * 3
        c.line([(24, 16 + dy), (24 + L * .6, 16 + dy * .8)], 'm3' if i == 1 else 'm2')
    c.px(20 + (f * 3) % 6, 10 + f, 'm4')
    c.px(22 + (f * 5) % 7, 22 - f, 'm3')


if __name__ == '__main__':
    run(globals())
