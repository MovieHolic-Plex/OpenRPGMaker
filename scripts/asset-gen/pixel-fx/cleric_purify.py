"""정화 — 64px 10칸, 대상 아군 위. 빛 고리 세 개가 발밑에서 몸을 훑고 올라감 → 어두운 기운 조각이 밀려나 부서짐 → 물빛 반짝임."""
import math, random
from lib_mage import *

KEY = 'cleric_purify'; FRAME = 64; FRAMES = 10; ANCHOR = 'target'
SIDE = 'ally'   # 검토 합성판에서 아군 위에 얹는다(시트 자체는 대상 기준)
PAL = Pal(H=HOLY[2:], A=AQUA, D=FILTH)
PEAK = [2, 5, 8]
CX, FY, CY = 32, 55, 38
_r = random.Random(6)
GRIME = [(_r.uniform(0, math.tau), _r.uniform(6, 12)) for _ in range(10)]


def band(c, y, r, lit):
    H, A = PAL.H, PAL.A
    c.arc(CX, y, r, 180, 360, A[1], 1, r * .3)          # back half, darker
    c.arc(CX, y, r, 0, 180, A[3] if lit else A[2], 2, r * .3)   # front half, bright
    for k in range(4):
        x, yy = orbit(CX, y, r, k * math.pi / 2 + y * .2, r * .3)
        c.px(x, yy, H[3])


def draw(c, f):
    H, A, D = PAL.H, PAL.A, PAL.D
    # dark grime clinging to the body early, then pushed out and shattered
    if f <= 6:
        for k, (a, r) in enumerate(GRIME):
            push = 0 if f < 3 else (f - 2) * 4
            x, y = orbit(CX, CY + 2, r + push, a, (r + push) * 1.1)
            if f >= 5 and k % 2: continue
            s = 2 if f < 5 else 1
            c.disc(x, y, s + 1, D[0]); c.disc(x, y, s, D[1] if f < 4 else D[2])
    rings = [(0, 22), (1, 18), (2, 15)]
    for i, r in rings:
        t = f - i * 1.3
        if 0 <= t <= 5.5:
            y = FY - t * 8
            band(c, y, r - t * .6, lit=(1 < t < 3))
    if 3 <= f <= 6:  # cleansing flash across the chest
        s = [4, 9, 7, 4][f - 3]
        c.spark(CX, CY - 2, s, H[3], diag=True); c.spark(CX, CY - 2, max(1, s // 3), H[2])
    if f == 5:
        c.ring(CX, CY, 24, A[2], 1, 26)
    if f >= 6:  # droplet sparkles fall away, water-like afterglow
        t = f - 6
        for k in range(8):
            x = CX - 20 + k * 6 + (k % 2) * 2
            y = 18 + t * 6 + (k * 7) % 14
            if y > FY: continue
            c.px(x, y, A[3] if (k + t) % 2 else H[3]); c.px(x, y + 1, A[2])
            if t < 2 and k % 3 == 0: c.spark(x, y, 2, A[3])
        c.dither(lambda cc: cc.disc(CX, FY, 20 - t * 3, A[1], 5 - t * .6), t)
        for k in range(4 - t // 2):
            x, y = orbit(CX, CY, 26 + t * 3, k * 1.5 + t, 28 + t * 3)
            c.rect(x, y, x + 1, y + 1, D[1])


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, B=3)


if __name__ == '__main__':
    make(KEY)

