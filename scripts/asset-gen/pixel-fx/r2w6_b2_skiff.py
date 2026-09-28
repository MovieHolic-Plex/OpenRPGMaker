"""r2w6 b2 쪽배(skiff) 이펙트 10장 — 작살·물살의 원거리 직업. 물빛(WATER)+나무(WOOD)+쇠(STEEL)."""
import math
import sys

from lib_r2w6 import *

P_WOOD = pal(WOOD, STEEL, WATER, WHITE)


# ---- L1 작살 던지기 -------------------------------------------------------------------------------------
@fx('skiff_harpoon', 'projectile', 32, 4, pal(WOOD, STEEL, WATER))
def harpoon(c, f):
    y = 16
    rope = [(31, y + 3 * math.sin(f * 1.7 + i * 0.8)) for i in range(0)]
    pts = [(27 + i * 1.0, y + 2.6 * math.sin(f * 1.6 + i * 0.9) * (i / 4)) for i in range(5)]
    c.line(pts, 't3')
    c.line([(12, y), (27, y)], 't1', 2)
    c.line([(12, y - 1), (26, y - 1)], 't2')
    for x in (16, 21, 25):
        c.px(x, y + 1, 't0')
    # 쇠 작살촉(왼쪽 끝)과 미늘
    c.poly([(1, y), (11, y - 3), (11, y + 3)], 's2')
    c.poly([(3, y), (11, y - 3), (11, y - 1)], 's3')
    c.line([(3, y + 1), (11, y + 3)], 's1')
    c.poly([(9, y - 3), (14, y - 6), (11, y - 1)], 's2')
    c.poly([(9, y + 3), (14, y + 6), (11, y + 1)], 's1')
    c.px(2, y, 's4')
    if f in (0, 2):
        c.spark(5, y - 1, 2, 's4')
    # 뒤로 흩날리는 물방울
    for k in range(4):
        x = 15 + ((f * 5 + k * 6) % 16)
        c.px(x, y + 5 + (k % 2) * 3, 'a3' if k % 2 else 'a4')
    c.px(20 - f, y - 5, 'a3')


# ---- L1 작살 명중 ----------------------------------------------------------------------------------------
@fx('skiff_harpoon_hit', 'target', 64, 8, pal(WOOD, STEEL, WATER, WHITE))
def harpoon_hit(c, f):
    cx, cy = 32, 36
    if f <= 1:
        c.star(cx, cy - 2, 14 - f * 4, ['a2', 'a3', 'a4', 'w'], pts=9, rot=f * 0.3)
    # 밧줄이 팽팽한 작살(오른쪽 위에서 꽂힘)
    if f <= 5:
        tx, ty = 56, 8
        c.line([(cx, cy), (tx, ty)], 't1', 2)
        c.line([(cx + 1, cy - 1), (tx + 1, ty - 1)], 't2')
        v = math.sin(f * 2.4) * (3 - f * 0.5)
        c.line([(tx, ty), (63, ty - 3 + v)], 't3')
        c.poly([(cx - 5, cy + 4), (cx + 3, cy - 4), (cx + 1, cy + 2)], 's3')
        c.poly([(cx - 5, cy + 4), (cx + 3, cy - 4), (cx + 3, cy + 1)], 's2')
        c.px(cx - 4, cy + 3, 's4')
    # 물 왕관과 물결
    c.crown(cx, cy + 12, 17, 24, ['a2', 'a3', 'a4'], min(1.0, (f + 1) / 6) if f < 6 else 0.9 - (f - 5) * 0.4, n=9)
    for k in range(3):
        r = 5 + f * 4 - k * 5
        if r > 2:
            c.ripple(cx, cy + 16, r, ['a4', 'a3', 'a2'][k], squash=0.34, parity=k)
    if f >= 3:
        for k in range(6):
            c.px(cx - 16 + k * 6 + (f % 2) * 2, cy + 10 + ((f * 5 + k * 3) % 10), 'a4')


