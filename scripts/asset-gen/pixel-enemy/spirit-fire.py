"""Original fire spirit. A humanoid flame: ember core torso, flickering hair
that streams back, legs that dissolve into a flame tail. 48px, float."""
import sys
sys.dont_write_bytecode = True
from pe_lib import Pen, build
from pe_review import review
CELL = 48
PAL = dict(o='3a1418', d='7a1f1c', s='b83a1e', b='e8662a', l='f7a33a', h='fcd862', w='fff6d0', k='2a0c10')

POSE = {  # dx, dy, hair phase, arm mode
    'idle_a': (0, 0, 0), 'idle_b': (0, -1, 1), 'idle_c': (0, -2, 2),
    'windup': (-3, -2, 1), 'move': (2, -1, 2), 'attack': (1, 0, 0), 'recover': (1, 0, 1), 'hit': (-4, -1, 2),
}
HAIR = [
    [(22, 11), (17, 7), (20, 12), (13, 10), (19, 15), (15, 16)],
    [(22, 11), (16, 5), (20, 11), (12, 11), (19, 15), (14, 18)],
    [(22, 11), (18, 4), (20, 11), (13, 8), (19, 14), (13, 15)],
]


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # guttering embers on the floor and one thin rising smoke-flame
        p.poly([(15, 44), (17, 41), (20, 42), (23, 38), (26, 41), (29, 40), (33, 44)], 'd', 'o')
        p.poly([(19, 43), (22, 41), (24, 40), (26, 43)], 's')
        p.box((22, 42, 24, 43), 'l'); p.box((23, 43, 23, 43), 'h')
        p.grid(27, 34, ['.s', 's.', '.d'])
        p.grid(14, 40, ['l']); p.grid(34, 42, ['s'])
        return p
    dx, dy, ph = POSE[n]
    X = lambda pts: [(x + dx, y + dy) for x, y in pts]
    # ---- flame tail replacing legs, flicker alternates with the hair phase
    tail = [(19, 29), (29, 29), (28, 34), (25, 38), (22, 42 - ph), (21, 38), (17, 40 + (ph == 1)), (18, 35)]
    p.poly(X(tail), 's', 'o')
    p.poly(X([(20, 30), (27, 30), (25, 35), (23, 38), (21, 34)]), 'b')
    p.line(X([(23, 31), (23, 36)]), 'l')
    # ---- torso: hourglass flame with a bright ember heart
    p.poly(X([(19, 18), (29, 18), (31, 22), (28, 27), (29, 31), (19, 31), (20, 27), (17, 22)]), 'b', 'o')
    p.poly(X([(19, 19), (25, 19), (21, 24), (20, 28)]), 'l')
    p.line(X([(30, 22), (28, 26), (28, 30)]), 's')
    p.poly(X([(23, 22), (26, 22), (27, 25), (25, 27), (23, 26)]), 'h')
    p.box((24 + dx, 23 + dy, 25 + dx, 24 + dy), 'w')
    # ---- streaming hair behind the head (drawn before head)
    hair = HAIR[ph]
    if n == 'windup': hair = [(x, y - 2) for x, y in HAIR[1]]
    if n == 'attack': hair = [(x - 3, y + 1) for x, y in HAIR[0]]
    if n == 'hit': hair = [(x + 1, y - 1) for x, y in HAIR[2]]
    p.poly(X([(21, 9), (26, 7)] + [hair[0], hair[1], hair[2], hair[3], hair[4], hair[5]] + [(21, 18)]), 'd', 'o')
    p.poly(X([(22, 9), (hair[1][0] + 2, hair[1][1] + 2), (hair[2][0], hair[2][1]), (hair[3][0] + 2, hair[3][1] + 1), (22, 16)]), 's')
    p.line(X([(22, 10), (hair[1][0] + 2, hair[1][1] + 3)]), 'b')
    # ---- head: flame skull shape, right-facing, white-hot eye
    p.poly(X([(22, 9), (27, 8), (30, 10), (31, 13), (30, 16), (27, 18), (23, 17), (21, 14)]), 'l', 'o')
    p.poly(X([(23, 9), (27, 9), (25, 11), (23, 13)]), 'h')
    p.line(X([(30, 12), (29, 16)]), 'b')
    if n == 'hit':
        p.line(X([(27, 12), (29, 13)]), 'k'); p.line(X([(27, 14), (29, 13)]), 'k')
    else:
        p.box((27 + dx, 12 + dy, 29 + dx, 13 + dy), 'k'); p.box((28 + dx, 12 + dy, 29 + dx, 12 + dy), 'w')
    p.line(X([(27, 16), (29, 15)]), 'd')
    # flame tongues licking up from the crown; they lean back as it drifts forward
    lean = {'move': -1, 'attack': -2, 'hit': 1, 'windup': 0}.get(n, 0)
    tips = [[(22, 10), (19 + lean, 2 + ph), (21, 6), (24, 9)],
            [(24, 9), (23 + lean, 3 + (ph == 1)), (25, 5), (27, 8)],
            [(27, 8), (27 + lean, 5 - (ph == 2)), (30, 10)]]
    for t in tips:
        p.poly(X(t), 'l', 'o')
    p.line(X([(22, 8), (20 + lean, 4 + ph)]), 'h')
    p.line(X([(25, 7), (24 + lean, 5 + (ph == 1))]), 'h')
    # side flicks on the torso edge
    p.poly(X([(18, 22), (15, 20 + ph), (17, 25)]), 's', 'o')
    p.poly(X([(29, 29), (32, 31 - ph % 2), (28, 32)]), 's', 'o')
    # ---- arms
    if n == 'windup':
        arms = [[(20, 20), (16, 15), (15, 10)], [(28, 20), (32, 15), (33, 10)]]
    elif n == 'attack':
        arms = [[(21, 22), (27, 26), (33, 27)], [(28, 20), (35, 20), (40, 19)]]
    elif n == 'hit':
        arms = [[(20, 21), (15, 24), (12, 22)], [(28, 21), (32, 25), (35, 24)]]
    elif n == 'move':
        arms = [[(20, 21), (18, 26), (19, 29)], [(28, 21), (33, 22), (37, 20)]]
    else:
        arms = [[(20, 21), (17, 25), (18, 29)], [(28, 21), (32, 24), (34, 27)]]
    for i, a in enumerate(arms):
        A = X(a)
        p.line(A, 'o', 4); p.line(A, 's' if i == 0 else 'b', 2)
        ex, ey = A[-1]
        p.poly([(ex - 1, ey - 1), (ex + 2, ey - 2), (ex + 2, ey + 1), (ex, ey + 2)], 'l', 'o')
        p.box((ex, ey - 1, ex + 1, ey), 'h')
    if n == 'windup':
        for a in arms:
            ex, ey = a[-1][0] + dx, a[-1][1] + dy
            p.poly([(ex - 1, ey - 1), (ex, ey - 5), (ex + 2, ey - 2)], 'h')
    if n == 'attack':
        # the lunge ends in a gout of flame beyond the hands
        p.poly([(42, 15), (44, 17), (46, 19), (45, 23), (42, 24), (43, 20)], 'b', 'o')
        p.poly([(43, 18), (45, 20), (44, 22), (43, 21)], 'h')
        p.grid(38, 14, ['l..', '..s'])
    return p


if __name__ == '__main__':
    build('spirit-fire', CELL, PAL, draw)
    review('spirit-fire', CELL, airborne=('idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit'))

