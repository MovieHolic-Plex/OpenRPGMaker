"""별빛 착탄 — 64px 8칸, 적마다. 별이 꽂힘 → 별 섬광·고리 → 작은 별 파편이 튀어 반짝이며 사라짐. starfall_sky 와 같은 STAR 팔레트."""
import math, random
from lib_mage import *

KEY = 'mage_star_hit'; FRAME = 64; FRAMES = 8; ANCHOR = 'allTargets'
PAL = Pal(S=STAR, A=ARCANE[1:5], N=NIGHT[2:])
PEAK = [2, 4]
CX, CY = 32, 42
_r = random.Random(9)
BITS = [(k * math.tau / 9 + _r.uniform(-.2, .2), _r.uniform(3.5, 5.5)) for k in range(9)]


def draw(c, f):
    S, A = PAL.S, PAL.A
    if f <= 1:  # star plunging from upper right
        x, y = (CX + 22 - f * 16, CY - 32 + f * 22)
        c.line([(x, y), (x + 20, y - 18)], S[1], 3); c.line([(x, y), (x + 14, y - 12)], S[5], 2); c.line([(x, y), (x + 7, y - 6)], S[3])
        c.star5(x, y, 6, S[2], rot=f * .6); c.star5(x, y, 3, S[4], rot=f * .6)
        if f == 1: c.disc(CX, CY + 12, 8, A[1], 2)
        return
    if f == 2:  # flash
        c.glow(CX, CY, 18, [A[0], A[1], S[1], S[2], S[3], S[4]])
        c.star5(CX, CY, 24, S[2], rot=.1, inner=.32)
        c.star5(CX, CY, 16, S[3], rot=.1, inner=.32)
        c.star5(CX, CY, 8, S[4], rot=.1, inner=.4)
        return
    t = f - 2
    rr = 12 + t * 6
    ring = lambda cc: (cc.ring(CX, CY, rr, S[5] if t < 3 else A[2], 2 if t < 2 else 1), cc.ring(CX, CY, rr - 4, S[6] if t < 2 else A[1]))
    (ring(c) if t < 4 else c.dither(ring, t))
    if t <= 2: c.star5(CX, CY, 12 - t * 3, S[2 if t else 3], rot=.1 + t * .5); c.star5(CX, CY, 5 - t, S[4], rot=.1 + t * .5)
    for k, (a, v) in enumerate(BITS):
        d = v * t * 2.2 + 6
        x, y = orbit(CX, CY, d, a); y += t * t * .6
        s = max(1, 4 - t * .6)
        col = [S[2], S[5], S[6]][k % 3] if t < 4 else A[2]
        c.star5(x, y, s + 1, col, rot=a + t) if s >= 2 else c.spark(x, y, 1, col)
        if t < 3: c.px(x, y, S[4])
    if t >= 3:
        for k in range(4):
            x, y = orbit(CX, CY - 6, 16 + k * 3, k * 1.6 + t)
            c.spark(x, y, 2 if (k + t) % 2 else 1, S[3])


if __name__ == '__main__':
    make(KEY)

