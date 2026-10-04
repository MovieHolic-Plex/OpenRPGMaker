"""국왕(class_king) 이펙트 — 왕명·홀·군기·금화 인장·왕의 위광. 왕가 자주 + 금 + 흰 담비털.
    python3 scripts/asset-gen/pixel-fx/r2w3_king.py [key ...]"""
import math, sys
from lib_r2w3 import *

RY = ['#2a0c3a', '#6a1c78', '#b04ac0', '#e8a0f0']
GD = ['#7a4c0c', '#e0a624', '#ffe066', '#fff8c8']
RD = ['#5c0c1c', '#c8283c', '#ff7078']
W = ['#ffffff', '#c8c0d8']
P = Pal(RY=RY, GD=GD, RD=RD, W=W)
CROWN = dict(k=P.RY[0], d=P.GD[2], c=P.GD[1], b=P.GD[1], r=P.RD[1], g=P.GD[3])
FLAG = dict(k=P.RY[0], d=P.RD[2], c=P.RD[1], b=P.RD[1], a=P.RD[0], g=P.GD[2])
COIN = dict(k=P.RY[0], c=P.GD[1], d=P.GD[2], g=P.GD[3], b=P.GD[0])


def seal(c, cx, cy, r, f, cols):
    """왕가 인장 마법진: 이중 고리 + 왕관 문양 룬."""
    c.ring(cx, cy, r, cols[0], 1, r * .34); c.ring(cx, cy, r * .72, cols[1], 1, r * .25)
    for k in range(8):
        a = f * .2 + k * math.tau / 8
        x, y = orbit(cx, cy, r, a, r * .34)
        c.px(x, y - 1, cols[2]); c.px(x, y, cols[2])


@sheet('king_scepter', 'projectile', 32, 4, P)
def king_scepter(c, f):
    y = 16 + [0, 1, 0, -1][f]
    c.line([(24, y), (7, y)], P.GD[1], 2); c.line([(24, y - 1), (9, y - 1)], P.GD[2])
    c.disc(6, y, 3, P.GD[0]); c.disc(6, y, 2, P.RD[1]); c.px(5, y - 1, P.RD[2])
    for i in range(1, 5): c.px(26 + i, y - 3 + (i * 3 + f) % 6, [P.GD[3], P.RY[3], P.GD[2], P.RD[2]][i - 1])
    c.spark(4 + f % 2, y - 5, 1, P.W[0])


@sheet('king_scepter_hit', 'target', 64, 8, P, peak=[2, 3, 5])
def king_scepter_hit(c, f):
    cx, cy = CX, 38
    u = ph(f, 0, 7)
    flash(c, cx, cy, [8, 12, 9, 6, 4, 2, 1, 1][f], [P.RD[1], P.GD[2], P.W[0]]) if f < 6 else None
    stamp(c, 'crown', cx, cy - 6 - u * 6, CROWN, scale=[1, 2, 2, 2, 1, 1, 1, 1][f])
    for k in range(6):
        a = k * math.tau / 6
        c.line([(cx + math.cos(a) * 5, cy + math.sin(a) * 5), (cx + math.cos(a) * (10 + u * 18), cy + math.sin(a) * (9 + u * 14))], P.GD[2], 2 if f < 3 else 1)
    ground_ring(c, cx, 52, 4 + u * 24, P.GD[1], 1)
    sparks(c, 'ksh', 12, cx, cy, 3, 24, u, [P.W[0], P.GD[3], P.GD[2], P.RD[2]], seed=1)


@sheet('king_decree', 'allAllies', 64, 10, P, peak=[3, 5, 7])
def king_decree(c, f):
    cx = CX
    u = ph(f, 0, 4)
    # 두루마리(왕명)가 펼쳐지며 금빛 글줄이 아군 위로 번진다
    h = 16 * ease(u)
    c.rect(cx - 12, 14, cx + 12, 14 + h, P.W[1]); c.rect(cx - 11, 15, cx + 11, 13 + h, P.W[0])
    c.rect(cx - 14, 12, cx + 14, 14, P.GD[1]); c.rect(cx - 14, 14 + h, cx + 14, 16 + h, P.GD[1])
    for i in range(4):
        if 18 + i * 4 < 14 + h - 1:
            c.line([(cx - 8, 18 + i * 4), (cx + 8 - (i % 2) * 4, 18 + i * 4)], P.RD[1] if i == 3 else P.RY[1])
    c.disc(cx + 8, 12 + h + 4, 3, P.RD[1]) if f >= 4 else None
    if f >= 4:
        v = ph(f, 4, 9)
        for k in range(10):
            x = cx - 26 + k * 6; y = 36 + math.sin(k + f) * 3
            stamp(c, 'star4', x, y - v * 8, dict(k=P.GD[0], d=P.W[0], c=P.GD[3], b=P.GD[2], a=P.GD[1]), scale=1) if (k + f) % 2 == 0 else c.px(x, y, P.GD[2])
        ring(c, cx, 40, 10 + v * 18, P.GD[2], 1, (10 + v * 18) * .5)
    ground_ring(c, cx, GY, 12 + f, P.GD[1], 1)


