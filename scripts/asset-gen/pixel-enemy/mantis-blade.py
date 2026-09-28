"""Original blade mantis, 48px: lime body, long raised prothorax, triangular head with big
eyes, two scythe forelegs held folded like a praying mantis. windup rears up and flares the
pink inner wings with both blades raised; attack lunges and crosses the blades in an X."""
import math
import sys
sys.dont_write_bytecode = True
from beast_lib import Pen, run, blob, mass, tube, bez, dot, ipt, polar, settle
CELL = 48
G = 44
PAL = dict(o='1a2814', m='34521f', s='4f7d2b', b='7db643', l='a9d85e', h='d9f2a2',
           c='f6fae4', e='e8d44c', p='c7607f', q='8a3b58', d='a39a7a')
FAR = {'b': 's', 'l': 's', 's': 'm', 'h': 's', 'c': 'l'}

# P pivot (thorax/abdomen join), N neck, abdomen tilt, near (elbow, tip), far (elbow, tip),
# wing mode, leg set. Screen coordinates on the 48px grid, facing right.
POSE = {
    'idle_a':  ((20, 35), (27, 21), -6, ((34, 25), (31, 34)), ((33, 24), (32, 32)), 'fold', 0),
    'idle_b':  ((20, 35), (27, 22), -6, ((34, 26), (31, 35)), ((33, 25), (32, 33)), 'fold', 0),
    'idle_c':  ((20, 36), (27, 23), -5, ((34, 27), (31, 36)), ((33, 26), (32, 34)), 'fold', 0),
    'windup':  ((19, 35), (23, 22), -14, ((19, 12), (28, 7)), ((17, 13), (25, 5)), 'flare', 1),
    'move':    ((21, 36), (30, 25), -2, ((37, 29), (34, 37)), ((36, 28), (35, 35)), 'fold', 2),
    'attack':  ((24, 36), (33, 27), 0, ((39, 26), (46, 33)), ((39, 31), (45, 22)), 'half', 3),
    'recover': ((20, 35), (28, 22), -4, ((35, 24), (36, 32)), ((34, 23), (36, 30)), 'fold', 0),
    'hit':     ((17, 35), (19, 23), -12, ((24, 20), (30, 25)), ((23, 22), (28, 29)), 'half', 1),
}
LEGS = {  # middle (knee dx, foot dx), hind (knee dx, foot dx) from pivot
    0: ((4, 7), (-6, -10)), 1: ((3, 6), (-8, -13)), 2: ((6, 11), (-4, -7)), 3: ((7, 10), (-8, -14)),
}


def blade(p, e, t, far):
    """Scythe tibia from the elbow to the tip: thick at the joint, tapering, bowed outward,
    with a pale cutting edge and a dark hooked point."""
    k = (lambda c: FAR.get(c, c)) if far else (lambda c: c)
    dx, dy = t[0] - e[0], t[1] - e[1]
    ln = math.hypot(dx, dy) or 1
    nx, ny = -dy / ln, dx / ln
    mid = (e[0] + dx * 0.5 + nx * 2, e[1] + dy * 0.5 + ny * 2)
    seg = bez([e, mid, t], 18)
    tube(p, [(x, y, 1.6 * (1 - i / 18) + 0.1) for i, (x, y) in enumerate(seg)], k('b'), 'o', k('s'))
    for x, y in seg[2:15]:
        dot(p, x - nx, y - ny, k('c'))
    hook = (t[0] - nx * 2 - dx / ln, t[1] - ny * 2 - dy / ln)
    p.line([ipt(t), ipt(hook)], 'o')


def foreleg(p, s, e, t, far):
    k = (lambda c: FAR.get(c, c)) if far else (lambda c: c)
    tube(p, bez([(s[0], s[1], 1.2), (e[0], e[1], 1.5)]), k('l') if not far else k('b'), 'o', k('s'))
    for f in (0.4, 0.7):  # spines on the femur
        x, y = s[0] + (e[0] - s[0]) * f, s[1] + (e[1] - s[1]) * f
        dot(p, x + 1, y + 2, 'o')
    blade(p, e, t, far)
    dot(p, *e, k('h'))


def legs(p, P, lset, far):
    o = 1 if far else 0
    for (knee, foot), rise in zip(LEGS[lset], (5, 6)):
        hip = (P[0] + o + (1 if knee > 0 else -1), P[1] + 1 - o)
        kn = (P[0] + knee + o, P[1] - rise + 3 - o)
        ft = (P[0] + foot + o, G - o)
        p.line([ipt(hip), ipt(kn), ipt(ft)], 'm' if far else 'o')
        if not far:
            p.line([ipt((kn[0], kn[1] + 1)), ipt((ft[0], ft[1] - 2))], 's')
            dot(p, *kn, 'b')


def abdomen(p, P, tilt):
    a = math.radians(tilt)
    cx, cy = P[0] - 8 * math.cos(a), P[1] + 8 * math.sin(a) * -1 + 0.5
    mass(p, [(cx, cy, 9, 3.4, tilt), (P[0] - 1, P[1], 2.8, 2.6, 0)], light_c=(cx, cy - 2), light_r=8)
    for i in range(1, 5):
        x, y = cx - 6 + i * 3, cy + (6 - i * 3) * math.sin(a) + 1
        p.line([ipt((x, y)), ipt((x, y + 2))], 's')
    return cx, cy


