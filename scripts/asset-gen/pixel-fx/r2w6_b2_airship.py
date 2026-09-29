"""r2w6 b2 비공정(airship, 용머리 비공정) 이펙트 10장 — 예광탄·급강하·화염·집속탄·바람·포효·뇌운·용. FIRE+SMOKE+WIND+GOLD+VIOLET."""
import math
import sys

from lib_r2w6 import *

TEAL = dict(c0='#0e3a44', c1='#1e7a86', c2='#48b8b8', c3='#a8f0e8')
BOLT = dict(b0='#2a2a6a', b1='#6a6ae0', b2='#b8c8ff', b3='#f8fcff')


def pop(c, x, y, t, s=1.0):
    """작은 폭발 t 0..4."""
    if t < 0 or t >= 4:
        return
    if t < 1:
        c.star(x, y, 6 * s, ['e3', 'e4', 'w'], pts=7)
    elif t < 2.2:
        c.star(x, y, 9 * s, ['e1', 'e2', 'e3', 'e4'], pts=8, rot=t)
    else:
        c.smoke(x, y - (t - 2) * 3, 5 * s, ['q1', 'q2', 'q3'], seed=int(x + y))


# ---- L1 기총 소사 ------------------------------------------------------------------------------------------------
@fx('airship_tracer', 'projectile', 32, 4, pal(FIRE, GOLD, WHITE))
def tracer(c, f):
    # 예광탄 세 줄기가 왼쪽 아래로 비스듬히 날아간다(머리가 왼쪽)
    for j, (y, o) in enumerate(((9, 0), (16, 3), (23, 1))):
        x = 3 + (o + f * 2) % 5
        c.line([(x, y), (x + 12, y - 3)], 'e2')
        c.line([(x, y), (x + 7, y - 2)], 'e3')
        c.line([(x, y), (x + 2, y - 1)], 'w')
        c.px(x + 14 + (f % 2), y - 4, 'y2')


@fx('airship_gun_hit', 'target', 64, 8, pal(FIRE, SMOKE, GOLD, EARTH, WHITE))
def gun_hit(c, f):
    # 위 오른쪽에서 내리꽂히는 탄 자국이 적의 몸을 가로질러 줄지어 터진다
    for i in range(7):
        x = 50 - i * 6
        y = 30 + (i % 2) * 8 + i * 2
        t = f - i * 0.6
        if -0.8 < t < 0:
            c.line([(x + 14, y - 20), (x + 2, y - 3)], 'e3')
        pop(c, x, y, t * 1.3, 0.8)
    for k in range(4):
        c.px(8 + k * 14, 58 - (f * 3 + k * 4) % 10, 'd3')
    c.dring(32, 56, 8 + f * 3, 'd3', parity=f, squash=0.25)


# ---- L3 급강하 --------------------------------------------------------------------------------------------------
@fx('airship_dive', 'target', 64, 8, pal(TEAL, WIND, WHITE, FIRE))
def dive(c, f):
    # 위 오른쪽에서 곤두박질치는 바람 궤적 → 발톱 세 줄 베기 → 흩날리는 깃털 바람
    if f <= 2:
        for k in range(5):
            x0 = 62 - f * 10 + k * 3
            c.line([(x0, 2 + k * 2), (x0 - 18 - f * 6, 22 + f * 8 + k * 2)], 'k2' if k % 2 else 'k1')
    if 2 <= f <= 5:
        u = min(1, (f - 1) / 2.5)
        for j in range(3):
            x0, y0 = 46 + j * 5, 16 + j * 3
            x1, y1 = 16 + j * 5, 52 + j * 3
            xe, ye = lerp(x0, x1, u), lerp(y0, y1, u)
            c.line([(x0, y0), (xe, ye)], 'c1', 3)
            c.line([(x0, y0), (xe, ye)], 'c3')
            c.px(xe, ye, 'w')
    if f >= 3:
        c.star(30, 36, 8 + (f - 3) * 2 if f < 6 else 6, ['c2', 'c3', 'w'], pts=8, rot=f)
    if f >= 4:
        for k in range(8):
            a = k * 0.8 + f * 0.3
            d = 8 + (f - 4) * 6
            c.line([(30 + math.cos(a) * d, 36 + math.sin(a) * d * 0.7), (30 + math.cos(a) * (d + 3), 36 + math.sin(a) * (d + 3) * 0.7)], 'k2')
    c.dring(32, 57, 6 + f * 3, 'k1', parity=f, squash=0.25)


