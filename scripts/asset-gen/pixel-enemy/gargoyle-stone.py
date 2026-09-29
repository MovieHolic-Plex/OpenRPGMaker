"""Original stone gargoyle: horned demon statue with bat-like stone wings, cracked granite hide.

swoop motion: hovers on slow wing beats, windup rears back with wings fully raised,
move is a steep dive, attack rakes both claws forward. Only dead (shattered) touches the floor.
"""
import sys, math
sys.dont_write_bytecode = True
from pe_lib import Pen
from pe_rig import build, cap, put, limb, clean
CELL = 64
PAL = dict(o='1c1c24', s='3e404c', b='62656f', l='8c909a', h='bcc0c6', d='2a2b34',
           m='4d5a4a', e='e04a3a', y='f0a040', c='d8d0bc')

# Swept-back ram horns, pointed ear, heavy brow over a glowing eye, blunt snout with fangs.
HEAD = [
    "..ooo........",
    ".ollbo.......",
    "olbssbo......",
    "obo.osbo..o..",
    "oo..oobooolo.",
    "....obllllbo.",
    "...obllhhhbbo",
    "...obllooobbo",
    "..olbbbbeobbbo",
    "..obbbbbbbbbbo",
    "..osbbbbboocco",
    "...osbbbbcoco.",
    "....osssooo...",
    ".....oooo.....",
]
HEAD_ATK = [r for r in HEAD]
HEAD_ATK[10] = "..osbbbbooooo."; HEAD_ATK[11] = "...osbbbocece."; HEAD_ATK[12] = "....osssocoo.."
HEAD_HIT = [r for r in HEAD]; HEAD_HIT[8] = "..olbbbbooobbo"

def D(a, L): return (math.cos(math.radians(a)) * L, math.sin(math.radians(a)) * L)

# Bat wing in local (u along the leading edge, v toward the body side) coordinates.
WING = [(0, 0), (10, -2), (15, -1), (22, 1), (18, 5), (20, 10), (14, 9), (13, 15), (8, 11), (1, 10)]
BONES = [[(10, -2), (22, 1)], [(10, -2), (20, 10)], [(10, -2), (13, 15)]]

def wing(p, sh, ang, spread=0, far=False, k=1.0):
    """spread tilts the fingers (deg) so beats open/close the fan; k scales the far wing."""
    ux, uy = D(ang, 1)
    vx, vy = -uy, ux
    if vx * -0.2 + vy * 1 < 0: vx, vy = -vx, -vy
    def T(pts, sp=0):
        out = []
        for u, v in pts:
            if u > 10 and sp:
                r = math.radians(sp * (v + 2) / 17)
                du, dv = u - 10, v + 2
                u, v = 10 + du * math.cos(r) - dv * math.sin(r), -2 + du * math.sin(r) + dv * math.cos(r)
            out.append((round(sh[0] + (ux * u + vx * v) * k), round(sh[1] + (uy * u + vy * v) * k)))
        return out
    base, dark = ('s', 'd') if far else ('b', 's')
    p.poly(T(WING, spread), base, 'o')
    for bone in BONES: p.line(T(bone, spread), dark if far else 'l')
    arm = T([(0, 0), (10, -2)])
    cap(p, arm, 3, dark if far else 'b', lit=None if far else 'h')
    wx, wy = arm[1]
    p.grid(wx - 1, wy - 2, ["oo", "lo"] if not far else ["oo", "so"])

# neck, wings (near arm/hand, far arm/hand), front claw target, back claw, feet dx/dy
P = {
 'idle_a': dict(nk=(34,25), wn=(-125, 0), wf=(-115, 0), fh=(41,35), bh=(29,36), ft=(3, 11), tl=0),
 'idle_b': dict(nk=(34,26), wn=(-160, 10), wf=(-150, 10), fh=(41,36), bh=(29,37), ft=(3, 11), tl=1),
 'idle_c': dict(nk=(34,27), wn=(165, 20), wf=(172, 20), fh=(41,37), bh=(29,38), ft=(3, 12), tl=2),
 'windup': dict(nk=(31,24), wn=(-100, -10), wf=(-92, -10), fh=(44,15), bh=(24,14), ft=(5, 9), tl=-1),
 'move':   dict(nk=(36,28), wn=(-165, -15), wf=(-158, -15), fh=(46,37), bh=(41,39), ft=(-2, 10), tl=-2),
 'attack': dict(nk=(38,29), wn=(-130, 5), wf=(-118, 5), fh=(53,34), bh=(49,39), ft=(0, 10), tl=-1),
 'recover':dict(nk=(34,23), wn=(175, 25), wf=(178, 25), fh=(41,33), bh=(29,34), ft=(3, 11), tl=1),
 'hit':    dict(nk=(30,26), wn=(-115, 25), wf=(-105, 25), fh=(38,30), bh=(22,33), ft=(-2, 11), tl=2),
}
def claw(p, h, forward):
    x, y = h
    p.poly([(x - 2, y - 2), (x + 2, y - 2), (x + 3, y + 1), (x - 2, y + 2)], 'b', 'o')
    if forward:
        p.grid(x + 3, y - 2, ["oc", ".oc", "oc", ".oc"][:4])
    else:
        p.grid(x - 2, y + 2, ["c.c.c", "o.o.o"])

