"""지니 소원의 빛 allAllies 64x10 — 금빛 램프 연기가 아군 위로 말려 올라 별이 되어 떨어지며 몸을 감싼다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(30, 24, 62), (255, 255, 224), (255, 222, 92), (198, 138, 40), (226, 218, 255), (172, 152, 232), (112, 90, 182), (196, 255, 238)]
OL, W, G, GD, SL, SM, SD, WI = 1, 2, 3, 4, 5, 6, 7, 8


def draw(c, f, t):
    cx = 32
    for k in range(40):
        u = k / 39
        if u > t * 1.4:
            break
        a = u * 9 + f * .3
        x = cx + math.cos(a) * (14 - u * 8)
        y = 56 - u * 44
        c.fill(c.disc(x, y, 2.4 - u), (SL, SM, SD)[k % 3])
    if f >= 4:
        g = (f - 3)
        for k in range(6):
            a = k * 1.047 + f * .4
            x, y = cx + math.cos(a) * (6 + g * 2), 14 + g * 5 + math.sin(a) * 3
            if y < 58:
                c.star(x, y, 2 if k % 2 else 1, G, W)
    if f >= 6:
        m = c.ell(cx, 40, 16, 20) & ~c.ell(cx, 40, 14.5, 18.5)
        c.dith(m, G, .6)
        c.fill(c.ell(cx, 56, 14, 3) & ~c.ell(cx, 56, 11, 2), GD)
    c.star(cx + 10 - f, 10 + f * 2 % 20, 1, WI)


make('djinn_wish', 64, 10, 'allAllies', PAL, draw)

