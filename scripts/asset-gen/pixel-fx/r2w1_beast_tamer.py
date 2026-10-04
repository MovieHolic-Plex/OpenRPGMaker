"""야수조련사(class_beast_tamer, 칩 actor2-2): 갈색 피부 조련사, 야수를 불러 공격. 색: 야생 갈색·호박색 + 잎 초록 + 송곳니 흰색 + 붉은 입."""
import math

from lib_r2w1 import *

SKILLS = Skills('beast_tamer', 'class_beast_tamer', 'actor2-2')
SKILLS.add('wolf_bite', '늑대 물기', 1, 'dash-strike', '늑대를 부르짖어 적의 목덜미를 물게 한다', 'beast_tamer_wolf') \
    .add('hawk_dive', '매의 급강하', 3, 'leap-strike', '매가 하늘에서 내리꽂혀 발톱으로 낚아챈다', 'beast_tamer_hawk') \
    .add('bear_claw', '곰 발톱', 5, 'flurry', '거대한 곰의 발톱이 세 줄기로 할퀴고 지나간다', 'beast_tamer_claw') \
    .add('wild_roar', '야성의 포효', 7, 'buff', '포효의 파문이 퍼지며 공격력이 오른다', 'beast_tamer_roar') \
    .add('serpent_bind', '독사 결박', 10, 'cast', '거대한 뱀이 적을 휘감아 죄어 든다', 'beast_tamer_snake') \
    .add('stampede', '야수 질주', 12, 'spin', '늑대·멧돼지·들소 떼가 적진을 가로질러 짓밟는다', 'beast_tamer_stampede') \
    .add('nature_mend', '야생의 치유', 16, 'buff', '발자국과 새잎이 피어나 아군 모두를 회복시킨다', 'beast_tamer_mend') \
    .add('beast_king', '백수의 왕', 22, 'finisher', '달빛 아래 거대한 영수가 나타나 하늘을 가르며 포효하는 필살기', 'beast_tamer_king_sky', 'beast_tamer_king_hit')

BT = pal(pick(BROWN, 't0', 't1', 't2', 't3', 't4'), pick(AMBER, 'm2', 'm3'), pick(CRIM, 'r1', 'r2'), pick(STEEL, 's3'), WHITE)
BT_G = pal(pick(GREEN, 'g0', 'g1', 'g2', 'g3', 'g4'), pick(BROWN, 't1', 't2', 't3'), pick(AMBER, 'm2', 'm3'), pick(CRIM, 'r2'), WHITE)
BT_K = pal(pick(BROWN, 't0', 't1', 't2', 't3', 't4'), pick(AMBER, 'm1', 'm2', 'm3'), pick(CRIM, 'r1', 'r2'), pick(GOLD, 'y2', 'y3'), WHITE)
CX, CY = 32, 34


def T(f, n):
    return f / (n - 1)


def wolf_head(c, x, y, s, open_, dark, mid, light, fang='w', eye='m3', mouth='r1', tongue='r2'):
    """왼쪽을 향한 늑대 머리. (x, y)는 머리 중심, s 배율, open_ 0~1 은 아래턱이 벌어진 정도."""
    def P(px, py):
        return (x + px * s, y + py * s)
    # 귀
    c.poly([P(2, -7), P(6, -16), P(9, -6)], dark)
    c.poly([P(3, -7), P(6, -13), P(8, -7)], mid)
    # 아래턱
    oa = open_ * 0.55
    def lj(px, py):
        cx0, cy0 = 3, 3
        dx, dy = px - cx0, py - cy0
        return P(cx0 + dx * math.cos(oa) - dy * math.sin(oa) * -1, cy0 + dx * math.sin(oa) * -1 * -1 + dy * math.cos(oa))
    lower = [lj(3, 3), lj(-14, 3), lj(-15, 5), lj(-6, 8), lj(3, 8)]
    if open_ > 0.1:
        c.poly([P(-4, 3), P(-13, 3), P(-4, 5)], mouth)
    c.poly(lower, mid)
    # 위턱 + 머리
    c.poly([P(-15, -1), P(-6, -6), P(4, -8), P(9, -2), P(8, 6), P(2, 8), P(-4, 3), P(-15, 2)], dark)
    c.poly([P(-14, -1), P(-6, -5), P(3, -7), P(8, -1), P(3, 3), P(-4, 2), P(-14, 1)], mid)
    c.poly([P(-6, -5), P(3, -7), P(6, -3), P(-2, -2)], light)
    c.px(*P(-15, 0), dark)
    c.poly([P(-16, -1), P(-14, -2), P(-14, 1), P(-16, 1)], dark)
    # 송곳니
    c.poly([P(-11, 2), P(-9, 2), P(-10, 5 + open_ * 2)], fang)
    if open_ > 0.15:
        lp = lj(-11, 3)
        c.poly([(lp[0], lp[1]), (lp[0] + 2 * s, lp[1]), (lp[0] + 1 * s, lp[1] - 3 * s)], fang)
    c.line([P(-1, -3), P(2, -2)], eye, 2 if s >= 1.5 else 1)


