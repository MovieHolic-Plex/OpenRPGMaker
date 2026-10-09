"""타락 천사 필살기 심판의 빛 screen 128x12 — 금 간 후광이 하늘에 열려 검은 깃털이 소용돌이치고, 보랏빛 테를 두른 빛기둥이 내리꽂혀 폭발한다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(18, 12, 30), (255, 255, 255), (255, 252, 214), (255, 212, 92), (190, 130, 42), (174, 150, 255), (112, 90, 144), (70, 50, 92), (40, 28, 60), (104, 98, 134), (60, 56, 82), (214, 40, 64)]
OL, W, LT, HA, HD, LB, R1, R2, R3, WL, WG, RE = range(1, 13)


def draw(c, f, t):
    c.fill(c.disc(64, 64, 62), R3)
    # 후광(위): 금이 가 있다
    hr = 22 + min(f, 4) * 2
    c.fill(c.ell(64, 22, hr, hr * .3) & ~c.ell(64, 22, hr - 4, hr * .3 - 2.5), HA)
    c.clear(c.poly([(52, 10), (58, 10), (54, 34), (50, 34)]))
    c.fill(c.seg(55, 14, 52, 30, 1), RE)
    # 검은 깃털 소용돌이
    for k in range(18):
        a = k * .35 + f * .45
        d = 50 - (k % 6) * 4 - f * 1.5
        x, y = 64 + math.cos(a) * d, 64 + math.sin(a) * d * .8
        c.fill(c.ell(x, y, 5, 1.8, math.degrees(a) + 90), WG)
        c.fill(c.seg(x - 3, y, x + 3, y, 1), WL)
    if f >= 4:
        u = ease(min(1, (f - 4) / 3))
        bot = lerp(22, 110, u)
        w = 12 if f < 9 else 12 + (f - 8) * 4
        c.fill(c.poly([(64 - w - 4, 22), (64 + w + 4, 22), (64 + w + 6, bot), (64 - w - 6, bot)]), LB)
        c.fill(c.poly([(64 - w, 22), (64 + w, 22), (64 + w + 2, bot), (64 - w - 2, bot)]), HA)
        c.fill(c.poly([(64 - w * .45, 22), (64 + w * .45, 22), (64 + w * .5, bot), (64 - w * .5, bot)]), LT)
        c.fill(c.seg(64, 22, 64, bot, 2), W)
    if f >= 7:
        rr = (f - 6) * 9
        c.fill(c.ell(64, 108, rr + 10, (rr + 10) * .35), LB)
        c.fill(c.ell(64, 108, rr, rr * .3), LT)
        r = rng(f)
        for _ in range(16):
            a = r.uniform(3.3, 6.1); d = rr + r.uniform(4, 16)
            c.fill(c.ell(64 + math.cos(a) * d, 106 + math.sin(a) * d * .6, 4, 1.5, math.degrees(a)), WG)
    rs = rng(f + 40)
    for _ in range(10):
        c.star(rs.uniform(12, 116), rs.uniform(12, 116), 1, LB)


make('dark_angel_judgment_sky', 128, 12, 'screen', PAL, draw)

