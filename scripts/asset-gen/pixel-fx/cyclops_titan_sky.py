"""사이클롭스 필살기 타이탄 크래시 screen 128x12 — 거대한 바위가 오른쪽 위에서 떨어져 땅을 부수고 파편과 먼지가 솟는다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(40, 28, 26), (255, 255, 210), (255, 232, 96), (214, 150, 60), (196, 186, 170), (156, 146, 134), (104, 96, 92), (70, 64, 66), (150, 100, 70), (236, 226, 196)]
OL, W, GL, OR, R1, R2, R3, R4, BR, DU = 1, 2, 3, 4, 5, 6, 7, 8, 9, 10


def boulder(c, x, y, r):
    m = c.disc(x, y, r) | c.disc(x + r * .5, y - r * .4, r * .7) | c.disc(x - r * .5, y + r * .2, r * .75)
    c.fill(m, R2)
    c.fill(m & c.disc(x - r * .4, y - r * .5, r * .75), R1)
    c.fill(m & ~c.disc(x - r * .2, y - r * .2, r * .95), R3)
    for k in range(4):
        a = k * 1.6 + .4
        c.fill(c.seg(x + math.cos(a) * r * .2, y + math.sin(a) * r * .2, x + math.cos(a) * r * .6, y + math.sin(a) * r * .6, 1), R4)


def draw(c, f, t):
    gy = 96
    if f < 5:
        u = ease(f / 4)
        boulder(c, lerp(100, 58, u), lerp(-10, gy - 22, u), 26)
        for k in range(3):
            c.fill(c.seg(lerp(100, 58, u) + 22 + k * 6, lerp(-10, gy - 22, u) - 30 + k * 4, lerp(100, 58, u) + 34 + k * 6, lerp(-10, gy - 22, u) - 50 + k * 4, 2), GL)
    else:
        g = f - 5
        r = rng(7)
        # 땅 금
        for k in range(7):
            a = math.pi + (k / 6) * math.pi
            L = 20 + g * 9
            c.zig(58, gy, 58 + math.cos(a) * L * 1.2, gy + abs(math.sin(a)) * 4 + 8, 5, 2, R4, seed=k + 20, w=2)
        c.fill(c.ell(58, gy + 2, 30 + g * 6, 5), BR)
        boulder(c, 58 + (g % 2), gy - 20 + g * 1.5, 24 - g * 1.2)
        # 섬광
        if g < 3:
            c.fill(c.ell(58, gy, 44 - g * 6, 14 - g * 3) & ~c.disc(58, gy - 20, 22), GL)
            c.fill(c.ell(58, gy, 30 - g * 6, 8 - g * 2) & ~c.disc(58, gy - 20, 22), W)
        # 먼지와 파편
        for i in range(10):
            a = r.uniform(3.4, 6.0); d = 16 + g * r.uniform(5, 10)
            boulder(c, 58 + math.cos(a) * d * 1.3, gy - 12 + math.sin(a) * d, r.uniform(2, 4.5))
        for i in range(12):
            x = 58 + r.uniform(-60, 60); y = gy - r.uniform(0, 10 + g * 5)
            c.fill(c.disc(x, y, r.uniform(2, 5)), DU if i % 2 else R1)
    rs = rng(f + 30)
    for _ in range(10):
        c.star(rs.uniform(10, 118), rs.uniform(14, 60), 1, GL)


make('cyclops_titan_sky', 128, 12, 'screen', PAL, draw)

