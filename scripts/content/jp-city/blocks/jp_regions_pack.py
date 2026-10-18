#!/usr/bin/env python3
"""jp_city 블록 `jp_regions_pack` - 일본 30 지역(상점가 밖: 신사·사찰·성·유적·산길·계곡·습원·폐선·온천·다랑논·항구·해변·시골 간이역) 손 도트 팩.

2026-10-18 사용자: 「이건 약간 '상점가' 고 다른 지역들도 많을거같은데 ... 학교, 주거지, 등산로, 유적지 ... 한 30가지 쯤 생각해바」.
지역 목록·조합 규칙은 src/editor/jpCity/japaneseRegionsCatalog.ts, 이 팩은 그 지역에 없던 부품만 그린다:
  바닥(fill_region 재료): 모래사장·바다·논·산길 흙·숲 바닥·나무 데크·온천가 돌길·습원·폐선 선로.
  키트: 대숲·삼나무·곰솔·단풍·石垣·天守·露天風呂·湯けむり·폭포·출렁다리·석조 유적·이끼 석불·종루·등대·어선·해바라기·
        로프웨이 역·산장·폐선 터널·허수아비·볏단 걸이(はざ掛け)·축제 포장마차·이정표·약수터·무인역 대합실·테트라포드.
색: src/editor/jpCity/paletteContract.ts 의 일본 로케일 계약 색(J(재료, 단 0~4))만 쓴다 - 윤곽만 modern3 sumi.
빛은 왼쪽 위, 그림자는 같은 재료의 낮은 단. 반투명 없음.

  python3 scripts/content/jp-city/blocks/jp_regions_pack.py [OUT_DIR]   # selftest + 키트·바닥 미리보기(1x, 2x)
"""
import collections, json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'houses')); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
from house_kit import K, Cv, OL  # noqa: E402
from shitamachi_pack import H, disc, line  # noqa: E402

BLOCK = 'jp_regions_pack'
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
OUTDIR = os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)
_CONTRACT = json.load(open(os.path.join(ROOT, 'tiledata', 'jp-city', 'palette-contract.json'), encoding='utf-8'))
_RAMP = {m['id']: [int(h[1:], 16) for h in m['steps']] for f in _CONTRACT['families'] for m in f['materials']}


def J(mat, s):
    """계약 재료 mat 의 단 s(0 깊은 그늘 … 4 하이라이트). 범위를 넘으면 끝 단."""
    r = _RAMP[mat]
    return r[max(0, min(4, s))]