# --------------------------------------------------------------------------- 1 늑대 물기
@effect('beast_tamer_wolf', 64, 8, 'target', BT)
def _(c, f):
    if f <= 3:
        x = lerp(70, 40, ease(f / 3))
        oa = [0.9, 1.0, 0.85, 0.35][f]
        c.lens((min(70, x + 30), CY), (x, CY), 8, ['t0', 't1', 't2'])
        wolf_head(c, x, CY, 1.9, oa, 't0', 't2', 't3')
    if f >= 3:
        u = (f - 3) / 4
        wolf_head(c, 38, CY, 1.9, 0.0, 't0', 't2', 't3') if f == 3 else None
        # 문 자리: 위아래 이빨 자국(어긋난 삼각 두 줄) + 붉은 번쩍임
        for i, dx in enumerate((-10, -3, 4, 11)):
            c.poly([(CX + dx - 2, CY - 9), (CX + dx + 2, CY - 9), (CX + dx, CY - 2 - u * 2)], 'w')
            c.poly([(CX + dx - 2, CY + 9), (CX + dx + 2, CY + 9), (CX + dx, CY + 2 + u * 2)], 'w')
        c.burst(CX, CY, max(3, 11 - u * 8), ['r1', 'r2', 'm3', 'w'], rays=8, long=1.8)
        c.lens((CX - 22, CY - 16), (CX + 22, CY + 16), 6 - u * 3, ['r1', 'r2', 'w'])
    if f >= 5:
        c.dring(CX, CY, 8 + (f - 5) * 7, 'm2')
    r = rng(2)
    for i in range(8):
        a = r.uniform(0, math.tau)
        d = max(0, f - 2) * 3.4 * r.uniform(0.5, 1.2)
        c.diamond(CX + math.cos(a) * d, CY + math.sin(a) * d, 1, 2, 'r2' if i % 2 else 'w')


