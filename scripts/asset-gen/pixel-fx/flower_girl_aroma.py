"""flower_girl_aroma: 향기: 연분홍 향기 물결이 굽이쳐 오르고 꽃송이와 나비가 아군 사이를 날아다닌다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'flower_girl_aroma', 64, 10, 'allAllies'
PAL = pal(ROSE, pick(LEAFG, 'g2', 'g3'), pick(GOLDY, 'y2', 'y3'), WHITE)


def butterfly(c, x, y, f):
    up = f % 2
    for sd in (-1, 1):
        c.oval(x + sd * 3, y - 2 - up, 3, 2.4 + up, 'y3')
        c.oval(x + sd * 3, y + 2, 2, 1.6, 'p3')
    c.line([(x, y - 3), (x, y + 3)], 'p0')


def draw(c, f):
    lvl = [.4, .7, 1, 1, 1, 1, 1, 1, .7, .4][f]
    for k in range(3):
        pts = [(8 + x, 44 - k * 8 - x * .1 + math.sin(x * .28 + f * .9 + k * 1.7) * 5 * lvl) for x in range(0, 50, 2)]
        c.line(pts, 'p2' if k != 1 else 'p3', 2)
        c.line([(x, y + 1) for x, y in pts], 'p1', 1)
    for i in range(5):
        x = 10 + i * 11
        y = 50 - ((f * 5 + i * 8) % 42)
        c.petal(x, y, f * .7 + i, 4, 'p2' if i % 2 else 'p3', 'p4')
    butterfly(c, 18 + (f * 4) % 30, 24 + math.sin(f) * 4, f)
    butterfly(c, 44 - (f * 3) % 24, 32 + math.cos(f) * 3, f + 1)
    for i in range(5):
        c.spark(10 + (i * 11 + f * 2) % 46, 12 + (i * 13) % 34, 2 if i % 2 else 1, 'w', 'y3') if (i + f) % 2 == 0 else None
    c.dring(CX, 56, 12 + lvl * 8, 'g2', squash=.3, parity=f)


if __name__ == '__main__':
    run(globals())
