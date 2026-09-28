"""Original vampire bat, 48px: larger and fiercer than bat.py — blood-red membranes,
long ears, bared fangs, hooked thumb claws. Airborne; only dead touches y=44."""
import sys
sys.dont_write_bytecode = True
from beast_lib import Pen, run, blob, mass, tube, bez, dot, ipt, polar
CELL = 48
PAL = dict(o='1c1018', s='2c1f2c', b='46323f', l='6a4f5a', h='917380',
           v='3e1120', m='6b1a2c', p='93283a', q='c04a4f',
           e='ffd34d', w='f4ead8', r='d23b44', t='bca7a0')


def wing(p, n, sh, side, far):
    """Leading edge shoulder->elbow->wrist->tip from per-frame arm angle; three finger
    tips on the trailing edge, scalloped notches pulled toward the wrist."""
    ang = ARM[n] if not far else ARM[n] - 6
    L = 0.9 if not far else 0.78

    def P(pt, deg, d):
        a = deg if side > 0 else 180 - deg
        return polar(pt[0], pt[1], a, d * L)
    elbow = P(sh, ang + 25, 6)
    wrist = P(elbow, ang, 7)
    tip = P(wrist, ang + 8, 7)
    f1 = P(wrist, ang - 50, 9)
    f2 = P(wrist, ang - 95, 9)
    root = (sh[0], sh[1] + 7)
    tips = [tip, f1, f2, root]
    pts = [sh, elbow, wrist, tip]
    for a, b in zip(tips, tips[1:]):
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        pts += [((mx * 5 + wrist[0]) / 6, (my * 5 + wrist[1]) / 6), b]
    mem, rib, arm = ('v', 'm', 'p') if far else ('m', 'p', 'q')
    p.poly([ipt(q) for q in pts], mem, 'o')
    # lit panel: the inner third next to the arm catches the upper-left light
    p.poly([ipt(sh), ipt(elbow), ipt(wrist), ipt(((wrist[0] + f2[0]) / 2, (wrist[1] + f2[1]) / 2)), ipt(root)], rib)
    for ft in (f1, f2):
        p.line([ipt(wrist), ipt(ft)], arm)
    p.line([ipt(wrist), ipt(tip)], 'o')
    p.line([ipt(sh), ipt(elbow), ipt(wrist)], 'o')
    x, y = ipt(wrist)
    dot(p, x, y - 1, 't'); dot(p, x + side, y - 1, 'w')


# arm angle (deg above horizontal, outward): flap up / level / down
ARM = {'idle_a': 38, 'idle_b': 8, 'idle_c': -22, 'windup': 62, 'move': 18,
       'attack': -12, 'recover': 30, 'hit': 50}


POS = {'idle_a': (24, 20), 'idle_b': (24, 21), 'idle_c': (24, 22), 'windup': (22, 21),
       'move': (25, 24), 'attack': (26, 26), 'recover': (24, 19), 'hit': (21, 21)}


def body(p, n, bx, by):
    pitch = {'move': 20, 'attack': 30, 'hit': -25, 'windup': -10}.get(n, 0)
    hx, hy = ipt(polar(bx, by, 72 - pitch, 7))
    # long pointed ears first so the skull outline closes over their base
    for dx, h, lean in ((-3, 7, -1), (2, 6, 1)):
        ex, ey = hx + dx, hy - 3
        p.poly([(ex - 1, ey + 2), (ex + lean, ey - h), (ex + 3, ey + 2)], 'b', 'o')
        p.line([(ex + 1, ey), (ex + lean + 1, ey - h + 3)], 'r')
    mass(p, [(bx, by + 3, 5.5, 7.5, 90 - pitch * 0.5), (hx, hy, 5, 4.5, 0)],
         keys={'l': 'h', 'b': 'l', 's': 'b'}, light_c=(bx - 1, by - 2), light_r=8)
    # pug snout and nose leaf
    p.box((hx + 4, hy, hx + 5, hy + 1), 'l'); dot(p, hx + 6, hy, 'o'); dot(p, hx + 6, hy + 1, 'o')
    dot(p, hx + 5, hy - 1, 'o')
    if n == 'hit':
        p.line([(hx, hy - 2), (hx + 2, hy - 1), (hx, hy)], 'o')
    else:
        p.box((hx + 1, hy - 2, hx + 2, hy - 1), 'e'); dot(p, hx + 2, hy - 2, 'r')
        p.line([(hx, hy - 3), (hx + 3, hy - 2)], 'o')  # scowl
    if n in ('windup', 'move', 'attack', 'hit'):
        p.poly([(hx, hy + 2), (hx + 5, hy + 2), (hx + 4, hy + 5), (hx + 1, hy + 5)], 'o')
        dot(p, hx + 2, hy + 4, 'r'); dot(p, hx + 3, hy + 4, 'r')
        for fx in (hx + 1, hx + 4):
            p.line([(fx, hy + 2), (fx, hy + 4)], 'w')
    else:
        p.line([(hx, hy + 2), (hx + 4, hy + 2)], 'o')
        dot(p, hx + 1, hy + 3, 'w'); dot(p, hx + 4, hy + 3, 'w')
    # chest ruff highlight and dangling hind claws
    p.line([(bx - 3, by), (bx - 2, by + 4)], 'h')
    fy = by + 10
    for fx in (bx - 2, bx + 2):
        p.line([(fx, fy), (fx + (1 if n == 'attack' else 0), fy + 2)], 'o')
        dot(p, fx + (1 if n == 'attack' else 0), fy + 3, 't')


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # crumpled on the floor, one wing flopped open, eyes X
        p.poly([(8, 44), (13, 38), (18, 41), (22, 39), (24, 44)], 'v', 'o')
        p.line([(13, 38), (16, 44)], 'o'); p.line([(18, 41), (20, 44)], 'o')
        p.poly([(27, 44), (31, 37), (37, 38), (43, 44)], 'm', 'o')
        p.line([(31, 37), (35, 44)], 'o'); p.line([(37, 38), (39, 44)], 'o')
        mass(p, [(25, 41, 5, 3.4, 0), (30, 41, 3, 3, 0)], keys={'l': 'h', 'b': 'l', 's': 'b'})
        p.line([(29, 40), (31, 42)], 'o'); p.line([(31, 40), (29, 42)], 'o')
        dot(p, 33, 43, 'w')
        return p
    bx, by = POS[n]
    wing(p, n, (bx + 4, by - 1), 1, True)
    body(p, n, bx, by)
    wing(p, n, (bx - 4, by - 1), -1, False)
    if n == 'attack':
        for x, y in [(33, 34), (35, 36), (34, 38)]:
            dot(p, x, y, 'r')
    return p


if __name__ == '__main__':
    run('bat-vampire', CELL, PAL, draw)

