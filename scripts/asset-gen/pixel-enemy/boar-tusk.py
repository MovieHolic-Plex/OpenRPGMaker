"""Original tusked boar, 64px: bristled ridge, heavy shoulders, curved white tusks, low charge."""
import math
import sys
sys.dont_write_bytecode = True
from beast_lib import Pen, run, blob, tube, bez, dot, ipt
CELL = 64
G = 60  # ground row
PAL = dict(o='24160f', s='4d2e20', b='7a4a2f', l='a46b42', h='c99461', m='33211a',
           w='f3ead2', t='bfae86', n='c47e6d', e='f0bf45', d='a58b6b')


def ax(pt, ang, d, perp=0.0):
    a = math.radians(ang)
    return (pt[0] + math.cos(a) * d - math.sin(a) * perp, pt[1] + math.sin(a) * d + math.cos(a) * perp)


def leg(p, hip, knee, foot, far):
    base, shade = ('s', 'm') if far else ('b', 's')
    tube(p, bez([(hip[0], hip[1], 3.2), (knee[0], knee[1], 2.2), (foot[0], foot[1] - 3, 1.2)]), base, 'o', shade)
    x, y = ipt(foot)
    p.box((x - 2, y - 2, x + 1, y), 'o')
    dot(p, x - 1, y - 2, 'm')


# body centre, body tilt (deg, + = front down), head drop, head pitch, leg set
POSE = {
    'idle_a':  (30, 43, 4, 0, 22, 'stand'),
    'idle_b':  (30, 44, 4, 1, 24, 'stand'),
    'idle_c':  (30, 44, 5, 2, 27, 'stand'),
    'windup':  (25, 43, 8, 2, 26, 'brace'),
    'move':    (30, 45, 5, 2, 24, 'gallop'),
    'attack':  (33, 45, 6, 1, -14, 'lunge'),
    'recover': (28, 43, -2, 0, 12, 'stand'),
    'hit':     (27, 42, -11, -3, -8, 'hit'),
}

