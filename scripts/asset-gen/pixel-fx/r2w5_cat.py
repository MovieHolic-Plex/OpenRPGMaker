"""고양이(cat) 이펙트 시트 10종 — retro2003 로스터 b1. 색 정체성: 자홍·호박 발톱, 은은한 보라 잔상, 눈은 노랑.
가늘고 빠른 선이 주인공(개의 굵은 이빨·충격 폭발과 반대): 별꼴 난도질·발바닥 도장·유령 고양이·털뭉치·하악질 얼굴·발톱 낙하·아홉 영혼·거대한 눈과 난무."""
from lib_r2w5 import *

P_CLAW = Pal(O=['#3a0a2a'], M=['#a8206a', '#f04a94', '#ff9cc8'], W=['#ffffff', '#ffe8a0'])


def line_slash(c, x, y, ang, ln, w, cols, u=1.0, tail=0.0):
    dx, dy = math.cos(ang), math.sin(ang)
    x0, y0 = x - dx * ln / 2, y - dy * ln / 2
    gash(c, x0, y0, x0 + dx * ln, y0 + dy * ln, w, cols, u=u, bow=0, tail=tail)


@sheet('cat_claw', 64, 8, 'target', P_CLAW, peak=[1, 2, 4])
def cat_claw(c, f):
    O, M, W = P_CLAW.O[0], P_CLAW.M, P_CLAW.W
    cx, cy = 30, 34
    angs = [-58, -20, 22, 60, 118]        # 별꼴 난도질: 저마다 다른 각도, 다른 길이
    lens_ = [40, 34, 38, 32, 36]
    for i, a in enumerate(angs):
        start = i * 0.7
        u = max(0, min(1, (f + 1 - start * 0.5) / 2.0))
        tl = max(0, min(1, (f - 3 - i * 0.35) / 3))
        if u > 0 and tl < 1:
            ox, oy = (i - 2) * 2.2, (i % 2) * 3 - 2
            line_slash(c, cx + ox, cy + oy, math.radians(a), lens_[i], 2.6, [M[0], M[1], M[2]], u=u, tail=tl)
    if 1 <= f <= 4:
        c.spark(cx, cy, 6 if f == 2 else 3, W[0], W[0])
    if f in (2, 3):
        for k in range(6):
            a = math.radians(-70 + k * 46)
            c.px(cx + math.cos(a) * (14 + f * 3), cy + math.sin(a) * (12 + f * 3), W[1])
    if f >= 5:
        for k in range(5):
            x, y = cx - 18 + k * 9, 20 + (k % 3) * 9 + (f - 5) * 2
            c.px(x, y, M[2] if f < 7 else M[0])
            c.px(x + 1, y + 1, M[1])


P_JAB = Pal(O=['#2a1408'], P=['#a05a1c', '#e89a3c', '#ffd890'], N=['#c8506c', '#ff90a8'], W=['#ffffff', '#fff2b0'])


@sheet('cat_jab', 64, 8, 'target', P_JAB, peak=[2, 4, 6])
def cat_jab(c, f):
    O, P, N, W = P_JAB.O[0], P_JAB.P, P_JAB.N, P_JAB.W
    def stamp(x, y, s, prog):
        # 발바닥이 날아와(오른쪽 위) 콕 찍힌다
        px_, py_ = lerp(x + 22, x, prog), lerp(y - 22, y, prog)
        c.disc(px_, py_ + 1.4 * s, 4.6 * s + 1, O, 4 * s + 1)
        for dx, dy in ((-4.6, -4.4), (-1.6, -6.2), (1.6, -6.2), (4.6, -4.4)):
            c.disc(px_ + dx * s, py_ + dy * s, 2.2 * s + 1, O)
        c.disc(px_, py_ + 1.4 * s, 4.6 * s, P[1], 4 * s)
        for dx, dy in ((-4.6, -4.4), (-1.6, -6.2), (1.6, -6.2), (4.6, -4.4)):
            c.disc(px_ + dx * s, py_ + dy * s, 2.2 * s, P[1])
        c.disc(px_, py_ + 1.8 * s, 2.8 * s, N[0], 2.3 * s)
        c.px(px_ - 1, py_ + 1, N[1])
        c.px(px_ - 3 * s, py_ - 1 * s, P[2])
    hits = [(34, 30), (22, 38), (38, 44)]
    for i, (x, y) in enumerate(hits):
        t0 = i * 2
        if f < t0:
            continue
        prog = min(1, (f - t0) / 1.0)
        if f - t0 <= 1:
            stamp(x, y, 1.7, prog)
        else:
            # 찍힌 뒤: 남는 충격 고리와 별
            age = f - t0 - 1
            if age <= 2:
                c.ring(x, y + 1, 6 + age * 4, W[1], 1, (6 + age * 4) * .7)
                c.spark(x + 6, y - 5, 2 if age < 2 else 1, W[0], W[0])
            elif i == 2 and age <= 4:
                c.dither(lambda cc, x=x, y=y: cc.ring(cc, 0, 0, 0, 0) if False else cc.ring(x, y + 1, 18, W[1], 1, 12), f)
    if f == 0:
        speed(c, 52, 10, 40, 20, [W[1], N[1]], n=3, gap=3, ln=9)
    if f in (2, 3):
        c.spark(30, 36, 5, W[0], W[0])


