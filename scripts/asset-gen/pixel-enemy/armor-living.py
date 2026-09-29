"""Original living armor. A hollow plate suit: dark void with violet light
inside the helm slit, the gorget gap and the elbow joints; a great axe held in
both hands. 48px, stomp."""
import sys
sys.dont_write_bytecode = True
from pe_lib import Pen, build
from pe_review import review
CELL = 48
PAL = dict(o='1c1a26', d='3a3c4c', s='5c6074', b='8a90a4', l='bcc2d2', h='eef0f6', k='0d0b14',
           v='6b2fb0', p='b565ff', q='f0d0ff', w='5e3b28', u='9a6a3a')

POSE = {  # dx, bob, step, (hand, axe head angle-ish end)
    'idle_a': (0, 0, 0), 'idle_b': (0, 1, 0), 'idle_c': (0, 2, 0),
    'windup': (-2, 0, 0), 'move': (1, 1, 1), 'attack': (3, 2, 1), 'recover': (1, 2, 0), 'hit': (-3, 1, 0),
}
# haft endpoints (butt, head) and hand position per pose
AXE = {
    'idle': ((31, 42), (35, 13), (32, 28)),
    'windup': ((26, 32), (9, 8), (21, 23)),
    'move': ((33, 41), (38, 13), (33, 27)),
    'attack': ((19, 20), (34, 36), (26, 27)),
    'recover': ((21, 23), (35, 40), (25, 28)),
    'hit': ((33, 42), (39, 16), (32, 29)),
}


