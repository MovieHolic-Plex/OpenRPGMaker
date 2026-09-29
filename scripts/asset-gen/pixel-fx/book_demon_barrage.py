import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""마도서 주문 난사 — 적 위로 불·얼음·번개·룬 네 색 주문 탄이 번갈아 쏟아져 터진다. 64×10, allTargets."""
KEY, SIZE, FRAMES = 'book_demon_barrage', 64, 10
PAL = ['140c1c', 'f06a20', 'ffb840', '66b8e8', 'f2ffff', 'f8f040', 'fffcc0', '60f0e0', 'a058c8', 'ffffff']
O, FD, FL, ID, IL, YD, YL, C, V, W = range(1, 11)
SPOTS = [(22, 22, (FD, FL)), (42, 30, (ID, IL)), (28, 42, (YD, YL)), (44, 16, (C, W)), (18, 36, (V, W)), (38, 46, (FD, FL))]


def draw(c, f, t):
    for i, (x, y, (d, l)) in enumerate(SPOTS):
        s = f - i * 1.2
        if s < 0:
            continue
        s = int(s)
        if s == 0:
            c.line([(x + 10, y - 12), (x + 2, y - 2)], l)
            c.ell(x + 2, y - 2, 2.5, 2.5, d)
        elif s <= 3:
            r = s * 3
            c.ell(x, y, r + 1, r + 1, d)
            c.ell(x, y, max(r - 1.5, 1), max(r - 1.5, 1), l)
            c.star(x, y, r + 3, l)
            c.outline(O, [d])
        elif s == 4:
            c.ring(x, y, 9, 9, d, 1, gap=4)
    if f >= 8:
        c.star(32, 32, 9 - (f - 8) * 3, W, YL)


run(globals())

