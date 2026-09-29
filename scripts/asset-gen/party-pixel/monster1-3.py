"""monster1-3 유령(파티원) — 48 셀. 걷기 칩: 흰 천 유령, 붉은 입, 짧은 팔. 다리 없이 떠 있다(float).
대기 = 위아래로 둥실·자락 물결, windup = 몸을 뒤로 젖혀 부풀림, attack = 앞으로 늘어나 할퀴기, dead = 천만 바닥에 남는다. 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mon_lib import *  # noqa

CELL = 48
PAL = dict(o='4a4a5a', s='9c9cb0', b='d5d5e0', l='f6f6f6', r='c52029', k='7b0818', e='201800', h='a41820', t='ffffff')
SH = {'idle_a': (0, 0, 0), 'idle_b': (-1, 1, 1), 'idle_c': (-2, 0, 2), 'windup': (-2, -3, 3), 'move': (-3, 3, 1),
      'attack': (-1, 6, 2), 'recover': (-1, 2, 0), 'hit': (-1, -4, 1)}


def draw(p, n):
    G = CELL - 4
    if n == 'dead':
        mass(p, [(22, G - 2, 12, 3, 0), (28, G - 4, 6, 3.5, 0)], keys={'l': 'l', 'b': 'b', 's': 's'})
        p.line([(29, G - 4), (31, G - 4)], 'e')
        for x in (14, 20, 26, 32):
            dot(p, x, G, 's')
        return
    dy, dx, ph = SH[n]
    cx, cy = 23 + dx, 22 + dy
    stretch = 3 if n == 'attack' else 0
    puff_ = 2 if n == 'windup' else 0
    parts = [(cx, cy, 9 + puff_, 9 + puff_, 0), (cx - 1, cy + 7, 10 + puff_, 7, 0), (cx + stretch, cy + 2, 8, 7, 0)]
    mass(p, parts, keys={'l': 'l', 'b': 'b', 's': 's'})
    # 자락: 물결 톱니
    base = cy + 13
    for k in range(5):
        x = cx - 9 + k * 4
        yy = base + (1 if (k + ph) % 2 else -1)
        p.poly([(x, base - 2), (x + 2, yy + 3), (x + 4, base - 2)], 'b', 'o')
    # 팔(짧은 천 자락, 앞쪽)
    if n == 'attack':
        p.poly([(cx + 6, cy + 3), (cx + 16, cy + 1), (cx + 14, cy + 5)], 'l', 'o')
        for k in range(3):
            p.line([(cx + 15, cy + k), (cx + 18, cy - 1 + k * 2)], 'o')
    elif n == 'windup':
        p.poly([(cx + 3, cy + 1), (cx + 2, cy - 11), (cx + 7, cy - 2)], 'l', 'o')
    else:
        p.poly([(cx + 7, cy + 4), (cx + 12, cy + 7 + (ph % 2)), (cx + 7, cy + 8)], 'b', 'o')
    # 얼굴
    ex, ey = cx + 4, cy - 2
    if n == 'hit':
        eyes(p, ex, ey, 'x'); eyes(p, ex + 4, ey, 'x')
    else:
        for x in (ex, ex + 4):
            p.box((x, ey - 1, x + 1, ey + 1), 'e')
    mw = 3 if n in ('attack', 'windup', 'hit') else 2
    p.box((ex, ey + 3, ex + 1 + mw, ey + 3 + mw), 'r'); p.box((ex + 1, ey + 4, ex + mw, ey + 3 + mw), 'k')
    dot(p, ex + 1, ey + 3, 'h')
    dot(p, cx - 4, cy - 5, 't'); dot(p, cx - 3, cy - 6, 't')


if __name__ == '__main__':
    build('monster1-3', 'b3', CELL, PAL, draw, ground=False)

