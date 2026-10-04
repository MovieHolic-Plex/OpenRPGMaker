"""성기사(class_paladin, 칩 actor1-2): 붉은 갑옷 성기사 — 신성 방어·치유 검. 색: 성스러운 금 + 강철 + 흰빛(방패 면만 푸른색)."""
import math

from lib_r2w1 import *

SKILLS = Skills('paladin', 'class_paladin', 'actor1-2')
SKILLS.add('holy_slash', '성광검', 1, 'dash-strike', '성스러운 빛을 두른 검으로 십자를 그리며 벤다', 'paladin_holy_slash') \
    .add('shield_faith', '신앙의 방패', 3, 'buff', '빛의 방패를 앞세워 방어를 올린다', 'paladin_shield') \
    .add('smite', '사악 강타', 5, 'leap-strike', '하늘에서 빛의 검이 내리꽂혀 악을 벤다', 'paladin_smite') \
    .add('lay_hands', '안수', 7, 'cast', '두 손에서 따스한 빛이 흘러 아군 하나를 치유한다', 'paladin_hands') \
    .add('consecrate', '성역 선포', 10, 'cast', '발밑에 금빛 마법진을 펼쳐 성스러운 기둥을 세운다', 'paladin_consecrate') \
    .add('aegis', '신의 가호', 12, 'buff', '육각 결계가 아군 모두를 감싼다', 'paladin_aegis') \
    .add('halo_whirl', '성검 회전', 16, 'spin', '빛의 검을 휘둘러 적진을 도는 황금 원을 그린다', 'paladin_whirl') \
    .add('excalibur', '엑스칼리버', 22, 'finisher', '갈라진 하늘에서 거대한 성검이 내려오는 필살기', 'paladin_excalibur_sky', 'paladin_excalibur_hit')

P_SLASH = pal(pick(HOLY, 'h0', 'h1', 'h2', 'h3'), pick(STEEL, 's1', 's2', 's3'), pick(GOLD, 'y1', 'y2'), WHITE)
P_SHIELD = pal(pick(HOLY, 'h0', 'h1', 'h2', 'h3'), pick(SKY, 'b0', 'b1', 'b2', 'b3'), pick(STEEL, 's2', 's3'), WHITE)
CX, CY = 32, 34
HL = ['h0', 'h1', 'h2', 'h3', 'w']


def T(f, n):
    return f / (n - 1)


def holy_cross(c, x, y, r, keys, th=3):
    """세로가 긴 성스러운 십자(끝이 뾰족한 두 렌즈)."""
    c.lens((x, y - r * 1.25), (x, y + r * 1.5), th * 2, keys)
    c.lens((x - r * 0.85, y - r * 0.15), (x + r * 0.85, y - r * 0.15), th * 2, keys)


def plus(c, x, y, r, k1, k2):
    c.rect(x - r, y - 1, x + r, y + 1, k1)
    c.rect(x - 1, y - r, x + 1, y + r, k1)
    c.px(x, y, k2)


# --------------------------------------------------------------------------- 1 성광검
@effect('paladin_holy_slash', 64, 8, 'target', P_SLASH)
def _(c, f):
    if f == 0:
        c.glow(CX, 12, 9, ['h1', 'h2', 'h3', 'w'])
        c.line([(CX, 4), (CX, 24)], 'h2', 1)
    if f in (1, 2):
        c.blade((18, 2), (50, 58), -16 if f == 1 else -16, 14, ['h0', 'h1', 'h2', 'w'], frac=0.7 if f == 1 else 1.0)
        c.sword(52 - 16 * (f - 1), 6 + 16 * (f - 1), math.radians(50), 24, blade='s2', hi='w', guard='h1', bw=4, edge='h0') if f == 1 else None
    if f == 2:
        c.spark(50, 58, 6, 'w', 'h2', diag=True)
    if f >= 3:
        u = (f - 3) / 4
        holy_cross(c, CX, CY, 18 - u * 4, ['h1', 'h2', 'h3', 'w'], th=3 - int(u * 2))
        c.burst(CX, CY, max(3, 9 - u * 6), HL, rays=8, rot=0.4, long=1.7)
        c.ring(CX, CY, 8 + u * 22, 'h2', 2)
        c.dring(CX, CY, 12 + u * 22, 'h1')
        r = rng(3)
        for i in range(8):
            x = CX + r.uniform(-20, 20)
            y = CY + r.uniform(-4, 14) - u * 16 * r.uniform(0.5, 1.2)
            c.px(x, y, 'w' if i % 2 else 'h2')
            if i % 3 == 0:
                c.px(x, y - 1, 'h2')


