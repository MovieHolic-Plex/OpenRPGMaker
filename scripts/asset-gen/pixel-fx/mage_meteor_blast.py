"""메테오 착탄 — 64px 10칸, 적마다. 경고 그림자·낙하 → 섬광 → 불기둥과 돌 파편 → 버섯 연기·불씨. meteor_rock 과 같은 FIRE+ROCK."""
import math, random
from lib_mage import *

KEY = 'mage_meteor_blast'; FRAME = 64; FRAMES = 10; ANCHOR = 'allTargets'
PAL = Pal(F=FIRE[1:], R=ROCK, S=SMOKE[1:])
PEAK = [2, 4, 7]
CX, FY = 32, 55
_r = random.Random(17)
DEBRIS = [(_r.uniform(math.pi * 1.1, math.pi * 1.9), _r.uniform(3, 6), _r.randint(1, 2)) for _ in range(12)]
EMBERS = [(_r.uniform(0, 64), _r.uniform(.5, 1.5)) for _ in range(12)]


def rock(c, x, y, r):
    R, F = PAL.R, PAL.F
    c.disc(x, y, r + 2, F[3]); c.disc(x, y, r + 1, F[5])
    c.disc(x, y, r, R[0]); c.disc(x - 1, y - 1, r - 1, R[1]); c.px(x - 2, y - 2, R[2])


def draw(c, f):
    F, R, S = PAL.F, PAL.R, PAL.S   # F: 0 dark red .. 6 white
    if f <= 1:  # warning glow on the ground + rock plunging from upper right
        c.disc(CX, FY, 10 + f * 6, F[0], 3 + f); c.disc(CX, FY, 5 + f * 4, F[2], 1 + f)
        x, y = (54, 6) if f == 0 else (40, 30)
        for k in range(6, 0, -1):
            c.disc(x + k * 3, y - k * 4, 5 - k * .6, [F[1], F[2], F[3]][min(2, 3 - k // 2)])
        rock(c, x, y, 5)
        return
    if f == 2:  # impact flash
        c.disc(CX, FY - 12, 22, F[4], 18); c.disc(CX, FY - 12, 16, F[5], 13); c.disc(CX, FY - 10, 10, F[6], 8)
        for k in range(6):
            a = math.pi + k * math.pi / 5
            c.line([(CX, FY - 8), orbit(CX, FY - 8, 34, a)], F[5], 2)
        return
    t = f - 3
    # ground shock ring
    rr = 14 + t * 5
    ring = lambda cc: (cc.ring(CX, FY, rr, F[4] if t < 2 else F[2], 2, rr * .28))
    (ring(c) if t < 3 else c.dither(ring, t))
    # mushroom: fire column then smoke cap
    if t <= 3:
        h = [30, 40, 44, 40][t]; w = [11, 12, 10, 8][t]
        c.poly([(CX - w - 4, FY), (CX - w, FY - h * .5), (CX - w * .6, FY - h), (CX + w * .6, FY - h), (CX + w, FY - h * .5), (CX + w + 4, FY)], F[2])
        c.poly([(CX - w + 2, FY), (CX - w * .5, FY - h * .8), (CX + w * .5, FY - h * .8), (CX + w - 2, FY)], F[3])
        c.poly([(CX - 4, FY), (CX - 2, FY - h * .6), (CX + 2, FY - h * .6), (CX + 4, FY)], F[5] if t < 2 else F[4])
        cap = FY - h
        for k in range(5):
            x = CX - 12 + k * 6; y = cap + (k % 2) * 3
            c.disc(x, y, 6 + t, F[1] if t < 2 else S[0]); c.disc(x - 1, y - 1, 4 + t * .6, F[3] if t < 2 else S[1])
        for k in range(4):
            flame(c, CX - 18 + k * 12, FY, 12 - t * 2 + (k % 2) * 4, 4, [F[2], F[3], F[5]], lean=(k - 1.5) * 2)
    else:
        u = t - 3
        for k in range(5):
            x = CX - 12 + k * 6 + (k - 2) * u * 2; y = FY - 38 - u * 4 + (k % 2) * 3
            c.dither(lambda cc: (cc.disc(x, y, 8 - u, S[0]), cc.disc(x - 1, y - 1, 5 - u, S[1])), k + u)
        c.disc(CX, FY, 8 - u * 2, F[1], 2)
    # rock debris arcs
    for a, v, s in DEBRIS:
        x = CX + math.cos(a) * v * (t + 1) * 2; y = FY - 6 + math.sin(a) * v * (t + 1) * 2.2 + (t + 1) ** 2 * 1.4
        if y > FY + 4: continue
        c.rect(x, y, x + s, y + s, R[1]); c.px(x, y, F[4] if t < 3 else R[2])
    for x0, sp in EMBERS:
        y = FY - 10 - ((t * 7 * sp + x0) % 40)
        c.px(x0, y, F[5] if (t + int(x0)) % 3 else F[3])


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, T=4)


if __name__ == '__main__':
    make(KEY)