P_AFTER = Pal(V=['#2a1450', '#5a34a0', '#9a70e0', '#d0b4ff'], E=['#ffe45a', '#ffffff'], O=['#140a2c'])


def cat_sil(c, x, y, s, col, rim, dir_=-1, tail_ph=0.0, eye=None):
    """옆모습 고양이 실루엣(왼쪽을 본다). (x, y) = 발 밑 중앙."""
    c.disc(x, y - 8 * s, 9 * s, col, 5.6 * s)                       # 몸통
    c.disc(x - 8 * s, y - 14 * s, 5 * s, col, 4.6 * s)               # 머리
    c.poly([(x - 12 * s, y - 17 * s), (x - 11 * s, y - 23 * s), (x - 8 * s, y - 18 * s)], col)
    c.poly([(x - 8 * s, y - 18 * s), (x - 5 * s, y - 24 * s), (x - 4 * s, y - 17 * s)], col)
    for dx in (-5, -1, 5, 9):
        c.rect(x + dx * s - s, y - 5 * s, x + dx * s + s * .6, y, col)
    pts = [(x + 9 * s, y - 10 * s), (x + 15 * s, y - 14 * s), (x + 17 * s, y - 21 * s + tail_ph * 3), (x + 14 * s, y - 25 * s + tail_ph * 5)]
    c.line(pts, col, max(1, round(2 * s)))
    if rim is not None:
        c.line([(x - 8 * s, y - 13 * s), (x - 2 * s, y - 14 * s), (x + 8 * s, y - 13 * s)], rim)
    if eye is not None:
        c.px(x - 11 * s, y - 15 * s, eye)


@sheet('cat_afterimage', 64, 8, 'user', P_AFTER, peak=[2, 4, 6])
def cat_afterimage(c, f):
    V, E, O = P_AFTER.V, P_AFTER.E, P_AFTER.O[0]
    base_x, base_y = 34, 54
    # 시전자 오른쪽에서 왼쪽으로 잔상들이 줄지어 흩어진다
    for k in range(4):
        t = f - k * 1.2
        if t < 0 or t > 6:
            continue
        x = base_x + 12 - t * 6.5 * (1 + k * .0)
        y = base_y - k * 0
        def img(cc, x=x, y=y, k=k):
            cat_sil(cc, x, y - (k % 2) * 2, .95, V[1 + (k % 2)], V[3], eye=E[0])
        if t < 2.5:
            img(c)
        else:
            c.dither(img, f + k)
    if f <= 1:
        for k in range(6):
            c.line([(46 - k * 2, 30 + k * 4), (58 - k * 2, 30 + k * 4)], V[3])
    for k in range(5):
        x = 50 - ((f * 8 + k * 11) % 44)
        y = 24 + k * 6
        c.line([(x, y), (x + 5, y)], V[2 + (k % 2)])


P_HAIR = Pal(H=['#5a3a18', '#c89a58', '#f0d090'], O=['#2a1808'])


@sheet('cat_hairball', 32, 4, 'projectile', P_HAIR)
def cat_hairball(c, f):
    H, O = P_HAIR.H, P_HAIR.O[0]
    cx, cy = 15, 16
    c.disc(cx, cy, 7, O, 7)
    c.disc(cx, cy, 6, H[0], 6)
    c.disc(cx - 1, cy - 1, 4, H[1], 4)
    r = rng('hairball', 0)
    for k in range(12):
        a = k * math.tau / 12 + f * .55
        ln = 3 + (k + f) % 3
        x0, y0 = cx + math.cos(a) * 5.5, cy + math.sin(a) * 5.5
        x1, y1 = cx + math.cos(a + .35) * (5.5 + ln), cy + math.sin(a + .35) * (5.5 + ln)
        c.line([(x0, y0), (x1, y1)], H[1] if k % 2 else H[0])
    c.px(cx - 2, cy - 2, H[2])
    for i in range(3):
        c.px(26 - (f + i) % 3, 12 + i * 4, H[1])


