"""요정(class_fairy) 이펙트 — 빛가루·덩굴·꽃·반딧불·숲의 노래. 연둣빛 + 하늘색 + 분홍 꽃.
    python3 scripts/asset-gen/pixel-fx/r2w3_fairy.py [key ...]"""
import math, sys
from lib_r2w3 import *

GN = ['#0c3a1e', '#248a3c', '#6cd25a', '#c8f28c']
CY = ['#0a4a5a', '#28b0c8', '#8ceaf0', '#e4ffff']
PK = ['#a82a5c', '#ff7ab0', '#ffd0e4']
W = ['#ffffff']
P = Pal(GN=GN, CY=CY, PK=PK, W=W)
LF = dict(k=P.GN[0], d=P.GN[3], c=P.GN[2], b=P.GN[1], a=P.GN[0])
BL = dict(k=P.PK[0], d=P.PK[2], c=P.PK[1], g=P.GN[3], b=P.PK[1], a=P.PK[0])


def dust(c, key, n, cx, cy, r0, r1, t, seed=0, ry=1.0):
    sparks(c, key, n, cx, cy, r0, r1, t, [P.W[0], P.CY[3], P.GN[3], P.PK[2]], seed=seed, ry=ry)


def firefly(c, x, y, ph_=0):
    c.px(x, y, P.GN[3]); c.px(x + 1, y, P.W[0]) if ph_ % 2 else c.px(x - 1, y, P.CY[2])
    c.px(x, y - 1, P.GN[2]) if ph_ % 3 == 0 else None


@sheet('fairy_dust', 'projectile', 32, 4, P)
def fairy_dust(c, f):
    y = 16 + [0, 2, 0, -2][f]
    for i in range(3, 0, -1):
        c.disc(24 - i * 4, y + (i % 2) * 2 - 1, 1 + (i == 1), [P.CY[2], P.GN[3], P.PK[2]][i - 1])
    c.spark(11, y, 3 - (f % 2), P.W[0], core=P.CY[3], diag=True)
    c.glow(11, y, 5, [P.CY[1], P.CY[2], P.W[0]]) if f % 2 == 0 else None
    for i in range(1, 5): c.px(15 + i * 3 + (f + i) % 2, y - 4 + (i * 3 + f) % 8, [P.PK[2], P.GN[3], P.W[0], P.CY[2]][i - 1])


@sheet('fairy_dust_hit', 'target', 64, 8, P, peak=[2, 3, 5])
def fairy_dust_hit(c, f):
    cx, cy = CX, 38
    u = ph(f, 0, 7)
    flash(c, cx, cy, [8, 11, 8, 5, 3, 2, 1, 1][f], [P.CY[2], P.CY[3], P.W[0]]) if f < 6 else None
    dust(c, 'fdh', 20, cx, cy, 3, 28, u, seed=1)
    for k in range(6):
        a = k * math.tau / 6 + f * .3
        r = 6 + u * 14
        c.spark(cx + math.cos(a) * r, cy + math.sin(a) * r * .8, 2 - (k % 2), [P.W[0], P.PK[2], P.GN[3]][k % 3])
    ground_ring(c, cx, 52, 4 + u * 22, P.CY[2], 1)


