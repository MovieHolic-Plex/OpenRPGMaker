"""bard_requiem_sky: 레퀴엠 (광역 배경). Violet night curtain falls over the stage, a giant pale staff
arches across it, a ghostly organ-pipe row rises, and translucent notes and soul wisps drift upward.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'bard_requiem_sky', 128, 10, 'screen'
PAL = pal(SOUL, pick(RAINBOW, 'n0', 'rv', 'rb'), pick(DREAM, 'b1', 'b3'), WHITE)
CX, CY = 64, 64


def curtain(c, depth):
    """Dark dithered drape from the top edge, depth in px."""
    for x in range(128):
        d = depth * (0.85 + 0.15 * math.sin(x * 0.19))
        for y in range(int(d)):
            if y < d - 10:
                if y < d - 22 or (x + y) % 2 == 0:
                    c.px(x, y, 'v0')
            elif (x + y) % 4 == 0:
                c.px(x, y, 'v1')


def arch_staff(c, span, k0, k1):
    """Five-line staff arching across the stage (a semicircle opening downward)."""
    for i in range(5):
        r = 46 + i * 3
        a0 = 180 + (1 - span) * 90
        a1 = 360 - (1 - span) * 90
        c.arc(CX, 96, r, a0, a1, k0 if i % 2 else k1, 1, squash=0.9)


def pipes(c, h, keys):
    for i in range(9):
        x = 16 + i * 12
        hh = h * (0.55 + 0.45 * math.sin((i + 1) / 10 * math.pi))
        if hh < 2:
            continue
        top = 124 - hh
        c.rect(x - 3, top, x + 3, 124, keys[0])
        c.rect(x - 2, top + 1, x + 1, 123, keys[1])
        c.line([(x - 2, top + 1), (x - 2, 123)], keys[2])
        c.poly([(x - 3, top), (x, top - 3), (x + 3, top)], keys[0])
        c.rect(x - 1, top + 6, x + 1, top + 8, 'v0')


def wisp(c, x, y, s, keys):
    c.disc(x, y, s + 1, keys[0])
    c.disc(x - 0.5, y - 0.5, s, keys[1])
    c.line([(x, y + s), (x + 2, y + s + 3), (x - 1, y + s + 6)], keys[0], 1)
    c.px(x - 1, y - 1, 'w')


def draw(c, f):
    curtain(c, min(60, 12 + f * 14) if f < 8 else 60 - (f - 7) * 18)
    if f >= 1:
        arch_staff(c, min(1.0, f / 4), 'v2', 'v3')
    if f >= 2:
        h = min(40, (f - 1) * 10) if f < 8 else 40 - (f - 7) * 14
        pipes(c, h, ['v1', 'v2', 'v3'])
    if f >= 3:
        r = rng(2)
        for i in range(10):
            x = r.uniform(12, 116)
            y0 = r.uniform(70, 118)
            age = f - 3 - (i % 3)
            if age < 0:
                continue
            y = y0 - age * 9
            x += math.sin(age + i) * 3
            if y < 10:
                continue
            if i % 2:
                note(c, x, y, 'v3' if i % 4 == 1 else 'b3', 4 if i % 3 else 8, s=1.0, ol='v0')
            else:
                wisp(c, x, y, 2, ['v2', 'v4'])
    if f == 5:
        c.spark(CX, 50, 12, 'w', 'v4', diag=True)
        c.ring(CX, 50, 10, 'v3', 1)
    if f == 6:
        c.dring(CX, 50, 20, 'v3')
        c.rays(CX, 50, 12, 14, 32, 'v3', rot=0.2)
    if f >= 8:
        r = rng(f)
        for i in range(16):
            c.px(r.uniform(4, 124), r.uniform(20, 120), 'v3' if i % 2 else 'b3')


if __name__ == '__main__':
    run(globals())

