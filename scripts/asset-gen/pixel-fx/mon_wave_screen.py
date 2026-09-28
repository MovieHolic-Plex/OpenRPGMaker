"""mon_wave_screen: 해일 (화면). Water gathers from the left, a teal tidal wall rises and curls over the stage,
the crest breaks toward the allies on the right in white foam at the peak, then drains back as spray and ripples.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_18_35 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_wave_screen', 128, 10, 'screen'
PAL = pal(SEA, pick(ICE, 'i0'), WHITE)
PEAK = 5
FLOOR = 104


def wall(c, front, crest, curl, keys=('a0', 'a1', 'a2', 'a3')):
    """Wave body from the left edge to 'front' x, crest height 'crest' (y), curling 'curl' px forward."""
    top = []
    for x in range(-4, int(front) + 1, 3):
        t = (x + 4) / (front + 4)
        y = lerp(FLOOR - 10, crest, t ** 1.6) + math.sin(x / 9) * 2
        top.append((x, y))
    lip = [(front + curl * 0.6, crest + 2), (front + curl, crest + 10), (front + curl * 0.7, crest + 16),
           (front + 2, crest + 12)]
    body = top + lip + [(front + 4, FLOOR), (-4, FLOOR + 8)]
    c.poly(body, keys[0])
    for i, k in enumerate(keys[1:], 1):
        sh = i * 5
        pts = [(x, y + sh) for x, y in top if x < front - sh] + [(front - sh + curl * 0.4, crest + sh + 4),
                                                                 (front - sh, FLOOR), (-4, FLOOR + 8)]
        if len(pts) > 3:
            c.poly(pts, k)
    # foam cap on the crest line
    c.line([(x, y) for x, y in top[len(top) // 2:]] + lip[:2], 'a4', 2)
    c.line([(x, y - 1) for x, y in top[len(top) * 3 // 4:]] + lip[:1], 'w')


def spray(c, cx, cy, n, spread, seed, keys=('a4', 'w', 'a3')):
    r = rng(seed)
    for i in range(n):
        a = r.uniform(-2.8, -0.2)
        d = r.uniform(4, spread)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
        c.disc(x, y, r.choice((1, 1.5)), keys[i % len(keys)])


def ripples(c, y, n, x0, x1, k, seed):
    r = rng(seed)
    for i in range(n):
        x = r.uniform(x0, x1)
        c.arc(x, y + r.uniform(-6, 6), r.uniform(6, 12), 200, 340, k, 1, squash=0.35)


def floor(c, k='a0', parity=0):
    c.drect(0, FLOOR - 4, 127, 127, k, parity)


def draw(c, f):
    if f == 0:
        floor(c)
        c.oval(8, FLOOR, 22, 8, 'a1')
        c.arc(8, FLOOR, 16, 200, 340, 'a3', 1, squash=0.4)
    elif f == 1:
        floor(c)
        wall(c, 30, 80, 4, ('a0', 'a1', 'a2'))
        ripples(c, FLOOR + 6, 3, 40, 110, 'a2', 1)
    elif f == 2:
        floor(c)
        wall(c, 48, 56, 10)
        ripples(c, FLOOR + 6, 4, 60, 120, 'a2', 2)
    elif f == 3:
        floor(c, 'a1')
        wall(c, 64, 34, 18)
        spray(c, 70, 34, 6, 12, 3)
    elif f == 4:
        floor(c, 'a1')
        wall(c, 80, 18, 26)
        spray(c, 92, 22, 10, 16, 4)
        c.drect(96, 30, 127, 100, 'i0')
    elif f == 5:  # peak: crest breaks over the allies, white foam
        floor(c, 'a1')
        wall(c, 88, 14, 30)
        c.poly([(92, 22), (127, 40), (127, 108), (96, 100)], 'a2')
        c.poly([(100, 34), (127, 52), (127, 100), (104, 96)], 'a3')
        for y in range(38, 100, 9):
            c.line([(98, y), (127, y + 6)], 'a4', 2)
        spray(c, 110, 32, 16, 22, 5)
        spray(c, 60, 20, 8, 16, 55, ('w', 'a4'))
    elif f == 6:
        floor(c, 'a2')
        c.drect(0, 40, 127, FLOOR, 'a1')
        wall(c, 40, 60, 6, ('a1', 'a2', 'a3'))
        spray(c, 100, 60, 14, 26, 6)
        ripples(c, FLOOR + 4, 5, 20, 120, 'a4', 6)
    elif f == 7:
        floor(c, 'a1')
        c.drect(0, 70, 127, FLOOR, 'a1', 1)
        spray(c, 80, 80, 10, 30, 7, ('a3', 'a4'))
        ripples(c, FLOOR + 4, 6, 10, 118, 'a3', 7)
    elif f == 8:
        floor(c, 'a0')
        ripples(c, FLOOR + 4, 6, 10, 118, 'a2', 8)
        spray(c, 64, 96, 8, 30, 8, ('a2', 'a3'))
    else:
        floor(c, 'a0', 1)
        ripples(c, FLOOR + 6, 4, 20, 110, 'a1', 9)


if __name__ == '__main__':
    run(globals())
