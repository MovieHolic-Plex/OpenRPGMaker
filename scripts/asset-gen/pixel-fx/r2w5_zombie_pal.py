"""좀비(zombie_pal) 이펙트 1종 — b3. 색: 연두 피부, 무덤 흙 갈색, 썩은 안개 황록, 핏빛 달.
좀비 떼(핏빛 달 아래 흙을 뚫고 손과 좀비가 차례로 솟아 왼쪽으로 밀려간다)."""
from lib_r2w5 import *

P_HORDE = Pal(N=['#120a14', '#2a1424', '#4a1c2c'], M=['#c83a3a', '#ff8a6a'], Z=['#1a3a22', '#3e7a4a', '#7fe491'], C=['#063aa1'], D=['#2a1a0e', '#5a3a1e', '#8a5a2e'],
              P=['#a0b040'], E=['#fff08a'])


def zombie(c, x, y, s, Z, C, D, E, lean=0):
    c.rect(x - 3 * s, y - 12 * s, x + 3 * s, y - 2 * s, C)
    c.disc(x - 1 * s + lean, y - 15 * s, 3.4 * s, Z[1]); c.px(x - 3 * s + lean, y - 16 * s, E)
    c.line([(x - 1 * s, y - 10 * s), (x - 9 * s, y - 11 * s + lean)], Z[1], max(1, round(2 * s)))
    c.line([(x + 1 * s, y - 9 * s), (x - 7 * s, y - 7 * s + lean)], Z[0], max(1, round(2 * s)))


@sheet('zombie_pal_horde_sky', 128, 12, 'screen', P_HORDE, peak=[3, 7, 10])
def zombie_pal_horde_sky(c, f):
    N, M, Z, C, D, P, E = P_HORDE.N, P_HORDE.M, P_HORDE.Z, P_HORDE.C[0], P_HORDE.D, P_HORDE.P[0], P_HORDE.E[0]
    c.rect(0, 0, 127, 127, N[0]); c.dither(lambda cc: cc.rect(0, 40, 127, 127, N[1]), 0); c.rect(0, 70, 127, 127, N[1])
    c.disc(96, 28, 15, M[0]); c.disc(92, 24, 7, M[1])
    c.rect(0, 100, 127, 127, D[0])
    c.line([(0, 100), (127, 100)], D[1])
    for k in range(9):
        x = 6 + k * 14
        start = (k * 7) % 5
        rise = max(0, min(1, (f - start) / 5))
        drift = max(0, f - 6) * 3
        y = 120 - rise * 22
        if rise <= 0:
            continue
        if rise < .5:      # 땅을 뚫는 손
            c.line([(x, 100), (x - 2, 100 - rise * 20)], Z[1], 2)
            for d in (-2, 0, 2): c.px(x - 2 + d, 99 - rise * 20, Z[2])
            c.rect(x - 4, 98, x + 4, 101, D[2])
        else:
            zombie(c, x - drift, y, 1.6, Z, C, D, E, lean=(k + f) % 2)
    c.rect(0, 104, 127, 127, D[0])
    for k in range(7):
        x = (k * 23 + f * 5) % 140 - 6
        c.dither(lambda cc, x=x: cc.disc(x, 100, 14, P, 4), k + f)

