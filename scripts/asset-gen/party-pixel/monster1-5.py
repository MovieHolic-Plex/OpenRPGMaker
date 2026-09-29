"""monster1-5 좀비(파티원) — 48 셀. 걷기 칩: 연두빛 피부, 헝클어진 회록 머리, 푸른 셔츠, 검은 바지.
대기 = 구부정하게 휘청, 두 팔을 앞으로, attack = 달려들어 물기(머리 앞으로). 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mon_lib import *  # noqa

CELL = 48
PAL = dict(o='1a1a1a', s='3e7a4a', b='7fe491', l='b8f0c0', c='063aa1', C='2a6ae0', k='272727', K='4a4a4a', h='5a6d5c', H='8eb192', r='c52029', e='fff08a', w='e8e0c0')


def body(p, J):
    torso_mass(p, J, 5.8, {'l': 'C', 'b': 'c', 's': 'k'})
    sh, hip = J['sh'], J['hip']
    p.line([(sh[0] + 1, sh[1] + 3), (hip[0] + 2, hip[1] - 3)], 'C')
    p.poly([(hip[0] - 4, hip[1] - 1), (hip[0] - 2, hip[1] + 2), (hip[0], hip[1] - 1)], 'c', 'o')   # 찢긴 자락


def head(p, hx, hy, J):
    P = J['P']
    blob(p, hx, hy, 5, 4.8, 0)
    # 헝클어진 머리
    for k, (dx, dy) in enumerate(((-5, -2), (-4, -5), (-1, -6), (2, -6), (4, -4))):
        p.poly([(hx + dx - 1, hy + dy + 2), (hx + dx - 1 + (k % 2) * 2, hy + dy - 2), (hx + dx + 2, hy + dy + 2)], 'h', 'o')
    p.line([(hx - 3, hy - 4), (hx + 2, hy - 5)], 'H')
    eyes(p, hx + 2, hy - 1, P['eye'], 'e')
    dot(p, hx - 1, hy + 1, 's')
    if P['mouth']:
        p.box((hx + 2, hy + 2, hx + 5, hy + 4), 'o'); dot(p, hx + 3, hy + 2, 'w'); dot(p, hx + 5, hy + 4, 'r')
    else:
        p.line([(hx + 1, hy + 3), (hx + 4, hy + 2)], 'o')


S = dict(cell=CELL, leg=9, torso=9, arm=8, aw=3, lw=3, hr=5, neck=2, legc='K', legfar='k', boot='o', boot_far='o',
         armc='b', farc='s', body=body, head=head,
         poses={'idle_a': dict(arm=5, farm=15, lean=2, hdy=1), 'idle_b': dict(arm=10, farm=20, lean=3, hdy=2),
                'idle_c': dict(arm=14, farm=24, lean=2, hdy=2), 'windup': dict(arm=-40, farm=-30, lean=-1),
                'move': dict(arm=0, farm=10, lean=4), 'attack': dict(arm=-5, farm=5, lean=6, hdy=2),
                'recover': dict(arm=30, farm=40, lean=3), 'hit': dict(arm=150, farm=170)})


def draw(p, n):
    if n != 'dead':
        humanoid(p, n, S)


if __name__ == '__main__':
    build('monster1-5', 'b3', CELL, PAL, draw, dead_lying=True)

