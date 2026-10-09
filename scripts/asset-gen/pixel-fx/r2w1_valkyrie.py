"""발키리(class_valkyrie, 칩 actor1-1): 푸른 머리 창 전사 — 비행·강하 창술. 색: 하늘 푸른색 + 강철 + 금 + 흰 깃털.
이 모듈이 스킬 8개(SKILLS)와 이펙트 시트 전부를 가진다. lib_r2w1.py 머리 주석 참고."""
import math

from lib_r2w1 import *

SKILLS = Skills('valkyrie', 'class_valkyrie', 'actor1-1')
SKILLS.add('thrust', '질풍 찌르기', 1, 'dash-strike', '바람을 감은 창으로 일직선으로 꿰뚫는다', 'valkyrie_thrust') \
    .add('feather', '깃털 베기', 3, 'flurry', '흰 깃털이 흩날리는 세 번의 베기', 'valkyrie_feather') \
    .add('javelin', '투창', 5, 'shoot', '손에서 창을 던져 꽂아 넣는다', 'valkyrie_javelin', 'valkyrie_javelin_hit') \
    .add('wings', '날개 방벽', 7, 'buff', '날개를 펼쳐 몸을 감싸고 방어를 올린다', 'valkyrie_wings') \
    .add('dive', '급강하', 10, 'leap-strike', '하늘 높이 올라 창끝으로 내리꽂는다', 'valkyrie_dive') \
    .add('lance_rain', '창우', 12, 'cast', '하늘에서 수많은 창을 쏟아 붓는다', 'valkyrie_lance_rain', 'valkyrie_lance_hit') \
    .add('gale', '바람의 축복', 16, 'buff', '아군 모두에게 바람이 감겨 속도가 오른다', 'valkyrie_gale') \
    .add('valhalla', '발할라 강림', 22, 'finisher', '천상의 문이 열리고 황금 창이 내려꽂히는 필살기', 'valkyrie_valhalla_sky', 'valkyrie_valhalla_hit')

WING = pal(pick(SKY, 'b0', 'b1', 'b2', 'b3', 'b4'), pick(STEEL, 's1', 's2', 's3'), pick(GOLD, 'y1', 'y2', 'y3'), WHITE)
CX, CY = 32, 34
BLUE = ['b1', 'b2', 'b3', 'b4', 'w']


def T(f, n):
    return f / (n - 1)


def feather_fx(c, cx, cy, n, spread, fall, seed, f, f0=2, L=7):
    r = rng(seed)
    for i in range(n):
        a = r.uniform(0, math.tau)
        d = r.uniform(0.35, 1.0) * spread * min(1.0, (f - f0 + 1) / 4)
        x = cx + math.cos(a) * d
        y = cy + math.sin(a) * d * 0.85 + max(0, f - f0) * fall * r.uniform(0.4, 1.2)
        c.petal(x, y, a + f * 0.35, L - (i % 3), ['w', 'b4', 'b3'][i % 3], 'b2', edge='b1')


