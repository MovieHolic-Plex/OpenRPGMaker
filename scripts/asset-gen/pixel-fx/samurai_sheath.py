"""samurai_sheath: 발도술 (시전자). The blade slides home along the scabbard: glint travels to the guard, a hard 'chin' star, a ground ring and wind ribbons.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'samurai_sheath', 64, 6, 'user'
PAL = pal(INDIGO, pick(SAKURA, 's1', 's2', 's3'), WHITE)
Y = 41            # waist line
GUARD = (27, 40)  # hilt/guard point (actor faces left)


def scabbard(c, x0, k='n3'):
    c.line([(GUARD[0] + 2, Y), (x0, Y + 3)], k)


def draw(c, f):
    if f == 0:
        c.lens((52, Y + 3), (28, Y), 2.5, ['n2', 'n4', 'w'])
        c.spark(47, Y + 2, 3, 'w', 'n4')
        for i in range(4):
            c.line([(50 + i * 2, 26 + i * 7), (60, 25 + i * 7)], 'n2')
    elif f == 1:
        c.lens((50, Y + 3), (GUARD[0] + 1, Y), 1.5, ['n3', 'w'])
        c.spark(GUARD[0] + 2, Y, 6, 'w', 'n4', diag=True)
        c.ring(GUARD[0], Y, 5, 'n3')
    elif f == 2:
        c.ring(GUARD[0], Y, 10, 'n2', 2)
        c.ring(GUARD[0], Y, 10, 'n4', 1)
        c.disc(GUARD[0], Y, 4, 'w')
        c.spark(GUARD[0], Y, 13, 'w', 'n4', diag=True)
        c.ring(32, FEET, 12, 'n3', 2, squash=0.3)
        c.ring(32, FEET, 12, 'n4', 1, squash=0.3)
    elif f == 3:
        c.dring(GUARD[0], Y, 15, 'n3')
        c.ring(32, FEET, 22, 'n2', 2, squash=0.28)
        c.ring(32, FEET, 22, 'n4', 1, squash=0.28)
        c.brush(32, 36, 20, 200, 330, 0.5, 1.5, 'n3', squash=0.45)
        c.brush(32, 30, 17, 20, 150, 0.5, 1.5, 'n4', squash=0.45)
        burst_petals(c, 32, 34, 6, 20, 3, L=4)
        c.spark(GUARD[0], Y, 4, 'w', 'n4')
    elif f == 4:
        c.dring(32, FEET, 28, 'n3', squash=0.26)
        c.brush(32, 28, 24, 210, 320, 0.5, 1, 'n2', squash=0.45)
        c.brush(32, 22, 20, 30, 140, 0.5, 1, 'n3', squash=0.45)
        burst_petals(c, 32, 30, 8, 24, 4, drop=4, L=4)
        specks(c, 32, 34, 5, 8, 20, 4, ['n4', 'w'], spark_every=3)
    else:
        c.dring(32, FEET, 31, 'n1', parity=1, squash=0.25)
        burst_petals(c, 32, 26, 7, 26, 5, drop=10, L=3, keys=('s1', 's2'))
        specks(c, 32, 30, 6, 10, 24, 5, ['n3', 'n2'], spark_every=3, core='n4')


if __name__ == '__main__':
    run(globals())

