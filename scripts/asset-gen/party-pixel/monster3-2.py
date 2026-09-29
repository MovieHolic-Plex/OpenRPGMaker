"""monster3-2 망령술사(파티원) — 48 셀. 걷기 칩: 검은 두건 긴 망토, 금 테두리, 얼굴은 어둠, 발 없이 뜬다(float).
대기 = 망토 자락과 영혼 불빛이 흔들림, windup = 두 팔을 벌려 영혼을 모음, attack = 한 손을 앞으로 뻗어 흡수. 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mon_lib import *  # noqa

CELL = 48
PAL = dict(o='101f28', s='243745', b='3b5060', l='6c7f90', k='000000', y='b7871f', Y='d8ad50', e='7fe6d4', E='d8fff4', w='5d4234', v='3a2a4a')
SH = {'idle_a': (0, 0, 0), 'idle_b': (1, 0, 1), 'idle_c': (2, 0, 2), 'windup': (-2, -1, 0), 'move': (0, 3, 1), 'attack': (1, 3, 2), 'recover': (1, 1, 0), 'hit': (-2, -3, 1)}


def draw(p, n):
    G = CELL - 4
    if n == 'dead':
        p.poly([(8, G), (14, G - 7), (30, G - 8), (38, G)], 's', 'o'); p.line([(14, G - 6), (30, G - 7)], 'Y')
        p.poly([(30, G - 8), (36, G - 10), (40, G - 4), (38, G)], 'b', 'o'); dot(p, 36, G - 6, 'e')
        return
    dy, dx, ph = SH[n]
    cx, top = 23 + dx, 9 + dy
    body = [(cx - 4, top + 8), (cx + 6, top + 8), (cx + 9, top + 22), (cx + 10, top + 30), (cx - 10, top + 30), (cx - 8, top + 18)]
    p.poly(body, 's', 'o')
    p.poly([(cx + 3, top + 9), (cx + 7, top + 22), (cx + 8, top + 29), (cx + 3, top + 29)], 'b')
    p.line([(cx + 1, top + 9), (cx + 2, top + 29)], 'Y')
    for k in range(5):
        x = cx - 10 + k * 4 + (ph % 2)
        p.poly([(x, top + 29), (x + 2, top + 33 + ((k + ph) % 2)), (x + 4, top + 29)], 's', 'o')
    p.line([(cx - 10, top + 30), (cx + 10, top + 30)], 'y')
    # 두건
    blob(p, cx + 1, top + 4, 6.6, 6.2, 0, keys={'l': 'l', 'b': 'b', 's': 's'})
    p.poly([(cx + 2, top), (cx + 7, top + 2), (cx + 8, top + 9), (cx + 2, top + 9)], 'k')
    p.line([(cx - 4, top + 1), (cx + 2, top - 1), (cx + 7, top + 2)], 'Y')
    if n == 'hit':
        eyes(p, cx + 5, top + 4, 'x')
    else:
        dot(p, cx + 5, top + 4, 'e'); dot(p, cx + 3, top + 4, 'e')
    # 팔
    ta = {'windup': [(-9, -6), (10, -6)], 'attack': [(14, 2)], 'hit': [(-8, 6)]}.get(n, [(8, 8)])
    for t in ta:
        hand = (cx + 3 + t[0], top + 12 + t[1])
        p.line([(cx + 3, top + 12), hand], 'o', 4); p.line([(cx + 3, top + 12), hand], 'b', 2)
        x, y = ipt(hand); p.box((x - 1, y - 1, x + 1, y + 1), 'l')
        if n in ('windup', 'attack'):
            p.d.ellipse((x - 3, y - 3, x + 3, y + 3), outline=p.pal['e'])
            dot(p, x, y, 'E')
    # 영혼 불빛
    for k in range(3):
        a = (k * 2.1 + ph * .8)
        x, y = cx - 12 + math.cos(a) * 3, top + 10 + k * 7 + math.sin(a) * 2
        p.box((int(x), int(y), int(x) + 1, int(y) + 1), 'e')


if __name__ == '__main__':
    build('monster3-2', 'b5', CELL, PAL, draw, ground=False)

