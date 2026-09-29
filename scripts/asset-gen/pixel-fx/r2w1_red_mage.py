"""적마도사(class_red_mage, 칩 actor1-3): 검과 마법을 번갈아 쓰는 붉은 옷 마검사. 색: 진홍(검·불) ↔ 푸른(얼음·번개) 두 가지 마법, 섞이면 보라."""
import math

from lib_r2w1 import *

SKILLS = Skills('red_mage', 'class_red_mage', 'actor1-3')
SKILLS.add('riposte', '리포스트', 1, 'dash-strike', '가는 검끝으로 급소를 세 번 꿰뚫는다', 'red_mage_riposte') \
    .add('flare_blade', '플레어 블레이드', 3, 'blink-strike', '불꽃을 두른 레이피어로 대각선으로 벤다', 'red_mage_flare_blade') \
    .add('frost_orb', '프로스트 오브', 5, 'cast', '푸른 얼음 구슬을 쏘아 가시 결정으로 터뜨린다', 'red_mage_frost_orb', 'red_mage_frost_hit') \
    .add('double_cast', '이중 영창', 7, 'buff', '붉고 푸른 마법진 두 개가 겹쳐 돌며 마력을 높인다', 'red_mage_double_cast') \
    .add('fleche', '플레슈', 10, 'flurry', '화살처럼 파고들며 다섯 갈래로 찌른다', 'red_mage_fleche') \
    .add('twin_bolt', '쌍색 번개', 12, 'cast', '붉은 번개와 푸른 번개가 엮여 적 모두를 친다', 'red_mage_twin_bolt') \
    .add('convert', '마력 전환', 16, 'buff', '붉은 구슬과 푸른 구슬이 서로를 돌며 마력이 순환한다', 'red_mage_convert') \
    .add('catastrophe', '듀얼 카타스트로프', 22, 'finisher', '붉은 혜성과 푸른 혜성이 부딪쳐 터지는 필살기', 'red_mage_catastrophe_sky', 'red_mage_catastrophe_hit')

RED = pal(pick(CRIM, 'r0', 'r1', 'r2', 'r3', 'r4'), pick(STEEL, 's1', 's2', 's3'), WHITE)
FIRE = pal(pick(CRIM, 'r0', 'r1'), pick(FIREC, 'f2', 'f3', 'f4'), pick(STEEL, 's2', 's3'), WHITE)
ICE = pal(pick(SKY, 'b0', 'b1', 'b2', 'b3', 'b4'), pick(TEAL, 'c3', 'c4'), WHITE)
MIX = pal(pick(CRIM, 'r0', 'r1', 'r2', 'r3'), pick(SKY, 'b0', 'b1', 'b2', 'b3'), pick(VIO, 'v2', 'v3', 'v4'), WHITE)
CX, CY = 32, 34


def T(f, n):
    return f / (n - 1)


# --------------------------------------------------------------------------- 1 리포스트
@effect('red_mage_riposte', 64, 8, 'target', RED)
def _(c, f):
    # 가는 찌르기 세 번: 각각 다른 높이·각도에서 한 점(급소)으로 들어간다.
    stabs = [((60, 18), (34, 30)), ((62, 44), (32, 36)), ((58, 30), (30, 33))]
    for i, (a, b) in enumerate(stabs):
        s0 = i * 2
        if f == s0:
            c.lens(a, b, 5, ['r1', 'r2', 's3'], frac=0.7)
        elif f == s0 + 1:
            c.lens(a, b, 5, ['r1', 'r2', 's3'])
            c.spark(b[0], b[1], 5, 'w', 'r3', diag=True)
            c.diamond(b[0], b[1], 4, 4, 'r2')
        elif f == s0 + 2:
            c.lens(a, b, 2, ['r2', 'r4'])
    if f >= 3:
        r = rng(2)
        for i in range(9):
            a = r.uniform(0, math.tau)
            d = (f - 2) * 4 * r.uniform(0.5, 1.2)
            x, y = 32 + math.cos(a) * d, 33 + math.sin(a) * d
            c.diamond(x, y, 1.5, 2, 'r3' if i % 2 else 'w')
    if f >= 5:
        u = (f - 5) / 2
        c.ring(32, 33, 8 + u * 14, 'r2', 1)
        c.dring(32, 33, 10 + u * 16, 'r1')
    if f == 0:
        c.glow(56, 30, 5, ['r2', 'r4', 'w'])


