import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""초롱 귀신 외눈 응시 — 대상 위에 커다란 외눈이 떠 눈을 뜨고, 동공이 조이며 얼어붙는 푸른 파문을 보낸다. 64×10, target."""
KEY, SIZE, FRAMES = 'lantern_ghost_eye', 64, 10
PAL = ['22120a', 'fffff4', 'd8d0b8', '801020', '2058c0', '48a8f0', 'a8e4ff', 'f0b450']
O, W, WS, VEIN, D1, M, L, AMB = range(1, 9)


def draw(c, f, t):
    open_ = [1, 4, 8, 11, 11, 11, 11, 10, 6, 2][f]
    c.ell(32, 30, 17, open_ + 1, O)
    c.ell(32, 30, 16, open_, W)
    if open_ > 4:
        c.ell(34, 32, 13, open_ - 2, WS) if f > 5 else None
        c.line([(18, 28), (22, 30), (21, 33)], VEIN)
        c.line([(46, 27), (42, 30)], VEIN)
        pr = [0, 0, 7, 6, 4, 3, 3, 4, 3, 0][f]
        c.ell(32, 30, pr + 1.5, min(pr + 1.5, open_), AMB)
        c.ell(32, 30, pr * .5, min(pr, open_ - 1), O)
        c.px(30, 27, W)
    else:
        c.line([(16, 30), (48, 30)], O)
    if 4 <= f <= 8:
        for k in range(2):
            r = (f - 4) * 5 + k * 6
            if r < 28:
                c.ring(32, 30, r + 18, (r + 18) * .6, M if k == 0 else D1, 1, gap=7, phase=f)
    if f >= 6:
        for x in (20, 44):
            c.poly([(x, 44 + (f - 6)), (x + 2, 48 + (f - 6)), (x, 52 + (f - 6)), (x - 2, 48 + (f - 6))], L)


run(globals())

