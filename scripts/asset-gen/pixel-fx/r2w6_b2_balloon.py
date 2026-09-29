"""r2w6 b2 열기구(balloon) 이펙트 10장 — 폭탄 투하·정찰의 지원. 붉은 천(ROSE)+불(FIRE)+연기(SMOKE)+꽃종이(CONFETTI)+바람(WIND)."""
import math
import sys

from lib_r2w6 import *

CONF = dict(p0='#ff5a7a', p1='#ffd84a', p2='#5ad0ff', p3='#7aff8a', p4='#c88aff')


def bomb(c, x, y, r=4, lit=True):
    c.disc(x, y, r, 's0'); c.disc(x - .5, y - .5, r - 1, 's1'); c.px(x - r * .5, y - r * .5, 's3')
    c.line([(x + r * .7, y - r), (x + r, y - r - 3)], 't2')
    if lit:
        c.px(x + r, y - r - 4, 'e4'); c.px(x + r + 1, y - r - 4, 'e3'); c.px(x + r, y - r - 5, 'e3')


# ---- L1 폭탄 투하 -------------------------------------------------------------------------------------------
@fx('balloon_bomb', 'target', 64, 10, pal(STEEL, WOOD, FIRE, SMOKE, WHITE))
def bomb_drop(c, f):
    cx, cy = 32, 40
    if f <= 3:
        y = lerp(4, cy - 4, f / 3.0)
        # 낙하 꼬리
        for k in range(1, 4):
            c.px(cx + (k % 2), y - 6 - k * 3, 'q3')
        bomb(c, cx, y, 5, True)
    if f >= 4:
        r = [0, 0, 0, 0, 10, 24, 30, 26, 18, 10][f]
        c.star(cx, cy, r, ['e0', 'e1', 'e2', 'e3', 'e4'], pts=11, rot=f * 0.3, inner=0.55)
        c.dring(cx, cy + 8, 10 + (f - 4) * 6, 'w', parity=f, squash=0.35)
        c.dring(cx, cy + 8, 14 + (f - 4) * 6, 'e3', parity=f + 1, squash=0.35)
    if f >= 6:  # 버섯구름
        h = (f - 6) * 5
        c.column(cx, cy + 6, 12 + h, 3, ['q1', 'q2', 'q3'])
        c.smoke(cx, cy - 6 - h, 9 + (f - 6), ['q1', 'q2', 'q3', 'q4'], seed=1)
        c.smoke(cx - 9, cy - h + 2, 6, ['q1', 'q2', 'q3', 'q4'], seed=2)
        c.smoke(cx + 9, cy - h + 2, 6, ['q1', 'q2', 'q3', 'q4'], seed=3)
    for k in range(8):
        if f >= 4:
            a = k * 0.78
            rr = (f - 3) * 5 + k
            c.px(cx + math.cos(a) * rr * 1.2, cy + math.sin(a) * rr * 0.9, 's3' if k % 2 else 'e3')


# ---- L3 정찰 비행 --------------------------------------------------------------------------------------------
@fx('balloon_scout', 'user', 64, 8, pal(WIND, GOLD, WHITE, WATER))
def scout(c, f):
    cx, cy = 32, 30
    # 몸 위로 둥글게 퍼지는 시야 원(눈금 포함)과 위로 솟는 화살촉
    r = 10 + f * 2.5
    c.dring(cx, cy, r, 'k2', parity=f, squash=0.85)
    c.ring(cx, cy, 8 + (f % 4) * 2, 'y2', 1, 0.85)
    for a in range(0, 360, 45):
        rr0, rr1 = 12, 15 if a % 90 == 0 else 13
        x0, y0 = cx + math.cos(math.radians(a + f * 8)) * rr0, cy + math.sin(math.radians(a + f * 8)) * rr0 * 0.85
        x1, y1 = cx + math.cos(math.radians(a + f * 8)) * rr1, cy + math.sin(math.radians(a + f * 8)) * rr1 * 0.85
        c.line([(x0, y0), (x1, y1)], 'y3')
    # 망원경 반짝임
    sx = cx + 14 - f
    c.spark(sx, cy - 12 + (f % 3), 3 if f % 2 else 2, 'w', 'y3')
    for i, x in enumerate((14, 32, 50)):
        c.chevrons(x, 52 - ((f * 5 + i * 7) % 38), 3, 5, 4, 'k3')
    # 눈 문양(감시)
    if f >= 3:
        ey = 12
        c.poly([(cx - 9, ey), (cx, ey - 5), (cx + 9, ey), (cx, ey + 5)], 'y1')
        c.poly([(cx - 7, ey), (cx, ey - 3), (cx + 7, ey), (cx, ey + 3)], 'w')
        c.disc(cx + ((f % 3) - 1), ey, 2, 'a1'); c.px(cx, ey - 1, 'w')


