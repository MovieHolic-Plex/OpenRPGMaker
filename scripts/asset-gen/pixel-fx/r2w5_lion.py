"""사자(lion) 이펙트 시트 2종 — retro2003 로스터 b1. 색: 황토·금빛 갈기, 짙은 갈색 윤곽, 태양 금·흰 섬광.
발톱 후려치기(큰 황금 앞발이 호를 그리며 쓸고, 네 줄 자국과 금가루) · 백수의 왕(태양 관 뒤로 햇살, 갈기 사자왕 머리가 떠오름)."""
from lib_r2w5 import *

P_SWIPE = Pal(O=['#311800', '#6a2000', '#8b5210'], Y=['#b47b31', '#d5a462', '#f6bd7b', '#ffd5a4'], G=['#ffd23a', '#fff6de'], W=['#ffffff'])


@sheet('lion_swipe', 64, 8, 'target', P_SWIPE, peak=[1, 3, 5])
def lion_swipe(c, f):
    O, Y, G, W = P_SWIPE.O, P_SWIPE.Y, P_SWIPE.G, P_SWIPE.W[0]
    # 호: 오른쪽 위(각 -40°) → 왼쪽 아래(각 150°)
    a_now = [-40, 20, 80, 130, 150, 150, 150, 150][f]
    if 1 <= f <= 3:
        # 얇은 금빛 궤적 호 + 호 끝의 앞발(발바닥이 적 쪽을 본다)
        crescent(c, 34, 30, 22, -40, a_now, 3.5, [Y[0], G[0], G[1]], u=1.0, tail=.35 if f == 3 else 0)
    a = math.radians(a_now)
    px_, py_ = 34 + math.cos(a) * 22, 30 + math.sin(a) * 22
    if f <= 3:
        c.disc(px_, py_, 7.5, O[0], 6.5); c.disc(px_, py_, 6.5, Y[1], 5.5); c.disc(px_ - 1.5, py_ - 1.5, 3.5, Y[3], 2.5)
        c.disc(px_ + .5, py_ + 1.5, 2.6, O[2], 2)
        for k in range(4):
            aa = a + math.radians(95 + (k - 1.5) * 26)
            bx, by = px_ + math.cos(aa) * 6.5, py_ + math.sin(aa) * 6
            c.disc(bx, by, 1.8, O[2])
            tooth(c, bx, by, 4.5, aa, 1.1, W, O[0])
    if f >= 2:
        tail = [0, 0, 0, 0, .15, .4, .65, .85][f]
        cols = [O[1], G[0], G[1]] if f <= 4 else [O[2], Y[0]]
        claws(c, 48, 18, 18, 50, 4, 6, 2.8, cols, u=1.0, bow=-3, tail=tail)
    if f in (2, 3):
        c.spark(26, 40, 7 if f == 2 else 5, G[1], W, diag=True)
    if f >= 3:
        r = rng('lswipe')
        for k in range(10):
            a = math.radians(r.uniform(140, 330))
            v = (f - 2) * r.uniform(2.5, 4.5)
            x, y = 28 + math.cos(a) * v, 40 + math.sin(a) * v + (f - 2) * .8
            if (k + f) % 3: c.px(x, y, G[0] if k % 2 else G[1])


P_LKING = Pal(S=['#3a1a04', '#7a3a0a', '#c8741a', '#ffb42a', '#ffe070', '#fff8d0'], M=['#311800', '#6a2000', '#8b5210', '#b47b31', '#d5a462', '#f6bd7b'],
              W=['#ffffff'], R=['#e0342a'], K=['#1a0c00'])


@sheet('lion_king_sky', 128, 12, 'screen', P_LKING, peak=[3, 7, 10])
def lion_king_sky(c, f):
    S, M, W, R, K = P_LKING.S, P_LKING.M, P_LKING.W[0], P_LKING.R[0], P_LKING.K[0]
    c.rect(0, 0, 127, 127, S[0])
    c.dither(lambda cc: cc.rect(0, 0, 127, 127, S[1]), f)
    cx = 64
    cy = [104, 92, 80, 70, 64, 60, 58, 58, 58, 58, 58, 58][f]
    # 햇살(회전)
    n = 16
    for k in range(n):
        a = k * math.tau / n + f * .06
        w = .09
        c.poly([(cx, cy), (cx + math.cos(a - w) * 120, cy + math.sin(a - w) * 120), (cx + math.cos(a + w) * 120, cy + math.sin(a + w) * 120)], S[2] if k % 2 else S[3])
    c.disc(cx, cy, 44, S[3]); c.disc(cx, cy, 40, S[4])
    # 갈기(뾰족 방사형 2겹)
    r = rng('lmane')
    for layer, (rr, col) in enumerate(((38, M[1]), (32, M[2]))):
        pts = []
        for k in range(28):
            a = k * math.tau / 28
            q = rr if k % 2 == 0 else rr - 9
            q += r.uniform(-2, 2) + (math.sin(f * .8 + k) * 1.5 if layer == 0 else 0)
            pts.append((cx + math.cos(a) * q, cy + 4 + math.sin(a) * q * .95))
        c.poly(pts, col)
    c.disc(cx, cy + 4, 24, M[3], 22)
    # 얼굴
    c.disc(cx, cy + 6, 18, M[4], 19)
    c.disc(cx, cy + 16, 10, M[5], 7)
    for sgn in (-1, 1):
        c.disc(cx + sgn * 8, cy + 1, 3, K, 2.2 if f >= 4 else 1)
        if f >= 5: c.px(cx + sgn * 8 - 1, cy, S[4])
        c.line([(cx + sgn * 3, cy - 4), (cx + sgn * 12, cy - 6)], M[1], 2)       # 눈썹
    c.poly([(cx - 5, cy + 10), (cx + 5, cy + 10), (cx, cy + 15)], K)
    c.line([(cx, cy + 15), (cx, cy + 19)], M[1])
    open_ = 0 if f < 7 else min(1, (f - 6) / 2)
    c.poly([(cx - 8, cy + 20), (cx + 8, cy + 20), (cx + 5, cy + 21 + 8 * open_), (cx - 5, cy + 21 + 8 * open_)], M[0])
    if open_ > 0:
        c.rect(cx - 4, cy + 22, cx + 4, cy + 20 + 7 * open_, R)
        for sgn in (-1, 1): tooth(c, cx + sgn * 5, cy + 20, 4, math.pi / 2, 1.2, W)
    # 태양 관
    if f >= 2:
        up = max(0, 20 - (f - 2) * 6)
        by = cy - 26 - up
        c.poly([(cx - 16, by + 8), (cx - 16, by - 4), (cx - 9, by + 2), (cx, by - 10), (cx + 9, by + 2), (cx + 16, by - 4), (cx + 16, by + 8)], S[3])
        c.rect(cx - 16, by + 4, cx + 16, by + 8, S[2])
        for k in (-8, 0, 8): c.disc(cx + k, by + 6, 1.6, R if k == 0 else W)
        if f in (5, 6, 7): c.spark(cx, by - 12, 5, W, W, diag=True)
    # 포효 호
    if open_ > 0:
        for k in range(2):
            rr = 50 + (f - 7) * 10 + k * 12
            c.arc(cx, cy + 24, rr, 110, 250, S[5] if k == 0 else S[4], 2, rr * .7)

