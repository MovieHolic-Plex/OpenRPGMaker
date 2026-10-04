import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""초롱 귀신 백귀 초롱 행렬(필살기 배경) — 밤하늘에 초롱 행렬이 줄지어 흘러가고 외눈들이 번쩍 떠지며 푸른 도깨비불이 쏟아진다. 128×12, screen."""
KEY, SIZE, FRAMES = 'lantern_ghost_parade_sky', 128, 12
PAL = ['0a0a20', '161838', '22120a', 'c87830', 'f0b450', 'fff2b8', 'a85c20', '2e2630', 'fffff4', '2058c0', '48a8f0', 'a8e4ff', '801020']
N0, N1, O, PD, PM, PL, R, K, W, B1, BM, BL, MD = range(1, 14)


def lantern(c, x, y, eye):
    c.rect(x - 4, y - 9, x + 4, y - 7, K)
    c.ell(x, y, 7, 8, PM)
    c.ell(x - 2, y - 2, 3, 3, PL)
    for yy in (y - 4, y, y + 4):
        c.line([(x - 6, yy), (x + 6, yy)], R)
    c.rect(x - 4, y + 7, x + 4, y + 9, K)
    if eye:
        c.ell(x - 1, y, 3, 3, W)
        c.px(x - 2, y, O)
        c.poly([(x - 6, y + 4), (x + 1, y + 4), (x - 5, y + 6)], MD)


def draw(c, f, t):
    c.ell(64, 64, 62, 60, N0)
    c.ell(64, 72, 54, 40, N1)
    for row, (yb, sp) in enumerate(((44, 5), (78, -4))):
        for i in range(6):
            x = (i * 26 + f * sp + row * 12) % 156 - 14
            y = yb + math.sin(i * 1.7 + f * .5) * 4
            c.line([(x, y - 9), (x, y - 16)], K)
            lantern(c, x, y, f >= 4 + (i % 3))
        c.arc(64, yb - 40, 70, 58, 122, K, 1)
    if f >= 6:
        for k in range(8):
            s = f - 6
            x = 16 + k * 13
            y = 20 + ((s * 12 + k * 7) % 80)
            c.flame(x, y, 8, 2.5, (B1, BM, BL))
    if f == 5:
        c.star(64, 60, 12, BL, W)


run(globals())

