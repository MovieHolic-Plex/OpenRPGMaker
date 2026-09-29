"""암흑기사(class_dark_knight, 칩 actor1-4): 검은 투구·망토, 체력을 깎아 암흑검. 색: 흑자(어둠) + 자수정 + 핏빛 붉은색 포인트."""
import math

from lib_r2w1 import *

SKILLS = Skills('dark_knight', 'class_dark_knight', 'actor1-4')
SKILLS.add('dark_slash', '암흑 베기', 1, 'dash-strike', '검은 초승달 궤적으로 두 번 베어 낸다', 'dark_knight_slash') \
    .add('blood_price', '피의 대가', 3, 'buff', '체력을 대가로 피의 오라를 두르고 공격력을 올린다', 'dark_knight_blood') \
    .add('abyss_wave', '심연의 파도', 5, 'shoot', '검은 검기를 파도처럼 날려 보낸다', 'dark_knight_wave', 'dark_knight_wave_hit') \
    .add('dark_flame', '암흑 화염', 7, 'buff', '몸에서 검은 불꽃이 솟구쳐 눈을 뜬다', 'dark_knight_flame') \
    .add('soul_eater', '소울 이터', 10, 'blink-strike', '적을 꿰뚫어 영혼을 뽑아 흡수한다', 'dark_knight_soul') \
    .add('gravity', '그래비티', 12, 'cast', '검은 구체가 적 모두를 짓눌러 땅이 함몰된다', 'dark_knight_gravity') \
    .add('dread_chain', '공포의 사슬', 16, 'spin', '가시 사슬을 휘둘러 적진을 휘감는다', 'dark_knight_chain') \
    .add('doom_blade', '종언의 검', 22, 'finisher', '붉은 달 아래 거대한 흑검이 세상을 가르는 필살기', 'dark_knight_doom_sky', 'dark_knight_doom_hit')

DK = pal(pick(VIO, 'v0', 'v1', 'v2', 'v3', 'v4'), pick(CRIM, 'r1', 'r2', 'r3'), pick(STEEL, 's1', 's2'), WHITE)
DK_R = pal(pick(VIO, 'v0', 'v1', 'v2', 'v3', 'v4'), pick(CRIM, 'r0', 'r1', 'r2', 'r3'), WHITE)
CX, CY = 32, 34


def T(f, n):
    return f / (n - 1)


def dark_flame(c, x, y, h, w, lean, keys):
    for i, k in enumerate(keys):
        s = 1 - i * 0.27
        c.poly([(x - w * s, y), (x + w * s, y), (x + lean * s, y - h * s)], k)
        c.disc(x, y - 1, w * s, k)


# --------------------------------------------------------------------------- 1 암흑 베기
@effect('dark_knight_slash', 64, 8, 'target', DK)
def _(c, f):
    keys = ['v0', 'v1', 'v2', 'v3', 'v4']
    if f == 0:
        c.glow(50, 8, 6, ['v1', 'v3', 'v4'])
    if f in (1, 2):
        c.blade((56, 4), (6, 54), -18, 16 - (f - 1) * 3, keys, frac=0.7 if f == 1 else 1.0)
    if f == 2:
        c.spark(8, 54, 5, 'w', 'v3', diag=True)
    if f in (3, 4):
        c.blade((8, 6), (58, 52), 18, 16 - (f - 3) * 3, keys, frac=0.7 if f == 3 else 1.0)
        c.blade((56, 4), (6, 54), -18, 5, ['v1', 'v3'])
    if f >= 4:
        u = (f - 4) / 3
        c.burst(CX, CY, max(3, 10 - u * 7), ['v1', 'v2', 'v3', 'v4', 'w'], rays=8, rot=0.4, long=1.8)
        r = rng(5)
        for i in range(10):
            a = r.uniform(0, math.tau)
            d = (2 + u * 24) * r.uniform(0.6, 1.2)
            x, y = CX + math.cos(a) * d, CY + math.sin(a) * d
            c.poly([(x, y - 2), (x + 1.5, y), (x, y + 2), (x - 1.5, y)], 'v2' if i % 2 else 'r2')
    if f >= 6:
        c.ring(CX, CY, 8 + (f - 6) * 8, 'v2', 1)


