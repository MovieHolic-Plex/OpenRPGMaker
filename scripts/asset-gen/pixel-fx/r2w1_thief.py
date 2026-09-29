"""도적(class_thief, 칩 actor2-1): 주황 머리 도적, 훔치기·연속 찌르기. 색: 은빛 단검 + 금화 + 독 초록 + 연막 회색."""
import math

from lib_r2w1 import *

SKILLS = Skills('thief', 'class_thief', 'actor2-1')
SKILLS.add('vital_stab', '급소 찌르기', 1, 'dash-strike', '눈 깜짝할 새 급소를 세 번 찌른다', 'thief_stab') \
    .add('steal', '훔치기', 3, 'blink-strike', '스쳐 지나가며 적의 소지품을 낚아챈다', 'thief_steal') \
    .add('poison_dagger', '독 단검', 5, 'shoot', '독을 바른 단검을 던져 중독시킨다', 'thief_poison_knife', 'thief_poison_hit') \
    .add('smoke_bomb', '연막탄', 7, 'cast', '연막을 터뜨려 적의 시야를 가린다', 'thief_smoke') \
    .add('shadow_step', '그림자 걸음', 10, 'buff', '그림자로 녹아들어 회피가 크게 오른다', 'thief_shadow') \
    .add('knife_fan', '단검 부채', 12, 'spin', '몸을 돌리며 단검을 부채꼴로 흩뿌린다', 'thief_fan') \
    .add('ambush', '급습', 16, 'leap-strike', '위에서 덮쳐 쌍단검을 교차해 내리꽂는다', 'thief_ambush') \
    .add('grand_heist', '대도의 손길', 22, 'finisher', '달밤에 무수한 칼자국을 남기고 보물을 쏟아내는 필살기', 'thief_heist_sky', 'thief_heist_hit')

TH = pal(pick(STEEL, 's0', 's1', 's2', 's3'), pick(GOLD, 'y1', 'y2', 'y3'), pick(AMBER, 'm1', 'm2'), WHITE)
TH_P = pal(pick(STEEL, 's1', 's2', 's3'), pick(GREEN, 'g0', 'g1', 'g2', 'g3', 'g4'), pick(SMOKEC, 'q1', 'q2'), WHITE)
TH_S = pal(pick(SMOKEC, 'q0', 'q1', 'q2', 'q3', 'q4'), pick(STEEL, 's2', 's3'), pick(GOLD, 'y1', 'y2', 'y3'), WHITE)
CX, CY = 32, 34


def T(f, n):
    return f / (n - 1)


def dagger(c, x, y, ang, L=16, blade='s2', hi='w', guard='y2', grip='m1', edge='s0', bw=3.0):
    c.sword(x, y, ang, L, blade=blade, hi=hi, guard=guard, grip=grip, bw=bw, edge=edge)


def diag_lines(c, x, y, r, key, rot=0.0):
    for sd in (-1, 1):
        a = rot + sd * math.pi / 4
        c.line([pol(x, y, r, a), pol(x, y, r, a + math.pi)], key)


# --------------------------------------------------------------------------- 1 급소 찌르기
@effect('thief_stab', 64, 8, 'target', TH)
def _(c, f):
    stabs = [((64, 12), (36, 28)), ((66, 46), (34, 38)), ((60, 30), (32, 33))]
    if f == 0:
        c.spark(CX + 2, CY, 4, 'w', 's2', diag=True)
        c.glow(58, 26, 5, ['s1', 's3', 'w'])
    for i, (a, b) in enumerate(stabs):
        s0 = 1 + i * 2
        if f == s0:
            c.lens(a, b, 5, ['s0', 's1', 's2', 'w'], frac=0.75)
            dagger(c, b[0] + 6, b[1] - 2 * (1 - i % 2), math.atan2(b[1] - a[1], b[0] - a[0]) + math.pi, 20)
        elif f == s0 + 1:
            c.lens(a, b, 5, ['s0', 's1', 's2', 'w'])
            c.spark(b[0], b[1], 6, 'w', 'y2', diag=True)
            c.diamond(b[0], b[1], 3, 5, 'y3')
        elif f == s0 + 2 and f < 8:
            c.lens(a, b, 2, ['s1', 'w'])
    if f >= 3:
        r = rng(4)
        for i in range(10):
            a = r.uniform(0, math.tau)
            d = (f - 2) * 3.4 * r.uniform(0.5, 1.2)
            c.diamond(34 + math.cos(a) * d, 33 + math.sin(a) * d, 1, 2, 'y2' if i % 2 else 'w')
    if f == 7:
        c.dring(34, 33, 20, 's2')


