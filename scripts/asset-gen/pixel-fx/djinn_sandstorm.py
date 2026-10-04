"""지니 모래 폭풍 allTargets 64x10 — 오른쪽에서 몰아친 모래 회오리가 대상을 감싸 돌며 금빛 모래알이 휘날린다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(48, 32, 24), (255, 240, 190), (236, 204, 130), (206, 160, 90), (150, 106, 60), (196, 255, 238), (104, 210, 200), (255, 222, 92)]
OL, SL, S1, S2, S3, WI, WD, G = 1, 2, 3, 4, 5, 6, 7, 8


def draw(c, f, t):
    cx = lerp(56, 30, ease(min(1, f / 4)))
    h = 40 if f < 8 else 40 - (f - 7) * 10
    for k in range(int(h)):
        u = k / 40
        y = 56 - k
        w = 4 + u * 16
        a = f * .9 + k * .35
        x = cx + math.sin(a) * w * .35
        c.fill(c.ell(x, y, w * .8, 1.3), (S2, S1, S3, S2)[k % 4])
        if k % 6 == 0:
            c.fill(c.seg(x - w, y, x - w * .3, y, 1), SL)
    r = rng(f)
    for _ in range(26):
        a = r.uniform(0, 6.28); d = r.uniform(8, 26)
        c.px(cx + math.cos(a) * d, 40 + math.sin(a) * d * .7, (G, SL, S1)[_ % 3])
    for k in range(3):
        c.fill(c.arc(cx, 34 + k * 8, 18 - k * 3, 1, (f * 40 + k * 90) % 360, (f * 40 + k * 90 + 120) % 360), WI if k % 2 else WD)


make('djinn_sandstorm', 64, 10, 'allTargets', PAL, draw)

