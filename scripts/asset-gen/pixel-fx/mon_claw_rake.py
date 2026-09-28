"""mon_claw_rake: 할퀴기 (착탄). Three savage claw streaks rake down-right across the ally, turn into bleeding gashes and flicker out.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_0_17 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_claw_rake', 64, 8, 'target'
PAL = pal(GORE, pick(BONE, 'b2', 'b3'), pick(DUSK, 'v1'), WHITE)
LINES = [((6 + i * 7, 12 + i * 3), (38 + i * 7, 58 + i * 1)) for i in range(3)]


def claw(c, i, frac, th, keys):
    p0, p1 = LINES[i]
    c.blade(p0, p1, 3, th, keys, frac)


def gash(c, i, open_, dither=False):
    (x0, y0), (x1, y1) = LINES[i]
    a0 = (lerp(x0, x1, 0.25), lerp(y0, y1, 0.25))
    a1 = (lerp(x0, x1, 0.8), lerp(y0, y1, 0.8))
    if dither:
        c.dline(a0, a1, 'r2', 2, i)
        return
    c.lens(a0, a1, open_, ['r1', 'r2', 'r3'])
    c.line([(a0[0] - 1, a0[1]), (lerp(a0[0], a1[0], 0.5) - 1, lerp(a0[1], a1[1], 0.5))], 'r4')


def draw(c, f):
    if f == 0:
        for i in range(3):
            p0, _ = LINES[i]
            fang(c, p0[0] - 2, p0[1] - 6, 5, 1.2, True, 'b3', 'w', edge='v1')
    elif f == 1:
        for i in range(3):
            claw(c, i, 0.45 - i * 0.08, 5, ['b2', 'b3', 'w'])
    elif f == 2:
        for i in range(3):
            claw(c, i, 1.0 - i * 0.12, 6, ['r2', 'b3', 'w'])
    elif f == 3:
        for i in range(3):
            claw(c, i, 1.0, 7, ['r1', 'r3', 'b3', 'w'])
        for i in range(3):
            c.spark(*LINES[i][1], 3, 'w', 'r4')
        c.spark(CX, CY - 3, 6, 'w', 'r4', diag=True)
    elif f == 4:
        for i in range(3):
            gash(c, i, 2.5)
        drops(c, CX + 4, CY, 12, 12, 22, 44, 'r2', 'r4', a0=-0.6, a1=1.4, size=1.4)
    elif f == 5:
        for i in range(3):
            gash(c, i, 2)
        drops(c, CX + 4, CY, 8, 18, 26, 44, 'r1', 'r3', a0=-0.6, a1=1.4, size=1.1, fall=6)
    elif f == 6:
        for i in range(3):
            gash(c, i, 1.3)
    else:
        for i in range(3):
            gash(c, i, 1, dither=True)


if __name__ == '__main__':
    run(globals())

