"""r2w6 b2 범선(galleon) 이펙트 12장 — 함포 일제사격의 원거리 직업. 쇠(STEEL)+불(FIRE)+연기(SMOKE)+나무(WOOD)+금(GOLD)."""
import math
import sys

from lib_r2w6 import *


def trail(c, f, y=16, x0=14):
    """포탄 뒤로 끌리는 불꽃 꼬리와 연기(첫 칸이 왼쪽을 본다 → 꼬리는 오른쪽)."""
    for i in range(4):
        x = x0 + i * 4 + (f % 2) * 2
        h = 5 - i
        c.flame(x + 3, y + 3, h + 2, 2.2 - i * 0.3, ['e1', 'e2', 'e3'][:3], seed=f * 5 + i, sway=0.2)
    for i in range(3):
        c.smoke(24 + i * 3 + (f * 2) % 3, y - 1 + (i % 2) * 3, 2.2 - i * 0.4, ['q1', 'q2', 'q3'], seed=f + i)


# ---- L1 함포 사격 -----------------------------------------------------------------------------------------
@fx('galleon_ball', 'projectile', 32, 4, pal(STEEL, FIRE, SMOKE))
def ball(c, f):
    trail(c, f, 16, 13)
    c.ball(8, 16, 6, 's0', 's1', 's3', 's4')
    c.px(4, 14, 's4'); c.px(5, 13, 's3')
    c.px(11 + (f % 2), 12, 'e3')


@fx('galleon_blast', 'target', 64, 8, pal(FIRE, SMOKE, STEEL))
def blast(c, f):
    cx, cy = 32, 36
    if f == 0:
        c.star(cx, cy, 14, ['e2', 'e3', 'e4'], pts=8)
    elif f <= 3:
        r = [0, 22, 26, 22][f]
        c.star(cx, cy, r, ['e1', 'e2', 'e3', 'e4'], pts=11, rot=f * 0.4, inner=0.62)
        c.ring(cx, cy + 10, 12 + f * 8, 'e3', 1, 0.3)
    if f >= 2:
        for i, (dx, dy, s) in enumerate(((-12, -6, 6), (10, -10, 7), (0, -16, 6), (-16, 4, 5), (16, 2, 5))):
            rise = (f - 2) * 3
            c.smoke(cx + dx * (1 + (f - 2) * 0.2), cy + dy - rise, s * (1 + (f - 2) * 0.08), ['q1', 'q2', 'q3', 'q4'], seed=i)
    if f >= 3:
        c.flame(cx, cy + 12, 12 - (f - 3) * 2, 6, ['e1', 'e2', 'e3'], seed=f, tongues=3)
    for k in range(8):
        a = k * 0.85 + f
        r = 8 + f * 4.5
        if f >= 1:
            c.px(cx + math.cos(a) * r, cy + math.sin(a) * r * 0.8 + f, 'e3' if k % 2 else 's3')
    if f <= 2:
        for k in range(5):
            a = k * 1.27 + 0.4
            r = 12 + f * 8
            c.line([(cx + math.cos(a) * r, cy + math.sin(a) * r * 0.8), (cx + math.cos(a) * (r + 5), cy + math.sin(a) * (r + 5) * 0.8)], 's2')


# ---- L3 사슬탄 ---------------------------------------------------------------------------------------------
@fx('galleon_chain', 'projectile', 32, 4, pal(STEEL, SMOKE, FIRE))
def chain(c, f):
    cx, cy = 13, 16
    a = f * math.pi / 2 + 0.3
    dx, dy = math.cos(a) * 9, math.sin(a) * 9
    pts = [(cx - dx, cy - dy), (cx, cy), (cx + dx, cy + dy)]
    for i in range(1, 8):  # 사슬 고리
        t = i / 8.0
        x = lerp(cx - dx, cx + dx, t)
        y = lerp(cy - dy, cy + dy, t)
        c.px(x, y, 's3' if i % 2 else 's2')
    c.cannonball(cx - dx, cy - dy, 3)
    c.cannonball(cx + dx, cy + dy, 3)
    for i in range(3):
        c.line([(22 + i * 3, 16 + (i - 1) * 4), (30, 16 + (i - 1) * 4)], 'q2')
    c.px(cx, cy, 's4')
    c.px(24 + (f % 2), 11, 'e3')


