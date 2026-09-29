import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""살아있는 갑옷 망령 군단(필살기 배경) — 어둠 속에 빈 투구 행렬의 보라 눈이 켜지고, 하늘에서 영혼 대검이 줄지어 꽂힌다. 128×12, screen."""
KEY, SIZE, FRAMES = 'living_armor_legion_sky', 128, 12
PAL = ['0c0814', '16121e', '2a2440', '4a4e64', '8a92aa', 'd2dae8', '3a0c5a', '7a24b8', 'b060f0', 'e8b0ff', 'f4f8ff', 'd0a038']
N0, O, SH, SD, SM, SL, PD, PM, PL, PX, B, GOLD = range(1, 13)


def helm(c, x, y, lit):
    c.ell(x, y, 6, 7, SD)
    c.ell(x - 1, y - 1, 4, 5, SM)
    c.rect(x - 5, y - 1, x + 5, y + 1, O)
    if lit:
        c.px(x - 3, y, PX)
        c.px(x + 2, y, PX)
        c.px(x - 2, y, PL)
        c.px(x + 3, y, PL)
    c.flame(x, y - 6, 6, 2, (PD, PM, PL))


def sword(c, x, y0, y1):
    c.poly([(x - 3, y0), (x + 3, y0), (x + 3, y1 - 6), (x, y1), (x - 3, y1 - 6)], PX)
    c.line([(x, y0), (x, y1 - 3)], B)
    c.rect(x - 7, y0 - 2, x + 7, y0, GOLD)
    c.rect(x - 1, y0 - 10, x + 1, y0 - 2, SD)
    c.outline(PD, [PX, B])


def draw(c, f, t):
    c.ell(64, 64, 62, 60, N0)
    c.ell(64, 70, 56, 46, SH)
    for i in range(7):
        x = 12 + i * 17
        helm(c, x, 88 + (i % 2) * 6, f >= 1 + i // 2)
    if f >= 3:
        for i in range(5):
            s = f - 3 - i
            if s < 0:
                continue
            x = 22 + i * 21
            y1 = min(20 + s * 22, 104)
            sword(c, x, max(y1 - 44, 6), y1)
            if y1 >= 104 and s <= 5:
                c.ring(x, 104, 6 + (s - 3) * 3, 3, PL, 1)
                c.star(x, 100, 3, B)
    if f >= 9:
        c.ring(64, 64, 20 + (f - 9) * 18, 16 + (f - 9) * 14, PX, 2, gap=10)


run(globals())

