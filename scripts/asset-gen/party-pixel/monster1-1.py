"""monster1-1 붉은 악마(파티원) — 48 셀. 걷기 칩: 새빨간 피부, 짙은 뿔, 통통한 배, 짧은 날개. 삼지창을 들었다.
대기 = 날개 퍼덕·꼬리 흔들기, windup = 삼지창을 뒤로, attack = 찌르기, 시전은 windup 칸의 불꽃 손. 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mon_lib import *  # noqa

CELL = 48
PAL = dict(o='290800', s='7b0818', b='c52029', l='f63141', h='ff737b', k='4a0008', n='a41820', y='ffd23a', w='ffe6c0',
           g='6a5a5a', G='b0a0a0', e='fff6a0', f='ff9a2a')


def wing(p, J, near):
    sh = J['sh']
    fl = [-10, -6, -2, -8, -14, -4, 0, -12, 0][NAMES.index(J['n'])]
    root = (sh[0] - 3, sh[1] + 2)
    tip = (root[0] - 10, root[1] - 9 + fl * .5)
    mid = (root[0] - 7, root[1] + 1 + fl * .3)
    p.poly([root, (root[0] - 4, root[1] - 7 + fl * .3), tip, (tip[0] + 1, tip[1] + 4), mid, (root[0] - 2, root[1] + 5)], 'k' if not near else 's', 'o')
    p.line([root, tip], 'n' if near else 's')


def back(p, J):
    wing(p, J, False)
    J2 = dict(J); J2['sh'] = (J['sh'][0] + 3, J['sh'][1] - 1)
    wing(p, J2, True)
    # 꼬리
    hip = J['hip']; sw = [0, 2, 4, -3, 3, -2, 1, 5, 0][NAMES.index(J['n'])]
    pts = bez([(hip[0] - 3, hip[1] - 1, 1.2), (hip[0] - 10, hip[1] + 2, 1.1), (hip[0] - 12, hip[1] - 6 + sw, 1.0), (hip[0] - 9, hip[1] - 10 + sw, .8)], 14)
    tube(p, pts, 'b', 'o', 's')
    tx, ty = ipt(pts[-1])
    p.poly([(tx - 2, ty), (tx + 1, ty - 4), (tx + 2, ty + 1)], 'k', 'o')


def body(p, J):
    torso_mass(p, J, 6.2, {'l': 'l', 'b': 'b', 's': 's'}, extra=[(1.5, 2.5, 5.8, 4.6)])
    mx = (J['hip'][0] + J['sh'][0]) / 2
    p.line([(mx + 2, J['hip'][1] - 3), (mx + 4, J['hip'][1] - 5)], 'h')
    p.line([(mx - 1, J['sh'][1] + 3), (mx + 3, J['sh'][1] + 3)], 'h')


def head(p, hx, hy, J):
    P = J['P']
    blob(p, hx, hy, 5.2, 4.8, 0, keys={'l': 'h', 'b': 'l', 's': 'b'})
    for dx, big in ((-3, 1), (1, 0)):   # 뿔 두 개(먼 것 먼저)
        p.poly([(hx + dx - 1, hy - 3), (hx + dx - 3 + big, hy - 9 - big), (hx + dx + 2, hy - 4)], 'k', 'o')
    p.poly([(hx - 4, hy - 1), (hx - 7, hy - 3), (hx - 5, hy + 1)], 'b', 'o')     # 뾰족 귀
    eyes(p, hx + 2, hy - 1, P['eye'], 'e', 'y')
    p.line([(hx + 1, hy - 3), (hx + 4, hy - 2)], 'o')
    if P['mouth']:
        p.box((hx + 2, hy + 2, hx + 4, hy + 3), 'o'); dot(p, hx + 3, hy + 2, 'w')
    else:
        p.line([(hx + 1, hy + 2), (hx + 4, hy + 2)], 'o'); dot(p, hx + 4, hy + 1, 'w')


def weapon(p, hand, ang, J):
    back_ = at(hand, ang + 180, 6)
    tip = at(hand, ang, 13)
    p.line([back_, tip], 'o', 3); p.line([back_, tip], 'g')
    for off in (-3, 0, 3):
        a2 = ang + 90
        base = at(tip, a2, off)
        pt = at(base, ang, 4 if off == 0 else 3)
        p.line([base, pt], 'o', 3); p.line([base, pt], 'G')
    p.line([at(tip, ang + 90, -3), at(tip, ang + 90, 3)], 'G')
    if J['n'] == 'windup':
        x, y = ipt(J['fhand'])
        p.poly([(x - 2, y + 1), (x, y - 5), (x + 2, y + 1)], 'f', 'o'); dot(p, x, y - 1, 'y')


S = dict(cell=CELL, leg=9, torso=10, arm=8, aw=3, lw=3, hr=5, neck=1, legc='b', legfar='s', boot='k', boot_far='k',
         armc='b', farc='s', back=back, body=body, head=head, weapon=weapon,
         poses={'idle_b': dict(hdy=1), 'attack': dict(arm=10, wpn=5)})


def draw(p, n):
    if n == 'dead':
        return None
    humanoid(p, n, S)


if __name__ == '__main__':
    build('monster1-1', 'b3', CELL, PAL, draw, dead_lying=True)

