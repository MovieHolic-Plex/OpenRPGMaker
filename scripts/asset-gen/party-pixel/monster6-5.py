"""monster6-5 지니(class_djinn, 소환) 15칸 — 램프 연기 거인, 소원의 빛·모래 폭풍. 셀 64(거인), motion float."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
import pp15_nm6 as L
from pp15_nm6 import F

GOLD = ('gold', 'gold', 'goldD')
WIND = ('wind', 'windD', 'smD')


def fist_glow(cv, m):
    x, y = m['hN']
    L.ring(cv, x, y, 3.5, 'gold')


def gust(cv, m):
    x, y = m['hN']
    for d in (-3, 0, 3):
        L.line(cv, (x - 3, y + d), (x - 14, y + d * 1.5), 'wind')
    L.arc(cv, x - 14, y, 4, 90, 270, 'windD')


def hurt(cv, m):
    L.spark(cv, -8, -30, 3, 'eyeW', 'sash')
    L.dots(cv, 4, -20, 12, -8, 6, 'smL', seed=4)


def wish_charge(cv, m):
    x, y = m['hN']
    L.ball(cv, x - 1, y - 2, 2.2, GOLD)
    for a, b in ((-5, -5), (3, -7), (-6, 3)):
        L.spark(cv, x + a, y + b, 1, 'gold')


def wish_raise(cv, m):
    L.ball(cv, -1, -42, 4.5, ('eyeW', 'gold', 'goldD'))
    L.ring(cv, -1, -42, 7.5, 'gold')
    L.rays(cv, -1, -42, 9, 12, 8, 'eyeW')


def storm(cv, m):
    for i, (r, c) in enumerate(((5, 'wind'), (9, 'windD'), (13, 'wind'))):
        L.arc(cv, -18, -18 + i * 2, r, 200, 520 - 180, c)
    L.dots(cv, -28, -34, -8, -2, 10, 'gold', seed=7)


def rise(cv, m):
    L.dots(cv, -4, 0, 10, 4, 6, 'smL', seed=3)


def aura(cv, m):
    L.ring(cv, 0, -17, 16, 'smD', 1.4)
    L.rays(cv, 0, -17, 17, 21, 10, 'gold', 0.2)


def fin_back(cv, m):
    for r, c in ((22, 'windD'), (18, 'wind'), (14, 'windD')):
        L.arc(cv, 0, -20, r, 180, 420, c, 1.4)
    L.ball(cv, 0, -46, 5, ('eyeW', 'gold', 'goldD'))


def fin_over(cv, m):
    for a, b, n in ((-20, -46, 2), (20, -44, 2), (-24, -18, 2), (22, -14, 1), (0, -56, 2)):
        L.spark(cv, a, b, n, 'eyeW', 'gold')
    L.dots(cv, -28, -50, 28, 0, 16, 'gold', seed=21)


# 지니는 lamp=False 로 연기만 떠서 날아다니는 칸도 있다(move·attack·leap: 램프에서 몸을 크게 뽑아 늘인다).
FRAMES = [
    F(bob=-1),                         # idle_a = 칩 서 있는 칸(떠 있는 칩은 bob -1)
    F(bob=0, tail=1),
    F(bob=-1, tail=-1, head=-1),
    F(aN=150, aF=30, lean=3, bob=-1, mouth=1, over=fist_glow),
    F(aN=100, aF=40, lean=-3, bob=-1, tail=-1, dx=-2),
    F(aN=92, aF=0, lean=-4, mouth=1, tail=1, over=gust),
    F(aN=40, aF=10, bob=0, tail=1),
    F(aN=-30, aF=-40, lean=4, eye=1, mouth=1, dx=2, over=hurt),
    F(eye=1, rot='rot'),
    F(aN=60, aF=40, eye=2, over=wish_charge),
    F(aN=175, aF=170, bob=-2, eye=2, mouth=1, back=wish_raise),
    F(aN=100, aF=80, lean=-2, eye=2, mouth=1, over=storm),
    F(aN=160, aF=150, dy=-8, lamp=False, tail=1, over=rise),
    F(bob=-1, eye=2, mouth=1, back=aura),
    F(aN=178, aF=178, bob=-2, eye=2, mouth=1, back=fin_back, over=fin_over),
]

if __name__ == '__main__':
    sys.exit(0 if L.build(5, 64, FRAMES) else 1)
