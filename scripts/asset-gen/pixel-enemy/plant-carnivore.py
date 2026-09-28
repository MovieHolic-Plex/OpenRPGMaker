"""Original carnivorous plant, 64px: a big-mouthed flower-bud head on a thick stalk, rooted
in a leafy clump; two vines. It never leaves its spot: windup coils the stalk back and
raises a vine, attack whips the stalk forward so the gaping head bites at full reach while
a vine lashes out (stomp slot, performed as a vine whip)."""
import math
import sys
sys.dont_write_bytecode = True
from beast_lib import Pen, run, blob, mass, tube, bez, dot, ipt, settle
CELL = 64
G = 60
PAL = dict(o='141e12', k='22361c', s='2f5a26', b='4d8a34', l='7dbb4a', h='b9e07c',
           m='5a1e3a', r='9c2c4a', p='d05a74', q='f09aa4', t='f4ecd0', y='f2d45a', d='6b5a3c', u='3a2c1e')

# stalk control points from the base (x, y); head angle (0 = right), jaw gape deg,
# vine A (back) end, vine B (front) end, leaf droop
POSE = {
    'idle_a':  ([(22, 52), (20, 42), (25, 34), (30, 30)], 12, 16, (9, 44), (38, 50), 0),
    'idle_b':  ([(22, 52), (20, 42), (25, 35), (30, 31)], 8, 12, (8, 45), (39, 51), 1),
    'idle_c':  ([(22, 52), (21, 43), (25, 36), (30, 32)], 4, 22, (9, 46), (38, 51), 0),
    'windup':  ([(22, 52), (28, 42), (19, 34), (14, 29)], 62, 44, (5, 22), (32, 46), 1),
    'move':    ([(22, 52), (22, 42), (28, 36), (33, 33)], 2, 28, (10, 42), (42, 48), 0),
    'attack':  ([(22, 52), (16, 42), (30, 34), (38, 32)], 0, 62, (14, 30), (61, 47), 0),
    'recover': ([(22, 52), (21, 42), (26, 34), (30, 29)], 20, 8, (9, 42), (37, 49), 1),
    'hit':     ([(22, 52), (26, 43), (19, 37), (15, 33)], 130, 36, (6, 47), (33, 53), 2),
}


def stalk(p, pts):
    seg = bez(pts, 34)
    tube(p, [(x, y, 3.6 - 1.4 * i / 33) for i, (x, y) in enumerate(seg)], 'b', 'o', 's', 'l')
    for i in range(6, 30, 7):  # node rings
        x, y = seg[i]
        dot(p, x + 1, y, 'k'); dot(p, x + 2, y, 'k')
    return seg


def vine(p, base, end, curl, thorny=True):
    mid = ((base[0] + end[0]) / 2 + curl[0], (base[1] + end[1]) / 2 + curl[1])
    seg = bez([base, mid, end], 30)
    tube(p, [(x, y, 1.6 - 1.0 * i / 29) for i, (x, y) in enumerate(seg)], 's', 'o', 'k')
    for i in range(3, 27, 3):
        x, y = seg[i]
        dot(p, x - 0.5, y - 0.8, 'b')
    if thorny:
        for i in range(5, 28, 6):
            x, y = seg[i]
            dot(p, x, y - 2, 'y')
    # curled tip
    ex, ey = seg[-1]
    p.line([ipt((ex, ey)), ipt((ex + 1, ey - 2)), ipt((ex - 1, ey - 3))], 'o')
    return seg


