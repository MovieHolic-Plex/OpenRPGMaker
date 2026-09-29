"""alchemist_acid_splash: 산성 플라스크 착탄: 유리 조각과 함께 초록 액이 왕관 모양으로 튀고 거품 이는 연기가 오르며 뚝뚝 녹아내린다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'alchemist_acid_splash', 64, 8, 'target'
PAL = pal(LEAFG, pick(ICEB, 'i3', 'i4'), pick(SMOG, 'q2', 'q3'), WHITE)
IX, IY = 32, 38


def draw(c, f):
    if f == 0:
        pow_burst(c, IX, IY, 9, ['g1', 'g2', 'g3', 'w'], rot=.2, n=8)
        for i in range(6):
            a = i * 1.05 + .3
            x, y = pol(IX, IY, 11, a)
            c.px(x, y, 'i4')
            c.px(x + 1, y, 'i3')
    elif f <= 3:
        r = [0, 11, 17, 21][f]
        c.ring(IX, IY + 8, r, 'g2', 2, squash=.4)
        # 왕관 튀김
        for i in range(9):
            a = -math.pi + i * math.pi / 8
            x, y = pol(IX, IY + 4, r * .8, a, .9)
            hh = 5 + (i % 3) * 3
            c.line([(x, y + 3), (x, y - hh)], 'g2', 2 if i % 2 else 1)
            c.disc(x, y - hh - 1, 1, 'g3')
        c.disc(IX, IY + 6, 8 - f, 'g1')
        for i in range(5):
            a = i * 1.3 + f
            x, y = pol(IX, IY, 12 + f * 4, a)
            c.px(x, y, 'i4')
    elif f <= 5:
        k = f - 4
        c.ring(IX, IY + 8, 22 + k * 3, 'g1', 1, squash=.4)
        c.oval(IX, IY + 12, 14 + k * 3, 4, 'g1')
        c.oval(IX, IY + 11, 10 + k * 2, 3, 'g2')
        drops(c, IX, IY, .6 + k * .25, 8, 6, ['g2', 'g3'], spd=(8, 18))
        c.puff(IX - 6, IY - 6 - k * 4, 6, ['g0', 'g1', 'g2'], 2)
        c.puff(IX + 7, IY - 10 - k * 4, 5, ['g0', 'g1', 'g2'], 3)
        for i in range(3):
            bubble(c, 18 + i * 14, 24 - k * 6 + (i % 2) * 4, 2, 'g3')
    else:
        k = f - 6
        c.oval(IX, IY + 12, 14 + k * 2, 4, 'g1')
        for i in range(4):
            x = 20 + i * 8
            L = 4 + k * 4 + (i % 2) * 3
            c.line([(x, IY + 13), (x, IY + 13 + L)], 'g2')
            c.px(x, IY + 14 + L, 'g3')
        c.puff(IX - 4, IY - 16 - k * 3, 6, ['g0', 'g1'], 4)
        c.puff(IX + 6, IY - 20 - k * 3, 5, ['q2', 'q3'], 5)
        for i in range(3):
            bubble(c, 16 + i * 14, 16 - k * 3 + (i % 2) * 4, 2 - k % 2 + (1 if k == 0 else 0), 'g3')
        dissolve(c, .3 * k)


if __name__ == '__main__':
    run(globals())