def wings(p, P, cx, cy, tilt, mode):
    if mode == 'flare':
        base = (P[0] - 2, P[1] - 3)
        fan = [base, polar(*base, 160, 11), polar(*base, 135, 15), polar(*base, 108, 15), polar(*base, 88, 9)]
        p.poly([ipt(q) for q in fan], 'q', 'o')
        p.poly([ipt(q) for q in [base, polar(*base, 150, 9), polar(*base, 128, 12), polar(*base, 106, 11)]], 'p')
        for a in (150, 128, 108):
            p.line([ipt(base), ipt(polar(*base, a, 13))], 'q')
        return
    lift = 2 if mode == 'half' else 0
    a = math.radians(tilt)
    back = (cx - 9 * math.cos(a), cy - 9 * math.sin(a) * -1 - 2 - lift)
    top = [(P[0] - 1, P[1] - 3), ((P[0] + back[0]) / 2, min(P[1], back[1]) - 3 - lift), back,
           (back[0] + 2, back[1] + 2), (P[0] - 3, P[1] - 1)]
    p.poly([ipt(q) for q in top], 'l', 'o')
    p.line([ipt((P[0] - 3, P[1] - 2)), ipt((back[0] + 2, back[1] + 1))], 's')
    p.line([ipt((P[0] - 3, P[1] - 3)), ipt(((P[0] + back[0]) / 2, min(P[1], back[1]) - 2 - lift))], 'h')


def head(p, N, n):
    hx, hy = N[0] + 3, N[1] - 3
    for dx, a in ((-1, 125), (1, 110)):
        base = (hx + dx, hy - 2)
        p.line([ipt(base), ipt(polar(*base, a, 6)), ipt(polar(*base, a - 30, 11))], 'o')
    tri = [(hx - 3, hy - 1), (hx - 1, hy - 3), (hx + 4, hy - 3), (hx + 5, hy - 1), (hx + 2, hy + 4), (hx, hy + 2)]
    p.poly(tri, 'b', 'o')
    p.line([(hx - 2, hy - 1), (hx, hy - 2)], 'h')
    ex, ey = hx + 3, hy - 2
    p.box((ex, ey, ex + 1, ey + 1), 'e')
    if n == 'hit':
        p.line([(ex, ey), (ex + 1, ey + 1)], 'o')
    else:
        dot(p, ex + 1, ey + 1, 'o')
    dot(p, hx + 2, hy + 4, 'o')


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # fallen flat on its side: abdomen on the ground, wings splayed, blades limp, legs up
        mass(p, [(15, 41, 9, 2.8, 2), (24, 41, 3, 2.2, 0)], light_c=(15, 39), light_r=9)
        p.poly([(22, 38), (14, 36), (6, 38), (8, 40), (20, 40)], 'l', 'o')
        p.line([(20, 38), (9, 38)], 's')
        tube(p, bez([(26, 41, 1.2), (33, 41, 1.0)]), 'b', 'o', 's')
        p.poly([(33, 38), (37, 38), (39, 40), (36, 43), (33, 41)], 'b', 'o')
        p.line([(35, 39), (37, 41)], 'o'); p.line([(37, 39), (35, 41)], 'o')
        blade(p, (31, 41), (39, 43), False)
        blade(p, (29, 39), (36, 36), True)
        for x in (15, 19, 23):
            p.line([(x, 39), (x + 1, 35), (x + 3, 34)], 'o')
        settle(p, G)
        return p
    P, N, tilt, (ne, nt), (fe, ft), wmode, lset = POSE[n]
    S = (P[0] + (N[0] - P[0]) * 0.5, P[1] + (N[1] - P[1]) * 0.5)
    legs(p, P, lset, True)
    if wmode == 'flare':
        wings(p, P, 0, 0, tilt, wmode)
    foreleg(p, (S[0] + 1, S[1] - 1), fe, ft, True)
    cx, cy = abdomen(p, P, tilt)
    if wmode != 'flare':
        wings(p, P, cx, cy, tilt, wmode)
    legs(p, P, lset, False)
    # slim prothorax from the pivot up to the neck
    tube(p, bez([(P[0], P[1], 2.0), (S[0], S[1], 1.3), (N[0], N[1], 1.1)]), 'b', 'o', 's')
    p.line([ipt((P[0] - 1, P[1] - 2)), ipt((N[0] - 1, N[1] + 1))], 'l')
    head(p, N, n)
    foreleg(p, S, ne, nt, False)
    if n == 'attack':
        # crossing slash streaks just ahead of the X
        for a, b in (((40, 20), (46, 27)), ((40, 35), (46, 29))):
            p.line([a, b], 'c')
        for x, y in [(4, 42), (7, 40), (2, 40)]:
            p.box((x, y, x + 1, y + 1), 'd')
    if n == 'move':
        for x, y in [(6, 42), (9, 41)]:
            p.box((x, y, x + 1, y + 1), 'd')
    settle(p, G)
    return p


if __name__ == '__main__':
    run('mantis-blade', CELL, PAL, draw)

