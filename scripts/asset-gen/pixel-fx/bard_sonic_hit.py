"""bard_sonic_hit: 소닉 붐 착탄. The wave hits, expanding concentric sound rings with a violet/pink
rainbow shimmer, a speaker-shaped pulse and shaken notes flung out.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'bard_sonic_hit', 64, 8, 'target'
PAL = pal(RAINBOW, pick(SOUL, 'v2', 'v3'), WHITE)
CX, CY = 32, 34


def draw(c, f):
    if f == 0:
        for i in range(3):
            c.arc(CX + 14 + i * 5, CY, 10 - i * 2, 130, 230, 'rp' if i == 0 else 'rv', 2)
        c.spark(CX + 6, CY, 4, 'w', 'rp')
        return
    t = f / 7
    # expanding rings, oldest outermost, dithered as they fade
    for j in range(3):
        age = f - 1 - j * 1.5
        if age < 0:
            continue
        r = 6 + age * 5
        k = HUES[(j * 2 + f) % 6]
        if age > 4:
            c.dring(CX, CY, r, k, parity=j)
        else:
            c.ring(CX, CY, r, 'n0', 3)
            c.ring(CX, CY, r, k, 1)
    if f <= 3:
        c.disc(CX, CY, 7 - f, 'rv')
        c.disc(CX, CY, 5 - f, 'rp')
        c.disc(CX, CY, max(1, 3 - f), 'w')
        c.rays(CX, CY, 8, 9, 14 + f * 2, 'w', rot=f * 0.3)
    # flung notes
    r = rng(3)
    for i in range(6):
        a = i * math.pi / 3 + 0.4
        d = 8 + ease(t) * 20
        x, y = pol(CX, CY, d, a)
        if f >= 2 and f <= 6:
            note(c, x, y + (f - 2) * 1.5, HUES[i], 8 if i % 2 else 4, s=0.9)
    if f == 7:
        for i in range(8):
            x, y = pol(CX, CY, 28, i * math.pi / 4)
            c.px(x, y, 'v3')


if __name__ == '__main__':
    run(globals())

