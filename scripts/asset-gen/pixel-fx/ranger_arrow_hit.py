"""ranger_arrow_hit: 연사 착탄. Three quick arrow impacts stacked on the target, each with a pop and a green-gold ring.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'ranger_arrow_hit', 64, 6, 'target'
PAL = pal(pick(GOLD, 'y1', 'y2', 'y3'), pick(WOOD, 't1', 't2'), pick(STEEL, 's1', 's2'), pick(LEAF, 'l2', 'l3'), WHITE)
HITS = [(30, 28), (35, 38), (28, 44)]


def stuck(c, x, y, tilt):
    c.arrow(x, y, math.pi + tilt, 16, 't1', 's1', 'l3', hi='s2', head_len=4, head_w=2)


def draw(c, f):
    for i, (x, y) in enumerate(HITS):
        age = f - i * 1
        tilt = (i - 1) * 0.12
        if age < 0:
            continue
        if age == 0:
            stuck(c, x, y, tilt)
            c.rays(x, y, 8, 4, 11, 'y2', rot=0.4 + i)
            c.spark(x, y, 8, 'w', 'y3', diag=True)
            c.disc(x, y, 2, 'w')
        elif age == 1:
            stuck(c, x, y, tilt)
            c.ring(x, y, 8, 'y2', 2)
            c.ring(x, y, 6, 'y3', 1)
            c.rays(x, y, 6, 10, 13, 'l3', rot=i)
        elif age == 2:
            stuck(c, x, y, tilt)
            c.dring(x, y, 10, 'l2')
        elif f < 5:
            stuck(c, x, y, tilt)
    if f == 3:
        c.spark(32, 36, 10, 'w', 'y2')
    if f == 4:
        c.ring(32, 36, 16, 'y1', 1)
        c.dring(32, 36, 18, 'l2', 1)
    if f == 5:
        for i, (x, y) in enumerate(HITS):
            c.arrow(x - 1, y + 3 + i, math.pi + 0.35, 14, 't1', 's1', 'l3')
        c.dring(32, 36, 22, 'y1')


if __name__ == '__main__':
    run(globals())

