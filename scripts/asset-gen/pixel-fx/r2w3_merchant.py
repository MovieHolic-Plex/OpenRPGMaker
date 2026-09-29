"""상인(class_merchant) 이펙트 — 금화·주판·저울·계약서·보물 상자. 상인 청록 + 금 + 갈색 나무.
    python3 scripts/asset-gen/pixel-fx/r2w3_merchant.py [key ...]"""
import math, sys
from lib_r2w3 import *

GD = ['#7a4c0c', '#e0a624', '#ffe066', '#fff8c8']
TL = ['#0c3a48', '#1c8098', '#5cd0d8', '#c0f4f4']
BR = ['#3a2010', '#7a4a24', '#b47a44']
RD = ['#a8243c', '#ff6070']
W = ['#ffffff']
P = Pal(GD=GD, TL=TL, BR=BR, RD=RD, W=W)
COIN = dict(k=P.BR[0], c=P.GD[1], d=P.GD[2], g=P.GD[3], b=P.GD[0])
GEM = dict(k=P.TL[0], d=P.TL[3], c=P.TL[2], b=P.TL[1])
BAG = dict(k=P.BR[0], d=P.GD[2], c=P.GD[1], g=P.RD[1], b=P.GD[0])


def chest(c, cx, y, open_=0.0, w=13, h=9):
    c.rect(cx - w, y, cx + w, y + h, P.BR[0]); c.rect(cx - w + 1, y + 1, cx + w - 1, y + h - 1, P.BR[1])
    c.rect(cx - w + 1, y + 1, cx + w - 1, y + 2, P.BR[2]); c.rect(cx - 1, y, cx + 1, y + h, P.GD[1])
    c.px(cx, y + 4, P.GD[3])
    lid = round(6 * open_)
    if lid:
        c.poly([(cx - w, y), (cx - w + 2, y - lid), (cx + w - 2, y - lid), (cx + w, y)], P.BR[1], outline=P.BR[0])
        c.rect(cx - 1, y - lid, cx + 1, y, P.GD[1])


@sheet('merchant_coin', 'projectile', 32, 4, P)
def merchant_coin(c, f):
    y = 16
    r = max(1, round(6 * abs(math.cos(f * .8))))
    c.disc(13, y, 6, P.GD[0], r); c.disc(13, y - 1, 5, P.GD[1], max(1, r - 1)); c.px(11, y - 3, P.GD[3])
    for i in range(1, 5): c.px(21 + i * 2 + (f + i) % 2, y - 3 + (i * 3 + f) % 6, [P.GD[3], P.GD[2], P.GD[1], P.W[0]][i - 1])


@sheet('merchant_coin_hit', 'target', 64, 8, P, peak=[1, 3, 5])
def merchant_coin_hit(c, f):
    cx, cy = CX, 38
    u = ph(f, 0, 7)
    flash(c, cx, cy, [7, 10, 8, 5, 3, 2, 1, 1][f], [P.GD[1], P.GD[3], P.W[0]]) if f < 6 else None
    R_ = rng('mch', 1)
    for k in range(9):
        a = R_.uniform(0, math.tau); r = 3 + u * R_.uniform(8, 22)
        stamp(c, 'coin', cx + math.cos(a) * r, cy + math.sin(a) * r * .8 - (1 - abs(2 * u - 1)) * 5 + u * u * 10, COIN, scale=1) if u < .85 else None
    ground_ring(c, cx, 52, 4 + u * 20, P.GD[2], 1)
    sparks(c, 'mchs', 10, cx, cy, 3, 22, u, [P.W[0], P.GD[3], P.GD[2]], seed=2)


