"""bard_hymn: 치유의 찬가. A glowing golden staff ring circles the ally, soft rainbow notes ride it,
a gentle column of warm light and rising heart-shaped motes heal.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'bard_hymn', 64, 10, 'allAllies'
PAL = pal(pick(RAINBOW, 'n0', 'rg', 'rp', 'ry'), pick(MONK, 'o0', 'y1', 'y2', 'y3'), pick(CHI, 'c3'), WHITE)
CX, CY, FEET = 32, 36, 56


def ring_staff(c, y, r, phase, keys, span=1.0):
    for i, k in enumerate(keys):
        c.arc(CX, y + i * 2 - 2, r, phase, phase + 360 * span, k, 1, squash=0.32)


def draw(c, f):
    t = f / 9
    if f <= 7:
        span = min(1.0, (f + 1) / 3)
        y = FEET - 4 - f * 3
        ring_staff(c, y, 22, f * 40, ['y1', 'y2', 'y1'], span)
        for j in range(4):
            a = math.radians(f * 40 + j * 90)
            if j / 4 > span:
                continue
            x, yy = pol(CX, y, 22, a, 0.32)
            note(c, x, yy - 2, ['rg', 'rp', 'ry', 'c3'][j], 8 if j % 2 else 4, s=0.9)
    if 2 <= f <= 7:
        w = 10 if f in (3, 4, 5) else 6
        c.poly([(CX - w, FEET), (CX - w + 3, 6), (CX + w - 3, 6), (CX + w, FEET)], 'y1')
        c.poly([(CX - w + 4, FEET), (CX - 2, 6), (CX + 2, 6), (CX + w - 4, FEET)], 'y3')
        c.oval(CX, FEET, w + 6, 2, 'o0')
    r = rng(1)
    for i in range(9):
        x = CX + r.uniform(-20, 20)
        y0 = FEET - r.uniform(0, 10)
        age = f - 2 - (i % 3)
        if age < 0:
            continue
        y = y0 - age * 6
        if y < 4:
            continue
        if i % 3 == 0:
            heart(c, x, y, 2, 'rp', ol='n0')
        else:
            c.spark(x, y, 2 if i % 2 else 1, 'w', 'rg')
    if f >= 8:
        c.dring(CX, FEET - 6 - f, 24, 'y1', squash=0.32, parity=f)
        c.spark(CX, 12, 3, 'w', 'y2')


if __name__ == '__main__':
    run(globals())

