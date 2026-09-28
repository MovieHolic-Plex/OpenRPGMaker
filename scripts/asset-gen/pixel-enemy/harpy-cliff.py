"""Original cliff harpy: woman's face with wild violet hair, feathered wings, bird legs and talons.

swoop motion: wings beat while hovering (idle a/b/c = up/mid/down stroke), windup pulls the
wings high and tucks the talons, move is a steep dive, attack rakes both talons forward.
Only dead touches the floor.
"""
import sys, math
sys.dont_write_bytecode = True
from pe_lib import Pen
from pe_rig import build, cap, put, clean
CELL = 48
PAL = dict(o='1e1626', s='4a2c52', b='7a4a86', l='a878b0', h='d8b0d8', k='f0c8a0', t='c8906c',
           f='5a3a2a', w='8a6040', y='e0b048', e='c83a4a', c='f4ecd8')

HEAD = [
    "...oooo...",
    "..ohllbo..",
    ".ohlbbbbo.",
    "ohlbbbkkko",
    "olbbbkkoko",
    "obbbbkkkko",
    "obbbbbktko",
    "osbbbbkeo.",
    "osbsbbkko.",
    ".o.osboo..",
]
HEAD_ATK = [r for r in HEAD]; HEAD_ATK[4] = "olbbbkookk"[:9] + "o"; HEAD_ATK[7] = "osbbbbkoeo"; HEAD_ATK[8] = "osbsbbkeo."
HEAD_HIT = [r for r in HEAD]; HEAD_HIT[4] = "olbbbkoooo"; HEAD_HIT[7] = "osbbbbkko."

def D(a, L): return (math.cos(math.radians(a)) * L, math.sin(math.radians(a)) * L)

def wing(p, sh, arm, hand, fd, far=False, arm_len=8, hand_len=9):
    """Serrated wing polygon: shoulder -> wrist -> tip leading edge, five primaries trailing along fd."""
    sx, sy = sh
    wx, wy = sx + D(arm, arm_len)[0], sy + D(arm, arm_len)[1]
    tx, ty = wx + D(hand, hand_len)[0], wy + D(hand, hand_len)[1]
    bases = []
    for i in range(6):  # from tip back to the shoulder
        u = i / 5
        if u < 0.5: bx, by = tx + (wx - tx) * u * 2, ty + (wy - ty) * u * 2
        else: bx, by = wx + (sx - wx) * (u - 0.5) * 2, wy + (sy - wy) * (u - 0.5) * 2
        bases.append((bx, by, 10 - i * 1.3))
    pts = [(sx, sy), (wx, wy), (tx, ty)]
    for i, (bx, by, L) in enumerate(bases):
        ex, ey = bx + D(fd, L)[0], by + D(fd, L)[1]
        pts.append((ex, ey))
        if i < 5:
            nx, ny = bases[i + 1][0], bases[i + 1][1]
            m = ((bx + nx) / 2 + D(fd, L * 0.45)[0], (by + ny) / 2 + D(fd, L * 0.45)[1])
            pts.append(m)
    pts = [(round(x), round(y)) for x, y in pts]
    base, dark = ('b', 's') if far else ('l', 'b')
    p.poly(pts, base, 'o')
    for bx, by, L in bases[1:5]:
        ex, ey = bx + D(fd, L - 1)[0], by + D(fd, L - 1)[1]
        p.line([(round(bx + D(fd, 2)[0]), round(by + D(fd, 2)[1])), (round(ex), round(ey))], dark)
    if not far:
        p.line([(round(sx), round(sy)), (round(wx), round(wy)), (round(tx), round(ty))], 'h')

def leg(p, hip, dx, dy, grab, near=True):
    hx, hy = hip
    knee = (hx + 2 + dx * 0.5, hy + 3)
    foot = (hx + dx, hy + dy)
    cap(p, [hip, knee], 3, 'b' if near else 's', lit='l' if near else None)
    cap(p, [knee, foot], 1, 'y' if near else 'w', edge='o')
    fx, fy = round(foot[0]), round(foot[1])
    if grab:
        p.line([(fx, fy), (fx + 3, fy - 2)], 'y'); p.line([(fx + 3, fy - 2), (fx + 4, fy - 2)], 'c')
        p.line([(fx, fy), (fx + 3, fy + 1)], 'y'); p.line([(fx + 4, fy + 1), (fx + 4, fy + 1)], 'c')
        p.line([(fx - 1, fy + 1), (fx - 1, fy + 2)], 'c')
    else:
        p.grid(fx - 2, fy + 1, ["yyyy", "c.c."])

