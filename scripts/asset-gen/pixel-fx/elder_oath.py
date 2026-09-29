"""elder_oath: 마을의 맹세: 화면 아래에 마을 지붕 실루엣과 등불이 켜지고 등불에서 솟은 빛줄기가 하늘 한가운데로 모여 내리꽂힌다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'elder_oath', 128, 12, 'screen'
PAL = pal(pick(GOLDY, 'y0', 'y1', 'y2', 'y3'), pick(TEAL, 't0', 't1', 't2', 't3'), pick(EMBER, 'm2', 'm3'), WHITE)
OX, OY = 64, 66
HOUSES = [(22, 90, 10), (42, 94, 8), (64, 88, 12), (86, 93, 9), (106, 90, 10)]


def draw(c, f):
    lvl = [.3, .55, .8, 1, 1, 1, 1, 1, 1, 1, .7, .35][f]
    shade(c, OX, OY, 50 * lvl + 12, 't0', squash=.8, dense='t0')
    for i, (x, y, w) in enumerate(HOUSES):
        c.rect(x - w, y, x + w, 108, 't0')
        c.poly([(x - w - 2, y), (x + w + 2, y), (x, y - w)], 't1')
        lit = f >= 1 + i
        c.rect(x - 2, y + 4, x + 1, y + 7, 'y2' if lit else 't1')
        if lit and f <= 9:
            t = min(1, (f - 1 - i) / 4)
            tx, ty = lerp(x, OX, t), lerp(y - 2, 26, t)
            c.line([(x, y), (tx, ty)], 'y1')
            c.px(tx, ty, 'y3')
    if f >= 6:
        k = f - 6
        c.disc(OX, 24, 4 + min(k, 3) * 2, 'y2')
        c.disc(OX, 24, 2 + min(k, 3), 'w')
    if 7 <= f <= 10:
        beam(c, OX, 26, OX, 84, 4, 18, 'y3', 'y1', phase=f * 2, stripes=4)
        c.ring(OX, 84, 18 + (f - 7) * 6, 'y3', squash=.3)
    if f == 8:
        c.spark(OX, 84, 10, 'w', 'y3', diag=True)


if __name__ == '__main__':
    run(globals())

