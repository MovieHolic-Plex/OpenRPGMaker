"""ranger_power_hit: 강사·저격 착탄. The arrow punches in, a gold starburst, a double shock ring and a horizontal pierce line exiting left.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'ranger_power_hit', 64, 8, 'target'
PAL = pal(GOLD, pick(WOOD, 't1', 't2'), pick(STEEL, 's1', 's2'), pick(LEAF, 'l3'), WHITE)
CX, CY = 32, 34


def stuck(c):
    c.arrow(CX - 2, CY, math.pi, 20, 't1', 's1', 'l3', hi='s2', head_len=5, head_w=2.5)
    c.line([(CX + 4, CY), (CX + 16, CY)], 't2')


def draw(c, f):
    if f == 0:
        c.arrow(CX + 2, CY, math.pi, 22, 't1', 's1', 'l3', hi='s2')
        for y in (CY - 3, CY + 3):
            c.line([(CX + 10, y), (63, y)], 'y2')
        c.spark(CX + 2, CY, 4, 'w', 'y3')
    elif f == 1:
        stuck(c)
        c.rays(CX, CY, 8, 4, 14, 'y2', rot=0.39)
        c.spark(CX, CY, 12, 'w', 'y3', diag=True)
        c.disc(CX, CY, 4, 'y3')
        c.disc(CX, CY, 2, 'w')
    elif f == 2:
        stuck(c)
        c.line([(CX, CY), (0, CY)], 'y1', 5)
        c.line([(CX, CY), (0, CY)], 'y2', 3)
        c.line([(CX, CY), (0, CY)], 'w', 1)
        c.ring(CX, CY, 10, 'y2', 2)
        c.ring(CX, CY, 8, 'w', 1)
        c.rays(CX, CY, 12, 12, 22, 'y3', rot=0.2, jitter=[1, 0.7, 0.85])
    elif f == 3:
        stuck(c)
        c.line([(CX - 4, CY), (0, CY)], 'y1', 3)
        c.line([(CX - 4, CY), (0, CY)], 'y3', 1)
        c.ring(CX, CY, 16, 'y1', 2)
        c.ring(CX, CY, 14, 'y3', 1)
        c.ring(CX, CY, 8, 'y2', 1)
        for i in range(8):
            x, y = pol(CX, CY, 19, i * math.pi / 4 + 0.2)
            c.spark(x, y, 2, 'w', 'y2')
    elif f == 4:
        stuck(c)
        c.line([(CX - 10, CY), (4, CY)], 'y2')
        c.ring(CX, CY, 21, 'y1', 1)
        c.dring(CX, CY, 20, 'y2', 1)
        c.dring(CX, CY, 13, 'y1')
        for i in range(8):
            a = i * math.pi / 4 + 0.6
            x, y = pol(CX, CY, 17, a)
            c.line([(x, y), pol(CX, CY, 21, a)], 'y3')
    elif f == 5:
        stuck(c)
        c.dring(CX, CY, 25, 'y1')
        for i in range(6):
            x, y = pol(CX, CY, 22, i * math.pi / 3 + 0.9)
            c.spark(x, y, 1, 'y3')
    elif f == 6:
        c.arrow(CX - 2, CY + 2, math.pi + 0.12, 20, 't1', 's1', 'l3')
        c.dring(CX, CY, 28, 'y0')
    elif f == 7:
        c.arrow(CX - 2, CY + 6, math.pi + 0.3, 18, 't1', 's1', 'l3')
        c.spark(20, 22, 1, 'y3')
        c.spark(44, 44, 1, 'y2')


if __name__ == '__main__':
    run(globals())

