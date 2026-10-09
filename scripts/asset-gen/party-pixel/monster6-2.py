"""monster6-2 사이클롭스(class_cyclops, 물리) 15칸 — 바위 던지기·외눈 광선. 셀 64(거인), motion stomp."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
import pp15_nm6 as L
from pp15_nm6 import F

ROCK = ('rock', 'rock', 'rockD')
GLOW = ('glowL', 'glow', 'iris')


def rock_hand(r=4.5, key='hN'):
    def f(cv, m):
        x, y = m[key]
        cv.put(cv.D(x, y - 3, r) | cv.D(x + 2, y - 5, r * 0.7), ROCK)
        cv.px([(x - 1, y - 4), (x + 1, y - 2)], 'rockD'); cv.px([(x - 2, y - 6)], 'horn')
    return f


def rock_fly(cv, m):
    x, y = m['hN'][0] - 14, m['hN'][1] - 4
    cv.put(cv.D(x, y, 4.5) | cv.D(x + 2, y - 2, 3), ROCK)
    cv.px([(x - 1, y - 1), (x + 1, y + 1)], 'rockD')
    L.speed(cv, x + 6, y, [6, 9, 6], 'skL', 2.5)


def dust(cv, m):
    for a in (-10, -5, 6, 10):
        L.puff(cv, a, -1, 1.8, ('horn', 'skL', 'skD'), ol=False)


def hurt(cv, m):
    L.spark(cv, -9, -30, 3, 'glowL', 'iris')
    L.xspark(cv, -13, -24, 2, 'glow')


def eye_charge(cv, m):
    x, y = m['eye']
    L.ring(cv, x, y, 5, 'glow')
    L.rays(cv, x, y, 7, 10, 8, 'glowL')


def eye_raise(cv, m):
    x, y = m['eye']
    L.ring(cv, x, y, 4, 'glowL')
    L.ring(cv, x, y, 8, 'glow')
    L.rays(cv, x, y, 10, 14, 12, 'glowL', 0.2)


def eye_beam(cv, m):
    x, y = m['eye']
    L.beam(cv, x - 1, y, x - 30, y + 4, 4, GLOW)
    L.beam(cv, x - 1, y, x - 30, y + 4, 1.5, ('glowL', 'glowL', 'glowL'), ol=False)
    L.spark(cv, x - 1, y, 3, 'glowL')


def quake(cv, m):
    for a, b in ((-18, 0), (16, 0)):
        cv.put(cv.P([(a - 3, 0), (a - 1, -5), (a + 1, -3), (a + 3, 0)]), ROCK)
    L.dots(cv, -24, -10, 24, -4, 8, 'rock', seed=6)


def flex(cv, m):
    L.rays(cv, 0, -16, 18, 22, 10, 'glow', 0.15)
    for a, b in ((-12, -30), (12, -28)):
        L.spark(cv, a, b, 2, 'glowL')


def boulder_back(cv, m):
    cv.put(cv.D(0, -40, 11) | cv.D(-6, -45, 6) | cv.D(7, -44, 6), ROCK)
    cv.px([(-4, -38), (3, -42), (6, -36), (-6, -45), (0, -47)], 'rockD')
    cv.px([(-7, -48), (-3, -44), (5, -49)], 'horn')


def fin_over(cv, m):
    x, y = m['eye']
    L.ring(cv, x, y, 4, 'glowL')
    L.rays(cv, x, y, 6, 10, 8, 'glow')
    for a, b in ((-16, -54), (16, -52), (-14, -30), (15, -26)):
        L.spark(cv, a, b, 2, 'glowL', 'glow')
    L.dots(cv, -26, -6, 26, 0, 12, 'rock', seed=12)


FRAMES = [
    F(),
    F(bob=1, aN=12, aF=4),
    F(aN=4, aF=12, head=-1),
    F(aN=165, aF=-10, lean=4, crouch=1, mouth=1, front=rock_hand()),
    F(step=-1, aN=140, aF=20, lean=-2, front=rock_hand(), over=dust),
    F(aN=90, aF=-30, lean=-4, mouth=2, over=rock_fly),
    F(aN=35, aF=5, lean=-1, crouch=1),
    F(aN=-30, aF=-45, lean=4, eye=1, mouth=1, dx=2, over=hurt),
    F(eye=1, mouth=1, rot='rot'),
    F(aN=40, aF=30, crouch=1, eye=2, over=eye_charge),
    F(aN=150, aF=150, head=-1, eye=2, lean=2, over=eye_raise),
    F(aN=20, aF=10, lean=-3, eye=2, mouth=1, over=eye_beam),
    F(step=1, aN=170, aF=160, dy=-8, over=dust),
    F(aN=150, aF=150, crouch=1, mouth=2, back=flex, over=quake),
    F(aN=178, aF=176, eye=2, mouth=2, crouch=1, back=boulder_back, over=fin_over),
]

if __name__ == '__main__':
    sys.exit(0 if L.build(2, 64, FRAMES) else 1)
