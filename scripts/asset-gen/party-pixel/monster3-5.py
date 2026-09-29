"""monster3-5 새끼 화룡(파티원) — 64 셀. 걷기 칩: 붉은 비늘, 흰 뿔·가시, 살구빛 배, 붉은 날개, 뒷다리로 선 통통한 새끼 용(breath).
대기 = 날개를 살짝 퍼덕·꼬리 흔들, windup = 고개를 뒤로 젖혀 숨을 모음(목이 부풂), attack = 앞으로 입을 벌려 불을 뿜기 시작. 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mon_lib import *  # noqa

CELL = 64
PAL = dict(o='260f1e', s='952735', b='ca333c', l='ff6a5a', w='593030', W='8e5244', t='e8dcc8', T='a9988e', y='c6735f', Y='f0b08a', e='ffe070', f='ff9a2a', F='fff0a0', k='101010')

POSE = {  # 몸 기울기, 머리 dx dy, 날개, 입, 꼬리
    'idle_a': (0, 0, 0, 0, 0, 0), 'idle_b': (0, 0, 1, 4, 0, 2), 'idle_c': (0, 0, 1, 8, 0, 4), 'windup': (-4, -4, -3, -10, 1, -2),
    'move': (3, 2, 1, 12, 0, 3), 'attack': (4, 5, 2, -4, 3, -3), 'recover': (2, 2, 1, 4, 1, 1), 'hit': (-5, -4, -1, 14, 2, 5)}


def draw(p, n):
    G = CELL - 4
    if n == 'dead':
        mass(p, [(28, G - 6, 13, 6, 0), (16, G - 6, 6, 5, 0)], keys={'l': 'l', 'b': 'b', 's': 's'})
        p.poly([(30, G - 10), (44, G - 16), (42, G - 8)], 'w', 'o')
        pts = bez([(40, G - 4, 3), (50, G - 3, 2), (58, G - 2, .6)], 20); tube(p, pts, 'b', 'o', 's')
        eyes(p, 14, G - 7, 'x'); p.poly([(18, G - 11), (20, G - 16), (22, G - 11)], 't', 'o')
        return
    lean, hdx, hdy, wf, mouth, tw = POSE[n]
    cx = 28
    # 꼬리
    pts = bez([(cx - 4, G - 10, 4), (cx - 14, G - 6, 3), (cx - 22, G - 12 + tw, 1.8), (cx - 24, G - 20 + tw, .8)], 30)
    tube(p, pts, 'b', 'o', 's')
    for k in (8, 16, 24):
        x, y = ipt(pts[k][:2]); p.poly([(x - 1, y - 2), (x, y - 5), (x + 2, y - 2)], 't', 'o')
    # 먼 날개
    root = (cx - 2 + lean * .3, G - 26)
    def wing(root, fl, col, rib):
        # 박쥐형 막 날개: 팔뼈 끝(elbow) + 손가락뼈 셋, 사이 막은 가장자리가 오목하게 파인다
        el = (root[0] - 6, root[1] - 12 + fl * .5)
        fingers = [(el[0] - 12, el[1] - 4 + fl * .3), (el[0] - 13, el[1] + 5 + fl * .2), (el[0] - 8, el[1] + 13)]
        pts_ = [root, el, fingers[0]]
        for a, b in zip(fingers, fingers[1:] + [(root[0] - 3, root[1] + 7)]):
            mid = ((a[0] + b[0]) / 2 + 3, (a[1] + b[1]) / 2)
            pts_ += [mid, b]
        p.poly(pts_, col, 'o')
        p.line([root, el], 'o', 2)
        for q in fingers: p.line([el, q], rib)
        dot(p, el[0], el[1] - 1, 't')
    wing((root[0] - 2, root[1] - 1), wf - 4, 'w', 's')
    # 다리(뒤, 앞)
    for fx_, col in ((-5, 's'), (4, 'b')):
        hip = (cx + fx_ + lean * .2, G - 12)
        leg(p, hip, (hip[0] + 2, G), 12, 5, col, 'T' if col == 's' else 't')
    # 몸통 + 배
    mass(p, [(cx + lean * .5, G - 18, 10, 11, lean * 2), (cx + 3 + lean * .6, G - 16, 6, 8, 0)], keys={'l': 'l', 'b': 'b', 's': 's'})
    layer_belly = [(cx + 5 + lean * .6, G - 16 + k * 3) for k in range(4)]
    for k, (x, y) in enumerate(layer_belly):
        p.line([(x - 3, y), (x + 3, y)], 'Y' if k % 2 else 'y')
    # 팔
    arm_t = {'windup': (-2, -4), 'attack': (6, -1)}.get(n, (4, 3))
    sh = (cx + 5 + lean * .6, G - 22)
    cap(p, [sh, (sh[0] + arm_t[0], sh[1] + arm_t[1] + 4)], 3, 'b')
    # 목 + 머리(오른쪽 = 앞)
    neck = (cx + 4 + lean + hdx * .5, G - 28 + hdy * .5)
    hx, hy = cx + 7 + lean + hdx, G - 36 + hdy
    cap(p, [neck, (hx - 1, hy + 3)], 6, 'b')
    blob(p, hx, hy, 7, 6, 0, keys={'l': 'l', 'b': 'b', 's': 's'})
    blob(p, hx + 6, hy + 2, 4.4, 3.4, 0, keys={'l': 'l', 'b': 'b', 's': 's'})
    for dx_, big in ((-4, 0), (-1, 1)):
        p.poly([(hx + dx_ - 1, hy - 4), (hx + dx_ - 4 - big, hy - 11 - big), (hx + dx_ + 2, hy - 5)], 't', 'o')
    eyes(p, int(hx) + 2, int(hy) - 1, 'x' if n == 'hit' else 'o', 'e', 'F')
    dot(p, hx + 9, hy + 1, 'o')
    if mouth:
        p.poly([(hx + 3, hy + 4), (hx + 11, hy + 4 + mouth), (hx + 3, hy + 5 + mouth)], 'k')
        if n == 'attack':
            for k in range(3):
                x = hx + 11 + k * 3
                p.box((int(x), int(hy) + 4 + k % 2, int(x) + 2, int(hy) + 6 + k % 2), 'f' if k else 'F')
        if n == 'windup':
            dot(p, hx + 5, hy + 5, 'f')
    wing(root, wf, 'W', 'b')


if __name__ == '__main__':
    build('monster3-5', 'b5', CELL, PAL, draw)

