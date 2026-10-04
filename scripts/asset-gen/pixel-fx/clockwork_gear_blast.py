import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""태엽 병정 톱니 폭탄(착탄) — 태엽 폭탄이 터지며 금·강철 톱니와 나사, 스프링이 사방으로 튄다. 64×10, allTargets."""
KEY, SIZE, FRAMES = 'clockwork_gear_blast', 64, 10
PAL = ['181018', '8a6010', 'dcaa30', 'fff0a0', '4c5060', '8c94a4', 'dce2ee', 'f06a20', 'ffffff']
O, GD, G, GL, SD, SM, SL, FR, W = range(1, 10)


def gear(c, x, y, r, a0, k):
    for i in range(6):
        a = a0 + i * math.pi / 3
        c.px(x + math.cos(a) * (r + 1), y + math.sin(a) * (r + 1), k)
    c.ring(x, y, r, r, k, 1.5)


def draw(c, f, t):
    if f <= 2:
        r = 4 + f * 5
        c.ell(32, 36, r, r * .9, FR)
        c.ell(32, 36, r * .6, r * .55, GL)
        c.ell(32, 36, r * .3, r * .3, W)
    elif f <= 4:
        c.ring(32, 36, 16 + (f - 3) * 5, 14 + (f - 3) * 4, FR, 2, gap=6)
    for k in range(7):
        a = k * 2 * math.pi / 7 + .3
        d = 6 + f * 3
        x, y = 32 + math.cos(a) * d, 36 + math.sin(a) * d * .8 + max(f - 5, 0) ** 2 * .3
        if f >= 1:
            if k % 3 == 0:
                gear(c, x, y, 2.5, f * .8, G)
            elif k % 3 == 1:
                gear(c, x, y, 2, -f * .8, SM)
            else:
                c.line([(x - 2, y), (x + 2, y)], SL)
                c.px(x + 2, y, G)
    if f >= 5:
        c.line([(30, 40), (32, 36), (28, 33), (32, 30), (30, 27)], SL) if f < 8 else None
    if f == 2:
        c.star(32, 36, 12, W, GL)


run(globals())

