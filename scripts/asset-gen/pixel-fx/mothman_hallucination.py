"""나방 인간 환각 target 64x10 — 대상 머리 위 붉은 눈 무늬(나방 날개 눈알)가 열리며 겹 물결 고리가 비틀려 돈다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(40, 28, 40), (255, 255, 220), (255, 206, 168), (255, 56, 56), (170, 30, 60), (206, 140, 255), (132, 76, 204), (90, 196, 214), (40, 110, 150), (252, 242, 150)]
OL, W, PK, RD, RDD, PU, PD, SP, SPD, DU = 1, 2, 3, 4, 5, 6, 7, 8, 9, 10


def draw(c, f, t):
    cx, cy = 32, 30
    op = min(1, (f + 1) / 4) if f < 8 else 1 - (f - 7) * .3
    for k in range(3):
        r = (6 + k * 7 + f * 2) % 26 + 4
        wob = math.sin(f * .8 + k) * 3
        c.fill(c.ell(cx + wob, cy, r, r * .6, f * 12 + k * 30) & ~c.ell(cx + wob, cy, r - 1.5, r * .6 - 1.5, f * 12 + k * 30), (PU, SP, PD)[k])
    # 눈 두 개(날개 무늬)
    for sx in (-10, 10):
        ex = cx + sx
        c.fill(c.ell(ex, cy, 7, 5 * op + .5), SPD)
        c.fill(c.ell(ex, cy, 5.5, 4 * op + .3), SP)
        c.fill(c.ell(ex, cy, 3.5, 3 * op), RD)
        c.fill(c.ell(ex - .5, cy, 1.4, 2 * op), OL)
        c.px(ex - 2, cy - 2 * op, W)
    for k in range(4):
        a = f * .6 + k * 1.57
        c.star(cx + math.cos(a) * 22, cy + 14 + math.sin(a) * 6, 1, DU if k % 2 else PK)
    if f >= 6:
        c.fill(c.ring(cx, cy + 16, (f - 5) * 4, 1), RDD)


make('mothman_hallucination', 64, 10, 'target', PAL, draw)

