"""monster2-3 마기사(붉은 뿔 갑옷 기사) 전투 도트 — 왼쪽(적 쪽)을 본다. 파티 motion: dash.

걷기 칩 Monster2 (3,0)의 붉은 뿔 갑옷·검은 판금·노란 눈빛을 48px 로 다시 찍었다.
검은 마검을 들고 달려들어 베는 물리 직업. 오른쪽 보기로 그린 뒤 pp_lib 가 좌우 반전한다.
(armor-living 의 관절 배치를 뼈대로 삼았다.)
"""
from pp_lib_b4 import Pen, build, clean

CELL = 48
PAL = dict(o='1a0c12', d='341820', s='7c1c26', b='b8303a', l='e85a52', h='ffa898', k='0d0b14',
           v='b07a14', p='f8c830', q='fff0a0', w='5a3a28', u='c8963a', g='646478', G='c4c8d8', x='2c2c3c')

POSE = {  # dx, bob, step, (hand, axe head angle-ish end)
    'idle_a': (0, 0, 0), 'idle_b': (0, 1, 0), 'idle_c': (0, 2, 0),
    'windup': (-2, 0, 0), 'move': (1, 1, 1), 'attack': (3, 2, 1), 'recover': (1, 2, 0), 'hit': (-3, 1, 0),
}
# haft endpoints (butt, head) and hand position per pose
AXE = {   # (pommel, tip, hand) per pose
    'idle': ((30, 41), (34, 12), (31, 29)),
    'windup': ((27, 32), (12, 6), (23, 24)),
    'move': ((31, 40), (37, 12), (32, 28)),
    'attack': ((19, 22), (41, 36), (26, 27)),
    'recover': ((22, 24), (37, 40), (26, 28)),
    'hit': ((32, 41), (38, 15), (32, 30)),
}


def sword(p, tip, hand):
    import math
    (tx, ty), (hx_, hy_) = tip, hand
    vx, vy = tx - hx_, ty - hy_
    L = math.hypot(vx, vy)
    ux, uy = vx / L, vy / L
    nx, ny = -uy, ux
    R = lambda a, b: (round(a), round(b))
    pom = R(hx_ - ux * 4, hy_ - uy * 4)
    gd = R(hx_ + ux * 3, hy_ + uy * 3)
    p.line([pom, gd], 'o', 3); p.line([pom, gd], 'w')
    p.box((pom[0], pom[1], pom[0], pom[1]), 'u')
    p.line([R(gd[0] - nx * 4, gd[1] - ny * 4), R(gd[0] + nx * 4, gd[1] + ny * 4)], 'o', 3)
    p.line([R(gd[0] - nx * 3, gd[1] - ny * 3), R(gd[0] + nx * 3, gd[1] + ny * 3)], 'u')
    s0 = R(gd[0] + ux * 2, gd[1] + uy * 2)
    p.line([s0, (tx, ty)], 'o', 5)
    p.line([s0, (tx, ty)], 'g', 3)
    p.line([R(s0[0] + nx, s0[1] + ny), R(tx + nx, ty + ny)], 'G')
    p.line([R(s0[0] - nx, s0[1] - ny), R(tx - nx * 0.5, ty - ny * 0.5)], 'x')
    p.line([R(s0[0] + ux * 4, s0[1] + uy * 4), R(tx - ux * 3, ty - uy * 3)], 's')


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
    hx, hy = 20 + x + (1 if n == 'attack' else 0), 10 + y + (1 if n == 'hit' else 0)
    p.poly([(hx + 1, hy + 2), (hx + 3, hy), (hx + 8, hy), (hx + 10, hy + 2), (hx + 11, hy + 9), (hx + 9, hy + 10), (hx + 1, hy + 10), (hx, hy + 8)], 'b', 'o')
    p.poly([(hx + 2, hy + 2), (hx + 5, hy + 1), (hx + 3, hy + 5)], 'l'); p.box((hx + 3, hy + 1, hx + 4, hy + 1), 'h')
    p.line([(hx + 10, hy + 3), (hx + 10, hy + 8)], 's')
    p.box((hx + 5, hy + 4, hx + 11, hy + 5), 'k')
    lit = 'p' if n != 'hit' else 'v'
    p.box((hx + 8, hy + 4, hx + 10, hy + 4), lit)
    if n in ('windup', 'attack'): p.box((hx + 9, hy + 4, hx + 9, hy + 5), 'q')
    p.line([(hx + 7, hy + 7), (hx + 7, hy + 9)], 'k'); p.line([(hx + 9, hy + 7), (hx + 9, hy + 9)], 'k')
    # curved demon horns (near + far) and a red helm crest
    p.poly([(hx + 1, hy + 3), (hx - 1, hy - 1), (hx - 3, hy - 5), (hx - 3, hy - 9), (hx - 1, hy - 6), (hx + 2, hy - 2), (hx + 4, hy + 1)], 'l', 'o')
    p.poly([(hx + 8, hy + 1), (hx + 11, hy - 2), (hx + 12, hy - 6), (hx + 11, hy - 9), (hx + 14, hy - 7), (hx + 14, hy - 2), (hx + 11, hy + 2)], 's', 'o')
    p.line([(hx + 12, hy - 2), (hx + 12, hy - 6)], 'b')
    p.line([(hx + 4, hy), (hx + 8, hy)], 'h')
    # ---- demon sword (behind the near arm)
    B, H = (butt[0] + x, butt[1] + y), (head[0] + x, head[1] + y)
    sword(p, H, (hand[0] + x, hand[1] + y))
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
        p.line([(31, 26), (37, 31)], 'h'); p.line([(34, 24), (40, 30)], 'q')
    return clean(p)


if __name__ == '__main__':
    build('monster2-3', CELL, PAL, draw)

