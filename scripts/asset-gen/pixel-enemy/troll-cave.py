"""Original cave troll: hunched grey giant, pot belly, long knuckle-dragging arms, knotted club.

stomp motion: two heavy steps (move), club hauled over the shoulder (windup), slammed to the floor (attack).
"""
import sys, math
sys.dont_write_bytecode = True
from pe_lib import Pen
from pe_rig import build, cap, limb, leg_to, clean
CELL = 96
PAL = dict(o='1c1a20', d='34343e', s='4e505c', b='74778a', l='9a9eae', h='c4c8d0', p='a88e86',
           v='4a3524', c='6e4c30', k='98704a', w='e8e0c8', e='f0d050', m='5c6a48', r='8a3a3a')

P = {
 #        neck      hip      front hand  back hand   front foot  back foot   club dir    head nod
 'idle_a': dict(nk=(52,42), hp=(46,68), fh=(66,74), bh=(30,72), ff=(58,92), bf=(34,92), cd=(0.45,1),  hd=0),
 'idle_b': dict(nk=(52,43), hp=(46,69), fh=(66,75), bh=(30,73), ff=(58,92), bf=(34,92), cd=(0.45,1),  hd=1),
 'idle_c': dict(nk=(52,44), hp=(46,69), fh=(66,76), bh=(30,74), ff=(58,92), bf=(34,92), cd=(0.5,1),   hd=2),
 'windup': dict(nk=(48,42), hp=(45,68), fh=(40,30), bh=(34,36), ff=(62,92), bf=(30,92), cd=(-0.8,-1), hd=-2),
 'move':   dict(nk=(55,42), hp=(47,67), fh=(68,70), bh=(34,68), ff=(64,90), bf=(32,92), cd=(0.9,1),   hd=0),
 'attack': dict(nk=(56,48), hp=(48,70), fh=(66,68), bh=(60,68), ff=(66,92), bf=(28,92), cd=(1,0.62),  hd=4),
 'recover':dict(nk=(54,45), hp=(46,69), fh=(68,78), bh=(32,73), ff=(60,92), bf=(34,92), cd=(1,0.25),  hd=1),
 'hit':    dict(nk=(45,42), hp=(44,68), fh=(60,68), bh=(22,66), ff=(56,92), bf=(34,92), cd=(1,-0.6),  hd=-4),
}

def club(p, hand, d, length=34):
    """Tapered log: thin grip at the hand, thick knotted head with bone spikes.
    The length shrinks until the whole club (outline included) stays above the sole row and inside the cell."""
    dx, dy = d; L = math.hypot(dx, dy); dx, dy = dx/L, dy/L
    nx, ny = -dy, dx
    g = (hand[0]-dx*4, hand[1]-dy*4)
    def at(u, v): return (round(g[0]+dx*u+nx*v), round(g[1]+dy*u+ny*v))
    def shape(Lc):
        body = [at(0, -2), at(Lc*0.4, -3), at(Lc, -6), at(Lc+3, -4), at(Lc+4, 0), at(Lc+3, 4), at(Lc, 6), at(Lc*0.4, 3), at(0, 2)]
        spikes = [(Lc*0.62, -4, -3), (Lc*0.85, 5, 3), (Lc+2, -4, -3)]
        return body, spikes
    while length > 12:
        body, spikes = shape(length)
        pts = body + [at(u+1, v+sv) for u, v, sv in spikes]
        if max(y for _, y in pts) <= CELL-5 and max(x for x, _ in pts) <= CELL-2 and min(y for _, y in pts) >= 1: break
        length -= 1
    body, spikes = shape(length)
    p.poly(body, 'c', 'o')
    p.poly([at(2, -1), at(length*0.4, -2), at(length, -4), at(length+2, -2), at(length*0.4, 0), at(2, 0)], 'k')
    for u, v in ((length*0.55, 3), (length*0.8, -4)):
        p.line([at(u, v), at(u+2, v)], 'v')
    for u, v, sv in spikes:
        p.poly([at(u, v), at(u+1, v+sv), at(u+2, v)], 'w', 'o')

def head(p, x, y, n):
    """Low-slung head jutting forward: heavy brow, drooping nose, underbite tusks, small ear."""
    p.poly([(x-4, y+2), (x+4, y-3), (x+13, y-2), (x+17, y+3), (x+18, y+10), (x+13, y+16), (x+3, y+16), (x-4, y+10)], 'b', 'o')
    p.poly([(x-2, y+2), (x+4, y-1), (x+11, y), (x+8, y+4), (x+2, y+6), (x-2, y+8)], 'l')
    p.line([(x+2, y-1), (x+9, y-2)], 'h')
    p.poly([(x-5, y+4), (x-8, y+1), (x-7, y+7), (x-3, y+8)], 's', 'o')                          # ear
    p.line([(x+7, y+4), (x+16, y+3)], 'o', 2)                                                   # brow
    eye = 'o' if n == 'hit' else 'e'
    p.box((x+12, y+6, x+13, y+7), eye); p.line([(x+11, y+6), (x+11, y+7)], 'o')
    p.poly([(x+15, y+6), (x+21, y+10), (x+20, y+13), (x+16, y+12)], 'p', 'o')                   # nose
    p.line([(x+16, y+8), (x+19, y+10)], 'h')
    if n in ('windup', 'attack'):
        p.poly([(x+6, y+13), (x+16, y+13), (x+15, y+19), (x+7, y+19)], 'o')
        p.line([(x+8, y+19), (x+14, y+19)], 'r')
        p.line([(x+8, y+12), (x+8, y+14)], 'w'); p.line([(x+14, y+12), (x+14, y+14)], 'w')
    else:
        p.line([(x+6, y+14), (x+16, y+13)], 'o')
        p.line([(x+8, y+12), (x+8, y+13)], 'w'); p.line([(x+14, y+11), (x+14, y+12)], 'w')
    p.line([(x+1, y+10), (x+4, y+12)], 's')
    # tuft of lank hair on the crown
    p.poly([(x+2, y-2), (x+1, y-6), (x+5, y-4), (x+7, y-7), (x+9, y-3)], 'm', 'o')