# --------------------------------------------------------------------------- 2 플레어 블레이드
def flame_tongue(c, x, y, h, w, lean, keys):
    for i, k in enumerate(keys):
        s = 1 - i * 0.25
        c.poly([(x - w * s, y), (x + w * s, y), (x + lean * s, y - h * s)], k)
        c.disc(x, y - 1, w * s, k)


@effect('red_mage_flare_blade', 64, 9, 'target', FIRE)
def _(c, f):
    if f == 0:
        c.glow(58, 6, 6, ['f2', 'f3', 'w'])
    if 1 <= f <= 3:
        u = (f - 0.5) / 3
        x0, y0 = 58, 4
        x1, y1 = 8, 56
        x, y = lerp(x0, x1, u), lerp(y0, y1, u)
        c.blade((58, 4), (x, y), -8, 9, ['r1', 'f2', 'f3', 'w'], frac=1.0)
        c.sword(x, y, math.radians(135), 26, blade='s2', hi='w', guard='f3', bw=3, edge='r0')
        for k in range(3):
            flame_tongue(c, x + 10 + k * 5, y - 8 - k * 6, 12 - k * 2, 3, 2, ['r1', 'f2', 'f3'])
    if f >= 3:
        u = (f - 3) / 5
        c.burst(CX, CY, max(4, 13 - u * 9), ['r1', 'f2', 'f3', 'f4', 'w'], rays=10, rot=0.3, long=1.8)
        for k, (dx, dh) in enumerate(((-13, 18), (-6, 26), (0, 30), (7, 24), (14, 16))):
            hh = dh * (1 - u * 0.6)
            flame_tongue(c, CX + dx, 50, hh, 4 - u * 2, dx * 0.1, ['r1', 'f2', 'f3', 'f4'])
        c.shockring(CX, 52, 8 + u * 24, 'f2', 'f3', 0.42, 2)
    r = rng(7)
    for i in range(8):
        c.px(CX + r.uniform(-20, 20), 46 - ((f * 5 + i * 8) % 40), 'f4' if i % 2 else 'f3')


# --------------------------------------------------------------------------- 3 프로스트 오브
@effect('red_mage_frost_orb', 32, 4, 'projectile', ICE)
def _(c, f):
    c.lens((12, 16), (31, 16), 5, ['b1', 'b2', 'b3'])
    c.disc(9, 16, 7, 'b0')
    c.disc(9, 16, 6, 'b1')
    c.disc(9, 16, 5, 'b2')
    c.disc(8, 15, 3, 'b3')
    c.px(7, 14, 'w')
    for i in range(5):
        a = math.radians(f * 22 + i * 72)
        x, y = pol(9, 16, 8, a)
        c.diamond(x, y, 1.5, 2.5, 'c4' if i % 2 else 'b4')
    c.px(20 + (f * 3) % 8, 12, 'w')
    c.px(24 + (f * 5) % 6, 20, 'b4')


