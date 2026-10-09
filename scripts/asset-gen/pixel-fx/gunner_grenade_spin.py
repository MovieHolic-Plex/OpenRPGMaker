"""gunner_grenade_spin: 수류탄 탄: 도는 올리브색 파인애플형 수류탄과 점선 연기
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'gunner_grenade_spin', 32, 4, 'projectile'
PAL = pal(LEAFG, STEELB, pick(SMOG, 'q2', 'q3'), pick(GOLDY, 'y2'), WHITE)
EDGE = None


def draw(c, f):
    cx, cy = 13, 16
    # 연기 점선
    for i in range(6):
        c.px(cx + 8 + i * 3 + (f % 2), cy + (i % 2) * 2 - 1, 'q3' if i < 3 else 'q2')
    ang = f * math.pi / 2
    # 몸통(파인애플): 원 + 격자 홈
    c.disc(cx, cy, 6, 'b0')
    c.disc(cx, cy, 5, 'g1')
    c.disc(cx - 1, cy - 1, 3, 'g2')
    for k in range(-1, 2):
        c.line([(cx - 5 + k * 3, cy - 5), (cx + k * 3, cy + 5)], 'g0')
    c.line([(cx - 5, cy - 1), (cx + 5, cy - 1)], 'g0')
    c.line([(cx - 4, cy + 2), (cx + 4, cy + 2)], 'g0')
    c.px(cx - 3, cy - 3, 'g3')
    # 안전핀 손잡이: 회전하며 위치가 바뀐다
    px_, py_ = pol(cx, cy, 8, ang - math.pi / 2)
    c.line([(cx, cy), (px_, py_)], 'b2', 2)
    c.disc(*pol(cx, cy, 9, ang - math.pi / 2 - .5), 1, 'y2')
    c.px(*pol(cx, cy, 6.5, ang - math.pi / 2), 'w')


if __name__ == '__main__':
    run(globals())
