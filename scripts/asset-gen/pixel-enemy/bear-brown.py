"""Original brown bear, 64px: rears up on its hind legs and hammers down with both forepaws."""
import sys
sys.dont_write_bytecode = True
from beast_lib import Pen, run, blob, tube, bez, dot, ipt, mass, settle
CELL = 64
G = 60
PAL = dict(o='21150f', s='4a2c1c', b='76482c', l='9f6a3e', h='c4935e', m='5c3a26',
           t='d8b98c', c='efe2c2', n='2d1d18', e='f3c75a', r='9d3a3a', d='8a7157')


def fur_tuft(p, x, y, dx):
    p.poly([(x, y), (x + dx, y + 2), (x, y + 3)], 's')




def head(p, hx, hy, n, open_=False, tilt=0):
    for ex, ey in [(hx - 4, hy - 6), (hx + 2, hy - 7)]:
        blob(p, ex, ey, 2.6, 2.6, 0, keys={'l': 'm', 'b': 'm', 's': 'm'})
        dot(p, ex, ey, 'n')
    blob(p, hx, hy, 8, 7, tilt)
    mx, my = hx + 7, hy + 2
    blob(p, mx, my, 4.5, 3.4, 5 + tilt, keys={'l': 't', 'b': 't', 's': 'd'})
    p.box((mx + 3, my - 2, mx + 4, my - 1), 'n')
    if open_:
        p.poly([(mx - 2, my + 2), (mx + 5, my + 1), (mx + 4, my + 6), (mx - 1, my + 4)], 'o')
        p.line([(mx, my + 4), (mx + 3, my + 4)], 'r')
        dot(p, mx + 4, my + 2, 'c'); dot(p, mx + 1, my + 2, 'c')
    else:
        p.line([(mx - 1, my + 2), (mx + 2, my + 2)], 'o')
    ex, ey = hx + 2, hy - 2
    if n == 'hit':
        p.line([(ex - 1, ey - 1), (ex + 1, ey), (ex - 1, ey + 1)], 'o')
    else:
        p.box((ex, ey, ex + 1, ey + 1), 'o'); dot(p, ex + 1, ey, 'e')
        p.line([(ex - 1, ey - 2), (ex + 2, ey - 1)], 'o')


