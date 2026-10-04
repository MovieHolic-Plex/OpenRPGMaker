"""지니 필살기 세 가지 소원 screen 128x12 — 황금 램프에서 연기가 솟아 거대한 지니 얼굴이 떠오르고, 세 개의 소원별이 모여 황금 폭풍으로 터진다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(24, 18, 50), (255, 255, 224), (255, 222, 92), (198, 138, 40), (226, 218, 255), (172, 152, 232), (112, 90, 182), (82, 140, 232), (52, 90, 182), (196, 255, 238), (104, 210, 200), (228, 60, 88)]
OL, W, G, GD, SL, SM, SD, SK, SKD, WI, WD, SA = range(1, 13)


def draw(c, f, t):
    # 램프(아래 가운데)
    c.fill(c.ell(64, 110, 18, 7) | c.poly([(46, 108), (28, 100), (46, 112)]), G)
    c.fill(c.ell(64, 113, 16, 3), GD)
    c.fill(c.ell(64, 102, 6, 3), GD)
    rise = min(1, f / 5)
    for k in range(60):
        u = k / 59
        if u > rise:
            break
        y = 100 - u * 60
        x = 64 + math.sin(u * 8 + f * .5) * (4 + u * 10)
        c.fill(c.disc(x, y, 3 + u * 9), (SM, SL, SD)[k % 3])
    if f >= 3:
        g = ease(min(1, (f - 3) / 4))
        fy = 40
        c.fill(c.ell(64, fy, 20 * g + 1, 22 * g + 1), SK)
        c.fill(c.ell(58, fy - 6, 10 * g, 10 * g), SK)
        c.fill(c.ell(70, fy + 8, 12 * g, 10 * g) & c.ell(64, fy, 20 * g + 1, 22 * g + 1), SKD)
        if g > .5:
            for sx in (-8, 8):
                c.fill(c.ell(64 + sx, fy - 4, 3.5, 2), W)
            c.fill(c.poly([(56, fy + 8), (72, fy + 8), (64, fy + 22)]), OL)
            c.fill(c.seg(56, fy + 4, 72, fy + 4, 1.4), SA)
            c.fill(c.poly([(60, fy - 22), (64, fy - 34), (68, fy - 22)]), OL)
            c.fill(c.disc(64, fy - 18, 2.5), G)
    if f >= 6:
        # 세 소원별이 모인다
        u = min(1, (f - 6) / 3)
        for k in range(3):
            a = k * 2.09 + f * .5
            d = 44 * (1 - u) + 4
            c.star(64 + math.cos(a) * d, 40 + math.sin(a) * d * .6, 3, G, W)
    if f >= 9:
        rr = (f - 8) * 16
        c.fill(c.ring(64, 44, rr, 4), G)
        c.fill(c.ring(64, 44, rr - 5, 2), WI)
        r = rng(f)
        for _ in range(30):
            a = r.uniform(0, 6.28); d = r.uniform(0, rr)
            c.px(64 + math.cos(a) * d, 44 + math.sin(a) * d, (G, W, WD)[_ % 3])


make('djinn_genie_sky', 128, 12, 'screen', PAL, draw)

