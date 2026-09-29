"""monster6-0 예티(class_yeti, 물리) 15칸 — 눈덩이 던지기·얼음 포효. 셀 64(큰 몸), motion stomp."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
import pp15_nm6 as L
from pp15_nm6 import F

SNOW = ('iceL', 'furL', 'fur')
ICE = ('iceL', 'ice', 'iceD')


def snowball(r=3.2, key='hN', dx=0, dy=-2):
    return lambda cv, m: L.ball(cv, m[key][0] + dx, m[key][1] + dy, r, SNOW)


def flying(cv, m):
    x, y = m['hN'][0] - 12, m['hN'][1]
    L.speed(cv, x + 4, y, [7, 10, 6], 'iceD')
    L.ball(cv, x, y, 3.2, SNOW)


def hitstar(cv, m):
    L.spark(cv, -7, -30, 3, 'iceL', 'mouth')
    L.xspark(cv, -11, -24, 2, 'ice')


def gather(cv, m):
    x, y = m['hN'][0] - 2, m['hN'][1] - 3
    L.ball(cv, x, y, 2.4, ICE)
    for (a, b) in ((-6, -4), (-3, -9), (2, -7), (-7, 3)):
        L.spark(cv, x + a, y + b, 1, 'iceL')


def raise_orb(cv, m):
    L.ball(cv, 0, -40, 5.5, ICE)
    L.disc(cv, -2, -42, 1.5, 'iceL')
    L.ring(cv, 0, -40, 8.5, 'ice')
    for (a, b) in ((-9, -48), (9, -46), (-10, -33), (8, -32)):
        L.spark(cv, a, b, 1, 'iceL')


def roar_shards(cv, m):
    x, y = m['mouth']
    L.cone(cv, x - 2, y, 12, 5, ('iceL', 'ice', 'iceD'))
    for (a, b, s) in ((-18, -4, 3), (-20, 4, 2.5), (-24, 0, 3.5), (-16, 7, 2)):
        L.shard(cv, x + a, y + b, s, 180, ICE)


def leap_trail(cv, m):
    L.dots(cv, -6, -4, 8, 4, 10, 'iceL', seed=4)


def roar_rays(cv, m):
    x, y = m['mouth']
    for r in (8, 13):
        L.arc(cv, x, y, r, 120, 240, 'iceL')
    L.arc(cv, x, y, 18, 135, 225, 'ice')


def buff_back(cv, m):
    L.ring(cv, 0, -13, 16, 'iceD', 1.5)
    L.rays(cv, 0, -14, 17, 21, 10, 'ice', 0.3)


def fin_back(cv, m):
    L.ring(cv, 0, -44, 14, 'iceD', 1.5)
    L.rays(cv, 0, -44, 15, 20, 12, 'ice')


def fin_front(cv, m):
    L.ball(cv, 0, -44, 10, ICE)
    L.ball(cv, -3, -47, 3.5, ('iceL', 'iceL', 'ice'), ol=False)
    for (a, b) in ((-5, -38), (4, -40), (3, -50)):
        cv.px([(a, b), (a + 1, b)], 'iceD')


def fin_over(cv, m):
    for (a, b, n) in ((-16, -58, 2), (15, -56, 2), (-19, -34, 1), (17, -30, 1), (0, -62, 1)):
        L.spark(cv, a, b, n, 'iceL', 'ice')
    L.dots(cv, -24, -8, 24, 0, 14, 'iceL', seed=9)


FRAMES = [
    F(),                                                        # idle_a = 칩 왼쪽 서 있는 칸
    F(bob=1, aN=14, aF=6),                                      # idle_b 숨 내쉼
    F(aN=6, aF=14, head=-1),                                    # idle_c
    F(aN=155, aF=-20, lean=3, crouch=1, mouth=1, front=snowball()),                    # windup 눈덩이 뒤로
    F(step=-1, aN=120, aF=30, lean=-2, front=snowball()),                            # move 쿵쿵 전진
    F(aN=95, aF=-30, lean=-3, mouth=2, over=flying),                                 # attack 던짐
    F(aN=30, aF=0, lean=-1, crouch=1),                                               # recover
    F(aN=-40, aF=-50, lean=3, eye=1, mouth=1, dx=2, over=hitstar),                   # hit
    F(eye=1, rot='rot', mouth=1),                                                    # dead
    F(aN=70, aF=65, crouch=1, eye=2, over=gather),                                   # cast_charge 냉기 모으기
    F(aN=172, aF=168, head=-1, eye=2, mouth=1, back=raise_orb),                      # cast_raise
    F(aN=105, aF=90, lean=-2, mouth=3, eye=2, front=roar_shards),                    # cast_release 얼음 포효
    F(step=1, aN=165, aF=150, dy=-9, lean=-1, over=leap_trail),                      # leap
    F(aN=55, aF=55, mouth=3, head=-1, back=buff_back, over=roar_rays),               # buff 가슴 치며 포효
    F(aN=178, aF=176, mouth=2, eye=2, crouch=1, back=fin_back, front=fin_front, over=fin_over),  # finisher 거대 눈덩이
]

if __name__ == '__main__':
    sys.exit(0 if L.build(0, 64, FRAMES) else 1)