# neck(x,y), near wing (arm, hand, feather dir), far wing, legs (dx, dy, grab), hair flow
P = {
 'idle_a': dict(n=(27,18), wn=(-140, -105, 170), wf=(-125, -95, 175), lg=(2, 7, 0), hair=(0, 4)),
 'idle_b': dict(n=(27,19), wn=(-175, -170, 115), wf=(-165, -160, 110), lg=(2, 7, 0), hair=(0, 5)),
 'idle_c': dict(n=(27,20), wn=(155, 120, 185), wf=(160, 125, 180), lg=(1, 7, 0), hair=(0, 3)),
 'windup': dict(n=(25,18), wn=(-115, -80, 190), wf=(-105, -75, 190), lg=(4, 5, 0), hair=(-1, 6)),
 'move':   dict(n=(29,20), wn=(-165, -150, 150), wf=(-160, -145, 150), lg=(6, 6, 1), hair=(-3, 1)),
 'attack': dict(n=(28,22), wn=(-135, -100, 160), wf=(-120, -90, 165), lg=(11, 5, 1), hair=(-4, 2)),
 'recover':dict(n=(27,16), wn=(170, 140, 110), wf=(175, 145, 105), lg=(1, 7, 0), hair=(0, 4)),
 'hit':    dict(n=(24,19), wn=(-120, -150, 120), wf=(-110, -140, 115), lg=(-3, 7, 0), hair=(2, 5)),
}

def hair(p, head, flow):
    hx, hy = head; fx, fy = flow
    cap(p, [(hx + 1, hy + 3), (hx - 2 + fx, hy + 5 + fy // 2), (hx - 3 + fx, hy + 8 + fy)], 2, 'b', edge='o')
    cap(p, [(hx + 2, hy + 1), (hx - 2 + fx, hy + 2 + fy // 3)], 1, 'l', edge='o')

def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # Crumpled on the ground: near wing spread flat behind, head down on the right.
        wing(p, (22, 39), 180, 185, 250, arm_len=8, hand_len=7)
        p.poly([(21, 38), (29, 38), (30, 44), (20, 44)], 'k', 'o'); p.line([(22, 39), (28, 39)], 'c')
        p.poly([(20, 41), (28, 41), (28, 44), (20, 44)], 'l', 'o')
        put(p, 29, 35, ["..oooo...", ".ohllbo..", "ohlbbbbo.", "olbbkkkko", "obbkkookko"[:9], "osbsbkkoo", ".ooooooo."])
        cap(p, [(27, 43), (31, 43)], 1, 'y', edge='o')
        return p
    q = P[n]; nx, ny = q['n']
    head = (nx - 5, ny - 9)
    wing(p, (nx - 2, ny + 1), *q['wf'], far=True)
    hair(p, head, q['hair'])
    hip = (nx - 1, ny + 9)
    dx, dy, grab = q['lg']
    leg(p, (hip[0] - 1, hip[1]), dx - 2, dy, grab, near=False)
    # feather tail
    for a, col in ((165, 's'), (150, 'b')):
        cap(p, [(hip[0] - 2, hip[1] - 1), (hip[0] - 2 + D(a, 6)[0], hip[1] + D(a, 6)[1])], 2, col, edge='o')
    # chest and feathered belly
    p.poly([(nx - 3, ny), (nx + 3, ny), (nx + 3, ny + 4), (nx - 3, ny + 4)], 'k', 'o')
    p.line([(nx - 2, ny + 1), (nx - 2, ny + 3)], 'c'); p.line([(nx + 2, ny + 2), (nx + 2, ny + 3)], 't')
    p.poly([(nx - 4, ny + 4), (nx + 4, ny + 4), (hip[0] + 3, hip[1] + 1), (hip[0] - 3, hip[1] + 1)], 'l', 'o')
    p.line([(nx - 3, ny + 5), (nx + 3, ny + 5)], 'h')
    p.line([(nx - 2, ny + 7), (nx + 2, ny + 7)], 'b')
    leg(p, (hip[0] + 1, hip[1]), dx, dy, grab)
    put(p, *head, HEAD_ATK if n in ('attack', 'move') else HEAD_HIT if n == 'hit' else HEAD)
    wing(p, (nx, ny + 1), *q['wn'])
    return clean(p)

if __name__ == '__main__': build('harpy-cliff', CELL, PAL, draw, flying=True)

