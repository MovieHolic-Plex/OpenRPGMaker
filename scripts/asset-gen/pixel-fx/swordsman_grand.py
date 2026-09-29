"""swordsman_grand: 천상 연참: 밤하늘 같은 무대에 수십 갈래 청백 검광이 그물처럼 교차하고 별빛이 흩어진다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'swordsman_grand', 128, 12, 'screen'
PAL = pal(pick(ICEB, 'i0', 'i1', 'i2', 'i3', 'i4'), pick(PURP, 'v0', 'v1'), pick(GOLDY, 'y3'), WHITE)


def draw(c, f):
    lvl = [.3, .55, .8, 1, 1, 1, 1, 1, 1, 1, .7, .4][f]
    shade(c, 64, 68, 50 * lvl + 14, 'v0', squash=.8)
    r = rng(5)
    lines = []
    for i in range(16):
        a = r.uniform(-.6, .6) + (math.pi / 2 if i % 2 else 0) + (i % 4) * .35
        cx_, cy_ = r.uniform(30, 98), r.uniform(46, 90)
        L = r.uniform(34, 62)
        lines.append(((cx_ - math.cos(a) * L, cy_ - math.sin(a) * L * .7), (cx_ + math.cos(a) * L, cy_ + math.sin(a) * L * .7)))
    for i, (p0, p1) in enumerate(lines):
        age = f - i * .55
        if age < 0 or age > 6:
            continue
        if age < 1:
            c.lens(p0, p1, 5, ['i0', 'i2', 'i4', 'w'], frac=.7)
        elif age < 2.2:
            c.lens(p0, p1, 6, ['i0', 'i2', 'i4', 'w'])
            mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
            c.spark(mx, my, 5, 'w', 'y3', diag=True)
        elif age < 4:
            c.lens(p0, p1, 3, ['i0', 'i1', 'i3'])
        else:
            c.dline(p0, p1, 'i1', 4, phase=int(age))
    for i in range(12):
        c.spark(14 + (i * 23 + f * 5) % 100, 10 + (i * 19) % 100, 2 if i % 2 else 1, 'w', 'y3') if (i + f) % 2 == 0 else None
    if f in (6, 7):
        star(c, 64, 68, 12, 26, 12, 'i3', rot=.2)
        c.disc(64, 68, 6, 'w')


if __name__ == '__main__':
    run(globals())
