import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""태엽 병정 태엽 감기 — 시전자 등 뒤 커다란 금 태엽 열쇠가 돌고, 톱니 고리가 몸을 감싸며 속도선이 뻗는다. 64×10, user."""
KEY, SIZE, FRAMES = 'clockwork_windup', 64, 10
PAL = ['181018', '8a6010', 'dcaa30', 'fff0a0', '8c94a4', 'dce2ee', 'ffffff']
O, GD, G, GL, SM, SL, W = range(1, 8)


def gear(c, x, y, r, a0, k, kl):
    for i in range(8):
        a = a0 + i * math.pi / 4
        c.rect(x + math.cos(a) * r - 1, y + math.sin(a) * r - 1, x + math.cos(a) * r + 1, y + math.sin(a) * r + 1, k)
    c.ring(x, y, r - 1, r - 1, k, 2)
    c.px(x, y, kl)


def draw(c, f, t):
    a = f * math.pi / 5
    kx, ky = 44, 26
    c.line([(36, 32), (kx, ky)], GD, 2)
    for s in (0, math.pi):
        b = a + s
        rx = abs(math.cos(b)) * 6 + 1
        c.ell(kx + 3 + math.cos(b) * 0, ky - 4 if s == 0 else ky + 4, rx, 3.5, G)
    c.outline(O, [G])
    gear(c, 18, 44, 5, -a, G, GL)
    gear(c, 26, 16, 4, a * 1.3, SM, SL)
    if f >= 3:
        c.ring(32, 36, 20, 8, GD, 1, gap=10, phase=a)
    if f >= 5:
        for k in range(3):
            y = 26 + k * 8
            c.line([(46 + k * 2, y), (58, y)], SL if k % 2 else W)
    if f in (4, 8):
        c.star(44, 20, 3, W, GL)


run(globals())

