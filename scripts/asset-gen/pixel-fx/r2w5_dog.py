"""충견(dog) 이펙트 시트 11종 — retro2003 로스터 b1. 색 정체성: 호박빛 털·뼈 상아색·흙빛, 필살기만 달빛 은청.
같은 직업 여덟 스킬이 서로 다르게 보이도록 모양·움직임을 각자 새로 그렸다(턱·충격 폭발·방패 문장·발톱 자국·혜성 돌진·흙 회오리·뼈다귀·달과 늑대)."""
from lib_r2w5 import *

# ---- 팔레트 ----
P_BITE = Pal(O=['#2a0c10'], T=['#8a7a68', '#eee2c4', '#ffffff'], G=['#5a0c1c', '#b02036', '#f05868'], S=['#ff9a2a', '#ffe070', '#ffffff'])


@sheet('dog_bite', 64, 8, 'target', P_BITE, peak=[2, 3, 5])
def dog_bite(c, f):
    O, T, G, S = P_BITE.O[0], P_BITE.T, P_BITE.G, P_BITE.S
    cx, cy = 30, 36
    if f <= 4:
        gap = [24, 14, 6, 0, 0][f]
        shake = 1 if f == 4 else 0
        if f == 3:
            burst(c, cx, cy, 30, 11, 10, S[0], rot=.2, jag_=.1, seed=2)
            burst(c, cx, cy, 22, 8, 10, S[1], rot=.2, jag_=.1, seed=3)
        if f == 4:
            burst(c, cx, cy, 16, 6, 8, S[1], rot=.4, seed=4)
        ux, uy = cx + shake, cy - gap - 4
        lx, ly = cx - shake, cy + gap + 4
        jaw_row(c, ux, uy, 17, +1, 6, 7, G[1], T[1], O, curve=6)
        jaw_row(c, lx, ly, 15, -1, 5, 6, G[0], T[0] if f < 3 else T[1], O, curve=6)
        if f >= 3:
            c.spark(cx, cy, 3, S[2], S[2])
    if f >= 3:
        # 깊이 물린 자국: 위아래 이빨 구멍 두 줄 + 붉은 찢김
        fadei = f >= 5
        def marks(cc):
            for i in range(6):
                x = cx - 15 + i * 6
                cc.rect(x, cy - 7, x + 1, cy - 5, G[1])
                cc.px(x, cy - 7, G[2])
            for i in range(5):
                x = cx - 12 + i * 6
                cc.rect(x, cy + 5, x + 1, cy + 7, G[1])
                cc.px(x, cy + 7, G[2])
            gash(cc, cx + 14, cy - 12, cx - 16, cy + 14, 3, [G[0], G[2]], u=1.0, bow=-2)
        (c.dither(marks, f) if f >= 6 else marks(c))
        if f >= 7:
            c.im.paste(0, (0, 0, 64, 64), None) if False else None
    if 4 <= f <= 6:
        r = rng('dogbite', f)
        for _ in range(5):
            a = r.uniform(0, math.tau)
            d = 12 + (f - 3) * 5 + r.uniform(0, 6)
            c.px(cx + math.cos(a) * d, cy + math.sin(a) * d * .8 - (f - 3) * 2, G[2] if _ % 2 else S[1])


P_BARKW = Pal(Y=['#7a420a', '#e8961e', '#ffd860', '#ffffff'])


@sheet('dog_bark_wave', 32, 4, 'projectile', P_BARKW)
def dog_bark_wave(c, f):
    Y = P_BARKW.Y
    for k in range(3):
        x = 27 - ((f * 2 + k * 8) % 24)
        r = 4 + (27 - x) * 0.42
        ry = r * 1.35
        c.arc(x, 16, r, 118, 242, Y[0], 4, ry)
        c.arc(x, 16, r, 118, 242, Y[1], 2, ry)
        if k == 1:
            c.arc(x + 1, 16, r - 1, 128, 232, Y[3], 1, ry - 1)
    c.disc(29, 16, 2, Y[2])
    c.px(29, 16, Y[3])