@fx('galleon_chain_hit', 'target', 64, 8, pal(STEEL, FIRE, SMOKE, WHITE))
def chain_hit(c, f):
    cx, cy = 32, 34
    # 두 포탄이 사슬을 끌며 대상을 감아 조여 든다. 사슬은 포탄 뒤로 끌리는 곡선 고리.
    rad = [27, 25, 22, 19, 15, 11, 7, 3][f]
    ang = f * 1.15
    for k in range(2):
        a = ang + k * math.pi
        bx, by = cx + math.cos(a) * rad, cy + math.sin(a) * rad * 0.66
        for i in range(1, 15):
            aa = a - i * 0.13
            rr = rad + i * 0.9
            x, y = cx + math.cos(aa) * rr, cy + math.sin(aa) * rr * 0.66
            c.disc(x, y, 1.3, 's2' if i % 2 else 's3')
            if i % 2:
                c.px(x, y, 's4')
        c.cannonball(bx, by, 4)
        c.px(bx - 2, by - 2, 's4')
    if f <= 3:
        for k in range(6):
            a = ang * 1.3 + k * 1.05
            c.line([(cx + math.cos(a) * 24, cy + math.sin(a) * 16), (cx + math.cos(a + .35) * 26, cy + math.sin(a + .35) * 17)], 's4')
    if f >= 4:
        c.star(cx, cy, 6 + (f - 4) * 6, ['e1', 'e2', 'e3', 'e4'], pts=9, rot=f)
    if f >= 6:
        c.ring(cx, cy, 8 + (f - 6) * 8, 'e3', 1, 0.66)
        for k in range(8):
            a = k * 0.8 + f
            c.px(cx + math.cos(a) * (12 + (f - 6) * 6), cy + math.sin(a) * (9 + (f - 6) * 4), 's3')


# ---- L5 산탄 일제사격 --------------------------------------------------------------------------------------
@fx('galleon_grape', 'allTargets', 64, 8, pal(STEEL, FIRE, SMOKE))
def grape(c, f):
    r = rng(7)
    pellets = [(r.uniform(0, 1), r.uniform(0, 1)) for _ in range(22)]
    for i, (u, v) in enumerate(pellets):
        tx, ty = 14 + u * 36, 14 + v * 38
        t = (f + 1.2) / 3.0 - (i % 5) * 0.1
        if 0 <= t <= 1.3:
            t0, t1 = max(0.0, t - 0.35), min(1.0, t)
            sx, sy = min(62, tx + 26), max(2, ty - 24)
            c.line([(lerp(sx, tx, t0), lerp(sy, ty, t0)), (lerp(sx, tx, t1), lerp(sy, ty, t1))], 's3')
            c.px(lerp(sx, tx, t1), lerp(sy, ty, t1), 's4')
        hit = f - 2 - (i % 4)
        if 0 <= hit <= 3:
            if hit == 0:
                c.star(tx, ty, 3, ['e2', 'e3', 'e4'], pts=6)
            elif hit == 1:
                c.star(tx, ty, 5, ['e1', 'e2', 'e3', 'e4'], pts=7, rot=i)
            elif hit == 2:
                c.smoke(tx, ty - 1, 3, ['q1', 'q2', 'q3'], seed=i)
            else:
                c.px(tx, ty - 3, 'q3'); c.px(tx + 1, ty - 4, 'q2')
    if f >= 3:
        for k in range(5):
            c.px(8 + k * 12, 50 - (f * 3 + k * 2) % 6, 's3')


