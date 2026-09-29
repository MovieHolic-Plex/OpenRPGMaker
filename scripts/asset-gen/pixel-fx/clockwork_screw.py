import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""태엽 병정 나사 탄환(투사체) — 금 머리 달린 강철 나사가 뾰족한 끝을 왼쪽으로 두고 빙글 돌며 날아간다. 32×4 루프, projectile(첫 칸 왼쪽)."""
KEY, SIZE, FRAMES = 'clockwork_screw', 32, 4
PAL = ['181018', '4c5060', '8c94a4', 'dce2ee', '8a6010', 'dcaa30', 'fff0a0']
O, SD, SM, SL, GD, G, GL = range(1, 8)


def draw(c, f, t):
    c.poly([(5, 16), (10, 14), (20, 14), (20, 18), (10, 18)], SM)
    for k in range(4):
        x = 10 + k * 3 + (f % 2) * 1.5
        c.line([(x, 14), (x + 1.5, 18)], SD)
    c.line([(10, 14), (20, 14)], SL)
    c.rect(20, 12, 23, 20, G)
    c.line([(20, 12), (20, 20)], GL)
    c.line([(21.5, 12 + f % 2 * 2), (21.5, 20 - (1 - f % 2) * 2)], GD) if f < 2 else c.line([(20, 16), (23, 16)], GD)
    c.outline(O, [SM, G, GL, SL])
    c.line([(25, 15), (29, 15)], SL) if f % 2 == 0 else c.line([(25, 17), (29, 17)], SL)


run(globals())

