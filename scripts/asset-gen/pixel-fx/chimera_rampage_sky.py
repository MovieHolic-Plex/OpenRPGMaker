"""키메라 필살기 혼돈의 삼두 screen 128x12 — 사자·염소·뱀 세 머리 실루엣이 떠올라 숨결을 한 점에 모으고, 불·번개·독이 섞인 거대 폭발이 번진다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(34, 18, 16), (255, 255, 255), (255, 242, 142), (255, 122, 40), (206, 50, 30), (176, 72, 40), (222, 160, 70), (176, 150, 255), (240, 236, 255), (98, 176, 92), (42, 104, 62), (188, 186, 178), (120, 98, 88)]
OL, W, FL, FI, FD, MN, LI, BO, BL, SN, SD, GT, HN = range(1, 14)


def heads(c, g):
    # 사자(가운데 크게)
    c.fill(c.disc(64, 34, 20 * g), MN)
    c.fill(c.disc(64, 38, 12 * g), LI)
    c.fill(c.ell(64, 46, 6 * g, 4 * g), FD)
    # 염소(왼쪽 위)
    c.fill(c.ell(30, 30, 9 * g, 11 * g), GT)
    c.fill(c.arc(24, 16, 8 * g, 3, 180, 330), HN)
    # 뱀(오른쪽 위)
    c.fill(c.ell(98, 28, 8 * g, 6 * g), SN)
    c.fill(c.seg(98, 32, 106, 56, 6 * g), SD)
    if g > .6:
        for x, y in ((58, 32), (70, 32), (28, 28), (95, 26)):
            c.px(x, y, FL)


def draw(c, f, t):
    g = ease(min(1, f / 4))
    if f < 9:
        heads(c, g)
    if 3 <= f <= 8:
        u = min(1, (f - 3) / 3)
        px, py = 60, 84
        c.fill(c.poly([(64, 48), (lerp(64, px, u) - 6, lerp(48, py, u)), (lerp(64, px, u) + 6, lerp(48, py, u))]), FI)
        c.zig(30, 40, lerp(30, px, u), lerp(40, py, u), 6, 3, BO, seed=f, w=2)
        for k in range(10):
            v = k / 9 * u
            c.fill(c.disc(lerp(100, px, v), lerp(40, py, v), 2.6), SN)
        c.fill(c.disc(px, py, 4 + u * 6), FL)
    if f >= 7:
        rr = (f - 6) * 11
        c.fill(c.disc(60, 84, rr), FD)
        c.fill(c.disc(60, 84, rr * .78), FI)
        c.fill(c.disc(60, 84, rr * .5), FL)
        c.fill(c.disc(60, 84, rr * .25), W)
        for k in range(8):
            a = k * .785 + f * .2
            c.zig(60, 84, 60 + math.cos(a) * (rr + 10), 84 + math.sin(a) * (rr + 10), 4, 3, BL if k % 2 else BO, seed=k)
        r = rng(f)
        for _ in range(14):
            a = r.uniform(0, 6.28); d = rr + r.uniform(0, 12)
            c.fill(c.disc(60 + math.cos(a) * d, 84 + math.sin(a) * d, 2), SN if _ % 2 else SD)
        if f >= 10:
            c.clear(c.disc(60, 84, (f - 9) * 14))


make('chimera_rampage_sky', 128, 12, 'screen', PAL, draw)

