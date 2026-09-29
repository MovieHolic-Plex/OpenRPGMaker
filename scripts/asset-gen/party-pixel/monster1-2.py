"""monster1-2 꼬마 오거(파티원) — 48 셀. 걷기 칩: 살색 대머리, 붉은 뺨, 금빛 어깨 갑옷·허리띠. 큰 나무 몽둥이.
대기 = 몽둥이를 어깨에 걸침, windup = 머리 위로 치켜듦, attack = 내려찍기. 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mon_lib import *  # noqa

CELL = 48
PAL = dict(o='3c291d', s='c07a5a', b='f1b690', l='f7d6bf', r='e0605a', y='b7871f', Y='f6cd8b', k='5f1710', w='7a4a24', W='a8703a', e='202020', t='ffffff')


def body(p, J):
    torso_mass(p, J, 7.0, {'l': 'l', 'b': 'b', 's': 's'}, extra=[(1, 3, 7.4, 5.2)])
    hip = J['hip']
    p.box((hip[0] - 7, hip[1] - 3, hip[0] + 7, hip[1] - 1), 'y'); p.line([(hip[0] - 6, hip[1] - 3), (hip[0] + 6, hip[1] - 3)], 'Y')
    p.box((hip[0] - 1, hip[1] - 3, hip[0] + 1, hip[1] - 1), 'Y')
    sh = J['sh']
    blob(p, sh[0] - 1, sh[1] + 2, 4.2, 3.2, 0, keys={'l': 'Y', 'b': 'y', 's': 'w'})


def head(p, hx, hy, J):
    P = J['P']
    blob(p, hx, hy, 5.6, 5.2, 0)
    p.poly([(hx - 5, hy), (hx - 7, hy - 2), (hx - 6, hy + 2)], 'b', 'o')
    dot(p, hx + 3, hy + 2, 'r'); dot(p, hx + 4, hy + 2, 'r')
    eyes(p, hx + 2, hy - 1, P['eye'], 'e')
    p.line([(hx + 1, hy - 3), (hx + 4, hy - 3)], 'o')
    if P['mouth']:
        p.box((hx + 2, hy + 3, hx + 5, hy + 4), 'k'); dot(p, hx + 3, hy + 3, 't')
    else:
        p.line([(hx + 2, hy + 4), (hx + 5, hy + 3)], 'o')
    dot(p, hx - 1, hy - 3, 'l'); dot(p, hx, hy - 4, 'l')


def weapon(p, hand, ang, J):
    tip = at(hand, ang, 14)
    base = at(hand, ang + 180, 3)
    pts = [(base[0], base[1], 1.3), ((hand[0] + tip[0]) / 2, (hand[1] + tip[1]) / 2, 2.0), (tip[0], tip[1], 3.2)]
    tube(p, bez(pts, 16), 'W', 'o', 'w')
    for k in (.55, .8):
        q = (lerp_(hand[0], tip[0], k), lerp_(hand[1], tip[1], k))
        dot(p, q[0], q[1], 'o')


def lerp_(a, b, t): return a + (b - a) * t


S = dict(cell=CELL, leg=8, torso=10, arm=8, aw=4, lw=4, hr=5, neck=2, legc='b', legfar='s', boot='w', boot_far='w',
         armc='b', farc='s', body=body, head=head, weapon=weapon,
         poses={'idle_a': dict(arm=-40, wpn=-150), 'idle_b': dict(arm=-38, wpn=-146), 'idle_c': dict(arm=-36, wpn=-142),
                'windup': dict(arm=-100, wpn=-110), 'move': dict(arm=-60, wpn=-140), 'attack': dict(arm=30, wpn=70),
                'recover': dict(arm=60, wpn=90), 'hit': dict(arm=-130, wpn=-170)})


def draw(p, n):
    if n != 'dead':
        humanoid(p, n, S)


if __name__ == '__main__':
    build('monster1-2', 'b3', CELL, PAL, draw, dead_lying=True)

