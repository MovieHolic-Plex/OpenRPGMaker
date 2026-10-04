"""세이렌(siren) 이펙트 2종 — b5. 색: 분홍·자홍 음표, 흰 깃, 폭풍 바다 남청·물거품 흰.
매혹(대상 둘레를 분홍 음표와 하트가 맴돌다 머리 위로 모여 하트 눈 문장) · 침몰의 아리아(폭풍 바다 위로 음파 고리가 퍼지고 파도가 솟아 배를 삼킴)."""
from lib_r2w5 import *

P_CHARM = Pal(P=['#6a1a4a', '#c8408a', '#ff8ac8', '#ffd0e8'], W=['#ffffff'])


def note(c, x, y, s, col, rim):
    c.disc(x, y, 2 * s + 1, rim, 1.5 * s + 1); c.disc(x, y, 2 * s, col, 1.5 * s)
    c.line([(x + 2 * s, y), (x + 2 * s, y - 6 * s)], rim, 2); c.line([(x + 2 * s, y - 6 * s), (x + 5 * s, y - 4 * s)], rim, 2)


@sheet('siren_charm', 64, 10, 'target', P_CHARM, peak=[2, 5, 8])
def siren_charm(c, f):
    P, W = P_CHARM.P, P_CHARM.W[0]
    cy = CY - 6
    if f <= 6:
        for k in range(5):
            a = k * math.tau / 5 + f * .55
            r = 22 - f * 1.5
            x, y = CX + math.cos(a) * r, cy + math.sin(a) * r * .8 - f
            if k % 2: note(c, x, y, 1, P[2], P[0])
            else: heart(c, x, y, 1.1, P[2], P[3], P[0])
    if f >= 5:
        g = min(1, (f - 4) / 2)
        hy = cy - 12
        heart(c, CX, hy, 2.4 * g + .6, P[1], P[3], P[0])
        if f >= 7:
            for k in range(8):
                a = k * math.tau / 8 + f * .2
                r = 10 + (f - 7) * 5
                c.px(CX + math.cos(a) * r, hy + math.sin(a) * r * .8, P[3] if k % 2 else W)
    if 3 <= f <= 8:
        c.ring(CX, cy + 8, 12 + (f % 3) * 2, P[1], 1, 4)


P_ARIA = Pal(N=['#060c20', '#0e1c3c', '#1a3462', '#2c5490'], F=['#9ad4f0', '#ffffff'], P=['#c8408a', '#ff8ac8'], S=['#3a2418', '#6a4028'], L=['#fff6a0'])


@sheet('siren_aria_sky', 128, 12, 'screen', P_ARIA, peak=[3, 7, 10])
def siren_aria_sky(c, f):
    N, F, P, S, L = P_ARIA.N, P_ARIA.F, P_ARIA.P, P_ARIA.S, P_ARIA.L[0]
    c.rect(0, 0, 127, 127, N[0]); c.dither(lambda cc: cc.rect(0, 30 - f % 3 * 4, 127, 127, N[1]), f)
    if f in (2, 6, 9):     # 번개
        c.line(jag(96, 0, 84, 60, 6, 5, rng('aria', f)), L, 2)
    # 음파 고리(왼쪽 위 세이렌 자리에서)
    for k in range(4):
        r = ((f * 9 + k * 22) % 88) + 6
        c.arc(24, 30, r, -40, 80, P[1] if k % 2 else P[0], 2, r * .8)
    # 배(가운데, 기울어 가라앉음)
    tilt = min(1, max(0, (f - 5) / 5))
    sy = 82 + tilt * 22
    c.poly([(58, sy - 4), (96, sy - 4 - tilt * 10), (90, sy + 6 - tilt * 8), (64, sy + 6)], S[1])
    c.line([(76, sy - 5 - tilt * 5), (76 + tilt * 8, sy - 34)], S[0], 2)
    c.poly([(77 + tilt * 8, sy - 32), (90 + tilt * 6, sy - 20), (77 + tilt * 4, sy - 12)], F[1])
    # 바다 파도(앞)
    for row in range(3):
        base = 96 + row * 11 - (f % 2) * 2
        pts = [(x, base + math.sin(x * .12 + f * .9 + row) * (4 + row + tilt * 6)) for x in range(-4, 136, 6)]
        c.poly(pts + [(132, 128), (-4, 128)], N[2 + (row > 0)])
        c.line(pts, F[0] if row == 0 else F[1])
    if f >= 6:
        for k in range(6):
            x = 60 + k * 7; y = 90 - ((f - 6) * 6 + k * 3) % 20
            c.disc(x, y, 1.6, F[1])