# --------------------------------------------------------------------------- 1 질풍 찌르기
@effect('valkyrie_thrust', 64, 8, 'target', WING)
def _(c, f):
    tipx = [66, 60, 44, 30, 30, 30, 30, 30][f]
    tipy = CY + [-2, -1, 0, 1, 1, 1, 1, 1][f]
    if f == 0:
        for k, (y, x0) in enumerate(((22, 44), (34, 50), (46, 42))):
            c.lens((x0, y), (62, y - 2), 4, ['b1', 'b2', 'b3'])
        c.spear(70, CY - 2, math.pi - 0.05, 46, shaft='s1', head='s2', hi='w', wrap='y2', edge='b0', big=1.3)
        c.spark(56, CY - 2, 4, 'w', 'b3')
    if 1 <= f <= 3:
        # 창 뒤로 바람의 꼬리(굵은 렌즈 세 겹).
        for k, (dy, th) in enumerate(((-6, 5), (4, 6), (12, 4))):
            c.lens((tipx + 10, tipy + dy), (min(66, tipx + 46), tipy + dy * 1.6), th, ['b1', 'b2', 'b3'])
        c.spear(tipx, tipy, math.pi - 0.05, 46, shaft='s1', head='s2', hi='w', wrap='y2', edge='b0', big=1.3)
        c.arc(tipx + 4, tipy, 10, 100, 260, 'b4', 1) if f > 0 else None
    if f == 3:
        c.glow(30, tipy, 12, ['b2', 'b3', 'b4', 'w'])
    if f >= 4:
        u = (f - 4) / 3
        c.spear(30, tipy, math.pi - 0.05, 46, shaft='s1', head='s2', hi='w', wrap='y2', edge='b0', big=1.3) if f == 4 else None
        c.burst(CX, CY, max(4, 14 - u * 10), BLUE, rays=8, rot=u * 0.4, long=1.9 - u * 0.7)
        r = 8 + u * 20
        c.ring(CX, CY, r, 'b2', 3)
        c.ring(CX, CY, r - 2, 'b3', 1)
        c.dring(CX, CY, r + 4, 'b1')
        feather_fx(c, CX, CY, 6, 26, 2, 3, f, f0=4, L=8)


# --------------------------------------------------------------------------- 2 깃털 베기
@effect('valkyrie_feather', 64, 9, 'target', WING)
def _(c, f):
    cuts = [((6, 10), (56, 52), -14), ((58, 10), (8, 50), 14), ((4, 34), (60, 28), -10)]
    if f == 0:
        r0 = rng(1)
        for i in range(10):
            a = r0.uniform(0, math.tau)
            d = r0.uniform(14, 28)
            c.px(CX + math.cos(a) * d, CY + math.sin(a) * d, 'w' if i % 2 else 'b3')
        c.spark(CX, CY, 5, 'w', 'b3', diag=True)
    for i, (p0, p1, bow) in enumerate(cuts):
        s0 = 1 + i * 2
        if f == s0:
            c.blade(p0, p1, bow, 12, ['b1', 'b2', 'b3', 'w'], frac=0.65)
        elif f == s0 + 1:
            c.blade(p0, p1, bow, 12, ['b1', 'b2', 'b3', 'w'])
            c.spark(p1[0], p1[1], 5, 'w', 'b3', diag=True)
        elif f == s0 + 2:
            c.blade(p0, p1, bow, 6, ['b1', 'b3'])
    if f in (2, 4, 6):
        c.burst(CX, CY, 8, BLUE, rays=6, rot=f, long=1.7)
    if f >= 2:
        feather_fx(c, CX, CY, 12, 26, 2.2, 5, f, f0=2, L=9)
    if f == 8:
        c.dring(CX, CY, 25, 'b3')


# --------------------------------------------------------------------------- 3 투창
@effect('valkyrie_javelin', 32, 4, 'projectile', WING)
def _(c, f):
    wob = [0, -1, 0, 1][f]
    c.lens((10, 16 + wob), (31, 16 + wob), 4, ['b1', 'b2', 'b3'])
    c.spear(9, 16 + wob, math.pi - 0.02, 30, shaft='s1', head='s2', hi='w', wrap='y2', edge='b0', big=1.0)
    for i in range(3):
        c.px(22 + ((f * 3 + i * 4) % 9), 9 + i * 7, 'b4')
    c.glow(3, 16 + wob, 4, ['b3', 'b4', 'w'])


