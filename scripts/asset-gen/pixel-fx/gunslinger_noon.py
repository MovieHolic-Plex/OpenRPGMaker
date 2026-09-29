"""gunslinger_noon: 하이 눈: 화면이 붉은 황혼으로 물들고 한가운데 태양이 뜨며 시계 바늘이 12시를 가리키는 순간 여섯 줄 탄도가 적진을 가른다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'gunslinger_noon', 128, 12, 'screen'
PAL = pal(pick(EMBER, 'm0', 'm1', 'm2', 'm3', 'm4'), pick(GOLDY, 'y2', 'y3'), pick(EARTHB, 'd1', 'd2'), pick(INKK, 'k0'), WHITE)
OX, OY = 64, 60


def draw(c, f):
    lvl = [.3, .55, .8, 1, 1, 1, 1, 1, 1, 1, .7, .35][f]
    shade(c, OX, OY + 6, 50 * lvl + 12, 'm0', squash=.8, dense='m0')
    c.rect(18, 92, 110, 93, 'd1')
    for x in (26, 102):
        c.rect(x - 1, 78, x + 1, 92, 'k0')
        c.rect(x - 4, 82, x - 2, 84, 'k0')
        c.rect(x + 2, 80, x + 4, 82, 'k0')
    sy = 60 - min(f, 5) * 4
    c.disc(OX, sy, 14, 'm3')
    c.disc(OX, sy, 11, 'y2')
    c.ring(OX, sy, 11, 'm4')
    hand = -math.pi / 2 - max(0, 5 - f) * .45
    c.line([(OX, sy), pol(OX, sy, 9, hand)], 'k0', 2)
    c.line([(OX, sy), pol(OX, sy, 6, -math.pi / 2 - .9)], 'k0')
    tick_ring(c, OX, sy, 12, 12, 'm1', L=2)
    if f == 6:
        c.disc(OX, sy, 20, 'w')
    if 6 <= f <= 10:
        for i in range(6):
            y = 64 + i * 5
            L = min(1, (f - 5) / 2) * 100
            c.line([(118, y - 4), (118 - L, y + 2)], 'y3' if i % 2 else 'm4')
        if f >= 8:
            for i in range(6):
                c.spark(20 + i * 6 - (f - 8) * 3, 66 + i * 5, 4 - (f - 8), 'w', 'm4')
            burst(c, 30, 76, (f - 7) / 4, 12, 3, ['m4', 'y3', 'm2'], spd=(8, 30))


if __name__ == '__main__':
    run(globals())