# ---- L5 신호탄 ------------------------------------------------------------------------------------------------
@fx('balloon_flare', 'allTargets', 64, 8, pal(FIRE, GOLD, SMOKE, WHITE))
def flare(c, f):
    cx = 32
    # 하늘에서 터진 신호탄이 낙하산 불빛으로 천천히 내려오며 눈부시게 빛난다
    y = lerp(18, 30, min(1.0, f / 7.0))
    glow = [6, 10, 14, 17, 18, 17, 14, 10][f]
    c.ddisc(cx, y, glow + 6, 'e1', parity=f)
    c.oval(cx, y, glow, glow, 'e2')
    c.oval(cx, y, glow * 0.7, glow * 0.7, 'e3')
    c.oval(cx, y, glow * 0.4, glow * 0.4, 'e4')
    c.px(cx, y, 'w')
    for k in range(8):  # 별 광선
        a = k * math.pi / 4 + f * 0.2
        L = glow + 6 + (k % 2) * 6
        c.line([(cx + math.cos(a) * (glow * 0.5), y + math.sin(a) * glow * 0.5), (cx + math.cos(a) * L, y + math.sin(a) * L)], 'y3' if k % 2 else 'e4')
    # 연기 꼬리(올라간 궤적)
    for i in range(6):
        c.smoke(cx + math.sin(i + f * 0.3) * 2, y - 8 - i * 6, 2.5, ['q1', 'q2', 'q3'], seed=i)
    # 아래 바닥에 번지는 붉은 조명
    c.dring(cx, 52, 8 + f * 3, 'e2', parity=f, squash=0.3)
    c.dring(cx, 52, 4 + f * 3, 'e3', parity=f + 1, squash=0.3)
    for k in range(7):
        c.px(6 + k * 9, 56 - ((f * 3 + k * 5) % 18), 'e3')


# ---- L7 모래주머니 ---------------------------------------------------------------------------------------------
@fx('balloon_sandbag', 'projectile', 32, 4, pal(EARTH, WOOD, SMOKE))
def sandbag(c, f):
    x, y = 12, 16
    ang = f * 0.5
    dx = math.sin(ang) * 1.5
    c.poly([(x - 8, y - 2 + dx), (x - 4, y - 7), (x + 5, y - 7), (x + 9, y - 2 - dx), (x + 8, y + 6), (x - 7, y + 6)], 'd1')
    c.poly([(x - 8, y - 2 + dx), (x - 4, y - 7), (x + 1, y - 7), (x - 2, y + 4), (x - 7, y + 6)], 'd2')
    c.line([(x - 4, y - 7), (x + 5, y - 7)], 'd3')
    c.rect(x - 3, y - 9, x + 3, y - 7, 't2'); c.line([(x - 3, y - 9), (x + 3, y - 9)], 't3')  # 묶은 목
    c.line([(x - 5, y - 1), (x + 6, y - 1)], 'd0'); c.line([(x - 6, y + 3), (x + 7, y + 3)], 'd0')
    for k in range(6):  # 새는 모래
        c.px(x + 10 + k * 2 + (f % 2), y + 1 + (k % 3) - 1, 'd3' if k % 2 else 'd2')
    c.px(x + 12, y - 4, 'q3'); c.px(x + 14 + f % 2, y - 5, 'q2')