@sheet('king_banner', 'allAllies', 64, 10, P, peak=[3, 5, 7])
def king_banner(c, f):
    cx = CX
    u = ph(f, 0, 3)
    top = 58 - 44 * ease(u)
    c.rect(cx - 1, top, cx, GY, P.GD[0]); c.disc(cx, top - 1, 2, P.GD[2])
    wave = lambda i: math.sin(f * .9 + i * .55) * 2.5
    for i in range(0, 22):                                # 펄럭이는 군기
        x = cx + 2 + i
        y0 = top + 2 + wave(i)
        c.line([(x, y0), (x, y0 + 15 - i * .3)], P.RD[1] if i % 7 < 5 else P.RD[0])
        c.px(x, y0, P.RD[2])
    stamp(c, 'crown', cx + 12, top + 9 + wave(10), CROWN, scale=1)
    if f >= 3:
        v = ph(f, 3, 9)
        ring(c, cx, GY, 8 + v * 24, P.GD[2], 2 if v < .4 else 1, (8 + v * 24) * .3)
        for k in range(8):
            a = k * math.tau / 8
            c.line([(cx + math.cos(a) * 8, 50 + math.sin(a) * 3), (cx + math.cos(a) * (14 + v * 12), 50 + math.sin(a) * (5 + v * 4))], P.GD[3])
    motes(c, 'kb', 10, cx, GY, 18, 44, f / 9, [P.GD[3], P.W[0], P.RD[2]], seed=2)


@sheet('king_guard', 'allTargets', 64, 10, P, peak=[3, 5, 7])
def king_guard(c, f):
    cx = CX
    u = ph(f, 0, 4)
    for i, x in enumerate((cx - 20, cx, cx + 20)):        # 근위대 창끝이 위에서 내리꽂힌다
        d = ph(f, .3 + i * .5, 3.6 + i * .5)
        y = lerp(-6, 34, ease(d))
        if d > 0:
            c.line([(x, y - 22), (x, y)], P.GD[1], 2); c.line([(x, y - 22), (x, y)], P.GD[3], 1)
            c.poly([(x - 3, y), (x, y + 9), (x + 3, y)], P.W[0])
            c.rect(x - 3, y - 22, x + 3, y - 20, P.RD[1])
            if d >= 1:
                flash(c, x, 44, [6, 4, 2][min(2, f - 4) if f >= 4 else 0], [P.GD[2], P.W[0]]) if f < 7 else None
                ring(c, x, 52, 5 + (f - 3) * 3, P.GD[2], 1, 3)
    sparks(c, 'kg', 10, cx, 42, 3, 26, ph(f, 3, 9), [P.W[0], P.GD[3], P.GD[2]], seed=3)


@sheet('king_tribute', 'target', 64, 8, P, peak=[2, 3, 5])
def king_tribute(c, f):
    cx, cy = CX, 38
    u = ph(f, 0, 7)
    R_ = rng('kt', 1)
    for k in range(12):                                   # 금화 인장 비
        x0 = R_.uniform(-18, 18); t0 = R_.uniform(0, .4)
        v = clamp((u - t0) * 2.2)
        if 0 < v < 1: stamp(c, 'coin', cx + x0, -4 + v * 46, COIN, scale=1)
    if f >= 2:
        seal(c, cx, 50, 10 + u * 18, f, [P.GD[2], P.GD[1], P.GD[3]])
        flash(c, cx, 46, [8, 6, 4, 2, 1][min(4, f - 2)], [P.GD[1], P.GD[3], P.W[0]])
    sparks(c, 'kt', 10, cx, 44, 3, 24, u, [P.W[0], P.GD[3], P.GD[2]], seed=4)


@sheet('king_aura', 'user', 64, 10, P, peak=[3, 5, 7])
def king_aura(c, f):
    cx = CX
    seal(c, cx, GY - 2, 18 + math.sin(f) * 2, f, [P.GD[2], P.RY[2], P.GD[3]])
    for k in range(12):                                   # 위로 뻗는 왕의 기세 줄기
        x = cx - 20 + k * 3.6
        h = 18 + ((k * 7 + f * 5) % 22)
        c.line([(x, GY - 4), (x, GY - 4 - h)], P.RY[2] if k % 2 else P.GD[1])
        c.px(x, GY - 4 - h, P.GD[3])
    stamp(c, 'crown', cx, 10 + (f % 3 == 0), CROWN, scale=2) if f >= 2 else None
    motes(c, 'ka', 10, cx, GY, 16, 44, f / 9, [P.GD[3], P.W[0], P.RY[3]], seed=5)


