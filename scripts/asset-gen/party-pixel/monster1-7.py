"""monster1-7 수인 전사(파티원) — 64 셀. 걷기 칩: 굽은 큰 뿔, 갈색 갈기 머리, 회색 가슴 갑옷, 초록 바지, 우람한 팔.
대기 = 도끼를 비스듬히 들고 숨쉬기, windup = 도끼를 머리 뒤로, attack = 크게 내려찍기. 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mon_lib import *  # noqa

CELL = 64
PAL = dict(o='1a1210', s='6a4a3a', b='a0785a', l='d0a882', g='646464', G='a1a1a1', W='c4c4c4', n='3b220a', N='6b4a2a', v='2d6a2e', V='4aa04a',
           h='e8dcc0', r='c52029', e='ffe070', k='432a12')


def body(p, J):
    torso_mass(p, J, 9.0, {'l': 'W', 'b': 'G', 's': 'g'}, extra=[(0, 4, 8.5, 6)])
    hip = J['hip']
    blob(p, hip[0], hip[1] - 1, 8, 3.4, 0, keys={'l': 'V', 'b': 'v', 's': 'v'})
    p.box((hip[0] - 8, hip[1] - 5, hip[0] + 8, hip[1] - 3), 'N'); p.box((hip[0] - 1, hip[1] - 5, hip[0] + 2, hip[1] - 3), 'e')
    sh = J['sh']
    blob(p, sh[0] - 1, sh[1] + 3, 5.4, 4.2, 0, keys={'l': 'W', 'b': 'G', 's': 'g'})


def head(p, hx, hy, J):
    P = J['P']
    # 갈기(뒤)
    blob(p, hx - 3, hy + 1, 6, 7, 0, keys={'l': 'N', 'b': 'n', 's': 'n'})
    blob(p, hx + 1, hy, 5.6, 5.4, 0)
    blob(p, hx + 5, hy + 2, 3.2, 2.6, 0, keys={'l': 'l', 'b': 'b', 's': 's'})       # 주둥이
    dot(p, hx + 7, hy + 1, 'o')
    # 굽은 뿔(뒤로 휘어 앞으로 말림)
    for far in (True, False):
        r0 = (hx - (2 if far else 0), hy - 4)
        pts = bez([(r0[0], r0[1], 1.6), (r0[0] - 5, r0[1] - 3, 1.5), (r0[0] - 4, r0[1] - 8, 1.0), (r0[0] + 1, r0[1] - 9, .5)], 14)
        tube(p, pts, 'h' if not far else 'G', 'o', 'G' if not far else 'g')
    eyes(p, hx + 2, hy - 1, P['eye'], 'r', 'e')
    p.line([(hx, hy - 3), (hx + 4, hy - 2)], 'o')
    if P['mouth']:
        p.box((hx + 4, hy + 4, hx + 7, hy + 5), 'o'); dot(p, hx + 5, hy + 4, 'h')


def weapon(p, hand, ang, J):
    tip = at(hand, ang, 16); base = at(hand, ang + 180, 5)
    p.line([base, tip], 'o', 3); p.line([base, tip], 'N')
    # 도끼날: 자루 끝, 앞(ang+90) 쪽으로 반달
    c = at(tip, ang + 180, 3)
    pts = [at(c, ang + 90, 1), at(at(c, ang + 90, 9), ang, 5), at(at(c, ang + 90, 10), ang, 0), at(at(c, ang + 90, 9), ang, -6), at(c, ang + 90, 1)]
    p.poly(pts, 'G', 'o')
    p.line([at(at(c, ang + 90, 9), ang, 4), at(at(c, ang + 90, 9), ang, -5)], 'W')
    p.poly([at(c, ang - 90, 1), at(c, ang - 90, 5), at(at(c, ang - 90, 3), ang, -3)], 'g', 'o')


S = dict(cell=CELL, cx=30, leg=13, torso=14, arm=12, aw=5, lw=5, hr=6, neck=2, legc='v', legfar='v', boot='N', boot_far='n',
         armc='b', farc='s', body=body, head=head, weapon=weapon,
         poses={'idle_a': dict(arm=40, wpn=-80), 'idle_b': dict(arm=44, wpn=-76), 'idle_c': dict(arm=48, wpn=-72),
                'windup': dict(arm=-120, wpn=-170), 'attack': dict(arm=35, wpn=60), 'recover': dict(arm=70, wpn=100)})


def draw(p, n):
    if n != 'dead':
        humanoid(p, n, S)


if __name__ == '__main__':
    build('monster1-7', 'b3', CELL, PAL, draw, dead_lying=True)

