"""개미귀신(mound) 이펙트 2종 — b5. 색: 모래 황토·갈색, 그늘 암갈, 모래알 크림, 분홍 아가리.
모래 늪(대상 발밑에 깔때기 모양 모래 늪이 돌며 가라앉게 함) · 대지의 아가리(사막 전체가 갈라지며 거대한 턱이 솟아 닫힘)."""
from lib_r2w5 import *

P_PIT = Pal(S=['#3a2414', '#6a4a2a', '#a07a4a', '#d8b888', '#f0e0c0'], M=['#a3355f'])


@sheet('mound_pit', 64, 10, 'allTargets', P_PIT, peak=[2, 5, 8])
def mound_pit(c, f):
    S, M = P_PIT.S, P_PIT.M[0]
    g = min(1, (f + 1) / 4) * (1 if f < 9 else .8)
    cx, cy = CX, GY - 4
    for k, col in enumerate((S[2], S[1], S[0])):
        rx = (26 - k * 8) * g
        c.disc(cx, cy, rx, col, rx * .32)
    # 소용돌이 모래 줄
    for k in range(6):
        a0 = k * math.tau / 6 + f * .5
        pts = []
        for i in range(8):
            t = i / 7
            a = a0 + t * 2.4
            r = (24 - t * 20) * g
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r * .32))
        c.line(pts, S[3])
    c.disc(cx, cy, 3 * g, S[0], 1.2 * g)
    if f >= 5:
        c.rect(cx - 3, cy - 1, cx + 3, cy, M)
    for k in range(8):
        a = k * math.tau / 8 + f * .7
        r = 28 * g
        c.px(cx + math.cos(a) * r, cy + math.sin(a) * r * .32 - (f % 3), S[4])


P_MAW = Pal(N=['#2a1408', '#5a3418', '#8a5a2a'], S=['#a07a4a', '#d8b888', '#f0e0c0'], K=['#1a0c04'], M=['#6a1a3a', '#a3355f', '#e07aa0'], W=['#f0e8d0'], E=['#fff08a'])


@sheet('mound_maw_sky', 128, 12, 'screen', P_MAW, peak=[3, 7, 10])
def mound_maw_sky(c, f):
    N, S, K, M, W, E = P_MAW.N, P_MAW.S, P_MAW.K[0], P_MAW.M, P_MAW.W[0], P_MAW.E[0]
    c.rect(0, 0, 127, 127, N[1]); c.dither(lambda cc: cc.rect(0, 0, 127, 36 + f % 3 * 4, N[0]), f)
    c.rect(0, 60, 127, 127, S[0]); c.dither(lambda cc: cc.rect(0, 60, 127, 76, S[1]), 1)
    open_ = [0, .2, .45, .75, 1, 1, 1, .9, .5, .15, .05, 0][f]
    rise = [0, 4, 10, 18, 24, 26, 26, 24, 18, 10, 4, 0][f]
    cx, cy = 64, 96 - rise
    # 턱 두 장(위·아래)이 벌어졌다 닫힘
    gap = open_ * 30
    for sg in (-1, 1):
        y0 = cy + sg * gap * .5
        pts = [(cx - 50, y0), (cx - 30, y0 + sg * 18), (cx + 30, y0 + sg * 18), (cx + 50, y0)]
        c.poly(pts, S[0] if sg < 0 else N[2])
        c.line([(cx - 50, y0), (cx + 50, y0)], K, 2)
        for k in range(9):
            x = cx - 44 + k * 11
            c.poly([(x - 3, y0), (x, y0 - sg * (8 + (k % 2) * 4)), (x + 3, y0)], W)
    if gap > 2:
        c.disc(cx, cy, 44, M[0], gap * .5 - 1)
        c.disc(cx, cy + 2, 30, M[1], max(1, gap * .3))
        c.disc(cx, cy + 3, 12, M[2], max(1, gap * .12))
    # 눈(모래 위 둘)
    for x in (cx - 26, cx + 26):
        c.disc(x, cy - gap * .5 - 22, 4, K); c.disc(x, cy - gap * .5 - 22, 2, E)
    # 흘러내리는 모래
    for k in range(14):
        x = (k * 9 + f * 3) % 128
        y = 60 + ((k * 17 + f * 7) % 30)
        c.rect(x, y, x + 1, y + 1, S[2] if k % 2 else S[1])
    if f in (9, 10):
        for k in range(10):
            a = math.radians(180 + k * 18)
            c.rect(cx + math.cos(a) * 54, cy + math.sin(a) * 20, cx + math.cos(a) * 54 + 2, cy + math.sin(a) * 20 + 2, S[2])

