"""monster4-6 얼음 요정(마법) 15칸 — 칩 × 1, 셀 48, float(dead 만 바닥). 빙결·눈보라."""
import math
import sys
from pathlib import Path
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_nm4 import run, hexrgb as H, FLOOR

OL, I0, I1, I2, I3 = H('#14244a'), H('#3a64b0'), H('#6ea8e8'), H('#b4e0ff'), H('#f2fcff')


def flake(f, x, y, s=1):
    x, y = int(x), int(y)
    for i in range(-s, s + 1):
        f.px(x + i, y, I2)
        f.px(x, y + i, I2)
    if s > 1:
        for i in (-1, 1):
            f.px(x + i, y + i, I1)
            f.px(x + i, y - i, I1)
    f.px(x, y, I3)


def shard(f, x, y, l=6):
    """얼음 창(왼쪽으로)."""
    f.poly([(x, y), (x + l, y - 2), (x + l, y + 2)], I1)
    f.line([(x + 1, y), (x + l, y - 1)], I3)
    f.px(x, y, I3)


def fx(f, pal):
    flake(f['idle_b'], 9, 16)
    flake(f['idle_c'], 38, 12)
    flake(f['idle_c'], 10, 30)
    flake(f['windup'], 38, 20)
    c = f['move']
    for x, y in ((34, 20), (38, 26), (42, 22)):
        c.px(x, y, I2)
    c = f['attack']
    shard(c, 1, 22, 7)
    flake(c, 4, 14)
    flake(c, 6, 32)
    flake(f['recover'], 8, 22)
    c = f['hit']
    for x, y in ((35, 15), (39, 20), (36, 26)):
        c.px(x, y, I3)
        c.px(x + 1, y, I1)
    c = f['dead']
    c.ell(14, 42, 34, 44, I2, under=True)
    flake(c, 12, 38)
    c = f['cast_charge']
    for x, y in ((10, 20), (38, 20), (14, 32), (34, 32)):
        flake(c, x, y)
    c = f['cast_raise']
    flake(c, 24, 6, 4)
    c.ring(15, -3, 33, 15, I1)
    c = f['cast_release']
    shard(c, 0, 20, 9)
    shard(c, 3, 28, 6)
    flake(c, 10, 14)
    c = f['leap']
    for x, y in ((16, 38), (24, 42), (32, 38)):
        flake(c, x, y)
    c = f['buff']
    pts = [(24 + math.cos(math.radians(a)) * 17, 25 + math.sin(math.radians(a)) * 19) for a in range(-90, 270, 60)]
    c.line(pts + [pts[0]], I1, 1, under=True)
    for x, y in pts:
        flake(c, x, y)
    c = f['finisher']
    for i in range(10):
        x, y = (i * 7) % 20, 4 + (i * 11) % 38
        c.line([(x, y), (x + 4, y - 2)], I2)
    shard(c, 0, 24, 11)
    flake(c, 6, 10, 3)
    flake(c, 12, 36, 3)
    c.arc((-8, 4, 26, 44), 290, 70, I1, 2)


if __name__ == '__main__':
    run(6, fx, floating=True)
