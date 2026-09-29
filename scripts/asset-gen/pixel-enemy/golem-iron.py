"""Original iron golem. Riveted plate torso, barrel shoulders with dark joints,
a visor slit with a glowing core behind it, two heavy block fists. 64px, stomp."""
import sys
sys.dont_write_bytecode = True
from pe_lib import Pen, build
from pe_review import review
CELL = 64
PAL = dict(o='1b1d26', d='333845', s='4d5566', b='717b8e', l='a1abbc', h='d5dce6', r='8a4d2c',
           u='b8733e', e='ffb13a', y='fff1b0', k='101218')

POSE = {  # lean, bob, step
    'idle_a': (0, 0, 0), 'idle_b': (0, 1, 0), 'idle_c': (0, 2, 0),
    'windup': (-3, -1, 0), 'move': (1, 1, 1), 'attack': (4, 2, 1), 'recover': (1, 1, 0), 'hit': (-3, 0, 0),
}


def plate(p, x0, y0, x1, y1, rivets=True):
    p.box((x0, y0, x1, y1), 'o')
    p.box((x0 + 1, y0 + 1, x1 - 1, y1 - 1), 'b')
    p.line([(x0 + 1, y0 + 1), (x1 - 1, y0 + 1)], 'l'); p.line([(x0 + 1, y0 + 1), (x0 + 1, y1 - 1)], 'l')
    p.line([(x1 - 1, y0 + 2), (x1 - 1, y1 - 1)], 's'); p.line([(x0 + 2, y1 - 1), (x1 - 1, y1 - 1)], 's')
    if rivets and x1 - x0 > 5 and y1 - y0 > 5:
        for rx, ry in [(x0 + 2, y0 + 2), (x1 - 2, y0 + 2), (x0 + 2, y1 - 2), (x1 - 2, y1 - 2)]:
            p.box((rx, ry, rx, ry), 'h')


