"""monster5-5 허수아비(파티원) — 48 셀. 걷기 칩: 삼베 자루 머리(주황 불빛 눈·꿰맨 입), 해진 갈색 모자, 푸른 셔츠(붉은 기움), 짚 손, 나무 기둥 다리, 낫, 어깨의 까마귀.
기둥 하나로 통통 뛴다(hop). attack 낫을 앞으로 휘둘러 벤다 · 시전 = 까마귀를 불러 날린다 · finisher 까마귀 떼와 큰 낫질.
왼쪽을 본다."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_nm5 import *  # noqa


def swing(c, o):
    arc(c, o[0] - 2, o[1] - 14, 12, 185, 280, 'Ll', 2)
    arc(c, o[0] - 2, o[1] - 14, 10, 190, 270, 'Ld', 1)


def hit_fx(c, o):
    spark(c, o[0] - 7, o[1] - 22, 'zl', True)
    dot(c, o[0] + 8, o[1] - 14, 'zl')
    dot(c, o[0] + 10, o[1] - 9, 'zm')


def straw_fall(c, o):
    c.at(0, 0)
    for x, y in ((-10, -3), (-6, -1), (8, -2)):
        c.line([(o[0] + x, o[1] + y), (o[0] + x + 2, o[1] + y - 1)], 'zm')


def charge(c, o):
    crow(c, o[0] + 12, o[1] - 26, 0, 'K', 'E')
    crow(c, o[0] - 12, o[1] - 28, 2, 'K', 'E')
    ring(c, o[0], o[1] - 14, 13, 12, 'hm', gap=4)


def raise_(c, o):
    for k, (x, y) in enumerate(((-12, -30), (-3, -36), (8, -32), (14, -24))):
        crow(c, o[0] + x, o[1] + y, k % 3, 'K', 'E')


def release(c, o):
    for k, (x, y) in enumerate(((-12, -20), (-17, -14), (-13, -8), (-18, -26))):
        crow(c, o[0] + x, o[1] + y, k % 3, 'K', 'E')
    speed(c, o[0] - 6, o[1] - 26, 'Ld', 2, 4)


def buff(c, o):
    rays(c, o[0] - 2, o[1] - 20, 11, 14, 10, 'E')
    for x in (-10, 10):
        c.at(0, 0)
        M5.flame(c, o[0] + x, o[1], 6, 0, ('X', 'E', 'zl'), None, 1.5)


def fin_back(c, o):
    for k in range(7):
        a = k * 2 * math.pi / 7
        crow(c, o[0] + math.cos(a) * 16, o[1] - 18 + math.sin(a) * 13, k % 3, 'K', 'E')


def fin_front(c, o):
    arc(c, o[0] + 1, o[1] - 16, 16, 150, 300, 'Ll', 2)
    arc(c, o[0] + 1, o[1] - 16, 13, 165, 285, 'Ld', 1)
    star(c, o[0] - 14, o[1] - 12, 3, 'Ll', 'E')


POSES = {
    'idle_a': {},
    'idle_b': {'P': {'ph': 0, 'crow': 2, 'scythe': (-6, -13, 3)}},
    'idle_c': {'P': {'ph': 2, 'crow': 0, 'scythe': (-6, -14, -3)}, 'lean': 1},
    'windup': {'P': {'scythe': (-2, -19, 40), 'crow': 0, 'hand': (-1, -19)}, 'dx': 3, 'lean': 2},
    'move': {'P': {'ph': 0, 'scythe': (-6, -15, -10), 'crow': 0}, 'dx': -1, 'dy': -3, 'lean': -2},
    'attack': {'P': {'scythe': (-5, -13, -72), 'scythe_back': False, 'crow': None}, 'dx': 3, 'lean': -3, 'front': swing},
    'recover': {'P': {'scythe': (-5, -14, -110), 'scythe_back': False, 'crow': 2}, 'dx': 2},
    'hit': {'P': {'scythe': (-4, -14, 25), 'eye': 'o', 'crow': None}, 'dx': 3, 'lean': 4, 'front': hit_fx},
    'dead': {'P': {'scythe': None, 'eye': 'o', 'crow': None, 'hand': (-4, -10)}, 'rot': 3, 'floor': True, 'front': straw_fall},
    'cast_charge': {'P': {'scythe': (-6, -14, 10), 'crow': None}, 'back': charge},
    'cast_raise': {'P': {'scythe': (-3, -20, 5), 'crow': None, 'hand': (-3, -20)}, 'dy': -1, 'back': raise_},
    'cast_release': {'P': {'scythe': (-6, -15, -50), 'scythe_back': False, 'crow': None}, 'dx': 2, 'lean': -2, 'front': release},
    'leap': {'P': {'scythe': (-4, -17, 25), 'crow': 0, 'ph': 2}, 'dy': -8},
    'buff': {'P': {'scythe': (-6, -12, -8), 'crow': 2, 'eye': 'zl'}, 'back': buff},
    'finisher': {'P': {'scythe': (-5, -20, -35), 'scythe_back': False, 'crow': None, 'hand': (-3, -18)}, 'dy': -1, 'back': fin_back, 'front': fin_front},
}

if __name__ == '__main__':
    build(5, POSES, hover=0)