P_BARKH = Pal(O=['#4a2004'], Y=['#e07a14', '#ffc030', '#ffec80'], W=['#ffffff'], R=['#a8c0e8'])


@sheet('dog_bark_hit', 64, 8, 'target', P_BARKH, peak=[2, 3, 5])
def dog_bark_hit(c, f):
    O, Y, W, R = P_BARKH.O[0], P_BARKH.Y, P_BARKH.W[0], P_BARKH.R[0]
    cx, cy = 30, 36
    if f <= 3:
        r = [7, 16, 25, 27][f]
        if f == 3:
            # 폭발이 여덟 갈래 뾰족으로 갈라져 밀려난다
            for k in range(8):
                a = k * math.pi / 4 + .2
                x0, y0 = cx + math.cos(a) * 14, cy + math.sin(a) * 12
                x1, y1 = cx + math.cos(a) * 30, cy + math.sin(a) * 25
                tooth(c, x0, y0, math.hypot(x1 - x0, y1 - y0), a, 3.2, Y[1], O)
        else:
            burst(c, cx, cy, r + 3, r * .5, 8, O, rot=.2, seed=f)
            burst(c, cx, cy, r, r * .48, 8, Y[0], rot=.2, seed=f)
            burst(c, cx, cy, r * .78, r * .36, 8, Y[1], rot=.2, seed=f)
            burst(c, cx, cy, r * .5, r * .22, 8, Y[2], rot=.2, seed=f)
        if f >= 2:
            c.spark(cx, cy, 5 + f, W, W)
    for k in range(3):
        rr = 8 + f * 5 + k * 6 if f >= 2 else 0
        if rr and rr < 31:
            col = [Y[1], Y[2], R][k]
            if f >= 5 and k % 2 == 0:
                c.dither(lambda cc, rr=rr, col=col: cc.ring(cx, cy, rr, col, 2, rr * .82), f)
            else:
                c.ring(cx, cy, rr, col, 2 if f < 5 else 1, rr * .82)
    if f >= 4:
        r = rng('barkhit')
        for k in range(8):
            ang = k * math.tau / 8 + .3
            d = 14 + (f - 3) * 4 + (k % 2) * 3
            x, y = cx + math.cos(ang) * d, cy + math.sin(ang) * d * .85
            c.spark(x, y, 2 if f < 6 else 1, Y[2] if k % 2 else Y[1], W)
    if f >= 6:
        for k in range(3):
            c.arc(cx, cy, 22 + k * 3, 150 + k * 40, 210 + k * 40, Y[1], 1, 19 + k * 3)


P_LOYAL = Pal(G=['#7a4808', '#d89a1e', '#ffd858', '#fff7c0'], H=['#b02850', '#f0587c', '#ffb0c4'], D=['#4a2a08'])


def shield(c, cx, cy, w, h, rim, body, hi, u=1.0):
    pts = [(cx - w, cy - h * .7), (cx, cy - h), (cx + w, cy - h * .7), (cx + w, cy + h * .1), (cx, cy + h), (cx - w, cy + h * .1)]
    c.poly(pts, rim)
    pts2 = [(cx - w + 2, cy - h * .7 + 1.5), (cx, cy - h + 2.5), (cx + w - 2, cy - h * .7 + 1.5), (cx + w - 2, cy + h * .1 - 1), (cx, cy + h - 3), (cx - w + 2, cy + h * .1 - 1)]
    c.poly(pts2, body)
    c.line([(cx - w + 3, cy - h * .5), (cx, cy - h + 4)], hi)


