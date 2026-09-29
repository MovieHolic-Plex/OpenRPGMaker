"""r2w6 b2 미확인 비행체(ufo) 이펙트 11장 — 플라스마·견인 광선·스캔·육각 돔·전파·차원문·운석·모선. PLASMA+VIOLET+STEEL+FIRE."""
import math
import sys

from lib_r2w6 import *

CYAN = dict(u0='#0a2c4a', u1='#1a78b8', u2='#52c8f0', u3='#c0f4ff')


# ---- L1 광선포 -----------------------------------------------------------------------------------------------------
@fx('ufo_ray', 'projectile', 32, 4, pal(PLASMA, WHITE))
def ray(c, f):
    # 초록 플라스마 방울(머리 왼쪽) + 뒤로 늘어진 꼬리 + 둘레의 떨리는 고리
    y = 16
    c.poly([(8, y - 4), (28, y - 1), (28, y + 1), (8, y + 4)], 'n1')
    c.poly([(8, y - 2), (24, y), (8, y + 2)], 'n2')
    c.disc(9, y, 6, 'n1')
    c.disc(9, y, 4, 'n2')
    c.disc(8, y, 2.4, 'n3')
    c.px(7, y - 1, 'n4'); c.px(8, y - 1, 'n4')
    r = 7 + (f % 2)
    c.dring(9, y, r, 'n3', parity=f)
    for k in range(3):
        c.px(18 + k * 4 + (f % 2) * 2, y + (-2 if (k + f) % 2 else 2), 'n3')


@fx('ufo_ray_hit', 'target', 64, 8, pal(PLASMA, SMOKE, WHITE))
def ray_hit(c, f):
    cx, cy = 32, 38
    # 초록 섬광 → 녹아내리는 플라스마 방울 → 김
    if f <= 3:
        r = [10, 18, 22, 18][f]
        c.star(cx, cy, r, ['n1', 'n2', 'n3', 'n4'], pts=8, rot=f * 0.4, inner=0.5)
        if f <= 1:
            c.disc(cx, cy, 4 + f * 2, 'w')
    c.ring(cx, cy, 6 + f * 4, 'n2', 1, 0.9) if f < 6 else None
    c.dring(cx, cy, 8 + f * 4, 'n3', parity=f, squash=0.9)
    if f >= 2:
        for k in range(7):
            a = k * 0.9 + 0.4
            d = 6 + f * 2
            x = cx + math.cos(a) * d
            y = cy + math.sin(a) * d * 0.7 + (f - 2) * 2.5
            c.disc(x, y, 1.5 if k % 2 else 1, 'n2')
            c.px(x, y + 2, 'n1')
    if f >= 4:
        for i in range(3):
            c.smoke(cx - 10 + i * 10, cy - 8 - (f - 4) * 4, 3 + (i % 2), ['q2', 'q3', 'q4'], seed=i + f)


# ---- L3 납치 광선 ---------------------------------------------------------------------------------------------------
@fx('ufo_abduct', 'target', 64, 10, pal(PLASMA, GOLD, WHITE))
def abduct(c, f):
    cx = 32
    # 위에서 빛기둥이 내려오고(0~2) 적이 들린 듯 고리가 위로 흐르며(3~6) 번쩍 내동댕이(7~9)
    top = 2
    bot = [16, 34, 58, 58, 58, 58, 58, 58, 58, 58][f]
    if f <= 7:
        c.poly([(cx - 6, top), (cx + 6, top), (cx + 18, bot), (cx - 18, bot)], 'n1')
        c.poly([(cx - 3, top), (cx + 3, top), (cx + 11, bot), (cx - 11, bot)], 'n2')
        c.ddisc(cx, bot, 18, 'n3', parity=f, squash=0.2)
        for j in range(4):
            y = bot - ((f * 6 + j * 13) % 50)
            w = lerp(6, 18, (y - top) / max(1, bot - top))
            if y > top + 2:
                c.oval(cx, y, w, 2, 'n3', 1)
        for k in range(6):
            x = cx - 10 + k * 4
            y = bot - 4 - ((f * 5 + k * 7) % 40)
            c.px(x, y, 'n4')
    if f >= 7:
        t = f - 7
        c.star(cx, 52, 8 + t * 5, ['y1', 'y2', 'y3', 'w'], pts=8, rot=t)
        c.dring(cx, 56, 10 + t * 8, 'y2', parity=f, squash=0.3)
        c.debris(cx, 50, 8, 10 + t * 5, 'y2', seed=t, rise=1.0)


