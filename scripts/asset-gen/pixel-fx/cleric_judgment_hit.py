"""신의 심판 착탄 — 64px 8칸, 적마다. 작은 성십자가 꽂힘 → 십자 섬광·빛기둥 → 바닥 십자 균열이 빛나다 사그라듦. cleric_judgment_cross 와 같은 HOLY."""
import math, random
from lib_mage import *

KEY = 'cleric_judgment_hit'; FRAME = 64; FRAMES = 8; ANCHOR = 'allTargets'
PAL = Pal(H=HOLY, R=['#c8402a'])
PEAK = [1, 3, 5]
CX, FY, CY = 32, 55, 38
_r = random.Random(33)
SPARKS = [(_r.uniform(math.pi * 1.05, math.pi * 1.95), _r.uniform(3, 6)) for _ in range(12)]


def mini_cross(c, x, top, lit):
    H = PAL.H
    c.rect(x - 3, top - 1, x + 3, top + 30, H[0]); c.rect(x - 11, top + 6, x + 11, top + 12, H[0])
    c.rect(x - 2, top, x + 2, top + 29, H[2]); c.rect(x - 10, top + 7, x + 10, top + 11, H[2])
    c.rect(x - 1, top + 1, x - 1, top + 27, H[4 if not lit else 5]); c.rect(x - 9, top + 8, x + 9, top + 8, H[4 if not lit else 5])
    c.poly([(x - 2, top + 29), (x + 2, top + 29), (x, top + 33)], H[3])


def draw(c, f):
    H = PAL.H
    if f == 0:
        c.poly([(CX - 5, 0), (CX + 5, 0), (CX + 3, 24), (CX - 3, 24)], H[2])
        mini_cross(c, CX, 4, False)
        return
    if f == 1:  # plant + big cross flash
        c.disc(CX, CY, 22, H[3], 20); c.disc(CX, CY, 15, H[4], 14)
        c.rect(CX - 3, 0, CX + 3, FY, H[5]); c.rect(4, CY - 3, 60, CY + 3, H[5])
        c.rect(CX - 6, CY - 6, CX + 6, CY + 6, H[5])
        return
    t = f - 2   # 0..5
    # glowing cross-shaped ground crack
    crack = lambda cc: (cc.line([(CX - 26 + t, FY), (CX + 26 - t, FY)], H[4] if t < 3 else H[2], 2),
                        cc.line([(CX, FY - 6), (CX, FY + 6)], H[4] if t < 3 else H[2], 2),
                        cc.line([(CX - 14, FY - 3), (CX - 20, FY - 5)], H[3]), cc.line([(CX + 14, FY + 3), (CX + 21, FY + 4)], H[3]))
    (crack(c) if t < 4 else c.dither(crack, t))
    if t <= 3:
        w = [9, 7, 5, 3][t]
        c.poly([(CX - w, 0), (CX + w, 0), (CX + w + 3, FY), (CX - w - 3, FY)], H[2])
        c.poly([(CX - w + 3, 0), (CX + w - 3, 0), (CX + w - 1, FY), (CX - w + 1, FY)], H[4])
        mini_cross(c, CX, FY - 33 + t, lit=(t == 0))
        rr = 12 + t * 7
        c.ring(CX, FY, rr, H[3], 2 if t < 2 else 1, rr * .3)
    for a, v in SPARKS:
        d = v * (t + 1) * 2
        x, y = orbit(CX, FY - 8, d, a); y += (t + 1) ** 2 * .8
        if y > FY + 2: continue
        c.line([orbit(CX, FY - 8, d - 3, a), (x, y)], H[5] if t < 2 else H[3])
    if t >= 3:
        for k in range(4):
            c.spark(CX - 15 + k * 10, FY - 14 - (t - 3) * 9 - (k % 2) * 5, 1, H[4])


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, T=12, R=3)


if __name__ == '__main__':
    make(KEY)

