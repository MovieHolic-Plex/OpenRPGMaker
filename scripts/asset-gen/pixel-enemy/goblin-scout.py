"""Original goblin scout: big swept ears, hooked nose, leather vest, low dagger dash."""
import sys
sys.dont_write_bytecode = True
from pe_lib import Pen
from pe_rig import build, cap, ik, put
CELL = 48
PAL = dict(o='1c2024', s='3d6a2c', b='6b9a3a', l='9dc653', e='f2d24a', w='ece3c3',
           v='4e3326', c='865635', k='b98a52', m='aeb8bf', h='eef2ee', r='6e2f2f')

HEAD = [
    "oo..............",
    "olo....oooo.....",
    ".olo.oolllbo....",
    ".oblooblllbbo...",
    "..obbolbbbbbbo..",
    "..osbbbbbbbeobo.",
    "...ossbbbbbbbbbo",
    "....oosbbbbbooo.",
    ".....osbbbowwo..",
    "......osssoooo..",
    ".......oooo.....",
]
HEAD_HIT = [r.replace('eo', 'oo') for r in HEAD]
HEAD_HIT[8] = ".....osbbboooo.."
HEAD_ATK = [r for r in HEAD]
HEAD_ATK[8] = ".....osbbbowwwo."
HEAD_ATK[9] = "......osssorro.."

# pose: hip, neck, head(top-left), front hand, back hand, front foot, back foot, blade dir
P = {
 'idle_a': dict(hip=(22,35), neck=(23,28), head=(16,17), fh=(29,34), bh=(17,34), ff=(27,44), bf=(18,44), blade=(1,0.35)),
 'idle_b': dict(hip=(22,36), neck=(23,29), head=(16,18), fh=(29,35), bh=(17,35), ff=(27,44), bf=(18,44), blade=(1,0.35)),
 'idle_c': dict(hip=(22,36), neck=(23,30), head=(16,19), fh=(29,35), bh=(17,36), ff=(27,44), bf=(18,44), blade=(1,0.45)),
 'windup': dict(hip=(20,38), neck=(18,31), head=(10,21), fh=(12,28), bh=(24,35), ff=(30,44), bf=(14,44), blade=(-0.4,-1)),
 'move':   dict(hip=(21,34), neck=(27,29), head=(22,18), fh=(17,37), bh=(31,33), ff=(32,41), bf=(10,40), blade=(-1,0.2)),
 'attack': dict(hip=(24,37), neck=(30,31), head=(26,20), fh=(37,31), bh=(20,35), ff=(34,44), bf=(12,44), blade=(1,0)),
 'recover':dict(hip=(23,36), neck=(25,29), head=(18,18), fh=(31,37), bh=(18,35), ff=(29,44), bf=(17,44), blade=(0.8,0.7)),
 'hit':    dict(hip=(20,36), neck=(17,29), head=(8,19), fh=(27,28), bh=(10,33), ff=(25,44), bf=(16,44), blade=(0.3,-1)),
}

def dagger(p, hand, d):
    x, y = hand; dx, dy = d
    L = (dx*dx+dy*dy) ** 0.5; dx, dy = dx/L, dy/L
    tip = (x+dx*7, y+dy*7); guard = (x+dx*1.5, y+dy*1.5)
    cap(p, [(x-dx*2, y-dy*2), guard], 1, 'c', edge=None)
    cap(p, [guard, tip], 2, 'm', edge='o')
    p.line([(round(x+dx*2), round(y+dy*2-(1 if abs(dx)>abs(dy) else 0))), (round(tip[0]-dx), round(tip[1]-dy-(1 if abs(dx)>abs(dy) else 0)))], 'h')
    gx, gy = -dy, dx
    p.line([(round(guard[0]+gx*2), round(guard[1]+gy*2)), (round(guard[0]-gx*2), round(guard[1]-gy*2))], 'k')

def leg(p, hip, foot, col, dark):
    # foot[1] is the sole line; the shin ends 3px above it so the outline lands on it.
    knee, end = ik(hip, (foot[0], foot[1]-3), 5, 5, bend=-1 if foot[0] >= hip[0] else 1)
    cap(p, [hip, knee, end], 3, col, lit=None, dark=dark)
    fx, fy = end[0], foot[1]
    p.poly([(fx-2, fy-3), (fx+2, fy-3), (fx+4, fy), (fx-2, fy)], 'v', 'o')
    p.line([(fx-1, fy-2), (fx+2, fy-2)], 'c')

def arm(p, sh, hand, col, dark, lit=None):
    el, end = ik(sh, hand, 5, 5, bend=1)
    cap(p, [sh, el, end], 3, col, lit=lit, dark=dark)
    return end

def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # Fell backwards: head left, belly up, dagger dropped in front of the knees.
        cap(p, [(20, 41), (30, 42), (36, 42)], 3, 'b', dark='s')
        p.poly([(38, 39), (41, 39), (42, 43), (36, 43)], 'v', 'o')
        p.poly([(14, 37), (26, 37), (28, 43), (13, 43)], 'c', 'o')
        p.line([(15, 38), (25, 38)], 'k')
        put(p, 5, 35, ["oo........", "olooooo...", ".oblllboo.", "..obbbbbbo", "..osboosbo", "...ooooooo"])
        cap(p, [(18, 40), (22, 39), (27, 40)], 3, 'b', dark='s')
        cap(p, [(38, 44), (45, 44)], 1, 'm', edge=None); p.line([(35, 44), (37, 44)], 'c')
        return p
    q = P[n]; hip, neck = q['hip'], q['neck']
    sh_b = (neck[0]-1, neck[1]+2); sh_f = (neck[0]+2, neck[1]+2)
    arm(p, sh_b, q['bh'], 's', None)
    leg(p, (hip[0]-1, hip[1]), q['bf'], 's', None)
    # Vest torso: trapezoid from shoulders to hip, lit left edge.
    nx, ny = neck; hx, hy = hip
    # Pot belly under an open leather vest: green belly shows through the front opening.
    p.poly([(nx-4, ny), (nx+4, ny), (hx+6, hy-2), (hx+5, hy+1), (hx-4, hy+1), (hx-5, hy-2)], 'c', 'o')
    p.poly([(nx+2, ny+1), (nx+4, ny+1), (hx+5, hy-2), (hx+4, hy-1), (hx+1, hy-1)], 'b')
    p.line([(nx+3, ny+2), (hx+3, hy-2)], 'l')
    p.line([(nx-3, ny+1), (hx-4, hy-2)], 'k')
    p.line([(hx-4, hy), (hx+4, hy)], 'v')
    p.box((hx, hy, hx+1, hy), 'k')
    leg(p, (hip[0]+1, hip[1]), q['ff'], 'b', 's')
    head = HEAD_HIT if n == 'hit' else HEAD_ATK if n in ('attack', 'windup') else HEAD
    put(p, *q['head'], head)
    hand = arm(p, sh_f, q['fh'], 'b', 's')
    dagger(p, hand, q['blade'])
    p.box((hand[0]-1, hand[1]-1, hand[0]+1, hand[1]+1), 'b')
    p.line([(hand[0]-1, hand[1]-1), (hand[0], hand[1]-1)], 'l')
    return p

if __name__ == '__main__': build('goblin-scout', CELL, PAL, draw)