# --------------------------------------------------------------------------- 2 피의 대가
@effect('dark_knight_blood', 64, 10, 'user', DK_R)
def _(c, f):
    t = T(f, 10)
    # 몸 둘레에서 솟는 핏빛 불길 + 위에서 떨어지는 핏방울, 발밑 붉은 마법진.
    c.shockring(CX, 52, 20 + math.sin(t * 6) * 2, 'r2', 'r3', 0.32, 2)
    c.rune_ring(CX, 52, 14, 'r1', 'r3', n=6, rot=t * 4, squash=0.32)
    for i, dx in enumerate((-14, -8, -2, 5, 11, 16)):
        hh = 26 + math.sin(t * 8 + i * 1.7) * 8 + min(f, 4) * 3
        dark_flame(c, CX + dx, 50, hh, 4, math.sin(t * 6 + i) * 3, ['r0', 'r1', 'r2', 'r3'])
    for i in range(6):
        x = CX - 16 + i * 6.4
        y = 6 + ((f * 6 + i * 9) % 30)
        c.px(x, y, 'r3')
        c.px(x, y + 1, 'r2')
        c.px(x, y + 2, 'r1')
    if f in (1, 2):
        # 검을 손에 그어 피를 내는 번쩍임.
        c.lens((CX - 18, 36), (CX - 6, 30), 4, ['r1', 'r3', 'w'])
    if f >= 5:
        c.dring(CX, 30, 22 + (f - 5), 'v2', squash=1.25, parity=f % 2)
    for i in range(6):
        c.px(CX - 18 + i * 7, 50 - ((f * 5 + i * 8) % 44), ['r3', 'v3'][i % 2])


# --------------------------------------------------------------------------- 3 심연의 파도
@effect('dark_knight_wave', 32, 4, 'projectile', DK)
def _(c, f):
    # 머리(왼쪽)가 뾰족한 검은 초승달 검기, 뒤로 자줏빛 잔상 세 줄.
    ph = [0, 1, 0, -1][f]
    c.lens((8, 16), (31, 16 + ph), 5, ['v0', 'v1', 'v2'])
    c.blade((10, 2), (10, 30), 9, 10, ['v0', 'v1', 'v2', 'v3', 'w'])
    c.blade((10, 2), (10, 30), 9, 4, ['v2', 'v4'])
    for i in range(3):
        c.px(18 + ((f * 4 + i * 5) % 12), 8 + i * 8, 'v3')
    c.px(4, 16, 'w')


@effect('dark_knight_wave_hit', 64, 8, 'target', DK)
def _(c, f):
    u = min(1.0, f / 6)
    # 땅에서 솟는 검은 창날 다섯 개 + 자줏빛 충격 고리.
    for i, dx in enumerate((-16, -8, 0, 8, 16)):
        hh = (36 - abs(dx) * 0.9) * ease(min(1, (f + 0.5 - i * 0.2) / 3)) * (1 - max(0, f - 4) * 0.25)
        if hh < 3:
            continue
        x = CX + dx
        c.poly([(x, 50 - hh), (x + 5, 50), (x - 5, 50)], 'v1')
        c.poly([(x, 50 - hh), (x + 2, 50), (x - 4, 50)], 'v2')
        c.line([(x - 1, 50 - hh + 3), (x - 1, 48)], 'v4')
    c.shockring(CX, 52, 6 + u * 26, 'v3', 'w', 0.42, 2)
    if f <= 3:
        c.burst(CX, 44, 9 - f * 2, ['v1', 'v2', 'v3', 'v4', 'w'], rays=8, long=1.6)
    r = rng(2)
    for i in range(8):
        c.px(CX + r.uniform(-22, 22), 50 - ((f * 6 + i * 8) % 40), 'v3' if i % 2 else 'r2')


# --------------------------------------------------------------------------- 4 암흑 화염
@effect('dark_knight_flame', 64, 10, 'user', DK_R)
def _(c, f):
    t = T(f, 10)
    for i, (dx, hh, w) in enumerate(((-15, 24, 4), (-9, 34, 5), (-3, 40, 6), (4, 38, 6), (10, 30, 5), (16, 22, 4))):
        hh2 = hh * (0.6 + 0.4 * math.sin(t * 9 + i * 1.3)) * min(1.0, 0.4 + f / 4)
        dark_flame(c, CX + dx, 52, hh2, w, math.sin(t * 7 + i) * 4, ['v1', 'v2', 'v3', 'v4'])
    # 불꽃 속 두 눈이 뜬다.
    if f >= 3:
        op = min(1, (f - 3) / 2)
        ey = 26
        for sd in (-1, 1):
            x = CX + sd * 8
            c.poly([(x - 6, ey + 2), (x, ey - 4 * op), (x + 6, ey + 2), (x, ey + 4)], 'v0')
            c.poly([(x - 5, ey + 2), (x, ey - 3 * op), (x + 5, ey + 2), (x, ey + 3)], 'r3')
            c.disc(x, ey + 1, 2, 'w')
    c.ring(CX, 30, 21, 'v1', 1, 1.3)
    c.dring(CX, 30, 23, 'v2', squash=1.3, parity=f % 2)
    r = rng(3)
    for i in range(8):
        x = CX + r.uniform(-20, 20)
        y = 48 - ((f * 6 + i * 9) % 44)
        c.px(x, y, ['v3', 'r2', 'v2'][i % 3])


