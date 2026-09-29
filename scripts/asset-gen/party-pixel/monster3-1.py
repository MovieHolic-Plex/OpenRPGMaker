"""monster3-1 라미아(파티원) — 64 셀. 걷기 칩: 청록 비늘 뱀 꼬리(주황 무늬), 갈색 머리, 붉은 가슴띠. 사람 상체 + 긴 뱀 몸이 바닥에 똬리.
대기 = 꼬리 끝이 살랑, windup = 상체를 뒤로 젖혀 S자, attack = 앞으로 몸을 쭉 뻗어 휘감기, dead = 똬리가 풀려 늘어짐. 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mon_lib import *  # noqa

CELL = 64
PAL = dict(o='1c1a24', t='235b63', T='20888e', u='5ab8b0', m='955d27', M='ca8733', s='b07a5a', b='d8a888', l='f0c8a8', h='411b1c', H='6a3a2a', r='a3355f', e='101010', g='3c3c3c')

POSE = {  # (상체 기울기, 꼬리 끝 흔들, 몸 앞으로, 머리 높이)
    'idle_a': (0, 0, 0, 0), 'idle_b': (2, 3, 0, 1), 'idle_c': (4, 6, 0, 1), 'windup': (-10, -4, -4, -3), 'move': (8, 2, 8, 2),
    'attack': (18, -3, 14, 4), 'recover': (6, 4, 4, 1), 'hit': (-14, 8, -6, -2)}


def draw(p, n):
    G = CELL - 4
    if n == 'dead':
        pts = bez([(8, G - 4, 3.2), (20, G - 6, 3.6), (34, G - 3, 3.8), (48, G - 5, 3.2), (58, G - 3, 1.4)], 50)
        tube(p, pts, 'T', 'o', 't')
        for k in range(6):
            x, y = ipt(pts[5 + k * 7][:2]); p.box((x, y - 1, x + 1, y), 'M')
        blob(p, 12, G - 8, 5, 4, 0); 
        for k in range(3): blob(p, 7 + k * 3, G - 9 + k, 3, 2.6, 0, keys={'l': 'H', 'b': 'h', 's': 'h'})
        p.box((14, G - 5, 20, G - 3), 'r')
        return
    lean, wag, fwd, hup = POSE[n]
    # 똬리(뒤 → 앞)
    coil = bez([(46 + wag, 28, 1.2), (56 + wag * .5, 36, 2.2), (54, 52, 3.4), (38, 58, 4.2), (24, 56, 4.4), (22 + fwd * .3, 46, 4.4), (26 + fwd * .6, 38, 4.0)], 70)
    tube(p, coil, 'T', 'o', 't')
    for k in range(1, 9):
        x, y = ipt(coil[k * 7][:2])
        p.box((x - 1, y - 1, x, y), 'M'); dot(p, x + 1, y, 'm')
    for k in range(10, 60, 6):   # 배 비늘(아래 줄)
        x, y = ipt(coil[k][:2]); dot(p, x, y + 2, 'u')
    # 상체
    base = (26 + fwd * .6, 38)
    sh = (base[0] + lean * .6, base[1] - 12 - hup)
    mass(p, [((base[0] + sh[0]) / 2, (base[1] + sh[1]) / 2 + 1, 4.6, 7.0, lean * 2)])
    p.box((int(sh[0]) - 3, int(sh[1]) + 4, int(sh[0]) + 4, int(sh[1]) + 6), 'r')
    # 팔(가까운 팔은 앞으로 할퀴기)
    arm_t = {'windup': (-6, -10), 'attack': (14, 2), 'hit': (-8, 6)}.get(n, (6, 8))
    hand = (sh[0] + arm_t[0], sh[1] + 3 + arm_t[1])
    cap(p, [(sh[0] - 1, sh[1] + 2), ((sh[0] + hand[0]) / 2, (sh[1] + hand[1]) / 2 + 2), hand], 2, 'b')
    # 머리 + 머리칼
    hx, hy = sh[0] + 2, sh[1] - 5
    blob(p, hx - 3, hy + 2, 4.2, 6, 0, keys={'l': 'H', 'b': 'h', 's': 'h'})
    blob(p, hx + 1, hy, 4, 4.2, 0)
    blob(p, hx, hy - 3, 4, 2.2, 0, keys={'l': 'H', 'b': 'h', 's': 'h'})
    eyes(p, int(hx) + 2, int(hy), 'x' if n == 'hit' else 'o', 'u', 'l')
    if n in ('attack', 'windup'):
        p.line([(hx + 4, hy + 3), (hx + 7, hy + 4)], 'r'); p.line([(hx + 7, hy + 4), (hx + 8, hy + 3)], 'r')   # 갈라진 혀
    else:
        dot(p, hx + 3, hy + 3, 'r')


if __name__ == '__main__':
    build('monster3-1', 'b5', CELL, PAL, draw)

