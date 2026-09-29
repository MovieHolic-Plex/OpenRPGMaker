"""나방 인간 인분 뿌리기 allTargets 64x10 — 반짝이는 인분이 오른쪽 위에서 흩날려 대상 위를 덮고 보랏빛으로 스며든다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(40, 28, 40), (255, 255, 220), (252, 242, 150), (222, 204, 150), (206, 140, 255), (132, 76, 204), (90, 196, 214)]
OL, W, DU, WG, PU, PD, SP = 1, 2, 3, 4, 5, 6, 7


def draw(c, f, t):
    r = rng(5)
    n = 50
    for i in range(n):
        sx, sy = r.uniform(34, 70), r.uniform(-8, 14)
        ex, ey = r.uniform(8, 56), r.uniform(18, 56)
        d = r.uniform(0, 0.35)
        u = min(1, max(0, (t * 1.3 + 0.12 - d) / 0.9))
        if u <= 0:
            continue
        x = lerp(sx, ex, ease(u)) + math.sin(i + f * .9) * 2
        y = lerp(sy, ey, u)
        col = (DU, W, WG, SP)[i % 4] if f < 6 else (PU, DU, PD, W)[i % 4]
        c.px(x, y, col)
        if i % 5 == 0:
            c.star(x, y, 1, col)
    if f >= 5:
        g = (f - 4) / 5
        m = c.ell(32, 40, 22 * g + 6, 12 * g + 3)
        c.dith(m, PD, .22)
        c.dith(c.ell(32, 40, 14 * g + 4, 7 * g + 2), PU, .3)
    if f % 3 == 1:
        c.star(20 + f * 2, 30, 2, W, DU)


make('mothman_scale_dust', 64, 10, 'allTargets', PAL, draw)

