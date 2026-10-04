"""곰 변신(시전자 층) — 64px 8칸. 발밑에서 초록 영기가 소용돌이치며 솟고 → 반투명한 거대한 곰 머리 영혼이 시전자 뒤에 나타나 포효(은빛 눈·송곳니, 충격파) → 곰 형상이 영기 불꽃으로 풀려 시전자 몸에 흡수됨."""
import math
from lib_druid import *

KEY = 'druid_bear_spirit'; FRAME = 64; FRAMES = 8; ANCHOR = 'user'
PAL = Pal(L=LEAF, B=BARK[1:4], M=MOON[3:5])
PEAK = [2, 3, 6]
_r = rng(KEY)
WISPS = [(_r.uniform(0, math.tau), _r.uniform(8, 20), _r.uniform(.6, 1.2)) for _ in range(14)]


def bear(c, s, cx, cy, roar, rim, body, lit, eye):
    """Front-facing bear head: ears, broad skull, muzzle, open jaw when roar."""
    c.disc(cx - 12 * s, cy - 11 * s, 5 * s, rim); c.disc(cx + 12 * s, cy - 11 * s, 5 * s, rim)
    c.disc(cx, cy, 17 * s, rim, 14 * s)
    c.disc(cx - 12 * s, cy - 11 * s, 3.5 * s, body); c.disc(cx + 12 * s, cy - 11 * s, 3.5 * s, body)
    c.disc(cx, cy, 15.5 * s, body, 12.5 * s)
    c.disc(cx - 4 * s, cy - 5 * s, 8 * s, lit, 5 * s)
    c.disc(cx, cy + 5 * s, 7 * s, rim, 6 * s + roar * 2 * s)
    c.disc(cx, cy + 4 * s, 5.5 * s, lit, 4.5 * s)
    c.disc(cx, cy + 1 * s, 2.5 * s, rim, 1.6 * s)   # nose
    if roar:
        c.disc(cx, cy + 9 * s, 4.5 * s, rim, 3 * s)
        for sg in (-1, 1): c.poly([(cx + sg * 3 * s, cy + 6.5 * s), (cx + sg * 2 * s, cy + 10 * s), (cx + sg * 1 * s, cy + 6.5 * s)], eye)
    for sg in (-1, 1):
        c.rect(cx + sg * 7 * s - 1, cy - 4 * s, cx + sg * 7 * s + 1, cy - 3 * s, eye)
        c.px(cx + sg * 7 * s - 2 * sg, cy - 5 * s, eye)


def draw(c, f):
    L, B, M = PAL.L, PAL.B, PAL.M
    cy = CY - 10
    if f <= 1:   # spirit wisps spiral up from the feet
        t = (f + 1) / 2
        c.disc(CX, GY, 16 + f * 6, L[1], 4); c.ring(CX, GY, 20 + f * 6, L[3], 1, 5)
        for a, r, sp in WISPS:
            h = t * (30 + r)
            x = CX + math.cos(a + f * 1.4 * sp) * r * (1 - t * .4)
            y = GY - h * sp * .8
            c.line([(x, y), (x, y + 4)], L[2]); c.px(x, y, L[5])
        c.glow(CX, cy + 4, 4 + f * 4, [L[2], L[3], L[4], L[5]])
        return
    if f <= 4:   # bear spirit manifests and roars
        s = [.8, 1.05, 1.0][f - 2]
        roar = f >= 3
        if f == 3:
            rays(c, CX, cy, 14, 18, 31, L[4], alt=25, rot=.2)
            c.ring(CX, cy, 28, L[5], 2)
        if f == 4: c.dither(lambda cc: cc.ring(CX, cy, 30, L[3], 2), f)
        draw_bear = lambda cc: bear(cc, s, CX, cy, roar, L[1], L[2] if f != 3 else L[3], L[4] if f != 3 else L[5], M[1] if f != 3 else M[0])
        (c.dither(draw_bear, f) if f == 2 else draw_bear(c))
        if f == 2: bear(c, s * .55, CX, cy, 0, L[2], L[3], L[4], M[1])
        for a, r, sp in WISPS[:8]:
            x, y = orbit(CX, cy + 4, 22 + r * .4, a + f * .5, 18)
            c.px(x, y, L[5]); c.px(x, y + 1, L[3])
        return
    u = f - 5   # 0..2 the spirit unravels into green flames sucked into the body
    s = 1 - u * .25
    c.dither(lambda cc: bear(cc, s, CX, cy + u * 4, 0, L[1], L[2], L[3], M[1]), f + u)
    for k, (a, r, sp) in enumerate(WISPS):
        d = (r + 8) * (1 - u * .38)
        x, y = orbit(CX, CY, d, a - u * .8, d * 1.1)
        c.line([(x, y), orbit(CX, CY, d + 5, a - u * .8, (d + 5) * 1.1)], L[3])
        c.px(x, y, L[5] if k % 2 else M[1])
    c.glow(CX, CY, 3 + u * 2, [L[2], L[4], L[6]] if u < 2 else [L[3], L[5]])
    c.ring(CX, GY, 14 + u * 4, L[3] if u < 2 else L[2], 1, 3 + u)


if __name__ == '__main__':
    make(KEY)