# --------------------------------------------------------------------------- 2 매의 급강하
def hawk(c, x, y, ang, s, body, wing, tip, beak, eye='w', fold=0.0):
    """급강하하는 매(위에서 본 듯한 실루엣). ang: 진행 방향(라디안), fold 0=펼침 1=접음."""
    ux, uy = math.cos(ang), math.sin(ang)
    vx, vy = -uy, ux
    sp = 15 * s * (1 - fold * 0.7)
    for side in (-1, 1):
        w0 = (x - ux * 2 * s, y - uy * 2 * s)
        w1 = (x - ux * 8 * s + vx * side * sp, y - uy * 8 * s + vy * side * sp)
        w2 = (x - ux * 15 * s + vx * side * sp * 0.6, y - uy * 15 * s + vy * side * sp * 0.6)
        w3 = (x - ux * 8 * s, y - uy * 8 * s)
        c.poly([w0, w1, w2, w3], wing)
        c.line([w0, w1], tip, 1)
        c.line([w1, w2], tip, 1)
    c.poly([(x + ux * 8 * s, y + uy * 8 * s), (x + vx * 3.5 * s, y + vy * 3.5 * s), (x - ux * 12 * s, y - uy * 12 * s), (x - vx * 3.5 * s, y - vy * 3.5 * s)], body)
    c.poly([(x - ux * 12 * s, y - uy * 12 * s), (x - ux * 18 * s + vx * 3 * s, y - uy * 18 * s + vy * 3 * s), (x - ux * 18 * s - vx * 3 * s, y - uy * 18 * s - vy * 3 * s)], tip)
    c.disc(x + ux * 6 * s, y + uy * 6 * s, 2.5 * s, body)
    c.poly([(x + ux * 12 * s, y + uy * 12 * s), (x + ux * 7 * s + vx * 2 * s, y + uy * 7 * s + vy * 2 * s), (x + ux * 7 * s - vx * 2 * s, y + uy * 7 * s - vy * 2 * s)], beak)
    c.px(x + ux * 6 * s + vx, y + uy * 6 * s + vy, eye)


@effect('beast_tamer_hawk', 64, 9, 'target', BT)
def _(c, f):
    if f <= 3:
        u = [0.1, 0.4, 0.75, 1.0][f]
        x, y = lerp(60, CX, u), lerp(-4, CY - 4, u)
        ang = math.atan2(CY - 4 - (-4), CX - 60)
        pts = [(lerp(60, CX, max(0, u - 0.06 * k)), lerp(-4, CY - 4, max(0, u - 0.06 * k))) for k in range(8)]
        c.trail(pts, ['t1', 't2', 't3'], 9, 1)
        hawk(c, x, y, ang, 1.2 - u * 0.1, 't2', 't1', 't0', 'm3', fold=u * 0.8)
    if f >= 3:
        u = (f - 3) / 5
        # 발톱: 네 갈래로 할퀴는 자국 + 흩날리는 깃털
        for i, dx in enumerate((-9, -3, 3, 9)):
            c.lens((CX + dx - 5, CY - 20), (CX + dx + 5, CY + 20), 4 - u * 2, ['t1', 't3', 'w'])
        c.burst(CX, CY, max(3, 11 - u * 8), ['t1', 'm2', 'm3', 'w'], rays=8, long=1.7)
        r = rng(3)
        for i in range(8):
            a = r.uniform(0, math.tau)
            d = (4 + u * 20) * r.uniform(0.5, 1.2)
            c.petal(CX + math.cos(a) * d, CY + math.sin(a) * d + u * 6, a + u * 3, 6, ['t3', 'w', 't4'][i % 3], 't2', edge='t1')
    if f >= 6:
        c.dring(CX, CY, 10 + (f - 6) * 6, 'm2')


# --------------------------------------------------------------------------- 3 곰 발톱
@effect('beast_tamer_claw', 64, 9, 'target', BT)
def _(c, f):
    if f == 0:
        c.glow(CX, 10, 6, ['t1', 'm2', 'w'])
    # 굵은 세 줄이 위에서 아래로 그어지고, 곰 발바닥 무늬가 남는다.
    for k, dx in enumerate((-14, 0, 14)):
        s0 = 1 + k * 0.6
        if f >= s0:
            u = min(1.0, (f - s0) / 1.8)
            hold = 1 - max(0, f - 6) * 0.3
            a = (CX + dx - 12, 2)
            b = (CX + dx + 12, 60)
            end = (lerp(a[0], b[0], u), lerp(a[1], b[1], u))
            c.lens(a, end, 11 * hold + 1, ['t0', 't1', 'm2', 'm3', 'w'])
    if f >= 3:
        u = (f - 3) / 5
        # 곰 발바닥: 큰 패드 하나 + 발가락 넷
        c.oval(CX, CY + 6, 9, 7, 't0')
        c.oval(CX, CY + 6, 7, 5, 't1')
        for dx in (-9, -3, 3, 9):
            c.oval(CX + dx, CY - 6 - (abs(dx) < 5) * 3, 3, 4, 't0')
            c.oval(CX + dx, CY - 6 - (abs(dx) < 5) * 3, 2, 3, 't1')
        c.burst(CX, CY, max(3, 10 - u * 7), ['t1', 'm2', 'm3', 'w'], rays=10, long=1.8)
    r = rng(4)
    for i in range(10):
        c.px(CX + r.uniform(-22, 22), CY + r.uniform(-20, 20) + max(0, f - 4) * 2, ['m3', 'w', 't3'][i % 3])
    if f >= 6:
        c.dring(CX, CY, 12 + (f - 6) * 5, 't2')


