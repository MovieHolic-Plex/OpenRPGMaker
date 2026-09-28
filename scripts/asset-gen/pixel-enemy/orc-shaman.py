"""Original orc shaman: tusked grey-green orc in a hide robe, feather headband, skull staff; green fire bolt.

shoot motion: windup raises the staff, move (in place) swells the flame over the skull,
attack thrusts the staff and releases the bolt to the right.
"""
import sys, math
sys.dont_write_bytecode = True
from pe_lib import Pen
from pe_rig import build, cap, put, limb, boot
CELL = 48
PAL = dict(o='1a1c1c', s='3e5a3a', b='66845a', l='93ad7c', w='e8e2c8', r='a0343a', q='d66a3a',
           v='4a3226', c='7a5638', k='a8805a', e='e8c040', g='3aa84a', n='a6f06a', y='e8f8b0')

HEAD = [
    "..oooooo...",
    ".obllllbo..",
    "obllllbbbo.",
    "orrrrrrrro.",
    "obllbboeoo.",
    "osbbbbbbbbo",
    "osbbbbbbwbo",
    ".osbbwbbbo.",
    "..osssooo..",
    "...ooo.....",
]
HEAD_HIT = [r for r in HEAD]; HEAD_HIT[4] = "obllbbooooo"[:11]
HEAD_CAST = [r for r in HEAD]; HEAD_CAST[7] = ".osbowwobo."; HEAD_CAST[8] = "..ossoooo.."
SKULL = [".oooo.", "owwwwo", "wowowo", "owwwwo", ".owow.", "..oo.."]

# neck, head top-left, front hand, back hand, staff (bottom, top), flame size, body lean
P = {
 'idle_a': dict(neck=(23,27), head=(18,17), fh=(30,35), bh=(17,36), st=((31,44),(29,16)), fl=1, lean=0),
 'idle_b': dict(neck=(23,28), head=(18,18), fh=(30,35), bh=(17,36), st=((31,44),(29,16)), fl=0, lean=0),
 'idle_c': dict(neck=(23,29), head=(18,19), fh=(30,36), bh=(17,37), st=((31,44),(29,17)), fl=1, lean=0),
 'windup': dict(neck=(22,28), head=(16,19), fh=(25,24), bh=(20,26), st=((21,38),(27,14)), fl=2, lean=-1),
 'move':   dict(neck=(22,28), head=(16,19), fh=(26,23), bh=(21,25), st=((22,38),(28,15)), fl=3, lean=-1),
 'attack': dict(neck=(25,29), head=(21,20), fh=(31,29), bh=(25,31), st=((20,33),(34,25)), fl=0, lean=2),
 'recover':dict(neck=(24,28), head=(19,18), fh=(32,35), bh=(18,36), st=((33,44),(32,17)), fl=0, lean=1),
 'hit':    dict(neck=(21,28), head=(13,19), fh=(28,28), bh=(13,31), st=((33,43),(24,17)), fl=0, lean=-3),
}

def flame(p, cx, cy, r):
    """Tear-shaped green fire; 1 ember, 2 bulb, 3 big."""
    if r <= 0: return
    if r == 1:
        p.grid(cx-1, cy-2, [".n.", "ngn", ".o."]); return
    p.poly([(cx, cy-r*2-1), (cx+r, cy-r+1), (cx+r, cy+1), (cx, cy+r), (cx-r, cy+1), (cx-r, cy-r+1)], 'g', 'o')
    p.poly([(cx, cy-r*2+1), (cx+r-1, cy-r+2), (cx, cy+r-2), (cx-r+1, cy-r+2)], 'n')
    p.line([(cx, cy-r+2), (cx, cy)], 'y')

def bolt(p, x, y):
    """Released fire bolt: round head flying right with a flame tail."""
    p.poly([(x-6, y), (x-3, y-3), (x+1, y-4), (x+4, y-2), (x+5, y), (x+4, y+2), (x+1, y+4), (x-3, y+3)], 'g', 'o')
    p.poly([(x-5, y), (x-1, y-2), (x+2, y-2), (x+3, y), (x+2, y+2), (x-1, y+2)], 'n')
    p.box((x, y-1, x+1, y+1), 'y')

