"""젖소(cow) 이펙트 시트 2종 — retro2003 로스터 b1. 색: 흰·검 얼룩, 분홍 코, 우유 흰·크림, 치유 초록, 흙먼지 갈색.
신선한 우유(병이 기울어 쏟아지는 우유 물줄기 → 흰 물보라 + 초록 십자 상승) · 대돌진(흙먼지 속 소 떼가 왼쪽으로 쓸고 지나간다)."""
from lib_r2w5 import *

P_MILK = Pal(W=['#9c9c9c', '#e8e8ec', '#ffffff'], G=['#1d864e', '#43c26a', '#aef0a0'], B=['#3a6aa0', '#8ac0e8'], R=['#e06a52'], Y=['#fff4c0'])


def bottle(c, x, y, tilt, W, B, R):
    ang = math.radians(-90 - tilt)
    dx, dy = math.cos(ang), math.sin(ang)          # 병 입구 방향
    nx, ny = -dy, dx
    body = [(x + nx * 5, y + ny * 5), (x + nx * 5 + dx * 12, y + ny * 5 + dy * 12), (x + nx * 2.5 + dx * 15, y + ny * 2.5 + dy * 15),
            (x + nx * 2.5 + dx * 19, y + ny * 2.5 + dy * 19), (x - nx * 2.5 + dx * 19, y - ny * 2.5 + dy * 19),
            (x - nx * 2.5 + dx * 15, y - ny * 2.5 + dy * 15), (x - nx * 5 + dx * 12, y - ny * 5 + dy * 12), (x - nx * 5, y - ny * 5)]
    c.poly([(px_ + (px_ - x) * .12, py_ + (py_ - y) * .12) for px_, py_ in body], B[0])
    c.poly(body, W[1])
    c.poly([(x + nx * 4, y + ny * 4), (x + nx * 4 + dx * 10, y + ny * 4 + dy * 10), (x + nx * 1 + dx * 10, y + ny * 1 + dy * 10), (x + nx * 1, y + ny * 1)], W[2])
    c.line([(x - nx * 5 + dx * 6, y - ny * 5 + dy * 6), (x + nx * 5 + dx * 6, y + ny * 5 + dy * 6)], B[1], 2)
    c.disc(x + dx * 20, y + dy * 20, 2.5, R)
    return x + dx * 21, y + dy * 21


@sheet('cow_milk', 64, 10, 'target', P_MILK, peak=[2, 4, 7])
def cow_milk(c, f):
    W, G, B, R, Y = P_MILK.W, P_MILK.G, P_MILK.B, P_MILK.R[0], P_MILK.Y[0]
    tilt = [0, 40, 95, 120, 125, 125, 110, 80, 50, 20][f]
    by = [8, 14, 18, 18, 18, 18, 17, 14, 10, 6][f]
    if f <= 7:
        mx, my = bottle(c, 44, by + 10, tilt, W, B, R)
        if 2 <= f <= 6:          # 물줄기
            pts = [(mx, my)]
            for i in range(1, 7):
                t = i / 6
                pts.append((lerp(mx, CX, t) + math.sin(t * 5 + f) * 1.2, lerp(my, GY - 4, t)))
            c.line(pts, W[1], 4 if f in (3, 4, 5) else 3)
            c.line(pts, W[2], 2)
    # 물보라
    if f >= 3:
        t = f - 3
        rr = 4 + t * 3.2
        c.disc(CX, GY - 2, rr + 1, W[0], rr * .35 + 1)
        c.disc(CX, GY - 2, rr, W[1], rr * .35)
        c.disc(CX, GY - 3, rr * .5, W[2], rr * .18)
        r = rng('milk')
        for k in range(8):
            a = math.radians(r.uniform(200, 340))
            v = r.uniform(3, 6)
            x = CX + math.cos(a) * v * t * 1.6
            y = GY - 4 + math.sin(a) * v * t * 1.4 + t * t * .55
            if y < GY + 2: c.disc(x, y, 1.4 if t < 4 else 1, W[2] if k % 2 else Y)
    # 치유 십자 상승
    if f >= 4:
        for k in range(3):
            t = f - 4 - k * .8
            if t < 0: continue
            x = CX - 14 + k * 14
            y = GY - 10 - t * 6
            plus(c, x, y, 3 if k == 1 else 2, G[1] if t < 4 else G[0], G[2])
    if f >= 5:
        c.ring(CX, CY - 4, 10 + (f - 5) * 3, G[1] if f < 8 else G[0], 1, 14 + (f - 5) * 3)


