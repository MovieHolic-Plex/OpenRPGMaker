"""Original viper, 48px: green scales with dark diamond saddles, pale belly, wedge head.
Idle rests in a ground coil with the neck in an S; windup pulls the head back tight;
attack uncoils and strikes forward with the jaws open and fangs out (dash)."""
import math
import sys
sys.dont_write_bytecode = True
from beast_lib import Pen, run, blob, tube, dot, ipt, settle
CELL = 48
G = 44
PAL = dict(o='14220f', m='263f1a', s='3b6428', b='5f9a3a', l='8cc257', h='c2e38a',
           y='e2d98e', k='1e2a14', e='f2c43c', r='c43a3f', w='f6f1de', d='8f8a6a')


def catmull(pts, per=8):
    out = []
    P = [pts[0]] + list(pts) + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(per):
            t = s / per
            out.append(tuple(0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t
                                    + (-a + 3 * b - 3 * c + d) * t ** 3) for a, b, c, d in zip(p0, p1, p2, p3)))
    out.append(tuple(pts[-1]))
    return out


# body keypoints tail -> neck (x, y); head angle (deg, 0 = right, + = up), jaw open
POSE = {
    'idle_a':  ([(30, 43), (14, 43), (8, 40), (13, 36), (26, 37), (31, 40), (25, 41), (19, 38),
                 (20, 30), (24, 26), (28, 25)], 8, 0),
    'idle_b':  ([(30, 43), (14, 43), (8, 40), (13, 36), (26, 37), (31, 40), (25, 41), (19, 38),
                 (20, 31), (24, 27), (28, 26)], 4, 0),
    'idle_c':  ([(30, 43), (14, 43), (8, 40), (13, 36), (26, 37), (31, 40), (25, 41), (19, 38),
                 (20, 32), (25, 28), (29, 28)], 0, 0),
    'windup':  ([(31, 43), (14, 43), (8, 40), (13, 36), (26, 37), (29, 40), (23, 41), (17, 37),
                 (22, 32), (15, 27), (17, 22), (21, 20)], 18, 1),
    'move':    ([(3, 42), (9, 40), (15, 43), (21, 40), (26, 42), (30, 38), (28, 32), (30, 28), (33, 27)], 4, 0),
    'attack':  ([(8, 43), (4, 40), (10, 37), (18, 39), (24, 41), (29, 37), (32, 33), (35, 31)], 14, 2),
    'recover': ([(30, 43), (14, 43), (8, 40), (13, 36), (26, 37), (31, 40), (25, 41), (20, 37),
                 (22, 30), (26, 27), (30, 27)], 2, 1),
    'hit':     ([(31, 43), (14, 43), (8, 40), (13, 36), (26, 37), (30, 40), (24, 41), (19, 37),
                 (18, 30), (15, 25), (13, 23)], 128, 1),
}


def body(p, pts):
    """Tube drawn tail -> neck in overlapping chunks so a coil passing in front gets its
    own outline, while the seam between consecutive chunks is refilled (no bead rings)."""
    path = catmull(pts, 7)
    n = len(path)
    k0 = n * 0.35
    rad = [0.6 + 2.2 * (i / k0) if i < k0 else 2.8 - 0.6 * (i - k0) / (n - k0) for i in range(n)]
    CH = 7

    def shade(i):
        x, y = path[i]
        j0, j1 = max(0, i - 1), min(n - 1, i + 1)
        tx, ty = path[j1][0] - path[j0][0], path[j1][1] - path[j0][1]
        ln = math.hypot(tx, ty) or 1
        nx, ny = ty / ln, -tx / ln
        if ny > 0 or (ny == 0 and nx > 0):
            nx, ny = -nx, -ny                    # normal toward the back (up / light)
        r = rad[i]
        if r > 1.6:
            dot(p, x + nx * (r - 1.1) - 0.4, y + ny * (r - 1.1) - 0.3, 'l')
            dot(p, x - nx * (r - 0.8), y - ny * (r - 0.8), 'y')
        if i % 7 == 3 and r > 1.6:               # dark diamond saddle on the back
            cx, cy = x + nx * 0.5, y + ny * 0.5
            for ox, oy in ((1, 0), (-1, 0), (0, -1), (0, 1)):
                dot(p, cx + ox, cy + oy, 'm')
            dot(p, cx, cy, 'k')

    for c in range(0, n - 1, CH):
        lo, hi = max(0, c - 2), min(n, c + CH + 1)
        tube(p, [(x, y, r) for (x, y), r in zip(path[c:hi], rad[c:hi])], 'b', 'o', 's', None)
        tube(p, [(x, y, r) for (x, y), r in zip(path[lo:hi], rad[lo:hi])], 'b', None, 's', None)
        for i in range(lo, hi):
            shade(i)
    return path


