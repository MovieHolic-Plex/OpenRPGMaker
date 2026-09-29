"""monster1-0 슬라임(파티원) — 48 셀. 걷기 칩: 연두 젤리, 짙은 초록 윤곽, 흰 광택. 몬스터 슬라임보다 둥글고 눈이 순하다.
대기 = 출렁, windup = 납작 웅크림, move = 뛰어오름, attack = 앞으로 늘어나 박치기, hit = 찌그러짐, dead = 녹아 퍼짐. 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mon_lib import *  # noqa

CELL = 48
PAL = dict(o='002f15', s='087129', b='40ad29', l='6bd926', h='c0e869', w='e0e8b1', e='102018', k='ffffff', m='005928')
SH = {  # (가로 반지름, 세로 반지름, 중심 x 오프셋, 바닥에서 뜸, 앞쪽 늘어남)
    'idle_a': (12, 9, 0, 0, 0), 'idle_b': (12.8, 8.4, 0, 0, 0), 'idle_c': (13.4, 7.8, 0, 0, 0),
    'windup': (14.5, 6.6, -2, 0, 0), 'move': (10.5, 10.5, 1, 9, 0), 'attack': (15, 8, 5, 1, 4),
    'recover': (12.5, 8.6, 2, 0, 0), 'hit': (10.8, 9.6, -3, 2, 0), 'dead': (16, 4, 0, 0, 0)}


def draw(p, n):
    rx, ry, ox, up, st = SH[n]
    G = CELL - 4
    cx, cy = 24 + ox, G - ry + 1 - up
    parts = [(cx, cy, rx, ry, 0)]
    if st:
        parts.append((cx + rx * .5, cy + 1, rx * .55 + st, ry * .8, 0))
    if n != 'dead':
        parts.append((cx - rx * .15, cy - ry * .55, rx * .45, ry * .55, 0))     # 위 봉긋
    mass(p, parts, keys={'l': 'l', 'b': 'b', 's': 's'})
    if n == 'dead':
        p.line([(cx - 10, G - 3), (cx - 4, G - 4)], 'h')
        for dx in (-17, 15):
            p.box((cx + dx, G - 1, cx + dx + 2, G), 'b'); p.line([(cx + dx, G - 2), (cx + dx + 2, G - 2)], 'o')
        p.line([(cx + 4, G - 2), (cx + 6, G - 2)], 'e'); p.line([(cx + 8, G - 2), (cx + 10, G - 2)], 'e')
        return
    # 광택
    gx, gy = cx - rx * .35 + 3, cy - ry * .5
    p.box((int(gx), int(gy), int(gx) + 2, int(gy) + 1), 'w'); dot(p, gx + 3, gy + 2, 'k')
    # 눈·입(앞 = 오른쪽)
    ex, ey = int(cx + rx * .45), int(cy - 1)
    if n == 'hit':
        eyes(p, ex, ey, 'x'); eyes(p, ex - 5, ey, 'x')
    elif n == 'windup':
        p.line([(ex - 1, ey), (ex + 1, ey)], 'e'); p.line([(ex - 6, ey), (ex - 4, ey)], 'e')
    else:
        for x in (ex, ex - 5):
            p.box((x, ey - 1, x + 1, ey + 1), 'e'); dot(p, x, ey - 1, 'k')
    if n in ('attack', 'hit'):
        p.box((ex - 3, ey + 3, ex - 1, ey + 4), 'e')
    else:
        p.line([(ex - 3, ey + 3), (ex - 2, ey + 4), (ex - 1, ey + 3)], 'e')
    # 배 속 기포
    dot(p, cx - 4, cy + 3, 'h'); dot(p, cx - 7, cy + 1, 'h')
    if n == 'move':
        for k in range(3):
            p.line([(cx - 4 + k * 4, G - 1), (cx - 4 + k * 4, G - 3)], 'm')


if __name__ == '__main__':
    build('monster1-0', 'b3', CELL, PAL, draw)