def leaves(p, droop):
    """Rooted clump of broad leaves and a dirt mound around the stalk base."""
    blob(p, 22, 59, 12, 2.5, 0, keys={'l': 'd', 'b': 'u', 's': 'u'})
    for base, tip, w in (((20, 56), (6, 51 + droop), 4.5), ((24, 56), (38, 52 + droop), 4.5),
                         ((21, 57), (10, 58), 3), ((24, 57), (35, 58), 3)):
        mx, my = (base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2 - 2
        pts = bez([base, (mx, my - w), tip], 10) + bez([tip, (mx, my + w * 0.6), base], 10)[1:]
        p.poly([ipt(q) for q in pts], 'b', 'o')
        p.line([ipt(base), ipt(((base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2 - 2)), ipt(tip)], 's')
        hi = bez([base, (mx, my - w * 0.8), tip], 10)
        for x, y in hi[2:7]:
            dot(p, x, y + 1, 'l')


def head(p, neck, ang, gape, n):
    """Big bud head: two fleshy jaw lobes hinged at the neck. Each lobe is drawn in a
    local frame rotated +-gape/2 from the head axis, lined with pale teeth; the pink
    throat shows between them. Rind speckled, lit from the upper left."""
    def frame(deg):
        a = math.radians(deg)
        ux, uy = math.cos(a), -math.sin(a)
        nx, ny = -uy, ux  # 90 deg clockwise on screen = 'down' when facing right
        return lambda u, v: (neck[0] + ux * u + nx * v, neck[1] + uy * u + ny * v)
    S = 1.25
    lobe = [(0, 0), (3, -4), (8, -7), (13, -7), (17, -5), (19, -2), (18, 0)]
    teeth_u = (6, 9.5, 13, 16)
    Lt, Lb = frame(ang + gape / 2), frame(ang - gape / 2)
    top = [Lt(u * S, v * S) for u, v in lobe]
    bot = [Lb(u * S, -v * S) for u, v in lobe]
    if gape > 6:
        F = frame(ang)
        throat = [top[0]] + top[-3:] [::-1][:1] + [F(15 * S, 0)] + [bot[-2]] + [bot[0]]
        p.poly([ipt(q) for q in [top[0], top[5], F(12 * S, 0), bot[5], bot[0]]], 'm')
        p.poly([ipt(q) for q in [F(2, 0), Lt(10 * S, -1), F(10 * S, 0), Lb(10 * S, 1)]], 'r')
    p.poly([ipt(q) for q in bot], 'r', 'o')
    p.poly([ipt(q) for q in top], 'r', 'o')
    # rind light on the upper lobe, shade on the lower
    p.line([ipt(Lt(4 * S, -3.5 * S)), ipt(Lt(9 * S, -5.5 * S)), ipt(Lt(14 * S, -5.5 * S))], 'p')
    dot(p, *Lt(6 * S, -4 * S), 'q'); dot(p, *Lt(8 * S, -4.5 * S), 'q')
    p.line([ipt(Lb(6 * S, 4 * S)), ipt(Lb(13 * S, 5 * S))], 'm')
    for u, v in ((10, -3.5), (15, -3)):
        dot(p, *Lt(u * S, v * S), 'y')
    # teeth: short pale spikes on the inner edge of each lobe, pointing across the mouth
    for u in teeth_u:
        for L, sgn in ((Lt, 1), (Lb, -1)):
            dot(p, *L(u * S, -0.2 * sgn), 't')
            dot(p, *L(u * S, 1.2 * sgn), 't')
    # sepals cupping the bud at the neck
    for L, sgn in ((Lt, -1), (Lb, 1)):
        p.poly([ipt(L(-2, 0)), ipt(L(4, 3.5 * sgn)), ipt(L(1, 0.5 * sgn))], 'b', 'o')
    if n == 'hit':
        for q in (Lt(8, -11), Lt(12, -12)):
            dot(p, *q, 'y')
    if n == 'attack' and gape > 30:
        q = bot[4]
        p.line([ipt(q), ipt((q[0], q[1] + 3))], 'q')


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # wilted: stalk collapsed along the ground, head shut and drooping, leaves limp
        leaves(p, 3)
        vine(p, (18, 56), (4, 58), (0, 1), False)
        seg = bez([(22, 55), (28, 50), (35, 51), (40, 55)], 30)
        tube(p, [(x, y, 3.0 - 1.0 * i / 29) for i, (x, y) in enumerate(seg)], 's', 'o', 'k')
        head(p, (40, 55), -35, 0, n)
        for x, y in [(44, 50), (48, 52)]:
            dot(p, x, y, 'd')
        settle(p, G)
        return p
    pts, ang, gape, va, vb, droop = POSE[n]
    base = pts[0]
    vine(p, (base[0] - 2, base[1] - 3), va, (-3, -6) if n != 'windup' else (-6, 4))
    leaves(p, droop)
    seg = stalk(p, pts)
    # a leaf on the stalk
    lb = seg[12]
    side = -1 if n not in ('windup', 'hit') else 1
    lt = (lb[0] + 8 * side, lb[1] - 2)
    lp = bez([lb, ((lb[0] + lt[0]) / 2, lb[1] - 4), lt], 8) + bez([lt, ((lb[0] + lt[0]) / 2, lb[1] + 1), lb], 8)[1:]
    p.poly([ipt(q) for q in lp], 'b', 'o')
    p.line([ipt(lb), ipt(lt)], 's')
    head(p, seg[-1], ang, gape, n)
    vine(p, (base[0] + 3, base[1] - 4), vb, (4, -8) if n != 'attack' else (-2, 8))
    if n == 'attack':
        ex, ey = vb
        for dx, dy in ((2, -3), (3, 0), (1, -5)):
            dot(p, ex + dx, ey + dy, 't')
        for x, y in [(55, 58), (58, 57), (52, 59)]:
            p.box((x, y, x + 1, y + 1), 'd')
    settle(p, G)
    return p


if __name__ == '__main__':
    run('plant-carnivore', CELL, PAL, draw)

