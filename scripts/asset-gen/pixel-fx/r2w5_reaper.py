"""사신(reaper) 이펙트 2종 — b3. 색: 명계 보라·검정, 해골 흰, 영혼 하늘색, 은빛 낫.
사신의 표식(대상 위에 보라 원과 해골 문장이 새겨져 박힌다) · 즉사의 낫(거대한 은빛 달 앞에서 초승달 낫이 내려와 화면을 벤다)."""
from lib_r2w5 import *

P_MARK = Pal(V=['#210f33', '#571870', '#a007bf', '#e090ff'], W=['#aaaaaa', '#eaeaea'], K=['#000000'], E=['#7fe6ff'])


@sheet('reaper_mark', 64, 10, 'target', P_MARK, peak=[2, 5, 8])
def reaper_mark(c, f):
    V, W, K, E = P_MARK.V, P_MARK.W, P_MARK.K[0], P_MARK.E[0]
    u = min(1, (f + 1) / 4)
    cy = CY - 6
    c.arc(CX, cy, 22, -90, -90 + 360 * u, V[2], 2, 20)
    if f >= 2:
        c.arc(CX, cy, 17, 90, 90 + 360 * min(1, (f - 1) / 3), V[1], 1, 15)
        for k in range(6):
            a = k * math.tau / 6 + f * .15
            x, y = CX + math.cos(a) * 20, cy + math.sin(a) * 18
            c.rect(x - 1, y - 1, x + 1, y + 1, V[3])
    if f >= 3:
        s = 1.6 if f < 5 else (1.3 if f == 5 else 1.2)
        skull(c, CX, cy - 2, s * 2, W[1], K, V[0])
        if f >= 5: c.px(CX - 2 * s, cy - 2, E); c.px(CX + 2 * s, cy - 2, E)
    if f >= 6:      # 박히며 조여듦
        t = f - 6
        c.ring(CX, cy, 26 - t * 4, V[3], 1, 24 - t * 4)
        for k in range(4):
            a = k * math.tau / 4 + math.pi / 4
            c.line([(CX + math.cos(a) * (30 - t * 5), cy + math.sin(a) * (28 - t * 5)), (CX + math.cos(a) * (24 - t * 5), cy + math.sin(a) * (22 - t * 5))], V[2])


P_DOOM = Pal(V=['#08040e', '#1a0a2a', '#3a1450', '#6a2a8a'], M=['#b0b0c8', '#e8e8f4', '#ffffff'], G=['#4a3a2a'], E=['#7fe6ff'], R=['#a01c44'])


@sheet('reaper_doom_sky', 128, 12, 'screen', P_DOOM, peak=[3, 7, 9])
def reaper_doom_sky(c, f):
    V, M, G, E, R = P_DOOM.V, P_DOOM.M, P_DOOM.G[0], P_DOOM.E[0], P_DOOM.R[0]
    c.rect(0, 0, 127, 127, V[0]); c.dither(lambda cc: cc.rect(0, 30 - f % 3 * 5, 127, 127, V[1]), f); c.rect(0, 70 - f % 2 * 4, 127, 127, V[1])
    for k in range(6):
        x = (k * 41 + f * 13) % 150 - 10
        c.dither(lambda cc, x=x, k=k: cc.disc(x, 88 + (k % 3) * 8, 16, V[3], 4), k + f)
    c.dither(lambda cc: cc.rect(0, 100, 127, 127, V[2]), 1)
    # 거대한 달
    c.disc(64, 50, 34, M[0]); c.disc(60, 46, 28, M[1])
    for (x, y, r) in ((50, 40, 4), (72, 58, 6), (64, 34, 3)): c.disc(x, y, r, M[0])
    # 낫: 칸 0~5 위에서 내려와 들림, 6~8 휘둘러 화면 사선, 9~ 잔광
    if f <= 5:
        oy = -40 + f * 10
        c.line([(96, oy), (96, oy + 70)], G, 3)
        pts = [(96 + math.cos(math.radians(a)) * 34 - 34, oy + math.sin(math.radians(a)) * 20) for a in range(0, 100, 10)]
        c.poly(pts + [(62, oy + 4)], M[2])
        c.line(pts, M[0])
    else:
        t = min(1, (f - 6) / 2)
        thin = 1 if f < 10 else .45
        # 화면을 오른쪽 위→왼쪽 아래로 가르는 굵은 초승달 참격
        pts = [(lerp(124, 4, u), lerp(8, 120, u) - math.sin(u * math.pi) * 22) for u in [i / 20 * t for i in range(21)]]
        n = len(pts)
        from lib_r2w5 import strip, lens
        for col, w in ((V[3], 9), (M[0], 6), (M[2], 3)):
            strip(c, pts, lens(n, w * thin), col)
        if f >= 8:
            for k in range(8):
                u = k / 7
                x, y = lerp(120, 6, u), lerp(10, 118, u)
                c.px(x + 6, y - 2, E if k % 2 else R)
    if f >= 2:
        for k in range(12):
            a = k * math.tau / 12 + f * .1
            c.px(64 + math.cos(a) * 40, 50 + math.sin(a) * 40, E if (k + f) % 3 == 0 else V[3])