P_HAIRH = Pal(H=['#5a3a18', '#c89a58', '#f0d090'], O=['#2a1808'], W=['#ffffff'], D=['#8a8478', '#c8c2b0'])


@sheet('cat_hairball_hit', 64, 8, 'target', P_HAIRH, peak=[1, 2, 4])
def cat_hairball_hit(c, f):
    H, O, W, D = P_HAIRH.H, P_HAIRH.O[0], P_HAIRH.W[0], P_HAIRH.D
    cx, cy = 30, 32
    if f == 0:
        c.disc(cx + 4, cy - 4, 7, O, 7); c.disc(cx + 4, cy - 4, 6, H[0], 6); c.disc(cx + 3, cy - 5, 4, H[1], 4)
        speed(c, cx + 14, cy - 8, cx + 4, cy - 4, [H[1]], n=3, gap=3, ln=7)
        return
    t = f - 1
    r = rng('hairballhit')
    # 털이 사방으로 퍼진다: 곡선 털 가닥 + 몽실 먼지
    n = 22
    for k in range(n):
        a = k * math.tau / n + r.uniform(-.1, .1)
        d0 = 4 + t * 3
        d1 = d0 + 8 + (k % 4) * 3 + t * 2
        curve = .5 if k % 2 else -.5
        pts = [(cx + math.cos(a) * d0, cy + math.sin(a) * d0 * .85)]
        for j in (1, 2):
            aa = a + curve * j * .12
            dd = d0 + (d1 - d0) * j / 2
            pts.append((cx + math.cos(aa) * dd, cy + math.sin(aa) * dd * .85 + t * t * .5))
        if t <= 4:
            c.line(pts, H[1] if k % 3 else H[0], 1)
        elif k % 2 == 0:
            c.line(pts, H[1], 1)
    if t <= 1:
        c.disc(cx, cy, 8 - t * 3, H[0], 7 - t * 2.5)
        c.disc(cx - 1, cy - 1, 5 - t * 2, H[1], 4 - t * 1.6)
    if t <= 3:
        for (dx, dy, rr) in ((-10, 4, 4), (9, 6, 5), (0, -9, 4)):
            c.dither(lambda cc, dx=dx, dy=dy, rr=rr: puff(cc, cx + dx * (1 + t * .5), cy + dy * (1 + t * .5) - t, rr + t, [D[1], D[1], D[1]]), f + dx)
    if t >= 4:
        for k in range(6):
            x, y = cx - 16 + k * 6, 12 + ((k * 7 + t * 5) % 30)
            c.px(x, y, H[1]); c.px(x + 1, y + 1, H[2])


P_HISS = Pal(O=['#14061e'], G=['#1e7a48', '#4ed078', '#c0ffcc'], F=['#2a1438', '#5a3080', '#9a70c8'], W=['#ffffff', '#fff6a8'])


