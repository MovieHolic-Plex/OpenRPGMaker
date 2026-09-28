"""scout_flurry: 쌍검 난무. Four crescent cuts in quick succession, then a starburst where they cross.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'scout_flurry', 64, 10, 'target'
PAL = pal(SHADOW, STEEL, CRIMSON, WHITE)
CX, CY = 32, 36
CUTS = [((54, 10), (10, 56), 8), ((8, 14), (56, 52), -8), ((3, 30), (61, 42), 6), ((44, 4), (22, 62), -7)]
EDGE = ['m', 'v', 's2', 'w']


def droplets(c, p0, p1, seed):
    mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
    r = rng(seed)
    for _ in range(4):
        a = r.uniform(0, 2 * math.pi)
        d = r.uniform(4, 9)
        x, y = mx + math.cos(a) * d, my + math.sin(a) * d
        c.disc(x, y, 1, 'r1')
        c.px(x, y, 'r2')


def draw(c, f):
    if f == 0:
        # gather: glints converge on the target
        for i in range(8):
            a = i * math.pi / 4 + 0.3
            x0, y0 = pol(CX, CY, 24, a)
            x1, y1 = pol(CX, CY, 15, a)
            c.line([(x0, y0), (x1, y1)], 'm')
            c.spark(x1, y1, 2, 'w', 'l')
        c.spark(CX, CY, 4, 'w', 'v')
        return
    for i, (p0, p1, b) in enumerate(CUTS):
        age = f - (1 + i)
        if age == 0:
            c.blade(p0, p1, b, 7, EDGE, frac=0.62)
        elif age == 1:
            c.blade(p0, p1, b, 8, EDGE)
            droplets(c, p0, p1, i * 7 + f)
        elif age == 2 and f < 7:
            c.blade(p0, p1, b, 2, ['d', 'm'])
    # small hit spark on every cut frame
    if 1 <= f <= 5:
        r = rng(f)
        c.spark(CX + r.randint(-5, 5), CY + r.randint(-5, 5), 4 + f % 2, 'w', 'l')
    if f == 6:
        c.ring(CX, CY, 10, 'v', 2)
        c.spark(CX, CY, 16, 'w', 'l', diag=True)
        c.disc(CX, CY, 4, 'l')
        c.disc(CX, CY, 2, 'w')
    elif f == 7:
        c.ring(CX, CY, 16, 'v', 2)
        c.ring(CX, CY, 14, 'l', 1)
        for i in range(10):
            a = i * math.pi / 5 + 0.2
            c.line([pol(CX, CY, 8, a), pol(CX, CY, 13, a)], 's2')
        c.spark(CX, CY, 6, 'w', 'l')
        droplets(c, (CX - 8, CY), (CX + 8, CY), 77)
    elif f == 8:
        c.dring(CX, CY, 21, 'v')
        c.dring(CX, CY, 20, 'm', 1)
        for i in range(10):
            a = i * math.pi / 5 + 0.5
            x, y = pol(CX, CY, 18, a)
            c.line([(x, y), pol(CX, CY, 21, a)], 'l')
        c.spark(CX, CY, 2, 'w', 'l')
    elif f == 9:
        c.dring(CX, CY, 26, 'd')
        for i in range(6):
            a = i * math.pi / 3 + 0.9
            x, y = pol(CX, CY, 23, a)
            c.spark(x, y, 1, 'l')


if __name__ == '__main__':
    run(globals())

