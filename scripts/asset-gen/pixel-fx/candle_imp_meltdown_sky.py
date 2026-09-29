import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""촛불 임프 대촛농 붕괴(필살기 배경) — 거대한 초가 불기둥을 뿜다 녹아 무너지고, 흰 촛농 파도가 무대 바닥을 덮친다. 128×12, screen."""
KEY, SIZE, FRAMES = 'candle_imp_meltdown_sky', 128, 12
PAL = ['120806', '2a1008', '5a2010', 'c0a078', 'f0dfbc', 'fffcf0', '4a1010', 'e04010', 'f89020', 'fff060', 'ffffff']
N0, O, N1, XD, XM, XL, FX, FD, FM, FL, W = range(1, 12)


def draw(c, f, t):
    c.ell(64, 64, 62, 60, N0)
    c.ell(64, 70, 50, 44, N1)
    melt = max(f - 5, 0) / 6
    top = 40 + melt * 40
    w = 16 + melt * 20
    c.poly([(64 - w, 110), (64 - 16, top), (64 + 16, top), (64 + w, 110)], XM)
    c.line([(64 - 12, top + 2), (64 - w + 4, 106)], XL, 2)
    for k in range(4):
        x = 50 + k * 9
        c.rect(x, top, x + 3, top + 10 + ((k * 7 + f * 3) % 18), XM)
        c.ell(x + 1.5, top + 11 + ((k * 7 + f * 3) % 18), 2.5, 2.5, XM)
    c.outline(O, [XM, XL])
    fh = [24, 36, 50, 60, 64, 60, 46, 34, 24, 16, 10, 6][f]
    c.flame(64, top, fh, 10 + fh * .12, (FD, FM, FL), sway=(f % 3 - 1) * 3)
    c.flame(64, top, fh * .5, 4, (FM, FL, W))
    if f >= 6:
        wave = (f - 6) * 10
        c.poly([(0, 118), (0, 106 - wave * .3), (20 + wave, 98 - wave * .2), (64, 104), (108 - wave, 98 - wave * .2), (128, 106 - wave * .3), (128, 118)], XM)
        c.line([(0, 106 - wave * .3), (20 + wave, 98 - wave * .2)], XL)
        c.line([(128, 106 - wave * .3), (108 - wave, 98 - wave * .2)], XL)
    for k in range(8):
        x = 20 + k * 12
        y = 90 - ((f * 11 + k * 17) % 70)
        c.px(x, y, FL if k % 2 else FM)
        c.px(x + 1, y + 1, FD)
    if f == 4:
        c.star(64, top - 30, 12, W, FL)


run(globals())

