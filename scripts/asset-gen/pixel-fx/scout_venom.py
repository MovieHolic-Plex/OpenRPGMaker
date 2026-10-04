"""scout_venom: 맹독 칼날. Steel thrust from the right, a violet-green venom splash, rising bubbles and a puddle.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'scout_venom', 64, 8, 'target'
PAL = pal(VENOM, pick(STEEL, 's1', 's2'), WHITE)
CX, CY = 32, 36


def drop(c, x, y, r=2):
    c.disc(x, y, r, 'g2')
    c.px(x - 1, y - 1, 'g4')


def bubble(c, x, y, r, k='p2'):
    c.ring(x, y, r, k, 1)
    c.px(x - r // 2, y - r // 2, 'g4')


def puddle(c, rx, dither=False):
    if dither:
        c.ddisc(CX, 56, rx, 'g1', squash=0.22)
        return
    c.oval(CX, 56, rx, 3, 'g0')
    c.oval(CX, 55, rx - 3, 2, 'g1')
    c.line([(CX - rx + 5, 55), (CX - rx + 9, 55)], 'g3')


def draw(c, f):
    if f == 0:
        c.streak((63, CY), (40, CY), [('s1', 3), ('s2', 1)])
        c.line([(58, CY - 4), (46, CY - 4)], 'g2')
        c.line([(60, CY + 4), (50, CY + 4)], 'g2')
        c.spark(40, CY, 4, 'w', 'g3')
    elif f == 1:
        c.streak((63, CY), (30, CY), [('g1', 5), ('g3', 3), ('w', 1)])
        c.ring(CX, CY, 5, 'g2', 2)
        c.spark(CX - 2, CY, 9, 'w', 'g3', diag=True)
    elif f == 2:
        c.rays(CX, CY, 10, 6, 15, 'g3', rot=0.3)
        for i in range(10):
            x, y = pol(CX, CY, 11, i * math.pi / 5 + 0.3)
            drop(c, x, y)
        c.disc(CX, CY, 6, 'p1')
        c.disc(CX - 1, CY - 1, 4, 'p2')
        c.disc(CX - 1, CY - 1, 1, 'w')
    elif f == 3:
        c.ring(CX, CY, 13, 'g2', 2)
        for i in range(10):
            x, y = pol(CX, CY, 17, i * math.pi / 5 + 0.3)
            drop(c, x, y + 2)
            c.line([(x, y + 2), pol(CX, CY + 2, 12, i * math.pi / 5 + 0.3)], 'g1')
        c.disc(CX, CY, 4, 'p1')
        c.disc(CX, CY - 1, 2, 'p2')
        puddle(c, 8)
    elif f == 4:
        c.dring(CX, CY, 17, 'g2')
        for i in range(10):
            x, y = pol(CX, CY, 21, i * math.pi / 5 + 0.3)
            drop(c, x, y + 6, 1)
        for i, (x, y, r) in enumerate([(28, 34, 3), (37, 30, 2), (32, 26, 4), (24, 42, 2)]):
            bubble(c, x, y, r, 'p2' if i % 2 else 'g3')
        puddle(c, 12)
    elif f == 5:
        for x in (20, 30, 41):
            c.line([(x, 44), (x, 50)], 'g1')
            c.px(x, 51, 'g3')
        for i, (x, y, r) in enumerate([(27, 24, 4), (38, 22, 3), (33, 14, 5), (22, 32, 3), (42, 34, 2)]):
            bubble(c, x, y, r, 'p2' if i % 2 else 'g3')
        puddle(c, 15)
    elif f == 6:
        for x, y, r in [(33, 8, 6), (26, 16, 5), (40, 14, 4)]:
            c.dring(x, y, r, 'g3')
            c.px(x, y, 'g4')
        for i, (x, y, r) in enumerate([(21, 24, 2), (43, 26, 3)]):
            bubble(c, x, y, r)
        puddle(c, 16)
    elif f == 7:
        for x, y in [(24, 18), (40, 20), (34, 10)]:
            c.spark(x, y, 1, 'g4', 'g3')
        bubble(c, 44, 18, 2)
        puddle(c, 16, dither=True)


if __name__ == '__main__':
    run(globals())