# --------------------------------------------------------------------------- 5 소울 이터
@effect('dark_knight_soul', 64, 10, 'target', DK)
def _(c, f):
    if f <= 3:
        u = [0.2, 0.55, 0.9, 1.0][f]
        x = lerp(64, 30, u)
        c.lens((min(66, x + 40), CY), (x, CY), 6, ['v0', 'v1', 'v2'])
        c.sword(x, CY, math.pi, 44, blade='v3', hi='w', guard='r2', bw=3, edge='v0')
    if f >= 3:
        u = (f - 3) / 6
        c.burst(30, CY, max(4, 12 - u * 8), ['v1', 'v2', 'v3', 'w'], rays=8, long=1.6)
    # 영혼: 꼬리 달린 흰 방울이 적에게서 뽑혀 오른쪽 위(시전자)로 흘러간다.
    for i in range(4):
        s0 = 3 + i * 0.9
        u = (f - s0) / 4
        if u < 0 or u > 1:
            continue
        x = lerp(28 + i * 4, 62, u)
        y = lerp(CY, 6 + i * 3, ease(u)) - math.sin(u * math.pi) * 8
        for j in range(5):
            uu = max(0, u - j * 0.05)
            xx = lerp(28 + i * 4, 62, uu)
            yy = lerp(CY, 6 + i * 3, ease(uu)) - math.sin(uu * math.pi) * 8
            c.disc(xx, yy, 3 - j * 0.5, 'v2' if j > 1 else 'v3')
        c.disc(x, y, 3, 'w')
        c.px(x - 1, y - 1, 'v4')
        c.px(x - 1, y, 'v0')
        c.px(x + 1, y, 'v0')
    if f >= 6:
        c.dring(CX, CY, 8 + (f - 6) * 5, 'v2')


# --------------------------------------------------------------------------- 6 그래비티
@effect('dark_knight_gravity', 64, 10, 'allTargets', DK)
def _(c, f):
    t = T(f, 10)
    g = ease(min(1, t * 2))
    # 위에서 내려앉는 검은 구체와 바닥으로 눌리는 균열/함몰.
    y = lerp(-6, 30, g)
    r = 9 + g * 3
    c.disc(CX, y, r, 'v0')
    c.disc(CX, y, r - 2, 'v1')
    c.disc(CX - 2, y - 2, r - 5, 'v2')
    c.ring(CX, y, r + 2, 'v3', 1)
    c.ring(CX, y, r + 5 + (f % 3), 'v2', 1)
    if f >= 3:
        for i in range(4):
            a = math.tau * i / 4 + t
            c.line([pol(CX, y, r + 2, a), pol(CX, y, r + 12 + f, a + 0.6)], 'v3')
    # 바닥 함몰: 어두운 타원 + 갈라진 선.
    k = min(1, max(0, (f - 2) / 4))
    if k > 0:
        c.oval(CX, 52, 26 * k, 8 * k, 'v0')
        c.oval(CX, 52, 20 * k, 6 * k, 'v1')
        c.ring(CX, 52, 26 * k, 'v3', 1, 0.3)
        for i in range(6):
            a = math.tau * i / 6 + 0.3
            c.line([pol(CX, 52, 5, a, 0.3), pol(CX, 52, 24 * k, a, 0.3)], 'v2')
    if f >= 6:
        u = (f - 6) / 3
        c.dring(CX, 40, 10 + u * 20, 'v3', squash=0.6)
    # 빨려드는 입자
    r2 = rng(6)
    for i in range(10):
        a = r2.uniform(0, math.tau)
        d = (30 - f * 2.5) * r2.uniform(0.5, 1.0)
        c.px(CX + math.cos(a) * d, 40 + math.sin(a) * d * 0.7, 'v4' if i % 2 else 'r2')


# --------------------------------------------------------------------------- 7 공포의 사슬
def chain_arc(c, cx, cy, R, a0, a1, links, key, key2, sq):
    prev = None
    for i in range(links):
        a = math.radians(lerp(a0, a1, i / max(1, links - 1)))
        x, y = cx + math.cos(a) * R, cy + math.sin(a) * R * sq
        c.oval(x, y, 2.6, 1.8 if i % 2 else 2.6, key, 1)
        c.px(x, y, key2)
        prev = (x, y)