@effect('red_mage_frost_hit', 64, 8, 'target', ICE)
def _(c, f):
    u = min(1.0, f / 5)
    if f <= 1:
        c.burst(CX, CY, 12 - f * 3, ['b1', 'b2', 'b3', 'b4', 'w'], rays=8, long=1.6)
    # 얼음 가시 결정: 가운데에서 방사형으로 솟는 뾰족 마름모.
    for i, (ang, ln) in enumerate(((-90, 26), (-55, 20), (-125, 20), (-20, 14), (-160, 14), (-72, 15), (-108, 15))):
        L = ln * ease(min(1.0, (f - 1) / 3)) if f >= 1 else 0
        if L < 2:
            continue
        a = math.radians(ang)
        tip = pol(CX, 46, L, a)
        b1p, b2p = pol(CX, 46, L * 0.35, a + 0.28), pol(CX, 46, L * 0.35, a - 0.28)
        c.poly([tip, b1p, (CX, 46), b2p], 'b2')
        c.poly([tip, pol(CX, 46, L * 0.35, a + 0.28), (CX, 46)], 'b3')
        c.line([tip, (CX, 46)], 'b4')
    if f >= 2:
        c.shockring(CX, 50, 6 + f * 3.2, 'b3', 'w', 0.42, 2)
    if f >= 4:
        r = rng(3)
        for i in range(12):
            a = r.uniform(0, math.tau)
            d = (f - 3) * 5 * r.uniform(0.6, 1.2)
            c.diamond(CX + math.cos(a) * d, 36 + math.sin(a) * d, 1, 2, 'w' if i % 2 else 'c4')
    if f >= 6:
        c.dring(CX, 42, 22 + (f - 6) * 3, 'b2')


# --------------------------------------------------------------------------- 4 이중 영창
def circle_pair(c, cx, cy, r, rot, key_ring, key_glyph, sq, n=8, w=2):
    c.rune_ring(cx, cy, r, key_ring, key_glyph, n=n, rot=rot, squash=sq, w=w)
    pts = [pol(cx, cy, r * 0.78, rot + i * 2 * math.pi / 5 * 2, sq) for i in range(5)]
    c.line(pts + [pts[0]], key_glyph, 1)


@effect('red_mage_double_cast', 64, 10, 'user', MIX)
def _(c, f):
    t = T(f, 10)
    g = ease(min(1, t * 2.2))
    circle_pair(c, CX, 50, 24 * g, t * 3, 'r2', 'r3', 0.32)
    circle_pair(c, CX, 50, 17 * g, -t * 3.6, 'b2', 'b3', 0.32)
    yoff = 12 - t * 6
    circle_pair(c, CX, 10 + yoff * 0.2, 14 * g, -t * 3, 'b2', 'b3', 0.3, n=6, w=1)
    circle_pair(c, CX, 10 + yoff * 0.2, 9 * g, t * 3.2, 'r2', 'r3', 0.3, n=5, w=1)
    # 붉은 기둥과 푸른 기둥이 마주 오른다.
    for k, (dx, key, key2) in enumerate(((-9, 'r1', 'r3'), (9, 'b1', 'b3'))):
        hh = 34 * g
        c.rect(CX + dx - 3, 48 - hh, CX + dx + 3, 48, key)
        c.rect(CX + dx - 1, 48 - hh, CX + dx + 1, 48, key2)
    if f >= 4:
        c.glow(CX, 30, 9, ['v2', 'v3', 'v4', 'w'])
    r = rng(4)
    for i in range(10):
        x = CX + r.uniform(-20, 20)
        y = 52 - ((f * 6 + i * 9) % 46)
        c.px(x, y, ['r3', 'b3', 'w'][i % 3])


