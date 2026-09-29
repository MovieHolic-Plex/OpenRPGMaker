"""monster5-4 마도서(파티원) — 48 셀. 걷기 칩: 보라 가죽 표지에 금 모서리, 벌어진 책장 사이 이빨·붉은 혀, 표지의 노란 눈, 뒤쪽 책장 날개.
떠 있다(float, dead 만 바닥). 대기 = 책장 날개를 퍼덕 · attack 활짝 벌려 문다 · 시전 = 룬을 띄워 난사 · finisher 책장 폭풍.
왼쪽을 본다."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_nm5 import *  # noqa


def rune(c, x, y, k='C', v=0):
    c.at(0, 0)
    shapes = [[(0, -2), (0, 2), (-2, 0), (2, 0)], [(-2, -2), (2, 2), (2, -2), (-2, 2)], [(-2, -2), (2, -2), (0, 2), (-2, -2)]]
    pts = shapes[v % 3]
    for a, b in zip(pts[::2], pts[1::2]) if v % 3 < 2 else zip(pts, pts[1:]):
        c.line([(x + a[0], y + a[1]), (x + b[0], y + b[1])], k)


def page(c, x, y, tilt=0):
    c.at(0, 0)
    c.poly([(x - 2, y - 2 + tilt), (x + 2, y - 2), (x + 2, y + 2 - tilt), (x - 2, y + 2)], ('pd', 'pm', 'pl'))


def bite(c, o):
    arc(c, o[0] - 8, o[1] - 13, 6, 140, 220, 'pl', 1)
    spark(c, o[0] - 16, o[1] - 14, 'E')


def hit_fx(c, o):
    spark(c, o[0] - 5, o[1] - 20, 'pl', True)
    page(c, o[0] + 9, o[1] - 24, 1)


def charge(c, o):
    ring(c, o[0], o[1] - 13, 13, 11, 'vl', gap=3)
    for k in range(3):
        a = .6 + k * 2.1
        rune(c, o[0] + math.cos(a) * 13, o[1] - 13 + math.sin(a) * 11, 'C', k)


def raise_(c, o):
    for k, (x, y) in enumerate(((-8, -28), (0, -31), (8, -27))):
        rune(c, o[0] + x, o[1] + y, 'C' if k != 1 else 'E', k)
    rays(c, o[0] - 1, o[1] - 13, 11, 14, 8, 'vl')


def release(c, o):
    for k, (x, y) in enumerate(((-14, -18), (-19, -12), (-15, -6))):
        rune(c, o[0] + x, o[1] + y, 'C', k)
    speed(c, o[0] - 10, o[1] - 20, 'vl', 3, 4)


def buff(c, o):
    for k in range(5):
        a = k * 2 * math.pi / 5
        page(c, o[0] + math.cos(a) * 13, o[1] - 13 + math.sin(a) * 11, k % 2)
    ring(c, o[0], o[1] - 13, 9, 8, 'G', gap=4)


def fin_back(c, o):
    c.at(0, 0)
    c.ell(o[0], o[1] - 14, 16, 14, 'vd', out=None, shade=False)
    ring(c, o[0], o[1] - 14, 16, 14, 'vl')
    ring(c, o[0], o[1] - 14, 12, 10, 'G', gap=3)
    for k in range(6):
        a = k * math.pi / 3 + .3
        rune(c, o[0] + math.cos(a) * 14, o[1] - 14 + math.sin(a) * 12, 'C', k)


def fin_front(c, o):
    for k, (x, y) in enumerate(((-18, -8), (-20, -20), (-12, -28))):
        page(c, o[0] + x, o[1] + y, k % 2)
    spark(c, o[0] - 14, o[1] - 15, 'E')


POSES = {
    'idle_a': {},
    'idle_b': {'P': {'ph': 0, 'flap': -3}, 'dy': -1},
    'idle_c': {'P': {'ph': 2, 'flap': 3}, 'dy': -2},
    'windup': {'P': {'open': 1.1, 'flap': -4}, 'dx': 3, 'lean': 2},
    'move': {'P': {'open': .4, 'flap': 4, 'tongue': False}, 'dx': -3, 'dy': -2, 'lean': -2},
    'attack': {'P': {'open': 1.3, 'flap': 2}, 'dx': -2, 'lean': -3, 'front': bite},
    'recover': {'P': {'open': .5, 'flap': 0}, 'dx': -1, 'dy': 1},
    'hit': {'P': {'open': .15, 'eye': 'shut', 'tongue': False, 'flap': -4}, 'dx': 3, 'lean': 3, 'front': hit_fx},
    'dead': {'P': {'open': 0.0, 'eye': 'shut', 'tongue': False, 'flap': 3}, 'floor': True},
    'cast_charge': {'P': {'open': .9, 'tongue': False, 'flap': 1}, 'back': charge},
    'cast_raise': {'P': {'open': 1.2, 'tongue': False, 'flap': -4}, 'dy': -3, 'back': raise_},
    'cast_release': {'P': {'open': 1.3, 'flap': 3}, 'dx': 1, 'lean': -2, 'front': release},
    'leap': {'P': {'open': .7, 'flap': -5}, 'dy': -8},
    'buff': {'P': {'open': .6, 'eye': 'shut', 'tongue': False, 'flap': 0}, 'dy': -1, 'back': buff},
    'finisher': {'P': {'open': 1.4, 'flap': -5}, 'dy': -2, 'back': fin_back, 'front': fin_front},
}

if __name__ == '__main__':
    build(4, POSES, hover=M5.BATTLE_HOVER[4])

