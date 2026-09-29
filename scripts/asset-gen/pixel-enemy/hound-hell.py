"""Original hellhound, 64px: lean black hound, burning mane from nape to shoulders, red
eyes, glowing jaws. windup crouches with flames flaring; move gallops; attack leaps
forward with the jaws open and a gout of fire between the fangs (dash)."""
import math
import sys
sys.dont_write_bytecode = True
from beast_lib import Pen, run, blob, mass, tube, bez, dot, ipt, settle
CELL = 64
G = 60
PAL = dict(o='0c0a10', k='1c1822', s='2c2634', b='443c4e', l='66596e',
           r='a8201c', f='e0501e', y='f5a524', w='fde58a', e='ff4030', t='f1eadb', d='6a5a58')
FLAME = {'l': 'y', 'b': 'f', 's': 'r'}


def ax(pt, ang, d, perp=0.0):
    a = math.radians(ang)
    return (pt[0] + math.cos(a) * d - math.sin(a) * perp, pt[1] + math.sin(a) * d + math.cos(a) * perp)


def leg(p, hip, knee, hock, foot, far, fore):
    base, sh = ('s', 'k') if far else ('b', 's')
    r0 = 2.8 if fore else 3.4
    pts = [(hip[0], hip[1], r0), (knee[0], knee[1], 1.6), (hock[0], hock[1], 1.1), (foot[0], foot[1] - 1.5, 0.9)]
    seg = []
    for a, b in zip(pts, pts[1:]):
        seg += bez([a, b], 8)
    tube(p, seg, base, 'o', sh)
    x, y = ipt(foot)
    p.box((x - 1, y - 2, x + 2, y), 'o')
    dot(p, x + 2, y, 'k')


# body centre, tilt (+ = front down), head pos rel. to shoulder, head pitch, jaw, legs, flame size
POSE = {
    'idle_a':  ((29, 40), -3, (13, -9), 8, 0, 'stand', 0),
    'idle_b':  ((29, 41), -3, (13, -8), 6, 0, 'stand', 1),
    'idle_c':  ((29, 41), -2, (13, -7), 4, 1, 'stand', 2),
    'windup':  ((27, 44), 8, (12, -2), -10, 1, 'crouch', 3),
    'move':    ((29, 40), 0, (14, -6), 0, 0, 'gallop', 1),
    'attack':  ((29, 35), -12, (15, -5), 6, 2, 'leap', 3),
    'recover': ((28, 40), -4, (12, -9), 10, 0, 'stand', 0),
    'hit':     ((28, 39), -10, (8, -12), 28, 1, 'hit', 2),
}
# per set: far fore, far hind, near fore, near hind -> (knee, hock, foot) offsets from hip
LEGS = {
    'stand':  [((1, 8), (1, 14), (3, None)), ((-3, 7), (0, 13), (-1, None)),
               ((0, 8), (0, 14), (2, None)), ((-4, 7), (-1, 13), (-3, None))],
    'crouch': [((5, 6), (6, 11), (9, None)), ((-6, 5), (-3, 10), (-6, None)),
               ((4, 6), (5, 11), (8, None)), ((-7, 5), (-4, 10), (-8, None))],
    'gallop': [((6, 5), (10, 9), (13, None)), ((-6, 6), (-9, 11), (-13, None)),
               ((2, 7), (-1, 12), (-3, None)), ((2, 7), (5, 12), (6, None))],
    'leap':   [((7, 3), (12, 5), (16, 8)), ((-6, 5), (-10, 8), (-15, 11)),
               ((8, 2), (13, 4), (17, 6)), ((-7, 4), (-11, 7), (-16, 9))],
    'hit':    [((1, 7), (0, 13), (1, None)), ((-2, 8), (-1, 14), (-2, None)),
               ((2, 8), (1, 14), (2, None)), ((-3, 8), (-2, 14), (-4, None))],
}


def flame_tongue(p, base, ang, ln, width, phase):
    """One tongue of fire: tapered wavy polygon, red rim, orange body, yellow core."""
    pts_l, pts_r = [], []
    for i in range(7):
        t = i / 6
        c = ax(base, ang, ln * t, math.sin(t * 5 + phase) * 1.2 * t)
        w = width * (1 - t) ** 0.8
        pts_l.append(ax(c, ang, 0, -w)); pts_r.append(ax(c, ang, 0, w))
    poly = [ipt(q) for q in pts_l + pts_r[::-1]]
    p.poly(poly, 'f', 'r')
    core = [ipt(ax(base, ang, ln * t, math.sin(t * 5 + phase) * 1.2 * t)) for t in (0.0, 0.25, 0.5)]
    p.line(core, 'y')
    dot(p, *core[0], 'w')


