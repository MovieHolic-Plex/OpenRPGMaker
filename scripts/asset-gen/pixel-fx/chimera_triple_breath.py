"""키메라 삼중 브레스 allTargets 64x10 — 오른쪽에서 불(위)·번개(가운데)·독(아래) 세 가닥이 대상에 꽂혀 한데 터진다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(42, 24, 20), (255, 242, 142), (255, 122, 40), (206, 50, 30), (176, 150, 255), (240, 236, 255), (98, 176, 92), (42, 104, 62), (255, 255, 255)]
OL, FL, FI, FD, BO, BL, SN, SD, W = range(1, 10)


def draw(c, f, t):
    tx, ty = 26, 36
    u = min(1, (f + 1) / 4)
    if f < 7:
        # 불: 위
        hx = lerp(64, tx, u)
        c.fill(c.poly([(64, 12), (hx + 6, ty - 10), (hx, ty - 6), (64, 22)]), FI)
        c.fill(c.poly([(64, 15), (hx + 6, ty - 8), (64, 19)]), FL)
        # 번개: 가운데
        c.zig(64, 32, lerp(64, tx, u), ty, 6, 3, BO, seed=f, w=1.6)
        c.zig(64, 32, lerp(64, tx, u), ty, 6, 3, BL, seed=f, w=.8)
        # 독: 아래
        for k in range(8):
            v = k / 7 * u
            c.fill(c.disc(lerp(64, tx, v), lerp(52, ty + 6, v) + math.sin(k + f) * 1.5, 2.2), SN if k % 2 else SD)
    if f >= 3:
        g = f - 2
        r = 5 + g * 2.5 if f < 8 else 20
        c.fill(c.disc(tx, ty, r + 1.5), FD)
        c.fill(c.disc(tx, ty, r), FI)
        c.fill(c.disc(tx - 2, ty - 2, r * .55), FL)
        c.fill(c.disc(tx + r * .4, ty + r * .4, r * .45), SN)
        for k in range(6):
            a = k * 1.05 + f * .3
            c.zig(tx, ty, tx + math.cos(a) * (r + 5), ty + math.sin(a) * (r + 5), 3, 1.5, BO, seed=k + f)
        if f >= 8:
            c.clear(c.disc(tx, ty, (f - 7) * 7))
    c.outline(OL)


make('chimera_triple_breath', 64, 10, 'allTargets', PAL, draw)

