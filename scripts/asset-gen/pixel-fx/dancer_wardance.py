"""dancer_wardance: 전투의 춤: 발밑에 박자 고리가 번지고 붉은 리본 두 가닥이 나선으로 솟으며 금빛 별이 튄다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'dancer_wardance', 64, 10, 'allAllies'
PAL = pal(ROSE, pick(GOLDY, 'y1', 'y2', 'y3'), WHITE)


def helix(c, f, phase, k):
    pts = []
    for i in range(24):
        u = i / 23
        y = 56 - u * 44
        x = CX + math.sin(u * 8 + f * .9 + phase) * (13 - u * 3)
        pts.append((x, y))
    return pts


def draw(c, f):
    beat = f % 4
    c.dring(CX, 55, 10 + beat * 7, 'y2', parity=f, squash=.32) if beat else c.ring(CX, 55, 10, 'y2', 2, squash=.32)
    c.dring(CX, 55, 6 + ((f + 2) % 4) * 6, 'p2', parity=f + 1, squash=.32)
    a = helix(c, f, 0, 'p1')
    b = helix(c, f, math.pi, 'y1')
    ln = min(24, 6 + f * 4)
    ribbon(c, a[:ln], ('p0', 'p1', 'p2'), 2)
    ribbon(c, b[:ln], ('p0', 'y1', 'y2'), 2)
    if f >= 2:
        for i in range(5):
            x = CX - 14 + i * 7
            y = 46 - ((f * 6 + i * 9) % 38)
            c.spark(x, y, 2 + (i % 2), 'w', 'y3')
    if f in (0, 4, 8):
        for i in range(6):
            x, y = pol(CX, 55, 16, i * math.pi / 3 + .3, .32)
            c.disc(x, y, 1.3, 'w')
    if f >= 6:
        for j in range(3):
            chevron(c, CX - 10 + j * 10, 30 - (f - 6) * 4 - j * 2, 3, 'y3', ol='p0')


if __name__ == '__main__':
    run(globals())
