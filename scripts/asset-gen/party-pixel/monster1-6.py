"""monster1-6 사신(파티원) — 48 셀. 걷기 칩: 진보라 두건 망토, 해골 얼굴, 발 없이 떠 있다. 큰 낫(float).
대기 = 망토 자락 흔들림, windup = 낫을 높이 치켜듦, attack = 앞으로 크게 휘두름, dead = 빈 망토와 낫. 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mon_lib import *  # noqa

CELL = 48
PAL = dict(o='210f33', s='571870', b='861099', l='a007bf', h='c860e0', k='000000', w='eaeaea', W='aaaaaa', g='393939', G='6a5a4a', e='7fe6ff', t='ffffff')
SH = {'idle_a': (0, 0, 0, -70), 'idle_b': (1, 0, 1, -68), 'idle_c': (2, 0, 2, -66), 'windup': (-1, -2, 0, -150), 'move': (0, 2, 1, -40),
      'attack': (1, 4, 2, 40), 'recover': (1, 2, 0, 80), 'hit': (-2, -3, 1, -110)}


def scythe(p, hand, ang):
    a = at(hand, ang, 13); b = at(hand, ang + 180, 8)
    p.line([b, a], 'o', 3); p.line([b, a], 'G')
    # 날: 자루 끝에서 앞쪽으로 휜 초승달
    pts = []
    for i in range(10):
        t = i / 9
        q = at(a, ang + 100 + t * 60, 12 * t)
        pts.append((q[0], q[1], 2.0 * (1 - t) + .6))
    tube(p, pts, 'w', 'o', 'W')


def draw(p, n):
    G = CELL - 4
    if n == 'dead':
        p.poly([(10, G), (16, G - 6), (30, G - 7), (36, G), ], 'b', 'o')
        p.line([(17, G - 5), (29, G - 6)], 'l')
        p.box((31, G - 5, 34, G - 3), 'w'); p.box((32, G - 4, 32, G - 4), 'k')
        p.line([(6, G - 1), (26, G - 3)], 'o', 3); p.line([(6, G - 1), (26, G - 3)], 'G')
        p.poly([(5, G - 8), (8, G - 2), (6, G - 1), (3, G - 6)], 'w', 'o')
        return
    dy, dx, ph, wang = SH[n]
    cx, top = 23 + dx, 12 + dy
    # 망토 몸통: 위가 좁고 아래가 넓다, 발 없음
    body = [(cx - 4, top + 6), (cx + 5, top + 6), (cx + 9, top + 20), (cx + 10, top + 28), (cx - 9, top + 28), (cx - 8, top + 18)]
    p.poly(body, 'b', 'o')
    p.poly([(cx + 3, top + 7), (cx + 7, top + 20), (cx + 8, top + 27), (cx + 3, top + 27)], 'l')
    p.poly([(cx - 6, top + 14), (cx - 3, top + 27), (cx - 8, top + 27)], 's')
    for k in range(5):       # 자락 톱니
        x = cx - 9 + k * 4 + (ph % 2)
        p.poly([(x, top + 27), (x + 2, top + 31 + ((k + ph) % 2)), (x + 4, top + 27)], 's', 'o')
    # 두건
    blob(p, cx + 1, top + 3, 6.4, 6, 0, keys={'l': 'l', 'b': 'b', 's': 's'})
    p.poly([(cx + 1, top - 1), (cx + 6, top + 1), (cx + 7, top + 8), (cx + 1, top + 8)], 'k')
    p.box((cx + 3, top + 2, cx + 6, top + 6), 'w'); p.box((cx + 3, top + 6, cx + 5, top + 7), 'W')
    if n == 'hit':
        eyes(p, cx + 5, top + 3, 'x')
    else:
        dot(p, cx + 5, top + 3, 'e'); dot(p, cx + 4, top + 3, 'k')
    # 소매 팔 + 해골 손
    hand = at((cx + 3, top + 10), {'windup': -110, 'attack': 10, 'hit': 170}.get(n, 60), 7)
    p.line([(cx + 3, top + 10), hand], 'o', 4); p.line([(cx + 3, top + 10), hand], 's', 2)
    scythe(p, hand, wang)
    x, y = ipt(hand); p.box((x - 1, y - 1, x + 1, y + 1), 'w')
    if n == 'attack':
        for k in range(3):
            p.arc_ = None
            q0, q1 = at(hand, 10 - k * 25, 14), at(hand, -10 - k * 25, 16)
            p.line([q0, q1], 'h')


if __name__ == '__main__':
    build('monster1-6', 'b3', CELL, PAL, draw, ground=False)