@sheet('dog_loyal', 64, 10, 'allAllies', P_LOYAL, peak=[3, 5, 8])
def dog_loyal(c, f):
    G, H, D = P_LOYAL.G, P_LOYAL.H, P_LOYAL.D[0]
    cx, cy = 32, 30
    if f <= 2:
        t = (f + 1) / 3
        for k in range(8):
            a = k * math.tau / 8 + .3
            r = 28 * (1 - t) + 4
            c.spark(cx + math.cos(a) * r, cy + math.sin(a) * r * .8, 1, G[3], G[3])
        c.dither(lambda cc: shield(cc, cx, cy, 11 * t, 13 * t, G[0], G[1], G[3]), f)
        return
    if f <= 6:
        rise = 0
        alpha_d = False
    else:
        rise = (f - 6) * 3
        alpha_d = f >= 8
    def emblem(cc):
        shield(cc, cx, cy - rise, 12, 14, G[0], G[1], G[3])
        cc.poly([(cx - 8, cy - rise - 8), (cx, cy - rise - 11), (cx + 8, cy - rise - 8), (cx + 8, cy - rise), (cx, cy - rise + 9), (cx - 8, cy - rise)], G[2])
        paw(cc, cx, cy - rise + 1, 1.05, D, D)
        cc.px(cx - 6, cy - rise - 8, G[3]); cc.px(cx - 5, cy - rise - 9, G[3])
    if alpha_d:
        c.dither(emblem, f)
    else:
        emblem(c)
    # 도는 하트
    n = 4 if f < 8 else 2
    for k in range(n):
        a = k * math.tau / 4 + f * .55
        x, y = orbit(cx, cy + 4 - rise * 0.6, 21, a, 8)
        if math.sin(a) > -0.2 or f > 3:
            heart(c, x, y - (f - 3) * .6, 1, H[1], H[2], H[0])
    if f >= 3 and f <= 7:
        for k in range(3):
            x = 14 + k * 18 + (f % 2) * 2
            y = 52 - ((f * 4 + k * 7) % 28)
            c.spark(x, y, 1, G[3], G[3])


P_SCRATCH = Pal(W=['#3c4a68', '#b4c6e6', '#f6f9ff'], D=['#3a2412', '#7a5230', '#b08a58'], Y=['#ffd070', '#fff6c0'])


@sheet('dog_scratch', 64, 8, 'target', P_SCRATCH, peak=[1, 3, 5])
def dog_scratch(c, f):
    W, D, Y = P_SCRATCH.W, P_SCRATCH.D, P_SCRATCH.Y
    # 오른쪽 위 → 왼쪽 아래, 다음은 왼쪽 위 → 오른쪽 아래로 엇갈려
    A = (49, 12, 17, 52)
    B = (15, 14, 47, 50)
    ua = [.45, 1, 1, 1, 1, 1, 1, 1][f]
    ta = [0, 0, 0, 0, .25, .5, .75, .97][f]
    if ta < .96:
        claws(c, A[0], A[1], A[2], A[3], 3, 6, 2.4, [W[0], W[1], W[2]], u=ua, bow=2, tail=ta)
    if f >= 1:
        ub = [0, .5, .8, 1, 1, 1, 1, 1][f]
        tb = [0, 0, 0, 0, 0, .25, .55, .85][f]
        if tb < .9:
            claws(c, B[0], B[1], B[2], B[3], 3, 6, 2.4, [W[0], W[1], W[2]], u=ub, bow=-2, tail=tb)
    if f in (1, 2):
        c.spark(20, 44, 3 if f == 1 else 2, Y[1], Y[1])
    if f in (2, 3):
        c.spark(44, 44, 3, Y[1], Y[1])
    r = rng('dogscratch')
    for k in range(9):
        vx = r.uniform(-1.2, 1.2)
        vy = r.uniform(1.5, 3.2)
        t = max(0, f - 1) * .8 + k * .07
        x = 32 + (k - 4) * 4 + vx * t * 6
        y = 55 - vy * t * 6 + t * t * 4
        if f >= 1 and 0 <= y < 60:
            c.rect(x, y, x + 1, y + 1, D[2 if k % 3 else 1])
    for k in range(7):
        t = max(0, f - 1) * .8 + k * .09
        x = 20 + k * 4 + (k % 2) * 2 - t * 3
        y = 55 - (2 + k % 3) * t * 4 + t * t * 3
        if f >= 2 and y < 58:
            c.rect(x, y, x + 1, y + 1, D[2])
    if f == 7:
        for k in range(6):
            c.px(14 + k * 7, 50 - (k % 3) * 3, D[2] if k % 2 else D[1])
        c.line([(20, 54), (26, 55)], D[1]); c.line([(38, 55), (46, 54)], D[1])