# ---- L5 화염 숨결 ------------------------------------------------------------------------------------------------
@fx('airship_flame', 'allTargets', 64, 10, pal(FIRE, SMOKE, WHITE))
def flame(c, f):
    # 오른쪽 위에서 부채꼴로 쏟아지는 불길이 바닥을 휩쓸고 불이 붙는다
    reach = min(1.0, f / 4)
    for i in range(14):
        u = i / 13
        if u > reach:
            break
        x = 62 - u * 58
        y = 18 + u * 30 + math.sin(u * 7 + f) * 3
        r = 3 + u * 7
        c.disc(x, y, r, 'e1')
        c.disc(x + 1, y - 1, r * 0.7, 'e2')
        c.disc(x + 1, y - 1, r * 0.4, 'e3')
    if f <= 6:
        c.line([(63, 16), (40, 30)], 'e4', 2)
    if f >= 3:
        for i, x in enumerate((10, 22, 34, 46)):
            h = 10 + ((f + i * 3) % 4) * 3 - max(0, f - 7) * 3
            if h > 2:
                c.flame(x, 58, h, 4, ['e1', 'e2', 'e3', 'e4'], seed=i + f, tongues=2)
    if f >= 6:
        for i in range(3):
            c.smoke(14 + i * 18, 34 - (f - 6) * 4, 5, ['q1', 'q2', 'q3'], seed=i + f)
    for k in range(6):
        c.px(6 + k * 10, 54 - (f * 5 + k * 7) % 36, 'e4')


# ---- L7 집속탄 폭격 -----------------------------------------------------------------------------------------------
@fx('airship_cluster', 'allTargets', 64, 10, pal(STEEL, FIRE, SMOKE, WHITE))
def cluster(c, f):
    # 큰 폭탄이 떨어지다 공중에서 쪼개져 자탄 다섯 개가 퍼지고 바닥에서 연쇄 폭발
    if f <= 1:
        y = 4 + f * 8
        c.oval(32, y, 3, 5, 's1'); c.oval(31, y - 1, 2, 3, 's2'); c.rect(30, y - 8, 34, y - 6, 's0')
    subs = [(10, 50), (22, 44), (32, 52), (42, 44), (54, 50)]
    for i, (x, y) in enumerate(subs):
        if 2 <= f:
            t = f - 2 - i * 0.35
            if t < 1.6:
                u = max(0, t) / 1.6
                sx, sy = lerp(32, x, u), lerp(14, y - 4, u * u)
                c.disc(sx, sy, 1.5, 's1'); c.px(sx, sy - 1, 's3')
                if f == 2:
                    c.star(32, 14, 6, ['e3', 'w'], pts=6)
            else:
                pop(c, x, y, (t - 1.6) * 1.1, 0.9)
    c.dring(32, 57, 10 + f * 2, 'e3', parity=f, squash=0.22)


