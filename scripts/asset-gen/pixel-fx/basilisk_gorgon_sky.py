"""바실리스크 필살기 고르곤의 왕관 screen 128x12 — 황금 왕관 속 거대한 뱀눈이 열리고 초록 석화 광선이 부채처럼 쓸어 전장이 잿빛 돌로 굳는다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(20, 30, 24), (255, 255, 255), (200, 255, 230), (255, 240, 90), (252, 212, 82), (180, 130, 40), (232, 62, 62), (150, 30, 52), (216, 216, 222), (172, 172, 184), (112, 112, 128), (72, 72, 88), (88, 170, 70), (40, 112, 62)]
OL, W, GG, EY, CR, CRD, RE, RED, S1, S2, S3, S4, SC, SCD = range(1, 15)


def draw(c, f, t):
    cx, cy = 64, 44
    # 돌로 굳는 땅(오른쪽에서 왼쪽으로 번진다) — 가장자리는 타원으로 끝나 네모 선이 없다
    if f >= 6:
        edge = lerp(128, 0, (f - 6) / 5)
        m = c.ell(64, 104, 62, 22) & (c.X > edge)
        c.fill(m, S3)
        c.fill(m & c.ell(64, 110, 50, 12), S4)
        for k in range(8):
            x = 14 + k * 14
            if x > edge:
                c.zig(x, 88, x + 5, 118, 4, 3, S1, seed=k)
    # 왕관
    c.fill(c.poly([(cx - 38, cy + 10), (cx - 40, cy - 16), (cx - 26, cy - 4), (cx - 14, cy - 26), (cx, cy - 8), (cx + 14, cy - 26), (cx + 26, cy - 4), (cx + 40, cy - 16), (cx + 38, cy + 10)]), CR)
    c.fill(c.poly([(cx - 38, cy + 10), (cx - 38, cy + 4), (cx + 38, cy + 4), (cx + 38, cy + 10)]), CRD)
    for x in (cx - 26, cx, cx + 26):
        c.fill(c.disc(x, cy + 7, 2.2), RE)
    op = min(1, f / 4)
    c.fill(c.ell(cx, cy - 2, 20, 11 * op + .5), SCD)
    c.fill(c.ell(cx, cy - 2, 17, 9 * op + .3), EY)
    c.fill(c.ell(cx, cy - 2, 2.5, 8.5 * op + .3), OL)
    c.fill(c.disc(cx - 7, cy - 6, 2) & c.ell(cx, cy - 2, 17, 9 * op + .3), W)
    # 석화 광선 부채: 화면 각도(0 오른쪽 · 90 아래) 200 → 130 으로 왼쪽 위에서 왼쪽 아래 땅까지 쓸어내린다
    if f >= 4:
        sweep = lerp(200, 130, min(1, (f - 4) / 5))
        for k in range(5):
            a = math.radians(sweep + (k - 2) * 7)
            L = 90
            c.fill(c.seg(cx, cy - 2, cx + math.cos(a) * L, cy - 2 + math.sin(a) * L, 3 if k == 2 else 1.5), W if k == 2 else GG)
    r = rng(f + 2)
    for _ in range(12):
        c.shard(r.uniform(8, 120), r.uniform(60, 118), 2.5, r.uniform(0, 360), S2, S4)
    for _ in range(8):
        c.star(r.uniform(12, 116), r.uniform(8, 40), 1, EY)


make('basilisk_gorgon_sky', 128, 12, 'screen', PAL, draw)

