"""bard_tempo: 질주곡. A metronome pendulum ticks fast over the ally, green/cyan speed streaks sweep past,
double eighth notes race around in a tight orbit, then a burst of speed chevrons.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'bard_tempo', 64, 8, 'allAllies'
PAL = pal(pick(RAINBOW, 'n0', 'rg', 'rb', 'ry'), pick(CHI, 'c2', 'c3'), WHITE, g0='#16402a', g1='#2a8a48')
CX, CY, FEET = 32, 34, 56


def metronome(c, ang):
    bx, by = CX, 22
    c.poly([(bx - 6, by), (bx + 6, by), (bx + 3, by - 12), (bx - 3, by - 12)], 'n0')
    c.poly([(bx - 5, by - 1), (bx + 5, by - 1), (bx + 2, by - 11), (bx - 2, by - 11)], 'g1')
    c.line([(bx - 3, by - 3), (bx + 3, by - 3)], 'ry')
    tx, ty = bx + math.sin(ang) * 11, by - 2 - math.cos(ang) * 11
    c.line([(bx, by - 2), (tx, ty)], 'n0', 3)
    c.line([(bx, by - 2), (tx, ty)], 'c3', 1)
    c.disc(tx, ty, 2, 'ry')
    c.px(tx, ty, 'w')


def streaks(c, f, n, keys):
    r = rng(5)
    for i in range(n):
        y = r.uniform(8, FEET)
        x0 = 64 - ((f * 22 + r.uniform(0, 64)) % 90)
        L = r.uniform(8, 18)
        c.line([(x0, y), (x0 + L, y)], keys[i % len(keys)])
        c.px(x0, y, 'w')


def draw(c, f):
    streaks(c, f, 10 + f, ['g1', 'rg', 'c2'])
    if f <= 5:
        metronome(c, (1 if f % 2 else -1) * (0.3 + 0.1 * f))
        if f % 2:
            c.spark(CX + (1 if f % 2 else -1) * 8, 8, 3, 'w', 'ry')
    if f >= 1:
        for j in range(4):
            a = f * 1.3 + j * math.pi / 2
            x, y = pol(CX, 38, 20, a, 0.4)
            tx, ty = pol(CX, 38, 20, a - 0.6, 0.4)
            c.arc(CX, 38, 20, math.degrees(a - 0.6), math.degrees(a), 'rg', 2, squash=0.4)
            note(c, x, y - 2, ['rg', 'rb', 'ry', 'c3'][j], 2 if j % 2 == 0 else 16, s=0.8)
    if 3 <= f <= 7:
        for j in range(3):
            y = FEET - 6 - j * 8 - (f - 3) * 3
            chevron(c, CX - 12 - j * 2, y, 3, 'c3', ol='g0', up=True)
            chevron(c, CX + 12 + j * 2, y, 3, 'rg', ol='g0', up=True)
    if f == 4:
        c.oval(CX, FEET, 20, 3, 'g0')
        c.oval(CX, FEET, 14, 2, 'rg')
        c.rays(CX, 38, 12, 22, 30, 'c3', rot=0.2, squash=0.5)
    if f >= 6:
        c.dring(CX, 38, 26, 'g1', squash=0.4, parity=f)


if __name__ == '__main__':
    run(globals())

