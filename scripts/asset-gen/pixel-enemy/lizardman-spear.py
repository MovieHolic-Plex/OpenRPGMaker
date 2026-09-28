"""Original lizardman spearman: blue scales, pale belly, fin crest, long tail; lunging spear thrust."""
import sys, math
sys.dont_write_bytecode = True
from pe_lib import Pen
from pe_rig import build, cap, put, limb, leg_to
CELL = 48
PAL = dict(o='161c2c', s='24457a', b='3a6fb0', l='66a0d8', y='d8d49a', e='f0c040',
           c='7a5230', k='a8784a', m='9aa6b0', h='eef0f0', r='b04a4a', f='2f8a8a')

HEAD = [
    "..fof.........",
    ".ooffoooo.....",
    "obllllbbooooo.",
    "obllbbbeobbbso",
    "osbbbbbbbbbbbo",
    ".osbbbbboooyyo",
    "..ossyyyyyyoo.",
    "...ooooooo....",
]
HEAD_OPEN = [
    "..fof.........",
    ".ooffoooo.....",
    "obllllbbooooo.",
    "obllbbbeobbbso",
    "osbbbbbbbooooo",
    ".osbbbboorrr..",
    "..ossyyyyyyyo.",
    "...oooooooo...",
]
HEAD_HIT = [r for r in HEAD]; HEAD_HIT[3] = "obllbbboobbbso"

P = {
 'idle_a': dict(hip=(21,34), neck=(24,26), head=(21,17), fh=(31,33), bh=(20,32), ff=(27,44), bf=(17,44), sp=(0.08,-1), grip=6, tail=0),
 'idle_b': dict(hip=(21,35), neck=(24,27), head=(21,18), fh=(31,34), bh=(20,33), ff=(27,44), bf=(17,44), sp=(0.08,-1), grip=6, tail=1),
 'idle_c': dict(hip=(21,35), neck=(24,28), head=(21,19), fh=(31,35), bh=(20,34), ff=(27,44), bf=(17,44), sp=(0.1,-1), grip=6, tail=2),
 'windup': dict(hip=(19,36), neck=(19,28), head=(15,19), fh=(14,32), bh=(22,31), ff=(29,44), bf=(12,44), sp=(1,-0.12), grip=6, tail=-2),
 'move':   dict(hip=(20,33), neck=(26,27), head=(24,18), fh=(22,33), bh=(30,31), ff=(31,41), bf=(9,40), sp=(1,0.05), grip=4, tail=-3),
 'attack': dict(hip=(23,36), neck=(29,29), head=(27,20), fh=(33,31), bh=(27,31), ff=(35,44), bf=(12,44), sp=(1,0), grip=13, tail=-1),
 'recover':dict(hip=(21,35), neck=(24,27), head=(21,18), fh=(28,33), bh=(20,32), ff=(28,44), bf=(16,44), sp=(0.5,-1), grip=6, tail=1),
 'hit':    dict(hip=(19,35), neck=(18,27), head=(13,18), fh=(25,29), bh=(12,31), ff=(25,44), bf=(14,44), sp=(0.35,-1), grip=3, tail=3),
}

def spear(p, hand, d, grip, length=20):
    dx, dy = d; L = math.hypot(dx, dy); dx, dy = dx/L, dy/L
    butt = (hand[0]-dx*grip, hand[1]-dy*grip)
    head = (butt[0]+dx*length, butt[1]+dy*length)
    cap(p, [butt, head], 1, 'c', edge='o')
    # leaf point + red binding
    tx, ty = head[0]+dx*5, head[1]+dy*5; nx, ny = -dy, dx
    p.poly([(round(head[0]+nx*2+dx), round(head[1]+ny*2+dy)), (round(tx), round(ty)), (round(head[0]-nx*2+dx), round(head[1]-ny*2+dy)), (round(head[0]-dx*2), round(head[1]-dy*2))], 'm', 'o')
    p.line([(round(head[0]+nx), round(head[1]+ny)), (round(tx-dx), round(ty-dy))], 'h')
    p.line([(round(head[0]-dx*3+nx), round(head[1]-dy*3+ny)), (round(head[0]-dx*3-nx), round(head[1]-dy*3-ny))], 'r')

def tail(p, hip, t):
    hx, hy = hip
    # Thick root, thin tip that lifts off the ground and flicks with the pose.
    pts = [(hx-2, hy-1), (hx-6, hy+2), (hx-10, hy+4), (hx-13, hy+3-t)]
    cap(p, pts[:3], 4, 'b', dark='s', lit='l'); cap(p, pts[2:], 2, 'b')

def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # On its back, tail curled, spear lying under it.
        cap(p, [(40, 42), (45, 42)], 2, 'm', edge='o'); cap(p, [(6, 43), (40, 43)], 1, 'c', edge='o')
        cap(p, [(8, 38), (12, 41), (18, 41)], 3, 'b', dark='s')
        p.poly([(17, 37), (29, 37), (30, 42), (17, 42)], 'b', 'o'); p.line([(18, 38), (28, 38)], 'l'); p.line([(18, 41), (29, 41)], 'y')
        put(p, 29, 35, ["..ooooo....", ".obbbbboo..", "obllbboobo.", "osbbbbbbbbo", ".oyyyyyooo."])
        cap(p, [(22, 37), (25, 33), (28, 33)], 3, 'b', dark='s')
        return p
    q = P[n]; hip, neck = q['hip'], q['neck']
    shb, shf = (neck[0]-1, neck[1]+2), (neck[0]+2, neck[1]+2)
    tail(p, hip, q['tail'])
    hb, _ = limb(p, shb, q['bh'], 5, 5, 3, 's')
    leg_to(p, (hip[0]-1, hip[1]), q['bf'], 5, 5, 3, 's', bw=3, bh=2, bcol='s', toe=3) if False else leg_to(p, (hip[0]-1, hip[1]), q['bf'], 5, 5, 3, 's', bw=3, bh=2, bcol='s')
    nx, ny = neck; hx, hy = hip
    p.poly([(nx-4, ny), (nx+3, ny), (hx+4, hy+1), (hx-4, hy+1)], 'b', 'o')
    p.poly([(nx+1, ny+1), (nx+3, ny+1), (hx+4, hy), (hx+1, hy)], 'y')
    for k in range(2, hy-ny, 3): p.line([(nx+1+(hx-nx)*k//(hy-ny), ny+k), (nx+3+(hx-nx)*k//(hy-ny), ny+k)], 'k')
    p.line([(nx-3, ny+1), (hx-3, hy)], 'l')
    for k in range(1, hy-ny-1, 3):
        x = nx-4+(hx-nx)*k//(hy-ny); p.line([(x-1, ny+k), (x-1, ny+k)], 'f')
    p.poly([(hx-4, hy-1), (hx+4, hy-1), (hx+3, hy+2), (hx-3, hy+2)], 'c', 'o')
    leg_to(p, (hip[0]+1, hip[1]), q['ff'], 5, 5, 3, 'b', dark='s', bw=3, bh=2, bcol='b', blit='l')
    head = HEAD_HIT if n == 'hit' else HEAD_OPEN if n in ('attack', 'windup', 'move') else HEAD
    put(p, *q['head'], head)
    hf, _ = limb(p, shf, q['fh'], 5, 5, 3, 'b', dark='s', lit='l')
    spear(p, hf, q['sp'], q['grip'])
    for h in (hb, hf): p.box((h[0]-1, h[1]-1, h[0]+1, h[1]), 'l')
    return p

if __name__ == '__main__': build('lizardman-spear', CELL, PAL, draw)

