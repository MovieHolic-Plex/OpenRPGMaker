"""Original maze minotaur (boss): bull head with forward horns and nose ring, brown-furred giant,
bronze bracers and belt, double-bladed labrys.

stomp motion: two heavy hoof steps (move), labrys lifted over the horns (windup), cleaved down in front (attack).
"""
import sys, math
sys.dont_write_bytecode = True
from pe_lib import Pen
from pe_rig import build, cap, limb, leg_to, clean
CELL = 96
PAL = dict(o='1c1418', d='3a2420', s='5e3828', b='8a5434', l='b07848', h='d8a468', w='efe6cc', t='b8ac90',
           m='5c606c', n='9aa2ae', i='e2e8ee', g='c89a3a', r='c83030', k='2a2a30')

P = {
 #        neck      hip      front hand  back hand   front foot  back foot   axe dir    head nod
 'idle_a': dict(nk=(48,42), hp=(45,64), fh=(62,70), bh=(30,66), ff=(58,92), bf=(34,92), ad=(0.45,1),  hd=0),
 'idle_b': dict(nk=(48,43), hp=(45,65), fh=(62,71), bh=(30,67), ff=(58,92), bf=(34,92), ad=(0.45,1),  hd=1),
 'idle_c': dict(nk=(48,44), hp=(45,65), fh=(62,72), bh=(30,68), ff=(58,92), bf=(34,92), ad=(0.5,1),   hd=2),
 'windup': dict(nk=(44,42), hp=(44,64), fh=(36,26), bh=(30,30), ff=(62,92), bf=(30,92), ad=(-0.9,-1), hd=-3),
 'move':   dict(nk=(51,42), hp=(46,63), fh=(64,68), bh=(32,62), ff=(64,90), bf=(32,92), ad=(0.7,1),   hd=1),
 'attack': dict(nk=(54,48), hp=(47,66), fh=(70,72), bh=(64,70), ff=(66,92), bf=(26,92), ad=(1,0.6),   hd=5),
 'recover':dict(nk=(50,45), hp=(45,65), fh=(62,70), bh=(30,67), ff=(60,92), bf=(34,92), ad=(1,0.3),   hd=2),
 'hit':    dict(nk=(41,42), hp=(43,64), fh=(56,64), bh=(22,60), ff=(56,92), bf=(34,92), ad=(0.8,-1),  hd=-4),
}

# Crescent blade in (u along haft, v away from the haft) coordinates.
BLADE = [(-9, 1), (-12, 6), (-12, 11), (-8, 15), (0, 12), (8, 15), (12, 11), (12, 6), (9, 1)]
BLADE_IN = [(-7, 3), (-9, 7), (-8, 11), (-5, 12), (0, 9), (5, 12), (8, 11), (9, 7), (7, 3)]
EDGE = [(-11, 7), (-11, 11), (-8, 14)]
EDGE2 = [(11, 7), (11, 11), (8, 14)]

def labrys(p, hand, d, grip=12, length=40):
    dx, dy = d; L = math.hypot(dx, dy); dx, dy = dx/L, dy/L
    nx, ny = -dy, dx
    butt = (hand[0]-dx*grip, hand[1]-dy*grip)
    def fits(Lc):
        c = (butt[0]+dx*(Lc-8), butt[1]+dy*(Lc-8))
        pts = [(c[0]+dx*u+nx*v*sg, c[1]+dy*u+ny*v*sg) for u, v in BLADE for sg in (1, -1)] + [(butt[0], butt[1])]
        return all(1 <= x <= CELL-2 and 1 <= y <= CELL-5 for x, y in pts)
    while length > 20 and not fits(length): length -= 1
    top = (butt[0]+dx*length, butt[1]+dy*length)
    cap(p, [butt, top], 2, 's', edge='o')
    p.line([(round(butt[0]+nx), round(butt[1]+ny)), (round(top[0]+nx), round(top[1]+ny))], 'b')
    c = (butt[0]+dx*(length-8), butt[1]+dy*(length-8))
    for sg in (1, -1):
        T = lambda pts: [(round(c[0]+dx*u+nx*v*sg), round(c[1]+dy*u+ny*v*sg)) for u, v in pts]
        p.poly(T(BLADE), 'm', 'o'); p.poly(T(BLADE_IN), 'n'); p.line(T(EDGE), 'i'); p.line(T(EDGE2), 'i')
    # bronze collar and pommel spike
    p.poly([(round(c[0]+dx*u+nx*v), round(c[1]+dy*u+ny*v)) for u, v in ((-3, -3), (3, -3), (3, 3), (-3, 3))], 'g', 'o')
    p.poly([(round(top[0]+dx*u+nx*v), round(top[1]+dy*u+ny*v)) for u, v in ((-1, -2), (4, 0), (-1, 2))], 'n', 'o')