# ---- L10 날개 돌풍 -------------------------------------------------------------------------------------------------
@fx('airship_gale', 'allTargets', 64, 10, pal(WIND, TEAL, WHITE))
def gale(c, f):
    # 초승달 바람 칼날 세 장이 오른쪽에서 왼쪽으로 겹쳐 날아가며 벤다
    for j in range(3):
        t = f - j * 1.5
        if 0 <= t < 6:
            x = 60 - t * 10
            y = 26 + j * 10
            c.arc(x, y, 12, 110, 250, 'k0', 3)
            c.arc(x + 1, y, 11, 115, 245, 'k2', 2)
            c.arc(x + 2, y, 10, 125, 235, 'k3', 1)
            for k in range(3):
                c.line([(x + 6 + k * 4, y - 6 + k * 6), (x + 14 + k * 4, y - 6 + k * 6)], 'k1')
    for k in range(10):
        a = f * 0.4 + k * 0.63
        c.px(32 + math.cos(a) * (18 + k % 3 * 4), 38 + math.sin(a) * 14, 'k2' if k % 2 else 'c3')
    if f >= 4:
        c.dring(32, 40, 10 + (f - 4) * 4, 'k3', parity=f, squash=0.7)


# ---- L12 용의 포효 --------------------------------------------------------------------------------------------------
@fx('airship_roar', 'allAllies', 64, 8, pal(GOLD, FIRE, TEAL, WHITE))
def roar(c, f):
    cx, cy = 32, 34
    # 포효의 동심 파동(금빛)이 퍼지고 위로 화살표 기세가 솟는다
    for j in range(3):
        r = (f * 4 + j * 9) % 30 + 4
        c.ring(cx, cy, r, 'y1' if r > 20 else 'y2', 1, 0.8)
        if r < 26:
            c.dring(cx, cy, r + 2, 'y3', parity=f + j, squash=0.8)
    c.star(cx, cy, 4 + f % 2 * 2, ['y2', 'y3', 'w'], pts=6, rot=f)
    for i, x in enumerate((14, 50, 24, 40)):
        y = 50 - ((f * 5 + i * 9) % 30)
        c.chevrons(x, y, 2, 3, 3, 'e3' if i % 2 else 'y2')
    c.dring(cx, 56, 12 + f * 1.5, 'y2', parity=f, squash=0.25)


