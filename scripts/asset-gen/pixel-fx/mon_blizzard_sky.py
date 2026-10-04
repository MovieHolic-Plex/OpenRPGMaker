"""mon_blizzard_sky: 서리 폭풍 (화면). A cold blue haze falls over the stage, wind bands sweep in from the left
carrying snow, the storm peaks in a white-out gust with ice needles, then the wind drops and the last flakes settle.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_18_35 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_blizzard_sky', 128, 10, 'screen'
PAL = pal(ICE, WHITE)
PEAK = 5
TILT = 0.28  # wind falls a little toward the right


def band(c, y, x0, x1, k, w=1, wob=0.0):
    pts = [(x, y + (x - x0) * TILT + math.sin(x / 11 + wob) * 3) for x in range(int(x0), int(x1) + 1, 4)]
    if len(pts) > 1:
        c.line(pts, k, w)


def snow(c, n, seed, shift, keys=('i3', 'i4', 'w'), flakes=0):
    r = rng(seed)
    for i in range(n):
        x = (r.uniform(0, 128) + shift) % 136 - 4
        y = r.uniform(4, 124) + shift * TILT * 0.6
        y %= 128
        k = keys[i % len(keys)]
        if flakes and i % flakes == 0:
            c.flake(x, y, 2, k)
        else:
            c.line([(x, y), (x - 3, y - 1)], k)


def haze(c, k, parity=0):
    c.drect(0, 0, 127, 127, k, parity)


def draw(c, f):
    s = f * 14
    if f == 0:
        haze(c, 'i0')
        snow(c, 14, 1, s)
    elif f == 1:
        haze(c, 'i0')
        for y in (30, 70):
            band(c, y, 0, 50, 'i1', 2)
        snow(c, 24, 1, s, flakes=5)
    elif f == 2:
        haze(c, 'i0')
        for y, x1 in ((20, 80), (54, 64), (88, 90)):
            band(c, y, 0, x1, 'i2', 2, f)
        snow(c, 36, 1, s, flakes=5)
    elif f == 3:
        haze(c, 'i1')
        for y, x1 in ((14, 110), (44, 96), (74, 128), (102, 100)):
            band(c, y, 0, x1, 'i2', 3, f)
            band(c, y - 3, 10, x1 - 10, 'i3', 1, f)
        snow(c, 48, 1, s, flakes=4)
    elif f == 4:
        haze(c, 'i1')
        for y in (8, 34, 60, 86, 112):
            band(c, y, 0, 128, 'i2', 4, f)
            band(c, y - 2, 0, 128, 'i3', 2, f)
        snow(c, 56, 1, s, ('i4', 'w'), flakes=4)
        for i in range(6):
            c.shard(10 + i * 20, 20 + (i * 37) % 80, TILT, 8, 1.5, ['i2', 'i3', 'w'])
    elif f == 5:  # peak white-out
        haze(c, 'i1')
        for y in (0, 22, 44, 66, 88, 110):
            band(c, y, 0, 128, 'i3', 3, f)
            band(c, y, 0, 128, 'w', 1, f)
        for i in range(9):
            c.shard(4 + i * 14, 10 + (i * 29) % 100, TILT, 11, 2, ['i1', 'i3', 'w'])
        snow(c, 30, 2, s, ('i1', 'i0'), flakes=3)
    elif f == 6:
        haze(c, 'i1')
        for y in (12, 40, 68, 96):
            band(c, y, 0, 128, 'i3', 3, f)
        snow(c, 50, 1, s, flakes=4)
        for i in range(5):
            c.shard(20 + i * 22, 30 + (i * 31) % 70, TILT, 7, 1.5, ['i2', 'i4'])
    elif f == 7:
        haze(c, 'i0')
        for y, x0 in ((24, 40), (62, 60), (98, 30)):
            band(c, y, x0, 128, 'i2', 2, f)
        snow(c, 40, 1, s, flakes=4)
    elif f == 8:
        haze(c, 'i0')
        band(c, 50, 70, 128, 'i1', 2, f)
        snow(c, 30, 3, s * 0.5, ('i2', 'i3', 'i4'), flakes=3)
    else:
        haze(c, 'i0', 1)
        r = rng(9)
        for i in range(12):
            c.flake(r.uniform(10, 118), r.uniform(20, 110), 2, 'i2' if i % 2 else 'i3')


if __name__ == '__main__':
    run(globals())
