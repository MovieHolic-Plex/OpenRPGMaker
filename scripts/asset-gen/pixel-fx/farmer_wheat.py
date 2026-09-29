"""farmer_wheat: 대풍년: 화면이 황금빛 밀밭으로 물들고 이삭 물결이 오른쪽에서 왼쪽으로 몰아치며 해가 떠오른다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'farmer_wheat', 128, 12, 'screen'
PAL = pal(pick(GOLDY, 'y0', 'y1', 'y2', 'y3'), pick(LEAFG, 'g0', 'g1', 'g2'), pick(EMBER, 'm2', 'm3'), WHITE)
OX, OY = 64, 70


def draw(c, f):
    lvl = [.3, .55, .8, 1, 1, 1, 1, 1, 1, 1, .7, .35][f]
    shade(c, OX, OY, 50 * lvl + 12, 'y0', squash=.8, dense='y0')
    sun = 60 - min(f, 8) * 3
    c.disc(OX, sun, 12, 'm3')
    c.disc(OX, sun, 9, 'y3')
    c.rays(OX, sun, 12, 14, 22 + (f % 2) * 3, 'y2', rot=f * .1)
    for row in range(4):
        y0 = 80 + row * 9
        for i in range(14):
            x = 10 + i * 8 + row * 3
            wave = math.sin((x * .09) + f * .9 - row * .6)
            tip = (x - 3 - wave * 5, y0 - 12 - row)
            c.line([(x, y0), tip], 'g1' if row % 2 else 'g2')
            for j in range(3):
                c.px(tip[0] - j * .6, tip[1] + j, 'y2' if (i + j) % 2 else 'y3')
            c.px(tip[0] + 1, tip[1] + 1, 'y1')
    if 4 <= f <= 10:
        for i in range(8):
            x = 120 - ((f - 4) * 16 + i * 13) % 110
            y = 40 + (i * 11) % 36
            c.line([(x, y), (x + 5, y + 1)], 'y3')
            c.px(x, y, 'w')


if __name__ == '__main__':
    run(globals())