@sheet('king_crown_drop', 'target', 64, 10, P, peak=[3, 5, 8])
def king_crown_drop(c, f):
    cx, cy = CX, 38
    if f <= 3:
        y = lerp(6, 36, ease(ph(f, 0, 3)))
        stamp(c, 'crown', cx, y, CROWN, scale=3)
        c.line([(cx - 8, max(0, y - 16)), (cx - 8, y - 4)], P.GD[2]); c.line([(cx + 8, max(0, y - 10)), (cx + 8, y - 4)], P.GD[1])
        return
    u = ph(f, 3, 9)
    flash(c, cx, cy, [16, 12, 8, 5, 3, 2][min(5, f - 3)], [P.RD[1], P.GD[2], P.W[0]])
    stamp(c, 'crown', cx, cy - u * 4, CROWN, scale=3 if f < 7 else 2)
    ring(c, cx, 52, 6 + u * 28, P.GD[2], 2 if u < .3 else 1, 4 + u * 8)
    for k in range(10):
        a = k * math.tau / 10
        c.line([(cx + math.cos(a) * (8 + u * 6), cy + math.sin(a) * (7 + u * 5)), (cx + math.cos(a) * (14 + u * 18), cy + math.sin(a) * (12 + u * 14))], P.GD[3] if k % 2 else P.RD[2])
    sparks(c, 'kcd', 14, cx, cy, 4, 28, u, [P.W[0], P.GD[3], P.GD[2], P.RD[1]], seed=6)


@sheet('king_realm_sky', 'screen', 128, 12, P, peak=[4, 7, 10])
def king_realm_sky(c, f):
    cx, cy = 64, 62
    u = ph(f, 0, 5)
    shade(c, cx, cy, 58, 48, P.RY[0])
    for i in range(7):                                    # 성벽 실루엣과 깃발 행렬이 떠오른다
        x = 10 + i * 18
        h = (24 + (i % 3) * 8) * u
        c.rect(x - 5, 112 - h, x + 5, 118, P.RY[1]); c.rect(x - 5, 108 - h, x - 3, 112 - h, P.RY[1]); c.rect(x + 3, 108 - h, x + 5, 112 - h, P.RY[1])
        if u > .5:
            c.line([(x, 108 - h), (x, 96 - h)], P.GD[0]); c.poly([(x, 96 - h), (x + 8, 99 - h + math.sin(f + i)), (x, 102 - h)], P.RD[1])
    seal(c, cx, 52, 40 * u, f, [P.GD[2], P.RY[3], P.GD[3]])
    if f >= 4:
        v = ph(f, 4, 8)
        stamp(c, 'crown', cx, lerp(-14, 44, ease(v)), CROWN, scale=5)
        glow(c, cx, lerp(-14, 44, ease(v)), 18, [P.GD[0], P.GD[1], P.GD[2]])
        stamp(c, 'crown', cx, lerp(-14, 44, ease(v)), CROWN, scale=5)
    if f >= 8:
        w = ph(f, 8, 11)
        flash(c, cx, 50, [28, 18, 10, 5][min(3, f - 8)], [P.RD[1], P.GD[2], P.W[0]])
        rays(c, cx, 50, 16, 10, 20 + w * 40, P.GD[3], rot=f * .1, alt=30)
    for k in range(20): c.px(8 + (k * 23 + f * 7) % 112, 6 + (k * 17) % 100, [P.GD[3], P.RY[3]][k % 2])


@sheet('king_realm_hit', 'allTargets', 64, 8, P, peak=[2, 3, 5])
def king_realm_hit(c, f):
    cx, cy = CX, 36
    u = ph(f, 0, 7)
    if f < 3: column(c, cx, 0, GY, [3, 7, 10][f], [P.GD[1], P.GD[2], P.GD[3], P.W[0]])
    flash(c, cx, 46, [8, 12, 9, 6, 4, 2, 1, 1][f], [P.RD[1], P.GD[3], P.W[0]]) if f < 6 else None
    stamp(c, 'crown', cx, 30, CROWN, scale=[1, 2, 3, 3, 3, 2, 2, 1][f])
    rays(c, cx, 34, 12, 8, 10 + u * 20, P.GD[2], rot=f * .3, alt=12 + u * 8)
    ground_ring(c, cx, 52, 4 + u * 24, P.GD[2], 1)
    sparks(c, 'krh', 12, cx, 40, 3, 26, u, [P.W[0], P.GD[3], P.GD[2], P.RD[2]], seed=8)


KEYS = ['king_scepter', 'king_scepter_hit', 'king_decree', 'king_banner', 'king_guard', 'king_tribute', 'king_aura', 'king_crown_drop', 'king_realm_sky', 'king_realm_hit']

if __name__ == '__main__':
    sys.modules['r2w3_king'] = sys.modules[__name__]
    import r2w3_skills
    r2w3_skills.build_class('class_king', sys.argv[1:])
