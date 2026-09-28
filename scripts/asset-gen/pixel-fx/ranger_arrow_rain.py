"""ranger_arrow_rain: 화살비. A gold glint in the sky, volleys of arrows streaking down at a slant, ground impacts with dust, then a field of stuck arrows.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'ranger_arrow_rain', 64, 10, 'allTargets'
PAL = pal(pick(GOLD, 'y1', 'y2', 'y3'), WOOD, pick(STEEL, 's1', 's2'), pick(LEAF, 'l3'), pick(SMOKE, 'q1', 'q2', 'q3'), WHITE)
FEET = 56
ANG = math.pi / 2 + 0.35  # falling down and slightly left
LANDS = [(14, 0), (26, 1), (40, 0), (50, 2), (20, 3), (34, 2), (46, 4), (30, 4), (10, 5), (54, 5), (24, 6), (38, 6)]


def falling(c, x, y):
    c.arrow(x, y, ANG, 13, 't2', 's2', 'l3', head_len=4, head_w=2)
    ux, uy = math.cos(ANG), math.sin(ANG)
    c.line([(x - ux * 14, y - uy * 14), (x - ux * 22, y - uy * 22)], 'y2')


def stuck(c, x, lean=0.0):
    c.line([(x, FEET - 1), (x + 4 + lean, FEET - 11)], 't1')
    c.line([(x + 4 + lean, FEET - 11), (x + 6 + lean, FEET - 12)], 'l3')
    c.line([(x + 3 + lean, FEET - 11), (x + 4 + lean, FEET - 13)], 'l3')
    c.px(x, FEET, 't0')


def draw(c, f):
    if f == 0:
        c.spark(44, 6, 5, 'w', 'y3', diag=True)
        c.ring(44, 6, 3, 'y2', 1)
        for i, x in enumerate((30, 40, 50, 58)):
            c.px(x, 2 + i % 2, 'y2')
        return
    ux, uy = math.cos(ANG), math.sin(ANG)
    for i, (x, t) in enumerate(LANDS):
        age = f - 1 - t
        if age < -2:
            continue
        if age < 0:
            # airborne: position along the fall line above the landing spot
            d = -age * 18
            falling(c, x - ux * d, FEET - 1 - uy * d)
        elif age == 0:
            stuck(c, x)
            c.spark(x, FEET - 2, 4, 'w', 'y3')
            c.line([(x - 5, FEET), (x + 5, FEET)], 'q2')
        elif age == 1:
            stuck(c, x)
            c.cloud(x + 1, FEET - 3, 4, ['q1', 'q2', 'q3'], seed=i, lobes=4)
        elif age == 2:
            stuck(c, x)
            c.ddisc(x + 1, FEET - 4, 5, 'q2', parity=i)
        elif f <= 8:
            stuck(c, x, -0.5 if i % 2 else 0.5)
    if 3 <= f <= 7:
        c.dring(32, FEET, 26, 'y1', parity=f, squash=0.18)
    if f == 9:
        for i, (x, t) in enumerate(LANDS[::2]):
            c.spark(x + 3, FEET - 10, 1, 'y3')
        c.ddisc(32, FEET - 1, 24, 'q1', squash=0.12)


if __name__ == '__main__':
    run(globals())

