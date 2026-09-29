import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""촛불 임프 불씨(투사체) — 촛농 방울을 감싼 작은 불씨가 왼쪽으로 날아가며 불티를 흘린다. 32×4 루프, projectile(첫 칸 왼쪽)."""
KEY, SIZE, FRAMES = 'candle_imp_ember', 32, 4
PAL = ['4a1010', 'e04010', 'f89020', 'fff060', 'ffffff', 'f0dfbc']
O, FD, FM, FL, W, X = range(1, 7)


def draw(c, f, t):
    wob = [0, 1, 0, -1][f]
    c.poly([(10, 12), (20, 13 + wob), (27, 16), (20, 19 - wob), (10, 20)], FD)
    c.poly([(11, 14), (21, 15), (23, 16), (21, 17), (11, 18)], FM)
    c.ell(10, 16, 5, 4.6, FD)
    c.ell(9.5, 16, 3.5, 3.2, FM)
    c.ell(9, 16, 2, 1.8, FL)
    c.px(8, 16, W)
    c.px(13, 20, X)
    c.outline(O, [FD])
    c.px(24 + f, 11 + (f * 3) % 8, FL)
    c.px(28 - f, 21 - f, FM)


run(globals())

