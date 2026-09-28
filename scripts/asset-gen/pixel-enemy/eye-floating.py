"""Original floating eye. A large veined eyeball with a heavy upper lid, a
fringe of tentacles trailing below, firing a beam from the pupil. 48px, shoot."""
import sys
sys.dont_write_bytecode = True
from pe_lib import Pen, build
from pe_review import review
CELL = 48
PAL = dict(o='2a1830', d='4e2a52', s='7a3f74', b='a65d92', l='d690b8', w='f2e6dc', g='c7b6b0',
           v='c24a4a', i='3fa36a', j='8fe07a', k='0f0a12', y='fffbc8', h='ffffff')

POSE = {  # dx, dy, lid (0 open, 1 half, 2 squint), tentacle phase, pupil dx
    'idle_a': (0, 0, 0, 0, 1), 'idle_b': (0, -1, 0, 1, 1), 'idle_c': (0, -2, 0, 2, 1),
    'windup': (-2, -1, 2, 1, 0), 'move': (1, -1, 0, 2, 2), 'attack': (0, 0, 0, 0, 3),
    'recover': (1, 0, 1, 1, 2), 'hit': (-3, -2, 2, 2, -1),
}


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # fallen eye on the floor, lid shut, tentacles limp
        for pts in [[(12, 43), (16, 41), (19, 42)], [(28, 42), (33, 43), (37, 42)], [(18, 43), (22, 42)]]:
            p.line(pts, 'o', 3); p.line(pts, 's')
        p.d.ellipse((15, 32, 31, 44), fill=p.pal['o'])
        p.d.ellipse((16, 34, 30, 43), fill=p.pal['s'])
        p.d.ellipse((17, 34, 26, 40), fill=p.pal['b'])
        p.line([(18, 41), (29, 40)], 'o'); p.line([(19, 40), (28, 39)], 'l')
        p.box((19, 36, 20, 36), 'l')
        return p
    dx, dy, lid, ph, pdx = POSE[n]
    cx, cy = 24 + dx, 21 + dy
    # ---- tentacles below and behind (drawn first)
    sway = [0, 1, -1][ph]
    tent = [
        [(cx - 7, cy + 7), (cx - 10, cy + 12), (cx - 9 + sway, cy + 16), (cx - 12 + sway, cy + 19)],
        [(cx - 3, cy + 9), (cx - 4, cy + 14), (cx - 2 - sway, cy + 18), (cx - 4 - sway, cy + 20)],
        [(cx + 2, cy + 9), (cx + 3, cy + 14), (cx + 1 + sway, cy + 17), (cx + 3 + sway, cy + 19)],
        [(cx + 6, cy + 7), (cx + 9, cy + 11), (cx + 8 - sway, cy + 15), (cx + 11 - sway, cy + 17)],
    ]
    if n == 'windup':
        tent = [[(a, b - (k * 1)) for k, (a, b) in enumerate(t)] for t in tent]
        tent[0][-1] = (cx - 15, cy + 12); tent[3][-1] = (cx + 13, cy + 12)
    if n == 'hit':
        tent = [[(a + k, b) for k, (a, b) in enumerate(t)] for t in tent]
    for k, t in enumerate(tent):
        p.line(t, 'o', 3); p.line(t, 'd' if k in (0, 3) else 's')
        p.line(t[:2], 'b')
    # ---- fleshy stalk trailing back-left, gives the eye a facing
    tail = [(cx - 8, cy - 3), (cx - 13, cy - 5 + sway), (cx - 17, cy - 3 + sway), (cx - 19, cy + 1)]
    if n == 'hit': tail = [(a + 2, b - 2) for a, b in tail]
    p.line(tail, 'o', 5); p.line(tail, 's', 3); p.line(tail[:3], 'b')
    p.box((tail[-1][0], tail[-1][1], tail[-1][0], tail[-1][1]), 'd')
    # ---- eyeball
    R = 11
    p.d.ellipse((cx - R - 1, cy - R - 1, cx + R + 1, cy + R + 1), fill=p.pal['o'])
    p.d.ellipse((cx - R, cy - R, cx + R, cy + R), fill=p.pal['g'])
    p.d.ellipse((cx - R, cy - R, cx + R - 3, cy + R - 3), fill=p.pal['w'])
    # veins from the back rim
    for pts in [[(cx - 10, cy - 2), (cx - 7, cy - 1), (cx - 5, cy + 1)], [(cx - 8, cy + 6), (cx - 5, cy + 4)], [(cx - 3, cy + 10), (cx - 2, cy + 7)]]:
        p.line(pts, 'v')
    # iris + pupil, looking right toward the party
    ix, iy = cx + 3 + pdx, cy + 1
    p.d.ellipse((ix - 5, iy - 5, ix + 5, iy + 5), fill=p.pal['o'])
    p.d.ellipse((ix - 4, iy - 4, ix + 4, iy + 4), fill=p.pal['i'])
    p.d.ellipse((ix - 4, iy - 4, ix + 1, iy + 1), fill=p.pal['j'])
    pr = 2 if n != 'windup' else 1
    if n == 'attack': pr = 3
    p.d.ellipse((ix - pr + 1, iy - pr, ix + pr + 1, iy + pr), fill=p.pal['k' if n != 'attack' else 'y'])
    p.box((ix - 2, iy - 3, ix - 1, iy - 2), 'h')
    # ---- heavy fleshy upper lid, lower rim
    lid_y = [cy - 8, cy - 4, cy - 1][lid]
    p.poly([(cx - R - 1, cy + 1), (cx - 9, cy - 8), (cx - 3, cy - R - 2), (cx + 4, cy - R - 2), (cx + 10, cy - 7), (cx + R + 1, lid_y + 4), (cx + 4, lid_y + 1), (cx - 4, lid_y + 3), (cx - 9, cy + 2)], 's', 'o')
    p.poly([(cx - 9, cy - 7), (cx - 3, cy - R - 1), (cx + 3, cy - R - 1), (cx - 3, cy - 8), (cx - 8, cy - 3)], 'b')
    p.line([(cx - 3, cy - R), (cx + 1, cy - R)], 'l')
    p.line([(cx - 9, cy + 2), (cx - 4, lid_y + 3), (cx + 4, lid_y + 1), (cx + R, lid_y + 4)], 'o')
    p.line([(cx - 8, cy + 1), (cx - 4, lid_y + 2)], 'd')
    p.d.arc((cx - R, cy - R + 2, cx + R, cy + R + 1), 20, 160, fill=p.pal['d'])
    # little horn-nubs on top
    p.grid(cx - 5, cy - R - 4, ['.o.', 'obo'])
    p.grid(cx + 2, cy - R - 3, ['.o.', 'obo'])
    if n == 'windup':
        # energy gathers: sparks converge on the pupil
        for sx, sy in [(ix + 6, iy - 6), (ix + 7, iy + 5), (ix + 9, iy)]:
            p.box((sx, sy, sx, sy), 'y')
        p.grid(ix + 4, iy - 1, ['y.', '.y', 'y.'])
    if n == 'attack':
        # beam from the pupil to the right edge
        p.box((ix + 3, iy - 2, 45, iy + 2), 'j')
        p.box((ix + 3, iy - 1, 45, iy + 1), 'y')
        p.line([(ix + 3, iy), (45, iy)], 'h')
        p.grid(ix + 6, iy - 4, ['j...j'])
        p.grid(ix + 9, iy + 4, ['j.j'])
    if n == 'hit':
        p.line([(ix - 1, iy - 1), (ix + 1, iy + 1)], 'v'); p.line([(ix + 1, iy - 1), (ix - 1, iy + 1)], 'v')
        p.grid(cx + R + 2, cy - R, ['y.', '.l'])
    return p


if __name__ == '__main__':
    build('eye-floating', CELL, PAL, draw)
    review('eye-floating', CELL, airborne=('idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit'))

