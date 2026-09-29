"""Original water spirit. A droplet-shaped maiden: translucent blue body read
through a darker inner current and bubbles, a wave crest for hair, arms that
spill into streams. Translucency is faked with opaque banded blues. 48px, float."""
import sys
sys.dont_write_bytecode = True
from pe_lib import Pen, build
from pe_review import review
CELL = 48
PAL = dict(o='1b2e5a', d='24508f', s='2f76b8', b='4aa3dc', l='86d0ee', h='c8f0f8', w='f4ffff', k='132046')

POSE = {  # dx, dy, ripple phase
    'idle_a': (0, 0, 0), 'idle_b': (0, -1, 1), 'idle_c': (0, -2, 2),
    'windup': (-3, -1, 1), 'move': (2, -1, 2), 'attack': (1, 0, 0), 'recover': (1, 0, 1), 'hit': (-4, -1, 2),
}


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # splash: flat puddle with a couple of droplets still falling
        p.poly([(10, 44), (13, 42), (20, 41), (28, 41), (35, 42), (39, 44)], 's', 'o')
        p.poly([(14, 42), (22, 42), (26, 43), (15, 43)], 'l')
        p.line([(16, 42), (19, 42)], 'h')
        p.grid(23, 35, ['.o.', 'obo', '.o.'])
        p.grid(30, 38, ['o', 'l'])
        return p
    dx, dy, ph = POSE[n]
    X = lambda pts: [(x + dx, y + dy) for x, y in pts]
    # ---- droplet skirt tapering to a point, ripples cross it
    p.poly(X([(18, 27), (30, 27), (32, 32), (29, 37), (25, 41), (22, 40), (19, 37), (16, 32)]), 'd', 'o')
    p.poly(X([(19, 28), (27, 28), (28, 32), (25, 37), (21, 35), (18, 31)]), 's')
    p.poly(X([(20, 29), (23, 29), (21, 33)]), 'b')
    p.line(X([(19 + ph, 34), (22 + ph, 33), (26 + ph, 34)]), 'l')
    p.line(X([(20, 30 + ph), (24, 29 + ph)]), 'b')
    p.line(X([(23, 38), (25, 37 - (ph == 1))]), 'b')
    p.box((27 + dx, 31 + dy + ph % 2, 27 + dx, 31 + dy + ph % 2), 'w')
    # ---- torso: bright rim, inner current, bubbles
    p.poly(X([(20, 18), (28, 18), (30, 22), (28, 27), (29, 29), (19, 29), (20, 27), (18, 22)]), 's', 'o')
    p.poly(X([(20, 19), (25, 19), (22, 23), (20, 27)]), 'l')
    p.line(X([(20, 20), (21, 25)]), 'h')
    p.line(X([(24, 19), (27, 19)]), 'h')
    p.line(X([(29, 22), (27, 27)]), 'd')
    p.poly(X([(23, 22), (27, 21), (26, 25), (24, 27)]), 'b')
    for bx, by in [(24, 23 + ph), (26, 26 - ph), (22, 31)]:
        p.box((bx + dx, by + dy, bx + dx, by + dy), 'w')
    # ---- wave-crest hair curling back over the shoulders
    p.poly(X([(22, 9), (26, 7), (21, 6), (15, 9), (13, 14 + ph), (16, 13), (15, 18), (19, 16), (20, 19)]), 'd', 'o')
    p.poly(X([(21, 8), (17, 10), (15, 14 + ph), (18, 12), (20, 14)]), 's')
    p.line(X([(20, 7), (16, 9)]), 'l')
    # ---- head: smooth droplet face, right-facing
    p.poly(X([(21, 10), (25, 8), (29, 9), (31, 12), (30, 16), (27, 18), (23, 18), (21, 15)]), 'b', 'o')
    p.poly(X([(22, 10), (26, 9), (23, 13)]), 'h')
    p.box((22 + dx, 11 + dy, 22 + dx, 11 + dy), 'w')
    p.line(X([(30, 12), (29, 16)]), 's')
    if n == 'hit':
        p.line(X([(27, 12), (29, 14)]), 'k')
    elif n == 'windup':
        p.box((27 + dx, 12 + dy, 29 + dx, 13 + dy), 'k'); p.box((28 + dx, 12 + dy, 28 + dx, 12 + dy), 'w')
    else:
        p.line(X([(27, 13), (29, 13)]), 'k'); p.box((28 + dx, 12 + dy, 29 + dx, 12 + dy), 'k')
        p.box((29 + dx, 12 + dy, 29 + dx, 12 + dy), 'w')
    p.line(X([(28, 16), (29, 16)]), 'd')
    # ---- arms
    if n == 'windup':
        arms = [[(20, 20), (15, 16), (13, 11)], [(28, 20), (33, 18), (36, 13)]]
    elif n == 'attack':
        arms = [[(21, 21), (27, 25), (32, 26)], [(28, 20), (35, 22), (41, 22)]]
    elif n == 'hit':
        arms = [[(20, 21), (15, 24), (12, 22)], [(28, 21), (32, 25), (36, 24)]]
    elif n == 'move':
        arms = [[(20, 21), (18, 26), (19, 29)], [(28, 21), (33, 22), (37, 21)]]
    else:
        arms = [[(20, 21), (17, 25), (18, 29)], [(28, 21), (32, 24), (34, 28)]]
    for i, a in enumerate(arms):
        A = X(a)
        p.line(A, 'o', 4); p.line(A, 'd' if i == 0 else 's', 2)
        if i: p.line(A[:2], 'l')
        ex, ey = A[-1]
        p.poly([(ex - 1, ey - 1), (ex + 2, ey - 1), (ex + 2, ey + 1), (ex, ey + 2)], 'b', 'o')
        p.box((ex, ey, ex, ey), 'h')
    if n == 'windup':
        # a water orb gathers between the raised hands
        ox, oy = 25 + dx, 7 + dy
        p.d.ellipse((ox - 4, oy - 4, ox + 4, oy + 4), fill=p.pal['o'])
        p.d.ellipse((ox - 3, oy - 3, ox + 3, oy + 3), fill=p.pal['b'])
        p.d.ellipse((ox - 3, oy - 3, ox, oy), fill=p.pal['h'])
        p.box((ox + 2, oy + 1, ox + 2, oy + 2), 's')
        p.grid(ox - 7, oy - 1, ['l']); p.grid(ox + 6, oy + 2, ['l'])
    if n == 'attack':
        # a jet of water bursts from the forward hand
        p.poly([(40 + dx, 20), (46, 17), (46, 27), (40 + dx, 24)], 'b', 'o')
        p.poly([(41 + dx, 21), (45, 19), (45, 21), (41 + dx, 22)], 'h')
        p.line([(42 + dx, 23), (45, 25)], 'l')
        p.line([(36 + dx, 22), (41 + dx, 22)], 'l')
        p.grid(37, 15, ['h..', '..l'])
    if n == 'hit':
        p.grid(33 + dx, 7 + dy, ['.l', 'l.', '.h'])
    return p


if __name__ == '__main__':
    build('spirit-water', CELL, PAL, draw)
    review('spirit-water', CELL, airborne=('idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit'))

