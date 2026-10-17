#!/usr/bin/env python3
"""prehistoric 거처 — 이엉 둥근 움집·가죽 천막·매머드 뼈 집·족장 긴 집·무당 천막·동굴 입구·흙 움집·차양.

모든 출입구는 사람 크기(폭 16px 안팎 × 높이 24px 이상)이고 한 칸 열에 맞춘다(entrance = 맨 아랫줄 칸 x).
지붕(원뿔·돔)·바위 윗면이 위에서 보이는 면이다(3/4). 문 칸은 막힘, 바로 아래 칸이 접근칸.

  python3 dwellings.py      # tiledata/prehistoric/dwellings/_gate/*.png + preview
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pelt import pelt  # noqa: E402
from px import C, rnd, h32
from kit import Reg, contact, OUT
from shapes import thatch_cone, hide_cone, cyl_wall, daub, log_wall, doorway, rock_hill, tusk_arc, arch_mask, seeds, near2, rock_px, lit

R = Reg('dwellings')


# ═══════════════════════ 3/4 입체 찍기(작은 z-버퍼) ═══════════════════════
# 원뿔·돔·원통을 진짜 입체로 두고 남쪽 위(약 30도)에서 내려다본 대로 화소에 찍는다. 그래서 둥근 몸의 가로 겹·솔기·밑둘레가
# 모두 웃는 모양(가운데가 처진 타원 호)으로 나오고, 꼭대기 쪽 면은 위에서 본 면으로 밝다.
# X 동, Y 북(멀어짐), Z 위. 화면 y = by - Z*KZ - Y*KY. 가까움 = Z*KY - Y*KZ.
KY, KZ = 0.5, 0.87
_L = (-0.55, -0.3, 0.78)
_LN = math.sqrt(sum(v * v for v in _L)); LIGHT = tuple(v / _LN for v in _L)


class Z3:
    def __init__(s, c, cx, by):
        s.c, s.cx, s.by = c, cx, by; s.zb = {}

    def sxy(s, X, Y, Z):
        return s.cx + X, s.by - Z * KZ - Y * KY

    def put(s, X, Y, Z, val, bias=0.0):
        sx, sy = s.sxy(X, Y, Z)
        k = (int(math.floor(sx)), int(math.floor(sy)))
        d = Z * KY - Y * KZ + bias
        o = s.zb.get(k)
        if o is None or d > o[0]: s.zb[k] = (d, val)

    def flush(s):
        for (x, y), (d, v) in s.zb.items():
            if v is not None: s.c.P(x, y, *v)
        s.zb = {}


def shade(n, base, gain=2.2, lo=0, hi=5):
    dl = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]
    return max(lo, min(hi, int(round(base + (dl - 0.45) * gain))))


def _norm(a):
    l = math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) or 1
    return (a[0] / l, a[1] / l, a[2] / l)


def cone3(z, R0, H, z0, paint, power=0.7, v_open=0.0, inner=None, dens=3.0):
    """원뿔 겉면(꼭짓점 v=0 → 처마 v=1). 반지름 R0*v^power, 높이 z0 + H*(1-v).
    paint(v, th, n, X, Y, Z) -> (mat,t). v_open > 0 이면 꼭대기를 잘라 연기 구멍을 내고, 안쪽(뒷벽 안면)은 inner 로."""
    nv = int(H * dens + R0 * dens); nth = int(2 * math.pi * R0 * dens)
    for i in range(nv + 1):
        v = v_open + (1 - v_open) * i / nv
        r = R0 * max(v, 1e-4) ** power
        drdv = R0 * power * max(v, 1e-4) ** (power - 1)
        Zc = z0 + H * (1 - v)
        for k in range(nth):
            th = 2 * math.pi * k / nth
            sx, cy = math.sin(th), -math.cos(th)            # th=0 → 남쪽(정면)
            X, Y = r * sx, r * cy
            n = _norm((H * sx, H * cy, drdv))               # 겉면 법선
            front = -n[1] * KZ + n[2] * KY > 0
            if front: z.put(X, Y, Zc, paint(v, th, n, X, Y, Zc))
            elif inner: z.put(X, Y, Zc, inner(v, th, n, X, Y, Zc), bias=-0.01)


def cyl3(z, R0, z0, z1, paint, dens=3.0):
    """세운 원통 앞면(남쪽 반). paint(zz, th, n, X, Y, Z)."""
    nth = int(2 * math.pi * R0 * dens); nz = int((z1 - z0) * dens) + 1
    for k in range(nth):
        th = 2 * math.pi * k / nth
        sx, cy = math.sin(th), -math.cos(th)
        if cy > 0.15: continue
        for j in range(nz + 1):
            Z = z0 + (z1 - z0) * j / nz
            z.put(R0 * sx, R0 * cy, Z, paint(Z - z0, th, (sx, cy, 0.0), R0 * sx, R0 * cy, Z))


def disc3(z, R0, Zd, paint, ry=None, dens=3.0, r_in=0.0):
    """평평한 원반·고리 윗면(위에서 보이는 면)."""
    ry = R0 if ry is None else ry
    n = int(R0 * dens)
    for i in range(n + 1):
        rr = r_in + (R0 - r_in) * i / n
        nth = max(8, int(2 * math.pi * rr * dens))
        for k in range(nth):
            th = 2 * math.pi * k / nth
            X, Y = rr * math.sin(th), -(ry / R0) * rr * math.cos(th)
            z.put(X, Y, Zd, paint(rr / R0, th, (0, 0, 1), X, Y, Zd))


def dome3(z, R0, H, z0, paint, dens=3.0, phi_min=0.0):
    """반구(타원) 돔: 위도 phi(0 밑 → pi/2 꼭대기), 경도 th."""
    nphi = int((R0 + H) * dens * 1.2); nth = int(2 * math.pi * R0 * dens)
    for i in range(nphi + 1):
        phi = phi_min + (math.pi / 2 - phi_min) * i / nphi
        r = R0 * math.cos(phi); Zc = z0 + H * math.sin(phi)
        for k in range(max(6, int(nth * max(0.08, math.cos(phi))))):
            th = 2 * math.pi * k / max(6, int(nth * max(0.08, math.cos(phi))))
            sx, cy = math.sin(th), -math.cos(th)
            X, Y = r * sx, r * cy
            n = _norm((math.cos(phi) * sx / R0, math.cos(phi) * cy / R0, math.sin(phi) / H))
            if -n[1] * KZ + n[2] * KY <= 0: continue
            z.put(X, Y, Zc, paint(phi, th, n, X, Y, Zc))


def contact_ink(c):
    """각 열의 맨 아래 화소 밑에 먹 한 줄(땅 닿는 선, 둥근 밑둘레를 따라간다)."""
    for x in range(c.w):
        ys = [y for y in range(c.h) if c.get(x, y)]
        if ys and ys[-1] + 1 < c.h: c.P(x, ys[-1] + 1, 'ink', 1)


def stone_ring(z, R0, ry_scale, s, n=None, size=2.2):
    """땅바닥 둘레 돌 고리(돌마다 둥근 윗면이 위에서 보인다)."""
    n = n or int(2 * math.pi * R0 / 6.0)
    for k in range(n):
        th = 2 * math.pi * (k + 0.35 * rnd(k, 1, s)) / n
        X, Y = R0 * math.sin(th), -R0 * math.cos(th) * ry_scale
        sz = size * (0.75 + 0.45 * rnd(k, 2, s))
        hh = sz * 0.9
        def pt(phi, t2, nn, *_):
            return ('stone', 2 if phi < 0.3 else shade(nn, 4, 3.0, 2, 6))
        # 작은 돌 하나 = 납작한 돔
        nphi = 6; nth = 16
        for i in range(nphi + 1):
            phi = (math.pi / 2) * i / nphi
            r = sz * math.cos(phi); Zc = hh * math.sin(phi)
            for kk in range(nth):
                t2 = 2 * math.pi * kk / nth
                nn = _norm((math.cos(phi) * math.sin(t2) / sz, -math.cos(phi) * math.cos(t2) / sz, math.sin(phi) / hh))
                z.put(X + r * math.sin(t2), Y - r * math.cos(t2), Zc, pt(phi, t2, nn), bias=0.02)


def stone_footing(c, x0, y, w, s=0):
    """벽 밑 돌 받침 한 줄(둥근 돌 3~4px)."""
    x = x0
    while x < x0 + w:
        ln = 3 + h32(x, 1, s) % 2
        for i in range(ln):
            if x + i >= x0 + w: break
            u = (x + i - x0 + 0.5) / w
            t = 4 + lit(u) + (1 if i == 0 else 0)
            c.P(x + i, y, 'stone', t); c.P(x + i, y + 1, 'stone', t - 1); c.P(x + i, y + 2, 'stone', max(1, t - 2))
        c.P(x + ln - 1, y + 1, 'stone', 2)
        x += ln


def round_hut(c, W, H, door_tile, roof='thatch', wall='daub', s=0, apex_knot=True, wall_h=18, door_h=25, roof_top=3, ramp=True):
    """둥근 움집(3/4): 넓고 볼록한 원뿔 지붕이 그림의 위 2/3 를 덮고(위에서 보이는 면), 처마 밑으로 짧은 원통 벽.
    출입구는 door_tile 열(16px): 처마를 아치로 깎아 올린 현관 + 통나무 문틀 + 말아 올린 가죽 휘장."""
    w, h = W * 16, H * 16
    cx = w / 2
    base_y = h - 2
    wall_top = base_y - wall_h
    rx = w / 2 - 0.5
    ry = 6
    ey = wall_top + 1
    wx0, wx1 = 3, w - 3
    fn = (lambda x, y, u, j: daub(x, y, u, j, s=s)) if wall == 'daub' else (lambda x, y, u, j: log_wall(x, y, u, j, s=s))
    cyl_wall(c, wx0, wall_top, wx1 - wx0, base_y - wall_top, fn)
    stone_footing(c, wx0, base_y - 2, wx1 - wx0, s)
    if roof == 'thatch': thatch_cone(c, cx, roof_top, cx, ey, rx, ry, s=s, power=0.55, ramp=ramp)
    else: hide_cone(c, cx, roof_top, cx, ey, rx, ry, s=s, power=0.55)
    # 처마 밑 그늘(벽 위 세 줄, 짙게 → 옅게)
    for x in range(c.w):
        ys = [y for y in range(c.h) if c.get(x, y) and c.get(x, y)[0] in ('thatch', 'hide')]
        if not ys: continue
        yb = max(ys) + 1
        for k in range(3):
            g = c.get(x, yb + k)
            if g and g[0] in ('dirt', 'bark'): c.P(x, yb + k, g[0], max(0, g[1] - (3 - k)))
    dx0 = door_tile * 16 + 1; dw = 14
    dy0 = base_y - door_h
    # 현관: 처마를 아치로 깎은 자리의 이엉 두께(밝은 테 두 줄)
    for j in range(-4, 7):
        for i in range(-3, dw + 3):
            x, y = dx0 + i, dy0 + j
            dxn = (i + 0.5 - dw / 2) / (dw / 2 + 3); dyn = (j - 6.5) / 10.5
            if dxn * dxn + dyn * dyn <= 1.0 and c.get(x, y) and c.get(x, y)[0] in ('thatch', 'hide'):
                outer = dxn * dxn + dyn * dyn > 0.62
                c.P(x, y, c.get(x, y)[0], (4 if dxn < 0.2 else 3) if outer else 1)
    doorway(c, dx0, dy0, dw, door_h, arch=6, curtain='hide')
    # 통나무 문틀 + 휜 상인방
    for x in (dx0 - 1, dx0 + dw):
        for y in range(dy0 + 5, base_y):
            c.P(x, y, 'bark', 4 if x < cx else 2)
    for i in range(-1, dw + 1):
        dxn = (i + 0.5 - dw / 2) / (dw / 2 + 1)
        y = dy0 + int(round(6 - 6 * math.sqrt(max(0, 1 - dxn * dxn))))
        c.P(dx0 + i, y - 1, 'bark', 4 if i < dw // 2 else 3); c.P(dx0 + i, y - 2, 'bark', 2)
    if apex_knot:
        ax = int(cx)
        for j in range(roof_top - 2, roof_top + 4):
            for i in (-1, 0):
                c.P(ax + i, j, 'thatch', 5 if i < 0 else 3)
        c.HL(ax - 2, roof_top + 2, 4, 'bark', 2); c.HL(ax - 2, roof_top + 3, 4, 'bark', 1)
    for x in range(c.w):
        if c.get(x, base_y) and not c.get(x, base_y + 1): c.P(x, base_y + 1, 'ink', 1)
    c.outline(bottom=('ink', 1))


@R.add('hut-thatch-s', '이엉 둥근 움집(작은)', 3, 4, 'structure', tags=['움집', '집', '마을'], entrance=[1],
       rules='마을 빈터 둘레에 둔다. 문 앞(접근칸) 아래 두 칸은 흙길로 비운다.')
def _(c): round_hut(c, 3, 4, 1, s=1, wall_h=20, door_h=25, ramp=False)   # 2판 겹 명암을 넣으면 관문이 정면 입면으로 읽어 1판 그대로


@R.add('hut-thatch-l', '이엉 둥근 움집(큰)', 5, 5, 'structure', tags=['움집', '집', '마을'], entrance=[2],
       rules='마을 중심 가까이. 문은 모닥불 광장 쪽(남쪽).')
def _(c): round_hut(c, 5, 5, 2, s=4, wall_h=24, door_h=26)


def thatch_paint(R0, Hh, tiers=9, s=0, base=3.3, strands=True):
    """이엉 원뿔 칠: 겹(링)마다 머리 빛·밑 그늘, 겹 안 짚 가닥은 경도 방향 짧은 획 — 링이라 화면에선 웃는 호가 된다."""
    def paint(v, th, n, X, Y, Z):
        q = v * tiers; ti = int(q); tp = q - ti
        t = shade(n, base, 2.6, 0, 5)
        strand = int(th * R0 * max(v, 0.15) / 1.6 + ti * 1.7)
        if tp < 0.2: t += 1
        elif tp > 0.8: t -= 2
        elif strands and strand % 3 == 0: t -= 1
        elif strands and strand % 3 == 1 and tp < 0.5: t += 1 if n[0] < 0.3 else 0
        elif not strands and tp > 0.6: t -= 1
        if v < 0.08: t += 1
        return ('thatch', max(0, min(5, t)))
    return paint


def round_hut3(c, W, H, door_tile, wall="log", s=0, wall_z=21, apex_y=3, door_h=25):
    """둥근 움집(3/4 입체): 원뿔 이엉 지붕(겹은 웃는 호) + 원통 벽(밑둘레 타원) + 다진 흙 마당 고리와 돌 받침."""
    w, h = W * 16, H * 16
    cx = w / 2; base_y = h - 3
    Rw = w / 2 - 4; Rr = w / 2 - 0.6
    by = base_y - Rw * KY
    z0r = wall_z - 2
    Hh = (by - apex_y) / KZ - z0r
    z = Z3(c, cx, by)
    # 마당(벽 둘레 다진 흙 고리 — 위에서 보이는 땅 면)
    disc3(z, Rw + 2.2, 0, lambda rr, th, n, X, Y, Z: ('dirt', 4 if math.sin(th) < -0.2 else 3), r_in=Rw - 1)
    stone_ring(z, Rw + 0.8, 1.0, s, n=int(2 * math.pi * Rw / 3.4), size=1.5)

    def wall_paint(zz, th, n, X, Y, Z):
        arc = (th + math.pi) * Rw
        if wall == 'log':
            lg = arc / 3.4; fr = lg - math.floor(lg)
            if fr > 0.82: return ('bark', 0)
            t = shade(n, 3.0, 2.4, 1, 5) + (1 if fr < 0.25 else 0) - (1 if fr > 0.6 else 0)
            if rnd(int(lg), int(zz // 4), s) < 0.15: t -= 1
            if zz > wall_z - 7: t -= 1 + (1 if zz > wall_z - 5 else 0)       # 처마 밑 그늘
            return ('bark', max(0, min(5, t)))
        t = shade(n, 4.2, 2.4, 1, 6)
        if int(zz) % 4 == 1 and int(arc) % 9 < 4: t += 1
        if zz > wall_z - 7: t -= 1 + (1 if zz > wall_z - 5 else 0)
        return ('dirt', max(1, min(6, t)))

    cyl3(z, Rw, 0, wall_z, wall_paint)
    cone3(z, Rr, Hh, z0r, thatch_paint(Rr, Hh, tiers=9, s=s), power=0.62)
    z.flush()
    # 처마 끝 들쭉날쭉한 짚 끝(웃는 호를 따라)
    for x in range(c.w):
        ys = [y for y in range(c.h) if c.get(x, y) and c.get(x, y)[0] == 'thatch']
        if not ys: continue
        yb = max(ys)
        c.P(x, yb, 'thatch', 1)
        if h32(x, 3, s) % 3 == 0 and yb + 1 < c.h: c.P(x, yb + 1, 'thatch', 0)
    # 출입구: 처마를 아치로 깎아 올린 현관 + 통나무 문틀 + 윗면이 보이는 상인방 통나무
    dx0 = door_tile * 16 + 1; dw = 14
    dy0 = base_y - door_h + 1
    for j in range(-4, 7):
        for i in range(-3, dw + 3):
            x, y = dx0 + i, dy0 + j
            dxn = (i + 0.5 - dw / 2) / (dw / 2 + 3); dyn = (j - 6.5) / 10.5
            g = c.get(x, y)
            if dxn * dxn + dyn * dyn <= 1.0 and g and g[0] == 'thatch':
                outer = dxn * dxn + dyn * dyn > 0.62
                c.P(x, y, 'thatch', (4 if dxn < 0.2 else 3) if outer else 1)
    doorway(c, dx0, dy0, dw, door_h, arch=6, curtain='hide')
    for x in (dx0 - 1, dx0 + dw):
        for y in range(dy0 + 5, base_y + 1):
            c.P(x, y, 'bark', 4 if x < cx else 2)
    for i in range(-1, dw + 1):
        dxn = (i + 0.5 - dw / 2) / (dw / 2 + 1)
        y = dy0 + int(round(6 - 6 * math.sqrt(max(0, 1 - dxn * dxn))))
        c.P(dx0 + i, y - 1, 'bark', 4 if i < dw // 2 else 3); c.P(dx0 + i, y - 2, 'bark', 2)
    # 꼭대기 짚 매듭
    ax = int(cx); ay = int(by - (z0r + Hh) * KZ)
    for j in range(ay - 2, ay + 3):
        for i in (-1, 0):
            c.P(ax + i, j, 'thatch', 5 if i < 0 else 3)
    c.HL(ax - 2, ay + 2, 4, 'bark', 3); c.HL(ax - 2, ay + 3, 4, 'bark', 1)
    contact_ink(c)
    c.outline(bottom=('ink', 1))


@R.add('hut-log', '통나무 벽 둥근 움집', 3, 4, 'structure', tags=['움집', '집', '통나무'], entrance=[1],
       rules='숲가 마을. 이엉 움집과 섞어 둔다.')
def _(c): round_hut3(c, 3, 4, 1, wall='log', s=7)


# ═══════════════════════ 가죽 천막(원뿔) ═══════════════════════
def tipi3(c, W, H, door_tile, s=0, deco=None, apex_y=9):
    """가죽 원뿔 천막(3/4 입체): 솔기는 꼭짓점으로 모이고, 꿰맴·황토 띠는 웃는 타원 호, 꼭대기는 연기 구멍(안이 들여다보인다),
    밑둘레는 타원 — 둘레에 천막 누름돌 고리."""
    w, h = W * 16, H * 16
    cx = w / 2; base_y = h - 3
    R0 = w / 2 - 3.5
    by = base_y - R0 * KY
    Hh = (by - apex_y) / KZ
    z = Z3(c, cx, by)
    vo = 0.24
    band = (0.56, 0.63)

    def paint(v, th, n, X, Y, Z):
        a = (th / (2 * math.pi)) * 9 + 0.5
        fr = a - math.floor(a)
        t = shade(n, 3.2, 2.6, 1, 5)
        if band[0] <= v < band[1]:
            t2 = 2 + (1 if n[0] < -0.3 else 0) - (1 if n[0] > 0.45 else 0)
            if v < band[0] + 0.012: t2 += 1
            if v >= band[1] - 0.012: t2 -= 1
            zig = (int(th * R0 / 2.2) % 2 == 0) and band[0] + 0.024 < v < band[1] - 0.024
            return ('feather', 2) if zig and (int(th * R0 / 2.2) % 4 == 0) else ('ochre', max(1, min(4, t2)))
        if fr < 0.06: return ('hide', max(0, t - 2))
        if fr < 0.2: t += 1
        elif fr > 0.92: t -= 1
        for vs in (0.36, 0.8):
            if abs(v - vs) < 0.008 and int(th * R0 * 1.2) % 2 == 0: t -= 1
        if v > 0.97: t -= 1
        return ('hide', max(0, min(5, t)))

    def inner(v, th, n, X, Y, Z):
        return ('ink', 0) if v > vo + 0.02 else ('hide', 1)

    # 누름돌 고리(천막 밑둘레 바로 바깥)
    stone_ring(z, R0 + 1.6, 1.0, s, size=1.7)
    cone3(z, R0, Hh, 0, paint, power=0.98, v_open=vo, inner=inner)
    z.flush()
    # 연기 구멍 테(앞 가장자리 밝게 — 위에서 들여다보는 아가리) + 엇갈려 솟은 기둥
    r_o = R0 * vo ** 0.98; zt = Hh * (1 - vo)
    for k in range(48):
        th = 2 * math.pi * k / 48
        X, Y = r_o * math.sin(th), -r_o * math.cos(th)
        x, y = z.sxy(X, Y, zt)
        if Y < 0: c.P(int(x), int(y), 'hide', 5 if X < 0 else 4)
    ty = by - zt * KZ
    for (dx, top, t, ex) in ((-7, 0, 4, -2), (-3, 1, 5, -1), (3, 0, 3, 1), (7, 2, 2, 2)):
        c.line(int(cx) + dx, top, int(cx) + ex, int(ty), 'bark', t)
    # 바람막이 날개(연기 구멍 양옆으로 젖힌 가죽 자락)
    for j in range(5):
        c.P(int(cx) - int(r_o) - 1 - j // 2, int(ty) + j, 'hide', 4); c.P(int(cx) - int(r_o) - 2 - j // 2, int(ty) + j, 'hide', 3)
        c.P(int(cx) + int(r_o) + j // 2, int(ty) + j, 'hide', 2); c.P(int(cx) + int(r_o) + 1 + j // 2, int(ty) + j, 'hide', 1)
    # 출입구: 가죽 자락을 젖힌 아치 문
    dx0 = door_tile * 16 + 1; dw = 14; dh = 25
    dy0 = base_y - dh + 1
    doorway(c, dx0, dy0, dw, dh, arch=7, curtain=None)
    for j in range(dh - 4):
        k = j // 4
        for i in range(min(k, 3)):
            c.P(dx0 - 1 - i, dy0 + 4 + j, 'hide', 5 - (i > 1))
        c.P(dx0 + dw + min(k, 2), dy0 + 4 + j, 'hide', 1)
    c.HL(dx0 - 3, dy0 + 13, 3, 'bark', 2)
    if deco: deco(c, cx, ty, base_y)
    contact_ink(c)
    c.outline(bottom=('ink', 1))


@R.add('tipi', '가죽 원뿔 천막', 3, 4, 'structure', tags=['천막', '집', '가죽'], entrance=[1],
       rules='사냥 야영지·마을 가장자리. 문 앞 두 칸을 비운다.')
def _(c): tipi3(c, 3, 4, 1, s=2)


def shaman_deco(c, ax, ay, base_y):
    # 깃털 다발(꼭대기) + 뿔 달린 짐승 머리뼈 + 주술 나선(추상)
    ax = int(ax)
    for k, dx in enumerate((-4, -1, 2, 5)):
        for j in range(4):
            c.P(ax + dx + (j // 2 if dx > 0 else -(j // 2)), 1 + j - (k % 2), 'feather', 3 - (j // 2))
    sx, sy = ax - 2, int(base_y - (base_y - ay) * 0.62)
    for (i, j, t) in ((0, 0, 5), (1, 0, 5), (2, 0, 5), (3, 0, 4), (4, 0, 4), (0, 1, 4), (1, 1, 1), (2, 1, 4), (3, 1, 1), (4, 1, 3),
                      (1, 2, 4), (2, 2, 3), (3, 2, 3), (2, 3, 2)):
        c.P(sx + i, sy + j, 'bone', t)
    c.line(sx - 1, sy, sx - 3, sy - 3, 'bone', 4); c.line(sx + 5, sy, sx + 7, sy - 3, 'bone', 3)
    # 나선 무늬(흰 물감, 추상)
    for (cx, cy) in ((ax - 9, base_y - 18), (ax + 8, base_y - 14)):
        for a in range(0, 360 * 2, 40):
            r = 0.6 + a / 260.0
            x = cx + r * math.cos(math.radians(a)); y = cy + r * math.sin(math.radians(a)) * 0.8
            g = c.get(round(x), round(y))
            if g and g[0] == 'hide': c.P(round(x), round(y), 'bone', 4)
    # 뼈 방울 끈
    for j in range(5):
        c.P(ax + 8, base_y - 30 + j, 'bark', 2)
    c.P(ax + 8, base_y - 25, 'bone', 5); c.P(ax + 8, base_y - 24, 'bone', 3)


@R.add('shaman-tent', '무당 천막(깃털·머리뼈·나선 무늬)', 3, 5, 'structure', tags=['무당', '천막', '주술'], entrance=[1],
       rules='마을 가장자리나 토템 곁. 문 앞 두 칸을 비우고 둘레에 뼈 더미·토템을 둔다.')
def _(c): tipi3(c, 3, 5, 1, s=5, deco=shaman_deco, apex_y=12)


# ═══════════════════════ 매머드 뼈 집 ═══════════════════════
def box3(z, x0, x1, y0, y1, z0, z1, top=None, front=None, dens=3.0):
    """상자: 윗면(Z=z1, 위에서 보이는 면)과 남쪽 앞면(Y=y0). 옆면은 이 시점에서 보이지 않는다."""
    nx = int((x1 - x0) * dens) + 1
    if top:
        ny = int((y1 - y0) * dens) + 1
        for i in range(nx + 1):
            for j in range(ny + 1):
                X = x0 + (x1 - x0) * i / nx; Y = y0 + (y1 - y0) * j / ny
                z.put(X, Y, z1, top(X - x0, Y - y0), bias=0.001)
    if front:
        nz = int((z1 - z0) * dens) + 1
        for i in range(nx + 1):
            for j in range(nz + 1):
                X = x0 + (x1 - x0) * i / nx; Zz = z0 + (z1 - z0) * j / nz
                z.put(X, y0, Zz, front(X - x0, Zz - z0))


def tusk3(z, R0, H, th, phi0, phi1, lift=1.2, width=2.2, bend=0.0):
    """돔 겉면을 따라 오르는 엄니(경선 곡선, 끝이 가늘다). bend: 올라갈수록 경도가 휘는 양."""
    n = 90
    for i in range(n + 1):
        f = i / n
        phi = phi0 + (phi1 - phi0) * f
        t = th + bend * f * f
        wd = width * (1 - 0.6 * f)
        for k in range(5):
            dd = (k / 4 - 0.5) * wd
            r = (R0 + lift) * math.cos(phi) ; Zc = (H + lift) * math.sin(phi)
            X = r * math.sin(t) + dd * math.cos(t); Y = -r * math.cos(t) + dd * math.sin(t)
            tt = 5 if k == 0 else 4 if k < 3 else 3 if k == 3 else 2
            if (t < 0) == (k < 2): tt = min(5, tt + 0)
            z.put(X, Y, Zc + (0.5 if k in (1, 2) else 0), ('bone', tt), bias=0.3)


@R.add('bone-hut', '매머드 뼈 집(엄니 아치 + 턱뼈 담)', 5, 4, 'structure', tags=['뼈', '매머드', '집'], entrance=[2],
       rules='추운 들판·사냥꾼 마을. 문 앞 두 칸을 비운다. 둘레에 뼈 더미를 둔다.')
def _(c):
    w, h = 80, 64; cx = 40; base_y = 61
    R0 = 35.5; by = base_y - R0 * KY; H = 33
    z = Z3(c, cx, by)
    sd = seeds(0, 0, 260, 120, 15, 21)
    jaw = 0.42

    def paint(phi, th, n, X, Y, Zc):
        arc = (th + math.pi) * R0
        if phi < jaw:                                     # 턱뼈 담: 위도 고리마다 V 턱뼈가 엇갈려 쌓였다
            row = int(Zc / 4.6); fr = Zc / 4.6 - row
            u = (arc / 7.0 + (0.5 if row % 2 else 0)); k = u - math.floor(u)
            dip = 0.22 * (1 - abs(k - 0.5) * 2)
            t = shade(n, 4.0, 2.6, 1, 5)
            if fr < 0.18 + dip * 0.4: t += 1
            elif fr > 0.8: t = 1
            if k > 0.9: t = 1
            if row == 0 and abs(k - 0.3) < 0.05 and 0.35 < fr < 0.6: t = 1
            return ('bone', max(1, min(5, t)))
        if phi > 1.43: return ('ink', 0)                  # 연기 구멍 안
        if phi > 1.38: return ('fur', 1)
        (sx, sy, k), d1, d2 = near2(arc, (math.pi / 2 - phi) * 40, sd)
        mat = 'fur' if k % 3 == 0 else 'hide'
        t = shade(n, 3.0 if mat == 'hide' else 2.6, 2.8, 0, 5 if mat == 'hide' else 4)
        if d2 - d1 < 1.4: t = 1 if mat == 'hide' else 0
        elif mat == 'fur' and (int(arc) + int(Zc) * 2) % 4 == 0: t -= 1
        return (mat, max(0, min(5 if mat == 'hide' else 4, t)))

    stone_ring(z, R0 + 2.2, 1.0, 13, size=1.6)
    dome3(z, R0, H, 0, paint)
    for (th, b) in ((-0.42, 0.25), (0.42, -0.25), (-1.05, 0.35), (1.05, -0.35), (-1.65, 0.3), (1.65, -0.3)):
        tusk3(z, R0, H, th, jaw - 0.04, 1.2, bend=b, width=3.2)
    z.flush()
    # 연기 구멍 테(앞 가장자리 밝은 뼈 고리)
    for k in range(64):
        th = 2 * math.pi * k / 64
        r = R0 * math.cos(1.41); Zc = H * math.sin(1.41) + 0.6
        x, y = z.sxy(r * math.sin(th), -r * math.cos(th), Zc)
        c.P(int(x), int(y), 'bone', 5 if math.sin(th) < 0 else 3) if math.cos(th) > -0.2 else None
    # 출입구(엄니 두 개가 문틀) + 문 위 매머드 머리뼈
    dx0, dw, dh = 33, 14, 25
    dy0 = base_y - dh + 1
    doorway(c, dx0, dy0, dw, dh, arch=7, curtain='fur')
    tusk_arc(c, dx0 + dw // 2, dy0 + 12, 9, 13, 180, 272, width=2)
    tusk_arc(c, dx0 + dw // 2, dy0 + 12, 9, 13, 360, 268, width=2)
    sx, sy = int(cx) - 6, dy0 - 8
    for j in range(8):
        for i in range(12):
            dx = (i + 0.5 - 6) / 6; dy = (j + 0.5 - 3.5) / 4
            if dx * dx + dy * dy <= 1:
                c.P(sx + i, sy + j, 'bone', 5 if dx + dy < -0.45 else 4 if dy < 0.1 else 3 if dy < 0.6 else 2)
    for (i, j) in ((3, 3), (8, 3)): c.P(sx + i, sy + j, 'ink', 0); c.P(sx + i, sy + j + 1, 'ink', 1)
    c.P(sx + 5, sy + 6, 'bone', 1); c.P(sx + 6, sy + 6, 'bone', 1)
    c.HL(sx + 1, sy, 10, 'bone', 5)
    contact_ink(c)
    c.outline(bottom=('ink', 1))


# ═══════════════════════ 동굴 입구 ═══════════════════════
def cave(c, W, H, door_tiles, top_h, s=0, mat='stone', cap='grass', cell=11):
    """동굴 입구: 바위 언덕(윗면 풀/암반 + 앞면 바위 덩이) 앞면에 사람 크기 아가리. 아가리 안은 깊을수록 어둡고,
    윗테는 밝은 돌 이마 + 처진 돌 이빨, 밑은 안쪽 바닥(흙)."""
    w, h = W * 16, H * 16
    base_y = h - 2
    front, back = rock_hill(c, 0, 0, w, h - 1, top_h, mat=mat, cap=cap, s=s, cell=cell)
    dx0 = door_tiles[0] * 16; dw = len(door_tiles) * 16; dh = min(base_y - min(front[dx0:dx0 + dw]) - 2, 30)
    dy0 = base_y - dh + 1
    arch = min(dh - 4, dw // 2 + 3)
    # 이마 돌(아가리 위 두꺼운 밝은 테)
    for j in range(-4, dh):
        for i in range(-4, dw + 4):
            if not arch_mask(i + 4, j + 4, dw + 8, dh + 8, arch + 4) or arch_mask(i, j, dw, dh, arch): continue
            g = c.get(dx0 + i, dy0 + j)
            if not g or g[0] != mat: continue
            top = j < arch * 0.6
            c.P(dx0 + i, dy0 + j, mat, min(5 if mat == 'basalt' else 6, g[1] + (2 if top and i < dw * 0.6 else 1 if top else 0)))
    for j in range(dh):
        for i in range(dw):
            if not arch_mask(i, j, dw, dh, arch): continue
            inner = arch_mask(i - 2, j - 2, dw - 4, dh - 2, max(1, arch - 2))
            if j >= dh - 2: c.P(dx0 + i, dy0 + j, 'dirt', 1 if j == dh - 2 else 2); continue
            if not inner:
                c.P(dx0 + i, dy0 + j, mat, 1 if i < dw / 2 else 0)            # 아가리 안쪽 벽(그늘)
            else:
                c.P(dx0 + i, dy0 + j, 'ink', 0 if j < dh * 0.7 else 1)
    # 돌 이빨
    for i in range(3, dw - 3, 5):
        dxn = (i + 0.5 - dw / 2) / (dw / 2)
        j = int(arch * (1 - math.sqrt(max(0, 1 - dxn * dxn)))) + 1
        c.P(dx0 + i, dy0 + j, mat, 3); c.P(dx0 + i, dy0 + j + 1, mat, 2); c.P(dx0 + i + 1, dy0 + j, mat, 2)
    # 아가리 앞 굴러 나온 돌
    for (i, j) in ((-3, dh - 2), (dw + 1, dh - 3)):
        c.P(dx0 + i, dy0 + j, mat, 4); c.P(dx0 + i + 1, dy0 + j, mat, 3); c.P(dx0 + i, dy0 + j + 1, mat, 2); c.P(dx0 + i + 1, dy0 + j + 1, mat, 1)
    for x in range(c.w):
        if c.get(x, base_y) and not c.get(x, base_y + 1): c.P(x, base_y + 1, 'ink', 1)
    c.outline(bottom=('ink', 1))


@R.add('cave-mouth', '동굴 입구(풀 덮인 바위 언덕)', 5, 4, 'structure', tags=['동굴', '바위', '입구'], entrance=[2],
       rules='맵 북쪽 바위 가장자리에 붙여 둔다. 문 칸 = 동굴 실내로 가는 이동 칸. 앞 두 칸을 비운다.')
def _(c): cave(c, 5, 4, [2], 26, s=3)


@R.add('cave-mouth-l', '큰 동굴 입구(두 칸 아가리)', 7, 5, 'structure', tags=['동굴', '바위', '입구'], entrance=[3, 4],
       rules='부족 동굴 거처의 입구. 앞에 모닥불·건조대를 둔다(두 칸 띄워서).')
def _(c): cave(c, 7, 5, [3, 4], 40, s=8)


@R.add('cave-mouth-v', '현무암 동굴 입구(화산 골짜기)', 5, 4, 'structure', tags=['동굴', '화산', '입구'], entrance=[2],
       rules='화산 골짜기 북쪽 벽에 붙여 둔다.')
def _(c): cave(c, 5, 4, [2], 26, s=11, mat='basalt', cap='ash')


# ═══════════════════════ 족장 긴 집 ═══════════════════════
def thatch_slab(c, x0, x1, y0, y1, hip=10, tier=5, s=0, mat='thatch'):
    """긴 이엉 지붕(남쪽 경사면이 위에서 크게 보인다): 겹은 가로로 곧게(처마 쪽으로 살짝 처짐), 양 끝은 우진각 삼각면
    (왼쪽 끝 밝게, 오른쪽 끝 어둡게). 밑 처마는 들쭉날쭉한 짚 끝."""
    H = y1 - y0
    for y in range(y0, y1 + 1):
        k = (y - y0) / max(1, H)
        inset = hip * (1 - k)
        for x in range(int(x0 + inset), int(x1 - inset) + 1):
            left_hip = x < x0 + hip and (x - x0) < hip * (1 - k) + 6 * (1 - k)
            right_hip = x > x1 - hip * (1 - k) - 6 * (1 - k)
            yy = (y - y0) + (abs((x - (x0 + x1) / 2) / ((x1 - x0) / 2)) ** 2) * -1.5
            tp = int(yy) % tier
            # 2판(화풍 정렬): 버들항 기와 문법 — 용마루 쪽 겹이 가장 밝고 처마로 내려갈수록 한 단씩 어둡다
            t = 4 if k < 0.3 else 3 if k < 0.62 else 2
            if left_hip: t += 1
            if right_hip: t -= 1
            col = (x + (int(yy) // tier) * 2) % 3
            if tp == 0: t += 1
            elif tp == tier - 1: t -= 2
            elif col == 0 and tp >= 2: t -= 1
            c.P(x, y, mat, max(0, min(5, t)))
    for x in range(int(x0), int(x1) + 1):
        c.P(x, y1, mat, 1)
        if h32(x, 3, s) % 3 == 0: c.P(x, y1 + 1, mat, 0)
    # 용마루(짚 다발을 덮은 통나무)
    for x in range(int(x0 + hip), int(x1 - hip) + 1):
        c.P(x, y0, 'bark', 4); c.P(x, y0 + 1, 'bark', 2)


@R.add('chief-house', '족장 긴 집(이엉 우진각 지붕 + 통나무 벽)', 7, 5, 'structure', tags=['족장', '집', '마을'], entrance=[3],
       rules='마을 북쪽 가운데(광장을 내려다보는 자리). 문 앞 두 칸과 광장 사이는 흙길로 비운다.')
def _(c):
    w, h = 112, 80; base_y = h - 2
    wall_top = base_y - 26
    cyl_wall(c, 4, wall_top, w - 8, base_y - wall_top, lambda x, y, u, j: log_wall(x, y, u, j, s=3))
    stone_footing(c, 4, base_y - 2, w - 8, 3)
    thatch_slab(c, 1, w - 2, 5, wall_top + 3, hip=16, s=3)
    for x in range(4, w - 4):
        for k, dk in enumerate((3, 2, 1, 1)):              # 처마 밑 그늘 네 단(버들항 민가)
            g = c.get(x, wall_top + 4 + k)
            if g and g[0] == 'bark': c.P(x, wall_top + 4 + k, 'bark', max(0, g[1] - dk))
    # 용마루 끝 엇갈린 뿔(뼈)
    for (x, d) in ((17, -1), (w - 18, 1)):
        c.line(x, 6, x + 5 * d, 0, 'bone', 5); c.line(x + d, 6, x + 6 * d, 1, 'bone', 3)
        c.line(x, 6, x - 3 * d, 1, 'bone', 4)
    # 문(가운데 열) + 새긴 문기둥 + 문 위 머리뼈
    dx0, dw, dh = 49, 14, 26
    dy0 = base_y - dh
    for j in range(-6, 1):
        for i in range(-3, dw + 3):
            g = c.get(dx0 + i, dy0 + j)
            if g and g[0] == 'thatch': c.P(dx0 + i, dy0 + j, 'thatch', 4 if j < -3 else 1)
    doorway(c, dx0, dy0, dw, dh, arch=5, curtain='fur')
    for x in (dx0 - 3, dx0 + dw):
        for y in range(dy0 - 2, base_y):
            for i in range(3):
                t = 4 if i == 0 else 3 if i == 1 else 1
                if (y - dy0) % 6 == 0: t = 1
                if (y - dy0) % 6 == 2 and i == 1: t = 2
                c.P(x + i, y, 'bark', t)
        for i in range(3): c.P(x + i, dy0 - 3, 'bark', 5)
    for i in range(-3, dw + 3): c.P(dx0 + i, dy0 - 1, 'bark', 4); c.P(dx0 + i, dy0, 'bark', 2)
    sx, sy = 52, dy0 - 9
    for (i, j, t) in ((1, 0, 5), (2, 0, 5), (3, 0, 5), (4, 0, 5), (5, 0, 4), (6, 0, 4), (0, 1, 5), (1, 1, 4), (2, 1, 0), (3, 1, 4), (4, 1, 4), (5, 1, 0), (6, 1, 3), (7, 1, 3),
                      (1, 2, 4), (2, 2, 4), (3, 2, 3), (4, 2, 3), (5, 2, 3), (6, 2, 2), (2, 3, 3), (3, 3, 1), (4, 3, 1), (5, 3, 2), (3, 4, 2), (4, 4, 2)):
        c.P(sx + i, sy + j, 'bone' if t else 'ink', t if t else 0)
    c.line(sx, sy + 1, sx - 4, sy - 3, 'bone', 4); c.line(sx + 7, sy + 1, sx + 11, sy - 3, 'bone', 3)
    # 벽에 건 방패 가죽 둘(추상 물감 원)
    for cx in (24, 88):
        c.ell(cx, wall_top + 13, 5, 5, lambda x, y, dx, dy, d: ('hide', 4 if dx + dy < -0.3 else 3) if d < 0.7 else ('hide', 1))
        c.ell(cx, wall_top + 13, 2, 2, lambda x, y, dx, dy, d: ('ochre', 2))
    for x in range(c.w):
        if c.get(x, base_y) and not c.get(x, base_y + 1): c.P(x, base_y + 1, 'ink', 1)
    c.outline(bottom=('ink', 1))


# ═══════════════════════ 흙 움집(뗏장 둔덕) ═══════════════════════
@R.add('earth-lodge', '흙 움집(뗏장 둔덕 + 통나무 현관)', 5, 4, 'structure', tags=['움집', '흙', '집'], entrance=[2],
       rules='추운 들판·언덕 마을. 문 앞 두 칸을 비운다.')
def _(c):
    import terrain as T
    w, h = 80, 64; cx = 40; base_y = 61
    R0 = 37.5; H = 30
    yp = -(R0 + 5)                                       # 현관 앞면이 맨 앞
    by = base_y + yp * KY
    z = Z3(c, cx, by)
    sod = 0.34

    def paint(phi, th, n, X, Y, Zc):
        sx_, sy_ = c.w // 2 + X, Y
        if phi < sod:                                     # 밑둘레: 뗏장 밑으로 드러난 흙 둔덕
            t = shade(n, 3.6, 2.4, 1, 6)
            if (int(X) + int(Zc * 2)) % 5 == 0: t -= 1
            if phi < 0.1: t -= 1
            return ('dirt', max(1, min(6, t)))
        if phi > 1.37: return ('ink', 0)                  # 연기 구멍
        if phi > 1.31: return ('bark', 2)
        gm, gt = T.p_grass0(int(X + 40) % 16, int(Y * 0.5 + Zc) % 16)
        if gm == 'bloom': return (gm, gt)
        t = gt + shade(n, 0, 2.6, -2, 2)
        if phi < sod + 0.05: t -= 1
        return ('grass', max(1, min(5, t)))

    dome3(z, R0, H, 0, paint)
    # 현관(앞으로 내민 통나무 상자 + 위에서 보이는 뗏장 지붕)
    zp = 30.5
    def ptop(dx, dy):
        # 현관 지붕: 앞뒤로 걸친 통나무 서까래 윗면(위에서 보이는 면) — 뒤 끝은 둔덕 그늘
        k = int(dx) % 3
        t = 4 + (1 if dx < 7 else 0) - (1 if dx > 17 else 0) + (1 if k == 0 else 0)
        if k == 2: t = 1
        if dy > 9: t -= 2
        elif dy > 7: t -= 1
        return ('bark', max(0, min(5, t)))
    def pfront(dx, dz):
        x = int(dx * 1.0)
        k = x % 4
        if dz > zp - 2.4: return ('bark', 3 if dz > zp - 1.2 else 1)           # 서까래 끝 마구리
        if dz > zp - 4.5: return ('bark', 5 if dx < 12 else 4)                    # 상인방 통나무
        if k == 3: return ('bark', 0)
        t = 3 + (1 if dx < 6 else 0) - (1 if dx > 17 else 0) + (1 if k == 0 else 0) - (1 if k == 2 else 0)
        return ('bark', max(0, min(5, t)))
    box3(z, -11.5, 11.5, yp, -R0 * 0.55, 0, zp, top=ptop, front=pfront)
    z.flush()
    # 연기 구멍 테(통나무 고리) + 오르는 김 한 줄기
    for k in range(64):
        th = 2 * math.pi * k / 64
        r = R0 * math.cos(1.34); Zc = H * math.sin(1.34) + 0.5
        x, y = z.sxy(r * math.sin(th), -r * math.cos(th), Zc)
        if math.cos(th) > -0.3: c.P(int(x), int(y), 'bark', 4 if math.sin(th) < 0 else 3)
    # 풀 끝이 흙 띠 위로 처진다
    for x in range(c.w):
        ys = [y for y in range(c.h) if c.get(x, y) and c.get(x, y)[0] == 'grass']
        if ys and h32(x // 2, 5, 3) % 3 == 0 and c.get(x, max(ys) + 1) and c.get(x, max(ys) + 1)[0] == 'dirt':
            c.P(x, max(ys) + 1, 'grass', 2)
    dx0, dw, dh = 33, 14, 25
    doorway(c, dx0, base_y - dh + 1, dw, dh, arch=4, curtain='hide')
    contact_ink(c)
    c.outline(bottom=('ink', 1))


# ═══════════════════════ 차양·곡식 창고 ═══════════════════════
@R.add('lean-to', '짚 차양(갈래 기둥 + 털 잠자리)', 3, 2, 'structure', tags=['차양', '야영', '잠자리'], rules='사냥 야영지·숲가. 앞 한 칸을 비운다(통째로 막힘).')
def _(c):
    # 갈래 기둥 둘에 걸친 앞 처마 통나무 → 뒤로 비스듬히 땅에 닿는 지붕면. 지붕면은 앞뒤로 긴 가지 서까래 위에 짚 다발을 덮었다(위에서 보이는 큰 면).
    # 뒷변은 짚 끝이 들쭉날쭉하고 양옆은 안쪽으로 좁아진다(사다리꼴) — 평평한 판(탁자)처럼 보이지 않게.
    for y in range(3, 19):
        k = (y - 3) / 15                                  # 0 뒤 → 1 앞
        x0 = int(round(7 - 5 * k)); x1 = int(round(41 + 5 * k))
        for x in range(x0, x1):
            if y < 5 and h32(x, y, 3) % 3 == 0: continue
            u = (x - x0) / max(1, x1 - x0)
            t = 3 + (1 if u < 0.35 else 0) - (1 if u > 0.78 else 0) + (1 if k > 0.75 else 0)
            # 짚 결: 앞뒤 세로 획
            if h32(x, y // 3, 7) % 4 == 0: t += 1
            elif h32(x, y // 3, 9) % 5 == 0: t -= 1
            c.P(x, y, 'thatch', max(1, min(5, t)))
        if y in (8, 14):                                  # 짚을 묶은 가로 끈(줄 두 개)
            for x in range(x0 + 1, x1 - 1): c.P(x, y, 'thatch', 1 if (x % 4) else 2)
    for x in range(9, 41, 8):                             # 서까래 끝이 처마 위로 삐죽
        c.P(x, 2, 'bark', 3); c.P(x, 1, 'bark', 4)
    for (x, y) in ((12, 6), (30, 5), (22, 11), (36, 12), (15, 15)):   # 짚 위에 얹은 고사리 잎 몇 장
        c.P(x, y, 'fern', 5); c.P(x - 1, y + 1, 'fern', 4); c.P(x + 1, y + 1, 'fern', 4); c.P(x, y + 1, 'fern', 3)
    for x in range(1, 47): c.P(x, 19, 'bark', 5 if x < 24 else 4); c.P(x, 20, 'bark', 2)
    for y in range(21, 30):
        for x in range(5, 43): c.P(x, y, 'ink', 1 if y < 25 else 2)
    pc = C(48, 32)
    pelt(pc, 24, 27, 13, 3.2, 'fur', 3, s=11)
    for y in range(24, 31):
        for x in range(6, 42):
            g = pc.get(x, y)
            if g: c.P(x, y, *g)
    for x in (3, 43):
        for y in range(19, 31): c.P(x, y, 'bark', 4); c.P(x + 1, y, 'bark', 2)
        c.P(x - 1, 18, 'bark', 4); c.P(x + 2, 18, 'bark', 4); c.P(x - 1, 17, 'bark', 5); c.P(x + 2, 17, 'bark', 5)
    c.outline(bottom=('ink', 1))



@R.add('granary', '곡식 창고(기둥 위 이엉 오두막 + 사다리)', 2, 3, 'structure', tags=['창고', '곡식', '마을'], rules='마을 가장자리. 사다리 앞 한 칸을 비운다(통째로 막힘).')
def _(c):
    cx = 16; by = 42.0
    z = Z3(c, cx, by)
    zd = 16.0
    # 땅 그늘(바닥판 밑 다져진 흙, 위에서 보이는 타원)
    disc3(z, 11.0, 0, lambda rr, th, n, X, Y, Z: ('dirt', 2 if rr < 0.7 else 3))
    # 기둥 넷(뒤 둘은 더 멀어 밑동이 위로 올라가 보인다)
    for (X, Y) in ((-11, 6), (8.5, 6), (-11.5, -9), (9, -9)):
        back = Y > 0
        box3(z, X, X + 2.6, Y, Y + 2, 0, zd - 1, front=lambda dx, dz, b=back: ('bark', max(0, (2 if b else (4 if dx < 0.9 else 3 if dx < 1.8 else 1)) - (1 if dz > zd - 4 else 0))))
    # 둥근 바닥판: 동서로 깐 판자 윗면(위에서 보이는 타원 면) + 앞 두께 테
    R_d = 14.6
    def deck_top(rr, th, n, X, Y, Z):
        k = int((Y + 20) / 3.2); fr = (Y + 20) / 3.2 - k
        t = 4 + (1 if X < -5 else 0) - (1 if X > 6 else 0)
        if fr < 0.22: t = 2
        elif fr > 0.75: t += 1
        if rr > 0.93: t = 5 if math.cos(th) > 0 else 3          # 앞 가장자리 밝은 테
        return ('bark', max(1, min(5, t)))
    disc3(z, R_d, zd, deck_top)
    cyl3(z, R_d, zd - 2.4, zd - 0.01, lambda zz, th, n, X, Y, Z: ('bark', 1 if zz < 0.8 else shade(n, 2.6, 2.2, 1, 4)))
    # 몸통(엮은 원통 벽, 바닥판 뒤쪽에 놓여 앞에 판자 윗면이 보인다) + 원뿔 이엉 지붕
    def body(zz, th, n, X, Y, Z):
        # 흙 바른 고리버들 독(따뜻한 흙빛, 엮음 결이 가로로 비친다)
        t = shade(n, 5.0, 2.6, 1, 6)
        arc = (th + math.pi) * 7
        if int(zz * 1.2) % 3 == 0 and int(arc) % 5 < 3: t -= 1
        if zz > 4.6: t -= 1 + (zz > 5.8)
        return ('dirt', max(1, min(6, t)))
    zb = Z3(c, cx, by - 2.0 * KY); zb.zb = z.zb
    cyl3(zb, 7.5, zd, zd + 10, body)
    cone3(zb, 12.5, 13.0, zd + 8.6, thatch_paint(12.5, 13.0, tiers=4, s=9, base=3.4, strands=False), power=0.85)
    z.flush()
    # 처마 끝 짚
    for x in range(c.w):
        ys = [y for y in range(c.h) if c.get(x, y) and c.get(x, y)[0] == 'thatch']
        if ys:
            yb = max(ys)
            if c.get(x, yb + 1) is None or c.get(x, yb + 1)[0] != 'thatch':
                c.P(x, yb, 'thatch', 1)
    # 꼭대기 짚 매듭
    ay = int(by - 2.0 * KY - (zd + 8.6 + 13.0) * KZ)
    c.P(15, ay - 1, 'thatch', 5); c.P(16, ay - 1, 'thatch', 4); c.P(15, ay - 2, 'thatch', 4); c.HL(14, ay + 1, 4, 'bark', 2)
    # 사다리(바닥판 앞 가장자리에서 땅까지, 가로대 윗면 밝게)
    ty = int(by - (zd - 2.4) * KZ + R_d * KY)
    for y in range(ty - 1, 47):
        c.P(12, y, 'bark', 5); c.P(13, y, 'bark', 3); c.P(19, y, 'bark', 4); c.P(20, y, 'bark', 2)
        if (y - ty) % 4 == 2 and y < 45:
            c.HL(14, y, 5, 'bark', 5); c.HL(14, y + 1, 5, 'bark', 2)
    contact_ink(c)
    c.outline(bottom=('ink', 1))


if __name__ == '__main__':
    R.export()
    ims = [(it['id'], R.render(it).img()) for it in R.items]
    contact(ims, os.path.join(OUT, 'dwellings', 'preview.png'), z=3, W=1900, bg=(138, 95, 58))
    print(len(R.items), 'dwellings')
