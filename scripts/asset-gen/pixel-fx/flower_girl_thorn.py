"""flower_girl_thorn: 가시 덩굴: 붉은 장미와 가시 덩굴이 땅에서 솟구쳐 적을 나선으로 옭아맨다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'flower_girl_thorn', 64, 8, 'target'
PAL = pal(pick(LEAFG, 'g0', 'g1', 'g2', 'g3'), pick(ROSE, 'p0', 'p1', 'p2', 'p3'), WHITE)


def vine(c, x0, prog, side, phase):
    pts = []
    for i in range(int(22 * prog) + 1):
        u = i / 22
        y = 58 - u * 48
        x = x0 + math.sin(u * 7 + phase) * (7 + u * 4) * side
        pts.append((x, y))
    if len(pts) > 1:
        c.line(pts, 'g0', 3)
        c.line(pts, 'g1', 2)
        c.line([(x - 1, y) for x, y in pts], 'g2', 1)
        for j in range(2, len(pts), 3):
            x, y = pts[j]
            d = -1 if j % 2 else 1
            c.poly([(x, y - 1), (x + d * 4, y - 3), (x, y + 1)], 'g3')
    return pts


def rose(c, x, y, r):
    c.disc(x, y, r + 1, 'p0')
    c.disc(x, y, r, 'p1')
    c.disc(x - .5, y - .5, r * .66, 'p2')
    c.arc(x, y, r * .5, 200, 20, 'p0', 1)
    c.px(x - 1, y - 1, 'p3')
    for a in (2.4, .7):
        c.petal(x + math.cos(a) * (r + 1), y + math.sin(a) * (r + 1) * .8, a, 3, 'g1', 'g2')


def draw(c, f):
    prog = [.25, .55, .85, 1, 1, 1, .8, .4][f]
    c.oval(CX, 58, 14 * prog + 2, 3, 'g0')
    a = vine(c, 22, prog, 1, 0)
    b = vine(c, 42, prog, -1, 1.7)
    d = vine(c, 32, prog * .9, 1, 3.4)
    if f >= 3:
        for pts in (a, b, d):
            if pts:
                rose(c, pts[-1][0], pts[-1][1], 3 + (f >= 4))
    if f in (3, 4):
        c.spark(CX, 30, 5, 'w', 'p3', diag=True)
    if f >= 5:
        for i in range(6):
            c.petal(14 + i * 7, 16 + ((f - 5) * 9 + i * 7) % 34, i + f, 4, 'p2', 'p3')
    if f >= 6:
        dissolve(c, (f - 5) * .3)


if __name__ == '__main__':
    run(globals())
