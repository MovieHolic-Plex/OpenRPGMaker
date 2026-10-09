"""곰 할퀴기(대상 층) — 64px 8칸. 곰 발 모양 영기가 위에서 덮치고 → 초록 섬광과 굵은 세 줄 발톱 자국(흰 코어·초록·갈색 가장자리)이 사선으로 찢음, 흙·털 조각이 튐 → 자국이 초록 잔광으로 갈라져 흩어짐."""
import math
from lib_druid import *

KEY = 'druid_claw'; FRAME = 64; FRAMES = 8; ANCHOR = 'target'
PAL = Pal(L=LEAF, B=BARK, M=MOON[3:5])
PEAK = [1, 3, 5]
_r = rng(KEY)
CHIPS = [(_r.uniform(-.9, .9) - math.pi / 4, _r.uniform(2.5, 5), _r.randint(0, 2)) for _ in range(14)]
# three claw gashes from upper right to lower left (enemy faces the ally on the right)
GASH = [(-8, 0), (0, 0), (8, 0)]


def gash(c, off, g, cols, w):
    x0, y0 = CX + 18 + off * .7, CY - 22 + off * .7
    x1, y1 = CX - 18 + off * .7, CY + 16 + off * .7
    xe, ye = lerp(x0, x1, g), lerp(y0, y1, g)
    for col, ww in zip(cols, w):
        pts = [(x0, y0), (lerp(x0, xe, .5) + 1, lerp(y0, ye, .5)), (xe, ye)]
        c.line(pts, col, ww)
    c.px(x0, y0, cols[-1])


def paw(c, x, y, s, rim, body, pad):
    c.disc(x, y, 8 * s, rim, 7 * s); c.disc(x, y, 6.5 * s, body, 5.5 * s)
    c.disc(x, y + 1, 3.5 * s, pad, 3 * s)
    for k in range(4):
        a = -math.pi * (.15 + k * .23)
        tx, ty = orbit(x, y, 8.5 * s, a)
        c.disc(tx, ty, 2 * s, rim); c.disc(tx, ty, 1.2 * s, pad)


def draw(c, f):
    L, B, M = PAL.L, PAL.B, PAL.M
    if f == 0:
        paw(c, CX + 18, CY - 20, 1.1, L[1], L[2], L[4])
        for k in range(5): c.line([(CX + 24 + k * 3, CY - 34 + k), (CX + 18 + k * 3, CY - 26 + k)], L[3])
        return
    if f == 1:
        paw(c, CX + 6, CY - 8, 1.4, L[1], L[3], L[5])
        c.dither(lambda cc: paw(cc, CX + 16, CY - 18, 1.2, L[1], L[2], L[3]), f)
        return
    if f == 2:   # rake
        c.disc(CX, CY - 2, 20, L[3], 18); c.disc(CX, CY - 2, 15, L[4], 13); c.disc(CX, CY - 2, 9, L[5], 8)
        for off, _ in GASH: gash(c, off, 1, [L[1], L[6]], [5, 2])
        rays(c, CX, CY - 2, 8, 20, 30, L[4], rot=.4)
        return
    t = f - 3   # 0..4
    if t == 0:
        rays(c, CX, CY - 2, 12, 12, 30, L[4], rot=.1, alt=22)
    for i, (off, _) in enumerate(GASH):
        if t <= 1:
            gash(c, off, 1, [B[0], L[2], L[4], L[6]], [7, 5, 3, 1])
        else:
            fade(c, t >= 3, lambda cc, off=off: gash(cc, off, 1 - (t - 2) * .3, [L[1], L[3]] if t < 4 else [L[1]], [4, 2]), f + i)
    for k, (a, v, kind) in enumerate(CHIPS):
        e = t + 1
        x = CX + math.cos(a + math.pi) * v * e * 2.2; y = CY + math.sin(a + math.pi) * v * e * 1.5 + e * e * .8
        if kind == 0: c.rect(x, y, x + 1, y + 1, B[2 if e < 4 else 1])
        elif kind == 1: c.line([(x, y), (x + 2, y - 1)], L[4] if e < 3 else L[2])
        elif e < 4 or (k + f) % 2: c.px(x, y, M[0] if e < 3 else L[3])
    if t <= 1: c.ring(CX, CY - 2, 24 + t * 6, L[5] if t == 0 else L[3], 1, 20 + t * 5)


if __name__ == '__main__':
    make(KEY)