# ---- L16 뇌운 --------------------------------------------------------------------------------------------------------
@fx('airship_storm', 'allTargets', 64, 10, pal(SMOKE, BOLT, WHITE))
def storm(c, f):
    # 먹구름이 몰려와 번개 세 가닥이 번갈아 내리꽂힌다
    grow = min(1, (f + 1) / 3)
    for i, x in enumerate((12, 26, 40, 52)):
        c.cloud(x, 10, 7 * grow + 2, ['q0', 'q1', 'q2'], seed=i, parity=f)
    strikes = {3: 16, 4: 16, 5: 40, 6: 40, 7: 28, 8: 28}
    if f in strikes:
        x = strikes[f]
        c.bolt((x, 12), (x + 2, 56), f // 2, ['b1', 'b2', 'b3'], segs=6, jitter=5)
        if f % 2 == 1:
            c.star(x + 2, 56, 7, ['b2', 'b3', 'w'], pts=7)
            c.ddisc(32, 34, 28, 'b0', parity=f, squash=0.7)
    if f >= 3:
        for k in range(10):
            x = 4 + k * 6.3
            y = 18 + (f * 7 + k * 5) % 38
            c.line([(x, y), (x - 1, y + 3)], 'q3')
    c.dring(32, 57, 18, 'b2', parity=f, squash=0.2)


# ---- L22 용왕 강림 ---------------------------------------------------------------------------------------------------
@fx('airship_dragon', 'screen', 128, 12, pal(TEAL, FIRE, GOLD, SMOKE, WHITE))
def dragon(c, f):
    # 거대한 용이 오른쪽에서 몸을 물결치며 들어와 머리를 들고 화면 왼쪽으로 불을 토한다
    hx = [124, 112, 100, 90, 80, 76, 76, 76, 78, 82, 90, 100][f]
    hy = 50 + math.sin(f * 0.6) * 3
    # 몸통(비늘 띠): 머리 뒤로 사인 곡선
    for s in range(26, -1, -1):
        x = hx + 10 + s * 5
        y = hy + 6 + math.sin(s * 0.45 - f * 0.8) * 10
        r = 9 - s * 0.22
        if r < 2:
            continue
        c.disc(x, y, r, 'c0')
        c.disc(x - 0.5, y - 1, r - 1.5, 'c1')
        c.disc(x - 1, y - r * 0.4, max(1, r * 0.35), 'c2')
        if s % 3 == 0:
            c.poly([(x - 2, y - r), (x, y - r - 5), (x + 2, y - r)], 'y2')
    # 날개(한 장, 퍼덕임)
    wy = [-24, -16, -30][f % 3]
    wx = hx + 30
    c.poly([(wx, hy), (wx + 12, hy + wy), (wx + 34, hy + wy - 4), (wx + 26, hy - 2)], 'c1')
    c.line([(wx, hy), (wx + 12, hy + wy), (wx + 34, hy + wy - 4)], 'c3')
    # 머리
    c.oval(hx + 6, hy, 11, 8, 'c0'); c.oval(hx + 5, hy - 1, 9, 6, 'c1')
    c.poly([(hx - 12, hy + 1), (hx - 2, hy - 4), (hx - 2, hy + 6)], 'c1')
    mouth = 4 if f >= 5 else 1
    c.poly([(hx - 12, hy + 2 + mouth), (hx - 2, hy + 3), (hx - 2, hy + 8 + mouth)], 'c0')
    c.poly([(hx + 6, hy - 7), (hx + 14, hy - 15), (hx + 12, hy - 5)], 'y2')
    c.px(hx + 2, hy - 3, 'e4'); c.px(hx + 3, hy - 3, 'e3')
    # 불길: 입에서 왼쪽 아래로 부채꼴
    if f >= 5:
        reach = min(1, (f - 4) / 3)
        for i in range(18):
            u = i / 17
            if u > reach:
                break
            x = hx - 12 - u * 80
            y = hy + 4 + u * 34 + math.sin(u * 8 + f) * 4
            r = 3 + u * 13
            c.disc(x, y, r, 'e1'); c.disc(x + 1, y - 1, r * 0.7, 'e2'); c.disc(x + 1, y - 1, r * 0.4, 'e3')
        c.line([(hx - 12, hy + 4), (hx - 40, hy + 16)], 'e4', 3)
    if f >= 8:
        for i in range(4):
            c.smoke(16 + i * 18, 70 - (f - 8) * 6, 8, ['q1', 'q2', 'q3'], seed=i + f)
    for k in range(12):
        c.px(8 + k * 10, 110 - (f * 7 + k * 9) % 70, 'e4' if k % 2 else 'y2')


@fx('airship_dragon_hit', 'target', 64, 8, pal(FIRE, SMOKE, GOLD, WHITE))
def dragon_hit(c, f):
    cx = 32
    for i, x in enumerate((14, 24, 34, 44, 52)):
        h = [6, 16, 26, 30, 26, 20, 12, 6][f] * (0.7 + 0.3 * ((i + 1) % 2))
        c.flame(x, 58, h, 5, ['e0', 'e1', 'e2', 'e3', 'e4'], seed=i + f, sway=math.sin(f + i) * 0.1, tongues=2)
    if f <= 2:
        c.star(cx, 40, 10 + f * 4, ['e2', 'e3', 'e4', 'w'], pts=9, rot=f)
    if f >= 4:
        for i in range(3):
            c.smoke(18 + i * 14, 26 - (f - 4) * 4, 5, ['q1', 'q2', 'q3'], seed=i + f)
    c.dring(cx, 57, 10 + f * 3, 'e3', parity=f, squash=0.25)


if __name__ == '__main__':
    keys = sys.argv[1:] or None
    sys.exit(1 if run_module(sys.modules[__name__], 'vehicles-6', 64, keys, 'airship') else 0)