@sheet('merchant_abacus', 'target', 64, 10, P, peak=[3, 5, 8])
def merchant_abacus(c, f):
    cx, cy = CX, 34
    u = ph(f, 0, 3)
    # 주판이 내려와 구슬이 딸깍딸깍 밀리고 마지막에 대상을 짓누른다
    y = lerp(-6, 30, ease(u)) if f < 8 else 30
    c.rect(cx - 20, y - 12, cx + 20, y + 12, P.BR[0]); c.rect(cx - 19, y - 11, cx + 19, y + 11, P.BR[1])
    c.rect(cx - 19, y - 1, cx + 19, y, P.GD[0])
    for r_ in range(5):
        x = cx - 15 + r_ * 7.5
        c.line([(x, y - 11), (x, y + 11)], P.BR[0])
        for bi in range(4):
            shift = 4 if (bi < ((f + r_) % 4)) else 0
            by = y - 9 + bi * 3 + (shift if bi else 0) * 0
            c.rect(x - 2, y - 10 + bi * 2 + (0 if bi < ((f + r_) % 4) else 6), x + 1, y - 9 + bi * 2 + (0 if bi < ((f + r_) % 4) else 6), P.TL[2] if r_ % 2 else P.GD[2])
    if f >= 8:
        v = ph(f, 8, 9)
        flash(c, cx, 44, [16, 8][min(1, f - 8)], [P.GD[1], P.GD[3], P.W[0]])
        ground_ring(c, cx, 52, 8 + v * 24, P.GD[2], 2, 1)
    elif f >= 5:
        for k in range(6): c.px(cx - 18 + k * 7, y + 14 + (f % 2), P.GD[3])
    sparks(c, 'mab', 8, cx, cy + 10, 4, 24, ph(f, 6, 9), [P.W[0], P.GD[3], P.GD[2]], seed=3)


@sheet('merchant_scale', 'target', 64, 10, P, peak=[3, 5, 8])
def merchant_scale(c, f):
    cx, cy = CX, 30
    tilt = [5, -4, 3, -3, 2, -2, 1, 0, 0, 0][f] * (1.0)
    c.rect(cx - 1, cy - 12, cx, 50, P.GD[0]); c.rect(cx - 8, 50, cx + 7, 52, P.GD[1])
    c.line([(cx - 20, cy + tilt), (cx + 19, cy - tilt)], P.GD[2], 2)
    c.disc(cx, cy - 12, 3, P.GD[2])
    for sx, ty in ((-1, tilt), (1, -tilt)):
        x = cx + sx * 20; y = cy + ty
        c.line([(x, y), (x - 6, y + 12)], P.GD[1]); c.line([(x, y), (x + 6, y + 12)], P.GD[1])
        c.rect(x - 8, y + 12, x + 8, y + 13, P.GD[2]); c.rect(x - 6, y + 14, x + 6, y + 14, P.GD[0])
    for k in range(3): stamp(c, 'coin', cx - 24 + k * 4, cy + tilt + 8 - (k % 2), COIN, scale=1)
    stamp(c, 'gem', cx + 20, cy - tilt + 5, GEM, scale=1)
    if f >= 6:
        u = ph(f, 6, 9)
        flash(c, cx, 46, [10, 6, 3][min(2, f - 6)], [P.TL[2], P.GD[3], P.W[0]])
        ring(c, cx, 50, 6 + u * 24, P.TL[3], 1, 4 + u * 6)
    for k in range(4): c.px(cx - 16 + (k * 11 + f * 3) % 33, 12 + (k * 7) % 14, P.GD[3])
    c.px(cx - 2 + f, 6 + (f % 3), P.W[0])


@sheet('merchant_contract', 'target', 64, 10, P, peak=[3, 5, 8])
def merchant_contract(c, f):
    cx, cy = CX, 34
    u = ph(f, 0, 3)
    y = lerp(-8, 30, ease(u)) if f < 8 else 30
    c.rect(cx - 11, y - 14, cx + 11, y + 14, P.BR[2]); c.rect(cx - 10, y - 13, cx + 10, y + 13, P.W[0])
    for i in range(5): c.line([(cx - 7, y - 9 + i * 4), (cx + 7 - (i % 2) * 4, y - 9 + i * 4)], P.BR[1])
    if f >= 4:
        v = ph(f, 4, 7)
        c.disc(cx + 5, y + 9, 5 * v + 1, P.RD[0]); c.disc(cx + 5, y + 9, 3 * v + 1, P.RD[1]); c.px(cx + 4, y + 8, P.W[0])
    if f >= 5:                                           # 계약 사슬 문양이 대상을 옭아맨다
        for k in range(5):
            a = f * .3 + k * math.tau / 5
            x, yy = orbit(cx, 40, 14 + (f - 5) * 2, a, 6)
            c.rect(x - 1, yy, x + 1, yy + 1, P.GD[1]); c.px(x, yy, P.GD[3])
        ring(c, cx, 46, 10 + (f - 5) * 3, P.GD[2], 1, 5)
    if f in (4, 5): flash(c, cx, 44, 8, [P.RD[1], P.GD[3], P.W[0]])
    sparks(c, 'mct', 8, cx, 40, 3, 22, ph(f, 5, 9), [P.W[0], P.GD[3], P.RD[1]], seed=4)


