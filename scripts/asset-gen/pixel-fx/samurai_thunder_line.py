"""samurai_thunder_line: 뇌광 일섬 (화면). Storm dark gathers, a gold-white lightning draw splits the stage right->left in one horizontal line, branches crackle off it, then it burns out to sparks.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'samurai_thunder_line', 128, 10, 'screen'
PAL = pal(INDIGO, BOLT, pick(SAKURA, 's2'), WHITE)
Y = 70


def band(c, h, k):
    c.rect(0, Y - h, 127, Y + h, k)


def branches(c, seed, n, keys, reach=26):
    r = rng(seed)
    for i in range(n):
        x = r.uniform(8, 120)
        up = -1 if i % 2 else 1
        c.bolt((x, Y), (x + r.uniform(-18, 18), Y + up * r.uniform(12, reach)), seed * 10 + i, keys, segs=4, jitter=4, widths=[3, 1][:len(keys)])


def draw(c, f):
    if f == 0:
        c.drect(0, Y - 20, 127, Y + 20, 'n0')
        c.bolt((120, Y - 30), (104, Y - 4), 1, ['y1', 'y3'], segs=4)
        c.spark(118, Y, 4, 'w', 'y2')
    elif f == 1:
        band(c, 18, 'n0')
        c.drect(0, Y - 26, 127, Y - 19, 'n0', 1)
        c.drect(0, Y + 19, 127, Y + 26, 'n0', 1)
        c.bolt((126, Y - 40), (116, Y), 2, ['y1', 'y2', 'w'], segs=5)
        c.ring(116, Y, 7, 'y2', 2)
        c.disc(116, Y, 3, 'w')
        specks(c, 116, Y, 10, 8, 18, 2, ['y2', 'y3'])
    elif f == 2:
        band(c, 18, 'n0')
        c.lens((127, Y), (48, Y), 5, ['y0', 'y1', 'y2', 'w'])
        c.bolt((127, Y), (48, Y), 3, ['y1', 'w'], segs=8, jitter=3, widths=[3, 1])
        c.spark(50, Y, 9, 'w', 'y2', diag=True)
    elif f == 3:
        band(c, 18, 'n0')
        c.lens((132, Y), (-4, Y), 9, ['y0', 'y1', 'y2', 'y3', 'w'])
        c.bolt((127, Y), (0, Y), 4, ['y2', 'w'], segs=12, jitter=4, widths=[3, 1])
        branches(c, 4, 8, ['y1', 'y3'])
        c.spark(4, Y, 12, 'w', 'y2', diag=True)
    elif f == 4:
        band(c, 22, 'n1')
        band(c, 16, 'n0')
        c.rect(0, Y - 7, 127, Y + 7, 'y2')
        c.rect(0, Y - 4, 127, Y + 4, 'y3')
        c.rect(0, Y - 2, 127, Y + 2, 'w')
        branches(c, 5, 12, ['y1', 'y3'], 32)
        for x in (20, 64, 108):
            c.spark(x, Y, 14, 'w', 'y3', diag=True)
    elif f == 5:
        band(c, 18, 'n0')
        c.rect(0, Y - 3, 127, Y + 3, 'y2')
        c.line([(0, Y), (127, Y)], 'w', 2)
        c.bolt((0, Y - 5), (127, Y - 7), 6, ['y1', 'y3'], segs=12, jitter=3, widths=[2, 1])
        c.bolt((0, Y + 5), (127, Y + 7), 7, ['y1', 'y3'], segs=12, jitter=3, widths=[2, 1])
        branches(c, 8, 9, ['y1', 'y2'], 30)
        c.line([(0, Y - 21), (127, Y - 21)], 'n3')
        c.line([(0, Y + 21), (127, Y + 21)], 'n3')
    elif f == 6:
        band(c, 14, 'n0')
        c.line([(0, Y), (127, Y)], 'y2', 3)
        c.line([(0, Y), (127, Y)], 'w')
        branches(c, 9, 6, ['y1', 'y3'], 22)
        specks(c, 64, Y, 22, 10, 60, 9, ['y2', 'y3'], sq=0.35, spark_every=5)
    elif f == 7:
        c.drect(0, Y - 12, 127, Y + 12, 'n0')
        c.line([(0, Y), (127, Y)], 'y1', 2)
        c.dline((0, Y), (127, Y), 'y3', phase=1)
        specks(c, 64, Y, 26, 14, 64, 10, ['y1', 'y2', 's2'], sq=0.4, spark_every=6)
    elif f == 8:
        c.dline((0, Y - 1), (127, Y - 1), 'y1')
        c.dline((0, Y + 1), (127, Y + 1), 'y0', phase=1)
        specks(c, 64, Y - 4, 22, 18, 64, 11, ['y1', 'y2', 'n3'], sq=0.45, spark_every=6, core='y3')
    else:
        specks(c, 64, Y - 8, 16, 20, 64, 12, ['y1', 'n3', 'n2'], sq=0.5, spark_every=5, core='y2')


if __name__ == '__main__':
    run(globals())

