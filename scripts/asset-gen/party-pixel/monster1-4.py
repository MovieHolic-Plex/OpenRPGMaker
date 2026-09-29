"""monster1-4 해골병(파티원) — 48 셀. 걷기 칩: 흰 뼈, 검은 눈구멍. 한 손에 던질 뼈를 든다.
대기 = 턱이 달각, windup = 뼈를 뒤로 젖힘, attack = 던지기(손끝 앞), dead = 뼈 무더기. 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mon_lib import *  # noqa

CELL = 48
PAL = dict(o='262626', s='8a8a8a', b='cbcbcb', l='eaeaea', t='ffffff', k='060606', e='ff5a3a', g='5a5a5a')


def body(p, J):
    hip, sh = J['hip'], J['sh']
    # 척추 + 갈비
    p.line([hip, sh], 'o', 3); p.line([hip, sh], 'b')
    for k in range(4):
        y = sh[1] + 2 + k * 2
        x = sh[0] + (hip[0] - sh[0]) * (k / 5)
        p.line([(x - 4, y + 1), (x - 1, y), (x + 4, y + 1)], 'o', 3)
        p.line([(x - 3, y + 1), (x - 1, y), (x + 3, y + 1)], 'l')
    blob(p, hip[0], hip[1] - 1, 4, 2.2, 0, keys={'l': 'l', 'b': 'b', 's': 's'})


def head(p, hx, hy, J):
    P = J['P']
    blob(p, hx, hy - 1, 5, 4.6, 0, keys={'l': 't', 'b': 'l', 's': 'b'})
    jaw = 2 if P['mouth'] or J['n'] in ('idle_b',) else 1
    p.box((hx - 1, hy + 3, hx + 4, hy + 3 + jaw), 'b'); p.line([(hx - 1, hy + 4 + jaw), (hx + 4, hy + 4 + jaw)], 'o')
    for x in (hx, hx + 2, hx + 4):
        dot(p, x, hy + 3, 'o')
    if P['eye'] == 'x':
        eyes(p, hx + 2, hy - 1, 'x')
    else:
        p.box((hx + 1, hy - 2, hx + 3, hy), 'k'); dot(p, hx + 2, hy - 1, 'e')
    dot(p, hx + 4, hy + 1, 'k')


def weapon(p, hand, ang, J):
    if J['n'] in ('attack', 'recover'):
        return
    a = at(hand, ang, 5); b = at(hand, ang + 180, 2)
    p.line([a, b], 'o', 3); p.line([a, b], 'l')
    for q in (a, b):
        x, y = ipt(q)
        p.box((x - 1, y - 1, x + 1, y + 1), 'o'); dot(p, x, y, 't')


def front(p, J):
    if J['n'] == 'attack':      # 날아가는 뼈
        x, y = ipt(at(J['hand'], -15, 8))
        p.line([(x - 3, y + 1), (x + 3, y - 1)], 'o', 3); p.line([(x - 3, y + 1), (x + 3, y - 1)], 'l')
        for dx in (-7, -10):
            dot(p, x + dx, y + 2, 's')


S = dict(cell=CELL, leg=10, torso=9, arm=8, aw=2, lw=2, hr=5, neck=1, legc='l', legfar='s', boot='b', boot_far='s',
         armc='l', farc='s', fist='l', body=body, head=head, weapon=weapon, front=front,
         poses={'windup': dict(arm=-150, wpn=-120), 'attack': dict(arm=-5), 'recover': dict(arm=40)})


def draw(p, n):
    G = CELL - 4
    if n == 'dead':
        for (x, y, a) in ((12, G - 1, 10), (20, G - 3, -20), (27, G - 1, 5), (33, G - 2, 40)):
            e = at((x, y), a, 4); s_ = at((x, y), a + 180, 4)
            p.line([s_, e], 'o', 3); p.line([s_, e], 'l')
        blob(p, 24, G - 5, 4.6, 4.2, 0, keys={'l': 't', 'b': 'l', 's': 'b'})
        p.box((25, G - 6, 26, G - 5), 'k'); p.box((22, G - 6, 23, G - 5), 'k')
        return
    humanoid(p, n, S)


if __name__ == '__main__':
    build('monster1-4', 'b3', CELL, PAL, draw)