def body(p, nk, hp):
    nx, ny = nk; hx, hy = hp
    # hunched back hump, sagging chest, pot belly overhanging the loincloth
    p.poly([(nx-18, ny+4), (nx-8, ny-4), (nx+4, ny-3), (nx+9, ny+4), (hx+14, hy-12), (hx+16, hy-4), (hx+10, hy+2),
            (hx-10, hy+2), (hx-16, hy-8)], 'b', 'o')
    p.poly([(nx-16, ny+4), (nx-8, ny-2), (nx-1, ny-1), (nx-6, ny+6), (hx-8, hy-8), (hx-13, hy-8)], 'l')
    p.line([(nx-14, ny+2), (nx-7, ny-3)], 'h')
    p.poly([(hx+1, hy-16), (hx+12, hy-12), (hx+14, hy-4), (hx+8, hy), (hx+1, hy-2)], 'p', 'o')   # belly
    p.line([(hx+4, hy-14), (hx+10, hy-11)], 'w')
    p.line([(hx+6, hy-6), (hx+7, hy-6)], 's')
    p.poly([(hx+9, hy-4), (hx+14, hy-6), (hx+14, hy-3), (hx+9, hy)], 's')
    for k in range(3):   # warts
        x, y = nx-10+k*6, ny+8+k*3
        p.line([(x, y), (x+1, y)], 'm')
    p.poly([(hx-11, hy-2), (hx+11, hy-2), (hx+10, hy+3), (hx-10, hy+3)], 'v', 'o')
    p.poly([(hx-6, hy+2), (hx+7, hy+2), (hx+5, hy+11), (hx-4, hy+11)], 'c', 'o')
    p.line([(hx-3, hy+3), (hx-2, hy+10)], 'k')

def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # Fell flat on his belly, arm and club flung forward, head down on the right.
        leg_to(p, (26, 84), (12, 92), 9, 9, 10, 's', bw=11, bh=5, bcol='d')
        p.poly([(18, 76), (32, 70), (54, 70), (66, 78), (66, 92), (18, 92)], 'b', 'o')
        p.poly([(18, 77), (32, 72), (46, 72), (40, 78), (20, 82)], 'l'); p.line([(22, 75), (34, 71)], 'h')
        p.poly([(22, 86), (36, 86), (36, 92), (22, 92)], 'c', 'o')
        cap(p, [(58, 80), (70, 84), (76, 86)], 8, 'b', dark='s', lit='l')
        p.poly([(62, 78), (72, 76), (80, 80), (81, 90), (70, 92), (61, 90)], 'b', 'o')
        p.line([(66, 80), (74, 79)], 'l'); p.line([(71, 85), (76, 85)], 'o', 2); p.poly([(77, 85), (83, 89), (78, 91)], 'p', 'o')
        club(p, (74, 83), (1, 0.05), 13)
        return clean(p)
    q = P[n]; nk, hp = q['nk'], q['hp']
    # back arm, back leg
    limb(p, (nk[0]-10, nk[1]+6), q['bh'], 15, 14, 9, 's', dark='d', bend=-1 if n != 'windup' else 1)
    bx, by = q['bh']; p.poly([(bx-5, by-4), (bx+4, by-4), (bx+5, by+4), (bx-4, by+5)], 's', 'o')
    leg_to(p, (hp[0]-6, hp[1]), q['bf'], 11, 11, 11, 's', dark='d', bw=12, bh=5, bcol='d')
    body(p, nk, hp)
    leg_to(p, (hp[0]+6, hp[1]), q['ff'], 11, 11, 11, 'b', dark='s', lit='l', bw=12, bh=5, bcol='s', blit='b')
    hx, hy = nk[0]+4, nk[1]-4+q['hd']
    # front arm hangs in front of the belly; the jutting head is always drawn over it
    club(p, q['fh'], q['cd'])
    limb(p, (nk[0]+2, nk[1]+7), q['fh'], 15, 14, 10, 'b', dark='s', lit='l', bend=-1)
    fx, fy = q['fh']
    p.poly([(fx-6, fy-5), (fx+5, fy-5), (fx+6, fy+4), (fx-5, fy+5)], 'b', 'o')
    p.line([(fx-4, fy-4), (fx+3, fy-4)], 'l'); p.line([(fx-2, fy+1), (fx+3, fy+1)], 's')
    head(p, hx, hy, n)
    return clean(p)

if __name__ == '__main__': build('troll-cave', CELL, PAL, draw)

