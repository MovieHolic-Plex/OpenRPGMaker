"""인어 전사 삼지창 투척 32x4 — 갈래가 왼쪽. 창대 뒤로 물보라가 끌린다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(18, 36, 58), (252, 222, 110), (186, 134, 48), (214, 250, 255), (128, 236, 204), (36, 168, 158)]
OL, G, GD, WA, SL, SC = 1, 2, 3, 4, 5, 6


def draw(c, f, t):
    y = 16 + (1 if f % 2 else 0)
    for i, (L, col) in enumerate(((7, WA), (10, SL), (6, SC))):
        yy = y - 3 + i * 3
        c.fill(c.seg(20 + f, yy, 20 + f + L, yy, 1), col)
    c.fill(c.seg(8, y, 28, y, 1.6), GD)
    c.fill(c.seg(8, y - 0.4, 26, y - 0.4, 0.9), G)
    c.fill(c.seg(8, y - 4, 8, y + 4, 1.6), G)
    for d in (-4, 0, 4):
        c.fill(c.poly([(8, y + d - 1), (2, y + d), (8, y + d + 1)]), G)
    c.outline(OL)
    c.px(3, y - 2 + f, WA); c.px(5, y + 3 - f, WA)


make('merfolk_trident_throw', 32, 4, 'projectile', PAL, draw)

