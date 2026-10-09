import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""허수아비 낫질 — 쇠낫 날이 큰 반달 궤적을 그리며 대상을 베고 짚 부스러기가 흩날린다. 64×8, target."""
KEY, SIZE, FRAMES = 'scarecrow_reap', 64, 8
PAL = ['1e140a', '5a3e20', '8e9cb0', 'eef4fa', 'ffffff', 'd8b040', 'f8e27e', 'ff8020']
O, H, LD, LL, W, ZM, ZL, E = range(1, 9)


def draw(c, f, t):
    if f <= 4:
        a1 = -80 + f * 50
        c.arc(40, 30, 20, -100, a1, LD, 3)
        c.arc(40, 30, 19, -100, a1, LL, 1)
        a = math.radians(a1)
        tx, ty = 40 + math.cos(a) * 20, 30 + math.sin(a) * 20
        hx, hy = 40 + math.cos(a) * 30, 30 + math.sin(a) * 30
        c.line([(tx, ty), (hx, hy)], H, 2)
        c.poly([(tx, ty), (tx - math.sin(a) * 8 + math.cos(a) * 2, ty + math.cos(a) * 8 + math.sin(a) * 2), (tx + math.cos(a) * 3, ty + math.sin(a) * 3)], LL)
        c.outline(O, [LL])
    else:
        k = f - 5
        c.arc(40, 30, 20 + k, -100, 120, LD if k < 2 else O, 1)
        c.line([(14, 30 - k), (50, 26 + k)], W if k == 0 else LL)
    if f >= 3:
        for j in range(7):
            x = 20 + (j * 7 + f * 2) % 28
            y = 22 + (j * 5 + f * 5) % 26
            c.line([(x, y), (x + 2, y - 1)], ZL if j % 2 else ZM)
    if f == 4:
        c.star(24, 34, 4, W, E)


run(globals())

