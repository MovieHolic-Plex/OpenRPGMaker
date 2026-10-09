"""수인 전사(minotaur_pal) 이펙트 1종 — b3. 색: 미궁 돌 회갈색, 횃불 주황, 도끼 은색, 흙먼지.
미궁의 분노(미궁 벽이 좌우로 무너지고 가운데 위에서 거대한 도끼가 떨어져 바닥을 쪼갠다)."""
from lib_r2w5 import *

P_LAB = Pal(N=['#140e0a', '#2a1e16'], S=['#3a3430', '#6a5e54', '#9a8c7c'], F=['#f06a22', '#ffd970'], A=['#646464', '#a1a1a1', '#e0e0e8'], W=['#6b4a2a'], D=['#b0845a'])


@sheet('minotaur_pal_labyrinth_sky', 128, 12, 'screen', P_LAB, peak=[3, 7, 9])
def minotaur_pal_labyrinth_sky(c, f):
    N, S, F, A, W, D = P_LAB.N, P_LAB.S, P_LAB.F, P_LAB.A, P_LAB.W[0], P_LAB.D[0]
    c.rect(0, 0, 127, 127, N[0]); c.dither(lambda cc: cc.rect(0, 0, 127, 20 + f % 3 * 6, N[1]), f); c.rect(0, 96, 127, 127, N[1])
    for k in range(10):
        x = (k * 13 + f * 3) % 128; y = (k * 29 + f * 9) % 90
        c.rect(x, y, x + 1, y + 1, S[0])
    # 좌우 벽: 칸 3 부터 바깥으로 기울며 무너짐
    fall = max(0, f - 1) * 3
    for side in (-1, 1):
        x0 = 64 + side * 30
        for row in range(7):
            for col in range(3):
                bx = x0 + side * col * 11 + side * fall * (row / 6) * 1.4
                by = 20 + row * 11 + (fall * .6 if row < 3 else 0) * (col + 1) / 3
                c.rect(bx, by, bx + side * 10, by + 9, S[1]); c.line([(bx, by), (bx + side * 10, by)], S[2])
        # 횃불
        tx = 64 + side * 26
        c.rect(tx - 1, 40, tx + 1, 48, W)
        LM.flame(c, tx, 40, 8 + (f % 3), 3, [F[0], F[1]])
    # 도끼: 칸 5~7 위에서 떨어짐
    if f >= 4:
        t = min(1, (f - 4) / 3)
        y = lerp(-30, 78, t * t)
        c.line([(64, y - 40), (64, y + 4)], W, 4)
        c.poly([(64, y - 6), (40, y - 18), (36, y), (40, y + 16), (64, y + 6)], A[1])
        c.poly([(64, y - 6), (40, y - 18), (38, y - 12), (62, y - 3)], A[2])
        c.line([(36, y), (40, y + 16)], A[0])
        c.poly([(64, y - 4), (76, y - 10), (76, y + 8), (64, y + 4)], A[0])
    if f >= 7:
        rr = (f - 6) * 10
        c.disc(52, 98, rr, D, rr * .3)
        for k in range(6):
            x = 52 + (k - 2.5) * rr * .35
            c.line([(52, 98), (x, 98 + (k % 2) * 4 + 3)], N[0], 2)
        for k in range(8):
            a = math.radians(200 + k * 18)
            c.rect(52 + math.cos(a) * (rr + 6), 96 + math.sin(a) * (rr * .6 + 6), 54 + math.cos(a) * (rr + 6), 98 + math.sin(a) * (rr * .6 + 6), S[2])

