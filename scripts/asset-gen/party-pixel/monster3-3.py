"""monster3-3 서큐버스(파티원) — 48 셀. 걷기 칩: 보라 머리, 분홍 뿔, 보라 갑주, 박쥐 날개, 꼬리. 떠서 매혹(swoop).
대기 = 날개 퍼덕·꼬리 살랑, windup = 입맞춤을 날리는 손, attack = 날아들어 할퀴기, dead = 날개를 접고 누움. 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mon_lib import *  # noqa

CELL = 48
PAL = dict(o='151617', s='7f3c2f', b='b87a6a', l='e0b0a0', h='37183f', H='714775', V='906399', q='bc82bc', p='dd94bc', w='2a282d', W='4a3a5a', e='250b05', k='ffffff')


def wing(p, root, fl, near):
    tip = (root[0] - 12, root[1] - 8 + fl)
    p.poly([root, (root[0] - 5, root[1] - 9 + fl * .4), tip, (tip[0] + 2, tip[1] + 5), (root[0] - 7, root[1] + 1 + fl * .3), (root[0] - 4, root[1] + 5)], 'W' if near else 'w', 'o')
    p.line([root, tip], 'V' if near else 'W')


FL = {'idle_a': 0, 'idle_b': 3, 'idle_c': 6, 'windup': -6, 'move': 8, 'attack': -2, 'recover': 4, 'hit': 10}


def draw(p, n):
    G = CELL - 4
    if n == 'dead':
        mass(p, [(22, G - 3, 8, 3, 0)], keys={'l': 'q', 'b': 'V', 's': 'H'})
        blob(p, 14, G - 4, 4, 3.6, 0); blob(p, 11, G - 5, 3.4, 3, 0, keys={'l': 'q', 'b': 'V', 's': 'h'})
        p.poly([(24, G - 5), (34, G - 9), (32, G - 4)], 'w', 'o')
        p.line([(30, G - 2), (38, G - 1)], 'w'); p.poly([(38, G - 3), (41, G - 1), (38, G)], 'p', 'o')
        return
    bob = {'idle_b': 1, 'idle_c': 2, 'move': -2, 'hit': -1}.get(n, 0)
    dx = {'windup': -1, 'move': 3, 'attack': 5, 'recover': 2, 'hit': -3}.get(n, 0)
    cx, top = 22 + dx, 10 + bob
    fl = FL[n]
    wing(p, (cx - 2, top + 11), fl - 3, False)
    # 꼬리
    sw = (fl % 5) - 2
    pts = bez([(cx - 2, top + 20, 1), (cx - 9, top + 24, 1), (cx - 12, top + 18 + sw, .8), (cx - 10, top + 14 + sw, .6)], 14)
    tube(p, pts, 'w', 'o')
    x, y = ipt(pts[-1][:2]); p.poly([(x - 2, y), (x, y - 3), (x + 2, y)], 'p', 'o')
    # 다리(뜬 채 모음)
    for fx_, c in ((-1, 'h'), (2, 'H')):
        p.line([(cx + fx_, top + 21), (cx + fx_ + 1, top + 30)], 'o', 3); p.line([(cx + fx_, top + 21), (cx + fx_ + 1, top + 30)], c)
    # 몸통(갑주)
    mass(p, [(cx, top + 15, 4.2, 6.2, 0)], keys={'l': 'q', 'b': 'V', 's': 'H'})
    p.line([(cx - 2, top + 13), (cx + 3, top + 13)], 'p')
    # 팔
    hand = {'windup': (cx + 4, top + 5), 'attack': (cx + 11, top + 13), 'hit': (cx - 4, top + 20)}.get(n, (cx + 5, top + 19))
    cap(p, [(cx + 1, top + 11), ((cx + hand[0]) / 2 + 1, (top + 11 + hand[1]) / 2 + 1), hand], 2, 'b')
    if n == 'attack':
        for k in range(3): p.line([(hand[0] + 1, hand[1] - 2 + k * 2), (hand[0] + 4, hand[1] - 3 + k * 2)], 'k')
    # 머리
    hx, hy = cx + 1, top + 5
    blob(p, hx - 3, hy + 3, 4, 6, 0, keys={'l': 'q', 'b': 'H', 's': 'h'})
    blob(p, hx + 1, hy, 3.6, 3.8, 0)
    blob(p, hx - 1, hy - 3, 3.8, 2.2, 0, keys={'l': 'q', 'b': 'H', 's': 'h'})
    p.poly([(hx - 1, hy - 4), (hx - 3, hy - 9), (hx + 1, hy - 5)], 'p', 'o')
    if n == 'hit':
        eyes(p, hx + 2, hy, 'x')
    else:
        p.box((hx + 2, hy - 1, hx + 3, hy), 'e'); dot(p, hx + 3, hy - 1, 'p')
    dot(p, hx + 3, hy + 3, 'p')
    if n == 'windup':         # 날리는 하트
        x, y = hand[0] + 4, hand[1] - 2
        p.box((x, y, x + 1, y + 1), 'p'); p.box((x + 3, y, x + 4, y + 1), 'p'); p.box((x + 1, y + 2, x + 3, y + 2), 'p'); dot(p, x + 2, y + 3, 'p')
    wing(p, (cx + 1, top + 11), fl, True)


if __name__ == '__main__':
    build('monster3-3', 'b5', CELL, PAL, draw, ground=False)

