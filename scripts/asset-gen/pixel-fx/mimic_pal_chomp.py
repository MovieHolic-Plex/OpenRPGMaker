import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""미믹 뚜껑 물기 — 대상 위에 위아래 이빨 턱이 벌어졌다 콱 닫히고 금빛 파편이 튄다. 64×8, target."""
KEY, SIZE, FRAMES = 'mimic_pal_chomp', 64, 8
PAL = ['1c100c', '5a3218', '8e5628', 'd8a830', 'f8e878', 'f4f0e2', '2a0810', 'e0546c', 'ffffff']
O, WD, WM, G, GL, T, M, TM, W = range(1, 10)


def jaw(c, cy, h, up):
    s = -1 if up else 1
    c.poly([(12, cy), (52, cy), (50, cy + s * h), (14, cy + s * h)], WM)
    c.line([(12, cy + s * h), (52, cy + s * h)], O)
    c.line([(12, cy + s * (h - 2)), (52, cy + s * (h - 2))], G)
    for k in range(7):
        x = 15 + k * 5
        c.poly([(x, cy), (x + 3, cy), (x + 1.5, cy - s * 4)], T)
        c.px(x + 1, cy - s * 1, W)
    c.outline(O, [WM, T, G])


def draw(c, f, t):
    gap = [18, 22, 24, 14, 2, 1, 3, 6][f]
    cy = 32
    if f < 6:
        c.rect(16, cy - gap // 2 + 1, 48, cy + gap // 2 - 1, M) if gap > 3 else None
        jaw(c, cy - gap // 2, 8, True)
        jaw(c, cy + gap // 2, 8, False)
    if f >= 4:
        r = [0, 0, 0, 0, 6, 10, 14, 18][f]
        for k in range(8):
            a = k * math.pi / 4 + .3
            x, y = 32 + math.cos(a) * r, 32 + math.sin(a) * r * .8
            c.star(x, y, 2 if f < 7 else 1, GL if k % 2 else G, W)
    if f == 4:
        c.star(32, 32, 6, W, GL)
    if f in (0, 1, 2):
        c.line([(20, cy + gap // 2 - 2), (30, cy + 2), (26, cy + gap // 2 + 3)], TM, 2)


run(globals())