def mane(p, sh, nape, size, n):
    """Flames licking back and up along the neck and shoulders."""
    phase = {'idle_a': 0, 'idle_b': 1.6, 'idle_c': 3.2}.get(n, 0.8 + size)
    k = 6 + size
    for i in range(k):
        t = i / (k - 1)
        base = (sh[0] + (nape[0] - sh[0]) * t, sh[1] + (nape[1] - sh[1]) * t - 1)
        ang = -118 - 25 * t + 8 * math.sin(i * 1.7 + phase)
        ln = 6 + size * 1.5 + 3 * math.sin(math.pi * t) + 1.5 * math.sin(i * 2.3 + phase)
        flame_tongue(p, base, ang, ln, 2.0 + 0.3 * size, phase + i)


def head(p, nk, pitch, jaw, n):
    a = pitch
    skull = ax(nk, a, 4)
    blob(p, skull[0], skull[1], 7, 5.6, a)
    muzzle = ax(skull, a, 7.5, 1.2)
    drop = [0, 2, 5][jaw]
    if jaw:
        lj = [ipt(ax(skull, a, 2, 3)), ipt(ax(muzzle, a, 5, 1 + drop)), ipt(ax(muzzle, a, 3, 3 + drop)), ipt(ax(skull, a, 0, 5))]
        p.poly(lj, 's', 'o')
        mouth = [ipt(ax(skull, a, 2, 2)), ipt(ax(muzzle, a, 4, 1)), ipt(ax(muzzle, a, 4, 1 + drop)), ipt(ax(skull, a, 3, 3.5))]
        p.poly(mouth, 'f')
        p.line([ipt(ax(skull, a, 4, 2.5)), ipt(ax(muzzle, a, 3, 1 + drop * 0.6))], 'y')
        for d0 in (1, 3.5):  # fangs
            f0 = ax(muzzle, a, d0, 1)
            dot(p, *f0, 't'); dot(p, *ax(f0, a, 0, 1), 't')
            b0 = ax(muzzle, a, d0 - 0.5, 1 + drop)
            dot(p, *b0, 't'); dot(p, *ax(b0, a, 0, -1), 't')
    blob(p, muzzle[0], muzzle[1], 5.2, 3.0, a)
    dot(p, *ax(muzzle, a, 4.5, -1), 'o')
    if not jaw:
        p.line([ipt(ax(skull, a, 2, 3)), ipt(ax(muzzle, a, 4, 1.5))], 'o')
        dot(p, *ax(muzzle, a, 2, 2.5), 'f')  # ember drool at the lip
    # ears: two sharp points swept back
    for d0, h in ((-4, 9), (-1, 7)):
        eb = ax(skull, a, d0, -3)
        tip = ax(eb, a - 35, -2, -h)
        p.poly([ipt(ax(eb, a, -2)), ipt(tip), ipt(ax(eb, a, 2))], 'b', 'o')
        p.line([ipt(ax(eb, a, 0, -1)), ipt(ax(tip, a, 0.5, 2))], 'r')
    p.line([ipt(ax(skull, a, -3, -2)), ipt(ax(skull, a, 2, -4))], 'l')
    eye = ax(skull, a, 2.5, -1.5)
    ex, ey = ipt(eye)
    if n == 'hit':
        p.line([(ex - 1, ey - 1), (ex + 1, ey + 1)], 'e')
    else:
        p.box((ex, ey, ex + 1, ey), 'e')
        dot(p, ex + 2, ey, 'y')
        p.line([(ex - 1, ey - 1), (ex + 2, ey - 1)], 'o')


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # collapsed on its side; the mane burnt down to embers and smoke wisps
        tube(p, bez([(16, 54, 1.8), (10, 51, 1.3), (6, 52, 0.8)]), 's', 'o')
        for hip, foot in [((22, 55), (17, 59)), ((38, 55), (45, 59))]:
            tube(p, bez([(hip[0], hip[1], 2.2), (foot[0], foot[1], 1.0)]), 'k', 'o')
        mass(p, [(29, 54, 14, 5, 0), (40, 53, 6, 4.5, 0)], light_c=(27, 51), light_r=12)
        blob(p, 50, 56, 6.5, 3.8, 10)
        blob(p, 56, 58, 3.8, 2, 10)
        p.line([(48, 54), (50, 56)], 'e'); p.line([(50, 54), (48, 56)], 'e')
        p.poly([(44, 52), (46, 47), (48, 51)], 'k', 'o')
        for x, y in [(34, 48), (38, 47), (42, 49), (31, 49)]:
            dot(p, x, y, 'r'); dot(p, x, y + 1, 'f')
        for x, y in [(36, 43), (37, 41), (40, 42), (41, 40)]:
            dot(p, x, y, 'd')
        settle(p, G)
        return p
    (bx, by), tilt, (hdx, hdy), pitch, jaw, lset, size = POSE[n]
    body = (bx, by)
    rear, fore = ax(body, tilt, -9, 2), ax(body, tilt, 8, 2)
    L = LEGS[lset]
    airborne = lset == 'leap'

    def put_leg(spec, hip, far, is_fore):
        (kx, ky), (hx, hy), (fx, fy) = spec
        o = (1, -1) if far else (0, 0)
        h0 = (hip[0] + o[0], hip[1] + o[1])
        foot = (h0[0] + fx, (h0[1] + fy) if fy is not None else G - (1 if far else 0))
        knee = (h0[0] + kx, h0[1] + ky)
        hock = (h0[0] + hx, min(h0[1] + hy, foot[1] - 2))
        leg(p, h0, knee, hock, foot, far, is_fore)

    put_leg(L[0], fore, True, True)
    put_leg(L[1], rear, True, False)
    # tail: a whip ending in a flame tip
    rump = ax(body, tilt, -12, -2)
    tip = (rump[0] - 6, rump[1] - 6 + (4 if n == 'hit' else 0) - (3 if airborne else 0))
    tube(p, bez([(rump[0], rump[1], 1.8), (rump[0] - 5, rump[1] + 1, 1.3), (tip[0], tip[1], 0.8)]), 'b', 'o', 's')
    flame_tongue(p, tip, -125, 4 + size, 1.6, size)
    # lean deep-chested body: chest bigger than the tucked waist
    mass(p, [(*ax(body, tilt, 4, -1), 9, 7.5, tilt), (*ax(body, tilt, -6, 0), 8, 5.5, tilt)],
         light_c=ax(body, tilt, 2, -3), light_r=11)
    tuck = ax(body, tilt, -5, 5)
    p.line([ipt(ax(tuck, tilt, -6)), ipt(ax(tuck, tilt, 6, 1.5))], 's')
    for d0 in (-8, -3, 4):  # ribs / sheen strokes catching the light
        a0 = ax(body, tilt, d0, -4)
        p.line([ipt(a0), ipt(ax(a0, tilt, 3, 0.5))], 'l')
    put_leg(L[3], rear, False, False)
    nape = ax(body, tilt, 9, -6)
    nk = (fore[0] + hdx - 9, fore[1] + hdy)
    tube(p, bez([(nape[0] - 2, nape[1] + 3, 4.2), (nk[0], nk[1], 3.4)]), 'b', 'o', 's')
    mane(p, ax(body, tilt, -2, -6), (nk[0] + 1, nk[1] - 2), size, n)
    head(p, nk, pitch, jaw, n)
    put_leg(L[2], fore, False, True)
    if n == 'attack':
        # gout of fire from the open jaws
        m = ax(ax(nk, pitch, 4), pitch, 12, 3)
        flame_tongue(p, m, pitch - 5, 8, 3.2, 1.1)
        flame_tongue(p, ax(m, pitch, 2, 1), pitch + 10, 6, 2.2, 2.3)
        for x, y in [(8, 56), (11, 58), (6, 59)]:
            p.box((x, y, x + 1, y + 1), 'd')
    if n == 'windup':
        for x, y in [(nk[0] + 9, nk[1] + 5), (nk[0] + 11, nk[1] + 3)]:
            dot(p, x, y, 'y')
    if n == 'move':
        for x, y in [(9, 57), (12, 55), (7, 55)]:
            p.box((x, y, x + 1, y + 1), 'd')
    settle(p, G if not airborne else None)
    return p


if __name__ == '__main__':
    run('hound-hell', CELL, PAL, draw)

