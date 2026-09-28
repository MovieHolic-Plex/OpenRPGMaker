"""Original skeleton knight. Rusted kettle helm, cracked breastplate over ribs,
kite shield on the far arm and a longsword on the near arm. 48px, stomp."""
import sys
sys.dont_write_bytecode = True
from pe_lib import Pen, build
from pe_review import review
CELL = 48
PAL = dict(o='24212c', s='8a806c', b='cdc1a2', l='f0e6c8', i='3f4250', m='6c707e', n='a3a8b2',
           r='7e4630', u='b36c3c', w='5b3a2c', k='d6dde2', e='7fe6d4', t='5c3144')

# per pose: lean dx, bob dy, sword hand, sword tip, shield offset, step
POSE = {
    'idle_a': (0, 0, (19, 29), (17, 12), (0, 0), 0),
    'idle_b': (0, 1, (19, 30), (17, 13), (0, 1), 0),
    'idle_c': (0, 2, (19, 31), (17, 14), (0, 2), 0),
    'windup': (-2, 0, (19, 15), (9, 8), (2, -1), 0),
    'move': (1, 1, (20, 29), (21, 12), (1, 1), 1),
    'attack': (3, 2, (32, 27), (45, 32), (-4, 2), 1),
    'recover': (1, 2, (27, 31), (36, 43), (0, 2), 0),
    'hit': (-3, 1, (16, 27), (8, 20), (-1, -3), 0),
}


