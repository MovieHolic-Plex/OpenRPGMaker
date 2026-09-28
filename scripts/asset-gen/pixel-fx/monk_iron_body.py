"""monk_iron_body: 금강불괴. Gold motes spiral in, the body flashes into a faceted golden silhouette,
a hexagonal armour lattice rings the monk, then it sets with a clang flash and gleams away.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'monk_iron_body', 64, 10, 'user'
PAL = pal(MONK, WHITE)
CX, CY, FEET = 32, 34, 56


def body(c, keys, grow=0, hollow=True):
    """Chunky human silhouette shell around the actor (head, torso, legs).
    hollow punches the middle out so the battler stays visible through the armour glow."""
    for i, k in enumerate(keys):
        _body(c, k, grow - i)
    if hollow:
        c.pal['_'] = (0, 0, 0, 0)
        _body(c, '_', grow - len(keys) - 1)


def _body(c, k, g):
    if True:
        c.disc(CX, 17, 5 + g, k)
        c.poly([(CX - 9 - g, 24 - g), (CX + 9 + g, 24 - g), (CX + 7 + g, 42 + g), (CX - 7 - g, 42 + g)], k)
        c.poly([(CX - 7 - g, 40), (CX - 1 + g, 40), (CX - 2 + g, FEET + g), (CX - 8 - g, FEET + g)], k)
        c.poly([(CX + 1 - g, 40), (CX + 7 + g, 40), (CX + 8 + g, FEET + g), (CX + 2 - g, FEET + g)], k)


def hexes(c, r, k, rot=0.0, w=1, parity=None):
    pts = [pol(CX, CY, r, rot + i * math.pi / 3, 1.25) for i in range(7)]
    if parity is None:
        c.line(pts, k, w)
    else:
        for i in range(6):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            for j in range(12):
                if (j + parity) % 2 == 0:
                    c.px(lerp(x0, x1, j / 12), lerp(y0, y1, j / 12), k)


def spiral(c, t, n, keys, seed):
    r = rng(seed)
    for i in range(n):
        a0 = r.uniform(0, 2 * math.pi)
        a = a0 + t * 4
        d = lerp(28, 6, ease(t)) * r.uniform(0.85, 1.1)
        x, y = pol(CX, CY, d, a, 1.1)
        tx, ty = pol(CX, CY, d + 3, a - 0.35, 1.1)
        c.line([(tx, ty), (x, y)], keys[0])
        c.px(x, y, keys[1])


def draw(c, f):
    if f == 0:
        spiral(c, 0.2, 14, ['o1', 'y2'], 1)
        c.oval(CX, FEET, 12, 3, 'o0')
    elif f == 1:
        spiral(c, 0.5, 16, ['o2', 'y3'], 1)
        c.oval(CX, FEET, 14, 3, 'o1')
        c.oval(CX, FEET, 9, 2, 'y2')
    elif f == 2:
        spiral(c, 0.8, 16, ['y2', 'w'], 1)
        body(c, ['y1'], grow=0)
        c.oval(CX, FEET, 16, 3, 'o1')
    elif f == 3:
        c.rays(CX, CY, 16, 20, 31, 'y2', rot=0.1, jitter=[1, 0.8, 0.92, 0.7], squash=1.1)
        body(c, ['o2', 'y2', 'y3'], grow=2)
        body(c, ['w'], grow=-2, hollow=False)
    elif f == 4:
        hexes(c, 22, 'o1', 0, 3)
        hexes(c, 22, 'y2', 0, 1)
        body(c, ['o0', 'y1', 'y2'], grow=1)
        c.line([(CX - 3, 26), (CX - 5, 38)], 'y3', 2)      # facet glints
        c.line([(CX + 4, 26), (CX + 3, 34)], 'y3', 1)
        c.spark(CX - 14, 18, 5, 'w', 'y3')
    elif f == 5:
        hexes(c, 24, 'o1', 0.1, 3)
        hexes(c, 24, 'y3', 0.1, 1)
        hexes(c, 16, 'y1', 0.6, 1)
        body(c, ['o0', 'y1', 'y2'], grow=1)
        c.line([(CX - 9, 24), (CX + 9, 42)], 'w', 2)         # sweep of shine across the body
        c.spark(CX + 14, 16, 7, 'w', 'y3', diag=True)
    elif f == 6:
        hexes(c, 26, 'o0', 0.2, 1)
        hexes(c, 26, 'y2', 0.2, parity=0)
        body(c, ['o0', 'y1', 'y2'], grow=1)
        c.line([(CX - 6, 34), (CX + 6, 52)], 'y3', 2)
        c.oval(CX, FEET, 18, 3, 'o0')
        burst(c, CX, CY, 0.4, 12, 6, ['w', 'y3', 'y2'], spd=(20, 30))
    elif f == 7:
        body(c, ['o1', 'y1'], grow=0)
        c.disc(CX, 17, 3, 'y2')
        c.spark(CX - 10, 30, 3, 'w', 'y3')
        c.spark(CX + 11, 44, 2, 'y3', 'y2')
        burst(c, CX, CY, 0.7, 12, 6, ['y3', 'y2', 'o2'], spd=(20, 30), up=0.3)
    elif f == 8:
        for y in range(12, FEET, 4):   # dithered gold after-glow outline
            for x in (CX - 10 + (y % 8 == 0), CX + 10 - (y % 8 == 0)):
                c.px(x, y, 'y1')
        c.spark(CX + 8, 20, 4, 'w', 'y2')
        burst(c, CX, CY, 0.9, 12, 6, ['y2', 'o2', 'o1'], spd=(20, 30), up=0.5)
    elif f == 9:
        for i in range(6):
            x, y = CX - 14 + i * 6, 14 + (i * 7) % 30
            c.px(x, y, 'y2' if i % 2 else 'o2')
        c.spark(CX - 6, 12, 2, 'y3', 'y1')


if __name__ == '__main__':
    run(globals())

