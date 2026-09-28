"""mon_fang_bite: 맹독 이빨 (착탄). Violet serpent jaws gape from the left, snap shut on the ally, and dark venom seeps out in bubbling drips.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_0_17 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_fang_bite', 64, 8, 'target'
PAL = pal(TOXV, pick(ACID, 'a1', 'a2', 'a3', 'a4'), pick(BONE, 'b2', 'b3'), pick(DUSK, 'v0'), WHITE)
JX, JY = CX - 18, CY - 4


def draw(c, f):
    if f == 0:
        jaws(c, JX - 8, JY, 12, 22, ('b2', 'b3'), 'u1', maw='v0', n=4, big=('b3', 'w'))
    elif f == 1:
        jaws(c, JX - 2, JY, 16, 30, ('b2', 'b3'), 'u1', maw='v0', n=5, big=('b3', 'w'))
        c.px(JX + 28, JY - 9, 'a3')
        c.px(JX + 28, JY + 11, 'a3')
    elif f == 2:
        jaws(c, JX + 2, JY, 5, 32, ('b2', 'b3'), 'u2', maw='v0', n=5, big=('b3', 'w'))
        c.spark(JX + 30, JY, 5, 'w', 'u3', diag=True)
    elif f == 3:                                           # snap: jaws shut, venom burst
        c.line([(JX + 2, JY), (JX + 34, JY - 1)], 'u1', 3)
        teeth(c, (JX + 5, JY - 2), (JX + 32, JY - 2), 6, 3, False, ('b2', 'b3'))
        star(c, JX + 30, JY, 13, 5, 8, 0.3, 'u2')
        star(c, JX + 30, JY, 8, 3, 8, 0.6, 'a3')
        c.disc(JX + 30, JY, 2, 'w')
        drops(c, JX + 30, JY, 10, 12, 19, 33, 'u2', 'u3', size=1.5)
    elif f == 4:
        for dx in (-3, 3):
            c.disc(JX + 30 + dx, JY + 1, 2, 'u1')
            c.px(JX + 30 + dx, JY, 'a3')
        for i, x in enumerate((JX + 24, JX + 29, JX + 34)):
            c.line([(x, JY + 3), (x, JY + 9 + i * 2)], 'u2', 2)
            c.disc(x, JY + 10 + i * 2, 1.4, 'u3')
        c.ring(JX + 30, JY, 11, 'u2', 1)
        c.dring(JX + 30, JY, 15, 'a2')
    elif f == 5:
        for i, x in enumerate((JX + 23, JX + 29, JX + 35)):
            c.line([(x, JY + 3), (x, JY + 13 + i * 2)], 'u2', 2)
            c.disc(x, JY + 15 + i * 2, 1.4, 'u3')
        for x, y, r in ((CX - 4, CY - 16, 2), (CX + 6, CY - 12, 1.5), (CX, CY - 22, 1.5)):
            c.ring(x, y, r, 'a3')
            c.px(x - 1, y - 1, 'a4')
        c.oval(CX, FEET, 8, 2, 'u1')
    elif f == 6:
        for x, y, r in ((CX - 6, CY - 24, 2), (CX + 7, CY - 20, 2), (CX + 1, CY - 30, 1.5)):
            c.ring(x, y, r, 'u3')
            c.px(x - 1, y - 1, 'a4')
        c.ddisc(CX + 1, CY - 4, 5, 'u2')
        c.oval(CX, FEET, 12, 3, 'u0')
        c.oval(CX - 1, FEET - 1, 9, 2, 'u1')
    else:
        specks(c, CX, CY - 26, 8, 3, 12, 7, ['u3', 'a3'])
        c.ddisc(CX, FEET, 12, 'u1', squash=0.22)


if __name__ == '__main__':
    run(globals())