# ---- L7 접현 백병전 -----------------------------------------------------------------------------------------
def hook_at(c, x, y, ang, rope_from):
    c.line([rope_from, (x, y)], 't3')
    ux, uy = math.cos(ang), math.sin(ang)
    c.line([(x - ux * 8, y - uy * 8), (x, y)], 's2', 2)
    for s in (-1, 1):
        px_, py_ = x - ux * 2, y - uy * 2
        c.line([(px_, py_), (px_ - uy * s * 6 + ux * 4, py_ + ux * s * 6 + uy * 4)], 's3', 1)
        c.px(px_ - uy * s * 6 + ux * 4, py_ + ux * s * 6 + uy * 4, 's4')


@fx('galleon_grapple', 'target', 64, 8, pal(WOOD, STEEL, FIRE, GOLD, WHITE))
def grapple(c, f):
    hooks = [(24, 26, 2.2, (56, 2)), (40, 28, 2.6, (63, 10)), (30, 40, 2.0, (58, 26))]
    for i, (x, y, ang, src) in enumerate(hooks):
        t = min(1.0, (f + 1) / (3.0 + i * 0.4))
        hx, hy = lerp(src[0], x, t), lerp(src[1], y, t)
        hook_at(c, hx, hy, ang, (src[0] + 8, src[1] - 4))
        if f >= 3 and i == 0:
            c.line([(src[0] + 8, src[1] - 4), (hx, hy)], 't2')
    if 3 <= f <= 6:
        s = f - 3
        keys = ['s1', 's2', 's3', 's4']
        c.blade((52, 8), (12, 52), -12, 10 if s < 2 else 6, keys, frac=ease((s + 1) / 2.0) if s < 2 else 1.0)
        if s >= 1:
            c.blade((10, 10), (54, 50), 12, 10 if s < 3 else 5, keys, frac=ease(s / 2.0) if s < 3 else 1.0)
    if f >= 4:
        c.star(32, 32, 6 + (f - 4) * 4, ['y1', 'y2', 'y3', 'w'], pts=8, rot=f) if f < 7 else None
        for k in range(6):
            a = k * 1.05 + f * 0.7
            c.px(32 + math.cos(a) * (9 + (f - 4) * 4), 32 + math.sin(a) * (8 + (f - 4) * 3), 'y2' if k % 2 else 's4')


# ---- L10 불타는 기름통 --------------------------------------------------------------------------------------
@fx('galleon_oil', 'projectile', 32, 4, pal(WOOD, STEEL, FIRE, SMOKE))
def oil(c, f):
    cx, cy = 10, 16
    # 통(옆에서 본 술통): 굴러 도는 테와 널빤지
    c.oval(cx, cy, 8, 7, 't0')
    c.oval(cx, cy, 7, 6, 't1')
    for i in range(5):
        x = cx - 5 + i * 2.5 + (f * 1.2) % 2.5
        c.line([(x, cy - 6), (x, cy + 6)], 't2')
    c.line([(cx - 8, cy - 3), (cx + 8, cy - 3)], 's1'); c.line([(cx - 8, cy + 3), (cx + 8, cy + 3)], 's1')
    c.px(cx - 4, cy - 5, 't3')
    c.flame(cx + 9, cy + 1, 12 + (f % 2) * 2, 4, ['e1', 'e2', 'e3', 'e4'], seed=f, sway=0.5, tongues=3)
    for i in range(3):
        c.smoke(22 + i * 3 + (f * 2) % 3, 10 + (i % 2) * 4, 2.4 - i * 0.4, ['q1', 'q2', 'q3'], seed=f + i)
    c.px(2, 12, 'e3')


