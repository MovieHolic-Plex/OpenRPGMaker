"""Original frost lich. Skull under a jagged crown, tall blue robe with fur
trim, a crystal-topped staff; the free hand gathers and throws an ice orb.
64px, shoot (casts in place)."""
import sys
sys.dont_write_bytecode = True
from pe_lib import Pen, build
from pe_review import review
CELL = 64
PAL = dict(o='1c1a30', d='24306a', s='3450a0', b='4f7fd0', l='8fb8ee', c='d4b04a', g='f4e08a',
           k='cfc6ad', w='f3eedc', i='a6ecff', h='e9fdff', v='5b4a8a', e='7ff0ff')

POSE = {  # dx, bob, staff tilt
    'idle_a': (0, 0, 0), 'idle_b': (0, 1, 0), 'idle_c': (0, 2, 0),
    'windup': (-2, 0, -2), 'move': (0, 1, -1), 'attack': (3, 1, 2), 'recover': (1, 1, 1), 'hit': (-4, 0, -3),
}


def orb(p, x, y, r):
    p.d.ellipse((x - r - 1, y - r - 1, x + r + 1, y + r + 1), fill=p.pal['o'])
    p.d.ellipse((x - r, y - r, x + r, y + r), fill=p.pal['i'])
    p.d.ellipse((x - r, y - r, x, y), fill=p.pal['h'])
    p.box((x + r - 1, y, x + r - 1, y + r - 2), 'l')


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # an empty robe pooled on the floor, crown and skull tumbled forward, staff down
        p.line([(10, 58), (44, 55)], 'o', 3); p.line([(10, 58), (44, 55)], 'v')
        p.poly([(8, 58), (6, 55), (9, 52), (12, 55)], 'i', 'o')
        p.poly([(14, 60), (18, 55), (27, 52), (37, 53), (42, 57), (43, 60)], 's', 'o')
        p.poly([(18, 57), (26, 54), (32, 55), (22, 58)], 'b')
        p.line([(15, 59), (42, 59)], 'k')
        p.poly([(40, 60), (41, 55), (45, 53), (50, 54), (51, 58), (49, 60)], 'w', 'o')
        p.box((46, 56, 47, 57), 'o')
        p.poly([(49, 52), (52, 49), (54, 52), (56, 50), (57, 54), (51, 55)], 'c', 'o')
        return p
    dx, bob, tilt = POSE[n]
    x, y = dx, bob + 16
    # ---- staff behind the body (far hand)
    top = (45 + tilt + x, 10 + y)
    tx, ty = top
    # tall spiked collar behind the skull
    p.poly([(21 + x, 26 + y), (19 + x, 14 + y), (24 + x, 20 + y), (26 + x, 12 + y), (28 + x, 20 + y), (36 + x, 21 + y), (38 + x, 26 + y)], 'd', 'o')
    p.line([(20 + x, 16 + y), (23 + x, 22 + y)], 's')
    # ---- robe: wide A shape to the floor, fur hem, dark folds
    p.poly([(22 + x, 26 + y), (36 + x, 26 + y), (40 + x // 2, 51), (45, 60), (15, 60), (19 + x // 2, 51)], 's', 'o')
    p.poly([(23 + x, 27 + y), (29 + x, 27 + y), (24 + x // 2, 51), (19, 57), (17, 57)], 'b')
    p.line([(23 + x, 28 + y), (18, 55)], 'l')
    p.line([(33 + x, 30 + y), (38, 56)], 'd'); p.line([(28 + x, 34 + y), (29, 58)], 'd')
    p.line([(40 + x // 2, 52), (43, 58)], 'd')
    p.line([(16, 59), (44, 59)], 'k'); p.line([(17, 58), (24, 58)], 'w')
    for fx in range(18, 44, 4): p.box((fx, 60, fx, 60), 'k')
    p.poly([(22 + x, 33 + y), (37 + x, 33 + y), (36 + x, 35 + y), (23 + x, 35 + y)], 'c', 'o')
    p.line([(24 + x, 33 + y), (29 + x, 33 + y)], 'g')
    # ---- fur mantle across shoulders
    p.poly([(19 + x, 26 + y), (24 + x, 22 + y), (35 + x, 22 + y), (40 + x, 26 + y), (37 + x, 29 + y), (22 + x, 29 + y)], 'k', 'o')
    p.line([(22 + x, 24 + y), (28 + x, 23 + y)], 'w')
    # ---- skull head and crown
    hx, hy = 25 + x + (1 if n == 'attack' else 0), 10 + y + (1 if n == 'hit' else 0)
    p.poly([(hx, hy + 5), (hx + 2, hy + 2), (hx + 8, hy + 2), (hx + 11, hy + 5), (hx + 12, hy + 9), (hx + 14, hy + 10), (hx + 12, hy + 12), (hx + 10, hy + 14), (hx + 3, hy + 14), (hx, hy + 11)], 'k', 'o')
    p.poly([(hx + 2, hy + 3), (hx + 7, hy + 3), (hx + 4, hy + 6), (hx + 1, hy + 8)], 'w')
    p.box((hx + 7, hy + 6, hx + 10, hy + 9), 'o')
    glow = 'e' if n != 'hit' else 'i'
    p.box((hx + 9, hy + 7, hx + 9, hy + 7), glow); p.box((hx + 8, hy + 8, hx + 9, hy + 8), glow if n in ('windup', 'attack') else 'o')
    p.box((hx + 12, hy + 10, hx + 12, hy + 10), 'o')
    teeth = ['wowow', 'owowo'] if n in ('windup', 'attack') else ['wowow']
    p.grid(hx + 6, hy + 12, teeth)
    p.line([(hx + 3, hy + 12), (hx + 5, hy + 13)], 's')
    # crown: band + five teeth, one ice gem
    cy = hy + 1
    p.poly([(hx - 1, cy + 2), (hx + 12, cy + 2), (hx + 12, cy - 1), (hx - 1, cy - 1)], 'c', 'o')
    for i, (px, h) in enumerate([(hx - 1, 4), (hx + 2, 5), (hx + 5, 6), (hx + 8, 5), (hx + 11, 4)]):
        p.poly([(px, cy - 1), (px + 1, cy - 1 - h), (px + 2, cy - 1)], 'c', 'o')
    p.line([(hx, cy), (hx + 5, cy)], 'g')
    p.box((hx + 5, cy, hx + 7, cy + 1), 'i'); p.box((hx + 5, cy, hx + 5, cy), 'h')
    # ---- staff held in front by the far hand, crystal above the crown
    p.line([(42 + x, 60), top], 'o', 3); p.line([(42 + x, 60), top], 'v')
    p.line([(42 + x, 59), (tx - 1, ty + 8)], 'd')
    p.poly([(tx, ty - 7), (tx + 3, ty - 3), (tx + 1, ty + 1), (tx - 2, ty + 1), (tx - 3, ty - 3)], 'i', 'o')
    p.line([(tx - 1, ty - 5), (tx - 2, ty - 2)], 'h')
    p.line([(tx - 3, ty + 2), (tx + 3, ty + 2)], 'c')
    p.grid(tx + 3, ty - 8, ['h'])
    hy2 = 30 + y
    hx2 = 42 + x + round((tx - 42 - x) * (60 - hy2) / (60 - ty))
    p.grid(hx2 - 2, hy2 - 1, ['.ok.', 'owko', '.oo.'])
    # ---- casting arm (near) and the ice orb
    if n == 'windup':
        arm = [(24 + x, 27 + y), (18 + x, 21 + y), (15 + x, 15 + y)]; ob = ((13 + x, 11 + y), 3)
    elif n == 'move':
        arm = [(24 + x, 27 + y), (21 + x, 32 + y), (24 + x, 34 + y)]; ob = ((28 + x, 33 + y), 2)
    elif n == 'attack':
        arm = [(26 + x, 27 + y), (34 + x, 28 + y), (43 + x, 27 + y)]; ob = ((53, 41), 5)
    elif n == 'recover':
        arm = [(25 + x, 27 + y), (30 + x, 31 + y), (35 + x, 32 + y)]; ob = None
    elif n == 'hit':
        arm = [(23 + x, 27 + y), (18 + x, 30 + y), (16 + x, 27 + y)]; ob = None
    else:
        arm = [(24 + x, 27 + y), (22 + x, 32 + y), (26 + x, 35 + y)]; ob = None
    p.line(arm, 'o', 6); p.line(arm, 'b', 4); p.line(arm[:2], 'l')
    ex, ey = arm[-1]
    p.grid(ex - 1, ey - 1, ['ok.', 'wko', '.o.'])
    if ob:
        (ox, oy), r = ob
        orb(p, ox, oy, r)
        if n == 'attack':
            for k, (ax, ay) in enumerate([(45, 37), (44, 45), (47, 48)]):
                p.line([(ax, ay), (ax - 3 + k, ay)], 'i')
            p.grid(58, 38, ['h.', '.i', 'h.'])
        if n == 'windup':
            p.grid(9, 22, ['i...h', '.....', 'h....'])
    if n == 'hit':
        p.grid(hx + 13, hy - 1, ['i.', '.h'])
    return p


if __name__ == '__main__':
    build('lich-frost', CELL, PAL, draw)
    review('lich-frost', CELL)

