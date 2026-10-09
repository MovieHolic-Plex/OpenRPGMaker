"""바실리스크 석화 시선 target 64x10 — 대상 위에 노란 뱀눈이 열리고, 발밑부터 돌 껍질이 기어올라 금이 가며 굳는다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(24, 30, 34), (255, 255, 255), (200, 255, 230), (255, 240, 90), (180, 150, 40), (216, 216, 222), (172, 172, 184), (112, 112, 128), (72, 72, 88)]
OL, W, GG, EY, EYD, S1, S2, S3, S4 = 1, 2, 3, 4, 5, 6, 7, 8, 9


def draw(c, f, t):
    cx = 32
    # 뱀눈(위)
    op = min(1, f / 3) if f < 7 else max(0, 1 - (f - 6) / 3)
    if op > 0:
        c.fill(c.ell(cx, 12, 11, 5 * op + .5), EYD)
        c.fill(c.ell(cx, 12, 9.5, 4 * op + .3), EY)
        c.fill(c.ell(cx, 12, 1.3, 3.8 * op + .3), OL)
        c.px(cx - 4, 11, W)
        for k in range(5):
            c.fill(c.seg(cx - 6 + k * 3, 17, cx - 9 + k * 4.5, 26 + (f % 2) * 2, 1), GG)
    # 돌 껍질이 아래부터
    h = min(40, max(0, f - 1) * 6)
    if h > 0:
        top = 56 - h
        shell = c.ell(cx, 40, 14, 18) & (c.Y > top)
        c.fill(shell, S2)
        c.fill(shell & (c.X < cx - 4), S1)
        c.fill(shell & (c.X > cx + 7), S3)
        c.fill(c.seg(cx - 14, top, cx + 14, top, 1.2) & c.ell(cx, 40, 15, 19), GG)
        for k, (x0, y0, x1, y1) in enumerate(((cx - 6, 52, cx - 2, 40), (cx - 2, 40, cx - 7, 30), (cx + 5, 54, cx + 8, 44), (cx + 8, 44, cx + 3, 34))):
            if min(y0, y1) > top:
                c.fill(c.seg(x0, y0, x1, y1, 1), S4)
        c.outline(S4)
    if f >= 8:
        r = rng(f)
        for _ in range(8):
            c.shard(cx + r.uniform(-16, 16), 40 + r.uniform(-18, 16), 2, r.uniform(0, 360), S2, S4)
    c.star(cx + 12, 30 - f % 3, 1, W)


make('basilisk_petrify', 64, 10, 'target', PAL, draw)