# --------------------------------------------------------------------------- 2 훔치기
@effect('thief_steal', 64, 10, 'target', TH)
def _(c, f):
    # 손이 스쳐 지나가며 주머니를 낚아채고, 금화 셋이 호를 그리며 시전자(오른쪽 위)로 날아간다. 놀람 표시(!)가 뜬다.
    if f <= 3:
        x = lerp(64, 22, ease(f / 3))
        c.lens((min(66, x + 34), CY + 4), (x, CY + 4), 6, ['s0', 's1', 's3'])
        # 장갑 낀 손: 손바닥 + 엄지
        c.oval(x, CY + 4, 6, 4, 'm1')
        c.oval(x - 1, CY + 3, 5, 3, 'm2')
        c.line([(x - 4, CY + 2), (x - 9, CY - 1)], 'm2', 2)
        for i in range(3):
            c.line([(x - 2 + i * 2, CY + 1), (x - 4 + i * 2, CY - 3)], 'm1', 1)
    if f >= 3:
        u = (f - 3) / 6
        c.burst(24, CY + 2, max(3, 9 - u * 6), ['y1', 'y2', 'y3', 'w'], rays=8, long=1.6)
    for i in range(3):
        s0 = 3 + i * 0.8
        u = (f - s0) / 4.5
        if u < 0 or u > 1:
            continue
        x = lerp(24 + i * 4, 60, u)
        y = lerp(CY, 8 + i * 4, ease(u)) - math.sin(u * math.pi) * 14
        c.coin(x, y, 5, 'y1', 'y2', 'w', edge_on=abs(math.sin(u * 9)))
        for j in range(1, 4):
            uu = max(0, u - j * 0.06)
            xx = lerp(24 + i * 4, 60, uu)
            yy = lerp(CY, 8 + i * 4, ease(uu)) - math.sin(uu * math.pi) * 14
            c.px(xx, yy, 'y3' if j < 2 else 'y1')
    if 3 <= f <= 7:
        # 놀람 표시: 세로 막대 + 점.
        c.rect(CX - 26, 6, CX - 24, 16, 'y3')
        c.rect(CX - 26, 19, CX - 24, 21, 'y3')
        c.line([(CX - 30, 8), (CX - 28, 12)], 'y2')
        c.line([(CX - 20, 8), (CX - 22, 12)], 'y2')
    if f >= 6:
        c.dring(28, CY, 8 + (f - 6) * 5, 's2')


# --------------------------------------------------------------------------- 3 독 단검
@effect('thief_poison_knife', 32, 4, 'projectile', TH_P)
def _(c, f):
    # 머리(칼끝)가 왼쪽. 회전하며 독 방울이 흩날린다.
    rot = math.radians([0, 12, 0, -12][f])
    c.lens((14, 16), (31, 16), 4, ['g0', 'g1', 'g2'])
    c.sword(3, 16, math.pi + rot, 22, blade='s2', hi='w', guard='g2', grip='g1', bw=3.4, edge='g0')
    c.disc(19, 16, 2, 'g3')
    for i in range(3):
        x = 12 + ((f * 3 + i * 7) % 18)
        c.disc(x, 10 + i * 6, 1.5 if i != 1 else 1, 'g3')
        c.px(x, 10 + i * 6 - 1, 'g4')


