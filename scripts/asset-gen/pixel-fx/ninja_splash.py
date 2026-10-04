"""ninja_splash: 수룡탄 (착탄). The water dragon's jaws crash onto each target: a falling water mass, a crown splash, a tidal ring and droplets that rain back down.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'ninja_splash', 64, 8, 'allTargets'
PAL = pal(WATER, pick(NIGHT, 'v2', 'v3'), WHITE)


def drops(c, n, spread, height, seed, fall=0.0):
    r = rng(seed)
    for i in range(n):
        x = CX + r.uniform(-spread, spread)
        y = FEET - r.uniform(0, height) + fall * r.uniform(0.6, 1.3)
        if y > FEET:
            continue
        c.disc(x, y, 1.3 if i % 3 == 0 else 0.5, 'a3')
        c.px(x, y - 1, 'a4')
        c.px(x, y + 2, 'a1')


def crown(c, h, w, keys):
    for i in range(7):
        x = CX - w + i * w / 3
        hh = h * (0.6 + 0.4 * math.cos((i - 3) / 3 * math.pi / 2))
        c.flame(x, FEET, hh, 3.5, keys, lean=(i - 3) * 3)


def draw(c, f):
    if f == 0:
        c.oval(CX, 10, 12, 8, 'a1')
        c.oval(CX - 1, 8, 9, 5, 'a2')
        c.line([(CX - 6, 4), (CX + 4, 4)], 'a4')
        c.ring(CX, FEET, 10, 'a2', 1, squash=0.3)
    elif f == 1:
        # torrent: a wobbling stack of water lobes crashing down, bulging where it lands
        for k, dw in (('a0', 0), ('a1', -2), ('a2', -5), ('a3', -8)):
            for i in range(12):
                y = 2 + i * 4.2
                w = 9 + i * 0.7 + math.sin(i * 1.7) * 2 + dw
                if w > 0.6:
                    c.disc(CX + math.sin(i * 1.1) * 2 - (0 if dw == 0 else 1), y, w, k)
        c.line([(CX - 4, 6), (CX - 3, FEET - 12)], 'a4', 2)
        c.line([(CX + 4, 10), (CX + 5, 26)], 'a4')
        drops(c, 10, 20, 50, 1)
    elif f == 2:
        c.oval(CX, FEET - 4, 26, 8, 'a1')
        c.oval(CX, FEET - 5, 18, 5, 'a3')
        c.disc(CX, FEET - 6, 5, 'w')
        c.spark(CX, FEET - 8, 14, 'w', 'a4', diag=True)
        drops(c, 16, 24, 28, 2)
    elif f == 3:
        crown(c, 34, 24, ['a0', 'a1', 'a2', 'a3', 'a4'])
        c.ring(CX, FEET, 28, 'a2', 2, squash=0.3)
        drops(c, 18, 28, 48, 3)
    elif f == 4:
        crown(c, 26, 27, ['a1', 'a2', 'a3', 'a4'])
        c.ring(CX, FEET, 30, 'a3', 2, squash=0.3)
        c.ring(CX, FEET, 22, 'a1', 1, squash=0.3)
        drops(c, 20, 30, 54, 4)
    elif f == 5:
        crown(c, 14, 28, ['a1', 'a2', 'a3'])
        c.dring(CX, FEET, 31, 'a3', squash=0.3)
        drops(c, 20, 30, 50, 5, fall=8)
    elif f == 6:
        c.oval(CX, FEET, 24, 3, 'a1')
        c.line([(CX - 16, FEET - 1), (CX + 12, FEET - 1)], 'a3')
        drops(c, 16, 30, 44, 6, fall=16)
        c.dring(CX, FEET, 31, 'a1', parity=1, squash=0.3)
    else:
        c.dline((CX - 22, FEET), (CX + 22, FEET), 'a2')
        drops(c, 10, 30, 30, 7, fall=18)
        for x in (14, 28, 44):
            c.ring(x, FEET, 3, 'a3', 1, squash=0.4)


if __name__ == '__main__':
    run(globals())

