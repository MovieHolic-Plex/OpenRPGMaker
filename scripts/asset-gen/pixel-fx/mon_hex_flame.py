"""mon_hex_flame: 저주의 불꽃 (착탄, 아군 전원). A green hex rune kindles under the ally, sickly green witch-fire
licks up around the body with dark cores, flares into a skull-crowned blaze at the peak, then gutters out as green cinders.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_18_35 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_hex_flame', 64, 10, 'allTargets'
PAL = pal(HEX, pick(GRAVE, 'v0', 'v1', 'v2'), pick(BONE, 'b2', 'b3'))
PEAK = 5
HK = ['x0', 'x1', 'x2', 'x3', 'x4']


def rune(c, r, turn, k='x2', k2='x1'):
    c.ring(CX, FEET, r, k2, 1, squash=0.32)
    pts = [pol(CX, FEET, r, turn + i * 2 * math.pi / 5 * 2, 0.32) for i in range(6)]
    c.line(pts, k)


def fire(c, h, seed, n=5, keys=HK, spread=1.0):
    r = rng(seed)
    for i in range(n):
        x = CX + (i - (n - 1) / 2) * 7 * spread + r.uniform(-1, 1)
        hh = h * (1 - abs(i - (n - 1) / 2) / n * 0.9) * r.uniform(0.75, 1.05)
        c.flame(x, FEET, hh, 3.2, keys, lean=r.uniform(-4, 4))
    # dark cores give it the cursed look
    for i in range(0, n, 2):
        x = CX + (i - (n - 1) / 2) * 7 * spread
        c.flame(x, FEET, h * 0.35, 1.5, ['v1'], lean=0)


def cinders(c, n, seed, top, drift=0):
    r = rng(seed)
    for i in range(n):
        x, y = CX + r.uniform(-20, 20) + drift, r.uniform(top, FEET - 8)
        c.diamond(x, y, 1, 1.5, 'x3' if i % 2 else 'x2')


def draw(c, f):
    if f == 0:
        rune(c, 12, 0)
    elif f == 1:
        rune(c, 18, 0.2, 'x3', 'x2')
        fire(c, 8, 1, 3, HK[1:4])
    elif f == 2:
        rune(c, 20, 0.4, 'x3', 'x2')
        fire(c, 20, 2, 5, HK[:4])
        cinders(c, 3, 2, 26)
    elif f == 3:
        rune(c, 22, 0.6, 'x4', 'x2')
        fire(c, 32, 3)
        cinders(c, 5, 3, 16)
    elif f == 4:
        rune(c, 23, 0.8, 'x4', 'x2')
        fire(c, 40, 4, 6, spread=0.9)
        cinders(c, 6, 4, 10)
    elif f == 5:  # peak: tall blaze with a floating skull of green fire
        c.dring(CX, CY, 26, 'x1', squash=0.9)
        rune(c, 24, 1.0, 'x4', 'x3')
        fire(c, 44, 5, 6, spread=0.95)
        c.flame(CX, 20, 12, 7, HK[1:])
        c.skull(CX, 12, 5, 'b2', 'v0', 'b3')
        c.flame(CX - 8, 16, 7, 2, ['x2', 'x4'], lean=-2)
        c.flame(CX + 8, 16, 7, 2, ['x2', 'x4'], lean=2)
        cinders(c, 8, 5, 4)
    elif f == 6:
        rune(c, 23, 1.2, 'x3', 'x2')
        fire(c, 40, 6, 6, spread=0.95)
        c.skull(CX + 2, 8, 4, 'x3', 'v0')
        cinders(c, 8, 6, 2, 2)
    elif f == 7:
        rune(c, 20, 1.4, 'x2', 'x1')
        fire(c, 24, 7, 5, HK[:4])
        cinders(c, 8, 7, 8, 3)
    elif f == 8:
        c.ring(CX, FEET, 18, 'x1', 1, squash=0.32)
        fire(c, 10, 8, 4, HK[:3])
        cinders(c, 6, 8, 12, 4)
    else:
        c.ddisc(CX, FEET, 16, 'x1', 1, squash=0.3)
        cinders(c, 5, 9, 18, 5)


if __name__ == '__main__':
    run(globals())
