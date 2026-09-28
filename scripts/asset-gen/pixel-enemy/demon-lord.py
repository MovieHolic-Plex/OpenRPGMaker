"""Original demon lord (final boss): horned crown, high-collared crimson-lined cloak, black plate,
glowing red eyes, clawed hand that breathes a violet dark flame.

breath motion (in place): windup rears back and gathers a dark orb in the open claw,
move swells the orb while the cloak flares, attack thrusts forward and pours a violet flame stream.
"""
import sys, math
sys.dont_write_bytecode = True
from pe_lib import Pen
from pe_rig import build, cap, put, limb, leg_to, clean
CELL = 96
PAL = dict(o='120c18', d='241a30', s='3a2c4a', b='564468', l='7e6a92', r='5a1424', c='9a2438', e='ff4040',
           y='ffd060', p='7a3cc8', v='b070f0', w='f0d8ff', k='c8b8a0', g='8a7a64')

P = {
 #        neck      hip      claw hand   back hand   front foot  back foot   cloak flare  orb
 'idle_a': dict(nk=(46,40), hp=(45,64), fh=(58,60), bh=(34,62), ff=(50,92), bf=(40,92), cf=0, orb=0, hd=0),
 'idle_b': dict(nk=(46,41), hp=(45,65), fh=(58,61), bh=(34,63), ff=(50,92), bf=(40,92), cf=1, orb=0, hd=0),
 'idle_c': dict(nk=(46,42), hp=(45,65), fh=(58,62), bh=(34,64), ff=(50,92), bf=(40,92), cf=2, orb=1, hd=0),
 'windup': dict(nk=(42,41), hp=(44,64), fh=(28,58), bh=(32,60), ff=(53,92), bf=(37,92), cf=4, orb=2, hd=-2),
 'move':   dict(nk=(42,40), hp=(44,64), fh=(27,54), bh=(32,58), ff=(53,92), bf=(37,92), cf=6, orb=3, hd=-2),
 'attack': dict(nk=(50,42), hp=(46,65), fh=(64,48), bh=(34,60), ff=(55,92), bf=(36,92), cf=-3, orb=0, hd=1),
 'recover':dict(nk=(47,41), hp=(45,65), fh=(60,56), bh=(34,62), ff=(51,92), bf=(40,92), cf=0, orb=1, hd=0),
 'hit':    dict(nk=(40,41), hp=(43,64), fh=(30,50), bh=(26,56), ff=(49,92), bf=(40,92), cf=5, orb=0, hd=-3),
}

def head(p, x, y, n):
    """Gaunt pale-violet face under a spiked crown, great ram horns curling back, burning eyes."""
    # horns behind the crown: rise backwards then hook forward
    cap(p, [(x+3, y+1), (x-3, y-5), (x-9, y-5), (x-12, y+1), (x-10, y+7), (x-5, y+8)], 4, 'k', dark='g')
    cap(p, [(x-5, y+8), (x-2, y+5)], 2, 'k', edge='o')
    for a, b in (((x-4, y-6), (x-4, y-3)), ((x-10, y-3), (x-7, y-2)), ((x-11, y+4), (x-8, y+3))): p.line([a, b], 'g')
    # second, forward horn tip sweeping up past the crown
    cap(p, [(x+10, y), (x+16, y-4), (x+18, y-9)], 3, 'k', dark='g'); cap(p, [(x+18, y-8), (x+17, y-12)], 1, 'k', edge='o')
    p.poly([(x-2, y+3), (x+4, y-2), (x+12, y-2), (x+15, y+3), (x+15, y+11), (x+11, y+15), (x+4, y+15), (x-1, y+10)], 'l', 'o')
    p.poly([(x, y+3), (x+5, y), (x+10, y), (x+6, y+4), (x+2, y+8)], 'w')
    p.line([(x+9, y+8), (x+14, y+9)], 'b'); p.line([(x+6, y+12), (x+10, y+13)], 's')    # cheekbone, mouth shadow
    # crown band and spikes
    p.poly([(x-2, y), (x+14, y-1), (x+14, y+2), (x-2, y+3)], 'y', 'o')
    for k, hgt in enumerate((5, 8, 6, 4)):
        bx = x + k*4
        p.poly([(bx-1, y), (bx+1, y-hgt), (bx+3, y)], 'y', 'o')
    p.line([(x+5, y+1), (x+6, y+1)], 'c')
    # eyes: burning red slits with a glow pixel
    if n == 'hit':
        p.line([(x+9, y+6), (x+13, y+7)], 'o')
    else:
        p.line([(x+8, y+6), (x+13, y+6)], 'o'); p.line([(x+9, y+6), (x+12, y+6)], 'e'); p.line([(x+13, y+5), (x+13, y+5)], 'y')
    if n in ('attack', 'windup', 'move'):
        p.poly([(x+7, y+11), (x+14, y+11), (x+13, y+15), (x+8, y+15)], 'o'); p.line([(x+9, y+14), (x+12, y+14)], 'c')
        p.line([(x+8, y+11), (x+8, y+12)], 'w'); p.line([(x+13, y+11), (x+13, y+12)], 'w')

