"""대지의 속박 — 64px 10칸(적 전체). 땅이 갈라지며 흙이 튀고 → 굵은 뿌리가 아치로 솟아 교차하며 몸을 묶고 조임 섬광 → 뿌리가 단단히 감긴 채 흙먼지와 이끼 입자가 가라앉음."""
import math
from lib_druid import *

KEY = 'druid_roots'; FRAME = 64; FRAMES = 10; ANCHOR = 'allTargets'
PAL = Pal(B=BARK, L=LEAF[:6], M=MOON[3:5])
PEAK = [2, 5, 8]
_r = rng(KEY)
ROOTS = [(-22, 14, 30, 1), (22, -14, 28, -1), (-16, 18, 20, 1), (18, -12, 14, -1), (-6, 22, 36, 1)]  # base dx, end dx, height, dir
DIRT = [(_r.uniform(-24, 24), _r.uniform(2, 5), _r.uniform(-1, 1)) for _ in range(16)]


def root(c, dx, ex, h, g, grip, wither=False):
    B, L = PAL.B, PAL.L
    pts = []
    n = 10
    for i in range(n + 1):
        u = g * i / n
        x = CX + lerp(dx, ex * (1 - grip * .35), u) + math.sin(u * math.pi) * 2
        y = GY - math.sin(u * math.pi * .9) * h
        pts.append((x, y))
    vine(c, pts, 5, 2, B[0], B[1] if wither else B[2], B[3])
    if not wither:
        for i in range(1, len(pts) - 1, 3): c.px(pts[i][0], pts[i][1] - 2, L[3]); c.px(pts[i][0] + 1, pts[i][1] - 2, L[2])
    x, y = pts[-1]
    c.px(x, y, B[3])


def draw(c, f):
    B, L, M = PAL.B, PAL.L, PAL.M
    # cracked earth patch
    w = [10, 18, 24, 26, 26, 26, 26, 24, 22, 20][f]
    c.disc(CX, GY + 1, w, B[0], 3 + w * .08)
    cr = [(CX - w, GY), (CX - w * .5, GY + 2), (CX - 3, GY - 1), (CX + w * .4, GY + 2), (CX + w, GY)]
    c.line(cr, L[3] if f < 5 else B[1])
    if f <= 1:
        c.line(cr[1:4], L[5])
        for k, (x, v, s) in enumerate(DIRT[:8 + f * 6]):
            y = GY - 2 - v * (f + 1)
            c.rect(CX + x * .6, y, CX + x * .6 + 1, y + 1, B[2 + k % 2])
        return
    if f <= 4:   # roots arch out and cross
        g = [0, 0, .45, .8, 1][f]
        for k, (x, v, s) in enumerate(DIRT):
            u = f - 1
            y = GY - 4 - v * 3 * u + u * u * 1.6
            if y < GY: c.rect(CX + x + s * u * 2, y, CX + x + s * u * 2 + 1, y + 1, B[2 + k % 2])
        for dx, ex, h, d in ROOTS: root(c, dx, ex, h, g, 0)
        if f == 4:
            for dx, ex, h, d in ROOTS[:3]: c.spark(CX + ex, GY - h * .3, 3, L[4], L[5])
        return
    if f == 5:   # grip: flash at the crossing, drawn over the tightened roots
        rays(c, CX, CY, 10, 8, 30, L[3], alt=20, rot=.3)
        for dx, ex, h, d in ROOTS: root(c, dx, ex, h, 1, 1)
        c.disc(CX, CY - 2, 9, L[2]); c.disc(CX, CY - 2, 7, L[4]); c.disc(CX, CY - 2, 4, L[5]); c.disc(CX, CY - 2, 2, M[1])
        for k in range(4): c.spark(*orbit(CX, CY - 2, 14, k * math.pi / 2 + .6), 3, L[5], M[1])
        c.ring(CX, GY, 30, L[4], 1, 6)
        return
    u = f - 6   # 0..3 held tight; dust and moss motes settle
    for k in range(4):   # dust rolls out to both sides, dithered
        sd = -1 if k % 2 else 1
        x = CX + sd * (22 + u * 3 + (k // 2) * 5); y = GY - 2 - (k // 2) * 3 - u
        c.dither(lambda cc, x=x, y=y: puff(cc, x, y, 3 + u * .6, [B[1], B[2]]), k + f)
    for dx, ex, h, d in ROOTS: root(c, dx, ex, h * (1 - u * .04), 1, 1 - u * .1 + (u % 2) * .06, wither=u >= 2)
    if u == 0: c.ring(CX, GY, 26, L[3], 1, 5)
    for k, (x, v, s) in enumerate(DIRT):
        if (k + u) % 3: continue
        c.px(CX + x, CY - 10 + v * 4 + u * 4, L[4] if k % 2 else M[0])


if __name__ == '__main__':
    make(KEY)