@effect('dark_knight_chain', 64, 10, 'allTargets', DK)
def _(c, f):
    t = T(f, 10)
    rot = t * 360 * 1.5
    grow = min(1.0, (f + 1) / 3)
    for k in range(2):
        base = rot + k * 180
        R = 21 * grow
        chain_arc(c, CX, CY + 4, R, base - 150, base, 13, 'v3', 'v1', 0.55)
        # 사슬 끝의 가시 추
        a = math.radians(base)
        x, y = CX + math.cos(a) * R, CY + 4 + math.sin(a) * R * 0.55
        c.disc(x, y, 4, 'v1')
        c.disc(x, y, 3, 'v2')
        for j in range(6):
            aj = a + j * math.pi / 3
            c.line([(x, y), (x + math.cos(aj) * 6, y + math.sin(aj) * 6)], 'v4')
        c.px(x, y, 'r3')
    if f >= 3:
        c.dring(CX, CY + 4, 27, 'v2', squash=0.55)
        c.shockring(CX, CY + 6, 14 + (f % 4) * 3, 'v1', None, 0.5, 1)
    if f >= 7:
        c.disc(CX, CY - 2, 7, 'v0')
        c.disc(CX, CY - 2, 5, 'v1')
        c.spark(CX, CY - 2, 4, 'w', 'r3')
    r = rng(9)
    for i in range(8):
        a = r.uniform(0, math.tau)
        c.px(CX + math.cos(a) * 26, CY + 4 + math.sin(a) * 15 - f, 'v4' if i % 2 else 'r2')


# --------------------------------------------------------------------------- 8 종언의 검
@effect('dark_knight_doom_sky', 128, 12, 'screen', DK_R)
def _(c, f):
    t = T(f, 12)
    cx = 64
    g = ease(min(1, t * 2.4))
    # 붉은 달 + 갈라지는 자줏빛 하늘.
    c.glow(cx, 34, 26 + g * 6, ['v0', 'v1', 'r1', 'r2'])
    c.disc(cx, 34, 16 * g, 'r1')
    c.disc(cx, 34, 14 * g, 'r2')
    c.disc(cx - 3, 31, 8 * g, 'r3')
    c.disc(cx + 5, 39, 4 * g, 'r1')
    for i in range(10):
        a = math.tau * i / 10 + t * 0.6
        c.lens(pol(cx, 34, 20, a), pol(cx, 34, 40 + g * 20, a), 4, ['v0', 'v1', 'v2'])
    if f >= 3:
        u = min(1, (f - 3) / 4)
        y = lerp(0, 88, ease(u))
        # 거대한 흑검: 자줏빛 날 + 붉은 홈 + 십자 가드.
        c.poly([(cx, y + 34), (cx - 10, y), (cx + 10, y)], 'v2')
        c.poly([(cx, y + 30), (cx - 6, y + 1), (cx + 6, y + 1)], 'v3')
        c.rect(cx - 10, y - 44, cx + 10, y, 'v1')
        c.rect(cx - 6, y - 44, cx + 6, y, 'v2')
        c.rect(cx - 2, y - 44, cx + 2, y + 28, 'r2')
        c.line([(cx, y - 44), (cx, y + 30)], 'r3')
        c.rect(cx - 20, y - 50, cx + 20, y - 44, 'v0')
        c.rect(cx - 20, y - 50, cx + 20, y - 48, 'v3')
        c.rect(cx - 4, y - 72, cx + 4, y - 50, 'v1')
        c.disc(cx, y - 76, 6, 'r2')
        c.disc(cx, y - 76, 3, 'r3')
    if f >= 7:
        u = (f - 7) / 4
        c.shockring(cx, 100, 14 + u * 60, 'r2', 'v3', 0.32, 3)
        c.burst(cx, 96, max(8, 34 - u * 26), ['v1', 'r2', 'v3', 'w'], rays=12, long=2.0 - u * 0.7)
        c.lens((cx - 60, 96), (cx + 60, 96), 6 * (1 - u) + 1, ['v1', 'r2', 'w'])
    r = rng(8)
    for i in range(14):
        c.px(cx + r.uniform(-58, 58), 6 + ((f * 9 + i * 13) % 100), ['v3', 'r3', 'w'][i % 3])


@effect('dark_knight_doom_hit', 64, 10, 'allTargets', DK_R)
def _(c, f):
    u = min(1.0, f / 6)
    if f < 7:
        w = 5 + min(1, f / 2) * 8 - max(0, f - 4) * 3
        for k, key in enumerate(['v1', 'v2', 'r2', 'r3']):
            c.rect(CX - w * (1 - k * 0.24), 0, CX + w * (1 - k * 0.24), 56, key)
    c.lens((CX - 30, CY + 6), (CX + 30, CY - 6), 8 - u * 5, ['v1', 'r2', 'w']) if f >= 1 else None
    c.burst(CX, CY, max(4, 14 - u * 10), ['v1', 'v3', 'r3', 'w'], rays=10, long=1.8)
    c.shockring(CX, 56, 6 + u * 26, 'r2', 'v3', 0.4, 3)
    r = rng(4)
    for i in range(12):
        c.px(CX + r.uniform(-22, 22), 54 - ((f * 6 + i * 7) % 50), ['v3', 'r3', 'w'][i % 3])
