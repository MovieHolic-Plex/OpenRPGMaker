import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""미믹 이빨 난무 — 작은 이빨 턱이 대상 곳곳에서 네 번 딱딱 닫히고 금빛 물린 자국이 남는다. 64×10, target."""
KEY, SIZE, FRAMES = 'mimic_pal_gnash', 64, 10
PAL = ['1c100c', '8e5628', 'f4f0e2', 'ffffff', 'd8a830', 'f8e878', 'a02838', 'e0546c']
O, WM, T, W, G, GL, RD, RL = range(1, 9)
SPOTS = [(24, 26), (40, 36), (26, 42), (40, 22)]


def snap(c, x, y, k):
    g = [8, 3, 0][k]
    for s in (-1, 1):
        yy = y + s * (g // 2 + 1)
        c.poly([(x - 9, yy), (x + 9, yy), (x + 8, yy + s * 3), (x - 8, yy + s * 3)], WM)
        for j in range(5):
            xx = x - 8 + j * 4
            c.poly([(xx, yy), (xx + 2, yy), (xx + 1, yy - s * 3)], T)
    c.outline(O, [WM, T])
    if k == 2:
        c.star(x, y, 5, W, GL)


def draw(c, f, t):
    for i, (x, y) in enumerate(SPOTS):
        st = f - i * 2
        if 0 <= st < 3:
            snap(c, x, y, st)
        elif st >= 3:
            c.line([(x - 5, y - 1), (x + 5, y - 1)], RD)
            c.line([(x - 5, y + 1), (x + 5, y + 1)], RD)
            for j in range(3):
                c.px(x - 4 + j * 4, y, RL)
            if st < 6:
                c.px(x + (st - 3) * 3, y - 4 - st, GL)


run(globals())

