"""타락 천사 흑우탄 32x4 — 깃촉이 왼쪽. 보랏빛 잔광을 끄는 검은 깃털."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(20, 16, 30), (104, 98, 134), (60, 56, 82), (32, 28, 48), (174, 150, 255), (255, 252, 214)]
OL, WL, WG, WD, LB, LT = 1, 2, 3, 4, 5, 6


def draw(c, f, t):
    y = 16 + (f % 2)
    for i, L in enumerate((6, 9, 5)):
        c.fill(c.seg(22 + f % 2, y - 2 + i * 2, 22 + L, y - 2 + i * 2, 1), LB)
    vane = c.ell(15, y, 10, 3.5, -8 + f * 4)
    c.fill(vane, WG)
    c.fill(vane & (c.Y < y), WL)
    c.fill(c.seg(4, y + .5, 26, y - 1, 1), WD)
    for k in range(3):
        x = 10 + k * 5
        c.fill(c.seg(x, y - 3, x + 2, y - .5, 1) | c.seg(x, y + 3, x + 2, y + .5, 1), WD)
    c.outline(OL)
    c.px(3, y, LT)


make('dark_angel_black_feather', 32, 4, 'projectile', PAL, draw)