# ═══════════════════════════ 그리기 부품 ═══════════════════════════
def canopy(c, blobs, mat, seed=0, base=2, edge_dark=True):
    """둥근 잎 덩이 여럿(blobs: (cx, cy, rx, ry)). 덩이마다 왼쪽 위가 밝고 오른쪽 아래가 어둡다 - 덩이가 겹쳐 뭉게뭉게 보인다."""
    def depth(i, j):
        best = None
        for a, b, rx, ry in blobs:
            d = ((i - a) / rx) ** 2 + ((j - b) / ry) ** 2
            if d <= 1 and (best is None or d < best[0]): best = (d, a, b, rx, ry)
        return best
    x0 = int(min(a - rx for a, b, rx, ry in blobs)) - 1; x1 = int(max(a + rx for a, b, rx, ry in blobs)) + 2
    y0 = int(min(b - ry for a, b, rx, ry in blobs)) - 1; y1 = int(max(b + ry for a, b, rx, ry in blobs)) + 2
    for j in range(y0, y1):
        for i in range(x0, x1):
            d = depth(i, j)
            if d is None: continue
            _, a, b, rx, ry = d
            u, v = (i - a) / rx, (j - b) / ry
            lit = -(u + v)
            lv = base + (1 if lit > 0.3 else 0) + (1 if lit > 1.0 else 0) - (1 if lit < -0.45 else 0) - (1 if lit < -1.05 else 0)
            h = H(i // 3, j // 3, seed)
            if h < 0.2: lv -= 1
            elif h > 0.88 and lit > -0.2: lv += 1
            outer = any(depth(i + dx, j + dy) is None for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if outer and edge_dark: lv = min(lv, 1 if lit > 0 else 0)
            c.P(i, j, J(mat, lv))


def trunk(c, x, y, w, h, mat='aged_cedar', t=2):
    c.R(x, y, w, h, J(mat, t)); c.VL(x, y, h, J(mat, t + 1)); c.VL(x + w - 1, y, h, J(mat, t - 1))
    for k in range(2, h, 5): c.P(x + 1 + (k % (max(1, w - 2))), y + k, J(mat, t - 1))


def stones(c, x0, y0, w, h, mat='shrine_flagstone', seed=0, course=(6, 8), width=(8, 15), moss=0.0, inside=None):
    """다듬지 않은 돌 쌓기(石垣·터널·유적): 줄마다 높이, 돌마다 폭이 다르고, 돌마다 위·왼 빛, 아래·오른 그늘, 줄눈 0단."""
    y = y0; row = 0
    while y < y0 + h:
        ch = course[0] + int(H(row, 7, seed) * (course[1] - course[0] + 1))
        x = x0 - int(H(row, 3, seed) * 6); k = 0
        while x < x0 + w:
            sw = width[0] + int(H(row, k, seed + 1) * (width[1] - width[0] + 1))
            tone = 2 + (1 if H(row, k, seed + 2) > 0.7 else 0) - (1 if H(row, k, seed + 3) > 0.78 else 0)
            mossy = H(row, k, seed + 4) < moss
            for j in range(ch):
                for i in range(sw):
                    px, py = x + i, y + j
                    if not (x0 <= px < x0 + w and y0 <= py < y0 + h): continue
                    if inside is not None and not inside(px, py): continue
                    if i == sw - 1 or j == ch - 1: col = J(mat, 0)
                    elif j == 0 or i == 0: col = J(mat, tone + 1)
                    elif j == ch - 2 or i == sw - 2: col = J(mat, tone - 1)
                    else: col = J(mat, tone + (1 if H(px, py, seed + 9) > 0.93 else 0))
                    if mossy and j < ch - 1 and i < sw - 1 and H(px // 2, py // 2, seed + 5) < 0.55:
                        col = J('moss', 2 + (1 if j < 2 else 0))
                    c.P(px, py, col)
            x += sw; k += 1
        y += ch; row += 1


def kawara_roof(c, x0, x1, y0, y1, flare=4, mat='kawara_dark_tile'):
    """처마가 들린 기와 지붕 단(3/4 앞면): 위 용마루 · 세로 골 3px · 처마 끝 밝은 선 · 양 끝이 flare 만큼 위로 휜다."""
    hgt = y1 - y0
    for y in range(y0, y1):
        f = (y - y0) / max(1, hgt - 1)
        inset = round((1 - f) * (hgt * 0.6))
        for x in range(x0 + inset, x1 - inset):
            k = (x - x0) % 3
            tt = 2 + (1 if k == 0 else -1 if k == 2 else 0) + (1 if x < (x0 + x1) // 2 - 6 else 0)
            if (y - y0) % 4 == 3: tt -= 1
            c.P(x, y, J(mat, tt))
    # 처마 끝: 양 끝이 휜다
    for x in range(x0 - 1, x1 + 1):
        e = min(x - x0, x1 - 1 - x)
        lift = flare - e if e < flare else 0
        c.P(x, y1 - 1 - lift, J(mat, 4)); c.P(x, y1 - lift, OL)
        for yy in range(y1 - lift, y1): c.P(x, yy, OL) if lift and yy == y1 - lift else None
    c.HL(x0 + round(hgt * 0.6), y0, x1 - x0 - 2 * round(hgt * 0.6), OL)


def plaster_wall(c, x0, y0, w, h, seed=0):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            c.P(x, y, J('cream_stucco', 3 + (1 if x == x0 else 0) - (1 if H(x, y, seed) > 0.94 else 0) - (1 if x == x0 + w - 1 else 0)))


def boards(c, x0, y0, w, h, mat='machiya_timber', t=2, bw=4, seed=0):
    """세로 판자(下見板·판자벽)."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            k = (x - x0) % bw
            c.P(x, y, J(mat, t + (1 if k == 0 else -1 if k == bw - 1 else 0) - (1 if H(x // bw, y // 9, seed) > 0.85 else 0)))


def window_slot(c, x, y, w, h):
    c.R(x, y, w, h, J('machiya_timber', 0))
    for i in range(x + 1, x + w, 2): c.VL(i, y + 1, h - 2, J('machiya_timber', 2))
    c.HL(x, y + h, w, J('cream_stucco', 4))


def steam(c, x, y, h, seed=0, width=3):
    """김(湯けむり): 반투명이 없으니 체크무늬로 듬성듬성 찍은 흰 실오라기가 흔들리며 올라간다."""
    for j in range(h):
        sway = round(math.sin((j + seed * 3) / 4.0) * 2)
        for i in range(width):
            px, py = x + sway + i, y + h - 1 - j
            if (px + py) % 2 == 0 and H(px, py, seed) > 0.25 + j / (h * 1.6):
                c.P(px, py, J('vending_cool_white', 4 if j < h // 2 else 3))


def leaf_spray(c, x, y, n, mat='pine_bamboo', seed=0, dirx=1):
    for k in range(n):
        ox = x + int(H(k, 1, seed) * 10) - 5; oy = y + int(H(k, 2, seed) * 8) - 4
        d = dirx if H(k, 3, seed) > 0.3 else -dirx
        for s in range(4): c.P(ox + d * s, oy + s // 2, J(mat, 4 if s == 0 else 3))


def fence_rail(c, x0, x1, y, mat='aged_cedar'):
    c.HL(x0, y, x1 - x0, J(mat, 4)); c.HL(x0, y + 1, x1 - x0, J(mat, 2)); c.HL(x0, y + 2, x1 - x0, OL)


# ═══════════════════════════ 키트 등록 ═══════════════════════════
KITS = []


def kit(id_, name, w, h, kind, solid=(), other='star', tags=(), rules='', role='prop'):
    def deco(fn):
        KITS.append(dict(id=id_, name=name, w=w, h=h, kind=kind, draw=fn, solid=set(solid), other=other, tags=list(tags), rules=rules, role=role))
        return fn
    return deco


def rows(w, ys):
    return [(x, y) for y in ys for x in range(w)]


# ----------------------------- 나무 -----------------------------
@kit('rg-bamboo-grove', '대숲(竹林) 한 덩이(대나무 여덟 그루·잎 깃털·마디, 4×6)', 4, 6, 'tree', solid=[(1, 5), (2, 5)],
     tags=['대나무', '대숲', '竹林', '산길', '사가노'], rules='길 양옆에 겹쳐 줄지어 세워 대숲 터널을 만든다. 발 두 칸만 막힌다.', role='prop')
def bamboo_grove(c, base):
    stalks = [(5, 1, 12), (13, 2, 8), (20, 1, 4), (28, 2, 10), (36, 1, 6), (43, 2, 3), (51, 1, 9), (58, 2, 14)]
    for x, depth, top in stalks:                                                    # 뒤 줄기(어두운)
        if depth != 1: continue
        c.R(x, top, 3, 96 - top, J('pine_bamboo', 1)); c.VL(x, top, 96 - top, J('pine_bamboo', 2))
        for ny in range(top + 7, 96, 11): c.HL(x - 1, ny, 5, J('pine_bamboo', 0))
    canopy(c, [(16, 18, 15, 14), (40, 14, 17, 13), (54, 24, 10, 12), (28, 30, 14, 10), (8, 34, 8, 9)], 'pine_bamboo', seed=3, base=2)
    leaf_spray(c, 20, 14, 14, seed=4); leaf_spray(c, 44, 18, 14, seed=5, dirx=-1)
    for x, depth, top in stalks:                                                    # 앞 줄기(밝은 연두·마디)
        if depth != 2: continue
        t0 = max(top, 26)
        c.R(x, t0, 3, 96 - t0, J('moss', 3)); c.VL(x, t0, 96 - t0, J('moss', 4)); c.VL(x + 2, t0, 96 - t0, J('moss', 1))
        for ny in range(t0 + 5, 94, 10):
            c.HL(x - 1, ny, 5, J('moss', 1)); c.HL(x, ny - 1, 3, J('moss', 4))
        leaf_spray(c, x + 4, t0 + 14, 3, mat='pine_bamboo', seed=x, dirx=1)
    for x in (6, 22, 44, 57):                                                       # 발치 죽순·낙엽
        c.P(x, 94, J('aged_cedar', 3)); c.P(x + 1, 93, J('aged_cedar', 2)); c.P(x + 1, 95, J('aged_cedar', 1))


@kit('rg-sugi', '삼나무(杉) 한 그루 - 원뿔 층 잎·붉은 줄기(3×6)', 3, 6, 'tree', solid=[(1, 5)],
     tags=['삼나무', '杉', '산길', '신사 숲'], rules='참배길·산길 양옆에 2~3칸 간격으로 줄지어 세운다.', role='prop')
def sugi(c, base):
    trunk(c, 21, 70, 6, 26, 'aged_cedar', 2)
    c.R(19, 94, 10, 2, J('aged_cedar', 0))
    for t in range(8):                                                              # 위에서 아래로 층마다 넓어지는 잎
        ty = 4 + t * 9; half = 4 + t * 2.6
        canopy(c, [(24, ty + 5, half, 6), (24 - half * 0.45, ty + 7, half * 0.55, 4), (24 + half * 0.45, ty + 7, half * 0.55, 4)], 'pine_bamboo', seed=11 + t, base=1)
    c.P(24, 1, J('pine_bamboo', 3)); c.P(24, 2, J('pine_bamboo', 2)); c.P(23, 3, J('pine_bamboo', 2)); c.P(25, 3, J('pine_bamboo', 1))


@kit('rg-pine', '곰솔(黒松) - 굽은 줄기·층층 솔잎 구름(4×5)', 4, 5, 'tree', solid=[(1, 4), (2, 4)],
     tags=['소나무', '黒松', '방풍림', '해안', '성', '정원'], rules='해안도로 방풍림은 2칸 간격으로 줄지어, 성·사찰 정원에는 한 그루씩.', role='prop')
def pine(c, base):
    for j in range(40, 80):                                                         # 굽은 줄기
        x = 28 + round(math.sin((j - 40) / 9.0) * 5) - (80 - j) // 10
        c.R(x, j, 6, 1, J('machiya_timber', 3)); c.P(x, j, J('machiya_timber', 4)); c.P(x + 5, j, J('machiya_timber', 1))
        if H(x, j, 2) > 0.8: c.P(x + 2, j, J('machiya_timber', 1))
    line(c, 30, 46, 14, 34, J('machiya_timber', 3)); line(c, 31, 44, 48, 30, J('machiya_timber', 3))
    for cx, cy, rx, ry, s in ((14, 30, 13, 6, 1), (46, 26, 14, 6, 2), (30, 14, 16, 7, 3), (32, 40, 10, 4, 4), (52, 40, 8, 4, 5)):
        canopy(c, [(cx, cy, rx, ry), (cx - rx * 0.5, cy + 1, rx * 0.5, ry * 0.8), (cx + rx * 0.5, cy + 1, rx * 0.5, ry * 0.8)], 'pine_bamboo', seed=s, base=1)
        for i in range(int(cx - rx + 3), int(cx + rx - 2), 3): c.P(i, int(cy - ry + 2), J('pine_bamboo', 4))   # 솔잎 끝 빛
    c.R(24, 78, 14, 2, J('machiya_timber', 0))


@kit('rg-maple', '단풍나무(紅葉) - 진홍 잎 덩이·가는 줄기·떨어진 잎(4×5)', 4, 5, 'tree', solid=[(1, 4), (2, 4)],
     tags=['단풍', '紅葉', '가을', '계곡', '사찰'], rules='계곡 길·사찰 마당에 가을 장면만. 봄·여름 장면엔 rg-sugi·벚나무를 쓴다.', role='prop')
def maple(c, base):
    trunk(c, 29, 50, 5, 30, 'machiya_timber', 3)
    line(c, 31, 54, 20, 42, J('machiya_timber', 3)); line(c, 32, 52, 44, 40, J('machiya_timber', 3))
    canopy(c, [(32, 26, 22, 17), (16, 34, 12, 10), (48, 33, 13, 10), (24, 16, 12, 10), (42, 15, 12, 10)], 'autumn_maple', seed=21, base=2)
    for (x, y) in ((12, 74), (20, 77), (41, 75), (49, 78), (27, 79)): c.P(x, y, J('autumn_maple', 3)); c.P(x + 1, y, J('autumn_maple', 2))


@kit('rg-sunflower', '해바라기 무리(3송이·큰 잎, 3×2)', 3, 2, 'flower', solid=[],
     tags=['해바라기', '여름', '시골', '들판'], rules='시골 역·밭 가장자리에 여러 개를 붙여 들판을 만든다(걸어서 지나갈 수 있다).', role='prop')
def sunflower(c, base):
    for k, (x, y) in enumerate(((9, 6), (24, 3), (39, 8))):
        c.VL(x, y + 5, 30 - y, J('pine_bamboo', 3)); c.VL(x + 1, y + 5, 30 - y, J('pine_bamboo', 2))
        for (lx, ly, d) in ((x - 1, y + 14, -1), (x + 2, y + 18, 1)):
            for s in range(5): c.P(lx + d * s, ly + s // 2, J('pine_bamboo', 4 if s < 2 else 3)); c.P(lx + d * s, ly + s // 2 + 1, J('pine_bamboo', 2))
        for a in range(12):
            ang = a * math.pi / 6
            c.P(round(x + math.cos(ang) * 4.5), round(y + math.sin(ang) * 4.5), J('lantern_amber', 3 if ang < math.pi else 2))
            c.P(round(x + math.cos(ang) * 3.5), round(y + math.sin(ang) * 3.5), J('lantern_amber', 4 if a in (7, 8, 9) else 3))
        disc(c, x, y, 2.4, J('machiya_timber', 3)); c.P(x - 1, y - 1, J('machiya_timber', 4))


# ----------------------------- 성·사찰·유적 -----------------------------
@kit('rg-ishigaki', '성 돌담(石垣) 한 구간 - 다듬지 않은 돌 쌓기·윗돌·풀(8×4)', 8, 4, 'wall', solid=rows(8, (1, 2, 3)),
     tags=['石垣', '성', '돌담', '해자', '유적'], rules='해자 물가를 따라 가로로 이어 붙인다(8칸마다 하나). 윗줄은 걸을 수 있는 돌담 위.', role='structure')
def ishigaki(c, base):
    stones(c, 0, 8, 128, 56, seed=7, moss=0.12)
    for x in range(128):                                                            # 윗돌(평평한 갓돌) + 풀
        c.P(x, 4, J('shrine_flagstone', 4)); c.P(x, 5, J('shrine_flagstone', 3)); c.P(x, 6, J('shrine_flagstone', 2)); c.P(x, 7, OL)
        if H(x // 2, 0, 3) > 0.55: c.P(x, 3, J('moss', 3)); c.P(x, 2, J('moss', 4) if H(x, 1, 4) > 0.6 else None)
    for x in range(0, 128): c.P(x, 63, J('shrine_flagstone', 0))


@kit('rg-tenshu', '천수각(天守) - 石垣 받침·흰 회벽·검은 판자·3단 기와 지붕·금 샤치호코(10×11)', 10, 11, 'landmark', solid=rows(10, range(5, 11)),
     tags=['天守', '성', '城', '유적', '랜드마크'], rules='성곽 맵 한가운데 북쪽. 앞에 판석 광장과 해자. 한 맵에 하나.', role='structure')
def tenshu(c, base):
    for y in range(128, 176):                                                       # 石垣 받침(사다리꼴, 아래로 넓어짐)
        f = (y - 128) / 47
        a, b = round(16 - 12 * f), round(144 + 12 * f)
        c.HL(a, y, b - a, J('shrine_flagstone', 1))
    stones(c, 4, 128, 152, 48, seed=31, course=(5, 7), width=(7, 13), moss=0.08,
           inside=lambda x, y: round(16 - 12 * (y - 128) / 47) <= x < round(144 + 12 * (y - 128) / 47))
    c.HL(14, 127, 132, J('shrine_flagstone', 4))
    # 1층
    plaster_wall(c, 20, 96, 120, 16, seed=1); boards(c, 20, 112, 120, 16, seed=2)
    for x in range(30, 136, 18): window_slot(c, x, 100, 8, 8)
    c.VL(20, 96, 32, OL); c.VL(139, 96, 32, OL)
    kawara_roof(c, 10, 150, 80, 97, flare=6)
    # 2층 + 千鳥破風
    plaster_wall(c, 34, 62, 92, 18, seed=3); boards(c, 34, 74, 92, 6, seed=4)
    for x in (42, 58, 94, 110): window_slot(c, x, 65, 8, 7)
    c.VL(34, 62, 18, OL); c.VL(125, 62, 18, OL)
    kawara_roof(c, 24, 136, 50, 63, flare=5)
    for y in range(56, 72):                                                         # 千鳥破風(앞 삼각 박공)
        half = (y - 56) * 1.1
        for x in range(round(80 - half), round(80 + half) + 1): c.P(x, y, J('cream_stucco', 4 if x < 80 else 3))
    line(c, 80, 54, 61, 72, OL); line(c, 80, 54, 99, 72, OL); line(c, 80, 55, 62, 72, J('kawara_dark_tile', 3)); line(c, 80, 55, 98, 72, J('kawara_dark_tile', 1))
    c.P(80, 60, J('lantern_amber', 3)); c.P(79, 61, J('lantern_amber', 2)); c.P(81, 61, J('lantern_amber', 2))
    # 3층(망루) + 入母屋
    plaster_wall(c, 50, 34, 60, 16, seed=5)
    c.R(58, 38, 44, 8, J('machiya_timber', 1))
    for x in range(59, 102, 3): c.VL(x, 39, 6, J('machiya_timber', 3))
    c.HL(56, 46, 48, J('kawara_dark_tile', 3)); c.VL(50, 34, 16, OL); c.VL(109, 34, 16, OL)
    kawara_roof(c, 40, 120, 22, 35, flare=5)
    for y in range(8, 24):                                                          # 꼭대기 박공 + 용마루
        half = (y - 8) * 1.5
        for x in range(round(80 - half), round(80 + half) + 1): c.P(x, y, J('kawara_dark_tile', 2 if x < 80 else 1))
    c.HL(56, 8, 48, OL); c.HL(57, 9, 46, J('kawara_dark_tile', 4))
    for sx, d in ((56, 1), (103, -1)):                                              # 金の鯱(샤치호코)
        c.R(sx, 3, 2, 5, J('lantern_amber', 3)); c.P(sx + d, 2, J('lantern_amber', 4)); c.P(sx + d * 2, 1, J('lantern_amber', 3)); c.P(sx, 7, J('lantern_amber', 1))


@kit('rg-shoro', '종루(鐘楼) - 돌 기단·나무 기둥·청동 범종·당목·기와 지붕(5×6)', 5, 6, 'landmark', solid=rows(5, (4, 5)),
     tags=['종루', '鐘楼', '사찰', '범종'], rules='사찰 경내 본당 옆(오중탑 반대쪽). 앞 한 칸은 비운다.', role='structure')
def shoro(c, base):
    c.R(2, 80, 76, 16, J('shrine_flagstone', 2)); c.HL(2, 80, 76, J('shrine_flagstone', 4)); c.HL(2, 81, 76, J('shrine_flagstone', 3))
    for x in range(2, 78, 12): c.VL(x, 82, 14, J('shrine_flagstone', 0))
    c.HL(2, 95, 76, J('shrine_flagstone', 0))
    for px in (10, 64): trunk(c, px, 28, 6, 52, 'aged_cedar', 2)
    for px in (20, 54): trunk(c, px, 30, 4, 50, 'aged_cedar', 1)
    c.R(8, 28, 64, 4, J('aged_cedar', 2)); c.HL(8, 28, 64, J('aged_cedar', 4))
    c.VL(39, 32, 4, J('kawara_dark_tile', 1)); c.VL(40, 32, 4, J('kawara_dark_tile', 1))
    for y in range(36, 64):                                                         # 범종(청동: 온천 광물 청록 어두운 단)
        half = 8 + (y - 36) * 0.18 + (3 if y > 60 else 0)
        for x in range(round(40 - half), round(40 + half) + 1):
            t = 2 if x < 36 else 1 if x < 44 else 0
            if y in (44, 52, 58): t -= 1
            if y < 50 and (x - 31) % 4 == 0 and 30 < x < 50 and y > 38: t += 1
            c.P(x, y, J('onsen_mineral_teal', t))
    c.HL(29, 64, 23, OL)
    c.R(52, 44, 18, 4, J('aged_cedar', 3)); c.HL(52, 44, 18, J('aged_cedar', 4)); c.VL(60, 32, 12, J('kawara_dark_tile', 1))
    kawara_roof(c, 0, 80, 4, 28, flare=5)
    c.HL(18, 4, 44, OL); c.HL(19, 5, 42, J('kawara_dark_tile', 4))


@kit('rg-stone-ruin', '석조 유적 - 무너진 돌벽·쓰러진 기둥 돌·이끼(4×3)', 4, 3, 'ruin', solid=[(0, 1), (1, 1), (0, 2), (1, 2), (2, 2), (3, 2)],
     tags=['유적', '석조', '이끼', '숲', '古墳'], rules='숲 바닥·이끼 땅 위에 2~4개를 흩어 놓는다. 사이로 산길이 지나간다.', role='structure')
def stone_ruin(c, base):
    stones(c, 2, 4, 30, 40, seed=41, course=(6, 7), width=(6, 10), moss=0.35,
           inside=lambda x, y: y > 4 + (x - 2) * 0.2 + (10 if x > 22 and y < 18 else 0) + (4 if 14 < x < 20 and y < 10 else 0))
    for x in range(2, 32): c.P(x, 44, J('shrine_flagstone', 0)); c.P(x, 45, J('moss', 1))
    for k, (x, y, w) in enumerate(((34, 34, 14), (48, 38, 12))):                   # 쓰러진 기둥 돌(원통 옆모습)
        for j in range(8):
            for i in range(w):
                t = 3 if j < 2 else 2 if j < 5 else 1
                if H(x + i, y + j, k) < 0.18: t = 2 if t != 2 else 3
                c.P(x + i, y + j, J('shrine_flagstone', t))
        disc(c, x + w, y + 4, 3.5, J('shrine_flagstone', 3), ry=4)
        disc(c, x + w, y + 4, 1.5, J('shrine_flagstone', 1))
        c.HL(x, y + 8, w + 3, J('shrine_flagstone', 0))
        for i in range(0, w, 3):
            if H(i, k, 9) > 0.4: c.P(x + i, y, J('moss', 3)); c.P(x + i + 1, y, J('moss', 2))
    for (x, y) in ((40, 30), (56, 34), (6, 2)): c.P(x, y, J('moss', 4)); c.P(x + 1, y + 1, J('moss', 3))


@kit('rg-moss-buddha', '이끼 낀 석불(좌상·광배 돌, 2×2)', 2, 2, 'statue', solid=[(0, 1), (1, 1)],
     tags=['석불', '이끼', '유적', '지장', '고개'], rules='숲 유적·고개 쉼터에 줄지어(2칸 간격). 앞에 꽃이나 공양 돌.', role='prop')
def moss_buddha(c, base):
    for y in range(2, 26):                                                          # 배 모양 광배 돌
        half = 11 * math.sin(math.pi * min(1.0, (y - 1) / 26) * 0.9 + 0.25)
        for x in range(round(16 - half), round(16 + half) + 1):
            c.P(x, y, J('shrine_flagstone', 1 if x > 16 else 2))
    disc(c, 16, 9, 4.2, J('shrine_flagstone', 3)); c.P(15, 7, J('shrine_flagstone', 4)); c.P(17, 10, J('shrine_flagstone', 2))
    for y in range(13, 25):
        half = 4 + (y - 13) * 0.45
        for x in range(round(16 - half), round(16 + half) + 1): c.P(x, y, J('shrine_flagstone', 3 if x < 15 else 2))
    c.HL(13, 19, 6, J('shrine_flagstone', 1)); c.P(16, 18, J('shrine_flagstone', 4))
    c.R(6, 25, 20, 5, J('shrine_flagstone', 2)); c.HL(6, 25, 20, J('shrine_flagstone', 4)); c.HL(6, 29, 20, J('shrine_flagstone', 0))
    for (x, y) in ((8, 6), (9, 5), (22, 14), (23, 15), (12, 24), (20, 27), (21, 27), (7, 28)): c.P(x, y, J('moss', 3)); c.P(x, y + 1, J('moss', 2))
    c.R(13, 23, 6, 2, J('torii_vermilion', 2)); c.HL(13, 23, 6, J('torii_vermilion', 3))


# ----------------------------- 물·온천·자연 -----------------------------
@kit('rg-rotenburo', '노천탕(露天風呂) - 둥근 바위 테·청록 온천물·김·나무 통(6×4)', 6, 4, 'water', solid=rows(6, (1, 2, 3)),
     tags=['온천', '露天風呂', '료칸', '김'], rules='온천 마을 료칸 뒤뜰·강가. 주위를 대나무 울타리나 생울타리로 가린다.', role='structure')
def rotenburo(c, base):
    cx, cy = 48, 38
    for y in range(64):
        for x in range(96):
            if ((x - cx) / 38) ** 2 + ((y - cy) / 20) ** 2 <= 1:
                inner = ((x - cx) / 32) ** 2 + ((y - cy) / 14.5) ** 2
                if inner <= 1:
                    t = 2 + (1 if y < cy - 6 else 0) - (1 if y > cy + 8 else 0)
                    if (y % 5 == 0 and H(x // 4, y, 2) > 0.6): t = 4
                    c.P(x, y, J('onsen_mineral_teal', t))
    for k in range(26):                                                             # 바위 테
        ang = k / 26 * math.pi * 2
        rx, ry = cx + math.cos(ang) * 35, cy + math.sin(ang) * 17.5
        r = 4.5 + H(k, 1, 3) * 2.2
        mat = 'wet_cobble' if H(k, 2, 3) > 0.5 else 'shrine_flagstone'
        for y in range(int(ry - r) - 1, int(ry + r) + 2):
            for x in range(int(rx - r) - 1, int(rx + r) + 2):
                d = ((x - rx) / r) ** 2 + ((y - ry) / (r * 0.8)) ** 2
                if d > 1: continue
                lit = -((x - rx) + (y - ry)) / r
                c.P(x, y, OL if d > 0.86 and lit < 0 else J(mat, 2 + (1 if lit > 0.3 else 0) + (1 if lit > 1.0 else 0) - (1 if lit < -0.5 else 0)))
    for (sx, sh, sd) in ((28, 26, 1), (46, 30, 2), (64, 24, 3)): steam(c, sx, 30 - sh, sh, seed=sd, width=4)
    c.R(80, 14, 10, 9, J('aged_cedar', 2)); c.VL(80, 14, 9, J('aged_cedar', 4)); c.HL(80, 14, 10, J('aged_cedar', 4)); c.HL(80, 17, 10, J('kawara_dark_tile', 1)); c.HL(80, 21, 10, J('kawara_dark_tile', 1))
    c.HL(80, 23, 10, OL)


@kit('rg-yukemuri', '湯けむり 김 기둥(온천 도랑·湯畑에서 오르는 흰 김, 2×3)', 2, 3, 'effect', solid=[],
     tags=['온천', '김', '湯けむり', '湯畑'], rules='온천 마을 도랑·湯畑·노천탕 위에 겹쳐 둔다(통행을 막지 않는다).', role='prop')
def yukemuri(c, base):
    steam(c, 6, 2, 44, seed=5, width=5); steam(c, 16, 10, 36, seed=8, width=4); steam(c, 11, 20, 26, seed=2, width=3)


@kit('rg-waterfall', '폭포 - 이끼 바위 절벽·떨어지는 물줄기·물보라 소(4×6)', 4, 6, 'water', solid=rows(4, range(6)),
     tags=['폭포', '계곡', '절벽', '등산로'], rules='계곡 맵 북쪽 끝 절벽. 아래로 수로(fill_region 「수로」)를 이어 강을 만든다.', role='structure')
def waterfall(c, base):
    stones(c, 0, 0, 64, 80, seed=51, course=(7, 11), width=(9, 16), moss=0.3)
    for y in range(0, 82):                                                          # 물줄기
        for x in range(22, 42):
            edge = x in (22, 41)
            t = 1 if edge else 3 if (x + y // 3) % 7 == 0 else 2
            if (x * 3 + y) % 11 == 0 and not edge: t = 4
            c.P(x, y, J('canal_indigo', t) if t < 4 else J('vending_cool_white', 3))
        if y % 4 == 0: c.P(24 + (y * 7) % 16, y, J('vending_cool_white', 4))
    for y in range(76, 96):                                                         # 소(沼)
        for x in range(64):
            d = ((x - 32) / 31) ** 2 + ((y - 86) / 10) ** 2
            if d <= 1:
                c.P(x, y, J('onsen_mineral_teal', 2 if d > 0.4 else 1) if (x + y) % 9 else J('onsen_mineral_teal', 3))
    for k in range(30):                                                             # 물보라
        x = 18 + int(H(k, 1, 6) * 28); y = 72 + int(H(k, 2, 6) * 10)
        c.P(x, y, J('vending_cool_white', 4 if k % 3 else 3))
    for x in range(4, 60): c.P(x, 95, J('onsen_mineral_teal', 0))


@kit('rg-tsuribashi', '출렁다리(吊り橋) - 나무 발판·밧줄 난간·양끝 기둥(8×2)', 8, 2, 'bridge', solid=[],
     tags=['출렁다리', '吊り橋', '계곡', '다리'], rules='계곡 물(수로) 위를 가로로 건넌다. 아래 줄이 걷는 발판, 양끝 칸이 땅에 닿게 놓는다.', role='structure')
def tsuribashi(c, base):
    for x in range(128):                                                            # 발판(바닥 층)
        k = x % 5
        for y in range(16, 32):
            if y in (16, 31): base.P(x, y, J('aged_cedar', 0)); continue
            base.P(x, y, J('aged_cedar', 3 if k == 0 else 1 if k == 4 else 2) if not (k == 4 and H(x // 5, 0, 3) > 0.7) else J('canal_indigo', 0))
    for px in (2, 122):                                                             # 끝 기둥
        c.R(px, 2, 4, 24, J('aged_cedar', 2)); c.VL(px, 2, 24, J('aged_cedar', 4)); c.HL(px - 1, 2, 6, OL)
    for x in range(6, 122):                                                         # 늘어진 밧줄 두 줄 + 행거
        sag = round(math.sin((x - 6) / 116 * math.pi) * 6)
        c.P(x, 4 + sag, J('tatami_straw', 3)); c.P(x, 5 + sag, J('tatami_straw', 1))
        c.P(x, 27 + sag // 3, J('tatami_straw', 3)); c.P(x, 28 + sag // 3, J('tatami_straw', 1))
        if x % 8 == 0:
            for y in range(6 + sag, 16): c.P(x, y, J('tatami_straw', 2))


# ----------------------------- 바다·항구 -----------------------------
@kit('rg-lighthouse', '등대(灯台) - 흰 탑·전망 난간·불 켜진 등실·붉은 지붕(3×8)', 3, 8, 'landmark', solid=[(0, 7), (1, 7), (2, 7), (1, 6)],
     tags=['등대', '灯台', '항구', '방파제', '해안'], rules='방파제 끝이나 곶 끝. 한 맵에 하나.', role='structure')
def lighthouse(c, base):
    for y in range(30, 116):                                                        # 가늘어지는 흰 탑
        f = (y - 30) / 85
        a, b = round(16 - 5 * f), round(32 + 5 * f)
        for x in range(a, b):
            t = 4 if x < a + 3 else 3 if x < (a + b) // 2 + 2 else 2
            if x == b - 1: t = 1
            c.P(x, y, J('vending_cool_white', t))
        c.P(a - 1, y, OL); c.P(b, y, OL)
    for wy in (50, 74, 96): c.R(22, wy, 4, 6, J('noren_indigo', 1)); c.HL(22, wy, 4, J('noren_indigo', 0))
    c.R(12, 26, 24, 4, J('kawara_dark_tile', 2)); c.HL(11, 26, 26, J('kawara_dark_tile', 4)); c.HL(11, 29, 26, OL)
    for x in range(12, 36, 3): c.VL(x, 22, 4, J('kawara_dark_tile', 1))
    c.HL(12, 22, 24, J('kawara_dark_tile', 3))
    c.R(17, 12, 14, 10, J('lantern_amber', 3)); c.R(19, 14, 6, 6, J('lantern_amber', 4)); c.VL(23, 12, 10, J('kawara_dark_tile', 1)); c.VL(17, 12, 10, OL); c.VL(30, 12, 10, OL)
    for y in range(4, 12):                                                          # 붉은 둥근 지붕
        half = 3 + (y - 4) * 0.9
        for x in range(round(24 - half), round(24 + half) + 1): c.P(x, y, J('torii_vermilion', 3 if x < 23 else 2))
    c.P(24, 2, OL); c.P(24, 3, J('kawara_dark_tile', 2))
    c.R(4, 112, 40, 16, J('concrete_grey', 2)); c.HL(4, 112, 40, J('concrete_grey', 4)); c.VL(4, 112, 16, J('concrete_grey', 3)); c.R(30, 116, 8, 12, J('noren_indigo', 1)); c.HL(4, 127, 40, OL)


@kit('rg-fishing-boat', '어선(漁船) - 흰 선체·쪽빛 띠·조타실·大漁旗(6×3)', 6, 3, 'boat', solid=rows(6, (0, 1, 2)),
     tags=['어선', '항구', '어시장', '바다'], rules='항구 물(바다) 위, 부두(콘크리트)에 붙여 댄다. 2~3척을 엇갈려 둔다.', role='prop')
def fishing_boat(c, base):
    for y in range(22, 42):                                                         # 선체(뱃머리 오른쪽)
        bow = 88 - max(0, (y - 22)) * 0.6
        stern = 6 + max(0, y - 34) * 0.8
        for x in range(round(stern), round(bow)):
            t = 4 if y < 26 else 3 if y < 33 else 2
            col = J('vending_cool_white', t)
            if 33 <= y <= 35: col = J('noren_indigo', 2 if y == 33 else 1)
            c.P(x, y, col)
        c.P(round(stern) - 1, y, OL); c.P(round(bow), y, OL)
    c.HL(6, 42, 70, J('canal_indigo', 0)); c.HL(10, 43, 60, J('canal_indigo', 1))
    c.R(10, 18, 70, 5, J('concrete_grey', 2)); c.HL(10, 18, 70, J('concrete_grey', 4))
    c.R(24, 4, 20, 16, J('vending_cool_white', 3)); c.VL(24, 4, 16, J('vending_cool_white', 4)); c.VL(43, 4, 16, J('vending_cool_white', 1))
    c.R(26, 7, 16, 5, J('arcade_skylight_slate', 2)); c.HL(26, 7, 16, J('arcade_skylight_slate', 4)); c.HL(23, 3, 22, OL)
    c.VL(60, 0, 18, J('kawara_dark_tile', 1))
    c.R(61, 1, 12, 8, J('torii_vermilion', 2)); c.R(61, 4, 12, 2, J('lantern_amber', 3)); c.P(66, 2, J('vending_cool_white', 4))
    for x in (14, 50, 70): c.R(x, 14, 4, 4, J('lantern_amber', 2)); c.P(x, 14, J('lantern_amber', 4))


@kit('rg-tetrapod', '테트라포드 무리(방파제 소파 블록, 4×2)', 4, 2, 'rock', solid=rows(4, (0, 1)),
     tags=['테트라포드', '방파제', '항구', '해안'], rules='방파제 바다 쪽 가장자리에 줄지어 놓는다.', role='prop')
def tetrapod(c, base):
    t = Cv(c.w, c.h)
    for k, (x, y) in enumerate(((12, 11), (32, 15), (50, 10), (22, 21), (42, 21))):
        legs = ((0, -7), (-7, 4), (7, 4), (1 if k % 2 else -1, 6))                 # 위 하나 + 아래 셋(뭉툭한 원뿔 다리)
        for li, (ex, ey) in enumerate(legs):
            for s in range(8):
                f = s / 7
                lit = 3 if li == 0 or ex < 0 else 2
                disc(t, x + ex * f, y + ey * f, 4.2 - f * 1.8, J('concrete_grey', lit if s < 6 else lit + 1 if li == 0 else lit - 1))
        disc(t, x - 1, y - 1, 2.2, J('concrete_grey', 4)); disc(t, x + 2, y + 2, 1.5, J('concrete_grey', 1))
    a = t.a
    for y in range(c.h):
        for x in range(c.w):
            if a[y, x, 3]:
                c.P(x, y, int(a[y, x, 0]) << 16 | int(a[y, x, 1]) << 8 | int(a[y, x, 2]))
            elif any(0 <= x + dx < c.w and 0 <= y + dy < c.h and a[y + dy, x + dx, 3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                c.P(x, y, OL)


# ----------------------------- 산·고원 -----------------------------
@kit('rg-ropeway', '로프웨이 산정역 - 콘크리트 역사·승강구·쇠줄 두 가닥·붉은 곤돌라(7×6)', 7, 6, 'landmark', solid=rows(7, (3, 4, 5)),
     tags=['로프웨이', '케이블카', '전망대', '산'], rules='고원 맵 아래쪽 끝. 쇠줄이 맵 밖(위·오른쪽)으로 나간다.', role='structure')
def ropeway(c, base):
    c.R(6, 46, 100, 50, J('concrete_grey', 2)); c.VL(6, 46, 50, J('concrete_grey', 4)); c.VL(105, 46, 50, J('concrete_grey', 0))
    for x in range(6, 106, 16): c.VL(x, 50, 46, J('concrete_grey', 1))
    c.R(2, 40, 108, 7, J('concrete_grey', 3)); c.HL(2, 40, 108, J('concrete_grey', 4)); c.HL(2, 46, 108, OL)
    c.R(54, 58, 46, 38, J('kawara_dark_tile', 0)); c.R(56, 60, 42, 6, J('kawara_dark_tile', 1))
    c.R(14, 58, 30, 14, J('arcade_skylight_slate', 2)); c.HL(14, 58, 30, J('arcade_skylight_slate', 4))
    for x in range(14, 44, 10): c.VL(x, 58, 14, J('kawara_dark_tile', 2))
    c.R(18, 78, 14, 18, J('aged_cedar', 1)); c.VL(25, 78, 18, J('aged_cedar', 0))
    c.R(56, 49, 40, 7, J('vending_cool_white', 4))
    for k in range(7): c.R(59 + k * 5, 51, 3, 3, J('noren_indigo', 2))
    for k, off in enumerate((0, 6)):                                                # 쇠줄 두 가닥(오른쪽 위로)
        line(c, 92, 62 - off, 111, 2 - off // 2, J('kawara_dark_tile', 0 if k == 0 else 1))
        line(c, 72, 62 - off, 111, 22 - off, J('kawara_dark_tile', 1))
    gx, gy = 94, 16
    c.VL(gx + 6, gy - 6, 6, J('kawara_dark_tile', 1))
    c.R(gx, gy, 13, 12, J('torii_vermilion', 2)); c.VL(gx, gy, 12, J('torii_vermilion', 3)); c.HL(gx, gy, 13, J('torii_vermilion', 4))
    c.R(gx + 2, gy + 3, 9, 4, J('arcade_skylight_slate', 3)); c.HL(gx, gy + 12, 13, OL)


@kit('rg-lodge', '산장(山小屋) - 통나무 벽·녹슨 함석 박공 지붕·돌 굴뚝·간판(7×6)', 7, 6, 'building', solid=rows(7, (3, 4, 5)),
     tags=['산장', '山小屋', '고원', '등산로'], rules='고원·습원 탐방로 갈림길. 문 앞 한 칸(아래 가운데)은 비운다.', role='structure')
def lodge(c, base):
    for y in range(54, 96):                                                         # 통나무 벽
        row = (y - 54) // 6; r = (y - 54) % 6
        for x in range(10, 102):
            t = 3 if r == 1 else 2 if r < 4 else 1 if r == 4 else 0
            c.P(x, y, J('aged_cedar', t))
        for ex in (10, 101):
            disc(c, ex, 54 + row * 6 + 2.5, 2.6, J('aged_cedar', 3)); c.P(ex, 54 + row * 6 + 2, J('aged_cedar', 1))
    c.R(48, 70, 16, 26, J('machiya_timber', 2)); c.VL(48, 70, 26, J('machiya_timber', 4)); c.P(61, 83, J('lantern_amber', 3))
    for wx in (20, 76): c.R(wx, 64, 14, 12, J('lantern_amber', 3)); c.R(wx + 1, 65, 6, 10, J('lantern_amber', 4)); c.VL(wx + 7, 64, 12, J('machiya_timber', 1)); c.HL(wx - 1, 76, 16, J('aged_cedar', 4))
    for y in range(10, 56):                                                         # 박공 지붕(녹슨 함석, 세로 골)
        half = 10 + (y - 10) * 1.05
        for x in range(round(56 - half), round(56 + half) + 1):
            t = 3 if (x - 56) % 4 == 0 else 2
            if x > 56: t -= 1
            if H(x // 4, y // 6, 3) > 0.86: t -= 1
            c.P(x, y, J('noren_rust', t))
    line(c, 56, 9, 3, 56, OL); line(c, 56, 9, 109, 56, OL); c.HL(4, 56, 105, OL)
    c.R(84, 2, 10, 28, J('shrine_flagstone', 2)); c.VL(84, 2, 28, J('shrine_flagstone', 4)); c.HL(83, 2, 12, OL)
    for y in range(4, 30, 5): c.HL(84, y, 10, J('shrine_flagstone', 0))
    steam(c, 86, 0, 4, seed=3, width=3)
    c.R(40, 58, 32, 8, J('aged_cedar', 4)); c.HL(40, 58, 32, OL); c.HL(40, 65, 32, OL)
    for k in range(4): c.R(44 + k * 7, 60, 4, 4, J('machiya_timber', 1))


@kit('rg-tunnel', '폐선 터널 입구 - 벽돌·돌 아치·검은 굴·담쟁이·녹슨 레일(6×5)', 6, 5, 'structure', solid=rows(6, range(5)),
     tags=['터널', '폐선', '廃線', '유적', '숲'], rules='폐선 맵 북쪽 끝. 아래로 rg 폐선 선로(「폐선 녹슨 선로」)를 이어 깐다.', role='structure')
def tunnel(c, base):
    stones(c, 0, 8, 96, 72, mat='shrine_flagstone', seed=61, course=(5, 6), width=(9, 13), moss=0.25)
    for y in range(24, 80):                                                         # 아치 굴
        for x in range(24, 72):
            dy = max(0, 40 - y)
            if ((x - 48) / 24) ** 2 + (dy / 16) ** 2 > 1: continue
            d = min(x - 24, 71 - x, y - 24 + (40 - y if y < 40 else 0))
            c.P(x, y, K('sumi', 0) if d > 6 else K('sumi', 1) if d > 2 else J('wet_cobble', 0))
    for k in range(22):                                                             # 아치 테두리 돌(쐐기돌)
        ang = math.pi + k / 21 * math.pi
        for r in range(25, 29):
            x, y = round(48 + math.cos(ang) * r), round(40 + math.sin(ang) * (r * 0.68))
            c.P(x, y, J('shrine_flagstone', 4 if r == 28 else 3 if k % 2 else 2))
    for x in range(24, 72):
        if x in (24, 71): continue
    for rx in (38, 57):                                                             # 굴로 들어가는 녹슨 레일
        for y in range(56, 80):
            c.P(rx, y, J('noren_rust', 2)); c.P(rx + 1, y, J('noren_rust', 1))
    for y in range(60, 80, 6): c.HL(34, y, 28, J('machiya_timber', 1))
    for x in range(96):                                                             # 윗 난간(파라펫) + 이끼·담쟁이
        c.P(x, 4, J('shrine_flagstone', 4)); c.P(x, 5, J('shrine_flagstone', 3)); c.P(x, 6, J('shrine_flagstone', 2)); c.P(x, 7, OL)
        if H(x // 3, 0, 9) > 0.45: c.P(x, 3, J('moss', 3))
    for vx in (8, 16, 78, 88):
        ln = 14 + int(H(vx, 0, 2) * 30)
        for y in range(8, 8 + ln):
            c.P(vx + round(math.sin(y / 3) * 1.5), y, J('pine_bamboo', 3 if y % 3 else 4))
            if y % 4 == 0: c.P(vx + 2, y, J('pine_bamboo', 2))


# ----------------------------- 마을·논·축제 -----------------------------
@kit('rg-kakashi', '허수아비(案山子) - 밀짚모자·쪽빛 옷·팔 막대(1×2)', 1, 2, 'figure', solid=[(0, 1)],
     tags=['허수아비', '논', '시골'], rules='논 한가운데·논두렁 끝에 하나씩.', role='prop')
def kakashi(c, base):
    c.VL(8, 10, 22, J('aged_cedar', 2)); c.VL(7, 10, 22, J('aged_cedar', 3))
    c.HL(1, 13, 14, J('aged_cedar', 3)); c.HL(1, 14, 14, J('aged_cedar', 1))
    c.R(4, 12, 8, 10, J('noren_indigo', 2)); c.VL(4, 12, 10, J('noren_indigo', 3)); c.HL(4, 17, 8, J('noren_rust', 2))
    disc(c, 8, 7, 3, J('cream_stucco', 3)); c.P(7, 7, OL); c.P(9, 7, OL)
    c.HL(2, 4, 12, J('tatami_straw', 3)); c.HL(3, 3, 10, J('tatami_straw', 4)); c.R(5, 1, 6, 2, J('tatami_straw', 3)); c.HL(2, 5, 12, J('tatami_straw', 1))


@kit('rg-hazakake', '볏단 걸이(はざ掛け) - 나무 장대·가로대·말리는 볏단(4×2)', 4, 2, 'rack', solid=[(0, 1), (1, 1), (2, 1), (3, 1)],
     tags=['볏단', 'はざ掛け', '논', '가을', '시골'], rules='논두렁을 따라 가로로 이어 놓는다(가을).', role='prop')
def hazakake(c, base):
    for px in (3, 31, 59):
        c.VL(px, 2, 30, J('aged_cedar', 2)); c.VL(px + 1, 2, 30, J('aged_cedar', 1))
        line(c, px, 30, px - 3, 31, J('aged_cedar', 2))
    c.HL(0, 6, 64, J('aged_cedar', 3)); c.HL(0, 7, 64, J('aged_cedar', 1))
    for x in range(1, 63, 4):                                                       # 걸린 볏단
        for y in range(8, 24):
            w = 1 if y < 12 else 2
            for i in range(-w, w + 1): c.P(x + i + 1, y, J('tatami_straw', 3 if i < 0 else 2 if i == 0 else 1))
        c.P(x + 1, 24, J('tatami_straw', 1)); c.P(x, 25, J('tatami_straw', 0))
    for x in range(0, 64, 2): c.P(x, 31, J('tatami_straw', 0))


@kit('rg-yatai', '축제 포장마차(屋台) - 주홍·흰 줄무늬 차양·초롱·쪽빛 노렌·나무 매대(4×3)', 4, 3, 'stall', solid=[(0, 2), (1, 2), (2, 2), (3, 2)],
     tags=['포장마차', '屋台', '축제', '마츠리', '야시장'], rules='축제 마당 참배길 양옆에 마주 보게 줄지어 놓는다. 사이에 초롱 줄(jp-prop-string-lanterns4).', role='prop')
def yatai(c, base):
    for y in range(4, 16):                                                          # 줄무늬 차양
        for x in range(2, 62):
            stripe = ((x - 2) // 6) % 2
            t = 3 if y < 8 else 2
            c.P(x, y, J('torii_vermilion', t) if stripe == 0 else J('vending_cool_white', 4 if y < 8 else 3))
    for x in range(2, 62):
        if (x - 2) % 6 in (0, 5): c.P(x, 16, J('torii_vermilion', 1) if ((x - 2) // 6) % 2 == 0 else J('vending_cool_white', 2))
        else: c.P(x, 16, J('torii_vermilion', 2) if ((x - 2) // 6) % 2 == 0 else J('vending_cool_white', 3))
    c.HL(2, 3, 60, OL)
    for px in (4, 58): c.R(px, 16, 3, 30, J('aged_cedar', 2)); c.VL(px, 16, 30, J('aged_cedar', 4))
    c.R(8, 17, 48, 12, J('noren_indigo', 2))
    for k in range(4): c.VL(8 + k * 12 + 11, 17, 12, J('noren_indigo', 0)); c.R(12 + k * 12, 20, 4, 6, J('vending_cool_white', 3))
    c.R(4, 30, 56, 16, J('aged_cedar', 2)); c.HL(4, 30, 56, J('aged_cedar', 4)); c.HL(4, 31, 56, J('aged_cedar', 3)); c.HL(4, 45, 56, J('aged_cedar', 0))
    for x in range(8, 58, 5): c.VL(x, 33, 12, J('aged_cedar', 1))
    for k, gx in enumerate(range(10, 56, 8)): disc(c, gx, 28, 2.2, J(('autumn_maple', 'lantern_amber', 'sakura_petal')[k % 3], 3))
    for lx in (1, 61):                                                              # 초롱
        c.VL(lx + 1, 16, 2, J('kawara_dark_tile', 1))
        for y in range(18, 26):
            half = 2 if y in (18, 25) else 3
            for x in range(lx + 1 - half, lx + 2 + half): c.P(x, y, J('lantern_amber', 4 if x <= lx else 3))
        c.HL(lx - 1, 21, 5, J('torii_vermilion', 2))


@kit('rg-doshirube', '등산로 이정표(道標) - 나무 기둥·화살표 판 둘(1×2)', 1, 2, 'sign', solid=[(0, 1)],
     tags=['이정표', '등산로', '산길'], rules='산길 갈림길 가장자리에 하나.', role='prop')
def doshirube(c, base):
    c.R(7, 6, 3, 26, J('aged_cedar', 2)); c.VL(7, 6, 26, J('aged_cedar', 4))
    for (y, d) in ((7, 1), (15, -1)):
        x0 = 1 if d > 0 else 2
        c.R(x0, y, 13, 5, J('aged_cedar', 3)); c.HL(x0, y, 13, J('aged_cedar', 4)); c.HL(x0, y + 4, 13, J('aged_cedar', 1))
        tip = x0 + 13 if d > 0 else x0 - 1
        c.P(tip, y + 2, J('aged_cedar', 3)); c.P(tip, y + 1, J('aged_cedar', 2)); c.P(tip, y + 3, J('aged_cedar', 2))
        for k in range(3): c.P(x0 + 3 + k * 3, y + 2, J('machiya_timber', 1))
    c.HL(5, 31, 7, J('aged_cedar', 0))


@kit('rg-wakimizu', '약수터(湧き水) - 대나무 대롱·돌 물받이·국자(2×2)', 2, 2, 'water', solid=[(0, 1), (1, 1)],
     tags=['약수터', '湧き水', '등산로', '신사'], rules='산길·참배길 가장자리 바위 옆.', role='prop')
def wakimizu(c, base):
    c.R(2, 4, 12, 16, J('shrine_flagstone', 2)); c.VL(2, 4, 16, J('shrine_flagstone', 4)); c.HL(2, 4, 12, J('shrine_flagstone', 3))
    for (x, y) in ((4, 8), (9, 13), (5, 16)): c.P(x, y, J('moss', 3)); c.P(x + 1, y, J('moss', 2))
    c.R(10, 10, 14, 3, J('moss', 3)); c.HL(10, 10, 14, J('moss', 4)); c.P(23, 11, J('moss', 1))
    for y in range(13, 22): c.P(24, y, J('vending_cool_white', 4 if y % 2 else 3))
    c.R(12, 21, 18, 9, J('shrine_flagstone', 2)); c.HL(12, 21, 18, J('shrine_flagstone', 4))
    c.R(14, 22, 14, 3, J('onsen_mineral_teal', 3)); c.HL(14, 22, 14, J('onsen_mineral_teal', 4))
    c.HL(12, 29, 18, J('shrine_flagstone', 0))
    line(c, 27, 22, 31, 17, J('aged_cedar', 3)); c.R(25, 22, 3, 2, J('aged_cedar', 2))


@kit('rg-mujin-eki', '시골 무인역 대합실 - 녹슨 함석 지붕·판자벽·나무 의자·역명판(6×4)', 6, 4, 'building', solid=[(0, 2), (1, 2), (2, 2), (3, 2), (0, 3), (1, 3), (2, 3), (3, 3)],
     tags=['무인역', '간이역', '시골', '철도'], rules='승강장(판석 광장 띠) 위, 선로와 나란히. 오른쪽 역명판 앞은 걸을 수 있다.', role='structure')
def mujin_eki(c, base):
    boards(c, 4, 20, 56, 38, mat='aged_cedar', t=2, bw=5, seed=3)
    c.R(10, 30, 44, 22, J('aged_cedar', 0)); c.R(12, 44, 40, 4, J('aged_cedar', 3)); c.HL(12, 44, 40, J('aged_cedar', 4))
    c.VL(14, 48, 8, J('aged_cedar', 1)); c.VL(48, 48, 8, J('aged_cedar', 1))
    c.R(18, 34, 10, 6, J('vending_cool_white', 3)); c.R(36, 33, 12, 8, J('noren_rust', 3))
    for y in range(8, 21):                                                          # 외쪽 지붕
        for x in range(0, 64):
            t = 3 if x % 4 == 0 else 2
            if y > 17: t = 1
            c.P(x, y, J('noren_rust', t - (1 if H(x // 4, y // 5, 7) > 0.85 else 0)))
    c.HL(0, 8, 64, OL); c.HL(0, 21, 64, OL)
    for x in range(4, 60): c.P(x, 58, OL)
    c.VL(70, 18, 40, J('kawara_dark_tile', 2)); c.VL(88, 18, 40, J('kawara_dark_tile', 2))
    c.R(66, 16, 28, 14, J('vending_cool_white', 4)); c.HL(66, 16, 28, OL); c.HL(66, 29, 28, OL); c.VL(66, 16, 14, OL); c.VL(93, 16, 14, OL)
    for k in range(4): c.R(70 + k * 5, 19, 3, 5, K('sumi', 1))
    c.HL(68, 26, 24, J('noren_indigo', 2))


# ═══════════════════════════ 바닥(fill_region 재료) ═══════════════════════════
def _sand(c):
    for y in range(16):
        for x in range(16):
            ripple = (y + round(math.sin((x + 3) / 16 * math.pi * 2) * 1.2)) % 6 == 0
            t = 3 + (1 if H(x, y, 1) > 0.9 else 0) - (1 if ripple else 0)
            c.P(x, y, J('cream_stucco', t) if H(x, y, 2) > 0.12 else J('tatami_straw', 3))


def _sea(c):
    for y in range(16):
        for x in range(16):
            t = 2
            if (y % 8 == 3 and (x + (y // 8) * 7) % 16 < 5): t = 3
            if (y % 8 == 4 and (x + (y // 8) * 7) % 16 < 4): t = 1
            if (x, y) in ((11, 11), (3, 2)): t = 4
            c.P(x, y, J('canal_indigo', t))


def _paddy(c):
    for y in range(16):
        for x in range(16):
            c.P(x, y, J('onsen_mineral_teal', 2 if (x + y * 3) % 13 else 3) if y % 4 else J('onsen_mineral_teal', 1))
    for y in range(1, 16, 4):
        for x in range(1, 16, 4):
            c.P(x, y, J('moss', 4)); c.P(x, y + 1, J('moss', 3)); c.P(x + 1, y, J('moss', 3)); c.P(x - 1, y + 1, J('moss', 2))


def _trail(c):
    for y in range(16):
        for x in range(16):
            h = H(x, y, 3)
            t = 3 if h < 0.6 else 2 if h < 0.9 else 4
            c.P(x, y, J('aged_cedar', t))
    for (x, y) in ((3, 4), (11, 2), (7, 11), (13, 13)): c.P(x, y, J('shrine_flagstone', 4)); c.P(x + 1, y + 1, J('shrine_flagstone', 1))


def _forest(c):
    for y in range(16):
        for x in range(16):
            h = H(x, y, 5)
            c.P(x, y, J('moss', 1 if h < 0.45 else 2 if h < 0.85 else 0))
    for (x, y) in ((2, 3), (9, 6), (5, 12), (13, 10)): c.P(x, y, J('aged_cedar', 3)); c.P(x + 1, y, J('aged_cedar', 2))
    for (x, y) in ((12, 2), (3, 8)): c.P(x, y, J('pine_bamboo', 4)); c.P(x - 1, y + 1, J('pine_bamboo', 3)); c.P(x + 1, y + 1, J('pine_bamboo', 3))


def _deck(c):
    for y in range(16):
        for x in range(16):
            r = y % 4
            t = 3 if r == 0 else 2 if r < 3 else 0
            if r != 3 and (x + (y // 4) * 5) % 16 == 0: t = 0
            c.P(x, y, J('aged_cedar', t))
    for (x, y) in ((2, 1), (13, 5), (6, 9), (10, 13)): c.P(x, y, J('aged_cedar', 1))


def _ishidatami(c):
    for y in range(16):
        for x in range(16):
            row = y // 5; ox = (row % 2) * 4
            sx = (x + ox) % 8; sy = y % 5 if y < 15 else 0
            if sx == 7 or sy == 4: c.P(x, y, J('wet_cobble', 0)); continue
            t = 2 + (1 if sx == 0 or sy == 0 else 0) - (1 if sx == 6 or sy == 3 else 0)
            if H((x + ox) // 8, row, 4) > 0.7: t += 1 if t < 3 else 0
            c.P(x, y, J('wet_cobble', t))


def _marsh(c):
    for y in range(16):
        for x in range(16):
            h = H(x, y, 7)
            c.P(x, y, J('moss', 3 if h < 0.5 else 2 if h < 0.85 else 4))
    for (x, y) in ((4, 10), (5, 10), (5, 11), (6, 11)): c.P(x, y, J('onsen_mineral_teal', 2))
    c.P(12, 4, J('vending_cool_white', 4)); c.P(12, 5, J('pine_bamboo', 3))
    for x in range(0, 16, 3): c.P(x, (x * 5) % 16, J('moss', 4))


def _oldrail(c):
    for y in range(16):
        for x in range(16):
            h = H(x, y, 9)
            c.P(x, y, J('gravel', 2 if h < 0.6 else 1 if h < 0.85 else 3))
    for y in (2, 10):
        c.HL(1, y, 14, J('machiya_timber', 2)); c.HL(1, y + 1, 14, J('machiya_timber', 1)); c.HL(1, y + 2, 14, J('machiya_timber', 0))
    for y in range(16):
        c.P(4, y, J('noren_rust', 2)); c.P(5, y, J('noren_rust', 1)); c.P(11, y, J('noren_rust', 2)); c.P(12, y, J('noren_rust', 1))
    for (x, y) in ((1, 6), (8, 14), (14, 7), (7, 5)): c.P(x, y, J('moss', 3)); c.P(x, y - 1, J('moss', 4))


GROUND = collections.OrderedDict((
    ('gnd/sand', (_sand, 'floor')), ('gnd/sea', (_sea, 'solidfloor')), ('gnd/paddy', (_paddy, 'solidfloor')), ('gnd/trail', (_trail, 'floor')),
    ('gnd/forest', (_forest, 'floor')), ('gnd/deck', (_deck, 'floor')), ('gnd/ishidatami', (_ishidatami, 'floor')), ('gnd/marsh', (_marsh, 'floor')),
    ('gnd/oldrail', (_oldrail, 'floor')),
))
GROUND_GROUPS = (
    ('jp:region-sand', '해변 모래사장', ['gnd/sand'], '해변·해안도로 모래(크림 회벽 밝은 단 + 짚빛 알갱이, 물결 자국). fill_region 몸통. 바다(「바다」)와 맞붙인다.'),
    ('jp:region-sea', '바다', ['gnd/sea'], '항구·해변의 바다(운하 쪽빛 램프, 물결 줄). 걸을 수 없다. 어선·테트라포드 키트를 위에 둔다.'),
    ('jp:region-paddy', '논(물 댄 모)', ['gnd/paddy'], '다랑논·시골 논(온천 청록 물 + 이끼색 모 줄). 걸을 수 없다 - 논두렁은 「산길 흙」으로 1칸 띠를 남긴다.'),
    ('jp:region-trail', '산길 흙', ['gnd/trail'], '등산로·논두렁·고개 흙길(삭은 삼나무 밝은 단 + 돌 알갱이). fill_region path 로 굽은 길.'),
    ('jp:region-forest', '숲 바닥(이끼·낙엽)', ['gnd/forest'], '삼나무·대숲·유적 숲의 바닥(이끼 그늘 단 + 낙엽 점).'),
    ('jp:region-deck', '나무 데크 탐방로', ['gnd/deck'], '고원 습원 나무 데크(가로 판재·이음). 습원(「습원 풀밭」) 위를 1~2칸 폭으로 지난다.'),
    ('jp:region-ishidatami', '온천가 돌길(이시다타미)', ['gnd/ishidatami'], '온천 마을 돌계단 길·항구 부두의 젖은 돌(엇갈린 돌판).'),
    ('jp:region-marsh', '습원 풀밭', ['gnd/marsh'], '고원 습원의 풀(이끼 램프 + 작은 물웅덩이·흰 꽃).'),
    ('jp:region-oldrail', '폐선 녹슨 선로', ['gnd/oldrail'], '폐선 철길(세로): 자갈 도상·침목·녹슨 레일·풀. 위아래로 이어 깐다.'),
)


def _cv(w, h):
    return Cv(w * 16, h * 16)


def _cells_of(a, R, C):
    for cy in range(R):
        for cx in range(C):
            t = a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16].copy()
            if not t[:, :, 3].any(): yield cx, cy, None; continue
            t[t[:, :, 3] == 0] = 0
            yield cx, cy, t


_CACHE = {}


def _finalize():
    if 'r' in _CACHE: return _CACHE['r']
    cells = collections.OrderedDict(); seen = {}; kits = []; renders = {}
    names = {cs[0]: nm for _, nm, cs, _ in GROUND_GROUPS}
    for name, (fn, pc) in GROUND.items():
        c = Cv(16, 16); fn(c)
        seen[(c.a.tobytes(), pc)] = name
        cells[name] = dict(img=Image.fromarray(c.a, 'RGBA'), pc=pc, label='일본 지역 바닥 · ' + names[name], desc='[지역 팩] 바닥 몸통 칸(1층).', tags=['바닥', '일본 지역'])
    for k in KITS:
        up, base = _cv(k['w'], k['h']), _cv(k['w'], k['h'])
        k['draw'](up, base)
        grids = {}
        for layer, cv in (('up', up), ('base', base)):
            g = [[None] * k['w'] for _ in range(k['h'])]
            for cx, cy, t in _cells_of(cv.a, k['h'], k['w']):
                if t is None: continue
                pc = 'floor' if layer == 'base' else ('solid' if (cx, cy) in k['solid'] else k['other'])
                key = (t.tobytes(), pc)
                if key not in seen:
                    loc = '%s/%s%d.%d' % (k['id'], 'b' if layer == 'base' else '', cx, cy)
                    seen[key] = loc
                    cells[loc] = dict(img=Image.fromarray(t, 'RGBA'), pc=pc, label='%s 칸 (%d,%d)%s' % (k['name'], cx, cy, ' 바닥' if layer == 'base' else ''),
                                      desc='[지역 팩] %s 의 일부. 키트 jp-%s 로 통째로 놓는다.' % (k['name'], k['id']), tags=list(k['tags']))
                g[cy][cx] = seen[key]
            grids[layer] = g
        has_base = any(v for r in grids['base'] for v in r)
        desc = '%s - 폭 %d칸×높이 %d칸. 손 도트 일본 지역 팩(일본 로케일 팔레트 계약 색, 빛 왼쪽 위, 3/4).%s' % (k['name'], k['w'], k['h'], ' 바닥(1층) 칸 포함.' if has_base else '')
        ai = dict(snap='floor', tags=list(k['tags']) + ['jp-region'], description=desc, placementRules=k['rules'], repeatability='fixed', growthAxis=None,
                  anchor=dict(dx=0, dy=k['h'] - 1), access=[], role=STRUCTURE_ROLE.get(k['id'], k['role']) if k['role'] == 'structure' else k['role'])
        kits.append(dict(id='jp-' + k['id'], name=k['name'], grid=grids['up'], base=grids['base'] if has_base else None, parts=[], ai=ai))
        comp = Image.new('RGBA', (k['w'] * 16, k['h'] * 16), (0, 0, 0, 0))
        comp.alpha_composite(Image.fromarray(base.a, 'RGBA')); comp.alpha_composite(Image.fromarray(up.a, 'RGBA'))
        renders[k['id']] = comp
    groups = [dict(id=gid, name=nm, role='terrain', defaultLayer='lower', cells=list(cs), desc=d, rules=d)
              for gid, nm, cs, d in GROUND_GROUPS]
    _CACHE['r'] = (cells, kits, renders, groups)
    return _CACHE['r']


# 굽기 키트 역할 열거(bake_lib ENUM krole)에 「structure」는 없다 - 구조물을 가장 가까운 역할로 맞춘다.
STRUCTURE_ROLE = {'rg-ishigaki': 'wall', 'rg-tenshu': 'castle', 'rg-shoro': 'building', 'rg-stone-ruin': 'wall', 'rg-rotenburo': 'water',
                  'rg-waterfall': 'water', 'rg-tsuribashi': 'terrain', 'rg-lighthouse': 'building', 'rg-ropeway': 'building', 'rg-lodge': 'building',
                  'rg-tunnel': 'wall', 'rg-mujin-eki': 'building'}

NOTES = '일본 30 지역 팩: 모래사장·바다·논·산길·숲 바닥·데크·온천 돌길·습원·폐선 바닥 + 대숲·삼나무·곰솔·단풍·石垣·天守·露天風呂·湯けむり·폭포·출렁다리·유적·석불·종루·등대·어선·해바라기·로프웨이·산장·폐선 터널·허수아비·はざ掛け·屋台·이정표·약수터·무인역·테트라포드. 키트 %d종.'


def build():
    cells, kits, renders, groups = _finalize()
    return {'cells': collections.OrderedDict((k, dict(v, img=v['img'].copy(), tags=list(v['tags']))) for k, v in cells.items()),
            'autotiles': [], 'groups': [dict(g, cells=list(g['cells'])) for g in groups], 'kits': [dict(k) for k in kits], 'notes': NOTES % len(kits)}


def kinds():
    return {'jp-' + k['id']: k['kind'] for k in KITS}


def _allowed():
    from lib_blocks_lines.core import _owner
    return set(_owner()) | {v for r in _RAMP.values() for v in r}


def selftest(verbose=True):
    """칸 16×16 RGBA · 알파 0/255 · 색 ⊂ modern3 ∪ 일본 로케일 계약 · 키트 칸 참조 · 채도 상한."""
    out = []
    allowed = _allowed()
    b = build()
    for k, c in b['cells'].items():
        a = np.array(c['img'])
        if a.shape != (16, 16, 4): out.append('(a) %s 크기' % k); continue
        al = a[..., 3]
        if not np.all((al == 0) | (al == 255)): out.append('(a) %s 반투명' % k)
        vis = a[al == 255][:, :3]
        for r, g, bb in {tuple(map(int, p)) for p in vis}:
            if ((r << 16) | (g << 8) | bb) not in allowed: out.append('(a) %s 팔레트 밖 #%02x%02x%02x' % (k, r, g, bb)); break
    ids = [k['id'] for k in b['kits']]
    if len(ids) != len(set(ids)): out.append('키트 id 중복')
    for k in b['kits']:
        for layer in ('grid', 'base'):
            for row in (k[layer] or []):
                for v in row:
                    if v is not None and v not in b['cells']: out.append('(b) %s 칸 %s 없음' % (k['id'], v))
    if verbose:
        print('jp_regions_pack: 칸 %d · 키트 %d · 문제 %d' % (len(b['cells']), len(b['kits']), len(out)))
        for m in out[:20]: print('  ', m)
    return len(out)


def preview(outdir=OUTDIR):
    os.makedirs(outdir, exist_ok=True)
    cells, kits, renders, groups = _finalize()
    bg = (78, 92, 70, 255)
    ims = [renders[k['id']] for k in KITS]
    W = 900; x = y = 0; rowh = 0; pos = []
    for im in ims:
        if x + im.width > W: x = 0; y += rowh + 8; rowh = 0
        pos.append((x, y)); x += im.width + 8; rowh = max(rowh, im.height)
    gy = y + rowh + 10
    S = Image.new('RGBA', (W, gy + 40), bg)
    for im, p in zip(ims, pos): S.alpha_composite(im, p)
    for i, name in enumerate(GROUND):                                               # 바닥은 2×2 로 이어 붙여 이음새를 본다
        for dy in range(2):
            for dx in range(2): S.alpha_composite(cells[name]['img'], (i * 40 + dx * 16, gy + dy * 16))
    S.save(os.path.join(outdir, '_all.png'))
    S.resize((S.width * 2, S.height * 2), Image.NEAREST).save(os.path.join(outdir, '_all-x2.png'))
    for k in KITS: renders[k['id']].save(os.path.join(outdir, 'jp-%s.png' % k['id']))
    return os.path.join(outdir, '_all-x2.png')


if __name__ == '__main__':
    bad = selftest()
    print(preview(sys.argv[1] if len(sys.argv) > 1 else OUTDIR))
    sys.exit(1 if bad else 0)