def limb(p, top, knee, foot, far, r0=3.8, r1=3.3):
    base, sh = ('m', 's') if far else ('b', 's')
    tube(p, bez([(top[0], top[1], r0), (knee[0], knee[1], r1), (foot[0], foot[1] - 4, 2.8)]), base, 'o', sh)
    fx = foot[0]
    p.box((fx - 3, G - 3, fx + 3, G - 1), 'o')
    p.box((fx - 2, G - 3, fx + 2, G - 2), sh if far else 's')
    for k in (0, 2):
        dot(p, fx + 2, G - 3 + k // 2, 'c')


# ----- four-legged stance: idle / move / recover / hit -----
QUAD = {  # body centre, hump lift, head pos, leg foot x offsets (far fore, far hind, near fore, near hind)
    'idle_a':  ((28, 43), 0, (48, 41), (0, 0, 0, 0)),
    'idle_b':  ((28, 44), 0, (48, 42), (0, 0, 0, 0)),
    'idle_c':  ((28, 44), 1, (48, 43), (0, 0, 0, 0)),
    'move':    ((29, 43), 0, (50, 43), (6, -5, -3, 4)),
    'recover': ((27, 43), 0, (47, 40), (1, 0, -1, 0)),
    'hit':     ((25, 41), 0, (41, 32), (-2, 1, -3, 2)),
}


def quad(p, n):
    (cx, cy), lift, (hx, hy), off = QUAD[n]
    fore, hind = cx + 10, cx - 9
    limb(p, (fore + 1, cy + 2), (fore + 2 + off[0] // 2, cy + 9), (fore + 3 + off[0], G), True)
    limb(p, (hind + 2, cy + 2), (hind + 1 + off[1] // 2, cy + 9), (hind + 1 + off[1], G), True)
    tube(p, bez([(hind - 7, cy - 4, 1.5), (hind - 9, cy - 3, 1.2)]), 's', 'o')  # stub tail
    tilt = -4 if n != 'hit' else -12
    # barrel + shoulder hump (the bear's signature silhouette) as one furry mass
    mass(p, [(cx, cy, 17, 10, tilt), (cx + 8, cy - 5 - lift, 9, 7, -10), (cx - 9, cy + 1, 8, 8, 0)],
         light_c=(cx + 2, cy - 2), light_r=16)
    blob(p, cx - 1, cy + 6, 11, 3, -4, edge=None, keys={'l': 's', 'b': 's'})
    for x, y in [(cx - 10, cy - 6), (cx - 3, cy - 9), (cx + 4, cy - 12 - lift)]:
        p.line([(x, y), (x + 3, y - 1)], 'h')
    head(p, hx, hy, n, open_=(n == 'hit'), tilt=-15 if n == 'hit' else 0)
    limb(p, (fore - 1, cy + 3), (fore + off[2] // 2, cy + 10), (fore + 1 + off[2], G), False, 4.2, 3.6)
    limb(p, (hind, cy + 4), (hind - 1 + off[3] // 2, cy + 10), (hind + off[3], G), False, 4.6, 3.6)
    if n == 'move':
        for x, y in [(10, 58), (13, 56), (8, 55)]:
            p.box((x, y, x + 1, y + 1), 'd')


# ----- reared windup and forward slam -----
def reared(p, n):
    if n == 'windup':
        cx, cy, ang, hxy = 28, 37, 75, (36, 18)
        arms_far = [(33, 29), (29, 19), (27, 10)]
        arms_near = [(27, 30), (21, 21), (18, 12)]
        legs = [(23, 22, 21), (30, 32, 33)]
    else:  # attack: body pitched forward, both paws smashed onto the ground in front
        cx, cy, ang, hxy = 30, 42, 25, (42, 32)
        arms_far = [(38, 38), (47, 44), (54, 55)]
        arms_near = [(36, 40), (45, 47), (50, 56)]
        legs = [(20, 19, 16), (26, 25, 24)]
    # hind legs carry all the weight
    for (top, knee, foot), far in zip(legs, (True, False)):
        limb(p, (top, cy + 8), (knee + 1, G - 8), (foot + 2, G), far, 5.8, 4.4)
    s0, e0, w0 = arms_far
    tube(p, bez([(s0[0], s0[1], 4.2), (e0[0], e0[1], 3.5), (w0[0], w0[1], 3)]), 'm', 'o', 's')
    blob(p, w0[0], w0[1], 3.6, 3.2, 0, keys={'l': 'm', 'b': 'm'})
    blob(p, cx, cy, 17, 13, ang)
    blob(p, cx + (2 if n == 'windup' else 1), cy + (1 if n == 'windup' else 5), 9 if n == 'windup' else 12, 4, ang,
         edge=None, keys={'l': 'l', 'b': 'l', 's': 'b'})
    head(p, *hxy, n, open_=True, tilt=-8 if n == 'windup' else 12)
    s1, e1, w1 = arms_near
    tube(p, bez([(s1[0], s1[1], 4.8), (e1[0], e1[1], 4), (w1[0], w1[1], 3.2)]), 'b', 'o', 's', 'l')
    blob(p, w1[0], w1[1], 3.8, 3.4, 0)
    for w in (w0, w1):
        dx = 1 if n == 'windup' else 3
        for k in range(3):
            dot(p, w[0] + dx + (k == 1), w[1] - 1 + k, 'c') if n == 'attack' else dot(p, w[0] - 1 + k, w[1] - 3 - (k == 1), 'c')
    if n == 'attack':
        for x, y in [(58, 58), (56, 55), (61, 56), (46, 58), (43, 57)]:
            p.box((x, y, x + 1, y + 1), 'd')
        p.line([(42, 60), (61, 60)], 'd')


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        tube(p, bez([(18, 55, 3.4), (11, 57, 2.5)]), 's', 'o', 'm')
        blob(p, 29, 53, 18, 7, -3)
        blob(p, 29, 56, 13, 2.6, -3, edge=None, keys={'l': 's', 'b': 's'})
        blob(p, 51, 55, 7.5, 5.5, 8)
        blob(p, 47, 49, 2.3, 2.3, 0, keys={'l': 'm', 'b': 'm'})
        blob(p, 58, 57, 3.3, 2.3, 8, keys={'l': 't', 'b': 't', 's': 'd'})
        dot(p, 60, 56, 'n')
        p.line([(51, 53), (53, 55)], 'o'); p.line([(53, 53), (51, 55)], 'o')
        tube(p, bez([(36, 51, 3.6), (41, 57, 3)]), 'b', 'o', 's')
        blob(p, 42, 57, 3.3, 2.4, 0)
        settle(p, G)
        return p
    if n in ('windup', 'attack'):
        reared(p, n)
    else:
        quad(p, n)
    return p


if __name__ == '__main__':
    run('bear-brown', CELL, PAL, draw)

