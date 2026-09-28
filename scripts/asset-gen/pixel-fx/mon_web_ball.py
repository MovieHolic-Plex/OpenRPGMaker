"""mon_web_ball: 거미줄 (투사체). A spinning silk wad flying left -> right with loose threads trailing behind.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_0_17 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_web_ball', 32, 4, 'projectile'
PAL = pal(SILK, pick(TOXV, 'u2', 'u3'), WHITE)
BX, BY = 21, 16


def draw(c, f):
    for i, (dy, k) in enumerate(((-3, 'k1'), (0, 'k2'), (3, 'k1'))):   # trailing threads, waving
        pts = [(BX - 5, BY + dy * 0.4)]
        for j in range(1, 6):
            x = BX - 5 - j * 3.2
            y = BY + dy + math.sin(j * 1.3 + f * 1.6 + i) * 1.6
            pts.append((x, y))
        c.line(pts, k)
    c.disc(BX, BY, 7, 'k0')
    c.disc(BX, BY, 6, 'k1')
    c.disc(BX - 1, BY - 1, 4, 'k2')
    rot = f * math.pi / 8
    for i in range(3):                                   # wound silk strands rotate
        a = rot + i * math.pi / 3
        c.line([pol(BX, BY, 6, a), pol(BX, BY, 6, a + math.pi)], 'k3')
    c.brush(BX, BY, 3, f * 45, f * 45 + 240, 0.5, 0.5, 'k3')
    c.px(BX - 3, BY - 3, 'w')
    c.px(BX - 2, BY - 4, 'w')
    c.px(BX + 3, BY + 3, 'u2')
    c.px(BX + 5, BY - 1 + (f % 2), 'u3')                  # sticky gleam at the front


if __name__ == '__main__':
    run(globals())

