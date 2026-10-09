"""r2w6 b2 굴착기(drill) 이펙트 10장 — 관통·지반 계열의 물리. 강철(STEEL)+흙(EARTH)+불꽃(FIRE)+용암(MAGMA)+달궈진 쇠(HEAT)."""
import math
import sys

from lib_r2w6 import *

MAGMA = dict(m0='#4a0e10', m1='#a81e14', m2='#ee5a14', m3='#ffb030', m4='#fff090')
HEAT = dict(h0='#5a1a14', h1='#c8401c', h2='#ff8a30', h3='#ffe070')


def bit(c, x, y, length, ang, r0, keys, phase=0, blur=False):
    """나선 드릴 촉: 밑(뿌리) 반지름 r0, 끝에서 length 만큼 ang 방향. keys 어두움→밝음(3개)."""
    ux, uy = math.cos(ang), math.sin(ang)
    vx, vy = -uy, ux
    steps = int(length * 1.6)
    for s in range(steps + 1):
        t = s / steps
        w = r0 * (1 - t) ** 0.9
        bx, by = x + ux * length * t, y + uy * length * t
        for k in range(-int(w) - 1, int(w) + 2):
            if abs(k) > w + 0.4:
                continue
            band = int((t * length + k * 0.8 + phase * 2.5) // 3) % 2
            v = k / max(w, 0.6)
            key = keys[2] if (band and v < 0.35) else (keys[1] if v < 0.5 else keys[0])
            if blur:
                key = keys[1 + (s + k + phase) % 2]
            c.px(bx + vx * k, by + vy * k, key)
    c.line([(x + ux * length, y + uy * length)] * 2, keys[2])


# ---- L1 관통 굴착 -----------------------------------------------------------------------------------------------
@fx('drill_bore', 'target', 64, 8, pal(STEEL, EARTH, FIRE, WHITE))
def bore(c, f):
    cx, cy = 32, 38
    tip = [62, 48, 34, 27, 25, 30, 40, 52][f]
    bit(c, tip, cy, 34, 0.0, 12, ['s1', 's2', 's4'], phase=f, blur=f in (2, 3, 4))
    c.poly([(tip + 32, cy - 13), (tip + 40, cy - 13), (tip + 40, cy + 13), (tip + 32, cy + 13)], 's1')
    if 2 <= f <= 5:
        # 관통: 뒤로 뿜는 흙과 불꽃, 몸에 뚫린 구멍의 균열
        for k in range(10):
            a = 2.6 + k * 0.32
            r = (f - 1) * 6 + k * 1.2
            c.disc(tip + 2 + math.cos(a) * r, cy + math.sin(a) * r * 0.8, 1.5 if k % 3 == 0 else 1, 'd2' if k % 2 else 'd3')
        c.star(tip - 2, cy, 8 + (f - 2) * 3, ['e2', 'e3', 'e4', 'w'], pts=8, rot=f)
        for k in range(6):
            a = 3.1 + (k - 2.5) * 0.35
            c.line([(tip - 4, cy), (tip - 4 + math.cos(a) * (12 + f * 3), cy + math.sin(a) * (10 + f * 2))], 's4')
    if f >= 5:
        c.dring(cx - 4, cy, 6 + (f - 5) * 8, 'w', parity=f, squash=0.9)
    for k in range(6):
        c.px(2 + k * 10, 58 - ((f * 3 + k * 5) % 8), 'd2')


# ---- L3 지반 붕괴 -------------------------------------------------------------------------------------------------
@fx('drill_shock', 'target', 64, 8, pal(STEEL, EARTH, FIRE, WHITE))
def shock(c, f):
    cx, cy = 32, 50
    # 드릴이 땅을 연달아 찍는다: 균열이 방사형으로 뻗고 흙기둥이 솟는다
    reach = [4, 10, 16, 22, 26, 28, 28, 28][f]
    r = rng(3)
    for i in range(9):
        a = math.pi + (i - 4) * 0.42 + r.uniform(-.1, .1)
        pts = [(cx, cy)]
        for s in range(1, 6):
            rr = reach * s / 5.0
            pts.append((cx + math.cos(a) * rr * 1.1 + r.uniform(-2, 2), cy + math.sin(a) * rr * 0.55 * (-1 if i % 2 else 1) + r.uniform(-1, 1)))
        c.line(pts, 'd0', 2)
        c.line(pts, 'd1')
    for i, dx in enumerate((-18, -8, 2, 12, 22)):
        h = max(0, [0, 8, 18, 24, 20, 12, 6, 2][f] - abs(dx) * 0.4 + ((i * 5) % 4))
        c.column(cx + dx, cy + 4, h, 4, ['d1', 'd2', 'd3'])
        if h > 12:
            c.rock(cx + dx, cy - h + 2, 3, ['d1', 'd2', 'd3'], seed=i + f)
    if f in (1, 2):
        c.star(cx, cy - 4, 10 + f * 4, ['e2', 'e3', 'e4', 'w'], pts=9, rot=f)
    if f >= 2:
        c.dring(cx, cy + 2, 6 + (f - 2) * 8, 'd3', parity=f, squash=0.3)
    for k in range(8):
        a = k * 0.8
        c.disc(cx + math.cos(a) * (8 + f * 3), cy - 6 - ((f * 5 + k * 3) % 16), 1, 'd3' if k % 2 else 'd2')
    # 위에서 내려찍는 드릴 끝
    if f <= 2:
        y = 8 + f * 16
        bit(c, cx, y + 20, 20, -math.pi / 2, 7, ['s1', 's2', 's4'], phase=f)
        c.rect(cx - 8, y - 6, cx + 8, y - 1, 's1') if False else None


# ---- L5 낙석 --------------------------------------------------------------------------------------------------------
@fx('drill_rockfall', 'allTargets', 64, 10, pal(EARTH, SMOKE, FIRE, WHITE))
def rockfall(c, f):
    r = rng(21)
    rocks = [(r.uniform(8, 56), r.uniform(28, 54), r.uniform(4, 7), r.uniform(0, 3.5)) for _ in range(9)]
    rocks += [(32, 46, 5, 2.4), (16, 40, 5, 3.0)]
    for i, (x, y, s, t0) in enumerate(rocks):
        t = f - t0
        if -1.4 <= t < 0:
            u = (t + 1.4) / 1.4
            yy = lerp(-8, y - 4, u * u)
            c.line([(x + 1, yy - 12), (x + 1, yy - 4)], 'q3')
            c.rock(x, yy, s, ['d1', 'd2', 'd3'], seed=i)
        elif 0 <= t < 1.0:
            c.rock(x, y - 2, s, ['d1', 'd2', 'd3'], seed=i)
            c.star(x, y + 2, s + 3, ['e2', 'e3', 'w'], pts=7, rot=i)
        elif 1.0 <= t < 3.0:
            c.rock(x, y - 2, s - (t - 1) * 1.2, ['d1', 'd2', 'd3'], seed=i)
            c.smoke(x + 3, y - (t - 1) * 3, 4, ['q1', 'q2', 'q3'], seed=i)
            for k in range(4):
                a = k * 1.6
                c.px(x + math.cos(a) * (3 + (t - 1) * 5), y + math.sin(a) * 2 - (t - 1) * 2, 'd3')
        elif 3.0 <= t < 8.0:
            c.smoke(x, y - 6 - (t - 3) * 2.4, max(1.5, 5 - (t - 3) * 0.6), ['q1', 'q2', 'q3'], seed=i)
            if t < 6:
                c.disc(x + math.sin(i + t) * 4, y - 2 - (t - 3), 1, 'd2')
    if f <= 2:  # 천장에서 떨어지는 흙먼지
        for k in range(9):
            c.px(6 + k * 6, (f * 6 + k * 4) % 20, 'd2' if k % 2 else 'd3')


# ---- L7 회전 돌격 ---------------------------------------------------------------------------------------------------
@fx('drill_spin', 'allTargets', 64, 10, pal(STEEL, EARTH, FIRE, WHITE))
def spin(c, f):
    cx, cy = 32, 38
    # 회전하는 드릴이 원을 그리며 지나간 자리에 나선 호와 불꽃
    a0 = f * 0.95
    for arm, (k, w) in enumerate((('s1', 3), ('s2', 2), ('s4', 1))):
        pts = [(cx + math.cos(a) * (24 - (a0 - a) * 1.2), cy + math.sin(a) * (16 - (a0 - a) * 0.8)) for a in [a0 - i * 0.12 for i in range(0, 20)]]
        c.line(pts, k, w)
    hx, hy = cx + math.cos(a0) * 24, cy + math.sin(a0) * 16
    bit(c, hx, hy, 14, a0 + math.pi * 0.5 + 0.4, 5, ['s1', 's2', 's4'], phase=f)
    for i in range(12):
        a = a0 - i * 0.3
        rr = 22 + (i % 3) * 2
        c.px(cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.66, 'e3' if i % 2 else 'e4')
    c.dring(cx, cy, 14 + f * 1.5, 'd3', parity=f, squash=0.66)
    if f >= 3:
        c.star(cx, cy, 6 + (f % 3) * 3, ['e2', 'e3', 'e4', 'w'], pts=8, rot=a0)
    for k in range(7):
        a = a0 * 1.5 + k * 0.9
        c.disc(cx + math.cos(a) * (18 + (f % 4) * 2), cy + math.sin(a) * 12, 1, 'd2' if k % 2 else 'd3')


# ---- L10 땅속 잠행(시전자 발밑에서 사라짐) ---------------------------------------------------------------------------
@fx('drill_tunnel', 'user', 64, 8, pal(STEEL, EARTH, FIRE, WHITE, SMOKE))
def tunnel(c, f):
    cx = 32
    # 발밑 땅이 소용돌이치며 열리고 몸이 흙 속으로 잠긴다: 흙 소용돌이와 드릴 바닥 나선
    ground = 56
    open_r = min(20, 6 + f * 3)
    c.oval(cx, ground, open_r, open_r * 0.35, 'd0')
    c.oval(cx, ground, open_r * 0.6, open_r * 0.2, 'q0') if f >= 2 else None
    for arm in range(3):
        c.spiral(cx, ground, 2, open_r + 4, 1.0, f * 0.9 + arm * 2.09, 'd2', 2, squash=0.35)
        c.spiral(cx, ground, 2, open_r + 4, 1.0, f * 0.9 + arm * 2.09 + 0.15, 'd3', 1, squash=0.35)
    for k in range(9):
        a = f * 0.7 + k * 0.7
        rr = open_r * (0.4 + ((k * 3 + f) % 7) / 8.0)
        yy = ground - (f * 4 + k * 5) % 26
        c.disc(cx + math.cos(a) * rr, yy, 1.5 if k % 3 == 0 else 1, 'd3' if k % 2 else 'd2')
    for i in range(3):
        rise = (f * 5 + i * 8) % 24
        c.smoke(cx - 12 + i * 12, ground - 4 - rise, 3 + (i % 2), ['d1', 'd2', 'd3'], seed=i * 3 + f)
    if f >= 3:
        c.star(cx, ground - 6, 6 + (f % 3) * 2, ['e2', 'e3', 'e4'], pts=7, rot=f)
    c.dring(cx, ground, open_r + 8, 'd3', parity=f, squash=0.3)


@fx('drill_emerge', 'target', 64, 8, pal(STEEL, EARTH, FIRE, WHITE))
def emerge(c, f):
    cx, cy = 32, 52
    # 적의 발밑에서 드릴이 솟구친다: 흙기둥 + 드릴 촉 + 흩어지는 바위
    h = [4, 12, 26, 38, 40, 30, 16, 6][f]
    c.column(cx, cy + 2, h, 11, ['d1', 'd2', 'd3'])
    if f >= 1:
        bit(c, cx, cy - h + 4, min(32, h + 6), -math.pi / 2, 8, ['s1', 's2', 's4'], phase=f, blur=f in (2, 3))
    if f in (2, 3):
        c.star(cx, cy - h + 6, 12 + f * 2, ['e2', 'e3', 'e4', 'w'], pts=9, rot=f)
    for i, dx in enumerate((-20, -12, 12, 20, -6, 6)):
        rise = [0, 6, 14, 22, 24, 18, 10, 2][f] + (i % 3) * 3
        if f >= 1:
            c.rock(cx + dx * (0.7 + f * 0.08), cy - rise, 3 + (i % 2), ['d1', 'd2', 'd3'], seed=i)
    c.dring(cx, cy + 4, 6 + f * 4, 'd3', parity=f, squash=0.3)
    c.dring(cx, cy + 4, 2 + f * 4, 'w', parity=f + 1, squash=0.3)


# ---- L12 드릴 달구기 ---------------------------------------------------------------------------------------------------
@fx('drill_temper', 'user', 64, 8, pal(HEAT, STEEL, FIRE, WHITE))
def temper(c, f):
    cx, cy = 32, 36
    # 몸 둘레를 감싸는 달궈진 쇠의 붉은 후광과 위로 치솟는 불꽃 혀, 반짝이는 불똥
    glow = 18 + (f % 4) * 2
    c.ddisc(cx, cy, glow + 6, 'h1', parity=f, squash=0.85)
    c.ddisc(cx, cy, glow, 'h2', parity=f + 1, squash=0.85)
    for i, x0 in enumerate((14, 22, 30, 38, 46)):
        hh = 10 + ((f + i * 2) % 5) * 4
        c.flame(x0 + 2, 54, hh, 4, ['h0', 'h1', 'h2', 'h3'], seed=i * 7 + f, sway=(i - 2) * 0.05, tongues=2)
    # 달궈진 강철 띠가 몸을 감고 돈다
    for k, (rad, ph) in enumerate(((22, 0), (17, 2))):
        for i in range(24):
            a = f * 0.55 * (1 if k == 0 else -1) + i * 0.2 + ph
            c.px(cx + math.cos(a) * rad, cy + 6 + math.sin(a) * rad * 0.3, 'h3' if i % 4 == 0 else 'h2')
    for k in range(9):
        c.px(6 + k * 6.5, 58 - ((f * 5 + k * 7) % 46), 'e4' if k % 2 else 'e3')
    c.spark(cx - 16, cy - 14, 2 + (f % 2), 'w', 'h3'); c.spark(cx + 17, cy - 8, 2 + ((f + 1) % 2), 'w', 'h3')
    c.dring(cx, 55, 10 + f * 2, 'h3', parity=f, squash=0.28)


# ---- L16 마그마 굴착 ----------------------------------------------------------------------------------------------------
@fx('drill_magma', 'target', 64, 10, pal(MAGMA, EARTH, STEEL, WHITE))
def magma(c, f):
    cx, cy = 32, 54
    # 균열이 갈라지며 용암이 분수처럼 솟는다: 갈라진 땅 + 용암 기둥 + 튀는 용암 덩이
    if f <= 2:
        w = 6 + f * 8
        c.oval(cx, cy, w, 3 + f, 'm1')
        c.line([(cx - w - 6, cy), (cx + w + 6, cy)], 'd0', 2)
    h = [0, 0, 10, 24, 38, 44, 40, 30, 18, 8][f]
    if f >= 2:
        c.oval(cx, cy, 20, 4, 'm0'); c.oval(cx, cy, 16, 3, 'm1'); c.oval(cx, cy, 10, 2, 'm2')
        c.column(cx, cy + 1, h, 9, ['m1', 'm2', 'm3', 'm4'], wob=math.sin(f) * 1.5)
        for i, dx in enumerate((-16, -10, 10, 16)):
            hh = h * (0.5 + 0.2 * (i % 2))
            c.column(cx + dx, cy + 1, hh, 4, ['m1', 'm2', 'm3'])
    for k in range(10):  # 튀는 용암 덩이(포물선)
        if f >= 3:
            a = -1.0 - k * 0.24
            t = (f - 2) * 1.3 - k * 0.15
            if t > 0:
                x = cx + math.cos(a) * 22 * t * 0.9
                y = cy + math.sin(a) * 26 * t + 5 * t * t
                if y < cy + 4:
                    c.disc(x, y, 2 if k % 3 == 0 else 1, 'm3' if k % 2 else 'm4')
    if f >= 3:
        c.star(cx, cy - h + 4, 8 + (f % 3) * 3, ['m2', 'm3', 'm4', 'w'], pts=8, rot=f)
    for i in range(3):
        if f >= 5:
            c.smoke(cx - 12 + i * 12, cy - h - 4 - (f - 5) * 2, 5, ['q1', 'q2', 'q3'], seed=i + f)
    c.dring(cx, cy + 4, 8 + f * 3, 'm3', parity=f, squash=0.3)


# ---- L22 지핵 관통 -----------------------------------------------------------------------------------------------------
@fx('drill_core', 'screen', 128, 12, pal(MAGMA, STEEL, EARTH, SMOKE, WHITE))
def core(c, f):
    cx = 64
    # 위에서 거대한 드릴이 지면을 뚫고 내려꽂힌다 → 지각 단면이 갈라지며 마그마 핵이 드러난다
    ground = 92
    if f <= 6:
        depth = lerp(4, 96, ease(f / 6.0))
        bit(c, cx, depth - 60, 74, math.pi / 2, 20, ['s1', 's2', 's4'], phase=f, blur=f in (3, 4, 5))
        c.rect(cx - 20, depth - 74, cx + 20, depth - 60, 's1'); c.line([(cx - 20, depth - 74), (cx + 20, depth - 74)], 's3')
    # 지면 균열과 솟는 용암
    if f >= 3:
        r = rng(9)
        reach = min(58, (f - 2) * 11)
        for i in range(9):
            a = math.pi + (i - 4) * 0.4
            pts = [(cx, ground)]
            for s in range(1, 7):
                rr = reach * s / 6.0
                pts.append((cx + math.cos(a) * rr * 1.25 + r.uniform(-3, 3), ground + math.sin(a) * rr * 0.34 * (1 if i % 2 else -1) + r.uniform(-1, 1)))
            c.line(pts, 'd0', 3)
            c.line(pts, 'm2', 1)
        c.oval(cx, ground, 26, 6, 'm1'); c.oval(cx, ground, 18, 4, 'm2'); c.oval(cx, ground, 10, 2, 'm3')
    if f >= 5:
        h = [0, 0, 0, 0, 0, 26, 58, 76, 70, 52, 30, 14][f]
        c.column(cx, ground + 2, h, 15, ['m1', 'm2', 'm3', 'm4'], wob=math.sin(f) * 2)
        for i, dx in enumerate((-34, -22, 22, 34)):
            c.column(cx + dx, ground + 2, h * (0.4 + 0.15 * (i % 2)), 6, ['m1', 'm2', 'm3'])
        c.star(cx, ground - h + 6, 14 + (f % 3) * 4, ['m2', 'm3', 'm4', 'w'], pts=10, rot=f)
    if f >= 7:
        for k in range(16):
            a = -0.9 - k * 0.12
            t = (f - 6) * 1.1 - k * 0.07
            if t > 0:
                x = cx + math.cos(a) * 60 * t
                y = ground + math.sin(a) * 66 * t + 12 * t * t
                if y < ground + 6:
                    c.disc(x, y, 3 if k % 3 == 0 else 2, 'm3' if k % 2 else 'm4')
    if f >= 8:
        for i in range(4):
            c.smoke(24 + i * 26, ground - 40 - (f - 8) * 4, 12, ['q1', 'q2', 'q3'], seed=i + f)
    if f >= 5:
        c.dring(cx, ground + 4, 20 + (f - 5) * 12, 'm3', parity=f, squash=0.22)


@fx('drill_core_hit', 'target', 64, 8, pal(MAGMA, STEEL, EARTH, SMOKE, WHITE))
def core_hit(c, f):
    cx, cy = 32, 52
    h = [8, 26, 44, 50, 44, 34, 22, 10][f]
    c.oval(cx, cy, 18, 4, 'm1'); c.oval(cx, cy, 12, 3, 'm2')
    c.column(cx, cy + 2, h, 11, ['m1', 'm2', 'm3', 'm4'], wob=math.sin(f * 1.3) * 1.5)
    c.star(cx, cy - h + 4, 8 + (f % 3) * 3 if f >= 1 else 6, ['m2', 'm3', 'm4', 'w'], pts=8, rot=f)
    for k in range(9):
        a = -0.9 - k * 0.28
        t = f * 0.9 - k * 0.12
        if t > 0:
            x = cx + math.cos(a) * 18 * t
            y = cy + math.sin(a) * 22 * t + 4 * t * t
            if y < cy + 4:
                c.disc(x, y, 2 if k % 3 == 0 else 1, 'm3' if k % 2 else 'm4')
    c.dring(cx, cy + 4, 6 + f * 4, 'm3', parity=f, squash=0.3)


if __name__ == '__main__':
    keys = sys.argv[1:] or None
    sys.exit(1 if run_module(sys.modules[__name__], 'vehicles-4', 48, keys, 'drill') else 0)
