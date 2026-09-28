"""mon_acid_blob: 산성 침 (투사체). A wobbling acid glob flying left -> right, head facing right, dripping a yellow-green and violet trail.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_0_17 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_acid_blob', 32, 4, 'projectile'
PAL = pal(ACID, pick(TOXV, 'u1', 'u2', 'u3'), WHITE)


def draw(c, f):
    wob = [0, 1, 0, -1][f]
    r = rng(10 + f)
    for i in range(6):                                   # drip trail, older drops smaller and further left
        x = 2 + i * 2.6 + r.uniform(-0.6, 0.6)
        y = 16 + r.uniform(-3.5, 3.5) + (wob if i % 2 else -wob)
        c.disc(x, y, 0.5 + i * 0.22, 'u2' if i % 3 == 1 else 'a2')
    c.poly([(7, 16 - wob * 0.5), (20, 10 + (f % 2)), (20, 22 - (f % 2))], 'a1')
    c.poly([(11, 16 - wob * 0.5), (20, 12), (20, 20)], 'a2')
    rx, ry = (8, 6) if f % 2 == 0 else (7, 7)            # squash and stretch
    c.oval(21, 16, rx + 1, ry + 1, 'a0')
    c.oval(21, 16, rx, ry, 'a2')
    c.oval(20, 15, rx - 2, ry - 2, 'a3')
    c.line([(24, 20 - (f % 2)), (27, 17)], 'a1')         # shaded underside, light from the top left
    c.disc(18, 13, 1.5, 'a4')
    c.px(17, 12, 'w')
    bx, by = [(23, 17), (22, 18), (24, 16), (21, 17)][f]  # violet bubble drifting inside the glob
    c.ring(bx, by, 1.5, 'u2')
    c.px(bx, by, 'u3')
    c.px(19 + f, 20, 'u1')


if __name__ == '__main__':
    run(globals())

