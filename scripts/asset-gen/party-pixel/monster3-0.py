"""monster3-0 세이렌(파티원) — 48 셀. 걷기 칩: 붉은 곱슬머리, 흰 날개 팔, 보라 치마, 새 발. 떠서 노래한다(swoop).
대기 = 날개 팔을 천천히 퍼덕, windup = 날개를 크게 펼쳐 숨을 들이켬, attack = 입을 벌려 노래(음파) + 발톱, dead = 날개를 접고 쓰러짐. 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mon_lib import *  # noqa

CELL = 48
PAL = dict(o='292929', s='c67e5e', b='e0a88a', l='f6d0b8', R=['821018', 'bc2120', 'ff3f44'], w='9a9797', W='e8e8e8', v='5a2a6a', V='a04aa0', y='d8ad50', e='101010')
PAL = dict(o='292929', s='c67e5e', b='e0a88a', l='f6d0b8', r='821018', q='bc2120', Q='ff3f44', w='9a9797', W='e8e8e8', v='5a2a6a', V='a04aa0', y='d8ad50', e='101010', k='ffffff')


def wing(p, root, spread, near):
    tips = []
    for k in range(4):
        a = math.radians(-150 + spread + k * 22)
        ln = 12 - k * 1.5
        tip = (root[0] + math.cos(a) * ln, root[1] + math.sin(a) * ln)
        p.poly([root, (root[0] + math.cos(a - .2) * ln * .6, root[1] + math.sin(a - .2) * ln * .6), tip,
                (root[0] + math.cos(a + .25) * ln * .5, root[1] + math.sin(a + .25) * ln * .5)], 'W' if near else 'w', 'o')
        tips.append(tip)
    return tips


SPREAD = {'idle_a': 20, 'idle_b': 34, 'idle_c': 48, 'windup': -10, 'move': 60, 'attack': 80, 'recover': 50, 'hit': 100}


def draw(p, n):
    G = CELL - 4
    if n == 'dead':
        mass(p, [(22, G - 4, 7, 4, 0), (30, G - 3, 5, 3, 0)], keys={'l': 'W', 'b': 'w', 's': 'w'})
        blob(p, 15, G - 4, 4, 3.6, 0)
        for k in range(4): blob(p, 11 + k * 2, G - 6 - (k % 2), 2.2, 2, 0, keys={'l': 'Q', 'b': 'q', 's': 'r'})
        p.box((34, G - 3, 38, G - 2), 'v'); p.line([(38, G - 1), (40, G)], 'y')
        return
    bob = {'idle_b': 1, 'idle_c': 2, 'windup': -1, 'move': -2, 'attack': 0, 'hit': -1}.get(n, 0)
    dx = {'windup': -2, 'move': 2, 'attack': 3, 'recover': 1, 'hit': -3}.get(n, 0)
    cx, top = 23 + dx, 11 + bob
    sp = SPREAD[n]
    wing(p, (cx - 2, top + 11), sp - 20, False)
    # 치마 + 새 다리
    p.poly([(cx - 5, top + 19), (cx + 4, top + 19), (cx + 7, top + 26), (cx - 7, top + 26)], 'v', 'o')
    p.line([(cx + 3, top + 20), (cx + 5, top + 25)], 'V')
    for fx_ in (-2, 2):
        p.line([(cx + fx_, top + 26), (cx + fx_ + 1, top + 31)], 'y')
        p.line([(cx + fx_ + 1, top + 31), (cx + fx_ + 3, top + 32)], 'y')
    # 몸통
    mass(p, [(cx, top + 15, 4.2, 5.5, 0)])
    p.line([(cx - 3, top + 12), (cx + 3, top + 12)], 'V')
    # 머리 + 곱슬 붉은 머리칼
    hx, hy = cx + 1, top + 5
    for (ox, oy, r) in ((-4, 1, 3.6), (-3, -3, 3.4), (1, -4, 3.2), (-5, 5, 3), (-2, 7, 2.6)):
        blob(p, hx + ox, hy + oy, r, r, 0, keys={'l': 'Q', 'b': 'q', 's': 'r'})
    blob(p, hx + 1, hy + 1, 3.6, 3.8, 0)
    blob(p, hx - 1, hy - 3, 3.4, 2, 0, keys={'l': 'Q', 'b': 'q', 's': 'r'})
    if n == 'hit':
        eyes(p, hx + 2, hy, 'x')
    elif n == 'windup':
        p.line([(hx + 2, hy), (hx + 3, hy)], 'e')
    else:
        p.box((hx + 2, hy - 1, hx + 3, hy), 'e'); dot(p, hx + 3, hy - 1, 'k')
    if n in ('attack', 'hit', 'move'):
        p.box((hx + 3, hy + 3, hx + 4, hy + 4), 'r')
    else:
        dot(p, hx + 3, hy + 3, 'r')
    if n == 'attack':
        for k in range(3):
            p.arc_pts = None
            r = 4 + k * 3
            p.d.arc((hx + 6 - r, hy + 3 - r, hx + 6 + r, hy + 3 + r), -40, 40, fill=p.pal['k'] if k == 0 else p.pal['W'])
    wing(p, (cx + 1, top + 11), sp, True)


if __name__ == '__main__':
    build('monster3-0', 'b5', CELL, PAL, draw, ground=False)

