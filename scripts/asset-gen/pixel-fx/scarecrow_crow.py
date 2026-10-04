import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""허수아비 까마귀(투사체) — 주황 눈 까마귀가 날갯짓하며 왼쪽으로 날아간다. 32×4 루프, projectile(첫 칸 왼쪽)."""
KEY, SIZE, FRAMES = 'scarecrow_crow', 32, 4
PAL = ['0e0c14', '26242e', '4a4858', 'ff8020', 'f8c040']
O, K, KL, E, BK = range(1, 6)


def draw(c, f, t):
    wy = [-7, -3, 4, 0][f]
    c.ell(16, 17, 6, 3, K)
    c.ell(10, 15, 3, 2.6, K)
    c.poly([(6, 15), (3, 16), (6, 17)], BK)
    c.poly([(21, 16), (27, 13 + f % 2), (27, 20 - f % 2), (21, 18)], K)
    c.poly([(13, 16), (17, 16 + wy), (22, 15 + wy * .8), (19, 17)], KL)
    c.line([(13, 16), (21, 15 + wy * .8)], K)
    c.outline(O, [K, KL])
    c.px(9, 14, E)


run(globals())

