"""예티 필살기 대눈사태 screen 128x12 — 오른쪽 위 설산이 무너져 눈사태가 왼쪽 아래로 쏟아지고 눈보라로 흩어진다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(24, 34, 68), (255, 255, 255), (230, 240, 252), (190, 210, 236), (150, 176, 214), (104, 130, 186), (150, 222, 255), (74, 150, 226), (54, 70, 120)]
OL, W, S1, S2, S3, S4, IC, ICD, RK = 1, 2, 3, 4, 5, 6, 7, 8, 9


def draw(c, f, t):
    # 설산 실루엣(오른쪽 위)
    sink = max(0, f - 3) * 3
    c.fill(c.poly([(62, 74 + sink), (92, 22 + sink), (104, 34 + sink), (118, 18 + sink), (132, 40 + sink), (120, 74 + sink)]), RK)
    c.fill(c.poly([(86, 32 + sink), (92, 22 + sink), (98, 30 + sink), (94, 34 + sink)]) | c.poly([(112, 26 + sink), (118, 18 + sink), (124, 26 + sink)]), W)
    # 쏟아지는 눈 덩어리: 앞머리가 오른쪽 위 → 왼쪽 아래
    front = ease(min(1, f / 8))
    hx, hy = lerp(100, 20, front), lerp(40, 100, front)
    r = rng(3)
    for i in range(26):
        u = i / 25
        x = lerp(112, hx, u) + r.uniform(-6, 6)
        y = lerp(34, hy, u) + r.uniform(-6, 6)
        rad = 5 + u * 9 + r.uniform(0, 3)
        c.fill(c.disc(x, y, rad), (S3, S2, S1)[i % 3])
        c.fill(c.disc(x - rad * .3, y - rad * .3, rad * .5), W if u > .5 else S1)
    c.fill(c.disc(hx, hy, 14 + f), S2)
    c.fill(c.disc(hx - 4, hy - 4, 7 + f * .5), W)
    c.fill(c.disc(hx + 5, hy + 6, 6) & ~c.disc(hx - 2, hy - 2, 12), S4)
    # 착지 후 눈보라 고리
    if f >= 7:
        rr = (f - 6) * 9
        c.fill(c.ring(hx, hy + 8, 14 + rr, 3), IC)
        c.fill(c.ring(hx, hy + 8, 10 + rr, 1.5), W)
    rs = rng(f + 11)
    for _ in range(18):
        c.shard(rs.uniform(8, 120), rs.uniform(10, 118), 2.5, 125, IC, ICD)
    for _ in range(24):
        c.px(rs.uniform(0, 128), rs.uniform(0, 128), W)


make('yeti_avalanche_sky', 128, 12, 'screen', PAL, draw)