# --------------------------------------------------------------------------- 2 신앙의 방패
def shield_shape(c, x, y, w, h, rim, face, hi, emblem, dark):
    top, bot = y - h / 2, y + h / 2
    pts = [(x - w / 2, top), (x + w / 2, top), (x + w / 2, y + h * 0.05), (x, bot), (x - w / 2, y + h * 0.05)]
    c.poly(pts, dark)
    inner = [(x - w / 2 + 2, top + 2), (x + w / 2 - 2, top + 2), (x + w / 2 - 2, y + h * 0.03), (x, bot - 3), (x - w / 2 + 2, y + h * 0.03)]
    c.poly(inner, rim)
    inner2 = [(x - w / 2 + 4, top + 4), (x + w / 2 - 4, top + 4), (x + w / 2 - 4, y + h * 0.01), (x, bot - 6), (x - w / 2 + 4, y + h * 0.01)]
    c.poly(inner2, face)
    c.line([(x - w / 2 + 4, top + 5), (x - w / 2 + 4, y)], hi)
    if w >= 18:
        c.rect(x - 1, top + 6, x + 1, bot - 9, emblem)
        c.rect(x - w * 0.22, y - h * 0.16, x + w * 0.22, y - h * 0.16 + 2, emblem)


@effect('paladin_shield', 64, 8, 'user', P_SHIELD)
def _(c, f):
    s = [0.35, 0.6, 0.85, 1.0, 1.0, 1.0, 1.0, 1.0][f]
    w, h = 26 * s, 34 * s
    if f >= 2:
        c.glow(CX - 2, 32, 24, ['b1', 'b2', 'b3'], squash=1.1)
    shield_shape(c, CX - 2, 32, w, h, 'h1', 'b2', 'b3', 'h3', 'b0')
    if f >= 3:
        u = (f - 3) / 4
        c.ring(CX - 2, 32, 20 + u * 8, 'h2', 2, 1.15)
        c.ring(CX - 2, 32, 18 + u * 8, 'w', 1, 1.15) if f < 6 else None
        c.spark(CX - 9, 24, 4 - (f > 5), 'w', 'h2', diag=True)
        c.spark(CX + 6, 42, 3, 'w', 'h2')
    r = rng(1)
    for i in range(8):
        a = r.uniform(0, math.tau)
        d = (10 + f * 3) * r.uniform(0.7, 1.2)
        c.px(CX - 2 + math.cos(a) * d, 32 + math.sin(a) * d, 'h3' if i % 2 else 'b3')


# --------------------------------------------------------------------------- 3 사악 강타
@effect('paladin_smite', 64, 9, 'target', P_SLASH)
def _(c, f):
    if f <= 3:
        y = [-16, 2, 20, 30][f]
        c.lens((CX, y - 26), (CX, y + 2), 16, ['h0', 'h1', 'h2'])
        c.sword(CX, y + 26, math.pi / 2, 42, blade='s2', hi='w', guard='h1', grip='h0', bw=9, edge='h0')
        c.glow(CX, y + 24, 8, ['h1', 'h2', 'w'])
    if f >= 4:
        u = (f - 4) / 4
        w = 12 - u * 8
        c.rect(CX - w, 0, CX + w, 54, 'h1')
        c.rect(CX - w * 0.6, 0, CX + w * 0.6, 54, 'h2')
        c.rect(CX - w * 0.25, 0, CX + w * 0.25, 54, 'w')
        c.burst(CX, CY + 6, max(4, 15 - u * 10), HL, rays=10, long=1.8)
        c.shockring(CX, 54, 8 + u * 24, 'h2', 'w', 0.4, 3)
        for i in range(10):
            a = math.pi + i * math.pi / 9
            c.line([pol(CX, 54, 8 + u * 8, a, 0.45), pol(CX, 54, 16 + u * 24, a, 0.45)], 'h3' if i % 2 else 'h2')
        r = rng(4)
        for i in range(8):
            c.px(CX + r.uniform(-18, 18), 50 - u * 30 * r.uniform(0.4, 1.2), 'w' if i % 2 else 'h2')