# --------------------------------------------------------------------------- 5 플레슈
@effect('red_mage_fleche', 64, 10, 'target', RED)
def _(c, f):
    dirs = [(-160, 0), (-125, 1), (-90, 2), (-55, 3), (-20, 4)]
    if f == 0:
        for ang, i in dirs:
            a = math.radians(ang)
            c.glow(*pol(CX, CY + 2, 22, a), 3, ['r2', 'r4', 'w'])
        c.spark(CX, CY + 2, 4, 'w', 'r3')
    for ang, i in dirs:
        s0 = 1 + i * 1.5
        u = (f - s0) / 2.2
        if u < 0 or u > 2.0:
            continue
        a = math.radians(ang)
        L = 34 * ease(min(1, u))
        fade = 0 if u < 1.2 else 1
        p0 = pol(CX, CY + 2, 8, a + math.pi)
        p1 = pol(CX, CY + 2, L, a)
        c.lens(pol(CX, CY + 2, 3, a), p1, 4 if not fade else 2, ['r1', 'r2', 'r3'] if not fade else ['r2', 'r4'])
        if u < 1.2:
            c.diamond(p1[0], p1[1], 3, 4, 'w')
    if f in (2, 4, 6):
        c.burst(CX, CY + 2, 7, ['r1', 'r2', 'r3', 'r4', 'w'], rays=6, rot=f, long=1.6)
    if f >= 7:
        u = (f - 7) / 2
        c.star4(CX, CY + 2, 16 - u * 6, 'r3', 'w')
        c.ring(CX, CY + 2, 12 + u * 14, 'r2', 2)
    if f >= 3:
        r = rng(1)
        for i in range(8):
            a = r.uniform(0, math.tau)
            d = r.uniform(8, 24)
            c.diamond(CX + math.cos(a) * d, CY + math.sin(a) * d, 1, 2, 'r3' if i % 2 else 'w')


# --------------------------------------------------------------------------- 6 쌍색 번개
@effect('red_mage_twin_bolt', 64, 10, 'allTargets', MIX)
def _(c, f):
    t = T(f, 10)
    if 1 <= f <= 6:
        # 붉은/푸른 번개가 서로 감기며 내려온다: 좌우로 어긋나는 두 지그재그.
        for k, (key3, off) in enumerate((('r', -1), ('b', 1))):
            pts = []
            for j in range(9):
                u = j / 8
                y = -2 + u * 46
                x = CX + off * math.sin(u * 9 + t * 5) * 8
                pts.append((x, y))
            if key3 == 'r':
                c.line(pts, 'r1', 5)
                c.line(pts, 'r2', 3)
                c.line(pts, 'r3', 1)
            else:
                c.line(pts, 'b1', 5)
                c.line(pts, 'b2', 3)
                c.line(pts, 'b3', 1)
        c.line([(CX, 0), (CX, 44)], 'v3', 1) if f % 2 else None
    if f >= 2:
        u = (f - 2) / 7
        c.burst(CX, 44, max(4, 12 - u * 8), ['r1', 'r2', 'r3', 'w'], rays=6, rot=0.3, long=1.6) if f % 2 == 0 else c.burst(CX, 44, max(4, 12 - u * 8), ['b1', 'b2', 'b3', 'w'], rays=6, rot=0.6, long=1.6)
        c.shockring(CX, 50, 6 + u * 24, 'v3', 'v4', 0.42, 2)
    if f >= 3:
        c.line([(CX - 16, 30), (CX + 16, 44)], 'r2', 1)
        c.line([(CX + 16, 30), (CX - 16, 44)], 'b2', 1)
    r = rng(2)
    for i in range(10):
        x = CX + r.uniform(-20, 20)
        y = 46 - ((f * 6 + i * 8) % 44)
        c.px(x, y, ['r3', 'b3', 'v4'][i % 3])


