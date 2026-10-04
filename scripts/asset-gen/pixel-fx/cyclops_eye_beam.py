"""사이클롭스 외눈 광선 target 64x10 — 오른쪽 위에서 뜨거운 빛줄기가 대상에 꽂혀 달아오르고 폭발로 흩어진다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(60, 22, 20), (255, 255, 230), (255, 255, 210), (255, 232, 96), (255, 170, 60), (214, 54, 46), (140, 30, 40)]
OL, W, L1, GL, OR, RD, DK = 1, 2, 3, 4, 5, 6, 7


def draw(c, f, t):
    tx, ty = 26, 38
    if f <= 6:
        head = min(1, (f + 1) / 3)
        sx, sy = 64, 10
        ex, ey = lerp(sx, tx, head), lerp(sy, ty, head)
        w = 7 if 2 <= f <= 5 else 4
        c.fill(c.seg(sx, sy, ex, ey, w + 2), RD)
        c.fill(c.seg(sx, sy, ex, ey, w), GL)
        c.fill(c.seg(sx, sy, ex, ey, max(1.5, w - 4)), W)
    if f >= 2:
        g = (f - 1)
        r = 4 + g * 2.6 if f < 7 else 20 - (f - 7) * 2
        c.fill(c.disc(tx, ty, r + 2), RD)
        c.fill(c.disc(tx, ty, r), OR)
        c.fill(c.disc(tx, ty, r * .6), GL)
        if f < 7:
            c.fill(c.disc(tx, ty, r * .3), W)
        else:
            c.clear(c.disc(tx, ty, (f - 6) * 4.5))
            c.fill(c.ring(tx, ty, (f - 6) * 4.5 + 1, 1), L1)
        for k in range(8):
            a = k * .785 + f * .2
            d = r + 3 + (f % 2) * 2
            c.px(tx + math.cos(a) * d, ty + math.sin(a) * d, L1)
    c.outline(DK)


make('cyclops_eye_beam', 64, 10, 'target', PAL, draw)