@fx('galleon_oil_fire', 'target', 64, 10, pal(WOOD, FIRE, SMOKE))
def oil_fire(c, f):
    cx = 32
    fy = 52
    if f == 0:  # 통이 깨지며 기름이 튄다
        for k in range(7):
            a = k * 0.9
            c.line([(cx, 40), (cx + math.cos(a) * 14, 40 + math.sin(a) * 9)], 't2')
        c.star(cx, 42, 10, ['e2', 'e3', 'e4'], pts=8)
    if f >= 1:
        w = min(24, 8 + f * 5)
        c.oval(cx, fy + 2, w, 4, 'q0') if f < 8 else None
        heights = [0, 10, 18, 26, 30, 32, 30, 26, 16, 8]
        h = heights[f]
        for i, dx in enumerate((-16, -8, 0, 8, 16)):
            hh = h * (0.55 + 0.45 * abs(math.sin(i * 2.1 + f * 0.9))) * (1 - abs(dx) / 34)
            c.flame(cx + dx, fy, hh, 5, ['e0', 'e1', 'e2', 'e3'] if f < 7 else ['e0', 'e1', 'e2'], seed=f * 9 + i, sway=0.15 * (i - 2), tongues=2)
        c.flame(cx, fy, h * 1.05, 6, ['e1', 'e2', 'e3', 'e4'], seed=f, tongues=3)
    if f >= 3:
        for i in range(3):
            rise = ((f - 3) * 4 + i * 6) % 24
            c.smoke(cx - 10 + i * 10 + (f % 2), 30 - rise, 3 + i % 2, ['q1', 'q2', 'q3'], seed=i * 3 + f)
    for k in range(6):
        c.px(cx - 18 + k * 7, fy - ((f * 5 + k * 6) % 34), 'e3' if k % 2 else 'e4')


# ---- L12 뱃노래 ---------------------------------------------------------------------------------------------
def anchor(c, x, y, k, k2):
    c.ring(x, y - 7, 2, k, 1)
    c.line([(x, y - 5), (x, y + 7)], k, 2)
    c.line([(x - 4, y - 2), (x + 4, y - 2)], k)
    c.arc(x, y + 3, 7, 10, 170, k, 2, 0.8)
    c.px(x - 7, y + 3, k2); c.px(x + 7, y + 3, k2)
    c.px(x - 1, y - 8, k2)


@fx('galleon_shanty', 'allAllies', 64, 8, pal(GOLD, WATER, WHITE, FIRE))
def shanty(c, f):
    cx = 32
    # 발밑 파도 물결
    for k in range(3):
        r = 10 + ((f * 3 + k * 8) % 24)
        c.ripple(cx, 54, r, ['a3', 'a2', 'a4'][k], squash=0.3, parity=k)
    # 떠오르는 음표
    notes = [(16, 44), (26, 50), (38, 46), (48, 52), (22, 38), (44, 40)]
    for i, (x, y) in enumerate(notes):
        yy = y - ((f * 5 + i * 6) % 36)
        xx = x + math.sin(f * 0.9 + i) * 3
        if yy > 4:
            c.note(xx, yy, 'y2' if i % 2 else 'y3')
    # 닻 문장
    if 1 <= f <= 6:
        anchor(c, cx, 18 - (1 if f % 2 else 0), 'y2', 'y3')
        c.spark(cx - 10, 12, 1, 'w', 'y3'); c.spark(cx + 11, 20, 1, 'w', 'y3')
    # 붉은 기세
    for k in range(4):
        x = 14 + k * 12
        h = 4 + ((f + k * 2) % 4) * 2
        c.line([(x, 56), (x + 1, 56 - h)], 'e2'); c.px(x + 1, 55 - h, 'e3')


# ---- L16 해무 ------------------------------------------------------------------------------------------------
FOG = dict(m0='#4c5f7e', m1='#8398b6', m2='#bccadf', m3='#eaf2fa')


