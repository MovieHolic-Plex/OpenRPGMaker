import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""살아있는 갑옷 영혼 검 — 보라 영혼을 두른 대검의 궤적이 대상을 가르고 영혼 조각이 흩어진다. 64×8, target."""
KEY, SIZE, FRAMES = 'living_armor_soul_edge', 64, 8
PAL = ['16121e', '3a0c5a', '7a24b8', 'b060f0', 'e8b0ff', 'f4f8ff', '8a92aa']
O, PD, PM, PL, PX, B, SM = range(1, 8)


def draw(c, f, t):
    if f <= 4:
        a1 = -70 + f * 55
        for w, k in ((5, PD), (3, PM), (1, PX)):
            c.arc(34, 22, 22 - (5 - w), -110, a1, k, w)
        tipa = math.radians(a1)
        tx, ty = 34 + math.cos(tipa) * 22, 22 + math.sin(tipa) * 22
        c.poly([(tx - 3, ty - 3), (tx + 3, ty - 1), (tx + 1, ty + 4)], B)
    else:
        k = f - 5
        c.line([(12, 8 + k), (52, 50 - k)], PL if k < 2 else PM, 3 - k)
        c.line([(14, 10 + k), (50, 48 - k)], B if k == 0 else PX)
    if f >= 3:
        for j in range(6):
            a = j * 1.05 + f * .4
            r = (f - 2) * 4
            x, y = 32 + math.cos(a) * r, 32 + math.sin(a) * r
            c.flame(x, y, 4, 1.2, (PD, PM, PL))
    if f == 3:
        c.star(32, 32, 7, B, PX)


run(globals())