@effect('thief_poison_hit', 64, 8, 'target', TH_P)
def _(c, f):
    u = min(1.0, f / 6)
    if f <= 2:
        c.burst(CX, CY, 10 - f * 3, ['g1', 'g2', 'g3', 'g4', 'w'], rays=8, long=1.6)
    # 독 구름: 초록 덩이 셋이 부풀며 방울이 솟는다.
    for i, (dx, dy, r0) in enumerate(((-9, 4, 9), (8, 2, 10), (0, -6, 8))):
        rr = r0 * ease(min(1, (f + 0.5 - i * 0.4) / 4))
        if rr < 2:
            continue
        c.disc(CX + dx, CY + dy, rr, 'g0')
        c.disc(CX + dx - 1, CY + dy - 1, rr - 2, 'g1')
        c.disc(CX + dx - 2, CY + dy - 2, max(1, rr - 5), 'g2')
    for i in range(7):
        y = CY + 10 - ((f * 5 + i * 9) % 40)
        x = CX + math.sin(f * 0.8 + i * 2) * 14
        c.ring(x, y, 2 + (i % 2), 'g3', 1)
        c.px(x - 1, y - 1, 'w')
    if f >= 5:
        for i in range(6):
            a = math.tau * i / 6
            c.px(CX + math.cos(a) * (14 + f), CY - 8 + math.sin(a) * 10 + (f - 4) * 3, 'g3')


# --------------------------------------------------------------------------- 4 연막탄
@effect('thief_smoke', 64, 10, 'allTargets', TH_S)
def _(c, f):
    t = T(f, 10)
    if f == 0:
        c.disc(CX, 20, 3, 'q2')
        c.spark(CX, 20, 4, 'w', 'y3')
    else:
        g = ease(min(1, f / 5))
        fade = 1 - max(0, f - 6) * 0.22
        R = 22 * g * (0.8 + 0.2 * fade)
        c.cloud(CX, 36, R, ['q1', 'q2', 'q3', 'q4'], seed=3, lobes=9, parity=f % 2)
        c.cloud(CX - 12 * g, 42, R * 0.6, ['q1', 'q2', 'q3', 'q4'], seed=5, lobes=7, parity=(f + 1) % 2)
        c.cloud(CX + 13 * g, 40, R * 0.55, ['q1', 'q2', 'q3', 'q4'], seed=8, lobes=7, parity=f % 2)
        c.cloud(CX, 24, R * 0.5, ['q1', 'q2', 'q3', 'q4'], seed=11, lobes=6, parity=(f + 1) % 2)
    if 1 <= f <= 3:
        c.burst(CX, 24, 8 - f * 2, ['y1', 'y2', 'y3', 'w'], rays=8, long=1.6)
    r = rng(2)
    for i in range(8):
        a = r.uniform(0, math.tau)
        d = 14 + f * 2.4 * r.uniform(0.6, 1.2)
        c.px(CX + math.cos(a) * d, 34 + math.sin(a) * d * 0.7, 'q4' if i % 2 else 'q3')


