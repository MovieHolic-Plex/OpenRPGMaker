"""squire_shield: 방패 들기: 작은 파란 방패가 솟아 반짝이며 방어 막 육각 무늬가 번진다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'squire_shield', 64, 8, 'user'
PAL = pal(pick(ICEB, 'i0', 'i1', 'i2', 'i3', 'i4'), pick(GOLDY, 'y1', 'y2', 'y3'), pick(STEELB, 'b1', 'b3'), WHITE)


def shield(c, x, y, s):
    pts = [(x - 9 * s, y - 11 * s), (x + 9 * s, y - 11 * s), (x + 10 * s, y + 2 * s), (x, y + 13 * s), (x - 10 * s, y + 2 * s)]
    c.poly([(px_ + (1 if px_ > x else -1), py_ + (1 if py_ > y else -1)) for px_, py_ in pts], 'i0')
    c.poly(pts, 'i1')
    c.poly([(x - 7 * s, y - 9 * s), (x + 7 * s, y - 9 * s), (x + 8 * s, y + 1 * s), (x, y + 10 * s), (x - 8 * s, y + 1 * s)], 'i2')
    c.line([(x - 8 * s, y - 10 * s), (x + 8 * s, y - 10 * s), (x + 9 * s, y + 1 * s), (x, y + 12 * s), (x - 9 * s, y + 1 * s), (x - 8 * s, y - 10 * s)], 'y2')
    c.rect(x - 1, y - 8 * s, x + 1, y + 9 * s, 'b3')
    c.rect(x - 7 * s, y - 2, x + 7 * s, y, 'b3')
    c.disc(x, y - 1, 2, 'y2')
    c.px(x - 1, y - 2, 'w')
    c.line([(x - 6 * s, y - 8 * s), (x - 6 * s, y - 3 * s)], 'i4')


def draw(c, f):
    if f == 0:
        c.oval(CX, 56, 10, 3, 'i2')
        shield(c, CX, 50, .4)
    elif f == 1:
        shield(c, CX, 42, .75)
        c.dring(CX, 56, 14, 'i3', squash=.3)
    elif f <= 3:
        shield(c, CX, 34, 1.05)
        r = [18, 24][f - 2]
        for i in range(6):
            x, y = pol(CX, 34, r, i * math.pi / 3 + .5, 1.2)
            c.poly([pol(x, y, 5, j * math.pi / 3, 1) for j in range(6)], 'i2' if i % 2 else 'i3')
        c.spark(CX - 8, 26, 4, 'w', 'i4') if f == 3 else None
    elif f <= 5:
        shield(c, CX, 34, 1.05)
        r = 27
        for i in range(6):
            x, y = pol(CX, 34, r, i * math.pi / 3 + .5, 1.2)
            c.poly([pol(x, y, 5, j * math.pi / 3, 1) for j in range(6)], 'i1')
        c.ring(CX, 34, 25, 'i3', 1, squash=1.2)
        c.spark(CX + 6, 28, 5, 'w', 'y3', diag=True) if f == 4 else None
    else:
        shield(c, CX, 34, 1.0)
        c.dring(CX, 34, 27, 'i2', squash=1.2)
        dissolve(c, (f - 5) * .25, box=(0, 0, 63, 63))


if __name__ == '__main__':
    run(globals())
