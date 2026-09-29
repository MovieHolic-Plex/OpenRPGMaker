"""monster3-7 마장군(파티원) — 64 셀. 걷기 칩: 검은 갑옷, 푸른 피부, 붉은 뿔·붉은 눈, 금 장식, 보랏빛 대검.
대기 = 대검을 앞에 세우고 망토가 흔들림, windup = 대검을 머리 위로, attack = 크게 내려벰, 시전은 windup 칸에서 대검에 암흑이 서림. 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mon_lib import *  # noqa

CELL = 64
PAL = dict(o='151617', s='2a282d', b='434146', l='6a6870', v='3c35a3', V='6a60cb', r='6b2926', R='c83a3a', y='966517', Y='e0b040', e='ff3040', p='2b0c0b', m='5a2a8a', M='a070e0')


def body(p, J):
    torso_mass(p, J, 9.5, {'l': 'l', 'b': 'b', 's': 's'}, extra=[(0, 4, 9, 6)])
    hip, sh = J['hip'], J['sh']
    p.box((hip[0] - 9, hip[1] - 5, hip[0] + 9, hip[1] - 3), 'y'); p.box((hip[0] - 1, hip[1] - 6, hip[0] + 2, hip[1] - 2), 'Y')
    p.line([(sh[0] - 2, sh[1] + 5), (sh[0] + 5, sh[1] + 11)], 'y')
    # 어깨 가시 갑옷
    blob(p, sh[0] - 1, sh[1] + 3, 6, 4.6, 0, keys={'l': 'l', 'b': 'b', 's': 's'})
    for k in range(3):
        x = sh[0] - 5 + k * 4
        p.poly([(x, sh[1] + 1), (x + 1, sh[1] - 4 - (k == 1) * 2), (x + 3, sh[1] + 1)], 'R', 'o')


def back(p, J):
    sh = J['sh']
    sw = {'idle_b': 1, 'idle_c': 2, 'move': -3, 'attack': -4, 'hit': 3}.get(J['n'], 0)
    p.poly([(sh[0] - 4, sh[1] + 2), (sh[0] - 12 + sw, J['G'] - 2), (sh[0] - 3 + sw, J['G'] - 4), (sh[0] + 2, sh[1] + 4)], 'r', 'o')
    p.line([(sh[0] - 5, sh[1] + 6), (sh[0] - 10 + sw, J['G'] - 4)], 'p')


def head(p, hx, hy, J):
    P = J['P']
    blob(p, hx + 1, hy + 1, 5, 5, 0, keys={'l': 'V', 'b': 'v', 's': 'v'})
    # 투구
    blob(p, hx, hy - 2, 6.2, 4.6, 0, keys={'l': 'l', 'b': 'b', 's': 's'})
    p.box((int(hx) - 5, int(hy) + 1, int(hx) - 2, int(hy) + 6), 'b')
    for dx_, big in ((-3, 0), (1, 1)):
        pts = bez([(hx + dx_, hy - 5, 1.5), (hx + dx_ - 3, hy - 8, 1.1), (hx + dx_ + 1, hy - 11 - big, .4)], 10)
        tube(p, pts, 'R', 'o', 'r')
    eyes(p, int(hx) + 3, int(hy) + 1, P['eye'], 'e', 'Y')
    p.line([(hx + 2, hy - 1), (hx + 6, hy)], 'o')
    if P['mouth']:
        p.box((int(hx) + 3, int(hy) + 4, int(hx) + 5, int(hy) + 5), 'p')


def weapon(p, hand, ang, J):
    tip = at(hand, ang, 22); base = at(hand, ang + 180, 5)
    nx, ny = math.cos(math.radians(ang + 90)), math.sin(math.radians(ang + 90))
    g0, g1 = at(hand, ang, 2), at(hand, ang, 4)
    blade = [(g1[0] + nx * 3, g1[1] + ny * 3), (tip[0] + nx * 1.5, tip[1] + ny * 1.5), at(tip, ang, 3), (tip[0] - nx * 1.5, tip[1] - ny * 1.5), (g1[0] - nx * 3, g1[1] - ny * 3)]
    p.poly(blade, 'm', 'o')
    p.line([g1, tip], 'M')
    p.line([base, g0], 'o', 3); p.line([base, g0], 'y')
    p.line([(g0[0] + nx * 5, g0[1] + ny * 5), (g0[0] - nx * 5, g0[1] - ny * 5)], 'o', 3)
    p.line([(g0[0] + nx * 4, g0[1] + ny * 4), (g0[0] - nx * 4, g0[1] - ny * 4)], 'Y')
    if J['n'] == 'windup':
        for k in range(4):
            q = at(g1, ang, 4 + k * 5)
            p.line([(q[0] + nx * 5, q[1] + ny * 5), (q[0] + nx * 8, q[1] + ny * 8)], 'M')


S = dict(cell=CELL, cx=30, leg=14, torso=14, arm=12, aw=5, lw=5, hr=6, neck=2, legc='b', legfar='s', boot='l', boot_far='b',
         armc='b', farc='s', fist='l', back=back, body=body, head=head, weapon=weapon,
         poses={'idle_a': dict(arm=70, wpn=-88), 'idle_b': dict(arm=72, wpn=-86), 'idle_c': dict(arm=74, wpn=-84),
                'windup': dict(arm=-110, wpn=-160), 'move': dict(arm=40, wpn=-50), 'attack': dict(arm=30, wpn=55),
                'recover': dict(arm=60, wpn=85), 'hit': dict(arm=140, wpn=-130)})


def draw(p, n):
    if n != 'dead':
        humanoid(p, n, S)


if __name__ == '__main__':
    build('monster3-7', 'b5', CELL, PAL, draw, dead_lying=True)

