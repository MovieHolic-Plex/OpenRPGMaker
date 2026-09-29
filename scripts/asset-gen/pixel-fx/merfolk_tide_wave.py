"""인어 전사 밀려오는 조수 allTargets 64x10 — 오른쪽에서 파도가 말려 들어와 대상 위에서 부서지고 거품으로 빠진다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(16, 40, 70), (255, 255, 255), (214, 250, 255), (128, 236, 204), (36, 168, 158), (18, 104, 118), (12, 64, 96)]
OL, W, WA, SL, SC, SD, DK = 1, 2, 3, 4, 5, 6, 7


def draw(c, f, t):
    x0 = lerp(64, 8, ease(min(1, f / 6)))
    h = 30 if f < 6 else 30 - (f - 5) * 5
    base = 52
    if h > 4:
        crest = x0 + 8
        body = c.poly([(x0, base), (x0 + 2, base - h * .6), (crest, base - h), (crest + 10, base - h + 3), (crest + 6, base - h * .6), (64, base - h * .4), (64, base)])
        c.fill(body, SC)
        c.fill(body & (c.Y > base - h * .35), SD)
        c.fill(c.arc(crest + 4, base - h + 6, 6, 2, 180, 300), WA)
        c.fill(c.arc(crest + 4, base - h + 6, 4, 1, 190, 280), W)
        for k in range(4):
            c.fill(c.seg(x0 + 10 + k * 11, base - h * .5 + (k % 2) * 4, x0 + 16 + k * 11, base - h * .5 + (k % 2) * 4, 1), SL)
        c.outline(DK)
    r = rng(f + 3)
    for _ in range(4 + f * 2):
        x, y = r.uniform(4, 60), r.uniform(base - 18 - f, base + 4)
        rad = r.uniform(1, 2.6)
        c.fill(c.ring(x, y, rad + .8, 1), WA)
    for _ in range(6):
        c.px(r.uniform(4, 60), r.uniform(10, base - h), W)


make('merfolk_tide_wave', 64, 10, 'allTargets', PAL, draw)

