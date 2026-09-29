"""방랑 점술사(class_gypsy) 이펙트 10장 — 타로 카드·수정구·운명의 수레바퀴. 보라 밤 + 진홍 + 금.
    python3 scripts/asset-gen/pixel-fx/r2w3_gypsy.py [key ...]"""
import math, sys
from lib_r2w3 import *

V = ramp('#160a2c', '#d2a8ff', 5)         # 밤 보라 → 연보라
R = ['#5c1026', '#c8283e', '#ff7a84']
G = ['#8a5a12', '#e8b02c', '#fff0a2']
W = ['#f6ecd2', '#ffffff']
P = Pal(V=V, R=R, G=G, W=W)               # 15색
CM = dict(k=P.V[0], a=P.V[1], b=P.V[2], c=P.W[0], d=P.W[1], r=P.R[1], g=P.G[1])
CMB = dict(k=P.V[0], a=P.V[1], b=P.V[2], c=P.V[3], d=P.V[4], r=P.R[1], g=P.G[1])   # 카드 뒷면(보라)
CMG = dict(k=P.V[0], a=P.G[0], b=P.G[1], c=P.G[2], d=P.W[1], r=P.R[1], g=P.G[2])


@sheet('gypsy_card', 'projectile', 32, 4, P)
def gypsy_card(c, f):
    rot = [0.15, 0.85, 1.55, 2.25][f]
    for i in range(1, 5):
        c.px(20 + i * 2 + (f + i) % 2, 15 + (i * 3 + f) % 4, P.G[2] if i < 3 else P.G[0])
    c.line([(24, 13 + f % 2), (30, 13 + f % 2)], P.V[3]); c.line([(23, 19 - f % 2), (28, 19 - f % 2)], P.V[2])
    stamp(c, 'card', 14, 16, CM, rot=rot, scale=1)
    c.spark(9 - (f % 2), 12 + f, 1, P.W[1])


@sheet('gypsy_card_hit', 'target', 64, 8, P, peak=[2, 3, 5])
def gypsy_card_hit(c, f):
    cx, cy = CX, 38
    if f <= 1:                                   # 카드 세 장이 내리꽂힌다
        for k, dx in enumerate((-9, 0, 9)):
            stamp(c, 'card', cx + dx, cy - 26 + f * 14 + k * 2, CM, rot=.3 * (k - 1), scale=1)
        c.line([(cx, cy - 34), (cx, cy - 12)], P.V[3])
        return
    u = ph(f, 2, 7)
    flash(c, cx, cy, [9, 6, 4][min(2, f - 2)] if f < 5 else 2, [P.V[2], P.W[0], P.W[1]]) if f < 5 else None
    L = 8 + u * 12 if f < 6 else 20 - (f - 6) * 6
    for sx in (-1, 1):                           # X 자 베기
        c.line([(cx - sx * L, cy - L), (cx + sx * L, cy + L)], P.W[1] if f < 5 else P.V[3], 2 if f < 5 else 1)
        c.line([(cx - sx * L * .8, cy - L * .8 + 1), (cx + sx * L * .8, cy + L * .8 + 1)], P.R[1])
    R_ = rng('gc', 1)
    for k in range(7):                           # 카드 조각이 팔랑이며 떨어진다
        a = R_.uniform(0, math.tau); r = 6 + u * R_.uniform(8, 20)
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r * .7 + u * u * 14
        stamp(c, 'card', x, y, CM if k % 2 else CMB, rot=a + f * .9, scale=1) if u < .8 else c.px(x, y, P.V[3])
    sparks(c, 'gch', 12, cx, cy, 3, 24, u, [P.W[1], P.G[2], P.G[1], P.V[3]], seed=2)