# ---- L3 뱃머리 돌진(물살 가르기) ------------------------------------------------------------------------------
@fx('skiff_wake', 'target', 64, 8, pal(WATER, WHITE))
def wake(c, f):
    slashes = [((54, 8), (12, 52), -11, 0), ((10, 10), (54, 50), 11, 2), ((4, 36), (60, 32), -7, 4)]
    for (p0, p1, bulge, s) in slashes:
        if s <= f <= s + 3:
            fr = ease((f - s + 1) / 2.0) if f - s < 2 else 1.0
            keys = ['a1', 'a2', 'a3', 'a4'] if f - s < 2 else ['a1', 'a2', 'a3']
            th = 10 if f - s < 2 else 6
            c.blade(p0, p1, bulge, th, keys, frac=fr)
    if f >= 3:
        c.star(32, 32, 6 + (f - 3) * 3, ['a2', 'a3', 'a4', 'w'], pts=8, rot=f) if f < 6 else None
    for k in range(7):
        a = k * 0.9 + f * 0.5
        r = 6 + f * 3.2
        if f >= 2:
            c.px(32 + math.cos(a) * r, 34 + math.sin(a) * r * 0.75, 'a4' if k % 2 else 'a3')
    if f >= 4:
        c.ripple(32, 50, 6 + (f - 4) * 7, 'a3', squash=0.3)
        c.ripple(32, 50, 2 + (f - 4) * 5, 'a4', squash=0.3, parity=1)


# ---- L5 투망 ---------------------------------------------------------------------------------------------
def net(c, cx, cy, rx, ry, rings=3, spokes=8, rot=0.0, weights=True, key='t3', knot='t2'):
    for r in range(1, rings + 1):
        c.ring(cx, cy, max(1, rx * r / rings), key, 1, ry / max(rx, 1))
    for s in range(spokes):
        a = rot + s * math.tau / spokes
        c.line([(cx, cy), (cx + math.cos(a) * rx, cy + math.sin(a) * ry)], key)
    for r in range(1, rings + 1):
        for s in range(spokes):
            a = rot + s * math.tau / spokes
            c.px(cx + math.cos(a) * rx * r / rings, cy + math.sin(a) * ry * r / rings, knot)
    if weights:
        for s in range(spokes):
            a = rot + s * math.tau / spokes
            c.disc(cx + math.cos(a) * rx, cy + math.sin(a) * ry, 1.5, 's2')
            c.px(cx + math.cos(a) * rx - 1, cy + math.sin(a) * ry - 1, 's4')


@fx('skiff_net', 'target', 64, 10, pal(WOOD, STEEL, WATER, GOLD, WHITE))
def netfx(c, f):
    plan = [(46, 14, 5, 3), (40, 18, 12, 7), (34, 24, 22, 13), (32, 30, 27, 16), (32, 36, 27, 15), (32, 37, 22, 13),
            (32, 38, 17, 12), (32, 38, 12, 10), (32, 38, 9, 9), (32, 38, 8, 8)]
    cx, cy, rx, ry = plan[f]
    net(c, cx, cy, rx, ry, rings=3 if rx > 8 else 2, spokes=8, rot=f * 0.13, weights=rx > 6)
    if f >= 6:  # 조여드는 줄
        c.line([(cx - rx, cy), (cx, cy - ry - 3), (cx + rx, cy)], 't2')
    if f >= 5:
        for k in range(5):
            a = k * 1.3 + f
            c.px(32 + math.cos(a) * 14, 40 + math.sin(a) * 6, 'a3')
    if f >= 8:
        for i, (x, y) in enumerate(((20, 22), (44, 24), (32, 12), (24, 44), (42, 46))):
            c.spark(x, y, 2 if (i + f) % 2 else 1, 'y3', 'y2')
    if f <= 3:
        c.line([(cx + rx, cy - ry), (cx + rx + 6, cy - ry - 8)], 't3')  # 던진 줄


