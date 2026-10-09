import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""저주 인형 인형극의 막(필살기 배경) — 붉은 무대 휘장이 걷히고 하늘의 거대한 조종대에서 실이 적진으로 내려꽂혀 저주 표식이 켜진다. 128×12, screen."""
KEY, SIZE, FRAMES = 'doll_theater_sky', 128, 12
PAL = ['100812', '2a0c1a', '5a1022', '9a2034', 'd05a6a', '7a5230', 'a87848', 'ece4f4', 'd8ad50', 'ffffff', 'e2c2aa', '1a0e16']
N0, N1, DD, DM, DL, WD, WL, S, GOLD, W, CM, O = range(1, 13)


def draw(c, f, t):
    c.ell(64, 64, 62, 60, N0)
    c.ell(64, 72, 50, 40, N1)
    open_ = min(f / 4, 1)
    for s in (-1, 1):
        edge = 64 + s * (4 + 50 * open_)
        x0 = 0 if s < 0 else 128
        c.poly([(x0, 0), (edge, 0), (edge - s * 6, 60), (edge + s * 4, 128), (x0, 128)], DM)
        for k in range(4):
            xx = x0 + (edge - x0) * (k + 1) / 5
            c.line([(xx, 0), (xx - s * 2, 128)], DD)
    c.rect(0, 0, 128, 12, DD)
    for x in range(4, 128, 12):
        c.ell(x + 6, 12, 6, 5, DM)
    c.line([(0, 16), (128, 16)], GOLD)
    if f >= 3:
        y = 22 + min(f - 3, 2) * 2
        c.rect(24, y, 104, y + 4, WD)
        c.line([(24, y), (104, y)], WL)
        c.rect(61, y - 8, 67, y + 12, WD)
        c.outline(O, [WD, WL])
        drop = min((f - 3) / 4, 1)
        for i in range(6):
            x = 28 + i * 14
            c.line([(x, y + 5), (x + (i - 2.5) * 2, y + 5 + 70 * drop)], S)
        if f >= 7:
            for i in range(6):
                x = 28 + i * 14 + (i - 2.5) * 2
                yy = y + 75
                c.ring(x, yy, 5, 5, DL, 1, gap=4, phase=f)
                c.line([(x - 3, yy - 3), (x + 3, yy + 3)], DL)
                c.line([(x + 3, yy - 3), (x - 3, yy + 3)], DL)
                if f >= 9:
                    c.star(x, yy, 3 + (f - 9), W, DL)
    if f == 11:
        c.ring(64, 90, 50, 14, DL, 2, gap=12)


run(globals())