def head(p, neck, ang, jaw, n):
    """Viper head in a local frame (u forward, v down): wide jaw-hinge bulge behind a
    narrower snout, brow ridge over the eye. jaw 0 closed, 1 parted, 2 gaping with fangs."""
    a = math.radians(ang)
    ux, uy = math.cos(a), -math.sin(a)
    vx, vy = -uy, ux
    if vy < 0:
        vx, vy = -vx, -vy

    def L(u, v):
        return ipt((neck[0] + ux * u + vx * v, neck[1] + uy * u + vy * v))
    drop = [0, 2.5, 5.5][jaw]      # lower jaw rotates down about the hinge
    if jaw:
        lower = [L(1, 1), L(4, 2.5), L(9, 2 + drop), L(8, 3.5 + drop), L(3, 4)]
        p.poly(lower, 'b', 'o')
        p.line([L(3, 3.3), L(8, 2.8 + drop)], 'y')
        p.poly([L(3, 1.5), L(9, 1.2), L(8.5, 1.5 + drop * 0.8), L(4, 2.6)], 'r')
    upper = [L(-1, -2), L(3, -3.5), L(7, -3), L(10, -1.5), L(10.5, 0.5), L(8, 1.5), L(3, 2.5), L(0, 2)]
    p.poly(upper, 'b', 'o')
    p.poly([L(0, -1.5), L(3, -2.8), L(7, -2.3), L(9, -1), L(4, -0.8)], 'l')
    p.line([L(2, -2.6), L(7, -2.1)], 'h')
    if not jaw:
        p.line([L(3, 1.5), L(9.5, 0.5)], 'o')
    else:
        for u in (7.5, 9):
            p.line([L(u, 1.3), L(u - 0.3, 1.3 + drop * 0.45)], 'w')
    p.line([L(1, -0.3), L(5, -0.8)], 'm')   # dark eye stripe
    ex, ey = L(6, -1.2)
    if n == 'hit':
        p.line([(ex - 1, ey - 1), (ex + 1, ey + 1)], 'o')
    else:
        dot(p, ex, ey, 'e'); dot(p, ex + (1 if ux > 0 else -1), ey, 'o')
    dot(p, *L(10, -0.8), 'o')  # nostril
    if n == 'idle_b':  # forked tongue flick
        t0, t1 = L(10.5, 0.5), L(13.5, 0.5)
        p.line([t0, t1], 'r')
        dot(p, *L(14.5, -0.5), 'r'); dot(p, *L(14.5, 1.5), 'r')


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # limp and belly-up: pale underside on top, head flopped sideways with an X eye
        path = catmull([(4, 43), (12, 41), (20, 43), (29, 42), (36, 43)], 8)
        seg = [(x, y, 2.0) for x, y in path]
        tube(p, seg, 'y', 'o', 'd', None)
        for i, (x, y) in enumerate(path):
            if i % 5 == 2:
                p.line([ipt((x, y - 1)), ipt((x, y + 1))], 'd')
        blob(p, 40, 42, 4.5, 2.6, 10)
        p.line([(39, 40), (41, 42)], 'o'); p.line([(41, 40), (39, 42)], 'o')
        p.line([(44, 43), (46, 44)], 'r')
        settle(p, G)
        return p
    pts, ang, jaw = POSE[n]
    path = body(p, pts)
    head(p, path[-1], ang, jaw, n)
    if n == 'attack':
        for x, y in [(2, 42), (5, 40), (3, 39)]:
            p.box((x, y, x + 1, y + 1), 'd')
    if n == 'move':
        for x, y in [(1, 40), (2, 43)]:
            dot(p, x, y, 'd')
    settle(p, G)
    return p


if __name__ == '__main__':
    run('snake-viper', CELL, PAL, draw)