@fx('balloon_sandbag_hit', 'target', 64, 8, pal(EARTH, SMOKE, WHITE, GOLD))
def sandbag_hit(c, f):
    cx, cy = 32, 40
    if f <= 2:
        c.star(cx, cy, 8 + f * 5, ['d1', 'd2', 'd3', 'w'], pts=9, rot=f)
    # 모래 폭발: 사방으로 퍼지는 모래 뭉치와 알갱이 호
    spread = 4 + f * 3.2
    for i in range(7):
        a = i * 0.9 + 0.3
        px_, py_ = cx + math.cos(a) * spread * 1.1, cy - 2 + math.sin(a) * spread * 0.55 - f * 1.2
        c.smoke(px_, py_, 5 + (i % 3) * 1.5 - f * 0.2, ['d1', 'd2', 'd3'], seed=i + f // 2)
    c.smoke(cx, cy - 4 - f, 7, ['d1', 'd2', 'd3'], seed=99)
    for k in range(14):
        a = k * 0.45 + f * 0.3
        rr = (f + 1) * 3.4 + (k % 3) * 3
        c.disc(cx + math.cos(a) * rr * 1.2, cy + math.sin(a) * rr * 0.7 - f * 1.5 + (rr * 0.02) * f * f, 1, 'd3' if k % 2 else 'd2')
    # 어질어질 별
    if f >= 3:
        for k in range(3):
            a = f * 0.9 + k * 2.09
            c.spark(cx + math.cos(a) * 12, cy - 18 + math.sin(a) * 4, 2, 'y3', 'y2')


# ---- L10 상승기류 -----------------------------------------------------------------------------------------------
@fx('balloon_updraft', 'allAllies', 64, 10, pal(WIND, FIRE, WHITE, SMOKE))
def updraft(c, f):
    # 발밑에서 위로 솟는 뜨거운 바람 기둥: 물결치는 세로 곡선과 위로 뜨는 깃털
    for i, x0 in enumerate((14, 24, 34, 44, 52)):
        for w, k in ((3, 'k0'), (2, 'k1'), (1, 'k2')):
            pts = []
            for y in range(56, 2, -2):
                ph = (56 - y) * 0.22 - f * 0.9 + i * 1.3
                pts.append((x0 + math.sin(ph) * (3 + (56 - y) * 0.06), y))
            c.line(pts, k, w)
    for k in range(9):
        x = 8 + k * 6 + (k % 2) * 2
        y = 54 - ((f * 6 + k * 9) % 52)
        c.px(x, y, 'k3'); c.px(x + 1, y + 1, 'w')
    for i, x in enumerate((16, 32, 48)):
        c.chevrons(x, 46 - ((f * 5 + i * 8) % 36), 3, 6, 5, 'w')
    c.dring(32, 56, 10 + f * 2.5, 'e3', parity=f, squash=0.25)
    c.dring(32, 56, 5 + f * 2.5, 'e2', parity=f + 1, squash=0.25)


# ---- L12 축포 ---------------------------------------------------------------------------------------------------
@fx('balloon_confetti', 'allAllies', 64, 10, pal(CONF, GOLD, WHITE, PLASMA))
def confetti(c, f):
    cx = 32
    # 하늘에서 터진 축포: 꽃종이 조각이 팔랑이며 내려오고 초록 회복 십자가가 오른다
    r = rng(5)
    burst_t = min(1.0, f / 3.0)
    for i in range(38):
        a = r.uniform(0, math.tau)
        sp = r.uniform(8, 28)
        col = 'p%d' % (i % 5)
        x = cx + math.cos(a) * sp * burst_t
        y = 8 + math.sin(a) * sp * burst_t * 0.7 + max(0, f - 2) * (2.2 + r.random() * 1.6) + (f * f * 0.12 if f > 3 else 0)
        x += math.sin(f * 0.9 + i) * (2 if f > 3 else 0)
        if 0 <= y < 62:
            if i % 3 == 0:
                c.rect(x, y, x + 1, y + 2, col)
            elif i % 3 == 1:
                c.rect(x, y, x + 2, y + 1, col)
            else:
                c.px(x, y, col); c.px(x + 1, y + 1, col)
    if f <= 3:
        c.star(cx, 8, 10 + f * 3, ['y1', 'y2', 'y3', 'w'], pts=10, rot=f)
    for i, x in enumerate((16, 32, 48)):
        y = 52 - ((f * 5 + i * 9) % 44)
        c.plus(x, y, 3, 'n3', 'w')
    c.dring(cx, 55, 8 + f * 3, 'n2', parity=f, squash=0.3)


# ---- L16 융단 폭격 ----------------------------------------------------------------------------------------------
@fx('balloon_carpet', 'allTargets', 64, 10, pal(STEEL, FIRE, SMOKE, WHITE, WOOD))
def carpet(c, f):
    # 폭탄이 줄줄이 떨어져 왼→오른쪽으로 연쇄 폭발한다
    slots = [(10, 48), (22, 40), (34, 50), (46, 42), (56, 48), (16, 30), (40, 30), (28, 20)]
    for i, (x, y) in enumerate(slots):
        t = f - i * 0.75
        if -1.6 <= t < 0:
            u = (t + 1.6) / 1.6
            yy = lerp(-6, y, u)
            bomb(c, x, yy, 3, True)
        elif 0 <= t < 1.0:
            c.star(x, y, 5, ['e2', 'e3', 'e4'], pts=7)
        elif 1.0 <= t < 2.3:
            c.star(x, y, 12, ['e0', 'e1', 'e2', 'e3', 'e4'], pts=9, rot=i)
            c.dring(x, y + 6, 12, 'e3', parity=i, squash=0.4)
        elif 2.3 <= t < 4.2:
            c.smoke(x, y - (t - 2.3) * 3, 6, ['q1', 'q2', 'q3', 'q4'], seed=i)
    for k in range(6):
        c.px(6 + k * 10, 58 - ((f * 4 + k * 6) % 10), 'q3')


# ---- L22 낙하 대폭발 ----------------------------------------------------------------------------------------------
@fx('balloon_crash', 'screen', 128, 12, pal(ROSE, FIRE, SMOKE, WHITE, STEEL))
def crash(c, f):
    cx, cy = 64, 92
    if f <= 4:
        # 붉은 기구가 곤두박질: 위에서 아래로 기울어 떨어지는 물방울꼴 천과 바구니
        t = f / 4.0
        x, y = lerp(92, cx, t), lerp(24, cy - 12, t * t) + math.sin(t * 6) * 2
        ang = lerp(-0.5, 0.0, t)
        c.oval(x, y - 6, 15, 17, 'r1')
        c.oval(x - 3, y - 8, 9, 12, 'r2')
        for j in (-10, -5, 0, 5, 10):
            c.line([(x + j * 0.9, y - 22), (x + j * 0.5, y + 8)], 'r0')
        c.poly([(x - 5, y + 10), (x + 5, y + 10), (x + 4, y + 15), (x - 4, y + 15)], 'q1')
        for k in range(1, 6):  # 낙하 궤적 불꽃
            c.flame(x + 2 + k * 3, y - 14 - k * 6, 8 - k, 3, ['e1', 'e2', 'e3'], seed=k + f, tongues=1)
    else:
        u = f - 4
        r = [0, 14, 28, 40, 46, 44, 40, 34][u]
        c.star(cx, cy, r, ['e0', 'e1', 'e2', 'e3', 'e4'], pts=13, rot=u * 0.25, inner=0.6)
        c.dring(cx, cy + 6, 14 + u * 9, 'w', parity=u, squash=0.4)
        c.dring(cx, cy + 6, 20 + u * 9, 'e3', parity=u + 1, squash=0.4)
        if u >= 2:  # 버섯구름
            h = (u - 2) * 9
            c.column(cx, cy + 4, 24 + h, 6, ['q1', 'q2', 'q3'])
            c.smoke(cx, cy - 26 - h, 17 + u, ['q1', 'q2', 'q3', 'q4'], seed=1)
            c.smoke(cx - 17, cy - 18 - h * 0.8, 11, ['q1', 'q2', 'q3', 'q4'], seed=2)
            c.smoke(cx + 17, cy - 18 - h * 0.8, 11, ['q1', 'q2', 'q3', 'q4'], seed=3)
        for k in range(14):  # 붉은 천 파편
            a = k * 0.45 + 0.2
            rr = 10 + u * 8 + k
            c.poly([(cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.7 - u * 2), (cx + math.cos(a) * rr + 3, cy + math.sin(a) * rr * 0.7 - u * 2 + 1), (cx + math.cos(a) * rr + 1, cy + math.sin(a) * rr * 0.7 - u * 2 + 4)], 'r2' if k % 2 else 'r1')


@fx('balloon_crash_hit', 'target', 64, 8, pal(FIRE, SMOKE, STEEL, WHITE, ROSE))
def crash_hit(c, f):
    cx, cy = 32, 38
    r = [10, 22, 30, 28, 22, 16, 10, 6][f]
    c.star(cx, cy, r, ['e0', 'e1', 'e2', 'e3', 'e4'], pts=11, rot=f * 0.3, inner=0.58)
    c.dring(cx, cy + 6, 10 + f * 6, 'w', parity=f, squash=0.4)
    if f >= 2:
        c.smoke(cx, cy - 10 - (f - 2) * 4, 8 + f, ['q1', 'q2', 'q3', 'q4'], seed=f)
        c.smoke(cx - 12, cy - 4 - (f - 2) * 3, 6, ['q1', 'q2', 'q3', 'q4'], seed=f + 3)
        c.smoke(cx + 12, cy - 4 - (f - 2) * 3, 6, ['q1', 'q2', 'q3', 'q4'], seed=f + 6)
    for k in range(10):
        a = k * 0.63 + 0.3
        rr = 6 + f * 5
        c.px(cx + math.cos(a) * rr * 1.2, cy + math.sin(a) * rr * 0.8, 'r2' if k % 2 else 's3')


if __name__ == '__main__':
    keys = sys.argv[1:] or None
    sys.exit(1 if run_module(sys.modules[__name__], 'vehicles-3', 48, keys, 'balloon') else 0)
