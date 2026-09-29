"""호랑이(tiger) 이펙트 시트 2종 — retro2003 로스터 b1. 색: 주황·노랑 줄무늬 호피, 검붉은 줄, 흰 섬광.
발톱 베기(오른쪽 위에서 왼쪽 아래로 세 줄 호피 발톱 자국) · 호왕 강림(불타는 하늘에 거대한 호랑이 얼굴이 눈을 뜨고 포효)."""
from lib_r2w5 import *

P_TCLAW = Pal(O=['#410000', '#732910', '#bd3908'], Y=['#e68310', '#f6a418', '#ffde5a', '#fff6de'], W=['#ffffff'])


@sheet('tiger_claw', 64, 8, 'target', P_TCLAW, peak=[1, 3, 5])
def tiger_claw(c, f):
    O, Y, W = P_TCLAW.O, P_TCLAW.Y, P_TCLAW.W[0]
    x0, y0, x1, y1 = 50, 12, 14, 52
    if f == 0:
        paw(c, 48, 14, 1.3, Y[1], O[2], O[0])
        speed(c, 52, 10, 44, 18, [Y[3], Y[2]], n=4, gap=4, ln=10)
        return
    u = [0, .55, 1, 1, 1, 1, 1, 1][f]
    tail = [0, 0, 0, .1, .3, .5, .7, .85][f]
    if f == 2:
        c.disc(32, 32, 20, Y[1], 18); c.disc(32, 32, 14, Y[2], 12); c.disc(32, 32, 7, Y[3], 6)
    cols = [O[0], Y[1], Y[3], W] if f <= 3 else ([O[1], Y[0], Y[2]] if f <= 5 else [O[1], Y[0]])
    claws(c, x0, y0, x1, y1, 3, 9, 4.2 if f <= 3 else 3.2, cols, u=u, bow=2.5, tail=tail)
    # 호피 줄: 자국을 가로지르는 짧은 검은 줄
    if 2 <= f <= 5:
        for k in range(4):
            t = .2 + k * .2
            x, y = lerp(x0, x1, t), lerp(y0, y1, t)
            c.line([(x - 6, y - 7), (x - 2, y - 3)], O[0], 2)
    if f >= 3:
        r = rng('tclaw')
        for k in range(9):
            a = math.radians(r.uniform(120, 300))
            v = (f - 2) * r.uniform(3, 5)
            c.rect(32 + math.cos(a) * v, 32 + math.sin(a) * v, 33 + math.cos(a) * v, 33 + math.sin(a) * v, Y[2] if k % 2 else O[2])
    if f == 1:
        c.spark(x0 - 4, y0 + 4, 5, W, W)


P_TKING = Pal(S=['#1e0404', '#4a0c08', '#8a1e0c', '#c8480e'], Y=['#e68310', '#f6a418', '#ffde5a', '#fff6de'], K=['#140404'],
              E=['#6affd0', '#ffffff'], R=['#b81830'])


@sheet('tiger_king_sky', 128, 12, 'screen', P_TKING, peak=[4, 7, 10])
def tiger_king_sky(c, f):
    S, Y, K, E, R = P_TKING.S, P_TKING.Y, P_TKING.K[0], P_TKING.E, P_TKING.R[0]
    c.rect(0, 0, 127, 127, S[0])
    c.dither(lambda cc: cc.rect(0, 40, 127, 127, S[1]), 0)
    c.rect(0, 64, 127, 127, S[1])
    c.dither(lambda cc: cc.rect(0, 90, 127, 127, S[2]), 1)
    # 불꽃 띠(아래)
    for k in range(12):
        x = k * 11 + 4
        h = 18 + ((k * 7 + f * 5) % 14)
        LM.flame(c, x, 128, h, 6, [S[2], S[3], Y[0]], lean=((k + f) % 3 - 1) * 2)
    # 얼굴 크기: 떠오르며 커진다
    g = [.45, .6, .75, .88, .96, 1.0, 1.02, 1.0, 1.0, 1.0, .98, .95][f]
    cx, cy = 64, 62 + (1 - g) * 30
    def P(dx, dy): return (cx + dx * g, cy + dy * g)
    # 머리 윤곽
    c.disc(cx, cy, 46 * g + 2, K, 40 * g + 2)
    c.disc(cx, cy, 46 * g, Y[0], 40 * g)
    c.disc(cx, cy - 6 * g, 38 * g, Y[1], 30 * g)
    # 귀
    for sgn in (-1, 1):
        c.disc(*P(sgn * 34, -34), 9 * g + 1, K); c.disc(*P(sgn * 34, -34), 9 * g, Y[0]); c.disc(*P(sgn * 34, -33), 4.5 * g, Y[3])
    # 이마 王 줄 + 옆 줄무늬
    for dy in (-30, -22, -14):
        c.line([P(-8, dy), P(8, dy)], K, max(1, round(3 * g)))
    c.line([P(0, -30), P(0, -14)], K, max(1, round(3 * g)))
    for sgn in (-1, 1):
        for k in range(4):
            c.poly([P(sgn * (46 - k * 2), -14 + k * 9), P(sgn * (26 - k * 2), -9 + k * 9), P(sgn * (44 - k * 2), -9 + k * 9)], K)
    # 볼 흰털
    for sgn in (-1, 1):
        c.disc(*P(sgn * 16, 16), 16 * g, Y[3], 11 * g)
    # 눈: 칸 4 부터 뜬다(초록 빛)
    open_ = 0 if f < 3 else min(1, (f - 2) / 2)
    for sgn in (-1, 1):
        ex, ey = P(sgn * 17, -4)
        c.poly([(ex - 9 * g, ey), (ex, ey - 4 * g * open_ - .6), (ex + 9 * g, ey), (ex, ey + 3 * g * open_ + .6)], K)
        if open_ > 0:
            c.disc(ex, ey, 5 * g, E[0], 3 * g * open_ + .5)
            c.rect(ex - .6, ey - 3 * g * open_, ex + .6, ey + 3 * g * open_, K)
            if f in (5, 6): c.spark(ex + sgn * 2, ey - 2, 4, E[1], E[1])
    # 코·입: 칸 6 부터 크게 벌려 포효
    c.poly([P(-6, 8), P(6, 8), P(0, 14)], K)
    jaw = 0 if f < 6 else min(1, (f - 5) / 2) * (1 if f < 11 else .6)
    c.poly([P(-16, 20), P(0, 18), P(16, 20), P(10, 20 + 22 * jaw + 2), P(-10, 20 + 22 * jaw + 2)], K)
    if jaw > 0:
        c.poly([P(-12, 22), P(12, 22), P(8, 20 + 22 * jaw), P(-8, 20 + 22 * jaw)], R)
        for sgn in (-1, 1):
            tooth(c, *P(sgn * 9, 20), 8 * g, math.pi / 2, 2 * g, Y[3])
            tooth(c, *P(sgn * 8, 20 + 22 * jaw + 1), 6 * g, -math.pi / 2, 1.8 * g, Y[3])
        # 포효 충격 호
        for k in range(3):
            rr = (f - 6) * 12 + k * 10
            if 10 < rr < 90: c.arc(cx, cy + 20, rr, 110, 250, Y[2] if k == 0 else Y[1], 2, rr * .8)