@sheet('cat_hiss', 64, 8, 'allTargets', P_HISS, peak=[2, 4, 6])
def cat_hiss(c, f):
    O, G, F, W = P_HISS.O[0], P_HISS.G, P_HISS.F, P_HISS.W
    cx, cy = 32, 30
    grow = [.5, .8, 1, 1.05, 1.05, 1.0, .9, .8][f]
    # 털을 곤두세운 고양이 얼굴 유령(정면): 삼각 귀, 갈라진 눈, 쩍 벌린 입, 송곳니
    def face(cc, col, rim, k):
        cc.disc(cx, cy, 17 * k, rim, 14 * k)
        cc.disc(cx, cy, 16 * k, col, 13 * k)
        cc.poly([(cx - 17 * k, cy - 6 * k), (cx - 15 * k, cy - 25 * k), (cx - 5 * k, cy - 12 * k)], rim)
        cc.poly([(cx - 15 * k, cy - 7 * k), (cx - 14 * k, cy - 22 * k), (cx - 7 * k, cy - 12 * k)], col)
        cc.poly([(cx + 17 * k, cy - 6 * k), (cx + 15 * k, cy - 25 * k), (cx + 5 * k, cy - 12 * k)], rim)
        cc.poly([(cx + 15 * k, cy - 7 * k), (cx + 14 * k, cy - 22 * k), (cx + 7 * k, cy - 12 * k)], col)
    for i in range(12):        # 곤두선 털
        a = math.radians(200 + i * 14.5)
        c.line([(cx + math.cos(a) * 17 * grow, cy + math.sin(a) * 14 * grow), (cx + math.cos(a) * 22 * grow, cy + math.sin(a) * 19 * grow)], G[1] if f >= 2 else F[1])
    face(c, F[1], O, grow)
    # 눈: 초록 발광, 세로 동공
    for sx in (-1, 1):
        ex, ey = cx + sx * 7 * grow, cy - 4 * grow
        c.disc(ex, ey, 4.4 * grow, G[1], 3.4 * grow)
        c.disc(ex, ey, 3 * grow, G[2], 2.4 * grow)
        c.rect(ex - 0.5, ey - 3 * grow, ex + 0.5, ey + 3 * grow, O)
    # 입: 쩍 벌림 + 송곳니
    mh = [2, 5, 8, 9, 9, 8, 6, 4][f]
    c.disc(cx, cy + 8 * grow, 7 * grow, O, max(1, mh * .7))
    for sx in (-1, 1):
        tooth(c, cx + sx * 4.5 * grow, cy + 7 * grow, 4.5, math.pi / 2, 1.6, W[0], O)
    if f >= 3:
        c.line([(cx - 3, cy + 8 + mh * .6), (cx + 3, cy + 8 + mh * .6)], G[0])
    # 하악질 충격파: 왼쪽 적들에게 지그재그 소리선
    for k in range(3):
        y0 = cy - 6 + k * 9
        t = f - 1 - k * .6
        if t <= 0:
            continue
        xs = [(cx - 16 - t * 8) - j * 5 for j in range(4)]
        pts = [(xs[j], y0 + ((-1) ** j) * 3) for j in range(4)]
        if t < 4:
            c.line(pts, G[2 if t < 2 else 1])
        else:
            c.dither(lambda cc, pts=pts: cc.line(pts, G[1]), f)
    for k in range(4):
        c.spark(6 + k * 15, 8 + (k % 2) * 6 + (f % 2), 1, G[2], W[0]) if f >= 3 else None


P_POUNCE = Pal(O=['#2a1408'], P=['#a05a1c', '#e89a3c', '#ffd890'], N=['#c8506c'], W=['#ffffff', '#f0f0f8'], D=['#3a2c5a', '#6a5a98', '#a89ad0'], C=['#e8f0ff'])