def fist(p, x, y, w=11, h=11):
    plate(p, x, y, x + w, y + h, rivets=False)
    for k in range(1, 4):
        p.line([(x + 1, y + h - k * 3), (x + w - 1, y + h - k * 3)], 's')
    p.box((x + 2, y + 2, x + 4, y + 3), 'h')


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # toppled: plates scattered, head face-down with the core gone dark
        plate(p, 12, 50, 30, 60); plate(p, 29, 53, 43, 60); fist(p, 43, 51, 9, 9)
        plate(p, 5, 54, 13, 60, False)
        p.box((33, 48, 42, 53), 'o'); p.box((34, 49, 41, 52), 's'); p.line([(35, 51), (40, 51)], 'k')
        p.box((20, 53, 22, 55), 'r'); p.box((26, 57, 27, 58), 'r')
        return p
    lean, bob, st = POSE[n]
    x, y = lean, bob + 8
    # ---- legs: thick pistons with round knees, flat boots on y=60
    for lx, ly, far in [(19 - st * 2, 47, True), (35 + st * 2, 47, False)]:
        p.box((lx + 1, ly, lx + 8, 56), 'o'); p.box((lx + 2, ly, lx + 7, 55), 'd' if far else 's')
        p.line([(lx + 3, ly), (lx + 3, 54)], 's' if far else 'b')
        p.box((lx + 1, 52, lx + 8, 54), 'o'); p.box((lx + 2, 52, lx + 7, 53), 'b' if not far else 's')
        p.box((lx - 1, 56, lx + 11, 60), 'o'); p.box((lx, 57, lx + 10, 59), 's' if far else 'b')
        p.line([(lx, 57), (lx + 9, 57)], 'b' if far else 'l')
    # ---- far arm behind the torso
    if n == 'windup':
        far = (44 + x, 8 + y)
    elif n == 'attack':
        far = (44, 44)
    elif n == 'hit':
        far = (40 + x, 25 + y)
    elif n == 'move':
        far = (45 + x, 25 + y)
    else:
        far = (44 + x, 28 + y)
    a0, a1 = sorted((22 + y, far[1]))
    p.box((40 + x, a0, 45 + x, a1), 'o'); p.box((41 + x, a0, 44 + x, a1), 'd')
    fist(p, far[0] - 2, far[1], 10, 10)
    # ---- torso: stacked plates with rivets, rust streak
    plate(p, 18 + x, 20 + y, 44 + x, 36 + y)
    plate(p, 21 + x, 35 + y, 41 + x, 48)
    p.line([(29 + x, 21 + y), (29 + x, 35 + y)], 's'); p.line([(30 + x, 21 + y), (30 + x, 35 + y)], 'l')
    p.poly([(32 + x, 25 + y), (38 + x, 25 + y), (38 + x, 31 + y), (32 + x, 31 + y)], 'o')
    p.box((33 + x, 26 + y, 37 + x, 30 + y), 'k')
    p.box((34 + x, 27 + y, 36 + x, 29 + y), 'e' if n != 'hit' else 'r')
    p.box((35 + x, 28 + y, 35 + x, 28 + y), 'y' if n != 'hit' else 'u')
    if n in ('windup', 'attack'): p.box((34 + x, 27 + y, 36 + x, 27 + y), 'y')
    p.line([(41 + x, 23 + y), (41 + x, 34 + y)], 'r'); p.box((40 + x, 31 + y, 40 + x, 33 + y), 'u')
    p.box((22 + x, 45, 40 + x, 46), 's')
    # ---- head: squat helm with visor slit and glowing eye
    hx, hy = 25 + x + (1 if n == 'attack' else 0), 9 + y + (1 if n == 'hit' else 0)
    plate(p, hx, hy, hx + 14, hy + 11)
    p.box((hx + 5, hy + 4, hx + 14, hy + 6), 'k')
    p.box((hx + 10, hy + 4, hx + 12, hy + 5), 'e' if n != 'hit' else 'u'); p.box((hx + 11, hy + 4, hx + 11, hy + 4), 'y')
    if n in ('windup', 'attack'):
        p.box((hx + 13, hy + 4, hx + 14, hy + 5), 'e')
    p.line([(hx + 2, hy + 9), (hx + 12, hy + 9)], 's')
    p.box((hx + 6, hy - 2, hx + 8, hy), 'o'); p.box((hx + 7, hy - 1, hx + 7, hy - 1), 'l')
    # ---- shoulder barrel (near)
    p.poly([(12 + x, 20 + y), (15 + x, 17 + y), (23 + x, 17 + y), (26 + x, 20 + y), (26 + x, 27 + y), (12 + x, 27 + y)], 'b', 'o')
    p.line([(14 + x, 19 + y), (22 + x, 18 + y)], 'h'); p.line([(13 + x, 21 + y), (13 + x, 26 + y)], 'l')
    p.line([(13 + x, 26 + y), (25 + x, 26 + y)], 's')
    for rx in (15, 19, 23): p.box((rx + x, 22 + y, rx + x, 22 + y), 'h')
    # ---- near arm + fist
    if n == 'windup':
        near = (14 + x, 5 + y); seg = [(18 + x, 26 + y), (18 + x, 14 + y)]
    elif n == 'attack':
        near = (46, 42); seg = [(21 + x, 25 + y), (33, 35), (46, 44)]
    elif n == 'hit':
        near = (6 + x, 25 + y); seg = [(18 + x, 26 + y), (12 + x, 28 + y)]
    elif n == 'move':
        near = (19 + x, 30 + y); seg = [(19 + x, 26 + y), (22 + x, 31 + y)]
    else:
        near = (13 + x, 29 + y); seg = [(18 + x, 26 + y), (18 + x, 30 + y)]
    p.line(seg, 'o', 7); p.line(seg, 's', 5); p.line(seg, 'b', 3); p.line([(a + (-1 if i == 0 else 0), b) for i, (a, b) in enumerate(seg[:1])] + [(seg[-1][0] - 1, seg[-1][1] - 1)], 'l')
    fist(p, near[0], near[1], 12, 12)
    if n == 'attack':
        for sx, sy, ex, ey in [(42, 39, 47, 36), (47, 40, 52, 38), (40, 58, 55, 58)]:
            p.line([(sx, sy), (ex, ey)], 'h')
        p.grid(55, 52, ['l.', '.l', 'l.'])
    if n == 'hit':
        p.grid(hx + 15, hy - 2, ['y.', '.e'])
    return p


if __name__ == '__main__':
    build('golem-iron', CELL, PAL, draw)
    review('golem-iron', CELL)

