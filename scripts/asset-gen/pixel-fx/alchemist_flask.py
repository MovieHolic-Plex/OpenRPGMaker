"""alchemist_flask: 산성 플라스크 탄: 초록 액이 출렁이는 유리병이 빙글 돌며 날아가고 방울이 뒤로 튄다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'alchemist_flask', 32, 4, 'projectile'
PAL = pal(pick(LEAFG, 'g1', 'g2', 'g3'), pick(ICEB, 'i2', 'i3', 'i4'), pick(LEATHER, 'l2', 'l3'), WHITE)
EDGE = None


def draw(c, f):
    ang = -math.pi / 2 + f * math.pi / 2
    flask(c, 13, 16, ang, 5, 'g2', 'i3', 'l2', hi='w', edge='i2')
    c.px(*pol(13, 16, 3, ang + .8), 'g3')
    # 뒤로 튀는 산성 방울
    for i in range(6):
        x = 21 + (i * 4 + f * 3) % 11
        y = 12 + (i * 5 + f * 2) % 10
        c.disc(x, y, 1, 'g2') if i % 2 else c.px(x, y, 'g3')
    c.px(20, 16 + (f % 2) * 2 - 1, 'g1')


if __name__ == '__main__':
    run(globals())