@sheet('fairy_vines', 'target', 64, 10, P, peak=[3, 5, 8])
def fairy_vines(c, f):
    cx = CX
    grow = [.15, .35, .55, .8, 1, 1, 1, .8, .5, .2][f]
    R_ = rng('fv', 1)
    for k in range(4):                                 # 발밑에서 솟아 적을 휘감는 덩굴
        x0 = cx + (k - 1.5) * 8
        pts = []
        for i in range(14):
            u = i / 13
            if u > grow: break
            pts.append((x0 + math.sin(u * 7 + k * 1.7 + f * .3) * (5 + 2 * u), 54 - u * 42))
        if len(pts) >= 2:
            c.line(pts, P.GN[0], 4); c.line(pts, P.GN[1], 2); c.line(pts, P.GN[2], 1)
            for i in range(2, len(pts), 3):
                x, y = pts[i]; d = 1 if (i + k) % 2 else -1
                leaf_ = [(x, y), (x + d * 4, y - 3), (x + d * 6, y - 1), (x + d * 3, y + 1)]
                c.poly(leaf_, P.GN[3] if i % 2 else P.GN[2])
            if f >= 4 and k % 2 == 0:
                x, y = pts[-1]; stamp(c, 'flower', x, y - 2, BL, scale=1)
    ground_ring(c, cx, GY, 8 + f * 2, P.GN[2], 1)
    dust(c, 'fvd', 8, cx, 34, 4, 22, f / 9, seed=2)


@sheet('fairy_swarm', 'allTargets', 64, 10, P, peak=[3, 5, 7])
def fairy_swarm(c, f):
    cx = CX
    R_ = rng('fsw', 1)
    for k in range(16):                                # 반딧불 떼가 적을 에워싼다
        a0 = R_.uniform(0, math.tau); r0 = R_.uniform(8, 22)
        a = a0 + f * (.5 if k % 2 else -.4)
        r = r0 * (1 - .3 * math.sin(f / 9 * math.pi))
        x, y = cx + math.cos(a) * r, 36 + math.sin(a) * r * .6
        c.disc(x, y, 2, P.GN[1]) if f % 2 == k % 2 else None
        firefly(c, x, y, f + k)
        c.px(x - math.cos(a) * 2, y - math.sin(a) * 1, P.GN[2])
    if 4 <= f <= 7: flash(c, cx, 36, 8 + (f % 2) * 3, [P.GN[2], P.GN[3], P.W[0]])
    motes(c, 'fsm', 8, cx, GY, 20, 42, f / 9, [P.GN[3], P.W[0]], seed=3)


@sheet('fairy_pollen', 'allAllies', 64, 10, P, peak=[3, 5, 7])
def fairy_pollen(c, f):
    cx = CX
    u = ph(f, 0, 9)
    R_ = rng('fpo', 1)
    for k in range(26):                                # 노란 꽃가루가 흩날려 아군을 덮는다
        x0 = R_.uniform(-24, 24); p0 = R_.uniform(0, 1)
        y = 4 + ((p0 + f * .08) % 1.0) * 52
        x = cx + x0 + math.sin(p0 * 9 + f * .6) * 3
        c.px(x, y, [P.W[0], P.PK[2], P.GN[3], P.CY[3]][k % 4]); c.px(x + 1, y, P.PK[1]) if k % 3 == 0 else None
    for k in range(3):
        stamp(c, 'petal', cx - 14 + k * 14, 10 + ((f * 5 + k * 11) % 40), dict(k=P.PK[0], d=P.PK[2], c=P.PK[1], b=P.PK[1], a=P.PK[0]), rot=k + f * .6, scale=1)
    ring(c, cx, 38, 8 + u * 16, P.GN[3], 1, (8 + u * 16) * .9) if f in (2, 3, 4, 5) else None
    ground_ring(c, cx, GY, 10 + f, P.GN[2], 1)


@sheet('fairy_lullaby', 'target', 64, 10, P, peak=[3, 5, 8])
def fairy_lullaby(c, f):
    cx, cy = CX, 34
    for k in range(3):                                 # 졸음 방울과 Z
        y = 46 - ((f * 3 + k * 8) % 30)
        x = cx - 10 + k * 10 + math.sin(f * .8 + k) * 2
        c.ring(x, y, 5 - k, P.CY[2], 1); c.px(x - 2, y - 2, P.W[0])
    for k in range(3):
        x = cx + 6 + k * 5; y = 16 - k * 4 - (f % 4)
        c.line([(x, y), (x + 4, y), (x, y + 4), (x + 4, y + 4)], [P.W[0], P.CY[3], P.CY[2]][k])
    stamp(c, 'moon', cx - 12, 14 + (f % 3 == 0), dict(k=P.CY[0], d=P.W[0], c=P.CY[3], b=P.CY[2]), scale=1) if f >= 2 else None
    c.dither(lambda cc: cc.disc(cx, 38, 22, P.CY[1], 14), f)
    dust(c, 'fll', 10, cx, cy, 4, 24, f / 9, seed=5)


