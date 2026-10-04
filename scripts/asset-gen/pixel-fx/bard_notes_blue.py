"""bard_notes_blue: 자장가. Soft blue notes drift down over the enemy in a slow sway, a crescent moon glows,
the target's eyes 'close' as Z glyphs float up, and a dreamy dithered cloud settles.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'bard_notes_blue', 64, 10, 'allTargets'
PAL = pal(DREAM, pick(RAINBOW, 'n0', 'rb', 'rv'), pick(SOUL, 'v4'), WHITE)
CX, CY, FEET = 32, 34, 56
NOTES = [(0, 14, 4, 8, 'b2'), (0, 44, 0, 4, 'b3'), (1, 28, 2, 16, 'rb'), (2, 50, 6, 8, 'b2'),
         (2, 10, 8, 2, 'rv'), (3, 36, 0, 8, 'b3'), (4, 20, 4, 4, 'rb')]


def moon(c, x, y, r):
    c.dring(x, y, r + 3, 'b1')
    c.disc(x, y, r, 'b3')
    c.disc(x - 1, y - 1, r - 1, 'v4')
    c.disc(x + r * 0.55, y - r * 0.35, r - 1, 'b0')


def draw(c, f):
    if f <= 7:
        moon(c, 50, 11, 5 if f else 3)
    for (sf, x, y0, kind, k) in NOTES:
        age = f - sf
        if age < 0 or age > 5:
            continue
        y = y0 + age * 6
        xx = x + math.sin(age * 1.1 + sf) * 4
        if age == 5:
            c.dring(xx, y, 3, k)
        else:
            note(c, xx, y, k, kind, ol='b0')
    if 3 <= f <= 8:
        a = f - 3
        c.cloud(CX, 20 + a * 0.5, 8 + a * 1.6, ['b0', 'b1', 'b2', 'b3'], seed=4, lobes=8, parity=f)
        # closed-eye arcs on the cloud face
        c.arc(CX - 5, 20 + a * 0.5, 2, 20, 160, 'v4')
        c.arc(CX + 5, 20 + a * 0.5, 2, 20, 160, 'v4')
    if f >= 4:
        for j in range(3):
            age = f - 4 - j
            if 0 <= age <= 4:
                zglyph(c, CX + 10 + j * 4 + age * 2, 30 - age * 6 - j * 2, 1 + (j == 1) + (age > 1), 'b3' if j % 2 else 'v4', ol='b0')
    if f >= 8:
        c.ddisc(CX, FEET - 4, 16, 'b1', parity=f, squash=0.3)
        r = rng(f)
        for i in range(6):
            c.px(r.uniform(10, 54), r.uniform(10, 40), 'b3')
    if f == 9:
        zglyph(c, CX + 20, 6, 2, 'b2', ol='b0')


if __name__ == '__main__':
    run(globals())

