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
    """Curling wave: back slope rising from the left, rounded crest at x=front, a lip hooking 'curl' px
    forward over a dark hollow barrel, and a concave face sweeping back down to the floor."""
    h = FLOOR - crest
    back = bez([(-6, FLOOR), (front * 0.45, FLOOR - h * 0.25), (front * 0.8, crest - 4), (front, crest)], 16)
    lip = bez([(front, crest), (front + curl * 0.8, crest - 2), (front + curl * 1.1, crest + h * 0.12),
               (front + curl * 0.8, crest + h * 0.28)], 10)
    face = bez([(front + curl * 0.8, crest + h * 0.28), (front + curl * 0.2, crest + h * 0.3),
                (front - curl * 0.1, crest + h * 0.7), (front + curl * 0.9 + 6, FLOOR)], 12)
    c.poly(back + lip[1:] + face[1:] + [(-6, FLOOR + 6)], keys[0])
    # body bands: each lighter band hugs the back slope, lower and shorter
    for i, k in enumerate(keys[1:], 1):
        sh = i * max(3, h * 0.09)
        pts = [(x - sh * 0.8, y + sh) for x, y in back if x - sh * 0.8 < front - sh * 0.6]
        pts += [(front - sh * 0.6 + curl * 0.2, crest + h * 0.45 + sh * 0.3), (front - sh + curl * 0.4, FLOOR), (-6, FLOOR + 6)]
        if len(pts) > 3:
            c.poly(pts, k)
    # hollow barrel under the lip
    if curl >= 8:
        c.oval(front + curl * 0.45, crest + h * 0.3, curl * 0.35, h * 0.12, 'i0')
        c.arc(front + curl * 0.45, crest + h * 0.3, curl * 0.35, 200, 340, 'a2', 1, squash=h * 0.12 / max(1, curl * 0.35))
    # foam: thick cap along the crest and lip, white highlight on the upper-left of the crest
    c.line(back[len(back) * 2 // 3:] + lip, 'a4', 3)
    c.line(back[len(back) * 3 // 4:] + lip[:5], 'w')
    # streak lines on the face (motion)
    for j in range(3):
        t = 0.45 + j * 0.15
        p = back[int(len(back) * t)]
        c.line([(p[0] - 6, p[1] + 6 + j * 2), (p[0] + 4, p[1] + 2 + j * 2)], keys[-1])


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
        wall(c, 60, 34, 18)
        spray(c, 70, 34, 6, 12, 3)
    elif f == 4:
        floor(c, 'a1')
        wall(c, 74, 20, 26)
        spray(c, 92, 22, 10, 16, 4)
        c.cloud(108, FLOOR - 8, 8, ('a1', 'a2', 'a3'), seed=44, lobes=7)
    elif f == 5:  # peak: crest breaks over the allies, white foam
        floor(c, 'a1')
        wall(c, 80, 14, 30)
        # the broken lip crashes down onto the ally side as a foam cascade
        c.poly([(96, 20), (118, 26), (126, 60), (122, FLOOR), (100, FLOOR), (104, 60)], 'a1')
        c.poly([(100, 26), (116, 32), (120, 62), (112, FLOOR - 4), (106, 60)], 'a2')
        for j in range(4):
            c.line([(102 + j * 4, 30 + j * 3), (106 + j * 4, FLOOR - 10 - j * 4)], 'a3', 2)
        c.cloud(110, FLOOR - 10, 16, ('a2', 'a3', 'a4', 'w'), seed=5, lobes=11)
        c.cloud(88, FLOOR - 4, 10, ('a2', 'a3', 'a4'), seed=15, lobes=8)
        spray(c, 110, 32, 16, 22, 5)
        spray(c, 60, 20, 8, 16, 55, ('w', 'a4'))
    elif f == 6:
        floor(c, 'a2')
        c.oval(64, FLOOR - 10, 70, 34, 'a1')
        c.ddisc(64, FLOOR - 30, 60, 'a2', squash=0.4)
        wall(c, 40, 60, 6, ('a1', 'a2', 'a3'))
        spray(c, 100, 60, 14, 26, 6)
        ripples(c, FLOOR + 4, 5, 20, 120, 'a4', 6)
    elif f == 7:
        floor(c, 'a1')
        c.ddisc(64, FLOOR - 6, 66, 'a1', 1, squash=0.35)
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
