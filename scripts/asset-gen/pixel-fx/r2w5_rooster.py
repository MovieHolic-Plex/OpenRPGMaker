"""수탉(rooster) 이펙트 시트 10종 — retro2003 로스터 b1. 색 정체성: 붉은 볏·깃, 노란 부리·발톱, 새벽 주황·분홍, 깃털 크림.
부리 찌르기·새벽 햇살 부채·깃털 회오리·며느리발톱 호·달걀·붉은 볏 불꽃·화염 울음·일출 하늘과 수탉 실루엣·황금 빛기둥."""
from lib_r2w5 import *

P_PECK = Pal(O=['#3a1a04'], Y=['#c8781a', '#ffc83a', '#fff08a'], R=['#8a1410', '#e0342a'], W=['#ffffff', '#f6e8d0'])


@sheet('rooster_peck', 64, 8, 'target', P_PECK, peak=[1, 3, 5])
def rooster_peck(c, f):
    O, Y, R, W = P_PECK.O[0], P_PECK.Y, P_PECK.R, P_PECK.W
    spots = [(22, 26), (38, 40), (26, 44), (40, 24)]
    def beak(x, y, ang, s):
        # 위 부리 + 아래 부리(살짝 벌어진), 끝이 (x, y)
        dx, dy = math.cos(ang), math.sin(ang)
        bx, by = x - dx * 16 * s, y - dy * 16 * s
        nx, ny = -dy, dx
        c.poly([(bx + nx * 5 * s - dx, by + ny * 5 * s - dy), (x + dx * 1.6, y + dy * 1.6), (bx - nx * 1 * s - dx, by - ny * 1 * s - dy)], O)
        c.poly([(bx + nx * 4 * s, by + ny * 4 * s), (x, y), (bx - nx * 0 * s, by - ny * 0 * s)], Y[1])
        c.poly([(bx + nx * 3 * s, by + ny * 3 * s), (bx + dx * 8 * s + nx * 2 * s, by + dy * 8 * s + ny * 2 * s), (bx + dx * 4 * s + nx * 1 * s, by + dy * 4 * s + ny * 1 * s)], Y[2])
        c.poly([(bx - nx * 1 * s, by - ny * 1 * s), (x - nx * .5, y - ny * .5), (bx - nx * 4 * s, by - ny * 4 * s)], Y[0])
    seq = [(0, 0, .35), (1, 1, .15), (2, 2, .35), (3, 3, .15)]
    for i in range(4):
        fi = i * 2 - 1
        if f == fi + 0 and fi >= 0:
            x, y = spots[i]
            beak(x + 12, y - 16, math.radians(130), 1.0)               # 내려오는 중
            speed(c, x + 18, y - 22, x + 8, y - 12, [W[0], Y[2]], n=3, gap=3, ln=7)
        elif f == fi + 1:
            x, y = spots[i]
            beak(x + 2, y - 2, math.radians(130), 1.15)                # 콕
            c.spark(x - 2, y + 1, 6, W[0], W[0])
    if f == 0:
        x, y = spots[0]
        beak(x + 14, y - 18, math.radians(130), 1.0)
    for i in range(4):
        if f >= i * 2:
            x, y = spots[i]
            for dx, dy in ((0, 0), (2, 3), (-3, 2)):
                c.rect(x + dx - 1, y + dy - 1, x + dx, y + dy, R[0])
                c.px(x + dx - 1, y + dy - 1, R[1])
    r = rng('peck')
    for k in range(6):
        i = min(3, f // 2)
        x, y = spots[i]
        t = f - i * 2
        if t >= 1:
            a = r.uniform(-3.4, -0.2)
            c.px(x + math.cos(a) * (4 + t * 3), y + math.sin(a) * (4 + t * 3) + t, W[1] if k % 2 else R[1])


P_DAWN = Pal(S=['#c84a10', '#ff8a1e', '#ffd23a', '#fff6b0'], P=['#d84a78', '#ffa0c0'], W=['#ffffff'])


@sheet('rooster_dawn', 64, 10, 'allAllies', P_DAWN, peak=[3, 5, 8])
def rooster_dawn(c, f):
    S, P, W = P_DAWN.S, P_DAWN.P, P_DAWN.W[0]
    cx, gy = 32, 50
    rise = [4, 10, 16, 22, 26, 28, 28, 26, 22, 16][f]
    fade = f >= 8
    # 햇살 부채(뒤)
    def rays(cc):
        n = 9
        for k in range(n):
            a = math.radians(180 + (k + .5) * 180 / n)
            L = 30 + (k % 2) * 6
            x1, y1 = cx + math.cos(a) * L * min(1, (f + 1) / 4), gy - rise * .5 + math.sin(a) * L * min(1, (f + 1) / 4)
            wdt = .10
            cc.poly([(cx, gy - rise * .5), (cx + math.cos(a - wdt) * L * min(1, (f + 1) / 4), gy - rise * .5 + math.sin(a - wdt) * L * min(1, (f + 1) / 4)), (x1, y1),
                     (cx + math.cos(a + wdt) * L * min(1, (f + 1) / 4), gy - rise * .5 + math.sin(a + wdt) * L * min(1, (f + 1) / 4))], S[1] if k % 2 else P[0])
    (c.dither(rays, f) if fade else rays(c))
    # 떠오르는 해
    c.disc(cx, gy - rise * .5 + 6, 12, S[0], 12 * rise / 28 + 3)
    c.disc(cx, gy - rise * .5 + 6, 10, S[1], 10 * rise / 28 + 2)
    c.disc(cx, gy - rise * .5 + 6, 6, S[2], 6 * rise / 28 + 1)
    c.rect(0, gy + 3, 63, 63, 0)
    # 울음소리 물결
    for k in range(3):
        t = f - 3 - k * 1.2
        if t > 0 and t < 5:
            r = 8 + t * 8
            c.arc(cx, gy - 14, r, 200, 340, S[3] if t < 2.5 else S[2], 2, r * .7)
    # 반짝임
    for k in range(6):
        x = 8 + k * 9.6
        y = 46 - ((f * 5 + k * 7) % 34)
        c.spark(x, y, 1, S[3], W) if (k + f) % 2 else c.px(x, y, S[2])


P_GUST = Pal(W=['#3a7a72', '#8ad8c8', '#e0fff4'], R=['#8a1410', '#e0342a', '#ff8070'], F=['#a89880', '#f6ecd4'], O=['#3a1a10'])


@sheet('rooster_gust', 64, 9, 'allTargets', P_GUST, peak=[2, 4, 7])
def rooster_gust(c, f):
    W, R, F, O = P_GUST.W, P_GUST.R, P_GUST.F, P_GUST.O[0]
    cx, cy = 32, 32
    grow = [.4, .7, 1, 1.05, 1.05, 1, .9, .7, .5][f]
    rot = f * .7
    # 소용돌이: 세 가닥 초승달 바람 날
    for k in range(3):
        a0 = rot * 57 + k * 120
        r = 22 * grow
        crescent(c, cx, cy, r, a0, a0 + 110, 4.2, [W[0], W[1], W[2]], u=1, ry=r * .8, tail=.1)
    # 깃털 회오리
    for k in range(10):
        a = rot + k * math.tau / 10
        rad = (10 + (k % 3) * 6) * grow + f * .5
        x, y = orbit(cx, cy, rad, a, rad * .75)
        ang = a + math.pi / 2 + .5
        col, edge = (R[1], R[0]) if k % 2 else (F[1], F[0])
        if k % 3 == 0:
            col, edge = R[2], R[0]
        LM.feather(c, x, y, 6 + (k % 2) * 2, ang, col, edge)
    if f >= 6:
        for k in range(5):
            x = 8 + k * 12
            y = 10 + ((k * 9 + f * 6) % 40)
            LM.feather(c, x, y, 5, .6 + k, F[1], F[0])
    c.spark(cx, cy, 2, W[2], W[2])


P_SPUR = Pal(O=['#2a1808'], G=['#8a5a10', '#e0a828', '#ffe680'], W=['#ffffff'], D=['#6a4a2a', '#b08858'])


@sheet('rooster_spur', 64, 8, 'target', P_SPUR, peak=[1, 3, 5])
def rooster_spur(c, f):
    O, G, W, D = P_SPUR.O[0], P_SPUR.G, P_SPUR.W[0], P_SPUR.D
    cx, cy = 30, 34
    # 오른쪽 위에서 왼쪽 아래로 크게 휘어 찌르는 뿔 모양 발톱(아래로 갈수록 뾰족)
    def spur(cc, u, tl=0):
        pts = arc_pts(cx + 12, cy - 22, 34, 118, 118 + 62 * u, ry=34)
        if tl:
            pts = pts[int(len(pts) * tl):]
        if len(pts) < 3:
            return
        n = len(pts)
        widths = [max(.6, 5.6 * (1 - i / n) ** .8 + .6) for i in range(n)]
        strip(cc, pts, [w + 1.2 for w in widths], O)
        strip(cc, pts, widths, G[1])
        strip(cc, pts, [w * .5 for w in widths], G[2])
        cc.line([pts[-1], (pts[-1][0] - 1, pts[-1][1] + 1)], W)
    if f <= 3:
        spur(c, [.35, .7, 1, 1][f])
    else:
        c.dither(lambda cc: spur(cc, 1, tl=(f - 3) * .2), f)
    if f in (2, 3):
        burst(c, cx - 10, cy + 12, 14, 5, 8, G[2], seed=5)
        c.spark(cx - 10, cy + 12, 5, W, W)
    if f >= 3:
        for k in range(7):
            a = math.radians(-160 + k * 24)
            t = f - 2
            c.rect(cx - 10 + math.cos(a) * 6 * t, cy + 14 + math.sin(a) * 5 * t + t * t * .6, cx - 9 + math.cos(a) * 6 * t, cy + 15 + math.sin(a) * 5 * t + t * t * .6, D[1])
    if f >= 2:
        c.ring(cx - 10, cy + 12, 6 + (f - 2) * 4, W if f < 5 else G[2], 1, (6 + (f - 2) * 4) * .7)


P_EGG = Pal(E=['#8a7a58', '#e8dcc0', '#fffaf0'], O=['#3a2c18'])


@sheet('rooster_egg', 32, 4, 'projectile', P_EGG)
def rooster_egg(c, f):
    E, O = P_EGG.E, P_EGG.O[0]
    cx, cy = 15, 16
    tilt = [-.5, 0, .5, 0][f]
    rot = [0, .3, 0, -.3][f]
    def egg(k, col):
        pts = []
        for i in range(20):
            t = i * math.tau / 20
            x = math.cos(t) * 5.6 * k
            y = math.sin(t) * (7 + 1.6 * (math.sin(t) < 0)) * k
            pts.append((cx + x * math.cos(rot) - y * math.sin(rot) + tilt, cy + x * math.sin(rot) + y * math.cos(rot)))
        c.poly(pts, col)
    egg(1.18, O)
    egg(1.0, E[1])
    c.disc(cx - 2 + tilt, cy - 3, 1.6, E[2])
    c.line([(cx - 3, cy + 4), (cx + 3, cy + 5)], E[0])
    for i, dy in enumerate((-5, 0, 5)):
        c.px(27 - (f + i) % 3, 14 + dy, E[1])


P_EGGB = Pal(Y=['#c87a10', '#ffc41e', '#fff06a'], W=['#b8b8c0', '#ffffff'], S=['#8a7a58', '#e8dcc0'], O=['#3a2c18'])


@sheet('rooster_egg_burst', 64, 8, 'target', P_EGGB, peak=[1, 3, 5])
def rooster_egg_burst(c, f):
    Y, W, S, O = P_EGGB.Y, P_EGGB.W, P_EGGB.S, P_EGGB.O[0]
    cx, cy = 30, 36
    if f == 0:
        c.disc(cx + 6, cy - 6, 6, O, 7); c.disc(cx + 6, cy - 6, 5, S[1], 6)
        speed(c, cx + 14, cy - 12, cx + 6, cy - 6, [S[1]], n=3, gap=3, ln=6)
        return
    t = f - 1
    # 노른자·흰자 왕관 물보라
    n = 12
    for k in range(n):
        a = math.radians(-180 + (k + .5) * 180 / n)
        L = 6 + t * 3.4 + (k % 3) * 3
        x, y = cx + math.cos(a) * L, cy + 4 + math.sin(a) * L * 1.1 + t * t * .35
        if t <= 4:
            c.line([(cx + math.cos(a) * 3, cy + 4 + math.sin(a) * 3), (x, y)], W[1] if k % 2 else Y[1])
            c.disc(x, y, 1.6 if k % 2 else 2.2, Y[1] if k % 2 == 0 else W[1])
            c.px(x - 1, y - 1, Y[2] if k % 2 == 0 else W[1])
    # 바닥 웅덩이
    rx = 6 + min(t, 4) * 3.4
    c.disc(cx, cy + 12, rx, W[1] if t < 5 else W[0], rx * .32)
    c.disc(cx, cy + 12, rx * .55, Y[1], rx * .18)
    c.px(cx - 2, cy + 11, Y[2])
    # 껍데기 조각
    for k in range(5):
        a = math.radians(-160 + k * 34)
        x, y = cx + math.cos(a) * (8 + t * 4), cy - 2 + math.sin(a) * (8 + t * 3.4) + t * t * .8
        c.poly([(x, y), (x + 3, y + 1), (x + 1, y + 3)], S[1])
        c.px(x, y, W[1])
    # 흘러내림
    if t >= 4:
        for x in (cx - 8, cx + 2, cx + 9):
            c.line([(x, cy + 6), (x, cy + 9 + (t - 4) * 2)], Y[1])
    if 1 <= f <= 3:
        burst(c, cx, cy + 2, 16 - t * 2, 6, 8, Y[2], seed=6)


P_COMB = Pal(F=['#6a0808', '#c81c1c', '#ff5a28', '#ffb040', '#fff2a0'], O=['#2a0404'], W=['#ffffff'])


@sheet('rooster_comb', 64, 10, 'user', P_COMB, peak=[3, 5, 8])
def rooster_comb(c, f):
    F, O, W = P_COMB.F, P_COMB.O[0], P_COMB.W[0]
    cx, gy = 32, 54
    h = [10, 18, 26, 32, 34, 34, 32, 28, 20, 12][f]
    lean = math.sin(f * 1.4) * 3
    # 몸 둘레 붉은 기운 고리
    c.ring(cx, 40, 20, F[0], 2, 12) if f >= 1 else None
    # 볏 모양 불꽃: 톱니 세 봉우리 + 곁불꽃
    for i, (dx, hh) in enumerate(((-12, .55), (-6, .8), (0, 1.0), (6, .82), (12, .5))):
        LM.flame(c, cx + dx, gy - 8, h * hh, 6 + (i == 2) * 1.5, F[1:], lean=lean * (i - 2) * .5)
    # 열기: 위로 오르는 불티
    for k in range(9):
        x = cx - 16 + k * 4 + math.sin(f + k) * 2
        y = gy - 18 - ((f * 6 + k * 11) % 36)
        c.px(x, y, F[3] if k % 2 else F[4])
        if k % 3 == 0:
            c.px(x, y + 1, F[2])
    if f in (3, 4):
        c.spark(cx, gy - h - 4, 3, W, W)


P_FCROW = Pal(F=['#8a1808', '#e83a10', '#ff8a1e', '#ffd23a', '#fff6b8'], O=['#3a0808'], S=['#5a5058', '#a89ea6'])


@sheet('rooster_flame_crow', 64, 10, 'allTargets', P_FCROW, peak=[3, 5, 8])
def rooster_flame_crow(c, f):
    F, O, S = P_FCROW.F, P_FCROW.O[0], P_FCROW.S
    cx, gy = 32, 54
    # 화염 기둥 다섯 개가 좌우로 번져 나가며 솟는다(소리를 따라 퍼지는 불길)
    for i, dx in enumerate((0, -11, 11, -21, 21)):
        st = abs(dx) / 11 * 1.2
        t = f - st
        if t <= 0:
            continue
        h = [10, 24, 38, 46, 44, 38, 28, 18, 10, 4][min(9, int(t))] * (1 - abs(dx) / 60)
        if h <= 2:
            continue
        LM.flame(c, cx + dx, gy, h, 7.5 - abs(dx) * .08, F[1:], lean=math.sin(f + i) * 3)
    # 불꽃 깃털: 위로 흩날리는 작은 깃 모양 불
    for k in range(9):
        x = 8 + k * 6.6
        y = gy - 8 - ((f * 5 + k * 13) % 42)
        LM.feather(c, x, y, 5, -1.2 + math.sin(k) * .5, F[3] if k % 2 else F[2], F[1])
    # 바닥 그을음 고리
    rx = 10 + f * 3
    if f <= 5:
        c.ring(cx, gy + 1, rx, F[2], 1, rx * .25)
    else:
        c.dither(lambda cc: cc.ring(cx, gy + 1, rx, S[1], 1, rx * .25), f)
    if f >= 5:
        for k in range(5):
            puff_x = 14 + k * 9
            c.dither(lambda cc, x=puff_x, k=k: puff(cc, x, 12 + (f - 5) * -1 + (k % 2) * 4, 3 + (f - 5) * .8, [S[0], S[0], S[1]]), f + k)


P_SSKY = Pal(N=['#3a1a58', '#7a2a78', '#d8487a', '#ff9a5a'], S=['#ffb42a', '#ffe266', '#fff8c0'], K=['#1a0a24'])


def rooster_sil(c, x, y, col, rim, beak_open=1.0):
    """왼쪽을 보고 우는 수탉 실루엣(x, y = 발 밑 중앙)."""
    c.disc(x, y - 22, 16, col, 12)                                     # 몸통
    c.poly([(x - 6, y - 26), (x - 20, y - 44), (x - 24, y - 52), (x - 14, y - 50), (x - 4, y - 36)], col)   # 목
    c.disc(x - 22, y - 54, 6, col, 5.2)                                # 머리
    c.poly([(x - 28, y - 56), (x - 38, y - 60 - 2 * beak_open), (x - 28, y - 52)], col)  # 위 부리
    c.poly([(x - 28, y - 52), (x - 37, y - 50 + 4 * beak_open), (x - 27, y - 49)], col)  # 아래 부리
    for i, dx in enumerate((-5, -1, 3)):                                # 볏
        c.disc(x - 22 + dx, y - 61 - (i == 1), 2.6, col)
    c.disc(x - 27, y - 48, 2.4, col, 3.2)                              # 턱볏
    for i, a in enumerate((-160, -140, -118, -96, -76)):               # 꼬리 깃
        ax_, ay_ = x + 12, y - 30
        L = 30 - abs(i - 2) * 3
        tip = (ax_ + math.cos(math.radians(a)) * L, ay_ + math.sin(math.radians(a)) * L)
        c.poly([(ax_, ay_ - 2), tip, (ax_ + 3, ay_ + 3)], col)
    for dx in (-4, 5):
        c.rect(x + dx, y - 11, x + dx + 1, y, col)
        c.rect(x + dx - 3, y - 1, x + dx + 3, y, col)
    c.line([(x - 26, y - 59), (x - 36, y - 60 - 2 * beak_open)], rim)
    c.line([(x - 26, y - 58), (x - 20, y - 60)], rim)
    c.line([(x - 22, y - 47), (x - 14, y - 34), (x - 4, y - 32)], rim)


@sheet('rooster_sunrise_sky', 128, 12, 'screen', P_SSKY, peak=[2, 6, 9])
def rooster_sunrise_sky(c, f):
    N, S, K = P_SSKY.N, P_SSKY.S, P_SSKY.K[0]
    rise = [0, 8, 16, 26, 34, 40, 44, 44, 42, 38, 32, 26][f]
    # 하늘 띠(밑이 밝다)
    c.rect(0, 0, 127, 127, N[0])
    for i, col in enumerate((N[1], N[2], N[3])):
        y0 = 110 - i * 22 - rise * .5
        c.dither(lambda cc, y0=y0, col=col: cc.rect(0, y0, 127, 127, col), f + i) if False else c.rect(0, max(0, y0 + 10), 127, 127, col)
    c.dither(lambda cc: cc.rect(0, 0, 127, 127, N[1]), f)
    # 햇살 부채
    sx, sy = 64, 124 - rise
    n = 14
    for k in range(n):
        a = math.radians(180 + (k + .5) * 180 / n + f * 1.5)
        wdt = .07
        L = 150
        c.poly([(sx, sy), (sx + math.cos(a - wdt) * L, sy + math.sin(a - wdt) * L), (sx + math.cos(a + wdt) * L, sy + math.sin(a + wdt) * L)], N[3] if k % 2 == 0 else N[2])
    c.dither(lambda cc: cc.rect(0, 0, 127, 127, N[1]), f + 1) if False else None
    # 해
    c.disc(sx, sy, 34, N[3], 34)
    c.disc(sx, sy, 30, S[0], 30)
    c.disc(sx, sy, 24, S[1], 24)
    c.disc(sx - 4, sy - 4, 14, S[2], 14)
    # 지평선 실루엣
    c.rect(0, 118, 127, 127, K)
    for i in range(10):
        c.poly([(i * 14, 118), (i * 14 + 7, 112 - (i % 3) * 3), (i * 14 + 14, 118)], K)
    # 수탉
    if f >= 2:
        up = max(0, 30 - (f - 2) * 10)
        rooster_sil(c, 84, 118 + up, K, S[2], beak_open=1.0 if f >= 4 else .2)
    # 울음 소리 호
    if f >= 4:
        for k in range(3):
            t = f - 4 - k * 1.4
            if 0 < t < 6:
                r = 6 + t * 10
                c.arc(46, 62, r, 150, 250, S[2] if t < 3 else S[0], 2, r * 1.1)


P_SHIT = Pal(S=['#c86a10', '#ffb42a', '#ffe266', '#fff8c0'], W=['#ffffff'], G=['#f0a8c0'])


@sheet('rooster_sunrise_hit', 64, 8, 'allTargets', P_SHIT, peak=[1, 3, 5])
def rooster_sunrise_hit(c, f):
    S, W, G = P_SHIT.S, P_SHIT.W[0], P_SHIT.G[0]
    cx, gy = 32, 52
    w = [3, 8, 12, 13, 11, 8, 5, 2][f]
    top = [40, 6, 2, 2, 2, 4, 14, 30][f]
    # 위에서 내리꽂는 황금 빛기둥
    c.rect(cx - w, top, cx + w, gy, S[1])
    c.rect(cx - w * .6, top, cx + w * .6, gy, S[2])
    c.rect(cx - w * .25, top, cx + w * .25, gy, S[3])
    # 기둥 위 해 원반
    if 1 <= f <= 6:
        c.disc(cx, 8, 9 + (f == 3) * 2, S[0], 7); c.disc(cx, 8, 7, S[1], 5.5); c.disc(cx, 8, 4, S[3], 3)
    # 지면 폭발 고리와 햇살
    if f >= 2:
        rr = 6 + (f - 2) * 5
        c.ring(cx, gy, rr, S[2], 2, rr * .3)
        n = 8
        for k in range(n):
            a = math.radians(180 + (k + .5) * 180 / n)
            L = 8 + (f - 2) * 4
            c.line([(cx + math.cos(a) * 6, gy + math.sin(a) * 6), (cx + math.cos(a) * (6 + L), gy + math.sin(a) * (6 + L) * .8)], S[1] if k % 2 else S[3])
    for k in range(6):
        x = cx - 14 + k * 5.6
        y = gy - ((f * 6 + k * 9) % 44)
        c.spark(x, y, 1, S[3], W) if k % 2 else c.px(x, y, G)
    if f in (2, 3):
        c.spark(cx, gy - 2, 5, W, W)