@fx('galleon_fog', 'allTargets', 64, 10, pal(FOG, PLASMA, WATER))
def fog(c, f):
    grow = min(1.0, (f + 1) / 4.0) if f < 8 else max(0.25, 1 - (f - 7) * 0.32)
    # 가로로 길게 흐르는 안개 띠: 타원 몸통은 디더로 가장자리를 풀고, 위쪽 면은 밝게
    bands = [(52, 31, 6, 0), (44, 25, 5, 1), (36, 31, 6, 2), (27, 23, 5, 3), (19, 28, 5, 4), (11, 18, 4, 5)]
    for bi, (y, rx, ry, seed) in enumerate(bands):
        drift = math.sin(f * 0.55 + bi * 1.7) * 7 + (bi % 2) * 4 - 2
        cx = 32 + drift
        w = rx * grow
        c.ddisc(cx, y, w + 3, 'm1', parity=bi, squash=ry / max(w, 1) * 1.15)
        c.oval(cx, y, w, ry * grow, 'm1')
        c.oval(cx - 1, y - 1, w * 0.86, ry * grow * 0.72, 'm2')
        c.oval(cx - 3, y - 2, w * 0.55, ry * grow * 0.4, 'm3')
        for k in range(4):
            lx = cx - w + (k + 0.5) * w * 0.5
            c.disc(lx, y - ry * 0.35 * grow, max(1.0, ry * 0.45 * grow), 'm2')
        c.dring(cx, y + 1, w + 1, 'm0', parity=bi + f, squash=ry / max(w, 1) + 0.05)
    # 안개 속에서 흔들리는 유령 등불 두 개
    for (lx, ly, ph) in ((40, 28, 0.0), (22, 40, 2.0)):
        yy = ly + math.sin(f * 0.8 + ph) * 3
        c.glow(lx, yy, 5, ['n1', 'n2', 'n3'])
        c.px(lx, yy, 'n4')
    for k in range(7):
        c.px(6 + k * 9 + (f % 3), 56 - (f * 2 + k * 5) % 40, 'a3')


# ---- L22 무적함대 --------------------------------------------------------------------------------------------
def ghost_ship(c, x, y, s, blink=0, fire=0):
    """유령 범선(왼쪽이 뱃머리): 초승달 선체, 부푼 돛 셋(찢어진 밑단), 보랏빛 후광."""
    hw = 30 * s
    hh = 10 * s
    c.ddisc(x, y - 12 * s, hw * 1.05, 'v1', parity=blink, squash=0.75)
    # 선체: 뱃머리(왼쪽)가 높이 솟은 초승달
    hull = [(x - hw, y - hh * 1.3), (x - hw * 0.8, y + hh * 0.3), (x - hw * 0.3, y + hh), (x + hw * 0.7, y + hh), (x + hw, y - hh * 0.5),
            (x + hw * 0.55, y - hh * 0.6), (x - hw * 0.5, y - hh * 0.5)]
    c.poly(hull, 'v1')
    c.poly([(x - hw * 0.9, y - hh * 0.9), (x - hw * 0.5, y - hh * 0.2), (x + hw * 0.8, y - hh * 0.2), (x + hw * 0.9, y - hh * 0.4), (x + hw * 0.4, y - hh * 0.6), (x - hw * 0.5, y - hh * 0.5)], 'v2')
    c.line([(x - hw * 0.85, y - hh * 0.9), (x + hw * 0.9, y - hh * 0.45)], 'v3')
    for i in range(6):  # 포문
        px_ = x - hw * 0.55 + i * hw * 0.22
        c.rect(px_, y - hh * 0.05, px_ + 2, y + hh * 0.25, 'v0')
        if fire and i % 2 == (blink % 2):
            c.px(px_ - 1, y + 1, 'e3'); c.px(px_ - 2, y + 1, 'e4')
    # 돛대와 부푼 돛(왼쪽으로 바람을 받는다)
    for mi, (mx, mh, sw) in enumerate(((-0.5, 34, 9), (0.05, 42, 11), (0.6, 32, 9))):
        bx = x + mx * hw
        top = y - hh * 0.5 - mh * s
        c.line([(bx, y - hh * 0.5), (bx, top)], 'v1', 2)
        for row, (y0f, y1f) in enumerate(((0.0, 0.5), (0.52, 1.0))):
            yt = top + 2 + (mh * s - 4) * y0f
            yb = top + 2 + (mh * s - 4) * y1f - 1
            bulge = sw * s * 0.4
            sail = [(bx - sw * s, yt), (bx + sw * s, yt), (bx + sw * s + 1, (yt + yb) / 2), (bx + sw * s - 1, yb + 1), (bx + sw * s * 0.4, yb - 2 + (blink + mi) % 2),
                    (bx, yb + 1), (bx - sw * s * 0.5, yb - 1 - (blink + mi + row) % 2), (bx - sw * s - bulge, (yt + yb) / 2)]
            c.poly(sail, 'v2')
            c.poly([(bx - sw * s, yt), (bx - 1, yt), (bx - 2, yb - 1), (bx - sw * s - bulge * .8, (yt + yb) / 2)], 'v3')
            c.line([(bx + sw * s * 0.3, yt + 1), (bx + sw * s * 0.3, yb - 1)], 'v1')
        c.line([(bx - sw * s, top + 1), (bx + sw * s, top + 1)], 'v1')
        c.px(bx, top - 1, 'v4')


