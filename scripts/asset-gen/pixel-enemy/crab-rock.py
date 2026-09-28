"""Original rock crab, 48px: red-brown shell carrying a grey boulder on its back, one huge
crusher claw toward the allies, eye stalks. windup raises and opens the big claw; attack
scuttles forward and snaps it shut at full reach (dash)."""
import math
import sys
sys.dont_write_bytecode = True
from beast_lib import Pen, run, blob, mass, tube, bez, dot, ipt, settle
CELL = 48
G = 44
PAL = dict(o='1f1414', m='5a2a22', s='8a3a2c', b='c05a3c', l='e38a5c', h='f5c49a',
           g='3e3e48', r='6b6a74', t='9a98a0', u='c8c4c0', k='2a2a32', e='14100e', w='f7f1e4', d='a39276')
ROCK = {'l': 'u', 'b': 't', 's': 'r'}
FAR = {'l': 's', 'b': 'm', 's': 'm', 'h': 's'}

# body (x, y), big claw (arm reach dx, arm lift dy, pincer open deg), small claw lift, legs set
POSE = {
    'idle_a':  ((20, 35), (0, 0, 8), 0, 0),
    'idle_b':  ((20, 36), (0, 0, 12), 1, 0),
    'idle_c':  ((20, 36), (0, 1, 6), 0, 1),
    'windup':  ((19, 35), (-3, -10, 40), -2, 2),
    'move':    ((21, 35), (1, 0, 10), 0, 3),
    'attack':  ((22, 36), (5, 0, 0), 2, 3),
    'recover': ((20, 35), (1, -2, 20), 0, 0),
    'hit':     ((19, 34), (-3, -4, 28), -3, 2),
}
LEGS = {  # per stride: [(hip dx, knee dx, knee dy, foot dx)] near legs back -> front; far legs mirror offset
    0: [(-6, -14, -6, -17), (-2, -9, -3, -10), (5, 11, 0, 9)],
    1: [(-6, -14, -5, -17), (-2, -9, -2, -10), (5, 11, 1, 10)],
    2: [(-6, -15, -7, -19), (-2, -10, -4, -12), (5, 10, -1, 7)],
    3: [(-6, -13, -5, -14), (-2, -11, -3, -15), (5, 13, 0, 13)],
}


def legs(p, bx, by, lset, far):
    for hdx, kdx, kdy, fdx in LEGS[lset]:
        if far:  # far legs peek out between the near ones, dark and unoutlined
            hip, knee, foot = (bx + hdx + 3, by), (bx + kdx + 4, by + kdy - 1), (bx + fdx + 5, G - 1)
            p.line([ipt(hip), ipt(knee), ipt(foot)], 'm', 2)
            continue
        hip, knee, foot = (bx + hdx, by + 2), (bx + kdx, by + kdy), (bx + fdx, G)
        up = [(x, y, 0.5) for x, y in bez([hip, knee], 8)]
        dn = [(x, y, 0.5 - 0.3 * i / 9) for i, (x, y) in enumerate(bez([knee, foot], 10))]
        tube(p, up + dn, 's', 'o')
        dot(p, knee[0], knee[1] - 1, 'l')
        dot(p, *foot, 'o')


def big_claw(p, sh, reach, lift, openg, n):
    elbow = (sh[0] + 2 + reach * 0.4, sh[1] - 1 + lift * 0.6)
    wrist = (elbow[0] + 2 + reach * 0.6, elbow[1] + lift * 0.4)
    tube(p, bez([(sh[0], sh[1], 1.8), (elbow[0], elbow[1], 2.0), (wrist[0], wrist[1], 2.2)]), 'b', 'o', 's', 'l')
    # swollen propodus (palm) with the fixed finger, then the hinged dactyl on top
    pc = (wrist[0] + 4, wrist[1] - 1)
    a = math.radians(openg)
    fixed = [(pc[0] + 2, pc[1] + 1), (pc[0] + 9, pc[1] + 1), (pc[0] + 7, pc[1] + 3), (pc[0] + 1, pc[1] + 4)]
    p.poly([ipt(q) for q in fixed], 'b', 'o')
    for k in range(3):  # teeth on the fixed finger
        dot(p, pc[0] + 3 + k * 2, pc[1] + 1, 'h')
    hinge = (pc[0] + 1, pc[1] - 3)
    L = 8.5
    tip = (hinge[0] + math.cos(a) * L, hinge[1] - math.sin(a) * L + 2 * (1 - math.sin(a)))
    back = (hinge[0] + math.cos(a) * 3 - math.sin(a) * 2.5, hinge[1] - math.sin(a) * 3 - math.cos(a) * 2.5)
    dact = [hinge, back, ((back[0] + tip[0]) / 2, (back[1] + tip[1]) / 2 - 1), tip,
            ((hinge[0] + tip[0]) / 2 + 0.5, (hinge[1] + tip[1]) / 2 + 1.5)]
    p.poly([ipt(q) for q in dact], 'b', 'o')
    blob(p, pc[0], pc[1], 5.2, 4.2, -10)
    dot(p, pc[0] - 2, pc[1] - 2, 'h'); dot(p, pc[0] - 1, pc[1] - 2, 'h')
    dot(p, *tip, 'e'); dot(p, pc[0] + 9, pc[1] + 1, 'e')
    return (pc[0] + 9, pc[1] + 1)


