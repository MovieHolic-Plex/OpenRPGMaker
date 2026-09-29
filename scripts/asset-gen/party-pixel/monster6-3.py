"""monster6-3 나방 인간(class_mothman, 마법) 15칸 — 날개 인분·환각의 눈빛. 셀 48, 공중형(dead 만 바닥), motion float."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
import pp15_nm6 as L
from pp15_nm6 import F

DUST = ('dust', 'dustP', 'dustD')


def scales(n, seed, x0=-14, x1=10, y0=-30, y1=-6):
    def f(cv, m):
        L.dots(cv, x0, y0, x1, y1, n, 'dust', seed=seed)
        L.dots(cv, x0, y0, x1, y1, n // 2, 'dustP', seed=seed + 50)
    return f


def claw(cv, m):
    x, y = m['hN']
    for d in (-2, 0, 2):
        L.line(cv, (x - 2, y - 4 + d), (x - 8, y - 1 + d), 'dust')


def hurt(cv, m):
    L.spark(cv, -6, -30, 2, 'eyeL', 'eyeR')
    L.dots(cv, 4, -24, 12, -14, 5, 'wing', seed=4)


def eye_glow(cv, m):
    x, y = m['eye']
    L.ring(cv, x, y, 3.5, 'eyeR')
    L.ring(cv, x, y, 6, 'dustP')


def orb(cv, m):
    L.ball(cv, 0, -38, 4, DUST)
    L.ring(cv, 0, -38, 6.5, 'dustP')
    for a in range(0, 360, 60):
        import math
        L.spark(cv, 9 * math.cos(math.radians(a)), -38 + 8 * math.sin(math.radians(a)), 1, 'dust')


def hallu(cv, m):
    x, y = m['eye']
    for i, r in enumerate((6, 10, 14)):
        L.arc(cv, x - 2, y, r, 140, 220, ('dust', 'dustP', 'dustD')[i])
    L.dots(cv, x - 22, y - 8, x - 6, y + 8, 8, 'dustP', seed=21)


def rise(cv, m):
    for a in (-6, 0, 6):
        L.line(cv, (a, 2), (a, 6), 'dustD')


def buff_ring(cv, m):
    L.ring(cv, 0, -17, 15, 'dustD', 1.4)
    L.rays(cv, 0, -17, 16, 19, 8, 'dust')


def fin_back(cv, m):
    cv.put(cv.D(0, -18, 17) & ~cv.D(0, -18, 14), ('dustP', 'dustP', 'dustD'), ol=False)
    L.rays(cv, 0, -18, 17, 21, 14, 'dust', 0.1)


def fin_over(cv, m):
    for a, b, n in ((-14, -34, 2), (13, -36, 2), (-16, -6, 1), (15, -4, 1), (0, -40, 1)):
        L.spark(cv, a, b, n, 'dust', 'dustP')
    L.dots(cv, -20, -40, 20, 4, 18, 'dust', seed=31)
    L.dots(cv, -20, -40, 20, 4, 10, 'dustP', seed=32)


FRAMES = [
    F(bob=-1),                         # idle_a = 칩 서 있는 칸(떠 있는 칩은 bob -1)
    F(bob=0, wing=1, aN=34),
    F(bob=-1, wing=-1, aN=26),
    F(wing=-2, aN=150, lean=3, eye=2, over=scales(4, 1, 0, 14, -34, -16)),
    F(wing=1, aN=80, lean=-3, dx=-2, over=scales(4, 2, 4, 16, -20, -4)),
    F(wing=2, aN=95, lean=-3, over=claw),
    F(wing=0, aN=45, bob=1),
    F(wing=-2, aN=-20, lean=4, eye=1, dx=2, over=hurt),
    F(eye=1, aN=10, rot='rot', dy=0),
    F(wing=-1, aN=60, crouch=0, eye=2, over=eye_glow),
    F(wing=-2, aN=175, bob=-2, eye=2, back=orb),
    F(wing=2, aN=100, lean=-2, eye=2, over=hallu),
    F(wing=-2, aN=150, dy=-8, over=rise),
    F(wing=2, aN=160, eye=2, back=buff_ring, over=scales(6, 7)),
    F(wing=-2, aN=178, bob=-2, eye=2, back=fin_back, over=fin_over),
]

if __name__ == '__main__':
    sys.exit(0 if L.build(3, 48, FRAMES) else 1)