@sheet('fairy_bloom', 'target', 64, 10, P, peak=[3, 6, 8])
def fairy_bloom(c, f):
    cx, cy = CX, 38
    u = ph(f, 0, 5)
    petals = 8
    for k in range(petals):                            # 거대한 꽃이 피어나며 꽃잎 광선
        a = k * math.tau / petals + f * .1
        ln = 4 + 20 * ease(u)
        x1, y1 = cx + math.cos(a) * ln, cy + math.sin(a) * ln * .85
        wd = 3 * ease(u) + 1
        nx, ny = -math.sin(a) * wd, math.cos(a) * wd
        mx, my = cx + math.cos(a) * ln * .6, cy + math.sin(a) * ln * .6 * .85
        c.poly([(cx, cy), (mx + nx, my + ny), (x1, y1), (mx - nx, my - ny)], P.PK[1] if k % 2 else P.PK[2])
        c.line([(cx, cy), (x1, y1)], P.PK[0])
    c.disc(cx, cy, 4 + 2 * u, P.GN[3]); c.disc(cx, cy, 2, P.GD if False else P.W[0])
    if f >= 5:
        v = ph(f, 5, 9)
        ring(c, cx, cy, 8 + v * 22, P.PK[2], 1, (8 + v * 22) * .8)
        dust(c, 'fbl', 18, cx, cy, 5, 28, v, seed=6)
    for k in range(5): firefly(c, cx - 20 + (k * 9 + f * 3) % 41, 12 + (k * 11) % 20, f + k)


@sheet('fairy_grove_sky', 'screen', 128, 12, P, peak=[4, 7, 10])
def fairy_grove_sky(c, f):
    cx, cy = 64, 62
    u = ph(f, 0, 6)
    shade(c, cx, cy, 58, 48, P.GN[0])
    R_ = rng('fgs', 1)
    for k in range(9):                                 # 큰 나무 기둥 실루엣과 잎
        x = 10 + k * 13
        h = 30 + (k * 37) % 40
        c.rect(x, 110 - h * u, x + 3, 118, P.GN[0]); c.rect(x + 1, 110 - h * u, x + 2, 118, P.GN[1])
        c.disc(x + 2, 110 - h * u, 8 * u, P.GN[1]) if u > .3 else None
        c.disc(x, 108 - h * u, 4 * u, P.GN[2]) if u > .5 else None
    for k in range(40):                                # 반딧불 수십 마리
        a = R_.uniform(0, math.tau); r = R_.uniform(10, 54)
        x = cx + math.cos(a + f * .2 * (1 if k % 2 else -1)) * r
        y = cy + 10 + math.sin(a + f * .2 * (1 if k % 2 else -1)) * r * .6
        firefly(c, x, y, f + k)
        if k % 3 == 0: c.disc(x, y, 2, P.GN[2]) if (f + k) % 2 else None
    if f >= 5:
        v = ph(f, 5, 10)
        rays(c, cx, 34, 14, 6, 14 + v * 40, P.CY[3], rot=f * .1, alt=10 + v * 20)
        glow(c, cx, 34, 8 + 6 * v, [P.CY[1], P.CY[2], P.W[0]])
        stamp(c, 'star4', cx, 34, dict(k=P.CY[0], d=P.W[0], c=P.CY[3], b=P.CY[2], a=P.CY[1]), rot=0, scale=2)
    for k in range(20):
        stamp(c, 'petal', 4 + (k * 19 + f * 4) % 120, (k * 23 + f * 8) % 118, dict(k=P.PK[0], d=P.PK[2], c=P.PK[1], b=P.PK[1], a=P.PK[0]), rot=k + f * .3, scale=1)


