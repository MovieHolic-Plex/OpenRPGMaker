"""Original orc warrior: grey-green brute, horned iron helm, tusks, fur mantle, huge single axe.

stomp motion: two heavy steps (move), axe hauled overhead (windup), chopped down to the floor (attack).
"""
import sys, math
sys.dont_write_bytecode = True
from pe_lib import Pen
from pe_rig import build, cap, put, limb, leg_to, clean
CELL = 64
PAL = dict(o='1a1c1e', s='3c5446', b='5e7a64', l='88a48a', w='ece4c8', m='5a5f6a', n='9aa0aa', h='dfe4e8',
           v='4a3224', c='7a5436', k='a87c50', r='a83838', e='f0c040', f='6a5a48')

HEAD = [
    "oo.............oo.",
    "owo...........owo.",
    ".owo.oooooooo.owo.",
    ".owooommnnnnmoowo.",
    "..oomnnhhhnnnmoo..",
    "...omnnnnnnnnmo...",
    "...ommmmmmmmmmmo..",
    "...oblllbbbeobbbo.",
    "...oblbbbbbbbbbbbo",
    "...osbbbbbbbboooo.",
    "....osbbbbbbwbwo..",
    ".....osbbbbbwbwo..",
    "......osssbbbbo...",
    ".......ooooooo....",
]
HEAD = [r[:-1] if len(r) > 18 else r for r in HEAD]
HEAD_HIT = [r for r in HEAD]; HEAD_HIT[7] = "...oblllbbbooobbbo"[:len(HEAD[7])]
HEAD_ROAR = [r for r in HEAD]; HEAD_ROAR[9] = "...osbbbbbbbooooo."[:len(HEAD[9])]; HEAD_ROAR[10] = "....osbbbbbbwrrwo."[:len(HEAD[10])]

# neck, hip, front hand, back hand, front foot, back foot, axe dir, head offset
P = {
 'idle_a': dict(nk=(31,34), hp=(30,46), fh=(42,46), bh=(20,45), ff=(37,60), bf=(24,60), ax=(0.12,-1)),
 'idle_b': dict(nk=(31,35), hp=(30,47), fh=(42,47), bh=(20,46), ff=(37,60), bf=(24,60), ax=(0.12,-1)),
 'idle_c': dict(nk=(31,36), hp=(30,47), fh=(42,48), bh=(20,47), ff=(37,60), bf=(24,60), ax=(0.16,-1)),
 'windup': dict(nk=(28,34), hp=(29,46), fh=(21,23), bh=(18,26), ff=(39,60), bf=(21,60), ax=(-1.2,-1)),
 'move':   dict(nk=(32,34), hp=(30,45), fh=(41,43), bh=(21,43), ff=(40,58), bf=(22,60), ax=(0.3,-1)),
 'attack': dict(nk=(35,38), hp=(31,48), fh=(45,44), bh=(40,43), ff=(43,60), bf=(19,60), ax=(1,0.35)),
 'recover':dict(nk=(32,36), hp=(30,47), fh=(42,47), bh=(21,46), ff=(38,60), bf=(24,60), ax=(1,-0.55)),
 'hit':    dict(nk=(27,35), hp=(29,47), fh=(38,40), bh=(15,42), ff=(35,60), bf=(22,60), ax=(0.55,-1)),
}

BLADE = [(-6, 0), (-9, 5), (-8, 9), (-4, 11), (3, 11), (7, 9), (8, 5), (5, 1), (4, 0)]
BLADE_IN = [(-4, 2), (-6, 5), (-5, 8), (-2, 9), (2, 9), (5, 8), (5, 5), (3, 2)]
EDGE = [(-8, 8), (-4, 10), (3, 10), (7, 8)]

def axe(p, hand, d, grip=8, length=24, k=1.0):
    """Bearded crescent axe; blade built in (u along haft, v outward) space so it turns with the haft."""
    dx, dy = d; L = math.hypot(dx, dy); dx, dy = dx/L, dy/L
    butt = (hand[0]-dx*grip, hand[1]-dy*grip); top = (butt[0]+dx*length, butt[1]+dy*length)
    cap(p, [butt, top], 2, 'c', edge='o')
    p.line([(round(butt[0]), round(butt[1])), (round(top[0]-dx*2), round(top[1]-dy*2))], 'k')
    nx, ny = -dy, dx           # edge leads a clockwise (forward-down) chop: upright haft -> edge faces the heroes
    c = (top[0]-dx*5, top[1]-dy*5)
    T = lambda pts: [(round(c[0]+dx*u*k+nx*v*k), round(c[1]+dy*u*k+ny*v*k)) for u, v in pts]
    p.poly(T([(-2, 0), (0, -4), (2, 0)]), 'm', 'o')          # back spike
    p.poly(T(BLADE), 'm', 'o'); p.poly(T(BLADE_IN), 'n'); p.line(T(EDGE), 'h')
    p.line(T([(-5, 0), (5, 0)]), 'r')                           # lashing on the haft

