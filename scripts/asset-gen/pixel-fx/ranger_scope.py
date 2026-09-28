"""ranger_scope: 저격 조준. A green-gold reticle closes in on the target, rotates and locks with a red flash.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'ranger_scope', 64, 8, 'target'
PAL = pal(pick(LEAF, 'l1', 'l2', 'l3', 'l4'), pick(CRIMSON, 'r0', 'r1', 'r2'), pick(GOLD, 'y2'), WHITE)
CX, CY = 32, 34


def reticle(c, r, rot, ring, tick, gap=5):
    c.ring(CX, CY, r, ring, 1)
    for i in range(4):
        a = rot + i * math.pi / 2
        c.line([pol(CX, CY, r - 4, a), pol(CX, CY, r + 5, a)], tick, 2)
        c.line([pol(CX, CY, gap, a), pol(CX, CY, r - 6, a)], tick)
    for i in range(4):
        a = rot + math.pi / 4 + i * math.pi / 2
        c.px(*pol(CX, CY, r + 2, a), tick)


def brackets(c, s, k):
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = CX + sx * s, CY + sy * s
            c.line([(x, y), (x - sx * 5, y)], k, 2)
            c.line([(x, y), (x, y - sy * 5)], k, 2)


def draw(c, f):
    rot = [0.8, 0.55, 0.3, 0.12, 0.0, 0.0, 0.0, 0.0][f]
    r = [28, 23, 18, 15, 13, 13, 14, 16][f]
    if f < 4:
        c.dring(CX, CY, r + 3, 'l1', parity=f)
        reticle(c, r, rot, 'l2', 'l3')
        brackets(c, r + 2, 'l1')
        c.px(CX, CY, 'l4')
    elif f == 4:
        reticle(c, r, 0, 'r1', 'r2', gap=3)
        brackets(c, 17, 'r1')
        c.spark(CX, CY, 3, 'w', 'r2')
    elif f == 5:
        c.ring(CX, CY, 20, 'r1', 2)
        reticle(c, r, 0, 'r2', 'w', gap=3)
        brackets(c, 19, 'r2')
        c.spark(CX, CY, 9, 'w', 'r2', diag=True)
        c.rays(CX, CY, 8, 22, 28, 'r1', rot=0.39)
    elif f == 6:
        reticle(c, r, 0, 'r1', 'r2', gap=3)
        c.dring(CX, CY, 24, 'r1')
        c.disc(CX, CY, 2, 'r2')
        c.px(CX, CY, 'w')
    elif f == 7:
        reticle(c, r, 0, 'r0', 'r1', gap=3)
        c.disc(CX, CY, 3, 'r1')
        c.disc(CX, CY, 1, 'y2')
        c.dring(CX, CY, 27, 'r0', 1)


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, R=3)


if __name__ == '__main__':
    run(globals())

