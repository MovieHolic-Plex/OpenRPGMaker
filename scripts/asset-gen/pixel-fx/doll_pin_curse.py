import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""저주 인형 저주 바늘(착탄) — 대상에 박힌 바늘 셋에서 붉은 저주 무늬가 번지고 X 꿰맴 자국이 새겨진다. 64×8, target."""
KEY, SIZE, FRAMES = 'doll_pin_curse', 64, 8
PAL = ['1a0e16', 'b8c0d0', 'ffffff', '5a1022', '9a2034', 'd05a6a', 'ece4f4']
O, PIN, W, DD, DM, DL, S = range(1, 8)
PINS = [(24, 26, -35), (38, 32, -20), (30, 40, -50)]


def draw(c, f, t):
    for i, (x, y, ang) in enumerate(PINS):
        s = f - i
        if s < 0:
            continue
        a = math.radians(ang)
        ln = 10 if s > 0 else 6
        c.line([(x, y), (x + math.cos(a) * ln, y + math.sin(a) * ln)], PIN)
        c.px(x + math.cos(a) * ln, y + math.sin(a) * ln, DL)
        if s == 0:
            c.star(x, y, 3, W)
    if f >= 3:
        r = (f - 2) * 3
        c.ring(32, 33, r + 6, r * .8 + 5, DM, 1, gap=5, phase=f * .6)
        if f >= 5:
            c.ring(32, 33, r, r * .8, DD, 1, gap=4)
    if f >= 4:
        for x, y in ((22, 20), (42, 42)):
            c.line([(x - 3, y - 3), (x + 3, y + 3)], DL)
            c.line([(x + 3, y - 3), (x - 3, y + 3)], DL)
    if f >= 6:
        c.line([(18, 46), (46, 46)], S)
        for x in range(20, 46, 5):
            c.line([(x, 44), (x + 2, 48)], DM)


run(globals())