def staff(p, st, fl):
    (bx, by), (tx, ty) = st
    cap(p, [(bx, by-1), (tx, ty)], 1, 'c', edge='o')
    sx, sy = tx - 3, ty - 5
    put(p, sx, sy, SKULL)
    p.line([(sx+1, sy+6), (sx+4, sy+6)], 'k')
    cap(p, [(sx, sy+4), (sx-1, sy+7)], 1, 'r', edge='o')      # feather charm
    if fl == 1: flame(p, sx+3, sy-1, 1)
    elif fl: flame(p, sx+3, sy-1, fl)
    return sx, sy

def robe(p, neck, lean, n):
    nx, ny = neck
    hem = 41
    sway = {'idle_b': 1, 'windup': -1, 'attack': 2, 'hit': -2}.get(n, 0)
    p.poly([(nx-5, ny), (nx+5, ny), (nx+6+lean, 35), (nx+8+sway, hem), (nx-7+sway, hem), (nx-7+lean, 35)], 'v', 'o')
    p.poly([(nx-4, ny+1), (nx-2, ny+1), (nx-4+lean, 35), (nx-5+sway, hem-1), (nx-6+sway, hem-1), (nx-6+lean, 35)], 'c')
    p.line([(nx+2, ny+2), (nx+5+sway, hem-1)], 's')
    for x in range(nx-6+sway, nx+8+sway, 3): p.line([(x, hem), (x, hem)], 'k')
    p.line([(nx-6+lean, 34), (nx+6+lean, 34)], 'r')
    for x in (nx-4+lean, nx+lean, nx+4+lean): p.line([(x, 34), (x, 34)], 'w')
    p.line([(nx-3, ny+1), (nx+3, ny+1)], 'w')             # tooth necklace
    p.line([(nx-2, ny+2), (nx+2, ny+2)], 'o')

def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # Collapsed forward on his face; the staff has rolled out in front, its fire out.
        boot(p, 9, 44, 3, 2, 'v')
        p.poly([(10, 39), (25, 37), (30, 40), (29, 44), (11, 44)], 'v', 'o'); p.line([(11, 40), (24, 38)], 'c')
        p.line([(14, 41), (28, 41)], 'r')
        put(p, 28, 36, ["..ooooo...", ".obllrrbo.", "osbbrbbbbo", "osbbbbwbbo", ".oooooooo."])
        cap(p, [(18, 43), (42, 43)], 1, 'c', edge='o')
        put(p, 40, 39, SKULL[:5])
        return p
    q = P[n]; neck = q['neck']
    limb(p, (neck[0]-2, neck[1]+2), q['bh'], 5, 5, 3, 's')
    boot(p, neck[0]-3, 44, 3, 2, 'v'); boot(p, neck[0]+3, 44, 3, 2, 'v', 'c')
    robe(p, neck, q['lean'], n)
    hx, hy = q['head']
    tall = 2 if n in ('windup', 'move') else 1 if n == 'idle_c' else 0
    cap(p, [(hx+1, hy+3), (hx-2, hy-2-tall)], 1, 'q', edge='o')
    cap(p, [(hx+3, hy+3), (hx+2, hy-3-tall)], 1, 'r', edge='o')
    cap(p, [(hx+5, hy+2), (hx+5, hy-2-tall//2)], 1, 'q', edge='o')
    head = HEAD_HIT if n == 'hit' else HEAD_CAST if n in ('windup', 'move', 'attack') else HEAD
    put(p, hx, hy, head)
    sx, sy = staff(p, q['st'], q['fl'])
    for h, sh, col in ((q['bh'], None, 's'), (q['fh'], (neck[0]+3, neck[1]+2), 'b')):
        if sh: limb(p, sh, h, 5, 5, 3, 'b', dark='s', lit='l')
        p.box((h[0]-1, h[1]-1, h[0]+1, h[1]), col if sh is None else 'b')
        p.line([(h[0]-1, h[1]-1), (h[0], h[1]-1)], 'l')
    if n == 'attack': bolt(p, 41, sy+3)
    if n == 'recover': p.grid(sx+6, sy-4, ["nn.", ".n.", ".nn"])
    return p

if __name__ == '__main__': build('orc-shaman', CELL, PAL, draw)