@sheet('merchant_haggle', 'user', 64, 10, P, peak=[3, 5, 7])
def merchant_haggle(c, f):
    cx = CX
    for k in range(6):                                   # 금화가 주위를 돌며 방어막을 이룬다
        a = f * .55 + k * math.tau / 6
        x, y = orbit(cx, 38, 17, a, 8)
        if math.sin(a) > -.2: stamp(c, 'coin', x, y, COIN, scale=1)
        else: c.px(x, y, P.GD[0])
    c.ring(cx, 38, 17, P.GD[1], 1, 8) if f % 2 == 0 else c.dither(lambda cc: cc.ring(cx, 38, 17, P.GD[2], 1, 8), f)
    stamp(c, 'gem', cx, 12 + (f % 3 == 0), GEM, scale=1) if f >= 3 else None
    motes(c, 'mh', 10, cx, GY, 14, 42, f / 9, [P.GD[3], P.W[0], P.TL[3]], seed=5)
    ground_ring(c, cx, GY, 11 + f % 4, P.GD[1], 1)


@sheet('merchant_bomb', 'projectile', 32, 4, P)
def merchant_bomb(c, f):
    y = 16 + [0, 2, 0, -2][f]
    c.rect(4, y - 4, 13, y + 5, P.BR[0]); c.rect(5, y - 3, 12, y + 4, P.BR[1]); c.rect(5, y - 3, 12, y - 2, P.BR[2])
    c.line([(4, y - 1), (13, y - 1)], P.GD[1]); c.line([(4, y + 2), (13, y + 2)], P.GD[1])
    c.line([(13, y - 4), (16, y - 8)], P.GD[0]); c.px(16 + (f % 2), y - 9, P.RD[1]); c.px(17, y - 10 + f % 2, P.GD[3])
    for i in range(1, 5): c.px(17 + i * 3 + (f + i) % 2, y - 2 + (i * 3 + f) % 5, [P.GD[2], P.RD[1], P.GD[3], P.GD[1]][i - 1])


@sheet('merchant_bomb_hit', 'allTargets', 64, 8, P, peak=[1, 3, 5])
def merchant_bomb_hit(c, f):
    cx, cy = CX, 38
    u = ph(f, 0, 7)
    flash(c, cx, cy, [10, 14, 11, 8, 5, 3, 2, 1][f], [P.RD[0], P.RD[1], P.GD[2], P.W[0]]) if f < 7 else None
    R_ = rng('mbh', 1)
    for k in range(10):
        a = R_.uniform(0, math.tau); r = 4 + u * R_.uniform(8, 26)
        stamp(c, 'coin', cx + math.cos(a) * r, cy + math.sin(a) * r * .8 - (1 - abs(2 * u - 1)) * 6 + u * u * 10, COIN, scale=1) if u < .85 else None
    for k in range(8):
        a = k * math.tau / 8
        c.line([(cx + math.cos(a) * 6, cy + math.sin(a) * 6), (cx + math.cos(a) * (10 + u * 18), cy + math.sin(a) * (9 + u * 14))], P.GD[3] if k % 2 else P.RD[1])
    ground_ring(c, cx, 52, 4 + u * 24, P.RD[1], 1)
    sparks(c, 'mbhs', 12, cx, cy, 3, 26, u, [P.W[0], P.GD[3], P.GD[2], P.RD[1]], seed=6)