def head(p, x, y, n):
    """Bull head in profile: broad brow, horns curving forward-up, long muzzle with ring, beady red eye."""
    # far horn: same curve, set back and higher, darker
    cap(p, [(x+4, y), (x+2, y-5), (x+5, y-9), (x+10, y-11)], 3, 't', edge='o')
    cap(p, [(x+9, y-11), (x+13, y-12)], 1, 'w', edge='o')
    p.poly([(x-4, y+4), (x+4, y-2), (x+14, y-2), (x+18, y+3), (x+26, y+8), (x+28, y+14), (x+25, y+19), (x+16, y+19), (x+8, y+17), (x-2, y+13)], 's', 'o')
    p.poly([(x-2, y+4), (x+4, y), (x+13, y), (x+11, y+4), (x+4, y+7), (x-1, y+10)], 'b')
    p.line([(x+5, y), (x+12, y)], 'l')
    p.poly([(x+18, y+9), (x+27, y+11), (x+27, y+16), (x+24, y+18), (x+17, y+18)], 't', 'o')     # pale muzzle
    p.line([(x+19, y+10), (x+25, y+11)], 'w')
    p.line([(x+17, y+17), (x+23, y+17)], 'd')
    p.box((x+24, y+13, x+25, y+13), 'k')                                                        # nostril
    p.poly([(x+23, y+15), (x+26, y+15), (x+27, y+18), (x+25, y+20), (x+22, y+18)], 'g', 'o')      # ring
    p.box((x+24, y+16, x+25, y+17), 'o')
    p.line([(x+10, y+4), (x+17, y+5)], 'o', 2)                                                   # brow
    if n == 'hit': p.line([(x+13, y+7), (x+16, y+8)], 'o')
    else: p.box((x+13, y+7, x+15, y+8), 'r'); p.line([(x+13, y+7), (x+13, y+8)], 'o')
    if n in ('windup', 'attack'):
        p.poly([(x+16, y+18), (x+24, y+19), (x+22, y+23), (x+15, y+21)], 'o'); p.line([(x+17, y+21), (x+21, y+22)], 'r')
    # tuft between the horns, ear
    p.poly([(x+2, y-2), (x+6, y-6), (x+9, y-2)], 'o')
    p.poly([(x-6, y+5), (x-11, y+3), (x-9, y+8), (x-3, y+9)], 'd', 'o')
    # near horn: thick root, curves out, up and forward to a pale tip
    cap(p, [(x+9, y+1), (x+6, y-4), (x+9, y-8), (x+15, y-10)], 4, 't', lit='w')
    cap(p, [(x+14, y-10), (x+19, y-11)], 2, 'w', edge='o')