@effect('valkyrie_javelin_hit', 64, 8, 'target', WING)
def _(c, f):
    wob = [0, -3, 2, -1, 1, 0, 0, 0][f]
    if f < 6:
        c.spear(CX - 4, CY + 2, math.pi - 0.7 + wob * 0.03, 34, shaft='s1', head='s2', hi='w', wrap='y2', edge='b0', big=1.2)
    if f <= 5:
        c.burst(CX - 4, CY + 2, max(3, 12 - f * 2), BLUE, rays=8, rot=0.2, long=1.8 - f * 0.15)
    for k in range(3):
        rr = 5 + f * 3.5 + k * 3
        if rr < 30:
            c.ring(CX - 4, CY + 2, rr, ['b3', 'b2', 'b1'][k], 2 if k == 0 else 1)
    r = rng(9)
    for i in range(10):
        a = r.uniform(0, math.tau)
        d = max(0, f - 1) * 4.5 * r.uniform(0.6, 1.2)
        c.px(CX + math.cos(a) * d, CY + math.sin(a) * d - max(0, f - 3), 'w' if i % 2 else 'b3')
    if f >= 5:
        c.petal(CX - 10, CY - 14 + (f - 5) * 4, 2.2, 8, 'b4', 'b2', edge='b1')
        c.petal(CX + 8, CY - 10 + (f - 5) * 4, 0.9, 8, 'w', 'b3', edge='b1')


# --------------------------------------------------------------------------- 4 날개 방벽
@effect('valkyrie_wings', 64, 10, 'user', WING)
def _(c, f):
    t = T(f, 10)
    open_ = ease(min(1, t * 1.6))
    span = 8 + open_ * 24
    flap = math.sin(t * math.pi * 2.4) * 0.3 + (0.5 if f < 4 else 0.15)
    if f >= 2:
        c.glow(CX, 32, 22 * open_, ['b1', 'b2', 'b3'], squash=1.15)
    for side in (-1, 1):
        c.wing(CX + side * 4, 30, side, span, ['b0', 'b1', 'b2', 'b3', 'w'], flap=flap, feathers=6)
    if f >= 3:
        rr = 15 + (f - 3) * 1.3
        c.ring(CX, 32, rr, 'b3', 2, 1.2) if f < 8 else c.dring(CX, 32, 20, 'b3', squash=1.2)
        c.ring(CX, 32, rr - 2, 'w', 1, 1.2) if 3 <= f < 6 else None
    r = rng(2)
    for i in range(8):
        x = CX + r.uniform(-24, 24)
        y = 54 - ((f * 5 + i * 9) % 46)
        c.petal(x, y, 1.0 + i, 5, 'w' if i % 2 else 'b4', 'b3')
    if f >= 5:
        c.ring(CX, 9, 7, 'y2', 2, 0.32)
        c.ring(CX, 9, 5, 'y3', 1, 0.32)


# --------------------------------------------------------------------------- 5 급강하
@effect('valkyrie_dive', 128, 10, 'target', WING)
def _(c, f):
    cx, cy = 64, 92
    if f <= 3:
        u = [0.12, 0.42, 0.72, 0.95][f]
        x0, y0, x1, y1 = 104, 2, cx, cy - 4
        x, y = lerp(x0, x1, u), lerp(y0, y1, u)
        pts = [(lerp(x0, x1, max(0, u - 0.05 * k)), lerp(y0, y1, max(0, u - 0.05 * k))) for k in range(12)]
        c.trail(pts, ['b1', 'b2', 'b3', 'w'], 12, 1)
        ang = math.atan2(y1 - y0, x1 - x0)
        c.spear(x, y, ang, 48, shaft='s1', head='s2', hi='w', wrap='y2', edge='b0', big=1.6)
        for k in range(6):
            c.line([(x + 10 + k * 4, y - 16 - k * 8), (x + 16 + k * 4, y - 6 - k * 8)], 'b3' if k % 2 else 'b2', 2)
        c.glow(x, y, 10, ['b2', 'b3', 'w'])
    if f >= 3:
        u = max(0, (f - 3) / 6)
        c.burst(cx, cy, max(6, 28 - u * 22), BLUE, rays=10, rot=u * 0.3, long=2.0 - u * 0.9)
    if f >= 4:
        u = (f - 4) / 5
        c.shockring(cx, 112, 10 + u * 50, 'b3', 'w', 0.4, 3)
        c.shockring(cx, 112, 4 + u * 36, 'b2', 'b1', 0.4, 2)
        r = rng(4)
        for i in range(18):
            a = r.uniform(math.pi, math.tau) if i % 3 else r.uniform(0, math.pi)
            d = (8 + u * 38) * r.uniform(0.6, 1.2)
            x, y = cx + math.cos(a) * d * 1.2, cy + math.sin(a) * d * 0.8 + u * 8
            c.disc(x, y, 3 - u * 2, 'b3' if i % 2 else 'w')
        feather_fx(c, cx, cy - 10, 8, 40, 3, 7, f, f0=4, L=12)