@fx('galleon_armada', 'screen', 128, 12, pal(VIOLET, FIRE, SMOKE, WHITE))
def armada(c, f):
    ships = [(92, 34, 0.6), (66, 64, 0.78), (44, 96, 0.92)]
    for i, (x, y, s) in enumerate(ships):
        if f >= i:
            appear = min(1.0, (f - i + 1) / 3.0)
            xo = (1 - appear) * 30
            ghost_ship(c, x + xo, y, s * (0.55 + 0.45 * appear), blink=f, fire=1 if 3 <= f - i <= 8 else 0)
    # 일제사격: 함포 화염과 포탄 궤적(오른쪽 → 왼쪽)
    for i, (x, y, s) in enumerate(ships):
        t = f - 3 - i
        if 0 <= t <= 4:
            bow = x - 26 * s
            if t < 3:
                c.star(bow, y + 2, 6 + t * 2, ['e2', 'e3', 'e4'], pts=7, rot=t)
            for k in range(5):
                sx = bow - 4
                sy = y - 8 * s + k * 5 * s
                ex = sx - 14 - t * 16
                c.line([(sx, sy), (ex, sy + k)], 'e3' if k % 2 else 'w')
                c.px(ex, sy + k, 'w')
    if f >= 6:
        for k in range(8):
            a = k * 0.8 + f
            c.spark(26 + math.cos(a) * 16, 96 + math.sin(a) * 8, 2 if (f + k) % 2 else 1, 'e4', 'e3')
    if f >= 8:
        for i, (x, y, s) in enumerate(ships):
            c.smoke(x - 26 * s, y - (f - 8) * 3, 5, ['q1', 'q2', 'q3'], seed=i + f)


@fx('galleon_armada_hit', 'target', 64, 8, pal(FIRE, SMOKE, VIOLET, STEEL))
def armada_hit(c, f):
    cx, cy = 32, 34
    spots = [(24, 24), (40, 30), (22, 40), (42, 42), (32, 18), (32, 46)]
    for i, (x, y) in enumerate(spots):
        t = f - i * 0.75
        if 0 <= t < 1.2:
            c.star(x, y, 5, ['e2', 'e3', 'e4'], pts=7)
        elif 1.2 <= t < 2.4:
            c.star(x, y, 10, ['e1', 'e2', 'e3', 'e4'], pts=9, rot=i)
        elif 2.4 <= t < 4.2:
            c.smoke(x, y - (t - 2.4) * 3, 4, ['q1', 'q2', 'q3'], seed=i)
            c.px(x + 4, y + 2, 'v3')
    for k in range(6):  # 유령 불꽃
        yy = 52 - ((f * 5 + k * 7) % 44)
        c.px(cx - 18 + k * 7, yy, 'v3' if k % 2 else 'v2')
    if f >= 2:
        c.ring(cx, 50, 6 + (f - 2) * 5, 'v2', 1, 0.3)


if __name__ == '__main__':
    keys = sys.argv[1:] or None
    sys.exit(1 if run_module(sys.modules[__name__], 'vehicles-1', 64, keys, 'galleon') else 0)
