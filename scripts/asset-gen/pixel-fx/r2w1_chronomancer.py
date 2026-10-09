"""시공술사(class_chronomancer, 칩 actor1-6): 검은 머리 흰 로브, 시간 가속·정지. 색: 청록 시계빛 + 금 톱니/시침 + 모래빛."""
import math

from lib_r2w1 import *

SKILLS = Skills('chronomancer', 'class_chronomancer', 'actor1-6')
SKILLS.add('hand_strike', '시침 타격', 1, 'dash-strike', '거대한 시침·분침이 가위처럼 적을 가른다', 'chronomancer_hands') \
    .add('haste', '헤이스트', 3, 'buff', '시계 바늘이 빠르게 돌며 아군 모두의 속도가 오른다', 'chronomancer_haste') \
    .add('slow', '슬로우', 5, 'cast', '적을 모래시계에 가두어 움직임을 늦춘다', 'chronomancer_slow') \
    .add('time_arrow', '시간 화살', 7, 'shoot', '금빛 시곗바늘 화살을 쏘아 시계 무늬로 터뜨린다', 'chronomancer_arrow', 'chronomancer_arrow_hit') \
    .add('sand_fall', '모래 폭포', 10, 'cast', '하늘의 모래시계가 뒤집혀 모래가 쏟아진다', 'chronomancer_sand') \
    .add('rewind', '되감기', 12, 'buff', '시간이 거꾸로 흘러 아군의 상처가 아문다', 'chronomancer_rewind') \
    .add('time_skip', '시간 도약', 16, 'blink-strike', '시계 문자판을 열고 사라졌다가 적 뒤에서 나타나 벤다', 'chronomancer_skip') \
    .add('world_stop', '월드 스톱', 22, 'finisher', '거대한 시계가 자정에 멈추고 유리처럼 깨지며 세상이 정지하는 필살기', 'chronomancer_stop_sky', 'chronomancer_stop_hit')

CH = pal(pick(TEAL, 'c0', 'c1', 'c2', 'c3', 'c4'), pick(GOLD, 'y1', 'y2', 'y3'), pick(STEEL, 's1', 's2'), WHITE)
CX, CY = 32, 34
TL = ['c1', 'c2', 'c3', 'c4', 'w']


def T(f, n):
    return f / (n - 1)


def clock(c, x, y, r, hour_deg, min_deg, face='c1', rim='y2', rim2='y1', tick='c4', hand_a='y3', hand_b='w', ticks=12, sq=1.0, fill=True):
    if fill:
        c.oval(x, y, r, r * sq, face)
    c.ring(x, y, r, rim, 2 if r > 8 else 1, sq)
    c.ring(x, y, r - 2, rim2, 1, sq) if r > 10 else None
    for i in range(ticks):
        a = math.tau * i / ticks - math.pi / 2
        big = i % 3 == 0
        c.line([pol(x, y, r - (5 if big else 3), a, sq), pol(x, y, r - 2, a, sq)], tick, 1)
    ah = math.radians(hour_deg - 90)
    am = math.radians(min_deg - 90)
    c.line([(x, y), pol(x, y, r * 0.5, ah, sq)], hand_a, 2 if r > 12 else 1)
    c.line([(x, y), pol(x, y, r * 0.78, am, sq)], hand_b, 1)
    c.disc(x, y, 1.5, rim)


def hourglass(c, x, y, w, h, frame, glass, sand, fill_top, fill_bot):
    """모래시계: 위·아래 삼각 유리, 목, 위아래 금테. fill_top/bot 0~1."""
    top, bot = y - h / 2, y + h / 2
    c.poly([(x - w / 2, top), (x + w / 2, top), (x + 1, y), (x - 1, y)], glass)
    c.poly([(x - w / 2, bot), (x + w / 2, bot), (x + 1, y), (x - 1, y)], glass)
    if fill_top > 0:
        hh = (h / 2) * fill_top
        c.poly([(x - w / 2 + 2, top + 2 + (h / 2 - hh)), (x + w / 2 - 2, top + 2 + (h / 2 - hh)), (x + 1, y - 1), (x - 1, y - 1)], sand)
    if fill_bot > 0:
        hh = (h / 2) * fill_bot
        c.poly([(x - w / 2 + 2, bot - 1), (x + w / 2 - 2, bot - 1), (x + 1, bot - hh)], sand)
    c.rect(x - w / 2 - 1, top - 2, x + w / 2 + 1, top, frame)
    c.rect(x - w / 2 - 1, bot, x + w / 2 + 1, bot + 2, frame)


