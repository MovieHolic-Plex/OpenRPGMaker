"""양(sheep) 이펙트 시트 2종 — retro2003 로스터 b1. 색: 크림·흰 털, 짙은 회청 얼굴, 꿈 하늘 남보라·달빛 노랑.
털 방어(시전자 몸을 감싸 부풀어 오르는 털 구름 + 푸른 방패 반짝임) · 꿈나라 행진(밤하늘 울타리를 넘는 양 떼)."""
from lib_r2w5 import *

P_WOOL = Pal(W=['#8a7658', '#cfb9a5', '#f4ece0', '#ffffff'], B=['#2a5a9a', '#7ac0ff'], K=['#38301d'])


@sheet('sheep_wool', 64, 10, 'user', P_WOOL, peak=[2, 5, 8])
def sheep_wool(c, f):
    W, B, K = P_WOOL.W, P_WOOL.B, P_WOOL.K[0]
    g = [.35, .6, .85, 1.0, 1.08, 1.0, .96, 1.0, .9, .7][f]
    n = 9
    for k in range(n):
        a = k * math.tau / n + f * .12
        rx, ry = 20 * g, 17 * g
        x, y = CX + math.cos(a) * rx, CY - 2 + math.sin(a) * ry
        r = (6 + (k % 3)) * g
        c.disc(x, y, r + 1, W[0])
    for k in range(n):
        a = k * math.tau / n + f * .12
        rx, ry = 20 * g, 17 * g
        x, y = CX + math.cos(a) * rx, CY - 2 + math.sin(a) * ry
        r = (6 + (k % 3)) * g
        c.disc(x, y, r, W[1])
        c.disc(x - r * .3, y - r * .3, r * .6, W[2])
        if r > 5: c.px(x - r * .45, y - r * .5, W[3])
    # 속은 비워 시전자 몸이 보이게
    c.disc(CX, CY - 2, 12 * g, 0, 10 * g)
    # 방패 반짝임
    if f >= 3:
        for k in range(4):
            a = k * math.tau / 4 + f * .5
            x, y = CX + math.cos(a) * 24, CY - 2 + math.sin(a) * 20
            c.spark(x, y, 3 if (f + k) % 2 else 2, B[1], W[3])
    if 4 <= f <= 7:
        c.arc(CX, CY - 2, 27, 200 + f * 8, 320 + f * 8, B[0], 1, 23)
        c.arc(CX, CY - 2, 27, 20 + f * 8, 90 + f * 8, B[1], 1, 23)
    if f >= 8:
        for k in range(6):
            a = k * 1.1 + f
            c.px(CX + math.cos(a) * (26 + f), CY + math.sin(a) * 18 - (f - 7) * 3, W[2])


P_DREAM = Pal(N=['#0c0a2a', '#1e1a4e', '#3a2e7a', '#6a4aa8'], M=['#ffe890', '#fffbe0'], W=['#8a7658', '#e8dccb', '#ffffff'],
              K=['#1a1418'], F=['#6a4a2a', '#a8784a'], S=['#ffb0e0'])


def sheep_sil(c, x, y, s, W, K, leg=0):
    """왼쪽을 보는 작은 양. (x, y) = 몸 중심."""
    c.disc(x, y, 7 * s + 1, W[0], 5 * s + 1)
    c.disc(x, y, 7 * s, W[1], 5 * s)
    c.disc(x - 2 * s, y - 2 * s, 3 * s, W[2], 2 * s)
    c.disc(x - 7.5 * s, y - 1.5 * s, 2.6 * s, K, 2.2 * s)          # 얼굴
    c.px(x - 8.5 * s, y - 2 * s, W[2])
    for dx in (-4, 4):
        o = leg if dx < 0 else -leg
        c.line([(x + dx * s, y + 4 * s), (x + dx * s + o, y + 7.5 * s)], K, max(1, round(s)))


@sheet('sheep_dream_sky', 128, 12, 'screen', P_DREAM, peak=[3, 6, 9])
def sheep_dream_sky(c, f):
    N, M, W, K, F, S = P_DREAM.N, P_DREAM.M, P_DREAM.W, P_DREAM.K[0], P_DREAM.F, P_DREAM.S[0]
    c.rect(0, 0, 127, 127, N[0])
    c.dither(lambda cc: cc.rect(0, 40, 127, 127, N[1]), 0)
    c.rect(0, 70, 127, 127, N[1])
    c.dither(lambda cc: cc.rect(0, 92, 127, 127, N[2]), 1)
    # 별
    r = rng('dream_star')
    for k in range(26):
        x, y = r.randint(10, 118), r.randint(10, 80)
        if (k + f) % 3: c.px(x, y, M[1] if k % 4 else S)
        else: c.spark(x, y, 1, M[0])
    # 초승달
    c.disc(92, 30, 13, M[0]); c.disc(97, 26, 11, N[0]); c.disc(88, 34, 3, M[1], 2)
    # 언덕 + 울타리
    c.disc(64, 138, 80, N[3], 36)
    c.disc(64, 140, 80, N[2], 32)
    fx0 = 58
    for px_ in (fx0, fx0 + 14):
        c.rect(px_, 88, px_ + 2, 106, F[0]); c.rect(px_, 88, px_, 106, F[1])
    for yy in (92, 99):
        c.rect(fx0 - 4, yy, fx0 + 18, yy + 2, F[0]); c.line([(fx0 - 4, yy), (fx0 + 18, yy)], F[1])
    # 오른쪽에서 왼쪽으로 울타리를 넘는 양 셋(뛰는 포물선)
    for k in range(3):
        t = ((f + k * 4) % 12) / 11.0
        x = 118 - t * 110
        y = 100 - math.sin(t * math.pi) * 34
        s = 1.2 if k == 0 else 1.0
        sheep_sil(c, x, y, s, W, K, leg=2 if 0.2 < t < 0.8 else 0)
        # 꿈 가루 꼬리
        for j in range(4):
            tt = max(0, t - (j + 1) * .04)
            xx = 118 - tt * 110 + 3
            yy = 100 - math.sin(tt * math.pi) * 34
            if (j + f) % 2 == 0: c.px(xx + 8, yy, S if j % 2 else M[1])
    # zzz
    for k in range(2):
        yy = 60 - ((f * 3 + k * 18) % 36)
        zzz(c, 22 + k * 64, yy, 1.4, M[1], N[0])

