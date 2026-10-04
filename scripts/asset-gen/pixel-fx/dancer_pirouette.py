"""dancer_pirouette: 회전무: 펼친 부채 셋이 적을 축으로 돌며 꽃잎 회오리와 바람 자취를 일으킨다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'dancer_pirouette', 64, 10, 'allTargets'
PAL = pal(ROSE, pick(GOLDY, 'y1', 'y2', 'y3'), WHITE)
OX, OY = 32, 36


def draw(c, f):
    lvl = [.4, .7, 1, 1, 1, 1, 1, 1, .7, .4][f]
    R = 24 * lvl
    rot = f * .62
    for k in range(3):
        a = rot + k * 2 * math.pi / 3
        px_, py_ = OX + math.cos(a) * R * .55, OY + math.sin(a) * R * .3
        fan(c, px_, py_, a + math.pi * .1, 15 * lvl + 3, 95, ['p1', 'p2', 'p0', 'y2'], ribs=6, edge='p0')
    # 바람 자취 호
    for k in range(2):
        c.arc(OX, OY, R + 4 + k * 4, f * 34 + k * 100, f * 34 + 90 + k * 100, 'p3', 1, squash=.5)
    c.arc(OX, OY, R + 9, f * 34 + 200, f * 34 + 270, 'y2', 1, squash=.5)
    burst_petals(c, OX, OY, 8, R + 4, 3 + f % 3, drop=0, L=4, keys=('p1', 'p2', 'p3'), hi='p4', sq=.5)
    if f in (3, 6):
        c.spark(OX, OY, 5, 'w', 'y3', diag=True)
    c.dring(OX, 55, 14 + f, 'p2', parity=f, squash=.3)


if __name__ == '__main__':
    run(globals())