# --------------------------------------------------------------------------- 1 시침 타격
@effect('chronomancer_hands', 64, 8, 'target', CH)
def _(c, f):
    # 크고 뾰족한 두 바늘(시침 굵고 짧게, 분침 가늘고 길게)이 가위처럼 교차해 적을 가른다.
    if f == 0:
        clock(c, CX, CY, 12, 0, 0, fill=False, tick='c3')
        c.glow(CX, CY, 6, ['c1', 'c3', 'w'])
    if 1 <= f <= 5:
        a = lerp(-100, 12, ease(min(1, f / 3)))
        b = lerp(100 + 180, 168 + 180, ease(min(1, f / 3)))
        # 분침(길다) 시계 방향, 시침(굵다) 반대 방향.
        pa = pol(CX, CY, 34, math.radians(a))
        c.lens((CX, CY), pa, 6, ['c1', 'y1', 'y2', 'y3'])
        pb = pol(CX, CY, 26, math.radians(b - 180 + 20))
        c.lens((CX, CY), pb, 9, ['c1', 'y1', 'y2', 'y3'])
        c.disc(CX, CY, 4, 'y1')
        c.disc(CX, CY, 2, 'y3')
        c.ring(CX, CY, 34, 'c2', 1) if f >= 2 else None
    if f >= 3:
        u = (f - 3) / 4
        c.burst(CX, CY, max(3, 11 - u * 7), ['c1', 'c2', 'c3', 'c4', 'w'], rays=12, long=1.9)
        for i in range(12):
            a = math.tau * i / 12
            c.px(*pol(CX, CY, 20 + u * 6, a), 'y2' if i % 3 == 0 else 'c3')
    if f >= 5:
        clock(c, CX, CY, 18 + (f - 5) * 4, 90, 180, fill=False, tick='c2', rim='c2', rim2='c1')


# --------------------------------------------------------------------------- 2 헤이스트
@effect('chronomancer_haste', 64, 10, 'allAllies', CH)
def _(c, f):
    t = T(f, 10)
    # 몸 뒤로 흐르는 속도선 + 발밑 회전 시계 + 머리 위에서 빠르게 도는 분침.
    for i, y in enumerate((16, 24, 32, 40, 48)):
        x0 = 58 - ((f * 9 + i * 7) % 30)
        c.lens((x0, y), (x0 + 22, y), 3, ['c1', 'c3', 'w'])
    clock(c, CX, 54, 16, t * 720, t * 3600, fill=False, sq=0.32, tick='c3', rim='y2', rim2='y1')
    clock(c, CX, 8, 8, t * 360, t * 2160, fill=True, face='c0', tick='c3')
    for i in range(3):
        a = math.tau * i / 3 + t * 8
        x, y = pol(CX, 54, 16, a, 0.32)
        c.px(x, y, 'y3')
    c.glow(CX, 30, 12, ['c1', 'c2', 'c3']) if f in (1, 4, 7) else None
    r = rng(1)
    for i in range(8):
        c.px(CX + r.uniform(-18, 18), 50 - ((f * 7 + i * 9) % 44), ['c4', 'y3'][i % 2])


