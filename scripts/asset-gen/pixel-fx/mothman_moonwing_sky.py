"""나방 인간 필살기 달밤의 날개 screen 128x12 — 보름달이 떠오르고 거대한 나방 날개가 펼쳐져 눈알 무늬가 뜨며 인분 폭풍이 쏟아진다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(24, 18, 40), (255, 255, 230), (252, 242, 150), (222, 204, 150), (170, 140, 100), (110, 84, 70), (90, 196, 214), (40, 110, 150), (255, 56, 56), (206, 140, 255), (132, 76, 204), (60, 40, 96)]
OL, W, DU, WL, WG, WD, SP, SPD, RD, PU, PD, NT = 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12


def draw(c, f, t):
    c.fill(c.disc(64, 64, 62), NT)
    my = lerp(90, 40, ease(min(1, f / 4)))
    c.fill(c.disc(64, my, 20), DU)
    c.fill(c.disc(58, my - 5, 12), W)
    c.fill(c.disc(72, my + 6, 5), WL)
    spread = ease(min(1, max(0, (f - 2) / 5)))
    if spread > 0:
        for sg in (-1, 1):
            up = [(64, 64), (64 + sg * 60 * spread, 64 - 44 * spread), (64 + sg * 58 * spread, 64 - 8 * spread), (64 + sg * 20 * spread, 70)]
            lo = [(64, 66), (64 + sg * 44 * spread, 74 + 10 * spread), (64 + sg * 30 * spread, 104 * spread + 66 * (1 - spread)), (64 + sg * 8, 76)]
            c.fill(c.poly(lo), WD)
            c.fill(c.poly(up), WG)
            c.fill(c.poly(up) & (c.Y < 58), WL)
            ex, ey = 64 + sg * 34 * spread, 48 + 16 * (1 - spread)
            c.fill(c.disc(ex, ey, 9 * spread + 1), SPD)
            c.fill(c.disc(ex, ey, 7 * spread + .5), SP)
            c.fill(c.disc(ex, ey, 4 * spread), RD)
            c.px(ex - 1, ey - 2, W)
            for k in range(3):
                c.fill(c.seg(64, 64, 64 + sg * (30 + k * 10) * spread, 64 - (38 - k * 16) * spread, 1), WD)
        c.fill(c.ell(64, 70, 5, 14), WD)
        c.fill(c.ell(64, 62, 4, 5), WG)
        c.px(62, 61, RD); c.px(66, 61, RD)
    if f >= 6:
        r = rng(f)
        for _ in range(40 + f * 4):
            x, y = r.uniform(4, 124), r.uniform(10, 124)
            col = (DU, PU, W, SP, PD)[_ % 5]
            c.px(x, y, col)
            if _ % 7 == 0:
                c.star(x, y, 1, col)


make('mothman_moonwing_sky', 128, 12, 'screen', PAL, draw)