# ---- L7 소용돌이 -------------------------------------------------------------------------------------------
@fx('skiff_whirlpool', 'allTargets', 64, 10, pal(WATER, WHITE))
def whirlpool(c, f):
    cx, cy = 32, 44
    grow = min(1.0, (f + 2) / 5) if f < 7 else max(0.2, 1 - (f - 6) * 0.3)
    for i, (k, w) in enumerate((('a1', 3), ('a2', 2), ('a3', 1))):
        for arm in range(3):
            c.spiral(cx, cy, 2, 26 * grow, 1.1, f * 0.9 + arm * 2.1 + i * 0.12, k, w, squash=0.42)
    c.ring(cx, cy, 26 * grow, 'a1', 1, 0.42)
    c.dring(cx, cy, 20 * grow, 'a3', parity=f, squash=0.42)
    # 빨려드는 물방울과 거품
    for k in range(8):
        a = f * 0.9 + k * 0.8
        r = (26 - (f * 2 + k * 3) % 24) * grow
        c.px(cx + math.cos(a) * r, cy + math.sin(a) * r * 0.42, 'a4')
    c.disc(cx, cy, 3, 'a0')
    if 3 <= f <= 7:  # 솟는 물기둥
        c.column(cx, cy, 10 + (f - 3) * 4, 5, ['a1', 'a2', 'a3'])
    for k in range(3):
        c.px(cx - 8 + k * 8, cy - 14 - ((f * 4 + k * 5) % 14), 'a4')


# ---- L10 갈고리 낚시 ---------------------------------------------------------------------------------------
@fx('skiff_hook', 'target', 64, 8, pal(WOOD, STEEL, WATER, GOLD, WHITE))
def hookfx(c, f):
    if f <= 2:
        hx, hy = 46, 12 + f * 9
    elif f == 3:
        hx, hy = 38, 38
    else:
        hx, hy = 38 + (f - 3) * 5, 38 - (f - 3) * 7
    # 줄
    c.line([(50 if f < 4 else hx + 8, 0), (hx + 1, hy - 8)], 't3')
    c.ring(hx + 1, hy - 9, 2, 's3', 1)
    # 갈고리 J 자
    c.arc(hx, hy, 8, 20, 250, 's2', 3)
    c.arc(hx, hy, 8, 40, 200, 's3', 1)
    c.poly([(hx - 8, hy - 1), (hx - 12, hy - 5), (hx - 6, hy - 6)], 's3')
    c.px(hx - 10, hy - 4, 's4')
    c.line([(hx + 1, hy - 8), (hx + 1, hy - 3)], 's2', 2)
    if f == 3:
        c.star(hx - 6, hy - 4, 10, ['y1', 'y2', 'y3', 's4'], pts=7)
    if f >= 4:
        for k in range(3):
            c.line([(hx + 4 + k * 3, hy + 6 + k * 4), (hx + 10 + k * 4, hy + 2 + k * 4)], 's3')
        for k in range(5):
            c.px(hx - 10 + k * 5, hy + 8 + (f * 3 + k * 2) % 8, 'a3')
    if f >= 3:
        c.ripple(34, 52, 5 + (f - 3) * 5, 'a3', squash=0.3)
        c.ripple(34, 52, 2 + (f - 3) * 4, 'a4', squash=0.3, parity=1)


# ---- L12 순풍 ----------------------------------------------------------------------------------------------
@fx('skiff_wind', 'user', 64, 8, pal(WIND, WATER, WHITE, WOOD))
def wind(c, f):
    cx, cy = 32, 34
    for arm in range(3):
        for i, (k, w) in enumerate((('k0', 3), ('k1', 2), ('k2', 1))):
            c.spiral(cx, cy + 6, 6, 26, 1.0, f * 0.85 + arm * 2.09 + i * 0.1, k, w, squash=0.9)
    for k in range(6):
        a = f * 0.85 + k * 1.05
        r = 24 - (f * 3 + k * 4) % 20
        c.px(cx + math.cos(a) * r, cy + 6 + math.sin(a) * r * 0.9, 'k3')
    # 위로 뜨는 화살표(속도 상승)
    for x in (16, 48):
        c.chevrons(x, 46 - (f * 4) % 24, 3, 6, 4, 'k3')
    # 순풍을 받은 작은 돛
    if 1 <= f <= 6:
        bulge = 3 + (f % 3)
        c.poly([(30, 8), (30 - bulge - 7, 22), (30, 24)], 'w')
        c.line([(30, 6), (30, 26)], 't2')
        c.line([(30 - bulge - 7, 22), (30, 24)], 'k1')
    c.dring(cx, 52, 12 + f * 2, 'a3', parity=f, squash=0.3)