# --------------------------------------------------------------------------- 3 슬로우
@effect('chronomancer_slow', 64, 10, 'target', CH)
def _(c, f):
    t = T(f, 10)
    # 적을 덮는 모래시계 + 굳는 톱니바퀴 + 무거운 모래.
    g = ease(min(1, t * 2.3))
    hourglass(c, CX, 30, 26 * g + 6, 44 * g + 6, 'y2', 'c1', 'y2', max(0, 1 - t * 1.05), min(1.0, t * 1.05))
    c.line([(CX - 13 * g - 3, 8 + (1 - g) * 22), (CX - 13 * g - 3, 52 - (1 - g) * 22)], 'c3', 1) if g > 0.6 else None
    c.line([(CX + 13 * g + 3, 8 + (1 - g) * 22), (CX + 13 * g + 3, 52 - (1 - g) * 22)], 'c3', 1) if g > 0.6 else None
    if f >= 2:
        c.gear(CX - 20, 46, 6, 8, 'y1', 'c0', rot=t * 0.5)
        c.gear(CX + 19, 16, 5, 7, 'y2', 'c0', rot=-t * 0.5)
    for i in range(5):
        y = 30 + ((f * 3 + i * 4) % 12)
        c.px(CX + (i - 2), y, 'y3')
    c.ring(CX, 56, 10 + t * 12, 'c2', 1, 0.3)
    if f >= 6:
        c.dring(CX, 30, 27, 'c2', squash=1.2, parity=f % 2)


# --------------------------------------------------------------------------- 4 시간 화살
@effect('chronomancer_arrow', 32, 4, 'projectile', CH)
def _(c, f):
    # 머리가 왼쪽: 금빛 화살촉 + 시침 모양 몸통 + 뒤로 청록 시계 눈금 잔상.
    c.lens((9, 16), (31, 16), 6, ['c0', 'c1', 'c2'])
    c.poly([(2, 16), (10, 11), (10, 21)], 'y2')
    c.poly([(3, 16), (9, 13), (9, 19)], 'y3')
    c.line([(10, 16), (24, 16)], 'y2', 3)
    c.line([(10, 16), (24, 16)], 'y3', 1)
    for i in range(3):
        c.px(14 + ((f * 4 + i * 4) % 14), 8 + i * 8, 'c4')
    a = math.radians(f * 90)
    c.ring(26, 16, 5, 'c3', 1)
    c.line([(26, 16), pol(26, 16, 4, a)], 'w')


@effect('chronomancer_arrow_hit', 64, 8, 'target', CH)
def _(c, f):
    u = min(1.0, f / 6)
    # 시계 문자판이 적 위에 나타나 바늘이 돌고 눈금이 터진다.
    clock(c, CX, CY, 8 + u * 18, f * 60, f * 360, fill=(f < 4), face='c0', tick='c3', rim='y2', rim2='y1')
    if f <= 3:
        c.burst(CX, CY, 9 - f * 2, ['c1', 'c2', 'c3', 'c4', 'w'], rays=8, long=1.7)
    if f >= 3:
        for i in range(12):
            a = math.tau * i / 12
            x, y = pol(CX, CY, 14 + (f - 3) * 5, a)
            c.line([(x, y), pol(CX, CY, 20 + (f - 3) * 5, a)], 'y3' if i % 3 == 0 else 'c3')
    c.dring(CX, CY, 14 + f * 3, 'c2') if f >= 4 else None


# --------------------------------------------------------------------------- 5 모래 폭포
@effect('chronomancer_sand', 64, 10, 'allTargets', CH)
def _(c, f):
    t = T(f, 10)
    # 위에서 쏟아지는 모래 줄기 + 쌓이는 모래 더미 + 떠다니는 알갱이.
    if f < 8:
        w = 4.5 - abs(f - 3) * 0.3
        c.poly([(CX - 2, 0), (CX + 2, 0), (CX + w, 44), (CX - w, 44)], 'y1')
        c.poly([(CX - 1, 0), (CX + 1, 0), (CX + w * 0.5, 44), (CX - w * 0.5, 44)], 'y2')
        c.line([(CX, 0), (CX, 44)], 'y3')
        for i in range(10):
            x = CX + math.sin(i * 1.9 + f) * (2 + i * 0.7)
            c.px(x, (f * 8 + i * 6) % 46, 'y3')
    k = min(1.0, f / 5)
    c.poly([(CX - 26 * k, 52), (CX - 9 * k, 52 - 9 * k), (CX, 52 - 12 * k), (CX + 9 * k, 52 - 9 * k), (CX + 26 * k, 52)], 'y1')
    c.poly([(CX - 19 * k, 52), (CX - 6 * k, 52 - 8 * k), (CX, 52 - 10 * k), (CX + 6 * k, 52 - 8 * k), (CX + 19 * k, 52)], 'y2')
    c.line([(CX - 4 * k, 52 - 9 * k), (CX + 1 * k, 52 - 11 * k)], 'y3')
    c.shockring(CX, 54, 8 + t * 24, 'y2', None, 0.4, 1)
    r = rng(2)
    for i in range(10):
        a = r.uniform(math.pi, math.tau)
        d = (f * 3) * r.uniform(0.5, 1.1)
        c.px(CX + math.cos(a) * d * 1.4, 50 + math.sin(a) * d, 'y3' if i % 2 else 'c3')


