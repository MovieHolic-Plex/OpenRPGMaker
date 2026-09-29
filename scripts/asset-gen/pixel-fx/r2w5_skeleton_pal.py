"""해골병(skeleton_pal) 이펙트 1종 — b3. 색: 뼈 흰·회, 묘지 초록 안개, 눈 붉은 빛.
해골 군단(초록 안개 낀 묘지 땅에서 해골 병사들이 솟아 일제히 활을 쏘아 올린다)."""
from lib_r2w5 import *

P_LEG = Pal(N=['#0a120e', '#142a1e', '#234a32'], G=['#3a8a4a', '#8ae09a'], B=['#262626', '#8a8a8a', '#cbcbcb', '#eaeaea'], E=['#ff5a3a'], D=['#3a2a1a'])


def skel(c, x, y, s, B, E, bow=0):
    c.disc(x, y - 16 * s, 3.4 * s, B[2]); c.rect(x - 1 * s, y - 18 * s, x + 1 * s, y - 16 * s, B[0])
    c.px(x - 1, y - 16 * s, E)
    c.line([(x, y - 12 * s), (x, y - 5 * s)], B[2], max(1, round(1.5 * s)))
    for k in range(3): c.line([(x - 2 * s, y - 11 * s + k * 2 * s), (x + 2 * s, y - 11 * s + k * 2 * s)], B[3])
    c.line([(x, y - 5 * s), (x - 3 * s, y)], B[2]); c.line([(x, y - 5 * s), (x + 3 * s, y)], B[2])
    # 활을 비스듬히 위로(왼쪽 위 = 적 쪽)
    hx, hy = x - 4 * s, y - 12 * s - bow
    c.line([(x, y - 11 * s), (hx, hy)], B[2])
    c.arc(hx, hy, 5 * s, 130, 310, B[1], 1)


@sheet('skeleton_pal_legion_sky', 128, 12, 'screen', P_LEG, peak=[3, 7, 10])
def skeleton_pal_legion_sky(c, f):
    N, G, B, E, D = P_LEG.N, P_LEG.G, P_LEG.B, P_LEG.E[0], P_LEG.D[0]
    c.rect(0, 0, 127, 127, N[0]); c.dither(lambda cc: cc.rect(0, 50, 127, 127, N[1]), 0); c.rect(0, 80, 127, 127, N[1])
    c.rect(0, 104, 127, 127, D)
    # 묘비
    for k in range(5):
        x = 16 + k * 22
        c.rect(x, 84, x + 9, 104, B[1]); c.disc(x + 4, 84, 5, B[1]); c.line([(x + 2, 90), (x + 7, 90)], B[0]); c.line([(x + 4, 87), (x + 4, 94)], B[0])
    # 초록 안개
    for k in range(6):
        x = (k * 27 + f * 4) % 150 - 10
        c.dither(lambda cc, x=x: cc.disc(x, 102, 16, G[0], 5), k + f)
    # 해골들이 솟아오른다
    for k in range(6):
        x = 14 + k * 20
        rise = max(0, min(1, (f - k * .5) / 4))
        y = 128 - rise * 26
        if rise > 0:
            skel(c, x, y, 1.5, B, E, bow=2 if f >= 7 else 0)
    c.rect(0, 108, 127, 127, D)
    # 일제 사격: 칸 7 부터 화살이 왼쪽 위로
    if f >= 7:
        for k in range(10):
            t = (f - 7) / 4
            sx = 10 + (k * 13) % 110
            x = sx - t * 60 - (k % 3) * 6
            y = 80 - t * 70 - (k % 4) * 5
            c.line([(x, y), (x + 6, y + 6)], B[3]); c.px(x, y, G[1])
    c.dither(lambda cc: cc.rect(0, 0, 127, 20, N[1]), f)

