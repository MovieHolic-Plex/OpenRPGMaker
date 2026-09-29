"""monster5-6 태엽 병정(파티원) — 48 셀. 걷기 칩: 붉은 샤코 모자(금 휘장·흰 깃털), 분홍 볼 나무 얼굴, 남색 제복·흰 X 띠, 흰 바지, 등의 금 태엽, 머스킷.
태엽이 돌며 뚜벅 걷는다. attack 머스킷을 겨눠 나사 탄환 발사(shoot) · 시전 = 태엽을 감아 과충전 · finisher 연발 일제사격.
왼쪽을 본다."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_nm5 import *  # noqa

AIM = ('aim', -5, -13, -90)


def screw(c, x, y, k='mm'):
    c.at(0, 0)
    c.rect(x - 2, y - 1, x + 1, y, (k, k, k), out='o', shade=False)
    c.px(x + 2, y - 1, 'gm')
    c.px(x + 2, y, 'gm')
    c.px(x - 1, y - 1, 'W')


def muzzle(c, o, big=False):
    x, y = o[0] - 22, o[1] - 14
    star(c, x + 2, y, 3 if big else 2, 'gm', 'W')


def shot(c, o):
    muzzle(c, o)
    screw(c, o[0] - 20, o[1] - 20)


def smoke(c, o):
    puff(c, o[0] - 19, o[1] - 16, 1.8, ('mm', 'W', 'W'))


def hit_fx(c, o):
    spark(c, o[0] - 6, o[1] - 20, 'W', True)
    for x, y in ((8, -26), (11, -18)):
        c.at(0, 0)
        c.ell(o[0] + x, o[1] + y, 1.3, 1.3, ('gd', 'gm', 'gm'), shade=False)


def gears(c, o):
    for x, y in ((-10, -1), (9, -2)):
        c.at(0, 0)
        c.ell(o[0] + x, o[1] + y, 1.8, 1.8, ('gd', 'gm', 'gm'), out='o', shade=False)
    screw(c, o[0] + 13, o[1] - 1)


def charge(c, o):
    arc(c, o[0] + 6, o[1] - 14, 7, -60, 200, 'gm', 1)
    dot(c, o[0] + 13, o[1] - 20, 'W')
    ring(c, o[0], o[1] - 14, 12, 13, 'gd', gap=4)


def raise_(c, o):
    rays(c, o[0] + 6, o[1] - 14, 6, 10, 8, 'gm')
    spark(c, o[0] + 6, o[1] - 25, 'W')


def release(c, o):
    muzzle(c, o, True)
    for k, y in enumerate((-19, -14, -9)):
        screw(c, o[0] - 18 - k * 2, o[1] + y)


def buff(c, o):
    arc(c, o[0] + 6, o[1] - 14, 8, 0, 330, 'gm', 1)
    arc(c, o[0] + 6, o[1] - 14, 10, 30, 300, 'W', 1)
    for x in (-10, 12):
        c.at(0, 0)
        c.line([(o[0] + x, o[1] - 2), (o[0] + x, o[1] - 8)], 'gm')
        c.line([(o[0] + x - 2, o[1] - 6), (o[0] + x, o[1] - 8), (o[0] + x + 2, o[1] - 6)], 'gm')


def fin_back(c, o):
    for k in range(5):
        a = k * 2 * math.pi / 5 + .2
        c.at(0, 0)
        c.ell(o[0] + 4 + math.cos(a) * 12, o[1] - 16 + math.sin(a) * 12, 2.4, 2.4, ('gd', 'gm', 'gm'), out='o', shade=False)
    arc(c, o[0] + 4, o[1] - 16, 10, 0, 360, 'gd', 1)


def fin_front(c, o):
    muzzle(c, o, True)
    for k, (x, y) in enumerate(((-19, -21), (-21, -9), (-15, -24), (-17, -5))):
        screw(c, o[0] + x, o[1] + y, 'gm' if k % 2 else 'mm')


POSES = {
    'idle_a': {},
    'idle_b': {'P': {'key': 0}},
    'idle_c': {'P': {'key': 2}, 'dy': 0, 'lean': 1},
    'windup': {'P': {'gun': ('aim', -4, -14, -70), 'key': 0}, 'dx': 3, 'lean': 1},
    'move': {'P': {'step': -1, 'key': 2}, 'dx': -3, 'lean': -2},
    'attack': {'P': {'gun': AIM, 'key': 1, 'mouth': 'open'}, 'dx': 3, 'front': shot},
    'recover': {'P': {'gun': ('aim', -4, -13, -60), 'key': 2}, 'dx': 5, 'lean': 1, 'front': smoke},
    'hit': {'P': {'key': 0, 'mouth': 'open'}, 'dx': 3, 'lean': 4, 'front': hit_fx},
    'dead': {'P': {'key': 2}, 'rot': 3, 'floor': True, 'back': gears},
    'cast_charge': {'P': {'key': 1}, 'back': charge},
    'cast_raise': {'P': {'gun': ('aim', -3, -16, -20), 'key': 2}, 'dy': -1, 'back': raise_},
    'cast_release': {'P': {'gun': AIM, 'key': 0, 'mouth': 'open'}, 'dx': 3, 'lean': 1, 'front': release},
    'leap': {'P': {'step': 1, 'gun': ('aim', -4, -14, -40), 'key': 1}, 'dy': -8},
    'buff': {'P': {'key': 0, 'mouth': 'open'}, 'back': buff},
    'finisher': {'P': {'gun': ('aim', -5, -14, -95), 'key': 2, 'mouth': 'open'}, 'dx': 3, 'back': fin_back, 'front': fin_front},
}

if __name__ == '__main__':
    build(6, POSES, hover=0)