@sheet('gypsy_crystal', 'target', 64, 10, P, peak=[3, 6, 8])
def gypsy_crystal(c, f):
    cx, by = CX, 15
    if f < 8:
        r = 5 + min(f, 3) * 1.6
        glow(c, cx, by, r + 2, [P.V[1], P.V[2], P.V[3]])
        c.disc(cx, by, r, P.V[1]); c.disc(cx - 1, by - 1, r - 2, P.V[2])
        for k in range(3):                       # 구슬 속 환영의 소용돌이
            a = f * .8 + k * 2.1
            x, y = orbit(cx, by, r * .55, a)
            c.px(x, y, P.W[1]); c.px(x + 1, y, P.V[4])
        c.px(cx - r * .5, by - r * .5, P.W[1]); c.px(cx - r * .5 + 1, by - r * .5, P.W[1])
        if f >= 6:                               # 금이 간다
            c.line(jag(cx - 1, by - r, cx + 2, by + r, 4, 2, rng('gcr')), P.W[1])
    if 3 <= f <= 8:                              # 환영 광선이 대상에게
        w = [1, 3, 5, 4, 3, 1][f - 3]
        for i, col in enumerate([P.V[2], P.V[3], P.W[1]]):
            ww = max(1, w - i * 2)
            c.line([(cx, by + 6), (cx + (f % 2), 46)], col, ww)
        glow(c, cx, 46, 3 + w, [P.V[1], P.V[3], P.W[1]], 2)
        for k in range(5): c.px(cx - 8 + (k * 5 + f * 3) % 17, 24 + (k * 7 + f * 5) % 20, P.V[4])
    if f >= 8:                                   # 깨진 조각
        u = ph(f, 8, 9)
        for k in range(8):
            a = k * math.tau / 8 + .3
            x, y = cx + math.cos(a) * (4 + u * 16), by + math.sin(a) * (4 + u * 12) + u * u * 14
            c.poly([(x, y - 2), (x + 2, y), (x, y + 2 - (k % 2)), (x - 1, y)], P.V[3] if k % 2 else P.W[1])
        sparks(c, 'gcs', 10, cx, by, 3, 22, u, [P.W[1], P.V[3], P.V[2]], seed=4)


@sheet('gypsy_curse', 'target', 64, 10, P, peak=[3, 5, 8])
def gypsy_curse(c, f):
    cx, cy = CX, 38
    CMD = dict(k=P.V[0], a=P.V[0], b=P.V[1], c=P.V[2], d=P.V[3], r=P.R[1], g=P.R[2])
    if f <= 2:                                   # 검은 카드가 떨어진다
        y = [-6, 12, 28][f]
        stamp(c, 'card_back', cx, y, CMD, rot=.0, scale=2)
        c.line([(cx - 3, max(0, y - 20)), (cx - 3, y - 8)], P.V[2]); c.line([(cx + 3, max(0, y - 14)), (cx + 3, y - 8)], P.V[1])
        return
    u = ph(f, 3, 9)
    if f == 3: flash(c, cx, cy, 14, [P.R[0], P.V[1], P.V[3], P.W[1]])
    stamp(c, 'card_back', cx, 44, CMD, rot=0, scale=2) if f < 6 else None
    sc = 2 if f < 7 else 1
    stamp(c, 'skull', cx, cy - 4 - u * 6, dict(k=P.V[0], d=P.W[0], c=P.V[4], b=P.V[3], a=P.V[2]), scale=sc)
    c.px(cx - 2, cy - 5 - u * 6, P.R[2]); c.px(cx + 1, cy - 5 - u * 6, P.R[2])
    for k in range(6):                           # 독기가 피어오른다
        x = cx - 14 + k * 5 + math.sin(f + k) * 2; y = 50 - ((f * 3 + k * 7) % 30)
        rr = 3 + (k % 3)
        c.dither(lambda cc, x=x, y=y, rr=rr: cc.disc(x, y, rr, P.V[1 + k % 2]), f + k)
    for k in range(4):
        x = cx - 9 + k * 6; y = 46 + ((f * 2 + k * 3) % 8)
        c.line([(x, y - 3), (x, y)], P.R[1])
    rays(c, cx, 50, 5, 8, 22 - u * 10, P.V[3], rot=math.pi, ry=.3) if f < 7 else None


