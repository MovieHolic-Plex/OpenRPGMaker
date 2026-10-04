"""monster5-1 살아있는 갑옷(파티원) — 48 셀. 걷기 칩: 은빛 판금, 투구 틈의 보라 눈, 투구 꼭대기의 보라 영혼 불꽃, 금 손잡이 대검.
대기 = 영혼 불꽃이 일렁 · windup 대검을 머리 위로 · attack 앞으로 크게 내려벤다 · 시전 = 대검에 보라 영혼을 입혀 방출 · finisher 영혼 대검 내려꽂기.
왼쪽을 본다(stomp)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_nm5 import *  # noqa


def slash(c, o):
    arc(c, o[0] - 2, o[1] - 12, 12, 195, 290, 'pl', 2, 'B')
    arc(c, o[0] - 2, o[1] - 12, 9, 205, 280, 'pm', 1)


def hit_fx(c, o):
    spark(c, o[0] - 7, o[1] - 20, 'B', True)
    dot(c, o[0] - 10, o[1] - 14, 'sl')


def soul_rise(c, o):
    for k, (x, y) in enumerate(((o[0] - 6, o[1] - 12), (o[0] + 7, o[1] - 20), (o[0] - 2, o[1] - 32))):
        c.at(0, 0)
        M5.flame(c, x, y, 5 - k % 2, (-1, 1, 0)[k], ('pd', 'pm', 'pl'), 'B', 1.4)


def dead_soul(c, o):
    c.at(0, 0)
    M5.flame(c, o[0] + 2, o[1] - 12, 6, 1, ('pd', 'pm', 'pl'), 'B', 1.6)


def charge(c, o):
    ring(c, o[0] - 1, o[1] - 14, 12, 14, 'pd', gap=4)
    ring(c, o[0] - 1, o[1] - 14, 8, 10, 'pm', gap=3)


def raise_(c, o):
    rays(c, o[0] - 2, o[1] - 34, 3, 6, 8, 'pl')
    soul_rise(c, o)


def release(c, o):
    for k in range(3):
        arc(c, o[0] - 12 - k * 3, o[1] - 16, 6 + k * 2, 140, 220, ('pl', 'pm', 'pd')[k], 1)
    spark(c, o[0] - 18, o[1] - 24, 'B')


def buff(c, o):
    c.at(0, 0)
    for x in (-10, 10):
        M5.flame(c, o[0] + x, o[1], 12, 0, ('pd', 'pm', 'pl'), None, 2)
    ring(c, o[0], o[1] - 2, 12, 2, 'pm')


def fin_back(c, o):
    c.at(0, 0)
    M5.flame(c, o[0] + 1, o[1], 32, 0, ('pd', 'pm', 'pl'), 'B', 11)


def fin_front(c, o):
    rays(c, o[0] - 6, o[1] - 7, 3, 6, 6, 'B', .3)
    spark(c, o[0] - 17, o[1] - 30, 'B', True)


POSES = {
    'idle_a': {},
    'idle_b': {'P': {'wisp': 0, 'sword': (-3, -12, 58)}},
    'idle_c': {'P': {'wisp': 2, 'sword': (-3, -13, 52)}, 'dy': 0, 'lean': 1},
    'windup': {'P': {'sword': (1, -20, 25), 'wisp': 0}, 'lean': 2, 'dx': 2},
    'move': {'P': {'step': -1, 'sword': (-2, -14, 70)}, 'dx': -4, 'lean': -2},
    'attack': {'P': {'sword': (-4, -13, -112), 'sword_back': False, 'wisp': 2}, 'dx': -3, 'lean': -3, 'front': slash},
    'recover': {'P': {'sword': (-5, -10, -122), 'sword_back': False, 'step': 1}, 'dx': -3},
    'hit': {'P': {'sword': (-2, -12, 80), 'eye': 'B', 'wisp': 0}, 'dx': 3, 'lean': 3, 'front': hit_fx},
    'dead': {'P': {'sword': (-3, -9, 170), 'eye': 'k'}, 'rot': 3, 'floor': True, 'front': dead_soul},
    'cast_charge': {'P': {'sword': (-4, -13, 0), 'glow': True}, 'back': charge},
    'cast_raise': {'P': {'sword': (-2, -21, 0), 'glow': True, 'wisp': 2}, 'dy': -1, 'back': raise_},
    'cast_release': {'P': {'sword': (-5, -15, -70), 'glow': True, 'sword_back': False}, 'dx': 0, 'lean': -2, 'front': release},
    'leap': {'P': {'sword': (-1, -19, -15), 'step': 1}, 'dy': -8},
    'buff': {'P': {'sword': (-5, -16, 180), 'sword_back': False, 'glow': True, 'wisp': 1}, 'back': buff},
    'finisher': {'P': {'sword': (-6, -19, -5), 'glow': True, 'sword_back': False, 'wisp': 2}, 'dx': 1, 'back': fin_back, 'front': fin_front},
}

if __name__ == '__main__':
    build(1, POSES, hover=0)