P_TACKLE = Pal(F=['#5a2408', '#c8641a', '#f0a030', '#ffd870'], W=['#ffffff', '#fff2b8'], D=['#3a2412', '#7a5230', '#b08a58'], S=['#ffe45a'])


@sheet('dog_tackle', 64, 9, 'target', P_TACKLE, peak=[1, 3, 6])
def dog_tackle(c, f):
    F, W, D, S = P_TACKLE.F, P_TACKLE.W, P_TACKLE.D, P_TACKLE.S[0]
    cx, cy = 30, 38
    if f <= 2:
        t = [.25, .6, .92][f]
        hx, hy = lerp(64, cx + 4, t), lerp(-2, cy - 2, t)
        # 혜성 꼬리(우상향)
        for k, (w, col) in enumerate(((7, F[0]), (5, F[1]), (3, F[2]))):
            strip(c, [(hx + 4 + i * 4.2, hy - i * 3.2) for i in range(7)], [w * (1 - i / 7) + .5 for i in range(7)], col)
        c.disc(hx, hy, 8, F[0], 7)
        c.disc(hx - 1, hy - 1, 6.5, F[1], 5.5)
        c.disc(hx - 2, hy - 2, 3.5, F[3], 3)
        speed(c, hx + 4, hy - 3, hx - 8, hy + 6, [F[2], W[1]], gap=4, n=3, ln=8)
        return
    if f == 3:
        burst(c, cx, cy, 30, 10, 9, F[1], rot=.15, seed=5)
        burst(c, cx, cy, 22, 8, 9, F[3], rot=.15, seed=6)
        burst(c, cx, cy, 12, 5, 8, W[0], rot=.5, seed=7)
        c.spark(cx, cy, 8, W[0], W[0])
        return
    t = f - 3
    # 땅 위 먼지 고리
    rx = 6 + t * 5
    if f <= 6:
        c.ring(cx, 52, rx, D[2], 2, rx * .28)
        c.ring(cx, 52, rx - 3, D[1], 1, (rx - 3) * .28)
    else:
        c.dither(lambda cc: cc.ring(cx, 52, rx, D[2], 2, rx * .28), f)
    r = rng('dogtackle')
    for k in range(8):
        a = math.radians(-160 + k * 20)
        v = 5 + (k % 3) * 2
        x = cx + math.cos(a) * v * t * 1.6
        y = 52 + math.sin(a) * v * t * 1.3 + t * t * 1.4
        c.rect(x, y, x + 1, y + 1, D[1 + k % 2])
    # 빙글 도는 별(기절)
    if f >= 4:
        for k in range(3):
            a = k * math.tau / 3 + f * .9
            x, y = orbit(cx, 15, 11, a, 3.5)
            c.spark(x, y, 2, S, W[0])


P_WHIRL = Pal(D=['#3a2412', '#6e4a28', '#a8804c', '#d6b880'], F=['#c8641a', '#f0a030', '#ffd870'], W=['#f2ecd8'])