@sheet('merchant_market', 'allTargets', 64, 10, P, peak=[3, 5, 7])
def merchant_market(c, f):
    cx = CX
    u = ph(f, 0, 4)
    for i, x in enumerate((cx - 21, cx, cx + 21)):        # 노점 차양이 펼쳐지고 상품이 쏟아진다
        top = 10 + i % 2 * 4
        for k in range(9):
            xx = x - 10 + k * 2.5
            c.rect(xx, top, xx + 2, top + 6 * u, P.RD[1] if k % 2 else P.W[0])
        c.rect(x - 11, top - 1, x + 11, top, P.BR[1])
    R_ = rng('mmk', 1)
    for k in range(18):
        x0 = R_.uniform(-24, 24); p0 = R_.uniform(0, 1)
        v = clamp((f / 9 - p0 * .4) * 1.6)
        y = 20 + v * 32
        x = cx + x0
        if 0 < v < 1 and f >= 2:
            [lambda: stamp(c, 'coin', x, y, COIN, scale=1), lambda: stamp(c, 'gem', x, y, GEM, scale=1), lambda: stamp(c, 'bag', x, y, BAG, scale=1)][k % 3]()
    if f >= 4:
        for x in (cx - 21, cx, cx + 21):
            ground_ring(c, x, 52, 4 + (f - 4) * 3, P.GD[2], 1)
    sparks(c, 'mmks', 10, cx, 42, 4, 26, ph(f, 4, 9), [P.W[0], P.GD[3], P.GD[2]], seed=7)


@sheet('merchant_vault_sky', 'screen', 128, 12, P, peak=[4, 7, 10])
def merchant_vault_sky(c, f):
    cx, cy = 64, 62
    u = ph(f, 0, 5)
    shade(c, cx, cy, 58, 48, P.TL[0])
    open_ = ph(f, 3, 7)
    chest(c, cx, 96 - 30 * ease(u) + 6, open_, w=30, h=22)
    if f >= 5:
        v = ph(f, 5, 11)
        R_ = rng('mvs', 1)
        for k in range(50):
            a = R_.uniform(-2.7, -.4); sp = R_.uniform(28, 62)
            t = clamp(v * 1.1 - R_.uniform(0, .3))
            x = cx + math.cos(a) * sp * t
            y = 70 + math.sin(a) * sp * t * 1.3 + t * t * 60
            if 0 < t < 1: [lambda: stamp(c, 'coin', x, y, COIN, scale=2), lambda: stamp(c, 'gem', x, y, GEM, scale=1), lambda: c.rect(x, y, x + 1, y + 1, P.GD[3])][k % 3]()
        rays(c, cx, 70, 18, 14, 34 + v * 26, P.GD[3], rot=f * .1, alt=26)
        glow(c, cx, 70, 10 + 8 * v, [P.GD[1], P.GD[2], P.W[0]])
    for k in range(24): c.px(6 + (k * 23 + f * 7) % 116, 6 + (k * 17) % 100, [P.GD[3], P.TL[3]][k % 2])


@sheet('merchant_vault_hit', 'allTargets', 64, 8, P, peak=[2, 3, 5])
def merchant_vault_hit(c, f):
    cx, cy = CX, 36
    u = ph(f, 0, 7)
    R_ = rng('mvh', 1)
    for k in range(12):
        x0 = R_.uniform(-22, 22); t0 = R_.uniform(0, .3)
        v = clamp((u - t0) * 2)
        if 0 < v < 1: stamp(c, 'coin' if k % 3 else 'gem', cx + x0, -4 + v * 52, COIN if k % 3 else GEM, scale=1)
    flash(c, cx, 46, [8, 12, 9, 6, 4, 2, 1, 1][f], [P.GD[1], P.GD[3], P.W[0]]) if f < 6 else None
    ground_ring(c, cx, 52, 4 + u * 24, P.GD[2], 2 if u < .3 else 1)
    sparks(c, 'mvh', 14, cx, 44, 3, 26, u, [P.W[0], P.GD[3], P.GD[2], P.TL[3]], seed=8)


KEYS = ['merchant_coin', 'merchant_coin_hit', 'merchant_abacus', 'merchant_scale', 'merchant_contract', 'merchant_haggle', 'merchant_bomb',
        'merchant_bomb_hit', 'merchant_market', 'merchant_vault_sky', 'merchant_vault_hit']

if __name__ == '__main__':
    sys.modules['r2w3_merchant'] = sys.modules[__name__]
    import r2w3_skills
    r2w3_skills.build_class('class_merchant', sys.argv[1:])
