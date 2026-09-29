import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""촛불 임프 뜨거운 촛농 — 대상 위로 흰 촛농이 쏟아져 흘러내리고, 김을 내며 굳는다. 64×10, target."""
KEY, SIZE, FRAMES = 'candle_imp_wax', 64, 10
PAL = ['2a1008', 'c0a078', 'f0dfbc', 'fffcf0', 'e04010', 'f89020', 'fff060', 'd8d8e0']
O, XD, XM, XL, FD, FM, FL, ST = range(1, 9)


def draw(c, f, t):
    if f <= 2:
        for k in range(3):
            x = 22 + k * 10
            y = 6 + f * 8 + k * 2
            c.ell(x, y, 3, 4, XM)
            c.px(x - 1, y - 2, XL)
            c.outline(O, [XM, XL])
        return
    h = min((f - 2) * 7, 38)
    c.ell(32, 14, 16, 5, XM)
    for k, x in enumerate((20, 26, 32, 38, 44)):
        dl = h * (0.6 + 0.4 * ((k * 3) % 5) / 4)
        c.rect(x - 2, 14, x + 2, 14 + dl, XM)
        c.ell(x, 14 + dl, 2.8, 2.6, XM)
        c.line([(x - 1, 14), (x - 1, 12 + dl)], XL)
    c.outline(O if f < 7 else XD, [XM, XL])
    if f >= 6:
        c.ell(32, 54, 16 + (f - 6) * 2, 3, XD)
        c.ell(32, 53, 14 + (f - 6) * 2, 2, XM)
    if f >= 5:
        for k in range(3):
            x = 22 + k * 10 + (f % 2)
            y = 10 - (f - 5) * 2
            c.line([(x, y), (x + 1, y - 3), (x, y - 5)], ST)
    if f in (3, 4):
        c.flame(32, 14, 6, 3, (FD, FM, FL))


run(globals())

