"""r2w6 b2 철갑선(gunboat) 이펙트 10장 — 장갑·포격의 탱커. 강철(STEEL)+주황 경고색(ORANGE)+불(FIRE)+연기(SMOKE)+물(WATER)."""
import math
import sys

from lib_r2w6 import *

ORANGE = dict(o0='#7a3010', o1='#cc5a26', o2='#f29a4a', o3='#ffd28a')


# ---- L1 충각 돌진 ---------------------------------------------------------------------------------------------
@fx('gunboat_ram', 'target', 64, 8, pal(STEEL, ORANGE, FIRE, WATER, WHITE))
def ram(c, f):
    cx, cy = 32, 38
    # 왼쪽으로 들이받는 충각: 뾰족한 강철 쐐기와 주황 장갑대가 오른쪽에서 파고든다
    tip = [60, 46, 33, 28, 30, 36, 44, 54][f]
    body = tip + 40
    hh = 15
    c.poly([(tip, cy), (tip + 20, cy - hh), (body, cy - hh), (body, cy + hh), (tip + 20, cy + hh)], 's1')
    c.poly([(tip, cy), (tip + 20, cy - hh), (body, cy - hh), (body, cy - hh + 6), (tip + 18, cy - 5)], 's2')
    c.poly([(tip, cy), (tip + 20, cy + hh), (body, cy + hh), (body, cy + hh - 5), (tip + 16, cy + 5)], 's0')
    c.line([(tip + 1, cy), (tip + 19, cy - hh + 2)], 's4')
    c.rect(tip + 22, cy + 4, body, cy + 9, 'o1'); c.line([(tip + 22, cy + 4), (body, cy + 4)], 'o2')
    for x in range(int(tip) + 24, int(body), 6):
        c.px(x, cy - hh + 3, 's0'); c.px(x, cy + hh - 2, 's3')
    if 2 <= f <= 4:
        c.star(tip - 2, cy, 12 + (3 - abs(f - 3)) * 5, ['o1', 'o2', 'o3', 'w'], pts=9, rot=f * 0.7)
        for k in range(9):
            a = k * 0.7 + f
            c.line([(tip - 2 + math.cos(a) * 14, cy + math.sin(a) * 11), (tip - 2 + math.cos(a) * 24, cy + math.sin(a) * 18)], 's4')
    if f >= 3:
        c.dring(tip - 2, cy, 10 + (f - 3) * 6, 'w', parity=f, squash=0.8)
        c.dring(tip - 2, cy, 14 + (f - 3) * 6, 'o2', parity=f + 1, squash=0.8)
    for k in range(7):  # 튀는 파편
        if f >= 2:
            a = 2.4 + k * 0.45
            r = (f - 1) * 5 + k
            c.px(tip + math.cos(a) * r, cy + math.sin(a) * r - 2, 's3' if k % 2 else 'o2')
    c.ripple(30, 55, 6 + f * 4, 'a3', squash=0.3)


# ---- L3 장갑 증설 -------------------------------------------------------------------------------------------
@fx('gunboat_plate', 'user', 64, 8, pal(STEEL, ORANGE, GOLD, WHITE))
def plate(c, f):
    cx, cy = 32, 34
    # 강철판 여섯 장이 몸 둘레로 날아와 맞물린다
    for i in range(6):
        a = i * math.tau / 6 + math.pi / 6
        t = min(1.0, max(0.0, (f - i * 0.35) / 3.0))
        r = lerp(34, 19, ease(t))
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r * 0.9
        dx, dy = -math.sin(a), math.cos(a)
        ux, uy = math.cos(a), math.sin(a)
        p = [(x + dx * 7 + ux * 3, y + dy * 7 + uy * 3), (x - dx * 7 + ux * 3, y - dy * 7 + uy * 3), (x - dx * 7 - ux * 3, y - dy * 7 - uy * 3), (x + dx * 7 - ux * 3, y + dy * 7 - uy * 3)]
        c.poly(p, 's1')
        c.line([p[0], p[1]], 's3')
        c.line([p[2], p[3]], 's0')
        c.px(x + dx * 5, y + dy * 5, 's4'); c.px(x - dx * 5, y - dy * 5, 's4')
        if t >= 1.0 and 3 <= f:
            c.line([p[0], p[1]], 'y2') if f == 3 + (i % 2) else None
    if f >= 4:
        c.dring(cx, cy, 22, 'y2', parity=f, squash=0.9)
        c.dring(cx, cy, 25, 'o2', parity=f + 1, squash=0.9)
    if f >= 3:
        c.spark(cx - 20, cy - 16, 3, 'w', 'y3'); c.spark(cx + 21, cy + 6, 2, 'w', 'y3'); c.spark(cx + 6, cy - 24, 2, 'w', 'y3')
    # 방패 문장(위로 떠오름)
    if f >= 5:
        sy = 10 - (f - 5) * 1
        c.poly([(cx - 6, sy), (cx + 6, sy), (cx + 6, sy + 8), (cx, sy + 14), (cx - 6, sy + 8)], 'y1')
        c.poly([(cx - 4, sy + 2), (cx + 4, sy + 2), (cx + 4, sy + 7), (cx, sy + 11), (cx - 4, sy + 7)], 'y2')
        c.line([(cx, sy + 2), (cx, sy + 10)], 'y3')