# --------------------------------------------------------------------------- 4 안수
def hand(c, x, y, side, k1, k2, k3, lift=0.0):
    """아래에서 받쳐 든 손(손바닥 타원 + 손가락 넷이 모인다)."""
    c.oval(x, y, 6, 3, k1)
    c.oval(x, y - 1, 5, 2, k2)
    for i in range(4):
        fx = x + side * (1 + i * 1.8)
        c.line([(fx - side * 3, y - 1), (fx + side * (1 + i * 1.6), y - 7 - lift + i * 0.6)], k1, 2)
        c.line([(fx - side * 3, y - 1), (fx + side * (1 + i * 1.6), y - 7 - lift + i * 0.6)], k2, 1)
    c.px(x, y - 1, k3)


@effect('paladin_hands', 64, 10, 'target', P_SLASH)
def _(c, f):
    t = T(f, 10)
    r = rng(2)
    c.glow(CX, 38 - t * 4, 8 + min(f, 5) * 3, ['h0', 'h1', 'h2'], squash=1.0) if f >= 1 else None
    if f >= 1:
        lift = min(1.0, f / 4) * 2
        hand(c, CX - 11, 50, -1, 'h1', 'h2', 'w', lift)
        hand(c, CX + 11, 50, 1, 'h1', 'h2', 'w', lift)
    c.ring(CX, 52, 6 + f * 2.6, 'h2', 1, 0.35) if f < 8 else None
    for i in range(5):
        y = 48 - ((f * 5 + i * 11) % 44)
        x = CX + [-14, -6, 4, 12, 0][i] + math.sin(f * 0.7 + i) * 2
        if f >= 2:
            plus(c, x, y, 3 if i % 2 else 2, 'h3', 'w')
    if 3 <= f <= 6:
        holy_cross(c, CX, 20, 9 + f, ['h1', 'h2', 'h3', 'w'], th=2)
    for i in range(10):
        c.px(CX + r.uniform(-18, 18), 50 - ((f * 6 + i * 7) % 46), 'w' if i % 2 else 'h2')
    if f >= 7:
        c.ring(CX, 30, 12 + (f - 7) * 5, 'h1', 1, 1.2)


# --------------------------------------------------------------------------- 5 성역 선포
@effect('paladin_consecrate', 128, 10, 'screen', P_SLASH)
def _(c, f):
    t = T(f, 10)
    cx, cy = 64, 92
    grow = ease(min(1, t * 1.8))
    rx = 58 * grow
    c.oval(cx, cy, rx, rx * 0.32, 'h0')
    c.oval(cx, cy, rx * 0.94, rx * 0.3, 'h1')
    c.oval(cx, cy, rx * 0.86, rx * 0.27, 'h0')
    c.rune_ring(cx, cy, rx * 0.72, 'h2', 'h3', n=10, rot=t * 2, squash=0.32, w=2)
    # 육각별: 겹친 삼각형 두 개를 타원에 눌러 그린다.
    for k in range(2):
        pts = [(cx + math.cos(math.radians(90 * k + i * 120 + t * 90)) * rx * 0.55, cy + math.sin(math.radians(90 * k + i * 120 + t * 90)) * rx * 0.55 * 0.32) for i in range(3)]
        c.line(pts + [pts[0]], 'h3', 1)
    if f >= 2:
        for i in range(5):
            a = math.tau * i / 5 + t
            x, y = cx + math.cos(a) * rx * 0.72, cy + math.sin(a) * rx * 0.72 * 0.32
            u = min(1, (f - 2 + i * 0.3) / 4)
            hgt = 70 * ease(u) * (1 - max(0, f - 7) * 0.2)
            c.rect(x - 4, y - hgt, x + 4, y, 'h1')
            c.rect(x - 2, y - hgt, x + 2, y, 'h2')
            c.rect(x - 1, y - hgt, x, y, 'w')
            c.glow(x, y - hgt, 5, ['h1', 'h2', 'w'])
    if f >= 5:
        holy_cross(c, cx, cy - 26, 15 + (f - 5) * 2, ['h1', 'h2', 'h3', 'w'], th=3)
    r = rng(5)
    for i in range(14):
        c.px(cx + r.uniform(-50, 50), cy - ((f * 7 + i * 13) % 70), 'w' if i % 2 else 'h2')


