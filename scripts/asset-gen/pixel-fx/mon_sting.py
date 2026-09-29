"""mon_sting: 독침 (착탄). A chitin stinger stabs in from the left, pumps venom, pulls out and leaves spreading poison veins and bubbles.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_0_17 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_sting', 64, 8, 'target'
PAL = pal(ACID, TOXV, pick(SOOT, 'o0', 'o1'), WHITE)
SX, SY = CX - 1, CY


def stinger(c, tip, base=-2, w=4):
    c.poly([(base, SY - w - 1), (tip + 1, SY), (base, SY + w + 1)], 'o0')
    c.poly([(base, SY - w), (tip, SY), (base, SY + w)], 'u1')
    c.line([(base, SY - w + 1), (tip - 2, SY - 1)], 'u3')
    for x in range(base + 3, tip - 6, 5):                 # segment rings
        c.line([(x, SY - w * (1 - (x - base) / (tip - base)) + 1), (x, SY + w * (1 - (x - base) / (tip - base)) - 1)], 'o1')
    c.line([(tip - 5, SY), (tip, SY)], 'a3')


def veins(c, L, seed, k, hi=None):
    r = rng(seed)
    for i in range(6):
        a = i * math.pi / 3 + r.uniform(-0.3, 0.3)
        pts = [(SX, SY)]
        for j in range(1, 4):
            pts.append((SX + math.cos(a) * L * j / 3 + r.uniform(-1.5, 1.5), SY + math.sin(a) * L * j / 3 + r.uniform(-1.5, 1.5)))
        c.line(pts, k)
        if hi:
            c.px(*pts[-1], hi)


def bubbles(c, seed, n, lift):
    r = rng(seed)
    for i in range(n):
        x = SX + r.uniform(-11, 11)
        y = SY - 2 - lift * r.uniform(0.6, 1.3)
        rad = r.choice((1, 1.5, 2))
        c.ring(x, y, rad, 'u3' if i % 2 else 'a3')
        c.px(x - 1, y - 1, 'a4')


def draw(c, f):
    if f == 0:
        c.line([(0, SY), (14, SY)], 'a2')
        c.line([(2, SY - 3), (10, SY - 3)], 'u2')
        c.line([(2, SY + 3), (8, SY + 3)], 'u2')
        c.spark(15, SY, 3, 'w', 'a4')
    elif f == 1:
        stinger(c, SX - 2)
        c.line([(0, SY - 7), (10, SY - 7)], 'a2')
        c.line([(0, SY + 7), (12, SY + 7)], 'a2')
        c.spark(SX - 1, SY, 5, 'w', 'a4', diag=True)
    elif f == 2:
        stinger(c, SX + 4)
        c.disc(SX + 3, SY, 6, 'a1')
        c.disc(SX + 3, SY, 4, 'a3')
        c.ring(SX + 3, SY, 9, 'u2', 2)
        c.rays(SX + 3, SY, 8, 11, 16, 'a4', rot=0.4)
        c.spark(SX + 4, SY, 6, 'w', 'a4', diag=True)
    elif f == 3:
        stinger(c, 8, base=-6, w=3)
        c.disc(SX, SY, 5, 'u1')
        c.disc(SX, SY, 3, 'u2')
        c.disc(SX - 1, SY - 1, 1, 'a4')
        veins(c, 9, 3, 'a2', 'a4')
    elif f == 4:
        c.disc(SX, SY, 3, 'u2')
        c.px(SX - 1, SY - 1, 'u3')
        veins(c, 15, 3, 'a1')
        veins(c, 11, 3, 'a3', 'a4')
        bubbles(c, 4, 4, 5)
    elif f == 5:
        c.disc(SX, SY, 2, 'u2')
        veins(c, 15, 3, 'u2')
        bubbles(c, 5, 7, 10)
    elif f == 6:
        c.ddisc(SX, SY, 4, 'u2')
        bubbles(c, 6, 6, 17)
        for x, y in ((SX - 5, SY - 22), (SX + 6, SY - 20)):
            c.dring(x, y, 3, 'a3')
    else:
        specks(c, SX, SY - 20, 9, 3, 12, 7, ['a3', 'u3', 'a2'])


if __name__ == '__main__':
    run(globals())

