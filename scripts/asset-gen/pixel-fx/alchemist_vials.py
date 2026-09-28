"""alchemist_vials: 연속 투척: 색색의 약병이 차례로 날아와 깨지며 초록·파랑·붉은·보라·노란 물보라가 겹친다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'alchemist_vials', 64, 10, 'target'
PAL = pal(pick(LEAFG, 'g1', 'g2', 'g3'), pick(ICEB, 'i1', 'i2', 'i3'), pick(EMBER, 'm1', 'm2', 'm3'), pick(PURP, 'v2', 'v3'), pick(GOLDY, 'y2', 'y3'), WHITE)
SPOTS = [(26, 24, 'g'), (40, 30, 'i'), (22, 42, 'm'), (44, 44, 'v'), (32, 34, 'y')]
COL = {'g': ('g1', 'g2', 'g3'), 'i': ('i1', 'i2', 'i3'), 'm': ('m1', 'm2', 'm3'), 'v': ('v2', 'v3', 'v3'), 'y': ('y2', 'y3', 'y3')}


def draw(c, f):
    for i, (x, y, kk) in enumerate(SPOTS):
        age = f - i * 2 + 1
        k0, k1, k2 = COL[kk]
        if age == -0:
            # 날아오는 약병
            pass
        if age == 0:
            fx, fy = x + 14, y - 8
            flask(c, fx, fy, -.6, 3, k1, 'w', 'y3', hi='w', edge=k0) if kk != 'y' else flask(c, fx, fy, -.6, 3, 'y2', 'w', 'i1', hi='w', edge='y2')
            c.line([(fx + 3, fy - 2), (fx + 9, fy - 5)], k0)
        elif age == 1:
            star(c, x, y, 8, 9, 4, k1, rot=i)
            star(c, x, y, 8, 5, 2, k2, rot=i)
            c.disc(x, y, 1, 'w')
            for j in range(4):
                a = j * 1.6 + i
                c.px(x + math.cos(a) * 11, y + math.sin(a) * 11, 'w')
        elif age == 2:
            c.ring(x, y, 8, k1, 1)
            drops(c, x, y, .3, 8, i, [k1, k2, k0], spd=(6, 14))
        elif age == 3:
            c.ring(x, y, 11, k0, 1, squash=.9)
            drops(c, x, y, .6, 7, i, [k1, k2], spd=(6, 14))
            c.puff(x, y - 3, 4, [k0, k1, k2], i)
        elif age == 4:
            drops(c, x, y, .9, 5, i, [k0, k1], spd=(6, 14))
            c.puff(x, y - 7, 4, [k0, k1], i + 1)
        elif age == 5:
            c.puff(x, y - 10, 3, [k0, k1], i + 2)
    if f >= 6:
        dissolve(c, (f - 6) * .12)


if __name__ == '__main__':
    run(globals())