# ---- L5 주포 사격 --------------------------------------------------------------------------------------------
@fx('gunboat_shell', 'projectile', 32, 4, pal(STEEL, ORANGE, FIRE, SMOKE))
def shell(c, f):
    # 뾰족한 철갑탄(왼쪽을 향한 탄두) + 구리 탄띠, 뒤로 화염과 연기
    y = 16
    c.poly([(1, y), (9, y - 5), (24, y - 5), (24, y + 5), (9, y + 5)], 's1')
    c.poly([(1, y), (9, y - 5), (24, y - 5), (24, y - 2), (8, y - 1)], 's2')
    c.line([(2, y), (9, y - 4)], 's4')
    c.rect(15, y - 5, 17, y + 5, 'o1'); c.line([(15, y - 5), (17, y - 5)], 'o2')
    c.rect(20, y - 5, 21, y + 5, 'o1')
    for i in range(3):
        x = 25 + i * 2 + (f % 2)
        c.flame(x + 2, y + 2, 7 - i * 2, 3.2 - i * 0.6, ['e1', 'e2', 'e3'], seed=f * 3 + i, sway=0.2, tongues=2)
    c.smoke(29, y - 6 + f % 2, 2.4, ['q1', 'q2', 'q3'], seed=f)
    c.smoke(28, y + 7 - f % 2, 2.4, ['q1', 'q2', 'q3'], seed=f + 5)


@fx('gunboat_shell_hit', 'target', 64, 8, pal(STEEL, ORANGE, FIRE, SMOKE, WHITE))
def shell_hit(c, f):
    cx, cy = 32, 38
    if f == 0:  # 관통 직전 충격파
        c.dring(cx, cy, 8, 'w')
        c.star(cx, cy, 8, ['o2', 'o3', 'w'], pts=8)
    elif f <= 3:
        r = [0, 12, 22, 27][f]
        c.star(cx, cy, r, ['e0', 'e1', 'e2', 'e3', 'e4'], pts=9, rot=0.3 * f, inner=0.5)
        c.dring(cx, cy, 6 + f * 9, 'w', parity=f + 1, squash=0.75)
        c.dring(cx, cy, 10 + f * 9, 'o2', parity=f, squash=0.75)
    if f >= 2:  # 관통 구멍에서 뿜는 연기 기둥과 파편
        for i in range(3):
            c.smoke(cx - 9 + i * 9, cy - 4 - (f - 2) * 4 - i * 2, 7 - i % 2, ['q1', 'q2', 'q3', 'q4'], seed=i * 3 + f)
        for k in range(8):
            a = -0.3 - k * 0.35
            r = 8 + (f - 1) * 6 + k
            c.px(cx + math.cos(a) * r * 1.2, cy + math.sin(a) * r - 4, 's3' if k % 2 else 'o2')
    if f >= 4:
        c.flame(cx, cy + 10, 12 - (f - 4) * 3, 5, ['e1', 'e2', 'e3'], seed=f, tongues=3)
    if f <= 4:
        for k in range(6):
            a = k * 1.05 + 0.5
            c.line([(cx + math.cos(a) * (10 + f * 4), cy + math.sin(a) * (8 + f * 3)), (cx + math.cos(a) * (15 + f * 5), cy + math.sin(a) * (12 + f * 4))], 's4')


