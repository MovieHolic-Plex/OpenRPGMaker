import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""초롱 귀신 도깨비불(투사체) — 왼쪽으로 날아가는 푸른 도깨비불, 꼬리는 오른쪽으로 일렁인다. 32×4 루프, projectile(첫 칸 왼쪽)."""
KEY, SIZE, FRAMES = 'lantern_ghost_wisp', 32, 4
PAL = ['0c2050', '2058c0', '48a8f0', 'a8e4ff', 'eafcff']
D0, D1, M, L, W = range(1, 6)


def draw(c, f, t):
    wob = [0, 1, 0, -1][f]
    c.poly([(9, 12 + wob), (22, 13), (29, 16 - wob), (22, 19), (9, 20 + wob)], D1)
    c.poly([(12, 14), (24, 15 + wob), (26, 16), (24, 17), (12, 18)], M)
    c.ell(11, 16, 6, 5.5, D1)
    c.ell(10, 16, 4.5, 4, M)
    c.ell(9, 15.5, 2.5, 2.2, L)
    c.px(8, 15, W)
    c.outline(D0)
    c.px(26 + f, 11 + f * 3 % 10, L)
    c.px(10 + [0, 1, 0, -1][f], 13, W)


run(globals())