def torso(p, nk, hp, n):
    nx, ny = nk; hx, hy = hp
    # broad chest wedge, belly strap, loincloth
    p.poly([(nx-9, ny+1), (nx+8, ny), (nx+9, ny+5), (hx+6, hy), (hx-6, hy), (nx-9, ny+6)], 'b', 'o')
    p.poly([(nx-8, ny+2), (nx-1, ny+2), (nx-2, ny+6), (hx-4, hy-2), (nx-8, ny+6)], 'l')
    p.line([(nx+1, ny+5), (nx+2, ny+8)], 's'); p.line([(nx-4, ny+7), (nx, ny+8)], 's')
    p.line([(hx-3, hy-5), (hx+4, hy-5)], 's'); p.line([(hx-2, hy-3), (hx+4, hy-3)], 's')
    p.line([(nx-8, ny+2), (hx+6, hy-1)], 'v', 2)        # bandolier
    p.line([(nx-7, ny+1), (hx+5, hy-2)], 'c')
    p.poly([(hx-7, hy-1), (hx+7, hy-1), (hx+7, hy+2), (hx-7, hy+2)], 'v', 'o'); p.line([(hx-1, hy), (hx+1, hy)], 'e')
    p.poly([(hx-4, hy+2), (hx+5, hy+2), (hx+4, hy+8), (hx-3, hy+8)], 'f', 'o')
    # fur mantle over the back shoulder
    p.poly([(nx-11, ny-1), (nx-2, ny-3), (nx+3, ny), (nx-4, ny+3), (nx-11, ny+5), (nx-12, ny+2)], 'f', 'o')
    p.line([(nx-10, ny), (nx-3, ny-2)], 'k')

def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # Toppled backwards, helmet rolled off to the right, axe stuck in the ground behind him.
        cap(p, [(9, 49), (12, 59)], 2, 'c', edge='o'); p.poly([(4, 45), (13, 43), (15, 50), (8, 52)], 'm', 'o'); p.line([(6, 46), (12, 45)], 'h')
        leg_to(p, (22, 55), (13, 60), 5, 5, 5, 's', bw=6, bh=3, bcol='v')
        p.poly([(18, 50), (38, 49), (41, 60), (18, 60)], 'b', 'o'); p.poly([(19, 51), (30, 50), (28, 55), (19, 56)], 'l')
        p.line([(20, 51), (39, 58)], 'v', 2); p.poly([(18, 55), (22, 55), (22, 60), (18, 60)], 'v', 'o')
        put(p, 38, 48, ["..ooooooo..", ".oblllbbbo.", "osbbbbbbbbo", "osbbbwbwbbo", "osbbbbbbbbo", ".ooooooooo.", ][:6])
        cap(p, [(30, 51), (36, 54), (42, 56)], 5, 'b', dark='s')
        put(p, 48, 51, ["oo.......oo", "owo.....owo", ".owoooooowo", "..omnnhnmo.", "..omnnnnmo.", ".ommmmmmmmo", ".ooooooooo."])
        return clean(p)
    q = P[n]; nk, hp = q['nk'], q['hp']
    limb(p, (nk[0]-7, nk[1]+3), q['bh'], 8, 7, 5, 's')
    leg_to(p, (hp[0]-3, hp[1]), q['bf'], 7, 7, 5, 's', bw=6, bh=3, bcol='v')
    torso(p, nk, hp, n)
    leg_to(p, (hp[0]+3, hp[1]), q['ff'], 7, 7, 5, 'b', dark='s', lit='l', bw=6, bh=3, bcol='v', blit='c')
    head = HEAD_HIT if n == 'hit' else HEAD_ROAR if n in ('windup', 'attack') else HEAD
    put(p, nk[0]-9, nk[1]-12, head)
    hand, _ = limb(p, (nk[0]+6, nk[1]+3), q['fh'], 8, 7, 5, 'b', dark='s', lit='l')
    axe(p, hand, q['ax'], length=21 if n == 'attack' else 24, k=0.85 if n == 'attack' else 1.0)
    if n == 'windup': put(p, nk[0]-9, nk[1]-12, head)   # arms swing behind the helm
    for hnd in (hand, q['bh']) if n in ('windup', 'attack') else (hand,):
        p.box((hnd[0]-2, hnd[1]-2, hnd[0]+2, hnd[1]+1), 'b', ) if False else p.poly([(hnd[0]-2, hnd[1]-2), (hnd[0]+2, hnd[1]-2), (hnd[0]+2, hnd[1]+2), (hnd[0]-2, hnd[1]+2)], 'b', 'o')
        p.line([(hnd[0]-1, hnd[1]-1), (hnd[0]+1, hnd[1]-1)], 'l')
    return clean(p)

if __name__ == '__main__': build('orc-warrior', CELL, PAL, draw)