# ---- L7 연막 전개 --------------------------------------------------------------------------------------------
@fx('gunboat_smokescreen', 'allAllies', 64, 10, pal(SMOKE, STEEL, ORANGE))
def smokescreen(c, f):
    grow = min(1.0, (f + 1) / 4.0) if f < 8 else max(0.3, 1 - (f - 7) * 0.3)
    r = rng(11)
    blobs = [(r.uniform(6, 58), r.uniform(18, 54), r.uniform(6, 11), r.uniform(0, 6.28)) for _ in range(11)]
    # 뒤쪽(어두운) → 앞쪽(밝은) 순으로 덩이를 깐다. 덩이는 천천히 옆으로 흘러간다.
    for i, (x, y, rad, ph) in enumerate(sorted(blobs, key=lambda b: b[1])):
        xx = x + math.sin(f * 0.5 + ph) * 3
        yy = y - (f * 1.2 if f < 8 else 9)
        rr = rad * grow
        c.ddisc(xx, yy, rr + 3, 'q1', parity=i, squash=0.75)
        c.oval(xx, yy, rr, rr * 0.75, 'q2')
        c.oval(xx - 1, yy - 2, rr * 0.75, rr * 0.5, 'q3')
        c.oval(xx - 2, yy - 3, rr * 0.4, rr * 0.28, 'q4')
    for i, x0 in enumerate((14, 32, 50)):  # 뿜어 나오는 연막통 점화 불꽃
        if f <= 4:
            c.px(x0, 56, 'o3'); c.px(x0 + (f % 2), 55, 'o2'); c.px(x0, 54 - f, 'q4')
    for k in range(6):
        c.px(6 + k * 10, 58 - ((f * 5 + k * 7) % 40), 'q4')


# ---- L10 폭뢰 -------------------------------------------------------------------------------------------------
@fx('gunboat_depth', 'target', 64, 10, pal(WATER, STEEL, ORANGE, FIRE, WHITE))
def depth(c, f):
    cx = 32
    sea = 50
    if f <= 3:  # 통이 떨어진다: 위 → 수면
        y = lerp(6, sea - 4, f / 3.0)
        c.poly([(cx - 7, y - 8), (cx + 7, y - 8), (cx + 8, y + 8), (cx - 8, y + 8)], 's1')
        c.rect(cx - 8, y - 5, cx + 8, y - 4, 's3'); c.rect(cx - 8, y + 3, cx + 8, y + 4, 's3')
        c.rect(cx - 3, y - 2, cx + 3, y + 1, 'o1'); c.px(cx, y - 1, 'o3')
        c.line([(cx - 6, y - 8), (cx - 5, y - 6)], 's4')
        for k in range(3):
            c.line([(cx - 4 + k * 4, y - 10 - k), (cx - 4 + k * 4, y - 16 - k * 3)], 'a3')
    if f == 3 or f == 4:
        c.crown(cx, sea, 12, 12, ['a2', 'a3', 'a4'], 0.6)
    if f >= 4:
        # 물속 폭발: 물기둥 + 아래로 번지는 기포 링
        h = [0, 0, 0, 0, 14, 30, 42, 38, 26, 12][f]
        c.column(cx, sea + 4, h, 9 + (f % 2) * 2, ['a1', 'a2', 'a3', 'a4'])
        if f in (5, 6):
            c.star(cx, sea - h * 0.5, 14, ['o1', 'o2', 'o3', 'w'], pts=9, rot=f)
        c.crown(cx, sea + 2, 22, h * 0.7, ['a2', 'a3', 'a4'], min(1.0, (f - 3) / 4.0) if f < 8 else 0.6)
        for k in range(3):
            r = 4 + (f - 4) * 6 - k * 5
            if r > 1:
                c.ripple(cx, sea + 6, r, ['a4', 'a3', 'a2'][k], squash=0.3, parity=k)
    if f >= 5:
        for k in range(8):
            c.px(cx - 20 + k * 6, sea + 6 + ((f * 3 + k * 5) % 8), 'a4')


