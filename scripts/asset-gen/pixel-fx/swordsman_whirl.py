"""swordsman_whirl: 회전참: 수평 청백 검기 두 겹이 적진을 원으로 쓸고 바람 자취가 남는다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'swordsman_whirl', 64, 10, 'allTargets'
PAL = pal(pick(ICEB, 'i0', 'i1', 'i2', 'i3', 'i4'), pick(STEELB, 'b3'), WHITE)
OX, OY = 32, 38


def draw(c, f):
    lvl = [.4, .7, 1, 1, 1, 1, 1, .85, .6, .35][f]
    R = 25 * lvl
    ry = R * .42
    rot = f * 63
    band(c, OX, OY, R, ry, rot, rot + 200, 7, ['i0', 'i1', 'i2', 'i3', 'w'])
    band(c, OX, OY + 3, R * .8, ry * .8, rot + 100, rot + 240, 4, ['i0', 'i1', 'i3'])
    c.dring(OX, OY, R + 5, 'i2', squash=.42, parity=f)
    for k in range(4):
        aa = math.radians(rot + 200 + k * 6)
        c.spark(OX + math.cos(aa) * R, OY + math.sin(aa) * ry, 2, 'w', 'i3') if k == 0 and 2 <= f <= 7 else None
    for i in range(5):
        c.px(OX + math.cos(i * 1.3 + f) * (R + 3), OY + math.sin(i * 1.3 + f) * (ry + 2), 'i4')


if __name__ == '__main__':
    run(globals())