# ---- L5 정밀 검사 ---------------------------------------------------------------------------------------------------
@fx('ufo_probe', 'target', 64, 8, pal(CYAN, ROSE, WHITE))
def probe(c, f):
    cx, cy = 32, 36
    # 격자 스캔선이 위→아래로 훑고, 조준 원이 좁혀져 붉은 약점 표시가 깜빡인다
    y = 8 + f * 6.5
    c.line([(8, y), (56, y)], 'u2')
    c.line([(8, y + 1), (56, y + 1)], 'u1')
    for gx in range(10, 56, 6):
        c.line([(gx, 8), (gx, y)], 'u1') if gx % 12 == 10 else None
        for gy in range(8, int(y), 6):
            c.px(gx, gy, 'u2')
    r = [26, 22, 18, 14, 11, 9, 9, 9][f]
    c.ring(cx, cy, r, 'u3', 1)
    for a in (0, 90, 180, 270):
        x, y2 = pol(cx, cy, r + 3, math.radians(a))
        x1, y1 = pol(cx, cy, r - 3, math.radians(a))
        c.line([(x, y2), (x1, y1)], 'u3')
    if f >= 5:
        k = 'r2' if f % 2 else 'r1'
        c.diamond(cx, cy, 4, 4, k)
        c.px(cx, cy, 'w')
        c.star(cx + 12, cy - 12, 3, ['r2', 'w'], pts=4) if f == 6 else None


# ---- L7 에너지 돔 ---------------------------------------------------------------------------------------------------
@fx('ufo_dome', 'allAllies', 64, 10, pal(CYAN, PLASMA, WHITE))
def dome(c, f):
    cx, base = 32, 56
    # 바닥에서 육각 격자가 한 줄씩 차올라 반구 돔을 완성하고 표면에 빛이 흐른다
    R = 26
    fill = min(1.0, (f + 1) / 6)
    ytop = base - R * 1.6 * fill
    for row in range(8):
        for col in range(-4, 5):
            hx = cx + col * 7 + (row % 2) * 3.5
            hy = base - 4 - row * 6
            if hy < ytop:
                continue
            u = (hx - cx) / R
            v = (base - hy) / (R * 1.6)
            if u * u + v * v > 1.0:
                continue
            lit = (row + col + f) % 5 == 0
            c.hexagon(hx, hy, 3.6, 'u3' if lit else 'u2')
    c.arc(cx, base, R, 180, 360, 'u1', 1, squash=1.6 * fill if fill > 0.1 else 0.1)
    c.oval(cx, base, R, 3, 'u1', 1)
    if f >= 6:
        a = (f - 6) * 0.7
        x, y = cx + math.cos(math.pi + a) * R * 0.8, base - math.sin(a) * R * 1.2
        c.spark(x, y, 3, 'w', 'u3')
    c.dring(cx, base, R + 4, 'n3', parity=f, squash=0.15)


# ---- L10 정신 왜곡 ---------------------------------------------------------------------------------------------------
@fx('ufo_mind', 'target', 64, 10, pal(VIOLET, PLASMA, WHITE))
def mind(c, f):
    cx, cy = 32, 32
    # 머리 위로 도는 이중 나선 전파 + 퍼지는 물결 고리 + 떠도는 물음표 점
    rot = f * 0.7
    c.spiral(cx, cy, 2, 22, 1.6, rot, 'v1', 2, squash=0.8)
    c.spiral(cx, cy, 2, 22, 1.6, rot + math.pi, 'v2', 2, squash=0.8)
    c.spiral(cx, cy, 2, 18, 1.4, rot + 0.3, 'v3', 1, squash=0.8)
    for j in range(2):
        r = (f * 3 + j * 14) % 28 + 4
        c.dring(cx, cy, r, 'n2' if j else 'v3', parity=f + j, squash=0.8)
    c.disc(cx, cy, 2, 'v4')
    for k in range(3):
        a = rot * 0.5 + k * 2.1
        x, y = cx + math.cos(a) * 22, cy - 10 + math.sin(a) * 8
        c.arc(x, y - 2, 2, 180, 360, 'n3')
        c.px(x + 2, y, 'n3'); c.px(x + 1, y + 1, 'n3'); c.px(x + 1, y + 3, 'n3')


