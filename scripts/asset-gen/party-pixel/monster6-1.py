"""monster6-1 인어 전사(class_merfolk, 원거리) 15칸 — 삼지창 투척·물살·조수. 셀 48, motion shoot."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
import pp15_nm6 as L
from pp15_nm6 import F

WAT = ('wat', 'scL', 'sc')


def drops(cv, m):
    L.dots(cv, -10, -4, 10, 0, 6, 'wat', seed=2)


def jet(cv, m):
    x, y = m['tip']
    L.beam(cv, x, y, x - 12, y + 1, 3, WAT)
    L.ball(cv, x - 13, y + 1, 2.4, WAT)
    L.dots(cv, x - 16, y - 4, x - 6, y + 5, 5, 'wat', seed=5)


def splash(cv, m):
    L.spark(cv, -7, -26, 2, 'wat', 'finD')
    L.dots(cv, -12, -28, -2, -18, 5, 'scL', seed=7)


def swirl(cv, m):
    x, y = m['tip']
    L.arc(cv, x, y, 4, 0, 250, 'wat')
    L.arc(cv, x, y, 6.5, 180, 60, 'scL')
    L.ball(cv, x, y, 1.6, WAT, ol=False)


def bubble_up(cv, m):
    L.ball(cv, 0, -36, 4.5, WAT)
    L.disc(cv, -2, -38, 1, 'eyeW')
    L.ring(cv, 0, -36, 7, 'scL')
    for a, b in ((-7, -30), (6, -29), (4, -44)):
        L.ring(cv, a, b, 1.6, 'wat')


def wave(cv, m):
    pts = [(-4, -2), (-6, -12), (-10, -18), (-16, -16), (-14, -12), (-18, -10), (-22, -4), (-26, -2)]
    cv.put(cv.P(pts + [(-26, 0), (-4, 0)]), ('wat', 'scL', 'sc'))
    L.dots(cv, -24, -20, -10, -14, 5, 'wat', seed=3)


def spear_fly(cv, m):
    x, y = m['hN'][0] - 12, m['hN'][1] - 2
    L.M.trident(cv, x, y, 90, up=7, down=6)
    L.speed(cv, x + 7, y, [5, 8, 5], 'scL', 2)


def leap_arc(cv, m):
    L.arc(cv, 4, -8, 10, 20, 120, 'wat')
    L.dots(cv, -2, -2, 12, 4, 6, 'wat', seed=8)


def buff_bubbles(cv, m):
    for a, b, r in ((-8, -26, 1.6), (8, -22, 2), (-9, -12, 1.3), (9, -8, 1.6), (0, -32, 1.3)):
        L.ring(cv, a, b, r, 'wat')
    L.arc(cv, 0, -14, 12, 180, 360, 'scL')


def tide_back(cv, m):
    cv.put(cv.P([(12, 0), (12, -26), (6, -34), (-2, -36), (-10, -32), (-4, -30), (2, -26), (4, -16), (2, 0)]), ('scL', 'sc', 'scD'))
    L.dots(cv, -12, -40, 12, -34, 8, 'wat', seed=11)


def tide_over(cv, m):
    x, y = m['tip']
    L.spark(cv, x, y, 3, 'wat', 'gold')
    for a, b in ((-8, -38), (8, -40), (-12, -24)):
        L.spark(cv, a, b, 1, 'wat')


FRAMES = [
    F(),
    F(bob=1, tail=1, aN=46),
    F(tail=-1, aN=54, head=-1),
    F(aN=160, weap=150, wup=10, lean=3, tail=1, over=drops),              # windup 창을 뒤로 치켜듦
    F(aN=100, weap=95, lean=-1, tail=-1, dx=-1),                          # move 겨누며 미끄러짐
    F(aN=95, weap=90, wup=12, lean=-3, mouth=1, over=jet),                # attack 창끝 물줄기
    F(aN=60, weap=150, lean=-1, tail=1),                                  # recover
    F(aN=20, weap=210, lean=4, eye=1, mouth=1, dx=2, over=splash),        # hit
    F(eye=1, mouth=1, aN=10, weap=100, rot='rot'),                        # dead
    F(aN=80, weap=180, wup=9, eye=2, crouch=1, over=swirl),               # cast_charge 창끝에 물 모음
    F(aN=170, weap=180, wup=11, head=-1, eye=2, mouth=1, back=bubble_up), # cast_raise
    F(aN=100, weap=90, lean=-2, eye=2, mouth=1, front=wave),              # cast_release 물살
    F(aN=150, weap=120, tail=1, dy=-8, lean=-2, over=leap_arc),           # leap 물에서 튀어 오름
    F(aN=175, weap=180, tail=-1, eye=2, mouth=1, over=buff_bubbles),      # buff 조수의 가호
    F(aN=172, weap=178, wup=12, tail=1, eye=2, mouth=1, back=tide_back, over=tide_over),  # finisher 해일 소환
]

if __name__ == '__main__':
    sys.exit(0 if L.build(1, 48, FRAMES) else 1)
