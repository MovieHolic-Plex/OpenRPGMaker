"""monk_chi_orb: 기공파 탄. A blue chi sphere with a spinning gold ring, head LEFT, flickering comet tail.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'monk_chi_orb', 32, 4, 'projectile'
PAL = pal(CHI, pick(MONK, 'o2', 'y2', 'y3'), WHITE)
X, Y = 10, 16


def draw(c, f):
    # tail: three tapering streaks that shuffle every frame
    for i, (dy, L) in enumerate(((-3, 14), (0, 20), (3, 13))):
        L2 = L + ((f + i) % 3) * 2 - 2
        c.line([(X + 4, Y + dy), (X + L2, Y + dy * 0.6)], 'c0', 3 if dy == 0 else 1)
        c.line([(X + 4, Y + dy), (X + L2 - 5, Y + dy * 0.6)], 'c1' if dy else 'c2', 1)
    for j in range(3):
        x = X + 8 + ((f * 5 + j * 7) % 16)
        y = Y + ((j * 5 + f * 3) % 9) - 4
        c.px(x, y, 'c3' if j % 2 else 'y2')
    c.disc(X, Y, 7, 'c0')
    c.disc(X, Y, 6, 'c1')
    c.disc(X - 1, Y - 1, 4, 'c2')
    c.disc(X - 1, Y - 1, 2, 'c3')
    c.px(X - 2, Y - 2, 'w')
    # gold ring spinning around the orb (squashed ellipse, front half over the orb)
    a0 = f * 90
    c.arc(X, Y, 9, a0, a0 + 150, 'y2', 1, squash=0.45)
    c.arc(X, Y, 9, a0 + 180, a0 + 300, 'o2', 1, squash=0.45)
    sx, sy = pol(X, Y, 9, math.radians(a0 + 150), 0.45)
    c.spark(sx, sy, 2, 'w', 'y3')


if __name__ == '__main__':
    run(globals())