@sheet('dog_whirl', 64, 10, 'allTargets', P_WHIRL, peak=[3, 5, 8])
def dog_whirl(c, f):
    D, F, W = P_WHIRL.D, P_WHIRL.F, P_WHIRL.W[0]
    grow = [.25, .55, .85, 1, 1, 1, 1, .8, .5, .25][f]
    fade = f >= 8
    base_y = 55
    n = 7
    def funnel(cc):
        for i in range(n):
            t = i / (n - 1)
            y = base_y - t * 42 * grow
            rx = (4 + t * 19) * grow + 1
            ry = rx * .3
            col = D[1] if i % 2 == 0 else D[2]
            cc.disc(32, y, rx, col, ry)
            cc.arc(32, y, rx, 200 + f * 45 + i * 60, 340 + f * 45 + i * 60, D[3], 2, ry)
            cc.arc(32, y, rx, 20 + f * 45 + i * 60, 110 + f * 45 + i * 60, D[0], 1, ry)
    (c.dither(funnel, f) if fade else funnel(c))
    r = rng('dogwhirl')
    for k in range(10):
        t = (k / 10 + f * .08) % 1
        h = r.uniform(.15, .95)
        rad = (7 + h * 17) * grow
        a = k * 1.7 + f * (.9 + h)
        x, y = orbit(32, base_y - h * 42 * grow, rad, a, rad * .3)
        if k % 3 == 0:
            c.rect(x, y, x + 1, y + 1, F[1])
            c.px(x + 1, y, F[2])
        else:
            c.rect(x, y, x + 1, y, D[0])
    c.ring(32, 55, 12 + f * 1.8, D[2], 1, (12 + f * 1.8) * .28) if f < 9 else None


P_BONE = Pal(B=['#7a6a52', '#e8dcc0', '#ffffff'], O=['#3a2c20'], S=['#c8ccd8'])


@sheet('dog_bone', 32, 4, 'projectile', P_BONE)
def dog_bone(c, f):
    B, O, S = P_BONE.B, P_BONE.O[0], P_BONE.S[0]
    ang = f * math.pi / 4
    bone(c, 15, 16, ang, 16, 3, B[1], B[0], O)
    c.px(13 - math.cos(ang) * 4, 14 - math.sin(ang) * 4, B[2])
    for i, dy in enumerate((-6, 0, 6)):
        c.line([(27, 16 + dy + (f % 2)), (30, 16 + dy + (f % 2))], S)


P_BONEHIT = Pal(B=['#7a6a52', '#e8dcc0', '#ffffff'], O=['#3a2c20'], Y=['#e8a020', '#ffe45a', '#fffbd0'], S=['#a8b8d8'])


@sheet('dog_bone_hit', 64, 8, 'target', P_BONEHIT, peak=[1, 2, 4])
def dog_bone_hit(c, f):
    B, O, Y, S = P_BONEHIT.B, P_BONEHIT.O[0], P_BONEHIT.Y, P_BONEHIT.S[0]
    cx, cy = 30, 30
    if f == 0:
        bone(c, cx + 14, cy - 12, 2.5, 18, 3, B[1], B[0], O)
        speed(c, cx + 20, cy - 16, cx + 6, cy - 4, [S], n=3, gap=3, ln=6)
    elif f == 1:
        bone(c, cx + 3, cy - 2, 2.0, 18, 3, B[1], B[0], O)
        burst(c, cx - 1, cy + 1, 14, 5, 8, Y[1], seed=1)
    else:
        t = f - 2
        if t <= 1:
            burst(c, cx, cy + 1, 24 + t * 3, 8, 9, Y[0], seed=2)
            burst(c, cx, cy + 1, 17 + t * 3, 6, 9, Y[1], seed=3)
            c.spark(cx, cy + 1, 7, Y[2], Y[2])
        # 튕겨 나가는 뼈다귀
        bx, by = cx + 8 + t * 5, cy - 10 - t * 5 + t * t * 1.6
        if by < 62:
            bone(c, bx, by, .6 * t + .6, 16, 3, B[1], B[0], O)
        rr = 7 + t * 5
        if rr < 30:
            c.ring(cx, cy + 1, rr, Y[0] if f < 5 else Y[1], 2 if f < 5 else 1, rr * .85)
        # 금 간 자국
        for a in (200, 250, 320):
            r0 = 8
            x0, y0 = cx + math.cos(math.radians(a)) * r0, cy + 1 + math.sin(math.radians(a)) * r0
            x1, y1 = cx + math.cos(math.radians(a)) * (r0 + 6 + t * 2), cy + 1 + math.sin(math.radians(a)) * (r0 + 6 + t * 2)
            c.line([(x0, y0), (x1, y1)], O)
        if f >= 4:
            for k in range(3):
                x, y = orbit(cx, 12, 11, k * math.tau / 3 + f, 3)
                c.spark(x, y, 1, Y[2], Y[2])


