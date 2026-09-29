"""monster5-7 촛불 임프(파티원) — 48 셀. 걷기 칩: 흘러내린 흰 촛농 몸, 작은 뿔, 노란 불빛 눈, 머리 위 큰 불꽃, 불붙은 꼬리, 손끝의 작은 불, 발밑 촛농 웅덩이.
통통 뛴다(hop). attack 손불을 던진다 · 시전 = 머리 불꽃을 키워 방출 · dead 녹아 촛농 웅덩이 · finisher 거대한 불기둥.
왼쪽을 본다."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_nm5 import *  # noqa

FIRE = ('fd', 'fm', 'fl')


def throw(c, o):
    fireball(c, o[0] - 15, o[1] - 12, 2.4, FIRE, 5)


def hit_fx(c, o):
    spark(c, o[0] - 6, o[1] - 16, 'W', True)
    for x, y in ((-8, -2), (7, -3)):
        dot(c, o[0] + x, o[1] + y, 'xm')


def melt(c, o):
    c.at(0, 0)
    c.ell(o[0], o[1] - 1, 11, 1.6, ('xd', 'xm', 'xl'))
    M5.flame(c, o[0] - 3, o[1] - 1, 3, 0, FIRE, None, 1.0)


def charge(c, o):
    for k in range(5):
        a = k * 2 * math.pi / 5 + .5
        dot(c, o[0] + math.cos(a) * 11, o[1] - 12 + math.sin(a) * 10, 'fm')
    ring(c, o[0], o[1] - 12, 12, 11, 'fd', gap=3)


def raise_(c, o):
    rays(c, o[0], o[1] - 30, 4, 7, 8, 'fl')


def release(c, o):
    fireball(c, o[0] - 14, o[1] - 20, 3.2, FIRE, 7)
    fireball(c, o[0] - 18, o[1] - 10, 2.0, FIRE, 4)


def buff(c, o):
    c.at(0, 0)
    for x in (-10, 10):
        M5.flame(c, o[0] + x, o[1], 9, 0, FIRE, 'W', 2.0)
    ring(c, o[0], o[1] - 2, 11, 1.4, 'fm')


def fin_back(c, o):
    c.at(0, 0)
    M5.flame(c, o[0], o[1], 36, 0, FIRE, 'W', 12)


def fin_front(c, o):
    for x, y in ((-17, -24), (-15, -8), (15, -18)):
        star(c, o[0] + x, o[1] + y, 2, 'fl', 'W')


POSES = {
    'idle_a': {},
    'idle_b': {'P': {'ph': 0, 'flame': 6, 'sway': -1}, 'dy': 0},
    'idle_c': {'P': {'ph': 2, 'flame': 8, 'sway': 1}, 'lean': 1},
    'windup': {'P': {'hand': (2, -16), 'flame': 9, 'sway': 1}, 'dx': 3, 'lean': 2},
    'move': {'P': {'step': -1, 'hand': (-5, -7), 'puddle': False, 'sway': 2}, 'dx': -4, 'dy': -3, 'lean': -2},
    'attack': {'P': {'hand': (-7, -12), 'hand_flame': False, 'flame': 7, 'sway': 2}, 'dx': -2, 'lean': -3, 'front': throw},
    'recover': {'P': {'hand': (-5, -7), 'flame': 6, 'sway': 1, 'step': 1}, 'dx': -1},
    'hit': {'P': {'flame': 4, 'sway': 2, 'eye': 'W'}, 'dx': 3, 'lean': 3, 'front': hit_fx},
    'dead': {'P': {'flame': 2, 'hand_flame': False, 'puddle': False, 'eye': 'o'}, 'rot': 3, 'floor': True, 'rot_dy': -1, 'back': melt},
    'cast_charge': {'P': {'hand': (-4, -13), 'flame': 9, 'sway': 0}, 'back': charge},
    'cast_raise': {'P': {'hand': (-3, -18), 'flame': 12, 'sway': 0}, 'dy': -1, 'back': raise_},
    'cast_release': {'P': {'hand': (-7, -14), 'hand_flame': False, 'flame': 10, 'sway': 2}, 'dx': 2, 'lean': -2, 'front': release},
    'leap': {'P': {'puddle': False, 'step': 1, 'flame': 9, 'sway': 2}, 'dy': -8},
    'buff': {'P': {'flame': 11, 'sway': -1, 'eye': 'W'}, 'back': buff},
    'finisher': {'P': {'hand': (-4, -18), 'flame': 13, 'sway': 0, 'eye': 'W'}, 'back': fin_back, 'front': fin_front},
}

if __name__ == '__main__':
    build(7, POSES, hover=0)

