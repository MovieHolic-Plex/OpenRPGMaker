"""mon_frost_orb: 얼음 구체 (투사체). A faceted ice orb flying left -> right (head on the right) with a spinning
frost ring and a trail of snow motes.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_18_35 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_frost_orb', 32, 4, 'projectile'
PAL = pal(ICE, WHITE)
OX, OY = 20, 16


def draw(c, f):
    # trail: tapered frost streak to the left
    c.poly([(OX - 3, OY - 4), (3, OY - 1 + (f % 2)), (3, OY + 1 + (f % 2)), (OX - 3, OY + 4)], 'i0')
    c.poly([(OX - 3, OY - 2), (8, OY + (f % 2)), (OX - 3, OY + 2)], 'i1')
    r = rng(f)
    for i in range(4):
        x = 4 + ((i * 6 + f * 3) % 14)
        y = OY + [-5, 5, -3, 4][(i + f) % 4]
        c.mote(x, y, 'i2' if i % 2 else 'i3')
    # orb
    c.disc(OX, OY, 6, 'i0')
    c.disc(OX, OY, 5, 'i1')
    c.disc(OX - 1, OY - 1, 3.5, 'i2')
    c.disc(OX - 2, OY - 2, 1.5, 'i3')
    c.rect(OX - 3, OY - 3, OX - 2, OY - 3, 'i4')
    # spinning facet ring
    a0 = f * math.pi / 4
    for i in range(3):
        a = a0 + i * 2 * math.pi / 3
        c.shard(*pol(OX, OY, 5, a), a, 4, 1.5, ['i1', 'i3', 'i4'])
    c.px(OX + 6, OY, 'w')
    c.spark(OX + 7 if f % 2 == 0 else OX + 5, OY - 5 if f % 2 == 0 else OY + 5, 2, 'w', 'i3')


if __name__ == '__main__':
    run(globals())