def sword(p, hand, tip):
    hx, hy = hand
    tx, ty = tip
    p.line([hand, tip], 'o', 3)
    p.line([hand, tip], 'k')
    # cross-guard perpendicular to the blade, one pixel pommel behind the grip
    vx, vy = tx - hx, ty - hy
    L = max(abs(vx), abs(vy)) or 1
    gx, gy = -vy / L * 2, vx / L * 2
    p.line([(round(hx + vx / L * 2 - gx), round(hy + vy / L * 2 - gy)),
            (round(hx + vx / L * 2 + gx), round(hy + vy / L * 2 + gy))], 'u', 2)
    p.box((round(hx - vx / L * 2), round(hy - vy / L * 2), round(hx - vx / L * 2), round(hy - vy / L * 2)), 'r')


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # shield flat, bones scattered, helm rolled forward, sword across
        p.poly([(9, 42), (19, 41), (21, 43), (20, 44), (10, 44)], 'w', 'o')
        p.line([(11, 42), (18, 42)], 'i')
        p.line([(18, 42), (31, 39)], 'o', 3); p.line([(18, 42), (31, 39)], 'k')
        p.line([(17, 41), (18, 44)], 'u', 2)
        for pts in [[(22, 43), (27, 42)], [(24, 41), (28, 42)], [(13, 40), (17, 40)]]:
            p.line(pts, 'o', 3); p.line(pts, 'b')
        p.poly([(30, 44), (31, 40), (34, 38), (38, 39), (39, 42), (38, 44)], 'm', 'o')
        p.line([(32, 40), (35, 39)], 'n')
        p.box((35, 42, 36, 42), 'o'); p.box((32, 41, 32, 41), 'r')
        return p
    dx, dy, hand, tip, (sdx, sdy), step = POSE[n]
    # ---- legs (far first): bone thigh, iron greave, sabaton on the floor
    back_foot = 15 if step else 18
    front_foot = 30 if step else 27
    for top, knee, foot, c in [((22, 32), (20 - step, 38), back_foot, 's'), ((25, 32), (27 + step, 38), front_foot, 'b')]:
        p.line([top, knee], 'o', 3); p.line([top, knee], c)
        p.poly([(knee[0] - 1, knee[1] - 1), (knee[0] + 2, knee[1] - 1), (foot + 2, 42), (foot - 1, 42)], 'i' if c == 's' else 'm', 'o')
        p.poly([(foot - 1, 42), (foot + 3, 42), (foot + 5, 44), (foot - 1, 44)], 'i' if c == 's' else 'm', 'o')
        if c == 'b': p.line([(knee[0], knee[1]), (foot, 41)], 'n')
    # ---- faulds and torn tabard
    p.poly([(18 + dx // 2, 30), (29 + dx // 2, 30), (31 + dx // 2, 34), (17 + dx // 2, 34)], 't', 'o')
    p.line([(19 + dx // 2, 33), (21 + dx // 2, 35), (22 + dx // 2, 33)], 't')
    p.line([(18 + dx // 2, 30), (29 + dx // 2, 30)], 'r')
    # ---- far arm bone reaching to the shield grip
    p.line([(27 + dx, 23 + dy), (30 + dx + sdx, 28 + dy + sdy)], 'o', 3)
    p.line([(27 + dx, 23 + dy), (30 + dx + sdx, 28 + dy + sdy)], 's')
    # ---- breastplate with a rust hole that shows the ribs
    x, y = dx, dy
    p.poly([(19 + x, 21 + y), (28 + x, 21 + y), (30 + x, 24 + y), (29 + x, 30), (19 + x, 30), (18 + x, 25 + y)], 'm', 'o')
    p.poly([(20 + x, 22 + y), (25 + x, 22 + y), (21 + x, 26 + y)], 'n')
    p.line([(29 + x, 25 + y), (28 + x, 29)], 'i')
    p.box((23 + x, 25 + y, 27 + x, 28 + y), 'o')
    p.line([(23 + x, 25 + y), (26 + x, 25 + y)], 'b'); p.line([(23 + x, 27 + y), (26 + x, 27 + y)], 'b')
    p.grid(26 + x, 22 + y, ['ru', '.r'])
    p.grid(20 + x, 28, ['rr'])
    # ---- head: kettle helm over a right-facing skull
    hx, hy = 21 + dx + (1 if n == 'attack' else 0), 12 + dy + (1 if n == 'hit' else 0)
    p.poly([(hx + 3, hy + 6), (hx + 10, hy + 6), (hx + 11, hy + 8), (hx + 10, hy + 10), (hx + 4, hy + 10), (hx + 3, hy + 8)], 'b', 'o')
    p.box((hx + 6, hy + 6, hx + 9, hy + 8), 'o'); p.box((hx + 10, hy + 8, hx + 10, hy + 8), 'o')
    p.box((hx + 8, hy + 7, hx + 8, hy + 7), 'e' if n != 'hit' else 'l'); p.box((hx + 7, hy + 7, hx + 7, hy + 7), 'e' if n != 'hit' else 'o')
    p.grid(hx + 5, hy + 10, ['o.o.o', 'lolol'] if n != 'windup' else ['lolol'])
    p.line([(hx + 4, hy + 7), (hx + 5, hy + 7)], 'l')
    p.poly([(hx, hy + 6), (hx + 1, hy + 2), (hx + 3, hy), (hx + 7, hy), (hx + 9, hy + 2), (hx + 10, hy + 5), (hx + 12, hy + 6), (hx - 1, hy + 7)], 'm', 'o')
    p.line([(hx + 2, hy + 2), (hx + 5, hy + 1)], 'n')
    p.line([(hx + 1, hy + 5), (hx + 10, hy + 5)], 'i')
    p.box((hx + 6, hy + 3, hx + 7, hy + 3), 'u'); p.box((hx + 8, hy + 4, hx + 8, hy + 4), 'r')
    p.line([(hx, hy + 7), (hx + 1, hy + 9)], 'i')
    # ---- kite shield on the far arm, in front of the chest
    sx, sy = 29 + dx + sdx, 22 + dy + sdy
    p.poly([(sx, sy), (sx + 5, sy), (sx + 7, sy + 2), (sx + 7, sy + 7), (sx + 4, sy + 12), (sx + 2, sy + 11), (sx, sy + 7)], 'w', 'o')
    p.line([(sx + 1, sy + 1), (sx + 1, sy + 7), (sx + 3, sy + 10)], 'u')
    p.line([(sx + 6, sy + 3), (sx + 6, sy + 7), (sx + 4, sy + 10)], 'i')
    p.box((sx + 3, sy + 4, sx + 4, sy + 5), 'n'); p.box((sx + 4, sy + 5, sx + 4, sy + 5), 'i')
    p.grid(sx + 2, sy + 8, ['r.', '.r'])
    # ---- near arm: pauldron, bone arm, gauntlet, sword on top
    shx, shy = 20 + dx, 22 + dy
    p.line([(shx + 1, shy + 2), hand], 'o', 3); p.line([(shx + 1, shy + 2), hand], 'b')
    sword(p, hand, tip)
    p.box((hand[0] - 1, hand[1] - 1, hand[0] + 1, hand[1] + 1), 'o'); p.box((hand[0], hand[1] - 1, hand[0] + 1, hand[1]), 'm')
    p.poly([(shx - 2, shy + 3), (shx - 1, shy), (shx + 3, shy - 1), (shx + 5, shy + 1), (shx + 4, shy + 4), (shx - 1, shy + 5)], 'm', 'o')
    p.line([(shx, shy + 1), (shx + 2, shy)], 'n')
    if n == 'attack':
        p.line([(37, 24), (44, 27)], 'k'); p.line([(38, 36), (44, 35)], 'n')
    return p


if __name__ == '__main__':
    build('skeleton-knight', CELL, PAL, draw)
    review('skeleton-knight', CELL)

