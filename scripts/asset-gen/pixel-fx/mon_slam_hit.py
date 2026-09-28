"""mon_slam_hit: 몸통 박치기 (착탄). A heavy body slam from the left: whoosh, flash, big impact star, shock ring, ground dust and dizzy stars.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_0_17 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_slam_hit', 64, 8, 'target'
PAL = pal(IMPACT, DIRT, pick(GORE, 'r1', 'r3'), WHITE)
PX, PY = CX - 5, CY - 1


def puff(c, x, y, r, seed, dither=False):
    dust(c, x, y, r, seed, fade=dither)


def stars(c, f):
    for i in range(3):
        a = f * 0.9 + i * 2 * math.pi / 3
        x, y = CX + math.cos(a) * 10, CY - 12 + math.sin(a) * 3
        if f < 7 or i == 0:
            star(c, x, y, 3, 1.2, 5, a, 'y2')
            c.px(x, y, 'y3')


def draw(c, f):
    if f == 0:
        for y, x0 in ((PY - 8, 2), (PY - 2, 0), (PY + 4, 4), (PY + 10, 6)):
            c.line([(x0, y), (x0 + 12, y)], 'd3')
        c.arc(PX - 14, PY, 12, -60, 60, 'y3', 2)
        c.arc(PX - 16, PY, 12, -45, 45, 'w', 1)
    elif f == 1:
        c.rays(PX, PY, 8, 3, 9, 'y2', rot=0.2)
        c.disc(PX, PY, 4, 'y3')
        c.disc(PX, PY, 2, 'w')
        for y in (PY - 6, PY + 6):
            c.line([(0, y), (PX - 8, y)], 'd3')
    elif f == 2:
        star(c, PX + 1, PY, 19, 7, 8, 0.2, 'r1')
        star(c, PX + 1, PY, 17, 6, 8, 0.2, 'y2')
        star(c, PX, PY - 1, 10, 4, 8, 0.6, 'y3')
        c.disc(PX, PY - 1, 4, 'w')
        for i, a in enumerate((-2.4, -0.9, 0.5, 1.9, 2.9)):
            x, y = pol(PX, PY, 22, a)
            c.rect(x - 1, y - 1, x + 1, y + 1, 'd2')
            c.px(x - 1, y - 1, 'd4')
    elif f == 3:
        c.ring(PX + 2, PY, 13, 'y2', 3)
        c.ring(PX + 2, PY, 12, 'y3', 1)
        star(c, PX + 1, PY, 8, 3, 8, 0.6, 'y3')
        c.disc(PX + 1, PY, 2, 'w')
        for a in (-0.5, 0.3, 1.1, -1.3, 2.5):
            c.line([pol(PX + 2, PY, 16, a), pol(PX + 2, PY, 22, a)], 'w')
        puff(c, CX - 10, FEET - 2, 4, 3)
        puff(c, CX + 10, FEET - 2, 4, 4)
    elif f == 4:
        c.dring(PX + 2, PY, 19, 'y2')
        c.dring(PX + 2, PY, 17, 'y3', parity=1)
        puff(c, CX - 14, FEET - 3, 6, 5)
        puff(c, CX + 12, FEET - 3, 6, 6)
        for x, y in ((CX - 22, FEET - 12), (CX + 20, FEET - 14), (CX + 24, FEET - 6)):
            c.rect(x, y, x + 1, y + 1, 'd1')
        stars(c, f)
    elif f == 5:
        puff(c, CX - 17, FEET - 5, 7, 7)
        puff(c, CX + 15, FEET - 6, 7, 8)
        puff(c, CX - 2, FEET - 2, 4, 9)
        stars(c, f)
    elif f == 6:
        puff(c, CX - 19, FEET - 9, 7, 7, dither=True)
        puff(c, CX + 17, FEET - 10, 7, 8, dither=True)
        stars(c, f)
    else:
        specks(c, CX, FEET - 12, 8, 14, 24, 71, ['d2', 'd3'], sq=0.4)
        stars(c, f)


if __name__ == '__main__':
    run(globals())