# --------------------------------------------------------------------------- 7 마력 전환
@effect('red_mage_convert', 64, 10, 'user', MIX)
def _(c, f):
    t = T(f, 10)
    cx, cy = CX, 30
    R = 16 * (1 - max(0, t - 0.8) * 3)
    # 두 구슬이 서로 원을 그리며 돈다(붉은 = 앞, 푸른 = 반대편). 지나간 자리에 꼬리.
    for k, (main, tail, core, ph) in enumerate((('r2', 'r1', 'r3', 0), ('b2', 'b1', 'b3', math.pi))):
        pts = []
        for j in range(10):
            a = ph + (t - j * 0.04) * math.tau * 1.5
            pts.append(pol(cx, cy, R, a, 1.0))
        c.trail(pts[::-1], [tail, main], 1, 4)
        x, y = pts[0]
        c.disc(x, y, 5, tail)
        c.disc(x, y, 4, main)
        c.disc(x, y, 2, core)
    c.ring(cx, cy, R + 4, 'v2', 1)
    c.dring(cx, cy, R + 7, 'v3', parity=f % 2)
    c.glow(cx, cy, 6 + math.sin(t * 9) * 2, ['v2', 'v3', 'v4'])
    # 위아래로 서로의 색이 흘러 오른다.
    for i in range(6):
        y = 54 - ((f * 5 + i * 8) % 44)
        c.px(cx - 12 + (i % 2) * 24, y, ['r3', 'b3'][i % 2])
        c.px(cx - 12 + (i % 2) * 24, y + 1, ['r2', 'b2'][i % 2])


# --------------------------------------------------------------------------- 8 듀얼 카타스트로프
@effect('red_mage_catastrophe_sky', 128, 12, 'screen', MIX)
def _(c, f):
    t = T(f, 12)
    cx, cy = 64, 62
    u = min(1.0, t * 1.5)
    if f < 8:
        for key, sd in (('r', -1), ('b', 1)):
            k = ['r0', 'r1', 'r2', 'r3'] if key == 'r' else ['b0', 'b1', 'b2', 'b3']
            x = lerp(cx + sd * 44, cx, ease(u))
            y = lerp(14, cy, ease(u))
            pts = [(lerp(cx + sd * 44, cx, max(0, ease(u) - 0.04 * j)), lerp(14, cy, max(0, ease(u) - 0.04 * j))) for j in range(12)]
            c.trail(pts, k[:3], 14, 1)
            c.disc(x, y, 9, k[1])
            c.disc(x, y, 7, k[2])
            c.disc(x, y, 4, k[3])
            c.px(x - 1, y - 1, 'w')
    if f >= 6:
        v = (f - 6) / 5
        R = 10 + v * 50
        c.glow(cx, cy, R, ['v2', 'v3', 'v4', 'w'])
        c.ring(cx, cy, R * 0.95, 'v3', 3)
        c.ring(cx, cy, R * 0.7, 'r3', 2) if f % 2 else c.ring(cx, cy, R * 0.7, 'b3', 2)
        for i in range(12):
            a = math.tau * i / 12 + v
            c.lens(pol(cx, cy, R * 0.5, a), pol(cx, cy, R * 1.25, a), 5, ['r1', 'v2', 'v3'] if i % 2 else ['b1', 'v2', 'v3'])
        c.burst(cx, cy, max(8, 32 - v * 20), ['v2', 'v3', 'v4', 'w'], rays=8, rot=0.4, long=1.5)


@effect('red_mage_catastrophe_hit', 64, 10, 'allTargets', MIX)
def _(c, f):
    u = min(1.0, f / 6)
    # 붉은 X 와 푸른 X 가 엇갈려 교차하는 십자 폭발.
    if f < 8:
        L = 26 * ease(min(1, f / 2.5))
        c.lens((CX - L, CY - L), (CX + L, CY + L), 9 - u * 5, ['r1', 'r2', 'r3', 'w'])
        c.lens((CX + L, CY - L), (CX - L, CY + L), 9 - u * 5, ['b1', 'b2', 'b3', 'w'])
    c.burst(CX, CY, max(4, 15 - u * 10), ['v2', 'v3', 'v4', 'w'], rays=8, rot=0.4, long=1.7)
    c.ring(CX, CY, 6 + u * 24, 'v3', 2)
    c.ring(CX, CY, 4 + u * 20, 'r2' if f % 2 else 'b2', 1)
    r = rng(5)
    for i in range(12):
        a = r.uniform(0, math.tau)
        d = 4 + u * 26 * r.uniform(0.6, 1.2)
        c.px(CX + math.cos(a) * d, CY + math.sin(a) * d, ['r3', 'b3', 'v4'][i % 3])
