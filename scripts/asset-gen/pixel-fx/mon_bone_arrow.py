"""mon_bone_arrow: 뼈화살 난사 (투사체). A volley of three bone arrows flying left -> right, heads facing right, with a violet grave-light trail.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_0_17 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_bone_arrow', 32, 4, 'projectile'
PAL = pal(BONE, pick(DUSK, 'v1', 'v2', 'v3', 'v4'), WHITE)


def arrow(c, x, y, trail, glint):
    """Tip at (x, y) pointing right."""
    c.line([(x - 12 - trail, y), (x - 13, y)], 'v2')
    c.line([(x - 12 - trail // 2, y), (x - 13, y)], 'v3')
    c.line([(x - 12, y), (x - 4, y)], 'b2')
    c.px(x - 8, y - 1, 'b3')
    c.px(x - 8, y + 1, 'b1')
    for j in range(2):                                    # rib-bone fletching
        fx = x - 11 + j * 2
        c.px(fx - 1, y - 2, 'b2')
        c.px(fx - 1, y + 2, 'b1')
    c.poly([(x, y), (x - 5, y - 2), (x - 4, y), (x - 5, y + 2)], 'b3')
    c.px(x - 3, y - 1, 'w')
    if glint:
        c.spark(x, y, 2, 'w', 'v4')


def draw(c, f):
    jit = [(0, 0, 0), (-1, 0, 1), (0, -1, 0), (1, 0, -1)][f]
    arrow(c, 28 + jit[0], 9, 5 + 2 * (f % 2), f == 0)
    arrow(c, 23 + jit[1], 16, 4 + 2 * ((f + 1) % 2), f in (1, 3))
    arrow(c, 29 + jit[2], 23, 6 - (f % 2) * 2, f == 2)


if __name__ == '__main__':
    run(globals())

