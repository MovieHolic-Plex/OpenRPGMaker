#!/usr/bin/env python3
"""sky_island 건물 — 3/4 탑뷰(지붕 윗면·경사면이 위에서 보인다 + 남쪽 벽면 + 기단·접지 그늘), 빛 왼쪽 위.

사람(16×24) 기준 축척: 한 층 벽 높이 32~36px, 문 = 칸 하나 폭(틀 포함 16px) × 높이 26~28px(맨 아랫줄 + 윗줄 10~12px).
문 칸은 건물 맨 아랫줄의 entrance 칸(막힘)이고 바로 아래 칸이 접근칸이다.

  python3 buildings.py   → tiledata/sky-island/buildings/_gate/*.png + items.jsonl
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, clamp, blob, box3, NT, MI
from kit import Reg

R = Reg('buildings')
A = R.add


# ═══════════════════════ 부품 ═══════════════════════
def ground_shadow(c, x0, x1, y):
    """건물 발밑 접지 그늘(풀 위, 불투명 짙은 풀 1~2행)."""
    c.HL(x0, y, x1 - x0, 'grass', 1)
    c.HL(x0 + 2, y - 1, x1 - x0 - 4, 'grass', 2) if False else None


def foundation(c, x0, x1, y0, y1, mat='stone'):
    """돌 기단: 윗면 1px 밝게 + 앞면 돌(덩이 줄눈) + 바닥 어두운 선."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            j = (x + (3 if (y - y0) % 4 >= 2 else 0)) % 7
            t = 3 if j == 0 else 4
            if (y - y0) % 4 == 3: t = 2
            c.P(x, y, mat, t)
    c.HL(x0, y0, x1 - x0, mat, 5); c.HL(x0, y1 - 1, x1 - x0, mat, 1)
    c.VL(x0, y0, y1 - y0, mat, 2); c.VL(x1 - 1, y0, y1 - y0, mat, 1)


def plaster(c, x0, y0, x1, y1, mat='cream', base=4, s=1):
    for y in range(y0, y1):
        for x in range(x0, x1):
            t = base
            r = rnd(x, y, s)
            if r < 0.06: t = base - 1
            elif r > 0.97: t = base + 1
            c.P(x, y, mat, t)
    c.VL(x0, y0, y1 - y0, mat, base + 1)


def planks_v(c, x0, y0, x1, y1, mat='wood', base=4, s=1):
    """세로 널벽: 4px 널, 널 사이 어두운 틈, 널마다 한 단 차이, 나뭇결 점."""
    for x in range(x0, x1):
        k = (x - x0) // 4; lx = (x - x0) % 4
        b = base + (1 if h32(k, s, 3) % 3 == 0 else 0) - (1 if h32(k, s, 4) % 4 == 0 else 0)
        for y in range(y0, y1):
            t = b
            if lx == 3: t = b - 2
            elif lx == 0: t = b + 1
            if rnd(x, y, s) < 0.05: t -= 1
            c.P(x, y, mat, t)