# --------------------------------------------------------------------------- 6 창우
@effect('valkyrie_lance_rain', 128, 10, 'screen', WING)
def _(c, f):
    for i in range(11):
        x0 = 14 + (i * 53) % 100
        land = 66 + (i * 37) % 44
        start = (i % 5) - 1
        u = (f - start) / 4
        if u < 0:
            continue
        if u < 1:
            y = lerp(-10, land, ease(u))
            x = x0 + (land - y) * 0.35
            c.lens((x + 12, y - 44), (x + 2, y - 8), 5, ['b1', 'b2', 'b3'])
            c.spear(x, y, math.pi / 2 + 0.33, 36, shaft='s1', head='s2', hi='w', wrap='y2', edge='b0', big=1.2)
        else:
            k = u - 1
            c.spear(x0, land, math.pi / 2 + 0.33, 32 - k * 10, shaft='s1', head='s2', hi='w', wrap='y2', edge='b0', big=1.2)
            if k < 0.75:
                c.shockring(x0, land + 4, 4 + k * 22, 'b3', 'w', 0.45, 2)
                c.burst(x0, land, max(2, 9 - k * 12), BLUE, rays=6, long=1.6)
    if f >= 6:
        r = rng(3)
        for i in range(12):
            a = r.uniform(0, math.tau)
            d = r.uniform(18, 52)
            c.petal(64 + math.cos(a) * d, 84 + math.sin(a) * d * 0.5 + (f - 6) * 2, a, 6, 'w' if i % 2 else 'b4', 'b3')


@effect('valkyrie_lance_hit', 64, 8, 'allTargets', WING)
def _(c, f):
    if f < 5:
        c.lens((CX + 4, CY - 44), (CX - 2, CY - 6), 5, ['b1', 'b2', 'b3'])
        c.spear(CX - 2, CY + lerp(-32, 2, ease(min(1, f / 2.4))), math.pi / 2 + 0.33, 30, shaft='s1', head='s2', hi='w', wrap='y2', edge='b0', big=1.2)
    if f >= 2:
        u = (f - 2) / 5
        c.burst(CX - 2, CY + 2, max(3, 13 - u * 10), BLUE, rays=8, long=1.7)
        c.shockring(CX - 2, CY + 16, 6 + u * 24, 'b3', 'w', 0.5, 2)
        for i in range(6):
            a = math.tau * i / 6 + 0.3
            c.px(CX + math.cos(a) * (8 + u * 16), CY + 2 + math.sin(a) * (8 + u * 14), 'b4')


# --------------------------------------------------------------------------- 7 바람의 축복
@effect('valkyrie_gale', 64, 10, 'allAllies', WING)
def _(c, f):
    t = T(f, 10)
    for ribbon in range(3):
        ph = t * math.tau + ribbon * math.tau / 3
        keys = ['b2', 'b3', 'w']
        pts = []
        for k in range(26):
            u = k / 25
            y = 56 - u * 46
            x = CX + math.sin(ph + u * 7.0) * (11 + u * 8) * (1 - 0.3 * u)
            pts.append((x, y))
        for i in range(len(pts) - 1):
            depth = math.cos(ph + (i / 25) * 7.0)
            if depth > 0:
                c.line([pts[i], pts[i + 1]], keys[ribbon], 3 if depth > 0.6 else 2)
                if depth > 0.7:
                    c.px(pts[i][0], pts[i][1], 'b4')
            else:
                c.line([pts[i], pts[i + 1]], 'b1', 1)
    r = rng(6)
    for i in range(7):
        y = 52 - ((f * 5 + i * 8) % 42)
        x = CX + r.uniform(-18, 18) + math.sin(f + i) * 3
        c.petal(x, y, 1.2 + i, 6, 'w', 'b3', edge='b1')
    if f in (2, 5, 8):
        c.ring(CX, 32, 19, 'b3', 1, 1.2)
    c.ring(CX, 10, 8, 'y2', 1, 0.35)


