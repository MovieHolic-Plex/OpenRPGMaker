"""붉은 악마(demon) 이펙트 2종 — b3. 색: 핏빛 계약서·금 글씨·지옥불 주황·검붉은 하늘.
악마의 계약(시전자 앞에 두루마리가 펼쳐지고 피 서명 → 불꽃으로 타며 기운이 몸으로) · 연옥의 문(검은 하늘에 불타는 문이 열리고 불길이 쏟아짐)."""
from lib_r2w5 import *

P_PACT = Pal(P=['#5a2a1a', '#c8a070', '#f0dcb0'], R=['#4a0008', '#c52029', '#ff525a'], F=['#f06a22', '#ffd970'], K=['#290800'])


@sheet('demon_pact', 64, 10, 'user', P_PACT, peak=[2, 5, 8])
def demon_pact(c, f):
    P, R, F, K = P_PACT.P, P_PACT.R, P_PACT.F, P_PACT.K[0]
    x0, y0 = 14, 12
    h = [6, 16, 26, 30, 30, 30, 26, 18, 10, 4][f]
    if f <= 7:
        c.rect(x0, y0, x0 + 20, y0 + h, P[1]); c.rect(x0 + 1, y0 + 1, x0 + 19, y0 + h - 1, P[2])
        c.rect(x0 - 2, y0 - 2, x0 + 22, y0 + 1, P[0]); c.rect(x0 - 2, y0 + h, x0 + 22, y0 + h + 3, P[0])
        for k in range(min(5, h // 5)):
            c.line([(x0 + 3, y0 + 4 + k * 5), (x0 + 17 - (k % 2) * 4, y0 + 4 + k * 5)], K)
        if f >= 3:     # 피 서명
            u = min(1, (f - 2) / 3)
            pts = [(x0 + 4, y0 + 26), (x0 + 8, y0 + 22), (x0 + 11, y0 + 27), (x0 + 15, y0 + 21), (x0 + 18, y0 + 25)]
            n = max(2, int(len(pts) * u))
            c.line(pts[:n], R[1], 2)
    if f >= 6:         # 타오르며 시전자로
        for k in range(5):
            x = x0 + 2 + k * 4
            fh = 6 + ((k * 3 + f) % 5)
            LM.flame(c, x, y0 + h + 2, fh, 3, [R[1], F[0], F[1]])
        for k in range(6):
            t = (f - 6) / 3
            a = k * math.tau / 6 + f
            r0 = 20 * (1 - t) + 4
            c.px(CX + 6 + math.cos(a) * r0, CY + math.sin(a) * r0, R[2])
    if f in (4, 5):
        c.ring(CX + 8, CY + 2, 12 + (f - 4) * 4, R[1], 1, 10)


P_INF = Pal(K=['#0e0204', '#2a0608', '#5a0c10'], S=['#8a1414', '#d4401c', '#f07a22', '#ffc040', '#fff2a0'], I=['#3a3040', '#6a5a6a'], E=['#ff525a'])


@sheet('demon_inferno_sky', 128, 12, 'screen', P_INF, peak=[3, 7, 10])
def demon_inferno_sky(c, f):
    K, S, I, E = P_INF.K, P_INF.S, P_INF.I, P_INF.E[0]
    c.rect(0, 0, 127, 127, K[0]); c.dither(lambda cc: cc.rect(0, 60 - f % 3 * 4, 127, 127, K[1]), f); c.rect(0, 90 - f % 2 * 3, 127, 127, K[1])
    for k in range(12):
        x = (k * 37 + f * 11) % 128; y = 110 - ((k * 23 + f * 9) % 100)
        c.rect(x, y, x + 1, y + 1, S[2] if k % 2 else S[3])
    # 문틀
    c.rect(34, 14, 94, 110, I[0]); c.rect(38, 18, 90, 110, K[0])
    c.arc(64, 34, 30, 180, 360, I[1], 4, 22)
    for y in range(24, 110, 12):
        c.line([(34, y), (38, y)], I[1]); c.line([(90, y), (94, y)], I[1])
    for x in (40, 88):
        c.disc(x, 18, 3, E)
    open_ = min(1, max(0, (f - 1) / 5))
    gap = 26 * open_
    # 문짝 두 장이 바깥으로 열린다
    c.rect(38, 22, 64 - gap, 110, K[2]); c.rect(64 + gap, 22, 90, 110, K[2])
    c.line([(64 - gap, 22), (64 - gap, 110)], I[1]); c.line([(64 + gap, 22), (64 + gap, 110)], I[1])
    # 문 안 지옥불
    if gap > 1:
        c.rect(64 - gap + 1, 24, 64 + gap - 1, 110, S[0])
        c.disc(64, 80, gap * 1.1, S[1], 30)
        c.disc(64, 88, gap * .7, S[2], 20)
        c.disc(64, 94, gap * .4, S[3], 12)
    # 쏟아지는 불길
    if f >= 5:
        r = rng('inf')
        for k in range(14):
            t = ((f - 5) * .18 + r.random()) % 1
            a = math.radians(r.uniform(150, 390))
            d = 12 + t * 70
            x, y = 64 + math.cos(a) * d, 76 + math.sin(a) * d * .6 + t * 20
            LM.flame(c, x, y, 7 * (1 - t) + 3, 2.5, [S[1], S[2], S[4]])
    for k in range(10):
        x = 6 + k * 12
        LM.flame(c, x, 124, 10 + ((k * 5 + f * 3) % 10), 5, [S[0], S[1], S[2]])

