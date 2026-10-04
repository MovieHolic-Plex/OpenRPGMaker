"""monk_chi_burst: 기공파 착탄. The chi orb slams in from the right, compresses to a white point,
blooms into a blue sphere ringed in gold, then a double shockwave and cooling motes.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'monk_chi_burst', 64, 10, 'target'
PAL = pal(CHI, pick(MONK, 'o1', 'o2', 'y1', 'y2', 'y3'), WHITE)
CX, CY = 32, 34
BL = ['c0', 'c1', 'c2', 'c3', 'w']


def sphere(c, r):
    for i, k in enumerate(BL):
        c.disc(CX - i * r * 0.07, CY - i * r * 0.07, r * (1 - i * 0.2), k)


def draw(c, f):
    if f == 0:
        x = CX + 12
        c.line([(x, CY), (63, CY)], 'c0', 5)
        c.line([(x, CY), (63, CY)], 'c1', 3)
        c.line([(x, CY), (60, CY)], 'c3', 1)
        c.disc(x, CY, 6, 'c1')
        c.disc(x - 1, CY - 1, 4, 'c2')
        c.disc(x - 1, CY - 1, 2, 'w')
        c.ring(x, CY, 8, 'y2', 1, squash=0.5)
    elif f == 1:
        c.disc(CX, CY, 4, 'c2')
        c.disc(CX, CY, 2, 'w')
        c.spark(CX, CY, 12, 'w', 'c3')
        converge(c, CX, CY, 0.6, 12, 11, ['c1', 'c3'], r0=24, r1=6)
    elif f == 2:
        c.ring(CX, CY, 8, 'y2', 1)
        sphere(c, 7)
        c.spark(CX, CY, 20, 'w', 'c3', diag=True)
        c.rays(CX, CY, 8, 10, 16, 'y3', rot=0.4)
    elif f == 3:
        sphere(c, 13)
        c.ring(CX, CY, 16, 'y1', 2)
        c.ring(CX, CY, 15, 'y3', 1)
        c.rays(CX, CY, 14, 18, 28, 'c3', rot=0.1, jitter=[1, 0.8, 0.95, 0.75])
    elif f == 4:
        sphere(c, 15)
        c.ring(CX, CY, 21, 'o2', 2)
        c.ring(CX, CY, 20, 'y2', 1)
        burst(c, CX, CY, 0.3, 20, 4, ['w', 'c3', 'y3', 'c2'], spd=(16, 30), size=(1, 3))
    elif f == 5:
        c.disc(CX, CY, 13, 'c1')
        c.disc(CX, CY, 10, 'c0')      # sphere hollows out into a ring
        c.ring(CX, CY, 13, 'c3', 1)
        c.ring(CX, CY, 25, 'o1', 2)
        c.ring(CX, CY, 24, 'y2', 1)
        c.spark(CX, CY, 4, 'w', 'c3')
        burst(c, CX, CY, 0.5, 20, 4, ['w', 'c3', 'y3', 'c2', 'c1'], spd=(16, 30), size=(1, 3))
    elif f == 6:
        c.ring(CX, CY, 16, 'c2', 2)
        c.ring(CX, CY, 15, 'c3', 1)
        c.ring(CX, CY, 28, 'o1', 1)
        c.dring(CX, CY, 27, 'y2')
        burst(c, CX, CY, 0.65, 20, 4, ['c3', 'y3', 'c2', 'c1'], spd=(16, 30), size=(1, 3))
    elif f == 7:
        c.dring(CX, CY, 20, 'c2')
        c.dring(CX, CY, 19, 'c1', 1)
        c.dring(CX, CY, 30, 'o1')
        burst(c, CX, CY, 0.8, 20, 4, ['c3', 'c2', 'c1', 'c0'], spd=(16, 30), size=(1, 3), up=0.3)
    elif f == 8:
        c.dring(CX, CY, 23, 'c0')
        burst(c, CX, CY, 0.92, 20, 4, ['c2', 'c1', 'c0'], spd=(16, 30), size=(1, 3), up=0.5)
        converge(c, CX, CY, 0.2, 6, 8, ['y1', 'y3'], r0=10, r1=4, trail=1)
    elif f == 9:
        for i in range(8):
            a = i * math.pi / 4 + 0.3
            x, y = pol(CX, CY - 4, 14 + (i % 3) * 5, a)
            c.px(x, y, 'c2' if i % 2 else 'y2')
        c.spark(CX, CY - 8, 2, 'c3', 'c1')


if __name__ == '__main__':
    run(globals())

