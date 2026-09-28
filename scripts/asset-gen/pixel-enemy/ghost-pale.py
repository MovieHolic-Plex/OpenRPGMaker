"""Original pale ghost. A draped sheet body with a hollow face and a ragged
tail that trails behind it; claw hands reach toward the party. 48px, float."""
import sys
sys.dont_write_bytecode = True
from pe_lib import Pen, build
from pe_review import review
CELL = 48
PAL = dict(o='2b2d47', s='7c83ad', b='b9bfdd', l='e3e6f5', h='fbfbff', k='151626', c='8fe3f0', v='5a5f8c')

POSE = {  # dx, dy, tail sway, arm reach, head tilt
    'idle_a': (0, 0, 0, 0, 0), 'idle_b': (0, -1, 1, 0, 0), 'idle_c': (0, -2, 2, 0, 0),
    'windup': (-3, -3, -1, -2, -1), 'move': (2, -1, 3, 1, 1), 'attack': (1, 1, 4, 3, 1),
    'recover': (1, 0, 1, 0, 0), 'hit': (-4, -1, -2, -1, -2),
}


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # the sheet collapses into an empty puddle of cloth with a fading wisp
        p.poly([(10, 44), (13, 41), (19, 40), (26, 38), (32, 39), (37, 42), (39, 44)], 's', 'o')
        p.poly([(14, 41), (19, 40), (26, 39), (24, 41), (16, 42)], 'b')
        p.line([(17, 41), (22, 40)], 'l')
        p.box((28, 41, 30, 42), 'k')
        p.grid(25, 33, ['.b', 'b.', '.s'])
        return p
    dx, dy, sw, reach, tilt = POSE[n]
    X = lambda pts: [(x + dx, y + dy) for x, y in pts]
    # ---- ragged tail trailing down-left, sways with the drift
    t = sw
    p.poly(X([(17, 26), (29, 27), (30, 33), (27, 37), (22, 38), (18, 41 - t // 2), (13 - t, 40), (15 - t, 37), (12 - t, 35), (15, 31)]), 's', 'o')
    p.poly(X([(18, 28), (26, 29), (24, 34), (19, 36), (15 - t, 36), (16, 32)]), 'b')
    p.line(X([(19, 36), (16 - t, 38)]), 'v')
    # ---- body: hooded sheet, head bulge up and forward
    p.poly(X([(18, 17), (21, 12), (26, 10 + tilt // 2), (31, 12), (33, 16), (33, 22), (31, 28), (26, 30), (19, 30), (16, 25)]), 'b', 'o')
    p.poly(X([(19, 17), (22, 13), (26, 12), (24, 16), (21, 22), (18, 25)]), 'l')
    p.poly(X([(21, 14), (24, 12), (22, 16)]), 'h')
    p.line(X([(32, 18), (32, 22), (30, 27)]), 's')
    p.line(X([(20, 26), (25, 29)]), 's')
    # ---- hollow face: two vertical voids and a small open mouth
    fx, fy = 27 + dx, 15 + dy + tilt // 2
    p.box((fx, fy, fx + 1, fy + 3), 'k'); p.box((fx + 3, fy, fx + 4, fy + 3), 'k')
    if n in ('windup', 'attack'):
        p.box((fx + 1, fy + 5, fx + 3, fy + 8), 'k'); p.box((fx + 2, fy + 6, fx + 2, fy + 7), 'v')
    elif n == 'hit':
        p.line([(fx + 1, fy + 6), (fx + 3, fy + 5)], 'k')
    else:
        p.box((fx + 2, fy + 5, fx + 3, fy + 6), 'k')
    if n != 'hit':
        p.box((fx + 1, fy + 1, fx + 1, fy + 1), 'c'); p.box((fx + 4, fy + 1, fx + 4, fy + 1), 'c')
    # ---- sleeve arms with three bony claws
    if n == 'windup':
        arm = [(29, 24), (33, 17), (35, 11)]
        claws = [((35, 11), (36, 7)), ((35, 11), (38, 8)), ((35, 11), (39, 11))]
    elif n == 'attack':
        arm = [(29, 25), (35, 29), (40, 31)]
        claws = [((40, 30), (44, 29)), ((40, 30), (44, 32)), ((40, 30), (42, 35))]
    elif n == 'hit':
        arm = [(26, 25), (22, 28), (19, 26)]
        claws = [((19, 26), (17, 23)), ((19, 26), (16, 26))]
    else:
        arm = [(29, 25), (32, 28 + reach), (35 + reach, 28)]
        e = arm[-1]
        claws = [(e, (e[0] + 3, e[1] - 1)), (e, (e[0] + 3, e[1] + 1)), (e, (e[0] + 1, e[1] + 3))]
    A = X(arm)
    p.line(A, 'o', 5); p.line(A, 'b', 3); p.line([(A[0][0], A[0][1] - 1), (A[1][0], A[1][1] - 1)], 'l')
    for a, b in claws:
        a2, b2 = (a[0] + dx, a[1] + dy), (b[0] + dx, b[1] + dy)
        p.line([a2, b2], 'o', 2); p.line([a2, b2], 'l')
    # ragged sleeve end
    ex, ey = A[-1]
    p.grid(ex - 2, ey + 2, ['s.s'])
    if n == 'attack':
        for k in range(3):
            p.line([(34 + k * 2 + dx, 22 + k * 5 + dy), (37 + k * 2 + dx, 23 + k * 5 + dy)], 'c')
    if n == 'hit':
        p.line([(fx + 5, fy - 3), (fx + 7, fy - 4)], 'c'); p.line([(fx + 6, fy + 1), (fx + 8, fy + 1)], 'c')
    return p


if __name__ == '__main__':
    build('ghost-pale', CELL, PAL, draw)
    review('ghost-pale', CELL, airborne=('idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit'))

