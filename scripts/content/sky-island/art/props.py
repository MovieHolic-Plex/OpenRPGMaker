#!/usr/bin/env python3
"""sky_island 소품 — 나무·덤불·꽃·바위·수정·우물·울타리·등불·깃발·통·상자·밭 작물·수레·계류 말뚝·비공정·늘어진 뿌리·사슬·구름 덩이.

3/4 탑뷰, 빛 왼쪽 위, 바닥 접촉은 «자기 재질의 가장 어두운 단 띠» — 반투명 그늘 없음.
나무만 풀 위 그늘 타원(풀 램프)을 품는다(나무는 풀 위에만 선다).

  python3 props.py   → tiledata/sky-island/props/_gate/*.png + items.jsonl
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, clamp, blob, box3, shadow_ell, trunk, NT, MI
from kit import Reg

R = Reg('props')
A = R.add


# ═══════════════════════ 나무·풀 ═══════════════════════
def leafy(c, pts, mat, base, s=1):
    """잎 덩이 결(화풍 정렬 2026-10-14 — 버들항 나무처럼): 4×3 칸 격자(줄마다 어긋남)에 흔들린 잎 뭉치 중심을 두고,
    뭉치 안 왼쪽 위는 한 단 밝게(햇빛 잎), 오른쪽 아래 가장자리는 한 단 어둡게, 뭉치 사이 틈은 한 단 어둡게 — 덩이 명암 위에 잎 뭉치 단위 반사·그늘이 얹혀 5~6단.
    윤곽 화소는 건드리지 않는다."""
    n = NT[MI[mat]]
    edge = {p for p in pts if any((p[0] + a, p[1] + b) not in pts for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
    def centers(gx, gy):
        ox = 2 if gy % 2 else 0
        return (gx * 4 + ox + 1.5 + (rnd(gx, gy, s + 91) - 0.5) * 1.6, gy * 3 + 1.0 + (rnd(gx, gy, s + 92) - 0.5) * 1.2)
    for (x, y) in pts:
        if (x, y) in edge: continue
        g = c.get(x, y)
        if not g or g[0] != mat: continue
        gy0 = y // 3; best = None
        for gy in (gy0 - 1, gy0, gy0 + 1):
            ox = 2 if gy % 2 else 0
            gx0 = (x - ox) // 4
            for gx in (gx0 - 1, gx0, gx0 + 1):
                cx, cy = centers(gx, gy)
                dx, dy = x + 0.5 - cx, (y + 0.5 - cy) * 1.25
                d = math.sqrt(dx * dx + dy * dy)
                if best is None or d < best[0]: best = (d, dx, dy)
        d, dx, dy = best
        t = g[1]
        if d < 1.7:
            if dx + dy < -0.6 and t >= base - 1: t = min(n - 1, t + 1)       # 잎 뭉치 햇빛 쪽
            elif dx + dy > 1.2: t = max(0, t - 1)                              # 뭉치 오른쪽 아래
        elif d > 2.3:
            t = max(0, t - 1)                                                  # 뭉치 사이 틈
        c.P(x, y, mat, t)


def round_tree(c, s=1, mat='leaf', base=3, flowers=None):
    W, H = c.w, c.h
    cx = W // 2
    shadow_ell(c, cx + 1, H - 4, 11, 3.2)
    trunk(c, cx - 2, H - 20, H - 3, 5)
    c.P(cx - 3, H - 3, 'wood', 2); c.P(cx + 3, H - 3, 'wood', 1)          # 뿌리 뻗음
    cl = [(cx + 6, H - 24, 9), (cx - 7, H - 25, 9), (cx + 1, H - 33, 11), (cx - 5, H - 36, 8), (cx + 6, H - 37, 8), (cx, H - 21, 9)]
    pts = blob(c, cl, mat, base, s, rim=0)
    leafy(c, pts, mat, base, s)
    if flowers:
        fm, ft = flowers
        for (x, y) in pts:
            if rnd(x, y, s + 77) < 0.07:
                g = c.get(x, y)
                if g and g[1] >= base: c.P(x, y, fm, ft if rnd(x, y, s + 78) < 0.6 else ft + 1)
    return pts


@A('tree-round', '둥근 활엽수', 2, 3, 'organic', ['나무', '숲'], '풀 칸 위에만. 집 옆·섬 가장자리 안쪽 2칸. 줄기 칸(맨 아랫줄 가운데)이 막힘.',
   gate_name='round leafy tree')
def _(c): round_tree(c, 3)


@A('tree-blossom', '꽃나무(분홍)', 2, 3, 'organic', ['나무', '꽃'], '신전 앞·광장 모퉁이에 한두 그루.', gate_name='round blossom tree with pink flowers')
def _(c): round_tree(c, 5, 'flower', 2)


@A('tree-pine', '바늘잎 나무', 2, 3, 'organic', ['나무', '침엽수'], '섬 가장자리 바람받이에 2~3그루 무리로.', gate_name='conifer pine tree')
def _(c):
    W, H = 32, 48
    cx = 16
    shadow_ell(c, cx + 1, H - 4, 9, 3)
    trunk(c, cx - 2, H - 12, H - 3, 4)
    for k, (y0, hw) in enumerate(((H - 14, 13), (H - 22, 11), (H - 30, 9), (H - 37, 6))):
        # 층마다 아래로 퍼진 삼각 덩이(윗면 밝게, 아래 테 어둡게)
        for y in range(y0 - 12, y0 + 1):
            u = (y - (y0 - 12)) / 12
            half = 1 + u * hw
            for x in range(int(cx - half), int(cx + half) + 1):
                v = (x - (cx - half)) / max(1, 2 * half)
                t = 5 if v < 0.22 else 4 if v < 0.45 else 3 if v < 0.72 else 2
                if y >= y0 - 1: t = 1
                elif y >= y0 - 3 and v > 0.3: t = min(t, 2)                       # 층 밑 그늘(아래 층을 덮는 처마)
                # 바늘잎 결: 아래로 처진 짧은 사선 획(밝은 끝 + 그늘 밑)
                ph = (x * 2 - y * (1 if x < cx else -1) + k * 3) % 5
                if ph == 0 and y < y0 - 2: t = min(6, t + 1)
                elif ph == 1 and y < y0 - 2 and t > 1: t -= 1
                c.P(x, y, 'leaf', clamp(t, 0, 6))
            c.P(int(cx - half), y, 'leaf', 1); c.P(int(cx + half), y, 'leaf', 0)
    c.P(cx, H - 49 + 1, 'leaf', 5) if False else None


@A('tree-young', '어린 나무', 1, 2, 'organic', ['나무'], '울타리·길 옆 한 칸.', gate_name='small young tree')
def _(c):
    shadow_ell(c, 8.5, 28, 6, 2.2)
    trunk(c, 7, 18, 30, 3)
    leafy(c, blob(c, [(5, 13, 5), (11, 12, 5), (8, 7, 5), (8, 15, 5)], 'leaf', 3, 11, rim=0), 'leaf', 3, 11)


@A('bush', '덤불', 1, 1, 'organic', ['덤불', '풀'], '집 벽 앞·울타리 끝. 막힘.', gate_name='round green bush')
def _(c):
    c.HL(3, 15, 10, 'grass', 1)
    leafy(c, blob(c, [(5, 10, 4.5), (11, 10, 4.5), (8, 7, 5)], 'leaf', 3, 13, rim=0), 'leaf', 3, 13)


@A('bush-flower', '꽃덤불', 1, 1, 'organic', ['덤불', '꽃'], '창 아래·문 옆.', gate_name='round bush with small flowers')
def _(c):
    c.HL(3, 15, 10, 'grass', 1)
    pts = blob(c, [(5, 10, 4.5), (11, 10, 4.5), (8, 7, 5)], 'leaf', 3, 17, rim=0)
    leafy(c, pts, 'leaf', 3, 17)
    for (x, y) in pts:
        if rnd(x, y, 3) < 0.12 and c.get(x, y)[1] >= 3: c.P(x, y, 'flower', 3 if rnd(x, y, 4) < 0.5 else 4)


def flower_patch(c, s, mats):
    for k in range(9):
        x = 2 + int(rnd(k, 1, s) * 12); y = 3 + int(rnd(k, 2, s) * 10)
        m, t = mats[k % len(mats)]
        c.P(x, y + 1, 'grass', 2); c.P(x - 1, y + 1, 'leaf', 4); c.P(x + 1, y + 1, 'leaf', 3)
        c.P(x, y, m, t + 1); c.P(x - 1, y, m, t); c.P(x + 1, y, m, t); c.P(x, y - 1, m, t); c.P(x, y + 0, 'gold', 4)


@A('flowers-a', '꽃밭(분홍·흰)', 1, 1, 'flat', ['꽃', '바닥 장식'], '풀 칸 위 덧그림(걷는다). 길가·집 앞에 1~3칸 무리.', pc='flat', gate_name='small flower patch on the ground (flat decal)')
def _(c): flower_patch(c, 1, [('flower', 2), ('cream', 5)])


@A('flowers-b', '꽃밭(노랑·파랑)', 1, 1, 'flat', ['꽃', '바닥 장식'], '풀 칸 위 덧그림(걷는다).', pc='flat', gate_name='small flower patch on the ground (flat decal)')
def _(c): flower_patch(c, 2, [('gold', 2), ('clothb', 3)])


@A('tallgrass', '키 큰 풀', 1, 1, 'flat', ['풀', '바닥 장식'], '풀 칸 덧그림(걷는다). 섬 가장자리·나무 밑에 무리로.', pc='flat', gate_name='tall grass tufts on the ground (flat decal)')
def _(c):
    for k in range(7):
        x = 1 + int(rnd(k, 1, 5) * 14); y = 6 + int(rnd(k, 2, 5) * 9)
        h = 4 + int(rnd(k, 3, 5) * 3)
        for j in range(h):
            c.P(x - (1 if j > h - 2 else 0), y - j, 'grass', 2 + (j * 4) // h)
            c.P(x + 2 - (1 if j > h - 3 else 0), y - j + 1, 'grass', 2 + (j * 3) // h)
        c.P(x + 1, y + 1, 'grass', 1)


# ═══════════════════════ 바위·수정 ═══════════════════════
def rock(c, cx, cy, rx, ry, s=1, moss=True):
    c.HL(int(cx - rx + 1), int(cy + ry), int(2 * rx - 1), 'rock', 0)
    pts = blob(c, [(cx - rx * 0.35, cy + ry * 0.1, rx * 0.75), (cx + rx * 0.3, cy, rx * 0.8), (cx, cy - ry * 0.35, rx * 0.65)], 'rock', 4, s, rim=1, grain=0.4)
    if moss:
        ytop = min(y for (_, y) in pts)
        for (x, y) in pts:
            g = c.get(x, y)
            if not g or g[1] <= 1: continue
            depth = y - ytop - (rnd(x // 2, 0, s + 3) * 3)          # 이끼 모자 아래 끝을 들쭉날쭉하게
            if depth < ry * 0.7:
                c.P(x, y, 'grass', 5 if g[1] >= 5 else 4 if g[1] >= 4 else 3)
            elif depth < ry * 0.7 + 1.2:
                c.P(x, y, 'grass', 2)
    return pts


@A('rock-small', '작은 바위', 1, 1, 'organic', ['바위'], '풀 칸 위, 섬 가장자리 안쪽·길가. 막힘.', gate_name='small mossy boulder')
def _(c): rock(c, 8, 9.5, 6.5, 5)


@A('rock-big', '큰 바위(이끼)', 2, 2, 'organic', ['바위'], '섬 한쪽 끝·신전 길가. 아래 두 칸 막힘.', gate_name='large mossy boulder')
def _(c):
    rock(c, 16, 19, 13, 10, 3)


def crystal(c, x, ybot, w, h, mat='crystal', lean=0):
    """육각 기둥 수정: 왼면 밝게·오른면 어둡게·끝 뾰족, 가운데 능선 하이라이트."""
    top = ybot - h
    for y in range(top, ybot):
        u = (y - top) / max(1, h - 1)
        half = w / 2 * (min(1, u * 3.2))
        cx = x + lean * (1 - u)
        for xx in range(int(round(cx - half)), int(round(cx + half)) + 1):
            v = (xx - (cx - half)) / max(1, 2 * half)
            t = 5 if v < 0.25 else 4 if v < 0.5 else 2 if v < 0.8 else 1
            c.P(xx, y, mat, t)
    c.line(round(x + lean), top, round(x), ybot - 2, mat, 5)


@A('crystal-small', '작은 수정', 1, 1, 'organic', ['수정', '빛'], '바위 옆·섬 끝. 막힘.', gate_name='small blue crystal cluster growing from the ground')
def _(c):
    c.HL(3, 15, 11, 'rock', 1); c.HL(4, 14, 9, 'rock', 3)
    crystal(c, 6, 14, 4, 9, lean=-1); crystal(c, 10, 14, 5, 12); crystal(c, 13, 14, 3, 6, lean=1)


@A('crystal-cluster', '수정 무리(보라)', 1, 2, 'organic', ['수정', '빛'], '신전 뒤·섬 밑 끝 위. 막힘.', gate_name='tall amethyst crystal cluster on a rock')
def _(c):
    rock(c, 8, 26, 7, 4, 7, moss=False)
    crystal(c, 5, 26, 5, 14, 'amethyst', lean=-2); crystal(c, 9, 26, 6, 22, 'amethyst'); crystal(c, 13, 25, 4, 10, 'amethyst', lean=2)


@A('crystal-pylon', '떠 있는 수정(돌 받침)', 1, 2, 'structure', ['수정', '빛', '신전'], '신전·광장 가운데. 받침 칸 막힘.', gate_name='glowing crystal shard hovering above a carved stone pedestal')
def _(c):
    # 받침(윗면 보이는 돌 받침, 윗면 고리 빛)
    c.ell(8, 24, 6.5, 2.5, lambda x, y, dx, dy, d: ('stone', 6 if dy < 0 else 5))
    c.ell(8, 24, 3.5, 1.2, lambda x, y, dx, dy, d: ('glow', 3))
    c.R(2, 25, 13, 5, 'stone', 3); c.VL(2, 25, 5, 'stone', 4); c.VL(14, 25, 5, 'stone', 1); c.HL(2, 29, 13, 'stone', 1)
    c.R(1, 30, 15, 2, 'stone', 2); c.HL(1, 31, 15, 'stone', 0)
    # 떠 있는 수정(마름모)
    for y in range(2, 19):
        u = (y - 2) / 16
        half = 4.5 * (u / 0.45 if u < 0.45 else (1 - u) / 0.55)
        for x in range(int(round(8 - half)), int(round(8 + half)) + 1):
            v = (x - (8 - half)) / max(1, 2 * half)
            c.P(x, y, 'crystal', 5 if v < 0.3 else 4 if v < 0.55 else 2 if v < 0.8 else 1)
    c.VL(7, 4, 12, 'crystal', 5)
    for (x, y) in ((2, 6), (14, 9), (3, 15), (13, 3)): c.P(x, y, 'glow', 4)


# ═══════════════════════ 마을 기물 ═══════════════════════
@A('well', '돌 우물(지붕)', 2, 2, 'structure', ['우물', '마을'], '광장 가장자리·집 사이 마당. 아래 두 칸 막힘, 둘레 한 칸 비움.', gate_name='round stone well with small wooden roof')
def _(c):
    # 둥근 돌 테(윗면 보임) + 물
    c.ell(16, 21, 11, 5, lambda x, y, dx, dy, d: ('stone', 6 if dy < -0.3 else 5) if d > 0.45 else ('water', 2 if dy < 0 else 3))
    c.ell(16, 21, 11, 5, lambda x, y, dx, dy, d: ('stone', 3) if d > 0.88 and dy < 0 else None)
    for y in range(22, 30):
        for x in range(5, 28):
            dx = (x + 0.5 - 16) / 11
            if abs(dx) > 1: continue
            row = (y - 22) // 3; xx = (x + (3 if row % 2 else 0)) % 6
            t = 4 if dx < -0.3 else 3 if dx < 0.4 else 2
            if (y - 22) % 3 == 2 or xx == 5: t -= 1
            c.P(x, y, 'stone', t)
    c.HL(6, 30, 21, 'stone', 0)
    # 기둥 둘 + 지붕
    for x in (5, 26): c.R(x, 4, 2, 21, 'wood', 3); c.VL(x, 4, 21, 'wood', 4)
    for y in range(0, 7):
        hw = 8 + y * 1.6
        for x in range(int(16 - hw), int(16 + hw)):
            t = 4 if y < 4 else 3
            if (x + y) % 4 == 0: t -= 1
            c.P(x, y + 1, 'roofr', t)
    c.HL(5, 8, 22, 'roofr', 1); c.HL(10, 1, 12, 'roofr', 5)
    c.HL(7, 12, 18, 'wood', 2); c.P(16, 13, 'iron', 2); c.VL(16, 13, 6, 'iron', 3); c.R(14, 18, 5, 3, 'wood', 3); c.HL(14, 18, 5, 'wood', 5)


def fence(c, ori='h', end=None):
    """3/4 울타리(굵은 널): 가로대 = 윗면 3행(밝음) + 앞면 2행, 말뚝 = 윗면 4행 네모 + 앞면. 남북 줄은 위에서 본 가로대 둘 + 말뚝 하나."""
    def post(x, y0, w=5):
        box3(c, x, y0, w, 4, 15 - y0 - 4, 'wood', tt=6, ft=3)
        c.HL(x, 15, w, 'wood', 0)
    def rail(x0, x1, y):
        c.HL(x0, y, x1 - x0, 'wood', 4); c.HL(x0, y + 1, x1 - x0, 'wood', 6); c.HL(x0, y + 2, x1 - x0, 'wood', 6)
        c.HL(x0, y + 3, x1 - x0, 'wood', 3); c.HL(x0, y + 4, x1 - x0, 'wood', 2)
    if ori == 'h':
        x0 = 0 if end != 'w' else 6
        x1 = 16 if end != 'e' else 10
        rail(x0, x1, 3); rail(x0, x1, 9)
        if end is None: post(0, 1); post(11, 1)
        else: post(5, 0, 6)
    else:
        for x in (3, 9):
            c.R(x, 0, 4, 16, 'wood', 6); c.VL(x, 0, 16, 'wood', 4); c.VL(x + 3, 0, 16, 'wood', 3)
        box3(c, 4, 3, 8, 5, 7, 'wood', tt=6, ft=3); c.HL(4, 15, 8, 'wood', 0)


A('fence-h', '나무 울타리(동서)', 1, 1, 'structure', ['울타리'], '밭·마당 둘레 동서 줄. 막힘. 문 앞·길 칸에는 놓지 않는다.', gate_name='wooden rail fence segment (east-west)')(lambda c: fence(c, 'h'))
A('fence-v', '나무 울타리(남북)', 1, 1, 'structure', ['울타리'], '밭·마당 둘레 남북 줄. 막힘.', gate_name='wooden rail fence segment (north-south)')(lambda c: fence(c, 'v'))
A('fence-w', '울타리 서쪽 끝 기둥', 1, 1, 'structure', ['울타리'], '동서 줄 서쪽 끝.', gate_name='wooden fence end post')(lambda c: fence(c, 'h', 'w'))
A('fence-e', '울타리 동쪽 끝 기둥', 1, 1, 'structure', ['울타리'], '동서 줄 동쪽 끝.', gate_name='wooden fence end post')(lambda c: fence(c, 'h', 'e'))


@A('lamppost', '등불 기둥', 1, 2, 'column', ['등불', '길'], '길가·다리 머리·부두에. 아래 칸 막힘.', gate_name='street lamp post seen from above-front: wide flat square lid on top of the lantern (top surface clearly visible), glowing glass, round stone foot')
def _(c):
    c.ell(8, 27, 7, 3.2, lambda x, y, dx, dy, d: ('stone', 6 if dy < -0.2 else 5) if d < 0.8 else ('stone', 4))
    c.R(1, 27, 15, 3, 'stone', 3); c.HL(1, 29, 15, 'stone', 1)
    c.ell(8, 27, 7, 3.2, lambda x, y, dx, dy, d: ('stone', 6 if dy < -0.2 else 5) if dy < 0 else None)
    c.R(7, 13, 3, 14, 'iron', 2); c.VL(7, 13, 14, 'iron', 4)
    box3(c, 2, 0, 13, 5, 2, 'iron', tt=5, ft=2)                  # 넓은 뚜껑(윗면 5행)
    c.R(4, 7, 9, 6, 'iron', 1); c.R(5, 7, 7, 5, 'glow', 3); c.R(6, 8, 3, 2, 'glow', 4); c.VL(8, 7, 5, 'iron', 2)
    c.HL(3, 13, 11, 'iron', 3)


@A('banner', '깃발 기둥', 1, 3, 'column', ['깃발', '광장'], '광장 모퉁이·신전 계단 양옆에 짝으로. 아래 칸 막힘.', gate_name='banner pole seen from above-front: flat square brass cap on top (top surface visible), square stone base with flat top, hanging cloth')
def _(c):
    box3(c, 1, 38, 14, 6, 3, 'stone', tt=6, ft=3)
    c.HL(1, 47, 14, 'stone', 0)
    c.R(3, 6, 3, 36, 'wood', 3); c.VL(3, 6, 36, 'wood', 5); c.VL(5, 6, 36, 'wood', 1)
    flat_cap_pole(c, 0, 0, 9)
    c.R(6, 7, 9, 2, 'wood', 4); c.HL(6, 8, 9, 'wood', 1)
    for y in range(9, 33):
        for x in range(6, 15):
            t = 3 if x < 9 else 2 if x < 13 else 1
            if y > 28 and abs(x - 10) < (y - 28): continue
            c.P(x, y, 'clothb', t)
    for y in range(12, 25): c.P(10, y, 'gold', 3 if y % 2 else 4)
    c.HL(7, 11, 7, 'gold', 3)


@A('signpost', '갈림길 표지(그림 판)', 1, 2, 'column', ['길', '표지'], '길 갈림·다리 머리 옆. 글자 없음(화살 그림만). 아래 칸 막힘.', gate_name='wooden signpost seen from above-front: square post with visible cut top, arrow boards with visible top edges, stone base')
def _(c):
    c.ell(8, 28, 6.5, 2.8, lambda x, y, dx, dy, d: ('stone', 6 if dy < 0 else 5) if d < 0.75 else ('stone', 4))
    c.R(2, 28, 13, 3, 'stone', 3); c.HL(2, 30, 13, 'stone', 1)
    c.ell(8, 28, 6.5, 2.8, lambda x, y, dx, dy, d: ('stone', 6 if dy < 0 else 5) if dy < 0 else None)
    c.R(6, 4, 4, 24, 'wood', 3); c.VL(6, 4, 24, 'wood', 4); c.VL(9, 4, 24, 'wood', 1)
    c.R(6, 1, 4, 3, 'wood', 6); c.HL(6, 1, 4, 'wood', 4)                     # 잘린 윗면
    for (y, d) in ((7, 1), (15, -1)):
        x0 = 1 if d > 0 else 2
        c.R(x0, y, 13, 2, 'plank', 5); c.HL(x0, y, 13, 'plank', 4)            # 판 윗면
        c.R(x0, y + 2, 13, 4, 'plank', 3); c.HL(x0, y + 5, 13, 'plank', 1)
        tip = x0 + 13 if d > 0 else x0 - 1
        c.VL(tip, y + 1, 4, 'plank', 3); c.P(tip + d, y + 3, 'plank', 2)
        c.HL(x0 + 3, y + 3, 7, 'wood', 1); c.P(x0 + (9 if d > 0 else 3), y + 2, 'wood', 1); c.P(x0 + (9 if d > 0 else 3), y + 4, 'wood', 1)


@A('bench', '나무 벤치', 2, 1, 'structure', ['의자', '광장'], '광장 가장자리·섬 끝 전망 자리(가장자리 안쪽 1칸). 막힘.', gate_name='wooden park bench seen from above-front')
def _(c):
    c.R(2, 1, 28, 4, 'wood', 3); c.HL(2, 1, 28, 'wood', 5); c.HL(2, 3, 28, 'wood', 2)
    c.R(2, 6, 28, 4, 'plank', 5); c.HL(2, 6, 28, 'plank', 5); c.HL(2, 9, 28, 'plank', 3)
    for x in range(2, 30, 7): c.VL(x, 6, 4, 'plank', 3)
    c.R(2, 10, 28, 2, 'wood', 2)
    for x in (3, 27): c.R(x, 10, 2, 5, 'wood', 1); c.P(x, 15, 'wood', 0); c.P(x + 1, 15, 'wood', 0)
    c.VL(2, 1, 9, 'wood', 1); c.VL(29, 1, 9, 'wood', 0)


@A('barrel', '나무 통', 1, 1, 'round_body', ['통', '짐'], '집 벽 옆·부두 짐 자리에 1~3개 무리. 막힘.', gate_name='wooden barrel seen from above-front: large oval lid with planks clearly visible on top, iron hoops')
def _(c):
    for y in range(6, 15):
        for x in range(2, 15):
            u = (x - 2) / 12
            t = 5 if u < 0.2 else 4 if u < 0.5 else 3 if u < 0.8 else 2
            if (x - 2) % 3 == 2: t -= 1
            c.P(x, y, 'wood', t)
    for y in (9, 13): c.HL(2, y, 13, 'iron', 2); c.P(3, y, 'iron', 4)
    c.HL(3, 15, 11, 'wood', 0); c.VL(2, 6, 9, 'wood', 1); c.VL(14, 6, 9, 'wood', 0)
    c.ell(8.5, 5, 6.5, 4.2, lambda x, y, dx, dy, d: ('wood', 2) if d > 0.62 else ('plank', 5 if dy < -0.2 else 4))
    c.ell(8.5, 5, 6.5, 4.2, lambda x, y, dx, dy, d: ('iron', 3) if d > 0.86 else None)
    for x in (7, 10): c.VL(x, 2, 6, 'plank', 2)


@A('crate', '나무 상자', 1, 1, 'structure', ['상자', '짐'], '부두·가게 앞. 막힘.', gate_name='wooden crate seen from above-front')
def _(c):
    box3(c, 1, 2, 14, 5, 8, 'plank', tt=5, ft=3)
    c.line(2, 8, 13, 13, 'plank', 2); c.VL(1, 7, 8, 'plank', 1); c.VL(14, 7, 8, 'plank', 0)
    c.HL(2, 4, 12, 'plank', 3)
    c.HL(1, 15, 14, 'wood', 0)


@A('crates', '상자 더미', 2, 2, 'structure', ['상자', '짐', '부두'], '부두 짐 자리. 아래 두 칸 막힘.', gate_name='stack of wooden cargo crates')
def _(c):
    box3(c, 1, 14, 15, 5, 11, 'plank', tt=5, ft=3); c.line(2, 20, 14, 29, 'plank', 2)
    box3(c, 15, 16, 15, 5, 10, 'plank', tt=4, ft=2); c.line(16, 22, 28, 30, 'plank', 1)
    box3(c, 6, 2, 14, 5, 9, 'plank', tt=5, ft=3); c.line(7, 8, 18, 15, 'plank', 2)
    c.HL(1, 31, 29, 'wood', 0)
    c.R(23, 12, 6, 4, 'clothr', 3); c.HL(23, 12, 6, 'clothr', 4)


@A('haybale', '건초 더미', 1, 1, 'round_body', ['밭', '건초'], '밭 옆·풍차 앞. 막힘.', gate_name='upright round hay bale seen from above-front: oval top with spiral straw clearly visible')
def _(c):
    for y in range(6, 15):
        for x in range(1, 16):
            u = (x - 1) / 14
            t = 4 if u < 0.25 else 3 if u < 0.7 else 2
            if rnd(x, y // 2, 3) < 0.18: t -= 1
            c.P(x, y, 'gold', t)
    c.HL(2, 15, 13, 'gold', 0); c.VL(1, 6, 9, 'gold', 1); c.VL(15, 6, 9, 'gold', 0)
    c.ell(8, 5.5, 7, 4.5, lambda x, y, dx, dy, d: ('gold', 4 if (int(math.sqrt(d) * 4) % 2) else 3) if d < 0.85 else ('gold', 2))
    c.P(8, 5, 'gold', 2); c.HL(1, 10, 15, 'roofr', 2)


def crop(c, kind, s=1):
    """밭 칸 위 덧그림(걷지 못함 — 작물). 두 줄로 심는다."""
    for row, y in enumerate((5, 13)):
        for k, x in enumerate((3, 8, 13)):
            if kind == 'sprout':
                c.VL(x, y - 2, 3, 'leaf', 3)
                c.HL(x - 2, y - 2, 2, 'leaf', 5); c.P(x - 1, y - 3, 'leaf', 6); c.HL(x + 1, y - 2, 2, 'leaf', 3); c.P(x + 1, y - 3, 'leaf', 4)
                c.P(x - 1, y, 'leaf', 4); c.HL(x - 1, y + 1, 3, 'soil', 0)
            elif kind == 'cabbage':
                c.ell(x + 0.5, y - 0.5, 3.2, 2.6, lambda xx, yy, dx, dy, d: ('leaf', 5 if dx < -0.2 and dy < 0 else 4 if d < 0.5 else 2))
                c.P(x, y - 1, 'leaf', 6); c.HL(x - 2, y + 2, 5, 'soil', 0)
            elif kind == 'wheat':
                for j in range(9):
                    for o in (-1, 0, 1):
                        xx = x + o + (1 if j > 6 and o == 1 else 0)
                        c.P(xx, y + 1 - j, 'gold', 2 + (j * 3) // 9 if o else 3 + (j * 2) // 9)
                c.P(x, y - 8, 'gold', 4); c.HL(x - 1, y + 2, 3, 'soil', 0)


A('crop-sprout', '밭 새싹', 1, 1, 'organic', ['밭', '작물'], 'field 칸 위(위층). 밭 안쪽 줄에 반복.', pc='solid', gate_name='rows of young seedlings on farm soil (organic)')(lambda c: crop(c, 'sprout'))
A('crop-cabbage', '밭 양배추', 1, 1, 'organic', ['밭', '작물'], 'field 칸 위.', pc='solid', gate_name='rows of cabbages (organic)')(lambda c: crop(c, 'cabbage'))
A('crop-wheat', '밭 밀', 1, 1, 'organic', ['밭', '작물'], 'field 칸 위. 풍차 옆 밭.', pc='solid', gate_name='rows of ripe wheat (organic)')(lambda c: crop(c, 'wheat'))


@A('cart', '짐수레', 2, 2, 'structure', ['수레', '짐', '부두'], '부두 길·방앗간 앞. 아래 두 칸 막힘.', gate_name='wooden hand cart seen from above-front: open cargo bed with floor boards and crates visible from above, big wheels')
def _(c):
    # 짐칸: 테두리 윗면 + 안쪽 바닥(위에서 보임) + 앞판
    c.R(2, 4, 26, 14, 'plank', 5)
    for y in range(6, 16):
        for x in range(4, 26):
            c.P(x, y, 'plank', 3 if (y - 6) % 3 == 2 else 4)
    c.HL(2, 4, 26, 'plank', 3); c.VL(2, 4, 14, 'plank', 5); c.VL(27, 4, 14, 'plank', 2)
    c.R(2, 18, 26, 6, 'wood', 3); c.HL(2, 18, 26, 'wood', 5); c.HL(2, 23, 26, 'wood', 1)
    for x in range(4, 27, 6): c.VL(x, 19, 4, 'wood', 2)
    box3(c, 6, 5, 8, 4, 4, 'plank', tt=6, ft=3); box3(c, 16, 7, 7, 4, 4, 'plank', tt=5, ft=2)
    blob(c, [(23, 13, 2.5)], 'cream', 4, 8, rim=1, grain=0.2)
    for wx in (7, 23):
        c.ell(wx, 25, 4.5, 5.5, lambda x, y, dx, dy, d: ('wood', 4 if dx + dy < -0.6 else 2) if d > 0.55 else None)
        c.ell(wx, 25, 1.5, 1.5, lambda x, y, dx, dy, d: ('iron', 3))
        c.line(wx - 3, 25, wx + 3, 25, 'wood', 3); c.line(wx, 21, wx, 29, 'wood', 3)
    c.line(28, 20, 31, 27, 'wood', 3); c.HL(4, 31, 24, 'wood', 0)


# ═══════════════════════ 부두·비공정 ═══════════════════════
@A('bollard', '계류 말뚝', 1, 1, 'round_body', ['부두', '비공정', '밧줄'], '잔교 가장자리 칸 위(위층). 비공정 옆에 2~3개. 막힘.', gate_name='iron mooring bollard seen from above-front: big flat oval cap top, rope wound around')
def _(c):
    c.R(4, 8, 9, 7, 'iron', 3); c.VL(4, 8, 7, 'iron', 4); c.VL(12, 8, 7, 'iron', 1); c.HL(4, 15, 9, 'iron', 0)
    for y in (10, 12): c.HL(4, y, 9, 'gold', 3); c.P(4, y, 'gold', 4)
    c.line(12, 11, 15, 14, 'gold', 2)
    c.ell(8.5, 5.5, 7.5, 4.5, lambda x, y, dx, dy, d: ('iron', 5 if dy < -0.15 else 4) if d < 0.7 else ('iron', 3) if dy < 0.3 else ('iron', 2))
    c.ell(8.5, 5.5, 3, 1.6, lambda x, y, dx, dy, d: ('iron', 6) if dy < 0 else None)


@A('ropecoil', '사리 감은 밧줄', 1, 1, 'flat', ['부두', '밧줄'], '잔교 위 덧그림(걷는다).', pc='flat', gate_name='coiled rope lying on the deck (flat decal)')
def _(c):
    for r in (5.5, 4, 2.5):
        c.ell(8, 9, r * 1.2, r, lambda x, y, dx, dy, d: ('gold', 4 if dy < 0 else 2) if d > 0.55 else None)
    c.P(8, 9, 'gold', 1); c.line(13, 10, 15, 14, 'gold', 3)


@A('windsock', '바람 자루 기둥', 1, 2, 'column', ['부두', '바람'], '부두 끝·비공정 정박 칸 옆. 아래 칸 막힘.', gate_name='windsock pole seen from above-front: flat square iron cap on top (top surface visible), square stone base block with a deep flat top, striped sock')
def _(c):
    box3(c, 1, 21, 14, 7, 3, 'stone', tt=6, ft=3); c.HL(1, 31, 14, 'stone', 0)
    c.R(6, 23, 4, 2, 'stone', 3)
    c.R(6, 6, 3, 18, 'iron', 3); c.VL(6, 6, 18, 'iron', 4)
    box3(c, 2, 0, 11, 5, 2, 'iron', tt=5, ft=2)
    for x in range(9, 16):
        u = (x - 9) / 6
        top = 8 + round(u * 2); bot = 15 - round(u * 2)
        for y in range(top, bot):
            stripe = ((x - 9) // 2) % 2
            c.P(x, y, 'clothr' if stripe == 0 else 'cream', (3 if y < 11 else 2) if stripe == 0 else (5 if y < 11 else 4))
        c.P(x, bot, 'clothr' if ((x - 9) // 2) % 2 == 0 else 'cream', 1)


def airship(c):
    """정박한 비공정(8×6) — 3/4 탑뷰: 큰 갑판 윗면(뱃머리 서쪽, 널이 길이 방향) + 그 아래 뱃전 옆면 띠 + 갑판 뒤(북쪽) 위로 뜬 기낭.
    선체 아래는 투명(잔교·하늘 위에 뜬다 — 계류 밧줄로 말뚝에 잇는다)."""
    # 기낭: 위가 밝은 타원체, 세로 이음선이 앞으로 휜다, 아래 테 어둡게
    cx, cy, rx, ry = 66, 22, 46, 17
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
            d = dx * dx + dy * dy
            if d > 1: continue
            l = -(dx * -0.45 + dy * -0.85) * 0.8 + math.sqrt(1 - d) * 0.5
            t = 6 if l > 0.85 else 5 if l > 0.55 else 4 if l > 0.2 else 3 if l > -0.15 else 2
            seam = abs(((dx * 4.5) / max(0.25, math.sqrt(1 - dy * dy))) % 1 - 0.5) > 0.46
            if seam and abs(dx) < 0.92: t -= 1
            c.P(x, y, 'cream', t)
    c.ell(cx, cy, rx, ry, lambda x, y, dx, dy, d: ('cream', 1) if d > 0.92 and dy > -0.2 else None)
    c.HL(cx - rx + 6, cy + 6, 2 * rx - 12, 'clothr', 2)
    # 꼬리 날개
    c.poly([(110, 16), (124, 8), (126, 28), (110, 30)], lambda x, y: ('clothr', 4 if y < 14 else 3 if y < 22 else 2))
    c.line(110, 16, 124, 8, 'clothr', 1)
    # 매단 줄
    for x in (34, 52, 80, 98): c.line(x, 36, x + (3 if x < 66 else -3), 50, 'wood', 2)
    # 갑판 윗면(배 모양 — 뱃머리 서쪽 뾰족). 위·아래 테는 뱃전
    top, bot = 46, 72
    for y in range(top, bot):
        v = (y - (top + bot) / 2) / ((bot - top) / 2)
        bow = 6 + int(14 * abs(v) ** 1.6)
        stern = 120 - int(5 * abs(v) ** 2)
        for x in range(bow, stern):
            row = (y - top) // 3
            t = 5 if (y - top) % 3 else 4
            if (x + row * 11) % 17 == 0: t = 3
            c.P(x, y, 'plank', t)
        c.P(bow, y, 'wood', 2); c.P(bow + 1, y, 'wood', 4); c.P(stern - 1, y, 'wood', 2); c.P(stern - 2, y, 'wood', 3)
    for x in range(6, 120):
        ys = [y for y in range(top, bot) if c.get(x, y) and c.get(x, y)[0] == 'plank']
        if ys:
            c.P(x, ys[0], 'wood', 3); c.P(x, ys[0] + 1, 'wood', 4)       # 뒤 뱃전 윗면
            c.P(x, ys[-1], 'wood', 5); c.P(x, ys[-1] - 1, 'wood', 4)     # 앞 뱃전 윗면(밝음)
    # 갑판 물건: 승강구, 상자, 키
    box3(c, 44, 54, 14, 4, 3, 'wood', tt=4, ft=2); c.R(46, 55, 10, 2, 'sumi', 1)
    box3(c, 66, 52, 8, 4, 4, 'plank', tt=6, ft=3); box3(c, 75, 55, 7, 4, 3, 'plank', tt=5, ft=2)
    c.R(104, 52, 3, 10, 'wood', 3); c.ell(105.5, 52, 4.5, 4.5, lambda x, y, dx, dy, d: ('wood', 3) if d > 0.55 else None)
    c.ell(105.5, 52, 1.5, 1.5, lambda x, y, dx, dy, d: ('brass', 5))
    c.R(26, 58, 6, 6, 'gold', 3); c.HL(26, 58, 6, 'gold', 5)
    # 뱃전 옆면(남쪽) — 갑판 앞 테 아래 띠, 아래로 좁아짐
    for y in range(bot, bot + 14):
        u = (y - bot) / 13
        xl = 20 + int(22 * u ** 1.5); xr = 118 - int(16 * u ** 1.3)
        for x in range(xl, xr):
            t = 3 if (y - bot) % 4 else 2
            if u > 0.7: t -= 1
            c.P(x, y, 'wood', t)
        c.P(xl, y, 'wood', 1); c.P(xr - 1, y, 'wood', 0)
    c.HL(20, bot, 98, 'brass', 4)
    for x in (44, 64, 84): c.ell(x, bot + 5, 2.6, 2.6, lambda xx, yy, dx, dy, d: ('crystal', 4 if dy < 0 else 2) if d < 0.5 else ('brass', 3))
    c.HL(44, bot + 14, 52, 'wood', 0)
    # 뱃머리 장식
    c.poly([(8, 56), (0, 59), (8, 63)], lambda x, y: ('brass', 5 if y < 59 else 3))
    # 뒤 프로펠러(옆, 남쪽 뒤)
    c.R(116, 72, 5, 5, 'iron', 2); c.HL(116, 72, 5, 'iron', 4)
    c.ell(124, 74, 3, 10, lambda x, y, dx, dy, d: ('cream', 5 if dx < 0 else 3) if d > 0.25 else ('brass', 4))


A('airship', '정박한 비공정', 8, 6, 'structure', ['비공정', '부두', '배'], '잔교 남쪽 하늘에 선체가 오도록(갑판 줄이 잔교 남쪽 가장자리 바로 아래). 칸 전체 막힘. 둘레에 계류 말뚝 2~3.',
  gate_name='docked airship seen from above-front: large wooden deck seen from above with hatch and crates, hull side band below, gas balloon floating above the back of the deck')(airship)


# ═══════════════════════ 섬 밑면·하늘 장식 ═══════════════════════
@A('roots-hang', '늘어진 뿌리(2칸)', 1, 2, 'organic', ['섬 밑면', '뿌리'], '섬 밑면(face-top) 칸 위 덧그림 — 밑면 끝 아래 하늘까지 늘어진다. 막힘.', pc='solid',
   gate_name='tangle of roots hanging down from a floating island (organic)')
def _(c):
    for k, (x, ln) in enumerate(((3, 24), (7, 30), (11, 20), (13, 27))):
        xx = x
        for y in range(0, ln):
            if rnd(k, y // 4, 3) < 0.3: xx += 1 if rnd(k, y, 4) < 0.5 else -1
            xx = clamp(xx, 1, 14)
            c.P(xx, y, 'wood', 3 if y < ln - 6 else 2); c.P(xx + 1, y, 'wood', 1)
            if rnd(k, y, 5) < 0.06: c.P(xx - 1, y, 'leaf', 4); c.P(xx - 1, y + 1, 'leaf', 3)
        c.P(xx, ln, 'wood', 1)


@A('chain-hang', '늘어진 사슬과 닻돌', 1, 3, 'other', ['섬 밑면', '사슬'], '섬 밑면 위 덧그림 — 섬을 잡아 두는 사슬 끝에 닻돌. 막힘.', pc='solid',
   gate_name='iron chain hanging from an island: iron ring plate at the top and a square stone anchor weight with a visible flat top at the bottom')
def _(c):
    c.R(3, 0, 10, 4, 'iron', 4); c.HL(3, 0, 10, 'iron', 5); c.HL(3, 3, 10, 'iron', 1)
    c.ell(8, 2, 2, 1.3, lambda x, y, dx, dy, d: ('iron', 2))
    for y in range(4, 30, 4):
        o = (y // 4) % 2
        if o: c.R(7, y, 2, 4, 'iron', 3); c.VL(7, y, 4, 'iron', 5)
        else:
            c.HL(6, y, 4, 'iron', 4); c.HL(6, y + 3, 4, 'iron', 1); c.VL(6, y, 4, 'iron', 3); c.VL(9, y, 4, 'iron', 1)
            c.P(7, y + 1, 'sky', 4); c.P(8, y + 1, 'sky', 4); c.P(7, y + 2, 'sky', 3); c.P(8, y + 2, 'sky', 3)
    box3(c, 2, 30, 12, 6, 9, 'stone', tt=6, ft=3)
    c.ell(8, 32.5, 2, 1.2, lambda x, y, dx, dy, d: ('iron', 2))
    c.ell(8, 41, 1.5, 1.5, lambda x, y, dx, dy, d: ('crystal', 4))
    c.HL(2, 45, 12, 'stone', 0)


def puff(c, clumps, s):
    blob(c, clumps, 'cloud', 4, s, rim=None, light=(-0.5, -0.85), grain=0.25)
    # 아래 테(그늘 띠): 각 열의 맨 아래 두 화소 낮춤
    for x in range(c.w):
        ys = [y for y in range(c.h) if c.get(x, y)]
        if ys:
            c.P(x, ys[-1], 'cloud', 2)
            if len(ys) > 2: c.P(x, ys[-2], 'cloud', 3)


A('cloud-puff-s', '하늘 구름 덩이(작은)', 2, 1, 'organic', ['구름', '하늘 장식'], '하늘 칸 위 덧그림. 섬과 2칸 이상 띄운다. 막힘.', pc='solid',
  gate_name='small fluffy cloud floating in the sky (organic)')(lambda c: puff(c, [(9, 10, 5), (16, 8, 6.5), (23, 10, 5)], 1))
A('cloud-puff-m', '하늘 구름 덩이(중간)', 3, 2, 'organic', ['구름', '하늘 장식'], '하늘 칸 위 덧그림. 섬 사이 빈 하늘에 한두 개.', pc='solid',
  gate_name='fluffy cumulus cloud floating in the sky (organic)')(lambda c: puff(c, [(10, 22, 7), (20, 16, 10), (31, 15, 9), (39, 22, 7), (25, 24, 7)], 2))
A('cloud-puff-l', '하늘 구름 덩이(큰)', 4, 2, 'organic', ['구름', '하늘 장식'], '하늘 가장자리(맵 남쪽·동서 끝)에.', pc='solid',
  gate_name='large fluffy cumulus cloud floating in the sky (organic)')(lambda c: puff(c, [(9, 23, 7), (19, 16, 10), (31, 12, 11), (44, 16, 9), (54, 23, 7), (32, 24, 7)], 3))


# ═══════════════════════ 신전·광장 기물 ═══════════════════════
@A('statue', '날개 석상', 1, 2, 'figure', ['석상', '신전'], '신전 계단 양옆·광장 가운데. 아래 칸 막힘.', gate_name='stone statue of a winged bird standing on a wide square plinth whose flat top is clearly visible')
def _(c):
    box3(c, 0, 18, 16, 7, 6, 'stone', tt=6, ft=3)
    c.HL(0, 31, 16, 'stone', 0); c.HL(0, 30, 16, 'stone', 1)
    c.poly([(6, 12), (1, 4), (2, 13), (6, 17)], lambda x, y: ('stone', 5 if y < 10 else 4))
    c.poly([(10, 12), (15, 4), (14, 13), (10, 17)], lambda x, y: ('stone', 3 if y < 10 else 2))
    blob(c, [(8, 14, 3.2), (8, 8, 2.6)], 'stone', 4, 3, rim=2, grain=0.2)
    c.R(6, 17, 5, 3, 'stone', 3); c.HL(5, 20, 7, 'stone', 4)
    c.P(9, 7, 'sumi', 1); c.P(10, 8, 'gold', 3)


@A('stele', '비석(문양)', 1, 2, 'structure', ['비석', '신전'], '신전 길가. 글자 없음 — 별 문양만. 아래 칸 막힘.', gate_name='carved stone stele with star emblem')
def _(c):
    c.R(1, 27, 14, 4, 'stone', 4); c.HL(1, 27, 14, 'stone', 6); c.HL(1, 30, 14, 'stone', 1)
    c.R(3, 4, 10, 4, 'stone', 6); c.HL(4, 3, 8, 'stone', 6); c.HL(3, 4, 10, 'stone', 5)
    c.R(3, 8, 10, 19, 'stone', 4); c.VL(3, 4, 23, 'stone', 5); c.VL(12, 4, 23, 'stone', 2)
    for (x, y) in ((8, 12), (7, 13), (9, 13), (6, 14), (10, 14), (8, 14), (7, 15), (9, 15), (8, 16), (8, 13)): c.P(x, y, 'crystal', 3)
    c.P(8, 14, 'glow', 4)
    for y in (20, 23): c.HL(5, y, 6, 'stone', 2)


@A('birdbath', '새 물그릇', 1, 1, 'container', ['광장', '정원'], '정원·집 마당. 막힘.', gate_name='stone birdbath seen from above: wide round bowl with water clearly visible inside, short pedestal')
def _(c):
    c.R(6, 10, 4, 3, 'stone', 3); c.VL(6, 10, 3, 'stone', 5)
    c.ell(8, 14, 5, 1.8, lambda x, y, dx, dy, d: ('stone', 4 if dy < 0 else 2))
    c.ell(8, 6, 7.5, 5, lambda x, y, dx, dy, d: ('stone', 6 if dy < 0 else 4) if d > 0.55 else ('water', 5 if dy < -0.3 else 4 if dy < 0.2 else 3))
    c.ell(8, 6, 7.5, 5, lambda x, y, dx, dy, d: ('stone', 3) if d > 0.85 and dy > 0.3 else None)
    c.P(6, 5, 'water', 6)


@A('beehive', '벌통', 1, 1, 'box', ['정원', '밭'], '꽃밭·밭 옆. 막힘.', gate_name='wooden beehive box seen from above-front: large flat roof lid on top clearly visible, entrance slot')
def _(c):
    c.R(1, 1, 14, 6, 'roofr', 5); c.HL(1, 1, 14, 'roofr', 3); c.HL(1, 6, 14, 'roofr', 6); c.VL(14, 1, 6, 'roofr', 4)
    c.R(1, 7, 14, 2, 'roofr', 2)
    box3(c, 3, 9, 10, 0, 5, 'gold', tt=4, ft=3, back=False)
    c.HL(3, 11, 10, 'gold', 2); c.R(7, 12, 3, 1, 'sumi', 1)
    for x in (4, 11): c.R(x, 14, 1, 2, 'wood', 1)


@A('flowerpot', '꽃 화분', 1, 1, 'container', ['꽃', '집'], '문 양옆(접근칸은 비운다)·창 아래. 막힘.', gate_name='terracotta pot seen from above: wide round rim with dark soil visible inside and a few flowers')
def _(c):
    for y in range(8, 15):
        hw = 6 - (y - 8) * 0.4
        for x in range(int(8 - hw), int(8 + hw)):
            v = (x - (8 - hw)) / (2 * hw)
            c.P(x, y, 'roofr', 5 if v < 0.3 else 4 if v < 0.65 else 2)
    c.HL(4, 15, 8, 'roofr', 0)
    c.ell(8, 6, 7, 4, lambda x, y, dx, dy, d: ('roofr', 6 if dy < 0 else 5) if d > 0.55 else ('soil', 1 if dy < 0 else 2))
    for (x, y) in ((6, 5), (9, 6)):
        c.VL(x, y - 3, 3, 'leaf', 4); c.P(x - 1, y - 2, 'leaf', 5)
        c.P(x, y - 4, 'flower', 4); c.P(x - 1, y - 4, 'flower', 3); c.P(x + 1, y - 4, 'flower', 3)


@A('pond', '작은 연못', 3, 2, 'terrain', ['연못', '물'], '풀 칸 위 덧그림(막힘). 집 마당·신전 옆에 하나.', pc='solid', gate_name='small pond with stone rim and lily pads (terrain)')
def _(c):
    c.ell(24, 16, 22, 13, lambda x, y, dx, dy, d: ('stone', 5 if dy < 0 else 3) if d > 0.72 else None)
    c.ell(24, 16, 22, 13, lambda x, y, dx, dy, d: ('stone', 1) if d > 0.92 and dy > 0 else None)
    c.ell(24, 16.5, 18.5, 10, lambda x, y, dx, dy, d: ('water', 2 if dy < -0.6 else 3 if d > 0.4 else 4) if True else None)
    for y in range(8, 26):
        for x in range(6, 43):
            g = c.get(x, y)
            if g and g[0] == 'water' and rnd(x // 3, y, 4) < 0.05: c.P(x, y, 'water', 6)
    for (x, y) in ((14, 13), (31, 19), (34, 11)):
        c.ell(x, y, 3, 2, lambda xx, yy, dx, dy, d: ('leaf', 4 if dy < 0 else 3))
        c.P(x + 1, y, 'water', 3)
    c.P(15, 12, 'flower', 4)


@A('stall', '장터 노점(차양)', 3, 3, 'structure', ['장터', '광장', '가게'], '광장 가장자리, 열린 쪽(남쪽) 앞 한 칸 비움. 아래 두 줄 막힘.', gate_name='market stall with striped awning and goods on counter')
def _(c):
    # 기둥
    for x in (3, 43): c.R(x, 10, 2, 34, 'wood', 3); c.VL(x, 10, 34, 'wood', 5)
    # 차양(줄무늬, 윗면 경사 보임)
    for y in range(4, 20):
        u = (y - 4) / 15
        for x in range(0, 48):
            stripe = (x // 6) % 2
            m = 'clothr' if stripe == 0 else 'cream'
            t = (4 if u < 0.4 else 3 if u < 0.8 else 2) if m == 'clothr' else (6 if u < 0.4 else 5 if u < 0.8 else 4)
            c.P(x, y, m, t)
    for x in range(0, 48, 3):
        stripe = (x // 6) % 2
        c.R(x, 20, 2, 2, 'clothr' if stripe == 0 else 'cream', 2 if stripe == 0 else 3)
    c.HL(0, 4, 48, 'clothr', 1); c.VL(0, 4, 18, 'clothr', 1); c.VL(47, 4, 18, 'clothr', 1)
    # 뒷벽(그늘)
    c.R(5, 22, 38, 8, 'wood', 1)
    for y in (23, 26): c.HL(5, y, 38, 'plank', 2)
    for k, x in enumerate(range(7, 41, 6)):
        c.R(x, 22, 4, 3, ('flower', 'gold', 'leaf', 'clothb', 'roofr', 'crystal')[k % 6], 3)
    # 판매대(윗면 + 앞면)
    box3(c, 2, 30, 44, 6, 9, 'plank', tt=5, ft=3)
    for x in range(3, 45, 8): c.VL(x, 36, 9, 'plank', 2)
    # 진열 물건
    for k, x in enumerate(range(5, 44, 7)):
        m = ('gold', 'roofr', 'leaf', 'flower', 'cream', 'gold')[k]
        c.ell(x + 2, 32, 2.5, 1.8, lambda xx, yy, dx, dy, d, m=m: (m, 4 if dy < 0 else 2))
    c.HL(2, 47, 44, 'wood', 0)


def flat_cap_pole(c, x, y, w=8, mat='brass'):
    box3(c, x, y, w, 4, 2, mat, tt=5, ft=2)


if __name__ == '__main__':
    rows = R.export()
    print(len(R.items), 'pieces', len(rows), 'pngs')