# --------------------------------------------------------------------------- 5 그림자 걸음
@effect('thief_shadow', 64, 10, 'user', TH_S)
def _(c, f):
    t = T(f, 10)
    # 몸이 있던 자리에 어두운 실루엣이 남고(뒤로 갈수록 옅게 디더) 발밑에 그림자 웅덩이가 번진다.
    def silhouette(x, key, parity, sq=1.0):
        c.ddisc(x, 20, 6, key, parity=parity)
        c.poly([(x - 7, 26), (x + 7, 26), (x + 5, 50), (x - 5, 50)], key) if parity < 0 else None
        for yy in range(26, 51):
            for xx in range(int(x - 6 + (yy - 26) * 0.1), int(x + 7 - (yy - 26) * 0.1)):
                if (xx + yy + parity) % 2 == 0:
                    c.px(xx, yy, key)
    for k in range(4):
        x = CX + 12 - (f * 5 + k * 12) % 44 + 6
        silhouette(x, ['q1', 'q2', 'q3', 'q2'][k], k % 2)
    g = ease(min(1, t * 2))
    c.oval(CX, 52, 24 * g, 6 * g, 'q0')
    c.oval(CX, 52, 18 * g, 4 * g, 'q1')
    c.shockring(CX, 52, 10 + (f % 5) * 5, 'q3', None, 0.28, 1)
    for i, y in enumerate((14, 24, 34, 44)):
        x0 = 56 - ((f * 8 + i * 6) % 26)
        c.lens((x0, y), (x0 + 16, y), 3, ['q1', 'q2', 'q4'])
    r = rng(3)
    for i in range(8):
        c.px(CX + r.uniform(-20, 20), 52 - ((f * 5 + i * 8) % 44), ['q4', 'y3'][i % 2])


# --------------------------------------------------------------------------- 6 단검 부채
@effect('thief_fan', 64, 10, 'allTargets', TH)
def _(c, f):
    t = T(f, 10)
    g = ease(min(1, f / 3))
    base = t * 360 * 1.1
    n = 9
    for i in range(n):
        a = math.radians(base + i * 360 / n)
        R = (8 + 20 * g)
        x, y = pol(CX, CY + 2, R, a, 0.6)
        c.sword(x + math.cos(a) * 2, y + math.sin(a) * 2 * 0.6, a, 13, blade='s2', hi='w', guard='y2', grip='m1', bw=2.4, edge='s0')
        tail = pol(CX, CY + 2, R * 0.6, a - 0.35, 0.6)
        c.line([tail, (x, y)], 's1')
    if f >= 2:
        c.dring(CX, CY + 2, 30, 's1', squash=0.6, parity=f % 2)
    c.disc(CX, CY + 2, 4, 's1')
    c.spark(CX, CY + 2, 5, 'w', 'y3', diag=True) if f % 2 else None
    if f >= 5:
        r = rng(5)
        for i in range(8):
            a = r.uniform(0, math.tau)
            c.px(CX + math.cos(a) * 28, CY + 2 + math.sin(a) * 17, 'y3' if i % 2 else 'w')


# --------------------------------------------------------------------------- 7 급습
@effect('thief_ambush', 64, 9, 'target', TH)
def _(c, f):
    if f <= 3:
        u = [0.1, 0.45, 0.8, 1.0][f]
        y = lerp(-14, 34, u)
        # 위에서 교차한 쌍단검이 떨어진다: 하나는 왼쪽으로 기울고 하나는 오른쪽.
        c.lens((CX, y - 30), (CX, y), 8, ['s0', 's1', 's2'])
        c.sword(CX - 6, y + 12, math.pi / 2 + 0.28, 30, blade='s2', hi='w', guard='y2', grip='m1', bw=5, edge='s0')
        c.sword(CX + 6, y + 12, math.pi / 2 - 0.28, 30, blade='s3', hi='w', guard='y2', grip='m1', bw=5, edge='s0')
    if f >= 3:
        u = (f - 3) / 5
        c.lens((CX - 24, CY - 22), (CX + 24, CY + 22), 9 - u * 6, ['s0', 's1', 's3', 'w'])
        c.lens((CX + 24, CY - 22), (CX - 24, CY + 22), 9 - u * 6, ['s0', 's1', 's3', 'w'])
        c.burst(CX, CY, max(3, 13 - u * 9), ['y1', 'y2', 'y3', 'w'], rays=10, long=1.7)
        c.shockring(CX, 54, 8 + u * 22, 's2', 'w', 0.42, 2)
    r = rng(6)
    for i in range(10):
        a = r.uniform(0, math.tau)
        d = max(0, f - 2) * 3.6 * r.uniform(0.5, 1.2)
        c.diamond(CX + math.cos(a) * d, CY + math.sin(a) * d, 1, 2, 'y2' if i % 2 else 'w')