@sheet('gypsy_wheel', 'allTargets', 64, 10, P, peak=[3, 5, 7])
def gypsy_wheel(c, f):
    cx, cy = CX, 34
    r = [8, 14, 20, 22, 22, 22, 22, 20, 15, 9][f]
    a0 = f * .32
    c.ring(cx, cy, r, P.G[1], 2); c.ring(cx, cy, max(1, r - 3), P.G[0]); c.ring(cx, cy, max(1, r // 3), P.G[1], 1)
    for k in range(8):                           # 바퀴살과 룬 보석
        a = a0 + k * math.tau / 8
        c.line([(cx, cy), (cx + math.cos(a) * (r - 1), cy + math.sin(a) * (r - 1))], P.G[0] if k % 2 else P.G[1])
        gx, gy = cx + math.cos(a) * (r + 1), cy + math.sin(a) * (r + 1)
        c.disc(gx, gy, 2 if r > 12 else 1, [P.R[1], P.V[3], P.W[1], P.R[2]][k % 4])
    c.disc(cx, cy, 3, P.G[2]); c.px(cx, cy, P.W[1])
    if 3 <= f <= 6:                              # 멈춘 자리의 반짝임과 충격 고리
        rays(c, cx, cy, 8, r + 3, r + 8 + (f - 3) * 3, P.W[1], rot=a0 * .5, alt=r + 5)
    if f >= 6:
        sparks(c, 'gw', 14, cx, cy, r, 28, ph(f, 6, 9), [P.W[1], P.G[2], P.G[1], P.V[3]], seed=1)
    for k in range(4): c.px(cx - 20 + (k * 13 + f * 5) % 41, 8 + (k * 9 + f * 7) % 46, P.V[4])


@sheet('gypsy_dance', 'user', 64, 10, P, peak=[3, 5, 7])
def gypsy_dance(c, f):
    cx = CX
    for k, col in enumerate((P.R[1], P.V[3], P.G[1])):    # 세 가닥 베일 리본이 몸을 감고 오른다
        for i in range(24):
            u = i / 23
            a = f * .55 + k * 2.1 + u * 7
            x = cx + math.sin(a) * (10 - u * 3); y = GY - 2 - u * 38 - math.sin(f * .5 + k) * 2
            if math.cos(a) > -.2 or i % 2 == 0:
                c.px(x, y, col); c.px(x, y + 1, P.R[0] if col == P.R[1] else P.V[1])
    for k in range(4):                           # 딸랑이는 금화
        a = -f * .6 + k * math.tau / 4
        x, y = orbit(cx, 36, 15, a, 5)
        stamp(c, 'coin', x, y, dict(k=P.V[0], c=P.G[1], d=P.G[2], g=P.W[1], b=P.G[0]), scale=1)
    motes(c, 'gd', 8, cx, GY, 12, 36, f / 9, [P.W[1], P.G[2], P.V[4]], seed=2)
    ground_ring(c, cx, GY, 13 + (f % 5), P.G[1], 1)


@sheet('gypsy_lovers', 'target', 64, 10, P, peak=[3, 5, 8])
def gypsy_lovers(c, f):
    cx, cy = CX, 34
    HR = dict(k=P.R[0], d=P.R[2], c=P.R[1], b=P.R[1], a=P.R[0])
    HV = dict(k=P.V[0], d=P.V[4], c=P.V[3], b=P.V[2], a=P.V[1])
    u = ph(f, 0, 6)
    r = 22 * (1 - u) + 3
    a = f * .9
    for i, (cm, s) in enumerate(((HR, 1), (HV, -1))):
        x, y = orbit(cx, cy - 2, r, a + i * math.pi, r * .6)
        stamp(c, 'heart', x, y, cm, scale=2 if f > 3 else 1)
        for j in range(1, 4):
            xx, yy = orbit(cx, cy - 2, r + j * 2, a - j * .32 * s + i * math.pi, (r + j * 2) * .6)
            c.px(xx, yy, P.R[2] if i == 0 else P.V[3])
    if f >= 5:
        glow(c, cx, cy - 2, [5, 9, 12, 8, 5][min(4, f - 5)], [P.R[0], P.R[1], P.R[2], P.W[1]])
        stamp(c, 'heart', cx, cy - 2, dict(k=P.W[1], d=P.W[1], c=P.R[2], b=P.R[2], a=P.R[1]), scale=2 + (f in (6, 7)))
    if f >= 7: sparks(c, 'gl', 12, cx, cy - 2, 6, 24, ph(f, 7, 9), [P.R[2], P.V[4], P.W[1], P.R[1]], seed=3)
    for k in range(5): c.px(cx - 14 + (k * 9 + f * 4) % 29, 10 + (k * 13 + f * 3) % 30, P.R[2] if k % 2 else P.V[4])


@sheet('gypsy_cardstorm', 'allTargets', 64, 10, P, peak=[3, 5, 7])
def gypsy_cardstorm(c, f):
    cx = CX
    grow = [.3, .55, .8, 1, 1, 1, 1, .8, .55, .3][f]
    for i in range(18):
        u = (i / 18 + f * .06) % 1.0
        a = f * .75 + i * 2.4
        rad = (5 + u * 22) * grow
        x = cx + math.cos(a) * rad; y = 54 - u * 46 + math.sin(a) * rad * .28
        front = math.sin(a) > -.1
        stamp(c, 'card', x, y, CM if i % 3 else CMB, rot=a * 1.3, scale=1) if front or i % 2 == 0 else c.px(x, y, P.V[2])
    for k in range(3):                           # 바람 줄
        y = 46 - k * 14
        c.arc(cx, y, 16 * grow + 4, 20 + f * 40 + k * 90, 140 + f * 40 + k * 90, P.V[3], 1, 4)
    if 4 <= f <= 7: flash(c, cx, 30, 5, [P.V[2], P.W[1]])
    sparks(c, 'gcs', 8, cx, 34, 6, 26, f / 9, [P.W[1], P.G[2], P.V[3]], seed=5)


@sheet('gypsy_fate_sky', 'screen', 128, 12, P, peak=[4, 7, 10])
def gypsy_fate_sky(c, f):
    cx, cy = 64, 62
    u = ph(f, 0, 5)
    shade(c, cx, cy, 60, 50, P.V[0])
    R_ = rng('gfs', 1)
    for k in range(40):                          # 별밭
        x, y = R_.uniform(8, 120), R_.uniform(8, 116)
        if (k + f) % 3: c.px(x, y, [P.V[3], P.W[1], P.G[2]][k % 3])
    n = 9                                        # 타로 아홉 장이 원을 그리며 펼쳐진다
    for k in range(n):
        a = -math.pi / 2 + (k - (n - 1) / 2) * .32 * u
        rad = 46 * u
        x, y = cx + math.sin(a + .0) * rad * 1.0 + 0, cy + 22 - math.cos(a) * rad * .9
        stamp(c, 'card_back' if k % 2 else 'card', x, y, CMB if k % 2 else CM, rot=(a) , scale=2)
    if f >= 3:                                   # 중앙 「별」 카드가 금빛으로 내려앉는다
        v = ph(f, 3, 8)
        gy = lerp(-10, 58, ease(v))
        glow(c, cx, gy, 14 + 4 * v, [P.G[0], P.G[1], P.G[2]])
        stamp(c, 'card', cx, gy, CMG, scale=4)
        stamp(c, 'star4', cx, gy, dict(k=P.G[0], d=P.W[1], c=P.G[2], b=P.G[1], a=P.G[0]), scale=2)
        rays(c, cx, gy, 12, 20, 34 + (f % 3) * 3, P.G[2], rot=f * .1, alt=26)
    if f >= 8:
        w = ph(f, 8, 11)
        for k in range(7):
            x = 16 + k * 16
            c.line([(x, 0), (x + (k % 2) * 6 - 3, 108 * w)], P.G[2] if k % 2 else P.W[1], 2)
        flash(c, cx, 64, 20 * (1 - w) + 4, [P.G[1], P.G[2], P.W[1]])


@sheet('gypsy_fate_hit', 'allTargets', 64, 8, P, peak=[2, 3, 5])
def gypsy_fate_hit(c, f):
    cx, cy = CX, 36
    S4 = dict(k=P.G[0], d=P.W[1], c=P.G[2], b=P.G[1], a=P.G[0])
    u = ph(f, 0, 7)
    if f < 3:
        column(c, cx, 0, GY, [4, 8, 12][f], [P.G[0], P.G[1], P.G[2], P.W[1]])
    stamp(c, 'star4', cx, cy, S4, rot=f * .4, scale=[1, 2, 3, 3, 2, 2, 1, 1][f])
    rays(c, cx, cy, 8, 6, 8 + u * 22, P.G[2], rot=f * .3, alt=8 + u * 12)
    ground_ring(c, cx, 52, 6 + u * 24, P.G[1], 1)
    sparks(c, 'gfh', 14, cx, cy, 4, 26, u, [P.W[1], P.G[2], P.G[1], P.V[3]], seed=6)
    for k in range(4):
        stamp(c, 'card', cx - 18 + k * 12, 10 + ((f * 6 + k * 11) % 38), CM, rot=f * .8 + k, scale=1) if 2 <= f <= 6 else None


KEYS = ['gypsy_card', 'gypsy_card_hit', 'gypsy_crystal', 'gypsy_curse', 'gypsy_wheel', 'gypsy_dance', 'gypsy_lovers', 'gypsy_cardstorm', 'gypsy_fate_sky', 'gypsy_fate_hit']

if __name__ == '__main__':
    sys.modules['r2w3_gypsy'] = sys.modules[__name__]
    import r2w3_skills
    r2w3_skills.build_class('class_gypsy', sys.argv[1:])