P_HOWLSKY = Pal(N=['#080a20', '#141a44', '#242e70'], M=['#6472a8', '#b4c2ee', '#ecf2ff'], R=['#7a94ff', '#c8dcff', '#ffffff'])


def ell(c, cx, cy, a, b, ang, col):
    ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    pts = [(cx + math.cos(t) * a * ca - math.sin(t) * b * sa, cy + math.cos(t) * a * sa + math.sin(t) * b * ca) for t in [k * math.tau / 24 for k in range(24)]]
    c.poly(pts, col)


def wolf(c, x, y, col, rim, open_=1.0):
    """왼쪽 위로 울부짖는 늑대 옆얼굴 실루엣(손으로 잡은 다각형). (x, y) = 도형 원점(오른쪽 아래가 몸)."""
    def P(pts):
        return [(x + px, y + py) for px, py in pts]
    body = [(40, 0), (36, -18), (34, -34), (28, -50), (22, -62), (10, -74), (2, -82), (-8, -94), (-20, -106), (-26, -110),
            (-30, -106), (-24, -98), (-16, -90), (-8, -80), (-2, -70), (0, -56), (2, -40), (-2, -22), (0, 0)]
    c.poly(P(body), col)
    c.disc(x + 4, y - 80, 10, col, 9)                                                  # 두개골
    c.poly(P([(-6, -76), (-2, -92), (6, -100), (10, -88), (4, -76)]), col)          # 귀
    c.poly(P([(8, -76), (14, -92), (20, -98), (20, -80)]), col)                     # 먼 귀
    gap = 6 * open_
    c.poly(P([(-22, -96 + gap), (-32, -100 + gap * 2.4), (-34, -96 + gap * 2.4), (-26, -88 + gap), (-16, -80), (-12, -84)]), col)   # 아래턱
    for k in range(6):                                                                 # 목덜미 털 삐죽
        c.poly(P([(36 - k * 2, -14 - k * 8), (44 - k * 2, -10 - k * 8), (36 - k * 2, -6 - k * 8)]), col)
    # 달빛 테두리: 이마→주둥이→턱 선, 목 앞
    c.line(P([(2, -82), (-8, -94), (-20, -106), (-26, -110)]), rim)
    c.line(P([(-24, -97), (-32, -101)]), rim)
    c.line(P([(-2, -70), (0, -56), (2, -40)]), rim)
    c.line(P([(6, -100), (2, -92)]), rim)


