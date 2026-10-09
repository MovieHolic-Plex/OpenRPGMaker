import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""태엽 병정 장난감 대행진(필살기 배경) — 북소리 속에 샤코 모자 장난감 병정 대열이 줄지어 행진해 들어와 일제히 총을 겨누고 불을 뿜는다. 128×12, screen."""
KEY, SIZE, FRAMES = 'clockwork_parade_sky', 128, 12
PAL = ['0e1020', '1a2040', '181018', 'd83838', '3052b0', 'f2f0e6', 'f2caa2', 'dcaa30', '8c94a4', '6a4022', 'fff0a0', 'ffffff']
N0, N1, O, R, N, W, F, G, M, WD, GL, WW = range(1, 13)


def soldier(c, x, y, aim, step, fire):
    c.rect(x - 1, y + 8, x, y + 14 - step, W)
    c.rect(x + 2, y + 8, x + 3, y + 14 - (1 - step), W)
    c.rect(x - 2, y, x + 4, y + 8, N)
    c.line([(x - 2, y + 1), (x + 3, y + 7)], W)
    c.ell(x + 1, y - 3, 2.6, 2.6, F)
    c.rect(x - 2, y - 11, x + 4, y - 5, R)
    c.rect(x - 1, y - 10, x + 1, y - 8, G)
    if aim:
        c.line([(x - 12, y + 3), (x, y + 3)], M)
        c.line([(x - 1, y + 3), (x + 3, y + 5)], WD, 2)
        if fire:
            c.star(x - 14, y + 3, 4, GL, WW)
    else:
        c.line([(x + 5, y - 10), (x + 5, y + 8)], M)
    c.outline(O, [W, N, F, R])


def draw(c, f, t):
    c.ell(64, 64, 62, 60, N0)
    c.rect(0, 92, 128, 128, N1)
    enter = min(f / 5, 1)
    for row, yb in enumerate((56, 80)):
        for i in range(6):
            x = 26 + i * 16 + row * 8 + (1 - enter) * 90
            aim = f >= 6
            fire = f >= 8 and (i + row + f) % 2 == 0
            soldier(c, x, yb, aim, (f + i) % 2 if f < 6 else 0, fire)
    c.ell(18, 104, 9, 6, R)
    c.ell(18, 101, 9, 3, W)
    c.line([(12, 94), (16, 99)], WD)
    if f % 2 == 0:
        c.star(18, 92, 3, GL)
    if f >= 9:
        for k in range(5):
            y = 50 + k * 10
            c.line([(10, y), (40 - (f - 9) * 5, y)], GL)


run(globals())

