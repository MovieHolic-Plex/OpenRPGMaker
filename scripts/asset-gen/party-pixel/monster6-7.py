"""monster6-7 타락 천사(class_dark_angel, 마법) 15칸 — 검은 깃털·금 간 후광·심판의 빛. 셀 48, 공중형(dead 만 바닥), motion float."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
import pp15_nm6 as L
from pp15_nm6 import F

LIGHT = ('light', 'halo', 'haloD')


def feathers(seed, n=5, x0=2, x1=16, y0=-30, y1=-6):
    def f(cv, m):
        import numpy as np
        rng = np.random.default_rng(seed)
        for _ in range(n):
            x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
            L.shard(cv, x, y, 1.8, rng.uniform(60, 150), ('wingL', 'wing', 'wingD'), ol=False)
    return f


def slash(cv, m):
    x, y = m['hN']
    L.arc(cv, x + 2, y + 2, 9, 150, 250, 'lightB')
    L.arc(cv, x + 2, y + 2, 7, 160, 240, 'light')


def hurt(cv, m):
    L.spark(cv, -6, -30, 2, 'light', 'eye')
    feathers(3, 4, 4, 14, -26, -10)(cv, m)


def hand_glow(cv, m):
    x, y = m['hN']
    L.ball(cv, x, y - 1, 1.8, LIGHT)
    L.ring(cv, x, y - 1, 4, 'lightB')


def halo_raise(cv, m):
    x, y = m['halo']
    L.ring(cv, x, y - 4, 6, 'halo')
    L.rays(cv, x, y - 4, 8, 11, 10, 'light')


def judgement(cv, m):
    x, y = m['hN']
    L.beam(cv, x, y, x - 18, y - 6, 3, LIGHT)
    L.ring(cv, x - 19, y - 6, 3.5, 'lightB')
    L.spark(cv, x, y, 2, 'light')


def leap_feath(cv, m):
    feathers(9, 5, -6, 10, -6, 4)(cv, m)


def dark_aura(cv, m):
    L.ring(cv, 0, -16, 15, 'robeL', 1.4)
    L.rays(cv, 0, -16, 16, 19, 8, 'lightB', 0.3)


def fin_back(cv, m):
    """뒤: 금 간 후광이 커져 검은 빛의 고리로."""
    x, y = m['halo']
    L.ring(cv, x, y - 2, 9, 'halo', 1.4)
    L.ring(cv, x, y - 2, 13, 'lightB', 1.2)
    L.rays(cv, x, y - 2, 14, 18, 12, 'light', 0.1)


def fin_over(cv, m):
    """앞: 들어 올린 손 위에서 적 쪽(왼쪽)으로 내리꽂히는 심판의 빛기둥."""
    x, y = m['hN']
    cv.put(cv.P([(-12, -44), (-7, -44), (-10, 0), (-19, 0)]), LIGHT)
    L.line(cv, (-10, -44), (-14, 0), 'light')
    L.ring(cv, -14, -2, 5, 'lightB')
    L.spark(cv, x, y, 2, 'light', 'halo')
    for a, b, n in ((-20, -34, 2), (14, -36, 2), (-22, -8, 1), (16, -6, 1)):
        L.spark(cv, a, b, n, 'light', 'halo')
    feathers(21, 7, -2, 18, -40, 2)(cv, m)


FRAMES = [
    F(),
    F(bob=-1, wing=-1),
    F(bob=1, wing=1, head=-1),
    F(aN=165, wing=-2, lean=3, eye=2),
    F(aN=80, wing=2, lean=-3, dx=-2, over=feathers(1)),
    F(aN=110, wing=1, lean=-3, over=slash),
    F(aN=40, wing=0, bob=1),
    F(aN=-30, wing=-2, lean=4, eye=1, dx=2, over=hurt),
    F(eye=1, rot='rot'),
    F(aN=60, wing=1, eye=2, over=hand_glow),
    F(aN=175, wing=-2, bob=-2, eye=2, over=halo_raise),
    F(aN=100, wing=2, lean=-2, eye=2, over=judgement),
    F(aN=150, wing=-2, dy=-8, over=leap_feath),
    F(aN=175, wing=2, eye=2, back=dark_aura, over=feathers(12, 6)),
    F(aN=178, wing=-2, bob=-2, eye=2, back=fin_back, over=fin_over),
]

if __name__ == '__main__':
    sys.exit(0 if L.build(7, 48, FRAMES) else 1)