def body(p, nk, hp):
    nx, ny = nk; hx, hy = hp
    # massive shoulder hump and furred chest tapering to the waist
    p.poly([(nx-20, ny+2), (nx-8, ny-6), (nx+6, ny-5), (nx+12, ny+4), (hx+10, hy-6), (hx+8, hy+2), (hx-8, hy+2), (hx-14, hy-8)], 'b', 'o')
    p.poly([(nx-18, ny+2), (nx-8, ny-4), (nx+1, ny-3), (nx-4, ny+5), (hx-7, hy-8), (hx-12, hy-8)], 'l')
    p.line([(nx-16, ny), (nx-8, ny-5)], 'h')
    # pec and ab plates in shadow on the right
    p.line([(nx-2, ny+8), (nx+8, ny+10)], 's', 2)
    for k in range(3): p.line([(hx+1, hy-14+k*4), (hx+7, hy-13+k*4)], 's')
    p.poly([(nx+6, ny+4), (nx+12, ny+4), (hx+10, hy-6), (hx+6, hy-6)], 's')
    # fur scruff at the neck
    for k in range(4): p.poly([(nx-6+k*4, ny-4), (nx-4+k*4, ny+2), (nx-2+k*4, ny-4)], 'd' if k % 2 else 's', 'o')
    # belt with a bronze plate, leather kilt with straps
    p.poly([(hx-10, hy-1), (hx+10, hy-1), (hx+10, hy+3), (hx-10, hy+3)], 'd', 'o')
    p.poly([(hx-2, hy-2), (hx+4, hy-2), (hx+4, hy+4), (hx-2, hy+4)], 'g', 'o'); p.box((hx, hy, hx+2, hy+1), 'h')
    p.poly([(hx-10, hy+3), (hx+10, hy+3), (hx+12, hy+14), (hx-10, hy+14)], 's', 'o')
    for x in (hx-5, hx+1, hx+7): p.line([(x, hy+4), (x+1, hy+13)], 'd')

def arm(p, sh, hand, front):
    col, dark, lit = ('b', 's', 'l') if front else ('s', 'd', None)
    e, j = limb(p, sh, hand, 15, 13, 9, col, dark=dark, lit=lit, bend=-1)
    # bronze bracer on the forearm
    fx, fy = e; jx, jy = j
    bx, by = fx+(jx-fx)*0.35, fy+(jy-fy)*0.35
    cap(p, [(bx, by), (fx+(jx-fx)*0.1, fy+(jy-fy)*0.1)], 9, 'g', lit='h' if front else None)
    p.poly([(fx-5, fy-4), (fx+4, fy-5), (fx+6, fy+3), (fx-4, fy+5)], col, 'o')
    p.line([(fx-3, fy-3), (fx+3, fy-4)], lit or col)

def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # Collapsed on his side: hooves left, horned head down on the right, labrys dropped in front.
        labrys(p, (13, 88), (0.25, -1), 2, 30)
        leg_to(p, (28, 82), (10, 92), 9, 9, 10, 's', dark='d', bw=10, bh=5, bcol='k')
        p.poly([(18, 78), (30, 70), (52, 70), (62, 78), (62, 92), (18, 92)], 'b', 'o')
        p.poly([(20, 79), (30, 72), (44, 72), (38, 78), (22, 84)], 'l'); p.line([(24, 76), (32, 71)], 'h')
        p.poly([(24, 84), (40, 84), (40, 92), (24, 92)], 's', 'o'); p.poly([(40, 80), (46, 80), (46, 86), (40, 86)], 'g', 'o')
        p.poly([(58, 76), (74, 74), (82, 80), (84, 88), (76, 92), (60, 92)], 'b', 'o')
        p.line([(62, 78), (72, 76)], 'l'); p.line([(70, 82), (74, 83)], 'o', 2)
        p.poly([(78, 84), (86, 86), (86, 90), (80, 92)], 's', 'o')
        cap(p, [(66, 76), (64, 70), (68, 66), (74, 65)], 4, 't', lit='w'); cap(p, [(73, 65), (78, 65)], 2, 'w', edge='o')
        return clean(p)
    q = P[n]; nk, hp = q['nk'], q['hp']
    arm(p, (nk[0]-13, nk[1]+6), q['bh'], False)
    leg_to(p, (hp[0]-6, hp[1]+6), q['bf'], 12, 12, 11, 's', dark='d', bw=11, bh=5, bcol='k')
    body(p, nk, hp)
    leg_to(p, (hp[0]+5, hp[1]+6), q['ff'], 12, 12, 11, 'b', dark='s', lit='l', bw=11, bh=5, bcol='k', blit='m')
    hx, hy = nk[0]-2, nk[1]-12+q['hd']
    labrys(p, q['fh'], q['ad'])
    arm(p, (nk[0]+1, nk[1]+8), q['fh'], True)
    head(p, hx, hy, n)
    return clean(p)

if __name__ == '__main__': build('minotaur-maze', CELL, PAL, draw)