def axe_head(p, hx, hy, bx, by):
    # blade perpendicular to the haft, facing forward/right of the haft direction
    vx, vy = hx - bx, hy - by
    L = (vx * vx + vy * vy) ** .5
    ux, uy = vx / L, vy / L
    nx, ny = -uy, ux  # left normal
    if nx < 0: nx, ny = -nx, -ny
    pts = [(hx - ux * 1, hy - uy * 1), (hx + nx * 3 - ux * 1, hy + ny * 3 - uy * 1),
           (hx + nx * 7 + ux * 3, hy + ny * 7 + uy * 3), (hx + nx * 8 - ux * 3, hy + ny * 8 - uy * 3),
           (hx + nx * 7 - ux * 8, hy + ny * 7 - uy * 8), (hx + nx * 3 - ux * 5, hy + ny * 3 - uy * 5), (hx - ux * 5, hy - uy * 5)]
    pts = [(round(a), round(b)) for a, b in pts]
    p.poly(pts, 's', 'o')
    p.line([pts[2], pts[3], pts[4]], 'h')
    p.line([pts[1], pts[5]], 'd')
    # back spike
    p.line([(round(hx - ux * 3), round(hy - uy * 3)), (round(hx - nx * 3 - ux * 3), round(hy - ny * 3 - uy * 3))], 'b')


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # the suit collapses into a pile of empty plates; the light is gone
        p.poly([(12, 44), (14, 40), (20, 39), (24, 41), (22, 44)], 's', 'o')
        p.line([(14, 41), (19, 40)], 'l')
        p.poly([(22, 44), (24, 38), (30, 37), (33, 40), (32, 44)], 'b', 'o')
        p.box((27, 40, 30, 41), 'k'); p.line([(25, 39), (29, 38)], 'h')
        p.poly([(33, 44), (35, 41), (38, 41), (40, 44)], 's', 'o')
        p.line([(8, 43), (30, 43)], 'o', 2); p.line([(8, 43), (30, 43)], 'w')
        p.poly([(5, 38), (9, 39), (10, 44), (5, 44), (3, 41)], 's', 'o'); p.line([(4, 41), (5, 39)], 'h')
        p.box((28, 40, 28, 40), 'v')
        return p
    dx, bob, st = POSE[n]
    x, y = dx, bob
    butt, head, hand = AXE.get(n, AXE['idle'])
    # ---- legs: greaves, knee cops, sabatons on the floor
    bf, ff = (16, 28) if st else (18, 26)
    for top, foot, far in [((21, 33), bf, True), ((26, 33), ff, False)]:
        c = 'd' if far else 's'
        p.poly([(top[0] - 2, top[1]), (top[0] + 2, top[1]), (foot + 2, 41), (foot - 1, 41)], c, 'o')
        kx, ky = (top[0] + foot) // 2, 37
        p.box((kx - 1, ky - 1, kx + 1, ky), 'b' if not far else 's'); p.box((kx, ky - 1, kx, ky - 1), 'l')
        p.poly([(foot - 2, 41), (foot + 3, 41), (foot + 5, 44), (foot - 2, 44)], c, 'o')
        if not far: p.line([(foot - 1, 42), (foot + 3, 42)], 'b')
    # ---- tassets
    p.poly([(18 + x // 2, 30), (30 + x // 2, 30), (31 + x // 2, 34), (17 + x // 2, 34)], 's', 'o')
    p.line([(19 + x // 2, 31), (29 + x // 2, 31)], 'b'); p.box((24 + x // 2, 31, 24 + x // 2, 34), 'k')
    # ---- far arm: pauldron + void elbow
    p.line([(28 + x, 22 + y), (hand[0] + 4 + x, hand[1] + 1 + y)], 'o', 4)
    p.line([(28 + x, 22 + y), (hand[0] + 4 + x, hand[1] + 1 + y)], 'd', 2)
    # ---- cuirass
    p.poly([(18 + x, 20 + y), (29 + x, 20 + y), (31 + x, 24 + y), (29 + x, 30), (19 + x, 30), (17 + x, 24 + y)], 'b', 'o')
    p.poly([(19 + x, 21 + y), (24 + x, 21 + y), (20 + x, 26 + y)], 'l')
    p.line([(20 + x, 22 + y), (22 + x, 21 + y)], 'h')
    p.line([(24 + x, 21 + y), (24 + x, 29)], 's')
    p.line([(30 + x, 24 + y), (28 + x, 29)], 'd')
    p.line([(18 + x, 27), (29 + x, 27)], 's')
    p.line([(25 + x, 22 + y), (26 + x, 24 + y), (25 + x, 26 + y)], 'k'); p.box((26 + x, 23 + y, 26 + x, 23 + y), 'p')
    p.line([(22 + x, 28), (23 + x, 29)], 'v')
    # ---- gorget gap glows violet
    p.box((21 + x, 18 + y, 28 + x, 20 + y), 'k'); p.line([(22 + x, 19 + y), (27 + x, 19 + y)], 'v')
    # ---- helm: great helm, visor slit with violet light
    hx, hy = 20 + x + (1 if n == 'attack' else 0), 9 + y + (1 if n == 'hit' else 0)
    p.poly([(hx + 1, hy + 2), (hx + 3, hy), (hx + 8, hy), (hx + 10, hy + 2), (hx + 11, hy + 9), (hx + 9, hy + 10), (hx + 1, hy + 10), (hx, hy + 8)], 'b', 'o')
    p.poly([(hx + 2, hy + 2), (hx + 5, hy + 1), (hx + 3, hy + 5)], 'l'); p.box((hx + 3, hy + 1, hx + 4, hy + 1), 'h')
    p.line([(hx + 10, hy + 3), (hx + 10, hy + 8)], 's')
    p.box((hx + 5, hy + 4, hx + 11, hy + 5), 'k')
    lit = 'p' if n != 'hit' else 'v'
    p.box((hx + 8, hy + 4, hx + 10, hy + 4), lit)
    if n in ('windup', 'attack'): p.box((hx + 9, hy + 4, hx + 9, hy + 5), 'q')
    p.line([(hx + 7, hy + 7), (hx + 7, hy + 9)], 'k'); p.line([(hx + 9, hy + 7), (hx + 9, hy + 9)], 'k')
    p.line([(hx + 4, hy - 1), (hx + 1, hy - 3), (hx - 2, hy - 2)], 'v', 1)  # tattered plume
    # ---- great axe (behind the near arm)
    B, H = (butt[0] + x, butt[1] + y), (head[0] + x, head[1] + y)
    p.line([B, H], 'o', 3); p.line([B, H], 'w'); 
    axe_head(p, H[0], H[1], B[0], B[1])
    # ---- near arm: pauldron, void elbow, gauntlet on the haft
    sx, sy = 19 + x, 22 + y
    hnd = (hand[0] + x, hand[1] + y)
    elbow = ((sx + hnd[0]) // 2 - 1, (sy + hnd[1]) // 2 + 1)
    p.line([(sx, sy + 2), elbow, hnd], 'o', 4); p.line([(sx, sy + 2), elbow], 's', 2); p.line([elbow, hnd], 'b', 2)
    p.box((elbow[0], elbow[1], elbow[0], elbow[1]), 'p')
    p.box((hnd[0] - 1, hnd[1] - 1, hnd[0] + 1, hnd[1] + 1), 'o'); p.box((hnd[0] - 1, hnd[1] - 1, hnd[0], hnd[1]), 'l')
    p.poly([(sx - 3, sy + 3), (sx - 2, sy), (sx + 3, sy - 1), (sx + 5, sy + 1), (sx + 4, sy + 4), (sx - 2, sy + 5)], 'b', 'o')
    p.line([(sx - 1, sy + 1), (sx + 2, sy)], 'h')
    if n == 'attack':
        p.line([(37, 22), (43, 28)], 'l'); p.line([(40, 19), (45, 24)], 'h')
        p.line([(33, 44), (42, 44)], 'l')
    if n == 'hit':
        p.grid(hx + 12, hy + 1, ['q.', '.p', 'p.'])
    return p


if __name__ == '__main__':
    build('armor-living', CELL, PAL, draw)
    review('armor-living', CELL)

