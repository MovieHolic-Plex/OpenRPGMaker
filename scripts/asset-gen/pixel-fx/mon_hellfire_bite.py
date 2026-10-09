"""mon_hellfire_bite: 지옥불 이빨 (착탄). Blazing jaws lunge from the left, clamp on the ally, erupt into a fireball and leave soot and rising embers.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_0_17 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_hellfire_bite', 64, 10, 'target'
PAL = pal(EMBER, SOOT, pick(BONE, 'b2', 'b3'), WHITE)
JX, JY = CX - 18, CY - 4


def fire_jaws(c, hx, open_, L):
    for s in (-1, 1):
        for k, w in (('e1', 6), ('e2', 4), ('e3', 2)):       # flame gums
            c.line([(hx, JY + s), (hx + L, JY + s * open_)], k, w)
        for i in range(3):
            x = hx + 4 + i * L / 3.5
            c.flame(x, JY + s * (open_ * (x - hx) / L) - (2 if s < 0 else -6), 5, 1.5, ['e2', 'e3'], lean=-1)
    jaws(c, hx, JY, open_, L, ('b2', 'b3'), 'e0', n=5, big=('b3', 'w'))


def embers(c, seed, n, lift, spread=16):
    r = rng(seed)
    for i in range(n):
        x = CX + r.uniform(-spread, spread)
        y = CY - lift * r.uniform(0.5, 1.2) + r.uniform(-4, 8)
        c.px(x, y, 'e4' if i % 3 == 0 else 'e3')
        c.px(x, y + 1, 'e1')


def draw(c, f):
    if f == 0:
        c.flame(8, JY + 4, 12, 3, ['e1', 'e2', 'e3'], lean=6)
        jaws(c, JX - 10, JY, 9, 20, ('b2', 'b3'), 'e1', maw='o0', n=4)
    elif f == 1:
        fire_jaws(c, JX - 4, 14, 28)
    elif f == 2:
        fire_jaws(c, JX + 2, 6, 30)
        c.spark(JX + 31, JY, 4, 'w', 'e4')
    elif f == 3:                                           # clamp: flash
        c.line([(JX + 2, JY), (JX + 34, JY)], 'e1', 5)
        teeth(c, (JX + 5, JY - 2), (JX + 32, JY - 2), 6, 3, False, ('b2', 'b3'))
        star(c, JX + 30, JY, 15, 6, 10, 0.2, 'e2')
        star(c, JX + 30, JY, 10, 4, 10, 0.5, 'e4')
        c.disc(JX + 30, JY, 4, 'w')
    elif f == 4:                                           # fireball
        bx, by = CX + 1, CY - 4
        for i in range(10):                                 # flame tongues thrown outward
            a = i * math.pi / 5 + 0.15
            x0, y0 = pol(bx, by, 9, a)
            x1, y1 = pol(bx, by, 23 if i % 2 else 18, a)
            c.lens((x0, y0), (x1, y1), 3.2, ['e1', 'e2', 'e3'])
        c.ring(bx, by, 13, 'e1', 3)
        c.ring(bx, by, 12, 'e3', 1)
        c.ddisc(bx, by, 11, 'e2')
        c.disc(bx - 1, by - 1, 6, 'e3')
        c.disc(bx - 2, by - 2, 3, 'e4')
        c.disc(bx - 2, by - 2, 1.5, 'w')
    elif f == 5:
        bx, by = CX + 1, CY - 6
        for i in range(7):
            x = bx - 15 + i * 5
            c.flame(x, FEET - 2, 24 - abs(i - 3) * 4, 3.4, ['e1', 'e2', 'e3', 'e4'], lean=(i - 3) * 0.6)
        c.ring(bx, by, 17, 'e2', 1)
        c.ddisc(bx - 2, by - 16, 6, 'o1')
        c.ddisc(bx + 3, by - 20, 4, 'o2', parity=1)
    elif f == 6:
        for i in range(6):
            x = CX - 13 + i * 5.4
            c.flame(x, FEET - 2, 18 - abs(i - 2.5) * 3, 2.8, ['e1', 'e2', 'e3'], lean=(i - 2.5) * 0.5)
        dust(c, CX - 4, CY - 20, 7, 6, keys=('o0', 'o1', 'o2', 'o2'))
        dust(c, CX + 7, CY - 25, 5, 7, keys=('o0', 'o1', 'o2', 'o2'))
        embers(c, 6, 8, 14)
    elif f == 7:
        for i in range(4):
            x = CX - 9 + i * 6
            c.flame(x, FEET - 2, 10 - abs(i - 1.5) * 2, 2.2, ['e1', 'e2', 'e3'])
        dust(c, CX - 6, CY - 28, 7, 8, keys=('o0', 'o1', 'o2', 'o2'))
        dust(c, CX + 6, CY - 33, 5, 9, keys=('o0', 'o1', 'o2', 'o2'), fade=True)
        embers(c, 7, 9, 22)
    elif f == 8:
        c.ddisc(CX - 4, CY - 32, 7, 'o1')
        c.ddisc(CX + 7, CY - 36, 5, 'o2', parity=1)
        embers(c, 8, 8, 30)
        c.oval(CX, FEET, 10, 2, 'o0')
        c.line([(CX - 6, FEET), (CX + 4, FEET)], 'e1')
    else:
        embers(c, 9, 7, 36, 12)
        c.ddisc(CX, FEET, 10, 'o1', squash=0.22)


if __name__ == '__main__':
    run(globals())