# --------------------------------------------------------------------------- 6 되감기
@effect('chronomancer_rewind', 64, 10, 'allAllies', CH)
def _(c, f):
    t = T(f, 10)
    # 반시계로 도는 나선 + 거꾸로 도는 시계 + 위에서 아래로 내려오는 화살표(◀ 모양 두 줄).
    for k in range(3):
        for j in range(30):
            u = j / 29
            a = -(t * math.tau * 2 + u * 9) + k * math.tau / 3
            y = 56 - u * 48
            x = CX + math.cos(a) * (12 + u * 4)
            if math.sin(a) > -0.2:
                c.px(x, y, ['c2', 'c3', 'c4'][k])
                c.px(x, y + 1, 'c1')
    clock(c, CX, 30, 13, -t * 720, -t * 4320, fill=(f % 2 == 0), face='c0', tick='c3')
    for i in range(3):
        y = 8 + ((f * 6 + i * 14) % 44)
        c.poly([(CX + 20, y), (CX + 26, y - 4), (CX + 26, y + 4)], 'y2')
        c.poly([(CX + 27, y), (CX + 33, y - 4), (CX + 33, y + 4)], 'y1')
    c.dring(CX, 30, 21 + (f % 3), 'c3', squash=1.15)
    r = rng(3)
    for i in range(8):
        c.px(CX + r.uniform(-16, 16), 52 - ((f * 6 + i * 9) % 44), 'w' if i % 2 else 'y3')


# --------------------------------------------------------------------------- 7 시간 도약
@effect('chronomancer_skip', 64, 10, 'target', CH)
def _(c, f):
    t = T(f, 10)
    # 문자판이 열리고(원 → 금 톱니 고리), 적 뒤쪽에서 두 줄 베기가 번쩍이며 잔상이 남는다.
    if f <= 4:
        r = 4 + ease(min(1, f / 3)) * 16
        clock(c, CX - 14, CY, r, f * 120, f * 720, fill=True, face='c0', tick='c3', rim='y2', rim2='y1')
    if f in (3, 4, 5):
        c.lens((CX + 22, CY - 18), (CX - 20, CY + 18), 8, ['c1', 'c3', 'w'])
    if f in (4, 5, 6):
        c.lens((CX + 22, CY + 12), (CX - 22, CY - 14), 7, ['c1', 'c3', 'w'])
        c.spark(CX - 20, CY + 18, 5, 'w', 'c3', diag=True)
    if f >= 5:
        u = (f - 5) / 4
        clock(c, CX + 12, CY, 14 - u * 8, 200 + f * 60, 40 + f * 90, fill=False, tick='c2', rim='c3', rim2='c1')
        c.burst(CX, CY, max(3, 10 - u * 6), ['c1', 'c2', 'c3', 'w'], rays=10, long=1.8)
    # 잔상(고스트) 세 겹
    if 2 <= f <= 6:
        for k in range(3):
            c.dring(CX - 22 + k * 8 + f * 2, CY, 11 - k * 2, ['c1', 'c2', 'c3'][k], squash=1.6, parity=k)


