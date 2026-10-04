"""monster5-0 미믹(파티원) — 48 셀. 걷기 칩: 금테 두른 나무 보물상자, 뚜껑 틈의 이빨·노란 눈, 분홍 혀, 짧은 나무 다리.
대기 = 뚜껑을 들썩이며 혀 날름 · windup 뚜껑을 활짝 · attack 뛰어들어 콱 문다 · 시전 = 입속 금화를 모아 뱉는다 · finisher 통째로 삼키는 거대한 입.
왼쪽을 본다(hop)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_nm5 import *  # noqa


def coins(pts, k='gm', k2='gl'):
    def f(c, o):
        for x, y in pts:
            c.at(0, 0)
            c.ell(x, y, 1.6, 1.6, (k, k, k), out='o', shade=False)
            c.px(x - .5, y - .5, k2)
    return f


def bite_fx(c, o):
    x, y = o[0] - 12, o[1] - 12
    arc(c, x + 2, y, 7, 150, 250, 'T', 1)
    arc(c, x + 2, y + 2, 7, 110, 210, 'T', 1)
    spark(c, x - 4, y - 4, 'E')
    spark(c, x - 5, y + 5, 'gl')


def dust(c, o):
    for k, (x, y) in enumerate(((o[0] + 10, o[1] - 1), (o[0] + 14, o[1] - 2))):
        puff(c, x, y, 2 - k * .5, ('wd', 'wm', 'wl'))


def hit_fx(c, o):
    spark(c, o[0] - 10, o[1] - 16, 'gl', True)
    dot(c, o[0] - 12, o[1] - 10, 'E')
    dot(c, o[0] - 8, o[1] - 20, 'E')


def charge(c, o):
    ring(c, o[0], o[1] - 12, 13, 9, 'gd', gap=3)
    coins([(o[0] - 12, o[1] - 20), (o[0] + 11, o[1] - 22)])(c, o)


def raise_(c, o):
    rays(c, o[0] - 1, o[1] - 18, 8, 12, 8, 'gm')
    coins([(o[0] - 4, o[1] - 26), (o[0] + 3, o[1] - 29), (o[0] - 9, o[1] - 22)])(c, o)


def release(c, o):
    coins([(o[0] - 14, o[1] - 13), (o[0] - 18, o[1] - 9), (o[0] - 17, o[1] - 18)])(c, o)
    speed(c, o[0] - 12, o[1] - 21, 'gl', 3, 4)


def buff(c, o):
    for x in (-13, -9, 9, 13):
        c.at(0, 0)
        c.line([(o[0] + x, o[1] - 4), (o[0] + x, o[1] - 10 - abs(x) // 3)], 'gl')
    star(c, o[0] - 9, o[1] - 22, 3, 'gl', 'E')
    star(c, o[0] + 10, o[1] - 20, 2, 'gm')


def fin_back(c, o):
    c.at(0, 0)
    c.ell(o[0] - 6, o[1] - 16, 15, 14, 'M', out='td', shade=False)
    for k in range(7):
        x = o[0] - 18 + k * 4
        c.poly([(x, o[1] - 29), (x + 2, o[1] - 29), (x + 1, o[1] - 25)], 'T', out='o', shade=False)
        c.poly([(x + 1, o[1] - 3), (x + 3, o[1] - 3), (x + 2, o[1] - 7)], 'T', out='o', shade=False)


def fin_front(c, o):
    star(c, o[0] - 16, o[1] - 20, 3, 'E', 'gl')
    star(c, o[0] - 13, o[1] - 9, 2, 'gl')


POSES = {
    'idle_a': {},
    'idle_b': {'P': {'lid': .42, 'tongue': -1}, 'dy': 0},
    'idle_c': {'P': {'lid': .22, 'tongue': 1, 'lift': 1}},
    'windup': {'P': {'lid': 1.0, 'tongue': 2}, 'dx': 3, 'lean': 2},
    'move': {'P': {'lid': .5, 'step': -1, 'lift': 2, 'tongue': -2}, 'dx': -4, 'dy': -2, 'back': dust},
    'attack': {'P': {'lid': 1.25, 'tongue': -4}, 'dx': -3, 'lean': -3, 'front': bite_fx},
    'recover': {'P': {'lid': .55, 'tongue': 0, 'step': 1}, 'dx': -2},
    'hit': {'P': {'lid': .08, 'tongue': None}, 'dx': 3, 'lean': 3, 'front': hit_fx},
    'dead': {'P': {'lid': .7, 'tongue': 3}, 'rot': 3, 'floor': True},
    'cast_charge': {'P': {'lid': .7, 'tongue': 0}, 'back': charge},
    'cast_raise': {'P': {'lid': 1.1, 'tongue': 1, 'lift': 2}, 'dy': -2, 'back': raise_},
    'cast_release': {'P': {'lid': 1.3, 'tongue': -3}, 'dx': -2, 'lean': -2, 'front': release},
    'leap': {'P': {'lid': .8, 'tongue': -2, 'lift': 3, 'step': 1}, 'dy': -9, 'dx': -1},
    'buff': {'P': {'lid': .15, 'tongue': None}, 'back': buff},
    'finisher': {'P': {'lid': 1.55, 'tongue': -4}, 'dx': 2, 'back': fin_back, 'front': fin_front},
}

if __name__ == '__main__':
    build(0, POSES, hover=0)