# ---- L16 해일 ----------------------------------------------------------------------------------------------
@fx('skiff_wave', 'allTargets', 64, 10, pal(WATER, WHITE))
def tsunami(c, f):
    base = 58
    H = [8, 14, 20, 27, 33, 36, 30, 20, 11, 5][f]
    curl = 0.0 if f < 4 else (0.5 if f < 6 else 1.0)
    top_pts = []
    for x in range(1, 63):
        u = (x - 1) / 61
        yy = base - H * (0.55 + 0.45 * math.sin(u * math.pi)) + math.sin(u * 8 + f * 1.4) * 1.5
        yy -= curl * max(0.0, math.sin((u - 0.35) * math.pi * 1.3)) * 5
        top_pts.append((x, yy))
    c.poly(top_pts + [(62, base), (1, base)], 'a1')
    mid = [(x, y + 3) for x, y in top_pts]
    c.poly(mid + [(62, base), (1, base)], 'a2')
    hi = [(x, y + 8 + math.sin(x * 0.5 + f) * 1.4) for x, y in top_pts]
    c.poly(hi + [(62, base), (1, base)], 'a3')
    for x, y in top_pts:
        xi = int(x)
        if (xi + f) % 3 != 0:
            c.px(x, y, 'a4')
        if (xi + f) % 2 == 0:
            c.px(x, y + 1, 'w')
    if f >= 5:
        for k in range(10):
            xs = 6 + k * 6
            c.px(xs, top_pts[xs - 1][1] - 2 - ((f * 3 + k * 5) % 9), 'a4')
    c.dring(32, base + 1, 28 - f, 'a3', parity=f, squash=0.15)


# ---- L22 심해의 왕 ------------------------------------------------------------------------------------------
def whale(c, cx, cy, ang, L, W, jaw=0.0):
    """고래 실루엣. 머리가 ang 방향(라디안, 화면 좌표), 길이 L, 두께 W."""
    ca, sa = math.cos(ang), math.sin(ang)

    def tr(u, v):  # u: 머리(0)→꼬리(1) 방향이 아니라 꼬리 기준 좌표: 길이축 a
        a = (0.5 - u) * L
        return (cx + a * ca - v * sa, cy + a * sa + v * ca)
    N = 26
    top, bot = [], []
    for i in range(N + 1):
        u = i / N
        hw = W * min(1.0, (u * 7) ** 0.5) * (1 - u) ** 0.62
        top.append(tr(u, -hw))
        bot.append(tr(u, hw))
    c.poly(top + bot[::-1], 'a0')
    inner_t = [tr(i / N, -W * min(1.0, ((i / N) * 7) ** 0.5) * (1 - i / N) ** 0.62 * 0.78) for i in range(N + 1)]
    inner_b = [tr(i / N, W * min(1.0, ((i / N) * 7) ** 0.5) * (1 - i / N) ** 0.62 * 0.78) for i in range(N + 1)]
    c.poly(inner_t + inner_b[::-1], 'a1')
    belly = [tr(i / N, W * min(1.0, ((i / N) * 7) ** 0.5) * (1 - i / N) ** 0.62 * 0.15) for i in range(2, int(N * 0.72))]
    belly2 = [tr(i / N, W * min(1.0, ((i / N) * 7) ** 0.5) * (1 - i / N) ** 0.62 * 0.95) for i in range(int(N * 0.72), 2, -1)]
    c.poly(belly + belly2, 'a3')
    # 주름(배 줄무늬)
    for i in range(5, 17, 2):
        u = i / N
        hw = W * min(1.0, (u * 7) ** 0.5) * (1 - u) ** 0.62
        c.line([tr(u, hw * 0.3), tr(u, hw * 0.9)], 'a2')
    # 꼬리 지느러미
    t0 = tr(0.96, 0)
    c.poly([t0, tr(1.08, -W * 0.9), tr(1.02, 0), tr(1.08, W * 0.9)], 'a0')
    c.poly([tr(0.97, 0), tr(1.06, -W * 0.7), tr(1.01, 0), tr(1.06, W * 0.7)], 'a1')
    # 가슴지느러미
    c.poly([tr(0.32, W * 0.55), tr(0.4, W * 1.5), tr(0.5, W * 0.55)], 'a1')
    # 눈
    ex, ey = tr(0.1, -W * 0.15)
    c.px(ex, ey, 'w'); c.px(ex + ca, ey + sa, 'a0')
    # 분수공
    hx, hy = tr(0.16, -W * 0.7)
    c.px(hx, hy, 'a0')