# --------------------------------------------------------------------------- 4 야성의 포효
@effect('beast_tamer_roar', 64, 10, 'user', BT_G)
def _(c, f):
    t = T(f, 10)
    # 입 앞에서 퍼지는 파문 세 겹(왼쪽), 몸 둘레의 야생 기운(초록·호박), 발밑 발자국.
    for k in range(3):
        u = (f * 0.35 + k * 0.5) % 1.5
        R = 6 + u * 24
        c.arc(CX - 8, 26, R, 140, 220, 'g3' if k % 2 == 0 else 'm3', 3 - int(u * 2))
        c.arc(CX - 8, 26, R - 3, 150, 210, 'w', 1)
    for i in range(6):
        a = math.tau * i / 6 + t * 6
        x, y = pol(CX, 34, 18, a, 1.5)
        c.lens((x, y + 6), (x + math.cos(a) * 2, y - 10), 5, ['g1', 'g2', 'g3'])
    c.shockring(CX, 52, 20 + (f % 4) * 2, 'g2', 'g3', 0.32, 2)
    for i in range(4):
        x = CX - 14 + i * 9
        y = 52 + (i % 2) * 2
        c.oval(x, y, 3, 2, 't1')
        for dx in (-3, 0, 3):
            c.px(x + dx, y - 3, 't2')
    r = rng(1)
    for i in range(8):
        c.px(CX + r.uniform(-22, 22), 50 - ((f * 6 + i * 9) % 44), ['m3', 'g3', 'w'][i % 3])
    c.ring(CX, 30, 20 + (f % 3), 'm2', 1, 1.3) if f in (2, 5, 8) else None


# --------------------------------------------------------------------------- 5 독사 결박
def snake_coil(c, cx, cy, turns, R, head_t, body, belly, dark, eye='r2'):
    """세로로 감아 오르는 뱀. head_t: 0~1 머리가 도달한 정도."""
    pts = []
    n = 60
    for i in range(n + 1):
        u = i / n * head_t
        a = u * turns * math.tau
        y = cy + 28 - u * 56
        x = cx + math.cos(a) * R
        pts.append((x, y, math.sin(a)))
    for i in range(len(pts) - 1):
        x0, y0, d0 = pts[i]
        x1, y1, d1 = pts[i + 1]
        front = d0 > 0
        w = 5 if front else 4
        c.line([(x0, y0), (x1, y1)], dark, w + 2)
    for i in range(len(pts) - 1):
        x0, y0, d0 = pts[i]
        x1, y1, d1 = pts[i + 1]
        front = d0 > 0
        c.line([(x0, y0), (x1, y1)], body if front else dark, 5 if front else 4)
        if front:
            c.line([(x0, y0 - 1), (x1, y1 - 1)], belly, 1)
    hx, hy, _ = pts[-1]
    c.oval(hx - 3, hy - 3, 5, 4, dark)
    c.oval(hx - 3, hy - 3, 4, 3, body)
    c.px(hx - 4, hy - 4, eye)
    c.line([(hx - 8, hy - 3), (hx - 11, hy - 4)], 'r2', 1)
    c.line([(hx - 8, hy - 3), (hx - 11, hy - 2)], 'r2', 1)