@sheet('cat_pounce', 64, 10, 'target', P_POUNCE, peak=[2, 4, 7])
def cat_pounce(c, f):
    O, P, N, W, D, C = P_POUNCE.O[0], P_POUNCE.P, P_POUNCE.N[0], P_POUNCE.W, P_POUNCE.D, P_POUNCE.C[0]
    cx, gy = 30, 50
    if f <= 2:
        # 땅에 커지는 발바닥 그림자
        r = [8, 14, 20][f]
        c.dither(lambda cc: cc.disc(cx, gy, r, D[0], r * .32), f)
        c.ring(cx, gy, r + 3, D[1], 1, (r + 3) * .32)
        if f >= 1:
            c.line([(cx + 4, 4), (cx + 4, 14 + f * 4)], D[2]); c.line([(cx - 4, 8), (cx - 4, 16 + f * 4)], D[2])
        return
    if f <= 4:
        ph = f - 3
        y = [16, 34][ph]
        s = [1.6, 1.9][ph]
        if ph == 1:
            speed(c, cx, y - 6, cx, y - 26, [C, W[0]], n=4, gap=5, ln=12)
        # 커다란 발바닥 + 튀어나온 발톱
        c.disc(cx, y + 2 * s, 5.2 * s + 1, O, 4.4 * s + 1)
        for dx, dy in ((-5.6, -4.6), (-2, -7.2), (2, -7.2), (5.6, -4.6)):
            c.disc(cx + dx * s, y + dy * s, 2.6 * s + 1, O)
        c.disc(cx, y + 2 * s, 5.2 * s, P[1], 4.4 * s)
        for dx, dy in ((-5.6, -4.6), (-2, -7.2), (2, -7.2), (5.6, -4.6)):
            c.disc(cx + dx * s, y + dy * s, 2.6 * s, P[1])
            tooth(c, cx + dx * s, y + dy * s - 1.5 * s, 4.5, -math.pi / 2, 1.2, W[0], O)
        c.disc(cx, y + 2.4 * s, 3.2 * s, N, 2.6 * s)
        c.px(cx - 2, y + 1, W[0])
        return
    t = f - 5
    r = 8 + t * 5
    if f <= 7:
        c.ring(cx, gy, r, W[1], 2, r * .3)
        c.ring(cx, gy, r - 3, D[2], 1, (r - 3) * .3)
    else:
        c.dither(lambda cc: cc.ring(cx, gy, r, W[1], 2, r * .3), f)
    # 크레이터 균열(방사)
    for k in range(7):
        a = math.radians(200 + k * 23)
        L = 6 + min(t, 3) * 4
        c.line([(cx + math.cos(a) * 4, gy + math.sin(a) * 2), (cx + math.cos(a) * (4 + L), gy + math.sin(a) * (2 + L * .35))], O)
    # 발톱 자국 세 줄(수직으로 내리 그은)
    if f in (5, 6):
        claws(c, cx, 6, cx, 46, 4, 6, 2, [W[1], W[0]], u=1, bow=0)
        burst(c, cx, gy - 2, 14, 5, 8, P[2], seed=3)
    for k in range(6):
        a = math.radians(-160 + k * 28)
        c.rect(cx + math.cos(a) * (8 + t * 4), gy - 4 + math.sin(a) * (6 + t * 3) + t, cx + math.cos(a) * (8 + t * 4) + 1, gy - 3 + math.sin(a) * (6 + t * 3) + t, D[2])


P_NINE = Pal(B=['#1e3a8a', '#4a86e8', '#9ad0ff', '#e8f6ff'], G=['#a87a14', '#ffd23a', '#fff6b8'], O=['#0c1a4a'])


def flame_cat(c, x, y, s, cols, eye):
    """작은 푸른 영혼 고양이(불꽃 몸 + 삼각 귀 두 개)."""
    c.disc(x, y, 3.6 * s, cols[0], 3.8 * s)
    c.poly([(x - 3 * s, y - 2 * s), (x - 2.6 * s, y - 6 * s), (x - .6 * s, y - 3 * s)], cols[0])
    c.poly([(x + 3 * s, y - 2 * s), (x + 2.6 * s, y - 6 * s), (x + .6 * s, y - 3 * s)], cols[0])
    c.disc(x, y + .2, 2.6 * s, cols[1], 2.8 * s)
    c.px(x - 1, y - 1, eye); c.px(x + 1, y - 1, eye)
    c.line([(x, y + 4 * s), (x + s * 1.5, y + 8 * s)], cols[0])


@sheet('cat_nine_lives', 64, 12, 'user', P_NINE, peak=[3, 6, 9])
def cat_nine_lives(c, f):
    B, G, O = P_NINE.B, P_NINE.G, P_NINE.O[0]
    cx, cy = 32, 34
    n = 9
    if f <= 8:
        rad = [26, 24, 22, 21, 20, 19, 17, 14, 10][f]
        vis = min(n, 1 + f * 2)
        for k in range(vis):
            a = k * math.tau / n + f * .5 - math.pi / 2
            x, y = orbit(cx, cy - 2, rad, a, rad * .55)
            back = math.sin(a) < -0.3
            def fc(cc, x=x, y=y, k=k):
                flame_cat(cc, x, y, 1.0, [B[1], B[2]], B[3])
            (c.dither(fc, f + k) if back else fc(c))
        c.ring(cx, cy - 2, rad, B[0], 1, rad * .55)
        if f >= 6:
            c.disc(cx, cy - 2, 4 + (f - 6) * 2, B[1], 4 + (f - 6) * 2)
            c.disc(cx, cy - 2, 2 + (f - 6), B[3], 2 + (f - 6))
        return
    t = f - 9
    if t == 0:
        burst(c, cx, cy - 2, 26, 8, 9, B[2], seed=4)
        burst(c, cx, cy - 2, 16, 6, 9, B[3], seed=5)
    # 되살아난 생명: 황금 심장과 상승하는 ankh 빛기둥
    heart(c, cx, cy - 6 - t * 3, 2.4 - t * .3, G[1], G[2], G[0])
    for k in range(6):
        x = cx - 16 + k * 6.4
        y = cy + 12 - ((t * 7 + k * 9) % 34)
        c.spark(x, y, 1, B[3], B[3]) if k % 2 else c.px(x, y, G[2])
    if t <= 1:
        c.ring(cx, cy, 14 + t * 8, B[2], 1, (14 + t * 8) * .6)