@fx('skiff_leviathan', 'screen', 128, 12, pal(WATER, WHITE))
def leviathan(c, f):
    x0, y0, x1, y1 = 100, 108, 30, 106
    if f == 0:
        c.crown(x0, y0, 20, 26, ['a2', 'a3', 'a4'], 0.7)
        c.ripple(x0, y0 + 2, 18, 'a3', squash=0.3)
    elif f <= 10:
        u = (f - 1) / 9.0
        x = lerp(x0, x1, u)
        apex = 22
        y = lerp(y0, y1, u) - (y0 - apex) * math.sin(math.pi * u)
        dy = -(y0 - apex) * math.pi * math.cos(math.pi * u) / 1.0
        dx = (x1 - x0)
        ang = math.atan2(dy + (y1 - y0), dx)
        whale(c, x, y, ang, 78, 17)
        # 몸에서 떨어지는 물방울·물기둥 꼬리
        for k in range(10):
            uu = max(0.0, u - k * 0.04)
            xx = lerp(x0, x1, uu) + 14 + (k % 3) * 3
            yy = lerp(y0, y1, uu) - (y0 - apex) * math.sin(math.pi * uu) + 18 + k * 2
            c.px(xx, yy, 'a4' if k % 2 else 'a3')
        if f <= 3:
            c.crown(x0, y0, 24, 30, ['a2', 'a3', 'a4'], 0.5 + f * 0.1)
        if f >= 8:
            c.crown(x1 - 4, y1, 26, 26 * (f - 7) / 3, ['a2', 'a3', 'a4'], 0.4 + (f - 7) * 0.2)
    else:
        c.crown(x1 - 4, y1, 34, 34, ['a2', 'a3', 'a4'], 0.9 - (f - 10) * 0.4)
        for k in range(12):
            c.px(x1 - 30 + k * 5, y1 - 8 - ((f * 5 + k * 7) % 22), 'a4')
    c.ripple(x1, y1 + 4, 8 + max(0, f - 8) * 8, 'a3', squash=0.28) if f >= 8 else None


@fx('skiff_leviathan_hit', 'target', 64, 8, pal(WATER, WHITE))
def leviathan_hit(c, f):
    cx, cy = 32, 48
    if f <= 1:
        r = 8 + f * 10
        c.oval(cx, cy + 4, r, r * 0.3, 'a0')
        c.ddisc(cx, cy + 4, r + 4, 'a1', parity=f, squash=0.3)
    if f >= 1:
        h = [0, 16, 30, 40, 40, 32, 20, 10][f]
        c.column(cx, cy + 6, h, 10 + (f % 3), ['a1', 'a2', 'a3', 'a4'], wob=math.sin(f) * 1.5)
        c.crown(cx, cy + 6, 24, h * 0.9, ['a2', 'a3', 'a4'], min(1.0, f / 4.0) if f < 5 else 0.8 - (f - 5) * 0.25)
    for k in range(3):
        r = 6 + f * 5 - k * 6
        if r > 2:
            c.ripple(cx, cy + 8, r, ['a4', 'a3', 'a2'][k], squash=0.3, parity=k)


if __name__ == '__main__':
    keys = sys.argv[1:] or None
    sys.exit(1 if run_module(sys.modules[__name__], 'vehicles-0', 48, keys, 'skiff') else 0)
