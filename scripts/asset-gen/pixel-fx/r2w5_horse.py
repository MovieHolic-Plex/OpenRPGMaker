"""군마(horse) 이펙트 시트 2종 — retro2003 로스터 b1. 색: 밤색 갈기, 쇠 편자 은색, 섬광 노랑, 천마 흰 날개·하늘 파랑.
뒷발 걷어차기(편자 두 개가 오른쪽 위에서 꽂혀 별 모양 충격) · 천마 강림(하늘을 가르며 왼쪽 아래로 내달리는 흰 날개 말)."""
from lib_r2w5 import *

P_HOOF = Pal(I=['#3a3a4a', '#8a8aa6', '#d6d6e8'], Y=['#c88a1a', '#ffd23a', '#fff6b0'], W=['#ffffff'], D=['#6a4020', '#a46229', '#d5a462'])


def horseshoe(c, x, y, s, ang, I):
    """U 자 편자. ang = 열린 쪽 방향."""
    for col, w in ((I[0], 4), (I[1], 2)):
        pts = []
        for i in range(11):
            a = ang + math.radians(40 + i * 28)
            pts.append((x + math.cos(a) * 6 * s, y + math.sin(a) * 6 * s))
        c.line(pts, col, max(1, round(w * s)))
    for i in (2, 5, 8):
        a = ang + math.radians(40 + i * 28)
        c.px(x + math.cos(a) * 6 * s, y + math.sin(a) * 6 * s, I[2])