# --------------------------------------------------------------------------- 6 신의 가호
@effect('paladin_aegis', 64, 10, 'allAllies', P_SHIELD)
def _(c, f):
    t = T(f, 10)
    R = 14 + ease(min(1, t * 2)) * 12
    # 돔: 위도선·경도선 + 육각 칸이 차례로 번쩍인다.
    c.oval(CX, 32, R, R * 1.25, 'b1', 1)
    for lat in (-0.55, 0, 0.55):
        yy = 32 + lat * R * 1.25
        half = R * math.sqrt(max(0.0, 1 - lat * lat))
        c.oval(CX, yy, half, half * 0.28, 'b2', 1)
    for lon in (-0.6, 0, 0.6):
        c.oval(CX, 32, R * abs(math.cos(math.asin(lon))) if lon else R * 0.12, R * 1.25, 'b2', 1)
    for i in range(7):
        a = math.tau * i / 7 + t * math.tau
        x, y = pol(CX, 32, R * 0.78, a, 1.2)
        on = (f + i) % 3 == 0
        c.hexstar(x, y, 4 if on else 2, 'h2' if on else 'b3', rot=a)
    c.ring(CX, 32, R + 1, 'h1', 2, 1.25)
    if f >= 2:
        shield_shape(c, CX, 32, 12, 16, 'h1', 'b2', 'b3', 'h3', 'b0')
    if f in (3, 6, 9):
        c.ring(CX, 32, R + 4, 'w', 1, 1.25)
    for i in range(6):
        c.px(CX + math.cos(i + f) * R * 0.9, 32 + math.sin(i * 2 + f) * R * 1.1, 'w')


# --------------------------------------------------------------------------- 7 성검 회전
@effect('paladin_whirl', 64, 10, 'allTargets', P_SLASH)
def _(c, f):
    t = T(f, 10)
    rot = t * 360 * 1.2
    grow = min(1.0, f / 3)
    for k, keys in enumerate((['h0', 'h1', 'h2', 'w'], ['h0', 'h1', 'h2'], ['h1', 'h2'])):
        base = rot + k * 120
        for w in range(1):
            c.brush(CX, CY + 2, 20 * grow, base - 75, base + 15, 1, 7 - k * 1.5, keys[0], squash=0.55)
            c.brush(CX, CY + 2, 20 * grow, base - 60, base + 15, 1, 5 - k, keys[1], squash=0.55)
            c.brush(CX, CY + 2, 20 * grow, base - 40, base + 15, 1, 3 - k * 0.6, keys[-1], squash=0.55)
    if f >= 2:
        for i in range(3):
            a = math.radians(rot + i * 120 + 15)
            x, y = pol(CX, CY + 2, 20 * grow, a, 0.55)
            c.star4(x, y, 5, 'w')
    if 3 <= f <= 7:
        c.dring(CX, CY + 2, 27, 'h1', squash=0.55)
        holy_cross(c, CX, CY - 4, 7, ['h1', 'h2', 'w'], th=1)
    if f >= 6:
        u = (f - 6) / 3
        c.ring(CX, CY + 2, 20 + u * 12, 'h2', 1, 0.55)
    r = rng(6)
    for i in range(8):
        a = r.uniform(0, math.tau)
        c.px(CX + math.cos(a) * 24, CY + 2 + math.sin(a) * 14 - f, 'w' if i % 2 else 'h2')


