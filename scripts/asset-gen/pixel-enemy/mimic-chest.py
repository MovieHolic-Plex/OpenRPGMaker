"""Original mimic chest. A banded wooden chest whose lid is a jaw: rows of
teeth, a long tongue, a single eye in the lock plate. Hops and bites. 48px, hop."""
import sys
sys.dont_write_bytecode = True
from pe_lib import Pen, build
from pe_review import review
CELL = 48
PAL = dict(o='24161a', d='4e2c22', s='7a4630', b='a8683c', l='d49a58', g='b88d2c', y='f0d170',
           k='12080c', m='6a1c2a', r='c2455a', t='f08aa0', w='f6efdc', e='ff5a3a')

# pose: body dx, lift off floor, lid angle (0 closed .. 4 wide), squash
POSE = {
    'idle_a': (0, 0, 1, 0), 'idle_b': (0, -1, 1, 0), 'idle_c': (0, 0, 1, 1),
    'windup': (-2, 0, 0, 2), 'move': (1, 8, 3, 0), 'attack': (1, 2, 3, 0),
    'recover': (1, 0, 1, 1), 'hit': (-3, 0, 2, 0),
}


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # knocked on its back, lid flopped open, tongue hanging out
        p.poly([(10, 44), (10, 37), (28, 37), (29, 44)], 's', 'o')
        p.line([(11, 38), (27, 38)], 'l'); p.box((15, 37, 16, 43), 'g'); p.box((23, 37, 24, 43), 'g')
        p.poly([(30, 44), (31, 40), (40, 40), (41, 44)], 'd', 'o')
        p.line([(31, 41), (39, 41)], 'w')
        p.line([(27, 39), (33, 42), (36, 43)], 'r', 2)
        p.grid(18, 39, ['ow.', 'ooo', '.o.'])
        return p
    dx, lift, lid, sq = POSE[n]
    pop = 1 if lift < 0 else 0
    lift = max(0, lift)
    base = 44 - lift
    x0, x1 = 13 + dx - sq, 34 + dx + sq
    top = base - 11 + sq
    # ---- chest box (lower jaw)
    p.box((x0, top, x1, base), 'o')
    p.box((x0 + 1, top + 1, x1 - 1, base - 1), 's')
    p.line([(x0 + 1, top + 1), (x1 - 1, top + 1)], 'b')
    for yy in range(top + 3, base, 3): p.line([(x0 + 2, yy), (x1 - 2, yy)], 'd')
    p.line([(x0 + 1, top + 2), (x0 + 1, base - 1)], 'l')
    for bx in (x0 + 3, x1 - 4):
        p.box((bx, top, bx + 1, base), 'g'); p.box((bx, top + 1, bx, base - 1), 'y')
    p.box((x0, base - 1, x1, base), 'd')
    # little clawed feet only while standing
    if lift == 0:
        p.grid(x0 + 1, base, ['o']); p.grid(x1 - 1, base, ['o'])
    # lock plate with the eye
    lx, ly = (x0 + x1) // 2 + 2, top + 3
    p.box((lx - 2, ly, lx + 2, ly + 4), 'g'); p.box((lx - 2, ly, lx + 1, ly), 'y')
    eye = 'e' if n != 'hit' else 'o'
    p.box((lx - 1, ly + 1, lx + 1, ly + 3), 'k'); p.box((lx, ly + 2, lx, ly + 2), eye)
    if n == 'windup': p.box((lx - 1, ly + 2, lx + 1, ly + 2), 'e')
    # ---- mouth interior and lower teeth
    mouth_h = [0, 3, 5, 8, 11][lid]
    if mouth_h:
        p.box((x0 + 1, top - mouth_h, x1 - 1, top), 'm')
        p.box((x0 + 2, top - mouth_h + 1, x1 - 3, top - 1), 'k')
        for tx in range(x0 + 3, x1 - 2, 4):
            p.poly([(tx, top), (tx + 1, top - min(2, mouth_h - 1)), (tx + 2, top)], 'w')
    # ---- lid, hinged at the back (left) edge, opens upward to the right
    hx, hy = x0, top - mouth_h
    # lid rises more at the front
    rise = [0, 2, 4, 7, 10][lid] + pop
    fx, fy = x1 + (1 if lid >= 3 else 0), top - mouth_h - rise
    thick = 6
    p.poly([(hx, hy), (fx, fy), (fx, fy - thick), (fx - 3, fy - thick - 2), (hx + 3, hy - thick - 2 + rise // 3), (hx, hy - thick)], 'b', 'o')
    p.poly([(hx + 1, hy - thick + 1), (hx + 3, hy - thick - 1 + rise // 3), (fx - 4, fy - thick - 1), (fx - 6, fy - thick + 1)], 'l')
    for bx in (hx + 3, fx - 4):
        yb = hy + (fy - hy) * (bx - hx) // max(1, fx - hx)
        p.line([(bx, yb - 1), (bx, yb - thick - 1)], 'g')
    p.line([(hx + 1, hy - 1), (fx - 1, fy - 1)], 'd')
    if mouth_h:
        # upper teeth hanging from the lid edge
        steps = max(1, (fx - hx) // 4)
        for i in range(1, steps):
            tx = hx + i * 4 - 1
            ty = hy + (fy - hy) * i // steps
            p.poly([(tx - 1, ty), (tx, ty + 2), (tx + 1, ty)], 'w')
    # ---- tongue
    if n in ('idle_b', 'move', 'attack', 'hit'):
        if n == 'attack':
            tongue = [(x1 - 4, top - 3), (x1 + 3, top - 5), (x1 + 7, top - 3), (x1 + 8, top)]
        elif n == 'move':
            tongue = [(x1 - 4, top - 2), (x1 + 1, top - 1), (x1 + 3, top + 2)]
        elif n == 'hit':
            tongue = [(x1 - 4, top - 2), (x1 + 1, top - 6), (x1 + 4, top - 8)]
        else:
            tongue = [(x1 - 4, top - 1), (x1 + 1, top), (x1 + 2, top + 3)]
        p.line(tongue, 'o', 4); p.line(tongue, 'r', 2); p.line(tongue[:2], 't')
    if n == 'attack':
        p.line([(x1 + 3, top - 11), (x1 + 7, top - 12)], 'y'); p.line([(x1 + 5, top - 7), (x1 + 9, top - 8)], 'y')
    if n == 'move':
        p.line([(x0 - 3, base + 3), (x0 + 2, base + 2)], 'd')
    if n == 'hit':
        p.grid(x0 - 3, top - 8, ['y.', '.y'])
    return p


if __name__ == '__main__':
    build('mimic-chest', CELL, PAL, draw)
    review('mimic-chest', CELL, airborne=('move', 'attack'))