# ---- L12 응급 용접 ---------------------------------------------------------------------------------------------
@fx('gunboat_repair', 'allAllies', 64, 8, pal(STEEL, ORANGE, GOLD, WATER, WHITE))
def repair(c, f):
    cx = 32
    # 용접 불꽃 다발이 몸 둘레 곳곳에서 튄다 + 상처를 때우는 강철 반창(십자 리벳)
    pts = [(18, 24), (46, 22), (22, 44), (44, 42), (32, 14)]
    for i, (x, y) in enumerate(pts):
        on = (f + i) % 3
        if on == 0:
            c.star(x, y, 4, ['o2', 'o3', 'w'], pts=6)
            for k in range(6):
                a = k * 1.05 + f
                c.px(x + math.cos(a) * 7, y + math.sin(a) * 7, 'y3')
        elif on == 1:
            c.spark(x, y, 3, 'w', 'y2')
        else:
            c.px(x, y, 'o2')
    # 반창
    for i, (x, y) in enumerate(((25, 30), (40, 36))):
        t = min(1.0, max(0.0, (f - 1 - i) / 2.0))
        if t > 0:
            h = 6
            c.rect(x - h, y - h + 2, x + h, y + h - 2, 's1') if t > .5 else None
            c.line([(x - h, y - h + 2), (x + h, y - h + 2)], 's3') if t > .5 else None
            for dx, dy in ((-5, -2), (5, -2), (-5, 2), (5, 2)):
                if t > .8:
                    c.px(x + dx, y + dy, 's4')
    # 회복 십자가 위로 오른다
    for i, x in enumerate((14, 32, 50)):
        y = 50 - ((f * 5 + i * 9) % 40)
        c.plus(x, y, 3, 'a3', 'w')
    c.dring(cx, 54, 12 + f * 2, 'y2', parity=f, squash=0.3)


# ---- L16 측면 포격 ---------------------------------------------------------------------------------------------
@fx('gunboat_broadside', 'allTargets', 64, 10, pal(STEEL, ORANGE, FIRE, SMOKE, WHITE))
def broadside(c, f):
    # 포탑이 도는 동안 위에서 포탄이 줄줄이 떨어져 곳곳이 터진다
    spots = [(14, 44), (30, 30), (46, 46), (22, 16), (44, 20), (32, 52), (10, 26), (54, 34)]
    for i, (x, y) in enumerate(spots):
        t = f - i * 0.9
        if -1.2 <= t < 0:
            c.line([(x + 18, y - 40), (x, y)], 's3')
            c.cannonball(x + 18 * (-t) / 1.2 * 0 + (1 - (t + 1.2) / 1.2) * 0 + 0, y - 40 * (1 - (t + 1.2) / 1.2) * 0 - 0, 0) if False else None
        if 0 <= t < 1.0:
            c.star(x, y, 6, ['o2', 'o3', 'w'], pts=6)
        elif 1.0 <= t < 2.2:
            c.star(x, y, 13, ['e1', 'e2', 'e3', 'e4'], pts=9, rot=i)
            c.dring(x, y + 4, 12, 'o2', parity=i, squash=0.5)
        elif 2.2 <= t < 4.0:
            c.smoke(x, y - (t - 2.2) * 3, 6, ['q1', 'q2', 'q3'], seed=i)
        if -1.6 <= t < 0.1:  # 낙하 궤적
            u = (t + 1.6) / 1.7
            sx, sy = x + 16, y - 46
            px_, py_ = lerp(sx, x, u), lerp(sy, y, u)
            c.line([(lerp(sx, x, max(0, u - .35)), lerp(sy, y, max(0, u - .35))), (px_, py_)], 's4')
            c.cannonball(px_, py_, 2)
    for k in range(6):
        c.px(6 + k * 10, 58 - ((f * 4 + k * 6) % 12), 'q3')


# ---- L22 강철 요새 ----------------------------------------------------------------------------------------------
def turret_ring(c, cx, cy, r, ang, n=6, fire=0):
    for i in range(n):
        a = ang + i * math.tau / n
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r * 0.7
        c.disc(x, y, 5, 's0'); c.disc(x, y, 4, 's1'); c.px(x - 2, y - 2, 's3')
        # 포신(바깥쪽)
        ex, ey = x + math.cos(a) * 12, y + math.sin(a) * 9
        c.line([(x, y), (ex, ey)], 's2', 3)
        c.line([(x, y - 1), (ex, ey - 1)], 's3')
        if fire:
            c.star(ex + math.cos(a) * 3, ey + math.sin(a) * 2, 5 + fire, ['o1', 'o2', 'o3', 'w'], pts=7, rot=i)