@sheet('fairy_grove_hit', 'allTargets', 64, 8, P, peak=[2, 3, 5])
def fairy_grove_hit(c, f):
    cx, cy = CX, 38
    u = ph(f, 0, 7)
    flash(c, cx, cy, [8, 12, 9, 6, 4, 2, 1, 1][f], [P.GN[2], P.CY[3], P.W[0]]) if f < 6 else None
    for k in range(6):
        a = k * math.tau / 6
        c.line([(cx, cy), (cx + math.cos(a) * (8 + u * 22), cy + math.sin(a) * (8 + u * 18))], P.GN[3], 2 if f < 4 else 1)
    for k in range(6):
        a = k * math.tau / 6 + .5
        r = 8 + u * 20
        stamp(c, 'leaf', cx + math.cos(a) * r, cy + math.sin(a) * r * .8, LF, rot=a + f, scale=1)
    dust(c, 'fgh', 18, cx, cy, 3, 28, u, seed=7)
    ground_ring(c, cx, 52, 4 + u * 24, P.GN[2], 1)


@sheet('fairy_dash', 'user', 64, 8, P, peak=[2, 4, 6])
def fairy_dash(c, f):
    cx = CX
    for i in range(6):                                 # 빛가루 꼬리
        x = cx + 18 - i * 7 - f * 2
        y = 36 + math.sin(i * 1.3 + f) * 5
        c.spark(x, y, 2 if i < 3 else 1, [P.W[0], P.CY[3], P.GN[3], P.PK[2], P.CY[2], P.GN[2]][i], diag=(i == 0))
        c.line([(x + 3, y), (x + 9, y + math.sin(i) * 2)], [P.CY[2], P.GN[2], P.PK[1]][i % 3])
    c.glow(cx + 14 - f * 2, 36, 6, [P.CY[1], P.CY[2], P.W[0]])
    for k in range(6): firefly(c, cx - 16 + (k * 9 + f * 5) % 33, 22 + (k * 7) % 22, f + k)
    ground_ring(c, cx, GY, 8 + f * 2, P.CY[2], 1)


@sheet('fairy_dash_hit', 'target', 64, 8, P, peak=[1, 3, 5])
def fairy_dash_hit(c, f):
    cx, cy = CX, 38
    u = ph(f, 0, 7)
    for k in range(5):                                 # 별가루 교차 타격선
        a = -math.pi / 2 + (k - 2) * .55
        L = [6, 16, 22, 20, 14, 8, 5, 3][f]
        c.line([(cx, cy), (cx + math.cos(a) * L, cy + math.sin(a) * L)], [P.W[0], P.CY[3], P.PK[2], P.CY[3], P.W[0]][k], 2 if f < 4 else 1)
    flash(c, cx, cy, [6, 9, 7, 5, 3, 2, 1, 1][f], [P.PK[1], P.CY[3], P.W[0]]) if f < 6 else None
    for k in range(5): c.spark(cx + math.cos(k * 1.3 + f) * (6 + u * 18), cy + math.sin(k * 1.3 + f) * (5 + u * 14), 2 - (k % 2), [P.W[0], P.PK[2], P.GN[3]][k % 3])
    ground_ring(c, cx, 52, 4 + u * 20, P.PK[2], 1)


KEYS = ['fairy_dust', 'fairy_dust_hit', 'fairy_vines', 'fairy_swarm', 'fairy_pollen', 'fairy_lullaby', 'fairy_bloom', 'fairy_dash', 'fairy_dash_hit', 'fairy_grove_sky', 'fairy_grove_hit']

if __name__ == '__main__':
    sys.modules['r2w3_fairy'] = sys.modules[__name__]
    import r2w3_skills
    r2w3_skills.build_class('class_fairy', sys.argv[1:])
