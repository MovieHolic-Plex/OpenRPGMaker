"""mon_gale_screen: 날개 돌풍 (화면). A harpy/gargoyle beats its wings: mint gusts gather at the LEFT, crescent wind blades
sweep LEFT -> RIGHT across the stage, a vortex tears through the allies' side, feathers scatter and the air stills."""
import math

from lib_monster_36_52 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_gale_screen', 128, 8, 'screen'
PAL = pal(GALE, FEATHER, pick(STEEL, 's2'), WHITE)
PEAK = 4
MY = 66


def gust(c, x0, x1, y, k, amp=3, ph=0.0, w=1):
    pts = [(x, y + math.sin(x * 0.09 + ph) * amp) for x in range(int(x0), int(x1) + 1, 3)]
    if len(pts) > 1:
        c.line(pts, k, w)


def blade(c, x, y, r, keys, th=5):
    c.blade((x, y - r), (x, y + r), -r * 0.55, th, keys)


def feathers(c, n, seed, t, x0=40, spread=70):
    r = rng(seed)
    for i in range(n):
        x = x0 + r.uniform(0, spread) + 30 * t
        y = MY + r.uniform(-34, 30) + 12 * t * r.uniform(-1, 1) + 10 * t * t
        c.leaf(x, y, r.uniform(0, math.pi) + t * 3 * (1 if i % 2 else -1), r.uniform(5, 8), ['f1', 'f2', 'f3'][i % 3], 'f0')


def draw(c, f):
    if f == 0:          # wings beat: air pulled in at the left
        for i, (y, L) in enumerate(((MY - 18, 34), (MY - 4, 46), (MY + 10, 38), (MY + 24, 28))):
            gust(c, 8, 8 + L, y, 'g1' if i % 2 else 'g2', 2, i)
        c.arc(22, MY, 16, 280, 80, 'g2', 2)
    elif f == 1:
        for i, (y, L) in enumerate(((MY - 26, 60), (MY - 10, 76), (MY + 6, 70), (MY + 22, 58))):
            gust(c, 6, 6 + L, y, ['g1', 'g2', 'g3', 'g1'][i], 3, i * 1.3, 2 if i == 1 else 1)
        blade(c, 38, MY, 18, ['g1', 'g2', 'g3'], 4)
        feathers(c, 3, 1, 0.0, 20, 20)
    elif f == 2:        # first wind blades cross the middle
        for i, y in enumerate((MY - 30, MY - 12, MY + 8, MY + 26)):
            gust(c, 4, 110, y, ['g1', 'g2', 'g1', 'g2'][i], 3, i + 2)
        blade(c, 62, MY - 10, 22, ['g0', 'g1', 'g2', 'g3', 'w'], 6)
        blade(c, 44, MY + 14, 16, ['g1', 'g2', 'g3'], 4)
        feathers(c, 5, 2, 0.2, 20, 40)
    elif f == 3:
        for i, y in enumerate((MY - 34, MY - 18, MY - 2, MY + 14, MY + 30)):
            gust(c, 2, 124, y, ['g1', 'g2', 'g3', 'g2', 'g1'][i], 4, i * 0.8 + 3, 2 if i == 2 else 1)
        blade(c, 90, MY - 8, 26, ['g0', 'g1', 'g2', 'g3', 'w'], 7)
        blade(c, 70, MY + 18, 18, ['g0', 'g1', 'g2', 's2'], 5)
        blade(c, 52, MY - 26, 12, ['g1', 'g2', 'g3'], 3)
        feathers(c, 7, 3, 0.4)
    elif f == 4:        # PEAK: vortex on the allies' side + three blades
        for i in range(5):
            c.brush(96, MY, 30 - i * 5, i * 60, i * 60 + 230, 2.4 - i * 0.3, 0.6, ['g0', 'g1', 'g2', 'g3', 'w'][i], squash=0.6)
        blade(c, 104, MY - 20, 20, ['g1', 'g2', 'g3', 'w'], 6)
        blade(c, 108, MY + 22, 16, ['g1', 'g2', 's2'], 5)
        for i, y in enumerate((MY - 36, MY + 34)):
            gust(c, 6, 120, y, 'g2', 3, i + 5)
        c.spark(96, MY, 8, 'w', 'g3', diag=True)
        feathers(c, 9, 4, 0.6)
    elif f == 5:
        for i in range(4):
            c.brush(100, MY - 2, 32 - i * 6, 120 + i * 60, i * 60 + 330, 1.8 - i * 0.3, 0.4, ['g1', 'g2', 'g3', 's2'][i], squash=0.55)
        blade(c, 116, MY + 4, 18, ['g1', 'g2', 'g3'], 4)
        feathers(c, 11, 5, 0.8, 30, 80)
    elif f == 6:        # feathers scatter, gusts break into dashes
        for i, y in enumerate((MY - 24, MY - 4, MY + 16)):
            for x in range(20 + i * 12, 118, 18):
                c.line([(x, y + math.sin(x * .1) * 3), (x + 8, y + math.sin((x + 8) * .1) * 3)], 'g1' if i % 2 else 'g2')
        feathers(c, 11, 5, 1.0, 30, 80)
    else:
        for i, y in enumerate((MY - 14, MY + 10)):
            for x in range(40 + i * 10, 116, 22):
                c.line([(x, y), (x + 5, y + 1)], 'g1')
        r = rng(6)
        for i in range(7):
            c.leaf(60 + r.uniform(0, 50), MY - 20 + r.uniform(0, 60), r.uniform(0, 3), 5, ['f1', 'f2'][i % 2], 'f0')
    fade_oval(c, band=0.3)


if __name__ == '__main__':
    run(globals())

