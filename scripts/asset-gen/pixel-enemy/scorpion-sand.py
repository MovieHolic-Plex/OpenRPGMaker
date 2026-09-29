"""Original sand scorpion, 48px: flat sand carapace, two heavy pincers, a segmented tail
arched over the back. Attack whips the stinger over the head to stab forward (dash)."""
import math
import sys
sys.dont_write_bytecode = True
from beast_lib import Pen, run, blob, mass, tube, bez, dot, ipt, settle
CELL = 48
G = 44
PAL = dict(o='2a1c10', m='5a4024', s='8a663a', b='b98f52', l='dab878', h='f2dea8',
           r='b0512c', k='3d2616', w='f6efdc', d='c9ae7d', e='e0402c')
FAR = {'l': 'b', 'b': 's', 's': 'm', 'h': 'b'}

# body (x, y), tail controls relative to body, claw (reach, lift, open), leg stride, body tilt
POSE = {
    'idle_a':  ((20, 37), [(-9, -2), (-16, -10), (-14, -23), (-3, -25), (1, -18)], (0, 0, 1), 0, 0),
    'idle_b':  ((20, 37), [(-9, -2), (-16, -10), (-14, -22), (-3, -24), (1, -17)], (0, 0, 2), 0, 0),
    'idle_c':  ((20, 38), [(-9, -2), (-16, -10), (-14, -22), (-3, -23), (0, -17)], (0, 1, 1), 0, 0),
    'windup':  ((20, 37), [(-9, -2), (-16, -8), (-17, -23), (-9, -28), (-4, -24)], (-2, -4, 3), 3, -6),
    'move':    ((20, 38), [(-9, -2), (-15, -9), (-13, -21), (-3, -22), (0, -16)], (1, 1, 1), 1, 0),
    'attack':  ((20, 37), [(-9, -2), (-14, -14), (-5, -28), (12, -25), (18, -14)], (2, -1, 4), 2, 4),
    'recover': ((20, 37), [(-9, -2), (-16, -11), (-12, -24), (0, -24), (3, -17)], (0, 0, 0), 0, 0),
    'hit':     ((20, 36), [(-9, -1), (-15, -4), (-18, -12), (-16, -21), (-11, -23)], (-2, -5, 2), 3, -10),
}
STRIDE = {  # foot dx per leg (back -> front); knees rise between hip and foot
    0: (-4, -2, 2, 4), 1: (-5, -3, 3, 5), 2: (-5, -1, 2, 5), 3: (-3, -1, 1, 3),
}


def rot(bx, by, x, y, tilt):
    """Rotate a point about the body centre by tilt degrees (+ = front dips)."""
    a = math.radians(tilt)
    dx, dy = x - bx, y - by
    return (bx + dx * math.cos(a) - dy * math.sin(a), by + dx * math.sin(a) + dy * math.cos(a))


def legs(p, bx, by, stride, far):
    """Four walking legs per side: hip under the carapace, knee kicked out and up, foot on
    the sand. Back pair angles backward, front pair forward."""
    for i, fx in enumerate(STRIDE[stride]):
        o = 1 if far else 0
        hx, hy = bx - 6 + i * 3 + o, by + 2 - o
        knee = (hx + fx * 0.7, by + 1 - o)
        foot = (hx + fx * 1.1 + o, G - o)
        if far:
            p.line([ipt((hx, hy)), ipt(knee), ipt(foot)], 'm')
            continue
        p.line([ipt((hx, hy)), ipt(knee)], 'k')
        p.line([ipt(knee), ipt(foot)], 'k')
        p.line([ipt((knee[0] + (1 if fx > 0 else -1), knee[1] + 1)), ipt((foot[0] + (1 if fx > 0 else -1), foot[1] - 1))], 's')
        dot(p, *knee, 'b')


def claw(p, sh, reach, lift, openg, far, tilt):
    """Arm (two segments) -> swollen palm -> fixed upper finger + movable lower finger.
    openg = gap between the fingers in px."""
    k = (lambda c: FAR.get(c, c)) if far else (lambda c: c)
    elbow = (sh[0] + 3 + reach * 0.3, sh[1] - 3 + lift * 0.5)
    wrist = (sh[0] + 6 + reach, sh[1] - 1 + lift)
    tube(p, bez([(sh[0], sh[1], 0.9), (elbow[0], elbow[1], 1.0), (wrist[0], wrist[1], 1.1)]), k('s'), 'o')
    hx, hy = wrist[0] + 3.5, wrist[1] - 0.5
    sz = 1.0 if not far else 0.85
    up = bez([(hx + 2, hy - 2), (hx + 6, hy - 3.5 - openg * 0.7), (hx + 8.5 * sz, hy - 0.5 - openg * 0.4)], 9)
    lo = bez([(hx + 2, hy + 1.5), (hx + 5.5, hy + 2 + openg * 0.3), (hx + 7 * sz, hy + 0.5 + openg * 0.2)], 8)
    tube(p, [(x, y, 1.3 * (1 - i / 9)) for i, (x, y) in enumerate(up)], k('b'), 'o', k('s'))
    tube(p, [(x, y, 1.0 * (1 - i / 8)) for i, (x, y) in enumerate(lo)], k('s'), 'o')
    dot(p, *up[-1], 'k'); dot(p, *lo[-1], 'k')
    blob(p, hx, hy, 4.2 * sz, 3.0 * sz, -10 + tilt, keys={} if not far else FAR)
    if not far:
        p.line([ipt((hx - 2, hy - 2)), ipt((hx + 1, hy - 2))], 'h')
        dot(p, hx + 3, hy - 3 - openg * 0.5, 'l')


