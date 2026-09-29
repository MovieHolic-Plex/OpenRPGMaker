"""r2w6 b2 전차(tank) 이펙트 11장 — 포탄·기관총·장갑·로켓·궤도. 강철(STEEL)+화염(FIRE)+연기(SMOKE)+올리브(OLIVE)+흙(EARTH)."""
import math
import sys

from lib_r2w6 import *

OLIVE = dict(o0='#1e3018', o1='#3c5a28', o2='#6a8a3a', o3='#a8c060')


def smoke_trail(c, f, x0, y, n=4, keys=('q1', 'q2', 'q3')):
    """투사체 뒤(오른쪽)로 남는 연기 방울."""
    for i in range(n):
        x = x0 + 4 + i * 5 + (f % 2)
        r = 1 + i * 0.5
        c.disc(x, y + ((i + f) % 2) - 0.5, r, keys[min(len(keys) - 1, i // 2)])


def boom(c, cx, cy, f, big=1.0, keys=('e1', 'e2', 'e3', 'e4', 'w')):
    """0..7 프레임 폭발: 번쩍 → 불덩이 → 연기 기둥."""
    if f == 0:
        c.star(cx, cy, 10 * big, keys[2:], pts=8)
        c.disc(cx, cy, 3 * big, 'w')
    elif f <= 3:
        r = [0, 18, 22, 19][f] * big
        c.star(cx, cy, r, list(keys[:4]), pts=10, rot=f * 0.5, inner=0.6)
        c.dring(cx, cy + 8 * big, (10 + f * 7) * big, 'e3', parity=f, squash=0.3)
    if f >= 2:
        for i, (dx, dy, s) in enumerate(((-10, -6, 6), (9, -9, 6), (0, -15, 6), (-14, 4, 4), (14, 3, 4))):
            rise = (f - 2) * 3
            c.smoke(cx + dx * big * (1 + (f - 2) * 0.15), cy + dy * big - rise, s * big * max(0.5, 1 - (f - 5) * 0.12 if f > 5 else 1), ['q0', 'q1', 'q2', 'q3'], seed=i + f)
    if 3 <= f <= 6:
        c.flame(cx, cy + 10 * big, (12 - (f - 3) * 2.5) * big, 5 * big, ['e1', 'e2', 'e3'], seed=f, tongues=3)
    for k in range(8):
        a = k * 0.8 + 0.3
        d = (4 + f * 4) * big
        if f >= 1 and f <= 5:
            c.px(cx + math.cos(a) * d, cy + math.sin(a) * d * 0.8 - f, 's3' if k % 2 else 'e3')


# ---- L1 전차포 --------------------------------------------------------------------------------------------------
@fx('tank_shell', 'projectile', 32, 4, pal(STEEL, FIRE, SMOKE, WHITE))
def shell(c, f):
    # 뾰족한 철갑탄: 머리가 왼쪽, 뒤로 화염과 연기
    y = 16
    smoke_trail(c, f, 18, y)
    c.poly([(3, y), (9, y - 3), (19, y - 3), (19, y + 3), (9, y + 3)], 's1')
    c.poly([(4, y), (9, y - 2), (18, y - 2), (18, y), (9, y)], 's2')
    c.line([(7, y - 1), (17, y - 1)], 's3')
    c.rect(12, y - 3, 13, y + 3, 'e1')
    c.rect(19, y - 2, 20, y + 2, 's0')
    fl = [4, 6, 5, 7][f]
    c.poly([(21, y - 2), (21 + fl, y), (21, y + 2)], 'e2')
    c.poly([(21, y - 1), (21 + fl - 2, y), (21, y + 1)], 'e4')
    c.px(3, y, 'w')


@fx('tank_shell_hit', 'target', 64, 8, pal(STEEL, FIRE, SMOKE, WHITE))
def shell_hit(c, f):
    boom(c, 32, 38, f, big=1.1)
    if f <= 2:  # 관통 섬광 선
        c.line([(46, 38), (18, 38)], 'w', 2)


# ---- L3 기관총 소사 -----------------------------------------------------------------------------------------------
@fx('tank_mg', 'target', 64, 8, pal(FIRE, STEEL, SMOKE, EARTH, WHITE))
def mg(c, f):
    # 오른쪽에서 날아든 예광탄 줄이 몸에 박히며 작은 불꽃이 번갈아 튄다
    r = rng(5)
    hits = [(r.uniform(18, 46), r.uniform(22, 50)) for _ in range(12)]
    for i in range(3):
        y = 24 + ((f * 7 + i * 11) % 26)
        x1 = 34 + i * 4
        c.line([(x1, y), (63, y - 3)], 'e3')
        c.line([(x1, y), (x1 + 6, y - 1)], 'e4')
    for j, (x, y) in enumerate(hits):
        age = (f - j * 0.55)
        if 0 <= age < 1:
            c.spark(x, y, 4, 'w', 'e3')
        elif 1 <= age < 2.4:
            c.spark(x, y, 2, 'e4', 'e2')
            c.disc(x + 2, y - 2, 1.5, 'q2')
        elif 2.4 <= age < 4.5:
            c.disc(x + 2, y - 3 - age, 2, 'q1' if age > 3.5 else 'q2')
    for k in range(5):  # 튀는 탄피
        a = f * 0.9 + k * 1.3
        c.rect(54 + math.cos(a) * 4, 54 - ((f * 4 + k * 5) % 14), 55 + math.cos(a) * 4, 54 - ((f * 4 + k * 5) % 14), 'y2')
    c.dring(32, 57, 10 + (f % 3) * 3, 'd3', parity=f, squash=0.25)


# ---- L5 반응 장갑 ------------------------------------------------------------------------------------------------
@fx('tank_armor', 'user', 64, 8, pal(STEEL, OLIVE, FIRE, WHITE))
def armor(c, f):
    cx, cy = 32, 38
    # 장갑 블록이 몸 둘레로 날아와 붙고(0~3), 한 줄로 번쩍 터지며 충격을 되받는다(4~7)
    slots = [(-18, -12), (-6, -16), (6, -16), (18, -12), (-22, 0), (22, 0), (-18, 12), (18, 12)]
    for i, (dx, dy) in enumerate(slots):
        u = min(1.0, max(0.0, (f - i * 0.25) / 2.5))
        k = 1 - ease(u)
        x = cx + dx * (1 + k * 1.3)
        y = cy + dy * (1 + k * 1.3)
        if f < 5 or i % 2 == 0:
            c.rect(x - 4, y - 3, x + 4, y + 3, 'o0')
            c.rect(x - 3, y - 2, x + 3, y + 2, 'o2')
            c.line([(x - 3, y - 2), (x + 3, y - 2)], 'o3')
            c.px(x - 2, y, 's3'); c.px(x + 2, y, 's3')
        if f >= 5 and i % 2 == 1:
            c.star(x, y, 5 + (f - 5) * 2, ['e2', 'e3', 'w'], pts=6, rot=i)
    if f >= 3:
        c.dring(cx, cy, 24 + (f - 3) * 2, 's3', parity=f, squash=0.85)
    if f == 4:
        c.ring(cx, cy, 26, 'w', 1, 0.85)
    c.dring(cx, 56, 14 + f, 'o3', parity=f, squash=0.25)


# ---- L7 포탑 난사 -------------------------------------------------------------------------------------------------
@fx('tank_barrage', 'allTargets', 64, 10, pal(FIRE, SMOKE, STEEL, EARTH, WHITE))
def barrage(c, f):
    # 좌우로 쓸어가는 포탄 착탄: 네 곳이 차례로 터진다
    spots = [(12, 44), (26, 36), (40, 46), (52, 34), (32, 52)]
    for i, (x, y) in enumerate(spots):
        t = f - i * 1.4
        if 0 <= t < 5:
            boom(c, x, y, int(t * 1.5), big=0.55)
        elif -1 <= t < 0:
            c.line([(x + 10, y - 16), (x + 3, y - 5)], 'e3')
            c.px(x + 3, y - 5, 'w')
    if f >= 6:
        for k in range(3):
            c.smoke(14 + k * 18, 30 - (f - 6) * 3, 5, ['q1', 'q2', 'q3'], seed=k + f)
    c.dring(32, 56, 12 + f * 2, 'd3', parity=f, squash=0.25)


# ---- L10 다연장 로켓 ------------------------------------------------------------------------------------------------
@fx('tank_rocket', 'projectile', 32, 4, pal(STEEL, FIRE, SMOKE, ROSE, WHITE))
def rocket(c, f):
    # 로켓 두 발이 나란히: 붉은 탄두 왼쪽, 뒤로 불꽃과 구불구불한 연기
    for j, y in enumerate((11, 21)):
        o = (f + j * 2) % 4
        for i in range(4):
            c.disc(18 + i * 4, y + math.sin((i + o) * 1.4) * 1.5, 1 + i * 0.4, 'q3' if i < 2 else 'q2')
        c.poly([(3, y), (6, y - 2), (14, y - 2), (14, y + 2), (6, y + 2)], 's2')
        c.poly([(3, y), (6, y - 2), (7, y - 2), (7, y + 2), (6, y + 2)], 'r1')
        c.px(4, y - 1, 'r2')
        c.line([(8, y - 1), (13, y - 1)], 's3')
        c.poly([(12, y - 2), (15, y - 4), (15, y - 2)], 's1')
        c.poly([(12, y + 2), (15, y + 4), (15, y + 2)], 's1')
        fl = 3 + (o % 2) * 2
        c.poly([(15, y - 1), (15 + fl, y), (15, y + 1)], 'e3')
        c.px(15, y, 'e4')


@fx('tank_rocket_hit', 'allTargets', 64, 8, pal(FIRE, SMOKE, STEEL, WHITE))
def rocket_hit(c, f):
    for i, (x, y, d) in enumerate(((20, 40, 0), (42, 34, 1), (32, 50, 2))):
        t = f - d
        if t >= 0:
            boom(c, x, y, t, big=0.7)


# ---- L12 캐터필러 압살 --------------------------------------------------------------------------------------------
@fx('tank_crush', 'target', 64, 8, pal(STEEL, EARTH, OLIVE, SMOKE, WHITE))
def crush(c, f):
    # 궤도가 오른쪽→왼쪽으로 적 위를 굴러 지나가며 땅에 바퀴 자국과 흙을 남긴다
    y0 = 44
    x = [50, 40, 28, 16, 4, -8, -20, -30][f]
    # 지나간 자국(궤도 뒤쪽 = 오른쪽)
    for gx in range(int(max(0, x + 30)), 64, 4):
        c.rect(gx, 54, gx + 1, 56, 'd1')
    c.line([(max(0, x + 30), 57), (63, 57)], 'd0')
    if -30 < x < 64:
        c.rect(x, y0, x + 30, y0 + 12, 's0')
        c.rect(x + 1, y0 + 1, x + 29, y0 + 3, 's1')
        for k in range(6):
            wx = x + 3 + k * 5 + (f % 2) * 2
            c.disc(wx, y0 + 8, 2, 's2')
            c.px(wx, y0 + 8, 's0')
        for k in range(8):
            c.px(x + 1 + ((k * 4 + f * 2) % 29), y0, 's3')
        c.rect(x + 2, y0 - 6, x + 28, y0 - 1, 'o1')
        c.line([(x + 2, y0 - 6), (x + 28, y0 - 6)], 'o3')
    if 1 <= f <= 5:  # 짓밟는 순간의 먼지·파편
        cx = x + 4
        c.smoke(cx - 2, 50, 5, ['d1', 'd2', 'd3'], seed=f)
        c.debris(cx, 46, 8, 12, 'd2', seed=f, rise=1.0, k2='d3')
        if f in (2, 3):
            c.star(32, 46, 9, ['s3', 'w'], pts=6, rot=f)
    if f >= 5:
        c.smoke(32, 48 - (f - 5) * 4, 6, ['d1', 'd2', 'd3'], seed=f + 4)


# ---- L16 진지 구축 ------------------------------------------------------------------------------------------------
@fx('tank_bunker', 'allAllies', 64, 10, pal(EARTH, OLIVE, STEEL, GOLD, WHITE))
def bunker(c, f):
    # 앞(왼쪽)에 모래주머니가 한 줄씩 쌓이고, 철조망이 쳐지고, 마지막에 방어막처럼 번쩍
    base = 56
    rows = [(10, 5), (12, 4), (14, 3)]
    n = 0
    for ri, (x0, cnt) in enumerate(rows):
        for j in range(cnt):
            if f * 1.4 > n:
                drop = max(0, 6 - (f * 1.4 - n) * 4)
                x = x0 + j * 7 + ri
                y = base - ri * 5 - drop
                c.oval(x + 3, y, 4, 2.6, 'd1')
                c.oval(x + 3, y - 0.5, 3, 1.6, 'd3')
                c.px(x + 3, y, 'd2')
            n += 1
    if f >= 5:  # 철조망 기둥과 가시줄
        for px_ in (8, 24, 40):
            c.line([(px_, base), (px_, base - 16)], 's1')
        u = min(1, (f - 5) / 3)
        xe = 8 + 32 * u
        for yy in (base - 14, base - 9):
            pts = [(x, yy + (1 if (x // 3) % 2 else -1)) for x in range(8, int(xe) + 1, 3)]
            if len(pts) > 1:
                c.line(pts, 's2')
            for x in range(8, int(xe) + 1, 6):
                c.px(x, yy - 2, 's3')
    # 오른쪽 아군 쪽 깃발
    c.line([(52, base), (52, base - 26)], 't1')
    wv = f % 2
    c.poly([(52, base - 26), (61, base - 24 + wv), (52, base - 20)], 'o2')
    c.px(55, base - 23, 'o3')
    if f >= 8:
        c.dring(32, 38, 26, 'y2', parity=f, squash=0.8)
        c.spark(20, 22, 3 if f == 8 else 2, 'w', 'y2'); c.spark(46, 30, 2, 'w', 'y2')


# ---- L22 대구경 공성포 --------------------------------------------------------------------------------------------
@fx('tank_mega', 'screen', 128, 12, pal(FIRE, STEEL, SMOKE, GOLD, WHITE))
def mega(c, f):
    cy = 70
    # 오른쪽에서 거대한 포구가 번쩍 → 화면을 가로지르는 포탄 광선 → 왼쪽 적진 대폭발
    if f <= 3:
        # 포구 섬광(오른쪽)
        r = [8, 18, 26, 16][f]
        c.star(100, cy, r, ['e1', 'e2', 'e3', 'e4', 'w'], pts=10, rot=f * 0.3)
        c.rect(102, cy - 8, 114, cy + 8, 's0'); c.rect(102, cy - 6, 114, cy - 4, 's2')
    if 2 <= f <= 6:
        x = [0, 0, 88, 70, 52, 40, 36][f]
        c.rect(x, cy - 5, 102, cy + 5, 'e2')
        c.rect(x, cy - 3, 102, cy + 3, 'e3')
        c.rect(x, cy - 1, 102, cy + 1, 'w')
        c.ball(x, cy, 7, 's0', 's1', 's3', 'w')
        for k in range(max(0, int((102 - x) // 16))):
            c.line([(x + 10 + k * 16, cy - 10 - (k % 2) * 4), (x + 22 + k * 16, cy - 10 - (k % 2) * 4)], 'y2')
            c.line([(x + 14 + k * 16, cy + 10 + (k % 2) * 4), (x + 26 + k * 16, cy + 10 + (k % 2) * 4)], 'y2')
    if f >= 6:
        t = f - 6
        r = [20, 32, 38, 40, 36, 30][t]
        c.star(44, cy, r, ['e0', 'e1', 'e2', 'e3', 'e4'], pts=12, rot=t * 0.3, inner=0.66)
        if t <= 1:
            c.disc(44, cy, 10 + t * 6, 'w')
        c.dring(44, cy + 18, 24 + t * 12, 'y2', parity=f, squash=0.3)
        if t >= 2:
            for i in range(6):
                a = -math.pi / 2 + (i - 2.5) * 0.45
                d = 20 + t * 5
                c.smoke(44 + math.cos(a) * d, cy - 10 + math.sin(a) * d * 0.7 - t * 2, 9 - i % 2, ['q0', 'q1', 'q2', 'q3'], seed=i + f)
        for k in range(14):
            a = k * 0.45
            d = 20 + t * 9
            c.px(44 + math.cos(a) * d, cy + math.sin(a) * d * 0.7, 'e4' if k % 2 else 's3')
    # 화면 흔들림 줄
    if f in (6, 7):
        for y in (32, 100):
            c.line([(24, y), (104, y)], 'y2')


@fx('tank_mega_hit', 'target', 64, 8, pal(FIRE, STEEL, SMOKE, GOLD, WHITE))
def mega_hit(c, f):
    boom(c, 32, 38, f, big=1.3)
    if f <= 1:
        c.disc(32, 38, 6, 'w')


if __name__ == '__main__':
    keys = sys.argv[1:] or None
    sys.exit(1 if run_module(sys.modules[__name__], 'vehicles-5', 64, keys, 'tank') else 0)

