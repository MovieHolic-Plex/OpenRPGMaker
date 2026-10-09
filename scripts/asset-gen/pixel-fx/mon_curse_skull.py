"""mon_curse_skull: 해골의 저주 (착탄). A violet sigil opens over the ally, a skull with crimson eyes rises out of it, grins, sinks into the body and drains strength (down-chevrons).
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_0_17 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_curse_skull', 64, 10, 'target'
PAL = pal(DUSK, pick(GORE, 'r2', 'r3', 'r4'), pick(BONE, 'b1', 'b2', 'b3'), WHITE)
SX, SY = CX + 1, CY - 14


def sigil(c, r, rot, k, k2=None):
    c.ring(CX, FEET - 2, r, k, 1, squash=0.35)
    pts = [pol(CX, FEET - 2, r, rot + i * 4 * math.pi / 5, 0.35) for i in range(5)]
    c.line(pts + [pts[0]], k2 or k)


def down(c, y, k='v3', hi='r3'):
    for x in (CX - 10, CX + 10):
        chevron(c, x, y, 3, k, None, down=True)
    chevron(c, CX, y + 5, 4, k, None, down=True)
    c.px(CX, y + 6, hi)


def draw(c, f):
    if f == 0:
        sigil(c, 8, 0.0, 'v2')
        specks(c, CX, FEET - 6, 8, 4, 14, 1, ['v3', 'v4'], sq=0.4)
    elif f == 1:
        sigil(c, 16, 0.3, 'v2', 'v3')
        for x in (CX - 8, CX + 8):
            c.line([(x, FEET - 4), (x, FEET - 14)], 'v2')
        c.rect(CX - 1, FEET - 20, CX + 1, FEET - 4, 'v3')
    elif f == 2:
        sigil(c, 20, 0.6, 'v1', 'v3')
        c.ddisc(CX, CY - 4, 11, 'v1')
        skull(c, SX, SY + 12, 0.7, 'b2', 'b3', 'v1', 'v0')
    elif f == 3:
        sigil(c, 20, 0.9, 'v1', 'v2')
        c.ddisc(SX, SY, 12, 'v1')
        c.ring(SX, SY, 12, 'v3', 1)
        skull(c, SX, SY + 2, 1.0, 'b2', 'b3', 'v0', 'v0', glow='r2')
    elif f == 4:                                           # peak: eyes blaze, jaw drops
        c.ddisc(SX, SY, 14, 'v1')
        c.ring(SX, SY, 14, 'v3', 2)
        c.rays(SX, SY, 12, 16, 22, 'v3', rot=0.26)
        skull(c, SX, SY, 1.15, 'b3', 'w', 'v0', 'v0', glow='r3', jaw=2)
        for sx in (-1, 1):
            c.spark(SX + sx * 3, SY + 1, 3, 'r4', 'r2')
    elif f == 5:
        c.ring(SX, SY + 2, 12, 'v2', 1)
        skull(c, SX, SY + 4, 1.0, 'b2', 'b3', 'v0', 'v0', glow='r3', jaw=1)
        for x in (SX - 12, SX + 12):
            c.line([(x, SY + 10), (x, SY + 20)], 'v2')
    elif f == 6:                                           # sinks into the chest
        skull(c, SX, SY + 12, 0.8, 'b1', 'b2', 'v1', 'v0', glow='r2')
        c.ring(CX, CY, 12, 'v2', 1, squash=0.6)
        c.ring(CX, CY, 8, 'v3', 1, squash=0.6)
    elif f == 7:
        c.disc(CX, CY, 5, 'v2')
        c.disc(CX, CY, 2, 'r2')
        c.dring(CX, CY, 14, 'v3', squash=0.6)
        down(c, CY - 22)
    elif f == 8:
        c.ddisc(CX, CY, 6, 'v2')
        down(c, CY - 14, 'v3')
        specks(c, CX, CY, 8, 10, 20, 8, ['v2', 'r2'])
    else:
        down(c, CY - 8, 'v2', 'v3')
        specks(c, CX, CY + 4, 6, 8, 18, 9, ['v2', 'v1'])


if __name__ == '__main__':
    run(globals())

