import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""허수아비 추수의 달(필살기 배경) — 붉은 보름달이 떠오르고 까마귀 떼가 달을 가로지르며, 그 앞을 거대한 낫 그림자가 휩쓴다. 128×12, screen."""
KEY, SIZE, FRAMES = 'scarecrow_moon_sky', 128, 12
PAL = ['0c0a10', '1e1418', '5a1a10', 'b03a30', 'f07040', 'ffb080', '0e0c14', '26242e', '8e9cb0', 'eef4fa', 'd8b040', 'ff8020']
N0, N1, MD, MM, ML, MX, O, K, LD, LL, ZM, E = range(1, 13)


def crow(c, x, y, flap):
    wy = (-5, 0, 4)[flap]
    c.ell(x, y, 4, 2.2, K)
    c.ell(x - 4, y - 1, 2.2, 2, K)
    c.px(x - 7, y - 1, ZM)
    c.line([(x, y), (x + 3, y + wy)], K, 2)
    c.px(x - 4, y - 2, E)


def draw(c, f, t):
    c.ell(64, 64, 62, 60, N0)
    my = 70 - min(f, 5) * 5
    c.ell(64, my, 30, 30, MD)
    c.ell(62, my - 2, 27, 27, MM)
    c.ell(56, my - 8, 12, 12, ML)
    c.ell(74, my + 8, 5, 4, MD)
    c.ell(52, my + 12, 4, 3, MD)
    c.rect(0, 100, 128, 128, N1)
    for x in range(6, 128, 9):
        c.line([(x, 100), (x + 2, 94 - (x * 7) % 6)], ZM)
    for k in range(9):
        x = (k * 17 - f * 9) % 150 - 10
        y = 30 + (k * 23) % 50 + math.sin(f + k) * 3
        crow(c, x, y, (f + k) % 3)
    if f >= 6:
        a1 = -160 + (f - 6) * 38
        c.arc(64, 110, 70, -170, a1, LD, 5)
        c.arc(64, 110, 68, -170, a1, LL, 2)
    if f == 10:
        c.star(40, 60, 10, LL, MX)


run(globals())

