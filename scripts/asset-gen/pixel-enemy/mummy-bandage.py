"""Original mummy. Wrapped hunched body with visible bandage bands, one
glowing eye in a gap of cloth, a loose bandage strip used as a whip. 48px, stomp."""
import sys
sys.dont_write_bytecode = True
from pe_lib import Pen, build
from pe_review import review
CELL = 48
PAL = dict(o='2c2530', s='8a7a5e', b='c7b58c', l='e9dcb3', h='fbf2d6', d='5e5042', k='171219', e='f0d24a', r='7c3b33')

POSE = {  # dx lean, bob, step
    'idle_a': (0, 0, 0), 'idle_b': (0, 1, 0), 'idle_c': (0, 2, 0),
    'windup': (-2, 0, 0), 'move': (1, 1, 1), 'attack': (2, 1, 1), 'recover': (1, 1, 0), 'hit': (-3, 0, 0),
}


def bands(p, x0, y0, x1, y1, step=3, c='s'):
    for y in range(y0, y1 + 1, step):
        p.line([(x0, y), (x1, y + 1)], c)


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # crumpled heap of cloth with an unwound strip and the dead eye
        p.poly([(11, 44), (14, 40), (21, 38), (29, 39), (33, 42), (34, 44)], 'b', 'o')
        p.poly([(14, 41), (21, 39), (25, 40), (17, 42)], 'l')
        bands(p, 15, 41, 30, 43, 2, 's')
        p.line([(33, 43), (37, 42), (41, 43)], 'o', 3); p.line([(33, 43), (37, 42), (41, 43)], 'b')
        p.box((25, 40, 26, 40), 'k')
        return p
    dx, bob, st = POSE[n]
    # ---- legs, wrapped, shuffling
    bf, ff = (16, 29) if st else (18, 27)
    for top, foot, c in [((21, 32), bf, 's'), ((26, 32), ff, 'b')]:
        p.poly([(top[0] - 2, top[1]), (top[0] + 2, top[1]), (foot + 2, 41), (foot + 4, 44), (foot - 2, 44), (foot - 2, 41)], c, 'o')
        bands(p, min(top[0], foot) - 1, 35, max(top[0], foot) + 1, 42, 3, 'd' if c == 's' else 's')
    # ---- torso, hunched forward
    x, y = dx, bob
    p.poly([(17 + x, 20 + y), (27 + x, 19 + y), (31 + x, 23 + y), (30 + x, 29), (28, 33), (18, 33), (16 + x // 2, 27)], 'b', 'o')
    p.poly([(19 + x, 21 + y), (24 + x, 20 + y), (21 + x, 25 + y), (19, 28)], 'l')
    bands(p, 18 + x, 23 + y, 29 + x, 31, 3, 's')
    p.line([(29 + x, 24 + y), (28 + x, 29)], 'd')
    p.box((22, 30, 24, 31), 'd')  # torn cloth showing dark flesh
    # ---- trailing torn strip from the back
    sw = {'move': 2, 'attack': 3, 'hit': -1}.get(n, bob % 2)
    strip = [(17 + x, 25 + y), (14 - sw, 27 + y), (13 - sw, 31)]
    p.line(strip, 'o', 3); p.line(strip, 's')
    # ---- head: wrapped, jutting forward, one glowing eye
    hx, hy = 22 + dx + (1 if n == 'attack' else 0), 11 + bob + (1 if n == 'hit' else 0)
    p.poly([(hx, hy + 2), (hx + 3, hy), (hx + 7, hy), (hx + 9, hy + 3), (hx + 10, hy + 6), (hx + 8, hy + 9), (hx + 2, hy + 9), (hx - 1, hy + 6)], 'b', 'o')
    p.poly([(hx + 1, hy + 2), (hx + 4, hy + 1), (hx + 2, hy + 4)], 'h')
    bands(p, hx, hy + 3, hx + 9, hy + 8, 3, 's')
    p.box((hx + 6, hy + 4, hx + 8, hy + 5), 'k')
    p.box((hx + 7, hy + 4, hx + 7, hy + 4), 'e' if n != 'hit' else 'l')
    if n in ('windup', 'attack'):
        p.box((hx + 7, hy + 7, hx + 9, hy + 8), 'k'); p.box((hx + 8, hy + 8, hx + 8, hy + 8), 'r')
    # ---- far arm: limp forward
    fa = [(27 + x, 22 + y), (31 + x, 25 + y), (34 + x, 27 + y)] if n != 'hit' else [(26 + x, 22 + y), (30 + x, 20 + y), (33 + x, 21 + y)]
    p.line(fa, 'o', 4); p.line(fa, 's', 2)
    # ---- near arm holds the loose bandage whip
    if n == 'windup':
        arm = [(21, 21), (17, 15), (16, 10)]
        whip = [(16, 10), (13, 5), (8, 4), (4, 7), (5, 12)]
    elif n == 'attack':
        arm = [(23, 22), (29, 25), (34, 26)]
        whip = [(34, 26), (38, 25), (41, 26), (43, 28), (44, 31)]
    elif n == 'recover':
        arm = [(22, 22), (26, 27), (30, 29)]
        whip = [(30, 29), (34, 33), (37, 38), (41, 42), (44, 43)]
    elif n == 'hit':
        arm = [(20, 22), (16, 25), (14, 22)]
        whip = [(14, 22), (10, 26), (9, 32), (11, 37)]
    elif n == 'move':
        arm = [(21 + x, 22 + y), (27, 25 + y), (33, 25 + y)]
        whip = [(33, 25 + y), (36, 30), (37, 35), (39, 40)]
    else:
        arm = [(21 + x, 22 + y), (26, 26 + y), (31, 27 + y)]
        whip = [(31, 27 + y), (34, 31 + y), (34, 36), (36 + bob, 40)]
    p.line(whip, 'o', 3); p.line(whip, 'l')
    p.line(arm, 'o', 4); p.line(arm, 'l', 2); p.line(arm[1:], 's')
    ex, ey = arm[-1]
    p.box((ex - 1, ey - 1, ex + 1, ey + 1), 'o'); p.box((ex, ey - 1, ex + 1, ey), 'l')
    if n == 'attack':
        p.line([(39, 21), (43, 22)], 'h'); p.line([(38, 32), (42, 34)], 'h')
    return p


if __name__ == '__main__':
    build('mummy-bandage', CELL, PAL, draw)
    review('mummy-bandage', CELL)