@fx('gunboat_fortress', 'screen', 128, 12, pal(STEEL, ORANGE, FIRE, SMOKE, WHITE))
def fortress(c, f):
    cx, cy = 64, 76
    up = min(1.0, (f + 1) / 4.0)
    # 요새 벽: 밑에서 솟는 강철 성벽 + 흉벽
    h = 46 * up
    x0, x1 = 12, 116
    c.poly([(x0, cy + 30), (x0, cy + 30 - h), (x1, cy + 30 - h), (x1, cy + 30)], 's1')
    c.poly([(x0, cy + 30 - h), (x1, cy + 30 - h), (x1, cy + 30 - h + 6), (x0, cy + 30 - h + 6)], 's2')
    c.line([(x0, cy + 30 - h), (x1, cy + 30 - h)], 's4')
    for x in range(x0, x1, 8):
        c.rect(x, cy + 30 - h - 5, x + 4, cy + 30 - h, 's2')
        c.line([(x, cy + 30 - h - 5), (x + 4, cy + 30 - h - 5)], 's4')
    for x in range(x0 + 4, x1, 12):
        c.rect(x, cy + 30 - h + 12, x + 5, cy + 30 - h + 20, 's0')
    for y in (cy + 30 - h + 26, cy + 30 - h + 36):
        c.line([(x0, y), (x1, y)], 's0') if y < cy + 30 else None
    c.rect(x0, cy + 22, x1, cy + 30, 'o1'); c.line([(x0, cy + 22), (x1, cy + 22)], 'o2')  # 주황 띠
    # 회전하는 포탑 고리
    if f >= 2:
        turret_ring(c, cx, cy - 8, 40, f * 0.32, n=6, fire=1 if 5 <= f <= 9 else 0)
    if 5 <= f <= 9:
        for i in range(6):
            a = f * 0.32 + i * math.tau / 6
            bx = cx + math.cos(a) * 62
            by = cy - 8 + math.sin(a) * 40
            for k in range(3):
                c.line([(bx - k * 4, by - k), (bx - k * 4 - 12, by - k + 2)], 'w' if k == 1 else 'o3')
    if f >= 6:
        c.dring(cx, cy - 8, 30 + (f - 6) * 12, 'o2', parity=f, squash=0.6)
    if f >= 9:
        for i in range(5):
            c.smoke(20 + i * 22, cy - h + 8 - (f - 9) * 4, 8, ['q1', 'q2', 'q3'], seed=i + f)


@fx('gunboat_fortress_hit', 'target', 64, 8, pal(STEEL, ORANGE, FIRE, SMOKE, WHITE))
def fortress_hit(c, f):
    cx, cy = 32, 38
    # 사방에서 날아온 포탄이 한 점에 겹쳐 터진다: 큰 화구 + 충격파 링 + 파편
    if f <= 1:
        for k in range(6):
            a = k * 1.05
            r = 26 - f * 12
            c.line([(cx + math.cos(a) * r, cy + math.sin(a) * r * 0.8), (cx + math.cos(a) * (r + 10), cy + math.sin(a) * (r + 10) * 0.8)], 'o3')
            c.cannonball(cx + math.cos(a) * r, cy + math.sin(a) * r * 0.8, 2)
    if f >= 2:
        r = [0, 0, 14, 24, 28, 24, 18, 10][f]
        c.star(cx, cy, r, ['e0', 'e1', 'e2', 'e3', 'e4'], pts=11, rot=f * 0.35, inner=0.55)
        c.dring(cx, cy, 8 + (f - 2) * 8, 'w', parity=f + 1, squash=0.7)
        c.dring(cx, cy, 12 + (f - 2) * 8, 'o2', parity=f, squash=0.7)
    if f >= 3:
        for i in range(4):
            c.smoke(cx - 15 + i * 10, cy - 8 - (f - 3) * 4 - (i % 2) * 6, 5, ['q1', 'q2', 'q3', 'q4'], seed=i + f)
        for k in range(10):
            a = k * 0.63
            r = 6 + (f - 2) * 5
            c.px(cx + math.cos(a) * r * 1.3, cy + math.sin(a) * r, 's3' if k % 2 else 'o2')


if __name__ == '__main__':
    keys = sys.argv[1:] or None
    sys.exit(1 if run_module(sys.modules[__name__], 'vehicles-2', 64, keys, 'gunboat') else 0)
