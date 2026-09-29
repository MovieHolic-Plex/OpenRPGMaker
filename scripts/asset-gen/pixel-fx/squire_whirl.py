"""squire_whirl: 회전 베기: 흰 강철 원호가 적 둘레를 세 겹으로 휘돌고 금빛 불똥이 원을 그린다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'squire_whirl', 64, 10, 'allTargets'
PAL = pal(STEELB, pick(GOLDY, 'y2', 'y3'), pick(SMOG, 'q2'), WHITE)
OX, OY = 32, 38


def draw(c, f):
    lvl = [.4, .7, 1, 1, 1, 1, 1, .9, .6, .35][f]
    R = 24 * lvl
    ry = R * .5
    rot = f * 52
    band(c, OX, OY, R, ry, rot, rot + 190, 9, ['b0', 'b1', 'b2', 'b3', 'w'])
    band(c, OX, OY, R * .72, ry * .72, rot + 120, rot + 250, 5, ['b0', 'b1', 'b3'])
    if 2 <= f <= 8:
        band(c, OX, OY, R * 1.12, ry * 1.12, rot + 250, rot + 330, 3, ['b0', 'b1'])
    for k in range(4):
        aa = math.radians(rot * 1.2 + k * 90)
        c.spark(OX + math.cos(aa) * (R + 2), OY + math.sin(aa) * (ry + 2), 2, 'w', 'y3') if f in (2, 3, 4, 5, 6) else None
    c.dring(OX, 55, 12 + f * 1.5, 'q2', parity=f, squash=.3)
    if f in (0, 9):
        c.spark(OX, OY, 4, 'w', 'b3')


if __name__ == '__main__':
    run(globals())
