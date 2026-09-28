"""scout_afterimage: 잔상 회피. Hollow scan-line afterimages of the scout slide out to both sides behind speed lines and a flash ring.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'scout_afterimage', 64, 8, 'user'
PAL = pal(pick(SHADOW, 'd', 'm', 'v', 'l'), pick(FROST, 'i2', 'i3'), WHITE)
FEET = 56


def ghost(c, x, edge, fill, f, dither=False):
    """Scout silhouette (head, cloak, legs) drawn as an outline with scan-line fill."""
    m = Cel(c.n, {'a': '#ffffff'})
    m.disc(x, FEET - 30, 4, 'a')
    m.poly([(x - 6, FEET - 25), (x + 5, FEET - 25), (x + 7, FEET - 12), (x - 7, FEET - 12)], 'a')
    m.line([(x - 3, FEET - 12), (x - 5, FEET)], 'a', 3)
    m.line([(x + 2, FEET - 12), (x + 4, FEET)], 'a', 3)
    m.line([(x - 6, FEET - 23), (x - 10, FEET - 16)], 'a', 2)
    m.line([(x + 5, FEET - 23), (x + 9, FEET - 18)], 'a', 2)
    a = m.im.getchannel('A').load()
    n = c.n
    for yy in range(n):
        for xx in range(n):
            if not a[xx, yy]:
                continue
            edge_px = any(not (0 <= xx + dx < n and 0 <= yy + dy < n and a[xx + dx, yy + dy])
                          for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge_px:
                if not dither or (xx + yy + f) % 2 == 0:
                    c.px(xx, yy, edge)
            elif fill and (yy + f) % 2 == 0 and not dither:
                c.px(xx, yy, fill)


def speed(c, f, xs):
    for i, y in enumerate((24, 30, 36, 42, 48)):
        x = xs[i % len(xs)] + (f * 3) % 5
        c.line([(x, y), (x + 5 + i % 3, y)], 'l' if i % 2 else 'i3')


def draw(c, f):
    if f == 0:
        speed(c, f, (6, 12, 4, 10, 8))
        for i, y in enumerate((26, 34, 44)):
            c.line([(50 + i * 2, y), (58, y)], 'l')
        c.oval(32, FEET, 12, 3, 'v', 1)
    elif f == 1:
        ghost(c, 22, 'i3', 'i2', f)
        speed(c, f, (4, 8, 2))
        c.spark(32, 22, 3, 'w', 'l')
    elif f == 2:
        ghost(c, 19, 'i3', 'i2', f)
        ghost(c, 45, 'v', 'm', f)
        speed(c, f, (2, 6, 4))
    elif f == 3:
        ghost(c, 14, 'i3', 'i2', f)
        ghost(c, 49, 'v', 'm', f)
        ghost(c, 25, 'v', None, f)
    elif f == 4:
        ghost(c, 11, 'i2', 'd', f)
        ghost(c, 53, 'm', 'd', f)
        c.oval(32, 38, 19, 24, 'l', 1)
        for x, y in [(32, 12), (13, 38), (51, 38), (32, 62)]:
            c.spark(x, y, 3, 'w', 'l')
    elif f == 5:
        ghost(c, 9, 'i2', None, f, dither=True)
        ghost(c, 55, 'm', None, f, dither=True)
        c.dring(32, 38, 22, 'l', squash=1.25)
    elif f == 6:
        c.arc(32, 38, 20, 200, 330, 'i3', 1, squash=1.3)
        c.arc(32, 40, 16, 20, 150, 'i2', 1, squash=1.3)
        c.dring(32, 38, 26, 'v', squash=1.2)
        c.spark(14, 26, 2, 'w', 'i3')
        c.spark(50, 48, 2, 'w', 'l')
    elif f == 7:
        for x, y in [(12, 20), (52, 30), (20, 52), (46, 14)]:
            c.spark(x, y, 1, 'l')
        c.arc(32, 38, 23, 250, 300, 'i2', 1, squash=1.3)


if __name__ == '__main__':
    run(globals())