def tail(p, bx, by, ctrl):
    """Thin segmented tube (outline + base + lit ridge) with ring notches, red telson, barb."""
    pts = [(bx + dx, by + dy) for dx, dy in ctrl]
    seg = bez(pts, 40)
    rad = [1.9 - 0.8 * i / 39 for i in range(40)]
    tube(p, [(x, y, r) for (x, y), r in zip(seg, rad)], 'b', 'o', 's', None)
    for (x, y), r in zip(seg, rad):  # lit ridge on the upper-left side of the curl
        dot(p, x - 0.6, y - 0.8, 'l')
    for i in range(4, 36, 5):  # ring notches across the tube
        (x0, y0), (x1, y1) = seg[i - 1], seg[i + 1]
        nx, ny = -(y1 - y0), (x1 - x0)
        ln = math.hypot(nx, ny) or 1
        for t in (-rad[i], rad[i]):
            dot(p, seg[i][0] + nx / ln * t, seg[i][1] + ny / ln * t, 'o')
        dot(p, seg[i][0], seg[i][1], 's')
    (x0, y0), (x1, y1) = seg[-5], seg[-1]
    ang = math.atan2(y1 - y0, x1 - x0)
    tel = (x1 + math.cos(ang) * 1.5, y1 + math.sin(ang) * 1.5)
    blob(p, tel[0], tel[1], 2.6, 2.0, math.degrees(ang), keys={'l': 'e', 'b': 'r', 's': 'k'})
    tip = (tel[0] + math.cos(ang + 0.8) * 4.5, tel[1] + math.sin(ang + 0.8) * 4.5)
    p.line([ipt((tel[0] + math.cos(ang) * 2, tel[1] + math.sin(ang) * 2)), ipt(tip)], 'k')
    dot(p, *tip, 'w')
    return tip


def body(p, bx, by, tilt, n):
    R = lambda x, y: rot(bx, by, x, y, tilt)
    parts = [(*R(bx - 2, by), 8, 3.9, tilt), (*R(bx + 6, by - 0.5), 5, 3.5, tilt), (*R(bx - 9, by - 1), 3, 2.8, tilt)]
    mass(p, parts, light_c=R(bx + 1, by - 2), light_r=8)
    for dx in (-7, -4, -1, 2):  # plate seams across the back
        x, y = R(bx + dx, by - 3)
        p.line([ipt((x, y)), ipt((x, y + 2))], 's')
    a, b = R(bx - 6, by - 3), R(bx + 7, by - 3.5)
    p.line([ipt(a), ipt(b)], 'h')
    p.line([ipt(R(bx - 8, by + 3)), ipt(R(bx + 8, by + 3))], 's')
    ex, ey = ipt(R(bx + 8, by - 2))
    if n == 'hit':
        p.line([(ex - 1, ey - 1), (ex + 1, ey)], 'o')
    else:
        dot(p, ex, ey, 'o'); dot(p, ex + 1, ey, 'e'); dot(p, ex - 2, ey, 'o')


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # flipped on its back: pale belly up, legs curled in the air, tail slack on the sand
        seg = bez([(12, 41), (6, 42), (3, 39), (4, 36)], 20)
        tube(p, [(x, y, 2.4 - 1.0 * i / 19) for i, (x, y) in enumerate(seg)], 'b', 'o', 's')
        blob(p, 5.5, 34.5, 2.3, 1.9, -30, keys={'l': 'r', 'b': 'r', 's': 'k'})
        for i, x in enumerate((15, 19, 23, 27)):
            p.line([(x, 39), (x + 1, 36 - i % 2), (x + 3, 37)], 'k')
        mass(p, [(20, 41, 8.5, 3, 0), (28, 41, 4.5, 2.6, 0)], light_c=(20, 39), light_r=8,
             keys={'l': 'h', 'b': 'd', 's': 's'})
        for x in (15, 18, 21, 24):
            p.line([(x, 40), (x, 42)], 's')
        tube(p, bez([(31, 42, 1.2), (35, 42, 1.3)]), 's', 'o', 'm')
        blob(p, 39, 42, 3.4, 2.2, 0, keys=FAR)
        p.line([(42, 41), (44, 40)], 'm')
        p.line([(27, 40), (29, 42)], 'o'); p.line([(29, 40), (27, 42)], 'o')
        settle(p, G)
        return p
    (bx, by), ctrl, (reach, lift, openg), stride, tilt = POSE[n]
    bx -= 2
    legs(p, bx, by, stride, True)
    claw(p, rot(bx, by, bx + 6, by - 2, tilt), reach - 2, lift - 4, openg, True, tilt)
    tip = tail(p, bx, by, ctrl)
    body(p, bx, by, tilt, n)
    legs(p, bx, by, stride, False)
    claw(p, rot(bx, by, bx + 8, by + 1, tilt), reach, lift + 2, openg, False, tilt)
    if n == 'attack':
        x, y = ipt(tip)
        for dx, dy, c in ((2, 1, 'w'), (1, 3, 'e'), (3, -1, 'w'), (-1, 2, 'e')):
            dot(p, x + dx, y + dy, c)
    if n in ('move', 'attack'):
        for x, y in [(4, 42), (7, 40), (2, 40)]:
            p.box((x, y, x + 1, y + 1), 'd')
    if n == 'windup':
        dot(p, tip[0] + 1, tip[1] - 1, 'w')
    settle(p, G)
    return p


if __name__ == '__main__':
    run('scorpion-sand', CELL, PAL, draw)

