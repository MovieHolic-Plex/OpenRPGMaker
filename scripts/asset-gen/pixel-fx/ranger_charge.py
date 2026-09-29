"""ranger_charge: 강사 (시전자). Gold motes spiral into the drawn bow hand (left side of the ranger), a tightening ring and a flare.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'ranger_charge', 64, 6, 'user'
PAL = pal(GOLD, pick(LEAF, 'l2', 'l3'), WHITE)
HX, HY = 20, 32  # bow hand: allies face left
FEET = 56


def draw(c, f):
    t = f / 5
    # ground sigil pulse under the feet
    c.oval(32, FEET, 18 - f, 4, 'y1' if f % 2 else 'y0', 1)
    if f < 4:
        # motes spiral inward
        for i in range(10):
            a = i * 2 * math.pi / 10 + f * 0.7
            r = 28 * (1 - t) + 4
            x, y = pol(HX, HY, r, a, 0.8)
            tail = pol(HX, HY, r + 5, a - 0.25, 0.8)
            c.line([tail, (x, y)], 'l2' if i % 2 else 'y1')
            c.px(x, y, 'y3' if i % 2 else 'l3')
        c.ring(HX, HY, max(3, 16 - f * 4), 'y2', 1)
        c.disc(HX, HY, 1 + f, 'y2')
        c.disc(HX, HY, max(0.5, f - 0.5), 'w')
        for i in range(4):
            y = FEET - 2 - ((f * 6 + i * 11) % 34)
            x = 22 + i * 7
            c.line([(x, y), (x, y + 3)], 'y1')
    elif f == 4:
        c.rays(HX, HY, 12, 5, 16, 'y2', rot=0.1, jitter=[1, 0.7])
        c.spark(HX, HY, 14, 'w', 'y3', diag=True)
        c.disc(HX, HY, 5, 'y3')
        c.disc(HX, HY, 3, 'w')
        c.ring(HX, HY, 18, 'y1', 1)
    else:
        c.spark(HX, HY, 7, 'w', 'y3')
        c.ring(HX, HY, 8, 'y2', 1)
        c.dring(HX, HY, 13, 'y1')
        for i in range(6):
            x, y = pol(HX, HY, 12, i * math.pi / 3)
            c.px(x, y, 'y3')


if __name__ == '__main__':
    run(globals())

