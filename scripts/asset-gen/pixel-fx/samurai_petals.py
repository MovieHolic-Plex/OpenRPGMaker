"""samurai_petals: 벚꽃 난무 (화면). A sakura storm: petals and blossoms sweep in from the right on diagonal wind ribbons, crest into a pink gale, then float down and thin out.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'samurai_petals', 128, 8, 'screen'
PAL = pal(SAKURA, pick(INDIGO, 'n1', 'n2', 'n3'), WHITE)
R = rng(11)
# (x at f0, y, speed, size, spin, colour) — petals move left & down each frame
P = [(R.uniform(80, 200), R.uniform(-10, 118), R.uniform(16, 26), R.uniform(3, 6.5), R.uniform(0, 6), i % 3) for i in range(70)]
BLOOMS = [(150, 30, 9), (170, 78, 8), (200, 54, 10), (230, 20, 7), (240, 100, 9)]
DENS = [0.3, 0.6, 0.9, 1.0, 1.0, 0.8, 0.55, 0.3]


def ribbon(c, y0, f, k, ph):
    pts = []
    for i in range(17):
        x = 128 - i * 9 - f * 6
        pts.append((x, y0 + i * 2.2 + math.sin(i * 0.7 + ph + f) * 4))
    c.line(pts, k)


def draw(c, f):
    dens = DENS[f]
    for j, (y, k) in enumerate([(4, 'n2'), (30, 'n3'), (58, 'n2'), (84, 'n3')]):
        if dens > 0.5 or j % 2:
            ribbon(c, y, f, k if f < 6 else 'n1', j)
            if 2 <= f <= 4:
                ribbon(c, y + 3, f, 's1', j + 1)
    for i, (x, y, sp, s, spin, ci) in enumerate(P):
        if i / len(P) > dens:
            continue
        xx = x - sp * f * 1.25
        yy = y + f * (3 + s * 0.6) + math.sin(f * 0.9 + spin) * 3
        if f >= 5:
            yy += (f - 4) * 6
        if not (-6 < xx < 134):
            continue
        ss = s if f < 6 else s * 0.75
        body = ['s1', 's2', 's3'][ci]
        c.petal(xx, yy, spin + f * 0.8, ss, body, 's4' if ci != 2 else 'w', edge='s0' if ss >= 5 else None)
    for i, (x, y, r) in enumerate(BLOOMS):
        xx = x - 30 * f
        if -r < xx < 128 + r and f < 7:
            c.flower(xx, y + f * 4, r if f < 6 else r * 0.6, f * 0.5 + i, ('s1', 's2', 's4'), dots='s0')
    if f == 3:
        c.spark(64, 60, 10, 'w', 's3', diag=True)
        c.spark(28, 30, 5, 'w', 's4')
        c.spark(96, 92, 6, 'w', 's4')
    if f == 4:
        c.spark(40, 76, 7, 'w', 's3')
    if f >= 6:
        for i in range(10):
            c.px(8 + i * 12, 110 + (i * 7 + f) % 12, 's3')


if __name__ == '__main__':
    run(globals())

