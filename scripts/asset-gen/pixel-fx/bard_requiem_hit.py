"""bard_requiem_hit: 레퀴엠 착탄. A ghostly violet bell-shaped soul rises from the enemy, a toll ring
spreads, violet flames lick the silhouette and the soul fragments into notes and motes.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'bard_requiem_hit', 64, 8, 'allTargets'
PAL = pal(SOUL, pick(RAINBOW, 'n0', 'rv'), pick(DREAM, 'b3'), WHITE)
CX, CY, FEET = 32, 34, 56


def soul(c, y, s, keys):
    c.disc(CX, y, 5 * s, keys[0])
    c.poly([(CX - 5 * s, y), (CX + 5 * s, y), (CX + 6 * s, y + 8 * s), (CX + 2 * s, y + 6 * s), (CX, y + 9 * s),
            (CX - 2 * s, y + 6 * s), (CX - 6 * s, y + 8 * s)], keys[0])
    c.disc(CX - s, y - s, 3.5 * s, keys[1])
    c.px(CX - 2 * s, y - s, 'v0')
    c.px(CX + 2 * s, y - s, 'v0')


def draw(c, f):
    if f == 0:
        c.oval(CX, FEET, 14, 3, 'v1')
        c.oval(CX, FEET, 9, 2, 'v2')
        converge(c, CX, CY, 0.5, 10, 2, ['v2', 'v4'], r0=24, r1=6)
        return
    if f <= 5:
        for i in range(5):
            x = CX - 12 + i * 6
            flame_tongue(c, x, FEET, (10 + (i * 7 + f * 5) % 9) * (1 if f < 5 else 0.5), 3, ['v1', 'v2', 'v3'], seed=i + f, lean=0.2 * math.sin(f + i))
    if 1 <= f <= 5:
        y = 38 - f * 5
        s = 1.0 + 0.15 * f
        soul(c, y, s, ['v2', 'v4'])
    if f == 2:
        c.ring(CX, CY, 14, 'v3', 2)
        c.spark(CX, 20, 8, 'w', 'v4', diag=True)
    if f == 3:
        c.ring(CX, CY, 21, 'v2', 2)
        c.ring(CX, CY, 20, 'v4', 1)
    if f == 4:
        c.dring(CX, CY, 27, 'v3')
        c.rays(CX, 18, 10, 10, 20, 'v4', rot=0.2)
    if f >= 5:
        burst(c, CX, 14, (f - 4) / 3.5, 14, 5, ['w', 'v4', 'v3', 'v2'], spd=(10, 24), up=0.3)
        r = rng(9)
        for i in range(4):
            a = i * math.pi / 2 + 0.5
            x, y = pol(CX, 14, 6 + (f - 5) * 7, a)
            note(c, x, y - (f - 5) * 2, 'v3' if i % 2 else 'b3', 4, s=0.8, ol='v0')
    if f == 7:
        c.dring(CX, FEET, 16, 'v1', squash=0.2)


if __name__ == '__main__':
    run(globals())