# --------------------------------------------------------------------------- 8 월드 스톱
@effect('chronomancer_stop_sky', 128, 12, 'screen', CH)
def _(c, f):
    t = T(f, 12)
    cx, cy = 64, 56
    g = ease(min(1, t * 2.4))
    R = 46 * g
    # 거대한 시계: 금테·청록 문자판·12 눈금·바늘이 12시에서 멈춘다(바늘은 처음에 빠르게 돈다).
    spin = max(0.0, 1 - t * 1.6)
    hd, md = spin * 1440, spin * 8640
    c.ddisc(cx, cy, R, 'c1', parity=f % 2)
    clock(c, cx, cy, R, hd, md, face='c0', rim='y2', rim2='y1', tick='c4', hand_a='y3', hand_b='w', fill=False)
    for i in range(3):
        c.ring(cx, cy, R + 4 + i * 3 + (f % 3), ['c2', 'c1', 'c0'][i], 1)
    for i in range(12):
        a = math.tau * i / 12 - math.pi / 2 + t * 0.5
        x, y = pol(cx, cy, R + 8, a)
        c.gear(x, y, 3, 6, 'y1', 'c0', rot=t) if i % 2 else c.disc(x, y, 2, 'y3')
    if f >= 6:
        # 유리 금이 가고 조각이 어긋난다.
        v = (f - 6) / 5
        for i in range(9):
            a = math.tau * i / 9 + 0.4
            p0 = pol(cx, cy, 4, a)
            p1 = pol(cx, cy, R * (0.5 + 0.7 * ((i * 37) % 5) / 5), a + math.sin(i) * 0.15)
            c.line([p0, p1], 'w' if v < 0.6 else 'c3', 1)
        if v > 0.5:
            for i in range(10):
                a = math.tau * i / 10
                d = R * (0.5 + v)
                x, y = pol(cx, cy, d, a)
                c.poly([(x - 3, y - 1), (x + 2, y - 3), (x + 4, y + 2)], 'c3')
                c.px(x, y, 'w')
    r = rng(4)
    for i in range(14):
        c.px(cx + r.uniform(-56, 56), 6 + ((f * 7 + i * 13) % 100), ['c4', 'y3', 'w'][i % 3])


@effect('chronomancer_stop_hit', 64, 10, 'allTargets', CH)
def _(c, f):
    u = min(1.0, f / 7)
    if f >= 8:
        # 마지막: 결정 고리가 부서져 알갱이로 흩어진다.
        v = (f - 7) / 2
        r0 = rng(11)
        for i in range(16):
            a = r0.uniform(0, math.tau)
            d = 20 + v * 10 * r0.uniform(0.6, 1.3)
            c.diamond(CX + math.cos(a) * d, CY + math.sin(a) * d + v * 4, 1.5, 2, ['c3', 'w', 'y3'][i % 3])
        c.dring(CX, CY, 20 + v * 6, 'c2')
        return
    # 적 몸에 얼어붙는 청록 결정 고리 + 멈춘 시계 + 금빛 사슬 눈금.
    clock(c, CX, CY, 22 - u * 4, 0, 0, fill=(f < 3), face='c0', tick='c3', rim='y2', rim2='y1')
    c.ring(CX, CY, 26 - u * 4, 'c3', 1)
    for i in range(8):
        a = math.tau * i / 8
        h = 10 * ease(min(1, (f + 0.5) / 4))
        p = pol(CX, CY, 24 - u * 2, a)
        tip = pol(CX, CY, 24 - u * 2 + h, a)
        c.poly([tip, pol(p[0], p[1], 3, a + 1.57), pol(p[0], p[1], 3, a - 1.57)], 'c2')
        c.line([p, tip], 'c4')
    c.burst(CX, CY, max(3, 13 - u * 10), ['c1', 'c2', 'c3', 'w'], rays=12, long=1.7) if f <= 5 else None
    r = rng(5)
    for i in range(10):
        a = r.uniform(0, math.tau)
        c.px(CX + math.cos(a) * (10 + u * 18), CY + math.sin(a) * (10 + u * 18), ['w', 'y3', 'c4'][i % 3])
