"""monster5-3 저주 인형(파티원) — 48 셀. 걷기 칩: 흰 도자기 얼굴(단추 눈·X 꿰맨 눈), 검보라 머리, 붉은 드레스, 머리 위 나무 조종대와 흰 실.
대기 = 조종대가 흔들리며 인형이 들썩 · attack 실에 끌려 앞으로 휙 할퀸다 · 시전 = 실을 뻗어 저주 · finisher 거대한 조종대가 적을 실로 묶는다.
왼쪽을 본다(hop)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_nm5 import *  # noqa


def thread_to(pts, k='S'):
    def f(c, o):
        c.at(0, 0)
        for a, b in zip(pts, pts[1:]):
            c.line([a, b], k)
    return f


def curse_mark(c, x, y, k='dl'):
    c.at(0, 0)
    ring(c, x, y, 4, 4, k, gap=4)
    c.line([(x - 2, y - 2), (x + 2, y + 2)], k)
    c.line([(x + 2, y - 2), (x - 2, y + 2)], k)


def scratch(c, o):
    c.at(0, 0)
    for k in range(3):
        c.line([(o[0] - 10 - k * 2, o[1] - 18 + k), (o[0] - 14 - k * 2, o[1] - 8 + k)], 'S' if k != 1 else 'dl')


def hit_fx(c, o):
    spark(c, o[0] - 8, o[1] - 20, 'S', True)
    c.at(0, 0)
    c.line([(o[0] + 5, o[1] - 28), (o[0] + 9, o[1] - 34)], 'S')


def charge(c, o):
    ring(c, o[0], o[1] - 13, 12, 12, 'dm', gap=3)
    for a in (0.4, 2.0, 3.6, 5.2):
        dot(c, o[0] + math.cos(a) * 12, o[1] - 13 + math.sin(a) * 12, 'S')


def raise_(c, o):
    c.at(0, 0)
    for x in (-12, 12):
        c.line([(o[0] + x // 2, o[1] - 30), (o[0] + x, o[1] - 14)], 'S')
    curse_mark(c, o[0] - 12, o[1] - 12)
    curse_mark(c, o[0] + 12, o[1] - 14, 'dm')


def release(c, o):
    c.at(0, 0)
    for k, y in enumerate((-18, -12, -6)):
        c.line([(o[0] - 5, o[1] - 11), (o[0] - 21, o[1] + y + k)], 'S')
    curse_mark(c, o[0] - 18, o[1] - 13)


def buff(c, o):
    c.at(0, 0)
    for x in (-9, 9):
        c.line([(o[0] + x, o[1] - 30), (o[0] + x, o[1] - 2)], 'S')
    for x, y in ((-9, -20), (9, -12), (-9, -8)):
        c.ell(o[0] + x, o[1] + y, 2.2, 1.8, ('dd', 'dm', 'dl'), shade=False)
        dot(c, o[0] + x - .5, o[1] + y - .5, 'dl')


def fin_back(c, o):
    c.at(0, 0)
    c.rect(o[0] - 18, o[1] - 38, o[0] + 16, o[1] - 36, ('wd', 'wl', 'wl'))
    c.rect(o[0] - 2, o[1] - 40, o[0] + 1, o[1] - 34, ('wd', 'wl', 'wl'))
    for x in (-16, -10, 10, 14):
        c.line([(o[0] + x, o[1] - 35), (o[0] + x - 2, o[1] - 4)], 'S')


def fin_front(c, o):
    curse_mark(c, o[0] - 16, o[1] - 20)
    curse_mark(c, o[0] - 14, o[1] - 7, 'dm')
    star(c, o[0] - 4, o[1] - 31, 3, 'S', 'dl')


POSES = {
    'idle_a': {},
    'idle_b': {'P': {'bar': 2, 'ph': 0}, 'dy': -1},
    'idle_c': {'P': {'bar': -1, 'ph': 2}, 'dy': 0},
    'windup': {'P': {'bar': 4, 'bar_y': -30, 'hands': [(2, -16)]}, 'dx': 3, 'lean': 2, 'dy': -1},
    'move': {'P': {'bar': -3, 'step': -1, 'ph': 0}, 'dx': -4, 'dy': -3, 'lean': -2},
    'attack': {'P': {'bar': -4, 'hands': [(-8, -14)]}, 'dx': -3, 'lean': -3, 'front': scratch},
    'recover': {'P': {'bar': 0, 'step': 1, 'hands': [(-5, -9)]}, 'dx': -1},
    'hit': {'P': {'bar': 5, 'eye': 'x', 'strings': False}, 'dx': 3, 'lean': 4, 'front': hit_fx},
    'dead': {'P': {'eye': 'x', 'strings': False, 'hands': [(-3, -6)]}, 'rot': 3, 'floor': True},
    'cast_charge': {'P': {'bar': 0, 'hands': [(-3, -12)]}, 'back': charge},
    'cast_raise': {'P': {'bar': 0, 'bar_y': -30, 'hands': [(-2, -20)]}, 'dy': -2, 'back': raise_},
    'cast_release': {'P': {'bar': -3, 'hands': [(-7, -12)]}, 'dx': 1, 'lean': -2, 'front': release},
    'leap': {'P': {'bar': 1, 'bar_y': -29, 'step': 1, 'hands': [(-4, -17)]}, 'dy': -8},
    'buff': {'P': {'bar': 0, 'hands': [(-3, -15)], 'eye': 'x'}, 'back': buff},
    'finisher': {'P': {'bar': -1, 'hands': [(-6, -18)], 'eye': 'x'}, 'dy': -2, 'back': fin_back, 'front': fin_front},
}

if __name__ == '__main__':
    build(3, POSES, hover=0)