@sheet('dog_howl_sky', 128, 12, 'screen', P_HOWLSKY, peak=[2, 6, 9])
def dog_howl_sky(c, f):
    N, M, R = P_HOWLSKY.N, P_HOWLSKY.M, P_HOWLSKY.R
    c.rect(0, 0, 127, 127, N[1])
    c.dither(lambda cc: cc.disc(60, 58, 54, N[2], 54), f)
    r = rng('howlstars')
    for k in range(24):
        x, y = r.randint(6, 121), r.randint(6, 110)
        if f >= 1 and (k + f) % 5 != 0:
            c.px(x, y, M[2] if k % 3 == 0 else M[0])
        if k % 7 == 0 and f >= 2:
            c.spark(x, y, 2, M[1], M[2])
    mr = [10, 16, 22, 26, 27, 28, 30, 28, 26, 24, 22, 18][f]
    mx, my = 60, 58
    c.disc(mx, my, mr + 4, N[2], mr + 4)
    c.disc(mx, my, mr, M[1])
    c.disc(mx - 3, my - 3, max(2, mr - 7), M[2])
    for dx, dy, rr in ((6, 6, 4), (-7, 9, 3), (10, -5, 3), (-9, -8, 2)):
        c.disc(mx + dx * mr / 26, my + dy * mr / 26, rr * mr / 26 + 1, M[0])
    if f >= 3:
        rise = max(0, 36 - (f - 3) * 12)
        wolf(c, 78, 128 + rise, N[0], M[2], open_=1.0 if f >= 5 else 0.2)
    if f >= 5:
        mx0, my0 = 48, 30 + max(0, 36 - (f - 3) * 12)
        for k in range(4):
            t = (f - 5 - k * 0.7)
            if t <= 0 or t > 5:
                continue
            rr = 6 + t * 11
            col = R[2] if t < 2 else (R[1] if t < 4 else R[0])
            c.arc(mx0, my0, rr, 150, 260, col, 2, rr * 1.15)
            c.arc(mx0, my0, rr + 3, 165, 245, R[0], 1, (rr + 3) * 1.15)
    if 7 <= f <= 9:
        for k in range(5):
            y = 78 + k * 8
            c.line([(80 - (f - 7) * 14 - k * 3, y), (44 - (f - 7) * 14 - k * 3, y + 10)], R[1])


P_HOWLHIT = Pal(N=['#0c1030', '#1c2458'], M=['#6472a8', '#b4c2ee', '#ecf2ff'], R=['#7a94ff', '#c8dcff', '#ffffff'])


@sheet('dog_howl_hit', 64, 8, 'allTargets', P_HOWLHIT, peak=[1, 2, 4])
def dog_howl_hit(c, f):
    N, M, R = P_HOWLHIT.N, P_HOWLHIT.M, P_HOWLHIT.R
    cx, cy = 30, 36
    if f == 0:
        c.dither(lambda cc: cc.disc(cx + 8, cy - 14, 12, M[1], 12), 0)
        c.disc(cx + 8, cy - 14, 5, M[2])
        return
    if f <= 2:
        u = [0, .6, 1][f]
        # 유령 늑대 이빨 자국: 위에서 아래로 물어뜯는 두 줄 초승달
        crescent(c, cx + 6, cy - 6, 24, 200, 340, 6, [N[1], R[0], R[2]], u=u)
        crescent(c, cx + 6, cy + 20, 24, 20, 160, 6, [N[1], R[0], R[2]], u=u)
        if f >= 1:
            for k in range(5):
                x = cx - 14 + k * 7
                tooth(c, x, cy - 11 + abs(k - 2) * .8, 7, math.pi / 2, 2, M[2], N[0])
                tooth(c, x + 3, cy + 15 - abs(k - 2) * .8, 6, -math.pi / 2, 2, M[2], N[0])
        if f == 2:
            burst(c, cx, cy, 26, 9, 10, R[1], rot=.3, seed=9)
            c.spark(cx, cy, 6, R[2], R[2])
            crescent(c, cx + 6, cy - 6, 24, 200, 340, 6, [N[1], R[0], R[2]])
            crescent(c, cx + 6, cy + 20, 24, 20, 160, 6, [N[1], R[0], R[2]])
        return
    t = f - 3
    def tails(cc):
        crescent(cc, cx + 6, cy - 6, 24, 200, 340, 6, [N[1], R[0], R[2]], tail=.15 * t)
        crescent(cc, cx + 6, cy + 20, 24, 20, 160, 6, [N[1], R[0], R[2]], tail=.15 * t)
    c.dither(tails, f)
    rr = 8 + t * 6
    c.ring(cx, cy, rr, R[1], 2 if t < 3 else 1, rr * .8)
    for k in range(4):
        a = k * math.tau / 4 + .8
        x, y = cx + math.cos(a) * (10 + t * 4), cy + math.sin(a) * (8 + t * 3) + t * 2
        c.spark(x, y, 1 + (t < 2), M[2], R[2])
