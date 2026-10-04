import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""초롱 귀신 등불 인도 — 아군 머리 위에 작은 종이 초롱이 켜지고 따뜻한 빛이 내려와 감싼다. 64×10, allAllies."""
KEY, SIZE, FRAMES = 'lantern_ghost_glow', 64, 10
PAL = ['22120a', 'c87830', 'f0b450', 'fff2b8', 'a85c20', '2e2630', 'ffffff', 'fff8dc']
O, PD, PM, PL, R, K, W, CR = range(1, 9)


def draw(c, f, t):
    y = 8 + min(f, 4) * 2
    c.rect(29, y - 5, 35, y - 3, K)
    c.ell(32, y + 3, 6, 6, PM)
    c.ell(31, y + 2, 3.5, 3.5, PL)
    for yy in (y, y + 3, y + 6):
        c.line([(27, yy), (37, yy)], R)
    c.rect(29, y + 8, 35, y + 9, K)
    c.outline(O, [PM, PL, R])
    if f >= 2:
        h = min((f - 1) * 7, 38)
        for k, x in enumerate((24, 40)):
            c.line([(32, y + 10), (x - (f - 2) * 1.2 if k == 0 else x + (f - 2) * 1.2, y + 10 + h)], PL)
        c.ring(32, 56, 6 + min(f, 7) * 2.2, 3 + min(f, 7) * .4, PM, 1)
    if f >= 4:
        for k in range(5):
            a = k * 1.3 + f * .6
            yy = 54 - ((f * 5 + k * 9) % 36)
            c.star(32 + math.cos(a) * 14, yy, 1 if k % 2 else 2, CR if k % 2 else W)
    if f >= 7:
        c.ring(32, 34, 16, 20, PL, 1, gap=6, phase=f)


run(globals())