@effect('beast_tamer_snake', 64, 10, 'target', BT_G)
def _(c, f):
    t = T(f, 10)
    head = ease(min(1, t * 1.7))
    snake_coil(c, CX, CY, 3.2, 14, max(0.05, head), 'g2', 'g4', 'g0')
    if f >= 5:
        # 죄는 힘: 안쪽으로 모이는 선 + 독 방울
        u = (f - 5) / 4
        for i in range(6):
            a = math.tau * i / 6
            c.line([pol(CX, CY, 26 - u * 6, a, 1.0), pol(CX, CY, 20 - u * 6, a, 1.0)], 'm3')
        r = rng(3)
        for i in range(7):
            x = CX + r.uniform(-16, 16)
            y = 52 - ((f * 5 + i * 8) % 44)
            c.ring(x, y, 2, 'g3', 1)
    c.shockring(CX, 56, 10 + t * 14, 'g2', None, 0.3, 1)
    if f <= 2:
        c.spark(CX + 10, 54, 3, 'w', 'g3')


# --------------------------------------------------------------------------- 6 야수 질주
def boar(c, x, y, s, body, dark, tusk, eye):
    """왼쪽으로 달리는 멧돼지 실루엣."""
    def P(px, py):
        return (x + px * s, y + py * s)
    c.poly([P(-12, -6), P(4, -8), P(14, -4), P(14, 4), P(6, 6), P(-12, 6)], dark)
    c.poly([P(-11, -5), P(3, -7), P(13, -3), P(13, 3), P(5, 5), P(-11, 5)], body)
    c.poly([P(-12, -3), P(-19, -1), P(-19, 3), P(-11, 4)], dark)
    c.poly([P(-12, -2), P(-18, 0), P(-18, 2), P(-11, 3)], body)
    c.poly([P(-15, 2), P(-19, 6), P(-16, 4)], tusk)
    c.px(*P(-9, -2), eye)
    for lx in (-8, 8):
        c.line([P(lx, 5), P(lx - 3, 11)], dark, 2)
        c.line([P(lx + 3, 5), P(lx + 6, 11)], dark, 2)
    c.line([P(14, -3), P(17, -6)], dark, 1)


def runner(c, x, y, s, kind, phase):
    if kind == 'wolf':
        wolf_head(c, x - 10 * s, y - 2 * s, 1.0 * s, 0.4, 't0', 't2', 't3')
        c.poly([(x - 8 * s, y - 6 * s), (x + 12 * s, y - 5 * s), (x + 12 * s, y + 3 * s), (x - 6 * s, y + 3 * s)], 't1')
        c.poly([(x - 8 * s, y - 5 * s), (x + 11 * s, y - 4 * s), (x + 11 * s, y + 1 * s), (x - 6 * s, y + 1 * s)], 't2')
        for lx, ph in ((-4, 0), (8, 1)):
            sw = math.sin(phase * 2 + ph * 2) * 4
            c.line([(x + lx * s, y + 2 * s), (x + (lx + sw) * s, y + 9 * s)], 't0', 2)
        c.line([(x + 12 * s, y - 4 * s), (x + 19 * s, y - 8 * s)], 't1', 2)
    else:
        boar(c, x, y, s, 't2', 't0', 'w', 'm3')


@effect('beast_tamer_stampede', 64, 10, 'allTargets', BT)
def _(c, f):
    t = T(f, 10)
    # 오른쪽에서 왼쪽으로 세 마리가 층층이 가로지르고, 뒤로 흙먼지가 인다.
    lanes = [(30, 'boar', 0.9, 0.0), (40, 'wolf', 0.9, 0.35), (50, 'boar', 1.0, 0.7)]
    for y, kind, s, off in lanes:
        u = t * 1.6 - off
        if u < 0 or u > 1.2:
            continue
        x = lerp(80, -18, min(1.0, u / 1.15))
        runner(c, x, y, s, kind, f * 1.7)
        for k in range(6):
            c.disc(x + 14 * s + k * 5, y + 8 * s - (k % 2), 3 - k * 0.4, 'm2' if k % 2 else 't3')
    if 3 <= f <= 8:
        c.shockring(CX, 54, 12 + (f - 3) * 4, 't3', None, 0.34, 1)
    r = rng(5)
    for i in range(10):
        c.px(CX + r.uniform(-28, 28), 56 - ((f * 5 + i * 7) % 30), ['t3', 'm3', 'w'][i % 3])


