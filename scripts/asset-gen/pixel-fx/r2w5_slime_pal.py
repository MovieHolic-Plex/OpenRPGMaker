"""슬라임(slime_pal) 이펙트 2종 — b3. 색: 연두 젤리·흰 광택·금 왕관.
젤리 방벽(시전자 몸을 감싸 부푸는 반투명 젤리 막, 물방울 튐) · 킹 슬라임(작은 슬라임들이 튀어 모여 왕관 쓴 거대 슬라임)."""
from lib_r2w5 import *

P_JELLY = Pal(G=['#002f15', '#087129', '#40ad29', '#6bd926', '#c0e869', '#e0e8b1'], W=['#ffffff'])


@sheet('slime_pal_jelly', 64, 10, 'user', P_JELLY, peak=[2, 5, 8])
def slime_pal_jelly(c, f):
    G, W = P_JELLY.G, P_JELLY.W[0]
    g = [.3, .55, .8, 1.0, 1.08, 1.0, .97, 1.02, .9, .7][f]
    rx, ry = 24 * g, 22 * g
    cy = CY - 4
    c.ring(CX, cy, rx, G[1], 2, ry)
    c.dither(lambda cc: cc.disc(CX, cy, rx - 1, G[3], ry - 1), f)
    c.disc(CX, cy, rx - 5, 0, ry - 5)
    c.arc(CX, cy, rx - 3, 200, 260, G[5], 2, ry - 3)
    c.px(CX - rx * .5, cy - ry * .6, W); c.px(CX - rx * .5 + 1, cy - ry * .6, W)
    # 출렁이는 아래 물결
    for k in range(6):
        a = math.radians(30 + k * 24)
        x, y = CX + math.cos(a) * rx, cy + math.sin(a) * ry
        c.disc(x, y + ((k + f) % 2), 2, G[2])
    if 3 <= f <= 8:
        r = rng('jelly')
        for k in range(6):
            a = r.uniform(0, math.tau)
            d = rx + 2 + (f - 3) * 2
            x, y = CX + math.cos(a) * d, cy + math.sin(a) * d * .9 + (f - 3)
            c.disc(x, y, 1.5 if k % 2 else 1, G[4]); c.px(x - 1, y - 1, W)


P_KING = Pal(N=['#0a1a2a', '#16304a', '#244a6a'], G=['#002f15', '#087129', '#40ad29', '#6bd926', '#c0e869'], Y=['#b7871f', '#ffd23a', '#fff6b0'],
             R=['#c52029'], W=['#ffffff'], E=['#102018'])


def mini(c, x, y, s, G, E, W):
    c.disc(x, y, 5 * s + 1, G[0], 4 * s + 1); c.disc(x, y, 5 * s, G[2], 4 * s); c.disc(x - s, y - s, 2.5 * s, G[3], 2 * s)
    c.px(x + 1.5 * s, y, E); c.px(x + 3.5 * s, y, E); c.px(x - 2 * s, y - 2.5 * s, W)


@sheet('slime_pal_king_sky', 128, 12, 'screen', P_KING, peak=[3, 7, 10])
def slime_pal_king_sky(c, f):
    N, G, Y, R, W, E = P_KING.N, P_KING.G, P_KING.Y, P_KING.R[0], P_KING.W[0], P_KING.E[0]
    c.rect(0, 0, 127, 127, N[0]); c.dither(lambda cc: cc.rect(0, 50 - f % 3 * 4, 127, 127, N[1]), f); c.rect(0, 80 - f % 2 * 3, 127, 127, N[1])
    c.rect(0, 108, 127, 127, N[2])
    # 작은 슬라임 여섯이 튀어 들어와 가운데로
    t = min(1, f / 6)
    for k in range(6):
        sx = [8, 120, 20, 108, 40, 88][k]
        x = lerp(sx, 64 + (k - 2.5) * 6, t)
        y = 104 - abs(math.sin((f + k) * 1.1)) * 16 * (1 - t) - 2
        if f < 7: mini(c, x, y, 1.1, G, E, W)
    if f >= 5:
        g = min(1, (f - 4) / 3) * (1.03 if f == 8 else 1)
        rx, ry = 40 * g, 32 * g
        cy = 108 - ry
        c.disc(64, cy, rx + 1, G[0], ry + 1); c.disc(64, cy, rx, G[2], ry); c.disc(58, cy - ry * .25, rx * .65, G[3], ry * .6)
        c.disc(50, cy - ry * .55, rx * .18, G[4], ry * .12)
        for x in (72, 86):
            c.rect(x, cy - 4, x + 3, cy + 2, E); c.px(x, cy - 4, W)
        c.line([(74, cy + 10), (80, cy + 13), (86, cy + 10)], E, 2)
        # 왕관
        by = cy - ry - 2 - max(0, 8 - (f - 5) * 3)
        c.poly([(46, by + 10), (46, by - 2), (54, by + 4), (64, by - 8), (74, by + 4), (82, by - 2), (82, by + 10)], Y[1])
        c.rect(46, by + 6, 82, by + 10, Y[0])
        for x in (54, 64, 74): c.disc(x, by + 8, 1.6, R if x == 64 else W)
        if f in (8, 9, 10): c.spark(64, by - 12, 5 + (f % 2) * 2, Y[2], W, diag=True)
        for k in range(8):
            a = k * math.tau / 8 + f * .4
            rr = rx + 6 + (f % 3) * 3
            c.spark(64 + math.cos(a) * rr, cy + math.sin(a) * rr * .6, 2, Y[2 if k % 2 else 1], W)
    for k in range(10):
        x = (k * 29 + f * 7) % 128; y = (k * 17) % 60 + 6
        if (k + f) % 2: c.px(x, y, Y[2])