# --------------------------------------------------------------------------- 8 대도의 손길
@effect('thief_heist_sky', 128, 12, 'screen', TH)
def _(c, f):
    t = T(f, 12)
    cx = 64
    g = ease(min(1, t * 2.2))
    # 밤하늘 달: 큰 금빛 초승달과 별.
    c.glow(cx, 30, 28 * g, ['q1', 'q2', 'y1', 'y2']) if False else c.glow(cx, 30, 28 * g, ['s0', 's1', 'y1', 'y2'])
    c.disc(cx, 30, 15 * g, 'y2')
    c.disc(cx + 6, 27, 13 * g, 's0')
    c.disc(cx - 2, 33, 4 * g, 'y3')
    r = rng(2)
    for i in range(16):
        c.spark(cx + r.uniform(-58, 58), r.uniform(6, 60), 2 if i % 3 else 3, 'w', 's2') if (i + f) % 3 else None
    # 세 줄 X 베기 자국: 순차로 그어진다.
    slashes = [((10, 30), (118, 96)), ((118, 30), (10, 96)), ((6, 64), (122, 60))]
    for i, (a, b) in enumerate(slashes):
        s0 = 3 + i * 1.5
        if f >= s0:
            u = min(1, (f - s0) / 1.6)
            end = (lerp(a[0], b[0], u), lerp(a[1], b[1], u))
            hold = 1 - max(0, f - 8) * 0.3
            c.lens(a, end, 8 * hold + 1, ['s0', 's1', 's3', 'w'])
    # 금화·보석 소나기
    if f >= 5:
        r2 = rng(7)
        for i in range(22):
            x = r2.uniform(8, 120)
            y = -8 + ((f - 5) * 12 + i * 11) % 120
            if i % 4 == 0:
                c.poly([(x, y - 3), (x + 3, y), (x, y + 3), (x - 3, y)], 'y3')
                c.px(x, y, 'w')
            else:
                c.coin(x, y, 3, 'y1', 'y2', 'w', edge_on=abs(math.sin(i + f)))
    # 예고장: 별 그려진 카드가 중앙에 꽂힌다.
    if f >= 8:
        u = min(1, (f - 8) / 2)
        y = lerp(0, 74, ease(u))
        c.rect(cx - 9, y - 14, cx + 9, y + 12, 'y1')
        c.rect(cx - 8, y - 13, cx + 8, y + 11, 'w')
        c.star4(cx, y - 1, 6, 'y1', 'y3')
        c.line([(cx - 8, y + 5), (cx + 8, y + 5)], 's1')


@effect('thief_heist_hit', 64, 10, 'allTargets', TH)
def _(c, f):
    u = min(1.0, f / 6)
    L = 28 * ease(min(1, f / 2.5))
    if f < 8:
        c.lens((CX - L, CY - L), (CX + L, CY + L), 9 - u * 5, ['s0', 's1', 's3', 'w'])
        c.lens((CX + L, CY - L), (CX - L, CY + L), 9 - u * 5, ['s0', 's1', 's3', 'w'])
    c.burst(CX, CY, max(3, 13 - u * 9), ['y1', 'y2', 'y3', 'w'], rays=10, long=1.8)
    r = rng(8)
    for i in range(10):
        a = r.uniform(0, math.tau)
        d = (4 + u * 24) * r.uniform(0.6, 1.2)
        x, y = CX + math.cos(a) * d, CY + math.sin(a) * d + max(0, f - 4) * 2
        c.coin(x, y, 3, 'y1', 'y2', 'w', edge_on=abs(math.sin(i + f)))
    c.dring(CX, CY, 8 + u * 22, 'y2')
