"""mon_howl_ring: 포효 (몬스터 편 전체 강화). A crimson war-howl: shock rings burst from the throat, fiery rage flickers up the body and red up-chevrons rise.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_0_17 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_howl_ring', 64, 8, 'allAllies'
PAL = pal(GORE, pick(EMBER, 'e2', 'e3', 'e4'), pick(SOOT, 'o0'), WHITE)
HX, HY = UX + 4, UY - 4                  # the monster faces right: throat slightly right of centre


def rage(c, f, h, dither=False):
    r = rng(40 + f)
    for i in range(7):
        x = UX - 18 + i * 6 + r.uniform(-1.5, 1.5)
        base = 58 - abs(i - 3) * 1.5
        hh = h * r.uniform(0.6, 1.1) * (1 - abs(i - 3) * 0.1)
        if dither:
            c.dline((x, base), (x + r.uniform(-1, 1), base - hh), 'r2')
        else:
            c.flame(x, base, hh, 2.2, ['r1', 'r2', 'e3'], lean=r.uniform(-2, 2))


def up(c, y, k='r3', hi='e4'):
    for x in (UX - 14, UX + 14):
        chevron(c, x, y, 3, k, hi)
    chevron(c, UX, y - 6, 4, k, hi)


def draw(c, f):
    if f == 0:
        c.ring(HX, HY, 5, 'r2', 2, squash=0.8)
        c.disc(HX, HY, 2, 'e4')
    elif f == 1:
        c.ring(HX, HY, 11, 'r1', 3, squash=0.8)
        c.ring(HX, HY, 10, 'r3', 1, squash=0.8)
        c.rays(HX, HY, 12, 13, 18, 'e3', rot=0.26, squash=0.8)
        c.disc(HX, HY, 3, 'e4')
        c.disc(HX, HY, 1, 'w')
    elif f == 2:
        c.ring(HX, HY, 19, 'r1', 3, squash=0.8)
        c.ring(HX, HY, 18, 'r3', 1, squash=0.8)
        c.ring(HX, HY, 11, 'r2', 2, squash=0.8)
        c.rays(HX, HY, 12, 21, 27, 'e4', rot=0.0, squash=0.8)
        rage(c, f, 8)
    elif f == 3:
        c.dring(HX, HY, 25, 'r2', squash=0.8)
        c.ring(HX, HY, 17, 'r1', 2, squash=0.8)
        c.ring(HX, HY, 16, 'e3', 1, squash=0.8)
        rage(c, f, 18)
        up(c, 30, 'e3', 'w')
    elif f == 4:
        rage(c, f, 24)
        c.dring(HX, HY, 22, 'r1', squash=0.8)
        up(c, 22, 'e3', 'w')
        for a in (-2.2, -0.8, 0.6):
            c.spark(*pol(UX, UY, 22, a), 2, 'w', 'e4')
    elif f == 5:
        rage(c, f, 18)
        up(c, 14)
        c.ring(UX, 58, 20, 'r1', 1, squash=0.2)
    elif f == 6:
        rage(c, f, 12, dither=True)
        up(c, 9, 'r2', 'r4')
        specks(c, UX, UY - 6, 8, 12, 24, 6, ['e3', 'r3'])
    else:
        chevron(c, UX, 4, 3, 'r2')
        specks(c, UX, UY - 14, 10, 8, 24, 7, ['r3', 'e3', 'r2'])


if __name__ == '__main__':
    run(globals())