# --------------------------------------------------------------------------- 7 야생의 치유
def paw(c, x, y, s, key, hi):
    c.oval(x, y, 3 * s, 2.4 * s, key)
    for dx in (-3, -1, 1, 3):
        c.px(x + dx * s, y - 3.4 * s - (abs(dx) < 2), key)
        c.px(x + dx * s, y - 4.4 * s - (abs(dx) < 2), hi)


@effect('beast_tamer_mend', 64, 10, 'allAllies', BT_G)
def _(c, f):
    t = T(f, 10)
    # 발밑에서 발자국이 하나씩 밝아지며 올라오고, 새싹이 자라 잎을 펼친다.
    for i in range(4):
        on = f >= 1 + i
        x = CX - 15 + i * 10
        y = 54 - (i % 2) * 3
        paw(c, x, y, 1.0, 'g2' if on else 'g0', 'g4' if on else 'g1')
    g = ease(min(1, t * 1.8))
    for k, dx in enumerate((-16, 0, 16)):
        hh = (24 + (k == 1) * 10) * g
        c.line([(CX + dx, 50), (CX + dx + math.sin(t * 4 + k) * 2, 50 - hh)], 'g1', 2)
        c.line([(CX + dx, 50), (CX + dx + math.sin(t * 4 + k) * 2, 50 - hh)], 'g2', 1)
        for j, side in enumerate((-1, 1)):
            lx, ly = CX + dx + math.sin(t * 4 + k) * 2, 50 - hh * (0.55 + 0.4 * j)
            c.leaf(lx + side * 5, ly, math.radians(-30 if side > 0 else 210) - side * 0.2, 10 * g + 2, 'g2', 'g4', edge='g0')
    if f >= 3:
        c.glow(CX, 32, 14 + (f % 3), ['g0', 'g1', 'g2']) if False else c.dring(CX, 34, 22 + (f % 3) * 2, 'g3', squash=1.3, parity=f % 2)
    r = rng(2)
    for i in range(8):
        c.petal(CX + r.uniform(-20, 20), 50 - ((f * 5 + i * 8) % 44), 1.0 + i, 5, 'g3' if i % 2 else 'w', 'g2', edge='g1')


# --------------------------------------------------------------------------- 8 백수의 왕
def tiger_head(c, x, y, s, roar, dark, mid, light, stripe, fang, eye, mouth, tongue):
    """정면 호랑이 머리(포효). (x, y) 머리 중심."""
    def P(px, py):
        return (x + px * s, y + py * s)
    for sd in (-1, 1):
        c.disc(*P(sd * 15, -15), 6 * s, dark)
        c.disc(*P(sd * 15, -14), 4 * s, mid)
    c.oval(x, y, 20 * s, 18 * s, dark)
    c.oval(x, y, 18.5 * s, 16.5 * s, mid)
    c.oval(x, y - 6 * s, 14 * s, 7 * s, light)
    for sd in (-1, 1):
        for k in range(3):
            c.line([P(sd * 17, -6 + k * 5), P(sd * 11, -4 + k * 5)], stripe, max(1, int(2 * s)))
        c.line([P(sd * 4, -16), P(sd * 6, -9)], stripe, max(1, int(2 * s)))
    c.line([P(0, -17), P(0, -8)], stripe, max(1, int(2 * s)))
    # 눈: 앙칼진 사선 눈
    for sd in (-1, 1):
        c.poly([P(sd * 4, -3), P(sd * 12, -6), P(sd * 11, -1), P(sd * 5, 0)], stripe)
        c.poly([P(sd * 5.5, -2.5), P(sd * 10.5, -4.5), P(sd * 10, -2), P(sd * 6, -1)], eye)
        c.px(*P(sd * 8, -3), stripe)
    # 코와 입
    c.poly([P(-3, 2), P(3, 2), P(0, 6)], stripe)
    mo = 4 + roar * 8
    c.poly([P(-11, 8), P(11, 8), P(9, 8 + mo), P(0, 9 + mo * 1.15), P(-9, 8 + mo)], stripe)
    c.poly([P(-9.5, 9), P(9.5, 9), P(8, 8 + mo - 1), P(0, 8.5 + mo), P(-8, 8 + mo - 1)], mouth)
    c.poly([P(-5, 10 + mo * 0.6), P(5, 10 + mo * 0.6), P(0, 8 + mo)], tongue)
    for sd in (-1, 1):
        c.poly([P(sd * 8, 8), P(sd * 5, 8), P(sd * 6.5, 8 + 5 + roar * 2)], fang)
        c.poly([P(sd * 7, 8 + mo), P(sd * 4.5, 8 + mo), P(sd * 5.8, 8 + mo - 4)], fang)


