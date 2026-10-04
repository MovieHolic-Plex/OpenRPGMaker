import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""촛불 임프 녹이기 — 대상 둘레에 뜨거운 열기 고리가 조여 오며 주황 아지랑이가 오르고, 갑옷 조각이 녹아 흘러내린다. 64×10, target."""
KEY, SIZE, FRAMES = 'candle_imp_melt', 64, 10
PAL = ['4a1010', 'a02010', 'e04010', 'f89020', 'fff060', 'ffffff', '8c94a4', 'dce2ee']
O, FX, FD, FM, FL, W, SM, SL = range(1, 9)


def draw(c, f, t):
    r = max(26 - f * 2.4, 8)
    c.ring(32, 36, r, r * .7, FD, 2, gap=0)
    c.ring(32, 36, r - 3, (r - 3) * .7, FM, 1, gap=6, phase=f * .6)
    for k in range(5):
        x = 16 + k * 8
        y0 = 50 - (f * 3 + k * 5) % 24
        wob = 1 if (f + k) % 2 else -1
        c.line([(x, y0), (x + wob, y0 - 4), (x, y0 - 8)], FM if k % 2 else FL)
    if f >= 3:
        for k, (x, y) in enumerate(((24, 26), (40, 30), (32, 20))):
            drip = min((f - 3) * 2.5, 16)
            c.rect(x - 3, y, x + 3, y + 2, SM)
            c.line([(x - 3, y), (x + 3, y)], SL)
            c.rect(x - 1, y + 2, x, y + 2 + drip, FM if f > 6 else SM)
            c.ell(x - .5, y + 3 + drip, 1.6, 1.4, FL if f > 6 else SL)
    if f >= 7:
        c.star(32, 36, 5 + (f - 7), W, FL)


run(globals())