@sheet('horse_hoof', 64, 8, 'target', P_HOOF, peak=[1, 3, 5])
def horse_hoof(c, f):
    I, Y, W, D = P_HOOF.I, P_HOOF.Y, P_HOOF.W[0], P_HOOF.D
    spots = [(24, 34), (38, 42)]
    for i, (x, y) in enumerate(spots):
        t = f - i * 2          # 두 번째 발은 두 칸 늦게
        if t < 0: continue
        if t == 0:
            horseshoe(c, x + 14, y - 14, 1.1, math.radians(130), I)
            speed(c, x + 20, y - 20, x + 8, y - 8, [I[2], Y[2]], n=3, gap=4, ln=9)
        elif t == 1:
            burst(c, x, y, 14, 6, 7, Y[1], rot=f * .3, seed=i)
            burst(c, x, y, 9, 4, 7, Y[2], rot=f * .3 + .2, seed=i + 3)
            horseshoe(c, x + 1, y - 1, 1.25, math.radians(130), I)
        elif t <= 4:
            rr = 8 + t * 4
            c.ring(x, y, rr, Y[1] if t < 3 else Y[0], 1, rr * .8)
            horseshoe(c, x, y, 1.1, math.radians(130), I) if t < 3 else c.dither(lambda cc: horseshoe(cc, x, y, 1.1, math.radians(130), I), f)
            for k in range(5):
                a = math.radians(200 + k * 30)
                c.rect(x + math.cos(a) * rr * 1.1, y + math.sin(a) * rr * .8 + t, x + math.cos(a) * rr * 1.1 + 1, y + math.sin(a) * rr * .8 + t + 1, D[k % 3])
        else:
            c.dither(lambda cc: cc.ring(x, y, 20 + t * 2, Y[0], 1, 16 + t * 2), f + i)
    if f in (1, 3):
        c.spark(spots[f // 2][0], spots[f // 2][1], 5, W, W)


P_PEG = Pal(N=['#1a2a6a', '#2c52a8', '#4a86d8', '#8ac4f4'], W=['#9aa8d0', '#dce4f8', '#ffffff'], G=['#c8961e', '#ffd84a', '#fff6c0'],
            M=['#e8b0ff'], K=['#3a3a5a'])


def pegasus(c, x, y, s, flap, N, W, G, K):
    """왼쪽 아래로 내달리는 천마. (x, y) = 가슴. flap 0 날개 위, 1 수평, 2 아래."""
    lean = .35
    # 뒤 날개
    tip = [-22, -8, 6][flap] * s
    c.poly([(x + 8 * s, y - 2 * s), (x + 20 * s, y + tip - 4 * s), (x + 30 * s, y + tip), (x + 18 * s, y + 3 * s)], W[0])
    # 몸
    c.disc(x + 7 * s, y + 2 * s, 11 * s + 1, W[0], 5.5 * s + 1)
    c.disc(x + 7 * s, y + 2 * s, 11 * s, W[1], 5.5 * s)
    c.disc(x + 5 * s, y, 7 * s, W[2], 3 * s)
    # 목·머리
    c.line([(x - 1 * s, y), (x - 7 * s, y - 7 * s)], W[1], max(3, round(5 * s)))
    c.disc(x - 9 * s, y - 8 * s, 3.4 * s, W[1], 2.4 * s)
    c.disc(x - 12 * s, y - 7 * s, 2 * s, W[1], 1.6 * s)
    c.px(x - 9 * s, y - 9 * s, K)
    # 갈기(금빛)
    for k in range(4):
        c.line([(x - 6 * s + k * 2 * s, y - 9 * s + k * 2 * s), (x - 2 * s + k * 2 * s, y - 12 * s + k * 2 * s)], G[1])
    # 다리(앞으로 뻗음)
    c.line([(x - 2 * s, y + 5 * s), (x - 10 * s, y + 8 * s)], W[0], max(1, round(2 * s)))
    c.line([(x + 1 * s, y + 6 * s), (x - 6 * s, y + 11 * s)], W[0], max(1, round(2 * s)))
    c.line([(x + 14 * s, y + 5 * s), (x + 20 * s, y + 10 * s)], W[0], max(1, round(2 * s)))
    c.line([(x + 17 * s, y + 3 * s), (x + 24 * s, y + 5 * s)], G[1], max(1, round(2 * s)))    # 꼬리
    # 앞 날개
    c.poly([(x + 4 * s, y - 2 * s), (x + 12 * s, y + tip - 8 * s), (x + 24 * s, y + tip - 6 * s), (x + 14 * s, y + 1 * s)], W[2])
    for k in range(3):
        c.line([(x + (8 + k * 4) * s, y + tip * (.3 + k * .2) - 3 * s), (x + (12 + k * 4) * s, y + tip * (.4 + k * .2) - 1 * s)], W[0])


@sheet('horse_pegasus_sky', 128, 12, 'screen', P_PEG, peak=[3, 6, 9])
def horse_pegasus_sky(c, f):
    N, W, G, M, K = P_PEG.N, P_PEG.W, P_PEG.G, P_PEG.M[0], P_PEG.K[0]
    c.rect(0, 0, 127, 127, N[0])
    c.dither(lambda cc: cc.rect(0, 28, 127, 127, N[1]), 0)
    c.rect(0, 50, 127, 127, N[1])
    c.dither(lambda cc: cc.rect(0, 80, 127, 127, N[2]), 1)
    c.rect(0, 104, 127, 127, N[2])
    # 구름 띠
    for k in range(4):
        x = (k * 41 - f * 6) % 170 - 20
        cloud(c, x, 96 + (k % 2) * 10, 9, [N[3], W[1], W[2]])
    # 천마 경로: 오른쪽 위 → 왼쪽 아래
    t = f / 11.0
    x = lerp(112, 22, ease(t))
    y = lerp(20, 78, ease(t))
    # 빛 꼬리
    for j in range(1, 7):
        tt = max(0, t - j * .06)
        tx, ty = lerp(112, 22, ease(tt)) + 14, lerp(20, 78, ease(tt)) + 2
        c.disc(tx, ty, max(1, 6 - j * .8), G[1] if j < 3 else G[0], max(1, 3 - j * .4))
        if j % 2: c.spark(tx + 4, ty - 5, 1, G[2])
    pegasus(c, x, y, 1.15, f % 3, N, W, G, K)
    # 깃털
    r = rng('peg_feather')
    for k in range(7):
        u = (r.random() + f * .09) % 1
        fx_, fy_ = lerp(120, 10, u), lerp(10, 110, u) + math.sin(u * 9 + k) * 10
        LM.feather(c, fx_, fy_, 5, math.radians(r.uniform(30, 150)), W[2], W[0])
    # 착지 섬광
    if f >= 9:
        rr = (f - 8) * 9
        c.ring(22, 92, rr, G[2], 2, rr * .4)
        c.spark(22, 88, 6 + (f - 9) * 2, G[2], W[2], diag=True)