@effect('beast_tamer_king_sky', 128, 12, 'screen', BT_K)
def _(c, f):
    t = T(f, 12)
    cx = 64
    g = ease(min(1, t * 2.2))
    # 달빛 후광 + 사방으로 퍼지는 포효 파문
    c.glow(cx, 50, 46 * g, ['t0', 't1', 'm1', 'm2'])
    for k in range(3):
        u = (f * 0.3 + k * 0.5) % 1.5
        c.ring(cx, 50, 22 + u * 44, 'm3' if k % 2 else 'y2', 2, 0.9)
    if f >= 2:
        s = 1.0 + g * 1.4
        roar = min(1.0, max(0.0, (f - 2) / 4))
        tiger_head(c, cx, 52, s, roar, 't0', 'm2', 'y3', 't0', 'w', 'y2', 'r2', 'r1')
    for i in range(12):
        a = math.tau * i / 12 + t
        c.lens(pol(cx, 52, 40, a, 0.9), pol(cx, 52, 58 + g * 6, a, 0.9), 4, ['t1', 'm2', 'y2'])
    if f >= 5:
        # 좌우에서 달려드는 늑대 무리 실루엣
        for sd in (-1, 1):
            for k in range(2):
                x = cx + sd * (44 + k * 12 - (f - 5) * 4)
                wolf_head(c, x, 96 - k * 8, 1.1, 0.5, 't0', 't2', 't3') if sd < 0 else wolf_head(c, x, 96 - k * 8, 1.1, 0.5, 't0', 't2', 't3')
    r = rng(6)
    for i in range(16):
        c.px(cx + r.uniform(-56, 56), 8 + ((f * 9 + i * 11) % 100), ['y3', 'm3', 'w'][i % 3])


@effect('beast_tamer_king_hit', 64, 10, 'allTargets', BT_K)
def _(c, f):
    u = f / 9  # 끝 칸까지 계속 퍼진다(6칸에서 멈추면 마지막 칸이 같아진다)
    # 세 줄 발톱 참격(대각) 두 번 + 붉은 충격.
    L = 28 * ease(min(1, f / 2.5))
    if f < 8:
        for k, dx in enumerate((-10, 0, 10)):
            c.lens((CX + dx - L * 0.6, CY - L), (CX + dx + L * 0.6, CY + L), 7 - u * 4, ['t0', 'm2', 'y3', 'w'])
    c.burst(CX, CY, max(3, 13 - u * 9), ['t1', 'm2', 'y3', 'w'], rays=10, long=1.8)
    c.shockring(CX, 56, 6 + u * 26, 'm2', 'y3', 0.4, 2)
    r = rng(7)
    for i in range(10):
        a = r.uniform(0, math.tau)
        d = (4 + u * 24) * r.uniform(0.6, 1.2)
        c.px(CX + math.cos(a) * d, CY + math.sin(a) * d, ['y3', 'w', 'r2'][i % 3])
    if f >= 7:
        c.dring(CX, CY, 10 + (f - 7) * 8, 'm2', parity=f % 2)