P_FSKY = Pal(N=['#14061e', '#2a0c3a', '#4a1458'], E=['#ffe038', '#fff8b0', '#ffffff'], S=['#ff5aa0', '#ffb0d0', '#ffffff'], P=['#6a2a80'])


@sheet('cat_frenzy_sky', 128, 12, 'screen', P_FSKY, peak=[2, 6, 9])
def cat_frenzy_sky(c, f):
    N, E, S, Pp = P_FSKY.N, P_FSKY.E, P_FSKY.S, P_FSKY.P[0]
    c.rect(0, 0, 127, 127, N[1] if f < 8 else N[0])
    c.dither(lambda cc: cc.disc(64, 64, 62, N[2], 40), f)
    if f <= 5:
        # 어둠 속 거대한 갈라진 눈 한 쌍이 떠오른다
        op = [2, 5, 9, 11, 11, 9][f]
        for sx in (-1, 1):
            ex, ey = 64 + sx * 26, 44
            c.poly([(ex - 18, ey), (ex, ey - op * 1.3), (ex + 18, ey), (ex, ey + op * 1.3)], E[0])
            c.poly([(ex - 12, ey), (ex, ey - op * .9), (ex + 12, ey), (ex, ey + op * .9)], E[1])
            c.rect(ex - 1, ey - op * 1.2, ex + 1, ey + op * 1.2, N[0])
            if f >= 3:
                c.px(ex - 6, ey - 3, E[2]); c.px(ex - 5, ey - 3, E[2])
    if 3 <= f <= 9:
        r = rng('frenzy')
        n = min(14, (f - 2) * 3)
        for k in range(n):
            a = r.uniform(-60, 60) + (k % 2) * 90
            x = r.randint(14, 114)
            y = r.randint(20, 112)
            ln = r.randint(44, 84)
            dx, dy = math.cos(math.radians(a)), math.sin(math.radians(a))
            fresh = k >= n - 3
            tl = 0 if f < 7 else min(1, (f - 6) / 3)
            gash(c, x - dx * ln / 2, y - dy * ln / 2, x + dx * ln / 2, y + dy * ln / 2, 3.4, [S[0], S[1], S[2]] if fresh else [Pp, S[0], S[1]], u=1, bow=r.uniform(-4, 4), tail=tl)
    if f >= 9:
        for k in range(12):
            x, y = 14 + (k * 37) % 100, 20 + (k * 53) % 90
            c.spark(x, y, 1 + (k % 2), S[1], S[2]) if (k + f) % 3 else None
    if f >= 10:
        for k in range(5):
            paw(c, 30 + k * 16, 100 - (k % 2) * 8, .9, Pp, Pp) if False else None


P_FHIT = Pal(O=['#2a0a2a'], S=['#a01c64', '#ff5aa0', '#ffb0d0', '#ffffff'], Y=['#ffe45a'])


@sheet('cat_frenzy_hit', 64, 8, 'allTargets', P_FHIT, peak=[1, 3, 5])
def cat_frenzy_hit(c, f):
    O, S, Y = P_FHIT.O[0], P_FHIT.S, P_FHIT.Y[0]
    cx, cy = 30, 34
    r = rng('frenzyhit')
    angs = [-70, -35, 10, 50, 100, 145, 20, -110]
    for i, a in enumerate(angs):
        st = i * .5
        u = max(0, min(1, (f + 1 - st) / 1.8))
        tl = max(0, min(1, (f - 4 - i * .25) / 3))
        if u > 0 and tl < 1:
            ox, oy = r.uniform(-8, 8), r.uniform(-8, 8)
            line_slash(c, cx + ox, cy + oy, math.radians(a), 38, 2.4, [S[0], S[1], S[2]], u=u, tail=tl)
    if 1 <= f <= 4:
        c.spark(cx, cy, 5 if f % 2 else 3, S[3], S[3])
    if f >= 3:
        for k in range(6):
            a = k * math.tau / 6 + f
            c.spark(cx + math.cos(a) * (16 + f * 2), cy + math.sin(a) * (12 + f * 2), 1, Y, S[3])
