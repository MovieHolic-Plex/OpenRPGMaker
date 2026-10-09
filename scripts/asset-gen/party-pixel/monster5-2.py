"""monster5-2 초롱 귀신(파티원) — 48 셀. 걷기 칩: 주황 종이 초롱(가로 살 무늬), 커다란 외눈, 긴 혀, 곁의 푸른 도깨비불.
떠 있다(float, dead 만 바닥). 대기 = 둥실 · attack 혀로 후려친다 · 시전 = 도깨비불을 모아 쏜다 · finisher 도깨비불 고리.
왼쪽을 본다."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_nm5 import *  # noqa

BLUE = ('bm', 'bm', 'bl')


def wisp(x, y, h=5):
    def f(c, o):
        c.at(0, 0)
        M5.flame(c, x, y, h, 0, BLUE, 'bl', 1.6)
    return f


def many(*fs):
    def f(c, o):
        for g in fs:
            g(c, o)
    return f


def lick(c, o):
    arc(c, o[0] - 10, o[1] - 6, 6, 120, 230, 'tm', 1)
    spark(c, o[0] - 18, o[1] - 6, 'W')


def hit_fx(c, o):
    spark(c, o[0] - 8, o[1] - 20, 'W', True)
    dot(c, o[0] - 11, o[1] - 12, 'pl')


def charge(c, o):
    for k in range(4):
        a = k * math.pi / 2 + .4
        c.at(0, 0)
        M5.flame(c, o[0] + math.cos(a) * 12, o[1] - 14 + math.sin(a) * 10, 4, 0, BLUE, 'bl', 1.3)


def raise_(c, o):
    for k, x in enumerate((-8, 0, 8)):
        c.at(0, 0)
        M5.flame(c, o[0] + x, o[1] - 30 + abs(x) // 2, 5, 0, BLUE, 'bl', 1.6)
    rays(c, o[0], o[1] - 14, 10, 13, 10, 'bl')


def release(c, o):
    fireball(c, o[0] - 14, o[1] - 12, 2.5, ('bm', 'bm', 'bl'), 6)
    fireball(c, o[0] - 20, o[1] - 20, 1.8, ('bm', 'bm', 'bl'), 4)


def buff(c, o):
    ring(c, o[0], o[1] - 14, 11, 12, 'bl', gap=2)
    ring(c, o[0], o[1] - 14, 13, 14, 'bm', gap=5)


def fin_back(c, o):
    for k in range(8):
        a = k * math.pi / 4
        c.at(0, 0)
        M5.flame(c, o[0] + math.cos(a) * 16, o[1] - 14 + math.sin(a) * 13, 5, 0, BLUE, 'bl', 1.6)
    ring(c, o[0], o[1] - 14, 11, 10, 'bm', gap=3)


def fin_front(c, o):
    rays(c, o[0] - 3, o[1] - 15, 3, 5, 6, 'W')


def trail(c, o):
    speed(c, o[0] + 8, o[1] - 18, 'bl', 3, 5)


POSES = {
    'idle_a': {},
    'idle_b': {'P': {'wisp': 0, 'tongue': -1}, 'dy': -1},
    'idle_c': {'P': {'wisp': 2, 'tongue': 1}, 'dy': -2},
    'windup': {'P': {'mouth': 2, 'tongue': 1, 'wisp': 0}, 'dx': 3, 'lean': 2},
    'move': {'P': {'tongue': 2, 'wisp': 2}, 'dx': -4, 'lean': -2, 'dy': -2, 'back': trail},
    'attack': {'P': {'mouth': 3, 'tongue': -4, 'wisp': 1}, 'dx': -2, 'lean': -3, 'front': lick},
    'recover': {'P': {'mouth': 1, 'tongue': 0, 'wisp': 2}, 'dx': -2, 'dy': -1},
    'hit': {'P': {'eye': 'x', 'tongue': None, 'wisp': 0}, 'dx': 3, 'lean': 3, 'front': hit_fx},
    'dead': {'P': {'eye': 'x', 'tongue': 2, 'wisp_on': False}, 'rot': 3, 'floor': True},
    'cast_charge': {'P': {'eye': 'shut', 'wisp_on': False, 'tongue': None}, 'back': charge},
    'cast_raise': {'P': {'mouth': 2, 'wisp_on': False, 'tongue': 0}, 'dy': -3, 'back': raise_},
    'cast_release': {'P': {'mouth': 3, 'wisp_on': False, 'tongue': -2}, 'dx': 1, 'lean': -2, 'front': release},
    'leap': {'P': {'tongue': 3, 'wisp': 1}, 'dy': -9},
    'buff': {'P': {'eye': 'shut', 'tongue': None, 'wisp': 1}, 'dy': -1, 'back': buff},
    'finisher': {'P': {'mouth': 3, 'tongue': -3, 'wisp_on': False}, 'dy': -3, 'back': fin_back, 'front': fin_front},
}

if __name__ == '__main__':
    build(2, POSES, hover=M5.BATTLE_HOVER[2])