P_STAMP = Pal(K=['#141014', '#3a3438'], W=['#9c9c9c', '#f0f0f0'], P=['#e8907a'], D=['#4a3020', '#7a5236', '#b0845a', '#d8b888'],
              S=['#6a2a1a', '#b85a2a', '#f0a050', '#ffe0a0'], H=['#fff6d8'])


def cow_sil(c, x, y, s, leg, K, W, P, H, spot=0):
    """왼쪽으로 달리는 젖소. (x, y) = 몸 중심. leg 는 -1..1 보폭."""
    k0, k1 = K
    # 다리
    for dx, ph in ((-7, 1), (-3, -1), (5, 1), (9, -1)):
        o = leg * ph * 3 * s
        c.line([(x + dx * s, y + 4 * s), (x + dx * s + o, y + 11 * s)], k0, max(2, round(2 * s)))
    c.disc(x, y, 12 * s + 1, k0, 6.5 * s + 1)
    c.disc(x, y, 12 * s, W[1], 6.5 * s)
    for i, (dx, dy, r) in enumerate(((-4, -2, 3.2), (5, 1, 4), (1, 3, 2.4))):
        c.disc(x + (dx + spot) * s, y + dy * s, r * s, k0, r * .8 * s)
    c.poly([(x + 11 * s, y - 3 * s), (x + 16 * s, y - 6 * s), (x + 12 * s, y)], k0)     # 꼬리
    # 머리(낮게 숙여 돌진)
    hx, hy = x - 13 * s, y + 1 * s
    c.disc(hx, hy, 5.2 * s + 1, k0, 4.2 * s + 1)
    c.disc(hx, hy, 5.2 * s, W[1], 4.2 * s)
    c.disc(hx - 3.5 * s, hy + 1.8 * s, 2.6 * s, P, 2 * s)
    c.px(hx - 1 * s, hy - 1.5 * s, k0)
    c.poly([(hx + 1 * s, hy - 3.5 * s), (hx - 5 * s, hy - 8 * s), (hx - 1 * s, hy - 3 * s)], H)   # 뿔
    c.poly([(hx + 3 * s, hy - 3.5 * s), (hx + 1 * s, hy - 9 * s), (hx + 4.5 * s, hy - 3 * s)], H)


@sheet('cow_stampede_sky', 128, 12, 'screen', P_STAMP, peak=[3, 6, 9])
def cow_stampede_sky(c, f):
    K, W, P, D, S, H = P_STAMP.K, P_STAMP.W, P_STAMP.P[0], P_STAMP.D, P_STAMP.S, P_STAMP.H[0]
    # 저녁 들판 하늘
    c.rect(0, 0, 127, 127, S[0])
    c.dither(lambda cc: cc.rect(0, 30, 127, 127, S[1]), 0)
    c.rect(0, 52, 127, 127, S[1])
    c.dither(lambda cc: cc.rect(0, 70, 127, 127, S[2]), 1)
    c.rect(0, 96, 127, 127, D[1])
    c.rect(0, 100, 127, 127, D[0])
    # 흙먼지 벽(오른쪽에서 따라옴)
    r = rng('stamp_dust')
    DUST = [(r.uniform(0, 1), r.uniform(-8, 8), r.uniform(7, 13)) for _ in range(12)]
    front = 118 - f * 12
    for u, dy, rr in DUST:
        x = front + 20 + u * 90
        if x - rr > 130: continue
        puff(c, x, 92 + dy, rr, [D[1], D[2], D[3]])
    # 소 떼(뒤 줄 작게, 앞 줄 크게)
    herd = [(0, 76, .75, 0), (26, 80, .8, 2), (52, 74, .7, -1), (10, 94, 1.05, 1), (44, 98, 1.1, -2)]
    for i, (off, y, s, sp) in enumerate(herd):
        x = front + off
        if -30 < x < 160:
            bob = (f + i) % 2
            cow_sil(c, x, y - bob, s, 1 if (f + i) % 2 else -1, K, W, P, H, spot=sp)
    # 앞쪽에 튀는 흙
    for k in range(10):
        x = front - 16 + k * 9
        y = 108 + ((k * 5 + f * 3) % 9)
        if 2 < x < 125: c.rect(x, y, x + 1, y + 1, D[2] if k % 2 else D[3])
    # 속도선
    for k in range(6):
        y = 20 + k * 12 + (f % 2) * 3
        x0 = (k * 37 + f * 20) % 150 - 10
        c.line([(x0, y), (x0 + 14, y)], S[3] if k % 2 else S[2])

