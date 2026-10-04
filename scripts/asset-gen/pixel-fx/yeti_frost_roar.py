"""예티 얼음 포효 allTargets 64x10 — 오른쪽(시전자)에서 오는 냉기 파동이 대상을 덮고 얼음 가시가 솟았다 부서진다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(28, 40, 76), (255, 255, 255), (214, 244, 255), (150, 222, 255), (74, 150, 226), (40, 84, 170)]
OL, W, L1, IC, ICD, DK = 1, 2, 3, 4, 5, 6


def draw(c, f, t):
    cx, cy = 32, 36
    if f < 5:
        for k in range(3):
            r = 10 + f * 6 - k * 5
            if r > 2:
                c.fill(c.arc(58, cy, r, 2, 135, 225), (L1, IC, ICD)[k])
    if 2 <= f <= 8:
        g = min(1, (f - 2) / 3) * (1 if f < 7 else 1 - (f - 6) * 0.3)
        for i, (x, h) in enumerate(((22, 16), (30, 22), (38, 18), (45, 12), (16, 10))):
            hh = h * g
            if hh < 2:
                continue
            c.fill(c.poly([(x - 3.5, 50), (x, 50 - hh), (x + 3.5, 50)]), IC)
            c.fill(c.poly([(x - 1, 50), (x, 50 - hh), (x + 1.5, 50)]), L1)
        c.outline(DK)
    if f >= 6:
        r = rng(f)
        for _ in range(8 + f):
            a = r.uniform(0, 6.28); d = (f - 5) * 4 + r.uniform(0, 6)
            c.shard(cx + math.cos(a) * d, 44 + math.sin(a) * d * 0.6, 2.2, math.degrees(a), IC, W)
    for k in range(4 + f % 3):
        c.star(10 + (k * 13 + f * 5) % 44, 12 + (k * 7 + f * 3) % 20, 1, W)


make('yeti_frost_roar', 64, 10, 'allTargets', PAL, draw)