# ---- L12 워프 강습 ---------------------------------------------------------------------------------------------------
def portal(c, cx, cy, r, f, keys=('v1', 'v2', 'v3', 'v4')):
    c.oval(cx, cy, r, r * 0.4, keys[0])
    c.oval(cx, cy, r * 0.75, r * 0.3, keys[1])
    c.oval(cx, cy, r * 0.4, r * 0.16, keys[3])
    for k in range(8):
        a = f * 0.8 + k * 0.785
        c.px(cx + math.cos(a) * (r + 2), cy + math.sin(a) * (r + 2) * 0.4, keys[2])


@fx('ufo_warp', 'user', 64, 8, pal(VIOLET, PLASMA, WHITE))
def warp(c, f):
    # 시전자 둘레로 차원문이 열리고 몸이 빛 줄로 쪼개져 빨려 들어간다
    r = [6, 14, 20, 22, 22, 18, 10, 4][f]
    portal(c, 32, 40, r, f)
    if 2 <= f <= 5:
        for k in range(9):
            x = 16 + k * 4
            L = 10 + (k * 7 + f * 3) % 12
            c.line([(x, 40 - L - (f - 2) * 4), (x, 40 - (f - 2) * 2)], 'v3' if k % 2 else 'n3')
    if f >= 4:
        for k in range(6):
            a = k * 1.05 + f
            d = 24 - (f - 4) * 5
            c.px(32 + math.cos(a) * d, 40 + math.sin(a) * d * 0.5, 'v4')
    if f == 6:
        c.star(32, 40, 6, ['v3', 'w'], pts=6)


@fx('ufo_warp_hit', 'target', 64, 8, pal(VIOLET, PLASMA, WHITE, STEEL))
def warp_hit(c, f):
    # 적 머리 위에 차원문이 열리고 섬광이 내리꽂혀 충격파
    r = [4, 12, 18, 18, 14, 8, 3, 0][f]
    if r:
        portal(c, 32, 10, r, f)
    if 2 <= f <= 4:
        c.rect(28, 12, 36, 50, 'v2'); c.rect(30, 12, 34, 50, 'v4')
        c.star(32, 48, 10 + (f - 2) * 4, ['v2', 'v3', 'v4', 'w'], pts=8, rot=f)
    if f >= 4:
        c.dring(32, 54, 8 + (f - 4) * 7, 'v3', parity=f, squash=0.3)
        c.ring(32, 54, 4 + (f - 4) * 7, 'n3', 1, 0.3)
        c.debris(32, 48, 7, 6 + (f - 4) * 5, 'v3', seed=f, rise=1.0, k2='n3')


# ---- L16 운석 소환 ---------------------------------------------------------------------------------------------------
@fx('ufo_meteor', 'allTargets', 64, 10, pal(FIRE, EARTH, SMOKE, PLASMA, WHITE))
def meteor(c, f):
    # 초록 조준 고리가 찍힌 곳에 오른쪽 위에서 운석 셋이 불꼬리를 끌며 차례로 떨어진다
    spots = [(18, 50, 0), (44, 46, 2), (30, 54, 4)]
    for i, (x, y, d) in enumerate(spots):
        t = f - d
        if t < 0:
            c.ring(x, y, 5, 'n2', 1, 0.4)
            continue
        if t < 2:
            u = (t + 1) / 3
            mx, my = lerp(x + 30, x, u), lerp(y - 50, y, u)
            for k in range(5):
                c.disc(mx + k * 3, my - k * 4, 4 - k * 0.6, ['e4', 'e3', 'e2', 'e1', 'q2'][k])
            c.rock(mx, my, 4, ['d0', 'd1', 'd2'], seed=i)
            c.ring(x, y, 5, 'n3', 1, 0.4)
        elif t < 6:
            s = t - 2
            c.star(x, y - 4, [12, 14, 10, 6][int(s)], ['e1', 'e2', 'e3', 'e4'], pts=9, rot=s)
            c.dring(x, y + 2, 6 + s * 5, 'e3', parity=f, squash=0.3)
            if s >= 1:
                c.smoke(x, y - 10 - s * 3, 5, ['q1', 'q2', 'q3'], seed=i + f)
                c.debris(x, y - 2, 6, 5 + s * 4, 'd2', seed=i, rise=1.2, k2='e3')