def small_claw(p, sh, lift):
    wrist = (sh[0] + 5, sh[1] - 1 + lift)
    tube(p, bez([(sh[0], sh[1], 1.1), (wrist[0], wrist[1], 1.3)]), 'm', 'o')
    blob(p, wrist[0] + 2, wrist[1], 2.6, 2.0, 0, keys=FAR)
    p.line([ipt((wrist[0] + 3, wrist[1] - 2)), ipt((wrist[0] + 6, wrist[1] - 1))], 'm')
    p.line([ipt((wrist[0] + 3, wrist[1] + 1)), ipt((wrist[0] + 5, wrist[1]))], 'm')


def rock(p, bx, by, tilt):
    """Irregular boulder on the carapace: polygon silhouette shaded by facets."""
    cx, cy = bx - 2, by - 8 + tilt
    pts = [(cx - 8, cy + 4), (cx - 8, cy - 1), (cx - 4, cy - 6), (cx + 1, cy - 7), (cx + 5, cy - 4),
           (cx + 8, cy + 1), (cx + 6, cy + 4)]
    p.poly(pts, 'r', 'o')
    p.poly([(cx - 8, cy + 1), (cx - 8, cy - 1), (cx - 4, cy - 5), (cx + 1, cy - 6), (cx - 1, cy - 1), (cx - 4, cy + 2)], 't')
    p.poly([(cx - 6, cy - 2), (cx - 4, cy - 4), (cx - 1, cy - 5), (cx - 3, cy - 2)], 'u')
    p.poly([(cx + 3, cy + 1), (cx + 7, cy + 1), (cx + 5, cy + 3), (cx + 1, cy + 3)], 'g')
    p.line([(cx - 1, cy - 1), (cx + 3, cy + 1), (cx + 5, cy - 3)], 'k')   # crack
    for x, y in ((cx - 6, cy + 3), (cx + 4, cy - 4)):                     # moss specks
        dot(p, x, y, 'm')


def body(p, bx, by, n, tilt=0):
    mass(p, [(bx, by, 9.5, 6.5, 0), (bx + 5, by + 1.5, 5, 4.5, 0)], light_c=(bx - 1, by - 3), light_r=9)
    for x in range(bx - 7, bx + 9, 4):  # shell rim bumps catching the light
        dot(p, x, by - 4 + abs(x - bx) // 5, 'h')
    p.line([(bx - 8, by + 3), (bx + 8, by + 3)], 's')
    p.line([(bx - 5, by + 5), (bx + 6, by + 5)], 'm')
    rock(p, bx, by, tilt)
    # eye stalks rising from the front of the shell
    for dx, hgt, c in ((6, 5, 'm'), (9, 6, 's')):
        top = (bx + dx, by - 3 - hgt)
        tube(p, [(bx + dx - 1, by - 3, 0.6), (top[0], top[1] + 1, 0.6)], 'l', 'o')
        if n == 'hit':
            p.line([ipt((top[0] - 1, top[1] - 1)), ipt((top[0] + 1, top[1] + 1))], 'e')
        else:
            blob(p, top[0] + 0.5, top[1], 1.8, 1.8, 0, keys={'l': 'k', 'b': 'e', 's': 'e'})
            dot(p, top[0] + 1, top[1] - 1, 'w')
    p.line([(bx + 10, by + 2), (bx + 11, by + 3)], 'o')   # mouth plates


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # flipped over: pale belly up, legs curled, the boulder rolled off beside it
        pts = [(28, 44), (29, 38), (33, 35), (39, 35), (43, 38), (44, 44)]
        p.poly(pts, 'r', 'o')
        p.poly([(30, 40), (31, 38), (34, 36), (38, 36), (35, 40)], 't')
        p.line([(35, 38), (38, 41)], 'k')
        mass(p, [(15, 41, 10, 3.5, 0)], light_c=(15, 39), light_r=9, keys={'l': 'h', 'b': 'l', 's': 's'})
        for x in (8, 12, 16, 20):
            p.line([(x, 39), (x - 1, 35), (x + 1, 33)], 'o')
        tube(p, bez([(23, 41, 1.6), (26, 38, 1.5)]), 'b', 'o', 's')
        blob(p, 26, 36, 3.5, 2.6, 30)
        p.line([(10, 42), (12, 42)], 'o'); p.line([(17, 40), (19, 42)], 'o'); p.line([(19, 40), (17, 42)], 'o')
        settle(p, G)
        return p
    (bx, by), (reach, lift, openg), slift, lset = POSE[n]
    tilt = -1 if n == 'hit' else 0
    legs(p, bx, by, lset, True)
    small_claw(p, (bx + 8, by - 1), slift)
    legs(p, bx, by, lset, False)
    body(p, bx, by, n, tilt)
    tip = big_claw(p, (bx + 8, by + 2), reach, lift, openg, n)
    if n == 'attack':
        x, y = ipt(tip)
        for dx, dy in ((1, -3), (2, -1), (1, 2), (-1, -4)):
            dot(p, x + dx, y + dy, 'w')
    if n in ('move', 'attack'):
        for x, y in [(3, 42), (6, 40), (2, 39)]:
            p.box((x, y, x + 1, y + 1), 'd')
    settle(p, G)
    return p


if __name__ == '__main__':
    run('crab-rock', CELL, PAL, draw)