# --------------------------------------------------------------------------- 8 발할라 강림
@effect('valkyrie_valhalla_sky', 128, 12, 'screen', WING)
def _(c, f):
    t = T(f, 12)
    cx = 64
    gate = ease(min(1, t * 2.2))
    top = 46 - gate * 22
    for k, key in enumerate(['y1', 'y2', 'y3']):
        w = 44 - k * 3
        c.rect(cx - w, top + k, cx - w + 6 - k * 2, 96, key)
        c.rect(cx + w - 6 + k * 2, top + k, cx + w, 96, key)
        c.arc(cx, top + 20, w, 180, 360, key, 3, 0.75 if k == 0 else 0.7)
    if gate > 0.4:
        for i in range(9):
            a = math.radians(-160 + i * 17.5)
            c.lens(pol(cx, top + 22, 12, a, 0.9), pol(cx, top + 22, 44 + gate * 30, a, 0.9), 3, ['y1', 'y2', 'y3'])
    c.glow(cx, top + 22, 14 + gate * 6, ['y1', 'y2', 'y3', 'w'])
    if f >= 3:
        u = min(1, (f - 3) / 4)
        y = lerp(top + 20, 92, ease(u))
        c.line([(cx, top + 20), (cx, y)], 'y1', 5)
        c.line([(cx, top + 20), (cx, y)], 'y2', 3)
        c.line([(cx, top + 20), (cx, y)], 'y3', 1)
        c.poly([(cx, y + 22), (cx - 11, y), (cx + 11, y)], 'y2')
        c.poly([(cx, y + 18), (cx - 6, y + 1), (cx + 6, y + 1)], 'y3')
        c.line([(cx, y + 19), (cx, y + 3)], 'w')
    if f >= 7:
        u = (f - 7) / 4
        c.shockring(cx, 100, 14 + u * 60, 'y2', 'y3', 0.32, 3)
        c.burst(cx, 96, max(6, 30 - u * 22), ['y1', 'y2', 'y3', 'w'], rays=12, long=2.0 - u * 0.6)
    if f >= 5:
        for sd in (-1, 1):
            c.wing(cx + sd * 40, 46, sd, 16, ['b1', 'b2', 'b3', 'w'], flap=math.sin(f + sd) * 0.4, feathers=5)


@effect('valkyrie_valhalla_hit', 64, 10, 'allTargets', WING)
def _(c, f):
    if f < 7:
        w = 6 + min(1, f / 2) * 10 - (f > 4) * (f - 4) * 3
        c.rect(CX - w, 0, CX + w, 56, 'y1')
        c.rect(CX - w * 0.65, 0, CX + w * 0.65, 56, 'y2')
        c.rect(CX - w * 0.3, 0, CX + w * 0.3, 56, 'y3')
        c.rect(CX - w * 0.12, 0, CX + w * 0.12, 56, 'w')
    if f >= 1:
        u = min(1, (f - 1) / 6)
        c.shockring(CX, 56, 6 + u * 26, 'y2', 'y3', 0.4, 3)
        c.burst(CX, CY, max(4, 16 - u * 12), ['y1', 'y2', 'y3', 'w'], rays=10, long=1.8)
    r = rng(8)
    for i in range(14):
        x = CX + r.uniform(-22, 22)
        y = 54 - ((f * 6 + i * 7) % 50)
        c.px(x, y, ['y3', 'w', 'b3'][i % 3])
    if f >= 6:
        c.petal(CX - 12, 20 + (f - 6) * 4, 2.2, 8, 'w', 'b3', edge='y1')
        c.petal(CX + 12, 26 + (f - 6) * 4, 0.7, 8, 'b4', 'b3', edge='y1')
