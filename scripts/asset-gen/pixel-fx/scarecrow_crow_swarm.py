import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""허수아비 까마귀 떼 — 적마다 까마귀 떼가 소용돌이로 몰려들어 쪼고, 검은 깃털이 떨어진다. 64×10, allTargets."""
KEY, SIZE, FRAMES = 'scarecrow_crow_swarm', 64, 10
PAL = ['0e0c14', '26242e', '4a4858', 'ff8020', 'f8c040', 'ffffff']
O, K, KL, E, BK, W = range(1, 7)


def crow(c, x, y, flap, left=True):
    s = -1 if left else 1
    wy = (-4, 0, 3)[flap]
    c.ell(x, y, 3, 1.8, K)
    c.ell(x + s * 3, y - 1, 1.8, 1.6, K)
    c.px(x + s * 5, y - 1, BK)
    c.line([(x, y), (x - s * 2, y + wy)], KL)
    c.line([(x - s * 1, y), (x - s * 4, y + wy + (1 if wy < 0 else -1))], K)
    c.px(x + s * 3, y - 2, E)


def draw(c, f, t):
    r = max(24 - f * 2.4, 6) if f < 7 else 6 + (f - 7) * 6
    for k in range(7):
        a = k * 2 * math.pi / 7 + f * .7
        x = 32 + math.cos(a) * r
        y = 32 + math.sin(a) * r * .7
        crow(c, x, y, (k + f) % 3, math.sin(a) > 0)
    c.outline(O, [K, KL])
    if 4 <= f <= 7:
        for k in range(3):
            c.star(26 + k * 6, 28 + (k % 2) * 6 + (f % 2), 2, W, E)
    if f >= 5:
        for k in range(4):
            x = 18 + k * 9
            y = 36 + (f - 5) * 3 + (k % 2) * 4
            c.line([(x, y), (x + 2, y + 2)], KL)


run(globals())