def stone_wall(c, x0, y0, x1, y1, mat='stone', base=4, s=1):
    """다듬은 돌벽: 5px 줄, 어긋난 돌, 줄눈 어둡게, 돌 윗선 밝게."""
    for y in range(y0, y1):
        row = (y - y0) // 5; yy = (y - y0) % 5
        for x in range(x0, x1):
            xx = (x - x0 + (4 if row % 2 else 0)) % 9
            if yy == 4 or xx == 8: c.P(x, y, mat, base - 2); continue
            v = h32((x - x0 + (4 if row % 2 else 0)) // 9, row, s) % 5
            t = base + (1 if v == 0 else -1 if v == 4 else 0)
            if yy == 0: t += 1
            c.P(x, y, mat, t)


def timber(c, x0, y0, x1, y1, xs=(), ys=(), mat='wood'):
    """목조 뼈대(반목조 벽): 세로 기둥 xs, 가로 보 ys, 양끝 기둥."""
    for x in (x0, x1 - 2) + tuple(xs):
        c.R(x, y0, 2, y1 - y0, mat, 2); c.VL(x, y0, y1 - y0, mat, 3)
    for y in ys:
        c.R(x0, y, x1 - x0, 2, mat, 2); c.HL(x0, y, x1 - x0, mat, 3)


def window(c, x, y, w=10, h=10, frame=('wood', 2), shutters=True, box=True, lit=False, s=0):
    """창: 틀 1px · 유리(위 반사 밝게, 사선 반사) · 십자 창살 · 덧문(좌우) · 아래 꽃상자."""
    fm, ft = frame
    c.R(x, y, w, h, fm, ft)
    for j in range(1, h - 1):
        for i in range(1, w - 1):
            t = 4 if j < 3 else 3 if j < h // 2 else 2
            if (i + j + s) % 7 in (0, 1) and j > 1: t = 5
            if lit: t = 3 if j < h - 2 else 2
            c.P(x + i, y + j, 'glow' if lit else 'crystal', t if not lit else min(4, t + 1))
    c.VL(x + w // 2, y + 1, h - 2, fm, ft); c.HL(x + 1, y + h // 2, w - 2, fm, ft)
    c.HL(x, y, w, fm, ft + 2); c.VL(x, y, h, fm, ft + 1); c.HL(x + 1, y + 1, w - 2, 'sumi', 1)
    if shutters:
        for sx in (x - 3, x + w):
            c.R(sx, y, 3, h, 'roofb', 3); c.VL(sx, y, h, 'roofb', 4); c.VL(sx + 2, y, h, 'roofb', 1)
            for j in range(1, h, 3): c.HL(sx, y + j, 3, 'roofb', 2)
    if box:
        c.R(x - 1, y + h, w + 2, 3, 'wood', 3); c.HL(x - 1, y + h, w + 2, 'wood', 5); c.HL(x - 1, y + h + 2, w + 2, 'wood', 1)
        for i in range(w):
            if rnd(i, 1, s + 5) < 0.75:
                c.P(x + i, y + h - 1, 'leaf', 4 if i % 2 else 3)
                if rnd(i, 2, s + 5) < 0.45: c.P(x + i, y + h - 2, 'flower', 3 if i % 3 else 4)
            if i % 3 == 1: c.P(x + i, y + h, 'leaf', 5)


def door(c, x, ybot, w=14, h=27, mat='wood', arch=True, step=True, frame='stone'):
    """문(사람 키 높이): 틀(돌) + 세로 널 문짝 + 둥근 윗머리 + 손잡이 + 문턱. x = 틀 왼쪽, ybot = 문턱 아래 끝(배타)."""
    y0 = ybot - h
    c.R(x, y0, w, h, frame, 3)
    c.VL(x, y0, h, frame, 5); c.VL(x + w - 1, y0, h, frame, 2); c.HL(x, y0, w, frame, 5)
    ix, iw = x + 2, w - 4
    iy = y0 + 2
    for yy in range(iy, ybot - (2 if step else 0)):
        for xx in range(ix, ix + iw):
            if arch:
                top = iy + (2 if xx in (ix, ix + iw - 1) else 1 if xx in (ix + 1, ix + iw - 2) else 0)
                if yy < top: c.P(xx, yy, frame, 2); continue
            k = (xx - ix) // 3
            t = 4 if k % 2 else 3
            if (xx - ix) % 3 == 2: t = 2
            c.P(xx, yy, mat, t)
    c.HL(ix, iy + (1 if arch else 0), iw, 'sumi', 1) if not arch else None
    for yy in (iy + 6, ybot - 9):
        c.HL(ix, yy, iw, 'iron', 2)
    c.P(ix + iw - 3, ybot - 13, 'brass', 5); c.P(ix + iw - 3, ybot - 12, 'brass', 3)
    if step:
        c.R(x - 1, ybot - 2, w + 2, 2, 'stone', 4); c.HL(x - 1, ybot - 2, w + 2, 'stone', 6); c.HL(x - 1, ybot - 1, w + 2, 'stone', 2)


def shingle_slope(c, x0, x1, y0, y1, mat='roofr', base=4, s=1, taper=0):
    """앞(남향) 경사 지붕면: 4px 줄 비늘 기와(어긋난 홈), 줄마다 아래 테 그늘, 위로 갈수록 밝다. taper = 양 끝을 위로 갈수록 들이는 정도(모임지붕)."""
    H = y1 - y0
    for y in range(y0, y1):
        u = (y - y0) / max(1, H - 1)
        inset = int(round(taper * (1 - u)))
        row = (y - y0) // 4; yy = (y - y0) % 4
        b = base + (1 if u < 0.35 else 0) - (1 if u > 0.8 else 0)
        for x in range(x0 + inset, x1 - inset):
            xx = (x + (3 if row % 2 else 0)) % 6
            t = b
            if yy == 3: t = b - 2
            elif yy == 0: t = b + 1
            if xx == 5 and yy < 3: t = b - 1
            if rnd(x, y, s) < 0.05: t -= 1
            c.P(x, y, mat, t)
        if x1 - inset - 1 > x0 + inset:
            c.P(x0 + inset, y, mat, 1); c.P(x1 - inset - 1, y, mat, 1)


def gable_roof(c, x0, x1, ytop, yeave, mat='roofr', s=1, back=5):
    """맞배지붕(용마루 동서): 뒤 경사면 띠(back 행, 밝게 — 하늘을 향함) + 용마루 + 앞 경사면(큰 면) + 처마 끝 + 처마 밑 그늘."""
    # 뒤 경사면(위에서 보면 얇은 밝은 띠)
    for y in range(ytop, ytop + back):
        for x in range(x0 + 2, x1 - 2):
            t = 5 if (x // 3 + y) % 2 else 6
            if y == ytop: t = 3
            c.P(x, y, mat, t)
    ry = ytop + back
    c.HL(x0 + 1, ry, x1 - x0 - 2, mat, 6); c.HL(x0 + 1, ry + 1, x1 - x0 - 2, mat, 2)          # 용마루 기와
    for x in range(x0 + 1, x1 - 1, 4): c.P(x, ry, mat, 4)
    shingle_slope(c, x0, x1, ry + 2, yeave, mat, 4, s)
    c.HL(x0, yeave, x1 - x0, mat, 1); c.HL(x0, yeave - 1, x1 - x0, mat, 3)                     # 처마 끝
    c.VL(x0, ytop + 1, yeave - ytop, mat, 1); c.VL(x1 - 1, ytop + 1, yeave - ytop, mat, 1)
    c.P(x0 + 1, ytop, mat, 1); c.P(x1 - 2, ytop, mat, 1); c.HL(x0 + 2, ytop - 1, x1 - x0 - 4, 'sumi', 1) if ytop > 0 else None


def eave_shadow(c, x0, x1, y, rows=2, mat='cream'):
    """처마 밑 벽 그늘(벽 재질 두 단 내리기)."""
    for k in range(rows):
        for x in range(x0, x1):
            g = c.get(x, y + k)
            if g: c.P(x, y + k, g[0], max(0, g[1] - (2 - k)))


def chimney(c, x, y, w=7, h=12, mat='stone'):
    """굴뚝: 윗면(구멍 어둡게) 3행 + 앞면 돌."""
    c.R(x, y, w, 3, mat, 5); c.R(x + 1, y + 1, w - 2, 1, 'sumi', 1); c.HL(x, y, w, mat, 3)
    stone_wall(c, x, y + 3, x + w, y + h, mat, 3, 9)
    c.VL(x, y, h, mat, 1); c.VL(x + w - 1, y, h, mat, 1)


def lantern(c, x, y, lit=True):
    """처마에 매단 등불(5×7): 쇠 고리 + 유리 등(빛) + 받침."""
    c.VL(x + 2, y, 2, 'iron', 2)
    c.R(x, y + 2, 5, 5, 'iron', 2); c.R(x + 1, y + 3, 3, 3, 'glow', 4 if lit else 1); c.P(x + 1, y + 3, 'glow', 4); c.HL(x, y + 2, 5, 'iron', 4)
    c.HL(x + 1, y + 7, 3, 'iron', 1)


def outline_bottom(c, x0, x1, y):
    c.HL(x0, y, x1 - x0, 'sumi', 1)


# ═══════════════════════ 건물 ═══════════════════════
@A('cottage-red', '빨간 지붕 오두막(회벽·목조)', 4, 5, 'structure', ['집', '오두막', '마을'], '문(가운데 왼쪽 칸) 바로 아래 접근칸은 디딤돌 길로 비운다.', entrance=[1])
def _(c):
    W, H = 64, 80
    # 벽
    plaster(c, 3, 42, 61, 74, 'cream', 4, 2)
    timber(c, 3, 42, 61, 74, xs=(30,), ys=(42, 56))
    c.R(3, 72, 58, 2, 'wood', 2)
    eave_shadow(c, 3, 61, 44, 2)
    foundation(c, 2, 62, 74, 80)
    door(c, 17, 79, 14, 27)
    window(c, 40, 50, 12, 12, s=1)
    window(c, 8, 59, 6, 7, shutters=False, box=False, s=3) if False else None
    # 지붕
    gable_roof(c, 0, 64, 3, 43, 'roofr', s=1, back=5)
    chimney(c, 44, 0, 7, 12)
    c.R(44, 12, 7, 2, 'roofr', 2)
    lantern(c, 33, 45)


@A('cottage-blue', '푸른 슬레이트 지붕 집(널벽)', 5, 5, 'structure', ['집', '마을'], '문(가운데 칸) 바로 아래 접근칸은 비운다.', entrance=[2])
def _(c):
    planks_v(c, 3, 40, 77, 74, 'wood', 4, 3)
    c.HL(3, 40, 74, 'wood', 1)
    eave_shadow(c, 3, 77, 41, 2)
    foundation(c, 2, 78, 74, 80)
    door(c, 33, 79, 14, 27, frame='wood')
    window(c, 10, 49, 12, 11, s=2)
    window(c, 58, 49, 12, 11, s=4)
    gable_roof(c, 0, 80, 2, 41, 'roofb', s=3, back=4)
    lantern(c, 26, 43); lantern(c, 49, 43)


@A('tower-house', '돌탑 집(원뿔 지붕)', 3, 6, 'structure', ['집', '탑', '마을'], '가운데 칸이 문. 섬 끝 전망 자리.', entrance=[1])
def _(c):
    W = 48
    cx = 24
    # 둥근 몸통(앞면, 원통 명암: 왼쪽 밝게 → 오른쪽 어둡게)
    for y in range(40, 92):
        for x in range(5, 43):
            u = (x - 5) / 37
            base = 5 if u < 0.25 else 4 if u < 0.55 else 3 if u < 0.85 else 2
            row = (y - 40) // 5; yy = (y - 40) % 5
            xx = (x + (4 if row % 2 else 0)) % 8
            t = base
            if yy == 4 or xx == 7: t = base - 2
            elif yy == 0: t += 1 if base < 5 else 0
            c.P(x, y, 'stone', clamp(t, 0, 6))
    c.VL(5, 40, 52, 'stone', 1); c.VL(42, 40, 52, 'stone', 1)
    # 위 둘레 띠(처마 밑)
    c.R(4, 38, 40, 4, 'wood', 3); c.HL(4, 38, 40, 'wood', 5); c.HL(4, 41, 40, 'wood', 1)
    # 원뿔 지붕: 밑변 타원(윗면 보임) + 삼각
    for y in range(2, 40):
        half = (y - 2) / 37 * 22 + 1
        for x in range(int(cx - half), int(cx + half) + 1):
            u = (x - (cx - half)) / max(1, 2 * half)
            t = 5 if u < 0.3 else 4 if u < 0.6 else 3 if u < 0.85 else 2
            if (y + int(abs(x - cx) * 0.6)) % 4 == 0: t -= 1
            c.P(x, y, 'roofg', clamp(t, 0, 5))
    c.ell(cx, 38, 22, 3.5, lambda x, y, dx, dy, d: ('roofg', 1) if dy > 0.2 else None)
    for y in range(2, 40):
        half = (y - 2) / 37 * 22 + 1
        c.P(int(cx - half), y, 'roofg', 0); c.P(int(cx + half), y, 'roofg', 0)
    c.R(cx - 1, 0, 3, 4, 'brass', 4); c.P(cx - 1, 0, 'brass', 6)
    window(c, 18, 50, 12, 11, shutters=False, s=5)
    door(c, 17, 95, 14, 27)
    foundation(c, 3, 45, 92, 96)


def _windmill(c, f=0):
    cx = 32
    # 탑(사다리꼴, 위가 좁다) y 30..106
    for y in range(34, 106):
        u = (y - 34) / 72
        half = 14 + u * 8
        for x in range(int(cx - half), int(cx + half) + 1):
            v = (x - (cx - half)) / (2 * half)
            base = 5 if v < 0.25 else 4 if v < 0.6 else 3 if v < 0.85 else 2
            row = (y - 34) // 5; yy = (y - 34) % 5
            xx = (x + (4 if row % 2 else 0)) % 9
            t = base
            if yy == 4 or xx == 8: t = base - 2
            c.P(x, y, 'cream', clamp(t, 0, 6))
        c.P(int(cx - half), y, 'cream', 1); c.P(int(cx + half), y, 'cream', 0)
    # 모자 지붕(윗면 보이는 반원 돔 + 앞면)
    c.ell(cx, 30, 17, 12, lambda x, y, dx, dy, d: ('roofr', 5 if dx < -0.3 and dy < 0 else 4 if dy < 0.1 else 3 if dx < 0.5 else 2) if y <= 34 else None)
    c.R(cx - 17, 34, 35, 3, 'roofr', 2); c.HL(cx - 17, 36, 35, 'roofr', 1); c.HL(cx - 17, 34, 35, 'roofr', 3)
    for y in range(17, 35):
        for x in range(cx - 17, cx + 18):
            g = c.get(x, y)
            if g and g[0] == 'roofr' and ((x - cx) % 6 == 0) and y < 33: c.P(x, y, 'roofr', max(1, g[1] - 1))
    c.R(cx - 1, 15, 3, 4, 'wood', 3); c.P(cx, 14, 'brass', 5)
    window(c, cx - 5, 62, 10, 10, shutters=False, box=False, s=2)
    door(c, 25, 111, 14, 28, frame='wood')
    foundation(c, 8, 57, 106, 112)
    # 날개(4장, 30° 단계 회전) — 중심 (cx, 46)
    hub = (cx, 46)
    ang0 = f * math.pi / 6
    for k in range(4):
        a = ang0 + k * math.pi / 2
        dx, dy = math.cos(a), math.sin(a)
        px_, py_ = -dy, dx
        for r in range(4, 30):
            x = hub[0] + dx * r; y = hub[1] + dy * r
            c.P(round(x), round(y), 'wood', 2)
            if r > 7:
                for w in range(1, 7):
                    xx = x + px_ * w; yy = y + py_ * w
                    lattice = (r % 4 == 0) or w in (1, 6)
                    c.P(round(xx), round(yy), 'wood' if lattice else 'cream', 3 if lattice else (5 if w < 4 else 4))
    c.ell(hub[0], hub[1], 3, 3, lambda x, y, dx, dy, d: ('wood', 4 if dx + dy < 0 else 1))
    c.P(hub[0] - 1, hub[1] - 1, 'brass', 5)


A('windmill', '풍차(돌 탑 + 돛 날개, 3프레임 회전)', 4, 7, 'structure', ['풍차', '방앗간', '애니메이션'], '섬 바람받이 끝, 밭 옆. 날개가 돈다. 문(가운데 왼쪽) 아래 접근칸 비움.', entrance=[1], frames=3,
  gate_name='windmill tower with conical cap roof and sails')(_windmill)


@A('lighthouse', '하늘 등대(빛 탑)', 3, 8, 'structure', ['등대', '탑', '부두'], '부두 섬 끝. 비공정 길잡이. 가운데 칸이 문.', entrance=[1])
def _(c):
    cx = 24
    # 몸통: 흰 원통 + 빨간 띠 둘
    for y in range(44, 122):
        u = (y - 44) / 78
        half = 11 + u * 6
        for x in range(int(cx - half), int(cx + half) + 1):
            v = (x - (cx - half)) / (2 * half)
            base = 6 if v < 0.2 else 5 if v < 0.55 else 4 if v < 0.82 else 3
            mat = 'cream'
            if 62 <= y < 72 or 92 <= y < 102: mat = 'clothr'; base = clamp(base - 2, 1, 4)
            t = base
            if rnd(x, y, 3) < 0.05: t -= 1
            c.P(x, y, mat, t)
        c.P(int(cx - half), y, 'cream', 1); c.P(int(cx + half), y, 'sumi', 2)
    # 전망대(난간, 윗면 보이는 원판)
    c.ell(cx, 42, 19, 5, lambda x, y, dx, dy, d: ('iron', 4 if dy < 0 else 2))
    for x in range(cx - 18, cx + 19, 3): c.VL(x, 36, 7, 'iron', 2)
    c.HL(cx - 18, 36, 37, 'iron', 4); c.HL(cx - 18, 37, 37, 'iron', 1)
    # 등실(유리 + 불빛)
    c.R(cx - 9, 18, 19, 19, 'iron', 2)
    for y in range(19, 36):
        for x in range(cx - 8, cx + 9):
            d = abs(x - cx) + abs(y - 27) * 0.8
            c.P(x, y, 'glow', 4 if d < 4 else 3 if d < 7 else 2)
    for x in (cx - 5, cx, cx + 5): c.VL(x, 19, 17, 'iron', 2)
    # 돔 지붕(윗면)
    c.ell(cx, 18, 12, 9, lambda x, y, dx, dy, d: ('roofr', 5 if dx < -0.3 and dy < 0 else 4 if dy < 0.2 else 2) if y <= 19 else None)
    c.HL(cx - 12, 18, 25, 'roofr', 1)
    c.R(cx - 1, 5, 3, 5, 'brass', 4); c.P(cx, 4, 'brass', 6)
    window(c, cx - 4, 76, 8, 9, shutters=False, box=False, s=4)
    door(c, 17, 127, 14, 27)
    foundation(c, 4, 45, 122, 128)


@A('shrine', '하늘 신전(돌 기단 + 청록 지붕)', 5, 6, 'structure', ['신전', '사당', '성소'], '광장 북쪽 끝 가운데. 계단 앞 가운데 칸이 문(어두운 입구).', entrance=[2])
def _(c):
    W = 80
    # 기단(두 단, 윗면 보임)
    for (x0, x1, y0, h) in ((2, 78, 80, 4), (6, 74, 76, 4)):
        c.R(x0, y0, x1 - x0, h, 'stone', 5); c.HL(x0, y0, x1 - x0, 'stone', 6); c.HL(x0, y0 + h - 1, x1 - x0, 'stone', 3)
    c.R(2, 84, 76, 8, 'stone', 3); c.HL(2, 84, 76, 'stone', 4); c.HL(2, 91, 76, 'stone', 1)
    for x in range(2, 78, 8): c.VL(x, 84, 8, 'stone', 2)
    # 계단(가운데)
    for k in range(4):
        c.R(30 - k, 80 + k * 3, 20 + 2 * k, 3, 'stone', 6 - (k % 2)); c.HL(30 - k, 82 + k * 3, 20 + 2 * k, 'stone', 3)
    # 벽·기둥
    stone_wall(c, 10, 46, 70, 76, 'cream', 5, 4)
    for x in (10, 22, 54, 66):
        c.R(x, 44, 5, 32, 'cream', 6); c.VL(x, 44, 32, 'cream', 6); c.VL(x + 4, 44, 32, 'cream', 3); c.R(x - 1, 44, 7, 3, 'gold', 3); c.R(x - 1, 73, 7, 3, 'cream', 4)
    # 입구(어두운 아치)
    c.R(32, 52, 16, 24, 'gold', 3)
    for y in range(54, 76):
        for x in range(34, 46):
            top = 54 + (3 if x in (34, 45) else 1 if x in (35, 44) else 0)
            if y >= top: c.P(x, y, 'sumi', 1 if y > 60 else 2)
    c.HL(34, 70, 12, 'glow', 2); c.P(39, 66, 'glow', 4); c.P(40, 66, 'glow', 4)
    # 둥근 창 둘
    for wx in (16 + 0, 60):
        c.ell(wx + 0.5, 56, 3.5, 3.5, lambda x, y, dx, dy, d: ('crystal', 4 if dy < -0.2 else 2) if d < 0.6 else ('gold', 3))
    # 지붕(모임, 청록, 끝이 들린 처마) y 6..46
    for y in range(8, 44):
        u = (y - 8) / 36
        half = 22 + u * 18
        for x in range(int(40 - half), int(40 + half)):
            v = (x - (40 - half)) / (2 * half)
            row = (y - 8) // 4; yy = (y - 8) % 4
            t = 4 if v < 0.5 else 3
            if u < 0.3: t += 1
            if yy == 3: t -= 2
            if ((x + (2 if row % 2 else 0)) % 5) == 0 and yy < 3: t -= 1
            c.P(x, y, 'roofg', clamp(t, 0, 5))
        c.P(int(40 - half), y, 'roofg', 0); c.P(int(40 + half) - 1, y, 'roofg', 0)
    # 들린 처마 끝 + 금 테
    c.HL(0, 44, 80, 'gold', 3); c.HL(0, 45, 80, 'gold', 1)
    for (x, d) in ((0, 1), (79, -1)):
        c.P(x, 42, 'gold', 4); c.P(x + d, 43, 'gold', 4); c.P(x, 41, 'gold', 3)
    # 용마루(윗면) + 금 장식
    c.R(18, 4, 44, 5, 'roofg', 4); c.HL(18, 4, 44, 'roofg', 5); c.HL(18, 8, 44, 'roofg', 2)
    c.R(36, 0, 8, 5, 'gold', 3); c.HL(36, 0, 8, 'gold', 4); c.P(39, 0, 'crystal', 5); c.P(40, 1, 'crystal', 4)
    lantern(c, 24, 46); lantern(c, 51, 46)


@A('observatory', '천문대(돌 원통 + 청동 돔)', 5, 6, 'structure', ['천문대', '탑'], '섬 높은 끝. 가운데 칸이 문.', entrance=[2])
def _(c):
    cx = 40
    stone_wall(c, 6, 50, 74, 90, 'stone', 4, 7)
    for y in range(50, 90):
        c.P(6, y, 'stone', 6); c.P(7, y, 'stone', 5); c.P(73, y, 'stone', 1); c.P(72, y, 'stone', 2)
    c.R(4, 46, 72, 5, 'stone', 5); c.HL(4, 46, 72, 'stone', 6); c.HL(4, 50, 72, 'stone', 2)
    # 돔(청동, 윗면) + 관측 틈
    c.ell(cx, 46, 34, 40, lambda x, y, dx, dy, d: ('roofg', 5 if (dx < -0.35 and dy < -0.3) else 4 if dx < 0.1 and dy < 0.15 else 3 if dx < 0.6 else 2) if y <= 46 else None)
    for y in range(6, 47):
        for x in range(cx - 4, cx + 4):
            g = c.get(x, y)
            if g and g[0] == 'roofg': c.P(x, y, 'sumi', 1 if x < cx + 2 else 2)
    for y in range(8, 46, 5):
        for x in range(cx - 34, cx + 35):
            g = c.get(x, y)
            if g and g[0] == 'roofg': c.P(x, y, 'roofg', max(1, g[1] - 1))
    c.VL(cx - 5, 6, 40, 'brass', 4); c.VL(cx + 4, 6, 40, 'brass', 2)
    # 망원경 끝이 틈 밖으로
    c.R(cx - 2, 8, 5, 10, 'brass', 3); c.HL(cx - 2, 8, 5, 'brass', 5); c.ell(cx, 8, 2.5, 1.2, lambda x, y, dx, dy, d: ('sumi', 1))
    c.HL(cx - 34, 46, 69, 'roofg', 1)
    window(c, 13, 60, 10, 10, shutters=False, box=False, s=3)
    window(c, 57, 60, 10, 10, shutters=False, box=False, s=6)
    door(c, 33, 95, 14, 28)
    foundation(c, 4, 76, 90, 96)


@A('dockhouse', '부두 관리소(널벽 + 처마 등불)', 5, 5, 'structure', ['부두', '항구', '비공정'], '잔교 입구 옆. 가운데 칸이 문.', entrance=[2])
def _(c):
    planks_v(c, 3, 40, 77, 74, 'plank', 3, 7)
    c.HL(3, 40, 74, 'wood', 1)
    eave_shadow(c, 3, 77, 41, 2)
    foundation(c, 2, 78, 74, 80, 'stone')
    door(c, 33, 79, 14, 27, frame='wood')
    window(c, 9, 49, 14, 11, shutters=False, s=2)
    window(c, 57, 49, 14, 11, shutters=False, s=5)
    # 닻 무늬 판(글자 없음)
    c.R(32, 42, 16, 7, 'wood', 2); c.R(33, 43, 14, 5, 'plank', 4)
    c.VL(40, 43, 5, 'iron', 2); c.HL(37, 44, 7, 'iron', 2); c.P(37, 47, 'iron', 2); c.P(43, 47, 'iron', 2); c.HL(38, 47, 5, 'iron', 2)
    gable_roof(c, 0, 80, 4, 41, 'roofr', s=6, back=4)
    # 지붕 깃대 + 깃발
    c.VL(66, 0, 12, 'wood', 2)
    for y in range(1, 6):
        for x in range(67, 67 + 9 - y // 2): c.P(x, y, 'clothb', 3 if y < 3 else 2)
    lantern(c, 24, 43); lantern(c, 51, 43)


def _turbine(c, f=0):
    cx, hub = 16, (16, 22)
    # 기둥(가늘어지는 쇠 기둥)
    for y in range(24, 76):
        u = (y - 24) / 52
        half = 2 + u * 2.5
        for x in range(int(cx - half), int(cx + half) + 1):
            v = (x - (cx - half)) / (2 * half)
            c.P(x, y, 'cream', 6 if v < 0.3 else 5 if v < 0.6 else 4 if v < 0.85 else 2)
    # 받침(윗면 보이는 둥근 돌판)
    c.ell(cx, 76, 9, 3, lambda x, y, dx, dy, d: ('stone', 5 if dy < 0 else 4))
    c.R(cx - 9, 76, 19, 3, 'stone', 3); c.HL(cx - 9, 78, 19, 'stone', 1)
    # 나셀(윗면 보이는 통)
    c.R(cx - 5, 16, 11, 8, 'cream', 4); c.R(cx - 5, 16, 11, 3, 'cream', 6); c.HL(cx - 5, 16, 11, 'cream', 3); c.HL(cx - 5, 23, 11, 'cream', 2)
    # 날개 3장(40° 단계 회전 3프레임 = 120° 대칭에서 고르게)
    ang0 = -math.pi / 2 + f * (2 * math.pi / 9)
    for k in range(3):
        a = ang0 + k * 2 * math.pi / 3
        dx, dy = math.cos(a), math.sin(a)
        for r in range(3, 15):
            w = 2 if r < 10 else 1
            for o in range(w):
                x = hub[0] + dx * r - dy * o; y = hub[1] + dy * r + dx * o
                c.P(round(x), round(y), 'cream', 6 if o == 0 else 4)
            c.P(round(hub[0] + dx * r + dy), round(hub[1] + dy * r - dx), 'cream', 3)
    c.ell(hub[0], hub[1], 2.5, 2.5, lambda x, y, dx, dy, d: ('crystal', 4 if dx + dy < 0 else 2))


A('wind-turbine', '바람개비 발전탑(3프레임 회전)', 2, 5, 'structure', ['풍력', '바람', '애니메이션'], '섬 바람받이 가장자리에 1~3기, 3칸 이상 띄운다. 칸 전체 막힘.', frames=3,
  gate_name='small wind turbine on a slim mast with round stone base')(_turbine)


if __name__ == '__main__':
    rows = R.export()
    print(len(R.items), 'pieces', len(rows), 'pngs')
