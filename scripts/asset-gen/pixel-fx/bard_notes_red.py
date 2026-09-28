"""bard_notes_red: 전투의 노래. A warm staff ribbon unrolls around the ally, red/orange/gold notes pop off it
and climb with a bounce, an up-chevron pulses for the attack buff, then the notes twinkle out.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'bard_notes_red', 64, 10, 'allAllies'
PAL = pal(pick(RAINBOW, 'n0', 'rr', 'ro', 'ry', 'rp'), pick(MONK, 'o0', 'y3'), WHITE)
CX, CY, FEET = 32, 36, 56
# (spawn frame, x, start y, kind, colour)
NOTES = [(1, 14, 44, 8, 'rr'), (2, 46, 40, 16, 'ro'), (2, 26, 48, 4, 'ry'), (3, 38, 46, 2, 'rr'),
         (4, 18, 42, 16, 'ry'), (4, 50, 48, 8, 'rr'), (5, 30, 44, 8, 'ro')]


def ribbon(c, f, x1):
    staff(c, 4, x1, 48, 2, 3, 0.22, f * 0.9, ['o0', 'rr', 'o0', 'ro', 'o0'], lines=3)


def draw(c, f):
    if f < 7:
        ribbon(c, f, lerp(12, 60, min(1, (f + 1) / 3)))
    for (sf, x, y0, kind, k) in NOTES:
        age = f - sf
        if age < 0 or age > 4:
            continue
        y = y0 - age * 7 - abs(math.sin(age * 1.6)) * 3
        xx = x + math.sin(age * 1.4 + x) * 2
        if age == 4:
            c.spark(xx, y, 2, 'w', k)
        else:
            note(c, xx, y, k, kind, s=1.0 if age else 0.8)
    if 3 <= f <= 7:
        up = (f - 3) * 4
        chevron(c, CX, 26 - up, 6, 'ry', ol='rr')
        chevron(c, CX, 34 - up, 5, 'ro', ol='n0')
    if f == 5:
        c.rays(CX, CY, 12, 18, 26, 'rp', rot=0.2)
    if f >= 7:
        r = rng(f)
        for i in range(10):
            x, y = r.uniform(8, 56), r.uniform(4, 40) - (f - 7) * 4
            c.spark(x, y, 1 + (i % 3 == 0), 'y3', 'rp' if i % 2 else 'ro')
        if f == 7:
            c.oval(CX, FEET, 16, 3, 'o0')
            c.oval(CX, FEET, 12, 2, 'rr')


if __name__ == '__main__':
    run(globals())

