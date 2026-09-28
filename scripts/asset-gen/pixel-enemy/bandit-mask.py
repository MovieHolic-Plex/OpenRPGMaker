"""Original masked bandit: indigo hood, red face-cloth, sash, curved sabre; low dash slash."""
import sys, math
sys.dont_write_bytecode = True
from pe_lib import Pen
from pe_rig import build, cap, put, limb, leg_to
CELL = 48
PAL = dict(o='1b1a26', s='2c2f4d', b='454c78', l='6a74a6', k='e0b48a', t='a8764f',
           r='8c2b31', q='c2463f', v='3a2a22', c='6d4b33', m='a7b1bb', h='f0f4f4', g='d9a642')

HEAD = [
    "...oooo...",
    "..obllbo..",
    ".obllbbbo.",
    "obllbbbbo.",
    "oblbokkko.",
    "obbbkokoo.",
    "osbbrqqqqo",
    "ossbrqqqro",
    ".osbrrrro.",
    "..oooooo..",
]
HEAD_HIT = [r for r in HEAD]; HEAD_HIT[5] = "obbbkookoo"[:10]
HEAD_ATK = [r for r in HEAD]; HEAD_ATK[4] = "oblbokkko."; HEAD_ATK[5] = "obbbkkoko."

P = {
 'idle_a': dict(hip=(22,34), neck=(23,26), head=(18,17), fh=(30,32), bh=(17,33), ff=(27,44), bf=(18,44), ang=-60),
 'idle_b': dict(hip=(22,35), neck=(23,27), head=(18,18), fh=(30,33), bh=(17,34), ff=(27,44), bf=(18,44), ang=-58),
 'idle_c': dict(hip=(22,35), neck=(23,28), head=(18,19), fh=(30,33), bh=(17,35), ff=(27,44), bf=(18,44), ang=-54),
 'windup': dict(hip=(21,36), neck=(19,28), head=(13,19), fh=(13,24), bh=(26,33), ff=(30,44), bf=(14,44), ang=-150),
 'move':   dict(hip=(20,33), neck=(27,27), head=(24,18), fh=(14,33), bh=(31,32), ff=(31,41), bf=(9,40), ang=180),
 'attack': dict(hip=(23,36), neck=(29,29), head=(26,20), fh=(35,31), bh=(19,34), ff=(35,44), bf=(12,44), ang=-8, blen=9),
 'recover':dict(hip=(22,35), neck=(24,27), head=(19,18), fh=(31,35), bh=(17,34), ff=(28,44), bf=(17,44), ang=35, blen=7),
 'hit':    dict(hip=(20,35), neck=(18,27), head=(11,18), fh=(27,27), bh=(11,31), ff=(25,44), bf=(15,44), ang=-100),
}

def sabre(p, hand, ang, n=10, curve=5):
    """Curved sabre: blade bends 'curve' degrees per px toward the spine side."""
    x, y = hand; a = math.radians(ang); pts = [(x, y)]
    for i in range(n):
        a += math.radians(curve) * (1 if i > 2 else 0)
        x += math.cos(a); y += math.sin(a); pts.append((x, y))
    cap(p, pts[1:], 2, 'm', edge='o')
    edge_pts = [(round(px), round(py)) for px, py in pts[2:-1]]
    p.line(edge_pts, 'h')
    # hilt and cross guard
    back = (hand[0]-math.cos(math.radians(ang))*2, hand[1]-math.sin(math.radians(ang))*2)
    cap(p, [back, hand], 1, 'v', edge=None)
    gx, gy = -math.sin(math.radians(ang)), math.cos(math.radians(ang))
    p.line([(round(hand[0]+gx*2), round(hand[1]+gy*2)), (round(hand[0]-gx*2), round(hand[1]-gy*2))], 'g')

def torso(p, neck, hip):
    nx, ny = neck; hx, hy = hip
    p.poly([(nx-4, ny), (nx+4, ny), (hx+4, hy+1), (hx-4, hy+1)], 'b', 'o')
    p.line([(nx-3, ny+1), (hx-3, hy)], 'l')
    p.line([(nx+3, ny+1), (hx+3, hy)], 's')
    p.line([(nx+1, ny+1), (hx+1, hy-3)], 's')
    # red sash with trailing knot on the back
    p.line([(hx-4, hy-2), (hx+4, hy-2)], 'q'); p.line([(hx-4, hy-1), (hx+4, hy-1)], 'r')
    p.poly([(hx-4, hy-2), (hx-7, hy+1), (hx-6, hy+3), (hx-4, hy)], 'r', 'o')

def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # Slumped on his side: legs left, hood and mask on the right, sabre fallen out front.
        cap(p, [(10, 42), (15, 42), (19, 42)], 3, 's')
        cap(p, [(11, 40), (16, 40), (20, 41)], 3, 'b', dark='s')
        p.poly([(9, 41), (12, 41), (12, 44), (8, 44)], 'v', 'o')
        p.poly([(19, 37), (29, 36), (31, 43), (19, 44)], 'b', 'o'); p.line([(20, 38), (28, 37)], 'l')
        p.line([(22, 37), (22, 43)], 'q'); p.line([(23, 37), (23, 43)], 'r')
        put(p, 29, 34, ["..oooo...", ".obllbo..", "obllbbbo.", "obokkoko.", "obrqqqqo.", "osrrrrro.", ".ooooooo."])
        cap(p, [(30, 42), (35, 42)], 3, 'b', dark='s')
        p.box((35, 42, 37, 43), 'k')
        sabre(p, (37, 42), -3, 7, 2)
        return p
    q = P[n]; hip, neck = q['hip'], q['neck']
    shb, shf = (neck[0]-1, neck[1]+2), (neck[0]+2, neck[1]+2)
    limb(p, shb, q['bh'], 5, 5, 3, 's')
    leg_to(p, (hip[0]-1, hip[1]), q['bf'], 5, 5, 3, 's', bw=3, bh=2, bcol='v')
    torso(p, neck, hip)
    leg_to(p, (hip[0]+1, hip[1]), q['ff'], 5, 5, 3, 'b', dark='s', bw=3, bh=2, bcol='v', blit='c')
    # Mask tails trail behind the hood: they stream flat in the dash, droop at rest.
    hx0, hy0 = q['head']
    tail = {'move': [(-1, 6), (-5, 5), (-9, 6)], 'attack': [(-1, 6), (-5, 6), (-8, 8)],
            'windup': [(-1, 6), (-3, 9), (-4, 12)], 'hit': [(0, 6), (-1, 10), (0, 13)]}.get(n, [(-1, 6), (-3, 9), (-3 - (n == 'idle_c'), 12)])
    cap(p, [(hx0 + 1 + a, hy0 + b) for a, b in tail], 2, 'r', edge='o')
    head = HEAD_HIT if n == 'hit' else HEAD_ATK if n in ('attack', 'windup', 'move') else HEAD
    put(p, *q['head'], head)
    hand, _ = limb(p, shf, q['fh'], 5, 5, 3, 'b', dark='s', lit='l')
    sabre(p, hand, q['ang'], q.get('blen', 10))
    p.box((hand[0]-1, hand[1]-1, hand[0]+1, hand[1]), 'k')
    p.line([(hand[0]-1, hand[1]+1), (hand[0]+1, hand[1]+1)], 't')
    return p

if __name__ == '__main__': build('bandit-mask', CELL, PAL, draw)

