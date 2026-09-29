"""인어 전사 필살기 대해의 소용돌이 screen 128x12 — 바다가 소용돌이로 말려 가운데가 꺼지고 물기둥이 솟아 터진다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(10, 30, 60), (255, 255, 255), (214, 250, 255), (128, 236, 204), (36, 168, 158), (18, 104, 118), (12, 64, 96), (252, 222, 110), (252, 146, 150)]
OL, W, WA, SL, SC, SD, DK, G, FN = 1, 2, 3, 4, 5, 6, 7, 8, 9


def draw(c, f, t):
    cx, cy = 64, 70
    c.fill(c.ell(cx, cy, 60, 44), DK)
    rot = f * 0.5
    for arm in range(4):
        for k in range(90):
            u = k / 89
            a = rot + arm * math.pi / 2 + u * 5.0
            r = 56 * (1 - u) + 4
            x, y = cx + math.cos(a) * r, cy + math.sin(a) * r * 0.72
            w = 1 + (1 - u) * 5
            c.fill(c.disc(x, y, w), (SC, SL, SD, SC)[arm])
            if k % 9 == 0:
                c.fill(c.disc(x, y, w * .45), WA)
    c.fill(c.ell(cx, cy, 8 - f * .3 + 4, 5), OL)
    if f >= 6:
        g = ease(min(1, (f - 6) / 4))
        top = cy - 64 * g
        col = c.poly([(cx - 10, cy), (cx - 6, top), (cx + 6, top), (cx + 10, cy)])
        c.fill(col, SL)
        c.fill(c.poly([(cx - 3, cy), (cx - 2, top), (cx + 2, top), (cx + 3, cy)]), W)
        if f >= 9:
            r = rng(f)
            for _ in range(24):
                a = r.uniform(0, 6.28); d = r.uniform(8, 20 + (f - 8) * 12)
                c.fill(c.disc(cx + math.cos(a) * d, top + 10 + math.sin(a) * d * .7, r.uniform(1.5, 3.5)), (WA, W, SL)[_ % 3])
    r = rng(f + 5)
    for _ in range(14):
        c.fill(c.ring(r.uniform(10, 118), r.uniform(20, 116), r.uniform(1.5, 3), 1), WA)
    c.star(cx, 12 + (f % 3), 2, G, W)


make('merfolk_maelstrom_sky', 128, 12, 'screen', PAL, draw)

