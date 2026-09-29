import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""살아있는 갑옷 빈 껍데기 — 시전자 몸 둘레에 투명한 판금 조각이 떠올라 겹치고, 속의 보라 영혼이 비친다. 64×10, user."""
KEY, SIZE, FRAMES = 'living_armor_hollow', 64, 10
PAL = ['16121e', '4a4e64', '8a92aa', 'd2dae8', '5a1a8a', 'a040e0', 'e8b0ff', 'f4f8ff']
O, SD, SM, SL, PD, PM, PL, B = range(1, 9)


def plate(c, x, y, w, h, k):
    c.poly([(x - w, y - h), (x + w, y - h + 1), (x + w - 1, y + h), (x - w + 1, y + h - 1)], k)
    c.line([(x - w + 1, y - h + 1), (x + w - 1, y - h + 2)], SL)


def draw(c, f, t):
    n = min(f + 1, 6)
    for k in range(n):
        a = k * math.pi / 3 + f * .3
        r = 22 - min(f, 6) * 1.3
        x, y = 32 + math.cos(a) * r, 34 + math.sin(a) * r * .9
        plate(c, x, y, 4, 3, SM if k % 2 else SD)
    c.outline(O, [SM, SD, SL])
    if f >= 4:
        c.ring(32, 34, 17, 19, PM, 1, gap=8, phase=f * .5)
    if f >= 6:
        c.ring(32, 34, 20, 22, PL if f % 2 else PD, 1, gap=5, phase=-f * .4)
    for k in range(2):
        yy = 50 - ((f * 4 + k * 12) % 34)
        c.flame(24 + k * 16, yy, 5, 1.5, (PD, PM, PL))
    if f == 7:
        c.star(18, 20, 3, B, PL)


run(globals())