# ---- L22 마더쉽 강림 ------------------------------------------------------------------------------------------------
@fx('ufo_mothership', 'screen', 128, 12, pal(STEEL, PLASMA, CYAN, GOLD, WHITE))
def mothership(c, f):
    # 거대한 원반이 위에서 내려오고(0~3) 아래 창이 차례로 켜지며(4~6) 초록 광선 기둥이 땅을 태운다(7~11)
    cy = [6, 18, 30, 38, 42, 42, 42, 42, 42, 42, 42, 42][f]
    cx = 64
    if f >= 3:
        cy += (f % 2)  # 떠 있는 동안 1px 흔들림
    c.oval(cx, cy + 2, 50, 11, 's0')
    c.oval(cx, cy, 48, 9, 's1')
    c.oval(cx, cy - 2, 42, 6, 's2')
    c.line([(cx - 36, cy - 5), (cx + 36, cy - 5)], 's3')
    c.oval(cx, cy - 10, 20, 9, 'u1')
    c.oval(cx - 4, cy - 12, 12, 5, 'u2')
    c.px(cx - 10, cy - 14, 'u3')
    if 3 <= f <= 6:  # 강림 직후 아래로 퍼지는 파동
        c.dring(cx, cy + 10, 20 + (f - 3) * 14, 'n3', parity=f, squash=0.3)
    lights = 11
    on = max(0, f - 3) * 3
    for i in range(lights):
        x = cx - 40 + i * 8
        lit = i < on and (i + f) % 3 != 0
        c.rect(x - 1, cy + 3, x + 1, cy + 5, 'n3' if lit else 's0')
    if f >= 6:
        t = f - 6
        w = [4, 10, 16, 18, 18, 14][t]
        for j, bx in enumerate((40, 64, 88)):
            if t < j:
                continue
            ww = w * (1.0 if j == 1 else 0.7)
            c.poly([(bx - ww * 0.5, cy + 8), (bx + ww * 0.5, cy + 8), (bx + ww, 100), (bx - ww, 100)], 'n1')
            c.poly([(bx - ww * 0.25, cy + 8), (bx + ww * 0.25, cy + 8), (bx + ww * 0.5, 100), (bx - ww * 0.5, 100)], 'n2')
            c.line([(bx, cy + 8), (bx, 100)], 'n4')
            c.star(bx, 98, 10 + (f % 3) * 3, ['n2', 'n3', 'n4', 'w'], pts=9, rot=f + j)
            c.dring(bx, 100, 12 + t * 3, 'n3', parity=f, squash=0.25)
    if f >= 8:
        for i in range(5):
            c.smoke(28 + i * 18, 92 - (f - 8) * 5, 6, ['s1', 's2', 's3'], seed=i + f)
    for k in range(10):
        c.px(10 + k * 12, 60 + (f * 9 + k * 13) % 50, 'y3' if k % 2 else 'n4')


@fx('ufo_mothership_hit', 'target', 64, 8, pal(PLASMA, SMOKE, WHITE))
def mothership_hit(c, f):
    cx = 32
    w = [3, 8, 13, 14, 14, 12, 7, 3][f]
    c.poly([(cx - w * 0.6, 0), (cx + w * 0.6, 0), (cx + w, 58), (cx - w, 58)], 'n1')
    c.poly([(cx - w * 0.3, 0), (cx + w * 0.3, 0), (cx + w * 0.5, 58), (cx - w * 0.5, 58)], 'n2')
    c.line([(cx, 0), (cx, 58)], 'n4')
    if f >= 1:
        c.star(cx, 54, 8 + (f % 3) * 3, ['n2', 'n3', 'n4', 'w'], pts=8, rot=f)
        c.dring(cx, 57, 8 + f * 3, 'n3', parity=f, squash=0.25)
    if f >= 4:
        for i in range(3):
            c.smoke(cx - 14 + i * 14, 40 - (f - 4) * 5, 4, ['q2', 'q3', 'q4'], seed=i + f)


if __name__ == '__main__':
    keys = sys.argv[1:] or None
    sys.exit(1 if run_module(sys.modules[__name__], 'vehicles-7', 48, keys, 'ufo') else 0)