def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # Shattered statue: broken wing slabs, torso block, horned head, rubble chips on y60.
        for x, y, w, h in [(6, 53, 13, 8), (18, 50, 16, 11), (33, 54, 9, 7), (46, 56, 8, 5)]: p.stone(x, y, w, h)
        p.poly([(8, 52), (14, 44), (20, 50)], 's', 'o'); p.poly([(20, 49), (26, 42), (30, 49)], 'b', 'o')
        put(p, 40, 49, ["oo.....oo", "olooooolo", ".obllbbbo", "obllbbyoo", "osbbbbbbo", ".oooooooo"])
        p.line([(22, 52), (25, 54), (24, 58)], 'o'); p.line([(35, 55), (37, 57)], 'o')
        p.grid(55, 58, ["oo.", "olo", "ooo"])
        return clean(p)
    q = P[n]; nx, ny = q['nk']
    wing(p, (nx - 4, ny + 3), *q['wf'], far=True, k=0.9)
    hip = (nx - 2, ny + 14)
    # tail with an arrow tip, curling behind
    t = q['tl']
    tail = [(hip[0] - 2, hip[1]), (hip[0] - 8, hip[1] + 3), (hip[0] - 13, hip[1] + 1 - t), (hip[0] - 16, hip[1] - 3 - t)]
    cap(p, tail, 2, 's', edge='o')
    tx, ty = tail[-1]; p.poly([(tx - 2, ty - 1), (tx, ty - 4), (tx + 2, ty - 1), (tx, ty)], 'b', 'o')
    # back leg (crouched hind leg, digitigrade)
    fdx, fdy = q['ft']
    cap(p, [(hip[0] - 3, hip[1]), (hip[0] + 3, hip[1] + 4), (hip[0] - 3 + fdx, hip[1] + fdy - 2)], 5, 's')
    limb(p, (nx - 3, ny + 3), q['bh'], 6, 6, 3, 's')
    claw(p, q['bh'], n == 'attack')
    # hunched torso
    p.poly([(nx - 9, ny + 1), (nx + 5, ny), (nx + 8, ny + 6), (hip[0] + 7, hip[1] + 1), (hip[0] - 6, hip[1] + 1), (nx - 10, ny + 8)], 'b', 'o')
    p.poly([(nx - 6, ny + 2), (nx, ny + 1), (nx - 2, ny + 6), (hip[0] - 3, hip[1] - 2), (nx - 7, ny + 7)], 'l')
    p.poly([(nx + 1, ny + 5), (nx + 5, ny + 6), (hip[0] + 4, hip[1]), (hip[0] + 1, hip[1])], 's')
    p.line([(nx - 3, ny + 3), (nx - 1, ny + 7), (nx - 3, ny + 10)], 'o')   # crack
    p.line([(nx - 5, ny + 2), (nx - 1, ny + 1)], 'h')
    p.line([(hip[0] - 4, hip[1] - 1), (hip[0] - 3, hip[1] - 1)], 'm')    # moss
    # near leg
    cap(p, [(hip[0] + 2, hip[1]), (hip[0] + 8, hip[1] + 4), (hip[0] + 3 + fdx, hip[1] + fdy - 2)], 5, 'b', lit='l', dark='s')
    fx, fy = hip[0] + 3 + fdx, hip[1] + fdy
    p.grid(fx - 2, fy - 2, ["obbbo.", "occoco"])
    wing(p, (nx - 2, ny + 3), *q['wn'])
    put(p, nx - 6, ny - 12, HEAD_ATK if n in ('attack', 'move') else HEAD_HIT if n == 'hit' else HEAD)
    limb(p, (nx + 2, ny + 3), q['fh'], 6, 6, 3, 'b', dark='s', lit='l')
    claw(p, q['fh'], n in ('attack', 'move'))
    if n == 'windup': put(p, nx - 6, ny - 12, HEAD)   # raised claw passes behind the head
    return clean(p)

if __name__ == '__main__': build('gargoyle-stone', CELL, PAL, draw, flying=True)

