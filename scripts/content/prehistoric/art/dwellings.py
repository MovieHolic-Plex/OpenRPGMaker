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


def round_hut(c, W, H, door_tile, roof='thatch', wall='daub', s=0, apex_knot=True, wall_h=18, door_h=25, roof_top=3):
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
    if roof == 'thatch': thatch_cone(c, cx, roof_top, cx, ey, rx, ry, s=s, power=0.55)
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
def _(c): round_hut(c, 3, 4, 1, s=1, wall_h=20, door_h=25)


@R.add('hut-thatch-l', '이엉 둥근 움집(큰)', 5, 5, 'structure', tags=['움집', '집', '마을'], entrance=[2],
       rules='마을 중심 가까이. 문은 모닥불 광장 쪽(남쪽).')
def _(c): round_hut(c, 5, 5, 2, s=4, wall_h=24, door_h=26)


@R.add('hut-log', '통나무 벽 둥근 움집', 3, 4, 'structure', tags=['움집', '집', '통나무'], entrance=[1],
       rules='숲가 마을. 이엉 움집과 섞어 둔다.')
def _(c): round_hut(c, 3, 4, 1, wall='log', s=7, wall_h=20, door_h=25)


# ═══════════════════════ 가죽 천막(원뿔) ═══════════════════════
def tipi(c, W, H, door_tile, s=0, band=True, poles=True, deco=None):
    w, h = W * 16, H * 16
    cx = w / 2; base_y = h - 2
    ax, ay = cx, 6
    rx = w / 2 - 2; ry = 4
    ey = base_y - ry
    hide_cone(c, ax, ay, cx, ey, rx, ry, s=s)
    # 기둥 끝(꼭대기 위로 엇갈려 솟는다)
    if poles:
        for k, (dx, top) in enumerate(((-5, 0), (-2, 1), (2, 0), (5, 2), (0, 2))):
            c.line(int(ax) + dx, top, int(ax) + dx // 2, ay + 3, 'bark', 4 if dx < 0 else 2)
        # 연기 구멍(꼭대기 어둡게) + 바람막이 날개
        for j in range(ay, ay + 4):
            for i in range(-1, 2):
                if c.get(int(ax) + i, j): c.P(int(ax) + i, j, 'ink', 1)
        c.line(int(ax) - 2, ay + 1, int(ax) - 5, ay + 6, 'hide', 4); c.line(int(ax) + 2, ay + 1, int(ax) + 5, ay + 6, 'hide', 2)
    # 황토 띠(추상 지그재그)
    if band:
        yb = int(base_y - (base_y - ay) * 0.38)
        for x in range(c.w):
            g = c.get(x, yb)
            if not g or g[0] != 'hide': continue
            for k in range(3):
                g2 = c.get(x, yb + k)
                if g2 and g2[0] == 'hide': c.P(x, yb + k, 'ochre', 2 + (1 if x < cx else 0) - (1 if k == 2 else 0))
            z = (x // 2) % 4
            zz = yb - 1 + (z if z < 2 else 3 - z)
            g3 = c.get(x, zz)
            if g3 and g3[0] == 'hide' and (x // 2) % 2 == 0: c.P(x, zz, 'feather', 2)
    # 출입구: 가죽 자락을 젖힌 아치 문
    dx0 = door_tile * 16 + 1; dw = 14; dh = 25
    dy0 = base_y - dh
    doorway(c, dx0, dy0, dw, dh, arch=7, curtain=None)
    # 젖혀 묶은 자락(양옆 삼각)
    for j in range(dh - 3):
        k = j // 4
        for i in range(min(k, 3)):
            c.P(dx0 - 1 - i, dy0 + 4 + j, 'hide', 4 - (i > 1))
        c.P(dx0 + dw + min(k, 2), dy0 + 4 + j, 'hide', 2)
    c.HL(dx0 - 2, dy0 + 12, 3, 'bark', 2)
    # 말뚝(밑 가장자리 고정)
    for x in range(3, w - 3, 7):
        g = c.get(x, base_y)
        if g and g[0] == 'hide': c.P(x, base_y, 'bark', 3); c.P(x, base_y + 1, 'bark', 1)
    if deco: deco(c, ax, ay, base_y)
    for x in range(c.w):
        if c.get(x, base_y) and not c.get(x, base_y + 1): c.P(x, base_y + 1, 'ink', 1)
    c.outline(bottom=('ink', 1))


@R.add('tipi', '가죽 원뿔 천막', 3, 4, 'structure', tags=['천막', '집', '가죽'], entrance=[1],
       rules='사냥 야영지·마을 가장자리. 문 앞 두 칸을 비운다.')
def _(c): tipi(c, 3, 4, 1, s=2)


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
def _(c): tipi(c, 3, 5, 1, s=5, deco=shaman_deco)


# ═══════════════════════ 매머드 뼈 집 ═══════════════════════
@R.add('bone-hut', '매머드 뼈 집(엄니 아치 + 턱뼈 담)', 5, 4, 'structure', tags=['뼈', '매머드', '집'], entrance=[2],
       rules='추운 들판·사냥꾼 마을. 문 앞 두 칸을 비운다. 둘레에 뼈 더미를 둔다.')
def _(c):
    w, h = 80, 64; cx = 40; base_y = 62
    dome_by = base_y - 10                           # 돔 밑(턱뼈 담 위)
    RX, RY = 37, 44
    sd = seeds(0, 0, w, h, 13, 21)
    # 가죽·털 덮개 돔: 둥근 빛(왼쪽 위 밝게), 조각(보로노이)마다 가죽/털, 이음 솔기 어둡게
    for y in range(2, dome_by + 1):
        for x in range(2, 78):
            dx = (x + 0.5 - cx) / RX; dy = (y + 0.5 - dome_by) / RY
            d = dx * dx + dy * dy
            if d > 1: continue
            (sx, sy, k), d1, d2 = near2(x, y, sd)
            mat = 'fur' if k % 3 == 0 else 'hide'
            nl = -dx * 0.7 - dy * 0.7                # 왼쪽 위 법선 빛
            t = 2 + (1 if nl > 0.35 else 0) + (1 if nl > 0.75 else 0) - (1 if nl < -0.2 else 0) - (1 if d > 0.86 else 0)
            if mat == 'fur': t = min(4, t + 0)
            if d2 - d1 < 1.1: t = 1 if mat == 'hide' else 0
            elif mat == 'fur' and (x + y * 2) % 4 == 0: t -= 1     # 털 결
            c.P(x, y, mat, max(0, min(5 if mat == 'hide' else 4, t)))
    # 엄니 아치(앞쪽 두 쌍이 돔 위로 휘어 문 위에서 만난다) + 뒤쪽 갈비 막대
    for (rx, ry, a0, a1) in ((34, 40, 192, 262), (34, 40, 348, 278), (22, 34, 196, 262), (22, 34, 344, 278)):
        tusk_arc(c, cx, dome_by + 2, rx, ry, a0, a1, width=3)
    # 턱뼈 담: 갈매기 모양 아래턱뼈가 엇갈려 쌓였다(두 줄)
    for row in range(2):
        y0 = dome_by - 1 + row * 5
        off = 0 if row == 0 else 4
        for k in range(-1, 11):
            bx = 2 + k * 8 + off
            for j in range(5):
                for i in range(8):
                    x = bx + i
                    if x < 2 or x > 77: continue
                    # V 자 턱뼈: 가운데가 처지고 양 끝이 올라간다
                    yy = j - (abs(i - 3.5) > 2.5) * 1
                    if yy < 0 or yy > 3: continue
                    u = x / 80
                    t = 4 + (1 if u < 0.3 else 0 if u < 0.7 else -1) + (1 if yy == 0 else 0) - (1 if yy == 3 else 0)
                    if i == 7: t = 1
                    c.P(x, y0 + j, 'bone', max(1, min(5, t)))
            if row == 0:
                c.P(bx + 2, y0 + 2, 'bone', 1)          # 이빨 구멍
    # 출입구(엄니 두 개가 문틀)
    dx0, dw, dh = 33, 14, 25
    dy0 = base_y - dh
    doorway(c, dx0, dy0, dw, dh, arch=7, curtain='fur')
    tusk_arc(c, dx0 + dw // 2, dy0 + 12, 9, 13, 180, 272, width=2)
    tusk_arc(c, dx0 + dw // 2, dy0 + 12, 9, 13, 360, 268, width=2)
    # 꼭대기 매머드 머리뼈(추상, 위에서 본 둥근 윗면 + 눈구멍)
    sx, sy = int(cx) - 6, 0
    for j in range(8):
        for i in range(12):
            dx = (i + 0.5 - 6) / 6; dy = (j + 0.5 - 4) / 4
            if dx * dx + dy * dy <= 1:
                c.P(sx + i, sy + j, 'bone', 5 if dx + dy < -0.5 else 4 if dx < 0.3 else 3 if dy < 0.6 else 2)
    c.P(sx + 3, sy + 4, 'ink', 1); c.P(sx + 8, sy + 4, 'ink', 1); c.P(sx + 4, sy + 4, 'bone', 1)
    for x in range(c.w):
        if c.get(x, base_y) and not c.get(x, base_y + 1): c.P(x, base_y + 1, 'ink', 1)
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
            t = 3
            if left_hip: t = 4
            if right_hip: t = 2
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
        for k in range(3):
            g = c.get(x, wall_top + 4 + k)
            if g and g[0] == 'bark': c.P(x, wall_top + 4 + k, 'bark', max(0, g[1] - (3 - k)))
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
    w, h = 80, 64; base_y = 62; cx = 40
    # 둔덕: 위에서 보이는 뗏장(풀) 돔 + 밑둘레 흙 앞면
    for y in range(4, base_y + 1):
        for x in range(1, 79):
            dx = (x + 0.5 - cx) / 39; dy = (y + 0.5 - 46) / 42
            d = dx * dx + dy * dy
            if d > 1 or y > base_y: continue
            front = y > 50 - 4 * (1 - dx * dx)
            if not front:
                gm, gt = T.p_grass(x % 16, y % 16)
                nl = -dx * 0.6 - dy * 0.8
                t = gt + (1 if nl > 0.45 else 0) - (1 if nl < -0.1 else 0) - (1 if d > 0.88 else 0)
                c.P(x, y, 'grass' if gm != 'bloom' else gm, max(1, min(5, t)) if gm != 'bloom' else gt)
            else:
                u = (x - 1) / 78
                t = 3 + lit(u) - (1 if y > base_y - 3 else 0)
                if (x + y) % 5 == 0: t -= 1
                c.P(x, y, 'dirt', max(1, min(6, t)))
    # 풀 끝이 흙 앞면 위로 처진다
    for x in range(2, 78):
        ys = [y for y in range(c.h) if c.get(x, y) and c.get(x, y)[0] == 'grass']
        if ys and h32(x // 2, 5, 3) % 3 == 0: c.P(x, max(ys) + 1, 'grass', 2)
    # 연기 구멍(꼭대기 테 + 김)
    c.ell(cx, 12, 5, 2.4, lambda x, y, dx, dy, d: ('bark', 4) if d > 0.5 else ('ink', 0))
    # 현관(통나무 틀 + 작은 뗏장 지붕)
    vx0, vw = 29, 22
    for y in range(32, base_y + 1):
        for x in range(vx0, vx0 + vw):
            c.P(x, y, *log_wall(x, y, (x - vx0 + 0.5) / vw, y - 32, s=6))
    for y in range(26, 34):
        for x in range(vx0 - 3, vx0 + vw + 3):
            gm, gt = T.p_grass(x % 16, y % 16)
            c.P(x, y, 'grass', max(1, min(5, (gt if gm == 'grass' else 3) + (1 if y < 29 else 0) - (1 if x > vx0 + vw - 2 else 0))))
    for x in range(vx0 - 3, vx0 + vw + 3): c.P(x, 34, 'grass', 1); c.P(x, 35, 'bark', 1)
    dx0, dw, dh = 33, 14, 25
    doorway(c, dx0, base_y - dh, dw, dh, arch=4, curtain='hide')
    for x in range(c.w):
        if c.get(x, base_y) and not c.get(x, base_y + 1): c.P(x, base_y + 1, 'ink', 1)
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
    for x in (5, 24):
        for y in range(28, 46): c.P(x, y, 'bark', 4); c.P(x + 1, y, 'bark', 3); c.P(x + 2, y, 'bark', 1)
    # 판자 바닥(윗면 보인다)
    for x in range(3, 29):
        c.P(x, 26, 'bark', 5); c.P(x, 27, 'bark', 4); c.P(x, 28, 'bark', 2)
    # 몸통(엮은 벽)
    cyl_wall(c, 5, 14, 22, 12, lambda x, y, u, j: ('thatch', max(0, min(5, 2 + lit(u) + (1 if (x + (y // 2)) % 3 == 0 else 0) - (1 if y % 2 else 0)))))
    thatch_cone(c, 16, 1, 16, 15, 15.5, 4, s=9, power=0.6)
    # 사다리
    for y in range(28, 46, 1):
        c.P(12, y, 'bark', 4); c.P(18, y, 'bark', 3)
        if y % 4 == 0: c.HL(12, y, 7, 'bark', 4)
    c.outline(bottom=('ink', 1))


if __name__ == '__main__':
    R.export()
    ims = [(it['id'], R.render(it).img()) for it in R.items]
    contact(ims, os.path.join(OUT, 'dwellings', 'preview.png'), z=3, W=1900, bg=(138, 95, 58))
    print(len(R.items), 'dwellings')