LEGS = {  # (far fore, far hind, near fore, near hind): (knee dx,dy from hip, foot x)
    'stand':  [((1, 7), 3), ((1, 7), -1), ((0, 7), -1), ((-1, 7), 1)],
    'brace':  [((3, 6), 7), ((-2, 5), -6), ((4, 6), 6), ((-3, 6), -8)],
    'gallop': [((5, 5), 8), ((-5, 4), -8), ((4, 6), 6), ((-4, 5), -7)],
    'lunge':  [((4, 6), 6), ((-4, 4), -8), ((5, 6), 7), ((-5, 4), -9)],
    'hit':    [((2, 6), 1), ((-1, 6), -3), ((3, 6), 2), ((0, 7), -1)],
}


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # slumped on its side: flat hide, drooped head on the dirt, stiff hooves
        for hip, foot in [((24, 53), (19, 58)), ((38, 53), (44, 58))]:
            tube(p, bez([(hip[0], hip[1], 2.5), (foot[0], foot[1], 1.2)]), 's', 'o', 'm')
        blob(p, 30, 53, 17, 6.5, 0)
        for i, x in enumerate(range(17, 42, 3)):
            p.poly([(x, 48), (x + 1, 45 - i % 2), (x + 3, 48)], 'm')
        blob(p, 49, 55, 7, 4.5, 15)
        blob(p, 55, 57, 2.2, 2.5, 0, keys={'l': 'n', 'b': 'n', 's': 'n'})
        p.line([(52, 55), (56, 50), (58, 49)], 'w', 1)
        p.line([(47, 53), (49, 55)], 'o'); p.line([(49, 53), (47, 55)], 'o')
        p.line([(14, 51), (12, 49)], 'o')
        return p
    bx, by, ang, drop, pitch, lset = POSE[n]
    body = (bx, by)
    rear_hip, fore_hip = ax(body, ang, -10, 4), ax(body, ang, 9, 5)
    legs = LEGS[lset]
    # far legs behind the body
    for (kd, fx), hip, far in [(legs[0], fore_hip, True), (legs[1], rear_hip, True)]:
        hx, hy = hip[0] + (1 if far else 0), hip[1]
        leg(p, (hx, hy), (hx + kd[0], hy + kd[1]), (hx + fx + 1, G), True)
    # tail: small whip curl off the rump
    rump = ax(body, ang, -16, -3)
    tube(p, bez([(rump[0], rump[1], 0.8), (rump[0] - 4, rump[1] - 3, 0.8), (rump[0] - 3, rump[1] + 3, 0.6)]), 's', 'o')
    # barrel body, lit top-left
    blob(p, bx, by, 16, 10, ang)
    belly = ax(body, ang, 0, 7)
    blob(p, belly[0], belly[1], 11, 2.5, ang, edge=None, keys={'l': 's', 'b': 's'})
    # near legs
    for (kd, fx), hip in [(legs[2], fore_hip), (legs[3], rear_hip)]:
        leg(p, hip, (hip[0] + kd[0], hip[1] + kd[1]), (hip[0] + fx, G), False)
    # bristled ridge from rump to nape, tallest over the shoulders
    for i in range(9):
        t = i / 8
        base = ax(body, ang, -13 + t * 24, -9.4 + 3.5 * math.sin(math.pi * t) * 0.3)
        hgt = 2 + round(3 * math.sin(math.pi * (0.25 + 0.75 * t)))
        tip = ax(base, ang - 35, -1, -hgt)
        p.poly([ipt(ax(base, ang, -2)), ipt(tip), ipt(ax(base, ang, 2))], 'm')
    # head: wedge carried low in front of the shoulders
    neck = ax(body, ang, 13, -1 + drop)
    hang = ang + pitch
    head = ax(neck, hang, 4)
    blob(p, head[0], head[1], 9, 7, hang)
    for k in range(-5, 6):
        dot(p, *ax(head, hang, -7 + abs(k) * 0.35, k), 's' if k > -3 else 'm')
    ear = ax(head, hang, -5, -6)
    p.poly([ipt(ax(ear, hang, -2)), ipt(ax(ear, hang - 30, -3, -4)), ipt(ax(ear, hang, 2))], 'm', 'o')
    snout = ax(head, hang, 9)
    blob(p, snout[0], snout[1], 2.4, 3.6, hang, keys={'l': 'h', 'b': 'n', 's': 'n'})
    dot(p, *ax(snout, hang, 1, -1), 'o'); dot(p, *ax(snout, hang, 1, 1.5), 'o')
    # jaw line and eye
    j0, j1 = ax(head, hang, 1, 4), ax(head, hang, 7, 3.5)
    p.line([ipt(j0), ipt(j1)], 's')
    eye = ax(head, hang, 1, -2)
    ex, ey = ipt(eye)
    if n == 'hit':
        p.line([(ex - 1, ey - 1), (ex + 1, ey), (ex - 1, ey + 1)], 'o')
    else:
        p.box((ex, ey, ex + 1, ey), 'e'); dot(p, ex + 1, ey, 'o')
        p.line([(ex - 1, ey - 2), (ex + 2, ey - 1)], 'o')  # angry brow
    # tusk: thick ivory hook from the mouth corner, curving forward and up
    root = ax(head, hang, 5, 3)
    lift = 8 if n != 'attack' else 6
    pts = bez([ax(root, hang, 0, 0), ax(root, hang, 5, 1), ax(root, hang, 6, -lift)], 14)
    for x, y in pts:
        for ox, oy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
            dot(p, x + ox, y + oy, 'o')
    for i, (x, y) in enumerate(pts):
        dot(p, x, y, 't' if i < 5 else 'w')
        if i < 8: dot(p, x, y + 0.9, 't')
    dot(p, *pts[-1], 'w')
    # lit fur strands on the shoulder
    for d0 in (-2, 3):
        a0 = ax(body, ang, d0, -5)
        p.line([ipt(a0), ipt(ax(a0, ang, 3, 1))], 'h')
    if n == 'move':
        for x, y in [(8, 57), (11, 55), (6, 54)]:
            p.box((x, y, x + 1, y + 1), 'd')
    if n == 'attack':
        for x, y in [(12, 58), (9, 56), (14, 55), (7, 58)]:
            p.box((x, y, x + 1, y + 1), 'd')
    return p


if __name__ == '__main__':
    run('boar-tusk', CELL, PAL, draw)
