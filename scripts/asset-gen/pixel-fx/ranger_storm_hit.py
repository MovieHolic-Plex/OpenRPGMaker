"""ranger_storm_hit: 폭풍의 화살 착탄. Lightning strikes down onto each enemy, a cyan-violet electric sphere pops, arcs crawl over the body and fade to sparks.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'ranger_storm_hit', 64, 8, 'allTargets'
PAL = pal(STORM, WHITE, pick(SMOKE, 'q1', 'q2'))
CX, CY, FEET = 32, 36, 56


def draw(c, f):
    if f == 0:
        c.bolt((40, 0), (CX, CY), seed=1, keys=['z1', 'z3', 'w'], segs=6, jitter=5, widths=[5, 3, 1])
        c.spark(CX, CY, 6, 'w', 'zy')
    elif f == 1:
        c.bolt((38, 0), (CX, FEET), seed=2, keys=['z1', 'z3', 'w'], segs=7, jitter=6, widths=[7, 3, 1])
        c.disc(CX, CY, 12, 'z1')
        c.disc(CX, CY, 9, 'z3')
        c.disc(CX, CY, 5, 'w')
        c.rays(CX, CY, 12, 12, 22, 'zy', rot=0.1, jitter=[1, 0.6, 0.8])
    elif f == 2:
        c.disc(CX, CY, 18, 'z0')
        c.disc(CX, CY, 16, 'z1')
        c.ring(CX, CY, 16, 'z3', 2)
        c.disc(CX, CY, 9, 'z2')
        c.disc(CX - 1, CY - 1, 5, 'z4')
        c.disc(CX - 1, CY - 1, 2, 'w')
        for i in range(6):
            a = i * math.pi / 3 + 0.3
            c.bolt(pol(CX, CY, 6, a), pol(CX, CY, 25, a + 0.2), seed=10 + i, keys=['z3', 'w'], segs=4, jitter=3, widths=[2, 1])
    elif f == 3:
        c.ring(CX, CY, 22, 'z2', 2)
        c.ring(CX, CY, 20, 'z4', 1)
        for i in range(5):
            a = i * 2 * math.pi / 5 + 0.7
            c.bolt(pol(CX, CY, 4, a), pol(CX, CY, 18, a - 0.3), seed=20 + i, keys=['z1', 'z3', 'z4'], segs=4, jitter=4, widths=[3, 1, 1])
        c.spark(CX, CY, 8, 'w', 'zy', diag=True)
        c.oval(CX, FEET, 20, 3, 'z1', 1)
    elif f == 4:
        c.dring(CX, CY, 26, 'z2')
        for i in range(4):
            a = i * math.pi / 2 + 1.1
            c.bolt(pol(CX, CY, 10, a), pol(CX, CY, 20, a + 0.5), seed=30 + i, keys=['z1', 'z4'], segs=3, jitter=3, widths=[2, 1])
        c.spark(CX + 6, CY - 8, 4, 'w', 'z4')
        c.spark(CX - 8, CY + 6, 3, 'zy')
    elif f == 5:
        c.dring(CX, CY, 28, 'z1', 1)
        for i in range(3):
            a = i * 2.1 + 0.4
            c.bolt(pol(CX, CY, 8, a), pol(CX, CY, 15, a + 0.4), seed=40 + i, keys=['z3'], segs=3, jitter=2, widths=[1])
        c.cloud(CX, 18, 7, ['q1', 'q2'], seed=2, lobes=5)
    elif f == 6:
        for x, y in [(20, 28), (44, 40), (30, 50), (40, 20), (24, 44)]:
            c.spark(x, y, 2, 'z4', 'z2')
        c.cloud(CX + 2, 12, 6, ['q1', 'q2'], seed=3, lobes=5, parity=1)
    elif f == 7:
        for x, y in [(16, 30), (48, 36), (34, 16)]:
            c.spark(x, y, 1, 'z3')
        c.ddisc(CX + 3, 8, 5, 'q1')


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, T=3)


if __name__ == '__main__':
    run(globals())

