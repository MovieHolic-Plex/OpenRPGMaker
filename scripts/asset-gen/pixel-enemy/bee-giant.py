"""Original giant bee, 48px: striped yellow/black abdomen, translucent wings, forward sting.
Airborne; the abdomen curls under and the stinger thrusts toward the ally side."""
import math
import sys
sys.dont_write_bytecode = True
from beast_lib import Pen, run, blob, mass, tube, bez, dot, ipt, polar, tint_poly
CELL = 48
PAL = dict(o='1b1512', s='3b2e22', k='2a2320', y='f0c43a', l='fbe68a', d='b8852a',
           f='9f6f3c', g='d8aa62', w='cfe6f0', v='8fb2c8', t='e8e2d6', e='e9433c',
           a='5f7f95', c='f6f2e6')
# a: wing vein, w/v: membrane over sky, see-through tint keys map body colours under a wing
SEE = {'y': 'g', 'l': 'g', 'd': 'f', 'k': 'a', 's': 'a', 'o': 'o', 'f': 'a', 'g': 'v', 'e': 'e', 't': 'v', 'c': 'w'}


def stripes(u, v, r, L):
    band = int((u + 1.0) * 3.2) % 2  # four bands along the abdomen axis
    if band:
        return 'k' if L > -0.2 else 'o'
    if L > 0.35 and r < 0.8:
        return 'l'
    if L < -0.35:
        return 'd'
    return 'y'


def fuzz(u, v, r, L):
    if L > 0.3 and r < 0.8:
        return 'g'
    if L < -0.3:
        return 's'
    return 'f'


POSE = {  # thorax centre, abdomen direction from the waist (screen deg: 180 = straight back, 270 = down), wing beat
    'idle_a': ((27, 21), 205, 0), 'idle_b': ((27, 22), 207, 1), 'idle_c': ((27, 23), 209, 2),
    'windup': ((25, 19), 250, 0), 'move': ((26, 19), 285, 1), 'attack': ((22, 15), 318, 2),
    'recover': ((27, 21), 220, 1), 'hit': ((24, 20), 172, 2),
}


def wing(p, root, beat, big):
    ang = [70, 35, 5][beat] + (0 if big else -10)
    ln = 15 if big else 11
    tip = polar(root[0], root[1], 180 - ang + 10, ln)
    back = polar(root[0], root[1], 180 - ang + 40, ln * 0.7)
    front = polar(root[0], root[1], 180 - ang - 25, ln * 0.45)
    pts = [root, front, polar(root[0], root[1], 180 - ang - 5, ln * 0.9), tip, back]
    tint_poly(p, pts, 'w' if big else 'v', SEE, edge='a')
    p.line([ipt(root), ipt(polar(root[0], root[1], 180 - ang + 12, ln * 0.8))], 'a')


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # on its back on the ground: striped belly up, legs curled in the air
        blob(p, 18, 41, 8, 4.2, 0, fn=stripes)
        blob(p, 28, 40, 4.5, 4, 0, fn=fuzz)
        blob(p, 34, 41, 3.2, 3, 0, keys={'l': 'k', 'b': 'k', 's': 'o'})
        p.line([(35, 40), (36, 42)], 'e')
        for x in (25, 28, 31):
            p.line([(x, 37), (x + 1, 34), (x + 2, 35)], 'o')
        p.line([(10, 42), (8, 43)], 'o')
        tint_poly(p, [(20, 44), (22, 37), (27, 38), (26, 44)], 'v', SEE, edge='a')
        return p
    (tx, ty), aang, beat = POSE[n]
    # far wing behind
    wing(p, (tx - 1, ty - 3), (beat + 1) % 3, False)
    # abdomen: hangs off the waist behind/under the thorax
    ar = math.radians(aang)
    wx, wy = tx - 3, ty + 1
    ax_, ay_ = wx + math.cos(ar) * 8.5, wy - math.sin(ar) * 8.5
    ang_deg = -math.degrees(math.atan2(ay_ - wy, ax_ - wx))
    blob(p, ax_, ay_, 9.5, 6.2, -ang_deg, fn=stripes)
    # stinger at the far end of the abdomen
    st = (wx + math.cos(ar) * 17.5, wy - math.sin(ar) * 17.5)
    # attack: the stinger itself bends forward, a long needle toward the allies
    sa = ar if n != 'attack' else math.radians(350)
    sting_len = 8 if n == 'attack' else 3
    tipx, tipy = st[0] + math.cos(sa) * sting_len, st[1] - math.sin(sa) * sting_len
    p.line([ipt(st), ipt((tipx, tipy))], 'o')
    dot(p, tipx, tipy, 'c')
    # six legs from the thorax, dangling (tucked forward on attack)
    for i, (dx, reach) in enumerate([(-2, 4), (0, 5), (2, 5)]):
        base = (tx + dx, ty + 4)
        knee = (base[0] + (2 if n == 'attack' else 1) - i, base[1] + 3)
        foot = (knee[0] + (2 if n in ('attack', 'move') else 0), knee[1] + 3)
        p.line([ipt(base), ipt(knee), ipt(foot)], 'o')
    # fuzzy thorax
    blob(p, tx, ty, 6, 5.5, 0, fn=fuzz)
    for x, y in [(tx - 3, ty - 5), (tx + 1, ty - 5), (tx + 4, ty - 3)]:
        dot(p, x, y, 'f')
    # head: dark with huge compound eye facing right, antennae and mandibles
    hx, hy = tx + 7, ty + (1 if n != 'hit' else -1)
    blob(p, hx, hy, 4, 4.2, 0, keys={'l': 's', 'b': 'k', 's': 'o'})
    p.box((hx, hy - 2, hx + 2, hy), 'e'); dot(p, hx, hy - 2, 'c')
    if n == 'hit':
        p.line([(hx, hy - 1), (hx + 2, hy - 1)], 'o')
    for dx, ln in ((0, 5), (2, 4)):
        base = (hx + dx - 1, hy - 3)
        mid = (base[0] + 1, base[1] - ln + 1)
        p.line([ipt(base), ipt(mid), (int(mid[0]) + 2, int(mid[1]) - 1)], 'o')
    p.line([(hx + 3, hy + 2), (hx + 4, hy + 3)], 'd')
    # near wing over the body (see-through)
    wing(p, (tx, ty - 4), beat, True)
    if n == 'attack':
        p.line([ipt(st), ipt((tipx, tipy))], 'o')
        p.line([(int(st[0]) + 1, int(st[1]) - 1), (int(tipx), int(tipy) - 1)], 'c')
        for k in range(3):
            dot(p, tipx + 1 + k, tipy - 3 + k * 3, 'c')
    if n == 'windup':
        dot(p, tipx + 1, tipy - 1, 'c')
    return p


if __name__ == '__main__':
    run('bee-giant', CELL, PAL, draw)

