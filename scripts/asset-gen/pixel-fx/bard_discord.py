"""bard_discord: 불협화음. Broken staff lines snap and tangle over the enemy, jagged clashing notes
in sour green/violet, crackling spike waves and spiral 'confusion' swirls.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'bard_discord', 64, 10, 'allTargets'
PAL = pal(pick(RAINBOW, 'n0', 'rg', 'rv', 'rr'), pick(SOUL, 'v1', 'v2', 'v3'), WHITE, s0='#2e4a18', s1='#8ac83a')
CX, CY = 32, 32


def jag(c, y, amp, f, k, w=1, x0=2, x1=62):
    r = rng(int(y) * 7 + f)
    pts = [(x, y + (r.uniform(-amp, amp) if (x // 4) % 2 else 0)) for x in range(x0, x1 + 1, 4)]
    c.line(pts, k, w)


def swirl(c, x, y, r, rot, k):
    pts = []
    for i in range(22):
        a = rot + i * 0.5
        d = r * i / 22
        pts.append(pol(x, y, d, a))
    c.line(pts, 'n0', 3)
    c.line(pts, k, 1)


def draw(c, f):
    if f == 0:
        staff(c, 8, 56, 20, 3, 1, 0.2, 0, ['v1'], lines=5)
        return
    if f <= 3:
        # staff snaps: segments tilt and split apart
        for i in range(5):
            y = 14 + i * 3
            gap = f * 4
            c.line([(6, y + (i - 2) * f), (CX - gap, y - (i - 2) * f * 0.5)], 'v2')
            c.line([(CX + gap, y + (i - 2) * f * 0.7), (58, y - (i - 2) * f)], 'v2')
        c.spark(CX, 20, 4 + f * 2, 'w', 'rr', diag=True)
    if f >= 2:
        # clashing spike waves
        for j in range(3):
            y = CY + (j - 1) * 10
            jag(c, y, 3 + (f % 3), f + j, ['s1', 'rv', 'rr'][j], 1)
    if 2 <= f <= 8:
        r = rng(f)
        for i in range(6):
            x = 8 + i * 9 + r.uniform(-2, 2)
            y = 20 + r.uniform(-8, 20) + math.sin(f + i) * 3
            k = ['s1', 'rv', 'rg'][i % 3]
            # tilted, 'wrong' notes: draw a quarter note then a clash spark
            note(c, x, y, k, 16 if i % 2 else 2, s=0.9)
            if (f + i) % 3 == 0:
                c.spark(x - 2, y - 4, 3, 'w', 'rr')
    if f >= 4:
        for j, (x, y) in enumerate(((16, 12), (48, 14), (32, 8))):
            if f - 4 >= j:
                swirl(c, x, y, 5 + (f - 4 - j), f * 0.9 + j, ['s1', 'v3', 'rv'][j])
    if f == 5:
        c.ring(CX, CY, 20, 'n0', 3)
        c.ring(CX, CY, 20, 'rr', 1)
    if f >= 8:
        for i in range(10):
            x = 4 + i * 6
            c.px(x, CY + ((i + f) % 3 - 1) * 4, 's0' if i % 2 else 'v1')


if __name__ == '__main__':
    run(globals())

