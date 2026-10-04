"""mon_shell_barrier: 단단해지기 (시전자). Amber plates snap together into a hexagonal shell dome around the monster, glint once and settle into a faint armoured sheen.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_0_17 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_shell_barrier', 64, 8, 'user'
PAL = pal(SHELL, pick(DIRT, 'd1'), WHITE)
R = 25


def cells(c, n, k, hi=None, r=R):
    """Honeycomb plates inside the dome, first n plates only (centre outward)."""
    order = []
    for q in range(-3, 4):
        for s in range(-3, 4):
            x = UX + (q + s * 0.5) * 8.2
            y = UY + s * 7.1
            if math.hypot(x - UX, (y - UY) / 0.95) <= r - 4:
                order.append((math.hypot(x - UX, y - UY), x, y))
    order.sort()
    for i, (_, x, y) in enumerate(order[:n]):
        hexagon(c, x, y, 4.6, k)
        if hi and x < UX and y < UY:
            c.px(x - 2, y - 2, hi)
    return len(order)


def draw(c, f):
    if f == 0:
        for i in range(6):
            a = i * math.pi / 3 + 0.3
            x, y = pol(UX, UY, 28, a)
            c.diamond(x, y, 3, 4, 'h2')
            c.px(x - 1, y - 2, 'h4')
    elif f == 1:
        for i in range(6):
            a = i * math.pi / 3 + 0.5
            x, y = pol(UX, UY, 22, a)
            hexagon(c, x, y, 5, 'h2')
            c.disc(x, y, 1.5, 'h3')
        c.ring(UX, UY, R, 'h1', 1)
    elif f == 2:
        c.ring(UX, UY, R + 1, 'h0', 1)
        c.ring(UX, UY, R, 'h2', 2)
        cells(c, 12, 'h2', 'h4')
    elif f == 3:                                           # sealed dome, full glint
        c.ring(UX, UY, R + 1, 'h0', 1)
        c.ring(UX, UY, R, 'h3', 2)
        cells(c, 99, 'h2', 'h4')
        c.arc(UX, UY, R - 3, 190, 260, 'w', 2)
        c.spark(UX - 14, UY - 16, 5, 'w', 'h4', diag=True)
        c.spark(UX + 17, UY + 12, 3, 'w', 'h4')
    elif f == 4:
        c.ring(UX, UY, R, 'h2', 1)
        cells(c, 99, 'h1')
        c.arc(UX, UY, R - 3, 200, 250, 'h4', 1)
        c.spark(UX + 12, UY - 18, 3, 'w', 'h3')
    elif f == 5:
        c.dring(UX, UY, R, 'h2')
        cells(c, 7, 'h1', 'h3')
        c.ring(UX, 58, 18, 'h1', 1, squash=0.2)
    elif f == 6:
        c.dring(UX, UY, R - 2, 'h1', parity=1)
        for a in (-2.4, -1.0, 0.4, 1.8, 3.0):
            x, y = pol(UX, UY, 20, a)
            c.px(x, y, 'h3')
            c.px(x, y + 1, 'h1')
    else:
        chevron(c, UX, 12, 3, 'h3', 'h4')
        specks(c, UX, UY, 8, 16, 26, 7, ['h2', 'h4'])


if __name__ == '__main__':
    run(globals())