def cloak_back(p, nk, hp, cf):
    """Cloak behind the body: flares back-left (cf px) and billows to the floor, crimson lining shows at the hem."""
    nx, ny = nk
    hem = 90
    pts = [(nx-4, ny-3), (nx-14, ny), (nx-22-cf, ny+22), (nx-28-cf*2, hem-6), (nx-24-cf*2, hem), (nx-14-cf, hem-3),
           (nx-6, hem), (nx+4, hem-2), (nx+10, hem), (nx+6, ny+6)]
    p.poly(pts, 'd', 'o')
    lining = [(nx-14, ny+2), (nx-20-cf, ny+22), (nx-25-cf*2, hem-6), (nx-22-cf*2, hem-2), (nx-15-cf, hem-5), (nx-12, ny+20)]
    p.poly(lining, 'r')
    p.line([(nx-17-cf, ny+14), (nx-23-cf*2, hem-5)], 'c')
    for fx in (nx-10, nx-2):
        p.line([(fx, ny+14), (fx-1-cf//2, hem-3)], 'o')

def collar(p, nk, cf):
    nx, ny = nk
    # tall flared collar framing the head, crimson inside
    p.poly([(nx-14, ny+4), (nx-19-cf//2, ny-14), (nx-11, ny-8), (nx-6, ny+2)], 'd', 'o')
    p.poly([(nx-13, ny+2), (nx-17-cf//2, ny-11), (nx-11, ny-6), (nx-8, ny+1)], 'r')
    p.line([(nx-15-cf//2, ny-9), (nx-11, ny+1)], 'c')

def armor(p, nk, hp):
    nx, ny = nk; hx, hy = hp
    # black plate cuirass with violet highlights and a red gem
    p.poly([(nx-10, ny+2), (nx+8, ny+1), (nx+10, ny+8), (hx+8, hy-4), (hx+7, hy+2), (hx-8, hy+2), (hx-9, hy-4), (nx-11, ny+8)], 's', 'o')
    p.poly([(nx-9, ny+3), (nx-1, ny+2), (nx-3, ny+9), (hx-6, hy-5), (nx-10, ny+9)], 'b')
    p.line([(nx-8, ny+3), (nx-2, ny+3)], 'l')
    p.line([(nx+1, ny+10), (hx+1, hy-2)], 'd')
    for k in range(3): p.line([(hx-7, hy-10+k*4), (hx+7, hy-10+k*4)], 'd')
    p.poly([(nx-2, ny+8), (nx+2, ny+6), (nx+5, ny+9), (nx+1, ny+12)], 'c', 'o'); p.line([(nx, ny+8), (nx+1, ny+8)], 'e')
    # pauldron with a spike
    p.poly([(nx+2, ny-1), (nx+12, ny), (nx+14, ny+7), (nx+6, ny+9), (nx+1, ny+5)], 'b', 'o')
    p.line([(nx+3, ny), (nx+11, ny+1)], 'l'); p.poly([(nx+8, ny), (nx+11, ny-6), (nx+12, ny)], 'k', 'o')
    # belt and faulds
    p.poly([(hx-9, hy), (hx+8, hy), (hx+8, hy+4), (hx-9, hy+4)], 'd', 'o'); p.box((hx-1, hy+1, hx+1, hy+2), 'y')
    p.poly([(hx-9, hy+4), (hx+8, hy+4), (hx+10, hy+14), (hx-10, hy+14)], 's', 'o')
    p.line([(hx-1, hy+5), (hx-1, hy+13)], 'd'); p.line([(hx-8, hy+5), (hx-9, hy+13)], 'b')

def claw(p, h, open_hand):
    x, y = h
    p.poly([(x-4, y-3), (x+3, y-4), (x+5, y+2), (x-3, y+4)], 'l', 'o')
    if open_hand:
        for k in range(3): cap(p, [(x+3, y-3+k*3), (x+7, y-5+k*3)], 1, 'w', edge='o')
    else:
        p.grid(x+3, y-2, ["ow", ".ow", "ow"])

def orb(p, x, y, r):
    if r <= 0: return
    if r == 1:
        p.grid(x-1, y-1, [".v.", "vwv", ".v."]); return
    R = r*2+1
    p.d.ellipse((x-R, y-R, x+R, y+R), fill=p.pal['p'], outline=p.pal['o'])
    p.d.ellipse((x-R+2, y-R+2, x+R-3, y+R-3), fill=p.pal['v'])
    p.box((x-1, y-1, x, y), 'w')
    # licking wisps
    for a in (-60, 30, 150):
        ax, ay = x+math.cos(math.radians(a))*(R+2), y+math.sin(math.radians(a))*(R+2)
        cap(p, [(x+math.cos(math.radians(a))*R, y+math.sin(math.radians(a))*R), (ax, ay-2)], 1, 'v', edge=None)

def flame_stream(p, x0, y0):
    """Dark flame pouring right: widening cone of violet tongues with a white-hot core."""
    tongues = [(0, 0, 30, 0), (2, -2, 26, -7), (2, 2, 27, 7), (6, -3, 18, -11), (6, 3, 20, 11)]
    outer = [(x0, y0-3), (x0+8, y0-6), (x0+10, y0-10), (x0+14, y0-8), (x0+19, y0-14), (x0+22, y0-9), (x0+27, y0-12), (x0+28, y0-6),
             (x0+31, y0-2), (x0+28, y0+2), (x0+30, y0+9), (x0+25, y0+8), (x0+22, y0+13), (x0+18, y0+8), (x0+12, y0+10), (x0+9, y0+6), (x0, y0+3)]
    outer = [(min(CELL-2, x), y) for x, y in outer]  # stream is clipped by the cell edge: it keeps flowing off-sheet
    p.poly(outer, 'p', 'o')
    inner = [(x0+2, y0-2), (x0+12, y0-5), (x0+22, y0-6), (x0+27, y0-1), (x0+23, y0+5), (x0+12, y0+5), (x0+2, y0+2)]
    p.poly([(min(CELL-3, x), y) for x, y in inner], 'v')
    p.poly([(x0+2, y0-1), (x0+14, y0-2), (x0+18, y0), (x0+14, y0+2), (x0+2, y0+1)], 'w')
    for tx, ty in ((x0+24, y0-12), (x0+28, y0+11), (x0+16, y0-13)):
        if tx < CELL-3: p.grid(tx-1, ty-1, [".p.", "pvp"])

def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # Fallen to one knee then down: cloak spread over the floor like a pool, crown rolled away, eyes out.
        p.poly([(8, 88), (20, 80), (44, 78), (66, 82), (80, 88), (82, 92), (6, 92)], 'd', 'o')
        p.poly([(12, 88), (22, 83), (40, 82), (30, 88)], 'r'); p.line([(16, 90), (30, 86)], 'c')
        p.poly([(30, 80), (52, 78), (58, 86), (56, 92), (30, 92)], 's', 'o'); p.line([(32, 81), (50, 79)], 'b')
        p.poly([(54, 80), (66, 78), (70, 84), (68, 90), (56, 90)], 'l', 'o'); p.line([(58, 85), (66, 85)], 'o')
        p.poly([(50, 78), (56, 74), (58, 80)], 'r', 'o')
        cap(p, [(58, 80), (54, 75), (55, 70), (60, 69), (62, 73)], 4, 'k', dark='g'); cap(p, [(62, 73), (60, 76)], 2, 'k', edge='o')
        p.poly([(76, 88), (86, 87), (86, 91), (76, 92)], 'y', 'o')
        for k in range(3): p.poly([(77+k*3, 88), (78+k*3, 84), (79+k*3, 88)], 'y', 'o')
        p.grid(18, 76, [".v.", "v.v"]); p.grid(40, 72, ["v.", ".v"])
        return clean(p)
    q = P[n]; nk, hp = q['nk'], q['hp']
    cloak_back(p, nk, hp, q['cf'])
    limb(p, (nk[0]-8, nk[1]+4), q['bh'], 12, 12, 6, 's', dark='d')
    claw(p, q['bh'], False)
    leg_to(p, (hp[0]-4, hp[1]+6), q['bf'], 10, 10, 8, 'd', bw=9, bh=4, bcol='o')
    back_pose = n in ('windup', 'move', 'hit')
    if back_pose:
        limb(p, (nk[0]+2, nk[1]+4), q['fh'], 12, 12, 6, 'b', dark='s', lit='l', bend=1)
        claw(p, q['fh'], n != 'hit')
        if q['orb']: orb(p, q['fh'][0]-2, q['fh'][1]-4, q['orb'])
    armor(p, nk, hp)
    leg_to(p, (hp[0]+4, hp[1]+6), q['ff'], 10, 10, 8, 's', dark='d', lit='b', bw=9, bh=4, bcol='d', blit='b')
    collar(p, nk, q['cf'])
    head(p, nk[0]-4 + q['hd'], nk[1]-15, n)
    fh = q['fh']
    if not back_pose:
        limb(p, (nk[0]+6, nk[1]+4), fh, 12, 12, 6, 'b', dark='s', lit='l', bend=-1)
        claw(p, fh, n == 'attack')
        if q['orb']: orb(p, fh[0]+3, fh[1]-5, q['orb'])
    if n == 'attack': flame_stream(p, fh[0]+6, fh[1])
    if n == 'recover': p.grid(fh[0]+8, fh[1]-4, [".v.", "v..", ".v."])
    return clean(p)

if __name__ == '__main__': build('demon-lord', CELL, PAL, draw)

