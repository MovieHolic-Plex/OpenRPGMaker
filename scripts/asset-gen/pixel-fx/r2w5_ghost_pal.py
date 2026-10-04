"""유령(ghost_pal) 이펙트 2종 — b3. 색: 창백한 흰·청회, 넋 하늘색, 붉은 입, 밤하늘 남색.
빙의(대상 위로 유령이 스며들어 몸이 청백 빛으로 물들고 넋 눈이 뜬다) · 백귀야행(밤하늘을 가로지르는 유령·도깨비불 행렬)."""
from lib_r2w5 import *

P_POS = Pal(W=['#4a4a5a', '#9c9cb0', '#d5d5e0', '#f6f6f6'], B=['#3a8ac8', '#8ae0ff'], R=['#c52029'], E=['#201800'])


def ghost(c, x, y, s, W, R, E, ph=0):
    c.disc(x, y, 7 * s + 1, W[0], 7 * s + 1); c.disc(x, y, 7 * s, W[2], 7 * s); c.disc(x - 2 * s, y - 2 * s, 3.5 * s, W[3], 3.5 * s)
    c.rect(x - 7 * s, y, x + 7 * s, y + 6 * s, W[2])
    for k in range(4):
        xx = x - 7 * s + k * 3.5 * s
        c.poly([(xx, y + 6 * s), (xx + 1.75 * s, y + (9 + (k + ph) % 2) * s), (xx + 3.5 * s, y + 6 * s)], W[1])
    c.px(x - 3 * s, y - 1, E); c.px(x - 1 * s, y - 1, E)
    c.rect(x - 3 * s, y + 2 * s, x - 1 * s, y + 3 * s, R)


@sheet('ghost_pal_possess', 64, 10, 'target', P_POS, peak=[2, 5, 8])
def ghost_pal_possess(c, f):
    W, B, R, E = P_POS.W, P_POS.B, P_POS.R[0], P_POS.E[0]
    # 칸 0~3: 오른쪽 위에서 유령이 내려와 몸속으로
    if f <= 3:
        t = f / 3
        x, y = lerp(50, 32, t), lerp(10, 34, t)
        s = 1.0 - t * .35
        if f == 3: c.dither(lambda cc: ghost(cc, x, y, s, W, R, E, f), f)
        else: ghost(c, x, y, s, W, R, E, f)
        for k in range(3):
            c.px(x + 8 + k * 3, y - 6 - k * 2, W[1])
    # 칸 3~9: 몸 둘레 청백 넋 소용돌이
    if f >= 3:
        t = f - 3
        for k in range(8):
            a = k * math.tau / 8 + t * .7
            rx, ry = 16 - t * .6, 22 - t * .8
            x, y = CX + math.cos(a) * rx, CY - 4 + math.sin(a) * ry
            c.disc(x, y, 1.6 if k % 2 else 1, B[1] if (k + t) % 2 else W[3])
            x2, y2 = CX + math.cos(a - .35) * rx, CY - 4 + math.sin(a - .35) * ry
            c.line([(x2, y2), (x, y)], B[0])
    if f >= 5:     # 넋의 눈
        o = 1 if f in (5, 6, 7) else 0
        for dx in (-6, 4):
            c.rect(CX + dx, CY - 14 - o, CX + dx + 2, CY - 13 + o, B[1]); c.px(CX + dx + 1, CY - 14, W[3])
    if f >= 8:
        c.ring(CX, CY - 4, 20 + (f - 8) * 5, W[1], 1, 24 + (f - 8) * 4)


P_PAR = Pal(N=['#060818', '#101838', '#1c2a58'], W=['#4a4a5a', '#9c9cb0', '#d5d5e0', '#f6f6f6'], B=['#3a8ac8', '#8ae0ff'], R=['#c52029'], E=['#201800'],
            L=['#ff9a3a', '#fff0a0'])


@sheet('ghost_pal_parade_sky', 128, 12, 'screen', P_PAR, peak=[3, 7, 10])
def ghost_pal_parade_sky(c, f):
    N, W, B, R, E, L = P_PAR.N, P_PAR.W, P_PAR.B, P_PAR.R[0], P_PAR.E[0], P_PAR.L
    c.rect(0, 0, 127, 127, N[0]); c.dither(lambda cc: cc.rect(0, 40, 127, 127, N[1]), 0); c.rect(0, 76, 127, 127, N[1])
    c.rect(0, 108, 127, 127, N[2])
    # 보름달
    c.disc(30, 26, 14, W[2]); c.disc(27, 23, 9, W[3]); c.px(34, 28, W[1]); c.px(24, 30, W[1])
    # 지붕 실루엣
    for k in range(5):
        x = k * 30 - 6
        c.poly([(x, 110), (x + 14, 98 - (k % 2) * 6), (x + 28, 110)], E)
    c.rect(0, 110, 127, 127, E)
    # 행렬: 오른쪽 → 왼쪽, 사인 곡선
    for k in range(7):
        u = ((f * .07 + k / 7) % 1)
        x = 136 - u * 150
        y = 62 + math.sin(u * 7 + k) * 14
        s = 1.0 + (k % 3) * .25
        ghost(c, x, y, s, W, R, E, f + k)
        # 도깨비불 한 쌍
        fx_, fy_ = x + 12, y - 10 + math.sin(f + k) * 2
        c.disc(fx_, fy_, 2.5, B[0]); c.disc(fx_, fy_ - 1, 1.5, B[1])
    # 초롱
    for k in range(3):
        x = (k * 47 + f * 9) % 150 - 10
        c.line([(x, 8), (x, 16)], W[0]); c.disc(x, 20, 4, L[0], 5); c.rect(x - 1, 18, x + 1, 22, L[1])

