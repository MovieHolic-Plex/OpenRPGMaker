"""scout_assassin_hit: 암살 (착탄). A crimson X cut on the target, a white star flash, a blood-red ring and falling petals.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'scout_assassin_hit', 64, 8, 'target'
PAL = pal(pick(SHADOW, 'k', 'd', 'v', 'l'), CRIMSON, WHITE)
CX, CY = 32, 36
X1 = ((52, 12), (12, 58), 6)
X2 = ((12, 14), (54, 56), -6)


def drops(c, dist, fall, seed, n=10):
    r = rng(seed)
    for i in range(n):
        a = r.uniform(0, 2 * math.pi)
        d = dist * r.uniform(0.7, 1.1)
        x, y = CX + math.cos(a) * d, CY + math.sin(a) * d * 0.8 + fall * r.uniform(0.6, 1.2)
        c.diamond(x, y, 1, 2, 'r1' if i % 3 else 'r2')


def draw(c, f):
    if f == 0:
        c.line([X1[0], X1[1]], 'w')
        c.line([X2[0], X2[1]], 'r2')
        c.spark(CX, CY, 5, 'w', 'l')
    elif f == 1:
        for p0, p1, b in (X1, X2):
            c.blade(p0, p1, b, 8, ['r0', 'r1', 'r2', 'w'])
        c.spark(CX, CY, 8, 'w', 'r2', diag=True)
    elif f == 2:
        for p0, p1, b in (X1, X2):
            c.blade(p0, p1, b, 9, ['r1', 'r2', 'w'])
        c.ring(CX, CY, 9, 'r2', 2)
        c.spark(CX, CY, 20, 'w', 'l')
        c.disc(CX, CY, 4, 'w')
    elif f == 3:
        for p0, p1, b in (X1, X2):
            c.blade(p0, p1, b, 4, ['r0', 'r1'])
        c.ring(CX, CY, 15, 'r1', 2)
        c.ring(CX, CY, 13, 'k', 1)
        drops(c, 14, 0, 1)
        c.spark(CX, CY, 5, 'w', 'r2')
    elif f == 4:
        for p0, p1, b in (X1, X2):
            c.blade(p0, p1, b, 1.5, ['r0'])
        c.dring(CX, CY, 20, 'r1')
        c.dring(CX, CY, 19, 'd', 1)
        drops(c, 20, 4, 2)
    elif f == 5:
        c.dring(CX, CY, 24, 'r0')
        drops(c, 24, 10, 3)
    elif f == 6:
        drops(c, 24, 16, 4, 7)
        c.ddisc(CX, 56, 12, 'r0', squash=0.2)
    elif f == 7:
        for x, y in [(18, 40), (46, 46), (36, 20), (26, 54)]:
            c.spark(x, y, 1, 'r2')


if __name__ == '__main__':
    run(globals())