# --------------------------------------------------------------------------- 8 엑스칼리버
@effect('paladin_excalibur_sky', 128, 12, 'screen', P_SLASH)
def _(c, f):
    t = T(f, 12)
    cx = 64
    open_ = ease(min(1, t * 2.4))
    # 갈라진 하늘: 양쪽으로 밀려나는 빛의 구름 띠와 방사광.
    for side in (-1, 1):
        for k in range(4):
            yy = 20 + k * 12
            c.oval(cx + side * (26 + open_ * 26 + k * 4), yy, 22 - k * 2, 6, ['h0', 'h1', 'h2', 'h3'][k])
    c.glow(cx, 40, 24 + open_ * 12, ['h0', 'h1', 'h2', 'w'])
    for i in range(12):
        a = math.tau * i / 12 + t * 0.5
        c.lens(pol(cx, 40, 12, a), pol(cx, 40, 30 + open_ * 26, a), 4, ['h0', 'h1', 'h2'])
    if f >= 3:
        u = min(1, (f - 3) / 4)
        y = lerp(30, 92, ease(u))
        # 거대한 성검: 날 폭 12, 십자 날밑, 금 자루.
        c.poly([(cx, y + 30), (cx - 8, y), (cx + 8, y)], 's2')
        c.poly([(cx, y + 26), (cx - 5, y + 1), (cx + 5, y + 1)], 's3')
        c.rect(cx - 8, y - 38, cx + 8, y, 's2')
        c.rect(cx - 5, y - 38, cx + 5, y, 's3')
        c.rect(cx - 1, y - 38, cx + 1, y + 24, 'w')
        c.rect(cx - 16, y - 42, cx + 16, y - 38, 'h1')
        c.rect(cx - 16, y - 42, cx + 16, y - 41, 'h3')
        c.rect(cx - 3, y - 62, cx + 3, y - 42, 'h1')
        c.disc(cx, y - 66, 5, 'h2')
    if f >= 7:
        u = (f - 7) / 4
        c.shockring(cx, 100, 12 + u * 62, 'h2', 'h3', 0.32, 3)
        c.burst(cx, 96, max(8, 34 - u * 26), HL, rays=12, long=2.0 - u * 0.7)
        holy_cross(c, cx, 76, 28 - u * 10, ['h1', 'h2', 'h3', 'w'], th=4)
    r = rng(7)
    for i in range(16):
        c.px(cx + r.uniform(-56, 56), 8 + ((f * 9 + i * 11) % 100), 'w' if i % 2 else 'h2')


@effect('paladin_excalibur_hit', 64, 10, 'allTargets', P_SLASH)
def _(c, f):
    if f < 7:
        w = 5 + min(1, f / 2) * 9 - max(0, f - 4) * 3
        for k, key in enumerate(['h1', 'h2', 'h3', 'w']):
            c.rect(CX - w * (1 - k * 0.27), 0, CX + w * (1 - k * 0.27), 56, key)
    if f >= 1:
        u = min(1, (f - 1) / 6)
        holy_cross(c, CX, CY, 18 - u * 8, ['h1', 'h2', 'h3', 'w'], th=3)
        c.shockring(CX, 56, 6 + u * 26, 'h2', 'h3', 0.4, 3)
        c.burst(CX, CY, max(4, 12 - u * 8), HL, rays=8, rot=0.4, long=1.7)
    r = rng(8)
    for i in range(14):
        c.px(CX + r.uniform(-22, 22), 54 - ((f * 6 + i * 7) % 50), ['h3', 'w', 'h2'][i % 3])
